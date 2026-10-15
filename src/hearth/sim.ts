import { Rng } from '../engine/rng';
import { ADULT, BUILDINGS, DAY, DOCTRINE_KEYS, GENES, T, TECHS, W, H, YEAR, type Animal, type BType, type Cause, type DayStat, type Doctrine, type Genes, type Good, type Job, type Settler, type Sim, type TechId, type Village, type Wolf } from './types';
import { buildingAt, idx, inB, isNight, makeName, mkSettler, mkVillage, newGenes, seasonOf, DOCTRINES } from './world';

const HUNGER = 0.0022, THIRST = 0.0016, MOVE = 3, COLD = [0.0004, 0, 0.0004, 0.0022], BS = 16;
const WORK: Partial<Record<Job, number>> = { drink: 3, eat: 2, forage: 5, farm: 6, wood: 6, stone: 8, build: 5, deposit: 2, warm: 30, craft: 8, trade: 2, fish: 6, plant: 6 };
const BWORK: Record<BType, number> = { hearth: 1, hut: 40, farm: 30, well: 30, granary: 50, palisade: 60, workshop: 45, smokehouse: 40, watchtower: 55, market: 60 };
const CODE: Record<BType, number> = { hearth: 1, hut: 2, farm: 3, well: 4, granary: 5, palisade: 6, workshop: 7, smokehouse: 8, watchtower: 9, market: 10 };
const GOODVAL: Record<Good, number> = { food: 1, wood: 1, stone: 1.4, tools: 5 };
const MEAT: Record<string, number> = { deer: 8, rabbit: 3, boar: 16, bear: 30, wolf: 6 };
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const md = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);
const D4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const stamp = new Int32Array(W * H), par = new Int32Array(W * H), dist = new Int16Array(W * H), queue = new Int32Array(W * H); let cur = 0;
let POP: number[] = [];
const has = (v: Village, t: TechId) => v.techs.includes(t);
const canLearn = (v: Village, t: TechId) => !has(v, t) && TECHS[t].needs.every((n) => has(v, n));
const built = (v: Village, t: BType) => v.buildings.some((b) => b.type === t && b.built);
const relKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const relOf = (sim: Sim, a: number, b: number) => sim.rel[relKey(a, b)] ?? 0;
const addRel = (sim: Sim, a: number, b: number, d: number) => { const k = relKey(a, b); sim.rel[k] = clamp((sim.rel[k] ?? 0) + d, -1, 1); };

export function ev(sim: Sim, k: string, text: string, x?: number, y?: number, sid?: number) { sim.events.push({ t: sim.tick, k, text, x, y, sid }); if (sim.events.length > 400) sim.events.splice(0, sim.events.length - 400); }
const bio = (s: Settler, sim: Sim, text: string) => { if (s.bio.length < 40) s.bio.push(`Y${(sim.tick / YEAR).toFixed(1)}: ${text}`); };
function learn(sim: Sim, v: Village, t: TechId, why: string) { if (!canLearn(v, t)) return false; v.techs.push(t); sim.totals.inventions++; ev(sim, 'invent', `${v.name} ${why}: ${TECHS[t].name}`, v.hx, v.hy); return true; }

/** BFS to the nearest tile satisfying pred. Returns the tile indices to walk (empty = already there) or null. */
function bfs(sim: Sim, sx: number, sy: number, maxR: number, pred: (i: number) => boolean, block?: (i: number) => boolean): number[] | null {
  cur++; let h = 0, t = 0; const s0 = idx(sx, sy); queue[t++] = s0; stamp[s0] = cur; par[s0] = -1; dist[s0] = 0;
  while (h < t) {
    const c = queue[h++]; if (pred(c)) { const out: number[] = []; for (let i = c; i !== s0; i = par[i]) out.push(i); return out.reverse(); }
    if (dist[c] >= maxR) continue; const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of D4) { const nx = cx + dx, ny = cy + dy; if (!inB(nx, ny)) continue; const n = idx(nx, ny); if (stamp[n] === cur || sim.terrain[n] === T.WATER || (block && block(n))) continue; stamp[n] = cur; par[n] = c; dist[n] = dist[c] + 1; queue[t++] = n; }
  }
  return null;
}
const nearWater = (sim: Sim, i: number) => { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of D4) if (inB(x + dx, y + dy) && sim.terrain[idx(x + dx, y + dy)] === T.WATER) return true; return false; };
const isWell = (sim: Sim, i: number, v: Village) => sim.bld[i] === v.id * BS + CODE.well && !!v.buildings.find((b) => b.type === 'well' && b.built && idx(b.x, b.y) === i);
const bAt = (sim: Sim, i: number) => buildingAt(sim, i % W, (i / W) | 0);
const mineB = (sim: Sim, v: Village, i: number, t: BType, needBuilt: boolean) => { const b = bAt(sim, i); return !!b && b.v.id === v.id && b.b.type === t && (needBuilt ? b.b.built : !b.b.built); };
interface Ctx { night: boolean; season: number; pop: number[]; deerSet: Set<number>; palis: [number, number][] }
const popCount = (sim: Sim, v: Village) => sim.settlers.reduce((n, s) => n + (s.alive && s.v === v.id ? 1 : 0), 0);
const capacity = (v: Village) => Math.min(has(v, 'masonry') ? 30 : 26, 8 + 4 * v.buildings.filter((b) => b.type === 'hut' && b.built).length);
function toolBonus(v: Village, rng: Rng): number { if (!has(v, 'tools') || v.stock.tools <= 0) return 0; if (rng.next() < Math.min(1, v.stock.tools / Math.max(1, 0.35 * (POP[v.id] || 1)))) { if (rng.next() < 0.02) v.stock.tools--; return 1; } return 0; }

