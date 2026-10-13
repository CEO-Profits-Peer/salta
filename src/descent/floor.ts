import { Rng } from '../engine/rng';
import { DX, DY, generateMaze, idx, type MazeConfig } from '../game/maze/maze';
import { isTimed } from './features';
import type { Floor, GameGenome, Tile } from './types';

export const floorSeed = (base: number, depth: number) => (Math.imul(base, 31) + depth * 7919 + 17) >>> 0;

/** BFS distances from (sx,sy); cells in `blocked` and walls are impassable. */
function reach(c: MazeConfig, sx: number, sy: number, blocked: Set<number>): Int32Array {
  const d = new Int32Array(c.width * c.height).fill(-1), q = [idx(c, sx, sy)]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % c.width, cy = Math.floor(cur / c.width);
    for (let a = 0; a < 4; a++) {
      const nx = cx + DX[a], ny = cy + DY[a]; if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue;
      const i = idx(c, nx, ny); if (c.cells[i] === 1 || blocked.has(i) || d[i] >= 0) continue; d[i] = d[cur] + 1; q.push(i);
    }
  }
  return d;
}
function shortestPathCells(c: MazeConfig): number[] {
  const par = new Int32Array(c.width * c.height).fill(-2), s = idx(c, c.start[0], c.start[1]), e = idx(c, c.exit[0], c.exit[1]);
  const q = [s]; par[s] = -1;
  for (let h = 0; h < q.length && par[e] === -2; h++) {
    const cur = q[h], cx = cur % c.width, cy = Math.floor(cur / c.width);
    for (let a = 0; a < 4; a++) { const nx = cx + DX[a], ny = cy + DY[a]; if (nx < 0 || ny < 0 || nx >= c.width || ny >= c.height) continue; const i = idx(c, nx, ny); if (c.cells[i] === 1 || par[i] !== -2) continue; par[i] = cur; q.push(i); }
  }
  const out: number[] = []; for (let i = e; i >= 0; i = par[i]) out.push(i); return out.reverse();
}

export function generateFloor(g: GameGenome, depth: number, baseSeed: number): Floor {
  const t = g.tuning, seed = floorSeed(baseSeed, depth);
  const maze = generateMaze(seed, t.size, t.size, t.loops), W = maze.width, rng = new Rng(seed ^ 0x5bd1e995);
  const cfg: MazeConfig = { ...maze, cells: [...maze.cells] }, cells = cfg.cells;
  const path = shortestPathCells(cfg), sp = path.length - 1;
  const startI = idx(cfg, cfg.start[0], cfg.start[1]), exitI = idx(cfg, cfg.exit[0], cfg.exit[1]);
  const taken = new Set<number>([startI, exitI]);
  const xy = (i: number) => ({ x: i % W, y: Math.floor(i / W) });
  // doors on the main route, keys in the region reachable before each door
  const doors: Floor['doors'] = [], keys: Floor['keys'] = [], nDoors = Math.round(t.doors);
  for (let i = 0; i < nDoors; i++) {
    const target = Math.floor(((i + 1) / (nDoors + 1)) * (path.length - 1));
    let pi = -1; for (let k = 0; k < path.length && pi < 0; k++) for (const c of [target + k, target - k]) if (pi < 0 && c > 0 && c < path.length - 1 && !taken.has(path[c])) pi = c;
    if (pi < 0) break; doors.push({ ...xy(path[pi]), key: i }); taken.add(path[pi]);
  }
  for (let i = 0; i < doors.length; i++) {
    const blocked = new Set(doors.filter((d) => d.key >= i).map((d) => idx(cfg, d.x, d.y)));
    const d = reach(cfg, cfg.start[0], cfg.start[1], blocked), cand: number[] = [];
    d.forEach((v, j) => { if (v >= 3 && !taken.has(j) && cells[j] === 0) cand.push(j); });
    if (!cand.length) { doors.splice(i); break; }
    const k = rng.pick(cand); keys.push({ ...xy(k), key: i }); taken.add(k);
  }
  const free = () => { const l: number[] = []; for (let i = 0; i < cells.length; i++) if (cells[i] === 0 && !taken.has(i)) l.push(i); return l; };
  const hz = Math.round(t.hazards * free().length); for (let i = 0; i < hz; i++) { const l = free(); if (!l.length) break; const k = rng.pick(l); cells[k] = 2; taken.add(k); }
  const dist0 = reach(cfg, cfg.start[0], cfg.start[1], new Set());
  const tiles: Tile[] = [];
  for (const f of g.features) {
    if (isTimed(f.kind)) continue;
    const l = free().filter((i) => dist0[i] >= 2); rng.shuffle(l); const n = Math.min(f.count, l.length);
    for (let k = 0; k < n; k++) { taken.add(l[k]); tiles.push({ ...xy(l[k]), fid: f.id, kind: f.kind as Tile['kind'], pair: f.kind === 'rift' ? Math.floor(k / 2) : -1 }); }
  }
  const nW = Math.min(5, t.wardens + (depth >= 2 ? 1 : 0) + (depth >= 4 ? 1 : 0));
  let wc = free().filter((i) => dist0[i] >= 7); if (wc.length < nW) wc = free().sort((a, b) => dist0[b] - dist0[a]).slice(0, nW + 3);
  rng.shuffle(wc); const wardens = wc.slice(0, nW).map(xy);
  const light = Math.ceil(sp * t.lightFactor) + 12 + doors.length * Math.ceil(sp * 0.5);
  cfg.maxSteps = Math.min(5000, light);
  return { cfg, doors, keys, tiles, wardens, light, fog: Math.max(2, Math.round(t.fog) - Math.floor(depth / 3)), seed, depth, features: g.features, wardenEvery: Math.round(t.wardenEvery) };
}

/** Is the floor winnable in principle (keys before doors, within the light budget)? */
export function solvableFloor(f: Floor): { ok: boolean; minSteps: number } {
  const c = f.cfg, W = c.width, nm = 1 << f.keys.length;
  const doorAt = new Map(f.doors.map((d) => [d.y * W + d.x, d.key])), keyAt = new Map(f.keys.map((k) => [k.y * W + k.x, k.key]));
  const dist = new Int32Array(c.cells.length * nm).fill(-1), s = idx(c, c.start[0], c.start[1]), e = idx(c, c.exit[0], c.exit[1]);
  const q = [s * nm]; dist[s * nm] = 0;
  for (let h = 0; h < q.length; h++) {
    const st = q[h], cell = Math.floor(st / nm), mask = st % nm; if (cell === e) return { ok: dist[st] <= f.light, minSteps: dist[st] };
    const cx = cell % W, cy = Math.floor(cell / W);
    for (let a = 0; a < 4; a++) {
      const nx = cx + DX[a], ny = cy + DY[a]; if (nx < 0 || ny < 0 || nx >= W || ny >= c.height) continue;
      const ni = ny * W + nx; if (c.cells[ni] === 1) continue; const dk = doorAt.get(ni); if (dk !== undefined && !(mask & (1 << dk))) continue;
      const kk = keyAt.get(ni), nmask = kk !== undefined ? mask | (1 << kk) : mask, ns = ni * nm + nmask;
      if (dist[ns] < 0) { dist[ns] = dist[st] + 1; q.push(ns); }
    }
  }
  return { ok: false, minSteps: -1 };
}
