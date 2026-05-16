---
module_id: MODULE_FINANCE
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Finanse

## Purpose

Ustalić granice odpowiedzialności Finanse względem Results, Inicjatyw, Outputs i Execution.

## In scope (Must)

- MUST: Financial Analysis v3 runtime (6 zakładek) jako modelowana prawda finansowa.
- MUST: Economics analysis artefact (as-is): scenariusze, walidacje, rekomendacje, status flow DRAFT→REVIEW→APPROVED.
- MUST: linkage do Results (opcjonalne, jawne), gdy KPI ma znaczenie ekonomiczne.
- MUST: controlled handoff do Inicjatyw (“create initiative from analysis”) zgodnie z Economics flow.

## Out of scope (Must Not)

- MUST NOT: przejąć ownership KPI definitions/targets/scorecards (to Results).
- MUST NOT: być generic spreadsheet/BI bez governance.

## Should

- SHOULD: mieć eksport/artefakty dla Outputs (reports/presentations) z traceability do danych i modelu.

## Acceptance Criteria

- [ ] Zakres nie wchodzi w kompetencje `Rezultaty` (metric truth) poza linkage.
- [ ] Route truth jest zgodny z `MODULE_ROUTING_ARCHITECTURE.md` (`/economics` as-is).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`
- `DRD/consultify/docs/modules/ECONOMICS_MODULE.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

