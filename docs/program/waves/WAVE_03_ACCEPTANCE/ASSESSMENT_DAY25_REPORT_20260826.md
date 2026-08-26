# Assessment dzień 25 — blok 2 po dniu 20 — raport dyżuru 2026-08-26

Baza integracyjna: `codex/m03-admin-20260824 @ c7647e9a23`; marker `c7647e9a23` — POTWIERDZONY (`merge_base_exit=0`). Gałąź: `codex/assessment-day25-20260826`; worktree: `/private/tmp/consultify-assessment-day25`. Start nastąpił z wiążącej gałęzi instrukcji `5a6cdfea3d`; jej jedyne rozejście od markera to dokument instrukcji. Port PG: `5499`, kontener: `cx-day25-pg`. Przedział migracji `20261160–20261169`; użyte numery: **ŻADNE**.

Budżet B.2: 45 minut, próg 60%: 27 minut. Praca nad serwisem została zatrzymana przed licznikiem typów, ponieważ wymagany harness ujawnił niespełniony negatyw tenanta w pliku tras, którego Z17 zabrania zmieniać. `@ts-nocheck` pozostał bez zmian; liczba dodanych `any` i komentarzy `TODO(day25-B.2)`: `0 / 0`.

## Oświadczenia bezpieczeństwa

- Chroniony checkout `/Users/piotrwisniewski/Developer/Consultify` nie był czytany ani zmieniany; jedyny kontakt to dozwolony symlink `node_modules` tylko do odczytu.
- Nie wykonano deployu, Railway, zdalnej migracji, pushu, merge ani rebase.
- `src/`, `server/src/routes/index.ts`, `assessment-ai.routes.ts`, `drdStructure.ts`, kontrakt eventów i globalna infrastruktura testowa nie zostały zmienione.
- Flagi pozostają domyślnie OFF. Nie uruchomiono LLM i nie ustawiono klucza Gemini.

## Dowód celu połączenia i migracji (Z19)

Każdy przebieg Vitest dotykający bazy miał w tej samej linii:

```text
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5499/cx_day25
```

Wymagana komenda dała:

```text
current_database | inet_server_port
cx_day25         |
```

`inet_server_port()` jest pusty, ponieważ `docker exec ... psql` łączy się socketem wewnątrz kontenera; mapowanie Dockera było `127.0.0.1:5499 -> 5432/tcp`, a wszystkie testy używały jawnego hostowego URL z portem 5499. Migracje: przebieg 1 `Applying migrations: 851`; przebieg 2 `Applying migrations: 0`; dry-run `Pending migrations: 0`.

## Weryfikacja ERRATY §1.2

| #   | Wynik                                                                                         | Zgodne    | Skutek                                                                        |
| --- | --------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| 1   | `assessmentDomainRoutes` i `assessment/index.ts` nie istnieją; został `assessments.routes.ts` | TAK       | F.1 ograniczone do jednego pliku; barrel poza zakresem                        |
| 2   | role v1 mają tylko autoreferencje; access-requests są w allowliście i testach H6.4            | TAK       | usunięto tylko 4 role; wnioski `COORDINATION_REQUIRED`                        |
| 3   | import `AssessmentPermissionService` był mid-file i jest używany niżej                        | TAK       | przeniesiony do górnego bloku importów                                        |
| 4   | dwie konfiguracje B.2 są różne                                                                | TAK       | liczników nie uruchomiono, bo harness nie spełnił bramki tenanta              |
| 5   | zastany test AI ma 44 linie i testuje wyłącznie Zod                                           | TAK       | dodano realny harness 3 tras                                                  |
| 6   | brak klucza daje deterministyczne odpowiedzi fallback                                         | CZĘŚCIOWO | odpowiedzi są deterministyczne, ale trzy wybrane metody nie niosą pola `mode` |
| 7   | brak konsumenta listy attachments potwierdzony komentarzem DEC-115                            | TAK       | P2.3 = `BRAK_API`                                                             |
| 8   | sześć bramek roli stoi tylko na zapisach; GET-y są tenant-only                                | TAK       | polityka przypięta testami                                                    |
| 9   | `superseded_by` w Assessment nie jest zapisywana                                              | TAK       | wyprowadzono `supersededBy` z `supersedes_id`                                 |
| 10  | kontrakt dryfował przez latest output i bieżące skipy                                         | TAK       | opcjonalny `outputId` + odczyt skipów as-of `frozenAt`                        |

