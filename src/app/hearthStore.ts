import { create } from 'zustand';
import type { Almanac, Cmd, Snapshot } from '../hearth/api';
import type { DayStat, Evt, WorldSettings } from '../hearth/types';
import type { HIn, HOut } from '../workers/hearth.worker';
import { idbAll, idbDelete, idbPut } from './idb';

const OFFLINE_TICKS_PER_SEC = 1 / 3, MAX_OFFLINE = 7680, INDEX = 'hearth-index';
export interface WorldMeta { id: string; name: string; created: number; savedAt: number; tick: number; pop: number; seed?: number; settings?: Partial<WorldSettings> }
type Mode = 'observe' | 'wanderer' | 'settler';
interface HearthStore {
  snap: Snapshot | null; terrain: Uint8Array | null; stats: DayStat[]; events: Evt[]; speed: number; selected: { kind: 'settler' | 'village'; id: number } | null; follow: boolean; mode: Mode;
  bio: { id: number; lines: string[] } | null; almanac: Almanac | null; catching: { done: number; total: number } | null; error: string | null; loaded: boolean;
  worlds: WorldMeta[]; currentId: string; menuOpen: boolean; resumeSpeed: number; toast: string | null;
  init: () => Promise<void>; setSpeed: (v: number) => void; cmd: (c: Cmd) => void; select: (s: HearthStore['selected']) => void; setFollow: (f: boolean) => void; setMode: (m: Mode) => void;
  playAs: (id: number) => void; dismissAlmanac: () => void; openMenu: (open: boolean) => void; saveNow: () => Promise<void>;
  createWorld: (opts?: { name?: string; seed?: number; settings?: Partial<WorldSettings> }) => Promise<void>; switchWorld: (id: string) => Promise<void>; deleteWorld: (id: string) => Promise<void>; renameWorld: (id: string, name: string) => Promise<void>;
}
let worker: Worker | null = null, pendingSave: (() => void) | null = null, lastPop = 0;
const send = (m: HIn) => worker?.postMessage(m);
const rowId = (id: string) => `hearth:${id}`;
const uid = () => Math.random().toString(36).slice(2, 8);

