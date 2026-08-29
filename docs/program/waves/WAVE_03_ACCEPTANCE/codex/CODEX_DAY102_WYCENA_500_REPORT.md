# CODEX DAY 102 — WYCENA — DIAGNOZA HTTP 500

Data: 2026-08-29  
Marker: `8c7a853a6cb82c9b498210049c5487ea033caa9b`  
Gałąź: `codex/day102-wycena-500-20260829`  
Werdykt: **ODTWORZONE I ZDIAGNOZOWANE — realna trasa zwraca HTTP `500` w `3 z 3` prób. Defekt nie został naprawiony.**

## 1. Związanie środowiska

Wynik §0.1(2), dosłownie (końcowy fragment):

```text
2005981340 docs(day96): record blocked canvas acceptance evidence
8c7a853a6c docs(day95,96,97,99): armia SPEC-A — odbior artefaktow i kreatorow wg DoD 18.1
188cb75f5b docs(ledger): DEC-331..332 — straznik rozluzniony, Kanban naprawiony, znalezisko o granulacji
MARKER OK
```

Wynik §0.1(7), dosłownie:

```text
8c7a853a6cb82c9b498210049c5487ea033caa9b
```

`git status --short | head -3` nie wypisał linii. Dysk: `46 GiB` wolne przy progu `5 GiB`. Porty `5985`, `4866`, `4867`: `0 z 3` zajętych. Tip gałęzi bazowej wyprzedza marker; lista commitów i plików została zmierzona przed pracą. Worktree powstał dokładnie z markera, bez rebase.

## 2. Baza, migracje, fixture i Z30

- kontener: `cx-day102-pg`, obraz `pgvector/pgvector:pg16`, `127.0.0.1:5985`;
- baza: `consultify_w3_finance_owner_day102`;
- migracje: pierwszy przebieg PASS, readback `863 z 863`; drugi przebieg PASS, `Applying migrations: 0`;
- PDF: `/Users/piotrwisniewski/Developer/consultify-fixtures/finance-owner-source.pdf`, SHA-256 `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`;
- fixture: `2 z 2` testów PASS, `6 z 6` sprawozdań, zachowany manifest i baza;
- punkt wejścia ustalony przed uruchomieniem: `server/scripts/run-wave3-finance-owner-review.ts:44-63`. Wrapper działa na już istniejącej, zmigrowanej bazie. `seed-wave3-finance-owner-review.ts seed` nie jest właściwy w tym układzie, ponieważ `:269` odrzuca istniejącą bazę.

W1: oba kandydaty są w `server/scripts/`. W2: wrapper uruchamia pakiet owner-acceptance; fixture tworzy OWNER i organizację. W3: wrapper wymaga nazwy `consultify_w3_finance_owner_*` w `run-wave3-finance-owner-review.ts:27-34`. W4: bramki G00–G20 zmierzono przed zmianą wiersza modułu.

Dowody Z30 przed zapisem:

```text
BRAK ZMIENNYCH POCZTY
BRAK TRAFIEN
 key | left
-----+------
(0 rows)
```

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## 3. B.2 — odtworzenie realnego HTTP 500

Nowy czerwony kontrakt montuje `ApiGateway.getInstance().initializeRoutes(app)`, podpisuje JWT dla trwałego OWNER, przechodzi przez `verifyToken`, używa realnego PostgreSQL i woła:

```text
POST /api/v8/finance-v2/valuation/variants/e2ac7ef3-d27e-464f-8aef-af3f4721fbf1/compute/dcf
```

Handler: `server/src/routes/v8/finance-v2/valuation.routes.ts:582-646`. Montaż: `server/src/Gateway.ts:1481-1482` → `server/src/routes/v8/index.ts:116` → `server/src/routes/v8/finance-v2/index.ts:90`.

Wynik trzech prób, dosłownie:

```text
DAY102_ATTEMPT_1 {"status":500,"body":{}}
DAY102_ATTEMPT_2 {"status":500,"body":{}}
DAY102_ATTEMPT_3 {"status":500,"body":{}}
```

Werdykt K3: **ODTWORZONE, `3 z 3` HTTP 500, body `{}` w `3 z 3`.**

## 4. B.3 — realny wyjątek i przyczyna

Tymczasowe logowanie bezpośrednio wokół `runDcfFcffValuation()` ujawniło w każdej z `3 z 3` prób:

```text
error: finance_valuation_wacc_inputs: parent business_version
e2ac7ef3-d27e-464f-8aef-af3f4721fbf1 is APPROVED and immutable;
UPDATE not permitted
code: P0001
where: PL/pgSQL function finance_valuation_wacc_inputs_enforce_parent_immutability()
```