Korekta wobec instrukcji: grep `\bsuperseded_by\b` po całym `server/src` znajduje legalne, obce mechanizmy Audits; dla `assessment_skip_reasons` trafień produkcyjnego zapisu nie było. `git fetch --all --prune` zgłosił zastany uszkodzony remote `icloud-source`; `origin` i `github-backup` pobrano, marker zweryfikowano osobną komendą.

## Pozycje

| Pozycja | Status                                                              | Commit                        | Dowód                                                                                                  | Test                                                                   |
| ------- | ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| A.2     | `ZROBIONE_WG_DoD` dla części (a); część (b) `COORDINATION_REQUIRED` | `0ba1ce96f8`                  | Gateway `/api/assessment-workflow` → realny router; role po zmianie 404; access-requests pozostają     | `4/4 PASS, 0 FAIL, 0 SKIPPED`                                          |
| B.2     | `STOP`                                                              | harness `8814333274`          | `/api/assessment/:projectId/ai/*` → realny router → singleton partnera; foreign project daje 200       | `4/4 PASS`, lecz wymagany negatyw tenanta NIE SPEŁNIONY                |
| C.1     | `CZĘŚCIOWO`                                                         | `766f5ac640`                  | Gateway:958 → event route → EventStore → bridge → MethodOutputService → `method_findings.target_level` | `5/5` pierwotnie, po E.2 `6/6 PASS`; luka skali pozostaje              |
| E.2     | `CZĘŚCIOWO`                                                         | `17faf7beae`                  | GET report-contract `?outputId=` → getOutput → listActiveAsOf                                          | pin/as-of i missing revision PASS; brak pełnych 6 osobnych scenariuszy |
| F.1     | `STOP`                                                              | —                             | plik nie ma produkcyjnego importera, ale `h64-failsoft-batch7` importuje go bezpośrednio               | usunięcie wprowadziłoby czerwony test, którego nie wolno zmienić       |
| P2.1    | `ZROBIONE_WG_DoD`                                                   | `25c92bab96`                  | GET skip-reasons `?includeSuperseded=true` → wyprowadzony forward link                                 | w pakiecie `17/17 PASS`                                                |
| P2.2    | `ZROBIONE_WG_DoD`                                                   | `bc69ee697b`                  | POST skip-reasons → wynik `changes` z DB                                                               | `201/200/409`, readback i zero drugiego zapisu PASS                    |
| P2.3    | `BRAK_API`                                                          | raport                        | brak trasy i brak konsumenta; goły parametr kolidowałby z attachmentId                                 | dowód źródłowy, zero zmian `src/`                                      |
| P2.4    | `ZROBIONE_WG_DoD`                                                   | `f4345a8118`                  | tenant-only GET; role-gated POST                                                                       | członek czyta 200 / nie zapisuje 403 / obcy nie czyta                  |
| R.1     | `ZROBIONE_WG_DoD`                                                   | commit dokumentacyjny końcowy | niniejszy raport + aktualizacja rejestru                                                               | mianowniki zachowane                                                   |

## A.2 — dwie części bloku

Repo-wide grep przed zmianą: `my-role` i `/roles` znalazł tylko sam plik v1, instrukcje i raport historyczny; `access-requests` dodatkowo znalazł `demoPrincipalGuard.ts`, migawkę allowlisty oraz `h64-failsoft-batch6.test.ts`. Po usunięciu liczba handlerów `31 → 27`; import jest obecnie na linii 16; esbuild PASS.

