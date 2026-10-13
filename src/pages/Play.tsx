import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Frown, Meh, Smile } from 'lucide-react';
import { useWorld } from '../app/worldStore';
import { useSettings } from '../app/settings';
import { DescentEnv } from '../descent/env';
import { generateFloor } from '../descent/floor';
import { KIND_COLOR, describe } from '../descent/features';
import { versionLabel, type Version } from '../descent/world';
import type { RunMods } from '../descent/types';
import { DescentCanvas } from '../components/DescentCanvas';
import { Btn, Card, Empty, SectionTitle } from '../components/ui';

const KEYS: Record<string, number> = { ArrowUp: 0, w: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowRight: 3, d: 3 };
const BOONS: { id: keyof RunMods; label: string; desc: string }[] = [
  { id: 'fogBonus', label: 'Lantern', desc: '+1 sight radius for the rest of the run' },
  { id: 'lightBonus', label: 'Flask of light', desc: '+25 light on every floor from now on' },
  { id: 'shield', label: 'Ward', desc: 'Survive one warden catch' },
];

function RunGame({ version, seed, day, onExit }: { version: Version; seed: number; day: number; onExit: () => void }) {
  const { recordRun, vote } = useWorld();
  const [depth, setDepth] = useState(0), [mods, setMods] = useState<RunMods>({ fogBonus: 0, lightBonus: 0, shield: false }), [phase, setPhase] = useState<'play' | 'relic' | 'over'>('play');
  const [tick, setTick] = useState(0), [log, setLog] = useState<string[]>([]), [rated, setRated] = useState<number | null>(null), [voted, setVoted] = useState(false);
  const acc = useRef({ steps: 0, near: 0, cleared: 0 }), env = useRef<DescentEnv>(new DescentEnv(generateFloor(version.genome, 0, seed)));
  const startFloor = useCallback((d: number, carry: number, m: RunMods) => { env.current = new DescentEnv(generateFloor(version.genome, d, seed), carry, m); setDepth(d); setPhase('play'); setLog([`Floor ${d + 1}`]); setTick((t) => t + 1); }, [version, seed]);
  const move = useCallback((a: number) => {
    const e = env.current; if (phase !== 'play' || e.outcome !== 'running') return;
    const r = e.step(a); if (r.events.length) setLog((l) => [...r.events.filter((x) => x !== 'hazard' || true), ...l].slice(0, 5)); setTick((t) => t + 1);
    if (e.outcome === 'running') return;
    acc.current.steps += e.steps; acc.current.near += e.stats.nearMisses;
    if (e.outcome === 'cleared') { acc.current.cleared++; setPhase('relic'); } else setPhase('over');
  }, [phase]);
  useEffect(() => { const h = (ev: KeyboardEvent) => { const a = KEYS[ev.key]; if (a === undefined) return; ev.preventDefault(); move(a); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [move]);
  const pick = (id: keyof RunMods) => { const e = env.current, m = { ...mods }; if (id === 'shield') m.shield = true; else m[id] += id === 'fogBonus' ? 1 : 25; if (!e.shield && mods.shield) m.shield = id === 'shield'; startFloor(depth + 1, Math.floor(e.light * 0.5), m); setMods(m); };
  const e = env.current, f = e.floor;
  const finish = (rating: -1 | 0 | 1) => { setRated(rating); recordRun({ day, versionId: version.id, depth: acc.current.cleared, outcome: e.outcome, steps: acc.current.steps, nearMisses: acc.current.near, rating }); };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="flex justify-center"><div className="w-full max-w-[560px]">
        <DescentCanvas env={e} tick={tick} />
        <div className="mt-3 grid grid-cols-3 gap-3 sm:hidden"><span /><Btn onClick={() => move(0)}><ArrowUp /></Btn><span /><Btn onClick={() => move(2)}><ArrowLeft /></Btn><Btn onClick={() => move(1)}><ArrowDown /></Btn><Btn onClick={() => move(3)}><ArrowRight /></Btn></div>
      </div></Card>
      <div className="space-y-3">
        <Card><div className="mono text-xs text-slate-500">Version {version.label} · floor {depth + 1}</div>
          <div className="mt-2 text-xs text-slate-400">Light</div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-amb transition-all" style={{ width: `${Math.max(0, Math.min(100, (e.light / e.initialLight) * 100))}%` }} /></div>
          <p className="mono mt-2 text-xs text-slate-400">{e.light} light · {f.keys.filter((k) => e.mask & (1 << k.key)).length}/{f.keys.length} keys · sight {e.fogRadius}{e.shield ? ' · ward ready' : ''}</p>
          <div className="mono mt-3 min-h-[5rem] space-y-0.5 text-[11px] text-slate-500">{log.map((l, i) => <div key={i} className={i === 0 ? 'text-slate-300' : ''}>{l}</div>)}</div>
          <p className="mt-2 text-xs text-slate-600">Arrow keys / WASD. Reach the green exit before the light dies. Red things hunt you.</p></Card>
        {phase === 'relic' && <Card><SectionTitle>Floor cleared. Choose a boon</SectionTitle><div className="space-y-2">{BOONS.map((b) => <Btn key={b.id} className="w-full !justify-start text-left" onClick={() => pick(b.id)}><span><b>{b.label}</b><br /><span className="text-xs text-slate-400">{b.desc}</span></span></Btn>)}</div></Card>}
        {phase === 'over' && <Card><SectionTitle>{e.outcome === 'caught' ? 'Caught by a Warden' : 'The light died'}</SectionTitle>
          <p className="text-sm text-slate-300">You cleared <b>{acc.current.cleared}</b> floor(s) in {acc.current.steps} steps.</p>
          {rated === null ? (<><p className="mt-3 text-xs text-slate-400">How did this version feel? This is what the Builders learn from.</p><div className="mt-2 flex gap-2"><Btn onClick={() => finish(-1)}><Frown size={18} /></Btn><Btn onClick={() => finish(0)}><Meh size={18} /></Btn><Btn onClick={() => finish(1)}><Smile size={18} /></Btn></div></>) : (<><p className="mt-3 text-xs text-ok">Thanks. The lab will weigh your feedback when today closes.</p>
            <Btn className="mt-2 w-full" disabled={voted} onClick={() => { vote(version.id); setVoted(true); }}>{voted ? 'Voted: best of today' : 'This one felt best today'}</Btn></>)}
          <div className="mt-3 flex gap-2"><Btn variant="primary" onClick={() => { acc.current = { steps: 0, near: 0, cleared: 0 }; setRated(null); setVoted(false); setMods({ fogBonus: 0, lightBonus: 0, shield: false }); startFloor(0, 0, { fogBonus: 0, lightBonus: 0, shield: false }); }}>Again</Btn><Btn onClick={onExit}>Back</Btn></div></Card>}
        {phase === 'play' && <Btn className="w-full" onClick={onExit}>Leave run</Btn>}
      </div>
    </div>
  );
}

export function Play() {
  const { world, busy, away, dismissAway, error } = useWorld(), lastSeen = useSettings((s) => s.lastSeenDay), set = useSettings((s) => s.set);
  const [active, setActive] = useState<Version | null>(null);
  useEffect(() => { if (world && lastSeen === 0) set({ lastSeenDay: world.day }); }, [world, lastSeen, set]);
  const news = useMemo(() => (world && lastSeen > 0 ? world.chronicle.filter((n) => n.day >= lastSeen && n.day < world.day) : []), [world, lastSeen]);
  if (!world) return <div className="grid min-h-[50vh] place-items-center text-center"><div><div className="mono pulse-dot text-acc">{busy ?? 'Loading…'}</div>{error && <p className="mt-2 text-sm text-bad">{error}</p>}<p className="mt-2 text-xs text-slate-600">The first start evolves the initial five versions on your device (about a second).</p></div></div>;
  const seed = world.seed + world.day * 977, mine = world.humanRuns.filter((r) => r.day === world.day);
  if (active) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Descent <span className="text-slate-500">· Day {world.day}</span></h1><RunGame key={active.id} version={active} seed={seed} day={world.day} onExit={() => setActive(null)} /></div>;
  return (
    <div className="space-y-6">
      <div><div className="mono text-xs uppercase tracking-[0.3em] text-acc">Day {world.day} · master {versionLabel(world.build)}</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Five versions of the same labyrinth.<br /><span className="text-acc">You decide which one survives.</span></h1>
        <p className="mt-3 max-w-2xl text-slate-400">Play any of today’s versions. Builders in the Lab invent new features every day; simulated players and you vote with your play. The most popular version becomes tomorrow’s base, and the best ideas from the rest get merged in.</p></div>
      {busy && <div className="mono rounded-lg border border-acc/30 bg-acc/5 px-3 py-2 text-xs text-acc"><span className="pulse-dot">●</span> {busy}</div>}
      {(away > 0 || news.length > 0) && (<Card className="border-acc/30"><SectionTitle right={<Btn className="!py-1 text-xs" onClick={() => { dismissAway(); set({ lastSeenDay: world.day }); }}>Got it</Btn>}>What changed while you were away</SectionTitle>
        <div className="space-y-3">{news.slice(-3).reverse().map((n) => <div key={n.day}><div className="mono text-xs text-slate-500">Day {n.day} · {n.before} → {n.after}</div>{n.lines.slice(0, 3).map((l, i) => <p key={i} className="text-sm text-slate-300">{l}</p>)}</div>)}{!news.length && <p className="text-sm text-slate-400">The lab ran {away} day(s). See the Chronicle.</p>}</div>
        <p className="mt-2 text-[11px] text-slate-600">Computed on your device when you returned: no server is running the lab yet.</p></Card>)}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {world.today.map((v) => { const runs = mine.filter((r) => r.versionId === v.id), best = runs.reduce((m, r) => Math.max(m, r.depth), 0);
          return (<Card key={v.id} className="flex flex-col"><div className="flex items-center justify-between"><span className="mono text-lg text-acc">{v.label}</span><span className="mono text-[11px] uppercase tracking-wider text-slate-500">{v.role === 'control' ? `control · master ${versionLabel(world.build)}` : 'challenger'}</span></div>
            <div className="mt-3 flex-1 space-y-1.5">{v.genome.features.length === 0 && <p className="text-sm text-slate-500">No special features: the plain labyrinth.</p>}
              {v.genome.features.map((f) => <div key={f.id} title={describe(f)}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[f.kind] }} /><span className="text-sm">{f.name}</span><span className="block pl-4 text-xs text-slate-500">{describe(f)}</span></div>)}</div>
            <p className="mono mt-3 text-[11px] text-slate-500">wardens {v.genome.tuning.wardens} · sight {v.genome.tuning.fog} · doors {v.genome.tuning.doors} · size {v.genome.tuning.size}</p>
            <div className="mt-3 flex items-center justify-between"><Btn variant="primary" onClick={() => setActive(v)}>Play {v.label}</Btn><span className="mono text-[11px] text-slate-500">{runs.length ? `${runs.length} run(s) · best ${best} floors` : 'not played yet'}</span></div></Card>); })}
      </div>
      {world.humanVotes[world.day] && <p className="text-xs text-ok">You voted for {world.today.find((v) => v.id === world.humanVotes[world.day])?.label ?? '—'} today.</p>}
      {!world.chronicle.length && <Empty title="This is Day 1" body="Come back tomorrow (or fast-forward in the Lab) and the lab will have closed this day, picked a winner and published a patch note." />}
    </div>
  );
}
