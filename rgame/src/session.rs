use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex};
use uuid::Uuid;

use crate::game::GameState;
use crate::protocol::ServerMsg;

pub type SessionId = Uuid;
pub type Tx = mpsc::UnboundedSender<ServerMsg>;

#[derive(Debug)]
pub struct GameSession {
    pub id: SessionId,
    pub state: GameState,
    pub players: [Tx; 2],
    pub names: [String; 2],
    pub colors: [String; 2],
}

impl GameSession {
    pub fn new(
        id: SessionId,
        p1_tx: Tx, p1_name: String, p1_color: String,
        p2_tx: Tx, p2_name: String, p2_color: String,
    ) -> Self {
        GameSession {
            id,
            state: GameState::new(),
            players: [p1_tx, p2_tx],
            names:   [p1_name, p2_name],
            colors:  [p1_color, p2_color],
        }
    }

    pub fn broadcast(&self, msg: &ServerMsg) {
        for tx in &self.players {
            let _ = tx.send(msg.clone());
        }
    }

    pub fn send_to(&self, player_idx: usize, msg: ServerMsg) {
        let _ = self.players[player_idx].send(msg);
    }
}

/// A player waiting in the lobby for an opponent.
pub struct WaitingPlayer {
    pub name: String,
    pub color: String,
    pub tx: Tx,
    /// Fulfilled by whoever creates the session (player2's handler).
    pub session_ready: oneshot::Sender<SessionId>,
}

#[derive(Default)]
pub struct Lobby {
    pub waiting: Option<WaitingPlayer>,
    pub sessions: HashMap<SessionId, GameSession>,
}

pub type SharedLobby = Arc<Mutex<Lobby>>;
