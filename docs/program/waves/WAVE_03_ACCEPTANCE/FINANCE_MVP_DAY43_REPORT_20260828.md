# Finance MVP — Day 43 — raport dyżuru 2026-08-28

## Werdykt

`CZĘŚCIOWO`. Ukończono wejściową bramkę A.1 oraz dostarczono ograniczone dowody A.2 i A.3. Nie ma podstaw do twierdzenia, że cały Finance MVP Day 43 jest zaakceptowany: pełny baseline serwera na realnym PostgreSQL jest czerwony, a pozycje B.1–R.1 nie zostały wykonane. Nie kontaktowano Railway ani środowisk współdzielonych.

## Tożsamość i bezpieczniki Bloku 0

- checkout roboczy: `/private/tmp/consultify-finance-day43`
- gałąź: `codex/finance-day43-20260828`
- marker bazowy: `b151977e4b`
- instrukcja: przeczytana w całości, 2598 linii
- źródłowy checkout `/Users/piotrwisniewski/Developer/Consultify`: zastany z obcym WIP, pozostawiony bez zmian plikowych
- PostgreSQL: własny kontener `cx-day43-pg`, host `127.0.0.1`, port `5810`, baza `cx_day43`
- migracje: 855 zastosowanych bez błędu; drugi przebieg: `Applying migrations: 0`
- `MOCK_DB=false`, `RUN_DB_TESTS=1`, jawny `DATABASE_URL`; testy uruchamiane z `--retry=0`
- marker należy do `codex/m03-admin-20260824`; różnica od końcówki tej gałęzi obejmowała dokumenty/DRD, skrypt seedujący i Assessment, bez Finance
- fetch wszystkich remotes był częściowy: `github-backup` i `origin` pobrane; remote `icloud-source` wskazuje na nieistniejący lokalny katalog `/private/tmp/consultify-staging-deploy-e6ca`
- Z29: nie wykonywano mutacji współdzielonych środowisk ani obcej bazy; własna baza została odtworzona po zanieczyszczającym baseline

Korekta proceduralna: przed dojściem podczas lektury do §Z5 w checkout źródłowym wykonano wyłącznie odczyty (`status`, remote/log) oraz `fetch`; nie zmieniono tam plików. Dalsza praca odbywała się wyłącznie w wymaganym worktree.

## Day 30 — trzy ostatnie commity

Przeczytano pełne diffy:

| SHA | Treść | Sposób użycia |
|---|---|---|
| `4c76310011` | raport Day 30 | kontekst i jawne ograniczenia dowodu |
| `a95411afcb` | STOP C.1 na schemacie ról | ponowna kontrola `organization_members_role_check` |
| `0775dfc293` | kontrakt capabilities pięciu artefaktów | wzorzec danych i wskaźnika bieżącej wersji; nie został cherry-pickowany, bo jego test montuje router zastępczo, a A.1 wymaga prawdziwego `Gateway` |

`github-backup/codex/finance-day30-20260827` obecnie wskazuje na `0775dfc293`. Commit ten nie jest przodkiem markera Day 43 (`NIE SCALONY`).

## Baseline

| Zakres | Wynik | Interpretacja |
|---|---:|---|
| UI/root OFF: Economics, panele, Finance, middleware V8 | 82 pliki, 714 testów — PASS | dowód ograniczony do wskazanego zestawu |
| server OFF: Finance V8, usługi Finance, allowlista Gateway | 72 failed / 78 passed; 166 failed / 1678 passed / 71 skipped; 6 errors | baseline czerwony; widoczne m.in. kolizje równoległego DDL, timeouty, braki mocków członkostwa i wymagania JWT; nie jest to PASS |
| `roiReadSurfaceInventory.test.ts` | brak pliku na markerze | `EVIDENCE_MISSING`, nie zastąpiono innym testem |
| pełny baseline ON | niewykonany | `NOT_PROVEN` |

Po czerwonym przebiegu własny kontener i baza zostały usunięte, utworzone ponownie, a 855 migracji uruchomiono od zera. Czerwonego baseline nie zaliczono jako regresji Day 43 ani jako akceptacji — przyczyn nie wyizolowano.

