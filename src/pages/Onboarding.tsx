import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { newConfig, useStore } from '../app/store';
import { PROFILES, useSettings } from '../app/settings';
import { Btn, CH } from '../components/ui';

const steps = [
  { t: 'Welcome to AI Evolution Studios', b: 'A laboratory where AI agents evolve against a real maze game, and every claimed improvement has to survive independent evaluation.' },
  { t: 'Three chambers', b: 'Testers hunt defects (and are punished for false alarms). Builders propose constrained maze edits. The Instructor applies fixed rules and held-out tests to decide what is genuinely better.' },
  { t: 'Your computer does the work', b: 'Training runs in background workers in this browser. Nothing is sent anywhere unless you sign in and choose to save an experiment.' },
];
export function Onboarding({ done, go }: { done: () => void; go: () => void }) {
  const [i, setI] = useState(0), { create, start } = useStore(), set = useSettings((s) => s.set);
  const last = i === steps.length;
  const launch = () => { set({ onboarded: true, profile: 'eco', maxActive: PROFILES.eco.maxActive(1) }); const id = create('Guided maze experiment', newConfig(PROFILES.eco.cfg)); start(id); done(); go(); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900 p-7 shadow-[0_0_60px_rgba(34,211,238,.12)]">
        <AnimatePresence mode="wait"><div>
          {!last ? (<><div className="mono text-[11px] uppercase tracking-[0.25em] text-acc">Step {i + 1} / {steps.length + 1}</div><h2 className="mt-2 text-2xl font-semibold">{steps[i].t}</h2><p className="mt-3 text-slate-400">{steps[i].b}</p>
            {i === 1 && <div className="mt-4 flex gap-2">{(Object.keys(CH) as (keyof typeof CH)[]).map((k) => <span key={k} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: CH[k].color, color: CH[k].color }}>{CH[k].label.replace(' Chamber', '')}</span>)}</div>}</>)
            : (<><div className="mono text-[11px] uppercase tracking-[0.25em] text-acc">Step {steps.length + 1} / {steps.length + 1}</div><h2 className="mt-2 text-2xl font-semibold">Run your first experiment</h2><p className="mt-3 text-slate-400">A short Eco-profile run: 12 testers, 12 builders, 8 generations on an 11×11 maze. You will see real results as they arrive.</p></>)}
        </div></AnimatePresence>
        <div className="mt-7 flex justify-between"><Btn onClick={() => { set({ onboarded: true }); done(); }}>Skip</Btn>{last ? <Btn variant="primary" onClick={launch}>Start guided experiment</Btn> : <Btn variant="primary" onClick={() => setI(i + 1)}>Next</Btn>}</div>
      </motion.div>
    </div>
  );
}
