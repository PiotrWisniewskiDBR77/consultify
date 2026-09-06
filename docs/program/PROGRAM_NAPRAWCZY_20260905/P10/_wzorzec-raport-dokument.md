# Wzorzec „raport-dokument" — kontrakt bazowy (DEC-429, partia B5)

**Status:** PROPOZYCJA — do słowa właściciela. Baza wspólna dla kart typu „raport z tożsamością
rekordu"; per-karta odstępstwa w `execution-report.md` i `audit-report.md` (i dalej w kolejnych
partiach dla `assessment-report`, `presentation` — patrz `MATRYCA_21_KART.md` §1.5/§4.4).

## Rozstrzygnięcie CTO (zapis obowiązujący od tej partii)

Inwentarz (`INWENTARZ_KART_N_PELNY.md`) zostawił „do rozstrzygnięcia" kilka pozycji Realizacji
z dopiskiem *„tożsamość stała (jeden egzemplarz), nie per rekord"*. Rozstrzygnięcie:

> **Raport o STAŁEJ TOŻSAMOŚCI REKORDU (migawka z własnym ID, którą da się otworzyć ponownie,
> zapisać, zatwierdzić, wyeksportować) JEST kartą N archetypu B.**
> **Raport „na żądanie" bez rekordu (ekran, który tylko liczy i pokazuje dane na żywo, znika
> po zamknięciu, nie ma `id` do odczytania później) NIE jest kartą N — to ekran generatora/listy.**

Test rozstrzygający: czy istnieje `GET /.../<id>` które po zamknięciu i ponownym otwarciu odda
**dokładnie ten sam** zapisany dokument (nie przeliczony na nowo)? Jeśli tak → karta B. Jeśli
ekran zawsze liczy na świeżo z API i nie ma własnego `id` do odczytania — nie jest kartą N
(patrz `execution-control-loop.md`, `execution-work-intelligence.md`,
`execution-resources-capacity.md`, `execution-report-generator.md` — zastosowanie tej reguły).

## Kształt wspólny (gdy karta JEST archetypem B wg reguły wyżej)