## Wyniki pozycji

Instrukcja nazywa tabelę „21 pozycji”, ale enumeruje 22 wiersze (A.1–R.2); poniżej zachowano wszystkie wymienione pozycje.

| Pozycja | Status | Dowód / brak |
|---|---|---|
| A.1 | `ZROBIONE_WG_DoD` | realny `ApiGateway.initializeRoutes`, realny PG: 20/20; OFF, brak tokenu, istniejący i brakujący zasób dla pięciu kart |
| A.2 | `CZĘŚCIOWO` | 4/4 przełącznik open/closed × admin/member; mapa bramek i komentarz DEC-177; brak autoryzacji na wpięcie nowej bramki serwerowej |
| A.3 | `CZĘŚCIOWO` | realny Gateway i PG: 10/10 dla pięciu ścieżek legacy (anonim odrzucony, członek 200 przy V8 OFF); pełna macierz wariantów UI nie została zamknięta |
| B.1 | `NIE_ZACZĘTE` | schemat odczytany; CHECK dopuszcza `OWNER, ADMIN, MEMBER, CONSULTANT, USER, GUEST`, ale nie wykonano pełnego DoD |
| B.2 | `NIE_ZACZĘTE` | — |
| B.3 | `NIE_ZACZĘTE` | — |
| C.1 | `NIE_ZACZĘTE` | — |
| C.2 | `NIE_ZACZĘTE` | — |
| D.1 | `NIE_ZACZĘTE` | — |
| E.1 | `NIE_ZACZĘTE` | — |
| E.2 | `NIE_ZACZĘTE` | — |
| G.1 | `NIE_ZACZĘTE` | — |
| G.2 | `NIE_ZACZĘTE` | — |
| G.3 | `NIE_ZACZĘTE` | — |
| G.4 | `NIE_ZACZĘTE` | — |
| H.1 | `NIE_ZACZĘTE` | — |
| I.1 | `NIE_ZACZĘTE` | mechaniczny odczyt znalazł 17 plików `*Panel*.tsx`; nie wykonano wymaganej pełnej tabeli paneli |
| J.1 | `NIE_ZACZĘTE` | — |
| K.1 | `NIE_ZACZĘTE` | — |
| L.1 | `NIE_ZACZĘTE` | — |
| R.1 | `NIE_ZACZĘTE` | brak podstaw do aktualizacji `MODULE_ACCEPTANCE.md` |
| R.2 | `ZROBIONE_WG_DoD` | ten jeden raport; statusy, dowody, ograniczenia i niezweryfikowane twierdzenia są jawne |

## A.1 — prawdziwy Gateway

Plik: `tests/integration/finance/day43.gateway-reachability.realpg.test.ts`.

Wynik: 1 plik, 20 testów PASS. Dla każdej z pięciu kart sprawdzono:

1. `ENABLE_V8_GLOBAL=false` → 404 `V8_DISABLED`;
2. V8 ON bez tokenu → odmowa uwierzytelnienia;
3. V8 ON, realny członek organizacji, istniejący artefakt → 200;
4. V8 ON, realny członek, brakujący artefakt → uczciwe 404 inne niż `V8_DISABLED`.

Test montuje rzeczywisty singleton `ApiGateway`, a nie replikę `express().use(...)`.

## A.2 — mapa bramek i odwracalność

