// Prioritized recommendations, computed from the full study cohort (not the filters).
import { useMemo, useState } from 'react';
import { STUDENTS, summarize, num, pct } from '../lib/data.js';
import { Section } from './ui.jsx';
import { useInView } from './charts.jsx';
import './recommendations.css';

const I = {
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9.5 12.5 5 5m0-5-5 5" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  receipt: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  flask: <><path d="M9 3h6" /><path d="M10 9V3h4v6l5 9a2 2 0 0 1-1.7 3H6.7A2 2 0 0 1 5 18Z" /><path d="M7 15h10" /></>,
  heart: <><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /></>,
};
const Icon = ({ name, className = '' }) => <svg className={`rc-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{I[name]}</svg>;

const PRIORITIES = [
  { id: 'p1', label: 'Priority 1', name: 'Do first', when: 'This term', blurb: 'Uses data the university already records. Low cost, largest reach.' },
  { id: 'p2', label: 'Priority 2', name: 'Do next', when: 'This academic year', blurb: 'Closes the gaps the first list leaves open.' },
  { id: 'p3', label: 'Priority 3', name: 'Test and learn', when: 'Pilot, then scale', blurb: 'Measures whether outreach works and keeps it fair.' },
];

function useRecs() {
  return useMemo(() => {
    const S = STUDENTS, all = summarize(S);
    const lp1 = (s) => s.e1 > 0 && s.a1 / s.e1 < 0.5;
    const lp2 = (s) => s.e2 > 0 && s.a2 / s.e2 < 0.5;
    const two = (s) => !s.tuitionOk || lp1(s);
    const sum = (f) => summarize(S.filter(f));
    const flagged = sum(two);
    const late = sum((s) => !s.tuitionOk), paid = sum((s) => s.tuitionOk);
    const noExam = sum((s) => s.e1 > 0 && s.ev1 === 0), someExam = sum((s) => s.e1 > 0 && s.ev1 > 0);
    const missed = S.filter((s) => !two(s) && s.target === 0);
    const missedLp2 = missed.filter(lp2).length;
    const debt = sum((s) => s.tuitionOk && s.debtor), noDebt = sum((s) => s.tuitionOk && !s.debtor);
    const old = S.filter((s) => s.age >= 25), young = S.filter((s) => s.age < 25);
    const sch = (l) => l.filter((s) => s.scholar).length / l.length;
    const oldS = summarize(old), youngS = summarize(young);
    const fg = sum((s) => s.firstGen), nfg = sum((s) => !s.firstGen);
    const kept = Math.round(flagged.dropouts * 0.2);
    return [
      { p: 'p1', icon: 'bell', title: 'Start a two-sign early-alert list after the first term',
        stat: pct(flagged.dropouts / all.dropouts, 0), statNote: `of all dropouts are on a list of ${pct(flagged.n / all.n, 0)} of students (${num(flagged.n)})`,
        action: 'Each term, list students who are behind on tuition or passed under half their first-term courses. Advisors and financial aid split the list and reach out within two weeks.',
        owner: 'Retention & advising', when: 'When first-term grades post', effort: 'Low' },
      { p: 'p1', icon: 'wallet', title: 'Offer payment plans the moment tuition falls behind',
        stat: pct(late.dropRate, 0), statNote: `of students behind on tuition dropped out, vs ${pct(paid.dropRate, 0)} of those up to date`,
        action: 'Ask the bursar when a missed payment first shows up, then contact the student with payment-plan and emergency-aid options before the debt grows.',
        owner: 'Bursar · Financial aid', when: 'Any time in the term', effort: 'Low' },
      { p: 'p1', icon: 'clipboard', title: 'Flag students who miss every first exam',
        stat: pct(noExam.dropRate, 0), statNote: `of ${num(noExam.n)} students who sat no first-term exams dropped out, vs ${pct(someExam.dropRate, 0)} of others`,
        action: 'Ask instructors to report students absent from every exam in the first sitting, so advisors can call weeks before final grades.',
        owner: 'Faculty · Academic advising', when: 'Mid-term, first exam sitting', effort: 'Low' },
      { p: 'p2', icon: 'repeat', title: 'Add a second check when term-two grades post',
        stat: num(missed.length), statNote: `dropouts are missed by the first list. ${num(missedLp2)} of them passed under half of term-two courses.`,
        action: 'Repeat the course-pass check after term two, and send an opt-in registration reminder to students who have not re-enrolled.',
        owner: 'Academic advising', when: 'After term-two grades', effort: 'Low' },
      { p: 'p2', icon: 'receipt', title: 'Check other debt at registration, even when tuition is paid',
        stat: pct(debt.dropRate, 0), statNote: `of ${num(debt.n)} students with paid tuition but other debt dropped out, vs ${pct(noDebt.dropRate, 0)}`,
        action: 'Offer a short financial-aid review to students carrying a balance. A tuition-only check marks them as fine.',
        owner: 'Financial aid', when: 'At registration', effort: 'Medium' },
      { p: 'p2', icon: 'clock', title: 'Design support around students who start at 25 or older',
        stat: pct(oldS.dropRate, 0), statNote: `dropped out, vs ${pct(youngS.dropRate, 0)} of younger students. Only ${pct(sch(old), 0)} hold a scholarship, vs ${pct(sch(young), 0)}.`,
        action: 'Review whether scholarship criteria reach older students, and offer evening or online advising and aid hours. Make it opt-in; do not single students out by age.',
        owner: 'Leadership · Student success', when: 'Next scholarship cycle', effort: 'Medium' },
      { p: 'p3', icon: 'flask', title: 'Pilot outreach before scaling it',
        stat: `≈ ${num(kept)}`, statNote: 'more students would stay if outreach kept 2 in 10 listed dropouts. The real rate is unknown.',
        action: 'Roll out in phases so some advisors start later, and compare re-enrollment between groups. Track invitations, completed meetings and next-term registration.',
        owner: 'Leadership · Institutional research', when: 'One academic year', effort: 'Medium' },
      { p: 'p3', icon: 'heart', title: 'Keep help open to everyone, and avoid stereotyped targeting',
        stat: `${pct(fg.dropRate, 0)} vs ${pct(nfg.dropRate, 0)}`, statNote: 'dropout for first-generation students vs others: no real gap, so background alone is not a reason to target',
        action: 'Keep a self-referral route for students who are not on any list. Use demographics to design services, never to deny them.',
        owner: 'Student success', when: 'Ongoing', effort: 'Low' },
    ];
  }, []);
}

function Rec({ r, i }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  return <article ref={ref} className={`rc-card rc-${r.p}${inView ? ' in' : ''}`} style={{ '--d': `${i * 80}ms` }}>
    <h3><span className="rc-badge"><Icon name={r.icon} /></span>{r.title}</h3>
    <p className="rc-stat"><strong>{r.stat}</strong> <span>{r.statNote}</span></p>
    <p className="rc-action">{r.action}</p>
    <p className="rc-meta"><b>{r.owner}</b><span>{r.when} · {r.effort.toLowerCase()} effort</span></p>
  </article>;
}

export default function Recommendations() {
  const recs = useRecs();
  const [show, setShow] = useState('p1');
  return <Section id="act" kicker="08 · What to do" title="Recommendations" intro="Ranked by how quickly a team can act and how many departures each step reaches. Figures use the full study cohort of 4,424 students, whatever filters are set above.">
    <div className="rc-wrap wide">
      <div className="rc-filter" role="group" aria-label="Show priority">
        {[['all', 'All priorities'], ...PRIORITIES.map((p) => [p.id, `${p.label} · ${p.name}`])].map(([id, label]) =>
          <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>)}
      </div>
      {PRIORITIES.filter((p) => show === 'all' || show === p.id).map((p) => {
        const list = recs.filter((r) => r.p === p.id);
        return <section key={p.id} className={`rc-tier ${p.id}`} aria-labelledby={`rc-${p.id}`}>
          <header className="rc-tier-h">
            <span className={`rc-tier-n ${p.id}`}>{p.id.slice(1)}</span>
            <div><h3 id={`rc-${p.id}`}>{p.name} <small>{p.when}</small></h3><p>{p.blurb}</p></div>
          </header>
          <div className="rc-grid">{list.map((r, i) => <Rec key={r.title} r={r} i={i} />)}</div>
        </section>;
      })}
    </div>
  </Section>;
}
