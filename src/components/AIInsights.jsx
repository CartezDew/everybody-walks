import { useState } from 'react';
import { MIN_N, num, pct, summarize } from '../lib/data';
import { Section } from './ui';
import './ai-insights.css';

const topics = [
  {
    id: 'course-plan', label: 'Course planning', question: 'What gets lost in the 50–99% pass band?',
    scope: 'Students who passed at least half, but fewer than all, of their enrolled first-term units.',
    eligible: s => s.pass1 !== null && s.pass1 >= .5 && s.pass1 < 1,
    firstGroup: s => s.e1 - s.a1 === 1,
    groups: ['One unit unpassed', 'Two or more units unpassed'],
    outcome: 'graduates', metric: 'graduation rate', verb: 'graduated',
    read: 'Both groups would clear a 50% pass threshold. Counting the units still outstanding gives advisors another way to size the work ahead. Starting course loads, actual pass percentages and program requirements can differ, so the unit count alone cannot explain a graduation gap.',
    owner: 'Academic advising',
    pilot: 'After first-term grades post, offer a course-planning visit to students with two or more outstanding units. Ask which units block a prerequisite and help the student choose a feasible retake schedule.',
    measure: 'Record invitations and completed visits. Compare next-term registration and outstanding units completed with a similar group receiving usual advising. Follow graduation at the normal program endpoint.',
  },
  {
    id: 'financial-review', label: 'Financial support', question: 'Who could a payment-only check miss?',
    scope: 'Students with current tuition who passed at least half their enrolled first-term units.',
    eligible: s => Boolean(s.tuitionOk) && s.pass1 !== null && s.pass1 >= .5,
    firstGroup: s => Boolean(s.debtor),
    groups: ['Outstanding debt recorded', 'No outstanding debt recorded'],
    outcome: 'dropouts', metric: 'dropout rate', verb: 'dropped out',
    read: 'These students meet neither the late-tuition nor the low-pass rule. An outstanding debt is recorded separately from tuition status. The study does not date those financial records or establish why students left.',
    owner: 'Financial aid and student success',
    pilot: 'First confirm when both fields become available locally. If they are current before registration, test an opt-in financial-aid review for students carrying a balance and keep self-referrals open.',
    measure: 'Track invitations, completed aid reviews, and next-term registration. Compare registration with usual outreach in a phased pilot, then follow recorded dropout at the same endpoint for both groups.',
  },
  {
    id: 'second-check', label: 'Second-term follow-up', question: 'Can a strong first term hide a later setback?',
    scope: 'Students who passed every enrolled first-term unit and enrolled in units in both terms.',
    eligible: s => s.pass1 === 1 && s.pass2 !== null,
    firstGroup: s => s.pass2 < .5,
    groups: ['Passed under half in term two', 'Passed at least half in term two'],
    outcome: 'dropouts', metric: 'dropout rate', verb: 'dropped out',
    read: 'Every student here started with a full pass record. The split appears only after second-term grades. Some departures may already have happened by then.',
    owner: 'Retention and advising',
    pilot: 'Add a second review when grades post. Confirm each student is still enrolled before offering a course-recovery appointment. Ask students who have left whether they want information about returning.',
    measure: 'Track completed appointments among invitees and subsequent registration among students eligible to return. Compare with a similar cohort receiving the usual first-term check only.',
  },
];

export default function AIInsights({ students }) {
  const [topicId, setTopicId] = useState(topics[0].id);
  const topic = topics.find(item => item.id === topicId);
  const eligible = students.filter(topic.eligible);
  const groups = [
    summarize(eligible.filter(topic.firstGroup)),
    summarize(eligible.filter(student => !topic.firstGroup(student))),
  ];
  const rates = groups.map(group => group.n ? group[topic.outcome] / group.n : null);
  const comparable = groups.every(group => group.n >= MIN_N);
  const difference = comparable ? (rates[0] - rates[1]) * 100 : null;
  const gap = comparable && Math.abs(difference) >= .05;
  const supportsPilot = gap && difference > 0;
  const reading = !eligible.length ? 'No students in this selection meet the group definition. Broaden the cohort filters or choose another question.'
    : groups.some(group => !group.n) ? 'Only one comparison group is represented. Broaden the cohort filters to compare rates.'
    : !comparable ? 'At least one group has fewer than 30 students. A few outcomes can shift its rate substantially. Use the counts and widen the selection before planning outreach.'
    : gap ? `The ${topic.metric} in the first group was ${Math.abs(difference).toFixed(1)} percentage points ${difference > 0 ? 'higher' : 'lower'} than in the second.`
    : 'The two observed rates differ by less than 0.1 percentage point.';

  return <Section id="insights" title="AI Insights" intro="Explore three comparisons for planning retention support. AI helped develop the interpretations. Counts and rates are calculated in your browser from the selected student records.">
    <div className="insight-workbench wide">
      <div className="insight-topics" role="group" aria-label="Retention decision">
        {topics.map(item => <button key={item.id} type="button" aria-pressed={item.id === topicId}
          aria-controls="insight-finding" onClick={() => setTopicId(item.id)}>{item.label}</button>)}
      </div>
      <article id="insight-finding" aria-labelledby="insight-question">
        <div className="insight-heading">
          <h3 id="insight-question">{topic.question}</h3>
          <p>{topic.scope} <b>{num(eligible.length)} of {num(students.length)}</b> selected students qualify.</p>
        </div>
        {eligible.length > 0 && <div className="insight-pair" aria-label={topic.metric}>
          {groups.map((group, i) => <div key={topic.groups[i]} className="insight-group">
            <h4>{topic.groups[i]}</h4>
            <strong className={topic.outcome === 'graduates' ? 'insight-grad' : 'insight-drop'}>{group.n ? pct(rates[i]) : '—'}</strong>
            <span>{group.n ? `${num(group[topic.outcome])} of ${num(group.n)} ${topic.verb}` : 'No matching students'}</span>
          </div>)}
        </div>}
        <div className="insight-reading" aria-live="polite">
          <h4>How to read it</h4>
          <p>{reading}{comparable && <> {topic.read}</>}</p>
        </div>
        {supportsPilot && <div className="insight-pilot">
          <div><h4>What to try</h4><b>{topic.owner}</b><p>{topic.pilot}</p></div>
          <div><h4>How to judge the pilot</h4><p>{topic.measure}</p></div>
        </div>}
        {comparable && !supportsPilot && <div className="insight-reading">
          <h4>What to do next</h4>
          <p>This selection provides little support for prioritizing the proposed group. Review course mix and ask students about barriers before changing outreach. Keep usual support available to both groups.</p>
        </div>}
      </article>
      <p className="insight-source">The rates include students still enrolled at the study endpoint. These historical comparisons come from one institution. A local pilot would test whether outreach changes outcomes.</p>
    </div>
  </Section>;
}
