# Assessment dzień 20 (mechanika tylna) — raport dyżuru 2026-08-26

Baza związania: `codex/m03-admin-20260824` @ `649bd730a6`; aktualny tip po rozejściu: `7760f6fb12`.
Marker: `649bd730a6` — POTWIERDZONY (`git merge-base --is-ancestor`).
Gałąź: `codex/assessment-day20-20260826`.
Worktree: `/private/tmp/consultify-assessment-day20`.
Port PG: `5469` · kontener `cx-day20-pg` usunięty: TAK · wolumeny usunięte: TAK.
Przedział migracji: `20261101`–`20261109` · użyte numery: `20261101`.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie wykonywałem odczytów ani zapisów w chronionym checkoutcie. Jedyny kontakt to dozwolony symlink `node_modules` do odczytu: `/private/tmp/consultify-assessment-day20/node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules`.

## Oświadczenie o zakresie `src/`

Nie zmieniono żadnego pliku w `src/`. `git diff --name-only codex/m03-admin-20260824...HEAD | grep '^src/'` → PUSTO.

## Dowód celu połączenia (Z19 / DEC-96 / DEC-98)

```text
 current_database | inet_server_port
------------------+------------------
 cx_day20         |             5432
(1 row)
```

Dowód wykonano przez TCP wewnątrz kontenera; mapowanie hosta potwierdzone przez Docker: `5469:5432`. Wszystkie polecenia DB miały jawne `DATABASE_URL=postgres://postgres:cx@localhost:5469/cx_day20` w tej samej linii.

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
| Pomiar wejściowy §0.4a          | WYKONANY — pełny zakres, realny PG, `MOCK_DB=false`                                                                                 |

## Pozycje — tabela zbiorcza

| Pozycja | Status      | Commit                 | Dowód osiągalności                                                                                   | Dowód testowy                                                                   |
| ------- | ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A.1     | CZĘŚCIOWO   | `6f45724eeb`           | `Gateway.ts:639,641` → deklaracje routerów; 31 v1 + 41 v2 znalezione                                 | inwentarz statyczny; brak pełnego testu HTTP 72 tras                            |
| A.2     | STOP        | —                      | kanon v2 potwierdzony, ale bez pełnego A.1 nie usuwam kodu                                           | brak zmian produkcyjnych                                                        |
| A.3     | CZĘŚCIOWO   | `6f45724eeb`           | wywołania klienta zmierzone statycznie; reprezentatywne czerwone zastane w baseline                  | pełny kontrakt odpowiedzi wymaga osobnego pomiaru real-router                   |
| B.1     | ZROBIONE_WG_DoD *(FIX-3, 2026-08-26)* | `0e34ffe479` + FIX-3 | `Gateway` → raporty/Assessment → `drdVizAdapter` → `server/src/data/drdStructure.ts`                 | 16/16 PASS deterministyczne + przed/po zmierzone na realnym PG (patrz sekcja B.1, tabela FIX-3): 100%→83% (poziom 5), obcinanie poziomu 6 do 5 potwierdzone logiem `AxisDataGuard` przed fixem |
| B.2     | STOP        | —                      | serwis osiągalny przez `Gateway.ts` → `assessment-ai.routes.ts` → `aiAssessmentPartnerService.ts`    | 92 błędy punktowego `tsc` po zdjęciu `@ts-nocheck`; plik przywrócony bez diffu  |
| C.1     | NIE_ZACZĘTE | —                      | —                                                                                                    | —                                                                               |
| D.1     | CZĘŚCIOWO   | `735b56a831`           | `Gateway.ts:958` → `/api/method` → skip routes → `AssessmentSkipReasonService` → lokalny PG          | 6/6 PASS real-router/PG; brak dowodu mutacyjnego T.3 obniża status              |
| D.2     | CZĘŚCIOWO   | `729038166f`           | report contract → `AssessmentSkipReasonService.listActive`; zero parsowania `justification`          | 9/9 wspólny pakiet PASS; osobny negatyw historycznego tekstu nie dodany         |
| E.1     | CZĘŚCIOWO   | `729038166f`           | `Gateway.ts:958` → `/api/method/.../assessment-report-contract` → serwis → output + DRD + skip model | 9/9 PASS; brak fixture z pełnym zamrożonym outputem obniża status               |
| E.2     | NIE_ZACZĘTE | —                      | —                                                                                                    | —                                                                               |
| F.1     | STOP        | —                      | brak importera barrela potwierdzony, ale nie dowiedziono odpowiedników wszystkich 11 semantyk        | zero usunięć zgodnie z Z20                                                      |
| T       | CZĘŚCIOWO   | końcowy commit raportu | nowe trasy: real router → real PG                                                                    | pełny Z23 wykonany; 14 czerwonych zastanych front/v8, zero dowiedzionych nowych |
| R.1     | NIE_ZACZĘTE | —                      | —                                                                                                    | —                                                                               |

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

