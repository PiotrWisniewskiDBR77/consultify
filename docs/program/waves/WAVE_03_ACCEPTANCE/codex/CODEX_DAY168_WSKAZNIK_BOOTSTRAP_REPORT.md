# CODEX DAY 168 — WSKAŹNIK: BOOTSTRAP POLITYKI WIDOCZNOŚCI

Stan: **ZROBIONE_WG_DoD dla R2–R4; R1 potwierdzone runtime; jedno ryzyko OKR przekazane do 169**.

## §0.1 — baza pracy i marker

Wynik komend (2), dosłownie:

```text
2310f715f8 docs(codex): dyzury 168 i 169 wydane — priorytety wlasciciela: bootstrap wskaznika, okna check-inu celu
c1170e4766 merge: dyzur 167 (dlug narzedzi — bramka migracji wpieta w CI, parser naprawiony, config PG odpiety w polowie) — odbior adwersaryjny
e3061d9c1c odbior 167: P1/P2 B, P3/P4 A; root vitest.config nietkniety przez blad w MOJEJ licencji — 80 testow obchodzi ten bug recznie
18ba1bd3cf DYZURY PRIORYTETOWE dla toru funkcji: wskaznik bez polityki widocznosci, cel bez okien check-inu
3f2b6da1f0 rejestr: piec nowych ekranow do odbioru (trzy karty Wynikow, lista inicjatyw, wspolny prawy pas)
032c955c47 docs(day167): normalize report whitespace
56987c6cd1 docs(day167): record measurement-tool evidence
b8e5aa90ca tools(day167): inventory every add-column clause
8db52e8584 prawy pas: JEDEN WSPOLNY SYSTEM jako realny komponent, za flaga wylaczona
c006b38d52 ci(day167): automate fresh migration gate
2e89fc7bce test(day167): align rollback lifecycle assertions
7d0f853a83 test(day167): let CLI select server database
bfb4180452 docs(codex): 165 poszerzony o R0 — przyczyna zrodlowa w aiWorker.ts (falszywe SUCCEEDED przy bramce zgody)
f8e3ff0744 Wyniki: wskaznik i cel dostaly te sama formule co ROI — modul mowi jednym jezykiem
82603810fe merge: dyzur 164 (agent melduje sukces przy zerze pracy — A, dowod mutacyjny odtworzony) — odbior adwersaryjny
c2ffb9fc4c odbior 164: A na dowodzie defektu — przyczyna zrodlowa w aiWorker.ts:111; odpowiedz dla wlasciciela: NIE WLACZAC flagi
bda3e98958 pomiar mechaniki: ROI dziala, wskaznik ma blokade na starcie, cel ma dziure na check-inie
332fa332bd lista inicjatyw: wyrenderowana pod wlasna nazwa — istniala schowana pod ekranem od i18n
d3c30bfb06 docs(codex): dyzury 166 i 167 wydane — domkniecie karty decyzji, splata dlugu narzedzi pomiarowych
76996ee069 odbior: wszystkie 196 ekranow ma opis GDZIE JEST i PO CO
05c8df153d docs(codex): dyzur 165 wydany — wznowienie agenta po akcepcie kroku, koniec klamstwa 'zakolejkowane'
1aa942cb32 ROI: trzy ekrany scalone w JEDNA karte N — prototyp do decyzji
a33a7bcb3a docs(day164): record owned resource cleanup
b1174931ad docs(day164): map agent false-success execution defect
22124537f7 merge: dyzur 161 (lancuch migracji od pustej bazy przechodzi 868/868 — A; bramka niewpieta — C) — odbior adwersaryjny
MARKER OK
```

Wynik komend (7), dosłownie:

```text
18ba1bd3cf62645cbf3792dc860c50593c95d63b
```

Tip uciekł do przodu o commity `e3061d9c1c`, `c1170e4766`, `2310f715f8`; pracę rozpoczęto dokładnie z markera. Wolne miejsce: `31Gi`. Porty `6059`, `5006`, `5007` były wolne.

## Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

`grep` drenaży w `server/src/Gateway.ts`: 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — trzy domeny

