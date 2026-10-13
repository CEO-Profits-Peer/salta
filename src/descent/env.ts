import { Rng } from '../engine/rng';
import { DX, DY, idx } from '../game/maze/maze';
import { isTimed } from './features';
import type { Floor, Obs, Outcome, RunMods, Tile } from './types';

const DEFAULT_MODS: RunMods = { fogBonus: 0, lightBonus: 0, shield: false };
export interface StepResult { obs: Obs; outcome: Outcome; events: string[] }

export class DescentEnv {
  x: number; y: number; steps = 0; light: number; mask = 0; cells: number[]; outcome: Outcome = 'running';
  visited = new Set<number>(); revealed = new Set<number>(); passed = new Set<number>();
  wardens: { x: number; y: number; sx: number; sy: number }[]; decoy: { x: number; y: number; until: number } | null = null;
  frozenUntil = 0; hushUntil = 0; tideUntil = 0; senseUntil = 0; senseExtra = 0; riftCool = 0; shield: boolean; fogRadius: number; initialLight: number;
  used = new Set<number>(); stats = { keys: 0, hazardHits: 0, nearMisses: 0, triggers: 0, kinds: new Set<string>(), lightGained: 0, maxStall: 0, stall: 0, early: false };
  private tileAt = new Map<number, Tile>(); private doorAt: Map<number, number>; private keyAt: Map<number, number>; private rng: Rng; private lastNear = false;

  constructor(public floor: Floor, carryLight = 0, mods: RunMods = DEFAULT_MODS) {
    const c = floor.cfg; this.cells = [...c.cells]; this.x = c.start[0]; this.y = c.start[1];
    this.light = floor.light + carryLight + mods.lightBonus; this.initialLight = this.light; this.shield = mods.shield; this.fogRadius = floor.fog + mods.fogBonus;
    this.wardens = floor.wardens.map((w) => ({ ...w, sx: w.x, sy: w.y }));
    for (const t of floor.tiles) this.tileAt.set(idx(c, t.x, t.y), t);
    this.doorAt = new Map(floor.doors.map((d) => [idx(c, d.x, d.y), d.key])); this.keyAt = new Map(floor.keys.map((k) => [idx(c, k.x, k.y), k.key]));
    this.rng = new Rng(floor.seed ^ 0x9e3779b9); this.arrive();
  }
  private cell(x: number, y: number) { return idx(this.floor.cfg, x, y); }
  private inB(x: number, y: number) { return x >= 0 && y >= 0 && x < this.floor.cfg.width && y < this.floor.cfg.height; }
  canEnter(x: number, y: number) { if (!this.inB(x, y)) return false; const i = this.cell(x, y); if (this.cells[i] === 1) return false; const d = this.doorAt.get(i); return d === undefined || !!(this.mask & (1 << d)); }
  private wardenCan(x: number, y: number) { if (!this.inB(x, y)) return false; const i = this.cell(x, y); return this.cells[i] !== 1 && !this.doorAt.has(i); }
  private reveal() { const r = this.fogRadius; for (let dy = -r; dy <= r; dy++) for (let dx = -r + Math.abs(dy); dx <= r - Math.abs(dy); dx++) if (this.inB(this.x + dx, this.y + dy)) this.revealed.add(this.cell(this.x + dx, this.y + dy)); }
  senseRadius() { return this.fogRadius + (this.steps < this.senseUntil ? this.senseExtra : 0); }
  visible(x: number, y: number) { return Math.abs(x - this.x) + Math.abs(y - this.y) <= this.fogRadius; }

