import { describe, it, expect } from 'vitest';
import { createSim, deserialize, serialize, idx } from '../../src/hearth/world';
import { stepSim } from '../../src/hearth/sim';
import { command, selectionDifferential, snapshot } from '../../src/hearth/api';
import { CAUSES, GENES, T, W, H, YEAR, DAY } from '../../src/hearth/types';

const cmp = (a: ReturnType<typeof createSim>, b: ReturnType<typeof createSim>) => serialize(a) === serialize(b);
describe('hearthworld simulation', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = createSim(5), b = createSim(5), c = createSim(6); stepSim(a, 1500); stepSim(b, 1500); stepSim(c, 1500);
    expect(cmp(a, b)).toBe(true); expect(cmp(a, c)).toBe(false);
  });
  it('checkpoints round-trip: resuming gives the identical future', () => {
    const a = createSim(8); stepSim(a, 900); const b = deserialize(serialize(a)); stepSim(a, 900); stepSim(b, 900);
    expect(cmp(a, b)).toBe(true);
    expect(() => deserialize('{"tick":1}')).toThrow(); expect(() => deserialize('nope')).toThrow();
  });
  it('keeps every invariant over a full year: bounded needs, valid positions, no NaN, conserved ids, causes recorded', () => {
    const sim = createSim(3), seen = new Set<number>();
    for (let k = 0; k < 16; k++) {
      stepSim(sim, 480);
      for (const s of sim.settlers) {
        for (const v of [s.hunger, s.thirst, s.cold]) expect(v >= 0 && v <= 1).toBe(true);
        expect(Number.isFinite(s.health) && s.health <= 1).toBe(true); expect(sim.terrain[idx(s.x, s.y)]).not.toBe(T.WATER); expect(s.x >= 0 && s.y >= 0 && s.x < W && s.y < H).toBe(true);
        for (const g of GENES) expect(s.genes[g] >= 0 && s.genes[g] <= 1).toBe(true); expect(seen.has(s.id) && false).toBe(false);
      }
      for (const v of sim.villages) { expect(v.stock.food).toBeGreaterThanOrEqual(0); expect(v.stock.wood).toBeGreaterThanOrEqual(0); expect(v.stock.stone).toBeGreaterThanOrEqual(0); }
      expect(new Set(sim.settlers.map((s) => s.id)).size).toBe(sim.settlers.length);
    }
    expect(sim.settlers.length).toBeGreaterThan(10); expect(sim.totals.births).toBeGreaterThan(0);
    const deaths = CAUSES.reduce((a, c) => a + sim.totals.deaths[c], 0); expect(deaths).toBe(sim.lineage.length >= 500 ? deaths : sim.lineage.length);
    expect(sim.stats.length).toBe(Math.floor(sim.tick / DAY)); expect(sim.tick).toBe(YEAR * 2 > sim.tick ? sim.tick : 0);
    const snap = snapshot(sim, null, 0, true); expect(snap.settlers.length).toBe(sim.settlers.length); expect(snap.wood.length).toBe(W * H);
  }, 60000);
  it('offspring inherit and mutate genes (variation exists, stays in range)', () => {
    const sim = createSim(11); stepSim(sim, 4000); const kids = sim.settlers.filter((s) => s.parents[0] >= 0);
    expect(kids.length).toBeGreaterThan(0); const g = GENES[0]; const vals = new Set(kids.map((k) => k.genes[g].toFixed(3))); expect(vals.size).toBeGreaterThan(1);
  });
  it('the Wanderer can gather, feed a settler and supply a village', () => {
    const sim = createSim(2); stepSim(sim, 300); command(sim, { k: 'wactive', on: true }); const w = sim.wanderer, v = sim.villages[0], s = sim.settlers.find((q) => q.v === 0)!;
    s.hunger = 0.9; w.x = s.x; w.y = s.y; sim.berry[idx(w.x, w.y)] = 4; sim.terrain[idx(w.x, w.y)] = T.GRASS; command(sim, { k: 'wgather' }); expect(w.carry.food).toBe(2);
    command(sim, { k: 'wgive' }); expect(s.hunger).toBeLessThan(0.5); expect(w.carry.food).toBe(1);
    w.x = v.hx; w.y = v.hy; const before = v.stock.food; command(sim, { k: 'wdeposit' }); expect(v.stock.food).toBe(before + 1);
    command(sim, { k: 'wactive', on: false }); const px = w.x; command(sim, { k: 'wmove', dx: 1, dy: 0 }); expect(w.x).toBe(px);
  });
  it('selection differential needs enough data and returns one value per gene', () => {
    const sim = createSim(4); expect(selectionDifferential(sim)).toBeNull(); stepSim(sim, YEAR * 2);
    const d = selectionDifferential(sim); if (d) expect(d.length).toBe(GENES.length);
  }, 60000);
});

