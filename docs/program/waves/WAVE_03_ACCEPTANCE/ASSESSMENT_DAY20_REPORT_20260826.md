# Assessment dzień 20 (mechanika tylna) — raport dyżuru 2026-08-26

Baza związania: `codex/m03-admin-20260824` @ `649bd730a6`; aktualny tip po rozejściu: `7760f6fb12`.
Marker: `649bd730a6` — POTWIERDZONY (`git merge-base --is-ancestor`).
Gałąź: `codex/assessment-day20-20260826`.
Worktree: `/private/tmp/consultify-assessment-day20`.
Port PG: `5469` · kontener `cx-day20-pg` usunięty: NIE (dyżur trwa) · wolumeny usunięte: NIE (dyżur trwa).
Przedział migracji: `20261101`–`20261109` · użyte numery: brak na etapie Bloku 0.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie wykonywałem odczytów ani zapisów w chronionym checkoutcie. Jedyny kontakt to dozwolony symlink `node_modules` do odczytu: `/private/tmp/consultify-assessment-day20/node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules`.

## Oświadczenie o zakresie `src/`

Nie zmieniono żadnego pliku w `src/`. Dowód końcowy zostanie wklejony po ostatnim commicie.

## Dowód celu połączenia (Z19 / DEC-96 / DEC-98)

```text
 current_database | inet_server_port
------------------+------------------
 cx_day20         |
(1 row)
```

Puste `inet_server_port()` jest oczekiwane dla `psql` uruchomionego wewnątrz kontenera przez gniazdo Unix. Mapowanie hosta potwierdzone przez Docker: `5469:5432`; wszystkie polecenia DB miały jawne `DATABASE_URL=postgres://postgres:cx@localhost:5469/cx_day20` w tej samej linii.

## Warunki wstępne

| Warunek                         | Wynik                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Marker jest przodkiem tipa m03  | PASS — `MARKER OK`                                                                                                                  |
| Rozejście marker → tip          | 4 commity audytowe; lista plików obejmuje wyłącznie Audyty, locale, dev-render i `.claude/launch.json`; bez rebase zgodnie z DEC-95 |
| Dwa mounty workflow             | PASS — `Gateway.ts:639,641`                                                                                                         |
| Dwie kopie DRD                  | PASS — 7 osi; skale klient `7,5,5,7,6,6,5`, serwer `7,5,5,7,5,5,5`                                                                  |
| `target_level` w jądrze         | PASS — kontrakt, bridge i trwałość obecne                                                                                           |
| Barrel Assessment bez importera | POTWIERDZONE WSTĘPNIE; pełny dowód F.1 osobno                                                                                       |
| DEC-55                          | PASS — ledger linia 107 zawiera cztery literalne kody                                                                               |
| Materiały wiążące               | PASS — ledger 164 (oczekiwano 160), feedback 2002, module acceptance 134, prototyp i spec istnieją                                  |
| Numer migracji                  | `20261100` zajęte; `20261101` wolne                                                                                                 |
| Migracje lokalne przebieg 1     | PASS — 846 zastosowanych                                                                                                            |
| Migracje lokalne przebieg 2     | PASS — `Applying migrations: 0`                                                                                                     |
| Dry-run                         | PASS — `Pending migrations: 0`                                                                                                      |
| Pomiar wejściowy §0.4a          | W TOKU — pełny zakres, realny PG, `MOCK_DB=false`                                                                                   |

## Pozycje — tabela zbiorcza

