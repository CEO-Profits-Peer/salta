import { useState } from 'react';
import { Check, Pencil, Play, Plus, Save, Trash2 } from 'lucide-react';
import { useHearth } from '../app/hearthStore';
import { YEAR } from '../hearth/types';
import { Btn, Card, SectionTitle, cx, inputCls } from './ui';

export function GameMenu({ go }: { go: (p: string) => void }) {
  const { menuOpen, openMenu, worlds, currentId, createWorld, switchWorld, deleteWorld, renameWorld, saveNow } = useHearth();
  const [name, setName] = useState(''), [edit, setEdit] = useState<string | null>(null), [text, setText] = useState(''), [del, setDel] = useState<string | null>(null), [saved, setSaved] = useState(false);
  if (!menuOpen) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Menu" onClick={() => openMenu(false)}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-[0_0_60px_rgba(34,211,238,.12)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Menu</h2><span className="mono text-xs text-slate-500">the world is paused</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Btn variant="primary" onClick={() => openMenu(false)}><Play size={15} />Resume</Btn><Btn onClick={async () => { await saveNow(); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>{saved ? <><Check size={15} />Saved</> : <><Save size={15} />Save now</>}</Btn></div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">{[['evolution', 'Evolution'], ['delve', 'Delve'], ['workshop', 'Workshop']].map(([p, l]) => <Btn key={p} className="!py-1.5 text-xs" onClick={() => { openMenu(false); go(p); }}>{l}</Btn>)}</div>
        <div className="mt-6"><SectionTitle>Worlds ({worlds.length})</SectionTitle>
          <div className="space-y-2">{worlds.map((w) => (
            <Card key={w.id} className={cx('p-3', w.id === currentId && 'border-acc/40')}>
              <div className="flex items-center justify-between gap-2">
                {edit === w.id ? <input autoFocus className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { void renameWorld(w.id, text); setEdit(null); } }} /> : <div><div className="text-sm">{w.name}{w.id === currentId && <span className="mono ml-2 text-[10px] text-acc">current</span>}</div><div className="mono text-[11px] text-slate-500">year {(w.tick / YEAR).toFixed(1)} · {w.pop} settlers · saved {new Date(w.savedAt).toLocaleString()}</div></div>}
                <div className="flex shrink-0 gap-1">{edit === w.id ? <Btn className="!px-2 !py-1" onClick={() => { void renameWorld(w.id, text); setEdit(null); }}><Check size={14} /></Btn> : <Btn className="!px-2 !py-1" title="Rename" onClick={() => { setEdit(w.id); setText(w.name); }}><Pencil size={14} /></Btn>}
                  {w.id !== currentId && <Btn className="!px-2 !py-1 text-xs" onClick={async () => { await switchWorld(w.id); openMenu(false); }}>Open</Btn>}{worlds.length > 1 && <Btn variant="danger" className="!px-2 !py-1" title="Delete" onClick={() => setDel(w.id)}><Trash2 size={14} /></Btn>}</div>
              </div>
              {del === w.id && <div className="mt-2 flex items-center gap-2 text-xs"><span className="flex-1 text-bad">Delete “{w.name}” forever?</span><Btn variant="danger" className="!py-1 text-xs" onClick={() => { void deleteWorld(w.id); setDel(null); }}>Delete</Btn><Btn className="!py-1 text-xs" onClick={() => setDel(null)}>Cancel</Btn></div>}
            </Card>))}</div>
          <div className="mt-3 flex gap-2"><input className={inputCls} placeholder="Name for a new world (optional)" value={name} onChange={(e) => setName(e.target.value)} /><Btn onClick={async () => { await createWorld(name); setName(''); openMenu(false); }}><Plus size={15} />New world</Btn></div>
          <p className="mt-2 text-[11px] text-slate-600">Each world has its own tribes, history and seed, and is saved in this browser. Shared multiplayer worlds are a later step.</p></div>
        <p className="mt-4 text-center text-[11px] text-slate-600">Press Esc to close</p>
      </div>
    </div>
  );
}
