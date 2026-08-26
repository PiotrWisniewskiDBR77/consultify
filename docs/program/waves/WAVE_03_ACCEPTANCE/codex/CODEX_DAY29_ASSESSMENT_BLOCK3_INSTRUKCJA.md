# INSTRUKCJA DYŻURU nr 29 — Codex — „Assessment/Ocena BLOK 3 (SERWEROWY): powrót do B.2 (`@ts-nocheck`, 203 błędy typów), uczciwa semantyka tras AI (200→404), koordynowana czystka A.2b + F.1 z cudzymi testami, czytelna nazwa sesji w kontrakcie raportu"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–28. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-27.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **trzecim blokiem modułu Ocena/Assessment po stronie serwera**
i jest bezpośrednią kontynuacją bloku 2 (dyżur nr 25), scalonego decyzją
`DEC-2026-08-27-137` i **skorygowanego** decyzją `DEC-2026-08-27-138`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`,
wiersze 188–189).

**★★ PRZECZYTAJ TO ZDANIE DWA RAZY: `DEC-138` JEST KOREKTĄ, KTÓRA OBALIŁA CZĘŚĆ
TEZ `DEC-137`.** Dzień 25 miał **dwa niezależne odbiory** i dały różne wyniki.
Nadzorca zweryfikował je osobiście i rozstrzygnął na korzyść drugiego. Gdziekolwiek
w repo, w raporcie dnia 25 albo w instrukcji dnia 25 znajdziesz twierdzenie
sprzeczne z §1.2 tego dokumentu — **wiążące jest §1.2**, bo §1.2 jest zmierzone
grep-em i kompilatorem, a nie przepisane z cudzego raportu. Trzy tezy, których
**NIE WOLNO Ci powielić**, bo są udowodnione jako fałszywe:

1. „`access-requests` są w `PUBLIC_DEMO_WRITE_ALLOWLIST`" — **NIE SĄ.**
   Allowlista ma dokładnie cztery wpisy i żaden nie dotyczy Assessmentu.
2. „STOP na B.2 był zasadny, bo harness nie spełnił negatywu tenanta" —
   **NIE BYŁ.** Uczciwy powód brzmiał „wyczerpany budżet". **B.2 wraca do
   wykonania i jest pozycją nr 1 tego dyżuru.**
3. „Trasy AI Assessment mają wyciek międzytenantowy" — **NIE MAJĄ.** To jest
   defekt **KONTRAKTU/UX**, nie bezpieczeństwa. Nie pisz w raporcie słowa
   „wyciek". Powód jest w §1.2 poz. 5.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYŁĄCZNIE mechanikę tylną modułu Ocena. Front jest poza zakresem
w całości — nie tylko „raczej nie", ale co do jednego znaku.**

1. **★★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest wręcz wymagane — BLOK 0 pkt 8), ale **nie
   zmieniasz w nim ani jednego znaku** — także „jednej linii importu", także po
   to, żeby „tylko pokazać nowy kod błędu", także po to, żeby „domknąć ostatnie
   ogniwo Z20". Jedyny wyjątek: **żaden**.
2. **★★ POWÓD JEST TWARDY I ORGANIZACYJNY, NIE ESTETYCZNY.** Równolegle
   z Tobą żyje **niescalona** gałąź frontowa `codex/assessment-report-front-day27-20260827`
   (dyżur nr 27, ekran raportu 7 rozdziałów + przepięcie zapisu kodu „Pomiń").
   Dotknęła ona m.in. `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`,
   `src/components/assessment/report/**`, `src/method-core/api/methodCoreApi.ts`,
   `src/utils/assessmentReportViewFlag.ts`, `public/locales/{pl,en}/translation.json`,
   `dev-render/**`. **Każdy Twój znak w `src/` to konflikt scalenia u nadzorcy
   przy odbiorze cudzego dyżuru.** Twój zakres jest z nią **rozłączny plikowo**
   i ma taki zostać.
3. **★ NIE BUDUJESZ GENEROWANIA TREŚCI MODELEM. ZERO LLM.** Pozycja §A dotyka
   pliku, w którym mieszka klient Gemini. **Poprawiasz w nim TYPY, nie
   okablowanie.** Nie wpinasz klucza API, nie zmieniasz `initializeAI()`,
   nie wołasz `llmService`, nie ustawiasz `GOOGLE_AI_API_KEY` ani `GEMINI_API_KEY`
   w żadnym środowisku — również „na chwilę, żeby sprawdzić". Silnik AI to
   osobny moduł, ostatni w programie (`DEC-51`).
4. **★ TEN DYŻUR MA CZTERY POZYCJE ROBOCZE I JEDNĄ DOKUMENTACYJNĄ (§1.3).**
   Wszystko, co Ci „po drodze" przyjdzie do głowy — dopisanie brakujących tras,
   podpięcie panelu AI do frontu, naprawa `routes/index.ts`, walidacja skali
   celu (**już zrobiona**, `DEC-2026-08-27-139`), otwieranie modułu — jest
   **POZA ZAKRESEM** (§1.4) i idzie do „Znalezisk", nie do kodu.
5. **★ DWIE Z CZTERECH POZYCJI SĄ „ODEJMOWANIEM", NIE „DODAWANIEM".** §A zdejmuje
   `@ts-nocheck` bez zmiany zachowania. §C usuwa martwy kod. Zachowanie produktu
   zmieniają tylko §B (wąsko, wyliczone co do handlera) i §D (**jedno nowe pole,
   wyłącznie addytywnie**). Jeżeli łapiesz się na pisaniu nowego serwisu —
   zatrzymaj się i przeczytaj §1.4.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: «MARKER_SHA»**

   > **Uwaga dla nadzorcy wydającego zlecenie:** placeholder `«MARKER_SHA»`
   > wiążesz PRZED wydaniem instrukcji Codexowi — wpisujesz w to miejsce tip
   > gałęzi `codex/m03-admin-20260824` z chwili wydania i commitujesz zmianę
   > osobnym commitem `docs(codex): bind day29 base marker <sha>`. Codex, który
   > widzi w tym miejscu nadal `«MARKER_SHA»`, **wykonuje STOP całego dyżuru**
   > i nie zgaduje bazy.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

3. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, **`codex/assessment-day20-*`**, **`codex/assessment-day25-*`**,
   **`codex/assessment-report-front-day27-*`**, `codex/assessment-fixes-*`,
   `codex/meetings-*`, `codex/mgmtreports-*` ani z żadnej gałęzi dni 17–28.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline «MARKER_SHA»..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. Rebase
   w trakcie dyżuru: **ZAKAZANY**.

4. **★★ SPRAWDZENIE KOLIZJI Z SĄSIEDNIMI DYŻURAMI — warunek wstępny, nie
   formalność.** W chwili wystawienia stan jest następujący i **masz go
   potwierdzić sam**:

   ```bash
   # (a) DZIEŃ 25 (Assessment blok 2) — MA BYĆ SCALONY. Bez tego nie ma czego kontynuować.
   git merge-base --is-ancestor codex/assessment-day25-20260826 codex/m03-admin-20260824 \
     && echo "DAY25 MERGED" || echo "DAY25 NOT MERGED"
   # oczekiwane w chwili wystawienia: DAY25 MERGED

   # (b) DZIEŃ 27 (front raportu) — MA BYĆ NIESCALONY i ma Cię NIE dotyczyć
   git merge-base --is-ancestor codex/assessment-report-front-day27-20260827 codex/m03-admin-20260824 \
     && echo "DAY27 MERGED" || echo "DAY27 NOT MERGED"
   # oczekiwane w chwili wystawienia: DAY27 NOT MERGED
   git diff --name-only codex/m03-admin-20260824...codex/assessment-report-front-day27-20260827
   # oczekiwane: WYŁĄCZNIE src/**, dev-render/**, public/locales/**, docs/** — ZERO server/**

   # (c) DZIEŃ 28 (Meetings blok 4) — niescalony, inny moduł
   git diff --name-only codex/m03-admin-20260824...codex/meetings-day28-20260827
   # oczekiwane: server/src/routes/meeting.routes.ts + tests/integration/routes/meeting.* + docs/**
   ```

   **Rozstrzygnięcia, których masz się trzymać:**

   | Warunek                                                          | Co robisz                                                                                                                                                                                                                                                                                                                                                                                         |
   | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `DAY25 MERGED` (oczekiwane)                                      | Pracujesz normalnie. Cały dorobek dnia 25 (usunięte 4 handlery ról, harness AI, kontrakt raportu, skip-reasons) jest już w Twojej bazie.                                                                                                                                                                                                                                                          |
   | `DAY25 NOT MERGED`                                               | **STOP CAŁEGO DYŻURU.** Nie odtwarzasz dnia 25 własnymi siłami, nie cherry-pickujesz, nie startujesz z jego gałęzi. Wpisujesz pozycję STOP z wynikiem komendy i kończysz. Powód: §A i §C stoją **fizycznie na plikach zmienionych przez dzień 25** (harness `assessmentAiPartner.day25.pg.test.ts`, blok ról v1) — bez nich Twoja praca jest nieodtwarzalna i nie da się jej zmierzyć „przed/po". |
   | `DAY27 NOT MERGED` (oczekiwane)                                  | Nic nie robisz. Twój zakres jest z nim rozłączny plikowo, **pod warunkiem że nie wchodzisz w `src/`** (★ ograniczenie krytyczne pkt 1–2). To jest jedyny mechanizm bezkolizyjności, jaki masz — i on jest w 100% pod Twoją kontrolą.                                                                                                                                                              |
   | `DAY27 MERGED`                                                   | Nadal nic nie robisz i nadal **nie wchodzisz w `src/`**. Zapisujesz fakt w „Korektach wobec instrukcji".                                                                                                                                                                                                                                                                                          |
   | `git diff` dnia 27 pokazuje **cokolwiek** w `server/**`          | **STOP przed rozpoczęciem §B.** Wypisz listę plików do raportu i czekaj na rozstrzygnięcie nadzorcy — mogłoby to oznaczać, że ktoś dotknął tras AI przed Tobą.                                                                                                                                                                                                                                    |
   | Twój `git diff --name-only «MARKER_SHA»...HEAD` zawiera `src/**` | **Naruszenie ★ ograniczenia krytycznego = odrzucenie dyżuru.** Sprawdź to sam przed ostatnim commitem.                                                                                                                                                                                                                                                                                            |

5. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu. **Każda z tych komend
   ma w §1.2/§1.7 podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", nie do improwizacji:**

   ```bash
   # (a) sedno §A — plik partnera AI
   grep -c "" server/src/services/aiAssessmentPartnerService.ts        # oczekiwane: 1439
   head -1 server/src/services/aiAssessmentPartnerService.ts           # oczekiwane: // @ts-nocheck

   # (b) sedno §B — trasy AI
   grep -cE "^router\.(get|post|patch|put|delete)\(" server/src/routes/assessment/assessment-ai.routes.ts   # oczekiwane: 26
   grep -c "getAssessmentData(" server/src/routes/assessment/assessment-ai.routes.ts                        # oczekiwane: 12 (1 definicja + 11 wywołań)
   grep -c "org-default" server/src/routes/assessment/assessment-ai.routes.ts                               # oczekiwane: 12

   # (c) sedno §C.1 — blok wniosków o dostęp w routerze v1
   grep -cE "^\s*router\.(get|post|patch|put|delete)\(" server/src/routes/assessment/assessment-workflow.routes.ts   # oczekiwane: 27
   grep -c "access-requests" server/src/routes/assessment/assessment-workflow.routes.ts                              # oczekiwane: >= 4

   # (d) ★ OBALENIE FAŁSZYWEJ TEZY DNIA 25 — allowlista NIE zna Assessmentu
   grep -c -i "assessment" server/src/services/demo/demoPrincipalGuard.ts    # oczekiwane: 0 (ZERO)

   # (e) sedno §C.2 — nieosiągalny plik
   grep -c "" server/src/routes/assessment/assessments.routes.ts             # oczekiwane: 497
   grep -cE "^\s*router\.(get|post|patch|put|delete)\(" server/src/routes/assessment/assessments.routes.ts # oczekiwane: 11

   # (f) rejestr decyzji
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane: >= 192
   grep -c "DEC-2026-08-27-138" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1

   # (g) raport dnia 25 istnieje i jest zamkniętym dowodem (NIE edytujesz go)
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY25_REPORT_20260826.md   # w chwili wystawienia: 140
   ```

6. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/assessment-day29-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-assessment-day29 codex/assessment-day29-<data>
   cd /private/tmp/consultify-assessment-day29
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

7. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.3, §0.4a i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                             | Dlaczego                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/assessment-day29-<data>`                                                                                                                                                                                             | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                   |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/assessment-*`, `codex/meetings-*`, `codex/mgmtreports-*`, `codex/chat-*`, `codex/tools-*`                                                                                                                                                         | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku                                          |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                              | Krach 3/4 powstał tak; `DEC-95`                                                                                     |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                 | Wymagania są w rejestrze uwag i decyzjach                                                                           |
| **Z5**  | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                         | Chroniony, brudny worktree właściciela — praca własna Piotra                                                        |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyją **64**, w tym `consultify-assessment-day25`, `consultify-assessment-day27`, `consultify-meetings-day28`, `consultify-day29-instrukcja`                                                                                                                                | Cudze worktree, część w aktywnym użyciu                                                                             |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ m.in.: 3026, 5000, 5037, **5432**, **5474**, **5507**, 6379, 7000, 7679, 7768, 8080, 11434. **Twój kontener PG = 5511.** Zakazane wprost, nawet gdy akurat wolne: **5499** (dzień 25), **5474** (Tools), **5498** (mgmtreports). Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | Cudze dyżury pracują równolegle; 5499/5474/5498 bywają wskrzeszane przez odbiorców                                  |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                              | Produkcja/demo poza zakresem                                                                                        |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                                    | „dane demo = twarz produktu" (`DEC-65`)                                                                             |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy w szczególności `drdHttpSourceOfTruthV1`, `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `ff_assessmentReportView`, `DEMO_ORG_ID`, `enableStubRoutes`                                                            | CLAUDE.md reguła 9; flagi frontowe są w `src/` = poza zakresem                                                      |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/assessment/*`. **Nie dodajesz nowej trasy HTTP** — ten dyżur nie ma ani jednego nowego endpointu. **Nie zmieniasz montaży w `server/src/Gateway.ts`** poza tym, co jawnie dopuszcza §C                                        | Gramatyka zaakceptowana (`DEC-2026-08-24-07`); nowa trasa = nowa powierzchnia do odbioru                            |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY29_REPORT_20260827.md`. Jedyny inny dokument, który wolno zmienić, to `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportów dni 20/25/27 NIE edytujesz**                                        | Repo tonie w dokumentach-duchach; tamte raporty są zamkniętymi dowodami odbiorowymi                                 |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Jeżeli uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze                                                                                                                                                                        | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                          |
| **Z14** | **★ Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** W §A poprawiasz **TYPY**, nie okablowanie Gemini. Zero `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY` w jakimkolwiek środowisku, zero zmian w `initializeAI()`, `injectAIClient()`, zero nowych wywołań `llmService`, zero `/api/ai/**`                                                         | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`. Dodatkowo: klucz w środowisku zmieniłby wynik testów       |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `failed`.** Uczciwie pusta ocena (istnieje, ale bez odpowiedzi) **ma dalej zwracać 200 z pustką** — §B odróżnia „nie istnieje" od „istnieje i jest pusta", a nie zamienia jednego w drugie                                                                                                   | Uczciwy pusty stan > udawany wynik; i > fałszywy 404                                                                |
| **Z16** | **★★ NIETYKALNE: `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/services/v8/artifactRegistryService.ts`, `server/src/services/methodCore/**`(jądro zdarzeń),`server/src/routes/method-core.routes.ts`.** Wolno **czytać** i **wołać\*\*    | Model uprawnień i jądro Method Core naprawiane in-house; jądro jest współdzielone z Audits/SIRI                     |
| **Z17** | **★ Zakaz wszystkiego poza wskazanym zakresem** — z imiennymi licencjami z ramki poniżej. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy, cudze moduły: **NIE**                                                                                                                                                                     | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                                      |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**               | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                            |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — PIĘĆ zmiennych, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia** i **liczba SKIPPED**                   | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`); dzień 19 mierzył bez `MOCK_DB=false` |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą                                                                                                                                                                                                                                                         | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach                                   |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). **W tym dyżurze to jest lekcja pozycji §A**: `injectAIClient()` istnieje w pliku, który typujesz, i **NIE jest dowodem niczego**                                                                                                                                      | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`                      |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — **sukces + skutek na zewnątrz przy braku zmiany w bazie = ODRZUCENIE pozycji**. W tym dyżurze dochodzi wariant odwrotny i równie zakazany: **odpowiedź `200` z wygenerowaną treścią dla obiektu, którego nie ma w bazie** — to jest sedno §B                                                   | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL`, nie zmieniwszy nic w bazie                                        |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **Podanie zawężonego wyboru = naruszenie**                                                                                                                                                              | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji                                       |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★★ Z19 — PIĘĆ zmiennych w tej samej linii, i dlaczego to nie jest biurokracja.**

- `server/src/database/Database.ts` — `process.env.MOCK_DB === 'true'` podstawia
  **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts` — globalny mock `auth.middleware.js`: przy **braku** nagłówka
  `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true` i woła `next()`. Czyli **anonim dostaje
  `200` zamiast `401`**.

**Bez `MOCK_DB=false` każdy Twój pomiar autoryzacji jest fikcją — środowisko
wstrzykuje anonimowi rolę właściciela.** W tym dyżurze jest jeszcze jeden,
specyficzny powód: **§B mierzy różnicę między „ocena istnieje" a „ocena nie
istnieje". Na mocku DB ta różnica nie istnieje w ogóle** — mock nie ma wierszy,
więc każdy pomiar §B bez realnego PG jest bezwartościowy. Dlatego **każde**
uruchomienie testu dotykającego bazy ma env **w tej samej linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day29-pg psql -U postgres -d cx_day29 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet w całości `SKIPPED` zaraportowany
jako `PASS` = zawyżenie i podstawa odrzucenia.** (Uwaga: `docker exec ... psql`
łączy się socketem wewnątrz kontenera, więc `inet_server_port()` bywa pusty —
tak było w dniu 25. To **nie jest** błąd; wtedy dokładasz do raportu wynik
`docker port cx-day29-pg` jako dowód mapowania na host.)

**★ Z20 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki albo z klienta HTTP)
  → montaż w Gateway.ts (plik:linia)
  → middleware (gatewayVerifyToken / trialEntryGuard / ...)
  → handler trasy (plik:linia)
  → serwis (plik:linia)
  → zapis/odczyt tabeli (nazwa tabeli, kolumna)
  → ODCZYT, który ten wynik podnosi (plik:linia)
```

Montaż tras AI jest w **`server/src/Gateway.ts:1085`**:
`app.use('/api/assessment', gatewayVerifyToken, trialEntryGuard, assessmentAIRoutes);`

**★★ UCZCIWA FORMA OSTATNIEGO OGNIWA W TYM DYŻURZE — przeczytaj, zanim zaczniesz
kłamać przez przemilczenie.** Trasy AI Assessment mają **ZERO żywych konsumentów
frontowych**. Hook `src/hooks/useAssessmentAI.ts` istnieje (wywołania m.in. `:260`,
`:335`, `:357`, `:433`, `:452`), ale **nikt go nie importuje** — `grep -rn
"useAssessmentAI" src/ | grep -v "src/hooks/useAssessmentAI.ts"` jest **PUSTY**
(potwierdź to sam, jest to obowiązkowy krok BLOKU 0 pkt 8). Dlatego dla §B
ostatnim ogniwem jest **koperta HTTP odczytu** — i **piszesz to wprost**:
„ostatnie ogniwo = koperta HTTP; jedyny klient `src/hooks/useAssessmentAI.ts`
nie ma ani jednego importera". **Nie wolno Ci** dopisać konsumenta frontowego,
żeby ogniwo „domknąć" (★ ograniczenie krytyczne), i **nie wolno Ci** przemilczeć
jego braku.

**★ Z21 — co to znaczy „test domyślnego okablowania".**
Test, który buduje własny `express()` i **wstrzykuje własny serwis albo własny
handler błędów**, nie dowodzi niczego o produkcji. Wzorzec dopuszczalny (i jedyny
wzorzec dowodowy tego dyżuru) to
`server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts:31-35`:
importuje **realny router** (`server/src/routes/assessment/assessment-ai.routes.js`),
montuje go pod `/api/assessment` z **realnym `verifyToken`** i realnym JWT
podpisanym sekretem z `Config`. **Serwisy, baza, mapowanie błędów — realne.**

**★ Odstępstwo, które masz naprawić przy okazji §B.4:** ten harness montuje
`verifyToken`, ale **NIE montuje `trialEntryGuard`**, który stoi w produkcji
(Gateway:1085). To jest udokumentowane odstępstwo od domyślnego okablowania.
Twoje **nowe** testy §B montują **oba** middleware'y w kolejności produkcyjnej,
a rozbieżność zastanego harnessu opisujesz w raporcie.

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
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/services/aiAssessmentPartnerService.ts                 (WYŁĄCZNIE §A — TYPY, zero zmiany zachowania)
  server/src/routes/assessment/assessment-ai.routes.ts              (WYŁĄCZNIE §B — ★ ZMIANA LICENCJI wobec dnia 25, patrz ramka niżej)
  server/src/routes/assessment/assessment-workflow.routes.ts        (WYŁĄCZNIE §C.1 — usunięcie sześciu handlerów access-requests)
  server/src/routes/assessment/assessments.routes.ts                (WYŁĄCZNIE §C.2 — usunięcie CAŁEGO pliku)
  server/src/services/assessment/assessmentReportContractService.ts (WYŁĄCZNIE §D — JEDNO nowe pole, ADDYTYWNIE)
  server/src/routes/assessment/__tests__/day29.*.test.ts            (NOWE pliki)
  server/src/services/assessment/__tests__/day29.*.test.ts          (NOWE pliki)
  server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts   (★ AKTUALIZUJESZ, §B.4 — tabela „przed/po" OBOWIĄZKOWA)
  tests/unit/backend/routes/h64-failsoft-batch6.test.ts             (★ LICENCJA WĄSKA §C.1 — patrz pięć warunków)
  tests/unit/backend/routes/h64-failsoft-batch7.test.ts             (★ LICENCJA WĄSKA §C.2 — patrz pięć warunków)
  tests/integration/routes/assessment.day29.*.postgres.integration.test.ts   (NOWE pliki, git add -f)
  server/migrations/2026118<x>_assessment_day29_*.sql               (NOWE pliki — najpewniej ŻADNA, §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY29_REPORT_20260827.md          (jedyny nowy dokument)

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  §A  — server/src/services/aiAssessmentFormHelper.ts        (CZYTASZ; zmiana TYLKO jeśli §A ją WYMUSI i z wpisem do raportu)
        server/src/services/aiAssessmentReportGenerator.ts   (jw.)
  §B  — server/src/utils/queryHelpers.ts                     (WOŁASZ; ZMIANA = STOP — współdzielone z całym produktem)
        server/src/middleware/trialEntryGuard.middleware.ts  (MONTUJESZ w teście; ZMIANA = STOP)
        server/src/middleware/auth.middleware.ts             (MONTUJESZ w teście; ZMIANA = STOP)
  §C  — server/src/routes/assessment/assessment-hub.routes.ts        (CZYTASZ jako ŻYWY odpowiednik; ZMIANA = STOP)
        server/src/routes/assessment-workflow-v2.routes.ts           (CZYTASZ jako ŻYWY odpowiednik; ZMIANA = STOP)
        server/src/services/assessmentPermissionService.ts           (CZYTASZ — §C.1 usuwa wołających, nie serwis)
        server/src/Gateway.ts                                        (★ WĄSKA LICENCJA §C.2: usunięcie importu i montażu USUNIĘTEGO pliku — nic więcej)
  §D  — server/src/routes/method-core.routes.ts                      (★ CZYTASZ trasę :532-547; ZMIANA = STOP — trasa tylko przekazuje wynik serwisu, nie masz w niej czego zmieniać)
        server/src/utils/DbPromise.ts                                (WOŁASZ; ZMIANA = STOP)
        server/src/method-core/outputs/**                            (WOŁASZ bez zmian; ZMIANA = STOP, Z16)
  wzorce testów — server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts
                  (realny router + realny JWT + realny PG — Twój wzorzec)

NIE WOLNO:
  ★★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK, wręcz wymagane)  ← podział FRONT/TYŁ; zero wyjątków; kolizja z dniem 27
  ★  dev-render/**, public/locales/**                             ← zakres dnia 27
  server/src/services/effectiveAccessService.ts                    ← Z16
  server/src/services/v8/artifactRegistryService.ts                ← Z16
  server/src/routes/method-core.routes.ts                          ← Z16; jądro zdarzeń współdzielone z Audits/SIRI (DEC-139)
  server/src/services/methodCore/**                                ← Z16
  server/src/services/demo/demoPrincipalGuard.ts                   ← ★ NIE MA w nim ani jednego wpisu Assessmentu (DEC-138); nie masz w nim czego usuwać
  server/src/routes/index.ts                                       ← martwy barrel CROSS-MODULE, osobna decyzja (DEC-137)
  server/src/routes/assessment/assessment-hub.routes.ts            ← ŻYWY odpowiednik; CZYTASZ
  server/src/routes/assessment-workflow-v2.routes.ts               ← ŻYWY odpowiednik; CZYTASZ
  server/src/routes/assessment-reports.routes.ts                   ← poza zakresem (kontrakt raportu odebrany DEC-122)
  server/src/services/drdStructure.ts i kanon 7 osi                ← odebrane DEC-122; ZMIANA = STOP
  server/migrations/<istniejące pliki>                             ← TYLKO ODCZYT (nowe DDL = nowy plik)
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts         ← ★ NIE dotyczy Assessmentu (DEC-138); NIE dotykasz
  wszystko inne
```

**★★ RAMKA: ZMIANA LICENCJI NA `assessment-ai.routes.ts` WOBEC DNIA 25.**
Instrukcja dnia 25 miała ten plik w ramce **NIE WOLNO** i dlatego dzień 25
zatrzymał się przed naprawą semantyki. **W tym dyżurze plik jest w ramce WOLNO
— wyłącznie dla pozycji §B i wyłącznie w zakresie tam wyliczonym.** To jest
świadome rozszerzenie licencji przez nadzorcę, nie Twoja interpretacja. Nie
rozciągasz go na nic innego: nie dodajesz tras, nie zmieniasz kształtu
odpowiedzi sukcesu, nie ruszasz `aiAssessmentPartner`/`aiAssessmentFormHelper`
z poziomu tego pliku.

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dzień 24 wrzucił cztery pozycje do jednego
  commita i to był **dodatkowy powód, dla którego żadna z nich nie dostała
  `ZROBIONE_WG_DoD`**. Conventional commits:

  ```
  test(assessment): pin the AI partner behaviour before typing it (A.1)
  refactor(assessment): type the AI partner service without changing behaviour (A.2)
  fix(assessment): tell a missing assessment apart from an empty one on the AI routes (B)
  test(assessment): retire the day 25 characterisation of the 200-for-anything gap (B.4)
  refactor(assessment): drop the dead v1 access-request block and repoint its fail-soft proof (C.1)
  chore(assessment): remove the unreachable assessment route file and repoint its fail-soft proof (C.2)
  feat(assessment): report contract carries an honest session display name (D)
  docs(assessment): raise 04_ASSESSMENT acceptance to the delivered scope (R.1)
  docs(assessment): day 29 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ Uwaga: `esbuild` TRANSPILUJE, nie typuje — nie złapie błędu typu.**
  **★★ JEDYNY WYJĄTEK OD ZAKAZU `tsc` W TYM DYŻURZE: pozycja §A**, i tylko
  z filtrem do jednego pliku, dokładnie dwiema komendami z §A.1. Nie uruchamiasz
  `tsc -p server/tsconfig.json` na całym projekcie — to jest kilkuminutowy
  przebieg, którego wynik i tak jest zdominowany przez cudze `@ts-nocheck`
  (w `server/src/services/` jest ich **kilkadziesiąt**, nie jeden).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z21).
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 29 MA PRZYDZIELONY PRZEDZIAŁ `20261180`–`20261189`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261179` to pule dni 22–28 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^2026118'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_assessment_day29_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa — dokładnie ta, którą wykrył odbiór dnia 18 (`DEC-107`).

  3. **★ ZERO nowych kluczy obcych.**
  4. **★★ NAJPEWNIEJ NIE POTRZEBUJESZ ŻADNEJ MIGRACJI. Sprawdziłem to za Ciebie:**
     - §A to wyłącznie typy — zero obiektów bazodanowych;
     - §B czyta istniejącą tabelę `assessments` (kolumny użyte przez
       `getAssessmentData` istnieją) — zero nowych obiektów;
     - §C usuwa kod — zero DDL;
     - §D czyta `method_sessions.project_id` (istnieje od
       `server/migrations/20260813_method_core_1_kernel.sql:58`) i `projects.name`
       (istnieje od `server/migrations/000_z_core_baseline.sql:156`) —
       **zero nowych obiektów**. **Nie dodajesz kolumny `name` do
       `method_sessions`** — to byłaby nowa, niewypełniana kolumna i nowy
       kontrakt zapisu, którego nikt nie zamawiał (§1.4).

     **Migracja bez udowodnionego braku obiektu na świeżej bazie = pozycja
     odrzucona.** Jeżeli mimo to uznasz, że migracja jest konieczna — najpierw
     dowód `\d <tabela>` z Twojego kontenera w raporcie, potem plik.

  5. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
     **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Zero rekordów testowych gdziekolwiek
  indziej. Sprzątanie kontenera **i wolumenów** jest obowiązkowe (BLOK 0 pkt 10).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `null` z powodem,
   **nigdy zmyślona wartość**.
2. **Odczyt z readbackiem** — po komendzie zmieniającej stan test ponownie
   odczytuje stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie
   z koperty odpowiedzi. (Ten dyżur prawie nic nie zapisuje; tam gdzie test
   zakłada dane wejściowe — seed idzie własnym poolem, a asercja czyta trasę.)
3. **Zero atrap, a w szczególności zero atrap z zewnętrznym skutkiem (Z22).**
   Brak API → wpis `BRAK_API`. **Wariant kluczowy dla tego dyżuru: `200`
   z wygenerowaną treścią dla obiektu, którego nie ma w bazie, jest atrapą.**
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje §B i §D mają wyższe minima podane
   we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG** (wzorzec:
   `server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts`).
   Test na zmockowanym serwisie **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka od realnego wejścia do odczytu,
   **z uczciwym nazwaniem ostatniego ogniwa** (dla tras AI: koperta HTTP + jawne
   stwierdzenie, że `useAssessmentAI` nie ma importera).
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — realny router, realne serwisy,
   **realne middleware'y w kolejności produkcyjnej** (`verifyToken` →
   `trialEntryGuard` dla §B); mockowanie ograniczone do `Logger.js`. **Każdy
   inny mock wymaga wpisu w raporcie z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200` z cudzą treścią; `organizationId` **wyłącznie z tokenu**, nigdy
   z body/query. **★ W tym dyżurze to jest już spełnione i masz to POTWIERDZIĆ,
   nie „naprawić"** — `getAssessmentData` pyta `WHERE id = ? AND organization_id = ?`
   z org z tokenu (§1.2 poz. 5).
9. **★ Kontrola negatywna roli** — tam, gdzie trasa ma bramkę roli, żądanie bez
   roli jest odrzucone i nie zostawia śladu mutacji.
10. **Realny PG w jednorazowym Dockerze** (port **5511**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem.
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem. **Wyjątek, który obowiązuje:** komunikaty i kody
> błędów, które faktycznie wychodzą z Twojego API. Kod błędu jest **stabilnym,
> maszynowym identyfikatorem** (`SCREAMING_SNAKE_CASE`, po angielsku), a `error`
> to **tekst po polsku** — dokładnie tak, jak robi to zastany plik tras AI
> (`{ error: 'Nie udało się wygenerować sugestii', code: 'ASSESSMENT_AI_...' }`).
> Nie dodajesz kluczy i18n do `public/locales/**` — to jest zakres dnia 27.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (§0.1 pkt 7).
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/services/aiAssessmentPartnerService.ts` (importują go trasy AI
   **i** `h64-failsoft-batch7`), `server/src/routes/assessment/assessment-ai.routes.ts`
   (importuje go `h64-failsoft-batch7`), `server/src/routes/assessment/assessment-workflow.routes.ts`
   (importuje go `h64-failsoft-batch6`), `server/src/routes/assessment/assessments.routes.ts`
   (importuje go `h64-failsoft-batch7`), `server/src/services/assessment/assessmentReportContractService.ts`
   (woła go `method-core.routes.ts`).
3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. Uruchom **minimum** poniższą listę. `ENV` niżej oznacza dosłownie
   `DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false`
   **w tej samej linii komendy** (Z19):

   ```bash
   # --- pakiety bez bazy ---
   npx vitest run tests/unit/backend/routes/h64-failsoft-batch6.test.ts
   npx vitest run tests/unit/backend/routes/h64-failsoft-batch7.test.ts
   npx vitest run tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts
   npx vitest run tests/integration/assessment-ai.integration.test.ts
   npx vitest run tests/unit/assessment

   # --- pakiety na realnym PG (KOMPLET pięciu zmiennych w tej samej linii) ---
   ENV npx vitest run server/src/services/assessment/__tests__
   ENV npx vitest run server/src/routes/assessment/__tests__
   ENV npx vitest run server/src/services/methodCore/__tests__
   ENV npx vitest run tests/integration/assessment
   ENV npx vitest run tests/integration/routes/assessment.day29.*.postgres.integration.test.ts

   # --- konsumenci SPOZA Twojego zakresu, którzy MUSZĄ zostać zieloni ---
   ENV npx vitest run server/src/routes/__tests__
   npx vitest run src/components/assessment/__tests__
   npx vitest run src/components/assessment/drd/__tests__
   ```

   Pakiety `src/components/assessment/**` są w zakresie **nie dlatego, że je
   zmieniasz** (nie wolno Ci), tylko dlatego, że **muszą pozostać dokładnie
   takie jak na markerze** — to jest Twój dowód, że nie wszedłeś do frontu.

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
7. **★★ OSŁABIENIE ALBO ZMIANA ASERCJI W TEŚCIE ISTNIEJĄCYM WCZEŚNIEJ WYMAGA
   TABELI „PRZED/PO" W RAPORCIE. W TYM DYŻURZE DOTYCZY TO TRZECH PLIKÓW —
   i to jest najczęstszy sposób, w jaki taka praca kłamie:**

   | Plik                                                                            | Pozycja | Co wolno                                                                                |
   | ------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
   | `server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts` | §B.4    | zmienić oczekiwane kody/ciała **zgodnie z nowym kontraktem**, dopisać `trialEntryGuard` |
   | `tests/unit/backend/routes/h64-failsoft-batch6.test.ts`                         | §C.1    | **przepiąć** blok `describe` z martwego routera na żywy — nigdy usunąć bez odpowiednika |
   | `tests/unit/backend/routes/h64-failsoft-batch7.test.ts`                         | §C.2    | **przepiąć** blok `describe` z martwego routera na żywy — nigdy usunąć bez odpowiednika |

   **Każda linia, którą w nich ZMIENIASZ (a nie dodajesz), idzie do tabeli
   „przed/po" z jednozdaniowym uzasadnieniem. Usunięcie bloku `describe`
   bez wskazania, gdzie ta sama semantyka jest dalej dowodzona = odrzucenie
   pozycji.**

8. **★ ZNANE CZERWONE ZASTANE — potwierdź albo obal, nie przepisuj na wiarę.**
   Dzień 25 zaraportował poniższe. `DEC-138` **obalił jedną z tych liczb** —
   to jest dokładnie powód, dla którego masz je zmierzyć, a nie przepisać:

   | Plik / pakiet                                           | Objaw wg raportu dnia 25                            | Co masz zrobić                                                                                                        |
   | ------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
   | `tests/unit/backend/routes/h64-failsoft-batch6.test.ts` | „16/18, 2 czerwone zastane"                         | **`DEC-138`: to było ZAWYŻENIE zastanej czerwieni — nadzorca zmierzył `18/18 PASS`.** Zmierz sam i podaj SWOJĄ liczbę |
   | `src/components/assessment/**`                          | `266/274` (8 czerwonych)                            | Potwierdź jako zastane. **NIE naprawiasz** (★ ograniczenie krytyczne)                                                 |
   | DRD component tests                                     | `40/46` (6 czerwonych)                              | jw.                                                                                                                   |
   | workflow integration                                    | `27/29` (2 czerwone)                                | Potwierdź albo obal                                                                                                   |
   | `server/src/routes/v8/assessment.routes` suite          | startup FAIL (brak `validateOrgMembership` w mocku) | Potwierdź jako zastane. **NIE naprawiasz** — naprawa leży w globalnym mocku (Z18)                                     |

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- wejść we `src/**`, `dev-render/**` albo `public/locales/**` z zapisem — **także
  po to, żeby „tylko pokazać nowe pole" albo „domknąć ostatnie ogniwo Z20"**;
- dotknąć `effectiveAccessService.ts`, `artifactRegistryService.ts`,
  `method-core.routes.ts`, `server/src/services/methodCore/**` albo
  `drdStructure.ts` (Z16) — STOP **zawsze**, także „addytywnie";
- **podbić `contractVersion` kontraktu raportu** (§D) — to jest STOP
  z propozycją, nie cicha zmiana; powód i konsekwencja są w §D pkt 6;
- zmienić kształt **sukcesu** którejkolwiek trasy AI (§B zmienia wyłącznie
  ścieżkę „nie ma takiej oceny" i „baza padła" — nigdy treść odpowiedzi
  udanej);
- dopisać sprawdzenie istnienia oceny do **któregokolwiek z 15 handlerów,
  które dziś nie dotykają bazy** (§B.5) — to jest STOP, a powód jest twardy
  i wyliczony w §B.5;
- ustawić `GOOGLE_AI_API_KEY` / `GEMINI_API_KEY` albo zmienić `initializeAI()` /
  `injectAIClient()` (Z14);
- usunąć albo osłabić blok `describe` w `h64-failsoft-batch6/7` **bez
  wskazania żywego odpowiednika** (§0.4a pkt 7);
- dodać nową trasę HTTP albo `router.use` (Z11);
- dodać migrację nieaddytywną, z kluczem obcym, albo z numerem **spoza
  przedziału `20261180`–`20261189`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- **przekroczyć budżet §A** — wtedy STOP JEST POPRAWNĄ ODPOWIEDZIĄ, ale
  **z licznikiem i uczciwym powodem** (§A.4). Dzień 25 zrobił STOP z powodem
  zmyślonym i to jest jedyna rzecz, za którą `DEC-138` go zganił.

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

Moduł Ocena/Assessment dostał od panelu eksperckiego **4,0/10 przy celu 9,5 —
najniższy wynik zbadany do tamtej chwili** (`DEC-2026-08-26-103`). Trzy powody
były rozstrzygające i wszystkie trzy dotyczą **produktu**, nie estetyki:

1. **DELIVERABLE NIE ISTNIEJE** — zakładka „Raport" renderowała tę samą macierz
   co Matrix plus jedno zdanie na obszar. → **Zaadresowane:** dzień 20 zbudował
   deterministyczny kontrakt raportu 7 rozdziałów (`DEC-122`), dzień 27 zbudował
   ekran. **Ten dyżur nie wraca do tego tematu — poza JEDNYM polem z §D.**
2. **MODUŁ AI-NATIVE NIE MA AI** — 26 endpointów `/api/assessment/:projectId/ai/*`
   zamontowanych i działających, **ZERO żywych konsumentów**. → **Ten dyżur
   NIE podłącza AI do frontu i NIE włącza LLM.** Robi rzecz mniejszą i twardszą:
   sprawia, że te 26 tras **przestaje kłamać, gdy oceny nie ma** (§B), i że plik,
   który je obsługuje, **przestaje być niewidoczny dla kompilatora** (§A).
3. **ZAAKCEPTOWANA ARCHITEKTURA JEST WYŁĄCZONA** — flagi domyślnie OFF.
   → Poza zakresem tego dyżuru (front, Z10).

Dzień 20 (`DEC-119`/`DEC-122`) dowiózł warstwę 1 i został scalony. Dzień 25
(`DEC-137`/`DEC-138`) dowiózł blok 2 i **zostawił trzy pozycje otwarte** —
i to są dokładnie Twoje pozycje §A, §B, §C. Dzień 27 dowiózł front raportu
i **zostawił jedną prośbę do serwera** — to jest Twoja pozycja §D.

**Czego ten dyżur NIE naprawia, choć panel to wypunktował:** 30 martwych
komponentów, 12 metod `api.ts` wołających nieistniejące trasy, 8 pustych
handlerów pod widocznymi przyciskami. **Wszystko to leży we froncie**, więc
leży poza Twoim zakresem co do znaku (★ ograniczenie krytyczne).

### 1.2. ★★ ERRATA — DWANAŚCIE RZECZY ZWERYFIKOWANYCH W KODZIE

**Ten paragraf jest ważniejszy od wszystkiego, co przeczytasz w raportach dni
20/25/27.** Każdy wiersz zmierzyłem sam na markerze — grep-em, `wc`-em albo
kompilatorem. **Weryfikujesz każdy punkt i wynik wpisujesz do raportu.**
Rozbieżność u Ciebie → **Twoja liczba jest prawdziwa**, moja idzie do „Korekt".

| #      | Teza, którą gdzieś przeczytasz                                                                    | Stan faktyczny na markerze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Skutek dla Ciebie                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | „`access-requests` są w `PUBLIC_DEMO_WRITE_ALLOWLIST`, więc usunięcie ich zepsuje publiczne demo" | **FAŁSZ, obalony osobiście przez nadzorcę (`DEC-138`).** `PUBLIC_DEMO_WRITE_ALLOWLIST` (`server/src/services/demo/demoPrincipalGuard.ts:267-291`) ma **DOKŁADNIE CZTERY** wpisy: `POST /api/auth/logout`, `POST /api/auth/refresh`, `POST /api/demo/toggle`, `POST /api/demo/record-event`. `grep -c -i assessment server/src/services/demo/demoPrincipalGuard.ts` = **0**. Wpisy z `publicDemoWriteAllowlist.test.ts:382-383` należą do tablicy `ROUTE_SURFACE` = inwentarza tras, które test asertuje jako **ZABLOKOWANE** („intersects the allowlist in exactly the four documented rows") | **NIE dotykasz `demoPrincipalGuard.ts` ani `publicDemoWriteAllowlist.test.ts`.** Nie masz w nich czego usuwać. Framing „produkcyjna allowlista bezpieczeństwa" był zawyżeniem |
| **2**  | „Część (b) A.2 jest `COORDINATION_REQUIRED` z trzech powodów"                                     | **Powód jest JEDEN i jest realny:** `tests/unit/backend/routes/h64-failsoft-batch6.test.ts:252-258` bootuje **realny router v1** (`server/src/routes/assessment/assessment-workflow.routes.js`), montuje go pod `/api/assessment-workflow` i strzela `POST /api/assessment-workflow/asmt-1/access-requests` (`:269`)                                                                                                                                                                                                                                                                          | **§C.1 rozwiązuje ten JEDEN powód przez przepięcie bloku, nie przez usunięcie testu.** Odpowiednik żywy jest w tym samym pliku, `:39-148` (v2)                                |
| **3**  | „Router v1 miał 31 handlerów, po dniu 25 ma 27" / „miał 32, ma 28"                                | **Obie liczby są prawdziwe, bo liczą co innego.** `grep -cE "^\s*router\.(get\|post\|patch\|put\|delete)\("` = **27** (same handlery). `grep -cE "router\.(get\|post\|patch\|put\|delete\|use)\("` = **28** (handlery + jeden `router.use`). Raport dnia 25 podał pierwszą, `DEC-138` drugą                                                                                                                                                                                                                                                                                                   | **Podajesz w raporcie liczbę Z KOMENDĄ, która ją wyprodukowała.** Sama liczba bez komendy jest bezwartościowa — to jest lekcja `DEC-138`                                      |
| **4**  | „B.2: 203 błędy standalone `tsc`, 92 przy tsconfigu projektu"                                     | **★ ODWROTNIE, ZMIERZONE.** Po zdjęciu `@ts-nocheck`: **gołe `npx tsc --noEmit <plik>` (opcje domyślne) = 135 błędów** (`TS2339`×92, `TS1259`×42 — artefakt braku `esModuleInterop`, `TS2724`×1). **Z opcjami projektu (`--strict --module NodeNext --target ES2022 --esModuleInterop --skipLibCheck`) = 203 błędy** (`TS2339`×81, `TS7006`×68, `TS7053`×29, `TS18046`×20, `TS18047`×3, `TS7034`×1, `TS7005`×1). Liczba **92** to nie „konfiguracja projektu", tylko **liczba samych `TS2339` w konfiguracji domyślnej**                                                                      | **§A.1 zaczyna się od ODTWORZENIA OBU LICZB, nie od naprawy.** Jeżeli u Ciebie wyjdzie inaczej — Twoja liczba jest prawdziwa                                                  |
| **5**  | „Trasy AI Assessment mają wyciek międzytenantowy"                                                 | **FAŁSZ, obalony przez drugi odbiór i nadzorcę (`DEC-138`).** `getAssessmentData` (`assessment-ai.routes.ts:33-42`) pyta `WHERE id = ? AND organization_id = ?`, a `organizationId` pochodzi **z tokenu** (`req.user`), nigdy z żądania. Drugi odbiorca zaseedował realny obcy assessment i udowodnił: **zero wycieku pól** (`name`/`industry`/`justification` = `false`). Harness Codexa strzelał w string `"foreign-project"`, który **nie istniał w bazie** — nie dowodził tego, co deklarował                                                                                             | **NIE piszesz w raporcie słowa „wyciek".** Defekt jest klasy **KONTRAKT/UX**: obcy i nieistniejący projekt są **NIEODRÓŻNIALNE** — brak nawet oracle'a istnienia              |
| **6**  | „Trasy AI zwracają 200 zamiast 404 — trzeba to naprawić na wszystkich 26"                         | **Tras jest 26, ale bazy dotyka 11.** `getAssessmentData` ma **1 definicję + 11 wywołań** (linie 328, 421, 481, 519, 552, 746, 776, 810, 848, 885, 922). Pozostałe **15 handlerów NIGDY nie czyta bazy** — niektóre destrukturyzują `projectId` i go **nie używają w ogóle** (np. `suggest-justification:142`, `suggest-evidence:173`, `suggest-target:199`)                                                                                                                                                                                                                                  | **§B dotyczy 11 handlerów. Pozostałych 15 NIE RUSZASZ — i to nie jest lenistwo, tylko twardy warunek (§B.5)**                                                                 |
| **7**  | „Wystarczy dopisać `if (!assessment) return 404` w handlerach"                                    | **Nie wystarczy, bo `getAssessmentData` nie mówi prawdy o tym, czego nie znalazł.** Przy braku wiersza **i** przy złapanym wyjątku bazy zwraca **ten sam** kształt: `{ projectId, organizationId, axes: {} }` (`:46` i `:124`). Handler nie ma jak odróżnić „nie ma oceny" od „baza padła" od „ocena jest, ale pusta"                                                                                                                                                                                                                                                                         | **§B.1 naprawia NAJPIERW źródło sygnału, dopiero §B.2 handlery.** Naprawa w odwrotnej kolejności zamieni awarię bazy w `404` — czyli w nowe kłamstwo                          |
| **8**  | „Można spokojnie dopisać sprawdzenie istnienia do `suggest-justification`"                        | **★ NIE MOŻNA — to wywali CUDZY, chroniony test.** `tests/unit/backend/routes/h64-failsoft-batch7.test.ts:83-124` montuje **realny router AI**, mockuje `aiAssessmentPartnerService` na rzut i strzela `POST /api/assessment/proj-1/ai/suggest-justification`, oczekując **`500` + `ASSESSMENT_AI_GENERATE_SUGGESTION_FAILED`**. `queryHelpers` **nie jest** w tym teście zmockowany. Dopisanie odczytu bazy do tego handlera zamieni `500` w `404` albo w wyjątek                                                                                                                            | **§B.5: piętnaście handlerów bez bazy zostaje bez bazy. STOP, jeśli Cię kusi**                                                                                                |
| **9**  | „`org-default` to zwykły fallback, nieszkodliwy"                                                  | Jest go **12 razy** (`:144, 325, 418, 478, 512, 549, 743, 773, 807, 841, 882, 919`) w postaci `req.user?.organizationId \|\| 'org-default'`. W produkcji trasy stoją za `gatewayVerifyToken` (`Gateway.ts:1085`), więc `req.user` **jest**, i fallback jest martwy — **ale jest to dokładnie ta konstrukcja, która w czterech innych routerach tej sesji okazała się realną dziurą** (`DEC-135/136/140`)                                                                                                                                                                                      | **To jest ZNALEZISKO, nie pozycja.** Wolno Ci je usunąć **tylko w tych 11 handlerach, które i tak zmieniasz w §B**, i tylko jeśli udowodnisz brak zmiany zachowania testem    |
| **10** | „Trasy AI mają konsumenta — jest hook `useAssessmentAI`"                                          | Hook istnieje (`src/hooks/useAssessmentAI.ts`, wywołania m.in. `:260, :335, :357, :433, :452`), ale **`grep -rn "useAssessmentAI" src/ \| grep -v "src/hooks/useAssessmentAI.ts"` jest PUSTY** — zero importerów. Trasy są **backend-only**                                                                                                                                                                                                                                                                                                                                                   | **Ostatnie ogniwo Z20 = koperta HTTP, nazwana wprost.** Nie dopisujesz konsumenta i nie przemilczasz jego braku                                                               |
| **11** | „F.1 blokuje `h64-failsoft-batch7`, więc pliku nie da się usunąć"                                 | Blokada jest realna (`batch7:53-55` importuje `assessments.routes.js` **bezpośrednio**), ale **jest odpowiednik**: `server/src/routes/assessment/assessment-hub.routes.ts:116` ma **ten sam** `GET /my-assessments`, jest **ZAMONTOWANY** (`Gateway.ts:1104`, `app.use('/api/assessments', assessmentHubRoutes)`) i **nie jest dziś pokryty** żadnym testem fail-soft. Różni się tylko kodem błędu: `ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED` vs `ASSESSMENTS_FETCH_ASSESSMENTS_FAILED`                                                                                                       | **§C.2 przepina test z martwego routera na żywy.** Efekt: pokrycie **rośnie**, a nie maleje — i to jest jedyny akceptowalny sposób usunięcia tego pliku                       |
| **12** | „Kontrakt raportu można rozszerzyć o nazwę, podbijając `contractVersion`"                         | **★ PODBICIE WERSJI ZŁAMAŁOBY FRONT DNIA 27 TWARDO.** `src/method-core/api/methodCoreApi.ts` (gałąź dnia 27) robi **równość dosłowną**: `if (response.reportContract.contractVersion !== 'assessment-report-contract-v1') throw new MethodCoreApiError(...)`. To nie jest ostrzeżenie — to **rzucony wyjątek zamiast ekranu**                                                                                                                                                                                                                                                                 | **§D dodaje pole ADDYTYWNIE i NIE RUSZA `contractVersion`.** Gdybyś uznał, że wersję trzeba podbić — **STOP z propozycją** (§D pkt 6)                                         |

### 1.3. ZAKRES — dokładnie cztery pozycje robocze i jedna dokumentacyjna

| Poz.     | Temat                                                     | Stan wejściowy (zweryfikowany)                                                               | Produkt                                                                                           |
| -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **§A**   | Zdjęcie `@ts-nocheck` z `aiAssessmentPartnerService.ts`   | 1439 linii bez typów; 203/135 błędy w dwóch konfiguracjach; `STOP` dnia 25 był nieuczciwy    | **POZYCJA BUDŻETOWANA** — typy bez zmiany zachowania, albo uczciwy STOP z licznikiem              |
| **§B**   | Uczciwa semantyka 11 tras AI: 200 → 404 / 503             | brak wiersza, obcy wiersz i awaria bazy dają identyczne `200` z pustką                       | `getAssessmentData` mówi prawdę; 11 handlerów odróżnia trzy stany; zaktualizowana charakteryzacja |
| **§C.1** | Usunięcie martwego bloku wniosków o dostęp z routera v1   | 6 handlerów bez konsumenta produkcyjnego; blokuje je JEDEN cudzy test                        | Usunięcie + przepięcie bloku `describe` na żywy router v2                                         |
| **§C.2** | Usunięcie nieosiągalnego `assessments.routes.ts`          | 497 linii, 11 handlerów, zero importerów produkcyjnych; blokuje JEDEN cudzy test             | Usunięcie pliku + przepięcie bloku `describe` na żywy `assessment-hub.routes.ts`                  |
| **§D**   | Czytelna nazwa sesji w kontrakcie raportu                 | kontrakt nie niesie żadnej nazwy; front dnia 27 pokazywał surowe `session-…` i skrócił crumb | JEDNO nowe pole, addytywne, `contractVersion` bez zmiany, `null` gdy nie ma czego nazwać          |
| **§R.1** | `MODULE_ACCEPTANCE.md` 04_ASSESSMENT do stanu faktycznego | 144 linie, bramka `EXPERT_NO_GO / FULL_PRODUCT_REMEDIATION_REQUIRED`                         | Podniesienie **z mianownikiem**, bez cichego podnoszenia bramek                                   |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **Cały front.** Ekran raportu, panele AI, hook `useAssessmentAI`, flagi
  `drdHttpSourceOfTruthV1` / `drdMethodWorkspaceSliceV1` / `ff_assessmentReportView`,
  i18n, zrzuty, SPEC-A, kanon triady. **To jest zakres dnia 27 i dni po nim.**
- **Podłączanie AI do produktu.** Zero LLM, zero klucza, zero konsumenta (Z14).
- **Walidacja skali `target_level`** — **ZROBIONA** w `DEC-2026-08-27-139`
  (`method-core.routes.ts`, bramkowana `DRD_METHOD_PACK_ID`, `400
TARGET_LEVEL_OUT_OF_SCALE`). Nie dubluj jej i nie ruszaj.
- **Polskie znaki w PDF** — **ZROBIONE** w `DEC-2026-08-27-139` (9 tras, font Lato).
- **`server/src/routes/index.ts`** — martwy barrel **cross-module** eksportujący
  ~150 tras całego produktu. To osobna decyzja (`DEC-137`), nie Twoja pozycja.
  Idzie do „Znalezisk", jeśli chcesz go odnotować po raz kolejny.
- **Pozostałe `@ts-nocheck` w `server/src/services/`** — jest ich kilkadziesiąt
  (m.in. `aiOrchestrator.ts`, `aiService.ts`, `managementReportsService.ts`,
  `emailService.ts`). **Zdejmujesz DOKŁADNIE JEDEN**, ten z §A.
- **Trasy `assessment-reports.routes.ts`, `assessment-workflow-v2.routes.ts`,
  `assessment-hub.routes.ts`, `assessment-enterprise.routes.ts`** — czytasz,
  nie zmieniasz.
- **Otwarcie modułu, zmiana bramek beta, zmiana montaży w `Gateway.ts`** poza
  jedną linią importu i jedną linią montażu usuwanego pliku (§C.2).
- **Wyciek `POST /generate` w management-reports, share-tokeny cross-org** —
  cudze moduły, otwarte pozycje bezpieczeństwa (`DEC-140`), nie Twoje.

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| Decyzja                  | Co ustala                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEC-2026-08-26-103`     | Panel 4,0/10; trzy zarzuty rozstrzygające; moduł wymaga remediacji produktowej, nie kosmetyki                                                 |
| `DEC-2026-08-26-119`     | Odbiór dnia 20; kontrakt raportu niesie **listę pominięć per pytanie**, agregat obszaru `true` tylko przy komplecie                           |
| `DEC-2026-08-26-122`     | Dzień 20 scalony: model 7 osi klient↔serwer, słownik 4 kodów „Pomiń", deterministyczny kontrakt 7 rozdziałów                                  |
| `DEC-2026-08-27-137`     | Dzień 25 scalony; **ale patrz `DEC-138`** — część tez tej decyzji została obalona                                                             |
| **`DEC-2026-08-27-138`** | **KOREKTA: allowlista nie zna Assessmentu; STOP B.2 niezasadny; znalezisko AI to KONTRAKT/UX, nie bezpieczeństwo; liczby liczą różne rzeczy** |
| `DEC-2026-08-27-139`     | Walidacja skali `target_level` **zrobiona**; polskie znaki w PDF **zrobione**                                                                 |
| `DEC-2026-08-26-95`      | Reguła rozejścia markera; rebase zakazany                                                                                                     |
| `DEC-2026-08-26-104`     | Z20 — dowód osiągalności, nie istnienia pliku                                                                                                 |
| `DEC-2026-08-26-107`     | Z21 — test wstrzykujący zależności nie dowodzi produkcji                                                                                      |
| `DEC-2026-08-26-108`     | Z22/Z23 — zakaz atrapy z zewnętrznym skutkiem; pomiar bez zawężania                                                                           |
| `DEC-2026-08-26-124`     | Obraz `postgres:15` **nie przechodzi migracji** — wymagany `pgvector/pgvector`                                                                |

**★ LEKCJA METODYCZNA Z `DEC-138`, która dotyczy Ciebie osobiście:**

> „przy znaleziskach nośnych — zwłaszcza gdy raport **powołuje się** na
> plik/allowlistę — nadzorca weryfikuje grep-em PRZED wpisem do rejestru; erraty
> autorów instrukcji też podlegają weryfikacji, bo **raz zmyślona teza propaguje
> się przez instrukcję → raport → rejestr**."

Dzień 25 „potwierdził" erratę autora instrukcji **bez sprawdzenia**, i fałsz
poszedł do rejestru decyzji. **Ty masz obowiązek OBALAĆ ten dokument, jeśli
kod mówi co innego.** Wpis „POTWIERDZONE" bez komendy w raporcie jest
traktowany jak wpis niewykonany.

### 1.6. ★ Podział FRONT / TYŁ — reguła rozstrzygająca

| Pytanie                                             | Odpowiedź                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Czy plik leży w `src/`, `dev-render/`, `public/`?   | **TAK → nie Twój.** Bez wyjątków, bez „jednej linii"                             |
| Czy zmiana dotyczy wyglądu, i18n, flagi, zrzutu?    | **TAK → nie Twój**                                                               |
| Czy zmiana dotyczy kształtu odpowiedzi HTTP?        | **TAK → Twój**, ale tylko w zakresie §B i §D, i tylko addytywnie/wyliczenie      |
| Czy trasa nie ma konsumenta i chcesz go dopisać?    | **NIE.** Piszesz `BRAK KONSUMENTA` w raporcie i idziesz dalej                    |
| Czy potrzebujesz zmienić cudzy test, żeby przeszło? | **Tylko w §C i tylko przez PRZEPIĘCIE na żywy odpowiednik**, z tabelą „przed/po" |

### 1.7. Stan faktyczny — co JUŻ JEST (zweryfikowane na markerze)

```
# MONTAŻE (server/src/Gateway.ts) — istotne dla tego dyżuru
Gateway.ts:73    import assessmentAIRoutes from './routes/assessment/assessment-ai.routes.js';
Gateway.ts:1085  app.use('/api/assessment', gatewayVerifyToken, trialEntryGuard, assessmentAIRoutes);
Gateway.ts:72    import assessmentRoutes from './routes/assessment/assessment.routes.js';     ← INNY plik niż assessments.routes.ts!
Gateway.ts:1086  mountStub('/api/assessment', assessmentRoutes, 'assessmentRoutes');
Gateway.ts:74    import assessmentHubRoutes from './routes/assessment/assessment-hub.routes.js';
Gateway.ts:1104  app.use('/api/assessments', assessmentHubRoutes);                              ← ŻYWY odpowiednik dla §C.2

# ★ PUŁAPKA NAZEWNICZA: w repo są DWA podobne pliki
#   server/src/routes/assessment/assessment.routes.ts   ← ŻYWY, montowany przez mountStub. NIE DOTYKASZ.
#   server/src/routes/assessment/assessments.routes.ts  ← MARTWY, 497 linii, §C.2. TEN usuwasz.
# Jedna litera „s" różnicy. Sprawdź nazwę pliku DWA RAZY przed każdym `git rm`.

# §A — PARTNER AI
server/src/services/aiAssessmentPartnerService.ts        1439 linii, linia 1 = `// @ts-nocheck`
  class AIAssessmentPartnerService  :148
  constructor przypisuje this.genAI/this.model  :149-153      ← pola NIGDY nie zadeklarowane
  initializeAI()  :155-171                                     ← czyta GOOGLE_AI_API_KEY/GEMINI_API_KEY (Z14: NIE RUSZASZ)
  injectAIClient(mockClient)  :178-182                         ← ustawia this._injected (Z21: to NIE jest dowód)
  większość metod ma sygnaturę `(axisId, currentScore, context = {})` bez typów

# §B — TRASY AI
server/src/routes/assessment/assessment-ai.routes.ts     989 linii, 26 tras
  getAssessmentData(projectId, organizationId)  :33-127
    :36-42   SELECT ... FROM assessments WHERE id = ? AND organization_id = ?   ← org Z TOKENU, ZERO wycieku
    :45-47   brak wiersza → logger.warn + `return { projectId, organizationId, axes: {} }`   ← ★ SEDNO §B.1
    :123-126 catch → logger.error + TEN SAM kształt                                          ← ★ SEDNO §B.3
  11 wywołań getAssessmentData: :328 :421 :481 :519 :552 :746 :776 :810 :848 :885 :922
  4 z nich pozwalają klientowi PODSTAWIĆ ocenę z body: `req.body.assessment || (await getAssessmentData(...))`
      :328 (validate)  :481 (executive-summary)  :519 (stakeholder-view)  :552 (benchmark-commentary)
  15 handlerów NIE dotyka bazy w ogóle — w tym trasy :140 :171 :197 :227
     (destrukturyzują projectId w liniach 142/173/199/229 i NIE UŻYWAJĄ go dalej)
  12× `req.user?.organizationId || 'org-default'`

# §B — ZASTANA CHARAKTERYZACJA (dzień 25), którą MUSISZ zaktualizować
server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts   78 linii, 4 testy
  :31-35  montuje REALNY router + REALNY verifyToken (ale BEZ trialEntryGuard)
  :38-53  suggest-target → 200, deterministyczna koperta fallback
  :55-66  validate z body.assessment → 200
  :68-71  insights dla `unknown` → 200 { insights: [], message: 'No assessment data to analyze' }
  :73-77  it('characterises the open tenant gap: an unknown foreign project is not rejected')
          ← ★ NAZWA TESTU JEST FAŁSZYWA (DEC-138). Nie ma tam żadnego „tenant gap".
            Ten test strzela w string, którego nie ma w bazie. §B.4 go naprawia.

# §C.1 — BLOK WNIOSKÓW O DOSTĘP W ROUTERZE v1
server/src/routes/assessment/assessment-workflow.routes.ts   2197 linii, 27 handlerów + 1 router.use
  :1785 POST   /:assessmentId/access-requests
  :1879 GET    /:assessmentId/access-requests
  :1940 POST   (approve)     :2043 POST (reject)     :2133 DELETE (cancel)
  odpowiedniki ŻYWE w assessment-workflow-v2.routes.ts: :651 :710 :755 :793 :830 (cancel = POST, nie DELETE)
  jedyny blokujący: tests/unit/backend/routes/h64-failsoft-batch6.test.ts:220-276 (loadApp :252-258, strzał :269)

# §C.2 — NIEOSIĄGALNY PLIK
server/src/routes/assessment/assessments.routes.ts   497 linii, 11 handlerów
  :25 GET /my-assessments   ← odpowiednik ŻYWY: assessment-hub.routes.ts:116 (kod błędu ASSESSMENT_HUB_...)
  :84 GET /:id · :133 POST / · :182 PUT /:id/status · :219 DELETE /:id · :257 POST /:id/complete
  :290 POST /:id/generate-initiatives · :364 POST /:id/responses/:questionId · :403 GET /:id/responses
  :436 GET /frameworks/list · :469 GET /frameworks/:frameworkId/questions
  jedyny blokujący: tests/unit/backend/routes/h64-failsoft-batch7.test.ts:36-78

# §D — KONTRAKT RAPORTU
server/src/routes/method-core.routes.ts:532-547   GET /sessions/:sessionId/assessment-report-contract
    ← trasa TYLKO przekazuje wynik serwisu; CZYTASZ, NIE ZMIENIASZ (Z16)
server/src/services/assessment/assessmentReportContractService.ts   168 linii
  :20-28  SELECT id, method_pack_version, created_at FROM method_sessions WHERE id = ? AND organization_id = ?
          ← ★ project_id NIE JEST dziś wybierany. To jest cała zmiana §D po stronie zapytania.
  :87-93  koperta zwracana: contractVersion / sessionId / outputId / revision / generatedAt / methodVersion / chapters
schemat: method_sessions.project_id  (20260813_method_core_1_kernel.sql:58, TEXT, NULL dozwolony, BEZ FK)
         projects.name               (000_z_core_baseline.sql:156, TEXT NOT NULL)
konsument: src/method-core/api/methodCoreApi.ts (gałąź dnia 27) — RÓWNOŚĆ DOSŁOWNA na contractVersion

# STRAŻNICY (pre-commit) — NIE OBCHODZISZ
scripts/check-list-canon.sh · scripts/check-artefakt.sh   (dotyczą frontu; Ciebie nie powinny ruszyć)
```

### 1.8. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **Jedna litera „s".** `assessment.routes.ts` (ŻYWY) vs `assessments.routes.ts`
   (MARTWY, §C.2). Usunięcie złego pliku = wywalenie zamontowanego routera.
   **Przed `git rm` uruchom `grep -rn "<nazwa pliku>" server/src/Gateway.ts`.**
2. **`@ts-nocheck` ukrywa błędy PRZED Tobą, nie tylko przed CI.** Dopóki go nie
   zdejmiesz, `tsc` na tym pliku zwraca **0 błędów**, co wygląda jak sukces.
   Pomiar §A.1 robisz **na kopii bez pierwszej linii**, w katalogu obok pliku
   (żeby rozstrzyganie importów się nie zmieniło), i **kopię kasujesz**
   natychmiast po pomiarze — nie commitujesz jej.
3. **`getAssessmentData` łapie wyjątek i zwraca sukces.** To jest wzorzec
   „cichej zieleni" z `DEC-2026-08-26-120`, dokładnie ten, który w Realizacji
   sprawił, że raport na komitet sterujący pisał „Confidence: high" przy
   padniętej usłudze ryzyk. Nie powtórz go w drugą stronę: **awaria bazy nie
   może stać się `404`** (§B.3).
4. **`req.body.assessment ||` w czterech handlerach.** Klient może podstawić
   całą ocenę w ciele żądania i wtedy baza **nie jest w ogóle pytana**. To nie
   jest wyciek (to własne dane klienta), ale **oznacza, że Twój `404` w tych
   czterech handlerach ma sens tylko wtedy, gdy `body.assessment` NIE został
   podany**. Zachowanie z podanym `body.assessment` **zostaje bez zmian** —
   inaczej złamiesz test `:55-66` zastanej charakteryzacji i kontrakt, którego
   nikt nie kazał Ci zmieniać.
5. **`describe.skipIf(!REAL_DB)`.** Zastany harness dnia 25 **cicho się pomija**
   bez pełnego kompletu env. Pakiet w całości `SKIPPED` zaraportowany jako
   `PASS` = naruszenie Z23. Sprawdzaj `SKIPPED` w każdym przebiegu.
6. **Kolejność §A i §B ma znaczenie w jedną stronę.** §A zmienia **typy** pliku,
   który §B **woła**. Zrób §A **przed** §B, żeby błędy typów nie ujawniły Ci się
   w środku pracy nad semantyką. Ale **jeśli §A skończy się STOP-em budżetowym —
   §B i tak robisz**; §B nie zależy od §A merytorycznie.
7. **`prettier` po `git rm`.** Usunięcie handlerów z 2197-liniowego pliku zwykle
   zostawia podwójne puste linie — hook je złapie. Formatuj **przed** commitem.
8. **Testy realdb w `tests/` wymagają `git add -f`.** Testy `__tests__` obok kodu
   w `server/src/` — nie.
9. **`docker exec ... psql` pokazuje pusty `inet_server_port()`.** To normalne
   (socket wewnątrz kontenera). Dołóż `docker port cx-day29-pg` jako dowód
   mapowania i nie trać na to czasu.
10. **Nie „naprawiaj" cudzych czerwonych.** Pakiety `src/components/assessment/**`
    mają zastane czerwone. Potwierdzasz je i **zostawiasz** — naprawa leży
    we froncie (★ ograniczenie krytyczne).

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker i gałąź** — §0.1 pkt 2, 6. Wynik obu komend do raportu.
   **Jeżeli w §0.1 pkt 1 widnieje nadal `«MARKER_SHA»` — STOP całego dyżuru.**

2. **★ Sprawdzenie kolizji z dniami 25/27/28** — §0.1 pkt 4, trzy komendy,
   tabela rozstrzygnięć. **`DAY25 NOT MERGED` = STOP całego dyżuru.**

3. **Zależności — symlink, nie instalacja (`DEC-86`).**

   ```bash
   cd /private/tmp/consultify-assessment-day29
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # TYLKO ODCZYT
   ls node_modules/.bin/vitest && ls node_modules/.bin/tsc && echo "DEPS OK"
   ```

   To **jedyny** dozwolony kontakt z chronionym katalogiem (Z5). `npm ci`
   w worktree jest niewskazane.

4. **Kontener PG — NAJPIERW baza, POTEM jakikolwiek pomiar (Z19 / `DEC-96`).**

   ```bash
   docker run -d --name cx-day29-pg \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day29 \
     -p 5511:5432 pgvector/pgvector:pg16
   sleep 8
   docker exec cx-day29-pg psql -U postgres -d cx_day29 -c "SELECT current_database(), inet_server_port();"
   docker port cx-day29-pg
   ```

   **Obraz `pgvector/pgvector:pg16` jest OBOWIĄZKOWY** (`DEC-124`). `postgres:15`
   nie ma rozszerzenia `vector` i **nie przechodzi migracji** — stracisz godzinę
   na diagnozę cudzego problemu. **Port 5511**; zajęty → pierwszy wolny, ale
   **nigdy 5499 / 5474 / 5498** (Z7).

5. **Pełne migracje projektu — dwa przebiegi + dry-run.**

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -20   # przebieg 1
   DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -5    # przebieg 2: MUSI być 0
   DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --dry-run 2>&1 | tail -5   # Pending: 0
   ```

   Liczby z przebiegów 1/2/dry są obowiązkową pozycją raportu (dzień 25 podał
   `851 / 0 / 0` — u Ciebie może być więcej, bo doszły migracje dni 26-28).

6. **Sprawdzenie obiektów, na których stoją Twoje pozycje.**

   ```bash
   docker exec cx-day29-pg psql -U postgres -d cx_day29 -c "\d assessments" | grep -E "id|organization_id|answers_json|context_snapshot|score_summary|assessment_type|status|completion_percent|confidence_avg"
   docker exec cx-day29-pg psql -U postgres -d cx_day29 -c "\d method_sessions" | grep -E "id|organization_id|project_id|method_pack_version|created_at"
   docker exec cx-day29-pg psql -U postgres -d cx_day29 -c "\d projects" | grep -E "^ id|organization_id|name"
   ```

   Brak `method_sessions.project_id` → **STOP pozycji §D** z wpisem.
   Brak którejkolwiek kolumny czytanej przez `getAssessmentData` → **STOP §B**.

7. **Namespace migracji — sprawdź i zapisz.**

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
   ls server/migrations | grep '^2026118'   # MUSI być puste
   ```

8. **★★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW — obowiązkowy, robisz go TERAZ,
   PRZED pierwszą linią kodu (lekcja `DEC-2026-08-26-117`).**

   Powód, dla którego to jest osobny krok, a nie ozdobnik: w module Audytów
   robotnik zbudował ekran, który wołał **inny renderer niż ten, którego treść
   była plombowana hashem** — bo nie sprawdził, kto co woła. Ty pracujesz
   w module, w którym **26 tras AI nie ma ani jednego konsumenta**, a dwa pliki
   tras są martwe. Bez tej mapy nie odróżnisz „naprawiłem" od „naprawiłem coś,
   czego nikt nie używa" — a to jest różnica między `ZROBIONE_WG_DoD`
   a `CZĘŚCIOWO`.

   ```bash
   # (a) wszystkie trasy AI, z numerami linii
   grep -nE "^router\.(get|post|patch|put|delete)\(" server/src/routes/assessment/assessment-ai.routes.ts

   # (b) które z nich dotykają bazy
   grep -n "getAssessmentData(" server/src/routes/assessment/assessment-ai.routes.ts
   grep -n "req.body.assessment" server/src/routes/assessment/assessment-ai.routes.ts

   # (c) kto w src/ woła cokolwiek pod /api/assessment/**/ai/**
   grep -rn "/ai/" src/hooks src/services src/components 2>/dev/null | grep -i assessment | grep -v __tests__
   grep -rn "useAssessmentAI" src/ | grep -v "src/hooks/useAssessmentAI.ts"     # ← SPODZIEWANE: PUSTE

   # (d) kto importuje pliki, które usuwasz (§C)
   grep -rn "assessments\.routes" server/src src tests | grep -v "assessment-reports\|multi-framework\|external-assessments\|public-mini\|migration/reports"
   grep -rn "assessment-workflow\.routes" server/src src tests

   # (e) kto woła kontrakt raportu (§D)
   grep -rn "assessment-report-contract" server/src src tests | grep -v __tests__
   ```

   **Produkt tego kroku (obowiązkowa tabela w raporcie):**

   | #   | Metoda + ścieżka | linia w routerze | dotyka bazy? | woła to (plik:linia w `src/`) albo `BRAK KONSUMENTA` |
   | --- | ---------------- | ---------------- | ------------ | ---------------------------------------------------- |

   Na końcu tabeli podajesz **trzy liczby**: ile tras AI dotyka bazy, ile nie,
   ile ma konsumenta. §1.2 poz. 6 i 10 podają moje: **26 tras, 11 dotyka bazy,
   0 ma konsumenta**. **Jeżeli u Ciebie wychodzi inaczej — Twoja liczba jest
   prawdziwa, moja idzie do „Korekt".**

9. **★ BASELINE — PRZED pierwszym commitem, komplet komend §0.4a.**
   Zapisz liczby **per plik**. Bez tego nie odróżnisz zastanego od wprowadzonego
   i cały raport jest nieweryfikowalny (`DEC-108`, P1). Baseline uruchamiasz
   **z kompletem pięciu zmiennych**. **Szczególnie zmierz
   `h64-failsoft-batch6.test.ts` — `DEC-138` twierdzi `18/18 PASS` wbrew
   raportowi dnia 25.**

10. **Sprzątanie na końcu dyżuru (obowiązkowe, wpis do raportu):**

    ```bash
    docker rm -f cx-day29-pg
    docker volume prune -f
    rm -f server/src/services/__tmp_*.ts    # gdyby została kopia z pomiaru §A.1
    git status --porcelain                  # MUSI być czysto poza tym, co świadomie zostawiasz
    ```

---

## §A. TYPY PARTNERA AI — pozycja BUDŻETOWANA (dawne „B.2")

### A.1 — Odtworzenie OBU liczb błędów (pierwszy krok, NIE naprawa)

**Nie zaczynasz od naprawy. Zaczynasz od pomiaru — bo dzień 25 nie zmierzył
i dlatego jego STOP był nieuczciwy (`DEC-138` poz. 4).**

1. Zrób **kopię roboczą bez pierwszej linii**, w tym samym katalogu (żeby
   rozstrzyganie importów relatywnych się nie zmieniło):

   ```bash
   sed '1{/@ts-nocheck/d;}' server/src/services/aiAssessmentPartnerService.ts \
     > server/src/services/__tmp_day29_measure.ts
   ```

2. Zmierz **dwie konfiguracje**, dosłownie tymi komendami:

   ```bash
   # (a) KONFIGURACJA DOMYŚLNA (bez -p, opcje domyślne tsc)
   npx tsc --noEmit server/src/services/__tmp_day29_measure.ts 2>&1 | grep -c "error TS"
   npx tsc --noEmit server/src/services/__tmp_day29_measure.ts 2>&1 \
     | sed 's/.*error \(TS[0-9]*\).*/\1/' | sort | uniq -c | sort -rn

   # (b) KONFIGURACJA PROJEKTU (flagi z server/tsconfig.json, filtr do jednego pliku)
   npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext \
     --lib ES2022 --strict --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck \
     server/src/services/__tmp_day29_measure.ts 2>&1 | grep -c "error TS"
   npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext \
     --lib ES2022 --strict --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck \
     server/src/services/__tmp_day29_measure.ts 2>&1 \
     | sed 's/.*error \(TS[0-9]*\).*/\1/' | sort | uniq -c | sort -rn
   ```

3. **Wartości zmierzone przeze mnie na markerze (masz je potwierdzić albo obalić):**

   | Konfiguracja | Suma    | Rozbicie                                                                                       |
   | ------------ | ------- | ---------------------------------------------------------------------------------------------- |
   | (a) domyślna | **135** | `TS2339`×92 · `TS1259`×42 · `TS2724`×1                                                         |
   | (b) projektu | **203** | `TS2339`×81 · `TS7006`×68 · `TS7053`×29 · `TS18046`×20 · `TS18047`×3 · `TS7034`×1 · `TS7005`×1 |

   **`TS1259`×42 w konfiguracji (a) to ARTEFAKT** braku `esModuleInterop` —
   nie są to realne błędy pliku i **nie naprawiasz ich**. Konfiguracją
   **wiążącą jest (b)**, bo to ona odpowiada `server/tsconfig.json`.

4. **Skasuj kopię NATYCHMIAST po pomiarze.** `rm server/src/services/__tmp_day29_measure.ts`.
   Kopia w commicie = naruszenie.

5. **Obie liczby, obie komendy i oba rozbicia idą do raportu.** To jest produkt
   pozycji A.1 niezależnie od tego, czy A.2 się uda.

### A.2 — Zdjęcie `@ts-nocheck` bez zmiany zachowania

**Zasada nadrzędna: to jest praca nad TYPAMI. Każda zmiana, która zmienia
wykonanie kodu, jest naruszeniem — łącznie z „przy okazji poprawiłem błąd".**

1. **Kolejność jest wyliczona i nie jest przypadkowa. `TS2339` (81 błędów)
   dzieli się na dwie zupełnie różne rodziny i pierwsza z nich znika po
   trzech linijkach:**

   | Właściwość         | Liczba `TS2339` | Rodzina                                                                    |
   | ------------------ | --------------: | -------------------------------------------------------------------------- |
   | `model`            |              28 | **pole klasy nigdy nie zadeklarowane** (`constructor:150`, `:161`, `:180`) |
   | `genAI`            |               6 | jw. (`constructor:149`, `:160`, `:179`)                                    |
   | `_injected`        |               2 | jw. (`initializeAI:157`, `injectAIClient:181`)                             |
   | `industry`         |              10 | **`context = {}` bez typu** — parametr, nie pole                           |
   | `language`         |               7 | jw.                                                                        |
   | `actual`           |               5 | jw. (kształt osi)                                                          |
   | `organizationName` |               4 | jw.                                                                        |
   | `companySize`      |               4 | jw.                                                                        |
   | pozostałe          |              15 | jw.                                                                        |

   **Krok 1 — trzy deklaracje pól klasy** (`AIAssessmentPartnerService:148`)
   zdejmują **36 z 81** `TS2339`. Typ pola: taki, jaki wynika z użycia
   (`GoogleGenerativeAI | null`, `GenerativeModel | null`, `boolean`), a jeśli
   pakiet nie eksportuje potrzebnego typu — **`unknown` z wąskim interfejsem
   lokalnym**, nigdy `any`.

   **Krok 2 — kształty `context`.** Zdefiniuj **lokalne, wąskie interfejsy**
   (`AssessmentAiContext`, `AxisScore` itp.) w tym samym pliku i podstaw je
   w sygnaturach. To zdejmuje resztę `TS2339` i większość `TS7006`.

   **Krok 3 — `TS7053` (29) i `TS18046`/`TS18047` (23).** `TS7053` to indeksowanie
   obiektu stringiem — rozwiązanie: typ indeksowany (`Record<string, X>`) albo
   `keyof typeof`. `TS18046`/`TS18047` to `unknown`/możliwy `null` — rozwiązanie:
   jawny `if`/zawężenie, **nigdy `as any`, nigdy `!`**.

2. **★ LICZNIK `any` — obowiązkowy w raporcie.** Podajesz `git diff` -owy bilans:
   `any` PRZED / `any` PO. **Wzrost liczby `any`, `as any`, `@ts-expect-error`
   albo `!` (non-null assertion) = pozycja odrzucona.** Zdjęcie `@ts-nocheck`
   przez rozsypanie `any` po pliku to nie naprawa, tylko przeniesienie długu
   w mniej widoczne miejsce.

3. **★ ZERO ZMIAN ZACHOWANIA.** W szczególności **nie ruszasz**:
   `initializeAI()` (poza deklaracją pól), `injectAIClient()`, żadnego promptu,
   żadnej wartości fallbacku, żadnego progu, żadnego tekstu po polsku.
   Jeżeli typowanie **ujawni Ci realny bug** — **nie naprawiasz go**; opisujesz
   w „Znaleziskach" i zostawiasz zachowanie bez zmian. (To jest ta sama reguła,
   przez którą dzień 25 słusznie nie ruszył jądra przy `target_level`.)

4. **DoD §A.2:** `@ts-nocheck` usunięty · komenda (b) z A.1 na **realnym pliku**
   (nie na kopii) daje **0 błędów** · bilans `any` nierosnący · testy z A.3
   zielone · `prettier` · commit osobny.

### A.3 — Dowód braku zmiany zachowania (warunek pozycji, nie dodatek)

1. **PRZED zdjęciem `@ts-nocheck`** uruchom zastaną charakteryzację i zapisz
   dosłowne ciała odpowiedzi:

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" DB_TYPE=postgres NODE_ENV=test \
     RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts
   ```

   Oczekiwane: **4/4 PASS, 0 SKIPPED**. `SKIPPED` = brak kompletu env → napraw
   env, nie test.

