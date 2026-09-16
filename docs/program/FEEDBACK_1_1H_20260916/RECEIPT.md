# FEEDBACK-1 / 1h — locale-aware KPI report months

**Verdict: READY FOR CTO REVIEW (uncommitted package).**

- Base: `a132044e7d6367b950478a96b76247adf76dc27a`
- Branch: `codex/feedback-1-1h-kpi-months-20260916`
- Freeze marker for the final commit: `[ODMROZENIE 09_RESULTS DEC-575]`
- Scope: KPI report period labels in Results; no feature flag (bug fix).

## Behaviour

`kpiReportPeriodLabel` now receives the active UI locale. A monthly period remains Roman in Polish (`IX 2026`, `VII 2026`) and uses the existing English short-month vocabulary in English (`SEP 2026`, `JUL 2026`). Quarter and year labels remain unchanged.

Both production callers pass `isPolish`:

1. Results KPI report registry (period column),
2. KPI scorecard detail (report header).

The detail and registry effects also depend on `isPolish`, so switching the UI language recomputes the label without a reload.

## Sibling measurement

A narrow production-code scan for Roman month constants/formatters (`VIII`, `XII`, `MONTH_ROMAN`, `romanMonth`, `monthRoman`) found one Roman-month formatter: `src/labels/kpiReportLabels.ts`. Its two production callers are covered above. Roman numerals used for DRD maturity levels are domain levels, not calendar months, and were not changed.

## Evidence

- Focused Vitest: **2 files / 4 tests PASS**, `--retry=0 --no-file-parallelism`.
  - EN current month: `2026-09` -> `SEP 2026`.
  - PL current month: `2026-09` -> `IX 2026`.
  - EN published snapshot: `2026-07` -> `JUL 2026`.
  - PL published snapshot: `2026-07` -> `VII 2026`.
  - Existing KPI presenter regression tests remain green.
- Final staged language gate: **OK**.
- `git diff --check`: **PASS**.
- ESLint on the new test: **PASS**. Whole touched legacy files retain pre-existing formatting/import-order findings outside this package's lines.
- Full TypeScript on the shared dependency installation: frontend base **RC=2 / 169** -> candidate **RC=2 / 169**, delta 0; server base **RC=0 / 0** -> candidate **RC=0 / 0**, delta 0.
- Independent review: **ACCEPT, 0 P0 / 0 P1**; its only evidence-wording P2 is closed by the final staged language-gate run recorded before freeze.
- Screenshots: not produced; the channel explicitly forbids screenshots.

## P2 from W149

`src/components/MyWork/table/CellEditor.tsx` `onPaste` hardening is **out of scope** for this Results/KPI package. It changes the shared My Work editor, does not share the formatter or either caller, and W149 assigns it alternatively to PROJECT-1 P1. Mixing it here would enlarge the package and create avoidable overlap with that queued work.

## Files

- `src/labels/kpiReportLabels.ts`
- `src/components/ResultsVNext/kpiScorecards/kpiReportPresenters.tsx`
- `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx`
- `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`
- `src/components/ResultsVNext/kpiScorecards/__tests__/kpiReportPeriodLabel.locale.test.ts`
