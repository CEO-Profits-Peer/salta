import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Pause, Play, Square, Trash2, Upload, Cloud } from 'lucide-react';
import { newConfig, useStore, type ExpView } from '../app/store';
import { useExpList, f2, f3 } from '../app/hooks';
import { PROFILES, useSettings, type Profile } from '../app/settings';
import { applyOps } from '../features/builders/builder';
import { serialize, type ExperimentConfig } from '../features/experiments/experiment';
import { MetricsChart, GenTimeChart } from '../components/Charts';
import { MazeCanvas } from '../components/MazeCanvas';
import { Btn, Card, Empty, Field, SectionTitle, StatusBadge, inputCls, cx } from '../components/ui';
import { useAuth } from '../integrations/supabase/auth';
import { cloudConfigured } from '../integrations/supabase/client';
import { syncExperiment } from '../integrations/supabase/sync';

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(n) || a));

function NewExperiment({ onCreate }: { onCreate: (name: string, c: ExperimentConfig, start: boolean) => void }) {
  const profile = useSettings((s) => s.profile), setS = useSettings((s) => s.set);
  const [name, setName] = useState('My experiment'), [cfg, setCfg] = useState<ExperimentConfig>(() => newConfig()), [adv, setAdv] = useState(false);
  const num = (k: keyof ExperimentConfig, lo: number, hi: number) => (e: React.ChangeEvent<HTMLInputElement>) => setCfg({ ...cfg, [k]: k === 'mutationRate' || k === 'survivalRate' || k === 'diversityWeight' ? Math.min(hi, Math.max(lo, Number(e.target.value))) : clamp(Number(e.target.value), lo, hi) });
  const pick = (p: Profile) => { setS({ profile: p, maxActive: PROFILES[p].maxActive(navigator.hardwareConcurrency || 2) }); setCfg({ ...cfg, ...PROFILES[p].cfg }); };
  return (
    <Card>
      <SectionTitle>New experiment</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Compute profile"><div className="flex gap-2">{(Object.keys(PROFILES) as Profile[]).map((p) => <button key={p} onClick={() => pick(p)} className={cx('flex-1 rounded-lg border px-2 py-2 text-xs', profile === p ? 'border-acc/60 bg-acc/10 text-acc' : 'border-white/10 text-slate-400 hover:bg-white/5')}>{PROFILES[p].label}</button>)}</div></Field></div>
      <p className="mt-2 text-xs text-slate-500">{PROFILES[profile].blurb} Environment: deterministic maze · Algorithm: evolutionary optimisation.</p>
      <button onClick={() => setAdv(!adv)} className="mt-3 text-xs text-slate-400 underline-offset-4 hover:underline">{adv ? 'Hide' : 'Show'} advanced settings</button>
      {adv && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Generations (1–200)"><input type="number" className={inputCls} value={cfg.generations} onChange={num('generations', 1, 200)} /></Field>
        <Field label="Tester population (4–64)"><input type="number" className={inputCls} value={cfg.testerPop} onChange={num('testerPop', 4, 64)} /></Field>
        <Field label="Builder population (4–64)"><input type="number" className={inputCls} value={cfg.builderPop} onChange={num('builderPop', 4, 64)} /></Field>
        <Field label="Maze size (7–31)"><input type="number" className={inputCls} value={cfg.mazeSize} onChange={num('mazeSize', 7, 31)} /></Field>
        <Field label="Mutation rate"><input type="number" step="0.05" className={inputCls} value={cfg.mutationRate} onChange={num('mutationRate', 0.01, 1)} /></Field>
        <Field label="Survival rate"><input type="number" step="0.05" className={inputCls} value={cfg.survivalRate} onChange={num('survivalRate', 0.1, 0.9)} /></Field>
        <Field label="Tournament size"><input type="number" className={inputCls} value={cfg.tournamentSize} onChange={num('tournamentSize', 2, 8)} /></Field>
        <Field label="Diversity weight"><input type="number" step="0.05" className={inputCls} value={cfg.diversityWeight} onChange={num('diversityWeight', 0, 1)} /></Field>
        <Field label="Seed"><input type="number" className={inputCls} value={cfg.seed} onChange={num('seed', 0, 2 ** 31)} /></Field>
      </div>}
      <div className="mt-4 flex gap-2"><Btn variant="primary" onClick={() => onCreate(name.trim() || 'Experiment', cfg, true)}><Play size={15} />Create & start</Btn><Btn onClick={() => onCreate(name.trim() || 'Experiment', cfg, false)}>Save as draft</Btn></div>
    </Card>
  );
}

