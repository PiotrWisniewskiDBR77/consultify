# RAPORT — CODEX1 — Inicjatywy: jeden magazyn danych

## 0. Metryka

Marker `4630b1ee4c` · gałąź `codex/inicjatywy-jeden-magazyn-20260910` · kontynuacja od `49cd114773`. SHA: E1 `ed839277a5` · E2 `f370173d69` · E3 `ce2d053b49` · E4 `feacde5d64` · E5 `606b5a0efd` · E6 bieżący commit. Marker jest przodkiem HEAD.

Dump: 235 622 708 B; `shasum -a 256` przed importem: `ae743d287395cb0611bfc146fe58d47f482d50913d4198b2bdfc7d43664fc711` — zgodne. Import tylko do `cx-codex1-inicjatywy-pg` / `codex1_staging_1009` / `127.0.0.1:6451`, przez `pg_restore --no-owner --no-privileges`. PG16 odmówił przed zapisem (`unsupported version (1.16)`); pusty własny kontener zastąpiono PG17, restore RC=0. Dumpu nie kopiowano ani nie modyfikowano. Port 5591 wolny.

## 1. K-PUNKTY — PRZED i PO

| K | PRZED | PO |
|---|---|---|
| K1 bramki legacy | 50 / 19 plików | 50; pozostałych 47 nie przełączono |
| K2 pisarze E4 | 6 żywych | 6 zostaje decyzją CTO |
| K3 kanon bez legacy | 17 (instrukcja: 15) | 17 po rollbacku |
| K4 legacy bez kanonu | 107 (instrukcja: 699) | 105 po apply; 107 po rollbacku |
| K5 organizacje kanon / legacy | 2 / 3 | 2 / 3 |
| K6 powierzchnie | OFF 0/7 | ON 3/7: lista, karta, KPI |
| K7 wiersze | legacy 121, kanon 31, wspólne 14 | apply 33; rollback 31 |
| K8 pominięte | całość: project 78, owner 104, unia 111, oba 71 | zbiór migracji: project 77, owner 98, unia 105, oba 70; kwalifikowalne 2 |

## 2. Stan wejściowy — 9 komend z §0.1a

50 bramek w 19 plikach; zapis UI do kanonu; most kliencki żyje; 159 plików po wyłączeniu `_backup`; 4 wzorce middleware; kanoniczna lista istnieje; 0 realnych `.catch(() => {})`; porty wolne, kontener nie istniał, przedział migracji pusty. Nie scalano nowszego `origin/staging`.

## 3. Etapy — po jednej sekcji na etap

### E1

Bez zmian: real-PG przez `ApiGateway`, JWT i SQL 8/8, SHA `ed839277a5`.

### E2

Trzy powierzchnie pod `ENABLE_INITIATIVE_UNIFIED_READ`, default OFF, SHA `f370173d69`. Nie przełączono 47 bramek i nie przepisano C1-FIX 1–8.

### E3

Import: legacy 121, kanon 31, wspólne 14, kanon bez legacy 17, legacy bez kanonu 107. Dry-run: `107 = 2 kwalifikowalne + 105 POMINIĘTE`; osobny manifest zawiera pełne wiersze. Apply #1: `created=2`, `31→33`, rozjazd `107→105`; apply #2: `created=0`; verify `ok=true`. Rollback usunął 2; verify `ok=true`, rozjazd wrócił do 107. Md5 `initiatives` przed/po: `211e648a64804feb2f6ea09bffe7e13a`. Migracja SQL nie była potrzebna.

**FIX-E6-3(a) — dopisane po odbiorze C2 (`96_ODBIOR_C2_E3_E5.md` §2.3), zmierzone niezależnie:**
migracja **nie zmienia żadnej liczby widocznej przez API**. `GET /api/initiatives` przed
`--apply`, po `--apply` i po `--rollback` jest identyczny na każdej organizacji, w obu
ustawieniach flagi (`DBR77/ON=121 DBR77/OFF=106 TT22TT/ON=2 TT22TT/OFF=2` — bez zmian we
wszystkich trzech krokach). Powód: czytnik unified (E2) już robi UNION obu magazynów, więc
te 2 rekordy i tak były widoczne przez gałąź zastaną — migracja jedynie przenosi je na gałąź
kanoniczną tej samej mapy, nie dodaje ani nie ujmuje niczego z odpowiedzi API.

