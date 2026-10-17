import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, FlaskConical, Skull, Star } from 'lucide-react';
import { useLab } from '../app/labStore';
import { useHearth } from '../app/hearthStore';
import { describeSpec, proposalScore, type Proposal, type SpecType } from '../hearth/lab';
import { MOD_LIMITS } from '../hearth/types';
import { Btn, Card, Empty, SectionTitle, cx } from '../components/ui';

const TYPES: { id: SpecType | 'all'; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'creature', label: 'Creatures' }, { id: 'building', label: 'Buildings' }, { id: 'quirk', label: 'Traits' }];
const ICON: Record<SpecType, string> = { creature: '🐾', building: '🏛', quirk: '🧬' };
const Bar = ({ label, v, color }: { label: string; v: number; color: string }) => <div className="grid grid-cols-[62px_1fr_28px] items-center gap-2 text-[10px]"><span className="text-slate-500">{label}</span><div className="h-1 rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: color }} /></div><span className="mono text-slate-500">{Math.round(v * 100)}</span></div>;

export function ContentLab({ go }: { go: (p: string) => void }) {
  const { lab, busy, error, init, run, rate, adopt, remove } = useLab(), mods = useHearth((s) => s.snap?.mods), [tab, setTab] = useState<SpecType | 'all'>('all'), [show, setShow] = useState<'approved' | 'all'>('approved');
  useEffect(() => { void init(); }, [init]);
  const list = useMemo(() => (lab?.library ?? []).filter((p) => (tab === 'all' || p.spec.t === tab) && (show === 'all' || p.info.approved)).sort((a, b) => proposalScore(b) - proposalScore(a)), [lab, tab, show]);
  const active = (p: Proposal) => !!mods && (p.spec.t === 'creature' ? mods.creatures : p.spec.t === 'building' ? mods.buildings : mods.quirks).some((m) => m.id === p.spec.s.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="mono text-xs uppercase tracking-[0.3em] text-vio">Content Lab</div><h1 className="text-2xl font-semibold">AI builders invent new creatures, buildings and traits</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Builders propose; the Instructor checks hard rules; Probes simulate a whole year of Hearthworld with the idea against an identical control world; culled ideas are shown with the reason. You rate what you like, and your ratings steer which ideas survive. Adopt the good ones into your current world.</p></div>
        <Btn onClick={() => go('world')}><ArrowLeft size={15} />Back to the world</Btn>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2">{TYPES.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={cx('rounded-lg border px-3 py-1.5 text-sm', tab === t.id ? 'border-vio/60 bg-vio/10 text-vio' : 'border-white/10 text-slate-400 hover:bg-white/5')}>{t.label}</button>)}
          <div className="ml-auto flex items-center gap-2"><button onClick={() => setShow(show === 'approved' ? 'all' : 'approved')} className="text-xs text-slate-400 underline-offset-4 hover:underline">{show === 'approved' ? 'show rejected too' : 'only approved'}</button><Btn variant="primary" disabled={!!busy} onClick={() => run(tab)}><FlaskConical size={15} />{busy ? 'Simulating…' : `Run AI builders${lab ? ` (generation ${lab.tick})` : ''}`}</Btn></div></div>
        {busy && <div className="mt-3"><div className="mono text-xs text-vio"><span className="pulse-dot">●</span> {busy.msg}</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-vio transition-all" style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} /></div><p className="mt-1 text-[11px] text-slate-600">Each idea is tested in a full simulated year, so a generation takes roughly 10 seconds per type. Runs in the background.</p></div>}
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </Card>
      {mods && (mods.creatures.length + mods.buildings.length + mods.quirks.length > 0) && <Card><SectionTitle>Active in your current world</SectionTitle><div className="flex flex-wrap gap-2">{([['creature', mods.creatures], ['building', mods.buildings], ['quirk', mods.quirks]] as const).flatMap(([k, arr]) => arr.map((m) => <span key={k + m.id} className="inline-flex items-center gap-2 rounded-full border border-vio/30 px-3 py-1 text-xs">{ICON[k]} {m.name}<button className="text-slate-500 hover:text-bad" title="Remove from this world" onClick={() => remove(k, m.id)}>✕</button></span>))}</div><p className="mt-2 text-[11px] text-slate-600">Limits per world: {MOD_LIMITS.creatures} creatures, {MOD_LIMITS.buildings} buildings, {MOD_LIMITS.quirks} traits.</p></Card>}
      {list.length === 0 ? <Empty title={lab?.library.length ? 'Nothing matches this filter' : 'No proposals yet'} body="Press “Run AI builders” to let the first generation invent and test ideas." action={<Btn variant="primary" disabled={!!busy} onClick={() => run('all')}>Run all builders</Btn>} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => (
          <Card key={p.id} className={cx('flex flex-col', !p.info.approved && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold">{ICON[p.spec.t]} {p.spec.s.name}</div><div className="mono text-[10px] uppercase tracking-wider text-slate-500">{p.spec.t} · by Builder-{p.agent} · gen {p.gen}</div></div>
              <span className={cx('mono rounded-full border px-2 py-0.5 text-[10px]', p.info.approved ? 'border-ok/40 text-ok' : 'border-bad/40 text-bad')}>{p.info.approved ? 'approved' : 'rejected'}</span></div>
            <p className="mt-2 flex-1 text-xs text-slate-400">{p.spec.s.desc || describeSpec(p.spec)}</p>
            {p.info.reasons.length > 0 && <p className="mt-2 text-[11px] text-bad">{p.info.reasons[0]}</p>}
            {p.info.score >= 0 && <div className="mt-2 space-y-0.5"><Bar label="In use" v={p.info.uptake} color="#8b5cf6" /><Bar label="Balance" v={p.info.balance} color="#34d399" /><Bar label="Variety" v={p.info.diversity} color="#22d3ee" /><Bar label="Novelty" v={p.info.novelty} color="#f5b84b" /><div className="mono text-[10px] text-slate-600">population {Math.round(p.info.popRatio * 100)}% of control · score {p.info.score.toFixed(2)}</div></div>}
            <div className="mt-3 flex items-center justify-between"><div className="flex" aria-label="Your rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => rate(p.id, n)} className="p-0.5" title={`${n} star${n > 1 ? 's' : ''}`}><Star size={16} className={n <= p.rating ? 'fill-amb text-amb' : 'text-slate-600'} /></button>)}</div>
              {p.info.approved && (active(p) ? <Btn className="!py-1 text-xs" onClick={() => remove(p.spec.t, p.spec.s.id)}><Check size={13} />In world · remove</Btn> : <Btn variant="primary" className="!py-1 text-xs" onClick={() => adopt(p)}>Adopt in world</Btn>)}</div>
          </Card>))}</div>)}
      <Card><SectionTitle>Cull feed: which ideas were dropped, and why</SectionTitle><div className="max-h-72 space-y-1.5 overflow-auto">{!lab?.culls.length && <p className="text-sm text-slate-500">Nothing culled yet.</p>}{[...(lab?.culls ?? [])].reverse().slice(0, 60).map((c, i) => <div key={i} className="flex items-start gap-2 text-xs"><Skull size={13} className="mt-0.5 shrink-0 text-bad" /><span><span className="mono">{c.who}</span> <span className="text-slate-500">{c.reason}</span></span></div>)}</div></Card>
    </div>
  );
}
