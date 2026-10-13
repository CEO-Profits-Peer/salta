import { advanceDays, createWorld, DEFAULT_WORLD_CONFIG, type WorldState } from '../descent/world';
type In = { type: 'create'; seed: number; date: string } | { type: 'advance'; world: WorldState; days: number };
export type WorldOut = { type: 'day'; world: WorldState } | { type: 'done'; world: WorldState } | { type: 'error'; message: string };
const ctx = self as unknown as { postMessage(m: WorldOut): void; onmessage: ((e: MessageEvent<In>) => void) | null };
ctx.onmessage = (e) => {
  try {
    const m = e.data;
    if (m.type === 'create') { ctx.postMessage({ type: 'done', world: createWorld(m.seed, m.date, DEFAULT_WORLD_CONFIG) }); return; }
    let w = m.world;
    for (let i = 0; i < m.days; i++) { w = advanceDays(w, 1); ctx.postMessage({ type: i === m.days - 1 ? 'done' : 'day', world: w }); }
  } catch (err) { ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) }); }
};
