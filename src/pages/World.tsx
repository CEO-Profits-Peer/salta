import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';
import { useHearth } from '../app/hearthStore';
import { HearthCanvas, camRef } from '../components/HearthCanvas';
import { GENES, YEAR, DAY, CAUSES } from '../hearth/types';
import { Btn, Card, SectionTitle, cx } from '../components/ui';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'], SPEEDS = [0, 1, 2, 8, 32];
const GENE_HELP: Record<string, string> = { thrift: 'Hoards for later', courage: 'Fights wolves, hunts boldly', sociability: 'Stays with others, breeds more, catches fever more', curiosity: 'Searches farther away', industry: 'Works harder, eats more', hardiness: 'Needs less food and warmth, works slower', huntBias: 'Prefers hunting over foraging' };
const EV_COL: Record<string, string> = { death: 'text-bad', birth: 'text-ok', build: 'text-acc', plan: 'text-slate-500', village: 'text-amb', wolf: 'text-vio', fever: 'text-lime-400', season: 'text-sky-300', wanderer: 'text-white' };
const Bar = ({ label, v, color, hint }: { label: string; v: number; color: string; hint?: string }) => (<div title={hint} className="grid grid-cols-[84px_1fr_34px] items-center gap-2 text-[11px]"><span className="text-slate-500">{label}</span><div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: color }} /></div><span className="mono text-slate-500">{Math.round(v * 100)}</span></div>);

