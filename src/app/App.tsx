import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Gamepad2, FlaskConical, ScrollText, Trophy, Wrench, Menu, Settings as Cog, X, type LucideIcon } from 'lucide-react';
import { PAGES, type PageId } from './hooks';
import { installVisibilityHandler, useStore } from './store';
import { useWorld } from './worldStore';
import { useSettings } from './settings';
import { cloudConfigured } from '../integrations/supabase/client';
import { useAuth } from '../integrations/supabase/auth';
import { Play } from '../pages/Play';
import { Lab } from '../pages/Lab';
import { Chronicle } from '../pages/Chronicle';
import { Arena } from '../pages/Arena';
import { Workshop } from '../pages/Workshop';
import { Settings } from '../pages/Settings';
import { Onboarding } from '../pages/Onboarding';
import { cx } from '../components/ui';

const NAV: Record<PageId, { label: string; icon: LucideIcon }> = {
  play: { label: 'Play', icon: Gamepad2 }, lab: { label: 'Lab', icon: FlaskConical }, chronicle: { label: 'Chronicle', icon: ScrollText },
  arena: { label: 'Arena', icon: Trophy }, workshop: { label: 'Workshop', icon: Wrench }, settings: { label: 'Settings', icon: Cog },
};
const parse = (): PageId => { const h = location.hash.replace(/^#\/?/, '') as PageId; return PAGES.includes(h) ? h : 'play'; };

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error(e, i); }
  render() { return this.state.err ? <div className="m-8 rounded-xl border border-bad/40 bg-bad/5 p-6"><div className="text-bad">Something went wrong on this page.</div><p className="mono mt-2 text-xs text-slate-400">{this.state.err.message}</p><button className="mt-3 text-sm underline" onClick={() => this.setState({ err: null })}>Try again</button></div> : this.props.children; }
}

export function App() {
  const [page, setPage] = useState<PageId>(parse), [create, setCreate] = useState(false), [menu, setMenu] = useState(false);
  const load = useStore((s) => s.load), initWorld = useWorld((s) => s.init), onboarded = useSettings((s) => s.onboarded), set = useSettings((s) => s.set), init = useAuth((s) => s.init);
  const [showOnb, setShowOnb] = useState(false);
  useEffect(() => { void initWorld(); void load().then(() => { if (!useSettings.getState().onboarded) setShowOnb(true); }); installVisibilityHandler(); init(); }, [load, init, initWorld]);
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
          <div className="mb-6 flex items-center gap-2 px-2"><span className="grid h-7 w-7 place-items-center rounded-full border border-acc/60"><span className="h-2 w-2 rounded-full bg-acc" /></span><span className="text-sm font-semibold tracking-wide">Descent<br /><span className="text-slate-500">AI Evolution Studios</span></span></div>
          {nav}
          <div className="mono mt-auto rounded-lg border border-white/[0.06] p-3 text-[11px] text-slate-500">{cloudConfigured ? 'Cloud: configured' : 'Local-demo mode'}<br />Training runs on this device.</div>
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink-950/90 px-4 py-3 backdrop-blur md:hidden">
          <span className="text-sm font-semibold">AI Evolution Studios</span><button onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
        </header>
        {menu && <div className="border-b border-white/10 bg-ink-950 p-3 md:hidden">{nav}</div>}
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
          <Boundary key={page}><motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {page === 'play' && <Play />}
            {page === 'lab' && <Lab />}
            {page === 'chronicle' && <Chronicle />}
            {page === 'arena' && <Arena />}
            {page === 'workshop' && <Workshop openCreate={create} />}
            {page === 'settings' && <Settings />}
          </motion.div></Boundary>
        </main>
      </div>
      {showOnb && !onboarded && <Onboarding done={() => { setShowOnb(false); set({ onboarded: true }); }} go={() => go('play')} />}
    </MotionConfig>
  );
}
