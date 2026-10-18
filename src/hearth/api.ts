import { ADULT, CAUSES, GENES, YEAR, type Cause, type DayStat, type Doctrine, type Evt, type Genes, type Grave, type Job, type Mods, type Outlook, type Sim, type TechId, type Totals, type Wanderer } from './types';
import { buildingAt, idx, inB } from './world';
import { capacityOf, chiefCmd, controlCmd, ev, modCmd, relOf, type ChiefCmd, type CtlCmd, type ModCmd } from './sim';
import { objectives, prosperity, type Objective } from './chief';
import { T } from './types';

export type Cmd = { k: 'wactive'; on: boolean } | { k: 'wmove'; dx: number; dy: number } | { k: 'wgather' } | { k: 'wgive' } | { k: 'wdeposit' } | CtlCmd | ChiefCmd | ModCmd;
export function command(sim: Sim, c: Cmd): void {
  if (c.k === 'mod') { modCmd(sim, c); return; }
  if (c.k === 'chief' || c.k === 'doctrine' || c.k === 'role' || c.k === 'order' || c.k === 'research') { chiefCmd(sim, c as ChiefCmd); return; }
  if (c.k === 'possess' || c.k === 'release' || c.k[0] === 's') { controlCmd(sim, c as CtlCmd); return; }
  const w = sim.wanderer;
  if (c.k === 'wactive') { w.active = c.on; if (c.on) { const v = sim.villages.filter((q) => q.alive).sort((a, b) => b.peak - a.peak)[0]; if (v && !inB(w.x, w.y)) { w.x = v.hx + 2; w.y = v.hy + 2; } } return; }
  if (!w.active) return;
  if (c.k === 'wmove') { const nx = w.x + Math.sign(c.dx), ny = w.y + Math.sign(c.dy); if (inB(nx, ny) && sim.terrain[idx(nx, ny)] !== T.WATER) { w.x = nx; w.y = ny; } return; }
  if (c.k === 'wgather') { const i = idx(w.x, w.y); if (sim.berry[i] > 1) { sim.berry[i]--; w.carry.food += 2; } else if (sim.wood[i] > 0) { sim.wood[i]--; w.carry.wood += 2; } else if (sim.stone[i] > 0) { sim.stone[i]--; w.carry.stone += 2; } return; }
  if (c.k === 'wgive') {
    let best = null as null | (typeof sim.settlers)[number], bd = 3; for (const s of sim.settlers) { const d = Math.abs(s.x - w.x) + Math.abs(s.y - w.y); if (s.alive && d < bd) { bd = d; best = s; } } if (!best) return;
    if (w.carry.food > 0) { w.carry.food--; best.hunger = Math.max(0, best.hunger - 0.5); best.thought = 'fed by the Wanderer'; ev(sim, 'wanderer', `The Wanderer shared food with ${best.name}`, best.x, best.y, best.id); }
    else if (w.carry.wood > 0) { w.carry.wood--; best.cold = Math.max(0, best.cold - 0.4); best.thought = 'warmed by the Wanderer'; ev(sim, 'wanderer', `The Wanderer shared firewood with ${best.name}`, best.x, best.y, best.id); } return;
  }
  if (c.k === 'wdeposit') { for (const v of sim.villages) if (v.alive && Math.abs(v.hx - w.x) + Math.abs(v.hy - w.y) <= 3 && (w.carry.food || w.carry.wood || w.carry.stone)) { v.stock.food += w.carry.food; v.stock.wood += w.carry.wood; v.stock.stone += w.carry.stone; ev(sim, 'wanderer', `The Wanderer left supplies in ${v.name}`, v.hx, v.hy); w.carry = { food: 0, wood: 0, stone: 0, tools: 0 }; return; } }
}

export interface SSettler { id: number; name: string; v: number; x: number; y: number; age: number; genes: Genes; hunger: number; thirst: number; cold: number; health: number; sick: boolean; job: Job; thought: string; carry: { food: number; wood: number; stone: number; tools: number }; kids: number; parents: [number, number]; ctl: boolean; party: boolean; armed: boolean; role: string; quirks: string[]; raid: number }
export interface SVillage { id: number; name: string; color: string; hx: number; hy: number; alive: boolean; stock: { food: number; wood: number; stone: number; tools: number; spears: number }; techs: TechId[]; outlook: Outlook; tier: string; focus: string; capacity: number; prosperity: number; objectives: Objective[]; orderCool: Record<string, number>; festivals: number; buildings: { type: string; x: number; y: number; built: boolean; progress: number }[]; doctrine: Doctrine; pop: number; births: number; deaths: number; peak: number; parent: number; fire: boolean }
export interface Snapshot { tick: number; settlers: SSettler[]; deer: [number, number, number][]; wolves: [number, number, number][]; fauna: [number, string, number, number][]; fish: Uint8Array; rel: [number, number, number][]; alliances: string[]; mods: Mods; chief: number; villages: SVillage[]; graves: Grave[]; wood: Uint8Array; berry: Uint8Array; stone: Uint8Array; wanderer: Wanderer; events: Evt[]; stats: DayStat[]; selection: number[] | null; totals: Totals; withMap: boolean }

