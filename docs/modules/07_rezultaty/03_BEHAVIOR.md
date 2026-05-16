---
module_id: MODULE_RESULTS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Rezultaty (Results)

## Purpose

Kontrakt zachowania Results: KPI jako system operacyjny, deviation → corrective action, ROI/evidence oraz linkage do Finance gdy potrzebne.

## Must

- MUST: Results ma powierzchnie: Initiatives(scope), KPI(operator workspace), Reporting(narrative), ROI, ROI Analysis.
- MUST: deviation cases istnieją i prowadzą do działań (nie tylko insight).
- MUST: truth doctrine: jedna metryka ma jedno znaczenie i jest re-używana w raportach.

## Must Not

- MUST NOT: dublować metryk między Results i Finance bez jawnego linkage.
- MUST NOT: ukrywać braków danych (freshness/quality) ani “backfill fake demo data”.

## Should

- SHOULD: wspierać linkage KPI↔Finance w trybach: interpretation/driver/review/realization (opcjonalnie).

## Acceptance Criteria

- [ ] Użytkownik może przejść od KPI deviation → corrective action / follow-up (bez utraty traceability).
- [ ] “Route truth” nie jest split-brain (benefits/results).

## Related Sources

- `DRD/consultify/docs/product/RESULTS_V8_SSOT.md`
- `DRD/consultify/docs/product/KPI_FULL_SYSTEM_CANON_V8.md`

