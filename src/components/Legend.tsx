import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { BUILDINGS, TECHS, type BType } from '../hearth/types';
import { GLYPH } from './HearthCanvas';
import { cx } from './ui';

const Dot = ({ c, r = 5, ring }: { c: string; r?: number; ring?: string }) => <span className="inline-block shrink-0 rounded-full align-middle" style={{ width: r * 2, height: r * 2, background: c, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />;
const Row = ({ icon, label, desc }: { icon: React.ReactNode; label: string; desc?: string }) => (<div className="flex items-start gap-2 py-0.5"><span className="mt-0.5 grid w-6 shrink-0 place-items-center">{icon}</span><div><span className="text-slate-200">{label}</span>{desc && <span className="block text-[11px] leading-snug text-slate-500">{desc}</span>}</div></div>);
function Sec({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [o, setO] = useState(open);
  return (<div className="border-t border-white/5"><button onClick={() => setO(!o)} className="flex w-full items-center justify-between py-1.5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}{o ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{o && <div className="pb-2 text-xs">{children}</div>}</div>);
}
const KEYS: Record<string, [string, string][]> = {
  Observe: [['Drag / arrows / WASD', 'pan'], ['Wheel / + −', 'zoom'], ['Click', 'inspect a settler or hearth'], ['1–5 / P', 'speed / pause'], ['Esc', 'menu']],
  Wanderer: [['WASD', 'move the Wanderer'], ['E', 'gather here'], ['F', 'feed or warm the nearest settler'], ['G', 'leave supplies at a hearth']],
  Settler: [['WASD / arrows', 'walk'], ['E', 'interact: drink, eat, gather, fish, plant, build, farm, craft'], ['Space', 'fight / hunt what is next to you'], ['G', 'deposit your load at the hearth'], ['F', 'give food to a hungry neighbour'], ['R', 'release your settler']],
};
/** Collapsible legend: symbols, buildings, inventions and controls. */
export function Legend({ mode }: { mode: 'observe' | 'wanderer' | 'settler' }) {
  const [open, setOpen] = useState(() => localStorage.getItem('aes-legend') === '1');
  const toggle = () => { setOpen(!open); localStorage.setItem('aes-legend', open ? '0' : '1'); };
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 w-[300px] max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-ink-950/90 text-xs backdrop-blur">
      <button onClick={toggle} className="flex w-full items-center justify-between px-3 py-2 text-slate-200" aria-expanded={open}><span className="flex items-center gap-2"><BookOpen size={14} className="text-acc" />Legend & controls</span>{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
      {open && (<div className="max-h-[52vh] overflow-auto px-3 pb-2">
        <Sec title="Terrain & resources" open>
          <Row icon={<span className="h-3 w-4 rounded-sm" style={{ background: '#0c2236' }} />} label="Water" desc="Drinkable at the shore. Blocks walking." /><Row icon={<span className="h-3 w-4 rounded-sm" style={{ background: '#18301f' }} />} label="Grass" desc="Berry bushes (red dot) regrow when left alone." />
          <Row icon={<span className="h-3 w-4 rounded-sm" style={{ background: '#0f2418' }} />} label="Forest" desc="Green trees = wood. Cut too much and it stays bare; trees only regrow next to other trees. Replant to speed it up." />
          <Row icon={<span className="h-3 w-4 rounded-sm" style={{ background: '#383d4a' }} />} label="Rock" desc="Stone is finite. Grey = exhausted." /><Row icon={<span className="h-3 w-4 rounded-sm" style={{ background: '#4a4331' }} />} label="Sand" desc="Poor land, good for building." />
          <Row icon={<span className="text-cyan-300">≈</span>} label="Fish (zoom in)" desc="Shore fish recover slowly. Overfishing empties them." /><Row icon={<span className="text-slate-500">†</span>} label="Grave" />
        </Sec>
        <Sec title="Creatures">
          <Row icon={<Dot c="#22d3ee" />} label="Settler" desc="Colour = village. Smaller dot = child. Red bar = hurt." /><Row icon={<Dot c="#22d3ee" ring="#a3e635" />} label="Fever" /><Row icon={<Dot c="#22d3ee" ring="#ef4444" />} label="Raider" desc="On a raid against another village." />
          <Row icon={<Dot c="#22d3ee" ring="#60a5fa" />} label="Defender" /><Row icon={<Dot c="#22d3ee" ring="#fbbf24" />} label="Trader" desc="Walking a caravan to another village." /><Row icon={<Dot c="#22d3ee" ring="#fb923c" />} label="Hunting party" desc="A group taking down a boar or bear." />
          <Row icon={<Dot c="#22d3ee" ring="#fff" />} label="You" desc="The settler you control." />
          <Row icon={<Dot c="#c9a66b" r={4} />} label="Deer" desc="Easy game. Overhunting empties the forest." /><Row icon={<Dot c="#e5e7eb" r={3} />} label="Rabbit" desc="Small, quick food." /><Row icon={<Dot c="#8b5e3c" r={5} />} label="Boar" desc="Dangerous when hurt. Needs a hunting party." />
          <Row icon={<Dot c="#2d2a2e" r={6} ring="#f87171" />} label="Bear" desc="Rare and deadly. Avoids palisades." /><Row icon={<span className="text-red-400">▲</span>} label="Wolf" desc="Hunts lone settlers. Groups scare it off." />
        </Sec>
        <Sec title="Buildings">{(Object.keys(BUILDINGS) as BType[]).map((t) => <Row key={t} icon={<span className="text-sm text-slate-200">{GLYPH[t]}</span>} label={`${BUILDINGS[t].name}${BUILDINGS[t].wood || BUILDINGS[t].stone ? ` · ${BUILDINGS[t].wood} wood${BUILDINGS[t].stone ? ` + ${BUILDINGS[t].stone} stone` : ''}` : ''}`} desc={BUILDINGS[t].desc} />)}</Sec>
        <Sec title="Inventions">{Object.entries(TECHS).map(([k, t]) => <Row key={k} icon={<span className="text-amb">✦</span>} label={t.name} desc={`${t.desc}${t.needs.length ? ` (needs ${t.needs.map((n) => TECHS[n].name).join(', ')})` : ''}`} />)}<p className="pt-1 text-[11px] text-slate-500">Villages invent on their own and learn from traders, loot and migrants.</p></Sec>
        <Sec title={`Controls: ${mode}`} open>{KEYS[mode[0].toUpperCase() + mode.slice(1)].map(([k, d]) => <div key={k} className="flex gap-2 py-0.5"><span className={cx('mono w-28 shrink-0 text-slate-200')}>{k}</span><span className="text-slate-500">{d}</span></div>)}</Sec>
      </div>)}
    </div>
  );
}
