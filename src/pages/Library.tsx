import { useExpList, f2, f3 } from '../app/hooks';
import { TESTER_LEN } from '../features/testers/tester';
import { Card, Empty, SectionTitle } from '../components/ui';

export function Library() {
  const list = useExpList().filter((e) => e.state);
  if (!list.length) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Agent Library</h1><Empty title="No agents yet" body="Agents appear here after an experiment has produced them. Private by default; publishing needs a cloud account and ships with the verified-evaluation slice." /></div>;
  return (
    <div className="space-y-6"><h1 className="text-2xl font-semibold">Agent Library</h1>
      {list.map((e) => { const s = e.state!, chain = s.decisions.filter((d) => d.promoted);
        return (<Card key={e.id}><SectionTitle>{e.name}</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div><div className="mb-2 text-sm text-slate-300">Best tester <span className="mono text-xs text-slate-500">· evolutionary · found gen {s.tester.best?.generation ?? '—'} · {TESTER_LEN} parameters</span></div>
              <p className="mono text-xs text-slate-400">fitness {f2(s.tester.best?.fitness)} · private · self-reported (scored by local oracle)</p>
              <p className="mono mt-2 break-all text-[11px] text-slate-600">{s.tester.best?.genome.map((g) => g.toFixed(2)).join(' ')}</p></div>
            <div><div className="mb-2 text-sm text-slate-300">Lineage of verified versions</div>
              <svg viewBox={`0 0 ${Math.max(300, (chain.length + 1) * 130)} 70`} className="w-full" role="img" aria-label="Lineage of promoted versions">
                {[{ id: 'baseline', score: s.baselineEval.train.score }, ...chain.map((d) => ({ id: d.candidateId, score: d.trainScore }))].map((n, i, a) => (<g key={n.id}>
                  {i > 0 && <line x1={i * 130 - 28} y1="30" x2={i * 130 + 28} y2="30" stroke="#34d399" strokeWidth="1.5" />}
                  <circle cx={i * 130 + 40} cy="30" r="12" fill="#0a0d13" stroke={i === a.length - 1 ? '#34d399' : '#475569'} strokeWidth="2" />
                  <text x={i * 130 + 40} y="58" textAnchor="middle" fill="#94a3b8" fontSize="9">{n.id.slice(0, 14)}</text><text x={i * 130 + 40} y="68" textAnchor="middle" fill="#64748b" fontSize="9">{f3(n.score)}</text></g>))}
              </svg>
              <p className="text-xs text-slate-500">Each promoted version descends from the previous best (parent → child). Rejected candidates are kept in the decision log, not here.</p></div>
          </div></Card>); })}
    </div>
  );
}
