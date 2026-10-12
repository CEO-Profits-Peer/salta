import { motion } from 'framer-motion';
import { CH } from './ui';

/** Hero visual: three chambers and the data flow between them. Links animate only while a real experiment is running. */
export function ChamberGraph({ active }: { active: boolean }) {
  const nodes = [{ k: 'tester', x: 90, y: 190 }, { k: 'builder', x: 330, y: 70 }, { k: 'instructor', x: 570, y: 190 }] as const;
  const links = [[0, 1], [1, 2], [2, 0]];
  return (
    <svg viewBox="0 0 660 280" className="w-full" role="img" aria-label="Tester, Builder and Instructor chambers connected in a loop">
      <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff" stopOpacity=".18" /><stop offset="100%" stopOpacity="0" /></radialGradient></defs>
      {links.map(([a, b], i) => (<line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={active ? '#22d3ee' : '#2a3347'} strokeWidth="1.5" className={active ? 'flow' : ''} opacity={active ? 0.8 : 0.9} />))}
      {nodes.map((n, i) => { const c = CH[n.k].color; return (
        <motion.g key={n.k} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r="58" fill="url(#g)" />
          <circle cx={n.x} cy={n.y} r="34" fill="#0a0d13" stroke={c} strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r="7" fill={c} className={active ? 'pulse-dot' : ''} style={{ color: c }} />
          {[0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 + i; return <circle key={k} cx={n.x + Math.cos(a) * 24} cy={n.y + Math.sin(a) * 24} r="2" fill={c} opacity=".55" />; })}
          <text x={n.x} y={n.y + 60} textAnchor="middle" fill="#cbd5e1" fontSize="12" letterSpacing="2">{CH[n.k].label.replace(' Chamber', '').toUpperCase()}</text>
        </motion.g>); })}
    </svg>
  );
}
