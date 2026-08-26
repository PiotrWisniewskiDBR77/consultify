# INSTRUKCJA DYŻURU nr 19 — Codex — „Meetings BLOK 2: DOKOŃCZENIE — materializacja notatki OPCJĄ B, PEŁNA edycja serii (to / to i następne / wszystkie), artefakty spotkania z bezpiecznym resolverem dostępu, pełna macierz ról na realnym routerze, testy WSZYSTKICH nowych tras"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–18. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **drugim blokiem dyżuru nr 16**. Dyżur nr 16 został odebrany
i **SCALONY** (`DEC-2026-08-26-92`), ale jego własny raport zamknął się
deklaracją **`ZASIĘG CZĘŚCIOWY`**. Ten dyżur robi **resztę tamtego zakresu** —
nic więcej i nic mniej.

**Definicje pozycji H/U/C/I/G są wiążące z instrukcji dnia 16** i nie są tu
przepisywane w całości. Masz ją w repo, na swojej bazie:

```
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY16_MEETINGS_FINAL_INSTRUKCJA.md   (1552 linie)
```

Czytasz z niej: §H.1–H.4, §U.4, §U.5, §C.1–C.2, §G, §T, §R oraz mapę techniczną
§2. **Ta instrukcja nadpisuje dzień 16 wszędzie tam, gdzie mówi inaczej** —
w szczególności w §H.1 (opcja B, rozstrzygnięcie nadzorcy), w numeracji migracji,
w portach, w bezpiecznikach (nowy **Z19**) i w zakresie (front wypadł).

Drugi dokument, który czytasz przed startem — raport dnia 16, bo opisuje stan
faktyczny bazy, na której startujesz:

```
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_20260826.md
```

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Moduł Meetings jest dziś ZAMKNIĘTY dla ról klienckich i po Twoim dyżurze
nadal ma być zamknięty. Otwarcie wykonuje nadzorca, po odbiorze, jedną zmianą
konfiguracji — nie Ty.**

1. **NIE zmieniasz `MODULE_MEETING: 'closed'`** (`src/utils/betaAccess.ts`) na
   `'open'`. NIE usuwasz `MODULE_MEETING` z listy zablokowanych
   (`src/utils/pilotAccess.ts`). NIE odmontowujesz `closedBetaModuleGate`
   (`server/src/routes/meeting.routes.ts`, `router.use(...)` — **linia 238**
   w chwili wystawienia). Twoim produktem w `G.2` jest **przetestowana macierz**
   obu stanów, nie samo otwarcie.
2. **Nie powstaje żadna nowa flaga funkcyjna.** Zero. Jeżeli uznasz, że
   potrzebujesz flagi — to jest **STOP**, nie improwizacja (CLAUDE.md reguła 9).
3. **Wszystko, co budujesz, musi być realne.** Kontrolka bez działania = STOP,
   nigdy „na razie zostawiam". Brak API → wpis `BRAK_API`, nie przycisk-widmo.
4. **★ ZERO REALNYCH MAILI — strażniki dnia 16 są NIETYKALNE.** Dzień 16 zbudował
   i odebrał strażników `captured` (dev/test bez `MEETING_INVITES_LIVE`) oraz
   `blocked_demo` (org == `DEMO_ORG_ID`), oba **przed** wywołaniem mailera,
   z dowodem `vi.spyOn(emailService,'send')` + `not.toHaveBeenCalled()`
   (FIX-6). §C.2 każe Ci dotknąć ścieżki wysyłki (aktualizacja/odwołanie
   zaproszenia przy edycji serii). **Po Twojej zmianie te testy mają dalej
   przechodzić bez osłabienia asercji.** Osłabienie = odrzucenie dyżuru.
5. **★ DEC-65 — dane demo są chronione, wspólna baza jest święta.** Zero
   Railway, zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo,
   zero realnych wysyłek e-mail. Migracje = `MIGRATION_PREPARED`, addytywne,
   kompatybilne wstecz z zamrożoną bazą demo, z dowodem idempotencji na
   **jednorazowym lokalnym kontenerze**.
6. **★ FRONT NIE JEST TWOIM ZAKRESEM.** UI uczestników, UI serii (modal trzech
   zakresów), UI załączników, chipsy statusu — **robią robotnicy wewnętrzni po
   prototypie i akcepcie właściciela** (formuła polerowania grafiki, CLAUDE.md
   reguła 7). Prawy panel karty jest już scalony i też nie jest Twój. Ty budujesz
   **TYŁ**: dane, kontrakty API, semantykę zapisu, testy. Podział FRONT/TYŁ jest
   twardy — patrz §1.6.
7. **Odbiór wizualny = nadzorca, po dyżurze.** W raporcie piszesz „gotowe do
   zrzutu przez nadzorcę", **nigdy** „gotowe do pokazania właścicielowi" ani
   „gotowe do otwarcia modułu".
