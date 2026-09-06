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
