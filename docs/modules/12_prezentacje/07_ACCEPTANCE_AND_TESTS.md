---
module_id: MODULE_PRESENTATIONS
doc_kind: TESTS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Acceptance & Tests — Prezentacje (Presentation Studio)

## Purpose

Zdefiniować weryfikowalne kryteria akceptacji oraz minimalny plan testów.

## Must

- MUST: sprint gates nie zostawiają P0/P1 otwartych (wg sprint plan).
- MUST: `/prezentacje` jest uczciwe i restartowalne: fatal errors przerywają pipeline i pokazują toast (bez infinite spinner).
- MUST: reopen decków z “Recent” nie daje 404 (używa `/api/artifacts/origin/presentation/...`).
- MUST: “Open in builder” działa deterministycznie (same-tab nav do `/presentations/builder/:deckId`).

## Must Not

- MUST NOT: “fake success” dla krytycznych akcji.
- MUST NOT: infinite spinner bez recovery.

## Should

- SHOULD: manual QA loop (R1/R2) jest utrzymany jako evidence (testy_antygravity reports).

## Acceptance Criteria

- [ ] PASS/BLOCKED językiem z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Checklisty obejmują: loading/success/error/empty/degraded + refresh resistance.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md` (jeśli dotyczy)
- `DRD/consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_SPRINT_PLAN_2026-05-08.md`
- `DRD/testy_antygravity/reports/2026-05-09_0519_presentations-manual-loop-r1-builder-handoff.md`

