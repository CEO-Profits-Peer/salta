import { Rng } from '../engine/rng';
import { initEvo, stepEvo, type EvoConfig, type EvoOps, type EvoState } from '../engine/evolution/evolution';
import { createSim } from './world';
import { modCmd, stepSim } from './sim';
import { STATS, TECHS, YEAR, type BuildSpec, type CreatureSpec, type Effect, type Habitat, type QuirkSpec, type Stat, type TechId } from './types';

export type SpecType = 'creature' | 'building' | 'quirk';
export type Spec = { t: 'creature'; s: CreatureSpec } | { t: 'building'; s: BuildSpec } | { t: 'quirk'; s: QuirkSpec };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const st = (x: number, k: number) => Math.round(x / k) * k;
const uid = (r: Rng) => Math.floor(r.next() * 2 ** 31).toString(36);
const ADJ = ['Dusk', 'Ember', 'Hollow', 'Pale', 'Gilded', 'Marrow', 'Silent', 'Wild', 'Argent', 'Umber', 'Cinder', 'Lumen', 'Verdant', 'Frost', 'Amber', 'Swift', 'Stout', 'Keen'];
const PREY = ['Hare', 'Elk', 'Goat', 'Moa', 'Tapir', 'Yak', 'Ibex', 'Capybara', 'Gazelle', 'Aurochs', 'Pika'], PRED = ['Lynx', 'Panther', 'Jackal', 'Wolverine', 'Raptor', 'Cougar', 'Hyena', 'Direwolf', 'Marten'];
const EFFECTS: Effect[] = ['shelter', 'larder', 'infirmary', 'orchard', 'beacon', 'shrine', 'forge'];
const BNAME: Record<Effect, string[]> = { shelter: ['Longhouse', 'Lodge', 'Roundhouse'], larder: ['Cellar', 'Silo', 'Cache'], infirmary: ['Healing Hut', 'Herb Lodge', 'Sickhouse'], orchard: ['Orchard', 'Grove', 'Garden'], beacon: ['Watchfire', 'Signal Pyre', 'Lookout'], shrine: ['Shrine', 'Totem', 'Moot Hall'], forge: ['Forge', 'Smithy', 'Kiln'] };
const GLYPHS: Record<Effect, string> = { shelter: '⌂', larder: '▤', infirmary: '✚', orchard: '❦', beacon: '△', shrine: '✧', forge: '⚒' };
const HABS: Habitat[] = ['grass', 'forest', 'rock', 'sand', 'any'];
const STAT_IDS = STATS.map((s) => s.id), statLabel = (id: Stat) => STATS.find((s) => s.id === id)!.label;
const TECH_IDS = Object.keys(TECHS) as TechId[];

