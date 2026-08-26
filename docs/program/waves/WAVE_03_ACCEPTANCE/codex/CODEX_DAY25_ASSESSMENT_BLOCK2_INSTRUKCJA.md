# INSTRUKCJA DYŻURU nr 25 — Codex — „Assessment/Ocena BLOK 2: dokończenia po dniu 20 — martwy blok ról v1, `@ts-nocheck` w partnerze AI, dowód ścieżki TO-BE, migawka rewizji kontraktu raportu, nieosiągalny agregator, cztery długi P2 z odbioru"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–24. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **kontynuacją dyżuru nr 20** (moduł Ocena/Assessment, mechanika
tylna). Dzień 20 został **odebrany** (`DEC-2026-08-26-119`), dostał cztery FIX-y
i został **SCALONY** do `codex/m03-admin-20260824` (`DEC-2026-08-26-122`).
Scalone: jeden model 7 osi klient↔serwer, słownik 4 kodów „Pomiń", deterministyczny
kontrakt raportu 7 rozdziałów, pakiet testów realnego routera.

**Twoim zakresem jest DOKŁADNIE to, czego dzień 20 uczciwie NIE dowiózł** —
pozycje wpisane do rejestru jako „kontynuacja dyżurowa" (`DEC-119` i `DEC-122`:
A.2, B.2, C.1, E.2, F.1, R.1) **plus cztery długi P2** postawione przez odbiorcę
przy odbiorze dnia 20. Nic więcej. Nie wracasz do pozycji już scalonych
(B.1, D.1, D.2, E.1) inaczej niż przez **czytanie** — one są zamknięte.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Nie dotykasz frontu. W ogóle. Nawet „jednej linii importu" w `src/`.**

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM.** Nie tworzysz, nie zmieniasz,
   nie usuwasz, nie „przygotowujesz" niczego w `src/`. Wyjątków **nie ma**.
   W szczególności **NIE przepinasz frontu na zapis kodu „Pomiń"** (`DEC-122`
   zostawia to jako otwartą pozycję koordynacyjną) — to robotnik frontowy.
2. **Nie podpinasz 26 endpointów AI do UI.** Panele `AIAssessmentSidebar.tsx`,
   `AISuggestionPanel.tsx`, `AssessmentAxisWorkspace.tsx` mają zero importerów.
   Ty ich **nie usuwasz** i **nie podpinasz** — czekają na front po prototypie.
3. **Nie generujesz treści modelem. Zero LLM w tym dyżurze.** Pozycja B.2 dotyka
   pliku, który _woła_ Gemini — Ty poprawiasz **typy**, nigdy okablowanie
   dostawcy. Wpięcie klucza / provider = STOP.
4. **Nie renderujesz PDF.** Eksport jako **plik** jest poza zakresem; E.2 dotyczy
   **kontraktu** (ta sama rewizja dla widoku i eksportu), nie renderera.
5. **★ Wszystko, co budujesz, musi być realne.** Trasa bez ścieżki zapisu = STOP,
   nigdy „na razie zostawiam". Brak API → wpis `BRAK_API`, nie trasa-widmo.
6. **★ DEC-65 — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo. Migracje =
   `MIGRATION_PREPARED`, addytywne, kompatybilne wstecz, z dowodem idempotencji
   na **jednorazowym lokalnym kontenerze**.
7. **★ Nie zmieniasz wartości domyślnych flag wizualnych Assessmentu.**
   `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1`
   są dziś domyślnie OFF i **po Twoim dyżurze mają być dalej OFF** — to jawna
   decyzja właściciela. Twoim produktem jest **dowód, że ścieżka działa**, nie
   przełącznik.
8. **Odbiór wizualny = nadzorca, po dyżurze.** W raporcie piszesz „gotowe do
   odbioru przez nadzorcę", **nigdy** „gotowe do pokazania właścicielowi".

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: c7647e9a23**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor c7647e9a23 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/assessment-fixes-*`, `codex/assessment-day20-*`
   ani z żadnej gałęzi dnia 17–24. Załóż raport, wpisz pozycję STOP z wynikiem
   obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. Rebase
   w trakcie dyżuru: **ZAKAZANY**.

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu. **Każda z tych komend
   ma w §1.7 podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", nie do improwizacji:**

   ```bash
   # (a) blok ról/wniosków v1 — sedno pozycji A.2
   grep -n "^router\.\(get\|post\|put\|patch\|delete\)" server/src/routes/assessment/assessment-workflow.routes.ts | awk -F: '$1>1700'

   # (b) @ts-nocheck w partnerze AI — sedno pozycji B.2
   head -1 server/src/services/aiAssessmentPartnerService.ts

   # (c) TO-BE w jądrze — sedno pozycji C.1
   grep -n "target_level" server/src/method-core/outputs/EventDerivedOutputBridge.ts

   # (d) kontrakt raportu bierze NAJNOWSZY output — sedno pozycji E.2
   grep -n "outputs\[0\]\|listOutputsBySession\|listActive" server/src/services/assessment/assessmentReportContractService.ts

   # (e) nieosiągalny agregat — sedno pozycji F.1
   grep -rn "assessmentDomainRoutes" server/src ; echo "^^ oczekiwane: PUSTE (patrz ERRATA §1.2)"
   grep -rn "assessments.routes" server/src --include='*.ts'

   # (f) długi P2
   grep -rn "superseded_by" server/src --include='*.ts' | grep -v __tests__ ; echo "^^ oczekiwane: PUSTE"
   grep -n "res.status(201).json({ skipReason })" server/src/routes/method-core.routes.ts
   grep -n "requireSessionWriteRole(res" server/src/routes/method-core.routes.ts
   ```

   **Brak (a), (b) albo (c) = STOP całego dyżuru** — pracujesz na złej bazie.

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md          # w chwili wystawienia: 177
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY20_REPORT_20260826.md          # w chwili wystawienia: 335
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md   # w chwili wystawienia: 134
   grep -n "DEC-2026-08-26-119\|DEC-2026-08-26-122" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   ls docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY20_ASSESSMENT_BACKEND_INSTRUKCJA.md
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestry rosną) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   `DEC-119` i `DEC-122` się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/assessment-day25-<data> c7647e9a23
   git worktree add /private/tmp/consultify-assessment-day25 codex/assessment-day25-<data>
   cd /private/tmp/consultify-assessment-day25
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Dlaczego                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/assessment-day25-<data>`                                                                                                                                                                                                                                                                                                    | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                              |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/assessment-day20-*` / `codex/assessment-fixes-*`                                                                                                                                                                                                                                                                                                         | `demo` = święta baza; tamte gałęzie są zamknięte i scalone                                                                     |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                                                                     | Krach 3/4 powstał tak; `DEC-95`                                                                                                |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                                                                        | Wymagania są w rejestrze uwag i decyzjach                                                                                      |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                                                                                                                                  | Chroniony, brudny worktree właściciela                                                                                         |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-assessment-day20`, `consultify-day20-fixes`, `consultify-day2*-instrukcja`, `consultify-audits-*`, `consultify-m03-ledger`)                                                                                                                                                                                                                                                           | Cudze worktree, część w użyciu                                                                                                 |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ: 3021, 5000, 5037, **5432**, **5474** (`codex-tools-audit-pg`), **5493** (`cx-day22-pg`), **5495** (`cx-odbior-day21-pg`), 6379, 7000, 11434. **Twój kontener PG = 5499**; lokalny runtime, jeśli konieczny — **4332/4333**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu                                                                                                            | Cudze dyżury pracują równolegle                                                                                                |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                                                                                                                                     | Produkcja/demo poza zakresem                                                                                                   |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **`DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur.** Procedura: zatrzymaj komendę → ustal skutek (czy było realne połączenie i czy był ZAPIS) → zapisz ustalenie w raporcie → przypnij env → **KONTYNUUJ pozycję**. **Twardy STOP całego dyżuru TYLKO przy stwierdzonym realnym ZAPISIE do bazy spoza dyżuru**                 | „dane demo = twarz produktu" (`DEC-65`); poprzednia wersja Z9 zabijała dyżur i marnowała dowieziony postęp                     |
| **Z10** | **Zero nowych flag. Zero zmian wartości domyślnej istniejącej flagi** — w szczególności `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1` zostają OFF                                                                                                                                                                                                                                                                                      | CLAUDE.md reguła 9 + ★ pkt 7                                                                                                   |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/assessment/*`                                                                                                                                                                                                                                                                                                                        | Gramatyka zaakceptowana; a nadto całe `src/` jest poza zakresem (Z17)                                                          |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY25_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportu dnia 20 NIE edytujesz**                                                                                                                                                     | Repo tonie w dokumentach-duchach; raport dnia 20 jest zamkniętym dowodem odbiorowym                                            |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie                                                                                                                                                                                                                                                                                                                                                              | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                                     |
| **Z14** | **Nie budujesz generowania treści modelem. ZERO LLM.** W B.2 poprawiasz **typy**, nie okablowanie Gemini; nie wpinasz klucza, nie zmieniasz `initializeModel()`, nie wołasz `llmService`                                                                                                                                                                                                                                                                                 | Silnik AI = moduł agenta, ostatni w programie; ★ pkt 3                                                                         |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** Kanon Assessmentu: „nie wiem" **nie jest liczone ani jako zero, ani jako sukces"; `mode: 'FALLBACK'` w partnerze AI jest **uczciwym stanem**, nie błędem do naprawienia                                                                                                                                                                                                                            | Uczciwy pusty stan > udawany ekran                                                                                             |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`. Wolno **czytać** i **cytować**                                                                                                                                                                                                                                                                                     | Model uprawnień naprawiany in-house                                                                                            |
| **Z17** | **★ Zakaz wszystkiego poza serwerową mechaniką Assessmentu** — z imiennymi wyjątkami z ramki poniżej. **CAŁE `src/` jest zakazane bez wyjątku.**                                                                                                                                                                                                                                                                                                                         | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                                                 |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `tests/utils/assessmentMocks/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                    | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                                       |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez KOMPLETU CZTERECH ZMIENNYCH env W TEJ SAMEJ LINII KOMENDY** (`DB_TYPE`, `NODE_ENV`, `RUN_DB_TESTS`, **`MOCK_DB=false`**) + jawny `DATABASE_URL` wskazujący kontener tego dyżuru. Kolejność Bloku 0 = NAJPIERW kontener + PEŁNE migracje, DOPIERO potem jakikolwiek pomiar. **Do raportu obowiązkowy dowód celu połączenia (`SELECT current_database(), inet_server_port()`) ORAZ liczba SKIPPED w każdym przebiegu** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie; dzień 23 pokazał, że `skipIf` daje „0 failed" przy 60 SKIPPED |
| **Z20** | **★★ DoD wymaga dowodu OSIĄGALNOŚCI, nie istnienia kodu** (`DEC-104`). Jeżeli pozycja deklaruje „usunięto martwy kod" albo „dodano funkcję", **dowodem jest ŚCIEŻKA WYWOŁANIA od realnego wejścia** (zamontowana trasa), **nie sam plik**. Dla usunięć dowodem jest **pusty grep po CAŁYM repo** (nie tylko `src/`) sprzed usunięcia + zielone testy po                                                                                                                  | Zawyżenie wykryte osobiście przez nadzorcę na tipie m03; **w tym dyżurze to jest pułapka nr 1 — patrz ERRATA §1.2 poz. 1**     |
| **Z21** | **★★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-107`). Każda pozycja z zewnętrznym wywołaniem **MUSI mieć co najmniej jeden test DOMYŚLNEGO OKABLOWANIA** — bez podstawionych `dependencies`, bez `injectClient()`, na produkcyjnym eksporcie routera i produkcyjnych singletonach                                                                                                                                                            | Wcześniejszy dyżur miał 8/8 zielonych testów warstwy, która nie mogła zadziałać                                                |
| **Z22** | **★★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-108`). Trasa **nie może zwracać sukcesu i wywoływać skutku na zewnątrz**, jeżeli w bazie nic się nie zmieniło. Operacja niewykonalna → **4xx z maszynowym kodem, ZERO efektu zewnętrznego**. **W tym dyżurze dotyczy wprost E.2**: brakujący rozdział kontraktu = jawna walidacja 4xx, nigdy cichy `200` z dziurą                                                                                                       | `DELETE /:id/occurrence` zwracał 200 bez zmiany w bazie i rozsyłał CANCEL                                                      |
| **Z23** | **★★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-108`). Raport podaje wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem na czerwone **ZASTANE** (zmierzone na markerze, PRZED Twoim pierwszym commitem) i **WPROWADZONE przez dyżur**, **z liczbą SKIPPED**. **Podanie zawężonego wyboru = naruszenie**                                                                                                                                                                             | Deklarowane „98/98 PASS" było wyborem; w zakresie własnej instrukcji było 164/167                                              |

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**          (llmApi, server/database, node-cron, nodemailer, @google/generative-ai, aws-sdk-client-s3)
tests/utils/assessmentMocks/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.**
`server/src/database/Database.ts` przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1`
podstawia **mock DB** i cały pakiet „przechodzi" przeciwko niczemu. Dodatkowo
pakiet dnia 20, na którym budujesz
(`server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts:10-15`),
jest opakowany w:

```ts
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
describe.skipIf(!REAL_DB)(...)
```

— **przy niekompletnym env cały pakiet raportuje SKIPPED, nie FAIL.** „0 failed"
przy 11 SKIPPED to nie jest dowód. Dlatego **każde** uruchomienie testu
dotykającego bazy ma **cztery** zmienne w tej samej linii:

