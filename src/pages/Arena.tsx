import { useWorld } from '../app/worldStore';
import { Card, Empty, SectionTitle } from '../components/ui';
const R = { '-1': '😖', '0': '😐', '1': '😀' } as const;
export function Arena() {
  const w = useWorld((s) => s.world);
  if (!w) return <div className="mono text-sm text-slate-500">Loading…</div>;
  const runs = [...w.humanRuns].reverse(), best = w.humanRuns.reduce((m, r) => Math.max(m, r.depth), 0), today = w.humanRuns.filter((r) => r.day === w.day);
  return (
    <div className="space-y-5"><h1 className="text-2xl font-semibold">Arena</h1>
      <div className="grid grid-cols-3 gap-3">{[['Best depth', best], ['Runs today', today.length], ['Runs total', w.humanRuns.length]].map(([l, v]) => <Card key={String(l)} className="p-4"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{l}</div><div className="mono mt-1 text-2xl">{v}</div></Card>)}</div>
      <Card><SectionTitle>Daily challenge</SectionTitle><p className="text-sm text-slate-300">Today every version uses the same floors (seed {w.seed + w.day * 977}). Beat your depth on any of them.</p><p className="mt-2 text-xs text-amb">Global leaderboards need a server that re-runs submitted runs to verify them. Until that exists, nothing here is ranked against other people: these are your own, self-reported runs.</p></Card>
      <Card><SectionTitle>Your recent runs</SectionTitle>{runs.length === 0 ? <Empty title="No runs yet" body="Play a version in the Play tab." /> : <table className="mono w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Day</th><th>Version</th><th>Floors</th><th>Steps</th><th>Ended</th><th>Felt</th></tr></thead><tbody>{runs.slice(0, 40).map((r, i) => <tr key={i} className="border-t border-white/5"><td className="py-1.5">{r.day}</td><td>{r.versionId}</td><td>{r.depth}</td><td>{r.steps}</td><td>{r.outcome}</td><td>{R[String(r.rating) as keyof typeof R]}</td></tr>)}</tbody></table>}</Card>
    </div>
  );
}
