"""Reproducible data prep: decoded UCI workbook -> compact JSON for the dashboard + clean CSV.
Usage: python3 scripts/prepare_data.py path/to/student_dropout_decoded_dataset.xlsx
"""
import sys, json, csv, os, openpyxl
src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
rows = list(wb.active.iter_rows(values_only=True))
header = [str(c).strip() for c in rows[0]]
data = [dict(zip(header, r)) for r in rows[1:] if any(v is not None for v in r)]

# Cleaning checks: missing values / duplicates
missing = sum(1 for d in data for v in d.values() if v is None or v == "")
dupes = len(data) - len({tuple(d.values()) for d in data})
print(f"rows={len(data)} missing_cells={missing} exact_duplicate_rows={dupes}")

def cats(col):
    return sorted({d[col] for d in data}, key=lambda v: -sum(1 for d in data if d[col] == v))

dims = {k: cats(k) for k in ["Course", "Marital status", "Application mode"]}
yn = lambda v: 1 if v == "Yes" else 0
targets = ["Dropout", "Enrolled", "Graduate"]
fields = ["course","evening","male","age","scholar","debtor","tuitionOk","intl","displaced",
          "special","marital","appMode","admGrade","prevGrade","e1","a1","g1","e2","a2","g2",
          "unemp","infl","gdp","target"]
out = []
for d in data:
    out.append([
        dims["Course"].index(d["Course"]), 1 if d["Daytime/evening attendance"] == "Evening" else 0,
        1 if d["Gender"] == "Male" else 0, d["Age at enrollment"], yn(d["Scholarship holder"]),
        yn(d["Debtor"]), yn(d["Tuition fees up to date"]), yn(d["International"]), yn(d["Displaced"]),
        yn(d["Educational special needs"]), dims["Marital status"].index(d["Marital status"]),
        dims["Application mode"].index(d["Application mode"]), round(d["Admission grade"], 1),
        round(d["Previous qualification (grade)"], 1),
        d["Curricular units 1st sem (enrolled)"], d["Curricular units 1st sem (approved)"],
        round(d["Curricular units 1st sem (grade)"], 2),
        d["Curricular units 2nd sem (enrolled)"], d["Curricular units 2nd sem (approved)"],
        round(d["Curricular units 2nd sem (grade)"], 2),
        d["Unemployment rate"], d["Inflation rate"], d["GDP"], targets.index(d["Target"]),
    ])
json.dump({"fields": fields, "dims": dims, "targets": targets, "rows": out},
          open(os.path.join(root, "src/data/students.json"), "w"), separators=(",", ":"))
with open(os.path.join(root, "public/data/student_dropout_decoded.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(header); [w.writerow([d[h] for h in header]) for d in data]
print("wrote src/data/students.json and public/data/student_dropout_decoded.csv")
