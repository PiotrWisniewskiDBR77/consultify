# CODEX DAY 194 — obiekt spotkania (181-bis)

Data pomiaru: 2026-08-30/31  
Baza: marker `6894f3da05`  
Gałąź: `codex/day194-obiekt-spotkania-20260831`  
Werdykt całości: `PARTIAL / EVIDENCE_MISSING` — R2 dowiedzione, R1 i R3 niezamknięte.

## 0. Wejście, marker i rozjazd

Instrukcja z vaulta została przeczytana w całości (851 linii). Dokument miał stan
`WYDANY`. Po zasadnym STOP-ie dyskowym wznowienie zaczęło się ponownym pomiarem:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    27Gi    31%    459k  286M    0%   /
```

Wynik §0.1 (2), dosłownie:

```text
d4b67d8818 docs(codex): dyzur 196 wydany — sprzatanie zbiorcze 4 pozycji z kart odbiorow
f03fba4c20 docs(codex): dyzur 195 wydany (dokument pokazywalny — 700+ slow, granulacja zalozen, render Markdown, okladka PL)
7b9612abe7 docs(codex): dyzur 194 wydany — strona obiektu spotkania (181-bis): diagnoza runtime do przyczyny, naprawa, dowod zrzutem
63cc3190fc test(z31): unpin the last 5 database identity assertions
516ce4cade odbiory 188+193: OBA SCALONE — mutacje niezalezne; 5 pozostalych pinow -> FIX-193b; baner earnings do decyzji wlasciciela
3d8084c6c8 merge: dyzur 193 (9 pinow Z31 odpietych w 7 plikach — wszystkie zielone na trzecim kontenerze)
1bf3095e6f merge: dyzur 188 (rozliczenia partnera 200 z jawnym stanem zamiast 500; projects: blad!=pustka, JOIN ::text) — odbior B+, mutacje niezalezne
6894f3da05 odbior 189: SCALONO po FIX-189
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
6894f3da05375672bca0207c98dcd2f3e241f2a5
```

Tip uciekł do przodu. `git log 6894f3da05..github-backup/codex/m03-admin-20260824`
zwrócił 11 commitów (od `e972957c06` do `d4b67d8818`). `git diff --name-only`
zwrócił 19 plików, w tym wydaną instrukcję 194. Zgodnie z DEC-95 praca zaczęła
się dokładnie z markera; nie wykonano rebase.

## 1. Baza, migracje, fixture i Z30

- Kontener: `cx-day194-pg`, obraz `pgvector/pgvector:pg16`.
- Tożsamość aplikacji: `127.0.0.1:6120/consultify_w3_meetings_owner_cx194`.
- Pierwszy pełny przebieg migracji: `870` pozycji `→`, zakończony
  `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, zakończony bez błędu.
- Fixture: `W3-MEETINGS-OWNER-v1`, `ownershipState=FINAL`; ADMIN/OWNER/MEMBER
  mają membership `ACTIVE`; pending/rejected/approved są obecne w readbacku.
- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"`:
  `BRAK ZMIENNYCH POCZTY`.
- `SELECT ... FROM settings WHERE key LIKE 'smtp%';`: `(0 rows)`.
- `Gateway.ts`: brak drenaży outboxu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu na potrzeby testów. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

## 2. R1 — diagnoza runtime

Werdykt: `PARTIAL / PRZYCZYNA NIE POTWIERDZONA`.

Fakty zmierzone:

1. W całym `MeetingObjectPage.tsx` istnieją tylko dwa wywołania `setLoading`:
   `true` na wejściu do `loadMeeting` i `false` w `finally`. Kandydat (b) nie ma
   dziś statycznego źródła, ale bez pełnej przeglądarki nie ogłaszam go jako
   runtime-obalonego.
2. Kanoniczny harness uruchomił serwer z `NODE_ENV=development`, poprawnym SHA,
   prawdziwą bazą i fixture. `server.log` pokazał:
   `Server running on http://0.0.0.0:5060`, `Database ready — serving traffic`.