export function describeSpec(sp: Spec): string {
  if (sp.t === 'creature') { const c = sp.s; return c.role === 'prey' ? `A ${c.hp > 1.5 ? 'large' : 'small'} grazer of the ${c.habitat === 'any' ? 'whole land' : c.habitat}. Herds of ~${c.herd}, ${c.meat} food per kill${c.hp > 1.5 ? ', needs a hunting party' : ''}.` : `A predator of the ${c.habitat === 'any' ? 'whole land' : c.habitat} (${c.hp} hp, bites for ${c.dmg}). Stalks lone settlers within ${c.aggression} tiles. ${c.meat} food if felled.`; }
  if (sp.t === 'building') { const b = sp.s, e: Record<Effect, string> = { shelter: `+${b.power} capacity for the village`, larder: `food keeps ${b.power * 12}% longer and +${b.power * 20} stockpile`, infirmary: 'sick settlers within 6 tiles recover faster and suffer half', orchard: `grows ${b.power} food every 40 ticks (max 2)`, beacon: `earlier warning (+${b.power * 2} tiles) and predators keep ${2 + b.power} tiles away`, shrine: `+${b.power * 8}% births and friendlier neighbours`, forge: 'workshop crafts double tools and spears' }; return `${e[b.effect]}. Costs ${b.wood} wood${b.stone ? ` + ${b.stone} stone` : ''}${b.needs ? `, needs ${TECHS[b.needs].name}` : ''}.`; }
  const q = sp.s; return `Heritable trait: ${statLabel(q.plus.stat)} (+${Math.round(q.plus.amt * 100)}%) but the cost is that it ${statLabel(q.minus.stat).replace('needs less', 'needs more').replace('feels the cold less', 'feels the cold more').replace('walks faster', 'walks slower').replace('gathers more', 'gathers less').replace('fights harder', 'fights worse').replace('resists fever', 'catches fever easier').replace('has more children', 'has fewer children').replace('invents more', 'invents less')} (−${Math.round(q.minus.amt * 100)}%).`;
}
export function generate(t: SpecType, r: Rng): Spec {
  if (t === 'creature') {
    const prey = r.next() < 0.65, hp = prey ? st(r.range(0.5, 5), 0.5) : st(r.range(2, 8), 0.5), name = `${r.pick(ADJ)} ${r.pick(prey ? PREY : PRED)}`;
    return { t, s: { id: uid(r), name, role: prey ? 'prey' : 'predator', hp, every: 2 + r.int(5), meat: prey ? clamp(Math.round(hp * 5 + r.range(-2, 3)), 2, 30) : clamp(Math.round(hp * 4), 3, 30), dmg: prey ? 0 : st(r.range(0.05, 0.2), 0.01), habitat: r.pick(HABS), herd: prey ? 3 + r.int(10) : 1 + r.int(4), hue: r.int(360), aggression: 3 + r.int(6), desc: '' } };
  }
  if (t === 'building') {
    const effect = r.pick(EFFECTS), power = effect === 'shelter' ? 2 + r.int(3) : effect === 'orchard' ? 1 + r.int(3) : 1 + r.int(3), base = 6 + 3 * power;
    return { t, s: { id: uid(r), name: `${r.pick(ADJ)} ${r.pick(BNAME[effect])}`, glyph: GLYPHS[effect], wood: base + r.int(5), stone: r.int(5), needs: r.next() < 0.3 ? r.pick(TECH_IDS) : undefined, effect, power, desc: '' } };
  }
  const a = r.pick(STAT_IDS), b = r.pick(STAT_IDS.filter((x) => x !== a)), pa = st(r.range(0.08, 0.3), 0.02);
  return { t, s: { id: uid(r), name: `${r.pick(ADJ)} ${r.pick(['Blood', 'Gift', 'Way', 'Heart', 'Mind', 'Hands', 'Gait', 'Spirit'])}`, plus: { stat: a, amt: pa }, minus: { stat: b, amt: clamp(st(pa + r.range(-0.04, 0.12), 0.02), 0.05, 0.3) }, desc: '' } };
}
/** The Instructor: hard constraints a proposal must satisfy before it is simulated at all. */
export function violations(sp: Spec): string[] {
  const v: string[] = [], bad = (m: string) => v.push(m);
  if (!sp.s.name || sp.s.name.length > 40) bad('invalid name');
  if (sp.t === 'creature') { const c = sp.s; if (c.hp < 0.5 || c.hp > 8) bad('hp out of range'); if (c.every < 2 || c.every > 6) bad('speed out of range'); if (c.meat < 1 || c.meat > 30 || c.meat > 6 * c.hp + 6) bad('meat yield too generous for its size'); if (c.dmg < 0 || c.dmg > 0.2) bad('bite too strong'); if (c.herd < 1 || c.herd > 12 || (c.role === 'predator' && c.herd > 4)) bad('herd too large'); if (c.role === 'predator' && c.hp < 1.5) bad('predator too frail'); if (c.aggression < 3 || c.aggression > 8) bad('aggression out of range'); }
  else if (sp.t === 'building') { const b = sp.s; if (!EFFECTS.includes(b.effect)) bad('unknown effect'); if (b.power < 1 || b.power > 4 || (b.effect !== 'shelter' && b.power > 3)) bad('power out of range'); if (b.wood < 4 || b.wood > 20 || b.stone < 0 || b.stone > 10) bad('cost out of range'); if (b.wood + b.stone < 6 + 3 * b.power) bad('too cheap for its power'); if (b.needs && !TECH_IDS.includes(b.needs)) bad('unknown tech'); }
  else { const q = sp.s; if (q.plus.stat === q.minus.stat) bad('benefit and cost hit the same stat'); if (!STAT_IDS.includes(q.plus.stat) || !STAT_IDS.includes(q.minus.stat)) bad('unknown stat'); for (const a of [q.plus.amt, q.minus.amt]) if (a < 0.05 || a > 0.3) bad('effect size out of range'); if (q.plus.amt > q.minus.amt + 0.1) bad('benefit not paid for by the drawback'); }
  return v;
}
export function mutate(sp: Spec, r: Rng, rate: number): Spec {
  const c = structuredClone(sp), j = (x: number, k: number, lo: number, hi: number, step: number) => (r.next() < rate ? clamp(st(x + r.gauss() * k, step), lo, hi) : x);
  c.s.id = uid(r); if (r.next() < rate * 0.3) c.s.name = generate(sp.t, r).s.name;
  if (c.t === 'creature') { const s = c.s; s.hp = j(s.hp, 1, 0.5, 8, 0.5); s.every = Math.round(j(s.every, 1, 2, 6, 1)); s.meat = Math.round(clamp(j(s.meat, 4, 1, 30, 1), 1, 6 * s.hp + 6)); s.dmg = s.role === 'prey' ? 0 : j(s.dmg, 0.04, 0.03, 0.2, 0.01); s.herd = Math.round(j(s.herd, 2, 1, s.role === 'predator' ? 4 : 12, 1)); s.aggression = Math.round(j(s.aggression, 1.5, 3, 8, 1)); if (r.next() < rate * 0.2) s.habitat = r.pick(HABS); if (r.next() < rate * 0.3) s.hue = r.int(360); if (s.role === 'predator' && s.hp < 1.5) s.hp = 2; }
  else if (c.t === 'building') { const s = c.s; s.power = Math.round(j(s.power, 1, 1, s.effect === 'shelter' ? 4 : 3, 1)); s.wood = Math.round(j(s.wood, 3, 4, 20, 1)); s.stone = Math.round(j(s.stone, 2, 0, 10, 1)); if (s.wood + s.stone < 6 + 3 * s.power) s.wood = 6 + 3 * s.power - s.stone; if (r.next() < rate * 0.15) s.needs = r.next() < 0.5 ? undefined : r.pick(TECH_IDS); }
  else { const s = c.s; s.plus.amt = j(s.plus.amt, 0.05, 0.05, 0.3, 0.02); s.minus.amt = j(s.minus.amt, 0.05, 0.05, 0.3, 0.02); if (r.next() < rate * 0.2) { s.minus.stat = r.pick(STAT_IDS.filter((x) => x !== s.plus.stat)); } if (r.next() < rate * 0.15) { s.plus.stat = r.pick(STAT_IDS.filter((x) => x !== s.minus.stat)); } }
  return c;
}
const vec = (sp: Spec): number[] => sp.t === 'creature' ? [sp.s.role === 'prey' ? 0 : 1, sp.s.hp / 8, sp.s.every / 6, sp.s.meat / 30, sp.s.dmg / 0.2, sp.s.herd / 12, HABS.indexOf(sp.s.habitat) / 4] : sp.t === 'building' ? [EFFECTS.indexOf(sp.s.effect) / 6, sp.s.power / 4, sp.s.wood / 20, sp.s.stone / 10] : [STAT_IDS.indexOf(sp.s.plus.stat) / 9, STAT_IDS.indexOf(sp.s.minus.stat) / 9, sp.s.plus.amt / 0.3, sp.s.minus.amt / 0.3];
export const specDistance = (a: Spec, b: Spec) => { const x = vec(a), y = vec(b); return Math.sqrt(x.reduce((s, v, i) => s + (v - (y[i] ?? 0)) ** 2, 0) / x.length); };

