import { Rng } from '../engine/rng';
import { initEvo, stepEvo, type Cull, type EvoConfig, type EvoOps, type EvoState } from '../engine/evolution/evolution';
import { ALL_RANGES, BASE_TUNING, TUNING_LIMITS, describe, featureId, invent, validateGenome } from './features';
import { PERSONAS, playRun } from './bots';
import { HELDOUT_SEEDS, TRAIN_SEEDS, evalVersion, hardChecks, regressionFailures, utility } from './fun';
import { PROBE_LEN, caseOf, makeSuite, investigate, probeDetail, probeOps, truth, type DefectKind } from './probe';
import { ALL_KINDS, type FeatureSpec, type GameGenome, type Tuning } from './types';

export interface WorldConfig { builderPop: number; probePop: number; gensPerDay: number; players: number }
export const DEFAULT_WORLD_CONFIG: WorldConfig = { builderPop: 14, probePop: 14, gensPerDay: 2, players: 60 };
export interface Version { id: string; label: string; genome: GameGenome; role: 'control' | 'challenger'; parentId: string; agent: number; fun: number; quarantine?: string }
export interface Idea { fid: string; feature: FeatureSpec; firstDay: number; author: string; status: 'new' | 'in-master' | 'shelved' | 'rejected'; ablation: number | null; appearances: number; note: string }
export interface CullEvent { day: number; chamber: 'probe' | 'builder' | 'instructor'; who: string; reason: string }
export interface HumanRun { day: number; versionId: string; depth: number; outcome: string; steps: number; nearMisses: number; rating: -1 | 0 | 1 }
export interface AgentView { id: number; vec: number[]; fitness: number; born: boolean }
export interface TickView { day: number; probes: { before: AgentView[]; after: AgentView[]; culled: number[] }; builders: { before: AgentView[]; after: AgentView[]; culled: number[] } }
export interface PatchNote { day: number; date: string; before: string; after: string; changed: boolean; lines: string[]; table: { label: string; id: string; features: string[]; fun: number; popularity: number; humanRuns: number; note?: string }[]; plays: number }
export interface DayMetric { day: number; masterFun: number; winnerPopularity: number; ideas: number; masterFeatures: number; changed: boolean }
export interface ProbeFinding { day: number; versionId: string; kind: DefectKind; verified: boolean; evidence: string; probe: number }
export interface WorldState {
  schema: 1; seed: number; cfg: WorldConfig; day: number; date: string; build: number; master: GameGenome; masterFun: number;
  probes: EvoState<number[]>; builders: EvoState<GameGenome>; today: Version[]; ideas: Record<string, Idea>; chronicle: PatchNote[]; culls: CullEvent[];
  humanRuns: HumanRun[]; humanVotes: Record<number, string>; history: DayMetric[]; findings: ProbeFinding[]; lastTick: TickView | null;
}

