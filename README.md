# The College Drop-In: Student Retention Dashboard

MSA 8030 Communicating with Data · Team 4 (Merachew Gebremariam, Cartez Dewberry, Carson Johnston)

An interactive, fully client-side React dashboard on student dropout, built on the UCI
*Predict Students' Dropout and Academic Success* dataset (4,424 students, one Portuguese institution).

## Data
- Source: UCI Machine Learning Repository, DOI 10.24432/C5MC89. Paper: Realinho et al. (2022), *Data* 7(11):146, DOI 10.3390/data7110146
- `data/student_dropout_decoded_dataset.xlsx`: the team's decoded workbook (codes replaced with labels)
- `scripts/prepare_data.py`: reproducible prep. Checks missing cells and duplicates, then writes
  `src/data/students.json` (compact, used by the app) and `public/data/student_dropout_decoded.csv` (downloadable)

## Metric definitions
- Dropout rate = dropouts ÷ all students in the group ('Enrolled' stays in the denominator)
- 1st-semester pass rate = approved ÷ enrolled units, only where enrolled > 0 (180 students with 0 enrolled are shown separately)
- 95% intervals: Wilson score. Groups under 30 students are faded and marked ⚠
- Alert builder: workload = flagged ÷ students; coverage = flagged dropouts ÷ all dropouts; hit rate = dropout rate among flagged

## Run locally
```bash
npm install
python3 scripts/prepare_data.py data/student_dropout_decoded_dataset.xlsx   # only if the data changes
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Deploy (Netlify)
`netlify.toml` is included (build: `npm run build`, publish: `dist`).
- Quickest: run `npm run build`, then drag the `dist` folder onto https://app.netlify.com/drop
- Continuous: push this folder to GitHub, then on Netlify choose Add new site > Import from Git
- CLI: `npx netlify-cli login`, then `npx netlify-cli deploy --prod --dir=dist`

## Code map
- `src/lib/data.js`: decoding, filters, metric and interval math
- `src/components/charts.jsx`: donut, rate bars with CIs, columns, stacked bars, heatmap, linked scatter, table view
- `src/components/FlagBuilder.jsx`: interactive early-alert builder
- `src/components/ui.jsx`: logo, ribbon, KPI count-ups, cards, filter bar
- `src/App.jsx`: narrative sections and layout