export interface EvalInfo { score: number; approved: boolean; reasons: string[]; popRatio: number; uptake: number; balance: number; diversity: number; novelty: number }
interface M { pop: number; fell: number; kinds: number; uptake: number; ok: boolean }
const ctrlCache = new Map<string, M>();
function runWorld(sp: Spec | null, seed: number, ticks: number): M {
  const sim = createSim(seed); if (sp) modCmd(sim, { k: 'mod', op: 'adopt', kind: sp.t, spec: sp.s } as never); stepSim(sim, ticks);
  const ok = sim.settlers.every((s) => Number.isFinite(s.health) && s.hunger >= 0 && s.hunger <= 1) && sim.villages.every((v) => v.stock.food >= 0 && v.stock.wood >= 0 && v.stock.stone >= 0);
  let uptake = 0;
  if (sp?.t === 'creature') { const alive = sim.fauna.filter((a) => a.k === 'm:' + sp.s.id).length, hit = sim.events.some((e) => e.text.includes(sp.s.name)) ? 0.3 : 0; uptake = clamp(alive / Math.max(2, sp.s.herd * 0.6), 0, 1) * 0.7 + hit; }
  else if (sp?.t === 'building') { const bs = sim.villages.flatMap((v) => v.buildings.filter((b) => b.type === 'm:' + sp.s.id)); uptake = bs.some((b) => b.built) ? 1 : bs.length ? 0.4 : 0; }
  else if (sp?.t === 'quirk') { const ad = sim.settlers.filter((s) => s.age >= 15360), f = ad.length ? ad.filter((s) => s.quirks.includes(sp.s.id)).length / ad.length : 0; uptake = f < 0.02 ? 0 : f > 0.9 ? 0.2 : clamp(1 - Math.abs(f - 0.3) / 0.5, 0, 1); }
  return { pop: sim.settlers.length, fell: sim.totals.fell, kinds: new Set(sim.events.map((e) => e.k)).size, uptake: clamp(uptake, 0, 1), ok };
}
/** Probes: simulate one in-world year with the proposal against an identical control world and judge the difference. */
export function evaluate(sp: Spec, library: Spec[], seed = 11, ticks = YEAR): EvalInfo {
  const v = violations(sp); const none: EvalInfo = { score: -1, approved: false, reasons: v, popRatio: 0, uptake: 0, balance: 0, diversity: 0, novelty: 0 }; if (v.length) return none;
  const key = `${seed}:${ticks}`; let ctrl = ctrlCache.get(key); if (!ctrl) { ctrl = runWorld(null, seed, ticks); ctrlCache.set(key, ctrl); }
  const m = runWorld(sp, seed, ticks), popRatio = m.pop / Math.max(1, ctrl.pop), same = library.filter((l) => l.t === sp.t && l.s.id !== sp.s.id);
  const novelty = same.length ? clamp(Math.min(...same.map((l) => specDistance(sp, l))) * 3, 0, 1) : 1, balance = clamp(1 - Math.abs(popRatio - 1) / 0.5, 0, 1), diversity = clamp(m.kinds / Math.max(1, ctrl.kinds), 0, 1), reasons: string[] = [];
  if (!m.ok) reasons.push('broke a world invariant (negative stock or invalid settler)'); if (popRatio < 0.55) reasons.push(`destabilises the world (population ${Math.round((popRatio - 1) * 100)}% vs control)`); if (popRatio > 1.6) reasons.push(`overpowered (population +${Math.round((popRatio - 1) * 100)}% vs control)`); if (m.uptake < 0.1) reasons.push('never used: nothing in the world picked it up');
  const score = reasons.length ? -1 : 0.35 * m.uptake + 0.3 * balance + 0.15 * diversity + 0.2 * novelty;
  return { score, approved: !reasons.length && score >= 0.4, reasons, popRatio, uptake: m.uptake, balance, diversity, novelty };
}

