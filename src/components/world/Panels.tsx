import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, Search } from 'lucide-react';
import { useHearth } from '../../app/hearthStore';
import { useUi } from '../../app/uiStore';
import type { Snapshot, SVillage } from '../../hearth/api';
import { BUILDINGS, TECHS, YEAR, type BaseBType, type TechId } from '../../hearth/types';
import { Btn, cx } from '../ui';
import { centerOn } from '../HearthCanvas';
import { Bar, EV_COL, HIGHLIGHT, JOB, JOB_GROUP, Label, focusVillage, isAllied, relBetween, relWord } from './shared';

const sel = 'w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-xs';
const tip = { contentStyle: { background: '#0a0d13', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11 } };
function useFocus(snap: Snapshot) { const { focus, setFocus } = useUi(), selected = useHearth((s) => s.selected), v = focusVillage(snap, focus, selected?.kind === 'village' ? selected.id : null); return { v, setFocus }; }
const Stock = ({ icon, label, v, warn }: { icon: string; label: string; v: number; warn?: boolean }) => <div className="rounded-lg border border-white/5 px-2 py-1.5 text-center" title={label}><div className="text-sm">{icon}</div><div className={cx('mono text-sm', warn ? 'text-bad' : 'text-slate-100')}>{v}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div></div>;

