import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button, Card, Elevation, FormGroup, InputGroup, Intent } from '@blueprintjs/core';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import 'normalize.css';
import './app.css';
import { GameBoard } from './GameBoard';
import {
  initGameState, makeMove,
  isValidFirstPoint, validSecondPoints,
} from './game';

// ── Constants ──────────────────────────────────────────────────────────────

const PALETTE = [
  { label: 'Crimson',   value: '#e03131' },
  { label: 'Cobalt',    value: '#1971c2' },
  { label: 'Violet',    value: '#7048e8' },
  { label: 'Emerald',   value: '#2f9e44' },
  { label: 'Tangerine', value: '#e67700' },
  { label: 'Teal',      value: '#0c8599' },
  { label: 'Rose',      value: '#c2255c' },
  { label: 'Marigold',  value: '#c98a00' },
];

const DEFAULT_PLAYERS = [
  { name: 'Jungkook', color: PALETTE[0] },
  { name: 'Rosé',     color: PALETTE[1] },
];

// ── New-game screen ────────────────────────────────────────────────────────

function ColorPicker({ selected, takenValue, onChange }) {
  return (
    <div className="color-swatches">
      {PALETTE.map(color => {
        const isTaken    = color.value === takenValue;
        const isSelected = color.value === selected.value;
        let cls = 'color-swatch';
        if (isSelected) cls += ' swatch-selected';
        if (isTaken)    cls += ' swatch-taken';
        return (
          <div key={color.value} className={cls}
            style={{ backgroundColor: color.value }}
            title={isTaken ? `${color.label} (taken)` : color.label}
            onClick={() => { if (!isTaken) onChange(color); }}
          />
        );
      })}
    </div>
  );
}

function PlayerCard({ number, player, otherColor, onChange }) {
  return (
    <Card elevation={Elevation.THREE} className="player-card">
      <div className="player-card-header">
        <span className="player-badge" style={{ backgroundColor: player.color.value }}>
          {number}
        </span>
        <p className="player-card-title">Player {number}</p>
      </div>
      <FormGroup label="Name">
        <InputGroup
          value={player.name}
          onChange={e => onChange({ ...player, name: e.target.value })}
          placeholder="Enter name…"
          large
        />
      </FormGroup>
      <FormGroup label="Color">
        <ColorPicker
          selected={player.color}
          takenValue={otherColor}
          onChange={color => onChange({ ...player, color })}
        />
      </FormGroup>
      <div className="player-preview" style={{ backgroundColor: player.color.value }}>
        {player.name.trim() || `Player ${number}`}
      </div>
    </Card>
  );
}

function NewGameScreen({ onStart }) {
  const [players, setPlayers] = React.useState(DEFAULT_PLAYERS);
  const update = (i, p) => setPlayers(prev => prev.map((x, j) => j === i ? p : x));

  const namesOk  = players.every(p => p.name.trim().length > 0);
  const colorsOk = players[0].color.value !== players[1].color.value;
  const canStart = namesOk && colorsOk;

  return (
    <>
      <h1 className="app-title">Dots &amp; Boxes</h1>
      <p className="app-subtitle">A two-player game of lines and squares</p>
      <div className="players-row">
        <PlayerCard number={1} player={players[0]} otherColor={players[1].color.value}
          onChange={p => update(0, p)} />
        <PlayerCard number={2} player={players[1]} otherColor={players[0].color.value}
          onChange={p => update(1, p)} />
      </div>
      <div className="start-row">
        {!colorsOk && (
          <span className="color-conflict-msg">Players must choose different colors.</span>
        )}
        <Button large intent={Intent.PRIMARY} disabled={!canStart}
          onClick={() => onStart(players)} icon="play" text="Start Game" />
      </div>
    </>
  );
}

// ── Game screen ────────────────────────────────────────────────────────────

function GameScreen({ config, onNewGame }) {
  const [gameState, setGameState] = React.useState(initGameState);
  const [selected, setSelected]   = React.useState(null);
  const { players } = config;

  const pl = key => players[key === 'player1' ? 0 : 1];

  const handlePointClick = (r, c) => {
    const gs = gameState;
    if (gs.gameOver) return;

    if (!selected) {
      if (isValidFirstPoint(gs, r, c)) setSelected({ row: r, col: c });
    } else if (selected.row === r && selected.col === c) {
      setSelected(null);
    } else {
      const isVSec = validSecondPoints(gs, selected.row, selected.col)
        .some(p => p.row === r && p.col === c);

      if (isVSec) {
        const next = makeMove(gs, selected.row, selected.col, r, c);
        if (next) { setGameState(next); setSelected(null); }
      } else if (isValidFirstPoint(gs, r, c)) {
        setSelected({ row: r, col: c });
      } else {
        setSelected(null);
      }
    }
  };

  const { scores, currentPlayer, gameOver } = gameState;
  const curPl = pl(currentPlayer);

  const winner = gameOver
    ? (scores.player1 > scores.player2 ? pl('player1')
     : scores.player2 > scores.player1 ? pl('player2')
     : null)
    : null;

  return (
    <div className="game-screen">

      {/* Scoreboard */}
      <div className="score-row">
        {(['player1', 'player2']).map((key, i) => {
          const p = players[i];
          const active = currentPlayer === key && !gameOver;
          return (
            <div key={key}
              className={`score-card ${active ? 'score-active' : ''}`}
              style={{ '--accent': p.color.value }}
            >
              <span className="score-dot" style={{ background: p.color.value }} />
              <span className="score-name">{p.name}</span>
              <span className="score-num" style={{ color: p.color.value }}>
                {scores[key]}&thinsp;sq
              </span>
            </div>
          );
        })}
      </div>

      {/* Turn / result banner */}
      <div className="turn-banner" style={{ color: gameOver ? '#abb3bf' : curPl.color.value }}>
        {gameOver
          ? (winner ? `${winner.name} wins!` : "It's a tie!")
          : `${curPl.name}'s turn`}
      </div>

      {/* Board */}
      <Card elevation={Elevation.TWO} className="board-card">
        <GameBoard
          gameState={gameState}
          players={players}
          selectedPoint={selected}
          onPointClick={handlePointClick}
        />
      </Card>

      <Button icon="arrow-left" text="New Game" onClick={onNewGame}
        style={{ marginTop: 20 }} />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  const [screen, setScreen] = React.useState('new-game');
  const [config, setConfig]  = React.useState(null);

  if (screen === 'game') {
    return <GameScreen config={config} onNewGame={() => setScreen('new-game')} />;
  }
  return <NewGameScreen onStart={players => { setConfig({ players }); setScreen('game'); }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