> **FIX-1 (P1-1, korekta po odbiorze dyżuru 20, 2026-08-26):** wiersz `api.ts:8351`
> błędnie opisywał `GET /assessment-workflow/:id`, a linia 8351 to
> `deleteAssessment` → `DELETE`. Poza tym ten wołający NIE ma fallbacku v2→v1 —
> woła v1 wprost, bez próby v2 najpierw (inaczej niż pozostałe wiersze tej
> tabeli). Tabela pomijała też dwa realne wywołania legacy-fallback (`getAssessmentSession`
> i `updateAssessmentSession`), oba dają `404` na v1, ponieważ
> `server/src/routes/assessment/assessment-workflow.routes.ts` (realny zamontowany
> v1 router pod `/api/assessment-workflow`, potwierdzone `Gateway.ts:639`) nie ma
> gołego handlera `GET/PUT /:assessmentId` — każda jego trasa wymaga dodatkowego
> segmentu (np. `/:assessmentId/status`). Kanoniczne `GET/PUT/DELETE /:assessmentId`
> istnieją tylko na v2 (`server/src/routes/assessment-workflow-v2.routes.ts:250,253,276`).
> Poniższe trzy wiersze (8242, 8272, 8351) są poprawione/dopisane; reszta tabeli
> niezmieniona.

| Wołający                            | Woła dziś                                             | Wynik/diagnoza                                            | Trasa kanoniczna                                  | Body / odpowiedź                                                   | Kody                  | Uwaga                                     |
| ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------| -------------------------------------------------- | ------------------------------------------------------------------ | --------------------- | ----------------------------------------- |
| `src/services/api.ts:8242`          | `GET /assessment-workflow/:id` (legacy fallback z v2)  | `404` na v1 — brak gołego handlera `GET /:assessmentId`   | `GET /assessment-workflow-v2/:id`                 | body brak; `{assessment}` wg kontrolera                            | `401,404,500`         | zmiana wyłącznie frontowa                 |
| `src/services/api.ts:8272`          | `PUT /assessment-workflow/:id` (legacy fallback z v2)  | `404` na v1 — brak gołego handlera `PUT /:assessmentId`   | `PUT /assessment-workflow-v2/:id`                 | body wg `UpdateAssessmentSchema`; `{assessment}` wg kontrolera     | `400,401,404,500`     | zmiana wyłącznie frontowa                 |
| `src/services/api.ts:8351`          | `DELETE /assessment-workflow/:id` (wołanie v1 wprost, BEZ próby v2 — jedyny taki przypadek w tej tabeli) | `404` — brak gołego handlera `DELETE /:assessmentId` na v1 | `DELETE /assessment-workflow-v2/:id`              | brak body; `204`/potwierdzenie wg kontrolera                       | `401,404,500`         | zmiana wyłącznie frontowa; ujednolicić z resztą (dodać próbę v2 najpierw) |
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

Weryfikacja: `drdEvidenceScoring`, `compileDrdPack` i nowy `drdVizAdapter.day20` — 16/16 PASS. Punktowy `esbuild` PASS.

