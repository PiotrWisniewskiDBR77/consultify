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
