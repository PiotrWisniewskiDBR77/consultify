# Rejestr G15 — samokontrola integratora — 2026-09-03

Marker bazowy: `f65c4ff6a0`. Marker dyżuru: `35afcb15fd`. Dyżur: 286.

## R1 — mapa modułów i mianownik plików testowych

| Moduł | Katalogi testów przypisane do modułu | Plików na markerze |
| --- | --- | ---: |
| 01_ORGANIZATION | `src/components/Organization/__tests__`; `tests/unit/organization`; `server/src/services/organizationContext/__tests__` | 11 |
| 02_INTERVIEW | `src/components/Interview/__tests__`; `server/src/services/interview/__tests__`; `server/src/services/interviewCandidate/__tests__`; `server/src/routes/interviewDelivery/__tests__` | 26 |
| 03_TOOLS | `src/components/Discovery/__tests__`; `src/components/DiscoveryTools/__tests__`; `tests/unit/discovery`; `server/src/services/tools/__tests__`; `server/src/services/toolCatalog/__tests__`; `server/src/services/toolFreeze/__tests__` | 41 |
| 04_ASSESSMENT | `src/components/assessment/**/__tests__`; `src/components/method-workspace/__tests__`; `tests/unit/assessment`; `server/src/routes/assessment*/__tests__`; `server/src/services/assessment*/__tests__` | 33 |
| 05_INITIATIVES | `src/components/Initiatives/__tests__`; `tests/unit/initiative`; `tests/unit/initiatives`; `server/src/services/initiative/__tests__` | 75 |
| 06_EXECUTION | `src/components/Execution/__tests__`; `tests/unit/execution`; `tests/unit/initiatives-execution`; `server/src/domain/initiatives-execution/__tests__`; `server/src/services/execution*/__tests__` | 114 |
| 07_MY_WORK_AGENT | `src/components/MyWork/__tests__`; `tests/unit/mywork`; `tests/unit/myWorkTable`; `tests/unit/decision`; `server/src/routes/my-work/__tests__`; `server/src/services/myWork/__tests__` | 100 |
| 08_MEETINGS | `src/components/Meeting/__tests__`; `tests/unit/meeting`; `server/src/services/meeting*/__tests__` | 12 |
| 09_RESULTS | `src/components/Results*/__tests__`; `tests/unit/results`; `server/src/routes/resultsVnext/__tests__`; `server/src/services/results*/**/__tests__` | 67 |
| 10_FINANCE | `src/components/Economics/__tests__`; `tests/unit/finance`; `server/src/routes/v8/finance-v2/__tests__`; `server/src/services/finance/__tests__` | 107 |
| 11_MATERIALS | `src/components/{ReportsAndPresentations,Presentations,PresentationStudio,DocumentStudio}/__tests__`; `tests/unit/{presentations,documentStudio}`; `server/src/services/{materials,materialExport,presentationExport}/__tests__` | 27 |
| 12_AUDITS | `src/components/Audit/__tests__`; `server/src/routes/audits/__tests__`; `server/src/services/audits/__tests__`; `server/src/services/auditProgram*/__tests__` | 41 |
| 13_CHAT | `src/components/AIChat/__tests__`; `tests/unit/AIChat`; `tests/unit/chat`; `server/src/services/{chatHandoff,chatToSchema}/__tests__` | 51 |
| 14_ADMIN | `src/components/Admin/__tests__`; `tests/unit/superadmin`; `server/src/services/invitation/__tests__` | 39 |
| 15_SETTINGS | `src/components/settings/__tests__`; `tests/unit/settings` | 7 |
| 16_PARTNER | `src/views/partner/__tests__`; `tests/components/partner`; pliki partnerowe w `tests/unit/backend`, `tests/unit/services`, `server/src/routes/v8/__tests__`, `server/src/services/__tests__` | 50 |

Liczby są wynikiem lokalnego `find`/`rg` na `35afcb15fd`; nie są liczbami przepisanymi z instrukcji. Wiersz Partner używa nazw plików, ponieważ repo nie ma katalogu `src/components/Partner/__tests__` ani `tests/unit/partner`.

