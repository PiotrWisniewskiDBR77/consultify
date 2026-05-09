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

## Idea Notebook (minimal evidence pack)

- **MUST**: Dowód quick capture:
  - notatka zapisana bez wyboru kategorii/projektu przed zapisem (oraz brak utraty przy refresh).
- **MUST**: Dowód scope/privacy:
  - private vs project/team/client note + permissions‑aware visibility (deny/locked bez leakage).
- **MUST**: Dowód enrichment jako sugestii:
  - tytuł/summary/tagi/linki z confidence + user accept/reject.
- **MUST**: Dowód Review Queue:
  - widok notatek wymagających decyzji (convert/link/merge/memory) działa jako główna “ochrona przed śmietnikiem”.
- **MUST**: Dowód konwersji:
  - note → idea → initiative candidate z zachowaniem `source_note_ids` i approval.
- **MUST**: Dowód memory candidates:
  - propozycja memory candidate + approval; brak auto‑memory dla wrażliwych treści.

## Process Flow Studio (minimal evidence pack)

- **MUST**: Dowód “process as artifact (not picture)”:
  - proces ma strukturalne `nodes/edges/swimlanes` (inspector pokazuje dane), nie tylko canvas layout.
- **MUST**: Dowód prompt-to-process + manual edit:
  - draft z promptu + możliwość poprawy na canvasie + autosave.
- **MUST**: Dowód source provenance + confidence:
  - co najmniej dla kluczowych kroków: `source references` + `confidence_score` (AI‑pochodne elementy).
- **MUST**: Dowód Process QA:
  - lista problemów (brak start/end, brak owner, brak input/output, dead ends/orphans) + link do kroków.
- **MUST**: Dowód current vs future + diff:
  - widoczne rozdzielenie stanów i structural diff (nodes/edges/owners).
- **MUST**: Dowód “problems → initiative candidates”:
  - kandydat inicjatywy linkuje do kroków źródłowych (`source_node_ids`).
- **MUST**: Dowód eksportu:
  - PDF + PNG/SVG czytelne (auto-layout nie degraduje procesu do nieczytelnej mapy).
- **MUST**: Dowód governance:
  - permissions/denial bez leakage + audit trail dla zmian/approvali.

## Whiteboard (minimal evidence pack)

- **MUST**: Dowód “board as artifact (not picture)”:
  - board ma strukturalne obiekty (sticky/frame/connector) widoczne w inspectorze, nie tylko canvas.
- **MUST**: Dowód workshop mode (live):
  - timer + voting + private ideation → reveal + follow presenter/bring-to-frame.
- **MUST**: Dowód AI clustering jako propozycji:
  - AI clustering nie niszczy oryginałów; jest `proposal → approve → new version` z możliwością rollback.
- **MUST**: Dowód provenance + confidence:
  - kluczowe obiekty/wnioski mają `source references` albo jawne `assumption` + `confidence`.
- **MUST**: Dowód “execution conversions”:
  - board → initiative candidates + board → task candidates (z linkiem do source objects),
  - board → dokument/prezentacja/tabela z source links.
- **MUST**: Dowód exportu:
  - PDF + PNG/SVG czytelne; brak “fake success” na eksporcie.
- **MUST**: Dowód governance:
  - permissions/denial bez leakage + audit trail + confidentiality mode.

## Ideas Tables (minimal evidence pack)

- **MUST**: Dowód “table as artifact (not spreadsheet)”:
  - tabela istnieje jako `TableArtifact` z wersją/status/owner (UI pokazuje artifact meta), a export XLSX/CSV jest wtórny.
- **MUST**: Dowód provenance per row i per cell:
  - przykładowy wiersz ma źródła; co najmniej jedna kluczowa komórka ma `source_references` + `ai_origin` + `confidence_score` **albo** jawne `assumption`.
- **MUST**: Dowód scoring jako sugestii:
  - impact/effort/risk/confidence (lub model) ma origin+confidence + user może edytować i przeliczyć priority.
- **MUST**: Dowód duplicate detection + merge approval:
  - system pokazuje podobne wiersze, diff i merge jako propozycję; merge zachowuje źródła i tworzy wersję.
- **MUST**: Dowód Table QA:
  - QA pokazuje braki (missing fields/owner/source/contradictions) i jest linkowalny do wierszy.
- **MUST**: Dowód versioning + semantic diff:
  - widać zmianę wierszy/komórek/źródeł między wersjami.
- **MUST**: Dowód conversions:
  - table → initiative candidates + table → task candidates (z linkiem do source rows),
  - opcjonalnie: table → doc/deck z source links.
- **MUST**: Dowód governance:
  - permissions/denial bez leakage + audit trail + client/internal mode dla pól/widoków.

## Must Not

- **MUST NOT**: Uznawać “działa u mnie” za dowód, jeśli brak screenów/testów dla error/degraded.

## Should

- **SHOULD**: Każdy dowód jest linkowalny i ma datę (raport, screenshot, krótki opis).

## Acceptance Criteria

- [ ] Dla funkcji/modułu istnieje checklista i evidence pack minimalny.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (wymóg dowodów + PASS/BLOCKED)

