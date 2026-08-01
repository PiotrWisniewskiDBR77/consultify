---
doc_id: OPS-DEMO-002
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: codex
product_owner: piotr
priority: P0
depends_on: OPS-DEMO-001
last_reviewed: 2026-08-01
---

# OPS-DEMO-002 — publiczne wejście do demo

## Próba stagingowa 2026-08-01

Na `https://demo.consultify.ai` publiczne CTA `Try demo` prawidłowo otwiera modal
`Experience Consultify Demo`, ale logowanie kanonicznymi kontami wskazanymi w kodzie
zwraca `Invalid email or password`:

- `piotr.wisniewski@demo.com`;
- `anna.zielinska@ateliertoys-demo.com`.

Istniejące konto administratorskie `piotr.wisniewski@dbr77.com` pozwoliło wejść do
`Demo Mode · Atelier Toys`, dlatego dalszy odbiór techniczny był możliwy. Nie jest to
jednak poprawna ścieżka wejścia użytkownika/prospekta.

Dodatkowo `isQuickAccessShortcutHost()` nie klasyfikował `demo.consultify.ai` jako
stagingu (`stage.*` i `staging.*` były obsłużone, `demo.*` nie), więc przewidziane
skróty testowe nie były dostępne na docelowej domenie odbiorowej.

## Werdykt pierwotny

**NO-GO dla publicznego Try demo.** Ochrona tras prywatnych działa, ale obiecana ścieżka
wejścia do seedowanego workspace nie działa znanymi danymi dostępowymi.

## Slice 1 — host allowlist (zaakceptowany, rewizja `c522a86183`)

- `demo.consultify.ai` w jawnej allowliście hostów stagingowych;
- resolver PIN-u odrzuca każdy host spoza allowlisty;
- produkcyjne `consultify.ai` dopuszcza wyłącznie istniejący skrót `1111`;
- testy host allowlist / obcy host / produkcja: `3/3 PASS`.

## Slice 2 — publiczna ścieżka wejścia (gałąź `fix/ops-demo-002-public-entry`)

### Przyczyna źródłowa

Publiczne `Try demo` nie było zepsute „gdzieś w UI” — łamały je cztery niezależne
defekty w `POST /api/auth/register-demo`:

1. **Rozjazd normalizacji adresu (bloker właściwy).** Rejestracja zapisywała
   `users.email` w postaci surowej (`String(email).trim()`), a `AuthController.login`
   szuka konta przez `WHERE email = ?` na adresie **już zmałolitrowanym**. Każde
   zgłoszenie z wielką literą tworzyło konto, które nigdy się nie zaloguje. Ponownej
   rejestracji broniła kontrola duplikatu, która jest `LOWER(email) = LOWER(?)` —
   czyli adres zostawał martwy na stałe. To dokładnie objaw ze stagingu: „konto jest,
   ale hasło nie pasuje”.
2. **Brak sesji demo.** `register-demo` ustawiał tylko preferencję `demo:enabled`; nie
   powstawał wiersz `demo_sessions` i odpowiedź nie zawierała identyfikatora tenanta.
   Klient nie miał czego wysłać w `X-Demo-Session-Org`, więc backend degradował
   każde zgłoszenie do **wspólnej** kuratorowanej organizacji bazowej.
3. **Nadmiarowa rola.** Publiczne zgłoszenie dostawało `ADMIN` w organizacji demo
   (i taki sam wpis w `organization_members`), czyli wstęp do pasa administracji
   organizacji (`adminP32` wpuszcza `OWNER`/`ADMIN`).
4. **Wyciek istnienia konta.** Duplikat adresu zwracał `400 EMAIL_IN_USE`
   z komunikatem „Email already in use”, a modal na ten kod **po cichu logował się**
   wpisanym hasłem. Publiczny endpoint był jednocześnie wyrocznią istnienia konta
   i wygodnym narzędziem do sprawdzania haseł.

### Kanoniczna ścieżka publiczna (rozstrzygnięcie)

Wybrano **izolowany `register-demo`**, nie wspólnego read-only tenanta. Podstawa
w istniejącym SSOT — decyzja nie wymaga `NEEDS_PRODUCT_DECISION`:

- `docs/DEMO_MODE.md` §Data model: „Demo data is stored in **isolated session
  organizations** created from the Atelier Toys template… demo sessions expire
  automatically and are cleaned up”;
- `demoSessionService` implementuje ten model od dawna (`demo_sessions`,
  `demo_session_tenants`, TTL 24 h);
- wariant wspólny pozostaje dostępny jako **jawnie włączany** tryb prezentacyjny
  `DEMO_USE_BASE_ORG=true` i nadal działa bez zmian.

Kontrakt:

```
Landing „Try demo”
  → DemoModeModal (zakładka Sign up)
  → POST /api/auth/register-demo
      → konto (rola CONSULTANT, org macierzysta = DEMO_ORG_ID)
      → resolveOrCreateDemoSession(source='register_demo')  ← izolowany tenant + seed
      → { user, token, refreshToken, isDemo, demoSession }
  → klient zapisuje demoSession.organizationId jako demoSessionOrgId
  → każde żądanie niesie X-Demo-Mode + X-Demo-Session-Org
  → /chat na danych Atelier Toys
```