2. **Dołóż własny plik** `server/src/services/assessment/__tests__/day29.aiPartnerTypes.pg.test.ts`
   z **minimum czterema** testami behawioralnymi na **realnym routerze i realnym
   JWT** (wzorzec: harness dnia 25), pinujących kopertę **przed** typowaniem:
   `suggest-justification` (deterministyczny fallback bez klucza) ·
   `suggest-evidence` · `guidance` · `quick-actions`. **Wartości asercji
   wpisujesz Z PRZEBIEGU, nie z głowy** — to jest charakteryzacja, nie
   specyfikacja.

3. **PO zdjęciu `@ts-nocheck`** uruchom oba pliki ponownie. **Każda różnica
   w ciele odpowiedzi = zmiana zachowania = pozycja odrzucona**, nawet jeśli
   „lepsza".

4. **DoD §A.3:** tabela „przed/po" z ciałami odpowiedzi dla ≥4 tras · oba
   przebiegi w raporcie z liczbą SKIPPED · zero różnic.

### A.4 — BUDŻET I UCZCIWY STOP

**Budżet pozycji §A: 90 minut liczone od pierwszej komendy A.1.**
Próg decyzyjny: **60 minut**.

- Jeśli po 60 minutach liczba błędów w konfiguracji (b) **nie spadła poniżej
  60**, przerywasz i robisz **STOP** — z licznikiem, z rozbiciem, z listą
  rodzin, których nie ruszyłeś, i z **jednym zdaniem prawdziwego powodu**.
