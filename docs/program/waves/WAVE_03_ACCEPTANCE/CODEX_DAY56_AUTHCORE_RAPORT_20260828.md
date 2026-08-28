# Raport dyżuru 56 — rdzeń uwierzytelniania

## Marker i baza

- Baza: `github-backup/codex/m03-admin-20260824`.
- Marker związany: `b3179d0a52603f62b5cd3673caa754c8fc3b0055`.
- `merge-base --is-ancestor ...` → `MARKER OK`.
- `rev-parse HEAD` po utworzeniu worktree → `b3179d0a52603f62b5cd3673caa754c8fc3b0055`.
- Worktree: `/private/tmp/consultify-authcore-day56`; gałąź: `codex/authcore-day56-20260828`.
- Wolne miejsce przed startem: 8.6 GiB; port 5856: `WOLNY`.

## Weryfikacja stanu wejściowego

1. `organizationContextGuard.ts`: BRAK; liczba odwołań: 0.
2. Pięć furtek potwierdzono w `auth.middleware.ts:1682-1758`.
3. Cztery kotwice potwierdzono w liniach 2698, 2716, 2735 i 2779 właściwego pliku testowego.
4. Błędna ścieżka `server/src/middleware/__tests__/auth.middleware.test.ts`: BRAK; właściwy plik: 2857 linii.
5. `optionalAuth`: 5 trafień tekstowych, 4 pliki, dokładnie 1 realny montaż (`share.routes.ts:474`). Dodatkowe piąte trafienie to martwy import w `legal.routes.ts:17`.
6. `attachUser`: 8 odmów bez rzutu; `optionalAuth` łapie tylko wyjątki.
7. Egzekutor bezczynności: 0 trafień; `checkTokenRevocation` jest przed `trackSessionActivity`.
8. Wzorzec ścisłego członkostwa eksportuje trzy strażniki w liniach 146, 157, 168.
9. `ENABLE_TEST_AUTH_BYPASS` omija `verifyToken` w linii 1238.

## BLOK 0

- Kontener: `cx-day56-pg`, lokalny port `127.0.0.1:5856`, baza `cx_day56`.
- Pełny pierwszy przebieg: 858 migracji; drugi przebieg: 0 migracji, sukces.
- `user_sessions` ma `created_at`, `last_active_at`, `last_activity_at`, `is_active`, `token_jti`.
- `revoked_tokens` ma `jti`, `user_id`, `expires_at`, `revoked_at`, `reason`.
- `organization_members` ma unikalną parę `(organization_id,user_id)` i role ograniczone do OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST.
- `organization_settings.setting_value` jest typu `text`.
- Migracja day56: nie jest obecnie potrzebna; przedział pozostaje `20261570-20261579` wyłącznie.
- Dowód Z30: `server/src/services/emailService.ts:179-219` wysyła realnie tylko przy jednoczesnym `smtpConfig.host` i użytkowniku; środowisko nie zawiera żadnej nazwy `SMTP_*`, a niezależny odczyt lokalnej bazy `SELECT count(*) FROM settings WHERE key LIKE 'smtp_%'` zwrócił `0`. Dostawca pozostaje `Mock (Console)` i realna wysyłka jest niemożliwa w tym środowisku.

## Korekty wobec instrukcji

- Teza o 4 trafieniach tekstowych `optionalAuth` jest SPROSTOWANA: własny pomiar dał 5 trafień, ponieważ instrukcja pominęła martwy import w `legal.routes.ts:17`. Mianownik realnych montaży nadal wynosi 1.
- Skan trójkropkowy wykazał poza gałęzią 37 również `github-backup/fix/elkomtech-interview-dom-20260827` dotykającą `auth.middleware.ts`. Nie przejmuję tej gałęzi; ryzyko scalenia pozostaje jawne.
- Związany marker daje 426 plików różnicy stanów marker→37 i 324 commity markera od merge-base, nie 321/322.
- Wymóg P.8 „zero nowych zapytań przy braku polityki” koliduje z brakiem preloadu: samo ustalenie braku wpisu wymaga jednego SELECT. Zastosowano 1 zapytanie bez polityki i 2 z polityką.
- Tezy erraty 1–14 potwierdzono co do zachowania, z korektą tezy 12 do 5 trafień tekstowych/1 montażu. Tezę 15 potwierdzono co do merge-base i 11 plików, ale obalono aktualne liczby różnicy stanów/commitów.

