---
module_id: MODULE_RESULTS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Rezultaty (Results)

## Purpose

Obiekty danych Results (metyki, scorecards, deviation cases, ROI artefakty) oraz integracje: inicjatywy (scope), execution follow-up, opcjonalne linkage do Finance.

## Must

- MUST: utrzymywać kanoniczny model obiektów Results (MetricDefinition, Scorecard, DeviationCase, RoiTrackingArtifact itd.).
- MUST: freshness/quality/lineage dla metryk są jawne (MetricLineageRecord / ingest logs / provenance).
- MUST: linkage KPI↔Finance jest opcjonalne, ale gdy użyte – jest zapisane jako osobny obiekt/linkage, nie duplikacja definicji.

## Must Not

- MUST NOT: traktować finance liczby jako źródła prawdy metryki bez jawnego kontraktu.

## Should

- SHOULD: Results reporting i wallboards są “materializacją narracji” nad tą samą prawdą metryk.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