  obs(): Obs {
    const c = this.floor.cfg, free = [0, 1, 2, 3].map((a) => (this.canEnter(this.x + DX[a], this.y + DY[a]) ? 1 : 0)) as Obs['free'];
    const key = this.floor.keys.find((k) => !(this.mask & (1 << k.key))), door = this.floor.doors.find((d) => (this.mask & (1 << d.key)) && !this.passed.has(d.key));
    const sr = this.senseRadius(), ws = this.wardens.map((w) => ({ dx: w.x - this.x, dy: w.y - this.y, dist: Math.abs(w.x - this.x) + Math.abs(w.y - this.y) })).filter((w) => w.dist <= sr).sort((a, b) => a.dist - b.dist).slice(0, 3);
    return { x: this.x, y: this.y, free, goalDx: Math.sign(c.exit[0] - this.x), goalDy: Math.sign(c.exit[1] - this.y), keyDx: key ? Math.sign(key.x - this.x) : 0, keyDy: key ? Math.sign(key.y - this.y) : 0,
      doorDx: door ? Math.sign(door.x - this.x) : 0, doorDy: door ? Math.sign(door.y - this.y) : 0, wardens: ws, light: this.light, depth: this.floor.depth };
  }
  private trigger(kind: string, ev: string[], msg: string) { this.stats.triggers++; this.stats.kinds.add(kind); ev.push(msg); }

  private arrive() {
    const i = this.cell(this.x, this.y), k = this.keyAt.get(i);
    if (k !== undefined && !(this.mask & (1 << k))) { this.mask |= 1 << k; this.stats.keys++; }
    const d = this.doorAt.get(i); if (d !== undefined) this.passed.add(d);
    if (this.visited.has(i)) { this.stats.stall++; this.stats.maxStall = Math.max(this.stats.maxStall, this.stats.stall); } else { this.visited.add(i); this.stats.stall = 0; }
    this.reveal();
  }
  private slide(a: number, max: number) { let n = 0; while (n < max && this.canEnter(this.x + DX[a], this.y + DY[a])) { this.x += DX[a]; this.y += DY[a]; n++; if (this.cells[this.cell(this.x, this.y)] === 2) break; } }