| Domena | Publisher produkcyjny | Czytelnik fail-closed | Wynik świeżej organizacji |
|---|---|---|---|
| ROI | `roi.routes.ts:3172` → `publishRoiGovernedVisibilityPolicy`; osobny endpoint | `roiCaseCommands.ts:111` i wywołanie `getActiveVisibilityPolicy` w komendzie | Bez osobnej publikacji: fail-closed; ścieżka publishera istnieje. Runtime ROI nie był osobną bramką tego dyżuru. |
| OKR | `okrProgramCommands.ts:571-579` → `publishVisibilityPolicy`, osiągalne przez `okr.routes.ts:663,679` | `okrSetCommands.ts:322-330` | `POST /sets` przed Programem: `409 NO_ACTIVE_VISIBILITY_POLICY`; `createProgram 201` → `publish 200` → `createCycle 201` → `createOkrSet 201`. |
| KPI przed naprawą | **brak publishera** w `services/resultsVnext/kpi/**` | `kpiDefinitionCommands.ts:378-383` po zmianie; ten sam fail-closed pozostał | Mutacja wyłączająca wyłącznie publisher: `409 NO_ACTIVE_VISIBILITY_POLICY`. |

Granica dowodu: bez zakazanego połączenia z demo/stagingiem/produkcją nie da się rozstrzygnąć, które istniejące tam organizacje były wcześniej dotknięte ręcznym skryptem. Z kodu potwierdzono jedynie, że `organizationService.ts` nie zapisuje `rvn_platform_visibility_policies` (`grep -c` = `0`).

Ryzyko przekazane do dyżuru 169: `CreateOkrProgramSchema` dopuszcza pominięcie pól polityki, ale trasa przekazuje wszystkie jako `undefined`; spread w `createProgram` nadpisuje `PROGRAM_POLICY_DEFAULTS`. Minimalne `{name, visibilityDefault}` dało realne `500`: `null value in column "cycle_model" ... violates not-null constraint`. Pełny, jawny payload przechodzi. Nie zmieniono kodu OKR.

## R2 — wybrany wzorzec

Wybrano **wzorzec OKR**: automat w tej samej transakcji pierwszego zapisu produktowego. KPI nie ma nadrzędnego obiektu Program ani osobnego etapu publish, więc odpowiednikiem kroku OKR jest początek `createKpiDraft`. Gdy polityki brak, istniejący współdzielony `publishVisibilityPolicy` tworzy aktywną politykę `domain='kpi'`, `mode='OPEN_ORG'`; tryb jest zgodny z istniejącym rollout seedem KPI. Potem bez zmian wykonuje się `getActiveVisibilityPolicy` i rzucenie `KpiNoActiveVisibilityPolicyError` przy braku. Nie skopiowano osobnej governance ROI i nie osłabiono bramki.

Pliki: `kpiDefinitionCommands.ts:363-375` bootstrap; `:378-383` zachowany fail-closed. Nowa migracja nie powstała: istniejąca tabela i prymityw wystarczają.

## R3 — measurementFrequencyDays

Wszystkie cztery warstwy dla create i edit:

1. Zod: `resultsVnextKpi.validators.ts:110,150`.
2. Wejścia komend: `kpiDefinitionCommands.ts:266,531`.
3. SQL: INSERT `:424-443`; UPDATE `:602-632`.
4. Trasy: `kpi.routes.ts:379,623`.

Surowy readback po POST: `measurement_frequency_days = 30`; po PUT draftu: `14`.

## R4 — pełny round-trip i SQL

W realnym `ApiGateway`, z podpisanym JWT, na bazie `cx168`:

- polityka przed POST: `[]`;
- `POST /api/vnext/results/kpi`: `201`, `outcome=applied`;
- SQL definicji: KPI `b76ff06f-03c3-49e6-b71c-10bc657d3a57`, cadence `30`, potem `14`;
- `POST .../measurements`: `201`, wartość `73.5`;
- `GET .../measurements`: `200`, wartość `73.5`;
- SQL `rvn_kpi_measurements`: jeden wiersz, `actual_value='73.5'`, source `day168-runtime-proof`;
- SQL polityki: `domain='kpi'`, `visibility_mode='OPEN_ORG'`, `is_active=true`.

Dowód mutacyjny: chwilowe pominięcie wyłącznie `publishVisibilityPolicy` przywróciło `409 NO_ACTIVE_VISIBILITY_POLICY` i test czerwony; po przywróceniu pliku test ponownie zielony. `git diff --check` czysty; poza zamierzonymi zmianami brak mutacji.

