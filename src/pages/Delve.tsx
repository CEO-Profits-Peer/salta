import { useEffect, useState } from 'react';
import { Play } from './Play';
import { Lab } from './Lab';
import { Chronicle } from './Chronicle';
import { Arena } from './Arena';
import { useWorld } from '../app/worldStore';
import { cx } from '../components/ui';

const TABS = ['Play', 'Lab', 'Chronicle', 'Arena'] as const;
/** Descent, the AI-rebuilt labyrinth from v0.3, now a side mode. */
export function Delve() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Play'), init = useWorld((s) => s.init);
  useEffect(() => { void init(); }, [init]);
  return (
    <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Delve</h1><p className="text-sm text-slate-500">Descent: a fog-and-wardens labyrinth that the AI rebuilds every day (five versions, the popular one wins).</p></div>
      <div className="flex gap-2">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cx('rounded-lg border px-3 py-1.5 text-sm', tab === t ? 'border-acc/60 bg-acc/10 text-acc' : 'border-white/10 text-slate-400 hover:bg-white/5')}>{t}</button>)}</div>
      {tab === 'Play' && <Play />}{tab === 'Lab' && <Lab />}{tab === 'Chronicle' && <Chronicle />}{tab === 'Arena' && <Arena />}
    </div>
  );
}
