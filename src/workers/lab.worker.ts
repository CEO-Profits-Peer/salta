import { labTick, newLab, type LabState, type SpecType } from '../hearth/lab';
export type LIn = { type: 'tick'; lab: LabState | null; kind: SpecType | 'all'; seed: number };
export type LOut = { type: 'progress'; msg: string; done: number; total: number } | { type: 'done'; lab: LabState } | { type: 'error'; message: string };
const ctx = self as unknown as { postMessage(m: LOut): void; onmessage: ((e: MessageEvent<LIn>) => void) | null };
ctx.onmessage = (e) => {
  try {
    let lab = e.data.lab ?? newLab(e.data.seed); const kinds: SpecType[] = e.data.kind === 'all' ? ['creature', 'building', 'quirk'] : [e.data.kind];
    kinds.forEach((k, ki) => { lab = labTick(lab, k, (msg, d, t) => ctx.postMessage({ type: 'progress', msg, done: ki * 6 + d, total: kinds.length * 6 })); });
    ctx.postMessage({ type: 'done', lab });
  } catch (err) { ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) }); }
};
