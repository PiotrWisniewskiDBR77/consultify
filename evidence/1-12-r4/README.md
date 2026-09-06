# 1.12-R4 — Raporty Realizacji na czterech poziomach

Gałąź `mvp/12r4-raporty-4-poziomy`, baza m03 `5599fc568d`. Pomiar i budowa 06.09.2026,
stanowisko lokalne (Postgres `consultify_noc`, org DBR77 `cc9db573-260f-4a19-927f-f3cc1fbaea38`,
konto `audyt@dbr77.local`).

## KROK 0 — POMIAR (plik:linia)

### (a) 11 definicji EXECUTION_PACK
- Żyją w tabeli `report_definitions` (`server/migrations/910_report_definitions.sql:41` tabela,
  `:71-135` seed 11 pozycji; `924_pm_report_templates.sql:26-52` dokłada 3 definicje
  `pm-report-*` innego rodzaju + 3 szablony `report_builder_templates`).
- Struktura per definicja: `audience`, `cadence`, `scope`, `sections_json` (dokładnie 5 sekcji),
  `source_binding.ragLogic` + `dataSources` + `followUpActions` + `icon` + `highlights`,
  `organization_id = NULL` (systemowe), `read_mode='live'`, `is_system=true`.
- Pomiar HTTP (4100, org DBR77): `GET /api/report-builder/definitions?kind=EXECUTION_PACK`
  → 200, 11 pozycji, **wszystkie po angielsku** (`Weekly Execution Pack`, `Program Health
  Summary`, `Sponsor-Ready One-Pager`, …).
- Trasa serwera: `server/src/routes/report-builder.routes.ts:332`.

**ZNALEZISKO 1 (przeoczone przez plan 1.12).** Te 11 definicji **nie dociera na ekran**.
`ExecutionHub.tsx:4390` je pobiera i buduje `reportCatalog` (`:4407`), a `renderReportsCatalog()`
(`:5287`) renderuje je pod `activeTab === 'reports'` (`:6058`) — ale **wcześniejsza** gałąź tej
samej funkcji, `ExecutionHub.tsx:5955-5960`, zwraca `ExecutionReportsSurface` bezwarunkowo.
`renderReportsCatalog()` jest kodem martwym; zakładka Raporty pokazuje wyłącznie rejestr
runtime-v1 (0 definicji, 0 migawek dla DBR77). Plan B2 zapisał „definicje z
/api/report-builder/definitions (ExecutionHub.tsx:4291)" — to nieprawda w runtime.

