import { useEffect, useMemo, useRef, useState } from 'react';
import { num, pct, summarize } from '../lib/data.js';
import { useInView } from './charts.jsx';
import '../simulator.css';

// Outreach simulator: staff choose the signs that put a student on the outreach
// list and the appointments available, and see whom that list would have
// reached in the historical cohort (nobody was contacted). The "stay enrolled"
// estimate comes only from an outreach success rate the user assumes.

const SIGNALS = [
  { id: 'tuition', name: 'Tuition not up to date', when: 'Known at any time', test: s => !s.tuitionOk },
  { id: 'failed', name: 'Passed under half of first-semester courses', when: 'Known after first-semester grades', test: s => s.pass1 !== null && s.pass1 < 0.5 },
  { id: 'debt', name: 'Other recorded debt', when: 'Known at any time', test: s => !!s.debtor },
  { id: 'nounits', name: 'No first-semester courses enrolled', when: 'Known at registration', test: s => s.pass1 === null },
  { id: 'noschol', name: 'No scholarship', when: 'Known at enrollment', test: s => !s.scholar },
];

const PRESETS = [
  { id: 'tuition', name: 'Tuition only', blurb: 'Financial aid follows up on missed payments.', signals: ['tuition'], mode: 'any', cap: null },
  { id: 'both', name: 'Tuition or grades', blurb: 'The early-alert list this dashboard proposes: tuition not up to date or passed under half of first-semester courses.', signals: ['tuition', 'failed'], mode: 'any', cap: null },
  { id: 'wide', name: 'Wide net', blurb: 'Every financial and academic sign.', signals: ['tuition', 'failed', 'debt', 'nounits', 'noschol'], mode: 'any', cap: null },
];

const MODES = [['any', 'At least one of these signs'], ['all', 'All of these signs']];

// Fixed-seed shuffle so ties (and "kept" dots) are picked the same way on every render.
function seeded(n) {
  let x = 20240917;
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) % 2147483648; r[i] = x / 2147483648; }
  return r;
}
const TIEBREAK = seeded(5000);
const tie = s => TIEBREAK[s.id % 5000];

function simulate(students, chosen, mode, cap) {
  const active = SIGNALS.filter(s => chosen.includes(s.id));
  const eligible = [];
  for (const s of students) {
    const hits = active.reduce((a, sig) => a + (sig.test(s) ? 1 : 0), 0);
    if (active.length && (mode === 'all' ? hits === active.length : hits > 0)) eligible.push({ s, hits });
  }
  eligible.sort((a, b) => b.hits - a.hits || tie(a.s) - tie(b.s));
  const slots = cap === null ? eligible.length : Math.min(cap, eligible.length);
  const list = eligible.slice(0, slots).map(x => x.s);
  return { invited: new Set(list.map(s => s.id)), list, inv: summarize(list), eligibleN: eligible.length };
}

function useThemeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', bump);
    return () => { mo.disconnect(); mq.removeEventListener?.('change', bump); };
  }, []);
  return tick;
}

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts from 0 to `value` once, the first time `active` turns true (~800ms, eased).
// Later value changes (slider, filters) show immediately.
function useCountUp(value, active) {
  const [shown, setShown] = useState(null);
  const done = useRef(false);
  const target = useRef(value);
  target.current = value;
  useEffect(() => {
    if (!active || done.current || prefersReduced()) { done.current = true; return; }
    let raf;
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / 800);
      if (t < 1) { setShown(Math.round(target.current * (1 - Math.pow(1 - t, 3)))); raf = requestAnimationFrame(tick); }
      else { done.current = true; setShown(null); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setShown(null); };
  }, [active]);
  if (done.current) return value;
  if (shown !== null) return shown;
  return active ? value : 0;
}

// One small student icon per student, sorted by status so each group reads as a block.
// The icon is one SVG path (head + shoulders, 10×13 units) drawn on a canvas via Path2D,
// which keeps ~4,400 icons cheap. Colours come from CSS tokens; a status change
// cross-fades over ~450ms, redrawing only the cells that changed.
const PERSON_PATH = 'M7.5 3.2A2.5 2.5 0 1 1 2.5 3.2A2.5 2.5 0 1 1 7.5 3.2Z M0.8 12.6C0.8 8.4 2.8 6.6 5 6.6S9.2 8.4 9.2 12.6Z';
const DOT_STYLE = {
  kept: { v: '--sim-kept', k: 1.14 },
  caught: { v: '--sim-left', k: 1 },
  missed: { v: '--sim-left', k: 0.92, ring: true },
  onlist: { v: '--sim-stay', k: 1 },
  off: { v: '--sim-dim', k: 1 },
};

