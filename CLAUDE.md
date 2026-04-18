# Dots & Boxes — Project Guide

## Overview

Remote two-player Dots & Boxes. Each player uses their own browser; moves flow through a Rust WebSocket server (`rgame`) that owns the authoritative game state.

## Running the project

```bash
# Terminal 1 — Rust game server (port 3001)
cd rgame && cargo run

# Terminal 2 — React frontend (port 3000)
npm install && npm run dev
```

Open two browser tabs to `http://localhost:3000`. Each player enters a name and color, clicks **Find Game**, and is matched automatically.

## Architecture

```
index.html              Vite entry point
src/
  main.jsx              JoinScreen, WaitingScreen, GameScreen; WebSocket client
  GameBoard.jsx         SVG board (points, lines, squares, hover/selection)
  game.js               Pure JS game logic — used client-side for UI hints only
  app.css               Styles
rgame/
  src/
    main.rs             Axum router — /ws endpoint, port 3001
    game.rs             Authoritative game logic in Rust (mirrors game.js)
    protocol.rs         JSON message types (ClientMsg / ServerMsg)
    session.rs          GameSession, Lobby, WaitingPlayer (oneshot matchmaking)
    ws.rs               WebSocket handler: join → matchmake → game loop → cleanup
```

## WebSocket protocol

**Client → Server**
```json
{ "type": "join",  "name": "Alice", "color": "#e03131" }
{ "type": "move",  "r1": 0, "c1": 0, "r2": 0, "c2": 1 }
```

**Server → Client**
```json
{ "type": "waiting" }
{ "type": "game_start", "you_are": "player1", "opponent_name": "Bob", "opponent_color": "#1971c2" }
{ "type": "game_state", "state": { ... } }
{ "type": "invalid_move", "reason": "Not your turn" }
{ "type": "opponent_disconnected" }
```

`game_state.state` fields use camelCase (`hLines`, `vLines`, `currentPlayer`, `gameOver`, `scores.player1/2`) to match what `game.js` expects directly.

## Matchmaking flow

1. First player connects → parks in the lobby, receives `waiting`.
2. Second player connects → lobby pairs them, creates a `GameSession`, sends `game_start` to both, broadcasts initial `game_state`.
3. Player1's handler is unblocked via a `tokio::sync::oneshot` channel (no polling).
4. On disconnect mid-game, the remaining player receives `opponent_disconnected`.

## Game rules

As specified by the user:

- **Board**: 6×6 grid of 36 points.
- **Points**: each point is either *free* (uncolored) or colored with one of the two players' colors.
- **Turns**: players alternate. A player keeps their turn if they complete a square.
- **Move**: select any two *adjacent* points — same row or column, exactly one step apart (no points in between) — where no line has been drawn between them yet. Points may be selected regardless of color (free, own, or opponent's).
- **After a move**:
  1. Any free point in the selected pair is colored with the current player's color.
  2. A line is drawn between the two points in the current player's color.
  3. If the new line completes a closed 4-line square, that square is filled with the player's color (darker diagonal-stripe pattern) and added to their score.
  4. Completing one or more squares grants the player an additional turn.
- **Game over**: when no valid move remains (all adjacent pairs already have a line).
- **Winner**: the player with the most squares.

## Session log — initial build (2026-04-17)

### What was built

1. **GitHub repo** created at `git@github.com:IggShaman/dots_and_boxes.git`.
2. **New-game screen**: two player cards with name inputs (K-pop defaults: Jungkook / Rosé) and an 8-color palette picker. Colors must differ; Start Game button is disabled otherwise.
3. **Vite dev server** (`npm run dev → localhost:3000`). Started as a CDN-only single HTML file but switched to Vite + npm packages after Chrome's ORB policy blocked the unpkg Blueprint UMD bundles.
4. **BlueprintJS v6** via npm, with `@vitejs/plugin-react` for JSX.
5. **Playwright MCP** added for browser-in-the-loop debugging (`claude mcp add playwright -- npx @playwright/mcp@latest`).
6. **Full game implementation**:
   - `src/game.js` — `initGameState`, `makeMove`, `isValidMove`, `validSecondPoints`, `hasAnyValidMove`.
   - `src/GameBoard.jsx` — SVG board: ghost grid, stripe-filled squares, colored lines, point selection/hover highlights and preview line.
   - `src/main.jsx` — `NewGameScreen`, `GameScreen` with score header and turn banner.

### Key decisions & corrections

| # | Decision |
|---|----------|
| 1 | Switched from CDN UMD to npm + Vite because unpkg UMD was blocked by `ERR_BLOCKED_BY_ORB`. |
| 2 | Blueprint 5 global was `_Blueprint` (not `Blueprint`), but Babel scope issues made even `window._Blueprint` fail — confirmed via Playwright evaluate. Root fix: use npm imports. |
| 3 | Rule correction: *any* two adjacent points may be connected regardless of their color; the only constraint is no existing line between them. (Original implementation incorrectly required at least one free endpoint.) |
| 4 | Adjacency means strictly 1 step apart in the same row or column — no diagonals, no skipping. |
