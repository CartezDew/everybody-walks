// Charts for the "More signals" section: each one answers a yes/no question for
// staff ("is this a useful outreach trigger?") and states its verdict up front.
import { useState } from 'react';
import { useInView, useTip, useWidth, statRows, rateFill, TipBody } from './charts.jsx';
import { pct, num, MIN_N } from '../lib/data.js';
import './signal-charts.css';

const live = (rows) => rows.filter((r) => r.n > 0);
const overlaps = (a, b) => a.ci[0] <= b.ci[1] && b.ci[0] <= a.ci[1];

// ---------- verdicts (plain-language answers, computed from the current filter) ----------
function weightedR(rows, xOf) {
  const W = rows.reduce((s, r) => s + r.n, 0);
  const mx = rows.reduce((s, r) => s + r.n * xOf(r), 0) / W;
  const my = rows.reduce((s, r) => s + r.n * r.dropRate, 0) / W;
  let sxy = 0, sxx = 0, syy = 0;
  rows.forEach((r) => {
    const dx = xOf(r) - mx, dy = r.dropRate - my;
    sxy += r.n * dx * dy; sxx += r.n * dx * dx; syy += r.n * dy * dy;
  });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

export function unempVerdict(rows) {
  const pts = live(rows);
  if (pts.length < 3) return { tone: 'neutral', label: 'Too few groups', text: 'This selection has too few entry cohorts to compare. Clear a filter to see the pattern.' };
  const r = weightedR(pts, (p) => p.key);
  const lo = pts.reduce((a, b) => (b.dropRate < a.dropRate ? b : a));
  const hi = pts.reduce((a, b) => (b.dropRate > a.dropRate ? b : a));
  const range = `Dropout ranged from ${pct(lo.dropRate, 0)} (${lo.label} unemployment) to ${pct(hi.dropRate, 0)} (${hi.label})`;
  if (Math.abs(r) < 0.4) return { tone: 'neutral', label: 'Not a useful trigger', text: `${range}, with no steady rise as unemployment climbed. The economy at entry does not tell advisors which students to contact.` };
  return r > 0
    ? { tone: 'signal', label: 'Rises with unemployment', text: `${range}. Dropout tended to be higher when students entered during weaker job markets. Treat this as context, not as a reason to contact an individual student.` }
    : { tone: 'neutral', label: 'Falls with unemployment', text: `${range}. Dropout tended to be lower when unemployment was high. Treat this as context, not as an outreach trigger.` };
}

export function maritalVerdict(rows, overall) {
  const pts = live(rows);
  const total = pts.reduce((s, r) => s + r.dropouts, 0);
  const readable = pts.filter((r) => r.n >= MIN_N);
  if (readable.length < 2 || !total) return { tone: 'neutral', label: 'Too few groups', text: 'Fewer than two groups have enough students in this selection to compare.' };
  const reach = readable.reduce((a, b) => (b.dropouts > a.dropouts ? b : a));
  const rate = readable.reduce((a, b) => (b.dropRate > a.dropRate ? b : a));
  const small = pts.filter((r) => r.n < MIN_N).length;
  const smallNote = small ? ` ${small} group${small > 1 ? 's are' : ' is'} too small to read and shown faded.` : '';
  if (reach.key === rate.key) return { tone: 'signal', label: 'Highest rate and reach', text: `${reach.label} students had both the highest dropout rate (${pct(reach.dropRate, 0)}) and the most departures (${num(reach.dropouts)}).${smallNote}` };
  return {
    tone: 'mixed', label: 'Highest rate ≠ most departures',
    text: `${rate.label} students left at ${pct(rate.dropRate, 0)}, above the ${pct(overall, 0)} cohort rate. But ${reach.label.toLowerCase()} students made up ${pct(reach.dropouts / total, 0)} of all departures (${num(reach.dropouts)} of ${num(total)}). Outreach based on marital status alone would miss most students who leave.${smallNote}`,
  };
}

export function gapVerdict(sections) {
  const parts = sections.map(({ title, rows }) => {
    const [a, b] = rows;
    if (!a?.n || !b?.n) return { title, clear: false, empty: true };
    return { title, clear: !overlaps(a, b), a, b };
  });
  const usable = parts.filter((p) => !p.empty);
  if (!usable.length) return { tone: 'neutral', label: 'No comparison', text: 'One side of each comparison has no students in this selection.' };
  const clear = usable.filter((p) => p.clear);
  const describe = (p) => `${p.a.label} ${pct(p.a.dropRate, 0)} vs. ${p.b.label.toLowerCase()} ${pct(p.b.dropRate, 0)}`;
  if (!clear.length) return { tone: 'neutral', label: 'Within margin of error', text: `${usable.map(describe).join('; ')}. The 95% ranges overlap, so these differences could be chance. They offer no basis on their own for prioritizing outreach.` };
  return { tone: 'signal', label: 'A real gap', text: `${clear.map(describe).join('; ')}. The 95% ranges do not overlap in ${clear.map((p) => p.title.toLowerCase()).join(' and ')}, so the gap is unlikely to be chance.` };
}

export function Verdict({ tone, label }) {
  return <div className={`sig-verdict tone-${tone}`}><i aria-hidden="true" /><span>Verdict</span><b>{label}</b></div>;
}

// ---------- Unemployment: dropout rate per entry cohort, ordered by national unemployment ----------
export function UnemploymentChart({ rows, overall }) {
  const [wref, width] = useWidth();
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  const [active, setActive] = useState(null);
  const pts = live(rows).sort((a, b) => a.key - b.key);
  const narrow = width < 440;
  const h = narrow ? 250 : 290;
  const m = { l: 38, r: narrow ? 10 : 16, t: 28, b: 46 };
  if (!pts.length) return <div ref={(el) => { wref.current = el; ref.current = el; wrap.current = el; }} className="sig-empty">No students in this selection.</div>;

  const x0 = Math.floor(pts[0].key) - 0.5, x1 = Math.ceil(pts[pts.length - 1].key) + 0.5;
  const step = narrow ? 0.2 : 0.1;
  const maxY = Math.min(1, Math.ceil((Math.max(overall, ...pts.map((p) => p.ci[1])) + 0.04) / step) * step);
  const x = (v) => m.l + ((v - x0) / (x1 - x0)) * (width - m.l - m.r);
  const y = (v) => m.t + (1 - v / maxY) * (h - m.t - m.b);
  const yt = []; for (let t = 0; t <= maxY + 1e-9; t += step) yt.push(+t.toFixed(2));
  const xt = []; for (let t = Math.ceil(x0); t <= x1; t += narrow ? 4 : 2) xt.push(t);
  const lo = pts.reduce((a, b) => (b.dropRate < a.dropRate ? b : a));
  const hi = pts.reduce((a, b) => (b.dropRate > a.dropRate ? b : a));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.key)},${y(p.dropRate)}`).join(' ');
  const mids = pts.map((p, i) => [i ? (x(pts[i - 1].key) + x(p.key)) / 2 : m.l, i < pts.length - 1 ? (x(p.key) + x(pts[i + 1].key)) / 2 : width - m.r]);
  const tipFor = (p) => <TipBody title={`${p.label} national unemployment`} rows={statRows(p)} warn={p.n < MIN_N} />;

  return (
    <div className="sig-unemp" ref={(el) => { wref.current = el; ref.current = el; wrap.current = el; }}>
      <svg width={width} height={h} role="img" aria-label={`Dropout rate for ${pts.length} entry cohorts by national unemployment rate. Lowest ${pct(lo.dropRate, 0)} at ${lo.label}, highest ${pct(hi.dropRate, 0)} at ${hi.label}.`}>
        <text x={m.l - 30} y={12} className="axis-t">Dropout rate</text>
        {yt.map((t) => <g key={t}>
          <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="gl" />
          <text x={m.l - 8} y={y(t) + 4} className="tick" textAnchor="end">{pct(t, 0)}</text>
        </g>)}
        {xt.map((t) => <text key={t} x={x(t)} y={h - m.b + 18} className="tick" textAnchor="middle">{t}%</text>)}
        <text x={(width + m.l) / 2} y={h - 6} className="axis-t" textAnchor="middle">{narrow ? 'Unemployment when student enrolled' : 'National unemployment rate when the student enrolled'}</text>

        <line x1={m.l} x2={width - m.r} y1={y(overall)} y2={y(overall)} className="refline" />

        <path d={line} className={`sig-line${inView ? ' in' : ''}`} pathLength="1" />
        {pts.map((p, i) => {
          const on = active === p.key;
          const small = p.n < MIN_N;
          const labelled = on || p === hi || p === lo;
          const below = p === lo && !on;
          return <g key={p.key} className={`sig-pt${on ? ' on' : ''}${active != null && !on ? ' dim' : ''}`} style={{ opacity: inView ? undefined : 0, transitionDelay: `${300 + i * 60}ms` }}>
            <line x1={x(p.key)} x2={x(p.key)} y1={y(p.ci[0])} y2={y(p.ci[1])} className="sig-ci" />
            <circle cx={x(p.key)} cy={y(p.dropRate)} r={on ? 7 : 5.5} fill={small ? 'var(--surface)' : rateFill(p, overall)} stroke={small ? 'var(--muted)' : 'var(--surface)'} strokeWidth="2" />
            {labelled && <text x={x(p.key)} y={below ? y(p.ci[0]) + 15 : y(p.ci[1]) - 8} className="sig-pt-label" textAnchor="middle">{pct(p.dropRate, 0)}</text>}
          </g>;
        })}
        {pts.map((p, i) => <rect key={`hit-${p.key}`} className="sig-hit" x={mids[i][0]} width={Math.max(1, mids[i][1] - mids[i][0])} y={m.t} height={h - m.t - m.b}
          tabIndex={0} aria-label={`${p.label} unemployment: ${pct(p.dropRate)} dropout, ${num(p.dropouts)} of ${num(p.n)} students`}
          onMouseMove={(e) => { setActive(p.key); show(e, tipFor(p)); }} onMouseLeave={() => { setActive(null); hide(); }}
          onFocus={(e) => { setActive(p.key); show(e, tipFor(p)); }} onBlur={() => { setActive(null); hide(); }}
          onClick={(e) => { setActive(p.key); show(e, tipFor(p)); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setActive(null); hide(); } }} />)}
      </svg>
      <div className="rate-key">
        <span><i className="key-above" />Above cohort rate</span>
        <span><i className="key-below" />At or below</span>
        <span className="key-baseline">Cohort rate <b>{pct(overall)}</b></span>
        <span>Vertical lines show 95% ranges · each dot is one entry cohort</span>
      </div>
      {node}
    </div>
  );
}

// ---------- Rate vs reach rows: how often a group leaves, and how many of all departures it accounts for ----------
export function RateReachRows({ sections, overall, reach = true }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className={`sig-rows${reach ? '' : ' no-reach'}`} ref={(el) => { ref.current = el; wrap.current = el; }}>
      <div className="sig-row sig-axis" aria-hidden="true">
        <span className="sig-l" />
        <span className="sig-track">
          {ticks.map((t) => <em key={t} style={{ left: `${t * 100}%` }}>{pct(t, 0)}</em>)}
          <b style={{ left: `${overall * 100}%` }}>Cohort {pct(overall, 0)}</b>
        </span>
        <span className="sig-v">Rate</span>
        {reach && <span className="sig-reach">Share of departures</span>}
      </div>
      {sections.map(({ title, rows }) => {
        const total = rows.reduce((s, r) => s + r.dropouts, 0);
        return <div className="sig-group" key={title || 'rows'} role="list" aria-label={title || 'Groups'}>
          {title && <div className="sig-group-h">{title}</div>}
          {rows.map((d, i) => {
            const small = d.n > 0 && d.n < MIN_N;
            const share = total ? d.dropouts / total : 0;
            const tip = <TipBody title={d.label} rows={[...statRows(d), ...(d.n ? [['Share of departures', pct(share)]] : [])]} warn={small} />;
            return <div key={d.key} role="listitem" tabIndex={0}
              className={`sig-row${small ? ' small' : ''}${!d.n ? ' empty' : ''}`}
              aria-label={d.n ? `${d.label}: ${pct(d.dropRate)} dropout, 95% range ${pct(d.ci[0])} to ${pct(d.ci[1])}. ${num(d.dropouts)} of ${num(d.n)} students left, ${pct(share)} of departures${small ? '. Too few students to read reliably' : ''}` : `${d.label}: no students`}
              onMouseMove={(e) => show(e, tip)} onMouseLeave={hide} onFocus={(e) => show(e, tip)} onBlur={hide}
              onClick={(e) => show(e, tip)} onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}>
              <span className="sig-l"><b>{d.label}</b><small>{num(d.n)} students{small ? ' · too few to read' : ''}</small></span>
              <span className="sig-track">
                {ticks.slice(1, -1).map((t) => <i key={t} className="sig-grid" style={{ left: `${t * 100}%` }} />)}
                <i className="sig-cohort" style={{ left: `${overall * 100}%` }} />
                {d.n > 0 && <>
                  <i className="sig-range" style={{ left: `${d.ci[0] * 100}%`, width: inView ? `${(d.ci[1] - d.ci[0]) * 100}%` : 0 }} />
                  <i className="sig-dot" style={{ left: inView ? `${d.dropRate * 100}%` : `${overall * 100}%`, background: small ? 'var(--surface)' : rateFill(d, overall), transitionDelay: `${i * 50}ms` }} />
                </>}
              </span>
              <span className="sig-v">{d.n ? pct(d.dropRate, 0) : '–'}</span>
              {reach && <span className="sig-reach">
                <span className="sig-reach-bar"><i style={{ width: inView ? `${share * 100}%` : 0, transitionDelay: `${i * 50}ms` }} /></span>
                <small><b>{num(d.dropouts)}</b> left · {pct(share, 0)}</small>
              </span>}
            </div>;
          })}
        </div>;
      })}
      <div className="rate-key">
        <span><i className="key-above" />Above cohort rate</span>
        <span><i className="key-below" />At or below</span>
        <span><i className="key-small" />Too few students (&lt;{MIN_N})</span>
        <span>Bands show 95% ranges</span>
      </div>
      {node}
    </div>
  );
}