- **★ UCZCIWY STOP WYGLĄDA TAK** (to jest dosłowny wzorzec z `DEC-138`, którego
  dzień 25 nie napisał):

  ```
  ### STOP — §A.2
  Powód: budżet wyczerpany; plik ma 1439 linii, zostało <N> błędów typów
         (<rozbicie po kodach>), rodzina <X> wymaga przetypowania <Y> metod.
  Dowód: <komenda (b) z A.1> → <liczba>
  Co zrobiłbym dalej: <2-3 zdania>
  Stan: `@ts-nocheck` PRZYWRÓCONY (plik w stanie z markera) / zacommitowano częściowo w <SHA>
  ```

- **★ ZAKAZANE FORMY STOP-u:** powołanie się na cudzy plik, na negatyw tenanta,
  na „zakazany plik" — **żadna z nich nie blokuje §A**. `aiAssessmentPartnerService.ts`
  jest w ramce **WOLNO** i nic poza budżetem nie może go zablokować.
- **STOP §A nie zwalnia Cię z §B, §C, §D.** Robisz je normalnie.
- **Przy STOP-ie przywracasz plik do stanu z markera** (`git checkout «MARKER_SHA»
-- server/src/services/aiAssessmentPartnerService.ts`) albo commitujesz częściowy
  postęp **z powrotem założonym `@ts-nocheck`** — nigdy nie zostawiasz pliku
  bez `@ts-nocheck` i z błędami.

