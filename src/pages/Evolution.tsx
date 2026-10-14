import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useHearth } from '../app/hearthStore';
import { CAUSES, GENES } from '../hearth/types';
import { Card, Empty, SectionTitle } from '../components/ui';

const tip = { contentStyle: { background: '#0a0d13', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 } }, ax = { stroke: '#4b5568', fontSize: 11 } as const;
export function Evolution() {
  const { snap, stats } = useHearth(), [gene, setGene] = useState<(typeof GENES)[number]>('courage');
  const villages = snap?.villages ?? [], rows = useMemo(() => stats.filter((_, i) => i % 3 === 0 || i === stats.length - 1), [stats]);
  const popData = useMemo(() => rows.map((r) => ({ year: +r.year.toFixed(2), total: r.pop, ...Object.fromEntries(Object.entries(r.byV).map(([k, v]) => [`v${k}`, v.pop])) })), [rows]);
  const gi = GENES.indexOf(gene), geneData = useMemo(() => rows.map((r) => ({ year: +r.year.toFixed(2), ...Object.fromEntries(Object.entries(r.byV).map(([k, v]) => [`v${k}`, +v.g[gi].toFixed(3)])) })), [rows, gi]);
  const causes = snap ? CAUSES.map((c) => ({ cause: c, deaths: snap.totals.deaths[c] })) : [];
  const sel = snap?.selection ? GENES.map((g, i) => ({ gene: g, diff: +snap.selection![i].toFixed(3) })) : null;
  if (!snap || stats.length < 2) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Evolution</h1><Empty title="The first days are still unfolding" body="Charts appear after a few simulated days. Put the World on 8× or 32× to watch generations pass." /></div>;
  const vl = villages.filter((v) => popData.some((d) => (d as Record<string, number>)[`v${v.id}`] !== undefined));
  return (
    <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Evolution</h1><p className="text-sm text-slate-500">Settlers inherit 7 genes with mutation. Who survives and has children decides which genes spread, and each village drifts towards its own strategy.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><SectionTitle>Population per village</SectionTitle><div className="h-60"><ResponsiveContainer><LineChart data={popData} margin={{ left: -18, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="year" {...ax} /><YAxis {...ax} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />{vl.map((v) => <Line key={v.id} dataKey={`v${v.id}`} name={v.name} stroke={v.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />)}</LineChart></ResponsiveContainer></div></Card>
        <Card><SectionTitle right={<select value={gene} onChange={(e) => setGene(e.target.value as typeof gene)} className="rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-xs">{GENES.map((g) => <option key={g}>{g}</option>)}</select>}>Mean gene value per village</SectionTitle><div className="h-60"><ResponsiveContainer><LineChart data={geneData} margin={{ left: -18, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="year" {...ax} /><YAxis {...ax} domain={[0, 1]} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />{vl.map((v) => <Line key={v.id} dataKey={`v${v.id}`} name={v.name} stroke={v.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />)}</LineChart></ResponsiveContainer></div></Card>
        <Card><SectionTitle>Selection: who gets to have children?</SectionTitle>{!sel ? <p className="text-sm text-slate-500">Needs a few generations of data (at least 8 breeders and 8 non-breeders among the dead).</p> : <div className="h-56"><ResponsiveContainer><BarChart data={sel} margin={{ left: -18, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="gene" {...ax} /><YAxis {...ax} /><Tooltip {...tip} /><ReferenceLine y={0} stroke="#64748b" /><Bar dataKey="diff" name="Breeders minus non-breeders" fill="#8b5cf6" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>}<p className="mt-1 text-[11px] text-slate-600">Positive: the gene is more common in settlers who left children. This is measured from real lives, not assumed.</p></Card>
        <Card><SectionTitle>What kills settlers</SectionTitle><div className="h-56"><ResponsiveContainer><BarChart data={causes} margin={{ left: -18, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="cause" {...ax} /><YAxis {...ax} /><Tooltip {...tip} /><Bar dataKey="deaths" fill="#f87171" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <Card><SectionTitle>Village strategies (doctrine, inherited with mutation when a village splits)</SectionTitle><div className="overflow-auto"><table className="mono w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Village</th><th>People</th><th>Hunt</th><th>Farm</th><th>Build</th><th>Stock</th><th>Defend</th><th>Born</th><th>Died</th></tr></thead><tbody>{villages.map((v) => <tr key={v.id} className="border-t border-white/5" style={{ opacity: v.alive ? 1 : 0.45 }}><td className="py-1.5" style={{ color: v.color }}>{v.name}{v.parent >= 0 ? ` ← ${villages[v.parent]?.name}` : ''}</td><td>{v.pop}</td>{(['hunt', 'farm', 'build', 'stock', 'defend'] as const).map((k) => <td key={k}>{Math.round(v.doctrine[k] * 100)}</td>)}<td>{v.births}</td><td>{v.deaths}</td></tr>)}</tbody></table></div></Card>
    </div>
  );
}