export function VillagePanel({ snap }: { snap: Snapshot }) {
  const { v, setFocus } = useFocus(snap), { select, cmd, stats } = useHearth(), open = useUi((s) => s.open);
  const alive = snap.villages.filter((x) => x.alive);
  const data = useMemo(() => (v ? stats.slice(-60).filter((_, i) => i % 2 === 0).map((d) => ({ day: d.day, pop: d.byV[v.id]?.pop ?? null, food: d.byV[v.id]?.food ?? null })) : []), [stats, v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return <p className="text-sm text-slate-500">No living villages.</p>;
  const mem = snap.settlers.filter((s) => s.v === v.id), kids = mem.filter((s) => s.age < 2 * YEAR).length, elders = mem.filter((s) => s.age >= 6 * YEAR).length, adults = mem.length - kids - elders, health = mem.length ? mem.reduce((a, s) => a + s.health, 0) / mem.length : 0;
  const groups = new Map<string, [number, string]>(); for (const s of mem.filter((x) => x.age >= 2 * YEAR)) { const [g, c] = JOB_GROUP[s.job] ?? ['Other', '#64748b']; groups.set(g, [(groups.get(g)?.[0] ?? 0) + 1, c]); }
  const total = Math.max(1, adults + elders), rank = [...alive].sort((a, b) => b.prosperity - a.prosperity).findIndex((x) => x.id === v.id) + 1;
  return (
    <div className="space-y-2">
      <select className={sel} value={v.id} onChange={(e) => { setFocus(Number(e.target.value)); const t = snap.villages[Number(e.target.value)]; if (t) centerOn(t.hx, t.hy); }}>{alive.map((x) => <option key={x.id} value={x.id}>{x.name}{snap.chief === x.id ? ' (yours)' : ''}</option>)}</select>
      <div className="flex items-end justify-between"><div><div className="text-lg font-semibold" style={{ color: v.color }}>{v.name}</div><div className="mono text-[11px] text-slate-500">{v.tier} · {v.pop}/{v.capacity} housed · rank {rank}/{alive.length}</div></div><div className="text-right"><div className="mono text-2xl">{v.prosperity}</div><div className="text-[9px] uppercase tracking-widest text-slate-600">prosperity</div></div></div>
      {snap.chief !== v.id && <Btn className="!py-1 text-xs" onClick={() => { cmd({ k: 'chief', v: v.id }); open('chief', v.id); }}>Lead this village (Chieftain)</Btn>}
      <div className="grid grid-cols-5 gap-1.5"><Stock icon="🍖" label="Food" v={v.stock.food} warn={v.stock.food < Math.max(3, 0.5 * v.pop)} /><Stock icon="🪵" label="Wood" v={v.stock.wood} /><Stock icon="🪨" label="Stone" v={v.stock.stone} /><Stock icon="⚒" label="Tools" v={v.stock.tools} /><Stock icon="🗡" label="Spears" v={v.stock.spears} /></div>
      <Label>People</Label>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5" title="children / adults / elders"><div style={{ width: `${(kids / Math.max(1, mem.length)) * 100}%`, background: '#22d3ee' }} /><div style={{ width: `${(adults / Math.max(1, mem.length)) * 100}%`, background: '#8b5cf6' }} /><div style={{ width: `${(elders / Math.max(1, mem.length)) * 100}%`, background: '#f5b84b' }} /></div>
      <div className="mono text-[10px] text-slate-500">{kids} children · {adults} adults · {elders} elders · average health {Math.round(health * 100)}%</div>
      <Label>What the adults are doing</Label>
      <div className="space-y-1">{[...groups.entries()].map(([g, [n, c]]) => <Bar key={g} label={g} v={n / total} color={c} w="86px" />)}</div>
      {data.length > 2 && <><Label>Last weeks</Label><div className="h-24"><ResponsiveContainer><LineChart data={data} margin={{ left: -24, right: 4, top: 4 }}><CartesianGrid stroke="rgba(255,255,255,.05)" /><XAxis dataKey="day" stroke="#4b5568" fontSize={9} /><YAxis stroke="#4b5568" fontSize={9} /><Tooltip {...tip} /><Line dataKey="pop" name="People" stroke="#8b5cf6" dot={false} strokeWidth={2} isAnimationActive={false} /><Line dataKey="food" name="Food" stroke="#f5b84b" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></>}
      <Label>Nearby resources (14 tiles)</Label><Bar label="Forest" v={v.outlook.wood} color="#34d399" hint="Share of wood still standing" /><Bar label="Berries" v={v.outlook.berry} color="#e0526a" /><Bar label="Fish" v={v.outlook.fish} color="#67e8f9" /><Bar label="Game" v={v.outlook.game} color="#c9a66b" /><Bar label="Stone" v={v.outlook.stone} color="#94a3b8" hint="Stone is finite" />
      <Label>Buildings</Label><div className="space-y-1">{(Object.keys(BUILDINGS) as BaseBType[]).filter((t) => v.buildings.some((b) => b.type === t)).map((t) => <div key={t} className="text-[11px] text-slate-300" title={BUILDINGS[t].desc}><b>{v.buildings.filter((b) => b.type === t && b.built).length}× {BUILDINGS[t].name}</b>{v.buildings.some((b) => b.type === t && !b.built) ? <span className="text-amb"> (+1 under construction)</span> : null}<div className="text-[10px] leading-snug text-slate-600">{BUILDINGS[t].desc}</div></div>)}{v.buildings.filter((b) => b.type.startsWith('m:')).map((b, i) => <div key={i} className="text-[11px] text-violet-300">✦ {snap.mods.buildings.find((m) => 'm:' + m.id === b.type)?.name ?? b.type}{b.built ? '' : ' (building)'}</div>)}</div>
      <Label>Inventions ({v.techs.length}/{Object.keys(TECHS).length})</Label><div className="flex flex-wrap gap-1">{v.techs.map((t) => <span key={t} title={TECHS[t].desc} className="rounded-full border border-amb/30 px-2 py-0.5 text-[10px] text-amb">{TECHS[t].name}</span>)}{!v.techs.length && <span className="text-[11px] text-slate-600">none yet</span>}</div><button className="text-[11px] text-slate-400 underline-offset-4 hover:underline" onClick={() => open('inventions', v.id)}>Open the invention tree →</button>
      <Label>Relations</Label><div className="space-y-0.5 text-[11px]">{alive.filter((o) => o.id !== v.id).map((o) => { const r = relBetween(snap, v.id, o.id), [w, c] = relWord(r); return <div key={o.id} className="flex justify-between"><button style={{ color: o.color }} onClick={() => { select({ kind: 'village', id: o.id }); centerOn(o.hx, o.hy); }}>{o.name}</button><span className={c}>{isAllied(snap, v.id, o.id) ? 'ALLIED' : w} ({Math.round(r * 100)})</span></div>; })}</div>
      <Label>Strategy (doctrine)</Label>{(Object.keys(v.doctrine) as (keyof typeof v.doctrine)[]).map((k) => <Bar key={k} label={k} v={v.doctrine[k]} color={v.color} />)}
      <div className="mono text-[10px] text-slate-600">{v.births} born · {v.deaths} died · peak {v.peak}{v.parent >= 0 ? ` · split from ${snap.villages[v.parent]?.name}` : ''}</div>
    </div>
  );
}

export function PeoplePanel({ snap }: { snap: Snapshot }) {
  const { select } = useHearth(), [q, setQ] = useState(''), [vf, setVf] = useState(-1), [sort, setSort] = useState<'name' | 'age' | 'health' | 'job'>('name');
  const list = useMemo(() => snap.settlers.filter((s) => (vf < 0 || s.v === vf) && (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.job.includes(q.toLowerCase()) || s.role.includes(q.toLowerCase()))).sort((a, b) => sort === 'age' ? b.age - a.age : sort === 'health' ? a.health - b.health : sort === 'job' ? a.job.localeCompare(b.job) : a.v - b.v || a.name.localeCompare(b.name)), [snap.settlers, q, vf, sort]);
  return (
    <div className="space-y-2"><div className="relative"><Search size={13} className="absolute left-2 top-2 text-slate-500" /><input className={cx(sel, 'pl-7')} placeholder="Search by name, job or role" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2"><select className={sel} value={vf} onChange={(e) => setVf(Number(e.target.value))}><option value={-1}>All villages</option>{snap.villages.filter((v) => v.alive).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select><select className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="name">Sort: village, name</option><option value="age">Sort: oldest first</option><option value="health">Sort: most hurt first</option><option value="job">Sort: job</option></select></div>
      <div className="mono text-[10px] text-slate-600">{list.length} settlers</div>
      <div className="space-y-0.5">{list.slice(0, 150).map((s) => <button key={s.id} onClick={() => { select({ kind: 'settler', id: s.id }); centerOn(s.x, s.y); }} className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-white/5"><span className="flex min-w-0 items-center gap-2"><span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: snap.villages[s.v]?.color }} /><span className="truncate">{s.name}{s.ctl ? ' (you)' : ''}</span>{s.role && <span className="rounded bg-white/5 px-1 text-[9px] text-slate-400">{s.role}</span>}</span><span className="mono shrink-0 text-[10px] text-slate-500">{(s.age / YEAR).toFixed(0)}y · {JOB[s.job]}{s.health < 0.5 ? ' · hurt' : ''}</span></button>)}{list.length > 150 && <p className="text-[10px] text-slate-600">Showing the first 150. Use search to narrow down.</p>}</div></div>
  );
}

export function DiplomacyPanel({ snap }: { snap: Snapshot }) {
  const open = useUi((s) => s.open), alive = snap.villages.filter((v) => v.alive), caravans = snap.settlers.filter((s) => s.job === 'trade').length, raiders = snap.settlers.filter((s) => s.job === 'raid').length;
  const pairs = [...snap.rel].sort((a, b) => a[2] - b[2]);
  return (
    <div className="space-y-2"><div className="grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg border border-white/5 p-2"><div className="mono text-lg">{snap.alliances.length}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">alliances</div></div><div className="rounded-lg border border-white/5 p-2"><div className="mono text-lg text-amber-300">{caravans}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">caravans out</div></div><div className="rounded-lg border border-white/5 p-2"><div className={cx('mono text-lg', raiders > 0 && 'text-bad')}>{raiders}</div><div className="text-[9px] uppercase tracking-wider text-slate-600">raiders out</div></div></div>
      <div className="space-y-1.5">{pairs.length === 0 && <p className="text-sm text-slate-500">Fewer than two living villages.</p>}{pairs.map((r, i) => { const A = snap.villages[r[0]], B = snap.villages[r[1]], al = isAllied(snap, r[0], r[1]), [w, c] = relWord(r[2]); return (
        <div key={i} className="rounded-lg border border-white/5 p-2"><div className="flex items-center justify-between text-xs"><span><span style={{ color: A.color }}>{A.name}</span> ↔ <span style={{ color: B.color }}>{B.name}</span></span><span className={c}>{al ? 'ALLIED' : w}</span></div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-white/5"><div className="absolute inset-y-0 left-1/2 w-px bg-white/20" /><div className="absolute inset-y-0 rounded-full" style={r[2] >= 0 ? { left: '50%', width: `${r[2] * 50}%`, background: '#34d399' } : { right: '50%', width: `${-r[2] * 50}%`, background: '#f87171' }} /></div></div>); })}</div>
      {snap.chief >= 0 && alive.length > 1 && <Btn className="!py-1 text-xs" onClick={() => open('chief')}>Alliances, caravans and raids: Chieftain orders →</Btn>}
      <p className="text-[11px] text-slate-600">Trade builds friendship; hunger, crowding, border incidents and raids erode it. At +55 villages may ally on their own; allies share inventions and defend each other.</p></div>
  );
}

const depth = (t: TechId, memo = new Map<TechId, number>()): number => { if (memo.has(t)) return memo.get(t)!; const d = TECHS[t].needs.length ? 1 + Math.max(...TECHS[t].needs.map((n) => depth(n, memo))) : 0; memo.set(t, d); return d; };
export function InventionsPanel({ snap }: { snap: Snapshot }) {
  const { v } = useFocus(snap), cmd = useHearth((s) => s.cmd), [pick, setPick] = useState<TechId | null>(null);
  const ids = Object.keys(TECHS) as TechId[], cols: TechId[][] = []; ids.forEach((t) => { (cols[depth(t)] ??= []).push(t); });
  const pos = new Map<TechId, [number, number]>(); cols.forEach((c, x) => c.forEach((t, y) => pos.set(t, [x * 128 + 4, y * 46 + 4])));
  if (!v) return null; const known = (t: TechId) => v.techs.includes(t), avail = (t: TechId) => !known(t) && TECHS[t].needs.every(known), mine = snap.chief === v.id, shown: TechId | null = pick ?? ((v.focus as TechId) || null);
  const W = cols.length * 128, H = Math.max(...cols.map((c) => c.length)) * 46 + 8;
  return (
    <div className="space-y-2"><div className="text-xs text-slate-400">Inventions of <b style={{ color: v.color }}>{v.name}</b> ({v.techs.length}/{ids.length})</div>
      <div className="overflow-auto rounded-lg border border-white/5 p-1"><svg width={W} height={H} role="img" aria-label="Invention tree">
        {ids.flatMap((t) => TECHS[t].needs.map((n) => { const a = pos.get(n)!, b = pos.get(t)!; return <path key={n + t} d={`M${a[0] + 118} ${a[1] + 20} C ${a[0] + 128} ${a[1] + 20}, ${b[0] - 10} ${b[1] + 20}, ${b[0]} ${b[1] + 20}`} stroke={known(t) ? '#34d399' : '#334155'} fill="none" strokeWidth="1.5" />; }))}
        {ids.map((t) => { const [x, y] = pos.get(t)!, k = known(t), a = avail(t), f = v.focus === t; return (<g key={t} onClick={() => setPick(t)} style={{ cursor: 'pointer' }}><rect x={x} y={y} width={118} height={40} rx={8} fill={k ? 'rgba(52,211,153,.12)' : a ? 'rgba(245,184,75,.10)' : 'rgba(255,255,255,.02)'} stroke={f ? '#22d3ee' : k ? '#34d399' : a ? '#f5b84b' : '#334155'} strokeWidth={f ? 2 : 1} /><text x={x + 59} y={y + 17} textAnchor="middle" fontSize="11" fill={k ? '#a7f3d0' : a ? '#fde68a' : '#64748b'}>{TECHS[t].name}</text><text x={x + 59} y={y + 31} textAnchor="middle" fontSize="9" fill="#64748b">{k ? 'known' : f ? 'research focus' : a ? 'can invent' : 'locked'}</text></g>); })}
      </svg></div>
      {shown && <div className="rounded-lg border border-white/10 p-2 text-xs"><div className="font-semibold text-slate-200">{TECHS[shown].name}</div><div className="text-slate-400">{TECHS[shown].desc}</div>{TECHS[shown].needs.length > 0 && <div className="mt-1 text-[11px] text-slate-500">Needs: {TECHS[shown].needs.map((n) => TECHS[n].name).join(', ')}</div>}
        {mine && avail(shown) && <Btn className="mt-2 !py-1 text-xs" variant={v.focus === shown ? 'primary' : 'ghost'} onClick={() => cmd({ k: 'research', tech: v.focus === shown ? '' : shown })}>{v.focus === shown ? <><Check size={13} />Research focus (click to clear)</> : 'Focus research here (2.5× chance)'}</Btn>}{!mine && <div className="mt-1 text-[11px] text-slate-600">Lead this village to set a research focus.</div>}</div>}
      <Label>Who knows what</Label>
      <div className="overflow-auto"><table className="w-full text-[10px]"><thead><tr><th className="text-left text-slate-600">Invention</th>{snap.villages.filter((x) => x.alive).map((x) => <th key={x.id} style={{ color: x.color }}>{x.name.slice(0, 3)}</th>)}</tr></thead><tbody>{ids.map((t) => <tr key={t} className="border-t border-white/5"><td className="py-0.5 text-slate-400">{TECHS[t].name}</td>{snap.villages.filter((x) => x.alive).map((x) => <td key={x.id} className="text-center">{x.techs.includes(t) ? <span style={{ color: x.color }}>●</span> : <span className="text-slate-700">·</span>}</td>)}</tr>)}</tbody></table></div>
    </div>
  );
}

export function EventsPanel() {
  const events = useHearth((s) => s.events), select = useHearth((s) => s.select), [all, setAll] = useState(false);
  const list = [...events].reverse().filter((e) => all || HIGHLIGHT.has(e.k)).slice(0, 120);
  return (
    <div className="space-y-2"><div className="flex gap-1.5">{[['Highlights', false], ['Everything', true]].map(([l, v]) => <button key={String(l)} onClick={() => setAll(v as boolean)} className={cx('flex-1 rounded-lg border px-2 py-1 text-xs', all === v ? 'border-acc/60 bg-acc/10 text-acc' : 'border-white/10 text-slate-400')}>{l as string}</button>)}</div>
      <div className="space-y-1.5">{list.map((e, i) => <button key={i} onClick={() => { if (e.x !== undefined && e.y !== undefined) centerOn(e.x, e.y); if (e.sid) select({ kind: 'settler', id: e.sid }); }} className={cx('block w-full text-left text-xs', EV_COL[e.k] ?? 'text-slate-400')}><span className="mono mr-1 text-slate-600">Y{(e.t / YEAR).toFixed(1)}</span>{e.text}</button>)}{!list.length && <p className="text-sm text-slate-500">Nothing yet. Highlights cover wars, alliances, inventions, new villages, big hunts, fevers and predators.</p>}</div></div>
  );
}
export type { SVillage };