function die(sim: Sim, s: Settler, cause: Cause) {
  if (!s.alive) return; s.alive = false; const v = sim.villages[s.v]; if (v) { v.deaths++; if (cause === 'wolf' || cause === 'beast') v.lastWolfDeath = sim.tick; }
  sim.totals.deaths[cause]++; sim.lineage.push({ g: GENES.map((k) => s.genes[k]), kids: s.kids, age: s.age / YEAR, cause, v: s.v }); if (sim.lineage.length > 500) sim.lineage.shift();
  sim.graves.push({ x: s.x, y: s.y, name: s.name, cause, year: sim.tick / YEAR, v: s.v }); if (sim.graves.length > 80) sim.graves.shift();
  bio(s, sim, `died of ${cause} at age ${(s.age / YEAR).toFixed(1)}`); ev(sim, 'death', `${s.name} (${v?.name ?? '?'}) died of ${cause}, age ${(s.age / YEAR).toFixed(1)}`, s.x, s.y, s.id);
}
function go(sim: Sim, s: Settler, job: Job, pred: (i: number) => boolean, R: number, thought: string, block?: (i: number) => boolean): boolean {
  const p = bfs(sim, s.x, s.y, R, pred, block); if (!p) return false; s.job = job; s.path = p; s.work = -1; s.moveCd = MOVE; s.thought = thought; return true;
}
function wander(sim: Sim, rng: Rng, s: Settler, v: Village, why: string) {
  for (let k = 0; k < 6; k++) { const tx = v.hx + rng.int(11) - 5, ty = v.hy + rng.int(11) - 5; if (inB(tx, ty) && sim.terrain[idx(tx, ty)] !== T.WATER) { const t = idx(tx, ty); if (go(sim, s, 'idle', (i) => i === t, 16, why)) { s.work = -1; return; } } }
  s.job = 'idle'; s.thought = why; s.cool = 6;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;

function think(sim: Sim, rng: Rng, s: Settler, v: Village, ctx: Ctx) {
  const g = s.genes, R = 10 + Math.round(18 * g.curiosity), home = idx(v.hx, v.hy), fl = Math.round(g.foresight * 3), ofl = Math.round(g.foresight * 2), ol = v.outlook;
  const drinkPred = (i: number) => sim.terrain[i] !== T.WATER && (nearWater(sim, i) || isWell(sim, i, v));
  if (s.age < ADULT) {
    if (s.thirst > 0.45 && go(sim, s, 'drink', drinkPred, 40, 'thirsty child: heading to water')) return;
    if (s.hunger > 0.45 && v.stock.food >= 1 && go(sim, s, 'eat', (i) => i === home, 60, 'hungry child: asking for food')) return;
    wander(sim, rng, s, v, 'playing near the hearth'); return;
  }
  if (s.hunger > 0.5 && s.carry.food > 0) { s.carry.food--; s.hunger = Math.max(0, s.hunger - 0.5); }
  if (s.thirst > 0.5 && go(sim, s, 'drink', drinkPred, 40, `thirsty (${pct(s.thirst)}): heading to water`)) return;
  if (s.hunger > 0.55) {
    if (v.stock.food >= 1 && go(sim, s, 'eat', (i) => i === home, 60, `hungry (${pct(s.hunger)}): eating from the stores`)) return;
    if (g.huntBias > 0.5 && go(sim, s, 'hunt', (i) => ctx.deerSet.has(i), R + 8, 'hungry: hunting small game')) { s.tid = -1; return; }
    if (go(sim, s, 'forage', (i) => sim.berry[i] > 1, R, 'hungry: foraging berries')) return;
    if (go(sim, s, 'fish', (i) => sim.fish[i] > 0, R, 'hungry: fishing')) return;
  }
  if (s.cold > 0.55 && v.fire && go(sim, s, 'warm', (i) => md(i % W, (i / W) | 0, v.hx, v.hy) <= 2, 40, `cold (${pct(s.cold)}): warming at the fire`)) return;
  const c = s.carry; if (c.food >= 5 || c.wood >= 6 || c.stone >= 6 || c.tools > 0 || ((c.food + c.wood + c.stone) > 0 && s.cool > 0)) { if (go(sim, s, 'deposit', (i) => i === home, 60, 'carrying goods to the stockpile')) return; }
  const pop = Math.max(1, ctx.pop[v.id]), d = v.doctrine, pend = v.buildings.find((b) => !b.built), st = v.stock;
  const foodT = pop * (2.5 + 3.5 * d.stock), woodT = 14 + pop * (2 + (ctx.season >= 2 ? 3 : 0)) + (pend ? BUILDINGS[pend.type].wood : 0), stoneT = 6 + (pend ? BUILDINGS[pend.type].stone : 0) + 6 * d.defend;
  const needF = clamp((foodT - st.food) / foodT), needW = clamp((woodT - st.wood) / woodT), needS = clamp((stoneT - st.stone) / stoneT);
  const farmReady = v.buildings.some((b) => b.type === 'farm' && b.built && b.crop >= 0.6), shop = built(v, 'workshop');
  const toolNeed = has(v, 'tools') ? clamp((0.5 * pop - st.tools) / (0.5 * pop)) : 0, spearNeed = has(v, 'spears') ? clamp((0.3 * pop - st.spears) / (0.3 * pop)) : 0;
  const craftOk = shop && st.wood >= 3 && st.stone >= 2 && (toolNeed > 0 || spearNeed > 0);
  const gameF = ol.game < 0.25 ? 1 - 0.9 * g.foresight : 1, plantW = ol.wood < 0.65 ? (0.65 - ol.wood) * (0.15 + 1.3 * g.foresight) * (0.3 + needW) : 0;
  const opts: [Job, number][] = [
    ['forage', needF * (0.4 + 0.6 * (1 - d.hunt)) * (1 - 0.6 * g.huntBias) * (ctx.season === 3 ? 0.4 : 1) * (0.4 + 0.6 * ol.berry)], ['hunt', needF * d.hunt * (0.2 + g.huntBias) * (g.courage > 0.25 ? 1 : 0.3) * gameF],
    ['fish', needF * (0.25 + 0.5 * (1 - d.hunt)) * (0.3 + 0.7 * ol.fish)], ['farm', farmReady ? (0.25 + needF) * d.farm * (1.1 - g.huntBias * 0.6) : 0],
    ['wood', needW * (0.5 + 0.6 * d.build) * (0.5 + 0.5 * ol.wood)], ['stone', needS * (0.35 + 0.4 * d.build + 0.4 * d.defend) * (ol.stone > 0.04 ? 1 : 0.1)], ['plant', plantW],
    ['craft', craftOk ? 0.7 * Math.max(toolNeed, spearNeed * 0.6) : 0], ['build', pend ? 1.4 * d.build * (0.4 + g.industry) : 0], ['idle', 0.12 * (1.2 - g.industry)],
  ];
  const wgt = (o: [Job, number]) => o[1] * (o[0] === 'idle' ? 1 : 0.4 + g.industry), tot = opts.reduce((a, o) => a + wgt(o), 0); let r = rng.next() * tot, pick: Job = 'idle';
  for (const o of opts) { r -= wgt(o); if (r <= 0) { pick = o[0]; break; } }
  const t = `food ${pct(needF)} short, wood ${pct(needW)} short, forest ${pct(ol.wood)} stocked`;
  const attempt = (job: Job, R2: number, why: string): boolean => {
    switch (job) {
      case 'forage': return go(sim, s, 'forage', (i) => sim.berry[i] > 1, R2, `foraging: ${why}`);
      case 'hunt': { const ok = go(sim, s, 'hunt', (i) => ctx.deerSet.has(i), R2 + 8, `hunting: ${why}`); if (ok) s.tid = -1; return ok; }
      case 'fish': return go(sim, s, 'fish', (i) => sim.fish[i] > ofl, R2, `fishing (leaving ${ofl} for later): ${why}`);
      case 'farm': return farmReady && go(sim, s, 'farm', (i) => { const b = bAt(sim, i); return !!b && b.v.id === v.id && b.b.type === 'farm' && b.b.built && b.b.crop >= 0.6; }, 40, `tending the farm: ${why}`);
      case 'wood': return go(sim, s, 'wood', (i) => sim.wood[i] > fl, R2, `cutting wood (sparing ${fl} per tree-tile): ${why}`);
      case 'stone': return go(sim, s, 'stone', (i) => sim.stone[i] > 0, R2 + 6, `quarrying stone: ${why}`);
      case 'plant': return go(sim, s, 'plant', (i) => sim.terrain[i] === T.FOREST && sim.wood[i] <= 2 && md(i % W, (i / W) | 0, v.hx, v.hy) <= 14, R2, `replanting the forest (foresight ${pct(g.foresight)}): ${why}`);
      case 'craft': return craftOk && go(sim, s, 'craft', (i) => mineB(sim, v, i, 'workshop', true), 40, `crafting at the workshop: ${why}`);
      case 'build': return !!pend && go(sim, s, 'build', (i) => mineB(sim, v, i, pend.type, false) || (!!bAt(sim, i) && bAt(sim, i)!.v.id === v.id && !bAt(sim, i)!.b.built), 40, `building a ${pend.type}`);
      default: return false;
    }
  };
  if (pick !== 'idle' && attempt(pick, R, t)) return;
  if (pick !== 'idle') { const alt: Job[] = needF >= needW ? ['farm', 'fish', 'hunt', 'forage', 'wood', 'stone', 'plant'] : ['wood', 'plant', 'stone', 'forage', 'fish', 'hunt', 'farm']; for (const a of alt) if (a !== pick && attempt(a, R + 10, 'farther afield')) return; }
  wander(sim, rng, s, v, pick === 'idle' ? 'resting' : `wanted to ${pick}, nothing in reach`);
}

type Pred = Wolf | Animal;
const predators = (sim: Sim): Pred[] => [...sim.wolves, ...sim.fauna.filter((a) => a.k === 'bear')];
const isAnimal = (a: Pred): a is Animal => 'k' in a;
const removePred = (sim: Sim, a: Pred) => { const arr: Pred[] = isAnimal(a) ? sim.fauna : sim.wolves; arr.splice(arr.indexOf(a), 1); };
const animalById = (sim: Sim, id: number): { a: { id: number; x: number; y: number; hp: number }; kind: string } | null => { const d = sim.deer.find((q) => q.id === id); if (d) return { a: d, kind: 'deer' }; const f = sim.fauna.find((q) => q.id === id); return f ? { a: f, kind: f.k } : null; };
function hit(sim: Sim, a: Settler, tgt: Settler, av: Village) {
  let dmg = 0.12 * (a.armed ? 1.5 : 1) * (0.6 + 0.8 * a.genes.courage) * (has(av, 'bows') ? 1.1 : 1);
  if (a.job === 'defend' && av.buildings.some((b) => b.type === 'palisade' && b.built && md(b.x, b.y, a.x, a.y) <= 6)) dmg *= 1.25;
  tgt.health -= dmg; tgt.lastHit = 'war';
}
function hitPredator(sim: Sim, s: Settler, v: Village, w: Pred) {
  w.hp -= (0.2 + 0.18 * s.genes.courage) * (s.armed || has(v, 'spears') ? 1.3 : 1);
  if (w.hp <= 0) { const k = isAnimal(w) ? 'bear' : 'wolf'; removePred(sim, w); s.carry.food += MEAT[k]; s.job = 'idle'; s.tid = -1; ev(sim, 'wolf', `${s.name} of ${v.name} killed a ${k}`, s.x, s.y, s.id); bio(s, sim, `killed a ${k}`); return true; }
  return false;
}
function huntHit(sim: Sim, rng: Rng, s: Settler, v: Village, tgt: NonNullable<ReturnType<typeof animalById>>) {
  const { a, kind } = tgt, g = s.genes;
  if (kind === 'boar' || kind === 'bear') {
    a.hp -= 0.25 * (0.6 + 0.8 * g.courage) * (s.armed || has(v, 'spears') ? 1.4 : 1) * (has(v, 'bows') ? 1.15 : 1);
    if (a.hp <= 0) {
      const crew = sim.settlers.filter((q) => q.alive && q.party === a.id), meat = MEAT[kind], share = Math.ceil(meat / Math.max(1, crew.length));
      sim.fauna.splice(sim.fauna.findIndex((q) => q.id === a.id), 1);
      for (const m of crew) { m.carry.food += share; m.party = -1; m.job = 'idle'; m.tid = -1; bio(m, sim, `helped bring down a ${kind} with ${crew.length - 1} others`); }
      ev(sim, 'hunt', `${v.name}'s party of ${crew.length} brought down a ${kind} (${meat} food)`, a.x, a.y, s.id);
    }
    return;
  }
  const p = kind === 'rabbit' ? 0.7 : 0.4 + 0.4 * g.courage + (has(v, 'spears') ? 0.1 : 0) + (has(v, 'bows') ? 0.1 : 0);
  if (rng.next() < p) { if (kind === 'deer') sim.deer.splice(sim.deer.findIndex((q) => q.id === a.id), 1); else sim.fauna.splice(sim.fauna.findIndex((q) => q.id === a.id), 1); s.carry.food += MEAT[kind]; s.job = 'idle'; s.tid = -1; s.thought = `brought down a ${kind}`; bio(s, sim, `brought down a ${kind}`); }
}
const reserveOf = (B: Village, g: Good) => (g === 'food' ? 1.5 * (POP[B.id] || 0) : g === 'wood' ? 10 : g === 'stone' ? 4 : 0.3 * (POP[B.id] || 0));
function tradeExchange(sim: Sim, s: Settler, v: Village, B: Village) {
  const tr = s.trade!, give = Math.min(tr.amt, s.carry[tr.give]); const mk = (built(v, 'market') ? 0.1 : 0) + (built(B, 'market') ? 0.1 : 0) + (has(v, 'tallies') ? 0.1 : 0);
  B.stock[tr.give] += give; s.carry[tr.give] -= give;
  let amt = Math.min(Math.max(0, B.stock[tr.want] - reserveOf(B, tr.want)), Math.floor((give * GOODVAL[tr.give] * (1 + mk)) / GOODVAL[tr.want])); if (tr.want === 'tools') amt = Math.min(amt, 2); amt = Math.max(0, Math.floor(amt));
  B.stock[tr.want] -= amt; s.carry[tr.want] += amt; addRel(sim, v.id, B.id, 0.08 * (1 + 2 * mk)); sim.totals.trades++;
  ev(sim, 'trade', `${s.name} of ${v.name} swapped ${give} ${tr.give} for ${amt} ${tr.want} with ${B.name}`, B.hx, B.hy, s.id); bio(s, sim, `led a trade caravan to ${B.name}`);
  return (Object.keys(TECHS) as TechId[]).filter((k) => has(B, k) && canLearn(v, k));
}

function complete(sim: Sim, rng: Rng, s: Settler, v: Village): boolean {
  const i = idx(s.x, s.y), g = s.genes;
  switch (s.job) {
    case 'drink': if (nearWater(sim, i) || isWell(sim, i, v)) s.thirst = Math.max(0, s.thirst - 0.75); break;
    case 'eat': if (v.stock.food >= 1) { v.stock.food--; s.hunger = Math.max(0, s.hunger - 0.5); } break;
    case 'forage': if (sim.berry[i] > 1) { sim.berry[i]--; s.carry.food += 2 + toolBonus(v, rng); if (s.hunger > 0.5) { s.carry.food--; s.hunger = Math.max(0, s.hunger - 0.5); } } break;
    case 'fish': if (sim.fish[i] > 0) { sim.fish[i]--; s.carry.food += 2 + toolBonus(v, rng); if (s.hunger > 0.5) { s.carry.food--; s.hunger = Math.max(0, s.hunger - 0.5); } } break;
    case 'wood': if (sim.wood[i] > 0) { sim.wood[i]--; s.carry.wood += 2 + toolBonus(v, rng); } break;
    case 'stone': if (sim.stone[i] > 0) { sim.stone[i]--; s.carry.stone += 2 + toolBonus(v, rng); } break;
    case 'plant': if (sim.terrain[i] === T.FOREST && sim.wood[i] <= 2) { sim.wood[i] += 3; bio(s, sim, 'replanted trees'); } break;
    case 'farm': { const b = buildingAt(sim, s.x, s.y); if (b && b.b.type === 'farm' && b.b.crop >= 0.6) { s.carry.food += Math.round(14 * b.b.crop); b.b.crop = 0; } break; }
    case 'deposit': v.stock.food = Math.min(v.stock.food + s.carry.food, 60 + (built(v, 'granary') ? 90 : 0) + (built(v, 'smokehouse') ? 40 : 0)); v.stock.wood += s.carry.wood; v.stock.stone += s.carry.stone; v.stock.tools += s.carry.tools; s.carry = { food: 0, wood: 0, stone: 0, tools: 0 }; break;
    case 'build': { const b = buildingAt(sim, s.x, s.y); if (b && !b.b.built) { const crew = sim.settlers.filter((o) => o !== s && o.alive && o.job === 'build' && o.x === s.x && o.y === s.y).length; b.b.progress += (1 / BWORK[b.b.type]) * (0.7 + 0.6 * g.industry) * 5 * (1 + 0.25 * crew); if (b.b.progress >= 1) { b.b.built = true; b.b.progress = 1; sim.totals.builds++; ev(sim, 'build', `${v.name} finished a ${b.b.type}${crew ? ` (crew of ${crew + 1})` : ''}`, b.b.x, b.b.y); bio(s, sim, `helped finish a ${b.b.type} in ${v.name}`); } } break; }
    case 'craft': { const pop = POP[v.id] || 1; if (!mineB(sim, v, i, 'workshop', true)) break;
      if (has(v, 'tools') && v.stock.tools < 0.5 * pop && v.stock.wood >= 2 && v.stock.stone >= 1) { v.stock.wood -= 2; v.stock.stone -= 1; v.stock.tools++; ev(sim, 'craft', `${s.name} crafted a tool in ${v.name}`, s.x, s.y, s.id); }
      else if (has(v, 'spears') && v.stock.spears < 0.3 * pop && v.stock.wood >= 2 && v.stock.stone >= 2) { v.stock.wood -= 2; v.stock.stone -= 2; v.stock.spears++; ev(sim, 'craft', `${s.name} crafted a spear in ${v.name}`, s.x, s.y, s.id); } break; }
    case 'trade': {
      const tr = s.trade; if (!tr) break;
      if (tr.phase === 0) {
        const B = sim.villages[tr.to]; if (B && B.alive && md(s.x, s.y, B.hx, B.hy) <= 3) { const learnable = tradeExchange(sim, s, v, B); if (learnable.length && rng.next() < 0.35) learn(sim, v, rng.pick(learnable), `learned from ${B.name}'s traders`); }
        tr.phase = 1; const p = bfs(sim, s.x, s.y, 220, (k) => k === idx(v.hx, v.hy)); if (p) { s.path = p; s.moveCd = MOVE; s.work = -1; s.thought = 'returning home with trade goods'; return true; }
      }
      v.stock.food += s.carry.food; v.stock.wood += s.carry.wood; v.stock.stone += s.carry.stone; v.stock.tools += s.carry.tools; s.carry = { food: 0, wood: 0, stone: 0, tools: 0 }; s.trade = null; break;
    }
    default: break;
  }
  return false;
}

function loot(sim: Sim, rng: Rng, s: Settler, v: Village, B: Village) {
  const f = Math.min(8, Math.floor(B.stock.food)), w = Math.min(6, Math.floor(B.stock.wood)), tl = Math.min(1, B.stock.tools), sp = Math.min(1, B.stock.spears);
  B.stock.food -= f; B.stock.wood -= w; B.stock.tools -= tl; B.stock.spears -= sp; s.carry.food += f; s.carry.wood += w; s.carry.tools += tl; v.stock.spears += sp;
  addRel(sim, v.id, B.id, -0.35); ev(sim, 'war', `Raiders from ${v.name} looted ${B.name} (${f} food, ${w} wood${tl ? ', a tool' : ''})`, B.hx, B.hy, s.id); bio(s, sim, `raided ${B.name}`);
  const learnable = (Object.keys(TECHS) as TechId[]).filter((k) => has(B, k) && canLearn(v, k)); if (learnable.length && rng.next() < 0.3) learn(sim, v, rng.pick(learnable), `seized knowledge from ${B.name}`);
  s.raid = -1; s.armed = false; if (!go(sim, s, 'deposit', (i) => i === idx(v.hx, v.hy), 220, `carrying loot home from ${B.name}`)) { s.job = 'idle'; s.path = []; }
}

function stepSettler(sim: Sim, rng: Rng, s: Settler, v: Village, ctx: Ctx) {
  const g = s.genes, child = s.age < ADULT, t = sim.tick;
  s.age++; if (s.cool > 0) s.cool--;
  const metab = 1.15 - 0.3 * g.hardiness + 0.15 * g.industry;
  s.hunger = Math.min(1, s.hunger + HUNGER * metab * (child ? 0.6 : 1)); s.thirst = Math.min(1, s.thirst + THIRST * metab * (child ? 0.7 : 1));
  const fire = v.fire && md(s.x, s.y, v.hx, v.hy) <= 5, hut = v.buildings.some((b) => b.type === 'hut' && b.built && md(s.x, s.y, b.x, b.y) <= 2);
  const cr = COLD[ctx.season] * (ctx.night ? 1.5 : 1) * (1.15 - 0.45 * g.hardiness);
  if (fire) s.cold = Math.max(0, s.cold - 0.006); else if (cr < 0.0005) s.cold = Math.max(0, s.cold - 0.002); else s.cold = Math.min(1, s.cold + cr * (hut ? (has(v, 'masonry') ? 0.2 : 0.35) : 1));
  let dmg = 0, src: Cause | '' = '';
  if (s.hunger >= 1) { dmg += 0.0035; src = 'starvation'; } if (s.thirst >= 1) { dmg += 0.006; src = 'thirst'; } if (s.cold >= 1) { dmg += 0.003; src = 'cold'; }
  if (s.sick > 0) { dmg += 0.0014 * (has(v, 'herbalism') ? 0.5 : 1); s.sick--; if (!src) src = 'fever'; }
  if (dmg > 0) { s.health -= dmg; s.lastHit = src; } else if (s.hunger < 0.7 && s.thirst < 0.7 && s.cold < 0.7) s.health = Math.min(1, s.health + 0.0015);
  const ay = s.age / YEAR; if (ay > 6 && rng.next() < 0.0000030 * (ay - 6) ** 2) { die(sim, s, 'old age'); return; }
  if (!child && rng.next() < 0.0000022) { die(sim, s, 'accident'); return; }
  if (s.health <= 0) { die(sim, s, (s.lastHit || 'starvation') as Cause); return; }
  if (s.ctl) { s.thought = 'Under your control'; return; }
  if (t % 5 === s.id % 5 && !child && !['drink', 'eat', 'flee', 'fight', 'raid', 'defend'].includes(s.job) && (s.thirst > 0.8 || s.hunger > 0.9 || s.cold > 0.9)) { s.job = 'idle'; s.path = []; s.work = -1; s.cool = 0; s.tid = -1; s.party = -1; s.trade = null; }
  // ---- predators (wolves, bears) ----
  if (t % 3 === s.id % 3 && !child && s.job !== 'raid' && s.job !== 'defend') {
    let wd = 99, wolf: Pred | null = null; for (const w of predators(sim)) { const d = md(w.x, w.y, s.x, s.y); if (d < wd) { wd = d; wolf = w; } }
    const bear = !!wolf && isAnimal(wolf), rad = 3 + 3 * (1 - g.courage) + (bear ? 1 : 0);
    if (wolf && wd <= rad && s.job !== 'flee' && s.job !== 'fight') {
      const mates = sim.settlers.filter((o) => o !== s && o.alive && o.v === s.v && o.age >= ADULT && md(o.x, o.y, s.x, s.y) <= 3).length;
      if (g.courage > 0.55 && mates >= (bear ? 3 : 1)) { s.job = 'fight'; s.tid = wolf.id; s.path = []; s.thought = `fighting a ${bear ? 'bear' : 'wolf'} (courage ${pct(g.courage)}, ${mates} allies)`; bio(s, sim, `stood against a ${bear ? 'bear' : 'wolf'}`); }
      else { s.job = 'flee'; s.path = bfs(sim, s.x, s.y, 40, (i) => i === idx(v.hx, v.hy)) ?? []; s.moveCd = 1; s.thought = `fleeing a ${bear ? 'bear' : 'wolf'} (${wd} tiles away)`; }
    } else if ((s.job === 'flee' || s.job === 'fight') && (!wolf || wd > 8)) { s.job = 'idle'; s.path = []; s.tid = -1; }
  }
  // ---- raiders approaching: defend or flee ----
  if (t % 3 === s.id % 3 && !child && !['raid', 'defend', 'flee', 'fight'].includes(s.job)) {
    const rad = built(v, 'watchtower') ? 15 : 9; let best: Settler | null = null, bd = 99;
    for (const o of sim.settlers) if (o.alive && o.job === 'raid' && o.raid === s.v) { const d = Math.min(md(o.x, o.y, s.x, s.y), md(o.x, o.y, v.hx, v.hy)); if (d < bd) { bd = d; best = o; } }
    if (best && bd <= rad) { if (g.courage > 0.3 && s.health > 0.4) { s.job = 'defend'; s.tid = best.id; s.path = []; s.thought = `defending ${v.name} against raiders from ${sim.villages[best.v]?.name}`; } else { s.job = 'flee'; s.path = bfs(sim, s.x, s.y, 40, (i) => i === idx(v.hx, v.hy)) ?? []; s.moveCd = 1; s.thought = 'fleeing raiders'; } }
  }
  if (s.job === 'fight') {
    const w = predators(sim).find((q) => q.id === s.tid); if (!w) { s.job = 'idle'; return; }
    if (md(w.x, w.y, s.x, s.y) <= 1) { if (s.atk-- <= 0) { s.atk = 4; hitPredator(sim, s, v, w); } return; }
    if (s.path.length === 0 || t % 4 === 0) s.path = bfs(sim, s.x, s.y, 12, (i) => i === idx(w.x, w.y)) ?? []; if (!s.path.length) { s.job = 'flee'; return; }
  }
  if (s.job === 'defend') {
    const e = sim.settlers.find((q) => q.id === s.tid && q.alive && q.job === 'raid'); if (!e) { s.job = 'idle'; s.tid = -1; return; }
    if (md(e.x, e.y, s.x, s.y) <= 1) { if (s.atk-- <= 0) { s.atk = 4; hit(sim, s, e, v); } return; }
    if (!s.path.length || t % 4 === 0) { const p = bfs(sim, s.x, s.y, 25, (i) => i === idx(e.x, e.y)); if (!p) { s.job = 'idle'; s.tid = -1; return; } s.path = p; }
  }
  if (s.job === 'raid') {
    const B = sim.villages[s.raid];
    if (!B || !B.alive || s.health < 0.35) { s.raid = -1; if (!go(sim, s, 'deposit', (i) => i === idx(v.hx, v.hy), 220, 'retreating from the raid')) s.job = 'idle'; return; }
    const foe = sim.settlers.find((o) => o.alive && o.v === s.raid && md(o.x, o.y, s.x, s.y) <= 1);
    if (foe) { if (s.atk-- <= 0) { s.atk = 4; hit(sim, s, foe, v); } return; }
    if (!s.path.length) { if (md(s.x, s.y, B.hx, B.hy) <= 2) { loot(sim, rng, s, v, B); return; } const p = bfs(sim, s.x, s.y, 220, (i) => i === idx(B.hx, B.hy)); if (!p) { s.raid = -1; s.job = 'idle'; return; } s.path = p; }
  }
  if (s.job === 'hunt') {
    if (s.tid < 0) { let best: { id: number; x: number; y: number } | null = null, bd = 1e9; for (const d of [...sim.deer, ...sim.fauna.filter((a) => a.k === 'rabbit')]) { const dd = md(d.x, d.y, s.x, s.y); if (dd < bd && ctx.deerSet.has(idx(d.x, d.y))) { bd = dd; best = d; } } if (!best) { s.job = 'idle'; return; } s.tid = best.id; }
    const tgt = animalById(sim, s.tid); if (!tgt) { s.job = 'idle'; s.tid = -1; s.party = -1; return; }
    if (md(tgt.a.x, tgt.a.y, s.x, s.y) <= 1) { if (s.atk-- <= 0) { s.atk = 3; huntHit(sim, rng, s, v, tgt); } return; }
    if (!s.path.length || t % 4 === 0) { const p = bfs(sim, s.x, s.y, 36, (i) => i === idx(tgt.a.x, tgt.a.y)); if (!p) { s.job = 'idle'; s.tid = -1; s.party = -1; return; } s.path = p; }
  }
  // ---- move / work / think ----
  if (s.path.length) { if (--s.moveCd <= 0) { const n = s.path[0]; if (sim.terrain[n] === T.WATER) { s.path = []; return; } s.path.shift(); s.x = n % W; s.y = (n / W) | 0; s.moveCd = MOVE; } return; }
  if (child && s.job === 'idle' && s.cool > 0 && (s.thirst > 0.45 || s.hunger > 0.45)) s.cool = 0;
  if (s.job === 'idle' || s.job === 'flee' || s.job === 'fight' || s.job === 'hunt' || s.job === 'raid' || s.job === 'defend') { if (s.job !== 'idle') { if (s.job === 'flee' && s.path.length === 0) s.job = 'idle'; return; } if (s.cool > 0) return; think(sim, rng, s, v, ctx); return; }
  if (s.work < 0) s.work = WORK[s.job] ?? 3;
  if (--s.work <= 0) { if (!complete(sim, rng, s, v)) { s.job = 'idle'; s.work = -1; } }
}

function nearestSettlerDist(sim: Sim, x: number, y: number): [number, Settler | null] { let bd = 99, b: Settler | null = null; for (const s of sim.settlers) { if (!s.alive) continue; const d = md(s.x, s.y, x, y); if (d < bd) { bd = d; b = s; } } return [bd, b]; }
const nearPalisade = (ctx: Ctx, x: number, y: number) => ctx.palis.some((p) => md(p[0], p[1], x, y) <= 6);
const free = (sim: Sim, x: number, y: number) => inB(x, y) && sim.terrain[idx(x, y)] !== T.WATER;

function stepWolves(sim: Sim, rng: Rng, ctx: Ctx) {
  for (const w of sim.wolves) {
    if (w.cool > 0) w.cool--; if (sim.tick % 2) continue;
    const [d, s] = nearestSettlerDist(sim, w.x, w.y); const grp = sim.settlers.filter((o) => o.alive && md(o.x, o.y, w.x, w.y) <= 3).length;
    let dx = 0, dy = 0;
    if (w.flee > 0 || w.hp < 0.35 || grp >= 3) { if (w.flee <= 0) w.flee = 20; w.flee--; if (s) { dx = -Math.sign(s.x - w.x); dy = -Math.sign(s.y - w.y); } }
    else if (s && d <= 8) { const adx = Math.abs(s.x - w.x), ady = Math.abs(s.y - w.y); if (d <= 1) { if (w.cool === 0) { s.health -= 0.13; s.lastHit = 'wolf'; w.cool = 6; } continue; } if (adx >= ady) dx = Math.sign(s.x - w.x); else dy = Math.sign(s.y - w.y); }
    else if (rng.next() < 0.5) { const [a, b] = rng.pick(D4); dx = a; dy = b; }
    const nx = w.x + dx, ny = w.y + dy; if (free(sim, nx, ny) && !nearPalisade(ctx, nx, ny)) { w.x = nx; w.y = ny; }
    else if (dx || dy) { const [a, b] = rng.pick(D4); if (free(sim, w.x + a, w.y + b) && !nearPalisade(ctx, w.x + a, w.y + b)) { w.x += a; w.y += b; } }
  }
}
function stepDeer(sim: Sim, rng: Rng) {
  if (sim.tick % 4) return;
  for (const d of sim.deer) {
    let dx = 0, dy = 0; const [dd, s] = nearestSettlerDist(sim, d.x, d.y);
    if (s && dd <= 3 && rng.next() < 0.85) { dx = -Math.sign(s.x - d.x); dy = -Math.sign(s.y - d.y); } else if (rng.next() < 0.4) { const [a, b] = rng.pick(D4); dx = a; dy = b; } else continue;
    if (free(sim, d.x + dx, d.y + dy)) { d.x += dx; d.y += dy; }
  }
}
function stepFauna(sim: Sim, rng: Rng, ctx: Ctx) {
  for (const a of sim.fauna) {
    if (a.cool > 0) a.cool--; if (sim.tick % (a.k === 'rabbit' ? 2 : 4)) continue;
    const [d, s] = nearestSettlerDist(sim, a.x, a.y); let dx = 0, dy = 0;
    if (a.k === 'rabbit') { if (s && d <= 3 && rng.next() < 0.9) { dx = -Math.sign(s.x - a.x); dy = -Math.sign(s.y - a.y); } else if (rng.next() < 0.5) { const [p, q] = rng.pick(D4); dx = p; dy = q; } else continue; }
    else if (a.k === 'boar') {
      if (a.hp < 3 && s && d <= 7) { if (d <= 1) { if (a.cool === 0) { s.health -= 0.06; s.lastHit = 'beast'; a.cool = 6; } continue; } dx = Math.abs(s.x - a.x) >= Math.abs(s.y - a.y) ? Math.sign(s.x - a.x) : 0; dy = dx ? 0 : Math.sign(s.y - a.y); }
      else if (rng.next() < 0.3) { const [p, q] = rng.pick(D4); dx = p; dy = q; } else continue;
    } else {
      const grp = sim.settlers.filter((o) => o.alive && md(o.x, o.y, a.x, a.y) <= 3).length;
      if (a.hp < 2 || grp >= 4) { if (s) { dx = -Math.sign(s.x - a.x); dy = -Math.sign(s.y - a.y); } }
      else if (s && d <= 7) { if (d <= 1) { if (a.cool === 0) { s.health -= 0.14; s.lastHit = 'beast'; a.cool = 6; } continue; } dx = Math.abs(s.x - a.x) >= Math.abs(s.y - a.y) ? Math.sign(s.x - a.x) : 0; dy = dx ? 0 : Math.sign(s.y - a.y); }
      else if (rng.next() < 0.35) { const [p, q] = rng.pick(D4); dx = p; dy = q; } else continue;
    }
    const nx = a.x + dx, ny = a.y + dy; if (free(sim, nx, ny) && (a.k !== 'bear' || !nearPalisade(ctx, nx, ny))) { a.x = nx; a.y = ny; }
  }
}

function breed(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  const pop = ctx.pop[v.id]; if (pop >= capacity(v) || v.stock.food < 2 * pop) return;
  const adults = sim.settlers.filter((s) => s.alive && s.v === v.id && s.age >= ADULT && s.cool === 0 && s.hunger < 0.6 && s.thirst < 0.6 && s.health > 0.5);
  for (let i = 0; i < adults.length; i++) for (let j = i + 1; j < adults.length; j++) {
    const a = adults[i], b = adults[j]; if (a.cool > 0 || b.cool > 0 || md(a.x, a.y, b.x, b.y) > 4) continue;
    if (rng.next() > 0.014 * (0.6 + 0.8 * (a.genes.sociability + b.genes.sociability) / 2)) continue;
    const genes = {} as Genes; for (const k of GENES) { let x = rng.next() < 0.5 ? a.genes[k] : b.genes[k]; if (rng.next() < 0.35) x += rng.gauss() * 0.09; if (rng.next() < 0.02) x += rng.gauss() * 0.3; genes[k] = clamp(x); }
    const c = mkSettler(sim, rng, v.id, v.hx, v.hy, 0, genes, [a.id, b.id]); sim.settlers.push(c); a.cool = b.cool = Math.round(YEAR * 0.45); a.kids++; b.kids++; v.births++; sim.totals.births++;
    bio(c, sim, `born in ${v.name} to ${a.name} and ${b.name}`); bio(a, sim, `had a child, ${c.name}`); bio(b, sim, `had a child, ${c.name}`); ev(sim, 'birth', `${c.name} was born in ${v.name} (parents ${a.name} & ${b.name})`, v.hx, v.hy, c.id); return;
  }
}

function placeBuilding(sim: Sim, rng: Rng, v: Village, type: BType) {
  const c = BUILDINGS[type]; if (v.stock.wood < c.wood || v.stock.stone < c.stone || (c.needs && !has(v, c.needs))) return false;
  for (let k = 0; k < 40; k++) { const x = v.hx + rng.int(15) - 7, y = v.hy + rng.int(15) - 7, d = md(x, y, v.hx, v.hy); if (!inB(x, y) || d < 2 || d > 8 || sim.bld[idx(x, y)] || (sim.terrain[idx(x, y)] !== T.GRASS && sim.terrain[idx(x, y)] !== T.SAND)) continue;
    v.stock.wood -= c.wood; v.stock.stone -= c.stone; v.buildings.push({ type, x, y, built: false, progress: 0, crop: 0 }); sim.bld[idx(x, y)] = v.id * BS + CODE[type]; ev(sim, 'plan', `${v.name} started a ${c.name.toLowerCase()}`, x, y); return true; }
  return false;
}
function planBuildings(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  if (v.buildings.some((b) => !b.built)) return; const pop = ctx.pop[v.id], d = v.doctrine, n = (t: BType) => v.buildings.filter((b) => b.type === t).length;
  const waterNear = (() => { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (inB(v.hx + dx, v.hy + dy) && sim.terrain[idx(v.hx + dx, v.hy + dy)] === T.WATER) return true; return false; })();
  const hostile = sim.villages.some((o) => o.alive && o.id !== v.id && relOf(sim, v.id, o.id) < -0.15);
  if (pop >= capacity(v) - 2 && n('hut') < 5 && placeBuilding(sim, rng, v, 'hut')) return;
  if (!waterNear && !n('well') && placeBuilding(sim, rng, v, 'well')) return;
  if (d.farm > 0.25 && n('farm') < 1 + Math.floor((pop * d.farm) / 3) && placeBuilding(sim, rng, v, 'farm')) return;
  if (has(v, 'tools') && !n('workshop') && pop >= 8 && placeBuilding(sim, rng, v, 'workshop')) return;
  if (!n('granary') && d.stock > 0.5 && v.stock.food > 15 && placeBuilding(sim, rng, v, 'granary')) return;
  if (has(v, 'curing') && !n('smokehouse') && v.stock.food > 20 && d.stock > 0.25 && placeBuilding(sim, rng, v, 'smokehouse')) return;
  if (!n('palisade') && d.defend > 0.45 && (sim.tick - v.lastWolfDeath < YEAR * 2 || pop >= 10) && placeBuilding(sim, rng, v, 'palisade')) return;
  if (has(v, 'tallies') && !n('market') && pop >= 10 && placeBuilding(sim, rng, v, 'market')) return;
  if (!n('watchtower') && d.defend > 0.5 && pop >= 10 && (hostile || sim.tick - v.lastWolfDeath < YEAR) && placeBuilding(sim, rng, v, 'watchtower')) return;
}
const mutateDoctrine = (d: Doctrine, rng: Rng): Doctrine => { const o = {} as Doctrine; for (const k of DOCTRINE_KEYS) o[k] = clamp(d[k] + rng.gauss() * 0.15); return o; };
function found(sim: Sim, rng: Rng, members: Settler[], parent: Village | null, x: number, y: number) {
  const doctrine = parent && rng.next() > 0.15 ? mutateDoctrine(parent.doctrine, rng) : mutateDoctrine(rng.pick(DOCTRINES), rng);
  const v = mkVillage(sim, rng, x, y, doctrine, parent?.id ?? -1); v.stock = { food: 8, wood: 10, stone: 2, tools: 0, spears: 0 }; v.techs = parent ? [...parent.techs] : rng.next() < 0.3 ? ['tools'] : [];
  if (parent) { parent.stock.food = Math.max(0, parent.stock.food - 8); parent.stock.wood = Math.max(0, parent.stock.wood - 10); }
  for (const s of members) { s.v = v.id; s.x = x; s.y = y; s.path = []; s.job = 'idle'; s.work = -1; s.party = -1; s.trade = null; s.raid = -1; bio(s, sim, `left ${parent?.name ?? 'the wilds'} to found ${v.name}`); } sim.totals.founded++;
  ev(sim, 'village', `${v.name} was founded${parent ? ` by migrants from ${parent.name}` : ' by newcomers'}`, x, y); return v;
}
function findSite(sim: Sim, rng: Rng, near?: Village): [number, number] | null {
  const wet = (x: number, y: number) => { for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (inB(x + dx, y + dy) && sim.terrain[idx(x + dx, y + dy)] === T.WATER) return true; return false; };
  for (let k = 0; k < 120; k++) { const x = 6 + rng.int(W - 12), y = 6 + rng.int(H - 12), i = idx(x, y); if (sim.terrain[i] !== T.GRASS || sim.bld[i] || !wet(x, y)) continue;
    if (sim.villages.some((v) => v.alive && md(v.hx, v.hy, x, y) < 14)) continue; if (near && md(near.hx, near.hy, x, y) > 36) continue; return [x, y]; }
  return null;
}

// ---- diplomacy: relations, trade caravans, raids, hunting parties, invention, resource outlook ----
const eligible = (s: Settler) => s.alive && !s.ctl && s.age >= ADULT && s.health > 0.6 && s.hunger < 0.6 && s.thirst < 0.6 && !['trade', 'raid', 'defend', 'fight', 'flee', 'hunt'].includes(s.job);
function planTrade(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  if (v.tradeCool > 0) { v.tradeCool--; return; } const pop = ctx.pop[v.id]; if (pop < 6) return;
  const need: Record<Good, number> = { food: 2.5 * pop - v.stock.food, wood: 14 + 2 * pop - v.stock.wood, stone: 8 - v.stock.stone, tools: has(v, 'tools') ? 0.4 * pop - v.stock.tools : -v.stock.tools };
  const goods: Good[] = ['food', 'wood', 'stone', 'tools'], want = goods.filter((g) => need[g] >= (g === 'tools' ? 1 : 4)).sort((a, b) => need[b] - need[a])[0];
  const give = goods.filter((g) => g !== want && -need[g] >= (g === 'tools' ? 2 : 6)).sort((a, b) => need[a] - need[b])[0]; if (!want || !give) return;
  const B = sim.villages.filter((o) => o.alive && o.id !== v.id && md(o.hx, o.hy, v.hx, v.hy) <= 70 && relOf(sim, v.id, o.id) > -0.2 && o.stock[want] - reserveOf(o, want) >= (want === 'tools' ? 1 : 4)).sort((a, b) => md(a.hx, a.hy, v.hx, v.hy) - md(b.hx, b.hy, v.hx, v.hy))[0]; if (!B) return;
  const cand = sim.settlers.filter((s) => s.v === v.id && eligible(s)); if (!cand.length) return; const tr = rng.pick(cand);
  const amt = Math.min(give === 'tools' ? 2 : 8, Math.floor(-need[give]), Math.floor(v.stock[give])); if (amt < 1) return;
  const p = bfs(sim, tr.x, tr.y, 220, (i) => i === idx(B.hx, B.hy)); if (!p) return;
  v.stock[give] -= amt; tr.carry[give] += amt; tr.trade = { to: B.id, give, amt, want, phase: 0 }; tr.job = 'trade'; tr.path = p; tr.work = -1; tr.moveCd = MOVE; tr.thought = `leading a caravan to ${B.name}: ${amt} ${give} for ${want}`; v.tradeCool = 3;
}
function planRaid(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  if (v.raidCool > 0) { v.raidCool--; return; } if (ctx.pop[v.id] < 8) return;
  let target: Village | null = null, best = -0.3; for (const o of sim.villages) if (o.alive && o.id !== v.id && md(o.hx, o.hy, v.hx, v.hy) <= 70 && relOf(sim, v.id, o.id) < best) { best = relOf(sim, v.id, o.id); target = o; } if (!target) return;
  const warriors = sim.settlers.filter((s) => s.v === v.id && eligible(s) && s.genes.courage > 0.4 && s.age < 8 * YEAR).sort((a, b) => b.genes.courage - a.genes.courage), n = Math.min(5, Math.floor(warriors.length / 2)); if (n < 2) return;
  const avgC = warriors.slice(0, n).reduce((a, s) => a + s.genes.courage, 0) / n; if (rng.next() > 0.25 * (0.5 + avgC) * (has(v, 'diplomacy') ? 0.4 : 1)) return;
  let sent = 0; for (const s of warriors.slice(0, n)) { const p = bfs(sim, s.x, s.y, 220, (i) => i === idx(target!.hx, target!.hy)); if (!p) continue; s.job = 'raid'; s.raid = target.id; s.path = p; s.moveCd = MOVE; s.work = -1; s.tid = -1; s.thought = `raiding ${target.name} (relations ${Math.round(best * 100)})`; if (v.stock.spears >= 1) { v.stock.spears--; s.armed = true; } bio(s, sim, `marched against ${target.name}`); sent++; }
  if (sent) { v.raidCool = 8; sim.totals.raids++; ev(sim, 'war', `${v.name} sent ${sent} warriors against ${target.name}`, v.hx, v.hy); }
}
function planHunt(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  if (v.huntCool > 0) { v.huntCool--; return; } const pop = ctx.pop[v.id]; if (pop < 6 || v.stock.food > 3 * pop) return;
  const adults = sim.settlers.filter((s) => s.v === v.id && eligible(s)), avgC = adults.reduce((a, s) => a + s.genes.courage, 0) / Math.max(1, adults.length), avgF = adults.reduce((a, s) => a + s.genes.foresight, 0) / Math.max(1, adults.length);
  const boars = sim.fauna.filter((a) => a.k === 'boar').length; if (boars <= 4 && avgF > 0.5) return;
  const big = sim.fauna.filter((a) => (a.k === 'boar' || (a.k === 'bear' && has(v, 'spears') && avgC > 0.55)) && md(a.x, a.y, v.hx, v.hy) <= 30 && !sim.settlers.some((s) => s.party === a.id)).sort((a, b) => md(a.x, a.y, v.hx, v.hy) - md(b.x, b.y, v.hx, v.hy))[0]; if (!big) return;
  const crew = adults.sort((a, b) => b.genes.courage + b.genes.huntBias + 0.5 * b.genes.sociability - (a.genes.courage + a.genes.huntBias + 0.5 * a.genes.sociability)).slice(0, 5); if (crew.length < (big.k === 'bear' ? 5 : 4)) return;
  let n = 0; for (const s of crew) { const p = bfs(sim, s.x, s.y, 40, (i) => i === idx(big.x, big.y)); if (!p) continue; s.job = 'hunt'; s.tid = big.id; s.party = big.id; s.path = p; s.moveCd = MOVE; s.work = -1; if (v.stock.spears >= 1) { v.stock.spears--; s.armed = true; } s.thought = `group hunt: ${big.k} with ${crew.length} hunters`; n++; }
  if (n >= 4) { v.huntCool = 3; ev(sim, 'hunt', `${v.name} formed a hunting party of ${n} after a ${big.k}`, big.x, big.y); } else for (const s of crew) if (s.party === big.id) { s.party = -1; s.job = 'idle'; s.path = []; }
  void rng;
}
function computeOutlook(sim: Sim, v: Village) {
  let fN = 0, wSum = 0, bN = 0, bOk = 0, sN = 0, fiSum = 0, stoneSum = 0;
  for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) { const x = v.hx + dx, y = v.hy + dy; if (!inB(x, y)) continue; const i = idx(x, y), t = sim.terrain[i];
    if (t === T.FOREST) { fN++; wSum += sim.wood[i]; } else if (t === T.GRASS && sim.berry[i] >= 1) { bN++; if (sim.berry[i] > 1) bOk++; } else if (t === T.ROCK) stoneSum += sim.stone[i]; if (sim.fish[i] > 0 || (t !== T.WATER && nearWater(sim, i))) { sN++; fiSum += sim.fish[i]; } }
  const game = sim.deer.filter((d) => md(d.x, d.y, v.hx, v.hy) <= 20).length + sim.fauna.filter((a) => a.k !== 'bear' && md(a.x, a.y, v.hx, v.hy) <= 20).length * 0.5;
  v.outlook = { wood: fN ? clamp(wSum / (fN * 8)) : 0, berry: bN ? bOk / bN : 0, fish: sN ? clamp(fiSum / (sN * 4)) : 0, stone: clamp(stoneSum / 60), game: clamp(game / 10) };
}

