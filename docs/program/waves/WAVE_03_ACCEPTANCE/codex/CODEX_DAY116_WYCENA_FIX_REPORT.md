# CODEX DAY116 — WYCENA: KONTROLOWANA ODMOWA DLA ZATWIERDZONEJ WERSJI

Data: 2026-08-29  
Gałąź: `codex/day116-wycena-fix-20260829`  
Marker instrukcji: `eecf2c1dae434bb1f1fb68a72094825e317bc5ea`  
Commit rdzenia: `cea938d31185ce026266afa0fd33c42a11ec348c`  
Werdykt: `BACKEND_FIXED_MUTATION_VERIFIED / UI_MESSAGE_NOT_PROPAGATED / PARTIAL`

## 1. Tożsamość, marker i rozjazd tipa

Wiążący marker pochodzi z wydanej instrukcji, nie z wklejki operatora.

```text
git log --oneline -25 github-backup/codex/m03-admin-20260824
332fa1c161 docs(day114-117): FALA NAPRAWCZA 1 + naprawa pulapki .gitignore u zrodla
eecf2c1dae merge: dyzur 111b Administracja — 12 z 20 semantycznie, AI Policy 0 z 4
...

git merge-base --is-ancestor eecf2c1dae434bb1f1fb68a72094825e317bc5ea github-backup/codex/m03-admin-20260824
MARKER OK

git -C /private/tmp/cx-day116-wycena-fix rev-parse HEAD
eecf2c1dae434bb1f1fb68a72094825e317bc5ea

git -C /private/tmp/cx-day116-wycena-fix status --short | head -3
<brak wyjścia>
```

Dysk: `40Gi` wolne. Porty `5998`, `4896`, `4897`: `lsof` RC `1`, czyli wolne. Tip uciekł do przodu o sześć commitów; praca rozpoczęła się dokładnie z markera.

## 2. Baza, migracje i fail-closed poczty

- Kontener: `cx-day116-pg`, obraz `pgvector/pgvector:pg16`, bind wyłącznie `127.0.0.1:5998`.
- Baza: `consultify_w3_finance_owner_day116`.
- Migracje: pierwszy pełny przebieg zakończony `Postgres migrations complete`; drugi: `Applying migrations: 0`; niezależny licznik `863`.
- Seeder ma poprawny próg `Number(readback.migrations) < 834` w `server/scripts/seed-wave3-finance-owner-review.ts:238`.
- `env` przed zapisem: `BRAK ZMIENNYCH POCZTY`.
- `settings WHERE key LIKE 'smtp%'`: `0 rows`.
- `Gateway.ts` nie zawiera startu drenaży outboxu.
- Runtime: `DOTENV_DISABLED=1`; proces serwera: `BRAK ZMIENNYCH POCZTY W PROCESIE`; log nie wykazał transportu poczty. Jedyny transportowy wpis dotyczył Slacka i jawnie mówił `No transport configured ... message dropped`.

Deklaracja testowa: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu podczas testów. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

Deklaracja zrzutów: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.**

## 3. Weryfikacja wejścia i korekty

- W1: dokładna ścieżka to `POST /api/v8/finance-v2/valuation/variants/:businessVersionId/compute/dcf` → `runDcfFcffValuation()` → `persistComputedWacc()` → `UPDATE finance_valuation_wacc_inputs`.
- Trigger na tej tabeli zwraca `P0001`: `parent business_version ... is APPROVED and immutable; UPDATE not permitted`.
- W2: właściwy seeder to `server/scripts/seed-wave3-finance-owner-review.ts`; runner: `server/scripts/run-wave3-finance-owner-review.ts`.
- W3: literalny grep instrukcji po `successful_migrations` zwrócił `0` trafień, bo rzeczywiste pole nazywa się `migrations`; realny próg minimum istnieje.
- W4: FIN-PF-015 był `HTTP_500_DIAGNOSED / NOT_FIXED`.

## 4. B.1 — własne odtworzenie defektu

Pierwsze trzy próby na odziedziczonym teście Day102 nie dały ważnego pomiaru produktu: pierwsza uruchomiła `0/0`, dwie następne kończyły `beforeAll` timeoutem. Nie zostały uznane za dowód.

Właściwy kontrakt Day116 został związany z identyfikatorami świeżego manifestu. Po usunięciu naprawy:

