# CODEX DAY211 — pułapka `clearAllMocks`

Data: 2026-08-31  
Baza: `fe33ce8036`  
Gałąź: `codex/day211-atrapy-20260831`

## Wynik

R0–R4 wykonane. Precyzyjna sonda AST przeskanowała 5915 śledzonych plików testowych i znalazła **5** plików z łańcuchowym setterem mocka wewnątrz lokalnego `beforeAll`: **4 w grupie (a)** i **1 w grupie (b)**. Liczba `87` jest obalona. Luźne współwystępowanie z W4 dało 136, ale nie jest dowodem zasięgu.

R0 rozstrzygnęło kształt błędu: `vi.spyOn(...).mockResolvedValue(...)` z `beforeAll` przechodzi w pierwszym teście i traci implementację w drugim (`real` zamiast `mock`); `vi.fn(() => X)` zachowuje implementację w obu testach. Dlatego dwa szerokie kandydaty z bezpośrednim `vi.fn(impl)` są sprawdzone i wykluczone z R1.

## BLOK 0 i bezpieczeństwo

`df -h /`: 16 GiB wolne, więc więcej niż wymagane 5 GiB. Porty 6151, 5092 i 5093 były wolne (3 z 3); kontener `cx-day211-pg` był nieobecny. Uruchomiono wyłącznie `pgvector/pgvector:pg16` pod `127.0.0.1:6151`, baza `cx211`. Pierwszy przebieg migracji zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0` i `Postgres migrations complete`.

Wynik markera i sanity, dosłownie:

```text
MARKER OK
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
```

Tip gałęzi bazowej uciekł do `0a84c3d1b0`; zgodnie z DEC-2026-08-26-95 praca pozostała dokładnie na markerze, bez rebase.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `env` zwróciło `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

## R1 — pełny inwentarz

Komenda ostateczna: `node /private/tmp/cx-day211-atrapy-scratch/probe-clearallmocks-211.mjs`; wynik: `scannedFiles=5915`, `candidates=5`.

| # | Plik | `beforeAll` | setter | testy | reinstalacja w `beforeEach` przed zmianą | grupa | powód |
|---|---|---:|---:|---:|---|---|---|
| 1 | `server/src/routes/interviewDelivery/__tests__/interviewAiReviewTimeoutFallback.pg.test.ts` | 70 | 101 | 2 | nie | (a) | brak `beforeEach` |
| 2 | `server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts` | 49 | 83 | 6 | nie | (a) | brak `beforeEach` |
| 3 | `server/src/services/ai/__tests__/day205.decisionWisdom.pg.test.ts` | 21 | 34 | 1 | nie | (b) | jeden test; brak kolejnego testu, przed którym implementacja mogłaby zniknąć |
| 4 | `tests/integration/routes/v8Interview.contextDocuments.test.ts` | 47 | 54 | 3 | nie dla `PermissionService.hasPermission` | (a) | lokalny `beforeEach` reinstalował inne mocki, nie setter z `beforeAll` |
| 5 | `tests/unit/backend/ragService.test.js` | 24 | 47–51 | 5 | nie; tylko `clearAllMocks()` | (a) | fałszywy komentarz zakładał przeżycie implementacji |

Korekta wobec instrukcji: T4 przewidywała 4 pliki / 2 zagrożone. Sonda znalazła 5 / 4. Dodatkowy plik timeout nie był ujęty w pomiarze autora, a plik V8 nie reinstalował odpowiadającego mocka uprawnień, mimo że reinstalował trzy inne mocki.

Dowody „przed” dla drugich testów: `ragService` i `interviewDeliveryMountedAuth` przechodziły osobno i w pakiecie; nie ujawniły zmiany statusu, mimo błędnego lifecycle. `interviewAiReviewTimeoutFallback` przechodził w pakiecie, ale osobno padał na `expected null to match object`, ponieważ drugi test zależy od rekordu audytu utworzonego przez pierwszy. To zastane sprzężenie kolejności jest osobnym długiem i nie zostało naprawione ani wyciszone w tym dyżurze. V8 przechodził osobno i w pakiecie.

## R2 — naprawa