Ścieżka wtórna dla powracającego prospekta: `POST /api/auth/login`
→ `POST /api/demo/toggle {enabled:true}` → ten sam kontrakt sesji.
Anonimowe `/demo-login` pozostaje `410` poza test gateway i **nie jest przywracane**.

### Model tenancy

| Warstwa | Wartość | Kto ją pilnuje |
| --- | --- | --- |
| Organizacja macierzysta konta demo | `DEMO_ORG_ID` (kuratorowana, nigdy nie kasowana) | `users.organization_id` |
| Tenant roboczy sesji | `${DEMO_ORG_ID}-session-<user>-<ts>` | `demo_sessions` + nagłówek `X-Demo-Session-Org` |
| Walidacja właściciela tenanta | zapytanie po `user_id` **i** `session_org_id` | `resolveValidatedDemoSessionOrgId`, `attachUser` |
| Rozstrzygnięcie org dla principala publicznego demo | **wyłącznie z aktywnej sesji na serwerze** — nigdy z tokena, nagłówka ani fallbacku | `attachUser` + `demoPrincipalGuard` |
| Zapisy | zablokowane globalnie dla org demo | `demoWriteProtection` (`403 DEMO_READ_ONLY`) |

**Fail closed (zmiana wobec pierwszej wersji).** Wcześniej cudzy lub nieistniejący
`X-Demo-Session-Org` cicho degradował do organizacji bazowej i zwracał `200` — sonda
międzytenantowa była nie do odróżnienia od zwykłego żądania. Teraz:

- cudzy/nieistniejący `X-Demo-Session-Org` → `403 DEMO_SESSION_INVALID` (dla każdego
  wywołującego, nie tylko dla demo);
- **brak** nagłówka u principala publicznego demo → org bierze się z aktywnej sesji,
  więc pominięcie nagłówka też nie przełącza na organizację bazową. Zamknęło to również
  ratunkową ścieżkę „dowolne ACTIVE membership” w `attachUser`, która sadzała konto demo
  w organizacji wspólnej nawet bez żadnych nagłówków.

### Rola i uprawnienia — `CONSULTANT`

Pierwsze podejście dawało `TEAM_MEMBER` i było **błędne na dwa sposoby**, oba wykryte
w code review:

1. `organization_members.role` ma `CHECK (role IN ('OWNER','ADMIN','MEMBER','CONSULTANT','USER','GUEST'))`
   (`server/migrations/20260412_organization_switch_log.sql`). `TEAM_MEMBER` łamał
   ograniczenie, a `DbPromise.run` domyślnie ma `fallback: true` — więc INSERT
   **cicho nie wchodził** i konto demo nie miało w ogóle wiersza członkostwa.
2. `normalizeAppRole` składa `TEAM_MEMBER` do pasma `USER`, a `isPilotRestrictedRole`
   robi z takiego konta **pilot respondenta**: `RouterSync` wyrzuca z każdej trasy
   spoza `PILOT_ALLOWED_ROUTE_PREFIXES`, menu boczne zwija się do 6 pozycji.
   Prospekt zobaczyłby okrojony produkt.

`CONSULTANT` spełnia wszystkie trzy warunki naraz: jest w CHECK, nie niesie żadnej
zdolności administracyjnej (`adminP32` wpuszcza tylko OWNER/ADMIN) i figuruje w
`STAFF_EXEMPT_FROM_PILOT`, więc demo pokazuje pełny produkt. Wartość i uzasadnienie
mieszkają w jednym miejscu: `server/src/services/demo/demoSignupProvisioning.ts`.

Bramki: rola nie należy do `{SUPERADMIN, SUPER_ADMIN, OWNER, ADMIN}`, rola nie należy
do pasma pilotowego, wiersz `organization_members` **istnieje** (asercja bezwarunkowa —
warunkowa była pusta dokładnie wtedy, gdy błąd występował), token demo nie wchodzi na
`/api/superadmin/*`.

### Read-only nie do ominięcia (runda 3)

`demoWriteProtection` **nie może** pełnić tej roli. Jest montowany globalnie w
`Gateway.ts` **przed** jakimkolwiek uwierzytelnieniem, więc `req.user` jest tam
pusty, a jedynym użytecznym sygnałem zostaje nagłówek `X-Demo-Mode` podawany przez
klienta. Drugi jego sygnał — „org efektywna = `DEMO_ORG_ID`" — przestał trafiać
dokładnie wtedy, gdy principal publicznego demo zaczął (poprawnie) siadać we
własnym tenancie sesji. Efekt: **zapis bez żadnych nagłówków przechodził w całości**.

Decyzja jest teraz podejmowana w `attachUser`, na principalu rozstrzygniętym
z tokena i bazy, więc klient nie ma na nią żadnego wpływu. Bezwarunkowo:
`DEMO_WRITES_ENABLED` może rozluźniać ścieżkę nagłówkową dla innych użytkowników
demo, ale publiczne zgłoszenie to anonimowy nieznajomy i zostaje read-only.

