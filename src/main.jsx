import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Button, Card, Elevation, FormGroup, InputGroup, Intent, Spinner,
} from '@blueprintjs/core';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import 'normalize.css';
import './app.css';
import { GameBoard } from './GameBoard';
import { isValidFirstPoint, validSecondPoints } from './game';

const WS_URL = 'ws://localhost:3001/ws';

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

// ── ColorPicker ────────────────────────────────────────────────────────────

function ColorPicker({ selected, onChange }) {
  return (
    <div className="color-swatches">
      {PALETTE.map(color => {
        const isSelected = color.value === selected.value;
        return (
          <div key={color.value}
            className={`color-swatch${isSelected ? ' swatch-selected' : ''}`}
            style={{ backgroundColor: color.value }}
            title={color.label}
            onClick={() => onChange(color)}
          />
        );
      })}
    </div>
  );
}

// ── Join screen ────────────────────────────────────────────────────────────

function JoinScreen({ onJoin, connecting }) {
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  return (
    <>
      <h1 className="app-title">Dots &amp; Boxes</h1>
      <p className="app-subtitle">Remote multiplayer — each player uses their own browser</p>

      <Card elevation={Elevation.THREE} className="player-card" style={{ width: 320 }}>
        <div className="player-card-header">
          <span className="player-badge" style={{ backgroundColor: color.value }}>?</span>
          <p className="player-card-title">Your Profile</p>
        </div>
        <FormGroup label="Name">
          <InputGroup
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name…"
            large
            disabled={connecting}
          />
        </FormGroup>
        <FormGroup label="Color">
          <ColorPicker selected={color} onChange={setColor} />
        </FormGroup>
        <div className="player-preview" style={{ backgroundColor: color.value }}>
          {name.trim() || 'You'}
        </div>
      </Card>

      <div className="start-row" style={{ marginTop: 24 }}>
        <Button
          large intent={Intent.PRIMARY}
          disabled={!name.trim() || connecting}
          loading={connecting}
          onClick={() => onJoin({ name: name.trim(), color })}
          icon="people"
          text="Find Game"
        />
      </div>
    </>
  );
}

// ── Waiting screen ─────────────────────────────────────────────────────────

function WaitingScreen({ onCancel }) {
  return (
    <div className="waiting-screen">
      <h1 className="app-title">Dots &amp; Boxes</h1>
      <Spinner size={48} intent={Intent.PRIMARY} />
      <p className="waiting-msg">Waiting for an opponent to join…</p>
      <Button text="Cancel" onClick={onCancel} minimal />
    </div>
  );
}

// ── Game screen ────────────────────────────────────────────────────────────

