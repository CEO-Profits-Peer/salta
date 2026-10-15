import { useEffect, useRef } from 'react';
import { useHearth } from '../app/hearthStore';
import { H, W, YEAR, DAY } from '../hearth/types';

const COL = ['#0c2236', '#18301f', '#0f2418', '#383d4a', '#4a4331'];
const hash = (x: number, y: number) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) / 4294967296;
const nightAt = (t: number) => { const d = (t % DAY) / DAY; return d >= 0.72 ? Math.min(1, (d - 0.72) / 0.08) : d < 0.04 ? 1 : d < 0.08 ? 1 - (d - 0.04) / 0.04 : 0; };
export const GLYPH: Record<string, string> = { hut: '⌂', farm: '▦', well: '◉', granary: '▣', palisade: '▩', hearth: '♨', workshop: '⚒', smokehouse: 'S', watchtower: '▲', market: '$' };
export const CW = 960, CH = 600, MIN_ZOOM = Math.max(CW / W, CH / H), MAX_ZOOM = 34;
export const camRef = { cx: 48, cy: 48, zoom: 10 };
/** Keep the viewport inside the world: you can never look at empty space. */
export function clampCam() {
  camRef.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camRef.zoom)); const hw = CW / 2 / camRef.zoom, hh = CH / 2 / camRef.zoom;
  camRef.cx = W <= 2 * hw ? W / 2 : Math.min(W - hw, Math.max(hw, camRef.cx)); camRef.cy = H <= 2 * hh ? H / 2 : Math.min(H - hh, Math.max(hh, camRef.cy));
}
export function zoomAt(factor: number, px = CW / 2, py = CH / 2) {
  const wx = camRef.cx + (px - CW / 2) / camRef.zoom, wy = camRef.cy + (py - CH / 2) / camRef.zoom; camRef.zoom *= factor; clampCam();
  camRef.cx = wx - (px - CW / 2) / camRef.zoom; camRef.cy = wy - (py - CH / 2) / camRef.zoom; clampCam();
}
export const centerOn = (x: number, y: number) => { camRef.cx = x + 0.5; camRef.cy = y + 0.5; clampCam(); };