  private tileEffect(a: number, ev: string[]) {
    const i = this.cell(this.x, this.y), t = this.tileAt.get(i); if (!t || this.used.has(i)) return;
    const f = this.floor.features.find((q) => q.id === t.fid); if (!f) return;
    switch (t.kind) {
      case 'rift': { if (this.riftCool > 0) return; const o = this.floor.tiles.find((q) => q.fid === t.fid && q.pair === t.pair && (q.x !== t.x || q.y !== t.y)); if (!o) return; this.x = o.x; this.y = o.y; this.riftCool = 2; this.trigger('rift', ev, `${f.name}: teleported`); break; }
      case 'spring': this.slide(a, f.power); this.trigger('spring', ev, `${f.name}: launched`); break;
      case 'ice': this.slide(a, 14); this.trigger('ice', ev, `${f.name}: slid`); break;
      case 'beacon': this.senseUntil = this.steps + 20; this.senseExtra = f.power; this.used.add(i); this.trigger('beacon', ev, `${f.name}: wardens revealed`); break;
      case 'bloom': { const g = Math.min(f.power * 6, Math.floor(this.initialLight * 1.5) - this.light); if (g > 0) { this.light += g; this.stats.lightGained += g; } this.used.add(i); this.trigger('bloom', ev, `${f.name}: +${Math.max(0, g)} light`); break; }
      case 'frost': this.frozenUntil = this.steps + f.power * 2; this.used.add(i); this.trigger('frost', ev, `${f.name}: wardens frozen`); break;
      case 'echo': this.decoy = { x: this.x, y: this.y, until: this.steps + f.power * 3 }; this.used.add(i); this.trigger('echo', ev, `${f.name}: decoy placed`); break;
      case 'breach': {
        const c = this.floor.cfg, ex = c.exit; let left = f.power;
        const w = [0, 1, 2, 3].map((a) => ({ a, x: this.x + DX[a], y: this.y + DY[a] })).filter((n) => this.inB(n.x, n.y) && n.x > 0 && n.y > 0 && n.x < c.width - 1 && n.y < c.height - 1 && this.cells[this.cell(n.x, n.y)] === 1).sort((p, q) => Math.abs(p.x - ex[0]) + Math.abs(p.y - ex[1]) - (Math.abs(q.x - ex[0]) + Math.abs(q.y - ex[1])));
        for (const n of w) { if (left-- <= 0) break; this.cells[this.cell(n.x, n.y)] = 0; }
        this.used.add(i); this.trigger('breach', ev, `${f.name}: walls torn down`); break;
      }
    }
  }
  private bfsToward(tx: number, ty: number): Int32Array {
    const c = this.floor.cfg, d = new Int32Array(c.width * c.height).fill(-1), q = [this.cell(tx, ty)]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const cur = q[h], cx = cur % c.width, cy = Math.floor(cur / c.width); for (let a = 0; a < 4; a++) { const nx = cx + DX[a], ny = cy + DY[a]; if (!this.wardenCan(nx, ny)) continue; const j = this.cell(nx, ny); if (d[j] < 0) { d[j] = d[cur] + 1; q.push(j); } } }
    return d;
  }
  private moveWardens() {
    let map: Int32Array | null = null, mapKey = '';
    for (const w of this.wardens) {
      const dec = this.decoy && this.steps < this.decoy.until ? this.decoy : null, near = Math.abs(w.x - this.x) + Math.abs(w.y - this.y) <= 5;
      const tgt = dec ?? (near ? { x: this.x, y: this.y } : null);
      if (tgt) {
        const k = `${tgt.x},${tgt.y}`; if (k !== mapKey) { map = this.bfsToward(tgt.x, tgt.y); mapKey = k; }
        const cur = map![this.cell(w.x, w.y)]; if (cur < 0) continue;
        for (let a = 0; a < 4; a++) { const nx = w.x + DX[a], ny = w.y + DY[a]; if (this.wardenCan(nx, ny) && map![this.cell(nx, ny)] === cur - 1) { w.x = nx; w.y = ny; break; } }
      } else {
        const opts = [0, 1, 2, 3].filter((a) => this.wardenCan(w.x + DX[a], w.y + DY[a])); if (!opts.length) continue; const a = opts[this.rng.int(opts.length)]; w.x += DX[a]; w.y += DY[a];
      }
    }
  }
  private checkCaught(): boolean {
    for (const w of this.wardens) if (w.x === this.x && w.y === this.y) { if (this.shield) { this.shield = false; w.x = w.sx; w.y = w.sy; continue; } return true; }
    return false;
  }

  step(a: number): StepResult {
    if (this.outcome !== 'running') return { obs: this.obs(), outcome: this.outcome, events: [] };
    const ev: string[] = []; this.steps++; if (this.riftCool > 0) this.riftCool--;
    const nx = this.x + DX[a], ny = this.y + DY[a];
    if (this.canEnter(nx, ny)) {
      this.x = nx; this.y = ny;
      if (this.cells[this.cell(nx, ny)] === 2) { this.light -= 3; this.stats.hazardHits++; ev.push('hazard'); }
      this.tileEffect(a, ev);
    }
    this.arrive();
    for (const f of this.floor.features) if (isTimed(f.kind) && this.steps % f.count === 0) {
      if (f.kind === 'pulse') { this.senseUntil = this.steps + 3; this.senseExtra = f.power; } else if (f.kind === 'tide') this.tideUntil = this.steps + f.power; else this.hushUntil = this.steps + f.power;
      this.trigger(f.kind, ev, `${f.name}`);
    }
    if (this.x === this.floor.cfg.exit[0] && this.y === this.floor.cfg.exit[1]) { this.outcome = 'cleared'; return { obs: this.obs(), outcome: this.outcome, events: ev }; }
    let caught = this.checkCaught();
    if (!caught && this.steps % this.floor.wardenEvery === 0 && this.steps >= this.frozenUntil && this.steps >= this.hushUntil) { this.moveWardens(); caught = this.checkCaught(); }
    this.light -= this.steps < this.tideUntil ? 2 : 1;
    const md = Math.min(99, ...this.wardens.map((w) => Math.abs(w.x - this.x) + Math.abs(w.y - this.y))), near = md <= 2 && !caught;
    if (near && !this.lastNear) this.stats.nearMisses++; this.lastNear = near;
    if (caught) { this.outcome = 'caught'; this.stats.early = this.steps <= 12; ev.push('caught'); } else if (this.light <= 0) { this.outcome = 'dark'; ev.push('dark'); }
    return { obs: this.obs(), outcome: this.outcome, events: ev };
  }
}