## §P.1 — inwentarz furtek, kotwic i mianowników

| furtka                     | osiągalność                                                                            |    promień | kotwica                               | wzorzec                         |
| -------------------------- | -------------------------------------------------------------------------------------- | ---------: | ------------------------------------- | ------------------------------- |
| 1682-1685, catch akcesorów | MARTWA w obecnym kodzie: `safeRead` połyka rzuty; sonda nie zapaliła się w 174 testach | 18 montaży | brak                                  | fail-closed w strict membership |
| 1687-1689, brak user/org   | ŻYWA; dwie kotwice getterów trafiają tutaj                                             |         18 | 2698, 2716                            | strict membership               |
| 1690-1694, setter org      | osiągalna w testach; sonda zapaliła się 2 razy; brak produkcyjnego `defineProperty`    |         18 | 2779                                  | strict membership               |
| 1718-1739, cache 60 s      | ŻYWA; brak produkcyjnego unieważnienia                                                 |         18 | brak (test 2561 dotyczy tylko klucza) | bezcache'owy strict membership  |
| 1750-1758, błąd DB         | ŻYWA                                                                                   |         18 | 2735                                  | fail-closed strict membership   |

Mapowanie kotwic udowodniono sondami `PROBE-1682` i `PROBE-1690`: tylko `PROBE-1690` wystąpiła (2 razy), pakiet zakończył się `174/174 PASS`; po przywróceniu kopii `git diff` był pusty.

Mianowniki:

- `optionalAuth`: 4 pliki wspominające symbol; 1 realny montaż — wiążące: 1.
- `validateOrgMembership`: 17 plików; 8 `router.use`, 10 surowych trafień per-trasa minus 3 importy = 7 montaży, 3 montaże w Gateway; wiążące: 18.
- Gateway: 360 `app.use(`, 336 z literalną ścieżką, 37 `mountStub`, 20 z `gatewayVerifyToken`.
- `verifyToken`: 2117 trafień bez testów, 2401 z testami.

Baseline PRZED: 79 plików, 1720 PASS / 2 FAIL / 65 SKIPPED. Czerwone:

1. `tests/unit/auth/auth.middleware.private.test.ts :: auth.middleware private helpers mapRole maps superadmin to owner`
2. `tests/unit/backend/middleware/rateLimiting.middleware.test.ts :: rateLimiting.middleware (L1) fails open to next when Date.now throws during limiter evaluation`

Pięć kształtów fałszywego gotowe dla P.1: wołacze policzone — TAK; realny ApiGateway — NIE, pozycja inwentarzowa zwolniona; skipped policzone — TAK (65); pary HTTP — NIE, pozycja inwentarzowa zwolniona; dowód wyłącznie grep — TAK, bez twierdzenia o działaniu runtime.

TWIERDZENIE NIEZWERYFIKOWANE P.1: rzeczywiste kody HTTP wszystkich 18 montaży nie zostały jeszcze zmierzone.

## §P.2 — rozliczenie czterech kotwic

Wszystkie cztery kotwice mają werdykt `PRZEPISANA`; asercje zostały wzmocnione z przepuszczenia do jawnej odmowy:

1. Stare: `fails open when membership context accessor throws`, brak statusu i `next()`. Nowe: `refuses when membership context accessor throws`, `403`, kod `ORG_CONTEXT_REQUIRED`, brak `next()`. Test kanonizował przepuszczenie przy nierozstrzygniętym kontekście; decyzja P.3 wymaga odmowy dla zalogowanego użytkownika bez organizacji.
2. Stare: `fails open when req.organizationId getter throws during normalization`, brak statusu i `next()`. Nowe: `refuses when req.organizationId getter throws during normalization`, `403`, kod `ORG_CONTEXT_REQUIRED`, brak `next()`. To ta sama furtka 1687 co w pkt 1, więc werdykt jest identyczny.
3. Stare: `logs and fails open when membership DB lookup fails`, brak statusu i `next()`, log `ORG_MEMBERSHIP_LOOKUP_FAIL_OPEN`. Nowe: `logs and refuses when membership DB lookup fails`, `503`, kod i log `ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE`, brak `next()`. Niedostępność magazynu autoryzacji nie może poszerzać dostępu; 503 odróżnia awarię od braku uprawnienia.
4. Stare: `fails open when assigning normalized organizationId throws`, brak statusu i `next()`. Nowe: `refuses when assigning normalized organizationId throws`, `403`, kod `ORG_CONTEXT_REQUIRED`, brak `next()`. Test ręcznie tworzy setter, ale gdy taka ścieżka wystąpi, bezpiecznym wynikiem jest odmowa.

