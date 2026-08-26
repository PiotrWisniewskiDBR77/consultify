# INSTRUKCJA DYŻURU nr 10 — Codex — „Meetings: dokończenie modułu — realne Decyzje i follow-upy, przepływ notatka→Materials/My Work/Initiatives z rodowodem, wymagania kalendarzowe właściciela, przygotowanie otwarcia dla ról klienckich"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–9. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Poprzednie dyżury dotyczyły Admin/Superadmin (nr 1–2), My Work (nr 3),
Results i Finance (nr 4), Initiatives (nr 5), Szablonów (nr 6), Assessment
(nr 7) oraz dwóch kolejnych obszarów (nr 8–9). **Ten dyżur ich nie
kontynuuje.** To osobny obszar budowy: **moduł Meetings**, wg **decyzji
właściciela `DEC-2026-08-25-58` (pełny zakres)**.

**Uwaga o numeracji — przeczytaj, żeby się nie pomylić.**

| Moduł | Katalog rejestru w repo | Trasy runtime | Decyzja o gramatyce tras |
| --- | --- | --- | --- |
| Meetings | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/` | `/meetings` (lista), `/meetings/:meetingId` (karta), `/meetings/:meetingId/{minutes,decisions}`, `/meetings/:meetingId/notes/:noteId` | `DEC-2026-08-24-07` (`OWNER_DECISION_LEDGER_2026-08-24.md:29`) |

`/meeting` (liczba pojedyncza) i `/meeting?meetingId=X` to **trwałe
przekierowania**, nie druga tożsamość modułu. Kontrakt funkcjonalny leży
w `docs/modules/13_meeting/CURRENT_CONTRACT.md` — prefiks `13` w tej ścieżce
to numer STAREGO katalogu dokumentacji, nie numer modułu w fali. Rejestr
odbiorowy fali to **`modules/08_MEETINGS/`** i tylko on jest wiążący.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Moduł Meetings jest dziś ZAMKNIĘTY dla ról klienckich i po Twoim dyżurze
nadal ma być zamknięty. Otwarcie wykonuje nadzorca, po odbiorze, jedną
zmianą konfiguracji — nie Ty.**

Konkretnie:

1. **NIE zmieniasz `MODULE_MEETING: 'closed'`** w `src/utils/betaAccess.ts:53`
   na `'open'`. NIE usuwasz `MODULE_MEETING` z listy zablokowanych
   w `src/utils/pilotAccess.ts:66`. NIE zmieniasz `closedBetaModuleGate`
   tak, żeby przepuszczał role klienckie **domyślnie**.
   Twoim produktem w pozycji `G.1` jest **przełączalność** — czyli taka
   konstrukcja, w której nadzorca po odbiorze zmienia **jedną wartość
   w jednym miejscu** i moduł się otwiera na wszystkich trzech bramkach
   naraz. Nie samo otwarcie.
2. **Nie powstaje żadna nowa flaga funkcyjna.** Zero. Jeżeli uznasz, że
   potrzebujesz flagi — to jest **STOP**, nie improwizacja. Powód: CLAUDE.md
   reguła 9 (zakaz masowego włączania flag) i fakt, że moduł ma już trzy
   bramki; czwarta zrobiłaby z tego labirynt.
3. **Wszystko, co budujesz, musi być realne.** Zakaz atrap jest w tym dyżurze
   ostrzejszy niż zwykle, bo **cały werdykt sceptyka, który ten dyżur
   wywołał, dotyczy właśnie atrap**: martwych endpointów zwracających 410,
   kolumny „Follow-upy" liczącej dane, których nikt nie umie zapisać,
   przycisku „Brief operatora" prowadzącego na ekran bez briefu i przepływu
   do Materials, który materializuje notatkę jako wskaźnik na samą siebie.
   **Kontrolka bez działania = STOP i wpis w raporcie, nigdy „na razie
   zostawiam".**
4. **Odbiór wizualny = nadzorca, po dyżurze.** Twoja rola kończy się na
   „gotowe do zrzutu przez nadzorcę". **Nigdy** nie piszesz „gotowe do
   pokazania właścicielowi" ani „gotowe do otwarcia modułu".
   Powód: CLAUDE.md reguła 7 — właściciel nigdy nie jest pierwszym testerem
   wizualnym.
5. **Migracje TAK, ale wyłącznie addytywne i z dowodem idempotencji.**
   Ten dyżur jest pierwszym od kilku, w którym migracje są **konieczne**
   (model uczestników, strefa czasowa, cykliczność, decyzje). Reguły
   w §0.3 są twarde i nie mają wyjątków.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości
reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.

   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, nie startuj z `main`,
   nie startuj z `Londyn`, nie startuj z żadnej gałęzi `codex/preserve-*`
   ani `codex/wave3-16-module-acceptance-*`. Załóż raport, wpisz pozycję STOP
   z wynikiem obu komend powyżej i zakończ dyżur. To jedyna dopuszczalna
   reakcja.

   Powód twardości: `codex/m03-admin-20260824` niesie **komplet materiałów
   wiążących tego dyżuru** — rejestr decyzji z `DEC-2026-08-25-58`,
   zaakceptowaną kartę SPEC-A (`DEC-2026-08-25-54`, commit `1e33d56429`),
   kanoniczną gramatykę tras (`DEC-2026-08-24-07`) i rejestr uwag właściciela
   `RECOVERED_OWNER_FEEDBACK_2026-08-22.md`. Praca poza tą bazą = praca bez
   wymagań i praca na karcie, której właściciel nie zaakceptował.

3. **Sprawdź, że materiały wiążące faktycznie widzisz** (warunek wstępny,
   nie formalność):

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md          # oczekiwane 110
   grep -n "DEC-2026-08-25-58" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-24-07" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "MYW-CAL-REC-00" docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md      # oczekiwane 102
   grep -n "MET-F-006" docs/modules/13_meeting/CURRENT_CONTRACT.md
   ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/evidence/etap2/
   ```

   Brak któregokolwiek = **STOP**.

4. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/meetings-day10-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/meetings-day10-20260825`.)

5. Pracujesz we **własnym worktree**, nigdy w cudzym:

   ```bash
   git worktree add /private/tmp/consultify-meetings-day10 codex/meetings-day10-<data>
   cd /private/tmp/consultify-meetings-day10
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź | Push wykonuje wyłącznie nadzorca sesji głównej |
| Z2 | **Nie dotykasz `origin/demo`** ani lokalnego `demo`, ani `Londyn` | `demo` = święta baza deployu |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych** | Krach 3/4 powstał dokładnie tak |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików oznaczonych `PRESERVED_PRODUCT_WIP` / `NO_COPY` w `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md` | Wymagania są **już** przełożone na rejestr uwag i decyzje. Zajrzenie tam nie da Ci nic nowego, a może Cię skłonić do cofnięcia modułu |
| **Z5** | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`, ani `grep -r`** | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree**: `/private/tmp/consultify-m03-admin`, `/private/tmp/consultify-m01-organization`, `/private/tmp/consultify-m02-settings`, `/private/tmp/consultify-mod0*`, `/private/tmp/consultify-admin55-*`, `/private/tmp/consultify-day2-*`, `/private/tmp/consultify-results-finance-day4`, `/private/tmp/consultify-initiatives-day5`, `/private/tmp/consultify-templates-day6`, `/private/tmp/consultify-assessment-day7`, `/private/tmp/consultify-day10-instrukcja`, `/private/tmp/consultify-wave3-finance-candidate`, `/private/tmp/consultify-notifications-n1` | Cudze worktree, część jest w użyciu przez równoległe dyżury |
| Z7 | **Nie zajmujesz portów 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4312, 4370, 4418, 4428, 4480/4481** | 3987 = sesja nadzorcza; 4280/4281 = dyżur nr 4; 4290/4291 = dyżur nr 5; 4294/4295 = dyżur nr 7; reszta = zajęte runtime'y odbiorowe. Jeśli potrzebujesz lokalnego runtime — **4300/4301** |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak zmiennych env, brak redeployu, brak logów produkcyjnych | Produkcja/demo poza Twoim zakresem |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem** — nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB (`consultify_w3_meetings_owner_night_20260822`, `consultify_w3_meetings_owner_recovered_20260823`) | Reguła „dane demo = twarz produktu". Retained-DB są dowodem odbiorowym cudzego etapu — nadpisanie ich kasuje dowód |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi. Zero zmian `MODULE_MEETING: 'closed'` → `'open'`** | CLAUDE.md reguła 9 + ★ KRYTYCZNE OGRANICZENIE pkt 1 |
| Z11 | **Nie zmieniasz `src/components/ProtectedRoute.tsx`** ani żadnego guardu ról poza jawnym zakresem `G.1`; **nie zmieniasz gramatyki tras** `/meetings/*` z `DEC-2026-08-24-07` ani `src/routes/routeConfig.ts` | Gramatyka tras jest zaakceptowana przez właściciela; decyzje bezpieczeństwa P0 poza Twoim zakresem |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY10_REPORT_<data>.md`. Jedyny inny dokument, który wolno Ci zmienić, to `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — i **wyłącznie** w ramach pozycji `R.1` | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** (w szczególności `:29` `DEC-2026-08-24-07`, `:100` `DEC-48`, `:104` `DEC-52`, `:106` `DEC-54`, `:110` `DEC-58`) i nie podważasz ich w kodzie ani w raporcie | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **Nie budujesz generowania treści modelem.** `generate-notes` i `Brief operatora` traktujesz jako **powierzchnie nad istniejącymi serwisami** (`meetingIntelligenceService`, `aiOperatorService`) albo jako uczciwy `BRAK_UI_JEST_API`. Nie podpinasz dostawcy modelu, nie zmieniasz promptów, nie włączasz przechwytywania (`capture`) | Silnik AI = moduł agenta (`modules/07_MY_WORK_AGENT/`), ostatni w programie. `meetingCaptureDefaultOff.contract.test.ts` pilnuje, że przechwytywanie zostaje OFF |
| Z15 | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** W tym module to jest wprost wywalczone: `MeetingHub.tsx:102-105` odróżnia „błąd pobrania briefu" od „brak briefu" (`M12-F04`), `meetingService.ts:390-395` odmawia fałszywego sukcesu przy nieznanym follow-upie (`M12-F01`) | Uczciwy pusty stan > udawany ekran. Cofnięcie tych dwóch napraw = odrzucenie dyżuru |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `server/src/services/frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts` ani żadnego pliku definiującego capability ról poza jawnym zakresem `G.1` | Model uprawnień naprawiany in-house. Wolno **czytać** i **cytować w raporcie** |
| **Z17** | **★ Zakaz wszystkiego poza modułem Meetings.** Nie dotykasz: Organization, Settings, Admin, Superadmin, Chat, Interview, Assessment, Tools, Initiatives, Execution, Results, Finance, Audits, Partner, My Work — **z trzema imiennymi wyjątkami** opisanymi w ramce poniżej (§H.2, §H.3, §U.5). Ostra granica w ramce | Program konsolidacji jest „jeden moduł na raz". Karta `/meetings/:id` ma **akcept właściciela na zrzutach** (`DEC-54`) — przypadkowa zmiana powłoki kasuje jedyną rzecz, która przeszła |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru** | **Lekcja z odbioru dnia 2:** Codex po cichu zmienił globalny mock w `tests/setup.ts` i wywalił **27 testów w cudzych modułach** — w modułach, których nie dotykał i których nigdy nie uruchomił |

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
   testy (np. `src/components/Meeting/__tests__/meetingDay10Harness.ts`).
   Nowy plik, nie dopisek do istniejącego helpera współdzielonego.

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka", „to jest
addytywne, nic nie zepsuje", „inaczej mój test nie przejdzie". Jeśli Twój test
nie przechodzi bez zmiany globalnego mocka — to jest **STOP**, opisany
w raporcie, nie zmiana globalnego mocka.

**Zasięg Z17 — konkretnie. Granica jest ostra i przebiega tak:**

```
WOLNO (Twój zakres):
  server/src/routes/meeting.routes.ts
  server/src/services/meetingService.ts
  server/src/services/meetingBoundary/**                  (+ __tests__ obok)
  server/src/routes/ai-operator.routes.ts                 (WYŁĄCZNIE gałąź /meetings/:meetingId/brief — §B.1)
  server/migrations/20260826_meetings_day10_*.sql         (NOWE pliki, nazwa wg §0.3)
  src/components/Meeting/**                               (Hub, karta, __tests__)
  src/services/api.ts                                     (WYŁĄCZNIE dopisanie funkcji meeting* — plik współdzielony, patrz §0.4a)
  src/utils/betaAccess.ts                                 (WYŁĄCZNIE §G.1, BEZ zmiany wartości 'closed')
  src/utils/pilotAccess.ts                                (WYŁĄCZNIE §G.1, BEZ usuwania MODULE_MEETING)
  server/src/middleware/betaGate.middleware.ts            (WYŁĄCZNIE §G.1)
  public/locales/{pl,en}/translation.json                 (TYLKO klucze meeting.*)
  scripts/dev/seed-wave3-meetings-owner-review.mjs        (TYLKO w ramach §T.5 — dane do zrzutów)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/evidence/**            (TYLKO nowe zrzuty §R.2)
  docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY10_REPORT_<data>.md            (jedyny nowy dokument)
  tests/unit/meeting/**  ·  tests/integration/routes/meeting.*                     (NOWE pliki; istniejące — patrz §T.1)

TRZY IMIENNE WYJĄTKI POZA MODUŁEM (i nic ponad to):
  §H.2 — dokładnie jedno miejsce zapisu zadania w My Work i jedno w Initiatives,
         przez ISTNIEJĄCY serwis/endpoint tych modułów. Wolno je WOŁAĆ.
         NIE wolno zmieniać ich kodu, schematu ani UI.
  §H.3 — dokładnie jedno miejsce odczytu rodowodu po stronie Materials
         (kolumna/sekcja „Źródło"). Zmiana ograniczona do wyświetlenia pola,
         które i tak już jedzie z API. Każda inna zmiana w Materials = STOP.
  §U.5 — WOLNO CZYTAĆ i skopiować wzorzec `src/components/MyWork/Calendar/
         CalendarAttendeesField.tsx`. NIE WOLNO go zmieniać ani importować
         z modułu Meetings (kopia własna w src/components/Meeting/, bo
         kontrakt uczestnika spotkania jest szerszy — patrz §U.3).

NIE WOLNO:
  src/components/standard/**  ·  src/components/shared/**   ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  powłoka SPEC-A karty (ArtifactRightPanel, StandardSekcjaDef i pokrewne)  ← akcept DEC-54
  src/routes/AppRoutes.tsx  ·  src/routes/routeConfig.ts
  src/components/MyWork/**  (poza odczytem wzorca z §U.5)
  server/src/services/artifactHandoff/handoffSpineService.ts   ← WOLNO CZYTAĆ i WOŁAĆ; zmiana = STOP
  server/migrations/20260825_meeting_agenda_templates.sql      ← WŁASNOŚĆ DNIA 6 (patrz §1.4)
  server/migrations/20260623_meetings_baseline.sql
  server/migrations/20260912_claude_c_meeting_boundary.sql     ← migracje zastane: TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                         ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej
linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Nie zbiorcze
  „wire meetings everywhere".
- **Conventional commits**, wzór:
  ```
  feat(meetings): structured decision records with provenance (D.2)
  feat(meetings): materialize approved note as a real material artifact (H.1)
  feat(meetings): timezone and recurrence on the meeting model (U.1, U.2)
  test(meetings): negative role matrix for the module gate (G.2)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem.**
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest`
  repo.** Punktowo:
  ```bash
  npx vitest run src/components/Meeting/__tests__
  npx vitest run server/src/services/__tests__/meetingService.test.ts
  npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
  npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
  ```
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**:
  happy path · ścieżka błędu (4xx/5xx z API) · pusty stan · **negatyw
  tenanta** (obcy `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**.
  W tym repo takie testy istnieją (`tests/unit/backend/middleware/
  meetingBetaGate.test.ts:37-45`, `server/src/routes/my-work/__tests__/
  calendar-events.migration.test.ts:15-40`) i wolno Ci je zostawić — ale
  **każda Twoja pozycja musi mieć co najmniej jeden test, który wywołuje
  realny handler / renderuje realny komponent i sprawdza WYNIK.**
  Grep-test wolno dołożyć jako dodatek, nigdy jako dowód.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok
  kodu w `src/` i `server/src/` dodają się normalnie.
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json    # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild src/components/Meeting/MeetingHub.tsx --loader:.tsx=tsx --outfile=/dev/null   # OK
  ```
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`,
     `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`.
     **Zakaz** `DROP`, `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`,
     bezwarunkowego `UPDATE`.
  2. **Nazewnictwo bez kolizji z dniem 6.** Dzień 6 wstawił
     `server/migrations/20260825_meeting_agenda_templates.sql`. Twoje pliki
     nazywasz `20260826_meetings_day10_<temat>.sql` — data **26**, nie 25.
     Powód i pułapka sortowania: `migrate.postgres.ts` stosuje migracje
     w **zwykłym porządku alfabetycznym nazw plików**, nie chronologicznym
     (opisane w nagłówku `20260912_claude_c_meeting_boundary.sql:36-45`).
     Nie dodajesz **żadnego** klucza obcego do tabel, które sortują się
     później — tenant i istnienie rodzica sprawdzasz w warstwie aplikacji,
     dokładnie tak, jak robi to `meetingBoundaryService.ts`.
  3. **Nie rozszerzasz `ensureMeetingTables()`** (`meetingService.ts:95-132`)
     o nowe kolumny. To jest leniwy bootstrap z DDL pisanym pod SQLite
     i **nie jest odtwarzalną ścieżką wdrożenia** — tak samo zdecydował
     dzień 6 (nagłówek `20260825_meeting_agenda_templates.sql:1-3`).
     Nowe kolumny idą **wyłącznie** migracją. `ensureMeetingTables()` wolno
     Ci zostawić dokładnie takim, jakim go zastałeś.
  4. **★ DOWÓD IDEMPOTENCJI NA ŚWIEŻEJ BAZIE — warunek oddania pozycji
     z migracją.** Trzy przebiegi, wyniki wklejone do raportu:
     ```bash
     # kontener jednorazowy, dane w pamięci, port spoza listy Z7
     docker run -d --name cx-day10-pg \
       --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
       -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day10 \
       -p 4302:5432 pgvector/pgvector:pg16

     export DATABASE_URL="postgres://postgres:cx@localhost:4302/cx_day10"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (1) świeży przebieg
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (2) powtórka → "Applying migrations: 0"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry      # (3) dry-run → "Pending migrations: 0"
     ```
     **Sprzątanie jest obowiązkowe i jest częścią dowodu** (kontener
     `--tmpfs` nie zostawia wolumenu, ale sprawdzasz to jawnie):
     ```bash
     docker rm -f cx-day10-pg
     docker volume ls -q | grep -i cx-day10 | xargs -r docker volume rm
     docker ps -a --filter name=cx-day10 --format '{{.Names}}'    # oczekiwany wynik: PUSTY
     ```
     Jeżeli przebieg (1) zatrzyma się na **cudzej, niezwiązanej** migracji
     (znany, udokumentowany stan repo — patrz nagłówek
     `20260623_meetings_baseline.sql:11-18`), **to nie jest Twój defekt**:
     wklejasz do raportu nazwę pliku, na którym replay stanął, i wykonujesz
     dowód (1)(2)(3) **celowany na Twoje migracje**, przez ręczne `psql -f`
     w tej samej kolejności. W raporcie oznaczasz to jako
     `IDEMPOTENCJA_CELOWANA`, nie jako `IDEMPOTENCJA_PEŁNA`.
  5. **Zero migracji danych, które zmieniają znaczenie istniejących
     wierszy.** Backfill legacy → nowa tabela jest dozwolony, ale **tylko**
     jako `INSERT ... ON CONFLICT DO NOTHING` z kluczem deduplikacji, tak
     żeby drugi przebieg nie stworzył duplikatu. Źródłowe kolumny
     (`meetings.decisions_json`, `meetings.attendees_json`) **zostają
     nietknięte** — nie kasujesz ich i nie zerujesz.
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodź ich przez
  `--no-verify`. Jeśli hook blokuje — popraw kod, nie hook.
  ```bash
  bash scripts/check-list-canon.sh src/components/Meeting/TwójPlik.tsx
  bash scripts/check-artefakt.sh    # jeżeli istnieje w tej bazie
  ```
  **`scripts/check-list-canon.sh --update` jest w tym dyżurze ZAKAZANE.**
  Baseline `scripts/check-list-canon.baseline.txt` **nie zmienia się** i jest
  jednym z dowodów Bloku 6.
- **Dane demo = twarz produktu.** Każdy probe sprząta po sobie. Zero rekordów
  testowych zostawionych w jakiejkolwiek bazie.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków, zero
   `sampleData`, zero zaszytych tablic, zero `localStorage` jako źródła
   prawdy. Pusty wynik z API = uczciwy pusty stan, nie fikcyjne dane.
2. **Zapis z readbackiem** — po `POST`/`PUT`/`PATCH` ekran ponownie odczytuje
   stan z serwera i pokazuje to, co serwer faktycznie zapisał. Zakaz
   optymistycznego „sukces" bez potwierdzenia. **`updateMeetingFollowUpStatus`
   (`meetingService.ts:390-395`) jest wzorcem tego, jak się tego pilnuje po
   stronie serwera** — nie wolno tego wzorca osłabić.
3. **Zero atrap.** Każda kontrolka, którą widać, coś robi. Kontrolka, dla
   której nie ma API — **nie powstaje**; zamiast niej idzie wpis
   `BRAK_API` do raportu. Przycisk prowadzący na ekran, który nie pokazuje
   obiecanej treści (dzisiejszy „Brief operatora", §B.1), jest dokładnie tym
   defektem, którego nie wolno powielić.
4. **Minimum 4 testy zachowania** przechodzą: happy · błąd · pusty stan ·
   negatyw tenanta. **Testy grepujące źródło nie liczą się** (§0.3).
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson
   `#85182F`. Czerwień **wyłącznie** semantyka krytyczna. CTA i stany aktywne
   = neutralne, **nigdy `bg-c-accent`**, **nigdy `btn-primary` jako „zakładka
   aktywna"**. Fokus = niebieski
   `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod — **klucz tworzysz
   w chwili tworzenia napisu, nie „na końcu"**. Zero polskich literałów
   w JSX, zero angielskich literałów w JSX. Klucze w
   `public/locales/pl/translation.json` **i**
   `public/locales/en/translation.json`. Stan zastany: **137 kluczy
   `meeting.*` w PL i 137 w EN, parytet pełny** — Twój dyżur ten parytet
   utrzymuje (§T.4).
7. **Light i dark** — powierzchnia wygląda poprawnie w obu motywach.
8. **★ Zrzut własny dla każdej NOWEJ powierzchni wizualnej** (nowe pole,
   nowa sekcja, nowa kolumna, nowy modal) — dev-render/harness z danymi
   z fixture, **light i dark**, wykonany przez Ciebie, wrzucony do
   `modules/08_MEETINGS/evidence/day10/`. Zrzut czysty: zero gwiazdek, zero
   ozdób, tokeny `c-*`. **Bez zrzutu pozycja wizualna jest CZĘŚCIOWA.**
   Wzorzec skryptu: `scripts/dev/*-screenshots.mjs`; dane:
   `scripts/dev/seed-wave3-meetings-owner-review.mjs`.
9. **Plik przepuszczony przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych. Równolegle 27 testów w cudzych modułach było
czerwonych — przez zmianę w pliku współdzielonym.

**Przed oddaniem raportu wykonujesz pomiar zasięgu:**

1. Wypisz **wszystkie** pliki, które dotknąłeś:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Z tej listy wyodrębnij pliki **współdzielone** — takie, które importuje
   ktokolwiek spoza Twojego zakresu. Sprawdzasz to jawnie, nie z pamięci:
   ```bash
   grep -rln "services/api" src/ | wc -l
   grep -rln "betaAccess" src/ | head -20
   grep -rln "pilotAccess" src/ tests/ | head -20
   grep -rln "betaGate.middleware" server/src/ tests/ | head -20
   grep -rln "handoffSpineService" server/src/ | head -20
   grep -rln "meetingService" server/src/ tests/ | head -20
   ```
   **W tym dyżurze pliki współdzielone z definicji to:**
   `src/services/api.ts` (importuje go **prawie całe UI** — to jest
   najgroźniejszy plik, którego dotkniesz),
   `src/utils/betaAccess.ts` i `src/utils/pilotAccess.ts` (bramkują **cały
   sidebar**, nie tylko Meetings),
   `server/src/middleware/betaGate.middleware.ts` (mountowany przy wielu
   routerach),
   `server/src/services/artifactHandoff/handoffSpineService.ts`
   (**współdzielony z Chat, Ideas i Organization** — `PRODUCER_KINDS`
   `handoffSpineService.ts:46`; **tylko odczyt i wołanie, zmiana = STOP**),
   `public/locales/{pl,en}/translation.json`.
3. **Uruchom testy KATALOGÓW konsumentów**, nie tylko własnych plików.
   Minimum dla tego dyżuru:
   ```bash
   npx vitest run src/components/Meeting/__tests__
   npx vitest run src/routes/__tests__/meetingsCanonicalRoute.test.ts
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run tests/unit/meeting
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   ```
   jeśli ruszałeś `src/services/api.ts`:
   ```bash
   npx vitest run tests/unit/services            # jeśli katalog istnieje
   grep -rln "from '@/services/api'" src/ | wc -l   # i wymień w raporcie skalę
   ```
   jeśli ruszałeś `betaAccess.ts` / `pilotAccess.ts` / `betaGate.middleware.ts`:
   ```bash
   npx vitest run tests/unit/utils/pilotAccess.test.ts
   grep -rln "BETA_MENU_STATUS\|lockClosedBetaModules" src/ tests/ | head -20
   ```
   jeśli ruszałeś `handoffSpineService` **jako konsument** (wołanie):
   ```bash
   npx vitest run server/src/services/artifactHandoff/__tests__
   npx vitest run server/src/services/meetingBoundary/__tests__
   ```
   jeśli dodałeś migracje:
   ```bash
   npx vitest run tests/unit/migrations           # jeśli katalog istnieje
   grep -rln "migrations" tests/unit | head -20   # i wymień, czego NIE uruchomiłeś
   ```
4. **W raporcie deklarujesz zasięg jawnie**, w sekcji „Testy":
   - `ZASIĘG PEŁNY` — uruchomiłeś testy wszystkich katalogów konsumentów
     plików współdzielonych, które dotknąłeś, i podajesz ich wyniki;
   - `ZASIĘG CZĘŚCIOWY` — uruchomiłeś tylko własne pliki. **Wtedy piszesz to
     wprost i wymieniasz, czego nie uruchomiłeś i dlaczego.**

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy
improwizacja.**

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej** —
  z jednym jawnym wyjątkiem opisanym w §T.1 i tylko na warunkach tam
  podanych. **To jest w tym dyżurze najbardziej prawdopodobny STOP**
  (48-przepływowy pakiet `meeting.m12-golden-flows` twardo asertuje `410`
  na trzech endpointach — §2.6);
- musiałbyś **zmienić kontrakt `handoffSpineService`** (`TARGET_KINDS`,
  `PRODUCER_KINDS`, stany propozycji). Wolno Ci ten serwis **wołać**;
  zmiana = STOP, bo dzielisz go z Chat, Ideas i Organization;
- musiałbyś dodać migrację **nieaddytywną** albo taką, która zmienia typ
  lub znaczenie istniejącej kolumny;
- musiałbyś **włączyć moduł** dla ról klienckich albo zmienić wartość
  `MODULE_MEETING` (Z10, ★ pkt 1);
- musiałbyś **stworzyć flagę funkcyjną** (Z10);
- musiałbyś **zmienić gramatykę tras** `/meetings/*` (Z11) albo powłokę
  SPEC-A karty zaakceptowaną w `DEC-54`;
- musiałbyś **zbudować kontrolkę, dla której nie ma API** — wtedy nie
  budujesz jej wcale; wpis `BRAK_API` z pełną tabelą jest **wynikiem
  pełnowartościowym** (Z15, DoD 3);
- musiałbyś **wysłać e-mail / zaproszenie kalendarzowe** (ICS, SMTP,
  Google/Outlook). **Dostawcy nie ma i nie budujesz go** — patrz §1.7
  pozycja otwarta nr 2;
- musiałbyś **zgadnąć rozstrzygnięcie kwestii otwartej** z §1.7. **Nie
  zgadujesz** — piszesz propozycję i STOP;
- musiałbyś dotknąć innego modułu poza trzema wyjątkami z ramki Z17,
  uprawnień ról (Z16) albo `ProtectedRoute`/`AppRoutes` (Z11);
- musiałbyś uruchomić `scripts/check-list-canon.sh --update` (§0.3);
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka lub
  configu vitest (Z18)** — to jest STOP zawsze, bez wyjątku i bez
  „addytywnie, więc nic nie zepsuje";
- **pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module** — nie
  „naprawiasz" ich po cichu: opisujesz w raporcie, który commit je zapalił;
- musiałbyś zbudować generowanie treści modelem albo podpiąć dostawcę AI
  (Z14);
- **napotkałeś zmianę, którą robi równolegle nadzorca** (§1.4) — nie
  dublujesz jej, tylko odnotowujesz.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

Moduł Meetings przeszedł w sierpniu trzy etapy: lista `/meetings` została
zaakceptowana przez właściciela (`DEC-2026-08-25-52`), karta `/meetings/:id`
została przebudowana do kanonicznej powłoki artefaktu SPEC-A i **też
zaakceptowana na zrzutach** (`DEC-2026-08-25-54`, evidence `etap2/03`, commit
`1e33d56429`). Po tych akceptach padła teza, że moduł jest kompletny
i można go zamknąć jako `CLOSED_FINAL`.

**Nadzorca uruchomił sceptyka i teza została OBALONA.** Właściciel przyjął
werdykt decyzją **`DEC-2026-08-25-58` — `OWNER_ACCEPT (pełny zakres)`**
(`OWNER_DECISION_LEDGER_2026-08-24.md:110`). `CLOSED_FINAL` dla Meetings jest
**odroczone** do odbioru bloku tego dyżuru.

Osiem blokerów z werdyktu dzieli się na dwie grupy:

**Grupa A — Twoja (blok dnia 10, ten dokument):**

| Bloker | Skrót | Sekcja tej instrukcji |
| --- | --- | --- |
| B1 | Moduł za bramką closed-beta dla ról klienckich | §G |
| B2 | Martwe Decyzje i follow-upy (410 retired, brak ścieżki zapisu) | §D |
| B3 | Ślepy koniec przepływu notatka → Materials (materializacja wskazuje samą siebie) | §H |
| B7 | Rejestr `MODULE_ACCEPTANCE.md` niezgodny ze stanem faktycznym, brak dowodów | §R |
| L1 | Nierozliczone wymagania właściciela `MYW-CAL-REC-001/002/003` | §U |
| L3 | „Brief operatora" prowadzi na kartę, która briefu nie renderuje | §B |

**Grupa B — NIE Twoja. Robi to równolegle nadzorca** (§1.4): B4 (bramkowanie
przycisków), B5 (status), B6 (i18n — polskie literały w gałęzi `en:`),
B8 (kasowanie z czyszczeniem protokołów), K1–K4 (komentarze w kodzie, które
opisują stan nieaktualny).

**Jedno zdanie, które musisz zrozumieć, zanim zaczniesz:** ten dyżur nie
dodaje modułowi nowych funkcji „na wyrost". On **domyka rzeczy, które moduł
już obiecuje w interfejsie, a których nie dowozi**. Kolumna „Follow-upy"
liczy dane, których nikt nie umie zapisać. Sekcja „Decyzje i działania"
pokazuje pustą listę, bo jedyne endpointy zapisu zwracają `410`. Przycisk
„Brief operatora" prowadzi na ekran bez briefu — choć brief jest realnie
liczony i pokazywany dwa panele obok. Zatwierdzona notatka „materializuje
się jako materiał", którym jest ona sama. **To są cztery atrapy, a nie cztery
braki.**

### 1.2. Dokumenty wiążące merytorycznie

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
        :29   DEC-2026-08-24-07  gramatyka tras /meetings (WIĄŻĄCA, Z11)
        :100  DEC-2026-08-25-48  szablony agendy → DZIEŃ 6, nie Ty (§1.4)
        :104  DEC-2026-08-25-52  lista zaakceptowana + i18n statusów
        :106  DEC-2026-08-25-54  karta SPEC-A ZAAKCEPTOWANA (nie ruszasz powłoki)
        :110  DEC-2026-08-25-58  TEN DYŻUR — pełny zakres
docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md
        :34   MYW-CAL-REC-001    strefa czasowa, cykliczność, lokalizacja/link, zaproszeni
        :35   MYW-CAL-REC-002    org/projekt + goście zewnętrzni, status zaproszenia, uprawnienia
        :36   MYW-CAL-REC-003    artefakty (idee, notatki) dołączane i linkowane w zaproszeniu
docs/modules/13_meeting/CURRENT_CONTRACT.md
        :29-37  MET-F-001..009   MET-F-006 „Protokół i publikacja w Materials" = gap (§H)
docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
        (102 linie — TYLKO ODCZYT poza §R.1)
docs/ui-standards/TRIADA_KANON.md                      ← lista /meetings
Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md     ← karta SPEC-A, archetyp C (Rekord)
```

### 1.3. Decyzje wiążące — pięć, wszystkie z 24–25 sierpnia

1. **`DEC-2026-08-24-07`** — gramatyka adresów. `/meetings` lista,
   `/meetings/:meetingId` karta, `/meetings/:meetingId/{minutes,decisions}`,
   `/meetings/:meetingId/notes/:noteId`. `/meeting` = trwałe przekierowanie.
   **Nie zmieniasz jej** (Z11). Pilnuje jej
   `src/routes/__tests__/meetingsCanonicalRoute.test.ts`.
2. **`DEC-2026-08-25-48`** — szablony agendy budowane w **dniu 6**.
   Nie duplikujesz (§1.4).
3. **`DEC-2026-08-25-52`** — lista zaakceptowana; w pakiecie i18n statusów
   listy. **i18n robi nadzorca** (§1.4), Ty nie ruszasz istniejących
   etykiet statusów.
4. **`DEC-2026-08-25-54`** — karta `/meetings/:id` w powłoce SPEC-A
   **zaakceptowana na zrzutach**. Wolno Ci **dodać sekcję/wiersz w centrum
   karty**; **nie wolno** zmieniać powłoki (Menu 1, `ArtifactRightPanel`,
   kebab, chipsy stanu, kolejność trzech istniejących sekcji).
5. **`DEC-2026-08-25-58`** — ten dyżur, pełny zakres, `CLOSED_FINAL`
   odroczone.

### 1.4. ★ KOORDYNACJA — dwa równoległe strumienie, których NIE dublujesz

To jest najważniejszy akapit §1. Pracujesz **równolegle** z dwoma innymi
strumieniami, które dotykają tego samego modułu.

**(a) Dzień 6 — Szablony (`codex/templates-day6-20260825`).**
`DEC-2026-08-25-48` przypisał **szablony agendy spotkań do dnia 6**. Na
gałęzi dnia 6 leży już commit `b61255f514`
„feat(meetings): add agenda template registry migration (S8.1)", który
tworzy tabelę `meeting_agenda_templates`
(`server/migrations/20260825_meeting_agenda_templates.sql`).

**Twoje obowiązki:**
- **NIE budujesz szablonów agendy.** Ani CRUD, ani UI, ani migracji.
  Zbudowanie ich = duplikat i konflikt scalenia.
- **NIE dotykasz** `server/migrations/20260825_meeting_agenda_templates.sql`
  (Z17).
- **Twoje migracje mają datę `20260826`**, żeby nie kolidowały nazwą
  i sortowały się PO dniu 6 (§0.3 pkt 2).
- **W Bloku 0 sprawdzasz, czy dzień 6 jest już scalony do Twojej bazy:**
  ```bash
  git merge-base --is-ancestor b61255f514 HEAD && echo "DZIEN6 SCALONY" || echo "DZIEN6 NIESCALONY"
  ls server/migrations/20260825_meeting_agenda_templates.sql 2>/dev/null
  grep -rn "meeting_agenda_templates" server/src src | grep -v __tests__ | head
  ```
  - **SCALONY** → wolno Ci **konsumować** szablony w modalu tworzenia
    spotkania (wybór szablonu → wypełnienie pola agenda), o ile istnieje
    już serwis/endpoint. Konsumpcja = jedno wywołanie istniejącego API,
    nie budowa.
  - **NIESCALONY** → **nie budujesz nic w tym temacie**, wpisujesz do
    raportu „szablony agendy: własność dnia 6, niescalone w mojej bazie,
    pole `agenda` zostawiam bez zmian".
  Wynik tego sprawdzenia jest **obowiązkową pozycją raportu**.

**(b) Naprawy szybkie — nadzorca (`codex/meetings-quickfixes-20260825`).**
Nadzorca robi **równolegle, we własnej gałęzi**: i18n (B6 — polskie
literały w gałęzi `en:` na karcie, m.in. `MeetingObjectPage.tsx:415-416`,
`:440-441`, `:470`), bramkowanie przycisków (B4), status (B5), kasowanie
z czyszczeniem protokołów (B8) i komentarze (K1–K4).

**Twoje obowiązki:**
- **ZAKAZ dublowania tych napraw.** Nie poprawiasz polskich literałów
  w istniejących etykietach, nie zmieniasz logiki statusu, nie ruszasz
  kasowania, nie przepisujesz komentarzy. Nawet jeśli widzisz, że są złe.
  **Twoje** i18n dotyczy **wyłącznie kluczy, które sam tworzysz**.
- **W Bloku 0 sprawdzasz stan tej gałęzi:**
  ```bash
  git log --oneline codex/m03-admin-20260824..codex/meetings-quickfixes-20260825 | head -20
  ```
  - **PUSTO** (gałąź na tym samym tipie, stan w chwili pisania tej
    instrukcji) → pracujesz normalnie, po prostu nie wchodzisz w tamte
    tematy.
  - **SĄ COMMITY** → **rebasujesz swoją gałąź na tip quickfixów**
    *przed pierwszym commitem*, żeby nie zderzyć się przy scalaniu:
    ```bash
    git rebase codex/meetings-quickfixes-20260825
    ```
    i wpisujesz do raportu, na jaki SHA rebasowałeś. Jeżeli rebase
    powoduje konflikt w pliku, którego nie planowałeś dotykać — **STOP**,
    nie rozwiązujesz cudzego konfliktu.
  - Jeżeli commity pojawią się **w trakcie** dyżuru — nie gonisz ich;
    odnotowujesz w raporcie i zostawiasz scalenie nadzorcy.

**Zasada rozstrzygająca spór o zakres:** jeżeli nie wiesz, czy coś należy
do Ciebie, czy do jednego z tych dwóch strumieni — **należy do nich**,
a Ty wpisujesz to do „Znalezisk".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ `410` na trzech endpointach nie jest defektem — jest kontraktem
   pilnowanym przez test.** `POST /:id/decisions`
   (`meeting.routes.ts:300-311`), `POST /:id/follow-ups` (`:314-325`)
   i `PATCH /:meetingId/follow-ups/:followUpId` (`:328-340`) zwracają `410`
   **celowo**: były niegdyś nieuzbrojonym zapisem swobodnego tekstu.
   `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts:349-454`
   **twardo asertuje `410` i kod `MEETING_PROPOSAL_REQUIRED`** w ośmiu
   miejscach. **Nie „odblokowujesz" tych tras.** Budujesz nowy, strukturalny
   zasób pod nową ścieżką (§D.2) — wtedy tamten pakiet zostaje zielony
   *bez jednej zmiany*. Przywrócenie starych tras = STOP (§T.1).
2. **`meetings` i `meeting_follow_ups` powstają leniwie, nie migracją.**
   `ensureMeetingTables()` (`meetingService.ts:95-132`) tworzy je przy
   pierwszym użyciu, DDL-em pisanym pod SQLite. Migracja
   `20260623_meetings_baseline.sql` istnieje **tylko jako straż świeżej
   bazy** i jej nagłówek (`:1-24`) tłumaczy dlaczego. **Nowych kolumn nie
   dopisujesz do `ensureMeetingTables()`** (§0.3 pkt 3).
3. **`meetings.attendees_json` to płaska lista stringów.**
   `MeetingRecord.attendees: string[]` (`meetingService.ts:23`), UI trzyma
   je jako tekst rozdzielony `\n` (`MeetingHub.tsx:111`, `:539-545`),
   tabela pokazuje **tylko licznik** (`:340-345`), wyszukiwarka szuka po
   treści stringa (`:154`). **Nie ma nigdzie tożsamości uczestnika.**
   To jest korzeń `MYW-CAL-REC-002` i najdroższa pozycja modelowa dyżuru
   (§U.3).
4. **`meetings.decisions_json` jest dziś martwe w obie strony.**
   `createMeeting` wymusza `decisions: []` (`meeting.routes.ts:220`),
   `updateMeeting` **w ogóle nie tyka** `decisions_json`
   (`meetingService.ts:232-293` — brak gałęzi), a jedyna funkcja, która
   tam pisze (`addMeetingDecision`, `:357-375`), **ma jedynego wołającego
   w testach** (`server/src/services/__tests__/meetingService.test.ts:189`).
   To samo dotyczy `addMeetingFollowUp` (`:326`) i
   `updateMeetingFollowUpStatus` (`:377`).
   ```bash
   grep -rn "addMeetingDecision\|addMeetingFollowUp\|updateMeetingFollowUpStatus" server/src src tests | grep -v __tests__ | grep -v "meetingService.ts:"
   # oczekiwany wynik w chwili pisania: tylko komentarz w tests/e2e/meeting/meeting-basic.spec.ts:9
   ```
   **Zweryfikuj to sam w Bloku 0** — jeżeli wynik jest inny, mapa się
   zestarzała i pracujesz na stanie faktycznym.
5. **★ „Materializacja" notatki wskazuje samą siebie.**
   `decideMeetingNote` przy akceptacji woła materializację z
   `targetRecordId: note.id` — czyli wierszem-artefaktem jest **ta sama
   notatka**. Komentarz kontraktowy
   (`meetingBoundary/meetingBoundaryService.ts:518-534`) mówi to wprost
   i deleguje resztę „konsumentowi, który czyta `producer_kind = 'meeting'`
   we własnym serwisie". **Takiego konsumenta nie ma w całym repo.**
   To jest `MET-F-006` = `gap` i cała sekcja §H.
6. **W Materials „materiał" to wiersz `v8_output_artifacts`, a nie
   `meeting_notes`.** Rejestracja idzie przez
   `registerArtifactOrigin(...)` (`server/src/services/v8/
   artifactRegistryService.ts:1289`), a treść leży w tabeli zawartości
   (dla dokumentów: `wave5_artifacts`). Wzorce do skopiowania:
   `POST /api/artifacts/register-chat` (`artifacts.routes.ts:510-596`)
   i `POST /drafts/:draftId/register-in-outputs`
   (`work-canvas.routes.ts:4564-4590`). Szczegóły i trzy pułapki tej
   ścieżki — §H.1.
7. **`handoffSpineService` jest współdzielony.** `PRODUCER_KINDS` (`:46`)
   obejmuje `idea`, `chat`, `meeting`, `organization`; `TARGET_KINDS`
   (`:49`) — `document`, `presentation`, `workbook`, `material`.
   **Wołasz. Nie zmieniasz.** Dodanie tam kind-a = zmiana kontraktu trzech
   cudzych modułów = STOP.
8. **Bramka modułu jest w TRZECH miejscach, a nie w jednym.**
   Klient: `src/utils/betaAccess.ts:53` (`MODULE_MEETING: 'closed'`).
   Serwer: `server/src/middleware/betaGate.middleware.ts:25-37` —
   `closedBetaModuleGate` z **zaszytą** listą ról, mountowany na całym
   routerze (`meeting.routes.ts:146`). Pilot:
   `src/utils/pilotAccess.ts:66` (`MODULE_MEETING` na liście zamkniętych).
   Trzy miejsca, trzy różne mechanizmy, **zero wspólnego źródła prawdy** —
   to jest treść §G.1.
9. **Brief operatora ISTNIEJE i działa.** `GET /api/ai-operator/meetings/
   :meetingId/brief` (`server/src/routes/ai-operator.routes.ts:89-111`)
   z kontrolą tenanta i `canReadMeetingBrief`; klient
   `Api.getAIOperatorMeetingBrief` (`src/services/api.ts:3653`); Hub
   pobiera go (`MeetingHub.tsx:221-262`) i **renderuje w panelu podglądu**
   (`:994-1010`). Przycisk „Brief operatora" w Menu 3 (`:501-514`) woła
   `openMeetingDocument(briefingMeeting)` — czyli **nawiguje na kartę**,
   a karta briefu nie renderuje. To nie jest brak danych. To jest
   niespójność nawigacji (§B.1).
10. **`?sampleData=materials-vnext` kłamie.** Lista Materials ma tryb
    fixture (`src/components/ReportsAndPresentations/
    materialsOwnerSampleData.ts:10-13`, `useRapData.ts:289`), który
    podmienia dane na zaszyte. **Weryfikując §H, nigdy nie używaj tego
    parametru** — „zobaczysz" materiał, którego nie ma w bazie.
11. **Tytuł z „test"/„smoke"/„probe" znika z listy Materials.**
    `isDraftHeuristicTitle` (`artifactRegistryService.ts:2464-2470`)
    oznacza taki wiersz jako szkic, a lista domyślnie szkice ukrywa
    (`artifacts.routes.ts:383-395`). Twoje dane dowodowe **nie mogą** mieć
    słowa „test" w tytule, bo dowód będzie pusty i pomyślisz, że zapis nie
    działa.
12. **Dwa uczciwe zachowania są wywalczone i chronione (Z15):**
    rozróżnienie „błąd pobrania briefu" ≠ „brak briefu"
    (`MeetingHub.tsx:102-105`, `M12-F04`) i odmowa fałszywego sukcesu przy
    nieznanym follow-upie (`meetingService.ts:390-395`, `M12-F01`).
    Ani jednego z nich nie wolno cofnąć „przy okazji przebudowy".

### 1.6. ★ Reguła 7 — dlaczego nic nie idzie na ekran właściciela

CLAUDE.md reguła 7: **właściciel nigdy nie jest pierwszym testerem
wizualnym.** Kolejność jest sztywna: (a) prototyp/opis → (b) **Ty renderujesz
realny ekran i sam robisz zrzut** (DoD 8) → (c) zrzut czysty → (d) dopiero
wtedy patrzy nadzorca, a potem właściciel — **do akceptu, nie do odkrywania
zepsucia**.

Praktyczna konsekwencja dla Ciebie: **w raporcie piszesz „gotowe do zrzutu
przez nadzorcę"**, nigdy „gotowe do pokazania właścicielowi", nigdy „gotowe
do otwarcia modułu". Karta `/meetings/:id` ma akcept właściciela z `DEC-54` —
każde Twoje dołożenie do niej wraca do niego na zrzucie, więc ma być zgodne
z powłoką co do tokenów i odstępów.

### 1.7. Pozycje otwarte — pięć rzeczy, których NIE ZGADUJESZ

Każda z nich kończy się **STOP-em z propozycją** w raporcie. STOP tutaj
kosztuje minuty i **odblokowuje decyzję nadzorcy** — dyżur bez tych pięciu
STOP-ów zostawia nadzorcę bez pytań, na które musi odpowiedzieć.

| # | Pozycja otwarta | Gdzie | Twój produkt |
| --- | --- | --- | --- |
| 1 | Ścieżka API dla strukturalnych decyzji: nowy zasób (`/decision-records`) czy przywrócenie `/decisions` z nowym kontraktem? | §D.2 | Domyślnie **nowy zasób** (nie łamie 48 przepływów). STOP z propozycją zmiany, jeśli nadzorca chce inaczej |
| 2 | Czy „zaproszenie" ma cokolwiek **wysyłać** (e-mail/ICS/Google/Outlook)? | §U.3 | **NIE budujesz wysyłki.** Status zaproszenia = stan w bazie + widok w UI. STOP z opisem, czego brakuje (dostawca, `SET-INT-REC-001`) |
| 3 | Semantyka edycji serii cyklicznej: „to wystąpienie" / „to i następne" / „cała seria" | §U.2 | Domyślnie **seria + wyjątki**, materializacja instancji dopiero przy edycji pojedynczego wystąpienia. STOP, jeśli okaże się nieaddytywne |
| 4 | Czy handoff notatki do My Work / Initiatives jest **automatyczny przy akceptacji**, czy **osobną decyzją człowieka**? | §H.2 | Domyślnie **osobna decyzja człowieka** (spójne z governance notatek). STOP z propozycją |
| 5 | Co się dzieje z historycznymi `decisions_json` / `attendees_json` po backfillu — zostają jako legacy read-only czy znikają z UI? | §D.3, §U.3 | Domyślnie **backfill + kolumna źródłowa nietknięta, UI czyta wyłącznie nowy model**. STOP z opisem skutków |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Wszystkie liczby i numery linii poniżej zostały zweryfikowane na tipie
`codex/m03-admin-20260824` w chwili wystawiania instrukcji.
Mapa techniczna starzeje się w ~3 dni. Blok 0 krok 5 każe Ci ją
zweryfikować ponownie i pracować na stanie faktycznym, nie na tym
dokumencie. Każdą rozbieżność wpisujesz do „Korekt wobec instrukcji".**

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

```
server/src/routes/meeting.routes.ts                              591
server/src/services/meetingService.ts                            405
server/src/services/meetingBoundary/meetingBoundaryService.ts    690
src/components/Meeting/MeetingHub.tsx                           1681
src/components/Meeting/MeetingObjectPage.tsx                     575
tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts   804
server/src/routes/__tests__/meeting.routes.test.ts               322
src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx       354
src/components/Meeting/__tests__/MeetingObjectPage.test.tsx      241
src/components/Meeting/__tests__/MeetingHub.deriveMeetingLifecycle.test.ts   67
tests/unit/backend/middleware/meetingBetaGate.test.ts             47
klucze i18n meeting.*                                       PL 137 / EN 137, parytet pełny
```

### 2.2. Trasa i montaż — jak spotkanie trafia na ekran

```
/meetings                       → MeetingHub.tsx                (lista, StandardTable + Menu 1/2/3 + preview)
/meetings/:meetingId            → MeetingObjectPage.tsx         (karta SPEC-A, archetyp C Rekord)
/meetings/:meetingId/minutes    → ta sama karta, sekcja "Protokół"
/meetings/:meetingId/decisions  → ta sama karta, sekcja "Decyzje i działania"
/meetings/:meetingId/notes/:id  → ta sama karta, sekcja "Protokół" z wybraną notatką
/meeting  ·  /meeting?meetingId=X → trwałe przekierowanie (AppRoutes.tsx:661-681)
```

Karta wyprowadza aktywną sekcję **prosto z `location.pathname`**, nie ze
stanu lokalnego (`MeetingObjectPage.tsx:224-239`). Trzy sekcje są
zdefiniowane jako `StandardSekcjaDef[]` (`:410-449`): `details` · `minutes`
· `decisions`. **Dołożenie czwartej sekcji jest zmianą powłoki
zaakceptowanej w `DEC-54`** — patrz §B.1, gdzie jest to rozstrzygnięte.

Klient API (wszystko w `src/services/api.ts`):
```
getMeetings         :3484      listMeetingNotes    :3558
getMeeting          :3498      decideMeetingNote   :3565
createMeeting       :3503      generateMeetingNotes:3544
updateMeeting       :3512      getAIOperatorMeetingBrief :3653
deleteMeeting       :3521
updateMeetingStatus :3529
```

### 2.3. ★ Trzy bramki modułu — mapa dokładna (podstawa §G)

| # | Warstwa | Plik:linia | Mechanizm | Kto przechodzi dziś |
| --- | --- | --- | --- | --- |
| 1 | Klient — menu i trasy | `src/utils/betaAccess.ts:53` | `BETA_MENU_STATUS.MODULE_MEETING = 'closed'` + `BETA_ADMINS_EXEMPT = true` (`:32`) | OWNER/ADMIN/SUPERADMIN |
| 2 | Serwer — cały router | `server/src/middleware/betaGate.middleware.ts:25-37`, mount `meeting.routes.ts:146` | `closedBetaModuleGate` — **zaszyta** lista `OWNER · ADMIN · ADMINISTRATOR · SUPERADMIN`, reszta `403 BETA_LOCKED` | jw. |
| 3 | Pilot | `src/utils/pilotAccess.ts:66` | `MODULE_MEETING` na liście modułów zablokowanych w sesji pilotowej → redirect `/interview` | nikt z ról pilotowych |

Trzy różne mechanizmy, **zero wspólnego źródła prawdy**. `betaGate` (bez
przymiotnika, `:15-17`) jest dziś przelotką i jego komentarz mówi
„wszystkie moduły są `open`" — co jest **nieprawdą** wobec `betaAccess.ts`.
To jest jedna z pułapek: nie pomyl `betaGate` z `closedBetaModuleGate`.

### 2.4. Backend — co JEST gotowe (i czego NIE budujesz od nowa)

```
# Model spotkania — legacy, all-TEXT, tworzony leniwie
meetings(id, organization_id, project_id, title, start_at, end_at, location,
         attendees_json, pre_read_json, agenda_json, decisions_json, status,
         created_by, created_at, updated_at)          meetingService.ts:96-114
meeting_follow_ups(id, meeting_id, title, owner, status, created_at, updated_at)
                                                      meetingService.ts:115-126
  → BRAK organization_id: tenant wyprowadzany przez rodzica (getMeeting)
  → BRAK due_at, BRAK owner_user_id (owner to wolny tekst)

# Governance notatek — GOTOWE, działa, ma testy
meeting_notes(id, organization_id, meeting_id, proposal_id, status,
              idempotency_key, transcript_hash, language, ...)
                          migracja 20260912_claude_c_meeting_boundary.sql
                          serwis  meetingBoundary/meetingBoundaryService.ts
  generateMeetingNotes → propozycja (producerKind:'meeting',            :418-434
                         targetKind:'material')
  decideMeetingNote    → approve/reject + dokładnie jeden pokwitowanie  :536-600
  odczyt z JOIN-em stanu propozycji i id pokwitowania                   :260-290

# Kręgosłup handoffu — WSPÓŁDZIELONY, tylko odczyt i wołanie
artifact_handoff_proposals / artifact_handoff_receipts
                          artifactHandoff/handoffSpineService.ts
  PRODUCER_KINDS = idea | chat | meeting | organization                 :46
  TARGET_KINDS   = document | presentation | workbook | material        :49
  createProposal :392  ·  approveProposal / rejectProposal :609
  materializeProposal :651  (SELECT FOR UPDATE + unikat na proposal_id) :701

# Rejestr materiałów — TU MA WYLĄDOWAĆ PROTOKÓŁ (§H)
v8_output_artifacts        migracja 20260323_v8_reports_output_runtime.sql:3-19
                           + 20260324_v81_artifact_substrate_wave1.sql:6-34
v8_artifact_origin_links   20260324_v81_artifact_substrate_wave1.sql:47-58
                           unikat (organization_id, origin_runtime, origin_record_id)
registerArtifactOrigin()   server/src/services/v8/artifactRegistryService.ts:1289
                           typy: server/src/types/artifactRegistry.ts:221-238, 339-357
wave5_artifacts            treść dokumentu; DDL wave5ArtifactRuntimeService.ts:368-397
                           insert :462-518

# Brief operatora — GOTOWY
GET /api/ai-operator/meetings/:meetingId/brief   ai-operator.routes.ts:89-111
```

**Trzy gotowe mechanizmy, których front dziś nie czyta** — i to jest
najtańsza wartość w całym dyżurze, bo to podłączenie, nie budowa:
`registerArtifactOrigin`, pokwitowania handoffu jako rodowód, brief
operatora na karcie.

### 2.5. Frontend — punkty zaczepienia

```
src/components/Meeting/MeetingHub.tsx
  :58        MeetingItem.attendees: string[]            ← płaska lista (§U.3)
  :100-105   stan briefu + rozróżnienie błąd/pustka     ← Z15, NIE COFAĆ
  :111       draft.attendees: '' (tekst z \n)           ← modal tworzenia (§U.5)
  :154       wyszukiwanie po treści stringa uczestnika
  :162       filtr 'followUp'
  :221-262   pobranie briefu dla wybranego wiersza
  :273       openMeetingDocument(row) → nawigacja na kartę
  :340-345   kolumna "Attendees" = LICZNIK
  :394-403   kolumna "Follow-ups" = liczba otwartych    ← dziś zawsze 0 (§D.5)
  :451-462   pstryczek "Needs follow-up"                ← dziś zawsze 0 (§D.5)
  :501-514   przycisk Menu 3 "Brief operatora"          ← prowadzi na kartę (§B.1)
  :687-723   listMeetingNotes + decideMeetingNote + noteReceiptIds
  :994-1010  RENDER briefu w panelu podglądu            ← dowód, że dane są
  :1277-1311 chip z surowym id pokwitowania             ← zalążek rodowodu (§H.3)

src/components/Meeting/MeetingObjectPage.tsx
  :80        Section = 'details' | 'minutes' | 'decisions'
  :224-239   aktywna sekcja z URL
  :292-376   sekcja "Protokół" (notatki + decyzje z notatki)
  :378-407   sekcja "Decyzje i działania" — CZYSTY ODCZYT, zero kontrolek (§D.4)
  :410-449   definicja trzech sekcji (POWŁOKA — DEC-54)
  :455-475   prawy panel SPEC-A
```

### 2.6. Testy zastane — co Cię pilnuje

| Plik | Co pilnuje | Twój stosunek |
| --- | --- | --- |
| `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts` (804 l.) | 48 przepływów, w tym **osiem asercji `410`** na `:349-454` | **Ma zostać zielony bez zmian.** Jedyny dopuszczalny wyjątek — §T.1 |
| `server/src/services/__tests__/meetingService.test.ts` | CRUD, follow-upy, `M12-F01` | Rozszerzasz o nowe funkcje; **nie osłabiasz** istniejących asercji |
| `server/src/routes/__tests__/meeting.routes.test.ts` (322 l.) | kontrakty tras | jw. |
| `tests/unit/backend/middleware/meetingBetaGate.test.ts` (47 l.) | macierz ról bramki + **grep-test montażu** (`:37-45`) | Rozszerzasz o macierz „po otwarciu" (§G.2). Grep-test zostaje, ale **nie liczy się do DoD** |
| `server/src/services/meetingBoundary/__tests__/*.pg.test.ts` (3 pliki) | governance notatek na realnym PG | Rozszerzasz o materializację do Materials (§H.1) |
| `src/components/Meeting/__tests__/*` (3 pliki) | Hub, karta, cykl życia | Rozszerzasz |
| `src/routes/__tests__/meetingsCanonicalRoute.test.ts` | gramatyka `DEC-2026-08-24-07` | **Nie ruszasz.** Jeśli się zapali — złamałeś Z11 |
| `tests/unit/meeting/meetingCaptureDefaultOff.contract.test.ts` | przechwytywanie zostaje OFF | **Nie ruszasz** (Z14) |
| `tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts` | dowody domknięcia | **Nie ruszasz** |

**Dowód stanu wyjściowego** zbierasz w Bloku 0 i wklejasz do raportu — to
Twój punkt odniesienia przy odbiorze.

### 2.7. i18n — dziś parytet pełny, u Ciebie ma taki zostać

```bash
node -e "const p=require('./public/locales/pl/translation.json');const e=require('./public/locales/en/translation.json');const f=(o,pre='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,pre+k+'.'):[pre+k]);const pk=f(p).filter(k=>k.startsWith('meeting'));const ek=f(e).filter(k=>k.startsWith('meeting'));console.log('PL',pk.length,'EN',ek.length);console.log('PL-only',pk.filter(k=>!ek.includes(k)));console.log('EN-only',ek.filter(k=>!pk.includes(k)));"
# stan zastany: PL 137 EN 137, PL-only [] EN-only []
```

**Uwaga o granicy z nadzorcą:** na karcie istnieją miejsca, gdzie w gałęzi
`en:` siedzi polski literał (`MeetingObjectPage.tsx:415-416`, `:440-441`)
i gdzie etykieta jest zaszyta bez `t()` (`:470` `'Stan'`). **To jest B6
i naprawia to nadzorca** (§1.4). Ty tego nie ruszasz — i jednocześnie **nie
powielasz tego wzorca** w niczym, co dodajesz.

### 2.8. Kanon UI — co obowiązuje w tym obszarze

- **Lista `/meetings`** — kanon triady (`docs/ui-standards/TRIADA_KANON.md`),
  wyłącznie `StandardModuleBar` / `StandardTable` / preview. **Zakaz
  własnych tabel.** Pilnuje `scripts/check-list-canon.sh` (hook
  pre-commit). Hub jest dziś zgodny — nie psuj tego, dokładając kolumnę.
- **Karta `/meetings/:id`** — SPEC-A, archetyp **C Rekord**
  (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2 powłoka,
  §13 per archetyp, §18.1 DoD). **Powłoka zaakceptowana `DEC-54` — zmieniasz
  wyłącznie CENTRUM sekcji, nigdy powłokę.**
- **Preview w liście** — kanon podglądu (6 bloków: nagłówek · meta · treść ·
  What's-next · akcje-pill · kebab).
- **Tokeny kolorów — jedyne dozwolone:**
  ```
  --c-text            --c-surface           --c-success
  --c-text-secondary  --c-surface-raised    --c-danger
  --c-text-muted      --c-border            --c-info
                      --c-border-subtle     --c-focus
  ```
  `--c-accent` = crimson = **wyłącznie marka**, nigdy element UI.
  Fokus zawsze `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
  `--c-danger` **wyłącznie** dla stanu faktycznie krytycznego (np.
  „zaproszenie odrzucone" **nie jest** krytyczne — to jest stan neutralny;
  „nie udało się zapisać" jest).

---

## §D. SEKCJA DECYZJE I FOLLOW-UPY (bloker B2) — pięć pozycji

**Cel sekcji, jednym zdaniem:** sekcja „Decyzje i działania" na karcie
przestaje być pustym oknem, a kolumna „Follow-upy" i pstryczek „Wymaga
follow-upu" na liście przestają liczyć zawsze zero — bo pod spodem pojawia
się **strukturalny, tenantowany, audytowalny model decyzji i działań
z dwiema ścieżkami zapisu: ręczną z karty i governance'ową z zatwierdzonej
notatki**.

### D.1 — Inwentarz i weryfikacja martwoty (pozycja tania, obowiązkowa, PIERWSZA)

Zanim cokolwiek zbudujesz, **udowadniasz stan zastany** i wklejasz dowody
do raportu. To jest pozycja bez kodu produkcyjnego.

```bash
# (a) trzy trasy retired
sed -n '299,341p' server/src/routes/meeting.routes.ts

# (b) create wymusza pustą listę decyzji
sed -n '215,222p' server/src/routes/meeting.routes.ts

# (c) updateMeeting NIE MA gałęzi decisions_json
grep -n "decisions" server/src/services/meetingService.ts | sed -n '1,40p'

# (d) jedyni wołający funkcji serwisowych
grep -rn "addMeetingDecision\|addMeetingFollowUp\|updateMeetingFollowUpStatus" server/src src tests | grep -v "meetingService.ts:"

# (e) osiem asercji 410 w pakiecie 48 przepływów
grep -n "toBe(410)" tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
```

**Definicja ukończenia D.1:** w raporcie jest tabela `Element · Werdykt ·
Dowód plik:linia`, obejmująca minimum: trzy trasy `410`, brak gałęzi
`decisions_json` w `updateMeeting`, zerową liczbę produkcyjnych wołających
trzech funkcji serwisowych, liczbę asercji `410` w pakiecie golden-flows.
Werdykt ∈ `JEST` · `JEST_CZĘŚCIOWO` · `BRAK_UI_JEST_API` · `BRAK_API` ·
`MARTWE`.
**Jeżeli wynik (d) pokazuje produkcyjnego wołającego — mapa się zestarzała,
wpisujesz to do „Korekt wobec instrukcji" i pracujesz na stanie
faktycznym.**

### D.2 — Model danych: strukturalne decyzje i follow-upy (migracja addytywna)

**To jest fundament całej sekcji. Robisz go PRZED jakimkolwiek UI.**

Powstaje jedna migracja `server/migrations/20260826_meetings_day10_decisions.sql`:

**(a) Nowa tabela `meeting_decisions`** — decyzja jest **rekordem**, nie
stringiem w tablicy JSON:

```
meeting_decisions
  id                TEXT PRIMARY KEY
  organization_id   TEXT NOT NULL          ← tenant JAWNIE, nie przez rodzica
  meeting_id        TEXT NOT NULL          ← BEZ klucza obcego (§0.3 pkt 2)
  statement         TEXT NOT NULL          ← treść decyzji
  rationale         TEXT DEFAULT ''        ← uzasadnienie (opcjonalne)
  decided_by        TEXT                   ← id użytkownika-decydenta
  decided_at        TEXT
  status            TEXT DEFAULT 'recorded'   ← recorded | superseded
  source_kind       TEXT DEFAULT 'manual'     ← manual | note | legacy
  source_note_id    TEXT                      ← wypełnione dla source_kind='note'
  source_index      INTEGER                   ← pozycja w notatce/legacy JSON
  created_by        TEXT NOT NULL
  created_at        TEXT
  updated_at        TEXT
```

Indeksy: `(organization_id, meeting_id, created_at)` do odczytu oraz
**unikat deduplikacyjny** `(organization_id, meeting_id, source_kind,
source_note_id, source_index)` — to on gwarantuje, że backfill i handoff
z notatki są idempotentne i że powtórzone wywołanie nie tworzy duplikatu.

**(b) Rozszerzenie `meeting_follow_ups`** — wyłącznie
`ADD COLUMN IF NOT EXISTS`, zero zmian typów istniejących kolumn:

```
organization_id  TEXT      ← denormalizacja tenanta (dziś tenant tylko przez rodzica)
owner_user_id    TEXT      ← tożsamość właściciela obok wolnego tekstu `owner`
due_at           TEXT
source_kind      TEXT DEFAULT 'manual'
source_note_id   TEXT
source_index     INTEGER
```

plus unikat deduplikacyjny `(meeting_id, source_kind, source_note_id,
source_index)` i indeks `(organization_id, status)`.

**Uwaga o `organization_id` w `meeting_follow_ups`:** kolumna jest
**addytywna i opcjonalna**. Odczyt **nadal** waliduje tenanta przez
`getMeeting` (istniejący, sprawdzony wzorzec) — nowa kolumna jest
przyspieszeniem i drugim zamkiem, **nie zastępstwem**. Nie wolno Ci
przerobić istniejących zapytań tak, żeby polegały wyłącznie na niej
(stare wiersze jej nie mają, dopóki nie zrobisz backfillu).

**(c) Backfill legacy — idempotentny, źródło nietknięte.**
`meetings.decisions_json` (tablica stringów) → wiersze `meeting_decisions`
z `source_kind='legacy'`, `source_index = pozycja w tablicy`, przez
`INSERT ... ON CONFLICT DO NOTHING`. **`decisions_json` NIE jest kasowane,
zerowane ani zmieniane.** Po backfillu API czyta wyłącznie nową tabelę
(patrz `§1.7` pozycja otwarta nr 5 — jeżeli nadzorca zdecyduje inaczej,
wpisujesz STOP; domyślnie robisz tak, jak tu napisano).

**Definicja ukończenia D.2:**
1. Migracja jest addytywna, idempotentna, z dowodem (1)(2)(3) z §0.3 pkt 4
   wklejonym do raportu, z potwierdzonym sprzątnięciem kontenera.
2. Nazwa pliku `20260826_meetings_day10_*.sql` — **nie koliduje** z dniem 6.
3. **Zero kluczy obcych** do `meetings` / `meeting_follow_ups` /
   `meeting_notes` (pułapka sortowania, §0.3 pkt 2).
4. `ensureMeetingTables()` **nietknięte** — dowód: `git diff` na
   `meetingService.ts:95-132` jest pusty.
5. Test behawioralny na realnym PG: wstaw dwa spotkania w dwóch
   organizacjach, uruchom backfill dwa razy, sprawdź, że liczba wierszy po
   drugim przebiegu **się nie zmieniła** i że żadne spotkanie nie widzi
   decyzji drugiej organizacji.

### D.3 — API: strukturalny zapis i odczyt z izolacją tenantową

**★ Rozstrzygnięcie ścieżki (pozycja otwarta nr 1 z §1.7):
budujesz NOWY zasób, NIE odblokowujesz starych tras.**

```
GET    /api/meeting/:id/decision-records                 → { decisions: [...] }
POST   /api/meeting/:id/decision-records                 → 201 { decision }
PATCH  /api/meeting/:id/decision-records/:decisionId     → 200 { decision }
DELETE /api/meeting/:id/decision-records/:decisionId     → 200 { deleted: true }

GET    /api/meeting/:id/follow-up-records                → { followUps: [...] }
POST   /api/meeting/:id/follow-up-records                → 201 { followUp }
PATCH  /api/meeting/:id/follow-up-records/:followUpId    → 200 { followUp }
DELETE /api/meeting/:id/follow-up-records/:followUpId    → 200 { deleted: true }
```

**Dlaczego nowy zasób, a nie przywrócenie `/decisions`:** stare trasy są
kontraktem pilnowanym przez **osiem asercji** w 48-przepływowym pakiecie
(§1.5 pułapka 1). Nowy zasób to **inny byt** — rekord z aktorem,
uzasadnieniem i rodowodem, a nie string dopisywany do tablicy JSON. Nowa
ścieżka pozwala zostawić tamten pakiet **zielony bez jednej zmiany**.
Trzy stare trasy **zostają na `410` dokładnie takie, jakie są.**

**Wymagania twarde dla każdego z ośmiu handlerów:**
1. `organizationId` **wyłącznie z tokenu** (`req.user?.organizationId`),
   nigdy z body ani z query. Brak → `401`.
2. Rodzic weryfikowany przez `getMeeting({ organizationId, meetingId })`
   **przed** dotknięciem tabeli-dziecka — istniejący wzorzec
   (`meeting.routes.ts:303-305`). Obce spotkanie → **`404`**, nigdy `403`
   z treścią (nie potwierdzasz istnienia cudzego zasobu).
3. `canAccessMeeting(req, meeting)` / `denyMeetingAccess(res)` — używasz
   **istniejących** helperów, nie piszesz własnych.
4. Walidacja wejścia: pusty `statement` / pusty `title` → `400` z
   komunikatem, nigdy `500`.
5. **`PATCH`/`DELETE` nie mogą zwrócić fałszywego sukcesu.** Wzorzec
   obowiązkowy: przed zapisem sprawdzasz, że rekord należy do tego
   spotkania i tej organizacji; jeśli nie — `404`. Dokładnie tak działa
   `updateMeetingFollowUpStatus` (`meetingService.ts:390-395`, `M12-F01`)
   i to jest wzorzec, nie inspiracja.
6. `hasDirectMeetingOutputs` (`meeting.routes.ts:129-135`) **zostaje
   nietknięte** — `POST /` i `PUT /:id` nadal odrzucają `decisions`
   i `followUps` w ciele. Nowe zasoby to jedyna droga zapisu.

**Definicja ukończenia D.3:**
1. Osiem tras działa na realnym PG, każda z readbackiem (odpowiedź zawiera
   stan **odczytany po zapisie**, nie ciało żądania).
2. **Minimum 4 testy behawioralne na trasę-grupę**: happy · walidacja
   (`400`) · nieistniejący rekord (`404`) · **obcy tenant (`404`)**.
   Testy wołają realny router przez `supertest` na realnym PG, wzorem
   `server/src/services/meetingBoundary/__tests__/meetingBoundaryRoutes.pg.test.ts`.
3. `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
   **przechodzi bez jednej zmiany** — wynik „przed" i „po" w raporcie.
4. Klient: funkcje w `src/services/api.ts` obok istniejących
   `meeting*` (`:3484-3573`), z tym samym wzorcem `handleResponse`.

### D.4 — UI: sekcja „Decyzje i działania" jako miejsce pracy, nie gablota

Dziś `decisionsContent` (`MeetingObjectPage.tsx:378-407`) renderuje
`ListField` z `meeting.decisions` i listę follow-upów — **bez jednej
kontrolki**. Po tej pozycji sekcja ma:

1. **Dodanie decyzji** — kontrolka inline (nie osobny modal, bo karta jest
   archetypem C Rekord): pole `statement` (wymagane), pole `rationale`
   (opcjonalne), akcja zapisu. Po zapisie — readback i widoczny nowy wiersz.
2. **Edycja i usunięcie decyzji** — przez kebab wiersza, zgodnie z kanonem
   (nie własne ikonki w wierszu).
3. **Dodanie follow-upu** — `title` (wymagane), `owner` (patrz niżej),
   `due_at` (opcjonalne).
4. **Przełączenie statusu follow-upu** `open ↔ done` — jedna akcja,
   z readbackiem.
5. **Rodowód widoczny przy każdym wierszu**: `manual` (dodane ręcznie) ·
   `note` (z zatwierdzonego protokołu, z linkiem do notatki) · `legacy`
   (zapis historyczny). Etykiety przez `t()`, **nie kolorem** — rozróżnialne
   bez koloru.
6. **Uczciwy pusty stan** — „Brak zarejestrowanych decyzji" ≠ „Nie udało się
   wczytać decyzji". Dwa różne stany, dwa różne komunikaty, stan błędu
   z ponowieniem. Wzorzec: `MeetingHub.tsx:102-105`.

**Pole „właściciel follow-upu":** jeżeli §U.3 (model uczestników) jest
w tym samym dyżurze **zrobione**, właściciel jest wybierany z uczestników
spotkania i zapisywany do `owner_user_id`. Jeżeli §U.3 **nie jest
zrobione** — pole zostaje wolnym tekstem (`owner`), a `owner_user_id`
zostaje puste. **Nie budujesz trzeciego, tymczasowego wyboru osoby.**

**Ograniczenia (Z17, `DEC-54`):**
- Zmieniasz **wyłącznie zawartość** `decisionsContent`. Nie zmieniasz
  definicji sekcji (`:410-449`), nie dokładasz czwartej sekcji, nie ruszasz
  prawego panelu ani kebaba powłoki.
- `aiContract: { none: true }` przy tej sekcji (`:445-447`) **zostaje** —
  decyzje i follow-upy to realne dane, model językowy ich tu nie pisze.

**Definicja ukończenia D.4:**
1. Każda z sześciu rzeczy powyżej działa na realnych danych, z readbackiem.
2. **Zero atrap** — nie ma kontrolki, która nie zapisuje.
3. Minimum 4 testy renderujące realny komponent: happy (dodanie →
   readback) · błąd API (komunikat + ponowienie, **nie** pusty stan) ·
   pusty stan · rozróżnienie rodowodu (`manual` vs `note` vs `legacy`).
4. i18n PL+EN dla **wszystkich** nowych napisów, w tym samym commicie.
5. Light + dark, tokeny `c-*`, zero `primary-*`, fokus `c-focus`.
6. **Zrzuty własne** (DoD 8): sekcja z danymi · sekcja pusta · sekcja
   w stanie błędu — light i dark, do `evidence/day10/`.
7. `bash scripts/check-list-canon.sh src/components/Meeting/MeetingObjectPage.tsx`
   nie zgłasza nowych naruszeń.

### D.5 — Lista: kolumna „Follow-upy" i pstryczek liczą realne dane

Kolumna (`MeetingHub.tsx:394-403`) i chip „Needs follow-up" (`:451-462`)
już dziś liczą `row.followUps.filter(status === 'open').length` — **i to
jest poprawny kod nad pustym zbiorem**. Po `D.2`–`D.3` zbiór przestaje być
pusty. Twoim zadaniem jest **udowodnić, że liczą to, co trzeba**, i domknąć
dwie rzeczy:

1. **Lista `GET /api/meeting` musi zwracać follow-upy z nowego modelu**,
   z policzonym `openFollowUpCount` po stronie serwera (dziś liczy front
   z pełnej listy — zostaje, ale ma dostać dane). Zapytanie zbiorcze,
   **nie N+1**: wzorzec `getFollowUpsForMeetings`
   (`meetingService.ts:134-158`) już to robi — rozszerzasz go, nie piszesz
   drugiego.
2. **Kolumna „Decyzje"** — dokładasz drugą kolumnę licznikową obok
   „Follow-upy", w tym samym wzorcu (`tabular-nums`, `align: right`,
   szerokość stała). Widoczność sterowana pstryczkiem kolumn, jak reszta.

**Definicja ukończenia D.5:**
1. Test behawioralny: spotkanie z 2 otwartymi i 1 zamkniętym follow-upem
   pokazuje `2`; spotkanie bez follow-upów pokazuje `0`; pstryczek „Needs
   follow-up" filtruje **dokładnie** te spotkania, które mają ≥1 otwarty.
2. Test negatywu tenanta: spotkanie obcej organizacji nie wpływa na
   liczniki.
3. Brak regresji N+1 — dowód: jedno zapytanie zbiorcze na listę (cytat
   z kodu w raporcie).
4. Kanon listy nienaruszony (`check-list-canon.sh` na `MeetingHub.tsx`).
5. Zrzut listy z niezerowymi licznikami, light + dark.

---

## §H. SEKCJA PRZEPŁYW NOTATKA → MATERIALS / MY WORK / INITIATIVES (bloker B3) — cztery pozycje

**Cel sekcji, jednym zdaniem:** zatwierdzony protokół przestaje być
„materiałem, którym jest on sam", a staje się **realnym artefaktem
widocznym w module Materials**, z czytelnym rodowodem w obie strony
i z opcjonalnym, świadomym przekazaniem działań do My Work i Initiatives.
To domyka `MET-F-006` (`docs/modules/13_meeting/CURRENT_CONTRACT.md:34`),
dziś oznaczone jako `gap`.

**Zanim zaczniesz — przeczytaj trzy pułapki tej sekcji:**

- **P1.** W Materials „materiał" = wiersz `v8_output_artifacts`
  zarejestrowany przez `registerArtifactOrigin()`
  (`server/src/services/v8/artifactRegistryService.ts:1289`), a treść leży
  w tabeli zawartości (`wave5_artifacts`). **Sama propozycja/pokwitowanie
  handoffu NIE tworzy materiału.**
- **P2.** Dla `origin_runtime='native_artifact'` ścieżka otwarcia to
  `/document-studio/{originRecordId}` (`artifacts.routes.ts:180-193`),
  a `GET /api/document-studio/:artifactId`
  (`documentStudioService.ts:1268-1328`) **zwraca 404**, jeśli wiersz
  `wave5_artifacts` nie ma schematu dokumentu w
  `metadata_json.documentStudioSchema`. Materiał, który jest na liście,
  ale nie daje się otworzyć, **nie liczy się jako ukończony**.
- **P3.** Tytuł zawierający słowo „test", „E2E", „smoke" albo „probe" jest
  heurystycznie oznaczany jako szkic (`artifactRegistryService.ts:2464-2470`)
  i **znika z domyślnej listy Materials** (`artifacts.routes.ts:383-395`).
  Twoje dane dowodowe nie mogą mieć takiego tytułu, inaczej uznasz działający
  zapis za zepsuty.

### H.1 — Zatwierdzony protokół zostaje REALNYM materiałem

Dziś `decideMeetingNote` przy akceptacji materializuje propozycję
z `targetRecordId: note.id`
(`server/src/services/meetingBoundary/meetingBoundaryService.ts:581-593`),
czyli wskazuje **samą notatkę**. Komentarz kontraktowy (`:518-534`) mówi to
wprost i deleguje resztę „konsumentowi, który czyta `producer_kind =
'meeting'`". **Takiego konsumenta nie ma w repo** — sprawdź sam:

```bash
grep -rn "producer_kind = 'meeting'\|producerKind: 'meeting'" server/src | grep -v __tests__
grep -rn "sourceType: 'meeting'" server/src | grep -v __tests__
```

**Co budujesz.** Po udanej akceptacji (`action: 'approve'`), w tej samej
logicznej operacji:

1. Powstaje **wiersz treści** w `wave5_artifacts` z protokołem złożonym
   z payloadu notatki (podsumowanie, punkty kluczowe, decyzje, działania) —
   wzorzec wstawiania: `wave5ArtifactRuntimeService.ts:462-518`.
   **Wiersz MUSI nieść schemat dokumentu** w
   `metadata_json.documentStudioSchema` (klucz:
   `documentStudioService.ts:177`), inaczej wpadasz w pułapkę P2.
2. Powstaje **wiersz rejestru** przez
   `registerArtifactOrigin({ organizationId, outputType: 'report',
   artifactFamily: 'document', originRuntime: 'native_artifact',
   originRecordId: <id z wave5_artifacts>, titleSnapshot: <tytuł
   protokołu>, createdBy, originSummary: { sourceType: 'meeting',
   sourceId: meetingId, sourceTable: 'meeting_notes', noteId,
   receiptId } })`.
   **`titleSnapshot` jest obowiązkowy** — dla `native_artifact` lista nie
   ma skąd wziąć tytułu i pokaże „Untitled artifact"
   (`artifactRegistryService.ts:2680-2700`).
3. **`targetRecordId` w pokwitowaniu handoffu wskazuje NOWY materiał**,
   nie notatkę. To jest sedno naprawy B3.

**Wzorce do skopiowania (przeczytaj oba przed pisaniem):**
```
POST /api/artifacts/register-chat            server/src/routes/artifacts.routes.ts:510-596
POST /drafts/:draftId/register-in-outputs    server/src/routes/work-canvas.routes.ts:4564-4590
   + wariant transakcyjny                    :4596-4619
registerGeneratedDocumentOrigin              server/src/routes/document-studio.routes.ts:735-800
```

**Wymagania twarde:**
1. **Dokładnie jeden materiał na jedną zatwierdzoną notatkę.**
   Idempotencja jest już zapewniona przez unikat
   `idx_v81_origin_unique (organization_id, origin_runtime,
   origin_record_id)` (`20260324_v81_artifact_substrate_wave1.sql:57-58`)
   **oraz** przez unikat na `artifact_handoff_receipts(proposal_id)`
   (`handoffSpineService.ts:617`, `:701`). Powtórzone wywołanie
   `decideMeetingNote` **nie może** stworzyć drugiego materiału — dziś
   ścieżka replay już istnieje (`:581-600`) i musisz ją zachować.
2. **Odrzucenie notatki (`reject`) nie tworzy niczego.** Zero materiału,
   zero pokwitowania (dzisiejsze `receipt: null` — `:551-560`).
3. **`handoffSpineService` nietknięty.** Wołasz `materializeProposal`
   z innym `targetRecordId`; nie dodajesz `TARGET_KINDS`, nie zmieniasz
   `PRODUCER_KINDS`, nie ruszasz stanów. Zmiana = STOP (§0.5).
4. **Tenant.** Materiał powstaje w organizacji spotkania. Test negatywny:
   akceptacja notatki nie może stworzyć materiału widocznego w innej
   organizacji.
5. **Awaria rejestracji nie może zostawić stanu połowicznego.** Jeżeli
   rejestracja materiału się nie powiedzie, decyzja o notatce **nie może
   raportować sukcesu**. Dopuszczalne są dwa rozwiązania — wybierz jedno
   i opisz w raporcie: (a) jedna transakcja obejmująca oba zapisy
   (wzorzec `outputsTransactionalRegistry` z `work-canvas.routes.ts:4596`),
   albo (b) jawny stan `failed` na propozycji + `500` z kodem błędu
   i możliwością ponowienia. **Ciche „prawie się udało" = odrzucenie
   pozycji.**

**Definicja ukończenia H.1:**
1. Test behawioralny na realnym PG: utwórz spotkanie → wygeneruj notatkę →
   zatwierdź → **odczytaj `GET /api/artifacts` i znajdź tam nowy wiersz**
   z poprawnym `titleSnapshot` i `originSummary.sourceType === 'meeting'`.
2. Test replay: druga identyczna akceptacja → **liczba materiałów bez
   zmian**, pokwitowanie to samo.
3. Test odrzucenia: `reject` → **zero materiałów**.
4. Test tenanta: obca organizacja nie widzi materiału.
5. **Cold readback**: po restarcie połączenia (nowy klient/serwis, nie ten
   sam obiekt w pamięci) materiał nadal jest, ma tę samą tożsamość i daje
   się otworzyć — `GET /api/document-studio/:artifactId` zwraca `200`,
   **nie `404`** (pułapka P2).
6. Dane dowodowe bez słów „test/smoke/probe" w tytule (pułapka P3).

### H.2 — Opcjonalne przekazanie działań do My Work i Initiatives

**★ Pozycja otwarta nr 4 z §1.7 — rozstrzygnięcie domyślne: handoff jest
OSOBNĄ, ŚWIADOMĄ decyzją człowieka, nie automatem przy akceptacji.**
Powód: cała governance notatek jest zbudowana na zasadzie „nic nie
materializuje się bez jawnej decyzji"; automatyczne tworzenie zadań
w cudzym module złamałoby tę zasadę i zrobiłoby dokładnie to, co migracja
`20260912_claude_c_meeting_boundary.sql:7-13` nazywa defektem. Jeżeli
nadzorca zdecyduje inaczej — wpisujesz STOP z propozycją, nie zgadujesz.

**Co budujesz:** na zatwierdzonym protokole (i tylko zatwierdzonym) każdy
punkt działania da się **jednym jawnym gestem** przekazać:
- do **My Work** jako zadanie, **albo**
- do **Initiatives** jako powiązane działanie.

**Twarde ograniczenie zakresu (Z17, wyjątek imienny):** wolno Ci **wołać
istniejący serwis/endpoint** tych modułów. **Nie wolno** zmieniać ich kodu,
schematu bazy ani UI. Jeżeli w chwili dyżuru nie istnieje endpoint, który
utworzy zadanie w My Work z parametrami, których potrzebujesz — **nie
budujesz go**. Wpisujesz `BRAK_API` z pełną tabelą (czego brakuje,
w którym pliku byłoby miejsce, jaki kontrakt byłby potrzebny) i **to jest
wynik pełnowartościowy**.

**Kolejność pracy w tej pozycji jest odwrotna niż zwykle:** najpierw
inwentarz endpointów docelowych, dopiero potem decyzja, czy budujesz.

```bash
# czego szukasz: publiczny, tenantowany endpoint tworzenia zadania / działania
grep -rn "router.post" server/src/routes/my-work.routes.ts | head -30
grep -rn "router.post" server/src/routes/v8/my-work.routes.ts | head -30
grep -rn "router.post" server/src/routes/initiative*.routes.ts | head -30
```

**Wymagania twarde, jeżeli budujesz:**
1. **Idempotencja per punkt działania.** Ten sam punkt przekazany dwa razy
   nie tworzy dwóch zadań. Klucz: `(meeting_id, note_id, source_index,
   target_kind)` — trzymany po Twojej stronie (`meeting_follow_ups` ma już
   te kolumny z §D.2), **nie po stronie cudzego modułu**.
2. **Pokwitowanie.** Każde przekazanie zostawia widoczny ślad przy punkcie
   działania: co powstało, gdzie, kiedy, z czyjej decyzji, z linkiem.
3. **Uczciwa porażka.** Odmowa uprawnień albo błąd cudzego modułu →
   komunikat i możliwość ponowienia, **nigdy** cichy sukces.
4. **Zero automatu.** Akceptacja notatki sama z siebie nie tworzy zadań.

**Definicja ukończenia H.2:**
1. Tabela inwentarza w raporcie: `Cel · Endpoint · Istnieje? · Kontrakt ·
   Werdykt (`ZBUDOWANE` / `BRAK_API`)`.
2. Jeżeli `ZBUDOWANE` — 4 testy behawioralne na cel: happy · powtórzenie
   (idempotencja) · odmowa uprawnień · obcy tenant.
3. Jeżeli `BRAK_API` — **nie ma kontrolki w UI.** Zero atrap (DoD 3).
4. i18n PL+EN, light+dark, zrzuty własne dla wszystkiego, co widać.

### H.3 — Rodowód czytelny w obie strony

Dziś rodowód istnieje wyłącznie jako **surowy identyfikator pokwitowania**
w chipie na liście spotkań (`MeetingHub.tsx:1277-1281`, `:1307-1311`) —
i nigdzie więcej. Po stronie Materials kolumna „Źródło" pokazuje
**runtime**, nie moduł: `useRapData.ts:270` ustawia
`sourceType: raw.originRuntime`, więc materiał ze spotkania wyświetli się
jako „Native artifact", a nie „Meeting" — mimo że
`originSummary.sourceType` niesie poprawną wartość. Ścieżka prezentacji
dostała już tę poprawkę (`resolvePresentationSourceType`,
`useRapData.ts:403-421`); ścieżka dokumentów **nie**.

**Co budujesz — trzy rzeczy, ani jednej więcej:**

1. **Na karcie spotkania (sekcja „Protokół"):** przy zatwierdzonej notatce
   widać, **co z niej powstało** — nazwa materiału + link otwierający go
   w Materials/Document Studio. Zamiast surowego `receiptId` — czytelna
   informacja; sam identyfikator zostaje dostępny (np. w tytule/atrybucie
   diagnostycznym), bo jest dowodem odbiorowym.
2. **W Materials (jedyny wyjątek poza modułem, Z17 §H.3):** kolumna
   „Źródło" pokazuje moduł-producenta. Zmiana ograniczona do **jednej
   linii** — `useRapData.ts:270` zaczyna preferować
   `raw.originSummary?.sourceType` przed `raw.originRuntime`, dokładnie
   wzorem `resolvePresentationSourceType` (`:403-421`).
   **Każda inna zmiana w Materials = STOP.**
3. **Po stronie API spotkania:** `GET /meeting/:id/notes` już dziś dołącza
   stan propozycji i identyfikator pokwitowania przez `LEFT JOIN`
   (`meetingBoundaryService.ts:260-290`) — rozszerzasz to o tożsamość
   powstałego materiału (id + tytuł), **bez** zmiany kształtu odpowiedzi
   dla pól istniejących.

**Definicja ukończenia H.3:**
1. Test behawioralny: po akceptacji notatki karta spotkania pokazuje nazwę
   materiału i link; kliknięcie linku prowadzi pod adres, który **istnieje**
   (`200`, nie `404` — pułapka P2).
2. Test behawioralny po stronie Materials: wiersz pochodzący ze spotkania
   ma w kolumnie „Źródło" wartość wskazującą spotkanie, a wiersz
   pochodzący z czatu **nadal** pokazuje swoją poprawną wartość
   (dowód braku regresji dla cudzej ścieżki).
3. Test „przed akceptacją": notatka `proposed` **nie pokazuje** materiału
   (bo go nie ma) — uczciwy stan, nie puste miejsce po nieudanym odczycie.
4. `git diff` w `src/components/ReportsAndPresentations/` obejmuje
   **dokładnie jeden plik i dokładnie jedną zmianę logiki** — dowód
   w raporcie.
5. Zrzuty: karta z rodowodem · lista Materials z kolumną „Źródło", light
   i dark.

### H.4 — Cold readback całej ścieżki (pozycja dowodowa, bez nowego kodu)

Ostatnia pozycja sekcji jest **dowodem, nie budową**. Uruchamiasz pełną
ścieżkę na **jednorazowym lokalnym kontenerze** (§0.3 pkt 4), a potem
**czytasz wynik z zimnego startu** — nowy proces, nowe połączenie, zero
stanu w pamięci.

Scenariusz obowiązkowy, w tej kolejności:
1. utworzenie spotkania (rola: aktywny członek tej samej organizacji),
2. wygenerowanie notatki z ręcznie wklejonego tekstu,
3. **odczyt przed decyzją**: propozycja `pending`, pokwitowań `0`,
   materiałów `0`,
4. zatwierdzenie przez rolę uprawnioną,
5. **odczyt po decyzji**: propozycja `materialized`, pokwitowań `1`,
   materiałów `1`, materiał otwiera się (`200`),
6. **zimny odczyt** (nowy klient): punkty 5 dają identyczny wynik,
7. **negatyw tenanta**: druga organizacja widzi `0` materiałów i `404` na
   notatce,
8. **negatyw roli**: rola bez uprawnień do decyzji dostaje odmowę i **nic
   nie powstaje**,
9. sprzątanie kontenera z dowodem (`docker ps -a --filter ...` → pusto).

**Definicja ukończenia H.4:** wszystkie dziewięć kroków w raporcie
z surowymi wynikami (statusy HTTP, liczby wierszy). Krok, który nie ma
wyniku wklejonego do raportu, **nie został wykonany**.

---

## §U. SEKCJA WYMAGANIA KALENDARZOWE WŁAŚCICIELA (bloker L1) — pięć pozycji

**Podstawa wymaganiowa — trzy atomy z rejestru uwag właściciela**
(`docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md`):

| Atom | Linia | Wymaganie właściciela (skrót) | Wymagane domknięcie wg rejestru |
| --- | --- | --- | --- |
| `MYW-CAL-REC-001` | `:34` | Spotkanie ≠ zadanie. Spotkanie wymaga **zakresu czasu, strefy czasowej, cykliczności, lokalizacji/linku i zaproszonych** | finalna IA + dowody integracyjne create/update/cancel/reopen |
| `MYW-CAL-REC-002` | `:35` | Spotkanie zaprasza **użytkowników organizacji/projektu ORAZ gości zewnętrznych**, pokazuje **organizatora i status zaproszenia**, zachowuje uprawnienia | cykl życia zaproszenia, autoryzacja, aktualizacja/odwołanie, dowody porażki |
| `MYW-CAL-REC-003` | `:36` | Do spotkania da się **dołączyć idee, notatki i inne uprawnione artefakty Consultify** i **podlinkować je w zaproszeniu**, bez wycieku materiałów prywatnych | selektor artefaktów, decyzja o uprawnieniach/udostępnieniu, trwałe linki, negatyw odebranego dostępu |

**Stan zastany, który to blokuje:** uczestnicy spotkania są **wolnym
tekstem** (`meetingService.ts:23` — `attendees: string[]`), UI trzyma je
jako tekst rozdzielony `\n` (`MeetingHub.tsx:111`, `:539-545`), tabela
pokazuje tylko licznik (`:340-345`). **Nie ma strefy czasowej, nie ma
cykliczności, nie ma tożsamości uczestnika, nie ma statusu zaproszenia, nie
ma załączonych artefaktów.**

**Wzorzec, który już istnieje w repo i którego się trzymasz:**
`server/migrations/20260827_calendar_events.sql` — model wydarzenia
kalendarza z `attendees_json`, `recurrence_rule`, `recurrence_parent_id`,
`related_type`/`related_id`. **Nie ma tam strefy czasowej** — czyli
w tej jednej rzeczy jesteś pierwszy i musisz zdecydować świadomie (§U.1).
Nie przerabiasz `calendar_events` (Z17) — tylko czytasz jako wzorzec.

**Kolejność w tej sekcji jest sztywna:** `U.3` (model uczestników) jest
najdroższy i najbardziej ryzykowny, ale `U.1` i `U.2` są tanie i niezależne.
Robisz `U.1 → U.2 → U.3 → U.4 → U.5`. Jeżeli zabraknie czasu — **lepiej
domknięte `U.1`+`U.2`+`U.5` niż cztery pozycje „prawie".**

### U.1 — Strefa czasowa spotkania (`MYW-CAL-REC-001`, część)

**Problem, którego nie wolno przeoczyć:** `start_at`/`end_at` są dziś
kolumnami `TEXT`, a UI konwertuje je przez `toLocalInput`
(`MeetingHub.tsx:539-545`) — czyli **strefa jest domyślnie strefą
przeglądarki i nigdzie nie jest zapisana**. Spotkanie umówione przez
konsultanta w Warszawie i otwarte przez klienta w innej strefie pokazuje
inną godzinę i **nikt nie wie, która jest prawdziwa**.

**Co budujesz:**
1. Migracja addytywna:
   `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS timezone TEXT` —
   identyfikator strefy **IANA** (np. `Europe/Warsaw`), nie offset
   (offset łamie się na zmianie czasu).
2. Zapis: `start_at`/`end_at` **zostają w ISO 8601 z Z (UTC)** — nie
   zmieniasz ich znaczenia ani typu. `timezone` mówi, **w jakiej strefie
   spotkanie zostało umówione** i w jakiej ma być domyślnie wyświetlane.
3. Domyślna wartość przy tworzeniu: strefa z ustawień użytkownika, jeśli
   jest dostępna, w przeciwnym razie strefa przeglądarki
   (`Intl.DateTimeFormat().resolvedOptions().timeZone`). **Zapisujesz ją
   jawnie** — nie zostawiasz `NULL` z nadzieją, że ktoś się domyśli.
4. Wyświetlanie: godzina w strefie spotkania **z widoczną etykietą strefy**
   wszędzie, gdzie pokazujesz termin: lista (kolumna terminu), preview,
   karta (`MeetingObjectPage.tsx` wiersz „Termin"). Jeżeli strefa
   spotkania ≠ strefa przeglądającego, obok pojawia się godzina lokalna —
   **jawnie oznaczona**, nie zamiast.
5. Stare wiersze bez `timezone` → wyświetlane jak dziś, z uczciwym
   oznaczeniem „strefa nieokreślona". **Nie zgadujesz strefy wstecz.**

**Definicja ukończenia U.1:**
1. Migracja addytywna z dowodem idempotencji (§0.3 pkt 4).
2. Test behawioralny: spotkanie zapisane z `timezone = 'Europe/Warsaw'`
   odczytane przy przeglądarce ustawionej na inną strefę pokazuje **obie**
   godziny, poprawnie i z etykietami.
3. Test: spotkanie bez `timezone` (wiersz sprzed migracji) renderuje się
   bez wyjątku i z uczciwym oznaczeniem.
4. Test: zapis→readback zachowuje `timezone` (zero utraty przy `PUT`).
5. i18n PL+EN dla etykiet strefy; zrzuty light+dark listy i karty.

### U.2 — Cykliczność (`MYW-CAL-REC-001`, część)

**★ Pozycja otwarta nr 3 z §1.7. Rozstrzygnięcie domyślne: seria +
wyjątki.** Nie materializujesz z góry setki wierszy.

**Co budujesz:**
1. Migracja addytywna na `meetings`:
   `recurrence_rule TEXT` (RRULE, wzorem `calendar_events`),
   `recurrence_parent_id TEXT`,
   `recurrence_exception_at TEXT` (dla instancji-wyjątku).
   **Bez klucza obcego** (§0.3 pkt 2).
2. Odczyt listy **rozwija serię wirtualnie w oknie zapytania** (zakres dat
   z parametrów); instancja trafia do bazy **dopiero wtedy**, gdy zostanie
   pojedynczo zmieniona lub odwołana (wtedy jest wierszem-wyjątkiem
   z `recurrence_parent_id`).
3. Semantyka edycji — **trzy jawne opcje w UI**, nigdy domyślnie „cała
   seria": „to wystąpienie" · „to i następne" · „cała seria".
   Jeżeli nie jesteś w stanie zrobić wszystkich trzech addytywnie —
   **robisz „to wystąpienie" + „cała seria"**, a „to i następne" wpisujesz
   jako `BRAK_UI` ze STOP-em. Nie budujesz kontrolki, która obiecuje trzecią
   opcję i jej nie wykonuje (DoD 3).
4. Odwołanie pojedynczego wystąpienia jest **wyjątkiem serii**, nie
   usunięciem serii.

**Wymagania twarde:**
- Rozwijanie serii **nie może** być N+1 ani nieograniczone: zawsze okno
  czasowe + twardy limit instancji na odpowiedź.
- Liczniki na liście (`counts`, chipsy) muszą liczyć **to samo**, co widać
  w tabeli — jeżeli seria daje 12 wystąpień w oknie, licznik pokazuje 12,
  a nie 1.
- Zero regresji dla spotkań niecyklicznych: `recurrence_rule IS NULL`
  zachowuje się **dokładnie** jak dziś.

**Definicja ukończenia U.2:**
1. Migracja addytywna z dowodem idempotencji.
2. Test behawioralny: reguła tygodniowa w oknie 4 tygodni daje 4
   wystąpienia; zmiana jednego wystąpienia tworzy **jeden** wiersz-wyjątek
   i nie rusza pozostałych; odwołanie jednego usuwa **jedno**.
3. Test regresji: spotkanie bez reguły — bez zmian w odczycie i licznikach.
4. Test limitu: reguła bez końca w szerokim oknie **nie zawiesza** odczytu
   (twardy limit + uczciwa informacja o obcięciu).
5. Zrzuty: lista z serią, modal z trzema opcjami zakresu edycji, light+dark.

### U.3 — Uczestnicy: użytkownicy organizacji/projektu + goście zewnętrzni ze statusem zaproszenia (`MYW-CAL-REC-002`)

**To jest najdroższa i najbardziej ryzykowna pozycja dyżuru.** Zmienia
model danych z płaskiej listy stringów na relację z tożsamością.

**Co budujesz — nowa tabela, nie kolumna:**

```
meeting_participants
  id                TEXT PRIMARY KEY
  organization_id   TEXT NOT NULL
  meeting_id        TEXT NOT NULL          ← bez klucza obcego (§0.3 pkt 2)
  participant_kind  TEXT NOT NULL          ← 'user' | 'guest'
  user_id           TEXT                   ← wypełnione dla kind='user'
  email             TEXT                   ← wypełnione dla kind='guest'
  display_name      TEXT DEFAULT ''
  role              TEXT DEFAULT 'attendee'   ← organizer | attendee | optional
  invitation_status TEXT DEFAULT 'invited'    ← invited | accepted | declined | tentative | no_response
  responded_at      TEXT
  invited_by        TEXT
  created_at        TEXT
  updated_at        TEXT
```

Indeksy: `(organization_id, meeting_id)` do odczytu; **dwa unikaty
częściowe**: `(meeting_id, user_id) WHERE user_id IS NOT NULL`
i `(meeting_id, lower(email)) WHERE email IS NOT NULL` — żeby tej samej
osoby nie dało się zaprosić dwa razy.

**Backfill legacy:** `meetings.attendees_json` → wiersze z
`participant_kind='guest'` (bo wolny tekst nie niesie tożsamości),
`display_name = wartość ze stringa`, `invitation_status='no_response'`,
`ON CONFLICT DO NOTHING`. **`attendees_json` zostaje nietknięte**
(§0.3 pkt 5, §1.7 pozycja otwarta nr 5).

**Organizator:** twórca spotkania (`meetings.created_by`) dostaje wiersz
z `role='organizer'`, `invitation_status='accepted'`. Organizator jest
**zawsze widoczny** i **nie da się go usunąć z uczestników** — próba
usunięcia → `400` z komunikatem, nie ciche powodzenie.

**API — nowy zasób:**
```
GET    /api/meeting/:id/participants
POST   /api/meeting/:id/participants          → dodanie użytkownika ORG albo gościa
PATCH  /api/meeting/:id/participants/:pid     → zmiana roli / statusu odpowiedzi
DELETE /api/meeting/:id/participants/:pid     → usunięcie (poza organizatorem)
```

**Wymagania twarde — bezpieczeństwo, bo tu jest największe ryzyko:**
1. **Użytkownik `kind='user'` musi być zwalidowany po stronie serwera
   wobec `users WHERE organization_id = <tenant> AND status = 'active'`.**
   Nie ufasz identyfikatorowi z ciała żądania. To jest ten sam kontrakt,
   który już wymusza kalendarz My Work
   (`CalendarAttendeesField.tsx:6-9` opisuje go wprost).
   Obcy `userId` → `400`/`404`, **nigdy** cichy zapis.
2. **Gość zewnętrzny (`kind='guest'`) to wyłącznie e-mail + nazwa.**
   Zero konta, zero uprawnień, zero dostępu do czegokolwiek w Consultify.
   Walidacja formatu e-maila po stronie serwera.
3. **`invitation_status` zmienia wyłącznie: sam uczestnik (o sobie) albo
   organizator/rola uprawniona.** Test negatywny obowiązkowy: obcy
   użytkownik nie zmienia cudzego statusu.
4. **Zero wysyłki.** Patrz §1.7 pozycja otwarta nr 2: status zaproszenia
   jest **stanem w bazie i widokiem w UI**, nie e-mailem. **Nie budujesz
   SMTP, nie generujesz ICS, nie dotykasz Google/Outlook** — brakujący
   dostawca jest przedmiotem osobnego atomu `SET-INT-REC-001`
   (`RECOVERED_OWNER_FEEDBACK_2026-08-22.md:40`). W UI **nie wolno**
   napisać „Zaproszenie wysłane" — poprawna etykieta to „Zaproszony"
   (stan), a raport zawiera STOP z opisem, czego brakuje do faktycznej
   wysyłki.
5. **Tenant.** Wszystkie cztery trasy przez `getMeeting` + `canAccessMeeting`
   (wzorzec §D.3).

**Definicja ukończenia U.3:**
1. Migracja addytywna z dowodem idempotencji; backfill idempotentny;
   `attendees_json` nietknięte (dowód: `git diff` + zapytanie kontrolne).
2. Cztery trasy działają z readbackiem.
3. **Minimum 6 testów behawioralnych**: happy (user) · happy (gość) ·
   obcy `userId` odrzucony · duplikat odrzucony (unikat) · usunięcie
   organizatora odrzucone · obcy tenant `404`.
4. Test: zmiana statusu przez nieuprawnionego → odmowa, stan bez zmian.
5. Jawny wpis w raporcie: **„wysyłka zaproszeń NIE zbudowana"** + STOP
   z propozycją.

### U.4 — Artefakty dołączone do spotkania (`MYW-CAL-REC-003`)

**Co budujesz:**
1. Migracja addytywna, nowa tabela `meeting_attachments`:
   ```
   id · organization_id · meeting_id · artifact_kind · artifact_id
   · title_snapshot · attached_by · created_at
   ```
   `artifact_kind` = zamknięta lista rodzajów, które realnie umiesz
   zlinkować (minimum: `idea`, `note`/`material`). **Lista zamknięta,
   nie dowolny string.**
   Unikat `(meeting_id, artifact_kind, artifact_id)`.
2. API: `GET/POST/DELETE /api/meeting/:id/attachments`.
3. **★ Kontrola uprawnień przy dołączaniu — to jest sedno wymagania
   („bez wycieku materiałów prywatnych").** Serwer **przed** zapisem
   sprawdza, że dołączający ma prawo do tego artefaktu **w tej
   organizacji**. Brak prawa → `403`/`404`, nigdy zapis.
4. **★ Negatyw odebranego dostępu — wymóg wprost z rejestru.** Jeżeli
   uprawnienie do artefaktu zostanie później odebrane, spotkanie **nie może
   pokazywać jego treści ani działającego linku**. Poprawne zachowanie:
   pozycja zostaje widoczna jako „artefakt niedostępny", bez tytułu i bez
   linku. **`title_snapshot` służy wyłącznie do listy dla osób
   uprawnionych** — dla nieuprawnionego nie jest pokazywany.
5. UI: selektor artefaktów w karcie spotkania (sekcja „Szczegóły" albo
   „Protokół" — **nie nowa sekcja**, `DEC-54`), lista dołączonych z linkiem
   i akcją odłączenia.
6. „Podlinkowanie w zaproszeniu" — ponieważ **zaproszenia nie są wysyłane**
   (§U.3 pkt 4), realizowalna część wymagania to: dołączone artefakty są
   widoczne dla zaproszonych **użytkowników organizacji** na karcie
   spotkania. Dla gości zewnętrznych **nie budujesz publicznych linków** —
   to jest STOP z opisem (wymagałoby modelu udostępniania na zewnątrz,
   którego nie ma).

**Definicja ukończenia U.4:**
1. Migracja addytywna z dowodem idempotencji.
2. Testy behawioralne: happy · dołączenie artefaktu bez uprawnień
   odrzucone · duplikat odrzucony · **odebrany dostęp → pozycja bez tytułu
   i bez linku** · obcy tenant `404`.
3. Zero publicznych linków dla gości; STOP w raporcie z opisem, czego
   brakuje.
4. i18n PL+EN, light+dark, zrzuty własne (selektor, lista dołączonych,
   pozycja niedostępna).

### U.5 — UI tworzenia i edycji spotkania

Dziś modal tworzenia/edycji ma siedem pól, w tym uczestników jako
**textarea rozdzielaną `\n`** (`MeetingHub.tsx:111`, `:518-546`).
Po tej pozycji modal odzwierciedla model z `U.1`–`U.4`.

**Co budujesz:**
1. **Pole uczestników wzorem `CalendarAttendeesField`.**
   `src/components/MyWork/Calendar/CalendarAttendeesField.tsx` jest
   **wzorcem do skopiowania, nie do importu** (Z17, wyjątek §U.5): tworzysz
   własny komponent w `src/components/Meeting/`, bo kontrakt uczestnika
   spotkania jest **szerszy** (goście zewnętrzni + status zaproszenia,
   których pole kalendarza nie zna). Podpowiadanie użytkowników przez
   **istniejący, org-scoped, nie-adminowy** `Api.searchOrgUsers` →
   `GET /api/users/search` (`server/src/routes/users.routes.ts:63-110`;
   filtruje `organization_id` + `status='active'`, minimum 2 znaki).
   **Nie używasz adminowego `GET /users`.**
2. **Dodanie gościa zewnętrznego** — jawna, osobna ścieżka („zaproś przez
   e-mail"), z walidacją formatu i z widocznym oznaczeniem „gość spoza
   organizacji".
3. **Strefa czasowa** — wybór strefy przy terminie, domyślnie wypełniony
   (§U.1 pkt 3).
4. **Cykliczność** — kontrolka reguły powtarzania; przy edycji spotkania
   z serii **wybór zakresu zmiany** (§U.2 pkt 3).
5. **Chipsy statusu zaproszenia** przy uczestnikach — rozróżnialne **bez
   koloru** (etykieta + kształt), zgodnie z kanonem.
6. **Karta spotkania** — sekcja „Szczegóły" pokazuje uczestników
   z tożsamością i statusem, organizatora wyróżnionego, strefę czasową
   i regułę powtarzania. **Bez zmiany powłoki** (`DEC-54`).
7. **Lista** — kolumna „Uczestnicy" przestaje być samym licznikiem
   z `attendees.length` (`:340-345`) i liczy uczestników z nowego modelu;
   wyszukiwanie (`:154`) obejmuje nazwy i e-maile uczestników.

**Definicja ukończenia U.5:**
1. Wszystkie siedem punktów działa na realnych danych, z readbackiem.
2. **Zero atrap** — jeżeli któraś część `U.1`–`U.4` skończyła się
   `BRAK_API`/STOP-em, **odpowiadająca kontrolka nie powstaje**.
3. Minimum 4 testy renderujące realny modal: happy (dodanie użytkownika
   ORG) · dodanie gościa · błąd wyszukiwania użytkowników (uczciwy stan,
   nie pusta lista udająca „brak wyników") · edycja istniejącego spotkania
   zachowuje wszystkie pola.
4. i18n PL+EN kompletne; light+dark; tokeny `c-*`; fokus `c-focus`; zero
   `primary-*`.
5. **Zrzuty własne**: modal tworzenia (pusty i wypełniony) · modal edycji
   spotkania z serii · karta z uczestnikami i statusami · lista z kolumną
   uczestników — light i dark.
6. `bash scripts/check-list-canon.sh src/components/Meeting/MeetingHub.tsx`
   bez nowych naruszeń.

---

## §G. SEKCJA PRZYGOTOWANIE OTWARCIA MODUŁU (bloker B1) — dwie pozycje

**★ Przeczytaj jeszcze raz ★ KRYTYCZNE OGRANICZENIE pkt 1 przed tą sekcją.
Twoim produktem jest PRZEŁĄCZALNOŚĆ, nie przełączenie. Samo otwarcie
wykonuje nadzorca po odbiorze. Codexowi ZAKAZ włączania.**

### G.1 — Jedno źródło prawdy o statusie modułu

Dziś bramka jest w trzech miejscach o trzech różnych mechanizmach
(§2.3): klient (`betaAccess.ts:53`), serwer (`betaGate.middleware.ts:25-37`
— **zaszyta lista ról**, mountowana `meeting.routes.ts:146`) i pilot
(`pilotAccess.ts:66`). Nadzorca, który po odbiorze będzie otwierał moduł,
musi dziś zrobić **trzy zmiany w trzech plikach o trzech różnych
konwencjach** — i każda pominięta zostawia moduł w stanie połowicznym
(widoczny w menu, `403` z API — albo odwrotnie).

**Co budujesz:**

1. **Serwerowy odpowiednik SSOT.** `closedBetaModuleGate` przestaje być
   funkcją z zaszytą listą ról „dla Meetings" i staje się bramką
   **parametryzowaną statusem modułu**, czytanym z jednego, jawnego
   miejsca po stronie serwera (lustro `BETA_MENU_STATUS`). Kształt:
   `createModuleGate('MODULE_MEETING')` albo równoważny — decydujesz, ale
   **musi być deklaratywny i wspólny**, nie skopiowany per moduł.
2. **Zachowanie przy `closed` jest DOKŁADNIE dzisiejsze**: `OWNER`,
   `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN` przechodzą; reszta dostaje
   `403` z kodem `BETA_LOCKED`. **Ani jednego bajtu różnicy w odpowiedzi.**
   Test `tests/unit/backend/middleware/meetingBetaGate.test.ts` musi
   przechodzić **bez zmian** — to jest Twój dowód, że nie ruszyłeś
   zachowania.
3. **Zachowanie przy `open` jest zdefiniowane i przetestowane**, mimo że
   nieaktywne: przechodzą wszystkie aktywne role tej samej organizacji;
   anonim i obcy tenant **nadal** są odrzucani (bramka beta nie zastępuje
   uwierzytelnienia ani izolacji tenantowej).
4. **Mapa przełączenia w komentarzu przy SSOT** — dokładnie, co nadzorca
   zmienia, żeby otworzyć moduł: nazwa stałej, plik, wartość „przed"
   i „po", oraz wymienione pozostałe dwa miejsca (`pilotAccess.ts`,
   `menuConfig`), jeżeli okażą się potrzebne. Jeżeli **nie da się** zrobić
   otwarcia jedną zmianą (bo pilot ma własną semantykę) — **piszesz to
   wprost**: „otwarcie wymaga N zmian: …", i to jest uczciwy wynik, nie
   porażka.
5. **`MODULE_MEETING` zostaje `'closed'`.** `MODULE_MEETING` zostaje na
   liście pilota. Wartości domyślnych nie ruszasz (Z10).

**Definicja ukończenia G.1:**
1. Bramka serwerowa jest parametryzowana jednym statusem; `git diff`
   pokazuje **zero zmian wartości** `'closed'` → `'open'`.
2. `tests/unit/backend/middleware/meetingBetaGate.test.ts` **przechodzi
   bez modyfikacji** (wynik przed/po w raporcie).
3. W raporcie jest **instrukcja otwarcia dla nadzorcy**: lista zmian
   (plik, linia, wartość przed/po) i lista testów, które trzeba uruchomić
   po przełączeniu.
4. Pomiar zasięgu (§0.4a) dla `betaGate.middleware.ts`, `betaAccess.ts`
   i `pilotAccess.ts` — to są pliki bramkujące **cały sidebar**, nie tylko
   Meetings.

### G.2 — Macierz negatywna ról, w obu stanach modułu

**To jest test, nie kod produkcyjny — i jest obowiązkowy.**

Budujesz jeden pakiet testów behawioralnych, który dla **każdej z ról**
(`OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN`, `MEMBER`, `USER`,
rola pusta, rola pilotowa) i dla **obu stanów modułu** (`closed`, `open`)
sprawdza rzeczywistą odpowiedź **realnego routera**, nie funkcję
w izolacji:

| Wymiar | Wartości |
| --- | --- |
| Rola | 8 wartości jw. |
| Stan modułu | `closed` (dziś) · `open` (po otwarciu) |
| Ścieżka | lista `GET /api/meeting` · karta `GET /api/meeting/:id` · zapis (`POST` z §D.3) |
| Tenant | własny · obcy |

**Wymagania twarde:**
1. Stan `open` w teście osiągasz **przez parametryzację bramki**, nigdy
   przez edycję wartości domyślnej (Z10). Jeżeli architektura z `G.1` na
   to nie pozwala — `G.1` jest zrobione źle i wracasz do niego.
2. **Anonim i obcy tenant są odrzucani w OBU stanach.** Otwarcie modułu
   nie może otworzyć izolacji.
3. Test wywołuje realny router (`supertest`), a nie samą funkcję
   middleware. Istniejący grep-test montażu (`meetingBetaGate.test.ts:37-45`)
   zostaje, ale **nie liczy się do DoD** (§0.3).

**Definicja ukończenia G.2:** tabela wyników w raporcie —
`Rola × Stan × Ścieżka × Tenant → oczekiwany status → wynik`, wszystkie
komórki wypełnione, zero „n/d" bez uzasadnienia.

---

## §B. SEKCJA BRIEF OPERATORA (bloker L3) — jedna pozycja

### B.1 — Przycisk „Brief operatora" prowadzi tam, gdzie brief jest

**Stan zastany, zweryfikowany:** dane **są** i **działają**.
`GET /api/ai-operator/meetings/:meetingId/brief`
(`server/src/routes/ai-operator.routes.ts:89-111`) sprawdza tenanta
i `canReadMeetingBrief`, zwraca brief albo `404`. Hub go pobiera
(`MeetingHub.tsx:221-262`), odróżnia błąd od pustki (`:102-105`, `M12-F04`)
i **renderuje w panelu podglądu** (`:994-1010`: `prepSummary`,
`agendaGaps`, `followUpSuggestions`).

**Defekt:** przycisk Menu 3 „Brief operatora" (`:501-514`) woła
`openMeetingDocument(briefingMeeting)` (`:273`) — czyli **nawiguje na
kartę**, a karta briefu **nie renderuje w ogóle**. Użytkownik klika
„Brief operatora" i trafia na ekran, na którym briefu nie ma.

**Dwie dopuszczalne naprawy — wybierasz JEDNĄ i uzasadniasz w raporcie:**

- **(A) Karta dostaje brief.** W sekcji „Szczegóły" karty
  (`MeetingObjectPage.tsx`) pojawia się blok briefu, zasilany tym samym
  endpointem, z **tym samym** rozróżnieniem błąd/pustka co Hub.
  **Bez dodawania czwartej sekcji** — brief wchodzi do istniejącej sekcji
  (`DEC-54`, Z17).
- **(B) Przycisk prowadzi do realnego briefu w Hubie.** Przycisk przestaje
  nawigować na kartę i zamiast tego otwiera/rozwija panel podglądu na
  bloku briefu dla wybranego spotkania.

**Rekomendacja autora instrukcji: (A)** — bo etykieta przycisku obiecuje
„otwórz brief", a karta jest kanonicznym adresem spotkania
(`DEC-2026-08-24-07`); (B) zostawia użytkownika bez adresu, pod którym
brief da się otworzyć z linku. Jeżeli wybierzesz (B), musisz to uzasadnić
w „Korektach wobec instrukcji".

**Czego NIE robisz (Z14):** nie zmieniasz `aiOperatorService`, nie dotykasz
promptów, nie budujesz generowania. To jest **podłączenie istniejącej
powierzchni**, nie budowa silnika.

**Definicja ukończenia B.1:**
1. Kliknięcie „Brief operatora" kończy się widokiem, na którym brief jest
   **widoczny** — dla spotkania, które brief ma.
2. Dla spotkania bez briefu: uczciwy pusty stan („brak briefu"), **nie**
   pusty ekran i **nie** komunikat o błędzie.
3. Dla błędu API: komunikat o błędzie **z ponowieniem** — rozróżnienie
   z `M12-F04` **musi zostać zachowane** (Z15). Test dowodzi obu ścieżek
   osobno.
4. Test tenanta: brief obcego spotkania → `404`, UI pokazuje pusty/błędny
   stan, nigdy cudze dane.
5. i18n PL+EN, light+dark, zrzuty własne: brief obecny · brief pusty ·
   brief w błędzie.

---

## §T. SEKCJA TESTY — sześć pozycji

### T.1 — ★ Jedyny dopuszczalny przypadek zmiany testu istniejącego

**Zasada domyślna: nie zmieniasz żadnego testu, który istniał przed
Twoim dyżurem.**

**Jedyny warunkowy wyjątek** dotyczy
`tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts:349-454`
(osiem asercji `410`) i **aktywuje się TYLKO wtedy**, gdy nadzorca
rozstrzygnie pozycję otwartą nr 1 z §1.7 na korzyść **przywrócenia starych
tras** zamiast nowego zasobu.

**Dopóki tego rozstrzygnięcia nie ma — nie ruszasz tego pliku w ogóle**,
a §D.3 buduje nowy zasób właśnie po to, żeby nie musieć go ruszać.

Gdyby rozstrzygnięcie zapadło, warunki są następujące i są kumulatywne:
1. zmiana jest w **osobnym commicie**, którego jedyną treścią jest ten plik;
2. **żadna asercja nie zostaje usunięta** — asercje `410` zamieniają się
   na asercje **nowego kontraktu** (kod statusu, kształt odpowiedzi,
   negatyw tenanta), a łączna liczba asercji **nie maleje**;
3. w raporcie jest tabela `Asercje przed · Asercje po · Czy któraś
   osłabiona? (MUSI BYĆ: NIE)`;
4. cały pakiet 48 przepływów przechodzi.

**Każda inna zmiana w testach istniejących = STOP.** W szczególności:
`meetingsCanonicalRoute.test.ts` (gramatyka tras, Z11),
`meetingCaptureDefaultOff.contract.test.ts` (Z14),
`meeting-notebook-evidence.realdb.test.ts` (dowody domknięcia),
`meetingBetaGate.test.ts` (musi przejść **bez zmian**, §G.1 pkt 2).

### T.2 — Kontrakty per nowy zasób

Dla **każdej** nowej grupy tras (`decision-records`, `follow-up-records`,
`participants`, `attachments`) powstaje pakiet kontraktowy na **realnym
PostgreSQL**, wzorem
`server/src/services/meetingBoundary/__tests__/meetingBoundaryRoutes.pg.test.ts`.

Minimum na grupę: `201` przy poprawnym zapisie z readbackiem · `400` przy
walidacji · `404` przy nieistniejącym rekordzie · `404` przy obcym tenancie
· idempotencja tam, gdzie jest zadeklarowana · brak fałszywego sukcesu przy
`PATCH`/`DELETE` nieistniejącego rekordu.

### T.3 — Negatywy tenanta jako osobny, jawny pakiet

Nie rozsypane po innych plikach — **jeden pakiet, jedna tabela w raporcie**.
Dla każdej nowej trasy i każdej zmienionej powierzchni: żądanie z tokenem
organizacji B do zasobu organizacji A **nigdy** nie zwraca `200` i **nigdy**
nie potwierdza istnienia zasobu.

Obowiązkowo objęte: wszystkie trasy z §D.3, §U.3, §U.4; materializacja
z §H.1; rodowód z §H.3; brief z §B.1.

### T.4 — i18n PL + EN, parytet utrzymany

```bash
node -e "const p=require('./public/locales/pl/translation.json');const e=require('./public/locales/en/translation.json');const f=(o,pre='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,pre+k+'.'):[pre+k]);const pk=f(p).filter(k=>k.startsWith('meeting'));const ek=f(e).filter(k=>k.startsWith('meeting'));console.log('PL',pk.length,'EN',ek.length);console.log('PL-only',pk.filter(k=>!ek.includes(k)));console.log('EN-only',ek.filter(k=>!pk.includes(k)));"
```

Warunki: `PL-only` **puste**, `EN-only` **puste**, liczby równe. Dodatkowo
w Twoich **nowych** plikach:

```bash
# polskie literały w JSX — musi być pusto
grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" src/components/Meeting/<Twoje nowe pliki>
# walidacja JSON
node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
```

**Granica z nadzorcą:** nie poprawiasz istniejących defektów i18n (B6,
§1.4) — pilnujesz wyłącznie tego, co sam dodałeś.

### T.5 — Dane dowodowe i zrzuty w jednym miejscu

1. Dane do zrzutów pochodzą z **fixture**, nie z ręcznych klików:
   `scripts/dev/seed-wave3-meetings-owner-review.mjs`. Wolno Ci go
   **rozszerzyć** o stany, których dziś nie ma (decyzje, follow-upy,
   uczestnicy z różnymi statusami, seria cykliczna, dołączony artefakt,
   zatwierdzony protokół z materiałem). **Nie zmieniasz istniejących
   tożsamości i stanów** — one są związane z retained-DB cudzego etapu
   odbiorowego (`MODULE_ACCEPTANCE.md`, `MTG-OWNER-01`).
2. **Pułapka tytułów (P3, §H):** żaden tytuł w fixture nie może zawierać
   słowa „test", „E2E", „smoke" ani „probe".
3. Zrzuty trafiają do
   `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/evidence/day10/`,
   nazwane `<pozycja>-<stan>-<motyw>.png`, np.
   `D4-decisions-empty-dark.png`.
4. Runtime lokalny na portach **4300/4301** (Z7).
5. **Zrzut czysty:** zero gwiazdek, zero ozdób, zero danych osobowych,
   tokeny `c-*`, oba motywy.

### T.6 — Dostępność i responsywność nowych powierzchni

Minimum, bo to jest pierwszy taki dowód w tym module poza `G06`
`PARTIAL_DESKTOP_PL` (`MODULE_ACCEPTANCE.md`, wiersz `G06`):
1. każda nowa kontrolka osiągalna klawiaturą, w sensownej kolejności;
2. fokus widoczny — `focus-visible:ring-2 ring-[color:var(--c-focus)]`,
   nigdy `outline: none` bez zamiennika;
3. każdy stan (zaproszenie, rodowód, status follow-upu) **rozróżnialny bez
   koloru** — etykieta albo kształt, nie sam odcień;
4. nowe powierzchnie nie łamią się przy szerokości okna **1055 px**
   (dokładnie ta szerokość jest w dowodzie `G06` — użyj jej, żeby wynik był
   porównywalny);
5. konsola bez błędów przy renderze nowych powierzchni (wynik do raportu).

---

## §R. SEKCJA REJESTR I DOWODY (bloker B7) — dwie pozycje

### R.1 — `MODULE_ACCEPTANCE.md` 08_MEETINGS do stanu faktycznego

Plik `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`
(102 linie) jest **jedynym dokumentem rejestrowym, który wolno Ci zmienić**
(Z12), i **wyłącznie w zakresie poniżej**.

**Co jest dziś nieaktualne — zweryfikuj każdą pozycję sam, zanim
poprawisz:**

| Miejsce | Stan w dokumencie | Stan faktyczny (do weryfikacji w Bloku 0) |
| --- | --- | --- |
| `Routes:` (nagłówek) | `/meeting` | gramatyka `DEC-2026-08-24-07`: `/meetings`, `/meetings/:meetingId`, `/meetings/:meetingId/{minutes,decisions}`, `/meetings/:meetingId/notes/:noteId`; `/meeting` = przekierowanie |
| `Current gate` | `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING` | uzupełnić o stan po `DEC-52`/`DEC-54` (lista i karta zaakceptowane) i o `DEC-58` (`CLOSED_FINAL` odroczone) |
| `G02` | „Direct decision/follow-up writers are retired fail-closed" | po §D: retired **zostają**, a zapis idzie nowym zasobem — opisać, nie skasować historii |
| `G06` | `PARTIAL_DESKTOP_PL` | uzupełnić o dowody z §T.5/§T.6 (EN, dark, 1055 px, a11y) |
| `G07`–`G20` | `NOT_STARTED` / `READY_FOR_GUIDED_REPLAY` | **nie zmieniasz na `PASS`.** Odbiór właściciela to nie Twoja rola (§1.6) |
| „Owner UI/UX/CX register" | `_none_` | uzupełnić o atomy `MYW-CAL-REC-001/002/003` z ich stanem po §U |
| „Implementation/regression ledger" | `_none_` | wpisać **swoje** pozycje: `Finding IDs · Root cause · Approved solution · Commit · Shared surfaces · Impacted modules · Tests · Regression` |

**Twarde reguły edycji:**
1. **Nie podnosisz żadnej bramki na `PASS` na podstawie własnej pracy.**
   Twój najwyższy dopuszczalny poziom to `TECHNICAL_PASS` (§9.2 pkt 4).
2. **Nie kasujesz historii** — dopisujesz stan aktualny obok, z datą
   i SHA. Blok „Recovery replay — 2026-08-23" zostaje nietknięty.
3. **Nie zmieniasz `Owner verdict`** (`Decision: PENDING`). To wpisuje
   właściciel.
4. Każda zmieniona komórka ma **dowód**: `plik:linia`, SHA commita albo
   wynik komendy.

**Definicja ukończenia R.1:** dokument opisuje stan, który da się
zweryfikować w kodzie tego samego dnia; każda zmieniona komórka ma dowód;
`Owner verdict` i bramki `G07`+ nietknięte.

### R.2 — Komplet dowodów

Do `modules/08_MEETINGS/evidence/day10/` trafia komplet, który pozwala
nadzorcy zrobić odbiór **bez uruchamiania Twojego środowiska**:

| Dowód | Wariant | Uwaga |
| --- | --- | --- |
| Lista `/meetings` | light + dark, PL + EN | z niezerowymi licznikami decyzji i follow-upów |
| Preview wiersza | light + dark | z briefem obecnym |
| Karta — Szczegóły | light + dark | uczestnicy ze statusami, strefa, cykliczność, dołączone artefakty |
| Karta — Protokół | light + dark | notatka zatwierdzona + rodowód materiału |
| Karta — Decyzje i działania | light + dark | z danymi · pusta · w błędzie |
| Modal tworzenia | light + dark | pusty i wypełniony |
| Modal edycji z serii | light + dark | wybór zakresu zmiany |
| Materials — kolumna „Źródło" | light + dark | wiersz pochodzący ze spotkania |
| Brief operatora | light + dark | obecny · pusty · w błędzie |

Plus w raporcie (nie jako obraz, jako tekst): wyniki migracji (1)(2)(3),
wyniki testów przed/po, macierz ról §G.2, tabela negatywów tenanta §T.3,
wynik `check-list-canon.sh`.

**Definicja ukończenia R.2:** każdy wiersz tabeli ma plik; brakujący wiersz
jest **wymieniony w raporcie z powodem**, a nie po cichu pominięty.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz)

1. `git fetch --all --prune`; **weryfikacja markera**:
   ```bash
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   Brak → **STOP i koniec dyżuru** (§0.1 pkt 2).
2. Weryfikacja materiałów wiążących (§0.1 pkt 3). Brak → **STOP**.
3. Utworzenie gałęzi + worktree (§0.1 pkt 4–5).
4. **★ KOORDYNACJA — dwa sprawdzenia, obowiązkowe, wynik do raportu**
   (§1.4):
   ```bash
   # (a) dzień 6 — szablony agendy
   git merge-base --is-ancestor b61255f514 HEAD && echo "DZIEN6 SCALONY" || echo "DZIEN6 NIESCALONY"
   ls -la server/migrations/20260825_meeting_agenda_templates.sql 2>/dev/null
   grep -rn "meeting_agenda_templates" server/src src | grep -v __tests__ | head

   # (b) naprawy szybkie nadzorcy
   git log --oneline codex/m03-admin-20260824..codex/meetings-quickfixes-20260825 | head -20
   ```
   Jeśli (b) ma commity — **rebase przed pierwszym commitem** i wpis do
   raportu, na jaki SHA.
5. **★ Weryfikacja mapy technicznej z §2 — mapa mogła się zestarzeć.**
   Wykonujesz **wszystkie** poniższe i **każdą rozbieżność wpisujesz do
   „Korekt wobec instrukcji"**; dalej pracujesz na stanie faktycznym, nie
   na tym dokumencie.
   ```bash
   # rozmiary (§2.1)
   wc -l server/src/routes/meeting.routes.ts                              # oczekiwane 591
   wc -l server/src/services/meetingService.ts                            # oczekiwane 405
   wc -l server/src/services/meetingBoundary/meetingBoundaryService.ts    # oczekiwane 690
   wc -l src/components/Meeting/MeetingHub.tsx                            # oczekiwane 1681
   wc -l src/components/Meeting/MeetingObjectPage.tsx                     # oczekiwane 575
   wc -l tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts  # oczekiwane 804
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md # oczekiwane 102

   # bramki (§2.3)
   grep -n "MODULE_MEETING" src/utils/betaAccess.ts                       # oczekiwane :53 'closed'
   grep -n "MODULE_MEETING" src/utils/pilotAccess.ts                      # oczekiwane :66
   grep -n -A12 "export function closedBetaModuleGate" server/src/middleware/betaGate.middleware.ts
   grep -n "closedBetaModuleGate" server/src/routes/meeting.routes.ts     # oczekiwane :4 i :146

   # martwe decyzje/follow-upy (§1.5 pułapka 4)
   grep -n "status(410)" server/src/routes/meeting.routes.ts              # oczekiwane :307 :321 :338
   grep -n "decisions: \[\]" server/src/routes/meeting.routes.ts          # oczekiwane :220
   grep -n "decisions" server/src/services/meetingService.ts | head -20
   grep -rn "addMeetingDecision\|addMeetingFollowUp\|updateMeetingFollowUpStatus" server/src src tests | grep -v "meetingService.ts:"
   grep -c "toBe(410)" tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts

   # materializacja wskazująca samą siebie (§1.5 pułapka 5)
   grep -n -B4 -A8 "targetRecordId" server/src/services/meetingBoundary/meetingBoundaryService.ts | head -40
   grep -rn "producer_kind = 'meeting'\|sourceType: 'meeting'" server/src | grep -v __tests__

   # rejestr materiałów (§2.4)
   grep -n "export async function registerArtifactOrigin" server/src/services/v8/artifactRegistryService.ts
   grep -n "sourceType: raw.originRuntime" src/components/ReportsAndPresentations/useRapData.ts
   grep -n "resolvePresentationSourceType" src/components/ReportsAndPresentations/useRapData.ts

   # model uczestników i kalendarz-wzorzec (§U)
   grep -n "attendees" server/src/services/meetingService.ts | head -20
   sed -n '1,40p' server/migrations/20260827_calendar_events.sql
   grep -rn "searchOrgUsers" src/services/api.ts | head

   # brief (§B.1)
   grep -n "meetings/:meetingId/brief" server/src/routes/ai-operator.routes.ts
   grep -n "operatorBrief" src/components/Meeting/MeetingHub.tsx | head -20

   # historia obszaru
   git log --oneline -20 -- server/src/routes/meeting.routes.ts server/src/services/meetingService.ts src/components/Meeting
   ```
6. **Dowód stanu wyjściowego testów** (§2.6) — **wyniki wklejasz do
   raportu**, to Twój punkt odniesienia przy odbiorze:
   ```bash
   npx vitest run src/components/Meeting/__tests__
   npx vitest run src/routes/__tests__/meetingsCanonicalRoute.test.ts
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   npx vitest run tests/unit/meeting
   ```
7. **Stan zastany kanonu tabel** (punkt odniesienia dla Bloku 6):
   ```bash
   bash scripts/check-list-canon.sh 2>&1 | tail -20
   ```
   Liczbę naruszeń i baseline wpisujesz do raportu — po dyżurze **nie może
   urosnąć**.
8. **Weryfikacja świeżej bazy** (bo w tym dyżurze są migracje): postaw
   jednorazowy kontener wg §0.3 pkt 4 i wykonaj przebieg (1) **na
   nietkniętym repo**, żeby wiedzieć, jaki jest stan wyjściowy replay-a.
   Jeżeli replay zatrzymuje się na cudzej migracji — **zanotuj nazwę pliku
   TERAZ**, żeby później nie przypisać sobie cudzego defektu.
9. Założenie pliku raportu (§9) i wpisanie wyników kroków 1–8.

### Blok 1 — fundament danych (D.1 → D.2)

**D.1 jest tanie i bez kodu — robisz je pierwsze**, bo od jego wyniku
zależy, czy §D w ogóle ma sens w tej formie.

**D.2 jest bramką sekcji §D i pośrednio §H.** Jeżeli nie da się zrobić
addytywnej, idempotentnej migracji z dowodem — **cała sekcja §D jest
STOP-em**, a Ty przechodzisz do §B.1 i §G (które migracji nie wymagają).
Nie budujesz UI nad modelem, którego nie umiesz odtworzyć na świeżej bazie.

Po D.2 natychmiast pomiar zasięgu:
```bash
git diff --name-only codex/m03-admin-20260824...HEAD
npx vitest run server/src/services/__tests__/meetingService.test.ts
npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
```

### Blok 2 — decyzje i follow-upy (D.3 → D.4 → D.5)

Kolejność sztywna: API → karta → lista. Odwrotna kolejność oznacza
budowanie UI nad kontraktem, który się jeszcze zmieni.

**D.5 jest najtańszą pozycją w całym dyżurze** (kolumna + licznik nad
danymi, które już są) — jeżeli w bloku zostaje pół godziny, zrób właśnie ją.

### Blok 3 — tanie domknięcia (B.1 → G.1 → G.2)

**Świadome odstępstwo od kolejności numerów.** `B.1` (brief) i `§G`
(bramka) **nie zależą od niczego, co budujesz** i są tanie. Robisz je przed
najdroższą sekcją, żeby dyżur miał zamknięty dorobek nawet wtedy, gdy §U
się nie zmieści.

`G.1` przed `G.2`, bo `G.2` testuje stan `open` przez parametryzację, którą
`G.1` dopiero tworzy.

### Blok 4 — przepływ do Materials (H.1 → H.3 → H.2 → H.4)

**★ Odstępstwo od kolejności numerów, świadome: H.3 idzie PRZED H.2.**
Powód: `H.3` (rodowód) jest **dowodem, że `H.1` faktycznie zadziałało** —
bez niego nikt nie zobaczy, że materiał powstał. `H.2` (My Work /
Initiatives) jest najbardziej narażone na `BRAK_API` i najmniej pewne.

`H.4` (cold readback) **zawsze na końcu bloku** i **nie wolno go pominąć** —
bez niego §H jest deklaracją, nie dowodem.

### Blok 5 — wymagania kalendarzowe (U.1 → U.2 → U.3 → U.4 → U.5)

**Tu prawie na pewno zabraknie czasu i to jest przewidziane.** Kolejność
posortowana malejąco po stosunku wartości do kosztu:

- **U.1** (strefa) jest tania, samodzielna i naprawia realny defekt danych;
- **U.2** (cykliczność) jest średnia i ma gotowy wzorzec w
  `calendar_events`;
- **U.3** (uczestnicy) jest **najdroższa w całym dyżurze** — model, API,
  backfill, sześć testów. Jeżeli zaczynasz ją z mniej niż połową bloku,
  **nie zaczynaj**: zrób `U.5` w części dotyczącej `U.1`/`U.2` i zamknij
  czysto;
- **U.4** (artefakty) zależy od `U.3` tylko w części „widoczne dla
  zaproszonych" — resztę da się zrobić niezależnie;
- **U.5** (UI) domyka to, co faktycznie zbudowałeś. **Nie buduje kontrolek
  dla pozycji, które skończyły się STOP-em** (DoD 3).

### Blok 6 — domknięcie (obowiązkowo, ~80 min, NIE pomijasz)

1. **T.2 · T.3 · T.4 · T.5 · T.6 · R.1 · R.2** — testy i rejestr **dla
   tego, co faktycznie zbudowałeś**. Nie dla tego, co planowałeś.
2. **Pomiar zasięgu testów** wg §0.4a: lista dotkniętych plików,
   wyodrębnienie współdzielonych, testy katalogów konsumentów, jawna
   deklaracja `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY`.
3. **SIEDEM DOWODÓW — wszystkie do raportu, wszystkie obowiązkowe:**
   ```bash
   # (1) Z18 — globalna infrastruktura testowa            oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"

   # (2) Migracje — TYLKO Twoje, TYLKO 20260826_meetings_day10_*
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"
   # niedopuszczalny w wyniku: 20260825_meeting_agenda_templates.sql (dzień 6),
   #                           20260623_meetings_baseline.sql, 20260912_claude_c_meeting_boundary.sql

   # (3) Flagi i bramki — ZERO zmian wartości domyślnych
   git diff codex/m03-admin-20260824...HEAD -- src/utils/betaAccess.ts src/utils/pilotAccess.ts | grep -E "^[+-].*(MODULE_MEETING|BETA_ADMINS_EXEMPT)"
   # oczekiwane: ZERO linii zmieniających wartość 'closed'
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags)"
   # oczekiwane: PUSTY (zero nowych flag)

   # (4) Z17 — zakres plików                              każdy plik w wyniku wymaga uzasadnienia
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -vE "^(server/src/routes/meeting.routes.ts|server/src/services/meetingService.ts|server/src/services/meetingBoundary/|server/src/routes/ai-operator.routes.ts|server/migrations/20260826_meetings_day10_|src/components/Meeting/|src/services/api.ts|src/utils/betaAccess.ts|src/utils/pilotAccess.ts|server/src/middleware/betaGate.middleware.ts|public/locales/|scripts/dev/seed-wave3-meetings-owner-review.mjs|src/components/ReportsAndPresentations/useRapData.ts|tests/unit/meeting/|tests/integration/routes/meeting\.|docs/program/waves/WAVE_03_ACCEPTANCE/(MEETINGS_DAY10_REPORT|modules/08_MEETINGS/))"
   # ★ Pliki z standard/, shared/, AppRoutes, routeConfig, handoffSpineService,
   #   MyWork/, artifactRegistryService w wyniku = NARUSZENIE Z17 (poza wyjątkami §H.2)

   # (5) Kanon tabel — baseline nietknięty
   bash scripts/check-list-canon.sh 2>&1 | tail -20
   git diff codex/m03-admin-20260824...HEAD -- scripts/check-list-canon.baseline.txt
   # drugi wynik MUSI być pusty; pierwszy: liczba naruszeń NIE ROŚNIE

   # (6) Higiena Dockera — po dowodzie migracji
   docker ps -a --filter name=cx-day10 --format '{{.Names}}'    # oczekiwany wynik: PUSTY
   docker volume ls -q | grep -i cx-day10                       # oczekiwany wynik: PUSTY

   # (7) ★ WIP właściciela — oświadczenie w raporcie
   # „nie otwierałem /Users/piotrwisniewski/Developer/Consultify"
   ```
4. **Ponowne uruchomienie sześciu pakietów z Bloku 0 kroku 6** i wklejenie
   wyników „po" obok „przed".
5. **Pełny pakiet 48 przepływów** — dowód, że kontrakt `410` przetrwał:
   ```bash
   npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
   ```
6. Domknięcie raportu.

### Zasada nadrzędna kolejności

**Lepiej pięć pozycji domkniętych co do DoD niż dwadzieścia „prawie".**
Jeżeli zostaje Ci godzina, nie zaczynaj nowej pozycji — zrób Blok 6,
uporządkuj commity i zamknij dyżur czysto. **Blok 6 nie jest opcjonalny.**

**Jeżeli musisz wybrać między pozycjami**, priorytet jest taki:

1. **D.2** — bez modelu nie ma §D ani połowy §H;
2. **H.1** — to jest jedyny bloker, który zamyka pozycję kontraktu
   (`MET-F-006`) oznaczoną jako `gap` od miesiąca;
3. **B.1** — najtańsza naprawa realnej atrapy w całym dyżurze;
4. **G.1 + G.2** — bez nich nadzorca nie ma czym otworzyć modułu po
   odbiorze, a to jest cel całego bloku dnia 10;
5. **U.1** — tania, samodzielna, naprawia defekt danych, o którym
   właściciel mówił wprost.

**Pięć pozycji otwartych z §1.7 NIE jest odkładalnych** — ich produktem
jest STOP w raporcie, a to kosztuje minuty, nie godziny. Dyżur bez tych
pięciu STOP-ów zostawia nadzorcę bez pytań, na które musi odpowiedzieć,
i blokuje kolejną iterację.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY10_REPORT_<data>.md
```

Raport leży **na poziomie fali**, nie w `modules/08_MEETINGS/` — bo rejestr
modułu jest dokumentem odbiorowym i zmieniasz go wyłącznie w zakresie `R.1`.
Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Meetings dzień 10 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź robocza: codex/meetings-day10-<data>
Worktree: /private/tmp/consultify-meetings-day10
Porty użyte: 4300/4301 (albo: żadne)   ·   Kontener PG: cx-day10-pg (usunięty: TAK/NIE)
Czas pracy: <od>–<do>

## Oświadczenie o chronionym WIP (Z4/Z5)
Nie otwierałem, nie czytałem i nie kopiowałem katalogu
/Users/piotrwisniewski/Developer/Consultify — ani plików, ani diffów, ani gita.
Jedynym źródłem wymagań były: rejestr decyzji, rejestr uwag właściciela,
kontrakt modułu i kod w repozytorium.                                TAK / NIE

## ★ Koordynacja — wynik sprawdzenia z Bloku 0 kroku 4
| Strumień | Sprawdzenie | Wynik | Konsekwencja dla mojego zakresu |
| Dzień 6 (szablony agendy) | merge-base b61255f514 | SCALONY / NIESCALONY | konsumuję / nie dotykam |
| Naprawy szybkie nadzorcy | git log ..quickfixes | <N commitów / pusto> | rebase na <SHA> / brak |
Potwierdzam, że NIE budowałem szablonów agendy i NIE naprawiałem
i18n/gatingu/statusu/kasowania/komentarzy (B4, B5, B6, B8, K1-K4).  TAK / NIE

## Warunki wstępne — wynik sprawdzenia
| Sprawdzenie | Oczekiwane | Wynik | Dowód |
| --- | --- | --- | --- |
| Marker jest przodkiem tipa | TAK | | `git merge-base --is-ancestor` |
| meeting.routes.ts = 591 linii | TAK | | `wc -l` |
| meetingService.ts = 405 linii | TAK | | `wc -l` |
| meetingBoundaryService.ts = 690 linii | TAK | | `wc -l` |
| MeetingHub.tsx = 1681 linii | TAK | | `wc -l` |
| MeetingObjectPage.tsx = 575 linii | TAK | | `wc -l` |
| MODULE_ACCEPTANCE.md = 102 linie | TAK | | `wc -l` |
| MODULE_MEETING = 'closed' | TAK | | betaAccess.ts:53 |
| closedBetaModuleGate mountowany na routerze | TAK | | meeting.routes.ts:146 |
| trzy trasy zwracają 410 | TAK | | :307 :321 :338 |
| create wymusza decisions: [] | TAK | | :220 |
| updateMeeting nie tyka decisions_json | TAK | | grep |
| produkcyjni wołający addMeetingDecision | ZERO | | grep |
| liczba asercji `toBe(410)` w golden-flows | 8 | | grep -c |
| materializacja wskazuje note.id | TAK (do naprawy) | | meetingBoundaryService.ts:581-593 |
| konsument producer_kind='meeting' | BRAK | | grep |
| useRapData sourceType = originRuntime | TAK (do naprawy) | | :270 |
| i18n meeting.*: PL 137 / EN 137, parytet | TAK | | node -e |
| check-list-canon: <N> / baseline <N> | dług nie rośnie | | skrypt |
| MeetingHub.__tests__ (przed) | X/X PASS | | |
| MeetingObjectPage.test (przed) | X/X PASS | | |
| meetingService.test (przed) | X/X PASS | | |
| meeting.routes.test (przed) | X/X PASS | | |
| meetingBetaGate.test (przed) | X/X PASS | | |
| meetingsCanonicalRoute.test (przed) | X/X PASS | | |
| golden-flows 48 przepływów (przed) | X/X PASS | | |
| replay migracji na świeżej bazie (przed) | <stan> | | krok 8 |

## Pozycje — tabela zbiorcza
| Pozycja | Zakres | Status | Commit | Testy | Zrzuty | Uwagi |
| --- | --- | --- | --- | --- | --- | --- |
| D.1 | inwentarz martwoty decyzji/follow-upów | | | | n/d | |
| D.2 | model danych + migracja + backfill | | | | n/d | |
| D.3 | API decision-records / follow-up-records | | | | n/d | |
| D.4 | sekcja "Decyzje i działania" jako miejsce pracy | | | | | |
| D.5 | kolumny i pstryczek na liście | | | | | |
| H.1 | zatwierdzony protokół → realny materiał | | | | n/d | |
| H.2 | handoff do My Work / Initiatives | | | | | |
| H.3 | rodowód w obie strony | | | | | |
| H.4 | cold readback całej ścieżki | | | | n/d | |
| U.1 | strefa czasowa | | | | | |
| U.2 | cykliczność | | | | | |
| U.3 | uczestnicy: org + goście + status | | | | | |
| U.4 | artefakty dołączone do spotkania | | | | | |
| U.5 | UI tworzenia i edycji | | | | | |
| G.1 | jedno źródło prawdy o statusie modułu | | | | n/d | |
| G.2 | macierz negatywna ról w obu stanach | | | | n/d | |
| B.1 | brief operatora prowadzi tam, gdzie brief jest | | | | | |
| T.1 | (nie ruszam testów istniejących) | | | | n/d | |
| T.2 | kontrakty per nowy zasób | | | | n/d | |
| T.3 | negatywy tenanta | | | | n/d | |
| T.4 | i18n PL+EN parytet | | | | n/d | |
| T.5 | fixture i zrzuty | | | | | |
| T.6 | a11y i responsywność | | | | | |
| R.1 | MODULE_ACCEPTANCE do stanu faktycznego | | | | n/d | |
| R.2 | komplet dowodów | | | | | |

(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · JUŻ_BYŁO · BRAK_API ·
 BRAK_UI_JEST_API · NIE_ZACZĘTE)

## Tabele werdyktów — główny produkt pozycji
### D.1 — inwentarz martwoty
| Element | Werdykt | Dowód plik:linia | Co zrobiłem |
(werdykt ∈ JEST · JEST_CZĘŚCIOWO · BRAK_UI_JEST_API · BRAK_API · MARTWE)
### D.2 — model danych
| Obiekt | Tabela/kolumna | Addytywne? | Klucz deduplikacji | Backfill idempotentny? |
### D.3 — osiem tras
| Trasa | Happy | 400 | 404 | Obcy tenant | Readback |
### H.1 — materializacja
| Krok | Przed dyżurem | Po dyżurze | Dowód |
| targetRecordId | note.id | | |
| wiersz v8_output_artifacts | brak | | |
| otwarcie materiału | n/d | 200 / 404 | |
### H.2 — inwentarz celów handoffu
| Cel | Endpoint | Istnieje? | Kontrakt | Werdykt |
### H.3 — rodowód
| Kierunek | Powierzchnia | Co widać | Dowód testu |
| spotkanie → materiał | karta, sekcja Protokół | | |
| materiał → spotkanie | Materials, kolumna Źródło | | |
### U.1/U.2 — model czasu
| Pole | Kolumna | Domyślna wartość | Zachowanie dla wierszy sprzed migracji |
### U.3 — uczestnicy
| Rodzaj | Walidacja serwerowa | Status zaproszenia | Kto może zmienić | Test negatywny |
| user (organizacja) | | | | |
| guest (zewnętrzny) | | | | |
### U.4 — artefakty
| Scenariusz | Oczekiwane | Wynik |
| dołączenie bez uprawnień | odmowa | |
| odebrany dostęp | brak tytułu i linku | |
### G.1 — bramka
| Warstwa | Plik:linia | Przed | Po | Kto przechodzi przy 'closed' | Kto przy 'open' |
### G.2 — macierz ról
| Rola | Stan modułu | Ścieżka | Tenant | Oczekiwane | Wynik |
### B.1 — brief
| Stan | Oczekiwane zachowanie | Wynik | Test |
| brief istnieje | widoczny | | |
| brak briefu | uczciwy pusty stan | | |
| błąd API | komunikat + ponowienie | | |

## Instrukcja otwarcia modułu dla nadzorcy (produkt G.1)
| # | Plik | Linia | Wartość przed | Wartość po | Uwaga |
Testy do uruchomienia po przełączeniu: <lista>
Czy otwarcie jest możliwe JEDNĄ zmianą? TAK / NIE — jeśli NIE, ile i dlaczego.

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — ścieżka API decyzji (nowy zasób vs przywrócenie /decisions)
### STOP — wysyłka zaproszeń (brak dostawcy; SET-INT-REC-001)
### STOP — semantyka edycji serii cyklicznej
### STOP — handoff automatyczny vs decyzja człowieka
### STOP — los legacy decisions_json / attendees_json po backfillu
### STOP — <pozostałe, jeśli wystąpiły>

## Znaleziska (problemy w istniejącym kodzie — NIE naprawiane przeze mnie)
| # | Plik:linia | Co znalazłem | Dlaczego nie naprawiłem |
(oczekiwane co najmniej: polskie literały w gałęzi `en:` na karcie —
 własność nadzorcy B6 · komentarz betaGate „wszystkie moduły są open"
 sprzeczny z betaAccess.ts:53 · brak strefy czasowej w calendar_events ·
 zero frontendowych konsumentów /api/artifact-lineage/* ·
 tryb ?sampleData=materials-vnext podmieniający dane listy Materials ·
 heurystyka isDraftHeuristicTitle ukrywająca tytuły ze słowem „test")

## Korekty wobec instrukcji
(miejsca, gdzie instrukcja mówiła coś innego niż zastany kod — z dowodem)

## Migracje
| Plik | Addytywna? | Idempotencja | Backfill | Dowód (1)(2)(3) |
Deklaracja: IDEMPOTENCJA_PEŁNA / IDEMPOTENCJA_CELOWANA (+ nazwa cudzej
migracji, na której zatrzymał się replay)
Higiena Dockera: kontener usunięty TAK/NIE · wolumeny usunięte TAK/NIE

## Testy

### Testy własne
| Plik testowy | Nowy/zmieniony | Behawioralny? | Liczba asercji | Wynik |
(★ kolumna „Behawioralny?" — grep-testy oznaczasz NIE i nie liczysz do DoD)

### Zmiana testu istniejącego
| Test | Asercje przed | Asercje po | Czy któraś osłabiona? |
| (oczekiwane: BRAK ZMIAN we wszystkich) | | | MUSI BYĆ: NIE |

### Pomiar zasięgu (§0.4a)
Deklaracja: **ZASIĘG PEŁNY** / **ZASIĘG CZĘŚCIOWY**

Pliki współdzielone, które dotknąłem:
| Plik | Kto go importuje spoza mojego zakresu |

Testy katalogów konsumentów:
| Katalog | Komenda | Wynik |

Czego NIE uruchomiłem i dlaczego:
(w szczególności: tests/e2e i tests/acceptance — Z17 zabrania mi tam wchodzić)

### Siedem dowodów Bloku 6
```
$ git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"
<wynik — oczekiwany: pusty>

$ git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"
<wynik — oczekiwane: wyłącznie 20260826_meetings_day10_*>

$ git diff codex/m03-admin-20260824...HEAD -- src/utils/betaAccess.ts src/utils/pilotAccess.ts | grep -E "^[+-].*(MODULE_MEETING|BETA_ADMINS_EXEMPT)"
<wynik — oczekiwany: zero zmian wartości>

$ git diff --name-only codex/m03-admin-20260824...HEAD | grep -vE "<filtr zakresu z §8 Blok 6 pkt 3>"
<wynik + uzasadnienie każdego pliku>

$ bash scripts/check-list-canon.sh 2>&1 | tail -5
$ git diff codex/m03-admin-20260824...HEAD -- scripts/check-list-canon.baseline.txt
<drugi wynik — oczekiwany: pusty>

$ docker ps -a --filter name=cx-day10 --format '{{.Names}}'
<wynik — oczekiwany: pusty>

# oświadczenie o WIP właściciela — wyżej
```

### Testy stanu wyjściowego — przed i po
| Test | Przed | Po |
| MeetingHub.__tests__ | | |
| MeetingObjectPage.test.tsx | | |
| meetingService.test.ts | | |
| meeting.routes.test.ts | | |
| meetingBetaGate.test.ts | | |
| meetingsCanonicalRoute.test.ts | | |
| meeting.m12-golden-flows (48 przepływów) | | |
| check-list-canon (pełny skan) | <N>/<N> | |

## Zrzuty (R.2)
| Powierzchnia | Light | Dark | PL | EN | Plik |

## Licznik
Pozycji w zakresie: 25 (D:5 · H:4 · U:5 · G:2 · B:1 · T:6 · R:2)
Domkniętych wg DoD: <N>   Częściowo: <N>   STOP: <N>
JUŻ_BYŁO: <N>   BRAK_API: <N>   NIE_ZACZĘTE: <N>
Pozycji otwartych ze STOP-em: <N> z 5

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Dowód albo nie ma tego w raporcie.** Każde „działa" ma `plik:linia`,
   wynik komendy albo SHA commita.
2. **STOP jest wynikiem pełnowartościowym.** `BRAK_API` z pełną tabelą jest
   **lepszym** wynikiem niż UI nad pustką. W tym dyżurze trzy pozycje są
   z góry podejrzane o `BRAK_API` (H.2 handoff, U.3 wysyłka zaproszeń,
   U.4 linki dla gości) i nikt nie będzie tym rozczarowany.
3. **Nie piszesz „gotowe do otwarcia modułu" ani „gotowe do pokazania
   właścicielowi".** Piszesz „gotowe do zrzutu przez nadzorcę" (§1.6).
4. **Nie raportujesz poziomu wyższego niż `TECHNICAL_PASS`.**
5. **Test grepujący źródło zawsze oznaczasz jako niebehawioralny.**
   Raport, w którym pozycja ma wyłącznie takie testy, jest odbierany jako
   `CZĘŚCIOWO`, niezależnie od liczby asercji.
6. **Nie oceniasz decyzji właściciela.** Jeśli decyzja wydaje Ci się zła,
   opisujesz **skutek techniczny** w „Znaleziskach", bez oceny.
7. **Raport piszesz na bieżąco**, po każdej pozycji. Nie na końcu z pamięci.
8. **Wszystko, co zobaczyłeś, a co należy do nadzorcy albo dnia 6, idzie do
   „Znalezisk"**, nie do kodu.

---

## 10. ŚCIĄGA

### 10.1. Pliki, które otwierasz najczęściej

```
# MATERIAŁY WIĄŻĄCE — otwierasz PRZED pierwszą linią kodu
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   :29 :100 :104 :106 :110
docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md  :34-36
docs/modules/13_meeting/CURRENT_CONTRACT.md                    :29-37 (MET-F-006 = gap)
docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (§R.1)
docs/ui-standards/TRIADA_KANON.md                              ← lista
Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md             ← karta SPEC-A, archetyp C

# §D — decyzje i follow-upy
server/src/routes/meeting.routes.ts        :129-140 :146 :202 :220 :239 :300-341
server/src/services/meetingService.ts      :23 :95-132 :134-158 :232-293 :326-405
src/components/Meeting/MeetingObjectPage.tsx   :80 :224-239 :378-407 :410-449
src/components/Meeting/MeetingHub.tsx          :340-345 :394-403 :451-462
tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts  :349-454

# §H — przepływ do Materials
server/src/services/meetingBoundary/meetingBoundaryService.ts  :215-245 :260-290 :418-434 :518-600
server/src/services/artifactHandoff/handoffSpineService.ts     :46 :49 :392 :609 :651 :701  (TYLKO ODCZYT/WOŁANIE)
server/src/services/v8/artifactRegistryService.ts              :1289 :2464-2470 :2680-2700  (TYLKO WOŁANIE)
server/src/types/artifactRegistry.ts                           :221-238 :339-357
server/src/routes/artifacts.routes.ts                          :180-193 :383-395 :510-596
server/src/routes/work-canvas.routes.ts                        :4564-4619   (wzorzec transakcyjny)
server/src/routes/document-studio.routes.ts                    :735-800 :4680-4703
server/src/services/wave5ArtifactRuntimeService.ts             :368-397 :462-518
server/src/services/documentStudio/documentStudioService.ts    :177 :1268-1328
src/components/ReportsAndPresentations/useRapData.ts           :270 :403-421   (§H.3 — JEDNA zmiana)

# §U — uczestnicy, czas, artefakty
server/migrations/20260827_calendar_events.sql                 (wzorzec, TYLKO ODCZYT)
src/components/MyWork/Calendar/CalendarAttendeesField.tsx      (wzorzec, TYLKO ODCZYT)
server/src/routes/users.routes.ts                              :63-110  (GET /users/search)
src/services/api.ts                                            :3484-3573 :3653

# §G — bramki
src/utils/betaAccess.ts                                        :32 :53
src/utils/pilotAccess.ts                                       :66
server/src/middleware/betaGate.middleware.ts                   :15-17 :25-37
tests/unit/backend/middleware/meetingBetaGate.test.ts          :19-45

# §B — brief
server/src/routes/ai-operator.routes.ts                        :89-111
src/components/Meeting/MeetingHub.tsx                          :100-105 :221-262 :501-514 :994-1010

# dane i runtime
scripts/dev/seed-wave3-meetings-owner-review.mjs
scripts/dev/start-wave3-owner-runtime.mjs
scripts/dev/*-screenshots.mjs                                  (wzorzec zrzutów)
```

### 10.2. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# bezpieczniki — na KAŻDYM dotkniętym pliku .tsx
bash scripts/check-list-canon.sh src/components/Meeting/TwójPlik.tsx
bash scripts/check-list-canon.sh                     # pełny skan (bez --update!)

# zakazane klasy (crimson) — przed commitem UI
grep -rnE "bg-c-accent|primary-[0-9]|btn-primary|#85182F|#A51C30|#D42B3D" <Twoje pliki>

# polskie literały w nowym JSX — musi być pusto
grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" <Twoje nowe pliki .tsx>

# test celowany (NIGDY pełny vitest/tsc)
npx vitest run src/components/Meeting/__tests__
npx vitest run server/src/services/__tests__/meetingService.test.ts
npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts

# typy punktowo
npx esbuild src/components/Meeting/MeetingHub.tsx --loader:.tsx=tsx --outfile=/dev/null

# walidacja JSON tłumaczeń + parytet meeting.*
node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie
docker run -d --name cx-day10-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day10 -p 4302:5432 pgvector/pgvector:pg16
export DATABASE_URL="postgres://postgres:cx@localhost:4302/cx_day10"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day10-pg && docker volume ls -q | grep -i cx-day10 | xargs -r docker volume rm

# nowe pliki w tests/ wymagają -f (pliki __tests__ obok kodu — normalnie)
git add -f tests/unit/meeting/<nowy>.test.ts

# koordynacja (Blok 0 krok 4)
git merge-base --is-ancestor b61255f514 HEAD && echo "DZIEN6 SCALONY" || echo "DZIEN6 NIESCALONY"
git log --oneline codex/m03-admin-20260824..codex/meetings-quickfixes-20260825 | head -20

# POMIAR ZASIĘGU (§0.4a) — przed oddaniem raportu
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.3. Dziesięć rzeczy, które najłatwiej zepsuć

1. **★ „Odblokowanie" trzech tras `410`.** Osiem asercji w 48-przepływowym
   pakiecie mówi, że to jest kontrakt, a nie defekt. §D.3 buduje **nowy
   zasób** właśnie po to, żeby ich nie dotykać.
2. **★ Zbudowanie drugiej atrapy.** Kontrolka „Zaproś", która nic nie
   wysyła, jest **gorsza** niż jej brak — bo obiecuje. Poprawna etykieta
   to stan („Zaproszony"), a brak wysyłki idzie do STOP-a.
3. **★ Materializacja, która nadal wskazuje samą siebie.** Jeżeli po §H.1
   `targetRecordId` dalej jest `note.id`, bloker B3 **nie jest naprawiony**,
   choćby wszystko inne działało.
4. **Materiał, który jest na liście, ale nie daje się otworzyć.**
   Brak `documentStudioSchema` w `wave5_artifacts` = `404` przy otwarciu
   (pułapka P2 z §H).
5. **Tytuł ze słowem „test" w danych dowodowych.** Wiersz zniknie z listy
   Materials przez heurystykę szkiców i uznasz działający zapis za zepsuty.
6. **Dopisanie kolumn do `ensureMeetingTables()`.** To jest leniwy
   bootstrap pod SQLite, nie ścieżka wdrożenia. Kolumny idą migracją
   `20260826_*`.
7. **Migracja z datą `20260825`.** Kolizja nazwy z dniem 6
   (`20260825_meeting_agenda_templates.sql`) i konflikt scalenia.
8. **Zmiana `handoffSpineService`.** Dzielisz go z Chat, Ideas
   i Organization. Wołasz — nie zmieniasz.
9. **Cofnięcie dwóch uczciwych zachowań (Z15):** rozróżnienia
   błąd/pustka przy briefie (`M12-F04`) i odmowy fałszywego sukcesu przy
   nieznanym follow-upie (`M12-F01`). Oba wyglądają jak „nadmiarowy kod"
   i oba są wywalczone.
10. **★ Zmiana globalnego mocka albo configu vitest, żeby własny test
    przeszedł (Z18).** Tak zniknęło 27 testów w cudzych modułach
    w dyżurze nr 2 — cicho, bo nikt ich nie uruchamiał.

### 10.4. Tokeny kolorów (jedyne dozwolone)

```
--c-text            --c-surface           --c-success
--c-text-secondary  --c-surface-raised    --c-danger
--c-text-muted      --c-border            --c-info
                    --c-border-subtle     --c-focus
```

`--c-accent` = crimson = **wyłącznie marka**, nigdy element UI.
Fokus zawsze: `focus-visible:ring-2 ring-[color:var(--c-focus)]`.

W tym module `--c-danger` **wolno** użyć wyłącznie dla stanu faktycznie
krytycznego (nieudany zapis, artefakt niedostępny z powodu odebranego
dostępu). **Nie wolno** dla: nagłówka sekcji, aktywnej zakładki, CTA, chipa
statusu spotkania, statusu zaproszenia „odrzucone" (to jest stan neutralny,
nie błąd), przeterminowanego follow-upu (pomarańczowy, nie czerwień) ani
stanu „brak danych".

---

## 11. NA KONIEC

Ten dyżur robi cztery rzeczy, których nikt jeszcze nie wykonał, a które
właściciel zamówił 22 sierpnia i zatwierdził 25 sierpnia decyzją
`DEC-2026-08-25-58`.

**Pierwsza — moduł przestaje kłamać.** Dziś Meetings ma cztery atrapy:
kolumnę liczącą dane, których nikt nie umie zapisać; sekcję „Decyzje
i działania" bez jednej kontrolki; przycisk „Brief operatora" prowadzący
na ekran bez briefu; i „materializację" protokołu, która wskazuje sam
protokół. Po tym dyżurze każda z tych czterech rzeczy albo działa, albo
jest uczciwie oznaczona jako `BRAK_API` w raporcie. **Nie ma trzeciej
możliwości.**

**Druga — protokół wychodzi ze spotkania.** `MET-F-006` („Protokół
i publikacja w Materials") jest w kontrakcie oznaczone jako `gap`, a serwis
graniczny sam w komentarzu deleguje domknięcie „konsumentowi, który czyta
`producer_kind = 'meeting'`". Takiego konsumenta nie ma w całym repo od
czasu, gdy ten komentarz powstał. §H go buduje — i to jest najtańsza
wartość w całym dyżurze, bo `registerArtifactOrigin`, kręgosłup handoffu
i pokwitowania **już działają**. To jest podłączenie, nie budowa.

**Trzecia — spotkanie przestaje być zadaniem z listą imion w polu
tekstowym.** Właściciel powiedział to wprost: spotkanie wymaga zakresu
czasu, **strefy czasowej**, cykliczności, lokalizacji i zaproszonych; musi
zapraszać ludzi z organizacji **i gości z zewnątrz**, pokazywać organizatora
i status zaproszenia, i pozwalać dołączyć idee i notatki bez wycieku
materiałów prywatnych. Dziś uczestnik to `string`. §U zamienia go w byt
z tożsamością.

**Czwarta — moduł staje się otwieralny.** Nie otwarty — **otwieralny**.
Dziś nadzorca musiałby zmienić trzy pliki o trzech różnych konwencjach
i każde pominięcie zostawiłoby moduł w stanie połowicznym. Po §G otwarcie
jest jedną świadomą zmianą z przetestowaną macierzą ról w obu stanach.
**Samo otwarcie wykonuje nadzorca, po odbiorze. Ty go nie wykonujesz.**

Trzy rzeczy, których ten dyżur **nie robi**, i to jest celowe: nie buduje
szablonów agendy (dzień 6, `DEC-48`), nie naprawia szybkich defektów i18n,
gatingu przycisków, statusu, kasowania i komentarzy (równoległa gałąź
nadzorcy), nie buduje silnika AI ani wysyłki zaproszeń (moduł agenta
i `SET-INT-REC-001`).

Jedna rzecz, którą ten dyżur ma zrobić **lepiej niż poprzednie**: nie
zostawić ani jednej kontrolki, która wygląda na działającą, a nie jest.
`BRAK_API` z pełną tabelą jest odpowiedzią. Przycisk, który „na razie nic
nie robi", nie jest.

I siedem rzeczy, które sprawdzimy **przed** wszystkim innym przy odbiorze:
czy `git diff --name-only` nie zawiera ani jednego pliku globalnej
infrastruktury testowej (Z18); czy wszystkie migracje są addytywne, mają
datę `20260826` i dowód idempotencji; czy `MODULE_MEETING` nadal jest
`'closed'`; czy 48-przepływowy pakiet golden-flows przeszedł **bez jednej
zmiany**; czy `check-list-canon.baseline.txt` jest nietknięty; czy kontener
PostgreSQL został usunięty razem z wolumenami; i **czy każda widoczna
kontrolka faktycznie zapisuje dane, które da się odczytać na zimno**.
Dyżur, który zapali cudze testy, zalegalizuje cudzy dług, otworzy moduł
albo zostawi choćby jedną atrapę, zostaje odrzucony w całości — niezależnie
od tego, jak dobre są pozostałe pozycje.

Powodzenia. Koordynacja sprawdzona w Bloku 0, raport na bieżąco, inwentarz
przed każdą pozycją, STOP bez wahania zamiast zgadywania, prettier przed
każdym commitem, Blok 6 zawsze.
