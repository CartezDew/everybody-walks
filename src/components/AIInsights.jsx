// AI Insights: signals the main two-sign story does not cover, computed live from the
// selected students. Each finding names who can act on it and how strong the evidence is.
import { useState } from 'react';
import { MIN_N, num, pct, summarize } from '../lib/data';
import { Section } from './ui';
import { useInView } from './charts';
import './ai-insights.css';

const ROLES = [
  ['all', 'All roles'],
  ['leadership', 'University leadership'],
  ['advising', 'Academic advising'],
  ['success', 'Student success'],
  ['finaid', 'Financial aid'],
  ['enrollment', 'Enrollment management'],
];
const ROLE_NAME = Object.fromEntries(ROLES);

const passShare = (e, a) => (e > 0 ? a / e : null);
const lowPass1 = (s) => s.e1 > 0 && s.a1 / s.e1 < 0.5;
const lowPass2 = (s) => s.e2 > 0 && s.a2 / s.e2 < 0.5;
const twoSign = (s) => !s.tuitionOk || lowPass1(s);
const split = (list, f) => [summarize(list.filter(f)), summarize(list.filter((s) => !f(s)))];
const disjoint = (a, b) => a.ci[1] < b.ci[0] || b.ci[1] < a.ci[0];

// Evidence strength for a group-vs-rest comparison.
function strength(a, b) {
  if (a.n < MIN_N || b.n < MIN_N) return { key: 'small', label: 'Small group · read with care' };
  const gap = Math.abs(a.dropRate - b.dropRate);
  if (!disjoint(a, b)) return { key: 'none', label: 'No real difference' };
  if (gap >= 0.15) return { key: 'strong', label: 'Strong signal' };
  return { key: 'moderate', label: 'Moderate signal' };
}

function Bars({ rows, overall }) {
  return <div className="ai-bars">
    {rows.map(({ label, s, tone }) => <div className="ai-bar-row" key={label}>
      <span className="ai-bar-l"><b>{label}</b><small>{s.n ? `${num(s.dropouts)} of ${num(s.n)} left` : 'No students'}</small></span>
      <span className="ai-bar-track" aria-hidden="true">
        <i className={`ai-bar-fill ${tone || (s.dropRate > overall ? 'hi' : 'lo')}`} style={{ '--w': `${s.dropRate * 100}%` }} />
        <i className="ai-bar-ref" style={{ left: `${overall * 100}%` }} />
      </span>
      <span className="ai-bar-v">{s.n ? pct(s.dropRate, 0) : '–'}</span>
    </div>)}
  </div>;
}

// Two-dot comparison rows on a 0–100% scale. a = the group in focus, b = the comparison.
function Dumbbells({ keyA, keyB, rows }) {
  return <div className="ai-dumbbells">
    <div className="ai-db-key"><span><i className="db-m" />{keyA}</span><span><i className="db-y" />{keyB}</span></div>
    {rows.map((r) => <div className="ai-db" key={r.label}>
      <span className="ai-db-l"><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</span>
      <span className="ai-db-track" role="img" aria-label={`${r.label}: ${pct(r.a, 0)} for ${r.aName || keyA}, ${pct(r.b, 0)} for ${r.bName || keyB}`}>
        <i className="ai-db-line" style={{ left: `${Math.min(r.a, r.b) * 100}%`, width: `${Math.abs(r.a - r.b) * 100}%` }} />
        <i className="ai-db-dot db-y" style={{ left: `${r.b * 100}%` }} />
        <i className="ai-db-dot db-m" style={{ left: `${r.a * 100}%` }} />
      </span>
      <span className="ai-db-v"><b>{pct(r.a, 0)}</b><small>vs {pct(r.b, 0)}</small></span>
    </div>)}
  </div>;
}

function Card({ f, index }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  const [open, setOpen] = useState(false);
  return <article ref={ref} className={`ai-card ai-${f.kind}${f.wide ? ' ai-wide' : ''}${inView ? ' in' : ''}`} style={{ '--d': `${index * 70}ms` }} aria-labelledby={`ai-${f.id}-h`}>
    <header className="ai-card-h">
      <span className="ai-tag">{f.tag}</span>
      {f.strength && <span className={`ai-strength s-${f.strength.key}`}>{f.strength.label}</span>}
    </header>
    <h3 id={`ai-${f.id}-h`}>{f.title}</h3>
    <div className="ai-headline"><strong>{f.big}</strong><span>{f.bigNote}</span></div>
    {f.when && <p className="ai-when"><span aria-hidden="true">◷</span> {f.when}</p>}
    {f.visual}
    <div className="ai-decision">
      <div className="ai-decision-h"><span>Decision</span><small>For {f.roles.map((r) => ROLE_NAME[r]).join(', ')}</small></div>
      <p>{f.decision}</p>
    </div>
    <button type="button" className="ai-more" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Hide details' : 'Why this matters and its limits'} <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="ai-details">{f.details.map((d) => <p key={d}>{d}</p>)}</div>}
  </article>;
}