Po P.2 dokładnie cztery nowe testy są celowo czerwone: oba `refuses ... getter/context accessor` mają zazielenić się w P.3, setter w P.6, a błąd DB w P.5. Każda inna nazwa: brak.

Pięć kształtów fałszywego gotowe dla P.2: wołacz — NIE, pozycja test-only; ApiGateway — NIE, jawne zwolnienie; skipped — 0 w tym pliku; pary HTTP — NIE, będą w pozycjach produkcyjnych; grep jako runtime — NIE, nie formułuję twierdzenia runtime.

## §P.6 — dwie gałęzie akcesorów

- 1682: `MARTWA — USUWAM`. Wszystkie odczyty były opakowane w `safeRead`, a normalizacja nie rzuca. Sonda nie wystąpiła w 174 testach; usunięto nieosiągalny zewnętrzny `try/catch`.
- 1690: `ŻYWA — ZAMYKAM`. Sonda wystąpiła dwa razy w teście z ręcznym setterem; grep produkcji nie znalazł setterów `organizationId/userId`. Gdy przypisanie mimo to zawiedzie, odpowiedź to `403 ORG_CONTEXT_REQUIRED`, bez `next()`.

Po P.6 test setter jest zielony. Trzy celowe czerwone P.2 pozostają: dwa dla P.3 oraz błąd DB dla P.5. Pełny zakres ma 5 czerwonych nazw: dwie zastane i trzy celowe; żadnej innej.

Pięć kształtów fałszywego gotowe dla P.6: wołacz — TAK, funkcja ma 18 montaży; ApiGateway — NIE, brak jeszcze pełnej pary HTTP, dlatego werdykt końcowy pozostaje CZĘŚCIOWO do czasu dowodu integracyjnego; skipped — rozliczone w baseline; odmowa runtime — NIEZWERYFIKOWANA HTTP; grep nie jest uznany za dowód runtime.

## §P.3 — brak kontekstu organizacji

Wybrano wariant W2: brak rozstrzygniętego użytkownika nadal przechodzi (anonimowość nie jest sprawą strażnika członkostwa), natomiast rozpoznany użytkownik bez organizacji dostaje `403 ORG_CONTEXT_REQUIRED`. W1 odrzucono jako zbyt szeroki dla anonimów, W3 nie różni się praktycznie na jawnych montażach tenantowych, W4 pozostawiałby znaną furtkę. Publiczny `/api/share/:token` używa jedynie `optionalAuth`, nie `validateOrgMembership`, więc zmiana nie tworzy regresji gałęzi 37.

Pakiet jednostkowy: 173 PASS / 1 celowy FAIL należący do P.5; obie kotwice getterów P.2 zazieleniły się. Pełna tabela HTTP dla 18 montaży nie została jeszcze wykonana, dlatego pozycja pozostaje `CZĘŚCIOWO`, mimo wdrożonego fail-closed.

Pięć kształtów fałszywego gotowe dla P.3: wołacz — TAK (18 montaży); ApiGateway — NIE; skipped — 0 w pakiecie punktowym; para HTTP — NIE; grep — tylko dowód montażu, nie runtime.

## §P.4 — cache pozytywnego członkostwa

Wybrano K1: brak cache członkostwa. K2 odrzucono, bo negatywny cache opóźniałby legalne przywrócenie dostępu; K3 wymagałby wołaczy poza licencją i nadal był podatny na pominięcie; K4 jedynie skracałaby okno podatności. Produkcyjne unieważnienie nie istniało — jedynym czyszczeniem był helper testowy.

Koszt statyczny zmiany to jedno indeksowane zapytanie po unikalnej parze `(organization_id,user_id)` na każde żądanie przechodzące przez jeden z 18 montaży. Pomiar runtime liczby zapytań i para HTTP ACTIVE→REVOKED→ACTIVE nie zostały jeszcze wykonane, więc pozycja jest `CZĘŚCIOWO`.

Pakiet jednostkowy po zmianie: jedynym czerwonym jest celowy kontrakt P.5. Pięć kształtów: wołacz — TAK; ApiGateway — NIE; skipped — 0; para HTTP — NIE; grep nie jest uznany za dowód runtime.