| Pozycja | Status      | Commit               | Dowód osiągalności                                                                                | Dowód testowy                                                                  |
| ------- | ----------- | -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A.1     | CZĘŚCIOWO   | raportowy commit A.1 | `Gateway.ts:639,641` → deklaracje routerów; 31 v1 + 41 v2 znalezione                              | inwentarz statyczny; brak pełnego testu HTTP 72 tras                           |
| A.2     | STOP        | —                    | kanon v2 potwierdzony, ale bez pełnego A.1 nie usuwam kodu                                        | brak zmian produkcyjnych                                                       |
| A.3     | CZĘŚCIOWO   | raportowy commit A.1 | wywołania klienta zmierzone statycznie; reprezentatywne czerwone zastane w baseline               | pełny kontrakt odpowiedzi wymaga osobnego pomiaru real-router                  |
| B.1     | CZĘŚCIOWO   | commit B.1           | `Gateway` → raporty/Assessment → `drdVizAdapter` → `server/src/data/drdStructure.ts`              | 16/16 PASS; brak osobnego readbacku sesji na realnym PG obniża status          |
| B.2     | STOP        | —                    | serwis osiągalny przez `Gateway.ts` → `assessment-ai.routes.ts` → `aiAssessmentPartnerService.ts` | 92 błędy punktowego `tsc` po zdjęciu `@ts-nocheck`; plik przywrócony bez diffu |
| C.1     | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |
| D.1     | CZĘŚCIOWO   | commit D.1           | `Gateway.ts:958` → `/api/method` → skip routes → `AssessmentSkipReasonService` → lokalny PG       | 6/6 PASS real-router/PG; brak dowodu mutacyjnego T.3 obniża status             |
| D.2     | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |
| E.1     | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |
| E.2     | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |
| F.1     | STOP        | —                    | brak importera barrela potwierdzony, ale nie dowiedziono odpowiedników wszystkich 11 semantyk     | zero usunięć zgodnie z Z20                                                     |
| T       | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |
| R.1     | NIE_ZACZĘTE | —                    | —                                                                                                 | —                                                                              |

## A.1 — inwentarz osiągalności obu mountów

Pełna enumeracja kodu dała dokładnie 31 deklaracji metod v1 i 41 deklaracji metod v2. Kanon jest jawny: `/api/assessment-workflow-v2`; v1 pozostaje warstwą zgodności. Poniższa tabela grupuje wszystkie powierzchnie; status `CZĘŚCIOWO` wynika z braku 72 niezależnych pomiarów HTTP i dlatego żadnej trasy nie usunąłem na podstawie samego istnienia pliku.

| Mount | Metody + ścieżki (wszystkie deklaracje)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Żywi konsumenci potwierdzeni                                                                                                                            | Werdykt                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| v1    | `GET status`; `POST initialize`; `POST submit-for-review`; `POST approve`; `POST reject`; `GET/POST versions`; `GET versions/:from/diff/:to`; `GET history`; `POST restore/:version`; `GET pending-reviews`; `POST reviews/:id/start`; `POST reviews/:id/submit`; `GET activity-logs`; `POST log-activity`; `GET/POST comments`; `POST comments/:id/resolve`; `POST presence`; `POST presence/leave`; `GET/POST activities`; `GET my-role`; `GET/POST roles`; `DELETE roles/:userId`; `POST/GET access-requests`; `POST approve/reject access-request`; `DELETE access-request` | `WorkflowStatusBar`, modale review, `VersionHistoryPanel`, `ReviewFeedbackPanel`, `ActivityLogPanel`, `AxisCommentsPanel`, `useAssessmentCollaboration` | mount żywy; nie wolno usunąć całości |
| v2    | `GET/POST /`; `GET sessions`; `GET users`; `GET/PUT/DELETE assessment`; `GET/PUT user-state`; `GET/PUT assignments`; `POST duplicate`; `POST session open/close`; `POST request-review`; `POST report`; `POST report/approve`; `GET report/versions`; `POST approve`; `POST send-back`; `GET my-role`; `GET roles`; `GET eligibility`; `POST/GET access-requests`; approve/reject/cancel access-request; `POST/PUT/DELETE roles`; inicjatywy/runs/batches/gate-decisions/benchmark                                                                                              | `AssessmentHub`, `AssessmentManagePanel`, `InitiativesGenerationWizardModal`, `InitiativesManagementPanel`, `useAssessmentPermissions`, `api.ts`        | kanoniczny i żywy                    |

Dowód dla bloku v1 ról/wniosków wymagany przez A.2:

```text
grep -rn "assessment-workflow/[^\"']*\(my-role\|roles\|access-requests\)" src/
<PUSTO>
grep -rn "assessment-workflow/" src/ | grep -v "v2" | grep -E "roles|my-role|access-requests"
<PUSTO>
```

Mimo pustych grepów nie wykonałem usunięcia w A.2, ponieważ A.1 nie ma jeszcze kompletnego testu real-router dla wszystkich żywych grup v1. Z20 wymaga dowodu braku regresji, nie tylko braku bezpośredniego stringa.

## A.3 — kontrakt dla frontu (potwierdzony zakres)

