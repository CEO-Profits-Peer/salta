import { useEffect, useRef } from 'react';
import { useHearth } from '../app/hearthStore';
import { GENES, H, W, YEAR, DAY } from '../hearth/types';

const COL = ['#0c2236', '#18301f', '#0f2418', '#383d4a', '#4a4331'];
const hash = (x: number, y: number) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) / 4294967296;
const nightAt = (t: number) => { const d = (t % DAY) / DAY; return d >= 0.72 ? Math.min(1, (d - 0.72) / 0.08) : d < 0.04 ? 1 : d < 0.08 ? 1 - (d - 0.04) / 0.04 : 0; };
const GLYPH: Record<string, string> = { hut: '⌂', farm: '▦', well: '◉', granary: '▣', palisade: '▩', hearth: '♨' };
export const camRef = { cx: 48, cy: 48, zoom: 10 };

export function HearthCanvas({ onPick }: { onPick: (kind: 'settler' | 'village' | null, id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null), terr = useRef<HTMLCanvasElement | null>(null), rend = useRef(new Map<number, [number, number]>()), drag = useRef<{ x: number; y: number; moved: boolean } | null>(null), seen = useRef<Uint8Array | null>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; let raf = 0, centered = false; c.width = 960; c.height = 600;
    const frame = () => {
      raf = requestAnimationFrame(frame); const { snap, terrain, selected, follow, mode } = useHearth.getState(); if (!snap || !terrain) { g.fillStyle = '#06080c'; g.fillRect(0, 0, 960, 600); g.fillStyle = '#64748b'; g.font = '14px sans-serif'; g.fillText('Waking the world…', 400, 300); return; }
      if (seen.current !== terrain) { seen.current = terrain; const o = document.createElement('canvas'); o.width = W * 8; o.height = H * 8; const og = o.getContext('2d')!; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { og.fillStyle = COL[terrain[y * W + x]]; og.globalAlpha = 0.85 + hash(x, y) * 0.15; og.fillRect(x * 8, y * 8, 8, 8); } terr.current = o; }
      const cam = camRef;
      if (!centered) { const v = [...snap.villages].filter((q) => q.alive).sort((a, b) => b.pop - a.pop)[0]; if (v) { cam.cx = v.hx; cam.cy = v.hy; } centered = true; }
      const cur = new Map(snap.settlers.map((s) => [s.id, s] as const));
      for (const s of snap.settlers) { const r = rend.current.get(s.id); if (!r) rend.current.set(s.id, [s.x, s.y]); else { r[0] += (s.x - r[0]) * 0.18; r[1] += (s.y - r[1]) * 0.18; } }
      for (const id of rend.current.keys()) if (!cur.has(id)) rend.current.delete(id);
      if (mode === 'wanderer' && snap.wanderer.active) { cam.cx += (snap.wanderer.x - cam.cx) * 0.12; cam.cy += (snap.wanderer.y - cam.cy) * 0.12; }
      else if (follow && selected?.kind === 'settler') { const r = rend.current.get(selected.id); if (r) { cam.cx += (r[0] - cam.cx) * 0.12; cam.cy += (r[1] - cam.cy) * 0.12; } }
      const z = cam.zoom, sx = (x: number) => 480 + (x - cam.cx) * z, sy = (y: number) => 300 + (y - cam.cy) * z;
      g.fillStyle = '#04060a'; g.fillRect(0, 0, 960, 600);
      g.imageSmoothingEnabled = false; g.drawImage(terr.current!, sx(0), sy(0), W * z, H * z);
      const x0 = Math.max(0, Math.floor(cam.cx - 480 / z)), x1 = Math.min(W - 1, Math.ceil(cam.cx + 480 / z)), y0 = Math.max(0, Math.floor(cam.cy - 300 / z)), y1 = Math.min(H - 1, Math.ceil(cam.cy + 300 / z));
      if (snap.wood.length) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x, t = terrain[i];
        if (t === 2 && snap.wood[i] > 0) { g.fillStyle = `rgba(52,160,90,${0.25 + snap.wood[i] / 20})`; const r = Math.max(1.5, z * 0.22); g.beginPath(); g.moveTo(sx(x) + z / 2, sy(y) + z * 0.15); g.lineTo(sx(x) + z / 2 - r, sy(y) + z * 0.8); g.lineTo(sx(x) + z / 2 + r, sy(y) + z * 0.8); g.fill(); }
        else if (t === 1 && snap.berry[i] >= 1) { g.fillStyle = snap.berry[i] > 1 ? '#e0526a' : '#5a3b45'; g.beginPath(); g.arc(sx(x) + z / 2, sy(y) + z / 2, Math.max(1.2, z * 0.14), 0, 7); g.fill(); }
        else if (t === 3) { g.fillStyle = 'rgba(180,190,210,.25)'; g.fillRect(sx(x) + z * 0.3, sy(y) + z * 0.3, z * 0.35, z * 0.35); } }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const v of snap.villages) for (const b of v.buildings) { if (b.x < x0 - 1 || b.x > x1 + 1 || b.y < y0 - 1 || b.y > y1 + 1) continue; g.globalAlpha = !v.alive ? 0.35 : b.built ? 1 : 0.4 + b.progress * 0.5; g.strokeStyle = v.color; g.lineWidth = 1.5; g.strokeRect(sx(b.x) + 1, sy(b.y) + 1, z - 2, z - 2); g.fillStyle = v.color; g.font = `${Math.floor(z * 0.75)}px sans-serif`; g.fillText(GLYPH[b.type] ?? '?', sx(b.x) + z / 2, sy(b.y) + z / 2 + 1);
        if (b.type === 'hearth' && v.fire && v.alive) { g.globalAlpha = 0.18 + 0.06 * Math.sin(performance.now() / 160); g.fillStyle = '#f5b84b'; g.beginPath(); g.arc(sx(b.x) + z / 2, sy(b.y) + z / 2, z * 4.5, 0, 7); g.fill(); } g.globalAlpha = 1; }
      g.fillStyle = '#64748b'; g.font = `${Math.floor(z * 0.8)}px sans-serif`; for (const gr of snap.graves) if (gr.x >= x0 && gr.x <= x1 && gr.y >= y0 && gr.y <= y1) g.fillText('†', sx(gr.x) + z / 2, sy(gr.y) + z / 2);
      for (const d of snap.deer) { g.fillStyle = '#c9a66b'; g.beginPath(); g.arc(sx(d[1]) + z / 2, sy(d[2]) + z / 2, Math.max(1.5, z * 0.22), 0, 7); g.fill(); }
      for (const w of snap.wolves) { g.fillStyle = '#f87171'; const px = sx(w[1]) + z / 2, py = sy(w[2]) + z / 2, r = Math.max(2.5, z * 0.32); g.beginPath(); g.moveTo(px, py - r); g.lineTo(px - r, py + r); g.lineTo(px + r, py + r); g.fill(); }
      const vcol = new Map(snap.villages.map((v) => [v.id, v.color] as const));
      for (const s of snap.settlers) { const r = rend.current.get(s.id) ?? [s.x, s.y], px = sx(r[0]) + z / 2, py = sy(r[1]) + z / 2, child = s.age < 2 * YEAR, rad = Math.max(2, z * (child ? 0.2 : 0.3));
        g.fillStyle = vcol.get(s.v) ?? '#fff'; g.beginPath(); g.arc(px, py, rad, 0, 7); g.fill(); if (s.sick) { g.strokeStyle = '#a3e635'; g.lineWidth = 1; g.stroke(); }
        if (s.health < 0.5) { g.fillStyle = '#f87171'; g.fillRect(px - rad, py - rad - 3, rad * 2 * s.health, 2); }
        if (selected?.kind === 'settler' && selected.id === s.id) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, rad + 4, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(s.name, px, py - rad - 9); } }
      const w = snap.wanderer; if (w.active) { const px = sx(w.x) + z / 2, py = sy(w.y) + z / 2; g.shadowColor = '#fff'; g.shadowBlur = 14; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px, py - z * 0.4); g.lineTo(px + z * 0.3, py); g.lineTo(px, py + z * 0.4); g.lineTo(px - z * 0.3, py); g.fill(); g.shadowBlur = 0; }
      const n = nightAt(snap.tick), season = Math.floor((snap.tick % YEAR) / (DAY * 8));
      if (n > 0) { g.fillStyle = `rgba(4,8,30,${0.58 * n})`; g.fillRect(0, 0, 960, 600); if (n > 0.3) for (const v of snap.villages) if (v.alive && v.fire) { const gr = g.createRadialGradient(sx(v.hx) + z / 2, sy(v.hy) + z / 2, 0, sx(v.hx) + z / 2, sy(v.hy) + z / 2, z * 6); gr.addColorStop(0, 'rgba(245,184,75,.30)'); gr.addColorStop(1, 'rgba(245,184,75,0)'); g.fillStyle = gr; g.globalCompositeOperation = 'lighter'; g.fillRect(0, 0, 960, 600); g.globalCompositeOperation = 'source-over'; } }
      if (season === 3) { g.fillStyle = 'rgba(210,225,255,.08)'; g.fillRect(0, 0, 960, 600); } else if (season === 2) { g.fillStyle = 'rgba(245,160,60,.05)'; g.fillRect(0, 0, 960, 600); }
    };
    frame(); return () => cancelAnimationFrame(raf);
  }, []);
  const toWorld = (e: { clientX: number; clientY: number }) => { const r = ref.current!.getBoundingClientRect(), px = ((e.clientX - r.left) * 960) / r.width, py = ((e.clientY - r.top) * 600) / r.height; return [camRef.cx + (px - 480) / camRef.zoom - 0.5, camRef.cy + (py - 300) / camRef.zoom - 0.5] as const; };
  return (
    <canvas ref={ref} className="w-full cursor-grab rounded-xl border border-white/10 active:cursor-grabbing" style={{ aspectRatio: '960/600', touchAction: 'none' }} aria-label="Hearthworld map"
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; const r = ref.current!.getBoundingClientRect(), k = 960 / r.width; const dx = (e.clientX - d.x) * k, dy = (e.clientY - d.y) * k; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; camRef.cx -= dx / camRef.zoom; camRef.cy -= dy / camRef.zoom; d.x = e.clientX; d.y = e.clientY; if (d.moved) useHearth.getState().setFollow(false); }}
      onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d?.moved) return; const snap = useHearth.getState().snap; if (!snap) return; const [wx, wy] = toWorld(e); let best = -1, bd = 1.2; for (const s of snap.settlers) { const r = rend.current.get(s.id) ?? [s.x, s.y], dd = Math.hypot(r[0] - wx, r[1] - wy); if (dd < bd) { bd = dd; best = s.id; } } if (best >= 0) { onPick('settler', best); return; } const v = snap.villages.find((q) => Math.hypot(q.hx - wx, q.hy - wy) < 2); onPick(v ? 'village' : null, v?.id ?? -1); }}
      onWheel={(e) => { camRef.zoom = Math.min(30, Math.max(5, camRef.zoom * (e.deltaY < 0 ? 1.12 : 0.9))); }} />
  );
}
export { GENES };
