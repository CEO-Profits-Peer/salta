// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { createSim } from '../../src/hearth/world';
import { stepSim } from '../../src/hearth/sim';
import { snapshot } from '../../src/hearth/api';

let useHearth: typeof import('../../src/app/hearthStore').useHearth;
beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 0); vi.stubGlobal('cancelAnimationFrame', () => {});
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  ({ useHearth } = await import('../../src/app/hearthStore'));
  const sim = createSim(9); stepSim(sim, 2400); const snap = snapshot(sim, null, 0, true);
  useHearth.setState({ snap, terrain: sim.terrain.slice(), stats: snap.stats, events: snap.events, loaded: true });
});
afterEach(cleanup);

describe('Hearthworld pages with a real simulated snapshot', () => {
  it('World: HUD, panel rail, inspector, and every panel opens with real data', async () => {
    const { World } = await import('../../src/pages/World'); const { useUi } = await import('../../src/app/uiStore'); render(<World />);
    expect(screen.getByLabelText('Panels')).toBeTruthy(); expect(screen.getByText(/Y1 · /)).toBeTruthy();
    const s = useHearth.getState().snap!.settlers[0]; act(() => useHearth.getState().select({ kind: 'settler', id: s.id }));
    expect(screen.getByLabelText('Inspector')).toBeTruthy(); expect(screen.getAllByText(s.name).length).toBeGreaterThan(0); expect(screen.getByText(/Genes/)).toBeTruthy(); expect(screen.getByText('intellect')).toBeTruthy();
    const open = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    open('Village'); expect(screen.getByText('prosperity')).toBeTruthy(); expect(screen.getByText(/What the adults are doing/)).toBeTruthy();
    open('Inventions'); expect(screen.getByRole('img', { name: 'Invention tree' })).toBeTruthy(); expect(screen.getByText('Who knows what')).toBeTruthy();
    open('Events'); expect(screen.getByText('Highlights')).toBeTruthy(); fireEvent.click(screen.getByText('Everything'));
    open('People'); expect(screen.getByPlaceholderText(/Search by name/)).toBeTruthy();
    open('Diplomacy'); expect(screen.getByText('alliances')).toBeTruthy();
    open('Chieftain'); expect(screen.getByText(/Choose a village to lead/)).toBeTruthy();
    open('Codex'); expect(screen.getByText(/Terrain & resources/)).toBeTruthy();
    expect(useUi.getState().panel).toBe('codex'); fireEvent.keyDown(window, { key: 'Escape' }); expect(useUi.getState().panel).toBeNull();
    fireEvent.keyDown(window, { key: 'v' }); expect(useUi.getState().panel).toBe('village'); fireEvent.keyDown(window, { key: 'v' }); expect(useUi.getState().panel).toBeNull();
    fireEvent.click(screen.getByText('wanderer')); expect(useHearth.getState().mode).toBe('wanderer'); fireEvent.click(screen.getByText('observe'));
  });
  it('Evolution renders strategy table and selection note', async () => {
    const { Evolution } = await import('../../src/pages/Evolution'); render(<Evolution />);
    expect(screen.getByText(/Village strategies/)).toBeTruthy(); expect(screen.getByText(/What kills settlers/)).toBeTruthy();
  });
});

describe('legend, menu and camera limits', () => {
  it('Legend expands to show buildings with explanations and mode-specific controls', async () => {
    const { Legend } = await import('../../src/components/Legend'); render(<Legend mode="settler" />);
    fireEvent.click(screen.getByText(/Legend & controls/)); expect(screen.getByText(/Controls: settler/)).toBeTruthy(); fireEvent.click(screen.getByText('Buildings'));
    expect(screen.getByText(/Raises the food stockpile limit/)).toBeTruthy(); fireEvent.click(screen.getByText('Inventions')); expect(screen.getAllByText(/Tally Marks/).length).toBeGreaterThan(0);
  });
  it('Menu lists worlds and offers New world; camera never leaves the map', async () => {
    useHearth.setState({ menuOpen: true, worlds: [{ id: 'a', name: 'First', created: 1, savedAt: 1, tick: 7680, pop: 40 }, { id: 'b', name: 'Second', created: 2, savedAt: 2, tick: 0, pop: 0 }], currentId: 'a' });
    const { GameMenu } = await import('../../src/components/GameMenu'); render(<GameMenu go={() => {}} />);
    expect(screen.getByText('First')).toBeTruthy(); expect(screen.getByText('Second')).toBeTruthy(); expect(screen.getByText(/Create a new world/)).toBeTruthy(); cleanup(); useHearth.setState({ menuOpen: false });
    const { camRef, clampCam, zoomAt, minZoom, MAX_ZOOM } = await import('../../src/components/HearthCanvas'); const MIN_ZOOM = minZoom();
    camRef.zoom = 1; camRef.cx = -500; camRef.cy = 900; clampCam(); expect(camRef.zoom).toBe(MIN_ZOOM); expect(camRef.cx).toBe(48);
    camRef.zoom = 30; camRef.cx = 0; camRef.cy = 0; clampCam(); expect(camRef.cx).toBeGreaterThanOrEqual(480 / 30 - 1e-9); expect(camRef.cy).toBeGreaterThanOrEqual(300 / 30 - 1e-9);
    for (let i = 0; i < 60; i++) zoomAt(1.2, 900, 40); expect(camRef.zoom).toBe(MAX_ZOOM); expect(camRef.cx).toBeLessThanOrEqual(96 - 480 / MAX_ZOOM + 1e-9);
  });
});

