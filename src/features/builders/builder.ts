import { EvoOps } from '../../engine/evolution/evolution';
import { MazeConfig, CELL, idx } from '../../game/maze/maze';
import { evaluateConfig, validateCandidate, TRAIN_SEEDS, Objectives, POLICY } from '../instructors/instructor';

export type Op = { t: 'wall' | 'hazard'; x: number; y: number } | { t: 'steps'; v: number };

export function applyOps(base: MazeConfig, ops: Op[]): MazeConfig {
  const c: MazeConfig = { ...base, cells: [...base.cells] };
  for (const o of ops) {
    if (o.t === 'steps') { c.maxSteps = Math.max(1, Math.min(5000, Math.round(o.v))); continue; }
    if (o.x < 0 || o.y < 0 || o.x >= c.width || o.y >= c.height) continue;
    const i = idx(c, o.x, o.y), cur = c.cells[i];
    c.cells[i] = o.t === 'wall' ? (cur === CELL.WALL ? CELL.FLOOR : CELL.WALL) : cur === CELL.FLOOR ? CELL.HAZARD : CELL.FLOOR;
  }
  return c;
}
export const opKey = (o: Op) => (o.t === 'steps' ? 'steps' : `${o.t}:${o.x},${o.y}`);
export function candidateId(generation: number, ops: Op[]): string {
  let h = 5381; for (const ch of JSON.stringify(ops)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `v${generation}-${h.toString(16)}`;
}

export function builderFitness(base: MazeConfig, ops: Op[]): { fitness: number; violations: string[]; objectives?: Objectives } {
  const cand = applyOps(base, ops), violations = validateCandidate(base, cand, ops.length);
  if (violations.length) return { fitness: -1, violations };
  const objectives = evaluateConfig(cand, TRAIN_SEEDS);
  return { fitness: objectives.score, violations, objectives };
}

export const builderOps = (base: MazeConfig, focusSteps: boolean): EvoOps<Op[]> => {
  const rndOp = (rng: import('../../engine/rng').Rng): Op => {
    const r = rng.next();
    if (r < (focusSteps ? 0.3 : 0.1)) return { t: 'steps', v: base.maxSteps * rng.range(0.7, 2) };
    return { t: r < 0.9 ? 'wall' : 'hazard', x: 1 + rng.int(base.width - 2), y: 1 + rng.int(base.height - 2) };
  };
  return {
    random: (rng) => Array.from({ length: 1 + rng.int(4) }, () => rndOp(rng)),
    mutate: (g, rng, rate) => {
      let out = g.map((o) => (rng.next() < rate ? rndOp(rng) : o));
      if (rng.next() < rate * 2 && out.length < POLICY.maxOps) out = [...out, rndOp(rng)];
      if (rng.next() < rate && out.length > 1) out.splice(rng.int(out.length), 1);
      return out;
    },
    crossover: (a, b, rng) => [...a.slice(0, Math.ceil(a.length / 2)), ...b.slice(rng.int(Math.max(1, b.length)))].slice(0, POLICY.maxOps),
    distance: (a, b) => { const A = new Set(a.map(opKey)), B = new Set(b.map(opKey)); const u = new Set([...A, ...B]); let i = 0; A.forEach((k) => B.has(k) && i++); return u.size ? 1 - i / u.size : 0; },
    evaluate: (g) => builderFitness(base, g).fitness,
  };
};

const dominates = (a: number[], b: number[]) => a.every((v, i) => v >= b[i]) && a.some((v, i) => v > b[i]);
export interface ArchiveEntry { id: string; ops: Op[]; vec: number[]; score: number; heldOut: number }
export function paretoInsert(archive: ArchiveEntry[], e: ArchiveEntry, cap = 12): ArchiveEntry[] {
  if (archive.some((a) => dominates(a.vec, e.vec))) return archive;
  const out = [...archive.filter((a) => !dominates(e.vec, a.vec)), e].sort((x, y) => y.score - x.score);
  return out.slice(0, cap);
}