export function World() {
  const { snap, speed, setSpeed, selected, select, follow, setFollow, mode, setMode, cmd, bio, almanac, dismissAlmanac, catching, events, error } = useHearth();
  const [tab, setTab] = useState<'inspect' | 'villages' | 'events'>('inspect'), last = useRef(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (mode !== 'wanderer' || (e.target as HTMLElement).tagName === 'INPUT') return; const k = e.key.toLowerCase(), now = performance.now();
      const mv: Record<string, [number, number]> = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
      if (mv[k]) { e.preventDefault(); if (now - last.current > 70) { last.current = now; cmd({ k: 'wmove', dx: mv[k][0], dy: mv[k][1] }); } } else if (k === 'e') cmd({ k: 'wgather' }); else if (k === 'f') cmd({ k: 'wgive' }); else if (k === 'g') cmd({ k: 'wdeposit' });
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [mode, cmd]);
  const time = useMemo(() => { if (!snap) return null; const t = snap.tick; return { year: Math.floor(t / YEAR) + 1, season: SEASONS[Math.floor((t % YEAR) / (DAY * 8))], day: Math.floor((t % (DAY * 8)) / DAY) + 1, hour: Math.floor(((t % DAY) / DAY) * 24) }; }, [snap?.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = snap && selected?.kind === 'settler' ? snap.settlers.find((s) => s.id === selected.id) : null, vil = snap && selected?.kind === 'village' ? snap.villages.find((v) => v.id === selected.id) : null;
  const total = snap?.settlers.length ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="mono text-xs uppercase tracking-[0.3em] text-acc">Hearthworld</div><h1 className="text-2xl font-semibold">Four tribes. No script. Survive.</h1></div>
        <div className="flex items-center gap-2">{SPEEDS.map((v) => <Btn key={v} variant={speed === v ? 'primary' : 'ghost'} className="!px-3 !py-1.5 text-xs" onClick={() => setSpeed(v)}>{v === 0 ? <Pause size={14} /> : `${v}×`}</Btn>)}</div>
      </div>
      {error && <p className="rounded-lg border border-bad/40 bg-bad/5 px-3 py-2 text-xs text-bad">Simulation error: {error}</p>}
      {catching && <div className="rounded-lg border border-acc/30 bg-acc/5 px-3 py-2 text-xs text-acc"><span className="pulse-dot">●</span> While you were away the world kept living: simulating {Math.round((catching.done / DAY))} / {Math.round(catching.total / DAY)} days…</div>}
      {almanac && (<Card className="border-acc/30"><SectionTitle right={<Btn className="!py-1 text-xs" onClick={dismissAlmanac}>Close</Btn>}>Almanac: while you were away ({(almanac.ticks / YEAR).toFixed(1)} years)</SectionTitle>
        <p className="text-sm text-slate-300">Population {almanac.popBefore} → {almanac.popAfter}. {almanac.births} born, {Object.values(almanac.deaths).reduce((a, b) => a + b, 0)} died ({CAUSES.filter((c) => almanac.deaths[c] > 0).map((c) => `${almanac.deaths[c]} ${c}`).join(', ') || 'none'}). {almanac.founded} village(s) founded, {almanac.fell} fell, {almanac.builds} buildings finished.</p>
        <p className="mt-1 text-[11px] text-slate-600">Computed on your device when you returned (1 simulated tick per 3 real seconds away, at most one year). No server is running the world yet.</p></Card>)}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="relative"><HearthCanvas onPick={(k, id) => { select(k ? { kind: k, id } : null); if (k) setTab('inspect'); }} />
            {time && snap && <div className="mono pointer-events-none absolute left-3 top-3 rounded-lg bg-ink-950/80 px-3 py-2 text-xs"><div className="text-slate-200">Year {time.year} · {time.season} · day {time.day} · {String(time.hour).padStart(2, '0')}:00</div><div className="text-slate-500">{total} settlers · {snap.villages.filter((v) => v.alive).length} villages · {snap.wolves.length} wolves · {snap.deer.length} deer</div></div>}
            {speed === 0 && <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-ink-950/80 px-3 py-1 text-xs text-amb">paused</div>}
          </div>
          <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">{(['observe', 'wanderer'] as const).map((m) => <Btn key={m} variant={mode === m ? 'primary' : 'ghost'} className="!py-1.5 text-xs" onClick={() => setMode(m)}>{m === 'observe' ? 'Observe' : 'Be the Wanderer'}</Btn>)}<Btn className="!py-1.5 text-xs" disabled={!sel} onClick={() => setFollow(!follow)}>{follow ? 'Unfollow' : 'Follow settler'}</Btn></div>
            <p className="text-xs text-slate-500">{mode === 'wanderer' ? <>WASD move · <b>E</b> gather · <b>F</b> feed/warm nearest settler · <b>G</b> leave supplies at a hearth. Carrying {snap?.wanderer.carry.food ?? 0} food, {snap?.wanderer.carry.wood ?? 0} wood, {snap?.wanderer.carry.stone ?? 0} stone.</> : 'Drag to pan, wheel to zoom, click a settler or a hearth to inspect. Speed 1× is calm: a day lasts one minute.'}</p></div></Card>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">{(['inspect', 'villages', 'events'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cx('flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize', tab === t ? 'border-acc/60 bg-acc/10 text-acc' : 'border-white/10 text-slate-400')}>{t}</button>)}</div>
          {tab === 'inspect' && (<Card>{!sel && !vil ? <p className="text-sm text-slate-500">Click a settler (a coloured dot) to see what it is doing, why, its genes and its life story. Click a village hearth for its doctrine and stores.</p> : sel ? (<div className="space-y-2">
            <div className="flex items-baseline justify-between"><span className="text-lg font-semibold">{sel.name}</span><span className="mono text-xs text-slate-500">{snap!.villages[sel.v]?.name} · {(sel.age / YEAR).toFixed(1)} y{sel.age < 2 * YEAR ? ' · child' : ''}</span></div>
            <p className="rounded-lg bg-white/[0.03] p-2 text-xs text-slate-300"><Sparkles size={12} className="mr-1 inline text-acc" />{sel.thought}</p>
            <div className="space-y-1"><Bar label="Health" v={sel.health} color="#34d399" /><Bar label="Hunger" v={sel.hunger} color="#f5b84b" /><Bar label="Thirst" v={sel.thirst} color="#22d3ee" /><Bar label="Cold" v={sel.cold} color="#93c5fd" /></div>
            <div className="mono text-[11px] text-slate-500">carrying {sel.carry.food} food · {sel.carry.wood} wood · {sel.carry.stone} stone · {sel.kids} children{sel.sick ? ' · feverish' : ''}</div>
            <div className="pt-1 text-[11px] uppercase tracking-widest text-slate-500">Genes (inherited, mutate)</div><div className="space-y-1">{GENES.map((g) => <Bar key={g} label={g} v={sel.genes[g]} color="#8b5cf6" hint={GENE_HELP[g]} />)}</div>
            {sel.parents[0] >= 0 && <p className="text-[11px] text-slate-500">Parents: {snap!.settlers.find((p) => p.id === sel.parents[0])?.name ?? `#${sel.parents[0]} (gone)`} & {snap!.settlers.find((p) => p.id === sel.parents[1])?.name ?? `#${sel.parents[1]} (gone)`}</p>}
            {bio && bio.id === sel.id && <div className="max-h-40 space-y-1 overflow-auto border-t border-white/5 pt-2 text-[11px] text-slate-400">{bio.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}</div>)
            : vil && (<div className="space-y-2"><div className="flex items-baseline justify-between"><span className="text-lg font-semibold" style={{ color: vil.color }}>{vil.name}</span><span className="mono text-xs text-slate-500">{vil.alive ? `${vil.pop} people` : 'ruins'}</span></div>
              <div className="mono text-xs text-slate-400">stock: {vil.stock.food} food · {vil.stock.wood} wood · {vil.stock.stone} stone{vil.fire ? ' · hearth burning' : ''}</div>
              <div className="pt-1 text-[11px] uppercase tracking-widest text-slate-500">Doctrine (this village’s strategy)</div>{(Object.keys(vil.doctrine) as (keyof typeof vil.doctrine)[]).map((k) => <Bar key={k} label={k} v={vil.doctrine[k]} color={vil.color} />)}
              <div className="mono text-[11px] text-slate-500">buildings: {['hut', 'farm', 'well', 'granary', 'palisade'].map((t) => `${vil.buildings.filter((b) => b.type === t && b.built).length} ${t}`).join(' · ')}</div>
              <div className="mono text-[11px] text-slate-500">{vil.births} born · {vil.deaths} died · peak {vil.peak}{vil.parent >= 0 ? ` · split from ${snap!.villages[vil.parent]?.name}` : ''}</div></div>)}</Card>)}
          {tab === 'villages' && <Card className="space-y-3">{snap?.villages.map((v) => <button key={v.id} onClick={() => { select({ kind: 'village', id: v.id }); camRef.cx = v.hx; camRef.cy = v.hy; setTab('inspect'); }} className="block w-full text-left"><div className="flex items-baseline justify-between"><span style={{ color: v.color }} className="text-sm font-semibold">{v.name}</span><span className="mono text-[11px] text-slate-500">{v.alive ? `${v.pop} people` : 'fallen'}</span></div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/5">{(Object.keys(v.doctrine) as (keyof typeof v.doctrine)[]).map((k, i) => <div key={k} title={`${k} ${Math.round(v.doctrine[k] * 100)}`} style={{ width: `${v.doctrine[k] * 20}%`, background: v.color, opacity: 0.35 + i * 0.15 }} />)}</div><div className="mono mt-0.5 text-[10px] text-slate-600">hunt · farm · build · stock · defend</div></button>)}</Card>}
          {tab === 'events' && <Card><div className="max-h-[520px] space-y-1.5 overflow-auto">{[...events].reverse().slice(0, 80).map((e, i) => <button key={i} onClick={() => { if (e.x !== undefined && e.y !== undefined) { camRef.cx = e.x; camRef.cy = e.y; } if (e.sid) select({ kind: 'settler', id: e.sid }); }} className={cx('block w-full text-left text-xs', EV_COL[e.k] ?? 'text-slate-400')}><span className="mono mr-1 text-slate-600">Y{(e.t / YEAR).toFixed(1)}</span>{e.text}</button>)}{!events.length && <p className="text-sm text-slate-500">Waiting for the first events…</p>}</div></Card>}
        </div>
      </div>
    </div>
  );
}
export { Play as PlayIcon };
