import { Rng } from '../engine/rng';
import { DX, DY } from '../game/maze/maze';
import { DescentEnv } from './env';
import { generateFloor } from './floor';
import type { GameGenome, Obs } from './types';

export interface BotParams { skill: number; explore: number; caution: number; greed: number; patience: number }
export interface Persona extends BotParams { id: string; name: string; target: number; thrill: number; novelty: number }
/** Synthetic playtesters. They are models, not real users, and are always labelled as simulated. */
export const PERSONAS: Persona[] = [
  { id: 'newcomer', name: 'Newcomer', skill: 0.45, explore: 0.4, caution: 0.4, greed: 0.5, patience: 45, target: 0.8, thrill: 0.3, novelty: 0.5 },
  { id: 'explorer', name: 'Explorer', skill: 0.7, explore: 1.2, caution: 0.6, greed: 0.7, patience: 90, target: 0.6, thrill: 0.5, novelty: 1.0 },
  { id: 'speedrunner', name: 'Speedrunner', skill: 0.85, explore: 0.3, caution: 0.3, greed: 0.8, patience: 60, target: 0.5, thrill: 0.9, novelty: 0.4 },
  { id: 'careful', name: 'Careful', skill: 0.8, explore: 0.6, caution: 1.5, greed: 0.7, patience: 80, target: 0.7, thrill: 0.2, novelty: 0.6 },
  { id: 'veteran', name: 'Veteran', skill: 0.95, explore: 0.7, caution: 1.0, greed: 0.9, patience: 70, target: 0.35, thrill: 0.8, novelty: 0.7 },
];
const align = (a: number, dx: number, dy: number) => (a === 0 ? -dy : a === 1 ? dy : a === 2 ? -dx : dx);

export class Bot {
  visits = new Map<number, number>();
  constructor(public p: BotParams, private rng: Rng) {}
  act(o: Obs, W = 64): number {
    let best = -Infinity, act = 0; this.visits.set(o.y * W + o.x, (this.visits.get(o.y * W + o.x) ?? 0) + 1);
    const needKey = o.keyDx !== 0 || o.keyDy !== 0, p = this.p;
    for (let a = 0; a < 4; a++) {
      let s: number;
      if (!o.free[a]) s = -5;
      else {
        const v = this.visits.get((o.y + DY[a]) * W + o.x + DX[a]) ?? 0;
        s = 2 - (0.8 + p.explore) * 1.5 * Math.log1p(v) + align(a, o.goalDx, o.goalDy) * (needKey ? 0.3 : 1);
        if (needKey) s += align(a, o.keyDx, o.keyDy) * p.greed * 1.5; else if (o.doorDx || o.doorDy) s += align(a, o.doorDx, o.doorDy) * 1.5;
        for (const w of o.wardens) { const nd = Math.abs(w.dx - DX[a]) + Math.abs(w.dy - DY[a]); s += p.caution * (nd - w.dist) * 2.5 - p.caution * Math.max(0, 3 - nd) * 1.5; }
      }
      s += (1 - p.skill) * 1.5 * this.rng.gauss();
      if (s > best) { best = s; act = a; }
    }
    return act;
  }
}

export interface RunStats { floors: number; cleared: number; outcome: 'won' | 'caught' | 'dark' | 'quit'; steps: number; nearMisses: number; triggers: number; kinds: number; maxStall: number; hazardHits: number; early: boolean; lightGained: number; initialLight: number; coverage: number }
export function playRun(g: GameGenome, p: BotParams, baseSeed: number, rng: Rng, maxFloors = 3): RunStats {
  const r: RunStats = { floors: 0, cleared: 0, outcome: 'won', steps: 0, nearMisses: 0, triggers: 0, kinds: 0, maxStall: 0, hazardHits: 0, early: false, lightGained: 0, initialLight: 0, coverage: 0 };
  const kinds = new Set<string>(); let carry = 0;
  for (let d = 0; d < maxFloors; d++) {
    const floor = generateFloor(g, d, baseSeed), env = new DescentEnv(floor, carry), bot = new Bot(p, rng); r.floors++; if (d === 0) r.initialLight = env.initialLight;
    while (env.outcome === 'running') { env.step(bot.act(env.obs(), floor.cfg.width)); if (env.stats.stall > p.patience) { r.outcome = 'quit'; break; } }
    const s = env.stats; r.steps += env.steps; r.nearMisses += s.nearMisses; r.triggers += s.triggers; r.hazardHits += s.hazardHits; r.maxStall = Math.max(r.maxStall, s.maxStall); r.lightGained += s.lightGained; s.kinds.forEach((k) => kinds.add(k));
    r.coverage = Math.max(r.coverage, env.visited.size / (floor.cfg.width * floor.cfg.height));
    if (r.outcome === 'quit') break;
    if (env.outcome === 'cleared') { r.cleared++; carry = Math.floor(env.light * 0.5); continue; }
    r.outcome = env.outcome === 'caught' ? 'caught' : 'dark'; r.early = s.early && d === 0; break;
  }
  r.kinds = kinds.size; return r;
}
