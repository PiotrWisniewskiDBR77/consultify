# Assessment dzień 27 (front raportu + skip-code) — raport dyżuru 2026-08-26

## Oświadczenia bezpieczeństwa

- Chroniony checkout `/Users/piotrwisniewski/Developer/Consultify` nie był czytany ani zmieniany; jedyny kontakt to dozwolony symlink `node_modules` (odczyt).
- `git diff --name-only codex/m03-admin-20260824...HEAD -- server/` → **PUSTO**.
- `git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx src/components/method-workspace/MethodWorkspaceShell.tsx src/components/standard src/components/shared` → **PUSTO**.
- Siedem zastanych plików `AssessmentReportView/Document/reportApi/types/drdLabels/maturityBands/index` → **PUSTY DIFF**.
- Zero bazy, kontenera, migracji, Railway, LLM, pushu i zmiany wartości domyślnych flag.

## Marker i stan wejściowy

Marker `6d3cebe779`: **POTWIERDZONY** (`git merge-base --is-ancestor ...` → 0). Tip `codex/m03-admin-20260824` uciekł naprzód; zgodnie z DEC-95 nie wykonano rebase. `git fetch --all --prune` częściowo: `origin` i `github-backup` pobrane, nieaktywny remote `icloud-source` zwrócił `not a git repository`.

Warunki: kontrakt i obie trasy istnieją; grep konsumenta przed pracą pusty; słownik ma 47 linii; wzorce 1359/342 linii; harnessy 86/721/766; katalog raportu 7 plików/1185 linii i zero importera produkcyjnego. Korekty: serwis kontraktu ma 168, nie 156 linii, trasa jest przy 533, ledger 189 linii; to późniejsze zmiany tipa, bez STOP.

Skill `consultify-artefakty` wymagany instrukcją nie był dostępny w sesji. Zastosowano bezpośrednio SPEC-A z instrukcji i `ARTIFACT_ANATOMY_STANDARD.md`.

## Pozycje

| Poz. | Status          | Commit       | Dowód                                                                          |
| ---- | --------------- | ------------ | ------------------------------------------------------------------------------ |
| A.1  | ZROBIONE_WG_DoD | `02b36a1460` | OFF → `null`, 0 wywołań klienta; test 4/4                                      |
| A.2  | CZĘŚCIOWE       | `df2f244b9e` | DTO + GET + walidacja wersji; brak osobnych testów klienta                     |
| A.3  | CZĘŚCIOWE       | `8fb39e4ba1` | 7 sekcji, SPEC-A, 4 stany, sloty; powłoka wymusza zastany wskaźnik „Zapisano”  |
| A.4  | CZĘŚCIOWE       | `8fb39e4ba1` | całość/część/brak renderowane; brak dedykowanych 3 testów wariantów            |
| B.1  | CZĘŚCIOWE       | `8fb39e4ba1` | lazy mount ON i bitowo zastana treść OFF; brak osobnego testu ON/OFF warsztatu |
| C.1  | CZĘŚCIOWE       | `877f113c1e` | kolejność i retry w kodzie; brak wymaganych 6 testów interakcji                |
| D.1  | ZROBIONE_WG_DoD | `2f41338b60` | realny komponent + GET/POST fake routes + 4 scenariusze                        |
| D.2  | ZROBIONE_WG_DoD | `fa4fd3ba3c` | 10 zrzutów light/dark obejrzanych                                              |
| E.1  | CZĘŚCIOWE       | `7a6ff41c15` | 4/4 nowe testy; brak pełnej macierzy C.1                                       |
| E.2  | ZROBIONE_WG_DoD | ten raport   | tabela poniżej                                                                 |
| R.1  | ZROBIONE_WG_DoD | ten raport   | jeden dokument raportowy                                                       |

## Osiągalność i FAIL-CLOSED

`viewMode=report` → `DrdHttpMethodWorkspaceScreen.tsx:1137` → flaga `:967` → lazy komponent `:88-91/:1147` → `AssessmentReportContractView.tsx:236` → klient `:250` → `methodCoreApi.ts:230` → serwerowa trasa 533. OFF wraca `null` przed efektem (`AssessmentReportContractView.tsx:241,264`) i test potwierdza zero żądań.

## Ekran i parytet kontraktu

Źródłem nazw obszarów jest `matrix.areas` z tego samego DTO. Front nie liczy gap/średnich/procentów. `null` pozostaje uczciwym „nie oceniono”.

| Pole DTO                                                                   | Renderowanie / decyzja                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| contractVersion, sessionId, outputId, revision, generatedAt, methodVersion | Właściwości i nagłówek (`AssessmentReportContractView.tsx:309-336`) |
| chapters                                                                   | 7 sekcji w kolejności odpowiedzi (`:277-287`)                       |
| axisId                                                                     | stabilne id sekcji i `data-axis-id`                                 |
| axisName, axisNamePL                                                       | PL z fallbackiem EN; EN używane dla etykiety EN                     |
| maxLevel                                                                   | mianownik częściowych pominięć                                      |
| introduction.content/minWords/maxWords                                     | content `null` jako pusty slot; limity z DTO                        |
| matrix.caption.content/minWords/maxWords                                   | pusty slot pod macierzą; limity z DTO                               |
| matrix.areas                                                               | dokumentowa macierz                                                 |
| area.unitId/unitName/unitNamePL                                            | pierwsza kolumna i join komentarza                                  |
| currentLevel/targetLevel/gap                                               | kolumny; `null` → „— (nie oceniono)”                                |
| evidenceState                                                              | polska etykieta, bez enumu                                          |
| skipped/skips                                                              | całość/część/brak oraz lista per pytanie                            |
| skipCode                                                                   | świadomie nierenderowany drugi raz; `skips[]` jest SSOT             |
| areaComments.unitId                                                        | join do nazwy obszaru                                               |
| content/minWords/maxWords                                                  | uczciwy pusty komentarz i limit                                     |
| microstructure                                                             | 5 polskich etykiet w kolejności DTO                                 |
| uncertainty                                                                | polska etykieta                                                     |
| answerRefs/evidenceRefs/sourceLocators                                     | tylko policzalne liczby, gdy niepuste; bez surowych id              |
| conclusion.content/minWords/maxWords                                       | pusty slot z limitem                                                |
| decisionLine.direction/priority/horizon/successCondition                   | 4 nazwane, uczciwie puste pola                                      |

