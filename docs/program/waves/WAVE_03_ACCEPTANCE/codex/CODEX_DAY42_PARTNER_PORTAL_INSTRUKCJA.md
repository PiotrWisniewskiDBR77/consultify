# INSTRUKCJA DYŻURU nr 42 — Codex — „PARTNER: odblokowanie portalu — rozstrzygnięcie przyczyny 404, inwentarz tras, uczciwość atrap i izolacja tenantowa danych finansowych"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–41. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★ DLACZEGO TEN DYŻUR ISTNIEJE — trzy zdania, potem dowody

**Landing partnerski działa, formularz zgłoszeniowy działa, pobranie materiału
działa — a CAŁY portal zalogowanego partnera zwraca `404`.** Trzydzieści pięć
tras `/api/v8/partner/*` (zlecenie pomiarowe mówiło „36" — ta liczba też jest
błędna i rozliczasz ją w `§1.2` pkt 4) stoi za bramką `v8FeatureGate`, która przy braku
`ENABLE_V8_GLOBAL=true` odpowiada `404 V8_DISABLED` **przed uwierzytelnieniem**
— czyli przed jakimkolwiek kodem partnerskim.

Nad tymi trasami stoi komentarz, który twierdzi coś **nieprawdziwego**: że
most partnerski jest utrzymany „nawet gdy flaga V8 jest wyłączona, żeby odczyty
partnera nie degradowały się do `404`". W realnym runtime degradują się do
`404` **wszystkie co do jednej**, bo bramka globalna stoi piętro wyżej, w
`Gateway.ts`, i komentarz o niej nie wie.

To trzeci raz w tym programie, gdy **komentarz w kodzie opisuje stan, którego
nie ma**. Poprzedni taki przypadek — `financeValueDemoAllowlist.ts` — twierdził,
że nie jest importowany do `Gateway.ts`, podczas gdy **był**, i omijał globalny
strażnik zapisu demo dla czterech tras (`DEC-2026-08-28-154(e)`,
`server/src/Gateway.ts:552`). Tam komentarz zaniżał ryzyko. Tu **zawyża
dostępność**. Oba kosztują to samo: audytor czyta komentarz, wpisuje „działa",
i nikt nie mierzy runtime.

**Ten dyżur nie jest dyżurem frontowym. Nie budujesz ani jednego ekranu, nie
włączasz ani jednej flagi wizualnej i nie robisz zrzutów do akceptu.**
Ustalasz **czy 404 to konfiguracja czy kod**, doprowadzasz portal do stanu
**osiągalnego** w sposób udowodniony na realnym Postgresie, robisz **uczciwy
inwentarz** tego, co za tymi trasami naprawdę stoi, i **domykasz izolację
tenantową powierzchni, która operuje na pieniądzach**.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Cztery rzeczy, których nie wolno Ci zrobić, choćby wyglądały na oczywiste
domknięcie zadania.**

1. **★★ NIE OTWIERASZ EKONOMII PARTNERSKIEJ. NIGDY. W ŻADNEJ FORMIE.**
   Prowizje, rabaty, naliczenia, wypłaty i ustawienia wypłat są wyłączone
   **decyzją właściciela `AMD-PRT-ECONOMICS-002`**, egzekwowaną przez
   `server/src/services/partnerEconomicsPolicy.ts`. Ten moduł ma **stałą
   kompilacyjną**, nie flagę:
   `PARTNER_ECONOMICS_OPERATIONS_ENABLED = false as const`
   (`partnerEconomicsPolicy.ts:66`), i robi to **świadomie** — plik sam
   tłumaczy dlaczego (`:21-29`): „a runtime flag can be flipped by an env var,
   a query string, a copy-pasted support link or a stale deploy config".
   **Zmiana tej stałej, obejście strażnika, dopisanie wyjątku, „tymczasowe
   włączenie na czas testu" albo usunięcie którejkolwiek reguły z
   `V8_PARTNER_ECONOMIC_WRITERS` (`:164-172`) = ODRZUCENIE CAŁEGO DYŻURU**,
   nie STOP. To nie jest dług techniczny — to jest decyzja właściciela.
   **„Odblokowanie portalu" w tytule tego dyżuru oznacza odblokowanie
   OSIĄGALNOŚCI, nie odblokowanie pieniędzy.**
2. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest **wymagane** — BLOK 0 pkt 9 i `§D.8`), ale
   **nie zmieniasz w nim ani jednego znaku** — także „tylko po to, żeby zdjąć
   `disabled` ze schowanego przycisku, skoro backend już odpowiada", także po
   to, żeby „domknąć ostatnie ogniwo dowodu osiągalności". Odkrycie ekranu
   partnerskiego bez polish-passu i bez zrzutów = pokazanie właścicielowi
   zepsutego ekranu jako pierwszemu testerowi, czyli złamanie **reguły 7
   `CLAUDE.md`**, która w tym projekcie jest **nienaruszalna**. Ukrywanie
   kontrolek bez realnych danych (`§D.5`) jest **produktem tego dyżuru w
   postaci KONTRAKTU dla dyżuru frontowego**, nie edycją `src/`.
3. **★ NIE ZMIENIASZ WARTOŚCI DOMYŚLNEJ ŻADNEJ FLAGI ŚRODOWISKOWEJ W REPO.**
   `ENABLE_V8_GLOBAL` w `.env.example:202` ma już wartość `true` i **zostaje
   tak, jak jest**. Jeżeli Twoja diagnoza wskaże, że kanoniczny env stagingu
   jest niepełny — to jest **znalezisko do raportu i pozycja dla dyżuru 38**
   (bezpieczniki środowisk), nie Twój commit. W Twoich testach
   `ENABLE_V8_GLOBAL=true` żyje **wyłącznie w linii komendy** (`Z26`).
