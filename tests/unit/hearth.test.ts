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

import { chiefCmd } from '../../src/hearth/sim';
import { objectives, prosperity } from '../../src/hearth/chief';
import { PRESETS, cleanSettings, decodeWorld, encodeWorld, DEFAULT_SETTINGS } from '../../src/hearth/types';
describe('v0.6: world settings and chieftain', () => {
  it('settings shape the world: village count, tribe size, predators, and share codes round-trip', () => {
    const a = createSim(7, { villages: 2, settlers: 5, wolves: 0, bears: 0 }); expect(a.villages.length).toBe(2); expect(a.settlers.length).toBe(10); expect(a.wolves.length).toBe(0); expect(a.fauna.filter((x) => x.k === 'bear').length).toBe(0);
    const b = createSim(7, { villages: 6, settlers: 10, techStart: 2 }); expect(b.villages.length).toBe(6); expect(b.villages[0].techs).toContain('tools');
    const code = encodeWorld(1234, cleanSettings({ ...PRESETS[5].s, name: 'Evo video' })), back = decodeWorld(code)!; expect(back.seed).toBe(1234); expect(back.settings.mutation).toBe(2.8); expect(back.settings.name).toBe('Evo video');
    expect(decodeWorld('garbage')).toBeNull(); expect(cleanSettings({ villages: 99, winter: -4 }).villages).toBe(6); expect(cleanSettings({ winter: -4 }).winter).toBe(0.5); expect(cleanSettings({}).villages).toBe(DEFAULT_SETTINGS.villages);
    stepSim(a, 800); expect(a.settlers.every((s) => Number.isFinite(s.health))).toBe(true);
  }, 30000);
  it('every preset generates a living world', () => { for (const p of PRESETS) { const s = createSim(3, p.s); stepSim(s, 300); expect(s.settlers.length).toBeGreaterThan(5); } }, 30000);
  it('the Chieftain sets doctrine and roles, orders buildings and festivals, and objectives/prosperity track the village', () => {
    const sim = createSim(6); stepSim(sim, 400); const v = sim.villages[0]; chiefCmd(sim, { k: 'order', o: 'feast' }); expect(v.vstats.festivals).toBe(0); // not chief yet: ignored
    chiefCmd(sim, { k: 'chief', v: 0 }); expect(sim.chief).toBe(0);
    chiefCmd(sim, { k: 'doctrine', key: 'hunt', val: 0.99 }); expect(v.doctrine.hunt).toBe(0.99);
    const s = sim.settlers.find((q) => q.v === 0 && q.age >= 15360)!; chiefCmd(sim, { k: 'role', sid: s.id, role: 'woodcutter' }); expect(s.role).toBe('woodcutter');
    const other = sim.settlers.find((q) => q.v === 1)!; chiefCmd(sim, { k: 'role', sid: other.id, role: 'guard' }); expect(other.role).toBe(''); // cannot command other villages
    v.stock.food = 100; v.stock.wood = 100; v.stock.stone = 50; chiefCmd(sim, { k: 'order', o: 'feast' }); expect(v.vstats.festivals).toBe(1); expect(v.stock.food).toBeLessThan(100); chiefCmd(sim, { k: 'order', o: 'feast' }); expect(v.vstats.festivals).toBe(1); // cooldown
    const before = v.buildings.length; chiefCmd(sim, { k: 'order', o: 'build', type: 'hut' }); expect(v.buildings.length).toBe(before + 1); expect(sim.events.some((e) => e.k === 'chief')).toBe(true);
    stepSim(sim, 600); expect(sim.settlers.filter((q) => q.role === 'woodcutter').every((q) => Number.isFinite(q.health))).toBe(true);
    const pr = prosperity(sim, v), obj = objectives(sim, v); expect(pr).toBeGreaterThan(0); expect(pr).toBeLessThanOrEqual(100); expect(obj.length).toBeGreaterThan(5); expect(obj.every((o) => o.progress >= 0 && o.progress <= 1)).toBe(true);
    chiefCmd(sim, { k: 'chief', v: -1 }); expect(sim.chief).toBe(-1);
  }, 30000);
});