## Testy i pułapki środowiska

Użyto `server/vitest.config.ts` przez komendę uruchomioną z katalogu `server/` jako `--config vitest.config.ts`. W markerze config nadal ma `DB_TYPE: 'sqlite'` w linii 17; nowy pakiet jawnie ustawia i asertuje `process.env.DB_TYPE === 'postgres'` przed `assertRealPostgresTestEnvironment()`. Log dodatkowo podał `DB_IDENTITY ... 127.0.0.1:6059/cx168`.

Komplet env był w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6059/cx168 JWT_SECRET=...`; zawsze `--retry=0`.

Wynik po pełnych nazwach: 2/2 PASS:

- `... creates the first KPI, persists cadence, edits it, and round-trips a measurement`;
- `... proves OKR fails before Program publication and succeeds after its bootstrap path`.

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) jawna asercja DB_TYPE i strażnik real PG; (d) `ENABLE_TEST_AUTH_BYPASS=false` oraz podpisany JWT; (e) OKR zmierzony runtime w obu wariantach. `No test files found` nie wystąpiło.

Instrukcja odwołuje się do `§0.4a`, ale dokument nie zawiera takiej sekcji ani komendy selekcji. Nie sfabrykowano mianownika: wykonano pełny nowy pakiet 2/2 oraz porównano przypadki po `fullName`.

## Migracje

Pierwszy pełny przebieg od pustej bazy: `✅ Postgres migrations complete`. Drugi: `Applying migrations: 0`, `✅ Postgres migrations complete`. Nie utworzono migracji, więc `day161-fresh-migration-check.sh` nie jest bramką nowej migracji tego dyżuru.

## Artefakty poza repo

- `/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-http-db-evidence.json` — `71a4dd1dacbd52005e917cdf1fff79242f606042464202a38c1e3868910d23c3`
- `/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-vitest-r1-r4.json` — `4e364ec3ac17d91b19d6f3666f03aae9582afa075cc06889a5baa1c963b19770`
- `/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-vitest-mutant-red.json` — `a37151fb77ed88b7bb7d18c24d4327f1b5ba99f5efe1ab2fd528dc339d6478f5`

## Korekty wobec instrukcji

1. Z7 mówi `5006 i 5007`; tabela licencji mówi `5004 i 5005`, równocześnie opisując `5004-5005` jako zajęte przez 166. Wybrano bezpieczniejsze i nadrzędne Z7: `5006-5007`; runtime nie był potrzebny.
2. Instrukcja oczekiwała, że server config może być naprawiony przez 167; marker poprzedza merge 167, więc `server/vitest.config.ts:17` nadal przypina sqlite. Zmierzono i opisano obejście w samym licencjonowanym teście, bez zmiany configu.
3. `§0.4a` jest przywołany, ale nie istnieje w 960-liniowym dokumencie. Podano rzeczywisty mianownik nowego pakietu i pełne nazwy, bez zgadywania.
4. Minimalny poprawny wg opcjonalnego Zod payload OKR Programu daje `500` przez nadpisanie defaultów `undefined`; pełny payload działa. To wynik, nie naprawa w terytorium 169.

## TWIERDZENIA NIEZWERYFIKOWANE

- Stan polityk KPI/ROI/OKR w istniejących organizacjach demo/staging/produkcja: **NIEZWERYFIKOWANY** — połączenie jest zakazane.
- Czy ręczny seed był uruchamiany dla którejkolwiek konkretnej istniejącej organizacji: **NIEZWERYFIKOWANY**.
- Runtime pełnego `server/src/index.ts`: **NIE URUCHAMIANO**; dowód dotyczy realnego montażu `ApiGateway` zgodnie z Z22.
- Osobny realny przebieg endpointu publikacji ROI: **NIE MIERZONO**; istnienie publishera potwierdzono kodem, nie opisano go jako runtime VERIFIED.

## Licencja i rozłączność

Zmiany produkcyjne wyłącznie w trzech licencjonowanych plikach KPI, plus licencjonowany test i ten raport. Zero zmian w `server/src/services/resultsVnext/okr/**`, `server/src/services/resultsVnext/roi/**`, middleware, configach i migracjach.