4. **★ NIE ZGADUJESZ, CO PORTAL MA POKAZYWAĆ.** Trasa, która dziś zwraca
   pustkę, ma zostać **uczciwie oznaczona jako pusta**, a nie wypełniona
   „rozsądnymi" danymi. Zasada `DEC-2026-08-25-21/22` („zero placebo",
   przełącznik-atrapa idzie do ukrycia albo do etykiety „planowane") obowiązuje
   tu literalnie. **`UNKNOWN` ≠ `0`. Brak danych ≠ zero.**

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 23652ec80a**

   > **★ RAMKA WARTOWNIKA — uwaga dla nadzorcy wiążącego ten dokument
   > (usuń tę ramkę przy wiązaniu).**
   >
   > W miejsce **każdego** literalnego napisu `«MARKER_SHA»` wpisujesz
   > **rzeczywisty SHA tipa `codex/m03-admin-20260824` z chwili wystawienia**,
   > we **wszystkich** wystąpieniach w tym pliku. Sprawdzasz komendą
   > `grep -c '«MARKER_SHA»' <ten-plik>` — wynik po podmianie musi być `0`.
   >
   > W dokumencie **nie ma i nie może być przykładowego SHA**: dzień 29 dostał
   > instrukcję z konkretnym SHA wpisanym „na przykład", wykonawca zawiązał się
   > do niego dosłownie i przepracował dyżur na martwej bazie. Z tego powodu
   > jedynym wartownikiem w tym dokumencie jest **literalny napis
   > `«MARKER_SHA»`** — nie „SHA do uzupełnienia", nie `<TU_WPISZ>`, nie
   > `xxxxxxxxxx`, nie skrót przykładowy.
   >
   > **Dopóki ta ramka nie jest usunięta, a `«MARKER_SHA»` nadal jest literalnym
   > napisem, dokument NIE JEST ZWIĄZANY** i wykonawca ma obowiązek odrzucić go
   > na pierwszej komendzie dyżuru, założyć raport i zakończyć pracę.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo
   `«MARKER_SHA»` jest nadal literalnym napisem `«MARKER_SHA»` — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/prt-*`, `codex/day12-instrukcja-20260825`,
   `codex/day3*-instrukcja-*`, `codex/day4*-instrukcja-*` ani z żadnej gałęzi
   dni 17–41. Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ
   dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline «MARKER_SHA»..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **Twoja gałąź i worktree.**

   ```bash
   git worktree add -b codex/partner-day42-<data> /private/tmp/consultify-partner-day42 «MARKER_SHA»
   ```

   Pracujesz **wyłącznie** w `/private/tmp/consultify-partner-day42`.
   Katalog na odkładane kopie robocze (`Z27`):
   `/private/tmp/consultify-partner-day42-scratch/`.

5. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. Każda komenda ma
   podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec instrukcji",
   **nie do improwizacji**:

   ```bash
   # (a) bramka globalna istnieje i ma dokładnie tę treść
   sed -n '14,21p' server/src/middleware/v8FeatureGate.middleware.ts
   #   oczekiwane: v8FeatureGate czyta process.env.ENABLE_V8_GLOBAL === 'true'
   #   i przy braku odpowiada res.status(404) { code: 'V8_DISABLED' }

   # (b) ★ MIEJSCE MONTAŻU — to jest sedno diagnozy
   grep -n "app.use('/api/v8'" server/src/Gateway.ts
   #   oczekiwane: DWIE linie — :1483 (mountedFinanceStatementRouter, BEZ bramki)
   #   i :1484 (v8FeatureGate, v8Router) — czyli bramka globalna stoi NAD całym
   #   routerem v8, w tym nad /partner

   # (c) ★ FAŁSZYWY KOMENTARZ — dosłownie
   sed -n '80,83p' server/src/routes/v8/index.ts
   #   oczekiwane: komentarz o "Partner Portal has its own partner-org
   #   authorization boundary … so partner reads do not degrade to 404"
   #   + mount v8Router.use('/partner', …) PRZED v8Router.use(v8OrgGate) na :86

   # (d) liczba tras portalu partnera
   grep -cE "router\.(get|post|put|patch|delete)\(" server/src/routes/v8/partner.routes.ts
   #   oczekiwane: 36 — UWAGA, to jest liczba MYLĄCA: jedno trafienie leży
   #   w bloku JSDoc (:270). Grep z kotwicą daje 35. Patrz §1.2 pkt 4

   # (e) ★ EKONOMIA PARTNERSKA JEST WYŁĄCZONA STAŁĄ, NIE FLAGĄ
   grep -n "PARTNER_ECONOMICS_OPERATIONS_ENABLED" server/src/services/partnerEconomicsPolicy.ts
   #   oczekiwane: :66 — `= false as const`
   grep -n "PARTNER_ECONOMICS_POLICY_STATUS" server/src/services/partnerEconomicsPolicy.ts
   #   oczekiwane: :59 — 410, NIE 403 (powód jest w komentarzu :49-58 i jest load-bearing)

   # (f) legacy /api/partners jest zamontowane BEZ bramki V8
   grep -n "app.use('/api/partners'" server/src/Gateway.ts
   #   oczekiwane: :1310 — deprecationHeader('/api/v8/partner'), partnerRoutes

   # (g) klient frontowy i jego wyłączony domyślnie fallback
   grep -n "isPartnerLegacyRollbackEnabled\|shouldFallbackToLegacyPartner" src/services/api/v8/partner.ts
   #   oczekiwane: :363-381 — fallback na 404 działa TYLKO gdy
   #   VITE_PARTNER_LEGACY_ROLLBACK_ENABLED === 'true' (domyślnie: NIE)

   # (h) precedens poprawnego obejścia bramki dla powierzchni produkcyjnej
   sed -n '1444,1453p' server/src/Gateway.ts
   #   oczekiwane: komentarz M14 D-03 + mount /api/v8/execution-control/manager
   #   PRZED bramką, z zachowanym verifyToken + requireV8OrgContext + attachV8Context

   # (i) czy istnieje JAKIKOLWIEK test przechodzący przez bramkę globalną na partnerze
   grep -rln "v8FeatureGate\|ENABLE_V8_GLOBAL" tests/integration/partners/
   #   oczekiwane: PUSTO — żaden z 23 plików testowych partnera nie dotyka bramki

   # (j) przedział migracji jest wolny
   ls server/migrations/ | grep -E "^20261(29|3[0-2])"
   #   oczekiwane: PUSTO (najwyższa zastana migracja to 20261240_*)
   ```

6. **Komenda bazowa dotkniętych plików** (używasz jej w `§0.4a` i w raporcie):

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #         | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Dlaczego                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `Z1`      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/partner-day42-<data>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                |
| `Z2`      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/day*-instrukcja-*`, `codex/prt-*`, `codex/finance-*`, `codex/execution-*`, `codex/assessment-*`, `codex/meetings-*`, `fix/*`, `chore/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku                                       |
| `Z3`      | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Krach 3/4 powstał tak; `DEC-2026-08-26-95`                                                                       |
| `Z4`      | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Wymagania są w rejestrze uwag i decyzjach                                                                        |
| `Z5`      | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-2026-08-26-86`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Chroniony, brudny worktree właściciela                                                                           |
| `Z6`      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich ponad 100, w tym `consultify-day37-instrukcja`, `consultify-day38-instrukcja`, `consultify-day39-instrukcja`, `consultify-day40-instrukcja`, `consultify-day41-instrukcja`                                                                                                                                                                                                                                                                                                                                                                                                                             | Cudze worktree, część w aktywnym użyciu przez równoległe dyżury                                                  |
| `Z7`      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia **NASŁUCHUJĄ**: `5432`, `5474`, `5511`, `5597`, `5673`, `5674`, `5681`. Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: `5474`, `5498`, `5499`, `5511`, `5512`, `5521`, `5533`, `5544`, `5556`, `5563`, `5566`, `5567`, `5571`, `5573`, `5575`, `5577`, `5581`, `5588`, `5589`, `5591`, `5597`, `5602`, `5605`, `5613`, `5617`, `5629`, `5641`, `5648`, `5657`, `5661`, `5673`, `5681`, `55291`, `55677`, `55941`, `59321`. **★ Twój kontener PG = `5697`.** Port zajęty → bierzesz pierwszy wolny **powyżej `5697`** (i spoza listy zakazanych) i wpisujesz go do raportu                                                        | Cudze dyżury pracują równolegle                                                                                  |
| `Z8`      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-2026-08-25-65`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Produkcja/demo poza zakresem                                                                                     |
| `Z9`      | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB, nigdy żadna baza `consultify_w3_partner_owner_*` (są **zachowane do odbioru właściciela**, `modules/16_PARTNER/MODULE_ACCEPTANCE.md`). **`Z9` przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** (`DEC-2026-08-26-98`)                                                                                                                                                                                                                                                                                                                                                                | „dane demo = twarz produktu"; tamte bazy są dowodem, nie piaskownicą                                             |
| `Z10`     | **★★ Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`, gdziekolwiek. W szczególności `ENABLE_V8_GLOBAL`, `PARTNER_SELF_CONNECT_ENABLED` (`.env.example:211`) i `VITE_PARTNER_LEGACY_ROLLBACK_ENABLED` **ZOSTAJĄ takie, jakie są**; `ENABLE_V8_GLOBAL=true` żyje **wyłącznie w linii komendy Twojego testu**                                                                                                                                                                                                                                                                                                    | `CLAUDE.md` reguła 9; flip flagi wymaga akceptu Piotra                                                           |
| `Z11`     | **★★ NIE OTWIERASZ EKONOMII PARTNERSKIEJ** — patrz ramka nad `§0`. Zero zmian w `server/src/services/partnerEconomicsPolicy.ts`, `partnerAccrualPolicy.ts`, `partnerCommissionService.ts`, `partnerProgramLedgerService.ts`, `partnerPayoutSettingsService.ts`, `partnerConfigService.ts` w części dotyczącej **zezwalania** na operację. Naruszenie = **odrzucenie dyżuru**, nie STOP                                                                                                                                                                                                                                                                                                                 | `AMD-PRT-ECONOMICS-002` — decyzja właściciela, nie dług                                                          |
| `Z12`     | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts`, `server/src/middleware/v8Auth.middleware.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/services/legacyCutover/**`, `server/src/services/effectiveAccessService.ts`, `PermissionsService`, `server/src/middleware/rbac.middleware.ts`, `server/src/middleware/effectiveCapability.middleware.ts`. Wolno **czytać** i **wołać**                                                                                                                                                                              | `auth.middleware.ts` jest przedmiotem **dyżuru 37** (§1.9); zmiana bramki = zmiana produktu                      |
| `Z13`     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/PARTNER_PORTAL_DAY42_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `§R.1`. **Raportu dnia 12 ani instrukcji dnia 12 NIE edytujesz**                                                                                                                                                                                                                                                                                                                    | Repo tonie w dokumentach-duchach                                                                                 |
| `Z14`     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                       |
| `Z15`     | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`, zero `/api/ai/**`, zero kolejki                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Silnik AI = osobny moduł, ostatni w programie; `DEC-2026-08-25-51`, `DEC-2026-08-28-152`                         |
| `Z16`     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `UNKNOWN` / `FEATURE_NOT_AVAILABLE` / `PARTNER_ECONOMICS_POLICY_DISABLED` / `Degraded`.** Cztery trasy-kikuty `503` (`partner.routes.ts:149,156,163,170`) **zostają kikutami**. Pusty partner **zostaje pusty**                                                                                                                                                                                                                                                                                                                                                                                                                   | Uczciwy pusty stan > udawany wynik; `UNKNOWN ≠ 0`                                                                |
| `Z17`     | **★ Zakaz wszystkiego poza modułem Partner** — z imiennymi licencjami z ramki w `§1.7`. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy: **NIE**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | „jeden moduł na raz"; podział FRONT/TYŁ (`§1.6`)                                                                 |
| `Z18`     | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright*.config.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                                                                                                                                                                                                                                                            | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                         |
| `Z19`     | **★ Nie kasujesz i nie „porządkujesz" legacy `/api/partners`.** Router `server/src/routes/partners.routes.ts` (3201 linii) i jego trzy rodzeństwa (`publicPartnerRouter`, `superAdminPartnerRouter`, `partnerConfigRouter`) **zostają zamontowane tak, jak są**. Wycofanie legacy to osobna decyzja (`DEC-2026-08-25-64`: „Legacy route zostaje do czasu pełnego cut-over")                                                                                                                                                                                                                                                                                                                            | Zdjęcie legacy przy zepsutym kanonie = wyłączenie partnera całkowicie                                            |
| `Z20`     | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-2026-08-26-96/98`)                         |
| `Z21`     | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). W tym dyżurze `Z21` jest **całym produktem pozycji `§D.1`–`§D.2`**: łańcuch **montaż → bramka → trasa → handler → zapytanie → wiersz w bazie → konsument w `src/` albo jawne „brak konsumenta"**                                                                                                                                                                                                                                                                                                                                                                                                                     | `DEC-104` powstał po tym, jak DoD przepuścił martwy kod jako gotowy                                              |
| `Z22`     | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). W tym module pułapka jest **materialna i już zastana**: `tests/integration/partners/partner-bvp-cold-http-reader.ts:1-10` montuje **legacy** `partners.routes.ts` w gołym `express()` z pominięciem `Gateway.ts` i **całej bramki V8**. **Nie kopiujesz tego wzorca jako dowodu.** Dowodem jest realny `ApiGateway` z realną bramką                                                                                                                                                                                                                             | Dzień 18: 8/8 testów zielonych, warstwa martwa                                                                   |
| `Z23`     | **★★ ZERO ATRAP, a w szczególności zero atrap z zewnętrznym skutkiem.** Zwrócenie `200` z pustą tablicą tam, gdzie zapytanie się wywaliło, jest atrapą. Zwrócenie zera tam, gdzie wartość jest nieznana, jest atrapą. Kontrolka UI wołająca trasę, która zawsze odmawia, jest atrapą. **Cichy `catch {}` wokół zapytania jest atrapą najgorszej klasy** — dokładnie tak zginął błąd SQL z `DEC-2026-08-26-112`                                                                                                                                                                                                                                                                                         | To jest cała różnica między „przeszło" a „działa"                                                                |
| `Z24`     | **★ Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Podanie zawężonego wyboru albo przepisanie cudzej liczby zamiast własnego przebiegu = zawyżenie i podstawa odrzucenia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Baseline jest Twoim obowiązkiem, nie cytatem                                                                     |
| **`Z25`** | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts:386-387` ma fallback: przy braku `DATABASE_URL` ustawia `postgresql://iris:iris_test@localhost:5432/iris_test`. **Port `5432` NASŁUCHUJE na tej maszynie i nie jest Twój.** Uruchomienie testu DB bez `DATABASE_URL` w tej samej linii komendy = połączenie do **cudzej bazy**. Twój jedyny dozwolony `DATABASE_URL` to `postgresql://postgres:cx@127.0.0.1:5697/cx_day42`                                                                                                                                                                                                                | Bez tego mierzysz — albo brudzisz — nie swoją bazę                                                               |
| **`Z26`** | **★★ `RUN_DB_TESTS=1`, `MOCK_DB=false` ORAZ `ENABLE_V8_GLOBAL=true` są OBOWIĄZKOWE w tej samej linii.** Wzorzec zastany (`tests/integration/partners/partner-accrual-payout-atomic.realdb.test.ts:4`) liczy `REAL_PG` jako `RUN_DB_TESTS==='1' && MOCK_DB==='false'`; bez `DATABASE_URL` wskazującego postgres cały `describe` jest **`SKIPPED`**, a `SKIPPED` **nie jest `PASS`**. **Bez `ENABLE_V8_GLOBAL=true` każdy test przechodzący przez realny `ApiGateway` dostanie `404 V8_DISABLED` i udowodni tylko to, co i tak wiesz.** Jedyny wyjątek: **kontrola negatywna `§D.1`**, gdzie brak tej zmiennej jest treścią testu i musi być **jawnie usunięty ze środowiska**, nie ustawiony na `false` | Tak powstaje „137/137 PASS" na warstwie, która nigdy się nie uruchomiła                                          |
| **`Z27`** | **★★ ZAKAZ `git stash` w tym dyżurze — w każdej postaci (`stash`, `stash -u`, `stash pop`, `stash apply`).** Musisz odłożyć stan roboczy → robisz **kopię plików przez `cp`** do `/private/tmp/consultify-partner-day42-scratch/` i wracasz do niej `cp`-em. Uzasadnienie: `stash` w worktree z symlinkiem `node_modules` i z nowymi, jeszcze nie dodanymi plikami w `tests/` **cicho gubi pliki nieśledzone**, a `stash pop` po zmianie indeksu potrafi wywrócić drzewo w środku pozycji. Znaleziony `git stash list` niepusty na koniec dyżuru = pozycja bez `ZROBIONE_WG_DoD`                                                                                                                       | Utrata nieskomitowanego dowodu jest nieodwracalna                                                                |
| **`Z28`** | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje: `railway` CLI, `psql` do hosta innego niż `127.0.0.1`, `curl`/`fetch`/`wget` do `*.railway.app`, `demo.consultify.ai`, `*.consultify.ai` i dowolnego hosta zdalnego, `DATABASE_URL` z hostem innym niż `127.0.0.1`, oraz jakikolwiek plik `.env` zawierający poświadczenia zdalne. **Przed KAŻDYM uruchomieniem testu DB drukujesz cel połączenia** (`§0.4` pkt 10) i wklejasz go do raportu. Trafienie na zdalny host = **przerwanie czynności** (`Z9`) i wpis do „Korekt", a jeżeli połączenie faktycznie nastąpiło — **STOP całego dyżuru** i natychmiastowy wpis do raportu      | Portal partnera operuje na danych finansowych; jedno przypadkowe zapytanie do demo to skażenie „twarzy produktu" |

> **Ramka do `Z9`/`Z28`.** `Z9` przerywa **daną czynność**, nie cały dyżur:
> jeżeli zorientujesz się, że komenda **celowała** w cudzą albo zdalną bazę i
> **nie zdążyła się połączyć** — przerywasz tę komendę, wpisujesz do „Korekt
> wobec instrukcji", stawiasz własny kontener i wracasz. Jeżeli połączenie
> **nastąpiło** — to jest `Z28` i **STOP całego dyżuru**, bez wyjątków i bez
> „przecież to był tylko `SELECT`".

> **Ramka do `Z21`.** „Dowód osiągalności" to **pełna ścieżka**: realne wejście
> HTTP → **realny `ApiGateway` z realną bramką `v8FeatureGate`** → realne
> `verifyToken` → realny `requireV8OrgContext` → trasa → handler → zapytanie →
> **wiersz w Twojej bazie** → konsument w `src/` **albo jawne zdanie „brak
> konsumenta"**. Istnienie pliku, zielony test jednostkowy i „skompilowało się"
> **nie są** dowodem osiągalności. **W tym dyżurze pierwsze ogniwo — bramka —
> jest sednem pozycji `§D.1` i `§D.2`.**

> **Ramka do `Z23` — czym w tym module jest atrapa, konkretnie.** Portal
> partnera ma **cztery** różne rodzaje „nie działa", które trzeba trzymać
> rozłącznie i **nigdy nie mieszać**:
>
> | Rodzaj                 | Kod / status                               | Znaczenie                                                  | Co z tym robisz                                              |
> | ---------------------- | ------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------ |
> | bramka funkcji         | `404 V8_DISABLED`                          | cała rodzina V8 jest wyłączona środowiskowo                | **naprawiasz osiągalność** (`§D.1`/`§D.2`)                   |
> | brak wiązania partnera | `403 PARTNER_ORG_REQUIRED`                 | użytkownik nie jest partnerem tego tenanta                 | **zostaje** — to poprawne zachowanie                         |
> | funkcja niezbudowana   | `503 FEATURE_NOT_AVAILABLE` + `capability` | trasa istnieje, komenda biznesowa nie została zatwierdzona | **zostaje** (`Z16`), ale **jawnie inwentaryzujesz** (`§D.4`) |
> | decyzja właściciela    | `410 PARTNER_ECONOMICS_POLICY_DISABLED`    | ekonomia wyłączona `AMD-PRT-ECONOMICS-002`                 | **nietykalne** (`Z11`)                                       |
>
> **Zamiana któregokolwiek z tych czterech na `200` z pustą kopertą = atrapa
> i podstawa odrzucenia pozycji.** Odwrotnie też: zamiana `503` na `410` albo
> `410` na `403` jest zmianą kontraktu — `410` jest **load-bearing**, bo
> `shouldFallbackToLegacyPartner` (`src/services/api/v8/partner.ts:366-381`)
> przełącza klienta na legacy przy `[400, 404, 405, 501]` i przy
> `403 + PARTNER_ORG_REQUIRED`, a `410` celowo nie jest na żadnej z tych list.

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dziewięć pozycji roboczych = **minimum
  dziewięć commitów** (plus dwa dokumentacyjne). Wrzucenie kilku pozycji do
  jednego commita jest **samodzielnym powodem, dla którego pozycja nie dostanie
  `ZROBIONE_WG_DoD`** (tak zginął dzień 24). Conventional commits:

  ```
  test(partner): prove every partner portal route 404s behind the global V8 gate (D.1)
  fix(partner): make the partner portal reachable under the canonical environment (D.2)
  fix(partner): correct the comment that claimed partner reads never degrade to 404 (D.3)
  docs(partner): inventory every partner portal endpoint as real, stub or policy-refused (D.4)
  feat(partner): declare capability honesty in the partner read envelope (D.5)
  test(partner): prove cross-tenant isolation on every partner money surface (D.6)
  fix(partner): stop trusting the organization id in the partner user-tier path (D.7)
  docs(partner): record partner client methods with no caller and controls with no route (D.8)
  docs(partner): publish the partner read contract the front duty will consume (D.9)
  docs(partner): raise 16_PARTNER acceptance to the delivered scope (R.1)
  docs(partner): day 42 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
  **★ UWAGA — `partner.routes.ts` ma 1618 linii, a `partners.routes.ts` 3201.**
  Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
  **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz styl
  zastany i wpisujesz to do raportu. Reformat cudzego kodu nie jest produktem
  dyżuru.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
- **NOWE pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
  częściowo). Sprawdzasz `git status --short` po każdym commicie.
- **Zakaz `--no-verify`.** Hook pre-commit naprawiasz kodem, nie omijasz.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `UNKNOWN` **z powodem**,
   **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Client`/`Pool`), nie
   z koperty odpowiedzi.
3. **Zero atrap (`Z23`)**, w szczególności zero atrap z zewnętrznym skutkiem.
   Brak API → wpis `BRAK_API`. Brak danych → `BRAK_DANYCH`. Brak decyzji
   właściciela → `DECISION_REQUIRED` **z nazwą pytania**.
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje `§D.1`, `§D.2` i `§D.6` mają
   **wyższe minima** podane we własnych paragrafach.
5. **★ Test HTTP przez REALNY `ApiGateway`** (`server/src/Gateway.ts`), z realną
   bramką `v8FeatureGate`, na **realnym PG**, przez `supertest`. **Zamontowanie
   `partner.routes.ts` w gołym `express()` NIE spełnia tego punktu** — to jest
   dokładnie wzorzec `partner-bvp-cold-http-reader.ts:1-10`, którego `Z22`
   zakazuje jako dowodu.
6. **★ DOWÓD OSIĄGALNOŚCI (`Z21`)** — pełna ścieżka od realnego wejścia, przez
   bramkę i zapis, do **odczytu, który ten wiersz podnosi**, i do konsumenta
   w `src/` albo jawnego „brak konsumenta".
7. **★ Realne mapowanie błędów** — mockowanie ograniczone do `Logger.js` i
   ewentualnie podpisu JWT. **Każdy inny mock wymaga wpisu w raporcie
   z uzasadnieniem.** Zamockowanie `partnerOrgResolution` albo
   `partnerEconomicsPolicy` **unieważnia pozycję**.
8. **★★ Kontrole negatywne tenanta — najpoważniejsza klasa w tym dyżurze.**
   Obcy `organizationId` nigdy nie dostaje `200`. `organizationId` **wyłącznie
   z tokenu/kontekstu**, nigdy z body/query. Test wysyła obcą organizację
   **w body ORAZ w nagłówku `x-org-context`** i dostaje odmowę **bez danych
   obiektu**, a niezależny `SELECT` po teście dowodzi **zera zmian** w tabeli
   docelowej (readback bez zmian). **Portal partnera czyta i pisze pieniądze —
   ta klasa waży w tym dyżurze więcej niż cała reszta DoD.**
9. **★ Kontrola negatywna roli/zdolności** — żądanie bez wymaganej zdolności
   jest ODRZUCONE **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy
   przed i po). **Role ustawiasz realnym wierszem `organization_members`**, nie
   wstrzyknięciem do `req.user`.
10. **Realny PG w jednorazowym Dockerze** (port **`5697`**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`), z **pełnym łańcuchem migracji przez
    `server/scripts/migrate.postgres.ts`** (a nie tylko autorun — patrz
    `§1.2` pkt 8), z dowodem celu połączenia (`Z20`/`Z25`/`Z26`/`Z28`), ze
    sprzątnięciem kontenera **i wolumenów**:

    ```bash
    docker rm -fv cx-day42-pg
    ```

    **`docker rm -f` bez `-v` nie kasuje wolumenu** i zostawia po Tobie
    kilkaset MB oraz — co gorsza — bazę, do której ktoś może się przypadkiem
    podłączyć. `-v` jest **obowiązkowe**.

11. **Plik przez `prettier`** przed commitem (z zastrzeżeniem o dużych plikach
    z `§0.3`).
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
dowód testowy`.

> Punkty „zrzut light+dark" i „akcept właściciela na zrzutach" **nie obowiązują**
> w tym dyżurze — front jest poza zakresem w całości (`§1.6`). Klucze i18n
> tworzysz **wyłącznie** dla napisów, które faktycznie wychodzą z Twojego API,
> i wtedy **parytet PL+EN obowiązuje w tym samym commicie**.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (`Z24`)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie `Z24`.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (`§0.1` pkt 6).
2. Zakres pomiaru to **minimum** te ścieżki, niezależnie od tego, czy je
   dotknąłeś:

   ```
   tests/integration/partners/**            # 23 pliki zastane
   tests/integration/partner-portal.test.ts
   tests/unit/backend/partnerService.test.js
   tests/unit/backend/partnerAccrualPolicy.test.ts
   tests/unit/backend/middleware/v8FeatureGate.middleware.test.ts
   tests/components/partner/**
   tests/components/BecomePartnerView.marketing-shell.test.tsx
   server/src/services/legacyCutover/__tests__/**
   ```

3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. **Komplet env w tej samej linii, zawsze** (`Z20`/`Z25`/`Z26`/`Z28`):

   ```bash
   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true \
   DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5697/cx_day42 \
   npx vitest run <ścieżki> --retry=0
   ```

5. **`SKIPPED` nie jest `PASS`.** Podajesz **ile** przypadków zostało pominiętych
   i **z jakiego powodu** (brak `REAL_PG`, brak prefiksu bazy, brak Dockera).
   Zgłoszenie pakietu w całości `SKIPPED` jako zielonego = zawyżenie i podstawa
   odrzucenia.
6. **Testy osłabione albo usunięte bloki `describe`** — jeżeli zmieniłeś
   asercję istniejącego testu, cytujesz **starą i nową** w raporcie. Usunięcie
   przypadku bez cytatu = naruszenie.
7. **Deklaracja końcowa**: `ZASIĘG PEŁNY` albo `ZASIĘG CZĘŚCIOWY` + wyliczenie
   pominięć. Plus jawne zdanie: **„NIE przepisałem liczb dnia 12 ani z
   `MODULE_ACCEPTANCE.md` — zmierzyłem sam."**

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- **włączyć jakąkolwiek operację ekonomiczną partnera** (`Z11`) — to
  **odrzucenie dyżuru**, nie STOP;
- **zmienić wartość domyślną flagi środowiskowej w repo** (`Z10`) — STOP
  z rekomendacją dla dyżuru 38;
- wejść we `src/**` z zapisem (`Z17`) — **także po to, żeby „tylko zdjąć
  `disabled` z przycisku, skoro trasa już odpowiada"**;
- dotknąć `auth.middleware.ts`, `v8Auth.middleware.ts`,
  `v8FeatureGate.middleware.ts`, `featureFlagService.ts`,
  `services/legacyCutover/**`, `rbac.middleware.ts` (`Z12`) — STOP **zawsze**,
  także „addytywnie". `auth.middleware.ts` jest przedmiotem **dyżuru 37**;
- **usunąć albo odmontować legacy `/api/partners`** (`Z19`) — STOP
  z rekomendacją;
- **zmienić kształt istniejącej koperty odczytu w sposób, który złamie
  dzisiejszego konsumenta w `src/`** — pola **dokładasz**, nigdy nie zmieniasz
  ani nie usuwasz. Gdy inaczej się nie da → STOP z rekomendacją;
- **zmienić status odmowy** (`503` ↔ `410` ↔ `403` ↔ `404`) — każdy z nich jest
  kontraktem, a `410` jest **load-bearing** (ramka do `Z23`);
- **usunąć albo „naprawić" którąkolwiek z czterech tras-kikutów `503`**
  (`partner.routes.ts:149,156,163,170`) — STOP; ich uczciwość jest produktem,
  nie długiem;
- **dodać migrację** z numerem **spoza przedziału `20261310`–`20261319`**,
  migrację nieaddytywną, albo migrację z kluczem obcym poza modułem Partner;
- **naprawiać schemat przez runtime DDL** (wzorem
  `ensureUserOnboardingStatusTable`) — STOP; nowy schemat idzie migracją;
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (`Z18`) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (`§0.4a`) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to zakaz, nie STOP:**
naprawiasz kod, nie omijasz strażnika.
**Zakaz `git stash` (`Z27`) — to zakaz, nie STOP:** odkładasz stan przez `cp`.
**Połączenie do zdalnej bazy (`Z28`) — to STOP CAŁEGO DYŻURU**, jeżeli
faktycznie nastąpiło.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

**★ Zastrzeżenie do STOP-u.** STOP jest narzędziem wobec **braku informacji albo
braku licencji**, nie wobec trudności. Postawienie STOP-u na `§D.1` („nie umiem
zmierzyć, bo bramka zwraca 404") jest **odrzuceniem pozycji**: `404` **jest**
wynikiem pomiaru i masz go udowodnić testem, nie ominąć.

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

Pomiar stanu modułu Partner wykazał trzy rzeczy naraz:

1. **Powierzchnia publiczna żyje.** `/become-partner`, `/become-partner/apply`
   i pobranie materiału działają — to trasy publiczne, poza `/api/v8`
   (`src/routes/AppRoutes.tsx:1119-1137`).
2. **Portal zalogowanego partnera nie odpowiada.** Wszystkie trasy
   `/api/v8/partner/*` zwracają `404`.
3. **Komentarz w kodzie twierdzi, że tak nie jest.**

Moduł 16 stoi w `MODULE_ACCEPTANCE.md` na bramce
`TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF`. Dzień 12
(`DEC-2026-08-25-64`, `DEC-2026-08-25-73`) zamknął **warstwę 1**: strict
exact-tenant `connection`, odmontowanie marketingu z `/partner`, cztery stany
pulpitu. Polerowanie wizualne Partnera **stoi w kolejce** i **nie jest tym
dyżurem**.

`DEC-2026-08-26-102` (bramka fazy stagingu, TRI-MUST-05) zawiera zdanie, które
jest bezpośrednim powodem tego dyżuru — cytat z rejestru:

> „pierwszy przebieg bez `ENABLE_V8_GLOBAL=true` dał masowe 404 na `/api/v8/*`
> — to poprawne działanie bramki funkcji, nie awaria; po korekcie env wszystko
> 200 (znaczenie dla deployu: konfiguracja env stagingu MUSI zawierać
> `ENABLE_V8_GLOBAL=true`, inaczej połowa produktu jest niewidoczna)."

**Twoje zadanie zaczyna się dokładnie tam, gdzie ten cytat się kończy:
udowodnić — behawioralnie, na realnym PG, przez realny Gateway — czy przy
kanonicznym env portal partnera faktycznie ożywa, czy `404` zamienia się
w `403` z zupełnie innego powodu.**

### 1.2. ★★ ERRATA — DZIEWIĘĆ USTALEŃ ZWERYFIKOWANYCH W KODZIE NA MARKERZE

Każde z nich sprawdzasz sam w BLOKU 0 i wpisujesz `ZGADZA SIĘ` /
`NIE ZGADZA SIĘ` do raportu. **To są ustalenia nadzorcy, nie prawdy objawione.**

1. **Bramka globalna jest PRZED-uwierzytelnieniowa i stoi w `Gateway.ts`, nie
   w routerze V8.**
   `server/src/Gateway.ts:1484` → `app.use('/api/v8', v8FeatureGate, v8Router)`.
   `server/src/middleware/v8FeatureGate.middleware.ts:14-21` →
   `process.env.ENABLE_V8_GLOBAL === 'true'`, inaczej
   `res.status(404).json({ error: 'V8 features not available', code: 'V8_DISABLED' })`.
   **Wniosek: kolejność mountów WEWNĄTRZ `routes/v8/index.ts` nie ma tu żadnego
   znaczenia — router nigdy nie zostaje osiągnięty.**

2. **★ KOMENTARZ, KTÓRY KŁAMIE — pełne brzmienie.**
   `server/src/routes/v8/index.ts:80-83`:

   > `// Partner Portal has its own partner-org authorization boundary. Keep the V8`
   > `// partner bridge available even when the tenant-wide V8 flag is disabled, so`
   > `// partner reads do not degrade to 404 before partner scope can be resolved.`
   > `v8Router.use('/partner', attachV8Context, v8MetricsMiddleware, mutationAbortCanary, partnerRoutes);`

   **Co jest prawdą:** mount stoi na `:83`, a `v8Router.use(v8OrgGate)` dopiero
   na `:86` — więc most partnerski **rzeczywiście** omija bramkę **organizacyjną**.
   **Co jest nieprawdą:** obietnica wyniku — „partner reads do not degrade
   to 404". Degradują się, i to **wszystkie**, gdy `ENABLE_V8_GLOBAL !== 'true'`,
   bo bramka **globalna** stoi piętro wyżej (pkt 1). Komentarz opisuje jedną
   z dwóch bramek i wyciąga z tego wniosek o całości.
   **To jest dokładnie ta klasa błędu, która w tym programie kosztowała już dwa
   tygodnie:** `financeValueDemoAllowlist.ts` twierdził, że nie jest importowany
   do `Gateway.ts`, podczas gdy był (`Gateway.ts:552`,
   `DEC-2026-08-28-154(e)`, test-strażnik
   `server/src/__tests__/gatewayFinanceValueAllowlist.test.ts:37`).

3. **★ DRUGI KŁAMLIWY KOMENTARZ — o „demo seederze poniżej".**
   `server/src/routes/v8/partner.routes.ts` w sześciu miejscach (`:118-119`,
   `:124-125`, `:133`, `:137`, `:147`, `:211`) uzasadnia kolejność middleware
   zdaniami typu „registered before the demo seeder below so even an authorized
   request cannot mutate Partner demo data on its way to a refusal".
   **W tym pliku nie ma żadnego seedera.** `grep -n "seed" partner.routes.ts`
   zwraca wyłącznie te komentarze. Seeder istnieje, ale na **legacy**:
   `server/src/services/partnerDemoSeedService.ts:56`
   (`ensurePartnerDemoDataset`), wołany z
   `server/src/routes/partners.routes.ts:241,379,477`.
   Jedyne uczciwe zdanie w tej rodzinie to `:211-212`: „Demo fixtures are seeded
   by explicit, disposable-DB harnesses rather than from a production request."
   **Uzasadnienie kolejności middleware jest merytorycznie dobre — kłamie tylko
   powód. Kolejności NIE zmieniasz** (`§D.3` pkt 3).

4. **★ TRZECIE KŁAMSTWO — TYM RAZEM W POMIARZE, NIE W KODZIE. Tras jest 35,
   nie 36.**

   ```bash
   grep -cE  "router\.(get|post|put|patch|delete)\(" server/src/routes/v8/partner.routes.ts   # 36
   grep -cE "^router\.(get|post|put|patch|delete)\(" server/src/routes/v8/partner.routes.ts   # 35
   ```

   Różnica to **`partner.routes.ts:270`**, które leży **wewnątrz bloku JSDoc**
   (`:235-271`) i cytuje **inny plik** jako precedens konwencji:
   ``* (`router.put('/user-tiers/:orgId/:userId', requireRole(...), ...)`).``
   Realna trasa `PUT /user-tiers/:orgId/:userId` żyje w
   `server/src/routes/admin-data.routes.ts` (powierzchnia superadmina) i **nie
   jest zamontowana pod `/api/v8/partner`**.
   **Konsekwencja dla Ciebie:** obawa „endpoint bierze `orgId` z URL-a" jest
   w tym routerze **fałszywym alarmem** — **żadna z 35 tras nie przyjmuje
   identyfikatora organizacji ani partnera ze ścieżki lub z body**.
   **I konsekwencja metodyczna:** liczba `36` w zleceniu pomiarowym powstała
   z grepa, który policzył **komentarz**. Jeżeli Twój własny pomiar da inną
   liczbę niż 35 — **to Twoja liczba idzie do raportu**, nie moja.

5. **Podział 35 tras wg tego, co realnie robią** (do zweryfikowania w `§D.4`):
   **4 kikuty `503`** (`:149,156,163,170` — `unavailablePartnerWriter`, `:64`),
   **3 odmowy `410`** decyzją `AMD-PRT-ECONOMICS-002`
   (`POST /program/lifecycle/request-payout-phase`, `POST /payouts/request`,
   `PUT /payout-settings` — `partnerEconomicsPolicy.ts:164-172`),
   **28 tras czytających/piszących realną bazę.**
   Atrap-danych w tym routerze **praktycznie nie ma** — poza dwoma miejscami,
   które musisz zweryfikować i opisać: syntezą kodu referencyjnego z nazwy
   organizacji przy pustym wyniku (`partner.routes.ts:880-906`) i „degraded"
   migawką zerowego salda (`partnerProgramLedgerService.ts:640-657`).

6. **★ DWA ODCZYTY `GET` WYKONUJĄ ZAPIS.**
   `GET /referral-tools` woła `ensurePartnerReferralIdentity`, które robi
   `UPDATE partner_organizations SET referral_code…` (`partnerReferralService.ts:607-611`).
   `GET /program/status` woła `getOrCreateRuntime`, które robi
   `INSERT INTO partner_program_runtime` (`partnerProgramLedgerService.ts:716`).
   Oba są poprawnie ograniczone do partnera, ale **łamią idempotencję `GET`**.
   To jest **znalezisko do opisania** (`§D.4`), **nie do naprawy w tym dyżurze**
   — zmiana zachowania `GET` bez konsumenta po drugiej stronie to zmiana
   kontraktu.

7. **★★ NAJPOWAŻNIEJSZE ZNALEZISKO IZOLACYJNE — legacy czyta bez wiązania
   tenantowego.**
   Kanon V8 wymaga **dokładnego** wiązania `tenant → partner`:
   `getActivePartnerOrgIdForTenantUser` (`server/src/services/partnerOrgResolution.ts:107-119`)
   filtruje po `po.owner_organization_id = ? AND pu.user_id = ?` i ma
   `{fallback:false}`.
   Legacy `/api/partners/*` używa **innego** resolvera —
   `getActivePartnerOrgIdForUser` (`partnerOrgResolution.ts:11`) — który
   rozstrzyga partnera **z samego `userId`**, **bez** `owner_organization_id`,
   **bez** `requireActiveMembership` na poziomie routera, i **sam dopisuje
   wiersze `partner_users`** (`:66-77`, `:83-93`).
   **Zapisy legacy są odcięte** (16 writerów `state:'disabled'`,
   `services/legacyCutover/registry.ts:68-200`), ale **odczyty legacy nie są
   odcięte niczym** — a legacy wystawia te same rodziny danych, w tym pieniądze
   (`/earnings-summary`, `/commission-transactions`, `/payouts`,
   `/payout-settings`).
   **To jest realna dziura w izolacji i jest ona ZASTANA, nie wprowadzona przez
   Ciebie.** `§D.6` wymaga, żebyś ją **udowodnił testem**; `§D.9` wymaga, żebyś
   podał **rekomendację naprawy**. **Naprawa legacy jest POZA ZAKRESEM** (`Z19`)
   — jej wykonanie bez decyzji nadzorcy wyłączyłoby partnera całkowicie.

8. **★★ DRUGA, NIEZALEŻNA PRZYCZYNA MARTWEGO PORTALU — SCHEMAT, NIE FLAGA.**
   Autorun migracji filtruje po wzorcu
   `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/`
   (`server/src/services/tablePlatform/migrationIdentity.ts:56`, konsumowany
   przez `server/src/database/DatabaseInitializer.ts:3198`).
   Kolumna **`partner_organizations.owner_organization_id`** — czyli **jedyny
   predykat** kanonicznego resolvera z pkt 7 — powstaje **wyłącznie**
   w `server/migrations/955_partner_connection_receipts.sql:30`, a `955_`
   **nie pasuje** do tego wzorca. Tak samo `215_partner_portal.sql`
   (`partner_organizations`, `partner_users`, `partner_specializations`,
   `partner_regions`, `partner_client_organizations`) i
   `216_partner_referral_system.sql` (`partner_attributions`,
   `partner_commission_transactions`, `partner_payouts`,
   `partner_campaign_links`).
   **Konsekwencja: na bazie zbudowanej WYŁĄCZNIE autorunem portal partnera
   nie zwróci `200` nawet przy `ENABLE_V8_GLOBAL=true` — zwróci
   `403 PARTNER_ORG_REQUIRED`, bo `requireBoundPartnerTenant` nie ma na czym
   pracować.** Ręczny runner `server/scripts/migrate.postgres.ts` **nie ma**
   ograniczenia wzorcem i stosuje wszystko.
   **To jest dokładnie ta klasa defektu, którą `DEC-2026-08-26-112` opisała jako
   „dziura w mechanizmie migracji" i dla której zlecono audyt integralności
   schematu.** W `§D.1` masz obowiązek **rozdzielić te dwie przyczyny
   eksperymentem**, a nie zgadywać, która działa.

9. **Fallback klienta na legacy jest domyślnie WYŁĄCZONY.**
   `src/services/api/v8/partner.ts:363-364` — `isPartnerLegacyRollbackEnabled()`
   czyta `VITE_PARTNER_LEGACY_ROLLBACK_ENABLED`, którego **nie ma w żadnym
   `.env*.example`**. `shouldFallbackToLegacyPartner` (`:366-382`) zwraca
   `false`, dopóki flaga nie jest `'true'`.
   **Wniosek: przy wyłączonej bramce front nie ma dokąd się cofnąć — dostaje
   `404` i pokazuje błąd.** Portal nie „degraduje się do legacy"; on umiera.

### 1.3. ZAKRES — dokładnie dziewięć pozycji roboczych + dwie dokumentacyjne

| Poz.   | Nazwa                                                                                                        | Typ                     |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `§D.1` | **Rozstrzygnięcie przyczyny `404`** — eksperyment czteroramienny, realny Gateway, realny PG                  | diagnoza + testy        |
| `§D.2` | **Odblokowanie osiągalności** — doprowadzenie do udowodnionego `200` na kanonicznym env, pełny łańcuch `Z21` | kod/testy               |
| `§D.3` | **Naprawa fałszywych komentarzy** + test-strażnik regresji                                                   | kod/test                |
| `§D.4` | **Inwentarz 35 tras** — realne / kikut / odmowa polityki, konsument frontu                                   | dokumentacja w raporcie |
| `§D.5` | **Uczciwość koperty** — jawne `capability` dla tego, co nie ma realnych danych                               | kod/testy               |
| `§D.6` | **Izolacja tenantowa** — negatywy cross-tenant na całej powierzchni pieniędzy, z readbackiem bez zmian       | testy                   |
| `§D.7` | **Weryfikacja tezy „endpoint bierze `orgId` z URL-a"** — obalenie albo potwierdzenie, z dowodem              | diagnoza                |
| `§D.8` | **„Backend ma / front nie woła" i „zapis bez czytelnika"** — pełny, dwukierunkowy inwentarz                  | dokumentacja w raporcie |
| `§D.9` | **Kontrakt dla dyżuru frontowego** — co ma być ukryte, co opisane jako planowane, co włączone                | dokumentacja w raporcie |
| `§R.1` | `modules/16_PARTNER/MODULE_ACCEPTANCE.md` do stanu faktycznego                                               | dokumentacja            |
| `§R.2` | Raport dyżuru                                                                                                | dokumentacja            |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

Do „Znalezisk", **nigdy do kodu**:

- **Ekonomia partnerska w jakiejkolwiek postaci** (`Z11`) — to nie jest
  „poza zakresem", to jest **zakaz**.
- **Naprawa legacy `/api/partners`** (`Z19`) — także dziury izolacyjnej
  z `§1.2` pkt 7. Dowodzisz, opisujesz, rekomendujesz. Nie naprawiasz.
- **Naprawa wzorca autorun migracji** (`§1.2` pkt 8) — dotyka
  `migrationIdentity.ts` i **~524 plików `.sql`**; `DEC-2026-08-26-112` zleciła
  na to osobny audyt integralności schematu. **Nie przenosisz `955_` ani `215_`
  do przedziału `2026*`** — to zmieniłoby tożsamość migracji dla wszystkich
  istniejących baz.
- **Kasowanie martwego kodu frontu** — `CommissionView.tsx`, `ResourcesView.tsx`,
  `DirectoryView.tsx`, `AcademyProgress.tsx`, `CommissionIntelligence.tsx`,
  `PartnerLifecycleCanonPanel.tsx`, `TrustProgressionIndicator.tsx`,
  `partnerTrustRuntime.ts`, `usePartnerEcosystem.ts`. **Inwentaryzujesz je
  w `§D.8`, nie kasujesz** — `src/` jest poza zakresem do zapisu (`Z17`).
- **Budowa ekranu, przycisku, formularza albo polish-passu.** Polerowanie
  Partnera stoi w kolejce jako osobny dyżur frontowy; `§D.9` jest **wejściem**
  do niego, nie jego wykonaniem.
- **`GET` przestające pisać** (`§1.2` pkt 6) — znalezisko, nie naprawa.
- **`Metrics` liczone z mnożników** (`src/views/partner/PartnerPortalView.tsx`,
  `buildFallbackMetricsData`) — to `src/`, poza zakresem do zapisu; idzie do
  `§D.8` i `§D.9` jako **pozycja do ukrycia albo oznaczenia**.
- **Migracje.** Ten dyżur **prawdopodobnie nie potrzebuje migracji**. Gdyby
  okazała się konieczna, Twój przedział to **`20261310`–`20261319`** i żaden
  inny. Migracja poza tym przedziałem = STOP.

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| Decyzja                 | Treść wiążąca dla Ciebie                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AMD-PRT-ECONOMICS-002` | Prowizje, rabaty, naliczenia, wypłaty, ustawienia wypłat — **wyłączone**, `410`, stała kompilacyjna. Reaktywacja wymaga **nowej decyzji właściciela**, nie commitu                        |
| `DEC-2026-08-24-08`     | `/partner` = **wyłącznie pulpit operacyjny** podłączonego partnera. Treści programowe/marketingowe wyłącznie na `/become-partner*`. Stan nieznany/błąd **nigdy** nie pokazuje rejestracji |
| `DEC-2026-08-25-64`     | Semantyka `connection` = **STRICT EXACT-TENANT**, read-only. Legacy zostaje do pełnego cut-over                                                                                           |
| `DEC-2026-08-25-73`     | Odbiór warstwy 1 dnia 12 — warunkowy; parytet `readConnectionParity` i klucze `partner.day12.*` pozostają otwarte                                                                         |
| `DEC-2026-08-26-102`    | Kanoniczny env stagingu **MUSI** zawierać `ENABLE_V8_GLOBAL=true`                                                                                                                         |
| `DEC-2026-08-26-112`    | Wzorzec autorun migracji ma udowodnioną dziurę; audyt integralności schematu **zlecony osobno**                                                                                           |
| `DEC-2026-08-25-21/22`  | **Zero placebo**: przełącznik/kontrolka bez realnego efektu → **ukryta albo oznaczona „planowane"**                                                                                       |
| `DEC-2026-08-26-104`    | DoD wymaga **dowodu osiągalności**, nie istnienia pliku                                                                                                                                   |
| `DEC-2026-08-26-107`    | Test wstrzykujący zależności **nie dowodzi** ścieżki produkcyjnej                                                                                                                         |
| `DEC-2026-08-28-154(e)` | Precedens fałszywego komentarza o okablowaniu + wzorzec **testu-strażnika**                                                                                                               |

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Wszystko, co kończy się pikselem, jest FRONTEM i jest poza zakresem.
Wszystko, co kończy się kopertą HTTP, jest TYŁEM i jest Twoje.**

Z tego wynikają trzy rzeczy, które ludzie mylą:

1. **Ukrycie kontrolki UI, która woła martwą trasę, jest FRONTEM.** Twoim
   produktem jest **kontrakt** (`§D.9`) mówiący, którą kontrolkę ukryć i
   dlaczego — nie edycja `src/`.
2. **Oznaczenie trasy jako „bez realnych danych" jest TYŁEM.** Robisz to
   w **kopercie odpowiedzi** (`meta.capability`), addytywnie (`§D.5`).
3. **Ostatnim ogniwem Twojego dowodu osiągalności jest koperta HTTP**, nie
   ekran. Wpisujesz to wprost w raporcie i **nie udajesz**, że sprawdziłeś
   wygląd.

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

> **★ RAMKA LICENCJI — pliki, które WOLNO Ci edytować.** Dokładnie te i żadne
> inne:
>
> - `server/src/routes/v8/index.ts` — **wyłącznie komentarz `:80-82`** i,
>   jeżeli `§D.2` tego wymaga, **wyłącznie** przeniesienie/rozszerzenie mountu
>   partnerskiego. **Zmiana kolejności innych mountów = STOP.**
> - `server/src/routes/v8/partner.routes.ts` — komentarze z `§1.2` pkt 3
>   i addytywne pola `meta` z `§D.5`. **Zmiana kolejności `router.use` = STOP.**
> - `server/src/Gateway.ts` — **wyłącznie** w zakresie `§D.2`, jeżeli wybierzesz
>   wariant montażu przed bramką, i **wyłącznie** w bloku partnerskim.
>   **Każda inna linia `Gateway.ts` = STOP.**
> - `tests/integration/partners/**` — nowe pliki (`git add -f`).
> - `docs/…/modules/16_PARTNER/MODULE_ACCEPTANCE.md` — wyłącznie `§R.1`.
> - `docs/…/PARTNER_PORTAL_DAY42_REPORT_20260828.md` — raport.
>
> **Wszystko inne: tylko do odczytu.**

**Tył — czytasz obowiązkowo:**

| Plik                                                        | Co tam jest                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/middleware/v8FeatureGate.middleware.ts:14-21`   | bramka globalna, `404 V8_DISABLED`                                                                                                                 |
| `server/src/Gateway.ts:1444-1453`                           | **precedens M14 D-03** — powierzchnia produkcyjna zamontowana PRZED bramką, z zachowanym `verifyToken` + `requireV8OrgContext` + `attachV8Context` |
| `server/src/Gateway.ts:1476-1484`                           | montaż `/api/v8`; `:1483` bez bramki (Finance Statement), `:1484` z bramką                                                                         |
| `server/src/Gateway.ts:1310`                                | legacy `/api/partners`, bez bramki V8                                                                                                              |
| `server/src/routes/v8/index.ts:56-91`                       | łańcuch routera V8; `:83` mount partnera, `:86` `v8OrgGate`                                                                                        |
| `server/src/routes/v8/partner.routes.ts:57-213`             | cały łańcuch middleware partnera                                                                                                                   |
| `server/src/services/partnerEconomicsPolicy.ts`             | `AMD-PRT-ECONOMICS-002`, `410`, 3 reguły V8                                                                                                        |
| `server/src/services/partnerOrgResolution.ts:11,107`        | **dwa** resolvery — legacy (userId, self-heal) i kanoniczny (tenant+user, bez fallbacku)                                                           |
| `server/src/services/legacyCutover/registry.ts:62-200`      | 16 writerów legacy `state:'disabled'`                                                                                                              |
| `server/src/services/partnerDemoSeedService.ts:45-56`       | seeder legacy i jego warunek środowiskowy                                                                                                          |
| `server/src/services/tablePlatform/migrationIdentity.ts:56` | wzorzec autorun migracji                                                                                                                           |
| `server/src/routes/partners.routes.ts:225-278`              | łańcuch legacy + `requirePartnerOrgId`                                                                                                             |

**Front — czytasz, NIE piszesz:**

| Plik                                                  | Co tam jest                                                |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `src/services/api/v8/partner.ts:363-455`              | `V8PartnerApi` (28 metod), `shouldFallbackToLegacyPartner` |
| `src/views/partner/PartnerPortalView.tsx`             | portal, 25 sekcji, stan w `?tab=`                          |
| `src/views/partner/sections/EarningsSection.tsx`      | pieniądze — sekcja read-only                               |
| `src/views/partner/sections/ReferralToolsSection.tsx` | narzędzia referencyjne                                     |
| `src/views/partner/ClientAccessView.tsx`              | dostęp klientów                                            |
| `src/views/partner/PartnerStartRouter.tsx`            | stany pulpitu (D8)                                         |
| `src/routes/AppRoutes.tsx:3419-3444`                  | montaż `/partner/*`, bez flagi, `requireAuth`              |

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **„Testy przeszły" ≠ „działa".** 23 pliki testowe partnera w
   `tests/integration/partners/` i **żaden** nie dotyka bramki `v8FeatureGate`
   (`grep -rln "v8FeatureGate\|ENABLE_V8_GLOBAL" tests/integration/partners/`
   → pusto). Cała ta warstwa mogła być zielona przy całkowicie martwym portalu
   — i była.
2. **Goły `express()` nie jest Gatewayem.**
   `tests/integration/partners/partner-bvp-cold-http-reader.ts:1-10` montuje
   legacy router w gołej aplikacji. To `Z22`.
3. **Komentarz nie jest dowodem.** Trzy razy w tym module (`§1.2` pkt 2, 3, 4).
   Zawsze `grep` realnego callera.
4. **Grep liczy komentarze.** Liczba „36" powstała z grepa bez kotwicy `^`
   (`§1.2` pkt 4). Twoje liczby kotwiczysz.
5. **Cichy `catch {}` chowa błąd schematu.** `DEC-2026-08-26-112`: błąd kolumny
   ginął w `DbPromise.all` z `fallback:true`. Jeżeli Twój test dostaje `200`
   z pustą tablicą — **sprawdź logi serwera**, zanim uznasz to za pusty stan.
6. **Env w tej samej linii, zawsze** (`Z20`/`Z25`/`Z26`/`Z28`).
7. **`git stash` gubi pliki** — `cp` do scratcha (`Z27`).
8. **`docker rm -f` bez `-v` zostawia wolumen** (`§0.4` pkt 10).

### 1.9. ★ KOLIZJE Z DYŻURAMI W TOKU — sprawdzone, zakres rozłączny

| Dyżur                                     | Gałąź / worktree                                                                     | Co dotyka                                                                                                                                                                  | Relacja do Ciebie                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **37 — bramka kontekstu organizacji**     | `codex/day37-*`, port `5657`, migracje `20261260-69`                                 | **`server/src/middleware/auth.middleware.ts`** (wpięcie bramki `ORG_CONTEXT_REQUIRED` po gate'cie zawieszenia), `enterprise-platform.routes.ts`, inwentarz `'org-default'` | **★ NAJBLIŻSZA KOLIZJA.** Twój `requireExactPartnerTenantContext` (`partner.routes.ts:89-107`) porównuje `req.requestedOrganizationId` z `req.organizationId` — **oba są ustawiane w `auth.middleware.ts`** (`:880` i `:844-875`). **Ten plik należy do dnia 37. `Z12` zabrania Ci go dotknąć.** Jeżeli Twój `§D.6` wykaże, że gwarancja izolacji opiera się na zachowaniu `attachUser`, a nie na samym porównaniu — **to jest znalezisko dla dnia 37**, wpisane do raportu, **nie Twoja naprawa** |
| **38 — bezpieczniki środowisk i wdrożeń** | `codex/day38-*`, port `5617`, migracje `20261270-79`                                 | `scripts/validate-deploy-target.sh`, `DB_TARGET_LABEL`, `assertRealPostgres.ts`, `scripts/deploy-demo.sh`, dokumenty operacyjne                                            | **★ ROZDZIAŁ JAWNY.** On właścicielem **konfiguracji wdrożeniowej**; Ty właścicielem **zachowania runtime**. **Jeżeli Twoja diagnoza wskaże, że kanoniczny env wdrożeniowy nie niesie `ENABLE_V8_GLOBAL=true` — to jest pozycja dla dnia 38**, a Twoim produktem jest **zdanie do jego raportu**, nie commit w `scripts/` ani w `.env*` (`Z10`)                                                                                                                                                    |
| **39 — poświadczenia**                    | `codex/day39-*`                                                                      | front + testy                                                                                                                                                              | **★ Kolizja możliwa na `tests/`.** Ty tworzysz **wyłącznie nowe pliki** w `tests/integration/partners/`. Cudzego testu **nie edytujesz**; jedyne dopuszczalne dotknięcie cudzego pliku to `§0.4a` pkt 6 (cytat starej i nowej asercji) i **tylko** w pliku partnerskim. `Z18` obowiązuje bez wyjątku                                                                                                                                                                                               |
| **40 — Tools**                            | `codex/day40-*`                                                                      | `services/tools*`, moduł Narzędzia                                                                                                                                         | rozłączny                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **41 — Audyty**                           | `codex/day41-*`                                                                      | moduł Audyty                                                                                                                                                               | rozłączny                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **33 — Realizacja (nośniki `E-O3/4/5`)**  | `codex/day33-*`, port `5597`, migracje `20261220-29`                                 | `goals`, `controlKpiReadModel.ts`, execution policy                                                                                                                        | rozłączny                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **30 — Finance C–H**                      | `codex/finance-day30-20260827`, port `5511` (**nasłuchuje**), migracje `20261190-99` | `server/src/routes/v8/finance-v2/**`, `services/finance/canonical/**`                                                                                                      | **★ ROZDZIAŁ WYMAGA JAWNEGO ZDANIA — patrz ramka niżej**                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 31 / 32 / 34 / 35 / 36                    | scalone do markera albo rozłączne                                                    | execution, documentStudio, dane demo                                                                                                                                       | **BRAK**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

> **★★ RAMKA — ROZDZIAŁ Z DYŻUREM 30 (finance-v2). Przeczytaj i zastosuj
> dosłownie.**
>
> Portal partnera **operuje na pieniądzach**: prowizje, wypłaty, ustawienia
> wypłat, saldo programu. Dyżur 30 buduje **finanse organizacji**. Nazwy się
> ocierają, a kod **nie ma ani jednego wspólnego pliku**. Sprawdzone:
>
> | Wymiar   | Partner (Ty)                                                                                                                                           | Finance-v2 (dyżur 30)                             |
> | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
> | Trasa    | `/api/v8/partner/*` (`routes/v8/index.ts:83`)                                                                                                          | `/api/v8/finance-v2/*` (`routes/v8/index.ts:115`) |
> | Router   | `routes/v8/partner.routes.ts`                                                                                                                          | `routes/v8/finance-v2/index.ts`                   |
> | Serwisy  | `partnerCommissionService`, `partnerProgramLedgerService`, `partnerPayoutSettingsService`, `partnerParticipantLedgerService`, `partnerReferralService` | `services/finance/canonical/**`                   |
> | Tabele   | `partner_*` (prefiks bez wyjątku)                                                                                                                      | `finance_*` / kanoniczny magazyn                  |
> | Polityka | `AMD-PRT-ECONOMICS-002` → `410`, **wyłączone na stałe**                                                                                                | własne bramki dyżuru 30                           |
>
> **Reguła rozdziału, wiążąca w obie strony:**
> **NIE dotykasz niczego pod `server/src/routes/v8/finance-v2/**`,
> `server/src/routes/v8/finance*.ts`, `server/src/services/finance/**` ani
> żadnej tabeli o prefiksie `finance_`.** Odwrotnie: żadna z Twoich zmian nie
> ma prawa wejść w plik o nazwie zawierającej `finance`.
> **Jeżeli w trakcie pracy znajdziesz połączenie między prowizją partnera
> a fakturą/przychodem organizacji — to jest STOP z wpisem do raportu**, nie
> Twoja integracja. Otwarcie takiego mostu bez decyzji właściciela byłoby
> **de facto reaktywacją ekonomii partnerskiej okrężną drogą** (`Z11`).

- **Migracje:** `20261190-99` (30), `20261200-09` (31), `20261210-19` (32),
  `20261220-29` (33), `20261230-39` (34), `20261240-49` (35), `20261250-59` (36),
  `20261260-69` (37), `20261270-79` (38) są **zajęte**.
  **Twój przedział to `20261310`–`20261319` i tylko on.**
- **Porty:** pełna lista zakazanych w `Z7`. **Twój port to `5697`.**

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker** — `§0.1` pkt 2. Wynik dosłownie do raportu. `MARKER BRAK` → STOP.
2. **Worktree i gałąź** — `§0.1` pkt 4.
3. **Weryfikacja stanu wejściowego** — `§0.1` pkt 5, wszystkie podpunkty
   `(a)`–`(j)`. Rozbieżność → „Korekty wobec instrukcji".
4. **★ Kontener PG — NAJPIERW, przed jakimkolwiek pomiarem** (`Z20`):

   ```bash
   docker rm -fv cx-day42-pg 2>/dev/null || true
   docker run -d --name cx-day42-pg \
     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day42 \
     -p 5697:5432 pgvector/pgvector:pg16
   ```

   Czekasz na gotowość (`docker exec cx-day42-pg pg_isready -U postgres`),
   dopiero potem migrujesz.

5. **★★ MIGRACJE PEŁNYM RUNNEREM, NIE AUTORUNEM.** To jest warunek wstępny
   całego dyżuru i wynika wprost z `§1.2` pkt 8:

   ```bash
   DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5697/cx_day42 \
   npx tsx server/scripts/migrate.postgres.ts
   ```

   Wynik (liczba zastosowanych migracji, zero błędów) idzie do raportu.
   **Drugi przebieg tej samej komendy musi dać „0 applied"** (idempotencja) —
   też do raportu.

6. **★ Dowód celu połączenia (`Z28`)** — przed pierwszym testem drukujesz i
   wklejasz do raportu:

   ```bash
   psql "postgresql://postgres:cx@127.0.0.1:5697/cx_day42" \
     -c "SELECT current_database(), inet_server_addr(), inet_server_port();"
   ```

   Oczekiwane: `cx_day42`, adres pętli zwrotnej, port `5697`. **Cokolwiek
   innego = przerwanie czynności i wpis do „Korekt".**

7. **★★ BRAMKA WEJŚCIOWA — sześć podpunktów. Jeżeli którykolwiek nie da
   oczekiwanego wyniku, NIE ZACZYNASZ żadnej pozycji `D`: zakładasz raport,
   wpisujesz STOP z dosłownym wynikiem i kończysz dyżur.**

   ```
   (i)   Kolumna wiązania istnieje po pełnym runnerze:
         \d partner_organizations  →  kolumna owner_organization_id OBECNA
         (jeżeli BRAK — potwierdziłeś §1.2 pkt 8 w najostrzejszej postaci;
          to NIE jest STOP, to jest WYNIK: wpisujesz go i idziesz dalej,
          bo §D.1 ma to rozstrzygnąć)

   (ii)  Pięć tabel partnera istnieje:
         partner_organizations, partner_users, partner_attributions,
         partner_campaign_links, partner_program_ledger

   (iii) Realny Gateway startuje na Twojej bazie i odpowiada na /health

   (iv)  BEZ ENABLE_V8_GLOBAL (zmienna USUNIĘTA ze środowiska, nie ustawiona
         na 'false'):  GET /api/v8/partner/connection  →  404, code V8_DISABLED

   (v)   Z ENABLE_V8_GLOBAL=true, użytkownik BEZ wiązania partnerskiego:
         GET /api/v8/partner/connection  →  200 z connected:false
         (DEC-2026-08-25-64: connection jest read-only i NIE 403-uje)

   (vi)  Z ENABLE_V8_GLOBAL=true, użytkownik BEZ wiązania partnerskiego:
         GET /api/v8/partner/clients  →  403, code PARTNER_ORG_REQUIRED
         (czyli bramka partnerska działa, a bramka funkcji już nie blokuje)
   ```

   **Punkty (iv), (v) i (vi) razem SĄ rozstrzygnięciem przyczyny `404`
   i stanowią treść pozycji `§D.1`.** Wyniki wklejasz dosłownie.

8. **Pomiar zasięgu testów PRZED** — `§0.4a` pkt 3(a). Bez tej liczby nie
   odróżnisz czerwieni zastanej od wprowadzonej.
9. **★ INWENTARZ KONSUMENTÓW — obowiązkowy odczyt `src/`** (do `§D.8`; `src/`
   czytasz, nie piszesz):

   ```bash
   # która metoda klienta ma wołacza, a która nie
   for m in getConnection getReferralAnalytics getClients getProjects getEmployees \
            connect startCertificationExam submitCertificationExam getOnboardingStatus \
            getProgramStatus getParticipantLedger acceptOnboardingTerms selectOnboardingTier \
            completeOnboarding getReferralTools getEarningsSummary getAttributions \
            getCommissionTransactions getPayouts requestPayout createCampaignLink \
            deleteCampaignLink updateOrganization updateOrganizationSpecializations \
            updateOrganizationRegions updateOrganizationListing getPayoutSettings \
            updatePayoutSettings; do
     printf '%-36s %s\n' "$m" "$(grep -rn "V8PartnerApi\.$m" src/ | wc -l)"
   done
   ```

   Wynik w całości idzie do raportu jako tabela.

10. **`git stash list`** → **musi być puste** (`Z27`), i na koniec dyżuru też.

---

## §D.1 — ROZSTRZYGNIĘCIE PRZYCZYNY `404` (eksperyment, nie lektura)

**To jest pozycja, która odpowiada na pytanie zlecenia: konfiguracja czy kod.**

### Cztery hipotezy, które masz rozstrzygnąć eksperymentem

| #       | Hipoteza                         | Jak ją potwierdzasz / obalasz                                                                                                                                                                                                                                       |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a)** | **wyłączona flaga środowiskowa** | BLOK 0 pkt 7 (iv) vs (v)/(vi). Ta sama komenda, ta sama baza, jedyna różnica: `ENABLE_V8_GLOBAL`                                                                                                                                                                    |
| **(b)** | **niezamontowanie routera**      | `grep -n "v8Router.use('/partner'" server/src/routes/v8/index.ts` → `:83`. Mount **istnieje**. Dodatkowo: log startowy `[ApiGateway] Mounting /api/v8` (`Gateway.ts:1476`)                                                                                          |
| **(c)** | **`mountStub`**                  | `grep -n "mountStub" server/src/Gateway.ts` — partner **nie jest** na tej liście; `/api/partners` (`:1310`) i `/api/v8` (`:1484`) to zwykłe `app.use`. Hipoteza **obalona z góry — potwierdź to komendą, nie zaufaniem do tej tabeli**                              |
| **(d)** | **coś innego — schemat**         | `§1.2` pkt 8. Test: ta sama komenda co (vi), ale na bazie zbudowanej **wyłącznie autorunem** (bez `migrate.postgres.ts`). Jeżeli tam `403 PARTNER_ORG_REQUIRED` pada **także** dla użytkownika, który wiązanie MA — to druga, niezależna przyczyna martwego portalu |

### Co budujesz

Jeden plik testowy, realny Gateway, realny PG:
`tests/integration/partners/partner-portal-gate-diagnosis.day42.realpg.test.ts`

**Minimum sześć przypadków behawioralnych:**

1. **Bramka zamknięta** — `ENABLE_V8_GLOBAL` **usunięte ze środowiska**
   (`delete process.env.ENABLE_V8_GLOBAL`, nigdy `='false'` — bo `'false'`
   i brak dają ten sam wynik, ale tylko brak odtwarza realny deploy bez
   zmiennej): **każda** z pięciu reprezentatywnych tras
   (`GET /connection`, `GET /clients`, `GET /earnings-summary`,
   `POST /campaign-links`, `PUT /organization`) → `404` z `code: 'V8_DISABLED'`.
   **Asercja na `code`, nie tylko na statusie** — `404` bywa też „nie znaleziono
   zasobu", a tu chodzi o `404` bramki.
2. **Bramka otwarta, brak wiązania** — `GET /connection` → `200`,
   `connected:false`; `GET /clients` → `403 PARTNER_ORG_REQUIRED`.
3. **Bramka otwarta, wiązanie jest** — realny wiersz `partner_organizations`
   z `owner_organization_id` = organizacja aktora + realny wiersz
   `partner_users` → `GET /clients` → `200`.
4. **Kontrola negatywna tenanta** — ten sam użytkownik, **obca** organizacja
   w nagłówku `x-org-context` **oraz** w body → odmowa **bez danych**,
   a niezależny `SELECT` dowodzi zera zmian.
5. **Hipoteza (d)** — baza zbudowana wyłącznie autorunem: udokumentowany wynik
   `GET /clients` dla aktora **z** wiązaniem. Jeżeli technicznie nie da się
   zbudować takiej bazy w rozsądnym czasie, **wolno Ci zastąpić ten przypadek
   dowodem statycznym**: `grep -n "owner_organization_id" server/migrations/*.sql`
   - treść `migrationIdentity.ts:56` + jawne zdanie w raporcie, że przypadek
     został udowodniony statycznie, nie behawioralnie. **To jest jedyne
     dopuszczalne osłabienie w tej pozycji i musi być nazwane.**
6. **Kontrola pozytywna bramki `v8OrgGate`** — dowód, że mount partnerski
   na `:83` faktycznie omija bramkę **organizacyjną**: organizacja **bez**
   wierszy flag V8, `ENABLE_V8_GLOBAL=true`, `GET /connection` → `200`
   (a nie `404 V8_ORG_DISABLED`). **To jest jedyna część komentarza `:80-82`,
   która jest prawdziwa, i masz ją udowodnić, zanim go poprawisz** (`§D.3`).

### Definicja ukończenia

- Sześć przypadków, wszystkie na realnym Gateway i realnym PG (`§0.4` pkt 5).
- **Werdykt w raporcie w jednym zdaniu**, w formacie:
  `PRZYCZYNA 404 = (a) KONFIGURACJA` **albo** `= (a) + (d)` **albo** `= (d)`,
  z listą obalonych hipotez i dowodem obalenia każdej.
- Jawne zdanie: **czy przy kanonicznym env portal ożywa** — `TAK` / `NIE` /
  `TAK, ale dopiero po pełnym runnerze migracji`.
- Sprzątnięcie kontenera po pozycji nie następuje — używasz go dalej.

---

## §D.2 — ODBLOKOWANIE OSIĄGALNOŚCI (pełny łańcuch `Z21`)

**Ta pozycja ma DWA warianty i wybór między nimi jest decyzją, nie wykonaniem.
Instrukcja wskazuje wariant domyślny i warunki, w których wolno wybrać drugi.**

### Wariant 1 (DOMYŚLNY) — portal zostaje za bramką, kanon to env

Jeżeli `§D.1` wykaże, że przy `ENABLE_V8_GLOBAL=true` portal działa,
**nie zmieniasz montażu**. Twoim produktem jest:

1. **Dowód osiągalności** pełnego łańcucha, dla **co najmniej pięciu** rodzin
   danych, każdy jako osobny przypadek:
   `montaż (Gateway.ts:1484) → v8FeatureGate → verifyToken →
requireV8OrgContext → v8Router:83 → attachV8Context →
requireExactPartnerTenantContext → requireBoundPartnerTenant →
handler → SQL → WIERSZ W BAZIE → konsument w src/`.
   Rodziny: `connection`, `clients`, `referral-tools`, `program/status`,
   `campaign-links` (zapis + odczyt tego samego wiersza).
2. **Test regresyjny bramki** — przypadek 1 z `§D.1` staje się strażnikiem:
   jeżeli ktoś kiedyś przeniesie mount partnera przed bramkę **bez decyzji**,
   ten test zapali się na czerwono.
3. **Zdanie do raportu dyżuru 38** (`§1.9`): dosłowny tekst wymagania
   środowiskowego, gotowy do przeniesienia, w formie:
   `ENABLE_V8_GLOBAL=true jest WYMAGANE w każdym środowisku, w którym ma
działać moduł Partner, Interview, Execution, Results i Finance;
jego brak daje 404 na ~połowie produktu i NIE jest odróżnialny od awarii
po stronie klienta.`

### Wariant 2 (WYMAGA UZASADNIENIA) — mount przed bramką, wzorem M14 D-03

Wolno Ci go wybrać **wyłącznie**, jeżeli `§D.1` wykaże, że portal partnera
**musi** działać także przy wyłączonej fladze — a taką potrzebę może stwierdzić
**tylko** istniejąca decyzja, nie Twoja ocena. Precedens i jedyny dopuszczalny
kształt: `server/src/Gateway.ts:1444-1453` (M14 D-03, Manager lanes):

- mount **przed** `app.use('/api/v8', v8FeatureGate, v8Router)`,
- **na dokładnie jednej, wąskiej ścieżce** (`/api/v8/partner`), nie na prefiksie
  łapiącym rodzeństwo,
- z **zachowanym** `verifyToken` + `requireV8OrgContext` + `attachV8Context`,
- **bez** poluzowania czegokolwiek w `partner.routes.ts`,
- z komentarzem, który mówi **prawdę** i cytuje decyzję, na podstawie której to
  robisz.

**Jeżeli takiej decyzji nie ma — wariant 2 jest STOP-em z rekomendacją, nie
Twoim commitem.** Powód jest twardy: przeniesienie mountu przed bramkę
**zmienia powierzchnię ataku produktu** i musi być decyzją właściciela, tak jak
było nią M14 D-03.

### Definicja ukończenia (oba warianty)

- Pięć pełnych łańcuchów `Z21`, każdy z **wierszem w bazie** i z **nazwanym
  konsumentem w `src/`** (albo jawnym „brak konsumenta").
- Minimum 6 testów zachowania, wszystkie przez realny Gateway.
- **Wybrany wariant nazwany w raporcie razem z powodem wyboru i decyzją,
  na którą się powołujesz.**
- Zero zmian w `.env*` (`Z10`).

---

## §D.3 — NAPRAWA FAŁSZYWYCH KOMENTARZY + STRAŻNIK REGRESJI

### Co naprawiasz

1. **`server/src/routes/v8/index.ts:80-82`.** Nowy komentarz musi powiedzieć
   **obie** rzeczy naraz: (i) że mount stoi przed `v8OrgGate` i **dlatego** omija
   bramkę **organizacyjną**; (ii) że **nie omija** bramki **globalnej**
   `v8FeatureGate` z `Gateway.ts:1484`, więc przy `ENABLE_V8_GLOBAL !== 'true'`
   **wszystkie** trasy partnera zwracają `404 V8_DISABLED`. Komentarz **cytuje
   plik:linia** obu bramek. **Nie piszesz „TODO", nie piszesz „historycznie".**
2. **Sześć komentarzy o „demo seederze poniżej"** w
   `server/src/routes/v8/partner.routes.ts` (`:118-119`, `:124-125`, `:133`,
   `:137`, `:147`, `:211`). Poprawiasz **wyłącznie uzasadnienie**: seeder w tym
   routerze **nie istnieje**; żyje na legacy
   (`server/src/services/partnerDemoSeedService.ts:56`, wołany z
   `server/src/routes/partners.routes.ts:241`). **Merytoryczne uzasadnienie
   kolejności middleware (polityka ekonomiczna jako pierwsza, strażnik
   członkostwa przed jakimkolwiek zapisem) jest DOBRE i zostaje** — zmieniasz
   powód, nie regułę.
3. **★ NIE ZMIENIASZ ANI JEDNEJ LINII WYKONYWALNEJ W TYCH DWÓCH PLIKACH
   W RAMACH TEJ POZYCJI.** Dowodzisz tego w raporcie:

   ```bash
   git diff «MARKER_SHA»...HEAD -- server/src/routes/v8/index.ts \
     server/src/routes/v8/partner.routes.ts | grep -E '^[+-]' | grep -vE '^[+-]{3}' | grep -vE '^[+-]\s*(\*|//|$)'
   ```

   Wynik w tej pozycji musi być **pusty**. (Zmiany wykonywalne z `§D.2`
   i `§D.5` idą **osobnymi commitami** i są w tym grepie policzone osobno —
   dlatego commit-per-pozycja jest w tym dyżurze twardy.)

### Strażnik regresji — wzorem `DEC-2026-08-28-154(e)`

Nowy plik
`tests/integration/partners/partner-gate-comment-truth.day42.test.ts`,
zbudowany **behawioralnie**, nie przez `toContain` na źródle (`Z22`):

- przypadek A: bez `ENABLE_V8_GLOBAL` → `404 V8_DISABLED` na `/api/v8/partner/connection`
  (dowodzi, że **stara** treść komentarza była nieprawdziwa);
- przypadek B: z `ENABLE_V8_GLOBAL=true`, organizacja bez wierszy flag V8 →
  `200` (dowodzi, że **nowa** treść komentarza jest prawdziwa w części o `v8OrgGate`).

**Dopuszczalny dodatek** (i tylko jako dodatek, nie zamiast): jeden statyczny
strażnik na wzór `server/src/__tests__/gatewayFinanceValueAllowlist.test.ts:37`,
sprawdzający, że mount partnerski nadal stoi przed `v8Router.use(v8OrgGate)`.
**W raporcie nazywasz go „strażnik regresji, nie dowód"** — dokładnie tak, jak
robi to precedens.

### Definicja ukończenia

- Oba komentarze poprawione, cytujące `plik:linia`.
- Dwa przypadki behawioralne zielone.
- Pusty diff linii wykonywalnych w tej pozycji (komenda wyżej, wynik w raporcie).

---

## §D.4 — INWENTARZ 35 TRAS: REALNE vs ATRAPA

**Produkt tej pozycji to TABELA W RAPORCIE, nie kod.** Ma mieć **35 wierszy**
(albo tyle, ile wykaże Twój własny, kotwiczony pomiar — `§1.2` pkt 4)
i **osiem kolumn**:

| `#` | Metoda + ścieżka | Linia | Klasa | Źródło danych | Realny wołacz w `src/` | Ekran/zakładka | Uwaga |
| --- | ---------------- | ----- | ----- | ------------- | ---------------------- | -------------- | ----- |

**Słownik kolumny „Klasa" — dokładnie pięć wartości, rozłącznie:**

| Wartość            | Znaczenie                                                                   | Jak dowodzisz                                                                                               |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `REALNE`           | trasa czyta/pisze realną tabelę i zwraca to, co w niej jest                 | zapytanie SQL z `plik:linia` + wiersz w Twojej bazie                                                        |
| `REALNE_Z_SYNTEZĄ` | realna tabela, ale przy pustym wyniku serwer **dopisuje wartość od siebie** | wskazujesz linię syntezy (kandydaci: `partner.routes.ts:880-906`, `partnerProgramLedgerService.ts:640-657`) |
| `KIKUT_503`        | trasa istnieje, komenda biznesowa niezbudowana                              | `unavailablePartnerWriter`, `partner.routes.ts:64`                                                          |
| `ODMOWA_410`       | wyłączone decyzją `AMD-PRT-ECONOMICS-002`                                   | reguła w `partnerEconomicsPolicy.ts:164-172`                                                                |
| `NIEOSIĄGALNE`     | trasa, do której nie da się dojść przez żaden łańcuch middleware            | pełna ścieżka odmowy z `plik:linia`                                                                         |

**Trzy rzeczy, które ta tabela ma wykryć i nazwać:**

1. **`REALNE_Z_SYNTEZĄ` to nie to samo co `REALNE`.** Kod referencyjny
   syntetyzowany z nazwy organizacji i czterech znaków identyfikatora
   (`partner.routes.ts:880-906`) jest **realnie zapisywany**, ale nie pochodzi
   z decyzji biznesowej — użytkownik zobaczy „swój" kod, którego nikt mu nie
   nadał. **Opisujesz to, nie naprawiasz.**
2. **„Degraded" zerowe saldo** (`partnerProgramLedgerService.ts:640-657`) —
   `0` zwrócone, gdy odczyt się nie powiódł, jest **atrapą według `Z23`**,
   chyba że koperta niesie `degraded` z powodem. Sprawdzasz, czy niesie
   (`V8PartnerProgramStatus.degraded` istnieje w typie klienta,
   `src/services/api/v8/partner.ts:52`), i **czy front to pokazuje**. Jeżeli
   koperta niesie, a front ignoruje — to pozycja do `§D.9`.
3. **Dwa `GET`-y, które piszą** (`§1.2` pkt 6) — kolumna „Uwaga".

### Definicja ukończenia

- Pełna tabela, wszystkie wiersze, każda klasa z dowodem.
- **Podsumowanie liczbowe**: ile `REALNE`, ile `REALNE_Z_SYNTEZĄ`, ile
  `KIKUT_503`, ile `ODMOWA_410`, ile `NIEOSIĄGALNE`. Suma = liczba tras.
- **Zero zmian w kodzie w tej pozycji.**

---

## §D.5 — UCZCIWOŚĆ KOPERTY (`meta.capability`)

**Zasada `DEC-2026-08-25-21/22` („zero placebo") po stronie serwera.**

### Co budujesz

Dla każdej trasy sklasyfikowanej w `§D.4` jako `KIKUT_503`,
`REALNE_Z_SYNTEZĄ` albo `ODMOWA_410` koperta odpowiedzi ma **jawnie** nieść
informację o tym, że dane nie są w pełni realne. **Addytywnie**, w `meta`,
**nigdy** przez zmianę istniejących pól.

**Wzorzec już istnieje w tym module i go kopiujesz, nie wymyślasz:**

- kikuty niosą `capability` w ciele odmowy (`partner.routes.ts:64-72`);
- trasy ekonomiczne niosą `partnerEconomicsPolicyProjection()` w `meta`;
- odczyty niosą `meta.contract` (`V8_PARTNER_READ_CONTRACT`,
  `partner.routes.ts:61`).

**Twój dodatek — jedno pole, nie rodzina:**
`meta.dataFidelity` o wartościach `'real'` | `'synthesized'` | `'unavailable'`,
plus `meta.dataFidelityReason` (string) **wyłącznie** gdy wartość ≠ `'real'`.

### Cztery twarde ograniczenia

1. **Nie zmieniasz ani nie usuwasz żadnego istniejącego pola koperty.**
   Konsumenci w `src/` (28 metod klienta) czytają dzisiejszy kształt. Złamanie
   któregokolwiek = STOP.
2. **Nie zmieniasz statusów.** `503` zostaje `503`, `410` zostaje `410`
   (ramka do `Z23`).
3. **Nie dodajesz `dataFidelity` do tras `REALNE`** poza wartością `'real'` —
   pole ma być **taniej odróżnialne**, nie ozdobne.
4. **Nie zgadujesz powodu.** `dataFidelityReason` cytuje mechanizm
   (`'referral code synthesized from organization name'`), nie ocenę
   (`'probably fine'`).

### Definicja ukończenia

- Minimum 4 testy zachowania: trasa `REALNE` → `'real'`; trasa
  `REALNE_Z_SYNTEZĄ` przy pustej bazie → `'synthesized'` + powód; kikut →
  `'unavailable'` + `capability`; trasa `ODMOWA_410` → koperta polityki
  **nietknięta** (dowodzisz, że jej nie zepsułeś).
- **Dowód niezłamania konsumenta**: dla każdej dotkniętej trasy cytujesz
  wołacza w `src/` i pokazujesz, że czyta pola, których nie ruszyłeś.
- Parytet i18n PL+EN dla każdego napisu, który faktycznie wychodzi z API.

---

## §D.6 — IZOLACJA TENANTOWA (najcięższa pozycja dyżuru)

**Portal partnera czyta i pisze pieniądze. Ta pozycja waży więcej niż `§D.4`,
`§D.5`, `§D.7` i `§D.8` razem wzięte.**

### Co budujesz

`tests/integration/partners/partner-tenant-isolation.day42.realpg.test.ts` —
realny Gateway, realny PG, **dwie realne organizacje z realnymi wierszami
`organization_members`** (nigdy wstrzyknięcie do `req.user`).

**Scenariusz bazowy (stawiasz go raz, używasz we wszystkich przypadkach):**

```
org A  ──owner_organization_id──▶  partner P_A  (user U_A w partner_users)
org B  ──owner_organization_id──▶  partner P_B  (user U_B w partner_users)
P_A ma: atrybucje, prowizje, wypłatę, link kampanii, ustawienia wypłat,
        specjalizacje, regiony, wiersze ledgera
P_B ma: analogiczny, ROZŁĄCZNY komplet
```

**Obowiązkowe klasy przypadków — wszystkie, dla KAŻDEJ trasy pieniężnej:**

| Klasa                                  | Co robisz                                                                                                                 | Oczekiwane                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1 — obcy zasób po identyfikatorze** | `U_A` woła `DELETE /campaign-links/<link należący do P_B>`                                                                | **`404`**, nigdy `403` z danymi obiektu, nigdy `200`; **readback niezależnym połączeniem: wiersz `P_B` NIETKNIĘTY**                                                                                                                                                                            |
| **N2 — obca organizacja w nagłówku**   | `U_A` z `x-org-context: <org B>` woła `GET /earnings-summary`                                                             | odmowa **bez danych**; żadna kwota `P_B` nie wycieka                                                                                                                                                                                                                                           |
| **N3 — obca organizacja w body**       | `U_A` woła `PUT /organization` z `organizationId: <org B>` w body                                                         | pole z body **zignorowane**; readback dowodzi, że zmieniła się organizacja `P_A`, a `P_B` jest bit-identyczna                                                                                                                                                                                  |
| **N4 — nagłówek ORAZ body naraz**      | oba wektory w jednym żądaniu                                                                                              | odmowa; **zero mutacji w obu organizacjach**                                                                                                                                                                                                                                                   |
| **N5 — cudzy odczyt pieniędzy**        | `U_A` woła kolejno `GET /program/ledger`, `/earnings-summary`, `/commission-transactions`, `/payouts`, `/payout-settings` | **żaden** wiersz `P_B` w odpowiedzi; asercja na konkretnych identyfikatorach `P_B`, nie na `length`                                                                                                                                                                                            |
| **N6 — członkostwo odebrane**          | `U_A` z wierszem `organization_members` przestawionym na nieaktywny                                                       | odmowa na **każdej** z pięciu tras; readback bez zmian                                                                                                                                                                                                                                         |
| **N7 — ★ SUROGAT LEGACY**              | ten sam `U_A`, ta sama sesja, ale trasa `GET /api/partners/earnings-summary` (legacy, bez bramki V8)                      | **udokumentuj FAKTYCZNY wynik.** Wg `§1.2` pkt 7 legacy rozstrzyga partnera z samego `userId` i **nie** sprawdza `owner_organization_id` — jeżeli ten przypadek zwróci dane, **to jest udowodniona dziura izolacyjna** i wpisujesz ją jako **znalezisko `P0`**, nie jako porażkę swojego testu |

**Dla każdej trasy PISZĄCEJ dodatkowo: `SELECT COUNT(*)` przed i po,
niezależnym `pg.Client`.** Odmowa, która zostawiła wiersz, jest **gorsza** niż
brak odmowy, bo wygląda na bezpieczną.

### Trzy rzeczy, których w tej pozycji NIE robisz

1. **Nie naprawiasz legacy** (`Z19`) — `N7` jest dowodem i znaleziskiem.
2. **Nie dotykasz `auth.middleware.ts`** (`Z12`) — jeżeli `§1.2` pkt 9
   (gwarancja opiera się na zachowaniu `attachUser`) się potwierdzi, to jest
   **znalezisko dla dyżuru 37** (`§1.9`).
3. **Nie „wzmacniasz" `requireExactPartnerTenantContext`** — działa fail-closed;
   zmiana bez decyzji to zmiana kontraktu.

### Definicja ukończenia

- **Siedem klas × każda trasa pieniężna**, wszystkie zielone albo jawnie
  opisane jako znalezisko z dowodem.
- **Tabela w raporcie**: `trasa × klasa → status HTTP → readback (zmienione /
bez zmian)`.
- Jawne zdanie: **„żaden przypadek nie zwrócił `200` ani `403` z danymi obcego
  partnera"** — albo dokładnie odwrotne, z listą.

---

## §D.7 — TEZA „ENDPOINT BIERZE `orgId` Z URL-A": POTWIERDŹ ALBO OBAL

**Zlecenie pomiarowe wskazało `PUT /user-tiers/:orgId/:userId` jako trasę
portalu partnera przyjmującą identyfikator organizacji ze ścieżki.**
Wg `§1.2` pkt 4 to jest **cytat w JSDoc**, a nie trasa. **Nie przyjmujesz tego
na wiarę — sprawdzasz i rozstrzygasz.**

### Co robisz

```bash
# 1. czy to w ogóle jest kod
sed -n '235,272p' server/src/routes/v8/partner.routes.ts

# 2. lista tras z parametrem ścieżki w tym routerze
grep -nE "^router\.(get|post|put|patch|delete)\(\s*'[^']*:" server/src/routes/v8/partner.routes.ts

# 3. gdzie realnie żyje /user-tiers
grep -rn "user-tiers" server/src/routes/

# 4. czy KTÓRAKOLWIEK trasa partnera czyta organizację z params/body
grep -nE "req\.params\.(orgId|organizationId)|req\.body\.(orgId|organizationId)" server/src/routes/v8/partner.routes.ts
```

### Definicja ukończenia

- **Werdykt w raporcie**: `TEZA POTWIERDZONA` / `TEZA OBALONA`, z dowodem
  `plik:linia`.
- Jeżeli **obalona** — dopisujesz zdanie o tym, **skąd wzięła się pomyłka**
  (grep bez kotwicy `^` policzył blok JSDoc), bo to jest lekcja metodyczna
  tej samej klasy co `§1.2` pkt 2-3.
- Jeżeli **potwierdzona** — to znaczy, że coś się zmieniło od chwili
  wystawienia instrukcji: opisujesz trasę, sprawdzasz jej izolację przypadkami
  `N1`–`N4` z `§D.6` i **nie naprawiasz bez STOP-u**.
- Trasy z parametrem, które **istnieją** (`DELETE /campaign-links/:linkId`,
  trzy trasy `certifications/:certId/**`), dostają jawne zdanie o tym, że
  parametr jest **identyfikatorem zasobu**, a nie tenanta, i że ownership jest
  weryfikowany w zapytaniu (dowód `plik:linia`).

---

## §D.8 — „BACKEND MA / FRONT NIE WOŁA" ORAZ „ZAPIS BEZ CZYTELNIKA"

**Szukasz OBU kierunków. To są dwa różne defekty i mylenie ich jest samo
w sobie błędem raportowym.**

### Kierunek 1 — backend ma, front nie woła

Dla każdej z tras `§D.4`: czy istnieje wołacz w `src/`? Punkt wyjścia —
inwentarz z BLOKU 0 pkt 9. Wynik ma rozróżniać trzy stany:

- `WOŁANA` — jest wołacz, podajesz `plik:linia` i zakładkę;
- `MARTWA_METODA_KLIENTA` — metoda istnieje w `src/services/api/v8/partner.ts`,
  ale **nikt jej nie woła**;
- `BRAK_METODY_KLIENTA` — trasa nie ma nawet metody po stronie klienta.

### Kierunek 2 — zapis bez czytelnika

Dla każdej trasy **piszącej**: czy istnieje trasa **odczytu**, która ten zapis
podnosi, i czy front ją woła? Trasa, po której użytkownik nigdzie nie zobaczy
skutku swojego działania, jest defektem produktowym tej samej klasy co
`DEC-2026-08-28-173` w module Realizacja.

### Kierunek 3 — kontrolka bez trasy / z trasą, która zawsze odmawia

Czytasz `src/` (nie piszesz) i wypisujesz kontrolki, które: są `disabled` na
sztywno; łykają odmowę w neutralny komunikat; albo pokazują liczby **wyliczone
na froncie z innych liczb**. To ostatnie jest najgroźniejsze — użytkownik nie
ma jak odróżnić wyliczenia od pomiaru.

### Definicja ukończenia

- **Trzy tabele w raporcie**, po jednej na kierunek, każdy wiersz z `plik:linia`.
- **Podsumowanie liczbowe** każdego kierunku.
- **Zero zmian w `src/`** (`Z17`). Wszystko, co znajdziesz, idzie do `§D.9`.

---

## §D.9 — KONTRAKT DLA DYŻURU FRONTOWEGO (produkt podziału FRONT/TYŁ)

**To jest wejście do przyszłego dyżuru polerującego Partnera, nie jego
wykonanie.** Piszesz go tak, żeby dało się go przenieść do instrukcji frontowej
bez tłumaczenia.

Zawiera **dokładnie pięć list**, każda pozycja z `plik:linia` i uzasadnieniem:

1. **DO UKRYCIA** — kontrolki wołające trasy `KIKUT_503` albo `ODMOWA_410`,
   oraz liczby syntetyzowane na froncie. Uzasadnienie cytuje `DEC-2026-08-25-21/22`.
2. **DO OPISANIA JAKO „PLANOWANE"** — kontrolki, które mają sens produktowy,
   ale nie mają backendu. Podajesz **dosłowną treść etykiety PL i EN**.
3. **DO WŁĄCZENIA** — kontrolki, których trasa jest `REALNE` i działa, a front
   ich nie woła (`§D.8` kierunek 1). **Za flagą OFF, z polish-passem i akceptem
   właściciela na zrzutach** — piszesz to zdanie wprost w kontrakcie, bo bez
   niego dyżur frontowy złamie regułę 7 `CLAUDE.md`.
4. **DO NIETKNIĘCIA** — powierzchnie ekonomiczne. Uzasadnienie:
   `AMD-PRT-ECONOMICS-002`. **Ta lista jest w kontrakcie obowiązkowa**, żeby
   przyszły wykonawca frontowy nie „odblokował" ich w dobrej wierze.
5. **KSZTAŁT KOPERTY** — pełna specyfikacja pól, które front dostaje z każdej
   trasy `REALNE`, w tym nowe `meta.dataFidelity` z `§D.5`. To jest kontrakt
   odczytu i ma być kompletny.

### Definicja ukończenia

- Pięć list, wszystkie niepuste albo z jawnym „lista pusta, powód: …".
- **Jawne zdanie o regule 7** w liście 3.
- **Zero zmian w `src/`.**

---

## §R.1 — `modules/16_PARTNER/MODULE_ACCEPTANCE.md` DO STANU FAKTYCZNEGO

Dopisujesz **jeden blok** (nie przepisujesz dokumentu), zawierający:

- rozstrzygnięcie przyczyny `404` z `§D.1` (jedno zdanie, z werdyktem);
- liczby z `§D.4` (ile `REALNE` / `REALNE_Z_SYNTEZĄ` / `KIKUT_503` /
  `ODMOWA_410`);
- wynik `§D.6` (izolacja: przeszła / znaleziska `P0` z listą);
- **jawne zdanie, że bramka modułu SIĘ NIE ZMIENIA** —
  `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF` zostaje, bo ten
  dyżur **nie dowozi akceptu właściciela ani dowodu przeglądarkowego**.
  **Podniesienie bramki modułu = zawyżenie i podstawa odrzucenia dyżuru.**

## §R.2 — RAPORT

Jeden plik, ścieżka dokładnie:
`docs/program/waves/WAVE_03_ACCEPTANCE/PARTNER_PORTAL_DAY42_REPORT_20260828.md`
Struktura obowiązkowa — `§9.1`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~150 min, NIE pomijasz)

Punkty 1–10 z BLOKU 0. **Bramka wejściowa (pkt 7) jest warunkiem rozpoczęcia
czegokolwiek.** Pomiar zasięgu PRZED (pkt 8) jest warunkiem oddania raportu.

### Blok 1 — diagnoza (`§D.1` → `§D.7`)

`§D.1` jest pierwszy, bo od jego werdyktu zależy wariant `§D.2`.
`§D.7` robisz od razu po nim — jest krótki, a jego wynik zmienia zakres `§D.6`.

### Blok 2 — odblokowanie i prawda w kodzie (`§D.2` → `§D.3`)

`§D.3` **po** `§D.2`, nie przed: komentarz ma opisywać stan **docelowy**,
a nie ten, o którym dopiero zdecydujesz.

### Blok 3 — sedno bezpieczeństwa (`§D.6`)

**Najdłuższa pozycja dyżuru.** Rezerwujesz na nią najwięcej czasu. Jeżeli czasu
zabraknie na cokolwiek, ma zabraknąć na `§D.5`, nigdy na `§D.6`.

### Blok 4 — inwentarze (`§D.4` → `§D.8`)

Oba są dokumentacyjne i oba zależą od tego, co zobaczyłeś w blokach 1–3.

### Blok 5 — uczciwość koperty i kontrakt (`§D.5` → `§D.9`)

`§D.5` jest jedyną pozycją tego dyżuru, która dokłada pole do API. `§D.9`
podsumowuje wszystko dla frontu.

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. Pomiar zasięgu PO (`§0.4a` pkt 3b).
2. Siedem komend bezpiecznikowych, wyniki dosłownie do raportu:

   ```bash
   git stash list                                  # puste (Z27)
   git status --short                              # nic nieoczekiwanego
   git log --oneline «MARKER_SHA»..HEAD            # commit-per-pozycja
   git diff --name-only «MARKER_SHA»...HEAD        # zakres plikowy
   git diff «MARKER_SHA»...HEAD -- src/ | wc -l    # MUSI być 0 (Z17)
   git diff «MARKER_SHA»...HEAD -- .env.example server/src/middleware/ | wc -l   # MUSI być 0 (Z10/Z12)
   grep -c '«MARKER_SHA»' docs/…/CODEX_DAY42_PARTNER_PORTAL_INSTRUKCJA.md        # kontrola wiązania
   ```

3. `docker rm -fv cx-day42-pg` (**z `-v`**) i potwierdzenie w raporcie.
4. `§R.1`, `§R.2`, brief wynikowy.

### Zasada nadrzędna kolejności

**Jeżeli którakolwiek pozycja zajmie więcej czasu, niż zakładałeś — kończysz
ją albo stawiasz STOP, ale NIE zaczynasz następnej „na chwilę".**
Pozycja bez commita i bez dowodu nie istnieje.

---

## 9. RAPORT — jedyny dokument, który tworzysz

### 9.1. Szablon

```markdown
# Partner dzień 42 — odblokowanie portalu, inwentarz tras, izolacja tenantowa — raport dyżuru <data>

Gałąź: codex/partner-day42-<data> · baza: «MARKER_SHA» · Poziom ukończenia: <...>
Kontener: cx-day42-pg, port <5697 lub inny, jeśli zajęty>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

## Oświadczenie o zakazie `git stash` (Z27) — wynik `git stash list`

## Dowód celu połączenia (Z20/Z25/Z26/Z28) — wynik SELECT current_database()

## ★ WERYFIKACJA ERRATY §1.2 — dziewięć punktów

| Ustalenie | Moja komenda | Mój wynik | ZGADZA SIĘ / NIE ZGADZA SIĘ |

## Warunki wstępne — tabela (BLOK 0 pkt 3, 5)

## Migracje pełnym runnerem — liczba zastosowanych, drugi przebieg = 0

## ★★ BRAMKA WEJŚCIOWA (BLOK 0 pkt 7) — sześć podpunktów, wyniki dosłownie

## ★ INWENTARZ KONSUMENTÓW (BLOK 0 pkt 9) — tabela 28 metod

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit SHA | Dowód osiągalności | Dowód testowy |

## ★ DOWODY OSIĄGALNOŚCI (Z21/DEC-104) — pełny łańcuch dla pięciu rodzin

## Tabele werdyktów

### ★★ D.1 — WERDYKT PRZYCZYNY 404: (a) konfiguracja / (b) montaż / (c) mountStub / (d) schemat

| Hipoteza | Komenda / przypadek | Wynik | POTWIERDZONA / OBALONA |

### D.1b — czy przy kanonicznym env portal ożywa: TAK / NIE / TAK po pełnym runnerze

### D.2 — wybrany wariant (1 domyślny / 2 mount przed bramką) + decyzja, na którą się powołuję

### D.3 — komentarze | stara treść | nowa treść | pusty diff linii wykonywalnych? |

### D.4 — INWENTARZ TRAS (35 wierszy, 8 kolumn) + podsumowanie liczbowe

### D.5 — dataFidelity | trasa | wartość | powód | dowód niezłamania konsumenta |

### ★★ D.6 — IZOLACJA | trasa | N1 | N2 | N3 | N4 | N5 | N6 | N7 | readback bez zmian? |

### D.6b — jawne zdanie o braku wycieku ALBO lista znalezisk P0

### D.7 — teza „orgId z URL-a": POTWIERDZONA / OBALONA + dowód

### D.8 — trzy tabele (backend-ma-front-nie-woła · zapis-bez-czytelnika · kontrolka-bez-trasy)

### D.9 — KONTRAKT DLA FRONTU: pięć list

## ★ POMIAR TESTÓW (Z24) — PEŁNY zakres §0.4a

### Zakres §0.4a: X/Y PASS, S SKIPPED

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik

### Czerwone WPROWADZONE — per plik + SHA commitu, który je zapalił

### SKIPPED z powodu env (w tym: ile z powodu REAL_PG)

### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 6)

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

### Jawne zdanie: NIE przepisałem liczb dnia 12 ani z MODULE_ACCEPTANCE — zmierzyłem sam

## ★ Dowód braku atrapy (Z23) — cztery klasy odmowy nietknięte

## ★ Dowód nietknięcia ekonomii (Z11) — pusty diff partnerEconomicsPolicy.ts i rodziny

## Bezpieczniki — dowody (siedem komend z §8 Blok 6 pkt 2)

## Sprzątanie — `docker rm -fv` + potwierdzenie

## Errata i korekty wobec instrukcji

## Znaleziska (NIE naprawiane przeze mnie) — z adresatem: dyżur 37 / 38 / audyt schematu / dyżur frontowy

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## ★ TWIERDZENIA NIEZWERYFIKOWANE — czego NIE udowodniłem, choć napisałem

## Licznik (11 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / BRAK_POTRZEBY / NIE_ZACZĘTE)

## Kontrola zakresu i cleanup

## Czego NIE zrobiłem i dlaczego

## Gotowość
```

### 9.2. Zasady raportowania

1. **Raport jest WYNIKOWY.** Zero zdań w czasie przyszłym. Zero „planuję",
   „należałoby", „w kolejnym kroku". Opisujesz **stan po**, z dowodami.
2. **Każde twierdzenie ma dowód** — `plik:linia`, komenda + wynik, albo SHA
   commitu. Zdanie bez dowodu jest w tym programie traktowane jak zawyżenie.
3. **Liczby są Twoje.** Przepisanie cudzej liczby zamiast własnego przebiegu
   = naruszenie `Z24`. **Dotyczy to także liczby „36" z tej instrukcji** —
   `§1.2` pkt 4 mówi wprost, że masz ją zmierzyć sam.
4. **`SKIPPED` nigdy nie jest raportowane jako `PASS`** (`Z26`).
5. **Statusy pozycji są rozłączne i jednoznaczne**: `ZROBIONE_WG_DoD` /
   `CZĘŚCIOWO` (+ czego brakuje) / `STOP` (+ format z `§0.5`) / `BRAK_API` /
   `BRAK_POTRZEBY` / `NIE_ZACZĘTE`.
6. **★ Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" jest OBOWIĄZKOWA i nie może być
   pusta bez uzasadnienia.** Wypisujesz w niej każde zdanie raportu, którego
   nie udowodniłeś behawioralnie — w szczególności wszystko, co przyjąłeś
   z tej instrukcji na wiarę. Ten dyżur powstał dlatego, że komentarz w kodzie
   nikomu nie wydał się podejrzany; nie powtarzaj tego w raporcie.

---

## BRIEF WYNIKOWY — czym się rozliczasz w ostatniej wiadomości

Maksymalnie 15 linii, **w czasie przeszłym**, każde twierdzenie z dowodem:

1. Ścieżka raportu, liczba linii, SHA commitów (jeden na pozycję).
2. **Rozstrzygnięcie przyczyny `404` — jedno zdanie: KONFIGURACJA czy KOD**,
   z listą obalonych hipotez.
3. **Czy przy kanonicznym env portal ożywa** — `TAK` / `NIE` / `TAK po pełnym
runnerze migracji`.
4. **Dosłowna treść fałszywego komentarza (przed) i poprawionego (po).**
5. Liczba tras zmierzona **przez Ciebie** + podział na pięć klas z `§D.4`.
6. **Wynik izolacji tenantowej** — zdanie o braku wycieku albo lista znalezisk
   `P0` (w tym `N7`, legacy).
7. Werdykt `§D.7` (teza „`orgId` z URL-a").
8. Pomiar testów: `X PASS / Y FAIL / Z SKIPPED`, czerwone zastane vs wprowadzone.
9. STOP-y do decyzji nadzorcy.
10. **Twierdzenia niezweryfikowane.**
11. Potwierdzenie: `git stash list` puste · `git diff -- src/` = 0 ·
    ekonomia nietknięta · kontener `docker rm -fv` sprzątnięty.
