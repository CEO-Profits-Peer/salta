import { supabase } from './client';
import type { ExpView } from '../../app/store';
import { serialize } from '../../features/experiments/experiment';

const METRICS = ['testerBest', 'testerMean', 'builderBest', 'builderMean', 'bestVerifiedScore', 'validCandidateRate'] as const;

/** Idempotent: safe to call repeatedly (upserts on stable keys). Metrics are aggregated per generation, never per step. */
export async function syncExperiment(v: ExpView, userId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Cloud is not configured (local-demo mode).' };
  const exp = await supabase.from('experiments').upsert({
    id: v.id, owner_id: userId, experiment_type: 'maze_evolution', configuration: v.config, execution_backend: 'browser_worker', status: v.status,
    current_generation: v.state?.generation ?? 0, started_at: v.startedAt ? new Date(v.startedAt).toISOString() : null, finished_at: v.finishedAt ? new Date(v.finishedAt).toISOString() : null,
  });
  if (exp.error) return { ok: false, message: exp.error.message };
  if (v.state) {
    const rows = v.state.history.flatMap((h) => METRICS.map((m) => ({ experiment_id: v.id, generation: h.generation, metric_name: m, metric_value: h[m] })));
    for (let i = 0; i < rows.length; i += 200) {
      const r = await supabase.from('experiment_metrics').upsert(rows.slice(i, i + 200), { onConflict: 'experiment_id,generation,metric_name' });
      if (r.error) return { ok: false, message: r.error.message };
    }
    const path = `${userId}/${v.id}/checkpoint.json`;
    const up = await supabase.storage.from('artifacts').upload(path, new Blob([serialize(v.state)], { type: 'application/json' }), { upsert: true });
    if (up.error) return { ok: false, message: up.error.message };
    const art = await supabase.from('artifacts').upsert({ owner_id: userId, experiment_id: v.id, artifact_type: 'checkpoint', storage_path: path, metadata: { generation: v.state.generation, self_reported: true }, schema_version: 1 }, { onConflict: 'storage_path' });
    if (art.error) return { ok: false, message: art.error.message };
  }
  return { ok: true, message: 'Saved to cloud (self-reported, not verified).' };
}