function daily(sim: Sim, rng: Rng, ctx: Ctx) {
  const t = sim.tick, day = t / DAY, season = ctx.season;
  if (Math.round(day) % 8 === 0) ev(sim, 'season', `${['Spring', 'Summer', 'Autumn', 'Winter'][season]} begins (year ${Math.floor(t / YEAR) + 1})`);
  const alive = sim.villages.filter((v) => v.alive);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const A = alive[i], B = alive[j], d = md(A.hx, A.hy, B.hx, B.hy); if (d > 70) continue; const k = relKey(A.id, B.id); let r = sim.rel[k] ?? 0;
    r = r * 0.97 + rng.gauss() * 0.025; if (d < 25) r -= 0.01; if (rng.next() < 0.006) { r -= 0.45; ev(sim, 'war', `Tension between ${A.name} and ${B.name}: a border incident`, (A.hx + B.hx) / 2, (A.hy + B.hy) / 2); }
    if (d < 40 && (A.outlook.wood < 0.25 || B.outlook.wood < 0.25 || A.outlook.game < 0.1 || B.outlook.game < 0.1)) r -= 0.02;
    if (A.stock.food < 0.8 * ctx.pop[A.id] && B.stock.food > 2.5 * ctx.pop[B.id]) r -= 0.05; if (B.stock.food < 0.8 * ctx.pop[B.id] && A.stock.food > 2.5 * ctx.pop[A.id]) r -= 0.05;
    if (has(A, 'diplomacy') || has(B, 'diplomacy')) r = r * 0.94 + 0.01; sim.rel[k] = clamp(r, -1, 1);
  }
  for (const v of alive) {
    computeOutlook(sim, v); planBuildings(sim, rng, v, ctx); planTrade(sim, rng, v, ctx); planRaid(sim, rng, v, ctx); planHunt(sim, rng, v, ctx);
    const pop = ctx.pop[v.id], mem = sim.settlers.filter((s) => s.alive && s.v === v.id && s.age >= ADULT);
    if (pop >= 3 && mem.length) { const cands = (Object.keys(TECHS) as TechId[]).filter((k) => canLearn(v, k)), avgCur = mem.reduce((a, s) => a + s.genes.curiosity, 0) / mem.length;
      if (cands.length && rng.next() < 0.005 * (0.4 + avgCur) * Math.min(1.5, pop / 12)) { const tt = rng.pick(cands); learn(sim, v, tt, 'invented'); bio(rng.pick(mem), sim, `had the idea behind ${TECHS[tt].name}`); } }
    const p = 0.01 * Math.max(0, (pop - 6) / 6) + (season === 3 ? 0.008 : 0);
    if (pop >= 3 && rng.next() < p) { let n = 0; for (const s of sim.settlers) if (s.alive && s.v === v.id && rng.next() < 0.3 * (1 - 0.5 * s.genes.hardiness) * (0.7 + 0.6 * s.genes.sociability) * (has(v, 'herbalism') ? 0.6 : 1)) { s.sick = 360; n++; } if (n) ev(sim, 'fever', `A fever swept ${v.name}: ${n} fell ill`, v.hx, v.hy); }
    if (pop >= 14 && v.stock.food >= pop * 2 && sim.villages.filter((q) => q.alive).length < 6) { const site = findSite(sim, rng, v); if (site) { const movers = sim.settlers.filter((s) => s.alive && s.v === v.id && s.age >= ADULT && s.health > 0.6 && !s.ctl).slice(0, 4); if (movers.length === 4) found(sim, rng, movers, v, site[0], site[1]); } }
  }
  if (sim.deer.length < 6) for (let k = 0; k < 3; k++) { const x = 2 + rng.int(W - 4), y = 2 + rng.int(H - 4); if (sim.terrain[idx(x, y)] === T.GRASS || sim.terrain[idx(x, y)] === T.FOREST) sim.deer.push({ id: sim.nextId++, x, y, hp: 1 }); }
  if (sim.deer.length < 45) for (const d of [...sim.deer]) if (sim.deer.length < 55 && rng.next() < 0.02) { if (free(sim, d.x + 1, d.y)) sim.deer.push({ id: sim.nextId++, x: d.x + 1, y: d.y, hp: 1 }); }
  const nr = sim.fauna.filter((a) => a.k === 'rabbit'), nb = sim.fauna.filter((a) => a.k === 'boar'), nbe = sim.fauna.filter((a) => a.k === 'bear').length;
  if (nr.length < 90) for (const a of nr) if (rng.next() < 0.03 && free(sim, a.x + 1, a.y)) sim.fauna.push({ id: sim.nextId++, k: 'rabbit', x: a.x + 1, y: a.y, hp: 1, cool: 0, flee: 0 });
  if (nr.length < 8) for (let k = 0; k < 3; k++) { const x = 2 + rng.int(W - 4), y = 2 + rng.int(H - 4); if (sim.terrain[idx(x, y)] === T.GRASS) sim.fauna.push({ id: sim.nextId++, k: 'rabbit', x, y, hp: 1, cool: 0, flee: 0 }); }
  if (nb.length < 18) for (const a of nb) if (rng.next() < 0.012 && free(sim, a.x, a.y + 1)) sim.fauna.push({ id: sim.nextId++, k: 'boar', x: a.x, y: a.y + 1, hp: 3, cool: 0, flee: 0 });
  if (nb.length < 2 && rng.next() < 0.3) { const x = 2 + rng.int(W - 4), y = 2 + rng.int(H - 4); if (sim.terrain[idx(x, y)] === T.FOREST) sim.fauna.push({ id: sim.nextId++, k: 'boar', x, y, hp: 3, cool: 0, flee: 0 }); }
  if (nbe < 3 && rng.next() < 0.03) { const x = 2 + rng.int(W - 4), y = 2 + rng.int(H - 4); if (sim.terrain[idx(x, y)] === T.FOREST && sim.villages.every((v) => md(v.hx, v.hy, x, y) > 20)) sim.fauna.push({ id: sim.nextId++, k: 'bear', x, y, hp: 6, cool: 0, flee: 0 }); }
  if (sim.wolves.length < 5 && rng.next() < 0.4) { const x = rng.next() < 0.5 ? 1 : W - 2, y = 1 + rng.int(H - 2); if (sim.terrain[idx(x, y)] !== T.WATER) sim.wolves.push({ id: sim.nextId++, x, y, hp: 1, cool: 0, flee: 0 }); }
  if (alive.length < 3 && t % YEAR < DAY) { const site = findSite(sim, rng); if (site) { const ms: Settler[] = []; const gn = newGenes(rng); for (let k = 0; k < 6; k++) { const g2 = { ...gn }; for (const key of GENES) g2[key] = clamp(g2[key] + rng.gauss() * 0.1); ms.push(mkSettler(sim, rng, 0, site[0], site[1], ADULT + rng.int(YEAR * 2), g2)); } sim.settlers.push(...ms); found(sim, rng, ms, null, site[0], site[1]); } }
  const byV: DayStat['byV'] = {}; for (const v of sim.villages) { if (!v.alive) continue; const mem = sim.settlers.filter((s) => s.alive && s.v === v.id); byV[v.id] = { pop: mem.length, food: Math.round(v.stock.food), wood: Math.round(v.stock.wood), g: GENES.map((k) => (mem.length ? mem.reduce((a, s) => a + s.genes[k], 0) / mem.length : 0)) }; }
  sim.stats.push({ day: Math.round(day), year: t / YEAR, pop: sim.settlers.filter((s) => s.alive).length, deer: sim.deer.length, wolves: sim.wolves.length, births: sim.totals.births, deaths: Object.values(sim.totals.deaths).reduce((a, b) => a + b, 0), byV, causes: { ...sim.totals.deaths } });
  if (sim.stats.length > 1500) sim.stats.splice(0, sim.stats.length - 1500);
}

