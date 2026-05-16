---
uiux_doc_id: UIUX_TOASTS_BANNERS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Toasts / banners / notifications — protocol

## Purpose

Ujednolicić protokół komunikatów tak, by użytkownik zawsze dostawał czytelny feedback po akcji.

## Applies To

Operacje krótkie (toasts) i problemy dłuższe/kontekstowe (inline banners / inline states).

## Must

- **MUST**: Po krytycznej akcji/mutacji UI pokazuje toast w prawym dolnym rogu lub równoważny, równie czytelny inline komunikat.
- **MUST**: Toast jest spójny z backend result (brak sprzeczności).
- **MUST**: Dla problemów kontekstowych (provider unavailable, permission denied, brak danych, sync delayed) preferowany jest inline banner/state.

## Must Not

- **MUST NOT**: Pokazywać “Saved/Success” jeśli backend nie potwierdził zapisu.
- **MUST NOT**: Używać ogólników jako jedynego komunikatu (np. `INTERNAL_ERROR` bez wyjaśnienia).

## Should

- **SHOULD**: Toast ma konkretną treść, typ (success/error/warn/info) i związek z akcją usera.

## Acceptance Criteria

- [ ] Dla każdej krytycznej akcji istnieje widoczny feedback (toast albo inline banner/state).

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Standard komunikatów)
- `DRD/testy_antygravity/Piotr/05_UI_TOAST_AND_CORNER_NOTIFICATION_PROTOCOL.md` (obowiązkowa obserwacja PDR po akcjach)
- `DRD/manual_Tests/README_TEST_PROCESS.md` (wymóg dowodu/raportu)