const MASTER_BASE: GameGenome = { id: 'master-b0', features: [], tuning: { ...BASE_TUNING } };
const evoCfg = (pop: number, mut: number): EvoConfig => ({ popSize: pop, eliteCount: 2, survivalRate: 0.5, tournamentSize: 3, mutationRate: mut, diversityWeight: 0.1 });
const LABELS = ['A', 'B', 'C', 'D', 'E'];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const INT_KEYS: (keyof Tuning)[] = ['fog', 'wardens', 'wardenEvery', 'doors'];
export const versionLabel = (build: number) => `v1.${build}`;
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export function vec(g: GameGenome): number[] {
  const t = g.tuning; return [t.fog / 6, t.lightFactor / 5, t.wardens / 4, t.wardenEvery / 5, t.hazards * 10, t.loops * 3, t.doors / 2, t.size / 17, ...ALL_KINDS.map((k) => (g.features.some((f) => f.kind === k) ? 1 : 0))];
}
const genomeDistance = (a: GameGenome, b: GameGenome) => {
  let d = 0; for (const k of Object.keys(TUNING_LIMITS) as (keyof Tuning)[]) { const [lo, hi] = TUNING_LIMITS[k]; d += Math.abs(a.tuning[k] - b.tuning[k]) / (hi - lo); }
  const A = new Set(a.features.map((f) => f.id)), B = new Set(b.features.map((f) => f.id)), u = new Set([...A, ...B]); let i = 0; A.forEach((x) => B.has(x) && i++);
  return d / 8 + (u.size ? 1 - i / u.size : 0) * 0.6;
};
const retune = (f: FeatureSpec, rng: Rng): FeatureSpec => {
  const r = ALL_RANGES[f.kind], count = r.count[0] + rng.int(r.count[1] - r.count[0] + 1), power = r.power[0] + rng.int(r.power[1] - r.power[0] + 1);
  return { ...f, count: f.kind === 'rift' ? Math.max(2, count - (count % 2)) : count, power, id: featureId(f.kind, f.kind === 'rift' ? Math.max(2, count - (count % 2)) : count, power) };
};
const putFeature = (c: GameGenome, f: FeatureSpec) => { c.features = c.features.filter((x) => x.kind !== f.kind); c.features.push(f); if (c.features.length > 4) c.features.splice(0, c.features.length - 4); };

function builderOps(master: GameGenome, pool: FeatureSpec[], day: number): EvoOps<GameGenome> {
  const mutate = (g: GameGenome, rng: Rng, rate: number): GameGenome => {
    const c = structuredClone(g);
    for (const k of Object.keys(TUNING_LIMITS) as (keyof Tuning)[]) if (rng.next() < rate * 0.6) {
      const [lo, hi] = TUNING_LIMITS[k]; if (k === 'size') { c.tuning.size = rng.pick([11, 13, 15, 17]); continue; }
      let v = clamp(c.tuning[k] + rng.gauss() * (hi - lo) * 0.14, lo, hi); if (INT_KEYS.includes(k)) v = Math.round(v); else v = Math.round(v * 100) / 100; c.tuning[k] = v;
    }
    if (rng.next() < rate * 0.9) putFeature(c, pool.length && rng.next() < 0.5 ? structuredClone(rng.pick(pool)) : invent(rng, day, 'builder'));
    if (rng.next() < rate * 0.4 && c.features.length) c.features.splice(rng.int(c.features.length), 1);
    if (rng.next() < rate * 0.6 && c.features.length) { const i = rng.int(c.features.length); c.features[i] = retune(c.features[i], rng); }
    return c;
  };
  return {
    random: (rng) => mutate(master, rng, 1),
    mutate,
    crossover: (a, b, rng) => { const c = structuredClone(a); for (const k of Object.keys(TUNING_LIMITS) as (keyof Tuning)[]) if (rng.next() < 0.5) (c.tuning[k] as number) = b.tuning[k]; for (const f of b.features) if (rng.next() < 0.5) putFeature(c, structuredClone(f)); return c; },
    distance: genomeDistance,
    evaluate: (g) => evalVersion(g, TRAIN_SEEDS).fun,
  };
}

function snapshot<G>(st: EvoState<G>, toVec: (g: G) => number[], bornMin: number): AgentView[] {
  return st.population.map((g, i) => ({ id: st.ids?.[i] ?? i, vec: toVec(g), fitness: st.fitness[i] ?? 0, born: (st.ids?.[i] ?? 0) >= bornMin }));
}
const push = <T,>(arr: T[], items: T[], max: number) => { arr.push(...items); if (arr.length > max) arr.splice(0, arr.length - max); };

export function createWorld(seed: number, date: string, cfg: WorldConfig = DEFAULT_WORLD_CONFIG): WorldState {
  const w = {
    schema: 1, seed, cfg, day: 1, date, build: 0, master: structuredClone(MASTER_BASE), masterFun: evalVersion(MASTER_BASE, HELDOUT_SEEDS).fun,
    probes: initEvo(probeOps(makeSuite(seed + 500), seed + 900), evoCfg(cfg.probePop, 0.3), seed + 1),
    builders: initEvo(builderOps(MASTER_BASE, [], 1), evoCfg(cfg.builderPop, 0.5), seed + 2),
    today: [], ideas: {}, chronicle: [], culls: [], humanRuns: [], humanVotes: {}, history: [], findings: [], lastTick: null,
  } as WorldState;
  openDay(w); return w;
}