8. **★ Migracja PRZED kodem — reguła wdrożeniowa `DEC-2026-08-26-92`.** Kod tras
   day16/day19 **nie** tworzy tabel leniwie (`ensureMeetingTables` ich nie zna),
   a odczyty mają `fallback:false`, więc brak migracji to **głośny błąd**, nie
   pusta lista. Twoje nowe tabele/kolumny trzymają tę samą regułę.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**
   (niesie scalony dzień 10, scalony dzień 16 wraz z FIX-ami 1–9, oraz
   rozstrzygnięcia DEC-95/96). Nadzorca podaje Ci **SHA commitu-markera** przy
   wklejaniu tej instrukcji.

   **SHA markera: 315adbb83b**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor 315adbb83b codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/meetings-day16-*` ani `codex/day16-fixes-*`.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. Rebase
   w trakcie dyżuru: **ZAKAZANY**.

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).** Ten
   dyżur zakłada, że dzień 10 **i** dzień 16 są w Twojej bazie. Sprawdzasz sam;
   wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) dzień 10 — strukturalne decyzje/follow-upy + parametryzowana bramka G.1
   ls server/migrations/ | grep -i "meetings_day10_decisions"          # oczekiwane: 20260826_meetings_day10_decisions.sql
   grep -n "decision-records\|follow-up-records" server/src/routes/meeting.routes.ts | head
   grep -n "createModuleGate" server/src/middleware/betaGate.middleware.ts

   # (b) dzień 16 — model kalendarza, uczestnicy, wysyłka, ICS
   ls server/migrations/ | grep -i "meetings_day16"                    # oczekiwane: 20261075_meetings_day16_calendar_participants.sql
   ls server/src/services/meeting/                                     # oczekiwane: meetingDay16Service.ts, meetingInvitationService.ts
   ls server/src/utils/ics/                                            # oczekiwane: icsBuilder.ts
   grep -n "participants\|invitations/send" server/src/routes/meeting.routes.ts | head

   # (c) FIX-y dnia 16, których NIE WOLNO cofnąć
   grep -n "fallback: false" server/src/services/meeting/meetingDay16Service.ts | head
   grep -n "blocked_demo\|captured" server/src/services/meeting/meetingInvitationService.ts | head
   grep -n "recurrenceRule\|FREQ" server/src/routes/meeting.routes.ts | head
   ```

   **Brak (a) lub (b) = STOP całego dyżuru** — pracujesz na złej bazie. Brak (c)
   przy obecnym (b) = STOP z opisem (ktoś cofnął odebrane FIX-y).

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md      # oczekiwane 148
   grep -n "DEC-2026-08-26-82" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # :134
   grep -n "DEC-2026-08-26-87" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # :139
   grep -n "DEC-2026-08-26-92" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # :144
   grep -n "DEC-2026-08-26-95\|DEC-2026-08-26-96" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # :147, :148
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY16_MEETINGS_FINAL_INSTRUKCJA.md  # oczekiwane 1552
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_20260826.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md        # oczekiwane 102
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestr rośnie) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z tego tipa (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/meetings-day19-<data> 315adbb83b
   git worktree add /private/tmp/consultify-meetings-day19 codex/meetings-day19-<data>
   cd /private/tmp/consultify-meetings-day19
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/meetings-day19-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/meetings-day16-*`, `codex/day16-fixes-*`, `codex/meetings-rightpanel-*` | `demo` = święta baza; tamte gałęzie są historią odebraną |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; DEC-95 |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| **Z5** | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0 | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-day19-instrukcja`, `consultify-meetings-day16*`, `consultify-day16-fixes`, `consultify-day17*`, `consultify-day18*`) | Cudze worktree, część w użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych** (3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300/4301/4302, 4304/4305, 4306, 4312, 4319, 4370, 4418, 4428, 4480/4481, 5447). **Twój kontener PG = 5449**; lokalny runtime, jeśli konieczny — **4324/4325**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | 4306/4319 zajął dzień 16, 5447 dzień 17 |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65) | Produkcja/demo poza zakresem |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB | „dane demo = twarz produktu" (DEC-65) |
| **Z10** | **Zero nowych flag. Zero zmian wartości domyślnej flagi. Zero zmian `MODULE_MEETING: 'closed'` → `'open'`. Zero odmontowania `closedBetaModuleGate`** | CLAUDE.md reguła 9 + ★ pkt 1 |
| Z11 | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/meetings/*` (`DEC-2026-08-24-07`) | Gramatyka zaakceptowana |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY19_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1` | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **Nie budujesz generowania treści modelem.** `generate-notes` i „Brief operatora" to powierzchnie nad istniejącymi serwisami. Nie podpinasz dostawcy modelu, nie włączasz przechwytywania (`capture`) | Silnik AI = moduł agenta, ostatni w programie |
| Z15 | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych** (`MeetingHub` rozróżnia błąd-briefu ≠ brak-briefu; `meetingService` odmawia fałszywego sukcesu przy nieznanym follow-upie; `fallback:false` z FIX-9 ma **zostać**) | Uczciwy pusty stan > udawany ekran |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts` poza jawnym zakresem `G.2`. Wolno **czytać** i **cytować** | Model uprawnień naprawiany in-house |
| **Z17** | **★ Zakaz wszystkiego poza modułem Meetings** — z imiennymi wyjątkami z ramki poniżej (WOŁANIE istniejących serwisów). Prawy panel karty, powłoka SPEC-A, cały front uczestników/serii/załączników: **NIE** | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6) |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| **Z19** | **★★ NOWY (rozstrzygnięcie `DEC-2026-08-26-96`) — ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego `DATABASE_URL` wskazującego kontener tego dyżuru; kolejność Bloku 0 = NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar wejściowy; do raportu obowiązkowy dowód celu połączenia (`SELECT current_database(), inet_server_port()`)** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie |

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**          (llmApi, server/database, node-cron, nodemailer, @google/generative-ai, aws-sdk-client-s3)
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka (**dotyczy zwłaszcza `nodemailer`
w §C.2**): **opt-in, nigdy globalnie** — `vi.mock` lokalnie w Twoim pliku
testowym albo dedykowany helper w **nowym** pliku importowanym tylko przez Twoje
testy. Nie dopisujesz do `tests/__mocks__/nodemailer`. Jeśli Twój test nie
przechodzi bez zmiany globalnego mocka — to **STOP**, nie zmiana globalnego
mocka.

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.** `server/src/database/Database.ts`
przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1` podstawia **mock DB** i cały pakiet
„przechodzi" przeciwko niczemu. Dodatkowo część odczytów w repo idzie przez
`DbPromise` z domyślnym `fallback:true`, więc brak tabeli potrafi udawać pustą
listę. Dlatego **każde** uruchomienie testu dotykającego bazy ma jawnie:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5449/cx_day19" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day19-pg psql -U postgres -d cx_day19 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (dosłowny) **jest obowiązkową pozycją raportu**. Pomiar bez
dowodu celu = pomiar nieistniejący.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/meeting.routes.ts
  server/src/services/meetingService.ts
  server/src/services/meetingBoundary/**                        (+ __tests__ obok)
  server/src/services/meeting/**                                (meetingDay16Service.ts, meetingInvitationService.ts, NOWE serwisy: occurrence, attachments, materialization)
  server/src/utils/ics/**                                       (icsBuilder.ts — rozszerzenia pod §C.2)
  server/migrations/<numer>_meetings_day19_*.sql                (NOWE pliki, numeracja wg §0.3)
  src/services/api.ts                                           (WYŁĄCZNIE dopisanie funkcji meeting* — plik współdzielony, ostrożnie)
  public/locales/{pl,en}/translation.json                       (TYLKO klucze meeting.* faktycznie potrzebne po stronie API/komunikatów)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY19_REPORT_20260826.md          (jedyny nowy dokument)
  tests/unit/meeting/**  ·  tests/integration/routes/meeting.*                     (NOWE pliki)

IMIENNE WYJĄTKI POZA MODUŁEM (wolno WOŁAĆ istniejące, NIE zmieniać ich kodu/schematu/UI):
  §H.1 — server/src/services/v8/artifactRegistryService.ts::registerArtifactOrigin        (WOŁASZ)
         server/src/services/v8/artifactRegistryService.ts::getArtifactByOrigin           (WOŁASZ — reconcyliacja przy ponowieniu)
         wave5ArtifactRuntimeService (wstawienie treści dokumentu)                        (WOŁASZ/wzorzec)
  §H   — server/src/services/artifactHandoff/handoffSpineService.ts::materializeProposal  (WOŁASZ; NIE zmieniasz)
  §H.2 — server/src/services/TaskService.ts::createTask                                   (WOŁASZ)
         server/src/services/initiative/createInitiativeService.ts::createInitiative      (WOŁASZ)
         wzorzec: server/src/services/myWork/agentApprovedMaterializationService.ts       (CZYTASZ jako wzorzec)
  §U.4 — server/src/services/v8/artifactRegistryService.ts::getArtifactForUser            (WOŁASZ — resolver dostępu dla kind='material')
  §C   — server/src/services/v8/recurrenceEngine.ts (materializeInstances/parseRRule/validateRecurrenceModel)  (WOŁASZ; NIE zmieniasz)
  §C.2 — server/src/services/emailService.ts::send                                        (WOŁASZ przez meetingInvitationService; NIE zmieniasz)
  §G.2 — server/src/middleware/betaGate.middleware.ts::createModuleGate                   (WOŁASZ z wstrzykniętym resolverem W TEŚCIE; NIE zmieniasz wartości domyślnych)

NIE WOLNO:
  CAŁY FRONT modułu: src/components/Meeting/**                  ← podział FRONT/TYŁ (§1.6) — robotnicy wewnętrzni po prototypie
  src/components/standard/**  ·  src/components/shared/**       ← WOLNO UŻYWAĆ, NIE ZMIENIAĆ
  powłoka SPEC-A karty + PRAWY PANEL (ArtifactRightPanel)       ← akcept DEC-54, panel już scalony
  src/components/MyWork/**
  server/src/services/artifactHandoff/handoffSpineService.ts    ← WOLNO CZYTAĆ i WOŁAĆ; zmiana = STOP
  server/src/services/v8/artifactRegistryService.ts             ← WOLNO CZYTAĆ i WOŁAĆ; zmiana = STOP (to był STOP dnia 16)
  server/src/services/v8/recurrenceEngine.ts                    ← WOLNO WOŁAĆ; zmiana = STOP
  server/src/routes/integrations/calendarIntegrations.routes.ts ← nie zmieniasz zachowania tej trasy
  server/migrations/20261075_meetings_day16_*.sql               ← SCALONA, TYLKO ODCZYT (nowe DDL = nowy plik)
  server/migrations/20260826_meetings_day10_decisions.sql · 20260623_meetings_baseline.sql · 20260912_claude_c_meeting_boundary.sql · 20260827_calendar_events.sql   ← TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                          ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(meetings): materialize approved note into Materials with explicit failed state (H.1)
  feat(meetings): honest handoff of action items to My Work and Initiatives (H.2)
  feat(meetings): two-way lineage between meeting note and material (H.3)
  feat(meetings): occurrence edit scopes this/this-and-following/all (C.1)
  feat(meetings): occurrence routes with invitation update and cancel (C.2)
  feat(meetings): meeting attachments with a safe access resolver (U.4)
  feat(meetings): server contracts feeding the meeting editor (U.5)
  test(meetings): full role matrix on the real router in both gate states (G.2)
  test(meetings): real-router coverage for every day16 and day19 route (T)
  docs(meetings): raise 08_MEETINGS acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**.
- **Typy punktowo** (`npx esbuild <plik> --loader:.tsx=tsx --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ `fallback:false` OBOWIĄZKOWO** na każdym `DbPromise` dotykającym tabel
  day16/day19 (`meeting_participants`, `meeting_attachments`,
  `meeting_invitation_deliveries`, Twoje nowe). To jest FIX-9 dnia 16 i reguła
  wdrożeniowa DEC-92: brak migracji ma być **głośnym błędem**, nie pustą listą.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★ NUMERACJA (`DEC-86`) — najwyższy istniejący numer + 1, sprawdzony
     komendą PRZED KAŻDYM plikiem.** `migrate.postgres.ts` stosuje migracje
     w porządku alfabetycznym nazw plików, więc kolizja numeru to cicha katastrofa.
     ```bash
     ls server/migrations | grep -E '^[0-9]{8}' | sort | tail -3      # najwyższy istniejący
     ls server/migrations | grep '^<numer>'                            # MUSI być PUSTE przed utworzeniem pliku
     ```
     **UWAGA: `20261075` jest już ZAJĘTY przez dzień 16 (scalony).** W chwili
     wystawienia instrukcji najwyższy istniejący to `20261075`, więc Twój
     pierwszy wolny numer to **`20261076`**. Sprawdź to sam — jeśli tip poszedł
     do przodu, bierzesz kolejny wolny i wpisujesz do „Korekt".
     Nazwa: `<numer>_meetings_day19_<temat>.sql`.
  3. **★ ZERO kluczy obcych** do `meetings`/`meeting_*`/`meeting_notes`. Tenant
     i istnienie rodzica sprawdzasz **w warstwie aplikacji**, dokładnie jak
     `meetingService`/`meetingBoundaryService`/`meetingDay16Service`.
  4. **Nie rozszerzasz `ensureMeetingTables()`** — to leniwy bootstrap pod
     SQLite, nie ścieżka wdrożenia. Nowe kolumny/tabele idą **wyłącznie**
     migracją, a kod ma paść głośno przy jej braku (pkt `fallback:false`).
  5. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65) — warunek oddania
     każdej pozycji z migracją.** Jednorazowy kontener, trzy przebiegi, wyniki
     do raportu — patrz Blok 0 pkt 2 i §10.1. **Sprzątanie kontenera I wolumenów
     jest obowiązkowe.**
  6. **Prawdopodobnie potrzebujesz DOKŁADNIE JEDNEJ migracji** (`§H.1` opcja B —
     rejestr prób materializacji). `§C`, `§U.4`, `§G.2` mają schemat gotowy
     z `20261075` (kolumny `recurrence_*`, `split_from_meeting_id`,
     `invitation_sequence`, tabele `meeting_attachments`,
     `meeting_invitation_deliveries`, unikat `uq_meeting_occurrence_exception`).
     **Zweryfikuj to w Bloku 0 i nie dodawaj migracji „na wszelki wypadek".**

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dziewięć**:

1. **Realne dane** — odczyt i zapis idą do backendu, `fallback:false`. Zero
   mocków/`sampleData` jako źródła prawdy. Pusty wynik = uczciwy pusty stan.
2. **Zapis z readbackiem** — po `POST/PUT/PATCH/DELETE` serwis/test ponownie
   odczytuje stan z serwera **niezależnym połączeniem** (osobny `pg.Pool`), nie
   z koperty odpowiedzi.
3. **Zero atrap.** Brak API → wpis `BRAK_API`. Etykieta „Wysłano" tylko gdy
   dostawca faktycznie potwierdził (albo `captured`/`blocked_demo` — uczciwie).
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**
   (wzorzec: `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
   — boot realnego `meeting.routes.ts`, zamockowany wyłącznie `auth.middleware`
   i `Logger`, **bramka `betaGate` REALNA**). Test na zmockowanym
   `meetingService` **nie zastępuje** tego wymogu (to było ograniczenie dnia 16).
6. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query.
7. **Realny PG w jednorazowym Dockerze** z pełnymi migracjami, z dowodem celu
   połączenia (Z19), ze sprzątnięciem kontenera **i wolumenów**.
8. **Plik przez `prettier`** przed commitem.
9. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

> Punkty „zrzut light+dark" i „i18n napisów UI" z DoD dnia 16 **nie obowiązują**
> w tym dyżurze dla powierzchni wizualnych — front jest poza zakresem (§1.6).
> Klucze `meeting.*` tworzysz **wyłącznie** dla napisów, które faktycznie
> wychodzą z Twojego API (np. treść zaproszenia, komunikaty błędów), i wtedy
> parytet PL+EN obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

Przed oddaniem raportu:
1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `src/services/api.ts`, `public/locales/{pl,en}/translation.json`.
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum
   (każde z jawnym `DATABASE_URL` tam, gdzie dotyka bazy — Z19):
   ```bash
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run server/src/services/meetingBoundary/__tests__
   npx vitest run server/src/services/meeting/__tests__
   npx vitest run server/src/utils/ics/__tests__
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   npx vitest run tests/unit/meeting
   npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
   npx vitest run tests/integration/routes/meeting.decision-follow-up-records.postgres.integration.test.ts
   npx vitest run src/components/Meeting/__tests__      # regresja frontu — NIE zmieniasz go, ale ma być zielony
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego). **Dyżur nr 16 skończył się `ZASIĘG CZĘŚCIOWY`; ten
   dyżur istnieje po to, żeby to domknąć — deklaracja `CZĘŚCIOWY` bez wyliczenia
   pozycji jest odrzucana.**

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- osłabić/usunąć asercję w teście istniejącym wcześniej (48-przepływowy pakiet
  `meeting.m12-golden-flows` twardo asertuje `410` na trzech legacy endpointach —
  **nie odblokowujesz ich**; testy strażników `captured`/`blocked_demo` — **nie
  osłabiasz**; testy ICS z FIX-1..5 — **nie cofasz**);
- zmienić kontrakt `handoffSpineService`, `artifactRegistryService` albo
  `recurrenceEngine` — wolno **wołać**, zmiana = STOP;
- dodać migrację nieaddytywną albo zmieniającą typ/znaczenie istniejącej kolumny;
- **włączyć moduł** dla ról klienckich lub zmienić `MODULE_MEETING`/odmontować
  bramkę (Z10);
- stworzyć flagę funkcyjną (Z10);
- wejść we front modułu, powłokę SPEC-A lub prawy panel (Z17, §1.6);
- **wysłać realny e-mail** (DEC-65) — to jest STOP, nigdy „wyślę tylko raz na próbę";
- zbudować kontrolkę/trasę bez realnej ścieżki zapisu (→ `BRAK_API`, nie atrapa);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- uruchomić test bazodanowy bez jawnego `DATABASE_URL` na kontener tego dyżuru
  (Z19) — to nie jest STOP do eskalacji, tylko **zakaz**: postaw kontener, zmigruj,
  udowodnij cel połączenia i dopiero mierz;
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**★ Czego NIE eskalujesz — H.1.** Rozstrzygnięcie `DEC-2026-08-26-87` jest
w §H.1 poniżej i jest **wiążące**. Ponowne zgłoszenie STOP-u „nie da się zrobić
H.1 atomowo" **nie zostanie przyjęte** — bo tego się od Ciebie nie wymaga.

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

Właściciel decyzją **`DEC-2026-08-26-82`** zażądał pełnego zakresu Meetings:
realna wysyłka zaproszeń (ICS/e-mail, nie „status w bazie") i **pełna edycja
serii cyklicznych „to / to i następne / wszystkie"**. Poszło to do dyżuru nr 16.

Dyżur nr 16 dowiózł **warstwę kalendarzowo-wysyłkową**: strefę czasową, model
cykliczności (dane), uczestników z tożsamością i statusem (`meeting_participants`
+ 4 trasy), generator ICS klasy zaproszenia, serwis wysyłki z prawdomównym
statusem i strażnikami DEC-65. Odbiór adwersaryjny (`DEC-2026-08-26-87`) wstrzymał
merge do FIX-ów, znalazł dwa P1 (błąd 2h w `DTSTART/DTEND`, wstrzyknięcie linii
ICS przez niewalidowany `recurrenceRule`) i pięć P2; FIX-1..9 wykonano, po czym
`DEC-2026-08-26-92` **podpisał i scalił** dzień 16 do `codex/m03-admin-20260824`.

Ten sam podpis wyliczył, co **zostało**:

> „Pozostały zakres dnia 16 (H opcją B, C.1-C.2 pełna edycja serii, U.4/U.5,
> G.2, UI uczestników) = dyżur »Meetings blok 2« na bazie po tym merge."

**To jest ten dyżur.** UI uczestników z tej listy wypadło do robotników
wewnętrznych (§1.6) — Ty robisz resztę.

### 1.2. ZAKRES — dokładnie sześć pozycji, nic więcej

| Poz. | Nazwa | Stan po dniu 16 | Twój produkt |
| --- | --- | --- | --- |
| **H.1** | Zatwierdzony protokół staje się REALNYM materiałem | STOP (opcja A niewykonalna) | **Opcja B** — rozstrzygnięcie `DEC-87`, §H.1 |
| **H.2** | Opcjonalne przekazanie działań do My Work / Initiatives | `BRAK_API` (nie zbudowano) | Inwentarz funneli → budowa albo uczciwe `BRAK_API` |
| **H.3** | Rodowód czytelny w obie strony | `NIE_ZACZĘTE` | Strona API (bez frontu Materials) |
| **H.4** | Cold readback całej ścieżki | `NIE_ZACZĘTE` | Pozycja dowodowa, zero nowego kodu |
| **C.1** | Trzy uczciwe zakresy edycji serii | `NIE_ZACZĘTE` | Semantyka zapisu na wierzchu `recurrenceEngine` |
| **C.2** | Trasy occurrence + spójność z listą/wysyłką | `NIE_ZACZĘTE` | `PATCH`/`DELETE /:id/occurrence` + SEQUENCE/CANCEL |
| **U.4** | Artefakty dołączone do spotkania | tabela jest, **brak resolvera/API** | Bezpieczny resolver dostępu + 3 trasy |
| **U.5** | Kontrakty pod edytor spotkania | `NIE_ZACZĘTE` | **TYŁ**: liczniki, wyszukiwanie, kształt odpowiedzi |
| **G.2** | Pełna macierz ról × stan × ścieżka × tenant | `NIE_ZACZĘTE` | Macierz realnego routera + instrukcja otwarcia |
| **T** | Testy WSZYSTKICH nowych tras | `CZĘŚCIOWO` | Także trasy **dnia 16** — patrz §T |
| **R.1** | `MODULE_ACCEPTANCE.md` 08_MEETINGS | nie podniesiony | Podniesienie o **faktycznie dowieziony** zakres |

### 1.3. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁY FRONT modułu Meetings.** UI uczestników (pole z podpowiadaniem,
   gość przez e-mail), UI serii (modal wyboru zakresu „to / to i następne /
   wszystkie"), UI załączników, chipsy statusu zaproszenia, kolumna
   „Uczestnicy" na liście, sekcje karty. **Robią to robotnicy wewnętrzni po
   prototypie i akcepcie właściciela** (CLAUDE.md reguła 7 + formuła polerowania
   grafiki). Nie tworzysz, nie zmieniasz, nie „przygotowujesz" komponentów
   w `src/components/Meeting/**`.
2. **Prawy panel karty spotkania** — zamówiony `DEC-82`, zrobiony przez osobnego
   robotnika, **już scalony**. Nie dotykasz.
3. **Powłoka SPEC-A karty** (`DEC-2026-08-25-54`) i kanon triady listy — cudze,
   zaakceptowane.
4. **§I (wysyłka) jako pozycja** — zbudowana i odebrana dniem 16. Dotykasz jej
   **wyłącznie** w zakresie §C.2 (aktualizacja/odwołanie zaproszenia przy edycji
   serii) i **bez naruszania strażników**.
5. **§U.1/U.2/U.3 jako pozycje** — zbudowane i odebrane dniem 16. Wołasz, nie
   przebudowujesz. Jedyne dotknięcie: testy tras (§T) i kontrakty (§U.5-TYŁ).
6. **`SET-INT-REC-001`** (centrum integracji, OAuth Google/Outlook, sync
   dwukierunkowy) — osobny, duży atom. Nie podpinasz OAuth, nie dotykasz
   `calendarProviders/*`, nie budujesz syncu.
7. **Otwarcie modułu.** Produktem `G.2` jest macierz i instrukcja dla nadzorcy.
8. **Silnik AI / generowanie treści** (Z14).

### 1.4. Decyzje wiążące

1. **`DEC-2026-08-24-07`** — gramatyka tras `/meetings`. Nie zmieniasz (Z11).
2. **`DEC-2026-08-25-58`** — Meetings pełny zakres; `CLOSED_FINAL` odroczone.
3. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   staging pisze TYLKO w osobnych organizacjach testowych; migracje =
   `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz zdalnych
   migracji/seedów/zapisów i **realnych wysyłek e-mail**. Prawo nadrzędne.
4. **`DEC-2026-08-26-82`** — pełna wysyłka + pełna cykliczność (źródło zakresu).
5. **`DEC-2026-08-26-87`** — odbiór warstwy 1 dnia 16 + **rozstrzygnięcie H.1**
   (patrz §H.1, wiążące).
6. **`DEC-2026-08-26-92`** — podpis i scalenie dnia 16; **reguła wdrożeniowa**
   „migracja przed kodem"; delegacja pozostałego zakresu do tego dyżuru.
7. **`DEC-2026-08-26-95`** — rozejście marker→tip bez kolizji rozstrzyga
   nadzorca; dokładny start z markera, bez rebase (§0.1 pkt 2).
8. **`DEC-2026-08-26-96`** — **Z19** (kolejność Bloku 0, jawny `DATABASE_URL`,
   dowód celu połączenia).
9. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji
   „najwyższy + 1 ze sprawdzeniem".

### 1.5. Stan faktyczny bazy — co JUŻ JEST (i czego NIE budujesz od nowa)

Zweryfikuj każdą linię w Bloku 0; rozbieżność → „Korekty wobec instrukcji".

```
# MIGRACJE (scalone)
20260826_meetings_day10_decisions.sql
  meeting_decisions(... source_kind, source_note_id, source_index ...)
  meeting_follow_ups += organization_id, owner_user_id, due_at, source_kind, source_note_id, source_index
  idx_meeting_follow_ups_source_dedup  ← ★ klucz idempotencji dla §H.2 JUŻ ISTNIEJE
20261075_meetings_day16_calendar_participants.sql
  meetings += timezone, recurrence_rule, recurrence_parent_id, recurrence_exception_at,
              recurrence_exdate_json, recurrence_status, split_from_meeting_id, invitation_sequence
  meeting_participants(... participant_kind, user_id, email, role, invitation_status, delivery_status ...)
  meeting_attachments(... artifact_kind CHECK IN ('idea','note','material'), artifact_id, title_snapshot ...)
  meeting_invitation_deliveries(... method, sequence, delivery_status, error ...)
  uq_meeting_occurrence_exception ON meetings(recurrence_parent_id, recurrence_exception_at)  ← ★ idempotencja §C.1 „to"

# SERWISY (scalone)
server/src/services/meeting/meetingDay16Service.ts
  listMeetingParticipants · addMeetingParticipant · updateMeetingParticipant
  deleteMeetingParticipant · setParticipantDelivery          (wszystkie z fallback:false — FIX-9)
server/src/services/meeting/meetingInvitationService.ts
  sendMeetingInvitations(...)  → captured | blocked_demo | sent | failed, izolacja awarii per odbiorca (FIX-7)
server/src/utils/ics/icsBuilder.ts
  buildMeetingInvitationIcs(...) — UTC z sufiksem Z (FIX-1, BEZ TZID/VTIMEZONE), STATUS:CANCELLED (FIX-3),
  DQUOTE parametrów (FIX-4), folding 75 oktetów (FIX-5), escapeIcsText/formatIcsParamValue/formatIcsDate

# TRASY (scalone, wszystkie za closedBetaModuleGate — router.use na linii 238)
GET/POST/PUT     /api/meeting , /api/meeting/:id
GET              /api/meeting/:id/participants
POST             /api/meeting/:id/participants
PATCH/DELETE     /api/meeting/:id/participants/:participantId
POST             /api/meeting/:id/invitations/send
GET/POST/PATCH/DELETE  /api/meeting/:id/decision-records[/:decisionId]
GET/POST/PATCH/DELETE  /api/meeting/:id/follow-up-records[/:followUpId]
POST             /api/meeting/:id/decisions · /:id/follow-ups · PATCH /:meetingId/follow-ups/:followUpId   ← 410 CELOWO
GET              /api/meeting/:id/notes
POST             /api/meeting/:id/notes/:noteId/decision
  ★ walidacja recurrenceRule (whitelist FREQ/INTERVAL/COUNT/UNTIL/BY*/WKST, zakaz CR/LF → 400) — FIX-2

