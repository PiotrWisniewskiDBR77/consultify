---
module_id: MODULE_OUTPUTS
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Outputy (Outputs Library)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: route truth: `/presentations` jest kanoniczne; `/reports*` redirectuje do `/presentations`.
- MUST: artefakt po generacji jest widoczny w hubie (w scope widoczności).
- MUST: failure w pipeline pokazuje toast/error (brak infinite spinner).
- MUST: reopen decków nie używa błędnej ścieżki (origin vs orig).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: smoke test dla “Open in builder” (same-tab handoff) + komunikat gdy zablokowane (`BLOCKED_P1` jeśli freeze).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)
- `DRD/testy_antygravity/ANYGRAVITY_PRESENTATIONS_FIX_RETEST_2026-05-08_PROMPT.md`

