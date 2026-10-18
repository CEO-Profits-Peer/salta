import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../app/settings';
import { Btn, CH } from '../components/ui';

const steps = [
  { t: 'Welcome to AI Evolution Studios', b: 'Four AI tribes try to survive in an open world of forests, rivers, winters and wolves. They are born, mutate, adapt and die, and each village drifts towards its own strategy.' },
  { t: 'Three chambers', b: 'Watch settlers live and die, see what each one is thinking, or walk in as the Wanderer and help them. Evolution shows which genes are winning. Delve keeps the AI-rebuilt labyrinth from earlier versions.' },
  { t: 'Your computer does the work', b: 'Training runs in background workers in this browser. Nothing is sent anywhere unless you sign in and choose to save an experiment.' },
];
export function Onboarding({ done, go }: { done: () => void; go: () => void }) {
  const [i, setI] = useState(0), set = useSettings((s) => s.set);
  const last = i === steps.length;
  const launch = () => { set({ onboarded: true }); done(); go(); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900 p-7 shadow-[0_0_60px_rgba(34,211,238,.12)]">
        <AnimatePresence mode="wait"><div>
          {!last ? (<><div className="mono text-[11px] uppercase tracking-[0.25em] text-acc">Step {i + 1} / {steps.length + 1}</div><h2 className="mt-2 text-2xl font-semibold">{steps[i].t}</h2><p className="mt-3 text-slate-400">{steps[i].b}</p>
            {i === 1 && <div className="mt-4 flex gap-2">{(Object.keys(CH) as (keyof typeof CH)[]).map((k) => <span key={k} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: CH[k].color, color: CH[k].color }}>{CH[k].label.replace(' Chamber', '')}</span>)}</div>}</>)
            : (<><div className="mono text-[11px] uppercase tracking-[0.25em] text-acc">Step {steps.length + 1} / {steps.length + 1}</div><h2 className="mt-2 text-2xl font-semibold">Meet the settlers</h2><p className="mt-3 text-slate-400">Click a settler to see what it is doing and why. The icons on the left open Village, Chieftain, People, Diplomacy, Inventions, Events and the Codex; the Advisor at the top warns you about famine, raids and cold. Speed 1× is calm; 8× and 32× let generations pass.</p></>)}
        </div></AnimatePresence>
        <div className="mt-7 flex justify-between"><Btn onClick={() => { set({ onboarded: true }); done(); }}>Skip</Btn>{last ? <Btn variant="primary" onClick={launch}>Enter the world</Btn> : <Btn variant="primary" onClick={() => setI(i + 1)}>Next</Btn>}</div>
      </motion.div>
    </div>
  );
}