## §P.5 — błąd magazynu członkostwa

Werdykt: `ODMAWIAM 503`. 403 sugerowałby ustalony brak uprawnienia, podczas gdy awaria magazynu oznacza brak możliwości rozstrzygnięcia; 503 zachowuje fail-closed bez fałszowania przyczyny. Log i koperta używają `ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE`.

Pakiet jednostkowy `auth.middleware.test.ts`: 174 PASS / 0 FAIL; wszystkie cztery kotwice P.2 są zielone. Symulacja używa zastanego publicznego `setDependencies`, nie globalnego mocka. Pełny dowód HTTP i mutacyjny pozostaje niewykonany, więc pozycja jest `CZĘŚCIOWO`.

Pięć kształtów: wołacz — TAK; ApiGateway — NIE; skipped — 0; para HTTP — NIE; grep nie jest uznany za dowód egzekucji.

## §P.7 — optionalAuth

Własny mianownik: 4 pliki wspominające symbol, 5 trafień tekstowych, dokładnie 1 montaż. Wybrano S3 w ograniczonym kształcie: `optionalAuth` przekazuje `attachUser` odpowiedź przechwytującą `status/json/setHeader`; odmowa hydratacji nie wysyła nagłówków ani treści i kończy się anonimowym `next()`. Required auth nadal używa rzeczywistego `res`. S1 odrzucono z powodu zmiany kontraktu ośmiu odmów, S2 wymagałby rozgałęzienia każdej odmowy, S4 pozostawiałby wadę strukturalną.

Pakiet regresyjny `auth.middleware.test.ts` + `auth.middleware.verifyToken.test.ts`: 182 PASS / 0 FAIL. Tabela realnej osiągalności ośmiu odmów i sześć żądań przez ApiGateway pozostają niewykonane, więc werdykt: `CZĘŚCIOWO`.

Martwy import `legal.routes.ts:17` pozostawiono bez zmiany zgodnie z licencją. Pięć kształtów: wołacz — TAK; ApiGateway — NIE; skipped — 0; para HTTP — NIE; grep nie jest uznany za runtime.

## §P.8 — egzekutor bezczynności sesji

Dodano `sessionIdlePolicy.ts` i wywołanie wewnątrz `verifyToken` przed `checkTokenRevocation`. Flaga `SESSION_IDLE_ENFORCEMENT` jest aktywna wyłącznie dla dosłownego `true`, więc domyślnie pozostaje OFF. Polityka istnieje tylko przy dodatnim, liczbowym `security.sessionTimeout`; brak wpisu lub brak pola nie włącza wartości domyślnej. Brak wiersza sesji albo brak `jti` przepuszcza legacy token, ponieważ nie da się uczciwie dowieść bezczynności.

Kontrakt day53 został odtworzony pod własną ścieżką bez naruszenia Z31. Stare: `expect(proof.database).toBe('cx_day53')`. Nowe: `expect(proof.serverVersion).toContain('PostgreSQL')`, po `assertRealPostgresTestEnvironment()` bez argumentów.

Realny pakiet przez `ApiGateway.getInstance().initializeRoutes(app)`: 8 PASS / 0 FAIL / 0 SKIPPED. Obejmuje 401 z polskim komunikatem, aktywną sesję z niezależnym readbackiem, brak polityki, zapis security bez sessionTimeout, brak aktualizacji odrzuconej sesji, token bez jti, flagę OFF i brak wiersza sesji. Regresja jednostkowa: 182 PASS / 0 FAIL.

Dowód mutacyjny: po zmianie warunku egzekutora na `false && ...` test `rejects the first request after the tenant idle threshold` był czerwony (`expected 401, received 200`); po przywróceniu był zielony, a roboczy `git diff` wobec staged P.8 był pusty.

Koszt: flaga OFF = 0 nowych zapytań; flaga ON i brak jawnej polityki = 1 zapytanie ustawień; flaga ON i polityka = 2 zapytania (ustawienia + sesja). Wymóg „zero nowych zapytań, jeżeli organizacja nie ma polityki” jest niewykonalny bez wcześniejszego cache/preloadu, którego instrukcja nie montuje; bez odczytu nie da się odróżnić braku polityki od jej istnienia. Wybrano bezpieczniejszą, uczciwą interpretację i wpisano korektę.

