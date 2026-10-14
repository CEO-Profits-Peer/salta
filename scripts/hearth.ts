import { createSim } from '../src/hearth/world';
import { stepSim } from '../src/hearth/sim';
import { YEAR, CAUSES, GENES } from '../src/hearth/types';
const seeds = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3];
const years = Number(process.argv[3] ?? 10);
for (const seed of seeds) {
  const sim = createSim(seed), t0 = Date.now(); const line: string[] = [];
  for (let y = 1; y <= years; y++) { stepSim(sim, YEAR); line.push(`${sim.settlers.length}(${sim.villages.filter((v) => v.alive).length}v)`); }
  const g = GENES.map((k) => (sim.settlers.reduce((a, s) => a + s.genes[k], 0) / Math.max(1, sim.settlers.length)).toFixed(2)).join(' ');
  console.log(`seed ${seed}: pop by year ${line.join(' ')} | births ${sim.totals.births} | deaths ${CAUSES.map((c) => `${c}:${sim.totals.deaths[c]}`).join(' ')} | builds ${sim.totals.builds} founded ${sim.totals.founded} fell ${sim.totals.fell} | deer ${sim.deer.length} wolves ${sim.wolves.length} | genes ${g} | ${Date.now() - t0}ms`);
}
