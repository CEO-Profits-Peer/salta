import { Rng } from '../../engine/rng';
import { MazeConfig, MazeConfigSchema, HEURISTIC_GENOME, RANDOM_GENOME, runEpisode, shortestPath, deadEnds, passable, idx } from '../../game/maze/maze';

/** Instructor policy: explicit, inspectable, and NOT modifiable by builders. */
export const POLICY = Object.freeze({ maxChangedCells: 14, maxOps: 20, maxStepsMultiplier: 4, promotionMargin: 0.01, heldOutTolerance: 0.02 });
export const TRAIN_SEEDS = [11, 12, 13, 14, 15];
export const HELDOUT_SEEDS = [9001, 9002, 9003, 9004, 9005]; // never used for builder fitness

export function validateCandidate(base: MazeConfig, cand: MazeConfig, opCount = 0): string[] {
  const v: string[] = [];
  const parsed = MazeConfigSchema.safeParse(cand);
  if (!parsed.success) return ['schema: ' + parsed.error.issues.map((i) => i.message).join('; ')];
  if (opCount > POLICY.maxOps) v.push('too many operations');
  if (cand.width !== base.width || cand.height !== base.height) v.push('dimensions are outside the permitted modification space');
  if (cand.start[0] !== base.start[0] || cand.start[1] !== base.start[1] || cand.exit[0] !== base.exit[0] || cand.exit[1] !== base.exit[1]) v.push('start/exit are outside the permitted modification space');
  let changed = 0; cand.cells.forEach((c, i) => { if (c !== base.cells[i]) changed++; });
  if (changed > POLICY.maxChangedCells) v.push(`changed ${changed} cells (limit ${POLICY.maxChangedCells})`);
  if (cand.maxSteps > base.maxSteps * POLICY.maxStepsMultiplier) v.push('maxSteps exceeds permitted budget');
  v.push(...regressionFailures(cand));
  return v;
}

/** Fixed regression suite: properties every playable version must keep. */
export const REGRESSION: { name: string; check: (c: MazeConfig) => boolean }[] = [
  { name: 'start is walkable', check: (c) => passable(c, c.start[0], c.start[1]) },
  { name: 'exit is walkable', check: (c) => passable(c, c.exit[0], c.exit[1]) },
  { name: 'start differs from exit', check: (c) => c.start[0] !== c.exit[0] || c.start[1] !== c.exit[1] },
  { name: 'exit reachable', check: (c) => shortestPath(c) >= 0 },
  { name: 'solvable within step limit', check: (c) => { const s = shortestPath(c); return s >= 0 && s <= c.maxSteps; } },
];
export const regressionFailures = (c: MazeConfig) => REGRESSION.filter((r) => !r.check(c)).map((r) => 'regression: ' + r.name);

export interface Objectives { pathRatio: number; heuristicCompletion: number; exploitResistance: number; deadEndRatio: number; score: number }
/** Independent evaluator: fixed reference agents, fixed seeds. Candidate generators never run this on their own terms. */
export function evaluateConfig(c: MazeConfig, seeds: number[]): Objectives {
  let h = 0, r = 0;
  for (const s of seeds) {
    if (runEpisode(c, HEURISTIC_GENOME, new Rng(s)).success) h++;
    if (runEpisode(c, RANDOM_GENOME, new Rng(s + 77)).success) r++;
  }
  const sp = Math.max(0, shortestPath(c));
  const pathRatio = Math.min(1, sp / (c.width * c.height * 0.5)), heuristicCompletion = h / seeds.length, exploitResistance = 1 - r / seeds.length;
  const cells = c.cells.filter((x) => x !== 1).length || 1;
  return { pathRatio, heuristicCompletion, exploitResistance, deadEndRatio: deadEnds(c) / cells, score: 0.4 * pathRatio + 0.4 * heuristicCompletion + 0.2 * exploitResistance };
}

/** Flags reward patterns that are impossible under the environment rules. */
export function suspiciousReward(reward: number, steps: number, maxSteps: number): boolean {
  return reward > 1.0001 || steps > maxSteps || !Number.isFinite(reward);
}

export interface Decision { generation: number; candidateId: string; promoted: boolean; reasons: string[]; trainScore: number; heldOutScore: number }
export function decidePromotion(args: { generation: number; candidateId: string; violations: string[]; train: Objectives; heldOut: Objectives; current: { train: Objectives; heldOut: Objectives }; baselineHeldOut: Objectives }): Decision {
  const { generation, candidateId, violations, train, heldOut, current, baselineHeldOut } = args, reasons = [...violations];
  if (!violations.length) {
    if (train.score < current.train.score + POLICY.promotionMargin) reasons.push('no measurable improvement over current best');
    if (heldOut.score < current.heldOut.score - POLICY.heldOutTolerance) reasons.push('held-out score regressed (possible overfitting)');
    if (heldOut.score < baselineHeldOut.score) reasons.push('held-out score below baseline');
  }
  return { generation, candidateId, promoted: reasons.length === 0, reasons: reasons.length ? reasons : ['verified improvement on train and held-out suites'], trainScore: train.score, heldOutScore: heldOut.score };
}
export const _idx = idx;
