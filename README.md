# Everyone Walks: Student Retention Dashboard

MSA 8030 Communicating with Data · Team 4 (Merachew Gebremariam, Cartez Dewberry, Carson Johnston)

An interactive, fully client-side React dashboard on student dropout, built on the UCI
*Predict Students' Dropout and Academic Success* dataset (4,424 students, one Portuguese institution).

## Data
- Realinho, V., Vieira Martins, M., Machado, J., and Baptista, L. (2021). [Predict Students’ Dropout and Academic Success](https://doi.org/10.24432/C5MC89). UCI Machine Learning Repository. The data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Team 4 decoded categorical labels and prepared the CSV and JSON used here.
- `data/student_dropout_decoded_dataset.xlsx`: local source workbook for optional data preparation. The dashboard runs directly from the included JSON
- `scripts/prepare_data.py`: reproducible prep. Checks missing cells and duplicates, then writes
  `src/data/students.json` (compact, used by the app) and `public/data/student_dropout_decoded.csv` (downloadable)

## Role workspaces
Choose a campus role below the cover for a filtered report. Leadership compares financial reach, advisors examine first-term units, student success sees overlapping needs, enrollment ranks programs by count or rate, and retention teams can adjust an outreach rule. Use Data explorer to open the underlying charts and methods.

## Metric definitions
- Dropout rate = dropouts ÷ all students in the group ('Enrolled' stays in the denominator)
- 1st-semester pass rate = approved ÷ enrolled units, only where enrolled > 0 (180 students with 0 enrolled are shown separately)
- 95% intervals: Wilson score. Groups under 30 students are faded and marked ⚠
- Alert builder: workload = flagged ÷ students; coverage = flagged dropouts ÷ all dropouts; hit rate = dropout rate among flagged

## Run locally
```bash
npm ci
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
- `src/components/ui.jsx`: logo, KPI count-ups, cards, filter bar
- `src/components/Workspaces.jsx`: campus roles, decision reports, and program rankings
- `src/App.jsx`: narrative sections and layout