Łańcuch przyczyny:

1. Fixture ma wersję `APPROVED / CURRENT` (`1 z 1` readback).
2. Handler wywołuje `runDcfFcffValuation()` w `valuation.routes.ts:627`.
3. Compute bez direct assumptions zawsze wywołuje `persistComputedWacc()` w `valuationComputeService.ts:547-559`.
4. `persistComputedWacc()` wykonuje `UPDATE finance_valuation_wacc_inputs` w `valuationWaccService.ts:217-229`.
5. Trigger niezmienności zatwierdzonego rodzica prawidłowo odrzuca ten UPDATE kodem `P0001`.

To **nie jest** `JSON.parse` na kolumnie `json`: wyjątek powstaje przed publikacją DCF, na jawnym SQL `UPDATE` WACC.

Miejsce utraty diagnostyki: `asyncHandler.ts:19-21` wykonuje `.catch(next)`. W wymaganym wąskim harnessie po `ApiGateway.initializeRoutes(app)` nie ma terminalnego czteroargumentowego error middleware, więc wyjątek trafia do domyślnej obsługi Express; Supertest raportuje status `500`, a parsowane `body` jest `{}`. Pełny `errorHandlerMiddleware` istnieje osobno w `ErrorHandler.ts:156-269`, ale nie jest częścią `ApiGateway.initializeRoutes()`.

Tymczasowa zmiana została cofnięta przez `cp` z `/private/tmp/cx-day102-wycena500-scratch/valuation.routes.ts.before-day102-log`. `git diff -- server/src/routes/v8/finance-v2/valuation.routes.ts` po cofnięciu: **0 linii**.

## 5. B.4 — czerwony kontrakt, bez naprawy

Plik: `server/src/routes/v8/finance-v2/__tests__/day102-valuation-gateway-500.realpg.test.ts`.

Nagłówek: `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`.  
Pełna nazwa: `Dyżur 102 — realna trasa wyceny przez ApiGateway KONTRAKT DLA DYŻURU 102 — trzy realne żądania DCF nie mogą kończyć się HTTP 500`.

Końcowy przebieg z pełnym env i `--retry=0`: `1 z 1` testów FAIL, `1 z 1` nazw FAIL, exit `1`. Oczekiwano `200` z `data`; otrzymano `500 {}` w `3 z 3` prób.

Pułapki Z33:

- (a) `ENABLE_V8_GLOBAL=true`; dowód: żądanie dotarło do handlera i stosu DCF, a nie do `V8_DISABLED`;
- (b) Results visibility nie leży na ścieżce, ale ustawiono fail-closed `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`;
- (c) root config nadpisał pierwszą próbę na SQLite. Pakiet przywraca `DB_TYPE=postgres` wyłącznie przy pełnym `RUN_DB_TESTS=1`, `MOCK_DB=false` i postgresowym URL; pierwsza asercja oraz `DB_IDENTITY … 127.0.0.1:5985/consultify_w3_finance_owner_day102` dowodzą realnego PG;
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; podpisany JWT przeszedł `verifyToken`;
- (e) fixture utworzyła trwałego OWNER i aktywne membership; readback pokazał `2 z 2` aktorów samego tenanta.

Naprawy nie wprowadzono zgodnie z Z40. Rekomendacja dla nadzorcy: osobno zdecydować, czy ponowne compute zatwierdzonej wersji ma być odrzucone kontrolowanym 409/422 przed zapisem, czy ma tworzyć nową working revision. Nie wolno omijać triggera niezmienności.

## 6. Korekty wobec instrukcji

