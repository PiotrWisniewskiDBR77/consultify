# KPI-1 / U-41 freeze manifest

**Status: READY FOR CTO REVIEW — one documented PARTIAL.**

| Field | Value |
|---|---|
| Package | KPI-1 / U-41 |
| Module | `09_RESULTS` |
| Base | `cbad80887ce5969f37a38f9ce79e67c6f33844fd` |
| Branch | `codex/kpi-1-u41-20260916` |
| Decision | `DEC-574` |
| Candidate SHA | This freeze commit (reported after creation) |
| Migration | None |
| Feature flag | `VITE_RESULTS_VNEXT_KPI_USABILITY_U41=false` |
| Deploy/staging writes | None |

## Frozen acceptance set

- Focused tests: 24/24 passed.
- Importer family: exact 17 files; line 27 failed / 100 passed / 14 errors; candidate 22 failed / 110 passed / 9 errors; normalized failing names 26 → 21, zero new.
- Full frontend TSC, no time limit: 152 line / 152 candidate.
- Full server TSC: 0.
- Docker flag guard: 0 missing.
- Automated contrast: light+dark, five changed element classes, minimum 6.34:1 versus 4.5:1 threshold.
- Real-component English light+dark screenshots below 2 MB.

## Frozen artifacts

- `REPORT.md`
- `importer-files.txt`
- `importer-base.raw.log`
- `importer-candidate.raw.log`
- `importer-failing-names-base.txt`
- `importer-failing-names-candidate.txt`
- `importer-comparison.txt`
- `tsc-base.raw.log`
- `tsc-candidate.raw.log`
- `tsc-server-candidate.raw.log`
- `contrast-check.mjs`
- `contrast-results.json`
- `kpi-u41-en-light.png` — `36e0637fc1e9cdb108a0c683466149bc1549c9b8f01b31075b524c46aff39a38`
- `kpi-u41-en-dark.png` — `14cb22100c02dda06df93fc17b00f84855f325ed73d290adf90c701fda6b3a02`

## Explicit PARTIAL

Process and Response policy lack a registry/read contract. Stored labels render fully; pre-existing opaque IDs cannot be converted without new backend scope.
