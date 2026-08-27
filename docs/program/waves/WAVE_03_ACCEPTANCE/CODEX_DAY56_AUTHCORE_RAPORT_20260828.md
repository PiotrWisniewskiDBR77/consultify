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

## Pomiar zasięgu testów

PRZED: patrz §P.1. Artefakty: `/private/tmp/consultify-authcore-day56-artefakty/zasieg-PRZED.json` i `zasieg-PRZED.log`.

## Dług zastany

- Dwa czerwone testy baseline wskazane w §P.1.
- Martwy import `optionalAuth` w `legal.routes.ts:17` — tylko raport, brak licencji zapisu.
- `cross-org-idor.test.ts` — pomiar i rekomendacja do uzupełnienia.

## TWIERDZENIA NIEZWERYFIKOWANE

- Kody HTTP dla tras, których nie objęto jeszcze realnym żądaniem przez ApiGateway.