# BRAMKA (G.1 scalone)
server/src/middleware/betaGate.middleware.ts
  createModuleGate(moduleId, resolveStatus = (id) => BETA_MENU_STATUS[id])   ← ★ resolver WSTRZYKIWALNY
  closedBetaModuleGate = createModuleGate('MODULE_MEETING')
  przy 'open' → next(); przy 'closed' → OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN przechodzą, reszta 403 BETA_LOCKED

# KRĘGOSŁUP HANDOFFU (współdzielony — TYLKO WOŁANIE)
handoffSpineService.ts
  PROPOSAL_STATES = ['pending','approved','rejected','materialized','failed']   ← 'failed' ISTNIEJE w słowniku,
    ale ŻADNA eksportowana funkcja go nie ustawia (patrz §H.1 — to jest sedno opcji B)
  materializeProposal(input, donatedQuery?)  → dokładnie jedno pokwitowanie, FOR UPDATE + unikat proposal_id
meetingBoundaryService.ts:~584  decideMeetingNote → materializeProposal({ targetRecordId: note.id })   ← ★ GAP do naprawy

# REJESTR MATERIAŁÓW (współdzielony — TYLKO WOŁANIE)
artifactRegistryService.ts
  registerArtifactOrigin(...)  — idempotentny na (organizationId, originRuntime, originRecordId); NIE przyjmuje darowanej transakcji
  getArtifactByOrigin(...)     — odczyt po origin (użyjesz przy ponowieniu)
  getArtifactForUser({organizationId, artifactId, userId, roleKey?}) — ★ resolver dostępu dla §U.4 kind='material'
  ArtifactOriginRuntimeValues NIE ZNA 'meeting' → originRuntime:'native_artifact' + originSummary.sourceType:'meeting'
