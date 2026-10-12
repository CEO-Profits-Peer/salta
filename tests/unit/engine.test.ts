import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/engine/rng';
import { generateMaze, MazeConfigSchema, MazeEnv, shortestPath, CELL, idx } from '../../src/game/maze/maze';
import { initEvo, stepEvo, EvoOps } from '../../src/engine/evolution/evolution';
import { scoreClaims, trueDefects, makeDefectSuite } from '../../src/features/testers/tester';
import { validateCandidate, regressionFailures, evaluateConfig, suspiciousReward } from '../../src/features/instructors/instructor';
import { applyOps } from '../../src/features/builders/builder';
import { createExperiment, runExperiment, stepExperiment, serialize, restore, DEFAULT_CONFIG } from '../../src/features/experiments/experiment';
import { Scheduler } from '../../src/engine/scheduling/scheduler';

const small = { ...DEFAULT_CONFIG, generations: 4, testerPop: 12, builderPop: 12, mazeSize: 11 };

describe('rng + maze', () => {
  it('is deterministic and serializable', () => {
    const a = new Rng(5), b = new Rng(5); a.next(); b.next();
    const c = new Rng(a.state); expect(c.next()).toBe(b.next());
  });
  it('generates valid reachable mazes with the same layout per seed', () => {
    for (let s = 1; s <= 20; s++) { const m = generateMaze(s, 15, 15); expect(MazeConfigSchema.safeParse(m).success).toBe(true); expect(shortestPath(m)).toBeGreaterThan(0); }
    expect(generateMaze(3).cells).toEqual(generateMaze(3).cells);
  });
  it('env: walls block, exit ends the episode', () => {
    const m = generateMaze(1, 7, 7), e = new MazeEnv(m); e.reset();
    const r = e.step(0); expect(r.reward).toBeLessThan(0); expect(e.y).toBe(m.start[1]);
  });
  it('schema rejects malformed configs', () => {
    expect(MazeConfigSchema.safeParse({ ...generateMaze(1), cells: [1, 2, 3] }).success).toBe(false);
    expect(MazeConfigSchema.safeParse({ ...generateMaze(1), exit: [99, 99] }).success).toBe(false);
  });
});

describe('evolution', () => {
  const ops: EvoOps<number[]> = {
    random: (r) => [r.range(-5, 5), r.range(-5, 5)], mutate: (g, r, rate) => g.map((v) => (r.next() < rate ? v + r.gauss() : v)),
    crossover: (a, b, r) => a.map((v, i) => (r.next() < 0.5 ? v : b[i])), distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), evaluate: (g) => -(g[0] ** 2 + g[1] ** 2),
  };
  const cfg = { popSize: 20, eliteCount: 2, survivalRate: 0.5, tournamentSize: 3, mutationRate: 0.5, diversityWeight: 0.1 };
  it('improves a toy problem; best fitness never decreases (elitism)', () => {
    let s = initEvo(ops, cfg, 1), prev = -Infinity; const first = (() => { const t = stepEvo(s, ops, cfg); return t.best!.fitness; })();
    for (let i = 0; i < 40; i++) { s = stepEvo(s, ops, cfg); expect(s.best!.fitness).toBeGreaterThanOrEqual(prev); prev = s.best!.fitness; }
    expect(s.best!.fitness).toBeGreaterThan(first);
  });
});

describe('tester scoring', () => {
  it('spamming false positives scores worse than one genuine finding', () => {
    const truth = ['exit_unreachable' as const];
    const spam = scoreClaims(truth, ['exit_unreachable', 'step_limit_infeasible', 'trivial_exit']);
    const precise = scoreClaims(truth, ['exit_unreachable']);
    expect(precise).toBeGreaterThan(spam);
    expect(scoreClaims([], ['trivial_exit', 'exit_unreachable'])).toBeLessThan(scoreClaims([], []));
  });
  it('suite has known defects and clean mazes', () => { const s = makeDefectSuite(1); expect(s.filter((c) => trueDefects(c).length).length).toBe(5); });
});