| Wołający                            | Woła dziś                                             | Wynik/diagnoza                             | Trasa kanoniczna                                  | Body / odpowiedź                                                   | Kody                  | Uwaga                                     |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------ | --------------------- | ----------------------------------------- |
| `src/services/api.ts:8351`          | `GET /assessment-workflow/:id`                        | kształt v2 na v1; brak handlera            | `GET /assessment-workflow-v2/:id`                 | body brak; `{assessment}` wg kontrolera                            | `401,404,500`         | zmiana wyłącznie frontowa                 |
| `src/services/api.ts:8363`          | `POST /assessment-workflow/:id/request-review`        | `404` na v1                                | `POST /assessment-workflow-v2/:id/request-review` | body wg `RequestReviewSchema`; odpowiedź workflow                  | `400,401,403,404,500` | zmiana wyłącznie frontowa                 |
| `src/services/api.ts:8375`          | `POST /assessment-workflow/:id/report`                | `404` na v1                                | `POST /assessment-workflow-v2/:id/report`         | generowanie deterministycznego zastanego raportu; nie kontrakt E.1 | `400,401,404,500`     | nie mylić z nowym kontraktem 7 rozdziałów |
| `src/services/api.ts:8387`          | `POST /assessment-workflow/:id/report/approve`        | `404` na v1                                | `POST /assessment-workflow-v2/:id/report/approve` | body approval; odpowiedź raportu                                   | `400,401,403,404,500` | front                                     |
| `src/services/api.ts:8399`          | `POST /assessment-workflow/:id/approve`               | v1 istnieje, ale semantyka różni się od v2 | `POST /assessment-workflow-v2/:id/approve`        | body wg v2                                                         | `400,401,403,404,500` | nie delegować bez testu parytetu          |
| `src/services/api.ts:8408`          | `POST /assessment-workflow/:id/send-back`             | `404` na v1                                | `POST /assessment-workflow-v2/:id/send-back`      | `{comment}`                                                        | `400,401,403,404,500` | front                                     |
| `src/services/api.ts:8420-8430`     | generate/list initiatives na v1                       | `404` na v1                                | odpowiednie trasy v2                              | body/result wg v2                                                  | `400,401,403,404,500` | front                                     |
| `src/services/api.ts:8440-8455`     | sessions/open/close na v1                             | `404` na v1                                | odpowiednie trasy v2                              | wg `AssessmentController`                                          | `400,401,404,500`     | front                                     |
| `AssessmentVersionDiff.tsx:100,103` | `GET /versions/:version`                              | `404`; v1 ma listę i diff, nie detail      | `BRAK_API` dla pojedynczej wersji                 | —                                                                  | `404`                 | nie zbudowano trasy-widma                 |
| `ImportReportModal.tsx:122`         | `POST /api/assessment-reports/import`                 | `404`                                      | `BRAK_API`                                        | —                                                                  | `404`                 | decyzja zakresowa potrzebna               |
| `useAssessmentAttachments.ts:164`   | `GET /api/assessment-level-attachments/:assessmentId` | `404` wg inwentarza tras                   | `BRAK_API`                                        | —                                                                  | `404`                 | decyzja zakresowa potrzebna               |
| `ReportEditorModal.tsx:194`         | `POST /api/ai/assessment/report-section`              | `404`                                      | `BRAK_API`                                        | —                                                                  | `404`                 | nie dodano LLM                            |

## Pomiar testów (Z23) — baseline

Deklaracja: `ZASIĘG PEŁNY` dla listy §0.4a. Każdy target uruchomiono z `DATABASE_URL`, `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`, `MOCK_DB=false` w tej samej linii. Pierwszy przebieg z odziedziczonym `MOCK_DB=true` był diagnostyczny i nie jest liczony jako miarodajny baseline.

### Czerwone ZASTANE

| Target                                                     | Wynik                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `server/src/routes/v8/__tests__/assessment.routes.test.ts` | 0 testów; suite FAIL — lokalny mock auth nie eksportuje `validateOrgMembership`                   |
| `tests/integration/assessment`                             | 37/43 PASS; 6 FAIL (`assessment-reports.routes` oczekuje 401, otrzymuje 503 w złożonym przebiegu) |
| `src/components/assessment/drd/__tests__`                  | 34/40 PASS; 6 FAIL, m.in. brak oczekiwanego bannera `SESJA DEMONSTRACYJNA`                        |

