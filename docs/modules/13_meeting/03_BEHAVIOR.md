---
module_id: MODULE_MEETING
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Meeting

## Purpose

Kontrakt zachowania Meeting: capture → strukturyzacja → linkowanie → follow-up.

## Must

- MUST: umożliwić zapis notatek oraz wydzielenie “Decisions” i “Action items”.
- MUST: zapewnić traceability do kontekstu (initiative/workspace/note) i jawny author/audit.
- MUST: AI może pomagać w strukturyzacji, ale działa proposal-first (accept/reject).

## Must Not

- MUST NOT: silent execution (auto-tworzenie tasków/decisions bez akceptacji).
- MUST NOT: ujawniać w UI/logach raw payloadów wrażliwych.

## Should

- SHOULD: wspierać eksport/konwersję (np. meeting minutes → document) przez Outputs, jeśli pipeline istnieje.

## Acceptance Criteria

- [ ] Brak “fake confidence”: jeśli nie ma integracji (calendar), UI to komunikuje.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`