| Handler v1                  | Odpowiednik v2            | Werdykt                                       |
| --------------------------- | ------------------------- | --------------------------------------------- |
| GET `/:id/my-role`          | v2:431                    | usunięty                                      |
| GET `/:id/roles`            | v2:468                    | usunięty                                      |
| POST `/:id/roles`           | v2:887                    | usunięty                                      |
| DELETE `/:id/roles/:userId` | v2:1000                   | usunięty                                      |
| POST `/:id/access-requests` | v2:651                    | pozostaje, koordynacja                        |
| GET `/:id/access-requests`  | v2:710                    | pozostaje, koordynacja                        |
| POST approve                | v2:755                    | pozostaje, koordynacja                        |
| POST reject                 | v2:793                    | pozostaje, koordynacja                        |
| DELETE cancel v1            | v2 POST cancel:830        | pozostaje; różny czasownik wymaga koordynacji |
| helper transition           | odpowiednik wewnętrzny v2 | pozostaje                                     |

Regresja tras status/versions/restore/presence/activities/submit-for-review/approve/reject/activity-logs oraz cztery negatywy usuniętych tras: `4/4 PASS`, realny PG, prawdziwy JWT.

## B.2 — STOP

Harness obejmuje `suggest-target`, `validate`, `insights` i negatyw projektu obcego; brak klucza, brak `injectMockClient`, realny router i JWT. `suggest-target` zwrócił deterministycznie target 4; validate zwróciło spójny pusty stan; insights zwróciło `insights: []`. Jednak unknown/foreign project zwraca `200`, a nie 403/404. Naprawa wymaga zmiany zakazanego `assessment-ai.routes.ts`, dlatego serwis pozostał z `@ts-nocheck`, obie liczby błędów nie zostały zmierzone, a `any`-washing = 0.

## C.1 — TO-BE

Realna ścieżka zapisała `ANSWER_CONFIRMED level=2`, `EVIDENCE_ATTACHED`, `DECISION_APPROVED subject=target_level level=5`, wykonała freeze i GET output. Niezależny pool odczytał `method_findings(unit_id=1A,current_level=2,target_level=5)`. Negatywy system actor 400, viewer 403, obcy tenant 403. Luka blokująca pełny DoD: level 8 dla osi 1 jest obecnie przyjmowany 201; HTTP zwraca wartości numeryczne jako stringi. Zmiana jądra jest poza zakresem, więc nie zawyżam statusu.

## E.2 — migawka rewizji

Kontrakt: `GET /api/method/sessions/:sessionId/assessment-report-contract?outputId=<id>`. Brak selektora zachowuje latest/current. Selektor spoza sesji/tenanta zwraca `404 REPORT_REVISION_NOT_FOUND`. Dla przypiętego outputu skipy są liczone `recorded_at <= output.frozenAt`; decyzja dopisana po freeze nie zmienia przypiętej odpowiedzi, a zmienia nieprzypiętą. Odpowiedź dalej niesie `outputId`, `revision`, `generatedAt`, siedem rozdziałów i `skips[]`. Status częściowy: nie zbudowano osobnego scenariusza nowej rewizji i pełnego zestawu sześciu testów z brakiem rozdziału.

## F.1 — tabela semantyk i STOP

11 handlerów ma odpowiedniki lub martwą semantykę: list/get/create/status/delete → zamontowany assessment-hub/v2; complete → v2 close/freeze; initiatives → v2 generation; response write/read → kanoniczne Method Core events; frameworks/questions → assessmentCatalog. Produkcyjny graf nie prowadzi do pliku. Jednak `tests/unit/backend/routes/h64-failsoft-batch7.test.ts:54` importuje dokładnie usuwany plik i testuje jego catch. Plik pozostaje, bo usunięcie wprowadziłoby czerwony test, a licencja Z17 nie pozwala zmienić batch7. `server/src/routes/index.ts` jest martwym barrelem cross-module do osobnej decyzji i nie został dotknięty.

## P2

