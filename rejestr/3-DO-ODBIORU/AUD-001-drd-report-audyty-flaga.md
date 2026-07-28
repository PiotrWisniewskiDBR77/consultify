# AUD-001 — Raport DRD podłączony do modułu Audyty (za flagą OFF)

- **Stan:** DO ODBIORU (2026-07-26)
- **Flaga:** `ff_drd_report` — query `?ff_drd_report=1` → `localStorage['ff.drdReport']` →
  env `VITE_DRD_REPORT_ENABLED` → **default OFF**. Przy OFF zachowanie AuditsHub bajt-w-bajt
  jak dziś (tablica zakładek ma dokładnie jeden element mniej).
- **Demo:** wdrożone w `4afa506200` (część STD-002), tag `demo-safe-2026-07-26-standard`.

## Co to jest
Widok `DRDAuditReportView.tsx` (792 linie, pełny edytor raportu z czatem AI, eksport PDF) istniał
w kodzie od dawna, ale miał **zero importerów** — kompletny, działający silnik (backend
`server/src/services/report/drdReportGenerator.ts`+`drdReportService.ts`, żywy) był całkowicie
niedostępny z UI. Ta fala go podłączyła:
- Nowa zakładka **„Raporty DRD"** w `AuditsHub` (widoczna tylko gdy flaga ON), lista przez
  `Api.getAssessmentReports()` (już używane produkcyjnie w `AssessmentHub.tsx`) na StandardTable.
- Nowa trasa `/audit-programs/drd-report/:reportId` montująca `DRDAuditReportView`.
- Przy okazji naprawiono 2 realne bugi w tym widoku (były tam od dawna, nikt ich nie widział bo
  widok był odpięty): eksport PDF pobierał `pdfUrl` z odpowiedzi, która realnie jest surowym
  blob PDF (pobieranie było zepsute — `href="undefined"`); przycisk „Wróć" nawigował do
  martwego legacy widoku zamiast do `/audit-programs`.

## Do klikania w odbiorze (po włączeniu flagi: dopisz `?ff_drd_report=1` do URL Audytów)
1. Wejdź `/audit-programs?ff_drd_report=1` → kliknij zakładkę „Raporty DRD" → lista raportów
   (StandardTable, kebab, sort) → „Otwórz" na dowolnym → pełny edytor z sekcjami + asystent AI.
2. Sprawdź eksport PDF (teraz naprawiony) i przycisk „Wróć" (wraca do `/audit-programs`, nie do
   martwego legacy widoku).
3. Wyłącz flagę (usuń query param) → zakładka znika, zero śladu w UI.

## Zrzuty referencyjne (render-verify, zrobione przed odbiorem — reguła #7)
Dev-render harness `audyty-drd-report` (warianty `list`/`report`, light+dark) — dane mock
(Elkomtech/NordFarm/Bielmar), zero lorem. Zweryfikowane osobiście: tokeny c-*, zero crimson,
zgodność z triadą (StandardTable/kebab/CTA neutralne).

## Uwaga
Nagłówki kolumn tabeli „Raporty DRD" mieszają PL/EN (ASSESSMENT/STATUS po angielsku,
PROGRAM/AKTUALIZACJA po polsku) — pre-existing w `AuditsHub`, nie wprowadzone tą falą,
odnotowane do osobnej poprawki i18n.
