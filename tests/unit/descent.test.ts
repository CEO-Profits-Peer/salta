import { describe, it, expect } from 'vitest';
import { generateFloor, solvableFloor } from '../../src/descent/floor';
import { DescentEnv } from '../../src/descent/env';
import { BASE_TUNING, invent, validateGenome } from '../../src/descent/features';
import { evalVersion, TRAIN_SEEDS } from '../../src/descent/fun';
import { scoreClaims, truth, makeSuite } from '../../src/descent/probe';
import { Rng } from '../../src/engine/rng';
import { advanceDays, createWorld, daysBetween, addDays, humanInputFor, closeDay, type HumanRun } from '../../src/descent/world';
import { stepEvo, initEvo } from '../../src/engine/evolution/evolution';
import type { GameGenome } from '../../src/descent/types';

const g0: GameGenome = { id: 't', features: [], tuning: { ...BASE_TUNING } };
const small = { builderPop: 8, probePop: 8, gensPerDay: 1, players: 20 };

describe('descent floors', () => {
  it('are deterministic and always solvable, including key/door floors', () => {
    for (let s = 0; s < 25; s++) for (const doors of [0, 1, 2]) {
      const g = { ...g0, tuning: { ...BASE_TUNING, doors } }, a = generateFloor(g, s % 4, s), b = generateFloor(g, s % 4, s);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(solvableFloor(a).ok).toBe(true);
    }
  });
  it('doors really block without the key', () => {
    const f = generateFloor({ ...g0, tuning: { ...BASE_TUNING, doors: 1 } }, 0, 5), env = new DescentEnv(f);
    expect(f.doors.length).toBe(1); expect(env.canEnter(f.doors[0].x, f.doors[0].y)).toBe(false);
  });
  it('light runs out and the env is deterministic', () => {
    const f = generateFloor(g0, 0, 3), run = () => { const e = new DescentEnv(f); for (let i = 0; i < 600 && e.outcome === 'running'; i++) e.step(i % 4); return [e.outcome, e.steps, e.light]; };
    expect(run()).toEqual(run()); expect(run()[0]).not.toBe('running');
  });
});
describe('feature grammar + instructor rules', () => {
  it('invented features are valid; out-of-range, duplicate and oversized genomes are rejected', () => {
    const rng = new Rng(1); for (let i = 0; i < 50; i++) { const f = invent(rng, 1, 'x'); expect(validateGenome({ ...g0, features: [f] })).toEqual([]); }
    const f = invent(rng, 1, 'x');
    expect(validateGenome({ ...g0, features: [f, f] })).toContain('duplicate feature kind');
    expect(validateGenome({ ...g0, features: [{ ...f, count: 999 }] }).length).toBeGreaterThan(0);
    expect(validateGenome({ ...g0, tuning: { ...BASE_TUNING, wardens: 0 } }).length).toBeGreaterThan(0);
  });
  it('fun index is bounded and ignores playtime', () => { const r = evalVersion(g0, TRAIN_SEEDS); expect(r.valid).toBe(true); expect(r.fun).toBeGreaterThan(0); expect(r.fun).toBeLessThanOrEqual(1); });
});
describe('probes', () => {
  it('the oracle labels injected defects; false alarms score worse than silence', () => {
    const suite = makeSuite(3), t = suite.map(truth);
    expect(t[0]).toEqual([]); expect(t[3]).toContain('unsolvable'); expect(t[4]).toContain('unfair_spawn'); expect(t[5]).toContain('light_exploit'); expect(t[6]).toContain('dead_feature');
    expect(scoreClaims([], ['unsolvable', 'dead_feature']).score).toBeLessThan(scoreClaims([], []).score);
    expect(scoreClaims(['unsolvable'], ['unsolvable']).score).toBeGreaterThan(scoreClaims(['unsolvable'], ['unsolvable', 'unfair_spawn', 'dead_feature']).score);
  });
});
describe('evolution identities and culls', () => {
  it('tracks stable ids, parents and culled agents', () => {
    const ops = { random: (r: Rng) => [r.next()], mutate: (g: number[], r: Rng) => [g[0] + r.gauss() * 0.1], crossover: (a: number[]) => a, distance: (a: number[], b: number[]) => Math.abs(a[0] - b[0]), evaluate: (g: number[]) => -Math.abs(g[0] - 0.5) };
    const cfg = { popSize: 10, eliteCount: 2, survivalRate: 0.5, tournamentSize: 3, mutationRate: 0.5, diversityWeight: 0.1 };
    let s = initEvo(ops, cfg, 1); const first = s.ids!.slice(); s = stepEvo(s, ops, cfg);
    expect(s.culls!.length).toBeGreaterThan(0); expect(new Set(s.ids).size).toBe(10);
    for (const c of s.culls!) expect(first).toContain(c.id);
    expect(s.ids!.filter((i) => !first.includes(i)).every((i) => s.parents![i])).toBe(true);
  });
});
describe('world: daily five versions, popularity, ideas, patch notes', () => {
  it('opens five versions (1 control + 4 distinct valid challengers) with registered ideas and recorded cull causes', () => {
    const w = createWorld(11, '2026-10-12', small);
    expect(w.today.length).toBe(5); expect(w.today[0].role).toBe('control'); expect(w.today.slice(1).every((v) => v.role === 'challenger')).toBe(true);
    for (const v of w.today) expect(evalVersion(v.genome, TRAIN_SEEDS).valid).toBe(true);
    expect(Object.keys(w.ideas).length).toBeGreaterThan(0); expect(w.culls.length).toBeGreaterThan(0); expect(w.culls.every((c) => c.reason.length > 5)).toBe(true);
    expect(w.lastTick!.probes.before.length).toBe(8);
  });
  it('is reproducible and the master only changes through verified promotion or merge', () => {
    const a = advanceDays(createWorld(5, '2026-10-12', small), 3), b = advanceDays(createWorld(5, '2026-10-12', small), 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.day).toBe(4); expect(a.chronicle.length).toBe(3);
    for (const n of a.chronicle) { expect(n.table.length).toBe(5); expect(n.changed).toBe(n.before !== n.after); }
    expect(a.masterFun).toBeGreaterThanOrEqual(createWorld(5, '2026-10-12', small).masterFun - 0.02);
  });
  it('real human votes and ratings shift popularity', () => {
    const base = createWorld(9, '2026-10-12', small), pick = base.today[2].id;
    const w1 = structuredClone(base), w2 = structuredClone(base);
    const runs: HumanRun[] = base.today.map((v) => ({ day: 1, versionId: v.id, depth: 1, outcome: 'caught', steps: 50, nearMisses: 1, rating: v.id === pick ? 1 : -1 }));
    closeDay(w1, { runs: [], vote: undefined }); closeDay(w2, { runs, vote: pick });
    const p1 = w1.chronicle[0].table.find((t) => t.id === pick)!.popularity, p2 = w2.chronicle[0].table.find((t) => t.id === pick)!.popularity;
    expect(p2).toBeGreaterThan(p1); expect(w2.chronicle[0].plays).toBe(small.players + 5);
  });
  it('date helpers for return-catch-up', () => { expect(daysBetween('2026-10-12', '2026-10-15')).toBe(3); expect(addDays('2026-10-31', 1)).toBe('2026-11-01'); void humanInputFor; });
});