function PersonIcon({ className }) {
  return <svg className={'sim-person ' + (className || '')} viewBox="0 0 10 13" aria-hidden="true" focusable="false"><path d={PERSON_PATH} /></svg>;
}

function DotField({ statuses, label, intro = 'done', delay = 0 }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const prev = useRef([]);
  const painted = useRef('');
  const swept = useRef(false);   // geometry/theme key when the canvas exactly shows prev.current
  const [width, setWidth] = useState(0);
  const theme = useThemeTick();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const css = getComputedStyle(c);
    const col = {};
    for (const k in DOT_STYLE) col[k] = css.getPropertyValue(DOT_STYLE[k].v).trim();
    const n = statuses.length;
    const narrow = width < 500;
    const cw = narrow ? 5 : 7, ch = narrow ? 7 : 9;
    const base = Math.min((cw - 1) / 10, (ch - 1) / 13);
    const cols = Math.max(1, Math.floor(width / cw));
    const rows = Math.max(1, Math.ceil(n / cols));
    const W = cols * cw, H = rows * ch;
    const dpr = window.devicePixelRatio || 1;
    const sized = c.width !== W * dpr || c.height !== H * dpr;
    if (sized) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    const ctx = c.getContext('2d');
    const path = new Path2D(PERSON_PATH);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = prev.current;
    const start = performance.now();
    const dur = reduce ? 0 : 450;
    const icon = (i, st, alpha) => {
      const d = DOT_STYLE[st];
      const sc = base * d.k;
      const x = (i % cols) * cw + (cw - 10 * sc) / 2;
      const y = Math.floor(i / cols) * ch + (ch - 13 * sc) / 2;
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * x, dpr * y);
      ctx.globalAlpha = alpha;
      if (d.ring) { ctx.strokeStyle = col[st]; ctx.lineWidth = 1 / sc; ctx.stroke(path); }
      else { ctx.fillStyle = col[st]; ctx.fill(path); }
    };
    const clearCell = i => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    };
    const key = `${W}x${H}@${dpr}:${theme}`;
    // Before the grid scrolls into view: keep it empty. First reveal: fill row by row (~0.9s).
    if (intro === 'hidden' && !swept.current) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      painted.current = ''; prev.current = []; return;
    }
    if (intro === 'sweep' && !swept.current && !reduce) {
      swept.current = true;
      let raf, drawnRows = 0;
      const t0 = performance.now() + delay;
      const sweepDur = 700;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const step = now => {
        const t = Math.max(0, Math.min(1, (now - t0) / sweepDur));
        const upto = Math.ceil(rows * (1 - Math.pow(1 - t, 2)));
        for (let r = drawnRows; r < upto; r++) for (let i = r * cols; i < Math.min(n, (r + 1) * cols); i++) icon(i, statuses[i], 1);
        ctx.globalAlpha = 1;
        drawnRows = upto;
        if (t < 1) raf = requestAnimationFrame(step);
        else { prev.current = statuses; painted.current = key; }
      };
      raf = requestAnimationFrame(step);
      return () => { cancelAnimationFrame(raf); prev.current = statuses; painted.current = ''; };
    }
    swept.current = true;
    // Cells whose status changes; everything else is drawn once.
    const changed = [];
    for (let i = 0; i < n; i++) if ((from[i] ?? statuses[i]) !== statuses[i]) changed.push(i);
    const animate = !sized && from.length === n && dur > 0 && changed.length > 0;
    // Full repaint only when the canvas doesn't already show `from` (resize, theme, interrupted fade).
    if (!animate || painted.current !== key) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) icon(i, animate ? from[i] : statuses[i], 1);
      ctx.globalAlpha = 1;
    }
    if (!animate) { prev.current = statuses; painted.current = key; return; }
    painted.current = '';
    let raf;
    const draw = now => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      for (const i of changed) {
        clearCell(i);
        if (t >= 1) icon(i, statuses[i], 1);
        else { icon(i, from[i], 1 - ease); icon(i, statuses[i], ease); }
      }
      ctx.globalAlpha = 1;
      if (t < 1) raf = requestAnimationFrame(draw);
      else { prev.current = statuses; painted.current = key; }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); prev.current = statuses; };
  }, [statuses, width, theme, intro, delay]);

  return <div className="sim-field" ref={wrap}><canvas ref={canvas} role="img" aria-label={label} /></div>;
}