W czterech plikach grupy (a) przeniesiono wyłącznie tanią instalację implementacji do lokalnego `beforeEach`. Drogie insercje, importy i montaż routera pozostały w `beforeAll`. `tests/setup.ts`, konfiguracje Vitest, helpery i plik FIX-209 pozostały nietknięte.

Alternatywa `restoreMocks: true`/`mockReset: true` per plik została odrzucona pomiarem: lokalny typ Vitest 4.1.8 `SuiteOptions` nie zawiera żadnej z tych opcji (0 opcji per-suite); są to ustawienia globalnej konfiguracji, której Z18 zakazuje zmieniać. Wzorzec `beforeEach` zmienił 4 pliki i ma lokalny promień rażenia.

Po naprawie wszystkie cztery pełne pliki: PASS. Drugie testy uruchomione osobno: 3 PASS, 1 zastany FAIL sprzężenia audytu opisany wyżej.

## R3 — bezpiecznik

Dodano `scripts/check-mock-lifecycle.sh`: raport domyślny zawsze przechodzi, `--ci` porównuje per-file z baseline, `--update-baseline` aktualizuje baseline. Baseline wynosi 1 i obejmuje wyłącznie niegroźny plik Day205 z jednym testem. Dodano bramkę 10 do istniejącego `.husky/pre-commit` oraz prawdziwy test procesu w izolowanym worktree; 2/2 PASS.

Dowód złap → usuń → przepuść:

```text
day211-temporary-violation.test.ts:5: chained mock implementation in beforeAll without beforeEach reinstall
exit 1

server/src/services/ai/__tests__/day205.decisionWisdom.pg.test.ts:34: ...
exit 0 (dług równy baseline, nie rośnie)
```

Pełny `npm run test:node-native`: 90 PASS / 4 FAIL. Oba nowe testy DAY211 są PASS. Czerwone są zastane lub przekrojowe poza licencją: 1 chwilowa kolizja inwentarza worktree z równolegle tworzonym fixture, 1 brakujące historyczne cytowania acceptance packages oraz 2 asercje `checkActionsStagedScope` oczekujące długu, którego baza markera już nie zawiera. Nie zmieniono ani nie wyciszono tych testów.

## R4 i §0.4a — skutek po pełnych nazwach

Porównano 4 pary JSON po `fullName`, łącznie 16 przypadków. **Zmiany statusu: 0. Fałszywa zieleń mierzona jako PASS→FAIL lub FAIL→PASS: 0.** Naprawa usuwa niemiarodajny lifecycle, ale zastane asercje w tych plikach nie zmieniły statusu; wcześniejsza zieleń była więc podatna na prawdziwą ścieżkę, lecz nie zmieniła wyniku liczbowego.

`przed-nazwy.txt` i `po-nazwy.txt` mają po 16 pełnych nazw i identyczny SHA-256 `79149be0f5a1827debe1e993a2ce81a0252e7d5b7612a5417705bec67ceb512b`; diff jest pusty. Nowy test strażnika ma osobny wynik 2/2 PASS.

Artefakty leżą wyłącznie w `/private/tmp/cx-day211-atrapy-artefakty`. Najważniejsze sumy:

- `r0-probes.json`: `6053cbcff31f2ea2648fa20c15a4011a0d72d7c3457b2324931580b6b9cf1d67`
- `r1-inventory.json`: `ec3d9b9f61a4839741a382b161a5e6e8b04da824193a4250610e6faf4d1ac187`
- `przed-nazwy.txt` / `po-nazwy.txt`: `79149be0f5a1827debe1e993a2ce81a0252e7d5b7612a5417705bec67ceb512b`

## Pułapki dowodowe

Pakiety PG biegły z pełnym env w jednej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6151/cx211 JWT_SECRET=... --retry=0`. To wyłącza pułapki fałszywego SQLite/mock DB, testowego bypassu auth i retry. Pakiety jednostkowe biegły z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`; nie stanowią dowodu DB ani HTTP.

## Korekty wobec instrukcji

