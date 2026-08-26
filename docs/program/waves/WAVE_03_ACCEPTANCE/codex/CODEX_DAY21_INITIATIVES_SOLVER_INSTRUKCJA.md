# INSTRUKCJA DYŻURU nr 21 — Codex — „Inicjatywy: REALNY solver planu zamiast atrapy planowania, lista bez burzy autoryzacyjnej, domknięta pętla zdolności, obciążenie wyprowadzone z planu i przekrój osobowy — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–20. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur wynika z **panelu eksperckiego modułu Inicjatywy** (`DEC-2026-08-26-104`),
który postawił modułowi **4,0/10 przy celu 9,5** i nazwał go paradoksem korpusu:

> **NAJLEPSZY BACKEND W CAŁYM KORPUSIE** (~330 endpointów, event-sourcing,
> wersjonowanie agregatów z blokadą optymistyczną, rozdzielone `request`/`decide`
> na bramkach, uczciwa dyscyplina `UNKNOWN ≠ 0` — fundament wart 8–9) **pod
> produktem wartym 4.**

Tania partia napraw po panelu jest już **scalona** (`DEC-2026-08-26-109`): 12 824
linie nieosiągalnego UI usunięte, atrapy AI zdjęte (DEC-51), akcje statusu
naprawione, martwy router `server/src/routes/initiatives.routes.ts` skasowany.
**To był front i sprzątanie. Ten dyżur to MECHANIKA TYŁU** — sedno, którego tamta
partia świadomie nie tknęła.