**ZNALEZISKO 2.** Wśród 11 definicji **nie ma definicji poziomu „właściciel inicjatywy"**
(C3 planu opisuje „Kartę realizacji", ale w bazie jej nie ma). Bez niej nie da się dostarczyć
„po jednym raporcie na poziom". Dołożona addytywnie jako 12. definicja `initiative-card`
(`server/migrations/20260906_execution_report_snapshots.sql:44`), spójnie z formatem 910.
Stąd podział to **4 MVP + 8 „Fala 2"**, a nie 4 + 7 jak zakładało zlecenie.

### (b) `reports-intelligence/` — 4 komponenty
| Plik | Linie | Co konsumuje | Czego brakuje |
| --- | --- | --- | --- |
| `WorkIntelligenceReport.tsx` | 535 | `listExecutionCases`, `readExecutionWork`, `readExecutionMilestones` (runtime-v1) | runtime-v1 ma dla DBR77 **0 spraw** → raport renderuje pustkę |
| `ResourcesCapacityReport.tsx` | 303 | `readOperationalAllocations` + capacity (runtime-v1) | brak podaży godzin (pytanie 2 z C5) + pusta rura |
| `ControlLoopReport.tsx` | 238 | `listManagementSignals`, `listInterventions` (runtime-v1) | 0 sygnałów i 0 interwencji w runtime-v1 |
| `UnifiedExecutionReportGenerator.tsx` | 371 | składa 3 powyższe | j.w. |
| `workReportModel.ts` | 207 | czysty model (bez I/O) | — |
Flaga `execReportsIntelligence`: **twardy `return false`** w
`src/components/Execution/executionFeatureFlags.ts:110` (przed regułą D-D).

### (c) `ExecutionReportsSurface.tsx` (1238 l.)
- Zakładki `Raporty` / `Definicje` — `:580-600`; CTA „Nowa definicja" `:562`, „Nowy raport" `:572`.
- Dane: `listReportRuns()`, `listReportDefinitions()`, `listExecutionCases()` (`:200-203`),
  wszystko z `runtime-v1`. Pomiar: `GET /api/initiatives/runtime-v1/report-definitions` → 200, **0**;
  `…/report-runs` → 200, **0**. Na stanowisku 0 migawek (u właściciela 2 testowe „ACO execution control").
- Edytory to surowy kontrakt (`JSON.parse(definitionJson)` `:437`), a `create()` `:359-372` wymaga
  **dokładnej opublikowanej wersji definicji** — przy 0 definicjach „Nowy raport" nie ma czego wybrać.

### (d) Generator dokumentów z 1.6
- Silnik: `server/src/services/export/UnifiedExportService.ts` — `exportPdf` `:157`, `exportDocx` `:274`,
  `exportXlsx` `:540`, `exportPptx` `:677`. **Domenowo neutralny**: wejście `ExportSource`
  `{title, markdown, sourceLabel, lifecycle, updatedAt, author, slides?}`; markdown jest tokenizowany
  (`markdownStructTokenize.ts`) i rzutowany na natywne prymitywy (nagłówki, listy, tabele docx).
- Wzorzec pobierania po stronie klienta (raport oceny / audytu): `AuditReportDocumentView.tsx:557`
  (`downloadDocx`) i `:592` (`downloadPdf`) — fetch → blob → tymczasowy `<a download>` → revoke.
- Wołanie dla innego dokumentu = zbudować markdown i podać go do `unifiedExportService`.
  Tak zrobiony jest krok 3 (`server/src/routes/executionReports.routes.ts:126` `snapshotToMarkdown`).
  **Nie było potrzeby wyodrębniania wspólnego wołacza** — on już istnieje i jest neutralny;
  ściśle związany z Oceną jest dopiero `report-builder.routes.ts:4057` (bramki jakości,
  `artifactRegistryService`, zapis pliku na dysk), i tego celowo nie ruszam.

## ZNALEZISKA INFRASTRUKTURALNE (nie moja naprawa)
- `server/migrations/20260412_seed_business_templates.sql:7-20` **zawęża** CHECK
  `v8_artifact_origin_links_origin_runtime_check` do 7 wartości, podczas gdy w bazie stanowiska
  są wiersze `document_template` (44) i `assessment_report`. Migracja jest **pending**
  (`tp_migration_history`: 731 z 740) i **wywraca każdy zimny start serwera** na tej bazie
  („Table Platform migrations failed" → DEGRADED, zero ruchu). Nie ruszam pliku (zmiana treści
  zastanej migracji = dryf sumy kontrolnej na innych środowiskach). Własny serwer uruchomiłem
  w trybie `DB_MANAGED_SCHEMA=off` (nazwany tryb „verify-only owner-review", `index.ts:269-275`).

---

## KROK 1 — cztery definicje MVP po polsku
- Tłumaczenie po KLUCZU (`executionReports.definitions.<key>.{name,audience,cadence,scope,sections.0..4}`)
  w `public/locales/pl|en/translation.json`. Treść w bazie (`report_definitions`) **nietknięta** —
  angielskie oryginały zostają, ekran ich nie pokazuje.
- Ekran: `ExecutionReportsSurface.tsx` — zakładka „Definicje" renderuje katalog z
  `GET /api/execution-reports/definitions` (kolumny: Definicja · Poziom · Kadencja · Odbiorcy · Status).
  Cztery aktywne: **Karta realizacji** (Właściciel inicjatywy), **Tygodniowy pakiet realizacji** (PMO),
  **Zdrowie programu** (Komitet sterujący), **Jedna strona dla sponsora** (Zarząd).
  Pozostałe **osiem** ma chip „Fala 2" i **nie ma pozycji „Wygeneruj raport"** w kebabie.
- Zrzuty: `01-definicje.png`, `01b-definicje-dol.png` (widać wszystkie 4 „Aktywna" + 8 „Fala 2").

## KROK 2 — migawka `asOf` na realnych danych
Przepływ: „Nowy raport" → wybór jednej z 4 definicji → okres (od/do) → „Generuj migawkę".
Generator (`executionReportModel.ts`, funkcja czysta) czyta RÓWNOLEGLE pięć źródeł:
`/api/initiatives?limit=200`, `/api/tasks`, `/api/decisions`, `/api/raid`,
`/api/execution-control/delay-signals`. Każde źródło osobno — awaria jednego daje sekcji jawną
etykietę „Brak danych — źródło nie odpowiedziało", nie niemą pustkę. Zapis:
`POST /api/execution-reports/runs` → status `Szkic`; „Opublikuj" → `Opublikowany`.
Dokument (archetyp B): `ExecutionReportDocument.tsx` — tożsamość, RAG z uzasadnieniem, pasek
mierników, sekcje wg definicji.

Liczby z migawki 06.09 (org DBR77): 23 inicjatywy w realizacji · 20 zadań po terminie ·
10 zablokowanych · 25 decyzji do rozstrzygnięcia (13 po terminie) · 73 % na czas · 16 pozycji RAID.

## KROK 3 — eksport DOCX/PDF
`GET /api/execution-reports/runs/:id/export.docx|.pdf` → `snapshotToMarkdown()` → **istniejący**
`UnifiedExportService` (ten sam silnik co raport Oceny/Audytu z 1.6). Nie było potrzeby
wyodrębniania wspólnego wołacza — `UnifiedExportService` jest domenowo neutralny; ściśle
związana z Oceną jest dopiero trasa `report-builder.routes.ts:4057` i tej nie ruszam.
Pola `lifecycle`/`updatedAt` celowo pominięte — silnik drukuje przy nich zaszyte po angielsku
etykiety „Lifecycle:"/„Updated:"; ta sama treść idzie po polsku w markdownie.

## KROK 4 — `execReportsIntelligence` (pomiar, bez włączania)
| Komponent | Źródło danych | Czy dubluje MVP | Werdykt |
| --- | --- | --- | --- |
| `WorkIntelligenceReport` (535 l.) | runtime-v1 `execution-cases`/`work`/`milestones` = **0 rekordów** | tematycznie ≈ „Karta realizacji" | **nie użyto jako silnika** — musiałby najpierw dostać realne dane (R1) |
| `ControlLoopReport` (238 l.) | `management-signals` / `interventions` = **0** | „Pętla sterowania" — poziom PMO, poza czwórką MVP | zostaje za flagą |
| `ResourcesCapacityReport` (303 l.) | `operational-allocations` = 0 + brak podaży godzin | ≈ `capacity-utilization` (Fala 2) | zostaje za flagą |
| `UnifiedExecutionReportGenerator` (371 l.) | składa trzy powyższe | — | zostaje za flagą |
**Decyzja:** twardy `return false` ZOSTAJE, z zapisanym w kodzie powodem i warunkiem zdjęcia
(`executionFeatureFlags.ts`). Włączenie domyślne pokazałoby cztery PUSTE raporty, których nikt
nie oglądał — to dokładnie kształt, przed którym stoi reguła #7 z CLAUDE.md.
Dodatkowo (zrzut `05-menu3-chipy-flaga-on.png`): wejście do nich to 12. chip w Menu 3, które na
zakładce „Praca" ma już 11 presetów (kanon: ≤3) — przy 1440 px chip wypada poza ekran.

## Dane pokazowe (do świadomego zostawienia albo usunięcia)
Cztery migawki utworzone przez ten przebieg w tabeli `execution_report_snapshots`, org DBR77:

| Definicja | ID | Status |
| --- | --- | --- |
| `initiative-card` | `a669082d-5ea5-4330-8711-ff6029a94570` | Szkic |
| `weekly-exec` | `9a8c0183-1f3f-4aa6-87a6-251db300b56a` | Szkic |
| `program-health` | `be8d6f0a-8fda-4e6c-9229-66f37fb46540` | **Opublikowany** |
| `sponsor-onepager` | `43a15f4d-663b-4030-b121-2c5b4aec2ee7` | Szkic |

Usunięcie: `DELETE FROM execution_report_snapshots WHERE id IN (…)`. Rekordów testowych poza tą
czwórką nie zostawiam (wszystkie próbne przebiegi skasowane, licznik sprawdzony = 0 przed
ostatnim przebiegiem).

## Pliki wyjściowe (obejrzane, nie tylko wygenerowane)
| Plik | Rozmiar | Strony / treść |
| --- | --- | --- |
| `zdrowie-programu.pdf` | 33,8 kB | **2 strony**, PL; s.1 RAG per inicjatywa (23 wiersze) + alerty; s.2 pewność dowiezienia, narracja, 15 decyzji |
| `sponsor-1-strona.pdf` | 31,1 kB | **1 strona**, PL; postęp, TOP 3 ryzyka, 5 kamieni, 6 decyzji, 5 osiągnięć |
| `tygodniowy-pakiet.docx` | 10,7 kB | OOXML (zip), PL; nagłówek „Status/Poziom raportu/Okres/Stan danych na/Ocena RAG" + 5 sekcji z tabelami |

## Zrzuty (1440, light, realna trasa `/execution?tab=reports`)
Wszystkie: `url` = `http://localhost:3101/execution?tab=reports&view=table` (nie `/login`),
`bledyKonsoli` = **0** (sidecary `*.png.json` w tym katalogu).

## Testy
- `evidence/1-12-r4/testy-baza.txt` — PRZED: 11 czerwonych / 91 zielonych (102), 3 pliki czerwone.
- `evidence/1-12-r4/testy-po.txt` — PO: 11 czerwonych / 99 zielonych (110), **te same 3 pliki i te
  same 11 nazw**; +8 zielonych to nowy `executionReportModel.test.ts`.
- Nowe: `src/components/Execution/__tests__/executionReportModel.test.ts` (8) i
  `server/src/routes/__tests__/executionReports.export.test.ts` (5).
