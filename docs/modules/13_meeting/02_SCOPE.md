---
module_id: MODULE_MEETING
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Meeting

## Purpose

Ustalić granice odpowiedzialności Meeting: capture + strukturyzacja, integracje zależne od dostępnych źródeł.

## In scope (Must)

- MUST: notatki ze spotkań + action items + decisions jako obiekty, które można powiązać z Initiative / My Work.
- MUST: jasne stany “empty/partial/degraded” gdy integracje (np. calendar) nie istnieją.

## Out of scope (Must Not)

- MUST NOT: pełna synchronizacja kalendarzy i wideokonferencji bez jawnie opisanego SoT i integracji.

## Should

- SHOULD: pozwolić konwertować notatki do artefaktów (Tasks/Decisions/Outputs) z traceability.

## Acceptance Criteria

- [ ] Zakres nie dubluje Notebook (Notebook = living knowledge; Meeting = capture event).

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`

