# INSTRUKCJA DYŻURU nr 27 — Codex — „Assessment/Ocena FRONT: ekran raportu 7 rozdziałów (artefakt Dokument, SPEC-A) + przepięcie zapisu kodu «Pomiń» na ekranie HTTP"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–26. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **pierwszym dyżurem FRONTOWYM modułu Ocena/Assessment** po
panelu adwersaryjnym `DEC-2026-08-26-103` (4,0/10 — najsłabszy moduł w
programie) i po scaleniu mechaniki tylnej dnia 20 (`DEC-2026-08-26-122`).

Panel postawił trzy zarzuty rozstrzygające. Ty odpowiadasz na **pierwszy**:

> „DELIVERABLE NIE ISTNIEJE — zakładka Raport renderuje tę samą macierz co
> Matrix plus jedno zdanie na obszar (39 wierszy «C — · T — · Δ —»); kontrakt
> właściciela (7 rozdziałów, synteza 120-180 słów, komentarz per obszar,
> Eksportuj wszystko) ma ZERO implementacji."
> — `OWNER_DECISION_LEDGER_2026-08-24.md:155`, `DEC-2026-08-26-103`

Dzień 20 dowiózł **kontrakt serwerowy** tego deliverable'u: deterministyczny,
bez LLM, siedem rozdziałów w kanonicznej kolejności, sloty i limity słów jako
metadane, pominięcia per pytanie. **Kontrakt stoi i nie ma ani jednego
konsumenta.** Twoim produktem jest ten konsument — i nic poza nim.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Nie dotykasz serwera. W ogóle. Nawet „jednej linii typu" w `server/src/`.**

1. **★ CAŁY KATALOG `server/src/` JEST POZA ZAKRESEM.** Nie tworzysz, nie
   zmieniasz, nie usuwasz, nie „przygotowujesz" niczego w `server/src/`.
   Wyjątków **nie ma**. Dotyczy to również `server/migrations/`,
   `server/tsconfig.json` i `server/vitest.config*.ts`.