Dozwolone pozostają `/api/auth/*` i `/api/demo/*` — to jedyne trasy, którymi sesja
może się sama zamknąć (wylogowanie, wyjście z demo); ich zablokowanie uwięziłoby
klienta, nie chroniąc niczego.

Skala luki zmierzona kontrolą negatywną: **9 różnych endpointów zapisu**
(assessment, initiative, project, task, invitation, admin org, access-code,
organization update, delete) było osiągalnych bare-requestem — wszystkie 11 testów
tej sekcji pada na kodzie sprzed poprawki.

### Dokładna allowlista zapisów (runda 4)

Wyjątki prefiksowe `/api/auth/*` i `/api/demo/*` **usunięte**. Prefiks pod `/api/auth/`
oddawał publicznemu kontu demo także `switch-organization`, `change-password`,
`mfa/{setup,enable,disable}`, `revoke-all`, `revert-impersonation` i historię logowań,
a pod `/api/demo/` — `toggle {enabled:true}`, czyli operację **provisioningu**.

Obowiązuje teraz dopasowanie **dokładne: metoda + znormalizowana ścieżka**, pięć pozycji:

| Operacja | Dlaczego dopuszczona |
| --- | --- |
| `POST /api/auth/logout` | zakończenie sesji |
| `POST /api/auth/revoke-all` | odpowiednik „logout-all"; unieważnia **własne** rodziny tokenów |
| `POST /api/auth/refresh` | rotacja w oknie demo; ma **własną** bramkę TTL, która odrzuca wygasły principal |
| `POST /api/demo/toggle` | **wyłącznie wyjście** — `enabled` musi być jawnie `false`/`'false'`/`0`/`'0'`; wszystko inne (w tym brak pola) to odmowa |
| `POST /api/demo/record-event` | beacon telemetryczny; trasa wyprowadza `organizationId` server-side |

**Uwaga nazewnicza do przeglądu:** pakiet prosił o `POST /api/auth/logout-all`. Taka
trasa nie istnieje — odpowiednikiem w tym kodzie jest `POST /api/auth/revoke-all`
i to ona jest na liście.

**Cross-tenant w `record-event` — realna dziura, zamknięta.** Trasa czytała
`organizationId` **z ciała żądania** (`organizationId || req.user.organizationId`,
ciało wygrywało), więc dowolny uwierzytelniony wywołujący mógł zapisać zdarzenie na
konto obcego tenanta. Atrybucja pochodzi teraz wyłącznie z organizacji rozstrzygniętej
server-side; dla publicznego demo to jego aktywny tenant sesji. Test czyta z powrotem
`conversion_events` i sprawdza, że nic nie wylądowało u B, a zdarzenie A jest u A.

**Normalizacja ścieżki jest częścią kontraktu.** `normalizeGuardPath` odrzuca
(`null` = DENY) nieodwracalne kodowanie procentowe, `..`, backslashe i bajt zerowy,
skleja powielone `/`, ucina końcowy `/` i sprowadza do małych liter — bo Express
domyślnie routuje bez rozróżniania wielkości znaków, więc guard musi widzieć to samo,
co router.

**Trzy trasy poza zasięgiem guarda — świadomie.** `register`, `register-demo`
i `reset-password` nie mają `verifyToken`, więc `attachUser` nigdy się dla nich nie
uruchamia. To endpointy **publiczne**: anonimowy nieznajomy wywoła je bez żadnego
tokenu. Właściwa własność nie brzmi więc „principal demo jest odrzucony", tylko
„poświadczenie demo nic nie daje" — i tak to jest testowane (identyczny wynik
z tokenem i bez). `isWriteAllowedForPublicDemo` i tak je odrzuca, jako obrona
w głąb, gdyby kiedyś zyskały uwierzytelnienie. Ochroną tych tras są limitery
i polityka rejestracji publicznej, nie ten guard.

Pokrycie: tabelaryczny test nad **566 realnymi trasami zapisu** wyekstrahowanymi
z `Gateway.ts` (`/api/auth/*` i `/api/demo/*` **kompletne**, reszta próbkowana per
przestrzeń nazw), plus próby obejścia normalizacji. Kontrola negatywna na starej
regule prefiksowej: **66 przypadków odmowy przechodziło**, w tym 16/16 nazwanych
tras wysokiego ryzyka i 7/7 ciał `toggle {enabled:true}`.

### Czas dostępu — semantyka 24 h domknięta

Sama sesja wygasała, ale konto żyło dalej. Trzy drogi kontynuacji były otwarte i
wszystkie są teraz zamknięte przez `server/src/services/demo/demoPrincipalGuard.ts`.

| Wektor | Było | Jest |
| --- | --- | --- |
| Token dostępowy po wygaśnięciu | degradacja do org bazowej, przeglądanie bez końca | `403 DEMO_SESSION_EXPIRED` (`attachUser`) |
| `GET /api/demo/status` | `resolveOrCreateDemoSession` **wystawiał świeżą sesję 24 h** | żądanie odrzucone zanim dojdzie do trasy |
| Ponowny `POST /api/auth/login` | mintował nowy token | `403 DEMO_SESSION_EXPIRED` |
| Refresh token (7 dni), ścieżka normalna | rotacja nowej rodziny | `401`, sprawdzone **przed** mintem i rotacją |
| Refresh token, ścieżka **grace period** | mintowała token **przed** wszystkimi normalnymi kontrolami | osobna bramka w tej gałęzi |

