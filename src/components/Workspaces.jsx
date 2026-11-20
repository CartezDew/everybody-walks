import { useState } from 'react';
import { BANDS, num, pct, summarize } from '../lib/data';
import { Card } from './ui';
import FlagBuilder from './FlagBuilder';

export const ROLES = [
  { id: 'leadership', label: 'University leadership', task: 'Allocate resources', question: 'Where does financial support have the most reach?' },
  { id: 'advising', label: 'Academic advising', task: 'Plan academic check-ins', question: 'Who could benefit from a first-term check-in?' },
  { id: 'success', label: 'Student success', task: 'Coordinate support', question: 'Where do financial and academic needs overlap?' },
  { id: 'enrollment', label: 'Enrollment management', task: 'Compare programs', question: 'Which programs account for the most departures?' },
  { id: 'retention', label: 'Retention & support', task: 'Size an outreach effort', question: 'How many students would an outreach rule reach?' },
];

const paths = {
  leadership: 'M2 9l10-6 10 6H2z M4 21h16 M5 18h14 M6 10v6m4-6v6m4-6v6m4-6v6',
  advising: 'M2 9l10-5 10 5-10 5L2 9z M6 11v5q6 5 12 0v-5 M22 9v7',
  success: 'M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14',
  enrollment: 'M3 21h18 M5 17v-5h3v5zm6 0V8h3v9zm6 0V3h3v14z',
  retention: 'M3 10h4l3 4h5l2-2h-6 M3 16l5 4h7l7-6q-1-2-3 0l-3 2 M13 9l-3-3q-2-4 2-4l1 1 1-1q4 0 2 4z',
};

