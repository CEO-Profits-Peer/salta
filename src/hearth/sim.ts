import { Rng } from '../engine/rng';
import { ADULT, CAUSES, DAY, DOCTRINE_KEYS, GENES, T, W, H, YEAR, type BType, type Cause, type DayStat, type Doctrine, type Genes, type Job, type Settler, type Sim, type Village } from './types';
import { buildingAt, idx, inB, isNight, makeName, mkSettler, mkVillage, newGenes, seasonOf, DOCTRINES } from './world';

const HUNGER = 0.0022, THIRST = 0.0016, MOVE = 3, COLD = [0.0004, 0, 0.0004, 0.0022];
const WORK: Partial<Record<Job, number>> = { drink: 3, eat: 2, forage: 5, farm: 6, wood: 6, stone: 8, build: 5, deposit: 2, warm: 30 };
const COST: Record<BType, { wood: number; stone: number }> = { hearth: { wood: 0, stone: 0 }, hut: { wood: 8, stone: 0 }, farm: { wood: 6, stone: 0 }, well: { wood: 2, stone: 6 }, granary: { wood: 10, stone: 4 }, palisade: { wood: 12, stone: 6 } };
const BWORK: Record<BType, number> = { hearth: 1, hut: 40, farm: 30, well: 30, granary: 50, palisade: 60 };
const CODE: Record<BType, number> = { hearth: 1, hut: 2, farm: 3, well: 4, granary: 5, palisade: 6 };
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const md = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);
const D4: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const stamp = new Int32Array(W * H), par = new Int32Array(W * H), dist = new Int16Array(W * H), queue = new Int32Array(W * H); let cur = 0;

export function ev(sim: Sim, k: string, text: string, x?: number, y?: number, sid?: number) { sim.events.push({ t: sim.tick, k, text, x, y, sid }); if (sim.events.length > 400) sim.events.splice(0, sim.events.length - 400); }
const bio = (s: Settler, sim: Sim, text: string) => { if (s.bio.length < 40) s.bio.push(`Y${(sim.tick / YEAR).toFixed(1)}: ${text}`); };

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
const isWell = (sim: Sim, i: number, v: Village) => sim.bld[i] === v.id * 8 + CODE.well && !!v.buildings.find((b) => b.type === 'well' && b.built && idx(b.x, b.y) === i);
interface Ctx { night: boolean; season: number; pop: number[]; deerSet: Set<number>; palis: [number, number][] }
const popCount = (sim: Sim, v: Village) => sim.settlers.reduce((n, s) => n + (s.alive && s.v === v.id ? 1 : 0), 0);
const capacity = (v: Village) => Math.min(26, 8 + 4 * v.buildings.filter((b) => b.type === 'hut' && b.built).length);

