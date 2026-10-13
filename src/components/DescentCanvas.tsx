import { useEffect, useRef } from 'react';
import type { DescentEnv } from '../descent/env';
import { KIND_COLOR } from '../descent/features';
import { idx } from '../game/maze/maze';

const SYM: Record<string, string> = { rift: '◎', spring: '↟', beacon: '✦', bloom: '✿', frost: '❄', echo: '≋', breach: '✕', ice: '◇' };
export function DescentCanvas({ env, tick }: { env: DescentEnv; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const f = env.floor, W = f.cfg.width, H = f.cfg.height, cell = Math.floor(560 / Math.max(W, H));
    c.width = cell * W; c.height = cell * H; const g = c.getContext('2d'); if (!g) return;
    g.fillStyle = '#04060a'; g.fillRect(0, 0, c.width, c.height); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.floor(cell * 0.7)}px sans-serif`;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(f.cfg, x, y); if (!env.revealed.has(i)) continue; const vis = env.visible(x, y), v = env.cells[i];
      g.fillStyle = v === 1 ? (vis ? '#27324a' : '#161c2a') : v === 2 ? (vis ? 'rgba(245,184,75,.45)' : 'rgba(245,184,75,.18)') : vis ? '#121826' : '#0a0e16'; g.fillRect(x * cell, y * cell, cell, cell);
    }
    const px = (x: number) => x * cell + cell / 2;
    const at = (x: number, y: number) => env.revealed.has(idx(f.cfg, x, y));
    for (const t of f.tiles) if (at(t.x, t.y) && !env.used.has(idx(f.cfg, t.x, t.y))) { g.fillStyle = KIND_COLOR[t.kind]; g.globalAlpha = 0.9; g.fillText(SYM[t.kind], px(t.x), px(t.y)); g.globalAlpha = 1; }
    f.keys.forEach((k) => { if (at(k.x, k.y) && !(env.mask & (1 << k.key))) { g.fillStyle = k.key ? '#f472b6' : '#f5b84b'; g.fillText('⚷', px(k.x), px(k.y)); } });
    f.doors.forEach((d) => { if (at(d.x, d.y)) { g.fillStyle = d.key ? '#f472b6' : '#f5b84b'; g.globalAlpha = env.mask & (1 << d.key) ? 0.3 : 1; g.fillRect(d.x * cell + 2, d.y * cell + cell * 0.38, cell - 4, cell * 0.24); g.globalAlpha = 1; } });
    const ex = f.cfg.exit; g.shadowColor = '#34d399'; g.shadowBlur = 14; g.fillStyle = '#34d399'; g.beginPath(); g.arc(px(ex[0]), px(ex[1]), cell * 0.3, 0, 7); g.fill(); g.shadowBlur = 0;
    const sr = env.senseRadius(); if (env.decoy && env.steps < env.decoy.until) { g.fillStyle = '#f472b6'; g.fillText('≋', px(env.decoy.x), px(env.decoy.y)); }
    for (const w of env.wardens) if (Math.abs(w.x - env.x) + Math.abs(w.y - env.y) <= sr) { g.shadowColor = '#f87171'; g.shadowBlur = 14; g.fillStyle = '#f87171'; g.beginPath(); g.arc(px(w.x), px(w.y), cell * 0.34, 0, 7); g.fill(); g.shadowBlur = 0; }
    g.shadowColor = '#22d3ee'; g.shadowBlur = 16; g.fillStyle = '#22d3ee'; g.beginPath(); g.arc(px(env.x), px(env.y), cell * 0.3, 0, 7); g.fill(); g.shadowBlur = 0;
  }, [env, tick]);
  return <canvas ref={ref} className="aspect-square w-full max-w-[560px] rounded-lg border border-white/10" aria-label="Descent floor" />;
}
