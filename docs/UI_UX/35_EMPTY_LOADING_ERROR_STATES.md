---
uiux_doc_id: UIUX_STATES_EMPTY_LOADING_ERROR
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Empty / Loading / Error / Degraded states

## Purpose

Ujednolicić stany UI tak, aby aplikacja była uczciwa (honest degraded) i testowalna.

## Applies To

Wszystkie ekrany, listy, formularze, generatory, pipeline’y, integracje.

## Must

- **MUST**: Każdy ekran ma jawne stany: `empty`, `loading`, `success`, `error`, `degraded/unavailable` (gdy dotyczy).
- **MUST**: `degraded/unavailable` jest dozwolone i preferowane wobec fake success, gdy backend/provider nie działa.
- **MUST**: Przy błędzie UI odpowiada na:
  1) co się stało, 2) co user może zrobić, 3) czy system spróbuje ponowić / co dalej.
- **MUST**: Brak infinite spinner — jeśli oczekiwanie może trwać, UI przechodzi do jawnego “job/progress” lub error/degraded.

## Must Not

- **MUST NOT**: Udawać sukcesu dla krytycznych operacji.
- **MUST NOT**: “milcząco” chować błąd (brak komunikatu) na krytycznej ścieżce.

## Should

- **SHOULD**: Error taxonomy używa stabilnych kodów/klas (tam gdzie backend je dostarcza).
- **SHOULD**: Degraded listy pokazują per-row status + zbiorczy banner.

## Acceptance Criteria

- [ ] Dla każdej krytycznej akcji istnieje dowód (screen/test), że error i degraded są czytelne.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §3, Standard komunikatów)

