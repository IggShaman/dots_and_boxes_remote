use serde::{Deserialize, Serialize};

use crate::game::{GameState, Player};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    Join {
        name: String,
        color: String,
        #[serde(default)]
        swedish_mode: bool,
    },
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
        swedish_mode: bool,
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
