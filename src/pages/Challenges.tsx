import { useExpList, f3 } from '../app/hooks';
import { Card, Empty, SectionTitle } from '../components/ui';

export function Challenges() {
  return (
    <div className="space-y-5"><h1 className="text-2xl font-semibold">Challenges</h1>
      <Card><SectionTitle>Maze Gauntlet v1</SectionTitle>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Environment</dt><dd>Deterministic grid maze</dd></div><div><dt className="text-slate-500">Actions</dt><dd>up, down, left, right</dd></div>
          <div><dt className="text-slate-500">Scoring</dt><dd>0.4·path length + 0.4·reference-agent completion + 0.2·exploit resistance</dd></div><div><dt className="text-slate-500">Evaluation</dt><dd>Fixed seeds; held-out seeds hidden from optimisation</dd></div>
          <div><dt className="text-slate-500">Submission format</dt><dd>Validated edit list (no executable code)</dd></div><div><dt className="text-slate-500">Server-side verification</dt><dd className="text-amb">not built yet: nothing here can be “verified” today</dd></div></dl></Card>
    </div>
  );
}
export function Leaderboards() {
  const rows = useExpList().filter((e) => e.state && e.state.bestVerified.id !== 'baseline').sort((a, b) => b.state!.bestVerified.heldOut.score - a.state!.bestVerified.heldOut.score);
  return (
    <div className="space-y-5"><h1 className="text-2xl font-semibold">Leaderboards</h1>
      <p className="max-w-2xl text-sm text-slate-400">Three trust levels are kept apart: <b>self-reported</b> (training scores), <b>locally evaluated</b> (held-out evaluation run in your browser), and <b>verified</b> (re-run by a trusted server). Only the first two exist today.</p>
      <Card><SectionTitle>Your local results (locally evaluated, not verified)</SectionTitle>
        {!rows.length ? <Empty title="No results" body="Finish an experiment that promotes at least one candidate." /> : <table className="mono w-full text-xs"><thead className="text-left text-slate-500"><tr><th className="py-1">Experiment</th><th>Version</th><th>Train</th><th>Held-out</th><th>Trust</th></tr></thead><tbody>
          {rows.map((e) => <tr key={e.id} className="border-t border-white/5"><td className="py-1.5">{e.name}</td><td>{e.state!.bestVerified.id}</td><td>{f3(e.state!.bestVerified.train.score)}</td><td>{f3(e.state!.bestVerified.heldOut.score)}</td><td className="text-amb">locally evaluated</td></tr>)}</tbody></table>}</Card>
      <Card><SectionTitle>Verified global leaderboard</SectionTitle><Empty title="No verified entries" body="Verified rankings need a server-side evaluator that re-runs submitted artifacts. That component is not part of this release." /></Card>
    </div>
  );
}