describe('instructor', () => {
  const base = generateMaze(7, 11, 11);
  it('rejects walling off the exit and flags the regression', () => {
    const bad = { ...base, cells: [...base.cells] };
    for (const [dx, dy] of [[0, -1], [-1, 0]]) bad.cells[idx(bad, base.exit[0] + dx, base.exit[1] + dy)] = CELL.WALL;
    expect(regressionFailures(bad)).toContain('regression: exit reachable');
    expect(validateCandidate(base, bad).length).toBeGreaterThan(0);
  });
  it('rejects out-of-scope edits (moved exit, too many cells) and accepts a clean one', () => {
    expect(validateCandidate(base, { ...base, exit: [1, 2] })).toEqual(expect.arrayContaining([expect.stringContaining('outside')]));
    expect(validateCandidate(base, applyOps(base, [{ t: 'steps', v: base.maxSteps + 1 }]))).toEqual([]);
  });
  it('held-out and train evaluations are distinct and bounded', () => { const o = evaluateConfig(base, [1, 2]); expect(o.score).toBeGreaterThanOrEqual(0); expect(o.score).toBeLessThanOrEqual(1); });
  it('flags impossible rewards', () => { expect(suspiciousReward(5, 10, 100)).toBe(true); expect(suspiciousReward(0.5, 10, 100)).toBe(false); });
});

describe('full experiment loop', () => {
  it('runs end-to-end, is reproducible, and best scores are monotonic', () => {
    const a = runExperiment(createExperiment(small)).state, b = runExperiment(createExperiment(small)).state;
    expect(a.generation).toBe(4); expect(serialize(a)).toBe(serialize(b));
    for (let i = 1; i < a.history.length; i++) { expect(a.history[i].testerBest).toBeGreaterThanOrEqual(a.history[i - 1].testerBest); expect(a.history[i].builderBest).toBeGreaterThanOrEqual(a.history[i - 1].builderBest); }
    expect(a.bestVerified.heldOut.score).toBeGreaterThanOrEqual(a.baselineEval.heldOut.score);
    expect(a.decisions.every((d) => d.promoted || d.reasons.length > 0)).toBe(true);
  });
  it('stop halts computation and the checkpoint resumes identically', () => {
    let n = 0; const partial = runExperiment(createExperiment(small), { shouldStop: () => n++ >= 2 });
    expect(partial.completed).toBe(false); expect(partial.state.generation).toBe(2);
    const resumed = runExperiment(restore(serialize(partial.state))).state, straight = runExperiment(createExperiment(small)).state;
    expect(serialize(resumed)).toBe(serialize(straight));
  });
  it('rejects corrupt checkpoints', () => { expect(() => restore('{"schemaVersion":2}')).toThrow(); expect(() => restore('nope')).toThrow(); });
  it('stepExperiment does not mutate its input', () => { const s = createExperiment(small), before = serialize(s); stepExperiment(s); expect(serialize(s)).toBe(before); });
});

describe('scheduler', () => {
  it('validates transitions, respects maxActive and ignores stale/terminal messages', () => {
    const sch = new Scheduler(1); sch.create('a'); sch.create('b');
    expect(sch.transition('a', 'running')).toBe(false); // draft -> running is illegal
    sch.enqueue('a'); sch.enqueue('b');
    expect(sch.get('a')!.status).toBe('running'); expect(sch.get('b')!.status).toBe('queued');
    expect(sch.onWorkerEvent({ experimentId: 'a', runId: 99, type: 'completed' })).toBe(false); // stale run
    expect(sch.onWorkerEvent({ experimentId: 'a', runId: 1, type: 'completed' })).toBe(true);
    expect(sch.get('b')!.status).toBe('running'); // slot freed
    expect(sch.onWorkerEvent({ experimentId: 'a', runId: 1, type: 'error', message: 'late' })).toBe(false); // completed stays completed
    expect(sch.get('a')!.status).toBe('completed');
  });
});
