import { useMemo, useState } from 'react';
import { PROFILES, useSettings, type Profile } from '../app/settings';
import { useStore } from '../app/store';
import { useWorld } from '../app/worldStore';
import { detectCapabilities } from '../engine/compute/capabilities';
import { cloudConfigured } from '../integrations/supabase/client';
import { useAuth } from '../integrations/supabase/auth';
import { Btn, Card, Field, SectionTitle, cx, inputCls } from '../components/ui';

export function Settings() {
  const s = useSettings(), caps = useMemo(detectCapabilities, []), clearAll = useStore((x) => x.clearAll), a = useAuth(), resetWorld = useWorld((x) => x.reset), [confirmW, setConfirmW] = useState(false);
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-5"><h1 className="text-2xl font-semibold">Settings</h1>
      <Card><SectionTitle>Compute</SectionTitle>
        <div className="flex gap-2">{(Object.keys(PROFILES) as Profile[]).map((p) => <button key={p} onClick={() => s.set({ profile: p, maxActive: PROFILES[p].maxActive(caps.cores) })} className={cx('flex-1 rounded-lg border p-3 text-left', s.profile === p ? 'border-acc/60 bg-acc/10' : 'border-white/10 hover:bg-white/5')}><div className="text-sm">{PROFILES[p].label}</div><div className="mt-1 text-xs text-slate-500">{PROFILES[p].blurb}</div></button>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={`Max active experiments: ${s.maxActive}`}><input type="range" min={1} max={Math.max(2, Math.min(6, caps.cores))} value={s.maxActive} onChange={(e) => s.set({ maxActive: Number(e.target.value) })} className="w-full accent-cyan-400" /></Field>
          <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={s.pauseWhenHidden} onChange={(e) => s.set({ pauseWhenHidden: e.target.checked })} className="h-4 w-4 accent-cyan-400" />Pause experiments when this tab is hidden (auto-resumes)</label></div>
        <p className="mt-3 text-xs text-slate-500">Browsers cannot enforce an exact CPU percentage. Load is controlled through the number of workers and population sizes. Hidden tabs may be throttled by the browser regardless of this setting.</p></Card>
      <Card><SectionTitle>Cloud account</SectionTitle>
        {!cloudConfigured ? <p className="text-sm text-slate-400">Local-demo mode: no Supabase credentials are configured, so nothing is sent to the cloud. All experiments live in this browser’s IndexedDB.</p> : a.user ? (
          <div className="flex items-center justify-between"><span className="text-sm">Signed in as <span className="mono">{a.user.email}</span></span><Btn onClick={() => void a.signOut()}>Sign out</Btn></div>) : (
          <div className="grid max-w-md gap-3"><Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Field label="Password (min. 8 characters)"><input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
            <div className="flex flex-wrap gap-2"><Btn variant="primary" disabled={a.busy || !email || pw.length < 8} onClick={() => void a.signIn(email, pw)}>Sign in</Btn><Btn disabled={a.busy || !email || pw.length < 8} onClick={() => void a.signUp(email, pw)}>Create account</Btn><Btn disabled={a.busy || !email} onClick={() => void a.reset(email)}>Forgot password</Btn></div>
            {a.error && <p className="text-xs text-bad">{a.error}</p>}{a.info && <p className="text-xs text-ok">{a.info}</p>}</div>)}</Card>
      <Card><SectionTitle>Detected capabilities</SectionTitle><dl className="mono grid grid-cols-2 gap-y-1 text-xs sm:w-96"><dt className="text-slate-500">Web Workers</dt><dd>{String(caps.webWorkers)}</dd><dt className="text-slate-500">IndexedDB</dt><dd>{String(caps.indexedDB)}</dd><dt className="text-slate-500">WebGPU</dt><dd>{caps.webgpu ? 'detected (not used yet)' : 'no'}</dd><dt className="text-slate-500">Cores</dt><dd>{caps.cores}</dd></dl></Card>
      <Card><SectionTitle>Living world</SectionTitle>{confirmW ? <div className="flex items-center gap-3 text-sm"><span>Restart the world from Day 1? Patch notes, ideas and your runs are deleted.</span><Btn variant="danger" onClick={() => { void resetWorld(); setConfirmW(false); }}>Restart world</Btn><Btn onClick={() => setConfirmW(false)}>Cancel</Btn></div> : <Btn variant="danger" onClick={() => setConfirmW(true)}>Restart the world</Btn>}</Card>
      <Card><SectionTitle>Local data</SectionTitle>{confirm ? <div className="flex items-center gap-3 text-sm"><span>Delete all local experiments and checkpoints?</span><Btn variant="danger" onClick={() => { void clearAll(); setConfirm(false); }}>Delete everything</Btn><Btn onClick={() => setConfirm(false)}>Cancel</Btn></div> : <div className="flex gap-2"><Btn variant="danger" onClick={() => setConfirm(true)}>Delete all local experiments</Btn><Btn onClick={() => s.set({ onboarded: false })}>Replay onboarding</Btn></div>}</Card>
    </div>
  );
}
