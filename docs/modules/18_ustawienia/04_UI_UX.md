---
module_id: MODULE_SETTINGS
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Ustawienia (Settings)

## Purpose

Zdefiniować UX Settings: sekcje i nawigacja, patterny formularzy, komunikaty “managed elsewhere”, i standardy dla stub/partial sekcji.

## Must

- **MUST**: Uczciwie komunikować status sekcji (`real/partial/stub`) w UX (bez mylenia użytkownika).
- **MUST**: Dla ustawień “tenant‑owned” pokazanych w Settings UI dostarczyć jawny handoff do Admin/Organization.
- **MUST**: Stosować globalne standardy: toasty/bannery, empty/error/degraded, brak silent execution.

## Must Not

- **MUST NOT**: Dublować paneli Admin w Settings.

## Should

- **SHOULD**: Spójny layout (nagłówki, opis, status, save affordance) dla wszystkich sekcji.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

