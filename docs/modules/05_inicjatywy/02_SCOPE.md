---
module_id: MODULE_INITIATIVES
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Inicjatywy

## Purpose

Ustalić granice odpowiedzialności modułu `Inicjatywy` względem Tools/Assessment (DRAFT), Execution (realizacja), Benefits/Results (tracking), Outputs (artefakty).

## In scope (Must)

- MUST: edycja i kompletowanie inicjatywy (EDITING/REVIEW/PLANNING).
- MUST: gate decisions: PROMOTE / APPROVE / SCHEDULE (oraz opcjonalne CHANGE gate jako pattern).
- MUST: widoczność CTA wg backend-driven capabilities (`gate-readiness-check`).
- MUST: planowanie KPI/dependencies/timeline w granicach przygotowania do realizacji.

## Out of scope (Must Not)

- MUST NOT: wykonywanie zadań i prowadzenie delivery execution (to należy do `Realizacja`).
- MUST NOT: benefits tracking runtime (to należy do `Rezultaty` / Benefits).

## Should

- SHOULD: umożliwiać tworzenie contextCreateActions w zależności od statusu (task/decision/raid) zgodnie z CTA matrix.

## Acceptance Criteria

- [ ] Zgodność z module ownership w `INITIATIVE_GOVERNANCE_MODEL.md`.
- [ ] Zakres jasno oddziela “approved backlog” (`APPROVED`) od “scheduled baseline” (`SCHEDULED`).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`

