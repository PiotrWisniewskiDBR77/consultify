# OCENA-OTWORZ — pomiar PRZED/PO (06.09, stanowisko lokalne)

Gałąź `mvp/ocena-otworz` z `codex/m03-admin-20260824` (`8547baf97c`).
Aplikacja: własny vite :3114 → API :4100 (HEAD). Sesja: `auth-ocena.json`.
Motyw jasny, 1440 px. Wszystkie zrzuty: ten katalog.

## Sprostowanie nazwy z re-audytu A
Re-audyt mówił „lista Outputów". Ekran, na którym stoi defekt, to zakładka
**Ocena → Raporty** (kolumny TYP/NAZWA/KONTEKST/STATUS/POSTĘP/AUTOR), a nie
zakładka **Wnioski** (Outputy jądra + oceny zastane). Wiersz z re-audytu:
„DRD Manufacturing — Executive Summary & Deep Analysis (C-suite)",
status **Zatwierdzone**, postęp **100 %** — `02-przed-raporty-lista.png`.

## (a) wiersz → podgląd → „Otwórz"
| | PRZED | PO |
|---|---|---|
| URL | `/reports/builder/report-drd-test-exec` | `/assessment/outputs/ocena~assess-drd-manufacturing-01/report` |
| ekran | Kreator raportów, „Zacznij budować raport", 0 bloków | `AssessmentReportDocument` — 4 rozdziały, macierz DRD, treść raportu |
| zrzut | `03-`, `04-` | `10-`, `16-` |
| błędy konsoli / ≥400 | 0 / 0 | 0 / 0 |

Drugi raport (NIE zatwierdzony) — „SIRI — Full Industry 4.0 Readiness Report
& Benchmark" (Czeka na zgodę, 40 %): PO → `/assessment/outputs/ocena~assess-siri-readiness-01/report`,
zrzut `11-`, 0 błędów, 0 ≥400. PRZED szedł tą samą, JEDYNĄ gałęzią kodu
(`handleOpenDocument`, docType `report`) → kreator; kreator dla tego raportu
też nie ma pola `sections` (`GET /api/report-builder/report-siri-review`).

## (b) trasa raportu bezpośrednio
`/assessment/outputs/ocena~assess-drd-manufacturing-01/report` — PRZED i PO
identycznie: sekcje 1–4, macierz DRD dla 7 osi / 39 obszarów, przepisana treść
raportu zastanego (streszczenie + 17 zapisanych pozycji). Zrzuty `05-`, `10-`, `16-`.
Trasa NIE była zepsuta — zepsuty był przycisk, który do niej nie prowadził.

## (c) „Pokaż jako prezentację"
`/assessment/outputs/ocena~assess-drd-manufacturing-01/presentation` — działa,
0 błędów, 0 ≥400 (`06-` PRZED, `14-` PO). Wejście z zakładki Wnioski (pigułki
„Pokaż raport" / „Pokaż jako prezentację" w podglądzie) — `15-`.

## (d) trzy przyciski Pobierz
`GET /api/assessment-reports/assessment/assess-drd-manufacturing-01/export/<format>`:

| przycisk | format | HTTP | rozmiar | sygnatura |
|---|---|---|---|---|
| Pobierz raport (DOCX) | `report.docx` | 200 | 258 727 B | `PK..` (ZIP/OOXML) |
| Pobierz prezentację (PPTX) | `deck.pptx` | 200 | 563 138 B | `PK..` (ZIP/OOXML) |
| Pobierz prezentację (PDF) | `deck.pdf` | 200 | 57 603 B | `%PDF-` |

Klik wszystkich trzech w przeglądarce: zero odpowiedzi ≥400, zero komunikatu
„Nie udało się pobrać pliku" — `12-po-pobierz-trzy-przyciski.png`.
(Pliki binarne skasowane po pomiarze — nie zostawiamy 880 kB w repo.)

## Przyczyna (plik:linia)
`src/components/assessment/AssessmentHub.tsx`, `handleOpenDocument` — gałąź
`docType === 'report'` miała JEDNO wyjście: `navigate('/reports/builder/…')`.
Raport oceny nigdy nie miał drogi do własnego czytnika.
Wina NIE jest w danych: projekcja (`assessmentOutputProjection.ts`) i
`reportApi.fetchOutputForReport` działały poprawnie — pokazuje to (b).

## Naprawa
`trasaOtwarciaRaportuOceny` (`assessmentOutputProjection.ts`) + wołacz
w `handleOpenDocument`. Raport z oceną źródłową → czytnik; Kreator zostaje
ścieżką EDYCJI („Otwórz w edytorze" / kebab „Edytuj" — `13-` potwierdza,
że dalej prowadzi do `/reports/builder/report-drd-test-exec`).
Za flagą `isAssessmentOutputArtifactsEnabled()` (OFF → stare zachowanie,
bo trasa raportu przy OFF odbija na `?tab=outputs`).

## Uwaga na przyszłość (poza zakresem tego zlecenia)
Podgląd wiersza w zakładce **Wnioski** dla oceny ZASTANEJ pokazuje plakietkę
„Zapis sesji", a w sekcji SZCZEGÓŁY zdanie „To jest zamrożony, niezmienny
snapshot zatwierdzony podczas sesji assessmentu" — dwa sprzeczne komunikaty
o jednym rekordzie (`15-po-wnioski-podglad-akcje.png`).