```bash
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" \
npx vitest run <plik> --no-file-parallelism
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day25-pg psql -U postgres -d cx_day25 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet z `skipIf` i 0 uruchomionych testów
jest `NIE_ZMIERZONY`, nie `PASS`.**

**★ Ostrzeżenie do Z9/Z19.** W chwili wystawienia tej instrukcji port **5432
NASŁUCHUJE**, a w Dockerze żyją trzy cudze kontenery PG (5474, 5493, 5495). Nie
opieraj bezpieczeństwa na założeniu „i tak się nie połączy" — opieraj je na
**jawnym `DATABASE_URL` w każdej linii**. Jeśli mimo to komenda pójdzie gdzie
indziej: procedura Z9 (zatrzymaj → ustal skutek → zapisz → przypnij env →
kontynuuj).

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/assessment/assessment-workflow.routes.ts       (WYŁĄCZNIE pozycja A.2)
  server/src/routes/assessment/assessments.routes.ts               (WYŁĄCZNIE pozycja F.1 — usunięcie)
  server/src/routes/method-core.routes.ts                          (TYLKO trasy Assessmentu: skip-reasons, report-contract, oraz C.1)
  server/src/services/assessment/**                                (+ __tests__ obok)
  server/src/services/aiAssessmentPartnerService.ts                (WYŁĄCZNIE pozycja B.2)
  server/src/services/aiAssessmentReportGenerator.ts               (TYLKO jeśli wymusza to B.2)
  server/src/services/aiAssessmentFormHelper.ts                    (TYLKO jeśli wymusza to B.2)
  server/src/services/demo/demoPrincipalGuard.ts                   (★ LICENCJA WĄSKA — patrz §A.2 pkt 6; TYLKO usunięcie wpisów allowlisty wskazujących na usunięte handlery, i TYLKO jeśli usuwasz te handlery)
  server/migrations/2026116x_assessment_day25_*.sql                (NOWE pliki, przedział §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY25_REPORT_20260826.md          (jedyny nowy dokument)
  tests/unit/assessment/**  ·  tests/integration/assessment*       (NOWE pliki)
  tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts         (★ TYLKO synchronizacja migawki allowlisty przy A.2, z wpisem „przed/po" §0.4a pkt 5)
  tests/unit/backend/routes/h64-failsoft-batch6.test.ts            (★ TYLKO jeśli A.2 usuwa testowane handlery — patrz §A.2 pkt 6; domyślnie NIE DOTYKASZ)

IMIENNE WYJĄTKI (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu/schematu):
  server/src/method-core/contracts/events.ts                       (CZYTASZ kontrakt; ZMIANA = STOP)
  server/src/method-core/MethodEventStore.ts · MethodSessionService.ts   (WOŁASZ)
  server/src/method-core/outputs/**                                (WOŁASZ; zmiana = STOP, chyba że C.1 dowiedzie realnej luki — wtedy wpis i decyzja nadzorcy)
  server/src/routes/assessment-workflow-v2.routes.ts               (CZYTASZ — tam są odpowiedniki semantyk v1)
  server/src/data/drdStructure.ts                                  (CZYTASZ — zamknięte przez B.1 dnia 20)
  server/src/services/assessmentPermissionService.ts               (CZYTASZ — A.2 usuwa tylko wołających, nie serwis)

NIE WOLNO:
  ★ CAŁE src/                                                      ← bez wyjątku
  server/src/routes/index.ts                                       ← ★ ZMIANA od dnia 20: barrel jest CROSS-MODULE (patrz ERRATA §1.2 poz. 1); NIE usuwasz go i nie edytujesz
  server/src/services/**/effectiveAccessService*                   ← Z16
  server/src/services/audits/**                                    ← cudzy moduł (WOLNO CZYTAĆ reportRenderer.ts jako wzorzec)
  server/src/routes/assessment/assessment-ai.routes.ts             ← 26 tras AI; B.2 NIE zmienia tras, tylko typy serwisu
  server/src/data/drdStructure.ts (zapis) · server/src/services/report/**  ← zamknięte przez dzień 20
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  server/migrations/2026112x_*.sql i wcześniejsze                  ← TYLKO ODCZYT
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  refactor(assessment): drop the dead v1 role block with a repo-wide empty-grep proof (A.2)
  test(assessment): characterisation harness for three AI partner routes (B.2-pre)
  refactor(assessment): type the AI partner service without changing behaviour (B.2)
  test(assessment): production-path proof for the TO-BE target level (C.1)
  feat(assessment): report contract pinned to one immutable output revision (E.2)
  chore(assessment): remove the unreachable assessment route aggregator (F.1)
  fix(assessment): idempotent skip-reason replay answers 200, not 201 (P2.2)
  fix(assessment): supersession backlink is derived, never a silent empty column (P2.1)
  docs(assessment): honest verdicts for the attachments gap and the report read gate (P2.3/P2.4)
  docs(assessment): raise 04_ASSESSMENT acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc -p` repo ani pełny `vitest`**,
  z JEDNYM wyjątkiem: pozycja B.2 **wymaga** celowanego `tsc` na projekcie
  serwerowym z filtrem do jednego pliku (§B.2 pkt 2).
- **★ KAŻDA nowa lub zmieniona powierzchnia = minimum CZTERY testy zachowania**:
  happy · ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**.
- **★ Z21 — test domyślnego okablowania.** Wzorzec masz gotowy i przetestowany:
  `server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts`
  (bootuje produkcyjny eksport `method-core.routes.ts`, produkcyjne singletony,
  prawdziwe JWT, prawdziwy PG, zero wstrzykniętych zależności). **Kopiujesz ten
  wzorzec, nie wymyślasz nowego.**
- **Typy punktowo** (`npx esbuild <plik> --loader:.ts=ts --outfile=/dev/null`).
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ `fallback:false` OBOWIĄZKOWO** na każdym `DbPromise` dotykającym tabel
  Assessmentu. Brak migracji ma być **głośnym błędem**, nie pustą listą.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `COMMENT ON COLUMN`, `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
     **`DROP COLUMN superseded_by` jest ZAKAZANY** — patrz §P2.1.
  2. **★★ NUMERACJA — MASZ PRZYDZIELONY PRZEDZIAŁ: `20261160`–`20261169`.**
     Reguła „najwyższy + 1" obowiązuje **WYŁĄCZNIE WEWNĄTRZ Twojego przedziału**.
     **NIGDY nie licz „najwyższy zastany + 1" bez przedziału — to była
     bezpośrednia przyczyna kolizji dnia 17/18** (`DEC-107`: „ŹRÓDŁEM KOLIZJI
     BYŁA INSTRUKCJA"). Zastane najwyższe w repo to `20261123`; **to NIE jest
     Twój punkt startu.**
     **Obowiązkowe sprawdzenie PRZED KAŻDYM plikiem:**
     ```bash
     ls server/migrations | grep '^202611[5-7]'   # co już zajęte w okolicy Twojego przedziału
     ls server/migrations | grep '^20261160'      # MUSI być PUSTE przed utworzeniem pliku
     ```
     Nazwa: `<numer>_assessment_day25_<temat>.sql`. Twój pierwszy wolny numer to
     **`20261160`** — potwierdź komendą, nie pamięcią.
  3. **★ ZERO kluczy obcych** do tabel Assessmentu/method-core. Tenant
     i istnienie rodzica sprawdzasz **w warstwie aplikacji**.
  4. **Nie rozszerzasz leniwych bootstrapów tabel** (`ensure*Tables()`).
  5. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (`DEC-65`) — warunek oddania
     każdej pozycji z migracją.** Jednorazowy kontener, trzy przebiegi, wyniki
     do raportu. **Sprzątanie kontenera I wolumenów jest obowiązkowe.**
  6. **★ Ten dyżur prawdopodobnie NIE POTRZEBUJE ŻADNEJ MIGRACJI.** Przedział
     jest zarezerwowany **na wypadek**, gdyby P2.1 wymagał `COMMENT ON COLUMN`
     albo E.2 wymagał kolumny migawki. **Zero migracji jest poprawnym wynikiem
     — nie dodawaj migracji „na wszelki wypadek".**

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie jedenaście**:

1. **Realne dane** — odczyt i zapis idą do backendu, `fallback:false`. Zero
   mocków/`sampleData` jako źródła prawdy. Pusty wynik = uczciwy pusty stan.
2. **Zapis z readbackiem** — po `POST/PUT/PATCH/DELETE` test ponownie odczytuje
   stan z serwera **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap.** Brak API → wpis `BRAK_API`, nie trasa-widmo.
4. **★ Z22 — zero atrapy z zewnętrznym skutkiem.** Trasa nie zwraca `2xx`, gdy
   w bazie nic się nie zmieniło; niewykonalna operacja = `4xx` z maszynowym
   kodem i **zerowym** efektem zewnętrznym.
5. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
6. **★ Z21 — co najmniej jeden test DOMYŚLNEGO OKABLOWANIA** dla każdej pozycji
   wołającej cokolwiek spoza własnego modułu (bez wstrzykniętych `dependencies`).
7. **★ Test HTTP realnego routera** przez `supertest`, na **realnym PG**, z bootem
   realnego pliku tras (zamockowany wyłącznie `auth.middleware` i `Logger`).
   Test na zmockowanym serwisie **nie zastępuje** tego wymogu.
8. **★ Z20 — dowód OSIĄGALNOŚCI**, nie istnienia kodu:
   ```
   realne wejście (metoda + URL, jaki wychodzi z przeglądarki)
     → montaż w Gateway.ts (plik:linia)
     → router (plik:linia)
     → serwis kanoniczny (plik:linia)
     → tabela + kolumna
   ```
   Dla pozycji „usunięto martwy kod" — dowodem jest **pusty grep po CAŁYM repo**
   (`server/`, `src/`, `tests/`, `scripts/`, `docs/`) sprzed usunięcia
   i przechodzące testy po usunięciu.
9. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query.
10. **Realny PG w jednorazowym Dockerze** z pełnymi migracjami, z dowodem celu
    połączenia i **liczbą SKIPPED** (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem + **wpis w raporcie**:
    `pozycja → commit SHA → status → dowód osiągalności → dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem (§1.6). Klucze `assessment.*` tworzysz **wyłącznie**
