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
      coverage: all.dropouts ? f.dropouts / all.dropouts : 0,
      precision: f.n ? f.dropRate : 0,
      lift: all.dropRate ? (f.n ? f.dropRate / all.dropRate : 0) : 0,
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
          <Meter label="Outreach workload" hint="share of students flagged" value={res.workload} color="var(--grad)" inView={inView} big={`${num(res.f.n)} students`} />
          <Meter label="Dropouts caught" hint="share of all dropouts who were flagged" value={res.coverage} color="var(--drop)" inView={inView} big={`${num(res.f.dropouts)} of ${num(res.all.dropouts)}`} />
          <Meter label="Hit rate" hint="flagged students who dropped out" value={res.precision} color="var(--enr)" inView={inView} big={res.f.n ? `${res.lift.toFixed(1)}× the average` : '–'} />
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
            : `Contacting ${pct(res.workload, 0)} of students would reach ${pct(res.coverage, 0)} of the students who later dropped out. ${
                res.coverage < 0.5 ? 'Most dropouts would be missed, so add a sign.' : res.workload > 0.5 ? 'The list is large, so consider a stricter threshold.' : 'This is a practical size for an advising team.'
              }`}
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
        <span className="meter-v">{pct(value, 0)}</span>
      </div>
      <div className="meter-track"><div className="meter-bar" style={{ width: inView ? `${value * 100}%` : 0, background: color }} /></div>
      <div className="meter-b"><span>{hint}</span><b>{big}</b></div>
    </div>
  );
}
