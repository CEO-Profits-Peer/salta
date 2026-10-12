import { z } from 'zod';
import { Rng } from '../../engine/rng';

export const DX = [0, 0, -1, 1] as const; // up, down, left, right
export const DY = [-1, 1, 0, 0] as const;
export const CELL = { FLOOR: 0, WALL: 1, HAZARD: 2 } as const;

const Pt = z.tuple([z.number().int(), z.number().int()]);
export const MazeConfigSchema = z
  .object({
    width: z.number().int().min(5).max(41),
    height: z.number().int().min(5).max(41),
    cells: z.array(z.number().int().min(0).max(2)).max(41 * 41),
    start: Pt,
    exit: Pt,
    maxSteps: z.number().int().min(1).max(5000),
    seed: z.number().int().optional(),
  })
  .superRefine((c, ctx) => {
    const bad = (m: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
    if (c.cells.length !== c.width * c.height) bad('cells length must equal width*height');
    for (const [n, p] of [['start', c.start], ['exit', c.exit]] as const)
      if (p[0] < 0 || p[1] < 0 || p[0] >= c.width || p[1] >= c.height) bad(`${n} out of bounds`);
  });
export type MazeConfig = z.infer<typeof MazeConfigSchema>;

export const idx = (c: MazeConfig, x: number, y: number) => y * c.width + x;
export const inBounds = (c: MazeConfig, x: number, y: number) => x >= 0 && y >= 0 && x < c.width && y < c.height;
export const passable = (c: MazeConfig, x: number, y: number) => inBounds(c, x, y) && c.cells[idx(c, x, y)] !== CELL.WALL;

export function distancesFrom(c: MazeConfig, sx: number, sy: number): Int32Array {
  const d = new Int32Array(c.width * c.height).fill(-1);
  if (!passable(c, sx, sy)) return d;
  const q: number[] = [idx(c, sx, sy)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % c.width, cy = Math.floor(cur / c.width);
    for (let a = 0; a < 4; a++) {
      const nx = cx + DX[a], ny = cy + DY[a];
      if (passable(c, nx, ny) && d[idx(c, nx, ny)] < 0) { d[idx(c, nx, ny)] = d[cur] + 1; q.push(idx(c, nx, ny)); }
    }
  }
  return d;
}
/** Shortest path length start->exit, or -1 if unreachable. */
export function shortestPath(c: MazeConfig): number {
  if (!inBounds(c, c.exit[0], c.exit[1])) return -1;
  return distancesFrom(c, c.start[0], c.start[1])[idx(c, c.exit[0], c.exit[1])];
}
export function deadEnds(c: MazeConfig): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!passable(c, x, y) || (x === c.start[0] && y === c.start[1]) || (x === c.exit[0] && y === c.exit[1])) continue;
    let k = 0; for (let a = 0; a < 4; a++) if (passable(c, x + DX[a], y + DY[a])) k++;
    if (k === 1) n++;
  }
  return n;
}

/** Deterministic maze: recursive backtracker plus a few loops so multiple strategies exist. */
export function generateMaze(seed: number, w = 15, h = 15, loops = 0.12): MazeConfig {
  const W = w % 2 ? w : w + 1, H = h % 2 ? h : h + 1, rng = new Rng(seed);
  const cells = new Array(W * H).fill(CELL.WALL);
  const stack: [number, number][] = [[1, 1]];
  cells[1 * W + 1] = CELL.FLOOR;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = rng.shuffle([0, 1, 2, 3]).filter((a) => {
      const nx = x + DX[a] * 2, ny = y + DY[a] * 2;
      return nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && cells[ny * W + nx] === CELL.WALL;
    });
    if (!opts.length) { stack.pop(); continue; }
    const a = opts[0];
    cells[(y + DY[a]) * W + x + DX[a]] = CELL.FLOOR;
    cells[(y + DY[a] * 2) * W + x + DX[a] * 2] = CELL.FLOOR;
    stack.push([x + DX[a] * 2, y + DY[a] * 2]);
  }
  const f = (x: number, y: number) => cells[y * W + x] !== CELL.WALL;
  for (let i = 0, n = Math.floor(W * H * loops * 0.25); i < n; i++) {
    const x = 1 + rng.int(W - 2), y = 1 + rng.int(H - 2);
    if (cells[y * W + x] === CELL.WALL && ((f(x - 1, y) && f(x + 1, y)) || (f(x, y - 1) && f(x, y + 1)))) cells[y * W + x] = CELL.FLOOR;
  }
  const cfg: MazeConfig = { width: W, height: H, cells, start: [1, 1], exit: [W - 2, H - 2], maxSteps: 1, seed };
  cfg.maxSteps = Math.max(10, shortestPath(cfg) * 3);
  return cfg;
}

