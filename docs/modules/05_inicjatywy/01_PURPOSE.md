---
module_id: MODULE_INITIATIVES
doc_kind: PURPOSE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Purpose — Inicjatywy

## Purpose

Zdefiniować, po co istnieje moduł `Inicjatywy`: zarządzanie portfelem inicjatyw, governance bramek i przygotowanie do realizacji (bez wchodzenia w execution runtime).

## Must

- MUST: być właścicielem faz lifecycle: `EDITING`, `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`.
- MUST: egzekwować governance gates przez jawne CTA i audyt (kto zatwierdził, kiedy, dlaczego).
- MUST: pokazywać readiness i blokery gate’ów (DoD bramki) w sposób zrozumiały dla biznesu.

## Must Not

- MUST NOT: pozwalać na “ukryte” przejścia statusów bez śladu decyzji (no silent execution).
- MUST NOT: inferować permissions w FE na podstawie lokalnych reguł bez payloadu z backendu.

## Should

- SHOULD: umożliwiać “approved backlog” — status `APPROVED` bez wymuszonej baseliny timeline (baseline blokuje od `SCHEDULED`).

## Acceptance Criteria

- [ ] Purpose jest spójny z `INITIATIVE_GOVERNANCE_MODEL.md` i nie dubluje Execution/Benefits.

## Related Sources

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`

