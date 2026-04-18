import React, { useState } from 'react';
import { GRID_SIZE, validSecondPoints, isValidFirstPoint } from './game';

const CELL = 80;
const PAD  = 50;
const PR   = 9;  // point radius
const SZ   = PAD * 2 + CELL * (GRID_SIZE - 1); // 500

const px = c => PAD + c * CELL;
const py = r => PAD + r * CELL;

export function GameBoard({ gameState, players, selectedPoint, onPointClick, interactive = true }) {
  const [hovered, setHovered] = useState(null);
  const { points, hLines, vLines, squares, currentPlayer, gameOver } = gameState;

  const pcolor = key => key === 'player1' ? players[0].color.value : players[1].color.value;
  const curColor = pcolor(currentPlayer);

  const valids = selectedPoint && interactive
    ? validSecondPoints(gameState, selectedPoint.row, selectedPoint.col)
    : [];
  const isVSec  = (r, c) => valids.some(p => p.row === r && p.col === c);
  const isVFst  = (r, c) => !selectedPoint && !gameOver && interactive && isValidFirstPoint(gameState, r, c);

  const previewTarget = hovered && isVSec(hovered.row, hovered.col) ? hovered : null;

  return (
    <svg width={SZ} height={SZ} style={{ display: 'block' }}>
      <defs>
        {['player1', 'player2'].map(key => (
          <pattern key={key} id={`stripe-${key}`}
            patternUnits="userSpaceOnUse" width="12" height="12"
            patternTransform="rotate(45)"
          >
            <rect width="12" height="12" fill={pcolor(key)} fillOpacity="0.12" />
            <rect width="12" height="6" fill={pcolor(key)} fillOpacity="0.40" />
          </pattern>
        ))}
      </defs>

      {/* Ghost grid — all possible line positions */}
      {Array.from({ length: GRID_SIZE }, (_, r) =>
        Array.from({ length: GRID_SIZE - 1 }, (_, c) => (
          <line key={`gH${r}_${c}`}
            x1={px(c)} y1={py(r)} x2={px(c+1)} y2={py(r)}
            stroke="#262a30" strokeWidth={2}
          />
        ))
      )}
      {Array.from({ length: GRID_SIZE - 1 }, (_, r) =>
        Array.from({ length: GRID_SIZE }, (_, c) => (
          <line key={`gV${r}_${c}`}
            x1={px(c)} y1={py(r)} x2={px(c)} y2={py(r+1)}
            stroke="#262a30" strokeWidth={2}
          />
        ))
      )}

      {/* Completed square fills */}
      {squares.map((row, sr) =>
        row.map((sq, sc) => sq && (
          <rect key={`sq${sr}_${sc}`}
            x={px(sc) + 5} y={py(sr) + 5}
            width={CELL - 10} height={CELL - 10}
            fill={`url(#stripe-${sq})`}
            stroke={pcolor(sq)} strokeWidth={2.5}
            strokeDasharray="7 5"
          />
        ))
      )}

      {/* Drawn lines */}
      {hLines.map((row, r) =>
        row.map((line, c) => line && (
          <line key={`hL${r}_${c}`}
            x1={px(c)} y1={py(r)} x2={px(c+1)} y2={py(r)}
            stroke={pcolor(line)} strokeWidth={6} strokeLinecap="round"
          />
        ))
      )}
      {vLines.map((row, r) =>
        row.map((line, c) => line && (
          <line key={`vL${r}_${c}`}
            x1={px(c)} y1={py(r)} x2={px(c)} y2={py(r+1)}
            stroke={pcolor(line)} strokeWidth={6} strokeLinecap="round"
          />
        ))
      )}

      {/* Preview line on hover */}
      {selectedPoint && previewTarget && (
        <line
          x1={px(selectedPoint.col)} y1={py(selectedPoint.row)}
          x2={px(previewTarget.col)} y2={py(previewTarget.row)}
          stroke={curColor} strokeWidth={4} strokeLinecap="round"
          strokeDasharray="8 5" opacity={0.55}
        />
      )}

      {/* Points */}
      {points.map((row, r) =>
        row.map((pt, c) => {
          const isSel   = selectedPoint?.row === r && selectedPoint?.col === c;
          const isVS    = isVSec(r, c);
          const isVF    = isVFst(r, c);
          const clickable = isSel || isVS || isVF;
          const dotFill = pt ? pcolor(pt) : '#3a3f47';

          return (
            <g key={`pt${r}_${c}`}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={() => interactive && !gameOver && onPointClick(r, c)}
              onMouseEnter={() => setHovered({ row: r, col: c })}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Expanded hit area */}
              <circle cx={px(c)} cy={py(r)} r={PR + 12} fill="transparent" />

              {/* Selection glow */}
              {isSel && (
                <circle cx={px(c)} cy={py(r)} r={PR + 8}
                  fill={curColor} opacity={0.25}
                />
              )}

              {/* Valid-second ring */}
              {isVS && !isSel && (
                <circle cx={px(c)} cy={py(r)} r={PR + 6}
                  fill="none" stroke={curColor} strokeWidth={2} opacity={0.8}
                />
              )}

              {/* Valid-first dashed ring */}
              {isVF && (
                <circle cx={px(c)} cy={py(r)} r={PR + 5}
                  fill="none" stroke={curColor} strokeWidth={1.5}
                  strokeDasharray="4 3" opacity={0.45}
                />
              )}

              {/* Main dot */}
              <circle cx={px(c)} cy={py(r)} r={isSel ? PR + 2 : PR}
                fill={isSel ? 'white' : dotFill}
                stroke={isSel ? curColor : (pt ? 'none' : '#555')}
                strokeWidth={isSel ? 3 : 1}
              />
            </g>
          );
        })
      )}
    </svg>
  );
}