### FIX-3 (P1-3, 2026-08-26) — pomiar przed/po na realnym PG

DoD wymagał tabeli przed/po zmierzonej na realnym PG, nie tylko testu deterministycznego. Wykonano: jednorazowy kontener `pgvector/pgvector:pg16` (port **5487**, `DATABASE_URL` jawny w tej samej linii wywołania), pełne migracje (`Applying migrations: 846` → drugi przebieg `0` → dry-run `Pending migrations: 0`), zasiane minimalne dane (dwa wiersze `assessment_reports.axis_data` z `{culture, cybersecurity}` na poziomach 5 i 6), odczyt przez REALNĄ, żywą trasę `GET /api/assessment-reports/:reportId/drd-report` (router `assessment-reports.routes.ts`, ten sam kod co produkcja: `areaScoresFromAxisData` → `buildDrdReportHtmlServer` → `buildAreaRows`/`buildDimensions` → `pct(actual, axis.levelCount)`), z odczytem **wyrenderowanego HTML** (nie pośredniego obiektu). Pomiar „przed” = plik `server/src/data/drdStructure.ts` podmieniony na wersję z markera `6f45724eeb` (rodzic commitu B.1, `git show <sha>:path > path`, tańsze niż `git stash` — jeden plik, zero ryzyka dla reszty drzewa roboczego), po pomiarze przywrócony `git checkout HEAD -- <path>` i zweryfikowany bit-identyczny z HEAD. Pomiar „po” = bieżący HEAD (bez zmian, B.1 był już zacommitowany wcześniej).

| Oś / obszar               | Zasiany poziom | Renderowany % PRZED (marker `6f45724eeb`, maxLevel=5) | Renderowany % PO (HEAD, maxLevel=6) | Frakcja obszaru PRZED | Frakcja obszaru PO |
| -------------------------- | :------------: | :-----------------------------------------------------: | :------------------------------------: | :--------------------: | :------------------: |
| 5 — Kultura transformacji  |        5       | 100%                                                     | **83%**                                 | 5/5                     | 5/6                  |
| 5 — Kultura transformacji  |        6       | 100% *(obcięte — patrz niżej)*                           | **100%**                                | 5/5 *(obcięte z 6/6)*  | 6/6                  |
| 6 — Cyberbezpieczeństwo    |        5       | 100%                                                     | **83%**                                 | 5/5                     | 5/6                  |
| 6 — Cyberbezpieczeństwo    |        6       | 100% *(obcięte — patrz niżej)*                           | **100%**                                | 5/5 *(obcięte z 6/6)*  | 6/6                  |

Dowód „obcinania” poziomu 6 przed fixem — realny log z żywego zapisu przez `AxisDataGuard` w `drdReportService.ts` podczas pomiaru „przed” (seed `actual=6, target=6` przy ówczesnym `axis.levelCount=5`):

```text
[AxisDataGuard] axis_data out of range — clamped actual=6 to [0,5] for axis "Culture of Transformation". axis_data must hold DRD levels (0..maxLevel), never 0-100 percentages. Check the write path (seed/import/generator).
[AxisDataGuard] axis_data out of range — clamped target=6 to [0,5] for axis "Cybersecurity". axis_data must hold DRD levels (0..maxLevel), never 0-100 percentages. Check the write path (seed/import/generator).
```

Wniosek: korekta zgodna z kanonem klienckim (klient od zawsze miał 6 poziomów dla osi 5 i 6 — patrz kolumna „Klient” w tabeli wyżej). Żaden wiersz bazy nie jest przepisywany — `axis_data` trzyma zawsze SUROWY poziom DRD (`5` albo `6`), zmienia się wyłącznie `axis.levelCount` (stały, statyczny plik danych) użyty do renderowania procentu w locie, więc korekta jest czysto prezentacyjna: dane historyczne odczytane po fixie automatycznie przestają być fałszywie obcinane/zawyżane, bez migracji, backfillu ani jednorazowego skryptu naprawczego. Różnica względem wcześniejszej tabeli deterministycznej (83,33% z `drdVizAdapter.day20.test.ts`) to tylko precyzja: żywa trasa klienta zaokrągla `pct()` do liczby całkowitej (`Math.round`), więc renderuje **83%**, nie 83,33% — obie liczby opisują tę samą korektę (100%→83%), test deterministyczny po prostu nie zaokrąglał.