```

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

**Ty = TYŁ.** Migracje, serwisy, trasy, semantyka zapisu, kontrakty odpowiedzi,
testy. **Robotnicy wewnętrzni = FRONT**, po prototypie i akcepcie właściciela na
czystym zrzucie (CLAUDE.md reguła 7: właściciel nigdy nie jest pierwszym testerem
wizualnym).

Praktycznie:
- Budujesz trasę `PATCH /:id/occurrence` z trzema zakresami — **nie** budujesz
  modala wyboru zakresu.
- Budujesz `GET /:id/attachments` z resolverem dostępu i uczciwym „artefakt
  niedostępny" — **nie** budujesz selektora artefaktów.
- Zwracasz licznik uczestników i pola wyszukiwania z nowego modelu — **nie**
  zmieniasz kolumny w `MeetingHub.tsx`.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do frontu — **należy do frontu**, a Ty wpisujesz to do „Znalezisk"
jako „kontrakt gotowy, front do zbudowania".

Twoim obowiązkiem wobec frontu jest **jawny kontrakt w raporcie**: dla każdej
nowej trasy podajesz metodę, ścieżkę, kształt body, kształt odpowiedzi, kody
błędów. To jest dosłownie wejście dla robotnika frontowego.

### 1.7. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`NODE_ENV=test` bez `RUN_DB_TESTS=1` = mock DB.** Cały pakiet „przechodzi"
   przeciwko niczemu (Z19).
2. **`DbPromise` z domyślnym `fallback:true` maskuje brak tabeli jako pustą
   listę.** Day16 to naprawił (FIX-9) jawnym `{fallback:false}`. Twój nowy kod
   trzyma tę samą regułę; cofnięcie = złamanie Z15.
3. **ICS jest w UTC z sufiksem `Z`, BEZ `TZID` i `VTIMEZONE`** (FIX-1 — świadoma
   decyzja, nie luka; strefa spotkania jedzie informacyjnie w
   `X-CONSULTIFY-TIMEZONE`). Jeśli w §C.2 policzysz `UNTIL` albo `recurrenceId`
   „w strefie spotkania" bez konwersji — powtórzysz błąd 2h. **Liczysz w UTC.**
4. **`recurrenceRule` z zewnątrz jest wrogi.** Walidacja whitelistą i zakaz
   CR/LF (FIX-2) obowiązuje **także** na nowych trasach `/occurrence` — to nowa
   powierzchnia ataku. Reużywasz istniejącego walidatora, nie piszesz drugiego.
5. **`recurrenceEngine` nie zna „zakresów edycji".** `materializeInstances`
   rozwija RRULE/RDATE/EXDATE + `exceptions[]` w oknie i **nie mutuje serii**.
   „to wystąpienie" = wpis wyjątku; „cała seria" = edycja mastera;
   **„to i następne" = ROZSZCZEPIENIE SERII, nie edycja in-place** — budujesz
   orkiestrację sam, wołając silnik wyłącznie do walidacji i rozwijania.
6. **„Materializacja" notatki wskazuje samą siebie** — `decideMeetingNote` woła
   `materializeProposal({ targetRecordId: note.id })`. To jest `MET-F-006 = gap`
   i sedno §H.1.
7. **Słownik Materials i słownik handoffu są ROZŁĄCZNE.** `origin_runtime` nie
   zna `'meeting'` → rejestrujesz jako `'native_artifact'`, a „spotkaniowość"
   niesiesz w `originSummary.sourceType: 'meeting'`. **Nie rozszerzasz enuma ani
   CHECK-a bazy** (zmiana słownika współdzielonego = STOP).
8. **Materiał na liście, którego nie da się otworzyć, nie liczy się jako
   ukończony.** Dla `native_artifact` treść musi mieć
   `metadata_json.documentStudioSchema`, inaczej
   `GET /api/document-studio/:artifactId` zwraca `404`.
9. **Tytuł z „test"/„smoke"/„probe"/„E2E" znika z listy Materials** (heurystyka
   szkicu). Twoje dane dowodowe nie mogą mieć takiego tytułu.
10. **`?sampleData=materials-vnext` kłamie** — podmienia listę na fixture.
    Weryfikując §H nigdy nie używaj tego parametru.
11. **Trzy legacy trasy zwracają `410` celowo** — nie odblokowujesz ich.
12. **Strażniki wysyłki są przed mailerem, z dowodem `spy.not.toHaveBeenCalled()`.**
    Jeśli w §C.2 przepniesz ścieżkę wysyłki, te asercje muszą dalej przechodzić
    **bez zmiany**.

---

## §H. PRZEPŁYW NOTATKA → MATERIALS / MY WORK / INITIATIVES — cztery pozycje

Definicje wiążące: instrukcja dnia 16, §H.1–H.4. Poniżej **tylko delty i
rozstrzygnięcia**.

### H.1 — Zatwierdzony protokół zostaje REALNYM materiałem — ★ OPCJA B, WIĄŻĄCA

**★ ROZSTRZYGNIĘCIE NADZORCY (`DEC-2026-08-26-87`) — nie eskalujesz go ponownie.**

Dyżur nr 16 zgłosił STOP: `registerArtifactOrigin` wykonuje osobne,
nietransakcyjne inserty przez globalny `DbPromise`, nie przyjmuje darowanej
transakcji i sam dokumentuje ryzyko TOCTOU — więc **nie da się** objąć materiału
i pokwitowania jedną transakcją bez zmiany współdzielonego
`artifactRegistryService`. Nadzorca uznał:

> STOP zasadny **WYŁĄCZNIE dla opcji A** (jedna transakcja — wymaga zmiany
> współdzielonego `artifactRegistryService`, Z17). Kontrakt §H.1 pkt 5 dopuszcza
> **opcję B** (jawny stan `failed` propozycji + błąd z możliwością ponowienia),
> **NIEWYMAGAJĄCĄ** zmian współdzielonych. **H.1 wraca do wykonania opcją B.**

**Wykonujesz OPCJĄ B. Opcja A jest ZAKAZANA** (byłaby zmianą
`artifactRegistryService` = Z17).

**Kolejność operacji — obowiązkowa, w tej kolejności:**

1. **Wiersz treści dokumentu** (wzorzec `wave5ArtifactRuntimeService`) z
   protokołem złożonym z payloadu notatki (`summary`, `keyPoints`, `decisions`,
   `actionItems`). **MUSI nieść `metadata_json.documentStudioSchema`** (pułapka 8).
2. **Wiersz rejestru** przez `registerArtifactOrigin({ organizationId,
   outputType: 'report', artifactFamily: 'document', originRuntime:
   'native_artifact', originRecordId: <id treści>, titleSnapshot: <tytuł
   protokołu, BEZ słowa „test">, createdBy, originSummary: { sourceType:
   'meeting', sourceId: meetingId, sourceTable: 'meeting_notes', noteId,
   receiptId: null } })`. `titleSnapshot` **obowiązkowy**.
3. **DOPIERO PO** udanych (1) i (2): `materializeProposal({ ..., targetRecordId:
   <id NOWEGO materiału> })`. To jest sedno naprawy — pokwitowanie wskazuje
   materiał, nie notatkę.

**Kompensacja (istota opcji B) — cztery wymagania twarde:**

1. **Żaden krok nie „prawie się udaje" po cichu.** Awaria (1), (2) albo (3)
   kończy operację **błędem HTTP 5xx z jawnym, maszynowym kodem** (np.
   `MATERIALIZATION_FAILED`) i **nie** zwraca `receipt`.
2. **Jawny, trwały stan `failed` po stronie Meetings.** Zakładasz własny rejestr
   prób (migracja `<numer>_meetings_day19_note_materialization.sql`):
   ```
   meeting_note_materializations
     id                TEXT PRIMARY KEY
     organization_id   TEXT NOT NULL
     meeting_id        TEXT NOT NULL
     note_id           TEXT NOT NULL
     proposal_id       TEXT
     status            TEXT NOT NULL     ← 'pending' | 'failed' | 'materialized'
     stage             TEXT              ← 'content' | 'registry' | 'receipt'  (gdzie padło)
     artifact_id       TEXT              ← id materiału, gdy krok (2) się udał
     receipt_id        TEXT              ← gdy krok (3) się udał
     failure_code      TEXT
     attempts          INTEGER NOT NULL DEFAULT 0
     last_attempt_at   TEXT
     created_at        TEXT
     updated_at        TEXT
   UNIQUE (organization_id, meeting_id, note_id)
   ```
   Wyłącznie addytywne DDL; **bez kluczy obcych**; `fallback:false` na odczytach.
3. **Ponowienie jest bezpieczne i jawne.** Trasa
   `POST /api/meeting/:id/notes/:noteId/materialization/retry` (tenant z tokenu,
   `canAccessMeeting`, ta sama rola co decyzja). Ponowienie:
   - jeśli krok (2) już przeszedł — **NIE tworzy drugiego materiału**: odczytuje
     istniejący przez `getArtifactByOrigin` (rejestr jest idempotentny na
     `(organizationId, originRuntime, originRecordId)`) i wznawia od kroku (3);
   - jeśli krok (3) już przeszedł — replay `materializeProposal` zwraca istniejące
     pokwitowanie (`replayed: true`), a rejestr prób przechodzi na `materialized`.
4. **★ ZAKAZ pisania do tabel kręgosłupa handoffu.** Stan `'failed'` istnieje
   w `PROPOSAL_STATES`, ale **żadna eksportowana funkcja go nie ustawia**, a
   `UPDATE artifact_handoff_proposals` z serwisu Meetings byłby sięgnięciem do
   cudzej tabeli. **Opcja B jest spełniona przez jawny stan `failed` po stronie
   Meetings** (pkt 2) plus błąd z możliwością ponowienia (pkt 1, 3). Propozycja
   zostaje wtedy w stanie `approved` — legalnym i wznawialnym. **To jest zgodne
   z rozstrzygnięciem `DEC-87` i NIE jest powodem do STOP-u.** Jeżeli uznasz, że
   dosłowny zapis `proposals.state='failed'` jest mimo wszystko konieczny —
   **budujesz pozycję jak wyżej** i piszesz o tym jedno zdanie w „Korektach",
   **nie** zatrzymujesz H.1.

**Definicja ukończenia H.1** (realny PG, realny router, `supertest`):
1. spotkanie → notatka → akceptacja → materiał widoczny przez rejestr
   z poprawnym `titleSnapshot` i `originSummary.sourceType === 'meeting'`;
2. pokwitowanie handoffu ma `target_record_id` = **id materiału**, nie `note.id`
   (readback niezależnym `pg.Pool`);
3. **replay**: druga akceptacja → liczba materiałów i pokwitowań bez zmian;
4. **`reject`** → zero materiałów, zero pokwitowań, `receipt: null`;
5. **★ awaria kroku (3)**: wymuszona (np. lokalny `vi.spyOn` na
   `materializeProposal` rzucający raz) → odpowiedź `5xx` z kodem, rejestr prób
   `status='failed'`, `stage='receipt'`; **liczba materiałów ≤ 1**; notatka **nie**
   pokazuje rodowodu jako gotowego;
6. **ponowienie po awarii** → dokładnie **jedno** pokwitowanie, **jeden**
   materiał, rejestr prób `status='materialized'`;
7. **tenant**: obca organizacja nie widzi materiału ani rejestru prób (`404`);
8. **cold readback**: materiał otwiera się (`GET /api/document-studio/:artifactId`
   = `200`, nie `404`) z nowego procesu/połączenia.

### H.2 — Opcjonalne przekazanie działań do My Work i Initiatives

Definicja: dzień 16 §H.2. **Rozstrzygnięcie domyślne pozostaje w mocy:** handoff
jest **OSOBNĄ, ŚWIADOMĄ decyzją człowieka**, nie automatem przy akceptacji.
Akceptacja notatki sama z siebie **nie tworzy** zadań ani inicjatyw.

**Delta wobec dnia 16 — prerekwizyty już są:** kolumny źródłowe
(`source_kind`, `source_note_id`, `source_index`) i unikat
`idx_meeting_follow_ups_source_dedup` **istnieją** (migracja dnia 10, scalona).
**Nie dodajesz ich drugi raz.**

**Kolejność:** najpierw **inwentarz funneli** (tabela: `Cel · Funnel · Istnieje? ·
Kontrakt · Werdykt`), potem decyzja, czy budujesz. Jeżeli funnel nie przyjmuje
parametru, którego potrzebujesz → **`BRAK_API`** z pełną tabelą i **bez trasy**.

**Wymagania twarde, jeżeli budujesz:** idempotencja per punkt działania (klucz
`(meeting_id, source_kind, source_note_id, source_index)` po Twojej stronie +
`idempotencyKey` przekazany do funnela); pokwitowanie przy punkcie działania (co
powstało, gdzie, kiedy, z czyjej decyzji); uczciwa porażka z możliwością
ponowienia; zero automatu.

**DoD H.2:** tabela inwentarza w raporcie; jeśli `ZBUDOWANE` — 4 testy
behawioralne na cel (happy · powtórzenie · odmowa uprawnień · obcy tenant) na
realnym routerze i realnym PG; jeśli `BRAK_API` — brak trasy i jawny wpis.

### H.3 — Rodowód czytelny w obie strony — TYLKO STRONA API

Definicja: dzień 16 §H.3. **Delta: punkt 2 dnia 16 (kolumna „Źródło" po stronie
Materials, front) WYPADA z zakresu** — front nie jest Twój (§1.3). Zostaje:

1. **API spotkania:** `GET /:id/notes` już dołącza stan propozycji i `receiptId`
   przez `LEFT JOIN` — rozszerzasz **addytywnie** o tożsamość powstałego
   materiału (`materialArtifactId`, `materialTitle`) oraz o stan z rejestru prób
   (`materializationStatus`: `pending`|`failed`|`materialized`,
   `materializationFailureCode`). **Bez zmiany kształtu pól istniejących.**
2. **Uczciwość stanów:** notatka `proposed` **nie pokazuje** materiału; notatka
   po nieudanej materializacji pokazuje `failed` + kod, **nigdy** pustkę
   udającą sukces.
3. **Rodowód w drugą stronę** jest już zapewniony przez
   `originSummary.sourceType/sourceId/noteId` z §H.1 — w raporcie pokazujesz
   surowy odczyt tego pola z bazy jako dowód.

**DoD H.3:** test kontraktu odpowiedzi `GET /:id/notes` w trzech stanach
(`proposed` · `materialized` · `failed`); brak regresji istniejących pól
(asercja na polach sprzed zmiany); link/id materiału prowadzi pod adres, który
zwraca `200`; wpis w raporcie „kontrakt dla frontu" (§1.6).

### H.4 — Cold readback całej ścieżki (pozycja dowodowa, bez nowego kodu)

Wykonujesz scenariusz z dnia 16 §H.4, **rozszerzony o opcję B**. Dziewięć kroków
+ dwa nowe, wszystkie na jednorazowym kontenerze, z surowymi wynikami (statusy
HTTP, liczby wierszy) w raporcie:

1. utworzenie spotkania;
2. wygenerowanie notatki z ręcznego tekstu;
3. odczyt przed decyzją: propozycja `pending`, pokwitowań `0`, materiałów `0`;
4. zatwierdzenie przez rolę uprawnioną;
5. odczyt po decyzji: propozycja `materialized`, pokwitowań `1`, materiałów `1`,
   materiał otwiera się (`200`);
6. **zimny odczyt** (nowy proces/połączenie): pkt 5 identycznie;
7. **★ wymuszona awaria kroku (3)** na drugiej notatce: rejestr prób `failed`,
   materiałów `≤1`, brak pokwitowania;
8. **★ ponowienie**: dokładnie jedno pokwitowanie i jeden materiał;
9. negatyw tenanta: druga organizacja widzi `0` materiałów i `404` na notatce;
10. negatyw roli: rola bez uprawnień → odmowa i nic nie powstaje;
11. sprzątanie kontenera **i wolumenów** (dowód: `docker ps -a` → pusto,
    `docker volume ls` → brak wolumenów dyżuru).

**DoD H.4:** wszystkie jedenaście kroków z wynikami. Krok bez wyniku =
niewykonany.

---

## §C. PEŁNA CYKLICZNOŚĆ — semantyka edycji serii (`DEC-82` część 2) — dwie pozycje

**★ To jest pełny zakres, nie STOP.** Model danych masz (kolumny `recurrence_*`,
`split_from_meeting_id`, unikat `uq_meeting_occurrence_exception`), silnik masz
(`recurrenceEngine`). Budujesz **operacje zapisu**.

### C.1 — Trzy zakresy edycji, każdy addytywny i odtwarzalny

Semantyka jak w kalendarzach (Google/Outlook). Nowy serwis
`server/src/services/meeting/meetingOccurrenceService.ts`:

1. **„to wystąpienie" (`this`)** — materializujesz **jeden** wiersz-wyjątek:
   `recurrence_parent_id = <seria>`, `recurrence_exception_at = <recurrenceId =
   start ISO wystąpienia, w UTC>`, `recurrence_status = 'modified'` i nadpisane
   pola. Pozostałe wystąpienia bez zmian. **Idempotencja jest już w bazie**
   (`uq_meeting_occurrence_exception`) — obsługujesz naruszenie unikatu jako
   replay (zwracasz istniejący wyjątek), nie jako `500`.
2. **„cała seria" (`all`)** — edytujesz **master** (jego `recurrence_rule` i pola
   własne). Silnik re-rozwija. Istniejące wyjątki: **domyślnie zachowane**
   (wyjątek pozostaje wyjątkiem). Jeżeli edycja zmienia siatkę tak, że wyjątek
   traci kotwicę — opisujesz zachowanie w raporcie i **nie usuwasz** wiersza.
3. **„to i następne" (`this_and_following`)** — **★ ROZSZCZEPIENIE SERII, NIE
   EDYCJA IN-PLACE.** To jest pułapka nr 1 tej pozycji:
   a) na **starym masterze** ustawiasz `UNTIL` w RRULE na moment **przed**
      wybranym wystąpieniem (liczony **w UTC**, pułapka 3 z §1.7);
   b) tworzysz **NOWY master** od wybranego wystąpienia, z nową regułą/polami,
      `recurrence_parent_id = NULL` (to nowa seria) i
      `split_from_meeting_id = <stary master>` (kolumna już istnieje);
   c) wyjątki **po cut-over** przenoszą się do nowej serii (przepięcie
      `recurrence_parent_id`), wyjątki przed cut-over zostają przy starym.
   `recurrenceEngine` tego nie robi — orkiestrację budujesz sam, wołając silnik
   wyłącznie do walidacji reguł (`validateRecurrenceModel`, `parseRRule`)
   i rozwijania (`materializeInstances`).

**Wymagania twarde:**
- **Addytywność.** INSERT nowych wierszy + `UPDATE` pól własnych spotkania
  w granicach organizacji. **Żadnego `DELETE` serii.** Odwołanie pojedynczego
  wystąpienia = wyjątek `recurrence_status='cancelled'`, nie usunięcie.
- **Tenant** — organizacja **wyłącznie z tokenu**, rodzic przez `getMeeting`,
  wzorzec „load-then-check" (odebrany dniem 16).
- **Walidacja `recurrenceRule`** — reużywasz walidatora z FIX-2 (whitelist
  `FREQ`/`INTERVAL`/`COUNT`/`UNTIL`/`BYDAY`/`BYMONTHDAY`/`BYMONTH`/`WKST`, zakaz
  CR/LF → `400`). **Nie piszesz drugiego walidatora.** Wstrzyknięcie CR/LF
  w `recurrenceId` też odrzucasz.
- **Czas liczysz w UTC.** Test DST obowiązkowy: seria tygodniowa Europe/Warsaw
  przechodząca przez zmianę czasu — `UNTIL` i `recurrence_exception_at` nie
  przesuwają się o godzinę.
- **Limit rozwijania** — twarde okno + limit instancji (już wymagane w U.2);
  „to i następne" na regule bez końca nie może rozwijać w nieskończoność.
- **Jeśli którakolwiek z trzech operacji okazałaby się nieaddytywna albo
  nieodtwarzalna na świeżej bazie — STOP dla tej jednej operacji** (nie budujesz
  trasy, która ją obiecuje), reszta idzie dalej. `DEC-82` chce pełni, ale atrapa
  jest gorsza niż uczciwy brak jednej opcji.

### C.2 — Trasy occurrence + spójność z listą i wysyłką

```
PATCH  /api/meeting/:id/occurrence
   body: { recurrenceId, scope: 'this'|'this_and_following'|'all', changes }
