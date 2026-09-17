# 19c-defekty W202 v2 — receipt

Status: READY FOR CTO REVIEW.

Rebased on origin/integracja/20260911 at 9847032a375a65c64178cdc18b161f9c2e50220a. Final commit SHA is reported in OD_CODEXA after the doc-only amend.

Base candidate: `d31d39bbca` (`fix(w193): close live 19c defects`). This v2 intentionally excludes the later P-E2 work from `7f63c4c9f8`; P-E2 has its own W203 recipe.

Scope fixed from W202:
- P1-1: `KpiTrzyPoziomy.test.tsx` now expects `?set=${SCORECARD_ID}` for the KPI card navigation assertion while legacy `?zbior=` compatibility tests remain unchanged.
- P1-2: added the 8 missing EN/PL i18n keys for execution risk reasons and DRD frozen header/session fallback.
- P1-3: removed dead `normalizeWorkReportLabel`; Executive Pulse now has a real separator between the calculated epistemic label and severity badge, covered by a behavioral test.

Verification:
- Focused Vitest PASS: `tests/components/ResultsVNext/KpiTrzyPoziomy.test.tsx` + `src/components/Execution/reports-intelligence/__tests__/WorkIntelligenceReport.test.tsx` = 2 files / 19 tests.
- Mutation PASS/RED: removing the separator before the severity badge makes `keeps calculated epistemic and severity labels separated in Executive Pulse` fail with `CALCULATEDNeutral`.
- Language gate PASS before rebase: no increase; K4en -13, K4obj -36, K5en -1, K7 -1. Report: `/tmp/19c-v2-lang-d31.txt`.
- Language gate PASS after rebase: no increase; K4obj -4, K8sen -2. Report: `/tmp/19c-v2-lang-rebased.txt`.
- `git diff --check`: PASS.
- Front TypeScript after rebase: 167 total errors / 5 node_modules / 0 changed-file hits. Log: `/tmp/19c-v2-front-tsc.log`.
- Server TypeScript after rebase: 0 total errors / 0 node_modules / 0 changed-file hits. Log: `/tmp/19c-v2-server-tsc.log`.

Notes:
- No migration.
- No staging/demo/Londyn/integracja push.
- No deploy or Railway/env changes.
- No `MethodWorkspaceShell.tsx` changes; DRD visible shell header remains outside this v2 per W202.