### Czerwone WPROWADZONE przez dyżur

Na etapie raportowego commita A.1: brak zmian produkcyjnych, więc brak czerwonych wprowadzonych. Pomiar wyjściowy pozostaje obowiązkowy po ewentualnych zmianach produkcyjnych.

### Testy osłabione

Brak.

## B.1 — jeden serwerowy model siedmiu osi DRD

Kierunek synchronizacji: kanoniczna kopia kliencka została odczytana i mechanicznie przeniesiona do dozwolonego pliku serwerowego. Nie zmieniono żadnego pliku w `src/` i nie dopisano własnej treści metodycznej.

| Oś                        | Klient | Serwer przed | Serwer po | Przykład | Normalizacja przed | Normalizacja po | Dowód                                                    |
| ------------------------- | -----: | -----------: | --------: | -------: | -----------------: | --------------: | -------------------------------------------------------- |
| 5 — Kultura transformacji |      6 |            5 |         6 | poziom 5 |               100% |          83,33% | adapter publikuje `maxLevel: 6`; test zachowuje poziom 6 |
| 6 — Cyberbezpieczeństwo   |      6 |            5 |         6 | poziom 5 |               100% |          83,33% | adapter publikuje `maxLevel: 6`; test zachowuje poziom 6 |

Weryfikacja: `drdEvidenceScoring`, `compileDrdPack` i nowy `drdVizAdapter.day20` — 16/16 PASS. Punktowy `esbuild` PASS. Status pozostaje `CZĘŚCIOWO`, ponieważ DoD instrukcji wymaga także przykładowej sesji zapisanej i odczytanej z realnego PG; nie przedstawiam testu deterministycznego jako substytutu readbacku DB.

## B.2 — `@ts-nocheck`

### STOP — B.2

Powód: zdjęcie dyrektywy ujawnia 92 błędy punktowego `tsc`; pełne zamknięcie wymaga szerokiego typowania dynamicznych opcji i wyników w 1439-liniowym serwisie, a skrót przez `as any` jest zakazany.
Dowód: dominujące kategorie to brak deklaracji `genAI`, `model`, `_injected`; odczyty `actual/target` z `unknown`; odczyty pól z `{}`. Serwis został przywrócony bez diffu i bez zmiany zachowania.
Co zrobiłbym, gdyby przydzielono osobny zakres: wprowadziłbym jawne interfejsy opcji oraz typ osi, z testami tych samych trzech tras AI przed/po.
Stan: NIE ZACOMMITOWANO; zero zmiany produkcyjnej.

## F.1 — nieosiągalny agregator

### STOP — F.1

Powód: importer `assessmentDomainRoutes` jest nieosiągalny, ale agregowany `assessments.routes.ts` zawiera 11 handlerów, w tym odpowiedzi i framework questions; nie dowiedziono, że każda semantyka ma odpowiednik na zamontowanym moucie.
Dowód: jedyne realne odwołanie to `server/src/routes/index.ts:18 → assessment/index.ts → assessments.routes.ts`; dodatkowe trafienia `routes/index` są komentarzami. Sam brak importera nie spełnia kroku F.1.2.
Co zrobiłbym po kompletnej mapie semantycznej: usunąłbym minimalnie tylko te pliki, których każda semantyka ma zamontowany odpowiednik i pełny test regresji.
Stan: NIE ZACOMMITOWANO; zero usunięć.

## D.1 — Assessment-owned słownik kodów „Pomiń”

Jądro `MethodEvent`/`AnswerEventPayload` pozostaje nietknięte. Nowa powierzchnia jest osiągalna przez istniejący mount `/api/method`:

- `POST /api/method/sessions/:sessionId/assessment-skip-reasons` — wymagany `Idempotency-Key`; body `{unitId, questionId, level, skipCode}`; `organizationId` wyłącznie z tokenu;
- `GET /api/method/sessions/:sessionId/assessment-skip-reasons?unitId=` — aktywna, najnowsza decyzja per `unitId + questionId`.

