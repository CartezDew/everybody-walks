import { useState, useMemo } from 'react';
import { useInView } from './charts';
import { AGE_GROUPS, applyFilters, groupRates, num, pct } from '../lib/data.js';

const CHARTS = [
  { key: 'gender', title: 'Recorded gender', field: 'male', keys: [0, 1], labels: ['Female', 'Male'], values: ['Female', 'Male'], kind: 'bars' },
  { key: 'scholar', title: 'Scholarship status', field: 'scholar', keys: [1, 0], labels: ['Scholarship', 'No scholarship'], values: ['Yes', 'No'], kind: 'pie' },
  { key: 'tuition', title: 'Tuition payment', field: 'tuitionOk', keys: [1, 0], labels: ['Up to date', 'Not up to date'], values: ['Up to date', 'Not up to date'], kind: 'pie' },
  { key: 'age', title: 'Age at enrollment', field: 'ageGroup', keys: AGE_GROUPS, labels: AGE_GROUPS, values: AGE_GROUPS, kind: 'bars' },
  { key: 'attendance', title: 'Class schedule', field: 'evening', keys: [0, 1], labels: ['Daytime', 'Evening'], values: ['Daytime', 'Evening'], kind: 'bars' },
];

function PortraitIcon({ female }) {
  return <svg className="demo-portrait" viewBox="0 0 40 44" aria-hidden="true" focusable="false" fill="currentColor">
    {female ? <>
      <path d="M20 2C12 2 9 9 9 17c0 5-4 9 0 13l5 2h12l5-2c4-4 0-9 0-13C31 8 28 2 20 2Z"/>
      <path fill="var(--surface)" d="M13 15c5-1 10-4 12-7 0 3 1 5 3 7 0 7-4 12-8 12s-7-5-7-12Zm3 12q4 4 8 0c0 3 2 4 4 5q-8 8-16 0c3-1 4-3 4-5Z"/>
      <path d="M11 31q9 8 18 0c7 2 9 6 9 12H2c0-6 2-10 9-12Z"/>
    </> : <>
      <path d="M10 15C8 8 11 3 16 3q4-4 10 0c5 1 6 6 4 12 2 0 1 5-1 6-2 6-5 9-9 9s-8-4-9-9c-2-1-3-6-1-6Z"/>
      <path fill="var(--surface)" d="M12 16c0-5 1-7 4-7 4 1 8-2 10-1 2 1 2 4 2 8 0 7-4 12-8 12s-8-5-8-12Z"/>
      <path d="m14 27 6 6 6-6 3 4c8 2 10 5 10 12H1c0-7 2-10 10-12Z"/>
      <path fill="var(--surface)" d="m15 28 5 4 5-4 1 3-6 6-6-6Z"/>
    </>}
  </svg>;
}

