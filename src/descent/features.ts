import { Rng } from '../engine/rng';
import { ALL_KINDS, TILE_KINDS, type FeatureKind, type FeatureSpec, type GameGenome, type Tuning } from './types';

const RANGES: Record<FeatureKind, { count: [number, number]; power: [number, number] }> = {
  rift: { count: [2, 4], power: [0, 3] }, spring: { count: [2, 5], power: [2, 4] }, beacon: { count: [1, 3], power: [3, 6] }, bloom: { count: [1, 3], power: [1, 3] },
  frost: { count: [1, 3], power: [2, 5] }, echo: { count: [1, 3], power: [2, 5] }, breach: { count: [1, 3], power: [1, 2] }, ice: { count: [3, 6], power: [1, 1] },
  pulse: { count: [8, 24], power: [3, 5] }, tide: { count: [12, 30], power: [3, 6] }, hush: { count: [6, 16], power: [1, 2] },
};
const ADJ = ['Echo', 'Ember', 'Hollow', 'Lumen', 'Vesper', 'Gilded', 'Quiet', 'Pale', 'Cinder', 'Marrow', 'Halcyon', 'Argent', 'Umber', 'Silent', 'Wild'];
const NOUN: Record<FeatureKind, string[]> = {
  rift: ['Gate', 'Weave', 'Seam'], spring: ['Spring', 'Kick', 'Leap'], beacon: ['Beacon', 'Lantern', 'Sigil'], bloom: ['Bloom', 'Well', 'Fount'], frost: ['Frost', 'Stillness', 'Chill'],
  echo: ['Decoy', 'Mirage', 'Lure'], breach: ['Breach', 'Fracture', 'Crack'], ice: ['Glide', 'Glaze', 'Rink'], pulse: ['Pulse', 'Ping', 'Sonar'], tide: ['Tide', 'Ebb', 'Gloom'], hush: ['Hush', 'Lull', 'Silence'],
};
export const KIND_COLOR: Record<FeatureKind, string> = { rift: '#8b5cf6', spring: '#34d399', beacon: '#f5b84b', bloom: '#a3e635', frost: '#67e8f9', echo: '#f472b6', breach: '#fb923c', ice: '#93c5fd', pulse: '#22d3ee', tide: '#64748b', hush: '#c4b5fd' };
export const featureId = (k: FeatureKind, count: number, power: number) => `${k}-${count}-${power}`;
export const isTimed = (k: FeatureKind) => !TILE_KINDS.includes(k as never);

export function describe(f: FeatureSpec): string {
  const p = f.power, c = f.count;
  switch (f.kind) {
    case 'rift': return `${c} linked tiles teleport you between each other${p ? ` and reveal ${p} cells around the exit point` : ''}.`;
    case 'spring': return `${c} spring tiles launch you ${p} cells forward.`;
    case 'beacon': return `${c} beacon(s): wardens become visible within ${p} extra cells for 20 steps.`;
    case 'bloom': return `${c} bloom(s) restore ${p * 6} light each (single use).`;
    case 'frost': return `${c} frost tile(s) freeze every warden for ${p * 2} steps.`;
    case 'echo': return `${c} decoy tile(s): wardens chase a phantom for ${p * 3} steps.`;
    case 'breach': return `${c} breach tile(s) tear down ${p} nearby wall(s) toward the exit.`;
    case 'ice': return `${c} ice tiles: you slide until you hit something.`;
    case 'pulse': return `Every ${c} steps a sonar pulse shows wardens within ${p} extra cells for 3 steps.`;
    case 'tide': return `Every ${c} steps the dark thickens: light drains double for ${p} steps.`;
    case 'hush': return `Every ${c} steps all wardens skip ${p} move(s).`;
  }
}
export function invent(rng: Rng, day: number, author: string, kinds: FeatureKind[] = ALL_KINDS): FeatureSpec {
  const kind = rng.pick(kinds), r = RANGES[kind];
  const count = r.count[0] + rng.int(r.count[1] - r.count[0] + 1), power = r.power[0] + rng.int(r.power[1] - r.power[0] + 1);
  return { id: featureId(kind, count, power), name: `${rng.pick(ADJ)} ${rng.pick(NOUN[kind])}`, kind, count: kind === 'rift' ? Math.max(2, count - (count % 2)) : count, power, day, author };
}
export const TUNING_LIMITS: Record<keyof Tuning, [number, number]> = { fog: [2, 6], lightFactor: [1.8, 5], wardens: [1, 4], wardenEvery: [2, 5], hazards: [0, 0.08], loops: [0, 0.3], doors: [0, 2], size: [11, 17] };
export const BASE_TUNING: Tuning = { fog: 4, lightFactor: 3.6, wardens: 1, wardenEvery: 4, hazards: 0.02, loops: 0.12, doors: 0, size: 13 };

/** Hard constraints on a game genome. Returns human-readable violations (empty = valid). */
export function validateGenome(g: GameGenome): string[] {
  const v: string[] = [];
  if (g.features.length > 4) v.push('more than 4 features');
  if (new Set(g.features.map((f) => f.kind)).size !== g.features.length) v.push('duplicate feature kind');
  for (const f of g.features) { const r = RANGES[f.kind]; if (!r) { v.push(`unknown feature kind ${f.kind}`); continue; } if (f.count < r.count[0] || f.count > r.count[1] || f.power < r.power[0] || f.power > r.power[1]) v.push(`feature ${f.name} out of range`); }
  for (const k of Object.keys(TUNING_LIMITS) as (keyof Tuning)[]) { const [lo, hi] = TUNING_LIMITS[k]; const x = g.tuning[k]; if (!Number.isFinite(x) || x < lo - 1e-9 || x > hi + 1e-9) v.push(`tuning.${k} out of range`); }
  if (![11, 13, 15, 17].includes(g.tuning.size)) v.push('size must be 11/13/15/17');
  return v;
}
export const ALL_RANGES = RANGES;