---

## §B. UCZCIWA SEMANTYKA TRAS AI — 200 → 404 / 503

### B.0 — Czego ta pozycja NIE jest (przeczytaj, zanim napiszesz linię)

- **NIE jest naprawą wycieku międzytenantowego.** Wycieku nie ma (§1.2 poz. 5).
  Zapytanie już dziś ma `AND organization_id = ?` z tokenu. **Słowo „wyciek"
  w Twoim raporcie = powtórzenie obalonej tezy.**
- **NIE jest zmianą kształtu odpowiedzi udanej.** Gdy ocena istnieje, koperta
  zostaje **bajt w bajt** taka jak dziś.
- **NIE jest zamianą uczciwego pustego stanu na błąd** (Z15). Ocena, która
  **istnieje** i nie ma odpowiedzi, dalej dostaje `200` z pustką.
- **NIE dotyczy 15 handlerów, które nie dotykają bazy** (§B.5).

**Czym jest:** dziś trzy zupełnie różne sytuacje — **(1) ocena nie istnieje**,
**(2) ocena należy do obcej organizacji**, **(3) baza padła** — dają
**identyczną odpowiedź `200`** z wygenerowaną treścią AI. To jest atrapa
w rozumieniu Z22 (sukces bez pokrycia w danych) i **jedyna rzecz, którą
naprawiasz**.