/** Evolve probes and builders, then publish today's 5 versions: the control (master) plus 4 diverse, vetted challengers. */
export function openDay(w: WorldState): void {
  const cfg = w.cfg, day = w.day, suite = makeSuite(w.seed + 500);
  // 1. Probes evolve against the defect suite; culls are recorded with causes.
  const pOps = probeOps(suite, w.seed + 900), pBefore = snapshot(w.probes, (g) => g, 0), pStartId = w.probes.nextId ?? 0;
  const pCulled: number[] = [];
  for (let i = 0; i < cfg.gensPerDay; i++) {
    w.probes = stepEvo(w.probes, pOps, evoCfg(cfg.probePop, 0.3));
    for (const c of w.probes.culls ?? []) { pCulled.push(c.id); push(w.culls, [{ day, chamber: 'probe', who: `Probe-${c.id}`, reason: probeReason(c, suite, w.seed) }], 300); }
  }
  // 2. Builders evolve (invalid candidates score -1 and are culled by the Instructor's hard checks).
  const pool = Object.values(w.ideas).filter((i) => i.status !== 'rejected').map((i) => i.feature);
  const bOps = builderOps(w.master, pool, day), bBefore = snapshot(w.builders, vec, 0), bStartId = w.builders.nextId ?? 0, bCulled: number[] = [];
  w.builders.population[0] = structuredClone(w.master);
  for (let i = 0; i < cfg.gensPerDay; i++) {
    w.builders = stepEvo(w.builders, bOps, evoCfg(cfg.builderPop, 0.5));
    for (const c of w.builders.culls ?? []) { bCulled.push(c.id); push(w.culls, [{ day, chamber: 'builder', who: `Builder-${c.id}`, reason: builderReason(c, w.builders.population.length) }], 300); }
  }
  const scored = w.builders.population.map((g, i) => ({ g, id: w.builders.ids?.[i] ?? i, r: evalVersion(g, TRAIN_SEEDS) })).filter((x) => x.r.valid).sort((a, b) => b.r.fun - a.r.fun);
  w.builders.fitness = w.builders.population.map((g) => scored.find((s) => s.g === g)?.r.fun ?? -1);
  // 3. Pick challengers: diverse, distinct from the master, no known defects.
  const chosen: typeof scored = [], bestProbe = w.probes.best?.genome ?? w.probes.population[0], probeId = w.probes.ids?.[w.probes.population.indexOf(bestProbe)] ?? -1;
  const dayFindings: ProbeFinding[] = [];
  for (const slack of [0.12, 0.05, 0]) for (const cand of scored) {
    if (chosen.length >= 4) break; if (chosen.includes(cand) || genomeDistance(cand.g, w.master) <= 0.02) continue;
    if (chosen.some((c) => genomeDistance(c.g, cand.g) < slack)) continue;
    const c = caseOf(cand.g, w.seed + day * 13), tr = truth(c), claims = investigate(c, bestProbe, w.seed + day, 3);
    for (const cl of claims) dayFindings.push({ day, versionId: `cand-${cand.id}`, kind: cl.kind, verified: tr.includes(cl.kind), evidence: cl.evidence, probe: probeId });
    const bad = claims.find((cl) => tr.includes(cl.kind)); if (bad) { push(w.culls, [{ day, chamber: 'instructor', who: `Builder-${cand.id}`, reason: `quarantined: Probe-${probeId} verified "${bad.kind}" (${bad.evidence})` }], 300); continue; }
    chosen.push(cand);
  }
  for (let tries = 0; chosen.length < 4 && tries < 40; tries++) { const g = bOps.mutate(w.master, new Rng(w.seed + day * 7 + tries), 0.9), r = evalVersion(g, TRAIN_SEEDS); if (r.valid && genomeDistance(g, w.master) > 0.02) chosen.push({ g, id: -1, r }); }
  const ctl = evalVersion(w.master, TRAIN_SEEDS).fun;
  w.today = [{ id: `d${day}A`, label: 'A', genome: structuredClone(w.master), role: 'control', parentId: w.master.id, agent: -1, fun: ctl }, ...chosen.slice(0, 4).map((c, i): Version => ({ id: `d${day}${LABELS[i + 1]}`, label: LABELS[i + 1], genome: { ...structuredClone(c.g), id: `d${day}${LABELS[i + 1]}` }, role: 'challenger', parentId: w.master.id, agent: c.id, fun: c.r.fun }))];
  push(w.findings, dayFindings, 40);
  // 4. Register every feature in today's versions as an idea (with its inventor).
  for (const v of w.today) for (const f of v.genome.features) {
    const ex = w.ideas[f.id]; if (ex) { ex.appearances++; continue; }
    const author = v.agent >= 0 ? `Builder-${v.agent}` : 'Master';
    w.ideas[f.id] = { fid: f.id, feature: { ...f, author }, firstDay: day, author, status: w.master.features.some((m) => m.id === f.id) ? 'in-master' : 'new', ablation: null, appearances: 1, note: describe(f) };
  }
  w.lastTick = { day, probes: { before: pBefore, after: snapshot(w.probes, (g) => g, pStartId), culled: pCulled }, builders: { before: bBefore, after: snapshot(w.builders, vec, bStartId), culled: bCulled } };
}

