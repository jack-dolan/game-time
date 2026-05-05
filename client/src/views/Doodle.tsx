import { useEffect, useRef } from 'react';
import type { DoodleView } from '@letsgogaming/shared';
import { socket } from '../socket.js';

const CANVAS_W = 800;
const CANVAS_H = 450;
const BG = '#0f172a';
const MOVE_INTERVAL_MS = 80;

export function Doodle({ view, myId }: { view: DoodleView; myId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastMoveRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, grid, players } = view;
    const cellW = CANVAS_W / width;
    const cellH = CANVAS_H / height;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const colorByIndex = new Map(players.map((p) => [p.index, p.color]));

    for (let i = 0; i < grid.length; i++) {
      const idx = grid[i];
      if (idx < 0) continue;
      const color = colorByIndex.get(idx);
      if (!color) continue;
      const gx = i % width;
      const gy = Math.floor(i / width);
      ctx.fillStyle = color;
      ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
    }

    for (const player of players) {
      const cx = player.x * cellW + cellW / 2;
      const cy = player.y * cellH + cellH / 2;
      const r = Math.min(cellW, cellH) * 0.52;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const dir = dirs[e.key];
      if (!dir) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastMoveRef.current < MOVE_INTERVAL_MS) return;
      lastMoveRef.current = now;
      socket.emit('doodle:move', { dir });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="section doodle-section">
      <div className="doodle-header">
        <h3>Paint while you wait</h3>
        <span className="doodle-hint">Arrow keys move your dot</span>
      </div>
      <div className="doodle-legend">
        {view.players.map((p) => (
          <span key={p.id} className={`doodle-legend-item${p.id === myId ? ' doodle-legend-me' : ''}`}>
            <span className="doodle-dot" style={{ background: p.color }} />
            {p.name}
            {p.id === myId ? ' ↑' : ''}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="doodle-canvas" />
    </section>
  );
}
