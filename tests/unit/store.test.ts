import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createExperiment, restore, runExperiment, serialize, stepExperiment, DEFAULT_CONFIG } from '../../src/features/experiments/experiment';
import type { FromWorker, ToWorker } from '../../src/engine/workers/protocol';

/** In-process stand-in for the browser Worker, running the real engine, to exercise the real store + scheduler. */
class FakeWorker {
  onmessage: ((e: { data: FromWorker }) => void) | null = null; onerror: ((e: { message: string }) => void) | null = null;
  flag: 'run' | 'pause' | 'stop' = 'run'; dead = false; static created = 0;
  constructor() { FakeWorker.created++; }
  postMessage(m: ToWorker) { if (m.type === 'start') void this.run(m); else if (m.type === 'pause' && this.flag === 'run') this.flag = 'pause'; else if (m.type === 'stop') this.flag = 'stop'; }
  terminate() { this.dead = true; }
  emit(m: FromWorker) { if (!this.dead) this.onmessage?.({ data: m }); }
  async run(m: Extract<ToWorker, { type: 'start' }>) {
    const b = { experimentId: m.experimentId, runId: m.runId };
    let st = m.checkpoint ? restore(m.checkpoint) : createExperiment(m.config);
    this.emit({ type: 'progress', ...b, state: st, ms: 0 });
    while (st.generation < st.config.generations && this.flag === 'run') { await new Promise((r) => setTimeout(r, 1)); if (this.dead) return; st = stepExperiment(st); this.emit({ type: 'progress', ...b, state: st, ms: 1 }); }
    this.emit({ type: st.generation >= st.config.generations ? 'completed' : this.flag === 'stop' ? 'stopped' : 'paused', ...b });
  }
}
const cfg = { ...DEFAULT_CONFIG, generations: 5, testerPop: 8, builderPop: 8, mazeSize: 11 };
const until = async (f: () => boolean, ms = 8000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 5)); } };
let useStore: typeof import('../../src/app/store').useStore;
beforeAll(async () => {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
  vi.stubGlobal('Worker', FakeWorker);
  ({ useStore } = await import('../../src/app/store'));
});

describe('store + scheduler + worker protocol', () => {
  it('start runs to completion and matches a straight engine run', async () => {
    const st = useStore.getState(), id = st.create('a', cfg); st.start(id);
    await until(() => useStore.getState().exps[id].status === 'completed');
    expect(serialize(useStore.getState().exps[id].state!)).toBe(serialize(runExperiment(createExperiment(cfg)).state));
  });
  it('pause checkpoints, resume continues, result is identical', async () => {
    const st = useStore.getState(), id = st.create('b', cfg); st.start(id);
    await until(() => (useStore.getState().exps[id].state?.generation ?? 0) >= 1);
    st.pause(id); await until(() => useStore.getState().exps[id].status === 'paused');
    const g = useStore.getState().exps[id].state!.generation; expect(g).toBeLessThan(5);
    st.resume(id); await until(() => useStore.getState().exps[id].status === 'completed');
    expect(serialize(useStore.getState().exps[id].state!)).toBe(serialize(runExperiment(createExperiment(cfg)).state));
  });
  it('stop really stops computation and the experiment stays cancelled', async () => {
    const st = useStore.getState(), id = st.create('c', { ...cfg, generations: 200 }); st.start(id);
    await until(() => (useStore.getState().exps[id].state?.generation ?? 0) >= 1);
    st.stop(id); await until(() => useStore.getState().exps[id].status === 'cancelled');
    const g = useStore.getState().exps[id].state!.generation; await new Promise((r) => setTimeout(r, 80));
    expect(useStore.getState().exps[id].state!.generation).toBe(g); expect(g).toBeLessThan(200);
  });
  it('respects max active experiments by queueing', async () => {
    const st = useStore.getState(), a = st.create('q1', { ...cfg, generations: 30 }), b = st.create('q2', { ...cfg, generations: 30 }), c = st.create('q3', { ...cfg, generations: 30 });
    st.start(a); st.start(b); st.start(c);
    expect(['running', 'queued'].includes(useStore.getState().exps[c].status)).toBe(true);
    expect(useStore.getState().exps[c].status).toBe('queued'); // default maxActive is 2
    st.stop(a); st.stop(b); st.stop(c);
    await until(() => ['a', 'b', 'c'].every((_, i) => useStore.getState().exps[[a, b, c][i]].status === 'cancelled'));
  });
});