Brakuje wymaganego negatywu tenanta body/query/header, dlatego werdykt P.8 pozostaje `CZĘŚCIOWO`, mimo zazielenienia rdzenia i ośmiu przypadków. Pułapki Z33: (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) test lokalnie przywraca `DB_TYPE=postgres`, a helper dowodzi serwera; (d) `ENABLE_TEST_AUTH_BYPASS=false` w komendzie i asercji.

Pięć kształtów: wołacz — TAK, przed `checkTokenRevocation`; ApiGateway — TAK; skipped — 0; para 200→401 i 200→200 — TAK; grep — nie jest podstawą twierdzenia runtime.

## §P.9 — gałąź 37

Baza wiążąca dla własnej pracy gałęzi 37 to merge-base `3e707a9d3ca8dbe10ea1b2cd6538c9b496770296..98af8945eb`: 11 plików i 11 commitów. Porównanie stanów marker→37 ma 426 plików; marker wnosi 324 commity od merge-base. Liczby instrukcji 321/322 są zatem nieaktualne dla związanego markera.

Ocena 11 plików:

1. Raport day37 — inspiruje opisem regresji share; u mnie rozwiązano ją bez nowej bramki.
2. Instrukcja day37 — źródło kontekstu, bez przejęcia kodu.
3. Test organizationContextGuard — nieużyty, ponieważ plik strażnika nie powstaje.
4. `auth.middleware.ts` — inspiracja zasadą fail-closed, odtworzona własnym kodem i z zachowaniem optionalAuth.
5. `organizationContextGuard.ts` — odrzucony; zakaz utworzenia.
6. assessment-ai route — brak inspiracji dla rdzenia auth.
7. assessment-workflow route — brak inspiracji dla rdzenia auth.
8. enterprise-platform route — brak inspiracji dla rdzenia auth.
9. scim route — brak inspiracji dla rdzenia auth.
10. report-builder route — brak inspiracji dla rdzenia auth.
11. oauthService — brak inspiracji dla rdzenia auth.

Werdykt: `INSPIRACJA WYKORZYSTANA` wyłącznie jako zasada fail-closed; implementacja jest własna, bez merge/cherry-pick/rebase/kopii. Historia od markera to prosta linia ośmiu commitów. Nie powołuję się na niezweryfikowane „+53 czerwone”, więc nie tworzono sondy worktree.

Pięć kształtów: wołacz — NIE, pozycja porównawcza; ApiGateway — NIE, zwolniona; skipped — nie dotyczy; para HTTP — nie dotyczy; grep/diff służy wyłącznie porównaniu historii.

## Pomiar zasięgu testów

PRZED: 79 plików, 1720 PASS / 2 FAIL / 65 SKIPPED. PO: 79 plików, 1720 PASS / 2 FAIL / 65 SKIPPED. Listy czerwonych PRZED i PO są identyczne z listą §P.1. `NOWE CZERWONE (0)`; `NAPRAWIONE (0)`.

Zakres dodatkowy PO: 61 plików, 382 PASS / 14 FAIL / 0 SKIPPED. Nie wykonano odpowiadającego baseline dodatkowego na markerze, więc 14 nazw pozostaje nieprzypisanych i zakres całości deklaruję jako `ZASIĘG CZĘŚCIOWY`. Pełny katalog integracyjny auth: 10 plików, 46 PASS / 15 FAIL / 0 SKIPPED; własny plik day56 ma 8 PASS / 0 FAIL / 0 SKIPPED.

**NIE przepisałem liczb nadzorcy, dyżurów 37/53, autora instrukcji ani z żadnego `MODULE_ACCEPTANCE.md` — zmierzyłem sam.**

## Kontynuacja — domknięcie P.3–P.8

Ta sekcja zastępuje wcześniejsze kwalifikacje `CZĘŚCIOWO` w §P.3–§P.8. Test `tests/integration/auth/day56.authcore-matrices.realpg.test.ts` wykonuje realne żądania przez `ApiGateway.getInstance().initializeRoutes(app)`, używa podpisanych JWT i realnego PostgreSQL. Końcowy przebieg miał `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce SESSION_IDLE_ENFORCEMENT=true`, jawny `DATABASE_URL` i `--retry=0`: **14 PASS / 0 FAIL / 0 SKIPPED**.

### Dokładna macierz HTTP

