import { createExperiment, restore, stepExperiment, type ExperimentState } from '../features/experiments/experiment';
import type { FromWorker, ToWorker } from '../engine/workers/protocol';

const ctx = self as unknown as { postMessage(m: FromWorker): void; onmessage: ((e: MessageEvent<ToWorker>) => void) | null };
let cur: { experimentId: string; runId: number } | null = null;
let flag: 'run' | 'pause' | 'stop' = 'run';

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'start') { if (cur) return; cur = { experimentId: m.experimentId, runId: m.runId }; flag = 'run'; void run(m); return; }
  if (!cur || m.runId !== cur.runId || m.experimentId !== cur.experimentId) return; // stale message
  if (m.type === 'pause' && flag === 'run') flag = 'pause';
  if (m.type === 'stop') flag = 'stop';
};

async function run(m: Extract<ToWorker, { type: 'start' }>) {
  const base = { experimentId: m.experimentId, runId: m.runId };
  try {
    let state: ExperimentState = m.checkpoint ? restore(m.checkpoint) : createExperiment(m.config);
    ctx.postMessage({ type: 'progress', ...base, state, ms: 0 });
    while (state.generation < state.config.generations && flag === 'run') {
      const t = performance.now();
      state = stepExperiment(state);
      ctx.postMessage({ type: 'progress', ...base, state, ms: performance.now() - t });
      await new Promise((r) => setTimeout(r, 0)); // yield so pause/stop messages are processed
    }
    ctx.postMessage({ type: state.generation >= state.config.generations ? 'completed' : flag === 'stop' ? 'stopped' : 'paused', ...base });
  } catch (err) {
    ctx.postMessage({ type: 'error', ...base, message: err instanceof Error ? err.message : String(err) });
  }
}
