use serde::{Deserialize, Serialize};

use crate::game::{GameState, Player};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    /// First message: register name + chosen color (hex string), then join the lobby.
    Join { name: String, color: String },
    /// Draw a line between two adjacent points.
    Move { r1: usize, c1: usize, r2: usize, c2: usize },
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    Waiting,
    GameStart {
        you_are: Player,
        opponent_name: String,
        opponent_color: String,
    },
    GameState {
        state: GameState,
    },
    InvalidMove {
        reason: String,
    },
    OpponentDisconnected,
    Error {
        message: String,
    },
}
