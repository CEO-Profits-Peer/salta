export const W = 96, H = 96, DAY = 240, SEASON_DAYS = 8, YEAR = DAY * SEASON_DAYS * 4, ADULT = 2 * YEAR;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const GENES = ['thrift', 'courage', 'sociability', 'curiosity', 'industry', 'hardiness', 'huntBias', 'foresight', 'intellect'] as const;
export type GeneKey = (typeof GENES)[number];
export type Genes = Record<GeneKey, number>;
export const DOCTRINE_KEYS = ['hunt', 'farm', 'build', 'stock', 'defend', 'expand'] as const;
export type Doctrine = Record<(typeof DOCTRINE_KEYS)[number], number>;
export type Cause = 'starvation' | 'thirst' | 'cold' | 'wolf' | 'beast' | 'war' | 'fever' | 'old age' | 'accident';
export const CAUSES: Cause[] = ['starvation', 'thirst', 'cold', 'wolf', 'beast', 'war', 'fever', 'old age', 'accident'];
export type Good = 'food' | 'wood' | 'stone' | 'tools';
export type TechId = 'tools' | 'spears' | 'bows' | 'irrigation' | 'curing' | 'herbalism' | 'masonry' | 'tallies' | 'diplomacy' | 'pottery' | 'weaving' | 'husbandry' | 'metallurgy' | 'writing' | 'engineering';
export const TECHS: Record<TechId, { name: string; desc: string; needs: TechId[] }> = {
  tools: { name: 'Stone Tools', desc: 'Workshop; tools raise gathering yields', needs: [] }, spears: { name: 'Spears', desc: 'Armed warriors and hunters hit harder', needs: ['tools'] }, bows: { name: 'Bows', desc: 'Better hunting and combat', needs: ['spears'] },
  irrigation: { name: 'Irrigation', desc: 'Farms ripen 50% faster', needs: ['tools'] }, curing: { name: 'Smoke-Curing', desc: 'Food spoils half as fast', needs: [] }, herbalism: { name: 'Herbalism', desc: 'Fevers are milder and spread less', needs: [] },
  masonry: { name: 'Masonry', desc: 'Warmer huts, larger villages', needs: ['tools'] },
  pottery: { name: 'Pottery', desc: 'Bigger stockpile, slower spoilage', needs: ['tools'] }, weaving: { name: 'Weaving', desc: 'Clothing: the cold bites 20% less', needs: [] }, husbandry: { name: 'Husbandry', desc: 'Farms yield 25% more', needs: ['irrigation'] },
  metallurgy: { name: 'Metallurgy', desc: 'Tools last longer, weapons hit harder', needs: ['masonry', 'spears'] }, writing: { name: 'Writing', desc: 'Faster invention and knowledge sharing', needs: ['tallies'] }, engineering: { name: 'Engineering', desc: 'Buildings go up 30% faster, towers see farther', needs: ['masonry', 'writing'] }, tallies: { name: 'Tally Marks', desc: 'Fairer trade, easier friendships', needs: [] }, diplomacy: { name: 'Diplomacy', desc: 'Fewer wars, faster peace', needs: ['tallies'] },
};
export type Job = 'idle' | 'drink' | 'eat' | 'forage' | 'hunt' | 'farm' | 'wood' | 'stone' | 'build' | 'deposit' | 'warm' | 'flee' | 'fight' | 'craft' | 'trade' | 'raid' | 'defend' | 'fish' | 'plant' | 'feast';
export type BaseBType = 'hearth' | 'hut' | 'farm' | 'well' | 'granary' | 'palisade' | 'workshop' | 'smokehouse' | 'watchtower' | 'market';
export type BType = BaseBType | `m:${string}`;
export const T = { WATER: 0, GRASS: 1, FOREST: 2, ROCK: 3, SAND: 4 } as const;

