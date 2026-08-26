# INSTRUKCJA DYŻURU nr 35 — Codex — „Realizacja: zapis polityki progów (B.7), PROJEKCJE ODCZYTU pięciu komend runtime-v1 i rozstrzygnięty cykl życia pozycji budżetu — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–34. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★ DLACZEGO TEN DYŻUR ISTNIEJE — dwa zdania, potem dowody

**Dyżur 31 dowiózł pięć komend zapisu runtime-v1, które działają, mają CAS,
idempotencję i audyt w tej samej transakcji — i których NIKT NIE CZYTA.**
Użytkownik zapisze pozycję budżetu i **nigdzie jej nie zobaczy** poza
`GET /command-receipts/:id/read-back`; usunąć jej **nie da się w ogóle**, bo
kasowanie idzie do zupełnie innej tabeli niż tworzenie.

To jest ten sam wzorzec, który program zwalcza od miesiąca: **„backend ma /
front nie woła"** — tyle że w wersji ostrzejszej, bo tu **nie ma nawet czego
zawołać**: trasy odczytu nie istnieją, a te, które istnieją, czytają inną tabelę.

Odbiór dyżuru 31 zapisany jest w rejestrze decyzji jako
`DEC-2026-08-28-173`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:224`),
werdykt `SUPERVISOR_ACCEPT`. Ten sam wpis niesie **dwa P0 produktowe**
i **cztery P1**, i **wydaje licencję nadzorcy na odblokowanie `B.7`**, którego
STOP odbierający uznał za **NIEZASADNY**. Ten dyżur realizuje dokładnie to
i **nic ponadto**.

Trzy zdania, które musisz przyjąć zanim zaczniesz:

1. **`B.7` nie jest już STOP-em.** Licencja jest wydana, wariant rozwiązania
   jest opisany co do pliku i co do metody (`§D.2`). Powtórzenie STOP-u bez
   nowego, twardego dowodu, że wariant A jest niewykonalny, jest **odrzuceniem
   pozycji**, nie ostrożnością.
2. **Sednem tego dyżuru nie jest zapis, tylko ODCZYT.** Pozycje `§D.4`
   i `§D.5` ważą więcej niż cała reszta razem wzięta.
3. **Nie wolno Ci zaszyć ani jednego progu.** `E-O3`/`E-O4`/`E-O5` są
   rozstrzygnięte przez właściciela (`DEC-2026-08-28-169`), ale **nośniki tych
   decyzji buduje dyżur 33, nie Ty**. Ty budujesz **mechanizm zapisu polityki**:
   pusty, bez wartości domyślnych, bez seedu, bez fallbacku.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYŁĄCZNIE mechanikę tylną modułu Realizacja. Front jest poza zakresem
w CAŁOŚCI. Nie robisz zrzutów. Nie włączasz żadnej flagi frontowej.**

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest **wymagane** — BLOK 0 pkt 9), ale **nie
   zmieniasz w nim ani jednego znaku** — także „jednej linii importu", także po
   to, żeby „tylko zdjąć `disabled`, skoro backend już przyjmuje zapis", także
   po to, żeby „domknąć ostatnie ogniwo dowodu osiągalności". Jedyny wyjątek:
   **żaden**. Zdjęcie `disabled` bez zrzutów i bez polish-passu = pokazanie
   właścicielowi zepsutego ekranu jako pierwszemu testerowi, czyli złamanie
   reguły 7 `CLAUDE.md`, która w tym projekcie jest **nienaruszalna**.
2. **★ NIE ZDEJMUJESZ BRAMKI `requireCanonicalExecutionWriter`**
   (`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`). `409`
   na legacy nie jest defektem — jest decyzją `AMD-EXE-SPINE-AUTHORITY-004 (26A)`
   (`…middleware.ts:15-21`): ma być **dokładnie jeden writer pracy wykonawczej**.
   Poszerzenie `GOVERNED_EXECUTION_CONTROL_COMMANDS` (`…middleware.ts:6-12`)
   = **odrzucenie całego dyżuru**, nie STOP.
   **★ Uwaga, to Cię będzie kusiło w `§D.4`:** bramka przepuszcza `GET`
   (`READ_ONLY_METHODS`, `:5`), więc **wzbogacenie trasy ODCZYTU legacy nie
   wymaga tknięcia bramki**. Zapis legacy zostaje `409` na zawsze.
3. **★ NIE ZASZYWASZ ŻADNEGO PROGU, WAGI ANI TAKSONOMII.** Każda wartość
   zależna od `E-O3`/`E-O4`/`E-O5` jest **parametrem czytanym z bazy**, nigdy
   stałą w kodzie. Dowód wymagany: pusty grep liczb w Twoim diffie (`§0.4` pkt 13
   i `§D.2` DoD). Zaszycie domyślnego progu = **odrzucenie pozycji**, nie errata.
4. **★ NIE DOPISUJESZ FUNKCJI, KTÓRYCH NIKT NIE ZAMÓWIŁ.** Ten dyżur ma
   **dziesięć pozycji roboczych** (`§1.3`) plus dwie dokumentacyjne. Ekran
   polityki, ekran budżetu, generator raportów, eksport, silnik AI, endpointy
   archiwizacji z kebaba — **POZA ZAKRESEM** (`§1.4`), idą do „Znalezisk",
   nie do kodu.
5. **★ TEN DYŻUR MA JEDNĄ TWARDĄ BRAMKĘ WEJŚCIOWĄ.** Jeżeli **BLOK 0 pkt 8**
   nie przejdzie, nie zaczynasz żadnej pozycji `D`. Zakładasz raport, wpisujesz
   STOP z dosłownym wynikiem i kończysz dyżur. **Nie improwizujesz obejść.**

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: «MARKER_SHA»**

   > **★ RAMKA WARTOWNIKA — uwaga dla nadzorcy wystawiającego ten dokument
   > (usuń tę ramkę przy wiązaniu):** w miejsce **każdego** literalnego napisu
   > `«MARKER_SHA»` wpisujesz **rzeczywisty SHA tipa `codex/m03-admin-20260824`
   > z chwili wystawienia**, we **wszystkich** wystąpieniach w tym pliku
   > (jest ich kilkanaście — sprawdź `grep -c '«MARKER_SHA»'`, wynik po
   > podmianie musi być `0`). W dokumencie **nie ma i nie może być
   > przykładowego SHA**: dzień 29 dostał instrukcję z konkretnym SHA wpisanym
   > „na przykład" i wykonawca zawiązał się do niego dosłownie, po czym pracował
   > na martwej bazie. Dopóki ta ramka nie jest usunięta, a `«MARKER_SHA»` nadal
   > jest literalnym napisem, **dokument NIE JEST ZWIĄZANY** i wykonawca ma
   > obowiązek odrzucić go na pierwszej komendzie dyżuru.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo `«MARKER_SHA»`
   jest nadal literalnym napisem `«MARKER_SHA»` — STOP.** Nie improwizuj bazy.
   Nie startuj z `origin/demo`, `main`, `Londyn`, `codex/preserve-*`,
   `codex/execution-day31-20260828`, `codex/execution-batch-a-20260826`,
   `codex/finance-day30-20260827`, `codex/document-engine-day32-20260828`,
   `codex/assessment-*`, `codex/meetings-*` ani z żadnej gałęzi dni 17–34.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline «MARKER_SHA»..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. Każda z tych
   komend ma podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", **nie do improwizacji**:

   ```bash
   # (a) dyżur 31 jest scalony — bez tego nie ma czego kontynuować
   ls server/src/domain/initiatives-execution/executionControlWrites.ts        # oczekiwane: plik istnieje
   grep -c "createExecutionBudgetEntry" server/src/domain/initiatives-execution/executionControlWrites.ts  # oczekiwane: 1
   ls server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts  # oczekiwane: plik istnieje

   # (b) ★ SEDNO CAŁEGO DYŻURU — pięć typów agregatu występuje DOKŁADNIE RAZ poza testami
   grep -rn "execution_budget_entry\|execution_realization\|raid_mitigation\|manager_execution_action\|manager_suggestion_review" \
     --include='*.ts' --include='*.tsx' server/src src | grep -v __tests__
   #   oczekiwane: DOKŁADNIE 5 trafień, wszystkie w
   #   server/src/routes/pmo/initiativesExecutionRuntime.routes.ts (:4628,:4662,:4697,:4731,:4766)
   #   — czyli WYŁĄCZNIE w trasie ZAPISU. Zero czytelników. To jest P0-1.

   # (c) SEDNO POZYCJI D.2 — tabela polityki istnieje i NADAL nie ma pisarza
   ls server/migrations/20261077_day17_execution_control_kpi_policy.sql        # oczekiwane: plik istnieje
   grep -rn "execution_control_kpi_policies" server/src | wc -l                # oczekiwane: 1 (tylko ODCZYT)
   grep -n "execution_control_kpi_policies" server/src/services/executionControl/controlKpiReadModel.ts  # oczekiwane: :41

   # (d) ★ SEDNO POZYCJI D.1 — klucz główny NIE jest tenantowy
   sed -n '3,5p' server/migrations/20261077_day17_execution_control_kpi_policy.sql
   #   oczekiwane: linia 4 to dosłownie „  policy_id TEXT PRIMARY KEY,"

   # (e) SEDNO POZYCJI D.6 — pięć schematów jest CREATE-ONLY
   grep -n "expectedVersion: z.literal(0)" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   #   oczekiwane: DOKŁADNIE 5 trafień (:794,:806,:815,:823,:830)

   # (f) SEDNO POZYCJI D.7 — okno miary liczone po updated_at
   grep -n "updated_at >= \$2::date" server/src/services/executionControl/ownerIndependentKpiReader.ts  # oczekiwane: :52

   # (g) SEDNO POZYCJI D.9 — dwie wartości zaszyte
   grep -n "sourceVersion: dependencyPopulation.length > 0 ? 1 : 0" server/src/services/executionControl/ownerIndependentKpiReader.ts  # oczekiwane: :103
   grep -n "scopeCompleteness: 'PARTIAL' as const" server/src/services/executionControl/controlKpiReadModel.ts  # oczekiwane: :92

   # (h) SEDNO POZYCJI D.4 — cykl życia budżetu rozjechany
   grep -n "FROM budget_entries" server/src/services/executionBudgetService.ts   # oczekiwane: trafienie w getBudgetEntries (~:159)
   grep -n "executeBudgetDeleteCommand" server/src/routes/executionControl.routes.ts  # oczekiwane: :37 (import) i :600 (wywołanie)
   grep -n "method: 'DELETE'" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts  # oczekiwane: DOKŁADNIE 1 trafienie (:11)

   # (i) plik chroniony — SHA PRZED pracą (wracasz do niego w §D.2)
   shasum -a 256 server/src/domain/initiatives-execution/materialCommand.ts
   shasum -a 256 server/src/services/executionBudgetService.ts

   # (j) rejestr decyzji
   grep -c "DEC-2026-08-28-173" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   grep -c "DEC-2026-08-28-169" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1

   # (k) numeracja migracji
   ls server/migrations | grep -E '^202612[3-9]'                     # oczekiwane: PUSTE
   ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -3   # oczekiwane: ...20261121, 20261122, 20261123

   # (l) najwyższe zastane ID ustaleń w rejestrze modułu
   grep -o "EXE-PF-[0-9]*"  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1   # oczekiwane: EXE-PF-010
   grep -o "EXE-OWN-[0-9]*" docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1   # oczekiwane: EXE-OWN-008
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/execution-day35-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-execution-day35 codex/execution-day35-<data>
   cd /private/tmp/consultify-execution-day35
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

   **Katalog `/private/tmp/consultify-day35-instrukcja` istnieje i jest worktree,
   w którym powstał TEN dokument. NIE pracujesz w nim, nie kasujesz go, nie
   commitujesz do jego gałęzi.**

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w `§0.3`, `§0.4a` i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| #        | Zakaz | Dlaczego |
| -------- | ----- | -------- |
| `Z1`     | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/execution-day35-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| `Z2`     | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/execution-*`, `codex/finance-*`, `codex/assessment-*`, `codex/meetings-*`, `codex/day2*`, `codex/day3*`, `fix/*`, `chore/*` | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku |
| `Z3`     | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; `DEC-95` |
| `Z4`     | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| `Z5`     | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` | Chroniony, brudny worktree właściciela |
| `Z6`     | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich ponad 90, w tym `consultify-day30-instrukcja`, `consultify-day33-instrukcja`, `consultify-day34-instrukcja`, `consultify-day35-instrukcja`, `consultify-day36-instrukcja`, `consultify-execution-day31`, `consultify-docengine` | Cudze worktree, część w aktywnym użyciu |
| `Z7`     | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia **NASŁUCHUJĄ**: `5432`, `5474` (`codex-tools-audit-pg-20260826`), `5511` (`cx-day30-pg`). Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: `5474`, `5498`, `5499`, `5511`, `5512`, `5521`, `5533`, `5544`, `5556`, `5563`, `5566`, `5567`, `5571`, `5573`, `5575`, `5577`, `5581`, `5588`, `5589`, `5591`, `5597`, `5613`, `5629`, `55291`, `55677`, `55941`, `59321`. **★ Twój kontener PG = `5641`.** Port zajęty → bierzesz pierwszy wolny **powyżej `5641`** (i spoza listy zakazanych) i wpisujesz go do raportu | Cudze dyżury pracują równolegle |
| `Z8`     | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`) | Produkcja/demo poza zakresem |
| `Z9`     | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB, nigdy żadna baza `consultify_w3_execution_owner_*` (są **zachowane do odbioru właściciela**, `modules/06_EXECUTION/MODULE_ACCEPTANCE.md:11,26,37`). **`Z9` przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** (`DEC-2026-08-26-98`) | „dane demo = twarz produktu"; tamte bazy są dowodem, nie piaskownicą |
| `Z10`    | **★★ Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, gdziekolwiek. W szczególności **`execReportsIntelligence` ZOSTAJE OFF** (`DEC-72`, `DEC-120`), a `ENABLE_V8_GLOBAL=true` żyje **wyłącznie w linii komendy Twojego testu** | `CLAUDE.md` reguła 9; flip flagi wymaga akceptu Piotra na zrzutach |
| `Z11`    | **★★ Nie zdejmujesz i nie poluzowujesz `requireCanonicalExecutionWriter`.** Nie dopisujesz nic do `GOVERNED_EXECUTION_CONTROL_COMMANDS`. Nie „reaktywujesz" żadnej trasy **zapisu** `/api/v8/execution-control/*` ani `/api/execution-control/*`. Naruszenie = **odrzucenie dyżuru**, nie STOP | `AMD-EXE-SPINE-AUTHORITY-004`: DOKŁADNIE JEDEN writer pracy wykonawczej |
| `Z12`    | **★★ Nie zaszywasz progów, wag ani taksonomii z `E-O3`/`E-O4`/`E-O5`.** Żadnej „rozsądnej wartości domyślnej", żadnego `?? 7`, żadnego `DEFAULT 0.8` w migracji, żadnego seedu polityki | Nośniki tych decyzji buduje dyżur 33; zaszyta liczba staje się produktem po cichu |
| `Z13`    | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_READ_PROJECTIONS_DAY35_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportów dnia 11 i dnia 31 NIE edytujesz** | Repo tonie w dokumentach-duchach |
| `Z14`    | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| `Z15`    | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`, zero `/api/ai/**`, zero kolejki | Silnik AI = osobny moduł, ostatni w programie; `DEC-51` |
| `Z16`    | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `UNKNOWN` / `DECISION_REQUIRED` / `BRAK_ŹRÓDŁA` / `Degraded`.** Rodzina miary bez polityki **zostaje** `DECISION_REQUIRED`. Pusta organizacja **zostaje pusta** | Uczciwy pusty stan > udawany wynik; `UNKNOWN ≠ 0` |
| `Z17`    | **★★ NIETYKALNE:** `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts`, `server/src/middleware/effectiveCapability.middleware.ts`. Wolno **czytać** i **wołać** | Model uprawnień i bramki naprawiane in-house; zmiana bramki = zmiana produktu |
| `Z18`    | **★ Zakaz wszystkiego poza modułem Realizacja** — z imiennymi licencjami z ramki w `§1.7`. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy: **NIE** | „jeden moduł na raz"; podział FRONT/TYŁ (`§1.6`) |
| `Z19`    | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright.initiatives-execution.config.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| `Z20`    | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — SZEŚĆ zmiennych, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`) |
| `Z21`    | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). W tym dyżurze `Z21` ma dodatkowy, twardy warunek wejściowy: **BLOK 0 pkt 8** | `DEC-104` powstał po tym, jak DoD przepuścił martwy kod jako gotowy |
| `Z22`    | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). W tym module pułapka jest szczególnie ostra: router runtime-v1 jest fabryką `createInitiativesExecutionRuntimeRouter(deps)` (`initiativesExecutionRuntime.routes.ts:1230`) i **kusi, żeby wstrzyknąć własne `deps`**. Montujesz **domyślny eksport** (`:6294`) | Dzień 18: 8/8 testów zielonych, warstwa martwa — wszystkie wstrzykiwały deps |
| `Z23`    | **★★ ZERO ATRAP, a w szczególności zero atrap z zewnętrznym skutkiem.** Przyjęcie pola `expectedVersion`, którego komenda nie sprawdza w tej samej transakcji, jest **atrapą**. Ślad audytu bez mutacji albo mutacja bez śladu jest **atrapą**. Zwrócenie bieżącej migawki jako odpowiedzi na „jak było w dniu X" jest **atrapą najgorszej klasy** | To jest cała różnica między „przeszło" a „działa" |
| `Z24`    | **★ Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Podanie zawężonego wyboru albo przepisanie cudzej liczby zamiast własnego przebiegu = zawyżenie i podstawa odrzucenia | Baseline jest Twoim obowiązkiem, nie cytatem |
| **`Z25`** | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts:386-388` ma fallback: przy braku `DATABASE_URL` ustawia `postgresql://iris:iris_test@localhost:5432/iris_test`. **Port `5432` NASŁUCHUJE na tej maszynie i nie jest Twój.** Uruchomienie testu DB bez `DATABASE_URL` w tej samej linii komendy = połączenie do **cudzej bazy**. Twój jedyny dozwolony `DATABASE_URL` to `postgresql://postgres:cx@127.0.0.1:5641/cx_day35` | Bez tego mierzysz — albo brudzisz — nie swoją bazę |
| **`Z26`** | **★★ `RUN_DB_TESTS=1` i `MOCK_DB=false` są OBOWIĄZKOWE w tej samej linii.** Wzorzec dnia 31 (`day31.canonical-writer-contract.pg.test.ts:16-20`) liczy `REAL_PG` jako `RUN_DB_TESTS==='1' && MOCK_DB==='false' && DATABASE_URL.startsWith('postgres')`. Brak którejkolwiek → cały `describe` jest **`SKIPPED`**, a `SKIPPED` **nie jest `PASS`**. Zgłoszenie w całości pominiętego pakietu jako zielonego = zawyżenie | Tak powstaje „137/137 PASS" na warstwie, która nigdy się nie uruchomiła |
| **`Z27`** | **★★ ZAKAZ `git stash` w tym dyżurze — w każdej postaci (`stash`, `stash -u`, `stash pop`, `stash apply`).** Musisz odłożyć stan roboczy → robisz **kopię plików przez `cp`** do `/private/tmp/consultify-execution-day35-scratch/` i wracasz do niej `cp`-em. Uzasadnienie: `stash` w worktree z symlinkiem `node_modules` i z nowymi, jeszcze nie dodanymi plikami w `tests/` **cicho gubi pliki nieśledzone**, a `stash pop` po zmianie indeksu potrafi wywrócić drzewo w środku pozycji. Znaleziony `git stash list` niepusty na koniec dyżuru = pozycja bez `ZROBIONE_WG_DoD` | Utrata nieskomitowanego dowodu jest nieodwracalna |

> **Ramka do `Z9`.** `Z9` przerywa **daną czynność**, nie cały dyżur: jeżeli
> zorientujesz się, że komenda celuje w cudzą albo zdalną bazę — **przerywasz
> tę komendę**, wpisujesz do „Korekt wobec instrukcji", stawiasz własny
> kontener i wracasz. Nie kończysz z tego powodu dyżuru.

> **Ramka do `Z21`.** „Dowód osiągalności" to **pełna ścieżka**: realne wejście
> HTTP → realne bramki → zapis do bazy → **odczyt, który ten wiersz podnosi**
> → konsument w `src/` **albo jawne zdanie „brak konsumenta"**. Istnienie pliku,
> zielony test jednostkowy i „skompilowało się" **nie są** dowodem osiągalności.
> **W tym dyżurze przedostatnie ogniwo — odczyt — jest CAŁYM PRODUKTEM
> (`§D.5`).** Dla `§D.2` ostatnim ogniwem jest **koperta HTTP** i wpisujesz to
> wprost; ekran polityki zbuduje osobny dyżur frontowy.

> **Ramka do `Z22`.** Test, który czyta plik źródłowy i asertuje
> `toContain('...')`, **nie liczy się do DoD**. W tym module istnieje taki test
> i jest **legalny jako strażnik regresji, nie jako dowód**:
> `src/components/Execution/__tests__/ExecutionRuntimeSpine.contract.test.ts`.
> **Nie kopiujesz tego wzorca jako dowodu swojej pozycji.**

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dziesięć pozycji roboczych = **minimum
  dziesięć commitów** (plus dwa dokumentacyjne). Wrzucenie kilku pozycji do
  jednego commita jest **samodzielnym powodem, dla którego pozycja nie dostanie
  `ZROBIONE_WG_DoD`** (tak zginął dzień 24). Conventional commits:

  ```
  test(execution): prove the five day-31 writes have no reader (BLOK 0)
  fix(execution): make the KPI policy key tenant-scoped instead of global (D.1)
  feat(execution): let an organization author its KPI policy through the canonical bus (D.2)
  test(execution): prove CAS, idempotency, audit, tenant and capability on the policy command (D.3)
  docs(execution): resolve the single table of truth for budget entries (D.4)
  feat(execution): project the five canonical execution writes into readable state (D.5)
  fix(execution): stop making the five execution commands create-only (D.6)
  fix(execution): count the control KPI window by due date, not by row mtime (D.7)
  fix(execution): stop labelling reachable gaps as not-event-sourced (D.8)
  fix(execution): give dependency and envelope provenance a real value (D.9)
  docs(execution): publish the read contract the front duty will consume (D.10)
  docs(execution): raise 06_EXECUTION acceptance to the delivered scope (R.1)
  docs(execution): day 35 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
  **★ UWAGA — `initiativesExecutionRuntime.routes.ts` ma ponad 6290 linii.**
  Uruchomienie `prettier` na całym tym pliku może wygenerować **diff niezwiązany
  z Twoją zmianą**, którego odbiorca nie da rady przejrzeć. **Reguła: jeżeli
  wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych — cofasz
  reformat (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz styl zastany
  i wpisujesz to do raportu.** Reformat cudzego kodu nie jest produktem dyżuru.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje** — nie złapie błędu typu. Dlatego każda
  zmiana kontraktu ma test behawioralny, który złapie to, czego esbuild nie widzi.
  **W `§D.2` to ma konkretne znaczenie:** `KpiPolicyCapableTransaction extends
  MaterialCommandTransaction` przejdzie `esbuild` nawet wtedy, gdy implementacja
  w `postgresMaterialCommandUnitOfWork.ts` **nie ma** nowej metody. Jedynym
  dowodem, że ma, jest test HTTP na realnym PG.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE** (`Z22`). Nowe testy kładziesz **obok
  kodu**, w `server/src/routes/pmo/__tests__/`,
  `server/src/domain/initiatives-execution/__tests__/` albo
  `server/src/services/executionControl/__tests__/` — to zastana konwencja
  modułu. **NOWE pliki w `tests/` wymagają `git add -f`**; pliki `__tests__`
  obok kodu w `server/src/` dodają się normalnie.
- **★ URUCHAMIANIE TESTÓW.** `server/vitest.config.ts` wymaga uruchomienia
  **z cwd `server`** albo jawnego `--config server/vitest.config.ts` z filtrem
  `server/...`. Uruchomienie z roota z filtrem `server/src/...` bez `--config`
  zwraca `No test files found` — a to **nie jest** `PASS` ani `SKIP`, tylko
  `NIE_ZMIERZONE`. Podanie takiego przebiegu jako zielonego = zawyżenie.
- **★ MIGRACJE — reguły twarde.**
  1. **Domyślnie wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
     **★ JEDYNY WYJĄTEK w tym dyżurze to `§D.1`** — przekucie klucza głównego
     `execution_control_kpi_policies`, opisane co do kształtu w `§D.1`, pod
     trzema warunkami (pusta tabela, idempotentny strażnik, `RAISE EXCEPTION`
     przy niepustej). **Każda inna migracja nieaddytywna = STOP.**
  2. **★★ NUMERACJA — DZIEŃ 35 MA PRZYDZIELONY PRZEDZIAŁ `20261240`–`20261249`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261239` to pule dni 22–34 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`. Dzień 30 ma `20261190`–`20261199`, dzień 31 —
     `20261200`–`20261209`, dzień 32 — `20261210`–`20261219`, dzień 33 —
     `20261220`–`20261229`, dzień 34 — `20261230`–`20261239`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep -E '^202612[4]'                        # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_execution_day35_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa (`DEC-107`).

     **★ ZNALEZISKO DO ODNOTOWANIA, NIE DO NAPRAWY:** prefiks `2026NNNN` w tym
     repo jest **sekwencją, nie datą**, a w drzewie żyje **równoległa seria
     trzycyfrowa** (`932_initiatives_execution_material_commands.sql`,
     `960_notification_types_ai_cost_budget.sql`), która alfabetycznie
     **wyprzedza** serię ośmiocyfrową. **Wpisz to do „Znalezisk", nie
     przenumerowuj cudzych plików.**
  3. **★ SPODZIEWAM SIĘ DOKŁADNIE JEDNEJ MIGRACJI** — tej z `§D.1`. Jeżeli
     wyjdzie Ci, że potrzebujesz drugiej, **dowód `\d <tabela>` z Twojego
     kontenera idzie do raportu PRZED plikiem migracji**. Migracja bez
     udowodnionego braku obiektu na świeżej bazie = pozycja odrzucona.
     **Drugiej tabeli polityk nie tworzysz** (`§D.2` pkt 8).
  4. **★ ZERO nowych kluczy obcych do tabel spoza modułu.** Rodzina `ie_*` nie
     ma dziś ani jednego FK do `users`/`organizations` (klucze są `TEXT` +
     `organization_id TEXT NOT NULL`) — **utrzymujesz tę konwencję**.
  5. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona
     lokalnie, **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).
- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Ten moduł ma udokumentowaną historię
  brudzenia: `EXE-PF-002` (`MODULE_ACCEPTANCE.md:96`) — „every green run
  retained 11 audit rows and one organization". **Twoje testy sprzątają po sobie
  w dokładnym zasięgu swojej organizacji, PRZED usunięciem organizacji**;
  wzorzec: `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`.
  Sprzątanie kontenera **i wolumenów** (`docker rm -fv`) jest obowiązkowe
  (BLOK 0 pkt 11). **NIGDY `docker volume prune`** — zabija cudze kontenery.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie trzynaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `UNKNOWN` /
   `DECISION_REQUIRED` **z powodem**, **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Client`/`Pool`), nie
   z koperty odpowiedzi. Wzorzec: `day31.canonical-writer-contract.pg.test.ts:806-813`.
3. **Zero atrap (`Z23`)**, w szczególności zero atrap z zewnętrznym skutkiem.
   Brak API → wpis `BRAK_API`. Brak danych → `BRAK_DANYCH`. Brak decyzji
   właściciela → `DECISION_REQUIRED` **z nazwą pytania** (`E-O3`/`E-O4`/`E-O5`).
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje `D.2`, `D.3`, `D.4`, `D.5` i `D.6`
   mają **wyższe minima** podane we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**,
   montujący **domyślny eksport** `initiativesExecutionRuntime.routes.ts:6294`
   (nie fabrykę z własnym `deps` — `Z22`). Test na zmockowanym serwisie **nie
   zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (`Z21`)** — pełna ścieżka od realnego wejścia, przez
   zapis, do **odczytu, który ten wiersz podnosi**, i do konsumenta w `src/`
   albo jawnego „brak konsumenta".
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (`Z22`)** — realny router, realne bramki,
   realne serwisy, **realne mapowanie błędów**; mockowanie ograniczone do
   `auth.middleware.js` i `Logger.js`. **Każdy inny mock wymaga wpisu
   w raporcie z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu/kontekstu**, nigdy z body/query.
   Test wysyła obcą organizację **w body ORAZ w nagłówku kontekstu org** i dostaje
   `404` (fail-closed), **nigdy `403` z danymi obiektu, nigdy `200`**.
   **To jest klasa, w której partia A znalazła realny wyciek (`A6`, `DEC-128`) —
   traktujesz ją najpoważniej z całego DoD.**
9. **★ Kontrola negatywna roli/zdolności** — żądanie bez wymaganej zdolności
   jest ODRZUCONE **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy
   w `ie_aggregate_state` przed i po) **oraz nie zostawia zdarzenia
   w `ie_audit_events`**. **Role ustawiasz realnym wierszem
   `organization_members`**, nie wstrzyknięciem do `req.user`.
10. **Realny PG w jednorazowym Dockerze** (port **`5641`**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (`Z20`/`Z25`/`Z26`), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem (z zastrzeżeniem o pliku
    6290-liniowym z `§0.3`).
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
    dowód testowy`.
13. **★ DOWÓD BRAKU ZASZYTYCH PROGÓW — obowiązuje KAŻDĄ pozycję, nie tylko
    `D.2`.** Po ostatnim commicie uruchamiasz **dosłownie**:

    ```bash
    git diff «MARKER_SHA»...HEAD | grep -nE '^\+.*\b(7|14|15|30|80|95|0\.[0-9]+)\b'
    ```

    Wynik ma być **pusty poza literałami jawnie wymienionymi niżej**. Każde inne
    trafienie idzie do raportu z wyjaśnieniem albo znika z kodu.

    **Jawnie dopuszczone literały (i tylko one):**

    | Literał | Gdzie wolno | Dlaczego to NIE jest próg `E-O` |
    | --- | --- | --- |
    | `INTERVAL '7 days'` | `ownerIndependentKpiReader.ts` — okno raportowe | To **szerokość tygodnia sprawozdawczego** (`weekStart` + 7 dni), zastana na markerze (`:53`), nie próg „at-risk". Dyżur 31 miał ją odnotowaną w odbiorze jako jedyne dopuszczone trafienie |
    | `.max(12)`, `.min(1)` przy `periodMonth` | schematy Zod trasy | numer miesiąca kalendarzowego |
    | `.min(2000)` przy `periodYear` | schematy Zod trasy | dolna granica sensownego roku |
    | `.max(3)`, `length = 3` przy `currency` | schematy Zod trasy | długość kodu ISO-4217 |
    | `length(request_fingerprint) = 64` | ewentualne SQL w testach | długość SHA-256 |
    | `periodMonth: 8`, `periodYear: 2026`, kwoty `1` | **wyłącznie pliki `__tests__`** | dane fikstury testowej |

    **Czego na tej liście NIE MA i mieć nie będzie:** `atRiskThresholdDays`,
    `decisionSlaDays`, `capacitySaturationThreshold`, `capacityBuffer`,
    `impactWeights` — **żadna z tych pięciu nie dostaje wartości domyślnej
    w kodzie, w migracji ani w schemacie Zod** (`Z12`).

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem w całości (`§1.6`). Klucze i18n tworzysz **wyłącznie**
> dla napisów, które faktycznie wychodzą z Twojego API, i wtedy **parytet PL+EN
> obowiązuje w tym samym commicie**.
> **★ Uwaga na `controlKpiReadModel.ts:71`: `valueReason: 'BRAK_ŹRÓDŁA'` to
> POLSKI STRING ZASZYTY W KODZIE SERWERA, obok angielskiego `DECISION_REQUIRED`.**
> To zastana niespójność. **Nie łamiesz jej po cichu** — trzymasz konwencję
> zastaną i **zgłaszasz rozjazd w „Znaleziskach"**. Zmiana istniejącej wartości
> = zmiana kontraktu dla frontu, czyli **STOP**.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (`Z24`)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie `Z24`.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (`§0.1` pkt 6).
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`,
   `server/src/domain/initiatives-execution/**`,
   `server/src/services/executionControl/**`,
   `server/src/routes/executionControl.routes.ts`,
   `server/src/routes/v8/execution-control.routes.ts`.
3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. Uruchom **minimum** poniższą listę. `ENV` oznacza dosłownie

   ```
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5641/cx_day35" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true
   ```

   **w tej samej linii komendy** (`Z20`/`Z25`/`Z26`), a `VC` oznacza
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

   # --- budżet: legacy odczyt + rozstrzygnięty cykl życia (D.4/D.5) ---
   ENV npx vitest run VC server/src/services/__tests__ --no-file-parallelism -t budget
   ENV npx vitest run VC tests/acceptance/execution-budget-delete-command.mounted.realdb.test.ts

   # --- pozostała powierzchnia Execution po stronie serwera ---
   ENV npx vitest run VC server/src/services/__tests__ --no-file-parallelism -t execution
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
   pilnuje dorobku partii A i **ma zostać zielony**: dopóki front nie przejdzie
   własnego dyżuru i polish-passu, przyciski **zostają wyłączone**, nawet gdy
   backend już przyjmuje zapis **i już go zwraca w odczycie**.

5. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem i z liczbą `SKIPPED`:**

   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (na markerze, PRZED moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env (w tym: ile z powodu REAL_PG): <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```

   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   `§0.4a` = zawyżenie i podstawa odrzucenia.** **Deklaracja „PASS" przy
   pakiecie w całości `SKIPPED` = to samo** (`Z26`).
6. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
7. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu „przed/po"
   w raporcie** (pełny tekst asercji). Dotyczy też usunięcia bloku `describe`.
   Osłabienie bez wpisu = odrzucenie.
   **★ W tym dyżurze jest jedno miejsce, gdzie to Cię dotknie na pewno:**
   `§D.6` zmienia `expectedVersion: z.literal(0)` na `z.number().int().min(0)`.
   Jeżeli którykolwiek istniejący test asertuje `400` dla `expectedVersion: 1`,
   **nie kasujesz go** — przepisujesz na nowy, prawdziwy kontrakt i wpisujesz
   „przed/po" dosłownie.
8. **★★ BASELINE JEST TWOIM OBOWIĄZKIEM, NIE CYTATEM.** Dzień 11 podaje
   `137/137 PASS` (`MODULE_ACCEPTANCE.md:59`), dzień 31 podaje własne liczby
   w `EXECUTION_DAY31_REPORT_20260828.md`, `DEC-128` podaje „78 testów PASS".
   **Przepisanie którejkolwiek z tych liczb zamiast własnego przebiegu =
   naruszenie `Z24`.** Mierzysz sam i podajesz swoje.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- poluzować `requireCanonicalExecutionWriter` albo dopisać cokolwiek do
  `GOVERNED_EXECUTION_CONTROL_COMMANDS` — to **odrzucenie dyżuru**, nie STOP;
- wejść we `src/**` z zapisem (`Z18`) — **także po to, żeby „tylko zdjąć
  `disabled`, skoro odczyt już działa"**;
- **zmienić choćby jeden bajt w `server/src/domain/initiatives-execution/materialCommand.ts`** —
  STOP **zawsze** (`§D.2` pkt 4: dowód SHA przed/po jest wymogiem pozycji);
- dotknąć `Gateway.ts`, `routes/v8/index.ts` albo `routes/pmo/initiatives.routes.ts` —
  to STOP z rekomendacją, nie Twoja zmiana;
- dotknąć `effectiveAccessService.ts`, `effectiveCapability.middleware.ts`,
  `ExecutionController.ts` (`Z17`) — STOP **zawsze**, także „addytywnie";
- **dodać nową nazwę zdolności do modelu uprawnień** (`§D.2` pkt 7) — STOP;
  używasz **istniejących** `initiative.view` / `initiative.update` / `initiative.review`;
- **zaszyć jakąkolwiek wartość zależną od `E-O3`/`E-O4`/`E-O5`** — próg, wagę,
  SLA, bufor, taksonomię BSC. STOP z propozycją **parametru**, nigdy commit
  ze stałą (`Z12`);
- **zmienić kształt istniejącej koperty odczytu w sposób, który złamie
  dzisiejszego konsumenta w `src/`** — pola **dokładasz**, nigdy nie zmieniasz
  ani nie usuwasz. Gdy inaczej się nie da → STOP z rekomendacją (`§D.5` pkt 6);
- zapisać zdarzenie do `ie_audit_events` **poza transakcją mutacji** — STOP,
  nie „na razie tak, poprawi się później";
- stworzyć **drugi** rejestr komend/audytu obok rodziny `ie_*`, albo **trzecią**
  tabelę polityk — STOP;
- **fizycznie skasować wiersz z `ie_aggregate_state`** — STOP; „usunięcie"
  w tej rodzinie jest **przejściem stanu**, nie `DELETE` (`§D.4` pkt 5);
- zbudować ekran polityki, ekran budżetu albo endpoint archiwizacji z kebaba —
  **poza zakresem**, osobne zadania produktowe;
- włączyć `execReportsIntelligence` albo jakąkolwiek inną flagę (`Z10`);
- podpiąć AI/LLM do sugestii menedżera (`Z15`);
- dodać migrację nieaddytywną **inną niż jedyny licencjonowany przypadek
  `§D.1`**, migrację z kluczem obcym poza modułem, albo z numerem **spoza
  przedziału `20261240`–`20261249`**;
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (`Z19`) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (`§0.4a`) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to zakaz, nie STOP:**
naprawiasz kod, nie omijasz strażnika.
**Zakaz `git stash` (`Z27`) — to zakaz, nie STOP:** odkładasz stan przez `cp`.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

**★ Jedno zastrzeżenie do STOP-u, wynikające wprost z odbioru dnia 31.**
STOP jest narzędziem wobec **braku informacji albo braku licencji**, nie wobec
trudności. Dyżur 31 postawił STOP na `B.7` z uzasadnieniem „nie ma metody
w `MaterialCommandTransaction`, a `materialCommand.ts` jest nietykalny" —
i **odbierający uznał to za NIEZASADNE**, bo interfejs da się rozszerzyć
**bez dotykania pliku chronionego** (`interface X extends Y` w nowym pliku),
a instrukcja dnia 31 dawała **imienną licencję** na
`postgresMaterialCommandUnitOfWork.ts`. Kierunek wykonawcy był słuszny
(odrzucenie `withPgTransaction` jako trzeciego rejestru komend), **błędem było
zatrzymanie się**. Ta instrukcja usuwa obie niejasności naraz: licencja jest
wydana wprost, a wariant rozwiązania opisany co do pliku i metody.
**Powtórzenie STOP-u na `§D.2` bez nowego, twardego dowodu niewykonalności
wariantu A = odrzucenie pozycji.**

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

26.08 panel ekspercki dał modułowi Realizacja **`3,6/10` — najniższy wynik
całego programu** (`DEC-2026-08-26-120`, `OWNER_DECISION_LEDGER_2026-08-24.md:172`).
Partia A (`DEC-2026-08-26-128`) zamknęła wyciek międzytenantowy, rozcięła łańcuch
cichej zieleni i **uczciwie wyłączyła przyciski, których jedynym skutkiem był
`409`**, z widocznym powodem:

> **„Zapis przeniesiony do kanonicznego rejestru — w przygotowaniu"**

**Dyżur 31 dotrzymał połowy tej obietnicy.** Pięć komend zapisu runtime-v1
istnieje, jest na ścieżce produkcyjnej, ma CAS, idempotencję i audyt w tej samej
transakcji — potwierdzone własnym przebiegiem odbierającego (`[201,409]`,
`{states: 1, audits: 1}`, readback niezależnym poolem).

**Druga połowa obietnicy nie została dotrzymana i to jest ten dyżur.** Zapis bez
czytelnika nie jest zapisem — jest kosztem. Odbiór dnia 31 nazwał to wprost
(`DEC-2026-08-28-173`):

> „P0-1 pięć komend to ZAPIS BEZ CZYTELNIKA — każdy `aggregateType` występuje
> w repo DOKŁADNIE RAZ (w trasie zapisu); użytkownik zapisze pozycję budżetu
> i nigdzie jej nie zobaczy poza read-back; to znowu wzorzec »backend ma / front
> nie woła«. P0-2 rozjechany cykl życia budżetu: CREATE→`ie_aggregate_state`,
> DELETE/READ→`budget_entries` (nie da się usunąć tego, co się utworzyło)."

### 1.2. ★★ ERRATA — DWANAŚCIE RZECZY ZWERYFIKOWANYCH W KODZIE NA MARKERZE

**Wszystko poniżej sprawdziłem grepem na `«MARKER_SHA»`. To nie są przypuszczenia.
Twoim obowiązkiem jest sprawdzić je ponownie (BLOK 0) — jeżeli którakolwiek się
nie zgadza, idzie do „Korekt wobec instrukcji", a nie do improwizacji.**

| #  | Ustalenie | Dowód `plik:linia` |
| -- | --------- | ------------------ |
| 1  | **Pięć `aggregateType` z dnia 31 występuje w produkcyjnym kodzie DOKŁADNIE RAZ — w trasie ZAPISU.** Poza tym tylko w teście dnia 31 | `initiativesExecutionRuntime.routes.ts:4628,4662,4697,4731,4766`; test: `day31.canonical-writer-contract.pg.test.ts:228…783` |
| 2  | **Żaden read-model, żadna miara i żaden ekran ich nie czyta.** `PostgresInitiativeReader` ma 45 metod `listX`, **ani jednej** dla tych pięciu typów | `postgresInitiativeReader.ts:290-800` (spis metod) |
| 3  | **Miary kontrolne czytają trzy inne typy agregatu**, nie te pięć | `ownerIndependentKpiReader.ts:51` — `aggregate_type IN ('execution_task','execution_milestone','intervention_case')` |
| 4  | **Legacy `GET` budżetu czyta `budget_entries`**, czyli tabelę, do której komenda kanoniczna **nigdy nic nie zapisuje** | `executionBudgetService.ts` — `getBudgetEntries`, `FROM budget_entries` (~`:159`); trasa: `executionControl.routes.ts:491` |
| 5  | **Front budżetu woła WYŁĄCZNIE legacy**, i to trasę `/api/execution-control/*` (nie `/api/v8/*`) | `src/components/Execution/BudgetControlPanel.tsx:153,170,227,242,259,317,374` |
| 6  | **`DELETE` budżetu to jedyny licencjonowany wyjątek bramki `409`** i idzie do `budget_entries` | `executionSpineLegacyReadOnly.middleware.ts:11`; `executionControl.routes.ts:581-600`; `executionBudgetDeleteCommandService.ts:139` |
| 7  | **`policy_id TEXT PRIMARY KEY` NIE jest tenant-scoped.** Tabela ma `organization_id`, ale klucz główny jest globalny; jest tylko **zwykły** indeks `(organization_id, policy_id)` | `20261077_day17_execution_control_kpi_policy.sql:4` (PK) i `:13-14` (indeks, NIE unikalny) |
| 8  | **Tabela polityki jest pusta w każdym środowisku** — od dnia 17 nie ma ani jednego pisarza | `grep -rn "execution_control_kpi_policies" server/src` → **1 trafienie**, `controlKpiReadModel.ts:41`, `SELECT` |
| 9  | **Odczyt polityki JUŻ filtruje org i `policy_id`** — nie ma tam czego naprawiać | `controlKpiReadModel.ts:40-44` |
| 10 | **Pięć schematów zapisu jest CREATE-ONLY** — `z.literal(0)` czyni każdą komendę jednorazową | `initiativesExecutionRuntime.routes.ts:794,806,815,823,830` |
| 11 | **Okno miary liczone po `updated_at`**, nie po dacie należnej — miara zmienia sens przy każdym `UPDATE` | `ownerIndependentKpiReader.ts:52-53` |
| 12 | **`dependency.sourceVersion` i `scopeCompleteness` zaszyte** | `ownerIndependentKpiReader.ts:103` (`? 1 : 0`); `controlKpiReadModel.ts:92` (`'PARTIAL' as const`) |

**★ Trzynasta rzecz — POPRAWKA DO ZLECENIA, sprawdź ją sam i zapisz wynik.**
Zlecenie mówi, że `SOURCE_NOT_EVENT_SOURCED` jest „nieosiągalny w produkcji
(`reportReconstruction.ts:71-74`)". **Sprawdziłem: to jest prawdą tylko
w połowie.**

- **Gałąź `:76`** (`hasVersionReader ? 'NO_EVENT_HISTORY_BEFORE_AS_OF' :
  'SOURCE_NOT_EVENT_SOURCED'`) — **rzeczywiście nieosiągalna w produkcji**, bo
  jedyny produkcyjny wołacz zawsze podaje tablicę wersji: `deps.asOfVersions`
  jest **zawsze** okablowane (`initiativesExecutionRuntime.routes.ts:6263`,
  `new PostgresAsOfVersionReader(runtimePool)`), a `:5131-5137` woła
  `resolve(...)`, które zwraca tablicę. Wariant `string` z `:5137` (`new
  Date().toISOString()`) jest **martwą gałęzią**, osiągalną wyłącznie przez
  wstrzyknięty `deps` w teście — czyli dokładnie klasa `Z22`.
- **Gałąź `:87`** (`run.sources.length === 0` → jedna luka `SOURCE_NOT_EVENT_SOURCED`)
  — **jest osiągalna**: run bez źródeł to realny stan.

**Wniosek wiążący dla `§D.8`:** naprawiasz **wyłącznie `:76`**, gałęzi `:87`
**nie ruszasz**. Jeżeli Twój własny grep pokaże inaczej — piszesz to
w „Korektach wobec instrukcji" i idziesz za swoim dowodem, nie za moim.

### 1.3. ZAKRES — dokładnie dziesięć pozycji roboczych + dwie dokumentacyjne

| Pozycja | Co | Waga |
| --- | --- | --- |
| `§D.1` | Migracja: `PRIMARY KEY (organization_id, policy_id)` zamiast globalnego `policy_id` | **P1 wymuszony** — bez tego `§D.2` jest bombą wielotenantową |
| `§D.2` | **`B.7`** — komenda autorstwa polityki przez kanoniczną szynę, wariant A (zero zmian w pliku chronionym) | **licencja nadzorcy** |
| `§D.3` | Dowód braku atrapy dla komendy z `§D.2` (CAS · idempotencja · audyt · tenant · zdolność) + **test dwóch organizacji z tym samym `policyId`** | dowodowa |
| `§D.4` | **P0-2** — rozstrzygnięcie i domknięcie cyklu życia pozycji budżetu | **P0** |
| `§D.5` | **P0-1** — pięć projekcji odczytu z `ie_aggregate_state` | **P0, sedno dyżuru** |
| `§D.6` | `expectedVersion: z.literal(0)` → `z.number().int().min(0)` + test aktualizacji `v1→v2` | P1 |
| `§D.7` | Okno miary liczone po `payload_json->>'dueAt'`, nie po `updated_at` | P1 |
| `§D.8` | `SOURCE_NOT_EVENT_SOURCED` przestaje być kłamliwą etykietą (tylko gałąź `:76`) | P1 |
| `§D.9` | `dependency.sourceVersion` i kopertowe `scopeCompleteness` przestają być zaszyte | P1 |
| `§D.10` | **Kontrakt dla frontu** — produkt podziału FRONT/TYŁ (`§1.6`) | dokumentacyjno-kodowa |
| `§R.1` | `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` do stanu faktycznego | dokumentacyjna |
| `§R.2` | Raport | dokumentacyjna |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **★ `E-O3` / `E-O4` / `E-O5` — NOŚNIKI decyzji.** Właściciel je rozstrzygnął
  (`DEC-2026-08-28-169`: BSC 4+1 perspektywy, skala 3-stopniowa, progi 7 dni /
  5 dni roboczych, pasma 80/95 % + bufor 15 %), ale **nośniki tych decyzji
  buduje dyżur 33**. Ty dajesz **wyłącznie mechanizm zapisu polityki**: pusty,
  bez wartości domyślnych, bez zaszytych progów. **Kolumna `perspective`,
  `contribution_weight`, tabela nieobecności, pasma wysycenia — NIE TWOJE.**
- Ekran polityki progów, ekran budżetu, ekran mitygacji RAID — **osobny dyżur
  frontowy, po prototypie zaakceptowanym przez właściciela**.
- Zdejmowanie `disabled` gdziekolwiek w `src/`.
- Generator raportów, eksport XLSX/PDF, `execReportsIntelligence`.
- Silnik AI / LLM w sugestiach menedżera.
- Endpointy archiwizacji/usuwania inicjatywy albo definicji raportu z kebaba
  (`ExecutionHub.tsx`, dziś `disabled` z notą „Wkrótce (backend)").
- Read-model as-of ponad to, co robi `§D.8` (dzień 31 zamknął `B.5`).
- Przenoszenie parametrów do `ie_governance_policies` — **rozstrzygnięte
  inaczej** przez dyżur 33 (`§P.1`): parametry mieszkają
  w `execution_control_kpi_policies.parameters`. **Nie podważasz tego.**

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| Decyzja | Treść w skrócie | Skutek dla Ciebie |
| --- | --- | --- |
| `AMD-EXE-SPINE-AUTHORITY-004 (26A)` | dokładnie **jeden** writer pracy wykonawczej | `Z11`; rozwiązaniem `409` jest komenda po drugiej stronie, nigdy poluzowanie bramki |
| `DEC-2026-08-26-128` | partia A scalona; przyciski-`409` uczciwie wyłączone | front zostaje wyłączony do własnego dyżuru |
| `DEC-2026-08-28-173` | dzień 31 scalony; **STOP na `B.7` NIEZASADNY, licencja wydana**; P0-1, P0-2 i cztery P1 | to jest zakres tego dyżuru |
| `DEC-2026-08-28-169` | `E-O3`/`E-O4`/`E-O5` rozstrzygnięte przez właściciela | **wartości są danymi, nie kodem**; nośniki buduje dyżur 33 |
| `DEC-2026-08-26-104` | DoD wymaga dowodu osiągalności | `Z21` |
| `DEC-2026-08-26-107` | test ze wstrzykniętym `deps` nie dowodzi produkcji | `Z22` |
| `DEC-86` | `node_modules` przez symlink, tylko odczyt | `§0.1` pkt 5 |
| `DEC-65` | zero Railway, dane demo = twarz produktu | `Z8`, `Z9` |

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Reguła:** wszystko, co renderuje piksel, jest FRONTEM i jest poza zakresem.
Wszystko, co odpowiada na `HTTP`, jest TYŁEM i jest w zakresie.

**Twoim produktem dla frontu jest KONTRAKT (`§D.10`), nie ekran.** Kontrakt to:
ścieżka, metoda, kształt żądania, kształt odpowiedzi, kody błędów, wymagana
zdolność, i **jawne zdanie, czego kontrakt NIE daje**.

**★ Pułapka tego konkretnego dyżuru.** Po `§D.5` prawdą będzie zdanie „backend
przyjmuje zapis **i zwraca go w odczycie**". To jest dokładnie moment, w którym
poprzednicy zdejmowali `disabled` „bo już działa". **Nie zdejmujesz.** Front
przechodzi własny dyżur, z prototypem i akceptem właściciela na zrzutach
(reguła 7 `CLAUDE.md`). Test
`src/components/Execution/__tests__/MitigationPanel.writesDisabled.test.tsx`
**ma zostać zielony** — jest strażnikiem tej granicy.

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

```
WOLNO (zapis):
  §D.1  — server/migrations/2026124<x>_execution_day35_*.sql        (NOWY plik; przedział 20261240-49)
  §D.2  — server/src/domain/initiatives-execution/executionControlKpiPolicyAuthoring.ts  (NOWY plik)
          server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts   (★ IMIENNA LICENCJA: JEDNA nowa metoda, ~25 linii, obok markSourceProposalRegistered :424-460)
          server/src/routes/pmo/initiativesExecutionRuntime.routes.ts                     (NOWA trasa addytywna + schemat Zod)
  §D.3  — server/src/routes/pmo/__tests__/day35.*.pg.test.ts                              (NOWE testy)
  §D.4  — server/src/services/executionControl/canonicalExecutionReadProjections.ts       (NOWY plik — patrz §D.5 pkt 3)
          server/src/routes/executionControl.routes.ts                                    (★ IMIENNA LICENCJA: WYŁĄCZNIE trasy GET, wyłącznie ADDYTYWNIE)
          server/src/domain/initiatives-execution/executionControlWrites.ts               (dopisanie komendy przejścia stanu — patrz §D.4 pkt 5)
  §D.5  — server/src/domain/initiatives-execution/postgresInitiativeReader.ts             (★ pięć NOWYCH metod list*, addytywnie)
          server/src/routes/pmo/initiativesExecutionRuntime.routes.ts                     (NOWE trasy GET, addytywnie)
  §D.6  — server/src/routes/pmo/initiativesExecutionRuntime.routes.ts                     (pięć schematów Zod)
  §D.7  — server/src/services/executionControl/ownerIndependentKpiReader.ts
  §D.8  — server/src/domain/initiatives-execution/reportReconstruction.ts                 (WYŁĄCZNIE gałąź :76)
  §D.9  — server/src/services/executionControl/ownerIndependentKpiReader.ts               (:103)
          server/src/services/executionControl/controlKpiReadModel.ts                     (:92 — koperta)
  §R.1  — docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md
  §R.2  — docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_READ_PROJECTIONS_DAY35_REPORT_20260828.md

CZYTASZ (zmiana = STOP):
  server/src/domain/initiatives-execution/materialCommand.ts              ← ★ PLIK CHRONIONY; dowód SHA przed/po (§D.2 pkt 4)
  server/src/services/executionBudgetService.ts                           ← ★ PLIK CHRONIONY w tym dyżurze; dowód SHA przed/po (§D.4 pkt 4)
  server/src/services/executionBudgetDeleteCommandService.ts              ← governed wyjątek bramki; NIE przepinasz go
  server/src/domain/initiatives-execution/registerInitiative.ts:91-172     ← ★ PRECEDENS do naśladowania w §D.2
  server/src/domain/initiatives-execution/publishInitiativeCard.ts:96      ← drugi precedens
  src/components/Execution/**                                             ← inwentarz konsumentów (BLOK 0 pkt 9)
  server/src/services/evmService.ts, execution/canonicalExecutionHealthService.ts

NIE WOLNO:
  ★ CAŁE src/** DO ZAPISU                                                 ← podział FRONT/TYŁ; zero wyjątków
  ★ server/src/middleware/executionSpineLegacyReadOnly.middleware.ts      ← ZMIANA = ODRZUCENIE DYŻURU (Z11)
  ★ server/src/Gateway.ts                                                 ← montaż = zakres nadzorcy
  ★ server/src/routes/v8/index.ts                                         ← jw.
  ★ server/src/routes/pmo/initiatives.routes.ts                           ← montaż runtime-v1; zmiana = STOP
  ★ server/src/middleware/v8FeatureGate.middleware.ts, services/v8/featureFlagService.ts   ← Z10
  server/src/services/effectiveAccessService.ts, middleware/effectiveCapability.middleware.ts  ← Z17
  server/src/controllers/ExecutionController.ts                           ← naprawiony w partii A (wyciek tenanta)
  server/src/services/executionBvpService.ts                              ← spine legacy↔runtime; zmiana = STOP
  tests/setup.ts · tests/helpers/** · tests/__mocks__/** · vitest*.config.ts   ← Z19, odrzucenie CAŁEGO dyżuru
  tests/e2e/** · tests/acceptance/**                                      ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  server/src/routes/v8/finance-v2/** · services/finance/canonical/**      ← ★ KOLIZJA: dyżur 30 w toku (§1.9)
  server/src/services/documentStudio/** · services/assessment/**          ← ★ KOLIZJA: dyżur 32 (§1.9)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **STOP zamiast pracy przy wydanej licencji** (dzień 31, `B.7`). Licencja
   jest w instrukcji; precedens jest w kodzie; wariant jest opisany. Zatrzymanie
   się bez nowego dowodu = odrzucenie pozycji.
2. **Zielone testy na wstrzykniętym `deps`** (dzień 18: 8/8 `PASS`, warstwa
   martwa). Montujesz domyślny eksport (`Z22`).
3. **Pomiar na cudzej bazie** (dzień 17, `DEC-96/98`). Sześć zmiennych w tej
   samej linii, zawsze (`Z20`/`Z25`/`Z26`).
4. **Kilka pozycji w jednym commicie** (dzień 24). Commit per pozycja.
5. **Przepisanie cudzej liczby jako własnego baseline'u** (`Z24`).
6. **Zaszycie „rozsądnej wartości domyślnej"** — tak próg staje się produktem
   po cichu (`Z12`).
7. **Zdjęcie `disabled`, bo „backend już działa"** — łamie regułę 7 `CLAUDE.md`
   i robi z właściciela pierwszego testera wizualnego.
8. **`git stash` w worktree z symlinkiem i nieśledzonymi testami** — cicha
   utrata dowodu (`Z27`).
9. **Naprawianie tego, co już działa.** Odczyt polityki (`controlKpiReadModel.ts:40-44`)
   filtruje org i `policy_id` **poprawnie**. Nie ruszasz go bez dowodu defektu.
10. **Kasowanie wiersza z `ie_aggregate_state`.** W tej rodzinie nie ma `DELETE`
    — jest przejście stanu (`§D.4` pkt 5).

### 1.9. ★ KOLIZJE Z DYŻURAMI W TOKU — sprawdzone, zakres rozłączny

| Dyżur | Gałąź | Co dotyka | Relacja do Ciebie |
| --- | --- | --- | --- |
| **31 — Realizacja blok B** | `codex/execution-day31-20260828` | **SCALONY do `codex/m03-admin-20260824`** | **warunek wstępny**: jego kod jest już w Twoim markerze (BLOK 0 pkt 4a) |
| **33 — nośniki `E-O3/4/5`** | `codex/day33-instrukcja-20260828` | `goals`, `goal_initiative_links`, nieobecności, `controlKpiReadModel.ts` (dokładanie pól), migracje `20261220-29`, port `5597` | **★ NADBUDOWA NA TOBIE — patrz ramka niżej** |
| 30 — Finance C–H | `codex/finance-day30-20260827` | `server/src/routes/v8/finance-v2/**`, `services/finance/canonical/**`, migracje `20261190-99`, port `5511` (**nasłuchuje**) | rozłączny; te ścieżki **ZABLOKOWANE** |
| 32 — silnik dokumentu | `codex/document-engine-day32-20260828` | `services/documentStudio/**`, `services/assessment/**`, migracje `20261210-19`, port `5521` | rozłączny; te ścieżki **ZABLOKOWANE** |
| 34 | `codex/day34-instrukcja-20260828` | **na markerze jeszcze pusty** (gałąź wskazuje ten sam commit co tip `m03`) | rozłączny w chwili wystawienia; migracje `20261230-39` **ZAJĘTE**, nie bierzesz ich. Jeżeli w BLOKU 0 zobaczysz tam pliki dotykające `server/src/domain/initiatives-execution/**` albo `services/executionControl/**` — **STOP i wpis do raportu**, nie scalanie |
| 36 | `codex/day36-instrukcja-20260828` | jw. — pusty | jw. |

> **★★ RAMKA — ROZSTRZYGNIĘCIE KOLIZJI Z DYŻUREM 33. Przeczytaj i zastosuj się
> dosłownie; to jest część Twojego produktu, nie ciekawostka.**
>
> Dyżur 33 buduje **nośniki** decyzji `E-O3`/`E-O4`/`E-O5` i jest **nadbudową
> na `B.7`**, czyli na Twoim `§D.2`. Jego instrukcja ma **bramkę wejściową
> w kształcie grepowym** (`CODEX_DAY33_…INSTRUKCJA.md`, BLOK 0 pkt 8 (i)):
>
> ```
> grep -rn "execution_control_kpi_policies" server/src
> #   dokładnie 1 trafienie (controlKpiReadModel.ts:35) → STOP CAŁEGO DYŻURU
> ```
>
> **Ta bramka jest zła i po tym dyżurze musi zostać PRZEPISANA na behawioralną.**
> Powody, oba twarde:
>
> 1. **Liczba trafień grepa nie jest dowodem działania.** Po Twoim `§D.2` grep
>    zwróci **cztery lub więcej** trafień (nowy plik domenowy, nowa metoda
>    w `postgresMaterialCommandUnitOfWork.ts`, odczyt w `controlKpiReadModel.ts`,
>    testy). Bramka „dokładnie 1" **przepuści dyżur 33 przy każdym wyniku ≠ 1**
>    — także wtedy, gdyby komenda była atrapą.
> 2. **Bramka mierzy nie to, co trzeba.** Dyżurowi 33 potrzebne jest jedno:
>    **czy dwie różne organizacje mogą mieć KOMPLETNĄ politykę o tym samym
>    `policyId` i czy odczyt miar to widzi.** To jest dokładnie to, czego dziś
>    nie da się zrobić (`§1.2` pkt 7) i co naprawiasz w `§D.1` + `§D.2`.
>
> **★ NOWY, WIĄŻĄCY KSZTAŁT BRAMKI WEJŚCIOWEJ DYŻURU 33 (wpisujesz go dosłownie
> do raportu, pozycja `§D.10`, żeby nadzorca mógł go przenieść do instrukcji 33):**
>
> ```
> BRAMKA 33 (behawioralna, zastępuje grep „dokładnie 1 trafienie"):
>   1. POST polityki KOMPLETNEJ (pięć parametrów z REQUIRED_POLICY_PARAMETERS)
>      dla organizacji A, policyId = "execution-control"           → 201
>   2. POST polityki KOMPLETNEJ dla organizacji B, ten SAM policyId → 201
>      (dziś ten krok pada: policy_id TEXT PRIMARY KEY jest globalny)
>   3. GET /control-kpis?weekStart=<data>&policyId=execution-control jako aktor A
>      → policy.resolved === true  ORAZ  policy.missingParameters === []
>   4. to samo jako aktor B
>      → policy.resolved === true  ORAZ  policy.missingParameters === []
>   Wszystkie cztery kroki muszą przejść. Którykolwiek nie przechodzi
>   → STOP CAŁEGO DYŻURU 33.
> ```
>
> **Zakres: Ty NIE edytujesz instrukcji dyżuru 33** (`Z13` — jeden plik raportu,
> plus `MODULE_ACCEPTANCE.md`). Podajesz nadzorcy gotowy tekst bramki i **dowód,
> że ona przechodzi na Twojej gałęzi** (to jest dokładnie test `§D.3` pkt 6).
> Jeżeli na Twojej gałęzi bramka nie przechodzi — piszesz to wprost i nie
> ukrywasz tego pod „częściowo".
>
> **Współdzielone pliki z dyżurem 33:** `controlKpiReadModel.ts`
> (on dokłada pola do rodzin, Ty ruszasz **wyłącznie `:92`** — `§D.9`)
> i `initiativesExecutionRuntime.routes.ts` (on dokłada pola do koperty
> `/control-kpis`, Ty dokładasz **nowe trasy** i **nowy schemat Zod**).
> **Konflikt scaleniowy rozstrzyga nadzorca; Ty nie scalasz i nie rebase'ujesz.**
> Twoje zmiany mają być **addytywne co do linii**, żeby scalenie było możliwe.

- **Migracje:** `20261190-99` (30), `20261200-09` (31), `20261210-19` (32),
  `20261220-29` (33), `20261230-39` (34) są **zajęte**.
  **Twój przedział to `20261240`–`20261249` i tylko on.**
- **Porty:** `5432`, `5474`, `5511` **nasłuchują teraz**; `5521`, `5597` są
  zarezerwowane. **Twój port to `5641`.**

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker** — `§0.1` pkt 2. Wynik dosłownie do raportu. `MARKER BRAK` → STOP.
2. **Weryfikacja stanu wejściowego** — `§0.1` pkt 4, wszystkie dwanaście
   podpunktów `(a)`–`(l)`. Rozbieżność → „Korekty wobec instrukcji".
3. **Errata `§1.2`** — sprawdzasz **wszystkie dwanaście pozycji plus trzynastą**
   własnym grepem. Tabela `ustalenie → moja komenda → mój wynik → ZGADZA SIĘ /
   NIE ZGADZA SIĘ` idzie do raportu.
4. **Czytasz decyzje właściciela**: `DEC-2026-08-28-173` (`:224`),
   `DEC-2026-08-28-169` (`:220`), `DEC-2026-08-26-128` (`:180`),
   `DEC-2026-08-26-120` (`:172`) w `OWNER_DECISION_LEDGER_2026-08-24.md`.
   **Czytasz je sam, w całości** — streszczenie w `§1.5` nie zastępuje lektury.
5. **Własna gałąź i worktree** — `§0.1` pkt 5. Symlink `node_modules` (`DEC-86`).
   Oświadczenie o chronionym checkoutcie (`Z5`) do raportu.
6. **Kontener PG — PIERWSZY, przed jakimkolwiek pomiarem** (`Z20`):

   ```bash
   docker run -d --name cx-day35-pg \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day35 \
     -p 5641:5432 pgvector/pgvector:pg16
   ```

   Port zajęty → pierwszy wolny **powyżej `5641`**, spoza listy zakazanych
   (`Z7`), i **wpisujesz go do raportu**. Obraz `postgres:15` **NIE przechodzi
   migracji** (brak rozszerzenia `vector`).

   Potem **pełne migracje na pustej bazie**:

   ```bash
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5641/cx_day35" DB_TYPE=postgres \
     npx tsx server/src/db/migrate.postgres.ts
   ```

   **Dowód celu połączenia** (`Z20`) do raportu:

   ```bash
   docker exec cx-day35-pg psql -U postgres -d cx_day35 -c "SELECT current_database(), inet_server_port();"
   ```

7. **★ USTALENIE `REAL_PG`.** Sprawdzasz, jak Twoje pakiety liczą `REAL_PG`
   (wzorzec: `day31.canonical-writer-contract.pg.test.ts:16-20`) i **wpisujesz
   do raportu, ile plików ma `describe.skipIf(!REAL_PG)`**. Bez tego nie
   odróżnisz `SKIPPED` od `PASS` (`Z26`).
8. **★★ BRAMKA WEJŚCIOWA — dwustronny kontrakt. Bez niej NIE zaczynasz pozycji.**

   ```bash
   # (i) ★ SEDNO: pięć typów agregatu nadal nie ma czytelnika
   grep -rn "execution_budget_entry\|execution_realization\|raid_mitigation\|manager_execution_action\|manager_suggestion_review" \
     --include='*.ts' --include='*.tsx' server/src src | grep -v __tests__ | wc -l
   #   oczekiwane: 5. Wynik > 5 → ktoś już to czyta: NIE dublujesz, wpisujesz do raportu
   #   i redukujesz §D.5 do brakujących. Wynik < 5 → dyżur 31 nie jest w markerze: STOP.

   # (ii) ★ SEDNO: legacy odczyt budżetu nadal czyta inną tabelę niż kanoniczny zapis
   grep -n "FROM budget_entries" server/src/services/executionBudgetService.ts
   grep -rn "ie_aggregate_state" server/src/services/executionBudgetService.ts
   #   oczekiwane: pierwsze — trafienie; drugie — PUSTE. Inaczej: cykl już domknięty, STOP z opisem.

   # (iii) ★ SEDNO §D.1: klucz polityki jest globalny — dowód NA BAZIE, nie z pliku
   docker exec cx-day35-pg psql -U postgres -d cx_day35 -c "\d execution_control_kpi_policies"
   #   oczekiwane: „PRIMARY KEY, btree (policy_id)" — BEZ organization_id

   # (iv) ★ WARUNEK MIGRACJI §D.1: tabela MUSI być pusta
   docker exec cx-day35-pg psql -U postgres -d cx_day35 \
     -c "SELECT COUNT(*) AS policies FROM execution_control_kpi_policies;"
   #   oczekiwane: 0. Wynik > 0 → STOP na §D.1 (przekucie klucza wymaga decyzji właściciela)

   # (v) ★ DOWÓD, ŻE DZIŚ TO PADA: dwie organizacje, ten sam policyId
   docker exec cx-day35-pg psql -U postgres -d cx_day35 -c \
     "INSERT INTO execution_control_kpi_policies(policy_id,organization_id,name) VALUES('p-gate','org-a','A');
      INSERT INTO execution_control_kpi_policies(policy_id,organization_id,name) VALUES('p-gate','org-b','B');"
   #   oczekiwane: DRUGI INSERT PADA na duplicate key. To jest Twój dowód wejściowy.
   docker exec cx-day35-pg psql -U postgres -d cx_day35 -c \
     "DELETE FROM execution_control_kpi_policies WHERE policy_id='p-gate';"
   #   ★ SPRZĄTASZ PO SOBIE OD RAZU — tabela wraca do stanu pustego przed migracją §D.1

   # (vi) plik chroniony — SHA odniesienia
   shasum -a 256 server/src/domain/initiatives-execution/materialCommand.ts
   shasum -a 256 server/src/services/executionBudgetService.ts
   ```

   **Wynik `(i)`, `(ii)` i `(iv)` decyduje, czy dyżur się zaczyna. Wyniki
   `(iii)`, `(v)` i `(vi)` są wejściem do pozycji i muszą być w raporcie przed
   pierwszym commitem.**

9. **★ INWENTARZ KONSUMENTÓW — zanim cokolwiek dodasz.** Wypisz (grep,
   `plik:linia`), **kto w `src/` czyta dziś** budżet, realizacje, mitygacje
   RAID, akcje menedżera i przeglądy sugestii, oraz **jakie trasy woła**:

   ```bash
   grep -rn "execution-control\|runtime-v1" src/components/Execution src/services/initiatives-execution --include='*.ts' --include='*.tsx' | grep -v __tests__
   ```

   Wynik wklejasz do raportu. **Spodziewam się, że dla budżetu odpowiedź brzmi
   `BudgetControlPanel.tsx` przez `/api/execution-control/*`, a dla pozostałych
   czterech — „nikt".** Wtedy piszesz to wprost i **nie dopisujesz konsumenta
   w `src/`** (`Z18`). Ten inwentarz jest **wejściem do decyzji `§D.5` pkt 4**.
10. **Pomiar ZASTANY (przed pierwszym commitem)** — pełny zakres `§0.4a`,
    z przypiętym env (`Z25`/`Z26`). Bez tej liczby nie odróżnisz czerwieni
    zastanej od wprowadzonej.
11. **Sprzątanie na koniec dyżuru** — `docker rm -fv cx-day35-pg`, **nigdy**
    `docker volume prune`. Dowód pustki do raportu, plus:
    `git stash list` → **musi być puste** (`Z27`).

---

## §D.1 — KLUCZ POLITYKI MA BYĆ TENANTOWY (migracja wymuszona)

**Pozycja wykonywana PIERWSZA, przed `§D.2`. Bez niej `§D.2` jest bombą
wielotenantową z opóźnionym zapłonem.**

Zastane (`20261077_day17_execution_control_kpi_policy.sql:3-11`):

```sql
CREATE TABLE IF NOT EXISTS execution_control_kpi_policies (
  policy_id TEXT PRIMARY KEY,          -- ★ GLOBALNY, nie tenantowy
  organization_id TEXT NOT NULL,
  ...
);
CREATE INDEX IF NOT EXISTS idx_execution_control_kpi_policies_org
  ON execution_control_kpi_policies (organization_id, policy_id);   -- ★ zwykły, NIE unikalny
```

**Co to znaczy w praktyce.** Trasa `/control-kpis` przyjmuje `policyId` jako
parametr zapytania (`initiativesExecutionRuntime.routes.ts:5187`), a odczyt
filtruje `organization_id = $1 AND policy_id = $2`
(`controlKpiReadModel.ts:40-44`). Czyli **każda organizacja będzie używać tej
samej, naturalnej nazwy polityki** — najpewniej `'execution-control'`, bo taki
`policyId` jest już zaszyty w kopercie komend
(`initiativesExecutionRuntime.routes.ts:4634` i cztery analogiczne).
**Pierwsza organizacja, która zapisze politykę o tej nazwie, ZABLOKUJE
wszystkie pozostałe** — druga dostanie `duplicate key`, a nie `409` ani `403`.
Klasa błędu: **cichy wyciek tożsamości tenanta do klucza globalnego**, dokładnie
ta, w której partia A znalazła realny wyciek (`A6`).

1. **Weryfikujesz pustkę PRZED przekuciem** — BLOK 0 pkt 8 `(iv)`.
   `COUNT(*) > 0` → **STOP na tej pozycji** (przekucie klucza na niepustej
   tabeli to migracja danych, czyli decyzja właściciela), i wtedy `§D.2`
   **też nie startuje**.
2. **Migracja jest jedynym licencjonowanym odstępstwem od reguły addytywności**
   (`§0.3` pkt 1). Wymagany kształt — **idempotentny, samo-strzegący,
   przerywający przy niepustej tabeli**:

   ```sql
   -- server/migrations/20261240_execution_day35_kpi_policy_tenant_scoped_pk.sql
   -- Day 35 D.1. policy_id TEXT PRIMARY KEY was global: the first organization to
   -- author a policy would lock the name for every other tenant. Re-key to
   -- (organization_id, policy_id). Safe only while the table is empty — it has had
   -- no writer since day 17.
   DO $$
   DECLARE
     pk_name TEXT;
     pk_def  TEXT;
     rows_present BIGINT;
   BEGIN
     IF to_regclass('public.execution_control_kpi_policies') IS NULL THEN
       RAISE NOTICE 'execution_control_kpi_policies absent - nothing to re-key';
       RETURN;
     END IF;

     SELECT conname, pg_get_constraintdef(oid) INTO pk_name, pk_def
       FROM pg_constraint
      WHERE conrelid = 'public.execution_control_kpi_policies'::regclass
        AND contype = 'p';

     IF pk_def IS NOT NULL AND pk_def LIKE '%organization_id%' THEN
       RETURN;   -- already tenant-scoped: idempotent no-op
     END IF;

     SELECT COUNT(*) INTO rows_present FROM execution_control_kpi_policies;
     IF rows_present > 0 THEN
       RAISE EXCEPTION
         'execution_control_kpi_policies holds % row(s); re-keying needs an owner decision',
         rows_present;
     END IF;

     IF pk_name IS NOT NULL THEN
       EXECUTE format('ALTER TABLE execution_control_kpi_policies DROP CONSTRAINT %I', pk_name);
     END IF;
     ALTER TABLE execution_control_kpi_policies
       ADD CONSTRAINT execution_control_kpi_policies_pkey
       PRIMARY KEY (organization_id, policy_id);
   END $$;
   ```

   **To jest kształt wymagany, nie propozycja.** Wolno Ci go dostosować do tego,
   co pokaże `\d` na Twojej bazie (np. inna nazwa constraintu) — **nie wolno Ci
   usunąć ani strażnika pustki, ani strażnika idempotencji**.
3. **`ALTER ... DROP CONSTRAINT` bez `IF EXISTS` jest tu celowy** — chroni go
   `IF pk_name IS NOT NULL`. Nie zamieniaj tego na cichy `IF EXISTS`: cisza
   ukryłaby sytuację, w której PK ma inny kształt, niż zakładasz.
4. **Indeks `idx_execution_control_kpi_policies_org` zostaje.** Po przekuciu
   jest redundantny wobec nowego PK, ale **jego usunięcie to `DROP`**, czyli
   poza licencją. **Wpisz redundancję do „Znalezisk"**, nie kasuj.
5. **`controlKpiReadModel.ts` NIE RUSZASZ** — odczyt już filtruje
   `organization_id` **i** `policy_id` (`:40-44`), więc po przekuciu klucza
   działa bez zmiany.

**DoD `§D.1`:** wynik `\d execution_control_kpi_policies` **przed i po**
migracji, wklejony dosłownie; dowód `COUNT(*) = 0` przed przekuciem; **test
migracji uruchomionej DWA RAZY z rzędu** (drugi przebieg = no-op, bez błędu);
**test SQL, w którym dwie organizacje wstawiają ten sam `policy_id` i OBA
`INSERT`-y przechodzą** (dziś drugi pada — to jest test, który DZIŚ by padł);
sprzątnięcie tych wierszy; commit.

---

## §D.2 — `B.7`: AUTORSTWO POLITYKI PRZEZ KANONICZNĄ SZYNĘ (wariant A)

**Licencja nadzorcy jest wydana (`DEC-2026-08-28-173`). To nie jest już STOP.**

Zastane, i to jest sedno: tabela polityki **istnieje**, jest tenant-scoped po
kolumnie, ma `parameters JSONB` i `row_version`, migracja mówi wprost „No
default policy is seeded: thresholds and weights remain an owner decision"
(`:1-2`) — i **nie ma ani jednego pisarza**. Czyli: **nawet gdyby właściciel
dziś podał progi, nie ma jak wprowadzić ich do systemu.** Trzy rodziny miar
zostaną `DECISION_REQUIRED` **na zawsze**, niezależnie od decyzji.

Dyżur 31 zatrzymał się tu STOP-em z uzasadnieniem: „`MaterialCommandTransaction`
nie ma operacji na tej tabeli, a `materialCommand.ts` jest nietykalny". Odbiór
uznał to za **niezasadne**, podając trzy dowody. Wszystkie trzy sprawdziłem
i potwierdzam:

| # | Dowód | Weryfikacja |
| - | ----- | ----------- |
| 1 | Instrukcja dnia 31 dawała **imienną licencję** na `postgresMaterialCommandUnitOfWork.ts` („zmiana TYLKO jeśli nowa komenda wymaga nowego agregatu — **z wpisem**") | `CODEX_DAY31_…INSTRUKCJA.md`, ramka `§0.2` |
| 2 | **Bezpośredni precedens w tym samym mechanizmie**: `registerInitiative.ts` zapisuje w `prepare` do tabeli **spoza rodziny `ie_*`** (`initiative_candidates`), z `FOR UPDATE` i kontrolą wersji, w tej samej transakcji | `registerInitiative.ts:91-172`; implementacja: `postgresMaterialCommandUnitOfWork.ts:424-460` (`markSourceProposalRegistered`, `UPDATE ... WHERE ... AND version = $4`) |
| 3 | Interfejs da się rozszerzyć **BEZ dotykania pliku chronionego**: `interface X extends MaterialCommandTransaction` w **nowym** pliku domenowym | `materialCommand.ts:117` — `MaterialCommandTransaction` jest `export`owany, więc rozszerzalny z zewnątrz |

**Wykonawca dnia 31 SŁUSZNIE odrzucił alternatywę przez `withPgTransaction`**
(osobny writer = trzeci rejestr komend = złamanie
`AMD-EXE-SPINE-AUTHORITY-004`). **Kierunek był dobry; błędem było zatrzymanie
się.** Ty idziesz tym samym kierunkiem do końca.

### Co budujesz — wariant A, krok po kroku

1. **NOWY plik** `server/src/domain/initiatives-execution/executionControlKpiPolicyAuthoring.ts`.
   Deklarujesz w nim rozszerzenie interfejsu **i nic poza tym nie eksportujesz
   z warstwy transakcyjnej**:

   ```ts
   export interface KpiPolicyCapableTransaction extends MaterialCommandTransaction {
     upsertExecutionControlKpiPolicy(input: {
       organizationId: string;
       policyId: string;
       name: string;
       parameters: Record<string, unknown>;
       expectedRowVersion: number;
       nextRowVersion: number;
     }): Promise<'INSERTED' | 'UPDATED' | 'CONFLICT'>;
   }
   ```

2. **Funkcja `authorExecutionControlKpiPolicy(unitOfWork, envelope)`** —
   wyłącznie przez `executeMaterialCommand(unitOfWork, envelope, prepare)`.
   **Nie wołasz `unitOfWork.transaction` samodzielnie. Nie tworzysz drugiej
   szyny.** Wewnątrz `prepare`:

   - **★ STRAŻNIK FAIL-CLOSED — pierwsza instrukcja `prepare`:**

     ```ts
     const capable = transaction as Partial<KpiPolicyCapableTransaction>;
     if (typeof capable.upsertExecutionControlKpiPolicy !== 'function') {
       throw new MaterialCommandValidationError(
         'This transaction cannot author execution control KPI policies'
       );
     }
     ```

     **Bez tego strażnika pozycja jest odrzucona.** Powód: `esbuild` transpiluje,
     nie typuje (`§0.3`), a implementacja `MaterialCommandTransaction` jest
     jedna, ale nic nie gwarantuje, że pozostanie jedyna. Cicha `undefined is
     not a function` w środku transakcji to najgorszy możliwy tryb awarii —
     mutacja bez śladu albo ślad bez mutacji (`Z23`).
   - **Walidacja WYŁĄCZNIE strukturalna.** Sprawdzasz, że `name` jest niepustym
     stringiem, a `parameters` obiektem. **Nie sprawdzasz, czy
     `atRiskThresholdDays` to 7 czy 14. Nie sprawdzasz, czy pięć wymaganych
     parametrów jest obecnych.** Zakres dopuszczalnych wartości jest **decyzją
     właściciela**, nie Twoją walidacją.
   - **`'CONFLICT'` → `MaterialCommandConflictError`** z `expectedRowVersion`
     i wersją zastaną. `'INSERTED'`/`'UPDATED'` idą dalej normalnie.
   - Zwracasz `{ mutation, response, eventType, eventPayload, auditPayload }`
     jak każda inna komenda tej rodziny (wzorzec: `executionControlWrites.ts:45-51`).

3. **★★ ZERO WARTOŚCI DOMYŚLNYCH. ZERO SEEDU. ZERO UZUPEŁNIANIA BRAKÓW.**
   Komenda **przyjmuje** wartości od użytkownika; **nie proponuje ich, nie
   uzupełnia brakujących, nie ma fallbacku, nie scala z poprzednią wersją**.
   **Polityka niekompletna zapisuje się jako niekompletna** i rodziny od niej
   zależne **nadal zwracają `DECISION_REQUIRED`** — dokładnie tak, jak liczy to
   `controlKpiReadModel.ts:48-50` i `:67-71`. **Zaszycie choćby jednej wartości
   domyślnej — w kodzie, w schemacie Zod, w migracji — = odrzucenie pozycji**
   (`Z12`, `§0.4` pkt 13).

4. **★ `server/src/domain/initiatives-execution/materialCommand.ts` POZOSTAJE
   BIT-IDENTYCZNY.** Dowód wymagany w raporcie:

   ```bash
   shasum -a 256 server/src/domain/initiatives-execution/materialCommand.ts   # PRZED (BLOK 0 pkt 8 (vi))
   shasum -a 256 server/src/domain/initiatives-execution/materialCommand.ts   # PO ostatnim commicie
   git diff «MARKER_SHA»...HEAD -- server/src/domain/initiatives-execution/materialCommand.ts   # MUSI BYĆ PUSTE
   ```

   **Różnica choćby jednego bajtu = STOP i pozycja bez `ZROBIONE_WG_DoD`.**

5. **ZMIANA LICENCJONOWANA** — `postgresMaterialCommandUnitOfWork.ts`:
   **JEDNA nowa metoda** na klasie `PostgresMaterialCommandTransaction`
   (`:23`), **~25 linii**, położona **obok `markSourceProposalRegistered`
   (`:424-460`)**, w tej samej konwencji:

   - `INSERT ... ON CONFLICT (organization_id, policy_id) DO NOTHING`
     z `row_version = $nextRowVersion` — `rowCount === 1` → `'INSERTED'`;
   - w przeciwnym razie
     `UPDATE ... SET name=..., parameters=..., row_version=$next, updated_at=NOW()
      WHERE policy_id=$ AND organization_id=$ AND row_version=$expected`
     — `rowCount === 1` → `'UPDATED'`, `rowCount === 0` → `'CONFLICT'`;
   - **oba zapytania na `this.client`** — czyli w **tej samej transakcji** co
     `persistAggregate`, `appendAudit`, `appendOutbox` i `saveReceipt`
     (`materialCommand.ts:498-540`). Użycie osobnego poola albo
     `withPgTransaction` = **atrapa z zewnętrznym skutkiem** (`Z23`) i STOP.
   - **Zwrot rozstrzygasz po `rowCount`**, nigdy po `RETURNING` z pustego
     zbioru; nigdy przez odczyt „czy istnieje" przed zapisem (wyścig).

   **★ Kolejność `INSERT`-then-`UPDATE` jest wiążąca, nie dowolna.** Odwrotna
   (`UPDATE`, a jak `0` to `INSERT`) daje przy współbieżności dwa `INSERT`-y
   i wyjątek zamiast `CONFLICT`. Ten wariant przechodzi dzięki
   `ON CONFLICT DO NOTHING` i temu, że `§D.1` zrobił z pary
   `(organization_id, policy_id)` klucz.

6. **NOWA TRASA ADDYTYWNA** w `initiativesExecutionRuntime.routes.ts`:

   ```
   POST /execution-control-kpi-policies/:policyId
   ```

   - schemat Zod: `expectedVersion: z.number().int().min(0)`,
     `clientRequestId: z.string().min(1)`, `name: z.string().min(1)`,
     `parameters: z.record(z.unknown())`.
     **★ ŻADNEGO pola z `.default(...)`.** Sprawdzenie własne przed commitem:
     `grep -n "default(" <Twój fragment schematu>` → **puste**;
   - `organizationId` **wyłącznie z `actorFromRequest(req)`** (`:1179`),
     **nigdy z body ani z query** (`§0.4` pkt 8);
   - `aggregateType` nowy, np. `'execution_control_kpi_policy'`;
     `aggregateId` = `policyId` z URL; `policyId`/`policyVersion` w kopercie
     komendy jak w pozostałych pięciu (`:4634-4635`);
   - **status `201` przy `APPLIED`, `200` przy `REPLAYED`** — konwencja
     wszystkich pięciu komend dnia 31 (`:4638`).

7. **★ ZDOLNOŚĆ — przez ISTNIEJĄCY mechanizm, bez nowej nazwy uprawnienia.**
   `deps.authorize(actor, projectId, capability)` (`:6275-6279`) woła
   `resolveEffectiveAccess`, które **przyjmuje `projectId?: string | null`**
   (`effectiveAccessService.ts:845`) i przy wartości fałszywej **pomija
   członkostwo projektowe** (`:898`), zwracając zdolności organizacyjne.
   Polityka jest obiektem **organizacyjnym**, nie projektowym.

   - **Rekomendacja wiążąca:** `deps.authorize(actor, '', 'initiative.update')`,
     brak zdolności → **`404`** (fail-closed, nigdy `403` z danymi obiektu).
   - **Nie dodajesz nowej nazwy zdolności do modelu uprawnień** — `Z17`
     i `§0.5`. Trzy dopuszczone nazwy to `initiative.view`, `initiative.update`,
     `initiative.review` (typ w `:1237`).
   - **Dowodem jest ZACHOWANIE, nie mechanizm** (`§D.3` pkt 5): aktor
     z realnym wierszem `organization_members` bez zdolności dostaje `404`
     i **zero wierszy** w `ie_aggregate_state`, `ie_audit_events`
     i `execution_control_kpi_policies`.
   - **★ Sprawdź globalny strażnik non-GET** (`:1295-1444`): rozpoznaje ścieżki
     po prefiksie i przy nieznanej zostawia `projectIds === null`, po czym
     przepuszcza (`:1440-1443`). Twoja trasa **wpadnie w tę gałąź**, więc
     **autoryzacja MUSI być w handlerze**. Nie licz na strażnika.
     **Nie dopisujesz też nowej gałęzi do strażnika** — to plik współdzielony
     z dyżurem 33, a Twoja zmiana ma być addytywna co do linii.

8. **Nie tworzysz drugiej tabeli polityk** i nie przenosisz niczego do
   `ie_governance_policies` — dyżur 33 `§P.1` rozstrzygnął to wiążąco
   (parametry mieszkają w `execution_control_kpi_policies.parameters`).

9. **★ Ta pozycja nie ma frontu i to jest w porządku.** Ostatnim ogniwem `Z21`
   jest **koperta HTTP** i **wpisujesz to wprost** — nie dopisujesz konsumenta
   w `src/`, żeby domknąć ogniwo (`Z18`). Ekran polityki zbuduje osobny dyżur
   frontowy.

**DoD `§D.2` (wyższe minimum):** nowy plik domenowy ze strażnikiem
fail-closed; jedna metoda w `postgresMaterialCommandUnitOfWork.ts` z zapytaniami
na `this.client`; trasa addytywna; **dowód SHA `materialCommand.ts` przed/po
+ pusty `git diff` na tym pliku**; test HTTP na realnym PG montujący **domyślny
eksport** routera; test, w którym polityka **niekompletna** zostaje zapisana,
a `GET /control-kpis?policyId=...` **nadal** zwraca `DECISION_REQUIRED` dla
trzech rodzin z listą `missingParameters`; test, w którym polityka **kompletna**
sprawia, że te trzy rodziny **przestają** być `DECISION_REQUIRED`; **pusty grep
progów w diffie wg `§0.4` pkt 13**; negatyw tenanta; negatyw zdolności; commit.

---

## §D.3 — DOWÓD BRAKU ATRAPY DLA KOMENDY POLITYKI

**Pozycja czysto dowodowa. Nie dodaje funkcji — udowadnia, że `§D.1` i `§D.2`
są prawdziwe. Bez niej `§D.2` nie dostanie `ZROBIONE_WG_DoD`.**

Wzorzec do naśladowania co do litery:
`server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts`
(seed dwóch organizacji `:38-73`, JWT `:80-95`, współbieżność `:725-813`,
readback niezależnym klientem `:806-813`).

Dowodzisz **wszystkich sześciu**:

1. **CAS działa.** Dwa **równoległe** żądania z tym samym `expectedVersion`
   i **różnymi** `clientRequestId`: statusy posortowane muszą dać dosłownie
   `[201, 409]`. Dowód readbackiem **niezależnym połączeniem**:

   ```sql
   SELECT
     (SELECT COUNT(*)::int FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='execution_control_kpi_policy' AND aggregate_id=$2) AS states,
     (SELECT COUNT(*)::int FROM ie_audit_events
       WHERE organization_id=$1 AND aggregate_type='execution_control_kpi_policy' AND aggregate_id=$2) AS audits,
     (SELECT COUNT(*)::int FROM execution_control_kpi_policies
       WHERE organization_id=$1 AND policy_id=$2) AS policies,
     (SELECT row_version FROM execution_control_kpi_policies
       WHERE organization_id=$1 AND policy_id=$2) AS row_version;
   ```

   Oczekiwane: `{ states: 1, audits: 1, policies: 1, row_version: 1 }`.
   **Sam fakt, że pole `expectedVersion` jest przyjmowane, NIE jest dowodem**
   (`Z23`).
2. **Idempotencja działa.** Ten sam `clientRequestId` dwa razy → **jeden**
   obiekt, ta sama odpowiedź, status `200` (`REPLAYED`) za drugim razem.
   Różne `clientRequestId` z poprawną wersją → **`row_version` rośnie 1 → 2**.
   Dowód: `SELECT COUNT(*) FROM ie_command_receipts WHERE organization_id=…
   AND client_request_id=…` oraz `row_version` z tabeli polityki.
3. **Audyt jest w tej samej transakcji.** Odrzucenie przez walidację
   strukturalną → **ZERO** wierszy w `ie_audit_events` **i ZERO**
   w `execution_control_kpi_policies`. Konflikt CAS → to samo. Sukces →
   **dokładnie jeden** wiersz audytu z właściwym `aggregate_version`.
   **Ślad audytu bez wiersza polityki albo wiersz polityki bez śladu = atrapa
   z zewnętrznym skutkiem** — i jest to **jedyny prawdziwy test tego, czy
   Twoja metoda naprawdę siedzi na `this.client`**.
4. **Negatyw tenanta jest szczelny.** Obca organizacja **w body ORAZ
   w nagłówku kontekstu org** → `404` (fail-closed), **zero wierszy**.
   **Seedujesz dwie organizacje** — test na jednej niczego nie dowodzi.
5. **Negatyw zdolności jest szczelny.** Aktor z **realnym wierszem
   `organization_members`** bez wymaganej zdolności → `404`, **zero wierszy
   w `ie_aggregate_state`, zero w `ie_audit_events`, zero
   w `execution_control_kpi_policies`**. Role ustawiasz wierszem w bazie, nie
   wstrzyknięciem do `req.user` (`Z22`).
6. **★ TEST WIELOTENANTOWY, KTÓRY DZIŚ BY PADŁ — obowiązkowy.** Dwie
   organizacje, **ten sam `policyId`** (użyj dosłownie `'execution-control'`,
   bo taki jest zaszyty w kopertach komend dnia 31):

   ```
   POST /execution-control-kpi-policies/execution-control  jako aktor org A, parametry KOMPLETNE  → 201
   POST /execution-control-kpi-policies/execution-control  jako aktor org B, parametry KOMPLETNE  → 201
   GET  /control-kpis?weekStart=<data>&policyId=execution-control  jako A
        → policy.resolved === true  ORAZ  policy.missingParameters.length === 0
   GET  /control-kpis?weekStart=<data>&policyId=execution-control  jako B
        → policy.resolved === true  ORAZ  policy.missingParameters.length === 0
   readback: SELECT COUNT(*) FROM execution_control_kpi_policies WHERE policy_id='execution-control'  → 2
   ```

   **Ten test na markerze pada na drugim `POST` (`duplicate key`)** — i to jest
   jego wartość. **To jest jednocześnie dosłowna bramka wejściowa dyżuru 33**
   (`§1.9`, ramka). Wynik wklejasz do raportu w postaci, w której nadzorca może
   go przenieść do instrukcji 33.

   **★ Wartości parametrów w tym teście bierzesz z fikstury testowej, nie
   z decyzji właściciela.** Nie wpisuj `7`, `5`, `0.8`, `0.95`, `0.15` — użyj
   liczb jawnie nieprodukcyjnych (np. `atRiskThresholdDays: 1234`), żeby grep
   z `§0.4` pkt 13 nie musiał ich tłumaczyć i żeby nikt nigdy nie wziął ich za
   wartość domyślną.

**★ Sprzątanie jest częścią DoD tej pozycji.** `ie_audit_events` jest
append-only. Twój test usuwa **dokładny zasięg swojej organizacji przed
usunięciem organizacji** (wzorzec:
`server/src/services/__tests__/executionActionRegistryService.pg.test.ts`,
lekcja `EXE-PF-002`). Po pełnym przebiegu podajesz w raporcie:

```sql
SELECT COUNT(*) FROM ie_audit_events                 WHERE organization_id LIKE 'day35-%';
SELECT COUNT(*) FROM ie_aggregate_state              WHERE organization_id LIKE 'day35-%';
SELECT COUNT(*) FROM execution_control_kpi_policies  WHERE organization_id LIKE 'day35-%';
```

→ **wszystkie trzy muszą być `0`**.

**DoD `§D.3`:** tabela sześciu dowodów z **dosłownymi liczbami przed i po**,
z niezależnego połączenia; dowód zerowej pozostałości; gotowy tekst bramki 33;
commit.

---

## §D.4 — CYKL ŻYCIA POZYCJI BUDŻETU: jedna tabela prawdy (P0-2)

**Pozycja rozstrzygająca. Wykonujesz ją PRZED `§D.5`, bo jej wynik decyduje
o kształcie projekcji budżetu.**

Zastane — **trzy operacje, dwie tabele, zero spójności**:

| Operacja | Wejście | Gdzie ląduje | Dowód |
| --- | --- | --- | --- |
| CREATE | `POST /api/initiatives/runtime-v1/initiatives/:id/budget-entries/:entryId` | **`ie_aggregate_state`** | `initiativesExecutionRuntime.routes.ts:4601-4639`; `executionControlWrites.ts:27-53` |
| CREATE (legacy) | `POST /api/execution-control/budget/entries` | **`409`** — bramka | `executionSpineLegacyReadOnly.middleware.ts:39-43` |
| READ | `GET /api/execution-control/budget/entries/:initiativeId` | **`budget_entries`** | `executionControl.routes.ts:491-505`; `executionBudgetService.ts` (`getBudgetEntries`, `FROM budget_entries`) |
| READ (podsumowanie) | `GET /api/execution-control/budget/initiative/:initiativeId` | **`budget_entries`** | `executionControl.routes.ts:644`; `getInitiativeBudgetSummary` |
| DELETE | `DELETE /api/execution-control/budget/entries/:entryId` | **`budget_entries`** | `executionControl.routes.ts:581-600`; `executionBudgetDeleteCommandService.ts:139`; wyjątek bramki `middleware:11` |

**Skutek dla użytkownika, dosłownie:** kanoniczny `POST` zwraca `201`,
`BudgetControlPanel.tsx:259` odświeża listę z legacy `GET` — **i lista jest
pusta**. Kasowanie działa tylko na wierszach, których nowa komenda **nigdy nie
tworzy**. **Nie da się usunąć tego, co się utworzyło.**

### Rozstrzygnięcie — WARIANT A jest wiążący

**Tabelą prawdy dla pozycji budżetu utworzonych przez kanoniczną komendę jest
`ie_aggregate_state`.** Uzasadnienie, trzy punkty, wszystkie sprawdzalne:

1. **`budget_entries` nie ma szyny komend.** Zapis legacy jest zamknięty na
   `409` decyzją `AMD-EXE-SPINE-AUTHORITY-004`; przywrócenie go = odrzucenie
   dyżuru (`Z11`). Uczynienie `budget_entries` tabelą prawdy wymagałoby
   **przepisania kanonicznej komendy na zapis-przelotowy**, czyli oddania
   pojedynczej ścieżki zapisu, którą partia A i dzień 31 właśnie zbudowały.
2. **`ie_aggregate_state` ma to, czego `budget_entries` nie ma**: CAS
   po `version`, receipt idempotencji, audyt i outbox **w jednej transakcji**.
3. **Kierunek migracji danych jest wtedy jednostronny**: stare wiersze
   `budget_entries` są historią, nowe idą kanonicznie. Odwrotnie byłoby to
   cofnięcie.

**Wolno Ci zmienić to rozstrzygnięcie tylko dowodem, nie preferencją.** Jeżeli
znajdziesz twardy fakt, którego nie widzę (np. konsumenta, który pisze do
`budget_entries` ścieżką omijającą bramkę) — **STOP z rekomendacją**, nie cicha
zmiana wariantu.

### Co robisz

1. **Odczyt legacy zaczyna widzieć wiersze kanoniczne — ADDYTYWNIE.**
   `GET /budget/entries/:initiativeId` (`executionControl.routes.ts:491`)
   zwraca **sumę**: wiersze `budget_entries` (historia) **plus** wiersze
   kanoniczne z `ie_aggregate_state`, **bez usuwania i bez zmiany znaczenia
   ani jednego istniejącego pola**.
   - **Każda pozycja dostaje NOWE pole `origin: 'LEGACY' | 'CANONICAL'`.**
     Pole dokładane, nigdy zamieniane.
   - Kolejność: zachowujesz zastaną (`period_year DESC, period_month DESC,
     created_at DESC` — `executionBudgetService.ts`), scalając obie listy tym
     samym porządkiem.
   - Deduplikacja po `entryId` — gdyby ten sam identyfikator był w obu
     źródłach, **wygrywa kanoniczny** i **wpisujesz ten przypadek do raportu**.
   - **Bramki nie ruszasz**: `GET` przechodzi przez
     `requireCanonicalExecutionWriter` bez zmian (`READ_ONLY_METHODS`, `:5`).
2. **To samo dla podsumowania** `GET /budget/initiative/:initiativeId`
   (`:644`) — jeżeli podsumowanie liczy sumy z `budget_entries`, po tej pozycji
   **musi liczyć z obu źródeł**, inaczej kwoty w panelu będą kłamać.
   Jeżeli okaże się, że `getInitiativeBudgetSummary` liczy w SQL w sposób,
   którego nie da się rozszerzyć bez zmiany `executionBudgetService.ts` —
   **STOP z rekomendacją**, i wtedy `§D.4` idzie jako `CZĘŚCIOWO` z jawnym
   opisem, czego brakuje. **Nie „poprawiasz" tego pliku po cichu.**
3. **Kod liczący idzie do NOWEGO pliku**
   `server/src/services/executionControl/canonicalExecutionReadProjections.ts`
   (wspólny z `§D.5`). Trasa **komponuje** wynik legacy i kanoniczny.
4. **★ `server/src/services/executionBudgetService.ts` POZOSTAJE
   BIT-IDENTYCZNY.** Dowód SHA przed/po + pusty `git diff` na tym pliku, tak
   samo jak dla `materialCommand.ts` w `§D.2`. Powód: dzień 31 miał ten plik
   oznaczony „CZYTASZ; ZMIANA = STOP", pisze do niego `createBudgetEntry`
   z bocznym skutkiem `fireBudgetHealthExport` i `observeWriter`, a jego
   zmiana pociąga most Execution→Results.
5. **★ „Usunięcie" pozycji kanonicznej jest PRZEJŚCIEM STANU, nie `DELETE`.**
   Rodzina `ie_*` nie kasuje wierszy — `persistAggregate` podnosi wersję
   (`materialCommand.ts:498-505`). Dokładasz **komendę wycofania** w
   `executionControlWrites.ts`, w tej samej konwencji co pozostałe pięć:
   - trasa: `POST /initiatives/:initiativeId/budget-entries/:entryId/void`
     (addytywna, w runtime-v1);
   - `expectedVersion` **rzeczywisty** (dzięki `§D.6` już nie `literal(0)`);
   - mutacja: ten sam kształt payloadu **plus** `voidedAt`, `voidedBy`
     i `status: 'VOIDED'`;
   - `eventType: 'execution-budget-entry.voided'`;
   - **projekcja z pkt 1 i 2 pomija pozycje `VOIDED`** — i to jest jedyny
     dozwolony sposób, w jaki „znikają";
   - **legacy `DELETE` zostaje dokładnie taki, jaki jest.** Nie przepinasz go,
     nie rozszerzasz, nie dopisujesz mu gałęzi kanonicznej. Działa na wierszach
     `budget_entries` i tak zostaje. **Wpisujesz do `§D.10`, że front będzie
     musiał wołać `/void` dla pozycji `origin: 'CANONICAL'` i `DELETE` dla
     `origin: 'LEGACY'`** — to jest uczciwy, jawny stan przejściowy, nie defekt
     do zamaskowania.
6. **Nie migrujesz danych.** Zero `INSERT INTO ie_aggregate_state SELECT ...
   FROM budget_entries`. Historia zostaje historią. Migracja danych to decyzja
   właściciela, nie Twoja (`Z12` w duchu, `§0.5`).

**DoD `§D.4` (wyższe minimum):** **test PEŁNEGO CYKLU na realnym PG, w jednym
przebiegu**:

```
CREATE  POST runtime-v1 .../budget-entries/:entryId  (expectedVersion 0)  → 201
READ    GET  /api/execution-control/budget/entries/:initiativeId          → pozycja WIDOCZNA, origin='CANONICAL'
UPDATE  POST runtime-v1 .../budget-entries/:entryId  (expectedVersion 1)  → 200/201, readback: version=2, zmieniona kwota
READ    GET  ...                                                          → widoczna ZMIENIONA kwota
VOID    POST runtime-v1 .../budget-entries/:entryId/void (expectedVersion 2) → 2xx
READ    GET  ...                                                          → pozycji NIE MA na liście
readback niezależnym połączeniem: wiersz w ie_aggregate_state ISTNIEJE, version=3, payload_json->>'status'='VOIDED'
```

plus: test, w którym wiersz **legacy** nadal jest widoczny z `origin: 'LEGACY'`
i nadal daje się skasować legacy `DELETE`-em (dowód, że niczego nie zepsułeś);
test podsumowania kwotowego z obu źródeł; **dowód SHA `executionBudgetService.ts`
przed/po**; negatyw tenanta na nowej trasie `/void`; negatyw zdolności; commit.

---

## §D.5 — PIĘĆ PROJEKCJI ODCZYTU (P0-1) — SEDNO DYŻURU

**To jest pozycja, dla której ten dyżur istnieje.** Pięć komend dnia 31 zapisuje
do `ie_aggregate_state` i **nikt tego nie czyta**. Twoim produktem jest **pięć
czytników i pięć ścieżek odczytu**, na których użytkownik zobaczy to, co zapisał.

Zastane, sprawdzone (`§1.2` pkt 1–3): każdy z pięciu `aggregateType` występuje
w produkcyjnym kodzie **dokładnie raz** — w trasie zapisu. `PostgresInitiativeReader`
ma 45 metod `listX` i **ani jednej** dla tych typów.

1. **Wzorzec czytnika jest w repo i go NIE wymyślasz.** Kopiujesz kształt
   `postgresInitiativeReader.ts:310-323` (`listExecutionTasks`) albo
   `:420-433` (`listManagementSignals`):

   ```ts
   const result = await this.pool.query<{ version: number; aggregate_id: string; payload_json: Record<string, unknown> }>(
     `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='<typ>'
         AND ($2::text IS NULL OR payload_json->>'initiativeId'=$2)
       ORDER BY updated_at DESC, aggregate_id`,
     [organizationId, initiativeId ?? null]
   );
   return result.rows.map((r) => ({ version: r.version, <nazwaId>: r.aggregate_id, ...r.payload_json }));
   ```

   **`organization_id=$1` jest obowiązkowe w KAŻDYM z pięciu zapytań.**
   To jest klasa, w której partia A znalazła realny wyciek (`A6`).
2. **Pięć metod, addytywnie, w `postgresInitiativeReader.ts`:**

   | Metoda | `aggregate_type` | Filtr | Klucz w wyniku |
   | --- | --- | --- | --- |
   | `listExecutionBudgetEntries(org, initiativeId?)` | `execution_budget_entry` | `payload_json->>'initiativeId'` | `entryId` |
   | `listExecutionRealizations(org, initiativeId?)` | `execution_realization` | jw. | `realizationId` |
   | `listRaidMitigations(org, initiativeId?)` | `raid_mitigation` | jw. | `raidItemId` |
   | `listManagerExecutionActions(org, initiativeId?)` | `manager_execution_action` | jw. | `managerActionId` |
   | `listManagerSuggestionReviews(org, initiativeId?)` | `manager_suggestion_review` | jw. | `suggestionId` |

   **Nazwa klucza musi zgadzać się z tym, co komenda zapisuje** — sprawdź
   w `executionControlWrites.ts` (`:41` `entryId`, `:85` `realizationId`,
   `:100` `raidItemId`, `:168` `managerActionId`, `:183` `suggestionId`).
   Rozjazd nazw = kontrakt, którego front nie da się zaimplementować.
3. **Ścieżki odczytu — reguła rozstrzygająca.** Zlecenie mówi „podpięte pod
   ISTNIEJĄCE trasy odczytu Execution". **Sprawdziłem: dla budżetu taka trasa
   istnieje i front ją woła; dla pozostałych czterech NIE ISTNIEJE ŻADNA.**
   Wiążąca decyzja, dwutorowa:

   - **Budżet → istniejąca trasa legacy**, wzbogacona addytywnie. To jest
     `§D.4` pkt 1–2 i **tam jest jej DoD**. Nie duplikujesz tego tutaj.
   - **Pozostałe cztery → NOWE trasy `GET` w runtime-v1**, addytywne,
     symetryczne do tras zapisu:

     ```
     GET /initiatives/:initiativeId/realizations
     GET /initiatives/:initiativeId/raid-mitigations
     GET /initiatives/:initiativeId/manager-actions
     GET /initiatives/:initiativeId/manager-suggestion-reviews
     ```

     Kształt handlera kopiujesz z `initiativesExecutionRuntime.routes.ts:4930-4948`
     (`/interventions`): `actorFromRequest` → `401` przy braku aktora →
     `deps.reader.listX(actor.organizationId, ...)` →
     **`filterVisibleAggregates(actor, items, '<typ>', (i) => i.<klucz>)`**
     (`:1278-1291`) → `res.json({ items })`.

     **★ `filterVisibleAggregates` jest OBOWIĄZKOWY, nie opcjonalny.** Bez
     niego odczyt widzi wszystko w organizacji, ignorując uprawnienia
     projektowe. To jest ta sama klasa błędu co `A6`, tylko po stronie odczytu.
     **Uwaga:** filtr rozwiązuje projekt przez
     `resolveProjectIdsForAggregate(org, aggregateType, aggregateId)`
     (`:1263-1276`). Sprawdź w `postgresInitiativeReader.ts:131`, czy ta
     metoda umie rozwiązać **Twoje** typy agregatu. **Jeśli nie umie i zwraca
     pustą listę — `canViewAggregate` zwróci `false` i lista będzie ZAWSZE
     PUSTA.** To jest najbardziej prawdopodobny tryb cichej porażki tej
     pozycji. Wykryjesz go **wyłącznie testem**, w którym uprawniony aktor
     widzi zaseedowaną pozycję (DoD pkt 1). Gdyby trzeba było rozszerzyć
     `resolveProjectIdsForAggregate` — **wolno, addytywnie** (przez
     `initiativeId` z `payload_json`, wzorem istniejących gałęzi), z wpisem
     w raporcie.
   - **Nie dokładasz tych czterech list do istniejących kopert** (`/my-work/execution`,
     `/execution-cases/:id/work`) — to zmiana kontraktu dla dzisiejszych
     konsumentów, czyli STOP (`§0.5`).
4. **★ ODCZYT NIE ZMIENIA ZNACZENIA ŻADNEGO ISTNIEJĄCEGO POLA.** Pola
   **dokładasz**, nigdy nie zmieniasz i nie usuwasz. Jeżeli okaże się, że
   uczciwe pokazanie danych wymaga zmiany kształtu koperty, którą czyta
   dzisiejszy konsument z inwentarza BLOK 0 pkt 9 — **STOP z rekomendacją**,
   opisany co do pola. To jest **jedyna** furtka wyjścia z tej pozycji, i musi
   być poparta konkretnym `plik:linia` konsumenta, nie przypuszczeniem.
5. **Uczciwy pusty stan.** Inicjatywa bez pozycji zwraca `{ items: [] }`
   z `200` — **nigdy `404`, nigdy `null`, nigdy zmyślonego zera** (`Z16`).
   Nieistniejąca inicjatywa albo brak zdolności → `404` (fail-closed).
6. **Zakres tylny; front NIE jest tu ruszany.** Po tej pozycji prawdą będzie,
   że backend przyjmuje zapis **i zwraca go w odczycie**. **Nie zdejmujesz
   `disabled`** (`§1.6`). Produktem dla frontu jest `§D.10`.

**DoD `§D.5` (wyższe minimum, per każda z pięciu projekcji):**

1. **test HTTP na realnym PG**, montujący domyślny eksport routera, w którym
   **zapis kanoniczny jest natychmiast widoczny w odczycie** — pełna pętla
   `POST → GET`, **nie readback z koperty odpowiedzi**;
2. test **uczciwego pustego stanu** (`{ items: [] }`, `200`);
3. **negatyw tenanta**: aktor obcej organizacji nie widzi ani jednej pozycji
   (obcy `organizationId` w body **i** w nagłówku kontekstu → `404` albo pusta
   lista, **nigdy cudze dane**);
4. **negatyw zdolności**: aktor bez zdolności → `404`, **nigdy `200` z listą**;
5. test **izolacji dwóch organizacji**: obie mają pozycję o tym samym
   `aggregateId`, każda widzi **wyłącznie swoją** (readback niezależnym
   połączeniem, porównanie **całego zbioru** identyfikatorów, nie jego długości);
6. **dowód osiągalności (`Z21`) wpisany dosłownie**: wejście HTTP → bramka →
   `ie_aggregate_state` → czytnik → trasa → **konsument w `src/` albo jawne
   „brak konsumenta, front dostaje kontrakt `§D.10`"**;
7. commit.

---

## §D.6 — PIĘĆ KOMEND PRZESTAJE BYĆ CREATE-ONLY

Zastane (`initiativesExecutionRuntime.routes.ts:794,806,815,823,830`):

```ts
expectedVersion: z.literal(0),
```

**Skutek: każda z pięciu komend jest jednorazowa.** Mitygacja ryzyka RAID jest
**zapisywalna raz i nigdy nie do poprawienia** — a mitygacja, której nie da się
zaktualizować, jest w doradztwie bezużyteczna: plan reakcji zmienia się przy
każdym przeglądzie. To samo dotyczy realizacji (korekta miesiąca) i pozycji
budżetu (korekta kwoty). **Bez tej pozycji `§D.4` nie ma czym udowodnić kroku
`UPDATE`, a `§D.5` pokaże wyłącznie stan pierwotny.**

1. **Zmiana we wszystkich pięciu schematach:**

   ```ts
   expectedVersion: z.number().int().min(0),
   ```

   Dokładnie taki kształt ma już `SignalIngestSchema:783` i
   `InterventionDraftSchema:838` — **trzymasz konwencję zastaną, nie wymyślasz
   nowej**.
2. **Nic więcej nie zmieniasz w warstwie komendy.** `executeMaterialCommand`
   już obsługuje oba przypadki poprawnie:
   - `createIfMissing === true && currentVersion === null && expectedVersion === 0`
     → tworzenie (`materialCommand.ts:485-488`);
   - w przeciwnym razie `currentVersion !== expectedVersion` → `409`
     (`:489-495`).

     Czyli **aktualizacja z `expectedVersion: 1` na agregacie w wersji 1
     zadziała bez żadnej dodatkowej linii kodu.** `createIfMissing: true`
     w trasach zostaje — jest bezpieczne, bo jego gałąź wymaga `expectedVersion === 0`.
3. **★ Sprawdź, czy nie osłabiasz istniejącej asercji.** Jeżeli którykolwiek
   test asertuje `400 VALIDATION_FAILED` dla `expectedVersion: 1` — **nie
   kasujesz go**, przepisujesz na nowy, prawdziwy kontrakt i wpisujesz
   „przed/po" dosłownie (`§0.4a` pkt 7). Podejrzane miejsca:
   `day31.canonical-writer-contract.pg.test.ts`,
   `server/src/routes/pmo/__tests__/*`.
4. **Nie zmieniasz `expectedVersion` w komendzie polityki z `§D.2`** — tam od
   początku ma być `z.number().int().min(0)`.

**DoD `§D.6`:** **test aktualizacji `v1 → v2` dla każdej z pięciu komend**
(`POST` z `expectedVersion: 0` → `201`; `POST` z `expectedVersion: 1`
i **innym** `clientRequestId` → `2xx`; readback niezależnym połączeniem:
`version = 2` i **zmieniona wartość w `payload_json`**); test, w którym `POST`
z `expectedVersion: 0` na istniejącym agregacie → **`409`** (CAS nadal
strzeże); test, w którym `expectedVersion: -1` → `400`; wpis „przed/po" dla
każdej osłabionej asercji; commit.

---

## §D.7 — OKNO MIARY LICZONE PO DACIE NALEŻNEJ, NIE PO `updated_at`

Zastane (`ownerIndependentKpiReader.ts:52-53`):

```sql
AND item.updated_at >= $2::date
AND item.updated_at <  $2::date + INTERVAL '7 days'
```

**`updated_at` to znacznik zmiany wiersza, nie zdarzenie biznesowe.** Skutek:
każda edycja zadania **przenosi je do innego tygodnia sprawozdawczego**. Miara
„plan-delivery" za tydzień 2026-08-03 zmienia wartość, gdy ktoś w październiku
poprawi literówkę w tytule zadania. **To nie jest miara — to funkcja czasu
edycji.** Klasa błędu: **miara, której nie da się powtórzyć**, przy kontrakcie
modułu, który wprost wymaga porównania z poprzednim okresem
(`MODULE_ACCEPTANCE.md:135`).

1. **Okno liczysz po dacie należnej z ładunku**, nie po `updated_at`:

   ```sql
   AND (item.payload_json->>'dueAt')::timestamptz >= $2::date
   AND (item.payload_json->>'dueAt')::timestamptz <  $2::date + INTERVAL '7 days'
   ```

   **`INTERVAL '7 days'` zostaje** — to szerokość tygodnia sprawozdawczego,
   jawnie dopuszczona w `§0.4` pkt 13, **nie próg `E-O4`**.
2. **★ Nie wszystkie trzy typy agregatu mają `dueAt`.** Zapytanie obejmuje
   `execution_task`, `execution_milestone` i `intervention_case` (`:51`),
   a `metric()` filtruje `plan-delivery` po `typeof payload_json.dueAt === 'string'`
   (`:84`) — czyli **kamienie milowe mają `targetAt`** (por.
   `postgresInitiativeReader.ts:331`), a przypadki interwencji najpewniej nie
   mają ani jednego. **Nie zgaduj.** Sprawdzasz na swojej bazie, co realnie
   siedzi w `payload_json` każdego z trzech typów, wynik wklejasz do raportu,
   i **dla każdego typu wybierasz jego własne pole daty należnej**:
   `dueAt` → `targetAt` → i tak dalej.
3. **★ Wiersz bez daty należnej NIE WPADA do okna i NIE JEST liczony jako
   spóźniony.** Zostaje **poza populacją** — i to musi być widoczne
   w mianowniku, nie ukryte. `NULL` po `::timestamptz` jest fałszem w obu
   porównaniach, więc dzieje się to samo z siebie; **udowadniasz to testem**,
   a nie zakładasz.
4. **★ Uważaj na rzutowanie.** `(payload_json->>'dueAt')::timestamptz` na
   wartości, która nie jest datą, **rzuca wyjątek i wywala całe zapytanie**.
   Zabezpieczasz się filtrem po kształcie (np. `payload_json->>'dueAt' ~
   '^\d{4}-\d{2}-\d{2}'`) albo `NULLIF`-em — **wybór jest Twój, dowód testem
   z wierszem o zepsutej dacie jest obowiązkowy**.
5. **Nie zmieniasz definicji żadnej rodziny miary.** Zmieniasz **wyłącznie
   sposób wyznaczenia okna**. Rodziny, wzory, nazwy, `valueReason` — bez zmian
   (`Z16`).
6. **Nie ruszasz zapytania o zależności** (`:60-73`) — ono filtruje po
   `dependency.created_at`, czyli po znaczniku powstania relacji, i to jest
   poprawne.

**DoD `§D.7`:** test, w którym zadanie ma `dueAt` **w tygodniu**, a `updated_at`
**poza nim** — i **wchodzi do populacji**; test odwrotny — `dueAt` poza,
`updated_at` w tygodniu — i **NIE wchodzi**; test, w którym `UPDATE` na wierszu
**nie zmienia wyniku miary** (dwa wywołania `GET /control-kpis` przed i po
zmianie w bazie dają **identyczny** licznik i mianownik); test wiersza bez daty
należnej (poza populacją, brak wyjątku); test wiersza z **zepsutą** datą (brak
wyjątku, wiersz poza populacją); tabela `typ agregatu → pole daty należnej →
dowód z bazy`; commit.

---

## §D.8 — `SOURCE_NOT_EVENT_SOURCED` PRZESTAJE BYĆ KŁAMLIWĄ ETYKIETĄ

**Przeczytaj najpierw trzynasty punkt erraty (`§1.2`) — poprawia on zlecenie.**

Zastane (`reportReconstruction.ts:71-77`):

```ts
reason: (source.accessState === 'DENIED'
  ? 'ACCESS_DENIED'
  : hasVersionReader
    ? 'NO_EVENT_HISTORY_BEFORE_AS_OF'
    : 'SOURCE_NOT_EVENT_SOURCED') as ReconstructionGapReason,
```

`hasVersionReader` to `Array.isArray(resolvedVersionsOrReconstructedAt)`
(`:50`). Jedyny produkcyjny wołacz — `initiativesExecutionRuntime.routes.ts:5131-5138`
— ma `deps.asOfVersions` **zawsze okablowane** (`:6263`), więc zawsze podaje
tablicę. **Gałąź `'SOURCE_NOT_EVENT_SOURCED'` w linii `:76` jest w produkcji
nieosiągalna**; osiągalna jest wyłącznie przez wstrzyknięty `deps` w teście,
czyli dokładnie przez klasę `Z22`.

**Dlaczego to szkodzi.** Powód luki jest **etykietą pokazywaną użytkownikowi**
i wchodzi do stopki wiarygodności raportu. Etykieta, która nie może wystąpić,
oznacza jedno: **gdyby kiedykolwiek wystąpiła, byłaby fałszywa**. Do tego
utrzymuje w kodzie martwą gałąź, którą kolejny wykonawca uzna za żywą.

1. **Ruszasz WYŁĄCZNIE gałąź `:76`.** Masz dwie dopuszczalne drogi — wybierasz
   jedną i **uzasadniasz wybór w raporcie**:
   - **(a) usunięcie martwej gałęzi**: `hasVersionReader` przestaje decydować
     o powodzie w tym miejscu, bo w produkcji jest zawsze `true`; powód luki
     przy dostępnym źródle bez wersji to `'NO_EVENT_HISTORY_BEFORE_AS_OF'`.
     Wtedy **wariant `string` parametru staje się bezużyteczny** — i albo
     znika z sygnatury (**jeśli i tylko jeśli** grep pokaże zero innych
     wołaczy), albo zostaje z komentarzem „legacy, nieosiągalne";
   - **(b) uczynienie gałęzi osiągalną i prawdziwą**: powód
     `'SOURCE_NOT_EVENT_SOURCED'` przysługuje źródłu, którego **typ** nie jest
     event-sourced — czyli decyzja zapada **po `sourceType`**, nie po tym, czy
     wołacz podał tablicę. Wymaga listy typów event-sourced, a takiej listy
     w repo **nie widzę** — więc jeśli wybierzesz `(b)`, **musisz ją najpierw
     udowodnić grepem**, a nie wymyślić.
   **Rekomendacja: `(a)`**, bo nie wprowadza nowej wiedzy dziedzinowej.
2. **Gałęzi `:87` NIE RUSZASZ.** `run.sources.length === 0` to realny stan
   (run bez źródeł) i `'SOURCE_NOT_EVENT_SOURCED'` jest tam **prawdziwe**.
3. **Nie zmieniasz nazw wartości `ReconstructionGapReason`** (`:3-7`) — to
   kontrakt dla frontu i dla `MODULE_ACCEPTANCE.md`. **Usunięcie wartości
   z unii = STOP.** Wolno Ci przestać ją produkować w jednym miejscu, nie
   wolno usunąć jej z typu.
4. **Nie ruszasz `reconstructable`** (`:93`) — to dorobek `B.5` dnia 31.

**DoD `§D.8`:** grep dowodzący, **ile jest produkcyjnych wołaczy**
`reconstructReportRun` i który wariant parametru podają (wklejony dosłownie);
test na realnym PG przez **domyślny eksport routera**, w którym run ze źródłem
bez historii przed `asOf` daje powód `'NO_EVENT_HISTORY_BEFORE_AS_OF'`,
**nie** `'SOURCE_NOT_EVENT_SOURCED'`; test, w którym run **bez źródeł** nadal
daje `'SOURCE_NOT_EVENT_SOURCED'` (gałąź `:87` nietknięta); test
`'ACCESS_DENIED'` (nietknięty); commit.

---

## §D.9 — PROWENIENCJA: KONIEC `sourceVersion: 1` I KOPERTOWEGO `'PARTIAL'`

Dwie wartości zaszyte na sztywno, identyczne dla każdej organizacji i każdego
stanu danych:

| Miejsce | Kod | Co mówi dziś |
| --- | --- | --- |
| `ownerIndependentKpiReader.ts:103` | `sourceVersion: dependencyPopulation.length > 0 ? 1 : 0` | „wersja źródła zależności to zawsze 1" — czyli nic |
| `controlKpiReadModel.ts:92` | `scopeCompleteness: 'PARTIAL' as const` | koperta zawsze `PARTIAL`, niezależnie od tego, czy wszystkie rodziny są policzone |

Kontrakt modułu wymaga czegoś dokładnie odwrotnego:

> „Every number drills down to source identity/version, capture time,
> transformation and value class." (`MODULE_ACCEPTANCE.md:282`)

1. **`dependency.sourceVersion`** — realna wartość ze źródła. Zależności żyją
   w tabeli `initiative_dependencies` (`ownerIndependentKpiReader.ts:63`),
   która **nie jest** rodziną `ie_*` i **może nie mieć kolumny wersji**.
   **Sprawdzasz `\d initiative_dependencies` na swojej bazie i wklejasz wynik
   do raportu PRZED napisaniem linijki kodu.** Trzy dopuszczalne wyjścia:
   - jest kolumna wersji → bierzesz jej `MAX` w populacji;
   - nie ma, ale jest `updated_at`/`created_at` → **STOP z rekomendacją**,
     bo znacznik czasu **nie jest wersją** i podstawienie go byłoby atrapą
     (`Z23`);
   - nie ma nic → **zostawiasz `0` i wpisujesz `BRAK_DANYCH` do raportu**.
     `0` jest wtedy **uczciwe**, bo `§B.8` dnia 31 ustaliło, że `0` zostaje
     tam, gdzie miary nie policzono ze źródła wersjonowanego.

   **Czego NIE robisz: nie zostawiasz `1`.** `1` to zaszyta nieprawda; `0`
   z jawnym `BRAK_DANYCH` to uczciwy brak.
2. **Kopertowe `scopeCompleteness`** — ma **wynikać** ze stanu rodzin, które
   już są policzone per rodzina (`controlKpiReadModel.ts:74-78`: `FULL` /
   `NO_POPULATION` / `NOT_CALCULABLE`). Reguła wiążąca, bez nowych wartości
   w unii:
   - wszystkie osiem rodzin `FULL` → koperta `FULL`;
   - żadna nie jest `FULL` → koperta `NOT_CALCULABLE`;
   - mieszanka → koperta `PARTIAL`.

   **Nie wprowadzasz nowych nazw stanów** — to kontrakt dla frontu.
   **Nie ruszasz logiki per rodzina** (`:74-83`) — to dorobek `B.8` dnia 31.
3. **`calculatedAt` (`:51,84,93`) — nie ruszasz.**
4. **`drillDown.ids` — nie ruszasz.** Dzień 31 zbudował je z realnych danych
   i odbiór to potwierdził.
5. **★ Uwaga na kolizję z dyżurem 33.** `controlKpiReadModel.ts` jest plikiem
   współdzielonym: dyżur 33 dokłada **pola do rodzin**, Ty ruszasz **wyłącznie
   linię `:92`**. Zmiana ma być **addytywna co do linii**, żeby scalenie było
   możliwe (`§1.9`).

**DoD `§D.9`:** wynik `\d initiative_dependencies` wklejony dosłownie
i uzasadnienie wybranego wyjścia dla `sourceVersion`; **test, w którym koperta
zwraca trzy RÓŻNE wartości `scopeCompleteness` dla trzech różnych stanów danych**
(pusta organizacja → `NOT_CALCULABLE`; część rodzin policzona → `PARTIAL`;
wszystkie policzone → `FULL`); test, w którym rodzina niepoliczona **nadal** ma
`ids: []` i `sourceVersion: 0` (uczciwie, `Z16`); commit.

---

## §D.10 — KONTRAKT DLA FRONTU (produkt podziału FRONT/TYŁ)

**Pozycja dokumentacyjno-kodowa. To jest wszystko, co dostaje przyszły dyżur
frontowy — i jedyne, co ma prawo dostać.**

Kontrakt zapisujesz **w raporcie** (`§R.2`), w sekcji „★ KONTRAKT DLA FRONTU".
**Nie tworzysz osobnego pliku** (`Z13`).

Musi zawierać, dla **każdej** trasy dodanej albo zmienionej w tym dyżurze:

| Kolumna | Treść |
| --- | --- |
| Metoda + ścieżka | pełna, z prefiksem montażu (`/api/initiatives/runtime-v1/...` albo `/api/execution-control/...`) |
| Kształt żądania | pola, typy, które są wymagane; **jawnie: które mają wartość domyślną — oczekiwane „żadne"** |
| Kształt odpowiedzi | pełny, z nazwami kluczy identyfikatora (`entryId`, `realizationId`, `raidItemId`, `managerActionId`, `suggestionId`, `policyId`) |
| Kody błędów | `401` / `400` / `404` / `409` — **i co każdy znaczy** |
| Wymagana zdolność | `initiative.view` / `initiative.update` / `initiative.review` |
| Czego kontrakt NIE daje | jawnie, zdaniami |

**★ Cztery zdania, które MUSZĄ się w kontrakcie znaleźć dosłownie:**

1. **„Przyciski w `src/components/Execution/**` pozostają `disabled`.**
   Backend przyjmuje zapis i zwraca go w odczycie, ale zdjęcie `disabled`
   wymaga osobnego dyżuru frontowego z prototypem i akceptem właściciela na
   zrzutach (reguła 7 `CLAUDE.md`)."
2. **„Pozycja budżetu o `origin: 'CANONICAL'` kasuje się przez
   `POST .../budget-entries/:entryId/void`, a pozycja o `origin: 'LEGACY'` —
   przez `DELETE /api/execution-control/budget/entries/:entryId`.**
   To jest jawny stan przejściowy, nie defekt."
3. **„Trasa polityki progów nie ma i nie będzie miała wartości domyślnych.**
   Polityka niekompletna zapisuje się jako niekompletna, a rodziny miar od niej
   zależne pozostają `DECISION_REQUIRED` z listą `missingParameters`. Wartości
   początkowe (`E-O3`/`E-O4`/`E-O5`) wpisuje konsultant w ekranie, którego
   jeszcze nie ma."
4. **„Dla realizacji, mitygacji RAID, akcji menedżera i przeglądów sugestii
   nie ma dziś ŻADNEGO konsumenta w `src/`** — trasy odczytu powstały
   w tym dyżurze i czekają na dyżur frontowy."

**Dodatkowo, w tej samej sekcji raportu — gotowy tekst bramki wejściowej
dyżuru 33** (`§1.9`, ramka), z wynikiem jej przebiegu na Twojej gałęzi.

**DoD `§D.10`:** tabela kontraktu dla **każdej** trasy dodanej/zmienionej;
cztery zdania dosłownie; tekst bramki 33 z wynikiem; **jawna lista rzeczy,
których front NIE dostanie** (paginacja list, filtrowanie po okresie, sortowanie
konfigurowalne, kasowanie kanoniczne z legacy `DELETE`); commit dokumentacyjny.

---

## §R.1 — `MODULE_ACCEPTANCE.md` 06_EXECUTION DO STANU FAKTYCZNEGO

`docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md`
— **wyłącznie w zakresie tego dyżuru**:

1. Dopisujesz ustalenia z **nowymi** identyfikatorami, kontynuując zastaną
   numerację (na markerze najwyższe: `EXE-PF-010`, `EXE-OWN-008` — **sprawdź
   sam**, BLOK 0 pkt 4 `(l)`). Każde ustalenie ma `plik:linia` i status.
2. **Nie przepisujesz historii.** Nie zmieniasz wpisów dnia 11, partii A ani
   dnia 31. **Raportów tamtych dni nie edytujesz** (`Z13`).
3. **Nie podnosisz oceny modułu.** Ocena `3,6/10` pochodzi z panelu
   eksperckiego i zmienia ją panel, nie wykonawca.
4. Wpisujesz **jawnie**, co po tym dyżurze **nadal** jest otwarte: brak ekranu
   polityki, brak ekranu budżetu kanonicznego, `disabled` na przyciskach,
   rozdwojony sposób kasowania pozycji budżetu, brak konsumenta dla czterech
   nowych tras odczytu.

**DoD `§R.1`:** wpisy z nowymi ID i dowodami; zero zmian w cudzych wpisach;
commit dokumentacyjny.

---

## §R.2 — RAPORT

Jedyny dokument, który tworzysz:
`docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_READ_PROJECTIONS_DAY35_REPORT_20260828.md`.
Szablon w `§9`. **Raport jest WYNIKOWY, nie planistyczny** — opisuje, co
zrobiłeś i czym to udowodniłeś, nigdy co zamierzasz.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~120 min, NIE pomijasz)

Wszystkie jedenaście punktów `BLOKU 0`. **Bramka wejściowa (pkt 8) rozstrzyga,
czy dyżur w ogóle się zaczyna.** Pomiar zastany (pkt 10) **przed** pierwszym
commitem — inaczej nie odróżnisz czerwieni zastanej od wprowadzonej.

### Blok 1 — fundament polityki (`D.1` → `D.2` → `D.3`)

**Kolejność jest wiążąca.** `D.1` przed `D.2`, bo bez tenantowego klucza `D.2`
jest bombą. `D.3` bezpośrednio po `D.2`, bo bez niego `D.2` nie dostaje
`ZROBIONE_WG_DoD`. Trzy commity.

### Blok 2 — sedno (`D.6` → `D.4` → `D.5`)

**`D.6` idzie PRZED `D.4`**, bo pełny cykl `create→read→update→delete` z `D.4`
wymaga działającej aktualizacji. Potem `D.4` (rozstrzygnięcie i budżet), potem
`D.5` (pozostałe cztery projekcje). Trzy commity.
**To jest blok, który waży najwięcej. Jeśli zabraknie czasu, kończysz TU, a nie
w bloku 3.**

### Blok 3 — proweniencja i uczciwość miar (`D.7` → `D.8` → `D.9`)

Trzy niezależne P1. Kolejność dowolna, trzy commity.

### Blok 4 — kontrakt (`D.10`)

Piszesz **po** blokach 1–3, bo kontrakt opisuje stan faktyczny, nie zamiar.

### Blok 5 — domknięcie (obowiązkowo, ~90 min)

1. Pomiar **końcowy** `§0.4a` (pełny zakres, obie liczby, `SKIPPED` osobno).
2. **Dowody bezpieczników — wszystkie muszą być PUSTE:**

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD -- src/
   git diff --name-only «MARKER_SHA»...HEAD -- tests/setup.ts tests/helpers tests/__mocks__ 'vitest*.config.ts' server/vitest.config.ts
   git diff --name-only «MARKER_SHA»...HEAD -- server/src/middleware/executionSpineLegacyReadOnly.middleware.ts server/src/Gateway.ts server/src/routes/v8/index.ts server/src/routes/pmo/initiatives.routes.ts
   git diff --name-only «MARKER_SHA»...HEAD -- server/src/domain/initiatives-execution/materialCommand.ts
   git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/executionBudgetService.ts
   git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/effectiveAccessService.ts server/src/controllers/ExecutionController.ts
   git stash list
   ```

3. **Dowód braku zaszytych progów** (`§0.4` pkt 13) — wynik i wyjaśnienie
   każdego trafienia.
4. **SHA plików chronionych przed/po** (`materialCommand.ts`,
   `executionBudgetService.ts`).
5. **Higiena danych** — trzy `SELECT COUNT(*)` z `§D.3`, wszystkie `0`.
6. `§R.1`, potem `§R.2`. Dwa commity dokumentacyjne.
7. **Sprzątanie**: `docker rm -fv cx-day35-pg`. **NIGDY `docker volume prune`.**
8. Opcjonalny push **wyłącznie** na `github-backup`, **wyłącznie** własnej
   gałęzi (`Z1`).

### Zasada nadrzędna kolejności

**Lepiej sześć pozycji z pełnym DoD niż dwanaście „prawie".** Pozycja bez testu
behawioralnego na realnym PG **nie jest zrobiona** — jest długiem z etykietą
„gotowe", czyli dokładnie tym, co ten program zwalcza. Pozycja niezaczęta
dostaje `NIE_ZACZĘTE` i jedno zdanie dlaczego; to jest **uczciwy** wynik.

---

## 9. RAPORT — jedyny dokument, który tworzysz

### 9.1. Szablon

```markdown
# Realizacja dzień 35 — zapis polityki, projekcje odczytu, cykl życia budżetu — raport dyżuru <data>

Gałąź: codex/execution-day35-<data> · baza: «MARKER_SHA» · Poziom ukończenia: <...>
Kontener: cx-day35-pg, port <5641 lub inny, jeśli zajęty>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)
## Oświadczenie o zakazie `git stash` (Z27) — wynik `git stash list`
## Dowód celu połączenia (Z20/Z25/Z26)
## ★ WERYFIKACJA ERRATY §1.2 — dwanaście punktów + trzynasty
| Ustalenie | Moja komenda | Mój wynik | ZGADZA SIĘ / NIE ZGADZA SIĘ |
## Warunki wstępne — tabela (BLOK 0 pkt 2, 4)
## ★★ BRAMKA WEJŚCIOWA (BLOK 0 pkt 8) — sześć podpunktów, wyniki dosłownie
## ★ USTALENIE REAL_PG (BLOK 0 pkt 7)
## ★ INWENTARZ KONSUMENTÓW (BLOK 0 pkt 9)
## Pozycje — tabela zbiorcza
| Pozycja | Status | Commit SHA | Dowód osiągalności | Dowód testowy |
## ★ DOWODY OSIĄGALNOŚCI (Z21/DEC-104) — obowiązkowe dla KAŻDEJ pozycji
## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z22/DEC-107) — który test montuje domyślny eksport

## Tabele werdyktów
### D.1 — klucz tenantowy | `\d` PRZED | `\d` PO | COUNT(*) przed przekuciem | migracja x2 (no-op?) | test dwóch org |
### D.2 — polityka | Element (plik domenowy / metoda UoW / trasa) | Dowód | SHA materialCommand.ts PRZED/PO | pusty git diff? |
### D.2b — dowód braku wartości domyślnych | grep `default(` w schemacie | wynik |
### D.3 — brak atrapy | Dowód (1-6) | Liczby PRZED | Liczby PO | Pool niezależny? |
### D.3b — ★ BRAMKA 33 | krok | oczekiwane | wynik na mojej gałęzi |
### D.4 — cykl budżetu | Krok cyklu | Trasa | Wynik | Readback (version, status) |
### D.4b — SHA executionBudgetService.ts PRZED/PO + pusty git diff
### D.5 — projekcje | Typ agregatu | Metoda czytnika | Trasa odczytu | filterVisibleAggregates? | Test POST→GET | Izolacja 2 org |
### D.6 — CAS | Komenda | v0→v1 | v1→v2 | v0 na istniejącym → 409 | Osłabione asercje (przed/po) |
### D.7 — okno miary | Typ agregatu | Pole daty należnej | Dowód z bazy | Test „UPDATE nie zmienia miary" |
### D.8 — powód luki | Wybrana droga (a)/(b) | Uzasadnienie | Liczba produkcyjnych wołaczy | Gałąź :87 nietknięta? |
### D.9 — proweniencja | `\d initiative_dependencies` | Wybrane wyjście dla sourceVersion | Trzy różne scopeCompleteness — dowód |
### D.10 — kontrakt | (pełna tabela kontraktu + cztery zdania dosłownie + tekst bramki 33)

## ★ KONTRAKT DLA FRONTU (produkt §1.6)
## Decyzje właścicielskie — POZA ZAKRESEM, nienaruszone (E-O3/E-O4/E-O5)
## Migracje (MIGRATION_PREPARED; numer z przedziału 20261240-49; dowód idempotencji)
## ★ POMIAR TESTÓW (Z24) — PEŁNY zakres §0.4a
### Zakres §0.4a: X/Y PASS, S SKIPPED
### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik
### Czerwone WPROWADZONE — per plik + SHA commitu, który je zapalił
### SKIPPED z powodu env (w tym: ile z powodu REAL_PG)
### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 7)
### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć
### Jawne zdanie: NIE przepisałem liczb dnia 11, dnia 31 ani „78 PASS" z DEC-128 — zmierzyłem sam
## ★ Dowód braku atrapy (Z23)
## ★ Dowód braku zaszytych progów (§0.4 pkt 13) — wynik grepa + wyjaśnienie każdego trafienia
## ★ Higiena danych (EXE-PF-002) — trzy SELECT COUNT(*) = 0
## Bezpieczniki — dowody (pusty diff, siedem komend z §8 Blok 5 pkt 2)
## Errata i korekty wobec instrukcji
## Znaleziska (NIE naprawiane przeze mnie)
## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — <pozycja>
## Licznik (12 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / BRAK_POTRZEBY / NIE_ZACZĘTE)
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
   = naruszenie `Z24`.
4. **`SKIPPED` nigdy nie jest raportowane jako `PASS`** (`Z26`).
5. **Statusy pozycji są rozłączne i jednoznaczne**: `ZROBIONE_WG_DoD` /
   `CZĘŚCIOWO` (+ czego brakuje) / `STOP` (+ format z `§0.5`) / `BRAK_API` /
   `BRAK_POTRZEBY` (+ dowód) / `NIE_ZACZĘTE` (+ jedno zdanie dlaczego).
   **`CZĘŚCIOWO` bez wyliczenia braków jest odrzucane.**
6. **Rozbieżność wobec instrukcji idzie do „Korekt wobec instrukcji"**, wraz
   z Twoim dowodem — nie do cichej improwizacji i nie do milczenia.
7. **Znaleziska poza zakresem opisujesz, nie naprawiasz.** Znane już do
   odnotowania: redundantny indeks po `§D.1`; polski `'BRAK_ŹRÓDŁA'` obok
   angielskiego `'DECISION_REQUIRED'` (`controlKpiReadModel.ts:71`); dwie
   równoległe serie numeracji migracji; `policyId: 'execution-control'` zaszyty
   w pięciu kopertach komend (`:4634` i cztery analogiczne).

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM (uwaga na plik 6290-liniowy, §0.3)
npx prettier --write <pliki tego commita>

# typy punktowo (NIGDY pełny tsc)
npx esbuild server/src/domain/initiatives-execution/executionControlKpiPolicyAuthoring.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run --config server/vitest.config.ts server/src/domain/initiatives-execution/__tests__/<plik>

# ★ test celowany Z bazą — ZAWSZE tak (Z20/Z25/Z26), SZEŚĆ zmiennych W TEJ SAMEJ LINII
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5641/cx_day35" DB_TYPE=postgres NODE_ENV=test \
  RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true \
  npx vitest run --config server/vitest.config.ts server/src/routes/pmo/__tests__ --no-file-parallelism

# numeracja migracji — PRZED KAŻDYM NOWYM PLIKIEM, TYLKO 20261240-20261249
ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5
ls server/migrations | grep -E '^202612[4]'        # MUSI być PUSTE przed utworzeniem pliku

# migracje — jednorazowy kontener
docker run -d --name cx-day35-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day35 -p 5641:5432 pgvector/pgvector:pg16
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5641/cx_day35" DB_TYPE=postgres npx tsx server/src/db/migrate.postgres.ts
docker exec cx-day35-pg psql -U postgres -d cx_day35 -c "\d execution_control_kpi_policies"

# sprzątanie (obowiązkowe) — NIGDY docker volume prune
docker rm -fv cx-day35-pg

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only «MARKER_SHA»...HEAD

# dowód, że nie zaszyłem progów (§0.4 pkt 13)
git diff «MARKER_SHA»...HEAD | grep -nE '^\+.*\b(7|14|15|30|80|95|0\.[0-9]+)\b'

# dowód, że plik chroniony jest bit-identyczny
git diff «MARKER_SHA»...HEAD -- server/src/domain/initiatives-execution/materialCommand.ts
git diff «MARKER_SHA»...HEAD -- server/src/services/executionBudgetService.ts

# odłożenie stanu roboczego — ZAMIAST git stash (Z27)
mkdir -p /private/tmp/consultify-execution-day35-scratch
cp <plik> /private/tmp/consultify-execution-day35-scratch/
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Powtórzyć STOP na `§D.2`** przy wydanej licencji i opisanym wariancie.
2. **Ruszyć `materialCommand.ts`** — plik chroniony, dowód SHA obowiązkowy.
3. **Zapisać politykę spoza transakcji** (`withPgTransaction`, własny pool)
   → trzeci rejestr komend, złamanie `AMD-EXE-SPINE-AUTHORITY-004`.
4. **Pominąć strażnik fail-closed** w `prepare` — `esbuild` tego nie złapie.
5. **Zrobić `§D.2` przed `§D.1`** — pierwsza organizacja zablokuje resztę.
6. **Zapomnieć `filterVisibleAggregates`** w nowych trasach `GET`
   (`§D.5` pkt 3) — cichy wyciek albo, częściej, zawsze pusta lista.
7. **Zmienić kształt istniejącej koperty odczytu** zamiast dołożyć pole.
8. **Skasować wiersz z `ie_aggregate_state`** zamiast przejścia stanu
   (`§D.4` pkt 5).
9. **Poszerzyć `GOVERNED_EXECUTION_CONTROL_COMMANDS`**, żeby „naprawić" kasowanie
   — to odrzucenie dyżuru, nie skrót.
10. **Zaszyć próg** „na razie 7 dni" — także w teście, także w migracji, także
    w `.default()` schematu Zod.
11. **Zdjąć `disabled` w `src/`**, bo „przecież już działa".
12. **Podać `SKIPPED` jako `PASS`** albo przepisać cudzy baseline.

### 10.3. Czego NIE robisz, choć „aż się prosi"

- Nie migrujesz `budget_entries` → `ie_aggregate_state` (`§D.4` pkt 6).
- Nie usuwasz redundantnego indeksu po `§D.1` (to `DROP`).
- Nie usuwasz `'SOURCE_NOT_EVENT_SOURCED'` z unii typu (`§D.8` pkt 3).
- Nie ujednolicasz `'BRAK_ŹRÓDŁA'` z angielskimi wartościami — to zmiana
  kontraktu, czyli STOP; idzie do „Znalezisk".
- Nie dokładasz paginacji ani filtrów do nowych list — kontrakt najpierw,
  rozbudowa po dyżurze frontowym.
- Nie edytujesz instrukcji dyżuru 33 — podajesz nadzorcy tekst bramki
  w raporcie (`§1.9`, `§D.10`).
- Nie scalasz i nie rebase'ujesz niczego (`Z3`).

---

## 11. NA KONIEC

Ten dyżur ma jedną miarę sukcesu i da się ją wypowiedzieć jednym zdaniem:

> **Po tym dyżurze użytkownik, który zapisze pozycję budżetu, mitygację ryzyka,
> realizację, akcję menedżera albo przegląd sugestii — ZOBACZY TO W ODCZYCIE,
> a konsultant, który dostanie od właściciela progi, BĘDZIE MIAŁ JAK JE WPISAĆ.**

Wszystko inne w tym dokumencie służy temu jednemu zdaniu albo pilnuje, żebyś
po drodze niczego nie zepsuł.

Dwie rzeczy, o których łatwo zapomnieć pod koniec długiego dyżuru:

1. **Uczciwy brak jest wynikiem, atrapa nie jest.** Pozycja z `STOP`
   i dowodem jest warta więcej niż pozycja z zieloną etykietą i zaszytym
   progiem. `UNKNOWN ≠ 0`. Pusta organizacja zostaje pusta.
2. **Front zostaje wyłączony.** Nawet — a właściwie **zwłaszcza** — gdy
   backend już przyjmuje zapis i już go zwraca. Właściciel nigdy nie jest
   pierwszym testerem wizualnym.
