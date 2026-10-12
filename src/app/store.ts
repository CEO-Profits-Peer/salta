import { create } from 'zustand';
import { Scheduler, isTerminal, type ExpStatus } from '../engine/scheduling/scheduler';
import { DEFAULT_CONFIG, restore, serialize, type ExperimentConfig, type ExperimentState } from '../features/experiments/experiment';
import type { FromWorker, ToWorker } from '../engine/workers/protocol';
import { idbAll, idbClear, idbDelete, idbPut } from './idb';
import { PROFILES, useSettings } from './settings';

export interface ExpView {
  id: string; name: string; config: ExperimentConfig; status: ExpStatus; runId: number; state: ExperimentState | null;
  genMs: number[]; createdAt: number; startedAt?: number; finishedAt?: number; updatedAt: number; error?: string; note?: string; syncedAt?: number;
}
interface Store {
  exps: Record<string, ExpView>; loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, config: ExperimentConfig) => string;
  start: (id: string) => void; pause: (id: string) => void; resume: (id: string) => void; stop: (id: string) => void;
  remove: (id: string) => void; duplicate: (id: string) => string | null; importCheckpoint: (name: string, json: string) => string;
  markSynced: (id: string) => void; clearAll: () => Promise<void>;
}

const sched = new Scheduler(useSettings.getState().maxActive);
const workers = new Map<string, Worker>();
const stopTimers = new Map<string, ReturnType<typeof setTimeout>>();
const STOP_TIMEOUT_MS = 4000;