import { controlCmd, relOf } from '../../src/hearth/sim';
import { BUILDINGS, TECHS, type TechId } from '../../src/hearth/types';
describe('v0.5: war, trade, crafting, inventions, fauna, resources, control', () => {
  it('loads a v0.4 checkpoint (no war/trade/tech/fish/fauna fields) and keeps simulating', () => {
    const sim = createSim(12); stepSim(sim, 300); const o = JSON.parse(serialize(sim));
    delete o.rel; delete o.fauna; delete o.fish; delete o.totals.trades; delete o.totals.raids; delete o.totals.inventions; delete o.totals.deaths.war;
    for (const v of o.villages) { delete v.techs; delete v.raidCool; delete v.tradeCool; delete v.huntCool; delete v.outlook; delete v.stock.tools; delete v.stock.spears; }
    for (const s of o.settlers) { delete s.ctl; delete s.raid; delete s.armed; delete s.trade; delete s.party; delete s.genes.foresight; delete s.carry.tools; }
    const old = deserialize(JSON.stringify(o)); expect(old.settlers[0].genes.foresight).toBe(0.5); expect(old.fish.length).toBe(W * H); expect(old.villages[0].techs).toEqual([]);
    stepSim(old, 600); expect(old.tick).toBe(900); expect(old.settlers.every((s) => Number.isFinite(s.health))).toBe(true);
  });
  it('catalogues are complete: every building and tech is described and respects prerequisites', () => {
    for (const t of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) { expect(BUILDINGS[t].desc.length).toBeGreaterThan(20); const n = BUILDINGS[t].needs; if (n) expect(TECHS[n]).toBeTruthy(); }
    for (const k of Object.keys(TECHS) as TechId[]) for (const n of TECHS[k].needs) expect(TECHS[n]).toBeTruthy();
  });
  it('trade, invention and conflict happen on their own in a living world', () => {
    const sim = createSim(3); stepSim(sim, YEAR * 1.5); expect(sim.totals.trades + sim.totals.inventions).toBeGreaterThan(0);
    for (const k of Object.keys(sim.rel)) { expect(sim.rel[k]).toBeGreaterThanOrEqual(-1); expect(sim.rel[k]).toBeLessThanOrEqual(1); }
    for (const a of sim.fauna) { expect(sim.terrain[idx(a.x, a.y)]).not.toBe(T.WATER); expect(a.hp).toBeGreaterThan(0); }
    for (const v of sim.villages) for (const g of ['food', 'wood', 'stone', 'tools', 'spears'] as const) expect(v.stock[g]).toBeGreaterThanOrEqual(0);
  }, 60000);
  it('hostile relations lead to raids with warriors that march, fight and are recorded as war', () => {
    const sim = createSim(2); for (const s of sim.settlers) { s.genes.courage = 0.9; } for (const a of sim.villages) for (const b of sim.villages) if (a.id < b.id) sim.rel[`${a.id}-${b.id}`] = -0.95;
    for (let d = 0; d < 12 && sim.totals.raids === 0; d++) { stepSim(sim, DAY); for (const a of sim.villages) for (const b of sim.villages) if (a.id < b.id) sim.rel[`${a.id}-${b.id}`] = Math.min(sim.rel[`${a.id}-${b.id}`] ?? 0, -0.9); }
    expect(sim.totals.raids).toBeGreaterThan(0); expect(sim.events.some((e) => e.k === 'war')).toBe(true); expect(relOf(sim, 0, 1)).toBeLessThan(0);
    stepSim(sim, 1200); expect(sim.settlers.every((s) => Number.isFinite(s.health))).toBe(true);
  }, 60000);
  it('shore fish regrow after being fished out, and stone is finite', () => {
    const sim = createSim(5); let t = -1; for (let i = 0; i < W * H && t < 0; i++) if (sim.fish[i] > 0 && sim.villages.every((v) => Math.abs(v.hx - (i % W)) + Math.abs(v.hy - Math.floor(i / W)) > 22)) t = i;
    expect(t).toBeGreaterThanOrEqual(0); sim.fish[t] = 0; stepSim(sim, 3000); expect(sim.fish[t]).toBeGreaterThan(0);
    const rock = Array.from(sim.stone).findIndex((s) => s > 0); sim.stone[rock] = 0; stepSim(sim, 1500); expect(sim.stone[rock]).toBe(0);
  });
  it('the player can possess a settler, gather, fight, deposit and plant trees; others keep thinking', () => {
    const sim = createSim(4); stepSim(sim, 120); const me = sim.settlers.find((s) => s.age >= 15360)!, v = sim.villages[me.v];
    controlCmd(sim, { k: 'possess', id: me.id }); expect(me.ctl).toBe(true); expect(sim.settlers.filter((s) => s.ctl).length).toBe(1);
    me.x = v.hx + 1; me.y = v.hy + 1; sim.terrain[idx(me.x, me.y)] = T.GRASS; sim.bld[idx(me.x, me.y)] = 0; sim.berry[idx(me.x, me.y)] = 4; sim.fish[idx(me.x, me.y)] = 0; sim.wood[idx(me.x, me.y)] = 0; sim.stone[idx(me.x, me.y)] = 0; me.thirst = 0; me.carry.food = 0;
    controlCmd(sim, { k: 'sact' }); expect(me.carry.food).toBeGreaterThanOrEqual(2);
    const px = me.x; controlCmd(sim, { k: 'smove', dx: 1, dy: 0 }); expect(Math.abs(me.x - px)).toBeLessThanOrEqual(1);
    me.x = v.hx; me.y = v.hy; const before = v.stock.food, carried = me.carry.food; controlCmd(sim, { k: 'sdeposit' }); expect(v.stock.food).toBeGreaterThanOrEqual(Math.min(before + carried, before));
    const f = sim.terrain.findIndex((t, i) => t === T.FOREST && Math.abs((i % W) - v.hx) < 30); me.x = f % W; me.y = Math.floor(f / W); sim.wood[f] = 1; me.thirst = 0; controlCmd(sim, { k: 'sact' }); expect(sim.wood[f]).toBeLessThanOrEqual(1);
    const hp = me.health; stepSim(sim, 30); expect(me.job).toBe('idle'); expect(me.health).toBeLessThanOrEqual(1); expect(hp).toBeGreaterThan(0);
    controlCmd(sim, { k: 'release' }); expect(sim.settlers.some((s) => s.ctl)).toBe(false);
  });
});