**FIX-E6-3(b) — dopisane po odbiorze C2, zmierzone niezależnie:**
**DBR77 dostaje 0 migrowanych rekordów ze 106** (Northwind — 0 z 13). Obie kwalifikowalne
inicjatywy należą do organizacji `3935603f…` ("TT22TT") i są śmieciem testowym ("próba 1"
oraz szkic wygenerowany z kanwy). Realna wartość E3 na TYM zbiorze danych nie leży w
widoczności (ta jest z E2), tylko w udostępnieniu komend kanonicznych (cykl życia, bramki)
dla rekordów zastanych — a ta wartość dziś dotyczy wyłącznie 2 rekordów śmieciowych, nie
organizacji demo.

### E4

Decyzja CTO: `milestones`, `resources`, `staffing-plans`, `budget-items`, `gate-roles`, `move` zostają bez zmian. Nie projektowano następców. Tabela dowodowa jest wejściem do osobnego bloku.

**FIX-E6-3 uzupełnienie — siódmy pisarz zastany, pominięty w inwentarzu E4:**

| # | Pisarz | Plik | Do kanonu? |
|---|---|---|---|
| 1–6 | `milestones`, `resources`, `staffing-plans`, `budget-items`, `gate-roles`, `move` | (decyzja CTO — zostają bez zmian) | NIE |
| **7** | **seed demo** | **`server/src/services/demo/demoSeedService.ts:2295`** | **NIE — świeży błąd** |

Siódmy pisarz nie był widoczny w inwentarzu `§0.1a`, bo ten opiera się na wzorcach middleware,
a seed demo pisze bezpośrednio `INSERT INTO initiatives` z pominięciem `createInitiativeService`
(świadomy wyjątek "USPOJNIENIE A3" — seed jest idempotentny przez `ON CONFLICT DO UPDATE`,
przejście przez serwis złamałoby re-seedowalność). Zmierzone na żywo w odbiorze C2: samo
otwarcie aplikacji w przeglądarce zasiało 2 sesje demo × 22 inicjatywy = 44 nowe wiersze w
`initiatives`, z czego 0 w kanonie (`ie_aggregate_state`). Każda sesja demo powiększa rozjazd
między magazynami o 22 rekordy — pisarz nietknięty tym blokiem, do rozliczenia osobno.

### E5

Test real-PG tworzy rekord drogą API używaną przez zapis UI; SQL `kanon=1`, `zastany=0`. Pakiet E1+E2+E5: ON 12/12 i OFF 12/12, `--retry=0`.

| Powierzchnia / trasa | ON | OFF | Treść widoczna |
|---|---|---|---|
| lista `/api/initiatives` | 200, id+tytuł | 200, brak | ON TAK |
| karta `/api/initiatives/:id` | 200, id+tytuł | 404 | ON TAK |
| KPI `/api/initiatives/:id/kpis` | 200, nie `INITIATIVE_NOT_FOUND` | 404 | ON TAK |
| Realizacja `/api/v8/execution-control/capacity/timeline?initiativeId=…` | 404 | 404 | NIE |
| Moja Praca `/api/my-work/executive-analytics` | 200 bez rekordu | 200 bez rekordu | NIE |
| Wyniki `/api/v8/results/dashboard?initiativeId=…` | 404 | 404 | NIE |
| raporty `/api/report-builder/backlinks/initiative/:id` | 200, echo id bez tytułu | to samo | NIE — Z23 |