Oczekiwanie wobec serwera: brak dodatkowych pól wymaganych do obecnego ekranu. Ewentualna nazwa sesji/klienta poprawiłaby breadcrumb, ale nie została wyliczona ani dopisana do serwera (`BRAK_W_KONTRAKCIE`).

## Skip-code C.1

Najpierw `runtime.recordAnswer`, potem POST (`DrdHttpMethodWorkspaceScreen.tsx:727-755`). Klucz `skip-code:<sessionId>:<unitId>:<questionId>:<level>:<uuid>` powstaje raz i jest reużywany. Własny retry maks. 1; `fetchWithRetry` daje 1 retry wewnętrzny, więc najgorszy przypadek to 4 żądania HTTP (2 wywołania klienta × do 2 prób transportu). 4xx bez retry; offline/5xx z retry. Body zawiera wyłącznie `unitId/questionId/level/skipCode`, bez `organizationId`. Porażka pozostawia widoczny banner i nie cofa odpowiedzi. `200` i `201` przechodzą przez `res.ok` identycznie.

## Zrzuty i własne oględziny

10 plików w `evidence/assessment-report-front-20260826/`: OFF, pełny, sloty, pominięcia, panel — LIGHT/DARK. Dla finalnych przebiegów `shot.mjs`: `OK`, bez `KONSOLA-BLEDY` i bez `SIEC-4XX5XX` (narzędzie wypisuje sekcje tylko gdy niepuste).

Własne defekty znalezione i naprawione:

1. Pre-commit: surowa tabela bez jawnego wyjątku dokumentowej macierzy → dodano `§27-exempt`.
2. Zrzut OFF: crash przy `state.session` przed bootstrapem → `state?.session`; ponowne 14/14 i czyste zrzuty OFF.
3. Zrzut pominięć pokazywał oś 1, bo harness ignorował `axis=7` → harness wybiera realny przycisk osi; ponowny zrzut pokazuje 7A częściowo i 7B w całości.
4. Wyłączone „Generuj” wyglądało dwuznacznie → etykieta jawnie zawiera „Planowane”.

### STOP — A.3: wskaźnik zapisu powłoki

Powód: `NModeHeader` pokazuje zastane „Zapisano” mimo widoku read-only; ukrycie wymagałoby zmiany `src/components/shared/**`, zakazanej Z19. Nie zmieniono standardu. Stan: komponent zacommitowany częściowo w `8fb39e4ba1`.

## Testy Z23 — ZASIĘG PEŁNY

Baseline → HEAD:

| Zakres                      | Baseline              | HEAD                  | Wprowadzone czerwone |
| --------------------------- | --------------------- | --------------------- | -------------------- |
| assessment/report           | 17 PASS               | 21 PASS               | 0                    |
| assessment/drd              | 40 PASS / 6 FAIL      | 40 PASS / 6 FAIL      | 0                    |
| method-core DRD             | 63 PASS               | 63 PASS               | 0                    |
| method-core                 | 89 PASS / 158 SKIPPED | 89 PASS / 158 SKIPPED | 0                    |
| tests/components/assessment | 266 PASS / 8 FAIL     | 266 PASS / 8 FAIL     | 0                    |
| method-workspace            | 57 PASS               | 57 PASS               | 0                    |
| unit/assessment             | 550 PASS              | 550 PASS              | 0                    |
| drdStructure                | 47 PASS               | 47 PASS               | 0                    |
| AuditReportDocumentView     | 6 PASS                | 6 PASS                | 0                    |
| standard                    | 5 PASS                | 5 PASS                | 0                    |
| i18n                        | 18 PASS / 10 FAIL     | 18 PASS / 10 FAIL     | 0                    |

Zastane czerwone: DRD offline/banner (6), Outputs (8), globalne i18n (10). Testów nie osłabiono i bloków `describe` nie usunięto.

## Znaleziska i granice

- Dwa ekrany raportu Assessmentu: outputowy `AssessmentReportView` i nowy kontraktowy `AssessmentReportContractView`; rozstrzygnięcie docelowego bytu należy do nadzorcy.
- Porty dev-render: config 3020, shot header 3350, dyżur użył 3362.
- Nieaktualny komentarz „34 areas total”; faktycznie 39.
- Martwy `NModeHeaderConfig.secondaryActions` oraz brak możliwości ukrycia save-state bez zmiany standardu.
- Brak skryptu npm dla dev-render/esbuild-per-file; globalny rozjazd i18n poza gałęzią.
- `ff_assessmentReportView`: default OFF, nie włączona na demo. Eksport PDF/wszystko i generowanie: wyszarzone „Planowane”.

## Licznik i gotowość

11 pozycji: 4 `ZROBIONE_WG_DoD`, 7 `CZĘŚCIOWE`, 0 niezaczętych. Żadne migracje. Gotowe do odbioru przez **NADZORCĘ**, nie do pokazania właścicielowi.

Raport R.1 domknięty po finalnym pomiarze, bramkach chronionych ścieżek i własnych oględzinach wszystkich dziesięciu zrzutów.
