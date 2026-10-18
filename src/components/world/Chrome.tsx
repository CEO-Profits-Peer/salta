import { BookOpen, Crown, Flag, Landmark, Lightbulb, Menu as MenuIcon, Minus, Pause, Plus, ScrollText, Users, X } from 'lucide-react';
import { useHearth } from '../../app/hearthStore';
import { useUi, type PanelId } from '../../app/uiStore';
import type { Snapshot } from '../../hearth/api';
import { GENES, YEAR, DAY, BUILDINGS, type BaseBType } from '../../hearth/types';
import { Btn, cx } from '../ui';
import { centerOn, zoomAt } from '../HearthCanvas';
import { computeAdvice } from './advisor';
import { Bar, GENE_HELP, JOB, Label, SEASONS, SPEEDS, focusVillage, isAllied, relBetween, relWord } from './shared';
import { Sparkles } from 'lucide-react';

export const PANELS: { id: PanelId; label: string; key: string; icon: typeof Landmark }[] = [
  { id: 'village', label: 'Village', key: 'V', icon: Landmark }, { id: 'chief', label: 'Chieftain', key: 'C', icon: Crown }, { id: 'people', label: 'People', key: 'O', icon: Users }, { id: 'diplomacy', label: 'Diplomacy', key: 'B', icon: Flag },
  { id: 'inventions', label: 'Inventions', key: 'I', icon: Lightbulb }, { id: 'events', label: 'Events', key: 'E', icon: ScrollText }, { id: 'codex', label: 'Codex', key: 'L', icon: BookOpen },
];
export function Rail({ alert }: { alert: boolean }) {
  const { panel, toggle } = useUi();
  return (
    <nav aria-label="Panels" className="absolute bottom-3 left-2 top-14 z-20 flex w-11 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-ink-950/85 py-2 backdrop-blur">
      {PANELS.map((p) => { const I = p.icon; return <button key={p.id} onClick={() => toggle(p.id)} aria-label={p.label} aria-pressed={panel === p.id} title={`${p.label} (${p.key})`} className={cx('relative grid h-9 w-9 place-items-center rounded-lg transition', panel === p.id ? 'bg-acc/15 text-acc' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}><I size={17} />{p.id === 'village' && alert && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bad" />}</button>; })}
    </nav>
  );
}

export function Drawer({ title, children }: { title: string; children: React.ReactNode }) {
  const setPanel = useUi((s) => s.setPanel);
  return (
    <section aria-label={title} className="absolute bottom-3 left-14 top-14 z-20 flex w-[min(390px,calc(100%-4.5rem))] flex-col rounded-xl border border-white/10 bg-ink-950/92 backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/5 px-3 py-2"><h2 className="text-sm font-semibold">{title}</h2><button onClick={() => setPanel(null)} aria-label="Close panel" className="text-slate-500 hover:text-slate-200"><X size={15} /></button></header>
      <div className="flex-1 overflow-auto p-3" style={{ overscrollBehavior: 'contain' }}>{children}</div>
    </section>
  );
}

export function HudBar({ snap, onMenu }: { snap: Snapshot; onMenu: () => void }) {
  const { speed, setSpeed, selected } = useHearth(), { focus, open } = useUi(), v = focusVillage(snap, focus, selected?.kind === 'village' ? selected.id : null), advice = computeAdvice(snap);
  const t = snap.tick, year = Math.floor(t / YEAR) + 1, season = SEASONS[Math.floor((t % YEAR) / (DAY * 8))], day = Math.floor((t % (DAY * 8)) / DAY) + 1, hour = Math.floor(((t % DAY) / DAY) * 24);
  const chip = (icon: string, val: number | string, label: string, bad = false) => <span key={label} title={label} className={cx('mono inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px]', bad ? 'text-bad' : 'text-slate-200')}>{icon}{val}</span>;
  return (
    <div className="absolute inset-x-2 top-2 z-30 flex flex-wrap items-start justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-ink-950/85 px-2.5 py-1.5 backdrop-blur">
        <span className="mono text-xs text-slate-200">Y{year} · {season} · d{day} · {String(hour).padStart(2, '0')}:00</span>
        <span className="flex items-center gap-1">{SPEEDS.map((s) => <button key={s} onClick={() => setSpeed(s)} aria-label={s === 0 ? 'Pause' : `${s}x speed`} className={cx('grid h-6 min-w-[1.6rem] place-items-center rounded px-1 text-[11px]', speed === s ? 'bg-acc text-ink-950' : 'text-slate-400 hover:bg-white/5')}>{s === 0 ? <Pause size={12} /> : `${s}×`}</button>)}</span>
        <span className="flex items-center gap-1"><button className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white/5" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2)}><Minus size={12} /></button><button className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white/5" aria-label="Zoom in" onClick={() => zoomAt(1.2)}><Plus size={12} /></button></span>
        <button onClick={onMenu} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-slate-300 hover:bg-white/5" aria-label="Menu"><MenuIcon size={13} />Menu</button>
      </div>
      {v && <button onClick={() => open('village', v.id)} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-ink-950/85 px-2.5 py-1.5 text-left backdrop-blur" aria-label={`Open ${v.name}`}>
        <span className="text-xs font-semibold" style={{ color: v.color }}>{v.name}{snap.chief === v.id ? ' ♛' : ''}</span>{chip('🍖', v.stock.food, 'Food', v.stock.food < Math.max(3, 0.5 * v.pop))}{chip('🪵', v.stock.wood, 'Wood')}{chip('🪨', v.stock.stone, 'Stone')}{chip('⚒', v.stock.tools, 'Tools')}{chip('🗡', v.stock.spears, 'Spears')}{chip('👥', `${v.pop}/${v.capacity}`, 'People / housing', v.pop >= v.capacity)}{chip('♛', v.prosperity, 'Prosperity')}</button>}
      {advice.length > 0 && <div className="flex max-w-full flex-wrap gap-1.5" aria-label="Advisor">{advice.slice(0, 3).map((a) => <button key={a.id} onClick={() => { open(a.panel, a.village); const t = snap.villages[a.village]; if (t) centerOn(t.hx, t.hy); }} className={cx('max-w-[260px] truncate rounded-lg border px-2 py-1 text-[11px] backdrop-blur', a.level === 'alert' ? 'border-bad/50 bg-bad/15 text-red-200' : a.level === 'warn' ? 'border-amb/40 bg-amb/10 text-amber-200' : 'border-white/10 bg-ink-950/85 text-slate-300')} title={a.text}>{a.text}</button>)}{advice.length > 3 && <span className="self-center text-[10px] text-slate-500">+{advice.length - 3} more</span>}</div>}
    </div>
  );
}

export function InspectorCard({ snap }: { snap: Snapshot }) {
  const { selected, select, bio, cmd, playAs, follow, setFollow, mode } = useHearth(), open = useUi((s) => s.open);
  const sel = selected?.kind === 'settler' ? snap.settlers.find((s) => s.id === selected.id) : null, vil = selected?.kind === 'village' ? snap.villages.find((v) => v.id === selected.id) : null; if (!sel && !vil) return null;
  const vname = (id: number) => snap.villages[id]?.name ?? '?';
  return (
    <aside aria-label="Inspector" className="absolute right-2 top-16 z-20 w-[min(300px,calc(100%-1rem))] rounded-xl border border-white/10 bg-ink-950/92 p-3 backdrop-blur sm:top-20" style={{ maxHeight: 'calc(100% - 13rem)', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <button className="absolute right-2 top-2 text-slate-500 hover:text-slate-200" aria-label="Close inspector" onClick={() => select(null)}><X size={14} /></button>
      {sel && (<div className="space-y-1.5">
        <div className="flex items-baseline justify-between pr-5"><span className="text-base font-semibold">{sel.name}</span><span className="mono text-[11px] text-slate-500">{vname(sel.v)} · {(sel.age / YEAR).toFixed(1)}y{sel.age < 2 * YEAR ? ' · child' : ''}</span></div>
        <div className="mono text-[11px] text-slate-500">{JOB[sel.job] ?? sel.job}{sel.role ? ` · ${sel.role}` : ''}{sel.armed ? ' · armed' : ''}{sel.party ? ' · hunting party' : ''}{sel.ctl ? ' · you' : ''}</div>
        <p className="rounded-lg bg-white/[0.03] p-2 text-xs text-slate-300"><Sparkles size={12} className="mr-1 inline text-acc" />{sel.thought}</p>
        <div className="space-y-1"><Bar label="Health" v={sel.health} color="#34d399" /><Bar label="Hunger" v={sel.hunger} color="#f5b84b" /><Bar label="Thirst" v={sel.thirst} color="#22d3ee" /><Bar label="Cold" v={sel.cold} color="#93c5fd" /></div>
        {sel.quirks.length > 0 && <div className="text-[11px] text-vio">Traits: {sel.quirks.map((q) => snap.mods.quirks.find((m) => m.id === q)?.name ?? q).join(', ')}</div>}
        <div className="mono text-[11px] text-slate-500">carrying {sel.carry.food} food · {sel.carry.wood} wood · {sel.carry.stone} stone{sel.carry.tools ? ` · ${sel.carry.tools} tools` : ''} · {sel.kids} children{sel.sick ? ' · feverish' : ''}</div>
        <div className="flex flex-wrap gap-1.5"><Btn className="!py-1 text-[11px]" disabled={sel.age < 2 * YEAR || mode === 'settler'} onClick={() => playAs(sel.id)}>Play as {sel.name}</Btn><Btn className="!py-1 text-[11px]" onClick={() => setFollow(!follow)}>{follow ? 'Unfollow' : 'Follow'}</Btn></div>
        <Label>Genes (inherited, mutate)</Label><div className="space-y-1">{GENES.map((g) => <Bar key={g} label={g} v={sel.genes[g]} color="#8b5cf6" hint={GENE_HELP[g]} />)}</div>
        {sel.parents[0] >= 0 && <p className="text-[11px] text-slate-500">Parents: {snap.settlers.find((p) => p.id === sel.parents[0])?.name ?? `#${sel.parents[0]} (gone)`} & {snap.settlers.find((p) => p.id === sel.parents[1])?.name ?? `#${sel.parents[1]} (gone)`}</p>}
        {bio && bio.id === sel.id && <div className="max-h-32 space-y-1 overflow-auto border-t border-white/5 pt-2 text-[11px] text-slate-400">{bio.lines.map((l, i) => <div key={i}>{l}</div>)}</div>}</div>)}
      {vil && (<div className="space-y-1.5"><div className="flex items-baseline justify-between pr-5"><span className="text-base font-semibold" style={{ color: vil.color }}>{vil.name}</span><span className="mono text-[11px] text-slate-500">{vil.alive ? `${vil.tier} · ${vil.pop} people` : 'ruins'}</span></div>
        <div className="mono text-[11px] text-slate-400">🍖{vil.stock.food} 🪵{vil.stock.wood} 🪨{vil.stock.stone}{vil.stock.tools ? ` ⚒${vil.stock.tools}` : ''}{vil.fire ? ' · hearth burning' : ''}</div>
        {vil.alive && <div className="flex flex-wrap gap-1.5"><Btn className="!py-1 text-[11px]" onClick={() => open('village', vil.id)}>Village details</Btn><Btn className="!py-1 text-[11px]" onClick={() => { cmd({ k: 'chief', v: vil.id }); open('chief', vil.id); }}>{snap.chief === vil.id ? 'You lead this village' : 'Lead (Chieftain)'}</Btn></div>}
        {snap.chief >= 0 && snap.chief !== vil.id && vil.alive && <div className="text-[11px] text-slate-500">To {snap.villages[snap.chief].name}: <span className={relWord(relBetween(snap, snap.chief, vil.id))[1]}>{isAllied(snap, snap.chief, vil.id) ? 'allied' : relWord(relBetween(snap, snap.chief, vil.id))[0]}</span></div>}</div>)}
    </aside>
  );
}
export { BUILDINGS };
export type { BaseBType };