function die(sim: Sim, s: Settler, cause: Cause) {
  if (!s.alive) return; s.alive = false; const v = sim.villages[s.v]; if (v) { v.deaths++; if (cause === 'wolf') v.lastWolfDeath = sim.tick; }
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

function think(sim: Sim, rng: Rng, s: Settler, v: Village, ctx: Ctx) {
  const g = s.genes, R = 10 + Math.round(18 * g.curiosity), home = idx(v.hx, v.hy);
  if (s.age < ADULT) {
    if (s.thirst > 0.45 && go(sim, s, 'drink', (i) => sim.terrain[i] !== T.WATER && (nearWater(sim, i) || isWell(sim, i, v)), 40, 'thirsty child: heading to water')) return;
    if (s.hunger > 0.45 && v.stock.food >= 1 && go(sim, s, 'eat', (i) => i === home, 60, 'hungry child: asking for food')) return;
    wander(sim, rng, s, v, 'playing near the hearth'); return;
  }
  if (s.hunger > 0.5 && s.carry.food > 0) { s.carry.food--; s.hunger = Math.max(0, s.hunger - 0.5); }
  if (s.thirst > 0.5 && go(sim, s, 'drink', (i) => sim.terrain[i] !== T.WATER && (nearWater(sim, i) || isWell(sim, i, v)), 40, `thirsty (${Math.round(s.thirst * 100)}%): heading to water`)) return;
  if (s.hunger > 0.55) {
    if (v.stock.food >= 1 && go(sim, s, 'eat', (i) => i === home, 60, `hungry (${Math.round(s.hunger * 100)}%): eating from the stores`)) return;
    if (g.huntBias > 0.5 && go(sim, s, 'hunt', (i) => ctx.deerSet.has(i), R + 8, 'hungry: hunting a deer')) { s.tid = -1; return; }
    if (go(sim, s, 'forage', (i) => sim.berry[i] > 1, R, 'hungry: foraging berries')) return;
  }
  if (s.cold > 0.55 && v.fire && go(sim, s, 'warm', (i) => md(i % W, (i / W) | 0, v.hx, v.hy) <= 2, 40, `cold (${Math.round(s.cold * 100)}%): warming at the fire`)) return;
  const c = s.carry; if (c.food >= 5 || c.wood >= 6 || c.stone >= 6 || ((c.food + c.wood + c.stone) > 0 && s.cool > 0)) { if (go(sim, s, 'deposit', (i) => i === home, 60, 'carrying goods to the stockpile')) return; }
  // ---- work choice: village needs x doctrine x personal traits ----
  const pop = Math.max(1, ctx.pop[v.id]), d = v.doctrine, pend = v.buildings.find((b) => !b.built), st = v.stock;
  const foodT = pop * (2.5 + 3.5 * d.stock), woodT = 14 + pop * (2 + (ctx.season >= 2 ? 3 : 0)) + (pend ? COST[pend.type].wood : 0), stoneT = 6 + (pend ? COST[pend.type].stone : 0) + 6 * d.defend;
  const needF = clamp((foodT - st.food) / foodT), needW = clamp((woodT - st.wood) / woodT), needS = clamp((stoneT - st.stone) / stoneT);
  const farmReady = v.buildings.some((b) => b.type === 'farm' && b.built && b.crop >= 0.6);
  const opts: [Job, number][] = [
    ['forage', needF * (0.4 + 0.6 * (1 - d.hunt)) * (1 - 0.6 * g.huntBias) * (ctx.season === 3 ? 0.4 : 1)], ['hunt', needF * d.hunt * (0.2 + g.huntBias) * (g.courage > 0.25 ? 1 : 0.3)],
    ['farm', farmReady ? (0.25 + needF) * d.farm * (1.1 - g.huntBias * 0.6) : 0], ['wood', needW * (0.5 + 0.6 * d.build)], ['stone', needS * (0.35 + 0.4 * d.build + 0.4 * d.defend)],
    ['build', pend && st.wood >= 0 ? 1.4 * d.build * (0.4 + g.industry) : 0], ['idle', 0.12 * (1.2 - g.industry)],
  ];
  const tot = opts.reduce((a, o) => a + o[1] * (o[0] === 'idle' ? 1 : 0.4 + g.industry), 0); let r = rng.next() * tot, pick: Job = 'idle';
  for (const o of opts) { r -= o[1] * (o[0] === 'idle' ? 1 : 0.4 + g.industry); if (r <= 0) { pick = o[0]; break; } }
  const mine = (i: number) => sim.bld[i] >= v.id * 8 && sim.bld[i] < v.id * 8 + 8;
  const t = `${pick} (food ${Math.round(needF * 100)}% short, wood ${Math.round(needW * 100)}%)`;
  const ok = pick === 'forage' ? go(sim, s, 'forage', (i) => sim.berry[i] > 1, R, `foraging: ${t}`)
    : pick === 'hunt' ? go(sim, s, 'hunt', (i) => ctx.deerSet.has(i), R + 8, `hunting: ${t}`)
    : pick === 'farm' ? go(sim, s, 'farm', (i) => { const b = buildingAt(sim, i % W, (i / W) | 0); return !!b && b.v.id === v.id && b.b.type === 'farm' && b.b.built && b.b.crop >= 0.6; }, 40, `tending the farm: ${t}`)
    : pick === 'wood' ? go(sim, s, 'wood', (i) => sim.wood[i] > 0, R, `cutting wood: ${t}`)
    : pick === 'stone' ? go(sim, s, 'stone', (i) => sim.stone[i] > 0, R + 6, `quarrying stone: ${t}`)
    : pick === 'build' ? go(sim, s, 'build', (i) => { const b = buildingAt(sim, i % W, (i / W) | 0); return !!b && mine(i) && !b.b.built; }, 40, `building a ${pend?.type}`) : false;
  if (!ok && pick !== 'idle') {
    // fallback: the planned job found nothing in reach, so try the other ways to cover the same need before giving up
    const alt = needF >= needW ? ['farm', 'hunt', 'forage', 'wood', 'stone'] : ['wood', 'stone', 'forage', 'hunt', 'farm']; const R2 = R + 10;
    for (const a of alt) { if (a === pick) continue;
      const done = a === 'forage' ? go(sim, s, 'forage', (i) => sim.berry[i] > 1, R2, 'foraging farther afield')
        : a === 'hunt' ? go(sim, s, 'hunt', (i) => ctx.deerSet.has(i), R2 + 10, 'hunting farther afield')
        : a === 'farm' ? farmReady && go(sim, s, 'farm', (i) => { const b = buildingAt(sim, i % W, (i / W) | 0); return !!b && b.v.id === v.id && b.b.type === 'farm' && b.b.built && b.b.crop >= 0.6; }, 40, 'tending the farm')
        : a === 'wood' ? go(sim, s, 'wood', (i) => sim.wood[i] > 0, R2, 'cutting wood') : go(sim, s, 'stone', (i) => sim.stone[i] > 0, R2, 'quarrying stone');
      if (done) return; }
  }
  if (!ok) { wander(sim, rng, s, v, pick === 'idle' ? 'resting' : `wanted to ${pick}, nothing in reach`); }
}

function complete(sim: Sim, rng: Rng, s: Settler, v: Village) {
  const i = idx(s.x, s.y), g = s.genes;
  switch (s.job) {
    case 'drink': if (nearWater(sim, i) || isWell(sim, i, v)) s.thirst = Math.max(0, s.thirst - 0.75); break;
    case 'eat': if (v.stock.food >= 1) { v.stock.food--; s.hunger = Math.max(0, s.hunger - 0.5); } break;
    case 'forage': if (sim.berry[i] > 1) { sim.berry[i]--; s.carry.food += 2; if (s.hunger > 0.5) { s.carry.food--; s.hunger = Math.max(0, s.hunger - 0.5); } } break;
    case 'wood': if (sim.wood[i] > 0) { sim.wood[i]--; s.carry.wood += 2; } break;
    case 'stone': if (sim.stone[i] > 0) { sim.stone[i]--; s.carry.stone += 2; } break;
    case 'farm': { const b = buildingAt(sim, s.x, s.y); if (b && b.b.type === 'farm' && b.b.crop >= 0.6) { s.carry.food += Math.round(14 * b.b.crop); b.b.crop = 0; } break; }
    case 'deposit': v.stock.food = Math.min(v.stock.food + s.carry.food, 60 + (v.buildings.some((b) => b.type === 'granary' && b.built) ? 90 : 0)); v.stock.wood += s.carry.wood; v.stock.stone += s.carry.stone; s.carry = { food: 0, wood: 0, stone: 0 }; break;
    case 'build': { const b = buildingAt(sim, s.x, s.y); if (b && !b.b.built) { b.b.progress += (1 / BWORK[b.b.type]) * (0.7 + 0.6 * g.industry) * 5; if (b.b.progress >= 1) { b.b.built = true; b.b.progress = 1; sim.totals.builds++; ev(sim, 'build', `${v.name} finished a ${b.b.type}`, b.b.x, b.b.y); bio(s, sim, `helped finish a ${b.b.type} in ${v.name}`); } } break; }
    default: break;
  }
  void rng;
}

function stepSettler(sim: Sim, rng: Rng, s: Settler, v: Village, ctx: Ctx) {
  const g = s.genes, child = s.age < ADULT, t = sim.tick;
  s.age++; if (s.cool > 0) s.cool--;
  const metab = 1.15 - 0.3 * g.hardiness + 0.15 * g.industry;
  s.hunger = Math.min(1, s.hunger + HUNGER * metab * (child ? 0.6 : 1)); s.thirst = Math.min(1, s.thirst + THIRST * metab * (child ? 0.7 : 1));
  const fire = v.fire && md(s.x, s.y, v.hx, v.hy) <= 5, hut = v.buildings.some((b) => b.type === 'hut' && b.built && md(s.x, s.y, b.x, b.y) <= 2);
  const cr = COLD[ctx.season] * (ctx.night ? 1.5 : 1) * (1.15 - 0.45 * g.hardiness);
  if (fire) s.cold = Math.max(0, s.cold - 0.006); else if (cr < 0.0005) s.cold = Math.max(0, s.cold - 0.002); else s.cold = Math.min(1, s.cold + cr * (hut ? 0.35 : 1));
  let dmg = 0, src: Cause | '' = '';
  if (s.hunger >= 1) { dmg += 0.0035; src = 'starvation'; } if (s.thirst >= 1) { dmg += 0.006; src = 'thirst'; } if (s.cold >= 1) { dmg += 0.003; src = 'cold'; }
  if (s.sick > 0) { dmg += 0.0014; s.sick--; if (!src) src = 'fever'; }
  if (dmg > 0) { s.health -= dmg; s.lastHit = src; } else if (s.hunger < 0.7 && s.thirst < 0.7 && s.cold < 0.7) s.health = Math.min(1, s.health + 0.0015);
  const ay = s.age / YEAR; if (ay > 6 && rng.next() < 0.0000030 * (ay - 6) ** 2) { die(sim, s, 'old age'); return; }
  if (!child && rng.next() < 0.0000022) { die(sim, s, 'accident'); return; }
  if (s.health <= 0) { die(sim, s, (s.lastHit || 'starvation') as Cause); return; }
  if (t % 5 === s.id % 5 && !child && s.job !== 'drink' && s.job !== 'eat' && s.job !== 'flee' && s.job !== 'fight' && (s.thirst > 0.8 || s.hunger > 0.9 || s.cold > 0.9)) { s.job = 'idle'; s.path = []; s.work = -1; s.cool = 0; s.tid = -1; }
  // ---- danger: wolves ----
  if (t % 3 === (s.id % 3) && !child) {
    let wd = 99, wolf = null as null | (typeof sim.wolves)[number]; for (const w of sim.wolves) { const d = md(w.x, w.y, s.x, s.y); if (d < wd) { wd = d; wolf = w; } }
    const rad = 3 + 3 * (1 - g.courage);
    if (wolf && wd <= rad && s.job !== 'flee' && s.job !== 'fight') {
      const mates = sim.settlers.filter((o) => o !== s && o.alive && o.v === s.v && o.age >= ADULT && md(o.x, o.y, s.x, s.y) <= 3).length;
      if (g.courage > 0.55 && mates >= 1) { s.job = 'fight'; s.tid = wolf.id; s.path = []; s.thought = `fighting a wolf (courage ${Math.round(g.courage * 100)}%, ${mates} ally)`; bio(s, sim, 'stood against a wolf'); }
      else { s.job = 'flee'; s.path = bfs(sim, s.x, s.y, 40, (i) => i === idx(v.hx, v.hy)) ?? []; s.moveCd = 1; s.thought = `fleeing a wolf (${wd} tiles away)`; }
    } else if ((s.job === 'flee' || s.job === 'fight') && (!wolf || wd > 8)) { s.job = 'idle'; s.path = []; s.tid = -1; }
  }
  if (s.job === 'fight') {
    const w = sim.wolves.find((q) => q.id === s.tid); if (!w) { s.job = 'idle'; return; }
    if (md(w.x, w.y, s.x, s.y) <= 1) { if (s.atk-- <= 0) { s.atk = 4; w.hp -= 0.2 + 0.18 * g.courage; if (w.hp <= 0) { sim.wolves.splice(sim.wolves.indexOf(w), 1); s.carry.food += 6; s.job = 'idle'; ev(sim, 'wolf', `${s.name} of ${v.name} killed a wolf`, s.x, s.y, s.id); bio(s, sim, 'killed a wolf'); } } return; }
    if (s.path.length === 0 || t % 4 === 0) s.path = bfs(sim, s.x, s.y, 12, (i) => i === idx(w.x, w.y)) ?? []; if (!s.path.length) { s.job = 'flee'; return; }
  }
  if (s.job === 'hunt') {
    if (s.tid < 0) { const dp = ctx.deerSet; let best: (typeof sim.deer)[number] | null = null, bd = 1e9; for (const d of sim.deer) { const dd = md(d.x, d.y, s.x, s.y); if (dd < bd && dp.has(idx(d.x, d.y))) { bd = dd; best = d; } } if (!best) { s.job = 'idle'; return; } s.tid = best.id; }
    const d = sim.deer.find((q) => q.id === s.tid); if (!d) { s.job = 'idle'; s.tid = -1; return; }
    if (md(d.x, d.y, s.x, s.y) <= 1) { if (s.atk-- <= 0) { s.atk = 3; if (rng.next() < 0.4 + 0.4 * g.courage) { sim.deer.splice(sim.deer.indexOf(d), 1); s.carry.food += 8; s.job = 'idle'; s.tid = -1; s.thought = 'brought down a deer'; bio(s, sim, 'brought down a deer'); } } return; }
    if (!s.path.length || t % 4 === 0) { const p = bfs(sim, s.x, s.y, 30, (i) => i === idx(d.x, d.y)); if (!p) { s.job = 'idle'; s.tid = -1; return; } s.path = p; }
  }
  // ---- move / work / think ----
  if (s.path.length) { if (--s.moveCd <= 0) { const n = s.path[0]; if (sim.terrain[n] === T.WATER) { s.path = []; return; } s.path.shift(); s.x = n % W; s.y = (n / W) | 0; s.moveCd = MOVE; } return; }
  if (child && s.job === 'idle' && s.cool > 0 && (s.thirst > 0.45 || s.hunger > 0.45)) s.cool = 0;
  if (s.job === 'idle' || s.job === 'flee' || s.job === 'fight' || s.job === 'hunt') { if (s.job !== 'idle') { if (s.job === 'flee' && s.path.length === 0) { s.job = 'idle'; } return; } if (s.cool > 0) return; think(sim, rng, s, v, ctx); return; }
  if (s.work < 0) s.work = WORK[s.job] ?? 3;
  if (--s.work <= 0) { complete(sim, rng, s, v); s.job = 'idle'; s.work = -1; }
}

function nearestSettlerDist(sim: Sim, x: number, y: number): [number, Settler | null] { let bd = 99, b: Settler | null = null; for (const s of sim.settlers) { if (!s.alive) continue; const d = md(s.x, s.y, x, y); if (d < bd) { bd = d; b = s; } } return [bd, b]; }
const nearPalisade = (ctx: Ctx, x: number, y: number) => ctx.palis.some((p) => md(p[0], p[1], x, y) <= 6);

function stepWolves(sim: Sim, rng: Rng, ctx: Ctx) {
  for (const w of sim.wolves) {
    if (w.cool > 0) w.cool--; if (sim.tick % 2) continue;
    const [d, s] = nearestSettlerDist(sim, w.x, w.y); const grp = sim.settlers.filter((o) => o.alive && md(o.x, o.y, w.x, w.y) <= 3).length;
    let dx = 0, dy = 0;
    if (w.flee > 0 || w.hp < 0.35 || grp >= 3) { if (w.flee <= 0) w.flee = 20; w.flee--; if (s) { dx = -Math.sign(s.x - w.x); dy = -Math.sign(s.y - w.y); } }
    else if (s && d <= 8) { const adx = Math.abs(s.x - w.x), ady = Math.abs(s.y - w.y); if (d <= 1) { if (w.cool === 0) { s.health -= 0.13; s.lastHit = 'wolf'; w.cool = 6; } continue; } if (adx >= ady) dx = Math.sign(s.x - w.x); else dy = Math.sign(s.y - w.y); }
    else if (rng.next() < 0.5) { const [a, b] = rng.pick(D4); dx = a; dy = b; }
    const nx = w.x + dx, ny = w.y + dy; if (inB(nx, ny) && sim.terrain[idx(nx, ny)] !== T.WATER && !nearPalisade(ctx, nx, ny)) { w.x = nx; w.y = ny; }
    else if (dx || dy) { const [a, b] = rng.pick(D4); const mx = w.x + a, my = w.y + b; if (inB(mx, my) && sim.terrain[idx(mx, my)] !== T.WATER && !nearPalisade(ctx, mx, my)) { w.x = mx; w.y = my; } }
  }
}
function stepDeer(sim: Sim, rng: Rng) {
  if (sim.tick % 4) return;
  for (const d of sim.deer) {
    let dx = 0, dy = 0; const [dd, s] = nearestSettlerDist(sim, d.x, d.y);
    if (s && dd <= 3 && rng.next() < 0.85) { dx = -Math.sign(s.x - d.x); dy = -Math.sign(s.y - d.y); } else if (rng.next() < 0.4) { const [a, b] = rng.pick(D4); dx = a; dy = b; } else continue;
    const nx = d.x + dx, ny = d.y + dy; if (inB(nx, ny) && sim.terrain[idx(nx, ny)] !== T.WATER) { d.x = nx; d.y = ny; }
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
  const c = COST[type]; if (v.stock.wood < c.wood || v.stock.stone < c.stone) return false;
  for (let k = 0; k < 40; k++) { const x = v.hx + rng.int(15) - 7, y = v.hy + rng.int(15) - 7, d = md(x, y, v.hx, v.hy); if (!inB(x, y) || d < 2 || d > 8 || sim.bld[idx(x, y)] || (sim.terrain[idx(x, y)] !== T.GRASS && sim.terrain[idx(x, y)] !== T.SAND)) continue;
    v.stock.wood -= c.wood; v.stock.stone -= c.stone; v.buildings.push({ type, x, y, built: false, progress: 0, crop: 0 }); sim.bld[idx(x, y)] = v.id * 8 + CODE[type]; ev(sim, 'plan', `${v.name} started a ${type}`, x, y); return true; }
  return false;
}
function planBuildings(sim: Sim, rng: Rng, v: Village, ctx: Ctx) {
  if (v.buildings.some((b) => !b.built)) return; const pop = ctx.pop[v.id], d = v.doctrine, has = (t: BType) => v.buildings.filter((b) => b.type === t).length;
  const waterNear = (() => { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (inB(v.hx + dx, v.hy + dy) && sim.terrain[idx(v.hx + dx, v.hy + dy)] === T.WATER) return true; return false; })();
  if (pop >= capacity(v) - 2 && has('hut') < 5 && placeBuilding(sim, rng, v, 'hut')) return;
  if (!waterNear && !has('well') && placeBuilding(sim, rng, v, 'well')) return;
  if (d.farm > 0.25 && has('farm') < 1 + Math.floor((pop * d.farm) / 3) && placeBuilding(sim, rng, v, 'farm')) return;
  if (!has('granary') && d.stock > 0.5 && v.stock.food > 15 && placeBuilding(sim, rng, v, 'granary')) return;
  if (!has('palisade') && d.defend > 0.45 && (sim.tick - v.lastWolfDeath < YEAR * 2 || pop >= 10) && placeBuilding(sim, rng, v, 'palisade')) return;
}
const mutateDoctrine = (d: Doctrine, rng: Rng): Doctrine => { const o = {} as Doctrine; for (const k of DOCTRINE_KEYS) o[k] = clamp(d[k] + rng.gauss() * 0.15); return o; };

function found(sim: Sim, rng: Rng, members: Settler[], parent: Village | null, x: number, y: number) {
  const doctrine = parent && rng.next() > 0.15 ? mutateDoctrine(parent.doctrine, rng) : mutateDoctrine(rng.pick(DOCTRINES), rng);
  const v = mkVillage(sim, rng, x, y, doctrine, parent?.id ?? -1); v.stock = { food: 8, wood: 10, stone: 2 }; if (parent) { parent.stock.food = Math.max(0, parent.stock.food - 8); parent.stock.wood = Math.max(0, parent.stock.wood - 10); }
  for (const s of members) { s.v = v.id; s.x = x; s.y = y; s.path = []; s.job = 'idle'; s.work = -1; bio(s, sim, `left ${parent?.name ?? 'the wilds'} to found ${v.name}`); } sim.totals.founded++;
  ev(sim, 'village', `${v.name} was founded${parent ? ` by migrants from ${parent.name}` : ' by newcomers'}`, x, y); return v;
}
function findSite(sim: Sim, rng: Rng, near?: Village): [number, number] | null {
  for (let k = 0; k < 120; k++) { const x = 6 + rng.int(W - 12), y = 6 + rng.int(H - 12), i = idx(x, y); if (sim.terrain[i] !== T.GRASS || sim.bld[i] || !nearWater(sim, i) && !(() => { for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (sim.terrain[idx(x + dx, y + dy)] === T.WATER) return true; return false; })()) continue;
    if (sim.villages.some((v) => md(v.hx, v.hy, x, y) < 14)) continue; if (near && md(near.hx, near.hy, x, y) > 36) continue; return [x, y]; }
  return null;
}

function daily(sim: Sim, rng: Rng, ctx: Ctx) {
  const t = sim.tick, day = t / DAY, season = ctx.season;
  if (Math.round(day) % 8 === 0) ev(sim, 'season', `${['Spring', 'Summer', 'Autumn', 'Winter'][season]} begins (year ${Math.floor(t / YEAR) + 1})`);
  const alive = sim.villages.filter((v) => v.alive);
  for (const v of alive) {
    planBuildings(sim, rng, v, ctx);
    const pop = ctx.pop[v.id], p = 0.01 * Math.max(0, (pop - 6) / 6) + (season === 3 ? 0.008 : 0);
    if (pop >= 3 && rng.next() < p) { let n = 0; for (const s of sim.settlers) if (s.alive && s.v === v.id && rng.next() < 0.3 * (1 - 0.5 * s.genes.hardiness) * (0.7 + 0.6 * s.genes.sociability)) { s.sick = 360; n++; } if (n) ev(sim, 'fever', `A fever swept ${v.name}: ${n} fell ill`, v.hx, v.hy); }
    if (pop >= 14 && v.stock.food >= pop * 2 && sim.villages.filter((q) => q.alive).length < 6) {
      const site = findSite(sim, rng, v); if (site) { const movers = sim.settlers.filter((s) => s.alive && s.v === v.id && s.age >= ADULT && s.health > 0.6).slice(0, 4); if (movers.length === 4) found(sim, rng, movers, v, site[0], site[1]); }
    }
  }
  if (sim.deer.length < 10) for (let k = 0; k < 3; k++) { const x = 2 + rng.int(W - 4), y = 2 + rng.int(H - 4); if (sim.terrain[idx(x, y)] === T.GRASS || sim.terrain[idx(x, y)] === T.FOREST) sim.deer.push({ id: sim.nextId++, x, y, hp: 1 }); }
  if (sim.deer.length < 45) for (const d of [...sim.deer]) if (sim.deer.length < 55 && rng.next() < 0.02) { const nx = d.x + rng.int(3) - 1, ny = d.y + rng.int(3) - 1; if (inB(nx, ny) && sim.terrain[idx(nx, ny)] !== T.WATER) sim.deer.push({ id: sim.nextId++, x: nx, y: ny, hp: 1 }); }
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
    const pop = sim.villages.map((v) => popCount(sim, v)), deerSet = new Set<number>(); for (const d of sim.deer) deerSet.add(idx(d.x, d.y));
    const palis: [number, number][] = []; for (const v of sim.villages) if (v.alive) for (const b of v.buildings) if (b.type === 'palisade' && b.built) palis.push([b.x, b.y]);
    const ctx: Ctx = { night, season, pop, deerSet, palis };
    // fire, farms, regrowth, spoilage
    for (const v of sim.villages) { if (!v.alive) continue; if (t % 12 === 0 && (season === 3 || (night && season !== 1)) && v.stock.wood >= 1) { v.stock.wood--; v.fireUntil = t + 14; } v.fire = t < v.fireUntil;
      for (const b of v.buildings) if (b.type === 'farm' && b.built) b.crop = Math.min(1, b.crop + (season === 3 ? 0.0004 : 0.0011));
      v.stock.food = Math.max(0, v.stock.food * (1 - (v.buildings.some((b) => b.type === 'granary' && b.built) ? 0.00008 : 0.0003))); }
    for (let r = 0; r < 60; r++) { const i = rng.int(W * H), tt = sim.terrain[i]; if (tt === T.FOREST && sim.wood[i] < 12 && rng.next() < 0.5) sim.wood[i]++; else if (tt === T.GRASS && sim.berry[i] >= 1 && sim.berry[i] < 4 && (season !== 3 || rng.next() < 0.2)) sim.berry[i]++; }
    for (const s of sim.settlers) if (s.alive) { const v = sim.villages[s.v]; if (v) stepSettler(sim, rng, s, v, ctx); }
    stepWolves(sim, rng, ctx); stepDeer(sim, rng);
    if (t % 20 === 0) for (const v of sim.villages) if (v.alive) breed(sim, rng, v, ctx);
    if (sim.settlers.some((s) => !s.alive)) sim.settlers = sim.settlers.filter((s) => s.alive);
    for (const v of sim.villages) if (v.alive) { const p = popCount(sim, v); v.peak = Math.max(v.peak, p); if (p === 0) { v.alive = false; sim.totals.fell++; ev(sim, 'village', `${v.name} has fallen: no one is left`, v.hx, v.hy); } }
    if (t % DAY === 0) daily(sim, rng, ctx);
  }
  sim.rs = rng.state;
}
export { CAUSES, makeName };
