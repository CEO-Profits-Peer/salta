import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Plus } from 'lucide-react';
import { useExpList, useLatest, f3, type PageId } from '../app/hooks';
import { newConfig, useStore } from '../app/store';
import { useSettings } from '../app/settings';
import { detectCapabilities } from '../engine/compute/capabilities';
import { ChamberGraph } from '../components/ChamberGraph';
import { ChamberCard } from '../components/ChamberCard';
import { Btn, Card, Empty, SectionTitle, Stat } from '../components/ui';

export function Overview({ go }: { go: (p: PageId, create?: boolean) => void }) {
  const list = useExpList(), latest = useLatest(), caps = useMemo(detectCapabilities, []);
  const { create, start } = useStore(); const maxActive = useSettings((s) => s.maxActive);
  const [heap, setHeap] = useState(caps.heapMB);
  useEffect(() => { const t = setInterval(() => setHeap(detectCapabilities().heapMB), 2000); return () => clearInterval(t); }, []);
  const running = list.filter((e) => e.status === 'running'), done = list.filter((e) => e.status === 'completed');
  const agents = list.reduce((s, e) => s + e.config.testerPop + e.config.builderPop, 0);
  const best = list.reduce<number | null>((m, e) => (e.state ? Math.max(m ?? -1, e.state.bestVerified.train.score) : m), null);
  const allMs = running.flatMap((e) => e.genMs.slice(-5)), avgMs = allMs.length ? allMs.reduce((a, b) => a + b, 0) / allMs.length : null;
  const events = list.flatMap((e) => (e.state?.decisions ?? []).map((d) => ({ e, d }))).sort((a, b) => b.d.generation - a.d.generation).slice(0, 6);
  const quick = () => { const id = create('Quick run', newConfig()); start(id); go('experiments'); };
  return (
    <div className="space-y-8">
      <section className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mono text-xs uppercase tracking-[0.3em] text-acc">Evolution laboratory</div>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Evolve the testers.<br />Evolve the builders.<br /><span className="text-acc">Verify every claim.</span></h1>
          <p className="mt-4 max-w-xl text-slate-400">Agents compete inside real maze simulations running on <em>your</em> machine. Testers hunt defects, builders propose new versions, and a deterministic instructor decides what actually counts as an improvement.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Btn variant="primary" onClick={() => go('experiments', true)}><Plus size={16} />Create chamber</Btn>
            <Btn onClick={quick}><Play size={16} />Start experiment</Btn>
          </div>
          <p className="mono mt-4 text-[11px] text-slate-600">All numbers on this screen are measured from your own runs. Nothing is simulated or pre-filled.</p>
        </motion.div>
        <Card className="p-2"><ChamberGraph active={running.length > 0} /></Card>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agents" value={agents} hint="tester + builder populations" />
        <Stat label="Active experiments" value={`${running.length} / ${maxActive}`} />
        <Stat label="Completed" value={done.length} />
        <Stat label="Best verified score" value={f3(best)} hint="train suite, instructor-verified" />
      </section>

      <section>
        <SectionTitle>Chambers {latest && <span className="mono normal-case tracking-normal text-slate-500">showing “{latest.name}”</span>}</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">{(['tester', 'builder', 'instructor'] as const).map((t) => <ChamberCard key={t} type={t} exp={latest} onOpen={() => go(t)} />)}</div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle>Local compute</SectionTitle>
          <dl className="mono grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-slate-500">Backend</dt><dd className="text-right">browser workers</dd>
            <dt className="text-slate-500">Logical cores</dt><dd className="text-right">{caps.cores}</dd>
            <dt className="text-slate-500">Device memory</dt><dd className="text-right">{caps.memoryGB ? `${caps.memoryGB} GB` : 'not reported'}</dd>
            <dt className="text-slate-500">JS heap (this tab)</dt><dd className="text-right">{heap != null ? `${heap} MB` : 'not measurable'}</dd>
            <dt className="text-slate-500">WebGPU</dt><dd className="text-right">{caps.webgpu ? 'detected (unused)' : 'not available'}</dd>
            <dt className="text-slate-500">CPU usage</dt><dd className="text-right">not measurable in browsers</dd>
            <dt className="text-slate-500">Workload</dt><dd className="text-right">{running.length} worker(s){avgMs ? `, ~${Math.round(avgMs)} ms/gen` : ''}</dd>
          </dl>
        </Card>
        <Card>
          <SectionTitle>Recent discoveries</SectionTitle>
          {events.length === 0 ? <Empty title="Nothing yet" body="Instructor decisions about candidate versions will be listed here once an experiment has run." action={<Btn variant="primary" onClick={quick}>Run a first experiment</Btn>} /> : (
            <ul className="space-y-2 text-sm">{events.map(({ e, d }, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2"><span><span className={d.promoted ? 'text-ok' : 'text-slate-500'}>{d.promoted ? 'Promoted' : 'Rejected'}</span> <span className="mono text-xs text-slate-400">{d.candidateId}</span><br /><span className="text-xs text-slate-500">{d.reasons[0]}</span></span><span className="mono shrink-0 text-xs text-slate-500">{e.name} · gen {d.generation}</span></li>))}</ul>)}
        </Card>
      </section>
    </div>
  );
}
