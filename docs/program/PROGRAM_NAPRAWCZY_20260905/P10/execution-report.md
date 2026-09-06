# Raport realizacji (`execution-report`)

**Status:** PROPOZYCJA — do słowa właściciela. Wzorzec bazowy: `_wzorzec-raport-dokument.md`.
Pomiar 06.09.2026 na HEAD gałęzi bazowej (`codex/m03-admin-20260824`) — kod zmienił się TEGO DNIA
(1.12-R4, DEC-427); inwentarz (`INWENTARZ_KART_N_PELNY.md` #31) jeszcze wskazuje stary komponent
`ReportDocumentView.tsx:1698` — nieaktualne, patrz §7.

## §0. Tożsamość

- Nazwa PL: **Raport realizacji** (migawka na czterech poziomach: Właściciel inicjatywy / PMO /
  Komitet sterujący / Zarząd).
- Moduł: `06_EXECUTION`. Archetyp: **B — Dokument** (rozstrzygnięcie CTO, `_wzorzec-raport-dokument.md`:
  rekord ma trwałe `id`, `GET` po `id` zwraca zapisaną migawkę, nie przeliczenie na żywo).
- Otwarcie: `/execution` → zakładka **Raporty** → wiersz migawki → „Otwórz" (stan `openRun` w
  `ExecutionReportsSurface.tsx:179`; BRAK własnej trasy/URL — patrz §7, K26).
- Komponent: `src/components/Execution/ExecutionReportDocument.tsx:57` (304 linie), montowany z
  `src/components/Execution/ExecutionReportsSurface.tsx:775`, ta z `ExecutionHub.tsx:6075`
  (`activeTab === 'reports'`).
- Powłoka dziś: **żadna ze standardowych** — `<article>` własny, bez `ArtifactRightPanel`, bez
  `NModeShell`/`StandardArtifactShell`, bez Menu 5.