### B.1 — `getAssessmentData` przestaje udawać pustą ocenę

**To jest pierwszy commit §B i jedyny, w którym wolno Ci zmienić tę funkcję.**

1. Stan zastany (`assessment-ai.routes.ts:33-127`), trzy wyjścia, jeden kształt:

   ```
   :45-47    brak wiersza  → logger.warn(...)  → return { projectId, organizationId, axes: {} }
   :107-122  wiersz jest   →                     return { projectId, organizationId, id, name, ... }
   :123-126  wyjątek       → logger.error(...) → return { projectId, organizationId, axes: {} }
   ```

2. **Zmiana wymagana:** funkcja przestaje zwracać „udawaną ocenę" dla przypadków
   1 i 3. Rozstrzygnięcie kształtu należy do Ciebie, ale **musi spełniać cztery
   warunki**:
   - wołający **musi móc odróżnić trzy stany**: `ISTNIEJE` / `NIE_ISTNIEJE` /
     `AWARIA_ZRODLA` — bez zgadywania po `axes: {}`;
   - **`logger.warn` przy braku wiersza i `logger.error` przy wyjątku zostają**
     (to jest jedyny dzisiejszy sygnał operacyjny; nie kasujesz go);
   - **nie rzucasz gołego wyjątku bez klasy** — handler musi umieć zmapować
     go na kod, nie na generyczne `500 ..._FAILED`;
   - **zero zmiany dla przypadku 2** — kształt zwracanej istniejącej oceny
     zostaje bajt w bajt.

   Wzorzec rekomendowany (nie obowiązkowy, ale jeśli wybierzesz inny — uzasadnij
   w raporcie): funkcja zwraca `{ status: 'found', assessment } | { status:
'not_found' } | { status: 'source_unavailable', cause }`, a wołający
   rozstrzyga `switch`-em. **Nie używasz `null` jako jedynego sygnału** — `null`
   nie odróżnia „nie ma" od „nie dało się sprawdzić", a to jest cała pozycja.

