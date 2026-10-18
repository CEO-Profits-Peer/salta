import type { Snapshot } from '../../hearth/api';
import { DAY, YEAR } from '../../hearth/types';
import { isAllied, relBetween } from './shared';
import type { PanelId } from '../../app/uiStore';

export interface Advice { id: string; level: 'info' | 'warn' | 'alert'; text: string; panel: PanelId; village: number }
const RANK = { alert: 0, warn: 1, info: 2 } as const;
/** Plain-language hints computed from the real simulation state. Nothing here is invented. */
export function computeAdvice(snap: Snapshot): Advice[] {
  const out: Advice[] = [], season = Math.floor((snap.tick % YEAR) / (DAY * 8)), dayInSeason = Math.floor((snap.tick % (DAY * 8)) / DAY), chief = snap.chief;
  for (const v of snap.villages) {
    if (!v.alive) continue; const mine = chief === v.id, watch = chief < 0 || mine, adults = snap.settlers.filter((s) => s.v === v.id && s.age >= 2 * YEAR);
    if (v.pop >= 4 && v.stock.food < Math.max(3, 0.5 * v.pop)) out.push({ id: `food${v.id}`, level: 'alert', text: `${v.name} is running out of food (${v.stock.food} for ${v.pop} people)`, panel: mine ? 'chief' : 'village', village: v.id });
    if ((season === 3 || (season === 2 && dayInSeason >= 5)) && v.stock.wood < 6 + 1.5 * v.pop && watch) out.push({ id: `wood${v.id}`, level: 'warn', text: `${v.name} is low on firewood for the cold (${v.stock.wood} wood)`, panel: mine ? 'chief' : 'village', village: v.id });
    const raiders = snap.settlers.filter((s) => s.job === 'raid' && s.raid === v.id); if (raiders.length) out.push({ id: `raid${v.id}`, level: 'alert', text: `Raiders from ${snap.villages[raiders[0].v]?.name} are attacking ${v.name}!`, panel: 'diplomacy', village: v.id });
    if (mine) {
      if (v.pop >= v.capacity - 1) out.push({ id: `house${v.id}`, level: 'warn', text: `${v.name} is almost full (${v.pop}/${v.capacity}): order a hut`, panel: 'chief', village: v.id });
      const idle = adults.filter((s) => s.job === 'idle').length; if (adults.length >= 4 && idle / adults.length > 0.35) out.push({ id: `idle${v.id}`, level: 'info', text: `${idle} of ${adults.length} adults are idle: assign roles or order a building`, panel: 'chief', village: v.id });
      if (!v.focus && v.techs.length < 15) out.push({ id: `res${v.id}`, level: 'info', text: 'Choose a research focus for your thinkers', panel: 'inventions', village: v.id });
      for (const o of snap.villages) if (o.alive && o.id !== v.id && relBetween(snap, v.id, o.id) >= 0.35 && !isAllied(snap, v.id, o.id)) out.push({ id: `ally${o.id}`, level: 'info', text: `${o.name} would accept an alliance`, panel: 'chief', village: v.id });
    }
    if (watch) for (const o of snap.villages) if (o.alive && o.id > v.id) { const r = relBetween(snap, v.id, o.id); if (r < -0.35 && !isAllied(snap, v.id, o.id)) out.push({ id: `tense${v.id}-${o.id}`, level: 'warn', text: `${v.name} and ${o.name} are hostile (${Math.round(r * 100)}): raids are likely`, panel: 'diplomacy', village: v.id }); }
    for (const w of snap.wolves) if (watch && Math.abs(w[1] - v.hx) + Math.abs(w[2] - v.hy) <= 8) { out.push({ id: `wolf${v.id}`, level: 'warn', text: `A wolf is prowling near ${v.name}`, panel: 'village', village: v.id }); break; }
  }
  return out.sort((a, b) => RANK[a.level] - RANK[b.level]).slice(0, 12);
}
