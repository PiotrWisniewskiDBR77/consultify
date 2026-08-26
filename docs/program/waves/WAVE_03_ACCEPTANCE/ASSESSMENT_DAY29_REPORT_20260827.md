# Assessment dzień 29 (blok 3 — serwerowy) — raport 2026-08-27

Historia: commit `a0266ea2c4` dokumentował poprawny STOP wadliwie związanego markera; po korekcie nadzorcy dyżur wznowiono.

## Granice i start

- Marker `2f6040273f`: `MARKER OK`; `DAY25 MERGED`; `DAY27 NOT MERGED` i bez `server/**`.
- Dzień 28 zmienia Meetings i nie koliduje z tym zakresem.
- Zero push/Railway; zero zapisów w `src/`, `dev-render/`, `public/`.
- Jedyny kontakt z chronionym checkoutem to symlink `node_modules` do odczytu.
- Stan: partner AI 1439 linii i `@ts-nocheck`; AI: 26 tras, 11 wywołań DB; workflow v1: 27 handlerów; osierocony router: 497 linii/11 handlerów; allowlista Assessment: 0.

PG `cx-day29-pg`, `pgvector/pgvector:pg16`, `5512→5432`, baza `cx_day29`.
Migracje `854 / 0 / pending 0`; wymagane kolumny istnieją; namespace
`20261180-89` pusty; nowych migracji brak.

Baseline: batch6 `18/18`, batch7 `3/3`, allowlista `201/201`, AI integration
`5/5`, unit Assessment `550/550`, services Assessment `53/53`, routes Assessment
`4/4`. Zastane czerwone: integration Assessment `35/43`, całe route tests
`987 PASS / 173 FAIL / 53 SKIPPED`, DRD front `40/46`. Wskazany katalog
`methodCore/__tests__` nie istnieje.

## Pozycje

| Pozycja | Commit                     | Status                 | Dowód                                                                            |
| ------- | -------------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| D       | `659c9f8d1a`               | `ZROBIONE_WG_DoD`      | nowe PG 5/5; razem z dniami 20/25: 33/33                                         |
| C.2     | `d874e1e663`               | `ZROBIONE_WG_DoD`      | osierocony plik usunięty; batch7 na żywym hubie 3/3                              |
| B       | `f22abfbc5b`, `c782a1b3af` | `CZĘŚCIOWO`            | 11 mapowań 404/503; day25 4/4; brak nowego minimum 7 testów i dowodu mutacyjnego |
| C.1     | —                          | `NIE_WYKONANO`         | sześć handlerów v1 pozostało; batch6 18/18                                       |
| A       | —                          | `STOP / NIE ZMIENIONO` | A.1 = 135/203; `@ts-nocheck` pozostał                                            |
| R.1     | —                          | `NIE_WYKONANO`         | brak podstaw do aktualizacji przy niepełnym dyżurze                              |

## D — nazwa sesji

Dodano top-level `sessionLabel: { displayName, source, projectId }`. Nazwa jest
czytana przez `SELECT name FROM projects WHERE id = ? AND organization_id = ?`.
Brak projektu daje trzy `null`; wiszące i obce `project_id` zachowują id bez
nazwy. `contractVersion` pozostaje `assessment-report-contract-v1`; rozdziałów
pozostaje 7.

Osiągalność: `GET /api/method/sessions/:id/assessment-report-contract` → montaż
`/api/method` → `method-core.routes.ts` → serwis kontraktu → org-scoped
`method_sessions` i `projects` → koperta HTTP. Konsument ekranu jest w
niescalonej gałęzi dnia 27; na markerze ostatnim ogniwem jest koperta HTTP.

## C.2 — router osierocony

`Gateway.ts` importuje żywy `assessment.routes.ts` bez końcowego „s”; nie
importował usuniętego `assessments.routes.ts`. Test fail-soft `my-assessments`
przepięto na zamontowany `assessment-hub.routes.ts`; stabilny kod odpowiada
żywemu handlerowi, a asercje braku ujawnienia sekretu pozostały.

## B — zakres częściowy

Brak lub obcy rekord daje identyczne `404 / ASSESSMENT_NOT_FOUND`; awaria źródła
jest mapowana na `503 / ASSESSMENT_SOURCE_UNAVAILABLE` bez treści wyjątku.
Charakteryzacja dnia 25 montuje `verifyToken → trialEntryGuard`, seeduje realny
obcy rekord i przechodzi 4/4. Piętnaście handlerów bez DB pozostało nietkniętych.
Brak nowego pakietu 7 testów na ≥3 trasach i dowodu mutacyjnego oznacza uczciwe
`CZĘŚCIOWO`, nie pełny DoD.

## STOP — A.2

Typowania nie rozpoczęto; nie przedstawiam samego pomiaru jako naprawy. A.1:
domyślna konfiguracja `135` (`TS2339×92`, `TS1259×42`, `TS2724×1`); konfiguracja
projektu `203` (`TS2339×81`, `TS7006×68`, `TS7053×29`, `TS18046×20`,
`TS18047×3`, `TS7034×1`, `TS7005×1`). Plik pozostaje z `@ts-nocheck`.

## Kontrole końcowe

Punktowe `esbuild`: PASS. Pakiet końcowy batch6 + batch7 + allowlista:
`222/222`; realny PG dla day20/day25/D: `37/37`. Pełny §0.4a nie został
powtórzony po HEAD, więc deklaruję `ZASIĘG CZĘŚCIOWY`.

Kontener usunięto przez `docker rm -fv cx-day29-pg`. Zgodnie z nowszą twardą
dyspozycją użytkownika nie wykonano `docker volume prune`.