function DemographicChart({ config, students, filters, setFilters }) {
  const [ref, visible] = useInView({ threshold: 0.12 });
  const { key, title, field, keys, labels, values, kind } = config;
  const rows = useMemo(() => groupRates(
    applyFilters(students, { ...filters, [key]: 'All' }),
    (student) => student[field], keys, labels,
  ), [students, filters, key, field, keys, labels]);
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const selected = rows[values.indexOf(filters[key])];
  const polar = (angle, radius) => [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  const select = (value) => setFilters((current) => ({
    ...current,
    [key]: current[key] === value ? 'All' : value,
  }));

  return <article ref={ref} className={`demographic-card demo-${key}${visible ? ' demo-visible' : ''}`} aria-label={title}>
    <h3>{title}</h3>
    <p>Share of students · {num(total)} in comparison</p>
    <div className={kind === 'pie' ? 'demo-pie-layout' : 'demo-bars-layout'}>
    {kind === 'pie' && <svg className="demographic-pie" viewBox="-5 -18 110 124" aria-label={`${title} chart`}>
      <circle cx="50" cy="50" r="45" fill="var(--surface-2)" />
      {rows.map((row, i) => {
        const share = total ? row.n / total : 0;
        const start = -Math.PI / 2 + (i ? (total ? rows[0].n / total : 0) * Math.PI * 2 : 0);
        const end = start + share * Math.PI * 2;
        const point = (angle) => polar(angle, 45).join(' ');
        const path = share >= 1 ? 'M50 5 A45 45 0 1 1 49.99 5 Z'
          : `M50 50 L${point(start)} A45 45 0 ${share > .5 ? 1 : 0} 1 ${point(end)} Z`;
        return <path key={row.key} d={path} fill={i ? 'var(--gold)' : 'var(--brand)'} className="demographic-slice"
          role="button" tabIndex={row.n || filters[key] === values[i] ? 0 : -1} aria-pressed={filters[key] === values[i]}
          aria-label={`${row.label}, ${num(row.n)} students, ${pct(share)}. Click to ${filters[key] === values[i] ? 'clear' : 'apply'} filter`}
          onClick={() => (row.n || filters[key] === values[i]) && select(values[i])}
          onKeyDown={(event) => { if ((row.n || filters[key] === values[i]) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(values[i]); } }} />;
      })}
      {rows.map((row, i) => {
        const share = total ? row.n / total : 0;
        if (!share) return null;
        const angle = -Math.PI / 2 + ((i ? rows[0].n / total : 0) + share / 2) * Math.PI * 2;
        const outside = share < .18;
        const [x, y] = polar(angle, outside ? 64 : 27);
        const [lineX, lineY] = polar(angle, 46);
        const [endX, endY] = polar(angle, 56);
        return <g key={`${row.key}-label`} className={`demographic-pie-label${outside ? ' outside' : ''}`}>
          {outside && <line x1={lineX} y1={lineY} x2={endX} y2={endY} />}
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle">{pct(share, 0)}</text>
        </g>;
      })}
    </svg>}
    <div className="demographic-options">
      {rows.map((row, i) => {
        const share = total ? row.n / total : 0;
        const active = filters[key] === values[i];
        return <button key={values[i]} type="button" className="demographic-option"
          aria-pressed={active} disabled={!row.n && !active} onClick={() => select(values[i])}
          aria-label={`${row.label}, ${num(row.n)} students, ${pct(share)}. ${active ? 'Clear' : 'Apply'} ${title.toLowerCase()} filter`}>
          <span className="demographic-option-head"><span>{key === 'gender' ? <PortraitIcon female={row.key === 0} /> : key === 'attendance' ? (
            <span className="schedule-icon" aria-hidden="true">{row.key === 0 ? '☀' : '☾'}</span>
          ) : <i className={`demographic-swatch shade-${i}`} />}{row.label}</span>{kind === 'bars' && <b>{pct(share, 0)}</b>}</span>
          {kind === 'bars' && <span className="demographic-track"><i style={{ width: `${share * 100}%` }} /></span>}
          <small>{num(row.n)} students{active ? ' · selected' : ''}</small>
        </button>;
      })}
    </div>
    </div>
    {selected && <p role="status">Selected: {selected.label} · {num(selected.n)} students. {selected.n ? `${num(selected.dropouts)} dropped out (${pct(selected.dropRate)}).` : 'No matching students.'}</p>}
  </article>;
}

export default function Demographics({ students, filters, setFilters }) {
  const [expanded, setExpanded] = useState(false);
  return <section id="demographics" className="section" aria-labelledby="demographics-h">
    <div className="section-head">
      <div className="kicker">02 · Explore the cohort</div>
      <h2 id="demographics-h">Demographics and student circumstances</h2>
      <p className="intro">Select a group to filter every dashboard view. Select it again to clear it. Each chart shows the available groups while its own filter is cleared.</p>
    </div>
    <div className="demographics-grid">
      {CHARTS.slice(0, 3).map((config) => <DemographicChart key={config.key} config={config} students={students} filters={filters} setFilters={setFilters} />)}
    </div>
    <details className="demographics-more" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>See more demographics <span aria-hidden="true">⌄</span></summary>
      {expanded && <div className="demographics-grid demo-extra">
        {CHARTS.slice(3).map((config) => <DemographicChart key={config.key} config={config} students={students} filters={filters} setFilters={setFilters} />)}
      </div>}
    </details>
  </section>;
}