**Bez zależności od leniwego wygaszania (runda 3).** Login i refresh pytają teraz
**bezpośrednio o aktywną sesję**, a nie o `users.status`. Wygaszanie jest leniwe —
dzieje się przy pierwszym uwierzytelnionym żądaniu po TTL — więc prospekt, który po
prostu zamknie kartę i zaloguje się nazajutrz, trafia w okno, w którym sesja jest
wygasła, a status wciąż brzmi `active`. Bramka oparta na statusie wystawiłaby mu
wtedy świeży token. `assertDemoPrincipalMayReceiveCredentials` sam też domyka
konto i unieważnia rodzinę tokenów, więc odmowa jest jednocześnie retirementem.
Pokryte testami **DIRECT** — bez żadnego wcześniejszego chronionego GET-a.

Zakres jest wąski celowo: guard dotyczy **wyłącznie** principali oznaczonych przy
rejestracji markerem `demo:entry_source = register_demo`. Zwykły klient, który włącza
„pokaż dane demo" z menu profilu, nie jest efemeryczny i nie zmienia zachowania.

### Test gateway wyłączony twardo na produkcji (runda 3)

`/api/auth/demo-login` otwierał się na **alternatywie**
`NODE_ENV==='test' || E2E_MODE==='true' || ENABLE_TEST_GATEWAY==='true'`, więc jedna
zmienna środowiskowa ustawiona omyłkowo na Railway wskrzeszała anonimowy endpoint
uwierzytelniania, który dodatkowo **auto-provisionuje** użytkownika demo. Teraz to
**koniunkcja** trzech warunków — `NODE_ENV === 'test'` **i** jawna flaga **i**
skonfigurowany `TEST_SUPPORT_KEY` (≥12 znaków, ten sam próg co `testSupport.routes.ts`)
— w jednym predykacie używanym przez obie bramki (wejście i auto-provisioning).
Macierz 11 kombinacji zamkniętych i 3 otwartych; testy trasy dowodzą przy tym, że
w kombinacjach zamkniętych `dbRun`/`dbGet` **nie są w ogóle wołane**.

### Rollback — saga kompensacyjna

**Runda 3 — trzy dodatkowe domknięcia.** (a) Kompensacja każdego kroku jest teraz
rejestrowana **przed** wywołaniem, nie po nim: krok, który zapisze jeden wiersz
i dopiero potem rzuci (legalService pisze po wierszu na dokument; krok preferencji
to pięć osobnych zapytań; `insertMembership` rzuca na read-backu **po** commicie;
`issueTokens` utrwala rodzinę tokenów przed zwróceniem), inaczej zostawiał ten
zapis na zawsze — kompensacja nie była jeszcze zarejestrowana. (b) Zniknął zbędny
`SELECT` po udanym provisioningu, którego gałąź błędu zwracała `503` **mając już
żywe konto, sesję i tokeny**; odpowiedź buduje się teraz z tego, co saga zwraca.
(c) Tożsamość tenanta: saga bije własny `runId` (uuid) i wywodzi z niego id
tenanta, więc sprzątanie porównuje `=` zamiast `LIKE`. Poprzednio zamiatała
`${DEMO_ORG_ID}-session-<10 znaków id użytkownika>-%` — dwa id kolidują na 10
znakach, więc **rollback jednego zgłoszenia mógł skasować żywy workspace innego
prospekta**; test współbieżności pada na starej implementacji i przechodzi na nowej.
Marker własności mieszka w `user_preferences` (nie w `demo_session_tenants`, które
ma FK na `demo_sessions` i `organizations` — a właśnie okno przed ich istnieniem
trzeba pokryć) i jest zapisywany **przed** seedem.

Rejestracja dotyka siedmiu magazynów bez wspólnej transakcji. Zamiast `try/catch`
mamy sagę (`server/src/services/demo/demoSignupProvisioning.ts`): każdy krok w przód
rejestruje własną kompensację, awaria odwija je w odwrotnej kolejności, a **każda
kompensacja jest odczytywana z powrotem**, żeby potwierdzić, że wiersz naprawdę
zniknął. Kompensacja niepotwierdzona jest raportowana jako niepełna
(`compensation.complete = false`) i logowana jako wymagająca ręcznego sprzątania —
nigdy zakładana.

Jedna pułapka warta zapisania: `startDemoSession` **najpierw** seeduje organizację
tenanta, a dopiero **potem** wstawia wiersz `demo_sessions`. Awaria pomiędzy zostawia
organizację, której żadna zwrócona wartość nie nazywa. Dlatego kompensacja tego kroku
jest rejestrowana **przed** wywołaniem i zamiata po prefiksie identyfikatora
(`${DEMO_ORG_ID}-session-<user>-`), a nie po zwróconym id.

