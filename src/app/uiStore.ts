import { create } from 'zustand';
export type PanelId = 'village' | 'chief' | 'people' | 'diplomacy' | 'inventions' | 'events' | 'codex';
interface UiState { panel: PanelId | null; focus: number; setPanel: (p: PanelId | null) => void; toggle: (p: PanelId) => void; setFocus: (v: number) => void; open: (p: PanelId, village?: number) => void }
export const useUi = create<UiState>((set, get) => ({
  panel: null, focus: -1,
  setPanel: (panel) => set({ panel }), toggle: (p) => set({ panel: get().panel === p ? null : p }), setFocus: (focus) => set({ focus }),
  open: (p, village) => set({ panel: p, ...(village !== undefined ? { focus: village } : {}) }),
}));
