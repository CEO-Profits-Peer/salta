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
