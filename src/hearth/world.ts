import { Rng } from '../engine/rng';
import { ADULT, CAUSES, DAY, GENES, H, T, W, YEAR, type Building, type Cause, type Doctrine, type Genes, type Settler, type Sim, type Village } from './types';

export const idx = (x: number, y: number) => y * W + x;
export const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const VNAMES = ['Ashford', 'Brindle', 'Cairn', 'Dunmoor', 'Emberfall', 'Frostmere', 'Glenhaven', 'Hollowick', 'Ironvale', 'Juniper', 'Kestrel', 'Lowmere'];
const VCOL = ['#22d3ee', '#f5b84b', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#93c5fd', '#a3e635'];
const SYL = ['ka', 'ri', 'mo', 'la', 'ven', 'tha', 'sor', 'mi', 'dra', 'el', 'ne', 'bo', 'ur', 'fi', 'sa', 'to'];
export const makeName = (r: Rng) => { const n = 2 + r.int(2); let s = ''; for (let i = 0; i < n; i++) s += r.pick(SYL); return s[0].toUpperCase() + s.slice(1); };

function fbm(r: Rng): Float64Array {
  const out = new Float64Array(W * H);
  for (const [scale, amp] of [[32, 0.5], [16, 0.27], [8, 0.15], [4, 0.08]] as const) {
    const n = Math.ceil(W / scale) + 2, g = Array.from({ length: n * n }, () => r.next());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[y0 * n + x0], b = g[y0 * n + x0 + 1], c = g[(y0 + 1) * n + x0], d = g[(y0 + 1) * n + x0 + 1];
      out[y * W + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
    }
  }
  return out;
}
const quant = (arr: ArrayLike<number>, q: number) => Array.from(arr as number[]).sort((a, b) => a - b)[Math.floor(q * (arr.length - 1))];

const shore = (t: Uint8Array, i: number) => { const x = i % W, y = Math.floor(i / W); return [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => inB(x + dx, y + dy) && t[idx(x + dx, y + dy)] === T.WATER); };
export function newGenes(r: Rng, around = 0.5, sd = 0.2): Genes { const g = {} as Genes; for (const k of GENES) g[k] = clamp(around + r.gauss() * sd); return g; }
export function mkSettler(sim: Sim, rng: Rng, v: number, x: number, y: number, age: number, genes: Genes, parents: [number, number] = [-1, -1]): Settler {
  const name = makeName(rng);
  return { id: sim.nextId++, name, v, x, y, age, genes, hunger: 0.2, thirst: 0.2, cold: 0, health: 1, sick: 0, carry: { food: 0, wood: 0, stone: 0, tools: 0 }, job: 'idle', path: [], work: -1, moveCd: 0, tid: -1, thought: 'arriving', cool: 0, kids: 0, parents, born: sim.tick - age, alive: true, bio: [], tx: -1, ty: -1, atk: 0, lastHit: '', party: -1, ctl: false, raid: -1, armed: false, trade: null };
}
export function mkVillage(sim: Sim, rng: Rng, hx: number, hy: number, doctrine: Doctrine, parent = -1): Village {
  const id = sim.villages.length, v: Village = { id, name: VNAMES[sim.usedNames++ % VNAMES.length], color: VCOL[id % VCOL.length], hx, hy, doctrine, stock: { food: 0, wood: 0, stone: 0, tools: 0, spears: 0 }, techs: [], raidCool: 0, tradeCool: 0, huntCool: 0, outlook: { wood: 1, berry: 1, fish: 1, stone: 1, game: 1 }, buildings: [{ type: 'hearth', x: hx, y: hy, built: true, progress: 1, crop: 0 }], founded: sim.tick, alive: true, peak: 0, births: 0, deaths: 0, fire: false, fireUntil: 0, lastWolfDeath: -99999, parent };
  sim.bld[idx(hx, hy)] = id * 16 + 1; void rng; sim.villages.push(v); return v;
}
export const DOCTRINES: Doctrine[] = [
  { hunt: 0.9, farm: 0.1, build: 0.4, stock: 0.3, defend: 0.5 }, { hunt: 0.15, farm: 0.9, build: 0.5, stock: 0.5, defend: 0.3 },
  { hunt: 0.4, farm: 0.4, build: 0.9, stock: 0.9, defend: 0.5 }, { hunt: 0.5, farm: 0.5, build: 0.3, stock: 0.15, defend: 0.8 },
];

export function createSim(seed: number): Sim {
  const r = new Rng(seed), e = fbm(r), m = fbm(r), terrain = new Uint8Array(W * H), wood = new Uint8Array(W * H), berry = new Uint8Array(W * H), stone = new Uint8Array(W * H);
  const wl = quant(e, 0.17), rk = quant(e, 0.91), land = Array.from(m).filter((_, i) => e[i] > wl);
  const sand = quant(land, 0.1), forest = quant(land, 0.66);
  for (let i = 0; i < W * H; i++) {
    terrain[i] = e[i] <= wl ? T.WATER : e[i] >= rk ? T.ROCK : m[i] <= sand ? T.SAND : m[i] >= forest ? T.FOREST : T.GRASS;
    if (terrain[i] === T.FOREST) wood[i] = 6 + r.int(7); if (terrain[i] === T.GRASS && r.next() < 0.07) berry[i] = 4; if (terrain[i] === T.ROCK) stone[i] = 8 + r.int(12);
  }
  const sim: Sim = { seed, tick: 0, rs: 0, terrain, wood, berry, stone, bld: new Int16Array(W * H), villages: [], settlers: [], deer: [], wolves: [], graves: [], nextId: 1, events: [], stats: [], lineage: [], totals: { births: 0, deaths: Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>, founded: 0, fell: 0, builds: 0, trades: 0, raids: 0, inventions: 0 }, rel: {}, fauna: [], fish: new Uint8Array(W * H), wanderer: { active: false, x: 0, y: 0, carry: { food: 0, wood: 0, stone: 0, tools: 0 } }, usedNames: 0 };
  const near = (x: number, y: number, rad: number, t: number) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (inB(x + dx, y + dy) && terrain[idx(x + dx, y + dy)] === t) return true; return false; };
  const cands: [number, number][] = []; for (let y = 8; y < H - 8; y++) for (let x = 8; x < W - 8; x++) if (terrain[idx(x, y)] === T.GRASS && near(x, y, 5, T.WATER) && near(x, y, 9, T.FOREST) && !near(x, y, 2, T.WATER)) { let g = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (terrain[idx(x + dx, y + dy)] === T.GRASS) g++; if (g >= 30) cands.push([x, y]); }
  const sites = pickSites(cands, 4, r); const rng = new Rng(seed + 1);
  sites.forEach(([x, y], i) => { const v = mkVillage(sim, rng, x, y, { ...DOCTRINES[i % 4] }); v.stock = { food: 40, wood: 30, stone: 6, tools: 0, spears: 0 }; v.techs = rng.next() < 0.6 ? [rng.pick(['tools', 'curing', 'tallies', 'herbalism'] as const)] : []; for (let k = 0; k < 8; k++) { const s = mkSettler(sim, rng, v.id, x + (k % 3) - 1, y + Math.floor(k / 3) - 1, ADULT + rng.int(YEAR * 3), newGenes(rng)); if (terrain[idx(s.x, s.y)] === T.WATER) { s.x = x; s.y = y; } sim.settlers.push(s); } v.peak = 8; });
  for (let i = 0; i < W * H; i++) if (terrain[i] !== T.WATER && shore(terrain, i)) sim.fish[i] = 3 + r.int(4);
  const grass: number[] = []; for (let i = 0; i < W * H; i++) if (terrain[i] === T.GRASS || terrain[i] === T.FOREST) grass.push(i);
  for (let i = 0; i < 40; i++) { const t = rng.pick(grass); sim.deer.push({ id: sim.nextId++, x: t % W, y: Math.floor(t / W), hp: 1 }); }
  for (let i = 0; i < 45; i++) { const t = rng.pick(grass); if (terrain[t] === T.GRASS) sim.fauna.push({ id: sim.nextId++, k: 'rabbit', x: t % W, y: Math.floor(t / W), hp: 1, cool: 0, flee: 0 }); }
  for (let i = 0; i < 14; i++) { const t = rng.pick(grass); if (terrain[t] === T.FOREST) sim.fauna.push({ id: sim.nextId++, k: 'boar', x: t % W, y: Math.floor(t / W), hp: 3, cool: 0, flee: 0 }); }
  for (let i = 0; i < 2; i++) for (let tries = 0; tries < 60; tries++) { const t = rng.pick(grass), x = t % W, y = Math.floor(t / W); if (terrain[t] === T.FOREST && sites.every(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) > 20)) { sim.fauna.push({ id: sim.nextId++, k: 'bear', x, y, hp: 6, cool: 0, flee: 0 }); break; } }
  for (let i = 0; i < 5; i++) for (let tries = 0; tries < 50; tries++) { const t = rng.pick(grass), x = t % W, y = Math.floor(t / W); if (sites.every(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) > 16)) { sim.wolves.push({ id: sim.nextId++, x, y, hp: 1, cool: 0, flee: 0 }); break; } }
  sim.rs = rng.state; sim.wanderer = { active: false, x: sites[0][0] + 2, y: sites[0][1] + 2, carry: { food: 0, wood: 0, stone: 0, tools: 0 } }; return sim;
}
function pickSites(c: [number, number][], n: number, r: Rng): [number, number][] {
  if (!c.length) throw new Error('no village sites'); const out = [r.pick(c)];
  while (out.length < n) { let best = c[0], bd = -1; for (const p of c) { const d = Math.min(...out.map((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]))); if (d > bd) { bd = d; best = p; } } out.push(best); }
  return out;
}

