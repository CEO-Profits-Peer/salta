import { ADULT, BUILDINGS, TECHS, YEAR, type Sim, type Village } from './types';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export function prosperity(sim: Sim, v: Village): number {
  const mem = sim.settlers.filter((s) => s.alive && s.v === v.id), pop = mem.length; if (!v.alive || !pop) return 0;
  const built = v.buildings.filter((b) => b.built && b.type !== 'hearth').length, health = mem.reduce((a, s) => a + s.health, 0) / pop;
  return Math.round(clamp(pop / 26) * 30 + clamp(v.techs.length / Object.keys(TECHS).length) * 15 + clamp(built / 10) * 15 + clamp(v.stock.food / (3 * pop)) * 15 + health * 10 + clamp((sim.tick - v.vstats.lastAttack) / YEAR) * 10 + clamp(v.vstats.trades / 5) * 5);
}
export interface Objective { id: string; text: string; progress: number; done: boolean }
export function objectives(sim: Sim, v: Village): Objective[] {
  const mem = sim.settlers.filter((s) => s.alive && s.v === v.id), built = v.buildings.filter((b) => b.built && b.type !== 'hearth').length;
  const o = (id: string, text: string, cur: number, goal: number): Objective => ({ id, text, progress: clamp(cur / goal), done: cur >= goal });
  return [
    o('pop20', 'Grow to 20 settlers', mem.length, 20), o('winter3', 'Survive 3 winters', v.vstats.winters, 3), o('techs4', 'Know 4 inventions', v.techs.length, 4), o('trade5', 'Complete 5 trades', v.vstats.trades, 5),
    o('build8', 'Finish 8 buildings', built, 8), o('defend3', 'Repel 3 raiders', v.vstats.defended, 3), o('peace', 'A full year without being raided', Math.min(sim.tick - v.vstats.lastAttack, YEAR), YEAR),
    o('feast', 'Hold a festival', v.vstats.festivals, 1), o('adults', `Raise ${6} grown-up children`, mem.filter((s) => s.age >= ADULT && s.parents[0] >= 0).length, 6),
  ];
}
export const BUILDABLE = (Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]).filter((t) => t !== 'hearth');
