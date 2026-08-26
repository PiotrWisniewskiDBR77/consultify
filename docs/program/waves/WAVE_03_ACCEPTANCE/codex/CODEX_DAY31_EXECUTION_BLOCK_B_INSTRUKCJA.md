# INSTRUKCJA DYŻURU nr 31 — Codex — „Realizacja (Execution), blok B: przepięcie zapisów-409 na kanoniczny runtime-v1, read-model as-of i osiem miar kontrolnych — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–30. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **bezpośrednią kontynuacją partii A modułu Realizacja**, scalonej
decyzją `DEC-2026-08-26-128`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:180`),
która była odpowiedzią na panel ekspercki `DEC-2026-08-26-120`
(`…OWNER_DECISION_LEDGER_2026-08-24.md:172`) — **3,6/10, najniższy wynik całego
programu**.

Partia A zamknęła trzy rzeczy i **jedną jawnie odłożyła**:

1. **Wyciek międzytenantowy w `gate-check`** — POTWIERDZONY i ZAMKNIĘTY na żywym
   PG (filtr `organization_id` z tokenu, test regresyjny realdb w repo).
2. **Łańcuch cichej zieleni** — rozcięty na każdym z pięciu ogniw (17 cichych
   `catch` dostało `logger.error`; brama zwraca `__sourceUnavailable` zamiast
   nieodróżnialnej pustki; stopka raportu WYMUSZA `Confidence≠high` i
   `Freshness=Degraded` przy dowolnej awarii źródła).
3. **Przyciski, których jedynym skutkiem był `409`** — **uczciwie WYŁĄCZONE**
   z widocznym powodem PL/EN (`A11`, commit `9b53ee2490`). Polski tekst, który
   dziś widzi użytkownik, brzmi dosłownie:

   > **„Zapis przeniesiony do kanonicznego rejestru — w przygotowaniu"**

**Ten dyżur ma dotrzymać tej obietnicy.** „W przygotowaniu" trwa od 26.08.
Twoim zadaniem jest **przepiąć te zapisy na kanoniczny writer runtime-v1** —
albo, tam gdzie runtime-v1 komendy nie ma, **udowodnić brak i postawić STOP**.
Nie wolno Ci zdjąć ani jednego `disabled` w `src/` (§1.6): front jest poza
zakresem w całości. Twoim produktem dla frontu jest **kontrakt**, nie ekran.

Poza przepięciem zapisów dyżur ma dwa drugie filary, wskazane w zleceniu:
**read-model as-of** (dziś uczciwa odmowa, `reconstructable: false` zawsze)
i **osiem miar kontrolnych** (dziś ośmioelementowy szkielet z `value: null`
w każdej rodzinie).

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYŁĄCZNIE mechanikę tylną modułu Realizacja. Front jest poza zakresem
w CAŁOŚCI. Nie robisz zrzutów. Nie włączasz żadnej flagi frontowej.**

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest wręcz **wymagane** — BLOK 0 pkt 9 i Z20), ale
   **nie zmieniasz w nim ani jednego znaku** — także „jednej linii importu",
   także po to, żeby „tylko zdjąć `disabled`, skoro backend już jest", także po
   to, żeby „domknąć ostatnie ogniwo Z20". Jedyny wyjątek: **żaden**.
   Zdjęcie `disabled` bez zrzutów i bez polish-passu = **pokazanie właścicielowi
   zepsutego ekranu jako pierwszemu testerowi**, czyli złamanie reguły 7
   `CLAUDE.md`, która jest w tym projekcie **nienaruszalna**.
2. **★ NIE ZDEJMUJESZ BRAMKI `requireCanonicalExecutionWriter`.**
   `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` ma zostać
   **dokładnie tak restrykcyjny, jak jest**. `409` na legacy nie jest defektem —
   jest **decyzją architektoniczną** `AMD-EXE-SPINE-AUTHORITY-004 (26A)`
   (`…middleware.ts:15-21`): ma być **dokładnie jeden writer pracy wykonawczej**.
   Rozwiązaniem `409` jest **komenda po drugiej stronie**, nigdy poluzowanie
   bramki. Poszerzenie listy `GOVERNED_EXECUTION_CONTROL_COMMANDS`
   (`…middleware.ts:6-12`) = **odrzucenie całego dyżuru**, nie STOP.
3. **★ NIE ZASZYWASZ ŻADNEGO PROGU, ŻADNEJ WAGI I ŻADNEJ TAKSONOMII.**
   `E-O3` (taksonomia BSC), `E-O4` (wagi wpływu, próg „at-risk 7 dni", SLA
   decyzji) i `E-O5` (progi saturacji, bufor) **są u Piotra i pozostają
   bez odpowiedzi od 25.08** — patrz §1.5. Każda wartość, która od nich zależy,
   jest **parametrem czytanym z bazy**, nigdy stałą w kodzie. Zaszycie
   domyślnego progu = **odrzucenie pozycji**, nie errata.
4. **★ NIE DOPISUJESZ FUNKCJI, KTÓRYCH NIKT NIE ZAMÓWIŁ.** Ten dyżur ma
   **dziesięć pozycji roboczych** (§1.3) plus dwie dokumentacyjne. Wszystko,
   co Ci „po drodze" przyjdzie do głowy — nowe ekrany, generator raportów,
   flaga `execReportsIntelligence`, eksporty, silnik AI, endpointy archiwizacji
   z kebaba — jest **POZA ZAKRESEM** (§1.4) i idzie do „Znalezisk", nie do kodu.
5. **★ TEN DYŻUR MA JEDNĄ TWARDĄ BRAMKĘ WEJŚCIOWĄ.** Jeżeli **BLOK 0 pkt 8**
   (dowód, że runtime-v1 jest osiągalny **i** że legacy nadal uczciwie `409`-uje)
   **nie przejdzie**, nie zaczynasz pozycji B. Zakładasz raport, wpisujesz STOP
   z dosłownym wynikiem i kończysz dyżur. **Nie improwizujesz obejść bramki.**

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 5cfa62470e**

   > **Uwaga dla nadzorcy wystawiającego ten dokument (usuń tę ramkę przy
   > wiązaniu):** w miejsce `5cfa62470e` wpisujesz **rzeczywisty SHA tipa
   > `codex/m03-admin-20260824` z chwili wystawienia**, we **wszystkich**
   > wystąpieniach w tym pliku. W dokumencie **nie ma i nie może być
   > przykładowego SHA** — dzień 29 dostał instrukcję z konkretnym SHA wpisanym
   > „na przykład" i wykonawca zawiązał się do niego dosłownie. Dopóki ramka nie
   > jest usunięta, dokument **nie jest związany** i wykonawca ma prawo go
   > odrzucić na pierwszej komendzie.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor 5cfa62470e codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo `5cfa62470e`
   jest nadal literalnym napisem `5cfa62470e` — STOP.** Nie improwizuj bazy.
   Nie startuj z `origin/demo`, `main`, `Londyn`, `codex/preserve-*`,
   `codex/execution-batch-a-20260826`, `codex/finance-day30-20260827`,
   `codex/day29-finish-20260827`, `codex/assessment-*`, `codex/meetings-*`
   ani z żadnej gałęzi dni 17–30. Załóż raport, wpisz pozycję STOP z wynikiem
   obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline 5cfa62470e..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. **Każda z tych
   komend ma w §1.2/§1.7 podany oczekiwany wynik — rozbieżność idzie do „Korekt
   wobec instrukcji", nie do improwizacji:**

   ```bash
   # (a) partia A jest scalona — bez tego nie ma czego kontynuować
   git merge-base --is-ancestor 9b53ee2490 5cfa62470e && echo A11_SCALONE || echo A11_BRAK   # oczekiwane: A11_SCALONE
   git merge-base --is-ancestor e1ca1f0fbd 5cfa62470e && echo BATCH_A_SCALONE || echo BRAK   # oczekiwane: BATCH_A_SCALONE

   # (b) SEDNO CAŁEGO DYŻURU — bramka 409 istnieje i ma DOKŁADNIE JEDEN wyjątek
   grep -c "GOVERNED_EXECUTION_CONTROL_COMMANDS" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts   # oczekiwane: 2
   grep -n "method: 'DELETE'" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts                      # oczekiwane: DOKŁADNIE 1 trafienie (:10)

   # (c) SEDNO POZYCJI B.6-B.8 — osiem rodzin miar, wszystkie puste
   grep -c "null" server/src/services/executionControl/controlKpiReadModel.ts   # oczekiwane: >= 6
   grep -n "numerator: null" server/src/services/executionControl/controlKpiReadModel.ts  # oczekiwane: :57

   # (d) SEDNO POZYCJI B.5 — as-of zawsze odmawia
   grep -n "reconstructable: false" server/src/domain/initiatives-execution/reportReconstruction.ts   # oczekiwane: :56

   # (e) SEDNO POZYCJI B.7 — tabela polityk istnieje i NIE MA ANI JEDNEGO PISARZA
   ls server/migrations/20261077_day17_execution_control_kpi_policy.sql          # oczekiwane: plik istnieje
   grep -rn "execution_control_kpi_policies" server/src | wc -l                  # oczekiwane: 1 (tylko odczyt w controlKpiReadModel.ts:35)

   # (f) montaż runtime-v1
   grep -n "'/runtime-v1'" server/src/routes/pmo/initiatives.routes.ts           # oczekiwane: :154
   grep -n "app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesRoutes)" server/src/Gateway.ts   # oczekiwane: :697
   grep -n "execution-control" server/src/routes/v8/index.ts                      # oczekiwane: :106 z requireCanonicalExecutionWriter

   # (g) rejestr decyzji
   grep -c "DEC-2026-08-26-128" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   grep -c "DEC-2026-08-26-120" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1

   # (h) numeracja migracji
   ls server/migrations | grep -E '^202612'                          # oczekiwane: PUSTE
   ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -3  # oczekiwane: ...20261121, 20261122, 20261123

   # (i) najwyższe zastane ID ustaleń w rejestrze modułu
   grep -o "EXE-PF-[0-9]*" docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1   # oczekiwane: EXE-PF-006
   grep -o "EXE-OWN-[0-9]*" docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1  # oczekiwane: EXE-OWN-008
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/execution-day31-<data> 5cfa62470e
   git worktree add /private/tmp/consultify-execution-day31 codex/execution-day31-<data>
   cd /private/tmp/consultify-execution-day31
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

   **Katalog `/private/tmp/consultify-day31-instrukcja` istnieje i jest worktree,
   w którym powstał TEN dokument. NIE pracujesz w nim, nie kasujesz go, nie
   commitujesz do jego gałęzi.**

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only 5cfa62470e...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.3, §0.4a i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Dlaczego                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/execution-day31-<data>`                                                                                                                                                                                                                                                                                                                                                                                     | Push na `origin`/demo wykonuje wyłącznie nadzorca                                |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/execution-*`, `codex/finance-*`, `codex/assessment-*`, `codex/meetings-*`, `codex/day2*`, `codex/day3*`, `fix/*`                                                                                                                                                                                                                                                                                                                         | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku       |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                                                                                                                                                     | Krach 3/4 powstał tak; `DEC-95`                                                  |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Wymagania są w rejestrze uwag i decyzjach                                        |
| **Z5**  | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                                                                                                                                                                                                                | Chroniony, brudny worktree właściciela — praca własna Piotra                     |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich **75**, w tym `consultify-finance-day30`, `consultify-day29-finish`, `consultify-assessment-day29`, `consultify-day31-instrukcja`                                                                                                                                                                                                                                                                                                                        | Cudze worktree, część w aktywnym użyciu                                          |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ: **5432**, **5474** (`codex-tools-audit-pg-20260826`), **5511** (`cx-day30-pg`, dyżur 30 w toku), **5544** (`cx-day29finish-pg`, dokończenie dnia 29 w toku). Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: 5433, 5435, 5441, 5442, 5447, 5449, 5467, 5469, 5471, 5474, 5481, 5483, 5493, 5495, 5497, 5498, 5499, 5505, 5507, 5511, 5512, 5533, 5544, 5561. **Twój kontener PG = 5556.** Port zajęty → bierzesz pierwszy wolny **powyżej 5556** i wpisujesz do raportu | Cudze dyżury pracują równolegle                                                  |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                                                                                                                                                                                                                     | Produkcja/demo poza zakresem                                                     |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB, nigdy żadna baza `consultify_w3_execution_owner_*` (są ich w rejestrze modułu cztery, wszystkie **zachowane do odbioru właściciela** — patrz `MODULE_ACCEPTANCE.md:11,26,37`). **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                                            | „dane demo = twarz produktu" (`DEC-65`); tamte bazy są dowodem, nie piaskownicą  |
| **Z10** | **★★ Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi — w kodzie, w `.env*`, w `docker-compose*`, gdziekolwiek.** W szczególności **`execReportsIntelligence` ZOSTAJE OFF** (`DEC-72`, `DEC-120`) i **`ENABLE_V8_GLOBAL=true` żyje wyłącznie w linii komendy Twojego testu**                                                                                                                                                                                                                                                | CLAUDE.md reguła 9; flip flagi raportów wymaga akceptu Piotra na zrzutach        |
| **Z11** | **★★ Nie zdejmujesz i nie poluzowujesz `requireCanonicalExecutionWriter`.** Nie dopisujesz nic do `GOVERNED_EXECUTION_CONTROL_COMMANDS`. Nie „reaktywujesz" żadnej trasy `/api/v8/execution-control/*` ani `/api/execution-control/*`. Naruszenie = **odrzucenie dyżuru**, nie STOP                                                                                                                                                                                                                                                                      | `AMD-EXE-SPINE-AUTHORITY-004`: ma być DOKŁADNIE JEDEN writer pracy wykonawczej   |
| **Z12** | **★★ Nie zaszywasz progów, wag ani taksonomii z `E-O3`/`E-O4`/`E-O5`.** Żadnej „rozsądnej wartości domyślnej", żadnego „na razie 7 dni", żadnego `?? 0.8`. Wartość zależna od decyzji właściciela jest **danymi w tabeli**, nie stałą                                                                                                                                                                                                                                                                                                                    | Piotr nie odpowiedział od 25.08; zaszyta liczba staje się produktem po cichu     |
| Z13     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY31_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportu dnia 11 NIE edytujesz**                                                                                                                                                                                                                                       | Repo tonie w dokumentach-duchach                                                 |
| Z14     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Jeżeli uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze                                                                                                                                                                                                                                                                                                                                                               | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                       |
| **Z15** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`, zero `/api/ai/**`, zero kolejki. Dotyczy w szczególności `AiRecommendationPanel` z `§B.1` — „sugestia AI" ma dostać **komendę zapisu decyzji człowieka**, nie generator                                                                                                                                                                                                                                                                      | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`                          |
| **Z16** | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `UNKNOWN` / `DECISION_REQUIRED` / `BRAK_ŹRÓDŁA` / `Degraded`.** Rodzina miary bez polityki **zostaje** `DECISION_REQUIRED`. `reconstructable: false` bez historii zdarzeń **zostaje** `false`. Pusta organizacja **zostaje pusta**                                                                                                                                                                                                                                                  | Uczciwy pusty stan > udawany wynik; `UNKNOWN ≠ 0`; to jest cały dorobek partii A |
| **Z17** | **★★ NIETYKALNE — `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts`, `server/src/middleware/effectiveCapability.middleware.ts`.** Wolno **czytać** i **wołać**                                           | Model uprawnień i bramki naprawiane in-house; zmiana bramki = zmiana produktu    |
| **Z18** | **★ Zakaz wszystkiego poza modułem Realizacja** — z imiennymi licencjami z ramki poniżej. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy: **NIE**                                                                                                                                                                                                                                                                                                                                                                          | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                   |
| **Z19** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright.initiatives-execution.config.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                                                                                         | Dyżur nr 2 wywalił tak 27 cudzych testów                                         |
| **Z20** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — SZEŚĆ zmiennych, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**                                                                                                                                                                                                                                                                                | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`)    |
| **Z21** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą. **W tym dyżurze Z21 ma dodatkowy, twardy warunek wejściowy: BLOK 0 pkt 8**                                                                                                                                                                                                                                                                                                                                                                    | `DEC-104` powstał dokładnie po tym, jak DoD przepuścił martwy kod jako gotowy    |
| **Z22** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — patrz ramka pod tabelą. **W tym module pułapka jest szczególnie ostra**: router runtime-v1 jest fabryką `createInitiativesExecutionRuntimeRouter(deps)` i **kusi, żeby wstrzyknąć własne `deps`**                                                                                                                                                                                                                                                           | Dzień 18: 8/8 testów zielonych, warstwa martwa, bo wszystkie wstrzykiwały deps   |
| **Z23** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — **sukces w odpowiedzi + brak zmiany w bazie = ODRZUCENIE pozycji**. Dotyczy w szczególności `§B.2`, `§B.9` i każdej nowej komendy. Dowodzisz zmianę w bazie osobnym `SELECT` przed i po, **niezależnym poolem**                                                                                                                                                                                                                                                                       | Idempotencja „udawana w handlerze" jest gorsza niż jej brak                      |
| **Z24** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **Podanie zawężonego wyboru = naruszenie.** W tym module `.pg.test.ts` są `describe.skipIf(!REAL_PG)` — **`SKIPPED` to nie `PASS`**                                                                                                                                                                                                                                                            | 7 plików pg-testów Execution przechodzi jako skipped bez env — łatwo zawyżyć     |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★★ Z20 — SZEŚĆ zmiennych w tej samej linii, i dlaczego to nie jest biurokracja.**

- `server/src/database/Database.ts` — `process.env.MOCK_DB === 'true'` podstawia
  **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts` — globalny mock `auth.middleware.js`: przy **braku** nagłówka
  `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true` i woła `next()`. Czyli **anonim dostaje
  `200` zamiast `401`**. Bez `MOCK_DB=false` **każdy Twój pomiar autoryzacji,
  ról i izolacji tenanta jest fikcją** — a izolacja tenanta jest w tym module
  klasą, w której partia A znalazła realny wyciek (`DEC-128`, `A6`);
- **`ENABLE_V8_GLOBAL=true` jest w tym dyżurze SZÓSTĄ zmienną.** Runtime-v1 pod
  `/api/initiatives/runtime-v1` **nie** siedzi za `v8FeatureGate`, ale legacy
  `/api/v8/execution-control/*` **siedzi** — a Ty musisz zmierzyć **obie strony
  kontraktu**: że runtime-v1 przyjmuje zapis **i** że legacy nadal go odrzuca
  `409`, a nie `404 V8_DISABLED`. Bez tej zmiennej `§B.4` i bramka wejściowa
  mierzą bramkę globalną zamiast produktu.

Dlatego **każde** uruchomienie testu dotykającego bazy ma env **w tej samej
linii**:

```bash
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true \
npx vitest run --config server/vitest.config.ts <plik> --no-file-parallelism
```

**★ UWAGA — pg-testy tego modułu mają własną bramkę `REAL_PG`.**
`server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts:26` ma
`describe.skipIf(!REAL_PG)`. **Sprawdź w pliku, z jakiej zmiennej wyprowadzany
jest `REAL_PG`, i podaj ją w tej samej linii.** Jeżeli tego nie zrobisz, pakiet
przejdzie jako `SKIPPED` i zaraportujesz `PASS` na zerze uruchomionych asercji —
to jest naruszenie `Z24`, nie drobiazg.

Każdy przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day31-pg psql -U postgres -d cx_day31 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu.
**`inet_server_port()` wykonany przez `docker exec psql` zwraca NULL**, bo idzie
przez socket w kontenerze. To jest poprawne i oczekiwane — dowodem mapowania na
host jest `-p 5556:5432` w komendzie `docker run`, którą też wklejasz.
Nie „naprawiaj" tego.

**★ Z21 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki albo z klienta HTTP)
  → montaż (Gateway.ts:697 → routes/pmo/initiatives.routes.ts:154 → initiativesExecutionRuntime.routes.ts:<linia>)
  → bramki (gatewayVerifyToken → trialEntryGuard → verifyToken → validateOrgMembership
            → requireOrgAccess → demoContextMiddleware → authorize/effectiveCapability)
  → handler trasy (plik:linia)
  → komenda domenowa (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
  → ODCZYT, który ten wiersz podnosi (plik:linia)
  → konsument w `src/` (plik:linia) ALBO jawne „brak konsumenta w src/"
```

**Ostatnie dwa wiersze są obowiązkowe.** Zapis, którego żaden odczyt nie
podnosi, jest z punktu widzenia produktu niewidoczny: pozycja `CZĘŚCIOWO`, nie
`ZROBIONE_WG_DoD`.

**★ Dobra wiadomość, którą masz potwierdzić, nie przyjąć na wiarę:** Realizacja
**ma** realnego, typowanego konsumenta frontowego runtime-v1 —
`src/services/initiatives-execution/runtimeApi.ts` (`const BASE`/`fetch` na
`/api/initiatives/runtime-v1`, linia **85**), wołany m.in. z
`src/components/Execution/ExecutionHub.tsx:87`, `ExecutionWorkSurface.tsx:20-26`,
`ExecutionControlSurface.tsx:18`, `ExecutionResourcesSurface.tsx:15`,
`ExecutionReportsSurface.tsx:21`. Dla tras, których ten klient nie woła, ostatnim
ogniwem jest **koperta HTTP odczytu** — i wtedy **piszesz to wprost**:
„ostatnie ogniwo = koperta HTTP; brak konsumenta w `src/`". **Nie wolno Ci**
dopisać konsumenta frontowego, żeby ogniwo „domknąć" (Z18), i **nie wolno Ci**
przemilczeć jego braku.

**★ Z22 — co to znaczy „test domyślnego okablowania" w TYM module.**
`initiativesExecutionRuntime.routes.ts` eksportuje **fabrykę**
`createInitiativesExecutionRuntimeRouter(deps)` (`:1178`) i **domyślną instancję
z realnymi zależnościami** (`:5933-5956`: `PostgresMaterialCommandUnitOfWork`,
`PostgresInitiativeReader`, `ControlKpiReadModel`, `PostgresGovernancePolicyResolver`,
`resolveEffectiveAccess`). Test, który woła fabrykę z własnym `deps`, **nie
dowodzi niczego o produkcji** — bo domyślny `deps` z `:5934` to jedyna rzecz,
która naprawdę biegnie. **Twój test dowodowy montuje `export default` z `:5956`
za realnym `initiatives.routes.ts`**, tak jak robi to `Gateway.ts:697`.
Mockowanie ograniczone do `auth.middleware.js` (bo nie ma sesji przeglądarki)
i `Logger.js` (bo szum). **Każdy inny mock wymaga wpisu w raporcie
z uzasadnieniem.**

**★ Z23 — atrapa z zewnętrznym skutkiem w tym dyżurze.**
Cztery klasy, na które masz uważać:

1. **Komenda bez zapisu** (`§B.2`): handler zwraca `201` z pokwitowaniem,
   a w `ie_aggregate_state` / `ie_audit_events` nie przybywa wiersza. Dowód:
   `SELECT COUNT(*)` z **niezależnego poola** przed i po.
2. **CAS-atrapa** (`§B.9`): `expectedVersion` przyjmowane i nigdzie nie
   sprawdzane. **Dodanie pola, którego nikt nie weryfikuje, jest gorsze niż
   jego brak**, bo front zacznie mu ufać.
3. **Miara z licznikiem, ale bez drill-downu** (`§B.8`): `value: 0.62`
   i `drillDown.ids: []`. Liczba, której nie da się rozwinąć do wierszy
   źródłowych, jest **nieweryfikowalna** — a kontrakt modułu wymaga „exact
   drill-down set" (`MODULE_ACCEPTANCE.md:135,166`).
4. **As-of, który zwraca bieżącą migawkę** (`§B.5`): najgorsza możliwa atrapa
   tego dyżuru. Podstawienie stanu „teraz" pod pytanie „jak było w dniu X"
   produkuje **raport zarządczy z fałszywą historią**. `reportReconstruction.ts:17-22`
   odmawia tego świadomie — **nie wolno Ci tej odmowy „naprawić" skrótem**.

**Zasięg Z19 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
playwright.initiatives-execution.config.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z18 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts      (pozycje B.2, B.3, B.5, B.6, B.7, B.8 — ADDYTYWNIE)
  server/src/domain/initiatives-execution/**                       (pozycje B.2, B.5, B.9 — nowe komendy + reguły)
  server/src/domain/initiatives-execution/reportReconstruction.ts  (★ TYLKO pozycja B.5)
  server/src/services/executionControl/controlKpiReadModel.ts      (pozycje B.6, B.7, B.8)
  server/src/services/executionControl/**                          (NOWE pliki czytników miar)
  server/src/routes/v8/execution-control.routes.ts                 (★ TYLKO koperta 409 — pozycja B.4, jeśli to tam jest produkowana)
  server/src/domain/initiatives-execution/__tests__/*.test.ts      (NOWE pliki)
  server/src/routes/pmo/__tests__/day31.*.pg.test.ts               (NOWE pliki)
  server/src/services/executionControl/__tests__/*.test.ts         (NOWE pliki)
  server/migrations/2026120<x>_execution_day31_*.sql               (NOWE pliki — przedział 20261200-20261209)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY31_REPORT_20260828.md          (jedyny nowy dokument)

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  §B.1 — server/src/services/api-mirror: BRAK; czytasz src/services/api/v8/execution-control.ts (ODCZYT)
         src/components/Execution/**                              (ODCZYT — inwentarz przycisków)
  §B.2 — server/src/domain/initiatives-execution/materialCommand.ts        (WZORZEC koperty komendy; zmiana = STOP)
         server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts (WOŁASZ; zmiana TYLKO jeśli nowa komenda wymaga nowego agregatu — z wpisem)
  §B.5 — server/src/domain/initiatives-execution/reportRun.ts              (CZYTASZ kształt ReportSource; ZMIANA = STOP)
         server/src/domain/initiatives-execution/postgresInitiativeReader.ts (WOŁASZ; rozszerzenie o czytnik historii dozwolone ADDYTYWNIE, z wpisem)
  §B.6-8 — server/src/services/evmService.ts                               (CZYTASZ jako gotowe źródło SPI/CPI; ZMIANA = STOP — DZIAŁA)
         server/src/services/executionBudgetService.ts                     (CZYTASZ burn rate; ZMIANA = STOP)
         server/src/services/execution/canonicalExecutionHealthService.ts  (CZYTASZ; ZMIANA = STOP)
  wzorce testów — server/src/middleware/__tests__/executionSpineLegacyReadOnly.middleware.test.ts  (kontrakt 409)
                  server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts          (realny PG + seam)
                  server/src/services/__tests__/executionActionRegistryService.pg.test.ts          (sprzątanie po sobie)

NIE WOLNO:
  ★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK, wręcz wymagane)   ← podział FRONT/TYŁ; zero wyjątków
  ★ server/src/middleware/executionSpineLegacyReadOnly.middleware.ts  ← ZMIANA = ODRZUCENIE DYŻURU (Z11)
  ★ server/src/Gateway.ts                                          ← montaż = zakres nadzorcy
  ★ server/src/routes/v8/index.ts                                  ← jw.
  ★ server/src/routes/pmo/initiatives.routes.ts                    ← montaż runtime-v1; zmiana = STOP
  ★ server/src/middleware/v8FeatureGate.middleware.ts              ← Z10
  ★ server/src/services/v8/featureFlagService.ts                   ← jw.
  server/src/services/effectiveAccessService.ts                    ← Z17
  server/src/middleware/effectiveCapability.middleware.ts          ← Z17
  server/src/controllers/ExecutionController.ts                    ← naprawiony w partii A (A6, wyciek tenanta); nie ruszasz
  server/src/services/executionBvpService.ts                       ← spine legacy↔runtime; zmiana = STOP
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  tests/unit/backend/**                                            ← ★ KOLIZJA: dokończenie dnia 29 pracuje w tym drzewie (§1.9)
  server/src/routes/v8/finance-v2/**                               ← ★ KOLIZJA: dyżur 30 w toku (§1.9)
  server/src/routes/assessment/**                                  ← ★ KOLIZJA: dokończenie dnia 29 w toku (§1.9)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dziesięć pozycji roboczych = minimum
  dziesięć commitów (plus dwa dokumentacyjne). Wrzucenie kilku pozycji do
  jednego commita jest **samodzielnym powodem, dla którego pozycja nie dostanie
  `ZROBIONE_WG_DoD`** (tak zginął dzień 24). Conventional commits:

  ```
  test(execution): prove runtime-v1 is reachable and legacy still 409s (BLOK 0)
  docs(execution): map every disabled 409 write to its runtime-v1 command or BRAK_API (B.1)
  feat(execution): add the missing runtime-v1 commands proven absent in B.1 (B.2)
  feat(execution): expose an execution write-capability contract for the client (B.3)
  fix(execution): make the 409 envelope name the exact canonical command (B.4)
  feat(execution): resolve report sources to their version at an as-of instant (B.5)
  feat(execution): compute the five owner-independent control KPI families (B.6)
  feat(execution): let an organization author its KPI policy instead of hardcoding it (B.7)
  feat(execution): give every control KPI a real drill-down and source version (B.8)
  test(execution): prove CAS, idempotency, audit and tenant negatives on the new commands (B.9)
  docs(execution): record the three competing definitions of the eight KPIs (B.10)
  docs(execution): raise 06_EXECUTION acceptance to the delivered scope (R.1)
  docs(execution): day 31 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
  **★ UWAGA — `initiativesExecutionRuntime.routes.ts` ma 5956 linii.**
  Uruchomienie `prettier` na całym tym pliku może wygenerować **diff
  niezwiązany z Twoją zmianą**, którego odbiorca nie da rady przejrzeć.
  **Reguła: jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii
  merytorycznych — cofasz reformat, zostawiasz styl zastany i wpisujesz to do
  raportu.** Reformat cudzego kodu nie jest produktem tego dyżuru.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje** — nie złapie błędu typu. Dlatego każda
  zmiana kontraktu ma test behawioralny, który złapie to, czego esbuild nie widzi.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z22).
  **W tym module istnieje taki test i jest legalny jako strażnik regresji, nie
  jako dowód**: `src/components/Execution/__tests__/ExecutionRuntimeSpine.contract.test.ts`
  czyta pliki jako tekst (`hub.indexOf(...)`, `expect(hub).toContain(...)`), żeby
  pilnować, że usunięty w `A7` martwy komponent nie wróci. **Nie kopiujesz tego
  wzorca jako dowodu swojej pozycji.**
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie. **W tym dyżurze wszystkie nowe testy
  kładziesz obok kodu**, w `server/src/routes/pmo/__tests__/`,
  `server/src/domain/initiatives-execution/__tests__/` albo
  `server/src/services/executionControl/__tests__/` — to jest zastana konwencja
  modułu.
- **★ URUCHAMIANIE TESTÓW.** `server/vitest.config.ts` wymaga uruchomienia
  **z cwd `server`** albo jawnego `--config server/vitest.config.ts` z filtrem
  `server/...`. Uruchomienie z roota z filtrem `server/src/...` bez `--config`
  zwraca `No test files found` — a to **nie jest** `PASS` ani `SKIP`, tylko
  `NIE_ZMIERZONE`. Podanie takiego przebiegu jako zielonego = zawyżenie.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 31 MA PRZYDZIELONY PRZEDZIAŁ `20261200`–`20261209`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261199` to pule dni 22–30 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`. Dzień 30 ma `20261190`–`20261199`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^202612'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_execution_day31_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa (`DEC-107`).

     **★ ZNALEZISKO DO ODNOTOWANIA, NIE DO NAPRAWY:** prefiks `2026NNNN`
     w tym repo jest **sekwencją, nie datą** (najwyższy `20261123` przy dacie
     wystawienia 2026-08-28). Ponadto w drzewie żyje **równoległa seria
     trzycyfrowa** (`932_initiatives_execution_material_commands.sql`,
     `960_notification_types_ai_cost_budget.sql`), która alfabetycznie
     **wyprzedza** serię ośmiocyfrową. To nie jest awaria (porządek jest
     deterministyczny), ale czyni regułę „najwyższy + 1" kruchą.
     **Wpisz to do „Znalezisk", nie przenumerowuj cudzych plików.**

  3. **★★ NAJPEWNIEJ POTRZEBUJESZ CO NAJWYŻEJ DWÓCH MIGRACJI.** Sprawdziłem to
     za Ciebie. Dwa prawdopodobne powody:
     - **`§B.7`** — tabela `execution_control_kpi_policies` **istnieje**
       (`20261077_day17_execution_control_kpi_policy.sql`) i ma kolumnę
       `row_version`; migracja jest potrzebna tylko wtedy, gdy udowodnisz brak
       konkretnej kolumny albo indeksu. **Nie twórz drugiej tabeli polityk.**
     - **`§B.5`** — jeżeli rozstrzygnięcie pójdzie w stronę zapisu wersji stanu
       agregatu w czasie (patrz `§B.5` pkt 3), potrzebna będzie **jedna** tabela
       append-only. **Migracja bez udowodnionego braku obiektu na świeżej bazie =
       pozycja odrzucona.** Dowód `\d <tabela>` z Twojego kontenera idzie do
       raportu **przed** plikiem migracji.
  4. **★ ZERO nowych kluczy obcych do tabel spoza modułu.** Rodzina `ie_*` nie
     ma dziś ani jednego FK do `users`/`organizations` (klucze są `TEXT` +
     `organization_id TEXT NOT NULL`) — **utrzymujesz tę konwencję**.
  5. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
     **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Zero rekordów testowych gdziekolwiek
  indziej. **Ten moduł ma udokumentowaną historię brudzenia**: `EXE-PF-002`
  (`MODULE_ACCEPTANCE.md:96`) — „every green run retained 11 audit rows and one
  organization", `EXE-PF-004` (`:98`) — otwarta pozycja higieny fikstur.
  **Twoje testy sprzątają po sobie w dokładnym zasięgu swojej organizacji, przed
  usunięciem organizacji**, wzorzec:
  `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`.
  Sprzątanie kontenera **i wolumenów** jest obowiązkowe (BLOK 0 pkt 11).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `UNKNOWN` /
   `DECISION_REQUIRED` **z powodem**, **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap, a w szczególności zero atrap z zewnętrznym skutkiem (Z23).**
   Brak API → wpis `BRAK_API`. Brak danych → wpis `BRAK_DANYCH`.
   Brak decyzji właściciela → wpis `DECISION_REQUIRED` **z nazwą pytania**
   (`E-O3` / `E-O4` / `E-O5`).
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje `B.2`, `B.5`, `B.6`, `B.7` i `B.9`
   mają wyższe minima podane we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**,
   montujący **domyślny eksport** `initiativesExecutionRuntime.routes.ts:5956`
   (nie fabrykę z własnym `deps` — Z22). Test na zmockowanym serwisie **nie
   zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z21)** — pełna ścieżka od realnego wejścia do zapisu,
   do odczytu, który ten wiersz podnosi, **i do konsumenta w `src/` albo jawnego
   „brak konsumenta"**.
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z22)** — realny router, realne bramki,
   realne serwisy, **realne mapowanie błędów**; mockowanie ograniczone do
   `auth.middleware.js` i `Logger.js`. **Każdy inny mock wymaga wpisu w raporcie
   z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu/kontekstu**, nigdy z body/query.
   Test wysyła obcą organizację **w body ORAZ w nagłówku kontekstu org** bez
   aktywnego członkostwa i dostaje `404` (fail-closed), **nigdy `403` z danymi
   obiektu, nigdy `200`**. **To jest klasa, w której partia A znalazła realny
   wyciek (`DEC-128`, `A6`) — traktujesz ją najpoważniej z całego DoD.**
9. **★ Kontrola negatywna roli/zdolności** — żądanie bez wymaganej zdolności
   (`authorize`/`hasEffectiveCapability`, `initiativesExecutionRuntime.routes.ts:5944-5953`)
   jest ODRZUCONE **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy
   w `ie_aggregate_state` przed i po) **oraz nie zostawia zdarzenia w
   `ie_audit_events`**.
10. **Realny PG w jednorazowym Dockerze** (port **5556**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (Z20), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem (z zastrzeżeniem o pliku
    5956-liniowym z §0.3).
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem w całości (§1.6). Klucze i18n tworzysz **wyłącznie**
> dla napisów, które faktycznie wychodzą z Twojego API, i wtedy **parytet PL+EN
> obowiązuje w tym samym commicie**.
> **★ Uwaga na `controlKpiReadModel.ts:59`: `valueReason: 'BRAK_ŹRÓDŁA'` to
> POLSKI STRING ZASZYTY W KODZIE SERWERA, obok angielskiego `DECISION_REQUIRED`.**
> To jest zastana niespójność. **Nie łamiesz jej po cichu** — jeśli Twoja praca
> dokłada nowe wartości `valueReason`, trzymasz konwencję zastaną i **zgłaszasz
> rozjazd w „Znaleziskach"**. Zmiana istniejącej wartości = zmiana kontraktu dla
> frontu, czyli STOP.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z24)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z24.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (§0.1 pkt 6).
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`,
   `server/src/domain/initiatives-execution/**`,
   `server/src/services/executionControl/controlKpiReadModel.ts`,
   `server/src/routes/v8/execution-control.routes.ts`.
3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. Uruchom **minimum** poniższą listę. `ENV` niżej oznacza dosłownie
   `DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true`
   **w tej samej linii komendy** (Z20), a `VC` oznacza
   `--config server/vitest.config.ts`:

   ```bash
   # --- runtime-v1: trasy i domena (TWÓJ RDZEŃ) ---
   ENV npx vitest run VC server/src/routes/pmo/__tests__ --no-file-parallelism
   ENV npx vitest run VC server/src/domain/initiatives-execution/__tests__ --no-file-parallelism

   # --- miary kontrolne ---
   ENV npx vitest run VC server/src/services/executionControl/__tests__ --no-file-parallelism

   # --- bramka 409 (MUSI zostać zielona i MUSI nadal 409-ować) ---
   ENV npx vitest run VC server/src/middleware/__tests__/executionSpineLegacyReadOnly.middleware.test.ts
   ENV npx vitest run VC server/src/routes/v8/__tests__/execution-control.routes.test.ts

   # --- siedem pg-testów Execution (UWAGA: skipIf(!REAL_PG) — patrz Z20) ---
   ENV npx vitest run VC server/src/services/__tests__ --no-file-parallelism -t execution
   ENV npx vitest run VC server/src/services/caseWorkspace/__tests__/executionGraphService.pg.test.ts
   ENV npx vitest run VC server/src/services/resultsVnext/platform/__tests__/executionSignalIngress.pg.test.ts

   # --- pozostała powierzchnia Execution po stronie serwera ---
   ENV npx vitest run VC server/src/routes/__tests__ --no-file-parallelism -t execution

   # --- regresja frontu (NIE zmieniasz frontu, ale musi zostać jak było) ---
   npx vitest run src/components/Execution/__tests__
   npx vitest run src/components/Execution/reports-intelligence/__tests__
   npx vitest run src/components/Initiatives/__tests__
   ```

   Pakiety `src/**` są w zakresie **nie dlatego, że je zmieniasz** (nie wolno
   Ci), tylko dlatego, że **muszą pozostać zielone** — to jest Twój dowód, że
   nie ruszyłeś cudzego toru. W szczególności
   `src/components/Execution/__tests__/MitigationPanel.writesDisabled.test.tsx`
   i `ManagerApproval.smoke.test.tsx:126-139` pilnują dorobku partii A i **mają
   zostać zielone**: dopóki front nie przejdzie własnego dyżuru i polish-passu,
   przyciski **zostają wyłączone**, nawet gdy backend już przyjmuje zapis.

5. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem i z liczbą SKIPPED:**

   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (czerwone na markerze, PRZED moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env: <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```

   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia.** **Deklaracja „PASS" przy pakiecie
   w całości SKIPPED = to samo.**

6. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
7. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu „przed/po"
   w raporcie** (pełny tekst asercji). Dotyczy to również usunięcia bloku
   `describe`. Osłabienie bez wpisu = odrzucenie.
8. **★★ BASELINE JEST TWOIM OBOWIĄZKIEM, NIE CYTATEM.** Ten moduł **nie ma**
   raportu partii A z tabelą liczb — `DEC-128` podaje tylko „78 testów PASS"
   dla całej gałęzi, a jedyny materiał dowodowy w
   `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/execution-batch-a-20260826/`
   to **cztery pliki PNG dotyczące wyłącznie pozycji A9**. Dzień 11 podaje
   `137/137 PASS` jako „istniejący denominator techniczny"
   (`MODULE_ACCEPTANCE.md:59`) — **to liczba sprzed partii A i sprzed usunięcia
   4232 linii martwego kodu**. **Przepisanie którejkolwiek z tych liczb zamiast
   własnego przebiegu = naruszenie Z24.** Mierzysz sam i podajesz swoje.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- poluzować `requireCanonicalExecutionWriter` albo dopisać cokolwiek do
  `GOVERNED_EXECUTION_CONTROL_COMMANDS` — to jest **odrzucenie dyżuru**, nie STOP;
- wejść we `src/**` z zapisem (Z18) — **także po to, żeby „tylko zdjąć
  `disabled`, skoro backend już działa"**;
- dotknąć `Gateway.ts`, `routes/v8/index.ts` albo `routes/pmo/initiatives.routes.ts` —
  to jest STOP z rekomendacją, nie Twoja zmiana;
- dotknąć `effectiveAccessService.ts`, `effectiveCapability.middleware.ts`,
  `ExecutionController.ts` (Z17) — STOP **zawsze**, także „addytywnie";
- **zaszyć jakąkolwiek wartość zależną od `E-O3`/`E-O4`/`E-O5`** — próg, wagę,
  SLA, bufor, taksonomię BSC. To jest STOP z propozycją **parametru**, nigdy
  commit ze stałą (Z12);
- zwrócić z `§B.5` bieżącą migawkę jako odpowiedź na pytanie „jak było w dniu X" —
  STOP, to jest atrapa najgorszej klasy (Z23 pkt 4);
- **odświeżyć albo nadpisać zapisany snapshot runu raportu** przy rekonstrukcji —
  runy `PUBLISHED_SNAPSHOT` są **niezmienne** (`MODULE_ACCEPTANCE.md:280`);
- dodać `expectedVersion`, którego komenda nie potrafi sprawdzić w tej samej
  transakcji — to jest **atrapa (Z23)**, nie postęp: STOP z opisem;
- zapisać zdarzenie do `ie_audit_events` **poza transakcją mutacji** — STOP,
  nie „na razie tak, poprawi się później";
- stworzyć **drugi** rejestr komend/audytu obok rodziny `ie_*` — STOP;
- zbudować endpoint archiwizacji/usuwania inicjatywy albo definicji raportu
  (kebab `ExecutionHub.tsx:2836-2886`, dziś `disabled` z notą „Wkrótce
  (backend)") — **poza zakresem**, to osobne zadanie produktowe;
- włączyć `execReportsIntelligence` albo jakąkolwiek inną flagę (Z10);
- podpiąć AI/LLM do sugestii menedżera (Z15);
- dodać migrację nieaddytywną, z kluczem obcym poza modułem, albo z numerem
  **spoza przedziału `20261200`–`20261209`**;
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z19) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to jest zakaz, nie STOP:**
naprawiasz kod, nie omijasz strażnika.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

**26.08 panel ekspercki dał modułowi Realizacja `3,6/10` — najniższy wynik
całego programu** (`DEC-2026-08-26-120`, `OWNER_DECISION_LEDGER_2026-08-24.md:172`;
partner 4,0 · PMO 3,5 · UX 4,0 · inżynier 3,5 · sceptyk 3,0). Panel był
jednoznaczny co do przyczyny: **nie z braku funkcji, tylko z klasy błędu.**
Wprost pochwalił backend:

> „najlepszy backend runtime-v1 w przeglądzie: 5843 linie, pełna izolacja
> tenantów, CAS, idempotencja"

i wprost nazwał drugą co do wagi wadę:

> „**wszystkie zapisy execution-control MARTWE** — middleware
> `requireCanonicalExecutionWriter` zwraca 409 na każdy nie-GET, a UI nadal
> oferuje 6 grup przycisków (budżet, realizacje, mitygacje RAID, kokpit
> menedżera, cały 868-liniowy `AiRecommendationPanel`) — zawsze 409."

**Partia A (`DEC-2026-08-26-128`) zrobiła jedyną rzecz, jaką mogła zrobić
uczciwie: wyłączyła te przyciski.** Nie „naprawiła" ich przez poluzowanie bramki,
nie udała, że działają. Wyłączyła i napisała użytkownikowi, dlaczego. To była
postawa prawidłowa — i **dokładnie dlatego ten dyżur istnieje**: obietnica
„w przygotowaniu" ma teraz zostać dotrzymana **po stronie kanonicznego writera**.

Trzy filary tego dyżuru, w kolejności ważności:

1. **Przepięcie zapisów.** Legacy `409` zostaje. Powstaje (albo zostaje
   udowodnione, że już istnieje) **komenda runtime-v1** dla każdej z pięciu
   wyłączonych grup — plus **kontrakt zdolności**, bez którego front nie ma
   prawa zdjąć `disabled`.
2. **Read-model as-of.** `reportReconstruction.ts` **zawsze** zwraca
   `reconstructable: false`. Kontrakt modułu wymaga uzgodnienia wszystkich pięciu
   powierzchni „for the same `as-of` instant" (`MODULE_ACCEPTANCE.md:122`)
   i raportu opisującego stan historyczny w jawnym momencie (`:270`).
   **Dziś tego nie ma.**
3. **Osiem miar.** `ControlKpiReadModel` zwraca osiem rodzin, w każdej
   `numerator: null, denominator: null, value: null`, `drillDown.ids: []`,
   `sourceVersion: 0`, `scopeCompleteness: 'PARTIAL'` na sztywno.
   **To jest szkielet, nie miary.**

### 1.2. ★★ ERRATA — CZTERNAŚCIE RZECZY ZWERYFIKOWANYCH W KODZIE NA MARKERZE

Każdą z nich **potwierdzasz albo obalasz własną komendą** i wpisujesz do
obowiązkowej tabeli raportu. Nie przyjmujesz na wiarę — instrukcja też może się
mylić.

1. **Bramka `409` żyje w jednym pliku i ma DOKŁADNIE JEDEN wyjątek.**
   `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:3` definiuje
   kod `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`; `:6-12` zawiera jedyny dozwolony
   non-GET: `{ method: 'DELETE', path: /^\/budget\/entries\/[^/]+\/?$/ }`;
   `:38-43` zwraca `409` z polem `canonicalWriter: '/api/initiatives/runtime-v1'`.
   Drugi eksport, `requireCanonicalInitiativeExecutionWriter` (`:60-73`),
   stosuje tę samą odmowę do czterech rodzin ścieżek legacy Inicjatyw
   (`:53-58`).
2. **Bramka jest zamontowana w czterech miejscach**: `routes/v8/index.ts:106`
   (`/execution-control`), `Gateway.ts:1393-1399` (`/api/execution-control`
   z `deprecationHeader`), `Gateway.ts:1458-1464`
   (`/api/v8/execution-control/manager`), `routes/pmo/tasks.routes.ts:67`
   (cały router zadań PMO).
3. **Runtime-v1 nie jest flagą ani katalogiem — jest zamontowanym routerem.**
   `Gateway.ts:697` → `routes/pmo/initiatives.routes.ts:154`
   (`router.use('/runtime-v1', initiativesExecutionRuntimeRouter)`) →
   `routes/pmo/initiativesExecutionRuntime.routes.ts`. Efektywny prefiks:
   **`/api/initiatives/runtime-v1`**. Drugi montaż: `Gateway.ts:1158`
   (`/api/pmo/initiatives`). **`requireCanonicalExecutionWriter` NIE jest
   nałożony na ten mount** — i to jest cały sens architektury.
   Uwaga na kolejność w `initiatives.routes.ts`: `runtime-v1` jest montowany
   **PRZED** `router.use(requireCanonicalInitiativeExecutionWriter)`.
   **Ta kolejność jest kontraktem. Nie przestawiasz jej.**
4. **Router runtime-v1 ma 5956 linii i 135 rejestracji tras**, z czego
   **70 mutujących** (`POST`/`PATCH`). Fabryka:
   `createInitiativesExecutionRuntimeRouter(deps)` (`:1178`); domyślna instancja
   z realnymi zależnościami: `:5933-5956`.
5. **Rodzina tabel `ie_*` to realny event store z CAS i idempotencją.**
   `server/migrations/932_initiatives_execution_material_commands.sql`:
   `ie_aggregate_state` (`:33`, PK `(organization_id, aggregate_type, aggregate_id)`,
   kolumna `version`), `ie_command_receipts` (`:68`, PK
   `(organization_id, client_request_id)`, `request_fingerprint` 64 znaki),
   `ie_audit_events` (`:82`, `UNIQUE (organization_id, aggregate_type,
aggregate_id, aggregate_version)`, `created_at TIMESTAMPTZ`),
   `ie_outbox_events` (`:99`), `ie_aggregate_relations` (`:118`),
   `ie_governance_policies` (`:43`).
6. **★ `ie_aggregate_state` NIE PRZECHOWUJE HISTORII.** Klucz główny nie
   zawiera `version` — jest **dokładnie jeden wiersz na agregat**, nadpisywany.
   Historia żyje **wyłącznie** w `ie_audit_events`, i to jako **payload
   komendy**, nie jako stan wynikowy. **To jest sedno pozycji `B.5`** i powód,
   dla którego `reportReconstruction.ts:17-22` odmawia rekonstrukcji.
7. **`reportReconstruction.ts` odmawia świadomie i deterministycznie.**
   `:29-31` — `throw new RangeError('AS_OF_INVALID_OR_FUTURE')`;
   `:56-58` — **zawsze** `reconstructable: false`, `sources: []`, plus lista
   `gaps` z powodami `NO_EVENT_HISTORY_BEFORE_AS_OF` / `SOURCE_NOT_EVENT_SOURCED`
   / `ACCESS_DENIED`. Trasa: `initiativesExecutionRuntime.routes.ts:4792-4815`.
   **Brak testu `.pg.test.ts` dla tej ścieżki.**
8. **Osiem rodzin miar i pięć parametrów polityki.**
   `server/src/services/executionControl/controlKpiReadModel.ts:3-12` —
   `CONTROL_KPI_FAMILIES`: `plan-delivery`, `blocked-work`, `milestone`,
   `initiative-risk`, `dependency`, `capacity`, `decision-latency`,
   `intervention-effectiveness`. `:14-20` — `REQUIRED_POLICY_PARAMETERS`:
   `impactWeights`, `atRiskThresholdDays`, `capacitySaturationThreshold`,
   `capacityBuffer`, `decisionSlaDays`. `:22-26` — `POLICY_DEPENDENCIES`
   wiąże **dokładnie trzy** rodziny z parametrami: `initiative-risk`,
   `capacity`, `decision-latency`. **Pozostałe PIĘĆ rodzin nie zależy od żadnej
   decyzji właściciela** — i to jest Twoja pozycja `B.6`.
9. **★ Tabela polityk istnieje i NIE MA ANI JEDNEGO PISARZA.**
   `server/migrations/20261077_day17_execution_control_kpi_policy.sql:1-2`
   mówi wprost: „Empty, tenant-scoped policy store. No default policy is seeded:
   thresholds and weights remain an owner decision." `grep -rn
"execution_control_kpi_policies" server/src` daje **jedno** trafienie —
   `controlKpiReadModel.ts:35`, **odczyt**. Czyli: **nawet gdyby Piotr dziś
   odpowiedział na `E-O4`/`E-O5`, nie ma jak wprowadzić tych wartości do
   systemu.** To jest pozycja `B.7`.
10. **Trasa `GET /control-kpis` jest osiągalna i ma uczciwe `503`.**
    `initiativesExecutionRuntime.routes.ts:4858-4877`: wymaga `weekStart`
    w formacie `YYYY-MM-DD` (`400 VALIDATION_FAILED` inaczej), zwraca
    `503 CONTROL_KPI_READ_MODEL_UNAVAILABLE` przy braku `deps.controlKpis`.
    `ControlKpiReadModel` jest wstrzykiwany realnie w `:5937`.
11. **Pięć grup przycisków-409 żyje w czterech plikach frontu (odczyt, nie
    zapis!).** `src/components/Execution/BudgetControlPanel.tsx` — „Add Entry"
    (`:546-568`) i „Record realization" (`:630-651`) renderowane jako `div`
    z `cursor-not-allowed` + powód; `MitigationPanel.tsx:35-39` —
    `RAID_MITIGATION_WRITES_DISABLED = true`, przycisk `:233-250`;
    `ManagerModuleView.tsx:272-288` — akcje lane'owe kończą się `toast.error`
    **przed** wyjściem na sieć; `Manager/AiRecommendationPanel.tsx:270-284` —
    Approve/Defer z `disabledReason`. Klient legacy:
    `src/services/api/v8/execution-control.ts:462,468,473,518,530,542`.
12. **Dwie akcje NIE są wyłączone i mają działać dalej.**
    `BudgetControlPanel.tsx:533-541` — usunięcie pozycji budżetu (jedyny
    dozwolony non-GET, obsługiwany przez
    `server/src/services/executionBudgetDeleteCommandService.ts` z CAS,
    idempotencją, pokwitowaniem i audytem) oraz `ManagerModuleView.tsx:255-270` —
    approve/reject decyzji przez realne `Api.decideDecision`.
    **Nie ruszasz żadnej z nich.**
13. **Miary, które JUŻ działają i których nie budujesz drugi raz:**
    `server/src/services/evmService.ts:67` (`computeEvm` — SPI/CPI/EAC/VAC/RAG),
    `:103` (`evmScheduleHealth`, zwraca `null` przy braku baseline'u — uczciwie),
    `:127`/`:165` (EVM per inicjatywa / portfel);
    `server/src/services/executionBudgetService.ts:331-350` (burn rate,
    wariancja budżetu); `server/src/services/execution/canonicalExecutionHealthService.ts:53`
    (`computeCanonicalExecutionHealth`). **Czytasz je i wołasz. Nie przepisujesz.**
14. **Miary, których w module NIE MA W ŻADNEJ POSTACI** (grep pusty w kontekście
    Realizacji): `scheduleVariance`, `cycleTime`, `leadTime`, `throughput`,
    `blockedRate`. Trafienia na te słowa pochodzą z HTTP-metryk
    (`routes/performance.routes.ts:142`), promptu AI
    (`ideaAIGeneratorService.ts:397`) i SLO modułu Prezentacji.
    **Nie myl ich ze źródłem.**

### 1.3. ZAKRES — dokładnie dziesięć pozycji roboczych + dwie dokumentacyjne

| Pozycja  | Nazwa                                                                          | Klasa                          |
| -------- | ------------------------------------------------------------------------------ | ------------------------------ |
| **B.1**  | Mapa przepięcia: pięć grup zapisów-409 → komenda runtime-v1 albo `BRAK_API`    | pomiar + rozstrzygnięcie       |
| **B.2**  | Domknięcie komend zapisu runtime-v1 udowodnionych jako brakujące w `B.1`       | nowa mechanika                 |
| **B.3**  | Kontrakt zdolności zapisu wykonawczego dla klienta                             | nowa powierzchnia odczytu      |
| **B.4**  | Koperta `409` wskazuje **dokładną** komendę kanoniczną, nie sam prefiks        | uczciwość odpowiedzi           |
| **B.5**  | Read-model as-of: rozstrzygnięcie + czytnik wersji na moment                   | rozstrzygnięcie + budowa       |
| **B.6**  | Pięć rodzin miar niezależnych od decyzji właściciela — liczniki i mianowniki   | nowa mechanika                 |
| **B.7**  | Autorstwo polityki progów — żeby `E-O4`/`E-O5` dało się wprowadzić jako DANE   | nowa mechanika                 |
| **B.8**  | Proweniencja miar: `drillDown.ids`, `sourceVersion`, `scopeCompleteness`       | uczciwość odpowiedzi           |
| **B.9**  | Dowód braku atrapy dla komend `B.2`/`B.7`: CAS · idempotencja · audyt · tenant | pozycja dowodowa               |
| **B.10** | Trzy konkurencyjne definicje „ośmiu miar" — ustalenie z dowodem                | ustalenie, nie rozstrzygnięcie |
| **R.1**  | `MODULE_ACCEPTANCE.md` 06_EXECUTION do stanu faktycznego                       | dokumentacja                   |
| **R.2**  | Raport dyżuru                                                                  | dokumentacja                   |

Plus **twarda bramka wejściowa**: BLOK 0 pkt 8 (dowód osiągalności runtime-v1
**i** dowód, że legacy nadal `409`-uje) — bez niej nie zaczynasz nic.

**Kolejność jest wiążąca** (§8). Jeżeli czasu zabraknie, kończysz w kolejności
z §8 i pozycje nierozpoczęte oznaczasz `NIE_ZACZĘTE` **uczciwie** — nie
„po łebkach we wszystkich".

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **Cały front.** `src/**` do zapisu, `ExecutionHub.tsx`, `runtimeApi.ts`,
  panele `src/components/Execution/**`, `reports-intelligence/**`, `dev-render/**`,
  zrzuty, flagi frontowe, i18n napisów UI. **Zero.**
  **W szczególności: NIE zdejmujesz `disabled` z żadnego przycisku**, nawet gdy
  Twoja komenda backendowa już działa. Powód w §1.6.
- **Poluzowanie bramki `409`** — `AMD-EXE-SPINE-AUTHORITY-004` to decyzja
  architektoniczna, nie defekt.
- **Odpowiadanie za Piotra na `E-O3`/`E-O4`/`E-O5`.** Budujesz **nośnik**
  wartości (`B.7`), nigdy wartość.
- **Flaga `execReportsIntelligence` i cztery raporty dnia 11.** `DEC-72` i
  `DEC-120` trzymają ją OFF do akceptu właściciela na zrzutach. Nie dotykasz.
- **Generator raportów jako produkt** (`EXE-REPORT-GENERATOR-01`,
  `MODULE_ACCEPTANCE.md:266-286`) — to jest osobne, duże zadanie produktowe.
  Ty dotykasz **wyłącznie** rekonstrukcji as-of istniejącego runu (`B.5`).
- **Endpointy archiwizacji/usuwania/opóźniania** z kebaba
  (`ExecutionHub.tsx:2836-2886`) — dziś uczciwie `disabled` z notą „Wkrótce
  (backend)". Odnotowujesz w „Znaleziskach", nie budujesz.
- **Silnik AI / kolejka zadań** (Z15) — także jako „uprawdziwienie" sugestii
  menedżera.
- **N+1 przy otwieraniu raportu** („30 realizacji = 61 równoległych żądań",
  `DEC-120`) — wydajność, osobny tor.
- **Kasowanie martwego kodu** — partia A usunęła 4232 linie; resztę zostawiasz.
- **Naprawianie czerwonych testów w cudzych modułach** — mierzysz, opisujesz,
  nie naprawiasz.
- **Rozstrzyganie, która lista „ośmiu miar" jest kanoniczna** (`B.10`) —
  **ustalasz i dokumentujesz**, decyduje nadzorca z właścicielem.

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

- **`DEC-2026-08-26-120`** — panel `3,6/10`; `execReportsIntelligence` zostaje
  OFF; do Piotra idą wyłącznie trzy pytania: `E-O3`, `E-O4`, `E-O5`.
- **`DEC-2026-08-26-128`** — partia A scalona; przyciski-409 **uczciwie
  wyłączone**; wyjątek `DELETE /budget/entries/:id` **aktywny**; łańcuch cichej
  zieleni rozcięty (i **ma pozostać rozcięty**).
- **`AMD-EXE-SPINE-AUTHORITY-004 (26A)`** (`executionSpineLegacyReadOnly.middleware.ts:15-21`)
  — **dokładnie jeden writer pracy wykonawczej i jedna linia pokwitowań**.
- **`DEC-2026-08-25-63`** — „runtime-v1 report-runs = SSOT niezmiennej
  publikacji; management-reports = pipeline eksportowy". Nie mieszasz tych ról.
- **`DEC-2026-08-25-72`** — sześć werdyktów „JEST" dnia 11 uznanych za placebo;
  flip flagi zakazany do akceptu Piotra na zrzutach.
- **`DEC-2026-08-26-104`** — DoD wymaga dowodu **osiągalności**, nie istnienia
  pliku.
- **`DEC-2026-08-26-107`** — test wstrzykujący zależności nie dowodzi ścieżki
  produkcyjnej.
- **`DEC-2026-08-26-98`** — przedziały numerów migracji; korekta `Z9`.
- **`DEC-65`** — dane demo = twarz produktu; zero rekordów testowych poza
  Twoim kontenerem.
- **`DEC-86`** — symlink `node_modules` z chronionego worktree, **tylko odczyt**.
- **`DEC-95`** — rozejście markera nie jest STOP-em; rebase jest zakazany.
- **`EXE-OWN-002`** (`MODULE_ACCEPTANCE.md:107`) — **najtwardsza granica
  produktowa modułu**. Właściciel odrzucił rejestr „Execution Case" jako
  podstawowy obiekt widoczny; Inicjatywy są kanonicznym rejestrem, `Realizacje`
  są jego projekcją, a identyfikatory `execution_case` to **wewnętrzne klucze
  korelacji**. Twoje komendy i miary **nigdy nie wynoszą `executionCaseId` na
  pozycję tożsamości biznesowej** — tożsamością jest `initiative_id`
  (inwariant `MODULE_ACCEPTANCE.md:115-125`, pkt 3).

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ten dyżur jest w 100% tylny. Nie robisz ani jednego zrzutu i nie włączasz ani
jednej flagi frontowej. Nie zdejmujesz ani jednego `disabled`.**

Reguła: jeżeli produkt braku jest **widoczny na ekranie** — to jest front,
**poza zakresem**. Jeżeli produkt braku to **kształt odpowiedzi API, kod błędu,
ochrona zapisu, ślad audytu, licznik miary albo tabela w bazie** — to jest Twój
zakres.

**★ Dlaczego NIE wolno Ci zdjąć `disabled`, nawet gdy Twoja komenda działa.**
Włączenie przycisku zapisu to zmiana widoczna dla właściciela. `CLAUDE.md`
reguła 7 jest w tym projekcie **nienaruszalna** i mówi: **Piotr nigdy nie jest
pierwszym testerem wizualnym.** Zanim zobaczy jakikolwiek ekran, obowiązuje
kolejność: prototyp → wstępny OK → **realny render i zrzut wykonany przez
robotnika** → **wewnętrzny polish-pass** → **dopiero wtedy Piotr patrzy — do
AKCEPTU, nie do odkrywania zepsucia**. Ty nie robisz żadnego z tych kroków.
Dodatkowo reguła 9 zabrania masowego włączania: **ekrany wchodzą pojedynczo,
każdy po akcepcie na czystym zrzucie.**

**Twoim produktem dla frontu jest KONTRAKT, nie ekran.** Raport zawiera osobną,
obowiązkową sekcję **„Kontrakt dla frontu"**, która ma dać robotnikowi
frontowemu wszystko, czego potrzebuje, żeby:

- zamienić `RAID_MITIGATION_WRITES_DISABLED` (`MitigationPanel.tsx:39`) na
  **odczyt zdolności z `§B.3`**, a nie na drugą stałą w kodzie;
- wiedzieć, **którą komendę runtime-v1** wołać zamiast każdej z pięciu
  wyłączonych akcji — z metodą, ścieżką, kształtem body, nazwą nagłówka
  idempotencji i sposobem podania `expectedVersion` (`§B.1`, `§B.2`);
- odróżnić „brak zdolności" od „nie znaleziono" od „konflikt wersji" od
  „decyzja właściciela niepodjęta" (`§B.3`, `§B.4`);
- pokazać miarę razem z **rozwinięciem do wierszy źródłowych** i znacznikiem
  wersji źródła (`§B.8`);
- odróżnić raport historyczny od bieżącej migawki (`§B.5`).

**★ Co się stanie z tym kontraktem po Twoim dyżurze (dla Twojej wiedzy, nie do
wykonania):** nadzorca zleci **osobny dyżur frontowy**, który przepnie te
przyciski **za flagą domyślnie OFF**, zrobi **własne zrzuty** i przejdzie
**wewnętrzny polish-pass**; dopiero po polish-passie zrzuty idą do właściciela
do akceptu, **pojedynczo**. **Ty nie robisz żadnego z tych kroków.** Jeżeli
w trakcie pracy odkryjesz, że jakaś pozycja wymagałaby zmiany na ekranie —
**opisujesz to w „Kontrakcie dla frontu" i idziesz dalej**.

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

```
BRAMKA 409 — NIETYKALNA (czytasz, NIE zmieniasz)
  server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:3    kod EXECUTION_RUNTIME_V1_WRITE_REQUIRED
  …:6-12    GOVERNED_EXECUTION_CONTROL_COMMANDS — jedyny wyjątek DELETE /budget/entries/:id
  …:38-43   res.status(409) + canonicalWriter: '/api/initiatives/runtime-v1'   ← B.4 dotyka TREŚCI, nie logiki
  …:53-58   LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS (4 rodziny)
  …:60-73   requireCanonicalInitiativeExecutionWriter
  server/src/routes/v8/index.ts:106          v8Router.use('/execution-control', requireCanonicalExecutionWriter, …)
  server/src/Gateway.ts:1393-1399            '/api/execution-control' + deprecationHeader
  server/src/Gateway.ts:1458-1464            '/api/v8/execution-control/manager'
  server/src/routes/pmo/tasks.routes.ts:67   cały router zadań PMO

MONTAŻ RUNTIME-V1 (czytasz, NIE zmieniasz)
  server/src/Gateway.ts:697                       app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesRoutes)
  server/src/Gateway.ts:1158                      app.use('/api/pmo/initiatives', …)   ← drugi montaż
  server/src/routes/pmo/initiatives.routes.ts:145-148   verifyToken → validateOrgMembership → requireOrgAccess → demoContextMiddleware
  server/src/routes/pmo/initiatives.routes.ts:154       router.use('/runtime-v1', initiativesExecutionRuntimeRouter)   ← PRZED bramką legacy
  server/src/routes/pmo/initiatives.routes.ts:158       router.use(requireCanonicalInitiativeExecutionWriter)

POWIERZCHNIA RUNTIME-V1 — TWÓJ ZAKRES (5956 linii, 135 tras, 70 mutujących)
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
    :1178  createInitiativesExecutionRuntimeRouter(deps)      ← fabryka; NIE testujesz przez nią (Z22)
    :4499  POST /management-signals/ingest
    :4531  POST /interventions/:interventionId                 · :4562 POST /interventions/:id/transitions
    :4593  GET  /management-signals                            · :4612 GET /interventions
    :4631  POST /report-definitions/:definitionId              · :4670 POST /report-definitions/:id/transitions
    :4720  POST /report-runs/:reportRunId                      · :4761 POST /report-runs/:id/transitions
    :4792  POST /report-runs/:reportRunId/reconstruct          ← B.5
    :4858  GET  /control-kpis?weekStart=&policyId=             ← B.6/B.7/B.8
    :4455  GET  /command-receipts/:clientRequestId/read-back   ← wzorzec pokwitowania
    :5073  POST /finance-reconciliations/:id                   · :5105 POST /results-observations/:id
    :5534  POST /material-changes/:id                          · :5566 POST /material-changes/:id/transitions
    :5635  POST /ai-analysis-proposals/:id                     · :5667 POST /ai-analysis-proposals/:id/review   ← kandydat dla B.1 grupy 5
    :5722  POST /capacity-options/:id                          · :5754 POST /capacity-options/:id/select
    :3918  POST /execution-cases/:id/milestones/:milestoneId
    :3995/:4034  POST/PATCH /execution-cases/:id/tasks/:taskId · :4064 …/complete · :4208 …/transitions
    :4094/:4125/:4154  POST /execution-cases/:id/decisions/:decisionId(/request|/decide)
    :4282  POST /execution-cases/:id/tasks/:taskId/allocations/:allocationId
    :4344  POST /operational-allocations/simulate              · :4391 …/:id/transitions
    :5933-5956  domyślne zależności + `export default`         ← TO montujesz w testach (Z22)

DOMENA RUNTIME-V1 (wołasz; zmiana tylko tam, gdzie komenda musi być w transakcji)
  server/src/domain/initiatives-execution/materialCommand.ts:8/:9/:25/:269/:291   expectedVersion · clientRequestId · readBackUrl · walidacja
  server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts    zapis do ie_aggregate_state / ie_audit_events / ie_outbox_events / ie_command_receipts
  server/src/domain/initiatives-execution/postgresInitiativeReader.ts:617         odczyt z ie_aggregate_state
  server/src/domain/initiatives-execution/reportRun.ts                            kształt ReportRun / ReportSource
  server/src/domain/initiatives-execution/reportReconstruction.ts:17-22/:29-31/:56-58   ← B.5
  server/src/domain/initiatives-execution/managementIntervention.ts               reguły interwencji  ← kandydat dla B.1 grup 3/4

MIARY
  server/src/services/executionControl/controlKpiReadModel.ts:3-12   CONTROL_KPI_FAMILIES (8)
  …:14-20   REQUIRED_POLICY_PARAMETERS (5)      · …:22-26  POLICY_DEPENDENCIES (3 rodziny)
  …:56-61   numerator/denominator/value = null · drillDown.ids=[] · sourceVersion=0
  …:70      scopeCompleteness: 'PARTIAL' na sztywno
  server/migrations/20261077_day17_execution_control_kpi_policy.sql  execution_control_kpi_policies (ZERO pisarzy)
  server/src/services/evmService.ts:67/:103/:127/:165                 SPI/CPI/EAC/VAC/RAG — DZIAŁA, nie buduj drugi raz
  server/src/services/executionBudgetService.ts:331-350               burn rate — DZIAŁA
  server/src/services/execution/canonicalExecutionHealthService.ts:53 health score — DZIAŁA

SCHEMAT
  server/migrations/932_initiatives_execution_material_commands.sql:33/:43/:68/:82/:99/:118
  server/migrations/20261077_day17_execution_control_kpi_policy.sql

FRONT — WYŁĄCZNIE DO ODCZYTU (inwentarz B.1)
  src/components/Execution/BudgetControlPanel.tsx:546-568/:630-651/:533-541
  src/components/Execution/MitigationPanel.tsx:35-39/:233-250
  src/components/Execution/ManagerModuleView.tsx:255-270/:272-288
  src/components/Execution/Manager/AiRecommendationPanel.tsx:270-284
  src/services/api/v8/execution-control.ts:462/:468/:473/:518/:530/:542
  src/services/initiatives-execution/runtimeApi.ts:85                 ← typowany klient runtime-v1 (1714 linii)
  public/locales/pl/translation.json  „Zapis przeniesiony do kanonicznego rejestru — w przygotowaniu"
```

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **„Testy przeszły" ≠ „działa".** Dzień 11 miał sześć werdyktów „JEST", które
   odbiór uznał za **placebo** (`DEC-72`): generator = jeden formularz zamiast
   siedmiu kroków, „karty" = licznik `useState`, heatmapa = tekstowy duplikat
   tabeli, „lineage" = goły `<ul>`. Zawsze pytaj: _co dokładnie udowodnił ten
   zielony test?_
2. **Pomiar bez `MOCK_DB=false` mierzy fikcję** — globalny mock wstrzyka
   anonimowi rolę `owner` i `isSuperAdmin`. W module, w którym partia A
   znalazła realny wyciek międzytenantowy, to jest szczególnie groźne.
3. **`skipIf(!REAL_PG)` przechodzi jako `SKIPPED`, nie jako `PASS`.**
   Siedem plików pg-testów Execution zachowa się tak bez właściwego env.
4. **Uruchomienie vitest z roota bez `--config server/vitest.config.ts` daje
   `No test files found`** — a to nie jest `PASS`.
5. **Testowanie przez fabrykę `createInitiativesExecutionRuntimeRouter(deps)`
   z własnym `deps` nie dowodzi produkcji.** Produkcja biegnie przez
   `export default` z `:5956`.
6. **Dodanie pola, którego nikt nie sprawdza, jest gorsze niż jego brak.**
   Front zacznie ufać `expectedVersion`, którego komenda ignoruje.
7. **Zdarzenie audytu poza transakcją mutacji to atrapa z zewnętrznym skutkiem.**
8. **Podstawienie bieżącej migawki pod pytanie as-of** produkuje raport
   zarządczy z fałszywą historią — najgorsza możliwa atrapa tego dyżuru.
9. **Zaszycie „rozsądnego" progu** (7 dni, 80% saturacji, 3 dni SLA) zamienia
   pytanie do właściciela w cichy fakt produktowy. `E-O4`/`E-O5` czekają od
   25.08 właśnie dlatego, że nikt nie miał prawa ich zgadnąć.
10. **Test, który zostawia po sobie wiersze audytu.** `EXE-PF-002` opisuje
    dokładnie ten grzech: „every green run retained 11 audit rows".
    `ie_audit_events` jest append-only z założenia — sprzątasz w zasięgu swojej
    organizacji **przed** usunięciem organizacji.
11. **`inet_server_port()` przez `docker exec` zwraca NULL** — to nie jest błąd.
12. **Numer migracji „wolny wg `ls`" nie znaczy wolny.** Pule dni 22–30 nie są
    jeszcze scalone.
13. **Wyniesienie `executionCaseId` na tożsamość biznesową** — właściciel
    odrzucił ten model dosłownie i nieprzyjemnie (`EXE-OWN-002`). Tożsamością
    jest `initiative_id`.
14. **Zdjęcie `disabled` „bo backend już jest"** — to nie jest domknięcie
    pozycji, to złamanie reguły 7 `CLAUDE.md`.

### 1.9. ★ KOLIZJE Z DYŻURAMI W TOKU — sprawdzone, zakres rozłączny

W chwili wystawienia żyją **dwa** równoległe tory. Sprawdziłem ich diff wobec
`codex/m03-admin-20260824`; **żaden plik się nie pokrywa z Twoim zakresem**:

| Tor                              | Gałąź                          | Pliki, których dotyka                                                                                                                                                                                  |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dyżur 30 — Finance C–H           | `codex/finance-day30-20260827` | `server/src/routes/v8/finance-v2/**`, `FINANCE_DAY30_REPORT_20260827.md`, `codex/CODEX_DAY30_FINANCE_CH_INSTRUKCJA.md`                                                                                 |
| Dokończenie dnia 29 — Assessment | `codex/day29-finish-20260827`  | `server/src/routes/assessment/**`, `tests/acceptance/red-assess-500s.e2e.test.ts`, `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts`, `tests/unit/backend/routes/h64-failsoft-batch6.test.ts` |

**Konsekwencje dla Ciebie, twarde:**

- **`tests/unit/backend/**` i `tests/acceptance/**` są ZABLOKOWANE** — nie
  dodajesz tam ani jednego pliku, nie zmieniasz istniejących.
- **`server/src/routes/v8/finance-v2/**` i `server/src/routes/assessment/**`
  są ZABLOKOWANE.**
- Przedziały migracji `20261190`–`20261199` (dzień 30) i pule dni 22–29 są
  zajęte. **Twój przedział to `20261200`–`20261209` i tylko on.**
- Porty `5511` (dzień 30) i `5544` (dokończenie 29) **nasłuchują teraz**.
  **Twój port to `5556`.**

**Jeżeli w trakcie pracy odkryjesz, że Twoja pozycja wymaga zmiany w pliku
z tej tabeli — to jest STOP dla nadzorcy, nie Twoja zmiana.** Dwa równoległe
dyżury dotykające tego samego pliku produkują konflikt scalania, którego nikt
nie rozstrzygnie bez utraty pracy.

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

**Kolejność jest wiążąca (Z20): NAJPIERW kontener + pełne migracje, DOPIERO
potem jakikolwiek pomiar.** Czas: ~120 minut. **Nie pomijasz.**

1. **Marker i gałąź** — §0.1 pkt 2, 3, 5. Wynik obu komend do raportu.
   **Jeżeli `5cfa62470e` nie został podmieniony przez nadzorcę na rzeczywisty
   SHA — STOP natychmiast.**
2. **Weryfikacja stanu wejściowego** — §0.1 pkt 4, dziewięć komend (a)–(i).
   Rozbieżność → „Korekty wobec instrukcji".
3. **Kontener PG (jednorazowy, Twój):**

   ```bash
   docker run -d --name cx-day31-pg -e POSTGRES_PASSWORD=cx -p 5556:5432 pgvector/pgvector:pg16
   docker exec cx-day31-pg pg_isready -U postgres
   docker exec cx-day31-pg psql -U postgres -c "CREATE DATABASE cx_day31;"
   ```

   Obraz **`pgvector/pgvector:pg16`** jest obowiązkowy — `postgres:15` nie
   przechodzi migracji (brak rozszerzenia `vector`).

4. **Pełny łańcuch migracji na czystej bazie:**

   ```bash
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" DB_TYPE=postgres NODE_ENV=test \
   npx tsx server/src/db/migrate.postgres.ts
   # drugi przebieg — dowód idempotencji, oczekiwane "Applying migrations: 0"
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" DB_TYPE=postgres NODE_ENV=test \
   npx tsx server/src/db/migrate.postgres.ts
   ```

   Trzy liczby (zastosowane / błędy / drugi przebieg) idą do raportu.
   **Potem sprawdzasz obecność sześciu tabel, na których stoi cały dyżur:**

   ```bash
   docker exec cx-day31-pg psql -U postgres -d cx_day31 -c "\
     SELECT to_regclass('ie_aggregate_state'), to_regclass('ie_command_receipts'), \
            to_regclass('ie_audit_events'), to_regclass('ie_outbox_events'), \
            to_regclass('ie_governance_policies'), to_regclass('execution_control_kpi_policies');"
   ```

   **Jeżeli którakolwiek jest `NULL` — STOP.** To jest luka schematu od zera
   (`DEC-116`) i wymaga decyzji nadzorcy, nie Twojej migracji naprawczej.

5. **Dowód celu połączenia (Z20):**

   ```bash
   docker exec cx-day31-pg psql -U postgres -d cx_day31 -c "SELECT current_database(), inet_server_port();"
   ```

   Wynik **dosłowny** do raportu, razem z linią `docker run … -p 5556:5432`.

6. **★ BASELINE — pełny zakres §0.4a na markerze, PRZED pierwszym commitem.**
   Zapisz `PASS/FAIL/SKIPPED` per pakiet. **Ten moduł nie ma cudzego baselinu
   do przepisania** (§0.4a pkt 8) — Twoja tabela jest pierwszą liczbą, jaką ten
   moduł dostanie po partii A.
7. **★ USTALENIE `REAL_PG`.** Otwórz
   `server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts:26`
   i **wypisz do raportu dosłownie**, z jakiej zmiennej wyprowadzany jest
   `REAL_PG`. Powtórz pomiar z pkt 6 **z tą zmienną ustawioną** i podaj tabelę
   różnicową `bez REAL_PG` vs `z REAL_PG`. **Ile z pakietu „przechodziło" tylko
   dlatego, że było pominięte?** To jest pierwszy realny produkt tego dyżuru.
8. **★★ BRAMKA WEJŚCIOWA — DWUSTRONNY DOWÓD KONTRAKTU (Z21).**
   Nowy plik `server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts`,
   budujący `express()` i montujący **realny `initiativesRoutes`** tak, jak robi
   to `Gateway.ts:697`, oraz **realny `v8Router` za realnym `v8FeatureGate`**.
   **Zero wstrzykiwania `deps`.**

   Test ma udowodnić **obie strony kontraktu naraz**:

   | Strona  | Żądanie                                                                                             | Oczekiwane                                                                  |
   | ------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
   | RUNTIME | `GET /api/initiatives/runtime-v1/execution-cases` bez tokenu                                        | `401`/`403` — **NIE `404`**, czyli trasa istnieje i jest zamontowana        |
   | RUNTIME | `GET /api/initiatives/runtime-v1/control-kpis?weekStart=YYYY-MM-DD` z realnym członkostwem `ACTIVE` | `200` z ośmioma rodzinami                                                   |
   | RUNTIME | `POST /api/initiatives/runtime-v1/management-signals/ingest` z realnym członkostwem                 | **NIE `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`** — zapis przechodzi bramkę |
   | LEGACY  | dowolny `POST /api/v8/execution-control/...` przy `ENABLE_V8_GLOBAL=true`                           | **`409` z `code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'`**                   |
   | LEGACY  | `DELETE /api/v8/execution-control/budget/entries/<id>`                                              | **NIE `409`** — wyjątek nadal aktywny                                       |
   | LEGACY  | dowolny `GET /api/v8/execution-control/...`                                                         | **NIE `409`** — odczyty legacy nadal żyją                                   |

   Wiersze `users` / `organizations` / `organization_members` zakładasz w teście
   (wzorzec sprzątania:
   `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`).

   **★ CZEGO NIE WOLNO CI ZROBIĆ:** nie ruszasz
   `server/src/middleware/__tests__/executionSpineLegacyReadOnly.middleware.test.ts`
   ani `server/src/routes/v8/__tests__/execution-control.routes.test.ts:216-217`.
   Jeżeli u Ciebie zczerwienieją — **to jest znalezisko, nie powód do ich zmiany**.

   **★ JEŻELI TA BRAMKA NIE PRZEJDZIE — STOP CAŁEGO DYŻURU.** Nie zaczynasz B.
   Wpisujesz STOP z dosłownym wynikiem (status HTTP i ciało per wiersz),
   commitujesz test + raport, kończysz.

9. **★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW — „wypisz endpointy i kto woła".**
   Obowiązkowa tabela raportu, **produkowana PRZED pierwszą zmianą kodu**:

   ```bash
   # wszystkie trasy runtime-v1 (metoda + ścieżka + linia)
   grep -nE "^ *router\.(get|post|put|patch|delete)\(" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts

   # wszystkie trasy legacy execution-control
   grep -nE "^ *router\.(get|post|put|patch|delete)\(" server/src/routes/v8/execution-control.routes.ts

   # kto woła runtime-v1 po stronie frontu
   grep -rn "runtime-v1" src/ | grep -v "__tests__"
   grep -n "fetch(\|BASE" src/services/initiatives-execution/runtimeApi.ts | head -80

   # kto woła legacy execution-control po stronie frontu
   grep -rn "V8ExecutionControlApi\." src/ | grep -v "__tests__"
   ```

   Format tabeli (jedna linia na trasę): `METODA | ścieżka | plik:linia
handlera | mutuje? | za bramką 409? | wołający w src/ (plik:linia) albo BRAK |
pozycja tego dyżuru, która jej dotyka`.
   **To jest fundament dla `§B.1`, `§B.2` i `§B.4` — bez tej tabeli nie masz
   denominatora i każda deklaracja pokrycia jest zgadywaniem.**
   Instrukcja podaje **135 tras runtime-v1, w tym 70 mutujących** — **potwierdź
   albo obal tę liczbę własnym grepem** i wpisz swoją.

10. **Sprawdzenie numeracji migracji** — §0.3 (`ls | grep '^202612'` MUSI być
    puste).
11. **Sprzątanie na koniec dyżuru** (obowiązkowe, wynik do raportu):

    ```bash
    docker rm -fv cx-day31-pg
    docker volume ls -q | grep cx-day31 | xargs -r docker volume rm
    docker ps -a --filter name=cx-day31-pg          # MUSI być puste
    ```

    **★ NIGDY `docker volume prune`** — skasowałbyś wolumeny czterech cudzych,
    aktywnych kontenerów (`cx-day30-pg`, `cx-day29finish-pg`,
    `codex-tools-audit-pg-20260826` i lokalny `5432`). `docker rm -fv` usuwa
    wolumeny anonimowe **wyłącznie tego kontenera**.

---

## §B.1 — MAPA PRZEPIĘCIA: pięć grup zapisów-409 → komenda runtime-v1

**To jest pozycja pomiarowa i rozstrzygająca. Nie piszesz w niej ani jednej
linii kodu produkcyjnego. Bez niej pozycje `B.2`, `B.3` i `B.4` nie mają
denominatora.**

Zastane (potwierdź):

| #   | Grupa                            | Front (ODCZYT)                              | Klient legacy                                                                    |
| --- | -------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Dodanie pozycji budżetu          | `BudgetControlPanel.tsx:546-568`            | `execution-control.ts:468` `createBudgetEntry`                                   |
| 2   | Zapis realizacji budżetu         | `BudgetControlPanel.tsx:630-651`            | `execution-control.ts:473` `recordRealization`                                   |
| 3   | Zapis mitygacji RAID             | `MitigationPanel.tsx:35-39`, `:233-250`     | `execution-control.ts:462` `updateRaidMitigation`                                |
| 4   | Akcje lane'owe kokpitu menedżera | `ManagerModuleView.tsx:272-288`             | `execution-control.ts:518` `executeManagerProblemAction`                         |
| 5   | Approve/Defer sugestii AI        | `Manager/AiRecommendationPanel.tsx:270-284` | `execution-control.ts:530` `applyManagerSuggestion`, `:542` `submitLaneDecision` |

Twój produkt:

1. **Dla KAŻDEJ z pięciu grup ustal i udokumentuj:**
   - **jaki dokładnie zapis** ta akcja wykonywała w legacy (metoda + ścieżka
     - handler `plik:linia` w `execution-control.routes.ts` + tabela docelowa);
   - **jaki agregat runtime-v1** jest jej semantycznym odpowiednikiem
     (`aggregate_type` w `ie_aggregate_state`);
   - **czy komenda runtime-v1 JUŻ ISTNIEJE** — jeśli tak: **metoda + ścieżka +
     `plik:linia` + kształt body + czy przyjmuje `expectedVersion`
     i `clientRequestId`**;
   - jeśli nie istnieje: **`BRAK_API`** z dowodem (dosłowny grep, który nic nie
     znalazł), plus **jednozdaniowa propozycja** kształtu komendy dla `B.2`.
2. **★ Kandydaci, których masz sprawdzić NAJPIERW** (podaję je, żebyś nie
   przeoczył — ale **weryfikujesz semantykę, nie przyjmujesz na wiarę**):
   - grupa 3 (RAID) i 4 (lane) → rodzina interwencji:
     `POST /management-signals/ingest` (`:4499`),
     `POST /interventions/:interventionId` (`:4531`),
     `POST /interventions/:interventionId/transitions` (`:4562`),
     oraz `server/src/domain/initiatives-execution/managementIntervention.ts`;
   - grupa 5 (sugestia AI) → `POST /ai-analysis-proposals/:id` (`:5635`)
     i `POST /ai-analysis-proposals/:id/review` (`:5667`);
   - grupa 4, wariant „decyzja" → `POST /execution-cases/:id/decisions/:id/decide`
     (`:4154`) — **uwaga: approve/reject decyzji JUŻ DZIAŁA przez
     `Api.decideDecision` i nie jest w zakresie**;
   - grupy 1 i 2 (budżet) → **ostrzeżenie**: w runtime-v1 **nie ma ścieżki
     `/budget`**. Najbliżsi semantycznie kandydaci to
     `POST /finance-reconciliations/:id` (`:5073`) i
     `POST /material-changes/:id` (`:5534`). **Jeżeli żaden nie jest
     semantycznie tym samym — to jest `BRAK_API` i propozycja dla `B.2`,
     nie naciąganie istniejącej komendy.**
3. **★ Sprawdź, czy odczyt po stronie runtime-v1 w ogóle istnieje.** Zapis, dla
   którego nie ma odpowiadającego `GET`, jest niewidoczny (Z21). Dla każdej
   grupy podaj **trasę odczytu**, która podniesie zapisany wiersz, albo jawne
   „brak odczytu — pozycja będzie `CZĘŚCIOWO`".
4. **★ Nie wolno Ci rozstrzygnąć, że grupa jest „niepotrzebna".** Właściciel
   widzi te przyciski i dostał obietnicę „w przygotowaniu". Jeżeli uważasz, że
   akcja nie powinna wrócić — **to jest STOP z rekomendacją dla nadzorcy**,
   nie cicha decyzja produktowa.
5. **Odnotuj jawnie dwie akcje, których NIE dotykasz**, i udowodnij, że nadal
   działają: `DELETE /budget/entries/:id` (`BudgetControlPanel.tsx:533-541`)
   i approve/reject decyzji (`ManagerModuleView.tsx:255-270`).

**DoD `B.1`:** tabela pięciu grup **z kolumną „komenda runtime-v1 / `BRAK_API`"**
i kolumną „trasa odczytu"; dosłowne grepy jako dowód każdego `BRAK_API`;
propozycja kształtu dla każdego braku; jawny wpis o dwóch akcjach nietkniętych;
commit (dokumentacyjny — zmiana wyłącznie w raporcie).

---

## §B.2 — DOMKNIĘCIE BRAKUJĄCYCH KOMEND ZAPISU

**Budujesz WYŁĄCZNIE to, czego `B.1` dowiodło jako `BRAK_API`. Ani jednej
komendy więcej.** Jeżeli `B.1` wykaże, że wszystkie pięć grup ma już komendę
runtime-v1 — ta pozycja kończy się jako `BRAK_POTRZEBY` z dowodem i to jest
**dobry wynik**, nie porażka.

1. **Wzorzec jest jeden i już istnieje** —
   `server/src/domain/initiatives-execution/materialCommand.ts`. Każda nowa
   komenda:
   - przyjmuje **kopertę** z `expectedVersion` (`:8`, walidacja `:291`:
     nieujemna liczba całkowita) i `clientRequestId` (`:9`);
   - przechodzi przez `PostgresMaterialCommandUnitOfWork`, który w **jednej
     transakcji** zapisuje: `ie_aggregate_state` (CAS na `version`),
     `ie_audit_events` (`UNIQUE` na `aggregate_version` — to jest Twoja ochrona
     przed podwójnym zapisem), `ie_command_receipts` (idempotencja na
     `(organization_id, client_request_id)` + `request_fingerprint`),
     `ie_outbox_events`;
   - zwraca **pokwitowanie z `readBackUrl`** (`materialCommand.ts:25`),
     rozwiązywalnym przez `GET /command-receipts/:clientRequestId/read-back`
     (`initiativesExecutionRuntime.routes.ts:4455`).
2. **★ NIE tworzysz drugiego mechanizmu.** Jeżeli Twoja komenda „nie pasuje"
   do `materialCommand` — to jest **STOP z opisem**, nie własna ścieżka zapisu.
   Drugi rejestr komend złamałby `AMD-EXE-SPINE-AUTHORITY-004` dokładnie tak
   samo, jak poluzowanie bramki.
3. **`organizationId` wyłącznie z kontekstu aktora** (`actorFromRequest`),
   nigdy z body ani z query. To jest klasa, w której partia A znalazła realny
   wyciek.
4. **Tożsamość biznesowa = `initiative_id`.** `executionCaseId` może być
   kluczem korelacji, **nigdy** identyfikatorem widocznym jako tożsamość
   (`EXE-OWN-002`, inwariant `MODULE_ACCEPTANCE.md:117-118`).
5. **Zdolność sprawdzana przez istniejący `authorize`**
   (`initiativesExecutionRuntime.routes.ts:5944-5953` →
   `resolveEffectiveAccess` + `hasEffectiveCapability`). **Nie dopisujesz nowej
   zdolności i nie zmieniasz modelu uprawnień** (Z17). Jeżeli dla Twojej komendy
   nie ma odpowiedniej zdolności — **STOP**.
6. **Kształt błędu spójny z zastanym**: `res.status(4xx).json({ error: { code: '…' } })`
   — patrz `:4864` (`AUTH_REQUIRED`), `:4869` (`VALIDATION_FAILED`),
   `:4875` (`CONTROL_KPI_READ_MODEL_UNAVAILABLE`), `:4810` (`NOT_FOUND`).
   **Nie wprowadzasz trzeciej konwencji koperty błędu.**

**DoD `B.2` (wyższe minimum):** dla **każdej** nowej komendy — test happy na
realnym PG przez `export default` routera; test `409`/`412` na złym
`expectedVersion` z dowodem, że **liczba wierszy w bazie się nie zmieniła**;
test idempotencji (ten sam `clientRequestId` dwa razy → **jeden** obiekt,
dowód `COUNT(*)` niezależnym poolem); test negatywu tenanta (obca organizacja
w body **i** w nagłówku kontekstu → `404`); test negatywu zdolności (brak
uprawnienia → odmowa **i zero wierszy w `ie_audit_events`**); dowód
osiągalności Z21 z odczytem; commit per komenda.

---

## §B.3 — KONTRAKT ZDOLNOŚCI ZAPISU WYKONAWCZEGO

**Bez tej pozycji front nie ma prawa zdjąć ani jednego `disabled` — musiałby
zgadywać, a zgadywanie skończy się przyciskiem, który znowu nie działa.**

Zastane: `GET /initiatives/:initiativeId/capabilities`
(`initiativesExecutionRuntime.routes.ts:2086`). **Zweryfikuj empirycznie, co ten
endpoint dziś zwraca** — instrukcja nie podaje kształtu, bo masz go zmierzyć,
nie przepisać.

Twój produkt:

1. **Odpowiedź, która dla każdej akcji wykonawczej z `B.1` mówi trzy rzeczy:**
   - **czy akcja jest dostępna** dla tego aktora, w tej organizacji, dla tego
     agregatu, w tym stanie;
   - **gdzie zapada odmowa**, jeżeli nie jest — z trzema możliwymi wartościami:
     `BRAMKA_LEGACY` (żądanie poszłoby na `/api/v8/execution-control/*`
     i dostanie `409`), `ZDOLNOŚĆ` (`authorize` odmawia), `STAN_AGREGATU`
     (komenda odrzuci przejście z tego stanu);
   - **kod, który front zobaczy**, gdy mimo to spróbuje.
2. **★ Bez kolumny „gdzie zapada odmowa" kontrakt jest bezużyteczny** — front
   dostałby listę akcji, która nie odpowiada temu, co się realnie stanie po
   kliknięciu. To jest dokładnie ten błąd, który panel wytknął jako drugą
   najcięższą wadę modułu.
3. **Rozszerzenie jest ADDYTYWNE.** Nie zmieniasz kształtu odpowiedzi dla pól,
   które ktoś już czyta. Sprawdź grepem, kto czyta `capabilities` w `src/`,
   i wypisz to w raporcie.
4. **Negatyw tenantа**: `initiativeId` obcej organizacji → `404`, nigdy `403`
   z danymi obiektu, nigdy `200`.
5. **Uczciwy stan „nie wiem":** jeżeli dostępność akcji zależy od decyzji
   właściciela (`E-O4`/`E-O5`) albo od danych, których nie ma — zwracasz
   `DECISION_REQUIRED` / `UNKNOWN` **z powodem**, nigdy `false` udające
   „nie wolno".

**DoD `B.3`:** test tabelaryczny **akcje × role × stany agregatu** na realnym PG
z realnymi wierszami `organization_members`; negatyw tenanta (podwójny — body
i nagłówek kontekstu); test domyślnego okablowania (Z22); **pełna tabela
kontraktu w raporcie**; dowód osiągalności Z21; commit.

---

## §B.4 — KOPERTA 409 MA WSKAZAĆ DOKŁADNĄ KOMENDĘ

Zastane: `executionSpineLegacyReadOnly.middleware.ts:38-43` zwraca

```
{ error: 'Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.',
  code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
  canonicalWriter: '/api/initiatives/runtime-v1' }
```

To jest **uczciwe, ale bezużyteczne**: podaje prefiks, a nie komendę. Klient,
który dostanie tę odpowiedź, wie _że_ ma iść gdzie indziej, ale nie wie _gdzie_.

1. **★ NAJPIERW ROZSTRZYGNIJ, GDZIE WOLNO CI TO ZROBIĆ.** Sam plik middleware
   jest **NIETYKALNY** (Z11/Z17) — to jest strażnik, nie słownik. Masz dwie
   dopuszczalne drogi i **wybierasz jedną, uzasadniając wybór w raporcie**:
   - **(a)** wzbogacenie odpowiedzi **na poziomie routera legacy**
     (`server/src/routes/v8/execution-control.routes.ts`), jeżeli da się to
     zrobić **bez** dotykania middleware i **bez** zmiany statusu `409` ani kodu
     `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`;
   - **(b)** **nowa trasa odczytu w runtime-v1**, która zwraca mapę
     `legacy metoda+ścieżka → kanoniczna komenda`, budowaną z tabeli `B.1`.
     Wtedy `canonicalWriter` zostaje bez zmian, a klient ma dokąd pójść po
     szczegół.
     **Jeżeli obie drogi wymagałyby zmiany w middleware — to jest STOP**,
     z rekomendacją dla nadzorcy, nie Twoja zmiana.
2. **Status `409` i kod `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` są NIETYKALNE.**
   Testy `execution-control.routes.test.ts:216-217` i
   `executionSpineLegacyReadOnly.middleware.test.ts` asertują je dosłownie
   i **mają zostać zielone bez zmiany**.
3. **Weryfikacja, której nikt dotąd nie zrobił:** sprawdź, czy
   `'/api/initiatives/runtime-v1'` jest **realnie osiągalnym prefiksem**.
   Instrukcja twierdzi, że tak (`Gateway.ts:697` + `initiatives.routes.ts:154`)
   — **potwierdź to żądaniem HTTP w teście, nie grepem.** Jeżeli okaże się, że
   klient musi wołać `/api/pmo/initiatives/runtime-v1`, a koperta mówi
   `/api/initiatives/runtime-v1` — **to jest defekt uczciwości i wpisujesz go
   jako znalezisko z dowodem** (obie ścieżki, oba statusy).

**DoD `B.4`:** rozstrzygnięcie (a)/(b) z uzasadnieniem; test dowodzący, że
klient dostający `409` może z otrzymanej informacji **złożyć poprawne żądanie
kanoniczne** i że ono przechodzi; dowód, że oba istniejące testy kontraktu `409`
są nietknięte i zielone; commit.

---

## §B.5 — READ-MODEL AS-OF: rozstrzygnięcie, potem budowa

**To jest najtrudniejsza pozycja dyżuru i jedyna, w której wolno Ci skończyć
uczciwym „częściowo" bez utraty punktu — pod warunkiem, że nazwiesz granicę
dokładnie.**

Zastane: `server/src/domain/initiatives-execution/reportReconstruction.ts`
zwraca **zawsze** `reconstructable: false`, `sources: []` i deterministyczną
listę `gaps` (`:56-58`). Komentarz `:17-22` mówi wprost, dlaczego:

> „Runtime-v1 stores a report run snapshot, but does not provide an
> event-history reader that can resolve every `ReportSource` to its version at
> an arbitrary timestamp. Returning the captured run sources would therefore
> present a current snapshot as historical truth. This read-model deliberately
> refuses that substitution and enumerates the exact gaps deterministically."

**Ta odmowa jest prawidłowa i nie wolno jej „naprawić" skrótem.** Twoim zadaniem
jest **usunąć jej przyczynę**, nie jej objaw.

1. **★ NAJPIERW POMIAR, DOPIERO POTEM KOD.** Ustal empirycznie, na własnej
   bazie, **co dokładnie da się odtworzyć z `ie_audit_events`**:

   ```sql
   -- czy dla agregatu istnieje historia wersji z czasem?
   SELECT aggregate_type, aggregate_id, aggregate_version, command_type, created_at
     FROM ie_audit_events
    WHERE organization_id = $1
    ORDER BY aggregate_type, aggregate_id, aggregate_version;
   ```

   Kolumny są w `932_initiatives_execution_material_commands.sql:82-97`:
   `aggregate_type`, `aggregate_id`, `aggregate_version`, `command_type`,
   `payload_json`, `created_at`, z `UNIQUE (organization_id, aggregate_type,
aggregate_id, aggregate_version)`.

2. **★ ROZSTRZYGNIJ I NAZWIJ TRZY POZIOMY.** Instrukcja **nie** przesądza,
   który dowieziesz — przesądza, że **musisz je rozróżnić i nie wolno Ci ich
   pomylić**:

   | Poziom                                       | Co to znaczy                                                        | Czy `ie_audit_events` wystarczy?                                                                   |
   | -------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | **P1 — WERSJA NA MOMENT**                    | „agregat X miał w chwili `asOf` wersję `n`"                         | **TAK** — `MAX(aggregate_version) WHERE created_at <= asOf`                                        |
   | **P2 — STAN NA MOMENT z odtworzenia komend** | „agregat X wyglądał tak" — replay `payload_json` od wersji 1 do `n` | **ZALEŻY** — tylko jeśli komendy są deterministyczne i pełne; **musisz to udowodnić, nie założyć** |
   | **P3 — STAN NA MOMENT z zapisanych migawek** | odczyt zapisanego stanu per wersja                                  | **NIE** — `ie_aggregate_state` ma PK bez `version` (`:33-41`), trzyma **jeden wiersz na agregat**  |

3. **Kolejność pracy w tej pozycji jest wiążąca:**
   - **(a)** Dowieź **P1** — to jest osiągalne z zastanego schematu i **samo
     w sobie zmienia produkt**: raport może uczciwie powiedzieć „w dniu X
     źródło było w wersji 7, dziś jest w wersji 11", czyli **odpowiedzieć na
     pytanie o dryf**, nawet jeśli nie odtworzy treści.
   - **(b)** Zbadaj wykonalność **P2** i **wpisz werdykt do raportu z dowodem**
     (ile typów komend, ile z nich jest czystymi nadpisaniami, czy istnieje
     komenda niedeterministyczna). **Jeżeli P2 jest wykonalne dla części typów
     agregatów — dowozisz je dla tych typów i nazywasz zakres.**
   - **(c)** **P3 to STOP z rekomendacją**, jeżeli okaże się jedyną drogą.
     Wymagałby migracji dodającej append-only tabelę wersji stanu **i backfillu
     historii, której nie ma** — to jest decyzja architektoniczna nadzorcy, nie
     Twoja. Jeżeli mimo to uznasz, że tabela jest potrzebna i addytywna,
     **przygotowujesz migrację w przedziale `20261200`–`20261209`, dowodzisz
     brak obiektu na świeżej bazie, i NIE robisz backfillu** — historia sprzed
     migracji zostaje uczciwie nieodtwarzalna.
4. **★ Kształt odpowiedzi ma pozostać kompatybilny.** `ReportReconstructionResult`
   (`reportReconstruction.ts:8-15`) ma pola `reconstructable`, `sources`, `gaps`,
   `reconstructedAt`. **Rozszerzasz addytywnie** — nowe pole poziomu
   rekonstrukcji, nowe pole wersji per źródło. **`gaps` nie może zniknąć**:
   źródło, którego nie odtworzysz, **nadal ma trafić do `gaps`** z powodem.
   Częściowa rekonstrukcja to `reconstructable: true` **plus niepusta lista
   `gaps`**, nigdy `gaps: []` na wyrost.
5. **★ Trzy zakazy tej pozycji, każdy = odrzucenie:**
   - **nie zwracasz bieżącej migawki** jako odpowiedzi na `asOf` (Z23 pkt 4);
   - **nie nadpisujesz zapisanego runu** — runy `PUBLISHED_SNAPSHOT` są
     niezmienne (`MODULE_ACCEPTANCE.md:280`), rekonstrukcja **czyta**;
   - **nie usuwasz walidacji `AS_OF_INVALID_OR_FUTURE`** (`:29-31`) ani
     odrzucenia `asOf` z przyszłości w handlerze (`:4801`).
6. **Kontrola tenanta zostaje jak jest**: handler bierze run z
   `listReportRuns(actor.organizationId)` i sprawdza `canViewAggregate`
   (`:4808-4812`), zwracając `404` dla obcego. **Twój czytnik historii MUSI
   filtrować `organization_id` w każdym zapytaniu** — `ie_audit_events` ma tę
   kolumnę i indeks w kluczu unikalnym.

**DoD `B.5` (wyższe minimum):** **pierwszy w module test `.pg.test.ts` dla
ścieżki as-of** (dziś nie istnieje żaden); test, w którym agregat ma **co
najmniej trzy wersje o różnych `created_at`**, a zapytanie o `asOf` między
wersją 2 a 3 zwraca **wersję 2**, nie 3 i nie bieżącą; test `asOf` **przed
pierwszym zdarzeniem** → `gap` z powodem `NO_EVENT_HISTORY_BEFORE_AS_OF`,
nigdy pusty sukces; test `asOf` z przyszłości → `400`; test negatywu tenanta
(run obcej organizacji → `404`); **jawna deklaracja poziomu P1/P2/P3 z zakresem
typów agregatów**; dowód, że zapisany run jest niezmieniony (`SELECT` przed
i po); dowód osiągalności Z21; commit.

---

## §B.6 — PIĘĆ RODZIN MIAR NIEZALEŻNYCH OD DECYZJI WŁAŚCICIELA

Zastane: `controlKpiReadModel.ts:49-63` — **każda** z ośmiu rodzin zwraca
`numerator: null, denominator: null, value: null`. `POLICY_DEPENDENCIES`
(`:22-26`) wiąże z polityką **dokładnie trzy** rodziny. Pozostałe **pięć nie
zależy od żadnej odpowiedzi Piotra** i jest zwyczajnie niepoliczone:

| Rodzina                      | Zależy od `E-O4`/`E-O5`?                              | Twoja pozycja |
| ---------------------------- | ----------------------------------------------------- | ------------- |
| `plan-delivery`              | **NIE**                                               | **B.6**       |
| `blocked-work`               | **NIE**                                               | **B.6**       |
| `milestone`                  | **NIE**                                               | **B.6**       |
| `dependency`                 | **NIE**                                               | **B.6**       |
| `intervention-effectiveness` | **NIE**                                               | **B.6**       |
| `initiative-risk`            | TAK (`impactWeights`, `atRiskThresholdDays`)          | B.7           |
| `capacity`                   | TAK (`capacitySaturationThreshold`, `capacityBuffer`) | B.7           |
| `decision-latency`           | TAK (`decisionSlaDays`)                               | B.7           |

1. **Dla każdej z pięciu rodzin ustal i udokumentuj wzór PRZED napisaniem
   zapytania**: co jest licznikiem, co mianownikiem, z jakiej tabeli, z jakim
   filtrem `organization_id`, z jakim oknem tygodniowym (`weekStart` przychodzi
   w formacie `YYYY-MM-DD`, walidowany `:4868`).
2. **★ Wzór idzie do raportu jako TEKST, przed kodem.** Kontrakt modułu wymaga
   „current value, numerator/denominator, comparison with the previous
   equivalent period, calculation timestamp and an exact drill-down set"
   (`MODULE_ACCEPTANCE.md:135`). Miara bez jawnego wzoru jest nieweryfikowalna.
3. **★ `UNKNOWN ≠ 0`.** Jeżeli mianownik jest zerowy (organizacja bez pracy
   w danym tygodniu), rodzina zwraca **uczciwy pusty stan z powodem**, nie
   `value: 0`. To jest wzorzec, który panel wskazał jako **jedyną dobrze
   zbudowaną rzecz w module**: „model pomiaru `workReportModel` dobrze
   zbudowany (`MetricValue` `UNKNOWN≠0` — wzorzec do rozciągnięcia)"
   (`DEC-120`). **Rozciągasz go, nie wymyślasz nowego.**
4. **★ Nie budujesz drugi raz tego, co działa.** SPI/CPI/EAC/VAC/RAG mają
   działającą implementację w `evmService.ts:67`, burn rate w
   `executionBudgetService.ts:331-350`, health score w
   `canonicalExecutionHealthService.ts:53`. **Jeżeli któraś z pięciu rodzin
   sprowadza się do już policzonej wielkości — wołasz istniejący serwis
   i zapisujesz to w raporcie.** Zduplikowany wzór to dwie prawdy o tej samej
   liczbie.
5. **★ Nie wprowadzasz miar, których nikt nie zamówił.** `scheduleVariance`,
   `cycleTime`, `throughput`, `blockedRate` **nie istnieją w module w żadnej
   postaci** (§1.2 poz. 14) i **nie są w zakresie**. Osiem rodzin to osiem
   rodzin.
6. **Porównanie z poprzednim okresem** (`MODULE_ACCEPTANCE.md:135`) — jeżeli
   dane pozwalają, dowozisz; jeżeli nie, zwracasz **jawny `UNKNOWN` z powodem**
   `BRAK_HISTORII`, nigdy `delta: 0`.
7. **Wydajność:** liczysz **jednym zapytaniem na rodzinę albo mniej**, nie
   pętlą po inicjatywach. Panel wytknął modułowi N+1 („30 realizacji =
   61 równoległych żądań"). **Nie dokładasz drugiego.**

**DoD `B.6` (wyższe minimum):** wzór każdej z pięciu rodzin **wypisany słownie
w raporcie przed kodem**; test na realnym PG z **zaseedowanym, znanym stanem**,
w którym licznik i mianownik mają **z góry wyliczone ręcznie wartości** i test
je asertuje (nie „nie-null", tylko konkretną liczbę); test pustej organizacji →
uczciwy pusty stan z powodem, **nigdy zero**; test negatywu tenanta (dane obcej
organizacji nie wchodzą do licznika — sprawdzasz to seedując **dwie**
organizacje); dowód osiągalności Z21; commit per rodzina **albo** jeden commit
z pięcioma rodzinami i pięcioma testami — ale **nie jeden commit bez testów**.

---

## §B.7 — AUTORSTWO POLITYKI PROGÓW: żeby `E-O4`/`E-O5` dało się WPROWADZIĆ

**To jest pozycja, która odblokowuje trzy pozostałe rodziny miar bez
podejmowania decyzji za właściciela.**

Zastane, i to jest sedno:

- tabela `execution_control_kpi_policies` **istnieje**
  (`20261077_day17_execution_control_kpi_policy.sql`), jest tenant-scoped,
  ma `parameters JSONB` i `row_version`;
- migracja mówi wprost: „No default policy is seeded: thresholds and weights
  remain an owner decision" (`:1-2`);
- **`grep -rn "execution_control_kpi_policies" server/src` daje JEDNO
  trafienie — `controlKpiReadModel.ts:35`, ODCZYT.**

Czyli: **nawet gdyby Piotr dziś odpowiedział na `E-O4` i `E-O5`, nie ma
żadnego sposobu, żeby te wartości trafiły do systemu.** Trzy rodziny miar
pozostaną `DECISION_REQUIRED` **na zawsze**, niezależnie od decyzji.

1. **Budujesz komendę autorstwa polityki** w runtime-v1, wzorcem
   `materialCommand` (CAS na `row_version`, idempotencja, audyt w transakcji).
   Kształt: organizacja + nazwa + `parameters` z pięcioma polami
   z `REQUIRED_POLICY_PARAMETERS` (`controlKpiReadModel.ts:14-20`).
2. **★ ZERO WARTOŚCI DOMYŚLNYCH. ZERO SEEDU.** Komenda **przyjmuje** wartości
   od użytkownika; **nie proponuje ich, nie uzupełnia brakujących, nie ma
   fallbacku**. Polityka niekompletna zapisuje się jako niekompletna
   i rodziny od niej zależne **nadal zwracają `DECISION_REQUIRED`** — dokładnie
   tak, jak dziś liczy to `:41-45` i `:53-55`. **Zaszycie choćby jednej
   wartości domyślnej = odrzucenie pozycji** (Z12).
3. **Walidacja jest strukturalna, nie merytoryczna.** Sprawdzasz, że
   `atRiskThresholdDays` jest dodatnią liczbą całkowitą — **nie** sprawdzasz,
   czy to 7 czy 14. Zakres dopuszczalnych wartości to **decyzja właściciela**,
   nie Twoja walidacja.
4. **Odczyt polityki już działa** (`controlKpiReadModel.ts:31-40`, filtr
   `organization_id = $1 AND policy_id = $2`). **Nie zmieniasz go**, chyba że
   test wykaże defekt — wtedy z dowodem.
5. **Trzy rodziny policy-zależne liczysz WYŁĄCZNIE gdy `policy.resolved === true`**
   (`:66-68`: `Boolean(policyRow) && missingParameters.length === 0`).
   Przy `resolved: false` rodzina **zostaje** `DECISION_REQUIRED`
   z listą `missingParameters`. Ta logika już istnieje — **Twoim zadaniem jest
   dopisać liczenie po stronie `true`, nie ruszać strony `false`.**
6. **★ Ta pozycja nie ma frontu i to jest w porządku.** Ekran wprowadzania
   polityki zbuduje osobny dyżur frontowy. Dopóki go nie ma, ostatnim ogniwem
   Z21 jest **koperta HTTP** i **wpisujesz to wprost** — nie dopisujesz
   konsumenta w `src/`, żeby ogniwo domknąć (Z18).
7. **Migracja tylko jeśli udowodnisz brak.** Tabela istnieje i ma
   `row_version`; sprawdź `\d execution_control_kpi_policies` na swoim
   kontenerze **przed** utworzeniem jakiegokolwiek pliku migracji. **Drugiej
   tabeli polityk nie tworzysz.**

**DoD `B.7` (wyższe minimum):** komenda zapisu polityki z CAS na `row_version`
i idempotencją; test, w którym polityka **niekompletna** zostaje zapisana,
a `GET /control-kpis` **nadal** zwraca `DECISION_REQUIRED` dla trzech rodzin
z listą `missingParameters`; test, w którym polityka **kompletna** sprawia,
że te trzy rodziny **przestają** być `DECISION_REQUIRED` i mają licznik
i mianownik; **dowód pustego grepa: zero literałów progowych w Twoim diffie**
(`git diff 5cfa62470e...HEAD -- <Twoje pliki> | grep -nE '\b(7|14|30|0\.[0-9]+|80|90)\b'`
— każde trafienie wyjaśnione w raporcie); negatyw tenanta; negatyw zdolności;
commit.

---

## §B.8 — PROWENIENCJA MIAR: koniec `ids: []`, `sourceVersion: 0`, `'PARTIAL'`

Zastane (`controlKpiReadModel.ts:60-61,70`):

```
drillDown: { kind: family, ids: [] as string[] },
sourceVersion: 0,
…
scopeCompleteness: 'PARTIAL' as const,
```

Trzy wartości **zaszyte na sztywno**, identyczne dla każdej rodziny i każdej
organizacji. Kontrakt modułu wymaga czegoś dokładnie odwrotnego:

> „Every KPI exposes current value, numerator/denominator, comparison with the
> previous equivalent period, calculation timestamp and **an exact drill-down
> set**." (`MODULE_ACCEPTANCE.md:135`)
> „Every number drills down to source identity/version, capture time,
> transformation and value class (`SOURCE`, `CALCULATED`, `MANUAL`, `AI`,
> `UNKNOWN`)." (`:282`)

1. **`drillDown.ids`** — dla każdej policzonej rodziny **dokładny zbiór
   identyfikatorów**, które weszły do licznika. Nie próbka, nie limit 10.
   Jeżeli zbiór jest zbyt duży, żeby go zwrócić w kopercie — **to jest STOP
   z rekomendacją** (stronicowanie to zmiana kontraktu), nie ciche obcięcie.
   **`ids: []` dla rodziny z niezerowym licznikiem = atrapa** (Z23 pkt 3).
2. **★ `ids` to identyfikatory INICJATYW, nie `executionCaseId`** — tożsamość
   biznesowa (`EXE-OWN-002`, inwariant `MODULE_ACCEPTANCE.md:117-118`). Jeżeli
   licznik liczy zadania albo decyzje, `drillDown` musi umieć doprowadzić do
   kanonicznej Karty Inicjatywy (inwariant pkt 5, `:123`).
3. **`sourceVersion`** — realna wersja źródła, z którego policzono miarę
   (`ie_aggregate_state.version` albo `MAX(aggregate_version)` z `B.5` P1).
   **`0` zostaje wyłącznie tam, gdzie miary nie policzono.**
4. **`scopeCompleteness`** — ma odróżniać trzy sytuacje: pełny zakres,
   zakres z wyłączeniami (i **jakimi**), zakres niepoliczalny. Zaszyte
   `'PARTIAL'` mówi frontowi tyle samo co nic.
5. **Klasa wartości** (`SOURCE` / `CALCULATED` / `MANUAL` / `AI` / `UNKNOWN`,
   `:282`) — jeżeli dokładasz to pole, robisz to **addytywnie** i dla
   **wszystkich** ośmiu rodzin, żeby front nie musiał zgadywać, kiedy pole
   jest, a kiedy go nie ma.
6. **`calculatedAt` już istnieje** (`:47`, `:62`, `:71`) — **nie ruszasz**.

**DoD `B.8`:** test, w którym zaseedowany stan daje **znaną z góry listę
identyfikatorów** i asercja porównuje **cały zbiór**, nie jego długość;
test, w którym rodzina niepoliczona **nadal** ma `ids: []` i `sourceVersion: 0`
(uczciwie); test, w którym `scopeCompleteness` przyjmuje **różne** wartości dla
różnych stanów danych; dowód, że `drillDown.ids` prowadzą do istniejących
inicjatyw (readback niezależnym poolem); commit.

---

## §B.9 — DOWÓD BRAKU ATRAPY DLA NOWYCH KOMEND

**Pozycja czysto dowodowa. Nie dodaje funkcji — udowadnia, że to, co dodałeś
w `B.2` i `B.7`, jest prawdziwe.** Bez niej `B.2` i `B.7` nie dostaną
`ZROBIONE_WG_DoD`.

Dla **każdej** komendy dodanej w tym dyżurze dowodzisz **wszystkich pięciu**:

1. **CAS działa.** Dwa równoległe żądania z tym samym `expectedVersion`:
   pierwsze `2xx`, drugie **odrzucone konfliktem**, a w bazie **jedna** zmiana.
   Dowód: `SELECT version FROM ie_aggregate_state …` przed i po,
   **niezależnym poolem**. Sam fakt, że pole `expectedVersion` jest przyjmowane,
   **nie jest dowodem** (Z23 pkt 2).
2. **Idempotencja działa.** Ten sam `clientRequestId` dwa razy → **jeden**
   obiekt, ten sam kształt odpowiedzi. Różne `clientRequestId` → **dwa**
   obiekty. Dowód: `SELECT COUNT(*) FROM ie_command_receipts WHERE
organization_id=… AND client_request_id=…` oraz licznik agregatów.
3. **Audyt jest w tej samej transakcji.** Wymuszona awaria zapisu →
   **ZERO** wierszy w `ie_audit_events`. Odrzucenie przez walidację →
   **ZERO** wierszy. Sukces → **dokładnie jeden** wiersz z właściwym
   `aggregate_version`. **Ślad audytu bez mutacji albo mutacja bez śladu =
   atrapa z zewnętrznym skutkiem.**
4. **Negatyw tenanta jest szczelny.** Obca organizacja **w body ORAZ
   w nagłówku kontekstu** → `404` (fail-closed), **zero wierszy**.
   **Seedujesz dwie organizacje** — test na jednej niczego nie dowodzi.
   To jest klasa, w której partia A znalazła realny wyciek (`DEC-128`, `A6`).
5. **Negatyw zdolności jest szczelny.** Aktor bez wymaganej zdolności →
   odmowa, **zero wierszy w `ie_aggregate_state` i zero w `ie_audit_events`**.
   **Role ustawiasz realnym wierszem `organization_members`**, nie
   wstrzyknięciem do `req.user` — inaczej bramki nie zadziałają i pomiar
   będzie fikcją (Z22).

**★ Sprzątanie jest częścią DoD tej pozycji.** `ie_audit_events` jest
append-only. Twój test usuwa **dokładny zasięg swojej organizacji przed
usunięciem organizacji** (wzorzec: `executionActionRegistryService.pg.test.ts`,
lekcja `EXE-PF-002`). Po pełnym przebiegu podajesz w raporcie:
`SELECT COUNT(*) FROM ie_audit_events WHERE organization_id LIKE '<Twój prefiks>%'`
→ **musi być `0`**.

**DoD `B.9`:** tabela pięciu dowodów **per komenda**, z dosłownymi liczbami
przed i po, z niezależnego poola; dowód zerowej pozostałości; commit.

---

## §B.10 — TRZY KONKURENCYJNE DEFINICJE „OŚMIU MIAR"

**Pozycja ustaleniowa. Nie rozstrzygasz jej — dokumentujesz z dowodem
i przekazujesz nadzorcy.**

W repozytorium żyją **trzy różne ósemki**, każda podana jako kanoniczna:

| Źródło                                                                                                   | Osiem czego                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kontrakt właściciela** — `MODULE_ACCEPTANCE.md:135` (`EXE-OWN-006`, „Core KPI contract")               | overdue tasks · overdue decisions · impact-weighted backorder · at-risk commitments within seven days · active blocks and blocked days · median/P90 decision latency · throughput-to-inflow ratio · data completeness |
| **Kontrakt raportu Sterowania** — `MODULE_ACCEPTANCE.md:258` („Report layout")                           | plan-delivery · blocked-work · milestone · initiative-risk · dependency · capacity · decision-latency · intervention-effectiveness                                                                                    |
| **Implementacja dnia 11** — `EXECUTION_DAY11_REPORT_20260825.md:113-124` („Executive Pulse — osiem KPI") | overdue tasks · overdue decisions · **due today** · at-risk 1–7 dni · active blocks · **undated risk** · decision latency (`BRAK_API`) · data completeness                                                            |
| **Kod backendu** — `controlKpiReadModel.ts:3-12`                                                         | identyczna z drugą pozycją tabeli                                                                                                                                                                                     |

Rozjazd jest realny i udokumentowany: dzień 11 sam zapisał, że **podmienił**
`impact-weighted backorder` i `throughput-to-inflow` na `due today`
i `undated risk`, bo pierwszych dwóch nie da się policzyć z zastanego
read-modelu (`EXECUTION_DAY11_REPORT_20260825.md:126-131`). Pełny słownik
formuł kanonicznych żyje osobno w `MODULE_ACCEPTANCE.md:177-186`.

1. **Twoje ustalenie:** tabela czterech kolumn (nazwa miary × cztery źródła ×
   „czy policzalna z dzisiejszego schematu" × „czy zależy od `E-O3`/`E-O4`/`E-O5`"),
   z `plik:linia` przy każdym twierdzeniu.
2. **Twoja praca w `B.6`/`B.7` dotyczy ósemki z `controlKpiReadModel.ts`** —
   bo to jedyna, która ma **osiągalny endpoint** (`GET /control-kpis`) i jest
   po stronie tylnej. **Napisz to wprost w raporcie**, żeby nikt nie odczytał
   Twojej pracy jako domknięcia kontraktu `EXE-OWN-006`.
3. **★ Nie ujednolicasz list.** Wybór, która ósemka jest kanoniczna, dotyka
   tego, co właściciel zobaczy na ekranie raportu zarządczego —
   to jest **decyzja produktowa Piotra**, nie refaktor. Wpisujesz to jako
   **rekomendację + pytanie do rejestru decyzji**, nie jako commit.

**DoD `B.10`:** tabela czterech źródeł z dowodami `plik:linia`; jawne zdanie
o tym, którą ósemkę Twój dyżur faktycznie zbudował; rekomendacja dla nadzorcy;
commit (dokumentacyjny).

---

## §R.1 — `MODULE_ACCEPTANCE.md` 06_EXECUTION DO STANU FAKTYCZNEGO

Plik `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md`
(309 linii) **nie był aktualizowany po panelu i po partii A** — nie ma w nim
ani `DEC-2026-08-26-120`, ani `DEC-2026-08-26-128`.

1. Dopisujesz **wyłącznie stan faktyczny**, w konwencji zastanej pliku
   (angielski, tabele `G00–G20`, rejestr obserwacji preflight).
2. Nowe obserwacje numerujesz **od `EXE-PF-007`** (najwyższe zastane:
   `EXE-PF-006`, `:100`). **Nie numerujesz `EXE-OWN-*`** — te ID należą do
   wypowiedzi właściciela, a Piotr nic nowego nie powiedział.
3. **Nie zmieniasz werdyktu właściciela** (`:305-309`: `Decision: PENDING`).
   **Nie podnosisz `Current gate`** (`:5`).
4. **Nie kasujesz otwartych pozycji** — `EXE-PF-004`
   (`OPEN_NONBLOCKING_FIXTURE_HYGIENE`), `EXE-OWN-006`/`EXE-OWN-007`
   (`NOT_IMPLEMENTED`), `G08–G14` i `G17–G20` (`NOT_STARTED`) zostają jak są,
   chyba że **Twoja praca faktycznie je zamknęła** — i wtedy z dowodem.
5. Wpisujesz **jawnie**, czego ten dyżur **nie** dotknął: front, flaga
   `execReportsIntelligence`, generator raportów, `E-O3`/`E-O4`/`E-O5`.

---

## §R.2 — RAPORT

Patrz §9.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~120 min, NIE pomijasz)

Marker → weryfikacja wejściowa (a)–(i) → kontener `5556` + pełne migracje +
sześć `to_regclass` → dowód celu połączenia → baseline §0.4a → ustalenie
`REAL_PG` i pomiar różnicowy → **bramka wejściowa (dwustronny kontrakt)** →
inwentarz endpointów i konsumentów → sprawdzenie numeracji migracji.

**Bez bramki wejściowej nie zaczynasz nic.**

### Blok 1 — mapa (B.1)

`B.1` jest **denominatorem** dla `B.2`, `B.3` i `B.4`. Robisz ją w całości,
zanim napiszesz pierwszą linię komendy. Jeżeli `B.1` wykaże, że wszystkie pięć
grup ma już komendę runtime-v1 — `B.2` staje się `BRAK_POTRZEBY` i przechodzisz
prosto do `B.3`.

### Blok 2 — zapisy (B.2 → B.3 → B.4)

Najpierw komendy, potem kontrakt zdolności (bo opisuje komendy), na końcu
uczciwa koperta `409` (bo wskazuje komendy). Odwrotna kolejność produkuje
kontrakt opisujący coś, czego jeszcze nie ma.

### Blok 3 — as-of (B.5)

Pozycja samodzielna, najtrudniejsza. **Pomiar → rozstrzygnięcie P1/P2/P3 →
dopiero kod.** Wolno ją skończyć na P1 z uczciwie nazwaną granicą.

### Blok 4 — miary (B.6 → B.7 → B.8)

`B.6` (pięć rodzin bez decyzji) → `B.7` (nośnik polityki, odblokowuje trzy
pozostałe) → `B.8` (proweniencja dla wszystkich ośmiu). `B.8` **musi** być po
`B.6` i `B.7`, bo dopiero wtedy jest co rozwijać do drill-downu.

### Blok 5 — dowód (B.9)

Po wszystkich komendach. Pozycja czysto dowodowa; bez niej `B.2` i `B.7` nie
dostaną `ZROBIONE_WG_DoD`.

### Blok 6 — ustalenie (B.10)

Dokumentacyjna, można wykonać w dowolnym momencie po `B.6`.

### Blok 7 — domknięcie (obowiązkowo, ~90 min)

1. Pełny pomiar §0.4a na `HEAD` (z `REAL_PG`), tabela ZASTANE / WPROWADZONE.
2. **Dowód, że bezpieczniki są nietknięte — komenda MUSI dać pusty wynik:**

   ```bash
   git diff 5cfa62470e...HEAD -- \
     server/src/middleware/executionSpineLegacyReadOnly.middleware.ts \
     server/src/Gateway.ts \
     server/src/routes/v8/index.ts \
     server/src/routes/pmo/initiatives.routes.ts \
     server/src/services/effectiveAccessService.ts \
     server/src/middleware/effectiveCapability.middleware.ts \
     server/src/controllers/ExecutionController.ts \
     server/src/middleware/v8FeatureGate.middleware.ts \
     server/src/services/v8/featureFlagService.ts \
     src/ \
     tests/
   ```

3. **Dowód zerowej pozostałości w bazie** (`SELECT COUNT(*)` z `ie_audit_events`
   i `ie_aggregate_state` dla Twojego prefiksu organizacji → `0`).
4. `git diff --check`; komenda bazowa; `R.1`; `R.2`.
5. Sprzątanie kontenera **i wolumenów** (`docker rm -fv`, **nigdy**
   `docker volume prune`).

### Zasada nadrzędna kolejności

**Lepiej sześć pozycji `ZROBIONE_WG_DoD` niż dziesięć `CZĘŚCIOWO`.**
Uczciwe `NIE_ZACZĘTE` jest w tym programie warte więcej niż rozmyte
„zrobione po łebkach". Kończysz w kolejności bloków i piszesz prawdę.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka (dokładnie jedna, Z13):
`docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY31_REPORT_20260828.md`

### 9.1. Szablon

```markdown
# Realizacja dzień 31 (blok B) — raport dyżuru <data>

Baza związana: 5cfa62470e (`codex/m03-admin-20260824`); tip kontrolny po fetchu: <sha>.
Marker: 5cfa62470e — POTWIERDZONY / BRAK (`merge-base --is-ancestor`, exit <n>).
Gałąź: `codex/execution-day31-<data>` · worktree: `/private/tmp/consultify-execution-day31`.
Port PG: 5556 · kontener: `cx-day31-pg` (`pgvector/pgvector:pg16`) · baza `cx_day31`.
Poziom ukończenia: CODE_PRESENT / TECHNICAL_PASS.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<jedno zdanie: brak odczytu/zapisu w /Users/piotrwisniewski/Developer/Consultify poza symlinkiem node_modules; brak połączeń z demo/staging/produkcją/Railway; brak push/merge/rebase; brak kontaktu z cudzymi worktree i cudzymi kontenerami 5511/5544/5474>

## Dowód celu połączenia (Z20/DEC-96)

<dosłowny wynik SELECT current_database(), inet_server_port() + dosłowna linia docker run z -p 5556:5432>
<uwaga: NULL w inet_server_port przy docker exec jest oczekiwany>
<wynik sześciu to_regclass z BLOK 0 pkt 4>

## ★ WERYFIKACJA ERRATY §1.2 — czternaście punktów

| # | Teza instrukcji | Potwierdzona? | Dowód (komenda + wynik) |
<14 wierszy — POTWIERDZONA / OBALONA / SKORYGOWANA>

## Warunki wstępne — tabela

<dziewięć komend (a)-(i) z §0.1 pkt 4: oczekiwane vs faktyczne>
<migracje: zastosowane / błędy / drugi przebieg>

## ★★ BRAMKA WEJŚCIOWA — dwustronny kontrakt (BLOK 0 pkt 8)

| Strona | Żądanie | Status + kod | Werdykt |
<sześć wierszy z tabeli BLOK 0 pkt 8>
<jawne zdanie: bramka PRZESZŁA / NIE PRZESZŁA — i co z tego wynika dla reszty dyżuru>
<dowód, że executionSpineLegacyReadOnly.middleware.test.ts i execution-control.routes.test.ts są nietknięte i zielone>

## ★ USTALENIE REAL_PG (BLOK 0 pkt 7)

<dosłowna linia z initiativeRuntimeExecutionSeam.pg.test.ts:26 + nazwa zmiennej>
| Pakiet | bez REAL_PG: PASS/FAIL/SKIP | z REAL_PG: PASS/FAIL/SKIP | Ile było pomijane |

## ★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW (BLOK 0 pkt 9)

| METODA | ścieżka | handler plik:linia | mutuje? | za bramką 409? | wołający w src/ (plik:linia) albo BRAK | pozycja dyżuru |
<pełna tabela; na końcu: liczba tras runtime-v1 i mutujących — moja liczba vs 135/70 z instrukcji>

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit | Dowód | Poziom |
<12 wierszy: B.1 B.2 B.3 B.4 B.5 B.6 B.7 B.8 B.9 B.10 R.1 R.2>

## ★ DOWODY OSIĄGALNOŚCI (Z21/DEC-104) — obowiązkowe dla KAŻDEJ pozycji

<per pozycja: pełna ścieżka wejście → montaż → bramki → handler → komenda → tabela → odczyt → konsument w src/ ALBO jawne „brak konsumenta">

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z22/DEC-107)

<lista testów + dowód, że montują `export default` z initiativesExecutionRuntime.routes.ts:5956, a NIE fabrykę z własnym deps>
<co dokładnie mockują + uzasadnienie każdego mocka poza auth.middleware i Logger>

## Tabele werdyktów

### B.1 — mapa przepięcia | Grupa | Front plik:linia | Zapis legacy (metoda+ścieżka+handler) | Komenda runtime-v1 albo BRAK_API | Trasa odczytu | Dowód |

### B.1b — akcje NIETKNIĘTE | Akcja | Dowód, że nadal działa |

### B.2 — nowe komendy | Komenda | Agregat | expectedVersion? | clientRequestId? | Tabela zapisu | Test |

### B.3 — zdolności | Akcja | Rola org | Stan agregatu | Dostępna? | GDZIE ZAPADA ODMOWA | Kod |

### B.4 — koperta 409 | Wybrana droga (a)/(b) | Uzasadnienie | PRZED (kształt) | PO (kształt) | Dowód, że 409 i kod nietknięte |

### B.5 — as-of | Poziom P1/P2/P3 | Typ agregatu | Odtwarzalne? | Dowód | Co trafiło do gaps i dlaczego |

### B.6 — pięć rodzin | Rodzina | Wzór (słownie) | Licznik | Mianownik | Źródło (tabela) | Pusta org → co zwraca |

### B.7 — polityka | Parametr | Walidacja strukturalna | Wartość domyślna? (MUSI być: BRAK) | Rodzina odblokowana |

### B.7b — dowód braku progów | Trafienie grepa liczb w moim diffie | Wyjaśnienie |

### B.8 — proweniencja | Rodzina | drillDown.ids (pełny zbiór) | sourceVersion | scopeCompleteness | Dowód readbackiem |

### B.9 — brak atrapy | Komenda | CAS: 1. odp / 2. odp / wierszy | Idempotencja: ten sam klucz → obiektów | Audyt: awaria → zdarzeń | Tenant: obcy → status | Zdolność: brak → wierszy |

### B.10 — trzy ósemki | Miara | Kontrakt :135 | Layout :258 | Dzień 11 | Kod | Policzalna dziś? | Zależy od E-O? |

## ★ KONTRAKT DLA FRONTU (produkt §1.6)

<tabela: pięć wyłączonych akcji → dokładna komenda runtime-v1 (metoda, ścieżka, body, expectedVersion, clientRequestId) albo BRAK_API>
<tabela zdolności z kolumną „gdzie zapada odmowa" (B.3)>
<kształt odpowiedzi /control-kpis po zmianach: drillDown, sourceVersion, scopeCompleteness, valueReason>
<kształt odpowiedzi rekonstrukcji as-of: poziom, wersja per źródło, gaps>
<kształt komendy autorstwa polityki (B.7) — dla przyszłego ekranu ustawień>
<jawne zdanie: front NIE jest w zakresie tego dyżuru; ŻADEN `disabled` nie został zdjęty; przyciski przepnie osobny dyżur frontowy za flagą OFF, z własnymi zrzutami i wewnętrznym polish-passem, i dopiero potem Piotr zobaczy je do akceptu, pojedynczo (CLAUDE.md reguły 7 i 9)>

## Decyzje właścicielskie — POZA ZAKRESEM, nienaruszone

<jawne zdanie: E-O3 (taksonomia BSC), E-O4 (wagi wpływu, próg at-risk, SLA decyzji) i E-O5 (źródło dostępności, progi saturacji, bufor) czekają na Piotra od 25.08 i ten dyżur ICH NIE DOTYKA>
<lista wszystkiego, co w moim kodzie pozostaje DECISION_REQUIRED z ich powodu>
<dowód, że nie zaszyłem żadnej wartości: wynik grepa liczb w moim diffie>

## Migracje

<numer i nazwa ALBO „brak migracji"; dowód \d PRZED plikiem; MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED; dowód, że przedział 20261200-09 był pusty>

## ★ POMIAR TESTÓW (Z24) — PEŁNY zakres §0.4a

### Zakres §0.4a: X/Y PASS, S SKIPPED

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik

### Czerwone WPROWADZONE — per plik + SHA commitu, który je zapalił

### SKIPPED z powodu env (w tym: ile z powodu REAL_PG)

### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 7)

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

### Jawne zdanie: NIE przepisałem 137/137 z dnia 11 ani „78 PASS" z DEC-128 — zmierzyłem sam

## ★ Dowód braku atrapy (Z23)

<per komenda: SELECT COUNT(*) przed i po, z niezależnego poola>

## ★ Higiena danych (EXE-PF-002)

<SELECT COUNT(*) FROM ie_audit_events / ie_aggregate_state dla mojego prefiksu organizacji → 0>

## Bezpieczniki — dowody (pusty diff)

<wynik komendy z Bloku 7 pkt 2 — MUSI być pusty; w szczególności ZERO zmian w src/ i ZERO w middleware bramki>

## Errata i korekty wobec instrukcji

<każda rozbieżność, którą znalazłeś>

## Znaleziska (NIE naprawiane przeze mnie)

<w tym OBOWIĄZKOWO: równoległe serie numeracji migracji (3-cyfrowa vs 8-cyfrowa); polski string 'BRAK_ŹRÓDŁA' obok angielskiego 'DECISION_REQUIRED' w controlKpiReadModel.ts:59; brak endpointów archiwizacji/usuwania z kebaba ExecutionHub.tsx:2836-2886; N+1 przy otwieraniu raportu; cokolwiek jeszcze>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## Licznik (12 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / BRAK_POTRZEBY / NIE_ZACZĘTE)

## Kontrola zakresu i cleanup

<git diff --check; komenda bazowa; docker rm -fv + volume rm + dowód pustki; potwierdzenie, że NIE użyłem docker volume prune>

## Czego NIE zrobiłem i dlaczego

## Gotowość

<jedno zdanie: co nadzorca może scalić, a czego nie>
```

### 9.2. Zasady raportowania

1. **Liczby, nie przymiotniki.** „Dodano komendę" nic nie znaczy.
   „`POST /interventions/:id`: PRZED — akcja kończyła się `409` w 100%
   przypadków, 0 wierszy w `ie_aggregate_state`; PO — `201`, 1 wiersz
   `aggregate_type='intervention'` w wersji 1, 1 wiersz w `ie_audit_events`,
   powtórzenie tego samego `clientRequestId` → nadal 1 wiersz (readback
   niezależnym poolem)" znaczy wszystko.
2. **Dosłowne wyniki komend**, nie parafrazy. `stdout` w bloku `text`.
3. **Każde twierdzenie ma `plik:linia` albo komendę.** Twierdzenie bez dowodu
   jest traktowane jak jego brak.
4. **Uczciwe `NIE_ZACZĘTE` > rozmyte `CZĘŚCIOWO`.**
5. **Nie przepisujesz cudzych liczb.** Ani `137/137` z dnia 11, ani „78 testów
   PASS" z `DEC-128`. Mierzysz sam.
6. **Nie chwalisz się i nie tłumaczysz.** Raport jest protokołem, nie esejem.

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM (uwaga na plik 5956-liniowy, §0.3)
npx prettier --write <pliki tego commita>

# typy punktowo (NIGDY pełny tsc)
npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run <plik>

# ★ test celowany Z bazą — ZAWSZE tak (Z20), SZEŚĆ zmiennych W TEJ SAMEJ LINII
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true \
npx vitest run --config server/vitest.config.ts <plik> --no-file-parallelism
# + zmienna REAL_PG ustalona w BLOK 0 pkt 7, jeśli plik ma describe.skipIf(!REAL_PG)

# numeracja migracji — PRZED KAŻDYM NOWYM PLIKIEM, TYLKO 20261200-20261209
ls server/migrations | grep '^202612'                                # MUSI być puste
ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5

# migracje — jednorazowy kontener
docker run -d --name cx-day31-pg -e POSTGRES_PASSWORD=cx -p 5556:5432 pgvector/pgvector:pg16
docker exec cx-day31-pg psql -U postgres -c "CREATE DATABASE cx_day31;"
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5556/cx_day31" DB_TYPE=postgres NODE_ENV=test \
  npx tsx server/src/db/migrate.postgres.ts
docker exec cx-day31-pg psql -U postgres -d cx_day31 -c "SELECT current_database(), inet_server_port();"

# sprzątanie (obowiązkowe) — NIGDY docker volume prune
docker rm -fv cx-day31-pg
docker volume ls -q | grep cx-day31 | xargs -r docker volume rm
docker ps -a --filter name=cx-day31-pg          # MUSI być puste

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only 5cfa62470e...HEAD

# dowód, że nie zaszyłem progów (B.7)
git diff 5cfa62470e...HEAD -- server/src | grep -nE '\b(7|14|30|80|90|0\.[0-9]+)\b'
```

### 10.2. Czternaście rzeczy, które najłatwiej zepsuć

1. Poluzowanie `requireCanonicalExecutionWriter` → **odrzucenie dyżuru**.
2. Zdjęcie `disabled` w `src/` → złamanie reguły 7 `CLAUDE.md`.
3. Zaszycie progu z `E-O4`/`E-O5` „na razie" → cichy fakt produktowy.
4. Pomiar **bez `MOCK_DB=false`** → anonim dostaje rolę `owner`.
5. Pomiar **bez `REAL_PG`** → `SKIPPED` zaraportowane jako `PASS`.
6. `vitest` **bez `--config server/vitest.config.ts`** → `No test files found`
   udające sukces.
7. Test przez fabrykę `createInitiativesExecutionRuntimeRouter(deps)` z własnym
   `deps` → dowód niczego (Z22).
8. Podstawienie bieżącej migawki pod `asOf` → raport z fałszywą historią.
9. `expectedVersion`, którego nikt nie sprawdza → atrapa gorsza niż brak.
10. Audyt poza transakcją → atrapa z zewnętrznym skutkiem.
11. `drillDown.ids: []` przy niezerowym liczniku → miara nieweryfikowalna.
12. Test zostawiający wiersze w `ie_audit_events` → powtórka `EXE-PF-002`.
13. Migracja spoza `20261200`–`20261209` → cicha kolizja z niescaloną pulą.
14. `docker volume prune` → skasowanie wolumenów czterech cudzych kontenerów.

### 10.3. Czego NIE robisz, choć „aż się prosi"

- Nie zdejmujesz `disabled`, choć backend już przyjmuje zapis.
- Nie poluzowujesz bramki `409`, choć „jeden wyjątek nikomu nie zaszkodzi".
- Nie zgadujesz progu „at-risk 7 dni", choć nazwa parametru go podpowiada.
- Nie zwracasz bieżącej migawki jako historii, choć „i tak nikt nie sprawdzi".
- Nie ujednolicasz trzech list ośmiu miar, choć „przecież widać, która jest
  właściwa".
- Nie budujesz endpointów archiwizacji z kebaba, choć są `disabled` obok.
- Nie włączasz `execReportsIntelligence`, choć cztery raporty czekają od dnia 11.
- Nie podpinasz AI do sugestii menedżera, żeby „Approve" miało co zatwierdzać.
- Nie tworzysz drugiego rejestru komend obok `ie_*`, choć „byłby czystszy".
- Nie naprawiasz czerwonych testów w cudzych modułach.
- Nie dotykasz frontu — **ani jednego znaku w `src/`**.
- Nie przepisujesz liczb dnia 11 ani `DEC-128` zamiast własnego pomiaru.

---

## 11. NA KONIEC

Partia A zrobiła rzecz trudną i prawidłową: **wyłączyła przyciski, które
kłamały**, zamiast poluzować bramkę, żeby „zadziałały". Napisała użytkownikowi
prawdę — „Zapis przeniesiony do kanonicznego rejestru — w przygotowaniu" —
i tym samym **zaciągnęła dług, który spłacasz Ty**.

Panel ekspercki nazwał sytuację modułu dokładnie: **nie brakuje mu funkcji,
tylko prawdy**. Backend runtime-v1 dostał od panelu najwyższą ocenę w całym
przeglądzie (izolacja tenantów, CAS, idempotencja) — i jednocześnie moduł
dostał `3,6/10`, bo między tym backendem a użytkownikiem stała ściana `409`,
osiem pustych miar i raport, który nie umiał powiedzieć, jak było w zeszłym
tygodniu.

**Jedno zdanie, które ma być prawdziwe po Twoim dyżurze:**

_„Każda akcja, którą Realizacja pokazuje użytkownikowi, ma po drugiej stronie
kanoniczną komendę runtime-v1 ze sprawdzalnym tenantem, sprawdzalną zdolnością,
ochroną przed cichym nadpisaniem, bezpiecznym ponowieniem i śladem audytu
w tej samej transakcji; każda miara ma licznik, mianownik i dokładne rozwinięcie
do wierszy źródłowych; a wszystko, czego serwer nie wie — bo nie ma danych albo
bo właściciel jeszcze nie zdecydował — mówi to wprost, z nazwą brakującej
decyzji."_

Jeżeli któregoś członu tego zdania nie dowieziesz — **napisz to wprost
w raporcie**. Uczciwe „nie zdążyłem" jest w tym programie warte więcej niż
zielony test, który niczego nie dowodzi. Ten moduł już raz dostał sześć
werdyktów „JEST", które okazały się placebo. **Drugi raz nie może.**
