# S4 F2-2 Praca — Wpis 47 v3 author closure

**Werdykt: READY_FOR_EXACT_SHA_INDEPENDENT_REVIEW — wszystkie 10 rzutowań `as any` dodanych przez deltę `ExecutionHub` usunięto typowo poprawnie, a pełne 171/171 rodzeństwa nie wykazało nowej czerwieni względem `eba9d72ad9c730728b212ee7826164519e4d095c`.** Brak migracji, deployu i pushu na gałąź chronioną.

## Dziesięć rzutowań z delty

1. `stats` → `isBlockedInitiative(initiative)`.
2. `matchesAttentionPreset` → `isBlockedInitiative(initiative)`.
3. Projekcja banku → `initiative.projectId`.
4. Projekcja banku → `initiative.priority`.
5. Nazwa projektu → `initiative.projectName`.
6. Nazwa projektu z relacji → `initiative.project?.name`.
7. Przypadek wykonawczy → `executionCase.projectId`.
8. Przypadek wykonawczy → `executionCase.projectTitle`.
9. `actionCenter` → `isBlockedInitiative(i)`.
10. Kafel terminowości → `onTimeFromInitiatives(dashboardBaseInitiatives)`.

`FullInitiative` otrzymał jawne opcjonalne pola `projectName` i `project`; `ExecutionBankCaseSource` otrzymał jawne opcjonalne `projectId` i `projectTitle`; `RealInitiativeLike` jawnie opisuje `onHold`/`on_hold` i nie wymaga index signature. Detektor dodatnich linii `as any` w diffie `eba..candidate`: 0. Asercji testów źródłowych nie zmieniono.

## Dowód zachowania i porównanie z bazą

- `ExecutionHub.daneRealne.source`: baza 12/12, kandydat 12/12.
- `ExecutionHub.kokpitRaidOblozenie.source`: baza 8/8, kandydat 8/8.
- Exact delta rozszerzona o dwa source-block tests i `executionRealData`: 18 plików, 167/167 PASS, 0 FAIL, 0 SKIP, każdy osobno `--retry=0`.
- Identity pozostaje: wspólny `buildExecutionBankRows` domyślnie `LEGACY`; `ExecutionHub` jawnie wybiera `INITIATIVE` tylko dla aktywnej powierzchni czterech przycisków. Kontrakty Q2 po rebase pozostają zachowane.

## Pełne rodzeństwo importerów

- 171/171 plików uruchomiono osobno na kandydacie i na bazie `eba`.
- Kandydat FE, 121 plików: 517 PASS, 49 FAIL, 5 SKIP; 28 nonzero. Wszystkie odziedziczone: 27 pozycji pomiaru v2 oraz znany order-dependent `InitiativeConsultingAnalysisView.behavior` 1/12, również 1/12 na bazie.
- Kandydat DB, 50 plików: 58 PASS, 31 FAIL, 58 SKIP; 9 nonzero. Wszystkie odziedziczone lub lepsze od bazy; 0 candidate-new/worse.
- Klasyfikacja wszystkich 171: 124 unchanged green/skip, 36 inherited nonzero identical, 1 inherited nonzero improved, 4 expanded green, 4 additive green, 2 candidate fixes base red, 0 candidate-new/worse red.
- Szczegół każdy plik → `W47_SIBLING_171_CLASSIFICATION.md`.

## PostgreSQL i bramki

- Każdy `*.pg.test.ts` uruchomiono z `MOCK_DB=false`, `RUN_DB_TESTS=1` i lokalnym PG18 `cx-s4-w43-pg` na `127.0.0.1:5290/consultify_s4_w43`.
- Rodzeństwo PG: 11/11 collected PASS, 0 SKIP (`executionWorkAnalysis` 3, `portfolioConsultingAnalysisRuntime` 3, native baseline 5). Delta-only `initiativesExecutionRuntime.dropdown.pg`: 2/2 PASS, 0 SKIP. Łącznie PG: 13/13 PASS, 0 SKIP.
- Front TypeScript heap8: baza 189, kandydat 177, delta -12; brak diagnostyk w zmienionych typach S4. Server TypeScript heap8: exit 0.
- Build produkcyjny heap8, bez pipe: exit 0, 10 747 modułów, 35.13 s.
- Canon 349/349; artefakt 8-0-117; język 3250 bez wzrostu; duplicate i18n EN 0 / PL 0; `git diff --check` PASS; prawdziwe markery konfliktu 0 w 76 ścieżkach delty.

## Dowód UI

Zmiana v3 dotyczy wyłącznie typów i usunięcia rzutowań kompilatora, więc nie zmienia renderu. Zachowano osiem pełnych zrzutów `ExecutionHub`, `ready/empty × en/pl × light/dark`; SHA-256 i rozmiary 8/8 pozostają zgodne z poprzednim manifestem. Osiem PNG ma łącznie 710 839 B. Populated nadal dowodzi 3/3/6 zdarzeń i kolumny Project; empty pozostaje kanoniczny.