function probeReason(c: Cull<number[]>, suite: ReturnType<typeof makeSuite>, seed: number): string {
  const d = probeDetail(c.genome, suite, seed + 900);
  if (d.fp >= 2) return `false-alarm spam: ${d.fp} reports the oracle refuted (score ${c.fitness.toFixed(2)})`;
  if (d.tp === 0) return `found nothing: missed ${d.fn} real defect(s)`;
  if (c.nearest < 0.12) return `near-duplicate of Probe-${c.nearestId}: no new strategy`;
  return `outcompeted (rank ${c.rank + 1}): ${d.tp} true / ${d.fp} false reports, ${d.fn} missed`;
}
function builderReason(c: Cull<GameGenome>, n: number): string {
  if (c.fitness <= -1) { const v = hardChecks(c.genome, TRAIN_SEEDS); return `rejected by Instructor: ${v[0] ?? 'hard constraint'}`; }
  if (c.nearest < 0.08) return `redundant clone of Builder-${c.nearestId}`;
  return `outcompeted: fun ${c.fitness.toFixed(2)}, rank ${c.rank + 1}/${n}`;
}

const without = (g: GameGenome, fid: string): GameGenome => ({ ...structuredClone(g), features: g.features.filter((f) => f.id !== fid) });
const withFeature = (g: GameGenome, f: FeatureSpec): GameGenome => { const c = structuredClone(g); putFeature(c, structuredClone(f)); return c; };
const tuningDiff = (a: Tuning, b: Tuning) => (Object.keys(a) as (keyof Tuning)[]).filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k]} → ${b[k]}`);
const sg = (x: number) => 1 / (1 + Math.exp(-x));

export interface DayInput { runs: HumanRun[]; vote?: string }
/** Play the day with simulated players (plus any real human runs), pick the most popular version, verify, merge best ideas, publish patch notes and open the next day. */
export function closeDay(w: WorldState, human: DayInput = { runs: [], vote: w.humanVotes[w.day] }): void {
  const day = w.day, V = w.today, rng = new Rng(w.seed * 7 + day), cfg = w.cfg;
  const wins = V.map(() => 0), matches = V.map(() => 0), ret = V.map(() => 0), plays = V.map(() => 0);
  for (let i = 0; i < cfg.players; i++) {
    const base = PERSONAS[i % PERSONAS.length], p = { ...base, skill: clamp(base.skill + rng.gauss() * 0.07, 0.2, 1), explore: clamp(base.explore + rng.gauss() * 0.15, 0.1, 1.6), caution: clamp(base.caution + rng.gauss() * 0.15, 0, 2), patience: base.patience + Math.round(rng.gauss() * 10) };
    const a = rng.int(V.length); let b = rng.int(V.length - 1); if (b >= a) b++;
    const ua = utility(p, playRun(V[a].genome, p, w.seed + day * 100 + i, rng)), ub = utility(p, playRun(V[b].genome, p, w.seed + day * 100 + i + 50, rng));
    matches[a]++; matches[b]++; plays[a]++; plays[b]++; ret[a] += sg(6 * (ua - 0.4)); ret[b] += sg(6 * (ub - 0.4));
    if (ua > ub) wins[a]++; else if (ub > ua) wins[b]++; else { wins[a] += 0.5; wins[b] += 0.5; }
  }
  const hr = human.runs, wH = hr.length ? Math.min(0.6, 0.2 + 0.1 * hr.length) : 0;
  const voteTotal = human.vote ? 1 : 0;
  const pop = V.map((v, i) => {
    const mine = hr.filter((r) => r.versionId === v.id), rating = mine.length ? (mine.reduce((s, r) => s + r.rating, 0) / mine.length + 1) / 2 : 0.5;
    const humanScore = 0.5 * rating + 0.5 * (voteTotal ? (human.vote === v.id ? 1 : 0) : 1 / V.length), synth = 0.7 * (wins[i] / Math.max(1, matches[i])) + 0.3 * (ret[i] / Math.max(1, plays[i]));
    return (1 - wH) * synth + wH * humanScore;
  });
  const wi = pop.indexOf(Math.max(...pop)), winner = V[wi], ctl = V[0], lines: string[] = [], before = versionLabel(w.build);
  const note: PatchNote = { day, date: w.date, before, after: before, changed: false, lines, table: [], plays: cfg.players + hr.length };
  let changed = false;
  // Promotion: the popular version must also survive the Instructor's held-out and regression checks.
  const heldCtl = evalVersion(w.master, HELDOUT_SEEDS).fun;
  if (winner.role === 'challenger') {
    const hw = evalVersion(winner.genome, HELDOUT_SEEDS), reg = regressionFailures(winner.genome);
    if (reg.length) { lines.push(`Version ${winner.label} won the vote but was blocked: ${reg[0]}.`); push(w.culls, [{ day, chamber: 'instructor', who: `Version ${winner.label}`, reason: `blocked from master: ${reg[0]}` }], 300); }
    else if (hw.fun < heldCtl - 0.01) { lines.push(`Version ${winner.label} won the vote but regressed on held-out floors (${hw.fun.toFixed(3)} vs ${heldCtl.toFixed(3)}); the master is unchanged.`); push(w.culls, [{ day, chamber: 'instructor', who: `Version ${winner.label}`, reason: `blocked: held-out fun ${hw.fun.toFixed(3)} < master ${heldCtl.toFixed(3)} (possible overfitting)` }], 300); }
    else {
      const old = w.master; w.build++; w.master = { ...structuredClone(winner.genome), id: `master-b${w.build}` }; changed = true;
      const addF = winner.genome.features.filter((f) => !old.features.some((o) => o.id === f.id)).map((f) => f.name), dropF = old.features.filter((o) => !winner.genome.features.some((f) => f.id === o.id)).map((f) => f.name);
      lines.push(`Version ${winner.label} became the new master (popularity ${(pop[wi] * 100).toFixed(0)}%, held-out fun ${hw.fun.toFixed(3)} vs ${heldCtl.toFixed(3)}).`);
      if (addF.length) lines.push(`Added: ${addF.join(', ')}.`); if (dropF.length) lines.push(`Removed: ${dropF.join(', ')}.`);
      const td = tuningDiff(old.tuning, w.master.tuning); if (td.length) lines.push(`Tuning: ${td.join('; ')}.`);
    }
  } else lines.push(`The current master (A) was the most popular (${(pop[0] * 100).toFixed(0)}%), so no challenger replaced it.`);
  // Idea harvesting: measure each idea's marginal value on held-out floors and merge the best ones into the master.
  const seen = new Map<string, { f: FeatureSpec; from: Version }>(); for (const v of V) for (const f of v.genome.features) if (!seen.has(f.id)) seen.set(f.id, { f, from: v });
  const scoredIdeas = [...seen.values()].map(({ f, from }) => ({ f, from, delta: evalVersion(from.genome, HELDOUT_SEEDS).fun - evalVersion(without(from.genome, f.id), HELDOUT_SEEDS).fun }));
  for (const s of scoredIdeas) { const id = w.ideas[s.f.id]; if (id) { id.ablation = Math.round(s.delta * 1000) / 1000; if (id.status === 'new') id.status = 'shelved'; id.note = `${describe(s.f)} Held-out effect when added: ${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(3)}.`; } }
  let merged = 0; let masterFun = evalVersion(w.master, HELDOUT_SEEDS).fun;
  for (const s of scoredIdeas.filter((x) => x.delta > 0.01 && !w.master.features.some((m) => m.id === x.f.id)).sort((a, b) => b.delta - a.delta)) {
    if (merged >= 2) break; const cand = withFeature(w.master, s.f); cand.id = `master-b${w.build + 1}`;
    if (validateGenome(cand).length || regressionFailures(cand).length) { w.ideas[s.f.id].status = 'rejected'; w.ideas[s.f.id].note += ' Merge rejected by the Instructor (constraints).'; continue; }
    const f2 = evalVersion(cand, HELDOUT_SEEDS).fun;
    if (f2 > masterFun + 0.01) { w.build++; w.master = cand; masterFun = f2; merged++; changed = true; w.ideas[s.f.id].status = 'in-master'; lines.push(`Idea merged: ${s.f.name} (by ${w.ideas[s.f.id].author}) lifted held-out fun to ${f2.toFixed(3)} (+${s.delta.toFixed(3)} measured on its own).`); }
    else { w.ideas[s.f.id].status = 'shelved'; w.ideas[s.f.id].note += ' Not merged: no gain on top of the current master.'; }
  }
  for (const i of Object.values(w.ideas)) if (w.master.features.some((f) => f.id === i.fid)) i.status = 'in-master';
  if (!lines.length) lines.push('No change.');
  lines.push(`${cfg.players} simulated players${hr.length ? ` and ${hr.length} real run(s)` : ''} played today's five versions.`);
  note.after = versionLabel(w.build); note.changed = changed;
  note.table = V.map((v, i) => ({ label: v.label, id: v.id, features: v.genome.features.map((f) => f.name), fun: v.fun, popularity: pop[i], humanRuns: hr.filter((r) => r.versionId === v.id).length, note: v.role === 'control' ? 'control' : undefined }));
  push(w.chronicle, [note], 400);
  push(w.history, [{ day, masterFun, winnerPopularity: Math.max(...pop), ideas: Object.keys(w.ideas).length, masterFeatures: w.master.features.length, changed }], 400);
  w.masterFun = masterFun; w.day++; w.date = addDays(w.date, 1);
  void ctl; openDay(w);
}

export const humanInputFor = (w: WorldState): DayInput => ({ runs: w.humanRuns.filter((r) => r.day === w.day), vote: w.humanVotes[w.day] });
export function advanceDays(w: WorldState, n: number, onDay?: (w: WorldState) => void): WorldState {
  const c = structuredClone(w);
  for (let i = 0; i < n; i++) { closeDay(c, humanInputFor(c)); onDay?.(c); }
  c.humanRuns = c.humanRuns.filter((r) => r.day >= c.day - 30); return c;
}
export { PROBE_LEN };