2. **★★ RÓWNOLEGLE BIEGNIE DYŻUR nr 25** (Assessment blok 2, SERWEROWY) na
   gałęzi `codex/assessment-day25-20260826`, z żywym kontenerem PG na porcie
   **5499** (`cx-day25-pg`, potwierdzone `docker ps` w chwili wystawienia).
   Dyżur 25 zmienia **dokładnie te trasy, na których stoi Twój ekran**
   (pozycje E.2 i P2.2 — patrz §1.8 „Kolizja z dniem 25"). Każde Twoje
   dotknięcie `server/src/` = konflikt scaleniowy w cudzej, otwartej pracy.
3. **★ Jeżeli kontraktowi serwera czegoś brakuje — STOP z opisem, nigdy
   dopisywanie.** Brakujące pole → wpis `STOP` + `BRAK_W_KONTRAKCIE` w
   raporcie, uczciwy pusty stan na ekranie. **Nigdy** nie wyliczasz na froncie
   liczby, której serwer nie podał (§1.8 pułapka nr 3).
4. **Zero LLM. Zero generowania treści.** Kontrakt niesie `content: null` w
   **każdym** slocie tekstowym — i tak ma zostać. Twoim zadaniem jest
   **uczciwie pokazać pustkę** („sekcja do uzupełnienia — limit N słów"),
   nie ją zapełnić. Wpięcie dostawcy modelu = STOP.
5. **Eksport (PDF / «Eksportuj wszystko») jest POZA ZAKRESEM.** To osobny tor
   szablonów (`ASM-OWN-026`). W sekcji Akcje prawego panelu eksport jest
   **wyszarzonym wierszem z notatką „Planowane"**, nigdy działającym
   przyciskiem, nigdy przyciskiem, który nic nie robi.
6. **★ DEC-65 — dane demo są chronione, wspólna baza jest święta.** Zero
   Railway, zero zdalnych migracji/seedów, zero zapisów do bazy demo.
   **W tym dyżurze nie potrzebujesz ŻADNEJ bazy** — harness `dev-render`
   działa bez backendu i bez logowania.
7. **★ Wszystko za flagą `ff_assessmentReportView`, default OFF, fail-closed.**
   Po Twoim dyżurze flaga ma być **dalej OFF**. Twoim produktem jest **ekran
   gotowy do odbioru na zrzutach**, nie przełącznik. Nie zmieniasz też wartości
   domyślnych flag zastanych (`drdHttpSourceOfTruthV1`,
   `methodWorkspaceShellV1`, `drdMethodWorkspaceSliceV1` — wszystkie OFF).
8. **★ PIOTR NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM** (CLAUDE.md reguła 7,
   nienaruszalna). **Ty renderujesz, Ty robisz zrzut, Ty oglądasz własnym okiem
   i naprawiasz, ZANIM oddasz.** W raporcie piszesz „gotowe do odbioru przez
   nadzorcę", **nigdy** „gotowe do pokazania właścicielowi".

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 6d3cebe779**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor 6d3cebe779 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/assessment-fixes-*`, `codex/assessment-day20-*`,
   **`codex/assessment-day25-*`** ani z żadnej gałęzi dnia 17–26. Załóż raport,
   wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

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
   # (a) kontrakt serwera istnieje i ma 7 rozdziałów + sloty — sedno pozycji A.2/A.3
   wc -l server/src/services/assessment/assessmentReportContractService.ts   # oczekiwane: 156
   grep -n "minWords\|maxWords\|contractVersion" server/src/services/assessment/assessmentReportContractService.ts

   # (b) trasa kontraktu jest zamontowana — sedno pozycji A.2
   grep -n "assessment-report-contract" server/src/routes/method-core.routes.ts   # oczekiwane: :529
   grep -n "api/method" server/src/Gateway.ts | head -3                            # oczekiwane: mount :961

   # (c) ★ ZERO konsumenta na froncie — sedno CAŁEGO dyżuru
   grep -rn "assessment-report-contract\|assessmentReportContract\|assessment-skip-reasons" src/ dev-render/ tests/
   echo "^^ oczekiwane: CAŁKOWICIE PUSTE"

   # (d) słownik kodów Pomiń i dzisiejszy dual-write — sedno pozycji C.1
   wc -l src/components/method-workspace/skipReasonCodes.ts                  # oczekiwane: 47
   grep -n "formatSkipJustification" src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx   # oczekiwane: :38 i :569
   grep -n "formatSkipJustification" src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx      # oczekiwane: :30 i :400 — LUSTRO, NIE DOTYKASZ

   # (e) dzisiejszy „raport" w warsztacie — sedno pozycji B.1
   grep -n "reportContent" src/components/method-workspace/MethodWorkspaceShell.tsx                  # oczekiwane: :69 :128 :444
   grep -n "reportContent" src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx            # oczekiwane: :856

   # (f) ekran-wzorzec artefaktu Dokument — sedno pozycji A.3
   wc -l src/components/Audit/method/AuditReportDocumentView.tsx             # oczekiwane: 1359
   wc -l src/components/standard/ArtifactRightPanel.tsx                      # oczekiwane: 342

   # (g) harnessy istnieją — sedno pozycji D.1
   wc -l dev-render/screens/drd-http-workspace.tsx                           # oczekiwane: 86
   wc -l dev-render/screens/audyty-raport-dokument.tsx                       # WZORZEC artefaktu Dokument
   wc -l dev-render/mocks/methodCoreFakeServer.ts                            # oczekiwane: 766
   grep -n "assessment-report-contract\|assessment-skip-reasons" dev-render/mocks/methodCoreFakeServer.ts
   echo "^^ oczekiwane: PUSTE — obie trasy dobudowujesz w atrapie serwera"

   # (h) ★ KATALOG RAPORTU JUŻ ISTNIEJE — sedno ERRATY poz. 11, przeczytaj ZANIM cokolwiek napiszesz
   ls -la src/components/assessment/report/
   wc -l src/components/assessment/report/*.ts*
   # oczekiwane: 7 plików, ~1185 linii (AssessmentReportView 137 · AssessmentReportDocument 605 ·
   #   reportApi 129 · types 138 · drdLabels 118 · maturityBands 53 · index 5) + katalog __tests__
   grep -rn "AssessmentReportView" src/ --include='*.tsx' --include='*.ts' | grep -v "components/assessment/report/"
   echo "^^ oczekiwane: PUSTE — ten ekran jest DZIŚ NIEOSIĄGALNY w aplikacji"

   # (i) konwencja flagi ff_* — sedno pozycji A.1
   wc -l src/utils/auditsFindingsAndReportViewFlag.ts       # WZORZEC, który kopiujesz
   ls src/utils/assessmentReportViewFlag.ts 2>/dev/null ; echo "^^ oczekiwane: BRAK PLIKU"
   ```

   **Brak (a), (b) albo (d) = STOP całego dyżuru** — pracujesz na złej bazie.
   **Niepuste (c) = STOP** — ktoś zbudował konsumenta kontraktu przed Tobą,
   zakres wymaga ponownego rozstrzygnięcia nadzorcy.
   **Niepusty drugi grep z (h) = NIE STOP**, tylko wpis w „Korektach": ktoś
   podłączył zastany, output-owy ekran raportu — wtedy §1.8 pułapka nr 9
   („dwa raporty") wymaga ponownego przeczytania przed pozycją A.3.

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md          # w chwili wystawienia: 182
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY20_REPORT_20260826.md          # w chwili wystawienia: 335
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md
   wc -l Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md                                 # w chwili wystawienia: 1761
   grep -n "DEC-2026-08-26-103\|DEC-2026-08-26-115\|DEC-2026-08-26-119\|DEC-2026-08-26-122\|DEC-2026-08-26-125" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "ASM-OWN-025\|ASM-OWN-026" docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestry rosną) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   `DEC-103`, `DEC-119`, `DEC-122` i `ASM-OWN-025` się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/assessment-report-front-day27-<data> 6d3cebe779
   git worktree add /private/tmp/consultify-assessment-day27 codex/assessment-report-front-day27-<data>
   cd /private/tmp/consultify-assessment-day27
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                     | Dlaczego                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/assessment-report-front-day27-<data>`                                                                                                                                                                        | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                      |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/assessment-*` (w szczególności **`codex/assessment-day25-20260826`**, która jest w użyciu)                                                                                                                                                | `demo` = święta baza; dzień 25 pracuje w tej chwili                                                    |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                      | Krach 3/4 powstał tak; `DEC-95`                                                                        |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                         | Wymagania są w rejestrze uwag i decyzjach                                                              |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                   | Chroniony, brudny worktree właściciela                                                                 |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich **45**, w tym `consultify-assessment-day25`, `consultify-assessment-day20`, `consultify-odbior-day24`, `consultify-m03-ledger`                                                                                                                            | Cudze worktree, część w aktywnym użyciu                                                                |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ m.in.: 5000, 5037, **5432**, **5474**, **5499** (`cx-day25-pg` — dzień 25!), **5505** (`cx-odbior24-pg`), 6379, 7000, 7679, 7768, 8099, 9191, 11434. **Twój harness `dev-render` = port 3362.** Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu                          | Cudze dyżury pracują równolegle                                                                        |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                      | Produkcja/demo poza zakresem                                                                           |
| **Z9**  | **★ ŻADNEJ BAZY. W OGÓLE.** Ten dyżur nie potrzebuje PostgreSQL — harness `dev-render` mountuje realny komponent przeciwko atrapie HTTP w pamięci. **Nie stawiasz kontenera, nie uruchamiasz testów z `RUN_DB_TESTS`, nie dotykasz `DATABASE_URL`.** Jeśli uznasz, że pozycja wymaga bazy — **to jest STOP**, nie kontener                                | „dane demo = twarz produktu" (`DEC-65`); a nadto port 5499 należy do dnia 25                           |
| **Z10** | **Dokładnie JEDNA nowa flaga: `ff_assessmentReportView`, `defaultValue: false`.** Zero innych nowych flag. **Zero zmian wartości domyślnej istniejącej flagi** — `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1` zostają OFF                                                                                              | CLAUDE.md reguła 7 i 9 + ★ pkt 7                                                                       |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/assessment/*`. **Nowy ekran NIE dostaje własnego URL-a** — wchodzi jako treść istniejącej powierzchni (§B)                                                                                                            | Gramatyka tras zaakceptowana; nowy URL = nowa powierzchnia do osobnego odbioru                         |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_REPORT_FRONT_DAY27_REPORT_20260826.md`. **Raportów dnia 20 i 25 NIE edytujesz**, `MODULE_ACCEPTANCE.md` **NIE podnosisz** (robi to nadzorca po odbiorze wizualnym)                                                       | Repo tonie w dokumentach-duchach; podniesienie odbioru bez zrzutów zaakceptowanych = zawyżenie         |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie                                                                                                                                                                                                                                               | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                             |
| **Z14** | **★★ ZERO LLM, ZERO generowania treści.** Nie wpinasz `llmService`, nie wołasz `/api/ai/**`, nie wypełniasz `content` ani `decisionLine` żadnym tekstem — także „przykładowym", także „na czas prototypu"                                                                                                                                                 | Silnik AI = moduł agenta, ostatni w programie; `content: null` to KONTRAKT, nie brak                   |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych.** `content: null`, `currentLevel: null`, `evidenceState: 'not_assessed'`, `skipCode: null` przy dwóch różnych kodach — to **poprawne wartości**, nie defekty. Renderujesz je uczciwie                                                                                                          | „nie wiem" nie jest liczone ani jako zero, ani jako sukces (kanon Assessmentu)                         |
| **Z16** | **★★ ZAKAZ dotykania `server/src/**` i `server/migrations/**`** — bez wyjątku, także „jednej linii typu", także „tylko komentarz"                                                                                                                                                                                                                         | Dzień 25 pracuje w tych plikach RÓWNOLEGLE (§1.8)                                                      |
| **Z17** | **★ Zakaz wszystkiego poza frontem raportu Assessmentu i przepięciem skip-code** — z imiennymi wyjątkami z ramki poniżej                                                                                                                                                                                                                                  | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                         |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `tests/utils/assessmentMocks/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów                                                               |
| **Z19** | **★★ ZAKAZ dotykania `src/components/standard/**` i `src/components/shared/**`.** `ArtifactRightPanel`, `ArtifactBreadcrumb`, `NModeShell`, `NModeHeader`, `StandardTable`, `PreviewPaneShell` — **WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ**. Potrzebujesz nowego propa w powłoce → **STOP**, nie edycja                                                         | Powłoka ma akcept właściciela na zrzutach (`DEC-125`, `DEC-57`); zmiana kasuje cudze odbiory           |
| **Z20** | **★★ DoD wymaga dowodu OSIĄGALNOŚCI, nie istnienia kodu** (`DEC-104`). Komponent, do którego nie prowadzi ścieżka od realnego wejścia (`AppRoutes` → moduł → ekran, albo harness `dev-render`), jest **martwy** i nie liczy się do DoD. Dowodem jest ŚCIEŻKA MONTAŻU wypisana plik:linia                                                                  | 30 martwych komponentów Assessmentu (~438 KB) usuniętych w `DEC-115` powstało dokładnie tak            |
| **Z21** | **★★ Test na zamockowanym module NIE dowodzi ekranu** (`DEC-107`). Każda pozycja wizualna MUSI mieć **test montujący REALNY komponent** (testing-library) i **zrzut z harnessu mountującego REALNY komponent**. Test grepujący źródło (`toContain('...')`) **nie liczy się do DoD**                                                                       | Wcześniejszy dyżur miał 8/8 zielonych testów warstwy, która nie mogła zadziałać                        |
| **Z22** | **★★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-108`). Kontrolka, dla której nie ma API, **nie powstaje** — zamiast niej `BRAK_API` w raporcie albo wyszarzony wiersz „Planowane". Etykieta obiecująca skutek, którego nie ma, jest defektem, nie placeholderem                                                                                          | `DELETE /:id/occurrence` zwracał 200 bez zmiany w bazie; „Eksportuj wszystko" bez renderera to to samo |
| **Z23** | **★★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-108`). Raport podaje wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem na czerwone **ZASTANE** (zmierzone na markerze, PRZED Twoim pierwszym commitem) i **WPROWADZONE przez dyżur**, **z liczbą SKIPPED**. **Podanie zawężonego wyboru = naruszenie**                                                              | Deklarowane „98/98 PASS" było wyborem; w zakresie własnej instrukcji było 164/167                      |

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
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

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  src/utils/assessmentReportViewFlag.ts                             (NOWY — pozycja A.1; wzór DOSŁOWNY: src/utils/auditsFindingsAndReportViewFlag.ts)
  src/method-core/api/methodCoreApi.ts                              (★ TYLKO ADDYTYWNIE — pozycje A.2 i C.1: dwie nowe funkcje + typy, ZERO zmian w istniejących)
  src/components/assessment/report/<NOWE PLIKI>                     (★ KATALOG JUŻ ISTNIEJE — ERRATA poz. 11. Dokładasz NOWE pliki; siedmiu zastanych NIE ZMIENIASZ)
  src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx    (WYŁĄCZNIE pozycje B.1 i C.1)
  public/locales/pl/translation.json                                (★ TYLKO gałąź assessment.reportView.* — patrz ERRATA §1.2 poz. 7)
  public/locales/en/translation.json                                (★ jw., parytet w TYM SAMYM commicie)
  dev-render/screens/assessment-report-contract.tsx                 (NOWY ekran harnessu — pozycja D.1; nazwa NIE koliduje z zastanym assessment-output-report.tsx)
  dev-render/main.tsx                                               (★ WYŁĄCZNIE dwie linie: lazy import + wpis w rejestrze SCREENS)
  dev-render/mocks/methodCoreFakeServer.ts                          (★ TYLKO ADDYTYWNIE: dwie brakujące trasy — pozycja D.1)
  src/components/assessment/report/__tests__/<NOWE PLIKI>           (★ katalog istnieje; dokładasz NOWE, zastanych nie osłabiasz)
  src/components/assessment/drd/__tests__/**                        (★ TYLKO NOWE pliki; istniejących NIE osłabiasz)
  docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-report-front-20260826/**   (TYLKO nowe zrzuty §D.2)
  docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_REPORT_FRONT_DAY27_REPORT_20260826.md   (jedyny nowy dokument)

IMIENNE WYJĄTKI (wolno CZYTAĆ i UŻYWAĆ istniejące, NIE zmieniać ich kodu):
  src/components/standard/ArtifactRightPanel.tsx                    (UŻYWASZ; zmiana = STOP — Z19)
  src/components/standard/ArtifactBreadcrumb.tsx                    (UŻYWASZ; zmiana = STOP — Z19)
  src/components/standard/ArtifactPropertiesTable.tsx               (UŻYWASZ w sekcji Właściwości; zmiana = STOP — Z19)
  src/components/shared/NModeLayout/**                              (UŻYWASZ NModeShell; zmiana = STOP — Z19)
  src/components/shared/states/**                                   (UŻYWASZ LoadingState/ErrorState/EmptyState; zmiana = STOP — Z19)
  src/components/assessment/report/drdLabels.ts                     (★ CZYTASZ i WOŁASZ resolveDrdUnitLabel/resolveDrdAxisName; zmiana = STOP)
  src/components/assessment/report/AssessmentReportView.tsx         (★ CZYTASZ jako wzorzec czterech uczciwych stanów; ZMIANA = STOP — ERRATA poz. 11)
  src/components/assessment/report/AssessmentReportDocument.tsx     (★ CZYTASZ; ZMIANA = STOP — to INNY byt, output-owy, nie kontraktowy)
  src/components/Audit/method/AuditReportDocumentView.tsx           (CZYTASZ jako WZORZEC; zmiana = STOP — cudzy moduł, DEC-125)
  src/components/method-workspace/skipReasonCodes.ts               (CZYTASZ i WOŁASZ; zmiana słownika = STOP — DEC-55)
  src/components/method-workspace/MethodWorkspaceShell.tsx          (CZYTASZ kontrakt propa `reportContent`; ZMIANA = STOP)
  src/services/drdStructure.ts                                      (CZYTASZ — zamknięte przez B.1 dnia 20)
  src/method-core/methods/drd/drdHttpSessionRuntime.ts              (CZYTASZ wzorzec kolejki retry; zmiana = STOP, chyba że C.1 dowiedzie realnej luki — wtedy wpis i decyzja nadzorcy)

NIE WOLNO:
  ★ CAŁE server/**                                                  ← bez wyjątku (Z16); dzień 25 tam pracuje
  ★ src/components/standard/**  ·  src/components/shared/**         ← Z19
  src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx        ← ★ LUSTRO PRZEGLĄDARKOWE, dostanie 404 (DEC-119). NIE PRZEPINASZ
  src/components/method-workspace/InterviewFocusPanel.tsx           ← picker kodów ma akcept, nie ruszasz
  src/routes/AppRoutes.tsx · src/routes/routeConfig.ts              ← Z11
  src/components/assessment/AssessmentHub.tsx                       ← powłoka listy ma akcept; wejście robisz przez `reportContent` (§B)
  tests/e2e/**  ·  tests/acceptance/**                              ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(assessment): default-off flag reader for the report document view (A.1)
  feat(assessment): typed client for the seven-chapter report contract (A.2)
  feat(assessment): report document artefact renders seven honest chapters (A.3)
  feat(assessment): per-question skip codes surfaced in Polish on the report (A.4)
  feat(assessment): report view reachable from the workspace behind the flag (B.1)
  feat(assessment): HTTP workspace posts the machine skip code after recordAnswer (C.1)
  chore(dev-render): harness screen and fake routes for the report document (D.1)
  docs(assessment): light and dark evidence for the report document view (D.2)
  test(assessment): behaviour tests for the report view, flag reader and skip post (E.1)
  docs(assessment): server-to-client contract parity table (E.2)
  docs(assessment): day 27 front duty report (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
- **Typy punktowo** — `npx esbuild <plik> --loader:.tsx=tsx --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest`.**
  **★ Uwaga: `esbuild` TRANSPILUJE, nie typuje — nie złapie błędu typu.**
  Dlatego każda nowa powierzchnia ma **test montujący** (Z21), który złapie to,
  czego esbuild nie widzi.
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu · **uczciwy pusty stan** · **dowód OFF** (flaga wyłączona →
  komponent nie renderuje i **nie wykonuje żadnego żądania**).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z21).
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `src/` dodają się normalnie.
- **★ ZERO MIGRACJI.** Ten dyżur nie ma przedziału numerów, bo **nie wolno mu
  dodać ani jednej migracji**. Migracja = naruszenie Z16.
- **★ Dane demo = twarz produktu.** Harness `dev-render` używa **mocków w
  plikach harnessu**, nigdy zapisów do jakiejkolwiek bazy. Zero rekordów
  testowych gdziekolwiek.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Zero atrap (Z22).** Każda kontrolka, którą widać, coś robi. Kontrolka bez
   API **nie powstaje** — zamiast niej wpis `BRAK_API` w raporcie albo
   wyszarzony wiersz „Planowane" (wzór: eksport PDF w `AuditReportDocumentView`,
   §0 pkt 5).
2. **Realne dane tam, gdzie są.** Odczyt idzie do realnego backendu przez
   `src/method-core/api/methodCoreApi.ts`. Zero `sampleData`, zero zaszytych
   tablic, zero `localStorage` jako źródła prawdy w kodzie produkcyjnym.
   **Mocki wolno TYLKO w `dev-render/` i w testach.**
3. **★ UCZCIWY PUSTY STAN, nie wypełniacz.** `content: null` renderujesz jako
   jawną informację „sekcja do uzupełnienia — limit N–M słów", nigdy jako
   lorem ipsum, nigdy jako pustą ramkę bez podpisu, nigdy jako wygenerowany
   tekst (Z14).
4. **★ PARYTET Z KONTRAKTEM SERWERA.** Każde pole DTO z tabeli §2.1 jest albo
   **wyrenderowane**, albo **jawnie wypisane w raporcie jako świadomie
   pominięte, z powodem**. Pole, którego nie ma w kontrakcie, **nie pojawia
   się na ekranie** (Z22 + §1.8 pułapka nr 3).
5. **Minimum 4 testy zachowania** przechodzą: happy · błąd · uczciwy pusty stan ·
   **dowód OFF**. Testy grepujące źródło się nie liczą (Z21).
6. **★ Z20 — dowód OSIĄGALNOŚCI**, nie istnienia komponentu:
   ```
   realne wejście (jak użytkownik tam trafia)
     → montaż w module (plik:linia)
     → czytnik flagi (plik:linia)
     → komponent (plik:linia)
     → funkcja klienta HTTP (plik:linia)
     → trasa serwera (plik:linia)
   ```
7. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson `#85182F`.
   Czerwień **wyłącznie** semantyka krytyczna. CTA i stany aktywne = neutralne;
   fokus = `focus-visible:ring-2 ring-[color:var(--c-focus)]`, **nigdy**
   `primary-*`. Hook `scripts/check-artefakt.sh` (pre-commit) blokuje naruszenia
   w powłoce — **nie obchodzisz go `--no-verify`**.
8. **i18n PL + EN OD RAZU**, w tym samym commicie co kod — **klucz tworzysz
   w chwili tworzenia napisu, nie „na końcu"**. Zero polskich literałów w JSX,
   zero angielskich literałów w JSX. Klucze **wyłącznie** w gałęzi
   `assessment.reportView.*` (ERRATA §1.2 poz. 7 — `assessment.report.*` jest
   ZAJĘTE przez legacy). Parytet PL/EN co do liczby kluczy **w tej gałęzi**.
9. **★ ZERO SUROWYCH ENUMÓW NA TWARZY.** `evidenceState`, `uncertainty`,
   `skipCode`, `microstructure` to **maszynowe identyfikatory** — na ekranie
   pokazujesz **polską etykietę**, nigdy `not_assessed` ani
   `poza_modelem_operacyjnym`. Wzór złapania tego błędu: `DEC-125` (robotnik
   przy oględzinach własnego zrzutu znalazł ostatni surowy enum i naprawił
   przed oddaniem — **zrób tak samo**).
10. **Light i dark** — powierzchnia czytelna w obu motywach, tokeny `c-*`,
    zero `navy`/`slate`/surowych hex.
11. **★ Zrzut własny dla każdej NOWEJ powierzchni wizualnej** — harness
    `dev-render`, **light i dark, PL**, wykonany przez Ciebie, obejrzany przez
    Ciebie, wrzucony do
    `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-report-front-20260826/`.
    Zrzut czysty: zero gwiazdek, zero ozdób. **Bez zrzutu pozycja wizualna jest
    CZĘŚCIOWA.** Do każdego zrzutu dołączasz `KONSOLA-BLEDY` i `SIEC-4XX5XX`
    ze `stdout` `shot.mjs` (§D.2).
12. **Plik przez `prettier`** przed commitem + **wpis w raporcie**:
    `pozycja → commit SHA → status → dowód osiągalności → dowód testowy → zrzut`.

> Punkty „realny PG", „readback niezależnym poolem", „negatyw tenanta w bazie"
> **nie obowiązują** w tym dyżurze — serwer i baza są poza zakresem (§1.6).
> Odpowiednikiem negatywu tenanta jest tu **dowód, że front nigdy nie wysyła
> `organizationId`** (serwer bierze go wyłącznie z tokenu) — patrz §C.1 pkt 5.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze bazowym, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
3. Uruchom **minimum** poniższą listę (**bez** żadnych zmiennych bazodanowych —
   Z9; te pakiety są frontowe i działają na `jsdom`):
   ```bash
   # rdzeń, którego dotykasz
   npx vitest run src/components/assessment/report
   npx vitest run src/components/assessment/drd/__tests__
   npx vitest run src/method-core/methods/drd/__tests__
   npx vitest run src/method-core/__tests__

   # regresja sąsiadów — NIE zmieniasz ich, mają pozostać na poziomie zastanym
   npx vitest run tests/components/assessment
   npx vitest run src/components/method-workspace/__tests__
   npx vitest run tests/unit/assessment
   npx vitest run tests/unit/services/drdStructure.test.ts
   npx vitest run src/components/Audit/method/__tests__/AuditReportDocumentView.test.tsx
   npx vitest run src/components/standard/__tests__

   # i18n — parytet nowej gałęzi
   npx vitest run tests/unit/i18n
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego), **z osobną tabelą „czerwone ZASTANE" i „czerwone
   WPROWADZONE", z kolumną SKIPPED**. **Czerwonych zastanych NIE naprawiasz** —
   opisujesz. Znane zastane z dnia 20/25 (do potwierdzenia u siebie, nie do
   przepisania na wiarę): `tests/components/assessment` (8 FAIL w plikach
   Outputs), `src/components/assessment/drd/__tests__` (6 FAIL, banner demo),
   `NModeHeaderConfig.secondaryActions` (4 przedistniejące czerwone, `DEC-125`).
   **Każdą czerwoną wprowadzoną** albo naprawiasz, albo zgłaszasz jako STOP;
   przemilczenie = naruszenie.
5. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu
   „przed/po" w raporcie.** Dotyczy to również usunięcia bloku `describe`.
   Osłabienie bez wpisu = odrzucenie.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić cokolwiek w `server/` (Z16) — **zawsze STOP, bez wyjątku**;
- **dopisać do kontraktu serwera brakujące pole** — to jest STOP z opisem, a nie
  wyliczenie go na froncie (★ ograniczenie krytyczne pkt 3);
- zmienić `src/components/standard/**` albo `src/components/shared/**` (Z19) —
  także „tylko o jeden opcjonalny prop";
- dotknąć `DrdMethodWorkspaceScreen.tsx` (lustro przeglądarkowe) — **zawsze STOP**;
- dodać nową flagę poza `ff_assessmentReportView` albo zmienić wartość domyślną
  istniejącej (Z10);
- wpiąć dostawcę modelu / wygenerować treść / wypełnić `content` (Z14);
- zbudować kontrolkę bez realnej ścieżki (→ `BRAK_API` albo „Planowane", nie atrapa — Z22);
- dodać migrację albo uruchomić cokolwiek przeciwko bazie (Z9);
- zmienić cudzy test spoza wąskiej licencji z §0.2 (Z18/Z17);
- dodać nowy URL / trasę (Z11);
- obejść hook pre-commit (`--no-verify`) — **to jest zakaz, nie STOP**: naprawiasz
  kod, nie omijasz strażnika.

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
9,5** (`DEC-2026-08-26-103`) — najsłabszy wynik w całym programie. Trzy powody
rozstrzygające: (1) deliverable nie istnieje, (2) moduł AI-native nie ma AI,
(3) zaakceptowana architektura jest wyłączona.

Od tego czasu:

- **`DEC-2026-08-26-115`** — tania partia napraw frontu SCALONA: 45 martwych
  komponentów usuniętych, atrapy pod przyciskami zlikwidowane, **słownik 4 kodów
  „Pomiń" zbudowany** (`skipReasonCodes.ts`). Front zapisuje wtedy **etykietę
  przez `justification`**, bo jądro nie ma pola `skipReason`.
- **`DEC-2026-08-26-119` / `DEC-2026-08-26-122`** — dzień 20 (backend) odebrany
  i SCALONY: model 7 osi ujednolicony klient↔serwer, słownik kodów po stronie
  serwera **zgodny z frontem co do bajta**, **deterministyczny kontrakt raportu
  7 rozdziałów**, pakiet 11/11 testów realnego routera.

`DEC-122` zapisuje **dokładnie dwie otwarte pozycje koordynacyjne dla frontu** —
i to jest **cały Twój zakres**:

> „KOLEJNY KROK KOORDYNACJI (otwarty): przepięcie frontu z zapisu etykiety-przez-
> `justification` na POST kodu — TYLKO ekran HTTP, osobny zapis po `recordAnswer`
> z `Idempotency-Key` (warunki z `DEC-119`)."
> — `OWNER_DECISION_LEDGER_2026-08-24.md:174`

…oraz, wprost z `DEC-103`, zbudowanie **konsumenta kontraktu 7 rozdziałów**,
którego dziś nie ma **ani jednego** (dowód: §0.1 pkt 3 komenda (c) zwraca pustkę).

### 1.2. ★★ ERRATA — PIĘTNAŚCIE RZECZY, KTÓRE ZMIENIŁY SIĘ ALBO BYŁY NIEŚCISŁE

**Nadzorca zweryfikował KAŻDĄ pozycję zakresu w kodzie na tipie
`codex/m03-admin-20260824`, na markerze wskazanym w §0.1. Poniższe ustalenia są stanem
faktycznym i mają pierwszeństwo przed treścią rejestrów. Ty weryfikujesz je
ponownie w Bloku 0 — rozbieżność wobec tej tabeli jest wpisem w „Korektach
wobec instrukcji", nie powodem do improwizacji.**

| #      | Teza z materiałów zlecenia                                                            | Stan faktyczny (zweryfikowany w kodzie)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Skutek dla zakresu                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | „front ma być gotowy na `outputId`/`revision` w DTO, ale NIE zależeć od niego twardo" | **`outputId` i `revision` JUŻ SĄ w DTO** — `assessmentReportContractService.ts:78-79` (`outputId: output?.id ?? null`, `revision: output?.outputVersion ?? 0`). Dzień 25 dodaje **selektor rewizji** (`?outputId=` / `?revision=`) i niezmienność „as-of", nie same pola                                                                                                                                                                                                                                                                                                                                                                         | **Renderujesz oba pola OD RAZU** (nagłówek + prawy panel). **NIE wysyłasz** żadnego parametru rewizji — dziś trasa nie ma ŻADNEGO query paramu                                                                                                                 |
| **2**  | „kontrakt zwraca 7 rozdziałów"                                                        | Potwierdzone, ale odpowiedź jest **opakowana**: `res.status(200).json({ reportContract })` (`method-core.routes.ts:538`). Rozdziały są pod `reportContract.chapters`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Klient rozpakowuje kopertę `{ reportContract }` — jak `{ packs }`, `{ skipReasons }` w tym samym routerze                                                                                                                                                      |
| **3**  | „39 obszarów, osie mają 5 albo 7 poziomów"                                            | **Wektor skali to `7,5,5,7,6,6,5`** (`server/src/data/drdStructure.ts`, po B.1 `0e34ffe479`). Oś 1 ma **9 obszarów** (1A–1I), pozostałe po 5. Razem **39**. Komentarz w nagłówku pliku mówi „34 areas total" — **jest nieaktualny**                                                                                                                                                                                                                                                                                                                                                                                                              | Layout rozdziału musi znieść **9 komentarzy** (oś 1) i **5** (pozostałe). Nie zaszywasz „5"                                                                                                                                                                    |
| **4**  | „`uncertainty` ma pięć wartości, w tym `conflicting`"                                 | **Implementacja NIGDY nie emituje `conflicting`.** `assessmentReportContractService.ts:106-112` i `:131-137` dają wyłącznie `evidenced` \| `incomplete` \| `declared` \| `not_assessed`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Słownik PL ma **cztery** wpisy. Piąty byłby martwym kodem (Z22)                                                                                                                                                                                                |
| **5**  | „`skipCode` mówi, jakim kodem pominięto obszar"                                       | **`skipCode` jest `null`, gdy pominięć jest więcej niż jedno** (`:70` — „never arbitrarily pick among multiple different codes"). Prawdą per pytanie jest **`skips: [{questionId, skipCode}]`**. `skipped` obszaru = `true` **tylko** gdy liczba RÓŻNYCH poziomów objętych pominięciem osiąga `axis.levelCount` (`:64-65`)                                                                                                                                                                                                                                                                                                                       | **Renderujesz `skips[]`, nie `skipCode`.** `skipCode` traktujesz jako skrót wsteczny, nigdy jako źródło prawdy (§A.4)                                                                                                                                          |
| **6**  | „`areaComments` niosą nazwę obszaru"                                                  | **NIE.** `areaComments[]` ma tylko `unitId` (`:120`). `unitName`/`unitNamePL` są **wyłącznie** w `matrix.areas[]` (`:97-98`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Front **łączy po `unitId`** — z `matrix.areas` albo z klienckiego `src/services/drdStructure.ts`. Nigdy nie pokazuje gołego `1A` jako nagłówka (DoD 9)                                                                                                         |
| **7**  | „klucze i18n idą do `assessment.report.*`"                                            | **`assessment.report.*` JEST ZAJĘTE** przez legacy (10 kluczy: `strengths`, `dataGaps`, `roadmap`, `conclusions`, `shortTerm`, …). Ponadto globalny parytet PL/EN **jest już złamany** (PL 31302 kluczy vs EN 30410)                                                                                                                                                                                                                                                                                                                                                                                                                             | Twoja gałąź to **`assessment.reportView.*`**. Parytet PL/EN egzekwujesz **tylko w tej gałęzi**, nie globalnie                                                                                                                                                  |
| **8**  | „zapis kodu «Pomiń» to nowy POST"                                                     | Trasa **JUŻ ISTNIEJE**: `POST /api/method/sessions/:sessionId/assessment-skip-reasons` (`method-core.routes.ts:462-507`), wymaga `Idempotency-Key`, body `{unitId, questionId, level, skipCode}`, zwraca **`201 { skipReason }`**, bramkuje `requireSessionWriteRole`, `403 TENANT_CONTEXT_MISMATCH` gdy body niesie `organizationId`                                                                                                                                                                                                                                                                                                            | **Nie projektujesz API — konsumujesz istniejące.** ★ Kod odpowiedzi patrz poz. 9                                                                                                                                                                               |
| **9**  | „POST zwraca 201"                                                                     | **★ DZIEŃ 25 TO ZMIENIA W TEJ CHWILI.** Jego pozycja P2.2 brzmi: „`200` przy replayu, `201` przy realnym zapisie, `409` przy kolizji klucza" (`CODEX_DAY25_ASSESSMENT_BLOCK2_INSTRUKCJA.md`, §P2.2)                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Twój klient MUSI traktować `200` i `201` identycznie jako sukces.** Asercja `=== 201` będzie czerwona po scaleniu dnia 25 — to byłby dług, który sam wprowadzasz                                                                                             |
| **10** | „ekran raportu dostaje własną trasę"                                                  | Gramatyka `/assessment/*` jest zamknięta (Z11), a warsztat metody **ma już slot na raport**: `MethodWorkspaceShell` przyjmuje prop `reportContent: React.ReactNode` (`:69`, `:128`, renderowany `:444` pod `viewMode === 'report'`). Dziś `DrdHttpMethodWorkspaceScreen.tsx:856` wstrzykuje tam macierz + jedno zdanie na obszar — **dokładnie to, co potępił `DEC-2026-08-26-103`**. W `routeConfig.ts:72-81` **nie ma** stałej `ASSESSMENT.REPORT`                                                                                                                                                                                             | **Wejście robisz przez `reportContent`, nie przez nowy URL** (§B). Zero zmian w `AppRoutes`/`routeConfig`                                                                                                                                                      |
| **11** | „`src/components/assessment/report/` to nowy katalog"                                 | **★ KATALOG ISTNIEJE — siedem plików, ~1185 linii**: `AssessmentReportView.tsx` (137), `AssessmentReportDocument.tsx` (605), `reportApi.ts` (129), `types.ts` (138), `drdLabels.ts` (118), `maturityBands.ts` (53), `index.ts` (5) + `__tests__/`. To **INNY byt**: klucz = **`outputId`**, czyta `GET /api/method/outputs/:id` + `/sessions/:id` + `/sessions/:id/approvals`, renderuje zwykły przewijany dokument — **NIE powłokę SPEC-A** i **NIE kontrakt 7 rozdziałów**. Jest **dziś NIEOSIĄGALNY w aplikacji** (zero importerów poza własnym katalogiem; jedyny konsument to harness `dev-render/screens/assessment-output-report.tsx:24`) | **Nie zmieniasz ani jednego z tych siedmiu plików.** Twój ekran to NOWY plik w tym samym katalogu, o nazwie niekolidującej. `drdLabels.ts` **wolno WOŁAĆ** (join `unitId`→nazwa). Współistnienie dwóch raportów idzie do „Znalezisk" — patrz §1.8 pułapka nr 9 |
| **12** | „flagę robisz hookiem `useXFlag`"                                                     | **Prefiks `ff_` w nazwie flagi wskazuje INNĄ konwencję.** Flagi `ff_*` to moduły `src/utils/<nazwa>Flag.ts` z eksportami `is<Nazwa>Enabled()`, `reset<Nazwa>FlagCache()` i `<NAZWA>_FLAG_KEYS = {localStorage, query, env}`, rozstrzygające **query > localStorage > env > `false`**, całość w `try/catch` kończącym się `false`. Wzorzec: `src/utils/auditsFindingsAndReportViewFlag.ts`. Hooki `useFinance*Flag.ts` obsługują **inny** rejestr (`useFeatureFlags`, id bez prefiksu `ff_`)                                                                                                                                                      | **A.1 tworzy `src/utils/assessmentReportViewFlag.ts`**, nie hook. Klucze: `localStorage` `ff.assessment_report_view`, query `ff_assessmentReportView`, env `VITE_ASSESSMENT_REPORT_VIEW`                                                                       |
| **13** | „prawy panel ma pięć sekcji wg §11.2"                                                 | Kod jest **bogatszy niż dokument**: `ArtifactRightPanel.tsx:41-49` eksportuje `ARTIFACT_PANEL_SECTION_ORDER` = **siedem** id: `actions` · `properties` · `relations` · `evidence` · `results` · `comments` · `history`. Komentarz kanonu (`:38-40`): „Karta może POMINĄĆ sekcję (brak zastosowania), ale NIE MOŻE zmienić kolejności obecnych. **Test kolejności czyta tę stałą.**" `actions`+`properties` mają `defaultOpen: true`, reszta `false`                                                                                                                                                                                              | Używasz **id z tej stałej**, nie własnych. Renderujesz `actions` + `properties`; resztę pomijasz (brak danych). Do Właściwości używasz `ArtifactPropertiesTable` + typ `ArtifactPropertyRow`                                                                   |
| **14** | „dziś jest dual-write przez `justification`"                                          | **DZIŚ NIE MA ŻADNEGO DUAL-WRITE.** `handleSkip` (`DrdHttpMethodWorkspaceScreen.tsx:559-575`, podpięty `:825`) robi **JEDEN** zapis: `runtime.recordAnswer(...)` z `justification`, co schodzi do `POST /api/method/sessions/:id/events` (`drdHttpSessionRuntime.ts:308-322` → `methodCoreApi.ts` `appendEvent`). Kod maszynowy **nie jest wysyłany nigdzie**                                                                                                                                                                                                                                                                                    | **Dual-write POWSTAJE w tym dyżurze** (§C.1): `justification` zostaje, DOCHODZI POST kodu. Sformułowanie „dual-write zostaje" z `DEC-119` znaczy „nie usuwaj `justification`", a nie „coś już jest"                                                            |
| **15** | „retry napiszesz sam od zera"                                                         | `fetchWithRetry` (`src/services/api/baseClient.ts:87-161`) **już ponawia raz** po 1500 ms przy sieciowym `TypeError`/`Failed to fetch`, **z tymi samymi nagłówkami** (więc `Idempotency-Key` jest reużyty automatycznie). Twardy timeout 20 s → `Error('Request timed out')` z `.code='REQUEST_TIMEOUT'`. **Dedykowanego helpera retry w repo NIE MA**; kolejka `pendingWrites`/`retryPending` żyje w runtime'ach (`drdHttpSessionRuntime.ts:448-472`, `siriHttpSessionRuntime.ts:482-485`)                                                                                                                                                      | **Nie dokładasz drugiej warstwy ponowień na ślepo.** Policz realną liczbę prób (1 automatyczna + Twoje) i **wypisz ją w raporcie**; §C.1 pkt 6                                                                                                                 |

**Wniosek metodyczny — obowiązuje Cię w każdej pozycji:** materiał diagnostyczny
jest hipotezą, kod jest prawdą. **Każda pozycja zaczyna się od weryfikacji
w kodzie**, a rozbieżność wobec tej instrukcji jest **wpisem w raporcie**, nie
powodem do zgadywania (CLAUDE.md, złota reguła 1).

### 1.3. ZAKRES — dokładnie jedenaście pozycji, nic więcej

| Poz.    | Nazwa                                                  | Stan dziś                                              | Twój produkt                                                                                                         |
| ------- | ------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **A.1** | Flaga `ff_assessmentReportView` + czytnik              | flaga nie istnieje                                     | `src/utils/assessmentReportViewFlag.ts` (konwencja `ff_*`, ERRATA poz. 12), domyślnie OFF, fail-closed, z testem OFF |
| **A.2** | Klient HTTP kontraktu + typ DTO                        | zero konsumentów, zero typu po stronie klienta         | Funkcja w `methodCoreApi.ts` + ręcznie spisany typ DTO 1:1 z §2.1                                                    |
| **A.3** | Ekran raportu — artefakt Dokument (powłoka SPEC-A)     | brak; „raport" = macierz + jedno zdanie na obszar      | Powłoka SPEC-A + 7 rozdziałów w kanonicznej kolejności + **uczciwe puste sloty z limitem słów**                      |
| **A.4** | Pominięcia per pytanie + agregat obszaru, po polsku    | brak                                                   | `skips[]` renderowane per pytanie z etykietą PL; `skipped` obszaru jako jawny agregat; zero surowych enumów          |
| **B.1** | Wejście do ekranu z modułu Oceny, za flagą             | `reportContent` niesie potępioną przez `DEC-103` treść | Za flagą ON → nowy ekran; OFF → treść zastana, bit w bit                                                             |
| **C.1** | Przepięcie zapisu kodu „Pomiń" — TYLKO ekran HTTP      | zapisywana jest polska ETYKIETA przez `justification`  | Osobny POST kodu maszynowego po `recordAnswer`, `Idempotency-Key`, retry, **dual-write zostaje**                     |
| **D.1** | Harness `dev-render` + brakujące trasy atrapy serwera  | harness ekranu HTTP jest; obu tras w atrapie nie ma    | Nowy ekran harnessu + dwie trasy w `methodCoreFakeServer.ts`                                                         |
| **D.2** | Zrzuty light+dark, 4 scenariusze, **własne oględziny** | brak jakiegokolwiek zrzutu tej powierzchni             | 8 zrzutów + `KONSOLA-BLEDY`/`SIEC-4XX5XX` + lista defektów, które **sam znalazłeś i naprawiłeś**                     |
| **E.1** | Testy punktowe                                         | brak                                                   | ≥4 testy zachowania per powierzchnia, w tym **dowód OFF bez żądania sieciowego**                                     |
| **E.2** | Tabela parytetu kontraktu serwer↔front                 | brak                                                   | Tabela: pole DTO → gdzie renderowane → albo powód pominięcia                                                         |
| **R.1** | Raport dyżuru                                          | —                                                      | `ASSESSMENT_REPORT_FRONT_DAY27_REPORT_20260826.md` wg szablonu §9.1                                                  |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `server/`** — trasy, serwisy, migracje, testy serwerowe. Bez wyjątku.
2. **★ Eksport PDF / «Eksportuj wszystko»** (`ASM-OWN-026`) — renderer,
   paginacja, TOC, znak wodny `DRAFT`, metadane dokumentu. To osobny tor
   szablonów. W panelu Akcje: wyszarzony wiersz „Planowane".
3. **★ Generowanie treści rozdziałów** (Z14). `content: null` zostaje `null`.
4. **★ Lustro przeglądarkowe `DrdMethodWorkspaceScreen.tsx`** — `DEC-119` mówi
   wprost: przepięcie możliwe **TYLKO na ekranie HTTP**, bo lustro dostanie 404.
   **Nie dotykasz go ani jedną linią.**
5. **★ Podpięcie 26 endpointów AI do UI** — front po prototypie i decyzji o
   kluczu (`DEC-59`). Ty ich **nie usuwasz** i **nie podpinasz**.
6. **★ Zmiana wartości domyślnych flag** `drdMethodWorkspaceSliceV1`,
   `methodWorkspaceShellV1`, `drdHttpSourceOfTruthV1` (Z10).
7. **Wersjonowanie kontraktu (E.2 dnia 25)** — selektor rewizji, niezmienność
   „as-of". **Robi to dzień 25 na serwerze, RÓWNOLEGLE.** Ty tylko **renderujesz**
   `outputId`/`revision`, których dostarcza dzisiejszy kontrakt.
8. **Rozstrzygnięcie kanonu 7 osi vs 8 wymiarów raportu** — `ASM-CHAPTER-AC-008`
   ma status `CANON_DECISION_REQUIRED`. Ty budujesz **7 rozdziałów**, bo tyle
   niesie kontrakt; sprzeczności nie „rozwiązujesz" po cichu.
9. **Podniesienie `MODULE_ACCEPTANCE.md`** — robi nadzorca po odbiorze zrzutów.
10. **Włączenie flagi na demo.** Flaga zostaje OFF (★ pkt 7).

### 1.5. Decyzje wiążące

1. **`DEC-2026-08-25-46`** — **7 osi wszędzie** (raport / eksport / opis
   produktu). **OWNER_ACCEPT.** Twój ekran ma **dokładnie siedem** rozdziałów.
2. **`DEC-2026-08-25-47`** — **Report = jeden obiekt przy sesji z historią
   wersji**; eksport do Materiałów jako migawka. **OWNER_ACCEPT.** Stąd
   `outputId`/`revision` w nagłówku ekranu (ERRATA poz. 1).
3. **`DEC-2026-08-25-55`** — słownik kodów „Pomiń", **cztery kody**, wybór
   wymagany. **OWNER_ACCEPT.** Zbudowany po obu stronach — Ty go **nie
   zmieniasz**, tylko przepinasz zapis (§C.1).
4. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   zakaz deployów, Railway, zdalnych migracji/seedów. **Prawo nadrzędne.**
5. **`DEC-2026-08-26-95`** — rozejście marker→tip rozstrzyga nadzorca; start
   dokładnie z markera, bez rebase.
6. **`DEC-2026-08-26-103`** — panel ekspercki modułu Ocena (4,0/10) — **źródło
   tego zakresu**; zarzut nr 1 („deliverable nie istnieje") to Twoja pozycja A.3.
7. **`DEC-2026-08-26-104`** — **Z20**: dowód **osiągalności**, nie istnienia kodu.
8. **`DEC-2026-08-26-107`** — **Z21**: test na atrapie nie dowodzi ekranu.
9. **`DEC-2026-08-26-108`** — **Z22** (zakaz atrapy) i **Z23** (pomiar bez zawężania).
10. **`DEC-2026-08-26-115`** — tania partia frontu SCALONA; źródło
    `skipReasonCodes.ts` i dzisiejszego dual-write przez `justification`.
11. **`DEC-2026-08-26-119`** — odbiór dnia 20; **źródło warunków przepięcia
    skip-code**: TYLKO ekran HTTP · osobny zapis po `recordAnswer` ·
    `Idempotency-Key` · retry · dual-write z `justification` do odwołania.
12. **`DEC-2026-08-26-122`** — dzień 20 SCALONY; potwierdza, że kontrakt
    7 rozdziałów i słownik kodów są zamknięte i gotowe do konsumpcji.
13. **`DEC-2026-08-26-125`** — Audyty R1-R3 SCALONE; **`AuditReportDocumentView`
    jest Twoim ekranem-wzorcem** (payload domyślnie, tryby, `ArtifactRightPanel`,
    sekcje pominięte przy braku danych zamiast atrapy).
14. **`ASM-OWN-025`** (`OWNER_FEEDBACK_REGISTER.md:1673`) — **kontrakt
    WŁAŚCICIELA rozdziału**: wstęp 120–180 · macierz z podpisem 30–60 ·
    komentarz per obszar 110–170 (pięcioczęściowa mikrostruktura) · wnioski
    180–260 + linia decyzyjna `Rekomendowany kierunek | Priorytet | Horyzont |
Warunek powodzenia`. **To jest kolejność sekcji w rozdziale — nie zmieniasz jej.**
15. **`DEC-86`** — symlink `node_modules` do odczytu.
16. **CLAUDE.md reguła 6 (SPEC-A)** i **reguła 7 (Piotr nigdy nie jest pierwszym
    testerem wizualnym)** — prawo nadrzędne UI.

> **★ Nota o zapisie identyfikatorów decyzji.** W tym dokumencie skróty
> `DEC-103`, `DEC-115`, `DEC-119`, `DEC-122`, `DEC-125` oznaczają odpowiednio
> `DEC-2026-08-26-103/115/119/122/125`, a `DEC-46`, `DEC-47`, `DEC-55`, `DEC-57`,
> `DEC-59`, `DEC-65` — `DEC-2026-08-25-46/47/55/57/59/65`. **W rejestrze
> `OWNER_DECISION_LEDGER_2026-08-24.md` występuje WYŁĄCZNIE forma pełna** —
> `grep "DEC-125"` zwróci pustkę i **nie jest to dowód, że decyzji nie ma**.
> Grepuj formą pełną.

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ty = FRONT.** Komponenty, hooki, klient HTTP, i18n, flaga, harness, zrzuty,
testy komponentów. **Dzień 25 = TYŁ** (trasy, serwisy, migawka rewizji, kody
odpowiedzi) — pracuje **w tej chwili**, na tych samych trasach.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do serwera — **należy do serwera**, a Ty wpisujesz to do „Znalezisk"
jako `BRAK_W_KONTRAKCIE` z opisem, czego brakuje i do czego byłoby potrzebne.

Twoim obowiązkiem wobec serwera jest **jawna lista oczekiwań w raporcie**: co
konsumujesz, w jakim kształcie, co byś potrzebował dodatkowo i dlaczego. Ta lista
trafia do nadzorcy jako wejście do kolejnego dyżuru serwerowego — **nie
implementujesz jej sam**.

### 1.7. Stan faktyczny — co JUŻ JEST (zweryfikowane na markerze z §0.1)

```
# KONTRAKT SERWERA — GOTOWY, ZERO KONSUMENTÓW
server/src/services/assessment/assessmentReportContractService.ts   156 linii
  :18   class AssessmentReportContractService
  :19   async build(organizationId, sessionId)      ← JEDYNA metoda publiczna
  :10-16 AREA_MICROSTRUCTURE = 5 identyfikatorów (stan_faktyczny … najblizszy_krok)
  :55-73 areaSkipInfo() — agregat pominięć obszaru
  :75-152 zwracany obiekt (DTO) — BEZ deklarowanego typu, BEZ eksportowanego interfejsu
  :156  export const assessmentReportContractService

server/src/routes/method-core.routes.ts
  :123  router.use(verifyToken, isAuthenticated)     ← router ma własną bramkę
  :129-136 requireOrg() — organizationId WYŁĄCZNIE z tokenu, brak → 401
  :462-507 POST /sessions/:sessionId/assessment-skip-reasons   (Idempotency-Key, 201)
  :509-526 GET  /sessions/:sessionId/assessment-skip-reasons?unitId=   (200 {skipReasons})
  :529-543 GET  /sessions/:sessionId/assessment-report-contract        (200 {reportContract})
server/src/Gateway.ts:961   app.use('/api/method', methodCoreRoutes)

# FRONT — ZERO KONSUMENTÓW (dowód: grep w §0.1 pkt 3 (c) jest PUSTY)
src/method-core/api/methodCoreApi.ts                 902 linie
  :34   const BASE = '/api/method'
  :40   class MethodCoreApiError { status, body, isNetworkError }
  :68   handle<T>() — 204→undefined, !ok→rzuca z PEŁNYM body
  :94   idempotencyHeader(key)
  :100  newIdempotencyKey()   ← crypto.randomUUID z fallbackiem
  Kanon: „This is the ONLY place in the UI layer that should build a request to
  that router" (:5-7). NIE wołasz fetch z komponentu.

src/method-core/methods/drd/drdHttpSessionRuntime.ts  510 linii
  :24-25 kolejka `pendingWrites` + `retryPending()` — WZORZEC retry, który kopiujesz
  :308  recordAnswer(...)
  :317  idemKey = `answer:${questionId}:${draft?'draft':'confirmed'}:${newIdempotencyKey()}`

# EKRAN HTTP — MIEJSCE PRZEPIĘCIA (C.1) I WEJŚCIA (B.1)
src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx
  :38   import { formatSkipJustification, type DrdSkipReasonCode }
  :558-574 handleSkip(reasonCode) — dziś JEDEN zapis: recordAnswer z justification
  :569  justification: formatSkipJustification(reasonCode)
  :856  reportContent={( … macierz + jedno zdanie na obszar … )}   ← potępione przez DEC-103

# LUSTRO — NIE DOTYKASZ
src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx
  :30, :400  ten sam dual-write przez justification
  :759  <DrdSourceIndicator source="DEMO_LOCAL" …>   ← localStorage jest jedynym magazynem

# SŁOWNIK KODÓW — CZYTASZ, NIE ZMIENIASZ
src/components/method-workspace/skipReasonCodes.ts   47 linii
  :22-26 type DrdSkipReasonCode — 4 kody
  :28-33 SKIP_REASON_LABELS — 4 etykiety PL
  :45-47 formatSkipJustification(code) → `Pominięto — ${label}.`

# EKRAN-WZORZEC (DEC-2026-08-26-125) — CZYTASZ, NIE ZMIENIASZ
src/components/Audit/method/AuditReportDocumentView.tsx   1359 linii
  :143-145 props { reportId?: string }        ← ekran SAM pobiera dane
  :549-597 load() — getReport(reportId) → payload; useEffect :599-601
  :101  ArtifactBreadcrumb        :105-107 ArtifactRightPanel + ArtifactRightPanelSection
  :108  NModeShell                :109 NModeHeaderConfig, NModeSection
  :1120-1130 sections: NModeSection[]        :1158-1212 header: NModeHeaderConfig
  :1214-1236 propertyRows: ArtifactPropertyRow[]
  :1238-1301 rightPanelSections — DOKŁADNIE 'actions' + 'properties'
  :1303-1356 kompozycja powłoki (breadcrumb → NModeShell{header,sections,rightPanel})
  :1184-1190 ★ nota: `secondaryActions` to MARTWY prop w NModeHeader.tsx — nie używasz

# ★ ZASTANY, NIEOSIĄGALNY EKRAN RAPORTU — CZYTASZ, NIE ZMIENIASZ (ERRATA poz. 11)
src/components/assessment/report/AssessmentReportView.tsx      137 linii — klucz outputId, 4 uczciwe stany
src/components/assessment/report/AssessmentReportDocument.tsx  605 linii — renderer BEZ powłoki SPEC-A
src/components/assessment/report/reportApi.ts                  129 linii — GET /outputs/:id, /sessions/:id, /sessions/:id/approvals
src/components/assessment/report/drdLabels.ts                  118 linii — ★ resolveDrdUnitLabel / resolveDrdAxisName: WOLNO WOŁAĆ
src/components/assessment/report/maturityBands.ts               53 linie
src/components/assessment/report/index.ts                        5 linii — barrel; NIE dopisujesz
  Zero importerów poza własnym katalogiem; jedyny konsument to
  dev-render/screens/assessment-output-report.tsx:24

# KONWENCJA FLAG ff_* — WZORZEC (ERRATA poz. 12)
src/utils/auditsFindingsAndReportViewFlag.ts
  :31-33 LS_KEY / QUERY_KEY / ENV_KEY        :35-42 parseFlag (1|true|on / 0|false|off)
  :44-51 readEnvFlag (import.meta.env w try/catch)
  :78-91 is…Enabled(): query ?? localStorage ?? env ?? false, całość w try/catch → false

# HARNESS — ROZBUDOWUJESZ
dev-render/screens/audyty-raport-dokument.tsx        ← ★ WZORZEC artefaktu Dokument (mountuje realny AuditReportDocumentView)
dev-render/screens/drd-http-workspace.tsx    86 linii  ← WZORZEC mountowania realnego ekranu warsztatu
dev-render/screens/assessment-output-report.tsx       ← zastany harness ekranu output-owego (NIE mylić z Twoim)
dev-render/mocks/methodCoreFakeServer.ts    766 linii  ← BRAK obu tras Assessmentu
dev-render/main.tsx                        1325 linii  ← rejestr SCREENS (:383); dopisujesz DWIE linie
dev-render/main.tsx :1240-1255                        ← przełączanie light/dark (classList + useAppStore + MutationObserver)
dev-render/vite.config.ts :17-18                      ← domyślny port 3020; W package.json NIE MA skryptu dla dev-render
dev-render/shot.mjs                                   ← zrzutownik Playwright; wypisuje KONSOLA-BLEDY / SIEC-4XX5XX

# STRAŻNICY (pre-commit) — NIE OBCHODZISZ
.husky/pre-commit:9   scripts/check-list-canon.sh
.husky/pre-commit:20  scripts/check-artefakt.sh
```

### 1.8. ★ Znane pułapki — przeczytaj, zanim zaczniesz

**Pułapka nr 1 — KOLIZJA Z DNIEM 25 (najgroźniejsza).**
Dyżur nr 25 pracuje **równolegle**, na gałęzi `codex/assessment-day25-20260826`,
z żywym kontenerem `cx-day25-pg` na porcie 5499. Jego pozycje **E.2** i **P2.2**
dotykają dokładnie tych dwóch tras, które konsumujesz. Skutki dla Ciebie:

- **P2.2 zmienia kod odpowiedzi POST skip-reasons z `201` na `200` przy
  replayu.** Twój klient traktuje **`200` i `201` identycznie** (ERRATA poz. 9).
  Test asertujący `=== 201` jest **zakazany**.
- **E.2 doda opcjonalny selektor rewizji** (`?outputId=` albo `?revision=`).
  Twój klient **nie wysyła żadnego** — kompatybilność wstecz jest po stronie
  dnia 25, ale wysłanie nieistniejącego dziś paramu wywoła nieokreślone
  zachowanie. Kod klienta ma być **przygotowany na rozszerzenie**
  (opcjonalny argument, domyślnie pominięty), ale **domyślnie go nie używa**.
- **Zero dotknięć `server/`** (Z16) — inaczej scalenie obu dyżurów się rozjedzie.
- **Zero kontenera PG** (Z9) — port 5499 należy do dnia 25.

**Pułapka nr 2 — „raport" znaczy dziś trzy różne rzeczy.**
W repo żyją **trzy** niepowiązane byty o tej nazwie:

1. **Kontrakt 7 rozdziałów** — `GET /api/method/sessions/:id/assessment-report-contract`,
   klucz = `sessionId`. **TO JEST TWÓJ.**
2. **Legacy raport DRD** — `GET /api/assessment-reports/:reportId/drd-report?format=html`,
   klucz = `reportId` (tabela `assessment_reports`). **Nie mylić, nie dotykać.**
3. **`viewMode === 'report'` w warsztacie** — zakładka, nie dokument. To jest
   **miejsce montażu** (§B.1), a nie byt danych.

**Pułapka nr 3 — kuszenie, żeby doliczyć na froncie.**
Kontrakt niesie `currentLevel`, `targetLevel`, `gap` — i **`gap` jest już
policzony przez serwer** (`:101-102`), z uczciwym `null`, gdy któregokolwiek
poziomu brakuje. **Nie przeliczasz go.** Podobnie nie liczysz „procentu
wypełnienia osi", „średniego poziomu", „ile brakuje do targetu" — **żadnej
liczby, której nie ma w DTO**. Panel `DEC-103` nazwał to wprost: „«Teresa» to
sklejony na froncie template string". Powtórzenie tego = odrzucenie pozycji.

**Pułapka nr 4 — `skipped` obszaru wygląda jak `false` i kusi, żeby „naprawić".**
Obszar z jednym pominiętym pytaniem z sześciu ma **`skipped: false` +
`skips.length === 1`** — i to jest **POPRAWNE** (FIX-2, `27fb53924c`,
rozstrzygnięcie nadzorcy z `DEC-119`). Front **nie** przerabia tego na „obszar
pominięty". Renderuje: obszar oceniany, z jednym pominiętym pytaniem i jego
kodem.

**Pułapka nr 5 — `content: null` w KAŻDYM slocie.**
Dziś kontrakt nie ma ani jednego zdania treści. Twój ekran, wyrenderowany na
realnych danych, będzie **w całości pustymi slotami**. To nie jest błąd —
**to jest produkt**. Uczciwy pusty slot z limitem („Wstęp do osi — sekcja do
uzupełnienia, limit 120–180 słów") jest deliverable'em; wypełnienie go czymkolwiek
jest naruszeniem Z14.

**Pułapka nr 6 — `esbuild` nie typuje.**
`npx esbuild --outfile=/dev/null` transpiluje i **przepuści** błąd typu. Twoim
jedynym realnym typecheckiem jest **test montujący** (Z21). Dlatego test
powstaje **razem** z komponentem, nie po nim.

**Pułapka nr 7 — pre-commit blokuje crimson w powłoce.**
`scripts/check-artefakt.sh` jest w `.husky/pre-commit:20`. `primary-*` **każdy
numer** to crimson `#85182F`. Jeżeli commit zostanie odrzucony — **naprawiasz
kolor**, nie dodajesz `--no-verify` (§0.5).

**Pułapka nr 9 — DWA EKRANY RAPORTU W JEDNYM KATALOGU (ERRATA poz. 11).**
`src/components/assessment/report/` **już zawiera** kompletny, dobrze
udokumentowany ekran raportu: `AssessmentReportView.tsx` (kontener, cztery
uczciwe stany) + `AssessmentReportDocument.tsx` (605 linii renderera). To
**INNY byt**:

|             | Zastany `AssessmentReportView`                                   | Twój `AssessmentReportContractView`            |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Klucz       | `outputId` (zamrożony Output)                                    | `sessionId`                                    |
| Źródło      | `GET /outputs/:id` + `/sessions/:id` + `/sessions/:id/approvals` | `GET /sessions/:id/assessment-report-contract` |
| Treść       | dane Outputu (poziomy, pasma dojrzałości)                        | **siedem rozdziałów z limitami słów**          |
| Powłoka     | zwykły przewijany dokument, **bez SPEC-A**                       | **powłoka SPEC-A (Menu 1 + prawy panel)**      |
| Osiągalność | **ZERO** — tylko harness `assessment-output-report`              | wejście z warsztatu za flagą (B.1)             |

**Co robisz:** budujesz swój, **nie dotykasz tamtego**, i wpisujesz
współistnienie do „Znalezisk" jako pozycję do rozstrzygnięcia nadzorcy
(„dwa ekrany raportu Assessmentu, oba niepodłączone do menu — który jest
docelowy i czy jeden ma wchłonąć drugi").
**Czego NIE robisz:** nie „ujednolicasz", nie przenosisz kodu, nie usuwasz
tamtego jako „martwego". Jest opisany, przetestowany i wskazany przez własny
harness — usunięcie go byłoby zniszczeniem cudzej pracy poza Twoim zakresem.
**Wolno Ci** wołać `drdLabels.ts` (`resolveDrdUnitLabel`, `resolveDrdAxisName`)
i `maturityBands.ts` — to czyste helpery bez stanu.

**Pułapka nr 8 — dwa źródła nazw obszarów.**
`matrix.areas[]` niesie `unitName`/`unitNamePL`; `areaComments[]` **nie**
(ERRATA poz. 6). Klient mirroru `src/services/drdStructure.ts` też je ma.
**Wybierz JEDNO źródło i wypisz wybór w raporcie** — preferowane: dane z
kontraktu (`matrix.areas`), bo pochodzą z tego samego wywołania, więc nie mogą
się rozjechać z rozdziałem.

---

## 2. MATERIAŁ WIĄŻĄCY

### 2.1. ★ KONTRAKT SERWERA — dosłownie, pole po polu

**Trasa:** `GET /api/method/sessions/:sessionId/assessment-report-contract`
**Montaż:** `server/src/Gateway.ts:961` → `server/src/routes/method-core.routes.ts:529`
**Uwierzytelnienie:** `verifyToken, isAuthenticated` (`:123`);
`organizationId` **wyłącznie z tokenu** przez `requireOrg` (`:531`) — brak → `401`.
**Parametry:** dokładnie jeden param ścieżki `sessionId`. **ZERO query paramów.**
**Sukces:** `200` z kopertą `{ reportContract: <DTO> }`.
**Błędy:** `404 { error: 'SESSION_NOT_FOUND', code: 'SESSION_NOT_FOUND' }` —
dla sesji nieistniejącej **i** dla sesji obcego tenanta (nierozróżnialne,
celowo). `401` bez kontekstu organizacji. Brak `400`, brak bramki roli
(odczyt dostępny każdemu członkowi organizacji).

**DTO — poziom najwyższy** (`assessmentReportContractService.ts:75-82`):

| Pole              | Typ                               | Linia | Uwaga                                                                  |
| ----------------- | --------------------------------- | ----- | ---------------------------------------------------------------------- |
| `contractVersion` | `'assessment-report-contract-v1'` | :76   | literał; **sprawdzasz go i przy niezgodności pokazujesz uczciwy błąd** |
| `sessionId`       | `string`                          | :77   | echo parametru                                                         |
| `outputId`        | `string \| null`                  | :78   | `null` = nie ma jeszcze zamrożonego outputu                            |
| `revision`        | `number`                          | :79   | **`0` = brak outputu**, nie „rewizja zero"                             |
| `generatedAt`     | `string` (ISO)                    | :80   | `output.frozenAt` albo `session.created_at` — **nigdy `Date.now()`**   |
| `methodVersion`   | `string`                          | :81   | wersja paczki metody                                                   |
| `chapters`        | `Chapter[]` — **zawsze 7**        | :82   | kolejność = kanoniczna kolejność `DRD_STRUCTURE`                       |

**`chapters[]`** (`:82-151`):

| Pole           | Typ                                                                     | Linia    |
| -------------- | ----------------------------------------------------------------------- | -------- |
| `axisId`       | `number` 1..7                                                           | :83      |
| `axisName`     | `string` (EN)                                                           | :84      |
| `axisNamePL`   | `string \| undefined`                                                   | :85      |
| `maxLevel`     | `number` — `axis.levelCount`, wektor **`7,5,5,7,6,6,5`**                | :86      |
| `introduction` | `{ content: null; minWords: 120; maxWords: 180 }`                       | :87      |
| `matrix`       | `{ caption: { content: null; minWords: 30; maxWords: 60 }; areas: [] }` | :88-115  |
| `areaComments` | `AreaComment[]`                                                         | :116-139 |
| `conclusion`   | `{ content: null; minWords: 180; maxWords: 260; decisionLine: {...} }`  | :140-150 |

`conclusion.decisionLine` = `{ direction: null; priority: null; horizon: null; successCondition: null }`
(`:144-149`) — cztery zawsze-nullowe pola, odpowiadające linii decyzyjnej
z `ASM-OWN-025`: `Rekomendowany kierunek | Priorytet | Horyzont | Warunek powodzenia`.

**`matrix.areas[]`** (`:95-113`):

| Pole            | Typ                                                           | Linia    |
| --------------- | ------------------------------------------------------------- | -------- |
| `unitId`        | `string` (`'1A'`…`'7E'`)                                      | :96      |
| `unitName`      | `string` (EN)                                                 | :97      |
| `unitNamePL`    | `string \| undefined`                                         | :98      |
| `currentLevel`  | `number \| null`                                              | :99      |
| `targetLevel`   | `number \| null`                                              | :100     |
| `gap`           | `number \| null` — **policzony przez serwer**                 | :101-102 |
| `skipped`       | `boolean` — **agregat**, patrz niżej                          | :103     |
| `skipCode`      | `string \| null` — **`null` gdy `skips.length !== 1`**        | :104     |
| `skips`         | `{ questionId: string; skipCode: DrdSkipReasonCode }[]`       | :105     |
| `evidenceState` | `'evidenced' \| 'incomplete' \| 'declared' \| 'not_assessed'` | :106-112 |

**`areaComments[]`** (`:119-138`):

| Pole             | Typ                                                           | Linia    |
| ---------------- | ------------------------------------------------------------- | -------- |
| `unitId`         | `string` — **jedyny identyfikator; NIE MA nazwy obszaru**     | :120     |
| `content`        | `null`                                                        | :121     |
| `minWords`       | `110`                                                         | :122     |
| `maxWords`       | `170`                                                         | :123     |
| `microstructure` | `readonly string[5]`                                          | :124     |
| `skipped`        | `boolean`                                                     | :125     |
| `skipCode`       | `string \| null`                                              | :126     |
| `skips`          | `{ questionId; skipCode }[]`                                  | :127     |
| `answerRefs`     | `string[]` — id findingu albo pusta                           | :128     |
| `evidenceRefs`   | `string[]` — id dowodów                                       | :129     |
| `sourceLocators` | `readonly string[]`                                           | :130     |
| `uncertainty`    | `'evidenced' \| 'incomplete' \| 'declared' \| 'not_assessed'` | :131-137 |

**`microstructure`** (`:10-16`) — pięć maszynowych identyfikatorów w tej
kolejności, **każdy wymaga polskiej etykiety** (DoD 9):

| id                               | Etykieta PL (wg `ASM-OWN-025`) |
| -------------------------------- | ------------------------------ |
| `stan_faktyczny`                 | Stan faktyczny                 |
| `ocena_i_wiarygodnosc`           | Ocena i wiarygodność           |
| `znaczenie_dla_przedsiebiorstwa` | Znaczenie dla przedsiębiorstwa |
| `luka_i_sens_targetu`            | Luka i sens targetu            |
| `najblizszy_krok`                | Najbliższy krok                |

**Semantyka `skipped` (agregat, `:64-65`) — cytat z kodu:**

```ts
const distinctLevelsSkipped = new Set(areaSkips.map((reason) => reason.level)).size;
const allSkipped = areaSkips.length > 0 && distinctLevelsSkipped >= axis.levelCount;
```

Czyli: obszar jest „pominięty w całości" **tylko** wtedy, gdy pominięto pytania
na **wszystkich** poziomach osi (5, 6 albo 7 — zależnie od osi). Pominięcie
częściowe = `skipped: false` + niepusta `skips[]`.

**Cztery kody słownika** (`skipReasonCodes.ts:22-33`, identyczne z serwerowym
CHECK-iem co do bajta — `DEC-119`):

| Kod maszynowy                   | Etykieta PL                   |
| ------------------------------- | ----------------------------- |
| `poza_modelem_operacyjnym`      | poza modelem operacyjnym      |
| `poza_zakresem_zlecenia`        | poza zakresem zlecenia        |
| `odroczone_do_kolejnej_rewizji` | odroczone do kolejnej rewizji |
| `zastapione_innym_rozwiazaniem` | zastąpione innym rozwiązaniem |

### 2.2. Kontrakt zapisu kodu „Pomiń" (pozycja C.1)

**Trasa:** `POST /api/method/sessions/:sessionId/assessment-skip-reasons`
(`method-core.routes.ts:462-507`)
**Nagłówek:** `Idempotency-Key` — **wymagany**; brak → `400`
(`requireIdempotencyKey`, `:468-469`). Trasa wymaga też aktora
(`requireActor`).
**Body:** `{ unitId: string, questionId: string, level: number, skipCode: DrdSkipReasonCode }`.
**★ `organizationId` NIE WCHODZI DO BODY** — obecność powoduje
`403 TENANT_CONTEXT_MISMATCH` (`:471-474`).
**Bramka:** `requireSessionWriteRole` (`:475`) — brak roli zapisu → `403`.
**Sukces:** `201 { skipReason }` **dziś**; **`200` przy replayu po scaleniu
dnia 25** (ERRATA poz. 9) — **oba są sukcesem**.
**Błędy:** `400 INVALID_SKIP_REASON_INPUT` · `400 SKIP_CODE_NOT_IN_DICTIONARY` ·
`400 INVALID_UNIT_OR_LEVEL` · `403 TENANT_CONTEXT_MISMATCH` · `403` (rola) ·
`404 SESSION_NOT_FOUND`.

**Odczyt (do wglądu, nie musisz go używać):**
`GET /api/method/sessions/:sessionId/assessment-skip-reasons?unitId=` → `200 { skipReasons }`.

### 2.3. Ekran-wzorzec — `AuditReportDocumentView` (`DEC-125`)

Czytasz go jako **wzorzec struktury**, nie kopiujesz treści. Kompozycja powłoki
(`:1303-1356`), dosłownie:

```tsx
<div className="flex h-full min-h-0 flex-col" data-testid="...">
  <ArtifactBreadcrumb items={[{ label: …, onClick: goBack }, …, { label: title }]} />
  <div className="min-h-0 flex-1">
    {sections.length === 0 ? (
      /* loading / error / EmptyState — UCZCIWE, rozróżnione */
    ) : (
      <NModeShell
        header={header}                 /* NModeHeaderConfig — :1158 */
        sections={sections}             /* NModeSection[] — nawigacja sekcji */
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        presentationMode="n"
        onPresentationModeChange={() => {}}
        showModeSwitcher={false}
        rightPanel={<ArtifactRightPanel sections={rightPanelSections} ariaLabel={…} className={ARTIFACT_PANEL_CARD_CLASS_DOCKED} />}
      />
    )}
  </div>
