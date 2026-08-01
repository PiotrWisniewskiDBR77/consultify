---
doc_id: SEC-PUB-002
truth_type: operations
status: READY_FOR_DECISION
owner: codex
product_owner: piotr
priority: P0
depends_on: SEC-PUB-001
last_reviewed: 2026-08-01
---

# SEC-PUB-002 — publiczna powierzchnia systemowo-diagnostyczna API

## Werdykt

Stan: **FINDING — rejestr do triage'u. W tym pakiecie nie zmieniono ani jednego pliku
poza tym dokumentem.**

Rodziny `/api/system/*`, `/api/system-health/*`, `/api/health/*`, `/ping`, `/test-*`,
`/debug-*`, `/diagnostic-*` dają razem **24 żywe trasy** (plus 1 zamkniętą). Z tych 24
**13 jest anonimowych**, a jedna z nich — `GET /api/system/health` — **potwierdza
anonimowemu klientowi z internetu, że para `admin@dbr77.com` / `123456` jest działającym
poświadczeniem, i przy okazji wypisuje adresy e-mail wszystkich kont ADMIN i SUPERADMIN
z bazy.** To jest powód priorytetu P0 i jedyna pozycja w tym rejestrze, która nie może
czekać na kolejkę.

Druga co do wagi obserwacja jest strukturalna, nie punktowa: **13 z 24 tras jest
montowanych w `index.ts` w liniach 112–150, czyli PRZED całym globalnym łańcuchem
middleware.** Nie obowiązuje ich `helmet`, `cors`, sanityzacja wejścia, CSRF, metryki,
`auditLogMiddleware` ani globalny `apiLimiter`. Osiem z nich nie ma **żadnego** limitera
— ani globalnego, ani routerowego.

