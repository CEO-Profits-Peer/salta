import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GenMetrics } from '../features/experiments/experiment';
import { Empty } from './ui';

const tip = { contentStyle: { background: '#0a0d13', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }, labelFormatter: (g: number) => `Generation ${g}` };
const axis = { stroke: '#4b5568', fontSize: 11, tickLine: false } as const;
export function MetricsChart({ history, lines, domain }: { history: GenMetrics[]; lines: { key: keyof GenMetrics; name: string; color: string }[]; domain?: [number, number] }) {
  if (history.length < 1) return <Empty title="No data yet" body="Metrics appear here after the first completed generation." />;
  return (
    <div className="h-56"><ResponsiveContainer>
      <LineChart data={history} margin={{ left: -18, right: 8, top: 6 }}>
        <CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="generation" {...axis} /><YAxis {...axis} domain={domain ?? ['auto', 'auto']} />
        <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
        {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer></div>
  );
}
export function GenTimeChart({ ms }: { ms: number[] }) {
  if (!ms.length) return <Empty title="No timing data" body="Generation durations are measured inside the worker while an experiment runs." />;
  const data = ms.map((v, i) => ({ generation: i + 1, ms: Math.round(v) }));
  return (
    <div className="h-44"><ResponsiveContainer>
      <BarChart data={data} margin={{ left: -10, right: 8 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="generation" {...axis} /><YAxis {...axis} unit="ms" />
        <Tooltip {...tip} /><Bar dataKey="ms" name="Duration" fill="#8b5cf6" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart>
    </ResponsiveContainer></div>
  );
}
