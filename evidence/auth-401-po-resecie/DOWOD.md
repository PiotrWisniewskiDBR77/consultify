# Dowód — auth-401-po-resecie (2026-09-08)

Środowisko dowodu: świeża baza `consultify_auth401eval` (Postgres 16, kontener
`consultify-noc-pg`, port 54400) sklonowana z `consultify_odbior` (`pg_dump | psql`,
bo `CREATE DATABASE ... TEMPLATE` odmówiło — inne aktywne sesje na źródle).
API: `tsx server/src/index.ts` na porcie 4901 (`NODE_ENV=development CI=true
DB_TYPE=postgres DATABASE_URL=postgresql://postgres:noc@127.0.0.1:54400/consultify_auth401eval`).
Front: Vite na porcie 3901 (`VITE_API_TARGET=http://127.0.0.1:4901`).
Konto testowe: `auth401eval@dbr77.local` (organizacja DBR77, membership ADMIN/ACTIVE) —
utworzone bezpośrednio w bazie-klonie, usunięte razem z bazą po zakończeniu.

Uwaga: to środowisko nie potrafi mechanicznie zapisać zrzutów ekranu jako plików
PNG do repo — zrzuty były robione i oglądane NA ŻYWO w sesji (Browser pane,
1440×900, jasny motyw wymuszony emulacją — sama aplikacja renderuje ciemny
motyw niezależnie od `prefers-color-scheme`, co jest zachowaniem istniejącym,
nie zmienionym tym dyżurem). Poniżej dosłowny zapis żądań/odpowiedzi i stanu
`localStorage`/URL z tamtej sesji, jako dowód tekstowy.

## Scenariusz A — reset hasła w TEJ SAMEJ karcie, użytkownik już zalogowany

1. Zalogowano się (`auth401eval@dbr77.local`) w karcie przeglądarki → `/chat`
   (AI Chat), `localStorage.token`/`refreshToken`/`user` ustawione.
2. W TEJ SAMEJ karcie: `POST /api/auth/forgot-password` → token z
   `password_resets` (baza-klon) → `POST /api/auth/reset-password` (fetch z
   poziomu strony, więc ciasteczka tej karty faktycznie się czyszczą — backend
   wywołuje `revokeAllUserTokens` + `clearAuthCookies`, `auth.routes.ts:2440-2456`).
3. Przejście na formularz `/reset-password?token=...` i kliknięcie „Reset
   password” (realny submit przez UI, nie fetch z konsoli).
4. WYNIK PO NAPRAWIE: strona natychmiast ląduje na
   `http://127.0.0.1:3901/login?reason=password_reset`, banner
   „Password changed. Sign in with your new password.” (klucz i18n
   `auth.passwordResetMessage`, PL: „Hasło zmienione. Zaloguj się nowym
   hasłem.”). Zweryfikowano w konsoli strony:
   ```
   { token: null, user: null, url: "http://127.0.0.1:3901/login?reason=password_reset" }
   ```
   `localStorage.getItem('token')`, `refreshToken`, `user` = null;
   `JSON.parse(localStorage['consultify-storage']).state.currentUser` = null.

## Scenariusz B — sesja unieważniona GDZIE INDZIEJ, karta siedzi na `/chat`

Wariant wymagany przez zlecenie: użytkownik NIE robi nic w tej karcie — 401
ma przyjść z zewnątrz i mimo to zakończyć sesję lokalnie.

1. Zalogowano się w karcie → `/chat`. Token w `localStorage` obecny.
2. Reset hasła wykonany fetch()'em z TEJ SAMEJ karty (żeby ciasteczka tej
   karty realnie się wyczyściły — ciasteczka są per-przeglądarka, nie per-URL;
   próba z osobnym `curl` NIE czyści ciasteczek karty, to ślepy zaułek, na
   który trafiłem po drodze i odnotowuję dla przyszłych prób), ale BEZ
   nawigacji — karta zostaje na `/chat`, zero reakcji UI (dokładnie wygląd
   defektu zgłoszonego przez właściciela).