export interface Settler {
  id: number; name: string; v: number; x: number; y: number; age: number; genes: Genes; hunger: number; thirst: number; cold: number; health: number; sick: number;
  carry: { food: number; wood: number; stone: number; tools: number }; job: Job; path: number[]; work: number; moveCd: number; tid: number; thought: string; cool: number; kids: number;
  parents: [number, number]; born: number; alive: boolean; bio: string[]; tx: number; ty: number; atk: number; lastHit: Cause | ''; party: number; quirks: string[]; role: Role; ctl: boolean; raid: number; armed: boolean; trade: { to: number; give: Good; amt: number; want: Good; phase: 0 | 1 } | null;
}
export interface Building { type: BType; x: number; y: number; built: boolean; progress: number; crop: number }
export interface Village {
  id: number; name: string; color: string; hx: number; hy: number; doctrine: Doctrine; stock: { food: number; wood: number; stone: number; tools: number; spears: number }; techs: TechId[]; tier: string; focus: TechId | ''; raidCool: number; tradeCool: number; huntCool: number; orderCool: Record<string, number>; vstats: VStats; outlook: Outlook; buildings: Building[];
  founded: number; alive: boolean; peak: number; births: number; deaths: number; fire: boolean; fireUntil: number; lastWolfDeath: number; parent: number;
}
export interface Outlook { wood: number; berry: number; fish: number; stone: number; game: number }
export type AnimalKind = string;
export interface Animal { id: number; k: AnimalKind; x: number; y: number; hp: number; cool: number; flee: number }
export const BUILDINGS: Record<BaseBType, { name: string; desc: string; wood: number; stone: number; needs?: TechId }> = {
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
  cfg: WorldSettings; mods: Mods; alliances: string[]; chief: number; rel: Record<string, number>; fauna: Animal[]; fish: Uint8Array; villages: Village[]; settlers: Settler[]; deer: Deer[]; wolves: Wolf[]; graves: Grave[]; nextId: number; events: Evt[]; stats: DayStat[]; lineage: Lineage[]; totals: Totals; wanderer: Wanderer; usedNames: number;
}

// ---------- v0.6: world settings, roles, chieftain ----------
export interface WorldSettings { name: string; villages: number; settlers: number; water: number; resources: number; wolves: number; bears: number; winter: number; mutation: number; aggression: number; techStart: 0 | 1 | 2; sameDoctrine: boolean }
export const DEFAULT_SETTINGS: WorldSettings = { name: '', villages: 4, settlers: 8, water: 0.17, resources: 1, wolves: 5, bears: 2, winter: 1, mutation: 1, aggression: 1, techStart: 1, sameDoctrine: false };
export const SETTING_LIMITS: Record<Exclude<keyof WorldSettings, 'name' | 'techStart' | 'sameDoctrine'>, [number, number, number]> = { villages: [2, 6, 1], settlers: [4, 12, 1], water: [0.1, 0.35, 0.01], resources: [0.5, 1.8, 0.1], wolves: [0, 10, 1], bears: [0, 4, 1], winter: [0.5, 2, 0.1], mutation: [0.5, 3, 0.1], aggression: [0, 2, 0.1] };
export const PRESETS: { id: string; name: string; desc: string; s: Partial<WorldSettings> }[] = [
  { id: 'default', name: 'Balanced', desc: 'Four varied tribes, ordinary winters.', s: {} },
  { id: 'valley', name: 'Peaceful valley', desc: 'Plenty of food, few predators, friendly neighbours. Good for watching inventions spread.', s: { resources: 1.5, wolves: 2, bears: 0, aggression: 0.3, winter: 0.7, techStart: 2 } },
  { id: 'harsh', name: 'Long winters', desc: 'Scarce land and brutal cold. Foresight and shelter decide who lives.', s: { resources: 0.7, winter: 1.7, wolves: 7, bears: 3, villages: 3 } },
  { id: 'war', name: 'War of the tribes', desc: 'Six crowded tribes, quick tempers, early spears.', s: { villages: 6, settlers: 10, aggression: 1.9, resources: 0.9, techStart: 2, water: 0.12 } },
  { id: 'islands', name: 'Island nations', desc: 'Lots of water: fish, trade caravans and isolation.', s: { water: 0.33, villages: 4, resources: 1.1, wolves: 3 } },
  { id: 'evo', name: 'Fast evolution', desc: 'High mutation and small tribes: watch genes drift quickly. Great for videos.', s: { mutation: 2.8, settlers: 6, villages: 5 } },
  { id: 'wild', name: 'Wild frontier', desc: 'Dangerous: many wolves and bears, rich land to fight over.', s: { wolves: 10, bears: 4, resources: 1.4, villages: 4 } },
];
const clampTo = (v: number, [lo, hi, st]: [number, number, number]) => Math.min(hi, Math.max(lo, Math.round(v / st) * st));
export function cleanSettings(s: Partial<WorldSettings>): WorldSettings {
  const o = { ...DEFAULT_SETTINGS, ...s } as WorldSettings;
  for (const k of Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]) { const x = Number(o[k]); o[k] = Number.isFinite(x) ? Number(clampTo(x, SETTING_LIMITS[k]).toFixed(2)) : DEFAULT_SETTINGS[k]; }
  o.techStart = [0, 1, 2].includes(o.techStart) ? o.techStart : 1; o.sameDoctrine = !!o.sameDoctrine; o.name = String(o.name ?? '').slice(0, 40); return o;
}
/** Share code: lets creators publish a world (seed + settings) as one short string. */
export function encodeWorld(seed: number, s: WorldSettings): string { return 'HW1-' + btoa(JSON.stringify({ s: seed, ...cleanSettings(s) })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decodeWorld(code: string): { seed: number; settings: WorldSettings } | null {
  try { const m = /^HW1-([A-Za-z0-9_-]+)$/.exec(code.trim()); if (!m) return null; const o = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))); if (typeof o.s !== 'number' || !Number.isFinite(o.s)) return null; const { s, ...rest } = o; return { seed: Math.abs(Math.floor(s)) % 2147483647, settings: cleanSettings(rest) }; } catch { return null; }
}
export type Role = '' | 'gatherer' | 'hunter' | 'farmer' | 'woodcutter' | 'quarrier' | 'builder' | 'crafter' | 'guard' | 'trader';
export const ROLES: { id: Role; name: string; desc: string }[] = [
  { id: '', name: 'Free', desc: 'Decides for itself from the village needs and its own genes.' }, { id: 'gatherer', name: 'Gatherer', desc: 'Forages berries and fishes.' }, { id: 'hunter', name: 'Hunter', desc: 'Hunts small game and joins hunting parties.' },
  { id: 'farmer', name: 'Farmer', desc: 'Tends the farms.' }, { id: 'woodcutter', name: 'Woodcutter', desc: 'Cuts and replants trees.' }, { id: 'quarrier', name: 'Quarrier', desc: 'Digs stone.' },
  { id: 'builder', name: 'Builder', desc: 'Builds and crafts at the workshop.' }, { id: 'crafter', name: 'Crafter', desc: 'Makes tools and spears.' }, { id: 'guard', name: 'Guard', desc: 'Stays near the hearth and defends it, even when timid.' }, { id: 'trader', name: 'Trader', desc: 'Leads caravans first, otherwise gathers.' },
];
export interface VStats { trades: number; winters: number; defended: number; lastWarDeath: number; lastAttack: number; festivals: number }