function GameScreen({ gameState, players, youAre, disconnected, onMove, onNewGame }) {
  const [selected, setSelected] = useState(null);

  // Clear selection whenever the board state changes (after any move).
  useEffect(() => { setSelected(null); }, [gameState]);

  if (!gameState) {
    return <div className="waiting-screen"><Spinner size={32} /></div>;
  }

  const pl     = key => players[key === 'player1' ? 0 : 1];
  const isMyTurn = !disconnected && !gameState.gameOver && gameState.currentPlayer === youAre;

  const handlePointClick = (r, c) => {
    if (!isMyTurn) return;

    if (!selected) {
      if (isValidFirstPoint(gameState, r, c)) setSelected({ row: r, col: c });
    } else if (selected.row === r && selected.col === c) {
      setSelected(null);
    } else {
      const isVSec = validSecondPoints(gameState, selected.row, selected.col)
        .some(p => p.row === r && p.col === c);
      if (isVSec) {
        onMove(selected.row, selected.col, r, c);
        setSelected(null);
      } else if (isValidFirstPoint(gameState, r, c)) {
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

  let bannerText;
  if (disconnected)      bannerText = 'Opponent disconnected';
  else if (gameOver)     bannerText = winner ? `${winner.name} wins!` : "It's a tie!";
  else if (isMyTurn)     bannerText = 'Your turn';
  else                   bannerText = `${curPl.name}'s turn`;

  const bannerColor = (disconnected || gameOver) ? '#abb3bf' : curPl.color.value;

  return (
    <div className="game-screen">

      {/* Scoreboard */}
      <div className="score-row">
        {(['player1', 'player2']).map((key, i) => {
          const p      = players[i];
          const active = currentPlayer === key && !gameOver && !disconnected;
          const isMe   = key === youAre;
          return (
            <div key={key}
              className={`score-card ${active ? 'score-active' : ''}`}
              style={{ '--accent': p.color.value }}
            >
              <span className="score-dot" style={{ background: p.color.value }} />
              <span className="score-name">
                {p.name}
                {isMe && <span className="you-badge"> (you)</span>}
              </span>
              <span className="score-num" style={{ color: p.color.value }}>
                {scores[key]}&thinsp;sq
              </span>
            </div>
          );
        })}
      </div>

      {/* Turn / result banner */}
      <div className="turn-banner" style={{ color: bannerColor }}>
        {bannerText}
      </div>

      {/* Board */}
      <Card elevation={Elevation.TWO} className="board-card">
        <GameBoard
          gameState={gameState}
          players={players}
          selectedPoint={selected}
          onPointClick={handlePointClick}
          interactive={isMyTurn}
        />
      </Card>

      <Button icon="arrow-left" text="New Game" onClick={onNewGame}
        style={{ marginTop: 20 }} />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  // screen: 'join' | 'connecting' | 'waiting' | 'game' | 'disconnected'
  const [screen,       setScreen]       = useState('join');
  const [myConfig,     setMyConfig]     = useState(null);
  const [youAre,       setYouAre]       = useState(null);   // 'player1' | 'player2'
  const [opponentInfo, setOpponentInfo] = useState(null);   // { name, color }
  const [gameState,    setGameState]    = useState(null);

  const wsRef     = useRef(null);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const handleJoin = (config) => {
    setMyConfig(config);
    setScreen('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name: config.name, color: config.color.value }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      switch (msg.type) {
        case 'waiting':
          setScreen('waiting');
          break;
        case 'game_start':
          setYouAre(msg.you_are);
          setOpponentInfo({ name: msg.opponent_name, color: msg.opponent_color });
          setGameState(null);
          setScreen('game');
          break;
        case 'game_state':
          setGameState(msg.state);
          break;
        case 'invalid_move':
          console.warn('Server rejected move:', msg.reason);
          break;
        case 'opponent_disconnected':
          setScreen('disconnected');
          break;
        default:
          console.warn('Unknown message from server:', msg);
      }
    };

    ws.onclose = () => {
      const s = screenRef.current;
      if (s === 'game')                         setScreen('disconnected');
      else if (s !== 'disconnected' && s !== 'join') setScreen('join');
    };
  };

  const handleNewGame = () => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // suppress the onclose transition
      wsRef.current.close();
      wsRef.current = null;
    }
    setGameState(null);
    setYouAre(null);
    setOpponentInfo(null);
    setScreen('join');
  };

  const sendMove = (r1, c1, r2, c2) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'move', r1, c1, r2, c2 }));
    }
  };

  // Build the [player1, player2] array that GameBoard expects.
  const buildPlayers = () => {
    if (!myConfig || !opponentInfo) return null;
    const me  = { name: myConfig.name,     color: myConfig.color };
    const opp = { name: opponentInfo.name, color: { value: opponentInfo.color } };
    return youAre === 'player1' ? [me, opp] : [opp, me];
  };

  if (screen === 'join' || screen === 'connecting') {
    return <JoinScreen onJoin={handleJoin} connecting={screen === 'connecting'} />;
  }

  if (screen === 'waiting') {
    return <WaitingScreen onCancel={handleNewGame} />;
  }

  const players = buildPlayers();
  return (
    <GameScreen
      gameState={gameState}
      players={players}
      youAre={youAre}
      disconnected={screen === 'disconnected'}
      onMove={sendMove}
      onNewGame={handleNewGame}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
