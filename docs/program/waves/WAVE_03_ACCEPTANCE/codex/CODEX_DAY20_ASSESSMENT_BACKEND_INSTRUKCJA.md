# INSTRUKCJA DYŻURU nr 20 — Codex — „Assessment/Ocena BLOK 1: MECHANIKA TYLNA — jeden kanoniczny mount workflow, JEDEN model osi DRD, TO-BE jako dowiedziona ścieżka produkcyjna, słownik kodów «Pomiń», deterministyczny kontrakt raportu 7 rozdziałów, usunięcie nieosiągalnego serwera"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–19. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur otwiera moduł **Ocena / Assessment** — moduł oceniony przez panel
adwersaryjny na **4,0/10 przy celu 9,5** (`DEC-2026-08-26-103`), czyli
**najsłabszy zbadany dotąd moduł produktu**. Paradoks modułu jest odwrotny niż
w Inicjatywach: tu backend jest **mocny i w dużej części poprawny**, a produkt
go **nie woła**. Twoim zadaniem NIE jest budowa produktu — Twoim zadaniem jest
**mechanika tylna**: doprowadzić serwer do stanu, w którym front (robotnicy
wewnętrzni, po prototypie i akcepcie właściciela) ma **jeden** kanoniczny,
przetestowany, udokumentowany kontrakt do podpięcia.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Nie dotykasz frontu. W ogóle. Nawet „jednej linii importu" w `src/`.**

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM.** Nie tworzysz, nie zmieniasz,
   nie usuwasz, nie „przygotowujesz" niczego w `src/` — w tym `src/services/api.ts`,
   `src/services/drdStructure.ts`, `src/method-core/**`, `src/components/**`,
   `src/hooks/**`. Wyjątków **nie ma**. To odróżnia ten dyżur od dyżuru nr 19,
   gdzie `src/services/api.ts` był licencjonowany — **tu NIE jest**.
   Poprawienie 12 zepsutych metod `api.ts` jest produktem **robotnika frontowego**,
   a Twoim produktem jest **tabela kontraktu**, z której on to zrobi (§A.3).
2. **Nie podpinasz 26 endpointów AI do UI.** Panele `AIAssessmentSidebar.tsx`,
   `AISuggestionPanel.tsx`, `AssessmentAxisWorkspace.tsx` mają dziś **zero
   importerów** (zweryfikowane). Podpięcie ich to front po prototypie. Ty **nie
   usuwasz** tych endpointów i **nie usuwasz** tych paneli — one czekają na front.
3. **Nie generujesz treści modelem. Zero LLM w tym dyżurze.** Kontrakt raportu
   (§E) jest **deterministyczną strukturą** — rozdziały, sloty, limity słów jako
   **metadane**, liczby z silnika. Tekst syntezy pisze późniejszy dyżur agenta,
   nie Ty. Wpięcie dostawcy modelu = STOP.
4. **Nie renderujesz PDF.** `Eksportuj wszystko` jako **plik** jest poza
   zakresem. Twoim produktem jest **kontrakt** eksportu (ta sama rewizja co
   widok interaktywny), nie renderer.
5. **★ Wszystko, co budujesz, musi być realne.** Trasa bez ścieżki zapisu = STOP,
   nigdy „na razie zostawiam". Brak API → wpis `BRAK_API`, nie trasa-widmo.
6. **★ DEC-65 — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo. Migracje =
   `MIGRATION_PREPARED`, addytywne, kompatybilne wstecz z zamrożoną bazą demo,
   z dowodem idempotencji na **jednorazowym lokalnym kontenerze**.
7. **★ Nie zmieniasz wartości domyślnych flag wizualnych Assessmentu.**
   `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1`
   są dziś domyślnie OFF i **po Twoim dyżurze mają być dalej OFF**. Włączenie
   wykonuje nadzorca po odbiorze frontu, jedną zmianą konfiguracji (CLAUDE.md
   reguła 9: **zakaz masowego włączania**). Twoim produktem jest **dowód, że
   ścieżka działa**, nie przełącznik.
8. **Odbiór wizualny = nadzorca, po dyżurze.** W raporcie piszesz „gotowe do
   odbioru przez nadzorcę", **nigdy** „gotowe do pokazania właścicielowi".

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: 649bd730a6**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor 649bd730a6 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/assessment-fixes-*` ani z żadnej gałęzi dnia 17/18/19.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. Rebase
   w trakcie dyżuru: **ZAKAZANY**.

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) dwa mounty workflow — sedno pozycji A
   grep -n "assessmentWorkflowRoutes\|assessmentWorkflowV2Routes" server/src/Gateway.ts
   grep -n "DEPRECATED" server/src/routes/assessment/assessment.routes.ts | head -2

   # (b) model osi DRD — dwie kopie, sedno pozycji B
   grep -n "levelCount:" src/services/drdStructure.ts
   grep -n "levelCount:" server/src/data/drdStructure.ts

   # (c) TO-BE — istniejąca ścieżka zdarzeniowa, sedno pozycji C
   grep -rn "target_level" server/src/method-core server/src/routes/method-core.routes.ts | head

   # (d) nieosiągalny agregator — sedno pozycji F
   grep -rn "assessmentDomainRoutes" server/src | head
   grep -rn "routes/index" server/src --include='*.ts' | grep -v "^server/src/routes/index.ts" | head

   # (e) rejestr decyzji i kontrakt raportu właściciela
   grep -n "DEC-2026-08-25-55" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "ASM-CHAPTER-AC-00\|ASM-PDF-AC-00" docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md | head
   ```

   **Brak (a), (b) albo (c) = STOP całego dyżuru** — pracujesz na złej bazie.

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md        # oczekiwane 160
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md   # oczekiwane 2002
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md # oczekiwane 134
   ls docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/drd-prototyp-report.html
   ls docs/product/DRD_REPORT_SPEC.md
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestry rosną) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/assessment-day20-<data> 649bd730a6
   git worktree add /private/tmp/consultify-assessment-day20 codex/assessment-day20-<data>
   cd /private/tmp/consultify-assessment-day20
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/assessment-day20-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani **`codex/assessment-fixes-20260826`** (równoległa partia napraw frontu Assessmentu, nieodebrana) | `demo` = święta baza; tamta gałąź to cudza praca w toku — patrz §1.8 |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; DEC-95 |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| **Z5** | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0 | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-assessment-fixes`, `consultify-day20-instrukcja`, `consultify-day17*`, `consultify-day18*`, `consultify-meetings-day19`, `consultify-day16-fixes`) | Cudze worktree, część w użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych** (3777, 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300/4301/4302, 4304/4305, 4306, 4312, 4319, 4324/4325, 4370, 4418, 4428, 4480/4481, 4530, 5000, 5432, **5447**, **5449**, **5467**, 6379, 7000). **Twój kontener PG = 5469**; lokalny runtime, jeśli konieczny — **4326/4327**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | 5447 = dzień 17, 5449 = dzień 19, 5467 = `cx-day19fix-pg` (żywy w chwili wystawienia) |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65) | Produkcja/demo poza zakresem |
| **Z9** | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur.** Procedura: zatrzymaj komendę → ustal skutek (czy było realne połączenie i czy był ZAPIS) → zapisz ustalenie w raporcie → przypnij env → **KONTYNUUJ pozycję**. **Twardy STOP całego dyżuru TYLKO przy stwierdzonym realnym ZAPISIE do bazy spoza dyżuru** | „dane demo = twarz produktu" (DEC-65); poprzednia wersja Z9 zabijała dyżur i marnowała dowieziony postęp |
| **Z10** | **Zero nowych flag. Zero zmian wartości domyślnej istniejącej flagi** — w szczególności `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1` zostają OFF | CLAUDE.md reguła 9 + ★ pkt 7 |
| Z11 | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/assessment/*` | Gramatyka zaakceptowana; a nadto całe `src/` jest poza zakresem (Z17) |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY20_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1` | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **Nie budujesz generowania treści modelem. ZERO LLM.** Kontrakt raportu jest deterministyczny; nie wpinasz dostawcy modelu, nie wołasz `llmService`, nie „przy okazji naprawiasz" 26 endpointów AI | Silnik AI = moduł agenta, ostatni w programie; ★ pkt 3 |
| Z15 | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** Kanon Assessmentu: „nie wiem" **nie jest liczone ani jako zero, ani jako sukces" (`AnswerEventPayload.answerState`), a `targetLevelFor` czyta wyłącznie `answerState === 'confirmed'` | Uczciwy pusty stan > udawany ekran |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`. Wolno **czytać** i **cytować** | Model uprawnień naprawiany in-house |
| **Z17** | **★ Zakaz wszystkiego poza serwerową mechaniką Assessmentu** — z imiennymi wyjątkami z ramki poniżej. **CAŁE `src/` jest zakazane bez wyjątku.** | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6) |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `tests/utils/assessmentMocks/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| **Z19** | **★★ (`DEC-2026-08-26-96` + `DEC-2026-08-26-98`) — ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego `DATABASE_URL` W TEJ SAMEJ LINII KOMENDY, wskazującego kontener tego dyżuru. Kolejność Bloku 0 = NAJPIERW kontener + PEŁNE migracje, DOPIERO potem jakikolwiek pomiar wejściowy. Do raportu obowiązkowy dowód celu połączenia (`SELECT current_database(), inet_server_port()`)** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie |
| **Z20** | **★★ NOWY (lekcja `DEC-2026-08-26-104`) — DoD wymaga dowodu OSIĄGALNOŚCI, nie istnienia kodu.** Jeżeli pozycja deklaruje „usunięto martwy kod" albo „dodano funkcję", **dowodem jest ŚCIEŻKA WYWOŁANIA od realnego wejścia** (zamontowana trasa / mount UI), **nie sam plik**. Wcześniejszy dyżur zaraportował usunięcie martwych gałęzi jako zrobione, a one **były w kodzie** — bramka DoD nie sprawdziła osiągalności | Zawyżenie wykryte osobiście przez nadzorcę na tipie m03 |
| **Z21** | **★★ NOWY (lekcja `DEC-2026-08-26-107`) — test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej.** Każda pozycja z zewnętrznym wywołaniem (LLM, mailer, inny serwis, inny runtime) **MUSI mieć co najmniej jeden test DOMYŚLNEGO OKABLOWANIA** — bez podstawionych `dependencies`. Wcześniejszy dyżur miał **8/8 zielonych testów warstwy AI, która nie mogła zadziałać**, bo czytała nieistniejące pole odpowiedzi | Domyślne okablowanie nie było testowane w ogóle |
| **Z22** | **★★ NOWY (lekcja `DEC-2026-08-26-108`) — zakaz atrapy z zewnętrznym skutkiem.** Trasa **nie może zwracać sukcesu i wywoływać skutku na zewnątrz** (e-mail, ICS, webhook, powiadomienie, publikacja, eksport), **jeżeli w bazie nic się nie zmieniło**. Operacja niewykonalna → **4xx z maszynowym kodem, ZERO efektu zewnętrznego** | `DELETE /:id/occurrence` zwracał 200 bez zmiany w bazie i rozsyłał CANCEL do uczestników |
| **Z23** | **★★ NOWY (lekcja `DEC-2026-08-26-108`) — pomiar testów BEZ ZAWĘŻANIA.** Raport podaje wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem na czerwone **ZASTANE** (zmierzone na markerze bazowym, PRZED Twoim pierwszym commitem) i **WPROWADZONE przez dyżur**. **Podanie zawężonego wyboru = naruszenie** | Deklarowane „98/98 PASS" było wyborem; w zakresie własnej instrukcji było 164/167, z dwiema czerwonymi wprowadzonymi |

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

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.** `server/src/database/Database.ts`
przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1` podstawia **mock DB** i cały pakiet
„przechodzi" przeciwko niczemu. Dodatkowo część odczytów w repo idzie przez
`DbPromise` z domyślnym `fallback:true`, więc brak tabeli potrafi udawać pustą
listę. Dlatego **każde** uruchomienie testu dotykającego bazy ma env **w tej samej
linii komendy**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day20-pg psql -U postgres -d cx_day20 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (dosłowny) **jest obowiązkową pozycją raportu**. Pomiar bez
dowodu celu = pomiar nieistniejący.

