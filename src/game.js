export const GRID_SIZE = 6;

export function initGameState() {
  return {
    // points[r][c]: null | 'player1' | 'player2'
    points: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    // hLines[r][c]: line from (r,c)→(r,c+1),  c ∈ [0, GRID_SIZE-2]
    hLines: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE - 1).fill(null)),
    // vLines[r][c]: line from (r,c)→(r+1,c),  r ∈ [0, GRID_SIZE-2]
    vLines: Array(GRID_SIZE - 1).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    // squares[sr][sc]: square with top-left at (sr,sc), indices ∈ [0, GRID_SIZE-2]
    squares: Array(GRID_SIZE - 1).fill(null).map(() => Array(GRID_SIZE - 1).fill(null)),
    scores: { player1: 0, player2: 0 },
    currentPlayer: 'player1',
    gameOver: false,
  };
}

function getLine(hLines, vLines, r1, c1, r2, c2) {
  if (r1 === r2) return hLines[r1][Math.min(c1, c2)];
  return vLines[Math.min(r1, r2)][c1];
}

function isAdjacent(r1, c1, r2, c2) {
  return (r1 === r2 && Math.abs(c1 - c2) === 1) ||
         (c1 === c2 && Math.abs(r1 - r2) === 1);
}

export function isValidMove(state, r1, c1, r2, c2) {
  if (!isAdjacent(r1, c1, r2, c2)) return false;
  if (getLine(state.hLines, state.vLines, r1, c1, r2, c2) !== null) return false;
  // At least one endpoint must be free (uncolored)
  if (state.points[r1][c1] !== null && state.points[r2][c2] !== null) return false;
  return true;
}

// Returns the at-most-2 square positions adjacent to the given line segment
function adjacentSquares(r1, c1, r2, c2) {
  const out = [];
  if (r1 === r2) {
    const r = r1, c = Math.min(c1, c2);
    if (r > 0) out.push([r - 1, c]);
    if (r < GRID_SIZE - 1) out.push([r, c]);
  } else {
    const c = c1, r = Math.min(r1, r2);
    if (c > 0) out.push([r, c - 1]);
    if (c < GRID_SIZE - 1) out.push([r, c]);
  }
  return out.filter(([sr, sc]) =>
    sr >= 0 && sr < GRID_SIZE - 1 && sc >= 0 && sc < GRID_SIZE - 1
  );
}

export function makeMove(state, r1, c1, r2, c2) {
  const player = state.currentPlayer;
  if (!isValidMove(state, r1, c1, r2, c2)) return null;

  const newPoints = state.points.map(r => [...r]);
  if (newPoints[r1][c1] === null) newPoints[r1][c1] = player;
  if (newPoints[r2][c2] === null) newPoints[r2][c2] = player;

  const newH = state.hLines.map(r => [...r]);
  const newV = state.vLines.map(r => [...r]);
  if (r1 === r2) newH[r1][Math.min(c1, c2)] = player;
  else           newV[Math.min(r1, r2)][c1] = player;

  const newSquares = state.squares.map(r => [...r]);
  let gained = 0;

  for (const [sr, sc] of adjacentSquares(r1, c1, r2, c2)) {
    if (newSquares[sr][sc] !== null) continue;
    if (
      newH[sr][sc]     !== null &&
      newH[sr + 1][sc] !== null &&
      newV[sr][sc]     !== null &&
      newV[sr][sc + 1] !== null
    ) {
      newSquares[sr][sc] = player;
      gained++;
    }
  }

  const newScores = { ...state.scores, [player]: state.scores[player] + gained };
  const next = gained > 0 ? player : (player === 'player1' ? 'player2' : 'player1');

  const newState = {
    points: newPoints,
    hLines: newH,
    vLines: newV,
    squares: newSquares,
    scores: newScores,
    currentPlayer: next,
    gameOver: false,
  };
  newState.gameOver = !hasAnyValidMove(newState);
  return newState;
}

export function validSecondPoints(state, r, c) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr,nc]) => nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE)
    .filter(([nr,nc]) => isValidMove(state, r, c, nr, nc))
    .map(([nr,nc]) => ({ row: nr, col: nc }));
}

export function isValidFirstPoint(state, r, c) {
  return validSecondPoints(state, r, c).length > 0;
}

export function hasAnyValidMove(state) {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (isValidFirstPoint(state, r, c)) return true;
  return false;
}
