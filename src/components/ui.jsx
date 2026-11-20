import { useEffect, useRef, useState } from 'react';
import { DataTable } from './charts.jsx';
import { useInView } from './charts.jsx';

// ---------- Logo: an original teddy bear in a graduation cap ----------
export function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <circle cx="13.5" cy="20" r="5.5" fill="#8a5a3b" /><circle cx="13.5" cy="20" r="2.8" fill="#e3c39d" />
      <circle cx="34.5" cy="20" r="5.5" fill="#8a5a3b" /><circle cx="34.5" cy="20" r="2.8" fill="#e3c39d" />
      <circle cx="24" cy="28" r="13" fill="#8a5a3b" />
      <ellipse cx="24" cy="33" rx="6.2" ry="4.8" fill="#e3c39d" /><ellipse cx="24" cy="30.8" rx="2.5" ry="1.8" fill="#2b1a10" />
      <path d="M24 32.4v1.8M21.6 34.6c1.3 1.1 3.5 1.1 4.8 0" fill="none" stroke="#2b1a10" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="19" cy="25.5" r="1.7" fill="#2b1a10" /><circle cx="29" cy="25.5" r="1.7" fill="#2b1a10" />
      <path d="M16.5 15.5v3.6c0 1.6 3.4 2.7 7.5 2.7s7.5-1.1 7.5-2.7v-3.6z" fill="#001b4d" />
      <path d="M9 13.5 24 7l15 6.5L24 20z" fill="#001b4d" />
      <path d="M39 13.5v8" stroke="#f2a93b" strokeWidth="1.6" strokeLinecap="round" /><circle cx="39" cy="22.5" r="1.8" fill="#f2a93b" />
    </svg>
  );
}

// ---------- Animated ribbon (marquee of headline facts) ----------
export function Ribbon({ items }) {
  const list = [...items, ...items];
  return (
    <div className="ribbon" role="region" aria-label="Headline facts">
      <div className="ribbon-track">
        {list.map((t, i) => (
          <span key={i} className="ribbon-item" aria-hidden={i >= items.length}>
            <i className="ribbon-dot" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Count-up number ----------
export function CountUp({ value, format, duration = 1100 }) {
  const [ref, inView] = useInView();
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setV(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, inView]);
  return <span ref={ref}>{format(v)}</span>;
}

export function Kpi({ label, value, format, sub, accent }) {
  return (
    <div className="kpi" style={{ '--accent': accent }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value"><CountUp value={value} format={format} /></div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ---------- Card with chart / table toggle ----------
export function Card({ title, takeaway, children, table, note, wide, id }) {
  const [ref, inView] = useInView({ threshold: 0.08 });
  const [mode, setMode] = useState('chart');
  return (
    <article className={`card reveal${inView ? ' in' : ''}${wide ? ' wide' : ''}`} ref={ref} id={id}>
      <header className="card-h">
        <div>
          <h3>{title}</h3>
          {takeaway && <p className="takeaway">{takeaway}</p>}
        </div>
        {table && (
          <div className="seg" role="group" aria-label="View as">
            <button className={mode === 'chart' ? 'on' : ''} onClick={() => setMode('chart')} aria-pressed={mode === 'chart'}>Chart</button>
            <button className={mode === 'table' ? 'on' : ''} onClick={() => setMode('table')} aria-pressed={mode === 'table'}>Table</button>
          </div>
        )}
      </header>
      <div className="card-b">{mode === 'chart' || !table ? children : <DataTable {...table} />}</div>
      {note && <p className="card-note">{note}</p>}
    </article>
  );
}

export function Section({ id, kicker, title, intro, children }) {
  const [ref, inView] = useInView({ threshold: 0.05 });
  return (
    <section id={id} className="section" aria-labelledby={`${id}-h`}>
      <div className={`section-head reveal${inView ? ' in' : ''}`} ref={ref}>
        {kicker && <div className="kicker">{kicker}</div>}
        <h2 id={`${id}-h`}>{title}</h2>
        {intro && <p className="intro">{intro}</p>}
      </div>
      <div className="grid">{children}</div>
    </section>
  );
}

// ---------- Filters ----------
function Select({ label, value, options, onChange }) {
  return (
    <label className={`fl${value !== 'All' ? ' active' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o === 'All' ? `All` : o}</option>)}
      </select>
    </label>
  );
}

export function FilterBar({ filters, setFilters, defaults, options, n, total }) {
  const [open, setOpen] = useState(false);
  const active = Object.keys(filters).filter((k) => filters[k] !== 'All').length;
  const set = (k) => (v) => setFilters({ ...filters, [k]: v });
  return (
    <div className={`filterbar${open ? ' open' : ''}`}>
      <div className="fb-inner">
        <button className="fb-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12M4 8h8M6 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          Filters{active ? ` · ${active}` : ''}
        </button>
        <div className="fb-fields">
          <Select label="Program" value={filters.course} options={['All', ...options.courses]} onChange={set('course')} />
          <Select label="Gender" value={filters.gender} options={['All', 'Female', 'Male']} onChange={set('gender')} />
          <Select label="Age at entry" value={filters.age} options={['All', ...options.ages]} onChange={set('age')} />
          <Select label="Scholarship" value={filters.scholar} options={['All', 'Yes', 'No']} onChange={set('scholar')} />
          <Select label="Tuition" value={filters.tuition} options={['All', 'Up to date', 'Not up to date']} onChange={set('tuition')} />
          <Select label="Attendance" value={filters.attendance} options={['All', 'Daytime', 'Evening']} onChange={set('attendance')} />
        </div>
        <div className="fb-status">
          <span className="fb-count"><b>{n.toLocaleString()}</b> of {total.toLocaleString()} students</span>
          <button className="btn-ghost" onClick={() => setFilters(defaults)} disabled={!active}>Reset</button>
        </div>
      </div>
      {n > 0 && n < 30 && (
        <div className="fb-warn" role="alert">⚠ This selection has only {n} students. Rates below are unstable, so read them as directional only.</div>
      )}
      {n === 0 && <div className="fb-warn" role="alert">No students match this selection. Try removing a filter.</div>}
    </div>
  );
}
