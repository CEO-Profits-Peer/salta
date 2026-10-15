import { createSim } from '../src/hearth/world';
import { stepSim } from '../src/hearth/sim';
import { YEAR, CAUSES, GENES } from '../src/hearth/types';
const seeds = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3];
const years = Number(process.argv[3] ?? 10);
for (const seed of seeds) {
  const sim = createSim(seed), t0 = Date.now(); const line: string[] = [];
  for (let y = 1; y <= years; y++) { stepSim(sim, YEAR); line.push(`${sim.settlers.length}(${sim.villages.filter((v) => v.alive).length}v)`); }
  const g = GENES.map((k) => (sim.settlers.reduce((a, s) => a + s.genes[k], 0) / Math.max(1, sim.settlers.length)).toFixed(2)).join(' ');
  const techs = sim.villages.filter((v) => v.alive).map((v) => v.techs.length).join(',');
  console.log(`seed ${seed}: pop ${line.join(' ')} | births ${sim.totals.births} | deaths ${CAUSES.map((c) => `${c}:${sim.totals.deaths[c]}`).join(' ')} | trades ${sim.totals.trades} raids ${sim.totals.raids} inventions ${sim.totals.inventions} techs/v ${techs} | builds ${sim.totals.builds} founded ${sim.totals.founded} fell ${sim.totals.fell} | deer ${sim.deer.length} rabbit ${sim.fauna.filter((a) => a.k === 'rabbit').length} boar ${sim.fauna.filter((a) => a.k === 'boar').length} bear ${sim.fauna.filter((a) => a.k === 'bear').length} wolves ${sim.wolves.length} | genes ${g} | ${Date.now() - t0}ms`);
}
