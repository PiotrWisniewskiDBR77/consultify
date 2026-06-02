---
uiux_doc_id: UIUX_EXECUTIVE_ARTIFACT_LAYOUT
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Executive artifact layout (MELS)

## Purpose

Zamknąć kanoniczny układ dla “executive modules” (Wordy/Tabele/Prezentacje): top bar + left rail + canvas + right rail, jako jeden wspólny layout kontrakt (MELS).

## Applies To

Wordy (`/wordy`), Tabele (`/tabele`), Prezentacje (`/prezentacje`) oraz przyszłe moduły authoringowe artefaktów.

## Must

- **MUST**: MELS jest układem kanonicznym i “locked” — moduł, który od niego odstępuje, wymaga jawnego waiver.
- **MUST**: Układ ma 3 strefy + top bar: left rail / canvas / right rail (narzędzia).
- **MUST**: Brak Menu 2 jako drugiego toolbara pod top bar.
- **MUST**: Akcje AI nie są w canvasie ani pod nim; należą do right rail (narzędzia) albo do zatwierdzonego miejsca w top bar.

## Must Not

- **MUST NOT**: Dodawać kolejnych toolbarów w module (top bar + tylko rails).
- **MUST NOT**: Umieszczać kontekstowych akcji AI w treści canvasu jako osobny pasek.

## Acceptance Criteria

- [ ] Moduł spełnia kryteria zgodności MELS z `MODULE_EXECUTIVE_LAYOUT_STANDARD.md`.

## Related Sources

- `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md`
- `DRD/consultify/docs/ui-standards/00-foundation/color-system.md`