- **Idempotencja**: po każdej awarii ten sam adres da się zarejestrować ponownie —
  pokryte testem dla wszystkich czterech scenariuszy.
- **Duplikat**: `409 DEMO_SIGNUP_UNAVAILABLE` z komunikatem identycznym dla adresu
  znanego i nieznanego.

### Ochrona przed nadużyciem

`POST /api/auth/register-demo` był **całkowicie nielimitowany**: globalny `apiLimiter`
jawnie pomija wszystko pod `/api/auth/`, a `authLimiter` jest zamontowany tylko na
`/api/auth/login` i `/api/auth/register` — co pod Express 5 **nie** obejmuje
`/api/auth/register-demo`. Endpoint jest przy tym nieuwierzytelniony, wyjęty z CSRF
i provisionuje seedowany tenant przy każdym sukcesie.

Dwa niezależne limitery: `demoSignupIpRateLimiter` (adres źródłowy, 5/godz. w prod)
i `demoSignupIdentityRateLimiter` (**sha256 adresu** z separacją domenową, 3/godz.).
Klucz tożsamości liczony z tej samej znormalizowanej postaci, której używa
wyszukiwanie konta, więc wielkość liter nie omija kwoty; surowy adres **nigdy** nie
trafia do przestrzeni kluczy.

#### Fail-closed naprawdę, nie tylko na sondzie (runda 4)

`RedisRateLimitStore.increment()` połykał **każdy** błąd Redisa i zwracał
`{ totalHits: 1 }`. To gorsze niż fail-open: podczas awarii każde żądanie wygląda jak
pierwsze trafienie świeżego okna, więc kwota po cichu staje się nieskończona, a
wywołujący nie ma jak tego wykryć. Poprzednia runda obchodziła to sondą **przed**
wywołaniem — co łapie tylko „brak połączenia", a nie błąd rzucony przez INCR, odczyt
TTL czy EXPIRE w trakcie.

Store dostał opcję `throwOnError` (domyślnie `false`, więc istniejący wywołujący
w `index.ts` jest bajt w bajt taki sam — to limitery ruchu uwierzytelnionego, które
mają fail-open). Adapter demo buduje store z `throwOnError: true`, a sonda została
jako tani skrót, **nie jako mechanizm nośny**. Przy `failMode: closed` dowolny błąd
Redisa daje `503` z `Retry-After` — nie `429`, bo `429` twierdziłby „przekroczyłeś
kwotę", a my w tym momencie po prostu nie policzyliśmy. Testy pokrywają błąd na INCR,
na odczycie TTL, na EXPIRE oraz na **drugim** wywołaniu (okno już założone), żeby
dowieść, że to nie artefakt zimnego startu.

#### Kontrakt konfiguracji startowej (runda 4)

Nowy moduł `server/src/config/rateLimitPosture.ts`, wołany raz przy starcie.

| Zmienna | Postawa domyślna (nieustawiona = dzisiejszy staging) | `RATE_LIMIT_POSTURE=single-replica` | `RATE_LIMIT_POSTURE=public-production` |
| --- | --- | --- | --- |
| `RATE_LIMIT_SHARED_STORE` | `local`/brak lub `redis` | `local` pierwszoklasowe | musi być `redis` → **odmowa startu** |
| `..._FAIL_MODE` | dowolne z closed/local/open | jw. | musi być `closed` → **odmowa** |
| `DISABLE_RATE_LIMIT=true` | **głośny `logger.error`, ale startuje** | **odmowa** | **odmowa** |
| `RATE_LIMIT_ALLOW_PROD_DISABLE=true` | ignorowane | ostrzeżenie | **odmowa** |
| `REDIS_URL` realny | — | ostrzeżenie przy `redis` bez niego | **odmowa** gdy brak / nierozwinięty / zły schemat |
| `MOCK_REDIS=true` | — | — | **odmowa** |
| nieznana wartość którejkolwiek | **odmowa** | **odmowa** | **odmowa** |

`DISABLE_RATE_LIMIT` tylko loguje przy postawie *domniemanej*, bo to wieloletnia
wygoda lokalnego devu czytana bezwarunkowo — zamiana jej w crash startu byłaby karą
dla procesu, który nigdy nie przystąpił do kontraktu. Zadeklarowanie postawy kupuje
fail-fast. **Nic nie odmawia startu, dopóki ktoś nie ustawi nowej zmiennej** —
staging bez zmian.

Start zawsze loguje jedną linię `[RateLimit] startup posture: …` ze znacznikami
`(inferred, not declared)` / `(default)`, żeby operator widział, co **zadeklarowano**,
a co przyjęto.

**Sonda gotowości** (`GET /api/health/ready/rate-limit`, bez auth, celowo bez
szczegółów) inkrementuje ten sam jednorazowy klucz **dwukrotnie** i wymaga, by licznik
**ściśle wzrósł**. Tego zepsuty store nie podrobi — mockowy klient Redisa odpowiada
radośnie stałym `1` i tę sondę oblewa.

#### Telemetria (runda 4)