Kontener i wolumeny posprzątane po pomiarze (`docker rm -f`, brak wolumenu nazwanego — `-v` nie był używany, więc nic nie zostaje). Dane zasiane i wyczyszczone własnym `DELETE ... WHERE organization_id = $throwaway_org` po każdym przebiegu; zero rekordów demo/produkcyjnych dotkniętych — kontener istniał wyłącznie lokalnie na porcie 5487, nigdy nie był bazą demo/staging/produkcyjną.

Status B.1 zmienia się z `CZĘŚCIOWO` na w pełni udowodniony na realnym PG (DoD spełniony); pozostała treść sekcji (16/16 PASS deterministyczne) bez zmian.

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

## D.2 / E.1 — deterministyczny kontrakt siedmiu rozdziałów

Nowe API: `GET /api/method/sessions/:sessionId/assessment-report-contract`.

Kontrakt zwraca siedem rozdziałów w kolejności osi DRD. Każdy ma: wstęp `120–180`, matrycę z podpisem `30–60`, komentarz dla każdego kanonicznego obszaru `110–170` z pięcioczęściową mikrostrukturą oraz wnioski `180–260` i pustą linię decyzyjną. Wszystkie treści mają uczciwe `content: null`; zero LLM i zero zegara runtime — `generatedAt` pochodzi z niezmiennego outputu albo czasu utworzenia sesji.

| Rozdział | Sloty                                          | Źródło liczb                                                 | Traceability                                         |
| -------- | ---------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Osie 1–7 | introduction, matrix, areaComments, conclusion | najnowszy `MethodOutputService` + kanoniczny `DRD_STRUCTURE` | finding id, evidence id, source locator, uncertainty |

Stan pominięcia jest czytany wyłącznie z `assessment_skip_reasons`: `skipped` + maszynowy `skipCode`. Serwis nie importuje ani nie parsuje `justification`, nie ma regexu polskiego zdania. Obszar bez findingu i bez pominięcia ma `not_assessed`, nigdy zero ani sukces.

> **FIX-2 (P1-2, rozstrzygnięcie nadzorcy, 2026-08-26):** pierwotna implementacja
> kluczowała `skipByUnit` wyłącznie po `unitId`, więc (a) obszar z JEDNYM
> pominiętym pytaniem z pięciu prezentował się jako pominięty w całości, i (b)
> przy dwóch różnych kodach pominięcia dla tego samego obszaru zwracała jeden
> arbitralny (ostatni zapisany). Naprawiono w `assessmentReportContractService.ts`:
> kontrakt niesie teraz listę pominięć per pytanie (`skips: [{questionId, skipCode}]`
> w `matrix.areas[]` i `areaComments[]`), a pole `skipped` na poziomie obszaru jest
> prawdziwym agregatem — `true` TYLKO gdy liczba różnych poziomów osi objętych
> aktywnym pominięciem tego obszaru osiąga `axis.levelCount` (każdy poziom = jeden
> assessable slot obszaru, ten sam limit już egzekwowany przy zapisie przez
> `INVALID_UNIT_OR_LEVEL`); przy pominięciu częściowym `skipped: false` +
> niepusta lista. Pole `skipCode` (pojedyncze, wsteczna zgodność) zwraca kod
> TYLKO gdy lista ma dokładnie jeden wpis — inaczej `null`, nigdy arbitralny wybór.
> Dwa nowe testy w `assessmentSkipReasons.day20.pg.test.ts` na realnym
> PG dowodzą obu gałęzi: `lists two differently-coded partial skips without
> collapsing the area` (2 pytania, 2 różne kody, obszar 7A → `skipped:false`,
> `skips` ma 2 wpisy) i `marks the area fully skipped only once every one of its
> five levels is skipped` (5/5 poziomów obszaru 7B pominiętych → `skipped:true`).
> Istniejący test dla obszaru 5A (jedno pominięte pytanie na sześć poziomów osi 5)
> zaktualizowano: było błędnie `skipped:true`, teraz poprawnie `skipped:false` +
> `skips` z jednym wpisem. Pakiet real-router/PG rośnie z 9/9 do **11/11 PASS**.

