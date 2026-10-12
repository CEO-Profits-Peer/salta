import type { ExperimentConfig, ExperimentState } from '../../features/experiments/experiment';
/** Every message carries experimentId + runId so stale messages from an old run can be dropped. */
export type ToWorker =
  | { type: 'start'; experimentId: string; runId: number; config: ExperimentConfig; checkpoint?: string }
  | { type: 'pause' | 'stop' | 'status'; experimentId: string; runId: number };
export type FromWorker =
  | { type: 'progress'; experimentId: string; runId: number; state: ExperimentState; ms: number }
  | { type: 'completed' | 'stopped' | 'paused'; experimentId: string; runId: number }
  | { type: 'error'; experimentId: string; runId: number; message: string };
