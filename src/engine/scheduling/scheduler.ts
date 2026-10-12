export type ExpStatus = 'draft' | 'queued' | 'running' | 'pausing' | 'paused' | 'stopping' | 'completed' | 'failed' | 'cancelled';
const T: Record<ExpStatus, ExpStatus[]> = {
  draft: ['queued', 'cancelled'], queued: ['running', 'cancelled'], running: ['pausing', 'stopping', 'completed', 'failed'],
  pausing: ['paused', 'stopping', 'failed', 'completed'], paused: ['running', 'queued', 'stopping', 'cancelled'], stopping: ['cancelled', 'failed', 'completed'],
  completed: [], failed: [], cancelled: [],
};
export const isTerminal = (s: ExpStatus) => T[s].length === 0;
export interface ExpRecord { id: string; runId: number; status: ExpStatus; priority: number; updatedAt: number; error?: string }

export class Scheduler {
  private recs = new Map<string, ExpRecord>();
  constructor(public maxActive = 2, private now: () => number = Date.now) {}
  create(id: string, priority = 0): ExpRecord { if (this.recs.has(id)) throw new Error('duplicate id'); const r: ExpRecord = { id, runId: 0, status: 'draft', priority, updatedAt: this.now() }; this.recs.set(id, r); return r; }
  /** Re-create a record after a page reload (no worker is running for it). */
  restore(id: string, status: ExpStatus, runId: number, priority = 0) { this.recs.set(id, { id, runId, status, priority, updatedAt: this.now() }); }
  remove(id: string) { this.recs.delete(id); }
  get(id: string) { return this.recs.get(id); }
  list() { return [...this.recs.values()]; }
  /** Validated, idempotent transition. Returns false when rejected or already in the target state. */
  transition(id: string, to: ExpStatus): boolean {
    const r = this.recs.get(id); if (!r || r.status === to || !T[r.status].includes(to)) return false;
    r.status = to; r.updatedAt = this.now(); if (to === 'running') r.runId++; return true;
  }
  enqueue(id: string) { const ok = this.transition(id, 'queued'); this.pump(); return ok; }
  /** Starts queued experiments (highest priority first) while slots are free. Returns the ids that should start workers. */
  pump(): string[] {
    const active = this.list().filter((r) => ['running', 'pausing'].includes(r.status)).length, started: string[] = [];
    const q = this.list().filter((r) => r.status === 'queued').sort((a, b) => b.priority - a.priority);
    for (let i = 0; i < q.length && active + started.length < this.maxActive; i++) if (this.transition(q[i].id, 'running')) started.push(q[i].id);
    return started;
  }
  /** Worker events: stale runIds and terminal experiments are ignored, so late messages cannot revive or corrupt anything. */
  onWorkerEvent(e: { experimentId: string; runId: number; type: 'completed' | 'stopped' | 'paused' | 'error'; message?: string }): boolean {
    const r = this.recs.get(e.experimentId); if (!r || r.runId !== e.runId || isTerminal(r.status)) return false;
    let ok = false;
    if (e.type === 'completed') ok = this.transition(r.id, 'completed');
    else if (e.type === 'stopped') ok = this.transition(r.id, 'cancelled');
    else if (e.type === 'paused') ok = this.transition(r.id, 'paused');
    else { r.error = e.message; ok = this.transition(r.id, 'failed'); }
    this.pump(); return ok;
  }
}
