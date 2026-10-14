import { create } from 'zustand';
import type { Almanac, Cmd, Snapshot } from '../hearth/api';
import type { DayStat, Evt } from '../hearth/types';
import type { HIn, HOut } from '../workers/hearth.worker';
import { idbAll, idbPut } from './idb';

const OFFLINE_TICKS_PER_SEC = 1 / 3, MAX_OFFLINE = 7680;
interface HearthStore {
  snap: Snapshot | null; terrain: Uint8Array | null; stats: DayStat[]; events: Evt[]; speed: number; selected: { kind: 'settler' | 'village'; id: number } | null; follow: boolean; mode: 'observe' | 'wanderer';
  bio: { id: number; lines: string[] } | null; almanac: Almanac | null; catching: { done: number; total: number } | null; error: string | null; loaded: boolean;
  init: () => Promise<void>; setSpeed: (v: number) => void; cmd: (c: Cmd) => void; select: (s: HearthStore['selected']) => void; setFollow: (f: boolean) => void; setMode: (m: 'observe' | 'wanderer') => void; dismissAlmanac: () => void; newWorld: () => Promise<void>;
}
let worker: Worker | null = null, lastWrite = 0;
const send = (m: HIn) => worker?.postMessage(m);
export const useHearth = create<HearthStore>((set, get) => {
  const start = (checkpoint?: string, offlineTicks = 0) => {
    worker?.terminate(); worker = new Worker(new URL('../workers/hearth.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<HOut>) => {
      const m = e.data;
      if (m.type === 'snap') {
        const cur = get(), lastDay = cur.stats.at(-1)?.day ?? -1, fresh = m.snap.stats.filter((d) => d.day > lastDay);
        set({ snap: m.snap.withMap || !cur.snap ? m.snap : { ...m.snap, wood: cur.snap.wood, berry: cur.snap.berry }, terrain: m.terrain ?? cur.terrain, stats: fresh.length ? [...cur.stats, ...fresh].slice(-1500) : cur.stats, events: m.snap.events.length ? [...cur.events, ...m.snap.events].slice(-300) : cur.events });
      } else if (m.type === 'checkpoint') { if (Date.now() - lastWrite > 4000) { lastWrite = Date.now(); void idbPut({ id: 'hearth', data: m.data, savedAt: Date.now(), tick: m.tick } as { id: string }, 'world'); } }
      else if (m.type === 'catchup') { set({ catching: m.almanac ? null : { done: m.done, total: m.total }, almanac: m.almanac ?? get().almanac }); }
      else if (m.type === 'bio') set({ bio: { id: m.id, lines: m.bio } });
      else if (m.type === 'error') set({ error: m.message });
    };
    worker.onerror = (e) => set({ error: e.message || 'Hearthworld worker crashed' });
    send({ type: 'init', seed: Math.floor(Math.random() * 1e6), checkpoint });
    if (offlineTicks >= 240) { set({ catching: { done: 0, total: offlineTicks } }); send({ type: 'catchup', ticks: offlineTicks }); }
    send({ type: 'speed', v: get().speed });
  };
  return {
    snap: null, terrain: null, stats: [], events: [], speed: 1, selected: null, follow: false, mode: 'observe', bio: null, almanac: null, catching: null, error: null, loaded: false,
    init: async () => {
      if (get().loaded) return; set({ loaded: true });
      const row = (await idbAll<{ id: string; data: string; savedAt: number }>('world')).find((r) => r.id === 'hearth');
      if (row?.data) { const secs = Math.max(0, (Date.now() - row.savedAt) / 1000); start(row.data, Math.min(MAX_OFFLINE, Math.floor(secs * OFFLINE_TICKS_PER_SEC))); } else start();
    },
    setSpeed: (v) => { set({ speed: v }); send({ type: 'speed', v }); },
    cmd: (c) => send({ type: 'cmd', cmd: c }),
    select: (s) => { set({ selected: s, bio: null }); if (s?.kind === 'settler') send({ type: 'inspect', id: s.id }); },
    setFollow: (f) => set({ follow: f }),
    setMode: (m) => { set({ mode: m }); send({ type: 'cmd', cmd: { k: 'wactive', on: m === 'wanderer' } }); },
    dismissAlmanac: () => set({ almanac: null }),
    newWorld: async () => { await idbPut({ id: 'hearth', data: '', savedAt: 0, tick: 0 } as { id: string }, 'world'); set({ snap: null, stats: [], events: [], selected: null, almanac: null }); start(); },
  };
});