3. **★ Uwaga na czwarty przypadek, który dziś nie istnieje i ma nie powstać:**
   wiersz **obcej** organizacji nigdy nie wraca z zapytania (`AND organization_id = ?`),
   więc z punktu widzenia tej funkcji obcy projekt **JEST** „nie istnieje".
   **Tak ma zostać.** Nie wolno Ci dobudować sprawdzenia „czy istnieje gdzie
   indziej", bo **to dopiero zbudowałoby oracle istnienia cudzych danych** —
   czyli realny wyciek, którego dziś nie ma. **Obcy i nieistniejący projekt mają
   dostać IDENTYCZNĄ odpowiedź `404`.** Ten akapit jest częścią DoD i wpisujesz
   go w raporcie jako świadomą decyzję.

4. **DoD §B.1:** trzy stany rozróżnialne · oba logi zostają · kształt istniejącej
   oceny bez zmian · dowód testowy z §B.2 · `prettier` · commit osobny.

### B.2 — Jedenaście handlerów odróżnia trzy stany

1. **Lista jest zamknięta. Dotyczy DOKŁADNIE tych jedenastu wywołań** (numery
   linii z markera — potwierdź je grep-em, bo po §A plik mógł się przesunąć):

   | Trasa                                         | linia handlera | linia wywołania | `req.body.assessment |     | `?  |
   | --------------------------------------------- | -------------: | --------------: | :------------------: | --- | --- |
   | `POST /:projectId/ai/validate`                |            322 |             328 |       **TAK**        |
   | `GET  /:projectId/ai/insights`                |            415 |             421 |         nie          |
   | `POST /:projectId/ai/executive-summary`       |            474 |             481 |       **TAK**        |
   | `POST /:projectId/ai/stakeholder-view`        |            508 |             519 |       **TAK**        |
   | `POST /:projectId/ai/benchmark-commentary`    |            545 |             552 |       **TAK**        |
   | `POST /:projectId/ai/fill-missing`            |            739 |             746 |         nie          |
   | `POST /:projectId/ai/review-justifications`   |            769 |             776 |         nie          |
   | `POST /:projectId/ai/reports/full`            |            803 |             810 |         nie          |
   | `POST /:projectId/ai/reports/stakeholder`     |            837 |             848 |         nie          |
   | `POST /:projectId/ai/reports/benchmark`       |            878 |             885 |         nie          |
   | `POST /:projectId/ai/reports/initiative-plan` |            915 |             922 |         nie          |

2. **Kontrakt odpowiedzi — trzymasz się konwencji zastanej w tym pliku**
   (`{ error: '<po polsku>', code: '<SCREAMING_SNAKE>' }`):

   | Stan                               | Kod HTTP | `code`                          | `error` (PL)                                      |
   | ---------------------------------- | -------: | ------------------------------- | ------------------------------------------------- |
   | ocena nie istnieje **lub obca**    |  **404** | `ASSESSMENT_NOT_FOUND`          | `Nie znaleziono oceny o podanym identyfikatorze.` |
   | ocena istnieje, brak odpowiedzi    |  **200** | —                               | koperta jak dziś (**Z15 — nie ruszasz**)          |
   | źródło danych niedostępne (awaria) |  **503** | `ASSESSMENT_SOURCE_UNAVAILABLE` | `Źródło danych oceny jest chwilowo niedostępne.`  |
   | błąd generowania (jak dziś)        |  **500** | `ASSESSMENT_AI_..._FAILED`      | jak dziś — **nie ruszasz**                        |

   **Kody błędów są maszynowe i angielskie, teksty `error` są polskie** — tak
   jak w całym tym pliku. **Nie dodajesz kluczy i18n** (to `src/`/`public/`, ★).

3. **★ CZTERY HANDLERY Z `req.body.assessment ||` — reguła dokładna.**
   W tych czterech sprawdzenie istnienia **wykonuje się TYLKO wtedy, gdy klient
   NIE podał `body.assessment`**. Gdy podał — zachowanie **zostaje bez zmian**
   (i tak nie pytamy bazy). Inaczej złamiesz test `assessmentAiPartner.day25.pg.test.ts:55-66`
   i zmienisz kontrakt, którego nikt nie kazał Ci zmieniać. **Ta asymetria idzie
   do raportu jako jawna decyzja, a nie jako przeoczenie.**

4. **★ `org-default` — wolno usunąć TYLKO w tych jedenastu handlerach.**
   `req.user?.organizationId || 'org-default'` → `req.user?.organizationId`.
   Jeżeli `organizationId` jest pusty, handler **odmawia** (`401`/`403` zgodnie
   z tym, co robi `verifyToken` — nie wymyślasz nowego kodu). **Warunek: musisz
   udowodnić testem, że przy zamontowanym `verifyToken` ten przypadek jest
   nieosiągalny**, albo zostawić fallback i opisać go w „Znaleziskach". **Nie
   ruszasz pozostałych ośmiu wystąpień** (`:144` i dalej, w handlerach bez bazy).

5. **Testy — minimum SIEDEM, nowy plik**
   `server/src/routes/assessment/__tests__/day29.aiRoutesNotFound.pg.test.ts`,
   realny router + **`verifyToken` I `trialEntryGuard` w kolejności produkcyjnej**
   - realny JWT + realny PG:
   1. **happy** — zaseedowana ocena we własnej organizacji → `200`, koperta
      **identyczna** z zastaną (asercja na pełnym ciele, nie na `status`);
   2. **nie istnieje** — losowy `projectId` → `404 ASSESSMENT_NOT_FOUND`;
   3. **★ negatyw tenanta** — ocena **zaseedowana w obcej organizacji** (realny
      wiersz, nie zmyślony string — to była wada harnessu dnia 25) → `404`
      **NIEODRÓŻNIALNE co do bajta** od przypadku 2. Asercja porównuje **całe
      ciała obu odpowiedzi** i wymaga równości;
   4. **uczciwy pusty stan** — ocena istnieje, `answers_json` pusty → `200`
      z pustką, **nie** `404`;
   5. **awaria źródła** — wymuszona lokalnie (`vi.mock` **wyłącznie** na
      `queryHelpers` w Twoim pliku, nigdy globalnie — Z18) → `503
ASSESSMENT_SOURCE_UNAVAILABLE`, **nie** `404` i **nie** `200`;
   6. **`body.assessment` podane** dla jednego z czterech handlerów z pkt 3 →
      `200` bez pytania bazy (dowód: spy na `queryHelpers.queryOne` = 0 wywołań);
   7. **anonim** — żądanie bez `Authorization` → `401`, zero wywołań bazy.

   **Powtórz przypadki 1-3 na co najmniej TRZECH różnych trasach z listy z pkt 1**
   (np. `insights`, `reports/full`, `fill-missing`), żeby dowód nie stał na
   jednym handlerze.

6. **★ DOWÓD MUTACYJNY — obowiązkowy.** Metodą `git stash` pokaż, że **bez
   Twojej naprawy** testy 2, 3 i 5 **padają** (dostają `200`). Wklej do raportu
   **dosłowny stdout obu przebiegów**. Bez tego dowodu pozycja jest `CZĘŚCIOWO` —
   test, który przechodzi także przed naprawą, nie dowodzi naprawy.

7. **DoD §B.2:** 7 testów × ≥3 trasy · dowód mutacyjny (stdout przed/po) ·
   dowód osiągalności Z20 z uczciwym ostatnim ogniwem · tabela „stan → kod → code"
   · `prettier` · commit osobny.

### B.3 — Awaria bazy przestaje być nieodróżnialna od braku

