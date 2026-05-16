---
module_id: MODULE_FINANCE
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Finanse

## Purpose

Obiekty danych Finance: statements ingestion artefacts, financial models, scenario snapshots, economics analyses oraz opcjonalne linkage do Results.

## Must

- MUST: Economics core tables: `digitization_analyses`, `analysis_financials`, `analysis_financial_scenarios`.
- MUST: Finance models są driver-based i mają jawne walidacje (balance check, convergence).
- MUST: linkage KPI↔Finance jest osobnym bytem (nie duplikat definicji).

## Must Not

- MUST NOT: expose raw PII / wrażliwe payloady w UI/logach.

## Should

- SHOULD: integracje do Outputs (export) zachowują traceability do modelu/okresu/źródła.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/modules/ECONOMICS_MODULE.md`
- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

