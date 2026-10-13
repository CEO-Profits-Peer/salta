import { Rng } from '../rng';

export interface EvoConfig { popSize: number; eliteCount: number; survivalRate: number; tournamentSize: number; mutationRate: number; diversityWeight: number }
export interface EvoOps<G> {
  random(rng: Rng): G;
  mutate(g: G, rng: Rng, rate: number): G;
  crossover(a: G, b: G, rng: Rng): G;
  distance(a: G, b: G): number;
  /** Must be deterministic for a given genome (use fixed evaluation seeds). */
  evaluate(g: G): number;
}
export interface Cull<G> { id: number; genome: G; fitness: number; rank: number; nearestId: number; nearest: number }
export interface EvoState<G> {
  generation: number; population: G[]; fitness: number[]; rngState: number;
  /** Stable agent identities (parallel to population), parent links and the agents removed in the last step. */
  ids?: number[]; nextId?: number; parents?: Record<number, [number, number]>; culls?: Cull<G>[];
  best: { genome: G; fitness: number; generation: number } | null;
  meanFitness: number; diversity: number; eliminated: number;
}
export function initEvo<G>(ops: EvoOps<G>, cfg: EvoConfig, seed: number, seeds: G[] = []): EvoState<G> {
  const rng = new Rng(seed);
  const population = [...seeds];
  while (population.length < cfg.popSize) population.push(ops.random(rng));
  const pop = population.slice(0, cfg.popSize);
  return { generation: 0, population: pop, fitness: [], rngState: rng.state, best: null, meanFitness: 0, diversity: 0, eliminated: 0, ids: pop.map((_, i) => i), nextId: pop.length, parents: {}, culls: [] };
}

/** Evaluate current population, update the all-time best, then breed the next generation. */
export function stepEvo<G>(prev: EvoState<G>, ops: EvoOps<G>, cfg: EvoConfig): EvoState<G> {
  const rng = new Rng(prev.rngState), pop = prev.population, n = pop.length;
  const fit = pop.map((g) => ops.evaluate(g));
  let best = prev.best;
  fit.forEach((f, i) => { if (!best || f > best.fitness) best = { genome: structuredClone(pop[i]), fitness: f, generation: prev.generation }; });
  // Diversity bonus: mean distance to the 3 nearest others (novelty), normalised to [0,1].
  const nearIdx: number[] = [], nearDist: number[] = [];
  const nov = pop.map((a, i) => {
    const all = pop.map((b, j) => ({ j, d: i === j ? Infinity : ops.distance(a, b) })).sort((x, y) => x.d - y.d);
    nearIdx.push(all[0].j); nearDist.push(all[0].d);
    const d = all.slice(0, 3).map((x) => x.d);
    return d.reduce((s, v) => s + v, 0) / Math.max(1, d.length);
  });
  const maxNov = Math.max(1e-9, ...nov);
  const adj = fit.map((f, i) => f + cfg.diversityWeight * (nov[i] / maxNov));
  const order = fit.map((_, i) => i).sort((a, b) => fit[b] - fit[a]);
  const elites = order.slice(0, Math.min(cfg.eliteCount, n));
  const survivorTarget = Math.max(2, Math.ceil(n * cfg.survivalRate));
  const survivors = new Set<number>(elites);
  const tour = () => { let b = rng.int(n); for (let k = 1; k < cfg.tournamentSize; k++) { const c = rng.int(n); if (adj[c] > adj[b]) b = c; } return b; };
  for (let guard = 0; survivors.size < survivorTarget && guard < n * 20; guard++) survivors.add(tour());
  const sv = [...survivors];
  const ids = prev.ids ?? pop.map((_, i) => i); let nextId = prev.nextId ?? pop.length;
  const parents: Record<number, [number, number]> = { ...(prev.parents ?? {}) };
  const next: G[] = elites.map((i) => structuredClone(pop[i])), nextIds: number[] = elites.map((i) => ids[i]);
  if (best && cfg.eliteCount > 0 && !elites.some((i) => fit[i] >= best!.fitness)) { next[next.length - 1] = structuredClone(best.genome); nextIds[nextIds.length - 1] = nextId++; } // verified best is never lost
  while (next.length < cfg.popSize) {
    const ia = rng.pick(sv), ib = rng.pick(sv);
    next.push(ops.mutate(ops.crossover(pop[ia], pop[ib], rng), rng, cfg.mutationRate));
    parents[nextId] = [ids[ia], ids[ib]]; nextIds.push(nextId++);
  }
  const rankOf = new Map(order.map((i, r) => [i, r] as const));
  const culls: Cull<G>[] = pop.map((g, i) => ({ id: ids[i], genome: structuredClone(g), fitness: fit[i], rank: rankOf.get(i)!, nearestId: ids[nearIdx[i]], nearest: nearDist[i] })).filter((_, i) => !survivors.has(i));
  const keep = new Set(nextIds); for (const k of Object.keys(parents)) if (Number(k) < nextId - 400 && !keep.has(Number(k))) delete parents[Number(k)];
  return {
    generation: prev.generation + 1, population: next, fitness: fit, rngState: rng.state, best, ids: nextIds, nextId, parents, culls,
    meanFitness: fit.reduce((s, v) => s + v, 0) / n, diversity: nov.reduce((s, v) => s + v, 0) / n, eliminated: n - survivors.size,
  };
}
