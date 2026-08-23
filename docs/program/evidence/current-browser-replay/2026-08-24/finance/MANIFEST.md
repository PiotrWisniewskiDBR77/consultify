# Finance recovered-runtime replay — 2026-08-24

Scope: read-only authenticated desktop replay of the retained Wave 3 Finance
fixture. This is technical recovery evidence, not owner acceptance, persistence
proof or release authorization.

## Runtime identity

- Frontend: `http://127.0.0.1:4380`
- API: `http://127.0.0.1:4381` (`/api/health` = `200`)
- Visible source marker: `LOCAL @d8561ed5c2b8`
- Source checkout: `/private/tmp/consultify-finance-owner-live-src-20260823`
- PostgreSQL database: `consultify_w3_finance_owner_recovered_20260823` on loopback
- Candidate contains `d8561ed5c2` as an ancestor; no Finance source transplant was required.

## Browser readback

| Surface | Read-only result | Screenshot | SHA-256 |
| --- | --- | --- | --- |
| Statements | approved `CD PROJEKT S.A.` workspace; 13 lines x 13 periods; source-evidence prompt, reconciliation, five downstream artifact links and report flow | `finance-statements-full-card-4380.jpg` | `c5e47c61fd6aee9c7a72089c5f6e62f866aa62558a29a68fa5310c0bd20ade9c` |
| Analysis | approved FY2025 analysis; KPI table with formula, interpretation, benchmark, quality and `Current Ratio = 3` | `finance-analysis-full-card-4380.jpg` | `0e306573b04f73dc3c4c2d05b31da633a1293b4079dc3c5212051a09f77d969a` |
| Models | approved model v4; assumptions, calibration rules, forecast values, safe ranges, data quality and downstream impact | `finance-models-full-card-4380.jpg` | `e6e67ed01c5aec0bf2360cc51131a8554e344576663524d186abacface485ae7` |
| Prediction | approved scenario v1; standard/driver/fundamental modes, Base/Upside/Downside and canonical authoring revision | `finance-prediction-full-card-4380.jpg` | `004d3ef0cb89ab96344b168e57ecf7a29b360d116b7be3c0a3fa22c1103afa78` |
| Enterprise valuation | approved Baseline case; source, assumptions, methods/weights, results, sensitivity, advisor and exact four-link lineage | `finance-valuation-full-card-4380.jpg` | `5013edd5ee3e23e79204b08216f60cae3b36a08028c6bc0bd4872c7cec99185d` |

No compute, generate, save, export, approve, reopen or database mutation action
was invoked during this replay.
