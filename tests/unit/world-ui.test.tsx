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
  it('World shows time, villages, and an inspector with thoughts and genes', async () => {
    const { World } = await import('../../src/pages/World'); render(<World />);
    expect(screen.getByText(/Tribes that trade/)).toBeTruthy(); expect(screen.getByText(/Year 1/)).toBeTruthy();
    const s = useHearth.getState().snap!.settlers[0]; act(() => useHearth.getState().select({ kind: 'settler', id: s.id }));
    expect(screen.getAllByText(s.name).length).toBeGreaterThan(0); expect(screen.getByText(/Genes/)).toBeTruthy();
    fireEvent.click(screen.getByText('villages')); expect(screen.getAllByText(/people/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('events')); expect(screen.getAllByText(/Y0\./).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Wanderer')); expect(useHearth.getState().mode).toBe('wanderer');
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
    expect(screen.getByText('First')).toBeTruthy(); expect(screen.getByText('Second')).toBeTruthy(); expect(screen.getByText('New world')).toBeTruthy(); cleanup(); useHearth.setState({ menuOpen: false });
    const { camRef, clampCam, zoomAt, MIN_ZOOM, MAX_ZOOM } = await import('../../src/components/HearthCanvas');
    camRef.zoom = 1; camRef.cx = -500; camRef.cy = 900; clampCam(); expect(camRef.zoom).toBe(MIN_ZOOM); expect(camRef.cx).toBe(48);
    camRef.zoom = 30; camRef.cx = 0; camRef.cy = 0; clampCam(); expect(camRef.cx).toBeGreaterThanOrEqual(480 / 30 - 1e-9); expect(camRef.cy).toBeGreaterThanOrEqual(300 / 30 - 1e-9);
    for (let i = 0; i < 60; i++) zoomAt(1.2, 900, 40); expect(camRef.zoom).toBe(MAX_ZOOM); expect(camRef.cx).toBeLessThanOrEqual(96 - 480 / MAX_ZOOM + 1e-9);
  });
});