export interface Proposal { id: string; spec: Spec; info: EvalInfo; gen: number; agent: number; rating: number; created: number }
export interface LabCull { tick: number; type: SpecType; who: string; reason: string }
export interface LabState { v: 1; seed: number; tick: number; pops: Partial<Record<SpecType, EvoState<Spec>>>; library: Proposal[]; culls: LabCull[] }
export const newLab = (seed: number): LabState => ({ v: 1, seed, tick: 0, pops: {}, library: [], culls: [] });
const CFG: EvoConfig = { popSize: 6, eliteCount: 1, survivalRate: 0.5, tournamentSize: 2, mutationRate: 0.5, diversityWeight: 0.15 };

/** One generation for one content type: AI Builders propose, the Instructor and Probes judge, culls are recorded, ratings steer survival. */
export function labTick(prev: LabState, type: SpecType, progress?: (msg: string, done: number, total: number) => void): LabState {
  const lab = structuredClone(prev), rng = new Rng(lab.seed + lab.tick * 101 + type.length);
  const lib = lab.library.map((p) => p.spec), infos = new Map<string, EvalInfo>();
  const ops: EvoOps<Spec> = { random: (r) => generate(type, r), mutate, crossover: (a, b, r) => { const c = structuredClone(a); c.s.id = uid(r); const x = c.s as unknown as Record<string, number>, y = b.s as unknown as Record<string, number>; for (const k of Object.keys(x)) if (typeof x[k] === 'number' && typeof y[k] === 'number' && r.next() < 0.5) x[k] = y[k]; return c; }, distance: specDistance,
    evaluate: (g) => { const f = infos.get(g.s.id)?.score ?? -1, rated = lab.library.find((p) => p.id === g.s.id); return f < 0 ? f : f + (rated?.rating ? 0.3 * ((rated.rating - 3) / 2) : 0); } };
  const pop = lab.pops[type] ?? initEvo(ops, CFG, lab.seed + type.length * 7 + 1);
  pop.population.forEach((g, i) => { progress?.(`Simulating ${g.s.name} (${type})`, i, pop.population.length); infos.set(g.s.id, evaluate(g, lib)); });
  const gen = pop.generation; const next = stepEvo(pop, ops, CFG); lab.pops[type] = next;
  pop.population.forEach((g, i) => { const info = infos.get(g.s.id)!, id = pop.ids?.[i] ?? i; if (!lab.library.some((p) => p.id === g.s.id)) lab.library.push({ id: g.s.id, spec: { ...g, s: { ...g.s, desc: describeSpec(g) } } as Spec, info, gen, agent: id, rating: 0, created: lab.tick }); });
  const best = Math.max(...pop.population.map((g) => infos.get(g.s.id)!.score));
  for (const c of next.culls ?? []) { const info = infos.get(c.genome.s.id); if (!info) continue; const reason = info.reasons.length ? `${violations(c.genome).length ? 'rejected by Instructor: ' : 'Probe verdict: '}${info.reasons[0]}` : `outcompeted (score ${info.score.toFixed(2)} vs best ${best.toFixed(2)})`; lab.culls.push({ tick: lab.tick, type, who: `Builder-${c.id}: ${c.genome.s.name}`, reason }); }
  if (lab.culls.length > 200) lab.culls.splice(0, lab.culls.length - 200);
  if (lab.library.length > 80) { const keep = lab.library.filter((p) => p.rating > 0 || p.info.approved); const rest = lab.library.filter((p) => !keep.includes(p)).slice(-30); lab.library = [...keep, ...rest].slice(-80); }
  lab.tick++; return lab;
}
export const proposalScore = (p: Proposal) => (p.rating ? 0.6 * Math.max(0, p.info.score) + 0.4 * (p.rating / 5) : Math.max(0, p.info.score));
