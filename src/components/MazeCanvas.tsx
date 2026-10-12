import { useEffect, useRef } from 'react';
import { CELL, type MazeConfig } from '../game/maze/maze';

export function MazeCanvas({ cfg, trail = [], className }: { cfg: MazeConfig; trail?: number[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const cell = Math.max(6, Math.floor(560 / Math.max(cfg.width, cfg.height)));
    c.width = cell * cfg.width; c.height = cell * cfg.height;
    const g = c.getContext('2d'); if (!g) return;
    g.fillStyle = '#080b10'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < cfg.height; y++) for (let x = 0; x < cfg.width; x++) {
      const v = cfg.cells[y * cfg.width + x];
      g.fillStyle = v === CELL.WALL ? '#1b2231' : v === CELL.HAZARD ? 'rgba(245,184,75,.35)' : '#0e131c';
      g.fillRect(x * cell, y * cell, cell - (v === CELL.WALL ? 0 : 1), cell - (v === CELL.WALL ? 0 : 1));
    }
    const seen = new Set(trail);
    g.fillStyle = 'rgba(34,211,238,.10)';
    seen.forEach((i) => g.fillRect((i % cfg.width) * cell, Math.floor(i / cfg.width) * cell, cell, cell));
    const mark = (p: [number, number], col: string, r: number) => { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12; g.beginPath(); g.arc(p[0] * cell + cell / 2, p[1] * cell + cell / 2, cell * r, 0, 7); g.fill(); g.shadowBlur = 0; };
    mark(cfg.start, '#8b5cf6', 0.32); mark(cfg.exit, '#34d399', 0.38);
    if (trail.length > 1) {
      g.strokeStyle = 'rgba(34,211,238,.75)'; g.lineWidth = Math.max(1.5, cell * 0.18); g.lineJoin = 'round'; g.beginPath();
      trail.forEach((i, k) => { const px = (i % cfg.width) * cell + cell / 2, py = Math.floor(i / cfg.width) * cell + cell / 2; k ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke();
    }
    if (trail.length) { const i = trail[trail.length - 1]; mark([i % cfg.width, Math.floor(i / cfg.width)], '#22d3ee', 0.3); }
  }, [cfg, trail]);
  return <canvas ref={ref} className={className ?? 'aspect-square w-full max-w-[560px] rounded-lg border border-white/10'} aria-label="Maze" />;
}
