---
uiux_doc_id: UIUX_EVIDENCE_REQUIREMENTS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Evidence requirements (UI/UX)

## Purpose

Zdefiniować minimalny dowód wymagany, żeby uznać UI/UX za zgodny z kontraktem.

## Applies To

Nowe funkcje, przebudowy, naprawy P0/P1 oraz “enterprise readiness” claims.

## Must

- **MUST**: Dla krytycznej ścieżki pokazać dowód stanów:
  - `loading`, `success`, `error`, `empty`, `degraded/unavailable` (jeśli dotyczy).
- **MUST**: Dla akcji high-impact: dowód “proposal → approval → execution → audit”.
- **MUST**: Dla security/ACL: dowód denial/locked state bez leakage.

## Document Studio (minimal evidence pack)

- **MUST**: Dowód `Source Pack Builder`:
  - screen/lista źródeł + statusy + “co pominięto” + wskazane braki danych.
- **MUST**: Dowód “source posture”:
  - fragment dokumentu z oznaczeniem: `has source` vs `assumption / missing source` (bez wygładzania).
- **MUST**: Dowód `AI edit loop`:
  - proposal → diff (sekcja/akapit) → approve/reject → nowa wersja + audit entry.
- **MUST**: Dowód exportu:
  - DOCX otwieralny w Word (style H1/H2/H3, TOC, header/footer),
  - PDF stabilny (pagination) **albo** jawny degraded/fallback jeśli PDF pipeline niedostępny.
- **MUST**: Dowód “no fake success”:
  - export fail pokazany jawnie, artifact bezpieczny, użytkownik ma recovery path.

## Presentation Studio (minimal evidence pack)

- **MUST**: Dowód “plan before generate”:
  - outline/plan decku widoczny przed generacją slajdów.
- **MUST**: Dowód source posture:
  - slajd/claim z `SourceReference` oraz jawny warning dla claimu bez źródła.
- **MUST**: Dowód `AI edit loop`:
  - proposal → diff (co najmniej treść + źródła) → approve/reject → nowa wersja + audit entry.
- **MUST**: Dowód rozróżnienia deck intent:
  - “do czytania” vs “do prezentowania” widoczne w UI i wpływa na output.
- **MUST**: Dowód exportu:
  - PPTX otwieralny i edytowalny w PowerPoint,
  - PDF gotowy do wysłania,
  - jawny degraded/fallback jeśli któryś pipeline niedostępny.

## Must Not

- **MUST NOT**: Uznawać “działa u mnie” za dowód, jeśli brak screenów/testów dla error/degraded.

## Should

- **SHOULD**: Każdy dowód jest linkowalny i ma datę (raport, screenshot, krótki opis).

## Acceptance Criteria

- [ ] Dla funkcji/modułu istnieje checklista i evidence pack minimalny.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (wymóg dowodów + PASS/BLOCKED)