**★ Ostrzeżenie do Z9/Z19, którego nie było w dniu 19.** `DEC-98` stwierdza, że
„na localhost:5432 NIE MA żadnego działającego Postgresa". **W chwili wystawienia
tej instrukcji port 5432 NASŁUCHUJE.** Nie opieraj więc bezpieczeństwa na
założeniu „i tak się nie połączy" — opieraj je na **jawnym `DATABASE_URL`
w każdej linii**. Jeśli mimo to komenda pójdzie gdzie indziej: procedura Z9
(zatrzymaj → ustal skutek → zapisz → przypnij env → kontynuuj).

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/assessment/**                                (workflow v1, ai, hub, attachments, assessments, index)
  server/src/routes/assessment-workflow-v2.routes.ts
  server/src/routes/assessment-reports.routes.ts
  server/src/routes/index.ts                                     (WYŁĄCZNIE usunięcie martwego eksportu — pozycja F.1)
  server/src/data/drdStructure.ts                                (WYŁĄCZNIE pozycja B.1)
  server/src/services/assessment/**                              (+ __tests__ obok)
  server/src/services/aiAssessmentPartnerService.ts              (WYŁĄCZNIE pozycja B.2)
  server/src/services/aiAssessmentReportGenerator.ts             (jeśli wymusza to B.1/B.2)
  server/src/services/report/drdVizAdapter.ts · drdReportService.ts
  server/src/services/reportBuilderService.ts                    (TYLKO w zakresie E.1/E.2)
  server/src/method-core/outputs/**                              (MethodOutputService, EventDerivedOutputBridge — pozycje C/D/E)
  server/src/routes/method-core.routes.ts                        (TYLKO trasy potrzebne w C/D/E)
  server/src/services/<NOWE serwisy Assessmentu>                 (np. assessmentSkipReasonService, assessmentReportContractService)
  server/migrations/<numer>_assessment_day20_*.sql               (NOWE pliki, numeracja wg §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY20_REPORT_20260826.md          (jedyny nowy dokument)
  tests/unit/assessment/**  ·  tests/integration/assessment*     (NOWE pliki)

IMIENNE WYJĄTKI (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu/schematu):
  server/src/method-core/contracts/events.ts                     (CZYTASZ kontrakt; ZMIANA = STOP — patrz §D.1)
  server/src/method-core/MethodEventStore.ts · MethodSessionService.ts   (WOŁASZ)
  server/src/services/audits/reportRenderer.ts                   (CZYTASZ JAKO WZORZEC — to renderer modułu AUDYTY, nie Assessmentu; zmiana = STOP)
  server/src/services/assessment/drdCompletion.ts · drdEvidenceScoring.ts (WOŁASZ; zmiana tylko jeśli wymusza B.1, z jawnym wpisem)

NIE WOLNO:
  ★ CAŁE src/                                                    ← bez wyjątku, w tym src/services/api.ts i src/method-core/**
  server/src/services/**/effectiveAccessService*                 ← Z16
  server/src/services/audits/**                                  ← cudzy moduł (WOLNO CZYTAĆ reportRenderer.ts jako wzorzec)
  server/src/routes/finance-statements.routes.ts · report-builder.routes.ts  ← cudze moduły
  server/migrations/2026107x_*.sql i wcześniejsze                ← TYLKO ODCZYT (nowe DDL = nowy plik w Twoim przedziale)
  tests/e2e/**  ·  tests/acceptance/**                           ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  docs(assessment): reachability inventory of both workflow mounts (A.1)
  refactor(assessment): single canonical workflow mount, dead role block removed (A.2)
  docs(assessment): front contract table for every broken client call (A.3)
  fix(assessment): one DRD axis model across client and server (B.1)
  refactor(assessment): drop @ts-nocheck from the AI partner service (B.2)
  feat(assessment): proven server path for TO-BE target level (C.1)
  feat(assessment): closed skip-reason dictionary with machine-readable code (D.1)
  feat(assessment): report contract reads skip codes, never parsed prose (D.2)
  feat(assessment): deterministic seven-chapter report contract (E.1)
  feat(assessment): report revisions and export consistency (E.2)
  chore(assessment): remove unreachable route aggregator with proof (F.1)
  test(assessment): real-router coverage for every new and changed route (T)
  docs(assessment): raise 04_ASSESSMENT acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**.
- **★ Z21 — test domyślnego okablowania.** Każda pozycja, która woła cokolwiek
  poza własnym modułem, ma **osobny test bez wstrzykniętych zależności**,
  jadący realną, produkcyjną ścieżką konstrukcji serwisu.
- **Typy punktowo** (`npx esbuild <plik> --loader:.ts=ts --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ `fallback:false` OBOWIĄZKOWO** na każdym `DbPromise` dotykającym Twoich
  nowych tabel. Brak migracji ma być **głośnym błędem**, nie pustą listą.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — MASZ PRZYDZIELONY PRZEDZIAŁ: `20261100`–`20261109`
     (`DEC-2026-08-26-98`, rozszerzenie rezerwacji na dzień 20).** Dzień 17 =
     `20261076`–`20261079`, dzień 18 = `20261080`–`20261089`, dzień 19 =
     `20261090`–`20261099` — **te dyżury pracują RÓWNOLEGLE i ich pliki mogą
     jeszcze nie być w Twojej bazie.** Reguła „najwyższy + 1" obowiązuje
     **WYŁĄCZNIE WEWNĄTRZ Twojego przedziału**.
     **NIGDY nie licz „najwyższy zastany + 1" bez przedziału — to była
     bezpośrednia przyczyna kolizji dnia 17/18** (`DEC-107`: „ŹRÓDŁEM KOLIZJI
     BYŁA INSTRUKCJA").
     **Obowiązkowe sprawdzenie PRZED KAŻDYM plikiem:**
     ```bash
     ls server/migrations | grep '^202611'      # co już zajęte w Twoim przedziale
     ls server/migrations | grep '^20261101'    # MUSI być PUSTE przed utworzeniem pliku
     ```
     Nazwa: `<numer>_assessment_day20_<temat>.sql`. Twój pierwszy wolny numer to
     **`20261100`** — potwierdź komendą, nie pamięcią.
  3. **★ ZERO kluczy obcych** do tabel Assessmentu/method-core. Tenant
     i istnienie rodzica sprawdzasz **w warstwie aplikacji**.
  4. **Nie rozszerzasz leniwych bootstrapów tabel** (`ensure*Tables()`) — to
     ścieżka SQLite, nie ścieżka wdrożenia. Nowe kolumny/tabele idą **wyłącznie**
     migracją, a kod ma paść głośno przy jej braku.
  5. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65) — warunek oddania
     każdej pozycji z migracją.** Jednorazowy kontener, trzy przebiegi, wyniki
     do raportu — patrz Blok 0 pkt 2 i §10.1. **Sprzątanie kontenera I wolumenów
     jest obowiązkowe.**
  6. **Prawdopodobnie potrzebujesz DWÓCH migracji** (§D.1 — słownik pominięć;
     §E.2 — rewizje kontraktu raportu, o ile istniejący
     `/api/method/outputs/:id/revisions` nie wystarcza). **Zweryfikuj to w Bloku 0
     i nie dodawaj migracji „na wszelki wypadek".**

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
   kodem i **zerowym** efektem zewnętrznym (publikacja, eksport, powiadomienie).
5. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
6. **★ Z21 — co najmniej jeden test DOMYŚLNEGO OKABLOWANIA** dla każdej pozycji
   wołającej cokolwiek spoza własnego modułu (bez wstrzykniętych `dependencies`).
7. **★ Test HTTP realnego routera** przez `supertest`, na **realnym PG**, z bootem
   realnego pliku tras (zamockowany wyłącznie `auth.middleware` i `Logger`).
   Test na zmockowanym serwisie **nie zastępuje** tego wymogu.
8. **★ Z20 — dowód OSIĄGALNOŚCI**, nie istnienia kodu. Dla każdej pozycji
   podajesz **ścieżkę wywołania od realnego wejścia**: `Gateway.ts:<linia>
   app.use('<mount>') → <plik tras>:<linia> → <serwis>:<linia>`. Dla pozycji
   „usunięto martwy kod" — dowodem jest **pusty wynik grepa importerów**
   sprzed usunięcia i przechodzące testy po usunięciu.
9. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query.
10. **Realny PG w jednorazowym Dockerze** z pełnymi migracjami, z dowodem celu
    połączenia (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem + **wpis w raporcie**:
    `pozycja → commit SHA → status → dowód osiągalności → dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem (§1.6). Klucze `assessment.*` tworzysz **wyłącznie**
> dla napisów, które faktycznie wychodzą z Twojego API (komunikaty błędów,
> etykiety kodów pominięcia) — i wtedy parytet PL+EN obowiązuje w tym samym
> commicie, w `public/locales/{pl,en}/translation.json`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze bazowym, PRZED pierwszym commitem** → to są czerwone
     **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE
     przez dyżur**.
   Obie liczby idą do raportu, w formacie `X/Y PASS`, per plik.
3. Uruchom **minimum** poniższą listę (każde z jawnym `DATABASE_URL` tam, gdzie
   dotyka bazy — Z19):
   ```bash
   npx vitest run server/src/routes/v8/__tests__/assessment.routes.test.ts
   npx vitest run server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts
   npx vitest run server/src/services/assessment/__tests__
   npx vitest run server/src/method-core/__tests__
   npx vitest run server/src/method-core/outputs/__tests__
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
   npx vitest run tests/components/assessment          # regresja frontu — NIE zmieniasz go, ma być zielony
   npx vitest run src/components/assessment/drd/__tests__   # jw.
   npx vitest run src/method-core/methods/drd/__tests__     # jw.
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego), **z osobną tabelą „czerwone ZASTANE" i „czerwone
   WPROWADZONE"**. **Czerwonych zastanych NIE naprawiasz** — opisujesz.
   **Każdą czerwoną wprowadzoną** albo naprawiasz, albo zgłaszasz jako STOP;
   przemilczenie = naruszenie.
5. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu
   „przed/po" w raporcie.** Zamiana `toBe` → `not.toBe`, usunięcie asercji
   parametrów, podmiana twardego oczekiwania na bezzębne `404` — wszystko to
   jest osłabieniem i wszystko wymaga wpisu. Osłabienie bez wpisu = odrzucenie.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić cokolwiek w `src/` (Z17) — **zawsze STOP, bez wyjątku**;
- zmienić współdzielony kontrakt jądra `MethodEvent`/`AnswerEventPayload`
  (`server/src/method-core/contracts/events.ts`) — patrz §D.1, to jest
  rozstrzygnięcie nadzorcy, nie Twoje;
- rozstrzygnąć konflikt kanonu „7 osi (DEC-46)" vs „8 wymiarów
  (`docs/product/DRD_REPORT_SPEC.md`, kryterium `ASM-CHAPTER-AC-008`
  = `CANON_DECISION_REQUIRED`) — **nie usuwasz mapowania 8D i nie twierdzisz,
  że konflikt jest rozwiązany**;
- zmienić treść merytoryczną modelu DRD (opisy poziomów, liczbę poziomów osi)
  bez oparcia w źródle — patrz §B.1, gdzie źródło jest wskazane;
- dodać migrację nieaddytywną albo zmieniającą typ/znaczenie istniejącej kolumny;
- wyjść poza przydzielony przedział numerów migracji `20261100`–`20261109`;
- stworzyć flagę funkcyjną albo zmienić wartość domyślną istniejącej (Z10);
- wpiąć dostawcę modelu / wygenerować treść LLM (Z14);
- zbudować trasę bez realnej ścieżki zapisu (→ `BRAK_API`, nie atrapa) albo
  trasę zwracającą sukces bez zmiany w bazie (→ Z22);
- usunąć kod, dla którego **nie masz dowodu zerowej osiągalności** (Z20) —
  wtedy zostawiasz go i wpisujesz do „Znalezisk";
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- uruchomić test bazodanowy bez jawnego `DATABASE_URL` w tej samej linii (Z19) —
  to nie jest STOP do eskalacji, tylko **zakaz**: postaw kontener, zmigruj,
  udowodnij cel połączenia i dopiero mierz;
- kolidować z równoległą gałęzią `codex/assessment-fixes-20260826` (§1.8) —
  to jest `COORDINATION_REQUIRED`, nie samodzielne rozwiązywanie (DEC-65).

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

Panel adwersaryjny ocenił moduł **Ocena/Assessment** na **4,0/10 przy celu 9,5**
(`DEC-2026-08-26-103`: partner 4,0 · ekspert metodyczny 4,5 · UX 5,0 · inżynier
jakości 3,0 · sceptyk 2,5). Trzy powody rozstrzygające, cytowane z rejestru:

1. **Deliverable nie istnieje** — zakładka Raport renderuje tę samą macierz co
   Matrix plus jedno zdanie na obszar; kontrakt właściciela (7 rozdziałów,
   synteza 120–180 słów, komentarz per obszar, „Eksportuj wszystko") ma **zero
   implementacji**.
2. **Moduł AI-native nie ma AI** — 26 endpointów `/api/assessment/:projectId/ai/*`
   zamontowanych i działających, **zero żywych konsumentów**.
3. **Zaakceptowana architektura jest wyłączona** — `drdMethodWorkspaceSliceV1` /
   `methodWorkspaceShellV1` domyślnie OFF.

Do tego: 12 metod `api.ts` wołających nieistniejące trasy (404), słownik kodów
„Pomiń" (DEC-55) = 0 linii kodu po stronie serwera, brak TO-BE (DEC-37),
sprzeczne modele osi DRD, 8+ plików tras bez konsumenta.

**Ten dyżur robi WYŁĄCZNIE mechanikę tylną.** Punkty (2) i (3) oraz cały front
raportu są poza zakresem — czekają na prototyp i akcept właściciela.

### 1.2. ★ KOREKTY DO MATERIAŁU PANELU — przeczytaj, zanim uwierzysz w zakres

**Nadzorca zweryfikował materiał panelu w kodzie na tipie `codex/m03-admin-20260824`
i trzy tezy okazały się NIEŚCISŁE. Instrukcja opiera się na stanie faktycznym,
nie na tezach panelu. Ty weryfikujesz to ponownie w Bloku 0 — jeżeli Twój wynik
różni się od poniższego, to jest wpis w „Korektach wobec instrukcji", nie powód
do improwizacji.**

| Teza panelu | Stan faktyczny (zweryfikowany) | Skutek dla zakresu |
| --- | --- | --- |
| „5 osi na serwerze w ścieżce AI (`aiAssessmentPartnerService.ts:53-115`, `DRD_AXES`)" | **`DRD_AXES` ma SIEDEM osi** — `processes`, `digitalProducts`, `businessModels`, `dataManagement`, `culture`, **`cybersecurity`**, **`aiMaturity`**. Cytowany zakres `53-115` kończył się **w środku obiektu**, po piątej osi. | **§B NIE jest migracją 5→7.** Prawdziwy dryf jest gdzie indziej — patrz następny wiersz. |
| „7 osi w kliencie vs 5 na serwerze" | Obie kopie struktury mają **7 osi**, ale **rozjechały się co do SKALI**: `src/services/drdStructure.ts` daje osi 5 (Kultura) i 6 (Cyberbezpieczeństwo) `levelCount: 6`, a `server/src/data/drdStructure.ts` daje im `levelCount: 5`. Całość różni się **797 liniami** (treść PL, opisy poziomów). | **§B.1 = usunięcie dryfu skal i treści między dwiema kopiami.** To realny błąd wyniku: procent i poziom dla osi 5 i 6 liczą się po różnych skalach po obu stronach. |
| „Brak TO-BE (DEC-37)" | Model TO-BE **istnieje w jądrze**: `DecisionEventPayload.subject: 'target_level'` (`server/src/method-core/contracts/events.ts:177`), emisja przez HTTP (`drdHttpSessionRuntime.ts:355`), wyprowadzenie (`EventDerivedOutputBridge.ts:103`), trwałość (`MethodOutputService` kolumna `target_level`), mount `/api/method` (`Gateway.ts:958`). | **§C NIE jest budową modelu od zera**, tylko **dowodem ścieżki produkcyjnej** (Z21) i domknięciem tego, czego dowód nie potwierdzi. |
| „`reportRenderer.ts:401` to punkt wyjścia dla raportu Assessmentu" | `reportRenderer.ts` leży w **`server/src/services/audits/`** — to renderer **modułu AUDYTY**. | Wolno go **CZYTAĆ jako wzorzec** (czysta funkcja, wstrzykiwany zegar, lista sekcji). **Zmiana = STOP (Z17).** |

**Wniosek metodyczny — obowiązuje Cię w każdej pozycji:** materiał diagnostyczny
jest hipotezą, kod jest prawdą. **Każda pozycja zaczyna się od weryfikacji
w kodzie i na żywej bazie**, a rozbieżność wobec tej instrukcji jest **wpisem
w raporcie**, nie powodem do zgadywania (CLAUDE.md, złota reguła 1).

### 1.3. ZAKRES — dokładnie trzynaście pozycji, nic więcej

| Poz. | Nazwa | Stan dziś | Twój produkt |
| --- | --- | --- | --- |
| **A.1** | Inwentarz osiągalności obu mountów workflow | dwa mounty, oba żywe | Tabela dowodowa (zero kodu produkcyjnego) |
| **A.2** | Jeden kanoniczny mount + usunięcie martwego bloku | v1 `1786–2443` martwe | Usunięcie z dowodem Z20 albo przekierowanie |
| **A.3** | Kontrakt dla frontu | 12 metod `api.ts` = 404 | Tabela trasa→kształt (wejście robotnika frontowego) |
| **B.1** | JEDEN model osi DRD (DEC-46) | dryf skal osi 5 i 6 | Serwer zgodny z klientem, dowód na danych |
| **B.2** | `@ts-nocheck` w `aiAssessmentPartnerService` | 1439 linii bez typów | Zdjęte albo uzasadniony STOP |
| **C.1** | TO-BE (DEC-37) — dowód i domknięcie | model jest, dowodu brak | Test domyślnego okablowania + odczyt dla Interview |
| **D.1** | Słownik kodów „Pomiń" (DEC-55) | 0 linii po stronie serwera | Model + API, 4 kody zamknięte |
| **D.2** | Odczyt pominięcia w kontrakcie raportu | brak | Kod maszynowy, nigdy parsowanie polskiego zdania |
| **E.1** | Deterministyczny kontrakt raportu 7 rozdziałów | zero implementacji | API struktury (bez treści, bez LLM) |
| **E.2** | Rewizje raportu (DEC-47) + spójność eksportu | częściowo w `/api/method/outputs` | Migawka rewizji + jedna prawda dla eksportu |
| **F.1** | Sprzątanie nieosiągalnego serwera | agregator bez importera | Usunięcie z dowodem zerowej osiągalności |
| **T** | Testy wszystkich nowych/zmienionych tras | — | Realny router + realny PG |
| **R.1** | `MODULE_ACCEPTANCE.md` 04_ASSESSMENT | nie podniesiony | Podniesienie o **faktycznie dowieziony** zakres |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`** — komponenty, hooki, `api.ts`, `src/method-core/**`,
   `src/services/drdStructure.ts`. Bez wyjątku.
2. **★ Prototypy i wygląd.** Nie tworzysz prototypów, nie robisz zrzutów,
   nie oceniasz wyglądu. Formuła polerowania grafiki + CLAUDE.md reguła 7:
   **właściciel nigdy nie jest pierwszym testerem wizualnym**, a Ty nie jesteś
   od wizualnego w ogóle.
3. **★ Podpięcie 26 endpointów AI do UI** — front po prototypie. Ty ich **nie
   usuwasz** i **nie zmieniasz**.
4. **★ Eksport PDF jako plik** — renderer, paginacja, TOC, znak wodny `DRAFT`.
   Twoim produktem jest **kontrakt**, nie plik.
5. **Generowanie treści raportu modelem** (Z14). Kontrakt niesie **sloty
   i limity**, nie zdania.
6. **Włączenie flag `drdMethodWorkspaceSliceV1` / `methodWorkspaceShellV1` /
   `drdHttpSourceOfTruthV1`** — robi nadzorca po odbiorze frontu (Z10).
7. **Rozstrzygnięcie kanonu 7 osi vs 8 wymiarów raportu** — `ASM-CHAPTER-AC-008`
   ma status `CANON_DECISION_REQUIRED`; to decyzja właściciela/nadzorcy.
8. **Naprawa 30 martwych komponentów frontu (~438 KB)** — front.

### 1.5. Decyzje wiążące

1. **`DEC-2026-08-25-37`** — TO-BE: cel **widoczny w Interview** jako kontekst na
   karcie poziomu (odczyt: „Cel: poziom N" + dystans do celu), **edytowalny
   wyłącznie w Matrix** („Ustaw TO-BE") — **jedno źródło edycji**. Front do
   walidacji na prototypie; Ty dostarczasz **stronę serwerową obu operacji**.
2. **`DEC-2026-08-25-46`** — **7 osi wszędzie** (raport/eksport/opis produktu);
   stary spec 8 wymiarów i preview „5 osi" do poprawy. **OWNER_ACCEPT.**
3. **`DEC-2026-08-25-47`** — **Report = jeden obiekt przy sesji z historią
   wersji**; eksport do Materiałów jako **migawka**. **OWNER_ACCEPT.**
4. **`DEC-2026-08-25-55`** — **słownik kodów „Pomiń", cztery kody** (treść
   w §D.1); wybór kodu **wymagany** przy decyzji Pomiń; mapowanie na
   `AnswerEventPayload.skipReason`. **OWNER_ACCEPT.**
5. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz
   deployów, Railway, zdalnych migracji/seedów, zapisów do wspólnej bazy.
   **Prawo nadrzędne.**
6. **`DEC-2026-08-26-95`** — rozejście marker→tip bez kolizji rozstrzyga
   nadzorca; dokładny start z markera, bez rebase (§0.1 pkt 2).
7. **`DEC-2026-08-26-96`** — **Z19** (kolejność Bloku 0, jawny `DATABASE_URL`,
   dowód celu połączenia).
8. **`DEC-2026-08-26-98`** — **korekta Z9** (przerywa czynność, nie dyżur; twardy
   STOP tylko przy realnym ZAPISIE spoza dyżuru), **mechanizm env w tej samej
   linii**, **rezerwacja numerów migracji** (Twój przedział: `20261100`–`20261109`).
9. **`DEC-2026-08-26-103`** — panel ekspercki modułu Ocena (źródło zakresu).
10. **`DEC-2026-08-26-104`** — **Z20**: DoD musi wymagać dowodu **osiągalności**,
    nie istnienia kodu.
11. **`DEC-2026-08-26-107`** — **Z21**: test wstrzykujący zależności nie dowodzi
    ścieżki produkcyjnej.
12. **`DEC-2026-08-26-108`** — **Z22** (zakaz atrapy z zewnętrznym skutkiem)
    i **Z23** (pomiar testów bez zawężania).
13. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji ze
    sprawdzeniem przed każdym plikiem.

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ty = TYŁ.** Migracje, serwisy, trasy, semantyka zapisu, kontrakty odpowiedzi,
testy, dowody osiągalności. **Robotnicy wewnętrzni = FRONT**, po prototypie
i akcepcie właściciela na czystym zrzucie.

Praktycznie:
- Ustalasz, że kanoniczną trasą raportu jest `X` i publikujesz jej kształt —
  **nie** poprawiasz `src/services/api.ts`.
- Budujesz API zapisu celu TO-BE — **nie** budujesz akcji „Ustaw TO-BE"
  w side-sheecie Matrixa.
- Budujesz API pominięcia z zamkniętym słownikiem — **nie** budujesz pickera.
- Zwracasz strukturę 7 rozdziałów z limitami słów jako metadanymi — **nie**
  renderujesz rozdziału i **nie** piszesz jego treści.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do frontu — **należy do frontu**, a Ty wpisujesz to do „Znalezisk"
jako „kontrakt gotowy, front do zbudowania".

Twoim obowiązkiem wobec frontu jest **jawny kontrakt w raporcie**: dla każdej
trasy podajesz metodę, ścieżkę, kształt body, kształt odpowiedzi, kody błędów.
To jest dosłownie wejście dla robotnika frontowego (§A.3).

### 1.7. Stan faktyczny — co JUŻ JEST (i czego NIE budujesz od nowa)

Zweryfikuj każdą linię w Bloku 0; rozbieżność → „Korekty wobec instrukcji".

```
# MOUNTY (Gateway.ts)
:638   app.use('/api/assessment-workflow',    assessmentWorkflowRoutes)      ← v1, 2443 linie, 31 tras
:640   app.use('/api/assessment-workflow-v2', assessmentWorkflowV2Routes)    ← v2, 1865 linii, 41 tras
:1083  app.use('/api/assessment', ..., assessmentAIRoutes)                   ← 26 tras /:projectId/ai/*
:1084  mountStub('/api/assessment', assessmentRoutes, 'assessmentRoutes')    ← 25-liniowy stub 503
:1102  app.use('/api/assessments',                assessmentHubRoutes)
:1103  app.use('/api/assessment-reports',         assessmentReportsRoutes)   ← 12-liniowy shim → routes/assessment-reports.routes.ts (2893 linie, 27 tras)
:1104  app.use('/api/assessment-level-attachments', assessmentLevelAttachmentsRoutes)
:958   app.use('/api/method',                     methodCoreRoutes)          ← 29 tras: sesje, zdarzenia, outputy, rewizje, freeze, lineage
:1296  app.use('/api/assessments-v4',             assessmentEnterpriseRoutes)

# ★ KANONICZNOŚĆ JEST JUŻ ZADEKLAROWANA W KODZIE
server/src/routes/assessment/assessment.routes.ts:1-2
  "DEPRECATED: Use /api/assessment-workflow-v2 instead."
  "V4-ASMT-02: All new assessment features go to assessment-workflow-v2.routes.ts"

# MODEL OSI (dwie kopie, DRYF)
src/services/drdStructure.ts        7 osi · levelCount 7,5,5,7,6,6,5 · 2191 linii
server/src/data/drdStructure.ts     7 osi · levelCount 7,5,5,7,5,5,5 · 1878 linii   ← oś 5 i 6 rozjechane
server/src/services/aiAssessmentPartnerService.ts:53   DRD_AXES = 7 osi (nie 5!), // @ts-nocheck na 1439 liniach
server/src/services/report/drdVizAdapter.ts            już 7-osiowy, honoruje mieszane skale 5/6/7

# TO-BE (istnieje, brak dowodu)
server/src/method-core/contracts/events.ts:177   subject: 'current_level' | 'target_level' | 'freeze' | 'output_approval'
server/src/method-core/outputs/EventDerivedOutputBridge.ts:103  wyprowadzenie celu ze zdarzenia
server/src/method-core/outputs/MethodOutputService.ts:211,448   kolumna target_level per jednostka
src/method-core/methods/drd/drdHttpSessionRuntime.ts:355        emisja przez HTTP (KLIENT — tylko czytasz)
src/components/assessment/drd/drdWorkspaceViewModel.ts:55       odczyt celu (KLIENT — tylko czytasz)

# RAPORT (istnieje warstwa, brak kontraktu właściciela)
server/src/routes/assessment-reports.routes.ts
  :963  GET  /:reportId/full          :1062 GET  /:reportId/drd-report
  :1430 GET  /:reportId/sections      :1477 POST /:reportId/sections
  :2465 GET  /:reportId/export/pdf    ← MA konsumenta (useReportSections.ts:552)
  :2556 GET  /:reportId/export/excel  ← MA konsumenta (useReportSections.ts:585)
  :2509 GET  /:reportId/export/pptx   ← ZERO konsumentów
  :2623 GET  /:reportId/export/deck   ← ZERO konsumentów
server/src/routes/method-core.routes.ts:1412  GET /outputs/:id/revisions   ← wersjonowanie DEC-47 JUŻ ISTNIEJE
server/src/services/audits/reportRenderer.ts  ← WZORZEC (cudzy moduł, zmiana = STOP)

# NIEOSIĄGALNE (pozycja F.1)
server/src/routes/index.ts:18   export assessmentDomainRoutes from './assessment/index.js'
  → barrel `routes/index.ts` NIE JEST importowany przez nikogo (jedyne trafienie grepa to on sam)
  → server/src/routes/assessment/index.ts (28 linii) nieosiągalny
  → server/src/routes/assessment/assessments.routes.ts (497 linii, 11 handlerów) nieosiągalny
  Precedens tego samego wzorca opisany w server/src/routes/organization/partner-code.routes.ts:31

# ZEPSUTE WYWOŁANIA KLIENTA (pozycja A.3 — TY ICH NIE NAPRAWIASZ, TY JE OPISUJESZ)
src/services/api.ts:8351,8363,8375,8387,8399,8408,8420,8430,8440,8447,8455  → 11 metod na mount v1 w kształcie v2
src/services/api.ts:8242,8272                                              → 2 dalsze na tym samym moucie (do weryfikacji)
src/components/assessment/AssessmentVersionDiff.tsx:100,103                → /versions/:version (v1 ma /versions oraz /versions/:from/diff/:to)
src/components/Reports/ImportReportModal.tsx:122                           → POST /api/assessment-reports/import (trasa nie istnieje)
src/hooks/useAssessmentAttachments.ts:164                                  → GET /api/assessment-level-attachments/:assessmentId (trasa nie istnieje)
src/components/assessment/ReportEditorModal.tsx:194                        → POST /api/ai/assessment/report-section (trasa nie istnieje)

# MARTWE PANELE AI (NIE USUWASZ — czekają na front)
src/components/assessment/AIAssessmentSidebar.tsx      0 importerów
src/components/assessment/AISuggestionPanel.tsx        0 importerów
src/components/assessment/AssessmentAxisWorkspace.tsx  0 importerów
```

### 1.8. ★ RÓWNOLEGŁA GAŁĄŹ — obowiązkowa koordynacja

Gałąź **`codex/assessment-fixes-20260826`** (commit `4b8156f0f4`, **NIEODEBRANA,
NIESCALONA**) niesie **tanią partię napraw frontu Assessmentu** zleconą tą samą
decyzją `DEC-103`. Dotyka m.in.:

```
src/components/method-workspace/skipReasonCodes.ts          ← ★ FRONTOWY słownik 4 kodów „Pomiń"
src/components/method-workspace/ResolutionCard.tsx
src/components/method-workspace/InterviewFocusPanel.tsx
src/components/method-workspace/useMethodWorkspaceSave.ts
src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx
src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx
```

**Co to dla Ciebie znaczy — trzy twarde reguły:**

1. **Nie dotykasz tej gałęzi i nie scalasz jej do siebie** (Z2). Nie kopiujesz
   z niej kodu do `server/`.
2. **Twój backend §D.1 MUSI przyjmować dokładnie te cztery kody**, które ta
   gałąź już wysyła. Wolno Ci **odczytać** jej plik przez `git show`, żeby się
   nie rozjechać:
   ```bash
   git show codex/assessment-fixes-20260826:src/components/method-workspace/skipReasonCodes.ts
   ```
   To jest **jedyne** dozwolone dotknięcie tej gałęzi i jest to **odczyt**.
3. **Ta gałąź udokumentowała obejście, które Ty masz zastąpić.** Front pisze
   dziś kod pominięcia jako **sformatowany polski tekst** w polu `justification`
   (`Pominięto — <etykieta>.`), bo jądro **nie ma** pola `skipReason`. Twoim
   produktem jest **maszynowy, zamknięty kod** po stronie serwera — patrz §D.1
   i §D.2. **Nie budujesz drugiego parsera polskiego zdania.**

Kolizja merytoryczna z tą gałęzią = **`COORDINATION_REQUIRED`** w raporcie,
nigdy samodzielne rozwiązanie (DEC-65).

### 1.9. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`NODE_ENV=test` bez `RUN_DB_TESTS=1` = mock DB.** Cały pakiet „przechodzi"
   przeciwko niczemu (Z19). Port 5432 **nasłuchuje** — nie licz na to, że złe
   połączenie samo się nie uda.
2. **`DbPromise` z domyślnym `fallback:true` maskuje brak tabeli jako pustą
   listę.** Twój nowy kod trzyma `{fallback:false}`.
3. **Dwa mounty workflow są OBA ŻYWE.** v1 ma realnych konsumentów
   (`/comments`, `/activity-logs`, `/status`, `/submit-for-review`, `/approve`,
   `/reject`, `/versions`, `/restore/:v`, `/presence`, `/activities`,
   `/reviews/:id/submit`). **Skasowanie v1 w całości to regresja produktu.**
   Martwy jest **blok ról i wniosków o dostęp**, nie cały plik — §A.2.
4. **`assessment-reports` ma DWA pliki o tej samej nazwie.** Zamontowany jest
   12-liniowy shim `routes/assessment/assessment-reports.routes.ts`, który
   re-eksportuje realny router `routes/assessment-reports.routes.ts` (2893 linie).
   Grep po samej nazwie pliku Cię oszuka — **zawsze sprawdzaj mount w `Gateway.ts`**.
5. **`export/pdf` i `export/excel` MAJĄ konsumentów; `export/pptx` i `export/deck`
   NIE.** Nie usuwaj wszystkich czterech „bo eksporty są martwe".
6. **`reportRenderer.ts` należy do AUDYTÓW.** Wzorzec — tak. Zmiana — STOP.
7. **Dryf modelu osi jest o SKALĘ, nie o liczbę osi.** Oś 5 i 6: klient 6 poziomów,
   serwer 5. Zmiana `levelCount` **zmienia wynik procentowy** — to nie jest
   kosmetyka, to jest zmiana danych wyjściowych. Dowód liczbowy przed/po jest
   obowiązkowy (§B.1).
8. **Klient uzasadnia swoją skalę źródłem** (`src/services/drdStructure.ts:1159`:
   „Per the DRD book, 5A describes leadership TYPES (not better/worse), while
   5B–5E use a 1–6 maturity scale"). Serwer takiego uzasadnienia nie ma.
   To wskazuje kierunek uzgodnienia — **serwer do klienta** — ale **nie zwalnia
   Cię z weryfikacji**, bo `src/` jest poza zakresem i zmieniasz **tylko serwer**.
9. **`AnswerEventPayload` NIE MA pola `skipReason`** ani stanu `'skipped'`
   (`server/src/method-core/contracts/events.ts:131-147`; stany to `confirmed`,
   `partial`, `no`, `dont_know`, `no_evidence`, `not_applicable`). DEC-55 mówi
   „mapowanie na `AnswerEventPayload.skipReason`" — **tego pola nie ma**.
   Dodanie go to zmiana **współdzielonego jądra**, mirrorowanego w `src/`
   (poza zakresem) i używanego także przez SIRI/Audyty. **To jest STOP do
   nadzorcy** — §D.1 mówi, co robisz zamiast.
10. **Kanon „nie wiem ≠ zero i ≠ sukces" jest nienaruszalny.** `targetLevelFor`
    i ramp poziomów liczą **wyłącznie** `answerState === 'confirmed'`. Twój kod
    ma trzymać tę samą dyscyplinę (Z15).
11. **Kanon raportu ma nierozstrzygnięty konflikt 7 vs 8** (`ASM-CHAPTER-AC-008`
    = `CANON_DECISION_REQUIRED`, `docs/product/DRD_REPORT_SPEC.md` opisuje osiem
    rozdziałów). **Nie usuwasz mapowania 8D i nie ogłaszasz konfliktu za
    rozwiązany** — budujesz kontrakt 7-rozdziałowy wg DEC-46 i wpisujesz
    konflikt do „Pozycji otwartych".
12. **Limity słów są METADANYMI, nie walidacją treści.** Kontrakt niesie
    `minWords`/`maxWords`; serwer **nie odrzuca** rozdziału za długość i **nie
    generuje** tekstu (Z14).

---

## §A. JEDEN KANONICZNY MOUNT WORKFLOW — trzy pozycje

### A.1 — Inwentarz osiągalności obu mountów (pozycja dowodowa, zero kodu produkcyjnego)

**Produkt:** jedna tabela w raporcie. Bez niej pozycje A.2 i A.3 są zgadywaniem.

Dla **każdej** trasy obu mountów (`/api/assessment-workflow` — 31 tras;
`/api/assessment-workflow-v2` — 41 tras) ustalasz i wpisujesz:

| Kolumna | Jak ustalasz |
| --- | --- |
| Mount | `Gateway.ts:<linia>` |
| Metoda + ścieżka | z pliku tras, `<plik>:<linia>` |
| **Żywy konsument w `src/`?** | `grep -rn "<ścieżka>" src/` — **cytat `plik:linia` albo jawne `BRAK`** |
| Konsument w `tests/`? | jw. (test nie czyni trasy żywą, ale wyjaśnia, czemu jest zielona) |
| Odpowiednik po drugiej stronie | ta sama semantyka na drugim moucie? `TAK/NIE/INNA SEMANTYKA` |
| Werdykt | `ŻYWA` · `MARTWA` · `DUBLET` · `ZEPSUTY KONSUMENT (404)` |

**Reguły twarde tej pozycji:**
1. **`MARTWA` wymaga PUSTEGO wyniku grepa**, wklejonego dosłownie do raportu
   (Z20). „Wygląda na martwą" nie jest werdyktem.
2. **Trasy z konsumentem, który dostaje 404** (bo woła kształt v2 na moucie v1),
   klasyfikujesz jako `ZEPSUTY KONSUMENT (404)` — **nie** jako `MARTWA`. To dwie
   różne naprawy: pierwsza jest frontowa (A.3), druga serwerowa (A.2).
3. Zero commitów produkcyjnych w tej pozycji. Commit = wyłącznie raport.

### A.2 — Jeden kanoniczny mount + usunięcie martwego bloku

**Kanoniczność jest już zadeklarowana w kodzie i tę deklarację przyjmujesz:**

```
server/src/routes/assessment/assessment.routes.ts:1-2
  DEPRECATED: Use /api/assessment-workflow-v2 instead.
  V4-ASMT-02: All new assessment features go to assessment-workflow-v2.routes.ts
```

**Kanoniczny jest `/api/assessment-workflow-v2`.** Jeżeli Twój inwentarz A.1
temu przeczy — **to jest STOP**, nie samodzielna zmiana kanonu.

**Co robisz:**

1. **Usuwasz udowodniony martwy blok v1** — ról i wniosków o dostęp,
   `server/src/routes/assessment/assessment-workflow.routes.ts` **linie
   1786–2443**: `GET /:id/my-role`, `GET /:id/roles`, `POST /:id/roles`,
   `DELETE /:id/roles/:targetUserId`, `POST /:id/access-requests`,
   `GET /:id/access-requests` oraz trzy dalsze handlery `:2186`, `:2289`, `:2379`.
   **Warunek konieczny (Z20):** wklejony do raportu pusty wynik
   ```bash
   grep -rn "assessment-workflow/[^\"']*\(my-role\|roles\|access-requests\)" src/
   grep -rn "assessment-workflow/" src/ | grep -v "v2" | grep -E "roles|my-role|access-requests"
   ```
   **Jeśli którykolwiek grep coś zwróci — NIE USUWASZ.** Wpisujesz do „Znalezisk"
   i idziesz dalej. Usunięcie kodu, który ktoś woła, to regresja gorsza niż
   martwy kod.

2. **Trasy v1 z ŻYWYM konsumentem zostają nietknięte.** Lista z §1.9 pkt 3 jest
   orientacyjna — wiążąca jest Twoja tabela A.1. **Nie przenosisz ich do v2
   w tym dyżurze** (to zmiana kontraktu dla żywego frontu = zakres frontowy).

3. **Trasy z `ZEPSUTYM KONSUMENTEM (404)`:** masz **dwie** dopuszczalne opcje
   i wybierasz **jedną**, z uzasadnieniem w raporcie:
   - **Opcja 1 (preferowana): nic nie robisz na serwerze**, bo kanoniczna trasa
     **już istnieje na v2** — naprawa jest frontowa i idzie do tabeli A.3.
   - **Opcja 2: przekierowanie zgodności** na v1 (`307`/delegacja do handlera v2)
     — **wolno tylko wtedy**, gdy semantyka jest identyczna, i **zawsze**
     z testem realnego routera dowodzącym, że obie ścieżki dają ten sam wynik
     i tę samą kontrolę tenanta.
   **Opcja 3 („zdublować handler w v1") jest ZAKAZANA** — to tworzy trzeci model.

4. **`assessment.routes.ts` (25-liniowy stub 503) zostaje.** Jest zamontowany
   (`Gateway.ts:1084`), zwraca uczciwe `503 not_configured` i **niesie deklarację
   kanonu**. Usunięcie go = utrata jedynego pisemnego śladu decyzji V4-ASMT-02.

**DoD A.2:** martwy blok usunięty **z dowodem pustego grepa**, wszystkie żywe
trasy v1 dalej odpowiadają (test realnego routera, minimum po jednej z każdej
grupy: komentarze, logi, wersje, przegląd, obecność), zero zmian w `src/`.

### A.3 — Kontrakt dla frontu (produkt czysto dokumentowy, ale OBOWIĄZKOWY)

**To jest wejście dla robotnika frontowego. Bez niego dyżur nie domyka pozycji A.**

Tabela w raporcie, jeden wiersz na **każde** zepsute wywołanie klienta z §1.7:

| Kolumna | Treść |
| --- | --- |
| Wołający | `plik:linia` w `src/` |
| Co woła dziś | metoda + pełna ścieżka |
| Wynik dziś | `404` / `503` / `200 ale zły kształt` — **zweryfikowany testem realnego routera, nie domysłem** |
| **Trasa kanoniczna** | metoda + pełna ścieżka na v2 (albo `BRAK_API`) |
| Kształt body | JSON |
| Kształt odpowiedzi | JSON |
| Kody błędów | lista z semantyką |
| Uwaga dla frontu | np. „ta sama nazwa, inny kształt odpowiedzi — mapowanie po stronie klienta" |

**Reguły twarde:**
1. **Nie zmieniasz `src/`** — ani jednej linii, także „przy okazji".
2. Jeżeli dla danego wywołania **nie ma** trasy kanonicznej (np.
   `POST /api/assessment-reports/import`, `POST /api/ai/assessment/report-section`,
   `GET /api/assessment-level-attachments/:assessmentId`) — wpisujesz `BRAK_API`
   **i nie budujesz jej „przy okazji"**. Budowa nowej powierzchni wymaga
   decyzji o zakresie; wpisujesz ją do „Pozycji otwartych".
3. **Wynik „dziś" musi być zmierzony**, nie wywnioskowany z listy tras. Minimum:
   jeden test realnego routera, który uderza w cztery reprezentatywne ścieżki
   i asertuje `404`.

---

## §B. JEDEN MODEL OSI DRD (DEC-46) — dwie pozycje

### B.1 — Usunięcie dryfu między dwiema kopiami struktury DRD

**Fakt wejściowy (zweryfikuj sam, komendą z §0.1 pkt 3b):**

| Oś | Nazwa | `src/services/drdStructure.ts` | `server/src/data/drdStructure.ts` |
| --- | --- | --- | --- |
| 1 | Digital Processes | 7 | 7 |
| 2 | Digital Products | 5 | 5 |
| 3 | Digital Business Models | 5 | 5 |
| 4 | Data Management | 7 | 7 |
| **5** | **Culture of Transformation** | **6** | **5** |
| **6** | **Cybersecurity** | **6** | **5** |
| 7 | AI Maturity | 5 | 5 |

Poza `levelCount` obie kopie różnią się **797 liniami** treści (nazwy obszarów,
opisy poziomów, język — klient ma polskie opisy z cytatem z książki DRD, serwer
angielskie opisy generyczne).

**Co robisz — i czego NIE robisz:**

1. **Zmieniasz WYŁĄCZNIE `server/src/data/drdStructure.ts`.** `src/` jest poza
   zakresem (Z17). Kierunek uzgodnienia: **serwer → klient**, bo klient niesie
   jawne uzasadnienie źródłowe (§1.9 pkt 8), a serwer nie.
2. **Najpierw DOWÓD SKUTKU, potem zmiana.** Przed zmianą, na realnym PG,
   wyliczasz dla przykładowej sesji z odpowiedziami na osiach 5 i 6:
   - procent/poziom osi wg serwera (`drdCompletion.ts`, `drdEvidenceScoring.ts`,
     `drdVizAdapter.ts`, `MethodOutputService`),
   - te same liczby po zmianie.
   **Tabela przed/po jest obowiązkowa.** Jeżeli liczby się nie zmieniają —
   to znaczy, że `levelCount` nie jest tam czytany i **masz zły cel zmiany**:
   wtedy STOP i opis, gdzie skala jest faktycznie konsumowana.
3. **Zmiana jest addytywna wobec danych.** Nie migrujesz istniejących odpowiedzi,
   nie przeliczasz zapisanych wyników, nie ruszasz zamrożonych rewizji.
   Poziom `6` zapisany kiedyś przy `levelCount: 5` **nie znika** — ma pozostać
   czytelny. Jeśli któryś odczyt przycina wartość do `levelCount`, to jest
   **znalezisko do opisania**, nie cicha korekta danych.
4. **Treść merytoryczna (opisy poziomów PL/EN) — ostrożnie.** Wyrównanie
   `levelCount` osi 5 i 6 **wymaga** istnienia szóstego poziomu po stronie
   serwera. Bierzesz go **dosłownie z kopii klienckiej** (odczyt, nie edycja
   klienta). **Nie piszesz własnych opisów poziomów** — to treść metodyczna
   właściciela. Gdyby kopia kliencka była niekompletna → **STOP**.
5. **Nie scalasz dwóch kopii w jedną.** Wspólny moduł źródłowy dotknąłby `src/`
   (Z17). To jest **znalezisko** („dwie kopie tej samej struktury; docelowo jedno
   źródło — wymaga decyzji o umiejscowieniu"), nie zadanie tego dyżuru.
6. **`DRD_AXES` w `aiAssessmentPartnerService.ts` MA JUŻ 7 OSI** — potwierdź
   i wpisz do „Korekt wobec instrukcji" (teza panelu o 5 osiach jest nieprawdziwa).
   Jeśli jego skale różnią się od `drdStructure` — to jest **trzecia kopia skal**
   i **osobne znalezisko**; wyrównujesz je tylko wtedy, gdy dowiedziesz, że jest
   konsumowana w ścieżce wyniku.

**DoD B.1:** tabela przed/po na realnych danych, `levelCount` osi 5 i 6 zgodne
po obu stronach, zero zmian w `src/`, zielone `drdEvidenceScoring`, `drdCompletion`,
`drdVizAdapter`, `assessment.routes.test.ts`, `MethodOutputService`.

### B.2 — `@ts-nocheck` w `aiAssessmentPartnerService.ts`

Plik ma **1439 linii** pod `// @ts-nocheck` (linia 1) i jest importowany przez
`aiAssessmentReportGenerator.ts:15` oraz zasila 26 tras AI.

**Co robisz:**
1. Zdejmujesz `@ts-nocheck` i naprawiasz błędy typów **bez zmiany zachowania**.
   Dopuszczalne: adnotacje, zawężenia, `satisfies`, jawne typy indeksowania
   (`DRD_AXES[axisId]` woła po kluczu dynamicznym w kilkunastu miejscach).
   **Niedopuszczalne:** `as any` jako sposób na spełnienie DoD, zmiana kształtu
   odpowiedzi tras, zmiana logiki rekomendacji.
2. **Weryfikacja punktowa, nie pełny `tsc`:**
   ```bash
   npx esbuild server/src/services/aiAssessmentPartnerService.ts --loader:.ts=ts --outfile=/dev/null
   npx tsc --noEmit --skipLibCheck server/src/services/aiAssessmentPartnerService.ts   # dopuszczalne WYŁĄCZNIE na tym jednym pliku
   ```
3. **Dowód, że nic nie zmieniłeś w zachowaniu:** test realnego routera na
   minimum trzech trasach AI (np. `/ai/insights`, `/ai/gap/:axisId`,
   `/ai/validate`) — happy, pusty stan, negatyw tenanta — **zielony przed
   i po**, z tymi samymi asercjami kształtu.
4. **STOP jest dopuszczalnym wynikiem tej pozycji**, jeżeli zdjęcie `@ts-nocheck`
   wymusza zmianę kontraktu współdzielonego albo kaskadę poza plik. Wtedy
   wpisujesz: ile błędów zostało, jakich kategorii, i **czy da się je zamknąć
   w granicach pliku**. Uczciwy STOP > `as any` na 40 liniach.

---

## §C. TO-BE (DEC-37) — jedna pozycja

### C.1 — Dowód ścieżki produkcyjnej celu i domknięcie luki serwerowej

**Model już istnieje** (§1.7). Panel twierdził, że go nie ma — to nieprawda.
Twoim zadaniem jest **udowodnić, że działa produkcyjnie**, i domknąć **tylko to**,
czego dowód nie potwierdzi.

**Krok 1 — dowód (Z21, obowiązkowy, PRZED jakąkolwiek budową).**
Test na **realnym PG**, przez **realny router `/api/method`**, **bez
wstrzykniętych zależności**:

1. utwórz sesję (`POST /api/method/sessions`),
2. zapisz zdarzenie decyzji celu (`POST /api/method/sessions/:id/events`
   z `type: 'DECISION_APPROVED'`, `unitId: '<id obszaru>'`, `level: N`,
   `payload.subject: 'target_level'`),
3. **odczytaj niezależnym połączeniem** (`pg.Pool`), że cel jest trwały,
4. przejdź do outputu i sprawdź, że `MethodOutputService` zwraca
   `targetLevel === N` dla tej jednostki,
5. **negatyw tenanta:** obca organizacja nie widzi ani zdarzenia, ani celu.

**To jest pozycja dowodowa i ma wartość sama w sobie** — nawet jeżeli nie
znajdziesz ani jednej luki.

**Krok 2 — domknięcie, wyłącznie tego, czego dowód nie potwierdził.**
Sprawdź i uzupełnij **tylko** brakujące elementy:

| Wymóg DEC-37 | Pytanie dowodowe | Jeśli brakuje |
| --- | --- | --- |
| Cel **widoczny w Interview** (odczyt: „Cel: poziom N" + dystans) | Czy istnieje **serwerowy** odczyt celu per jednostka/obszar, osiągalny z zamontowanej trasy? | Dodaj odczyt (rozszerzenie istniejącej odpowiedzi albo nowa trasa `GET`), **tenant z tokenu** |
| Cel **edytowalny wyłącznie w Matrix** — jedno źródło edycji | Czy istnieje **więcej niż jedna** serwerowa ścieżka zapisu celu? | Nie dodajesz drugiej. Jeśli są dwie — to **znalezisko**, nie cicha likwidacja |
| **Historia zmian celu** | Czy poprzednie cele są odtwarzalne (append-only, `supersedes`)? | Jądro jest append-only — **udowodnij to testem**, nie dopisuj tabeli historii, jeśli zdarzenia już ją niosą |
| **Walidacja** | Czy `level` jest walidowany wobec `levelCount` **właściwej osi** (po B.1!) i odrzucany poza zakresem? | Dodaj walidację → `400` z maszynowym kodem |
| **Tenant-safety** | Czy `organizationId` pochodzi **wyłącznie z tokenu**? | Odrzuć jawnie `body.organizationId ≠ token` |

**Reguły twarde:**
1. **Zero nowego modelu.** Jeśli cel da się zapisać istniejącym zdarzeniem —
   **zapisujesz istniejącym**. Druga reprezentacja celu = trzeci sprzeczny model,
   czyli dokładnie choroba, którą leczymy.
2. **Migracja tylko wtedy, gdy dowód wykaże brak trwałości.** Nie „na wszelki
   wypadek".
3. **Zero frontu.** Karta poziomu w Interview i akcja „Ustaw TO-BE" w side-sheecie
   Matrixa to **front po prototypie**. Ty dostarczasz kontrakt do tabeli A.3.
4. **Z15:** cel `null` (nieustalony) jest **uczciwym stanem** — prototyp
   właściciela ma dla niego osobną etykietę („cel nieustalony"). Nie podstawiasz
   domyślnego celu, nie ustawiasz go na maksimum. Rejestr uwag mówi wprost:
   „Target recommendations require business justification and do not default to
   the maximum level."

---

## §D. SŁOWNIK KODÓW „POMIŃ" (DEC-55) — dwie pozycje

### D.1 — Model i API pominięcia z zamkniętym słownikiem

**★ TREŚĆ CZTERECH KODÓW JEST ROZSTRZYGNIĘTA I WIĄŻĄCA.**
Źródło: `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`,
wiersz **107**, `DEC-2026-08-25-55`, status **OWNER_ACCEPT**:

> „Cztery kody: «poza modelem operacyjnym» · «poza zakresem zlecenia» ·
> «odroczone do kolejnej rewizji» · «zastąpione innym rozwiązaniem»; wybór kodu
> **wymagany** przy decyzji Pomiń (mapowanie na `AnswerEventPayload.skipReason`).
> Odblokowuje kartę poziomu."

**Obowiązkowa weryfikacja przed pisaniem kodu:**
```bash
grep -n "DEC-2026-08-25-55" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
```
**Jeżeli treść czterech kodów NIE jest w tym wierszu wypisana — to jest STOP.**
Zakładasz pozycję STOP, pytasz nadzorcę o dosłowną treść i **nie wymyślasz
własnych kodów**. Słownik zamknięty wymyślony przez wykonawcę jest gorszy niż
brak słownika, bo wygląda na decyzję właściciela.

**Kanoniczne identyfikatory maszynowe — MUSZĄ być zgodne z frontem, który już
istnieje na `codex/assessment-fixes-20260826`** (§1.8, odczyt przez `git show`):

| Kod maszynowy | Etykieta PL (dosłownie z DEC-55) |
| --- | --- |
| `poza_modelem_operacyjnym` | poza modelem operacyjnym |
| `poza_zakresem_zlecenia` | poza zakresem zlecenia |
| `odroczone_do_kolejnej_rewizji` | odroczone do kolejnej rewizji |
| `zastapione_innym_rozwiazaniem` | zastąpione innym rozwiązaniem |

**★ ROZSTRZYGNIĘCIE ARCHITEKTONICZNE — czytaj uważnie, to jest sedno pozycji.**

DEC-55 mówi „mapowanie na `AnswerEventPayload.skipReason`". **Tego pola nie ma**
(`server/src/method-core/contracts/events.ts:131-147`), a jądro jest
**współdzielone** (SIRI, Audyty) i **mirrorowane w `src/method-core/`**, czyli
w katalogu poza Twoim zakresem.

**Dlatego:**

1. **NIE dodajesz pola `skipReason` do `AnswerEventPayload`.** To jest **STOP
   do nadzorcy**, obowiązkowo wpisany do „Pozycji otwartych" w formacie z §0.5,
   z konkretną propozycją: nazwa pola, opcjonalność, wpływ na SIRI/Audyty,
   wymóg parytetu obu kopii jądra.
2. **Budujesz reprezentację po stronie Assessmentu** — tabela własna,
   Assessment-owned, migracja w Twoim przedziale
   (`20261101_assessment_day20_skip_reasons.sql`), minimum:
   ```
   assessment_skip_reasons(
     id, organization_id, session_id, unit_id, question_id, level,
     skip_code            -- CHECK IN (cztery kody powyżej)
     recorded_by_user_id, recorded_at, superseded_by, idempotency_key
   )
   -- ZERO kluczy obcych; tenant i istnienie rodzica sprawdzasz w aplikacji
   -- unikat po (organization_id, idempotency_key) → replay nie tworzy drugiego wiersza
   ```
3. **Zamknięty słownik egzekwujesz DWA razy:** `CHECK` w bazie **oraz** walidacja
   w warstwie aplikacji zwracająca `400` z maszynowym kodem
   (np. `SKIP_CODE_NOT_IN_DICTIONARY`). Wolne pole tekstowe **nie jest przyjmowane**.
4. **Append-only.** Zmiana decyzji = nowy wiersz z `superseded_by`, nigdy `UPDATE`
   ani `DELETE`. To ta sama dyscyplina co w jądrze zdarzeń.
5. **Trasa/trasy** (kanonicznie w tej samej rodzinie co reszta sesji metody —
   ustal to inwentarzem, nie zgadnij): zapis pominięcia + odczyt pominięć dla
   sesji/jednostki. **Tenant wyłącznie z tokenu.**
6. **Z22:** jeżeli pominięcie jest niewykonalne (nieznana jednostka, obcy tenant,
   kod spoza słownika) — `4xx` z kodem i **zero** efektu ubocznego. Trasa nie
   zwraca `200`, gdy w bazie nic nie przybyło.

**DoD D.1:** cztery kody i tylko cztery; `CHECK` + walidacja aplikacyjna; replay
tego samego `idempotency_key` nie tworzy drugiego wiersza (dowód licznikiem
z niezależnego połączenia); happy · zły kod (`400`) · pusty stan · negatyw
tenanta; test **domyślnego okablowania** (Z21); migracja addytywna, idempotentna,
numer z przedziału, dowód `ls | grep`.

### D.2 — Odczyt pominięcia w kontrakcie raportu

**Problem, który rozwiązujesz:** front (gałąź równoległa) zapisuje dziś kod jako
**polskie zdanie** w `justification` (`Pominięto — poza zakresem zlecenia.`),
bo nie miał gdzie zapisać kodu. Raport, który to sparsuje, będzie zależny od
polskiej gramatyki i rozsypie się przy EN.

**Co robisz:**
1. Kontrakt raportu (§E.1) niesie dla każdego obszaru **maszynowy** stan:
   `skipped: true|false` + `skipCode: <jeden z czterech> | null` — czytany
   **z modelu D.1**, nigdy z parsowania tekstu.
2. **Zero parsowania `justification`.** Jeżeli w bazie są dane historyczne
   zapisane tylko jako tekst — to jest **znalezisko** („dane sprzed D.1 nie mają
   kodu maszynowego; migracja wsteczna wymaga decyzji"), **nie** heurystyka
   w produkcie.
3. **Uczciwy stan pusty:** obszar bez pominięcia i bez odpowiedzi to
   `NIE_OCENIONO`, nie `POMINIĘTO`. Kanon: „nie wiem" ≠ zero ≠ sukces (Z15).
4. Test: obszar pominięty → kontrakt raportu zwraca kod maszynowy; obszar
   pominięty **w innej organizacji** → nie pojawia się w ogóle.

---

## §E. KONTRAKT RAPORTU (DEC-46 / DEC-47) — dwie pozycje

**Źródło wymagań właściciela, wiążące i cytowane dosłownie:**
`docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`
(`ASM-OWN-025`, `ASM-OWN-026`, kryteria `ASM-CHAPTER-AC-001..009`,
`ASM-PDF-AC-001..008`) oraz prototyp
`docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/drd-prototyp-report.html`.

### E.1 — Deterministyczny kontrakt 7 rozdziałów (bez treści, bez LLM)

**Produkt:** jedno API zwracające **strukturę** raportu — siedem rozdziałów,
po jednym na oś, każdy w kanonicznej kolejności:

```
rozdział osi N:
  1. wstęp osi              slot tekstowy · minWords 120 · maxWords 180
  2. matryca osi            dane do wizualizacji (obszary, AS-IS, TO-BE, luka, stan dowodu)
                            + podpis: minWords 30 · maxWords 60
  3. komentarz per obszar   po JEDNYM na każdy stosowalny obszar osi
                            slot tekstowy · minWords 110 · maxWords 170
                            pięcioczęściowa mikrostruktura (patrz niżej)
  4. wnioski osi            slot tekstowy · minWords 180 · maxWords 260
                            + linia decyzyjna: kierunek | priorytet | horyzont | warunek powodzenia
```

Pięcioczęściowa mikrostruktura komentarza obszaru (identyfikatory slotów, nie
treść): `stan_faktyczny` · `ocena_i_wiarygodnosc` · `znaczenie_dla_przedsiebiorstwa`
· `luka_i_sens_targetu` · `najblizszy_krok`.

**Reguły twarde — pięć, wszystkie odrzucające:**

1. **ZERO generowania treści (Z14).** API zwraca **sloty, metadane i liczby**.
   `content: null` dla slotu jeszcze nienapisanego jest **poprawną, uczciwą
   odpowiedzią**. Wywołanie modelu = STOP.
2. **Liczby wyłącznie z silnika deterministycznego.** AS-IS, TO-BE, luka,
   `maxLevel` osi — z `drdVizAdapter` / `drdCompletion` / `MethodOutputService`.
   **Po pozycji B.1** — inaczej osie 5 i 6 pojadą po złej skali.
3. **Limity słów są METADANYMI.** Serwer je **podaje**, nie **egzekwuje**.
   Rozdział 181-słowny nie jest błędem serwera; to front pokazuje
   `181 / 110–170 sł. — skróć` (prototyp, linia 525).
4. **Liczba komentarzy = kanoniczna liczba stosowalnych obszarów osi**
   (`ASM-CHAPTER-AC-003`). Żaden oceniony obszar nie znika. Obszar **pominięty**
   (§D.2) występuje w strukturze **z kodem pominięcia**, nie jest wycinany.
5. **Traceability (`ASM-CHAPTER-AC-006`, `BACKEND_CONTRACT_NEEDED` — to jest
   dosłownie Twój wiersz).** Każdy komentarz obszaru niesie referencje do
   zaakceptowanych odpowiedzi i dowodów (identyfikatory, nie treść), oraz jawny
   znacznik niepewności: `evidenced` / `declared` / `incomplete` / `conflicting`
   / `not_assessed`.

**Konflikt kanonu — obowiązkowe zachowanie.** `ASM-CHAPTER-AC-008` ma status
`CANON_DECISION_REQUIRED`: `docs/product/DRD_REPORT_SPEC.md` opisuje **osiem**
wymiarów/rozdziałów, DEC-46 mówi **siedem osi wszędzie**. Budujesz **siedem**
(DEC-46 to `OWNER_ACCEPT`), **nie usuwasz** mapowania 8D i **nie twierdzisz**,
że konflikt jest rozwiązany — wpis do „Pozycji otwartych".

**Wzorzec implementacyjny:** `server/src/services/audits/reportRenderer.ts`
(**cudzy moduł — CZYTASZ, nie zmieniasz**): czysta funkcja, **wstrzykiwany
`generatedAt`** („renderer nigdy nie czyta zegara"), lista sekcji z `id`/`title`/
`kind`/`content`. Trzymaj tę samą dyscyplinę — testowalność kontraktu raportu
stoi na tym, że jest deterministyczny.

**DoD E.1:** API zwraca 7 rozdziałów w kanonicznej kolejności osi (niezależnie
od kolejności odwiedzin ekranów); liczba komentarzy = liczba stosowalnych
obszarów; obszary pominięte z kodem; brak treści = `null`, nie pusty string;
liczby zgodne z silnikiem (tabela dowodowa dla jednej osi); happy · pusty stan
(sesja bez odpowiedzi) · błąd (nieznana sesja `404`) · negatyw tenanta;
test **domyślnego okablowania** (Z21); **zero wywołań LLM** — dowód
`grep` po `llmService|generateResponse` w Twoim diffie = pusty.

### E.2 — Rewizje raportu (DEC-47) i spójność eksportu

**DEC-47:** „Report = jeden obiekt przy sesji z historią wersji; eksport do
Materiałów jako **migawka**."

1. **Najpierw inwentarz, potem budowa.** `GET /api/method/outputs/:id/revisions`
   (`method-core.routes.ts:1412`) i `POST /outputs/:id/report` (`:1490`) **już
   istnieją**. Sprawdzasz na realnym PG, czy niosą: pojedynczy obiekt raportu
   przy sesji, historię, **niezmienność zatwierdzonej rewizji**. Wynik do tabeli.
   **Budujesz tylko brakującą część** — nie drugi system rewizji.
2. **Migawka jest niezmienna.** Zatwierdzona rewizja **nie zmienia się**, gdy
   zmienią się odpowiedzi sesji. Dowód: zatwierdź rewizję → zmień odpowiedź →
   odczytaj rewizję niezależnym połączeniem → **identyczna**.
3. **Jedna prawda dla eksportu (`ASM-PDF-AC-003`).** Endpoint eksportu zwraca
   **dokładnie tę samą rewizję**, co widok interaktywny — **nigdy nie
   regeneruje** narracji i **nigdy** nie dociąga późniejszych szkiców.
   Kontrakt eksportu niesie: nazwę organizacji/dokumentu, **numer rewizji**,
   znacznik czasu, wersję metody, stan zatwierdzenia (`ASM-PDF-AC-005`).
4. **`ASM-PDF-AC-006` — brak rozdziału NIGDY nie jest pomijany po cichu.**
   Kontrakt „eksportuj wszystko" przy brakującym/nieaktualnym rozdziale zwraca
   **uczciwy wynik walidacji** (lista braków), a **nie** komplet bez jednego
   rozdziału. **To jest wprost Z22:** nie wolno zwrócić `200` „gotowe do
   eksportu", jeżeli treść jest niekompletna.
5. **Renderowanie do pliku PDF — POZA ZAKRESEM.** Dostarczasz kontrakt i dane;
   plik robi front/renderer w osobnym dyżurze.
6. **`export/pptx` (`:2509`) i `export/deck` (`:2623`) — nie usuwasz.** Mają zero
   konsumentów, ale są zamontowane i mogą być punktem podpięcia frontu. Twoim
   produktem jest **wiersz w tabeli A.1/A.3** („zamontowana, zero konsumentów,
   kontrakt: …") + rozstrzygnięcie, czy nowy kontrakt eksportu je reużywa, czy
   je zastępuje. **Usunięcie wymaga dowodu Z20 i zgody nadzorcy.**

---

## §F. SPRZĄTANIE — jedna pozycja

### F.1 — Usunięcie nieosiągalnego serwera z dowodem zerowej osiągalności

**Fakt wejściowy (zweryfikuj komendą z §0.1 pkt 3d):** barrel
`server/src/routes/index.ts` **nie jest importowany przez nikogo** — jedyne
trafienie grepa to on sam (plus dwa komentarze dokumentacyjne w innych plikach,
które opisują dokładnie ten problem). W konsekwencji:

```
server/src/routes/index.ts:18  export assessmentDomainRoutes from './assessment/index.js'
  └─ server/src/routes/assessment/index.ts (28 linii)  ← nieosiągalny
       └─ router.use('/', assessmentsRoutes)
            └─ server/src/routes/assessment/assessments.routes.ts (497 linii, 11 handlerów)  ← NIEOSIĄGALNE
```

Precedens tego samego wzorca jest już opisany w repo:
`server/src/routes/organization/partner-code.routes.ts:31` („that barrel is only
re-exported by `routes/index.ts`, which…").

**Procedura — kolejność obowiązkowa (Z20):**

1. **Dowód zerowej osiągalności, wklejony dosłownie do raportu**, dla **każdego**
   pliku, który zamierzasz usunąć:
   ```bash
   grep -rn "routes/index" server/src --include='*.ts' | grep -v "^server/src/routes/index.ts:"
   grep -rn "assessmentDomainRoutes" server/src
   grep -rn "assessment/index" server/src
   grep -rn "assessments.routes" server/src
   grep -rn "assessments.routes\|assessmentDomainRoutes" tests/
   ```
   **Każdy z tych grepów musi być pusty** (poza samoodwołaniem i komentarzami).
   **Niepusty grep = NIE USUWASZ.**
2. **Sprawdź, czy handlery nie są jedyną implementacją czegoś żywego.**
   `assessments.routes.ts` niesie m.in. `GET /my-assessments`,
   `GET /frameworks/list`, `GET /frameworks/:id/questions`,
   `POST /:id/responses/:questionId`. Jeżeli **którakolwiek** z tych semantyk
   nie ma odpowiednika na zamontowanym moucie — **to jest znalezisko i STOP dla
   tego pliku**, nie usunięcie. Utrata jedynej implementacji jest gorsza niż
   martwy plik.
3. **Usuwasz minimalnie i wstecz-kompatybilnie:** eksport
   `assessmentDomainRoutes` z `routes/index.ts`, agregator
   `routes/assessment/index.ts`, i **dopiero jeśli krok 2 przeszedł czysto** —
   `assessments.routes.ts`. Reszty barrela **nie ruszasz** (to inne moduły,
   Z17).
4. **Dowód po usunięciu:** pełna lista testów z §0.4a zielona w tym samym
   zakresie co przed (Z23), plus dowód, że serwer się buduje punktowo
   (`npx esbuild server/src/Gateway.ts --loader:.ts=ts --outfile=/dev/null`).
5. **Pozostałe „8+ martwych plików" z tezy panelu:** robisz **inwentarz**
   z dowodami grepa i usuwasz **wyłącznie te z pustym dowodem**. Plik bez
   dowodu → wiersz w „Znaleziskach", nie kasowanie. **Lepiej usunąć trzy pliki
   z dowodem niż osiem na wyczucie.**

---

## §T. TESTY — pozycja własna, nie dodatek

### T.1 — Testy wszystkich nowych i zmienionych tras

Dla **każdej** trasy, którą dodałeś, zmieniłeś albo usunąłeś:

| Powierzchnia | Minimum |
| --- | --- |
| Trasy pominięcia (D.1) | happy · kod spoza słownika `400` · replay idempotentny · pusty stan · obcy tenant |
| Trasa/odczyt celu TO-BE (C.1) | zapis+readback niezależnym połączeniem · poziom poza zakresem `400` · cel `null` jako uczciwy stan · obcy tenant |
| Kontrakt raportu (E.1) | 7 rozdziałów w kanonicznej kolejności · liczba komentarzy = liczba obszarów · sesja pusta · nieznana sesja `404` · obcy tenant |
| Rewizje/eksport (E.2) | migawka niezmienna po zmianie odpowiedzi · eksport = ta sama rewizja · brak rozdziału → uczciwa walidacja, nie cichy komplet (Z22) · obcy tenant |
| Trasy v1 pozostawione (A.2) | po jednym teście z każdej grupy żywych tras — dowód braku regresji |
| Trasy AI dotknięte przez B.2 | trzy trasy, ten sam kształt przed i po |
| Usunięte trasy (A.2, F.1) | test dowodzący, że **żadna żywa ścieżka** nie zwraca teraz `404`/`500` |

### T.2 — Test domyślnego okablowania (Z21) — osobny, jawny pakiet

Minimum **jeden** test na pozycję z wywołaniem poza własnym modułem, budujący
serwis **produkcyjną drogą** (bez `dependencies`, bez podstawionego generatora,
bez wstrzykniętego repozytorium). Ten pakiet jest w raporcie **wymieniony
osobno**, z nazwami plików — bo to jest dokładnie ten dowód, którego zabrakło
dniowi 18.

### T.3 — Negatywy tenanta jako osobny, jawny pakiet

Dla każdej nowej trasy: obca organizacja **nigdy** nie dostaje `200`;
`organizationId` **wyłącznie z tokenu**; jawne odrzucenie `body.organizationId ≠
token`. **Dowód mutacyjny obowiązkowy:** zneutralizuj filtr organizacji
w kodzie → test **musi** się zaczerwienić. Test, który po neutralizacji filtru
dalej przechodzi, **nie jest dowodem tenant-safety** (dokładnie ta pułapka
z `DEC-107`).

### T.4 — Zakaz osłabiania testów zastanych

Nie osłabiasz asercji istniejących wcześniej. Zamiana `toBe` → `not.toBe`,
usunięcie asercji parametrów, podmiana twardego oczekiwania na bezzębne `404`
= osłabienie i **wymaga wpisu przed/po** w raporcie (§0.4a pkt 5). Osłabienie
bez wpisu = odrzucenie dyżuru.

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 04_ASSESSMENT do stanu faktycznego

Podnosisz **wyłącznie o to, co faktycznie dowiozłeś i udowodniłeś**.
Zasady:
1. **Nie zawyżasz.** `CZĘŚCIOWO` jest poprawnym statusem i kosztuje mniej niż
   wykryte zawyżenie (`DEC-107`, `DEC-108`).
2. Nie dopisujesz pozycji za front — mechanika tylna nie czyni pozycji
   frontowej odebraną.
3. Jeżeli plik nie ma atomowej pozycji odpowiadającej Twojej pracy (dzień 19
   miał na tym zasadny STOP) — **STOP jest dopuszczalny**: opisujesz, czego
   brakuje, i **nie rozbijasz zbiorczych wierszy** dotykających innych pozycji.

### R.2 — Komplet dowodów

Każda pozycja: `commit SHA` · `ścieżka wywołania od realnego wejścia` (Z20) ·
`nazwy plików testowych + wynik X/Y PASS` · `dowód celu połączenia` (Z19).

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~80 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
   --is-ancestor` z §0.1 pkt 1** (SHA markera jest tam, w jednym miejscu — nie
   przepisujesz go z pamięci). Brak → STOP i koniec dyżuru. Rozejście marker→tip
   → wpis, start z markera (DEC-95), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19,
   `DEC-96`). Gałąź + worktree (§0.1 pkt 5), symlink `node_modules` (DEC-86,
   tylko odczyt), potem:
   ```bash
   docker run -d --name cx-day20-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day20 \
     -p 5469:5432 pgvector/pgvector:pg16
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day20-pg psql -U postgres -d cx_day20 -c "SELECT current_database(), inet_server_port();"
   DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict       # przebieg 1
   DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict       # przebieg 2 → Applying migrations: 0
   DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry # dry → Pending migrations: 0
   ```
   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — **zawsze z env
   w tej samej linii komendy** (`DEC-98` pkt 3).

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów wiążących
   (§0.1 pkt 4). Brak (a)/(b)/(c) = STOP.

4. **Numer migracji — WEWNĄTRZ PRZYDZIELONEGO PRZEDZIAŁU `20261100`–`20261109`:**
   ```bash
   ls server/migrations | grep -E '^[0-9]{8}' | sort | tail -5
   ls server/migrations | grep '^202611'        # co zajęte w Twoim przedziale
   ls server/migrations | grep '^20261101'      # MUSI być puste
   ```
   **Nie liczysz „najwyższy zastany + 1".** Dni 17/18/19 pracują równolegle
   w przedziałach `76-79`, `80-89`, `90-99` i ich plików możesz nie widzieć.

5. **Weryfikacja mapy z §1.7 i korekt z §1.2** — każdą rozbieżność do „Korekt".
   Obowiązkowo:
   ```bash
   grep -n "assessmentWorkflowRoutes\|assessmentWorkflowV2Routes\|assessmentAIRoutes\|methodCoreRoutes" server/src/Gateway.ts
   grep -n "levelCount:" src/services/drdStructure.ts server/src/data/drdStructure.ts
   awk 'NR>=52 && NR<=200' server/src/services/aiAssessmentPartnerService.ts | grep -E "^  [a-zA-Z]+: \{"   # ile osi NAPRAWDĘ
   grep -rn "target_level" server/src/method-core | head
   grep -rn "skipReason\|'skipped'" server/src/method-core/contracts/events.ts   # oczekiwane: PUSTE
   grep -rn "assessmentDomainRoutes" server/src
   grep -rn "export/pptx\|export/deck" src/ | head                                # oczekiwane: PUSTE (zero konsumentów)
   git show codex/assessment-fixes-20260826:src/components/method-workspace/skipReasonCodes.ts | head -40
   ```

6. **★ POMIAR WEJŚCIOWY (Z23) — PEŁNY zakres §0.4a, na markerze, PRZED pierwszym
   commitem.** Wyniki `X/Y PASS` per plik do raportu, do tabeli „czerwone
   ZASTANE". **Czerwonych zastanych NIE naprawiasz.**

7. **Kanon tabel** baseline (mimo że frontu nie ruszasz):
   `bash scripts/check-list-canon.sh 2>&1 | tail -20`.

8. Założenie raportu (§9) i wpisanie wyników 1–7.

### Blok 1 — inwentarz i kanon (A.1 → A.2 → A.3)
`A.1` jest tanie i **odblokowuje wszystko inne** — bez tabeli osiągalności
`A.2` i `F.1` są zgadywaniem. `A.3` na końcu bloku, bo dopiero wtedy znasz
trasy kanoniczne.

### Blok 2 — model osi (B.1 → B.2)
`B.1` **musi być przed `E.1`** — kontrakt raportu liczy poziomy po skali osi.
`B.2` jest niezależne i dopuszcza uczciwy STOP.

### Blok 3 — dane sesji (C.1 → D.1 → D.2)
`C.1` zaczyna się od **dowodu**, nie od budowy. `D.1` przed `D.2` (raport czyta
model, nie odwrotnie).

### Blok 4 — raport (E.1 → E.2)
Najdroższy blok. **Jeśli wchodzisz w niego z mniej niż połową czasu — zrób samo
`E.1` czysto i oznacz `E.2` uczciwie**, zamiast dwóch połówek.

### Blok 5 — sprzątanie (F.1)
Po `A.1`, bo korzysta z tej samej metody dowodowej. **Tanie i wartościowe** —
jeśli czasu mało, zrób `F.1` **przed** `E.2`.

### Blok 6 — domknięcie (obowiązkowo, ~90 min)
1. `§T` (testy wszystkich tras, pakiet Z21, pakiet negatywów tenanta), `R.1`,
   `R.2` dla tego, co faktycznie zbudowałeś.
2. **Pomiar wyjściowy (Z23): PEŁNY zakres §0.4a**, tabela „czerwone ZASTANE" vs
   „czerwone WPROWADZONE", deklaracja `ZASIĘG PEŁNY`/`CZĘŚCIOWY` z wyliczeniem.
3. **Dziesięć dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|tests/utils/assessmentMocks|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                    # ★ PUSTY (całe src/ poza zakresem)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                      # tylko 202611xx_assessment_day20_*
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|drdMethodWorkspaceSliceV1|methodWorkspaceShellV1|drdHttpSourceOfTruthV1)"   # PUSTY (zero flag, Z10)
   git diff codex/m03-admin-20260824...HEAD -- server/src/method-core/contracts/events.ts                                    # PUSTY (jądro nietknięte, §D.1)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/audits/                                                   # PUSTY (cudzy moduł, Z17)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(llmService|generateResponse|openai|anthropic)"                  # PUSTY (zero LLM, Z14)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*as any"                                                          # przejrzyj RĘCZNIE (B.2)
   git log --oneline codex/m03-admin-20260824..HEAD                                                                          # commit per pozycja
   docker ps -a --filter name=cx-day20-pg ; docker volume ls | grep -i cx-day20                                              # PUSTO (sprzątnięte)
   ```
4. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day20-pg && docker volume ls -q | grep -i cx-day20 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności
Lepiej **domknięte** `A.1`+`A.2`+`A.3`+`B.1`+`F.1`+testy niż trzynaście pozycji
„prawie". Każda pozycja albo spełnia DoD, albo jest uczciwie oznaczona
(`STOP`/`BRAK_API`/`CZĘŚCIOWO`).

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:
```
docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY20_REPORT_20260826.md
```
Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Assessment dzień 20 (mechanika tylna) — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: 649bd730a6 — POTWIERDZONY / BRAK
Gałąź: codex/assessment-day20-<data>
Worktree: /private/tmp/consultify-assessment-day20
Port PG: 5469 · kontener cx-day20-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE
Przedział migracji: 20261101-20261109 · użyte numery: <lista>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)
<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>

## Oświadczenie o zakresie src/ (★ ograniczenie krytyczne)
<dosłowny wynik: git diff --name-only codex/m03-admin-20260824...HEAD | grep '^src/' → MUSI BYĆ PUSTY>

## ★ Dowód celu połączenia (Z19 / DEC-96 / DEC-98)
<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z env w tej samej linii>

## Warunki wstępne — tabela
<marker · dwa mounty obecne · dwie kopie drdStructure · target_level w jądrze ·
 barrel bez importera · rejestr decyzji · numer migracji wolny (ls|grep) ·
 migracje 1/2/dry · POMIAR WEJŚCIOWY (pełny §0.4a)>

## Pozycje — tabela zbiorcza
| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE) | Commit | Dowód OSIĄGALNOŚCI (Z20) | Dowód testowy |
| A.1 | | | | |
| A.2 | | | | |
| A.3 | | | | |
| B.1 | | | | |
| B.2 | | | | |
| C.1 | | | | |
| D.1 | | | | |
| D.2 | | | | |
| E.1 | | | | |
| E.2 | | | | |
| F.1 | | | | |
| T   | | | | |
| R.1 | | | | |

## ★ A.1 — INWENTARZ OSIĄGALNOŚCI OBU MOUNTÓW
| Mount | Metoda + ścieżka | Plik:linia | Żywy konsument w src/ (cytat lub BRAK) | Odpowiednik po drugiej stronie | Werdykt |
<wszystkie 31 tras v1 + 41 tras v2>

## ★ A.3 — KONTRAKT DLA FRONTU (produkt §1.6)
| Wołający (plik:linia) | Woła dziś | Wynik dziś (zmierzony) | Trasa kanoniczna | Body | Odpowiedź | Kody błędów | Uwaga dla frontu |
<wszystkie zepsute wywołania z §1.7>

## Tabele werdyktów
### B.1 — dryf skal | Oś | levelCount klient | levelCount serwer przed | po | Wynik % przed | Wynik % po | Dowód
### B.2 — @ts-nocheck | Błędów przed | po | Kategorie | Zmiany zachowania: ZERO/lista | Werdykt
### C.1 — TO-BE | Wymóg DEC-37 | Istniało? | Dowód (plik:linia + test) | Co dobudowałem | Werdykt
### D.1 — kody Pomiń | Kod maszynowy | Etykieta PL | CHECK w bazie | Walidacja aplikacji | Test
### E.1 — kontrakt raportu | Rozdział | Sloty | Limity (min/max) | Źródło liczb | Traceability | Test
### E.2 — rewizje | Niezmienność migawki | Eksport = ta sama rewizja | Brak rozdziału → walidacja (Z22) | Test
### F.1 — sprzątanie | Plik | Grep importerów (dosłownie) | Semantyka ma odpowiednik? | Usunięty TAK/NIE | Dowód po

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a
### Czerwone ZASTANE (zmierzone na markerze, PRZED pierwszym commitem)
| Plik | Wynik |
### Czerwone WPROWADZONE przez dyżur
| Plik | Wynik przed | Wynik po | Przyczyna | Naprawione TAK/NIE |
### Testy osłabione (przed/po, §0.4a pkt 5)
| Plik:linia | Asercja przed | Asercja po | Uzasadnienie |
### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

## ★ Pakiet testów DOMYŚLNEGO OKABLOWANIA (Z21)
<nazwy plików + co dokładnie dowodzą, bez wstrzykniętych zależności>

## ★ Dowód braku atrapy z zewnętrznym skutkiem (Z22)
<dla każdej trasy zmieniającej stan: co się zmienia w bazie, co dzieje się przy odmowie>

## Koordynacja z codex/assessment-fixes-20260826 (§1.8)
<zgodność kodów pominięcia · kolizje: BRAK / COORDINATION_REQUIRED + opis>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — pole `skipReason` w jądrze `AnswerEventPayload` (§D.1)
### STOP — kanon 7 osi vs 8 wymiarów raportu, ASM-CHAPTER-AC-008 (§E.1)
### STOP — <pozostałe>

## Znaleziska (NIE naprawiane przeze mnie)
## Korekty wobec instrukcji  (obowiązkowo: ile osi ma NAPRAWDĘ DRD_AXES)
## Migracje  (numer, dowód ls|grep, przedział, addytywność, idempotencja, kompatybilność wstecz, MIGRATION_PREPARED)
## Licznik  (pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte; flagi NIE włączone)
## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „testy przeszły" → `26/26 PASS`.
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `NIE_ZACZĘTE`.
5. **Nie zawyżasz.** `DEC-60` zaraportował usunięcie martwych gałęzi jako
   zrobione, a one były w kodzie; `DEC-108` wyłapał zawężony pomiar testów
   i atrapę z zewnętrznym skutkiem. **Zawyżenie kosztuje więcej niż uczciwe
   `CZĘŚCIOWO`.**
6. **Dowód osiągalności, nie istnienia** (Z20). „Dodałem serwis" bez ścieżki
   od zamontowanej trasy = `CZĘŚCIOWO`.
7. **Nie piszesz „gotowe do pokazania właścicielowi"** — piszesz „gotowe do
   odbioru przez nadzorcę".

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# typy punktowo (NIGDY pełny tsc -p)
npx esbuild server/src/<plik>.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run server/src/services/assessment/__tests__/drdEvidenceScoring.test.ts

# test celowany Z bazą — ZAWSZE env W TEJ SAMEJ LINII (Z19 + DEC-98)
DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
npx vitest run tests/integration/assessment/assessment.day20.postgres.integration.test.ts

# numeracja migracji — PRZEDZIAŁ 20261101-20261109, PRZED KAŻDYM NOWYM PLIKIEM
ls server/migrations | grep '^202611'
ls server/migrations | grep '^20261101'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day20-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day20 -p 5469:5432 pgvector/pgvector:pg16
docker exec cx-day20-pg psql -U postgres -d cx_day20 -c "SELECT current_database(), inet_server_port();"
DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
DATABASE_URL="postgres://postgres:cx@localhost:5469/cx_day20" NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day20-pg && docker volume ls -q | grep -i cx-day20 | xargs -r docker volume rm && docker volume prune -f

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/assessment/assessment.day20.postgres.integration.test.ts

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD

# ★ jedyne dozwolone dotknięcie gałęzi równoległej — ODCZYT (§1.8)
git show codex/assessment-fixes-20260826:src/components/method-workspace/skipReasonCodes.ts
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Dotknięcie `src/`** — choćby jednej linii `api.ts`. Odrzucenie dyżuru.
   Front jest cudzy; Twoim produktem jest tabela kontraktu.
2. **Uruchomienie testu DB bez `DATABASE_URL` w tej samej linii** → mock DB,
   wynik bez wartości (Z19; port 5432 **nasłuchuje**, nie licz na „i tak się
   nie połączy").
3. **Wyjście poza przedział migracji `20261100`–`20261109`** albo liczenie
   „najwyższy zastany + 1" → kolizja z równoległym dyżurem, cicha katastrofa
   porządku alfabetycznego (`DEC-107`: „ŹRÓDŁEM KOLIZJI BYŁA INSTRUKCJA").
4. **Usunięcie kodu bez pustego grepa** (Z20) — v1 ma żywych konsumentów,
   `export/pdf` i `export/excel` mają konsumentów. Kasowanie „bo martwe" bez
   dowodu to regresja.
5. **Uwierzenie w tezy panelu bez weryfikacji** — `DRD_AXES` ma **7** osi,
   TO-BE **istnieje**, `reportRenderer.ts` należy do **Audytów** (§1.2).
6. **Zmiana `levelCount` bez tabeli przed/po na realnych danych** — to zmiana
   wyniku, nie kosmetyka.
7. **Dodanie `skipReason` do `AnswerEventPayload`** → zmiana współdzielonego
   jądra mirrorowanego w `src/`. To STOP, nie decyzja wykonawcy.
8. **Parsowanie polskiego zdania z `justification`** zamiast maszynowego kodu
   → kontrakt raportu rozsypie się przy EN (§D.2).
9. **Wygenerowanie treści raportu modelem** (Z14) — kontrakt niesie sloty
   i limity, nie zdania.
10. **Trasa zwracająca `200` bez zmiany w bazie** (Z22) — zwłaszcza w E.2
    („eksportuj wszystko" przy brakującym rozdziale).
11. **Test wstrzykujący zależności podany jako dowód ścieżki produkcyjnej**
    (Z21) — dokładnie tak przeszła martwa warstwa AI dnia 18.
12. **Zawężony pomiar testów** (Z23) — raport podaje PEŁNY zakres §0.4a,
    z rozbiciem zastane/wprowadzone.

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie poprawiasz 12 metod `api.ts`, choć wiesz dokładnie, jak — to front;
- nie podpinasz 26 endpointów AI do paneli, choć panele istnieją — to front
  po prototypie;
- nie usuwasz trzech paneli AI bez importerów — czekają na front;
- nie włączasz `drdMethodWorkspaceSliceV1` / `methodWorkspaceShellV1` /
  `drdHttpSourceOfTruthV1`, choć „przecież to jest zaakceptowana architektura";
- nie scalasz dwóch kopii `drdStructure` w jeden moduł — to dotknęłoby `src/`;
- nie rozstrzygasz konfliktu 7 osi vs 8 wymiarów raportu;
- nie usuwasz mapowania 8D z `DRD_REPORT_SPEC.md`;
- nie budujesz renderera PDF ani „Eksportuj wszystko" jako pliku;
- nie scalasz i nie kopiujesz z `codex/assessment-fixes-20260826` (tylko odczyt
  jednego pliku przez `git show`);
- nie robisz `rebase` na nowszy tip m03 (DEC-95 — robi to nadzorca);
- nie naprawiasz czerwonych testów zastanych w cudzych modułach.

---

## 11. NA KONIEC

Ten moduł dostał **4,0/10** nie dlatego, że backend jest zły — backend jest
w dużej części **lepszy niż produkt, który go nie woła**. Dostał 4,0, bo między
serwerem a produktem stoi **rozjazd**: dwa mounty workflow, dwie kopie modelu
osi, cel zapisywany zdarzeniem, którego nikt nie czyta, kod pominięcia
zaszyty w polskim zdaniu, raport bez kontraktu i pół serwera, do którego nie
prowadzi żadna trasa.

Twoim jedynym celem jest **usunąć rozjazd**, żeby robotnik frontowy dostał
**jedną** prawdę: jeden mount, jeden model osi, jedną ścieżkę celu, jeden
słownik pominięć, jeden kontrakt raportu, jedną rewizję dla widoku i eksportu.

Trzy rzeczy decydują o odbiorze:

1. **Dowód, nie deklaracja (Z20).** Każde „usunąłem martwe" ma pusty grep
   wklejony do raportu, a każde „dodałem" ma ścieżkę wywołania od zamontowanej
   trasy. Poprzedni dyżur zaraportował usunięcie kodu, który dalej był w repo.
2. **Ścieżka produkcyjna, nie test z podstawionymi zależnościami (Z21).**
   Poprzedni dyżur miał 8/8 zielonych testów warstwy, która nie mogła zadziałać.
3. **Uczciwy pomiar i uczciwy status (Z22, Z23).** Zawężony wybór testów
   i trasa zwracająca sukces bez zmiany w bazie kosztowały merge poprzednich
   dwóch dyżurów. `CZĘŚCIOWO` z dowodem jest wart więcej niż `ZROBIONE`
   bez niego.

**Zero `src/`. Zero LLM. Zero nowych flag. Zero atrap. Flagi zostają wyłączone.**
