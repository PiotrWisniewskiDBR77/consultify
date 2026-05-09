---
module_id: MODULE_FINANCE
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Finanse

## Purpose

Kontrakt zachowania Financial Analysis + Economics: ingest statements, budowa modeli, walidacje, scenariusze, approval flow oraz AI orchestration-in-the-loop.

## Must

- MUST: AI działa jako “analyst-in-the-loop” (orchestruje + waliduje), ale:
  - MUST: **nigdy nie wymyśla liczb** (numerical anchor).
  - MUST: każda propozycja zmiany wymaga jawnego confirm.
- MUST: model ma “health check”: pętla 3-statement, balance check i jawny status `invalid` gdy niespójny.
- MUST: Economics artefact ma status flow DRAFT→REVIEW→APPROVED i scenariusze base/optimistic/conservative.

## Must Not

- MUST NOT: mieszać metric truth z Results z modeled truth w Finance bez jawnego linkage.
- MUST NOT: “ukryte zmiany” w modelach bez traceability (co się zmieniło, kto zatwierdził).

## Should

- SHOULD: wspierać create initiative from analysis (Economics) jako jawny handoff.
- SHOULD: wspierać export do Outputs (report/deck) z grounding do modelu i danych.

## Acceptance Criteria

- [ ] Nie ma ścieżki, gdzie UI/AI “podkłada liczby” bez zakotwiczenia w silniku.
- [ ] User widzi jawnie: invalid model, brak danych, brak permission, brak linkage.

## Related Sources

- `DRD/consultify/docs/product/FINANCIAL_ANALYSIS_V3.md`
- `DRD/consultify/docs/modules/ECONOMICS_MODULE.md`
- `DRD/consultify/docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

