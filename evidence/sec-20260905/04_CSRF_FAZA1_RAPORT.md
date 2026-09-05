# KROK 4 — CSRF Faza 1 (tryb raportujący, nie enforce)

Realizacja Fazy 1 z `03_CSRF_MFA_PROPOZYCJA.md` §A. Zero zmian zachowania
na staging/demo/produkcji po scaleniu: domyślne `CSRF_MODE` (nieustawione)
= `off`, identyczne z brakiem montażu w ogóle.

## 1. Co zamontowano

### Serwer

`server/src/middleware/csrf.middleware.ts`:
- `export type CsrfMode = 'off' | 'report' | 'enforce'` + `getCsrfMode()`
  (linia 31-42) — czyta `CSRF_MODE` na żywo (nie cache'owane przy starcie
  procesu), nierozpoznana/pusta wartość → fail-safe `'off'`.
- `evaluateCsrfToken(req)` (linia 295) — czysta funkcja porównania
  double-submit cookie, wydzielona z istniejącego `csrfValidationMiddleware`
  (zachowanie identyczne, tylko DRY — `csrfValidationMiddleware` przepisany
  na wywołanie tej samej funkcji, żadna z 83 istniejących testów w
  `csrfMiddleware.test.ts` nie została zmieniona i wszystkie nadal przechodzą).
- `isBearerOnlyRequest(req)` (linia 363) — patrz §2 niżej.
- `shouldLogCsrfViolation(routeKey)` (linia 380) — limiter logów 1/s na
  `METHOD path`, mapa czyszczona całościowo po przekroczeniu 5000 wpisów
  (zabezpieczenie pamięci, nie kontrola bezpieczeństwa — patrz komentarz
  w kodzie).
- `csrfProtectionMiddleware` (linia 408) — dyspozytor trybu:
  - `off`: `return next()` natychmiast, przed jakimkolwiek odczytem
    ciasteczka/nagłówka.
  - `report`: waliduje, przy błędzie loguje jedną linię `csrf_violation`
    (rate-limited) i **zawsze** wywołuje `next()`.
  - `enforce`: identyczne z `csrfValidationMiddleware` — 403
    `CSRF_MISSING`/`CSRF_INVALID`.

