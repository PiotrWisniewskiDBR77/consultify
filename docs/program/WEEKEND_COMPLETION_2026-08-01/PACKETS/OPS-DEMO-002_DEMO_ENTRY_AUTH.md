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

### Czas dostępu — semantyka 24 h domknięta

Sama sesja wygasała, ale konto żyło dalej. Trzy drogi kontynuacji były otwarte i
wszystkie są teraz zamknięte przez `server/src/services/demo/demoPrincipalGuard.ts`,
wywoływany z `attachUser` (jeden punkt dławienia dla `verifyToken`, `optionalAuth`
i ścieżki E2E):

| Wektor | Było | Jest |
| --- | --- | --- |
| Token dostępowy po wygaśnięciu | degradacja do org bazowej, przeglądanie bez końca | `403 DEMO_SESSION_EXPIRED` |
| `GET /api/demo/status` | `resolveOrCreateDemoSession` **wystawiał świeżą sesję 24 h** (bo `demo:enabled` przeżywa wygaśnięcie) | żądanie odrzucone zanim dojdzie do trasy |
| Ponowny `POST /api/auth/login` | mintował nowy token | `403 DEMO_SESSION_EXPIRED` |
| Refresh token (7 dni) | ważny sześć dni dłużej niż demo | unieważniony przy wygaszeniu → `401` |

Wygaszenie jest **leniwe, na ścieżce żądania**, bo nic nie zamiata `demo_sessions`
harmonogramem — jedynymi wywołaniami `cleanupExpiredDemoSessions` są same trasy demo,
do których wygasły klient nie ma powodu wracać. Pierwsze żądanie po TTL ustawia
`users.status = demo_expired` i unieważnia rodzinę refresh tokenów.

Zakres jest wąski celowo: guard dotyczy **wyłącznie** principali oznaczonych przy
rejestracji markerem `demo:entry_source = register_demo`. Zwykły klient, który włącza
„pokaż dane demo” z menu profilu, nie jest efemeryczny i nie zmienia zachowania.
Marker jest trwały i **nie** wywodzi się z `demo_sessions.source` — ta kolumna jest
sterowana przez klienta w `/api/demo/toggle` i jest nadpisywana na `status_refresh`
przy odtwarzaniu sesji, czyli znikałaby dokładnie wtedy, gdy jest potrzebna.

### Rollback — saga kompensacyjna

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

Dwa niezależne limitery (`server/src/middleware/rateLimiting.middleware.ts`):

| Limiter | Klucz | Prod |
| --- | --- | --- |
| `demoSignupIpRateLimiter` | adres źródłowy | 5 / godz. |
| `demoSignupIdentityRateLimiter` | **sha256 adresu** z separacją domenową, obcięty do 32 znaków | 3 / godz. |

Klucz tożsamości jest liczony z tej samej znormalizowanej postaci, której używa
wyszukiwanie konta, więc różnice wielkości liter nie omijają kwoty. Surowy adres
**nigdy** nie trafia do przestrzeni kluczy — w odróżnieniu od istniejącego
`authLimiter`, który trzyma `auth:<email>` w Redisie (dług zgłoszony osobno).
- **Cleanup operatorski**: `server/scripts/cleanup-orphan-demo-orgs.ts` — dry-run
  domyślnie, `--apply` wymaga `FORCE_PURGE=true`, backup JSON przed usunięciem,
  odmowa na hoście produkcyjnym. Poprawki w tym pakiecie:
  - wzorzec liczony z `DEMO_ORG_ID` (`${DEMO_ORG_ID}-session-%`) zamiast twardego
    `demo-org-session-%` — przy `DEMO_ORG_ID=atelier` stary wzorzec nie trafiał w nic
    i raportował „już czysto”, gdy organizacje przyrastały;
  - odmowa, gdy wzorzec obejmie samą organizację bazową;
  - pomijanie organizacji z **aktywną, niewygasłą** sesją (`--include-active` aby
    wymusić) — inaczej narzędzie potrafiło skasować workspace prospekta w trakcie demo.