| Kod maszynowy                   | Etykieta PL                   | CHECK w bazie | Walidacja aplikacji | Test                         |
| ------------------------------- | ----------------------------- | ------------- | ------------------- | ---------------------------- |
| `poza_modelem_operacyjnym`      | poza modelem operacyjnym      | TAK           | TAK                 | happy + readback             |
| `poza_zakresem_zlecenia`        | poza zakresem zlecenia        | TAK           | TAK                 | replay idempotentny          |
| `odroczone_do_kolejnej_rewizji` | odroczone do kolejnej rewizji | TAK           | TAK                 | walidacja skali              |
| `zastapione_innym_rozwiazaniem` | zastąpione innym rozwiązaniem | TAK           | TAK                 | objęty zamkniętym słownikiem |

Zapis jest addytywny i append-only: kolejny wpis wskazuje poprzedni przez `supersedes_id`; nie wykonuje `UPDATE` ani `DELETE`. Unikat `(organization_id, idempotency_key)` oraz `ON CONFLICT DO NOTHING` zapewniają replay bez drugiego wiersza. Wszystkie zapytania do nowej tabeli mają `fallback:false`.

Test realnego routera i domyślnego okablowania: `assessmentSkipReasons.day20.pg.test.ts` — 6/6 PASS (happy + niezależny readback, kod spoza słownika i zero zapisu, pusty stan, zła skala, replay, obcy tenant 404). Status `CZĘŚCIOWO`: nie wykonano jeszcze wymaganego przez T.3 kontrolowanego testu mutacyjnego polegającego na czasowym zneutralizowaniu filtru organizacji.

Migracja `20261101_assessment_day20_skip_reasons.sql`: `MIGRATION_PREPARED`, addytywna, zero FK, przebieg po dodaniu `Applying migrations: 1`, drugi `0`, dry-run `Pending migrations: 0`. Prettier nie ma parsera SQL w tym repo (`No parser could be inferred`); plik sformatowano ręcznie, TypeScript i raport przeszły Prettier.

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — pole `skipReason` w jądrze `AnswerEventPayload` (§D.1)

Powód: zgodnie z rozstrzygnięciem nadzorcy nie dodaję pola do współdzielonego jądra; model kodów powstaje wyłącznie w warstwie Assessmentu.
Dowód: `server/src/method-core/contracts/events.ts:131-147` nie ma `skipReason`, a plik jest imiennie tylko do odczytu.
Co zrobiłbym, gdyby zapadła osobna decyzja: przygotowałbym zmianę obu mirrorów kontraktu z analizą wpływu na SIRI i Audyty. Nie jest to część tego dyżuru.
Stan: NIE ZACOMMITOWANO w jądrze; planowana reprezentacja Assessment-owned.

### STOP — kanon 7 osi vs 8 wymiarów raportu (§E.1)

Powód: DEC-46 wiąże implementację do 7 osi, ale `ASM-CHAPTER-AC-008` pozostaje `CANON_DECISION_REQUIRED` wobec mapowania 8D.
Dowód: `OWNER_FEEDBACK_REGISTER.md:1794` oraz `docs/product/DRD_REPORT_SPEC.md`.
Co zrobiłbym, gdyby zapadła decyzja: wersjonowałbym formalne mapowanie. W tym dyżurze buduję 7 osi i nie usuwam mapowania 8D.
Stan: pozycja decyzyjna otwarta.

## Korekty wobec instrukcji

- Ledger ma 164, nie oczekiwane 160 linii; treść DEC-55 jest zgodna.
- `DRD_AXES` ma faktycznie 7 osi: `processes`, `digitalProducts`, `businessModels`, `dataManagement`, `culture`, `cybersecurity`, `aiMaturity`.
- `git fetch --all --prune` pobrał `origin` i `github-backup`, lecz zgłosił zastany martwy remote `icloud-source` wskazujący `/private/tmp/consultify-staging-deploy-e6ca`. Nie zmieniałem konfiguracji remote.
- Pierwszy techniczny przebieg baseline ujawnił zastane `MOCK_DB=true` i fail-closed części testów. Pełny miarodajny przebieg został powtórzony z `MOCK_DB=false` jawnie w tej samej linii.

## Czego NIE zrobiłem i dlaczego

- Nie wykonałem deployu, Railway, zdalnej migracji, zdalnego zapisu, pushu, merge ani rebase.
- Nie zmieniłem flag, `src/`, współdzielonego jądra zdarzeń, infrastruktury testowej ani modułu Audytów.
- Nie użyłem LLM i nie renderowałem PDF.