| pozycja | komórka                                          | dokładny wynik                                  |
| ------- | ------------------------------------------------ | ----------------------------------------------- |
| P.3     | ACTIVE / poprawna organizacja                    | `200`                                           |
| P.3     | REVOKED                                          | `403`, `code=ORG_MEMBERSHIP_REVOKED`            |
| P.3     | inna organizacja                                 | `403`, `code=ORG_CONTEXT_MISMATCH`              |
| P.3     | brak organizacji                                 | `403`, `code=ORG_CONTEXT_REQUIRED`              |
| P.4     | ACTIVE przed zmianą                              | `200`                                           |
| P.4     | ten sam JWT natychmiast po `ACTIVE→REVOKED` w PG | `403`, `code=ORG_MEMBERSHIP_REVOKED`            |
| P.4     | ten sam JWT po `REVOKED→ACTIVE`                  | `200`                                           |
| P.5     | sprawny magazyn                                  | `200`                                           |
| P.5     | wstrzyknięta awaria zapytania membership DB      | `503`, `code=ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE` |
| P.5     | po przywróceniu zależności                       | `200`                                           |
| P.6     | REVOKED                                          | `403`, `code=ORG_MEMBERSHIP_REVOKED`            |
| P.6     | inna organizacja                                 | `403`, `code=ORG_CONTEXT_MISMATCH`              |
| P.6     | brak organizacji                                 | `403`, `code=ORG_CONTEXT_REQUIRED`              |
| P.7     | anonim                                           | `200`                                           |
| P.7     | niepoprawny JWT                                  | `200`                                           |
| P.7     | organizacja zawieszona                           | `200`, bez `x-session-id`                       |
| P.7     | REVOKED / inna organizacja / brak organizacji    | odpowiednio `200 / 200 / 200`                   |
| P.8     | flaga ON, sesja bezczynna                        | `401`, `code=SESSION_IDLE_TIMEOUT`              |
| P.8     | flaga OFF, ta sama klasa sesji                   | `200`                                           |
| P.8     | REVOKED                                          | `403`, `code=ORG_MEMBERSHIP_REVOKED`            |
| P.8     | inna organizacja                                 | `403`, `code=ORG_CONTEXT_MISMATCH`              |
| P.8     | brak organizacji                                 | `403`, `code=ORG_CONTEXT_REQUIRED`              |

Trzy negatywy tenantowe dla obowiązkowego toru P.3/P.4/P.5/P.6/P.8 są więc odmowami o dokładnych kodach. P.7 jest świadomym wyjątkiem semantycznym: `optionalAuth` musi zachować opcjonalność i zdegradować nieudane uwierzytelnienie do anonima; wymuszenie odmów 4xx dla tych trzech aktorów byłoby regresją publicznego share i zaprzeczałoby naprawie P.7. Dlatego tu dokładnym, wymaganym kontraktem jest `200`, a nie luźne `not.toBe(200)`.

### Cztery niezależne dowody mutacyjne

Każdą mutację wykonano na podstawie kopii `/private/tmp/consultify-authcore-day56-scratch/auth.middleware.continuation.ts`; nie użyto `git stash`. Po każdym czerwonym przebiegu przywrócono kopię, uzyskano zielony przebieg i potwierdzono pusty diff `auth.middleware.ts`.

| naprawa                             | mutacja cofająca naprawę                                               | dosłowny błąd czerwony                                         | po przywróceniu     |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------- |
| fail-closed brak organizacji        | gałąź braku org wywołuje `next()`                                      | `AssertionError: expected 200 to be 403 // Object.is equality` | 1 PASS / 13 SKIPPED |
| fail-closed awaria membership DB    | `catch` wywołuje `next()`                                              | `AssertionError: expected 200 to be 503 // Object.is equality` | 1 PASS / 13 SKIPPED |
| usunięcie cache 60 s                | przywrócono pozytywny wpis cache                                       | `AssertionError: expected 200 to be 403 // Object.is equality` | 1 PASS / 13 SKIPPED |
| optionalAuth zachowuje opcjonalność | `attachUser` dostał prawdziwy `res` zamiast odpowiedzi przechwytującej | `AssertionError: expected 403 to be 200 // Object.is equality` | 1 PASS / 13 SKIPPED |

Test nie przechodził w obu stanach dla żadnej z czterech mutacji.

### Cztery testy-kotwice — obecna treść i sens naprawy