- **Rollback kodu**: `git revert` commitów gałęzi; nie ma migracji ani zmian schematu.

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
| `tests/integration/demoPublicEntry.contract.test.ts` (realny Express + realna baza) | `20/20 PASS` (`--retry=0`) |
| `tests/unit/backend/demo/demoSignupProvisioning.faults.test.ts` (fault injection sagi) | `15/15 PASS` |
| `tests/unit/backend/rateLimiting/` (z nowym `demoSignupRateLimiter.429`) | `15/15 PASS`, 9 plików |
| `tests/components/AuthView.demo-entry.contract.test.tsx` + `demoSessionAdoption` + modal | w zbiorczym przebiegu poniżej |
| Zbiorczy przebieg: integracja + saga + limitery + UI + host allowlist + regresje | **`114/114 PASS`, 23 pliki** (`--retry=0`) |
| Regresja `attachUser`: `tests/unit/auth/`, `auth.middleware.test.ts`, `security-auth-flow` | `222/223` — jedyna porażka (`mapRole maps superadmin to owner`) **potwierdzona jako istniejąca przed zmianą** przez uruchomienie na pliku z `HEAD` |
| Kontrola negatywna 1 — usunięty guard w `attachUser` | `7/20 FAIL` (TTL ×5, fail-closed ×2) |
| Kontrola negatywna 2 — usunięte limitery | `7/7 FAIL` (`is not a function`) |
| Kontrola negatywna 3 — `AuthView.tsx` z `HEAD` | `5/6 FAIL` w nowym zestawie UI |
| Kontrola negatywna 4 — trasa `register-demo` z `HEAD` (poprzednia runda) | `8/11 FAIL` |
| `npm run type-check` | PASS |
| `npm run build:backend` | PASS (uwaga: `tsc --noCheck` — nie sprawdza typów) |
| **Realny type-check nowych plików backendu** (`server/tsconfig.json`, filtr na zmienione pliki) | PASS — 0 błędów w `demoSignupProvisioning`, `demoPrincipalGuard`, `rateLimiting.middleware`; pozostałe błędy są istniejące, w plikach niedotykanych |
| `check-ssot-paths.sh`, `check-ssot-registry.mjs` | PASS |
| `git diff --check` | PASS |
| Skan sekretów w diffie | brak trafień (fixture'y i celowe łańcuchy „leak" w asercjach non-leakage odfiltrowane) |

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

1. **Latencja pierwszego wejścia.** Przy wyłączonym `DEMO_USE_BASE_ORG` seed
   Atelier Toys biegnie synchronicznie w `register-demo`. Na Railway trzeba zmierzyć
   czas odpowiedzi; jeśli zbliża się do limitu bramy, właściwą odpowiedzią jest
   `DEMO_USE_BASE_ORG=true` albo osobny pakiet na seed asynchroniczny.
2. **Enumeracja na rejestracji jest ograniczona, nie usunięta** — patrz sekcja wyżej.
   Świadomie zaakceptowane; pełne domknięcie wymaga rozdzielenia rejestracji od
   wejścia, czyli decyzji produktowej Piotra.
3. **`optionalAuth` też przechodzi przez guard.** Wygasły principal demo dostanie
   `403` na trasie publicznej z opcjonalnym tokenem, zamiast być potraktowany jako
   anonim. Kierunek jest bezpieczny (fail closed) i dotyczy tylko kont efemerycznych,
   ale to zauważalna zmiana zachowania — do potwierdzenia w smoke.
4. **Limiter jest w pamięci procesu.** `rateLimiting.middleware.ts` trzyma licznik
   w `Map`, więc kwota jest per replika. Przy skalowaniu `demo` w poziomie realny
   limit rośnie proporcjonalnie do liczby replik. Wystarczające dla stagingu; przed
   produkcją wymaga backendu współdzielonego (Redis store już istnieje dla warstwy
   `express-rate-limit`).
5. **`resolveQuickAccessCredentials` trzyma realne adresy i hasła w kodzie frontu.**
   Trafiają do bundla przeglądarki. Poza zakresem tego pakietu (nie wolno ruszać
   host guarda), ale to dług bezpieczeństwa do osobnej paczki. `1111` wskazuje na
   `anna.zielinska@ateliertoys-demo.com`, które **nie istnieje** — skrót produkcyjny
   jest martwy.
6. **Istniejący `authLimiter` trzyma `auth:<surowy email>` jako klucz Redis**
   (`server/src/index.ts`). Nowy limiter demo hashuje, stary nie — przestrzeń kluczy
   Redis zawiera zarejestrowane adresy. Osobny pakiet.
7. **Ten sam defekt normalizacji adresu istnieje w `POST /api/auth/register`**
   (ścieżka trialowa). Nie naprawiono — poza zakresem pakietu. Poprawka to podmiana
   jednego argumentu na `normalizedEmail`; osobny pakiet, bo dotyka rejestracji
   produkcyjnej.
8. **`tests/e2e/demo-flow.spec`** (bez rozszerzenia `.ts`, więc niezbierany) opisuje
   nieistniejący już modal `Experience Consultinity` i wycofane konto demo wpisane
   na sztywno w asercję. Martwy plik do usunięcia w porządkach.
9. **Harnessy wymagają teraz `ENABLE_TEST_SUPPORT`** — patrz sekcja o harnessach.
   Jeśli CI ich nie ustawia, wymienione specyfikacje padną zamiast po cichu
   degradować. To zamierzone, ale wymaga decyzji konfiguracyjnej.
10. **`auth.routes.ts` ma `// @ts-nocheck`**, a `build:backend` to `tsc --noCheck`.
    Nowe pliki backendu są za to sprawdzone realnym `tsc` (patrz bramki). Dowodem dla
    samej trasy pozostaje test integracyjny na realnym runtime.

## Stan

`AWAITING_CODEX_REVIEW` — kod i testy lokalne gotowe na gałęzi
`fix/ops-demo-002-public-entry`. Bez merge, bez push na `demo`, bez deployu.
Status `READY_FOR_STAGING` nadaje Codex po przeglądzie kodu; `GO` wymaga wykonania
kroków stagingowych na `https://demo.consultify.ai`.