export const useHearth = create<HearthStore>((set, get) => {
  const writeIndex = async () => { const { worlds, currentId } = get(); await idbPut({ id: INDEX, worlds, current: currentId } as { id: string }, 'world'); };
  const start = (checkpoint?: string, offlineTicks = 0, seed = Math.floor(Math.random() * 1e6), settings?: Partial<WorldSettings>) => {
    worker?.terminate(); worker = new Worker(new URL('../workers/hearth.worker.ts', import.meta.url), { type: 'module' });
    set({ snap: null, terrain: null, stats: [], events: [], selected: null, bio: null, mode: 'observe', follow: false, error: null, almanac: null, catching: null });
    worker.onmessage = (e: MessageEvent<HOut>) => {
      const m = e.data;
      if (m.type === 'snap') {
        const cur = get(), lastDay = cur.stats.at(-1)?.day ?? -1, fresh = m.snap.stats.filter((d) => d.day > lastDay), keep = !m.snap.withMap && cur.snap;
        lastPop = m.snap.settlers.length;
        set({ snap: keep ? { ...m.snap, wood: cur.snap!.wood, berry: cur.snap!.berry, stone: cur.snap!.stone, fish: cur.snap!.fish } : m.snap, terrain: m.terrain ?? cur.terrain, stats: fresh.length ? [...cur.stats, ...fresh].slice(-1500) : cur.stats, events: m.snap.events.length ? [...cur.events, ...m.snap.events].slice(-300) : cur.events });
        const sel = cur.selected; if (cur.mode === 'settler' && !m.snap.settlers.some((s) => s.ctl)) set({ mode: 'observe', toast: sel ? 'Your settler is gone. Back to observing.' : null });
      } else if (m.type === 'checkpoint') {
        const { currentId, worlds } = get(); void idbPut({ id: rowId(currentId), data: m.data, savedAt: Date.now(), tick: m.tick } as { id: string }, 'world');
        set({ worlds: worlds.map((w) => (w.id === currentId ? { ...w, savedAt: Date.now(), tick: m.tick, pop: m.pop } : w)) }); void writeIndex(); pendingSave?.(); pendingSave = null;
      } else if (m.type === 'catchup') set({ catching: m.almanac ? null : { done: m.done, total: m.total }, almanac: m.almanac ?? get().almanac });
      else if (m.type === 'bio') set({ bio: { id: m.id, lines: m.bio } });
      else if (m.type === 'error') set({ error: m.message });
    };
    worker.onerror = (e) => set({ error: e.message || 'Hearthworld worker crashed' });
    send({ type: 'init', seed, settings, checkpoint });
    if (offlineTicks >= 240) { set({ catching: { done: 0, total: offlineTicks } }); send({ type: 'catchup', ticks: offlineTicks }); }
    send({ type: 'speed', v: get().speed });
  };
  const loadWorld = async (id: string) => {
    const row = (await idbAll<{ id: string; data: string; savedAt: number }>('world')).find((r) => r.id === rowId(id));
    if (row?.data) start(row.data, Math.min(MAX_OFFLINE, Math.floor(Math.max(0, (Date.now() - row.savedAt) / 1000) * OFFLINE_TICKS_PER_SEC))); else start();
  };
  return {
    snap: null, terrain: null, stats: [], events: [], speed: 1, selected: null, follow: false, mode: 'observe', bio: null, almanac: null, catching: null, error: null, loaded: false,
    worlds: [], currentId: '', menuOpen: false, resumeSpeed: 1, toast: null,
    init: async () => {
      if (get().loaded) return; set({ loaded: true });
      const rows = await idbAll<{ id: string; worlds?: WorldMeta[]; current?: string; data?: string; savedAt?: number; tick?: number }>('world'), idx = rows.find((r) => r.id === INDEX);
      if (idx?.worlds?.length) { const cur = idx.worlds.some((w) => w.id === idx.current) ? idx.current! : idx.worlds[0].id; set({ worlds: idx.worlds, currentId: cur }); await loadWorld(cur); return; }
      const legacy = rows.find((r) => r.id === 'hearth' && r.data), id = uid(), meta: WorldMeta = { id, name: 'Hearthworld 1', created: Date.now(), savedAt: legacy?.savedAt ?? Date.now(), tick: legacy?.tick ?? 0, pop: 0 };
      set({ worlds: [meta], currentId: id });
      if (legacy?.data) { await idbPut({ id: rowId(id), data: legacy.data, savedAt: legacy.savedAt ?? Date.now(), tick: legacy.tick ?? 0 } as { id: string }, 'world'); await idbDelete('hearth', 'world'); await writeIndex(); await loadWorld(id); } else { await writeIndex(); start(); }
    },
    setSpeed: (v) => { set({ speed: v }); send({ type: 'speed', v }); },
    cmd: (c) => send({ type: 'cmd', cmd: c }),
    select: (s) => { set({ selected: s, bio: null }); if (s?.kind === 'settler') send({ type: 'inspect', id: s.id }); },
    setFollow: (f) => set({ follow: f }),
    setMode: (m) => { const prev = get().mode; if (prev === 'settler' && m !== 'settler') send({ type: 'cmd', cmd: { k: 'release' } }); set({ mode: m }); send({ type: 'cmd', cmd: { k: 'wactive', on: m === 'wanderer' } }); },
    playAs: (id) => { set({ mode: 'settler', follow: true, selected: { kind: 'settler', id } }); send({ type: 'cmd', cmd: { k: 'wactive', on: false } }); send({ type: 'cmd', cmd: { k: 'possess', id } }); },
    dismissAlmanac: () => set({ almanac: null }),
    openMenu: (open) => { const s = get(); if (open && !s.menuOpen) { set({ menuOpen: true, resumeSpeed: s.speed }); get().setSpeed(0); } else if (!open && s.menuOpen) { set({ menuOpen: false }); get().setSpeed(s.resumeSpeed || 1); } },
    saveNow: () => new Promise<void>((res) => { const t = setTimeout(res, 3000); pendingSave = () => { clearTimeout(t); res(); }; send({ type: 'save' }); }),
    createWorld: async (opts) => { await get().saveNow(); const id = uid(), seed = opts?.seed ?? Math.floor(Math.random() * 1e6), n = opts?.name?.trim() || opts?.settings?.name?.trim() || `Hearthworld ${get().worlds.length + 1}`; set({ worlds: [...get().worlds, { id, name: n, created: Date.now(), savedAt: Date.now(), tick: 0, pop: 0, seed, settings: opts?.settings }], currentId: id }); await writeIndex(); start(undefined, 0, seed, opts?.settings); },
    switchWorld: async (id) => { if (id === get().currentId) return; await get().saveNow(); set({ currentId: id }); await writeIndex(); await loadWorld(id); },
    deleteWorld: async (id) => { const { worlds, currentId } = get(); if (worlds.length <= 1) return; await idbDelete(rowId(id), 'world'); const left = worlds.filter((w) => w.id !== id); set({ worlds: left }); if (id === currentId) { set({ currentId: left[0].id }); await writeIndex(); await loadWorld(left[0].id); } else await writeIndex(); },
    renameWorld: async (id, name) => { set({ worlds: get().worlds.map((w) => (w.id === id ? { ...w, name: name.trim() || w.name } : w)) }); await writeIndex(); },
  };
});
export const popOfCurrent = () => lastPop;
