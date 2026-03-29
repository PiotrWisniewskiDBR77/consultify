# Final Implementation Contract — KPI (Position 4/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: KPI są dobrze opisane — teraz trzeba je dobrze zbudować.
- **Primary users**: operatorzy wyników (management/PMO/owner).
- **Success metric**: KPI to nie „dashboard” tylko lane: signal → report/reconciliation → next action, spójne z konsekwencjami finansowymi.

## 2. Scope
### 2.1 In-scope
- KPI inspection + report workflow + reconciliation semantics.
- KPI ↔ finanse: konsekwencje i spójność runtime na deklarowanych ścieżkach.

### 2.2 Out-of-scope / non-goals
- Pełny BI suite.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`
- SSOT: `docs/product/RESULTS_V8_SSOT.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: **missing input** — repo wskazuje `Softs/0 KPI`, ale nie ma zdistylowanego benchmark doc z nazwami vendorów.
- **Secondary (adjacent, w repo)**: `ClickUp` / `monday.com` (dashboards + operational reporting), `Smartsheet` (baseline/variance mindset) z `EXECUTION_MANAGEMENT_BENCHMARK_V8.md`.

## 5. Product contract (user-facing)
- KPI signal ma prowadzić do: report, reconciliation, i konkretnej akcji (nie „martwy wykres”).
- Spójna nawigacja: KPI → Finance consequence → Execution follow-up.

## 6. Evidence plan (DoD)
- Acceptance: user przechodzi KPI→report→reconciliation bez „domyślania się” stanu; link do finance konsekwencji działa i jest spójny.
- Evidence: testy integracyjne KPI/finance linkage + staging demo z realnym discrepancy flow.