## R1 — współdzielone pliki produktu zmienione od bazy

- `src/components/shared/ExecutiveModuleShell/RightRail.tsx`
- `src/components/shared/NModeLayout/NModeLeftNav.tsx`
- `src/components/shared/NModeSections/CommentsCanvas.tsx`
- `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`
- `src/components/shared/PreviewPane/PreviewActivityStrip.tsx`
- `src/components/shared/states/EmptyState.tsx`
- `src/components/standard/EvidencePanelSection.tsx`
- `src/components/ui/ResizableTable/ColumnResizer.tsx`

`src/index.css` oraz `public/locales/**` są w mianowniku R1/R6 osobno; pełna lista lokalizacyjna jest zachowana w artefaktach dyżuru.

## Wyniki per plik

| Moduł | Plik | Testów | Baza `f65c4ff6a0` | Marker przed naprawą | Klasyfikacja | Commit naprawy | Wynik po |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 01_ORGANIZATION | `tests/unit/organization/organizationProfileLocale.contract.test.ts` | 2 | 2 PASS | 2 PASS | bez zmiany | — | 2 PASS |
| 01_ORGANIZATION | `src/components/Organization/__tests__/OrganizationSidebar.ownerFeedback.test.tsx` | 2 | 2 PASS | 2 PASS | bez zmiany | — | 2 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/day132.documentConfidentiality.pg.test.ts` | 2 | 1 PASS, 1 FAIL | 2 PASS | NAPRAWIONA DZIŚ | — | 2 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/day205.organizationContextStoreSupersede.pg.test.ts` | 1 | 1 PASS | 1 PASS | bez zmiany | — | 1 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/day205.organizationContextStoreWisdom.pg.test.ts` | 2 | brak wykonanych przypadków | 2 PASS | ZMIANA ZAKRESU | — | 2 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/knowledgeDocsFileHashMigration15.realdb.test.ts` | 0 | 0 | 0 | plik bez wykonanych przypadków | — | 0 |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/orgBvpMountedGoldenPath.pg.test.ts` | 4 | 4 PASS | 4 PASS | bez zmiany | — | 4 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/orgContextGovernedSnapshot.pg.test.ts` | 0 | 0 | 0 | plik bez wykonanych przypadków | — | 0 |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/orgContextUploadIdempotencyMigration16.realdb.test.ts` | 0 | 0 | 0 | plik bez wykonanych przypadków | — | 0 |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/orgOpsWorkerMounted.pg.test.ts` | 5 | 5 PASS | 5 PASS | bez zmiany | — | 5 PASS |
| 01_ORGANIZATION | `server/src/services/organizationContext/__tests__/orgPinnedConsumersMounted.pg.test.ts` | 4 | 4 PASS | 4 PASS | bez zmiany | — | 4 PASS |
| 02_INTERVIEW | `src/components/Interview/__tests__` (16 plików; szczegóły w `m02-*-front.json`) | 84 | 55 PASS, 4 FAIL (59 przypadków) | 80 PASS, 4 FAIL | 4 ZASTANE; 25 przypadków dodanych | — | 80 PASS, 4 FAIL |
| 02_INTERVIEW | `server/src/{services/interview,services/interviewCandidate,routes/interviewDelivery}/__tests__` (10 plików; szczegóły w `m02-*-server.json`) | 63 | 43 PASS, 4 FAIL, 16 pending | 44 PASS, 3 FAIL, 16 pending | 3 ZASTANE; 1 NAPRAWIONA DZIŚ | — | 44 PASS, 3 FAIL, 16 pending |
| 03_TOOLS | front: `Discovery`, `DiscoveryTools`, `tests/unit/discovery` (36 plików; `m03-*.json`) | 621 | 620 PASS, 1 FAIL | 620 PASS, 1 FAIL | 1 ZASTANA | — | 620 PASS, 1 FAIL |
| 04_ASSESSMENT | front: `assessment`, `method-workspace`, `tests/unit/assessment` (17 plików; `m04-*.json`) | 620 | 608 PASS | 619 PASS, 1 FAIL | 1 NOWA — nieaktualna dokładna treść stanu pustego | ten commit | 620 PASS |
| 05_INITIATIVES | front: `Initiatives`, `tests/unit/initiative`, `tests/unit/initiatives` (61 plików; `m05-*.json`) | 868 | 812 PASS, 7 FAIL, 8 pending | 840 PASS, 19 FAIL, 8 pending | 6 ZASTANYCH; 13 NOWYCH; 1 NAPRAWIONA DZIŚ | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| 06_EXECUTION | front: `Execution`, `tests/unit/execution`, `tests/unit/initiatives-execution` (102 pliki; `m06-*.json`) | 440 | 404 PASS | 426 PASS, 14 FAIL | 14 NOWYCH | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| 07_MY_WORK_AGENT | front: `MyWork`, `tests/unit/mywork`, `myWorkTable`, `decision` (93 pliki; `m07-*.json`) | 566 | 542 PASS, 2 FAIL, 9 pending | 554 PASS, 3 FAIL, 9 pending | 2 ZASTANE; 1 NOWA | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| 08_MEETINGS | front: `Meeting`, `tests/unit/meeting` (6 plików; `m08-*.json`) | 35 | 2 PASS | 32 PASS, 3 FAIL | 3 NOWE; 33 nowe przypadki zakresu | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| 09_RESULTS | front: `Results`, `ResultsVNext`, `tests/unit/results` (30 plików; `m09-*.json`) | 418 | 408 PASS | 418 PASS | 10 przypadków dodanych; brak czerwieni | — | 418 PASS |
| 10_FINANCE | front: `Economics`, `tests/unit/finance` (79 plików; `m10-*.json`) | 924 | 850 PASS, 1 FAIL | 923 PASS, 1 FAIL | ZMIANA ZAKRESU: 1 stary FAIL zniknął, 1 nowy FAIL dodany | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| 11_MATERIALS | front: 4 katalogi komponentów + `tests/unit/presentations`, `documentStudio` (20 plików; `m11-*.json`) | 184 | 177 PASS, 2 FAIL | 182 PASS, 2 FAIL | 2 ZASTANE; 5 przypadków dodanych | — | 182 PASS, 2 FAIL |
| 12_AUDITS | front: `src/components/Audit/__tests__` (3 pliki; `m12-*.json`) | 17 | 4 PASS | 17 PASS | 13 przypadków dodanych; brak czerwieni | — | 17 PASS |
| 13_CHAT | front: `AIChat`, `tests/unit/AIChat`, `tests/unit/chat` (45 plików; `m13-*.json`) | 439 | 416 PASS | 439 PASS | 23 przypadki dodane; brak czerwieni | — | 439 PASS |
| 14_ADMIN | front: `Admin`, `tests/unit/superadmin` (38 plików; `m14-*.json`) | 248 | 235 PASS, 7 FAIL | 241 PASS, 7 FAIL | 7 ZASTANYCH; 6 przypadków dodanych | — | 241 PASS, 7 FAIL |
| 15_SETTINGS | `settings`, `tests/unit/settings` (7 plików; `m15-*.json`) | 13 | 13 PASS | 13 PASS | bez zmiany | — | 13 PASS |
| 16_PARTNER | `src/views/partner`, `tests/components/partner` i wskazane unit (42 uruchomione pliki; `m16-*.json`) | 195 | 112 PASS | 186 PASS, 9 FAIL | 9 NOWYCH; 83 przypadki dodane | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| WSPÓLNE | `standard`, `shared`, `ui`, `tests/unit/shared*` (12 plików; `r6-shared-*.json`) | 204 | 166 PASS, 2 FAIL | 200 PASS, 4 FAIL | 2 ZASTANE; 2 NOWE (`Relations`) | nierozstrzygnięte — brak tabeli licencji | bez ponownego przebiegu produktu |
| R6_SERVER | `aiSettingsFallback.test.ts`; `help.routes.test.ts` | 9 | 9 PASS | 9 PASS | bez zmiany | — | 9 PASS |