```text
DAY116_ATTEMPT_1 {"status":500,"body":{}}
DAY116_ATTEMPT_2 {"status":500,"body":{}}
DAY116_ATTEMPT_3 {"status":500,"body":{}}
Test Files 1 failed (1)
Tests 1 failed (1)
```

Wynik: defekt odtworzony `3/3` na realnym `ApiGateway`, podpisanym JWT i realnym lokalnym PostgreSQL.

## 5. B.2 — najmniejsza naprawa

Zmiana tylko w `server/src/routes/v8/finance-v2/valuation.routes.ts`:

- przechwytuje wyłącznie `code === 'P0001'` oraz dokładny komunikat triggera WACC dla zatwierdzonego parenta;
- odpowiada `409`, `APPROVED_VERSION_IMMUTABLE`;
- komunikat wyjaśnia przyczynę i zaleca utworzenie nowej wersji;
- pozostałe wyjątki są nadal rzucane;
- trigger, migracje i `persistComputedWacc()` są nietknięte.

Wybrano `409 Conflict`, ponieważ poprawne składniowo żądanie koliduje z aktualnym, zatwierdzonym i niezmiennym stanem zasobu.

Kontrakt Day102 z oczekiwaniem `200` jest semantycznie błędny dla zatwierdzonej wersji. Poprawnym kontraktem jest odmowa `409`, nie sukces `200`; nowy test Day116 zapisuje ten kontrakt bez modyfikowania odziedziczonego pliku Day102 poza licencją.

## 6. B.3 — dowód mutacyjny w obie strony

Komplet env stał w tej samej linii każdego przebiegu: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5998/consultify_w3_finance_owner_day116 JWT_SECRET=...`; runner: katalog `server`, `--config vitest.config.ts`, `--retry=0`.

RED — obsługa wyjątku usunięta, test bez zmian:

```text
DAY116_ATTEMPT_1 {"status":500,"body":{}}
DAY116_ATTEMPT_2 {"status":500,"body":{}}
DAY116_ATTEMPT_3 {"status":500,"body":{}}
AssertionError: expected status 409, received 500
```

GREEN — plik przywrócony przez `cp`:

```text
DAY116_ATTEMPT_1 {"status":409,"body":{"error":"This valuation version is approved and cannot be changed. Create a new version to recompute WACC.","code":"APPROVED_VERSION_IMMUTABLE"}}
DAY116_ATTEMPT_2 {"status":409,"body":{"error":"This valuation version is approved and cannot be changed. Create a new version to recompute WACC.","code":"APPROVED_VERSION_IMMUTABLE"}}
DAY116_ATTEMPT_3 {"status":409,"body":{"error":"This valuation version is approved and cannot be changed. Create a new version to recompute WACC.","code":"APPROVED_VERSION_IMMUTABLE"}}
Test Files 1 passed (1)
Tests 1 passed (1)
```

Test wykonuje niezależny `SELECT wacc_computed_pct, beta_relevered, updated_at` przed i po trzech żądaniach; readback jest identyczny. Po przywróceniu utrwalonej naprawy:

```text
git diff --exit-code -- server/src/routes/v8/finance-v2/valuation.routes.ts
ROUTE_DIFF_RC=0
git status --short
<brak wyjścia>
```

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) ustawiono `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, choć ten strażnik nie leży na trasie Finance; (c) `DB_TYPE=postgres` potwierdzony asercją w pierwszym hooku i logiem `DB_IDENTITY ... 127.0.0.1:5998`; (d) `ENABLE_TEST_AUTH_BYPASS=false`, żądanie niesie podpisany JWT; (e) puste ciało przy RED jest artefaktem harnessu bez końcowego error middleware, ale kod `500` jest realny.

## 7. B.4 — regresja po pełnych nazwach

Sąsiedni pakiet `valuation.routes.pg.test.ts` uruchomiono bez i z naprawą, `--retry=0`, JSON poza repo.

```text
BEFORE: success=true, 15/15 passed
AFTER:  success=true, 15/15 passed
diff -u <pełne nazwy + statusy>: <brak wyjścia>
delta nazw/statusów: 0
```

Serwer `npm run typecheck`: PASS, exit `0`.

## 8. B.5 — zrzuty i granica konsumenta