- W4: 136 luźnych trafień, nie 130.
- R1: 5 plików / 4 grupa (a), nie 4 / 2 ani 87.
- `interviewAiReviewTimeoutFallback` ma niezależne sprzężenie kolejności drugiego testu z pierwszym; pozostawiono jawnie czerwony przebieg izolowany.
- Pierwsza próba R0 dała 0 testów z powodu plików poza root i nie została zaliczona; poprawiony config sondy zaimportował prawdziwy `vitest.config.ts` i załadował prawdziwy `tests/setup.ts`.

## FIX-211 — cztery poprawki po odbiorze adwersaryjnym (`ODBIOR_211.md`)

Werdykt odbioru: `B` — scalić po FIX. Cztery punkty, zamknięte tym samym
commitem co ten dopisek:

**1) Dziura w bezpieczniku (blokująca).** `scripts/check-mock-lifecycle.sh`
uznawał plik za czysty, gdy **jakikolwiek** setter był w **jakimkolwiek**
`beforeEach` — nie sprawdzał, czy chodzi o TEN SAM cel. Audytor to potwierdził
własnym przykładem i na prawdziwym, historycznym pliku tego dyżuru
(`v8Interview.contextDocuments.test.ts` sprzed naprawy → 0 naruszeń, mimo że
`PermissionService.hasPermission` nigdy nie był reinstalowany). Naprawione:
dopasowanie per-cel (`vi.spyOn(obj,'method')` → klucz `obj.method`, z
rozwiązywaniem zmiennej spy przypisanej przez `spy = vi.spyOn(...)`, żeby
reinstalacja przez identyfikator w `beforeEach` też się liczyła). Dowód —
bramka wymagana przez FIX-211, oba przebiegi:
  - `v8Interview.contextDocuments.test.ts` sprzed naprawy (`fe33ce8036`) →
    `mock-lifecycle: 0 blocking violation(s), 1 warning(s) in 1 file(s)` +
    `...:54: WARNING (non-blocking): ...` (patrz punkt 2 — to konkretne
    naruszenie jest gołym `vi.fn()`, więc trafia do warningu, nie do
    blokady; zgłoszone, jak wymaga bramka).
  - Ten sam plik po naprawie (HEAD) →
    `mock-lifecycle: 0 blocking violation(s), 0 warning(s) in 0 file(s)`.
  - Powtórka przykładu audytora (dwa `vi.spyOn` w `beforeAll`, `beforeEach`
    reinstaluje tylko jeden) →
    `mock-lifecycle: 1 blocking violation(s), 0 warning(s) in 1 file(s)` na
    linii DRUGIEGO (niereinstalowanego) spy'a; pierwszy (reinstalowany) nie
    jest zgłoszony. Ten sam przypadek zablokował prawdziwy `git commit` przez
    prawdziwy `.husky/pre-commit`, tak jak przykład z odbioru.
  - Bramka repo-wide (`bash scripts/check-mock-lifecycle.sh --ci`, bez
    argumentów) daje dokładnie to samo co przed FIX-211: `1 blocking
    violation(s)`, plik `day205.decisionWisdom.pg.test.ts:34` — baseline
    (`total: 1`) NIE wymagał zmiany.

**2) Rozróżnienie `vi.spyOn` od gołego `vi.fn()`.** Pułapka
`clearAllMocks()` dotyczy wyłącznie `vi.spyOn(...)` (potwierdzone empirycznie
przez audytora, 6/6 reprodukcji przeciw prawdziwemu `tests/setup.ts`). Bramka
teraz liczy **dwa poziomy**: `vi.spyOn(...)` bez reinstalacji tego samego celu
w `beforeEach` = **blokujące** (jak dotąd, liczy się do baseline/`--ci`); goły
`vi.fn()` (zmienna albo przypisanie wprost do właściwości obiektu) bez
reinstalacji = **WARNING, nieblokujące** — zostawione tylko jako informacja,
bo z dowodu wynika, że goły `vi.fn()` PRZEŻYWA `clearAllMocks()` niezależnie
od tego, czy `beforeEach` go reinstaluje. Nie usunąłem go całkowicie z
raportowania (mogłem, zero wartości ochronnej), żeby ktoś czytający `report`
dalej widział kształt ryzyka bez ryzyka wyłączenia bramki przez szum przy
`--ci`. Treść `scripts/check-mock-lifecycle.baseline.json` NIE zmieniła się —
liczy tylko poziom blokujący, a ten repo-wide wynosi nadal dokładnie 1.
Zaktualizowano `tests/unit/scripts/checkMockLifecycle.test.mjs` (5/5 PASS) o
scenariusze: `vi.fn()` niereinstalowany nie blokuje, `vi.spyOn` niereinstalowany
blokuje, per-cel (dwa spy, jeden reinstalowany) blokuje tylko dla
niereinstalowanego, zmienna spy reinstalowana przez identyfikator nie blokuje.

