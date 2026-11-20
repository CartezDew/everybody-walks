import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { pct, num, MIN_N } from '../lib/data.js';

// ---------- shared hooks ----------
export function useInView(options = { threshold: 0.2 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return setInView(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Tooltip that follows the pointer within a relative container.
function useTip() {
  const [tip, setTip] = useState(null);
  const wrap = useRef(null);
  const show = (e, content) => {
    const r = wrap.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    setTip({ x, y, content, flip: x > r.width * 0.6 });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      className="tip"
      role="status"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, -50%)` }}
    >
      {tip.content}
    </div>
  ) : null;
  return { wrap, show, hide, node };
}

export function TipBody({ title, rows, warn }) {
  return (
    <>
      <div className="tip-title">{title}</div>
      {rows.map(([k, v]) => (
        <div className="tip-row" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
      {warn && <div className="tip-warn">⚠ Fewer than {MIN_N} students: rate is unstable</div>}
    </>
  );
}

const statRows = (d) => [
  ['Students', num(d.n)],
  ['Dropouts', num(d.dropouts)],
  ['Dropout rate', pct(d.dropRate)],
  ['95% interval', `${pct(d.ci[0])} – ${pct(d.ci[1])}`],
  ['Graduates', `${num(d.graduates)} (${pct(d.gradRate)})`],
  ['Still enrolled', `${num(d.enrolled)} (${pct(d.enrRate)})`],
];

// ---------- Donut ----------
export function Donut({ segments, total, centerLabel, centerValue }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  const R = 80;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap" ref={(el) => { ref.current = el; wrap.current = el; }}>
      <svg viewBox="0 0 200 200" className="donut" role="img" aria-label={segments.map((s) => `${s.label} ${pct(s.value / total)}`).join(', ')}>
        <circle cx="100" cy="100" r={R} className="donut-track" />
        {segments.map((s, i) => {
          const frac = total ? s.value / total : 0;
          const gap = frac > 0.01 ? 2.5 : 0;
          const len = Math.max(0, frac * C - gap);
          const off = acc;
          acc += frac * C;
          return (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={R}
              className="donut-seg"
              style={{
                stroke: s.color,
                strokeDasharray: `${inView ? len : 0} ${C}`,
                strokeDashoffset: -off,
                transitionDelay: `${i * 120}ms`,
              }}
              onMouseMove={(e) => show(e, <TipBody title={s.label} rows={[['Students', num(s.value)], ['Share', pct(frac)]]} />)}
              onMouseLeave={hide}
              onClick={(e) => show(e, <TipBody title={s.label} rows={[['Students', num(s.value)], ['Share', pct(frac)]]} />)}
            />
          );
        })}
        <text x="100" y="96" className="donut-value">{centerValue}</text>
        <text x="100" y="120" className="donut-label">{centerLabel}</text>
      </svg>
      <ul className="legend legend-col">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="sw" style={{ background: s.color }} />
            <span className="lg-name">{s.label}</span>
            <span className="lg-val">{pct(total ? s.value / total : 0)}</span>
            <span className="lg-n">{num(s.value)}</span>
          </li>
        ))}
      </ul>
      {node}
    </div>
  );
}

// ---------- Horizontal rate bars with 95% CI whiskers and overall reference ----------
export function RateBars({ rows, overall, max = 1, showShare = false, color = 'var(--drop)', onSelect, selected }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  return (
    <div className="ratebars" ref={(el) => { ref.current = el; wrap.current = el; }}>
      {rows.map((d, i) => {
        const small = d.n < MIN_N;
        const w = (d.dropRate / max) * 100;
        const tip = <TipBody title={d.label} rows={[...statRows(d), ...(showShare ? [['Share of all dropouts', pct(d.share)]] : [])]} warn={small} />;
        return (
          <div
            className={`rb-row${onSelect ? ' clickable' : ''}${selected === d.key ? ' sel' : ''}${small ? ' small' : ''}`}
            key={`${i}-${d.key}`}
            onMouseMove={(e) => show(e, tip)}
            onMouseLeave={hide}
            onClick={(e) => (onSelect ? onSelect(d.key) : show(e, tip))}
            tabIndex={0}
            aria-label={`${d.label}: ${pct(d.dropRate)} dropout, ${num(d.n)} students`}
          >
            <div className="rb-label">
              <span>{d.label}</span>
              <span className="rb-n">n={num(d.n)}{small ? ' ⚠' : ''}</span>
            </div>
            <div className="rb-track">
              <div
                className="rb-bar"
                style={{ width: inView ? `${w}%` : 0, background: color, transitionDelay: `${i * 60}ms`, opacity: small ? 0.45 : 1 }}
              />
              {d.n > 0 && (
                <div
                  className="rb-ci"
                  style={{ left: `${(d.ci[0] / max) * 100}%`, width: `${((d.ci[1] - d.ci[0]) / max) * 100}%`, opacity: inView ? 1 : 0 }}
                />
              )}
              {overall != null && <div className="rb-ref" style={{ left: `${(overall / max) * 100}%` }} />}
            </div>
            <div className="rb-val">
              {d.n ? pct(d.dropRate) : '–'}
              {showShare && d.n > 0 && <span className="rb-share">{pct(d.share, 0)} of dropouts</span>}
            </div>
          </div>
        );
      })}
      {overall != null && (
        <div className="rb-foot">
          <span className="ref-key" /> Overall rate for current selection: {pct(overall)} · whiskers show 95% intervals
        </div>
      )}
      {node}
    </div>
  );
}

// ---------- Column chart of dropout rate ----------
export function Columns({ rows, max = 1, overall, xLabel }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  const ticks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= max + 0.001);
  return (
    <div className="cols-wrap" ref={(el) => { ref.current = el; wrap.current = el; }}>
      <div className="cols">
        <div className="cols-grid">
          {ticks.map((t) => (
            <div key={t} className="grid-line" style={{ bottom: `${(t / max) * 100}%` }}>
              <span>{pct(t, 0)}</span>
            </div>
          ))}
          {overall != null && <div className="col-ref" style={{ bottom: `${(overall / max) * 100}%` }}><span>avg {pct(overall, 0)}</span></div>}
        </div>
        {rows.map((d, i) => {
          const small = d.n < MIN_N;
          const tip = <TipBody title={d.label} rows={statRows(d)} warn={small} />;
          return (
            <div
              className="col"
              key={d.key}
              onMouseMove={(e) => show(e, tip)}
              onMouseLeave={hide}
              onClick={(e) => show(e, tip)}
              tabIndex={0}
              aria-label={`${d.label}: ${pct(d.dropRate)} dropout of ${num(d.n)}`}
            >
              <div className="col-area">
                <div
                  className="col-bar"
                  style={{ height: inView ? `${(d.dropRate / max) * 100}%` : 0, transitionDelay: `${i * 80}ms`, opacity: small ? 0.45 : 1, background: d.color || 'var(--drop)' }}
                >
                  <span className="col-val">{d.n ? pct(d.dropRate, 0) : '–'}</span>
                </div>
              </div>
              <div className="col-label">{d.label}</div>
              <div className="col-n">n={num(d.n)}{small ? ' ⚠' : ''}</div>
            </div>
          );
        })}
      </div>
      {xLabel && <div className="axis-title">{xLabel}</div>}
      {node}
    </div>
  );
}

// ---------- 100% stacked outcome bars ----------
export function StackedOutcomes({ rows, colors, names }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  return (
    <div className="stacked" ref={(el) => { ref.current = el; wrap.current = el; }}>
      <ul className="legend legend-row">
        {names.map((n, i) => (
          <li key={n}><span className="sw" style={{ background: colors[i] }} />{n}</li>
        ))}
      </ul>
      {rows.map((d) => {
        const vals = [d.dropouts, d.enrolled, d.graduates];
        return (
          <div className="st-row" key={d.key}>
            <div className="st-label">{d.label}<span className="rb-n">n={num(d.n)}</span></div>
            <div className="st-track">
              {vals.map((v, i) => {
                const f = d.n ? v / d.n : 0;
                return (
                  <div
                    key={i}
                    className="st-seg"
                    style={{ width: inView ? `${f * 100}%` : 0, background: colors[i] }}
                    onMouseMove={(e) => show(e, <TipBody title={`${d.label} · ${names[i]}`} rows={[['Students', num(v)], ['Share of group', pct(f)]]} warn={d.n < MIN_N} />)}
                    onMouseLeave={hide}
                    onClick={(e) => show(e, <TipBody title={`${d.label} · ${names[i]}`} rows={[['Students', num(v)], ['Share of group', pct(f)]]} />)}
                  >
                    {f > 0.09 && <span>{pct(f, 0)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {node}
    </div>
  );
}

// ---------- Heatmap of dropout rate ----------
const RAMP = ['#fde6da', '#fbc4a6', '#f59b70', '#eb6834', '#c24e1d', '#8a3210'];
export const rampColor = (v) => RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];

export function Heatmap({ rowLabels, colLabels, cells, rowTitle, colTitle }) {
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  return (
    <div className="heat-wrap" ref={(el) => { ref.current = el; wrap.current = el; }}>
      <div className="heat-coltitle">{colTitle}</div>
      <div className="heat" style={{ gridTemplateColumns: `minmax(90px, 1.2fr) repeat(${colLabels.length}, 1fr)` }}>
        <div className="heat-corner">{rowTitle}</div>
        {colLabels.map((c) => <div key={c} className="heat-h">{c}</div>)}
        {rowLabels.map((r, ri) => (
          <div className="heat-r" key={r} style={{ display: 'contents' }}>
            <div className="heat-rh">{r}</div>
            {cells[ri].map((c, ci) => {
              const small = c.n < MIN_N;
              const dark = c.dropRate >= 0.5;
              const tip = <TipBody title={`${r} · ${colLabels[ci]}`} rows={statRows(c)} warn={small} />;
              return (
                <div
                  key={ci}
                  className={`heat-c${small ? ' small' : ''}`}
                  style={{
                    background: c.n ? rampColor(c.dropRate) : 'var(--surface-2)',
                    color: dark ? '#fff' : '#0b0b0b',
                    transform: inView ? 'scale(1)' : 'scale(.6)',
                    opacity: inView ? 1 : 0,
                    transitionDelay: `${(ri * colLabels.length + ci) * 50}ms`,
                  }}
                  onMouseMove={(e) => show(e, tip)}
                  onMouseLeave={hide}
                  onClick={(e) => show(e, tip)}
                  tabIndex={0}
                  aria-label={`${r}, ${colLabels[ci]}: ${pct(c.dropRate)} dropout of ${c.n}`}
                >
                  <b>{c.n ? pct(c.dropRate, 0) : '–'}</b>
                  <small>n={num(c.n)}</small>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="heat-scale">
        <span>0%</span>
        {RAMP.map((c) => <i key={c} style={{ background: c }} />)}
        <span>100% dropout</span>
      </div>
      {node}
    </div>
  );
}

// ---------- Course scatter: size vs dropout rate (linked to the course filter) ----------
export function CourseScatter({ rows, overall, selected, onSelect }) {
  const [wref, width] = useWidth();
  const [ref, inView] = useInView();
  const { wrap, show, hide, node } = useTip();
  const h = Math.max(280, Math.min(400, width * 0.6));
  const m = { l: 44, r: 16, t: 14, b: 40 };
  const maxN = Math.max(100, ...rows.map((d) => d.n)) * 1.08;
  const maxY = Math.min(1, Math.max(0.6, ...rows.map((d) => d.dropRate)) + 0.08);
  const x = (v) => m.l + (v / maxN) * (width - m.l - m.r);
  const y = (v) => m.t + (1 - v / maxY) * (h - m.t - m.b);
  const r = (k) => 4 + Math.sqrt(k) * 1.1;
  const yt = [0, 0.2, 0.4, 0.6, 0.8, 1].filter((t) => t <= maxY);
  const xt = [0, 200, 400, 600, 800].filter((t) => t <= maxN);
  return (
    <div className="scatter" ref={(el) => { wref.current = el; ref.current = el; wrap.current = el; }}>
      <svg width={width} height={h} role="img" aria-label="Scatter of programs: number of students versus dropout rate">
        {yt.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="gl" />
            <text x={m.l - 8} y={y(t) + 4} className="tick" textAnchor="end">{pct(t, 0)}</text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={t} x={x(t)} y={h - m.b + 18} className="tick" textAnchor="middle">{t}</text>
        ))}
        <line x1={m.l} x2={width - m.r} y1={y(overall)} y2={y(overall)} className="refline" />
        <text x={width - m.r} y={y(overall) - 6} className="tick" textAnchor="end">overall {pct(overall, 0)}</text>
        <text x={(width + m.l) / 2} y={h - 4} className="axis-t" textAnchor="middle">Students in program</text>
        {[...rows].sort((a, b) => b.dropouts - a.dropouts).map((d, i) => {
          const sel = selected === d.key;
          const dim = selected !== 'All' && !sel;
          return (
            <circle
              key={d.key}
              cx={x(d.n)}
              cy={y(d.dropRate)}
              r={inView ? r(d.dropouts) : 0}
              className={`dot${sel ? ' sel' : ''}`}
              style={{ opacity: dim ? 0.25 : d.n < MIN_N ? 0.4 : 0.85, transitionDelay: `${i * 40}ms` }}
              onMouseMove={(e) => show(e, <TipBody title={d.label} rows={[...statRows(d), ['', 'Click to filter by this program']]} warn={d.n < MIN_N} />)}
              onMouseLeave={hide}
              onClick={() => onSelect(sel ? 'All' : d.key)}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? 'All' : d.key)}
              aria-label={`${d.label}: ${num(d.n)} students, ${pct(d.dropRate)} dropout, ${d.dropouts} dropouts`}
            />
          );
        })}
        {rows
          .filter((d) => selected === d.key || (width >= 520 ? d.dropouts >= 100 : selected === 'All' && d.dropouts >= [...rows].sort((a, b) => b.dropouts - a.dropouts)[1]?.dropouts))
          .map((d) => (
            <text key={d.key} x={x(d.n)} y={y(d.dropRate) - r(d.dropouts) - 5} className="dot-label" textAnchor="middle">
              {d.label.length > 22 ? d.label.slice(0, 20) + '…' : d.label}
            </text>
          ))}
        <text x={14} y={(h - m.b + m.t) / 2} className="axis-t" textAnchor="middle" transform={`rotate(-90 14 ${(h - m.b + m.t) / 2})`}>Dropout rate</text>
      </svg>
      <div className="rb-foot">Bubble size = number of dropouts · click a bubble to filter the whole dashboard</div>
      {node}
    </div>
  );
}

// ---------- Data table view (accessibility: every chart has one) ----------
export function DataTable({ rows, cols }) {
  return (
    <div className="table-scroll">
      <table className="dt">
        <thead>
          <tr>{cols.map((c) => <th key={c.k} className={c.num ? 'num' : ''}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.k} className={c.num ? 'num' : ''}>{c.f ? c.f(r) : r[c.k]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const rateCols = (labelHeader = 'Group') => [
  { k: 'label', h: labelHeader },
  { k: 'n', h: 'Students', num: true, f: (r) => num(r.n) },
  { k: 'dropouts', h: 'Dropouts', num: true, f: (r) => num(r.dropouts) },
  { k: 'dropRate', h: 'Dropout %', num: true, f: (r) => (r.n ? pct(r.dropRate) : '–') },
  { k: 'ci', h: '95% interval', num: true, f: (r) => (r.n ? `${pct(r.ci[0])}–${pct(r.ci[1])}` : '–') },
  { k: 'gradRate', h: 'Graduate %', num: true, f: (r) => (r.n ? pct(r.gradRate) : '–') },
];
