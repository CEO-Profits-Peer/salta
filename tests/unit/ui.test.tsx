// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { createWorld, advanceDays } from '../../src/descent/world';

const small = { builderPop: 8, probePop: 8, gensPerDay: 1, players: 16 };
let useWorld: typeof import('../../src/app/worldStore').useWorld;
beforeAll(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  ({ useWorld } = await import('../../src/app/worldStore'));
  const w = advanceDays(createWorld(21, '2026-10-12', small), 2);
  useWorld.setState({ world: { ...w, id: 'main' }, loaded: true });
});
afterEach(cleanup);

describe('pages render with a real evolved world', () => {
  it('Play shows five versions and a playable run with rating + vote', async () => {
    const { Play } = await import('../../src/pages/Play'); render(<Play />);
    expect(screen.getAllByText(/^Play [A-E]$/).length).toBe(5);
    fireEvent.click(screen.getByText('Play B'));
    for (let i = 0; i < 40; i++) act(() => { fireEvent.keyDown(window, { key: ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'][i % 4] }); });
    expect(screen.getByText(/Version B · floor/)).toBeTruthy();
  });
  it('Lab shows tanks, cull feed with reasons and findings', async () => {
    const { Lab } = await import('../../src/pages/Lab'); render(<Lab />);
    expect(screen.getByText(/Tester chamber/)).toBeTruthy(); expect(screen.getByText(/Cull feed/)).toBeTruthy(); expect(screen.getByText('End day now (fast-forward)')).toBeTruthy();
  });
  it('Chronicle lists patch notes and the idea forge', async () => {
    const { Chronicle } = await import('../../src/pages/Chronicle'); render(<Chronicle />);
    expect(screen.getByText(/Idea Forge/)).toBeTruthy(); expect(screen.getAllByText(/^Day [12]$/).length).toBeGreaterThan(0);
  });
  it('Arena renders and records runs from the store', async () => {
    useWorld.getState().recordRun({ day: 3, versionId: 'd3B', depth: 2, outcome: 'caught', steps: 80, nearMisses: 2, rating: 1 });
    const { Arena } = await import('../../src/pages/Arena'); render(<Arena />);
    expect(screen.getByText('Your recent runs')).toBeTruthy(); expect(screen.getByText('d3B')).toBeTruthy();
  });
});
