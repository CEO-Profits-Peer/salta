import { useEffect, useMemo, useRef, useState } from 'react';
import { Rng } from '../engine/rng';
import { HEURISTIC_GENOME, RANDOM_GENOME, MazeEnv, POLICY_LEN, generateMaze, idx, runEpisode, shortestPath } from '../game/maze/maze';
import { applyOps } from '../features/builders/builder';
import { evaluateConfig, TRAIN_SEEDS } from '../features/instructors/instructor';
import { useLatest, f3 } from '../app/hooks';
import { MazeCanvas } from '../components/MazeCanvas';
import { Btn, Card, Field, SectionTitle, inputCls } from '../components/ui';

const KEYS: Record<string, number> = { ArrowUp: 0, w: 0, ArrowDown: 1, s: 1, ArrowLeft: 2, a: 2, ArrowRight: 3, d: 3 };

export function Laboratory() {
  const latest = useLatest(), s = latest?.state;
  const [seed, setSeed] = useState(7), [size, setSize] = useState(15);
  const cfg = useMemo(() => generateMaze(seed, size, size), [seed, size]);
  const [mode, setMode] = useState<'play' | 'watch'>('play');
  const [trail, setTrail] = useState<number[]>([]), [info, setInfo] = useState({ steps: 0, reward: 0, done: false, success: false });
  const env = useRef(new MazeEnv(cfg)), reward = useRef(0);
  const [agent, setAgent] = useState<'heuristic' | 'random' | 'tester'>('heuristic'), [result, setResult] = useState<{ success: boolean; steps: number; reward: number } | null>(null);
  const full = useRef<number[]>([]), timer = useRef<ReturnType<typeof setInterval>>();

  const reset = () => { clearInterval(timer.current); env.current = new MazeEnv(cfg); reward.current = 0; setTrail([idx(cfg, cfg.start[0], cfg.start[1])]); setInfo({ steps: 0, reward: 0, done: false, success: false }); setResult(null); };
  useEffect(reset, [cfg, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== 'play') return;
    const h = (e: KeyboardEvent) => {
      const a = KEYS[e.key]; if (a === undefined || (e.target as HTMLElement).tagName === 'INPUT') return; e.preventDefault();
      const en = env.current; if (en.done) return;
      const r = en.step(a); reward.current += r.reward;
      setTrail((t) => [...t, idx(cfg, en.x, en.y)]); setInfo({ steps: en.steps, reward: reward.current, done: r.done, success: r.success });
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [cfg, mode]);
  useEffect(() => () => clearInterval(timer.current), []);

  const watch = () => {
    reset();
    const g = agent === 'heuristic' ? HEURISTIC_GENOME : agent === 'random' ? RANDOM_GENOME : s?.tester.best?.genome.slice(0, POLICY_LEN) ?? HEURISTIC_GENOME;
    const tr: number[] = []; const r = runEpisode(cfg, g, new Rng(Date.now() & 0xffff), tr); // the real episode; the animation replays its actual actions
    full.current = tr; setResult({ success: r.success, steps: r.steps, reward: r.reward });
    let i = 0; timer.current = setInterval(() => { i++; setTrail(tr.slice(0, i + 1)); if (i >= tr.length - 1) clearInterval(timer.current); }, 30);
  };
  const best = s ? applyOps(s.baseline, s.bestVerified.ops) : null;
  const cmp = useMemo(() => (s && best ? { a: s.baselineEval, b: s.bestVerified, sp: [shortestPath(s.baseline), shortestPath(best)], fresh: evaluateConfig(best, TRAIN_SEEDS) } : null), [s]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="flex justify-center"><MazeCanvas cfg={cfg} trail={trail} /></Card>
        <div className="space-y-3">
          <Card><SectionTitle>Maze</SectionTitle>
            <div className="grid grid-cols-2 gap-3"><Field label="Seed"><input type="number" className={inputCls} value={seed} onChange={(e) => setSeed(Math.max(0, Number(e.target.value) | 0))} /></Field>
              <Field label="Size (7–31)"><input type="number" className={inputCls} value={size} onChange={(e) => setSize(Math.min(31, Math.max(7, Number(e.target.value) | 0)))} /></Field></div>
            <p className="mono mt-2 text-xs text-slate-500">shortest path {shortestPath(cfg)} · step limit {cfg.maxSteps}</p>
            <Btn className="mt-2 w-full" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>New random maze</Btn></Card>
          <Card><div className="mb-3 flex gap-2">{(['play', 'watch'] as const).map((m) => <Btn key={m} variant={mode === m ? 'primary' : 'ghost'} className="flex-1" onClick={() => setMode(m)}>{m === 'play' ? 'Play yourself' : 'Watch an agent'}</Btn>)}</div>
            {mode === 'play' ? (<><p className="text-xs text-slate-400">Arrow keys or WASD. You see the same maze the agents solve.</p>
              <p className="mono mt-2 text-sm">steps {info.steps} · reward {info.reward.toFixed(2)}</p>
              {info.done && <p className={info.success ? 'mt-1 text-ok' : 'mt-1 text-bad'}>{info.success ? 'Exit reached!' : 'Out of steps.'}</p>}<Btn className="mt-2 w-full" onClick={reset}>Restart</Btn></>) : (<>
              <Field label="Agent"><select className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value as typeof agent)}><option value="heuristic">Reference heuristic</option><option value="random">Random walker</option><option value="tester" disabled={!s?.tester.best}>Best evolved tester policy</option></select></Field>
              <Btn variant="primary" className="mt-2 w-full" onClick={watch}>Run episode</Btn>
              {result && <p className="mono mt-2 text-xs text-slate-300">actual result: {result.success ? 'reached exit' : 'failed'} · {result.steps} steps · reward {result.reward.toFixed(2)}</p>}</>)}
          </Card>
        </div>
      </div>
      <Card><SectionTitle>Compare game versions {latest && <span className="mono normal-case tracking-normal text-slate-500">{latest.name}</span>}</SectionTitle>
        {!cmp || !s || !best ? <p className="text-sm text-slate-500">Run an experiment to compare the baseline with the best verified candidate.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{[['Baseline', s.baseline, cmp.a.train, cmp.a.heldOut, cmp.sp[0]] as const, [`Best verified (${s.bestVerified.id})`, best, cmp.b.train, cmp.b.heldOut, cmp.sp[1]] as const].map(([t, c, tr, ho, sp]) => (
            <div key={t}><div className="mb-2 text-sm">{t}</div><MazeCanvas cfg={c} className="aspect-square w-full max-w-[360px] rounded-lg border border-white/10" />
              <p className="mono mt-2 text-xs text-slate-400">shortest path {sp} · train {f3(tr.score)} · held-out {f3(ho.score)} · heuristic completion {Math.round(tr.heuristicCompletion * 100)}% · random-walker completion {Math.round((1 - tr.exploitResistance) * 100)}%</p></div>))}</div>)}
      </Card>
    </div>
  );
}
