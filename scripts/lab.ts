import { newLab, labTick, describeSpec, proposalScore } from '../src/hearth/lab';
let lab = newLab(5);
for (const t of ['creature', 'building', 'quirk'] as const) { const t0 = Date.now(); lab = labTick(lab, t); console.log(t, 'tick', Date.now() - t0, 'ms'); }
for (const p of lab.library) console.log(p.spec.t.padEnd(8), p.spec.s.name.padEnd(22), p.info.approved ? 'OK ' : 'no ', p.info.score.toFixed(2), `pop×${p.info.popRatio.toFixed(2)} uptake ${p.info.uptake.toFixed(2)}`, p.info.reasons[0] ?? '', '|', describeSpec(p.spec).slice(0, 70));
console.log('culls:'); lab.culls.slice(-6).forEach((c) => console.log(' ', c.type, c.who, '->', c.reason));