**FIX-E6-2 — poprawione uzasadnienie STOP-u Playwright** (pierwotne zdanie poniżej było
nieścisłe — zastąpione po odbiorze C2, `96_ODBIOR_C2_E3_E5.md` §1.6): `playwright.config.ts:9`
ma `const useWebServer = process.env.E2E_USE_WEB_SERVER === 'true'`, **domyślnie WYŁĄCZONE** —
sam config NIE startuje `server/src/index.ts` bezwarunkowo, jak sugerowało poprzednie zdanie
("harness uruchamia `server/src/index.ts` (`playwright.config.ts:125–128`)"). Prawdziwy, mocniejszy
powód STOP-u: Playwright bez `webServer` wymaga DZIAŁAJĄCEGO backendu pod `E2E_API_URL`, a
Z30-bezpiecznego hosta dla przeglądarki **NIE MA**. Zbudowany minimalny zamiennik
(`ApiGateway.initializeRoutes()` + `express().listen()`, bez drenaży/Schedulera) nie montuje
`/api/csrf-token` (żywy w `server/src/index.ts:1251`) ani nagłówka CORS `x-csrf-token`
(`server/src/index.ts:1130`) — moduł Inicjatywy na takim hoście nie ładuje danych
(`Failed to load initiatives … UNKNOWN_ERROR`, `GET /api/csrf-token → 404`), mimo że ten sam
`fetch` z konsoli z jawnym `Authorization` zwraca 200. Odtworzenie pełnego stosu middleware
`index.ts` bez jego uruchamiania na bazie z żywymi danymi klienta nie zostało wykonane w tym
bloku — STOP jest zasadny, ale z INNEGO powodu niż napisano pierwotnie.

**§0.2e — pułapki (a)–(e), dopisane po odbiorze C2** (bez tego akapitu pomiar E5 nie liczy
się jako dowód — brakowało go w pakiecie pierwotnym):

- **(a) `ENABLE_V8_GLOBAL=true`** — ustawione w OBU przebiegach (ON i OFF). Powierzchnie 4 i 6
  (Realizacja, Wyniki) DALEJ dają 404, treść to `{"error":"Initiative <id> not found","code":"INITIATIVE_NOT_FOUND"}`
  — bramka DOMENOWA (jedna z 50 pytających tabelę zastaną), nie `v8FeatureGate`. Pułapka (a)
  NIE fałszuje wyniku.