Kanoniczny runtime na `cea938d31185`, serwer `4896`, klient `4897`, baza `5998`: health/ready/frontend `200/200/200`, migracje `ok`, marker klienta i SQL zweryfikowane, auth bypass `false`.

Po akcji `Compute DCF` backend zwraca kontrolowane `409`, ale frontend `useFinanceRowActions.ts` nadal redukuje błąd do generycznego toastu `DCF computation failed`. To plik poza licencją Z40. Z tego powodu wykonano i obejrzano `2/4` zrzutów po zmianie; uczciwy wizualny before/after z czytelną zmianą nie istnieje.

```text
41b7bd8f013b66e0348ccd112e339efb0c0a88bf4e78c7e4d68af5dba0df5675  /private/tmp/cx-day116-wycena-fix-artefakty/day116-after-dark-generic-toast.png
6d64f33188eaabefc8fe05367e75a58c352617fc4696c9e4a5b1a00718e25450  /private/tmp/cx-day116-wycena-fix-artefakty/day116-after-light-generic-toast.png
```

K5: `PARTIAL 2/4`; nie wpisano pełnego odbioru wizualnego.

## 9. Artefakty

```text
26f629a8b966dbbb6728030122fc1d6ad72ce827b83fee83965dfa2714a9f82f  day116-mutation-red.log
677dba8148a32708520b8fd0b784d684ff35c1a75df09f6c63c4be20a747d20e  day116-mutation-green.log
e8e0ae086256ce5481abe6ef8b835a651fb900092677ac4dcf82d76aea31afe5  day116-regression-before.json
67f23e54a97e08b4104c382df37a2409978a0f23aff755154a509cd0b76e7c1e  day116-regression-after.json
07de6e4df02a4f20846f0111702647a9a07d268114e2b51c4366a15f36ef2816  server-typecheck.log
677716fe751376027a946e2fe0cc33f762b8e472b0ea5f610524ff907252d70c  finance-fixture.json
```

## 10. Korekty wobec instrukcji

1. Wklejka podawała marker `332fa1c161`; wydana instrukcja podaje `eecf2c1dae...`. Zastosowano marker instrukcji.
2. Instrukcja nazywa `332fa1c161` pojedynczym nowszym tipem, lecz po fetchu nad nim było łącznie sześć commitów; start pozostał na markerze.
3. Sekcje odwołują się do nieistniejących `§0.4a` i „tabeli licencji”. Zastosowano literalny Z40 i §D, bez poszerzenia produktu.
4. Seeder podczas fixture'u wszedł w zastaną ścieżkę logów `llm_*`, mimo Z15. Provider nie dostarczył wyniku, ale samo wejście jest rozbieżnością harnessu; seedera nie zmieniono.
5. Test Day102 ma twardy hook timeout 10 s i historyczne UUID-y; na świeżym fixture nie jest samodzielnym kontraktem Day116.
6. Backendowa odmowa jest czytelna w API, lecz frontend jej nie propaguje. Werdykt obniżono do `PARTIAL`.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

- Niezweryfikowane: pełne `4/4` zrzuty before/after; dostępne i obejrzane jest `2/4` po zmianie.
- Niezweryfikowane: owner acceptance komunikatu; UI nie pokazuje jeszcze tekstu backendu.
- Niezweryfikowane: cały korpus testów repozytorium; zmierzono kontrakt Day116, sąsiedni pakiet `15/15` i server typecheck.
- Niezweryfikowane: brak jakichkolwiek inicjalizacji modułów AI podczas montażu całego Gateway; log pokazał inicjalizację circuit breakerów i tras AI, choć kontrakt Finance nie wywołał modelu.

## 12. Pliki i sprzątanie

Do commita rdzenia weszły wyłącznie:

```text
server/src/routes/v8/finance-v2/valuation.routes.ts
server/src/routes/v8/finance-v2/__tests__/day116-approved-valuation-wacc-conflict.realpg.test.ts
```

Dokumentacja: ten raport oraz jeden wpis FIN-PF-015. Runtime zatrzymany; własne grupy procesów zweryfikowane jako zakończone; porty `4896/4897` wolne. Kontener i baza pozostają do momentu końcowego commita dokumentacji, po czym zostaną usunięte przez `docker rm -fv cx-day116-pg`.