function buildFindings(students) {
  const all = summarize(students);
  const overall = all.dropRate;
  const F = [];
  if (!students.length) return { F, all };

  // 1. Earlier warning: enrolled in units but sat no first-term exams.
  {
    const base = students.filter((s) => s.e1 > 0);
    const [skip, sat] = split(base, (s) => s.ev1 === 0);
    if (skip.n) F.push({
      id: 'exams', kind: 'early', tag: 'Earlier warning', roles: ['advising', 'success'],
      title: 'Students who sat none of their first-term exams',
      big: pct(skip.dropRate, 0), bigNote: `dropped out (${num(skip.dropouts)} of ${num(skip.n)}), vs ${pct(sat.dropRate, 0)} of students who sat at least one`,
      when: 'Visible during the term, at the first exam sitting, weeks before grades post',
      strength: strength(skip, sat),
      visual: <Bars overall={overall} rows={[{ label: 'Sat no exams', s: skip }, { label: 'Sat at least one', s: sat }]} />,
      decision: 'Ask instructors to report students who miss every exam in the first sitting, and have an advisor reach out within a week instead of waiting for final grades.',
      details: [
        'These students also fail the courses-passed sign, so they are not new names on the list. The gain is time: the warning arrives mid-term instead of after the term ends.',
        'Missing exams can reflect work, caring duties, illness or a decision already made to leave. Open the conversation by asking what is getting in the way.',
      ],
    });
  }

  // 2. Blind spot: dropouts the two-sign list misses, and what they have in common.
  {
    const rest = students.filter((s) => !twoSign(s));
    const missed = rest.filter((s) => s.target === 0);
    const traits = [
      ['Passed under half of term-two courses', lowPass2],
      ['Started at age 25 or older', (s) => s.age >= 25],
      ['Enrolled in no first-term courses', (s) => s.e1 === 0],
      ['Outstanding debt recorded', (s) => !!s.debtor],
    ].map(([label, f]) => {
      const withT = summarize(rest.filter(f));
      return { label, share: missed.length ? missed.filter(f).length / missed.length : 0, withT, count: missed.filter(f).length };
    }).sort((a, b) => b.share - a.share).slice(0, 3);
    if (missed.length) F.push({
      id: 'missed', kind: 'gap', tag: 'Blind spot', roles: ['leadership', 'advising', 'success'],
      title: 'Who the two-sign early-alert list misses',
      big: num(missed.length), bigNote: `of ${num(all.dropouts)} dropouts (${pct(missed.length / all.dropouts, 0)}) had current tuition and passed at least half their first-term courses`,
      visual: <div className="ai-traits">
        <div className="ai-traits-h"><span>What missed dropouts have in common</span><span>Share of missed dropouts</span></div>
        {traits.map((t) => <div className="ai-trait" key={t.label}>
          <span className="ai-trait-l"><b>{t.label}</b><small>{t.withT.n ? `${pct(t.withT.dropRate, 0)} of these unflagged students left · ${num(t.withT.n)} students` : 'No students'}</small></span>
          <span className="ai-trait-track" aria-hidden="true"><i style={{ '--w': `${t.share * 100}%` }} /></span>
          <span className="ai-trait-v"><b>{pct(t.share, 0)}</b><small>{num(t.count)}</small></span>
        </div>)}
        <p className="ai-note">A student can have several traits, so shares add up to more than 100%.</p>
      </div>,
      decision: `Add a second review when term-two grades post. Passing under half of term-two courses picks up ${pct(missed.filter(lowPass2).length / missed.length, 0)} of the dropouts the first list misses.`,
      details: [
        'The two signs catch most departures but not all. A second, later check catches students whose trouble starts after a good first term.',
        'Some students leave before term-two grades exist. For them, an opt-in check-in at registration for the next term may be the only touchpoint.',
      ],
    });
  }

  // 3. Demographic: mature students (25+ at entry).
  {
    const [m, y] = split(students, (s) => s.age >= 25);
    if (m.n && y.n) {
      const share = (list, f) => (list.length ? list.filter(f).length / list.length : 0);
      const ml = students.filter((s) => s.age >= 25), yl = students.filter((s) => s.age < 25);
      const factors = [
        ['Behind on tuition', (s) => !s.tuitionOk],
        ['Holds a scholarship', (s) => !!s.scholar],
        ['Passed under half, term 1', lowPass1],
      ].map(([label, f]) => ({ label, m: share(ml, f), y: share(yl, f) }));
      const flagged = ml.filter(twoSign).length;
      const mDrop = ml.filter((s) => s.target === 0);
      F.push({
        id: 'mature', kind: 'people', tag: 'Student group', roles: ['leadership', 'success', 'finaid'],
        title: 'Students who start at 25 or older',
        big: pct(m.dropRate, 0), bigNote: `dropped out, vs ${pct(y.dropRate, 0)} of younger students. They are ${pct(m.n / all.n, 0)} of students but ${pct(m.dropouts / (all.dropouts || 1), 0)} of dropouts.`,
        strength: strength(m, y),
        visual: <Dumbbells keyA="25 or older" keyB="Under 25" rows={factors.map((f) => ({ label: f.label, a: f.m, b: f.y }))} />,
        decision: 'Check whether scholarship rules reach older students, and offer advising and financial-aid hours outside daytime working hours.',
        details: [
          `The two signs already flag ${num(flagged)} of ${num(ml.length)} older students (${pct(flagged / (ml.length || 1), 0)}), including ${pct(mDrop.filter(twoSign).length / (mDrop.length || 1), 0)} of those who left. Age adds little as a trigger on its own. The opportunity is to design support that fits older students.`,
          'Use age to shape services, not to single students out. Older students often balance jobs and families. Opt-in, flexible options respect that.',
        ],
      });
    }
  }

  // 4. Myth check: background factors often assumed to predict dropout.
  {
    const [fg, notFg] = split(students, (s) => s.firstGen === 1);
    const [later, first] = split(students, (s) => s.appOrder > 1);
    if (fg.n && notFg.n && later.n && first.n) {
      const s1 = strength(fg, notFg), s2 = strength(later, first);
      F.push({
        id: 'myths', kind: 'myth', tag: 'Myth check', roles: ['enrollment', 'leadership'],
        title: 'Two common assumptions the data does not support',
        big: s1.key === 'none' ? 'No gap' : `${Math.abs((fg.dropRate - notFg.dropRate) * 100).toFixed(0)} pts`,
        bigNote: `between first-generation students (${pct(fg.dropRate, 0)}) and students with a degree-holding parent (${pct(notFg.dropRate, 0)})`,
        strength: s1,
        visual: <>
          <Dumbbells keyA="Group in question" keyB="Comparison group" rows={[
            { label: 'First generation', sub: `vs a parent with a degree · ${num(fg.n)} students`, a: fg.dropRate, b: notFg.dropRate, aName: 'first-generation students', bName: 'students with a degree-holding parent' },
            { label: 'Not first-choice program', sub: `vs got first choice · ${num(later.n)} students`, a: later.dropRate, b: first.dropRate, aName: 'students outside their first choice', bName: 'students in their first choice' },
          ]} />
          <p className="ai-note">Dropout rate for each group. {s2.key === 'none' ? 'Program choice shows no real difference either.' : later.dropRate < first.dropRate ? 'Students placed outside their first choice actually left less often.' : 'Students placed outside their first choice left more often.'}</p>
        </>,
        decision: 'Do not single out first-generation students or students outside their first-choice program for retention outreach. Keep general support open to everyone, and spend targeted effort on the tuition and course signals.',
        details: [
          'First-generation students make up most of this cohort, so their rate sits close to the overall rate. They may still need help navigating university systems, which is a service-design question rather than a dropout-risk one.',
          'Application order may reflect how students rank options, not how committed they are. Some students list a safer program first.',
        ],
      });
    }
  }
  return { F, all };
}

