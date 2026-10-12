import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ExpStatus } from '../engine/scheduling/scheduler';
export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('rounded-xl border border-white/[0.07] bg-ink-800/70 p-5 backdrop-blur', className)}>{children}</div>
);
export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{children}</h3>{right}</div>
);
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <Card className="p-4"><div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mono mt-1 text-2xl font-semibold text-slate-100">{value}</div>{hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}</Card>
);
type V = 'primary' | 'ghost' | 'danger';
export function Btn({ variant = 'ghost', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V }) {
  const v = { primary: 'bg-acc text-ink-950 hover:bg-cyan-300 font-semibold shadow-[0_0_20px_rgba(34,211,238,.25)]', ghost: 'border border-white/10 text-slate-200 hover:bg-white/5', danger: 'border border-bad/40 text-bad hover:bg-bad/10' }[variant];
  return <button {...p} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40', v, className)} />;
}
export const Empty = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center"><div className="text-slate-200">{title}</div><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>{action && <div className="mt-4">{action}</div>}</div>
);
const tone: Record<ExpStatus, string> = { draft: 'text-slate-400', queued: 'text-amb', running: 'text-acc', pausing: 'text-amb', paused: 'text-amb', stopping: 'text-amb', completed: 'text-ok', failed: 'text-bad', cancelled: 'text-slate-500' };
export const StatusBadge = ({ status }: { status: ExpStatus }) => (
  <span className={cx('mono inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] uppercase tracking-wider', tone[status])}>
    <span className={cx('h-1.5 w-1.5 rounded-full bg-current', status === 'running' && 'pulse-dot')} />{status}
  </span>
);
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (<label className="block text-xs text-slate-400"><span className="mb-1 block">{label}</span>{children}</label>);
export const inputCls = 'w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-acc/60';
export const CH = { tester: { label: 'Tester Chamber', color: '#22d3ee', blurb: 'Hunts for defects. Scored for precision, not volume.' }, builder: { label: 'Builder Chamber', color: '#8b5cf6', blurb: 'Proposes constrained maze edits as candidate versions.' }, instructor: { label: 'Instructor Chamber', color: '#f5b84b', blurb: 'Deterministic rules, held-out tests, promotion decisions.' } } as const;
export type ChamberType = keyof typeof CH;
