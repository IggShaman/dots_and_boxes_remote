use serde::{Deserialize, Serialize};

use crate::game::{GameState, Player};

/// Messages sent from the browser client to the server.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    /// First message after connecting: register a player name and join the lobby.
    Join { name: String },
    /// Draw a line between two adjacent points.
    Move { r1: usize, c1: usize, r2: usize, c2: usize },
}

/// Messages sent from the server to a browser client.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    /// Waiting for a second player to connect.
    Waiting,
    /// Game has started; tells the client which side it is and the opponent's name.
    GameStart {
        you_are: Player,
        opponent_name: String,
    },
    /// Full game state after each move (sent to both players).
    GameState {
        state: GameState,
    },
    /// A move was rejected (wrong player, invalid coordinates, etc.).
    InvalidMove {
        reason: String,
    },
    /// The other player disconnected; game is over.
    OpponentDisconnected,
    /// Generic server error.
    Error {
        message: String,
    },
}