function Detail({ v }: { v: ExpView }) {
  const st = useStore(), user = useAuth((s) => s.user), [msg, setMsg] = useState<string | null>(null), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const s = v.state, active = ['running', 'pausing', 'stopping'].includes(v.status);
  const dl = () => { if (!s) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([serialize(s)], { type: 'application/json' })); a.download = `${v.name.replace(/\W+/g, '-')}-gen${s.generation}.checkpoint.json`; a.click(); URL.revokeObjectURL(a.href); };
  const save = async () => { if (!user) return; setBusy(true); const r = await syncExperiment(v, user.id); setBusy(false); setMsg(r.message); if (r.ok) st.markSynced(v.id); };
  const best = s ? applyOps(s.baseline, s.bestVerified.ops) : null;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{v.name}</h2><div className="mt-1 flex items-center gap-3"><StatusBadge status={v.status} /><span className="mono text-xs text-slate-500">gen {s?.generation ?? 0} / {v.config.generations} · seed {v.config.seed}</span></div></div>
          <div className="flex flex-wrap gap-2">
            {v.status === 'draft' && <Btn variant="primary" onClick={() => st.start(v.id)}><Play size={15} />Start</Btn>}
            {v.status === 'running' && <Btn onClick={() => st.pause(v.id)}><Pause size={15} />Pause</Btn>}
            {v.status === 'paused' && <Btn variant="primary" onClick={() => st.resume(v.id)}><Play size={15} />Resume</Btn>}
            {(active || v.status === 'paused' || v.status === 'queued') && <Btn variant="danger" onClick={() => st.stop(v.id)} disabled={v.status === 'stopping'}><Square size={15} />Stop</Btn>}
            <Btn onClick={dl} disabled={!s} title="Download checkpoint"><Download size={15} /></Btn>
            <Btn onClick={() => st.duplicate(v.id)} title="Duplicate"><Copy size={15} /></Btn>
            <Btn variant="danger" onClick={() => setConfirm(true)} title="Delete"><Trash2 size={15} /></Btn>
          </div>
        </div>
        {v.note && <p className="mt-3 rounded-lg border border-amb/30 bg-amb/5 px-3 py-2 text-xs text-amb">{v.note}</p>}
        {v.error && <p className="mt-3 rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-xs text-bad">Experiment failed: {v.error}</p>}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-acc transition-all" style={{ width: `${((s?.generation ?? 0) / v.config.generations) * 100}%` }} /></div>
        {confirm && <div className="mt-3 flex items-center gap-3 rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm"><span className="flex-1">Delete this experiment and its local checkpoint? Cloud copies are not affected.</span><Btn variant="danger" onClick={() => st.remove(v.id)}>Delete</Btn><Btn onClick={() => setConfirm(false)}>Cancel</Btn></div>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {cloudConfigured ? (user ? <Btn onClick={save} disabled={busy || !s} className="!py-1 text-xs"><Cloud size={14} />{busy ? 'Saving…' : v.syncedAt ? 'Save again to cloud' : 'Save to cloud'}</Btn> : <span>Sign in (Settings) to save to the cloud.</span>) : <span>Local-demo mode: everything is stored only in this browser.</span>}
          {msg && <span className="text-slate-300">{msg}</span>}
        </div>
      </Card>
      {!s ? <Empty title="No results yet" body="Start the experiment to see real evaluation results." /> : (<>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><SectionTitle>Tester fitness</SectionTitle><MetricsChart history={s.history} domain={[-1, 1]} lines={[{ key: 'testerBest', name: 'Best', color: '#22d3ee' }, { key: 'testerMean', name: 'Population mean', color: '#475569' }]} /></Card>
          <Card><SectionTitle>Builder & verified score</SectionTitle><MetricsChart history={s.history} lines={[{ key: 'builderBest', name: 'Best candidate', color: '#8b5cf6' }, { key: 'bestVerifiedScore', name: 'Best verified', color: '#34d399' }, { key: 'validCandidateRate', name: 'Valid candidate rate', color: '#f5b84b' }]} /></Card>
          <Card><SectionTitle>Generation duration</SectionTitle><GenTimeChart ms={v.genMs} /></Card>
          <Card><SectionTitle>Baseline vs best verified</SectionTitle>
            <div className="grid grid-cols-2 gap-3"><div><MazeCanvas cfg={s.baseline} className="aspect-square w-full rounded-lg border border-white/10" /><p className="mono mt-1 text-xs text-slate-500">baseline · train {f3(s.baselineEval.train.score)} · held-out {f3(s.baselineEval.heldOut.score)}</p></div>
              <div>{best && <MazeCanvas cfg={best} className="aspect-square w-full rounded-lg border border-white/10" />}<p className="mono mt-1 text-xs text-slate-500">{s.bestVerified.id} · train {f3(s.bestVerified.train.score)} · held-out {f3(s.bestVerified.heldOut.score)}</p></div></div></Card>
        </div>
        <Card><SectionTitle>Log: instructor decisions & findings</SectionTitle>
          <div className="mono max-h-64 space-y-1 overflow-auto text-xs">
            {[...s.decisions.map((d) => ({ g: d.generation, t: `${d.promoted ? 'PROMOTED' : 'REJECTED'} ${d.candidateId} (train ${f3(d.trainScore)}, held-out ${f3(d.heldOutScore)}): ${d.reasons.join('; ')}`, ok: d.promoted })), ...s.findings.map((f) => ({ g: -1, t: `FINDING ${f.kind} on ${f.gameVersionId} — ${f.evidence} [${f.verified ? 'verified' : 'unverified'}]`, ok: !!f.verified }))].slice(-60).map((l, i) => <div key={i} className={l.ok ? 'text-ok' : 'text-slate-500'}>{l.t}</div>)}
            {!s.decisions.length && !s.findings.length && <div className="text-slate-600">No events yet.</div>}
          </div></Card>
      </>)}
    </div>
  );
}

