import { useEffect, useMemo, useState } from 'react';
import { Gavel, Play as PlayIcon, Skull } from 'lucide-react';
import { Rng } from '../engine/rng';
import { useWorld } from '../app/worldStore';
import type { AgentView } from '../descent/world';
import { Btn, Card, SectionTitle, cx } from '../components/ui';

function projector(n: number) { const r = new Rng(1234 + n), a = Array.from({ length: n }, () => r.gauss()), b = Array.from({ length: n }, () => r.gauss()); return (v: number[]) => [v.reduce((s, x, i) => s + x * a[i], 0), v.reduce((s, x, i) => s + x * b[i], 0)]; }

function Tank({ title, color, data, culledSet, phase }: { title: string; color: string; data: { before: AgentView[]; after: AgentView[] }; culledSet: Set<number>; phase: number }) {
  const W = 300, H = 220, agents = useMemo(() => {
    const all = [...data.before, ...data.after]; if (!all.length) return [];
    const proj = projector(all[0].vec.length), P = new Map<string, number[]>(), pts = all.map((a) => proj(a.vec));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = (v: number, lo: number, hi: number, size: number) => (hi - lo < 1e-9 ? size / 2 : 22 + ((v - lo) / (hi - lo)) * (size - 44));
    const pos = (a: AgentView) => { const p = proj(a.vec); return [sc(p[0], x0, x1, W), sc(p[1], y0, y1, H)]; };
    void P; const fits = all.map((a) => a.fitness), f0 = Math.min(...fits), f1 = Math.max(...fits), norm = (f: number) => (f1 - f0 < 1e-9 ? 0.5 : (f - f0) / (f1 - f0));
    const ids = [...new Set([...data.before.map((a) => a.id), ...data.after.map((a) => a.id)])];
    return ids.map((id) => { const b = data.before.find((a) => a.id === id), a = data.after.find((x) => x.id === id), ref = (a ?? b)!; return { id, b: b ? pos(b) : null, a: a ? pos(a) : null, r: 4 + 8 * norm(ref.fitness), born: !!a?.born && !b }; });
  }, [data]);
  return (
    <Card className="p-3"><div className="mb-1 flex items-center justify-between px-2"><span className="text-sm font-semibold" style={{ color }}>{title}</span><span className="mono text-[11px] text-slate-500">{data.after.length} alive</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-ink-950/80" role="img" aria-label={`${title} population`}>
        {Array.from({ length: 7 }, (_, i) => <line key={i} x1={i * 50} y1="0" x2={i * 50} y2={H} stroke="rgba(255,255,255,.04)" />)}
        {agents.map((o) => { const culled = culledSet.has(o.id), pos = (phase < 2 ? o.b ?? o.a : o.a ?? o.b) ?? [0, 0], gone = phase < 2 ? !o.b : !o.a, red = phase >= 1 && culled && !o.a;
          return (<g key={o.id} style={{ transition: 'all .8s ease', opacity: gone || (phase === 2 && red) ? 0 : 1, transform: `translate(${pos[0]}px, ${pos[1]}px)` }}>
            <circle r={o.r + 5} fill={red ? '#f87171' : color} opacity=".12" /><circle r={o.r} fill={red ? '#f87171' : color} opacity=".85" />{o.born && phase === 2 && <circle r={o.r + 4} fill="none" stroke="#fff" strokeOpacity=".6" />}{red && <text y="3" textAnchor="middle" fontSize="9" fill="#06080c">×</text>}</g>); })}
      </svg><p className="mt-1 px-2 text-[10px] text-slate-600">Position = genome similarity · size = fitness · white ring = newborn · red × = culled</p></Card>
  );
}

