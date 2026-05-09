---
module_id: MODULE_INITIATIVES
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Inicjatywy

## Purpose

Zdefiniować UX modułu Inicjatyw: hub/listy, widok inicjatywy, properties strip (“6 fields”), CTA bar oraz zasady Menu 3 dla akcji AI/workflow.

## Must

- MUST: ekran listowy/hub jest zgodny z `module-hub-standard.md` (Menu 2 + jeden rząd Menu 3/command row).
- MUST: CTA bar renderuje workflow actions i create actions wg backend capabilities; workflow actions nie są pokazywane jako disabled.
- MUST: AI CTA jest po prawej stronie w kanonicznym slocie (Menu 3 / command row), nigdy jako osobny pasek w canvasie.

## Must Not

- MUST NOT: dodatkowy toolbar między Menu 3 a tabelą/treścią.
- MUST NOT: pokazywać raw internals (błędy, JSON) zamiast biznesowego komunikatu.

## Should

- SHOULD: UI jasno komunikuje, co blokuje gate (readiness check) i co użytkownik może zrobić dalej.

## Acceptance Criteria

- [ ] Menu 3 ma presety/statusy po lewej, akcje kontekstowe + AI po prawej.
- [ ] Brak “fake success” w kluczowych akcjach (save, transition).

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/ui-standards/03-modules/module-hub-standard.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`