1. Blok wklejki podał marker `188cb75f…`, instrukcja `8c7a853a…`. Właściciel rozstrzygnął, że wiążąca jest instrukcja; start nastąpił z `8c7a853a…`.
2. Z7 wymienia tylko `4866`; właściciel rozstrzygnął lukę szablonu: para runtime to `4866/4867`. Runtime nie był potrzebny i nie został uruchomiony.
3. §B.1 mówi „kontener i migracje, potem seeder”, natomiast `seed-wave3-finance-owner-review.ts seed:269` wymaga nieistniejącej bazy. Bezpiecznie użyto wrappera `run-wave3-finance-owner-review.ts`, przeznaczonego dla już zmigrowanej bazy.
4. Instrukcja mówi, że `DB_TYPE=postgres` w linii komendy nadpisuje root config. Pomiar nr 1 dał `Received: sqlite`; zgodnie ze znanym mechanizmem ustawiono wartość wewnątrz pakietu dopiero po walidacji pełnego lokalnego env.
5. Z15 wymaga zero ścieżki LLM. Seeder uruchomił `statement.mapping.llm_*`, zakończone `no_provider_available`; brak dowodu zewnętrznego wywołania, ale fixture nie jest zaliczona jako czysty dowód Z15. Nie powtórzono seedera.
6. Instrukcja odwołuje się do nieistniejącego §0.4a. Pomiar własny: zmienione pliki produkcyjne `0 z 0`; uruchomione pliki dowodowe `1 z 1` i dokładnie jedna pełna nazwa testu, oczekiwany czerwony wynik.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano zachowania pełnego `server/src/index.ts` z zamontowanym globalnym error handlerem, ponieważ dyżur nie wymagał zrzutów, a Z30 zabrania jego uruchamiania na potrzeby testów.
- Nie zweryfikowano właściwej decyzji produktowej dla ponownego compute wersji `APPROVED`: kontrolowany błąd czy utworzenie nowej revision. Tego konkretnie zabrakło, aby bez decyzji właściciela zaprojektować naprawę.
- Nie zweryfikowano runtime `4866/4867`, ponieważ rdzeń został w pełni udowodniony przez wymagany realny `ApiGateway` i lokalny PostgreSQL.
- Nie zweryfikowano żadnego zewnętrznego dostawcy LLM; po wykryciu wejścia seedera w ścieżkę LLM nie wykonano kolejnej próby.

## 8. Kryteria K1–K8

| Kryterium | Stan |
| --- | --- |
| K1 entrypoint seedera przed uruchomieniem | PASS — `run-wave3-finance-owner-review.ts:44-63` |
| K2 realny ApiGateway | PASS — `3 z 3` realnych żądań |
| K3 werdykt | **ODTWORZONE** |
| K4 wyjątek i miejsce | PASS — PostgreSQL `P0001`, WACC UPDATE pod `APPROVED` |
| K5 logowanie cofnięte | PASS — `0` linii diffu w `valuation.routes.ts` |
| K6 czerwony kontrakt | PASS jako dowód defektu — `1 z 1 FAIL`, `--retry=0` |
| K7 sekcja niezweryfikowanych | PASS — `4` wpisy |
| K8 rozłączność | PASS — raport, jeden wiersz modułu, jeden nowy test, `0` zmian `valuation*.ts` |

## 9. Artefakty poza repo

| Plik | SHA-256 |
| --- | --- |
| `/private/tmp/cx-day102-wycena500-artefakty/migrate-first.log` | `0d43e5f66c39f33e939ceb6bcb2e1dbdc10c27a8ea09d6a7269fb9a3dfd87529` |
| `/private/tmp/cx-day102-wycena500-artefakty/migrate-second.log` | `9af8609f79731b117b18b2963e10f6cea1f9ebe003b65ef9f7be2547dfff464a` |
| `/private/tmp/cx-day102-wycena500-artefakty/finance-seed.log` | `7ff9c3d9b42bddd3f1c8ffcfb805ea2f2db658c94ed9719ded2becd45113a335` |
| `/private/tmp/cx-day102-wycena500-artefakty/finance-fixture-manifest.json` | `9f2a73d16e21e7ce51bbd6e2c604e0f4d9fd873d3f758f20692c0b17b41111d0` |
| `/private/tmp/cx-day102-wycena500-artefakty/day102-gateway-red-http.log` | `cfe00e6d76b52d7abf73ff2ced7a4081ad5cebe307be7717c2caad047c126006` |
| `/private/tmp/cx-day102-wycena500-artefakty/day102-gateway-exception.log` | `d2f4234eb47c954369d112689cd0f7ce7a9e3622a1b1513c46be5797277570be` |
| `/private/tmp/cx-day102-wycena500-artefakty/day102-red-final.json` | `4ba361ed3c0d63062631d915be28fb805abca91cc5d50a9c82f5e018cc6ceef1` |

## 10. Sprzątanie

Po pierwszym commicie i pushu usunięto wyłącznie własny kontener poleceniem `docker rm -fv cx-day102-pg`; wynik: `cx-day102-pg`, a kontrola katalogu kontenerów zwróciła `0`. Porty `5985`, `4866` i `4867` po sprzątaniu: `0 z 3` procesów nasłuchujących. Nie wykonano żadnego połączenia do Railway, demo, stagingu ani produkcji.