**3) `interviewAiReviewTimeoutFallback.pg.test.ts` — sprzężenie kolejności
POTWIERDZONE, nie wycofane.** Audytor nie odtworzył defektu, uruchamiając
CAŁY plik osobno 3× (oba testy razem, po kolei) — to i tak przechodzi, bo
drugi test ZAWSZE dostaje efekty uboczne pierwszego w tym trybie. Prawdziwa
reprodukcja wymaga odizolowania DRUGIEGO testu bez uruchamiania pierwszego
(`vitest run <plik> -t "does not crash the process"`) — wtedy `beforeAll`
zakłada fixture, ale żaden HTTP request nigdy nie leci, więc
`interview_assignments.ai_review_snapshot_json` zostaje `NULL` i asercja
`expect(snapshot).toMatchObject(...)` dostaje `null`. Odtworzone
**deterministycznie 6/6** (własna baza Postgres, port 6305, migracja od
pustej bazy), identyczny komunikat co w raporcie
(`AssertionError: expected null to match object { overallVerdict: 'timeout', … }`),
zarówno na wersji sprzed naprawy (`fe33ce8036`) jak i na HEAD (naprawa
FIX-211 nie dotykała tego pliku, więc sprzężenie jest nadal żywe i
nienaprawione — zgodnie z tym, co raport już mówił: "pozostawiono jawnie
czerwony przebieg izolowany"). Twierdzenie z raportu zostaje w mocy;
dopisuję tylko dokładną komendę repro, żeby następny czytelnik nie trafił na
ten sam fałszywy negatyw audytora.

**4) Sprostowanie liczb 87 / 130 / 136.** Jedyna liczba z realnym pomiarem
niezależnie potwierdzonym DWOMA różnymi sondami (wykonawcy i audytora) to
**1 potwierdzone blokujące naruszenie w całym repo**:
`server/src/services/ai/__tests__/day205.decisionWisdom.pg.test.ts:34`
(sonda FIX-211, po obu poprawkach powyżej, daje dokładnie to samo, patrz
punkt 1). Osobna, węższa liczba **"5 plików / 4 w grupie (a) + 1 w grupie
(b)"** to zasięg WZORCA (setter w lokalnym `beforeAll`, dowolnego rodzaju,
sprzed rozróżnienia spyOn/vi.fn() z punktu 2) — z tych 4 z grupy (a) tylko
`day205` miał żywy defekt; pozostałe 3 (w tym `v8Interview.contextDocuments`)
nie miały potwierdzonej różnicy przed/po. Liczba **87** (tytuł i treść pozycji
211 w `docs/program/funkcje/LISTA_DYZUROW_211_222.md:16,20`) **pochodziła od
nadzorcy przy planowaniu dyżuru, nie z pomiaru** — żadna sonda (wykonawcy,
moja z FIX-211, ani audytora) nigdy nie zwróciła tej wartości dla żadnego
zdefiniowanego kryterium (ani "setter w beforeAll", ani "potwierdzone
naruszenie"). Liczby **130/136** to luźne współwystępowanie tekstowe
(regex bez dopasowania hooków) z fazy W4 — słabszy, niedowodowy sygnał,
zarejestrowany tylko jako "co warto było przejrzeć", nie jako miara zasięgu;
136 (ponowny pomiar wykonawcy) różni się od 130 (liczba z instrukcji) bo to
osobne przebiegi tego samego nieprecyzyjnego zapytania, nie dwie miary tego
samego zbioru. **Do dalszych decyzji planistycznych liczyć wyłącznie: 1**
(potwierdzone, blokujące, repo-wide).
