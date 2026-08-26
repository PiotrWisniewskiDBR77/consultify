# INSTRUKCJA DYŻURU nr 14 — Codex — „BACKEND PACK RESULTS + EXECUTION: komplet endpointów zaraportowanych jako uczciwe BRAK_API w dniach 8 i 11"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–13. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **inny niż wszystkie poprzednie**. Dyżury 1–13 były dyżurami
modułowymi: jeden moduł, front + back + zrzuty. Ten dyżur jest **dyżurem
mechaniki tylnej** — wg nowej zasady podziału pracy w programie: **Codex robi
backend, powierzchnie wizualne robi kto inny i później.**

| Co                 | Wartość                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Obszar             | `server/**` (Results vNext + Execution runtime/reports)                                                                      |
| Źródło zakresu     | `RESULTS_DAY8_REPORT_20260825.md` + `EXECUTION_DAY11_REPORT_20260825.md` — pozycje zaraportowane jako **uczciwe `BRAK_API`** |
| Decyzje wiążące    | `DEC-2026-08-25-62`, `DEC-2026-08-25-63`, `DEC-2026-08-25-65`, `DEC-2026-08-25-72`                                           |
| Rejestry odbiorowe | `modules/09_RESULTS/MODULE_ACCEPTANCE.md` (115 l.), `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.)                     |
| Raport             | `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md`                                           |

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

### 1. **ZERO UI. Dosłownie zero.**

Nie tworzysz i nie zmieniasz **żadnego** pliku `.tsx`. Nie tworzysz i nie
zmieniasz żadnego komponentu, żadnego hooka renderującego, żadnego pliku
w `src/components/**` **poza dwoma imiennie wskazanymi modułami klienckimi
bez JSX** (§0.2 ramka Z17). Nie dodajesz kluczy i18n. Nie robisz zrzutów.
Nie uruchamiasz `dev-render`.

Twoim produktem są **endpointy, read-modele, migracje addytywne, testy
behawioralne i typowane kontrakty klienckie** — czyli to, o co UI będzie
mogło poprosić w kolejnym dyżurze. Jeżeli w trakcie pracy pomyślisz „a
dołożę jeszcze mały kafelek, żeby było widać, że działa" — **to jest
naruszenie i odrzucenie dyżuru.** Widać ma być **z testu**, nie z ekranu.

Powód: CLAUDE.md reguła 7 (właściciel nigdy nie jest pierwszym testerem
wizualnym) plus `DEC-2026-08-25-72`, która zablokowała flip flagi
`execReportsIntelligence` do czasu odbioru wizualnego. Backend, który
dołoży sobie kawałek ekranu, wchodzi pod ten zakaz i nie da się go odebrać.

### 2. **Zamrożenie chmury (`DEC-2026-08-25-65`) obowiązuje w całości.**

Trwa FREEZE. Do komunikatu „FREEZE ZAKOŃCZONY":

- **zero** deployów, zero Railway, zero zmian env/domen,
- **zero** zdalnych migracji, seedów i resetów,
- **zero** zapisów do wspólnej bazy demo,
- **zero** merge/force-push na `demo`/`develop`/`main`/`Londyn`,
- migracje oddajesz jako **`MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`**,
  z **jawnym testem kompatybilności wstecz** z zamrożonym demo.

**Baza jest WSPÓLNA** (demo i staging piszą do tej samej bazy kanonicznej,
staging tylko w osobnych organizacjach testowych). To jest powód, dla którego
w tym dyżurze **każda** migracja musi być addytywna i **każdy** nowy odczyt
musi działać na wierszach, które w bazie już są — łącznie z wierszami
sprzed migracji (kolumna `NULL` = uczciwe `UNKNOWN`, nigdy `0`).

### 3. **Zakaz atrap jest tu ostrzejszy niż zwykle.**

Cały ten dyżur istnieje dlatego, że dnia 8 i 11 Codex **uczciwie** napisał
`BRAK_API` zamiast zbudować atrapę. To była dobra robota i dlatego dostajesz
tę pracę. Zasada się nie zmienia, tylko przesuwa o poziom niżej:

- endpoint, który zwraca wyliczoną wartość, gdy nie ma danych → **atrapa**,
- endpoint, który zwraca `0` zamiast `UNKNOWN` → **atrapa**,
- endpoint, który przepuszcza pusty zbiór źródeł jako „zwalidowany" →
  **atrapa** (i dokładnie taki defekt masz w §X.3 do naprawy),
- read-model, który liczy „pełną populację" z tabeli, która pełnej populacji
  nie zawiera → **atrapa**.

Brak danych = pole `null` + jawny powód (`UNKNOWN` / `NOT_VERIFIED` /
`INSUFFICIENT_DATA` / `BRAK_API_HISTORY`) w kontrakcie odpowiedzi.

### 4. **Progi i wagi `E-O4` / `E-O5` — NIE ZASZYWASZ. Parametryzujesz.**

`DEC-2026-08-25-72` skierowała do Piotra trzy rzeczy: `E-O3` (taksonomia
BSC), `E-O4` (wagi impact) i progi saturacji z `E-O5`. **Piotr jeszcze nie
odpowiedział.**

To znaczy:

- **nie wybierasz** progu at-risk, wagi wpływu, progu saturacji, długości
  bufora, taksonomii severity ani wartości SLA reakcji;
- **budujesz mechanikę, która te wartości PRZYJMUJE** — jako jawny,
  wymagany parametr wejściowy read-modelu (query/body), z tabelą polityk
  w bazie jako miejscem docelowym;
- gdy parametru brak → odpowiedź zawiera `DECISION_REQUIRED` i pole wynikowe
  jest `null`. **Nigdy** wartość domyślna „na oko".

Wartość domyślna zaszyta w kodzie = odrzucenie pozycji, nawet jeśli reszta
jest idealna.

### 5. **Odbiór = nadzorca, po dyżurze.**

Twoja rola kończy się na „gotowe do przeglądu kodu i uruchomienia testów
przez nadzorcę". **Nigdy** nie piszesz „gotowe do pokazania właścicielowi"
ani „gotowe do włączenia flagi".

Naruszenie któregokolwiek z pięciu punktów = odrzucenie dyżuru, niezależnie
od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**
   w repozytorium **`Consultify-final-mvp-integration-20260823`**.

   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: f0caf6a821**

   ```bash
   cd /Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor f0caf6a821 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   **`git fetch` jest w tym dyżurze ZAKAZANY** (FREEZE, `DEC-65` — zero
   operacji sieciowych na origin). Pracujesz na stanie lokalnym.

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, nie startuj z `main`,
   nie startuj z `Londyn`, nie startuj z `codex/wave3-*` ani z żadnej gałęzi
   `codex/preserve-*`. Załóż raport, wpisz pozycję STOP z wynikiem obu komend
   powyżej i zakończ dyżur. To jedyna dopuszczalna reakcja.

3. **★ Sprawdź warunki wstępne — to nie jest formalność, to jest bramka.**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 125
   grep -c "DEC-2026-08-25-62" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -c "DEC-2026-08-25-63" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -c "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -c "DEC-2026-08-25-72" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md    # oczekiwane 115
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md  # oczekiwane 308
   sed -n '258p' docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md
   ```

   Ostatnia komenda **musi** wypisać linię zaczynającą się od
   `**Report layout:** week/scope/trust bar; plan-delivery, blocked-work,
milestone, initiative-risk, dependency, capacity, decision-latency and
intervention-effectiveness KPIs; ...`. To jest **źródło ośmiu rodzin KPI**
   z pozycji §X.4. Jeśli linia 258 mówi co innego — **STOP**, bo pracujesz na
   innym stanie rejestru niż ten, dla którego pisano tę instrukcję.

   Brak któregokolwiek wyniku = **STOP**.

4. **★ Sprawdzenie, którego NIE POMIJASZ: prace dni 8 i 11 NIE SĄ w tipie.**

   ```bash
   for b in codex/results-day8-20260825 codex/results-day8-cont-20260825 \
            codex/execution-day11-20260825 codex/execution-day11-fixes-20260825; do
     printf "%-45s " "$b"
     git merge-base --is-ancestor "$b" codex/m03-admin-20260824 2>/dev/null \
       && echo ANCESTOR || echo NIE-SCALONE
   done
   ```

   **Oczekiwany wynik na dzień wystawienia instrukcji: cztery razy
   `NIE-SCALONE`.** To jest stan zamierzony, nie awaria — `DEC-72` dopuściła
   merge dnia 11 dopiero po wykonaniu poprawek F1–F12, a dzień 8 czeka
   na re-shot dowodu ciemnego motywu (`DEC-61`).

   **Konsekwencja dla Ciebie, twarda:**

   - Klient dnia 11 (`UnifiedExecutionReportGenerator.tsx`, katalog
     `src/components/Execution/reports-intelligence/**`) **nie istnieje
     w Twojej bazie**. Nie odtwarzasz go, nie cherry-pickujesz, nie
     zaglądasz do niego po to, żeby „dopasować kształt".
   - Klient dnia 8 (`createOkrSet`, agregat check-inów per KR) **też nie
     istnieje w Twojej bazie**.
   - Projektujesz kontrakt **od strony serwera i kontraktu modułu**, a nie
     pod istniejący komponent. Jeżeli w raportach dni 8/11 (cytowanych
     w §1.2) widzisz kształt pola — traktujesz go jako **wymaganie**, nie
     jako kod do skopiowania.
   - Jeżeli któraś gałąź pokazuje `ANCESTOR` — **to jest zmiana stanu
     świata**: odnotuj to w raporcie w sekcji „Korekty wobec instrukcji",
     sprawdź, czy Twoja pozycja nie dubluje czegoś, co już weszło, i dopiero
     wtedy działaj.

5. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/backend-day14-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/backend-day14-20260826`.)

6. Pracujesz we **własnym worktree**, nigdy w cudzym:

   ```bash
   git worktree add /private/tmp/consultify-backend-day14 codex/backend-day14-<data>
   cd /private/tmp/consultify-backend-day14
   ```

7. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Dlaczego                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź. Żadnego `git fetch`, `git pull`, `gh`, `curl` do origin                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | FREEZE (`DEC-65`); push wykonuje wyłącznie nadzorca sesji głównej                                                                                                                               |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `develop`, `main` ani `Londyn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `demo` = święta, zamrożona baza deployu (`DEC-65`)                                                                                                                                              |
| Z3      | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Krach 3/4 powstał dokładnie tak                                                                                                                                                                 |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików oznaczonych `PRESERVED_PRODUCT_WIP` / `NO_COPY` w `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md`                                                                                                                                                                                                                                                                                                                                                                                                         | Wymagania są **już** przełożone na rejestry i decyzje. Zajrzenie tam nie da Ci nic nowego, a może Cię skłonić do cofnięcia modułu                                                               |
| **Z5**  | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`, ani `grep -r`, ani `ls`**                                                                                                                                                                                                                                                                                                                                                                                                                         | Chroniony, brudny worktree właściciela                                                                                                                                                          |
| Z6      | **Nie dotykasz cudzych worktree**: `/private/tmp/consultify-day14-instrukcja` (worktree TEJ instrukcji), `/private/tmp/consultify-day{2,3,4,5,7,8,9,10,11,12,13}-*`, `/private/tmp/consultify-results-day8*`, `/private/tmp/consultify-execution-day11`, `/private/tmp/consultify-partner-day12`, `/private/tmp/consultify-interview-creator-day13`, `/private/tmp/consultify-meetings-day10*`, `/private/tmp/consultify-m0*`, `/private/tmp/consultify-admin55-*`, `/private/tmp/consultify-audits-*`, `/private/tmp/consultify-wave3-*`, `/private/tmp/consultify-notifications-n1` | Cudze worktree, część jest w użyciu przez równoległe dyżury                                                                                                                                     |
| Z7      | **Nie zajmujesz portów zajętych przez inne dyżury**: 3987 (sesja nadzorcza), 3350/3352/3356/3357 (harnessy dev-render), pasmo odbiorowe 4280–4481, oraz porty zastanych kontenerów: 32784, 34941, 35562, 35570, 35623. Twój **jedyny** port to **5442** — kontener PG dnia 14                                                                                                                                                                                                                                                                                                         | Kolizja psuje cudze runtime'y odbiorowe i cudze dowody                                                                                                                                          |
| **Z8**  | **Zero interakcji z Railway i z jakąkolwiek chmurą.** Brak `railway` CLI, brak zmiennych env zdalnych, brak redeployu, brak logów produkcyjnych, brak odczytu bazy demo/staging                                                                                                                                                                                                                                                                                                                                                                                                       | `DEC-2026-08-25-65`, FREEZE                                                                                                                                                                     |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem na porcie 5442.** Nigdy baza demo/staging/produkcyjna, nigdy cudzy zastany kontener (5432, 5433, 5435, 32784, 34941, 35562, 35570, 35623)                                                                                                                                                                                                                                                                                                                                                                                         | Reguła „dane demo = twarz produktu". Cudze kontenery są dowodem odbiorowym cudzego etapu                                                                                                        |
| **Z10** | **★★ ZERO UI.** Zero plików `.tsx`. Zero `src/components/**` poza dwoma modułami bez JSX z ramki Z17. Zero kluczy i18n. Zero zrzutów. Zero `dev-render`                                                                                                                                                                                                                                                                                                                                                                                                                               | ★ KRYTYCZNE OGRANICZENIE pkt 1                                                                                                                                                                  |
| **Z11** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** W szczególności **nie ruszasz** `execReportsIntelligence` (default OFF wszędzie, `DEC-63(1)`) ani flag w `src/components/ResultsVNext/resultsVNextFeatureFlags.ts`                                                                                                                                                                                                                                                                                                                                 | CLAUDE.md reguła 9; `DEC-72` zablokowała flip do czasu odbioru                                                                                                                                  |
| **Z12** | **Nie zaszywasz progów, wag ani taksonomii** z `E-O3`/`E-O4`/`E-O5` (waga impact, próg at-risk, próg saturacji, bufor, severity, SLA reakcji, mapowania BSC)                                                                                                                                                                                                                                                                                                                                                                                                                          | Czekają na decyzję Piotra (`DEC-72`). ★ KRYTYCZNE OGRANICZENIE pkt 4                                                                                                                            |
| Z13     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN nowy plik dokumentacyjny: `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md`. Jedyne inne dokumenty, które wolno Ci zmienić, to `modules/09_RESULTS/MODULE_ACCEPTANCE.md` i `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — **wyłącznie** w ramach pozycji `R.1`                                                                                                                                                                                                                       | Repo tonie w dokumentach-duchach                                                                                                                                                                |
| Z14     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani w raporcie                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                                                                                                      |
| **Z15** | **Nie budujesz generowania treści modelem.** Zero podpięcia dostawcy AI, zero promptów, zero „Analiza AI". `E-O7` w części AI **czeka na klucz dostawcy** (`DEC-2026-08-25-59`)                                                                                                                                                                                                                                                                                                                                                                                                       | Silnik AI = osobny blok programu; budowa bez klucza = atrapa `[TRYB MOCK]`, jawnie odrzucona                                                                                                    |
| **Z16** | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `UNKNOWN`, `NOT_VERIFIED` ani odmów.** W szczególności: `reportRun.ts` odmawia publikacji przy niezgodnym hashu (`:237`), `kpi.routes.ts` liczy `performanceStatus` po stronie serwera zamiast ufać klientowi (nagłówek pliku, `:44-56`), `resultsInternalBetaVisibility.middleware.ts` fail-closed przy błędzie bazy                                                                                                                                                                                                      | Uczciwy pusty stan > udawany wynik. Osłabienie któregokolwiek = odrzucenie dyżuru                                                                                                               |
| **Z17** | **★ Zakaz wszystkiego poza ramką „WOLNO" poniżej.** Nie dotykasz modułów: Organization, Settings, Admin, Superadmin, Chat, Interview, Assessment, Tools, Initiatives (poza runtime raportów), Meetings, Materials, Audits, Partner, My Work, Finance                                                                                                                                                                                                                                                                                                                                  | Program konsolidacji jest „jeden obszar na raz"                                                                                                                                                 |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                                                                                                               | **Lekcja z odbioru dnia 2:** Codex po cichu zmienił globalny mock w `tests/setup.ts` i wywalił **27 testów w cudzych modułach** — w modułach, których nie dotykał i których nigdy nie uruchomił |

**Zasięg Z18 — konkretnie, bo to jest zakaz, który najłatwiej złamać
„w dobrej wierze".**

```
tests/setup.ts                     ← plik, na którym poległ dyżur nr 2
tests/helpers/**                   (w tym unifiedMockSetup.js)
tests/__mocks__/**                 (llmApi, server/database, node-cron, @google/generative-ai, aws-sdk-client-s3)
vitest.config.ts
vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**Co robisz, gdy potrzebujesz innego zachowania mocka.** Dokładnie jedno
z dwóch, zawsze **opt-in, nigdy globalnie**:

1. **`vi.mock` lokalnie w Twoim pliku testowym** — mock żyje i umiera razem
   z tym jednym plikiem;
2. **dedykowany helper w NOWYM pliku**, importowany jawnie tylko przez Twoje
   testy (np. `server/src/routes/resultsVnext/__tests__/day14Harness.ts`).
   Nowy plik, nie dopisek do istniejącego helpera współdzielonego.

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka", „to jest
addytywne, nic nie zepsuje", „inaczej mój test nie przejdzie". Jeśli Twój test
nie przechodzi bez zmiany globalnego mocka — to jest **STOP**.

**Zasięg Z17 — granica jest ostra i przebiega tak:**

```
WOLNO (Twój zakres):

  ── Results vNext (serwer) ──────────────────────────────────────────
  server/src/routes/resultsVnext/**                       (istniejące pliki + NOWE)
  server/src/services/resultsVnext/**                     (istniejące pliki + NOWE, + __tests__ obok)
  server/src/validators/resultsVnextKpi.validators.ts
  server/src/validators/resultsVnextOkr.validators.ts     (jeśli istnieje; inaczej wg wzorca KPI)
  server/src/validators/resultsVnextSearch.validators.ts  (NOWY, §S)

  ── Execution / raporty (serwer) ────────────────────────────────────
  server/src/domain/initiatives-execution/reportRun.ts
  server/src/domain/initiatives-execution/reportSources.ts     (NOWY, §X.3)
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts  (WYŁĄCZNIE dodanie tras §X.1/§X.3/§X.4)
  server/src/routes/managementReports.routes.ts                (WYŁĄCZNIE gałąź eksportu XLSX — §X.2)
  server/src/services/managementReportsService.ts              (WYŁĄCZNIE XLSX + izolacja tenanta §X.2)
  server/src/repositories/managementReportRepository.ts        (WYŁĄCZNIE org-scoped odczyt §X.2)
  server/src/services/executionControl/**                      (NOWE pliki read-modelu §X.4)

  ── montaż ──────────────────────────────────────────────────────────
  server/src/Gateway.ts                     (WYŁĄCZNIE import + app.use nowych routerów; kolejność patrz §2.4)

  ── migracje ────────────────────────────────────────────────────────
  server/migrations/20260901_day14_*.sql    (NOWE pliki, nazwa wg §0.3)

  ── kontrakty klienckie (BEZ JSX — sprawdź grepem przed zapisem) ─────
  src/components/ResultsVNext/kpiApi.ts          (plik czysto TS, zero JSX — dopisujesz funkcje)
  src/components/ResultsVNext/okr/okrApi.ts      (plik czysto TS, zero JSX — dopisujesz funkcje)
  src/services/initiatives-execution/runtimeApi.ts (plik czysto TS, zero JSX — dopisujesz funkcje)

  ── testy ───────────────────────────────────────────────────────────
  server/src/**/__tests__/**                (NOWE pliki obok kodu)
  tests/resultsVnext/day14/**               (NOWE; wymaga `git add -f`)
  tests/integration/day14-*.realdb.test.ts  (NOWE; wymaga `git add -f`)

  ── rejestr i raport ────────────────────────────────────────────────
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md    (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md  (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md (jedyny nowy dokument)

NIE WOLNO:
  KAŻDY plik `.tsx` w całym repo                        ← Z10, bez wyjątku
  src/components/** (poza trzema modułami TS wyżej)     ← Z10
  public/locales/**                                     ← Z10, zero i18n
  src/components/ResultsVNext/resultsVNextFeatureFlags.ts  ← Z11
  src/config/featureFlags*  ·  src/utils/betaAccess.ts  ·  src/utils/pilotAccess.ts   ← Z11
  server/src/middleware/**                              ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  server/src/services/effectiveAccessService.ts  ·  frameworkEntitlementService.ts     ← model uprawnień, tylko odczyt
  server/src/services/resultsVnext/platform/atomicWrite.ts   ← WOLNO WOŁAĆ; zmiana = STOP
  server/src/services/resultsVnext/platform/visibilityScopedQuery.ts  ← WOLNO WOŁAĆ; zmiana = STOP
  server/migrations/* (wszystkie ISTNIEJĄCE)            ← TYLKO ODCZYT
  server/scripts/migrate.postgres.ts                    ← TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                  ← cudzy tor odbiorowy
  scripts/check-*.sh  ·  scripts/check-list-canon.baseline.txt   ← bezpieczniki, nie ruszasz
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej
linii importu".

**Bramka przed dotknięciem kontraktu klienckiego** (wykonaj i wklej wynik do
raportu — jeśli którykolwiek plik ma JSX poza komentarzem, **STOP**):

```bash
grep -nE '</[A-Za-z]|<[A-Z][A-Za-z]*[ />]' \
  src/components/ResultsVNext/kpiApi.ts \
  src/components/ResultsVNext/okr/okrApi.ts \
  src/services/initiatives-execution/runtimeApi.ts
```

Trafienia typu `Array<Foo>`, `Promise<T>`, `Record<string, X>` to **generyki
TypeScriptu, nie JSX** — te są w porządku. Trafienie w postaci realnego
elementu (`<div`, `<Foo prop=`, `</Foo>`) = STOP i wpis do raportu.

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Nie zbiorcze
  „add backend endpoints".
- **Conventional commits**, wzór:
  ```
  feat(results-search): tenant-scoped cross-registry search read model (S.1)
  feat(results-kpi): server-side trend read model over measurement series (K.1)
  feat(results-okr): set-scoped attention and set-level check-in aggregate (O.1, O.2)
  feat(execution): as-of historical source reconstruction for report runs (X.1)
  feat(execution): XLSX export branch on the governed export pipeline (X.2)
  fix(execution): reject empty source sets on report-run validation (X.3)
  feat(execution): control-loop KPI families read model (X.4)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem.**
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest`
  repo.** Punktowo, np.:
  ```bash
  npx vitest run server/src/routes/resultsVnext/__tests__
  npx vitest run server/src/services/resultsVnext/kpi/__tests__
  npx vitest run tests/resultsVnext/day14
  ```
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json          # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild server/src/routes/resultsVnext/search.routes.ts --loader:.ts=ts --outfile=/dev/null   # OK
  ```
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok
  kodu w `server/src/` dodają się normalnie.
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodź ich przez
  `--no-verify`. Jeśli hook blokuje — popraw kod, nie hook.
  `scripts/check-list-canon.sh --update` jest w tym dyżurze **ZAKAZANE**;
  baseline `scripts/check-list-canon.baseline.txt` **nie zmienia się** i jest
  jednym z dowodów Bloku 6. (Przy dyżurze backendowym kanon list i tak nie
  powinien się ruszyć — jeżeli się ruszy, znaczy, że złamałeś Z10.)
- **Dane demo = twarz produktu.** Każdy probe sprząta po sobie. Zero rekordów
  testowych zostawionych w jakiejkolwiek bazie.

#### ★ MIGRACJE — reguły twarde, bez wyjątków

1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
   `INSERT ... ON CONFLICT DO NOTHING`, `CREATE OR REPLACE FUNCTION`.
   **Zakaz** `DROP`, `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`,
   bezwarunkowego `UPDATE`.

2. **Nazewnictwo bez kolizji.** Najnowsza migracja w bazie to
   `20260831_rvn_okr_not_calculable_reason.sql`. Twoje pliki nazywasz
   **`20260901_day14_<temat>.sql`**. Sprawdź przed zapisem:

   ```bash
   ls server/migrations | grep -E '^202609' # oczekiwane: PUSTO przed Twoją pracą
   ```

   Porządek stosowania **nie jest** zwykłym sortem nazw: `migrate.postgres.ts`
   klasyfikuje pliki na fazy (`sortMigrationsDeterministically`, opis
   `server/scripts/migrate.postgres.ts:200-244`) — faza 1 „DATED" sortuje po
   dacie kalendarzowej, więc `20260901_*` wykona się po `20260831_*`.
   **Nie dopisujesz się do `LATE_PHASE_MANIFEST`** — to jest zmiana
   `migrate.postgres.ts`, czyli plik tylko do odczytu (Z17).

3. **Zero kluczy obcych do tabel, które sortują się później.** Tenant
   i istnienie rodzica sprawdzasz w warstwie aplikacji. Dopuszczalne FK:
   wyłącznie do tabel `rvn_platform_*` i `rvn_kpi_*`/`okr_vnext_*`, które
   powstały wcześniej (data prefiksu mniejsza) — i tylko wtedy, gdy to
   jawnie wykażesz w nagłówku migracji.

4. **★ KOMPATYBILNOŚĆ WSTECZ Z ZAMROŻONYM DEMO — warunek `DEC-65`.**
   Baza jest wspólna. Twoja migracja musi spełniać jednocześnie:
   - kod **zamrożonego demo** (bez Twoich zmian) działa na bazie **po**
     migracji — czyli żadna nowa kolumna nie jest `NOT NULL` bez `DEFAULT`,
     żaden nowy trigger nie odrzuca zapisu, który dziś przechodzi;
   - Twój kod działa na bazie **przed** backfillem — czyli każdy odczyt
     nowej kolumny traktuje `NULL` jako `UNKNOWN`, nigdy jako `0`.

   **Dowód wymagany w raporcie** (tabela `KOMPATYBILNOŚĆ_WSTECZ`): dla każdej
   nowej kolumny/tabeli wpis „co robi stary kod, gdy to zobaczy" + „co robi
   nowy kod, gdy tego nie ma".

5. **★ MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED.**
   Migracji **nie uruchamiasz nigdzie poza własnym kontenerem**. W raporcie
   każda migracja dostaje wpis:

   ```
   MIGRATION_PREPARED: server/migrations/20260901_day14_<temat>.sql
   REMOTE_EXECUTION_NOT_AUTHORIZED (DEC-2026-08-25-65)
   Dowód lokalny: IDEMPOTENCJA_PEŁNA | IDEMPOTENCJA_CELOWANA
   ```

6. **★ DOWÓD IDEMPOTENCJI NA ŚWIEŻEJ BAZIE — warunek oddania pozycji
   z migracją.** Trzy przebiegi, wyniki wklejone do raportu:

   ```bash
   # kontener jednorazowy, dane w pamięci, port 5442 (Z7)
   docker run -d --name cx-day14-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=3g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day14 \
     -p 127.0.0.1:5442:5432 pgvector/pgvector:pg16

   export DATABASE_URL="postgres://postgres:cx@127.0.0.1:5442/cx_day14"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (1) świeży przebieg
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (2) powtórka → "Applying migrations: 0"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry      # (3) dry-run → "Pending migrations: 0"
   ```

   **Sprzątanie jest obowiązkowe, z wolumenami, i jest częścią dowodu:**

   ```bash
   docker rm -f cx-day14-pg
   docker volume ls -q | grep -i cx-day14 | xargs -r docker volume rm
   docker ps -a  --filter name=cx-day14 --format '{{.Names}}'    # oczekiwany wynik: PUSTY
   docker volume ls -q | grep -i cx-day14                        # oczekiwany wynik: PUSTY
   ```

   **Nie usuwasz cudzych kontenerów ani cudzych dangling volumes.** Raport
   dnia 11 odnotował 14 zastanych dangling volumes — zostawiasz je.

   Jeżeli przebieg (1) zatrzyma się na **cudzej, niezwiązanej** migracji
   (znany, udokumentowany stan repo): **to nie jest Twój defekt** — wklejasz
   do raportu nazwę pliku, na którym replay stanął, i wykonujesz dowód
   (1)(2)(3) **celowany na Twoje migracje**, przez ręczne `psql -f`
   w tej samej kolejności. Oznaczasz to jako `IDEMPOTENCJA_CELOWANA`,
   nie jako `IDEMPOTENCJA_PEŁNA`.

7. **Zero migracji danych, które zmieniają znaczenie istniejących wierszy.**
   Backfill legacy → nowa tabela dozwolony **tylko** jako
   `INSERT ... ON CONFLICT DO NOTHING` z kluczem deduplikacji.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane.** Read-model czyta z realnych tabel. Zero zaszytych tablic,
   zero `sampleData`, zero „przykładowej" odpowiedzi w handlerze. Pusty wynik
   z bazy = uczciwie pusta odpowiedź, nie wymyślone wiersze.
2. **Uczciwość wartości — kontrakt trójstanowy.** Każde pole liczbowe
   w odpowiedzi ma jawnie rozróżnione trzy przypadki:
   `wartość` · `null + reason: 'UNKNOWN' | 'INSUFFICIENT_DATA' | 'NOT_VERIFIED' | 'DECISION_REQUIRED' | 'BRAK_API_HISTORY'` · `0` **jako prawdziwe zero**.
   **`0` nigdy nie zastępuje braku danych.** To jest ta sama reguła, którą
   dzień 8 udowodnił testem `resultsHonestValues` i dzień 11 poprawił po
   inspekcji („zerowe KPI oznaczone RED/AMBER").
3. **★ Tenant-izolacja z tokenu, nie z żądania.** `organizationId` bierzesz
   **wyłącznie** z `req.user` (ustawionego przez `verifyToken`). **Nigdy**
   z `req.body`, `req.query`, `req.params` ani z nagłówka. Każdy nowy
   endpoint przechodzi test: obcy `organizationId` dostaje **404 albo 403,
   nigdy 200 z cudzymi danymi i nigdy 200 z pustą listą jako „sukces"**.
   Wzorzec: `server/src/routes/resultsVnext/kpi.routes.ts:143-156` (łańcuch
   middleware) + `requireAuth` `:166-176` + `buildVisibilityScopedCte`.
4. **Minimum 4 testy zachowania** przechodzą: happy path · ścieżka błędu
   (4xx/5xx) · pusty stan · **negatyw tenanta**.
5. **★ Co najmniej jeden test `realdb`** per pozycja dotykająca bazy —
   przeciw realnemu Postgresowi z §0.3 pkt 6, wg wzorca
   `tests/resultsVnext/okr/okrAttentionQueue.realdb.test.ts:20-45`
   (silny skip bez `DATABASE_URL`, `beforeAll` rzuca przy
   skonfigurowanej-ale-nieosiągalnej bazie, unikalny tag org/user per
   przebieg, `afterAll` kasuje **wyłącznie własne** wiersze).
6. **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
   i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**.
   Każda pozycja musi mieć co najmniej jeden test, który **wywołuje realny
   handler / realną funkcję read-modelu i sprawdza WYNIK**. Grep-test wolno
   dołożyć jako dodatek, nigdy jako dowód.
7. **Zero UI.** `git diff --name-only codex/m03-admin-20260824...HEAD`
   nie zawiera **żadnego** `.tsx` ani `public/locales/*`.
8. **Migracja (jeśli jest) spełnia §0.3 pkt 1–7**, ma dowód idempotencji
   i wpis `KOMPATYBILNOŚĆ_WSTECZ`.
9. **Plik przepuszczony przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych. Równolegle 27 testów w cudzych modułach było
czerwonych — przez zmianę w pliku współdzielonym.
**Lekcja z odbioru dnia 12 (`DEC-73`):** 19 czerwonych testów **wprowadzonych
przez dyżur** zaraportowano jako „zastane". Tego błędu nie powtarzasz.

**Przed oddaniem raportu wykonujesz pomiar zasięgu:**

1. Wypisz **wszystkie** pliki, które dotknąłeś:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Z tej listy wyodrębnij pliki **współdzielone**. W tym dyżurze
   z definicji są to:
   ```
   server/src/Gateway.ts                                    ← montuje CAŁY serwer
   server/src/domain/initiatives-execution/reportRun.ts     ← runtime raportów Execution
   server/src/services/managementReportsService.ts          ← drugi pipeline raportowy
   server/src/repositories/managementReportRepository.ts
   src/services/initiatives-execution/runtimeApi.ts          ← klient runtime, wielu konsumentów
   src/components/ResultsVNext/kpiApi.ts  ·  okr/okrApi.ts   ← klienci Results
   ```
   Sprawdzasz konsumentów **jawnie, nie z pamięci**:
   ```bash
   grep -rln "initiatives-execution/runtimeApi" src/ | wc -l
   grep -rln "reportRun" server/src/ tests/ | head -20
   grep -rln "managementReportsService\|managementReportRepository" server/src/ tests/ | head -20
   grep -rln "ResultsVNext/kpiApi\|okr/okrApi" src/ | head -20
   ```
3. **★ POMIAR STANU WEJŚCIOWEGO — obowiązkowy, PRZED pierwszą zmianą.**
   Uruchom katalogi konsumentów **na czystym tipie** i **zapisz wyniki**:
   ```bash
   npx vitest run server/src/routes/resultsVnext/__tests__            > /tmp/day14-before-1.txt 2>&1
   npx vitest run server/src/services/resultsVnext                    > /tmp/day14-before-2.txt 2>&1
   npx vitest run tests/unit/execution                                > /tmp/day14-before-3.txt 2>&1
   npx vitest run tests/unit/initiatives-execution                    > /tmp/day14-before-4.txt 2>&1
   npx vitest run server/src/domain/initiatives-execution/__tests__   > /tmp/day14-before-5.txt 2>&1
   ```
   Raport dnia 11 odnotował **zastane** czerwone: `tests/unit/execution`
   → 242 PASS / 4 FAIL w `benefitsRegisterService.test.ts`
   (`Unhandled dbRun SQL: INSERT INTO initiative_benefits (...)`), oraz
   niezgodność w `tests/unit/initiatives-execution`. **Potwierdź te liczby
   u siebie na wejściu** i wpisz je do raportu jako `STAN_WEJŚCIOWY`.
4. **Po pracy uruchom te same katalogi ponownie** i podaj **deltę**, nie
   liczby bezwzględne:
   ```
   | Katalog | PRZED | PO | Delta | Werdykt |
   ```
   Każdy nowy FAIL = **STOP**, nie „zastane". Jeżeli nie umiesz udowodnić,
   że FAIL był przed Twoją zmianą — traktujesz go jako wprowadzony przez
   siebie.
5. **W raporcie deklarujesz zasięg jawnie**:
   - `ZASIĘG PEŁNY` — uruchomiłeś testy wszystkich katalogów konsumentów
     plików współdzielonych, które dotknąłeś, i podajesz PRZED/PO;
   - `ZASIĘG CZĘŚCIOWY` — **wtedy piszesz to wprost i wymieniasz, czego nie
     uruchomiłeś i dlaczego.**

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy
improwizacja.**

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- musiałbyś **zaszyć próg, wagę, taksonomię albo SLA** z `E-O3`/`E-O4`/`E-O5`
  (Z12) — parametryzujesz albo STOP, nigdy wartość „rozsądna domyślna";
- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej** —
  z jednym jawnym wyjątkiem opisanym w §T.1 i tylko na jego warunkach;
- musiałbyś **zmienić kontrakt `atomicWrite.ts`, `visibilityScopedQuery.ts`
  albo `effectiveAccessService.ts`**. Wolno je **wołać**; zmiana = STOP;
- musiałbyś dodać migrację **nieaddytywną**, albo taką, która łamie
  kompatybilność wstecz z zamrożonym demo (§0.3 pkt 4);
- musiałbyś **stworzyć flagę funkcyjną albo zmienić wartość istniejącej**
  (Z11);
- musiałbyś **dotknąć pliku `.tsx`**, katalogu `public/locales` albo
  jakiegokolwiek komponentu (Z10) — to nie jest „mała rzecz", to jest STOP;
- musiałbyś **zgadnąć kształt danych, których w bazie nie ma.** Wtedy
  endpoint **nie powstaje**; wpis `BRAK_ŹRÓDŁA` z pełną tabelą (co jest
  potrzebne, gdzie tego nie ma, co trzeba by dobudować) jest **wynikiem
  pełnowartościowym**;
- musiałbyś **podpiąć dostawcę AI** albo zbudować generowanie treści
  modelem (Z15);
- musiałbyś dotknąć czegokolwiek spoza ramki „WOLNO" (Z17);
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka lub
  configu vitest (Z18)** — to jest STOP zawsze, bez wyjątku i bez
  „addytywnie, więc nic nie zepsuje";
- **pomiar zasięgu (§0.4a) pokazał czerwone testy, których nie było na
  wejściu** — nie „naprawiasz" ich po cichu i nie nazywasz „zastanymi":
  opisujesz, który commit je zapalił;
- musiałbyś wykonać **jakąkolwiek operację w chmurze** (Z8, `DEC-65`);
- **napotkałeś zmianę, którą robi równolegle inny dyżur** (§1.4) — nie
  dublujesz jej, tylko odnotowujesz.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Czego brakuje, żeby ruszyć: <konkretna decyzja lub konkretne dane>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

W dniach 8 i 11 dwa dyżury robiły powierzchnie klienckie: **Results** (karty
KPI/OKR/ROI, `RESULTS_DAY8_REPORT_20260825.md`) i **Execution** (cztery
raporty zarządcze + generator, `EXECUTION_DAY11_REPORT_20260825.md`).

Obie instrukcje miały twardy zakaz zmian po stronie serwera. Obaj wykonawcy
ten zakaz uszanowali — i w efekcie **oba raporty kończą się listą pozycji
oznaczonych `BRAK_API`**: rzeczy, których nie dało się zbudować, bo backend
ich nie ma. Nadzorca zweryfikował te wpisy grepem i uznał je za **prawdziwe,
nie za wymówkę** (`DEC-61`: „STOP-y R.4/R.6/R.7 PRAWDZIWE (grep potwierdził,
zero atrap)"; `DEC-72`: „szkielet uczciwy (7 STOP-ów zasadnych, zero
zaszytych wag)").

**Ten dyżur zamyka te luki od strony serwera.** Nie dopisuje ekranów.
Nie ocenia pracy dni 8 i 11. Buduje mechanikę, po którą kolejny dyżur
frontowy będzie mógł sięgnąć.

Nowa zasada podziału, która zaczyna obowiązywać tym dyżurem:

> **Codex = mechanika tylna.** Endpointy, read-modele, migracje, testy.
> Powierzchnie wizualne powstają osobno, po prototypie i po akcepcie
> właściciela na zrzutach (CLAUDE.md reguła 7).

### 1.2. Dokumenty wiążące merytorycznie

**Uwaga: dwa z nich leżą na gałęziach nieścalonych do Twojego tipa.**
Odczytujesz je przez `git show`, **nie** przełączając gałęzi i **nie**
mergując:

```bash
# Raport dnia 8 (Results) — źródło pozycji §S, §K, §O
git show codex/results-day8-cont-20260825:docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY8_REPORT_20260825.md | less

# Raport dnia 11 (Execution) — źródło pozycji §X
git show codex/execution-day11-20260825:docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT_20260825.md | less
```

Jeśli którakolwiek komenda zawiedzie (gałąź nie istnieje) — **STOP**,
bo pracujesz bez wymagań.

Dokumenty dostępne wprost w Twoim worktree:

| Dokument                                                                                   | Po co Ci jest                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` (115 l.)   | rejestr odbiorowy Results, uwagi `RES-OWN-001..008`                                                                                             |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.) | kontrakty `EXE-WORK-REPORT-01`, `EXE-RESOURCES-REPORT-01`, `EXE-CONTROL-REPORT-01`, `EXE-REPORT-GENERATOR-01`; **linia 258 = osiem rodzin KPI** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (125 l.)       | decyzje `DEC-62`, `DEC-63`, `DEC-65`, `DEC-72`                                                                                                  |
| `CLAUDE.md`                                                                                | reguły 7, 9 i złote reguły                                                                                                                      |

### 1.3. Decyzje wiążące — cztery

| Decyzja                                                | Co z niej wynika DLA CIEBIE                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`DEC-2026-08-25-62`** (Results, licencje nadzorcy)   | (c) `R.6-O1`: link do wspólnej `/attention` **bez filtrowania klienckiego** — „Set-scoped filtr = **przyszły backend**". **To jest Twoja pozycja §O.1.** (d) `R.6-O2` agregat check-inów: klient dostał licencję na read-only agregację per-KR — Ty budujesz **agregat po stronie serwera**, żeby nie było dwóch prawd (§O.2). Ostatnie zdanie: „**Search Results (R.4) = przyszły dyżur backendowy**" — **to jest Twoja pozycja §S.** |
| **`DEC-2026-08-25-63`** (Execution, licencje nadzorcy) | (1) Flaga `execReportsIntelligence` — **istnieje, default OFF wszędzie, NIE RUSZASZ jej** (Z11). (2) **Kanoniczny backend generatora**: `runtime-v1 report-runs` = **SSOT niezmiennej publikacji** (event-sourced cykl życia); `management-reports` = **pipeline eksportowy**. „**rozszerzenia backendu tylko jeśli instrukcja je przewidziała**" — ta instrukcja je przewiduje, imiennie, w §X.1–§X.4 i nigdzie indziej.              |
| **`DEC-2026-08-25-65`** (staging/demo/production)      | FREEZE: zero chmury, zero zdalnych migracji, `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`, **wspólna baza** → kompatybilność wstecz obowiązkowa. Kolizje → `COORDINATION_REQUIRED`, nie samodzielne rozwiązywanie.                                                                                                                                                                                                         |
| **`DEC-2026-08-25-72`** (odbiór dnia 11)               | Do Piotra poszły **tylko trzy rzeczy**: `E-O3` (taksonomia BSC), `E-O4` (wagi impact), progi saturacji z `E-O5`. **Piotr nie odpowiedział.** Wszystko, co od nich zależy, **parametryzujesz** (Z12). Decyzja pochwaliła „zero zaszytych wag" jako dobrą robotę — nie psuj tego.                                                                                                                                                        |

### 1.4. ★ KOORDYNACJA — czego NIE dublujesz

| Strumień                                                                 | Co robi                                                                         | Twoja reakcja                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poprawki `F1-F12` dnia 11 (gałąź `codex/execution-day11-fixes-20260825`) | naprawiają **klienta** (uczciwy severity, per-record completeness, KPI scoping) | Nie dotykasz. To `.tsx` — Z10. Jeżeli Twój read-model dostarcza dane, które te poprawki liczą po stronie klienta, **odnotuj to w raporcie** jako „kandydat do przeniesienia na serwer w kolejnym dyżurze" — i **nie przenoś** tego teraz |
| Re-shot dowodów dnia 8 (`DEC-61`)                                        | zrzuty, motyw ciemny                                                            | Nie dotyczy Cię (Z10)                                                                                                                                                                                                                    |
| Odbiór Partnera (`DEC-73`)                                               | czerwone testy, backfill connection                                             | Nie dotykasz. Jeśli Twój pomiar zasięgu wejdzie w `tests/unit/partner*` — nie uruchamiasz i odnotowujesz                                                                                                                                 |
| Rekonstrukcja korpusu uwag My Work (`DEC-71`)                            | prawe panele                                                                    | Nie dotyczy Cię                                                                                                                                                                                                                          |

Jeżeli wykryjesz, że któraś z Twoich pozycji już powstała na innej gałęzi —
**`COORDINATION_REQUIRED`** w raporcie, nie merge, nie cherry-pick, nie
„zrobię swoją wersję obok".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`sources: []` waliduje się „na pusto" — to jest realny defekt, nie
   Twoja pomyłka.** `reportRun.ts:186-193` sprawdza źródła przez
   `r.sources.some(...)`. Na **pustej tablicy** każdy `.some()` zwraca
   `false`, więc `findings` zostaje puste i run przechodzi `DRAFT →
VALIDATED` **bez ani jednego źródła**. Dzień 11 przekazywał dokładnie
   `sources: []`. To jest przedmiot pozycji §X.3 — i jest to jedyne miejsce
   w tym dyżurze, gdzie **zaostrzasz** istniejące zachowanie (patrz §X.3
   pkt 4 — reguła zgodności wstecz).

2. **Dwa pipeline'y raportowe, jeden SSOT.** `runtime-v1 report-runs`
   (`server/src/domain/initiatives-execution/reportRun.ts`, trasy
   `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4654-4772`)
   i `management-reports` (`server/src/routes/managementReports.routes.ts`,
   460 l., serwis `server/src/services/managementReportsService.ts`).
   `DEC-63(2)` rozstrzygnęła: **runtime-v1 = SSOT publikacji,
   management-reports = pipeline eksportowy.** Nie odwracasz tego, nie
   scalasz tabel, nie migrujesz danych między nimi.

3. **`management-reports` ma dziurę tenantową i atrapę eksportu — obie
   udokumentuj.**
   - `managementReportsService.ts:891` `getReport(reportId)` woła
     `managementReportRepository.getReportById(reportId)`
     (`server/src/repositories/managementReportRepository.ts:46-58`), które
     robi `SELECT * FROM management_reports WHERE id = ?` — **bez
     `organization_id`**. `generateExport` (`:1121`) na tym stoi.
   - `bulkExport` (`:1173-1180`) **nie tworzy żadnego pliku** — zwraca
     ścieżkę do zipa, który nigdy nie powstaje.

   Pierwsze **naprawiasz** w zakresie §X.2 (to jest bezpośrednio Twój
   endpoint). Drugie **tylko odnotowujesz** w tabeli „Znaleziska — nie
   naprawiane": naprawa `bulkExport` to osobny zakres i nie ma dla niej
   testu odbiorowego w tym dyżurze.

4. **Schemat pod „następny obowiązek" JUŻ ISTNIEJE.** Nie buduj go od nowa:
   - `server/migrations/20260811_rvn_platform_obligations.sql` — tabela
     `rvn_platform_obligations` (`obligation_type`, `due_at`, `status`,
     `reference_type`/`reference_id`, `deduplication_key`);
   - `server/migrations/20260813_rvn_kpi_measurement_cadence.sql` — kolumna
     `rvn_kpi_definition_versions.measurement_frequency_days`.

   Dzień 8 napisał „następny obowiązek = `BRAK_API`" i miał rację **na
   poziomie endpointu**: nie ma trasy, która to zwraca dla pojedynczego KPI.
   Read-model `listMyKpis` w `kpiPerspectivesRepository.ts` czyta te dane dla
   listy „Moje KPI", ale karta pojedynczego KPI nie ma skąd tego wziąć.
   **To jest pozycja §K.3 — read-model nad istniejącym schematem, bez nowej
   tabeli.** Jeżeli po sprawdzeniu okaże się, że nowa kolumna jest jednak
   potrzebna — najpierw uzasadnij w raporcie, dlaczego istniejące nie
   wystarczają.

5. **Historia OKR ma gotowy wzorzec, KPI nie ma.**
   `GET /api/vnext/results/okr/sets/:setId/history`
   (`server/src/routes/resultsVnext/okr.routes.ts:2744-2766`, repozytorium
   `server/src/services/resultsVnext/okr/okrSetHistoryRepository.ts:106`)
   jest **wzorcem strukturalnym** dla §K.2 (kursor + limit + `entries` +
   `nextCursor`). Kopiujesz kształt, nie treść.

6. **`rvn_platform_management_chain_closure` nie jest zasilany.**
   `okrAttentionRepository.ts` (nagłówek, akapit „ACKNOWLEDGED, UNFIXED
   GAP") mówi wprost: nie istnieje `getManagementChain(userId)`, a tabela
   domknięcia łańcucha zarządczego nie ma pełnego producenta. **Nie
   naprawiasz tego w tym dyżurze** — ale gdy Twoja pozycja (§O.1) opiera się
   o `chain_members`, **musisz to powtórzyć w kontrakcie odpowiedzi**:
   pole zasięgu z jawnym `scopeCompleteness: 'PARTIAL_MANAGEMENT_CHAIN'`.
   Milczące udawanie pełnego zasięgu = atrapa.

7. **Sortowanie migracji nie jest alfabetyczne.** Patrz §0.3 pkt 2. Nie
   zakładaj, że `20260901_` „jakoś się ustawi" — sprawdź w
   `server/scripts/migrate.postgres.ts:200-244`, że faza DATED sortuje po
   dacie.

8. **`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`.**
   `resultsInternalBetaVisibility.middleware.ts:26-33` przepuszcza żądania
   w `NODE_ENV=test`, **chyba że** ustawisz
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. Twój test negatywu
   tenanta dla Results **musi** działać w trybie `enforce` — inaczej dowodzi
   nieprawdy. Wpisz do raportu, że test go ustawia.

9. **`xlsx` z package.json to tarball z CDN** (`package.json:429`,
   `https://cdn.sheetjs.com/...`). W FREEZE nie masz gwarancji instalacji
   z sieci. **Do §X.2 używasz `exceljs`** (`package.json:355`, `^4.4.0`,
   zwykła zależność z rejestru) — tym samym wzorcem leniwego importu
   i `dependencyMissing`, którym `managementReportsService.ts:23-46` ładuje
   `pdfkit`/`pptxgenjs`.

### 1.6. Pozycje otwarte — czego NIE ZGADUJESZ

| #   | Kwestia                                                                            | Status                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `E-O3` — taksonomia i mapowania BSC (initiative/milestone → objective/perspective) | **U Piotra** (`DEC-72`). Nie budujesz mapowań. Raport zostaje „operacyjnym backlogiem"                                                                                                           |
| 2   | `E-O4` — wagi wpływu, próg at-risk, SLA decyzji                                    | **U Piotra**. Parametryzujesz (§X.4)                                                                                                                                                             |
| 3   | `E-O5` — próg saturacji, bufor, źródło dostępności (absencje/obowiązki/rezerwacje) | **U Piotra** + brak źródła danych. Parametryzujesz próg; brak źródła = `BRAK_ŹRÓDŁA`                                                                                                             |
| 4   | `E-O7` część AI (`FACT`/`INFERENCE`/`RECOMMENDATION` z cytowaniem)                 | **Czeka na klucz dostawcy** (`DEC-59`). Robisz **tylko** eksport XLSX (§X.2), zero AI                                                                                                            |
| 5   | Severity i reaction SLA w pętli sterowania                                         | **U Piotra**. Parametryzujesz                                                                                                                                                                    |
| 6   | Czy `Search Results` ma obejmować też ROI Cases obok KPI i OKR Set                 | **Decyzja projektowa** — patrz §S.1 pkt 6. Domyślnie **tak**, ale jeżeli natrafisz na przeszkodę w widoczności ROI (`resolveRoiGovernedVisibility`), to jest STOP z propozycją, nie improwizacja |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

```bash
wc -l server/src/routes/resultsVnext/*.ts          # razem ~11 774 l.
wc -l server/src/routes/pmo/initiativesExecutionRuntime.routes.ts   # 5 843
wc -l server/src/routes/managementReports.routes.ts                 # 460
wc -l server/src/routes/executionControl.routes.ts                  # 1 085
wc -l server/src/routes/executionAnalytics.routes.ts                # 311
wc -l server/src/domain/initiatives-execution/reportRun.ts          # 299
```

Weryfikacja liczb jest częścią Bloku 0. Rozbieżność ±kilka linii odnotuj
w raporcie („Korekty wobec instrukcji") i **pracuj dalej**; rozbieżność
rzędu setek linii = **STOP**, bo baza jest inna niż zakładana.

### 2.2. Kanoniczny wzorzec tenant-izolacji Results vNext

To jest **jedyny** dozwolony wzorzec dla nowych tras Results w tym dyżurze.
Źródło: `server/src/routes/resultsVnext/kpi.routes.ts`.

```ts
// łańcuch middleware — kolejność jest istotna (kpi.routes.ts:143-156)
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireActiveMembership); // ← twardy mur członkostwa per request
router.use(requireOrgAccess());
router.use(requireResultsInternalBetaVisibility);
router.use(demoContextMiddleware);
```

Komentarz w tym pliku (`:145-152`) tłumaczy, dlaczego `requireActiveMembership`
nie jest nadmiarowy: `requireOrgAccess()` **nie ma ani jednego odwołania do
`organization_members`** — zweryfikowano na realnym serwerze i realnym
Postgresie, że po odebraniu członkostwa router nadal obsługiwał żądania na
tym samym tokenie, tak samo jak SUPERADMIN bez wiersza członkostwa.
**Nie pomijasz tego middleware w nowych routerach.**

Dalej, w każdym handlerze:

```ts
const auth = requireAuth(req, res); // kpi.routes.ts:166-176 — org i user WYŁĄCZNIE z req.user
if (!auth) return;
```

I dla każdego odczytu, który dotyka zasobów objętych widocznością:

```ts
const cte = await buildVisibilityScopedCte({
  userId: auth.userId,
  organizationId: auth.organizationId,
  resourceType: 'kpi', // wartość z RVN_RESOURCE_TYPES
});
// cte.sql + cte.values → prefiks Twojego zapytania
```

`RVN_RESOURCE_TYPES` (`server/src/services/resultsVnext/platform/resourceTypes.ts:19+`)
to **jedyne** źródło nazw typów zasobów: `kpi`, `roi_case`, `okr_set`,
`deviation_case`, `kpi_scorecard`, `okr_program`, `okr_cycle`, ... —
**nie dopisujesz** nowego typu bez jawnego uzasadnienia w raporcie (to jest
zmiana SSOT dzielona z `myWorkRoofPackage.ts`).

**Pułapka, która w tym programie powtórzyła się najczęściej** (cytat
z nagłówka `okrAttentionRepository.ts`): `rvn_visible_resources.resource_id`
jest `TEXT`, a `okr_vnext_sets.set_id` jest `UUID` — złączenie wymaga rzutu
`::text`. Jeżeli Twój test `realdb` zwraca pustkę „bez powodu", to jest
pierwsza rzecz do sprawdzenia.

### 2.3. Kanoniczny wzorzec tenant-izolacji Execution runtime

Źródło: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`.

```ts
const actor = actorFromRequest(req);
if (!actor) {
  res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
  return;
}

// odczyt listy:
const items = await deps.reader.listReportRuns(actor.organizationId);
res.json({
  items: await filterVisibleAggregates(actor, items, 'report_run', (i: any) => i.reportRunId),
});

// odczyt pojedynczego — 404, nie 403, gdy brak widoczności (:4741-4744):
if (!(await canViewAggregate(actor, 'report_run', id))) {
  res.status(404).json({ error: { code: 'NOT_FOUND' } });
  return;
}
```

**404 zamiast 403 przy braku widoczności jest tu celowe** (nie ujawnia
istnienia cudzego zasobu) — powielasz to, nie „poprawiasz".

Mapa widoczności per ścieżka jest w `:1238-1290` (`path.startsWith('/report-runs/')`
→ `resolveProjectIdsForAggregate`). **Dodając nową ścieżkę pod
`/report-runs/*` musisz dopisać ją do tej mapy** — inaczej Twój endpoint
będzie poza kontrolą projektową. To jedyna dozwolona zmiana w tym bloku.

### 2.4. Montaż w Gateway — kolejność ma znaczenie

`server/src/Gateway.ts` montuje routery Results vNext w porządku
**„bardziej szczegółowy prefiks NAJPIERW"** (`:1247-1256` i komentarze
`:287-350`). Powód: `resultsVnextKpiRoutes` jest właścicielem
`GET /:kpiId` na krótkim prefiksie `/api/vnext/results/kpi`, więc każdy
router o dłuższym prefiksie musi być zarejestrowany **przed** nim, inaczej
jego ścieżki zostaną przechwycone jako `:kpiId`.

**Twój nowy router wyszukiwania (§S.1)** dostaje **własny, nowy prefiks**
`/api/vnext/results/search` — bez interakcji kolejnościowej z KPI/OKR/ROI.
To jest świadomy wybór: mniej ryzyka niż `/kpi/search`.

Nowe ścieżki §O.1/§O.2 są **dziećmi istniejących routerów** i idą do
`okr.routes.ts`; nie zakładasz dla nich osobnego montażu.

Do każdego nowego `app.use` dopisujesz komentarz w stylu istniejących
(dlaczego ten prefiks, dlaczego w tym miejscu kolejności).

### 2.5. Wzorzec testu `realdb`

Wzorzec do skopiowania: `tests/resultsVnext/okr/okrAttentionQueue.realdb.test.ts:20-52`.

Kluczowe elementy, których **nie wolno** uprościć:

```ts
function buildClientConfig(): ClientConfig | null {
  /* DATABASE_URL albo PGHOST/... ; null gdy brak */
}
const DB_CONFIGURED = buildClientConfig() !== null;