export function Lab() {
  const { world, busy, advance } = useWorld(), [phase, setPhase] = useState(2), [rk, setRk] = useState(0);
  const tick = world?.lastTick;
  useEffect(() => { if (!tick) return; setPhase(0); const a = setTimeout(() => setPhase(1), 900), b = setTimeout(() => setPhase(2), 2100); return () => { clearTimeout(a); clearTimeout(b); }; }, [tick?.day, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!world || !tick) return <div className="mono text-sm text-slate-500">{busy ?? 'No lab data yet.'}</div>;
  const pc = new Set(tick.probes.culled), bc = new Set(tick.builders.culled), feed = [...world.culls].reverse().slice(0, 40);
  const probeBest = world.probes.best?.fitness ?? 0, vf = world.findings.filter((f) => f.verified).length;
  const court = world.culls.filter((c) => c.chamber === 'instructor').slice(-4).reverse();
  const stats = [['Probe champion', probeBest.toFixed(2)], ['Verified findings', `${vf} / ${world.findings.length}`], ['Culled so far', String(world.culls.length)], ['Ideas invented', String(Object.keys(world.ideas).length)]];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">The Lab</h1><p className="text-sm text-slate-500">Live evolution of the three chambers. Last tick: day {tick.day}. Everything here is computed, not decorated.</p></div>
        <div className="flex gap-2"><Btn onClick={() => setRk(rk + 1)}><PlayIcon size={15} />Replay last tick</Btn><Btn variant="primary" disabled={!!busy} onClick={() => advance(1)}>{busy ? 'Evolving…' : 'End day now (fast-forward)'}</Btn></div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(([l, v]) => <Card key={l} className="p-4"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{l}</div><div className="mono mt-1 text-xl">{v}</div></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div><Tank title="Tester chamber · Probes" color="#22d3ee" data={tick.probes} culledSet={pc} phase={phase} /><p className="mt-2 text-xs text-slate-500">Probes play the game hunting defects. False alarms get them culled.</p></div>
        <div><Tank title="Builder chamber · Versions" color="#8b5cf6" data={tick.builders} culledSet={bc} phase={phase} /><p className="mt-2 text-xs text-slate-500">Each orb is a game version with its own invented features.</p></div>
        <Card className="p-3"><div className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold text-amb"><Gavel size={15} />Instructor chamber · Court</div>
          <div className="space-y-2 px-1 text-xs">{court.length === 0 && <p className="text-slate-500">No rulings yet. Fixed rules: schema, solvability, ≤4 features, held-out verification before any promotion.</p>}{court.map((c, i) => <div key={i} className="rounded-lg border border-amb/20 bg-amb/5 p-2"><div className="mono text-amb">{c.who}</div><div className="text-slate-400">{c.reason}</div></div>)}</div>
          <p className="mt-3 px-2 text-[11px] text-slate-600">The Instructor is a fixed, inspectable rule set. Builders cannot edit it.</p></Card>
      </div>
      <Card><SectionTitle>Cull feed: who was removed, and why</SectionTitle>
        <div className="max-h-96 space-y-1.5 overflow-auto">{feed.length === 0 && <p className="text-sm text-slate-500">Nothing culled yet.</p>}{feed.map((c, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-white/5 pb-1.5 text-sm"><Skull size={14} className={cx('mt-1 shrink-0', c.chamber === 'probe' ? 'text-acc' : c.chamber === 'builder' ? 'text-vio' : 'text-amb')} />
            <div className="flex-1"><span className="mono text-xs">{c.who}</span> <span className="text-slate-400">{c.reason}</span></div><span className="mono shrink-0 text-[11px] text-slate-600">day {c.day}</span></div>))}</div></Card>
      <Card><SectionTitle>Latest Probe reports (checked by the independent oracle)</SectionTitle>
        {world.findings.length === 0 ? <p className="text-sm text-slate-500">No reports yet. Versions are clean until a Probe proves otherwise.</p> : <div className="mono space-y-1 text-xs">{world.findings.slice(-8).reverse().map((f, i) => <div key={i} className={f.verified ? 'text-ok' : 'text-slate-500'}>day {f.day} · Probe-{f.probe} on {f.versionId}: {f.kind} ({f.evidence}) → {f.verified ? 'VERIFIED' : 'refuted: false alarm'}</div>)}</div>}</Card>
    </div>
  );
}