export interface Observation { x: number; y: number; free: [number, number, number, number]; goalDx: number; goalDy: number; stepsLeft: number }
/** Agents only see their position, the 4 adjacent cells, the sign of the direction to the exit, and remaining steps. */
export class MazeEnv {
  x = 0; y = 0; steps = 0; done = false; success = false;
  constructor(public readonly cfg: MazeConfig) { this.reset(); }
  reset(): Observation { this.x = this.cfg.start[0]; this.y = this.cfg.start[1]; this.steps = 0; this.done = false; this.success = false; return this.obs(); }
  obs(): Observation {
    const c = this.cfg;
    const free = [0, 1, 2, 3].map((a) => (passable(c, this.x + DX[a], this.y + DY[a]) ? 1 : 0)) as Observation['free'];
    return { x: this.x, y: this.y, free, goalDx: Math.sign(c.exit[0] - this.x), goalDy: Math.sign(c.exit[1] - this.y), stepsLeft: c.maxSteps - this.steps };
  }
  step(a: number): { obs: Observation; reward: number; done: boolean; success: boolean } {
    if (this.done) throw new Error('episode finished');
    const c = this.cfg; let reward = -0.01;
    const nx = this.x + DX[a], ny = this.y + DY[a];
    if (passable(c, nx, ny)) {
      this.x = nx; this.y = ny;
      if (c.cells[idx(c, nx, ny)] === CELL.HAZARD) reward -= 0.2;
    } else reward -= 0.05;
    this.steps++;
    if (this.x === c.exit[0] && this.y === c.exit[1]) { reward += 1; this.done = this.success = true; }
    else if (this.steps >= c.maxSteps) this.done = true;
    return { obs: this.obs(), reward, done: this.done, success: this.success };
  }
}

/** Parametric policy: score(action) = w·features + per-action bias + noise. Genome length 8. */
export const POLICY_LEN = 8;
export const HEURISTIC_GENOME = [2, 1, -1.5, 0, 0, 0, 0, 0.05];
export const RANDOM_GENOME = [0, 0, 0, 0, 0, 0, 0, 1];
export interface EpisodeResult { success: boolean; steps: number; reward: number; visited: number }
export function runEpisode(cfg: MazeConfig, g: number[], rng: Rng, trace?: number[]): EpisodeResult {
  const env = new MazeEnv(cfg), visits = new Uint16Array(cfg.width * cfg.height);
  let obs = env.reset(), reward = 0, visited = 1;
  visits[idx(cfg, obs.x, obs.y)] = 1;
  trace?.push(idx(cfg, obs.x, obs.y));
  for (;;) {
    let best = -Infinity, act = 0;
    for (let a = 0; a < 4; a++) {
      const v = obs.free[a] ? visits[idx(cfg, obs.x + DX[a], obs.y + DY[a])] : 0;
      const align = a === 0 ? -obs.goalDy : a === 1 ? obs.goalDy : a === 2 ? -obs.goalDx : obs.goalDx;
      const s = g[0] * obs.free[a] + g[1] * align + g[2] * Math.log1p(v) + g[3 + a] + Math.abs(g[7]) * rng.gauss();
      if (s > best) { best = s; act = a; }
    }
    const r = env.step(act);
    reward += r.reward; obs = r.obs;
    const i = idx(cfg, obs.x, obs.y);
    trace?.push(i);
    if (visits[i]++ === 0) visited++;
    if (r.done) return { success: r.success, steps: env.steps, reward, visited };
  }
}