`GET /api/health/rate-limit` — **`verifyToken` + `requireSuperAdmin`** — podaje per
limiter `rejected` i `storeUnavailable`, aktywny store, fail mode, `bypassed` oraz
postawę zadeklarowaną vs efektywną. Publiczny agregat pozostaje **wyłącznie**
istniejącym, nieoznaczonym licznikiem `rateLimitHits` (który dotąd nie miał ani
jednego wywołującego i od napisania raportował `0`). Logowanie odrzuceń jest
zliczająco-podsumowujące: najwyżej jedna linia na limiter na minutę, z wolumenem
i liczbą odrębnych źródeł — bez adresu, IP i klucza.

### Komunikaty publiczne

Trzy klasy, bez ujawniania istnienia konta:

| Klasa | Kiedy | Treść |
| --- | --- | --- |
| `invalidCredentials` | zakładka Log in, `401` | `Invalid email or password.` |
| `signupUnavailable` | zakładka Sign up, duplikat **i** każdy inny błąd tworzenia | `We could not start a demo with those details…` |
| `demoUnavailable` | `DEMO_SEED_UNAVAILABLE` / `DEMO_UNAVAILABLE` / `DEMO_NOT_CONFIGURED` | `The demo workspace is temporarily unavailable…` |

Modal nigdy nie renderuje surowego komunikatu backendu i nie loguje się po cichu
w reakcji na duplikat. Kody `DEMO_SESSION_EXPIRED` i `DEMO_SESSION_INVALID` zostały
dopisane do `src/utils/accessBlocked.ts` — `dispatchAccessBlocked` po cichu odrzuca
kody niezarejestrowane, więc bez tego użytkownik zobaczyłby martwy ekran.

### Enumeracja — co zostało zamknięte, a co nie

Zamknięte: status, kod i treść są **identyczne** dla adresu znanego i nieznanego przy
każdym odrzuceniu; usunięto fallback „duplikat → zaloguj wpisanym hasłem” (był
jednocześnie wyrocznią i narzędziem do sprawdzania haseł); gałąź duplikatu wykonuje
teraz **ten sam koszt bcrypt** co ścieżka akceptowana, więc nie odróżnia się czasem
odpowiedzi od pozostałych odrzuceń.

**Ryzyko zaakceptowane, nie usunięte.** Ten endpoint *provisionuje* przy sukcesie:
adres nieznany dostaje `200` i workspace, adres znany dostaje `409`. Ta różnica jest
nieodłączna od rejestracji i nie da się jej usunąć bez rezygnacji z natychmiastowego
wejścia do demo. Deklaracja „oracle usunięty” byłaby nieprawdziwa. To, co realnie
ogranicza enumerację, to limitery powyżej: 3 próby na adres i 5 na adres IP na godzinę
czynią chodzenie po liście adresów kosztownym, a nie niemożliwym. Jeśli Piotr uzna to
za niewystarczające, jedyne pełne rozwiązanie to rozdzielenie rejestracji od wejścia
(potwierdzenie mailem przed provisioningiem) — osobna decyzja produktowa.

## Harnessy testowe — własność uprzywilejowanych sesji

Publiczny `register-demo` przestał być źródłem uprawnień, a kilkanaście harnessów
używało go jako **fallbacku**, po czym i tak wpisywało `role: 'ADMIN'` do
localStorage (`String(j.role || 'ADMIN')` albo literał). To najgorszy możliwy tryb
awarii: bramki klienckie przechodziły, a wywołania serwerowe wracały z 403 — spec
„działał" na sesji, której nie miał.

Jedyną uprzywilejowaną drogą jest teraz `POST /api/test-support/bootstrap`, opakowany
w `tests/e2e/_helpers/privilegedSession.ts`: bootstrap-only, **odczytuje rolę z
podpisanego JWT** i rzuca, jeśli różni się od żądanej, nigdy nie fabrykuje roli, nigdy
nie schodzi na `register-demo`. Przy braku konfiguracji rzuca z nazwami zmiennych do
ustawienia. Przeniesione: helpery M06/M09, work-canvas, runtime-gate, research-lineage,
admin-settings-superadmin, collab-processflow/mindmap, M07, M08 (×2), doc-deck-autosave,
table-platform (×3) oraz skrypty zrzutów `scripts/claude-verify/*`.

`tests/e2e/m04-notebook/_helpers.ts` **zostaje** na `register-demo` — potrzebuje konta
nieuprzywilejowanego do testu izolacji ACL; dopisano komentarz, żeby nikt tego nie
„naprawił".

**Konsekwencja operacyjna dla Codex:** te specyfikacje wymagają teraz jawnie
`ENABLE_TEST_SUPPORT=true`, `TEST_SUPPORT_KEY` (≥12 znaków) i `NODE_ENV != production`.
Wcześniej degradowały po cichu; teraz padają głośno. `doc-deck-autosave` zmienia
zachowanie z miękkiego `test.skip` na twardy błąd. Skrypty `claude-verify` są do czasu
przepięcia na bootstrap **wyłączone z użycia** — celowo, bo dotąd robiły zrzuty ekranów
przekierowań zamiast docelowych tras.

## Bramki wykonane lokalnie