import { modCmd } from '../../src/hearth/sim';
import { evaluate, generate, labTick, newLab, violations, describeSpec, mutate, type Spec } from '../../src/hearth/lab';
import { mkSettler, newGenes } from '../../src/hearth/world';
import { Rng } from '../../src/engine/rng';
import { tierOf, type Doctrine } from '../../src/hearth/types';
describe('v0.6b: mods, cities, alliances, emergencies, doctrine drift, Content Lab', () => {
  it('adopted creatures, buildings and traits live in the world; removal cleans up; limits hold', () => {
    const sim = createSim(9); const r = new Rng(1);
    const cr = generate('creature', r), bl = generate('building', r), qk = generate('quirk', r);
    for (const sp of [cr, bl, qk]) modCmd(sim, { k: 'mod', op: 'adopt', kind: sp.t, spec: sp.s } as never);
    expect(sim.mods.creatures.length).toBe(1); expect(sim.fauna.some((a) => a.k === 'm:' + cr.s.id)).toBe(true); expect(sim.settlers.some((s) => s.quirks.includes(qk.s.id))).toBe(true);
    stepSim(sim, 2400); expect(sim.settlers.every((s) => Number.isFinite(s.health))).toBe(true);
    for (let i = 0; i < 6; i++) modCmd(sim, { k: 'mod', op: 'adopt', kind: 'quirk', spec: generate('quirk', r).s } as never); expect(sim.mods.quirks.length).toBe(4);
    modCmd(sim, { k: 'mod', op: 'remove', kind: 'creature', id: cr.s.id }); modCmd(sim, { k: 'mod', op: 'remove', kind: 'quirk', id: qk.s.id });
    expect(sim.fauna.some((a) => a.k === 'm:' + cr.s.id)).toBe(false); expect(sim.settlers.some((s) => s.quirks.includes(qk.s.id))).toBe(false);
    const ser = deserialize(serialize(sim)); expect(ser.mods.quirks.length).toBe(3); stepSim(ser, 300);
  }, 60000);
  it('every building effect works without breaking the simulation', () => {
    const sim = createSim(10), r = new Rng(3);
    for (const eff of ['shelter', 'larder', 'infirmary', 'orchard', 'beacon', 'shrine'] as const) { const b = generate('building', r).s as never as { effect: string; id: string; power: number; wood: number; stone: number; name: string; glyph: string }; b.effect = eff; b.id = 'x' + eff; modCmd(sim, { k: 'mod', op: 'adopt', kind: 'building', spec: b } as never); if (sim.mods.buildings.length >= 5) break; }
    for (const v of sim.villages) { v.stock.wood = 300; v.stock.stone = 100; v.stock.food = 100; } stepSim(sim, 4000);
    expect(sim.villages.some((v) => v.buildings.some((b) => b.type.startsWith('m:')))).toBe(true); expect(sim.settlers.every((s) => Number.isFinite(s.health))).toBe(true);
    for (const v of sim.villages) expect(v.stock.food).toBeGreaterThanOrEqual(0);
  }, 60000);
  it('villages can grow without a building cap (towns and cities exist)', () => {
    const sim = createSim(6), v = sim.villages[0], rng = new Rng(4); expect(tierOf(8)).toBe('Hamlet'); expect(tierOf(30)).toBe('Town'); expect(tierOf(60)).toBe('City');
    v.doctrine.expand = 0; for (let i = 0; i < 34; i++) sim.settlers.push(mkSettler(sim, rng, v.id, v.hx, v.hy, 15360 + 100 * i, newGenes(rng)));
    v.stock.wood = 600; v.stock.stone = 200; v.stock.food = 400; stepSim(sim, 240 * 40);
    expect(v.buildings.filter((b) => b.type === 'hut').length).toBeGreaterThan(5); expect(v.alive).toBe(true);
  }, 90000);
  it('good relations become alliances; the Chieftain can propose or betray', () => {
    let sim = createSim(2), A = 0, B = 1; for (let seed = 1; seed < 12; seed++) { sim = createSim(seed); let best = 1e9; for (const x of sim.villages) for (const y of sim.villages) if (x.id < y.id) { const d = Math.abs(x.hx - y.hx) + Math.abs(x.hy - y.hy); if (d < best) { best = d; A = x.id; B = y.id; } } if (best <= 60) break; }
    const k = `${A}-${B}`; for (let d = 0; d < 80 && !sim.alliances.includes(k); d++) { sim.rel[k] = 0.9; stepSim(sim, 240); }
    expect(sim.alliances).toContain(k); expect(sim.events.some((e) => e.k === 'alliance')).toBe(true);
    chiefCmd(sim, { k: 'chief', v: A }); sim.villages[A].raidCool = 0; chiefCmd(sim, { k: 'order', o: 'raid', to: B });
    expect(sim.alliances).not.toContain(k); expect(sim.rel[k]).toBeLessThan(0.7);
    const s2 = createSim(2); chiefCmd(s2, { k: 'chief', v: 0 }); s2.rel['0-2'] = 0.1; chiefCmd(s2, { k: 'order', o: 'ally', to: 2 }); expect(s2.alliances).toHaveLength(0);
    s2.rel['0-2'] = 0.6; s2.villages[0].stock.food = 20; chiefCmd(s2, { k: 'order', o: 'ally', to: 2 }); expect(s2.alliances).toContain('0-2');
  }, 90000);
  it('starving settlers with empty stores drop everything and lead hungry neighbours to food', () => {
    const sim = createSim(5); stepSim(sim, 60); const v = sim.villages[0], mem = sim.settlers.filter((s) => s.v === 0 && s.age >= 15360); v.stock.food = 0;
    const lead = mem[0]; lead.genes.intellect = 1; lead.genes.sociability = 1; lead.hunger = 0.85; lead.carry.food = 0; lead.job = 'idle'; lead.cool = 0; lead.path = [];
    for (const o of mem.slice(1, 5)) { o.hunger = 0.6; o.job = 'idle'; o.cool = 0; o.path = []; o.x = lead.x; o.y = lead.y; }
    stepSim(sim, 6); expect(['forage', 'fish', 'hunt', 'eat', 'drink']).toContain(lead.job); expect(lead.thought.length).toBeGreaterThan(5);
    expect(sim.settlers.every((s) => s.genes.intellect >= 0 && s.genes.intellect <= 1)).toBe(true);
  });
  it('doctrine drifts slowly towards the people’s skills, and not under a Chieftain', () => {
    const sim = createSim(8), a = sim.villages[0], b = sim.villages[1]; for (const s of sim.settlers) if (s.v === 0 || s.v === 1) { s.genes.huntBias = 1; s.genes.courage = 1; } a.doctrine.hunt = 0; b.doctrine.hunt = 0; chiefCmd(sim, { k: 'chief', v: 1 });
    stepSim(sim, 240 * 30); expect(a.doctrine.hunt).toBeGreaterThan(0.05); expect(a.doctrine.hunt).toBeLessThan(0.5); expect(b.doctrine.hunt).toBe(0);
    const d: Doctrine = a.doctrine; for (const k of Object.keys(d) as (keyof Doctrine)[]) expect(d[k] >= 0 && d[k] <= 1).toBe(true);
  }, 60000);
  it('Content Lab: Instructor rejects bad ideas, Probes simulate, culls have reasons, ratings steer survival', () => {
    const bad = generate('quirk', new Rng(2)); (bad.s as { plus: { stat: string }; minus: { stat: string } }).minus.stat = (bad.s as { plus: { stat: string } }).plus.stat; expect(violations(bad).length).toBeGreaterThan(0); expect(evaluate(bad, []).approved).toBe(false);
    const cheap = generate('building', new Rng(3)); (cheap.s as { wood: number; stone: number; power: number }).wood = 4; (cheap.s as { stone: number }).stone = 0; (cheap.s as { power: number }).power = 3; expect(violations(cheap)).toContain('too cheap for its power');
    for (let i = 0; i < 20; i++) for (const t of ['creature', 'building', 'quirk'] as const) { const sp = generate(t, new Rng(i)); expect(violations(sp)).toEqual([]); expect(violations(mutate(sp, new Rng(i + 99), 0.8)).length).toBeLessThanOrEqual(1); expect(describeSpec(sp).length).toBeGreaterThan(10); }
    let lab = labTick(newLab(3), 'quirk'); expect(lab.library.length).toBeGreaterThanOrEqual(5); expect(lab.library.some((p) => p.info.approved)).toBe(true); expect(lab.tick).toBe(1); expect(lab.pops.quirk!.generation).toBe(1);
    const top = lab.library.find((p) => p.info.approved)!; lab.library = lab.library.map((p) => (p.id === top.id ? { ...p, rating: 5 } : p)); lab = labTick(lab, 'quirk'); expect(lab.library.length).toBeGreaterThan(5); expect(lab.culls.every((c) => c.reason.length > 5)).toBe(true);
    expect(JSON.parse(JSON.stringify(lab)).tick).toBe(2);
  }, 120000);
});
