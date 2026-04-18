use serde::{Deserialize, Serialize};

pub const GRID_SIZE: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Player {
    Player1,
    Player2,
}

impl Player {
    pub fn other(self) -> Player {
        match self {
            Player::Player1 => Player::Player2,
            Player::Player2 => Player::Player1,
        }
    }
}

/// Serializes as {"player1": N, "player2": N} — matches the JS `scores` shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scores {
    pub player1: u32,
    pub player2: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    /// points[r][c]: which player colored this point, if any
    pub points: Vec<Vec<Option<Player>>>,
    /// hLines[r][c]: line from (r,c)→(r,c+1), c ∈ [0, GRID_SIZE-2]
    pub h_lines: Vec<Vec<Option<Player>>>,
    /// vLines[r][c]: line from (r,c)→(r+1,c), r ∈ [0, GRID_SIZE-2]
    pub v_lines: Vec<Vec<Option<Player>>>,
    /// squares[sr][sc]: owner of square with top-left at (sr,sc)
    pub squares: Vec<Vec<Option<Player>>>,
    pub scores: Scores,
    pub current_player: Player,
    pub game_over: bool,
}

impl GameState {
    pub fn new() -> Self {
        GameState {
            points:  vec![vec![None; GRID_SIZE]; GRID_SIZE],
            h_lines: vec![vec![None; GRID_SIZE - 1]; GRID_SIZE],
            v_lines: vec![vec![None; GRID_SIZE]; GRID_SIZE - 1],
            squares: vec![vec![None; GRID_SIZE - 1]; GRID_SIZE - 1],
            scores:  Scores { player1: 0, player2: 0 },
            current_player: Player::Player1,
            game_over: false,
        }
    }

    fn get_line(&self, r1: usize, c1: usize, r2: usize, c2: usize) -> Option<Player> {
        if r1 == r2 {
            self.h_lines[r1][c1.min(c2)]
        } else {
            self.v_lines[r1.min(r2)][c1]
        }
    }

    pub fn is_valid_move(&self, r1: usize, c1: usize, r2: usize, c2: usize) -> bool {
        let adjacent = (r1 == r2 && c1.abs_diff(c2) == 1) || (c1 == c2 && r1.abs_diff(r2) == 1);
        adjacent && self.get_line(r1, c1, r2, c2).is_none()
    }

    fn adjacent_squares(r1: usize, c1: usize, r2: usize, c2: usize) -> Vec<(usize, usize)> {
        let mut out = Vec::with_capacity(2);
        if r1 == r2 {
            let c = c1.min(c2);
            if r1 > 0             { out.push((r1 - 1, c)); }
            if r1 < GRID_SIZE - 1 { out.push((r1,     c)); }
        } else {
            let r = r1.min(r2);
            if c1 > 0             { out.push((r, c1 - 1)); }
            if c1 < GRID_SIZE - 1 { out.push((r, c1    )); }
        }
        out.retain(|&(sr, sc)| sr < GRID_SIZE - 1 && sc < GRID_SIZE - 1);
        out
    }

    /// Apply a move. Returns `false` if the move is invalid.
    pub fn make_move(&mut self, r1: usize, c1: usize, r2: usize, c2: usize) -> bool {
        if !self.is_valid_move(r1, c1, r2, c2) {
            return false;
        }
        let player = self.current_player;

        if self.points[r1][c1].is_none() { self.points[r1][c1] = Some(player); }
        if self.points[r2][c2].is_none() { self.points[r2][c2] = Some(player); }

        if r1 == r2 {
            self.h_lines[r1][c1.min(c2)] = Some(player);
        } else {
            self.v_lines[r1.min(r2)][c1] = Some(player);
        }

        let mut gained = 0u32;
        for (sr, sc) in Self::adjacent_squares(r1, c1, r2, c2) {
            if self.squares[sr][sc].is_some() { continue; }
            if self.h_lines[sr][sc].is_some()
                && self.h_lines[sr + 1][sc].is_some()
                && self.v_lines[sr][sc].is_some()
                && self.v_lines[sr][sc + 1].is_some()
            {
                self.squares[sr][sc] = Some(player);
                gained += 1;
            }
        }

        match player {
            Player::Player1 => self.scores.player1 += gained,
            Player::Player2 => self.scores.player2 += gained,
        }

        if gained == 0 {
            self.current_player = player.other();
        }

        self.game_over = !self.has_any_valid_move();
        true
    }

    pub fn has_any_valid_move(&self) -> bool {
        for r in 0..GRID_SIZE {
            for c in 0..GRID_SIZE {
                let neighbors = [
                    (r.wrapping_sub(1), c),
                    (r + 1, c),
                    (r, c.wrapping_sub(1)),
                    (r, c + 1),
                ];
                for (nr, nc) in neighbors {
                    if nr < GRID_SIZE && nc < GRID_SIZE && self.is_valid_move(r, c, nr, nc) {
                        return true;
                    }
                }
            }
        }
        false
    }
}