- Rekord: `execution_report_snapshots` (migracja `server/migrations/20262104_execution_report_snapshots.sql:18`,
  kolumny `id/organization_id/definition_key/level/title/period_start/period_end/as_of/status/rag/payload`).

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych (API → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Nagłówek (poziom, tytuł, stan na, okres, status, autor, RAG) | tożsamość migawki na pierwszy rzut oka | kolumny `execution_report_snapshots` → `GET /api/execution-reports/runs/:id` (`server/src/routes/executionReports.routes.ts:323`) | zawsze widoczny (pola rekordu) | 1 | L |
| Mierniki (do 6 kafli) | liczby na skróty (np. „Zadania po terminie") | `payload.metrics[]`, wyliczone w `derive()` (`src/components/Execution/executionReportModel.ts:150`) z `/api/tasks`+`/api/decisions`+`/api/raid` | znika, gdy `metrics` puste | 2 | L |
| Sekcje treści (narracja/listy/tabela) | ciało raportu — per definicja (np. „Zadania po terminie", „Decyzje do rozstrzygnięcia") | `payload.sections[]` budowane w `buildExecutionReportSnapshot` (`executionReportModel.ts:268`) z `/api/initiatives?limit=200`, `/api/tasks`, `/api/decisions`, `/api/raid`, `/api/execution-control/delay-signals` (wszystkie odczyty: `executionReportModel.ts:112-135`) | sekcja pokazuje `section.empty` (tekst z powodem — brak danych / źródło nie odpowiedziało), nie pustą ramkę | 3..n | L |
| Akcje (Pobierz DOCX/PDF, Opublikuj) | eksport i cykl życia szkic→opublikowany | `downloadExecutionReportFile`/`publishExecutionReportRun` → `GET /runs/:id/export.docx\|pdf` (`:510-511`), `POST /runs/:id/publish` (`:418`) | „Opublikuj" znika po publikacji (`run.status !== 'PUBLISHED'`) | osobny pasek, nie sekcja | L |

Budowa migawki (POST) dzieje się PRZED wejściem w kartę — `POST /api/execution-reports/runs`
(`executionReports.routes.ts:355`) przyjmuje CAŁY payload wyliczony przez frontend
(`SnapshotSchema.safeParse(req.body)`) i zapisuje go 1:1; serwer nie przelicza treści z danych
źródłowych, tylko waliduje kształt i persystuje. Do zanotowania jako luka integralności (§7).

## §2. Prawy panel

**Brak w ogóle.** Zero `ArtifactRightPanel`. Wszystkie „właściwości" (poziom, stan na, okres,
status, autor, RAG) są wpisane w nagłówek dokumentu (`ExecutionReportDocument.tsx:122-160`), nie
w tabelę Właściwości. Brak sekcji Powiązania / Źródła i założenia / Komentarze / Historia — nie ma
też jawnego powodu pominięcia (K6–K11 wymagają albo sekcji, albo `pominięta: {reason}` — tu jest
milczenie, co kontrakt `KARTA_N_KONTRAKT.md` K10 nazywa błędem).

## §3. Menu 5 i nawigacja

Brak paska Menu 5 w całości: brak „Sekcje ▾", brak przełącznika Edycja/Podgląd, brak „Pracuj z AI ▾".
Lewy spis sekcji dokumentu też nie istnieje — użytkownik przewija długą stronę bez spisu treści
(dokument może mieć kilka–kilkanaście sekcji treści, zależnie od definicji).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| — | brak | brak | brak | wszystko (dokument jest z definicji wyliczony z danych, nie redagowany ręcznie) |

Zero przycisków AI. `execution_report`/`execution-report` nie istnieje w `cardAnalysisRubric.ts`
ani w `src/components/standard/registry.ts` (sprawdzone grepem — brak wpisu). K21 nie spełnione;
**do rozstrzygnięcia właściciela**: czy dokument wyliczony z danych w ogóle potrzebuje „Uzupełnij
tę sekcję" (nadpisanie liczb ręcznie generowanym tekstem może być niepożądane) — rekomendacja:
zostawić „Analizuj" (komentarz jakościowy do gotowej migawki, bez prawa zapisu treści liczbowej),
pominąć „Uzupełnij" z jawnym powodem.

## §5. Czytelność

- `grep -c "primary-[0-9]"` na pliku = 0 — czysto, wyłącznie tokeny `c-*` (autor pliku pisał to
  świadomie, komentarz w nagłówku pliku cytuje regułę CLAUDE.md wprost).
- Fokus: `focus-visible:ring-c-focus` na jedynym interaktywnym elemencie („Wróć do rejestru
  raportów”, linia 122) — zgodnie z K18.
- i18n: namespace `executionReports.*` w `public/locales/pl/translation.json:45633` bez leków
  angielskich (sprawdzone dla `field/action/level/ragLabel/status` — same polskie etykiety).
- Pigułka paska modułu (K19): BRAK — `openRun` jest stanem WEWNĘTRZNYM `ExecutionReportsSurface`,
  nigdy nie trafia do `ExecutionHub`'s `openDocuments`/`activeDocumentId` (`ExecutionHub.tsx:850`),
  więc otwarty dokument nie dostaje pigułki w Menu 2, mimo że zakładka „Realizacja" ma ten
  mechanizm gotowy i działający dla `execution-work-doc` (patrz `execution-work-doc.md` §5).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta`/`StandardSekcjaDef` dla `execution-report` w rejestrze |
| K2 kontrakt steruje renderem | n/d (nie dotyczy, bo K1 ✗) | — |
| K3 źródło danych per sekcja | ✓ (kodem) | `executionReportModel.ts:112-135` (fetch), `:150+` (derive), `:268+` (build) |
| K4 reguła pustki | ✓ | `section.empty` renderowane zamiast pustej ramki (`ExecutionReportDocument.tsx:271-275`) |
| K6–K11 prawy panel | ✗ | panel nie istnieje (§2) |
| K12–K16 Menu 5 | ✗ | pasek nie istnieje (§3) |
| K17 zero primary | ✓ | `grep -c "primary-[0-9]"` = 0 |
| K18 fokus c-focus | ✓ | `ring-c-focus` na jedynym przycisku nawigacyjnym |
| K19 pigułka modułu | ✗ | `openRun` nie wpisuje się do `openDocuments` (§5) |
| K21–K24 Pracuj z AI | ✗ | zero przycisków AI, brak wpisu w rubryce/rejestrze |
| K25 i18n | ✓ | namespace `executionReports.*` bez EN |
| K26 podgląd→Otwórz | ~ | z listy działa (klik→podgląd, „Otwórz"→dokument), ale dokument sam nie ma trasy z `:id` — nie da się wkleić linku i wrócić do TEJ migawki bez przejścia przez listę |
| K27 Teresa tylko Menu 1 | ✓ (przez nieobecność) | zero wzmianek „Teresa” w trzech plikach modułu |
| K28 zero UUID w DOM | ~ do zmierzenia — nie sprawdzone na żywo (§7 STOP) |
| K29 zero błędów konsoli | do zmierzenia na żywo (§7 STOP) |
| K30 odbiór na zrzucie 1440 | **STOP — brak zrzutu, patrz §7** |

## §7. Luki → naprawa

1. **Brak zrzutu z realnej trasy (STOP).** Zmierzone 06.09 wieczorem: serwer współdzielony
   `127.0.0.1:4100` (stanowisko-noc) odpowiada `API_ROUTE_NOT_FOUND` na
   `GET /api/execution-reports/runs` — proces API nie ma dziś zamontowanej trasy z commitu R4
   (`ef03c9f695`), mimo że kod jest już w gałęzi bazowej. Dodatkowo
   `GET /api/initiatives/runtime-v1/execution-cases` zwraca `{"cases":[]}` dla org DBR77 — zero
   danych execution-runtime-v1 do wygenerowania migawki nawet po restarcie. Restart procesu API
   stanowiska i utworzenie/wygenerowanie migawki wykracza poza zakres tej partii (zakaz dotykania
   `/private/tmp/stanowisko-noc` poza odczytem dwóch plików, zakaz tworzenia rekordów testowych bez
   sprzątania). **Przepis dla następcy**: (a) zrestartuj proces node na stanowisku (albo poczekaj
   na kolejny redeploy, który i tak podniesie R4), (b) w UI „Realizacja → Raporty” wygeneruj JEDNĄ
   migawkę definicji `initiative-card` (MVP), (c) zrzut 1440 light z otwartym dokumentem, (d) usuń
   migawkę po zrzucie (`DELETE` nie istnieje jeszcze w API — do zgłoszenia osobno, jeśli sprzątanie
   ma być możliwe bez ręcznego SQL). Rozmiar: S (samo uruchomienie), ale zależne od infrastruktury
   poza tym worktree.
2. **Trzeci, równoległy renderer tego samego pojęcia.** `ExecutionHub.tsx:2906` (`handleOpenReport`)
   wciąż woła STARY komponent `ReportDocumentView.tsx:1698` przez `activeDocumentId='report:<id>'`
   (`ExecutionHub.tsx:5850-5860`), zasilany z `enrichedReportCatalog`/`reportDataContext`
   (katalog `runtime-v1`/`ReportRun`, INNY system niż `execution_report_snapshots`). Wywołania tej
   funkcji (`ExecutionHub.tsx:3119,5464,5493,5601`) siedzą w `renderReportsCatalog()`
   (`ExecutionHub.tsx:5406`), którą woła `if (activeTab === 'reports') return renderReportsCatalog();`
   na **linii 6273** — ale identyczny warunek `if (activeTab === 'reports') return <ExecutionReportsSurface .../>` na **linii 6072** jest wcześniej w tej samej funkcji `renderContent` i zwraca się
   pierwszy. Wniosek: `renderReportsCatalog()` i cała ścieżka `ReportDocumentView`/`handleOpenReport`
   w zakładce „Raporty” wygląda na **martwy kod** (ten sam warunek dwa razy, drugi nieosiągalny) —
   do potwierdzenia uruchomieniowego (STOP z pkt 1 to blokuje) i, jeśli potwierdzone, do usunięcia
   albo świadomego pozostawienia jako inny ekran. Rozmiar: M (wymaga decyzji właściciela/CTO, czy
   `ReportRun`/`ReportDocumentView` ma zostać całkowicie wycofany, czy to inny, celowo osobny byt).
3. **Integralność migawki.** `POST /runs` zapisuje payload przysłany przez klienta bez przeliczenia
   po stronie serwera (`executionReports.routes.ts:355-408`) — technicznie klient mógłby wysłać
   dowolną treść pod real datę. Nie blokuje MVP (jeden aktor, brak dziś wielostronnego procesu
   zatwierdzania jak w audycie), ale warto odnotować jako różnicę względem wzorca audytu (tam
   treść liczy WYŁĄCZNIE `reportRenderer.ts` na serwerze). Rozmiar: L, wymaga decyzji CTO czy
   MVP tego wymaga.
4. **Brak prawego panelu / Menu 5 / AI** — jak w `_wzorzec-raport-dokument.md`; doprowadzenie do
   kontraktu wymaga przepięcia na `ArtifactRightPanel`+`NModeShell`+`PracujZAI`, analogicznie do
   `audit-report.md` (ten SAM wzorzec, ten sam plik bazowy AuditReportDocumentView pokazuje, że to
   wykonalne). Rozmiar: L.

**STOP-y do właściciela:** żaden — wszystkie STOP-y tego pliku są infrastrukturalne (proces API
stanowiska), nie produktowe; nie wymagają jednego pytania do Piotra, tylko odświeżenia środowiska
pomiarowego przez kolejnego wykonawcę.