DELETE /api/meeting/:id/occurrence
   body: { recurrenceId, scope }        ← ODWOŁANIE (wyjątek 'cancelled'), nie usunięcie serii
```

- Obie trasy **za tą samą bramką** (`closedBetaModuleGate`, `router.use` linia
  238) i za `verifyToken`/`isAuthenticated`.
- **Readback** — odczyt listy i licznika po edycji jest spójny z zapisem
  (weryfikacja niezależnym `pg.Pool`).
- **★ Współpraca z §I (wysyłka) — bez naruszania strażników:**
  * edycja zmieniająca termin/miejsce → **aktualizacja zaproszenia**:
    `METHOD:REQUEST` z **podbitym `SEQUENCE`** (kolumna `invitation_sequence`
    już istnieje) dla zakresu, którego dotyczy;
  * odwołanie → `METHOD:CANCEL` (builder emituje też `STATUS:CANCELLED` — FIX-3);
  * ścieżka wysyłki idzie **wyłącznie** przez istniejący
    `sendMeetingInvitations`, więc strażniki `captured` (dev/test bez
    `MEETING_INVITES_LIVE`) i `blocked_demo` (org == `DEMO_ORG_ID`) działają
    **przed** mailerem. **Nie budujesz drugiej ścieżki wysyłki.**
  * `meeting_invitation_deliveries` dostaje wiersz z `method` i `sequence` —
    prawdomówny, per uczestnik.
- **Uczciwość:** jeśli wysyłka jest `captured`/`blocked_demo`/`failed`, odpowiedź
  trasy **nie** twierdzi „zaktualizowano zaproszenia" — zwraca faktyczne
  statusy per uczestnik.

**DoD §C (C.1 + C.2 razem), wszystko na realnym PG przez realny router:**
1. **„to"** — tworzy dokładnie 1 wyjątek, nie rusza pozostałych wystąpień;
   powtórzenie na tym samym `recurrenceId` → replay, nadal 1 wyjątek.
2. **„to i następne"** — stary master ma `UNTIL` przed cut-over; nowy master
   istnieje z `split_from_meeting_id`; wyjątki po cut-over przepięte; **suma
   wystąpień w oknie przed i po operacji jest zgodna z oczekiwaniem** (wypisz
   liczby w raporcie).
3. **„cała seria"** — master zmieniony, silnik re-rozwija, wyjątki zachowane.
4. **Odwołanie** — wyjątek `recurrence_status='cancelled'`; **zero `DELETE`**
   (dowód: liczba wierszy `meetings` przed/po).
5. **DST** — seria przez zmianę czasu, brak przesunięcia o godzinę.
6. **Walidacja** — `recurrenceRule`/`recurrenceId` z CR/LF → `400`; nieznany
   `scope` → `400`; nieistniejący `recurrenceId` → `404`.
7. **Regresja niecykliczna** — spotkanie bez reguły zachowuje się dokładnie jak
   dziś.
8. **Obcy tenant** → `404` na obu trasach.
9. **Wysyłka** — po edycji `SEQUENCE` podbity, `METHOD` poprawny; w dev/test
   status `captured`, `emailService.send` **nie wołany** (spy) — **testy
   strażników dnia 16 nadal zielone, bez zmian w ich asercjach**.
10. Migracja: **prawdopodobnie żadna** (schemat gotowy). Jeśli jednak dodajesz —
    numeracja wg §0.3 pkt 2 ze sprawdzeniem `ls | grep`.

---

## §U. DOKOŃCZENIE UCZESTNIKÓW — dwie pozycje

### U.4 — Artefakty dołączone do spotkania (`MYW-CAL-REC-003`)

Definicja: dzień 16 §U.4. **Stan zastany: tabela `meeting_attachments` ISTNIEJE**
(migracja `20261075`, z `CHECK (artifact_kind IN ('idea','note','material'))`
i unikatem `(meeting_id, artifact_kind, artifact_id)`). **Brakuje bezpiecznego
resolvera dostępu i API.** To budujesz.

**★ Bezpieczny resolver dostępu — sedno pozycji.** Nowy serwis
`server/src/services/meeting/meetingAttachmentService.ts`. **Serwer PRZED
zapisem** sprawdza, że dołączający ma prawo do artefaktu **w tej organizacji**:

| `artifact_kind` | Sprawdzenie | Uwaga |
| --- | --- | --- |
| `material` | `getArtifactForUser({ organizationId, artifactId, userId, roleKey })` → `null` = brak prawa | imienny wyjątek Z17 (WOŁASZ, nie zmieniasz) |
| `idea` | org-scoped odczyt `SELECT id, title FROM ideas WHERE id = $1 AND organization_id = $2` | `ideas` ma `organization_id`; odczyt tylko-do-odczytu, w Twoim serwisie |
| `note` | `meeting_notes` org-scoped (`organization_id` + istnienie) | tabela w Twoim module |

Brak prawa → `403`/`404`, **nigdy zapis**. Organizacja **wyłącznie z tokenu**.
`artifact_kind` spoza listy zamkniętej → `400` (nie polegasz wyłącznie na CHECK-u
bazy).

**API (trzy trasy, za tą samą bramką):**
```
GET    /api/meeting/:id/attachments
POST   /api/meeting/:id/attachments      body: { artifactKind, artifactId }
DELETE /api/meeting/:id/attachments/:attachmentId
```

**Wymagania twarde:**
1. **`title_snapshot` służy WYŁĄCZNIE liście dla uprawnionych.** Przy odczycie
   `GET` resolver jest wołany **ponownie, per pozycja**: jeśli uprawnienie
   zostało w międzyczasie odebrane → pozycja wraca jako **„artefakt
   niedostępny", BEZ tytułu i BEZ linku** (`accessible: false`, `title: null`).
   Zwrócenie zapamiętanego tytułu komuś, kto stracił dostęp, to **wyciek** —
   pozycja odrzucona.
2. **Duplikat** → `409`/replay, nigdy drugi wiersz.
3. **`fallback:false`** na wszystkich odczytach/zapisach.
4. **Goście zewnętrzni:** dołączone artefakty **nie** dostają publicznych linków.
   W zaproszeniu gościa artefakt (jeśli w ogóle) pojawia się jako **tytuł bez
   linku**; dla zaproszonych **użytkowników organizacji** link prowadzi do
   normalnej, uwierzytelnionej ścieżki. Model udostępniania na zewnątrz **nie
   istnieje** i **nie budujesz go** — wpis STOP z opisem, czego brakuje, jest
   obowiązkowy (to nie blokuje pozycji).

**DoD U.4:** testy na realnym routerze i realnym PG: happy (`material`) · happy
(`idea`) · dołączenie bez uprawnień odrzucone (`403`/`404`, zero wierszy) ·
`artifact_kind` spoza listy → `400` · duplikat odrzucony · **odebrany dostęp →
odczyt bez tytułu i bez linku** · obcy tenant `404` · odłączenie działa i jest
tenant-scoped. Plus wpis STOP o linkach dla gości.

### U.5 — Kontrakty serwerowe pod edytor spotkania — ★ TYLKO TYŁ

Definicja dnia 16 §U.5 opisuje **UI**. **Front jest poza zakresem (§1.3)** —
z tej pozycji zostaje **wyłącznie warstwa serwerowa, która ten front zasili**:

1. **Licznik uczestników z NOWEGO modelu.** Lista i karta zwracają
   `participantCount` liczony z `meeting_participants`, **nie** z
   `attendees.length` (`attendees_json` zostaje nietknięte — pozycja otwarta nr 2
   dnia 16 pozostaje nierozstrzygnięta i tego nie ruszasz).
2. **Wyszukiwanie obejmuje uczestników** — nazwy i e-maile z
   `meeting_participants`, tenant-scoped, bez N+1 (jedno zapytanie z `JOIN`/
   `EXISTS`, nie pętla po spotkaniach).
3. **Kształt odpowiedzi `GET /api/meeting` i `GET /api/meeting/:id`** rozszerzony
   **addytywnie** o to, czego front będzie potrzebował: `timezone`,
   `recurrenceRule`, `recurrenceParentId`, `recurrenceStatus`,
   `splitFromMeetingId`, `invitationSequence`, `participantCount`,
   `attachmentCount`. **Bez zmiany kształtu pól istniejących** (48-przepływowy
   golden-flows musi zostać zielony bez zmian).
4. **Uczciwe stany:** brak strefy → `timezone: null` i „strefa nieokreślona"
   po stronie kontraktu (nie zgadujesz wstecz); brak uczestników → `0`, nie
   `null`.
5. **★ Kontrakt dla frontu w raporcie** — tabela: trasa · metoda · body ·
   odpowiedź · kody błędów, dla **wszystkich** tras day16+day19. To jest wejście
   dla robotnika frontowego (§1.6).

**DoD U.5:** testy kontraktu odpowiedzi (happy · spotkanie bez uczestników ·
spotkanie sprzed migracji, bez `timezone` · obcy tenant); test wyszukiwania po
nazwie i po e-mailu uczestnika (znajduje / nie znajduje w obcej organizacji);
brak regresji w `meeting.m12-golden-flows` (uruchomiony, zielony); tabela
kontraktu w raporcie. **Zero plików w `src/components/Meeting/**`** — dowód
`git diff --name-only`.

---

## §G.2 — PEŁNA MACIERZ OTWIERALNOŚCI NA REALNYM ROUTERZE

**★ Twoim produktem jest PRZETESTOWANA MACIERZ, nie otwarcie. Zakaz włączania.**

`G.1` jest scalone: `createModuleGate(moduleId, resolveStatus = (id) =>
BETA_MENU_STATUS[id])` ma **wstrzykiwalny resolver**. Stan `open` osiągasz
**wyłącznie przez wstrzyknięcie resolvera w teście**, nigdy przez zmianę
wartości domyślnej (Z10). `MODULE_MEETING` zostaje `'closed'`,
`closedBetaModuleGate` zostaje zamontowany.

**Macierz — wszystkie komórki wypełnione:**

| Wymiar | Wartości |
| --- | --- |
| Rola | `OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN`, `MEMBER`, `USER`, rola pusta, rola pilotowa |
| Stan modułu | `closed` (dziś) · `open` (przez wstrzyknięty resolver) |
| Ścieżka | lista `GET /api/meeting` · karta `GET /api/meeting/:id` · zapis `POST /api/meeting` · `/:id/participants` · `/:id/invitations/send` · **`/:id/attachments`** · **`/:id/occurrence`** · **`/:id/notes/:noteId/decision`** · **`/:id/notes/:noteId/materialization/retry`** |
| Tenant | własny · obcy |
| Uwierzytelnienie | zalogowany · anonim |

**Wymagania twarde:**
1. Test wywołuje **realny router** przez `supertest` (wzorzec
   `meeting.m12-golden-flows`), nie samą funkcję middleware. Grep montażu
   zostaje, ale **nie liczy się do DoD**.
2. **Anonim i obcy tenant odrzucani w OBU stanach.** Otwarcie modułu nie otwiera
   izolacji — to jest najważniejsza asercja tej pozycji.
3. Wszystkie **nowe zasoby day19** (`/attachments`, `/occurrence`,
   `/materialization/retry`) są **za tą samą bramką** — macierz to udowadnia.
4. Istniejący `tests/unit/backend/middleware/meetingBetaGate.test.ts` musi
   przejść **bez zmian**.

**DoD §G.2:** tabela `Rola × Stan × Ścieżka × Tenant → oczekiwany status →
wynik`, wszystkie komórki wypełnione, zero „n/d" bez uzasadnienia; **instrukcja
otwarcia dla nadzorcy** (plik, linia, wartość przed/po, lista testów do
uruchomienia po przełączeniu); jawne zdanie „moduł NIE został otwarty".

---

## §T. TESTY — pozycja własna, nie dodatek

**★ Dzień 16 tego nie dowiózł: jego testy tras chodziły na ZMOCKOWANYM
`meetingService`.** Tu domykasz to na realnym routerze i realnym PG.

### T.1 — Testy WSZYSTKICH nowych tras (day16 + day19)

Nowy plik integracyjny, wzorzec
`tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
(boot realnego routera; mock **wyłącznie** `auth.middleware` — parametryzowany
nagłówkami — i `Logger`; **bramka REALNA**; readback niezależnym `pg.Pool`).

Pokrycie obowiązkowe:

| Trasa | Skąd | Minimum |
| --- | --- | --- |
| `GET /:id/participants` | day16 | happy · pusty · obcy tenant · brak spotkania |
| `POST /:id/participants` | day16 | user org · gość · obcy `userId` odrzucony · duplikat |
| `PATCH /:id/participants/:pid` | day16 | zmiana statusu przez uprawnionego · odmowa nieuprawnionemu · obcy tenant |
| `DELETE /:id/participants/:pid` | day16 | usunięcie · **usunięcie organizatora odrzucone** · obcy tenant |
| `POST /:id/invitations/send` | day16 | `captured` w dev/test (spy: mailer nie wołany) · `blocked_demo` · rola nieuprawniona `403` · obcy tenant `404` |
| `PATCH /:id/occurrence` | day19 | trzy zakresy · walidacja · `404` · obcy tenant |
| `DELETE /:id/occurrence` | day19 | odwołanie = wyjątek · zero `DELETE` serii · obcy tenant |
| `GET/POST/DELETE /:id/attachments` | day19 | wg DoD U.4 |
| `POST /:id/notes/:noteId/decision` | day16/19 | approve → materiał · reject → nic · replay · awaria + kod |
| `POST /:id/notes/:noteId/materialization/retry` | day19 | ponowienie po awarii · replay · obcy tenant |

**Wszystko z jawnym `DATABASE_URL` na kontener 5449 (Z19) i dowodem celu
połączenia.**

### T.2 — Negatywy tenanta jako osobny, jawny pakiet
Jeden plik z negatywami tenanta dla **wszystkich** tras day16+day19. Obcy
`organizationId` nigdy nie dostaje `200`. `organizationId` z body/query **jest
ignorowany** — test to udowadnia (wysyłasz obcą organizację w body i dostajesz
`404`, nie `200`).

### T.3 — Zakaz osłabiania testów zastanych
Nie osłabiasz asercji istniejących wcześniej. Jeżeli test wymaga zmiany, bo
rozszerzyłeś kontrakt **addytywnie** (nowe pole) i asercja jest `toEqual` całego
obiektu — **dopisujesz pole**, nie zmieniasz wartości istniejących; każdy taki
przypadek to wpis „przed/po" w raporcie. `meeting.m12-golden-flows`,
`meetingsCanonicalRoute`, `meetingBetaGate`, testy strażników i testy ICS
z FIX-1..5 — **nie ruszasz**.

### T.4 — i18n
Tylko dla napisów wychodzących z Twojego API (komunikaty błędów, treść
zaproszenia przy aktualizacji/odwołaniu). Parytet `meeting.*` PL+EN w tym samym
commicie. Zero nowych kluczy „na zapas" pod nieistniejący front.

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 08_MEETINGS do stanu faktycznego
Podnosisz **wyłącznie** o to, co faktycznie działa i ma dowód (commit + test +
przebieg na realnym PG). Aktualizujesz sekcje odpowiadające pozycjom H/C/U.4/
U.5-TYŁ/G.2 oraz `Implementation/regression ledger`. **Nie deklarujesz gotowości,
której nie ma. Nie zmieniasz statusów cudzych pozycji. Nie ustawiasz
`Owner verdict` — to należy do właściciela.** Jeśli pozycja skończyła się
`CZĘŚCIOWO`/`STOP`, w rejestrze ma być `CZĘŚCIOWO`/`STOP`, nie „done".

### R.2 — Komplet dowodów
Wyniki testów, dowody idempotencji migracji, dowód celu połączenia (Z19), tabela
macierzy ról, tabela kontraktów dla frontu, wpis „zero realnych maili", dowód
sprzątnięcia kontenera **i wolumenów**. Bez kompletu — pozycja `CZĘŚCIOWO`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
   --is-ancestor` z §0.1 pkt 1** (SHA markera jest tam, w jednym miejscu — nie
   przepisujesz go z pamięci). Brak → STOP i koniec dyżuru. Rozejście marker→tip → wpis, start z markera
   (DEC-95), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19,
   `DEC-96`). Gałąź + worktree (§0.1 pkt 5), symlink `node_modules` (DEC-86,
   tylko odczyt), potem:
   ```bash
   docker run -d --name cx-day19-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day19 \
     -p 5449:5432 pgvector/pgvector:pg16
   export DATABASE_URL="postgres://postgres:cx@localhost:5449/cx_day19"
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day19-pg psql -U postgres -d cx_day19 -c "SELECT current_database(), inet_server_port();"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 1 — pełne migracje projektu
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 2 → Applying migrations: 0
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry # dry → Pending migrations: 0
   ```
   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — zawsze z jawnym
   `DATABASE_URL`, `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`.

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów wiążących
   (§0.1 pkt 4). Brak dnia 10 lub dnia 16 = STOP.

4. **Numer migracji** — najwyższy istniejący + 1, ze sprawdzeniem (§0.3 pkt 2):
   ```bash
   ls server/migrations | grep -E '^[0-9]{8}' | sort | tail -3
   ls server/migrations | grep '^20261076'        # MUSI być puste
   ```

5. **Weryfikacja mapy z §1.5** — każdą rozbieżność do „Korekt". Obowiązkowo:
   ```bash
   grep -n "targetRecordId" server/src/services/meetingBoundary/meetingBoundaryService.ts | head
   grep -n "PROPOSAL_STATES\|materializeProposal" server/src/services/artifactHandoff/handoffSpineService.ts | head
   grep -n "registerArtifactOrigin\|getArtifactByOrigin\|getArtifactForUser" server/src/services/v8/artifactRegistryService.ts | head
   grep -n "materializeInstances\|parseRRule\|validateRecurrenceModel" server/src/services/v8/recurrenceEngine.ts
   grep -n "createModuleGate\|MODULE_MEETING" server/src/middleware/betaGate.middleware.ts src/utils/betaAccess.ts src/utils/pilotAccess.ts
   grep -n "closedBetaModuleGate" server/src/routes/meeting.routes.ts
   grep -n "fallback: false" server/src/services/meeting/meetingDay16Service.ts | head
   grep -n "blocked_demo\|captured\|DEMO_ORG_ID" server/src/services/meeting/meetingInvitationService.ts | head
   grep -n "organization_id" server/migrations/20261075_meetings_day16_calendar_participants.sql | head
   ```

6. **Dowód stanu wyjściowego testów** (§0.4a lista) — z jawnym `DATABASE_URL`
   tam, gdzie dotyczy. Wyniki (liczby PASS/FAIL) do raportu. **Czerwone testy
   zastane opisujesz, nie „naprawiasz".**

7. **Kanon tabel** baseline (na wszelki wypadek, mimo że frontu nie ruszasz):
   `bash scripts/check-list-canon.sh 2>&1 | tail -20`.

8. Założenie raportu (§9) i wpisanie wyników 1–7.

### Blok 1 — materializacja (H.1 → H.3 → H.2 → H.4)
`H.1` opcją B jest najdroższa i najważniejsza — zaczynasz od niej. `H.3` zaraz
po (rodowód to dowód, że `H.1` zadziałało). `H.2` najbardziej narażone na
`BRAK_API` — inwentarz przed budową. `H.4` (cold readback) zawsze na końcu bloku,
**nie pomijasz**.

### Blok 2 — cykliczność (C.1 → C.2)
Po `H`, bo `C` jest niezależne, ale droższe niż `U.4`. Jeśli zaczynasz z mniej
niż połową bloku — nie zaczynaj „to i następne"; domknij „to" i „cała seria"
czysto i oznacz trzecią operację uczciwie.

### Blok 3 — artefakty i kontrakty (U.4 → U.5-TYŁ)
`U.4` niezależne od `C`. `U.5-TYŁ` po `U.4` (bo `attachmentCount` pochodzi
z `U.4`).

### Blok 4 — bramka (G.2)
Tanie i wartościowe. **Jeśli czasu mało — rób `G.2` PRZED `U.5-TYŁ`.**

### Blok 5 — domknięcie (obowiązkowo, ~80 min)
1. `§T` (testy wszystkich tras, negatywy tenanta), `R.1`, `R.2` dla tego, co
   faktycznie zbudowałeś.
2. Pomiar zasięgu (§0.4a): `ZASIĘG PEŁNY`/`CZĘŚCIOWY` z wyliczeniem.
3. **Osiem dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/components/"                                          # PUSTY (front poza zakresem)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                       # tylko <numer>_meetings_day19_*
   git diff codex/m03-admin-20260824...HEAD -- src/utils/betaAccess.ts src/utils/pilotAccess.ts | grep -E "MODULE_MEETING"     # ZERO zmian 'closed'
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags)"                                    # PUSTY (zero flag)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/v8/artifactRegistryService.ts server/src/services/artifactHandoff/handoffSpineService.ts server/src/services/v8/recurrenceEngine.ts  # PUSTY (Z17)
   grep -rn "SMTP_HOST\|MEETING_INVITES_LIVE" tests server/src/**/__tests__ 2>/dev/null                                        # testy NIE ustawiają realnego transportu
   docker ps -a --filter name=cx-day19-pg ; docker volume ls | grep -i cx-day19                                                # PUSTO (sprzątnięte)
   ```
4. **Zero realnych maili** — jawny dowód (spy `not.toHaveBeenCalled()` + log).
5. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day19-pg && docker volume ls -q | grep -i cx-day19 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności
Lepiej **domknięte** `H.1`+`C`+`G.2`+testy tras niż osiem pozycji „prawie". Każda
pozycja albo spełnia DoD, albo jest uczciwie oznaczona
(`STOP`/`BRAK_API`/`CZĘŚCIOWO`).

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:
```
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY19_REPORT_20260826.md
```
Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Meetings dzień 19 (blok 2) — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: 315adbb83b — POTWIERDZONY / BRAK
Gałąź: codex/meetings-day19-<data>
Worktree: /private/tmp/consultify-meetings-day19
Port PG: 5449 · kontener cx-day19-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)
<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>

## ★ Dowód celu połączenia (Z19 / DEC-96)
<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z jawnym DATABASE_URL>

## Warunki wstępne — tabela
<marker · dzień 10 scalony · dzień 16 scalony · FIX-y 1..9 obecne · rejestr decyzji ·
 numer migracji wolny (ls|grep) · migracje 1/2/dry · testy przed>

## Pozycje — tabela zbiorcza
| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API) | Commit | Dowód |
| H.1 | | | |
| H.2 | | | |
| H.3 | | | |
| H.4 | | | |
| C.1 | | | |
| C.2 | | | |
| U.4 | | | |
| U.5-TYŁ | | | |
| G.2 | | | |
| T | | | |
| R.1 | | | |

## Tabele werdyktów
### H.1 — materializacja opcją B | Krok | Przed | Po | Dowód |   (target_record_id: note.id → id materiału)
### H.1 — kompensacja | Scenariusz | Stan rejestru prób | Materiałów | Pokwitowań | Wynik |
### H.2 — inwentarz funneli | Cel | Funnel | Istnieje? | Kontrakt | Werdykt |
### C — zakresy edycji | Zakres | Addytywne? | Odtwarzalne na świeżej bazie? | Liczby wystąpień przed/po | Test |
### U.4 — resolver dostępu | Rodzaj artefaktu | Sprawdzenie | Brak prawa | Odebrany dostęp | Test |
### G.2 — macierz | Rola | Stan | Ścieżka | Tenant | Oczekiwane | Wynik |

## ★ KONTRAKT DLA FRONTU (produkt §1.6/§U.5)
| Trasa | Metoda | Body | Odpowiedź | Kody błędów |
<wszystkie trasy day16 + day19>

## ★ Wysyłka — dowód DEC-65
<zero realnych maili; spy not.toHaveBeenCalled; strażniki captured/blocked_demo nienaruszone>

## Instrukcja otwarcia modułu dla nadzorcy (produkt G.2)
<plik · linia · wartość przed/po · lista testów do uruchomienia po przełączeniu>
<jawne zdanie: moduł NIE został otwarty>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — publiczny link do artefaktu dla gościa zewnętrznego (§U.4)
### STOP — <pozostałe>

## Znaleziska (NIE naprawiane przeze mnie)
## Korekty wobec instrukcji
## Migracje  (numer, dowód ls|grep, addytywność, idempotencja, kompatybilność wstecz, MIGRATION_PREPARED)
## Testy  (własne · zmiana testu istniejącego przed/po · pomiar zasięgu §0.4a · osiem dowodów Bloku 5)
## Licznik  (pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte; moduł NIE otwarty)
## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „testy przeszły" → `26/26 PASS`.
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `NIE_ZACZĘTE`.
5. **Nie zawyżasz.** Dzień 16 zawyżył status `I.1` i odbiór to wyłapał
   (`DEC-87`). Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.
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
npx vitest run server/src/utils/ics/__tests__/icsBuilder.test.ts

# test celowany Z bazą — ZAWSZE tak (Z19), nigdy bez DATABASE_URL
DATABASE_URL="postgres://postgres:cx@localhost:5449/cx_day19" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
npx vitest run tests/integration/routes/meeting.day19.postgres.integration.test.ts

# numeracja migracji (DEC-86) — PRZED KAŻDYM NOWYM PLIKIEM
ls server/migrations | grep -E '^[0-9]{8}' | sort | tail -3
ls server/migrations | grep '^20261076'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day19-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day19 -p 5449:5432 pgvector/pgvector:pg16
docker exec cx-day19-pg psql -U postgres -d cx_day19 -c "SELECT current_database(), inet_server_port();"
export DATABASE_URL="postgres://postgres:cx@localhost:5449/cx_day19"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day19-pg && docker volume ls -q | grep -i cx-day19 | xargs -r docker volume rm && docker volume prune -f

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/routes/meeting.day19.postgres.integration.test.ts

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dziesięć rzeczy, które najłatwiej zepsuć

1. **Uruchomienie testu DB bez `DATABASE_URL`/`RUN_DB_TESTS=1`** → mock DB, wynik
   bez wartości (Z19, dzień 17 na tym poległ).
2. **Kolizja numeru migracji** → cicha katastrofa porządku alfabetycznego.
   `20261075` jest ZAJĘTY. Sprawdzaj `ls | grep` przed każdym plikiem.
3. **Cofnięcie `fallback:false`** → brak tabeli znów udaje pustą listę (FIX-9).
4. **Liczenie `UNTIL`/`recurrenceId` w strefie spotkania zamiast UTC** →
   powtórka błędu 2h (FIX-1).
5. **„to i następne" zrobione jako edycja in-place** zamiast rozszczepienia serii
   → cicha utrata wystąpień. To jest **rozszczepienie**.
6. **Drugi walidator `recurrenceRule`** zamiast reużycia whitelisty FIX-2 → nowa
   dziura na wstrzyknięcie CR/LF na trasach `/occurrence`.
7. **Zwrócenie `title_snapshot` komuś, kto stracił dostęp** (§U.4) → wyciek.
8. **Zmiana `artifactRegistryService`/`handoffSpineService`/`recurrenceEngine`**
   → Z17, odrzucenie. H.1 robisz **opcją B**, dookoła tych plików.
9. **Wejście we front** (`src/components/Meeting/**`) → Z17 + złamanie podziału
   FRONT/TYŁ i reguły 7.
10. **Osłabienie asercji strażników wysyłki albo testów ICS** → odrzucenie
    dyżuru; te testy są dowodem DEC-65.

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie otwierasz modułu, nie zmieniasz `MODULE_MEETING`;
- nie tworzysz flagi;
- nie rozszerzasz `ArtifactOriginRuntimeValues` o `'meeting'`;
- nie piszesz do `artifact_handoff_proposals`/`artifact_handoff_receipts` poza
  `materializeProposal`;
- nie dotykasz `attendees_json`/`decisions_json` (pozycja otwarta nr 2 dnia 16 —
  nierozstrzygnięta);
- nie budujesz publicznych linków do materiałów dla gości zewnętrznych;
- nie robisz `rebase` na nowszy tip m03 (DEC-95 — robi to nadzorca);
- nie wysyłasz ani jednego realnego e-maila.

---

## 11. NA KONIEC

Ten dyżur ma jeden cel: **domknąć to, co dzień 16 uczciwie zostawił**, i zrobić
to tak, żeby nadzorca mógł podpisać moduł bez trzeciej rundy. Dwie rzeczy
decydują o odbiorze:

1. **H.1 opcją B — bez eskalacji.** Rozstrzygnięcie `DEC-87` jest w §H.1. Nie
   potrzebujesz atomowej transakcji; potrzebujesz **jawnego stanu `failed`
   i bezpiecznego ponowienia**. Zbuduj to i udowodnij testem wymuszonej awarii.
2. **Testy na REALNYM routerze i REALNYM PG — także dla tras dnia 16.** To jest
   dług, który ten dyżur spłaca. Test na zmockowanym serwisie go nie spłaca.

Reszta jest mechaniką: trzy uczciwe zakresy edycji serii (z rozszczepieniem,
nie edycją in-place), resolver dostępu, który nie wycieka tytułów, kontrakty dla
frontu i pełna macierz ról.

**Zero realnych maili. Zero zmian poza Meetings. Zero frontu. Moduł zostaje
zamknięty.**
