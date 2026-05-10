---
module_id: MODULE_FINANCE
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Finanse / Finance & Intelligence

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `MODULE_ECONOMICS` maps to `AppView.ECONOMICS` in `menuConfig.ts`.
- Canonical routes in `routeConfig.ts`: `/economics` and alias `/finance`.
- Additional finance detail routes in `AppRoutes.tsx`: `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id` (all mounted through `EconomicsView`).
- Route render map: `/economics` and `/finance` -> `EconomicsView` (`src/views/EconomicsView.tsx`) -> `FinanceHub`.

## Main Component Paths (As-Is)

- `src/views/EconomicsView.tsx` — wrapper route component.
- `src/components/Economics/FinanceHub.tsx` — primary finance runtime (statements/models/analysis/prediction/valuation/investment tabs).
- `src/components/Economics/hooks/*` — data, lane, selection, row-actions hooks used by finance runtime.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `FN_STATEMENTS_WORKSPACE` | `FinanceHub` tab `statements` | statements ingestion and preparation lane. |
| `FN_MODELS_WORKSPACE` | `FinanceHub` tab `models` | financial model management lane. |
| `FN_ANALYSIS_WORKSPACE` | `FinanceHub` tab `analysis` | financial analysis lane. |
| `FN_PREDICTION_WORKSPACE` | `FinanceHub` tab `prediction` | scenario and prediction lane. |
| `FN_VALUATION_WORKSPACE` | `FinanceHub` tab `valuation` | enterprise valuation lane. |
| `FN_INVESTMENT_WORKSPACE` | `FinanceHub` tab `investment` | investment-case lane. |
| `FN_FINANCE_DETAIL_ROUTES` | `EconomicsView` detail routes | deep-link entry routes for statements/models/analyses. |

## API / Services / Models (Confirmable)

- Shared API usage: `src/services/api.ts`.
- Finance V8 contracts: `src/services/api/v8/finance.ts` (imported in `FinanceHub`).
- Results/benefits integrations via finance components and shared type paths.
- Finance runtime model definitions: `src/components/Economics/financeTypes.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `Economics`/`FinanceHub` test file found under `src/views` or `src/components/Economics`.

## Known Gaps (As-Is)

- Finance runtime is active but module-local automated tests are missing (`code_gap`).
- Legacy fallback mode is present in finance runtime (`partial`), with V8 runtime toggle/fallback logic.
