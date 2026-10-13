import { create } from 'zustand';
import { daysBetween, type HumanRun, type WorldState } from '../descent/world';
import type { WorldOut } from '../workers/world.worker';
import { idbClear, idbPut, idbAll } from './idb';

const todayISO = () => new Date().toISOString().slice(0, 10);
const MAX_CATCHUP = 14;
interface WorldStore {
  world: (WorldState & { id: string }) | null; busy: string | null; away: number; error: string | null; loaded: boolean;
  init: () => Promise<void>; advance: (days: number) => void; recordRun: (r: HumanRun) => void; vote: (versionId: string) => void; reset: () => Promise<void>; dismissAway: () => void;
}
let worker: Worker | null = null;
export const useWorld = create<WorldStore>((set, get) => {
  const persist = (w: WorldState) => { const v = { ...w, id: 'main' }; set({ world: v }); void idbPut(v, 'world'); };
  const run = (msg: object, label: string, then?: () => void) => {
    worker?.terminate(); worker = new Worker(new URL('../workers/world.worker.ts', import.meta.url), { type: 'module' }); set({ busy: label, error: null });
    worker.onmessage = (e: MessageEvent<WorldOut>) => {
      const m = e.data;
      if (m.type === 'error') { set({ busy: null, error: m.message }); worker?.terminate(); worker = null; return; }
      persist(m.world);
      if (m.type === 'done') { set({ busy: null }); worker?.terminate(); worker = null; then?.(); }
    };
    worker.onerror = (e) => { set({ busy: null, error: e.message || 'World worker crashed' }); };
    worker.postMessage(msg);
  };
  return {
    world: null, busy: null, away: 0, error: null, loaded: false,
    init: async () => {
      if (get().loaded) return; set({ loaded: true });
      const rows = await idbAll<WorldState & { id: string }>('world'), w = rows[0];
      if (!w || w.schema !== 1) { run({ type: 'create', seed: Math.floor(Math.random() * 1e6), date: todayISO() }, 'Founding the laboratory…'); return; }
      set({ world: w });
      const n = Math.min(MAX_CATCHUP, daysBetween(w.date, todayISO()));
      if (n > 0) { set({ away: n }); run({ type: 'advance', world: w, days: n }, `The lab ran ${n} day(s) while you were away…`); }
    },
    advance: (days) => { const w = get().world; if (w && !get().busy) run({ type: 'advance', world: w, days }, 'Evolving…'); },
    recordRun: (r) => { const w = get().world; if (!w) return; persist({ ...w, humanRuns: [...w.humanRuns, r].slice(-200) }); },
    vote: (versionId) => { const w = get().world; if (!w) return; persist({ ...w, humanVotes: { ...w.humanVotes, [w.day]: versionId } }); },
    reset: async () => { worker?.terminate(); await idbClear('world'); set({ world: null, loaded: false, away: 0 }); await get().init(); },
    dismissAway: () => set({ away: 0 }),
  };
});
