export const W = 96, H = 96, DAY = 240, SEASON_DAYS = 8, YEAR = DAY * SEASON_DAYS * 4, ADULT = 2 * YEAR;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const GENES = ['thrift', 'courage', 'sociability', 'curiosity', 'industry', 'hardiness', 'huntBias'] as const;
export type GeneKey = (typeof GENES)[number];
export type Genes = Record<GeneKey, number>;
export const DOCTRINE_KEYS = ['hunt', 'farm', 'build', 'stock', 'defend'] as const;
export type Doctrine = Record<(typeof DOCTRINE_KEYS)[number], number>;
export type Cause = 'starvation' | 'thirst' | 'cold' | 'wolf' | 'fever' | 'old age' | 'accident';
export const CAUSES: Cause[] = ['starvation', 'thirst', 'cold', 'wolf', 'fever', 'old age', 'accident'];
export type Job = 'idle' | 'drink' | 'eat' | 'forage' | 'hunt' | 'farm' | 'wood' | 'stone' | 'build' | 'deposit' | 'warm' | 'flee' | 'fight';
export type BType = 'hearth' | 'hut' | 'farm' | 'well' | 'granary' | 'palisade';
export const T = { WATER: 0, GRASS: 1, FOREST: 2, ROCK: 3, SAND: 4 } as const;

export interface Settler {
  id: number; name: string; v: number; x: number; y: number; age: number; genes: Genes; hunger: number; thirst: number; cold: number; health: number; sick: number;
  carry: { food: number; wood: number; stone: number }; job: Job; path: number[]; work: number; moveCd: number; tid: number; thought: string; cool: number; kids: number;
  parents: [number, number]; born: number; alive: boolean; bio: string[]; tx: number; ty: number; atk: number; lastHit: Cause | '';
}
export interface Building { type: BType; x: number; y: number; built: boolean; progress: number; crop: number }
export interface Village {
  id: number; name: string; color: string; hx: number; hy: number; doctrine: Doctrine; stock: { food: number; wood: number; stone: number }; buildings: Building[];
  founded: number; alive: boolean; peak: number; births: number; deaths: number; fire: boolean; fireUntil: number; lastWolfDeath: number; parent: number;
}
export interface Deer { id: number; x: number; y: number; hp: number }
export interface Wolf { id: number; x: number; y: number; hp: number; cool: number; flee: number }
export interface Grave { x: number; y: number; name: string; cause: Cause; year: number; v: number }
export interface Evt { t: number; k: string; text: string; x?: number; y?: number; sid?: number }
export interface DayStat { day: number; year: number; pop: number; deer: number; wolves: number; births: number; deaths: number; byV: Record<number, { pop: number; food: number; wood: number; g: number[] }>; causes: Record<Cause, number> }
export interface Lineage { g: number[]; kids: number; age: number; cause: Cause; v: number }
export interface Wanderer { active: boolean; x: number; y: number; carry: { food: number; wood: number; stone: number } }
export interface Totals { births: number; deaths: Record<Cause, number>; founded: number; fell: number; builds: number }
export interface Sim {
  seed: number; tick: number; rs: number; terrain: Uint8Array; wood: Uint8Array; berry: Uint8Array; stone: Uint8Array; bld: Int16Array;
  villages: Village[]; settlers: Settler[]; deer: Deer[]; wolves: Wolf[]; graves: Grave[]; nextId: number; events: Evt[]; stats: DayStat[]; lineage: Lineage[]; totals: Totals; wanderer: Wanderer; usedNames: number;
}