export function Experiments({ openCreate }: { openCreate: boolean }) {
  const list = useExpList(), st = useStore(), [sel, setSel] = useState<string | null>(null), [creating, setCreating] = useState(openCreate), [err, setErr] = useState<string | null>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!sel && list[0]) setSel(list[0].id); }, [list, sel]);
  const cur = list.find((e) => e.id === sel) ?? list[0];
  const onCreate = (name: string, c: ExperimentConfig, start: boolean) => { const id = st.create(name, c); setSel(id); setCreating(false); if (start) st.start(id); };
  const onImport = async (f?: File) => { if (!f) return; try { setSel(st.importCheckpoint(f.name.replace(/\.json$/, ''), await f.text())); setErr(null); } catch { setErr('That file is not a valid checkpoint.'); } };
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-2">
        <Btn variant="primary" className="w-full" onClick={() => setCreating(true)}>New experiment</Btn>
        <Btn className="w-full" onClick={() => file.current?.click()}><Upload size={15} />Import checkpoint</Btn>
        <input ref={file} type="file" accept=".json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
        {err && <p className="text-xs text-bad">{err}</p>}
        {list.map((e) => (<button key={e.id} onClick={() => { setSel(e.id); setCreating(false); }} className={cx('w-full rounded-lg border p-3 text-left', cur?.id === e.id && !creating ? 'border-acc/50 bg-acc/5' : 'border-white/[0.07] hover:bg-white/5')}>
          <div className="truncate text-sm">{e.name}</div><div className="mt-1 flex items-center justify-between"><StatusBadge status={e.status} /><span className="mono text-[11px] text-slate-500">{e.state?.generation ?? 0}/{e.config.generations}</span></div></button>))}
        {!list.length && <p className="text-xs text-slate-500">No experiments yet.</p>}
      </aside>
      <div>{creating || !cur ? <NewExperiment onCreate={onCreate} /> : <Detail key={cur.id} v={cur} />}</div>
    </div>
  );
}
export { f2 };