3. Symulacja wywołania modułu bez nagłówka Authorization (dokładnie jak
   `src/services/initiatives-execution/runtimeApi.ts`):
   ```js
   fetch('/api/initiatives/runtime-v1/execution-cases/x/work', { credentials: 'include' })
   // -> 401 (ciasteczko auth wyczyszczone, brak nagłówka Bearer)
   ```
4. WYNIK PO NAPRAWIE (≈2s później, bez żadnej dalszej akcji użytkownika):
   karta sama przeszła na
   `http://127.0.0.1:3901/login?redirect=%2Fchat&reason=session_expired`,
   banner „Your session has expired. Please sign in again.” (klucz
   `auth.sessionExpiredMessage`, PL: „Sesja wygasła. Zaloguj się ponownie.”).
   `localStorage.token` = null.
5. Zero pętli: kolejne 3 pełne przeładowania zalogowanej karty (`/chat` x3)
   nie wylogowały użytkownika ani razu — mechanizm reaguje tylko na realny
   401 z chronionej trasy, nie na samo bycie na `/login`.

### Odkryta po drodze luka (naprawiona w tym samym dyżurze)

Pierwsza wersja naprawy (prosty `navigate()` w handlerze `auth:token-expired`
w `App.tsx`) w tym dokładnym scenariuszu B PRZEGRYWAŁA wyścig z
`RouterSync.tsx` — `RouterSync` jest jedynym autorytetem przekierowania
„niezalogowany na chronionej trasie” i w tym samym render-passie nadpisywał
mój `navigate('/login?reason=...')` swoim `navigate('/login?redirect=...')`
(zmierzone: URL kończył się jako `/login?redirect=%2Fchat` BEZ `reason`).
Naprawiono przez `src/services/authRedirectReason.ts` — mały handoff przez
`sessionStorage` (10s ważności), który `RouterSync` sam odczytuje i dokleja
do WŁASNEGO przekierowania, zamiast z nim konkurować. Potwierdzone powtórnym
przebiegiem scenariusza B (patrz punkt 4 powyżej — `reason=session_expired`
faktycznie w URL).

Druga odkryta luka: `tokenService.init()` (rejestruje listener `auth-error`)
uruchamiał się TYLKO w efekcie montowania `App.tsx`, sprawdzającym
`localStorage` PRZED zamontowaniem — świeże logowanie w tej samej sesji SPA
(bez przeładowania strony) nigdy nie wywoływało `init()`, więc cały mechanizm
odzyskiwania sesji był martwy aż do najbliższego pełnego reloadu. Naprawiono
wywołaniem `this.init()` wewnątrz `tokenService.saveTokens()` (idempotentne,
`init()` ma już wewnętrzny strażnik `isInitialized`).

## Testy vitest (uruchomione osobno, wynik poniżej dosłownie)

```
$ npx vitest run src/services/__tests__/globalAuthFetchGuard.test.ts src/services/__tests__/authRedirectReason.test.ts
 ✓ globalAuthFetchGuard.test.ts (5 tests)
 ✓ authRedirectReason.test.ts (6 tests)
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

Mutacje (obie przywrócone po teście):
- usunięcie `/api/auth/login` z `AUTH_ALLOWLIST_PREFIXES` w
  `globalAuthFetchGuard.ts` → test „does NOT dispatch auth-error on a 401
  from /api/auth/login (allowlisted)” → RED (potwierdzone dosłownie:
  `AssertionError: expected "vi.fn()" to not be called at all, but actually
  been called 1 times`).
- podbicie `MAX_AGE_MS` w `authRedirectReason.ts` do prawie nieskończoności →
  test „ignores a reason older than 10s” → RED (potwierdzone:
  `expected 'session_expired' to be null`).

## Bramka tsc

`NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc -p tsconfig.json --noEmit`
→ 1 błąd w całym repo, w pliku NIEdotkniętym tym dyżurem
(`src/views/admin/AdminSettingsModule.tsx(342,5): error TS2304: Cannot find
name 'currentUser'.` — istniał już przed tą zmianą, poza progiem ≤200, zero
błędów w plikach tego dyżuru).
