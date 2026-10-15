import { createSim, deserialize, serialize } from '../hearth/world';
import { stepSim } from '../hearth/sim';
import { command, snapshot, summarize, type Almanac, type Cmd, type Snapshot } from '../hearth/api';
import type { Evt, Sim } from '../hearth/types';

export type HIn = { type: 'init'; seed: number; checkpoint?: string } | { type: 'speed'; v: number } | { type: 'cmd'; cmd: Cmd } | { type: 'catchup'; ticks: number } | { type: 'inspect'; id: number } | { type: 'save' };
export type HOut = { type: 'snap'; snap: Snapshot; terrain?: Uint8Array } | { type: 'checkpoint'; data: string; tick: number; pop: number } | { type: 'catchup'; done: number; total: number; almanac?: Almanac } | { type: 'bio'; id: number; bio: string[] } | { type: 'error'; message: string };
const ctx = self as unknown as { postMessage(m: HOut, t?: Transferable[]): void; onmessage: ((e: MessageEvent<HIn>) => void) | null };
let sim: Sim | null = null, speed = 0, acc = 0, lastEvt: Evt | null = null, lastStats = 0, frame = 0, lastSave = 0, timer: ReturnType<typeof setInterval> | null = null;

function post(withTerrain = false) {
  if (!sim) return; const snap = snapshot(sim, lastEvt, lastStats, frame++ % 4 === 0 || withTerrain);
  if (snap.events.length) lastEvt = snap.events[snap.events.length - 1]; lastStats = sim.stats.length;
  ctx.postMessage({ type: 'snap', snap, terrain: withTerrain ? sim.terrain.slice() : undefined });
}
function save() { if (!sim) return; ctx.postMessage({ type: 'checkpoint', data: serialize(sim), tick: sim.tick, pop: sim.settlers.length }); lastSave = sim.tick; }
function loop() {
  if (!sim || speed <= 0) return; acc += speed * 0.2; const n = Math.min(60, Math.floor(acc)); acc -= n;
  try { if (n > 0) stepSim(sim, n); } catch (e) { speed = 0; ctx.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) }); return; }
  post(); if (sim.tick - lastSave >= 480) save();
}
ctx.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') { sim = m.checkpoint ? deserialize(m.checkpoint) : createSim(m.seed); lastEvt = null; lastStats = 0; lastSave = sim.tick; if (!timer) timer = setInterval(loop, 50); post(true); }
    else if (!sim) return;
    else if (m.type === 'speed') { speed = m.v; if (!speed) { save(); post(); } }
    else if (m.type === 'cmd') { command(sim, m.cmd); post(); }
    else if (m.type === 'inspect') { const s = sim.settlers.find((q) => q.id === m.id); ctx.postMessage({ type: 'bio', id: m.id, bio: s?.bio ?? [] }); }
    else if (m.type === 'save') save();
    else if (m.type === 'catchup') {
      const before = structuredClone(sim.totals), popBefore = sim.settlers.length, prev = speed; speed = 0; let done = 0;
      while (done < m.ticks) { const n = Math.min(240, m.ticks - done); stepSim(sim, n); done += n; ctx.postMessage({ type: 'catchup', done, total: m.ticks }); }
      ctx.postMessage({ type: 'catchup', done, total: m.ticks, almanac: { ...summarize(before, sim.totals), ticks: m.ticks, popBefore, popAfter: sim.settlers.length } }); lastEvt = null; speed = prev; save(); post(true);
    }
  } catch (err) { ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) }); }
};