// ---- (de)serialisation: typed arrays become plain arrays for IndexedDB/JSON ----
export function serialize(s: Sim): string { return JSON.stringify({ ...s, terrain: Array.from(s.terrain), fish: Array.from(s.fish), wood: Array.from(s.wood), berry: Array.from(s.berry), stone: Array.from(s.stone), bld: Array.from(s.bld) }); }
export function deserialize(j: string): Sim {
  const o = JSON.parse(j); if (!o || typeof o.tick !== 'number' || !Array.isArray(o.terrain) || o.terrain.length !== W * H || !Array.isArray(o.villages)) throw new Error('invalid hearth checkpoint');
  // migrate checkpoints written by older versions (v0.4 had no war, trade, tech or control fields)
  o.rel ??= {}; o.totals.trades ??= 0; o.totals.raids ??= 0; o.totals.inventions ??= 0; o.totals.deaths.war ??= 0;
  for (const v of o.villages) { v.techs ??= []; v.raidCool ??= 0; v.tradeCool ??= 0; v.stock.tools ??= 0; v.stock.spears ??= 0; }
  for (const q of o.settlers) { q.ctl ??= false; q.raid ??= -1; q.armed ??= false; q.trade ??= null; q.carry.tools ??= 0; }
  if (o.wanderer?.carry) o.wanderer.carry.tools ??= 0;
  o.fauna ??= []; for (const q of o.settlers) { q.party ??= -1; q.genes.foresight ??= 0.5; } for (const v of o.villages) { v.huntCool ??= 0; v.outlook ??= { wood: 1, berry: 1, fish: 1, stone: 1, game: 1 }; }
  if (!o.fish) o.fish = o.terrain.map((t: number, i: number) => (t !== T.WATER && shore(Uint8Array.from(o.terrain), i) ? 3 : 0));
  return { ...o, fish: Uint8Array.from(o.fish), terrain: Uint8Array.from(o.terrain), wood: Uint8Array.from(o.wood), berry: Uint8Array.from(o.berry), stone: Uint8Array.from(o.stone), bld: Int16Array.from(o.bld) };
}
export const buildingAt = (sim: Sim, x: number, y: number): { v: Village; b: Building } | null => { const c = sim.bld[idx(x, y)]; if (!c) return null; const v = sim.villages[Math.floor(c / 16)]; const b = v?.buildings.find((q) => q.x === x && q.y === y); return v && b ? { v, b } : null; };
export const timeOfDay = (tick: number) => (tick % DAY) / DAY;
export const isNight = (tick: number) => { const t = timeOfDay(tick); return t >= 0.72 || t < 0.08; };
export const seasonOf = (tick: number) => Math.floor((tick % YEAR) / (DAY * 8));