Pakiet real-router/PG 11/11 PASS obejmuje deterministyczne dwa odczyty, siedem osi, `content:null`, komentarze wszystkich pięciu obszarów osi 5, poprawną (nie-zwiniętą) listę pominięć z tabeli Assessmentu, nieznaną sesję 404 i obcego tenanta 404. Statusy `CZĘŚCIOWO`: brak pełnej zamrożonej sesji z findings/evidence do liczbowego porównania silnika oraz brak osobnego fixture historycznego, które zawiera tylko polski tekst `justification`.

Konflikt 7 osi vs 8 wymiarów pozostaje jawnie otwarty; mapowania 8D nie zmieniono.

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

## Pomiar wyjściowy §0.4a — ZASIĘG PEŁNY

| Target                                                                 | Wynik wyjściowy                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `server/src/routes/v8/__tests__/assessment.routes.test.ts`             | FAIL suite, 0 testów — zastany brak `validateOrgMembership` w lokalnym mocku |
| `server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts` | 2/2 PASS                                                                     |
| `server/src/services/assessment/__tests__`                             | 21/21 PASS                                                                   |
| `server/src/method-core/__tests__`                                     | 245/245 PASS, w tym 9 nowych testów Day 20                                   |
| `server/src/method-core/outputs/__tests__`                             | 23/23 PASS                                                                   |
| `server/src/routes/assessmentCatalog/__tests__`                        | 7/7 PASS                                                                     |
| `server/src/services/assessmentMethodBootstrap/__tests__`              | 8/8 PASS                                                                     |
| `assessmentAdapter.pg.test.ts`                                         | 8/8 PASS                                                                     |
| `tests/unit/assessment`                                                | 550/550 PASS, w tym 4 nowe testy skali                                       |
| `tests/unit/drdVizAdapter.test.ts`                                     | 4/4 PASS                                                                     |
| `tests/integration/assessment`                                         | 43/43 PASS                                                                   |
| sześć pojedynczych integration validator targets + overview            | 26/26 PASS                                                                   |
| `tests/components/assessment`                                          | 266/274 PASS; 8 zastanych FAIL w trzech plikach Outputs                      |
| `src/components/assessment/drd/__tests__`                              | 34/40 PASS; 6 zastanych FAIL bannera demo                                    |
| `src/method-core/methods/drd/__tests__`                                | 63/63 PASS                                                                   |

### Czerwone WPROWADZONE

Zero dowiedzionych. Żaden czerwony plik nie jest dotknięty przez dyżur; zakres `src/` i globalnej infrastruktury testowej jest pusty. `tests/integration/assessment` było niestabilne w pierwszym sekwencyjnym baseline (37/43), a na wyjściu ma 43/43; nie przypisuję tego pracy produkcyjnej.

### Pakiet domyślnego okablowania (Z21)

`server/src/method-core/__tests__/assessmentSkipReasons.day20.pg.test.ts` bootuje produkcyjny eksport `method-core.routes.ts`, produkcyjny singleton serwisów, prawdziwe JWT i prawdziwy PostgreSQL; nie wstrzykuje repozytorium ani zależności. Wynik 9/9 PASS.

### Brak atrapy z zewnętrznym skutkiem (Z22)

Nowe POST zmienia tabelę `assessment_skip_reasons`; zły kod, zła skala, obcy tenant i brak uprawnień kończą się 4xx i zerem zapisu. Nowe GET-y nie mają skutku zewnętrznego. Nie dodano publikacji, eksportu pliku, mailera, webhooka ani powiadomienia.

