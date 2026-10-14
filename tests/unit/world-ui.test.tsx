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
    expect(screen.getByText(/Four tribes/)).toBeTruthy(); expect(screen.getByText(/Year 1/)).toBeTruthy();
    const s = useHearth.getState().snap!.settlers[0]; act(() => useHearth.getState().select({ kind: 'settler', id: s.id }));
    expect(screen.getAllByText(s.name).length).toBeGreaterThan(0); expect(screen.getByText(/Genes/)).toBeTruthy();
    fireEvent.click(screen.getByText('villages')); expect(screen.getAllByText(/people/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('events')); expect(screen.getAllByText(/Y0\./).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Be the Wanderer')); expect(useHearth.getState().mode).toBe('wanderer');
  });
  it('Evolution renders strategy table and selection note', async () => {
    const { Evolution } = await import('../../src/pages/Evolution'); render(<Evolution />);
    expect(screen.getByText(/Village strategies/)).toBeTruthy(); expect(screen.getByText(/What kills settlers/)).toBeTruthy();
  });
});
