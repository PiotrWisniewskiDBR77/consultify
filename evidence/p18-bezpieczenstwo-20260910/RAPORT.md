# P18 — bezpieczeństwo, kryterium 2/koszyk 2 (S2.3): MFA z karencją + skutek CSRF enforce

Stanowisko: `/Users/piotrwisniewski/Developer/wt/p18-mfa` · gałąź `mvp/p18-mfa-20260910` ·
SHA bazy `513d4d5fff08a1748a128341e31620ce6f43ccfc` (zgodne ze zleceniem).
Środowisko pomiaru: **staging** (`staging.consultify.ai`, serwis Railway `consultify`,
baza `pgvector`/host `thomas.proxy.rlwy.net:52567` — zgodnie z ostrzeżeniem o `server.env`
prowadzącym do złej bazy, użyto właściwego hosta ustalonego przez `railway variables`).

## Etap A — uwierzytelnianie dwuskładnikowe z karencją

### Czy istnieje — DZIAŁA (nie fantom), z realnym wołaczem na żywej trasie
- Trasa `POST /api/auth/login` → `server/src/routes/auth.routes.ts:315` → kontroler
  `login()` w `server/src/controllers/AuthController.ts`.
- Kontroler woła `MFAService.getMFAStatus()` (`server/src/services/MFAService.ts:47-91`),
  które łączy `organizations.mfa_required/mfa_grace_period_days/mfa_required_since` z
  `user_mfa.enabled` i liczy stan karencji przez `evaluateMfaGrace()`
  (`server/src/services/mfaGracePolicy.ts`).
- Trzy gałęzie w `AuthController.login` (linie ok. 406-452):
  1. `mfaStatus.enabled && !verifiedChallenge` → wyzwanie TOTP (`mfaChallenge`).
  2. `!enabled && enforced && !graceActive` → 403 `MFA_SETUP_REQUIRED` + **scoped ticket**
     (`mfaSetupToken`, 15 min) otwierający wyłącznie `/api/auth/mfa-enrollment/*`.
  3. `!enabled && enforced && graceActive` → login przechodzi (200), odpowiedź niesie
     `mfaEnrollment.daysRemaining/deadline`.
- **Zmierzone na żywo na stagingu** (nie tylko czytanie kodu): utworzono jednorazowe
  konto testowe przez `POST /api/auth/register` (nowa organizacja, nikt inny jej nie
  używał), włączono `organizations.mfa_required=1` bezpośrednio w bazie testowej
  organizacji i zalogowano się przez realne `POST /api/auth/login`:
  - baseline (mfa_required=0): 200, brak pola `mfaEnrollment` — potwierdza brak regresji.
  - `mfa_required=1, grace_period_days=7, required_since=teraz`: **200**, treść niesie
    `"mfaEnrollment":{"required":true,"daysRemaining":7,"deadline":"...+7d","gracePeriodDays":7}`.
    Login przechodzi mimo braku drugiego składnika — to jest cel karencji.
  - `mfa_grace_period_days=0` (karencja wyczerpana): **403** `MFA_SETUP_REQUIRED` z
    `mfaSetupToken` + `mfaSetupEndpoint:"/api/auth/mfa-enrollment"`.
  - Bilet użyty na żywo: `GET /api/auth/mfa-enrollment/status` → 200 (`enforced:true,
    graceActive:false`); `POST /api/auth/mfa-enrollment/setup` → 200, zwrócił realny
    sekret TOTP + `otpauthUrl` (QR). Drzwi wyjściowe DZIAŁAJĄ, nie są atrapą.
  - Ten sam bilet użyty jako zwykła sesja (`GET /api/auth/me` z `Authorization: Bearer
    <mfaSetupToken>`) → **401** `SCOPED_TOKEN_NOT_A_SESSION`. Fail-closed poza trzema
    dozwolonymi trasami potwierdzony.
- Konto testowe i organizacja testowa **usunięte po pomiarze** (`user_mfa`,
  `refresh_tokens`, `trusted_devices`, `users`, `organizations` — transakcyjnie, zweryfikowano
  `count(*)=0` po DELETE). Żadne prawdziwe konto nie miało skonfigurowanego drugiego
  składnika; hasło testowe wygenerowane losowo i nigdzie nie zapisane w repo/meldunku.

### Karencja — ile, od czego, co po upływie
- Domyślnie **7 dni** (`DEFAULT_MFA_GRACE_PERIOD_DAYS`, `mfaGracePolicy.ts:19`), konfigurowalne
  per organizacja (`organizations.mfa_grace_period_days`, panel admina `adminP32.routes.ts`).
  Wartość `0` jest poprawna i oznacza "brak karencji" (natychmiastowe wymuszenie) — zmierzone
  powyżej.