| Bramka | Wynik |
| --- | --- |
| `tests/integration/demoPublicEntry.contract.test.ts` (realny Express + realna baza) | **`46/46 PASS`** |
| `tests/unit/backend/demo/` (allowlista 566 tras, saga, fault injection) | **`227/227 PASS`**, 4 pliki |
| `tests/unit/backend/rateLimiting/` (limitery, Redis faults, kontrakt startu, health) | **`76/76 PASS`**, 14 plików |
| `tests/unit/backend/auth/` (macierz flag gatewaya) | `27/27 PASS` |
| **Pełny pakiet regresji OPS-DEMO-002** | **`619/619 PASS`, 33 pliki** (`--retry=0`) |
| Kontrola negatywna — reguła prefiksowa zamiast dokładnej allowlisty (poziom jednostkowy) | **66 przypadków odmowy przechodziło**: 16/16 nazwanych tras auth, 7/7 ciał `toggle {enabled:true}`, 23/31 prób obejścia ścieżki |
| Kontrola negatywna — allowlista + `record-event` cofnięte (poziom HTTP) | **`8/46 FAIL`**, w tym cross-tenant zapis zdarzenia |
| Kontrola negatywna — Redis store z `HEAD` | **`11/13 FAIL`** — wszystkie błędy INCR/TTL/EXPIRE przepuszczane |
| Kontrola negatywna — kontrakt startu i surface health z `HEAD` | `7/7 FAIL` |
| Kontrole negatywne rund 1–3 (read-only, TTL, gateway, saga, limitery, trasa, AuthView) | nadal aktualne |
| `npm run type-check` | PASS |
| **Realny type-check 9 zmienionych plików backendu** | **0 błędów w moich plikach**; 30 linii wyjścia to istniejące błędy w plikach wciąganych tranzytywnie |
| `npm run build:backend` | PASS — ale to `tsc --noCheck`, **nie jest dowodem typowym** i nie jest tu cytowany jako taki |
| `check-ssot-paths.sh`, `check-ssot-registry.mjs` | PASS |
| `git diff --check` | PASS |
| Skan sekretów w diffie | czysty (jedyne trafienia to nazwy tras zawierające `api-keys` oraz jawnie oznaczony placeholder `redis://…@redis.invalid`) |

## Niewykonane świadomie

- **Playwright staging** — `tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts`
  jest przygotowany i domyślnie pominięty (`OPS_DEMO_002_STAGING=1` + host
  `demo.consultify.ai`). Nie uruchamiany z pasa implementacji: tworzy realne konta
  w bazie `demo`.
- **Playwright w ogóle** — brak serwera w tym pasie; migracja harnessów zweryfikowana
  type-checkiem drzewa `tests/e2e` (0 nowych błędów) i `node --check` dla skryptów.
- **Deploy, migracja, seed i cleanup na `demo`** — poza mandatem tego pakietu.

## Kroki stagingowe dla Codex

1. Wdrożyć rewizję gałęzi `fix/ops-demo-002-public-entry` na Railway `consultify` /
   environment `demo`; potwierdzić `SUCCESS` i `/ping` = `pong`.
2. Potwierdzić tryb demo: jeśli `DEMO_USE_BASE_ORG=true`, wejście jest wspólne
   i read-only; jeśli nie jest ustawione, każde zgłoszenie dostaje własny seedowany
   tenant (dłuższy pierwszy request — patrz ryzyka).
3. Fixture (namespaced, żadnych realnych osób), hasło generowane na miejscu
   i nigdzie nie zapisywane:
   `ops-demo-002+<runId>-a@fixture.invalid`, `ops-demo-002+<runId>-b@fixture.invalid`.
4. `OPS_DEMO_002_STAGING=1 E2E_BASE_URL=https://demo.consultify.ai npx playwright test tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts`.
5. Read-back z PostgreSQL `demo`:
   - `users.email` zapisany małymi literami;
   - `users.role` = `CONSULTANT`;
   - wiersz `organization_members` **istnieje** dla obu kont;
   - dwa różne `demo_sessions.session_org_id`.
6. Sprawdzenie TTL na żywo (bez czekania 24 h): ustawić `demo_sessions.expires_at`
   w przeszłość dla konta fixture, potem potwierdzić `403 DEMO_SESSION_EXPIRED`
   na żądaniu API, `403` na ponownym loginie i `401` na refreshu.
7. Cleanup — najpierw dry-run, potem apply po akceptacji listy:
   `DATABASE_PUBLIC_URL=… npx tsx scripts/cleanup-orphan-demo-orgs.ts`
   → `DATABASE_PUBLIC_URL=… FORCE_PURGE=true npx tsx scripts/cleanup-orphan-demo-orgs.ts --apply`
   oraz usunięcie kont `ops-demo-002+%@fixture.invalid`.
8. Werdykt `GO / FIX / NO-GO` na podstawie 1–7.

## Ryzyka otwarte