export function RolePicker({ role, onSelect }) {
  return <section id="roles" className="role-picker" aria-labelledby="roles-title">
    <div className="role-top"><h2 id="roles-title">Choose your workspace</h2><span>Views by campus role</span></div>
    <div className="role-options" role="group" aria-label="Campus role">{ROLES.map(r =>
      <button key={r.id} aria-pressed={r.id === role} onClick={() => onSelect(r.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[r.id]}/></svg>
        <span><b>{r.label}</b><small>{r.task}</small></span>
      </button>)}</div>
  </section>;
}

const rate = (x, n) => n ? pct(x / n) : '—';
function Metric({ label, value, detail }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Comparison({ title, rows, note, count = false }) {
  const max = count ? Math.max(1, ...rows.map(r => r.dropouts)) : 1;
  const value = r => count ? num(r.dropouts) : rate(r.dropouts, r.n);
  return <Card title={title} wide note={note} table={{ rows, cols: [
    { k: 'label', h: 'Group' }, { k: 'n', h: 'Students', num: true, f: r => num(r.n) },
    { k: 'dropouts', h: 'Dropouts', num: true, f: r => num(r.dropouts) },
    { k: 'dropRate', h: 'Dropout rate', num: true, f: r => rate(r.dropouts, r.n) },
    { k: 'ci', h: '95% Wilson interval', f: r => r.n ? r.ci.map(v => pct(v)).join(' – ') : '—' },
  ] }}>
    <div className="compare-rows">{rows.map((r,i) => <div className="compare-row" key={r.key}>
      <div><b>{r.label}</b><small>{num(r.dropouts)} of {num(r.n)} students{r.n > 0 && r.n < 30 ? ' · small group' : ''}</small></div>
      <div className="measure-track"><i style={{width: ((count ? r.dropouts : r.dropRate) / max * 100) + '%', background: i === 0 ? 'var(--brand)' : 'var(--secondary-bar)'}}/></div>
      <strong>{value(r)}</strong>
    </div>)}</div>
  </Card>;
}

export function Workspace({ role, list, groups, summary: s, onExplore }) {
  const [rank, setRank] = useState('count');
  const profile = ROLES.find(r => r.id === role);
  const low = summarize(list.filter(r => r.pass1 !== null && r.pass1 < .5));
  const both = groups.heatTP[0][0];
  const late = groups.tuition[0];
  const base = <Metric label="Selected cohort" value={num(s.n)} detail="students in this view"/>;
  let metrics, chart, action, link;
  switch(role) {
    case 'leadership':
      metrics = <>{base}<Metric label="Dropout rate" value={rate(s.dropouts,s.n)} detail={num(s.dropouts)+' recorded dropouts'}/><Metric label="Tuition behind" value={rate(late.dropouts,s.dropouts)} detail="of all dropouts in this cohort"/></>;
      chart = <Comparison title="Dropout rate by tuition status" rows={groups.tuition} note="Each rate uses all students in that tuition group. The table includes 95% intervals."/>;
      action = s.dropouts ? `Of ${num(s.dropouts)} students who left, ${num(groups.tuition[1].dropouts)} had current tuition. Use that count to weigh how far payment outreach alone could reach.` : 'No departures were recorded in this selection. Broaden the cohort to compare the reach of payment outreach.'; link='money'; break;
    case 'advising':
      metrics = <>{base}<Metric label="Passed under half" value={num(low.n)} detail="students with first-term results"/><Metric label="Dropout in that group" value={rate(low.dropouts,low.n)} detail={num(low.dropouts)+' recorded dropouts'}/></>;
      chart = <Comparison title="Dropout rate by first-term units passed" rows={groups.bands.map((r,i)=>({...r,label:BANDS[i].long}))} note="Pass rate is approved units divided by enrolled units. Students with zero enrolled units appear separately."/>;
      action='Use the first-term results to size an offer of advising appointments. Advisors would still need to ask students which barriers they faced.';link='academic'; break;
    case 'success': {
      const cross = groups.tRows.flatMap(([,t],i)=>groups.pCols.map(([,p],j)=>({...groups.heatTP[i][j],key:i+'-'+j,label:t+' · '+p})));
      metrics = <>{base}<Metric label="Both signals present" value={num(both.n)} detail="behind on tuition and passed under half"/><Metric label="Dropout with both" value={rate(both.dropouts,both.n)} detail={num(both.dropouts)+' recorded dropouts'}/></>;
      chart=<Comparison title="Tuition status and first-term progress" rows={cross} note="The comparison includes students with enrolled first-term units. The timing of the tuition record is unknown."/>;
      action='Estimate how many joint appointments financial aid and advising might offer so students can discuss both needs in one visit.';link='academic'; break; }
    case 'enrollment': {
      const programs=groups.courses.filter(r=>r.n).sort((a,b)=>rank==='count' ? b.dropouts-a.dropouts || b.n-a.n : b.dropRate-a.dropRate || b.n-a.n);
      const largest=programs[0];
      metrics=<>{base}<Metric label="Programs represented" value={num(programs.length)} detail="with students in this cohort"/><Metric label={rank==='count'?'Largest dropout count':'Highest dropout rate'} value={largest ? (rank==='count'?num(largest.dropouts):pct(largest.dropRate)):'—'} detail={largest?.label || 'No programs'}/></>;
      chart=<><div className="rank-controls"><span>Rank programs by</span>{['count','rate'].map(k=><button key={k} aria-pressed={rank===k} onClick={()=>setRank(k)}>Dropout {k}</button>)}</div><Comparison title={'Top programs by dropout '+rank} rows={programs.slice(0,5)} count={rank==='count'} note="Counts describe the number of departures. Rates account for program size. Small groups can move sharply with a single departure."/></>;
      action='Use counts to plan staffing and rates to identify programs for a closer review with department leads.';link='who';break;}
    default:
      metrics=null; chart=<Card title="Outreach simulator" wide note="These rules are exploratory. Tuition timing is unknown. Semester results become available only after the term."><FlagBuilder students={list}/></Card>;
      action='Compare the number of students who meet a rule with the appointments your office can offer. Coverage measures overlap with historical dropout outcomes.';link='alert';
  }
  return <section className="work-report" id="workspace" aria-labelledby="work-title">
    <span className="section-label">{profile.label}</span><h2 id="work-title" tabIndex={-1}>{profile.question}</h2>
    {s.n ? <>{metrics && <div className="metric-strip">{metrics}</div>}<div className="decision-grid"><div className="decision-chart">{chart}</div>
      <aside className="decision-note"><h3>What your team can do</h3><p>{action}</p><button onClick={()=>onExplore(link)}>Explore the evidence <span aria-hidden="true">↗</span></button></aside></div></> : <p className="empty-report">No matching students. Reset the cohort filters to see this workspace.</p>}
  </section>;
}
