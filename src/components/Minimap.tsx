import { useEffect, useRef } from 'react';
import { useHearth } from '../app/hearthStore';
import { H, W } from '../hearth/types';
import { CH, CW, camRef, clampCam } from './HearthCanvas';

const COL = ['#0c2236', '#18301f', '#0f2418', '#4a5062', '#4a4331'];
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null), base = useRef<{ t: Uint8Array; c: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!; c.width = 192; c.height = 192; const k = 192 / W;
    const draw = () => {
      const { snap, terrain } = useHearth.getState(); if (!snap || !terrain) return;
      if (base.current?.t !== terrain) { const o = document.createElement('canvas'); o.width = W; o.height = H; const og = o.getContext('2d')!; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { og.fillStyle = COL[terrain[y * W + x]]; og.fillRect(x, y, 1, 1); } base.current = { t: terrain, c: o }; }
      g.imageSmoothingEnabled = false; g.drawImage(base.current.c, 0, 0, 192, 192);
      for (const v of snap.villages) { g.fillStyle = v.color; g.globalAlpha = v.alive ? 1 : 0.3; g.fillRect(v.hx * k - 2, v.hy * k - 2, 5, 5); } g.globalAlpha = 1;
      for (const s of snap.settlers) { g.fillStyle = s.ctl ? '#fff' : snap.villages[s.v]?.color ?? '#fff'; g.fillRect(s.x * k, s.y * k, s.ctl ? 3 : 1.5, s.ctl ? 3 : 1.5); }
      for (const w of snap.wolves) { g.fillStyle = '#f87171'; g.fillRect(w[1] * k, w[2] * k, 2, 2); }
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect((camRef.cx - CW / 2 / camRef.zoom) * k, (camRef.cy - CH / 2 / camRef.zoom) * k, (CW / camRef.zoom) * k, (CH / camRef.zoom) * k);
    };
    draw(); const t = setInterval(draw, 200); return () => clearInterval(t);
  }, []);
  const go = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); camRef.cx = ((e.clientX - r.left) / r.width) * W; camRef.cy = ((e.clientY - r.top) / r.height) * H; clampCam(); useHearth.getState().setFollow(false); };
  return <canvas ref={ref} className="aspect-square w-full cursor-crosshair rounded-lg border border-white/10" aria-label="Minimap: click to move the camera" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); go(e); }} onPointerMove={(e) => { if (e.buttons) go(e); }} />;
}
