import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWorld } from '../app/worldStore';
import { KIND_COLOR, describe } from '../descent/features';
import { versionLabel, type Idea } from '../descent/world';
import { Card, Empty, SectionTitle, cx } from '../components/ui';

const ST: Record<Idea['status'], string> = { 'in-master': 'text-ok', new: 'text-amb', shelved: 'text-slate-400', rejected: 'text-bad' };
export function Chronicle() {
  const w = useWorld((s) => s.world);
  if (!w) return <div className="mono text-sm text-slate-500">Loading…</div>;
  const ideas = Object.values(w.ideas).sort((a, b) => (b.ablation ?? -9) - (a.ablation ?? -9)), notes = [...w.chronicle].reverse();
  return (
    <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Chronicle</h1><p className="text-sm text-slate-500">Every day the lab closes, publishes what changed and why, and starts the next one. Numbers come from the Instructor’s held-out checks.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle>Current master {versionLabel(w.build)}</SectionTitle>
          {w.master.features.length === 0 ? <p className="text-sm text-slate-500">No features yet: the plain labyrinth. Ideas get merged as they prove themselves.</p> : w.master.features.map((f) => <div key={f.id} className="mb-2"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[f.kind] }} /><span className="text-sm">{f.name}</span> <span className="mono text-[11px] text-slate-600">by {f.author} · day {f.day}</span><p className="pl-4 text-xs text-slate-500">{describe(f)}</p></div>)}
          <p className="mono mt-2 text-[11px] text-slate-500">{Object.entries(w.master.tuning).map(([k, v]) => `${k} ${v}`).join(' · ')}</p></Card>
        <Card><SectionTitle>Master quality over time (held-out fun index, simulated players)</SectionTitle>
          {w.history.length < 1 ? <Empty title="No closed days yet" body="After the first day closes you will see the master improve here." /> : <div className="h-56"><ResponsiveContainer><LineChart data={w.history} margin={{ left: -18, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="day" stroke="#4b5568" fontSize={11} /><YAxis stroke="#4b5568" fontSize={11} domain={[0, 1]} /><Tooltip contentStyle={{ background: '#0a0d13', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="masterFun" name="Master fun" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} /><Line dataKey="winnerPopularity" name="Winner popularity" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</Card>
      </div>
      <Card><SectionTitle>Idea Forge ({ideas.length} ideas invented by Builders)</SectionTitle>
        {ideas.length === 0 ? <p className="text-sm text-slate-500">No ideas yet.</p> : <div className="overflow-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Idea</th><th>Inventor</th><th>Day</th><th>Effect when added</th><th>Status</th></tr></thead><tbody>
          {ideas.map((i) => <tr key={i.fid} className="border-t border-white/5 align-top"><td className="py-2 pr-3"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[i.feature.kind] }} /><span className="text-sm">{i.feature.name}</span><div className="max-w-md text-[11px] text-slate-500">{describe(i.feature)}</div></td><td className="mono">{i.author}</td><td className="mono">{i.firstDay}</td><td className="mono">{i.ablation === null ? 'not tested' : `${i.ablation >= 0 ? '+' : ''}${i.ablation.toFixed(3)}`}</td><td className={cx('mono uppercase', ST[i.status])}>{i.status}</td></tr>)}</tbody></table></div>}</Card>
      <div className="space-y-4">{notes.length === 0 && <Empty title="No patch notes yet" body="The first day is still open. Play, then come back tomorrow or fast-forward in the Lab." />}
        {notes.map((n) => (<Card key={n.day}><div className="flex items-center justify-between"><div className="text-lg font-semibold">Day {n.day} <span className="mono text-xs font-normal text-slate-500">{n.date}</span></div><span className={cx('mono rounded-full border px-2.5 py-0.5 text-[11px]', n.changed ? 'border-ok/40 text-ok' : 'border-white/10 text-slate-400')}>{n.before} → {n.after}</span></div>
          <div className="mt-2 space-y-1">{n.lines.map((l, i) => <p key={i} className="text-sm text-slate-300">{l}</p>)}</div>
          <div className="mt-3 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Ver.</th><th>Features</th><th>Fun (train)</th><th>Popularity</th></tr></thead><tbody>
            {n.table.map((r) => <tr key={r.id} className="border-t border-white/5"><td className="mono py-1.5">{r.label}{r.note ? ' ·ctl' : ''}</td><td className="text-slate-400">{r.features.join(', ') || '—'}</td><td className="mono">{r.fun.toFixed(2)}</td><td className="w-40"><div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-vio" style={{ width: `${Math.round(r.popularity * 100)}%` }} /></div></td></tr>)}</tbody></table></div></Card>))}</div>
    </div>
  );
}
