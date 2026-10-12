import { Rng } from '../../engine/rng';
import { EvoOps } from '../../engine/evolution/evolution';
import { MazeConfig, POLICY_LEN, generateMaze, idx, runEpisode, shortestPath, inBounds, CELL } from '../../game/maze/maze';

export type DefectKind = 'exit_unreachable' | 'step_limit_infeasible' | 'trivial_exit';
export const SEVERITY: Record<DefectKind, number> = { exit_unreachable: 1, step_limit_infeasible: 0.8, trivial_exit: 0.4 };

/** Ground truth, computed by the independent evaluator (never by testers). */
export function trueDefects(c: MazeConfig): DefectKind[] {
  const sp = shortestPath(c), out: DefectKind[] = [];
  if (sp < 0) out.push('exit_unreachable');
  else { if (sp > c.maxSteps) out.push('step_limit_infeasible'); if (sp <= 3) out.push('trivial_exit'); }
  return out;
}

export interface Finding {
  kind: DefectKind; severity: number; confidence: number; gameVersionId: string;
  reproduction: { seed: number; episodes: number }; evidence: string; suggestedArea: string; verified?: boolean;
}
/** Tester genome: 8 policy weights + coverage threshold (before claiming "unreachable"). */
export const TESTER_LEN = POLICY_LEN + 1;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function investigate(cfg: MazeConfig, g: number[], seed: number, versionId = 'unknown', episodes = 5): Finding[] {
  let ok = 0, minSteps = Infinity, cover = 0;
  for (let i = 0; i < episodes; i++) {
    const r = runEpisode(cfg, g.slice(0, POLICY_LEN), new Rng(seed + i * 7919));
    if (r.success) { ok++; minSteps = Math.min(minSteps, r.steps); }
    cover = Math.max(cover, r.visited / (cfg.width * cfg.height));
  }
  const base = { gameVersionId: versionId, reproduction: { seed, episodes } };
  const out: Finding[] = [];
  if (ok === 0) {
    const thresh = sig(g[POLICY_LEN]) * 0.5;
    const kind: DefectKind = cover >= thresh ? 'exit_unreachable' : 'step_limit_infeasible';
    out.push({ ...base, kind, severity: SEVERITY[kind], confidence: Math.min(1, cover * 2), evidence: `0/${episodes} episodes reached exit; max coverage ${(cover * 100).toFixed(0)}%`, suggestedArea: kind === 'exit_unreachable' ? 'walls near exit' : 'maxSteps' });
  } else if (minSteps <= 3) {
    out.push({ ...base, kind: 'trivial_exit', severity: SEVERITY.trivial_exit, confidence: 0.9, evidence: `exit reached in ${minSteps} steps`, suggestedArea: 'exit position' });
  }
  return out;
}

/** Precision-aware scoring: false positives are penalised, so spam cannot win. Range [-1, 1]. */
export function scoreClaims(truth: DefectKind[], claims: DefectKind[]): number {
  const claimed = new Set(claims), fp = [...claimed].filter((k) => !truth.includes(k)).length;
  if (!truth.length) return 1 - Math.min(2, fp * 0.5);
  const total = truth.reduce((s, k) => s + SEVERITY[k], 0), tp = truth.filter((k) => claimed.has(k)).reduce((s, k) => s + SEVERITY[k], 0);
  return Math.max(-1, tp / total - 0.5 * fp);
}

/** Fixed regression suite of mazes with known defects + clean mazes. */
export function makeDefectSuite(seed: number, size = 11): MazeConfig[] {
  const suite: MazeConfig[] = [];
  for (let i = 0; i < 3; i++) suite.push(generateMaze(seed + i, size, size));
  const sealed = generateMaze(seed + 10, size, size);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const x = sealed.exit[0] + dx, y = sealed.exit[1] + dy; if (inBounds(sealed, x, y)) sealed.cells[idx(sealed, x, y)] = CELL.WALL; }
  suite.push(sealed);
  const sealed2 = generateMaze(seed + 11, size, size);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const x = sealed2.exit[0] + dx, y = sealed2.exit[1] + dy; if (inBounds(sealed2, x, y)) sealed2.cells[idx(sealed2, x, y)] = CELL.WALL; }
  suite.push(sealed2);
  const tight = generateMaze(seed + 12, size, size); tight.maxSteps = Math.floor(shortestPath(tight) / 2); suite.push(tight);
  const tight2 = generateMaze(seed + 13, size, size); tight2.maxSteps = Math.floor(shortestPath(tight2) / 3); suite.push(tight2);
  const trivial = generateMaze(seed + 14, size, size); trivial.cells[idx(trivial, 2, 1)] = CELL.FLOOR; trivial.exit = [2, 1]; suite.push(trivial);
  return suite;
}

export function testerFitness(g: number[], suite: MazeConfig[], seed: number): number {
  let s = 0;
  suite.forEach((c, i) => { s += scoreClaims(trueDefects(c), investigate(c, g, seed + i * 101).map((f) => f.kind)); });
  return s / suite.length;
}

export const testerOps = (suite: MazeConfig[], evalSeed: number): EvoOps<number[]> => ({
  random: (rng) => Array.from({ length: TESTER_LEN }, () => rng.gauss() * 1.5),
  mutate: (g, rng, rate) => g.map((v) => (rng.next() < rate ? v + rng.gauss() * 0.5 : v)),
  crossover: (a, b, rng) => a.map((v, i) => (rng.next() < 0.5 ? v : b[i])),
  distance: (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)),
  evaluate: (g) => testerFitness(g, suite, evalSeed),
});
