export const W = 96, H = 96, DAY = 240, SEASON_DAYS = 8, YEAR = DAY * SEASON_DAYS * 4, ADULT = 2 * YEAR;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const GENES = ['thrift', 'courage', 'sociability', 'curiosity', 'industry', 'hardiness', 'huntBias', 'foresight'] as const;
export type GeneKey = (typeof GENES)[number];
export type Genes = Record<GeneKey, number>;
export const DOCTRINE_KEYS = ['hunt', 'farm', 'build', 'stock', 'defend'] as const;
export type Doctrine = Record<(typeof DOCTRINE_KEYS)[number], number>;
export type Cause = 'starvation' | 'thirst' | 'cold' | 'wolf' | 'beast' | 'war' | 'fever' | 'old age' | 'accident';
export const CAUSES: Cause[] = ['starvation', 'thirst', 'cold', 'wolf', 'beast', 'war', 'fever', 'old age', 'accident'];
export type Good = 'food' | 'wood' | 'stone' | 'tools';
export type TechId = 'tools' | 'spears' | 'bows' | 'irrigation' | 'curing' | 'herbalism' | 'masonry' | 'tallies' | 'diplomacy';
export const TECHS: Record<TechId, { name: string; desc: string; needs: TechId[] }> = {
  tools: { name: 'Stone Tools', desc: 'Workshop; tools raise gathering yields', needs: [] }, spears: { name: 'Spears', desc: 'Armed warriors and hunters hit harder', needs: ['tools'] }, bows: { name: 'Bows', desc: 'Better hunting and combat', needs: ['spears'] },
  irrigation: { name: 'Irrigation', desc: 'Farms ripen 50% faster', needs: ['tools'] }, curing: { name: 'Smoke-Curing', desc: 'Food spoils half as fast', needs: [] }, herbalism: { name: 'Herbalism', desc: 'Fevers are milder and spread less', needs: [] },
  masonry: { name: 'Masonry', desc: 'Warmer huts, larger villages', needs: ['tools'] }, tallies: { name: 'Tally Marks', desc: 'Fairer trade, easier friendships', needs: [] }, diplomacy: { name: 'Diplomacy', desc: 'Fewer wars, faster peace', needs: ['tallies'] },
};
export type Job = 'idle' | 'drink' | 'eat' | 'forage' | 'hunt' | 'farm' | 'wood' | 'stone' | 'build' | 'deposit' | 'warm' | 'flee' | 'fight' | 'craft' | 'trade' | 'raid' | 'defend' | 'fish' | 'plant';
export type BType = 'hearth' | 'hut' | 'farm' | 'well' | 'granary' | 'palisade' | 'workshop' | 'smokehouse' | 'watchtower' | 'market';
export const T = { WATER: 0, GRASS: 1, FOREST: 2, ROCK: 3, SAND: 4 } as const;

export interface Settler {
  id: number; name: string; v: number; x: number; y: number; age: number; genes: Genes; hunger: number; thirst: number; cold: number; health: number; sick: number;
  carry: { food: number; wood: number; stone: number; tools: number }; job: Job; path: number[]; work: number; moveCd: number; tid: number; thought: string; cool: number; kids: number;
  parents: [number, number]; born: number; alive: boolean; bio: string[]; tx: number; ty: number; atk: number; lastHit: Cause | ''; party: number; ctl: boolean; raid: number; armed: boolean; trade: { to: number; give: Good; amt: number; want: Good; phase: 0 | 1 } | null;
}
export interface Building { type: BType; x: number; y: number; built: boolean; progress: number; crop: number }
export interface Village {
  id: number; name: string; color: string; hx: number; hy: number; doctrine: Doctrine; stock: { food: number; wood: number; stone: number; tools: number; spears: number }; techs: TechId[]; raidCool: number; tradeCool: number; huntCool: number; outlook: Outlook; buildings: Building[];
  founded: number; alive: boolean; peak: number; births: number; deaths: number; fire: boolean; fireUntil: number; lastWolfDeath: number; parent: number;
}
export interface Outlook { wood: number; berry: number; fish: number; stone: number; game: number }
export type AnimalKind = 'rabbit' | 'boar' | 'bear';
export interface Animal { id: number; k: AnimalKind; x: number; y: number; hp: number; cool: number; flee: number }
export const BUILDINGS: Record<BType, { name: string; desc: string; wood: number; stone: number; needs?: TechId }> = {
  hearth: { name: 'Hearth', desc: 'Heart of the village. A fire here warms everyone within 5 tiles and burns wood on cold nights and in winter. The stockpile lives here.', wood: 0, stone: 0 },
  hut: { name: 'Hut', desc: 'Shelter. +4 village capacity (max 5 huts) and warmer nights for those nearby.', wood: 8, stone: 0 },
  farm: { name: 'Farm', desc: 'Grows food slowly while someone tends it. Slow in winter, faster with Irrigation.', wood: 6, stone: 0 },
  well: { name: 'Well', desc: 'Fresh water for villages far from a river or lake.', wood: 2, stone: 6 },
  granary: { name: 'Granary', desc: 'Raises the food stockpile limit and slows spoilage.', wood: 10, stone: 4 },
  palisade: { name: 'Palisade', desc: 'Wolves and bears will not enter within 6 tiles. Defenders fight better beside it.', wood: 12, stone: 6 },
  workshop: { name: 'Workshop', desc: 'Craft tools (+gathering yield) and spears (hunting and war). Needs Stone Tools.', wood: 10, stone: 4, needs: 'tools' },
  smokehouse: { name: 'Smokehouse', desc: 'Cures food: spoilage drops sharply and the stockpile limit rises. Needs Smoke-Curing.', wood: 10, stone: 2, needs: 'curing' },
  watchtower: { name: 'Watchtower', desc: 'Sees threats early: defenders react from farther away and raiders lose surprise.', wood: 10, stone: 6 },
  market: { name: 'Market', desc: 'A trade hub: better exchange rates and friendlier neighbours. Needs Tally Marks.', wood: 12, stone: 4, needs: 'tallies' },
};
export interface Deer { id: number; x: number; y: number; hp: number }
export interface Wolf { id: number; x: number; y: number; hp: number; cool: number; flee: number }
export interface Grave { x: number; y: number; name: string; cause: Cause; year: number; v: number }
export interface Evt { t: number; k: string; text: string; x?: number; y?: number; sid?: number }
export interface DayStat { day: number; year: number; pop: number; deer: number; wolves: number; births: number; deaths: number; byV: Record<number, { pop: number; food: number; wood: number; g: number[] }>; causes: Record<Cause, number> }
export interface Lineage { g: number[]; kids: number; age: number; cause: Cause; v: number }
export interface Wanderer { active: boolean; x: number; y: number; carry: { food: number; wood: number; stone: number; tools: number } }
export interface Totals { births: number; deaths: Record<Cause, number>; founded: number; fell: number; builds: number; trades: number; raids: number; inventions: number }
export interface Sim {
  seed: number; tick: number; rs: number; terrain: Uint8Array; wood: Uint8Array; berry: Uint8Array; stone: Uint8Array; bld: Int16Array;
  rel: Record<string, number>; fauna: Animal[]; fish: Uint8Array; villages: Village[]; settlers: Settler[]; deer: Deer[]; wolves: Wolf[]; graves: Grave[]; nextId: number; events: Evt[]; stats: DayStat[]; lineage: Lineage[]; totals: Totals; wanderer: Wanderer; usedNames: number;
}
