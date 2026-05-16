---
uiux_doc_id: UIUX_ACCEPTANCE_CRITERIA
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX acceptance criteria (PASS/BLOCKED canon)

## Purpose

Ujednolicić słownik wyniku testu/oceny UI/UX (manualnej lub automatycznej) i minimalne progi jakości.

## Applies To

Cała aplikacja (moduły, admin, superadmin, settings, AI OS, narzędzia).

## Must

- **MUST**: Używać wyników: `PASS`, `PASS_WITH_P2` (aka `PASS_WITH_LIMITATIONS`), `BLOCKED_P1` (aka `BLOCKED`), `INCONCLUSIVE`.
- **MUST**: `BLOCKED_P1` oznacza złamanie krytycznego kontraktu użytkownika (brak wejścia, brak zapisu/read-back, crash/hang, infinite spinner, dane giną po refreshu, broken lifecycle).
- **MUST**: `PASS_WITH_P2` oznacza “działa”, ale są problemy jakościowe/UX/dane/copy/fixture — bez złamania core workflow.
- **MUST**: `INCONCLUSIVE` oznacza brak jednoznacznego wyniku (brak danych, konto testowe nie działa, UI zbyt niejasne, środowisko niestabilne).

## Must Not

- **MUST NOT**: Mylić `INCONCLUSIVE` z “to jest OK” — to sygnał, że potrzebne są lepsze dane, lepszy UX albo stabilniejsze środowisko.
- **MUST NOT**: Oznaczać jako `PASS` przypadków z P0/P1.

## Should

- **SHOULD**: Dołączać severity dla znalezionych problemów: P0/P1/P2/P3.

## Acceptance Criteria

- [ ] Słownik wyników jest spójny z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`

