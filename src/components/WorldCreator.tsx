import { useState } from 'react';
import { Copy, Dices, X } from 'lucide-react';
import { useHearth } from '../app/hearthStore';
import { DEFAULT_SETTINGS, PRESETS, SETTING_LIMITS, cleanSettings, decodeWorld, encodeWorld, type WorldSettings } from '../hearth/types';
import { Btn, Field, cx, inputCls } from './ui';

const LABEL: Record<keyof typeof SETTING_LIMITS, [string, string]> = {
  villages: ['Tribes', 'How many tribes start (2–6)'], settlers: ['Tribe size', 'Settlers per tribe at the start'], water: ['Water', 'Share of the map covered by water: islands vs. continents'], resources: ['Resources', 'Trees, berries, fish and stone'],
  wolves: ['Wolves', 'Predator pressure on lone settlers'], bears: ['Bears', 'Rare, deadly forest predators'], winter: ['Winter severity', 'How hard the cold hits'], mutation: ['Mutation', 'How fast genes and traits drift (great for videos)'], aggression: ['Aggression', 'How quick the tribes are to quarrel and raid'],
};
export function WorldCreator({ onClose }: { onClose: () => void }) {
  const createWorld = useHearth((s) => s.createWorld), [s, setS] = useState<WorldSettings>({ ...DEFAULT_SETTINGS }), [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6)), [preset, setPreset] = useState('default'), [code, setCode] = useState(''), [msg, setMsg] = useState('');
  const set = (p: Partial<WorldSettings>) => { setS(cleanSettings({ ...s, ...p })); setPreset(''); };
  const share = encodeWorld(seed, s);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create a world" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/10 bg-ink-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Create a world</h2><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <p className="mt-1 text-sm text-slate-500">Pick a preset or tune every dial. The same seed and settings always produce the same map, so creators can share worlds with a code.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{PRESETS.map((p) => <button key={p.id} onClick={() => { setS(cleanSettings(p.s)); setPreset(p.id); }} className={cx('rounded-lg border p-2 text-left', preset === p.id ? 'border-acc/60 bg-acc/10' : 'border-white/10 hover:bg-white/5')}><div className="text-sm">{p.name}</div><div className="text-[11px] text-slate-500">{p.desc}</div></button>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="World name"><input className={inputCls} value={s.name} maxLength={40} placeholder="optional" onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Seed"><div className="flex gap-2"><input type="number" className={inputCls} value={seed} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value)) || 0))} /><Btn className="!px-3" title="Random seed" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}><Dices size={15} /></Btn></div></Field></div>
        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">{(Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]).map((k) => { const [lo, hi, step] = SETTING_LIMITS[k]; return <label key={k} className="block text-xs text-slate-400" title={LABEL[k][1]}><span className="flex justify-between"><span>{LABEL[k][0]}</span><span className="mono text-slate-200">{s[k]}</span></span><input type="range" min={lo} max={hi} step={step} value={s[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="w-full accent-cyan-400" /><span className="text-[10px] text-slate-600">{LABEL[k][1]}</span></label>; })}</div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300"><label className="flex items-center gap-2"><input type="checkbox" className="accent-cyan-400" checked={s.sameDoctrine} onChange={(e) => set({ sameDoctrine: e.target.checked })} />All tribes start with the same strategy</label>
          <label className="flex items-center gap-2">Starting inventions<select className="rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-xs" value={s.techStart} onChange={(e) => set({ techStart: Number(e.target.value) as 0 | 1 | 2 })}><option value={0}>none</option><option value={1}>a few</option><option value={2}>tools, curing, tally marks</option></select></label></div>
        <div className="mt-4 rounded-lg border border-white/10 p-3"><div className="text-[11px] uppercase tracking-widest text-slate-500">Share code</div><div className="mt-1 flex gap-2"><input readOnly className={cx(inputCls, 'mono text-[11px]')} value={share} onFocus={(e) => e.target.select()} /><Btn className="!px-3" onClick={() => { void navigator.clipboard?.writeText(share); setMsg('Copied!'); setTimeout(() => setMsg(''), 1500); }}><Copy size={14} /></Btn></div>
          <div className="mt-2 flex gap-2"><input className={cx(inputCls, 'mono text-[11px]')} placeholder="Paste a code from someone else (HW1-…)" value={code} onChange={(e) => setCode(e.target.value)} /><Btn onClick={() => { const d = decodeWorld(code); if (!d) { setMsg('That code is not valid.'); return; } setSeed(d.seed); setS(d.settings); setPreset(''); setCode(''); setMsg('Loaded!'); }}>Load</Btn></div>{msg && <p className="mt-1 text-xs text-acc">{msg}</p>}</div>
        <div className="mt-5 flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={async () => { await createWorld({ seed, settings: s, name: s.name }); onClose(); }}>Create & enter</Btn></div>
      </div>
    </div>
  );
}