3. Niezależny od harnessu odczyt:
   `curl --noproxy '*' http://127.0.0.1:5060/api/health` zwrócił `HTTP/1.1 200 OK`,
   `database=connected`, SHA `6894f3da...`.
4. Mimo tego wewnętrzny Node `fetch()` kwalifikatora harnessu po 120 s zgłosił
   `http://127.0.0.1:5060/api/health not ready: TypeError: fetch failed` i harness
   poprawnie zakończył oba własne procesy.
5. Gdy runtime żył i oba porty słuchały, przeglądarka Chromium odmówiła wejścia
   na `http://127.0.0.1:5061/` z `net::ERR_UNSAFE_PORT`. Porty 5060/5061 są przez
   Chromium blokowane jako unsafe (klasa SIP). Z7 zabrania użycia portu
   zastępczego, więc nie wykonano obejścia.

Nie ma zatem uczciwej podstawy, aby wybrać (a), (b) albo (c) jako przyczynę
zrzutów Dyżuru 181. R1 pozostaje otwarte; udowodniono osobny konflikt zasobów
instrukcji z realną przeglądarką oraz osobną rozbieżność `curl 200` kontra
kwalifikator `fetch failed`.

## 3. R2 — honest error i realny Gateway

Commit: `c6cb33a98b43af8c5b0871d61525a1d585104e76`.

`loadMeeting` ma teraz limit 20 sekund przez `Promise.race`. Wybrano 20 s, bo
jest dostatecznie długi dla lokalnego/typowego HTTP, a jednocześnie kończy
nieskończony stan w czasie możliwym do świadomego retry. Timeout wpada do
istniejącego `catch`, ustawia istniejący `loadError`, a `finally` zawsze zdejmuje
`loading`. Nie zmieniono triady `loading/loadError/notFound` ani innych sekcji
komponentu.

### Test frontu i mutacja Z32

- Nowy pełny `fullName`:
  `MeetingObjectPage leaves the loading state for an honest retryable error when the meeting request never settles`.
- Po chwilowym usunięciu kodu timeoutu: `0 passed / 1 failed` (czerwony).
- Po przywróceniu przez `cp`: `1 passed / 0 failed` (zielony), `cmp` = OK.
- Pełny plik: `9/10`; nowy przypadek przeszedł, zastany
  `Decyzje i działania section shows meeting decisions and follow-ups` nie
  znalazł `Ship v2`. Ten sam zastany przypadek uruchomiony samodzielnie również
  pada, więc nie osłabiono asercji i nie wpisano fałszywego pełnego PASS.

Pułapki środowiska: pakiet frontowy jest czysto jednostkowy (`RUN_DB_TESTS=0
MOCK_DB=true`), więc nie dowodzi DB/Gateway. `--retry=0` wyłączyło retry.

### Realny Gateway + realny Postgres

Nowy test `meeting.object.day194.pg.test.ts` montuje
`ApiGateway.getInstance().initializeRoutes(app)`, używa podpisanego JWT ADMIN,
realnego `verifyToken`, pełnych migracji i fixture w lokalnym Postgresie.
Wynik JSON: `3/3`, pełne nazwy:

- `... returns 200 plus the pending fixture body`
- `... returns 200 plus the rejected fixture body`
- `... returns 200 plus the approved fixture body`

Każdy przypadek asertuje `HTTP 200`, literalne ID, tytuł i organizationId.
Istniejący `meeting.m12-golden-flows...` nie został użyty jako dowód Gateway,
bo mockuje auth i montuje router w gołym `express()` (Z22).

Pułapki wyłączone: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`
(asercja w pierwszym `beforeAll`), `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`,
`ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny loopback
`DATABASE_URL`, jawny testowy `JWT_SECRET`, `--retry=0`. `numTotalTests=3`.

## 4. R3 — zrzuty i ocena treści

Werdykt: `EVIDENCE_MISSING`.