describe('v0.6 interface: Chieftain, Content Lab, World Creator, menu', () => {
  it('ChiefPanel lets you pick a village and then shows objectives, priorities, orders and roles', async () => {
    const { ChiefPanel } = await import('../../src/components/ChiefPanel'); const { snapshot: snapOf } = await import('../../src/hearth/api');
    render(<ChiefPanel snap={useHearth.getState().snap!} />); expect(screen.getByText(/Choose a village to lead/)).toBeTruthy(); cleanup();
    const sim = createSim(9); stepSim(sim, 800); sim.chief = 0; render(<ChiefPanel snap={snapOf(sim, null, 0, true)} />);
    expect(screen.getByText('Objectives')).toBeTruthy(); expect(screen.getByText('Priorities')).toBeTruthy(); expect(screen.getByText('Orders')).toBeTruthy(); expect(screen.getByText(/^Roles/)).toBeTruthy(); expect(screen.getByText('Step down')).toBeTruthy();
  });
  it('ContentLab shows proposals with ratings, verdicts, adopt buttons and the cull feed', async () => {
    const { useLab } = await import('../../src/app/labStore'); const { generate, describeSpec } = await import('../../src/hearth/lab'); const { Rng } = await import('../../src/engine/rng');
    const mk = (t: 'creature' | 'building' | 'quirk', i: number, ok: boolean) => { const spec = generate(t, new Rng(i)); return { id: spec.s.id, spec: { ...spec, s: { ...spec.s, desc: describeSpec(spec) } }, info: { score: ok ? 0.7 : -1, approved: ok, reasons: ok ? [] : ['never used: nothing in the world picked it up'], popRatio: 1.02, uptake: 0.8, balance: 0.9, diversity: 1, novelty: 0.6 }, gen: 0, agent: i, rating: 0, created: 0 } as never; };
    const lib = [mk('creature', 1, true), mk('building', 2, true), mk('quirk', 3, false)];
    useLab.setState({ lab: { v: 1, seed: 1, tick: 2, pops: {}, library: lib, culls: [{ tick: 0, type: 'quirk', who: 'Builder-3: Test', reason: 'rejected by Instructor: bad' }] }, loaded: true });
    const { ContentLab } = await import('../../src/pages/ContentLab'); render(<ContentLab go={() => {}} />);
    expect(screen.getByText(/AI builders invent new creatures/)).toBeTruthy(); expect(screen.getAllByText('Adopt in world').length).toBe(2); expect(screen.getByText(/Cull feed/)).toBeTruthy(); expect(screen.getByText(/Run AI builders \(generation 2\)/)).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('5 stars')[0]); expect(useLab.getState().lab!.library.some((p) => p.rating === 5)).toBe(true);
    fireEvent.click(screen.getByText('show rejected too')); expect(screen.getAllByText('rejected').length).toBeGreaterThan(0);
  });
  it('WorldCreator offers presets, a share code and loads codes from others', async () => {
    const { WorldCreator } = await import('../../src/components/WorldCreator'); const { encodeWorld, cleanSettings, PRESETS } = await import('../../src/hearth/types'); render(<WorldCreator onClose={() => {}} />);
    expect(screen.getByText('Fast evolution')).toBeTruthy(); fireEvent.click(screen.getByText('Fast evolution'));
    const code = encodeWorld(4242, cleanSettings(PRESETS[3].s)), box = screen.getByPlaceholderText(/Paste a code/) as HTMLInputElement; fireEvent.change(box, { target: { value: code } }); fireEvent.click(screen.getByText('Load'));
    expect((screen.getByDisplayValue('4242') as HTMLInputElement).value).toBe('4242'); expect(screen.getByText('Loaded!')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'nonsense' } }); fireEvent.click(screen.getByText('Load')); expect(screen.getByText(/not valid/)).toBeTruthy();
  });
  it('the Esc menu offers both modes, worlds and share codes', async () => {
    useHearth.setState({ menuOpen: true, worlds: [{ id: 'a', name: 'First', created: 1, savedAt: 1, tick: 0, pop: 0, seed: 5 }], currentId: 'a' });
    const { GameMenu } = await import('../../src/components/GameMenu'); render(<GameMenu go={() => {}} />);
    expect(screen.getByText(/Mode: Hearthworld/)).toBeTruthy(); expect(screen.getByText(/Mode: Content Lab/)).toBeTruthy(); expect(screen.getByTitle('Copy share code')).toBeTruthy(); expect(screen.getByText(/Create a new world/)).toBeTruthy(); useHearth.setState({ menuOpen: false });
  });
});