1. `refuses when membership context accessor throws`: sprawdza brak zapytania DB, dokładne `403`, `code=ORG_CONTEXT_REQUIRED` i brak `next()`. Poprzedni test jawnie oczekiwał fail-open; zmiana przypina bezpieczny wynik i dodaje asercje, więc nie osłabia testu.
2. `refuses when req.organizationId getter throws during normalization`: mimo fallbacku w `user.organizationId` sprawdza brak zapytania DB, dokładne `403`, `code=ORG_CONTEXT_REQUIRED` i brak `next()`. Usuwa kanonizację buga, nie tolerancję błędu.
3. `logs and refuses when membership DB lookup fails`: sprawdza brak `next()`, dokładne `503`, `code=ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE` oraz log z tym kodem, ścieżką i przyczyną `db unavailable`. To więcej i mocniejsze asercje niż dawny fail-open.
4. `refuses when assigning normalized organizationId throws`: sprawdza brak zapytania DB, dokładne `403`, `code=ORG_CONTEXT_REQUIRED` i brak `next()`. Ręcznie rzucający setter nadal testuje tę samą gałąź, lecz oczekuje bezpiecznej odmowy zamiast przepuszczenia.

### Egzekutor bezczynności i końcowy ratchet

Zaadaptowany czerwony kontrakt dyżuru 53 jest zielony przy fladze ON: **8 PASS / 0 FAIL / 0 SKIPPED** na realnym Gateway/PG. Obejmuje dokładne `401 SESSION_IDLE_TIMEOUT`, brak odświeżenia czasu po odmowie oraz kontrolę, że przy `SESSION_IDLE_ENFORCEMENT=false` stara sesja nadal daje dokładnie `200`. Pierwszy omyłkowy przebieg bez jawnej flagi ON dał 200 w dwóch komórkach oczekujących 401; nie został zaliczony jako dowód i potwierdził, że domyślne OFF niczego nie zmienia.

Końcowy główny zakres: 79 plików, **1720 PASS / 2 FAIL / 65 SKIPPED**. Porównanie pełnych nazw PRZED→PO: `NOWE_CZERWONE=[]`, `USUNIĘTE_CZERWONE=[]`; obie czerwone nazwy są dokładnie tymi samymi zastanymi testami wymienionymi w §P.1.

## Tabela zbiorcza

| pozycja | werdykt         | commit       | dowód                            |
| ------- | --------------- | ------------ | -------------------------------- |
| P.1     | ZROBIONE_WG_DoD | `3bd488dbc4` | §P.1                             |
| P.2     | ZROBIONE_WG_DoD | `c166947a05` | §P.2                             |
| P.6     | ZROBIONE_WG_DoD | `35f44320da` | dokładne negatywy HTTP           |
| P.3     | ZROBIONE_WG_DoD | `35f44320da` | pełna macierz i mutacja          |
| P.4     | ZROBIONE_WG_DoD | `35f44320da` | ACTIVE→REVOKED→ACTIVE i mutacja  |
| P.5     | ZROBIONE_WG_DoD | `35f44320da` | dokładne 503/code i mutacja      |
| P.7     | ZROBIONE_WG_DoD | `35f44320da` | publiczne 200 i mutacja          |
| P.8     | ZROBIONE_WG_DoD | `35f44320da` | ON 401 / OFF 200, 8/8 i negatywy |
| P.9     | ZROBIONE_WG_DoD | `cc62eeabe2` | §P.9                             |
| R.1     | ZROBIONE_WG_DoD | ten commit   | ten raport                       |

## Artefakty

