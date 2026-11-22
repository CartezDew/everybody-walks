import { useMemo, useState } from 'react';
import { num, pct, summarize } from '../lib/data.js';

const plans = [
  {
    id: 'tuition', name: 'Missed tuition payment',
    detail: 'Financial aid contacts students whose tuition is behind.',
    action: 'Confirm the payment record is current. Within weeks of a missed payment, offer a conversation about payment plans, emergency aid, and scholarship eligibility.',
    matches: s => !s.tuitionOk,
  },
  {
    id: 'debt', name: 'Include other outstanding debt',
    detail: 'Also invite students with a recorded debt, even when tuition is current.',
    action: 'Ask the bursar to verify outstanding balances. Coordinate one invitation from financial aid so students with both financial signals receive one point of contact.',
    matches: s => !s.tuitionOk || s.debtor,
  },
  {
    id: 'academic', name: 'Add a first-semester advising check-in',
    detail: 'Invite students behind on tuition or who passed under half their first-term units.',
    action: 'After grades post, have advisors offer a course-planning meeting. When both signals apply, coordinate a single invitation with financial aid.',
    matches: s => !s.tuitionOk || (s.pass1 !== null && s.pass1 < 0.5),
  },
];

export default function FlagBuilder({ students }) {
  const [choice, setChoice] = useState('tuition');
  const [slots, setSlots] = useState('');
  const plan = plans.find(item => item.id === choice);
  const { cohort, baseline, invited } = useMemo(() => ({
    cohort: summarize(students),
    baseline: summarize(students.filter(plans[0].matches)),
    invited: summarize(students.filter(plan.matches)),
  }), [students, plan]);
  const missed = cohort.dropouts - invited.dropouts;
  const available = Number(slots);
  const valid = /^\d+$/.test(slots) && Number.isSafeInteger(available);
  const gap = invited.n - available;

  return <div className="flag outreach-plan">
    <fieldset className="flag-controls">
      <legend>Who should receive an invitation?</legend>
      {plans.map(item => <label key={item.id} className={'plan-choice' + (choice === item.id ? ' selected' : '')}>
        <input type="radio" name="outreach-plan" checked={choice === item.id} onChange={() => setChoice(item.id)} />
        <span><b>{item.name}</b><small>{item.detail}</small></span>
      </label>)}
    </fieldset>
    <div className="flag-results">
      <div aria-live="polite">
        <h4>{num(invited.n)} students to invite</h4>
        <p>Out of {num(cohort.n)} students in this selection. Each student counts once.</p>
        <p>{cohort.dropouts ? <><b>{num(invited.dropouts)} of {num(cohort.dropouts)} recorded departures ({pct(invited.dropouts / cohort.dropouts)})</b> met this rule. {num(missed)} fell outside it.</> : 'This selection has no recorded departures.'}</p>
        {choice !== 'tuition' && <p>Compared with tuition outreach alone, this adds <b>{num(invited.n - baseline.n)} invitations</b> and includes {num(invited.dropouts - baseline.dropouts)} additional students who later left.</p>}
        <p className="flag-read">{plan.action}</p>
      </div>
      <details className="plan-staffing">
        <summary>Can our team cover these invitations?</summary>
        <label>Appointments your team can offer this outreach round
          <input type="text" inputMode="numeric" value={slots} placeholder="e.g. 50" onChange={e => setSlots(e.target.value)} />
        </label>
        <small>Budget one appointment per invited student. Leave blank to explore reach without a staffing budget.</small>
        {slots !== '' && <p role="status">{!valid ? 'Enter a whole number of appointments, zero or more.' : gap > 0 ? `You can offer ${num(available)} of ${num(invited.n)} appointments this round. Add ${num(gap)} slots or schedule a later round for the rest.` : gap === 0 ? 'Your appointments exactly cover this group.' : `Your team can cover this group with ${num(-gap)} appointments left for referrals.`}</p>}
      </details>
    </div>
  </div>;
}