1. **Limiter jest w pamięci procesu — zaakceptowane dla stagingu jednorepikowego.**
   Do dokumentu operacyjnego, dosłownie:

   > Limitery publicznej rejestracji demo egzekwują kwotę w liczniku w pamięci
   > procesu. Jest to poprawne wyłącznie dopóki API działa jako pojedyncza replika:
   > przy skalowaniu poziomym efektywna kwota mnoży się przez liczbę replik, więc
   > N replik dopuszcza N × 5 rejestracji na godzinę na adres IP i N × 3 na adres
   > e-mail. Akceptujemy to na jednorepikowym stagingu, gdzie mnożnik wynosi 1.
   >
   > Zanim ten endpoint zostanie wystawiony na publiczną, wieloreplikową produkcję,
   > trzeba włączyć ścieżkę współdzielonego magazynu przez `RATE_LIMIT_SHARED_STORE=redis`
   > na każdej replice, z zweryfikowaną instancją Redis — nie z wbudowanym mockiem,
   > który nie egzekwuje niczego. Przy niedostępności magazynu limitery domyślnie
   > **fail-closed** (HTTP 503, `Retry-After: 30`), świadomie wymieniając dostępność
   > formularza demo na ochronę przed nadużyciem nieuwierzytelnionego endpointu,
   > który przy każdym sukcesie provisionuje tenant; `RATE_LIMIT_SHARED_STORE_FAIL_MODE=local`
   > lub `=open` mogą to nadpisać wyłącznie jako zapisane, zaakceptowane ryzyko.
   >
   > Odrzucenia są widoczne per limiter w `GET /api/health/aggregated`
   > (`components.metrics.details.rateLimitHits`, też jako `rate_limit_hits_total`)
   > oraz w dławionych podsumowaniach `[RateLimit]`, które podają nazwę limitera,
   > wolumen i liczbę odrębnych źródeł — bez adresu, IP i klucza.

   Ścieżka współdzielona jest **przygotowana i wyłączona**; włączenie jej jest
   osobną decyzją operacyjną, nie skutkiem ubocznym tego pakietu.
2. **Enumeracja na rejestracji jest ograniczona, nie usunięta** — patrz sekcja wyżej.
   Pełne domknięcie wymaga rozdzielenia rejestracji od wejścia (potwierdzenie mailem
   przed provisioningiem), czyli decyzji produktowej Piotra.
3. **`optionalAuth` też przechodzi przez guard.** Wygasły principal demo dostanie
   `403` na trasie publicznej z opcjonalnym tokenem, zamiast być potraktowany jako
   anonim. Kierunek jest bezpieczny (fail closed) i dotyczy tylko kont efemerycznych.
4. **Read-only publicznego demo jest bezwarunkowe.** `DEMO_WRITES_ENABLED=true`
   **nie** odblokuje zapisu dla konta z publicznej rejestracji (nadal działa dla
   ścieżki nagłówkowej innych użytkowników demo). Jeśli interaktywne demo z zapisem
   ma kiedyś objąć prospektów, to osobna, jawna decyzja.
5. **Latencja pierwszego wejścia.** Przy wyłączonym `DEMO_USE_BASE_ORG` seed Atelier
   Toys biegnie synchronicznie w `register-demo`. Do zmierzenia na Railway.
6. **`resolveQuickAccessCredentials` trzyma realne adresy i hasła w kodzie frontu.**
   Trafiają do bundla przeglądarki. PIN `1111` wskazuje konto, które nie istnieje.
   Osobny pakiet — host guarda nie wolno ruszać w tym.
7. **Istniejący `authLimiter` trzyma `auth:<surowy email>` jako klucz Redis.** Nowy
   limiter demo hashuje, stary nie. Osobny pakiet.
8. **Ten sam defekt normalizacji adresu istnieje w `POST /api/auth/register`**
   (ścieżka trialowa). Poza zakresem; poprawka to jeden argument.
9. **Harnessy wymagają teraz `ENABLE_TEST_SUPPORT` + `TEST_SUPPORT_KEY`.** Dodatkowo
   `demo-login` jest domyślnie zamknięty pod vitest (brak klucza) — żaden istniejący
   test na tym nie polegał, ale to zmiana konfiguracji, o której CI musi wiedzieć.
   Skrypty `scripts/claude-verify/*` są wyłączone z użycia do czasu przepięcia na
   bootstrap.
10. **`demoSessionService.startDemoSession` przyjął opcjonalny 4. argument**
    (`sessionOrgId`), żeby saga mogła nazwać własny tenant przed seedem. Zmiana
    addytywna, zachowanie istniejących wywołań bajt w bajt identyczne — ale to plik
    spoza pierwotnego zakresu pakietu i wymaga świadomego przeglądu.
11. **`auth.routes.ts` ma `// @ts-nocheck`**, a `build:backend` to `tsc --noCheck`.
    Pozostałe zmienione pliki backendu są sprawdzone realnym `tsc`; dowodem dla samej
    trasy pozostaje test integracyjny na realnym runtime.

## Stan

`AWAITING_CODEX_REVIEW` — kod i testy lokalne gotowe na gałęzi
`fix/ops-demo-002-public-entry`. Bez merge, bez push na `demo`, bez deployu.
Status `READY_FOR_STAGING` nadaje Codex po przeglądzie kodu; `GO` wymaga wykonania
kroków stagingowych na `https://demo.consultify.ai`.
