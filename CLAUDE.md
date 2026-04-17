# Dots & Boxes — Project Guide

## Running the project

```bash
npm install
npm run dev      # serves at http://localhost:3000
```

## Architecture

Single-page React app bundled by Vite. All game logic is pure JS; the board is SVG.

```
index.html          Vite entry point
src/
  main.jsx          App shell, NewGameScreen, GameScreen
  GameBoard.jsx     SVG board renderer (points, lines, squares, hover/selection)
  game.js           Pure game logic (no React)
  app.css           Styles
```

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