// unikalny tag per przebieg — żaden wiersz nie koliduje z cudzym dowodem
const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `day14-<pozycja>-org-${tag}`;

// POLITYKA SKIP: cichy no-op bez skonfigurowanej bazy;
// beforeAll RZUCA, gdy baza skonfigurowana, ale nieosiągalna.
```

`afterAll` kasuje **wyłącznie** wiersze z własnym `tag`. Zero `TRUNCATE`,
zero `DELETE FROM ... WHERE organization_id IS NOT NULL`, zero czyszczenia
„przy okazji". To jest ta sama reguła co „dane demo = twarz produktu".

Uruchamiasz z `DATABASE_URL` wskazującym **wyłącznie** na kontener
z §0.3 pkt 6 (port 5442). Wskazanie czegokolwiek innego = naruszenie Z9.

### 2.6. Testy zastane — co Cię pilnuje

```bash
ls server/src/routes/resultsVnext/__tests__/
ls server/src/services/resultsVnext/*/__tests__/ 2>/dev/null | head -40
ls server/src/domain/initiatives-execution/__tests__/ 2>/dev/null
ls tests/resultsVnext/
```

Wynik tej enumeracji wklejasz do raportu (Blok 0). Każdy z tych testów jest
**strażnikiem**: jeśli Twoja zmiana go zapali, to nie jest „zastane", tylko
regresja (§0.4a pkt 4).

### 2.7. Czego w bazie NIE MA — sprawdzone przed wystawieniem instrukcji

Te komendy wykonano na tipie `codex/m03-admin-20260824`. **Powtórz je
w Bloku 0** — jeśli którakolwiek zwróci wynik, to znaczy, że pozycja już
istnieje i Twoje zadanie się zmienia (odnotuj i skoordynuj, §1.4).

```bash
# §S — brak wyszukiwania i brak parametru q= w rejestrach Results
grep -rn "req.query" server/src/routes/resultsVnext/ | grep -iE "\bq\b|search"     # oczekiwane: PUSTO
grep -rn "'/search'" server/src/routes/resultsVnext/                                # oczekiwane: PUSTO

# §K — brak trendu, brak historii, brak następnego obowiązku na karcie KPI
grep -rn "trend" server/src/routes/resultsVnext/kpi.routes.ts                       # oczekiwane: PUSTO
grep -rn "history\|lineage\|timeline" server/src/routes/resultsVnext/kpi.routes.ts  # oczekiwane: tylko komentarz ":11"
grep -rn "obligation" server/src/routes/resultsVnext/kpi.routes.ts                  # oczekiwane: PUSTO

# §O — brak Set-scoped attention i brak agregatu check-inów Setu
grep -n "attention" server/src/routes/resultsVnext/okr.routes.ts                    # oczekiwane: tylko :3202-3214, bez parametrów
grep -n "check-ins" server/src/routes/resultsVnext/okr.routes.ts                    # oczekiwane: WYŁĄCZNIE pod /key-results/:keyResultId

# §X.1 — brak rekonstrukcji as-of
grep -rn "asOf" server/src/domain/initiatives-execution/reportRun.ts                # oczekiwane: :34, :72, :204 — pole snapshotu, zero replay

# §X.2 — brak XLSX
grep -rn "xlsx\|exceljs" server/src/services/managementReportsService.ts            # oczekiwane: PUSTO
grep -rn "xlsx" server/src/routes/managementReports.routes.ts                       # oczekiwane: PUSTO

# §X.4 — brak zunifikowanego read-modelu ośmiu rodzin
grep -rn "planDelivery\|interventionEffectiveness\|decisionLatency" server/src/routes/ | head   # oczekiwane: PUSTO albo bez związku
```

Wyniki wklejasz do raportu jako tabelę `WERYFIKACJA_BRAKÓW`. **To jest
najważniejsza tabela Bloku 0** — bez niej nie wiadomo, czy Twoja praca
czegoś nie dubluje.

---

## §S. SEKCJA SEARCH RESULTS (`R.4`, `DEC-62`) — dwie pozycje

**Skąd:** raport dnia 8, `R.4`: „Search jako pierwsza pozycja Menu 2 →
`BRAK_API` / STOP; brak `/vnext/results/search` i `q=` w 12 routerach
Results". `DEC-62`: „Search Results (R.4) = **przyszły dyżur backendowy**".

### S.1 — Endpoint wyszukiwania w obrębie Results

**Cel:** jedna trasa, która na podstawie frazy zwraca trafienia z rejestrów
Results — tak, żeby przyszły pasek wyszukiwania w Menu 2 nie musiał
odpytywać trzech rejestrów osobno i sam ich nie scalał (to byłaby „druga
prawda", której `DEC-62(c)` wprost zabroniła).

**Kontrakt:**

```
GET /api/vnext/results/search?q=<fraza>&kinds=kpi,okr_set,roi_case&limit=<n>&cursor=<c>

200 → {
  query: string,
  kinds: string[],                         // faktycznie przeszukane rodzaje
  results: Array<{
    kind: 'kpi' | 'okr_set' | 'roi_case',
    id: string,
    title: string,
    subtitle: string | null,               // np. kod KPI / nazwa cyklu / faza ROI
    status: string,
    updatedAt: string,
    matchedField: 'title' | 'code' | 'description',
    href: string                           // kanoniczna ścieżka klienta, bez query
  }>,
  nextCursor: string | null,
  scopeCompleteness: 'FULL' | 'PARTIAL_MANAGEMENT_CHAIN' | 'PARTIAL_UNAVAILABLE_KIND',
  unavailableKinds: Array<{ kind: string, reason: 'BRAK_ŹRÓDŁA' | 'ACCESS_DENIED' }>
}
```

**Wymagania twarde:**

1. **Nowy router, nowy prefiks.** Plik
   `server/src/routes/resultsVnext/search.routes.ts`, montowany w Gateway
   pod `/api/vnext/results/search`. Pełny łańcuch middleware z §2.2 — bez
   skrótów.
2. **`organizationId` z tokenu.** `requireAuth` jak w `kpi.routes.ts:166-176`.
   Precedens `server/src/routes/table-platform.routes.ts:351-370` czyta
   `authReq.organizationId` — **nie kopiujesz tego wzorca**, jest słabszy.
3. **Widoczność per rodzaj, nie „na końcu".** Każde pod-zapytanie startuje
   od `buildVisibilityScopedCte` z własnym `resourceType`. Filtrowanie
   wyników po pobraniu = błąd (wyciekają liczby i kursory).
4. **Walidacja frazy.** `q` wymagane, po `trim` minimum 2 znaki; krótsze →
   `200` z `results: []` (nie `400` — pusty wynik to normalny stan paska
   wyszukiwania). Górny limit długości frazy: 200 znaków, powyżej `400`.
   `limit` domyślnie 20, maksymalnie 50. Schemat zod w
   `server/src/validators/resultsVnextSearch.validators.ts` (nowy plik),
   wzorem `resultsVnextKpi.validators.ts:108-112` i `:215-221`.
5. **Dopasowanie bezpieczne.** `ILIKE` z parametrem pozycyjnym i jawnym
   escapowaniem `%`, `_`, `\` we frazie **przed** owinięciem w `%...%`.
   Zero konkatenacji SQL. Zero `data::text ILIKE` po całym rekordzie
   (precedens `table-platform.routes.ts:366` robi tak — u Ciebie
   wyszukujesz **wyłącznie po nazwanych kolumnach**: tytuł, kod, opis).
6. **Rodzaje.** Domyślnie `kpi` + `okr_set` + `roi_case`. Jeżeli dla ROI
   `resolveRoiGovernedVisibility` (`visibilityScopedQuery.ts:101`) okaże się
   niekompatybilny ze wspólnym CTE — **nie improwizujesz**: zwracasz
   `roi_case` w `unavailableKinds` z powodem `BRAK_ŹRÓDŁA`, ustawiasz
   `scopeCompleteness: 'PARTIAL_UNAVAILABLE_KIND'` i **wpisujesz STOP
   z propozycją** do raportu.
7. **Determinizm i stronicowanie.** Sortowanie stabilne:
   `updatedAt DESC, id ASC`. Kursor = nieprzezroczysty base64 pary
   `(updatedAt, id)` — nie offset (offset gubi wiersze przy równoległych
   zapisach).
8. **Zero zapisów.** Trasa jest wyłącznie odczytowa. Zero `observeWriter`,
   zero eventów, zero `rvn_platform_events`.

**Migracja:** wyłącznie **indeksy**, jeśli pomiar pokaże, że są potrzebne —
`CREATE INDEX IF NOT EXISTS` na kolumnach nazwy/kodu, plik
`20260901_day14_results_search_indexes.sql`. **Nie tworzysz tabeli
wyszukiwania, nie tworzysz materialized view, nie instalujesz rozszerzeń
full-text.** Jeżeli uznasz, że `ILIKE` bez indeksu jest za wolny — zmierz
i **wpisz pomiar do raportu**, a decyzję o pg_trgm zostaw jako STOP
(rozszerzenie bazy na wspólnej, zamrożonej bazie to nie jest zmiana
addytywna w rozumieniu `DEC-65`).

**DoD dodatkowo do §0.4:**

- test: fraza trafiająca w **dwa różne rodzaje** naraz zwraca oba, w jednym
  posortowanym zbiorze;
- test: KPI należący do **innej organizacji** nie pojawia się **nigdy** —
  ani w `results`, ani w liczniku, ani w `nextCursor`;
- test: KPI należący do **tej samej** organizacji, ale **niewidoczny** dla
  wołającego (brak wiersza widoczności) — również nie pojawia się;
- test: `q` jednoznakowe → `200` + `results: []`, **zero zapytań do bazy**
  (asercja na spy, nie na wyniku);
- test `realdb`: kursor przechodzi przez 3 strony bez duplikatu i bez
  zgubionego wiersza.

### S.2 — Parametr `q=` w rejestrach KPI / OKR / ROI

**Cel:** rejestr (lista) ma umieć zawęzić się frazą **bez** przechodzenia na
ekran wyszukiwania. To jest osobne zachowanie od §S.1 i nie zastępuje go.

**Kontrakt — dokładnie trzy trasy, addytywnie:**

| Trasa                              | Plik                                           | Dziś                                                                                          |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/vnext/results/kpi`       | `server/src/routes/resultsVnext/kpi.routes.ts` | `ListKpisQuerySchema` = `status`, `limit`, `offset` (`resultsVnextKpi.validators.ts:108-112`) |
| `GET /api/vnext/results/okr/sets`  | `server/src/routes/resultsVnext/okr.routes.ts` | schemat listy Setów                                                                           |
| `GET /api/vnext/results/roi/cases` | `server/src/routes/resultsVnext/roi.routes.ts` | schemat listy spraw                                                                           |

Do każdego schematu dokładasz **jedno opcjonalne pole**:

```ts
q: z.string().trim().min(2).max(200).optional(),
```

**Wymagania twarde:**

1. **Addytywnie i wstecznie zgodnie.** Brak `q` = **identyczne zachowanie
   jak dziś**, co do wiersza i co do kolejności. To jest wymóg `DEC-65`
   (zamrożone demo woła te trasy bez `q`). Dowodzisz tego testem
   porównującym odpowiedź przed/po **na tym samym zbiorze danych**.
2. **Ta sama semantyka dopasowania co §S.1** — te same kolumny, ten sam
   escaping, ta sama wielkość liter. Dwa różne wyniki dla tej samej frazy
   w wyszukiwarce i w rejestrze = „druga prawda". Wspólną funkcję
   dopasowania trzymasz w jednym miejscu
   (`server/src/services/resultsVnext/platform/textMatch.ts`, nowy plik)
   i wołasz z obu stron.
3. **Filtr działa NA POZIOMIE SQL**, wewnątrz CTE widoczności — nie po
   pobraniu strony. Inaczej `limit`/`offset` przestają się zgadzać.
4. **Zero zmian w istniejących polach.** Nie zmieniasz domyślnego `limit`,
   nie zmieniasz sortowania, nie dodajesz pól do odpowiedzi.

**DoD dodatkowo:** test „brak `q` → bajt-w-bajt ten sam kształt odpowiedzi
co przed zmianą" dla każdej z trzech tras + negatyw tenanta z `q`
dopasowującym cudzy rekord (musi zwrócić pusto, nie 200 z cudzym wierszem).

---

## §K. SEKCJA KARTA KPI (`R.5`, `DEC-61`) — trzy pozycje

**Skąd:** raport dnia 8, `R.5`, tabela nagłówka: „okres i trend →
`JEST_CZĘŚCIOWO / BRAK_API` — trend jawnie `BRAK_API`"; „właściciel, zakres,
**następny obowiązek** → `JEST_CZĘŚCIOWO / BRAK_API` — następny obowiązek
jawnie `BRAK_API`"; tabela obszarów: „Historia i rodowód → `BRAK_API`".
`DEC-61` potwierdziła: „2/6 elementów nagłówka = uczciwe `BRAK_API` (trend,
następny obowiązek)".

### K.1 — Trend KPI liczony po stronie serwera

**Cel:** karta ma pokazać kierunek zmiany, a nie „ostatnią liczbę". Kierunek
zależy od **geometrii celu** (`threshold_min`, `threshold_max`, `range`,
`exact`, `binary`, `custom` —
`server/src/services/resultsVnext/kpi/kpiTypes.ts:38-45`), więc liczenie go
w kliencie znaczy duplikowanie ewaluatora. Ewaluator już jest na serwerze:
`server/src/services/resultsVnext/kpi/targetGeometryEvaluator.ts`.

**Kontrakt:**

```
GET /api/vnext/results/kpi/:kpiId/trend?window=<n>&periodStart=<iso>&periodEnd=<iso>

200 → {
  kpiId: string,
  definitionVersionId: string,          // wersja definicji, wobec której liczono
  unit: string | null,
  points: Array<{                       // uporządkowane rosnąco po periodEnd
    periodStart: string,
    periodEnd: string,
    actualValue: number | null,
    performanceStatus: 'on_target'|'warning'|'critical'|'neutral',
    dataQualityStatus: 'unverified'|'verified'|'disputed'|'estimated',
    measurementId: string
  }>,
  direction: 'IMPROVING' | 'WORSENING' | 'FLAT' | null,
  directionReason: 'UNKNOWN' | 'INSUFFICIENT_DATA' | null,   // niepuste dokładnie gdy direction === null
  deltaAbsolute: number | null,
  deltaRelative: number | null,         // null gdy poprzednia wartość = 0 (dzielenie) — nie 0, nie Infinity
  comparedAgainst: { periodStart: string, periodEnd: string } | null,
  calculatedAt: string,
  sourceVersion: number
}
```

**Wymagania twarde:**

1. **Trend liczony wobec geometrii, nie wobec surowej różnicy.** Dla
   `threshold_max` (im mniej, tym lepiej) spadek wartości = `IMPROVING`.
   Używasz `evaluatePerformanceStatus` z istniejącego ewaluatora — nie
   piszesz drugiego.
2. **`binary` i `custom` nie mają kierunku liczbowego.** Dla nich
   `direction` = `null`, `directionReason` = `'UNKNOWN'`, a `points` nadal
   są zwracane. **Nie udajesz trendu.**
3. **Mniej niż dwa pomiary → `direction: null`,
   `directionReason: 'INSUFFICIENT_DATA'`.** Zero pomiarów → `points: []`
   i ten sam `directionReason`. **Nigdy `FLAT`.** `FLAT` znaczy „zmierzono
   dwa razy i wyszło tyle samo" — to jest informacja, a nie brak informacji.
4. **Źródło danych: istniejący szereg pomiarów.** `listMeasurements`
   (`server/src/services/resultsVnext/kpi/kpiRepository.ts:257`) już umie
   `periodStart`/`periodEnd`/`includeSuperseded`/`limit`/`offset`
   i już jest opakowany CTE widoczności (`:269`). **Budujesz nad nim,
   nie obok.** Domyślnie `includeSuperseded: false` — trend liczy się
   z widoku bieżącego, korekty zastępują wartość, a nie dokładają punkt.
5. **`window`** = liczba ostatnich okresów (domyślnie 12, maksymalnie 60).
   Wyklucza się z `periodStart`/`periodEnd`; podanie obu naraz → `400`.
6. **Zero nowej tabeli i zero migracji.** Jeżeli uznasz, że potrzebujesz
   cache'u trendu — to jest STOP z uzasadnieniem i pomiarem, nie
   samodzielna decyzja.

**DoD dodatkowo:** test dla **każdej** z sześciu geometrii (asercja na
`direction`, nie tylko na braku wyjątku); test „prawdziwe zero ≠ brak
danych" (KPI o wartości `0` ma `direction`, KPI bez pomiaru ma `null` +
`INSUFFICIENT_DATA`); negatyw tenanta w trybie
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`.

### K.2 — Historia i rodowód KPI

**Cel:** jedna oś czasu obiektu KPI: zmiany cyklu życia, wersje definicji
(zgłoszenie/akceptacja/odrzucenie/rewizja), pomiary i ich korekty, zmiany
widoczności. Dziś każda z tych rzeczy siedzi w innej tabeli i karta nie ma
skąd wziąć wspólnego widoku.

**Kontrakt (wzorowany 1:1 na kształcie `GET /okr/sets/:setId/history` —
`okr.routes.ts:2744-2766`):**

```
GET /api/vnext/results/kpi/:kpiId/history?cursor=<c>&limit=<n>

200 → {
  entries: Array<{
    entryId: string,
    occurredAt: string,
    kind: 'LIFECYCLE' | 'DEFINITION_VERSION' | 'MEASUREMENT' | 'MEASUREMENT_CORRECTION' | 'VISIBILITY',
    summaryCode: string,          // kod maszynowy, np. 'KPI_ACTIVATED' — NIE tekst dla użytkownika
    actorUserId: string | null,
    sourceVersion: number,
    references: Record<string, string>   // { definitionVersionId } / { measurementId } itd.
  }>,
  nextCursor: string | null
}
```

**Wymagania twarde:**

1. **Zero tekstu dla użytkownika w odpowiedzi.** `summaryCode` jest kodem;
   napis powstanie kiedyś po stronie UI, przez i18n. Zwrócenie polskiego
   albo angielskiego zdania z serwera = naruszenie Z10 (i18n) tylnymi
   drzwiami.
2. **Źródło:** `rvn_platform_events` (`server/migrations/20260809_rvn_platform_events_outbox.sql`)
   filtrowane po `organization_id` **i** po agregacie. Wzorzec czytania
   zdarzeń: `server/src/services/resultsVnext/okr/okrSetHistoryRepository.ts:106`.
   Dodatkowo tabele definicji/pomiarów tam, gdzie zdarzenie nie niesie
   kompletu (jawnie opisz w nagłówku pliku, które wpisy skąd pochodzą).
3. **Kursor, nie offset.** Ten sam wzorzec co §S.1 pkt 7. Sortowanie
   `occurredAt DESC, entryId ASC`.
4. **Braki są jawne.** Jeżeli dla części historii nie ma zdarzeń
   (KPI sprzed wdrożenia outboxu), zwracasz to, co jest, i **nie
   dopowiadasz** — brak wpisu to brak wpisu, nie „utworzono".
5. **Widoczność jak przy odczycie KPI.** Brak widoczności KPI → `404`,
   nigdy `200` z pustą historią (pusta historia znaczy „nic się nie
   działo", a to nieprawda).

**DoD dodatkowo:** test kolejności i kompletności na KPI z co najmniej po
jednym wpisie każdego z pięciu rodzajów; test kursora (3 strony, zero
duplikatów); negatyw tenanta zwraca `404`, nie `200 + []`.

### K.3 — Następny obowiązek dla KPI

**Cel:** karta ma odpowiedzieć na pytanie „co i kiedy właściciel musi z tym
KPI zrobić". **Schemat już istnieje — patrz §1.5 pkt 4.** Budujesz
read-model, nie tabelę.

**Kontrakt:**

```
GET /api/vnext/results/kpi/:kpiId/next-obligation

200 → {
  kpiId: string,
  obligation: {
    obligationId: string,
    obligationType: string,          // z rvn_platform_obligations.obligation_type
    dueAt: string | null,
    status: 'open',
    assigneeUserId: string,
    overdue: boolean,
    source: 'OBLIGATION_ROW'
  } | null,
  derived: {                          // wypełniane TYLKO gdy obligation === null
    nextExpectedAt: string | null,
    basis: 'MEASUREMENT_FREQUENCY_DAYS',
    frequencyDays: number,
    lastMeasuredPeriodEnd: string
  } | null,
  reason: 'NO_CADENCE_CONFIGURED' | 'NO_MEASUREMENT_YET' | null,
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **Kolejność źródeł jest sztywna i jawna.**
   (a) realny otwarty wiersz `rvn_platform_obligations` dla tego KPI
   (`reference_type` odpowiadający KPI, `status='open'`, najwcześniejszy
   `due_at`) → `obligation` wypełnione, `derived: null`;
   (b) brak wiersza, ale jest `measurement_frequency_days` i jest ostatni
   pomiar → `obligation: null`, `derived` wypełnione, **jawnie oznaczone
   jako pochodne** (`basis`);
   (c) brak jednego i drugiego → oba `null` + `reason`.
   **Nigdy nie mieszasz (a) i (b) w jedno pole.** Obowiązek zapisany
   i obowiązek wywnioskowany to dwie różne rzeczy i karta musi móc je
   rozróżnić.
2. **`overdue` liczysz na serwerze**, wobec `now()` serwera, i zwracasz
   `calculatedAt`. Klient nie ma prawa liczyć tego sam (strefy czasowe).
3. **Zero heurystyk poza (b).** `listMyKpis` ma własną gałąź
   `branch_update_due_heuristic` (opisaną w nagłówku
   `20260813_rvn_kpi_measurement_cadence.sql:11-13`) — **czytasz ją, żeby
   zachować spójność semantyki**, ale nie kopiujesz do niej niczego nowego
   i nie zmieniasz jej.
4. **Zero migracji**, chyba że udowodnisz brak — wtedy uzasadnienie
   w raporcie **przed** napisaniem migracji.

**DoD dodatkowo:** test dla każdego z trzech wariantów (a)/(b)/(c);
test `overdue` na wierszu z `due_at` w przeszłości; negatyw tenanta —
obowiązek innej organizacji nie wycieka nawet przez `assigneeUserId`.

---

## §O. SEKCJA OKR (`R.6-O1c`, `R.6-O2`, `DEC-62`) — dwie pozycje

### O.1 — Attention w zasięgu jednego Setu

**Skąd:** raport dnia 8, `R.6-O1 — STOP`: „endpoint zwraca agregat
organizacyjny, nie płaską listę Setu. Filtrowanie po stronie klienta bez
zatwierdzonego klucza przynależności tworzyłoby **drugą prawdę**".
`DEC-62(c)`: „link do wspólnej `/attention` **BEZ filtrowania klienckiego**
(unika »drugiej prawdy«); **Set-scoped filtr = przyszły backend**".

**Cel:** ten sam read-model uwagi, zawężony do jednego Setu **po stronie
serwera**, z tym samym kluczem przynależności, którego używa agregat
organizacyjny.

**Kontrakt:**

```
GET /api/vnext/results/okr/sets/:setId/attention

200 → {
  setId: string,
  attention: {
    staleCheckins: [...],                  // te same kształty co /attention
    lowConfidenceObjectives: [...],
    openSupportRequests: [...],
    openBlockers: [...],
    escalatedSets: [...]                    // 0 lub 1 element — ten Set albo nic
  },
  scopeCompleteness: 'FULL' | 'PARTIAL_MANAGEMENT_CHAIN',
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **Jedna implementacja, dwa wejścia.** Rozszerzasz
   `server/src/services/resultsVnext/okr/okrAttentionRepository.ts`
   o **opcjonalny** parametr `setId` w `ListOrganizationOkrAttentionParams`
   i przekazujesz go do wszystkich pięciu pod-zapytań jako dodatkowy filtr
   **wewnątrz** ich SQL. **Nie piszesz drugiego repozytorium** i **nie
   filtrujesz tablicy po pobraniu** — to jest dokładnie ta „druga prawda",
   której `DEC-62(c)` zabroniła, tylko przeniesiona o warstwę niżej.
2. **Istniejąca trasa `/attention` zostaje bez zmian.** Wołanie
   `listOrganizationOkrAttention` bez `setId` musi zwrócić **dokładnie to
   samo, co dziś** — dowodzisz testem porównawczym (`DEC-65`, zamrożone
   demo woła tę trasę).
3. **`setId` walidowany i sprawdzany na widoczność.** Set spoza
   organizacji albo niewidoczny → `404` (wzorzec `okr.routes.ts` /
   `handleOkrRouteError`). **Nigdy `200` z pustym agregatem** — pusty
   agregat znaczy „Set jest czysty", a to nieprawda.
4. **`scopeCompleteness` obowiązkowe.** Powód w §1.5 pkt 6: łańcuch
   zarządczy nie jest w pełni zasilany. Gdy zasięg opiera się o
   `chain_members`, zwracasz `'PARTIAL_MANAGEMENT_CHAIN'`. Milczenie = atrapa.
5. **Rzut `::text` na złączeniu widoczności** — §2.2, pułapka programu.

**DoD dodatkowo:** test „suma po wszystkich Setach organizacji = agregat
organizacyjny" (rekoncyliacja — to jest dowód, że nie ma dwóch prawd);
test negatywu tenanta (cudzy `setId` → `404`); test `realdb` na wszystkich
pięciu rodzajach sygnału.

### O.2 — Agregat check-inów Setu po stronie serwera

**Skąd:** raport dnia 8, `R.6-O2 — STOP`: „read-only agregat
ostatni/następny check-in per KR (...). Zapis pozostaje przy KR, ponieważ
API **nie ma check-inu Setu**". `DEC-62(d)`: agregacja per-KR autoryzowana
po stronie klienta — Ty przenosisz ją na serwer, żeby nagłówek Setu
i szczegół KR nie liczyły tego samego dwa razy, dwoma różnymi wzorami.

**Stan zastany, zweryfikowany:** check-iny istnieją **wyłącznie** pod
`/key-results/:keyResultId/check-ins` (`okr.routes.ts:1819-1950`). Nie ma
niczego na poziomie Setu.

**Kontrakt:**

```
GET /api/vnext/results/okr/sets/:setId/check-in-summary

200 → {
  setId: string,
  keyResults: Array<{
    keyResultId: string,
    objectiveId: string,
    lastCheckIn: { checkInId: string, recordedAt: string, confidence: string | null } | null,
    nextExpectedAt: string | null,
    staleness: 'CURRENT' | 'DUE' | 'OVERDUE' | 'UNKNOWN',
    stalenessReason: 'NO_CHECKIN_YET' | 'NO_CADENCE_CONFIGURED' | null
  }>,
  rollup: {
    total: number,
    withCheckIn: number,
    overdue: number,
    neverCheckedIn: number,
    oldestCheckInAt: string | null,
    newestCheckInAt: string | null
  },
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **Read-only. Zero zapisu, zero nowej ścieżki mutacji.** Nie budujesz
   „check-inu Setu" — to byłby nowy agregat domenowy, a na to nie ma
   decyzji. Zapis zostaje przy KR (`DEC-62(d)` mówi „read-only").
2. **`staleness` wymaga kadencji.** Jeżeli KR nie ma skonfigurowanej
   kadencji check-inów → `staleness: 'UNKNOWN'` +
   `stalenessReason: 'NO_CADENCE_CONFIGURED'`. **Nigdy `CURRENT`**
   („nie wiemy" to nie to samo co „w porządku"). Jeżeli w schemacie OKR nie
   znajdziesz kadencji check-inów — to jest **`BRAK_ŹRÓDŁA`**: zwracasz
   `nextExpectedAt: null` i `UNKNOWN` dla wszystkich KR, i **wpisujesz to do
   raportu jako lukę**, zamiast wymyślać częstotliwość.
3. **`rollup` jest liczony z tej samej listy, którą zwracasz.** Nie
   z osobnego zapytania. Rozjazd między `keyResults.length` a `rollup.total`
   = defekt, który test ma złapać.
4. **Korekty check-inów.** `correctCheckIn` tworzy wiersz zastępujący
   (`okr.routes.ts:1904-1950`). `lastCheckIn` pokazuje **wiersz obowiązujący**,
   nie ostatni fizycznie wstawiony. Ta sama semantyka co `listMeasurements`
   w §K.1 pkt 4.
5. **Widoczność Setu jak w §O.1 pkt 3** — `404` przy braku.

**DoD dodatkowo:** test rekoncyliacji `rollup` ↔ `keyResults`; test Setu
bez ani jednego check-inu (`neverCheckedIn === total`, `oldestCheckInAt`
i `newestCheckInAt` = `null`, **nie** data utworzenia Setu); test
korekty (agregat pokazuje wiersz zastępujący); negatyw tenanta.

---

## §X. SEKCJA EXECUTION (`E-O6`, `E-O7`, generator, `DEC-63`, `DEC-72`) — cztery pozycje

### X.1 — Rekonstrukcja `as-of` (replay historyczny snapshotu, `E-O6`)

**Skąd:** raport dnia 11, `STOP — E-O6`: „snapshot przechowuje `asOf`, ale
nie znaleziono endpointu rekonstruującego **historyczne źródła** na tę datę.
Zmiana serwera jest zabroniona Z16". Tamten dyżur nie mógł tknąć serwera.
**Ty możesz i to jest ta pozycja.**

**Stan zastany:** `asOf` jest polem `ReportRun`
(`server/src/domain/initiatives-execution/reportRun.ts:34`), trafia do
zamrożonego snapshotu (`:204`) i wchodzi do hasha (`:207`). Ale **nic go nie
używa do odczytu**: run zbiera dane „teraz", a `asOf` jest tylko etykietą.
Dwa uruchomienia tego samego raportu na tę samą datę `asOf`, wykonane
w odstępie tygodnia, dadzą różne liczby — i nic tego nie wykrywa.

**Cel:** odtworzyć stan źródeł **na moment `asOf`**, deterministycznie,
z zapisu zdarzeń — albo **uczciwie odmówić**, gdy zapis zdarzeń tego nie
umożliwia.

**Kontrakt:**

```
POST /api/v8/pmo/initiatives-execution/report-runs/:reportRunId/reconstruct
body: { asOf: string }        // ISO; musi być ≤ now()

200 → {
  reportRunId: string,
  asOf: string,
  reconstructable: boolean,
  sources: ReportSource[],               // kształt z reportRun.ts:11-24
  gaps: Array<{
    sourceType: string,
    sourceId: string,
    reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF' | 'SOURCE_NOT_EVENT_SOURCED' | 'ACCESS_DENIED'
  }>,
  reconstructedAt: string
}
```

**Wymagania twarde:**

1. **`reconstructable: false` jest wynikiem pełnowartościowym.** Gdy dla
   któregokolwiek źródła nie da się odtworzyć stanu na `asOf`, zwracasz
   `false` i wypełniasz `gaps`. **Nie zwracasz stanu bieżącego udającego
   historyczny.** To jest najgroźniejsza możliwa atrapa w tym dyżurze:
   liczba wygląda tak samo, a znaczy co innego.
2. **Odtwarzasz ze zdarzeń, nie z bieżącego stanu.** Materiał: zdarzenia
   agregatów w runtime-v1 (`materialCommand.ts` / `getRelatedAggregateForUpdate`
   i wersjonowanie agregatów — `reportRun.ts:76-88` pokazuje, jak sięga się
   po **dokładną wersję** definicji). Dla każdego źródła ustalasz **wersję
   obowiązującą w chwili `asOf`** i to jej numer trafia do
   `ReportSource.version`, a `capturedAt` = czas tej wersji, **nie** `now()`.
3. **`freshness` wobec `asOf`, nie wobec teraz.** Źródło, którego ostatnia
   wersja jest starsza niż `asOf` o więcej niż okno raportu, dostaje
   `'STALE'`. Źródło bez historii → `'UNKNOWN'` i wpis w `gaps`.
4. **`asOf` w przyszłości → `400`.** `asOf` starsze niż najstarsze
   zdarzenie organizacji → `200` z `reconstructable: false` i wszystkimi
   `gaps` typu `NO_EVENT_HISTORY_BEFORE_AS_OF`.
5. **Zero mutacji.** Trasa **nie** zmienia runu. Nie zapisuje `sources`,
   nie przechodzi stanu, nie tworzy eventu. Jest to odczyt z ciężkim
   obliczeniem — świadomie `POST` (ciało z datą), ale bez skutku ubocznego.
   Powiązanie z §X.3 (gdzie wynik JEST zapisywany) jest jawne i osobne.
6. **Tenant i widoczność:** wzorzec z §2.3 — `actorFromRequest`,
   `canViewAggregate(actor, 'report_run', id)` → `404` przy braku.
   **Dopisujesz ścieżkę do mapy `:1278-1290`.**
7. **Idempotencja i determinizm — to jest sedno pozycji.** Dwa wywołania
   z tym samym `asOf` na niezmienionym zapisie zdarzeń muszą zwrócić
   **identyczny** zbiór `sources` (po stabilnej serializacji). Dowodzisz
   tego testem: dwa wywołania → `reportContentHash` (`reportRun.ts:62`)
   z obu wyników identyczny.

**Migracja:** zwykle **żadna**. Jeżeli okaże się, że runtime-v1 nie
przechowuje czasu wersji agregatu w formie nadającej się do zapytania
— **STOP**, z opisem brakującej kolumny i propozycją migracji addytywnej,
**nie** z migracją napisaną „na wszelki wypadek".

**DoD dodatkowo:** test determinizmu (dwa przebiegi, identyczny hash); test
„źródło zmienione po `asOf` nie wpływa na wynik"; test `reconstructable:
false` z niepustym `gaps`; test `asOf` w przyszłości → `400`; negatyw
tenanta → `404`.

### X.2 — Eksport XLSX (`E-O7`, **bez** silnika AI)

**Skąd:** raport dnia 11, `E.4`: „Eksport → `JEST_CZĘŚCIOWO`:
management-reports: PDF/PPTX; runtime-v1 JSON; **XLSX `BRAK_API`**".
`STOP — E-O7`: część AI wstrzymana.

**★ Granica pozycji, dosłownie:** budujesz **wyłącznie** gałąź XLSX.
**Zero** `FACT`/`INFERENCE`/`RECOMMENDATION`, **zero** cytowań modelu,
**zero** dostawcy AI (Z15, `DEC-59`). Jeżeli pomyślisz „przy okazji dołożę
sekcję rekomendacji" — to jest STOP.

**Kontrakt:**

```
GET /api/management-reports/:id/xlsx
200 → { success: true, xlsxUrl: string }
503 → respondFeatureUnavailable(res, 'missing dependency: exceljs')
404 → { success: false, error: 'Report not found' }
```

**Wymagania twarde:**

1. **`exceljs`, nie `xlsx`.** Powód w §1.5 pkt 9. Ładujesz leniwie,
   dokładnie wzorem `loadExportDeps()`
   (`server/src/services/managementReportsService.ts:23-46`), rozszerzając
   tę funkcję o trzecie pole. `dependencyMissing` (`:48`) rozszerzasz
   o `'exceljs'`. Brak zależności = **`503` z jawnym powodem**, nigdy pusty
   plik i nigdy `200`.
2. **★ Naprawiasz dziurę tenantową na tej ścieżce.** Dziś
   `generateExport` (`:1121`) → `getReport` (`:891`) →
   `getReportById(reportId)`
   (`server/src/repositories/managementReportRepository.ts:46-58`) czyta
   `WHERE id = ?` **bez `organization_id`**. To znaczy, że przy znajomości
   identyfikatora można wyeksportować cudzy raport.

   Robisz to tak, żeby **nie zepsuć zamrożonego demo** (`DEC-65`):
   - dodajesz **nową**, org-scoped metodę repozytorium
     (`getReportByIdForOrganization(reportId, organizationId)`) —
     addytywnie, obok istniejącej;
   - `generateExport` przyjmuje `organizationId` jako **nowy, wymagany
     parametr**, a wszystkie trasy w `managementReports.routes.ts`
     (`/:id/pdf`, `/:id/pptx`, nowe `/:id/xlsx`) przekazują
     `req.organizationId` pochodzące z tokenu;
   - brak dopasowania organizacji → **`404`**, ta sama odpowiedź co „nie
     ma raportu" (nie ujawniamy istnienia cudzego zasobu);
   - **istniejącej `getReportById` nie usuwasz i nie zmieniasz** — mają ją
     inni wołający, a Ty ich nie audytujesz w tym dyżurze. Wymieniasz ich
     listę w raporcie (`grep -rn "getReportById" server/src/`) jako
     znalezisko do osobnego zakresu.

3. **Zawartość arkusza wynika z raportu, nie z fantazji.** Jeden arkusz
   „Summary" z tymi samymi wierszami, które daje `buildSummaryLines(report)`
   (używana przez ścieżkę PDF, `:132`), plus po jednym arkuszu na sekcję
   treści raportu. **Zero kolumn wyliczanych na nowo** — eksport nie jest
   drugim miejscem liczenia. Jeśli sekcja jest pusta, arkusz jest pusty
   z nagłówkiem, a nie pominięty (żeby układ pliku był stabilny).
4. **Zapis ścieżki jak dla PDF/PPTX.** Kolumna docelowa: jeśli w
   `management_reports` nie ma `xlsx_path` — migracja addytywna
   `20260901_day14_management_reports_xlsx_path.sql`
   (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS xlsx_path TEXT`).
   **Kompatybilność wstecz** (§0.3 pkt 4): kolumna `NULL`-owalna,
   bez `DEFAULT` zmieniającego istniejące wiersze, stary kod jej nie widzi
   i działa dalej.
5. **`logAudit(reportId, 'EXPORTED', userId, { format: 'xlsx' })`** —
   tak samo jak pozostałe formaty (`:1150`).
6. **`bulk-export` NIE DOTYKASZ.** Jest atrapą (§1.5 pkt 3) — odnotowujesz
   w „Znaleziska — nie naprawiane" i idziesz dalej. Dołożenie `xlsx` do
   listy formatów bulk-exportu **pogłębiłoby** atrapę.

**DoD dodatkowo:** test „plik powstaje i da się go odczytać `exceljs`-em,
a nagłówki arkusza zgadzają się z `buildSummaryLines`"; test braku
zależności → `503` z powodem; **test negatywu tenanta na WSZYSTKICH trzech
formatach** (pdf/pptx/xlsx) — obcy `organizationId` dostaje `404`; test
raportu bez sekcji (arkusze puste, plik poprawny).

### X.3 — Realne `sources` zamiast `[]` + mapowanie lifecycle → eksport (`DEC-63(2)`)

**Skąd:** raport dnia 11, `E.4`: „Utworzenie szkicu → `JEST`: realne
`createReportRun`" — ale klient przekazywał `sources: []`
(`UnifiedExecutionReportGenerator.tsx:110` oraz
`ExecutionReportsSurface.tsx:398` na gałęzi dnia 11). `DEC-63(2)`:
„runtime-v1 `report-runs` = SSOT niezmiennej publikacji; management-reports
= pipeline eksportowy; **brakujące mapowanie lifecycle/export pozostaje
`BRAK_API`**". Tu je zamykasz.

To jest pozycja **dwuczłonowa**. Oba człony w jednym commicie byłyby
nieczytelne — rób dwa (`X.3a`, `X.3b`), obydwa raportowane pod `X.3`.

#### X.3a — read-model realnych źródeł raportu

**Cel:** serwer sam potrafi zebrać komplet `ReportSource[]` dla danej
definicji raportu, okresu i `asOf` — z wersją, czasem przechwycenia,
świeżością, pewnością i stanem dostępu. Dziś nikt tego nie robi i dlatego
klient wysyłał pustą tablicę.

**Kontrakt:**

```
GET /api/v8/pmo/initiatives-execution/report-definitions/:definitionId/sources
      ?version=<n>&periodStart=<iso>&periodEnd=<iso>&asOf=<iso>

200 → { sources: ReportSource[], gaps: [...], collectedAt: string }
```

**Wymagania twarde:**

1. **`ReportSource` wypełniasz naprawdę.** Kształt
   `reportRun.ts:11-24`: `sourceType`, `sourceId`, `version`, `capturedAt`,
   `freshness`, `formula`, `unit`, `currency`, `window`, `confidence`,
   `accessState`, `redactions`. Pola, których naprawdę nie da się ustalić:
   `null` / `'UNKNOWN'` — **nigdy wypełniacz w rodzaju `version: 1`
   albo `confidence: 'HIGH'` „bo tak zwykle jest"**.
2. **`accessState` i `redactions` są realne.** Źródło, do którego wołający
   nie ma dostępu, dostaje `'DENIED'` i **nie jest** po cichu pomijane.
   Pominięcie zmieniłoby wynik raportu w zależności od tego, kto go
   generuje — a raport ma być rekoncyliowalny.
3. **Nowy plik domenowy:**
   `server/src/domain/initiatives-execution/reportSources.ts`. Logika
   zbierania siedzi tam, trasa jest cienka (ta sama zasada, którą deklaruje
   nagłówek `kpi.routes.ts:10-14`).
4. **`asOf` deleguje do §X.1.** Gdy `asOf` jest podane i jest wcześniejsze
   niż `now()`, źródła zbierasz **przez rekonstrukcję z §X.1**, nie drugą
   ścieżką. Dwie ścieżki liczenia = dwie prawdy.

#### X.3b — zamknięcie luki walidacji i mapowanie do eksportu

**Wymagania twarde:**

1. **★ Pusty zbiór źródeł przestaje przechodzić walidację.**
   `reportRun.ts:186-193` — dokładasz **jedno** sprawdzenie **przed**
   istniejącymi:

   ```
   if (r.sources.length === 0) findings.push('NO_SOURCES');
   ```

   To jest **zaostrzenie istniejącego zachowania** i jedyne takie
   w dyżurze. Uzasadnienie do raportu: bez tego `DRAFT → VALIDATED`
   przechodzi na pustej tablicy przez próżniową prawdziwość `.some()`,
   a `FREEZE` zamraża snapshot bez ani jednego źródła — czyli publikuje
   raport, który nie ma czego rekoncyliować.

2. **★ REGUŁA ZGODNOŚCI WSTECZ — sprawdź, zanim zaostrzysz.**
   Wykonaj i wklej wynik do raportu:

   ```bash
   grep -rn "sources" server/src/domain/initiatives-execution/__tests__/ 2>/dev/null | head -20
   grep -rn "'VALIDATE'" server/src/ tests/ | head -20
   ```

   Jeżeli **istnieje** test albo wołający, który dziś świadomie waliduje run
   bez źródeł — **to jest STOP**, nie „poprawię test". Opisujesz kolizję,
   proponujesz wariant (np. `findings` ostrzegawcze zamiast twardego
   odrzucenia) i **czekasz**. Ta pozycja jest warta zrobienia tylko wtedy,
   gdy nie łamie niczego, co już działa.

3. **Mapowanie lifecycle runtime-v1 → eksport, wg `DEC-63(2)`.**
   Cykl runtime-v1: `DRAFT → VALIDATED → FROZEN → APPROVED → PUBLISHED`
   (+ `FAILED`, `SUPERSEDED`) — `reportRun.ts:29`.
   Pipeline eksportowy (`management-reports`) ma własne stany i własne
   formaty. **Mapowanie jest jednokierunkowe i wąskie:**
   - **tylko** run w stanie `PUBLISHED` może być wyeksportowany;
   - eksportuje się **wyłącznie `exportPackage.payload`** (zamrożony
     snapshot, `reportRun.ts:242`), nigdy stan bieżący;
   - `contentHash` runu (`:39`) jest przenoszony do metadanych eksportu
     i **weryfikowany przed zapisem pliku** — niezgodność = odmowa,
     wzorem `:237`;
   - eksport **nie zmienia** stanu runu i **nie tworzy** nowej wersji
     w runtime-v1.

   Implementujesz to jako **jawną funkcję mapującą** w
   `reportSources.ts` (albo osobnym `reportExportMapping.ts`), z tabelą
   dozwolonych przejść w komentarzu. Zero „domyślnego" przejścia dla stanów
   spoza listy — stan nieznany = błąd, nie „przepuść".

4. **Zero zmian w `atomicWrite.ts`** (Z17). Jeżeli zaostrzenie z pkt 1
   wymagałoby tam czegokolwiek — STOP.

**DoD dodatkowo:** test „`sources: []` → `VALIDATE` odrzucone z
`NO_SOURCES`"; test „run z realnymi źródłami przechodzi jak dotąd" (dowód,
że nie zepsułeś ścieżki pozytywnej); test „eksport z runu w stanie innym niż
`PUBLISHED` → odmowa" dla **każdego** z sześciu pozostałych stanów; test
„niezgodny `contentHash` → odmowa"; test `realdb` zbierania źródeł
z niepustym `gaps`.

### X.4 — Rodzina KPI Control: osiem rodzin, read-model (kontrakt `06_EXECUTION:258`)

**Skąd:** raport dnia 11, `E.3`: „KPI i forward scenarios 2/4/8/12 tyg. →
`BRAK_API`; **nie wolno składać wartości z niejawnych progów**";
„Severity i reaction SLA → `BRAK_API`; wartości/taksonomia wymagają decyzji
Piotra". `DEC-72` skierowała `E-O4`/`E-O5` do Piotra.

**Osiem rodzin — dosłownie z `modules/06_EXECUTION/MODULE_ACCEPTANCE.md:258`:**

| #   | Rodzina                 | Angielska nazwa z kontraktu  |
| --- | ----------------------- | ---------------------------- |
| 1   | dostarczanie planu      | `plan-delivery`              |
| 2   | praca zablokowana       | `blocked-work`               |
| 3   | kamienie milowe         | `milestone`                  |
| 4   | ryzyko inicjatywy       | `initiative-risk`            |
| 5   | zależności              | `dependency`                 |
| 6   | wydajność / zasoby      | `capacity`                   |
| 7   | opóźnienie decyzji      | `decision-latency`           |
| 8   | skuteczność interwencji | `intervention-effectiveness` |

**Zakres pozycji: „przynajmniej read-model".** To znaczy: **odczyt, bez
mutacji, bez scenariuszy prognostycznych.** Scenariusze `base/optimistic/
pessimistic` **nie wchodzą** — zależą od `E-O4` (wagi) i pozostają
`BRAK_API`. Napisz to wprost w raporcie, żeby nikt nie uznał pozycji za
szerszą niż jest.

**Kontrakt:**

```
GET /api/v8/pmo/initiatives-execution/control-kpis
      ?weekStart=<iso>&policyId=<id>

200 → {
  weekStart: string,
  families: Array<{
    family: 'plan-delivery' | 'blocked-work' | 'milestone' | 'initiative-risk'
          | 'dependency' | 'capacity' | 'decision-latency' | 'intervention-effectiveness',
    numerator: number | null,
    denominator: number | null,
    value: number | null,
    valueReason: 'UNKNOWN' | 'INSUFFICIENT_DATA' | 'DECISION_REQUIRED' | 'BRAK_ŹRÓDŁA' | null,
    drillDown: { kind: string, ids: string[] },   // DOKŁADNY zbiór rekordów, nie próbka
    sourceVersion: number,
    calculatedAt: string
  }>,                                             // ZAWSZE osiem elementów, w tej kolejności
  policy: {
    policyId: string | null,
    resolved: boolean,
    missingParameters: string[]                   // np. ['atRiskThresholdDays','impactWeights']
  },
  scopeCompleteness: 'FULL' | 'PARTIAL',
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **★ Tablica ma ZAWSZE osiem elementów, w kolejności z kontraktu.**
   Rodzina, której nie da się policzyć, **nie znika** — pojawia się
   z `value: null` i jawnym `valueReason`. Zniknięcie rodziny z odpowiedzi
   to cichy fałsz: konsument policzy „7 z 7 zielonych".

2. **★ Zero zaszytych progów (Z12).** Rodziny, które bez decyzji Piotra
   **nie mają wartości**, zwracają `valueReason: 'DECISION_REQUIRED'`
   i wpisują brakujący parametr do `policy.missingParameters`. Dotyczy to co
   najmniej:
   - `initiative-risk` — brak wag wpływu (`E-O4`);
   - `capacity` — brak progu saturacji i bufora (`E-O5`);
   - `decision-latency` — brak SLA decyzji (`E-O4`).

   **Parametry przyjmujesz, nie wymyślasz.** `policyId` wskazuje wiersz
   polityki; brak `policyId` albo brak wiersza → `resolved: false`
   i komplet `missingParameters`. **Nie ma trybu „policz z domyślnymi".**

3. **Migracja polityki — addytywna, PUSTA.** Plik
   `20260901_day14_execution_control_kpi_policy.sql`:
   `CREATE TABLE IF NOT EXISTS execution_control_kpi_policies (...)` —
   `policy_id`, `organization_id`, `name`, `parameters JSONB NOT NULL
DEFAULT '{}'::jsonb`, `created_at`, `updated_at`, `row_version`.
   **Zero `INSERT`.** Zero wiersza „default". Pusta tabela jest poprawnym
   stanem końcowym tego dyżuru — wypełni ją decyzja Piotra, nie Ty.
   Kompatybilność wstecz: nowa tabela, stary kod jej nie zna, nic się nie
   psuje (wpisz to do tabeli `KOMPATYBILNOŚĆ_WSTECZ`).

4. **`numerator`/`denominator` obowiązkowe wszędzie, gdzie `value` istnieje.**
   Kontrakt `06_EXECUTION` (`:264` DoD: „each KPI reconciles") wymaga
   rekoncyliacji. `value` bez licznika i mianownika = liczba, której nie da
   się sprawdzić. `denominator === 0` → `value: null` +
   `INSUFFICIENT_DATA`, **nigdy `0` i nigdy `NaN`**.

5. **`drillDown.ids` to DOKŁADNY zbiór**, z którego policzono licznik —
   nie próbka, nie pierwsze 50. Jeżeli zbiór jest bardzo duży, dokładasz
   `drillDown.truncated: true` i **wtedy** ograniczasz — ale to musi być
   widoczne w odpowiedzi. (`DEC-72` wprost wytknęła dniowi 11 „rejestry
   konfliktów przepuszczają wszystko" — kontrola ma być sprawdzalna.)

6. **Źródła danych — realne, wymienione imiennie w nagłówku pliku.**
   Punkt wyjścia do rozpoznania:
   `server/src/routes/executionControl.routes.ts` (sygnały ryzyka,
   opóźnień, przekroczeń budżetu, obejścia, alerty wydajności — lista tras
   w `:54-1026`), `server/src/routes/executionAnalytics.routes.ts:87-235`
   (predict/triage/dependencies/intelligence) oraz agregaty runtime-v1
   (`management-signals`, `interventions` —
   `initiativesExecutionRuntime.routes.ts:4433-4560`).
   **Dla każdej z ośmiu rodzin wpisujesz do raportu tabelę:
   rodzina → tabela/endpoint źródłowy → czy wystarcza → werdykt.**
   Rodzina bez źródła = `valueReason: 'BRAK_ŹRÓDŁA'`, **nie** wyliczenie
   „z czegoś podobnego".

7. **Znane, nienaprawiane znalezisko — powtórz je, nie ukrywaj.**
   `executionControl.routes.ts:1011` ma komentarz dokumentujący
   niezgodność kształtu, przez którą alerty wydajności wychodzą puste
   (odnotowane w raporcie dnia 11, znalezisko nr 1). Jeżeli Twoja rodzina
   `capacity` opiera się o to źródło, `scopeCompleteness` = `'PARTIAL'`
   i wpis do raportu. **Nie naprawiasz** — to inny zakres i inny właściciel.

8. **Tenant i widoczność:** wzorzec §2.3. Read-model **nigdy** nie liczy po
   rekordach spoza organizacji wołającego, także w mianowniku.
   To jest łatwe do przeoczenia: mianownik „wszystkie zadania" bywa liczony
   globalnie.

**DoD dodatkowo:** test „zawsze osiem rodzin, zawsze w tej kolejności,
także gdy baza jest pusta"; test „brak `policyId` → wszystkie rodziny
zależne od progów mają `DECISION_REQUIRED`, żadna nie ma liczby"; test
rekoncyliacji `numerator/denominator ↔ drillDown.ids.length` dla każdej
policzalnej rodziny; test `denominator === 0`; **negatyw tenanta na
mianowniku** (rekord innej organizacji nie zmienia `denominator`);
test `realdb` na komplecie ośmiu rodzin.

---

## §T. SEKCJA TESTY — pięć pozycji

### T.1 — ★ Jedyny dopuszczalny przypadek zmiany testu istniejącego

Zmiana istniejącego testu jest dopuszczalna **wyłącznie** wtedy, gdy
spełnione są **wszystkie trzy** warunki:

1. test asertuje zachowanie, które **ta instrukcja jawnie każe zmienić** —
   w praktyce jedyne takie miejsce to §X.3b pkt 1 (pusty zbiór źródeł);
2. zmiana **zaostrza** asercję albo dodaje nową, **nigdy** nie usuwa
   i nie osłabia istniejącej;
3. w raporcie jest wpis: `plik:linia → co asertował → co asertuje →
dlaczego to nie jest osłabienie`.

Każdy inny przypadek to **STOP** (§0.5). W szczególności: „test przechodził,
zanim dodałem walidację" to **nie** jest powód do zmiany testu — to jest
powód do sprawdzenia, czy walidacja jest w ogóle dopuszczalna (§X.3b pkt 2).

### T.2 — Kontrakty per nowy zasób

Każdy nowy endpoint dostaje osobny plik testowy z kompletem:
`happy` · `4xx` · `pusty stan` · `negatyw tenanta`. Testy tras Results
uruchamiasz z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
(§1.5 pkt 8) — inaczej negatyw tenanta dowodzi nieprawdy.

### T.3 — Negatywy tenanta jako osobny, jawny pakiet

Jeden plik zbiorczy: `tests/resultsVnext/day14/tenantIsolation.test.ts`
(oraz odpowiednik dla Execution). Dla **każdego** nowego endpointu jedna
asercja: „aktor z organizacji B nie dostaje danych organizacji A".

W raporcie tabela:

```
| Endpoint | Metoda | Aktor obcej org | Oczekiwane | Otrzymane |
```

Wiersz z wynikiem `200 + []` jest **czerwony**, nie zielony — pusty wynik
i odmowa to dwie różne odpowiedzi i test musi je rozróżniać.

### T.4 — Uczciwość wartości (`0` ≠ brak)

Jeden plik: `tests/resultsVnext/day14/honestValues.test.ts`, minimum osiem
asercji, po jednej na każde pole liczbowe wprowadzone tym dyżurem:

1. prawdziwe `0` zwracane jako `0` (nie `null`);
2. brak danych zwracany jako `null` **z niepustym powodem**;
3. `denominator === 0` → `value: null`, nigdy `NaN`, nigdy `Infinity`;
4. `direction` przy jednym pomiarze → `null` + `INSUFFICIENT_DATA`, nigdy
   `FLAT` (§K.1 pkt 3);
5. `staleness` bez kadencji → `UNKNOWN`, nigdy `CURRENT` (§O.2 pkt 2);
6. rodzina KPI bez progu → `DECISION_REQUIRED`, nigdy wyliczona liczba
   (§X.4 pkt 2);
7. `reconstructable: false` nie zwraca stanu bieżącego (§X.1 pkt 1);
8. `obligation` wywnioskowany nie jest podawany jako zapisany (§K.3 pkt 1).

### T.5 — Testy `realdb` i sprzątanie

Minimum jeden plik `*.realdb.test.ts` na sekcję (§S, §K, §O, §X).
Wzorzec i polityka skip: §2.5. W raporcie tabela:

```
| Plik realdb | Sekcja | Wiersze utworzone | Wiersze skasowane | Delta po przebiegu |
```

`Delta` musi być **0**. Niezerowa delta = zostawiłeś śmieci w bazie
= naruszenie „dane demo = twarz produktu".

---

## §R. SEKCJA REJESTR I DOWODY — dwie pozycje

### R.1 — Rejestry modułów do stanu faktycznego

Aktualizujesz **wyłącznie** wiersze dotyczące pozycji, które faktycznie
zrobiłeś, w dwóch plikach:

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md`

Zasady:

1. **Nie podnosisz statusu odbiorowego modułu.** Twoja praca jest
   backendem bez powierzchni — moduł **nie** staje się przez to
   `CLOSED_FINAL` ani „gotowy do odbioru". Dopisujesz fakt istnienia API
   i nic więcej.
2. **Nie kasujesz cudzych wpisów** ani wpisów `BRAK_API` dotyczących
   powierzchni. Wpis `BRAK_API` dotyczący **UI** zostaje — bo UI nadal nie
   ma. Zmieniasz go co najwyżej na `BRAK_UI_JEST_API` **z podaniem trasy**.
3. **`DEC-72` jest tu wiążąca:** „zawyżone JEST-y nie wchodzą do rejestru".
   Jeżeli masz wątpliwość, czy pozycja jest `JEST` czy `JEST_CZĘŚCIOWO` —
   wpisujesz `JEST_CZĘŚCIOWO`.

### R.2 — Komplet dowodów

W raporcie, w jednym miejscu:

- `git diff --name-only codex/m03-admin-20260824...HEAD` (pełna lista),
- lista commitów `git log --oneline codex/m03-admin-20260824..HEAD`,
- dowód idempotencji migracji (3 przebiegi) + dowód sprzątania kontenera,
- tabela `KOMPATYBILNOŚĆ_WSTECZ`,
- tabela `WERYFIKACJA_BRAKÓW` (§2.7),
- tabela zasięgu testów `PRZED/PO` (§0.4a),
- tabela `MIGRATION_PREPARED`,
- oświadczenie Z4/Z5, oświadczenie Z10 („zero plików `.tsx`, zero i18n"),
- lista STOP-ów.

**Zrzutów NIE MA i nie mają być** (Z10). Jeżeli w raporcie pojawi się
sekcja „Zrzuty" — złamałeś ograniczenie dyżuru.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~90 min, NIE pomijasz)

1. Sprawdzenie markera i bazy (§0.1 pkt 1–3).
2. **Sprawdzenie nieścalonych gałęzi dni 8/11** (§0.1 pkt 4) — wynik do
   raportu.
3. Utworzenie gałęzi i worktree (§0.1 pkt 5–6).
4. **Odczyt raportów dni 8 i 11 przez `git show`** (§1.2) — całość, nie
   fragmenty. To są Twoje wymagania.
5. Weryfikacja mapy technicznej (§2.1) — liczniki linii do raportu.
6. **Tabela `WERYFIKACJA_BRAKÓW`** (§2.7) — komplet komend, wyniki do
   raportu. Każde niespodziewane trafienie = zatrzymanie i koordynacja.
7. **Pomiar stanu wejściowego testów** (§0.4a pkt 3) — pięć katalogów,
   wyniki zapisane.
8. Bramka JSX na trzech plikach klienckich (§0.2, koniec sekcji).
9. `docker ps -a` i `docker volume ls` **przed** czymkolwiek — spis
   zastanych zasobów do raportu (nie usuwasz ich).
10. Podniesienie własnego kontenera PG na porcie 5442 i baseline migracji.

**Jeżeli którykolwiek krok 1, 2, 5, 6 wypadnie inaczej niż opisano — nie
zaczynasz kodu.** Zakładasz raport, opisujesz rozbieżność, pytasz.

### Blok 1 — Results, fundament odczytu (§S)

`S.1` → `S.2`. Najpierw wspólna funkcja dopasowania (`textMatch.ts`), potem
router wyszukiwania, potem `q=` w trzech rejestrach. Odwrotna kolejność
gwarantuje dwie różne semantyki dopasowania.

### Blok 2 — Results, karta KPI (§K)

`K.1` → `K.2` → `K.3`. Trend pierwszy (najwięcej wspólnego z istniejącym
`listMeasurements`), historia druga (wzorzec z OKR), obowiązek trzeci
(najmniej niewiadomych — schemat już jest).

### Blok 3 — Results, OKR (§O)

`O.1` → `O.2`. `O.1` rozszerza istniejące repozytorium i musi udowodnić
rekoncyliację z agregatem organizacyjnym, zanim dołoży się cokolwiek
nowego.

### Blok 4 — Execution, fundament źródeł (§X.1 → §X.3)

`X.1` (rekonstrukcja `as-of`) → `X.3a` (read-model źródeł, korzysta z X.1)
→ `X.3b` (walidacja + mapowanie lifecycle).
**Ta kolejność jest wiążąca**: `X.3a` bez `X.1` musiałby liczyć źródła
„na teraz", czyli dokładnie ten defekt, który zamykamy.

### Blok 5 — Execution, eksport i sterowanie (§X.2, §X.4)

`X.2` (XLSX + izolacja tenanta na pipeline eksportowym) → `X.4` (osiem
rodzin). `X.4` jest ostatni, bo ma najwięcej niewiadomych i najwięcej
`DECISION_REQUIRED` — nie chcesz, żeby jego STOP-y zablokowały resztę.

### Blok 6 — domknięcie (obowiązkowo, ~90 min, NIE pomijasz)

1. Testy `realdb` — pełny przebieg na własnym kontenerze (§T.5).
2. Dowód idempotencji migracji, trzy przebiegi (§0.3 pkt 6).
3. **Sprzątanie kontenera i wolumenów, z dowodem pustego listingu.**
4. Pomiar zasięgu `PO` i tabela delty (§0.4a pkt 4).
5. `bash scripts/check-list-canon.sh` — pełny skan, baseline **niezmieniony**.
6. Bramka Z10: `git diff --name-only codex/m03-admin-20260824...HEAD | grep -E '\.tsx$|public/locales'`
   → **oczekiwany wynik: PUSTY**. Niepusty = dyżur do odrzucenia, napisz to
   w raporcie zamiast ukrywać.
   6a. **Powtórna weryfikacja markera** — ten sam warunek co w Bloku 0, żeby
   wykluczyć, że w trakcie dyżuru pracowałeś na przesuniętej bazie:
   ```bash
   git merge-base --is-ancestor f0caf6a821 HEAD && echo "MARKER NADAL OK" || echo "MARKER ZGUBIONY"
   ```
   Wynik `MARKER ZGUBIONY` = **STOP** i wpis do raportu; nie „naprawiasz"
   tego rebasem.
7. `R.1` — rejestry.
8. `R.2` — komplet dowodów.
9. Raport.

### Zasada nadrzędna kolejności

Bloki 1–5 są **niezależne od siebie** poza łańcuchem `X.1 → X.3a → X.3b`.
Jeżeli którykolwiek blok utknie na STOP-ie — **przechodzisz do następnego**,
a nie improwizujesz. Dyżur zakończony z czterema zrobionymi blokami
i dwoma uczciwymi STOP-ami jest **lepszy** niż dyżur z sześcioma blokami,
w którym dwa opierają się na zgadniętych progach.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka: `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md`

### 9.1. Szablon

````markdown
# Results + Execution dzień 14 — raport dyżuru backendowego <data>

Baza: `codex/m03-admin-20260824 @ <SHA tipa>`
Marker: `f0caf6a821` — POTWIERDZONY / BRAK
Gałąź robocza: `codex/backend-day14-<data>`
Worktree: `/private/tmp/consultify-backend-day14`
Porty użyte: PG 5442 · dev-render: ŻADEN (dyżur backendowy)
Poziom raportowany: <ZROBIONE_WG_DoD | CZĘŚCIOWO / STOP-Y JAWNE | ZATRZYMANY>

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie otwierałem, nie czytałem i nie kopiowałem katalogu
`/Users/piotrwisniewski/Developer/Consultify`. Nie sięgałem po żadną gałąź
`codex/preserve-*` ani po cudze worktree. **TAK / NIE**

## Oświadczenie ZERO UI (Z10)

`git diff --name-only codex/m03-admin-20260824...HEAD | grep -E '\.tsx$|public/locales'`
Wynik: <PUSTY / lista>
Zero plików `.tsx`, zero kluczy i18n, zero zrzutów: **TAK / NIE**

## Oświadczenie FREEZE (Z8, DEC-65)

Zero operacji chmurowych, zero `git fetch/push`, zero Railway, zero zdalnych
migracji: **TAK / NIE**

## Warunki wstępne — wynik sprawdzenia

| Sprawdzenie | Oczekiwane | Wynik | Dowód |

## Stan gałęzi dni 8 i 11 (§0.1 pkt 4)

| Gałąź | ANCESTOR / NIE-SCALONE | Konsekwencja |

## WERYFIKACJA_BRAKÓW (§2.7)

| Komenda | Oczekiwane | Wynik | Werdykt |

## Weryfikacja mapy technicznej (§2.1)

| Plik | Oczekiwane linie | Wynik |

## Pozycje — tabela zbiorcza

| Pozycja | Zakres | Status | Commit | Testy | Migracja | Uwagi |
| S.1 | endpoint wyszukiwania Results | | | | | |
| S.2 | `q=` w trzech rejestrach | | | | | |
| K.1 | trend KPI | | | | | |
| K.2 | historia i rodowód KPI | | | | | |
| K.3 | następny obowiązek KPI | | | | | |
| O.1 | attention w zasięgu Setu | | | | | |
| O.2 | agregat check-inów Setu | | | | | |
| X.1 | rekonstrukcja as-of (E-O6) | | | | | |
| X.2 | eksport XLSX (E-O7) | | | | | |
| X.3 | realne sources + mapowanie lifecycle | | | | | |
| X.4 | osiem rodzin KPI Control | | | | | |
| T.1–T.5 | testy przekrojowe | | | | | |
| R.1–R.2 | rejestr i dowody | | | | | |

## Tabele werdyktów — główny produkt pozycji

### S.1 — rodzaje objęte wyszukiwaniem

| Rodzaj | Objęty | Kolumny dopasowania | Uwaga |

### K.3 — źródła następnego obowiązku

| Wariant | Źródło | Pokryty | Dowód |

### O.1 — rekoncyliacja Set ↔ organizacja

| Sygnał | Suma po Setach | Agregat org | Zgodne |

### X.1 — rekonstruowalność źródeł

| sourceType | Rekonstruowalny | Powód luki |

### X.3 — mapowanie lifecycle → eksport

| Stan runtime-v1 | Eksport dozwolony | Uzasadnienie |

### X.4 — osiem rodzin: źródło i werdykt

| # | Rodzina | Źródło danych | Wystarcza | value | valueReason |
| 1 | plan-delivery | | | | |
| 2 | blocked-work | | | | |
| 3 | milestone | | | | |
| 4 | initiative-risk | | | | |
| 5 | dependency | | | | |
| 6 | capacity | | | | |
| 7 | decision-latency | | | | |
| 8 | intervention-effectiveness | | | | |

## Migracje

| Plik | Typ zmiany | MIGRATION_PREPARED | Idempotencja | Dowód |

### KOMPATYBILNOŚĆ_WSTECZ (DEC-65, wspólna baza)

| Obiekt | Co robi ZAMROŻONE DEMO, gdy to zobaczy | Co robi NOWY KOD, gdy tego nie ma |

### Dowód idempotencji i sprzątania

```text
<wklejone wyniki trzech przebiegów + docker rm/volume rm + puste listingi>
```
````

## Testy

### Testy własne

| Plik | Testy | Wynik | realdb |

### Zasięg (§0.4a)

Deklaracja: **ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY**

| Katalog konsumenta | PRZED | PO | Delta | Werdykt |

### Negatywy tenanta (§T.3)

| Endpoint | Metoda | Aktor obcej org | Oczekiwane | Otrzymane |

### Uczciwość wartości (§T.4)

| # | Asercja | Wynik |

### Sprzątanie realdb (§T.5)

| Plik realdb | Wiersze utworzone | Skasowane | Delta |

## Znaleziska — nie naprawiane

| # | Plik:linia | Co znalazłem | Dlaczego nie naprawiłem |
| 1 | `managementReportsService.ts:1173` | `bulkExport` zwraca ścieżkę do zipa, którego nie tworzy | Poza zakresem; §1.5 pkt 3 |
| 2 | `executionControl.routes.ts:1011` | shape mismatch opróżnia capacity alerts | Inny właściciel; §X.4 pkt 7 |
| 3 | `getReportById` bez org — pozostali wołający | <lista z grepa> | Naprawiono tylko ścieżkę eksportu; reszta = osobny zakres |

## Korekty wobec instrukcji

<rozbieżności liczników, ścieżek, nazw — z dowodami>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

Powód:
Dowód:
Czego brakuje, żeby ruszyć:
Co zrobiłbym, gdyby zapadła decyzja X:
Stan:

## Czego nie zrobiłem i dlaczego

## Gotowość

Gotowe do przeglądu kodu i uruchomienia testów przez nadzorcę: **TAK / NIE**
Powierzchni wizualnych **nie budowano** — zgodnie z ★ KRYTYCZNYM
OGRANICZENIEM pkt 1. Flagi **nie zmieniano**.

```

### 9.2. Czego w raporcie NIE piszesz

- „gotowe do pokazania właścicielowi" — **nigdy** (CLAUDE.md reguła 7);
- „gotowe do włączenia flagi" — **nigdy** (`DEC-72`);
- „testy przeszły, więc działa" — testy przeszły to testy przeszły;
- `JEST` tam, gdzie jest `JEST_CZĘŚCIOWO` (`DEC-72`: zawyżone `JEST`-y nie
  wchodzą do rejestru);
- „zastane FAIL" bez dowodu z pomiaru wejściowego (`DEC-73`).

---

## 10. PODSUMOWANIE — jedenaście pozycji, jedno zdanie każda

| # | Pozycja | W jednym zdaniu |
| --- | --- | --- |
| S.1 | Search Results | Jedna tenantowana trasa `/api/vnext/results/search`, przeszukująca KPI/OKR/ROI przez CTE widoczności, z kursorem i jawnym `unavailableKinds` |
| S.2 | `q=` w rejestrach | Jedno opcjonalne pole w trzech schematach listy, ta sama semantyka dopasowania co S.1, brak `q` = zachowanie bajt-w-bajt jak dziś |
| K.1 | Trend KPI | Szereg pomiarów + kierunek liczony wobec geometrii celu przez istniejący ewaluator; `<2` pomiary = `INSUFFICIENT_DATA`, nigdy `FLAT` |
| K.2 | Historia KPI | Jedna oś czasu z `rvn_platform_events`, kształt 1:1 z `/okr/sets/:setId/history`, kody maszynowe zamiast tekstu |
| K.3 | Następny obowiązek | Read-model nad istniejącym `rvn_platform_obligations` + `measurement_frequency_days`; obowiązek zapisany i wywnioskowany w osobnych polach |
| O.1 | Attention Setu | Ten sam read-model, filtr `setId` **wewnątrz SQL**, rekoncyliacja z agregatem organizacyjnym udowodniona testem |
| O.2 | Agregat check-inów Setu | Read-only podsumowanie per KR + rollup; brak kadencji = `UNKNOWN`, nigdy `CURRENT` |
| X.1 | Rekonstrukcja as-of | Deterministyczne odtworzenie źródeł na `asOf` ze zdarzeń albo uczciwe `reconstructable: false` z `gaps` |
| X.2 | Eksport XLSX | Gałąź `exceljs` w istniejącym pipeline eksportowym + naprawa izolacji tenanta na tej ścieżce; zero AI |
| X.3 | Realne sources | Read-model źródeł + zamknięcie luki „pusta tablica przechodzi walidację" + jawne mapowanie `PUBLISHED` → eksport wg `DEC-63(2)` |
| X.4 | Osiem rodzin KPI Control | Zawsze osiem elementów w kontraktowej kolejności, `numerator/denominator/drillDown`, progi **przyjmowane z polityki**, brak polityki = `DECISION_REQUIRED` |

**Jedno zdanie na cały dyżur:** budujesz to, po co dni 8 i 11 uczciwie
sięgnęły i czego nie zastały — i nie budujesz niczego, co widać.
```
