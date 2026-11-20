import { useEffect, useRef, useState } from 'react';
import { DataTable } from './charts.jsx';
import { useInView } from './charts.jsx';

export function Logo({ size = 40 }) {
  return <img className="logo-mark" src="bear-head.png" width={size} height={size} alt="" />;
}

export function GraduationCap() {
  return <svg className="graduation-cap" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v5q6 5 12 0v-5m4-2v7"/>
  </svg>;
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

export function Kpi({ label, value, format, sub, accent, icon }) {
  return (
    <div className="kpi" style={{ '--accent': accent }}>
      <div className="kpi-label">{icon}{label}</div>
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
function Select({ label, allLabel, value, options, optionLabels = {}, onChange }) {
  return (
    <label className={`fl${value !== 'All' ? ' active' : ''}`}>
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">{allLabel}</option>
        {options.map(option => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}
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
          Cohort filters{active ? ` · ${active}` : ''}
        </button>
        <div className="fb-fields">
          <Select label="Academic program" allLabel="All programs" value={filters.course}
            options={options.courses} onChange={set('course')} />
          <Select label="Recorded gender" allLabel="All genders" value={filters.gender}
            options={['Female', 'Male']} optionLabels={{ Female: 'Female students', Male: 'Male students' }} onChange={set('gender')} />
          <Select label="Age at enrollment" allLabel="All entry ages" value={filters.age}
            options={options.ages} optionLabels={{ 'Under 21': 'Under 21 years', '21–24': '21–24 years', '25–34': '25–34 years', '35+': '35 years or older' }} onChange={set('age')} />
          <Select label="Scholarship status" allLabel="Any scholarship" value={filters.scholar}
            options={['Yes', 'No']} optionLabels={{ Yes: 'With a scholarship', No: 'No scholarship' }} onChange={set('scholar')} />
          <Select label="Tuition payment" allLabel="Any fee status" value={filters.tuition}
            options={['Up to date', 'Not up to date']} optionLabels={{ 'Up to date': 'Tuition current', 'Not up to date': 'Tuition behind' }} onChange={set('tuition')} />
          <Select label="Class schedule" allLabel="All schedules" value={filters.attendance}
            options={['Daytime', 'Evening']} optionLabels={{ Daytime: 'Daytime classes', Evening: 'Evening classes' }} onChange={set('attendance')} />
        </div>
        <div className="fb-status">
          <span className="fb-count"><b>{n.toLocaleString()}</b> of {total.toLocaleString()} students</span>
          <button className="btn-ghost" onClick={() => setFilters(defaults)} disabled={!active}>Reset filters</button>
        </div>
      </div>
      {n > 0 && n < 30 && (
        <div className="fb-warn" role="alert">⚠ This selection has only {n} students. Rates below are unstable, so read them as directional only.</div>
      )}
      {n === 0 && <div className="fb-warn" role="alert">No students match this selection. Try removing a filter.</div>}
    </div>
  );
}
