import { Rng } from '../engine/rng';
import { PERSONAS, playRun, type Persona, type RunStats } from './bots';
import { generateFloor, solvableFloor } from './floor';
import { validateGenome } from './features';
import type { GameGenome } from './types';

export const TRAIN_SEEDS = [101, 102];
export const HELDOUT_SEEDS = [9001, 9002, 9003];
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** How much one simulated player enjoyed one run (0..1). Playtime is deliberately NOT an input. */
export function utility(p: Persona, r: RunStats, maxFloors = 3): number {
  const clearRate = r.cleared / Math.max(1, r.floors);
  const flow = 1 - Math.min(1, Math.abs(clearRate - p.target) / Math.max(0.3, p.target));
  const excitement = Math.min(1, r.nearMisses / 4) * (0.5 + p.thrill / 2);
  const novelty = Math.min(1, r.kinds / 2) * p.novelty;
  const progress = r.cleared / maxFloors;
  const frustration = clamp((r.early ? 1 : 0) + (r.outcome === 'quit' ? 0.7 : 0));
  const boredom = r.outcome === 'won' && r.nearMisses === 0 && r.triggers === 0 ? 1 : 0;
  return clamp(0.2 + 0.3 * flow + 0.18 * excitement + 0.18 * novelty + 0.14 * progress - 0.22 * frustration - 0.12 * boredom);
}
export interface FunResult { valid: boolean; violations: string[]; fun: number; byPersona: Record<string, number>; clearRate: number; nearMiss: number; kinds: number; quitRate: number; runs: number }
const hash = (a: number, b: number) => (Math.imul(a, 2654435761) ^ Math.imul(b + 1, 40503)) >>> 0;

export function hardChecks(g: GameGenome, seeds: number[], depths = 3): string[] {
  const v = validateGenome(g); if (v.length) return v;
  for (const s of seeds) for (let d = 0; d < depths; d++) { const f = generateFloor(g, d, s), sol = solvableFloor(f); if (!sol.ok) return [`unsolvable floor (seed ${s}, depth ${d})`]; }
  return [];
}
export function evalVersion(g: GameGenome, seeds: number[], personas: Persona[] = PERSONAS): FunResult {
  const violations = hardChecks(g, seeds);
  const out: FunResult = { valid: violations.length === 0, violations, fun: -1, byPersona: {}, clearRate: 0, nearMiss: 0, kinds: 0, quitRate: 0, runs: 0 };
  if (violations.length) return out;
  let sum = 0, n = 0, cl = 0, fl = 0, nm = 0, kd = 0, q = 0;
  personas.forEach((p, pi) => { let ps = 0; for (const s of seeds) { const r = playRun(g, p, s, new Rng(hash(s, pi))); const u = utility(p, r); ps += u; sum += u; n++; cl += r.cleared; fl += r.floors; nm += r.nearMisses; kd += r.kinds; q += r.outcome === 'quit' ? 1 : 0; } out.byPersona[p.id] = ps / seeds.length; });
  out.fun = sum / n - 0.01 * g.features.length; out.clearRate = cl / Math.max(1, fl); out.nearMiss = nm / n; out.kinds = kd / n; out.quitRate = q / n; out.runs = n;
  return out;
}
/** Fixed regression suite: properties every playable version must keep. */
export function regressionFailures(g: GameGenome): string[] {
  const hc = hardChecks(g, [31, 32, 33, 34, 35, 36, 37, 38], 4); if (hc.length) return hc.map((x) => 'regression: ' + x);
  const vet = PERSONAS[4]; let ok = 0; for (let s = 0; s < 8; s++) if (playRun(g, vet, 700 + s, new Rng(s), 1).cleared >= 1) ok++;
  return ok >= 2 ? [] : ['regression: even the veteran bot almost never clears floor 1'];
}
