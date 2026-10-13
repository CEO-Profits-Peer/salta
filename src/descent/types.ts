import type { MazeConfig } from '../game/maze/maze';
export type TileKind = 'rift' | 'spring' | 'beacon' | 'bloom' | 'frost' | 'echo' | 'breach' | 'ice';
export type TimedKind = 'pulse' | 'tide' | 'hush';
export type FeatureKind = TileKind | TimedKind;
export const TILE_KINDS: TileKind[] = ['rift', 'spring', 'beacon', 'bloom', 'frost', 'echo', 'breach', 'ice'];
export const TIMED_KINDS: TimedKind[] = ['pulse', 'tide', 'hush'];
export const ALL_KINDS: FeatureKind[] = [...TILE_KINDS, ...TIMED_KINDS];
/** A feature is a composition of a placement (count tiles, or a period for timed ones) and an effect with a power. */
export interface FeatureSpec { id: string; name: string; kind: FeatureKind; count: number; power: number; day: number; author: string }
export interface Tuning { fog: number; lightFactor: number; wardens: number; wardenEvery: number; hazards: number; loops: number; doors: number; size: number }
export interface GameGenome { id: string; features: FeatureSpec[]; tuning: Tuning }
export interface Tile { x: number; y: number; fid: string; kind: TileKind; pair: number }
export interface Floor {
  cfg: MazeConfig; doors: { x: number; y: number; key: number }[]; keys: { x: number; y: number; key: number }[]; tiles: Tile[];
  wardens: { x: number; y: number }[]; light: number; fog: number; seed: number; depth: number; features: FeatureSpec[]; wardenEvery: number;
}
export interface Obs {
  x: number; y: number; free: [number, number, number, number]; goalDx: number; goalDy: number; keyDx: number; keyDy: number; doorDx: number; doorDy: number;
  wardens: { dx: number; dy: number; dist: number }[]; light: number; depth: number;
}
export type Outcome = 'running' | 'cleared' | 'caught' | 'dark';
export interface RunMods { fogBonus: number; lightBonus: number; shield: boolean }
