import { create } from 'zustand';
import { newLab, type LabState, type Proposal, type SpecType } from '../hearth/lab';
import type { LOut } from '../workers/lab.worker';
import { idbAll, idbPut } from './idb';
import { useHearth } from './hearthStore';

interface LabStore {
  lab: LabState | null; busy: { msg: string; done: number; total: number } | null; error: string | null; loaded: boolean;
  init: () => Promise<void>; run: (kind: SpecType | 'all') => void; rate: (id: string, stars: number) => void; adopt: (p: Proposal) => void; remove: (kind: SpecType, id: string) => void;
}
let worker: Worker | null = null;
const save = (lab: LabState) => void idbPut({ id: 'content-lab', lab } as { id: string }, 'world');
export const useLab = create<LabStore>((set, get) => ({
  lab: null, busy: null, error: null, loaded: false,
  init: async () => { if (get().loaded) return; set({ loaded: true }); const row = (await idbAll<{ id: string; lab: LabState }>('world')).find((r) => r.id === 'content-lab'); set({ lab: row?.lab?.v === 1 ? row.lab : newLab(Math.floor(Math.random() * 1e6)) }); },
  run: (kind) => {
    if (get().busy) return; const lab = get().lab ?? newLab(Math.floor(Math.random() * 1e6)); set({ busy: { msg: 'Starting the AI builders…', done: 0, total: 1 }, error: null });
    worker?.terminate(); worker = new Worker(new URL('../workers/lab.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<LOut>) => { const m = e.data; if (m.type === 'progress') set({ busy: { msg: m.msg, done: m.done, total: m.total } }); else if (m.type === 'done') { set({ lab: m.lab, busy: null }); save(m.lab); worker?.terminate(); worker = null; } else { set({ busy: null, error: m.message }); worker?.terminate(); worker = null; } };
    worker.onerror = (e) => set({ busy: null, error: e.message || 'Content Lab worker crashed' }); worker.postMessage({ type: 'tick', lab, kind, seed: lab.seed });
  },
  rate: (id, stars) => { const lab = get().lab; if (!lab) return; const next = { ...lab, library: lab.library.map((p) => (p.id === id ? { ...p, rating: p.rating === stars ? 0 : stars } : p)) }; set({ lab: next }); save(next); },
  adopt: (p) => useHearth.getState().cmd({ k: 'mod', op: 'adopt', kind: p.spec.t, spec: p.spec.s } as never),
  remove: (kind, id) => useHearth.getState().cmd({ k: 'mod', op: 'remove', kind, id } as never),
}));
