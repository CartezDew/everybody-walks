import { useMemo, useState } from 'react';
import { pct, num, summarize } from '../lib/data.js';
import { useInView } from './charts.jsx';

const CRITERIA = [
  { key: 'tuition', label: 'Tuition not up to date', test: (s) => !s.tuitionOk, kind: 'Financial' },
  { key: 'pass1', label: '1st-semester pass rate below threshold', test: (s, t) => s.pass1 !== null && s.pass1 < t, kind: 'Academic' },
  { key: 'debtor', label: 'Has outstanding debt (debtor)', test: (s) => !!s.debtor, kind: 'Financial' },
  { key: 'noschol', label: 'No scholarship', test: (s) => !s.scholar, kind: 'Financial' },
  { key: 'pass2', label: '2nd-semester pass rate below threshold', test: (s, t) => s.pass2 !== null && s.pass2 < t, kind: 'Academic (later)' },
  { key: 'age25', label: 'Age 25+ at enrollment', test: (s) => s.age >= 25, kind: 'Demographic' },
];

export default function FlagBuilder({ students }) {
  const [on, setOn] = useState({ tuition: true, pass1: true });
  const [thr, setThr] = useState(0.5);
  const [ref, inView] = useInView();

  const res = useMemo(() => {
    const active = CRITERIA.filter((c) => on[c.key]);
    const flagged = [];
    const rest = [];
    for (const s of students) (active.length && active.some((c) => c.test(s, thr)) ? flagged : rest).push(s);
    const all = summarize(students);
    const f = summarize(flagged);
    const r = summarize(rest);
    return {
      active,
      f,
      r,
      workload: all.n ? f.n / all.n : 0,
      coverage: all.dropouts ? f.dropouts / all.dropouts : null,
      precision: f.n ? f.dropRate : null,
      all,
    };
  }, [students, on, thr]);

  const usesThr = on.pass1 || on.pass2;
  return (
    <div className="flag" ref={ref}>
      <div className="flag-controls">
        <fieldset>
          <legend>Flag a student if <b>any</b> of these apply</legend>
          {CRITERIA.map((c) => (
            <label key={c.key} className={`chk${on[c.key] ? ' on' : ''}`}>
              <input type="checkbox" checked={!!on[c.key]} onChange={() => setOn({ ...on, [c.key]: !on[c.key] })} />
              <span className="chk-box" aria-hidden="true" />
              <span className="chk-text">{c.label}<small>{c.kind}</small></span>
            </label>
          ))}
        </fieldset>
        <label className={`slider${usesThr ? '' : ' disabled'}`}>
          <span>Pass-rate threshold: <b>{Math.round(thr * 100)}%</b> of enrolled units</span>
          <input type="range" min="0.1" max="1" step="0.05" value={thr} disabled={!usesThr} onChange={(e) => setThr(+e.target.value)} />
          <span className="slider-scale"><span>10%</span><span>50% (plan)</span><span>100%</span></span>
        </label>
        {on.pass2 && <p className="flag-caution">2nd-semester results arrive late in the first year, so this flag fires later than the others.</p>}
      </div>

      <div className="flag-results" aria-live="polite">
        <div className="meters">
          <Meter label="Outreach workload" hint="share of students flagged" value={res.workload} color="var(--gold)" inView={inView} big={`${num(res.f.n)} students`} />
          <Meter label="Coverage of recorded dropouts" hint="share of all dropouts who were flagged" value={res.coverage} color="var(--comparison)" inView={inView} big={`${num(res.f.dropouts)} of ${num(res.all.dropouts)}`} />
          <Meter label="Dropout among flagged students" hint="flagged students who dropped out" value={res.precision} color="var(--drop)" inView={inView} big={`${num(res.f.dropouts)} of ${num(res.f.n)} students`} />
        </div>
        <div className="flag-compare">
          <div>
            <span className="fc-k">Flagged</span>
            <span className="fc-v">{res.f.n ? pct(res.f.dropRate) : '–'}</span>
            <span className="fc-s">dropout rate · n={num(res.f.n)}</span>
          </div>
          <div>
            <span className="fc-k">Not flagged</span>
            <span className="fc-v">{res.r.n ? pct(res.r.dropRate) : '–'}</span>
            <span className="fc-s">dropout rate · n={num(res.r.n)}</span>
          </div>
        </div>
        <p className="flag-read">
          {res.active.length === 0
            ? 'Turn on at least one sign to build an early-alert list.'
            : `Of the students this rule would contact, ${num(res.f.graduates)} graduated and ${num(res.f.enrolled)} were still enrolled at the study endpoint. Another ${num(res.r.dropouts)} students who dropped out fell outside the rule. Keep a way for students to request help directly.`}

        </p>
      </div>
    </div>
  );
}

function Meter({ label, hint, value, color, inView, big }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-l">{label}</span>
        <span className="meter-v">{value == null ? '—' : pct(value, 0)}</span>
      </div>
      <div className="meter-track"><div className="meter-bar" style={{ width: inView ? `${value * 100}%` : 0, background: color }} /></div>
      <div className="meter-b"><span>{hint}</span><b>{big}</b></div>
    </div>
  );
}
