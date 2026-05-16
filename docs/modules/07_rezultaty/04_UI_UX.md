---
module_id: MODULE_RESULTS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Rezultaty (Results)

## Purpose

UI/UX kontrakt Results: KPI operator workspace (table+preview), reporting i ROI, z jednym command row i uczciwymi stanami jakości danych.

## Must

- MUST: stosować kanoniczny układ Menu 2 + Menu 3 wg `module-hub-standard.md`.
- MUST: table+preview jako kanon dla list KPI i inicjatyw w Results.
- MUST: degraded/empty/error stany są jawne (np. brak danych, brak linków Finance, permission denied).
- MUST: brak osobnych AI toolbarów poza prawym slotem Menu 3.

## Must Not

- MUST NOT: synthetic demo backfill udający realne KPI/initiative records.
- MUST NOT: pokazywać “/results” linków jeśli route truth jest `/benefits` (unikać split-brain).

## Should

- SHOULD: ekran jasno rozróżnia “metric truth” (Results) vs “finance modeled truth” (Finanse), a linkage jest opcjonalne.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/ui-standards/evidence/results/STATUS.md`