/** Per-gene difference in mean value between settlers who had children and those who did not (adults that have died). Real selection evidence. */
export function selectionDifferential(sim: Sim): number[] | null {
  const a = sim.lineage.filter((l) => l.age >= ADULT / YEAR), br = a.filter((l) => l.kids > 0), no = a.filter((l) => l.kids === 0);
  if (br.length < 8 || no.length < 8) return null;
  return GENES.map((_, i) => br.reduce((s, l) => s + l.g[i], 0) / br.length - no.reduce((s, l) => s + l.g[i], 0) / no.length);
}
export function snapshot(sim: Sim, sinceEvt: Evt | null, sinceStats: number, withMap: boolean): Snapshot {
  const pop = new Map<number, number>(); for (const s of sim.settlers) pop.set(s.v, (pop.get(s.v) ?? 0) + 1);
  const ei = sinceEvt ? sim.events.lastIndexOf(sinceEvt) : -1;
  return {
    tick: sim.tick, withMap, chief: sim.chief, alliances: sim.alliances, mods: sim.mods,
    settlers: sim.settlers.map((s) => ({ id: s.id, name: s.name, v: s.v, x: s.x, y: s.y, age: s.age, genes: s.genes, hunger: s.hunger, thirst: s.thirst, cold: s.cold, health: s.health, sick: s.sick > 0, job: s.job, thought: s.thought, carry: s.carry, kids: s.kids, parents: s.parents, ctl: s.ctl, party: s.party >= 0, armed: s.armed, role: s.role, quirks: s.quirks, raid: s.raid })),
    deer: sim.deer.map((d) => [d.id, d.x, d.y]), wolves: sim.wolves.map((w) => [w.id, w.x, w.y]), fauna: sim.fauna.map((a) => [a.id, a.k, a.x, a.y]), fish: withMap ? sim.fish.slice() : new Uint8Array(0),
    rel: sim.villages.flatMap((a) => sim.villages.filter((b) => b.id > a.id && a.alive && b.alive).map((b) => [a.id, b.id, relOf(sim, a.id, b.id)] as [number, number, number])),
    villages: sim.villages.map((v) => ({ id: v.id, name: v.name, color: v.color, hx: v.hx, hy: v.hy, alive: v.alive, stock: { food: Math.round(v.stock.food), wood: Math.round(v.stock.wood), stone: Math.round(v.stock.stone), tools: v.stock.tools, spears: v.stock.spears }, techs: v.techs, outlook: v.outlook, tier: v.tier, focus: v.focus, capacity: capacityOf(v), prosperity: prosperity(sim, v), objectives: v.alive ? objectives(sim, v) : [], orderCool: v.orderCool, festivals: v.vstats.festivals, buildings: v.buildings.map((b) => ({ type: b.type, x: b.x, y: b.y, built: b.built, progress: b.progress })), doctrine: v.doctrine, pop: pop.get(v.id) ?? 0, births: v.births, deaths: v.deaths, peak: v.peak, parent: v.parent, fire: v.fire })),
    graves: sim.graves, wood: withMap ? sim.wood.slice() : new Uint8Array(0), berry: withMap ? sim.berry.slice() : new Uint8Array(0), stone: withMap ? sim.stone.slice() : new Uint8Array(0), wanderer: sim.wanderer,
    events: ei >= 0 ? sim.events.slice(ei + 1) : sinceEvt ? sim.events.slice(-30) : sim.events.slice(-60), stats: sim.stats.slice(sinceStats), selection: selectionDifferential(sim), totals: sim.totals,
  };
}
export const summarize = (a: Totals, b: Totals) => ({ trades: b.trades - a.trades, raids: b.raids - a.raids, inventions: b.inventions - a.inventions, births: b.births - a.births, deaths: Object.fromEntries(CAUSES.map((c) => [c, b.deaths[c as Cause] - a.deaths[c as Cause]])) as Record<Cause, number>, founded: b.founded - a.founded, fell: b.fell - a.fell, builds: b.builds - a.builds });
export type Almanac = ReturnType<typeof summarize> & { ticks: number; popBefore: number; popAfter: number };
export { buildingAt };
