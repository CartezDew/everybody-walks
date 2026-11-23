import { useEffect, useMemo, useState } from 'react';
import {
  STUDENTS, COURSES, AGE_GROUPS, BANDS, MARITAL, APP_MODES, DEFAULT_FILTERS,
  applyFilters, summarize, groupRates, pct, num,
} from './lib/data.js';
import { Donut, RateBars, Columns, StackedOutcomes, Heatmap, CourseScatter, rateCols } from './components/charts.jsx';
import { Logo, GraduationCap, Kpi, Card, Section, FilterBar } from './components/ui.jsx';
import { RolePicker, Workspace, OutreachComparison } from './components/Workspaces.jsx';
import FlagBuilder from './components/FlagBuilder.jsx';
import ExplorerNav from './components/ExplorerNav';
import AIInsights from './components/AIInsights';
import Recommendations from './components/Recommendations.jsx';
import Demographics from './components/Demographics';
import { UnemploymentChart, RateReachRows, Verdict, unempVerdict, maritalVerdict, gapVerdict } from './components/SignalCharts.jsx';

const OUTCOME_COLORS = ['var(--drop)', 'var(--enr)', 'var(--grad)'];
const OUTCOME_NAMES = ['Dropout', 'Enrolled', 'Graduate'];
const NAV = [
  ['overview', 'Overview'],
  ['demographics', 'Demographics'],
  ['money', 'Financial strain'],
  ['academic', 'Academic signs'],
  ['alert', 'Outreach planner'],
  ['who', 'Who leaves'],
  ['more', 'More signals'],
  ['insights', 'AI Insights'],
  ['act', 'Recommendations'],
  ['methods', 'Methods'],
];

const cell = (list, f) => {
  const s = summarize(list.filter(f));
  return s;
};

