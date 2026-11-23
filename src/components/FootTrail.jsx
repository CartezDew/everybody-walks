// Decorative trail of footsteps that "walks" toward a graduation cap when it scrolls into view.
// Sits behind section content (aria-hidden); each section gets its own path shape.
import { useInView } from './charts';
import './foot-trail.css';

const SOLE = [
  'M1.1 9.6C1.2 4.3 4.2.5 8.2.6c4.5.1 6.2 3.9 5.6 8.1L9 10.3 5.8 8.5Z',
  'm1 11.6 4.5-1.3 3.2 1.9 4.6-1.6-.9 4-4.4 1.2-3-1.8-3.7 1Z',
  'm1.7 16.9 3.2-.9 3 1.8 3.8-1.1-1.7 4.1-3 .7-4.1-2.3Z',
  'm2.7 22.6 4.1 2.1 2.3-.6-1.3 4.4c-.7 2.2-2.8 2.8-4.9 1.8-2.1-1-2.5-2.5-1.6-5Z',
];

// Cubic bezier point and tangent.
const bez = (p, t) => {
  const u = 1 - t;
  const pt = (i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
  const d = (i) => 3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i]);
  return [pt(0), pt(1), d(0), d(1)];
};

// Paths run left to right across a wide, short box beside each section heading.
const PATHS = {
  rise: [[150, 200], [280, 210], [380, 40], [560, 60]],
  sweep: [[150, 60], [290, -10], [380, 210], [560, 150]],
  wander: [[150, 150], [250, 30], [420, 230], [560, 50]],
};

export default function FootTrail({ shape = 'rise', steps = 10, className = '' }) {
  const [ref, inView] = useInView({ threshold: 0.05 });
  const p = PATHS[shape];
  const pts = Array.from({ length: steps }, (_, i) => {
    const [x, y, dx, dy] = bez(p, (i + 0.5) / steps);
    const len = Math.hypot(dx, dy) || 1;
    const side = i % 2 ? 1 : -1;
    const ox = (-dy / len) * 9 * side, oy = (dx / len) * 9 * side;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    return { x: x + ox, y: y + oy, angle, mirror: side > 0 };
  });
  const [ex, ey, edx, edy] = bez(p, 1);
  const elen = Math.hypot(edx, edy) || 1;
  const cap = { x: ex + (edx / elen) * 34, y: ey + (edy / elen) * 34 };
  return (
    <svg ref={ref} className={`foot-trail ${className}${inView ? ' walk' : ''}`} viewBox="0 0 620 230" aria-hidden="true" focusable="false">
      {pts.map((s, i) => (
        <g key={i} className="ft-step" style={{ '--i': i }}
          transform={`translate(${s.x} ${s.y}) rotate(${s.angle}) scale(${s.mirror ? -0.9 : 0.9} 0.9) translate(-7 -15)`}>
          {SOLE.map((d) => <path key={d} d={d} />)}
        </g>
      ))}
      <g className="ft-cap" style={{ '--i': steps }} transform={`translate(${cap.x} ${cap.y})`}>
        <path d="M-22 0 0-10 22 0 0 10Z" />
        <path d="M-12 5v9c6 5 18 5 24 0V5L0 10Z" />
        <path d="M18 2v12" fill="none" strokeWidth="2" stroke="currentColor" />
        <circle cx="18" cy="16" r="2.5" />
      </g>
    </svg>
  );
}
