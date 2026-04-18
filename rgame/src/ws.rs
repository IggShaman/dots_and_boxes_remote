use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::game::Player;
use crate::protocol::{ClientMsg, ServerMsg};
use crate::session::{GameSession, SharedLobby, WaitingPlayer};

pub async fn handle_socket(socket: WebSocket, lobby: SharedLobby) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap();
            if sink.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // ── Phase 1: wait for Join ───────────────────────────────────────────────
    let (name, color, swedish_mode) = loop {
        match stream.next().await {
            Some(Ok(Message::Text(text))) => {
                match serde_json::from_str::<ClientMsg>(&text) {
                    Ok(ClientMsg::Join { name, color, swedish_mode }) if !name.trim().is_empty() => {
                        break (name.trim().to_string(), color, swedish_mode);
                    }
                    _ => {
                        let _ = tx.send(ServerMsg::Error {
                            message: "Send {\"type\":\"join\",\"name\":\"…\",\"color\":\"#rrggbb\"} first".into(),
                        });
                    }
                }
            }
            _ => return,
        }
    };

    // ── Phase 2: matchmaking ─────────────────────────────────────────────────
    // Player1's swedish_mode preference is used for the session.
    let (session_id, player_idx) = {
        let mut guard = lobby.lock().await;

        if let Some(waiter) = guard.waiting.take() {
            let id = Uuid::new_v4();
            let mode = waiter.swedish_mode;
            let session = GameSession::new(
                id,
                waiter.tx.clone(), waiter.name.clone(), waiter.color.clone(),
                tx.clone(),        name.clone(),         color.clone(),
                mode,
            );

            session.send_to(0, ServerMsg::GameStart {
                you_are: Player::Player1,
                opponent_name: name.clone(),
                opponent_color: color.clone(),
                swedish_mode: mode,
            });
            session.send_to(1, ServerMsg::GameStart {
                you_are: Player::Player2,
                opponent_name: waiter.name.clone(),
                opponent_color: waiter.color.clone(),
                swedish_mode: mode,
            });
            let state_msg = ServerMsg::GameState { state: session.state.clone() };
            session.broadcast(&state_msg);

            let _ = waiter.session_ready.send(id);
            guard.sessions.insert(id, session);
            (id, 1usize)
        } else {
            let (ready_tx, mut ready_rx) = oneshot::channel::<Uuid>();
            guard.waiting = Some(WaitingPlayer {
                name: name.clone(),
                color: color.clone(),
                tx: tx.clone(),
                swedish_mode,
                session_ready: ready_tx,
            });
            drop(guard);

            let _ = tx.send(ServerMsg::Waiting);

            let matched = loop {
                tokio::select! {
                    result = &mut ready_rx => { break result.ok(); }
                    msg = stream.next() => {
                        match msg {
                            None | Some(Ok(Message::Close(_))) | Some(Err(_)) => {
                                let mut g = lobby.lock().await;
                                if matches!(&g.waiting, Some(w) if w.name == name) {
                                    g.waiting = None;
                                }
                                break None;
                            }
                            _ => {}
                        }
                    }
                }
            };

            match matched {
                Some(id) => (id, 0usize),
                None => return,
            }
        }
    };

    // ── Phase 3: game loop ───────────────────────────────────────────────────
    while let Some(Ok(msg)) = stream.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let client_msg = match serde_json::from_str::<ClientMsg>(&text) {
            Ok(m) => m,
            Err(_) => {
                let _ = tx.send(ServerMsg::Error { message: "Malformed JSON".into() });
                continue;
            }
        };

        match client_msg {
            ClientMsg::Move { r1, c1, r2, c2 } => {
                let mut guard = lobby.lock().await;
                let session = match guard.sessions.get_mut(&session_id) {
                    Some(s) => s,
                    None => break,
                };

                let expected = if player_idx == 0 { Player::Player1 } else { Player::Player2 };
                if session.state.current_player != expected || session.state.game_over {
                    let _ = tx.send(ServerMsg::InvalidMove { reason: "Not your turn".into() });
                    continue;
                }

                if !session.state.make_move(r1, c1, r2, c2) {
                    let _ = tx.send(ServerMsg::InvalidMove { reason: "Illegal move".into() });
                    continue;
                }

                let state_msg = ServerMsg::GameState { state: session.state.clone() };
                session.broadcast(&state_msg);
            }
            ClientMsg::Join { .. } => {
                let _ = tx.send(ServerMsg::Error { message: "Already in a game".into() });
            }
        }
    }

    // ── Cleanup on disconnect ────────────────────────────────────────────────
    let mut guard = lobby.lock().await;
    if let Some(session) = guard.sessions.remove(&session_id) {
        session.broadcast(&ServerMsg::OpponentDisconnected);
    }
}