export default function AIInsights({ students }) {
  const [role, setRole] = useState('all');
  const { F, all } = buildFindings(students);
  const shown = F.filter((f) => role === 'all' || f.roles.includes(role));
  const counts = { early: F.filter((f) => f.kind === 'early' || f.when).length, strong: F.filter((f) => f.strength?.key === 'strong').length };

  return <Section id="insights" kicker="AI-assisted analysis" title="AI Insights: what the main story leaves out" intro="AI helped look beyond tuition status and courses passed for patterns staff may not have considered. Every number is calculated in your browser from the students in your current selection, so findings update when you filter.">
    <div className="ai-wrap wide">
      <div className="ai-summary">
        <div><strong>{F.length}</strong><span>findings in this selection</span></div>
        <div><strong>{counts.strong}</strong><span>strong signals</span></div>
        <div><strong>{counts.early}</strong><span>visible before final grades</span></div>
        <div><strong>{num(all.n)}</strong><span>students analysed</span></div>
      </div>
      <div className="ai-roles" role="group" aria-label="Show findings for">
        <span>Show findings for</span>
        {ROLES.map(([id, label]) => <button key={id} type="button" aria-pressed={role === id} onClick={() => setRole(id)}>{label}</button>)}
      </div>
      {shown.length ? <div className="ai-grid">{shown.map((f, i) => <Card key={f.id} f={f} index={i} />)}</div>
        : <p className="ai-empty">No findings for this role in the current selection. Choose another role or broaden the filters.</p>}
      <div className="ai-fair">
        <b>Using these findings fairly</b>
        <p>Use age, family background and other characteristics to design support, never to deny it or as the only trigger for contact. Patterns describe groups, not individuals. These are historical comparisons from one institution, so a campus pilot is needed to learn whether acting on them changes outcomes.</p>
      </div>
    </div>
  </Section>;
}