| element | kontrakt |
|---|---|
| Tożsamość | rekord ma `id` (UUID), `status` (`draft/szkic` → `published/opublikowany`), `version`, `createdAt`/`createdByName`; GET po `id` zwraca zapisany `payload`, nie przeliczenie na żywo |
| Zamrożenie danych | pole `asOf`/`period.start-end` — dokument mówi „stan na dzień X", dane źródłowe mogą się zmienić PO zamrożeniu bez wpływu na już zapisaną migawkę |
| Budowa treści | dwuetapowa: (1) czytanie z kilku realnych API osobno, jedno 500 nie kasuje reszty (`Promise.all` + `unavailable[]`), (2) wyliczenie sekcji/metryk z tych danych w warstwie frontendu lub backendu — nigdy treść „na sztywno" |
| Sekcje | `title` + (`narrative` i/lub `bullets` i/lub `table{columns,rows}`), pusta sekcja pokazuje `empty: <powód>` zamiast pustej ramki (odpowiednik K4) |
| Tabele wewnątrz dokumentu | wiersze są ZAMROŻONĄ TREŚCIĄ (część dokumentu), NIE rekordami do filtrowania/otwierania — zakaz `StandardTable` tutaj (brak kliku w wiersz/kebaba/sortowania); oznaczenie `data-canon="§27-exempt"` z komentarzem odsyłającym do `DOKTRYNA_TABELA_NIE_EXCEL.md` |
| Akcje | Pobierz DOCX / Pobierz PDF (`UnifiedExportService`) / Zatwierdź / Opublikuj — cykl życia szkic→opublikowany, dwa różne stany dokumentu (przed/po publikacji) NIE dwa różne komponenty |
| Prawy panel | jeśli karta ma `ArtifactRightPanel` — sekcje wg `ARTIFACT_PANEL_SECTION_ORDER` (Akcje→Właściwości→Powiązania→Źródła i założenia→Komentarze→Historia); **Właściwości WYŁĄCZNIE przez `ArtifactPropertiesTable`** (nagłówek „Właściwość \| Wartość"), nie luźne divy |
| Menu 5 | Sekcje ▾ / Edycja-Podgląd (może być ukryty z powodem — dokument zamrożony jest z natury „tylko do odczytu" poza cyklem zatwierdzania) / **Pracuj z AI ▾** z trzema pozycjami (K21) — dziś brakuje w OBU kartach tej partii (patrz per-karta pliki) |
| AI (K21–K24) | dokument nie ma dziś wpisu w `cardAnalysisRubric.ts`/`registry.ts` — silnik kart N go „nie zna"; **do decyzji właściciela**: czy 13/6-sekcyjny dokument dostaje „Uzupełnij tę sekcję" per sekcja, czy zostaje wyjątkiem (treść jest z definicji wyliczona z danych, nie redagowana ręcznie) |
| i18n | tytuły sekcji idą z backendu (`server/src/services/.../report*.ts`) — pilnować, żeby nie wchodziły tam angielskie słowa techniczne w polskim tytule (przykład złamania: `audit-report.md` §5) |
| Pigułka modułu (K19) | wymaga jawnego wpisu do `openDocuments`/`activeDocumentId` (Execution) albo trasy z `:id` w URL (Audyty); ekran, który zarządza własnym stanem otwarcia bez wpisania się do żadnego z tych mechanizmów, NIE dostanie pigułki nawet jeśli reszta kanonu jest spełniona |

## Co NIE wchodzi do wzorca (odstępstwa zostają w per-karcie)

- liczba i nazwy sekcji (13 dla audytu, zmienna dla realizacji wg definicji),
- czy dokument ma bramkę dwóch aktorów (owner≠approver) czy jednego,
- źródło danych (per moduł — Realizacja czyta `/api/tasks`+`/api/decisions`+`/api/raid`+
  `/api/initiatives`+`/api/execution-control/delay-signals`; Audyt czyta zapisany `payload`
  z trzech możliwych rendererów, patrz `audit-report.md` §0),
- obecność drugiego trybu prezentacji („Widok dla zarządu" w audycie — deck 8-sekcyjny na żywo,
  bez odpowiednika w Realizacji).

## Rejestr kart, które dziś pasują do wzorca (stan 06.09.2026, partia B5)

| karta | plik:linia | ma własne `id` z `GET /.../:id`? | status wzorca |
|---|---|---|---|
| `execution-report` | `src/components/Execution/ExecutionReportDocument.tsx:57` | tak — `execution_report_snapshots.id`, `GET /api/execution-reports/runs/:id` (`server/src/routes/executionReports.routes.ts:323`) | karta B — kontrakt w `execution-report.md` |
| `audit-report` | `src/components/Audit/method/AuditReportDocumentView.tsx:1` | tak — `audit_reports.id`, `GET /audits/reports/:id` (`server/src/routes/audits/reports.routes.ts:167`) | karta B — kontrakt w `audit-report.md` |
| `execution-control-loop` / `execution-work-intelligence` / `execution-resources-capacity` / `execution-report-generator` | `src/components/Execution/reports-intelligence/*.tsx` | **nie** — brak `id`, brak `GET` po identyfikatorze, ponowne otwarcie = nowe wyliczenie | NIE karta N — patrz pliki per-slug |

Dublet do obserwacji: `src/components/Execution/ReportDocumentView.tsx:1698` (stary renderer,
`ReportRun`/`runtime-v1`, wciąż wołany przez `handleOpenReport` w `ExecutionHub.tsx:2906`) —
to TRZECI, równoległy renderer „raportu realizacji" obok `ExecutionReportDocument` i katalogu
`report_definitions`. Szczegóły rozjazdu w `execution-report.md` §7.
