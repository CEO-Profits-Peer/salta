import { Rng } from '../engine/rng';
import type { EvoOps } from '../engine/evolution/evolution';
import { Bot } from './bots';
import { DescentEnv } from './env';
import { BASE_TUNING, isTimed } from './features';
import { generateFloor, solvableFloor } from './floor';
import type { Floor, GameGenome } from './types';

export type DefectKind = 'unsolvable' | 'unfair_spawn' | 'light_exploit' | 'dead_feature';
export const SEV: Record<DefectKind, number> = { unsolvable: 1, light_exploit: 0.8, unfair_spawn: 0.7, dead_feature: 0.4 };
export interface Case { genome: GameGenome; floor: Floor }
const sig = (x: number) => 1 / (1 + Math.exp(-x));

/** Ground truth from the independent oracle. Probes never see this; they only get scored against it. */
export function truth(c: Case): DefectKind[] {
  const out: DefectKind[] = [], f = c.floor;
  if (!solvableFloor(f).ok) out.push('unsolvable');
  if (f.wardens.some((w) => Math.abs(w.x - f.cfg.start[0]) + Math.abs(w.y - f.cfg.start[1]) < 4)) out.push('unfair_spawn');
  const bloom = c.genome.features.filter((x) => x.kind === 'bloom').reduce((s, x) => s + x.count * x.power * 6, 0);
  if (bloom >= 0.4 * f.light) out.push('light_exploit');
  if (c.genome.features.some((x) => isTimed(x.kind) && x.count > f.light)) out.push('dead_feature');
  return out;
}
export const caseOf = (g: GameGenome, seed: number): Case => ({ genome: g, floor: generateFloor(g, 0, seed) });
const withF = (id: string, kind: GameGenome['features'][number]['kind'], count: number, power: number) => ({ id: `${kind}-${count}-${power}`, name: id, kind, count, power, day: 0, author: 'suite' });
export function makeSuite(seed: number): Case[] {
  const T = BASE_TUNING, g = (features: GameGenome['features'], tuning = T): GameGenome => ({ id: 'suite', features, tuning });
  const cases: Case[] = [
    caseOf(g([]), seed), caseOf(g([withF('Frost', 'frost', 2, 3)], { ...T, doors: 1 }), seed + 1), caseOf(g([withF('Pulse', 'pulse', 12, 4), withF('Spring', 'spring', 3, 3)]), seed + 2),
  ];
  const noKey = caseOf(g([], { ...T, doors: 1 }), seed + 3); noKey.floor = { ...noKey.floor, keys: [] }; cases.push(noKey);
  const unfair = caseOf(g([]), seed + 4), s = unfair.floor.cfg.start; unfair.floor = { ...unfair.floor, wardens: [{ x: s[0] + (unfair.floor.cfg.cells[s[1] * unfair.floor.cfg.width + s[0] + 1] === 1 ? 0 : 1), y: s[1] + (unfair.floor.cfg.cells[s[1] * unfair.floor.cfg.width + s[0] + 1] === 1 ? 1 : 0) }] }; cases.push(unfair);
  cases.push(caseOf(g([withF('Bloom', 'bloom', 3, 3)]), seed + 5));
  cases.push(caseOf(g([withF('Hush', 'hush', 500, 1)]), seed + 6));
  const both = caseOf(g([withF('Tide', 'tide', 600, 3)]), seed + 7); const sb = both.floor.cfg.start; both.floor = { ...both.floor, wardens: [{ x: sb[0] + 1, y: sb[1] }] }; cases.push(both);
  return cases;
}

export interface Claim { kind: DefectKind; confidence: number; evidence: string }
export function investigate(c: Case, g: number[], seed: number, episodes = 3): Claim[] {
  const p = { skill: sig(g[0]), explore: 0.3 + 1.2 * sig(g[1]), caution: 1.5 * sig(g[2]), greed: sig(g[3]), patience: 40 + 80 * sig(g[4]) };
  let clears = 0, early = 0, gain = 0, cover = 0; const kinds = new Set<string>();
  for (let i = 0; i < episodes; i++) {
    const env = new DescentEnv(c.floor), bot = new Bot(p, new Rng(seed + i * 977));
    while (env.outcome === 'running') { env.step(bot.act(env.obs(), c.floor.cfg.width)); if (env.stats.stall > p.patience) break; }
    if (env.outcome === 'cleared') clears++; if (env.stats.early) early++;
    gain = Math.max(gain, env.stats.lightGained / env.initialLight); cover = Math.max(cover, env.visited.size / (c.floor.cfg.width * c.floor.cfg.height)); env.stats.kinds.forEach((k) => kinds.add(k));
  }
  const out: Claim[] = [], cv = 0.15 + 0.5 * sig(g[5]);
  if (clears === 0 && cover >= cv) out.push({ kind: 'unsolvable', confidence: Math.min(1, cover * 2), evidence: `0/${episodes} runs reached the exit, ${Math.round(cover * 100)}% explored` });
  if (early / episodes >= sig(g[6]) * 0.9 && early > 0) out.push({ kind: 'unfair_spawn', confidence: 0.8, evidence: `caught within 12 steps in ${early}/${episodes} runs` });
  if (gain >= sig(g[7]) * 0.6 && gain > 0) out.push({ kind: 'light_exploit', confidence: Math.min(1, gain), evidence: `restored ${Math.round(gain * 100)}% of the starting light` });
  const dead = c.genome.features.find((f) => !kinds.has(f.kind));
  if (dead && cover >= cv) out.push({ kind: 'dead_feature', confidence: 0.6, evidence: `${dead.name} never triggered in ${episodes} runs` });
  return out;
}
export function scoreClaims(tr: DefectKind[], claims: DefectKind[]): { score: number; fp: number; tp: number; fn: number } {
  const cl = new Set(claims), fp = [...cl].filter((k) => !tr.includes(k)).length, tp = tr.filter((k) => cl.has(k)).length, fn = tr.length - tp;
  if (!tr.length) return { score: 1 - Math.min(2, fp * 0.5), fp, tp, fn };
  const tot = tr.reduce((s, k) => s + SEV[k], 0), got = tr.filter((k) => cl.has(k)).reduce((s, k) => s + SEV[k], 0);
  return { score: Math.max(-1, got / tot - 0.5 * fp), fp, tp, fn };
}
export function probeDetail(g: number[], suite: Case[], seed: number) {
  let score = 0, fp = 0, tp = 0, fn = 0;
  suite.forEach((c, i) => { const r = scoreClaims(truth(c), investigate(c, g, seed + i * 101).map((x) => x.kind)); score += r.score; fp += r.fp; tp += r.tp; fn += r.fn; });
  return { score: score / suite.length, fp, tp, fn };
}
export const PROBE_LEN = 8;
export const probeOps = (suite: Case[], seed: number): EvoOps<number[]> => ({
  random: (rng) => Array.from({ length: PROBE_LEN }, () => rng.gauss() * 1.3),
  mutate: (g, rng, rate) => g.map((v) => (rng.next() < rate ? v + rng.gauss() * 0.6 : v)),
  crossover: (a, b, rng) => a.map((v, i) => (rng.next() < 0.5 ? v : b[i])),
  distance: (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)) / Math.sqrt(a.length),
  evaluate: (g) => probeDetail(g, suite, seed).score,
});