export function stepSim(sim: Sim, n = 1): void {
  const rng = new Rng(0); rng.state = sim.rs;
  for (let k = 0; k < n; k++) {
    const t = ++sim.tick, night = isNight(t), season = seasonOf(t);
    const pop = sim.villages.map((v) => popCount(sim, v)), deerSet = new Set<number>(); POP = pop; for (const d of sim.deer) deerSet.add(idx(d.x, d.y)); for (const a of sim.fauna) if (a.k === 'rabbit') deerSet.add(idx(a.x, a.y));
    const palis: [number, number][] = []; for (const v of sim.villages) if (v.alive) for (const b of v.buildings) if (b.type === 'palisade' && b.built) palis.push([b.x, b.y]);
    const ctx: Ctx = { night, season, pop, deerSet, palis };
    for (const v of sim.villages) { if (!v.alive) continue; if (t % 12 === 0 && (season === 3 || (night && season !== 1)) && v.stock.wood >= 1) { v.stock.wood--; v.fireUntil = t + 14; } v.fire = t < v.fireUntil;
      for (const b of v.buildings) if (b.type === 'farm' && b.built) b.crop = Math.min(1, b.crop + (season === 3 ? 0.0004 : 0.0011) * (has(v, 'irrigation') ? 1.5 : 1));
      let sp = built(v, 'granary') ? 0.00008 : 0.0003; if (built(v, 'smokehouse')) sp *= 0.4; if (has(v, 'curing')) sp *= 0.5; v.stock.food = Math.max(0, v.stock.food * (1 - sp)); }
    for (let r = 0; r < 60; r++) { const i = rng.int(W * H), tt = sim.terrain[i];
      if (tt === T.FOREST) { if (sim.wood[i] > 0 && sim.wood[i] < 12 && rng.next() < (season === 3 ? 0.25 : 0.5)) sim.wood[i]++; else if (sim.wood[i] === 0 && rng.next() < 0.12) { const x = i % W, y = (i / W) | 0; if (D4.some(([dx, dy]) => inB(x + dx, y + dy) && sim.wood[idx(x + dx, y + dy)] >= 4)) sim.wood[i] = 1; } }
      else if (tt === T.GRASS && sim.berry[i] >= 1 && sim.berry[i] < 4 && (season !== 3 || rng.next() < 0.2)) sim.berry[i]++;
      if (tt !== T.WATER && sim.fish[i] < 6 && nearWater(sim, i) && rng.next() < (season === 3 ? 0.1 : 0.35) * (sim.fish[i] === 0 ? 0.5 : 1)) sim.fish[i]++; }
    for (const s of sim.settlers) if (s.alive) { const v = sim.villages[s.v]; if (v) stepSettler(sim, rng, s, v, ctx); }
    stepWolves(sim, rng, ctx); stepDeer(sim, rng); stepFauna(sim, rng, ctx);
    if (t % 20 === 0) for (const v of sim.villages) if (v.alive) breed(sim, rng, v, ctx);
    if (sim.settlers.some((s) => !s.alive)) sim.settlers = sim.settlers.filter((s) => s.alive);
    for (const v of sim.villages) if (v.alive) { const p = popCount(sim, v); v.peak = Math.max(v.peak, p); if (p === 0) { v.alive = false; sim.totals.fell++; ev(sim, 'village', `${v.name} has fallen: no one is left`, v.hx, v.hy); } }
    if (t % DAY === 0) daily(sim, rng, ctx);
  }
  sim.rs = rng.state;
}