> dla napisów, które faktycznie wychodzą z Twojego API — i wtedy parytet PL+EN
> obowiązuje w tym samym commicie, w `public/locales/{pl,en}/translation.json`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze bazowym, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
3. Uruchom **minimum** poniższą listę (każde z **czterema** zmiennymi env
   i jawnym `DATABASE_URL` tam, gdzie dotyka bazy — Z19):
   ```bash
   # rdzeń Assessmentu (spadek po dniu 20)
   npx vitest run server/src/services/assessment/__tests__
   npx vitest run server/src/method-core/__tests__
   npx vitest run server/src/method-core/outputs/__tests__
   npx vitest run server/src/routes/v8/__tests__/assessment.routes.test.ts
   npx vitest run server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts
   npx vitest run server/src/routes/assessmentCatalog/__tests__
   npx vitest run server/src/services/assessmentMethodBootstrap/__tests__
   npx vitest run server/src/services/caseWorkspace/adapters/__tests__/assessmentAdapter.pg.test.ts
   npx vitest run tests/unit/assessment
   npx vitest run tests/unit/drdVizAdapter.test.ts
   npx vitest run tests/integration/assessment
   npx vitest run tests/integration/assessment-workflow.integration.test.ts
   npx vitest run tests/integration/assessment-reports.routes.test.ts
   npx vitest run tests/integration/assessment-reports.integration.test.ts
   npx vitest run tests/integration/assessment-api.integration.test.ts
   npx vitest run tests/integration/assessment-rbac.integration.test.ts
   npx vitest run tests/integration/assessment-ai.integration.test.ts
   npx vitest run tests/integration/assessmentOverview.integration.test.ts
   npx vitest run tests/integration/workflows/assessment-workflow-integration.test.ts

   # ★ NOWE W TYM DYŻURZE — bezpośrednio zagrożone przez A.2 i F.1 (patrz ERRATA §1.2)
   npx vitest run tests/unit/backend/routes/h64-failsoft-batch6.test.ts
   npx vitest run tests/unit/backend/routes/h64-failsoft-batch7.test.ts
   npx vitest run tests/unit/backend/routes/assessment-workflow-v2.routes.org-guard.test.ts
   npx vitest run tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts
   npx vitest run tests/acceptance/red-assess-500s.e2e.test.ts        # cudzy tor — MIERZYSZ, nie zmieniasz

   # regresja frontu — NIE zmieniasz go, ma pozostać na poziomie zastanym
   npx vitest run tests/components/assessment
   npx vitest run src/components/assessment/drd/__tests__
   npx vitest run src/method-core/methods/drd/__tests__
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego), **z osobną tabelą „czerwone ZASTANE" i „czerwone
   WPROWADZONE", z kolumną SKIPPED**. **Czerwonych zastanych NIE naprawiasz** —
   opisujesz. Znane zastane z dnia 20 (do potwierdzenia u siebie, nie do
   przepisania na wiarę): `server/src/routes/v8/__tests__/assessment.routes.test.ts`
   (suite FAIL, brak `validateOrgMembership` w lokalnym mocku),
   `tests/components/assessment` (8 FAIL w plikach Outputs),
   `src/components/assessment/drd/__tests__` (6 FAIL, banner demo).
   **Każdą czerwoną wprowadzoną** albo naprawiasz, albo zgłaszasz jako STOP;
   przemilczenie = naruszenie.
5. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu
   „przed/po" w raporcie.** Dotyczy to również **usunięcia bloku `describe`**
   z cudzego testu przy A.2 — to jest osłabienie i wymaga wpisu z uzasadnieniem.
   Osłabienie bez wpisu = odrzucenie.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić cokolwiek w `src/` (Z17) — **zawsze STOP, bez wyjątku**;
- zmienić współdzielony kontrakt jądra `MethodEvent`/`AnswerEventPayload`
  (`server/src/method-core/contracts/events.ts`) — to rozstrzygnięcie nadzorcy;
- usunąć kod, dla którego **nie masz pustego grepa po CAŁYM repo** (Z20) —
  wtedy zostawiasz go i wpisujesz do „Znalezisk";
- usunąć albo zmienić wpis w `PUBLIC_DEMO_WRITE_ALLOWLIST` **bez** równoczesnego
  usunięcia handlera, na który ten wpis wskazuje (§A.2 pkt 6);
- zmienić cudzy test spoza wąskiej licencji z §0.2 (Z18/Z17);
- dodać migrację nieaddytywną, `DROP COLUMN`, albo wyjść poza przedział
  `20261160`–`20261169`;
- stworzyć flagę funkcyjną albo zmienić wartość domyślną istniejącej (Z10);
- wpiąć dostawcę modelu / wygenerować treść LLM (Z14);
- zamienić błąd typów na `any` bez komentarza `TODO` i bez licznika w raporcie
  (§B.2 pkt 5);
- zbudować trasę bez realnej ścieżki zapisu (→ `BRAK_API`, nie atrapa) albo
  trasę zwracającą sukces bez zmiany w bazie (→ Z22);
- uruchomić test bazodanowy bez kompletu czterech zmiennych env w tej samej
  linii (Z19) — to nie jest STOP do eskalacji, tylko **zakaz**: postaw kontener,
  zmigruj, udowodnij cel połączenia i dopiero mierz.

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

Moduł **Ocena/Assessment** dostał od panelu adwersaryjnego **4,0/10 przy celu
9,5** (`DEC-2026-08-26-103`) — najsłabszy zbadany moduł produktu. Paradoks
modułu: backend jest **mocny**, a produkt go **nie woła**.

Dwa dyżury już to naprawiały:

- **`DEC-115`** — tania partia napraw frontu (scalona): 45 martwych komponentów,
  6 plików tras, **martwy agregator `routes/assessment/index.ts` wraz z jedynym
  odwołaniem**, 11 martwych metod `api.ts`, słownik 4 kodów „Pomiń" po stronie
  frontu, likwidacja atrap pod przyciskami.
- **`DEC-119` + `DEC-122`** — dzień 20 (mechanika tylna), odebrany z **zerem P0**
  i scalony po czterech FIX-ach: jeden model 7 osi klient↔serwer, słownik 4 kodów
  „Pomiń" po stronie serwera (append-only, idempotentny, tenant z tokenu),
  deterministyczny kontrakt raportu 7 rozdziałów ze `skips[]` per pytanie,
  pakiet testów realnego routera.

**Dzień 20 uczciwie oznaczył sześć pozycji jako niedowiezione** (3 × `STOP`,
3 × `NIE_ZACZĘTE`), a odbiorca dołożył **cztery długi P2**. To jest dokładnie
Twój zakres. Nie jest to „sprzątanie po kimś" — to zaplanowana druga warstwa
tego samego bloku.

### 1.2. ★★ ERRATA — DZIESIĘĆ RZECZY, KTÓRE ZMIENIŁY SIĘ ALBO BYŁY NIEŚCISŁE

**Nadzorca zweryfikował KAŻDĄ pozycję zakresu w kodzie na tipie
`codex/m03-admin-20260824` (`f5871d622a`). Poniższe ustalenia są stanem
faktycznym i mają pierwszeństwo przed treścią raportu dnia 20 i przed rejestrem.
Ty weryfikujesz je ponownie w Bloku 0 — rozbieżność wobec tej tabeli jest wpisem
w „Korektach wobec instrukcji", nie powodem do improwizacji.**

| #      | Teza (raport dnia 20 / `DEC-119` / `DEC-122`)                                                      | Stan faktyczny na tipie m03 (zweryfikowany)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Skutek dla zakresu                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | „F.1: usuń `routes/index.ts:18` + `assessmentDomainRoutes` + nieosiągalny `assessments.routes.ts`" | **`assessmentDomainRoutes` JUŻ NIE ISTNIEJE** — `grep -rn "assessmentDomainRoutes" server/src` → **PUSTE**; `server/src/routes/assessment/index.ts` → **pliku NIE MA** (usunięte tanią partią `DEC-115`). Linia 18 `routes/index.ts` to dziś `export { default as aiDomainRoutes }`. **Nieosiągalny został wyłącznie `server/src/routes/assessment/assessments.routes.ts` (497 linii, 11 handlerów, ZERO importerów).** Sam `server/src/routes/index.ts` też nie ma importera, ale to **barrel CROSS-MODULE** eksportujący ~150 tras całego produktu                                                                                                                                                                                                                                | **F.1 kurczy się do JEDNEGO pliku.** `routes/index.ts` **NIE JEST** Twoim zakresem — wpisujesz go do „Znalezisk" jako martwy barrel międzymodułowy do osobnej decyzji |
| **2**  | „A.2: usuń martwy blok ról/wniosków, linie ~1786–2443, pusty grep w `src/`"                        | **Pusty grep w `src/` NIE WYSTARCZA — i tu jest pułapka dnia 25.** Blok dzieli się na **dwie części o zupełnie różnym statusie**: (a) **role** (`1776–2021`, 4 handlery: `my-role`, `GET/POST /roles`, `DELETE /roles/:targetUserId`) — **ZERO odwołań w CAŁYM repo**; (b) **wnioski o dostęp** (`2023–~2432`, 6 handlerów) — **referencje w KODZIE PRODUKCYJNYM i w cudzych testach**: `server/src/services/demo/demoPrincipalGuard.ts` → `PUBLIC_DEMO_WRITE_ALLOWLIST` zawiera `POST /api/assessment-workflow/:assessmentId/access-requests` i `DELETE .../access-requests/:requestId`; `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts:382-383` asertuje tę migawkę; `tests/unit/backend/routes/h64-failsoft-batch6.test.ts:220,269` testuje fail-closed na tej trasie | **A.2 domyślnie usuwa TYLKO część (a).** Część (b) = `COORDINATION_REQUIRED` — patrz §A.2 pkt 6                                                                       |
| **3**  | (nieujawnione w dniu 20)                                                                           | **Mid-file `import AssessmentPermissionService` stoi w linii 1780**, czyli WEWNĄTRZ bloku ról, a jest używany **także przez blok wniosków** (linie 2051, 2067, 2152, 2163, 2215, 2226, 2308, 2319, 2390)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Usunięcie bloku ról **musi PRZENIEŚĆ ten import**, inaczej zostawiasz plik, który się nie kompiluje                                                                   |
| **4**  | „B.2: 203 błędy standalone `tsc` / 92 błędy przy tsconfigu projektu — obie liczby prawdziwe"       | Potwierdzone jako **dwie różne konfiguracje**, nie sprzeczność. `server/tsconfig.json` ma `strict:true`, `module: NodeNext`, `skipLibCheck:true`; wywołanie `npx tsc --noEmit <plik>` bez `-p` używa **domyślnych** opcji (inne rozstrzyganie modułów `.js`, inny `lib`) i generuje inną klasę diagnostyk                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **Pierwszym krokiem B.2 jest UZGODNIENIE OBU LICZB** (§B.2 pkt 2), nie naprawa. Raport podaje obie z komendą, która je wyprodukowała                                  |
| **5**  | „B.2: 3 trasy AI zielone przed i po (test charakteryzacyjny)"                                      | **Testu charakteryzacyjnego NIE MA.** `tests/integration/assessment-ai.integration.test.ts` (44 linie) testuje **wyłącznie schematy zod** (`CreateAssessmentSchema`, `UpdateAssessmentSchema`, `SendBackSchema`, `GenerateInitiativesSchema`) — **zero wywołań trasy AI**. Żaden test w repo nie dotyka `assessment-ai.routes.ts` behawioralnie                                                                                                                                                                                                                                                                                                                                                                                                                                     | **Harness charakteryzacyjny BUDUJESZ SAM, jako pierwszy commit B.2**, przed jakąkolwiek zmianą typów                                                                  |
| **6**  | (nieujawnione)                                                                                     | `aiAssessmentPartnerService.ts:159-168`: bez `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY` serwis ustawia `genAI = null` i **wszystkie ścieżki zwracają `mode: 'FALLBACK'`** (deterministycznie, 14 miejsc)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Charakteryzacja jest wykonalna BEZ LLM i BEZ klucza** — asertujesz deterministyczny kształt `FALLBACK`. To honoruje Z14 i Z15                                       |
| **7**  | „P2: brakująca trasa `GET /:assessmentId` attachments — dobudować lub `BRAK_API`"                  | **Wołający ZOSTAŁ USUNIĘTY** tanią partią `DEC-115`, z jawnym komentarzem w kodzie: `src/hooks/useAssessmentAttachments.ts:150-158` („removed dead `getAllAttachments` … Confirmed zero callers anywhere in `src/` … nothing to repoint, so removed rather than inventing a new backend route for an unused function"). Zamontowany router ma dziś: `POST /`, `GET /level/:assessmentId/:axisId/:levelNumber`, `GET /download/:attachmentId`, `PUT /:attachmentId/description`, `DELETE /:attachmentId`                                                                                                                                                                                                                                                                             | **Dobudowa trasy stworzyłaby endpoint bez konsumenta.** Domyślny werdykt: `BRAK_API` z cytatem komentarza jako dowodem — patrz §P2.3                                  |
| **8**  | „P2: GET-y kontraktu bez bramki roli sesyjnej — oceń, czy zamierzone"                              | **To jest KANON całego `/api/method`, nie przeoczenie Assessmentu.** W `server/src/routes/method-core.routes.ts` jest **6 wywołań `requireSessionWriteRole`** i **wszystkie sześć stoi na zapisach** (linie 475, 1024, 1259, 1341, 1631, 1831). **ŻADEN `GET` nie bramkuje po roli** — `GET /sessions/:id`, `GET /sessions/:id/roles`, `GET /sessions/:id/roles/history`, `GET /outputs/*` czytają na samym `organizationId` z tokenu                                                                                                                                                                                                                                                                                                                                               | **Dodanie bramki tylko do dwóch GET-ów Assessmentu byłoby niespójnym wyjątkiem.** Domyślny werdykt: udokumentowana świadoma decyzja + test przypinający — patrz §P2.4 |
| **9**  | „P2: kolumna `superseded_by` utworzona i nigdy niezapisywana"                                      | **Potwierdzone.** `grep -rn "superseded_by" server/src` (bez `__tests__`) → **zero trafień**; migracja `20261101` tworzy kolumnę, serwis zapisuje wyłącznie `supersedes_id` (wskaźnik WSTECZ). Trafienia `superseded_by_output_id` w `method_report_snapshots` to **inna tabela i inny mechanizm** — nie myl ich                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **`superseded_by` jest matematycznie ODWROTNOŚCIĄ `supersedes_id`** — patrz §P2.1, gdzie to rozstrzyga wybór rozwiązania                                              |
| **10** | „E.2: wersjonowanie — endpoint zawsze podaje NAJNOWSZY output"                                     | **Potwierdzone i GŁĘBSZE, niż brzmi.** `assessmentReportContractService.ts:32-34`: `const output = outputs[0] ?? null` (najnowszy) **ORAZ** `assessmentSkipReasonService.listActive(...)` (stan pominięć NA TERAZ). Kontrakt przesuwa się więc z **DWÓCH** powodów: nowy output **i** zmiana decyzji „Pomiń"                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Przypięcie samej rewizji outputu NIE WYSTARCZY.** Migawka musi być deterministyczna po obu osiach — patrz §E.2                                                      |

**Wniosek metodyczny — obowiązuje Cię w każdej pozycji:** materiał diagnostyczny
jest hipotezą, kod jest prawdą. **Każda pozycja zaczyna się od weryfikacji
w kodzie i na żywej bazie**, a rozbieżność wobec tej instrukcji jest **wpisem
w raporcie**, nie powodem do zgadywania (CLAUDE.md, złota reguła 1).

### 1.3. ZAKRES — dokładnie dziesięć pozycji, nic więcej

| Poz.     | Nazwa                                                   | Stan dziś                                                         | Twój produkt                                                                                    |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A.2**  | Usunięcie martwego bloku ról workflow v1                | 4 handlery ról bez odwołań; 6 handlerów wniosków ma odwołania     | Usunięcie części (a) z dowodem repo-wide; część (b) uczciwie `COORDINATION_REQUIRED`            |
| **B.2**  | Zdjęcie `@ts-nocheck` z `aiAssessmentPartnerService.ts` | 1439 linii bez typów, 92/203 błędy (dwie konfiguracje)            | **POZYCJA BUDŻETOWANA** — typy bez zmiany zachowania albo uczciwy STOP z licznikiem             |
| **C.1**  | Dowód ścieżki produkcyjnej TO-BE (`DEC-37`)             | model w jądrze jest, dowodu brak                                  | Test realnego routera `/api/method` bez wstrzykniętych zależności + readback niezależnym poolem |
| **E.2**  | Migawka rewizji kontraktu raportu (`DEC-47`)            | kontrakt cicho się przesuwa (dwie osie dryfu)                     | Kontrakt wiązany z rewizją, niezmienny; brak rozdziału → jawna walidacja (Z22)                  |
| **F.1**  | Usunięcie nieosiągalnego `assessments.routes.ts`        | 11 handlerów, zero importerów                                     | Tabela handler→odpowiednik→werdykt + usunięcie albo uzasadnione zatrzymanie                     |
| **P2.1** | Kolumna `superseded_by` — zapis albo korekta            | utworzona, nigdy niezapisywana                                    | Wybór z uzasadnieniem + dowód behawioralny                                                      |
| **P2.2** | Replay POST zwraca `201` zamiast `200`                  | idempotentne powtórzenie udaje utworzenie                         | `200` przy replayu, `201` przy realnym zapisie, `409` przy kolizji klucza                       |
| **P2.3** | Brakujący `GET /:assessmentId` attachments              | mount `Gateway.ts:1106` istnieje, trasy brak, konsumenta też brak | `BRAK_API` z dowodem albo dobudowa — z uzasadnieniem                                            |
| **P2.4** | GET-y kontraktu bez bramki roli sesyjnej                | czyta każdy członek org (kanon całego `/api/method`)              | Świadoma decyzja udokumentowana + test przypinający, albo bramka                                |
| **R.1**  | `MODULE_ACCEPTANCE.md` 04_ASSESSMENT                    | nie podniesiony po dniu 20                                        | Podniesienie o **faktycznie dowieziony** zakres, z mianownikami                                 |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`** — komponenty, hooki, `api.ts`, `src/method-core/**`,
   `src/services/drdStructure.ts`. Bez wyjątku.
2. **★ Przepięcie frontu na zapis kodu „Pomiń"** (`DEC-122`, otwarta pozycja
   koordynacyjna) — to robotnik frontowy, na ekranie HTTP, po osobnej decyzji.
3. **★ Podpięcie 26 endpointów AI do UI** — front po prototypie. Ty ich **nie
   usuwasz** i **nie zmieniasz**.
4. **★ Flagi `drdMethodWorkspaceSliceV1` / `methodWorkspaceShellV1` /
   `drdHttpSourceOfTruthV1`** — decyzja właściciela, zostają OFF (Z10).
5. **★ Eksport PDF jako plik** — renderer, paginacja, TOC, znak wodny `DRAFT`.
6. **Generowanie treści raportu modelem** (Z14).
7. **Pozycje SCALONE dnia 20** — `B.1` (model 7 osi), `D.1` (słownik kodów),
   `D.2`/`E.1` (kontrakt 7 rozdziałów). **Czytasz je, nie przerabiasz.**
   Jedyny dozwolony kontakt z `E.1` to **rozszerzenie o migawkę rewizji (E.2)**.
8. **Rozstrzygnięcie kanonu 7 osi vs 8 wymiarów raportu** — `ASM-CHAPTER-AC-008`
   ma status `CANON_DECISION_REQUIRED`; decyzja właściciela/nadzorcy.
9. **`server/src/routes/index.ts`** — martwy barrel cross-module (ERRATA poz. 1).
10. **Prototypy i wygląd.** Nie robisz zrzutów, nie oceniasz wyglądu.

### 1.5. Decyzje wiążące

1. **`DEC-2026-08-25-37`** — TO-BE: cel **widoczny w Interview** jako kontekst
   („Cel: poziom N" + dystans), **edytowalny wyłącznie w Matrix** — jedno źródło
   edycji. Ty dostarczasz **dowód strony serwerowej obu operacji** (§C.1).
2. **`DEC-2026-08-25-46`** — **7 osi wszędzie**. **OWNER_ACCEPT.** Zamknięte
   przez B.1 dnia 20 — Ty tego nie ruszasz.
3. **`DEC-2026-08-25-47`** — **Report = jeden obiekt przy sesji z historią
   wersji**; eksport do Materiałów jako **migawka**. **OWNER_ACCEPT.** To jest
   bezpośrednia podstawa §E.2.
4. **`DEC-2026-08-25-55`** — słownik kodów „Pomiń", cztery kody. **OWNER_ACCEPT.**
   Zbudowany po obu stronach (front `DEC-115`, serwer `DEC-122`) — Ty go
   **nie zmieniasz**, tylko domykasz zachowanie replayu (§P2.2).
5. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz
   deployów, Railway, zdalnych migracji/seedów. **Prawo nadrzędne.**
6. **`DEC-2026-08-26-95`** — rozejście marker→tip rozstrzyga nadzorca; start
   dokładnie z markera, bez rebase.
7. **`DEC-2026-08-26-96` + `DEC-2026-08-26-98`** — **Z19** (kolejność Bloku 0,
   komplet env w jednej linii, dowód celu połączenia), **korekta Z9**, **rezerwacja
   numerów migracji** (Twój przedział: `20261160`–`20261169`).
8. **`DEC-2026-08-26-103`** — panel ekspercki modułu Ocena (źródło zakresu).
9. **`DEC-2026-08-26-104`** — **Z20**: dowód **osiągalności**, nie istnienia kodu.
10. **`DEC-2026-08-26-107`** — **Z21**: test wstrzykujący zależności nie dowodzi
    ścieżki produkcyjnej.
11. **`DEC-2026-08-26-108`** — **Z22** (zakaz atrapy z zewnętrznym skutkiem)
    i **Z23** (pomiar testów bez zawężania).
12. **`DEC-2026-08-26-115`** — tania partia napraw frontu SCALONA (źródło
    ERRATY poz. 1 i 7). Metoda godna utrwalenia: **analiza grafu importów
    z domknięciem tranzytywnym**, nie pojedyncze grepy — użyj jej w F.1.
13. **`DEC-2026-08-26-119`** — odbiór dnia 20; źródło listy kontynuacji i długów P2.
14. **`DEC-2026-08-26-122`** — dzień 20 SCALONY po FIX-1..4; potwierdza, że
    B.1/D.1/D.2/E.1 są zamknięte.
15. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji ze
    sprawdzeniem przed każdym plikiem.

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ty = TYŁ.** Migracje, serwisy, trasy, semantyka zapisu, kontrakty odpowiedzi,
testy, dowody osiągalności. **Robotnicy wewnętrzni = FRONT**, po prototypie
i akcepcie właściciela na czystym zrzucie.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do frontu — **należy do frontu**, a Ty wpisujesz to do „Znalezisk"
jako „kontrakt gotowy, front do zbudowania".

Twoim obowiązkiem wobec frontu jest **jawny kontrakt w raporcie**: dla każdej
trasy, którą zmieniasz (P2.2, E.2), podajesz metodę, ścieżkę, kształt body,
kształt odpowiedzi, kody błędów — **łącznie z tym, co się ZMIENIŁO** (np.
`201 → 200` przy replayu). Front dnia 20 nie jest jeszcze przepięty na zapis
kodu „Pomiń", więc Twoja zmiana kodu odpowiedzi **musi trafić do raportu jako
ostrzeżenie dla robotnika frontowego**.

### 1.7. Stan faktyczny — co JUŻ JEST (zweryfikowane na `f5871d622a`)

Zweryfikuj każdą linię w Bloku 0; rozbieżność → „Korekty wobec instrukcji".

```
# MOUNTY (Gateway.ts) — istotne dla tego dyżuru
:639   app.use('/api/assessment-workflow',            assessmentWorkflowRoutes)      ← v1, 2443 linie, 31 tras
:641   app.use('/api/assessment-workflow-v2',         assessmentWorkflowV2Routes)    ← v2, kanon
:958   app.use('/api/method',                         methodCoreRoutes)              ← tu żyją skip-reasons i report-contract
:1106  app.use('/api/assessment-level-attachments',   assessmentLevelAttachmentsRoutes)

# A.2 — DWIE CZĘŚCI O RÓŻNYM STATUSIE (★ ERRATA poz. 2)
server/src/routes/assessment/assessment-workflow.routes.ts
  1776-1778  // ==== PERMISSION & ROLE MANAGEMENT ENDPOINTS ====
  1780       import AssessmentPermissionService  ← ★ mid-file, używany TAKŻE niżej (ERRATA poz. 3)
  1786       GET    /:assessmentId/my-role
  1854       GET    /:assessmentId/roles
  1907       POST   /:assessmentId/roles
  1978       DELETE /:assessmentId/roles/:targetUserId
  ...2021    koniec części (a) — ZERO odwołań w CAŁYM repo
  2023-2025  // ==== ACCESS REQUEST ENDPOINTS ====
  2031       POST   /:assessmentId/access-requests               ← w PUBLIC_DEMO_WRITE_ALLOWLIST
  2125       GET    /:assessmentId/access-requests
  2186       POST   /:assessmentId/access-requests/:requestId/approve
  2289       POST   /:assessmentId/access-requests/:requestId/reject
  2379       DELETE /:assessmentId/access-requests/:requestId     ← w PUBLIC_DEMO_WRITE_ALLOWLIST
  2416       async function logWorkflowTransition(...)            ← helper, POZA blokiem
  2443       export default router

# ŻYWE trasy v1 (mają konsumentów — NIE WOLNO ich naruszyć)
src/components/assessment/ActivityLogPanel.tsx:229            → /activity-logs
src/components/assessment/panels/VersionHistoryPanel.tsx:66   → /versions
src/components/assessment/panels/VersionHistoryPanel.tsx:126  → /restore/:version
src/hooks/useAssessmentCollaboration.tsx:118,153,188,301      → /presence, /activities, /presence/leave
src/store/useMultiFrameworkStore.ts:428,458,488               → /submit-for-review, /approve, /reject
tests/acceptance/red-assess-500s.e2e.test.ts:49-69            → /status, /versions, /history, /pending-reviews, /initialize

# B.2 — partner AI
server/src/services/aiAssessmentPartnerService.ts:1      // @ts-nocheck   (1439 linii)
  :8    import { GoogleGenerativeAI } from '@google/generative-ai'
  :150  this.genAI = null
  :157-168  initializeModel(): klucz z GOOGLE_AI_API_KEY|GEMINI_API_KEY; brak klucza → genAI=null
  :176-181  injectMockClient(mockClient) → this._injected = true   ← ★ Z21: TEGO NIE UŻYWASZ w dowodzie
  14 miejsc  mode: 'FALLBACK'                                       ← deterministyczna ścieżka bez LLM
Konsumenci: server/src/routes/assessment/assessment-ai.routes.ts:12
            server/src/services/aiAssessmentReportGenerator.ts:15
            server/src/services/aiAssessmentFormHelper.ts:16

# C.1 — TO-BE, PEŁNY ŁAŃCUCH (istnieje; brakuje DOWODU)
server/src/method-core/contracts/events.ts:45-72   METHOD_EVENT_TYPES (zamknięty zbiór)
server/src/method-core/contracts/events.ts:177     subject: 'current_level' | 'target_level' | 'freeze' | 'output_approval'
server/src/routes/method-core.routes.ts:1016       POST /sessions/:id/events   (bramka: requireSessionWriteRole, linia 1024)
server/src/method-core/outputs/EventDerivedOutputBridge.ts:99-105
      type === 'DECISION_APPROVED' && typeof level === 'number' && payload.subject === 'target_level'
        → bucket.targetLevel = event.level                        ← ★ DOKŁADNY przepis na dowód
server/src/method-core/outputs/EventDerivedOutputBridge.ts:121-123  target[unitId], gap = target - current
server/src/routes/method-core.routes.ts:105        const outputBridge = new EventDerivedOutputBridge(methodEventStore, methodOutputService)  ← produkcyjne okablowanie
server/src/routes/method-core.routes.ts:1418       POST /sessions/:id/freeze   ← wyzwala bridge
server/src/method-core/outputs/MethodOutputService.ts:211,448      kolumna target_level per jednostka
server/src/routes/method-core.routes.ts:1573       GET /outputs/:id
UWAGA: finding wymaga >= 1 dowodu (validateFreezeInput) — scenariusz testowy musi dołożyć EVIDENCE_ATTACHED

# E.2 — dryf kontraktu (DWIE OSIE)
server/src/services/assessment/assessmentReportContractService.ts
  :32   const outputs = await methodOutputService.listOutputsBySession(...)
  :33   const output = outputs[0] ?? null                          ← oś 1: zawsze NAJNOWSZY
  :34   const skipReasons = await assessmentSkipReasonService.listActive(...)  ← oś 2: stan NA TERAZ
  :76-80 contractVersion / outputId / revision (= output.outputVersion) / generatedAt
server/src/routes/method-core.routes.ts:1594   GET /outputs/:id/revisions      ← wersjonowanie JUŻ ISTNIEJE, użyj go

# F.1 — jedyny pozostały nieosiągalny plik (★ ERRATA poz. 1)
server/src/routes/assessment/assessments.routes.ts   497 linii, 11 handlerów, ZERO importerów:
  :25  GET    /my-assessments                    :84  GET    /:id
  :133 POST   /                                  :182 PUT    /:id/status
  :219 DELETE /:id                               :257 POST   /:id/complete
  :290 POST   /:id/generate-initiatives          :364 POST   /:id/responses/:questionId
  :403 GET    /:id/responses                     :436 GET    /frameworks/list
  :469 GET    /frameworks/:frameworkId/questions

# P2 — cztery długi
server/migrations/20261101_assessment_day20_skip_reasons.sql   kolumny: supersedes_id (zapisywana), superseded_by (NIGDY)
server/src/services/assessment/assessmentSkipReasonService.ts:111-115  INSERT ... ON CONFLICT (organization_id, idempotency_key) DO NOTHING
server/src/routes/method-core.routes.ts:502    res.status(201).json({ skipReason })   ← także przy replayu
server/src/routes/method-core.routes.ts:509    GET  /sessions/:sessionId/assessment-skip-reasons     ← bez bramki roli
server/src/routes/method-core.routes.ts:528    GET  /sessions/:sessionId/assessment-report-contract  ← bez bramki roli
server/src/services/demo/demoPrincipalGuard.ts:267  PUBLIC_DEMO_WRITE_ALLOWLIST
src/hooks/useAssessmentAttachments.ts:150-158  komentarz DEC-115: usunięty martwy getAllAttachments
```

### 1.8. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **„Pusty grep w `src/`" to NIE jest dowód zerowej osiągalności.** Blok wniosków
   v1 ma pusty grep w `src/`, a mimo to jest w **produkcyjnej allowliście
   bezpieczeństwa** i w dwóch cudzych testach. Grep **zawsze** po całym repo:
   `server/ src/ tests/ scripts/ docs/`.
2. **Mid-file importy.** `assessment-workflow.routes.ts` ma import w linii 1780 —
   wycięcie bloku bez przeniesienia importu zostawia plik, który się nie buduje,
   a `esbuild` per plik tego **nie złapie** (transpiluje, nie typuje).
3. **`skipIf` udaje sukces.** Pakiet dnia 20 przy niekompletnym env raportuje
   `0 failed` przy 11 SKIPPED. **Zawsze podajesz liczbę SKIPPED** (Z19/Z23).
4. **`injectMockClient()` NIE jest dowodem** (Z21). Charakteryzacja B.2 i dowód
   C.1 idą **domyślną** ścieżką konstrukcji, bez wstrzykiwania.
5. **Zmiana kodu odpowiedzi `201 → 200` jest zmianą kontraktu.** Front nie jest
   jeszcze przepięty; wpis do raportu jako ostrzeżenie dla robotnika frontowego
   jest **obowiązkowy**.
6. **`superseded_by` ≠ `superseded_by_output_id`.** Pierwsza kolumna jest
   w `assessment_skip_reasons`, druga w `method_report_snapshots` /
   `method_initiative_drafts` — inny mechanizm, w pełni żywy. Nie pomyl ich
   przy grepie.
7. **`DROP COLUMN` jest zakazany** (migracje addytywne). Jeśli Twoim wnioskiem
   jest „kolumna zbędna", rozwiązaniem NIE jest `DROP` — patrz §P2.1.
8. **Nie naprawiasz czerwonych zastanych** (`assessment.routes.test.ts`,
   `tests/components/assessment`, `src/components/assessment/drd/__tests__`) —
   opisujesz je.
9. **Budżet B.2 jest twardy.** Lepszy uczciwy STOP z licznikiem po 60% budżetu
   niż plik z 40 `as any` bez komentarzy.
10. **Kolejność ma znaczenie.** `F.1` i `A.2` (część a) są **tanie i pewne** —
    rób je wcześnie, zanim wejdziesz w budżetowane `B.2`.

---

## §A. JEDEN KANONICZNY MOUNT WORKFLOW — pozycja A.2

### A.2 — Usunięcie martwego bloku ról workflow v1

**Cel:** zdjąć z v1 kod, do którego nie prowadzi żadna ścieżka — bez naruszenia
ani jednej żywej trasy v1 i bez rozlewania się na cudze moduły.

**Kroki — dokładnie w tej kolejności:**

1. **Inwentarz PRZED usunięciem.** Dla **każdego** z dziesięciu handlerów bloku
   (4 role + 6 wniosków) wykonaj i **wklej do raportu dosłownie** (komenda +
   wynik, także pusty):

   ```bash
   for p in "my-role" "/roles" "access-requests"; do
     echo "### $p"
     grep -rn "assessment-workflow" server/ src/ tests/ scripts/ docs/ \
       --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.md' \
       | grep -v "assessment-workflow-v2" | grep -- "$p"
   done
   ```

   **Grep tylko po `src/` jest niewystarczający (Z20, ERRATA poz. 2).**

2. **Tabela odpowiedników semantyk.** Dla każdego z dziesięciu handlerów podaj
   wiersz: `handler v1 (plik:linia) → odpowiednik v2 (plik:linia) → werdykt`.
   Odpowiedniki są w `server/src/routes/assessment-workflow-v2.routes.ts`
   (`my-role`, `roles`, `access-requests` + approve/reject/cancel). **Brak
   odpowiednika = NIE USUWASZ tego handlera**, nawet gdy grep jest pusty.

3. **Usunięcie części (a) — role.** Wycinasz linie **1776–2021** (nagłówek
   sekcji + cztery handlery). **Zanim wytniesz:** przenieś
   `import AssessmentPermissionService from '../../services/assessmentPermissionService.js';`
   do bloku importów na górze pliku (ERRATA poz. 3) — jest używany przez blok
   wniosków, który zostaje.

4. **Weryfikacja po usunięciu:**

   ```bash
   npx prettier --write server/src/routes/assessment/assessment-workflow.routes.ts
   npx esbuild server/src/routes/assessment/assessment-workflow.routes.ts --loader:.ts=ts --outfile=/dev/null
   grep -n "AssessmentPermissionService" server/src/routes/assessment/assessment-workflow.routes.ts | head -3
   grep -c "^router\." server/src/routes/assessment/assessment-workflow.routes.ts   # 31 → 27
   ```

5. **Regresja ŻYWYCH tras v1 — warunek DoD, nie formalność.** Test realnego
   routera (`supertest`, realny PG, boot realnego pliku tras) dowodzący, że
   **po** usunięciu dalej odpowiadają: `GET /:id/status`, `GET /:id/versions`,
   `POST /:id/restore/:version`, `POST /:id/presence`, `GET /:id/activities`,
   `POST /:id/submit-for-review`, `POST /:id/approve`, `POST /:id/reject`,
   `GET /:id/activity-logs`. Plus **negatyw**: usunięte trasy zwracają `404`
   (a nie `500` i nie `200`).

6. **★ Część (b) — wnioski o dostęp: DOMYŚLNIE NIE USUWASZ.**
   Blok `2023–~2432` ma **żywe odwołania poza `src/`**:
   - `server/src/services/demo/demoPrincipalGuard.ts` → `PUBLIC_DEMO_WRITE_ALLOWLIST`
     (kod **produkcyjny**, allowlista bezpieczeństwa dla publicznego demo),
   - `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts:382-383` (migawka),
   - `tests/unit/backend/routes/h64-failsoft-batch6.test.ts:220,269` (fail-closed
     programu H6.4 — **cudzy program**).

   **Domyślny werdykt: `COORDINATION_REQUIRED`** — zostawiasz blok, wpisujesz do
   raportu tabelę odwołań i propozycję (usunięcie wymaga równoczesnej zmiany
   allowlisty produkcyjnej + dwóch cudzych testów, czyli decyzji nadzorcy).

   **Usunięcie części (b) jest dozwolone TYLKO wtedy, gdy spełnisz WSZYSTKIE
   pięć warunków** i opiszesz je w raporcie:
   (i) każdy z 6 handlerów ma udowodniony odpowiednik v2 (tabela z pkt 2);
   (ii) usuwasz **równocześnie** dwa wpisy z `PUBLIC_DEMO_WRITE_ALLOWLIST`
   (wąska licencja z §0.2 — **wyłącznie te dwa wiersze**, nic więcej w tym pliku);
   (iii) synchronizujesz migawkę `publicDemoWriteAllowlist.test.ts` z wpisem
   „przed/po" (§0.4a pkt 5);
   (iv) usuwasz **wyłącznie** blok `describe` z linii 220
   w `h64-failsoft-batch6.test.ts`, z wpisem „przed/po" i uzasadnieniem
   „testowany handler przestał istnieć";
   (v) `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts`,
   `h64-failsoft-batch6.test.ts`, `h64-failsoft-batch7.test.ts`
   i `red-assess-500s.e2e.test.ts` są **zielone po zmianie**, z liczbami.

   **Jeśli którykolwiek warunek nie jest spełniony — STOP dla części (b)
   i `COORDINATION_REQUIRED`.** To nie jest porażka pozycji; część (a) sama
   w sobie jest domknięciem.

**DoD A.2:** pusty grep repo-wide per handler (dosłownie w raporcie) · tabela
handler→odpowiednik→werdykt (10 wierszy) · import przeniesiony · `esbuild` PASS ·
regresja 9 żywych tras v1 zielona na realnym PG · usunięte trasy dają `404` ·
liczba handlerów `31 → 27` · część (b) rozstrzygnięta jawnie.

---

## §B. `@ts-nocheck` W PARTNERZE AI — pozycja B.2 (BUDŻETOWANA)

### B.2 — Zdjęcie `@ts-nocheck` z `aiAssessmentPartnerService.ts`

**To jedyna pozycja tego dyżuru z jawnym budżetem czasu i jawną, honorową
ścieżką wyjścia.** Dzień 20 postawił tu uczciwy STOP; odbiorca odtworzył go
niezależnie. Pozycja wchodzi do zakresu **z budżetem**, nie „do skutku".

**Zasada nadrzędna: ZERO ZMIANY ZACHOWANIA.** Poprawiasz **typy**, nie logikę,
nie okablowanie Gemini (Z14), nie treść promptów, nie kształty odpowiedzi.

**Kroki — dokładnie w tej kolejności:**

1. **★ NAJPIERW TEST CHARAKTERYZACYJNY, PRZED JAKĄKOLWIEK ZMIANĄ PLIKU.**
   Testu nie ma (ERRATA poz. 5) — budujesz go sam, jako **osobny commit**.
   Wymagania:
   - **trzy trasy AI** z `server/src/routes/assessment/assessment-ai.routes.ts`,
     wybrane tak, żeby pokrywały trzy różne kształty odpowiedzi serwisu; sugestia:
     `POST /:projectId/ai/suggest-target` (:197), `POST /:projectId/ai/validate` (:322),
     `GET /:projectId/ai/insights` (:415). **Wybór uzasadniasz w raporcie**;
   - **realny router + realny PG + prawdziwe JWT** (wzorzec:
     `server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts`);
   - **BEZ klucza API** → serwis idzie ścieżką `mode: 'FALLBACK'` (ERRATA poz. 6).
     **Nie ustawiasz `GOOGLE_AI_API_KEY` ani `GEMINI_API_KEY`. Nie wołasz
     `injectMockClient()`** — to złamałoby Z21;
   - asercje **na dokładnym kształcie odpowiedzi**: status HTTP, klucze koperty,
     `mode`, typy pól. To jest Twoja siatka bezpieczeństwa — im ciaśniejsza, tym
     większa swoboda w kroku 4;
   - minimum: happy · pusty stan · negatyw tenanta · nieznany `projectId`.

   **Bez zielonego harnessu NIE WOLNO Ci ruszyć pliku serwisu.** Harness zielony
   przed zmianą i po zmianie = jedyny dowód „zero zmiany zachowania".

2. **UZGODNIENIE DWÓCH LICZB BŁĘDÓW (ERRATA poz. 4).** Zdejmujesz `@ts-nocheck`
   i mierzysz **obiema** metodami, wklejając do raportu komendę + liczbę:

   ```bash
   # (a) konfiguracja projektu serwerowego
   npx tsc --noEmit -p server/tsconfig.json 2>&1 | grep "aiAssessmentPartnerService" | wc -l
   # (b) standalone, opcje domyślne
   npx tsc --noEmit server/src/services/aiAssessmentPartnerService.ts 2>&1 | grep -c "error TS"
   ```

   Następnie **klasyfikujesz błędy na kategorie** (tabela: kategoria → liczba →
   przykład `TSxxxx`). Znane z dnia 20: brak deklaracji pól `genAI`/`model`/`_injected`,
   odczyty `actual`/`target` z `unknown`, odczyty pól z `{}`. **Ten krok jest
   produktem sam w sobie** — nawet przy STOP-ie zostaje w raporcie.

3. **Naprawa od najtańszej kategorii.** Kolejność, która daje najwięcej za
   najmniej: (1) deklaracje pól klasy; (2) jawne interfejsy opcji wejściowych;
   (3) typ osi/DRD (czytasz `server/src/data/drdStructure.ts`, **nie zmieniasz go**);
   (4) zawężenia `unknown` przez strażniki typu; (5) reszta.
   **Po każdej kategorii uruchamiasz harness z kroku 1.** Czerwony harness =
   cofasz tę kategorię, nie „poprawiasz test".

4. **★ BUDŻET I PRÓG PRZERWANIA.** Ustalasz budżet czasu na B.2 **na starcie
   pozycji i wpisujesz go do raportu**. Po **60% budżetu** sprawdzasz licznik
   błędów:
   - liczba spadła do zera → domykasz, `@ts-nocheck` zdjęte, `ZROBIONE_WG_DoD`;
   - liczba spada wiarygodnie i ekstrapolacja mieści się w budżecie → kontynuujesz;
   - **liczba nie spada wiarygodnie do zera → STOP z licznikiem, commit częściowy.**
     Plik **może zostać z `@ts-nocheck`** — wtedy dopisujesz nad dyrektywą
     komentarz o postępie w formacie:
     ```ts
     // @ts-nocheck
     // DZIEŃ 25 (B.2): częściowe typowanie. Błędy przy zdjęciu dyrektywy:
     //   <N_start> (server/tsconfig.json) / <M_start> (standalone) → <N_end> / <M_end>.
     //   Kategorie domknięte: <lista>. Pozostałe: <lista>.
     //   Zachowanie NIEZMIENIONE — dowód: <nazwa pliku harnessu>, <X>/<X> PASS przed i po.
     ```
     Status pozycji: `CZĘŚCIOWO` z licznikiem, **nigdy `ZROBIONE`**.

5. **★ ZAKAZ ANY-WASHINGU.** Zamiana błędu typu na `any` jest dozwolona
   **wyłącznie** z komentarzem `// TODO(day25-B.2): <dlaczego any, co trzeba
zrobić>` bezpośrednio nad linią. **Każde takie `any` jest liczone i wpisane
   do raportu** (liczba + lista linii). Liczba `any` bez komentarza = **zero**,
   inaczej pozycja jest odrzucona. Kontrola:

   ```bash
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/aiAssessmentPartnerService.ts | grep -c "^+.*: any"
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/aiAssessmentPartnerService.ts | grep -B1 "^+.*: any" | grep -c "TODO(day25-B.2)"
   ```

   Obie liczby muszą się zgadzać.

6. **Efekty uboczne u konsumentów.** `aiAssessmentReportGenerator.ts`
   i `aiAssessmentFormHelper.ts` importują `aiAssessmentPartner` i `DRD_AXES`.
   Jeśli Twoje typy wywołają tam błędy — masz licencję na **minimalną**
   adaptację tych dwóch plików (§0.2), z osobnym wpisem w raporcie. Jeżeli
   adaptacja wymagałaby zmiany **zachowania** — STOP.

**DoD B.2:** harness charakteryzacyjny (min. 4 testy, realny router + realny PG,
bez klucza, bez `injectMockClient`) zielony **przed i po** · tabela „błędy przed
/ po" w **obu** konfiguracjach · tabela kategorii · liczba `any` = liczba
komentarzy `TODO(day25-B.2)` · budżet i próg 60% opisane · `esbuild` PASS ·
zero zmian w `assessment-ai.routes.ts`.

---

## §C. TO-BE (DEC-37) — pozycja C.1

### C.1 — Dowód ścieżki produkcyjnej celu

**Cel:** udowodnić, że cel (`target_level`) da się **zapisać i odczytać przez
realną, zamontowaną trasę produkcyjną**, bez wstrzykniętych zależności — a to,
czego dowód nie potwierdzi, dobudować. **Zaczynasz od dowodu, nie od budowy.**

Model TO-BE **istnieje w jądrze** (§1.7) — nie budujesz go od zera.

**Scenariusz dowodowy (jeden test, `describe.skipIf(!REAL_DB)`, realny PG):**

1. Boot **produkcyjnego eksportu** `server/src/routes/method-core.routes.ts`
   pod `/api/method` (zamockowane wyłącznie `auth.middleware` i `Logger`).
   **Zero `dependencies`, zero podstawionego repozytorium, zero fabryk testowych**
   (Z21). Zwróć uwagę: `method-core.routes.ts:105` konstruuje
   `new EventDerivedOutputBridge(methodEventStore, methodOutputService)` na
   poziomie modułu — **to jest okablowanie produkcyjne i właśnie ono ma zadziałać**.
2. Zasiej minimum: `organizations`, `users`, `method_sessions` (`module='assessment'`,
   `method_pack_id='drd'`, `state='active'`), `method_session_roles` (rola z
   `METHOD_SESSION_WRITE_ROLES`, np. `owner`) — wzorzec w
   `assessmentSkipReasons.day20.pg.test.ts:29-52`.
3. **Zapis stanu obecnego**: `POST /api/method/sessions/:id/events` z
   `ANSWER_CONFIRMED` (unitId, level) — potrzebne, żeby `gap` był policzalny.
4. **Dowód (>= 1) dla findingu**: `POST .../events` z `EVIDENCE_ATTACHED`
   (`payload.evidenceId`) — bez tego `validateFreezeInput` odrzuci finding
   i dowód będzie fałszywie negatywny.
5. **Zapis CELU — sedno pozycji**: `POST .../events` z
   ```json
   { "type": "DECISION_APPROVED", "unitId": "<ten sam>", "level": <N>,
     "payload": { "subject": "target_level" } }
   ```
   (`EventDerivedOutputBridge.ts:99-105` — dokładnie ten warunek).
6. **Wyprowadzenie**: `POST /api/method/sessions/:id/freeze`.
7. **Odczyt przez trasę**: `GET /api/method/outputs/:id` → finding ma
   `targetLevel === N` i `gap === N - current`.
8. **★ READBACK NIEZALEŻNYM POOLEM** (DoD pkt 2) — osobny `pg.Pool`, zapytanie
   wprost do tabeli, kolumna `target_level`:
   ```sql
   SELECT unit_id, current_level, target_level FROM <tabela findingów>
   WHERE output_id = $1 AND organization_id = $2 ORDER BY unit_id;
   ```
   (nazwę tabeli ustalasz z `MethodOutputService.ts:448` — **nie zgadujesz**).
9. **Negatywy (obowiązkowe):** obcy tenant → `403/404` i **zero wierszy**;
   `actorKind: 'system'` → `400`; rola bez prawa zapisu → `403 session_read_only`;
   `level` poza skalą osi → `400`, nigdy `500`.

**Co dobudowujesz:** **wyłącznie to, czego dowód NIE potwierdzi.** Jeśli
wszystkie dziewięć kroków przechodzi — pozycja jest **dowodem**, a nie
implementacją, i to jest poprawny wynik (`ZROBIONE_WG_DoD`, produkt = test).
Jeśli któryś krok padnie:

- brak trasy odczytu celu dla Interview → **opisujesz kontrakt w raporcie**
  (§1.6) i dobudowujesz **tylko** odczyt, jeśli mieści się w `/api/method`;
- brak w jądrze (`EventDerivedOutputBridge`, `MethodOutputService`) → **STOP**,
  bo to zmiana jądra (§0.2, Z17) — decyzja nadzorcy.

**DoD C.1:** test domyślnego okablowania (Z21) zielony na realnym PG · readback
niezależnym poolem · 4 negatywy · dowód osiągalności w formacie Z20 (`Gateway.ts:958
→ method-core.routes.ts:1016 → MethodEventStore → EventDerivedOutputBridge:103 →
MethodOutputService:448 → kolumna target_level`) · jawna lista „czego dowód nie
potwierdził i co z tym zrobiłem".

---

## §E. MIGAWKA REWIZJI KONTRAKTU RAPORTU — pozycja E.2

### E.2 — Kontrakt wiązany z rewizją, niezmienny po zmianie odpowiedzi

**Problem (zweryfikowany, ERRATA poz. 10):** `GET /api/method/sessions/:id/assessment-report-contract`
buduje kontrakt z **najnowszego** outputu (`outputs[0]`) **i** z **bieżącego**
stanu pominięć (`listActive`). Kontrakt **cicho się przesuwa** pod konsumentem
z **dwóch** niezależnych powodów. `DEC-47` mówi wprost: _Report = jeden obiekt
przy sesji z historią wersji; eksport do Materiałów jako migawka_. Dzisiejsze
zachowanie tego nie realizuje.

**Wymagania — wszystkie cztery:**

1. **Wybór rewizji jest jawny.** Endpoint przyjmuje **opcjonalny** selektor
   rewizji (`?outputId=` **albo** `?revision=` — wybierasz jeden, uzasadniasz
   w raporcie; `GET /api/method/outputs/:id/revisions` **już istnieje**
   (`method-core.routes.ts:1594`) i jest źródłem prawdy o dostępnych rewizjach).
   Brak selektora = zachowanie zastane (najnowszy) — **kompatybilność wstecz
   jest obowiązkowa**, front dnia 20 nie jest przepięty.
2. **★ Migawka jest niezmienna po OBU osiach.** Dla ustalonej rewizji kontrakt
   musi być **deterministyczny**: dwa wywołania rozdzielone **zmianą decyzji
   „Pomiń"** muszą dać **identyczny** wynik. Praktycznie oznacza to, że przy
   przypiętej rewizji stan pominięć czytasz **jako-na-moment tej rewizji**
   (`recorded_at <=` znacznik zamrożenia outputu), a nie `listActive()`.
   **To jest sedno pozycji** — samo przypięcie `outputId` jej nie realizuje.
   `assessment_skip_reasons` jest append-only, więc odczyt „as-of" jest
   wykonalny bez nowej kolumny i bez migracji.
3. **★ Z22 — brak rozdziału to jawna walidacja, nie cichy sukces.** Jeżeli
   któregokolwiek z siedmiu rozdziałów nie da się zbudować dla wskazanej rewizji
   (brak outputu, oś spoza `DRD_STRUCTURE`, rewizja nieistniejąca, rewizja
   z innej sesji/tenanta), endpoint zwraca **4xx z maszynowym kodem**
   (np. `REPORT_REVISION_NOT_FOUND`, `REPORT_CHAPTER_UNAVAILABLE`) i **zero
   efektu zewnętrznego**. **Nigdy `200` z brakującym rozdziałem, nigdy `200`
   z `chapters: []`.**
4. **Jedna prawda dla widoku i eksportu.** Odpowiedź niesie jawnie
   `outputId` + `revision` + `generatedAt`, tak żeby konsument eksportu mógł
   zażądać **dokładnie tej samej** rewizji. Renderera **nie budujesz** (poza
   zakresem) — budujesz **kontrakt**.

**Testy (minimum sześć, realny router + realny PG):**

- (a) **niezmienność**: zbuduj kontrakt dla rewizji R → zapisz nową decyzję
  „Pomiń" → zbuduj ponownie dla R → **wyniki identyczne** (porównanie głębokie);
- (b) **ruch po zwolnieniu przypięcia**: bez selektora ten sam scenariusz **daje
  różnicę** (dowód, że test (a) nie jest tautologią);
- (c) **nowa rewizja**: freeze → nowy output → bez selektora widać nowy,
  z selektorem starym widać stary;
- (d) **rewizja nieistniejąca** → 4xx + kod maszynowy, zero `200`;
- (e) **rewizja obcego tenanta** → `404`, nigdy `200`, nigdy `403` z treścią;
- (f) **kompatybilność wstecz**: wywołanie bez selektora zwraca ten sam kształt
  co przed zmianą (siedem rozdziałów, `skips[]` per pytanie, `content: null`).

**Zakazy w tej pozycji:** zero LLM (Z14) · zero treści rozdziałów (kontrakt
niesie **sloty i limity**, nie zdania) · nie zmieniasz semantyki `skips[]`
i agregatu `skipped` ustalonej FIX-em 2 dnia 20 · nie ruszasz
`server/src/services/report/**`.

**DoD E.2:** 6 testów zielonych na realnym PG · dowód niezmienności po obu osiach
· 4xx z maszynowym kodem dla braku rozdziału (Z22) · kompatybilność wstecz
udowodniona · kontrakt (metoda, ścieżka, parametry, kształt odpowiedzi, kody
błędów) wypisany w raporcie dla frontu (§1.6) · zero migracji, **chyba że**
udowodnisz, że odczyt „as-of" jest niewykonalny bez kolumny — wtedy migracja
w przedziale `20261160`–`20261169` z pełnym dowodem idempotencji.

---

## §F. SPRZĄTANIE — pozycja F.1

### F.1 — Usunięcie nieosiągalnego `assessments.routes.ts`

**★ Zakres jest MNIEJSZY, niż mówi `DEC-119`** (ERRATA poz. 1): agregator
`assessmentDomainRoutes` i `server/src/routes/assessment/index.ts` **już nie
istnieją** — usunęła je tania partia `DEC-115`. Pozostał **jeden** plik:
`server/src/routes/assessment/assessments.routes.ts` (497 linii, 11 handlerów).

**Kroki:**

1. **Dowód zerowej osiągalności — metodą z `DEC-115`, nie pojedynczym grepem.**
   Analiza grafu importów z **domknięciem tranzytywnym**: plik jest żywy tylko,
   jeśli jest osiągalny z realnego wejścia (`Gateway.ts` / inny żywy plik /
   harness) — **NIE z samego testu**. Minimum do raportu, dosłownie:

   ```bash
   grep -rn "assessments.routes" server/ src/ tests/ scripts/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs'
   grep -rn "assessment/index" server/ src/ tests/ --include='*.ts'
   grep -rn "assessmentDomainRoutes" server/ src/ tests/
   ```

   Oczekiwane: trafienia **wyłącznie** dla `external-assessments.routes.ts`
   (inny plik!) i dla samego usuwanego pliku. **Uwaga na fałszywe trafienia** —
   `external-assessments.routes.ts` jest **żywy** (`Gateway.ts:138`).

2. **★ TABELA JEDENASTU SEMANTYK — warunek postawiony przez odbiorcę dnia 20.**
   Dla **każdego** z 11 handlerów (§1.7) wiersz:
   `handler (metoda + ścieżka + linia) → odpowiednik w zamontowanej trasie
(plik:linia) → werdykt (MA ODPOWIEDNIK / BRAK ODPOWIEDNIKA / SEMANTYKA MARTWA)`.
   Kandydaci na odpowiedniki: `assessment-workflow-v2.routes.ts`
   (`GET/POST /`, `GET/PUT/DELETE /:id`, initiatives), `assessment-hub` /
   `/api/assessments`, `assessmentCatalog` (frameworks/questions).
   **Nie zgadujesz — sprawdzasz plik i linię.**

3. **Werdykt.** Usuwasz plik **tylko wtedy**, gdy: (i) grep repo-wide jest pusty
   poza samym plikiem, **oraz** (ii) każdy z 11 handlerów ma w tabeli werdykt
   `MA ODPOWIEDNIK` albo `SEMANTYKA MARTWA` z uzasadnieniem. Jeśli choć jeden
   ma `BRAK ODPOWIEDNIKA` dla semantyki, która jest realnie potrzebna — **plik
   zostaje**, a Ty wpisujesz to do „Znalezisk" jako lukę produktową.
   **Częściowe usuwanie handlerów z nieosiągalnego pliku nie ma sensu** — albo
   cały plik, albo nic.

4. **`server/src/routes/index.ts` NIE JEST Twoim zakresem** (§0.2). Barrel nie
   ma importera, ale eksportuje ~150 tras całego produktu — usunięcie to decyzja
   cross-module. Wpisujesz go do „Znalezisk" z jednym zdaniem.

5. **Po usunięciu:** pełny przebieg §0.4a (zwłaszcza `tests/integration/assessment`,
   `red-assess-500s.e2e.test.ts`) — **zero czerwonych wprowadzonych**.

**DoD F.1:** grep repo-wide dosłownie w raporcie (przed) · tabela 11 semantyk
z werdyktami · usunięcie ALBO uzasadnione zatrzymanie · zielony pełny zakres
§0.4a po zmianie · `routes/index.ts` opisany w „Znaleziskach", nie dotknięty.

---

## §P. CZTERY DŁUGI P2 Z ODBIORU DNIA 20

### P2.1 — Kolumna `superseded_by`: zapis albo korekta

**Stan (ERRATA poz. 9):** migracja `20261101` tworzy kolumnę `superseded_by`,
a `assessmentSkipReasonService` zapisuje **wyłącznie** `supersedes_id`
(wskaźnik WSTECZ). Kolumna jest **martwa i myląca** — czytający schemat wierzy,
że łańcuch supersesji ma wskaźnik w obie strony.

**Trzy możliwe rozwiązania. Wybierasz JEDNO i uzasadniasz w raporcie:**

| Wariant                                        | Na czym polega                                                                                                                                                                                                                                                                                   | Koszt / ryzyko                                                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(A) — wyprowadzenie** _(zalecany domyślnie)_ | `supersededBy` jest **wyliczane w modelu odczytu** jako odwrotność `supersedes_id` (rekord X jest „superseded by" tym rekordem, którego `supersedes_id = X.id`). Kolumna fizyczna zostaje nietknięta i **jawnie oznaczona** jako niepisana — `COMMENT ON COLUMN` w migracji z Twojego przedziału | Zero `UPDATE`, zero `DROP`, zachowana niezmienność append-only, którą `DEC-119` wprost pochwalił. Koszt: jedno dodatkowe zapytanie/`JOIN` w odczycie                                                              |
| **(B) — zapis wprzód**                         | Przy zapisie rekordu superseding wykonujesz `UPDATE` poprzedniego wiersza (`superseded_by = <nowe id>`)                                                                                                                                                                                          | **Łamie append-only** (`DEC-119`: „append-only, idempotentny"). Wymaga transakcji i rozstrzygnięcia, co przy replayu. **Wybór tego wariantu wymaga jawnej zgody nadzorcy — czyli STOP**, nie samodzielnej decyzji |
| **(C) — usunięcie kolumny**                    | `DROP COLUMN superseded_by`                                                                                                                                                                                                                                                                      | **ZAKAZANE** — migracje wyłącznie addytywne (§0.3). Nie wybierasz go                                                                                                                                              |

**Jeśli wybierasz (A)** — a to jest ścieżka domyślna:

- `supersededBy: string \| null` pojawia się w modelu odczytu
  (`AssessmentSkipReason`) i w odpowiedzi `GET .../assessment-skip-reasons`;
- **dowód behawioralny (obowiązkowy):** zapisz decyzję dla tej samej pary
  `unitId + questionId` **dwa razy** → pierwsza ma `supersededBy = <id drugiej>`,
  druga ma `supersededBy = null`, a `supersedes_id` drugiej wskazuje pierwszą.
  **Readback niezależnym poolem** potwierdza, że w bazie **nic nie zostało
  zaktualizowane** (kolumna fizyczna dalej `NULL` — to jest cecha, nie usterka,
  i tak ma być opisana);
- migracja (opcjonalna, w przedziale `20261160`–`20261169`):
  `COMMENT ON COLUMN assessment_skip_reasons.superseded_by IS '...'` — addytywna,
  idempotentna, bez `DROP`. **Jeśli uznasz komentarz za zbędny, zero migracji
  jest poprawnym wynikiem** — wtedy wyjaśnienie idzie do komentarza w kodzie
  serwisu i do raportu.

**DoD P2.1:** wybrany wariant + uzasadnienie · dowód behawioralny łańcucha
supersesji (min. 2 testy) · readback niezależnym poolem · zero `UPDATE`
i zero `DROP` w diffie migracji · kompatybilność wstecz odpowiedzi API.

### P2.2 — Replay POST zwraca `200`, nie `201`

**Stan:** `method-core.routes.ts:502` zwraca `201` **zawsze** — także wtedy,
gdy `ON CONFLICT (organization_id, idempotency_key) DO NOTHING` nie wstawił
żadnego wiersza. Idempotentne powtórzenie **udaje utworzenie zasobu**.

**Wymagania:**

1. **Serwis musi umieć odróżnić** zapis od replayu. `record()` zwraca dziś sam
   rekord — rozszerz go o jawny sygnał (np. `{ skipReason, replayed: boolean }`
   albo pole na rekordzie; wybór uzasadniasz). **Sygnał musi pochodzić z bazy**
   (liczba zmienionych wierszy albo sprawdzenie istnienia rekordu z tym samym
   `idempotency_key` **przed** insertem), nie z heurystyki.
2. **Trasa:** realny zapis → `201`; idempotentne powtórzenie → **`200`**
   z **identycznym** ciałem (ten sam rekord, ten sam `id`).
3. **★ Kolizja klucza — sprawdź i rozstrzygnij.** Dziś ten sam `Idempotency-Key`
   z **innym** ciałem (inny `skipCode`/`questionId`) po cichu zwraca **pierwszy**
   rekord i `201` — to jest **fałszywa odpowiedź**. Zweryfikuj to zachowanie
   testem, a następnie: albo `409` z maszynowym kodem
   (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`) i **zerem zapisu** (spójne z Z22), albo
   — jeśli uznasz, że to zmiana kontraktu ponad Twój mandat — **uczciwy wpis
   STOP z opisem**. Zgadywanie zakazane.
4. **Kompatybilność wstecz:** front dnia 20 **nie jest jeszcze przepięty**
   (`DEC-122`). Zmiana `201 → 200` musi trafić do raportu jako **jawne
   ostrzeżenie kontraktowe dla robotnika frontowego**, razem z pełnym kształtem
   obu odpowiedzi.

**Testy (minimum pięć, realny router + realny PG):** pierwszy zapis → `201`

- readback · powtórzenie tego samego → `200`, to samo `id`, **jeden** wiersz
  w bazie (readback niezależnym poolem: `SELECT count(*)`) · kolizja klucza
  z innym ciałem → rozstrzygnięcie z pkt 3 + **zero** nowych wierszy · obcy tenant
  → `404`/`403` + zero zapisu · brak nagłówka `Idempotency-Key` → `400`
  (zachowanie zastane, nie zmieniasz).

**DoD P2.2:** `201` tylko przy realnym zapisie · `200` przy replayu z identycznym
ciałem · liczba wierszy potwierdzona niezależnym poolem · kolizja klucza
rozstrzygnięta jawnie (naprawa albo STOP) · ostrzeżenie kontraktowe w raporcie
· istniejące 11/11 testów dnia 20 dalej zielone (a jeśli któryś asertował `201`
przy replayu — wpis „przed/po" wg §0.4a pkt 5).

### P2.3 — Brakująca trasa `GET /:assessmentId` attachments

**Stan (ERRATA poz. 7):** mount istnieje (`Gateway.ts:1106`), ale zamontowany
router nie ma gołego `GET /:assessmentId`. **Wołający został usunięty** tanią
partią `DEC-115`, z jawnym komentarzem w `src/hooks/useAssessmentAttachments.ts:150-158`.
**Dziś nie ma ani trasy, ani konsumenta.**

**Kroki:**

1. **Zweryfikuj oba fakty** (lista tras routera + brak wołającego) i wklej
   dowody do raportu — w tym **cytat** komentarza z `useAssessmentAttachments.ts`.
2. **Rozstrzygnij, z uzasadnieniem.** Domyślny werdykt: **`BRAK_API`** —
   dobudowa stworzyłaby endpoint bez konsumenta, czyli dokładnie to, przed czym
   ostrzega `DEC-115` („nothing to repoint, so removed rather than inventing
   a new backend route for an unused function") i punkt 3 DoD („zero atrap").
3. **Dobudowa jest dozwolona TYLKO wtedy**, gdy wykażesz **realną potrzebę
   serwerową** — np. że kontrakt raportu (E.1/E.2) potrzebuje listy załączników
   per sesja/ocena jako dowodów. Wtedy: pełny DoD (4 testy + negatyw tenanta
   - realny PG), a `organizationId` wyłącznie z tokenu. **Sama „symetria API"
     nie jest potrzebą.**
4. **Uwaga na kolizję ścieżek:** router ma już `DELETE /:attachmentId`
   i `PUT /:attachmentId/description`. Dodanie `GET /:assessmentId` tworzy
   dwuznaczny segment — jeśli budujesz, to **z jawnym prefiksem**
   (np. `GET /assessment/:assessmentId`), nie gołym parametrem. Kolizja ścieżek
   opisana w raporcie jest obowiązkowa niezależnie od werdyktu.

**DoD P2.3:** dowód obu faktów (brak trasy, brak konsumenta) · werdykt
`BRAK_API` z uzasadnieniem **albo** pełna dobudowa wg DoD · analiza kolizji
ścieżek · zero zmian w `src/`.

### P2.4 — GET-y kontraktu bez bramki roli sesyjnej

**Stan (ERRATA poz. 8):** `GET .../assessment-skip-reasons`
i `GET .../assessment-report-contract` sprawdzają **tylko** `organizationId`
z tokenu — każdy członek organizacji przeczyta stan pominięć i kontrakt raportu.
**To jest kanon całego `/api/method`**, nie przeoczenie: wszystkie 6 wywołań
`requireSessionWriteRole` stoi na **zapisach** (linie 475, 1024, 1259, 1341,
1631, 1831); żaden `GET` nie bramkuje po roli.

**Kroki:**

1. **Enumeracja dowodowa (produkt sam w sobie).** Wypisz **wszystkie** trasy
   `GET` w `method-core.routes.ts` z kolumną „bramka: tenant / rola / inna".
   Tabela idzie do raportu. Bez niej Twoja decyzja jest opinią, nie ustaleniem.
2. **Rozstrzygnij, z uzasadnieniem.** Domyślny werdykt: **świadoma decyzja —
   odczyt szeroki, spójny z kanonem `/api/method`**; odczyt raportu i stanu
   pominięć w obrębie organizacji jest zamierzony (raport ma być czytelny dla
   zespołu doradczego, edycja pozostaje zamknięta rolą).
3. **Świadoma decyzja musi być PRZYPIĘTA TESTEM**, nie samym zdaniem w raporcie:
   test dowodzący, że (a) członek organizacji **bez** roli sesyjnej **czyta**
   (`200`), (b) ten sam użytkownik **nie zapisze** (`403 session_read_only`),
   (c) **obcy tenant nie czyta** (`404`). Taki test zamienia „nie pomyśleliśmy"
   w „tak ma być" i wyłapie przyszłą regresję w obie strony.
4. **Dodanie bramki roli jest dozwolone TYLKO**, gdy Twoja enumeracja z pkt 1
   pokaże, że kanon jest inny, niż opisano powyżej (czyli że istnieją GET-y
   bramkowane rolą). Wtedy: bramka + 4 testy + wpis „przed/po", bo to **zmiana
   kontraktu odczytu** dla przyszłego frontu.

**DoD P2.4:** tabela wszystkich `GET` `/api/method` z bramkami · werdykt
z uzasadnieniem · 3 testy przypinające (czyta / nie zapisuje / obcy nie czyta)
· jeśli bramka dodana — wpis „przed/po" i ostrzeżenie kontraktowe dla frontu.

---

## §T. TESTY — pozycja własna, nie dodatek

**T.1 — Realny router dla wszystkiego, co zmieniasz.** Każda zmieniona trasa ma
test przez `supertest`, na **realnym PG**, z bootem realnego pliku tras
(zamockowane wyłącznie `auth.middleware` i `Logger`). Wzorzec (skopiuj, nie
wymyślaj): `server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts`.

**T.2 — Pakiet domyślnego okablowania (Z21) — osobny, jawny.** Dotyczy
**C.1** (jądro method-core) i **B.2** (partner AI). Zero `dependencies`, zero
`injectMockClient()`, produkcyjne singletony, prawdziwe JWT. W raporcie: nazwa
pliku + jedno zdanie, co dokładnie dowodzi.

**T.3 — Negatywy tenanta jako osobny, jawny pakiet.** Dla **każdej** zmienionej
lub dodanej trasy: obcy `organizationId` → `404`/`403` i **zero zapisu**
potwierdzone niezależnym poolem. Dodatkowo — dług T.3 z dnia 20, który możesz
domknąć tanio: **kontrolowany test mutacyjny** (czasowe zneutralizowanie filtru
organizacji w kopii zapytania **w teście**, nigdy w kodzie produkcyjnym)
dowodzący, że test negatywu tenanta faktycznie by upadł. Jeśli tego nie robisz —
wpis „niewykonane, powód".

**T.4 — Zakaz osłabiania testów zastanych.** Osłabienie asercji, usunięcie
`describe`, zamiana twardego oczekiwania na bezzębne `404` — **każde** wymaga
wpisu „przed/po" (§0.4a pkt 5). Osłabienie bez wpisu = odrzucenie dyżuru.

**Nowe pliki testowe — lokalizacje dozwolone:**

```
server/src/services/assessment/__tests__/*.day25*.ts      ← preferowane (FIX-4 dnia 20 przeniósł tam pakiet)
server/src/routes/assessment/__tests__/*.day25*.ts
tests/unit/assessment/*.day25*.ts                          (git add -f)
tests/integration/assessment/*.day25*.ts                   (git add -f)
```

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 04_ASSESSMENT do stanu faktycznego

Ścieżka: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`
(134 linie w chwili wystawienia).

**Reguły:**

1. **Podnosisz WYŁĄCZNIE o to, co faktycznie dowiozłeś w tym dyżurze** —
   z commit SHA i dowodem testowym przy każdej pozycji.
2. **★ MIANOWNIKI OBOWIĄZKOWE.** Nigdy „testy przeszły" — zawsze
   `X/Y PASS, Z SKIPPED`. Nigdy „zrobione" — zawsze `ZROBIONE_WG_DoD` z linkiem
   do sekcji raportu.
3. **Nie podnosisz cudzego zakresu.** Pozycje dnia 20 (B.1, D.1, D.2, E.1) mogą
   być **wspomniane jako scalone** (`DEC-122`), ale nie przypisujesz ich sobie.
4. **Nie podnosisz statusu modułu jako całości** (np. „Assessment: GOTOWY").
   Panel dał 4,0/10; Twój dyżur zamyka **drugą warstwę mechaniki tylnej**,
   a nie produkt. Front i 26 endpointów AI dalej czekają.
5. Pozycje `STOP` / `COORDINATION_REQUIRED` / `BRAK_API` **też idą do rejestru** —
   uczciwy brak jest informacją.

### R.2 — Komplet dowodów

Wszystkie dowody wymienione w §0.4 pkt 11 i §8 Blok 6 muszą znaleźć się
w raporcie **dosłownie** (komenda + wynik), nie w parafrazie.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
--is-ancestor` z §0.1 pkt 1**. Brak → STOP i koniec dyżuru. Rozejście
   marker→tip → wpis, start z markera (`DEC-95`), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19).
   Gałąź + worktree + symlink `node_modules` (§0.1 pkt 5), potem:

   ```bash
   docker run -d --name cx-day25-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day25 \
     -p 5499:5432 pgvector/pgvector:pg16
   # ★ obraz MUSI być pgvector/pgvector:pg16 — postgres:15 NIE przechodzi migracji (brak extension vector)
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day25-pg psql -U postgres -d cx_day25 -c "SELECT current_database(), inet_server_port();"
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict        # przebieg 1
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict        # przebieg 2 → Applying migrations: 0
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry  # dry → Pending migrations: 0
   ```

   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — **zawsze z kompletem
   czterech zmiennych w tej samej linii komendy**.

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów (§0.1 pkt 4).
   Brak (a)/(b)/(c) = STOP.

4. **Numer migracji — WEWNĄTRZ PRZEDZIAŁU `20261160`–`20261169`:**

   ```bash
   ls server/migrations | grep -E '^[0-9]{8}' | sort | tail -5   # najwyższy zastany: NIE jest Twoim startem
   ls server/migrations | grep '^202611[5-7]'                     # co zajęte w okolicy przedziału
   ls server/migrations | grep '^20261160'                        # MUSI być puste
   ```

   **Pamiętaj: ten dyżur prawdopodobnie nie potrzebuje żadnej migracji.**

5. **★ WERYFIKACJA CAŁEJ ERRATY §1.2 — dziesięć punktów, wynik do raportu.**
   To jest najważniejszy krok Bloku 0, bo errata przesuwa zakres dwóch pozycji:

   ```bash
   grep -rn "assessmentDomainRoutes" server/ src/ tests/                      # ERRATA 1 → PUSTE
   ls server/src/routes/assessment/index.ts                                    # ERRATA 1 → No such file
   grep -rn "assessment-workflow" server/ src/ tests/ scripts/ docs/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.md' | grep -v "workflow-v2" | grep -E "my-role|/roles|access-request"   # ERRATA 2
   grep -n "PUBLIC_DEMO_WRITE_ALLOWLIST" server/src/services/demo/demoPrincipalGuard.ts   # ERRATA 2
   sed -n '1776,1782p' server/src/routes/assessment/assessment-workflow.routes.ts          # ERRATA 3 (mid-file import)
   wc -l tests/integration/assessment-ai.integration.test.ts                                # ERRATA 5 → 44, same walidatory
   sed -n '155,170p' server/src/services/aiAssessmentPartnerService.ts                      # ERRATA 6 (FALLBACK bez klucza)
   sed -n '148,160p' src/hooks/useAssessmentAttachments.ts                                  # ERRATA 7 (komentarz DEC-115) — TYLKO ODCZYT
   grep -n "requireSessionWriteRole(res" server/src/routes/method-core.routes.ts            # ERRATA 8 → 6 trafień, wszystkie na zapisach
   grep -rn "superseded_by" server/src --include='*.ts' | grep -v __tests__                 # ERRATA 9 → PUSTE
   sed -n '30,36p' server/src/services/assessment/assessmentReportContractService.ts        # ERRATA 10 (outputs[0] + listActive)
   ```

   Każda rozbieżność → „Korekty wobec instrukcji".

6. **★ POMIAR WEJŚCIOWY (Z23) — PEŁNY zakres §0.4a, na markerze, PRZED pierwszym
   commitem.** Wyniki `X PASS / Y FAIL / Z SKIPPED` per plik do tabeli „czerwone
   ZASTANE". **Czerwonych zastanych NIE naprawiasz.**

7. **Kanon tabel** baseline (mimo że frontu nie ruszasz):
   `bash scripts/check-list-canon.sh 2>&1 | tail -20`.

8. Założenie raportu (§9) i wpisanie wyników 1–7.

### Blok 1 — tanie i pewne (F.1 → A.2 część a)

Obie pozycje używają **tej samej metody dowodowej** (graf importów + grep
repo-wide) i obie są tanie. Zrób je **przed** budżetowanym B.2, żeby dyżur miał
dowieziony rdzeń niezależnie od tego, jak pójdzie typowanie.

### Blok 2 — długi P2 (P2.2 → P2.1 → P2.4 → P2.3)

`P2.2` pierwsze, bo dotyka trasy, którą i tak testujesz. `P2.1` po nim (ten sam
serwis, ten sam pakiet testów). `P2.4` to głównie **enumeracja + test przypinający**.
`P2.3` jest najtańsze — dwie weryfikacje i werdykt.

### Blok 3 — dowód TO-BE (C.1)

Zaczyna się od **dowodu**, nie od budowy. Jeśli wszystkie dziewięć kroków
przechodzi — pozycja jest domknięta testem, bez ani jednej linii kodu
produkcyjnego. To **poprawny** i **pożądany** wynik.

### Blok 4 — migawka rewizji (E.2)

Najdroższa pozycja po B.2. **Jeśli wchodzisz w nią z mniej niż 25% czasu —
zrób samą niezmienność (wymagania 1–3) czysto i oznacz wymaganie 4 uczciwie**,
zamiast czterech połówek.

### Blok 5 — B.2 (BUDŻETOWANE)

**Wchodzisz tu dopiero po Blokach 1–4**, chyba że masz nadmiar czasu. Kolejność
wewnątrz pozycji: harness → dwie liczby → naprawa kategoriami → próg 60%.
**Uczciwy STOP z licznikiem jest tu pełnoprawnym wynikiem.**

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. `§T` (T.1–T.4), `R.1`, `R.2` dla tego, co faktycznie zbudowałeś.
2. **Pomiar wyjściowy (Z23): PEŁNY zakres §0.4a**, tabela „czerwone ZASTANE" vs
   „czerwone WPROWADZONE", **z kolumną SKIPPED**, deklaracja
   `ZASIĘG PEŁNY`/`CZĘŚCIOWY` z wyliczeniem.
3. **Dwanaście dowodów** (do raportu, dosłownie):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|tests/utils/assessmentMocks|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                    # ★ PUSTY (całe src/ poza zakresem)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                      # PUSTY albo tylko 2026116x_assessment_day25_*
   git diff codex/m03-admin-20260824...HEAD -- server/src/method-core/contracts/events.ts                                    # PUSTY (jądro nietknięte)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/audits/                                                   # PUSTY (cudzy moduł, Z17)
   git diff codex/m03-admin-20260824...HEAD -- server/src/routes/index.ts                                                    # ★ PUSTY (ERRATA 1 — barrel poza zakresem)
   git diff codex/m03-admin-20260824...HEAD -- server/src/data/drdStructure.ts                                               # PUSTY (B.1 zamknięte dniem 20)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|drdMethodWorkspaceSliceV1|methodWorkspaceShellV1|drdHttpSourceOfTruthV1)"   # PUSTY (Z10)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(llmService|generateResponse|GOOGLE_AI_API_KEY|GEMINI_API_KEY|openai|anthropic)"   # PUSTY (Z14)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(DROP COLUMN|DROP TABLE|ALTER COLUMN)"                           # PUSTY (migracje addytywne)
   git log --oneline codex/m03-admin-20260824..HEAD                                                                          # commit per pozycja
   docker ps -a --filter name=cx-day25-pg ; docker volume ls | grep -i cx-day25                                              # PUSTO (sprzątnięte)
   ```
4. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day25-pg && docker volume ls -q | grep -i cx-day25 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności

Lepiej **domknięte** `F.1` + `A.2(a)` + `P2.1–P2.4` + `C.1` + testy niż dziesięć
pozycji „prawie". Każda pozycja albo spełnia DoD, albo jest uczciwie oznaczona
(`STOP` / `BRAK_API` / `COORDINATION_REQUIRED` / `CZĘŚCIOWO`).

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY25_REPORT_20260826.md
```

Nie tworzysz drugiego pliku nigdzie indziej (Z12). **Raportu dnia 20 nie edytujesz.**

### 9.1. Szablon

```markdown
# Assessment dzień 25 (blok 2 — dokończenia po dniu 20) — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: c7647e9a23 — POTWIERDZONY / BRAK
Gałąź: codex/assessment-day25-<data>
Worktree: /private/tmp/consultify-assessment-day25
Port PG: 5499 · kontener cx-day25-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE
Przedział migracji: 20261160-20261169 · użyte numery: <lista albo ŻADNE>
Budżet B.2: <deklarowany> · zużyty: <faktyczny> · próg 60% osiągnięty o: <moment>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>

## Oświadczenie o zakresie src/ (★ ograniczenie krytyczne)

<dosłowny wynik: git diff --name-only codex/m03-admin-20260824...HEAD | grep '^src/' → MUSI BYĆ PUSTY>

## ★ Dowód celu połączenia (Z19)

<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z KOMPLETEM CZTERECH zmiennych w tej samej linii>

## ★ WERYFIKACJA ERRATY §1.2 — dziesięć punktów

| # | Teza instrukcji | Mój wynik | Zgodne TAK/NIE | Skutek |
<dziesięć wierszy; każde NIE idzie także do „Korekt wobec instrukcji">

## Warunki wstępne — tabela

<marker · blok ról v1 obecny · @ts-nocheck obecny · target_level w jądrze ·
outputs[0] w kontrakcie · superseded_by niezapisywane · numer migracji wolny ·
migracje 1/2/dry · POMIAR WEJŚCIOWY (pełny §0.4a)>

## Pozycje — tabela zbiorcza

| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / COORDINATION_REQUIRED / NIE_ZACZĘTE) | Commit | Dowód OSIĄGALNOŚCI (Z20) | Dowód testowy (X PASS / Y FAIL / Z SKIPPED) |
| A.2 | | | | |
| B.2 | | | | |
| C.1 | | | | |
| E.2 | | | | |
| F.1 | | | | |
| P2.1 | | | | |
| P2.2 | | | | |
| P2.3 | | | | |
| P2.4 | | | | |
| R.1 | | | | |

## ★ A.2 — DWIE CZĘŚCI BLOKU

### Grep repo-wide PRZED usunięciem (dosłownie, per handler)

### Tabela dziesięciu semantyk

| Handler v1 (plik:linia) | Odpowiednik v2 (plik:linia) | Odwołania poza src/ | Usunięty TAK/NIE | Dowód po |

### Regresja żywych tras v1 (9 tras)

### Werdykt części (b): USUNIĘTE (5 warunków spełnionych) / COORDINATION_REQUIRED

## ★ B.2 — TYPOWANIE PARTNERA AI

### Harness charakteryzacyjny

| Trasa | Dlaczego wybrana | Testy | PASS przed zmianą | PASS po zmianie |

### Błędy typów — DWIE KONFIGURACJE

| Konfiguracja | Komenda | Błędów przed | Błędów po |

### Kategorie błędów

| Kategoria | Liczba | Przykład TSxxxx | Domknięta TAK/NIE |

### Licznik `any`

| Liczba dodanych `: any` | Liczba komentarzy TODO(day25-B.2) | Lista linii |

### Zmiany zachowania: ZERO / <lista>

## ★ C.1 — DOWÓD ŚCIEŻKI TO-BE

| Krok scenariusza | Trasa/komenda | Wynik | Dowód |

### Readback niezależnym poolem (dosłowny SQL + wynik)

### Czego dowód NIE potwierdził i co z tym zrobiłem

## ★ E.2 — MIGAWKA REWIZJI

| Wymaganie | Realizacja | Test | Wynik |
| 1 selektor rewizji | | | |
| 2 niezmienność po OBU osiach | | | |
| 3 brak rozdziału → 4xx (Z22) | | | |
| 4 jedna prawda widok+eksport | | | |

### Kontrakt dla frontu (metoda · ścieżka · parametry · odpowiedź · kody błędów)

## ★ F.1 — TABELA JEDENASTU SEMANTYK

| Handler (metoda + ścieżka + linia) | Odpowiednik (plik:linia) | Werdykt | Dowód |

### Grep repo-wide (dosłownie) · Werdykt: USUNIĘTY / ZOSTAJE + powód

## ★ DŁUGI P2

### P2.1 — wariant wybrany (A/B/C) + uzasadnienie + dowód behawioralny

### P2.2 — 201/200/409: tabela zachowań przed/po + OSTRZEŻENIE KONTRAKTOWE dla frontu

### P2.3 — werdykt BRAK_API / dobudowa + analiza kolizji ścieżek

### P2.4 — tabela wszystkich GET /api/method z bramkami + werdykt + testy przypinające

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem)

| Plik | PASS | FAIL | SKIPPED |

### Czerwone WPROWADZONE przez dyżur

| Plik | Wynik przed | Wynik po | Przyczyna | Naprawione TAK/NIE |

### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 5)

| Plik:linia | Asercja przed | Asercja po | Uzasadnienie |

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

## ★ Pakiet testów DOMYŚLNEGO OKABLOWANIA (Z21)

<nazwy plików + co dokładnie dowodzą, bez wstrzykniętych zależności>

## ★ Dowód braku atrapy z zewnętrznym skutkiem (Z22)

<dla każdej trasy zmieniającej stan: co się zmienia w bazie, co przy odmowie>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## Znaleziska (NIE naprawiane przeze mnie)

<m.in. server/src/routes/index.ts — martwy barrel cross-module>

## Korekty wobec instrukcji

## Migracje (numer, dowód ls|grep, przedział, addytywność, idempotencja, kompatybilność wstecz, MIGRATION_PREPARED — albo „ŻADNE, i dlaczego")

## Licznik (10 pozycji: domknięte / częściowe / STOP / BRAK_API / COORDINATION_REQUIRED / niezaczęte; flagi NIE włączone)

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „testy przeszły" → `26 PASS / 0 FAIL / 0 SKIPPED`.
   **Pakiet w całości SKIPPED to `NIE_ZMIERZONY`, nigdy `PASS`.**
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `COORDINATION_REQUIRED` · `NIE_ZACZĘTE`.
5. **Nie zawyżasz.** `DEC-60` zaraportował usunięcie martwych gałęzi jako
   zrobione, a one były w kodzie; `DEC-108` wyłapał zawężony pomiar testów.
   **Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.**
6. **Dowód osiągalności, nie istnienia** (Z20). „Dodałem serwis" bez ścieżki
   od zamontowanej trasy = `CZĘŚCIOWO`.
7. **Errata jest częścią produktu.** Jeżeli którakolwiek z dziesięciu tez §1.2
   okaże się u Ciebie inna — to jest **cenna informacja**, nie porażka.
8. **Nie piszesz „gotowe do pokazania właścicielowi"** — piszesz „gotowe do
   odbioru przez nadzorcę".

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# typy punktowo (esbuild TRANSPILUJE, nie typuje — nie złapie błędu typu!)
npx esbuild server/src/<plik>.ts --loader:.ts=ts --outfile=/dev/null

# ★ jedyne miejsce z pełnym tsc — POZYCJA B.2, z filtrem do jednego pliku
npx tsc --noEmit -p server/tsconfig.json 2>&1 | grep "aiAssessmentPartnerService" | wc -l
npx tsc --noEmit server/src/services/aiAssessmentPartnerService.ts 2>&1 | grep -c "error TS"

# test celowany BEZ bazy
npx vitest run server/src/services/assessment/__tests__/drdEvidenceScoring.test.ts

# ★ test celowany Z bazą — ZAWSZE CZTERY ZMIENNE + DATABASE_URL W TEJ SAMEJ LINII (Z19)
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" \
npx vitest run server/src/services/assessment/__tests__/assessmentSkipReasons.day20.pg.test.ts --no-file-parallelism

# numeracja migracji — PRZEDZIAŁ 20261160-20261169, PRZED KAŻDYM NOWYM PLIKIEM
ls server/migrations | grep '^202611[5-7]'
ls server/migrations | grep '^20261160'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day25-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day25 -p 5499:5432 pgvector/pgvector:pg16
docker exec cx-day25-pg psql -U postgres -d cx_day25 -c "SELECT current_database(), inet_server_port();"
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5499/cx_day25" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day25-pg && docker volume ls -q | grep -i cx-day25 | xargs -r docker volume rm && docker volume prune -f

# ★ grep osiągalności — ZAWSZE po CAŁYM repo, nigdy tylko po src/ (Z20)
grep -rn "<symbol>" server/ src/ tests/ scripts/ docs/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.md'

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/assessment/assessment.day25.postgres.integration.test.ts

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Dotknięcie `src/`** — choćby jednej linii. Odrzucenie dyżuru.
2. **Usunięcie kodu po pustym grepie TYLKO w `src/`** — blok wniosków v1 ma
   pusty grep w `src/`, a siedzi w **produkcyjnej allowliście bezpieczeństwa**
   i w dwóch cudzych testach (ERRATA poz. 2). To jest **pułapka nr 1 tego dyżuru**.
3. **Wycięcie bloku z mid-file importem** (linia 1780) bez przeniesienia importu
   — plik przestaje się kompilować, a `esbuild` tego **nie złapie**.
4. **Uruchomienie testu DB bez kompletu czterech zmiennych** → pakiet raportuje
   SKIPPED, a Ty raportujesz „0 failed" (Z19/Z23).
5. **Wyjście poza przedział migracji `20261160`–`20261169`** albo liczenie
   „najwyższy zastany + 1" (dziś `20261123`) → kolizja z równoległym dyżurem
   (`DEC-107`: „ŹRÓDŁEM KOLIZJI BYŁA INSTRUKCJA").
6. **`DROP COLUMN superseded_by`** — migracje są wyłącznie addytywne.
   Rozwiązaniem jest wariant (A), nie `DROP` (§P2.1).
7. **Uwierzenie w zakres F.1 z `DEC-119`** — agregator już nie istnieje
   (ERRATA poz. 1); zostały 493 linie jednego pliku, a nie trzy artefakty.
8. **Użycie `injectMockClient()` jako dowodu** w B.2 albo wstrzykniętych
   zależności w C.1 → złamanie Z21, dokładnie tak przeszła martwa warstwa AI.
9. **`as any` bez komentarza `TODO(day25-B.2)`** → any-washing, pozycja odrzucona.
10. **Zmiana `201 → 200` bez ostrzeżenia kontraktowego w raporcie** — front nie
    jest przepięty (`DEC-122`), robotnik frontowy musi to wiedzieć.
11. **Przypięcie samego `outputId` w E.2** i uznanie migawki za zrobioną —
    kontrakt dryfuje **także** po decyzjach „Pomiń" (ERRATA poz. 10).
12. **Trasa zwracająca `200` z brakującym rozdziałem** (Z22) — E.2 wymaga
    jawnej walidacji 4xx z maszynowym kodem.

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie przepinasz frontu na zapis kodu „Pomiń", choć wiesz dokładnie jak
  (`DEC-122` zostawia to jako osobną pozycję koordynacyjną);
- nie poprawiasz metod `api.ts`, choć widzisz błędy — to front;
- nie podpinasz 26 endpointów AI do paneli i nie usuwasz paneli bez importerów;
- nie włączasz `drdMethodWorkspaceSliceV1` / `methodWorkspaceShellV1` /
  `drdHttpSourceOfTruthV1`, choć „przecież to jest zaakceptowana architektura";
- nie usuwasz `server/src/routes/index.ts`, choć nikt go nie importuje;
- nie wpinasz klucza Gemini, żeby „porządnie przetestować" partnera AI (Z14) —
  ścieżka `FALLBACK` jest uczciwym stanem, nie usterką (Z15);
- nie „naprawiasz przy okazji" pozycji B.1/D.1/D.2/E.1 — są scalone i zamknięte;
- nie naprawiasz czerwonych testów zastanych w cudzych modułach;
- nie robisz `rebase` na nowszy tip m03 (`DEC-95` — robi to nadzorca);
- nie edytujesz raportu dnia 20 ani rejestru decyzji (Z12/Z13).

---

## 11. NA KONIEC

Dzień 20 zrobił rzecz rzadką: **postawił trzy uczciwe STOP-y i zostawił trzy
pozycje niezaczęte, zamiast zaraportować dziesięć „prawie gotowych"**. Odbiór
(`DEC-119`) potwierdził zero P0 i zero atrap, a `DEC-122` scalił dowieziony
zakres. To jest wzorzec, który masz utrzymać.

Twoje zadanie jest węższe niż dnia 20 i przez to trudniejsze do zawyżenia:
**dziesięć konkretnych długów, z których każdy ma jednoznaczny dowód
rozstrzygający.** Nie ma tu miejsca na „zaimplementowałem" — jest miejsce na
pusty grep po całym repo, tabelę semantyk, licznik błędów typów przed i po,
readback niezależnym poolem i migawkę, która nie drgnie po zmianie odpowiedzi.

Cztery rzeczy decydują o odbiorze:

1. **Dowód osiągalności po CAŁYM repo, nie po `src/` (Z20).** W tym dyżurze
   błąd nr 1 jest gotowy i czeka: blok wniosków v1 wygląda na martwy w `src/`,
   a jest w produkcyjnej allowliście bezpieczeństwa. **Kto usunie go po pustym
   grepie w `src/`, zepsuje publiczne demo i dwa cudze programy testowe.**
2. **Ścieżka produkcyjna, nie test z podstawionymi zależnościami (Z21).**
   C.1 i B.2 stoją i upadają na tym jednym warunku.
3. **Uczciwy budżet.** B.2 ma jawny próg 60% i jawną drogę wyjścia. `CZĘŚCIOWO`
   z licznikiem błędów i zielonym harnessem jest **więcej warte** niż zdjęta
   dyrektywa okupiona czterdziestoma `as any`.
4. **Uczciwy pomiar (Z22, Z23).** Trzy liczby na przebieg — PASS, FAIL,
   **SKIPPED**. Pakiet w całości pominięty jest `NIE_ZMIERZONY`, nie `PASS`.

**Zero `src/`. Zero LLM. Zero nowych flag. Zero atrap. Zero `DROP`. Flagi
zostają wyłączone.**
