import { useEffect, useRef } from 'react';
import { CAUSES, DAY, YEAR } from '../hearth/types';
import { useHearth } from '../app/hearthStore';
import { useUi, type PanelId } from '../app/uiStore';
import { HearthCanvas, camRef, clampCam, zoomAt } from '../components/HearthCanvas';
import { LegendBody } from '../components/Legend';
import { Minimap } from '../components/Minimap';
import { ChiefPanel } from '../components/ChiefPanel';
import { DiplomacyPanel, EventsPanel, InventionsPanel, PeoplePanel, VillagePanel } from '../components/world/Panels';
import { Drawer, HudBar, InspectorCard, PANELS, Rail } from '../components/world/Chrome';
import { computeAdvice } from '../components/world/advisor';
import { SPEEDS, Bar } from '../components/world/shared';
import { Btn, Card, SectionTitle, cx } from '../components/ui';

const PANEL_KEYS: Record<string, PanelId> = { v: 'village', c: 'chief', o: 'people', b: 'diplomacy', i: 'inventions', e: 'events', l: 'codex' };

export function World({ go = () => {} }: { go?: (p: string) => void }) {
  void go;
  const { snap, mode, setMode, cmd, almanac, dismissAlmanac, catching, error, openMenu, toast } = useHearth(), { panel, toggle } = useUi(), last = useRef(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return; const k = e.key.toLowerCase(), st = useHearth.getState(), ui = useUi.getState();
      if (k === 'escape') { e.preventDefault(); if (ui.panel) ui.setPanel(null); else if (st.selected) st.select(null); else st.openMenu(!st.menuOpen); return; } if (st.menuOpen) return;
      const dirs: Record<string, [number, number]> = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] }, d = dirs[k], now = performance.now();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); // no page scrolling while playing
      if (k === '+' || k === '=') { zoomAt(1.15); return; } if (k === '-') { zoomAt(1 / 1.15); return; } if (k === 'p') { st.setSpeed(st.speed ? 0 : 1); return; }
      if (/^[1-5]$/.test(k)) { st.setSpeed(SPEEDS[Number(k) - 1]); return; }
      if (st.mode === 'observe') { if (PANEL_KEYS[k]) { ui.toggle(PANEL_KEYS[k]); return; } if (d) { camRef.cx += (d[0] * 14) / camRef.zoom; camRef.cy += (d[1] * 14) / camRef.zoom; clampCam(); st.setFollow(false); } else if (k === ' ') st.setSpeed(st.speed ? 0 : 1); return; }
      if (st.mode === 'wanderer') { if (d) { if (now - last.current > 70) { last.current = now; st.cmd({ k: 'wmove', dx: d[0], dy: d[1] }); } } else if (k === 'e') st.cmd({ k: 'wgather' }); else if (k === 'f') st.cmd({ k: 'wgive' }); else if (k === 'g') st.cmd({ k: 'wdeposit' }); return; }
      if (d) { if (now - last.current > 90) { last.current = now; st.cmd({ k: 'smove', dx: d[0], dy: d[1] }); } } else if (k === 'e') st.cmd({ k: 'sact' }); else if (k === ' ' || k === 'q') st.cmd({ k: 'sfight' }); else if (k === 'g') st.cmd({ k: 'sdeposit' }); else if (k === 'f') st.cmd({ k: 'sgive' }); else if (k === 'r') st.setMode('observe');
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  const me = snap?.settlers.find((s) => s.ctl) ?? null, vname = (id: number) => snap?.villages[id]?.name ?? '?', btn = (label: React.ReactNode, onClick: () => void, cls = '') => <Btn className={cx('!px-0 !py-3 text-sm', cls)} onClick={onClick}>{label}</Btn>;
  const alert = !!snap && computeAdvice(snap).some((a) => a.level === 'alert');
  return (
    <div className="relative h-[calc(100dvh-5rem)] min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-ink-950 md:h-[calc(100dvh-1.5rem)]" style={{ overscrollBehavior: 'contain' }}>
      <HearthCanvas onPick={(k, id) => { useHearth.getState().select(k ? { kind: k, id } : null); }} />
      {snap && <HudBar snap={snap} onMenu={() => openMenu(true)} />}
      <Rail alert={alert} />
      {panel && snap && (<Drawer title={PANELS.find((p) => p.id === panel)!.label}>
        {panel === 'village' && <VillagePanel snap={snap} />}{panel === 'chief' && <ChiefPanel snap={snap} />}{panel === 'people' && <PeoplePanel snap={snap} />}{panel === 'diplomacy' && <DiplomacyPanel snap={snap} />}{panel === 'inventions' && <InventionsPanel snap={snap} />}{panel === 'events' && <EventsPanel />}{panel === 'codex' && <LegendBody mode={mode} />}
      </Drawer>)}
      {snap && <InspectorCard snap={snap} />}
      <div className="absolute bottom-3 right-3 z-10 hidden w-36 sm:block"><Minimap /></div>
      {mode === 'settler' && me && snap && (<div className="absolute bottom-3 right-3 z-20 w-[210px] rounded-xl border border-white/10 bg-ink-950/92 p-3 text-xs backdrop-blur sm:bottom-44">
        <div className="mb-1 flex items-center justify-between"><span className="font-semibold text-white">{me.name}</span><span className="mono text-slate-500">{vname(me.v)}</span></div>
        <div className="space-y-1"><Bar label="Health" v={me.health} color="#34d399" /><Bar label="Hunger" v={me.hunger} color="#f5b84b" /><Bar label="Thirst" v={me.thirst} color="#22d3ee" /><Bar label="Cold" v={me.cold} color="#93c5fd" /></div>
        <div className="mono mt-1 text-[10px] text-slate-500">carry {me.carry.food}f {me.carry.wood}w {me.carry.stone}s{me.carry.tools ? ` ${me.carry.tools}t` : ''}</div>
        <div className="mt-2 grid grid-cols-3 gap-1">{btn('↑', () => cmd({ k: 'smove', dx: 0, dy: -1 }))}{btn('E', () => cmd({ k: 'sact' }), 'border-acc/40')}{btn('⚔', () => cmd({ k: 'sfight' }))}{btn('←', () => cmd({ k: 'smove', dx: -1, dy: 0 }))}{btn('↓', () => cmd({ k: 'smove', dx: 0, dy: 1 }))}{btn('→', () => cmd({ k: 'smove', dx: 1, dy: 0 }))}{btn('G', () => cmd({ k: 'sdeposit' }))}{btn('F', () => cmd({ k: 'sgive' }))}{btn('R', () => setMode('observe'))}</div>
        <p className="mt-1 text-[10px] text-slate-600">E interact · ⚔ fight · G deposit · F give · R release</p></div>)}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-white/10 bg-ink-950/85 px-2 py-1.5 backdrop-blur">
        {(['observe', 'wanderer'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cx('rounded-lg px-2.5 py-1 text-[11px] capitalize', mode === m ? 'bg-acc text-ink-950' : 'text-slate-400 hover:bg-white/5')}>{m}</button>)}
        <span className={cx('rounded-lg px-2.5 py-1 text-[11px]', mode === 'settler' ? 'bg-acc text-ink-950' : 'text-slate-600')} title="Select an adult settler, then press “Play as”">settler</span>
        <span className="hidden max-w-[230px] truncate pl-1 text-[10px] text-slate-500 md:inline">{mode === 'observe' ? 'drag/WASD pan · wheel zoom · click to inspect' : mode === 'wanderer' ? 'WASD move · E gather · F feed · G deposit' : 'WASD walk · E interact · Space fight · R release'}</span></div>
      <div className="absolute bottom-14 left-1/2 z-20 w-[min(560px,92%)] -translate-x-1/2 space-y-2">
        {error && <p className="rounded-lg border border-bad/40 bg-ink-950/95 px-3 py-2 text-xs text-bad">Simulation error: {error}</p>}
        {toast && <p className="rounded-lg border border-amb/40 bg-ink-950/95 px-3 py-2 text-xs text-amb">{toast}</p>}
        {catching && <div className="rounded-lg border border-acc/30 bg-ink-950/95 px-3 py-2 text-xs text-acc"><span className="pulse-dot">●</span> While you were away the world kept living: simulating {Math.round(catching.done / DAY)} / {Math.round(catching.total / DAY)} days…</div>}
        {almanac && (<Card className="border-acc/30 bg-ink-950/95"><SectionTitle right={<Btn className="!py-1 text-xs" onClick={dismissAlmanac}>Close</Btn>}>Almanac: while you were away ({(almanac.ticks / YEAR).toFixed(1)} years)</SectionTitle>
          <p className="text-sm text-slate-300">Population {almanac.popBefore} → {almanac.popAfter}. {almanac.births} born, {Object.values(almanac.deaths).reduce((a, b) => a + b, 0)} died ({CAUSES.filter((c) => almanac.deaths[c] > 0).map((c) => `${almanac.deaths[c]} ${c}`).join(', ') || 'none'}). {almanac.founded} village(s) founded, {almanac.fell} fell, {almanac.builds} buildings finished{almanac.trades ? `, ${almanac.trades} trades, ${almanac.raids} raids, ${almanac.inventions} inventions` : ''}.</p>
          <p className="mt-1 text-[11px] text-slate-600">Computed on your device when you returned (1 simulated tick per 3 real seconds away, at most one year). No server is running the world yet.</p></Card>)}</div>
      {!snap && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Waking the world…</div>}
    </div>
  );
}
