---
module_id: MODULE_MEETING
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Meeting

## Purpose

Obiekty danych Meeting (notatki, action items, decisions) i potencjalne integracje (calendar) — na dziś minimalnie, bez zgadywania implementacji.

## Must

- MUST: obiekty Meeting są linkowalne do Initiative/My Work/Notebook (traceability).
- MUST: jeśli integracja calendar nie istnieje — UI i API zwracają jawne “not supported” / degraded state.

## Must Not

- MUST NOT: przechowywać lub logować wrażliwych danych bez ACL/tenant boundaries.

## Should

- SHOULD: pozwolić na eksport meeting minutes do Document Studio / Outputs, jeśli pipeline jest dostępny.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`