`POST /api/system/repair` — pozycja P0 z `SEC-PUB-001` — jest **potwierdzona jako
usunięta** (weryfikacja niżej, sekcja „Pozycja zamknięta").

> **AKTUALIZACJA 2026-08-01, w trakcie pisania tego pakietu — zalecenie 6 wykonane przez
> równoległy strumień (`OPS-DEMO-003`).** `server/src/controllers/HealthCheckController.ts`
> został w tym worktree zmieniony **po** HEAD `3957c486bf`, na którym prowadzono tę analizę:
> `execSync` usunięty w całości (zniknął import `node:child_process`), `gitSha` rozwiązywany
> **raz przy załadowaniu modułu** wyłącznie z env, a `gitBranch` i `gitSource` **usunięte
> z odpowiedzi**. Regresję pilnuje nowy
> `tests/integration/system/health.noChildProcess.contract.test.ts`, który liczy realne
> forki na prawdziwej aplikacji.
>
> Zmiana jest **niezacommitowana** (widoczna jako `M` w `git status`), więc **rejestr
> poniżej celowo opisuje stan na HEAD** — inaczej straciłby kotwicę. Praktyczny skutek:
> **zalecenie 6 jest zrobione, a zalecenie 5 zrealizowane w mocniejszym wariancie**
> (`gitBranch` nie jest chowany za guardem, tylko w ogóle nie wychodzi). Do potwierdzenia
> przy scalaniu, nie do wykonania po raz drugi. Ustalenie U6 pozostaje ważne jako opis
> defektu i jako **sprostowanie ustalenia K3 z `SEC-PUB-001`** — tamten dokument przypisał
> ten `execSync` niewłaściwej trasie i ta pomyłka nadal jest w obiegu.

## Dwa moduły o mylnie podobnych nazwach — rozstrzygnięcie

To rozróżnienie kosztowało program jedną rundę (`SEC-PUB-001`, korekta K1). Ustalane tu
od nowa, z linii montażu:

| Moduł | Import | Montaż | Pod prefiksem | Guardy montażowe | Pozycja w łańcuchu |
| --- | --- | --- | --- | --- | --- |
| `server/src/routes/system-health.routes.ts` (**z myślnikiem**) | `index.ts:109` | `index.ts:150` | `/api/system` | **żadnych** | **przed** globalnym middleware |
| `server/src/routes/systemHealth.routes.ts` (**camelCase**) | `Gateway.ts:282` | `Gateway.ts:643` | `/api/system-health` | `defaultRateLimiter` (`:55`) + `verifySuperAdmin` na 10 z 11 tras | **po** globalnym middleware (Gateway odpala się z `index.ts:1125`) |

Reguła czytania tego dokumentu: **`/api/system/...` = moduł z myślnikiem, bez guardów.
`/api/system-health/...` = moduł camelCase, superadmin.** Wszędzie w tabelach kolumna
„Moduł" podaje to wprost.

Trzeciej możliwości nie ma: `grep` po `app.use('/api/system` i `app.use('/api/health`
w obu plikach zwraca dokładnie cztery montaże (`index.ts:147`, `:148`, `:150`,
`Gateway.ts:643`). `Gateway.ts` **nie montuje** niczego pod `/api/health`.

## Kolejność montażu — dlaczego 13 tras jest poza łańcuchem

`server/src/index.ts` rejestruje trasy zdrowia zaraz po `app.set('trust proxy', 1)`
(`:102`), a globalne middleware dopiero setki linii dalej. Express dopasowuje w kolejności
rejestracji, więc żądanie do `/api/system/health` dostaje odpowiedź i **nigdy** nie dociera
do warstw z dołu pliku.

| Linia | Co jest rejestrowane |
| --- | --- |
| `index.ts:112` | `app.get('/ping', …)` |
| `index.ts:115` | `app.get('/test-frontend-path', …)` |
| `index.ts:147` | `app.use('/api/health', healthRoutes)` |
| `index.ts:148` | `app.use('/api/health', dbHealthRoutes)` |
| `index.ts:150` | `app.use('/api/system', systemHealthRoutes)` |
| — | ↑ **wszystko powyżej jest już obsłużone** ↑ |
| `index.ts:705` | `helmet(...)` — nagłówki bezpieczeństwa |
| `index.ts:944` | `cors(corsOptions)` |
| `index.ts:947`, `:950` | Sentry request/tracing handler |
| `index.ts:954` | `correlationMiddleware` |
| `index.ts:978` | `cookieParser()` |
| `index.ts:1046` | `inputSanitizationMiddleware` |
| `index.ts:1055` | `csrfTokenMiddleware` na `/api/` |
| `index.ts:1066`, `:1069` | metryki i metryki wydajności na `/api/` |
| `index.ts:1075` | **`apiLimiter` na `/api/`** |
| `index.ts:1077` | **`auditLogMiddleware` na `/api/`** |
| `index.ts:1125` | `apiGateway.initializeRoutes(app)` → cały `Gateway.ts` |

Skutki, które trzeba wypowiedzieć wprost:

1. **Zero rate limitingu** na `/ping`, `/test-frontend-path`, `/api/system/health` oraz na
   pięciu trasach z `health.routes.ts` (`/database`, `/connections`, `/data-context`,
   `/ready/rate-limit`, `/rate-limit`) — ten moduł nie ma `router.use(limiter)`. Razem
   **8 tras bez jakiegokolwiek limitera**. Pięć tras z `healthRoutes.ts` ratuje własny
   `router.use(safeRateLimiter)` (`healthRoutes.ts:9-13`).
2. **Zero wpisów audytowych** dla wszystkich 13 — `auditLogMiddleware` (`:1077`) ich nie
   widzi. Odpytywanie `/api/system/health` nie zostawia śladu w `audit_logs`.
3. **Brak nagłówków `helmet`** i brak polityki CORS na tych 13 odpowiedziach.
4. Odwrotnie: **`/api/system-health/*` jest w łańcuchu** — Gateway startuje z `:1125`,
   czyli za `apiLimiter` i za `auditLogMiddleware`. Kontrast między bliźniakami jest więc
   podwójny: nie tylko guardy, ale i cała warstwa globalna.

## Rejestr — 24 trasy żywe + 1 zamknięta

Legenda: **Łańcuch** = middleware, które realnie dochodzi do handlera (globalne warstwy
z tabeli wyżej pomijają 13 tras — zaznaczone jako `—` z przypisem „poza łańcuchem");
**Klasa** = `PS` public-safe · `SA` superadmin-only · `TO` test-only · `DEL` delete.

### A. `/api/system/*` — moduł `system-health.routes.ts` (1 trasa)

| M | Ścieżka | Plik:linia | Moduł | Łańcuch | Koszt | Ujawnia | Klasa |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/system/health` | `routes/system-health.routes.ts:375` | z myślnikiem (`index.ts:150`) | **brak — zero middleware**, poza łańcuchem | **12 zapytań SQL sekwencyjnie** + **1 × `bcrypt.compare`** | adresy e-mail wszystkich adminów, para `admin@dbr77.com`/`123456`, nazwy tabel, nazwy zmiennych env, dostawcy LLM, statystyki puli, tekst błędów DB | **DEL** |

### B. `/api/system-health/*` — moduł `systemHealth.routes.ts` (11 tras)

Wszystkie montowane z `Gateway.ts:643`, wszystkie za `defaultRateLimiter`
(`systemHealth.routes.ts:55`) i za pełnym łańcuchem globalnym.

| M | Ścieżka | Plik:linia | Łańcuch | Koszt | Ujawnia | Klasa |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/system-health` | `:75` | `defaultRateLimiter` — **BRAK `verifySuperAdmin`** | 4 zapytania (`checkDb` 1, `checkAIServices` 1, `getErrorRate` 2) | wersja Node, `NODE_ENV`, uptime, pamięć proces/host, `loadavg`, liczba CPU, typ i latencja bazy, odsetek błędów 5xx, którzy dostawcy LLM mają klucz | **SA** (do naprawy) |
| GET | `/api/system-health/detailed` | `:100` | `defaultRateLimiter` + `verifySuperAdmin` | jw. | jw. | **SA** ✔ |
| GET | `/api/system-health/metrics` | `:126` | `defaultRateLimiter` + `verifySuperAdmin` | `SystemHealthService.getMetrics()` | metryki DB/API/AI | **SA** ✔ |
| GET | `/api/system-health/services` | `:152` | `defaultRateLimiter` + `verifySuperAdmin` | `getServiceStatus()` | status usług | **SA** ✔ |
| POST | `/api/system-health/refresh` | `:178` | `defaultRateLimiter` + `verifySuperAdmin` | jak `/detailed` | jw. | **SA** ✔ |
| GET | `/api/system-health/alerts` | `:202` | `defaultRateLimiter` + `verifySuperAdmin` | lazy DDL + `SELECT *` | konfiguracja alertów i kanałów | **SA** ✔ |
| POST | `/api/system-health/alerts` | `:221` | `defaultRateLimiter` + `verifySuperAdmin` | DDL + `INSERT` + `SELECT` | — | **SA** ✔ |
| PUT | `/api/system-health/alerts/:id` | `:249` | `defaultRateLimiter` + `verifySuperAdmin` | DDL + 3 zapytania | — | **SA** ✔ |
| PUT | `/api/system-health/alerts/:id/toggle` | `:284` | `defaultRateLimiter` + `verifySuperAdmin` | DDL + 3 zapytania | — | **SA** ✔ |
| DELETE | `/api/system-health/alerts/:id` | `:310` | `defaultRateLimiter` + `verifySuperAdmin` | DDL + 2 zapytania | — | **SA** ✔ |
| GET | `/api/system-health/encryption` | `:333` | `defaultRateLimiter` + `verifySuperAdmin` | `KeyManagementService.checkHealth()` | wersja klucza, status kluczy, lista problemów | **SA** ✔ |

### C. `/api/health/*` — dwa moduły pod jednym prefiksem (10 tras)

`healthRoutes.ts` montowany z `index.ts:147`, `health.routes.ts` z `index.ts:148`.
Oba **poza globalnym łańcuchem**.

| M | Ścieżka | Plik:linia | Moduł | Łańcuch | Koszt | Ujawnia | Klasa |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/health/ping` | `routes/healthRoutes.ts:16` | `healthRoutes` | `safeRateLimiter` (`:13`) | zero | nic (`'pong'`) | **PS** |
| GET | `/api/health` | `routes/healthRoutes.ts:19` → `HealthCheckController.checkHealth:68` | `healthRoutes` | `safeRateLimiter` | 1 × `SELECT 1` (timeout 800 ms), sonda Redis, **`2 × execSync('git rev-parse …')` gdy brak env** — *usunięte po HEAD przez `OPS-DEMO-003`* | **`gitSha`, `gitBranch`, `gitSource`**, wersja pakietu, `NODE_ENV`, stan i latencja bazy, stan Redis — *`gitBranch`/`gitSource` usunięte po HEAD* | **SA** (do naprawy) |
| GET | `/api/health/ready` | `routes/healthRoutes.ts:22` → `checkReadiness:171` | `healthRoutes` | `safeRateLimiter` | 1 × `SELECT 1` + sonda Redis + `metricsService.getMetrics()` | trzy wartości logiczne (`database`/`redis`/`metrics`) | **PS** |
| GET | `/api/health/live` | `routes/healthRoutes.ts:25` → `checkLiveness:252` | `healthRoutes` | `safeRateLimiter` | zero | uptime procesu | **PS** |
| GET | `/api/health/aggregated` | `routes/healthRoutes.ts:28` → `aggregatedHealth:264` | `healthRoutes` | `safeRateLimiter` | 1 × `SELECT 1` + odczyt watchdoga i metryk | ruch API (`totalRequests`), liczba i odsetek 5xx, **`p95Ms`**, `rateLimitHits`, `aiTimeouts`, uptime, **`e.message` błędu bazy** (`:274`) | **SA** (do naprawy) |
| GET | `/api/health/database` | `routes/health.routes.ts:41` | `dbHealthRoutes` | **brak limitera** | zero SQL (odczyt statystyk z pamięci) | rozmiar i obłożenie puli połączeń, uptime w %, liczba awarii, średni czas odpowiedzi | **SA** (do naprawy) |
| GET | `/api/health/connections` | `routes/health.routes.ts:87` | `dbHealthRoutes` | **brak limitera** | zero SQL | pula: `active`/`idle`/`total` + procenty | **SA** (do naprawy) |
| GET | `/api/health/data-context` | `routes/health.routes.ts:121` | `dbHealthRoutes` | `verifyToken` | zero SQL, rozwiązanie URL bazy z env | **hostname i nazwa bazy** (`:143-152`), `DB_READONLY`, e-mail i id zalogowanego użytkownika, id organizacji, cała polityka demo (`demoOrgId`, `approvedBy`), `NODE_ENV`, `APP_ENV`, **`RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_SERVICE_NAME`** | **SA** (do podniesienia z `verifyToken`) |
| GET | `/api/health/ready/rate-limit` | `routes/health.routes.ts:217` | `dbHealthRoutes` | **brak limitera** | `probeRateLimiterHealth()` — 2 inkrementacje losowego klucza | wyłącznie `ready` / `not ready` — świadomie bez szczegółów (komentarz `:200-215`) | **PS** |
| GET | `/api/health/rate-limit` | `routes/health.routes.ts:257` | `dbHealthRoutes` | `verifyToken` + `requireSuperAdmin` | `resolveRateLimitStartupConfig` + sonda | aktywny store, fail mode, `bypassed`, liczniki per limiter | **SA** ✔ |

### D. `/ping`, `/test-*`, `/debug-*`, `/diagnostic-*` — trasy deklarowane wprost w `index.ts` (2 trasy)

To jest ta warstwa, którą łatwo przeoczyć: nie ma tu żadnego routera, są `app.get(...)`
w pliku wejściowym, przed Gatewayem.

| M | Ścieżka | Plik:linia | Łańcuch | Koszt | Ujawnia | Klasa |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/ping` | `index.ts:112` → `HealthCheckController.ping:59` | **brak** | zero | nic — `res.status(200).send('pong')` | **PS** |
| GET | `/test-frontend-path` | `index.ts:115` | **brak** | 6 × `fs.existsSync` + do 2 dodatkowych | **`__dirname`**, `NODE_ENV`, istnienie `/app/dist` i dwóch ścieżek względnych, `frontendDistPath`, `globalFrontendDistPath` — czyli układ katalogów kontenera Railway | **DEL** |

**`/debug-*` i `/diagnostic-*`: zero trafień.** `grep -rE "(app|router)\.(get|post|use)\(\s*\[?'/[^']*(debug|diagnostic)"` po całym `server/src/` nie zwraca nic. Jedyne wystąpienia słowa „diagnostic" w `index.ts` (`:685`, `:2212`) to komentarze przy inicjalizacji sentinela dostawców AI i przy obsłudze wyjścia procesu — nie trasy.

Sprawdzone też warianty poza `index.ts`, żeby nie zamknąć rodziny za wcześnie:
`sellix.routes.ts:47` (`POST /test-event`) i `llm.routes.ts:682` (`POST /test-ollama`,
za `verifySuperAdmin`) to trasy **wewnątrz** routerów biznesowych, nie w rodzinie
`/test-*` na poziomie aplikacji.

### Pozycja zamknięta — `POST /api/system/repair`

Potwierdzone na tej gałęzi, nie przyjęte z poprzedniego pakietu:

- `server/src/routes/system-health.routes.ts:426-444` zawiera wyłącznie komentarz
  w miejscu handlera; `router.post` w tym pliku **nie występuje**;
- jedyne trafienia na `child_process` w pliku to słowa w tekście komentarza (`:430`,
  `:439`) — **brak importu, brak wywołania**;
- regresję pilnuje `tests/integration/systemHealthRepairRemoved.contract.test.ts`
  (plik istnieje).

Konsument był martwy podwójnie i to również potwierdzam własnym pomiarem:
`src/views/SystemHealthDashboard.tsx` **nie jest nigdzie importowany**
(`grep -rn "SystemHealthDashboard" src/` poza samą definicją → zero trafień), a wołał
`/api/system/health/repair` (`:48`), czyli ścieżkę, która nigdy tam nie prowadziła.

**Pozycja pozostaje w rejestrze jako zamknięta, nie jest pomijana.**

---

## Ujawnienia potwierdzone lekturą handlera

Każda pozycja niżej została przeczytana w kodzie, nie wywnioskowana z nazwy trasy.

### U1. `admin@dbr77.com` / `123456` — anonimowa wyrocznia poświadczenia (P0)

`server/src/routes/system-health.routes.ts:181-230`, funkcja `checkDefaultLogin()`,
wołana bezwarunkowo z handlera `GET /health` (`:383`):

```
const testEmail = 'admin@dbr77.com';      // :184
const testPassword = '123456';            // :185
const user = await db.query('SELECT * FROM users WHERE email = $1', [testEmail]);  // :187
const isValid = await bcrypt.compare(testPassword, user.rows[0].password);         // :200
```

Para trafia do odpowiedzi w **każdej z trzech gałęzi**, nie tylko w błędzie:

| Gałąź | Linia | Co wraca |
| --- | --- | --- |
| użytkownik nie istnieje | `:194` | `details: { email: 'admin@dbr77.com', password: '123456' }` |
| hasło się nie zgadza | `:207` | `details: { email: 'admin@dbr77.com', password: '123456' }` |
| **hasło działa** | `:216-220` | `status: 'healthy'`, `message: 'Default credentials working'`, `details: { email, password, role: <rola konta> }` |

Trzeci wiersz jest sednem: anonimowy `GET /api/system/health` zwraca **pozytywne
potwierdzenie**, że `admin@dbr77.com` + `123456` to działający login, razem z rolą tego
konta. To nie jest wyciek konfiguracji — to gotowe poświadczenie podane w odpowiedzi
HTTP. Trasa nie ma limitera i nie zostawia wpisu audytowego.

Uwaga o wadze: nawet gdyby to hasło było już zmienione, dwie pozostałe gałęzie nadal
publikują adres konta administracyjnego i sam fakt, że jest sprawdzane.

### U2. Lista adresów e-mail wszystkich administratorów (P0)

`system-health.routes.ts:133-136` i `:162-166`, funkcja `checkUsers()`:

```
const admins = await db.query(`SELECT email, role FROM users WHERE role IN ('ADMIN','SUPERADMIN')`, []);
…
admins: admins.rows.map((a) => ({ email: a.email, role: a.role }))
```

Odpowiedź `GET /api/system/health` zawiera **komplet adresów e-mail kont ADMIN
i SUPERADMIN wraz z rolami**, plus `userCount` z `SELECT COUNT(*) as count FROM users`
(`:129`) — czyli rozmiar bazy użytkowników. Anonimowo. To gotowa lista celów do
phishingu i credential stuffingu.

### U3. Koszt `GET /api/system/health` — 12 zapytań i `bcrypt` na żądanie

Policzone z handlera (`:375-408`), zapytania idą **sekwencyjnie**, bez `Promise.all`:

| Funkcja | Zapytania |
| --- | --- |
| `checkDatabase()` `:44` | 1 (`SELECT 1`) |
| `checkTables()` `:67` | 5 × `information_schema.tables` (pętla po `users`, `organizations`, `sessions`, `projects`, `refresh_tokens`) |
| `checkUsers()` `:113` | 3 (`information_schema`, `COUNT(*) FROM users`, `SELECT email, role FROM users WHERE role IN …`) |
| `checkDefaultLogin()` `:181` | 1 (`SELECT * FROM users WHERE email = $1`) **+ `bcrypt.compare`** |
| `checkLLMProviders()` `:235` | 2 (`information_schema`, `SELECT name, provider, is_active FROM llm_providers`) |
| `checkEnvironment()` `:291` | 0 |
| `checkConnectionPool()` `:325` | 0 |
| **razem** | **12 zapytań + 1 `bcrypt.compare`** |

`SELECT COUNT(*) as count FROM users` to pełny skan tabeli użytkowników. `bcrypt.compare`
jest z definicji kosztowny obliczeniowo (to jego funkcja) i blokuje pulę. Trasa nie ma
**żadnego** limitera. Pętla żądań na tej ścieżce to jednocześnie wyczerpywanie puli
połączeń i wyczerpywanie CPU — tanim kosztem po stronie atakującego.

### U4. Nazwy tabel, nazwy zmiennych env, dostawcy LLM

Na tej samej trasie:

- `:70` — lista tabel krytycznych; `:95-96` — które z nich **brakuje** i które są
  (`details: { missing, existing }`). Mapa schematu podana wprost;
- `:292`, `:309`, `:315` — `NODE_ENV`, `JWT_SECRET`, `DATABASE_URL` jako **nazwy**
  w polach `present` / `missing`. **Wartości nie są ujawniane** — to rozróżnienie jest
  istotne i nie należy go zawyżać. Ujawniona jest jednak obecność/nieobecność sekretu,
  co samo w sobie jest sygnałem konfiguracyjnym;
- `:250`, `:272-275` — nazwy i vendorzy aktywnych dostawców LLM (`name`, `provider`).
  **Klucze API nie wchodzą do odpowiedzi** — zapytanie wybiera `is_active`, nie `api_key`;
- `:339-359` — statystyki puli połączeń (`active`, `idle`, `total`, `waiting`).

### U5. Tekst błędów bazy w odpowiedzi (nie stack trace)

`system-health.routes.ts:58`, `:104`, `:172`, `:226`, `:284`, `:418` — wzorzec
`message: \`… failed: ${error}\``. To interpolacja obiektu błędu, czyli `"Error: <treść>"`
— **nie stack trace**. Ale komunikaty sterownika `pg` potrafią nieść nazwę bazy, hosta
i relacji. Ten sam kształt jest w `HealthCheckController.aggregatedHealth`
(`:274`: `details: e.message`) na anonimowym `/api/health/aggregated`.

**Nie stwierdzam wycieku stack trace w tych rodzinach** — nie znalazłem miejsca, które
serializowałoby `error.stack`.

### U6. `gitSha` i `gitBranch` w odpowiedzi — i sprostowanie do `SEC-PUB-001` K3

`HealthCheckController.checkHealth` (`:88-91`) dokłada do odpowiedzi `gitSha`,
`gitBranch` i `gitSource`. Źródłem jest `getGitMeta()` (`:12-53`), które przy braku
`RAILWAY_GIT_COMMIT_SHA` / `GITHUB_SHA` / `GIT_SHA` i odpowiedników dla gałęzi wywołuje:

```
execSync('git rev-parse --short HEAD',       …)   // :36
execSync('git rev-parse --abbrev-ref HEAD',  …)   // :41
```

**Korekta do `SEC-PUB-001`, ustalenie K3.** Tamten dokument przypisał ten `execSync`
trasie `/ping`. To jest **nieprawda**. `HealthCheckController.ping` (`:59-61`) to
w całości `res.status(200).send('pong')` — nie woła `getGitMeta()` i nie dotyka
`child_process`. Jedynym wywołaniem `getGitMeta()` w repozytorium jest
`HealthCheckController.ts:88`, wewnątrz `checkHealth`. Weryfikacja:
`grep -rn "HealthCheckController\." server/src/` daje siedem trafień i żadne nie łączy
`ping` z `getGitMeta`.

Wniosek `SEC-PUB-001` (istnieje drugi anonimowy shell-out) **zostaje w mocy**, ale trasa
jest inna:

| | `SEC-PUB-001` K3 | Stan faktyczny |
| --- | --- | --- |
| Trasa | `GET /ping` (`index.ts:112`) | **`GET /api/health`** (`healthRoutes.ts:19`) |
| Anonimowa | tak | tak |
| Limiter | brak | `safeRateLimiter` (`healthRoutes.ts:13`) |
| `execSync` | — | 2 × przy braku zmiennych git w env |

Ocena wagi bez zmian względem K3: argumenty są **stałe**, więc **nie ma wstrzyknięcia
polecenia**; na Railway zmienne git są ustawione, więc ścieżka `execSync` jest zwykle
martwa; w środowisku bez tych zmiennych każde anonimowe żądanie forkuje dwa procesy
**synchronicznie**, blokując pętlę zdarzeń. Waga niższa niż U1 — ale `/ping`,
w przeciwieństwie do `/api/health`, jest w tej sprawie **czysty**.

Osobno: `gitBranch` na produkcji ujawnia **nazwę gałęzi wdrożeniowej** (np. `demo`,
`Londyn`), a `gitSha` — dokładną rewizję. To ujawnienie struktury wdrożenia, nie awaria.

**Stan po HEAD:** cały akapit U6 opisuje kod na `3957c486bf`. W worktree jest już poprawka
`OPS-DEMO-003` (niezacommitowana), która usuwa `execSync` i `gitBranch` — patrz
„AKTUALIZACJA" na początku dokumentu. Sprostowanie K3 pozostaje aktualne niezależnie od
poprawki: `/ping` nigdy nie forkował procesu.

### U7. `GET /api/system-health` — publiczny profil infrastruktury

`systemHealth.routes.ts:75` nie ma `verifySuperAdmin`, choć komentarz nad nim mówi
wprost „Basic health check (public)". Handler woła `SystemHealthService.getDetailedHealth()`
— **tę samą funkcję**, którą serwuje chroniony `/detailed` (`:100`). Różnicą jest
wyłącznie guard, nie treść.

Z `server/src/services/systemHealthService.ts:113-156` wraca:
wersja Node (`process.version`), `NODE_ENV`, uptime, zużycie pamięci procesu i **pamięć
całkowita hosta**, `os.loadavg()`, liczba rdzeni, typ i latencja bazy, `errorRatePercent`
oraz `ai.providers` — trzy wartości logiczne mówiące, **dla których dostawców LLM
skonfigurowano klucz**.

Sprawdzone osobno, bo brzmi groźniej niż jest: `checkAIServices()` (`:182-205`) wybiera
`SELECT provider, api_key FROM llm_providers`, ale **wartość klucza nigdy nie wchodzi do
odpowiedzi** — testowana jest wyłącznie prawdziwość (`if (row.api_key) providers.x = true`).
Wyciek klucza: **nie ma**. Wyciek informacji „który dostawca jest skonfigurowany": jest.

To potwierdza ustalenie K4 z `SEC-PUB-001` i podaje mu treść, której tamten dokument nie
miał (K4 stwierdzał sam fakt `200` bez poświadczenia).

### U8. `GET /api/health/data-context` — najbogatsze ujawnienie w tych rodzinach

`health.routes.ts:121-198`, jedyny guard to `verifyToken` — czyli **dowolny zalogowany
użytkownik**, w tym konto demo założone przez publiczne `Try demo`. W odpowiedzi:

- `database.host` — hostname bazy (`:143-151`), `database.name` (`:152`), `DB_READONLY`;
- `user.email`, `user.id`, `organization.activeOrganizationId` (`:155-163`);
- pełna polityka demo: `demoOrgId`, `demoOrgName`, `defaultDemoOrgId`,
  `usesNonDefaultDemoOrgId`, `explicitApprovalEnabled`, `approvedBy` (`:169-176`);
- `NODE_ENV`, `APP_ENV`, `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_SERVICE_NAME` (`:182-187`).

Hostname bazy i nazwy zasobów Railway za samym `verifyToken` to za mało, biorąc pod uwagę,
że `OPS-DEMO-002` właśnie otwiera publiczną rejestrację demo. `user.email` w odpowiedzi
dotyczy **wołającego**, nie cudzych kont — to nie jest wyciek między najemcami.

### Czego nie rozstrzygnąłem statycznie

Zgodnie ze złotą regułą #1 zgłaszam zamiast zgadywać:

1. **Dialekt SQL w `systemHealthService.getErrorRate()`** (`:428-432`) używa
   `datetime('now','-1 hour')` — składni SQLite — przy bazie PostgreSQL. Prawdopodobnie
   rzuca wyjątkiem, jest łapany, a `errorRatePercent` wychodzi `0`. **Nie potwierdzam
   tego z lektury** — zależy od translacji w `DbPromise`. Ten sam znak zapytania dotyczy
   CRUD alertów w `systemHealth.routes.ts:23-33` i `:237-245` (placeholdery `?`,
   `INTEGER`, `TEXT PRIMARY KEY`). Do rozstrzygnięcia jednym żywym żądaniem, nie lekturą.
2. **Kształt odpowiedzi `/api/system-health/metrics` i `/services`** zależy od gałęzi
   `SystemHealthService`, których nie przeszedłem do końca — obie są za `verifySuperAdmin`,
   więc nie wpływają na klasyfikację. **Nie twierdzę nic o ich ujawnieniach.**
3. **Nie weryfikowano tego na żywym środowisku.** Cały rejestr pochodzi ze statycznej
   analizy montażu i łańcuchów middleware na `fix/ops-demo-003-public-system-surface`,
   HEAD `3957c486bf`. Każdą pozycję przed naprawą potwierdzić `curl`-em bez nagłówka
   `Authorization` — zaczynając od `GET /api/system/health`.

---

## Klasyfikacja czterodzielna

| Klasa | Liczba | Trasy |
| --- | --- | --- |
| **public-safe** | **5** | `GET /ping` · `GET /api/health/ping` · `GET /api/health/live` · `GET /api/health/ready` · `GET /api/health/ready/rate-limit` |
| **superadmin-only** | **17** | 10 tras `/api/system-health/*` z guardem + `GET /api/health/rate-limit` (**11 już poprawnych**) · `GET /api/system-health` · `GET /api/health` · `GET /api/health/aggregated` · `GET /api/health/database` · `GET /api/health/connections` (**5 do domknięcia z anonimowego**) · `GET /api/health/data-context` (**1 do podniesienia z `verifyToken`**) |
| **test-only** | **0** | — (uzasadnienie niżej) |
| **delete** | **2** | `GET /api/system/health` · `GET /test-frontend-path` |
| **razem żywe** | **24** | |
| zamknięte wcześniej | 1 | `POST /api/system/repair` (usunięta 2026-08-01) |

### Uzasadnienia — po jednej linii na trasę

**public-safe (5)** — kryterium: sonda musi działać bez poświadczenia (odpytuje ją load
balancer), a odpowiedź nie niesie nic ponad werdykt.

| Trasa | Uzasadnienie |
| --- | --- |
| `GET /ping` | Handler to jedno `send('pong')` — zero kosztu, zero treści, zero `child_process`. |
| `GET /api/health/ping` | Ten sam handler kontrolera; duplikat `/ping`, ale nieszkodliwy i za limiterem. |
| `GET /api/health/live` | Zwraca tylko `alive` + uptime; uptime nie jest sekretem dla sondy żywotności. |
| `GET /api/health/ready` | Trzy wartości logiczne bez szczegółów; taka jest funkcja sondy gotowości. |
| `GET /api/health/ready/rate-limit` | Świadomie bezszczegółowa — komentarz `health.routes.ts:200-215` uzasadnia to wprost i kod się z tym zgadza. |

**superadmin-only (17)** — kryterium: treść opisuje stan infrastruktury, a nie „czy żyje";
czytelnik bez uprawnień operatora nie ma z niej pożytku, atakujący ma.

| Trasa | Uzasadnienie |
| --- | --- |
| 10 × `/api/system-health/*` z `verifySuperAdmin` | Stan poprawny — wzorzec do naśladowania, nic do zrobienia. |
| `GET /api/health/rate-limit` | Stan poprawny: `verifyToken` + `requireSuperAdmin`, uzasadnione komentarzem `:239-255`. |
| `GET /api/system-health` | Woła **tę samą** `getDetailedHealth()` co chroniony `/detailed` — brak guarda jest niespójnością, nie decyzją. |
| `GET /api/health` | Ujawnia `gitSha`/`gitBranch` i w środowisku bez env forkuje 2 procesy na żądanie. |
| `GET /api/health/aggregated` | `p95Ms`, odsetek 5xx i `rateLimitHits` to mapa obciążenia — mówi atakującemu, czy jego ruch działa. |
| `GET /api/health/database` | Rozmiar puli, obłożenie i historia awarii to profil pojemnościowy. |
| `GET /api/health/connections` | Jak wyżej, węższy zakres, ta sama klasa. |
| `GET /api/health/data-context` | Hostname i nazwa bazy plus nazwy zasobów Railway — `verifyToken` przepuszcza tu każde konto demo. |

**test-only (0)** — kategoria pusta i to jest ustalenie, nie przeoczenie. W tych siedmiu
rodzinach nie ma trasy, którą warto **zachować** za flagą środowiskową. Dwa kandydatury
z nazwy (`/test-frontend-path` oraz — poza rodzinami — `/api/test-support/*`) rozstrzygają
się inaczej: pierwsza to zwykłe usunięcie, druga leży poza zakresem tego rejestru i ma
własną bramkę (opis niżej).

**delete (2)** — kryterium: trasa nie da się naprawić samym dodaniem guarda, bo problemem
jest jej treść, a realnego konsumenta nie ma.

| Trasa | Uzasadnienie |
| --- | --- |
| `GET /api/system/health` | Guard nie usuwa defektu: sprawdzanie zaszytego hasła `123456` i odsyłanie go w odpowiedzi jest złe także dla superadmina; reszta treści dubluje `/api/system-health/detailed`; jedyny konsument w `src/` (`SystemHealthDashboard.tsx:34`) jest **martwy** — plik nie jest nigdzie importowany. Usunięcie trasy zwalnia cały montaż `app.use('/api/system', …)` (`index.ts:150`), bo to jedyna trasa tego routera. |
| `GET /test-frontend-path` | **Zero konsumentów** — `grep -rl "test-frontend-path" src/` nie zwraca nic; ujawnia `__dirname` i układ katalogów kontenera; jej użyteczna część (rozwiązana ścieżka `dist`) była w `/api/build-info` — **KOREKTA: ta trasa nie miała realnego odbiorcy** (wpis w `src/services/api.ts:330` to allowlista, nie wywołanie) i została usunięta razem z trzema pozostałymi wariantami. |

---

## Co musi się zmienić, zanim `demo.consultify.ai` zostanie wystawione publicznie

Kolejność jest kolejnością wykonania, nie listą życzeń.

### Blokujące (P0) — dwie pozycje

1. **Usunąć `GET /api/system/health` razem z montażem `index.ts:150`.**
   Nie dodawać guarda. Trasa anonimowo potwierdza działające poświadczenie administratora
   (U1) i wypisuje adresy wszystkich adminów (U2). Po usunięciu trasy moduł
   `routes/system-health.routes.ts` zostaje pusty — do skasowania w całości, tak jak
   `POST /repair` skasowano wcześniej. Regresję zabezpieczyć testem na wzór
   `tests/integration/systemHealthRepairRemoved.contract.test.ts`, z asercją zgodną
   z ustaleniem K2 z `SEC-PUB-001`: **nie** „zwraca 404", tylko „nieodróżnialna od trasy,
   której nigdy nie było" (aplikacja odpowiada `401` na nieznane `/api/*`).
2. **Usunąć zaszyte poświadczenie z repozytorium.** Nawet po skasowaniu trasy literały
   `admin@dbr77.com` i `123456` nie powinny zostać w kodzie serwera. Osobno — pytanie
   operacyjne do właściciela, poza kodem: **czy to konto i to hasło istnieją dziś na
   PROD i na demo?** Jeśli tak, hasło do natychmiastowej zmiany, niezależnie od losu
   trasy. Tego nie sprawdzałem — wymaga zapytania do żywej bazy, a nie lektury kodu.

### Przed wystawieniem, nie blokujące (P1) — sześć pozycji, z czego 2 już wykonane

> Pozycje 5 i 6 zamknął w tym worktree równoległy strumień `OPS-DEMO-003` (zmiana
> niezacommitowana — patrz „AKTUALIZACJA" na początku). Zostają na liście, żeby przy
> scalaniu było widać, że zostały **potwierdzone**, a nie pominięte.

3. `GET /api/system-health` (`systemHealth.routes.ts:75`) → dołożyć `verifySuperAdmin`,
   dokładnie jak `/detailed` w tym samym pliku. Zmiana jednego argumentu.
4. `GET /api/health/aggregated`, `GET /api/health/database`, `GET /api/health/connections`
   → za `verifyToken` + `requireSuperAdmin`. Jeśli monitoring zewnętrzny naprawdę tego
   potrzebuje, właściwą odpowiedzią jest osobna, bezszczegółowa sonda na wzór
   `/api/health/ready/rate-limit`, a nie otwarcie pełnej treści.
5. ~~`GET /api/health` → usunąć `gitSha`/`gitBranch`/`gitSource` z odpowiedzi anonimowej~~
   → **ZROBIONE poza tym pakietem** (`OPS-DEMO-003`, zmiana niezacommitowana — patrz
   „AKTUALIZACJA" na początku). `gitBranch` i `gitSource` nie wychodzą już wcale;
   `gitSha` zostaje świadomie, bo czyta go weryfikacja wdrożenia. **Do potwierdzenia przy
   scalaniu, nie do powtórzenia.**
6. ~~`HealthCheckController.getGitMeta()` → policzyć **raz przy starcie** i zapamiętać, albo
   wymagać zmiennych env i nie sięgać po `git` w runtime.~~ → **ZROBIONE poza tym pakietem**
   (`OPS-DEMO-003`): `execSync` usunięty, wartość rozwiązywana raz przy załadowaniu modułu
   wyłącznie z env, pokrycie
   `tests/integration/system/health.noChildProcess.contract.test.ts`. Ścieżka żądania jest
   wolna od `child_process` niezależnie od guarda (U6). **Do potwierdzenia przy scalaniu.**
7. `GET /api/health/data-context` → podnieść z `verifyToken` do
   `verifyToken` + `requireSuperAdmin`. Dziś przepuszcza każde konto demo do hostname'u
   bazy i nazw zasobów Railway.
8. `GET /test-frontend-path` (`index.ts:115`) → usunąć.

### Higiena strukturalna (P2) — jedna pozycja, ale najtrwalsza

9. **Przenieść montaże z `index.ts:112-150` poniżej globalnego łańcucha** (za `:1077`),
   zostawiając przed nim wyłącznie trasy z kategorii public-safe, które muszą odpowiadać
   nawet przy zapchanym limiterze — realnie `/ping`. Dopóki tego nie ma, każda przyszła
   trasa dopisana w tym rejonie pliku odziedziczy brak limitera, brak audytu i brak
   `helmet` **po cichu**. To jest ta sama klasa pułapki co „kod jest, podłączeń nie ma":
   guard istnieje w projekcie i po prostu nie dotyczy tych tras.
10. **Konfiguracja Railway do potwierdzenia przed wystawieniem** (nie kod):
    `ENABLE_TEST_SUPPORT` i `TEST_SUPPORT_KEY` **nieustawione** — patrz sekcja niżej,
    powód jest inny niż podawał `SEC-PUB-001`.

---

## Poza rodzinami, ta sama klasa problemu

Zgłaszam, nie rozszerzam pakietu. Poniższe trasy nie pasują do siedmiu wzorców ze
zlecenia, ale są dokładnie tym samym: anonimowa diagnostyka o realnym koszcie lub
ujawnieniu. **Żadna nie jest tu naprawiana ani szczegółowo audytowana.**

| # | Trasa | Plik:linia | Dlaczego ta sama klasa |
| --- | --- | --- | --- |
| Z1 | `GET /__build-info`, `GET /api/build-info` | `index.ts:1185` | **USUNIĘTE.** Dostępność przed usunięciem: `/__build-info` **anonimowa**; `/api/build-info` **za wcześniejszym auth catch-all** (`index.ts:222`, przed handlerem ~`:1175`), więc wymagała tokenu. Obie i tak zbędne i obie ujawniały dane po dotarciu do handlera. Czyta `index.html`, a potem **`readdirSync` po całym katalogu `assets/` i `readFileSync` KAŻDEGO pliku `.js`** (`:1251-1270`) — na każde żądanie, synchronicznie. Przy typowym buildzie Vite to dziesiątki megabajtów odczytu i skanowania bez limitera na wariancie `/__build-info`. Ujawnia bezwzględne ścieżki: `frontendDistPath`, `indexPath`, `bundleFsPath`. Wariant `/api/build-info` był w `src/services/api.ts:330` na liście ścieżek — to dopisek do allowlisty, nie wywołanie; **aktywnego konsumenta nie ma żadnego** (przeszukane: frontend, backend, skrypty, CI, Dockerfile, `railway.json`, Playwright, testy, runbooki, oraz nazwy pól odpowiedzi). Historia: `6dc4063fef` dodał trasę razem z tym wpisem dla wywołującego, którego nigdy nie napisano. |
| Z2 | `GET /__build-graph`, `GET /api/build-graph` | `index.ts:1285` | To samo, cięższe: buduje graf importów przechodząc **wszystkie** chunki i zwraca ścieżki plików oraz brakujące importy. Anonimowo. Najdroższa trasa, jaką znalazłem w całym przeglądzie. |
| Z3 | `GET /api/ready` | `index.ts:192` | Anonimowa sonda gotowości zadeklarowana wprost w `index.ts`, **przed** globalnym łańcuchem (jak 13 tras z rejestru). Treść jest skromna, ale w gałęzi niegotowej zwraca `error: dbInitError` (`:203`) — surowy komunikat błędu inicjalizacji bazy. Klasyfikacja bliska public-safe, wymaga jednej poprawki: nie odsyłać `dbInitError`. |
| Z4 | `GET /vts` | `index.ts:1698` | Nie diagnostyka, ale ta sama półka „doklejone w `index.ts`": stałe przekierowanie na `/invite/<64-znakowy token>` **zapisany w kodzie na stałe**. Token zaproszenia w repozytorium i w odpowiedzi HTTP dla każdego, kto zgadnie trzyliterową ścieżkę. Do decyzji właściciela — czy fala VTS jest zamknięta i czy link może zniknąć. |

### Z5. Korekta do `SEC-PUB-001` — `/api/test-support` jest montowane **bezwarunkowo**

`SEC-PUB-001` podaje, że `/api/test-support/*` jest „montowane tylko przy `NODE_ENV=test`
**i** `ENABLE_TEST_SUPPORT=true` (`Gateway.ts:355-358`)". To opis **pierwszego** montażu.
Istnieje **drugi**, w `Gateway.ts:638`, i jest bezwarunkowy.

Zweryfikowane licznikiem głębokości nawiasów po całym `Gateway.ts` (z pominięciem
literałów i komentarzy), nie na oko:

| Linia | Głębokość | Znaczenie |
| --- | --- | --- |
| `355-358` | 2 → 3 → 2 | wewnątrz `if (NODE_ENV === 'test' && ENABLE_TEST_SUPPORT === 'true')` — **warunkowy** |
| `415` | 2 → 3 | otwarcie `try {` |
| `638` | 3 | **ta sama głębokość co `643` (`/api/system-health`)** — czyli wewnątrz `try`, **bez żadnego `if`** |

Komentarz nad `:638` („hard-gated: NODE_ENV=test + ENABLE_TEST_SUPPORT=true + secret key")
opisuje bramkę **w handlerze**, nie w montażu — i ten opis wprowadził poprzedni pakiet
w błąd.

**Ryzyko netto się nie zmienia i to trzeba powiedzieć uczciwie**: realną bramką jest
`server/src/routes/testSupport.routes.ts:23-26`, która odrzuca `NODE_ENV=production`
(`:23`), wymaga `ENABLE_TEST_SUPPORT === 'true'` (`:24`) i sprawdza `TEST_SUPPORT_KEY`
(`:26`). Jest **mocniejsza** niż warunek montażu, bo jawnie wyklucza produkcję. Zmienia
się natomiast **mechanizm** — a `SEC-PUB-001` opiera na nim swoje zalecenie
konfiguracyjne. Do sprostowania przy najbliższej rewizji tamtego dokumentu, razem
z ustaleniem K3 (patrz U6).

---

## Czego ten pakiet **nie** twierdzi

1. **Nie twierdzę, że którakolwiek trasa ujawnia wartość sekretu.** Sprawdzone i wykluczone:
   klucze API dostawców LLM (`systemHealthService.ts:194-205` — testowana prawdziwość, nie
   wartość), `JWT_SECRET` i `DATABASE_URL` (`system-health.routes.ts:292-315` — ujawniane
   są **nazwy** zmiennych, nie ich wartości). Wyjątkiem, który nie jest sekretem tylko
   poświadczeniem, jest zaszyte `123456` (U1).
2. **Nie twierdzę, że w tych rodzinach wycieka stack trace.** Znalazłem interpolacje treści
   błędu (U5), nie serializację `error.stack`.
3. **Nie zweryfikowano tego na żywym środowisku.** Analiza statyczna na HEAD `3957c486bf`.
4. **Nie sprawdzano stanu konta `admin@dbr77.com` w żadnej bazie.** To pytanie operacyjne
   do właściciela, wymagające zapytania do żywej bazy — złota reguła #1.
5. **Nie zmieniono ani jednego pliku poza tym dokumentem.** Trzy równoległe strumienie
   pracują w tym worktree na `server/src/index.ts`,
   `server/src/routes/system-health.routes.ts` i
   `server/src/controllers/HealthCheckController.ts`. Numery linii dla tych trzech plików
   traktuj jako orientacyjne — kotwicą jest ścieżka trasy i nazwa funkcji, nie linia.

## Bramki

Uruchomione na HEAD `3957c486bf`:

```
bash scripts/check-ssot-paths.sh
→ check-ssot-paths: OK — wszystkie ścieżki SSOT z CLAUDE.md istnieją.   (exit 0)

node scripts/docs/check-ssot-registry.mjs
→ check-ssot-registry: OK
  - centralna mapa istnieje
  - wszystkie zarejestrowane źródła istnieją
  - 16 pozycji dokumentacji odpowiada menu aplikacji
  - podsystemy techniczne są przypisane do pozycji menu
  - brak numerowanych kopii w rejestrze kanonicznym
  - komplet katalogu SSOT: 10/10
  - komplet centrum dowodzenia: 14/14                                   (exit 0)
```

### Rejestracja w indeksach wspólnych — wymagana, NIE wykonana

Konwencja katalogu wymaga wpisu w plikach współdzielonych. Nie zostały dotknięte —
pracują nad nimi równoległe strumienie. Do dopisania przez właściciela indeksu:

1. `docs/program/WEEKEND_COMPLETION_2026-08-01/ACCEPTANCE_BOARD.md`, tabela
   „Odkrycia stagingowe wymagające naprawy":

   ```
   | `SEC-PUB-002` | Publiczna powierzchnia systemowo-diagnostyczna API | READY_FOR_DECISION | 24 trasy w 7 rodzinach, 13 anonimowych; P0: `GET /api/system/health` anonimowo potwierdza działające poświadczenie `admin@dbr77.com`/`123456` i wypisuje e-maile wszystkich adminów; 13 tras montowanych przed globalnym middleware (bez limitera i bez audytu); korekty K3 i montażu `/api/test-support` do SEC-PUB-001 |
   ```

2. `docs/program/WEEKEND_COMPLETION_2026-08-01/README.md` — odnośnik
   `[SEC-PUB-002](PACKETS/SEC-PUB-002_PUBLIC_SYSTEM_SURFACE.md)` obok istniejących
   odnośników do `OPS-DEMO-002`, `SEC-PUB-001` i `SEC-AUTH-001`.

## Stan

`READY_FOR_DECISION` — rejestr kompletny i zweryfikowany statycznie, każde ujawnienie
przeczytane w handlerze. Rekomendacja techniczna: **pozycje 1-2 (P0) przed jakimkolwiek
publicznym wystawieniem `demo.consultify.ai`, bez czekania na kolejkę**; pozycje 3-8 (P1)
w tej samej partii co `OPS-DEMO-002`; pozycje 9-10 zwykłą kolejką. Ustalenia Z1-Z5 do
triage'u jako osobne pozycje — Z1 i Z2 rekomenduję ocenić wcześniej niż resztę, bo ich
koszt na żądanie jest najwyższy w całym przeglądzie.

## Odsyłacz — część operacyjna pozycji 2 jest w osobnym runbooku

Pozycja 2 listy P0 ma dwie połowy. Połowa kodowa (usunięcie zaszytych literałów
z repozytorium) należy do strumienia kodu. Połowa operacyjna — **rotacja ujawnionego
poświadczenia, unieważnienie sesji i rodzin refresh tokenów oraz weryfikacja
niewymagająca ujawnienia nowej wartości** — jest tu świadomie opisana jako „pytanie
operacyjne do właściciela, poza kodem" i **nie ma w tym pakiecie procedury**.

Procedura powstała jako:
[`OPS-SEC-001`](OPS-SEC-001_RUNBOOK_WYSTAWIENIA_PUBLICZNEGO.md) — runbook operatora
przed publicznym wystawieniem `demo.consultify.ai`, bramka blokująca **O-1**
(sześć kroków + testy weryfikacyjne W1-W5, werdykt **NO-GO** do czasu jej zamknięcia).

Do rozdziału odpowiedzialności, nie do zmiany treści tego rejestru: ustalenia U1 i U2
pozostają autorytetem dla **opisu** ujawnienia, `OPS-SEC-001` jest autorytetem dla
**czynności na żywym środowisku**.