- `zasieg-PRZED.json` — `bb2aaa7a476a09e53b348947d72dcf3ad7f815e219042f882739faf873ad79d9`; log — `c91bf9dba8ad8996027d285127708f6e62d531633be8d3ad2af4db0e21e038aa`.
- `zasieg-PO.json` — `d8d21b0d3b331409ec9a93c6eee7881f7751055fbe0d3ae94563b2fa521a271e`; log — `eac382b53d6e96e3816698b7706d645939338d054a97a1549c58085d012f7b65`.
- `p8-kontrakt.json` — `bb80aca3de66ed6eede8cfcb8dc3784f87daaa43893785a1a379257ffe737120`; log — `81f35852aa3a906668fe87094df5f5be050eb70a9cc5706e5e8e71253d061b7e`.
- `p8-regresja.json` — `ad64d8c565d02351d1882f296b96d95ca79c8036309239115ad11509facf1dd3`; log — `e68a432a4b73bde2f6dcfb0c8399852bd57473c9d78c109dc64c22a450e5a054`.
- `integracja.json` — `2b6f946e6dcc2500d1ad257d6cad37e4f0d3b7fe3823abd752812da59804ab93`; log — `2702437a5fe43e30331bcfff20f56c4cd8635abc1e2cea4dc8e722bf962f6726`.
- `continuation-matrices-final-on.json` — `73cee3d0dc1a9444f6cc5abff9e5b85b9e01dfb7e432867b47c4ca8acf3e72cf`; log — `6646f32f08f32d6c2ac4b55e00b309e6148e74a4aa54a1964f85f210aaeea9a9`.
- `continuation-idle-final-on.json` — `ba25291a13fdc71a2c42f8461dbb0730a1921a9e12b8031476fdbf0933106c4c`; log — `961caca37724332b30fa0b53f441f5d35aacbfcbbcc717eed557cde566de58ea`.
- `zasieg-KONTYNUACJA-PO.json` — `6eb3157acde001a052c689233036a13d8154d0cb05bf31c75da25f74b97241d1`; log — `057594f7f3b998ae30296ac816f095bca6bca744c889bd2487dab46e2933cdfb`.
- Osiem logów mutacyjnych `mutation-{missing-org,db-fail,cache,optional}-{RED,GREEN}.log`; sumy SHA-256 zostały zmierzone w katalogu artefaktów.
- Pozostałe sumy są dostępne z `shasum -a 256 /private/tmp/consultify-authcore-day56-artefakty/*`.

## Dług zastany

- Dwa czerwone testy baseline wskazane w §P.1.
- Martwy import `optionalAuth` w `legal.routes.ts:17` — tylko raport, brak licencji zapisu.
- `cross-org-idor.test.ts` — pomiar i rekomendacja do uzupełnienia.
- Własny pomiar `cross-org-idor.test.ts`: 22 PASS / 92 FAIL. Mockuje nieistniejący eksport z rbac i nie izoluje faktycznego `validateOrgMembership`; nadzorca powinien zlecić osobny dyżur naprawiający mock/fixture bez osłabienia oczekiwanych 403.

## TWIERDZENIA NIEZWERYFIKOWANE

- Kody HTTP dla tras, których nie objęto jeszcze realnym żądaniem przez ApiGateway.
- Pochodzenie 14 czerwonych testów dodatkowego zakresu tras oraz 15 czerwonych pełnego katalogu integracyjnego auth nie zostało porównane z markerem.

## STOP-y

Brak STOP-u całego dyżuru. P.3–P.8 domknięto w kontynuacji dowodami HTTP, tenantowymi, mutacyjnymi i ratchetem nazw.

## Rekomendacje przy scalaniu

1. Usunąć duplikat kontraktu day53 po przyjęciu testu day56; nie zachowywać przypięcia `cx_day53`.
2. Nie scalać gałęzi 37; wykorzystana została wyłącznie zasada fail-closed.
3. Naprawić `cross-org-idor.test.ts` w osobnym dyżurze z poprawnym źródłem symbolu i fixture organizacji.
4. Przed merge wykonać baseline dodatkowych katalogów na markerze i porównać 14/15 czerwonych nazw.
5. Rozstrzygnąć preload/cache jawnego braku polityki, jeśli właściciel podtrzymuje twarde 0 zapytań przy braku ustawienia.

## Brief wynikowy dla nadzorcy

Rdzeń członkostwa odmawia zalogowanemu użytkownikowi bez organizacji. Odebrane członkostwo nie jest już cache'owane przez 60 sekund. Awaria magazynu członkostwa zwraca 503 zamiast wpuszczać ruch. `optionalAuth` nie wysyła odmowy hydratacji na publicznej trasie. Egzekutor bezczynności działa przed przekazaniem żądania dalej i jest domyślnie wyłączony. Macierz realnego Gateway/PG ma 14/14 PASS, kontrakt bezczynności 8/8 PASS, a cztery niezależne mutacje czerwienieją dokładnie w oczekiwanym kierunku. Pełny główny zakres ma zero nowych czerwonych nazw. P.3–P.8 są formalnie `ZROBIONE_WG_DoD`. Nie powstała migracja. Gałąź 37 nie została przejęta. Zastany uszkodzony `cross-org-idor.test.ts` pozostaje długiem poza licencją.