// ---- player control of a settler ----
export type CtlCmd = { k: 'possess'; id: number } | { k: 'release' } | { k: 'smove'; dx: number; dy: number } | { k: 'sact' } | { k: 'sfight' } | { k: 'sdeposit' } | { k: 'sgive' };
export function controlCmd(sim: Sim, c: CtlCmd): void {
  const rng = new Rng(0); rng.state = sim.rs;
  if (c.k === 'possess') { for (const s of sim.settlers) s.ctl = false; const t = sim.settlers.find((s) => s.id === c.id && s.alive && s.age >= ADULT); if (t) { t.ctl = true; t.job = 'idle'; t.path = []; t.work = -1; t.tid = -1; t.party = -1; t.trade = null; t.raid = -1; ev(sim, 'you', `You now control ${t.name} of ${sim.villages[t.v]?.name}`, t.x, t.y, t.id); } sim.rs = rng.state; return; }
  if (c.k === 'release') { for (const s of sim.settlers) s.ctl = false; return; }
  const me = sim.settlers.find((s) => s.ctl && s.alive); if (!me) return; const v = sim.villages[me.v], i = idx(me.x, me.y);
  const run = (job: Job) => { me.job = job; me.work = -1; complete(sim, rng, me, v); me.job = 'idle'; };
  if (c.k === 'smove') { const nx = me.x + Math.sign(c.dx), ny = me.y + Math.sign(c.dy); if (free(sim, nx, ny)) { me.x = nx; me.y = ny; } }
  else if (c.k === 'sact') {
    const b = bAt(sim, i), home = md(me.x, me.y, v.hx, v.hy) <= 1;
    if (me.thirst > 0.15 && (nearWater(sim, i) || isWell(sim, i, v))) run('drink');
    else if (b && b.v.id === v.id && !b.b.built) run('build'); else if (b && b.v.id === v.id && b.b.type === 'farm' && b.b.crop >= 0.6) run('farm'); else if (b && b.v.id === v.id && b.b.type === 'workshop' && b.b.built) run('craft');
    else if (sim.berry[i] > 1) run('forage'); else if (sim.fish[i] > 0) run('fish'); else if (sim.wood[i] > 0) run('wood'); else if (sim.stone[i] > 0) run('stone'); else if (sim.terrain[i] === T.FOREST && sim.wood[i] <= 2) run('plant');
    else if (me.hunger > 0.2 && home && v.stock.food >= 1) run('eat'); else if (me.hunger > 0.3 && me.carry.food > 0) { me.carry.food--; me.hunger = Math.max(0, me.hunger - 0.5); }
  } else if (c.k === 'sdeposit') { if (md(me.x, me.y, v.hx, v.hy) <= 2) run('deposit'); }
  else if (c.k === 'sgive') { let best: Settler | null = null, bd = 3; for (const o of sim.settlers) { const d = md(o.x, o.y, me.x, me.y); if (o !== me && o.alive && d < bd && o.hunger > 0.3) { bd = d; best = o; } } if (best && me.carry.food > 0) { me.carry.food--; best.hunger = Math.max(0, best.hunger - 0.5); best.thought = `fed by ${me.name}`; ev(sim, 'you', `${me.name} gave food to ${best.name}`, best.x, best.y, best.id); } }
  else if (c.k === 'sfight') {
    const pr = predators(sim).find((p) => md(p.x, p.y, me.x, me.y) <= 1); if (pr) { hitPredator(sim, me, v, pr); sim.rs = rng.state; return; }
    const foe = sim.settlers.find((o) => o.alive && o.v !== me.v && o.job === 'raid' && o.raid === me.v && md(o.x, o.y, me.x, me.y) <= 1); if (foe) { me.job = 'defend'; hit(sim, me, foe, v); me.job = 'idle'; sim.rs = rng.state; return; }
    const an = [...sim.deer, ...sim.fauna].find((a) => md(a.x, a.y, me.x, me.y) <= 1); if (an) { if ('k' in an && (an.k === 'boar' || an.k === 'bear')) me.party = an.id; const tg = animalById(sim, an.id); if (tg) huntHit(sim, rng, me, v, tg); }
  }
  sim.rs = rng.state;
}
export { makeName };
export { CAUSES } from './types';