Nie utworzono sześciu plików PNG. Chromium nie otwiera przydzielonego portu
`5061` (`ERR_UNSAFE_PORT`), a użycie innego portu łamałoby Z7. Nie twierdzę więc,
że pending/rejected/approved renderują kartę zamiast spinnera, ani że G08 jest
lub nie jest widoczny. Nie ma hashy PNG, bo nie istnieją pliki PNG.

Kod `src/routes/AppRoutes.tsx` nadal montuje ten sam `MeetingObjectPage` dla
OBJECT, MINUTES, DECISIONS i NOTE. To dowód strukturalny, nie przeglądarkowy.

## 5. Korekty wobec instrukcji

1. §0.5/Z7 wymaga wyłącznie portów `5060 i 5061`, natomiast R1/R3 wymagają
   realnej przeglądarki. Chromium zwraca `ERR_UNSAFE_PORT` dla `5061`.
   Bezpieczniejsza interpretacja: nie używać innego portu, zachować
   `EVIDENCE_MISSING` i kontynuować niezależne R2.
2. Kanoniczny harness uznał health za nieosiągalny przez swój `fetch`, podczas
   gdy w tym samym podejściu `curl --noproxy '*'` dostał `200` z właściwym SHA.
   Nie edytowano harnessu (tylko odczyt); rozbieżność jest wynikiem, nie podstawą
   do improwizacji.
3. `CLAUDE.md` wymaga skilla `consultify-artefakty`, ale skill nie był dostępny
   w sesji. Zastosowano istniejący kod SPEC-A i pre-commit `check-artefakt`, który
   przeszedł bez nowego naruszenia.

## 6. TWIERDZENIA NIEZWERYFIKOWANE

- Która z gałęzi (a)/(b)/(c) wyjaśnia zrzuty Dyżuru 181: `NOT_PROVEN`.
- Czy OBJECT, MINUTES, DECISIONS i NOTE faktycznie renderują identyczną treść po
  zmianie: `NOT_PROVEN` w przeglądarce; potwierdzone tylko wspólne montowanie
  komponentu w kodzie.
- Czy timeout realnie renderuje ErrorState w pełnej przeglądarce: `NOT_PROVEN`;
  dowód jednostkowy jest mutacyjny, ale nie zastępuje przeglądarki.
- Czy G08/G09/G10 nadal są widoczne: `NOT_PROVEN` w tym dyżurze; nie naprawiano.
- Pułapka `RUN_DB_TESTS` nie odegrała roli w sesji runtime: harness użył
  `NODE_ENV=development`; w testach użyto jawnego pełnego env. Była kontekstem,
  nie przyczyną potwierdzoną.

## 7. Artefakty i SHA-256

```text
7cc2926680323824cbc15f29b8d5e0ce1e7bbfcbc1033b80e2aae24a36433291  day194-gateway-vitest.json
7e4db63e4bc7d952a0c13cd8fc6939f293d3c61eddcba8b3cf98785642d13d31  day194-front-timeout-mutation-red.json
beb2cdf7cb06838cdbc441cfc34bbd0e4b896c32b64d22d402a851914135f045  day194-front-timeout-restored-green.json
cf16e38354eb35197de9e2ce6bddb6d82fb075620c8d08db7e7a00b6c8ab6384  day194-front-vitest.json
023860008dd216f04a56814953d595950fb21fb53c6856494923368acad668cf  health-body.txt
1ade0e1f105818fcd62238247d5619b15bdd30183d7918669f54a8a0f6408d8d  meetings-owner-manifest.json
```

Wszystkie leżą w
`/private/tmp/cx-day194-obiekt-spotkania-artefakty/`; niczego z tego katalogu
nie dodano do repo.

## 8. Pliki dotknięte

```text
src/components/Meeting/MeetingObjectPage.tsx
src/components/Meeting/__tests__/MeetingObjectPage.test.tsx
server/src/routes/__tests__/meeting.object.day194.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY194_OBIEKT_SPOTKANIA_REPORT.md
```

Nie zmieniono flag, modelu uprawnień, infrastruktury testowej, G08/G09/G10 ani
wcześniejszych wpisów `MTG-PF-001..006`.
