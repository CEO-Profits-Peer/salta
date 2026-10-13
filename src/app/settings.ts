import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExperimentConfig } from '../features/experiments/experiment';

export type Profile = 'eco' | 'balanced' | 'performance';
export const PROFILES: Record<Profile, { label: string; blurb: string; maxActive: (cores: number) => number; cfg: Partial<ExperimentConfig> }> = {
  eco: { label: 'Eco', blurb: 'Small populations, one experiment at a time.', maxActive: () => 1, cfg: { testerPop: 12, builderPop: 12, generations: 8, mazeSize: 11 } },
  balanced: { label: 'Balanced', blurb: 'Moderate populations, two experiments in parallel.', maxActive: () => 2, cfg: { testerPop: 24, builderPop: 24, generations: 10, mazeSize: 15 } },
  performance: { label: 'Performance', blurb: 'Large populations, more parallel workers (capped by your cores).', maxActive: (c) => Math.max(2, Math.min(4, c - 1)), cfg: { testerPop: 48, builderPop: 48, generations: 20, mazeSize: 21 } },
};
interface SettingsState { profile: Profile; maxActive: number; pauseWhenHidden: boolean; onboarded: boolean; lastSeenDay: number; set: (p: Partial<Omit<SettingsState, 'set'>>) => void }
export const useSettings = create<SettingsState>()(persist((set) => ({ profile: 'balanced', maxActive: 2, pauseWhenHidden: true, onboarded: false, lastSeenDay: 0, set: (p) => set(p) }), { name: 'aes-settings' }));
