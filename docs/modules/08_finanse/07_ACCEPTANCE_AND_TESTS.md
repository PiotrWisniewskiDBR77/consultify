---
module_id: MODULE_FINANCE
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Finanse / Finance & Intelligence

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Finance -> `/economics` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| Alias `/finance` and detail paths | mapped and mounted via `EconomicsView` | pass |
| Core finance workspace | `EconomicsView` -> `FinanceHub` | pass |
| V8 finance dashboard contract | `FinanceHub` imports `V8FinanceApi` | pass (`partial` with fallback) |
| Module-local finance frontend tests | not found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `FN_STATEMENTS_WORKSPACE` | Statements tab runtime is active | `FinanceHub.tsx` `statements` tab | pass |
| `FN_MODELS_WORKSPACE` | Models tab runtime is active | `FinanceHub.tsx` `models` tab | pass |
| `FN_ANALYSIS_WORKSPACE` | Analysis tab runtime is active | `FinanceHub.tsx` `analysis` tab | pass |
| `FN_PREDICTION_WORKSPACE` | Prediction tab runtime is active | `FinanceHub.tsx` `prediction` tab | pass |
| `FN_VALUATION_WORKSPACE` | Valuation tab runtime is active | `FinanceHub.tsx` `valuation` tab | pass |
| `FN_INVESTMENT_WORKSPACE` | Investment tab runtime is active | `FinanceHub.tsx` `investment` tab | pass |
| `FN_FINANCE_DETAIL_ROUTES` | Detail routes are mounted | `AppRoutes.tsx` finance detail route entries | pass |

## Confirmed Automated Evidence (As-Is)

- No dedicated `FinanceHub`/`EconomicsView` test file found in current tree scan.

## Known Gaps / Blockers

- `code_gap`: no automated regression suite for finance tab and fallback behavior.
- `doc_gap`: no embedded UI recording links in this file.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