Materiały wiążące, które czytasz **przed** startem (są w repo, na Twojej bazie):

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVE_CAPACITY_ANALYSIS_EXPERT_SYNTHESIS_2026-08-23.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVE_PLAN_WHAT_IF_EXPERT_SYNTHESIS_2026-08-23.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVES_IMPLEMENTATION_READY_CONTRACT_2026-08-23.md
```

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★ CAŁE `src/` JEST POZA ZAKRESEM. Bez wyjątku.** Wygląd, Gantt,
   drag&drop, polonizacja Planu i Obciążenia, kolumny, kanban, karta inicjatywy,
   usuwanie martwego UI — **robią robotnicy wewnętrzni**, po prototypie i akcepcie
   właściciela na czystym zrzucie (CLAUDE.md reguła 7: właściciel **nigdy** nie
   jest pierwszym testerem wizualnym). Ty budujesz **TYŁ**: domenę, trasy,
   kontrakty odpowiedzi, semantykę zapisu, testy. Podział jest twardy — §1.6.
2. **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej
   flagi.** Jeżeli uznasz, że potrzebujesz flagi — to jest **STOP**, nie
   improwizacja (CLAUDE.md reguła 9).
3. **Wszystko, co budujesz, musi być realne.** Trasa bez ścieżki zapisu = STOP.
   Brak API pod sekcją → wpis `BRAK_API` z kontraktem, **nigdy** przycisk-widmo.
4. **★ ZAKAZ ATRAPY Z ZEWNĘTRZNYM SKUTKIEM (Z22 / `DEC-2026-08-26-108`).**
   Odpowiedź „sukces" + skutek widoczny na zewnątrz (powiadomienie, zdarzenie
   w outboxie, wpis audytu, e-mail) **przy braku faktycznej zmiany w bazie** =
   odrzucenie pozycji. Dzień 19 poległ dokładnie na tym: `DELETE /occurrence`
   zwracał 200 i rozsyłał `METHOD:CANCEL` uczestnikom, nie zmieniając nic
   w bazie. **Ludzie dostali odwołanie spotkania, które nadal istniało.**
5. **★ `effectiveAccessService` jest NIETYKALNY (Z16).** Pozycja B **nie polega**
   na przyspieszaniu serwisu dostępu. Polega na tym, żeby **nie wołać go 150 razy**
   tam, gdzie wystarczy raz na projekt. Model uprawnień jest naprawiany wewnętrznie,
   po trzech audytach adwersaryjnych (`DEC-105`) — dotknięcie go = odrzucenie dyżuru.
6. **★ Dyscyplina `UNKNOWN ≠ 0` i zakresy zamiast fałszywej precyzji to jedyna
   rzecz, którą ten moduł robi WZOROWO.** `capacityScenario.ts` odrzuca `UNKNOWN`
   z liczbą i wymaga `low ≤ base ≤ high` z wersjonowanym źródłem. **Każda Twoja
   zmiana ma tę dyscyplinę wzmacniać, nigdy nie rozcieńczać.** Wyprowadzenie
   `demand` z planu (pozycja D) **nie może** zamienić uczciwego `UNKNOWN`
   w wyliczone zero.
7. **Odbiór wizualny i decyzja o pokazaniu właścicielowi = nadzorca, po dyżurze.**
   W raporcie piszesz „gotowe do odbioru przez nadzorcę", **nigdy** „gotowe do
   pokazania właścicielowi".
8. **`DEC-65` — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo. Migracje =
   `MIGRATION_PREPARED`, addytywne, kompatybilne wstecz, z dowodem idempotencji
   na jednorazowym lokalnym kontenerze.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**. Nadzorca podaje Ci
   **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/initiatives-fixes-*`, `codex/meetings-day19-*` ani `codex/preserve-*`.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker **JEST** przodkiem,
   ale tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).** Ten
   dyżur zakłada, że **tania partia napraw Inicjatyw (`DEC-109`) jest w Twojej
   bazie**. Sprawdzasz sam; wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) DEC-109 scalone — martwy router usunięty, martwe UI zniknęło
   ls server/src/routes/initiatives.routes.ts          # oczekiwane: No such file
   ls src/components/Initiatives/Analysis 2>/dev/null  # oczekiwane: brak katalogu
   ls src/components/Initiatives/PortfolioHealthView.tsx   # oczekiwane: ISTNIEJE (świadomie zachowany)

   # (b) rdzeń, który naprawiasz — musi istnieć DOKŁADNIE tak
   grep -n "periodFor" server/src/domain/initiatives-execution/planAnalysisProposal.ts
   grep -n "row.initiative.projectId, 'initiative.view'" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   grep -n "const authorizeProjects" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   grep -n "'/capacity-options" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   grep -n "async listInitiatives" server/src/domain/initiatives-execution/postgresInitiativeReader.ts

   # (c) czego NIE WOLNO cofnąć — dyscyplina UNKNOWN≠0
   grep -n "UNKNOWN capacity must remain null with reason" server/src/domain/initiatives-execution/capacityScenario.ts
   grep -n "MUST_NOT_HAVE_NUMERIC_ZERO_OR_VALUES" server/src/domain/initiatives-execution/capacityOptions.ts
   ```

   **Brak (a) = STOP całego dyżuru** — pracujesz na bazie sprzed `DEC-109`.
   Brak (b) = STOP z opisem (ktoś już to ruszył — sprawdź, kto i czym).
   Brak (c) = STOP (ktoś rozcieńczył dyscyplinę `UNKNOWN`).

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-104" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-107" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-108" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-98"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-109" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md   # oczekiwane 141
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/INITIATIVE_CAPACITY_ANALYSIS_EXPERT_SYNTHESIS_2026-08-23.md  # oczekiwane 176
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestr rośnie) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/initiatives-day21-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-initiatives-day21 codex/initiatives-day21-<data>
   cd /private/tmp/consultify-initiatives-day21
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                         | Dlaczego                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/initiatives-day21-<data>`                                                                                                                                                                                                                                                        | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                            |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/initiatives-fixes-*`, `codex/meetings-day*`, `codex/staging-fixes-*`                                                                                                                                                                                                                                                 | `demo` = święta baza; tamte gałęzie są historią odebraną                                                     |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                          | Krach 3/4 powstał tak; DEC-95                                                                                |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                             | Wymagania są w rejestrze uwag i decyzjach                                                                    |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0                                                                                                                                                                                        | Chroniony, brudny worktree właściciela                                                                       |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-day21-instrukcja`, `consultify-initiatives-fixes`, `consultify-day19-instrukcja`, `consultify-meetings-day19`, `consultify-staging-fixes`)                                                                                                                                                                                                 | Cudze worktree, część w użyciu                                                                               |
| Z7      | **Nie zajmujesz portów sesyjnych** (3777, 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300–4306, 4312, 4319, 4324/4325, 4370, 4418, 4428, 4480/4481, 5000, 5037, 5432, 5447, 5449, 5467). **Twój kontener PG = 5471**; lokalny runtime, jeśli konieczny — **4336/4337**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu                                                       | 5467 zajmuje `cx-day19fix-pg`, 5447/5449 dni 17/19                                                           |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65)                                                                                                                                                                                                                                                                                            | Produkcja/demo poza zakresem                                                                                 |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                                                                                                | „dane demo = twarz produktu" (DEC-65)                                                                        |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu"                                                                                                                                                                                                                                                                                               | CLAUDE.md reguła 9                                                                                           |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/initiatives/*`                                                                                                                                                                                                                                                                            | Gramatyka zaakceptowana (`DEC-2026-08-24-07`)                                                                |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/INITIATIVES_DAY21_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`                                                                                                                                           | Repo tonie w dokumentach-duchach                                                                             |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie                                                                                                                                                                                                                                                                                                                   | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                   |
| **Z14** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Pozycja `G.4` dotyczy **uczciwości odpowiedzi**, nie włączania AI. Zero nowych wywołań `llmService`                                                                                                                                                                                                                                                 | Silnik AI = osobny moduł, ostatni w programie; DEC-51                                                        |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/`UNKNOWN`/błędnych.** `UNKNOWN` z `reason` **nie** staje się zerem; `MUST_NOT_HAVE_NUMERIC_ZERO_OR_VALUES` **zostaje**                                                                                                                                                                                                                                              | Uczciwy pusty stan > udawany wynik                                                                           |
| **Z16** | **★★ `server/src/services/effectiveAccessService.ts` jest ABSOLUTNIE NIETYKALNY** — także `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `middleware/*orgStatus*`, `PermissionsService`. Wolno **czytać** i **cytować**. Naprawa `B` polega na **liczbie wywołań**, nie na zmianie serwisu                                                                                                | Model uprawnień naprawiany in-house po 3 audytach (DEC-105); Twoja zmiana zepsułaby TRI-MUST-12              |
| **Z17** | **★ Zakaz wszystkiego poza modułem Inicjatywy** — z imiennymi licencjami z ramki poniżej. Cały front, powłoka SPEC-A, kanon triady, Gantt: **NIE**                                                                                                                                                                                                                                                                            | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                               |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts` (w tym `tests/integration/initiatives-execution/vitest.realdb.config.ts`), `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                     |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego `DATABASE_URL` wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia**                                                                                                                             | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (DEC-96/98)                                  |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą                                                                                                                                                                                                                                                                                                                     | Bramka DoD dnia 60 przepuściła „P.2 ZROBIONE" przy czterech żywych martwych gałęziach                        |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — każda pozycja z wywołaniem zewnętrznym musi mieć **test domyślnego okablowania**                                                                                                                                                                                                                                                 | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`               |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — sukces + efekt na zewnątrz przy braku zmiany w bazie = odrzucenie pozycji                                                                                                                                                                                                                                                                                  | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL` bez zmiany w bazie                                          |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z pełnego zakresu §0.4a, z rozbiciem **zastane / wprowadzone**                                                                                                                                                                                                                                                                                               | Dzień 19 zadeklarował „98/98 PASS" przy 164/167 w zakresie własnej instrukcji i dwóch wniesionych czerwonych |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.**
`server/src/database/Database.ts` przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1`
podstawia **mock DB** i cały pakiet „przechodzi" przeciwko niczemu. Dodatkowo
część odczytów w repo idzie przez `DbPromise` z domyślnym `fallback:true`, więc
brak tabeli potrafi udawać pustą listę. Dlatego **każde** uruchomienie testu
dotykającego bazy ma env **w tej samej linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5471/cx_day21" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day21-pg psql -U postgres -d cx_day21 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący.

**★ Z20 — jak wygląda dowód osiągalności (nowy wymóg DoD, `DEC-104`).**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki)
  → montaż w Gateway.ts (plik:linia)
  → router (plik:linia)
  → serwis/domena (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
```

Ścieżka bez montażu = kod nieosiągalny = pozycja `NIE_ZACZĘTE`, nawet jeśli plik
jest napisany i przetestowany. **Dokładnie tak przepadło „P.2 ZROBIONE_WG_DoD"
w `DEC-60`.**

**★ Z21 — co to znaczy „test domyślnego okablowania".**
Istniejący `tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts`
buduje router z **własnym** `authorize` (linie ~30–40). Taki test **nie dowodzi
niczego** o tym, jak zachowuje się produkcja, bo produkcyjne `authorize` żyje
w `initiativesExecutionRuntime.routes.ts:5831` i woła `resolveEffectiveAccess`.
Dla pozycji **B** to jest różnica między „udowodniłem" a „niczego nie
udowodniłem". Masz mieć **oba**: test na wstrzykniętym liczniku (dowodzi
deduplikacji w routerze) **i** test domyślnego okablowania (dowodzi, że
produkcyjny `runtimeDependencies` faktycznie wykonuje mniej zapytań SQL).

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
  ← w tym tests/integration/initiatives-execution/vitest.realdb.config.ts:
    UŻYWASZ GO, NIE ZMIENIASZ. Twoje nowe pliki muszą pasować do jego wzorca
    include: 'tests/integration/initiatives-execution/**/*.realdb.test.ts'
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/domain/initiatives-execution/**                    (+ __tests__ obok)
      w szczególności: planAnalysisProposal.ts · planScenario.ts · capacityScenario.ts
                       capacityOptions.ts · postgresInitiativeReader.ts
                       NOWE pliki: planSolver.ts, capacityOptionProposer.ts,
                                   demandDerivation.ts, saturation.ts
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
  server/src/routes/pmo/initiatives.routes.ts                   (TYLKO §G.3 — deduplikacja podobieństwa)
  server/src/routes/pmo/index.ts                                (TYLKO §G.1 — martwy agregator)
  server/src/routes/index.ts                                    (TYLKO §G.1 — martwy agregator)
  server/src/routes/assessment/index.ts                         (TYLKO §G.1 — martwy agregator)
  server/src/services/initiativeGenerationService.ts            (TYLKO §G.4 — uczciwość odpowiedzi)
  server/migrations/2026111<x>_initiatives_day21_*.sql           (NOWE pliki, numeracja wg §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/INITIATIVES_DAY21_REPORT_20260826.md          (jedyny nowy dokument)
  tests/integration/initiatives-execution/*.realdb.test.ts                            (NOWE pliki)
  tests/unit/initiatives/**                                                           (NOWE pliki)

IMIENNE LICENCJE POZA MODUŁEM (wolno WOŁAĆ/CZYTAĆ istniejące, NIE zmieniać ich kodu):
  §B   — server/src/services/effectiveAccessService.ts::resolveEffectiveAccess       (CZYTASZ; ZMIANA = ODRZUCENIE, Z16)
         server/src/services/effectiveAccessService.ts::hasEffectiveCapability       (WOŁASZ przez istniejący deps.authorize)
  §D   — server/src/domain/initiatives-execution/capacityScenario.ts::ProposedAssignment (WOŁASZ/rozszerzasz addytywnie — to Twój moduł)
  §F   — server/src/controllers/InitiativeController.ts::getHistory                  (CZYTASZ jako dowód istnienia API; NIE zmieniasz)
  §G.2 — server/src/Gateway.ts                                                       (WOLNO usunąć DOKŁADNIE JEDEN podwójny montaż — linia 1156; NIC WIĘCEJ w tym pliku)
  §G.3 — server/src/controllers/InitiativeController.ts::checkSimilarInitiatives     (CZYTASZ; NIE zmieniasz)
  wzorzec testu — tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts (CZYTASZ jako wzorzec)

NIE WOLNO:
  CAŁE src/**                                                   ← podział FRONT/TYŁ (§1.6); zero wyjątków, także „jedna linia importu"
  server/src/services/effectiveAccessService.ts                 ← Z16, ODRZUCENIE
  server/src/services/frameworkEntitlementService.ts · middleware/frameworkEntitlement.middleware.ts
  server/src/middleware/** (poza czytaniem)
  server/src/services/v8/**  ·  server/src/services/artifactHandoff/**
  server/src/controllers/InitiativeController.ts                ← WOLNO CZYTAĆ; zmiana = STOP
  server/src/controllers/TaskController.ts
  server/migrations/<istniejące pliki>                          ← TYLKO ODCZYT (nowe DDL = nowy plik)
  tests/e2e/**  ·  tests/acceptance/**                          ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(initiatives): replace the index-to-period stub with a real deterministic plan solver (A.1)
  test(initiatives): prove 50 initiatives across 4 periods do not collapse into the last one (A.2)
  perf(initiatives): authorize the initiative list once per project instead of once per row (B.1)
  feat(initiatives): keyset pagination for the runtime initiative list (B.2)
  feat(initiatives): derive the three canonical capacity options instead of demanding them from the caller (C.1)
  feat(initiatives): expose the capacity option proposal over the runtime API (C.2)
  feat(initiatives): derive period demand from the plan and split supply per person (D)
  fix(initiatives): bound saturation instead of dividing by a near-zero supply (E)
  docs(initiatives): inventory of the eight locally-held card sections (F)
  chore(initiatives): drop the dead route aggregators and the duplicate PMO mount (G.1, G.2)
  fix(initiatives): stop returning HTTP 200 with placeholder section content (G.4)
  docs(initiatives): raise 05_INITIATIVES acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**.
- **Typy punktowo** (`npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 21 MA PRZYDZIELONY PRZEDZIAŁ `20261110`–`20261119`
     (`DEC-2026-08-26-98`, rozszerzenie).** Reguła „najwyższy + 1" obowiązuje
     **TYLKO WEWNĄTRZ tego przedziału**. Numery spoza przedziału są **ZAKAZANE**,
     nawet jeśli są wolne — dni 17/18/19/20 mają swoje pule
     (`20261076-79` / `20261080-89` / `20261090-99` / `20261100-09`) i część
     z nich nie jest jeszcze scalona, więc `ls` ich nie pokaże.
     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**
     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3   # co już zajęte w przedziałach
     ls server/migrations | grep '^20261110'                              # MUSI być PUSTE przed utworzeniem pliku
     ```
     Nazwa: `<numer>_initiatives_day21_<temat>.sql`.
     **Pierwszy wolny w Twoim przedziale to `20261110`.** Sprawdź to sam.
     `migrate.postgres.ts` stosuje migracje w porządku **alfabetycznym nazw
     plików**, więc kolizja numeru to cicha katastrofa — dokładnie ta, którą
     wykrył odbiór dnia 18 (`DEC-107`) i której winna była instrukcja, nie Codex.
  3. **★ ZERO nowych kluczy obcych** do `ie_*`, `initiatives`, `projects`.
     Tenant i istnienie rodzica sprawdzasz **w warstwie aplikacji**, dokładnie
     jak reszta `initiatives-execution`.
  4. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65)** — warunek
     oddania każdej pozycji z migracją. Jednorazowy kontener, trzy przebiegi,
     wyniki do raportu. **Sprzątanie kontenera I wolumenów jest obowiązkowe.**
  5. **Prawdopodobnie potrzebujesz DOKŁADNIE JEDNEJ migracji** — indeks pod
     paginację keyset (`B.2`). Reszta pozycji siedzi w `payload_json` agregatu
     (JSONB), a rozszerzenia payloadu są addytywne i **nie wymagają DDL**.
     **Zweryfikuj to w Bloku 0 i nie dodawaj migracji „na wszelki wypadek".**
- **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
  **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie jedenaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `UNKNOWN` z powodem,
   **nigdy zero**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap.** Brak API → wpis `BRAK_API`. **I zero atrap z zewnętrznym
   skutkiem (Z22)**: jeśli odpowiedź mówi „zastosowano", w bazie MUSI być zmiana
   — dowodzisz to liczbą wierszy/wersją agregatu przed i po.
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**
   (wzorzec: `tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts`).
   Test na zmockowanej domenie **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka wywołania od realnego wejścia
   do zapisu, w formacie z ramki Z20, w raporcie. **Bez niej pozycja jest
   `NIE_ZACZĘTE`, choćby kod był napisany i przetestowany.**
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — dla każdej pozycji, która wywołuje
   coś spoza własnego pliku (autoryzacja, reader, unit of work): osobny test
   **bez wstrzykiwania**, przeciwko domyślnym zależnościom produkcyjnym.
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query. Test
   wysyła obcą organizację w body i dostaje `404`/`403`, nie `200`.
9. **Realny PG w jednorazowym Dockerze** (port 5471) z pełnymi migracjami,
   z dowodem celu połączenia (Z19), ze sprzątnięciem kontenera **i wolumenów**.
10. **Plik przez `prettier`** przed commitem.
11. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem (§1.6). Klucze `initiatives.*` tworzysz **wyłącznie**
> dla napisów, które faktycznie wychodzą z Twojego API (kody i komunikaty
> błędów), i wtedy parytet PL+EN obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

Przed oddaniem raportu:

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/index.ts`, `server/src/Gateway.ts`,
   `server/src/routes/pmo/initiatives.routes.ts`,
   `server/src/services/initiativeGenerationService.ts`.
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum
   (każde z jawnym `DATABASE_URL` w tej samej linii tam, gdzie dotyka bazy — Z19):
   ```bash
   npx vitest run --config tests/integration/initiatives-execution/vitest.realdb.config.ts
   npx vitest run server/src/domain/initiatives-execution/__tests__
   npx vitest run tests/integration/routes/pmo.initiatives.fail-closed.contract.test.ts
   npx vitest run tests/integration/routes/initiatives.test.js
   npx vitest run tests/integration/routes/initiativeEconomicsLinks.test.ts
   npx vitest run server/src/routes/__tests__/initiatives-gate-readiness-parity.test.ts
   npx vitest run server/src/services/__tests__/effectiveAccessService.test.ts
   npx vitest run src/components/Initiatives/__tests__      # regresja frontu — NIE zmieniasz go, ale ma być zielony
   ```
4. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem `zastane / wprowadzone`:**
   ```
   Zakres §0.4a: <X>/<Y> PASS
     czerwone ZASTANE (były czerwone na bazie, przed moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
   ```
   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia** (`DEC-108`, P1 dnia 19).
5. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
6. **Baseline liczysz PRZED pierwszym commitem** (Blok 0 pkt 6) — inaczej nie
   masz jak odróżnić zastanego od wprowadzonego.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- dotknąć `effectiveAccessService.ts` albo dowolnego pliku modelu uprawnień
  (Z16) — to jest STOP **zawsze**, także „addytywnie, tylko cache";
- osłabić/usunąć asercję w teście istniejącym wcześniej;
- rozcieńczyć dyscyplinę `UNKNOWN ≠ 0` albo `low ≤ base ≤ high` (Z15);
- dodać migrację nieaddytywną, z kluczem obcym, albo z numerem **spoza
  przedziału `20261110`–`20261119`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- wejść we `src/**` (Z17, §1.6) — **także po to, żeby „tylko podłączyć nowy
  endpoint"**;
- zbudować trasę, która zwraca sukces i wywołuje skutek zewnętrzny bez zmiany
  w bazie (Z22);
- podpiąć dostawcę LLM albo dodać wywołanie modelu (Z14);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

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

Panel ekspercki (`DEC-2026-08-26-104`, pięć niezależnych obiektywów: partner 5,0 ·
PMO 4,0 · UX 4,5 · inżynier jakości 4,5 · sceptyk 3,0) postawił Inicjatywom
**4,0/10 przy celu 9,5**. Sedno werdyktu nie brzmi „brakuje funkcji" — brzmi
**„to, co jest, udaje, że działa"**:

> „Solver planu to atrapa planowania: `periods[min(index, len-1)]` — przy
> 4 kwartałach i 50 inicjatywach pozycje 5–50 lądują wszystkie w Q4
> z identycznymi datami. **Wynik wygląda wiarygodnie i jest bezwartościowy.**"

Tania partia napraw (`DEC-2026-08-26-109`) zdjęła z modułu **fasadę**: 12 824 linie
nieosiągalnego UI, atrapy AI, akcje statusu, które rzucały zawsze. Zostało to,
czego nie da się naprawić przyciskiem: **mechanika**.

**To jest ten dyżur.** Siedem pozycji, wszystkie po stronie serwera.

### 1.2. ZAKRES — dokładnie siedem pozycji, nic więcej

| Poz.    | Nazwa                                                  | Stan zastany                                                                                             | Twój produkt                                                                                                      |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **A**   | **Realny solver planu**                                | `periodFor = periods[min(index, len-1)]` — atrapa                                                        | Deterministyczny solver respektujący zależności, okna `earliest/target/latest`, ograniczenia i pojemność okresu   |
| **B**   | **Wydajność listy**                                    | `O(3N)` zapytań SQL, zero paginacji                                                                      | Autoryzacja raz na projekt + paginacja keyset + **test liczący ZAPYTANIA**                                        |
| **C**   | **Domknięcie pętli zdolności**                         | `createCapacityOptions` **zapisuje** opcje, nikt ich nie **wylicza**                                     | Deterministyczny proponent trzech opcji kanonicznych + trasa + kontrakt DTO                                       |
| **D**   | **Obciążenie wyprowadzone z planu + przekrój osobowy** | `demand`/`supply` wpisywane ręcznie; jeden `supply.ownerId` na okres                                     | Wyprowadzenie `demand` z okien planu × przydziałów; `supply` rozbite na osoby                                     |
| **E**   | **Zabezpieczenie nasycenia**                           | Dzielenie przez `supply` chronione tylko przed zerem → 8000 %                                            | Kanoniczne, serwerowe wyliczenie z jawnym stanem `NIEOKREŚLONE`                                                   |
| **F**   | **Trwałość ośmiu sekcji lokalnych**                    | 8 sekcji karty renderuje i pozwala edytować, **nic nie zapisuje**                                        | Inwentarz `MA_API` / `BRAK_API`; dla mających — dopięcie zapisu **po stronie serwera**                            |
| **G**   | **Sprzątanie serwera**                                 | Martwe agregatory tras, podwójny montaż PMO, dwa endpointy podobieństwa, cichy fałszywy sukces generacji | Usunięcie martwego, jeden montaż, jedna trasa podobieństwa, jawny błąd/`degraded` zamiast placeholdera z HTTP 200 |
| **T**   | **Testy**                                              | —                                                                                                        | Pozycja własna, nie dodatek — §T                                                                                  |
| **R.1** | `MODULE_ACCEPTANCE.md` 05_INITIATIVES                  | nie podniesiony                                                                                          | Podniesienie o **faktycznie dowieziony** zakres                                                                   |

### 1.3. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`.** Ekran Planu, Ganttа, drag&drop wystąpień, kolumny,
   kanban, karta inicjatywy, prawy panel, polonizacja zakładek „Plan"
   i „Obciążenie", widok `PortfolioHealthView` — **robotnicy wewnętrzni po
   prototypie i akcepcie właściciela**. Nie tworzysz, nie zmieniasz, nie
   „przygotowujesz" komponentów.
2. **Usuwanie pozostałego martwego UI** — osobna gałąź w toku, po `DEC-109`.
   Jeśli znajdziesz martwy front, **wpisujesz do „Znalezisk", nie kasujesz.**
   Wyjątek: martwy kod **serwera** w pozycji `G` — to Twoje.
3. **Silnik AI / generowanie treści modelem** (Z14). Pozycja `G.4` dotyczy
   **uczciwości odpowiedzi**, nie włączania AI.
4. **Model uprawnień** (Z16). Pozycja `B` nie dotyka `effectiveAccessService`.
5. **`updateInitiativeStatusWriteTruth`** i akcje statusu na karcie — naprawione
   w `DEC-109`, nie ruszasz.
6. **Otwieranie/zamykanie modułu, flagi, bramki beta** (Z10).
7. **Migracje zdalne, staging, Railway** (DEC-65, Z8).

### 1.4. Decyzje wiążące

1. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz
   zdalnych migracji/seedów/zapisów. **Prawo nadrzędne.**
2. **`DEC-2026-08-26-104`** — panel ekspercki Inicjatyw 4,0/10 + **korekta DEC-60**
   - **nowy wymóg: DoD wymaga dowodu OSIĄGALNOŚCI** (u Ciebie: Z20).
3. **`DEC-2026-08-26-107`** — dzień 18: **test wstrzykujący zależności NIE dowodzi
   ścieżki produkcyjnej** (u Ciebie: Z21). Plus: **źródłem kolizji migracji była
   instrukcja** — stąd przedziały numerów.
4. **`DEC-2026-08-26-108`** — dzień 19: **zakaz atrapy z zewnętrznym skutkiem**
   (Z22) i **pomiar testów bez zawężania** (Z23).
5. **`DEC-2026-08-26-98`** — korekta Z9 (przerywa czynność, nie dyżur), mechanizm
   env w tej samej linii, **rezerwacja numerów migracji**; dzień 21 =
   **`20261110`–`20261119`**.
6. **`DEC-2026-08-26-96`** — Z19 (kolejność Bloku 0, jawny `DATABASE_URL`, dowód
   celu połączenia).
7. **`DEC-2026-08-26-95`** — rozejście marker→tip bez kolizji rozstrzyga nadzorca;
   dokładny start z markera, bez rebase.
8. **`DEC-2026-08-26-109`** — tania partia Inicjatyw scalona; **martwy router
   `server/src/routes/initiatives.routes.ts` już usunięty** — nie szukaj go.
9. **`DEC-2026-08-26-51`** — zakaz atrapy AI; deterministyczne porządkowanie
   **nie może** nosić ikony ani nazwy AI. Twój solver (`A`) jest
   **deterministyczny** i ma się tak nazywać.
10. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji
    „najwyższy + 1 ze sprawdzeniem" (u Ciebie: wewnątrz przedziału).

### 1.5. Stan faktyczny — mapa techniczna (zweryfikuj w Bloku 0)

Każdą linię weryfikujesz sam; rozbieżność → „Korekty wobec instrukcji".

```
# DOMENA (event-sourcing, Twój zakres)
server/src/domain/initiatives-execution/planScenario.ts
  PlannedWindow { initiativeId, initiativeVersion, earliest|null, target|null, latest|null,
                  confidence: HIGH|MEDIUM|LOW|UNKNOWN, rationale,
                  dependencySnapshot: string[],                      ← SAME ID, BEZ typu i lagu
                  constraintSnapshot: [{constraintId, state: KNOWN|UNKNOWN, detail}] }   ← ZBUDOWANE, NIEUŻYWANE PRZEZ SOLVER
  PlanScenario  { scenarioId, scenarioVersion, status: DRAFT|PUBLISHED|SUPERSEDED,
                  portfolioScenarioId/Version, windowUnit, timezone,
                  periods: [{periodId, start, end}],                 ← REALNE DATY OKRESÓW
                  windows: PlannedWindow[], assumptions[] }
  validatePlanScenario — okresy nienachodzące, unikat inicjatyw, earliest<=target<=latest

server/src/domain/initiatives-execution/planAnalysisProposal.ts
  :27  const periodFor = (scenario, index) => scenario.periods[Math.min(index, periods.length - 1)]
  :72  const period = periodFor(source.payload, index)
       ★ TO JEST ATRAPA — sedno pozycji A
  dependencyOrder(windows) — sort topologiczny DFS + wykrywanie cykli   ← DZIAŁA, ZOSTAJE
  createPlanAnalysisProposal — komenda materialna, wymaga DRAFT + dokładnej wersji agregatu

server/src/domain/initiatives-execution/capacityScenario.ts
  CapacityRange { knowledgeState: KNOWN|ESTIMATED|UNKNOWN|UNCONFIRMED,
                  low|base|high (null przy UNKNOWN), sourceRef, sourceVersion, asOf,
                  confidence, ownerId, reason }
  CapacityPeriod { periodId, start, end, demand: CapacityRange, supply: CapacityRange }
                  ★ JEDEN demand i JEDEN supply na okres — brak przekroju osobowego (pozycja D)
  ProposedAssignment { assignmentId, initiativeId, resourceOrRoleId, periodIds[], demand, rationale }
                  ★ TO JEST GOTOWE ŹRÓDŁO PRZEKROJU OSOBOWEGO — istnieje i nie jest używane do liczenia
  range() — UNKNOWN musi mieć null+reason; znany zakres wymaga low<=base<=high + wersjonowanego źródła

server/src/domain/initiatives-execution/capacityOptions.ts
  :52  capacityOptionFindings — waliduje UNKNOWN bez liczb i zakresy
  :74  createCapacityOptions  ★ TO JEST REJESTRATOR, NIE GENERATOR:
       wymaga, żeby WOŁAJĄCY podał DOKŁADNIE TRZY gotowe opcje kanoniczne
       (ADD_CAPACITY, RESEQUENCE, SCOPE_SPLIT) z pełnym impact{date,scope,cost,risk}
       i rodowodem założeń. Nikt ich nie WYLICZA — to jest luka pozycji C.
  :141 selectCapacityOption — wybór opcji → nextGovernedInput (MATERIAL_CHANGE|SCHEDULE_DECISION)

server/src/domain/initiatives-execution/postgresInitiativeReader.ts
  :1227 listInitiatives(organizationId) — SELECT ... FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='initiative' ORDER BY updated_at DESC
        ★ ZERO paginacji, zero limitu (pozycja B.2)

# TRASY (Twój zakres)
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts   (~330 endpointów)
  :1153-1163  authorizeProjects(actor, projectIds, capability)
              → dedupe przez new Set(projectIds), ale zwraca .every(Boolean) — JEDEN bool dla CAŁEGO zbioru
              ★ UWAGA: to NIE jest gotowa funkcja do filtrowania wierszy — patrz §B.1
  :1751-1757  GET /initiatives — autoryzacja PER WIERSZ:
              rows.map(async row => await deps.authorize(actor, row.initiative.projectId, 'initiative.view'))
              ★ BURZA AUTORYZACYJNA — sedno pozycji B
  :5611  POST /capacity-options/:id          → createCapacityOptions   ← TRASA JUŻ ISTNIEJE
  :5643  POST /capacity-options/:id/select   → selectCapacityOption
  :5674  GET  /capacity-options              → reader.listCapacityOptions
  :5831  runtimeDependencies.authorize = async (actor, projectId, capability) =>
             hasEffectiveCapability(await resolveEffectiveAccess({...}), capability)
         ★ TO JEST DOMYŚLNE OKABLOWANIE (Z21) — testujesz JE, nie tylko wstrzyknięte
  :5843  export default createInitiativesExecutionRuntimeRouter(runtimeDependencies)

server/src/routes/pmo/initiatives.routes.ts
  :154   router.use('/runtime-v1', initiativesExecutionRuntimeRouter)   ← tu montuje się cały runtime
  :405   POST /similarity-check     ← konsument: src/components/Initiatives/Wizard/InitiativeWizardModal.tsx
  :3712  GET  /:id/history          ← REALNE API dla sekcji Historia (pozycja F)
  :3955  POST /similar-check        ← konsument: src/services/api/initiativeSimilar.ts
  :3970  GET  /:id/status-history

server/src/Gateway.ts
  :696   app.use('/api/initiatives',     gatewayVerifyToken, trialEntryGuard, initiativesRoutes)
  :1156  app.use('/api/pmo/initiatives', gatewayVerifyToken, trialEntryGuard, initiativesRoutes)
         ★ TEN SAM ROUTER ZAMONTOWANY DWA RAZY — cały runtime-v1 jest osiągalny
           pod DWOMA prefiksami (/api/initiatives/runtime-v1 i /api/pmo/initiatives/runtime-v1)

# MARTWE AGREGATORY (pozycja G.1) — ZERO importerów
server/src/routes/index.ts:18  export { default as assessmentDomainRoutes } from './assessment/index.js'
server/src/routes/index.ts:23  export { default as pmoDomainRoutes }        from './pmo/index.js'
  → nic w server/ nie importuje routes/index.js  (sprawdź sam: grep -rn "routes/index" server/src)
  → w efekcie martwe są też: routes/pmo/index.ts (:33 montuje initiatives) i routes/assessment/index.ts (:26)
  → pliki tras, które one montują, są mimo to zamontowane BEZPOŚREDNIO w Gateway.ts — nie znikną

# GENERACJA SEKCJI (pozycja G.4)
server/src/services/initiativeGenerationService.ts
  :682-698  generateSectionContent — brak LLM ⇒ HTTP 200 + treść
            "[nazwa] — Please fill in this section..." + model:'placeholder'
            ★ CICHY FAŁSZYWY SUKCES
  :~1211-1219 druga ścieżka (cardSpec) — brak LLM ⇒ { ok: false, model: 'placeholder' }
            ★ TA JEST UCZCIWA — wzorzec do naśladowania, nie do zmiany

# OSIEM SEKCJI KARTY (pozycja F) — 0 wywołań API każda
src/components/Initiatives/sections/{Attachments,Reminders,History,Pilot,Control,
                                     FinancialImpact,FinancialAnalysis,RaciEscalation}Section.tsx

# TESTY (wzorzec)
tests/integration/initiatives-execution/                     ~43 pliki *.realdb.test.ts
tests/integration/initiatives-execution/vitest.realdb.config.ts   ← UŻYWASZ, NIE ZMIENIASZ (Z18)
tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts
  ← wzorzec bootu realnego routera; UWAGA: wstrzykuje własny authorize (Z21!)

# BAZA
server/migrations/932_initiatives_execution_material_commands.sql:33
  ie_aggregate_state(organization_id, aggregate_type, aggregate_id, version, payload_json JSONB, updated_at)
  PRIMARY KEY (organization_id, aggregate_type, aggregate_id)
  ★ brak indeksu pod (organization_id, aggregate_type, updated_at) — pozycja B.2
```

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ty = TYŁ.** Domena, migracje, trasy, semantyka zapisu, kontrakty odpowiedzi,
testy. **Robotnicy wewnętrzni = FRONT**, po prototypie i akcepcie właściciela na
czystym zrzucie.

Praktycznie:

- Budujesz solver, który rozkłada 50 inicjatyw po 4 okresach — **nie** budujesz
  Gantta ani drag&drop.
- Budujesz proponenta trzech opcji zdolności i trasę, która go wystawia — **nie**
  budujesz przycisku „Zaproponuj zmiany".
- Zwracasz `saturation` z jawnym stanem `UNDETERMINED` — **nie** zmieniasz
  `CapacityScenarioSurface.tsx`, choćby był o jedną linię od poprawności.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do frontu — **należy do frontu**, a Ty wpisujesz to do „Znalezisk"
jako „kontrakt gotowy, front do zbudowania".

Twoim obowiązkiem wobec frontu jest **jawny kontrakt w raporcie**: dla każdej
nowej/zmienionej trasy podajesz metodę, ścieżkę, kształt body, kształt odpowiedzi,
kody błędów. To jest dosłownie wejście dla robotnika frontowego.

### 1.7. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`NODE_ENV=test` bez `RUN_DB_TESTS=1` = mock DB.** Cały pakiet „przechodzi"
   przeciwko niczemu (Z19).
2. **`authorizeProjects` NIE JEST gotową naprawą pozycji B.** Zwraca **jeden
   bool** dla całego zbioru projektów (`.every(Boolean)`) — użyty wprost do
   filtrowania listy **ukryłby całą listę**, gdy użytkownik nie ma prawa do
   jednego projektu. Potrzebujesz **mapy `projectId → bool`**, zbudowanej tą samą
   techniką deduplikacji. Kopiujesz **ideę**, nie wywołanie.
3. **`resolveEffectiveAccess` czyta rolę organizacyjną, członkostwo projektu
   i szablon uprawnień — trzy zapytania.** Rola organizacyjna zależy wyłącznie od
   `(userId, organizationId)`, więc jest niezmienna w obrębie żądania. To znaczy,
   że przy 50 inicjatywach z jednego projektu **teoretyczne minimum to 3 zapytania,
   nie 150** — ale **NIE WOLNO Ci tego osiągnąć przez cache w serwisie dostępu**
   (Z16). Osiągasz to przez **jedno wywołanie na projekt**.
4. **Wersjonowanie agregatów jest optymistyczne i bezlitosne.** Komendy materialne
   wymagają **dokładnej** `inputAggregateVersion`; niezgodność = `MaterialCommandConflictError`.
   Twoje nowe komendy trzymają ten sam kontrakt — **nie** obchodzisz go
   „ostatnią wersją z odczytu tuż przed zapisem".
5. **`createPlanAnalysisProposal` NIE ZMIENIA planu** — produkuje **propozycję**
   do decyzji człowieka (`PENDING_REVIEW` → `analysisDecision.ts`). Solver ma
   poprawić **jakość propozycji**, a nie zacząć zapisywać daty do planu.
   **Automatyczne zastosowanie propozycji = złamanie modelu decyzyjnego = STOP.**
6. **`UNKNOWN` z liczbą jest błędem walidacji, nie ostrzeżeniem.** Jeśli Twoje
   wyprowadzenie `demand` (pozycja D) trafi na okno bez dat albo na przydział
   `UNKNOWN`, wynikiem jest `UNKNOWN` z `reason`, **nigdy** `0`.
7. **Nadpisanie ręczne musi być widoczne w danych, nie domyślane.** Pozycja D
   zachowuje możliwość ręcznego wpisu — ale wpis ręczny ma być **oznaczony**
   (`origin: 'MANUAL' | 'DERIVED'`), żeby dało się odróżnić „człowiek tak
   zdecydował" od „system tak policzył". Bez tego znacznika wyprowadzenie zniszczy
   pracę użytkownika przy pierwszym przeliczeniu.
8. **`ORDER BY updated_at DESC` nie jest stabilne** — `updated_at` nie jest
   unikatowe. Kursor keyset **musi** mieć tiebreaker `aggregate_id`, inaczej
   paginacja pogubi albo zdubluje wiersze. Klucz główny to
   `(organization_id, aggregate_type, aggregate_id)`.
9. **Podwójny montaż PMO (`Gateway.ts:696` i `:1156`) usuwasz OSTROŻNIE.**
   Zanim usuniesz `/api/pmo/initiatives`, **udowodnij grepem**, że żaden konsument
   w `src/` ani w testach nie woła tego prefiksu. Jeśli woła — **NIE usuwasz**,
   wpisujesz do „Znalezisk" jako pozycję dla frontu. Usunięcie żywej trasy to
   regresja, nie sprzątanie.
10. **Dwa endpointy podobieństwa mają DWÓCH ŻYWYCH KONSUMENTÓW.**
    `similarity-check` woła `InitiativeWizardModal.tsx`, `similar-check` woła
    `src/services/api/initiativeSimilar.ts`. **Konsolidacja NIE JEST darmowa** —
    front jest poza Twoim zakresem, więc **nie wolno Ci usunąć żadnego z nich**.
    Twój produkt to **alias serwerowy** (jedna implementacja, druga trasa
    deleguje) + wpis dla frontu, nie kasowanie.
11. **`generateSectionContent` ma DWIE ścieżki placeholdera** — jedna kłamie
    (200 z treścią), druga jest uczciwa (`ok:false`). Naprawiasz **pierwszą**,
    wzorując się na drugiej. Nie ujednolicaj przez zepsucie uczciwej.
12. **`initiativeGenerationService.ts` jest współdzielony.** Zmiana kontraktu
    odpowiedzi może zapalić testy poza Inicjatywami — dlatego §0.4a każe
    uruchomić katalogi konsumentów, a Z23 każe podać wynik bez zawężania.

### 1.8. ★ ERRATA DO MATERIAŁU DIAGNOSTYCZNEGO — czytaj, zanim zaczniesz szukać

Nadzorca zweryfikował materiał panelu w kodzie na tipie bazy **po `DEC-109`**.
Trzy tezy panelu **nie zgadzają się** ze stanem faktycznym. Poniższe ustalenia są
**wiążące** — nie tracisz na nie czasu i **nie zgłaszasz STOP-u** z ich powodu:

1. **Model `PlannedWindow` NIE MA `freeze` ani `FS/SS/FF` ani `lag/lead`.**
   Panel napisał, że „gotowy model jest niewpięty". W `initiatives-execution` go
   **nie ma**: `PlannedWindow.dependencySnapshot` to **`string[]`** samych
   identyfikatorów. Typy zależności (`FINISH_TO_START`) żyją w **innym, starym
   modelu** — `initiative_dependencies.type` (bez kolumny lagu) oraz
   `task_dependencies` (`TaskController.ts` — cudzy zakres, Z17).
   **Skutek dla Ciebie:** pozycja `A` buduje solver na modelach, które
   **faktycznie istnieją** (`earliest/target/latest`, `dependencySnapshot`,
   `constraintSnapshot`, `periods[].start/end`), a rozszerzenie o typ zależności
   i lag jest **opcjonalną podpozycją `A.3`**, którą wolno uczciwie odłożyć.
2. **`createCapacityOptions` JEST wystawiony trasą** (`POST /capacity-options/:id`,
   `initiativesExecutionRuntime.routes.ts:5611`). Panel widział brak konsumenta
   w `src/services/initiatives-execution/runtimeApi.ts:1606` — i to jest prawda:
   funkcja klienta istnieje i **nikt jej nie woła**. **Ale luka jest głębsza niż
   „brak trasy":** `createCapacityOptions` to **rejestrator**, który żąda od
   wołającego **trzech gotowych opcji** z pełnym `impact` i rodowodem założeń.
   **Nic w systemie tych opcji nie wylicza.** Dlatego pozycja `C` to **budowa
   proponenta**, nie „wystawienie trasy".
3. **Martwy router `server/src/routes/initiatives.routes.ts` już nie istnieje** —
   usunięty w `DEC-109`. Nie szukaj go. Martwe **zostały** agregatory
   `routes/index.ts` → `routes/pmo/index.ts` i `routes/assessment/index.ts`
   (zero importerów) — i to jest zakres `G.1`.

Jeśli Twoja weryfikacja w Bloku 0 pokaże coś innego niż powyższe — **to jest wpis
w „Korektach wobec instrukcji"**, a nie STOP.

---

## §A. REALNY SOLVER PLANU — sedno dyżuru

**Cel jednym zdaniem:** propozycja planu ma **rozkładać** inicjatywy po okresach
zgodnie z zależnościami, oknami i pojemnością — zamiast **wsypywać** wszystko po
piątej pozycji do ostatniego okresu.

### A.1 — Solver zamiast `periods[min(index, len-1)]`

Nowy plik: `server/src/domain/initiatives-execution/planSolver.ts`.
`planAnalysisProposal.ts` woła go zamiast `periodFor`.

**Wejście (wszystko istnieje dziś):**

- `scenario.periods[]` — realne `start`/`end` okresów;
- `scenario.windows[]` — dla każdej inicjatywy `earliest`/`target`/`latest`
  (mogą być `null`), `dependencySnapshot`, `constraintSnapshot`, `confidence`;
- **opcjonalnie** pojemność okresu z opublikowanego `CapacityScenario` powiązanego
  z tym planem (`planScenarioId` + `planScenarioVersion`) — jeśli istnieje.

**Kontrakt solvera — sześć reguł, w tej kolejności:**

1. **Kolejność topologiczna zostaje.** Reużywasz istniejącego `dependencyOrder`
   (sort DFS + wykrywanie cykli). **Nie piszesz drugiego sortu.**
2. **Zależność wypycha następnika do okresu NIE WCZEŚNIEJSZEGO** niż okres
   przypisany poprzednikowi. Domyślna semantyka: **zakończ-rozpocznij** —
   następnik trafia najwcześniej do okresu **następującego po** okresie
   poprzednika, chyba że podpozycja `A.3` wprowadzi typy zależności.
3. **Okno własne inicjatywy jest twarde.** Jeżeli `earliest`/`latest` są
   podane, przypisany okres musi się z tym oknem **przecinać**. Brak okresu
   spełniającego okno = **konflikt wypisany w `conflicts[]`**, a nie ciche
   przesunięcie. Inicjatywa z nierozwiązywalnym oknem **zostaje bez zmiany**
   (`before === after`, czyli nie trafia do `changes[]`).
4. **Pojemność okresu ogranicza obłożenie.** Jeżeli powiązany `CapacityScenario`
   jest opublikowany i ma `supply` w stanie `KNOWN`/`ESTIMATED`, solver **nie
   przekracza** `supply.base` sumą `demand` przypisanych inicjatyw w tym okresie —
   przepycha nadmiar do kolejnego dopuszczalnego okresu. **Gdy pojemność jest
   `UNKNOWN`, reguła jest wyłączona i to musi być widoczne w `assumptions[]`
   propozycji** („Capacity unknown for period X — capacity constraint not applied").
   **Nigdy nie traktujesz `UNKNOWN` jako zera ani jako nieskończoności po cichu.**
5. **Determinizm.** Ten sam wejściowy scenariusz **musi** dać bit w bit ten sam
   wynik. Zero `Math.random`, zero `Date.now()` w logice rozkładu (znacznik
   `createdAt` propozycji zostaje jak jest). Remisy rozstrzygasz stabilnie:
   kolejność topologiczna, potem `initiativeId` rosnąco. **Test determinizmu
   (dwa przebiegi, `toEqual`) jest obowiązkowy.**
6. **Brak rozwiązania to konflikt, nie zgadywanka.** Gdy inicjatywa nie mieści
   się nigdzie (cykl, okno poza horyzontem, brak okresów), trafia do
   `conflicts[]` z czytelnym powodem i **nie dostaje zmyślonych dat**.
   `confidence` takiego okna → `LOW`.

**Wymagania twarde:**

- **Nie zmieniasz kształtu `PlannedWindow` ani `PlanAnalysisProposal`** poza
  dopisaniem **opcjonalnych** pól (jeśli w ogóle). Kompatybilność wstecz
  z zapisanymi payloadami JSONB **musi** być udowodniona testem: agregat zapisany
  przed Twoją zmianą czyta się i przetwarza bez błędu.
- **Propozycja dalej jest propozycją.** `status: 'PENDING_REVIEW'`, zero zapisu
  do planu, decyzja przez istniejący `analysisDecision.ts`. (Pułapka 5.)
- **Zero nazewnictwa AI** (DEC-51). To jest **solver deterministyczny** i tak się
  nazywa w kodzie, w `rationale` i w kontrakcie.
- `rationale` każdej zmiany mówi **dlaczego** ten okres: która zależność, które
  okno, która pojemność. To jest to, co konsultant pokaże klientowi.

**DoD A.1:** testy jednostkowe domeny (co najmniej: łańcuch zależności ·
zależność równoległa · okno nie do spełnienia · pojemność `UNKNOWN` · pojemność
`KNOWN` wypychająca nadmiar · cykl · determinizm) **plus** test HTTP realnego
routera na realnym PG, który tworzy scenariusz, woła
`POST /plan-analysis-proposals/...` i czyta propozycję **niezależnym `pg.Pool`**.
Plus **dowód osiągalności (Z20)** i **test domyślnego okablowania (Z21)**.

### A.2 — ★ Test dowodowy: 50 inicjatyw × 4 okresy

To jest **osobna, obowiązkowa pozycja dowodowa** — teza panelu ma zostać obalona
liczbą, nie zdaniem.

Scenariusz: **4 okresy** (np. cztery kwartały), **50 inicjatyw** z realistyczną
siecią zależności (łańcuchy + gałęzie + kilka niezależnych). Asercje:

1. **Rozkład nie jest zdegenerowany:** liczba inicjatyw w ostatnim okresie
   **< 50 %** wszystkich (przy dzisiejszej atrapie jest to 46/50 = 92 %).
2. **Każdy okres jest użyty** (albo jest jawny konflikt tłumaczący, dlaczego nie).
3. **Zero identycznych trójek dat** dla inicjatyw niepowiązanych zależnością —
   dzisiaj pozycje 5–50 dostają **te same** `earliest/target/latest`.
4. **Każda zależność respektowana:** dla każdej krawędzi `A → B` okres `B` nie
   jest wcześniejszy niż okres `A`.
5. **Determinizm:** dwa przebiegi na tym samym wejściu → `toEqual`.
6. **Dowód „przed":** w raporcie podajesz **wynik tego samego testu na kodzie
   sprzed zmiany** (uruchom go na commicie bazowym albo na zachowanej kopii
   `periodFor`), żeby było widać różnicę **liczbowo**. Bez liczby „przed" pozycja
   jest `CZĘŚCIOWO`.

**DoD A.2:** test w `tests/integration/initiatives-execution/planSolver50x4.realdb.test.ts`
(realny PG) **i** wersja jednostkowa domeny. Tabela w raporcie:
`okres | liczba inicjatyw PRZED | liczba inicjatyw PO`.

### A.3 — OPCJONALNA: typy zależności i lag (wolno uczciwie odłożyć)

**Tej pozycji nie musisz zrobić.** Model `FS/SS/FF` + lag/lead **nie istnieje**
w domenie `initiatives-execution` (§1.8 pkt 1). Jeżeli po `A.1` i `A.2` masz
zapas, wolno Ci dodać **addytywnie i opcjonalnie**:

```
PlannedWindow += dependencyEdges?: Array<{ from: string; type: 'FS'|'SS'|'FF'; lagPeriods: number }>
```

z regułami: brak pola = dzisiejsze zachowanie (`FS`, lag `0`); walidacja jak
reszta domeny; kompatybilność wstecz udowodniona testem na payloadzie bez tego
pola. **Nie migrujesz danych. Nie dotykasz `initiative_dependencies` ani
`TaskController`.**

**Jeśli nie robisz — wpisujesz `NIE_ZACZĘTE (świadomie, poza minimalnym zakresem)`
z jednym zdaniem uzasadnienia.** To nie obniża oceny dyżuru.

---

## §B. WYDAJNOŚĆ LISTY — koniec burzy autoryzacyjnej

**Cel jednym zdaniem:** lista 50 inicjatyw z jednego projektu ma kosztować
**stałą** liczbę zapytań autoryzacyjnych, nie 150.

### B.1 — Autoryzacja raz na projekt

Miejsce: `initiativesExecutionRuntime.routes.ts:1751-1757`.

Dzisiaj: `rows.map(async row => await deps.authorize(actor, row.initiative.projectId, 'initiative.view'))`
— **jedno wywołanie na wiersz**, a każde wywołanie to **trzy zapytania SQL bez
cache** (`resolveEffectiveAccess`: rola organizacyjna → członkostwo projektu →
szablon uprawnień). 50 inicjatyw ≈ **150 zapytań**; 500 ≈ **1500** — nawet gdy
wszystkie należą do **jednego** projektu.

**Naprawa — dokładnie taka i żadna inna:**

1. Zbierasz **zbiór unikatowych `projectId`** z wierszy.
2. Wywołujesz `deps.authorize` **raz na unikatowy projekt** i budujesz mapę
   `Map<projectId, boolean>`.
3. Filtrujesz wiersze po tej mapie.
4. **`effectiveAccessService` NIE JEST DOTYKANY** (Z16). Zero cache w serwisie
   dostępu, zero nowego cache globalnego, zero pamięci między żądaniami.
   Deduplikacja żyje **wyłącznie w obrębie jednego żądania**.
5. **`authorizeProjects` (:1153) NIE nadaje się wprost** — zwraca jeden bool dla
   całego zbioru (pułapka 2). Wolno Ci go **wzbogacić addytywnie** o wariant
   zwracający mapę (np. `authorizeProjectsMap`) i przepiąć istniejące wywołanie
   `authorizeProjects` na ten wariant — **pod warunkiem**, że zachowanie
   dotychczasowych wywołań (`:1174`, `:1351`) jest **bit w bit identyczne**
   i udowodnione testem. Inaczej: dopisujesz osobną funkcję i nie ruszasz starej.

**Gdzie jeszcze to sprawdzić:** przejrzyj plik pod kątem innych pętli
`rows.map(... deps.authorize ...)`. Każdą znalezioną **wypisujesz w raporcie**;
naprawiasz te, które dotyczą list zwracających wiele wierszy. Naprawy poza
`GET /initiatives` są **mile widziane, ale nieobowiązkowe** — muszą mieć własny
test.

### B.2 — Paginacja keyset

`postgresInitiativeReader.ts:1227` (`listInitiatives`) nie ma **żadnego** limitu.

**Kontrakt:**

```
GET /api/initiatives/runtime-v1/initiatives?limit=<1..200>&cursor=<opaque>
odpowiedź: { initiatives: [...], nextCursor: string | null }
```

- **Domyślny `limit` = 50**, maksymalny = **200**, `limit` spoza zakresu → `400`
  `VALIDATION_FAILED`.
- **Kursor keyset, nie offset.** Sortowanie
  `ORDER BY updated_at DESC, aggregate_id DESC`, kursor niesie **obie** wartości
  (pułapka 8). Kursor jest **nieprzezroczysty** (base64url JSON) i **walidowany** —
  zepsuty/obcy kursor → `400`, **nigdy** 500 i **nigdy** wyciek do innej organizacji.
- **Kursor NIE niesie `organizationId`** i nawet gdyby ktoś go podmienił, filtr
  organizacji idzie **wyłącznie z tokenu** (DoD pkt 8).
- **Kompatybilność wstecz:** wywołanie **bez** `limit`/`cursor` zwraca dziś to,
  co zwracało — z domyślnym limitem 50 i `nextCursor`. Jeżeli uznasz, że domyślne
  obcięcie do 50 zepsułoby konsumenta frontu, **udowodnij grepem w `src/`** i
  opisz w raporcie; wtedy dopuszczalne jest, by brak `limit` oznaczał brak
  obcięcia, a paginacja włączała się **tylko** przy jawnym `limit`.
  **Wybór uzasadniasz w raporcie — obie opcje są legalne, milczenie nie.**
- **Migracja (jedyna w tym dyżurze):** indeks
  `CREATE INDEX IF NOT EXISTS ix_ie_aggregate_state_org_type_updated
 ON ie_aggregate_state (organization_id, aggregate_type, updated_at DESC, aggregate_id DESC);`
  w pliku `20261110_initiatives_day21_list_keyset_index.sql`
  (numer sprawdzony `ls | grep` — §0.3 pkt 2).

### B.3 — ★ Test wydajnościowy liczący ZAPYTANIA, nie milisekundy

**To jest pozycja dowodowa i najważniejsza część `B`.** Milisekundy są
niestabilne i nic nie dowodzą; **liczba zapytań jest deterministyczna**.

Dwa testy, oba obowiązkowe:

1. **Poziom routera (wstrzyknięty licznik).** Bootujesz realny router
   z `authorize`, który **zlicza wywołania**. Dane: **50 inicjatyw, jeden
   `projectId`**. Asercja: licznik `=== 1` (a nie `50`). Drugi przypadek:
   50 inicjatyw w **3 projektach** → licznik `=== 3`. Trzeci: **pusta lista** →
   licznik `=== 0`.
2. **★ Poziom domyślnego okablowania (Z21) — bez wstrzykiwania.** Realny PG,
   realne `runtimeDependencies` (czyli produkcyjne `authorize` →
   `resolveEffectiveAccess`). Zliczasz **zapytania SQL** — opakowując `pg.Pool`
   własnym licznikiem **w teście** (np. `pool.query` obudowany w spy **na
   instancji utworzonej w teście**), albo czytając `pg_stat_statements`, albo
   `SELECT sum(calls)` z licznika sesji. **Nie modyfikujesz kodu produkcyjnego,
   żeby dało się policzyć.** Asercja: liczba zapytań autoryzacyjnych dla listy
   50 inicjatyw z jednego projektu jest **stała** (niezależna od liczby wierszy):
   wynik dla 50 wierszy `===` wynik dla 5 wierszy. **Podajesz obie liczby
   w raporcie, plus liczbę „przed" na kodzie bazowym.**

**DoD §B:** obie pozycje testowe zielone; tabela w raporcie
`scenariusz | wierszy | projektów | wywołań authorize PRZED | PO | zapytań SQL PRZED | PO`;
**dowód, że `git diff` na `server/src/services/effectiveAccessService.ts` jest
PUSTY** (Z16); negatyw tenanta na liście i na kursorze; kompatybilność wstecz
odpowiedzi (pole `initiatives` zachowuje kształt).

---

## §C. DOMKNIĘCIE PĘTLI ZDOLNOŚCI — „Analizuj → Zaproponuj → Zastosuj"

**Cel jednym zdaniem:** serwer ma **umieć wyliczyć** trzy kanoniczne opcje
reakcji na przeciążenie, a nie tylko **zapisać** te, które ktoś mu poda.

Kontrakt właściciela (`INITIATIVE_CAPACITY_ANALYSIS_EXPERT_SYNTHESIS_2026-08-23.md`,
pkt 105–116) opisuje pętlę **trzykrokową**. Dziś działa **krok pierwszy i trzeci**:
`createCapacityOptions` (`capacityOptions.ts:74`) **żąda od wołającego trzech
gotowych opcji** z pełnym `impact{date,scope,cost,risk}` i rodowodem założeń,
a `selectCapacityOption` (:141) wybiera. **Środka nie ma: nic tych opcji nie
wylicza.** Klient `runtimeApi.ts:1606` istnieje i **nie ma ani jednego wołającego**.

### C.1 — Deterministyczny proponent trzech opcji kanonicznych

Nowy plik: `server/src/domain/initiatives-execution/capacityOptionProposer.ts`.
**Czysta funkcja domeny**, bez I/O, bez LLM (Z14, DEC-51).

**Wejście:** opublikowany `PlanScenario` + opublikowany `CapacityScenario`
(ten sam `planScenarioId`/`planScenarioVersion` — dokładnie jak wymaga
`createCapacityOptions`).

**Wyjście:** dokładnie **trzy** opcje `RESEQUENCE`, `SCOPE_SPLIT`, `ADD_CAPACITY`,
każda w kształcie `CapacityOption`, **przechodząca `capacityOptionFindings` bez
uwag**.

**Reguły twarde:**

1. **Punkt wyjścia = przeciążone okresy** (te, gdzie `demand` przekracza `supply`
   w sensie zakresów, a nie punktowo). Jeśli **żaden** okres nie jest przeciążony
   — proponent zwraca **jawny wynik „brak podstawy do propozycji"**, a trasa
   odpowiada `422` z kodem `NO_CAPACITY_PRESSURE`. **Nie generujesz trzech
   pustych opcji, żeby przejść walidację `createCapacityOptions`.** To byłaby
   atrapa.
2. **`UNKNOWN` propaguje się jako `UNKNOWN`, nigdy jako zero** (Z15). Opcja,
   której wpływu nie da się policzyć, ma `impact.<wymiar>.knowledgeState =
'UNKNOWN'`, `low/base/high = null` i **wypełniony `reason`** — dokładnie tak,
   jak wymaga `capacityOptionFindings`.
3. **Każde założenie ma właściciela i wersjonowane źródło** (`assumptions[].ownerId`,
   `sourceRef{ref,version}`), inaczej `ASSUMPTION_LINEAGE_MISSING`. Źródłem jest
   scenariusz planu/zdolności z **konkretną wersją**, nie „system".
4. **`RESEQUENCE`** wyprowadzasz z solvera `A.1`: przesunięcie inicjatyw
   z przeciążonego okresu do najbliższego okresu z zapasem, **z zachowaniem
   zależności**. `affectedMemberships` niesie `initiativeId` + `membershipVersion`.
5. **`SCOPE_SPLIT`** i **`ADD_CAPACITY`** wyprowadzasz z tego samego przeciążenia,
   ale ich wpływ w wymiarach, których **nie da się** policzyć z dostępnych danych
   (koszt, ryzyko), jest **uczciwie `UNKNOWN` z powodem** — nie zmyślony.
6. **Determinizm** jak w `A.1`: te same wejścia → ten sam wynik, `optionId`
   wyprowadzony deterministycznie z identyfikatorów i wersji wejść (nie losowy
   UUID — patrz `DEC-107`, „fałszywa proweniencja").
7. **Nazewnictwo bez AI** (DEC-51).

### C.2 — Trasa proponenta + kontrakt DTO dla frontu

```
POST /api/initiatives/runtime-v1/capacity-options/:id/propose
body: { planRef: {scenarioId, version}, capacityRef: {scenarioId, version},
        expectedVersion?, clientRequestId }
200 → { comparison: CapacityOptionsComparison }        (status 'DRAFT', 3 opcje, selectedOptionId: null)
422 → { error: { code: 'NO_CAPACITY_PRESSURE' } }      (nie ma czego proponować)
400 → { error: { code: 'VALIDATION_FAILED' } }
409 → konflikt wersji agregatu (kontrakt komend materialnych)
401 → { error: { code: 'AUTH_REQUIRED' } }
404 → obcy tenant / brak scenariuszy
```

**Wymagania twarde:**

- Trasa siedzi **w tym samym routerze** i za tymi samymi bramkami co reszta
  `runtime-v1` — dowodzisz to testem, nie grepem montażu.
- **Organizacja wyłącznie z tokenu.** Test wysyła obcą `organizationId` w body
  i dostaje `404`, nie `200`.
- **Proponent zapisuje przez istniejące `createCapacityOptions`** — nie budujesz
  drugiej ścieżki zapisu i **nie omijasz** walidacji trzech opcji kanonicznych.
- **Idempotencja:** powtórzenie z tym samym `clientRequestId` i tą samą wersją
  → **replay**, nie druga porównywarka. Dowód: liczba wierszy agregatu przed/po.
- **Zero skutków zewnętrznych bez zmiany w bazie (Z22).** Jeżeli zapis się nie
  powiedzie, trasa zwraca błąd i **nie** emituje zdarzenia do outboxu.
- **Kontrakt DTO dla frontu w raporcie** (tabela §1.6) — to jest wejście dla
  robotnika, który dobuduje przycisk „Zaproponuj zmiany".

**DoD §C:** testy domeny (brak przeciążenia → brak propozycji · przeciążenie
z pełnymi danymi → 3 opcje bez uwag walidatora · przeciążenie z `UNKNOWN` →
`UNKNOWN` z powodem, zero zer · determinizm · rodowód założeń) **plus** testy
HTTP realnego routera na realnym PG (happy · `422` bez przeciążenia · `400`
walidacja · `409` zła wersja · replay · **negatyw tenanta**) **plus** dowód
osiągalności (Z20) **plus** tabela kontraktu DTO.

---

## §D. OBCIĄŻENIE WYPROWADZONE Z PLANU + PRZEKRÓJ OSOBOWY

**Cel jednym zdaniem:** `demand` ma **wynikać z planu**, a `supply` ma pokazywać
**ludzi**, bo „średnia zespołu nie może ukryć przeciążonej osoby"
(kontrakt właściciela, pkt #7).

Stan zastany: `CapacityPeriod` ma **jeden** `demand` i **jeden** `supply` na
okres, oba wpisywane ręcznie. Grep `derive|fromPlan|prefill` w domenie: **zero
trafień**. Kontrakt mówi „planned effort / available capacity" — **„planned
effort" nie istnieje jako wyliczenie**.

### D.1 — `demand` wyprowadzany z okien planu

**Źródło danych już istnieje:** `CapacityScenario.proposedAssignments[]` —
`{assignmentId, initiativeId, resourceOrRoleId, periodIds[], demand: CapacityRange, rationale}`.
To jest most między planem a ludźmi i **nikt go nie używa do liczenia**.

**Reguła wyprowadzenia (deterministyczna, w nowym `demandDerivation.ts`):**

1. Dla okresu `P`: `demandDerived(P) = Σ demand` po tych `proposedAssignments`,
   których `periodIds` zawiera `P` **i** których `initiativeId` ma w planie okno
   przecinające `P`.
2. **Sumowanie zakresów jest zakresowe:** `low = Σ low`, `base = Σ base`,
   `high = Σ high`. `knowledgeState` wyniku = **najsłabszy** ze składników
   (`UNKNOWN` > `UNCONFIRMED` > `ESTIMATED` > `KNOWN`). **Jeden składnik
   `UNKNOWN` czyni sumę `UNKNOWN` z powodem wskazującym, którego przydziału
   brakuje** — **nigdy nie pomijasz `UNKNOWN` „bo się nie da dodać".**
3. `sourceRef`/`sourceVersion` wyniku wskazują **scenariusz planu z wersją**,
   `asOf` = znacznik wyliczenia, `ownerId` = właściciel scenariusza zdolności.
4. **Brak przydziałów dla okresu ⇒ `UNKNOWN` z powodem `NO_PROPOSED_ASSIGNMENTS`,
   nie `0`.** To jest najważniejsza linia tej pozycji.

**Nadpisanie ręczne — świadoma decyzja użytkownika, oznaczona w danych:**

- `CapacityPeriod.demand` zyskuje **addytywne, opcjonalne** pole
  `origin: 'DERIVED' | 'MANUAL'` (brak pola = `MANUAL`, czyli dzisiejsze
  zachowanie — kompatybilność wstecz).
- Wyprowadzenie **nadpisuje wyłącznie** wartości `origin: 'DERIVED'` albo
  wartości bez wpisu. **Wartość `MANUAL` nigdy nie jest po cichu nadpisana** —
  wynik wyprowadzenia dla takiego okresu wraca jako **osobne pole
  `derivedDemand`** obok ręcznego `demand`, żeby front mógł pokazać rozjazd.
  (Pułapka 7.)
- Zmiana `MANUAL` → `DERIVED` i odwrotnie to **jawna komenda**, nie efekt uboczny.

### D.2 — `supply` w przekroju osobowym

`CapacityPeriod.supply` zostaje (kompatybilność wstecz) i dostaje **addytywne**
pole:

```
supplyByPerson?: Array<{ personRef: string; role?: string | null; supply: CapacityRange }>
```

- `personRef` = `resourceOrRoleId` z `proposedAssignments` albo identyfikator
  użytkownika — **spójny z tym, czym system już się posługuje**; nie wymyślasz
  nowego słownika tożsamości.
- Walidacja **każdej** pozycji przez istniejącą funkcję `range()`
  (`capacityScenario.ts`) — `UNKNOWN` bez liczb i z powodem, `low ≤ base ≤ high`,
  wersjonowane źródło. **Nie piszesz drugiego walidatora.**
- **Agregat zbiorczy nie może zamaskować osoby:** jeżeli którakolwiek osoba jest
  przeciążona (jej `demand` przekracza jej `supply`), okres niesie flagę
  `hasOverloadedPerson: true` **niezależnie** od tego, czy suma zespołu się
  spina. **To jest dosłowna realizacja pkt #7 kontraktu i główna asercja testu.**
- Brak danych osobowych ⇒ `supplyByPerson` **nieobecne albo puste z powodem**,
  **nigdy** lista z zerami.

**Wymagania twarde §D:**

- Wszystko addytywne w `payload_json` (JSONB) — **żadnego DDL**, chyba że dowód
  z Bloku 0 pokaże inaczej (wtedy numer z przedziału i wpis w „Korektach").
- Kompatybilność wstecz udowodniona **testem na payloadzie zapisanym przed
  zmianą** (bez `origin`, bez `supplyByPerson`).
- `validateCapacityScenario` rozszerzasz **wyłącznie addytywnie** — istniejące
  scenariusze, które dziś przechodzą, muszą przechodzić dalej.

**DoD §D:** testy domeny (wyprowadzenie z pełnych danych · jeden przydział
`UNKNOWN` → suma `UNKNOWN` z powodem · brak przydziałów → `UNKNOWN`, nie zero ·
`MANUAL` nie nadpisane, `derivedDemand` obok · przekrój osobowy z jedną osobą
przeciążoną przy spinającej się sumie zespołu → `hasOverloadedPerson: true` ·
kompatybilność wstecz starego payloadu) **plus** test HTTP realnego routera
na realnym PG z readbackiem niezależnym `pg.Pool` **plus** negatyw tenanta
**plus** dowód osiągalności (Z20).

---

## §E. ZABEZPIECZENIE NASYCENIA

**Cel jednym zdaniem:** nasycenie ma być **liczone kanonicznie na serwerze**,
z jawnym stanem `NIEOKREŚLONE` zamiast liczby 8000 %.

**Stan zastany — i ważna korekta zakresu:** nasycenie jest dziś liczone
**wyłącznie we froncie** (`src/components/Initiatives/CapacityScenarioSurface.tsx`,
~:219-230). Warunek chroni tylko przed **zerem** (`supply.low > 0`), więc
`supply.low = 0.1` daje `demand.high / 0.1` — **8000 %**. Serwer nie liczy
nasycenia w ogóle (`grep -rn "saturation" server/src` → same trafienia o puli
połączeń).

**Front jest poza Twoim zakresem (Z17).** Dlatego pozycja `E` brzmi:

1. **Nowy plik `server/src/domain/initiatives-execution/saturation.ts`** —
   czysta funkcja kanoniczna:
   ```
   computeSaturation(demand: CapacityRange, supply: CapacityRange)
     → { state: 'KNOWN' | 'UNDETERMINED',
         lowPercent: number | null, basePercent: number | null, highPercent: number | null,
         reason: string | null }
   ```
2. **Reguły:**
   - Którykolwiek składnik `UNKNOWN` albo `null` ⇒ `state: 'UNDETERMINED'`
     z `reason` (**nie** `0`, **nie** `Infinity`, **nie** `NaN`).
   - **Dolny próg podaży.** `supply` poniżej progu istotności (próg **jawny,
     nazwany stałą, uzasadniony w kodzie komentarzem i w raporcie** — np.
     `MINIMUM_MEANINGFUL_SUPPLY`) ⇒ `state: 'UNDETERMINED'`,
     `reason: 'SUPPLY_BELOW_MEANINGFUL_THRESHOLD'`. **Wartość progu jest decyzją
     produktową — jeśli nie masz podstawy, żeby ją wybrać, ustaw ją tak, by
     odpowiadała „mniej niż jedna setna jednostki `windowUnit`", opisz to
     w raporcie i oznacz jako `DO_POTWIERDZENIA_WŁAŚCICIELA`.**
   - **Górne ograniczenie prezentacji.** Wynik powyżej rozsądnego pułapu
     (np. 999 %) wraca jako `state: 'KNOWN'` z `basePercent` **przyciętym**
     i `reason: 'SATURATION_CAPPED'` — żeby front mógł napisać „>999 %" zamiast
     „8000 %". **Przycięcie MUSI być widoczne w danych**; ciche przycięcie bez
     `reason` to fałszowanie wyniku.
   - Determinizm i zero wyjątków: funkcja **nigdy nie rzuca**, dla każdego
     wejścia zwraca zdefiniowany wynik.
3. **Wystawienie:** `saturation` (wynik funkcji) dołącza się **addytywnie** do
   odczytu scenariusza zdolności zwracanego przez runtime — tak, żeby front mógł
   przestać liczyć samodzielnie.
4. **NIE ZMIENIASZ `CapacityScenarioSurface.tsx`.** Wpisujesz do raportu, do
   sekcji „kontrakt dla frontu": _„nasycenie liczy serwer; front ma zastąpić
   własne wyliczenie z linii ~219-230 odczytem pola `saturation`; do zrobienia
   przez robotnika wewnętrznego"_.

**DoD §E:** testy jednostkowe (pełne dane · `UNKNOWN` w `demand` · `UNKNOWN`
w `supply` · `supply.base = 0` · `supply.low = 0.1` → `UNDETERMINED`, **nie**
8000 % · wynik ponad pułapem → `SATURATION_CAPPED` · determinizm · brak wyjątku
dla każdego wejścia z tabeli przypadków) **plus** test kontraktu odpowiedzi
runtime na realnym PG **plus** dowód, że `git diff` na `src/` jest **PUSTY**.

---

## §F. TRWAŁOŚĆ OŚMIU SEKCJI LOKALNYCH — najpierw inwentarz, potem budowa

**Osiem sekcji karty inicjatywy trzyma stan WYŁĄCZNIE lokalnie** — renderują,
pozwalają edytować i **nic nie zapisują**. Zweryfikowane: zero wywołań API
w każdym z ośmiu plików.

```
src/components/Initiatives/sections/AttachmentsSection.tsx        (45 linii)
src/components/Initiatives/sections/RemindersSection.tsx           (92)
src/components/Initiatives/sections/HistorySection.tsx             (75)
src/components/Initiatives/sections/PilotSection.tsx              (290)
src/components/Initiatives/sections/ControlSection.tsx            (203)
src/components/Initiatives/sections/FinancialImpactSection.tsx    (138)
src/components/Initiatives/sections/FinancialAnalysisSection.tsx  (114)
src/components/Initiatives/sections/RaciEscalationSection.tsx      (37)
```

**★ KOLEJNOŚĆ JEST OBOWIĄZKOWA: NAJPIERW INWENTARZ, POTEM DECYZJA.**
Nie budujesz ani jednego endpointu, zanim nie wypełnisz tabeli:

| Sekcja            | Dane, które trzyma | Endpoint kandydat (plik:linia)                      | Przyjmuje potrzebne pola? | Werdykt               |
| ----------------- | ------------------ | --------------------------------------------------- | ------------------------- | --------------------- |
| Attachments       |                    |                                                     |                           | `MA_API` / `BRAK_API` |
| Reminders         |                    |                                                     |                           |                       |
| History           |                    | `pmo/initiatives.routes.ts:3712` `GET /:id/history` |                           |                       |
| Pilot             |                    |                                                     |                           |                       |
| Control           |                    |                                                     |                           |                       |
| FinancialImpact   |                    |                                                     |                           |                       |
| FinancialAnalysis |                    |                                                     |                           |                       |
| RaciEscalation    |                    |                                                     |                           |                       |

**Reguły:**

1. **`MA_API`** = istnieje zamontowany endpoint, który przyjmuje **wszystkie**
   pola sekcji i zapisuje je tenant-scoped. Wtedy: **dopinasz zapis po stronie
   serwera** (walidacja, kontrola tenanta, readback) i wpisujesz kontrakt dla
   frontu. **Nie dotykasz komponentu** — front podłączy robotnik.
2. **`CZĘŚCIOWO`** = endpoint istnieje, ale nie przyjmuje części pól. Wtedy:
   **rozszerzasz go addytywnie**, jeśli mieści się w Twojej ramce Z17; jeśli nie
   mieści (np. leży w `InitiativeController.ts`) — **wpisujesz `BRAK_API`
   z dokładnym opisem brakującego pola**, bez zmiany cudzego pliku.
3. **`BRAK_API`** = nie budujesz nic. Wypisujesz **kontrakt dla przyszłego bloku**:
   nazwa zasobu, kształt body, kształt odpowiedzi, kody błędów, tabela docelowa,
   uwagi o tenancie. **Zero UI. Zero „przygotowawczych" endpointów bez
   konsumenta** — martwy endpoint to ten sam grzech co martwe UI.
4. **Dowód osiągalności (Z20) dla każdego `MA_API`** — bez ścieżki od realnego
   wejścia wpis jest `BRAK_API`, nie `MA_API`.

**DoD §F:** kompletna tabela inwentarza (osiem wierszy, zero pustych pól);
dla każdego `MA_API` — 4 testy behawioralne na realnym routerze i realnym PG
(happy · walidacja · pusty · negatyw tenanta) plus readback; dla każdego
`BRAK_API` — kontrakt w raporcie i **zero kodu**.

---

## §G. SPRZĄTANIE SERWERA

Cztery podpozycje. **Każda z osobnym dowodem, że nic żywego nie zniknęło.**

### G.1 — Martwe agregatory tras

```
server/src/routes/index.ts:18   export { default as assessmentDomainRoutes } from './assessment/index.js'
server/src/routes/index.ts:23   export { default as pmoDomainRoutes }        from './pmo/index.js'
```

Nic w `server/` nie importuje `routes/index.js` — więc **cały poddrzewny
agregator jest martwy**: `routes/pmo/index.ts` (`:33` montuje `initiatives`)
i `routes/assessment/index.ts` (`:26`). Pliki tras, które one montują, są
**zamontowane bezpośrednio w `Gateway.ts`** i nie znikną.

**Procedura — obowiązkowa, per plik:**

```bash
grep -rn "routes/index" server/src            # oczekiwane: wyłącznie sam plik
grep -rn "pmoDomainRoutes\|assessmentDomainRoutes" server/src
grep -rn "pmo/index\|assessment/index" server/src src tests
```

Dopiero po **trzech pustych wynikach** usuwasz. **Jeden niepusty = NIE usuwasz**,
wpisujesz do „Znalezisk". Usunięcie musi być potwierdzone **uruchomieniem
serwera/testów tras**, nie samym grepem.

### G.2 — Podwójny montaż PMO

```
Gateway.ts:696   app.use('/api/initiatives',     ..., initiativesRoutes)
Gateway.ts:1156  app.use('/api/pmo/initiatives', ..., initiativesRoutes)
```

Ten sam router jest zamontowany dwa razy, więc **cały `runtime-v1` (~330
endpointów) jest osiągalny pod dwoma prefiksami** — podwójna powierzchnia ataku
i podwójny koszt utrzymania.

**Procedura:**

```bash
grep -rn "/api/pmo/initiatives\|pmo/initiatives" src tests server/src
```

- **Zero trafień konsumenckich** ⇒ usuwasz **dokładnie linię 1156** i nic więcej
  w `Gateway.ts` (licencja imienna Z17).
- **Jakiekolwiek trafienie** ⇒ **NIE usuwasz** (pułapka 9). Wpisujesz do
  „Znalezisk": _„montaż `/api/pmo/initiatives` ma żywych konsumentów: <lista>;
  usunięcie wymaga zmiany frontu — pozycja dla robotnika wewnętrznego"_.
- Po usunięciu: test dowodzący, że `/api/initiatives/runtime-v1/...` dalej działa,
  a `/api/pmo/initiatives/runtime-v1/...` zwraca `404`.

### G.3 — Dwa endpointy podobieństwa

```
pmo/initiatives.routes.ts:405   POST /similarity-check   ← konsument: InitiativeWizardModal.tsx:1086
pmo/initiatives.routes.ts:3955  POST /similar-check      ← konsument: src/services/api/initiativeSimilar.ts:19
```

**OBA MAJĄ ŻYWYCH KONSUMENTÓW** (pułapka 10). Front jest poza zakresem, więc
**nie wolno Ci usunąć żadnego z nich.**

**Twój produkt:** **jedna implementacja, druga trasa deleguje** (alias serwerowy).
Wybierasz kanoniczną (rekomendacja: `/similarity-check` — bogatszy kontrakt,
konsument w kreatorze), druga staje się cienkim przekierowaniem do tej samej
funkcji, z **zachowanym kształtem odpowiedzi swojego konsumenta**. Plus wpis
w raporcie: _„po przepięciu `initiativeSimilar.ts` na trasę kanoniczną trasa
`/similar-check` może zniknąć — pozycja dla robotnika wewnętrznego"_.

**DoD G.3:** test, że **obie** trasy dalej odpowiadają w swoim dotychczasowym
kontrakcie (asercja na kształcie odpowiedzi **przed** i **po**), oraz że logika
jest jedna (zmiana w implementacji widoczna na obu trasach).

### G.4 — Cichy fałszywy sukces `generateSectionContent`

`server/src/services/initiativeGenerationService.ts:682-698`: przy braku
skonfigurowanego LLM funkcja zwraca **HTTP 200** z treścią
`"[nazwa] — Please fill in this section..."` i `model: 'placeholder'`.
Użytkownik widzi „wygenerowano" i tekst, którego nikt nie wygenerował.

**W tym samym pliku, ~:1211-1219, druga ścieżka robi to UCZCIWIE**:
zwraca `{ ok: false, model: 'placeholder' }`. **To jest wzorzec.**

**Naprawa — jedna z dwóch, wybór uzasadniasz w raporcie:**

- **(a) jawny błąd:** trasa zwraca `503` z kodem maszynowym
  `AI_PROVIDER_NOT_CONFIGURED` i **bez** treści-atrapy; albo
- **(b) jawny stan `degraded` w odpowiedzi:** `200` z
  `{ content: null, degraded: true, degradedReason: 'AI_PROVIDER_NOT_CONFIGURED' }`
  — **bez** zmyślonej treści.

**Wymagania:**

- **Zero podpinania dostawcy LLM** (Z14). Naprawiasz **uczciwość odpowiedzi**,
  nie włączasz AI.
- **Zero zmian w drugiej, uczciwej ścieżce.**
- Parytet komunikatów PL+EN **tylko** jeśli komunikat wychodzi z API jako tekst
  (kod maszynowy parytetu nie wymaga).
- Ten plik jest **współdzielony** — obowiązkowo uruchamiasz katalogi konsumentów
  (§0.4a) i podajesz wynik bez zawężania (Z23).

**DoD §G (wszystkie podpozycje):** dla każdej — dowód, że nic żywego nie
zniknęło (grepy + test); tabela w raporcie
`co usunięto/zmieniono | dowód martwości | test potwierdzający`; **zero zmian
w `src/`**.

---

## §T. TESTY — pozycja własna, nie dodatek

### T.1 — Pokrycie nowych i zmienionych powierzchni

Nowe pliki w `tests/integration/initiatives-execution/` (wzorzec:
`initiativesExecutionRuntime.http.realdb.test.ts`, konfiguracja: **istniejąca**
`vitest.realdb.config.ts` — **NIE ZMIENIASZ JEJ**, Z18; nazwa pliku musi kończyć
się `.realdb.test.ts`, żeby wpaść w `include`).

| Powierzchnia                         | Pozycja | Minimum                                                                                                                                                          |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /plan-analysis-proposals/...`  | A       | rozkład 50×4 · zależności · okno nie do spełnienia · pojemność `UNKNOWN` · determinizm · obcy tenant                                                             |
| `GET /initiatives`                   | B       | licznik `authorize` 1/3/0 · **licznik zapytań SQL na domyślnym okablowaniu** · paginacja happy · zły kursor `400` · obcy tenant                                  |
| `POST /capacity-options/:id/propose` | C       | happy 3 opcje · `422` bez przeciążenia · `400` walidacja · `409` wersja · replay · obcy tenant                                                                   |
| odczyt scenariusza zdolności         | D, E    | `demand` wyprowadzony · `MANUAL` nienadpisane · przekrój osobowy z przeciążoną osobą · `saturation` `UNDETERMINED` przy `supply.low=0.1` · payload sprzed zmiany |
| sekcje `MA_API`                      | F       | happy · walidacja · pusty · obcy tenant (per sekcja)                                                                                                             |
| trasy podobieństwa                   | G.3     | obie trasy w dotychczasowym kontrakcie                                                                                                                           |
| generacja sekcji bez LLM             | G.4     | brak dostawcy → jawny błąd/`degraded`, **zero treści-atrapy**                                                                                                    |

### T.2 — Negatywy tenanta jako osobny, jawny pakiet

Jeden plik z negatywami tenanta dla **wszystkich** nowych i zmienionych tras.
Obcy `organizationId` nigdy nie dostaje `200`. `organizationId` z body/query
**jest ignorowany** — test to udowadnia (wysyłasz obcą organizację w body
i dostajesz `404`, nie `200`).

**★ Dowód mutacyjny (wzorzec z `DEC-107`):** dla co najmniej **dwóch** tras
pokazujesz, że test faktycznie ma zęby — tymczasowo neutralizujesz filtr
organizacji w kodzie, uruchamiasz test, **musi być czerwony**, przywracasz kod.
Wynik (czerwony przed przywróceniem) wpisujesz do raportu. **Test, który
przechodzi po usunięciu filtru organizacji, nie jest testem izolacji.**

### T.3 — Zakaz osłabiania testów zastanych

Nie osłabiasz asercji istniejących wcześniej. Jeżeli test wymaga zmiany, bo
rozszerzyłeś kontrakt **addytywnie** (nowe pole) i asercja jest `toEqual` całego
obiektu — **dopisujesz pole**, nie zmieniasz wartości istniejących; **każdy taki
przypadek to obowiązkowy wpis „przed/po" w raporcie**. Zamiana `toBe` na
`not.toBe` bez wpisu = podstawa odrzucenia (`DEC-108`, P1 dnia 19).

### T.4 — i18n

Tylko dla napisów wychodzących z Twojego API (komunikaty i kody błędów).
Parytet `initiatives.*` PL+EN w tym samym commicie. **Zero nowych kluczy „na
zapas" pod nieistniejący front.**

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 05_INITIATIVES do stanu faktycznego

Podnosisz **wyłącznie** o to, co faktycznie działa i ma dowód (commit + test +
przebieg na realnym PG). **Nie deklarujesz gotowości, której nie ma. Nie
zmieniasz statusów cudzych pozycji. Nie ustawiasz `Owner verdict`** — to należy
do właściciela. Jeśli pozycja skończyła się `CZĘŚCIOWO`/`STOP`, w rejestrze ma
być `CZĘŚCIOWO`/`STOP`, nie „done".

**Wzorzec pozytywny:** odbiór dnia 19 pochwalił diff, który dodawał **dokładnie
jeden token: `CZĘŚCIOWO`**. Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.

### R.2 — Komplet dowodów

Wyniki testów (z rozbiciem zastane/wprowadzone — Z23), dowód idempotencji
migracji, **dowód celu połączenia (Z19)**, tabela `PRZED/PO` dla solvera
(pozycja A.2), tabela `PRZED/PO` dla liczby zapytań (pozycja B.3), tabela
inwentarza sekcji (F), tabela kontraktów dla frontu, **dowody osiągalności (Z20)
dla każdej pozycji**, dowód sprzątnięcia kontenera **i wolumenów**. Bez kompletu
— pozycja `CZĘŚCIOWO`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~80 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
--is-ancestor` z §0.1 pkt 1** (SHA markera jest tam, w jednym miejscu — nie
   przepisujesz go z pamięci). Brak → STOP i koniec dyżuru. Rozejście marker→tip
   → wpis, start z markera (DEC-95), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19).
   Gałąź + worktree (§0.1 pkt 5), symlink `node_modules` (DEC-86, tylko odczyt),
   potem:

   ```bash
   docker run -d --name cx-day21-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day21 \
     -p 5471:5432 pgvector/pgvector:pg16
   export DATABASE_URL="postgres://postgres:cx@localhost:5471/cx_day21"
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day21-pg psql -U postgres -d cx_day21 -c "SELECT current_database(), inet_server_port();"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 1 — pełne migracje projektu
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 2 → Applying migrations: 0
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry # dry → Pending migrations: 0
   ```

   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — zawsze z jawnym
   `DATABASE_URL`, `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`
   **w tej samej linii**.

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów wiążących
   (§0.1 pkt 4). Brak `DEC-109` = STOP.

4. **Numer migracji — WEWNĄTRZ PRZEDZIAŁU `20261110`–`20261119`** (§0.3 pkt 2):

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3
   ls server/migrations | grep '^20261110'        # MUSI być puste
   ```

5. **Weryfikacja mapy z §1.5 i erraty z §1.8** — każdą rozbieżność do „Korekt".
   Obowiązkowo:

   ```bash
   grep -n "periodFor" server/src/domain/initiatives-execution/planAnalysisProposal.ts
   grep -n "dependencySnapshot" server/src/domain/initiatives-execution/planScenario.ts
   grep -n "ProposedAssignment\|supply\|demand" server/src/domain/initiatives-execution/capacityScenario.ts | head -20
   grep -n "createCapacityOptions\|Exactly three distinct canonical" server/src/domain/initiatives-execution/capacityOptions.ts
   grep -n "const authorizeProjects\|row.initiative.projectId" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   grep -n "authorize: async (actor, projectId, capability)" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
   grep -n "async listInitiatives" -A 12 server/src/domain/initiatives-execution/postgresInitiativeReader.ts
   grep -rn "routes/index" server/src
   grep -rn "/api/pmo/initiatives" src tests server/src | head
   grep -rn "similar-check\|similarity-check" src | head
   grep -n "model: 'placeholder'" server/src/services/initiativeGenerationService.ts
   grep -rn "freeze\|lagDays\|'FS'\|'SS'\|'FF'" server/src/domain/initiatives-execution/   # oczekiwane: PUSTO (errata §1.8)
   ```

6. **★ BASELINE TESTÓW — PRZED PIERWSZYM COMMITEM** (§0.4a pkt 6), z jawnym
   `DATABASE_URL` tam, gdzie dotyczy. Wyniki (liczby PASS/FAIL **per plik**) do
   raportu. **Czerwone testy zastane opisujesz, nie „naprawiasz".** Bez tego
   baseline'u nie masz jak spełnić Z23.

7. Założenie raportu (§9) i wpisanie wyników 1–6.

### Blok 1 — solver (A.1 → A.2)

Najdroższa i najważniejsza pozycja dyżuru — zaczynasz od niej, **zawsze**.
`A.2` (dowód 50×4) jest **częścią** pozycji, nie dodatkiem: solver bez liczby
„przed/po" jest `CZĘŚCIOWO`. `A.3` **tylko jeśli zostanie zapas** — i wolno jej
nie robić.

### Blok 2 — wydajność (B.1 → B.2 → B.3)

Tanie i o dużym zwrocie. **`B.3` jest obowiązkowe** — bez licznika zapytań
pozycja `B` jest deklaracją, nie dowodem. **Jeśli po Bloku 1 zostało Ci mniej niż
połowa dyżuru — rób `B` przed `C` i `D`.**

### Blok 3 — pętla zdolności (C.1 → C.2)

Po `A`, bo `RESEQUENCE` korzysta z solvera.

### Blok 4 — obciążenie i nasycenie (D.1 → D.2 → E)

`E` jest tanie i samodzielne — **jeśli czasu mało, rób `E` PRZED `D`**
(pojedyncza czysta funkcja + testy, natychmiastowa wartość).

### Blok 5 — sprzątanie i inwentarz (G.1 → G.2 → G.3 → G.4 → F)

`G` jest tanie i mierzalne. `F` to **głównie inwentarz** — nie zaczynaj budowy
endpointów, jeśli nie masz czasu na pełną tabelę ośmiu sekcji; sam inwentarz jest
wartościowym produktem.

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. `§T` (testy, negatywy tenanta z dowodem mutacyjnym), `R.1`, `R.2` dla tego,
   co faktycznie zbudowałeś.
2. **Pomiar zasięgu (§0.4a) z rozbiciem zastane/wprowadzone (Z23).**
3. **Dziewięć dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                     # PUSTY (front poza zakresem)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/effectiveAccessService.ts                                  # PUSTY (Z16 — KRYTYCZNE)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/frameworkEntitlementService.ts server/src/middleware        # PUSTY (Z16)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                        # tylko 2026111x_initiatives_day21_*
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|process.env.ENABLE_)"                # PUSTY (zero flag, Z10)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(llmService|generateResponse|getLLMServiceInstance)"               # PUSTY (Z14)
   git diff codex/m03-admin-20260824...HEAD -- server/src/Gateway.ts | grep -c "^[-+]"                                         # co najwyżej JEDNA usunięta linia (G.2)
   docker ps -a --filter name=cx-day21-pg ; docker volume ls | grep -i cx-day21                                                # PUSTO (sprzątnięte)
   ```
4. **Dowody osiągalności (Z20)** dla każdej pozycji — zebrane w jednej sekcji.
5. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day21-pg && docker volume ls -q | grep -i cx-day21 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności

Lepiej **domknięte** `A` + `B` + testy niż siedem pozycji „prawie". Każda pozycja
albo spełnia DoD, albo jest uczciwie oznaczona (`STOP` / `BRAK_API` /
`CZĘŚCIOWO` / `NIE_ZACZĘTE`).

**Jeżeli po Bloku 1 i 2 nie masz już czasu — to jest DOBRY dyżur.** Solver, który
naprawdę planuje, i lista, która nie wysypuje bazy, są warte więcej niż siedem
pozycji bez dowodów.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/INITIATIVES_DAY21_REPORT_20260826.md
```

Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Inicjatywy dzień 21 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź: codex/initiatives-day21-<data>
Worktree: /private/tmp/consultify-initiatives-day21
Port PG: 5471 · kontener cx-day21-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>

## ★ Dowód celu połączenia (Z19 / DEC-96)

<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z jawnym DATABASE_URL w tej samej linii>

## Warunki wstępne — tabela

<marker · DEC-109 scalone (martwy router nieobecny) · rdzeń (b) obecny ·
dyscyplina UNKNOWN (c) nienaruszona · rejestr decyzji · numer migracji wolny
w przedziale 20261110-20261119 (ls|grep) · migracje 1/2/dry · BASELINE testów przed>

## Pozycje — tabela zbiorcza

| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE) | Commit | Dowód |
| A.1 solver | | | |
| A.2 dowód 50×4 | | | |
| A.3 typy zależności (opcjonalna) | | | |
| B.1 autoryzacja raz na projekt | | | |
| B.2 paginacja keyset | | | |
| B.3 test liczący zapytania | | | |
| C.1 proponent opcji | | | |
| C.2 trasa + DTO | | | |
| D.1 demand z planu | | | |
| D.2 przekrój osobowy | | | |
| E nasycenie | | | |
| F inwentarz sekcji | | | |
| G.1 martwe agregatory | | | |
| G.2 podwójny montaż | | | |
| G.3 podobieństwo | | | |
| G.4 placeholder | | | |
| T testy | | | |
| R.1 rejestr | | | |

## ★ DOWODY OSIĄGALNOŚCI (Z20 / DEC-104) — obowiązkowe dla KAŻDEJ pozycji

| Pozycja | Realne wejście (metoda + URL) | Montaż (plik:linia) | Router (plik:linia) | Domena (plik:linia) | Zapis (tabela.kolumna) |

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z21 / DEC-107)

| Pozycja | Co wołane bez wstrzykiwania | Plik testu | Wynik |

## Tabele werdyktów

### A — solver | Okres | Inicjatyw PRZED | Inicjatyw PO | Identycznych trójek dat PRZED/PO |

### A — reguły | Reguła | Test | Wynik | (zależności · okno · pojemność UNKNOWN · determinizm · konflikt)

### B — wydajność | Scenariusz | Wierszy | Projektów | authorize PRZED | PO | zapytań SQL PRZED | PO |

### C — proponent | Przypadek | Opcji | UNKNOWN z powodem? | Findings walidatora | Wynik |

### D — obciążenie | Przypadek | demand źródło | origin | derivedDemand | hasOverloadedPerson | Wynik |

### E — nasycenie | Wejście (demand/supply) | state | percent | reason |

### F — inwentarz sekcji | Sekcja | Dane | Endpoint kandydat | Przyjmuje pola? | Werdykt |

### G — sprzątanie | Co usunięto/zmieniono | Dowód martwości (grep) | Test potwierdzający |

## ★ KONTRAKT DLA FRONTU (produkt §1.6)

| Trasa | Metoda | Body | Odpowiedź | Kody błędów |
<wszystkie nowe i zmienione trasy + pozycje „front do zbudowania">

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

## Znaleziska (NIE naprawiane przeze mnie)

## Korekty wobec instrukcji

<w tym każda rozbieżność wobec §1.5 i erraty §1.8>

## Migracje

<numer, dowód ls|grep w przedziale 20261110-20261119, addytywność, brak FK,
idempotencja (3 przebiegi), kompatybilność wstecz, MIGRATION_PREPARED>

## Testy

### Baseline (przed pierwszym commitem)

### Wynik końcowy — ★ PEŁNY ZAKRES §0.4a, BEZ ZAWĘŻANIA (Z23)

Zakres §0.4a: <X>/<Y> PASS
czerwone ZASTANE: <lista + liczby>
czerwone WPROWADZONE: <lista + SHA commitu, który je zapalił> ← jeśli PUSTE, napisz to wprost

### Zmiany w testach istniejących — przed/po (T.3)

### Dowody mutacyjne izolacji tenanta (T.2)

### Dziewięć dowodów Bloku 6

## Licznik

<pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte>

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`. Bez dowodu osiągalności = `NIE_ZACZĘTE`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „szybciej" → `150 zapytań → 3 zapytania`.
   „lepszy rozkład" → `46/50 w Q4 → 13/50 w Q4`.
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `NIE_ZACZĘTE`.
5. **Nie zawyżasz.** Dzień 16 zawyżył `I.1`, dzień 19 zawyżył liczbę testów —
   oba odbiory to wyłapały. **Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.**
6. **Nie piszesz „gotowe do pokazania właścicielowi"** — piszesz „gotowe do
   odbioru przez nadzorcę".

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# typy punktowo (NIGDY pełny tsc)
npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run server/src/domain/initiatives-execution/__tests__/<plik>.test.ts

# test celowany Z bazą — ZAWSZE tak (Z19), env W TEJ SAMEJ LINII
DATABASE_URL="postgres://postgres:cx@localhost:5471/cx_day21" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
npx vitest run --config tests/integration/initiatives-execution/vitest.realdb.config.ts

# numeracja migracji — PRZED KAŻDYM NOWYM PLIKIEM, TYLKO W PRZEDZIALE 20261110-20261119
ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3
ls server/migrations | grep '^20261110'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day21-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day21 -p 5471:5432 pgvector/pgvector:pg16
docker exec cx-day21-pg psql -U postgres -d cx_day21 -c "SELECT current_database(), inet_server_port();"
export DATABASE_URL="postgres://postgres:cx@localhost:5471/cx_day21"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day21-pg && docker volume ls -q | grep -i cx-day21 | xargs -r docker volume rm && docker volume prune -f

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/initiatives-execution/planSolver50x4.realdb.test.ts

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Uruchomienie testu DB bez `DATABASE_URL`/`RUN_DB_TESTS=1` w tej samej linii**
   → mock DB, wynik bez wartości (Z19; dzień 17 na tym poległ).
2. **Numer migracji spoza przedziału `20261110`–`20261119`** → cicha kolizja
   z równoległym dyżurem w porządku alfabetycznym (dzień 18, `DEC-107`).
3. **Dotknięcie `effectiveAccessService.ts`** → Z16, odrzucenie dyżuru.
   Pozycja `B` to **liczba wywołań**, nie zmiana serwisu.
4. **Użycie `authorizeProjects` wprost do filtrowania listy** → zwraca jeden bool
   dla całego zbioru; ukryłbyś całą listę. Potrzebujesz **mapy**.
5. **Zamiana `UNKNOWN` na `0` przy wyprowadzaniu `demand`** → zniszczenie jedynej
   rzeczy, którą ten moduł robi wzorowo (Z15).
6. **Ciche nadpisanie ręcznego `demand`** → utrata pracy użytkownika. `origin`
   jest obowiązkowy.
7. **Solver, który zapisuje do planu zamiast proponować** → złamanie modelu
   decyzyjnego (`PENDING_REVIEW` → `analysisDecision`).
8. **Trasa zwracająca sukces bez zmiany w bazie, ale ze skutkiem zewnętrznym**
   → Z22, odrzucenie pozycji (dzień 19, `DEC-108`).
9. **Test wstrzykujący `authorize`/`reader` jako jedyny dowód** → Z21, pozycja
   nieudowodniona (dzień 18, `DEC-107`).
10. **Usunięcie `/api/pmo/initiatives` albo trasy podobieństwa bez sprawdzenia
    konsumentów** → regresja podana jako sprzątanie.
11. **Deklaracja „N/N PASS" na wybranym podzbiorze** → Z23, zawyżenie
    (dzień 19, `DEC-108`).
12. **Wejście we `src/`** → Z17 + złamanie podziału FRONT/TYŁ i reguły 7
    („właściciel nigdy nie jest pierwszym testerem wizualnym").

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie dotykasz `src/` — **ani jednej linii**, nawet żeby podłączyć własny endpoint;
- nie tworzysz flagi i nie zmieniasz domyślnej wartości istniejącej;
- nie podpinasz dostawcy LLM (`G.4` to uczciwość odpowiedzi, nie AI);
- nie dodajesz cache w `effectiveAccessService` ani nigdzie w modelu uprawnień;
- nie rozszerzasz `ensureInitiativeTables`-podobnych leniwych bootstrapów —
  nowe DDL idzie **wyłącznie** migracją w przydzielonym przedziale;
- nie dodajesz kluczy obcych do `ie_*`;
- nie usuwasz martwego **frontu** (osobna gałąź w toku);
- nie zmieniasz `InitiativeController.ts` ani `TaskController.ts`;
- nie robisz `rebase` na nowszy tip m03 (DEC-95 — robi to nadzorca);
- nie nazywasz deterministycznego solvera „AI" (DEC-51).

---

## 11. NA KONIEC

Ten moduł ma **najlepszy backend w całym korpusie** i ocenę **4,0/10**. To nie
jest sprzeczność — to diagnoza. Fundament jest wart 8–9; to, co na nim postawiono,
udaje działanie. Twój dyżur nie dobudowuje piętra. **Twój dyżur zamienia atrapy
w mechanikę.**

Trzy rzeczy decydują o odbiorze:

1. **Solver, który naprawdę planuje — z liczbą.** Nie „poprawiłem algorytm",
   tylko _„46 z 50 inicjatyw lądowało w ostatnim okresie; teraz ląduje 13,
   każda zależność respektowana, wynik deterministyczny"_. Bez tabeli `PRZED/PO`
   pozycja `A` jest `CZĘŚCIOWO`.
2. **Wydajność udowodniona ZAPYTANIAMI, nie milisekundami — i to na domyślnym
   okablowaniu.** Test, który wstrzykuje własne `authorize`, dowodzi tylko tego,
   że umiesz wstrzyknąć `authorize` (Z21). Policz zapytania SQL przeciwko
   `runtimeDependencies` i podaj obie liczby.
3. **Uczciwość ponad zasięg.** Siedem pozycji „prawie" jest gorsze niż dwie
   domknięte i pięć uczciwie oznaczonych. Dwa ostatnie odbiory wstrzymały merge
   za **zawyżenie**, nie za brak zakresu.

**Zero zmian w `src/`. Zero dotknięcia modelu uprawnień. Zero flag. Zero atrap —
zwłaszcza tych, które zwracają 200.**