- P2.1: wariant A. `supersededBy` jest odwrotnością append-only `supersedesId`; fizyczne `superseded_by` obu wierszy pozostaje `NULL`. Bez migracji i bez UPDATE/DROP.
- P2.2: pierwszy zapis `201`, identyczny replay `200` z tym samym ID, payload mismatch `409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, brak drugiego wiersza. Ostrzeżenie dla frontu: replay zmienił kod z 201 na 200; koperta `{skipReason}` pozostaje identyczna.
- P2.3: `BRAK_API`; komentarz DEC-115 potwierdza zero konsumentów. Ewentualna przyszła trasa musi mieć prefiks `/assessment/:assessmentId`, aby nie kolidować z `/:attachmentId`.
- P2.4: wszystkie 19 GET w `method-core.routes.ts` są tenant-bound; żadna nie używa `requireSessionWriteRole`. Sześć bramek roli pozostaje na zapisach. Test przypina świadomą politykę.

## Pomiar testów Z23

Baseline przed pierwszym commitem był pełny. Czerwone zastane:

| Zakres                                         | PASS |               FAIL |                                           SKIPPED |
| ---------------------------------------------- | ---: | -----------------: | ------------------------------------------------: |
| workflow integration                           |   27 |                  2 |                                                 0 |
| h64 batch6 (Table Platform, poza Assessmentem) |   16 |                  2 |                                                 0 |
| components/assessment                          |  266 |                  8 |                                                 0 |
| DRD component tests                            |   40 |                  6 |                                                 0 |
| red-assess acceptance                          |    0 |                  0 | 0; `No test files found` w domyślnej konfiguracji |
| v8 assessment.routes                           |    0 | suite startup FAIL |  0; brak `validateOrgMembership` w zastanym mocku |

Pozostałe zmierzone pakiety baseline były zielone, m.in. services/assessment `32/32`, method-core `236/236`, outputs, bootstrap `8/8`, case adapter `8/8`, unit Assessment `550/550`, integration Assessment `43/43`, DRD method core `63/63`. Liczba SKIPPED w tych pełnych przebiegach: 0. Nowe/zmienione pakiety: A.2 `4/4`, skip/report `17/17`, target/revision `6/6`, AI harness `4/4`, wszystkie 0 SKIPPED. Osłabienie zastanego testu: replay assertion w teście dnia 20 zmieniona `201 → 200` zgodnie z nowym kontraktem; żadnego `describe` nie usunięto.

Deklaracja końcowa: **ZASIĘG PEŁNY §0.4a**. Wyniki wyjściowe powtórzyły wszystkie czerwone zastane bez zmiany: workflow `27/29`, h64 batch6 `16/18`, components `266/274`, DRD components `40/46`, v8 assessment suite startup FAIL oraz red-assess `No test files found`. Zielone pakiety pozostały zielone; services/assessment wzrosło z `32/32` do `48/48` dzięki testom dnia 25. Czerwone wprowadzone przez dyżur: **0**. Wszystkie pełne przebiegi miały `0 SKIPPED`; public allowlist zakończył się exit 0, choć filtr tekstowy zgłosił `Binary file (standard input) matches` zamiast wydrukować licznik.

## STOP-y i znaleziska

### STOP — B.2

Powód: wymagany negatyw tenanta w realnym harnessie zwraca 200; naprawa leży w zakazanym pliku tras. Stan: harness zacommitowany `8814333274`, serwis nietknięty.

### STOP — F.1

Powód: dozwolony pomiar obejmuje test bezpośrednio importujący usuwany plik, a zmiana testu batch7 jest poza licencją. Stan: nie zacommitowano usunięcia.

### STOP/CZĘŚCIOWO — C.1

Powód: out-of-scale target jest przyjmowany 201; naprawa wymaga zmiany jądra poza zakresem. Stan: dowód częściowy `766f5ac640`.

Znaleziska: martwy cross-module barrel `server/src/routes/index.ts`; AI insights nie odróżnia unknown/foreign od uczciwego pustego stanu; target scale nie jest walidowana na wejściu eventu; liczby findingów serializują się jako stringi.

## Migracje i licznik

Migracje: ŻADNE — as-of jest wykonalne na append-only `recorded_at`, a wariant P2.1 nie potrzebuje DDL. Licznik 10 pozycji: 4 `ZROBIONE_WG_DoD` (A.2a, P2.1, P2.2, P2.4), 2 `CZĘŚCIOWO` (C.1, E.2), 1 `STOP` (B.2), 1 `STOP` (F.1), 1 `BRAK_API` (P2.3), 1 dokumentacyjne R.1. Część A.2b: `COORDINATION_REQUIRED`. Moduł jako całość nie jest gotowy ani zaakceptowany; wynik jest gotowy do odbioru przez nadzorcę.