- Kotwica = **późniejsza** z dwóch dat: `organizations.mfa_required_since` (kiedy włączono
  wymóg) i `users.created_at` (kiedy dołączył user) — `evaluateMfaGrace()`. Dzięki temu
  użytkownik, który dołącza do już-wymuszającej organizacji, dostaje własny bieg 7 dni
  zamiast być zablokowany pierwszego dnia (potwierdzone w kodzie i pośrednio w pomiarze —
  konto testowe utworzone tego samego dnia dostało pełne 7 dni mimo cofniętej daty
  `mfa_required_since`, bo kotwica wygrała z `created_at`).
- Po upływie: `graceActive=false`, `daysRemaining=0`. Login z hasłem poprawnym ale bez
  drugiego składnika **nie wchodzi do systemu** (403), ale dostaje 15-minutowy scoped ticket
  na dokończenie zapisu MFA — patrz wyżej.

### Zamknięte koło — czy wymóg może zablokować wszystkich
**NIE, zmierzone na żywo.** Do 2026-09-02 był to realny, udokumentowany w kodzie closed
loop (komentarz w `mfaGracePolicy.ts` i `auth.middleware.ts:1621`): włączenie
`mfa_required` odcinało WSZYSTKICH członków bez skonfigurowanego drugiego składnika, a
jedyny sposób jego skonfigurowania leżał za tym samym logowaniem. Naprawa z 02.09 (ten sam
dzień co wpis w pamięci `zamkniete-kolo-drugiego-skladnika.md`) dodała scoped enrollment
ticket wydawany w momencie odmowy — zmierzono na żywo, że ticket faktycznie otwiera
`/api/auth/mfa-enrollment/setup` i zwraca działający sekret TOTP, więc użytkownik ma drogę
wyjścia bez potrzeby interwencji administratora. Dodatkowo: **na stagingu obecnie ŻADNA z
15 organizacji nie ma `mfa_required=1`** (`SELECT count(*) FROM organizations WHERE
mfa_required=1` → 0) i **0 z 85 kont ma włączone MFA** (`user_mfa.enabled=true` → 0) — więc
w bieżącym stanie danych zamknięte koło nie może wystąpić, bo wymóg jest wyłączony
wszędzie; ryzyko dotyczy wyłącznie przyszłego włączenia, a to zostało zmierzone osobno na
organizacji testowej i mechanizm wyjścia działa.

## Etap B — skutek wymuszenia CSRF

`railway variables --environment staging --service consultify --kv | grep CSRF` →
**`CSRF_MODE=report`** — sprawdzone trzykrotnie w trakcie sesji (na starcie, w połowie,
na końcu pomiaru Etapu A/C). Nadzorca **jeszcze nie przełączył** trybu na `enforce`.

**Etap B pozostaje niezmierzony — N/A z powodu: brak zmiany zmiennej po stronie
nadzorcy w oknie tej sesji.** Zgodnie ze zleceniem nie przełączono samodzielnie. Gdy
wartość zmieni się na `enforce`, do zmierzenia zostają: logowanie/rejestracja/odświeżenie
sesji/reset hasła, pełny przepływ zapisu (inicjatywa/zadanie/decyzja) i przegląd logów pod
kątem tras zgłaszających naruszenia CSRF (oczekiwane jedyne naruszenie:
`POST /api/analytics/web-vitals`).

## Etap C — 5xx w logach (ostatnia doba, stan bieżący)

Źródło: `railway logs --environment staging --service consultify --http --since 24h
--json` (415 wpisów HTTP w oknie 24h — ruch niski, staging).

Rozkład statusów: 404×273, 304×73, 200×60, 202×5, 503×1, 403×1, 401×1, 1×status=0
(przerwane połączenie).

**5xx: 1 wystąpienie w ostatniej dobie.**
- `GET /api/megatrends/baseline` → **503**, `2026-09-10T08:25:54Z`, `totalDuration=55ms`,
  UA `Claude/1.46388.2 Chrome/148...` (ruch zautomatyzowany, nie wygenerowany przez ten
  pomiar — w tym oknie czasowym trwał też test MFA, ale żadne wywołanie tego pomiaru nie
  dotyczyło `/api/megatrends/*`). To punkt wyjścia do liczenia 7 dni bez awarii serwera
  od jutra (2026-09-11).

## STOP-y
- Etap B (skutek CSRF enforce) — niezmierzony, N/A: `CSRF_MODE` na stagingu wciąż
  `report` w chwili zakończenia tej sesji. Wymaga osobnego pomiaru po przełączeniu przez
  nadzorcę.
- Przyczyna pojedynczego 503 na `/api/megatrends/baseline` nie została zdiagnozowana
  (poza zakresem tego zlecenia — zlecenie prosiło o policzenie i wskazanie tras, nie o
  naprawę).