export function HearthCanvas({ onPick }: { onPick: (kind: 'settler' | 'village' | null, id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null), terr = useRef<HTMLCanvasElement | null>(null), rend = useRef(new Map<number, [number, number]>()), drag = useRef<{ x: number; y: number; moved: boolean } | null>(null), seen = useRef<Uint8Array | null>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; let raf = 0, centered = false; c.width = CW; c.height = CH;
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); const r = c.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, ((e.clientX - r.left) * CW) / r.width, ((e.clientY - r.top) * CH) / r.height); };
    c.addEventListener('wheel', wheel, { passive: false });
    const frame = () => {
      raf = requestAnimationFrame(frame); const { snap, terrain, selected, follow, mode } = useHearth.getState(); if (!snap || !terrain) { g.fillStyle = '#06080c'; g.fillRect(0, 0, CW, CH); g.fillStyle = '#64748b'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Waking the world…', CW / 2, CH / 2); return; }
      if (seen.current !== terrain) { seen.current = terrain; const o = document.createElement('canvas'); o.width = W * 8; o.height = H * 8; const og = o.getContext('2d')!; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { og.fillStyle = COL[terrain[y * W + x]]; og.globalAlpha = 0.85 + hash(x, y) * 0.15; og.fillRect(x * 8, y * 8, 8, 8); } terr.current = o; centered = false; rend.current.clear(); }
      const cam = camRef;
      if (!centered) { const v = [...snap.villages].filter((q) => q.alive).sort((a, b) => b.pop - a.pop)[0]; if (v) { cam.cx = v.hx; cam.cy = v.hy; } centered = true; }
      const cur = new Map(snap.settlers.map((s) => [s.id, s] as const));
      for (const s of snap.settlers) { const r = rend.current.get(s.id); if (!r) rend.current.set(s.id, [s.x, s.y]); else { r[0] += (s.x - r[0]) * 0.18; r[1] += (s.y - r[1]) * 0.18; } }
      for (const id of rend.current.keys()) if (!cur.has(id)) rend.current.delete(id);
      const ctl = snap.settlers.find((s) => s.ctl);
      if (mode === 'wanderer' && snap.wanderer.active) { cam.cx += (snap.wanderer.x + 0.5 - cam.cx) * 0.12; cam.cy += (snap.wanderer.y + 0.5 - cam.cy) * 0.12; }
      else if (mode === 'settler' && ctl) { const r = rend.current.get(ctl.id) ?? [ctl.x, ctl.y]; cam.cx += (r[0] + 0.5 - cam.cx) * 0.15; cam.cy += (r[1] + 0.5 - cam.cy) * 0.15; }
      else if (follow && selected?.kind === 'settler') { const r = rend.current.get(selected.id); if (r) { cam.cx += (r[0] + 0.5 - cam.cx) * 0.12; cam.cy += (r[1] + 0.5 - cam.cy) * 0.12; } }
      clampCam();
      const z = cam.zoom, sx = (x: number) => CW / 2 + (x - cam.cx) * z, sy = (y: number) => CH / 2 + (y - cam.cy) * z;
      g.fillStyle = '#04060a'; g.fillRect(0, 0, CW, CH);
      g.imageSmoothingEnabled = false; g.drawImage(terr.current!, sx(0), sy(0), W * z, H * z);
      const x0 = Math.max(0, Math.floor(cam.cx - CW / 2 / z)), x1 = Math.min(W - 1, Math.ceil(cam.cx + CW / 2 / z)), y0 = Math.max(0, Math.floor(cam.cy - CH / 2 / z)), y1 = Math.min(H - 1, Math.ceil(cam.cy + CH / 2 / z));
      if (snap.wood.length) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x, t = terrain[i];
        if (t === 2) { const w = snap.wood[i]; if (w > 0) { g.fillStyle = `rgba(52,160,90,${0.25 + w / 20})`; const r = Math.max(1.5, z * 0.22); g.beginPath(); g.moveTo(sx(x) + z / 2, sy(y) + z * 0.15); g.lineTo(sx(x) + z / 2 - r, sy(y) + z * 0.8); g.lineTo(sx(x) + z / 2 + r, sy(y) + z * 0.8); g.fill(); } else { g.fillStyle = 'rgba(120,90,60,.5)'; g.fillRect(sx(x) + z * 0.4, sy(y) + z * 0.55, Math.max(1.5, z * 0.18), Math.max(1.5, z * 0.18)); } }
        else if (t === 1 && snap.berry[i] >= 1) { g.fillStyle = snap.berry[i] > 1 ? '#e0526a' : '#5a3b45'; g.beginPath(); g.arc(sx(x) + z / 2, sy(y) + z / 2, Math.max(1.2, z * 0.14), 0, 7); g.fill(); }
        else if (t === 3) { g.fillStyle = snap.stone[i] === 0 ? 'rgba(90,95,110,.2)' : 'rgba(180,190,210,.25)'; g.fillRect(sx(x) + z * 0.3, sy(y) + z * 0.3, z * 0.35, z * 0.35); }
        if (z >= 12 && snap.fish.length && snap.fish[i] >= 3 && t !== 0) { g.strokeStyle = 'rgba(103,232,249,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx(x) + z * 0.2, sy(y) + z * 0.8); g.quadraticCurveTo(sx(x) + z * 0.5, sy(y) + z * 0.6, sx(x) + z * 0.8, sy(y) + z * 0.8); g.stroke(); } }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const v of snap.villages) for (const b of v.buildings) { if (b.x < x0 - 1 || b.x > x1 + 1 || b.y < y0 - 1 || b.y > y1 + 1) continue; g.globalAlpha = !v.alive ? 0.35 : b.built ? 1 : 0.4 + b.progress * 0.5; g.strokeStyle = v.color; g.lineWidth = 1.5; g.strokeRect(sx(b.x) + 1, sy(b.y) + 1, z - 2, z - 2); g.fillStyle = v.color; g.font = `${Math.floor(z * 0.75)}px sans-serif`; g.fillText(GLYPH[b.type] ?? '?', sx(b.x) + z / 2, sy(b.y) + z / 2 + 1);
        if (b.type === 'hearth' && v.fire && v.alive) { g.globalAlpha = 0.18 + 0.06 * Math.sin(performance.now() / 160); g.fillStyle = '#f5b84b'; g.beginPath(); g.arc(sx(b.x) + z / 2, sy(b.y) + z / 2, z * 4.5, 0, 7); g.fill(); } g.globalAlpha = 1; }
      g.fillStyle = '#64748b'; g.font = `${Math.floor(z * 0.8)}px sans-serif`; for (const gr of snap.graves) if (gr.x >= x0 && gr.x <= x1 && gr.y >= y0 && gr.y <= y1) g.fillText('†', sx(gr.x) + z / 2, sy(gr.y) + z / 2);
      for (const d of snap.deer) { g.fillStyle = '#c9a66b'; g.beginPath(); g.arc(sx(d[1]) + z / 2, sy(d[2]) + z / 2, Math.max(1.5, z * 0.22), 0, 7); g.fill(); }
      for (const a of snap.fauna) { const px = sx(a[2]) + z / 2, py = sy(a[3]) + z / 2; if (a[1] === 'rabbit') { g.fillStyle = '#e5e7eb'; g.beginPath(); g.arc(px, py, Math.max(1.2, z * 0.13), 0, 7); g.fill(); } else if (a[1] === 'boar') { g.fillStyle = '#8b5e3c'; g.beginPath(); g.arc(px, py, Math.max(2, z * 0.28), 0, 7); g.fill(); g.fillStyle = '#f3e8d0'; g.fillRect(px - z * 0.2, py + z * 0.05, Math.max(1, z * 0.08), Math.max(1, z * 0.08)); g.fillRect(px + z * 0.12, py + z * 0.05, Math.max(1, z * 0.08), Math.max(1, z * 0.08)); } else { g.fillStyle = '#2d2a2e'; g.strokeStyle = '#f87171'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, Math.max(2.5, z * 0.4), 0, 7); g.fill(); g.stroke(); } }
      for (const w of snap.wolves) { g.fillStyle = '#f87171'; const px = sx(w[1]) + z / 2, py = sy(w[2]) + z / 2, r = Math.max(2.5, z * 0.32); g.beginPath(); g.moveTo(px, py - r); g.lineTo(px - r, py + r); g.lineTo(px + r, py + r); g.fill(); }
      const vcol = new Map(snap.villages.map((v) => [v.id, v.color] as const)), RING: Record<string, string> = { raid: '#ef4444', defend: '#60a5fa', trade: '#fbbf24', fight: '#f472b6' };
      for (const s of snap.settlers) { const r = rend.current.get(s.id) ?? [s.x, s.y], px = sx(r[0]) + z / 2, py = sy(r[1]) + z / 2, child = s.age < 2 * YEAR, rad = Math.max(2, z * (child ? 0.2 : 0.3));
        g.fillStyle = vcol.get(s.v) ?? '#fff'; g.beginPath(); g.arc(px, py, rad, 0, 7); g.fill(); if (s.sick) { g.strokeStyle = '#a3e635'; g.lineWidth = 1; g.stroke(); }
        const ring = s.ctl ? '#ffffff' : RING[s.job] ?? (s.party ? '#fb923c' : null); if (ring) { g.strokeStyle = ring; g.lineWidth = s.ctl ? 2.5 : 1.6; g.beginPath(); g.arc(px, py, rad + (s.ctl ? 4 + Math.sin(performance.now() / 200) : 2.5), 0, 7); g.stroke(); if (s.job === 'raid') { g.beginPath(); g.arc(px, py, rad + 5, 0, 7); g.stroke(); } }
        if (s.health < 0.5) { g.fillStyle = '#f87171'; g.fillRect(px - rad, py - rad - 3, rad * 2 * s.health, 2); }
        if ((selected?.kind === 'settler' && selected.id === s.id) || s.ctl) { g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, rad + 8, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(s.name, px, py - rad - 12); } }
      const w = snap.wanderer; if (w.active) { const px = sx(w.x) + z / 2, py = sy(w.y) + z / 2; g.shadowColor = '#fff'; g.shadowBlur = 14; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px, py - z * 0.4); g.lineTo(px + z * 0.3, py); g.lineTo(px, py + z * 0.4); g.lineTo(px - z * 0.3, py); g.fill(); g.shadowBlur = 0; }
      const n = nightAt(snap.tick), season = Math.floor((snap.tick % YEAR) / (DAY * 8));
      if (n > 0) { g.fillStyle = `rgba(4,8,30,${0.58 * n})`; g.fillRect(0, 0, CW, CH); if (n > 0.3) for (const v of snap.villages) if (v.alive && v.fire) { const gr = g.createRadialGradient(sx(v.hx) + z / 2, sy(v.hy) + z / 2, 0, sx(v.hx) + z / 2, sy(v.hy) + z / 2, z * 6); gr.addColorStop(0, 'rgba(245,184,75,.30)'); gr.addColorStop(1, 'rgba(245,184,75,0)'); g.fillStyle = gr; g.globalCompositeOperation = 'lighter'; g.fillRect(0, 0, CW, CH); g.globalCompositeOperation = 'source-over'; } }
      if (season === 3) { g.fillStyle = 'rgba(210,225,255,.08)'; g.fillRect(0, 0, CW, CH); } else if (season === 2) { g.fillStyle = 'rgba(245,160,60,.05)'; g.fillRect(0, 0, CW, CH); }
      g.strokeStyle = 'rgba(34,211,238,.55)'; g.lineWidth = 2; g.strokeRect(sx(0), sy(0), W * z, H * z); // world border
      const vg = g.createRadialGradient(CW / 2, CH / 2, CH * 0.45, CW / 2, CH / 2, CH * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
    };
    frame(); return () => { cancelAnimationFrame(raf); c.removeEventListener('wheel', wheel); };
  }, []);
  const toWorld = (e: { clientX: number; clientY: number }) => { const r = ref.current!.getBoundingClientRect(), px = ((e.clientX - r.left) * CW) / r.width, py = ((e.clientY - r.top) * CH) / r.height; return [camRef.cx + (px - CW / 2) / camRef.zoom - 0.5, camRef.cy + (py - CH / 2) / camRef.zoom - 0.5] as const; };
  return (
    <canvas ref={ref} className="w-full cursor-grab rounded-xl border border-white/10 active:cursor-grabbing" style={{ aspectRatio: `${CW}/${CH}`, touchAction: 'none', overscrollBehavior: 'contain' }} aria-label="Hearthworld map"
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; const r = ref.current!.getBoundingClientRect(), k = CW / r.width; const dx = (e.clientX - d.x) * k, dy = (e.clientY - d.y) * k; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; camRef.cx -= dx / camRef.zoom; camRef.cy -= dy / camRef.zoom; clampCam(); d.x = e.clientX; d.y = e.clientY; if (d.moved) useHearth.getState().setFollow(false); }}
      onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d?.moved) return; const snap = useHearth.getState().snap; if (!snap) return; const [wx, wy] = toWorld(e); let best = -1, bd = 1.2; for (const s of snap.settlers) { const r = rend.current.get(s.id) ?? [s.x, s.y], dd = Math.hypot(r[0] - wx, r[1] - wy); if (dd < bd) { bd = dd; best = s.id; } } if (best >= 0) { onPick('settler', best); return; } const v = snap.villages.find((q) => Math.hypot(q.hx - wx, q.hy - wy) < 2); onPick(v ? 'village' : null, v?.id ?? -1); }} />
  );
}