`server/src/index.ts:1240-1268`:
```
if (isProduction || getCsrfMode() !== 'off') {
  app.use('/api/', csrfTokenMiddleware);
}
app.use('/api/', csrfProtectionMiddleware);
```
Druga linia montuje middleware bezwarunkowo — jest no-opem dopóki
`CSRF_MODE` nie jest ustawiony. Pierwsza linia to zmiana konieczna: dotąd
`csrfTokenMiddleware` (generujący ciasteczko `csrf_token`) był montowany
TYLKO gdy `isProduction`, więc `CSRF_MODE=report` na stagingu/dev bez tej
poprawki zgłaszałby `CSRF_MISSING` dla każdego zapisu (ciasteczko nigdy by
nie powstało). Bramka `scripts/security/verify-security-integrity.ts` (#17)
sprawdza dosłowny podciąg `'if (isProduction)'` w pliku — nadal obecny w
5 innych miejscach `index.ts` (linie 103, 354, 576, 1838, 1850), więc bramka
przechodzi bez zmian.

### Frontend

Nowy plik `src/services/csrfClient.ts` — **nie** dotyka `src/services/api.ts`
(21885 linii, `WYMUSZONE_WSPOLNE` w `scripts/mvp-final/moduly.mjs:151` — ale
prefiks to `src/services/api`, mój plik `csrfClient.ts` jest siostrzanym
plikiem, nie pod tym prefiksem, i tak go nie dotknąłem) ani
`src/services/api/baseClient.ts`.

Powód architektoniczny: `grep -rn "method: *['\"]\(POST\|PUT\|PATCH\|DELETE\)" src/services | wc -l`
→ **1181**, `grep -rln "fetch(" src/services` → **52 pliki**. Sam
`src/services/api.ts` ma ~690 mutujących wywołań `fetch()` NIE
przechodzących przez wspólny `fetchWithRetry` (660 z nich buduje nagłówki
przez `getHeaders()`, 30 ma własne nagłówki — głównie przedsesyjne flow
jak `mfaEnrollmentStart`, patrz §2). Ręczna edycja ~1300 miejsc wywołania
w jednym kroku bezpieczeństwa byłaby nieproporcjonalnym ryzykiem regresji
(literówka w jednym z tysiąca miejsc = cichy błąd zapisu). Zamiast tego,
wzorem już istniejącym w repo (`src/services/feedbackCollector/NetworkBuffer.ts:65-92`,
`src/components/CaseWorkspace/podglad/main.tsx:167`), `csrfClient.ts`
opakowuje `window.fetch` RAZ, przy starcie aplikacji:
- `isMutatingMethod` + `isSameOriginApiRequest` (tylko `/api/*` tego samego
  originu — token nigdy nie leci do trzeciej strony) → dla GET/HEAD/OPTIONS
  i dla żądań spoza `/api/` wrapper jest przezroczysty (`nativeFetch(input, init)`
  bez zmian).
- Dla mutacji na `/api/*`: `ensureCsrfToken()` pobiera `GET /api/csrf-token`
  RAZ (cache w pamięci module-level, `pendingFetch` dedupe współbieżnych
  wywołań), dokleja `x-csrf-token` do nagłówków, wywołuje realny fetch.
- Po odpowiedzi 403 z `{ code: 'CSRF_INVALID' }` czyści cache — kolejna
  mutacja pobierze świeży token (gotowość na Fazę 3, gdzie serwer faktycznie
  blokuje).
- Instalacja: `src/index.tsx` (import `installCsrfFetchInterceptor`,
  wywołanie w `try/catch` zaraz po `installFeedbackCollector`) — jeden punkt
  bootstrapu, zero zmian w pozostałych ~1300 miejscach wywołania.

Efekt: **zero zmian widocznych dla użytkownika** — dopóki `CSRF_MODE=off`,
serwer i tak ignoruje nagłówek; dopóki serwer go nie waliduje, jego obecność
na żądaniu jest neutralna.

## 2. Wyjątki i uzasadnienie (każdy z osobna)

Te same wyjątki obowiązują we wszystkich trybach (`report`/`enforce`) — w
`off` nic z poniższego nie jest w ogóle odpytywane.

| Wyjątek | Gdzie | Uzasadnienie |
|---|---|---|
| Metody bezpieczne GET/HEAD/OPTIONS | `isSafeMethod()`, istniejące | Nie mutują stanu — CSRF chroni przed wymuszoną mutacją, nie odczytem. |
| `/api/auth/login`, `/register`, `/register-demo`, `/demo-login`, `/quick-access`, `/refresh`, `/reset-password`, `/verify-email`, `/api/csrf-token` | `isExemptPath()`, istniejące (bez zmian w Fazie 1) | Przedsesyjne — nie istnieje jeszcze ciasteczko sesji, na którym mogłoby "jechać" sfałszowane żądanie cross-site. |
| `/api/webhooks`, `/api/webhooks/stripe`, `/api/stripe/webhook`, `/api/auth/callback/*` | j.w. | Serwer-serwer (Stripe, OAuth callback) — brak przeglądarki, brak ciasteczka sesji w grze. |
| **Bearer bez ciasteczka CSRF** (NOWE, Faza 1) | `isBearerOnlyRequest()` linia 363 | Klient API/serwer-serwer uwierzytelnia się `Authorization: Bearer <jwt>`, nigdy nie polega na ciasteczku sesji. Sfałszowane żądanie cross-site z przeglądarki nie potrafi samo dołożyć nagłówka `Authorization` (przeglądarka tego nie robi automatycznie, a nasz CORS nie zezwala origin-om trzecim na taki nagłówek) — więc nie ma tu w ogóle wektora CSRF do ochrony. To pokrywa m.in. `/api/auth/mfa-enrollment/setup` i `/verify-setup` (bilet zakresowy z 403 logowania, PRZED istnieniem sesji/ciasteczka — `src/services/api.ts:1451-1464`) bez potrzeby wymieniania każdej takiej trasy z osobna w `isExemptPath`. **Warunek jest podwójny**: obecność Bearer ORAZ brak ciasteczka `csrf_token` — żądanie z przeglądarki, które ma zarówno token Bearer, jak i aktywną sesję z ciasteczkiem, nadal jest w pełni walidowane (test "still validates a Bearer request that ALSO carries a CSRF cookie"). |
| Health | brak osobnego wyjątku | `/api/health*` to wyłącznie GET — już pokryte przez "metody bezpieczne", nie znaleziono żadnej mutującej trasy health. |

## 3. Testy i wyniki

Backend: `tests/unit/backend/security/csrfProtectionMiddleware.test.ts`
(NOWY, 26 testów) + `tests/unit/backend/security/csrfMiddleware.test.ts`
(ISTNIEJĄCY, 83 testy, niezmieniony, nadal zielony — dowód że refaktor
`evaluateCsrfToken` jest behavior-preserving).

```
npx vitest run tests/unit/backend/security/csrfMiddleware.test.ts \
  tests/unit/backend/security/csrfProtectionMiddleware.test.ts
```
→ `Test Files  2 passed | Tests  109 passed`

Pokrycie nowego pliku: `off` (3 testy: przepuszcza, zero logów, nie czyta
w ogóle ciasteczka), `report` (11 testów: brak tokenu → 2xx + 1 log
`CSRF_MISSING`, mismatch → 2xx + 1 log `CSRF_INVALID`, match → 2xx bez logu,
metody bezpieczne bez logu, rate-limit 1/s per trasa, brak rate-limitu
między różnymi trasami, wyjątek `/api/auth/login`, wyjątek Bearer-bez-
ciasteczka, Bearer-Z-ciasteczkiem nadal walidowany), `enforce` (7 testów:
403 na brak/mismatch, 2xx na match, zero logów w enforce, metody bezpieczne,
Bearer-bez-ciasteczka), `getCsrfMode` (5 testów: brak/nieznana wartość →
`off`, `report`/`enforce`, tolerancja wielkości liter/białych znaków), plus
2 testy trybu testowego (`ENABLE_CSRF_IN_TESTS` niewłączone → zawsze
przepuszcza, niezależnie od `CSRF_MODE`).

Frontend: `src/services/__tests__/csrfClient.test.ts` (NOWY, 8 testów).
```
npx vitest run src/services/__tests__/csrfClient.test.ts
```
→ `Test Files  1 passed | Tests  8 passed`

Pokrycie: nagłówek na POST tak / na GET nie (jawny i domyślny "brak
metody"=GET) / PUT+PATCH+DELETE tak, brak nagłówka dla mutacji do INNEGO
originu (`https://evil.example.com`), token pobrany raz i cache'owany
przez wiele mutacji, ponowne pobranie po 403 `CSRF_INVALID`, brak nagłówka
(fail-open, nie fail-closed) gdy `GET /api/csrf-token` sam padnie 500 —
świadomy wybór: w trybie `report` brak nagłówka i tak tylko zaloguje, w
`off` jest neutralny; dopiero w `enforce` fail-open oznaczałby 403 zamiast
cichej awarii tokenu — akceptowalne dla Fazy 1, do rewizji przed Fazą 3.

Łącznie: **3 pliki testów, 117 testów, wszystkie zielone**
(83 istniejące + 26 + 8 nowe).

## 4. Dowód mutacyjny (RED → GREEN)

### Backend — usunięcie bramki trybu `off`
```
sed -i "s/if (mode === 'off') return next();/\/\/ MUTATED: off-mode gate removed for RED proof/" \
  server/src/middleware/csrf.middleware.ts
npx vitest run tests/unit/backend/security/csrfProtectionMiddleware.test.ts
```
RED:
```
FAIL … mode = off (default) > logs zero csrf_violation lines
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  method: "DELETE", mode: "off", path: "/api/projects/1", reason: "CSRF_MISSING"
```
(1 z 26 testów pada — po usunięciu wczesnego `return`, żądanie bez tokenu
w "trybie off" spada przez logikę `report` i loguje `csrf_violation`, mimo
że `CSRF_MODE` nigdy nie było ustawione). Przywrócono plik z kopii
(`cp` z backupu sprzed mutacji) → `git diff --stat` puste →
`npx vitest run …` → **109/109 GREEN** (razem z `csrfMiddleware.test.ts`).

### Frontend — usunięcie doklejania nagłówka
```
sed -i "s/headers.set(CSRF_HEADER_NAME, token);/\/\/ MUTATED: header injection removed for RED proof/" \
  src/services/csrfClient.ts
npx vitest run src/services/__tests__/csrfClient.test.ts
```
RED: `2 failed | 6 passed` — testy "attaches x-csrf-token to a POST" i
"attaches the header for PUT, PATCH and DELETE too" oczekiwały tokenu w
nagłówku, dostały `null`. Przywrócono plik z kopii → `git diff --stat`
puste → **8/8 GREEN**.

## 5. `tsc` i canon

```
cd server && npx tsc --build tsconfig.build.json
```
→ exit 0 (brak nowych błędów typów; `evaluateCsrfToken`/`csrfProtectionMiddleware`
w pełni otypowane, `CsrfCheckResult` eksportowany).

```
npx esbuild server/src/middleware/csrf.middleware.ts --outfile=/dev/null --platform=node
npx esbuild server/src/index.ts --outfile=/dev/null --platform=node
npx esbuild src/services/csrfClient.ts --outfile=/dev/null
npx esbuild src/index.tsx --outfile=/dev/null --loader:.tsx=tsx
```
→ wszystkie exit 0.

```
bash scripts/check-list-canon.sh
```
→ exit 0 (`✓ brak NOWYCH naruszeń kanonu tabel`; staging był pusty w
worktree, skrypt sam przełączył się na pełny skan repo i zameldował
zero nowych naruszeń — moje zmiany nie dotykają żadnego ekranu listowego).

## 6. Instrukcja włączenia `CSRF_MODE=report` na stagingu

1. Railway → serwis staging → zmienna środowiskowa `CSRF_MODE=report`
   (bez zmiany kodu — middleware już zamontowany, no-op na `off`).
2. Redeploy (zmienna env wymaga restartu procesu — `getCsrfMode()` czyta
   `process.env` na żywo per-request, ale wartość startowa `isProduction ||
   getCsrfMode() !== 'off'` przy montażu `csrfTokenMiddleware` jest
   ustalana RAZ przy starcie serwera, więc bez restartu ciasteczko dalej
   by się nie generowało na non-prod).
3. Obserwować logi pod kątem strukturalnej linii `csrf_violation` (pole
   `event`) — spodziewane ŹRÓDŁA fałszywych trafień do zweryfikowania
   w Fazie 2 wg propozycji: SPA (powinno spaść do ~0 po tym wdrożeniu
   frontendu), integracje serwer-serwer używające ciasteczek zamiast
   Bearer (nieoczekiwane — do zbadania jeśli się pojawią), mobile/inne
   klienty API nie przechodzące przez `csrfClient.ts` (np. Playwright L4
   testy uderzające bezpośrednio w endpointy — sprawdzić `frequency`/
   `path` w logach).
4. Kilka dni logów, potwierdzić że liczba `csrf_violation` z `method`
   mutującym i `path` spoza listy wyjątków spada do zera (lub bliska zeru
   z wyjaśnioną przyczyną per pozostały `path`) — to jest brama do Fazy 3.

## 7. Warunki przejścia do `enforce`

Z propozycji (§A pkt 4), potwierdzone tu: **nie** ograniczać do produkcji —
zamontować `CSRF_MODE=enforce` NAJPIERW na staging/demo (Faza 3 wg
propozycji), żeby regresja ujawniła się przed produkcją, nie na niej.
Dodatkowo z tej realizacji:
- Faza 2 (pomiar) musi pokazać zero (lub w pełni wyjaśnione) trafień
  `csrf_violation` dla ruchu spoza wyjątków — inaczej `enforce` zablokuje
  realny ruch.
- Zweryfikować dodatkowo pokrycie tras spoza `src/services/csrfClient.ts`:
  interceptor łapie WSZYSTKIE `fetch()` w przeglądarce (globalny wrapper),
  ale NIE łapie ewentualnych żądań spoza przeglądarki (mobile, curl,
  integracje) — te muszą albo przejść przez ścieżkę Bearer-bez-ciasteczka
  (już wyjęta), albo dostać token ręcznie przed Fazą 3.
- Rewizja "fail-open" z §3 (frontend): jeśli `GET /api/csrf-token` padnie,
  dzisiejszy klient wysyła mutację BEZ nagłówka — w `enforce` to byłoby
  403 zamiast cichej awarii. Do zaakceptowania świadomie albo naprawienia
  (retry/backoff) przed Fazą 3.

## Ryzyka

**Co może się zepsuć w `report`:** nic funkcjonalnie (nigdy nie blokuje) —
jedyne ryzyko to wolumen logów, ograniczony limiterem 1/s/trasę; mapa
limitera rośnie z liczbą DYNAMICZNYCH ścieżek (np. `/api/tasks/:id`
liczone per konkretne id) i czyści się całościowo po 5000 wpisów (nie per
wpis) — przy bardzo dużym ruchu może to spłaszczyć limiter na chwilę
(kolejny log przejdzie wcześniej niż 1s po czyszczeniu), efekt: chwilowo
więcej logów niż 1/s/trasę, nigdy mniej bezpieczeństwa (to i tak tylko log).

**Co może się zepsuć w `enforce`:** każdy mutujący `fetch()` NIE
przechodzący przez `window.fetch` (np. `XMLHttpRequest` bezpośrednio,
`sendBeacon`, natywne żądania z Service Workera, testy E2E/Playwright
uderzające w API bez przejścia przez `csrfClient.ts`) dostanie 403
`CSRF_MISSING`. Zweryfikowano że `src/services/feedbackCollector/NetworkBuffer.ts`
też patchuje `XMLHttpRequest.prototype.open/send`, ale TYLKO do celów
telemetrii (nie dokleja nagłówków) — jeśli gdziekolwiek w `src/` istnieje
mutujący `XMLHttpRequest` zamiast `fetch`, on nie dostanie tokenu. Nie
znaleziono takiego wywołania w tym kroku (poza diagnostyką), ale nie było
to przedmiotem pełnego audytu — do potwierdzenia w Fazie 2 przez obserwację
logów `report`, nie przez statyczny grep.
