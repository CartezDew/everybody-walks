// Data layer: decodes the compact JSON produced by scripts/prepare_data.py and
// provides the metric definitions used everywhere in the dashboard.
import raw from '../data/students.json';

export const TARGETS = raw.targets; // ["Dropout","Enrolled","Graduate"]
export const COURSES = raw.dims['Course'];
export const MARITAL = raw.dims['Marital status'];
export const APP_MODES = raw.dims['Application mode'];

export const AGE_GROUPS = ['Under 21', '21–24', '25–34', '35+'];
export const BANDS = [
  { key: '0', label: '0%', long: 'Passed none' },
  { key: 'lt50', label: '1–49%', long: 'Passed some, under half' },
  { key: 'lt100', label: '50–99%', long: 'Passed at least half, below 100%' },
  { key: '100', label: '100%', long: 'Passed all' },
  { key: 'none', label: 'No units', long: 'No units enrolled' },
];

const ageGroup = (a) => (a < 21 ? AGE_GROUPS[0] : a < 25 ? AGE_GROUPS[1] : a < 35 ? AGE_GROUPS[2] : AGE_GROUPS[3]);
export const approvalBand = (enrolled, approved) => {
  if (enrolled === 0) return 'none';
  const p = approved / enrolled;
  return p === 0 ? '0' : p < 0.5 ? 'lt50' : p < 1 ? 'lt100' : '100';
};

const F = raw.fields;
export const STUDENTS = raw.rows.map((r, id) => {
  const o = { id };
  F.forEach((f, i) => (o[f] = r[i]));
  o.courseName = COURSES[o.course];
  o.ageGroup = ageGroup(o.age);
  o.band1 = approvalBand(o.e1, o.a1);
  o.band2 = approvalBand(o.e2, o.a2);
  o.pass1 = o.e1 > 0 ? o.a1 / o.e1 : null;
  o.pass2 = o.e2 > 0 ? o.a2 / o.e2 : null;
  o.outcome = TARGETS[o.target];
  return o;
});

// ---------- metrics ----------
// Wilson score interval (95%) for a proportion: honest uncertainty for small groups.
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function summarize(list) {
  const n = list.length;
  const counts = [0, 0, 0];
  for (const s of list) counts[s.target]++;
  const [drop, enr, grad] = counts;
  return {
    n,
    dropouts: drop,
    enrolled: enr,
    graduates: grad,
    dropRate: n ? drop / n : 0,
    enrRate: n ? enr / n : 0,
    gradRate: n ? grad / n : 0,
    ci: wilson(drop, n),
  };
}

// Group a list by a key function, keep the order given by `keys`.
export function groupRates(list, keyFn, keys, labels) {
  const totalDrop = list.reduce((a, s) => a + (s.target === 0), 0);
  return keys.map((k, i) => {
    const sub = list.filter((s) => keyFn(s) === k);
    const sm = summarize(sub);
    return { key: k, label: labels ? labels[i] : String(k), ...sm, share: totalDrop ? sm.dropouts / totalDrop : 0 };
  });
}

// ---------- filters ----------
export const DEFAULT_FILTERS = {
  course: 'All',
  gender: 'All',
  age: 'All',
  scholar: 'All',
  tuition: 'All',
  attendance: 'All',
};

export function applyFilters(list, f) {
  return list.filter(
    (s) =>
      (f.course === 'All' || s.courseName === f.course) &&
      (f.gender === 'All' || (f.gender === 'Male') === !!s.male) &&
      (f.age === 'All' || s.ageGroup === f.age) &&
      (f.scholar === 'All' || (f.scholar === 'Yes') === !!s.scholar) &&
      (f.tuition === 'All' || (f.tuition === 'Up to date') === !!s.tuitionOk) &&
      (f.attendance === 'All' || (f.attendance === 'Evening') === !!s.evening)
  );
}

export const MIN_N = 30; // below this, rates are flagged as unstable

// ---------- formatting ----------
export const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
export const num = (v) => v.toLocaleString('en-US');
