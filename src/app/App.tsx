import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { BookOpen, FlaskConical, Gauge, Hammer, LayoutDashboard, Medal, Menu, Microscope, Settings as Cog, Swords, Trophy, X, type LucideIcon } from 'lucide-react';
import { PAGES, type PageId } from './hooks';
import { installVisibilityHandler, useStore } from './store';
import { useSettings } from './settings';
import { cloudConfigured } from '../integrations/supabase/client';
import { useAuth } from '../integrations/supabase/auth';
import { Overview } from '../pages/Overview';
import { Experiments } from '../pages/Experiments';
import { Laboratory } from '../pages/Laboratory';
import { ChamberPage } from '../pages/ChamberPage';
import { Library } from '../pages/Library';
import { Challenges, Leaderboards } from '../pages/Challenges';
import { Settings } from '../pages/Settings';
import { Onboarding } from '../pages/Onboarding';
import { cx } from '../components/ui';

const NAV: Record<PageId, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: LayoutDashboard }, lab: { label: 'My Laboratory', icon: FlaskConical }, tester: { label: 'Tester Chamber', icon: Microscope },
  builder: { label: 'Builder Chamber', icon: Hammer }, instructor: { label: 'Instructor Chamber', icon: Gauge }, experiments: { label: 'Experiments', icon: Swords },
  library: { label: 'Agent Library', icon: BookOpen }, challenges: { label: 'Challenges', icon: Trophy }, leaderboards: { label: 'Leaderboards', icon: Medal }, settings: { label: 'Settings', icon: Cog },
};
const parse = (): PageId => { const h = location.hash.replace(/^#\/?/, '') as PageId; return PAGES.includes(h) ? h : 'overview'; };

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error(e, i); }
  render() { return this.state.err ? <div className="m-8 rounded-xl border border-bad/40 bg-bad/5 p-6"><div className="text-bad">Something went wrong on this page.</div><p className="mono mt-2 text-xs text-slate-400">{this.state.err.message}</p><button className="mt-3 text-sm underline" onClick={() => this.setState({ err: null })}>Try again</button></div> : this.props.children; }
}

export function App() {
  const [page, setPage] = useState<PageId>(parse), [create, setCreate] = useState(false), [menu, setMenu] = useState(false);
  const load = useStore((s) => s.load), onboarded = useSettings((s) => s.onboarded), set = useSettings((s) => s.set), init = useAuth((s) => s.init);
  const [showOnb, setShowOnb] = useState(false);
  useEffect(() => { void load().then(() => { if (!useSettings.getState().onboarded) setShowOnb(true); }); installVisibilityHandler(); init(); }, [load, init]);
  useEffect(() => { const h = () => setPage(parse()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const go = (p: PageId, c = false) => { setCreate(c); location.hash = `/${p}`; setPage(p); setMenu(false); window.scrollTo(0, 0); };
  const nav = (
    <nav className="space-y-0.5" aria-label="Main">
      {PAGES.map((p) => { const I = NAV[p].icon; return (<button key={p} onClick={() => go(p)} aria-current={page === p ? 'page' : undefined} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition', page === p ? 'bg-acc/10 text-acc' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}><I size={16} />{NAV[p].label}</button>); })}
    </nav>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full md:grid md:grid-cols-[236px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/[0.06] bg-ink-950/70 p-4 backdrop-blur md:flex">
          <div className="mb-6 flex items-center gap-2 px-2"><span className="grid h-7 w-7 place-items-center rounded-full border border-acc/60"><span className="h-2 w-2 rounded-full bg-acc" /></span><span className="text-sm font-semibold tracking-wide">AI Evolution<br /><span className="text-slate-500">Studios</span></span></div>
          {nav}
          <div className="mono mt-auto rounded-lg border border-white/[0.06] p-3 text-[11px] text-slate-500">{cloudConfigured ? 'Cloud: configured' : 'Local-demo mode'}<br />Training runs on this device.</div>
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink-950/90 px-4 py-3 backdrop-blur md:hidden">
          <span className="text-sm font-semibold">AI Evolution Studios</span><button onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
        </header>
        {menu && <div className="border-b border-white/10 bg-ink-950 p-3 md:hidden">{nav}</div>}
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
          <Boundary key={page}><motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {page === 'overview' && <Overview go={go} />}
            {page === 'lab' && <Laboratory />}
            {(page === 'tester' || page === 'builder' || page === 'instructor') && <ChamberPage type={page} />}
            {page === 'experiments' && <Experiments openCreate={create} />}
            {page === 'library' && <Library />}
            {page === 'challenges' && <Challenges />}
            {page === 'leaderboards' && <Leaderboards />}
            {page === 'settings' && <Settings />}
          </motion.div></Boundary>
        </main>
      </div>
      {showOnb && !onboarded && <Onboarding done={() => { setShowOnb(false); set({ onboarded: true }); }} go={() => go('experiments')} />}
    </MotionConfig>
  );
}
