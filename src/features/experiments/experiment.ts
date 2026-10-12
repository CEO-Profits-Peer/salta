import { EvoConfig, EvoState, initEvo, stepEvo } from '../../engine/evolution/evolution';
import { MazeConfig, generateMaze } from '../../game/maze/maze';
import { Finding, investigate, makeDefectSuite, testerOps, trueDefects, TESTER_LEN } from '../testers/tester';
import { ArchiveEntry, Op, applyOps, builderFitness, builderOps, candidateId, paretoInsert } from '../builders/builder';
import { Decision, HELDOUT_SEEDS, Objectives, TRAIN_SEEDS, decidePromotion, evaluateConfig } from '../instructors/instructor';

export interface ExperimentConfig { seed: number; generations: number; testerPop: number; builderPop: number; mutationRate: number; survivalRate: number; tournamentSize: number; diversityWeight: number; mazeSize: number }
export const DEFAULT_CONFIG: ExperimentConfig = { seed: 42, generations: 10, testerPop: 24, builderPop: 24, mutationRate: 0.25, survivalRate: 0.5, tournamentSize: 3, diversityWeight: 0.1, mazeSize: 15 };
export interface GenMetrics { generation: number; testerBest: number; testerMean: number; testerDiversity: number; builderBest: number; builderMean: number; builderDiversity: number; bestVerifiedScore: number; validCandidateRate: number }
export interface Best { id: string; ops: Op[]; train: Objectives; heldOut: Objectives }
export interface ExperimentState {
  schemaVersion: 1; config: ExperimentConfig; generation: number; baseline: MazeConfig; baselineEval: Best;
  tester: EvoState<number[]>; builder: EvoState<Op[]>; findings: Finding[]; bestVerified: Best; archive: ArchiveEntry[];
  decidedIds: string[]; decisions: Decision[]; history: GenMetrics[];
}
const evoCfg = (c: ExperimentConfig, pop: number): EvoConfig => ({ popSize: pop, eliteCount: Math.max(1, Math.round(pop * 0.1)), survivalRate: c.survivalRate, tournamentSize: c.tournamentSize, mutationRate: c.mutationRate, diversityWeight: c.diversityWeight });

export function createExperiment(config: ExperimentConfig = DEFAULT_CONFIG): ExperimentState {
  const baseline = generateMaze(config.seed, config.mazeSize, config.mazeSize);
  const b: Best = { id: 'baseline', ops: [], train: evaluateConfig(baseline, TRAIN_SEEDS), heldOut: evaluateConfig(baseline, HELDOUT_SEEDS) };
  const suite = makeDefectSuite(config.seed + 500);
  return {
    schemaVersion: 1, config, generation: 0, baseline, baselineEval: b,
    tester: initEvo(testerOps(suite, config.seed + 900), evoCfg(config, config.testerPop), config.seed + 1),
    builder: initEvo(builderOps(baseline, false), evoCfg(config, config.builderPop), config.seed + 2),
    findings: [], bestVerified: b, archive: [], decidedIds: [], decisions: [], history: [],
  };
}

/** One full generation of the loop. Pure with respect to its input (state is cloned). */
export function stepExperiment(prev: ExperimentState): ExperimentState {
  if (prev.schemaVersion !== 1) throw new Error('unsupported checkpoint schema');
  const s = structuredClone(prev), cfg = s.config, gen = s.generation;
  // 1-2. Evolve testers against the fixed defect suite (scored by the independent oracle).
  s.tester = stepEvo(s.tester, testerOps(makeDefectSuite(cfg.seed + 500), cfg.seed + 900), evoCfg(cfg, cfg.testerPop));
  // 3. Best tester investigates baseline, best verified version and the latest builder champion; findings are verified by the oracle.
  const champ = s.builder.best ? applyOps(s.baseline, s.builder.best.genome) : null;
  const targets: [string, MazeConfig][] = [['baseline', s.baseline], [s.bestVerified.id, applyOps(s.baseline, s.bestVerified.ops)]];
  if (champ) targets.push([candidateId(gen, s.builder.best!.genome), champ]);
  const tg = s.tester.best!.genome;
  const fresh = targets.flatMap(([id, c]) => investigate(c, tg, cfg.seed + gen * 31, id).map((f) => ({ ...f, verified: trueDefects(c).includes(f.kind) })));
  s.findings = [...s.findings, ...fresh].slice(-50);
  const focusSteps = s.findings.some((f) => f.verified && f.kind === 'step_limit_infeasible');
  // 4-5. Evolve builders (instructor validates inside fitness; invalid candidates score -1).
  s.builder = stepEvo(s.builder, builderOps(s.baseline, focusSteps), evoCfg(cfg, cfg.builderPop));
  const valid = s.builder.fitness.filter((f) => f > -1).length / Math.max(1, s.builder.fitness.length);
  // 6. Independent promotion decision using held-out scenarios.
  const bb = s.builder.best;
  if (bb && bb.fitness > -1) {
    const id = candidateId(bb.generation, bb.genome);
    if (!s.decidedIds.includes(id)) {
      s.decidedIds.push(id);
      const r = builderFitness(s.baseline, bb.genome), cand = applyOps(s.baseline, bb.genome);
      const heldOut = evaluateConfig(cand, HELDOUT_SEEDS);
      const d = decidePromotion({ generation: gen, candidateId: id, violations: r.violations, train: r.objectives!, heldOut, current: s.bestVerified, baselineHeldOut: s.baselineEval.heldOut });
      s.decisions = [...s.decisions, d].slice(-100);
      const o = r.objectives!;
      if (r.violations.length === 0 && heldOut.score >= s.baselineEval.heldOut.score) s.archive = paretoInsert(s.archive, { id, ops: bb.genome, vec: [o.pathRatio, o.heuristicCompletion, o.exploitResistance], score: o.score, heldOut: heldOut.score });
      if (d.promoted) s.bestVerified = { id, ops: bb.genome, train: o, heldOut }; // previous best remains in the archive/decision log for rollback
    }
  }
  s.generation = gen + 1;
  s.history = [...s.history, { generation: gen, testerBest: s.tester.best!.fitness, testerMean: s.tester.meanFitness, testerDiversity: s.tester.diversity, builderBest: s.builder.best?.fitness ?? -1, builderMean: s.builder.meanFitness, builderDiversity: s.builder.diversity, bestVerifiedScore: s.bestVerified.train.score, validCandidateRate: valid }].slice(-500);
  return s;
}

export function runExperiment(state: ExperimentState, opts: { shouldStop?: () => boolean; onGeneration?: (s: ExperimentState) => void } = {}): { state: ExperimentState; completed: boolean } {
  let s = state;
  while (s.generation < s.config.generations) {
    if (opts.shouldStop?.()) return { state: s, completed: false }; // cooperative cancel between generations; state is a valid checkpoint
    s = stepExperiment(s);
    opts.onGeneration?.(s);
  }
  return { state: s, completed: true };
}
export const serialize = (s: ExperimentState) => JSON.stringify(s);
export function restore(json: string): ExperimentState {
  const s = JSON.parse(json) as ExperimentState;
  if (s?.schemaVersion !== 1 || !s.config || !Array.isArray(s.tester?.population) || s.tester.population[0]?.length !== TESTER_LEN) throw new Error('invalid checkpoint');
  return s;
}