function Stat({ label, value, detail, tone, i = 0 }) {
  return <div className={'sim-stat sim-stag' + (tone ? ' ' + tone : '')} style={{ '--i': i + 2 }}>
    <span className="sim-stat-l">{label}</span>
    <b>{value}</b>
    {detail && <small>{detail}</small>}
  </div>;
}

// Closed-by-default disclosure: a real button with aria-expanded controlling a region.
function Disclosure({ id, label, children, className = '' }) {
  const [open, setOpen] = useState(false);
  return <div className={'sim-disc ' + className + (open ? ' open' : '')}>
    <button type="button" className="sim-disc-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
      <span className="sim-chev" aria-hidden="true" />{label}
    </button>
    <div id={id} className="sim-disc-body" hidden={!open}>{children}</div>
  </div>;
}

// Split counts into 100 icons with largest-remainder rounding (each icon ≈ 1% of students).
function toHundred(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map(c => c / total * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

const inTen = r => (r * 10) % 1 === 0 ? `${r * 10} in 10` : `${Math.round(r * 100)} in 100`;

export default function FlagBuilder({ students }) {
  const [chosen, setChosen] = useState(['tuition', 'failed']);
  const [mode, setMode] = useState('any');
  const [limit, setLimit] = useState(false);
  const [cap, setCap] = useState(300);
  const [view, setView] = useState('dots');
  const [preset, setPreset] = useState('both');
  const [rate, setRate] = useState(0.2);
  const [minutes, setMinutes] = useState(45);

  const effMode = chosen.length < 2 ? 'any' : mode;
  const cohort = useMemo(() => summarize(students), [students]);
  const leftList = useMemo(() => students.filter(s => s.target === 0), [students]);
  const stayList = useMemo(() => students.filter(s => s.target !== 0), [students]);
  const sim = useMemo(() => simulate(students, chosen, effMode, limit ? cap : null), [students, chosen, effMode, limit, cap]);
  const bench = useMemo(() => simulate(students, ['tuition', 'failed'], 'any', null), [students]);
  const full = useMemo(() => simulate(students, chosen, effMode, null), [students, chosen, effMode]);
  const other = useMemo(() => chosen.length < 2 ? null : simulate(students, chosen, effMode === 'any' ? 'all' : 'any', limit ? cap : null), [students, chosen, effMode, limit, cap]);

  // What each selected sign adds on top of the others (with unlimited slots).
  const marginal = useMemo(() => chosen.length < 2 || effMode !== 'any' ? [] : SIGNALS.filter(s => chosen.includes(s.id)).map(sig => {
    const without = simulate(students, chosen.filter(c => c !== sig.id), effMode, null).inv;
    return { sig, n: full.inv.n - without.n, d: full.inv.dropouts - without.dropouts };
  }), [students, chosen, effMode, full]);

  const { inv } = sim;
  const caught = inv.dropouts;
  const keptN = Math.round(caught * rate);
  const applyPreset = p => {
    setPreset(p.id);
    setChosen(p.signals);
    setMode(p.mode);
    if (p.cap === null) setLimit(false);
    else {
      const need = simulate(students, p.signals, p.mode, null).eligibleN;
      setCap(Math.max(1, Math.round(need * p.cap)));
      setLimit(true);
    }
  };
  const toggle = id => { setPreset(null); setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]); };

  const reach = cohort.dropouts ? caught / cohort.dropouts : 0;
  const hit = inv.n ? caught / inv.n : 0;
  const missed = cohort.dropouts - caught;
  const stayedInvited = inv.n - caught;
  const short = sim.eligibleN - inv.n;
  const capMax = Math.max(1, full.eligibleN);
  const capValue = Math.min(cap, capMax);
  const newRate = cohort.n ? (cohort.dropouts - keptN) / cohort.n : 0;
  const hours = Math.round(inv.n * minutes / 60);

  const lead = !chosen.length
    ? 'Turn on at least one sign to build an outreach list.'
    : !inv.n
      ? 'No student in this selection matches these signs.'
      : `This list reaches ${num(inv.n)} students. ${num(caught)} of them dropped out without help. If outreach kept ${inTen(rate)}, about ${num(keptN)} more students would stay.`;

  let verdict = null, advice = '';
  if (inv.n) {
    verdict = hit >= 0.75 ? 'Focused list' : hit >= Math.max(0.5, cohort.dropRate * 1.6) ? 'Balanced list' : 'Broad list';
    const parts = [`About ${Math.round(hit * 10)} in 10 students on this list dropped out with no outreach, compared with ${Math.round(cohort.dropRate * 10)} in 10 across this selection.`];
    if (short > 0) parts.push(`${num(short)} more students match these signs but would wait for a later round. Students with more signs are seen first; ties are filled in a fixed random order. Enough slots for everyone would catch ${num(full.inv.dropouts - caught)} more dropouts.`);
    const weak = marginal.filter(m => m.n > 0 && m.d / m.n < 0.5).sort((a, b) => (b.n - b.d) - (a.n - a.d))[0];
    if (weak) parts.push(`“${weak.sig.name}” adds ${num(weak.n)} students to the list, and only ${pct(weak.d / weak.n, 0)} of them dropped out. Consider dropping it if appointments are scarce.`);
    if (!limit && chosen.join() !== 'tuition,failed' && bench.inv.n && reach < bench.inv.dropouts / cohort.dropouts - 0.05) parts.push(`The two-sign list catches ${pct(bench.inv.dropouts / cohort.dropouts, 0)} of dropouts with ${num(bench.inv.n)} students.`);
    advice = parts.join(' ');
  }


  // Scroll reveals: each block animates once when it first enters the viewport.
  const [presetsRef, presetsIn] = useInView({ threshold: 0.3 });
  const [controlsRef, controlsIn] = useInView({ threshold: 0.12 });
  const [resultsRef, resultsIn] = useInView({ threshold: 0.12 });
  const keptShown = useCountUp(keptN, resultsIn);
  const rv = on => 'sim-rv' + (on ? ' in' : '');
  const st = i => ({ '--i': i });

  const leftStatuses = useMemo(() => [
    ...Array(keptN).fill('kept'), ...Array(Math.max(0, caught - keptN)).fill('caught'), ...Array(missed).fill('missed'),
  ], [keptN, caught, missed]);
  const stayStatuses = useMemo(() => [
    ...Array(stayedInvited).fill('onlist'), ...Array(stayList.length - stayedInvited).fill('off'),
  ], [stayedInvited, stayList.length]);

  const extraOn = SIGNALS.slice(2).filter(sig => chosen.includes(sig.id)).length;
  const signalRow = (sig, i) => {
    const g = summarize(students.filter(sig.test));
    const on = chosen.includes(sig.id);
    return <label key={sig.id} className={'sim-signal sim-stag' + (on ? ' on' : '')} style={st(i)} title={`${num(g.n)} students · ${sig.when}`}>
      <input type="checkbox" checked={on} onChange={() => toggle(sig.id)} />
      <span className="sim-switch" aria-hidden="true" />
      <span className="sim-signal-t"><b>{sig.name}</b><small>{g.n ? pct(g.dropRate, 0) : '—'} dropped out<span className="sim-sr">, {num(g.n)} students, {sig.when.toLowerCase()}</span></small></span>
    </label>;
  };

  const cats = [
    ['kept', 'Kept (est.)', keptN],
    ['caught', 'Caught', Math.max(0, caught - keptN)],
    ['missed', 'Missed', missed],
    ['onlist', 'On list, stayed', stayedInvited],
    ['off', 'Not on list', stayList.length - stayedInvited],
  ];
  const icons = toHundred(cats.map(c => c[2]));
  const waffle = cats.flatMap(([k], i) => Array(icons[i]).fill(k));
  const per = Math.round(cohort.n / 100);

  return <div className="sim">
    <p className="sim-sr" aria-live="polite">{lead}</p>

    <div className={'sim-head ' + rv(presetsIn)} ref={presetsRef}>
      <h3>Outreach simulator</h3>
      <div className="sim-preset-row" role="group" aria-label="Scenarios">
        {PRESETS.map((p, i) => <button key={p.id} type="button" className="sim-preset sim-stag" style={st(i)} title={p.blurb} aria-pressed={preset === p.id} onClick={() => applyPreset(p)}>
          {p.name}<span className="sim-sr"> — {p.blurb}</span>
        </button>)}
      </div>
    </div>

    <div className="sim-body">
      <div className={'sim-controls ' + rv(controlsIn)} ref={controlsRef}>
        <fieldset>
          <legend className="sim-h">Who’s on the list</legend>
          {SIGNALS.map((sig, i) => signalRow(sig, i))}
        </fieldset>
        {chosen.length >= 2 && <div className="sim-combine sim-stag" style={st(5)}>
          <span id="sim-mode-l">Invite a student with</span>
          <div className="sim-mode" role="radiogroup" aria-labelledby="sim-mode-l">
            {MODES.map(([v]) => <label key={v} className={effMode === v ? 'on' : ''}>
              <input type="radio" name="sim-mode" value={v} checked={effMode === v} onChange={() => { setPreset(null); setMode(v); }} />{v === 'any' ? 'Any sign' : 'All signs'}
            </label>)}
          </div>
          {other && <small>{effMode === 'any' ? 'All signs' : 'Any sign'}: {num(other.inv.n)} students</small>}
        </div>}

        <Disclosure id="sim-capacity" label="Advanced: advising capacity" className="sim-stag">
          <label className={'sim-signal' + (limit ? ' on' : '')}>
            <input type="checkbox" checked={limit} onChange={e => { setPreset(null); setLimit(e.target.checked); if (e.target.checked && cap > capMax) setCap(Math.round(capMax / 2)); }} />
            <span className="sim-switch" aria-hidden="true" />
            <span className="sim-signal-t"><b>Limit appointments</b><small>{limit ? `${num(full.eligibleN)} students match` : 'Everyone on the list is seen'}</small></span>
          </label>
          {limit && <div className="sim-slider">
            <input type="range" min="0" max={capMax} step="1" value={capValue} aria-label="Appointments available" aria-valuetext={`${num(capValue)} appointments`} onChange={e => { setPreset(null); setCap(Number(e.target.value)); }} />
            <input type="number" min="0" max={capMax} value={capValue} aria-label="Appointments available, number" onChange={e => { setPreset(null); setCap(Math.max(0, Math.min(capMax, Math.floor(Number(e.target.value) || 0)))); }} />
          </div>}
          <label className="sim-minutes">Minutes per appointment
            <input type="number" min="5" max="240" step="5" value={minutes} onChange={e => setMinutes(Math.max(0, Math.min(600, Math.floor(Number(e.target.value) || 0))))} />
          </label>
          <p className="sim-note">≈ {num(hours)} advising hours for {num(inv.n)} appointments.</p>
        </Disclosure>
      </div>

      <div className={'sim-results ' + rv(resultsIn)} ref={resultsRef}>
        <section className="sim-step sim-stag" style={st(0)} aria-labelledby="sim-reach-h">
          <div className="sim-step-h">
            <h4 id="sim-reach-h" className="sim-h">Who this list reaches</h4>
            <div className="seg" role="group" aria-label="View as">
              <button type="button" className={view === 'dots' ? 'on' : ''} aria-pressed={view === 'dots'} onClick={() => setView('dots')}>Icons</button>
              <button type="button" className={view === 'table' ? 'on' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            </div>
          </div>
          <div className="sim-stats">
            <Stat i={0} label="On the list" value={num(inv.n)} detail={`${pct(cohort.n ? inv.n / cohort.n : 0, 0)} of students`} />
            <Stat i={1} label="Dropouts caught" value={num(caught)} detail={`${pct(reach, 0)} of all ${num(cohort.dropouts)} dropouts`} />
          </div>

          {view === 'dots' ? <div className="sim-waffle-wrap">
            <div className="sim-waffle" role="img" aria-label={`100 icons, each about ${num(per)} students: ${cats.map(([, l, c], i) => `${l} ${num(c)} (${icons[i]} icons)`).join(', ')}.`}>
              {waffle.map((k, i) => <svg key={i} className={'sim-w ' + k} style={{ '--d': i }} viewBox="0 0 10 13" aria-hidden="true" focusable="false"><path d={PERSON_PATH} /></svg>)}
            </div>
            <ul className="sim-legend">
              {cats.map(([k, l, c]) => <li key={k}><PersonIcon className={k === 'caught' ? 'left' : k === 'missed' ? 'ring' : k === 'onlist' ? 'stay' : k === 'off' ? 'dim' : 'kept'} /><span>{l}</span><b>{k === 'kept' ? '≈ ' : ''}{num(c)}</b></li>)}
              <li className="sim-per">Each icon ≈ {num(per)} students</li>
            </ul>
          </div> : <table className="sim-table">
            <caption className="sim-sr">Students on and off the outreach list by recorded outcome, with the estimated number kept</caption>
            <thead><tr><th scope="col">Recorded outcome</th><th scope="col">On the list</th><th scope="col">Not on the list</th><th scope="col">Total</th></tr></thead>
            <tbody>
              <tr><th scope="row">Dropped out</th><td>{num(caught)}</td><td>{num(missed)}</td><td>{num(cohort.dropouts)}</td></tr>
              <tr><th scope="row">Graduated or still enrolled</th><td>{num(stayedInvited)}</td><td>{num(stayList.length - stayedInvited)}</td><td>{num(stayList.length)}</td></tr>
              <tr><th scope="row">All students</th><td>{num(inv.n)}</td><td>{num(cohort.n - inv.n)}</td><td>{num(cohort.n)}</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">Estimated kept (assumes {inTen(rate)})</th><td>≈ {num(keptN)}</td><td>0</td><td>≈ {num(keptN)}</td></tr></tfoot>
          </table>}
        </section>

        <section className="sim-step sim-outcome sim-stag" style={st(2)} aria-labelledby="sim-rate-h">
          <h4 id="sim-rate-h" className="sim-h">If outreach works</h4>
          <label className="sim-rate" htmlFor="sim-rate-in">Outreach keeps <b>{inTen(rate)}</b> caught students enrolled <span className="sim-tag">assumption</span></label>
          <input id="sim-rate-in" className="sim-rate-in" type="range" min="0" max="50" step="5" value={Math.round(rate * 100)} aria-valuetext={`${inTen(rate)} students kept enrolled`} onChange={e => setRate(Number(e.target.value) / 100)} />
          <div className="sim-headline">
            <b>≈ {num(keptShown)}</b>
            <span>more students stay</span>
            <small>Dropout rate {pct(cohort.dropRate)} → <strong>{pct(newRate)}</strong></small>
          </div>
        </section>

        <p className="sim-honest">Historical data · no one was contacted · success rate is an assumption</p>

        <Disclosure id="sim-details" label="Explore the details" className="sim-details">
          {verdict && <div className="sim-verdict">
            <h5>{verdict}</h5>
            <p>{advice}</p>
          </div>}
          <dl className="sim-more">
            <div><dt>On the list who dropped out</dt><dd>{inv.n ? pct(hit, 0) : '—'} <small>vs. {pct(cohort.dropRate, 0)} overall</small></dd></div>
            <div><dt>Dropouts missed</dt><dd>{num(missed)} <small>not on the list</small></dd></div>
          </dl>
          {marginal.length > 0 && <div className="sim-marginal">
            <h5>What each sign adds</h5>
            <table className="sim-table">
              <thead><tr><th scope="col">Sign</th><th scope="col">Extra students</th><th scope="col">Of whom dropped out</th></tr></thead>
              <tbody>{marginal.map(m => <tr key={m.sig.id}>
                <th scope="row">{m.sig.name}</th><td>{num(m.n)}</td>
                <td>{m.n ? <><b>{pct(m.d / m.n, 0)}</b><span className="sim-bar" aria-hidden="true"><i style={{ width: pct(m.d / m.n) }} /></span></> : '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          <div className="sim-every">
            <h5>Every student ({num(cohort.n)})</h5>
            <div className="sim-field-h">Dropped out · {num(cohort.dropouts)}</div>
            <DotField statuses={leftStatuses} label={`${num(cohort.dropouts)} students who dropped out: about ${num(keptN)} estimated kept, ${num(Math.max(0, caught - keptN))} caught but not kept, ${num(missed)} missed.`} />
            <div className="sim-field-h">Graduated or still enrolled · {num(stayList.length)}</div>
            <DotField statuses={stayStatuses} label={`${num(stayList.length)} students who graduated or stayed: ${num(stayedInvited)} on the list, ${num(stayList.length - stayedInvited)} not.`} />
          </div>
          <p className="sim-note">The outcomes are history: they show who dropped out when no list existed. The “more students stay” figure depends entirely on the success rate you choose; a campus pilot is needed to learn the real rate.</p>
        </Disclosure>
      </div>
    </div>
  </div>;
}