| Powierzchnia | Bramka | Stan na markerze | Efekt |
|---|---|---|---|
| `/finance` | `BetaGate MODULE_ECONOMICS` | closed | UI zamknięte dla nie-admina |
| trasy Finance w `AppRoutes` | `ProductionModuleGate` | zależny od public-production | dodatkowe ukrycie UI |
| Sidebar | wpis `MODULE_ECONOMICS` | sterowany beta access | pozycja może zniknąć |
| My Work link | `betaModuleId=MODULE_ECONOMICS` | closed | link kontrolowany modułem |
| `BETA_ADMINS_EXEMPT` | wyjątek administratora | true | admin nie reprezentuje członka |
| `server/Gateway` V8 | `v8FeatureGate` | zależny od `ENABLE_V8_GLOBAL` | kanoniczne API może zwrócić `V8_DISABLED` |
| `financeStatementMountedSurface` | montaż przed globalną bramką V8 | aktywny | osobna powierzchnia legacy/mounted |
| server `betaGate` | middleware zgodności | pass-through | nie egzekwuje MODULE_ECONOMICS |
| owner review | `canonicalOnly` | zależny od flagi | blokuje fallback do legacy |
| owner sample | `ownerSampleData` | zależny od flagi | może zasilać UI danymi sample |

Minimalna rekomendowana poprawka poza licencją tej pozycji: zamontować jawny, domyślnie zamknięty `createModuleGate('MODULE_ECONOMICS')` przed serwerowymi powierzchniami Finance, z admin/member objętymi tą samą polityką i jednym odwracalnym źródłem konfiguracji.

`MODULE_ECONOMICS` pozostał `closed`; dodano jedynie komentarz kontraktowy DEC-177 i test 4/4 dla wstrzykniętego resolvera. Nie ogłoszono rzeczywistego single-switch, bo backendowa bramka modułowa nie jest podłączona.

## A.3 — skąd pięć kart bierze dane

| Karta | Ścieżka legacy potwierdzona przez HTTP | V8 OFF |
|---|---|---|
| Packs | `/api/finance-statements/packs` | 200 dla członka |
| Models | `/api/financial-modeling/models` | 200 dla członka |
| Analyses | `/api/economics/financial-analyses` | 200 dla członka |
| Valuations | `/api/economics/valuations` | 200 dla członka |
| Budgets | `/api/economics/budgets` | 200 dla członka |

Kod UI zawiera `shouldFallbackToLegacyFinance`; `useFinanceData` posiada osobne tryby `canonicalOnly` i `ownerSampleData`. To potwierdza współistnienie torów, ale bez pełnej macierzy UI/runtime nie dowodzi, który tor zasila każdą konfigurację użytkownika.

## Commity Day 43

- `56af1cacda` — A.1 real Gateway, pięć kart
- `2dc1b9a916` — A.2a inwentarz zachowania middleware
- `1fa5743d85` — A.2b kontrakt odwracalnego przełącznika
- `4a2d59e88e` — A.2c test odwracalności
- `0b36c6a46e` — A.3 real Gateway, legacy track

## STOP-y i licencja

Nie ogłoszono formalnego STOP-u dla pozycji. Pozostałe pozycje mają status `NIE_ZACZĘTE`, a nie sztucznie podniesiony `STOP`. Ramkę licencji przeczytano w całości wraz z instrukcją; nie wykorzystano jej do rozszerzenia zakresu.

## Twierdzenia niezweryfikowane

- Nie zweryfikowano zachowania staging, demo ani produkcji; Railway nie był kontaktowany.
- Nie zweryfikowano przeglądarkowo ani wizualnie pięciu kart i ich stanów empty/loading/error.
- Nie udowodniono pełnej macierzy UI: sample/canonical/legacy dla wszystkich konfiguracji flag i ról.
- Nie wykonano pełnego denominatora tras ani wymaganych testów mutacyjnych Z29 dla wszystkich endpointów Finance.
- Nie wykonano pełnego baseline ON i nie wyizolowano przyczyn 72 czerwonych plików baseline serwera OFF.
- Nie udowodniono B.1–L.1 ani gotowości R.1; brak wykonania nie jest wynikiem pozytywnym.
- Nie uzyskano akceptacji ownera ani decyzji o release.

## Następny bezpieczny krok

Kontynuować od B.1 na tej samej bazie markera dopiero po odtworzeniu czystego własnego PG i uruchamiać zakresy sekwencyjnie, aby oddzielić realne defekty od równoległych kolizji DDL. Nie aktualizować `MODULE_ACCEPTANCE.md` przed domknięciem brakujących pozycji i pełnych baseline OFF/ON.
