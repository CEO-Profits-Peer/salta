import type { ExpView } from '../app/store';
import { f2, f3 } from '../app/hooks';
import { CH, Card, StatusBadge, type ChamberType } from './ui';

export function ChamberCard({ type, exp, onOpen }: { type: ChamberType; exp: ExpView | null; onOpen?: () => void }) {
  const st = exp?.state, c = CH[type], gens = exp?.config.generations ?? 0, gen = st?.generation ?? 0;
  const agents = !exp ? 0 : type === 'tester' ? exp.config.testerPop : type === 'builder' ? exp.config.builderPop : 0;
  const best = !st ? '—' : type === 'tester' ? f2(st.tester.best?.fitness) : type === 'builder' ? f3(st.builder.best?.fitness) : `${st.decisions.filter((d) => d.promoted).length} promoted`;
  const objective = type === 'tester' ? 'Find real defects, minimise false positives' : type === 'builder' ? 'Raise verified maze quality score' : 'Enforce hard constraints, verify on held-out seeds';
  const recent = !st ? null : type === 'instructor' ? st.decisions.at(-1)?.reasons[0] : type === 'builder' ? st.history.at(-1) && `${Math.round(st.history.at(-1)!.validCandidateRate * 100)}% candidates valid` : st.findings.at(-1) ? `${st.findings.at(-1)!.kind}${st.findings.at(-1)!.verified ? ' (verified)' : ' (unverified)'}` : 'no findings yet';
  return (
    <Card className="relative overflow-hidden" >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
      <div className="flex items-start justify-between"><div><div className="text-sm font-semibold" style={{ color: c.color }}>{c.label}</div><p className="mt-0.5 text-xs text-slate-500">{c.blurb}</p></div>{exp ? <StatusBadge status={exp.status} /> : <span className="mono text-[11px] text-slate-600">IDLE</span>}</div>
      <dl className="mono mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-slate-500">Agents</dt><dd className="text-right">{type === 'instructor' ? 'rule engine' : agents}</dd>
        <dt className="text-slate-500">Generation</dt><dd className="text-right">{exp ? `${gen} / ${gens}` : '—'}</dd>
        <dt className="text-slate-500">Best score</dt><dd className="text-right">{best}</dd>
        <dt className="text-slate-500">Resources</dt><dd className="text-right">{exp?.status === 'running' ? '1 worker' : '0 workers'}</dd>
      </dl>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full transition-all" style={{ width: gens ? `${(gen / gens) * 100}%` : 0, background: c.color }} /></div>
      <p className="mt-3 text-xs text-slate-500">Objective: {objective}</p>
      {recent && <p className="mt-1 truncate text-xs text-slate-400">Latest: {recent}</p>}
      {onOpen && <button onClick={onOpen} className="mt-3 text-xs text-slate-300 underline-offset-4 hover:underline">Inspect chamber →</button>}
    </Card>
  );
}