export const useStore = create<Store>((set, get) => {
  const patch = (id: string, p: Partial<ExpView>) => {
    const cur = get().exps[id]; if (!cur) return;
    const next = { ...cur, ...p, updatedAt: Date.now() };
    set((s) => ({ exps: { ...s.exps, [id]: next } })); void idbPut(next);
  };
  const syncStatus = (id: string) => {
    const r = sched.get(id); if (!r) return;
    const cur = get().exps[id];
    patch(id, { status: r.status, runId: r.runId, error: r.error, startedAt: cur?.startedAt ?? (r.status === 'running' ? Date.now() : undefined), finishedAt: isTerminal(r.status) ? Date.now() : cur?.finishedAt, note: r.status === 'running' ? undefined : cur?.note });
  };
  const killWorker = (id: string) => { workers.get(id)?.terminate(); workers.delete(id); const t = stopTimers.get(id); if (t) clearTimeout(t); stopTimers.delete(id); };
  const send = (id: string, m: ToWorker) => workers.get(id)?.postMessage(m);

  const handle = (m: FromWorker) => {
    const r = sched.get(m.experimentId);
    if (!r || r.runId !== m.runId || isTerminal(r.status)) return; // stale or late message: ignored
    if (m.type === 'progress') {
      const cur = get().exps[m.experimentId]; if (!cur) return;
      patch(m.experimentId, { state: m.state, genMs: m.ms > 0 ? [...cur.genMs, m.ms].slice(-500) : cur.genMs });
      return;
    }
    const ev = m.type === 'error' ? { experimentId: m.experimentId, runId: m.runId, type: 'error' as const, message: m.message } : { experimentId: m.experimentId, runId: m.runId, type: m.type };
    if (sched.onWorkerEvent(ev)) { killWorker(m.experimentId); syncStatus(m.experimentId); spawnStarted(); }
  };
  const spawn = (id: string) => {
    const v = get().exps[id], r = sched.get(id); if (!v || !r) return;
    try {
      const w = new Worker(new URL('../workers/experiment.worker.ts', import.meta.url), { type: 'module' });
      workers.set(id, w);
      w.onmessage = (e: MessageEvent<FromWorker>) => handle(e.data);
      w.onerror = (e) => { if (sched.onWorkerEvent({ experimentId: id, runId: r.runId, type: 'error', message: e.message || 'worker crashed' })) { killWorker(id); syncStatus(id); spawnStarted(); } };
      w.postMessage({ type: 'start', experimentId: id, runId: r.runId, config: v.config, checkpoint: v.state ? serialize(v.state) : undefined } satisfies ToWorker);
      syncStatus(id);
    } catch (err) {
      sched.onWorkerEvent({ experimentId: id, runId: r.runId, type: 'error', message: String(err) }); syncStatus(id);
    }
  };
  const spawnStarted = () => { sched.maxActive = useSettings.getState().maxActive; for (const id of sched.pump()) spawn(id); };

  return {
    exps: {}, loaded: false,
    load: async () => {
      if (get().loaded) return;
      const rows = await idbAll<ExpView>(); const exps: Record<string, ExpView> = {};
      for (const v of rows) {
        let status = v.status, note = v.note;
        if (!isTerminal(status) && status !== 'draft') { status = v.state ? 'paused' : 'draft'; note = v.state ? 'Interrupted by page reload. Checkpoint restored; press Resume to continue.' : undefined; }
        sched.restore(v.id, status, v.runId ?? 0); exps[v.id] = { ...v, status, note };
      }
      set({ exps, loaded: true });
    },
    create: (name, config) => {
      const id = crypto.randomUUID(), now = Date.now();
      sched.create(id);
      const v: ExpView = { id, name, config, status: 'draft', runId: 0, state: null, genMs: [], createdAt: now, updatedAt: now };
      set((s) => ({ exps: { ...s.exps, [id]: v } })); void idbPut(v); return id;
    },
    start: (id) => { if (sched.get(id)?.status !== 'draft') return; sched.transition(id, 'queued'); syncStatus(id); spawnStarted(); },
    pause: (id) => { if (sched.transition(id, 'pausing')) { send(id, { type: 'pause', experimentId: id, runId: sched.get(id)!.runId }); syncStatus(id); } },
    resume: (id) => { if (sched.transition(id, 'queued')) { syncStatus(id); spawnStarted(); } },
    stop: (id) => {
      const r = sched.get(id); if (!r) return;
      if (r.status === 'queued') { sched.transition(id, 'cancelled'); syncStatus(id); return; }
      if (!sched.transition(id, 'stopping')) return;
      syncStatus(id);
      const runId = r.runId;
      if (!workers.has(id)) { sched.onWorkerEvent({ experimentId: id, runId, type: 'stopped' }); syncStatus(id); spawnStarted(); return; }
      send(id, { type: 'stop', experimentId: id, runId });
      stopTimers.set(id, setTimeout(() => { // unresponsive worker: terminate it
        killWorker(id); sched.onWorkerEvent({ experimentId: id, runId, type: 'stopped' }); syncStatus(id); spawnStarted();
      }, STOP_TIMEOUT_MS));
    },
    remove: (id) => {
      killWorker(id); sched.remove(id);
      set((s) => { const { [id]: _gone, ...rest } = s.exps; return { exps: rest }; }); void idbDelete(id); spawnStarted();
    },
    duplicate: (id) => { const v = get().exps[id]; return v ? get().create(`${v.name} (copy)`, structuredClone(v.config)) : null; },
    importCheckpoint: (name, json) => {
      const st = restore(json), id = crypto.randomUUID(), now = Date.now();
      const done = st.generation >= st.config.generations;
      sched.restore(id, done ? 'completed' : 'paused', 0);
      const v: ExpView = { id, name, config: st.config, status: done ? 'completed' : 'paused', runId: 0, state: st, genMs: [], createdAt: now, updatedAt: now, note: 'Imported from checkpoint.' };
      set((s) => ({ exps: { ...s.exps, [id]: v } })); void idbPut(v); return id;
    },
    markSynced: (id) => patch(id, { syncedAt: Date.now() }),
    clearAll: async () => { for (const id of Object.keys(get().exps)) { killWorker(id); sched.remove(id); } set({ exps: {} }); await idbClear(); },
  };
});

export function newConfig(over: Partial<ExperimentConfig> = {}): ExperimentConfig {
  const { profile } = useSettings.getState();
  return { ...DEFAULT_CONFIG, ...PROFILES[profile].cfg, seed: Math.floor(Math.random() * 1e6), ...over };
}

// Hidden-tab behaviour: optionally pause running experiments and resume them when the tab is visible again.
const autoPaused = new Set<string>();
let visInstalled = false;
export function installVisibilityHandler() {
  if (visInstalled) return; visInstalled = true;
  document.addEventListener('visibilitychange', () => {
    const st = useStore.getState();
    if (document.hidden && useSettings.getState().pauseWhenHidden) {
      for (const v of Object.values(st.exps)) if (v.status === 'running') { autoPaused.add(v.id); st.pause(v.id); }
    } else if (!document.hidden) {
      for (const id of autoPaused) { if (st.exps[id]?.status === 'paused') st.resume(id); }
      autoPaused.clear();
    }
  });
}