To jest **osobny akapit, bo jest to osobna klasa błędu** (rodzina „cichej
zieleni" z `DEC-2026-08-26-120`) i najłatwiej ją zgubić w §B.2.

1. Dziś `catch` w `getAssessmentData:123-126` zamienia **każdą** awarię bazy
   w „ocena jest pusta". Po §B.1 ma zwracać `source_unavailable`.
2. **Handler mapuje to na `503`, nigdy na `404` i nigdy na `200`.**
3. **`logger.error` zostaje** — z pełnym kontekstem (`projectId`,
   `organizationId`, `err`). Nie „poprawiasz" go na `warn`.
4. **Zero wycieku wnętrza w kopercie** — treść wyjątku (np. connection string,
   nazwa użytkownika bazy) **nie może** trafić do odpowiedzi. To jest ten sam
   standard, który dowodzi `h64-failsoft-batch7` (`docs/standards/ERROR_HANDLING_STANDARD.md`
   §1/§3 „Zero wycieku wnętrza"). **Twój test 5 z §B.2 asertuje to wprost**:
   ciało odpowiedzi nie zawiera tekstu wyjątku.

### B.4 — Aktualizacja charakteryzacji dnia 25 (tabela „przed/po" OBOWIĄZKOWA)

`server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts`
**pinuje dokładnie to zachowanie, które naprawiasz.** Po §B.2 dwa jego testy
(`:68-71`, `:73-77`) staną się czerwone — **i to jest poprawne**.

1. **Wolno Ci zmienić ten plik. Nie wolno Ci go usunąć ani wypatroszyć.**
2. Zmiany wymagane:
   - `it('insights returns an honest fallback for an unknown project')` →
     oczekuje `404 ASSESSMENT_NOT_FOUND`;
   - `it('characterises the open tenant gap: an unknown foreign project is not
rejected')` → **nazwa jest FAŁSZYWA** (`DEC-138`: nie ma tam żadnego „tenant
     gap", test strzelał w string, którego nie ma w bazie). Zamieniasz go na
     test, który **seeduje realną ocenę w obcej organizacji** i asertuje
     **nieodróżnialność** od przypadku „nie istnieje";
   - dołóż `trialEntryGuard` do montażu, żeby harness odpowiadał produkcji
     (`Gateway.ts:1085`) — i **opisz to jako naprawę odstępstwa Z21**;
   - dwa pozostałe testy (`suggest-target`, `validate` z `body.assessment`)
     **zostają bez zmian** — jeśli u Ciebie padną, to znaczy, że §A albo §B
     zmieniły zachowanie, czego nie wolno.
3. **Tabela „przed/po" w raporcie: linia, było, jest, jednozdaniowy powód.**
   Każda zmieniona linia. Brak tabeli = odrzucenie pozycji (§0.4a pkt 7).
4. **Commit osobny** — `test(assessment): retire the day 25 characterisation of
the 200-for-anything gap (B.4)`.

### B.5 — ★ PIĘTNAŚCIE HANDLERÓW BEZ BAZY: NIE DOTYKASZ. STOP, JEŚLI CIĘ KUSI

**To nie jest zaniedbanie i nie jest kompromis. Powód jest twardy, zmierzony
i jeżeli go zignorujesz, wywalisz cudzy, chroniony test:**

`tests/unit/backend/routes/h64-failsoft-batch7.test.ts:83-124` montuje **realny
router AI**, mockuje `aiAssessmentPartnerService` na rzut i strzela
`POST /api/assessment/proj-1/ai/suggest-justification`, oczekując **`500` +
`ASSESSMENT_AI_GENERATE_SUGGESTION_FAILED`**. `queryHelpers` **nie jest** w tym
teście zmockowany, a `proj-1` nie istnieje w żadnej bazie. **Dopisanie do tego
handlera odczytu bazy zamieni oczekiwane `500` w `404` albo w wyjątek** — i test
padnie. Ten test jest **poza Twoją licencją do zmiany w §B** (licencja na
`batch7` dotyczy **wyłącznie** §C.2 i **wyłącznie** bloku o `assessments.routes.ts`).

**Zatem:**

- **Piętnaście handlerów bez wywołania `getAssessmentData` zostaje bez zmian.**
  W tym cztery, które destrukturyzują `projectId` i **nigdy go nie używają**
  (`suggest-justification:142`, `suggest-evidence:173`, `suggest-target:199`,
  `correct-text:229`).
- **To jest ZNALEZISKO, nie pozycja.** Wpisujesz do raportu tabelę: trasa →
  czy używa `projectId` → co by trzeba zrobić → dlaczego NIE zrobiłeś.
  Rozstrzygnięcie („czy trasy, które nie potrzebują oceny, mają w ogóle mieć
  `:projectId` w ścieżce") jest **decyzją produktową właściciela**, nie Twoją.
- **Jeżeli mimo to uznasz, że trzeba je ruszyć — STOP z propozycją.**

---

## §C. KOORDYNOWANA CZYSTKA — usunięcia zablokowane przez CUDZE TESTY

### C.0 — Reguła nadrzędna całej pozycji §C

Dzień 25 zatrzymał obie te czystki, bo **usunięcie kodu wywaliłoby cudzy test,
a licencja nie pozwalała testu ruszyć**. Ten dyżur **dostaje licencję** — ale
w jednej, ściśle określonej formie:

> **PRZEPIĘCIE, NIGDY USUNIĘCIE.** Blok `describe`, który dowodzi semantyki
> fail-soft na martwym routerze, **przenosisz na ŻYWY router o tej samej
> semantyce**. Efekt: pokrycie **rośnie** (żywa trasa zyskuje dowód, którego
> nie miała), a martwy kod znika. **Usunięcie bloku `describe` bez wskazania
> żywego odpowiednika = odrzucenie pozycji.**

**PIĘĆ WARUNKÓW — wszystkie muszą być spełnione PRZED usunięciem czegokolwiek.**
Każdy warunek osobno, dosłownie, w raporcie:

| #   | Warunek                                                                                   | Dowód w raporcie                                                        |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Grep repo-wide per handler jest PUSTY** poza plikiem usuwanym i wskazanym cudzym testem | dosłowny wynik `grep -rn` po `server/src`, `src`, `tests`               |
| 2   | **Istnieje ŻYWY odpowiednik**, zamontowany, z podaną linią montażu w `Gateway.ts`         | `plik:linia` handlera + `Gateway.ts:linia` montażu                      |
| 3   | **Semantyka odpowiednika jest ta sama** (ta sama operacja, ta sama klasa błędu)           | tabela: handler martwy → handler żywy → różnice (np. kod błędu)         |
| 4   | **Cudzy test przepięty, nie usunięty**, i przechodzi na żywym routerze                    | tabela „przed/po" + wynik przebiegu                                     |
| 5   | **Zero zmian w globalnej infrze testowej** (Z18) — mocki wyłącznie lokalne w pliku testu  | `git diff --name-only` nie zawiera `tests/setup.ts`, `tests/helpers/**` |

**Którykolwiek warunek niespełniony → STOP tej pozycji, bez usuwania.**

### C.1 — Martwy blok wniosków o dostęp w routerze v1

1. **Zakres — sześć handlerów** w
   `server/src/routes/assessment/assessment-workflow.routes.ts` (linie z markera,
   potwierdź grep-em):

   | #   | Handler v1                                                        | linia | Odpowiednik ŻYWY w `assessment-workflow-v2.routes.ts` |
   | --- | ----------------------------------------------------------------- | ----: | ----------------------------------------------------- |
   | 1   | `POST /:assessmentId/access-requests`                             |  1785 | `:651`                                                |
   | 2   | `GET /:assessmentId/access-requests`                              |  1879 | `:710`                                                |
   | 3   | `POST` approve                                                    |  1940 | `:755`                                                |
   | 4   | `POST` reject                                                     |  2043 | `:793`                                                |
   | 5   | `DELETE` cancel                                                   |  2133 | `:830` — **★ v2 używa `POST`, nie `DELETE`**          |
   | 6   | helper przejścia stanu (jeśli po usunięciu 1-5 nie ma wołających) |     — | odpowiednik wewnętrzny v2                             |

   **★ Wiersz 5 wymaga osobnego zdania w raporcie.** Różnica czasownika
   (`DELETE` v1 vs `POST` v2) oznacza, że **gdyby ktokolwiek wołał v1, przepięcie
   go na v2 nie byłoby przezroczyste**. Musisz udowodnić, że **nikt nie woła**
   (warunek 1), i **wprost napisać**, że różnica czasownika jest znana
   i nieistotna wyłącznie dlatego, że konsumentów nie ma.

2. **★ CZEGO NIE ROBISZ, wbrew temu, co przeczytasz w raporcie dnia 25:**
   **nie dotykasz `server/src/services/demo/demoPrincipalGuard.ts` ani
   `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts`.** Teza, że
   `access-requests` są w allowliście, jest **FAŁSZYWA** (`DEC-138`, §1.2 poz. 1).
   `grep -c -i assessment server/src/services/demo/demoPrincipalGuard.ts` = **0**.
   **Uruchom ten grep i wklej wynik do raportu** — to jest Twój dowód, że nie
   powieliłeś obalonej tezy. Uruchom też cały pakiet
   `publicDemoWriteAllowlist.test.ts` **przed i po** usunięciu i pokaż, że wynik
   jest identyczny.

3. **Przepięcie cudzego testu (warunek 4).**
   `tests/unit/backend/routes/h64-failsoft-batch6.test.ts:220-279` to blok
   `describe('/api/assessment-workflow/* — access-request writes fail-closed
(H6.4 batch6)')` (linie **220–276**), którego `loadApp()` (`:252-258`) importuje
   **martwy router v1**.

   **★ Ten sam plik ma już blok `:39-148`**, który dowodzi **dokładnie tej samej
   semantyki na ŻYWYM routerze v2** (`POST /api/assessment-workflow-v2/asmt-1/access-requests`
   → `500` + `ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED`, `:141-148`). **Kod błędu
   jest identyczny.**

   Rozstrzygnięcie: blok `:220-276` **staje się dokładnym duplikatem** bloku
   `:39-148`. Wolno Ci go **usunąć** — ale **wyłącznie** po wpisaniu do raportu:

   ```
   Blok describe „:220-276" (router v1) usunięty jako DUPLIKAT bloku „:39-148" (router v2).
   Dowód równoważności: ta sama operacja (POST access-requests), ten sam kod błędu
   (ASSESSMENT_ACCESS_REQUEST_CREATE_FAILED), ta sama asercja braku wycieku err.message.
   Pokrycie po zmianie: <N-1> bloków, semantyka fail-soft access-requests nadal dowodzona.
   ```

   **Jeżeli po zmierzeniu okaże się, że bloki NIE są równoważne** (inny kod
   błędu, inna asercja, inna klasa awarii) — **nie usuwasz**, tylko **przepinasz
   `loadApp()` na v2** i dostosowujesz ścieżkę. **Zgadywanie równoważności bez
   porównania obu bloków linia po linii = odrzucenie pozycji.**

4. **Regresja żywych tras v1 — obowiązkowa.** Router v1 ma po usunięciu **21
   handlerów** i **wszystkie muszą dalej działać**. Dołóż test
   `server/src/routes/assessment/__tests__/day29.workflowV1Survivors.pg.test.ts`,
   realny router + realny PG + realny JWT, który sprawdza **co najmniej sześć**
   ocalałych tras (`status`, `versions`, `history`, `activities`, `presence`,
   `activity-logs`) → nie `404`, oraz **wszystkie sześć usuniętych** → `404`.

5. **DoD §C.1:** pięć warunków §C.0 · grep per handler dosłownie · tabela sześciu
   semantyk · dowód `grep -c -i assessment demoPrincipalGuard.ts` = 0 · przebieg
   `publicDemoWriteAllowlist.test.ts` przed/po identyczny · przepięcie/usunięcie
   bloku z uzasadnieniem równoważności · test ocalałych tras · `prettier` ·
   commit osobny.

### C.2 — Nieosiągalny `assessments.routes.ts`

1. **★ SPRAWDŹ NAZWĘ PLIKU DWA RAZY.** Usuwasz
   **`server/src/routes/assessment/assessments.routes.ts`** (497 linii, 11
   handlerów). **NIE** `server/src/routes/assessment/assessment.routes.ts`
   (bez „s"), który jest **ŻYWY** i montowany przez `mountStub`
   (`Gateway.ts:72, 1086`). Jedna litera różnicy; pomyłka = wywalenie
   zamontowanego routera.

   ```bash
   grep -n "assessment.routes\|assessments.routes" server/src/Gateway.ts   # PRZED git rm
   ```

2. **Tabela jedenastu semantyk — obowiązkowa w raporcie.** Dla każdego handlera:
   ścieżka → odpowiednik żywy (plik:linia + montaż) albo `MARTWA SEMANTYKA` →
   werdykt. Punkt wyjścia (zweryfikowany, potwierdź sam):

   | Handler                                  | linia | Odpowiednik                                                  |
   | ---------------------------------------- | ----: | ------------------------------------------------------------ |
   | `GET /my-assessments`                    |    25 | **`assessment-hub.routes.ts:116`**, montaż `Gateway.ts:1104` |
   | `GET /:id`                               |    84 | hub / v2 — **ustal sam**                                     |
   | `POST /`                                 |   133 | hub / v2 — ustal sam                                         |
   | `PUT /:id/status`                        |   182 | v2 — ustal sam                                               |
   | `DELETE /:id`                            |   219 | hub / v2 — ustal sam                                         |
   | `POST /:id/complete`                     |   257 | v2 close/freeze — ustal sam                                  |
   | `POST /:id/generate-initiatives`         |   290 | v2 generation — ustal sam                                    |
   | `POST /:id/responses/:questionId`        |   364 | kanoniczne zdarzenia Method Core                             |
   | `GET /:id/responses`                     |   403 | jw.                                                          |
   | `GET /frameworks/list`                   |   436 | `assessmentCatalog` — ustal sam                              |
   | `GET /frameworks/:frameworkId/questions` |   469 | jw.                                                          |

   **Wiersze „ustal sam" ustalasz grep-em, nie domysłem.** Handler bez
   odpowiednika i bez konsumenta to `MARTWA SEMANTYKA` — dopuszczalny werdykt,
   ale musi być nazwany.

3. **Przepięcie cudzego testu (warunek 4) — tu pokrycie ROŚNIE.**
   `tests/unit/backend/routes/h64-failsoft-batch7.test.ts:36-78` to blok
   `describe('/api/assessments/my-assessments — read stays fail-closed (H6.4 batch7)')`,
   który importuje martwy plik (`:53-55`).

   **Żywy odpowiednik `assessment-hub.routes.ts:116` NIE MA DZIŚ ŻADNEGO testu
   fail-soft.** Zatem: **przepinasz blok, nie usuwasz go.** Zmiany:

   | Co                       | Przed                                                          | Po                                                            |
   | ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------- |
   | import routera           | `.../routes/assessment/assessments.routes.js`                  | `.../routes/assessment/assessment-hub.routes.js`              |
   | oczekiwany `code`        | `ASSESSMENTS_FETCH_ASSESSMENTS_FAILED`                         | `ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED`                     |
   | ścieżka montażu w teście | `/api/assessments`                                             | bez zmian                                                     |
   | asercje braku wycieku    | **bez zmian** — `SECRET_LEAK`, `consultinity_prod`, logger spy | **bez zmian** (osłabienie którejkolwiek = odrzucenie pozycji) |

   **★ Ryzyko, o którym masz wiedzieć zawczasu:** `assessment-hub.routes.ts:110`
   ma `router.use(demoContextMiddleware)`. Jeżeli test przez to nie wystartuje,
   **mockujesz `demoContextMiddleware` LOKALNIE w tym pliku testowym** (`vi.doMock`,
   jak reszta tego pliku). **Jeżeli naprawa wymagałaby zmiany globalnego mocka
   albo configu vitest — STOP (Z18), bez usuwania pliku.**

   Nagłówek pliku `batch7` (`:9`) wymienia `assessment/assessments.routes.ts
(11 catch blocks)` — **zaktualizuj komentarz nagłówka**, żeby nie kłamał.

4. **Usunięcie montażu.** Jeżeli `grep` z pkt 1 pokaże import/montaż usuwanego
   pliku w `Gateway.ts` — usuwasz **dokładnie te dwie linie** i nic więcej
   (wąska licencja z §0.2). Jeżeli montażu nie ma (plik jest w pełni osierocony)
   — **nie dotykasz `Gateway.ts` w ogóle** i piszesz to w raporcie.

5. **DoD §C.2:** pięć warunków §C.0 · tabela jedenastu semantyk z odpowiednikami
   · dowód nazwy pliku (`grep` w `Gateway.ts` przed `git rm`) · blok `batch7`
   przepięty na żywy hub i **zielony** · asercje braku wycieku nietknięte ·
   nagłówek `batch7` zaktualizowany · `prettier` · commit osobny.

---

## §D. CZYTELNA NAZWA SESJI W KONTRAKCIE RAPORTU (mała pozycja, ale z zębami)

### D.0 — Skąd się bierze i czego dotyczy

Dyżur nr 27 zbudował ekran raportu 7 rozdziałów. W jego raporcie
(`ASSESSMENT_REPORT_FRONT_DAY27_REPORT_20260826.md`, sekcja „Ekran i parytet
kontraktu") stoi jedno zdanie, które jest zamówieniem na tę pozycję:

> „Ewentualna nazwa sesji/klienta poprawiłaby breadcrumb, ale nie została
> wyliczona ani dopisana do serwera (`BRAK_W_KONTRAKCIE`)."

Skutek dla właściciela jest prosty: **w okruszku nawigacji stoi surowe
`session-…`** — identyfikator techniczny na twarzy produktu. Front nie ma jak
tego naprawić sam, bo **kontrakt nie niesie żadnej nazwy**.

**Zakres: JEDNO nowe pole. Nic więcej.** To jest najmniejsza pozycja tego
dyżuru i ma taka zostać.

### D.1 — Gdzie leży zmiana (i gdzie NIE leży)

- **Zmiana jest w serwisie:** `server/src/services/assessment/assessmentReportContractService.ts`
  (168 linii; zapytanie `:20-28`, koperta `:87-93`).
- **Zmiany NIE MA w trasie.** `server/src/routes/method-core.routes.ts:532-547`
  tylko przekazuje `reportContract` z serwisu. **Ten plik jest w Z16 —
  CZYTASZ, nie zmieniasz.** Jeśli uważasz, że musisz go zmienić — **STOP**.
- **Zmiany NIE MA w bazie.** Obie potrzebne kolumny istnieją:
  `method_sessions.project_id` (`20260813_method_core_1_kernel.sql:58`, `TEXT`,
  `NULL` dozwolony, **bez FK**) i `projects.name` (`000_z_core_baseline.sql:156`,
  `TEXT NOT NULL`). **Nie dodajesz kolumny `name` do `method_sessions`** — to
  byłby nowy, niewypełniany przez nikogo kontrakt zapisu (§0.3, §1.4).

### D.2 — Kontrakt pola

Do koperty (`:87-93`), obok `methodVersion`, dochodzi **jedno pole**:

```ts
sessionLabel: {
  displayName: string | null; // nazwa projektu, org-scoped; null gdy nie ma czego nazwać
  source: 'project' | null; // co wyprodukowało displayName; null gdy displayName === null
  projectId: string | null; // powiązanie, które znamy — nawet gdy nie umiemy go nazwać
}
```

**Cztery reguły, wszystkie obowiązkowe:**

1. **`displayName` = `projects.name`**, pobrane zapytaniem **org-scoped**:
   `SELECT name FROM projects WHERE id = ? AND organization_id = ?`.
   **Filtr organizacji jest obowiązkowy**, choć sesja jest już org-scoped —
   to jest obrona w głąb, a w tej sesji programu **cztery różne routery** miały
   dziurę dokładnie tej klasy (`DEC-135/136/140`, `DEC-128`).
2. **Sesja bez projektu** (`project_id IS NULL`) → `{ displayName: null,
source: null, projectId: null }`. To jest **uczciwy pusty stan**, nie błąd.
3. **`project_id` jest, ale wiersz nie istnieje albo należy do obcej organizacji**
   → `{ displayName: null, source: null, projectId: '<to-id>' }`. Znamy
   powiązanie, nie umiemy go nazwać — i mówimy to wprost. **Nigdy nie
   zwracasz surowego id jako `displayName`** — to jest dokładnie ta brzydota,
   na którą właściciel narzekał.
4. **★ ZERO ZMYŚLANIA.** Nie generujesz `"Sesja 1"`, `"Ocena DRD"`,
   `"Assessment " + data` ani żadnej innej syntetycznej nazwy. `null` jest
   poprawną odpowiedzią; wymyślona nazwa jest atrapą (Z22, DoD pkt 1).

### D.3 — Addytywność: co dokładnie znaczy „nie łamiesz konsumentów"

1. **`contractVersion` ZOSTAJE `'assessment-report-contract-v1'`.** Nie podbijasz
   go, nie dodajesz `-v2`, nie dopisujesz sufiksu.
2. **Żadne istniejące pole nie zmienia nazwy, typu ani wartości.** Wszystkie
   siedem rozdziałów, `outputId`, `revision`, `generatedAt`, `methodVersion`,
   `skips[]` — bajt w bajt jak dziś.
3. **Nowe pole jest na TOP LEVELU koperty**, nie wewnątrz `chapters` (tam jest
   per oś, a nazwa sesji jest jedna).
4. **Konsument istniejący nie zauważy zmiany** — dodatkowe pole w JSON-ie jest
   ignorowane przez interfejs TypeScriptu, który go nie deklaruje.

### D.4 — Testy (minimum PIĘĆ, realny PG, realna trasa)

Nowy plik `server/src/services/assessment/__tests__/day29.reportContractLabel.pg.test.ts`
albo `tests/integration/routes/assessment.day29.report-contract-label.postgres.integration.test.ts`
(wtedy `git add -f`). Realna trasa `GET /api/method/sessions/:sessionId/assessment-report-contract`,
realny JWT, realny PG:

1. **happy** — sesja z `project_id` wskazującym istniejący projekt tej samej
   organizacji → `sessionLabel.displayName === '<nazwa projektu>'`,
   `source === 'project'`, `projectId === '<id>'`;
2. **bez projektu** — sesja z `project_id IS NULL` → wszystkie trzy pola `null`;
3. **wiszące powiązanie** — `project_id` wskazuje na nieistniejący wiersz →
   `displayName === null`, `source === null`, `projectId === '<to-id>'`;
4. **★ negatyw tenanta** — projekt **zaseedowany w obcej organizacji**, sesja
   we własnej → `displayName === null` (nazwa cudzego projektu **nie może**
   wyciec), `projectId` zachowany;
5. **★ regresja kształtu** — pełna asercja, że `contractVersion` jest nadal
   `'assessment-report-contract-v1'`, jest **dokładnie 7 rozdziałów**, a wszystkie
   pola istniejące (`outputId`, `revision`, `generatedAt`, `methodVersion`,
   pierwsza oś z `matrix.areas` i `areaComments`) **mają te same wartości co
   przed zmianą**. Wartości bierzesz z przebiegu **przed** commitem, nie z głowy.

**Dodatkowo obowiązkowo:** uruchom istniejące testy kontraktu raportu (dnia 20
i 25) i pokaż, że **wszystkie pozostają zielone**. Kontrakt raportu jest
odebrany decyzją `DEC-122` — Twoja zmiana nie może w nim niczego ruszyć.

### D.5 — Dowód osiągalności (Z20)

```
GET /api/method/sessions/<id>/assessment-report-contract   (realny klient HTTP)
  → montaż /api/method w server/src/Gateway.ts (podaj plik:linia — ZMIERZ SAM)
  → middleware routera method-core
  → handler server/src/routes/method-core.routes.ts:532
  → serwis server/src/services/assessment/assessmentReportContractService.ts:build
  → odczyt method_sessions(project_id) + projects(name), oba org-scoped
  → koperta res.json({ reportContract }) — method-core.routes.ts:543
  → ODCZYT frontowy: src/method-core/api/methodCoreApi.ts (gałąź dnia 27, NIESCALONA)
```

**★ Ostatnie ogniwo nazywasz uczciwie:** konsument frontowy **istnieje, ale
w gałęzi dnia 27, która nie jest scalona z Twoją bazą**. Piszesz to wprost:
„ostatnie ogniwo = koperta HTTP na moim markerze; konsument
`AssessmentReportContractView` żyje w niescalonej gałęzi dnia 27". **NIE
dopisujesz go i NIE zaglądasz do tamtej gałęzi, żeby coś dopasować** — masz
dostarczyć pole zgodne z §D.2, a nie z cudzym, niescalonym kodem.

### D.6 — ★ STOP, gdyby wersję trzeba było podbić

Gdybyś doszedł do wniosku, że dodanie pola **wymaga** podbicia
`contractVersion` (np. bo znajdziesz w repo konwencję, która tego wymaga):

**NIE PODBIJASZ. ROBISZ STOP Z PROPOZYCJĄ.** Powód jest zmierzony:

`src/method-core/api/methodCoreApi.ts` (gałąź dnia 27) sprawdza wersję
**równością dosłowną**:

```ts
if (response.reportContract.contractVersion !== 'assessment-report-contract-v1') {
  throw new MethodCoreApiError('Unsupported assessment report contract version', 200, { ... });
}
```

To **nie jest ostrzeżenie i nie jest degradacja** — to **rzucony wyjątek zamiast
ekranu raportu**. Podbicie wersji po Twojej stronie **wywaliłoby świeżo
zbudowany ekran właściciela**, i to w sposób, którego nie widać w żadnym teście
serwerowym. Wpis STOP musi zawierać: powód podbicia, dokładny cytat z walidacji
frontowej, i propozycję (np. „front musi najpierw przejść na porównanie
`startsWith`/listę akceptowanych wersji — to zadanie frontowe, nie moje").

### D.7 — DoD §D

Pole dodane addytywnie · `contractVersion` **niezmieniony** (dowód: asercja
w teście 5) · zapytanie o projekt **org-scoped** (dowód: test 4) · `null`
w trzech uczciwych przypadkach, **zero zmyślonych nazw** · 5 testów na realnym
PG i realnej trasie · istniejące testy kontraktu (dni 20/25) zielone · dowód
osiągalności z uczciwie nazwanym ostatnim ogniwem · `prettier` · commit osobny.

---

## §R.1 — `MODULE_ACCEPTANCE.md` 04_ASSESSMENT

1. Plik: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`
   (144 linie na markerze). **To jedyny dokument poza raportem, który wolno Ci
   zmienić** (Z12).
2. **★ NIE PODNOSISZ BRAMKI MODUŁU.** Nagłówek `Current gate: EXPERT_NO_GO /
OWNER_REVIEW_IN_PROGRESS / FULL_PRODUCT_REMEDIATION_REQUIRED` **zostaje**.
   Ten dyżur nie zamyka ani jednego z trzech zarzutów `DEC-103` w całości.
3. **Aktualizujesz WYŁĄCZNIE to, co dowiozłeś, i ZAWSZE Z MIANOWNIKIEM.**
   Wzorzec z `DEC-124`: „24/83, 28,9%", nie „znacząca poprawa". Dla tego dyżuru
   mianowniki są oczywiste i masz je podać: **ile z 26 tras AI odróżnia trzy
   stany** (spodziewane: 11/26, i **napisz wprost, dlaczego pozostałe 15 nie —
   §B.5**), **ile martwych plików tras zostało** (przed/po), **czy kontrakt
   raportu niesie nazwę sesji**.
4. **Nie przepisujesz historii.** Wiersze `G00`–`G20` z werdyktami z odbiorów
   właściciela **zostają**; dopisujesz do „Evidence/decision" odnośnik do
   swojego raportu tam, gdzie faktycznie zmieniłeś stan.
5. **Nie dopisujesz `PASS` nigdzie**, gdzie nie masz dowodu oczami właściciela.
   Werdykty wizualne są własnością Piotra, nie Twoją (CLAUDE.md reguła 4/7).

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz)

Wszystkie dziesięć punktów BLOKU 0, po kolei. **Kolejność Z19: kontener
i migracje PRZED jakimkolwiek pomiarem.** Bez baseline'u (pkt 9) cały raport
jest nieweryfikowalny.

### Blok 1 — tanie i pewne (§D)

**§D robisz PIERWSZE, a nie ostatnie.** Jest najmniejsze, dotyka pliku, którego
nikt inny w tym dyżurze nie rusza, i **domyka konkretną prośbę z odbioru dnia 27**
— czyli ma najwyższy stosunek wartości do ryzyka. Jeżeli dyżur skończy się
wcześniej, niż zakładasz, to właśnie ta pozycja ma być gotowa.

### Blok 2 — czystka (§C.1 → §C.2)

Obie pozycje są mechaniczne i **przewidywalne**, pod warunkiem że najpierw
wykonasz pięć warunków §C.0. Rób je **przed** §A/§B, bo zmniejszają powierzchnię
pliku, którą później mierzysz w §0.4a.

### Blok 3 — semantyka (§B.1 → §B.2 → §B.3 → §B.4)

**Kolejność wewnątrz §B jest wiążąca.** Najpierw źródło sygnału (`B.1`), potem
handlery (`B.2`), potem klasa awarii (`B.3`), na końcu aktualizacja
charakteryzacji (`B.4`). Odwrócenie kolejności zamieni awarię bazy w `404`.

### Blok 4 — typy (§A.1 → §A.3 przed → §A.2 → §A.3 po)

**BUDŻETOWANE, 90 minut, próg 60.** Robisz to **na końcu pracy kodowej**, bo
jest to jedyna pozycja, która może się skończyć uczciwym STOP-em, i nie chcesz,
żeby zabrała czas pozycjom, które kończą się na pewno.

**★ Wyjątek od tej kolejności:** jeżeli §A i §B miałyby dotknąć tych samych
linii (mało prawdopodobne — §A rusza serwis, §B trasy), rozstrzyga §B.

### Blok 5 — domknięcie (obowiązkowo, ~90 min)

1. Pełny pomiar §0.4a na `HEAD` (drugi przebieg), z rozbiciem ZASTANE/WPROWADZONE.
2. `R.1` — `MODULE_ACCEPTANCE.md` z mianownikami.
3. Raport `ASSESSMENT_DAY29_REPORT_20260827.md` wg szablonu §9.
4. `prettier` na wszystkim, `git status --porcelain` czysty.
5. Sprzątanie kontenera i wolumenów (BLOK 0 pkt 10).
6. Ostatnie sprawdzenie: `git diff --name-only «MARKER_SHA»...HEAD | grep -E '^(src|dev-render|public)/'`
   **MUSI być PUSTE.**

### Zasada nadrzędna kolejności

**Lepiej trzy pozycje `ZROBIONE_WG_DoD` i jedna `STOP` z licznikiem, niż cztery
`CZĘŚCIOWO` bez dowodów.** Dzień 24 dostał zero `ZROBIONE_WG_DoD` właśnie za
to, że rozmienił się na częściowe. `DEC-138` zganił dzień 25 **nie za STOP,
tylko za nieuczciwy powód STOP-u**.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka (dosłownie, jeden plik, Z12):
`docs/program/waves/WAVE_03_ACCEPTANCE/ASSESSMENT_DAY29_REPORT_20260827.md`

### 9.1. Szablon

```markdown
# Assessment dzień 29 (blok 3 — serwerowy) — raport dyżuru <data>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<czy katalog /Users/piotrwisniewski/Developer/Consultify był dotykany; jedyny kontakt = symlink node_modules>

## ★ Oświadczenie o zakresie src/ (★ ograniczenie krytyczne)

git diff --name-only «MARKER_SHA»...HEAD | grep -E '^(src|dev-render|public)/'
→ <MUSI być PUSTE; wklej dosłownie>

## ★ Kolizje z dniami 25/27/28 (§0.1 pkt 4)

DAY25 MERGED / NOT MERGED: <wynik> ← NOT MERGED = STOP całego dyżuru
DAY27 MERGED / NOT MERGED: <wynik>
Pliki dnia 27 poza src/dev-render/public/docs: <lista albo BRAK>
Pliki dnia 28 kolidujące z moim zakresem: <lista albo BRAK>

## Marker: «MARKER_SHA» — POTWIERDZONY / BRAK

<wynik obu komend; przy rozejściu: git log «MARKER_SHA»..codex/m03-admin-20260824 + lista plików>

## ★ Dowód celu połączenia (Z19)

<dosłowny wynik SELECT current_database(), inet_server_port() + docker port cx-day29-pg>
Migracje: przebieg 1 <N> / przebieg 2 <0> / dry-run Pending <0>
Port: 5511 (albo <inny> — powód). Kontener cx-day29-pg usunięty: TAK/NIE. Wolumeny: <wynik>

## ★ WERYFIKACJA ERRATY §1.2 — dwanaście punktów

| # | Komenda, którą uruchomiłem | Wynik | Zgodne z §1.2? | Skutek |
<dwanaście wierszy; „POTWIERDZONE" bez komendy = wpis niewykonany>

## ★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW (BLOK 0 pkt 8)

| # | Metoda + ścieżka | linia | dotyka bazy? | konsument w src/ albo BRAK KONSUMENTA |
Trzy liczby: tras AI <N>, dotyka bazy <N>, ma konsumenta <N>

## Warunki wstępne — tabela

<wszystkie grep/sed/wc z §0.1 pkt 5, wynik vs oczekiwany>

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit | Dowód osiągalności | Dowód testowy |
| §A.1 | | | | |
| §A.2 | | | | |
| §A.3 | | | | |
| §B.1 | | | | |
| §B.2 | | | | |
| §B.3 | | | | |
| §B.4 | | | | |
| §C.1 | | | | |
| §C.2 | | | | |
| §D | | | | |
| §R.1 | | | | |
Statusy dozwolone: ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · BRAK_API · NIEZACZĘTE

## ★ §A — TYPY PARTNERA AI

### A.1 — DWIE KONFIGURACJE, dwie komendy, dwa rozbicia

| Konfiguracja | Komenda (dosłownie) | Suma | Rozbicie po kodach |
| domyślna | | | |
| projektu | | | |
Zgodność z §1.2 poz. 4 (135 / 203): <TAK / korekta + moja liczba>

### A.2 — jak zdjąłem @ts-nocheck

Trzy pola klasy: <jakie typy, ile błędów zdjęły>
Interfejsy kontekstu: <lista>

### ★ LICZNIK any / as any / @ts-expect-error / ! — PRZED i PO

### Zmiany zachowania: ZERO / <lista — każda pozycja = odrzucenie>

### A.3 — tabela „przed/po" ciał odpowiedzi (≥4 trasy)

### Budżet: <minuty>, próg 60 min przekroczony: TAK/NIE

## ★ §B — SEMANTYKA TRAS AI

### B.1 — jak getAssessmentData sygnalizuje trzy stany (kształt + uzasadnienie)

### ★ Decyzja: obcy i nieistniejący projekt dostają IDENTYCZNĄ odpowiedź — i dlaczego to jest poprawne

### B.2 — tabela: stan → kod HTTP → code → tekst PL

### B.2 — które z 11 handlerów zmienione, które trasy przetestowane (≥3)

### ★ DOWÓD MUTACYJNY (git stash): dosłowny stdout PRZED naprawą i PO

### B.3 — dowód, że awaria bazy daje 503, nie 404 i nie 200; dowód braku wycieku wnętrza

### B.4 — TABELA „PRZED/PO" dla assessmentAiPartner.day25.pg.test.ts (każda zmieniona linia)

### B.5 — piętnaście handlerów bez bazy: tabela + dlaczego NIE ruszone (cytat z batch7)

### org-default: usunięte w <N> handlerach / zostawione — dowód

## ★ §C — CZYSTKA

### Pięć warunków §C.0 — per pozycja, dosłownie

### C.1 — grep repo-wide per handler (dosłownie, 6 handlerów)

### C.1 — ★ grep -c -i assessment demoPrincipalGuard.ts = <MUSI być 0>

### C.1 — publicDemoWriteAllowlist.test.ts PRZED / PO: <identyczne?>

### C.1 — blok batch6 :220-276: USUNIĘTY JAKO DUPLIKAT / PRZEPIĘTY — dowód równoważności linia po linii

### C.1 — różnica czasownika DELETE(v1) vs POST(v2) na cancel: skutek i dlaczego nieistotny

### C.1 — test ocalałych tras v1 (≥6 żywych + 6 usuniętych = 404)

### C.2 — dowód nazwy pliku: grep w Gateway.ts PRZED git rm

### C.2 — tabela jedenastu semantyk (handler → odpowiednik żywy + montaż → werdykt)

### C.2 — blok batch7 :36-78 przepięty na assessment-hub: tabela „przed/po" + wynik przebiegu

### C.2 — czy demoContextMiddleware wymagał lokalnego mocka: TAK/NIE + jak

## ★ §D — NAZWA SESJI W KONTRAKCIE

### Kształt pola (dosłowny fragment koperty)

### Dowód, że contractVersion NIE zmieniony (asercja + wynik)

### Zapytanie o projekt — dosłowny SQL z filtrem organizacji

### Cztery przypadki (projekt / brak projektu / wiszące id / obca org) — wyniki

### Regresja kształtu: 7 rozdziałów + pola istniejące bez zmian (przed/po)

### Istniejące testy kontraktu dni 20/25: <wynik>

### Dowód osiągalności + uczciwe nazwanie ostatniego ogniwa (konsument w niescalonej gałęzi dnia 27)

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik

### ★ h64-failsoft-batch6: moja liczba <N/N> — potwierdza DEC-138 (18/18) czy raport dnia 25 (16/18)?

### Czerwone WPROWADZONE przez dyżur + SHA commitu, który je zapalił

### Testy zmienione / osłabione — TABELA „przed/po" (trzy pliki z §0.4a pkt 7)

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

## ★ Pakiet testów DOMYŚLNEGO OKABLOWANIA (Z21)

<które testy montują realny router + realne middleware; każdy mock poza Logger.js z uzasadnieniem>

## ★ Dowód braku atrapy (Z22)

<dowód, że po naprawie nie ma odpowiedzi 200 z treścią dla oceny, której nie ma w bazie>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## Znaleziska (NIE naprawiane przeze mnie)

<m.in.: 15 tras AI z dekoracyjnym :projectId; 12× org-default; martwy barrel routes/index.ts;
pozostałe @ts-nocheck w server/src/services/; cokolwiek ujawniło typowanie w §A>

## Korekty wobec instrukcji

<każda rozbieżność wobec §1.2/§1.7 — Twoja liczba jest prawdziwa>

## Migracje

<numer, dowód ls|grep, przedział 20261180-89, addytywność, idempotencja, MIGRATION_PREPARED —
albo „ŻADNE, i dlaczego">

## Licznik

<11 pozycji: domknięte / częściowe / STOP / BRAK_API / niezaczęte; flagi NIE włączone; bramka modułu NIE podniesiona>

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Liczba bez komendy, która ją wyprodukowała, jest bezwartościowa.** To jest
   dosłowna lekcja `DEC-138`: raport dnia 25 podał „31→27", rejestr „32→28",
   obie liczby były prawdziwe i **nikt nie umiał tego rozstrzygnąć bez ponownego
   pomiaru**. Każda liczba w Twoim raporcie ma obok siebie komendę.
2. **„POTWIERDZONE" bez dowodu = wpis niewykonany.** Dzień 25 „potwierdził"
   erratę o allowliście, nie sprawdziwszy jej, i fałsz poszedł do rejestru decyzji.
3. **Nie zawyżasz statusów.** `ZROBIONE_WG_DoD` tylko przy komplecie dwunastu
   punktów §0.4. Wszystko inne to `CZĘŚCIOWO` z wyliczeniem braków.
4. **Nie zawyżasz zastanej czerwieni.** To jest sposób na wyglądanie lepiej niż
   się jest — i `DEC-138` złapał go w dniu 25 (`16/18` vs realne `18/18`).
5. **Nie piszesz „wyciek", „bezpieczeństwo", „P0"** o znalezisku z §B. Klasa jest
   ustalona decyzją: **KONTRAKT/UX**.
6. **Uczciwy STOP jest wynikiem, nie porażką.** Nieuczciwy STOP jest porażką.
7. **Piszesz po polsku**, zwięźle, tabelami. Bez emoji.

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki>

# typy punktowo (esbuild TRANSPILUJE, nie typuje — nie złapie błędu typu!)
npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null

# ★ JEDYNE miejsce z tsc — POZYCJA §A, z filtrem do jednego pliku
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --lib ES2022 --strict --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck \
  server/src/services/aiAssessmentPartnerService.ts

# test celowany BEZ bazy
npx vitest run <plik>

# ★ test celowany Z bazą — ZAWSZE PIĘĆ ZMIENNYCH W TEJ SAMEJ LINII (Z19)
DATABASE_URL="postgres://postgres:cx@localhost:5511/cx_day29" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>

# numeracja migracji — PRZEDZIAŁ 20261180-20261189, PRZED KAŻDYM NOWYM PLIKIEM
ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
ls server/migrations | grep '^2026118'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day29-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day29 \
  -p 5511:5432 pgvector/pgvector:pg16
docker rm -f cx-day29-pg && docker volume prune -f

# ★ grep osiągalności — ZAWSZE po CAŁYM repo, nigdy tylko po src/ (Z20)
grep -rn "<symbol>" server/src src tests

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/routes/assessment.day29.*.postgres.integration.test.ts

# komenda bazowa (NIE do HEAD~1)
git diff --name-only «MARKER_SHA»...HEAD

# ★ OSTATNIE SPRAWDZENIE PRZED ODDANIEM — MUSI BYĆ PUSTE
git diff --name-only «MARKER_SHA»...HEAD | grep -E '^(src|dev-render|public)/'
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. Wejść do `src/` „na jedną linię" → konflikt z niescaloną gałęzią dnia 27.
2. Usunąć `assessment.routes.ts` zamiast `assessments.routes.ts` (jedna litera).
3. Dopisać sprawdzenie bazy do `suggest-justification` → wywalony `batch7`.
4. Zamienić awarię bazy w `404` (kolejność §B.1 → §B.2 → §B.3 jest wiążąca).
5. Zdjąć `@ts-nocheck` rozsypując `any` (licznik `any` = warunek pozycji).
6. Zmienić coś w `initializeAI()` przy okazji typowania (Z14).
7. Usunąć blok `describe` z `batch6`/`batch7` bez żywego odpowiednika.
8. Dotknąć `demoPrincipalGuard.ts` na podstawie obalonej tezy dnia 25.
9. Podbić `contractVersion` w §D → rzucony wyjątek zamiast ekranu raportu.
10. Zwrócić surowe `projectId` jako `displayName` (to jest ta sama brzydota,
    na którą właściciel narzekał).
11. Uruchomić test DB bez `MOCK_DB=false` → pomiar jest fikcją.
12. Zaraportować pakiet w całości `SKIPPED` jako `PASS` (Z23).

### 10.3. Czego NIE robisz, choć „aż się prosi"

- Nie podłączasz `useAssessmentAI` do żadnego komponentu.
- Nie zdejmujesz `@ts-nocheck` z drugiego, trzeciego i czwartego pliku.
- Nie naprawiasz `routes/index.ts`.
- Nie dodajesz `name`/`title` do `method_sessions`.
- Nie naprawiasz zastanych czerwonych w `src/components/assessment/**`.
- Nie zmieniasz `contractVersion`, nie dodajesz drugiego pola do koperty §D.
- Nie ruszasz walidacji skali `target_level` (zrobiona, `DEC-139`).
- Nie „poprawiasz" tekstów po polsku w kopertach błędów, których nie dodałeś.

---

## 11. NA KONIEC

Ten dyżur nie zbuduje właścicielowi nowego ekranu i nie podniesie oceny modułu
z 4,0. Zrobi trzy rzeczy mniejsze i trwalsze:

1. **Plik, który obsługuje 26 tras „AI-native", przestanie być niewidoczny dla
   kompilatora** — albo dostanie uczciwy licznik długu, jeśli budżet nie
   wystarczy.
2. **Produkt przestanie odpowiadać `200` z wygenerowaną treścią na pytanie
   o ocenę, której nie ma.** To jest dokładnie ta klasa kłamstwa, którą program
   ściga od `DEC-104` do `DEC-140`.
3. **Dwa martwe pliki tras znikną, a ich cudze testy wylądują na żywym kodzie** —
   czyli pokrycie wzrośnie przy okazji sprzątania.

Plus jedno małe pole, dzięki któremu w okruszku nawigacji przestanie stać
`session-…`.

**I jedna rzecz ważniejsza od wszystkich czterech: masz obowiązek obalić ten
dokument, jeżeli kod mówi co innego.** Dzień 25 przyjął erratę autora instrukcji
na wiarę, „potwierdził" ją bez sprawdzenia, i fałsz przeszedł przez raport do
rejestru decyzji, gdzie musiał go łapać nadzorca (`DEC-138`). **Wpis
„POTWIERDZONE" bez komendy w raporcie jest traktowany jak wpis niewykonany.**
