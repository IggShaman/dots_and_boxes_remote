use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::game::Player;
use crate::protocol::{ClientMsg, ServerMsg};
use crate::session::{SharedLobby, WaitingPlayer};

pub async fn handle_socket(socket: WebSocket, lobby: SharedLobby) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    // Forward outbound ServerMsgs to the WebSocket.
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap();
            if ws_tx.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // --- Join phase: wait for a Join message ---
    let name = loop {
        match ws_rx.next().await {
            Some(Ok(Message::Text(text))) => {
                match serde_json::from_str::<ClientMsg>(&text) {
                    Ok(ClientMsg::Join { name }) if !name.trim().is_empty() => {
                        break name.trim().to_string();
                    }
                    _ => {
                        let _ = tx.send(ServerMsg::Error {
                            message: "Send {\"type\":\"join\",\"name\":\"<your name>\"} first".into(),
                        });
                    }
                }
            }
            _ => return, // disconnected before joining
        }
    };

    // --- Matchmaking: pair with a waiting player or wait ---
    let (session_id, player_idx) = {
        let mut lobby_guard = lobby.lock().await;
        if let Some(waiter) = lobby_guard.waiting.take() {
            // We are player2; create the session.
            let id = Uuid::new_v4();
            let session = crate::session::GameSession::new(
                id,
                waiter.tx.clone(),
                waiter.name.clone(),
                tx.clone(),
                name.clone(),
            );

            // Notify both players that the game is starting.
            session.send_to(0, ServerMsg::GameStart {
                you_are: Player::Player1,
                opponent_name: name.clone(),
            });
            session.send_to(1, ServerMsg::GameStart {
                you_are: Player::Player2,
                opponent_name: waiter.name.clone(),
            });

            // Send initial (empty) game state to both.
            let state_msg = ServerMsg::GameState { state: session.state.clone() };
            session.broadcast(&state_msg);

            lobby_guard.sessions.insert(id, session);
            (id, 1usize)
        } else {
            // No one waiting yet; park ourselves and tell the client.
            lobby_guard.waiting = Some(WaitingPlayer { name: name.clone(), tx: tx.clone() });
            let _ = tx.send(ServerMsg::Waiting);
            (Uuid::nil(), 0usize) // placeholder; session created when opponent arrives
        }
    };

    // If we are the waiting player (session_id is nil), we stay blocked until
    // the session is created by whoever joins next, then continue in the game loop.
    let session_id = if session_id.is_nil() {
        // Poll until our session exists (the opponent's handler creates it).
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            let guard = lobby.lock().await;
            // Once the waiting slot is cleared AND a session references our tx,
            // we can find our session by looking for the one that contains our sender.
            let found = guard.sessions.values().find(|s| {
                // The player1 tx's channel is the one we registered.
                // We compare by pointer — check if any session's player[0] points to our mpsc.
                // Easiest: the session that was just created will have player_idx 0 == our tx.
                // We identify it via the absence of a waiter (already taken) and non-nil id.
                guard.waiting.is_none() && s.names[0] == name
            });
            if let Some(s) = found {
                break s.id;
            }
        }
    } else {
        session_id
    };

    // --- Game loop ---
    while let Some(Ok(msg)) = ws_rx.next().await {
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
                let mut lobby_guard = lobby.lock().await;
                let session = match lobby_guard.sessions.get_mut(&session_id) {
                    Some(s) => s,
                    None => break,
                };

                let expected = if player_idx == 0 { Player::Player1 } else { Player::Player2 };
                if session.state.current_player != expected || session.state.game_over {
                    let _ = tx.send(ServerMsg::InvalidMove {
                        reason: "Not your turn".into(),
                    });
                    continue;
                }

                if !session.state.make_move(r1, c1, r2, c2) {
                    let _ = tx.send(ServerMsg::InvalidMove {
                        reason: "Illegal move".into(),
                    });
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

    // --- Cleanup on disconnect ---
    let mut lobby_guard = lobby.lock().await;
    if let Some(session) = lobby_guard.sessions.remove(&session_id) {
        session.broadcast(&ServerMsg::OpponentDisconnected);
    } else {
        // We were still waiting; remove from lobby.
        if let Some(ref w) = lobby_guard.waiting {
            if w.name == name {
                lobby_guard.waiting = None;
            }
        }
    }
}