function DatasetLinks() {
  return <div className="dataset-links">
    <span>Full study data · {num(STUDENTS.length)} student records</span>
    <a className="dataset-download" href="data/student_dropout_decoded.csv" download>Download CSV <span aria-hidden="true">↓</span></a>
    <a href="https://archive.ics.uci.edu/dataset/697/predict+students+dropout+and+academic+success" target="_blank" rel="noreferrer">View UCI source <span aria-hidden="true">↗</span></a>
  </div>;
}

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; }
  });
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const all = useMemo(() => summarize(STUDENTS), []);
  const list = useMemo(() => applyFilters(STUDENTS, filters), [filters]);
  const S = useMemo(() => summarize(list), [list]);

  // ---- full-population headline facts (poster numbers) ----
  const H = useMemo(() => {
    const t = groupRates(STUDENTS, (s) => s.tuitionOk, [0, 1]);
    const sc = groupRates(STUDENTS, (s) => s.scholar, [1, 0]);
    const d = groupRates(STUDENTS, (s) => s.debtor, [1, 0]);
    return { t, sc, d };
  }, []);

  // ---- filtered groupings ----
  const G = useMemo(() => {
    const yesNo = (k, yes, no) => groupRates(list, (s) => s[k], [1, 0], [yes, no]);
    const tuition = groupRates(list, (s) => s.tuitionOk, [0, 1], ['Tuition not up to date', 'Tuition up to date']);
    const debtor = yesNo('debtor', 'Debtor', 'Not a debtor');
    const scholar = yesNo('scholar', 'Scholarship holder', 'No scholarship');
    const bands = groupRates(list, (s) => s.band1, BANDS.map((b) => b.key), BANDS.map((b) => b.label)).map((r) => (r.key === 'none' ? { ...r, color: 'var(--muted-bar)' } : r));
    const bands2 = groupRates(list, (s) => s.band2, BANDS.map((b) => b.key), BANDS.map((b) => b.label)).map((r) => (r.key === 'none' ? { ...r, color: 'var(--muted-bar)' } : r));
    const age = groupRates(list, (s) => s.ageGroup, AGE_GROUPS);
    const gender = groupRates(list, (s) => s.male, [0, 1], ['Female', 'Male']);
    const attend = groupRates(list, (s) => s.evening, [0, 1], ['Daytime', 'Evening']);
    const displaced = groupRates(list, (s) => s.displaced, [1, 0], ['Displaced (moved for study)', 'Not displaced']);
    const courses = groupRates(list, (s) => s.courseName, COURSES, COURSES);
    const coursesAll = groupRates(applyFilters(STUDENTS, { ...filters, course: 'All' }), (s) => s.courseName, COURSES, COURSES);
    const app = groupRates(list, s => APP_MODES[s.appMode], APP_MODES)
      .filter(row => row.n > 0).sort((a, b) => b.n - a.n).slice(0, 7);
    const marital = groupRates(list, (s) => s.marital, MARITAL.map((_, i) => i), MARITAL);
    const special = groupRates(list, (s) => s.special, [1, 0], ['Special educational needs', 'No special needs']);
    const intl = groupRates(list, (s) => s.intl, [1, 0], ['International', 'Domestic']);

    // admission grade quintiles (cut points from full data so bins stay fixed under filters)
    const sorted = STUDENTS.map((s) => s.admGrade).sort((a, b) => a - b);
    const q = [1, 2, 3, 4].map((i) => sorted[Math.floor((sorted.length * i) / 5)]);
    const qLab = ['Lowest 20%', '2nd', '3rd', '4th', 'Highest 20%'];
    const admQ = (g) => (g < q[0] ? 0 : g < q[1] ? 1 : g < q[2] ? 2 : g < q[3] ? 3 : 4);
    const adm = groupRates(list, (s) => admQ(s.admGrade), [0, 1, 2, 3, 4], qLab.map((l, i) => l));

    const unempVals = [...new Set(STUDENTS.map((s) => s.unemp))].sort((a, b) => a - b);
    const unemp = groupRates(list, (s) => s.unemp, unempVals, unempVals.map((u) => `${u}%`));

    // heatmaps
    const tRows = [[(s) => !s.tuitionOk, 'Not up to date'], [(s) => s.tuitionOk, 'Up to date']];
    const scCols = [[(s) => !s.scholar, 'No scholarship'], [(s) => s.scholar, 'Scholarship']];
    const heatTS = tRows.map(([rf]) => scCols.map(([cf]) => cell(list, (s) => rf(s) && cf(s))));
    const lowPass = (s) => s.pass1 !== null && s.pass1 < 0.5;
    const hiPass = (s) => s.pass1 !== null && s.pass1 >= 0.5;
    const pCols = [[lowPass, 'Passed < 50%'], [hiPass, 'Passed ≥ 50%']];
    const heatTP = tRows.map(([rf]) => pCols.map(([cf]) => cell(list, (s) => rf(s) && cf(s))));
    const low2 = (s) => s.pass2 !== null && s.pass2 < 0.5;
    const traj = pCols.map(([rf]) => [cell(list, (s) => rf(s) && low2(s)), cell(list, (s) => rf(s) && s.pass2 !== null && s.pass2 >= 0.5)]);

    // grade distortion
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const grades = [0, 1, 2].map((t) => {
      const g = list.filter((s) => s.target === t).map((s) => s.g1);
      return { outcome: OUTCOME_NAMES[t], withZero: mean(g), noZero: mean(g.filter((v) => v > 0)), zeros: g.filter((v) => v === 0).length, n: g.length };
    });

    return { tuition, debtor, scholar, bands, bands2, age, gender, attend, displaced, courses, coursesAll, app, marital, special, intl, adm, unemp, heatTS, heatTP, traj, grades, tRows, scCols, pCols };
  }, [list, filters]);

  const VU = unempVerdict(G.unemp);
  const VM = maritalVerdict(G.marital, S.dropRate);
  const VG = gapVerdict([{ title: 'Educational needs', rows: G.special }, { title: 'International status', rows: G.intl }]);
  const lowPassGroup =summarize(list.filter(s => s.pass1 !== null && s.pass1 < 0.5));
  const higherPassGroup = summarize(list.filter(s => s.pass1 !== null && s.pass1 >= 0.5));
  const tuitionMax = 1;
  const [role, setRole] = useState('leadership');
  const [page, setPage] = useState(() => NAV.some(([id]) => '#'+id === location.hash) ? 'explorer' : 'workspace');
  useEffect(() => {
    const target = NAV.find(([id]) => '#' + id === window.location.hash);
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(target[0])?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);
  function go(id) {
    setMenu(false);
    setPage(['top', 'roles', 'workspace'].includes(id) ? 'workspace' : 'explorer');
    requestAnimationFrame(() => (document.getElementById(id) || document.getElementById('main'))?.scrollIntoView({ block: 'start' }));
  }
  function chooseRole(id) {
    setRole(id);
    setPage('workspace');
    requestAnimationFrame(() => document.getElementById('work-title')?.focus({ preventScroll: true }));
    if (window.matchMedia('(max-width: 700px)').matches) requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({block:'start'}));
  }
  const filterNote = Object.values(filters).some((v) => v !== 'All') ? ' (current filter)' : '';

  const outcomeCards = (
    <div className="kpis wide" role="group" aria-label="Outcomes in the selected cohort">
      <Kpi featured="graduation" icon={<GraduationCap/>} label="Graduation rate" value={S.gradRate} format={pct}
        sub={`${num(S.graduates)} of ${num(S.n)} students`} accent="var(--grad)" />
      <Kpi featured="dropout" label="Dropout rate" value={S.dropRate} format={pct}
        sub={`${num(S.dropouts)} of ${num(S.n)} students`} accent="var(--drop)" />
      <Kpi label="Students" value={S.n} format={v => num(Math.round(v))} sub="in selected cohort" />
      <Kpi label="Still enrolled" value={S.enrRate} format={pct} sub={`${num(S.enrolled)} students`} />
      <Kpi label="Dropouts" value={S.dropouts} format={v => num(Math.round(v))}
        sub={`Rate 95% CI ${pct(S.ci[0])}–${pct(S.ci[1])}`} />
    </div>
  );

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>

      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); go('top'); }}>
            <Logo />
            <span className="brand-t">
              <b>Everyone Walks</b>
              <small>Student retention dashboard</small>
            </span>
          </a>
          <nav className={`nav${menu ? ' open' : ''}`} aria-label="Sections">
            <button onClick={() => go('roles')} aria-current={page==='workspace' ? 'page' : undefined}>Workspaces</button>
            <button onClick={() => go('overview')}>Data explorer</button>
            <button onClick={() => go('methods')}>Methods</button>
          </nav>
          <div className="topbar-act">
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}
              aria-label={`Theme: ${theme}. Click to change.`}
              title={`Theme: ${theme}`}
            >
              {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
            </button>
            <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Menu">☰</button>
          </div>
        </div>
      </header>

      <section className="sleeve" id="top" aria-labelledby="cover-title">
        <div className="sleeve-in">
          <div className="cover-copy">
            <div className="cover-intro">
              <p className="cover-credit">MSA 8030 <i/> Team 4 <i/> Fall 2026</p>
              <h1 id="cover-title">When the money<br/><em>runs short</em></h1>
              <p className="cover-lede">Where could financial aid and advising make a difference?</p>
            </div>
            <div className="cover-actions">
              <button className="cover-action" onClick={() => go('overview')}>See who’s at risk <span aria-hidden="true">↓</span></button>
              <button className="cover-action cover-secondary" onClick={() => go('roles')}>Choose your role <span aria-hidden="true">→</span></button>
            </div>
          </div>
          <div className="cover-art" aria-hidden="true"><div className="record"/><img className="cover-mascot" src="varsity-bear.webp" alt="" width="760" height="760" fetchpriority="high"/></div>
        </div>
      </section>
      <div className="source-line"><span>Study cohort</span><b>{num(all.n)} students</b><i/>One Portuguese institution<i/>2008/09–2018/19</div>
      {page === 'workspace' && <div className="landing-outcomes">{S.n ? outcomeCards : <p className="empty-report">No students match the selected filters.</p>}</div>}
      <RolePicker role={page==='workspace' ? role : null} onSelect={chooseRole}/>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        defaults={DEFAULT_FILTERS}
        options={{ courses: COURSES, ages: AGE_GROUPS }}
        n={S.n}
        total={all.n}
      />

      <main id="main" className={page === 'explorer' ? 'explorer-layout' : undefined}>
        {page==='workspace' ? <Workspace role={role} list={list} groups={G} summary={S} onExplore={go}/> : <>
        <ExplorerNav items={NAV} go={go} hasData={S.n > 0}/>
        <div className="explorer-content">
        {!S.n ? <div id="overview"><p className="empty-report" role="status">No students match these filters. Reset the filters to compare outcomes.</p><DatasetLinks/><Demographics students={STUDENTS} filters={filters} setFilters={setFilters} /></div> : <>
        <Section id="overview" kicker="01 · The problem" title="Student outcomes in the selected cohort" intro="Outcomes are recorded at the end of each student's normal program length. 'Enrolled' means the student was still studying, which is neither a graduation nor a dropout.">
          {outcomeCards}
          <div className="wide"><DatasetLinks/></div>
          <Card
            title={`Student outcomes${filterNote}`}
            takeaway={`${pct(S.dropRate)} dropped out and ${pct(S.gradRate)} graduated.`}
            table={{ rows: [0, 1, 2].map((i) => ({ o: OUTCOME_NAMES[i], n: [S.dropouts, S.enrolled, S.graduates][i] })), cols: [{ k: 'o', h: 'Outcome' }, { k: 'n', h: 'Students', num: true, f: (r) => num(r.n) }, { k: 'p', h: 'Share', num: true, f: (r) => (S.n ? pct(r.n / S.n) : '–') }] }}
          >
            <Donut
              total={S.n}
              centerValue={pct(S.dropRate)}
              centerLabel="dropped out"
              segments={[
                { label: 'Dropout', value: S.dropouts, color: 'var(--drop)' },
                { label: 'Enrolled', value: S.enrolled, color: 'var(--enr)' },
                { label: 'Graduate', value: S.graduates, color: 'var(--grad)' },
              ]}
            />
          </Card>
          <Card title="Financial strain and student dropout" takeaway="Which students could benefit from a financial aid conversation? Start with tuition, then compare debt and scholarship outcomes.">
            <button className="btn-ghost" onClick={() => go('money')}>Compare financial outcomes →</button>
          </Card>
        </Section>

        <Demographics students={STUDENTS} filters={filters} setFilters={setFilters} />

        <Section id="money" kicker="03 · Main story" title="How do outcomes vary with financial strain?" intro="Compare recorded outcomes within each tuition, scholarship, and debt group. The filters set the students included in each comparison.">
          <Card
            wide
            title="Dropout rate by tuition status"
            takeaway={G.tuition[0].n && G.tuition[1].n ? `Students behind on tuition dropped out at ${pct(G.tuition[0].dropRate)} compared with ${pct(G.tuition[1].dropRate)} for students whose tuition was current.` : 'Not enough students in both groups for this selection.'}
            table={{ rows: G.tuition, cols: [...rateCols('Tuition status'), { k: 'share', h: 'Share of dropouts', num: true, f: (r) => S.dropouts ? pct(r.share) : '—' }] }}
            note={S.dropouts ? `${num(G.tuition[1].dropouts)} of ${num(S.dropouts)} recorded departures in this selection (${pct(G.tuition[1].share)}) had current tuition. A payment-only rule would miss those students.` : 'This selection has no recorded departures. Coverage cannot be calculated.'}
          >
            <RateBars rows={G.tuition} overall={S.dropRate} max={tuitionMax} showShare />
          </Card>
          <Card
            title="Dropout rate by debtor status"
            takeaway={G.debtor[0].n && G.debtor[1].n ? `Students with outstanding debt dropped out at ${pct(G.debtor[0].dropRate)}, compared with ${pct(G.debtor[1].dropRate)} among students without recorded debt.` : ''}
            table={{ rows: G.debtor, cols: rateCols('Debtor') }}
            note="Financial aid can check outstanding balances even when tuition is current. Offer a payment-plan or emergency-aid consultation and ask advising to follow up with the student’s permission."
          >
            <RateBars rows={G.debtor} overall={S.dropRate} />
          </Card>
          <Card
            title="Outcomes by scholarship status"
            takeaway={G.scholar[0].n && G.scholar[1].n ? `${pct(G.scholar[0].dropRate)} of scholarship holders dropped out, compared with ${pct(G.scholar[1].dropRate)} of students without a scholarship. Graduation rates were ${pct(G.scholar[0].gradRate)} and ${pct(G.scholar[1].gradRate)}, respectively.` : ''}
            table={{ rows: G.scholar, cols: [...rateCols('Scholarship'), { k: 'enrRate', h: 'Still enrolled %', num: true, f: r => r.n ? pct(r.enrRate) : '–' }] }}
            note="Financial aid can review who qualifies, who applies, and where applications stall. Differences in eligibility and prior achievement may contribute to the observed gap."
          >
            <StackedOutcomes rows={G.scholar} colors={OUTCOME_COLORS} names={OUTCOME_NAMES} />
          </Card>
          <Card
            wide
            title="Tuition × scholarship: the two together"
            takeaway={G.heatTS[0][0].n && G.heatTS[1][1].n ? `Behind on tuition with no scholarship: ${pct(G.heatTS[0][0].dropRate)} dropout. Current with a scholarship: ${pct(G.heatTS[1][1].dropRate)}.` : ''}
            table={{ rows: G.tRows.flatMap(([, r], ri) => G.scCols.map(([, c], ci) => ({ label: `${r} · ${c}`, ...G.heatTS[ri][ci] }))), cols: rateCols('Tuition · Scholarship') }}
          >
            <Heatmap overall={S.dropRate} rowTitle="Tuition" colTitle="Scholarship" rowLabels={G.tRows.map((r) => r[1])} colLabels={G.scCols.map((c) => c[1])} cells={G.heatTS} />
          </Card>
          <Card wide title="Use a missed payment to offer support" takeaway="Financial aid can contact a student within weeks of a missed payment, offer a payment plan or emergency aid, and review whether they qualify for scholarships. Confirm locally when payment records become available.">
            <p>For students whose payments are current, advisors have another checkpoint once first-semester results arrive.</p>
            <button className="btn-ghost" onClick={() => go('academic')}>Explore first-semester progress →</button>
          </Card>
        </Section>

        <Section id="academic" kicker="04 · Closing the gap" title="How does first-term progress relate to dropout?" intro={lowPassGroup.n && higherPassGroup.n ? `Among students who passed under half their first-term units, ${pct(lowPassGroup.dropRate)} dropped out, compared with ${pct(higherPassGroup.dropRate)} among those who passed at least half. Students with no enrolled units are shown separately.` : "Compare first-term progress after grades are available. Students with no enrolled units are shown separately."}>
          <div className="wide"><OutreachComparison tuition={G.tuition[0]} additional={G.heatTP[1][0]} summary={S}/></div>
          <Card
            wide
            title="Dropout rate by share of 1st-semester courses passed"
            takeaway={G.bands[0].n && G.bands[3].n ? `Students who passed no first-semester courses dropped out at ${pct(G.bands[0].dropRate)}. Students who passed every course dropped out at ${pct(G.bands[3].dropRate)}.` : ''}
            table={{ rows: G.bands, cols: rateCols('Courses passed') }}
            note="'No units' marks students who enrolled in no first-semester units (for example, credited transfers). They are shown separately and kept out of the pass-rate bands."
          >
            <Columns rows={G.bands} overall={S.dropRate} xLabel="Share of enrolled 1st-semester units passed" />
          </Card>
          <Card
            title="Both warning signs together"
            takeaway={G.heatTP[0][0].n && G.heatTP[1][1].n ? `Students with both signs dropped out at ${pct(G.heatTP[0][0].dropRate)}. Students with neither sign dropped out at ${pct(G.heatTP[1][1].dropRate)}.` : ''}
            table={{ rows: G.tRows.flatMap(([, r], ri) => G.pCols.map(([, c], ci) => ({ label: `${r} · ${c}`, ...G.heatTP[ri][ci] }))), cols: rateCols('Tuition · 1st-sem') }}
          >
            <Heatmap overall={S.dropRate} rowTitle="Tuition" colTitle="1st-semester courses passed" rowLabels={G.tRows.map((r) => r[1])} colLabels={G.pCols.map((c) => c[1])} cells={G.heatTP} />
          </Card>
          <Card
            title="Second-term progress"
            takeaway={G.traj[0][1].n && G.traj[0][0].n ? `Students who struggled in the first semester but passed at least half in the second dropped out at ${pct(G.traj[0][1].dropRate)}. Those who kept struggling dropped out at ${pct(G.traj[0][0].dropRate)}.` : ''}
            table={{ rows: G.pCols.flatMap(([, r], ri) => ['2nd < 50%', '2nd ≥ 50%'].map((c, ci) => ({ label: `1st ${r} · ${c}`, ...G.traj[ri][ci] }))), cols: rateCols('Trajectory') }}
            note="Both terms must have enrolled units for this comparison. Second-term results become available after the first advising checkpoint."
          >
            <Heatmap overall={S.dropRate} rowTitle="1st semester" colTitle="2nd-semester courses passed" rowLabels={G.pCols.map((c) => c[1])} colLabels={['Passed < 50%', 'Passed ≥ 50%']} cells={G.traj} />
          </Card>
          <Card
            title="First-term grades with and without recorded zeros"
            takeaway="Removing zero grades changes which students contribute to the mean. Compare both calculations on the same 0–20 scale."
            table={{ rows: G.grades, cols: [{ k: 'outcome', h: 'Outcome' }, { k: 'withZero', h: 'Mean incl. zeros', num: true, f: (r) => r.withZero?.toFixed(2) ?? '—' }, { k: 'noZero', h: 'Mean excl. zeros', num: true, f: (r) => r.noZero?.toFixed(2) ?? '—' }, { k: 'zeros', h: 'Zero grades', num: true, f: (r) => num(r.zeros) }] }}
          >
            <div className="gradecmp">
              {G.grades.map((g, i) => (
                <div className="gc-row" key={g.outcome}>
                  <div className="gc-l"><span className="sw" style={{ background: OUTCOME_COLORS[i] }} />{g.outcome}</div>
                  <div className="gc-track">
                    <div className="gc-bar ghost" style={{ width: `${(g.noZero / 20) * 100}%` }}><span>{g.noZero?.toFixed(1) ?? '—'}</span></div>
                    <div className="gc-bar" style={{ width: `${(g.withZero / 20) * 100}%`, background: OUTCOME_COLORS[i] }}><span>{g.withZero?.toFixed(1) ?? '—'}</span></div>
                  </div>
                </div>
              ))}
              <div className="rb-foot"><span className="sw solid" /> mean including zeros <span className="sw ghost-sw" /> mean excluding zeros · grade scale 0–20</div>
            </div>
          </Card>
        </Section>

        <Section id="alert" kicker="05 · Interactive" title="Plan retention outreach" intro="Pick the signs that put a student on the outreach list, then see who it would reach.">
          <article className="card wide sim-card">
            <FlagBuilder students={list} />
          </article>
        </Section>

        <Section id="who" kicker="06 · Drill down" title="Who is leaving, and from which programs?" intro="Dropout is not spread evenly. Use rates and counts together: a small program with a high rate and a large program with a modest rate can both need attention.">
          <Card
            wide
            title="Programs: size vs dropout rate"
            takeaway="Click a bubble to filter the whole dashboard to that program. Click it again to clear the filter."
            table={{ rows: [...G.coursesAll].sort((a, b) => b.dropRate - a.dropRate), cols: rateCols('Program') }}
          >
            <CourseScatter rows={G.coursesAll.filter((r) => r.n > 0)} overall={summarize(applyFilters(STUDENTS, { ...filters, course: 'All' })).dropRate} selected={filters.course} onSelect={(c) => setFilters({ ...filters, course: c })} />
          </Card>
          <Card title="By age at enrollment" takeaway={G.age[0].n && G.age[2].n ? `Students aged 25–34 at entry dropped out at ${pct(G.age[2].dropRate)}, compared with ${pct(G.age[0].dropRate)} for students under 21.` : ''} table={{ rows: G.age, cols: rateCols('Age') }}>
            <RateBars rows={G.age} overall={S.dropRate} />
          </Card>
          <Card title="By gender and attendance" takeaway="Compare women with men, and daytime with evening students. Each student appears in one group in each comparison." table={{ rows: [...G.gender, ...G.attend], cols: rateCols('Group') }} note="Describe these as groups that need support, not as students who are likely to fail.">
            <RateBars rows={[...G.gender, ...G.attend]} overall={S.dropRate} />
          </Card>
          <Card title="Most common admission routes" takeaway="Up to seven routes are shown, ordered by the number of students in this selection." table={{ rows: G.app, cols: rateCols('Application mode') }}>
            <RateBars rows={G.app} overall={S.dropRate} />
          </Card>
          <Card title="Moving for study" takeaway={G.displaced[0].n && G.displaced[1].n ? `Students who moved away from home to study had a recorded dropout rate of ${pct(G.displaced[0].dropRate)} vs ${pct(G.displaced[1].dropRate)} for other students.` : ''} table={{ rows: G.displaced, cols: rateCols('Displaced') }}>
            <RateBars rows={G.displaced} overall={S.dropRate} />
          </Card>
        </Section>

        <Section id="more" kicker="07 · Beyond the proposal" title="More signals we tested" intro="Some fields show clear patterns. Others show no consistent pattern, and reporting those keeps the main story honest.">
          <Card title="Admission grade (fifths of all students)" takeaway={G.adm[0].n && G.adm[4].n ? `Dropout was ${pct(G.adm[0].dropRate)} in the lowest admission-grade band and ${pct(G.adm[4].dropRate)} in the highest.` : 'Grade cutoffs come from the full study and stay fixed when you filter.' } table={{ rows: G.adm, cols: rateCols('Admission grade') }}>
            <Columns rows={G.adm} overall={S.dropRate} xLabel="Admission grade quintile (low → high)" />
          </Card>
          <Card title="Does the economy predict who leaves?" takeaway={VU.text} table={{ rows: G.unemp, cols: rateCols('National unemployment at entry') }} note="Each dot is a group of students who enrolled when Portugal’s national unemployment rate was at that level. It describes the economy at entry, not whether a student had a job. Hover or tab through the dots for counts.">
            <Verdict {...VU} />
            <UnemploymentChart rows={G.unemp} overall={S.dropRate} />
          </Card>
          <Card wide title="Marital status: who leaves most often vs. who makes up most departures" takeaway={VM.text} table={{ rows: G.marital, cols: rateCols('Marital status') }} note="Read the dot for risk within a group and the bar for its share of all departures. Married students are older on average, so use the age filter to check whether the gap holds among students of similar ages.">
            <Verdict {...VM} />
            <RateReachRows sections={[{ rows: G.marital }]} overall={S.dropRate} />
          </Card>
          <Card wide title="Do smaller student groups stand out?" takeaway={VG.text} note="Each student appears once in each comparison. Wide bands mean few students, so a single departure moves the rate. Ask students directly what support they need." table={{ rows: [...G.special, ...G.intl], cols: rateCols('Group') }}>
            <Verdict {...VG} />
            <RateReachRows sections={[{ title: 'Educational needs', rows: G.special }, { title: 'International status', rows: G.intl }]} overall={S.dropRate} reach={false} />
          </Card>
        </Section>

        </>}
        <AIInsights students={list}/>
        <Recommendations />

        <Section id="methods" kicker="09 · Transparency" title="Data, methods, and limitations">
          <div className="wide"><DatasetLinks/></div>
          <Card title="Data source">
            <ul className="plain">
              <li><b>Dataset:</b> Predict Students' Dropout and Academic Success, UCI Machine Learning Repository. <a href="https://doi.org/10.24432/C5MC89" target="_blank" rel="noreferrer">DOI 10.24432/C5MC89</a>. Decoded and adapted under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</li>
              <li><b>Paper:</b> Realinho, V., Machado, J., Baptista, L., &amp; Martins, M. V. (2022). <i>Data</i>, 7(11), 146. <a href="https://doi.org/10.3390/data7110146" target="_blank" rel="noreferrer">DOI 10.3390/data7110146</a></li>
              <li><b>Unit:</b> one row per student ({num(all.n)} students), from one Portuguese higher-education institution, academic years 2008/09 to 2018/19.</li>
              <li><b>Collected from:</b> the institution's academic and administrative records, plus national macroeconomic data.</li>
            </ul>
          </Card>
          <Card title="Preparation and definitions">
            <ul className="plain">
              <li>Numeric codes were decoded into labels (course, marital status, application mode, yes/no fields). The team checked for missing values (0 missing cells) and exact duplicate rows (0).</li>
              <li><b>Dropout rate</b> = dropouts ÷ all students in the group. 'Enrolled' stays in the denominator.</li>
              <li><b>Pass rate</b> = approved ÷ enrolled 1st-semester units, only where enrolled &gt; 0. The 180 students with no enrolled units are shown separately.</li>
              <li><b>95% intervals</b> use the Wilson score method. Wider intervals indicate less precision under a binomial sampling model. They do not account for differences between institutions.</li>
              <li><b>Coverage</b> = flagged dropouts ÷ all dropouts. <b>Workload</b> = flagged ÷ all students.</li>
            </ul>
          </Card>
          <Card title="Limitations">
            <ul className="plain">
              <li>Data from a single Portuguese institution, so results may not apply to other universities or countries.</li>
              <li>Associations only. No causal or predictive model was built. Scholarship and tuition gaps may reflect eligibility, prior achievement, or program mix.</li>
              <li>The data does not say when tuition status was recorded. Some students may have stopped paying because they were already leaving.</li>
              <li>Semester results are not known at enrollment, so these signs apply after the first semester, not at admission.</li>
              <li>'Enrolled' is an unresolved status, not a future graduation. The 50% pass threshold is exploratory, not an institutional standard.</li>
              <li>Nationality and parent occupation remain numeric codes and are not analyzed here. Parent education is used only to mark first-generation students in AI Insights.</li>
            </ul>
          </Card>
          <Card title="Behind Everyone Walks" takeaway="Everyone Walks is our nod to Jesus Walks and Graduation Day on The College Dropout. For a student, walking means crossing the graduation stage. We built this dashboard around the check-ins that can happen along the way.">
            <ul className="plain">
              <li><b>Merachew Gebremariam:</b> topic, proposal, number verification, poster text.</li>
              <li><b>Cartez Dewberry:</b> project plan, dashboard design and build.</li>
              <li><b>Carson Johnston:</b> decoded dataset, presentation, review and submission.</li>
            </ul>
          </Card>
        </Section>
        </div></>}
      </main>

      <footer className="footer">
        <div className="footer-in">
          <div className="brand"><Logo size={28} /><span className="brand-t"><b>Everyone Walks</b><small>Team 4 · MSA 8030 · Georgia State University · Fall 2026</small></span></div>
          <p className="footer-credit"><GraduationCap/><span>Student project at Georgia State University. The records describe historical outcomes at a Portuguese institution.</span></p>
        </div>
      </footer>
    </>
  );
}
