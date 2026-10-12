import { useExpList, useLatest, f2, f3 } from '../app/hooks';
import { applyOps } from '../features/builders/builder';
import { POLICY, REGRESSION, HELDOUT_SEEDS, TRAIN_SEEDS } from '../features/instructors/instructor';
import { MetricsChart } from '../components/Charts';
import { MazeCanvas } from '../components/MazeCanvas';
import { ChamberCard } from '../components/ChamberCard';
import { Card, Empty, SectionTitle, CH, type ChamberType } from '../components/ui';

export function ChamberPage({ type }: { type: ChamberType }) {
  const latest = useLatest(), list = useExpList(), s = latest?.state, c = CH[type];
  if (!latest || !s) return <div className="space-y-5"><h1 className="text-2xl font-semibold" style={{ color: c.color }}>{c.label}</h1><Empty title="No experiment data" body={`${c.blurb} Start an experiment and this chamber will show its real populations and results.`} /></div>;
  void list;
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold" style={{ color: c.color }}>{c.label}</h1><p className="text-sm text-slate-500">{c.blurb} Showing “{latest.name}”.</p></div>
      <ChamberCard type={type} exp={latest} />
      {type === 'tester' && (<div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle>Best tester fitness vs population mean</SectionTitle><MetricsChart history={s.history} domain={[-1, 1]} lines={[{ key: 'testerBest', name: 'Best', color: c.color }, { key: 'testerMean', name: 'Mean', color: '#475569' }]} /></Card>
        <Card><SectionTitle>Population diversity</SectionTitle><MetricsChart history={s.history} lines={[{ key: 'testerDiversity', name: 'Mean nearest-neighbour distance', color: '#8b5cf6' }]} /></Card>
        <Card className="lg:col-span-2"><SectionTitle>Findings (most recent)</SectionTitle>
          {s.findings.length === 0 ? <p className="text-sm text-slate-500">The best tester has not reported any defects. Valid versions correctly produce no findings, so an empty list is expected for clean mazes.</p> : (
            <div className="overflow-auto"><table className="mono w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Kind</th><th>Version</th><th>Severity</th><th>Confidence</th><th>Evidence</th><th>Verified</th></tr></thead><tbody>
              {s.findings.slice(-12).reverse().map((f, i) => <tr key={i} className="border-t border-white/5"><td className="py-1.5">{f.kind}</td><td>{f.gameVersionId}</td><td>{f.severity}</td><td>{f2(f.confidence)}</td><td className="max-w-[280px] truncate">{f.evidence}</td><td className={f.verified ? 'text-ok' : 'text-bad'}>{f.verified ? 'yes' : 'no (false positive)'}</td></tr>)}</tbody></table></div>)}
        </Card></div>)}
      {type === 'builder' && (<div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle>Candidate quality</SectionTitle><MetricsChart history={s.history} lines={[{ key: 'builderBest', name: 'Best', color: c.color }, { key: 'builderMean', name: 'Mean', color: '#475569' }, { key: 'bestVerifiedScore', name: 'Best verified', color: '#34d399' }]} /></Card>
        <Card><SectionTitle>Pareto archive ({s.archive.length})</SectionTitle>
          {!s.archive.length ? <p className="text-sm text-slate-500">No candidate has passed validation and held-out checks yet.</p> : <table className="mono w-full text-xs"><thead className="text-slate-500"><tr><th className="text-left">Version</th><th>Path</th><th>Heuristic</th><th>Anti-exploit</th><th>Held-out</th></tr></thead><tbody>
            {s.archive.map((a) => <tr key={a.id} className="border-t border-white/5 text-center"><td className="py-1.5 text-left">{a.id}</td><td>{f2(a.vec[0])}</td><td>{f2(a.vec[1])}</td><td>{f2(a.vec[2])}</td><td>{f3(a.heldOut)}</td></tr>)}</tbody></table>}</Card>
        <Card className="lg:col-span-2"><SectionTitle>Best verified candidate · {s.bestVerified.id} · {s.bestVerified.ops.length} edit(s) on baseline</SectionTitle><MazeCanvas cfg={applyOps(s.baseline, s.bestVerified.ops)} className="aspect-square w-full max-w-[420px] rounded-lg border border-white/10" /></Card></div>)}
      {type === 'instructor' && (<div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle>Hard constraints (never overridden by score)</SectionTitle><ul className="space-y-1 text-sm text-slate-300">
          <li>Config must satisfy the strict schema</li>{REGRESSION.map((r) => <li key={r.name}>Regression: {r.name}</li>)}
          <li>Changes ≤ {POLICY.maxChangedCells} cells, ≤ {POLICY.maxOps} operations, maxSteps ≤ {POLICY.maxStepsMultiplier}× baseline</li><li>Dimensions, start and exit are frozen</li><li>Production code is never touched: candidates are data, not code</li></ul></Card>
        <Card><SectionTitle>Independence</SectionTitle><ul className="space-y-1 text-sm text-slate-300"><li>{TRAIN_SEEDS.length} training seeds drive builder fitness</li><li>{HELDOUT_SEEDS.length} held-out seeds are used only for promotion</li><li>Testers are scored by a ground-truth oracle, not self-reports</li><li>Builders cannot edit these rules</li></ul></Card>
        <Card className="lg:col-span-2"><SectionTitle>Decision log</SectionTitle>{!s.decisions.length ? <p className="text-sm text-slate-500">No candidate has been evaluated yet.</p> : <div className="mono max-h-72 space-y-1 overflow-auto text-xs">{[...s.decisions].reverse().map((d, i) => <div key={i} className={d.promoted ? 'text-ok' : 'text-slate-400'}>gen {d.generation} · {d.promoted ? 'PROMOTED' : 'REJECTED'} {d.candidateId} · train {f3(d.trainScore)} · held-out {f3(d.heldOutScore)} · {d.reasons.join('; ')}</div>)}</div>}</Card></div>)}
    </div>
  );
}