## Dowody granic

- Z18: diff nie zawiera `tests/setup`, helpers, mocks ani configów Vitest.
- `src/`: pusty diff.
- Migracje: wyłącznie `20261101_assessment_day20_skip_reasons.sql`.
- `server/src/method-core/contracts/events.ts`: pusty diff.
- `server/src/services/audits/`: pusty diff.
- Flagi: nie dodano i nie zmieniono wartości domyślnych.
- LLM: brak importów/wywołań w kodzie zadania; trafienia grepa w całym diffie pochodzą wyłącznie z wiążącej instrukcji i raportu.

## FIX-y po odbiorze dyżuru 20 (2026-08-26) — warunki scalenia

Odbiór dyżuru 20 potwierdził zero P0, zero atrap, słownik kodów zgodny z frontem 1:1, ale postawił trzy warunki P1 i jeden P2 przed scaleniem. Wykonane na gałęzi `codex/assessment-day20-20260826`, worktree `/private/tmp/consultify-day20-fixes`, commit-per-fix, bez push/merge.

| Fix | Opis | Status | Dowód |
| --- | ---- | ------ | ----- |
| FIX-1 (P1-1) | Błędny wiersz A.3 (`api.ts:8351` opisany jako GET, realnie DELETE) + dwa pominięte legacy-fallbacki (GET `:8242`, PUT `:8272`) | ZROBIONE | patrz sekcja A.3 wyżej, adnotacja FIX-1 |
| FIX-2 (P1-2) | `skipByUnit` kluczowany po `unitId` zwijał częściowe pominięcia do `skipped:true`; przy 2 kodach zwracał arbitralny | ZROBIONE | patrz sekcja D.2/E.1 wyżej, adnotacja FIX-2; real-router/PG 9/9→11/11 PASS |
| FIX-3 (P1-3) | Zmiana `levelCount` osi 5/6 (5→6) zmienia prezentację (100%→83%, poziom 6 przestaje być obcinany) bez przepisywania danych; wymagany dowód przed/po na realnym PG | ZROBIONE | patrz sekcja B.1 wyżej, tabela FIX-3; kontener pgvector:pg16 port 5487, posprzątany |
| FIX-4 (P2) | `assessmentSkipReasons.day20.pg.test.ts` poza dozwoloną ramką lokalizacyjną (`method-core/__tests__`) | ZROBIONE | przeniesiony do `server/src/services/assessment/__tests__/`, importy poprawione (`../../` → `../../../`), 11/11 PASS na tej samej instancji PG |

Weryfikacja końcowa: cały pakiet `assessmentSkipReasons.day20.pg.test.ts` (9 oryginalnych + 2 nowe testy FIX-2) — **11/11 PASS** na realnym PG, z nowej lokalizacji po FIX-4. Migracje na jednorazowym kontenerze: przebieg 1 `Applying migrations: 846` (w tym `20261101_assessment_day20_skip_reasons.sql`), przebieg 2 `Applying migrations: 0`, dry-run `Pending migrations: 0`. Kontener i wszystkie zasiane dane usunięte po zakończeniu pomiarów; zero dotknięcia bazy demo/staging/produkcyjnej.

## Licznik

13 pozycji: 1 `ZROBIONE_WG_DoD` (B.1, po FIX-3), 6 `CZĘŚCIOWO` (A.1, A.3, D.1, D.2, E.1, T), 3 `STOP` (A.2, B.2, F.1), 3 `NIE_ZACZĘTE` (C.1, E.2, R.1). Flagi pozostały OFF. Stan jest gotowy do odbioru przez nadzorcę jako częściowy, bez zawyżenia — aktualizacja odzwierciedla wyłącznie FIX-1/FIX-2/FIX-3/FIX-4 (dyżur naprawczy po odbiorze 20); A.3, D.1, D.2, E.1, T pozostają CZĘŚCIOWO z powodów niezwiązanych z tymi czterema fixami (patrz kolumna „Dowód testowy”).