// ---------- v0.6: moddable content (AI-invented creatures, buildings, traits) ----------
export type Stat = 'hunger' | 'thirst' | 'cold' | 'speed' | 'yield' | 'combat' | 'fever' | 'birth' | 'learn';
export const STATS: { id: Stat; label: string }[] = [{ id: 'hunger', label: 'needs less food' }, { id: 'thirst', label: 'needs less water' }, { id: 'cold', label: 'feels the cold less' }, { id: 'speed', label: 'walks faster' }, { id: 'yield', label: 'gathers more' }, { id: 'combat', label: 'fights harder' }, { id: 'fever', label: 'resists fever' }, { id: 'birth', label: 'has more children' }, { id: 'learn', label: 'invents more' }];
export type Habitat = 'grass' | 'forest' | 'rock' | 'sand' | 'any';
export interface CreatureSpec { id: string; name: string; role: 'prey' | 'predator'; hp: number; every: number; meat: number; dmg: number; habitat: Habitat; herd: number; hue: number; aggression: number; desc: string }
export type Effect = 'shelter' | 'larder' | 'infirmary' | 'orchard' | 'beacon' | 'shrine' | 'forge';
export interface BuildSpec { id: string; name: string; glyph: string; wood: number; stone: number; needs?: TechId; effect: Effect; power: number; desc: string }
export interface QuirkSpec { id: string; name: string; plus: { stat: Stat; amt: number }; minus: { stat: Stat; amt: number }; desc: string }
export interface Mods { creatures: CreatureSpec[]; buildings: BuildSpec[]; quirks: QuirkSpec[] }
export const EMPTY_MODS: Mods = { creatures: [], buildings: [], quirks: [] };
export const MOD_LIMITS = { creatures: 4, buildings: 5, quirks: 4 };

export const tierOf = (pop: number) => (pop >= 50 ? 'City' : pop >= 26 ? 'Town' : pop >= 12 ? 'Village' : 'Hamlet');