- **(b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`** — ustawione. Wynik powierzchni
  „Wyniki" bez zmian (404 domenowe). Nie fałszuje.
- **(c) `DB_TYPE='sqlite'`** w `vitest.config.ts` jest domyślne, ale omijane przez
  `MOCK_DB=false DB_TYPE=postgres` w env wywołania.
- **(d) `ENABLE_TEST_AUTH_BYPASS`** — jawnie nieustawione; test podpisuje realny JWT
  `config.JWT_SECRET`, `/api/auth/me` na tym tokenie zwraca 200 z realnym użytkownikiem. Nie
  dotyczy.
- **(e) `409` z middleware zapisu** — nie dotyczy E5: pakiet nie robi równoległych zapisów do
  tras zastanych, więc konflikt wersji nie jest tu mierzony. Jawnie nazwana luka, nie jedna z
  siedmiu powierzchni.

Te ustalenia i twarde asercje `beforeAll` (ENABLE_V8_GLOBAL, RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE,
DB_TYPE, ENABLE_TEST_AUTH_BYPASS) są teraz w nagłówku i `beforeAll`
`nowyRekordSiedemPowierzchni.pg.test.ts` (FIX-E5-2), nie tylko w tym raporcie.

### E6

Raport zachowuje 14 sekcji i oddziela zielony test charakteryzujący od nieosiągniętego celu 7/7.

## 4. Dowody mutacyjne (Z32)

Dowód E2 zachowany: mutacja gałęzi kanonicznej 8/10; cofnięcie 10/10; diff pusty. E5 nie jest deklarowane jako FIXED/VERIFIED, bo macierz wynosi 3/7.

## 5. Pomiar zasięgu testów (§0.4a, Z24)

PRZED 8 pełnych nazw · po E2 10 · po E5 12. Dodane: test tworzenia z SQL `1/0` oraz test treści siedmiu tras. Zniknięte: brak. Dowód: `po-e5-nazwy.txt`, `diff-e5-nazwy.txt`.

## 6. Deklaracja Z30

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego bloku nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. `ie_outbox_delivery_receipts` po migracji ma 0 wierszy. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie nie zostało wysłane.”**

Przed zapisem: brak env poczty, `settings smtp%=0`, brak drenaży w Gateway. Po apply receipts `0`.

## 7. Migracja danych — manifest

- apply: `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/inicjatywy-kanon-apply-2026-09-10T17-02-20-127Z.json` · 507 B · 2026-09-10 19:02:20 +0200 · SHA `cb4851d794565713209717db8bd84931c91bfb32356b5d238348c871b18fe9ba`.
- „do decyzji właściciela”, pełne 105 wierszy: `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/inicjatywy-kanon-apply-2026-09-10T17-02-20-127Z-do-decyzji-wlasciciela.json` · 920 043 B · 2026-09-10 19:02:20 +0200 · tryb 0600 · SHA `8ffc4f2f644ca43fad2dd5a29d0c64b671d81be82bf1d2620d712f4e30124c01`.
- rollback receipt: `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/inicjatywy-kanon-rollback-2026-09-10T17-03-39-088Z.json` · 510 B · 2026-09-10 19:03:39 +0200 · SHA `7a39ab6640eb20d4981793911c0ba79c92268c18e8e0a5c5ecd60e2fe32e7546`.

## 8. Korekty wobec instrukcji

- 713/29/699/15 zastępują wyniki dumpa: 121/31/107/17; wspólne 14.
- 78/104 dotyczy całej tabeli; mianownik migracji daje 77/98, unię 105 i przecięcie 70.
- Dump 1.16 wymagał PG17. Zachowano jeden własny kontener, port i bazę.
- Playwright nie ma dozwolonego harnessu bez pełnego serwera.

## 9. STOP-y

**FIX-E6-1 — najważniejsza liczba tego etapu, dopisana po odbiorze C2:** warunek STOP z
`§E3` instrukcji ("liczba pominiętych przekracza 30% zbioru") był spełniony z OGROMNYM
zapasem: **105/107 = 98,1%** zbioru migracji (nie tylko "powyżej progu" — prawie CAŁY zbiór).
Ten STOP rozstrzygnęła Z GÓRY decyzja CTO (`bdc9d99eba`: pisarze zostają, E5 przez API), nie
osąd wykonawcy w trakcie pracy — to jest fakt, który powinien był stać w tym raporcie od
początku, bo 98,1% zmienia charakter decyzji z "przekroczenie progu" na "zbiór niemal w
całości niekwalifikowalny bez zmiany reguły produktu" (patrz opcje w `96_ODBIOR_C2_E3_E5.md` §4).

E3 i E4: STOP-y rozstrzygnięte decyzją CTO. E3 wykonany bez zgadywania; E4 pozostawiony bez zmian.

E5 Playwright: STOP MERYTORYCZNY. Licencja E5 dopuszcza STOP, gdy harness nie wstaje; Z30 zakazuje wykrytego `server/src/index.ts`. Zamiast warstwy przeglądarkowej wykonano wymagany HTTP+SQL 7 tras, ON/OFF. Nie uruchomiono zakazanego procesu.

**FIX-E6-2 uzupełnienie:** prawdziwy powód braku harnessu przeglądarkowego nie jest "config
uruchamia `index.ts`" (nieścisłe — `E2E_USE_WEB_SERVER` domyślnie OFF), tylko brak
Z30-bezpiecznego hosta dla przeglądarki (`/api/csrf-token` i nagłówki CORS żyją wyłącznie w
`server/src/index.ts`, nie w `ApiGateway`) — pełne uzasadnienie w sekcji E5 wyżej.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Warstwa Playwright pozostaje NIEZWERYFIKOWANA.
- Pozostałe 47 bramek pozostaje NIEPRZEŁĄCZONE decyzją E2.
- Przyszłe zachowanie 105 pominiętych rekordów pozostaje NIEZWERYFIKOWANE.

## 11. DO DECYZJI WŁAŚCICIELA

105 rekordów bez agregatu nie ma wymaganej pary pól: 77 bez `project_id`, 98 bez `owner_business_id`, 70 bez obu. Potrzebna jawna mapa projekt/właściciel per rekord albo decyzja o pozostawieniu poza kanonem. Niczego nie przypisano domyślnie.

**FIX-E6-3 — dwa fakty zmierzone w odbiorze C2, istotne dla decyzji:**

(a) Migracja **nie zmienia żadnej liczby widocznej przez API** — `GET /api/initiatives`
przed `--apply` / po `--apply` / po `--rollback` jest identyczny na każdej organizacji, w
obu ustawieniach flagi (czytnik unified E2 już robi UNION obu magazynów).

(b) **DBR77 dostaje 0 migrowanych rekordów ze 106** (Northwind — 0 z 13). Obie kwalifikowalne
inicjatywy (dziś jedyne, które migracja realnie rusza) należą do organizacji testowej
"TT22TT" i są śmieciem ("próba 1", szkic z kanwy) — czyli decyzja o 105 pominiętych dotyczy
WYŁĄCZNIE organizacji DBR77/Northwind, a sama migracja na tym zbiorze danych nie dowozi dziś
żadnej wartości demo/produkcyjnej, tylko mechanikę gotową na przyszłe dane z kompletnymi polami.

## 12. ZNALEZISKA POBOCZNE

- `pmoValidation.middleware.ts:206`: bramka bez `organization_id`; nietknięta.
- Cztery powierzchnie pozostają niepodłączone: Realizacja, Moja Praca, Wyniki, raporty.
- Zielone 12/12 charakteryzuje macierz 3/7 i 0/7; nie dowodzi celu 7/7.

## 13. Artefakty

Katalog `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty`:

- `e3-dry-run.json` `61318d9f0aaff37fe84bd798c44d9f16f03eb3d43e200f10ada5d04283381ff9`
- `e3-apply-1.json` `30dd36761dadcd226c91bb8b55aeb49bcf881a099daff93b262d49e05432c560`
- `e3-apply-2.json` `3e32d2acad405fe96e778a7db0688bdab1fc2e7d83d744c4f11d478d0121333b`
- `e3-verify-after-apply.json` `e7bdf401d662b8340c9b301cdbebec2ded1b7963e5f430fa8287d4dab69097ee`
- `e3-rollback.json` `a47d163015b2c43b2a0688b0ca80dcecb48280ac53aea08e63be1a8cad1e00c4`
- `e3-verify-after-rollback.json` `e50a7aa0dbad9f436a5405061ff7fbf0f786c77fe12a5302e90959e803faab17`
- `e5-on-full.json` `2339121f34b6124555ddefaddaa26fac075bc579ffac83cea3f50d58cf356b89`
- `e5-off-full.json` `e137ae81186921f6611dd2d0eff30e8c8a964ce8caed3bab59365ddc98e3ca8a`
- `e5-on-matrix-final.json` `4896bd909ecfb272918bd80c03fa93fc6fd2e884ed85fb20dd729cd79a0c0516`
- `e5-off-matrix-final.json` `682c3de3ad617e80f92af474d2cf74e35240fb28bb781158ba1d25ddeb0e4013`
- `po-e5-nazwy.txt` `61519deb65c4d94fa87a5f24e720c7808bf611b4dc0ef6430803b873ecb65ca6`
- `diff-e5-nazwy.txt` `4955b490b0d2e03b420c95cf5f48cea57017656df6db334eb77d1b71545374e7`
- `e4-szesc-sciezek.txt` `283b6100b6577bffd8dce01961c670b06dc107a2a6dcb3b52c53c7f861f221dc`
