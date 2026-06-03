# MODULE 08b — Financial-Model Entry Path
**Audit date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Baseline:** none (sub-module of MODULE_08 ~42)

---

## Readiness Score: 74 / 100 — Tier B (Beta-ready, not GA-clean)

---

## 1. Functionality — REAL, not mock

All data paths are live DB, no synthetic fallback injected:

- `useFinanceData.ts:88–112` calls `V8FinanceApi.getModels()` with a graceful fallback to `/api/financial-modeling/models` (legacy SQLite route).
- `financial-modeling.routes.ts:1118–1119` — `listModels()` SELECTs real fields including `horizon_months`, `start_date`, `scenario`, and `(SELECT COUNT(*) FROM financial_model_events … AS event_count)`.
- `financeModelLabels.ts` — three pure derivation helpers (`deriveForecastWindowLabel`, `deriveVariantLabel`, `deriveAnalyticalDepthLabel`) read the actual DB fields; no hardcoded "Base / 12 months" strings remain. Comment on line 7 confirms this was a P0-A fix.
- ExportToOutput calls `exportFinancialAnalysis` via `/reports/builder/…` — real service, not stubbed.
- Atelier demo seed exists at `server/scripts/seed-demo-dataset-contract.ts:8` (org "Atelier ToolToys") with ROI plan/realized rows, but **no `financial_models` table rows** are seeded — the ROI figures go into a benefits/KPI table, not into the financial-modeling CRUD path. The Atelier ROI demo model is therefore not present in the modeling module itself.

---

## 2. Intra-module Flow & States

**Happy path (statements → models → export):**

1. Statements tab loads via V8 or legacy fallback (`useFinanceData.ts:59–86`).
2. "Models" tab triggers `loadModels()` + `loadStatements()` in parallel (line 193).
3. Row labels come from `deriveForecastWindowLabel(m.start_date, m.horizon_months)`, `deriveVariantLabel(m.scenario, t)`, `deriveAnalyticalDepthLabel(m.event_count, t)` — confirmed applied at `useFinanceData.ts:357–359`.
4. Preview detail loads from `V8FinanceApi.getModelOutputs` in `FinanceModelDocumentView.tsx:39` with graceful `isEstimated=true` fallback when server returns empty.
5. Analyze menu (`FinanceHub.tsx:1188–1396`) gates next-step flows (analysis, valuation, budget) contextually on selected row.
6. Teresa prelude: `buildFinanceTeresaPrompt` is called both on per-row chat button (`line 244`) and on hub-level AI button (`lines 1531–1534`), passing NPV/ROI/payback prompt for `models`/`prediction` tabs.

**Error states:** `loadError` is set correctly per tab but the render only checks `loadingTab` for skeleton; `loadError` is exposed to `FinanceDegradedBanner` via `lane.degradedAlerts`, not directly displayed inline in the table area — minor UX gap.

**V8 flag gate (`line 2088`):** When `!isV8FinanceEnabled && !useLegacyFinanceMode`, renders a calculator empty-state instead of falling back to legacy mode automatically. This is intentional but means the module is invisible when the flag is off without manual legacy toggle.

---

## 3. UI/UX Adherence

- ModuleHub shell used correctly (`FinanceHub.tsx:2119`), 6-tab layout (statements / models / analysis / prediction / valuation / investment).
- Color system: primary CTA uses `bg-hig-primary` (line 1180); model empty-state uses `bg-crimson-500/10 text-crimson-600` (line 2015) and `bg-crimson-600` button (line 2032) — crimson/navy correctly applied.
- Table column definitions at lines 919–975 render `forecastWindowLabel`, `variantLabel`, `analyticalDepthLabel` — no hardcoded display text for model properties.
- ExportToOutputDialog uses `rounded-xl`, `ring-1`, `dark:bg-navy-900` correctly.
- `relatedInitiativeIds` prop defined in `ExportToOutputDialog` (`line 24`) but caller (`FinanceHub.tsx:2352–2364`) does **not** pass it — initiative IDs are silently dropped on export.

---

## 4. Cross-Module Handoffs

| Handoff | State | Evidence |
|---|---|---|
| model → initiative business case | Partial | `ExportToOutputDialog` has `outputType='initiatives'` that calls `V8FinanceApi.createInitiativesFromAnalysis` (line 138), but only works for `analysis` rows — `handleExport` maps `models` kind to `financial_model` source type, which is accepted by the dialog but has no initiative-proposal fetch for model rows |
| model → Outputs (report/presentation) | Working | Export routes to `/reports/builder/${result.outputId}` (line 2361), uses real `exportFinancialAnalysis` service |
| ExportToOutputDialog `relatedInitiativeIds` | Missing at callsite | `FinanceHub.tsx:2351–2364` does not pass `relatedInitiativeIds` — initiative traceability on export is lost |
| Deep-link from Initiatives | Working | URL param `initiativeName` pre-fills search query (line 719); tab/createFrom params handled (lines 705–731) |
| Teresa prelude on FinanceHub | Shipped | `buildFinanceTeresaPrompt` wired for hub-level and per-row chat; model/prediction tabs get NPV/ROI/payback prompt |

---

## 5. Risks / Regressions / Runtime

- **P1 — `relatedInitiativeIds` not passed to `ExportToOutputDialog`** (`FinanceHub.tsx:2351`): Initiative trace is silently omitted on every export. The prop exists in the component but is never supplied by the hub.
- **P2 — Atelier ROI demo model not seeded**: `seed-demo-dataset-contract.ts` seeds Atelier org ROI rows into a benefits/KPI table, not `financial_models`. Demo walkthroughs of the modeling tab will show an empty list for this org.
- **P2 — Legacy fallback asymmetry**: `loadStatements` falls back to `/api/finance-statements/packs`; `loadValuations` and `loadBudgets` have no V8 path at all (lines 140–171) — they always call the legacy `/api/economics/…` endpoint. If that endpoint is deprecated or behind org gates, those tabs silently empty out.
- **P3 — `isEstimated` banner in FinanceModelDocumentView**: When model outputs are empty (not computed), the view sets `isEstimated=true` silently. No user-facing warning is surfaced — consultant may not realize outputs are estimated.
- **P3 — `loadError` not shown inline**: On tab load failure, `loadError` is set but only exposed via degraded banner if V8 lane is active; non-V8 users see an empty table with no error message.

---

## 6. Top Remaining Gaps

1. **Pass `relatedInitiativeIds` to `ExportToOutputDialog`** — required for spine handoff correctness.
2. **Seed Atelier financial_model row** in `seed-demo-dataset-contract.ts` for demo coverage.
3. **Inline error display** when `loadError` is non-null (not just via degraded banner).
4. **Valuation / budgets V8 migration** — no V8 path for these two sub-types.
5. **Initiative-proposal flow for `financial_model` source type** — currently only `financial_analysis` rows can trigger initiative proposals from the export dialog.
