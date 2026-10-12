import { useMemo } from 'react';
import { useStore, type ExpView } from './store';
export function useExpList(): ExpView[] { const e = useStore((s) => s.exps); return useMemo(() => Object.values(e).sort((a, b) => b.updatedAt - a.updatedAt), [e]); }
export function useLatest(): ExpView | null { const l = useExpList(); return l.find((v) => v.state) ?? l[0] ?? null; }
export const f2 = (n: number | undefined | null) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(2));
export const f3 = (n: number | undefined | null) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(3));
export const PAGES = ['overview', 'lab', 'tester', 'builder', 'instructor', 'experiments', 'library', 'challenges', 'leaderboards', 'settings'] as const;
export type PageId = (typeof PAGES)[number];