</div>
```

Trzy reguły wzorca, które **przenosisz**:

1. **Sekcja bez danych z backendu = sekcji NIE MA**, nigdy atrapa
   (`AuditReportDocumentView.tsx:62-65`: „Powiązania/Komentarze/Historia
   pominięte — brak danych z backendu = brak sekcji, nigdy atrapa").
2. **Eksport = wyszarzony wiersz „Planowane"** w sekcji Akcje, nie przycisk
   (`:74-77`).
3. **`secondaryActions` w `NModeHeaderConfig` to MARTWY prop** (`:1185`) —
   dodatkowe akcje idą do kebaba (`extraOverflowItems`), nie do paska.

### 2.4. Kanon SPEC-A — co jest wiążące dla powłoki

Źródło: `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`.

- **§13.2, wiersz „Assessment Report"**: archetyp **B — DOKUMENT**, ikona
  `file-check`, otwiera się **pełną powierzchnią**, Menu 1 primary = **„Generuj ▸"**.
  **★ W TYM DYŻURZE primary jest WYSZARZONY z notatką „Planowane"** — generowania
  nie ma (Z14), więc działający przycisk byłby atrapą (Z22). Wpisz ten wybór do
  raportu.
- **§11.2** — prawy panel `ArtifactRightPanel`, sekcje accordion w **stałej
  kolejności**: `Akcje` · `Właściwości` · `Powiązania` · `Komentarze` ·
  `Historia/AI`. **Renderujesz tylko te, dla których masz dane** (§2.3 reguła 1):
  realnie **Akcje** + **Właściwości**.
- **§11.2 Menu 1** — back/breadcrumb · ikona-typ · tytuł · status-lifecycle
  **jako pigułka z TEKSTEM** (nie naga kropka) · wskaźnik zapisu **osobno** od
  lifecycle · jeden primary. **Crimson w statusie ZAKAZANY.**
- **§11.2, delta archetypu B**: centrum = `max-w 760` wyśrodkowane, tło
  `c.surface`, padding 32.
- **§18.1 DoD artefaktu** — czerwone MUST, w tym: pełny cykl `Tab`/`Shift+Tab`
  bez pułapki fokusa, `Esc` zamyka najbardziej lokalną warstwę, fokus WIDOCZNY
  (`ring-c.focus`, **nigdy** `primary-*`), light+dark, zero surowych enumów.

Przy pracy nad tym ekranem **użyj skilla `consultify-artefakty`** (kanon
pojedynczego ekranu-artefaktu). Do list **nie sięgasz** — to nie jest ekran listowy.

---

## §A. EKRAN RAPORTU OCENY — pozycje A.1–A.4

### A.1 — Flaga `ff_assessmentReportView` i jej czytnik

**Produkt:** `src/utils/assessmentReportViewFlag.ts` — **nowy plik**, wzorem
**dosłownym** `src/utils/auditsFindingsAndReportViewFlag.ts` (przeczytaj go
w całości przed napisaniem swojego). **★ NIE hook** — patrz ERRATA poz. 12.

**Wymagania — wszystkie siedem:**

1. **Trzy klucze**, wyeksportowane jako `ASSESSMENT_REPORT_VIEW_FLAG_KEYS`:
   ```
   localStorage : 'ff.assessment_report_view'
   query        : 'ff_assessmentReportView'
   env          : 'VITE_ASSESSMENT_REPORT_VIEW'
   ```
2. **Eksporty:** `isAssessmentReportViewEnabled(): boolean` oraz
   `resetAssessmentReportViewFlagCache(): void` (cache modułowy — bez niego
   testy będą się przeciekać między sobą).
3. **★ FAIL-CLOSED — i to jest sedno pozycji.** Rozstrzyganie:
   **query > localStorage > env > `false`**, dosłownie
   `const resolved = fromQuery ?? fromLs ?? fromEnv ?? false;`, **cały łańcuch
   w `try/catch`, którego gałąź błędu zwraca `false`**. Parser akceptuje
   `1|true|on` i `0|false|off`. Odczyt `import.meta.env` **zawsze** w osobnym
   `try/catch` (środowisko testowe potrafi go nie mieć).
4. **Flaga musi być REALNIE odczytywana, nie fantomem** (CLAUDE.md, złota
   reguła 1 — w repo są flagi z zerem kodu). Komponent woła
   `isAssessmentReportViewEnabled()` i przy `false` **zwraca `null` PRZED
   jakimkolwiek wywołaniem sieciowym**. Nie „renderuje pusty div", nie
   „renderuje i chowa CSS-em" — **`null` i zero żądań**.
5. **Nagłówek pliku po polsku**, opisujący: co flaga włącza, że jest domyślnie
   OFF, i że zostaje OFF **do czasu akceptu właściciela na zrzutach**
   (CLAUDE.md reguła 7). Wzór treści: `auditsFindingsAndReportViewFlag.ts:14-18`.
6. **Test OFF jest częścią tej pozycji, nie pozycji E.1**: montujesz ekran
   z flagą OFF, asertujesz `container` pusty **oraz** że funkcja klienta z A.2
   **nie została wywołana ani razu** (`vi.spyOn`). Wołasz
   `resetAssessmentReportViewFlagCache()` w `beforeEach`.
7. Zero innych flag (Z10). **Nie dopisujesz nic do `DEFAULT_FLAGS`
   w `FeatureFlagsContext.tsx`** — to inny rejestr i inny plik (Z19-podobnie:
   `src/contexts/**` jest poza zakresem).

**DoD A.1:** plik `src/utils/assessmentReportViewFlag.ts` istnieje · domyślnie
`false` · `try/catch` kończy się `false` · komponent zwraca `null` przed
żądaniem · test OFF zielony (render + zero wywołań klienta) · dowód osiągalności
(kto woła funkcję, plik:linia).

### A.2 — Klient HTTP kontraktu + typ DTO

**Produkt:** dwie rzeczy w `src/method-core/api/methodCoreApi.ts`, **wyłącznie
addytywnie** (zero zmian w istniejących funkcjach).

**Wymagania — wszystkie siedem:**

1. **Typ DTO spisany ręcznie, 1:1 z tabelą §2.1.** Serwer **nie eksportuje
   żadnego interfejsu ani schematu zod** dla tego kontraktu (zweryfikowane —
   `build()` nie ma adnotacji typu zwracanego). Nazwy pól **muszą** się zgadzać
   co do znaku. Typ nazywasz `AssessmentReportContract` + typy pomocnicze
   (`AssessmentReportChapter`, `AssessmentReportArea`, `AssessmentReportAreaComment`).
   **Wszystkie pola `readonly`** — zgodnie z konwencją pliku (`:113` i dalej).
2. **Funkcja czytająca:**
   ```ts
   export async function getAssessmentReportContract(
     sessionId: string
   ): Promise<AssessmentReportContract>;
   ```
   Implementacja **kopiuje wzorzec `listPacks()`** (`:121-126`): `handle<{ reportContract: … }>`
   - `fetchWithRetry(`${BASE}/sessions/${sessionId}/assessment-report-contract`, { method: 'GET', headers: getHeaders() })`,
     zwraca `res.reportContract`.
3. **★ ZERO query paramów** (ERRATA poz. 1). Sygnatura **może** przyjąć
   opcjonalny drugi argument przygotowany pod dzień 25
   (`options?: { readonly outputId?: string }`), ale **domyślnie nie dokłada
   żadnego paramu do URL-a**, a w komentarzu ma jawnie stać, że selektor
   powstaje w dyżurze 25 i front go dziś **nie używa**.
4. **Walidacja `contractVersion`.** Po odebraniu odpowiedzi sprawdzasz
   `contractVersion === 'assessment-report-contract-v1'`. Niezgodność →
   rzucasz `MethodCoreApiError` z jasnym komunikatem. **Nigdy nie renderujesz
   nieznanej wersji kontraktu, udając, że rozumiesz** (Z22).
5. **Błędy przechodzą bez tłumaczenia.** `handle()` już rzuca
   `MethodCoreApiError` z pełnym body — nie łapiesz i nie zamieniasz na `null`.
   Rozróżnienie `404` (sesja nie istnieje / obcy tenant) vs `401` (brak
   kontekstu organizacji) vs `isOfflineError` (`:64`) robi **komponent**, nie klient.
6. **Zero `fetch` w komponencie.** Kanon pliku (`:5-7`): to jedyne miejsce, które
   buduje żądanie do `/api/method`.
7. **Nie ruszasz istniejących funkcji ani `handle`/`getHeaders`/`fetchWithRetry`.**

**DoD A.2:** typ 1:1 z §2.1 (parytet udowodniony tabelą E.2) · funkcja
addytywna · zero query paramów · walidacja `contractVersion` z testem ·
`git diff` na `methodCoreApi.ts` pokazuje **wyłącznie dodania**.

### A.3 — Ekran raportu: artefakt Dokument, siedem rozdziałów, uczciwe sloty

**Produkt:** `src/components/assessment/report/AssessmentReportContractView.tsx`
(+ nowe pliki pomocnicze w tym samym katalogu).

**★ NAZWA JEST CELOWA.** Katalog już zawiera `AssessmentReportView.tsx` i
`AssessmentReportDocument.tsx` — **inny byt** (klucz `outputId`, czyta Output,
nie kontrakt; ERRATA poz. 11). Nazwa `…ContractView` mówi wprost, co ten ekran
konsumuje. **Siedmiu zastanych plików nie zmieniasz**; `drdLabels.ts` wolno
WOŁAĆ (`resolveDrdUnitLabel`, `resolveDrdAxisName`) do rozwiązania nazw
obszarów/osi. Do `index.ts` **nie dopisujesz** — importujesz ścieżką wprost
(zmiana barrela to zmiana zastanego pliku).

**Props:** `{ readonly sessionId: string; readonly className?: string }` —
ekran **sam pobiera** dane (wzór `AuditReportDocumentView`, który bierze
`reportId?: string` i ładuje payload w `useEffect`). **Żadnego przekazywania
kontraktu z góry** — to jest samodzielny artefakt (B.1 pkt 3).

**Powłoka — wg §2.3 i §2.4, bez wynalazków:**

- `ArtifactBreadcrumb` → `Ocena` · `<nazwa sesji>` · `Raport`.
- `NModeShell` z `header: NModeHeaderConfig`:
  - ikona typu `file-check` (§13.2),
  - tytuł = nazwa dokumentu raportu,
  - **status-lifecycle jako pigułka z TEKSTEM**: `revision === 0` → „Szkic"
    (ton `draft`); `revision > 0` → „Rewizja N" (ton `neutral` albo `approved`
    zgodnie z mapą §11.2). **Crimson zakazany.**
  - **primary = „Generuj ▸" WYSZARZONY, tooltip/notatka „Planowane"** (§2.4).
  - **żadnego wskaźnika zapisu** — ekran jest tylko-do-odczytu, więc kontrolka
    zapisu byłaby atrapą (Z22). Wpisz ten wybór do raportu.
- `sections: NModeSection[]` = **siedem sekcji**, po jednej na rozdział,
  etykieta = `axisNamePL ?? axisName`, w **kanonicznej kolejności z kontraktu**
  (nie sortujesz, nie przestawiasz).
- `rightPanel: <ArtifactRightPanel sections={…} className={ARTIFACT_PANEL_CARD_CLASS_DOCKED} ariaLabel={…} />`
  — **dokładnie dwie sekcje**, z **id ze stałej `ARTIFACT_PANEL_SECTION_ORDER`**
  (`ArtifactRightPanel.tsx:41-49` — ERRATA poz. 13; **test kolejności czyta tę
  stałą**, więc własne id oblałyby go):
  - **`id: 'actions'`, `defaultOpen: true`** — „Eksportuj PDF" i „Eksportuj
    wszystko" jako **wyszarzone wiersze z notatką „Planowane"** (Z22,
    `ASM-OWN-026` poza zakresem);
  - **`id: 'properties'`, `defaultOpen: true`** — treść przez
    `<ArtifactPropertiesTable rows={…} />` (typ `ArtifactPropertyRow`,
    `src/components/standard/ArtifactPropertiesTable.tsx`), wiersze: `revision` ·
    `outputId` (albo „brak zamrożonego wyniku", gdy `null`) · `generatedAt`
    (sformatowana data PL) · `methodVersion` · `contractVersion` · `sessionId`.
    **Zero surowych UUID-ów bez etykiety.**
  - `relations` / `evidence` / `results` / `comments` / `history` — **nie
    renderujesz** (brak danych = brak sekcji, §2.3 reguła 1).

**Centrum rozdziału — kolejność sekcji jest KONTRAKTEM WŁAŚCICIELA
(`ASM-OWN-025`, `DEC` §1.5 poz. 14), nie zmieniasz jej:**

1. **Wstęp do osi** — slot `introduction`. `content === null` → uczciwy pusty
   stan: nagłówek „Wstęp do osi" + zdanie **„Sekcja do uzupełnienia — limit
   120–180 słów."** Limity **czytasz z DTO** (`minWords`/`maxWords`), **nie
   zaszywasz liczb w JSX**.
2. **Macierz osi + podpis** — tabela obszarów z `matrix.areas[]`:
   `unitId` · nazwa PL · `currentLevel` · `targetLevel` · `gap` · `evidenceState`
   (etykieta PL!) · znacznik pominięć (§A.4). **`null` renderujesz jako „—"
   z tooltipem/etykietą „nie oceniono"**, nigdy jako `0`.
   Pod tabelą slot `matrix.caption` — uczciwy pusty stan z limitem 30–60 słów.
   **★ Macierz nie musi być `LiveMatrix`** — to instrument warsztatu, nie
   element dokumentu. Jeżeli użyjesz `LiveMatrix`, **nie zmieniasz jej kodu**
   (Z19-podobne ograniczenie: to komponent cudzy). Prostsza, czytelna tabela
   dokumentowa jest **preferowana** i musi być czytelna bez koloru
   (`ASM-CHAPTER-AC-005`: „accessible non-color status encoding").
3. **Komentarz per obszar** — po jednym bloku na każdy wpis `areaComments[]`
   (**9 dla osi 1, 5 dla pozostałych** — ERRATA poz. 3). Każdy blok:
   - nagłówek: `unitId` + **nazwa PL** (join po `unitId` — ERRATA poz. 6, §1.8
     pułapka 8);
   - **pięć podsekcji mikrostruktury** z etykietami PL z tabeli §2.1, każda
     z uczciwym pustym stanem;
   - limit słów z `minWords`/`maxWords` (110–170) — pokazany raz na blok;
   - **`uncertainty` jako etykieta PL**, nigdy `not_assessed` (DoD 9);
   - **traceability**: `answerRefs` / `evidenceRefs` / `sourceLocators` —
     jeżeli **niepuste**, renderujesz je jako policzalne odwołania
     („Odpowiedzi: 1 · Dowody: 3"), rozwijalne. Jeżeli **puste** — sekcji nie
     ma (§2.3 reguła 1). **Nie wymyślasz linków do bytów, których nie umiesz
     rozwiązać** — surowe id **nie idzie na twarz** (DoD 9); jeżeli nie masz
     czym go rozwiązać, pokazujesz **liczbę**, nie identyfikator.
   - pominięcia — §A.4.
4. **Wnioski osi** — slot `conclusion`, uczciwy pusty stan z limitem 180–260 słów,
   **plus linia decyzyjna** jako cztery nazwane pola z `decisionLine`:
   „Rekomendowany kierunek" · „Priorytet" · „Horyzont" · „Warunek powodzenia" —
   wszystkie dziś `null`, więc wszystkie **uczciwie puste**, w jednym rzędzie
   lub liście definicyjnej.

**Stany ekranu — wszystkie CZTERY, rozróżnione (§2.3 wzorzec):**

- **loading** — `LoadingState`, nie pusty ekran;
- **error** — `ErrorState` z **rozróżnieniem**: `404` → „Sesja nie istnieje lub
  nie masz do niej dostępu"; `401` → „Brak kontekstu organizacji"; offline
  (`isOfflineError`) → „Brak połączenia" + „Ponów"; nieznana wersja kontraktu
  (A.2 pkt 4) → osobny komunikat;
- **empty** — kontrakt przyszedł, ale `chapters.length === 0` (nie powinno się
  zdarzyć — serwer zawsze daje 7): `EmptyState` mówiący prawdę, nie „ładowanie";
- **gotowy** — siedem rozdziałów, w całości pustych slotów (pułapka nr 5).

**Zakazy w tej pozycji:** zero LLM (Z14) · zero liczb wyliczanych na froncie
(pułapka nr 3) · zero surowych enumów (DoD 9) · zero crimsonu dekoracyjnego
(DoD 7) · zero zmian w `src/components/standard/**` i `shared/**` (Z19) ·
zero polskich/angielskich literałów w JSX (DoD 8).

**DoD A.3:** siedem rozdziałów w kolejności z DTO · cztery rodzaje slotów z
limitami czytanymi z DTO · cztery stany rozróżnione · powłoka SPEC-A wg §2.3 ·
prawy panel = Akcje + Właściwości · i18n PL+EN w gałęzi `assessment.reportView.*`
· zrzuty light+dark (D.2) · ≥4 testy zachowania (E.1) · dowód osiągalności.

### A.4 — Pominięcia: per pytanie i agregat obszaru, po polsku

**To osobna pozycja, bo to jest miejsce, w którym łatwo skłamać.**

**Wymagania — wszystkie pięć:**

1. **Źródłem prawdy jest `skips[]`, nie `skipCode`** (ERRATA poz. 5).
   Renderujesz **listę**: `questionId` + **etykieta PL kodu** ze
   `SKIP_REASON_LABELS`. Nigdy kod maszynowy na twarzy (DoD 9).
2. **`skipped === true`** (agregat — wszystkie poziomy osi pominięte) →
   obszar dostaje jawny znacznik **„Obszar pominięty w całości"** wraz z liczbą
   pominiętych pytań i listą kodów.
3. **`skipped === false` + `skips.length > 0`** (pominięcie częściowe) →
   **„Obszar oceniany · pominięto N z M pytań"**, gdzie `M` bierzesz z
   `chapter.maxLevel`. **Nie nazywasz tego obszaru pominiętym** (pułapka nr 4).
4. **`skips.length === 0`** → **żadnego znacznika**. Brak pominięć nie jest
   informacją do pokazania.
5. **`skipCode` traktujesz wyłącznie jako skrót wsteczny.** Jeżeli
   `skips.length === 1`, `skipCode` niesie ten sam kod — **nie renderujesz go
   drugi raz**. Przy `skips.length > 1` `skipCode` jest `null` i **to jest
   poprawne**, nie brak danych.

**Dwa miejsca renderowania:** znacznik pominięcia pojawia się **w wierszu
macierzy** (`matrix.areas[].skips`) **i** **w bloku komentarza obszaru**
(`areaComments[].skips`). Kontrakt daje te same dane w obu miejscach — **nie
liczysz ich raz i nie przekazujesz w dół po cichu**; czytasz z tego pola, które
renderujesz.

**DoD A.4:** trzy warianty (całość / częściowo / brak) rozróżnione i pokryte
testami · etykiety PL · zero kodów maszynowych na twarzy · zrzut scenariusza
„pominięcia" (D.2).

---

## §B. WEJŚCIE DO EKRANU — pozycja B.1

### B.1 — Montaż z modułu Oceny, za flagą

**Kanoniczne miejsce ustalone grepem (ERRATA poz. 10), nie wymyślone:**
`MethodWorkspaceShell` ma prop `reportContent: React.ReactNode`
(`src/components/method-workspace/MethodWorkspaceShell.tsx:69`, `:128`),
renderowany pod `viewMode === 'report'` (`:444`, kontener
`data-testid="method-report-workspace"`). Jedynym producentem tego propa na
ekranie HTTP jest `DrdHttpMethodWorkspaceScreen.tsx:856`.

**Wymagania — wszystkie pięć:**

1. **Zmieniasz WYŁĄCZNIE `DrdHttpMethodWorkspaceScreen.tsx`.**
   `MethodWorkspaceShell.tsx` **czytasz**, nie zmieniasz (Z17 — zmiana = STOP).
2. **Rozgałęzienie na flagę, fail-closed:**
   - `enabled === false` → `reportContent` pozostaje **bit w bit tym, czym jest
     dziś** (`:856-899`). Zero regresji, zero „przy okazji poprawiłem".
   - `enabled === true` → `reportContent` = `<AssessmentReportContractView sessionId={…} />`.
3. **★ Ekran raportu nie może zależeć od `runtime`/`events` warsztatu.** Bierze
   `sessionId` i czyta **własnym** wywołaniem z A.2. Powód: to samodzielny
   artefakt-dokument, który ma sens także poza warsztatem, i nie wolno mu
   dziedziczyć stanu lokalnego (`DEC-103` zarzut nr 3: „stary edytor liczący
   current=max").
4. **Lazy import** komponentu raportu (`React.lazy` + `Suspense`), żeby przy
   fladze OFF nie ciągnąć go do bundla ekranu warsztatu.
5. **★ NIE dotykasz `DrdMethodWorkspaceScreen.tsx`** (lustro przeglądarkowe) —
   Z17/§1.4 poz. 4. Lustro zostaje na zastanej treści.

**DoD B.1:** dowód osiągalności (`viewMode='report'` → `reportContent` → flaga →
komponent, plik:linia) · test „flaga OFF → renderuje się treść zastana" · test
„flaga ON → renderuje się nowy ekran" · zrzut obu wariantów (D.2) ·
`git diff` na `MethodWorkspaceShell.tsx` **pusty**.

---

## §C. PRZEPIĘCIE ZAPISU KODU „POMIŃ" — pozycja C.1

### C.1 — Osobny POST kodu maszynowego, TYLKO na ekranie HTTP

**Podstawa:** `DEC-2026-08-26-119` / `DEC-2026-08-26-122`, cytat dosłowny:

> „KOORDYNACJA FRONTU (przepięcie zapisu kodu Pomiń): możliwa TYLKO na ekranie
> HTTP (lustro przeglądarkowe dostanie 404), jako osobny zapis po `recordAnswer`
> z `Idempotency-Key` i retry (dual-write z `justification` do czasu decyzji
> o jednym źródle)."

**Miejsce:** `DrdHttpMethodWorkspaceScreen.tsx:559-575`, funkcja
`handleSkip(reasonCode)`, podpięta jako `onSkip` w `:825`. Dziś robi **jeden**
zapis — `recordAnswer` z `justification: formatSkipJustification(reasonCode)`
(`:569`), który schodzi do `POST /api/method/sessions/:id/events`
(`drdHttpSessionRuntime.ts:308-322` → `methodCoreApi.ts` `appendEvent`).

**Wymagania — wszystkie osiem:**

1. **★ DUAL-WRITE DOPIERO POWSTAJE — dziś go NIE MA** (ERRATA poz. 14).
   Kod maszynowy nie jest dziś wysyłany nigdzie. Twoja zmiana **dokłada** drugi
   zapis; `recordAnswer` z `justification` **zostaje nietknięty**.
   `DEC-2026-08-26-119` mówi „dual-write z `justification` **do czasu decyzji
   o jednym źródle**" — decyzja nie zapadła. Usunięcie `justification` albo
   zamiana go na kod = **STOP**, nie optymalizacja.
2. **Kolejność: NAJPIERW `recordAnswer`, POTEM POST kodu.** Odpowiedź na pytanie
   jest zdarzeniem jądra; kod „Pomiń" jest metadaną warstwy Assessmentu.
   Odwrócenie kolejności zapisałoby kod dla odpowiedzi, której nie ma.
3. **Osobne wywołanie przez klienta z §2.2**, dodane addytywnie do
   `methodCoreApi.ts`:
   ```ts
   export async function recordAssessmentSkipReason(
     sessionId: string,
     input: {
       readonly unitId: string;
       readonly questionId: string;
       readonly level: number;
       readonly skipCode: DrdSkipReasonCode;
     },
     idempotencyKey: string
   ): Promise<{ readonly skipReason: unknown }>;
   ```
   **`organizationId` NIE trafia do body** — obecność = `403 TENANT_CONTEXT_MISMATCH`
   (§2.2). To jest Twój odpowiednik „negatywu tenanta" i **wymaga testu**.
4. **`Idempotency-Key` deterministyczny dla danej decyzji, stały przy retry.**
   Wzorzec z runtime'u (`drdHttpSessionRuntime.ts:317`):
   ```
   skip-code:<sessionId>:<unitId>:<questionId>:<level>:<newIdempotencyKey()>
   ```
   Klucz generujesz **raz, przed pierwszą próbą**, i **ten sam** przekazujesz
   przy każdej ponownej próbie. Wygenerowanie nowego klucza przy retry = utrata
   idempotencji (komentarz `methodCoreApi.ts:97-99` mówi to wprost:
   „Callers that retry a FAILED request … should reuse the SAME key on retry").
5. **★ Traktujesz `200` i `201` identycznie jako sukces** (ERRATA poz. 9,
   pułapka nr 1). Test asertujący `=== 201` jest **zakazany**.
6. **Retry — świadomy, policzony, nie „na wszelki wypadek".**
   **★ Najpierw przeczytaj ERRATĘ poz. 15:** `fetchWithRetry`
   (`src/services/api/baseClient.ts:87-161`) **już ponawia raz** po 1500 ms
   przy sieciowym `TypeError`, **z tymi samymi nagłówkami** — więc
   `Idempotency-Key` jest tam reużyty automatycznie. Twoja warstwa **dokłada
   się** do tamtej, nie zastępuje jej.
   - Ponawiasz **wyłącznie** przy `isOfflineError(err)` (`methodCoreApi.ts:64`)
     i przy `5xx`.
   - **Nie ponawiasz** przy `400`/`403`/`404` — to błędy trwałe, ponowienie ich
     to pętla.
   - **Maksymalnie JEDNA własna ponowna próba** (łącznie z automatyczną daje
     do trzech żądań). Większa liczba wymaga uzasadnienia w raporcie.
   - **W raporcie podajesz realną liczbę żądań w najgorszym przypadku** i skąd
     się bierze.
   - Wzorzec kolejki masz w `drdHttpSessionRuntime.ts:448-472` (`retryPending`)
     i `siriHttpSessionRuntime.ts:482-485` — **czytasz je, nie zmieniasz**
     (zmiana runtime'u = STOP). **Dedykowanego helpera retry w repo nie ma** —
     nie tworzysz współdzielonego; trzymasz logikę lokalnie przy `handleSkip`.
7. **★ Niepowodzenie POST-a NIE MOŻE cofnąć ani zablokować `recordAnswer`.**
   Odpowiedź już się zapisała. Nieudany zapis kodu:
   - **nie rzuca w górę** (użytkownik nie może utknąć na pytaniu),
   - **nie jest przemilczany** (Z22 — sukces bez skutku jest zakazany):
     zostawia **widoczny, uczciwy ślad** — komunikat w interfejsie
     („Kod pominięcia nie został zapisany — spróbuj ponownie") **albo** wpis
     w istniejącym wskaźniku stanu zapisu ekranu. **Wybierz jedno, opisz wybór
     w raporcie.** Cicha porażka = odrzucenie pozycji.
8. **★ ZERO dotknięć `DrdMethodWorkspaceScreen.tsx`** (lustro — dostanie 404).
   Lustrem jest **`DrdMethodWorkspaceScreenLegacy`** (`:197`, implementacja na
   `localStorage`), wybierane przez bramkę `DrdMethodWorkspaceScreen` (`:897-908`,
   `isEnabled('drdHttpSourceOfTruthV1')` domyślnie `false`). Jego `handleSkip`
   (`:390-408`, `justification` w `:400`) **zostaje bez zmian**.
   `git diff` na tym pliku **musi być pusty**. To jest warunek odbioru pozycji.
   **Uwaga:** komponentu `DrdBrowserMethodWorkspaceScreen` **nie ma w repo** —
   nie szukaj go, lustro mieszka w pliku wyżej.

**Testy tej pozycji (minimum pięć, na realnym komponencie — Z21):**

- (a) **happy**: `handleSkip('poza_zakresem_zlecenia')` → `recordAnswer` wywołany
  **raz** z `justification: 'Pominięto — poza zakresem zlecenia.'` **oraz** POST
  wywołany **raz** z `skipCode: 'poza_zakresem_zlecenia'` i nagłówkiem
  `Idempotency-Key`;
- (b) **kolejność**: POST następuje **po** `recordAnswer` (asercja na kolejności
  wywołań, nie na samym fakcie);
- (c) **replay `200`**: serwer odpowiada `200` → traktowane jako sukces, zero
  komunikatu o błędzie;
- (d) **retry**: pierwszy strzał = błąd sieciowy, drugi = `201` → **ten sam
  `Idempotency-Key`** w obu żądaniach, zero podwójnego `recordAnswer`;
- (e) **trwały błąd**: `403` → **zero ponowień**, widoczny uczciwy ślad,
  `recordAnswer` **nie jest cofany**, nawigacja do następnego obszaru działa;
- (f) **brak `organizationId` w body** — asercja na kształcie wysłanego body.

**DoD C.1:** dual-write zachowany · kolejność udowodniona testem · klucz stały
przy retry · `200`/`201` równoważne · brak ponowień na 4xx · uczciwy ślad
porażki · **`git diff` na lustrze pusty** · ≥5 testów zielonych · dowód
osiągalności (przycisk „Pomiń" → `handleSkip` → klient → trasa).

---

## §D. HARNESS I ZRZUTY — pozycje D.1–D.2

### D.1 — Ekran harnessu `dev-render` + brakujące trasy atrapy

**Harness w repo (`dev-render/`):**

```
dev-render/
   vite.config.ts        standalone Vite; uruchamiasz Z KATALOGU GŁÓWNEGO repo
   main.tsx              rejestr ekranów (SCREENS) + parametry URL — 1325 linii
   screens/              ekrany-montaże z mockami
   mocks/                dane mock + atrapy serwera
   shot.mjs              zrzutownik Playwright (bez MCP)
```

Parametry URL: `?screen=<klucz>&lang=pl|en&theme=light|dark`.

**Dwa wzorce, oba czytasz przed napisaniem swojego:**

- **`dev-render/screens/audyty-raport-dokument.tsx`** — **wzorzec artefaktu
  Dokument**: mountuje **REALNY** `AuditReportDocumentView` wprost z propem
  (bez `BrowserRouter`, bo komponent bierze props, nie `useParams`), stubuje
  klienta API, **wymusza flagę przez `localStorage`** (`:67`), obsługuje
  warianty przez query. **To jest Twój najbliższy sąsiad.**
- **`dev-render/screens/drd-http-workspace.tsx`** (86 linii) — mountuje
  **REALNY** `DrdHttpMethodWorkspaceScreen` przeciwko atrapie `/api/method/**`
  w pamięci (`installMethodCoreFakeServer`) — realne kształty żądań
  i odpowiedzi, zero backendu, zero logowania. **Tego używasz do obejrzenia
  pozycji C.1.**

**★ NIE mylić z `dev-render/screens/assessment-output-report.tsx`** — to
zastany harness ekranu **output-owego** (pułapka nr 9). Twój ekran ma inną
nazwę i inne dane.

**Produkt — trzy rzeczy:**

1. **`dev-render/screens/assessment-report-contract.tsx`** — nowy ekran,
   mountujący **REALNY** `AssessmentReportContractView`. **Wymuś flagę przez
   `localStorage['ff.assessment_report_view'] = '1'` przed mountem** (wzór:
   `audyty-raport-dokument.tsx:67`) — inaczej fail-closed z A.1 zwróci `null`
   i zobaczysz pustą stronę. Parametry URL:
   ```
   ?scenario=pelny|sloty|pominiecia|blad
     pelny       — kontrakt z findingami: poziomy, targety, gap, evidenceState
     sloty       — kontrakt „świeży": wszystko content:null, outputId:null, revision:0
     pominiecia  — obszar pominięty w CAŁOŚCI (7B, 5/5 poziomów) + obszar
                   pominięty CZĘŚCIOWO z DWOMA różnymi kodami (7A) → skipCode:null
     blad        — trasa zwraca 404 SESSION_NOT_FOUND
   &axis=1..7    — który rozdział jest aktywny (domyślnie 1 — ★ oś 1 ma DZIEWIĘĆ obszarów)
   ```
   **Dane mock są PL (klient «Metalpol»)**, realistyczne, bez gwiazdek i ozdób.
   **Zero zapisów gdziekolwiek** (Z9).
2. **Dwie brakujące trasy w `dev-render/mocks/methodCoreFakeServer.ts`**,
   **wyłącznie addytywnie** (dziś ich nie ma — potwierdzone grepem §0.1 pkt 3 (g)):
   - `GET /sessions/:id/assessment-report-contract` → `200 { reportContract }`
     w kształcie **1:1 z §2.1** (to jest test parytetu w praktyce);
   - `POST /sessions/:id/assessment-skip-reasons` → `201 { skipReason }`,
     **plus wariant `200` przy powtórzeniu tego samego `Idempotency-Key`**
     (żeby scenariusz replayu z C.1 dało się obejrzeć **przed** scaleniem
     dnia 25), plus wariant `403` na żądanie scenariusza.
     Wzorzec dopasowania ścieżki masz w tym pliku (`:471` `sessionMatch`,
     `:484` gałęzie `rest === '/events'` itd.).
3. **Dwie linie w `dev-render/main.tsx`**: lazy import + wpis w rejestrze
   `SCREENS`. **Nic więcej w tym pliku.**

**Uruchomienie (z KATALOGU GŁÓWNEGO repo, żeby PostCSS/Tailwind się rozwiązały):**

```bash
npx vite --config dev-render/vite.config.ts --port 3362
```

**★ Uwaga o porcie:** `dev-render/vite.config.ts:18` mówi 3020, nagłówek
`dev-render/shot.mjs` mówi 3350. **Obie ignorujesz** i uruchamiasz jawnie na
**3362** (Z7), przekazując ten port w URL do `shot.mjs`. Rozbieżność wpisz do
„Znalezisk", **nie naprawiaj**.

**DoD D.1:** ekran harnessu mountuje REALNY komponent (nie kopię) · cztery
scenariusze działają · atrapa serwera zwraca kształt 1:1 z §2.1 · `main.tsx`
zmieniony o dokładnie dwie linie.

### D.2 — Zrzuty, i **własne oględziny przed oddaniem**

**Zrzut:**

```bash
node dev-render/shot.mjs <plik.png> \
  "http://localhost:3362/?screen=assessment-report-contract&lang=pl&theme=light&scenario=pelny&axis=1" \
  --w=1440 --h=900
```

`shot.mjs` **zawsze** wypisuje na stdout `KONSOLA-BLEDY` i `SIEC-4XX5XX` —
**oba wklejasz do raportu przy KAŻDYM zrzucie. Zrzut z błędem konsoli nie jest
dowodem.**

**Obowiązkowe zrzuty — 8 plików, do
`docs/program/waves/WAVE_03_ACCEPTANCE/evidence/assessment-report-front-20260826/`:**

| Plik                                        | Scenariusz                                             |
| ------------------------------------------- | ------------------------------------------------------ |
| `ASM-REPORT-01-pelny_{LIGHT,DARK}.png`      | rozdział z liczbami (oś 1, dziewięć obszarów)          |
| `ASM-REPORT-02-sloty_{LIGHT,DARK}.png`      | wszystkie sloty puste, `revision: 0` — **stan realny** |
| `ASM-REPORT-03-pominiecia_{LIGHT,DARK}.png` | całościowe + częściowe z dwoma kodami                  |
| `ASM-REPORT-04-panel_{LIGHT,DARK}.png`      | prawy panel rozwinięty (Akcje + Właściwości)           |

Dodatkowo **dwa zrzuty dowodu OFF** (`ASM-REPORT-00-off_{LIGHT,DARK}.png`) —
zakładka Raport warsztatu przy fladze OFF, żeby udowodnić brak regresji.
**★ Uruchamiaj każdy zrzut w świeżym kontekście przeglądarki** — `localStorage`
z nadpisaniem flagi **wycieka** między zrzutami.

**★ WŁASNE OGLĘDZINY — to jest wymóg, nie sugestia (CLAUDE.md reguła 7,
`DEC-125` jako precedens).**

Po zrobieniu zrzutów **otwierasz każdy z nich i patrzysz**. Szukasz — minimum:

1. surowego enumu na twarzy (`not_assessed`, `poza_modelem_operacyjnym`,
   `stan_faktyczny`) — **to jest błąd, który złapał robotnik w `DEC-125`;
   złap go u siebie**;
2. surowego UUID bez etykiety;
3. `null` wyrenderowanego jako `0`, `NaN`, `undefined` albo puste miejsce bez
   podpisu;
4. crimsonu tam, gdzie nie ma semantyki krytycznej;
5. tekstu nieczytelnego w dark (kontrast);
6. rozjechanego layoutu przy **dziewięciu** obszarach osi 1;
7. angielskiego napisu przy `lang=pl` (brak klucza i18n);
8. slotu pustego bez informacji o limicie słów.

**W raporcie wypisujesz listę defektów, które SAM znalazłeś i naprawiłeś, z
oznaczeniem którego zrzutu dotyczyły.** Pusta lista przy pierwszej wersji
ekranu jest **podejrzana** i nadzorca ją zakwestionuje.

**DoD D.2:** 10 zrzutów (8 + 2 OFF) · `KONSOLA-BLEDY`/`SIEC-4XX5XX` przy każdym ·
zero błędów konsoli w oddawanej wersji · lista własnych znalezisk i napraw.

---

## §E. TESTY I PARYTET — pozycje E.1–E.2

### E.1 — Testy punktowe

Runner: **vitest + testing-library**, `environment: 'jsdom'`,
`setupFiles: './tests/setup.ts'` (**Z18 — nie dotykasz**).

**Lokalizacja nowych testów:** `src/components/assessment/report/__tests__/`
oraz **nowe** pliki w `src/components/assessment/drd/__tests__/`.
**Istniejących testów nie osłabiasz** — w szczególności
`DrdMethodWorkspaceScreen.skipAndResolution.test.tsx:47` asertuje etykiety
słownika (`SKIP_REASON_OPTIONS`) i **musi zostać zielony**.

**Minimum, per pozycja:**

| Pozycja | Testy                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A.1     | flaga OFF → `null` **i zero wywołań klienta**; flaga ON → render                                                                                                        |
| A.2     | happy (rozpakowanie koperty `{reportContract}`); `404` → `MethodCoreApiError` ze `status:404`; nieznany `contractVersion` → rzuca; **zero query paramów w URL-u**       |
| A.3     | siedem rozdziałów w kolejności `axisId` 1..7; pusty slot pokazuje limit z DTO; `currentLevel: null` → „—", nie `0`; cztery stany rozróżnione; `evidenceState` po polsku |
| A.4     | pominięcie całościowe; częściowe z **dwoma** kodami (`skipCode: null`, `skips.length === 2`); brak pominięć → brak znacznika                                            |
| B.1     | OFF → treść zastana (`data-testid="method-report-workspace"` zawiera stary układ); ON → nowy ekran                                                                      |
| C.1     | sześć testów z §C.1                                                                                                                                                     |

**Zakazy:** żadnego testu grepującego źródło (Z21) · żadnej zmiany globalnych
mocków (Z18) · żadnego testu dotykającego bazy (Z9) · **żadnej asercji
`status === 201`** (ERRATA poz. 9).

### E.2 — Tabela parytetu kontraktu serwer↔front

**Produkt: tabela w raporcie**, nie plik kodu. Jeden wiersz na **każde** pole
z §2.1 (poziom najwyższy + rozdział + obszar + komentarz obszaru — razem
ok. 40 wierszy):

| Pole DTO | Typ | Gdzie renderowane (plik:linia) | Etykieta PL | Uwaga / powód pominięcia |
| -------- | --- | ------------------------------ | ----------- | ------------------------ |

**Pole bez wpisu = naruszenie DoD 4.** Pole świadomie pominięte (np.
`axisName` EN, bo pokazujemy `axisNamePL`) **musi mieć powód**. Pole
renderowane, którego **nie ma** w kontrakcie — to jest **defekt** (pułapka
nr 3), wpisujesz go jako błąd i usuwasz.

Do tej samej sekcji dołączasz **listę oczekiwań wobec serwera** (§1.6): czego
brakowało, do czego byłoby potrzebne, i dlaczego **nie** dopisałeś tego sam.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~50 min, NIE pomijasz)

1. `git fetch --all --prune`; weryfikacja markera wg §0.1 pkt 1-2.
2. Wszystkie komendy weryfikacyjne §0.1 pkt 3 (a)–(g) i pkt 4 — wyniki **do
   raportu**, rozbieżności do „Korekt wobec instrukcji".
3. Gałąź + worktree + symlink `node_modules` (§0.1 pkt 5).
4. **Pomiar ZASTANY** wg §0.4a pkt 3 — **PRZED pierwszym commitem**. Bez tego
   nie odróżnisz czerwonych zastanych od wprowadzonych (Z23).
5. Przeczytaj **w całości**, zanim napiszesz pierwszą linię kodu:
   - `server/src/services/assessment/assessmentReportContractService.ts` (156) — **kontrakt**;
   - `src/components/method-workspace/skipReasonCodes.ts` (47) — słownik;
   - `src/utils/auditsFindingsAndReportViewFlag.ts` — **wzorzec flagi `ff_*`**;
   - `src/components/assessment/report/AssessmentReportView.tsx` (137) —
     **★ zastany, INNY ekran raportu**: cztery uczciwe stany do skopiowania
     jako wzorzec, plik do NIETKNIĘCIA (ERRATA poz. 11, pułapka nr 9);
   - `src/components/assessment/report/reportApi.ts` (129) — pokazuje, jak
     poprzednik uczciwie udokumentował **nieistnienie** trasy zamiast ją założyć;
   - `dev-render/screens/audyty-raport-dokument.tsx` — wzorzec harnessu artefaktu;
   - `dev-render/screens/drd-http-workspace.tsx` (86) — harness ekranu HTTP;
   - **kompozycję powłoki** `AuditReportDocumentView.tsx:1120-1359`;
   - `src/components/standard/ArtifactRightPanel.tsx:38-141` — kanon sekcji.
6. Uruchom skill **`consultify-artefakty`** (kanon ekranu-artefaktu) — to jest
   wymóg CLAUDE.md dla każdej pracy nad artefaktem.

### Blok 1 — fundament bez wyglądu (A.1 → A.2)

Flaga i klient. Tanie, pewne, testowalne bez renderowania czegokolwiek.
Po tym bloku masz **typ DTO**, który jest umową dla całej reszty.

### Blok 2 — harness PRZED ekranem (D.1)

**★ Kolejność jest celowa.** Budujesz atrapę serwera i ekran harnessu **zanim**
napiszesz komponent — wtedy pierwszy render widzisz od razu, a atrapa wymusza,
żeby typ z A.2 był zgodny z rzeczywistym kształtem (§2.1). Odwrotna kolejność
kończy się komponentem, którego nie da się obejrzeć.

### Blok 3 — ekran (A.3 → A.4)

Powłoka → rozdziały → sloty → pominięcia. Po **każdym** kroku: zrzut light,
oględziny, naprawa. **Nie budujesz całości na ślepo.**

### Blok 4 — wejście (B.1)

Montaż za flagą + dowód OFF (zrzuty `ASM-REPORT-00-off_*`).

### Blok 5 — przepięcie skip-code (C.1)

Osobna, ryzykowna pozycja — robisz ją **po** ekranie, żeby ewentualny STOP nie
zablokował głównego produktu dyżuru.

### Blok 6 — dowody i domknięcie (D.2 → E.1 → E.2 → R.1, ~90 min)

1. Komplet 10 zrzutów, **własne oględziny**, naprawy, ponowne zrzuty.
2. Domknięcie testów, **pomiar §0.4a po raz drugi** (na `HEAD`).
3. Tabela parytetu E.2.
4. Raport R.1 wg szablonu §9.1.
5. `git log --oneline codex/m03-admin-20260824..HEAD` — sprawdzasz, że masz
   **commit per pozycja**.
6. **Sprawdzasz, że `git diff` na `DrdMethodWorkspaceScreen.tsx`,
   `MethodWorkspaceShell.tsx`, `src/components/standard/**`,
   `src/components/shared/**` i **całym `server/`** jest PUSTY.** To jest
   ostatnia bramka przed oddaniem.

### Zasada nadrzędna kolejności

Jeżeli zabraknie czasu — **oddajesz mniej pozycji, ale KOMPLETNYCH z dowodami**.
Pozycja bez zrzutu i bez testu jest `CZĘŚCIOWA`, nie `ZROBIONA`. Dyżur, który
dowozi A.1–A.4 + B.1 z pełnym DoD i uczciwie zgłasza C.1 jako `NIE_ZACZĘTE`,
jest **lepszy** niż dyżur z sześcioma pozycjami bez dowodów.

---

## 9. RAPORT — jedyny dokument, który tworzysz

`docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_REPORT_FRONT_DAY27_REPORT_20260826.md`

### 9.1. Szablon

```markdown
# Assessment dzień 27 (front raportu + skip-code) — raport dyżuru <data>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<jedno zdanie: nie dotknąłem /Users/piotrwisniewski/Developer/Consultify poza symlinkiem node_modules>

## ★ Oświadczenie o zakresie server/ (★ ograniczenie krytyczne, Z16)

git diff --name-only codex/m03-admin-20260824...HEAD -- server/
<wynik MUSI być pusty — wklej dosłownie>

## ★ Oświadczenie o lustrze i powłokach (Z17/Z19)

git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx src/components/method-workspace/MethodWorkspaceShell.tsx src/components/standard src/components/shared
<wynik MUSI być pusty — wklej dosłownie>

## Marker: 6d3cebe779 — POTWIERDZONY / BRAK

<wynik obu komend z §0.1 pkt 1; przy rozejściu: git log --oneline marker..tip + lista plików>

## ★ WERYFIKACJA ERRATY §1.2 — piętnaście punktów

<per punkt: POTWIERDZONY / ROZBIEŻNOŚĆ + dowód>

## ★ Oświadczenie o zastanym katalogu raportu (ERRATA poz. 11)

git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/assessment/report/AssessmentReportView.tsx src/components/assessment/report/AssessmentReportDocument.tsx src/components/assessment/report/reportApi.ts src/components/assessment/report/types.ts src/components/assessment/report/drdLabels.ts src/components/assessment/report/maturityBands.ts src/components/assessment/report/index.ts
<wynik MUSI być pusty — wklej dosłownie>

## Warunki wstępne — tabela

<wyniki wszystkich komend §0.1 pkt 3 (a)-(g) i pkt 4, dosłownie>

## Pozycje — tabela zbiorcza

| Poz. | Status | Commit SHA | Dowód osiągalności | Dowód testowy | Zrzut |

## ★ A.2 — TYP DTO

### Różnice wobec §2.1 (jeśli są) + dowód

### Dowód, że URL nie niesie query paramów

## ★ A.3/A.4 — EKRAN

### Mapa: slot kontraktu → element ekranu → etykieta PL

### Cztery stany (loading/error/empty/gotowy) — jak rozróżnione

### Decyzje o pominięciu sekcji prawego panelu + powody

### Wybór źródła nazw obszarów (ERRATA poz. 6) + uzasadnienie

## ★ B.1 — WEJŚCIE

### Ścieżka montażu (plik:linia, pełny łańcuch)

### Dowód braku regresji przy fladze OFF

## ★ C.1 — PRZEPIĘCIE SKIP-CODE

### Kolejność wywołań (dowód testowy)

### Schemat klucza Idempotency-Key + dowód stałości przy retry

### Polityka retry: co ponawiane, co nie, ile razy

### ★ Realna liczba żądań w najgorszym przypadku (z automatycznym retry fetchWithRetry) + skąd się bierze

### Jak wygląda uczciwy ślad porażki (wybór + uzasadnienie)

### Dowód, że body NIE niesie organizationId

### Dowód, że lustro (DrdMethodWorkspaceScreen.tsx) jest NIETKNIĘTE

## ★ D.2 — ZRZUTY I WŁASNE OGLĘDZINY

### Tabela: plik zrzutu → scenariusz → KONSOLA-BLEDY → SIEC-4XX5XX

### ★ Defekty, które SAM znalazłem na własnych zrzutach i naprawiłem

| # | Zrzut | Defekt | Naprawa | Commit |

## ★ E.2 — TABELA PARYTETU KONTRAKTU

| Pole DTO | Typ | Gdzie renderowane | Etykieta PL | Uwaga/powód pominięcia |

### Lista oczekiwań wobec serwera (czego brakuje, do czego, dlaczego NIE dopisałem sam)

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem)

### Czerwone WPROWADZONE przez dyżur

### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 5)

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

## ★ Dowód FAIL-CLOSED (A.1)

<test OFF: zero renderu I zero żądań — wynik dosłowny>

## ★ Dowód braku atrapy (Z22)

<lista kontrolek, które NIE powstały, i dlaczego: eksport PDF, Eksportuj wszystko, Generuj>

## ★ i18n

<liczba nowych kluczy PL / EN w gałęzi assessment.reportView.* — MUSZĄ być równe>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## Znaleziska (NIE naprawiane przeze mnie)

<OBOWIĄZKOWO co najmniej:

1.  ★ DWA EKRANY RAPORTU ASSESSMENTU — zastany AssessmentReportView (klucz outputId,
    nieosiągalny w aplikacji) obok nowego AssessmentReportContractView (klucz sessionId).
    Który jest docelowy? Czy jeden ma wchłonąć drugi? — do rozstrzygnięcia nadzorcy.
2.  rozbieżność portów dev-render (vite.config.ts 3020 vs shot.mjs 3350);
3.  nieaktualny komentarz „34 areas total" w drdStructure.ts (jest 39);
4.  martwy prop NModeHeaderConfig.secondaryActions;
5.  brak skryptu npm dla dev-render i dla kontroli esbuild-per-plik;
6.  globalny rozjazd parytetu i18n PL/EN (~890 kluczy) — POZA Twoją gałęzią>

## Korekty wobec instrukcji

## Migracje

ŻADNE — dyżur frontowy, Z16/Z9 zabraniają.

## Flagi

ff_assessmentReportView — UTWORZONA, defaultValue: false, NIE WŁĄCZONA.
Flagi zastane (drdMethodWorkspaceSliceV1, methodWorkspaceShellV1,
drdHttpSourceOfTruthV1) — NIETKNIĘTE, dalej OFF.

## Licznik (11 pozycji: domknięte / częściowe / STOP / BRAK_API / niezaczęte)

## Czego NIE zrobiłem i dlaczego

## Gotowość

Gotowe do odbioru przez NADZORCĘ (nie do pokazania właścicielowi).
```

### 9.2. Zasady raportowania

1. **Nie piszesz „działa" bez dowodu.** Dowód = komenda + wynik, plik:linia,
   zrzut. „Testy przeszły" ≠ „działa" (CLAUDE.md, złota reguła 1).
2. **Nie piszesz „gotowe do pokazania Piotrowi".** Piszesz „gotowe do odbioru
   przez nadzorcę".
3. **Status pozycji jest jednym z:** `ZROBIONE_WG_DoD` · `CZĘŚCIOWE` ·
   `STOP` · `BRAK_API` · `BRAK_W_KONTRAKCIE` · `NIE_ZACZĘTE`.
   **`ZROBIONE_WG_DoD` wymaga wszystkich dwunastu punktów §0.4.**
4. **Rozbieżność wobec instrukcji zawsze idzie do „Korekt"**, nigdy do
   milczącej improwizacji.
5. **Zawyżenie jest gorsze niż brak.** Uczciwe `CZĘŚCIOWE` z opisem luki jest
   przyjmowane; `ZROBIONE` bez zrzutu jest odrzucane w całości.

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM (w repo NIE MA skryptu `format`)
npx prettier --write <pliki-tego-commita>

# typy punktowo (esbuild TRANSPILUJE, nie typuje — nie złapie błędu typu!)
npx esbuild src/components/assessment/report/AssessmentReportContractView.tsx --loader:.tsx=tsx --outfile=/dev/null

# test celowany (BEZ bazy — Z9)
npx vitest run src/components/assessment/report --reporter=verbose

# harness — Z KATALOGU GŁÓWNEGO repo
npx vite --config dev-render/vite.config.ts --port 3362

# zrzut (świeży kontekst per zrzut — localStorage wycieka)
node dev-render/shot.mjs evidence.png "http://localhost:3362/?screen=assessment-report-contract&lang=pl&theme=dark&scenario=sloty" --w=1440 --h=900

# ★ grep osiągalności — ZAWSZE po CAŁYM repo, nigdy tylko po src/ (Z20)
grep -rn "AssessmentReportContractView" src/ dev-render/ tests/ server/ scripts/ docs/

# nowe pliki w tests/ wymagają -f
git add -f tests/<...>

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD

# ★ OSTATNIA BRAMKA przed oddaniem — wszystkie MUSZĄ być puste
git diff --name-only codex/m03-admin-20260824...HEAD -- server/
git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx
git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/standard src/components/shared
git diff --name-only codex/m03-admin-20260824...HEAD -- src/components/method-workspace/MethodWorkspaceShell.tsx
```

### 10.2. Piętnaście rzeczy, które najłatwiej zepsuć

1. **Dotknięcie `server/`** — dzień 25 tam pracuje. Odrzucenie dyżuru (Z16).
2. **Dotknięcie lustra `DrdMethodWorkspaceScreen.tsx`** — dostanie 404 (`DEC-119`).
3. **Asercja `status === 201`** — dzień 25 zmienia to na `200` przy replayu.
4. **Zmiana `src/components/standard/**` albo `shared/**`** — kasuje cudze odbiory (Z19).
5. **Wypełnienie `content` czymkolwiek** — `content: null` to kontrakt, nie brak (Z14).
6. **Wyliczenie liczby, której nie ma w DTO** — dokładnie to potępił `DEC-103`.
7. **Uznanie obszaru z jednym pominięciem za pominięty** — `skipped: false` jest poprawne.
8. **Surowy enum na twarzy** — `not_assessed`, `poza_modelem_operacyjnym` (DoD 9).
9. **Nowy klucz `Idempotency-Key` przy retry** — traci idempotencję.
10. **`primary-*` jako kolor CTA/statusu** — to crimson; pre-commit blokuje.
11. **Klucze i18n w `assessment.report.*`** — gałąź jest ZAJĘTA przez legacy.
12. **Zrzut z błędem konsoli podany jako dowód** — nie jest dowodem.
13. **Zmiana któregokolwiek z siedmiu zastanych plików w
    `src/components/assessment/report/`** — to inny, opisany byt (ERRATA poz. 11).
14. **Flaga jako hook `useXFlag`** — `ff_*` to `src/utils/<nazwa>Flag.ts` (ERRATA poz. 12).
15. **Własne id sekcji prawego panelu** — muszą pochodzić
    z `ARTIFACT_PANEL_SECTION_ORDER`; test kolejności czyta tę stałą (ERRATA poz. 13).

### 10.3. Czego NIE robisz, choć „aż się prosi"

- **Nie dopisujesz brakującego pola do kontraktu** — STOP, nie serwer (§0 pkt 3).
- **Nie stawiasz kontenera PG** — ten dyżur nie potrzebuje bazy (Z9).
- **Nie włączasz flagi „żeby zobaczyć"** — od tego jest harness (CLAUDE.md reguła 7).
- **Nie usuwasz `justification` z `handleSkip`** — dual-write zostaje do odwołania.
- **Nie budujesz eksportu PDF** — osobny tor, „Planowane" (§1.4 poz. 2).
- **Nie podnosisz `MODULE_ACCEPTANCE.md`** — robi to nadzorca po zrzutach (Z12).
- **Nie naprawiasz czerwonych zastanych** — opisujesz je (§0.4a pkt 4).
- **Nie obchodzisz pre-commit `--no-verify`** — naprawiasz kod.

---

## 11. NA KONIEC

Ten dyżur odpowiada na **pierwszy z trzech zarzutów** najgorszej oceny w całym
programie: **„deliverable nie istnieje"**. Mechanika tylna jest gotowa i
dowiedziona (11/11 testów realnego routera, `DEC-122`). Kontrakt siedmiu
rozdziałów stoi od dnia 20 i **nie ma ani jednego konsumenta**.

Twoim produktem jest ten konsument — i **uczciwość tego, co pokazuje**.
Ekran, który wyrenderuje siedem rozdziałów samych pustych slotów z jasną
informacją, czego brakuje i w jakim limicie, jest **sukcesem dyżuru**. Ekran,
który te sloty czymkolwiek zapełni, jest **powtórzeniem defektu, który dostał
4,0/10**.

Trzy zdania, które muszą być prawdziwe na koniec:

1. **Nie dotknąłem `server/`** — dzień 25 pracuje tam równolegle.
2. **Sam obejrzałem każdy zrzut i naprawiłem to, co na nim zobaczyłem** — Piotr
   nie jest pierwszym testerem wizualnym.
3. **Nie pokazałem ani jednej liczby i ani jednego zdania, których nie dał mi
   serwer.**

Powodzenia.
