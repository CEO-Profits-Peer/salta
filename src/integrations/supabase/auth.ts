import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';

interface AuthState { user: User | null; ready: boolean; error: string | null; busy: boolean; info: string | null;
  init: () => void; signIn: (e: string, p: string) => Promise<void>; signUp: (e: string, p: string) => Promise<void>; signOut: () => Promise<void>; reset: (e: string) => Promise<void> }
let started = false;
export const useAuth = create<AuthState>((set) => ({
  user: null, ready: !supabase, error: null, busy: false, info: null,
  init: () => {
    if (!supabase || started) return; started = true;
    void supabase.auth.getSession().then(({ data }) => set({ user: data.session?.user ?? null, ready: true })).catch(() => set({ ready: true }));
    supabase.auth.onAuthStateChange((_e, s) => set({ user: s?.user ?? null }));
  },
  signIn: async (email, password) => { if (!supabase) return; set({ busy: true, error: null, info: null }); const { error } = await supabase.auth.signInWithPassword({ email, password }); set({ busy: false, error: error?.message ?? null }); },
  signUp: async (email, password) => { if (!supabase) return; set({ busy: true, error: null, info: null }); const { data, error } = await supabase.auth.signUp({ email, password }); set({ busy: false, error: error?.message ?? null, info: !error && !data.session ? 'Check your inbox to confirm your email, then sign in.' : null }); },
  signOut: async () => { if (supabase) await supabase.auth.signOut(); },
  reset: async (email) => { if (!supabase) return; set({ busy: true, error: null, info: null }); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); set({ busy: false, error: error?.message ?? null, info: error ? null : 'Password reset email sent.' }); },
}));
