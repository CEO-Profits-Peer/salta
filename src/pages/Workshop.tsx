import { useState } from 'react';
import { Experiments } from './Experiments';
import { Laboratory } from './Laboratory';
import { ChamberPage } from './ChamberPage';
import { Library } from './Library';
import { cx, type ChamberType } from '../components/ui';

const TABS = ['Maze experiments', 'Maze playground', 'Chambers', 'Agent library'] as const;
export function Workshop({ openCreate }: { openCreate: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Maze experiments'), [ch, setCh] = useState<ChamberType>('tester');
  return (
    <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Workshop</h1><p className="text-sm text-slate-500">Your private lab: run classic evolutionary maze experiments with full control over populations, seeds and checkpoints.</p></div>
      <div className="flex flex-wrap gap-2">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cx('rounded-lg border px-3 py-1.5 text-sm', tab === t ? 'border-acc/60 bg-acc/10 text-acc' : 'border-white/10 text-slate-400 hover:bg-white/5')}>{t}</button>)}</div>
      {tab === 'Maze experiments' && <Experiments openCreate={openCreate} />}{tab === 'Maze playground' && <Laboratory />}
      {tab === 'Chambers' && <div className="space-y-4"><div className="flex gap-2">{(['tester', 'builder', 'instructor'] as ChamberType[]).map((c) => <button key={c} onClick={() => setCh(c)} className={cx('rounded-lg border px-3 py-1 text-xs capitalize', ch === c ? 'border-acc/60 text-acc' : 'border-white/10 text-slate-400')}>{c}</button>)}</div><ChamberPage type={ch} /></div>}
      {tab === 'Agent library' && <Library />}
    </div>
  );
}
