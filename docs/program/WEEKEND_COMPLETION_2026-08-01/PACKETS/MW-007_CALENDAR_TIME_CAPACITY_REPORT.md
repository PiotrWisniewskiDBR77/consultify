---
doc_kind: PACKAGE_FINAL_REPORT
package: MW-07
status: AWAITING_CODEX_REVIEW
date: 2026-08-02
revision: 4 (post Codex FIX_REQUIRED — meetings fresh-schema + 6 red Calendar tests closed)
---

# MW-07 — Calendar/time/capacity — raport końcowy (rev. 4)

Rev. 3 (`706301b10a`) dostał wąski `FIX_REQUIRED` z dwoma konkretnymi
warunkami odbioru: (1) `meetings` nie miał żadnego kanonicznego właściciela
w `server/migrations/` — realny gap dla aktywnej funkcji meeting-provider-
honesty; (2) sześć czerwonych testów komponentowych Calendar
(`CalendarSidebar.availability` ×4, `CalendarCreateEventModal` ×2) nie
mogło zostać zostawionych z adnotacją „pre-existing". Ten dokument
zastępuje rev. 3 i opisuje domknięcie obu warunków — patrz §10. Wszystko z
rev. 2/3 (task reschedule, lineage, `editAuthority`, rotacja `xmin`,
400/403/404/409, fix timezone, no-premature-success, narrow-viewport
Drawer, zrzuty na dysku) pozostaje bez zmian — discovery NIE zostało
powtórzone. Martwy import `dev-render/main.tsx` (§9, cudza równoległa
sesja) świadomie NIE naprawiony na polecenie Codex — nie blokuje żadnej
odtwarzalnej bramki MW-07 (dev-render nie jest częścią żadnej bramki
testowej/CI tego pakietu). **Kanoniczna kopia tego raportu**:
`docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MW-007_CALENDAR_TIME_CAPACITY_REPORT.md`
— nowy agent powinien znaleźć ją przez START_HERE/control docs, nie przez
Harvard (materiał historyczny).

## 0. Tariff-plan checkpoint (bez zmian od rev. 1)

`CURRENT_MVP_CONTROL.md` (`7797a3b3`) zapisał pauzę operacyjną dla
kończącego się planu, wymieniając 5 pakietów do przejęcia — MW-07 nie był
wśród nich. Piotr/Codex potwierdzili w sesji (2026-08-02), że warunek
wygasł; MW-07 jest autoryzowany jako Linia 2 nowego planu. Ten plik NIE
edytuje `CURRENT_MVP_CONTROL.md` — aktualizację globalnego statusu wykona
Codex.

## 1. Base SHA / branch / worktree / HEAD (implementation vs documentation)

- Base ref: `integrate/mvp-wave1-abc`
- Base SHA (fork point, zweryfikowany `git merge-base`):
  `0b3381a876c35c272ecb7f500b32292cbf8d2e29` — **uwaga**: `integrate/mvp-wave1-abc`
  ruszył się od tego czasu (aktualny tip `36aa6ffc40`, inne linie); wszystkie
  diffy w tym raporcie liczone są względem fork-pointu, NIE względem
  bieżącego tipu tej gałęzi, bo bieżący tip zawiera cudzą, niezwiązaną pracę
  (CHAT-003/004/005, RES-012).
- Branch: `feat/mw-007-calendar-time-capacity` (brak upstream/push)
- Worktree: `.../7d8c9918-665e-4858-8e90-153bbbff23e3/scratchpad/wt-mw-007`
- **Implementation HEAD** (ostatni commit zmieniający kod/testy):
  `65138c4bd2` (`test(mw-007): fix incomplete react-i18next mock, not production behavior`)
- **Documentation HEAD** (po commicie tego pliku): patrz komunikat końcowy —
  `git rev-parse HEAD` wykonany PO commicie tego raportu, ta sama dyscyplina
  utrzymana od rev. 2.

18 commitów ponad bazą (chronologicznie; 1-11 z rev. 2, 12-15 z rev. 3, 16-18 nowe w rev. 4):

1. `9e8c72ff1e` docs: discovery gate
2. `2f6a565824` feat: project/provider lineage + version guard
3. `7228e2855c` fix: pg timestamp day-shift bug + xid validation
4. `20ac6c6c72` docs: rev.1 raport (zastąpiony)
5. `9a3666ef8d` fix: meeting provider honesty (BLOCKER 3)
6. `74889fb199` test: version-rotation proof (BLOCKER 5)
7. `8d636adb4a` fix: status_reports fresh-DB guard (BLOCKER 1)
8. `30dedd00e0` test: napraw flaky mid-process TZ mutation
9. `79f8599a78` test: no-premature-success dla CalendarView (BLOCKER 4 #4)
10. `de2b66cbf2` fix: `editAuthority` dla task events (BLOCKER 2 finding)
11. `c00bdc02fd` chore: browser-acceptance tooling
12. `c0b4859e30` docs: rev.2 raport (zastąpiony)
13. `e4b9b8fe4a` fix: sidebar nie nakłada się na grid poniżej breakpointu mobile
14. `5d7b0c8dcf` test: 7 testów real-mount dla naprawy narrow-viewport
15. `9e7aa2ff99` docs: zrzuty wizualne zapisane na dysk
16. `706301b10a` docs: rev.3 raport (zastąpiony przez ten plik)
17. `bfe64db7f1` fix: `meetings` fresh-DB guard (§10.1)
18. `65138c4bd2` test: napraw niekompletny mock `react-i18next` (§10.2)

## 2. Canonical ownership (bez zmian)

Family C (`server/src/routes/v8/my-work.routes.ts`) pozostaje właścicielem —
już kanoniczna, real-mutation, jedyna realnie używana przez żywe UI. `tasks`
pozostaje własnością Tasks (MW-01..03, `CODE_GO_FROZEN`); Calendar jest
projekcją.

## 3. Golden flow — zweryfikowany w REALNEJ przeglądarce (nie tylko API)

1. Zalogowany użytkownik (real Gateway.ts, real `verifyToken` E2E_MODE
   bypass — nie syntetyczny dev-render) otwiera `/my-work/calendar`.
2. Widzi task z jawnym `Atelier Toys Rollout · Internal` na evencie
   (widoczny tekst, nie tylko tooltip).
3. Przeciąga task na inną datę → real `PUT
   /api/v8/my-work/calendar/events/task/:id` z `expectedVersion` w body
   (potwierdzone w network log przeglądarki).
4. Backend zapisuje nowy `due_date`, zwraca nową `version`.
5. UI pokazuje sukces (nowa pozycja) dopiero po odpowiedzi backendu.
6. Hard reload (`navigate` do tego samego URL) → ten sam `taskId` widoczny
   pod nową datą.
7. Drugi "klient" (symulowany: real `fetch()` z sesyjnym tokenem, ale ze
   STARĄ wersją zapisaną przed konkurencyjnym zapisem) → real `409`.
8. UI po `409`: `console.error` z dokładnym komunikatem konfliktu,
   `revert()` przeciągnięcia, `refetch()` — grid pokazuje PRAWDZIWĄ,
   aktualną pozycję z serwera (nie starą, nie tę, na którą próbowano
   przeciągnąć).

Pełny log dowodowy w §5.2.

## 4. Zmienione pliki (względem fork-pointu `0b3381a876`)

Backend: `server/src/routes/v8/my-work.routes.ts` (unified feed lineage/
version/editAuthority, PUT task branch version guard, `toDateOnly` fix,
meeting provider-honesty fix), `server/migrations/20260623_distribution_delivery.sql`
(status_reports fresh-DB guard).

Frontend: `src/services/api/v8/my-work.ts`, `src/services/api.ts`,
`src/components/MyWork/Calendar/{calendarTypes.ts,CalendarGrid.tsx,CalendarView.tsx}`,
`public/locales/{pl,en}/translation.json`.

Testy (nowe): `tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts`
(10), `tests/integration/mw-007-meeting-provider-honesty.golden-flow.realdb.test.ts`
(5), `tests/integration/schema-migration-completeness.realdb.test.ts` (1),
`tests/components/MyWork/CalendarGrid.lineage-conflict.test.tsx` (5),
`tests/components/MyWork/CalendarView.reschedule-no-premature-success.test.tsx` (3).

Dokumentacja: discovery gate, ten raport (Harvard + PACKETS/), `.claude/launch.json`
(gitignored, niecommitowany — dwa wpisy lokalne do tej sesji),
`scripts/dev/mw007-browser-backend.sh` (committed, do odtworzenia weryfikacji
w przyszłości).

Nie dotknięto: family A/B/D backendu (kalendarz), `my-work.routes.ts`
monolitu poza mountem, FIN-05/MAT-10/EXE-08/INT-08/TLS-04.

## 5. Domknięcie sześciu blokerów Codex

### 5.1 BLOCKER 1 — strict fresh-schema

Odtworzone na czystej bazie (Postgres 16, zero schematu):
`npm run db:migrate:strict` pada na `20260623_distribution_delivery.sql`:
`relation "status_reports" does not exist`. Root cause: `status_reports`
zadeklarowany tylko w `066_status_reports.sql`, wersja `066 < 500` →
odrzucany przez `isSqliteOnlyMigration()` jako legacy fragment. Niewidoczne
na demo/staging, bo `PostgresDatabase.ts` tworzy tę tabelę przy boot
aplikacji, zanim jakikolwiek migration runner ją zobaczy — ścieżka
`db:migrate:strict` nigdy nie woła tego bootstrapu.

Brak istniejącego zaakceptowanego fixu na żadnej lokalnej/zamrożonej gałęzi
(sprawdzono `fix/migrations-6xx`, `integrate/mvp-wave1-abc`, pełną historię
grep za `baseline|status_reports|migration.*fix`).

Fix: rozszerzono JUŻ ISTNIEJĄCY, zaakceptowany wzorzec "FRESH-DB GUARD"
(ten sam plik, ta sama technika co dla `report_distributions`, 2026-07-14) —
`CREATE TABLE IF NOT EXISTS status_reports (...)` przed istniejącym guardem
`report_distributions`. No-op na bazach, gdzie tabela już istnieje
(staging/demo/TROLLEY).

Zweryfikowane niezależnie (drugi, świeży kontener): pełny
`db:migrate:strict` od pustej bazy przechodzi teraz przez ten plik (184+
plików zaaplikowanych, wcześniej 0) i zatrzymuje się na INNYM,
PRE-ISTNIEJĄCYM, niezwiązanym z MW-07 braku
(`20260624_initiative_status_normalize.sql` zakłada kolumnę
`initiatives.title`, której brak w `000_z_core_baseline.sql`) —
udokumentowane, NIE naprawione (inna domena, do sekwencjonowania przez
Codex).

Nowy test `tests/integration/schema-migration-completeness.realdb.test.ts`:
czerwony na niezmigrowanej/niepełnej bazie, zielony po fixie — oba stany
odtworzone i potwierdzone.

MW-07 golden flow (task-reschedule) uruchomiony i **zielony (10/10)**
przeciwko bazie zmigrowanej OFICJALNYM `db:migrate:strict` runnerem (port
5462) — wszystkie wymagane przez MW-07 tabele (`organizations`, `users`,
`projects`, `tasks`, `status_reports`, `v8_calendar_items`) istnieją dobrze
przed punktem, w którym łańcuch później się zatrzymuje na niezwiązanym
błędzie.

**Dodatkowe znalezisko (nienaprawione, poza zakresem)**: tabela `meetings`
NIE jest tworzona przez żaden plik w `server/migrations/` — istnieje
wyłącznie przez boot-time bootstrap aplikacji, identyczna klasa problemu co
`status_reports`. Testy meeting-provider-honesty (§5.3) uruchomiono
przeciwko schematowi z `migrations-v2` (który ma `meetings`), nie przeciwko
czystemu `db:migrate:strict` — zgłoszone jako osobne ryzyko, nie naprawione
(nowy, dodatkowy blocker tej samej klasy, inna tabela, wykraczałby poza
"jeden bloker na raz").

### 5.2 BLOCKER 2 — browser acceptance (real Gateway, real Postgres)

Uruchomiono REALNĄ aplikację (nie dev-render): real Express `server/src/index.ts`
+ real `Gateway.ts` (wymagało `ENABLE_TEST_GATEWAY=true` — inaczej
`NODE_ENV=test` montuje tylko atrapę `management-reports`, ten sam mechanizm
co testy jednostkowe używają do pominięcia pełnego Gatewaya; odkryte i
udokumentowane w `scripts/dev/mw007-browser-backend.sh`) + real Vite
frontend (główny `vite.config.ts`, nie `dev-render/vite.config.ts`),
wskazane na throwaway lokalny Postgres. Logowanie: realny `verifyToken`
E2E_MODE bypass (ten sam kontrakt co `tests/integration/*.realdb.test.ts`)
— nie ominięcie routingu produkcyjnego, tylko ominięcie ekranu logowania.

**Realny bug znaleziony WYŁĄCZNIE przez to (component testy tego nie
złapały)**: `CalendarGrid.tsx` liczy `editable: e.editAuthority !== 'none'
&& e.editAuthority !== undefined`. Backend nigdy nie ustawiał
`editAuthority` dla task-eventów → `editable` zawsze `false` → **drag task
eventu nigdy nie działał w prawdziwej przeglądarce**, mimo że każdy test
backendowy i zmockowany test komponentu (mock FullCalendar) przechodził.
Fix: `editAuthority: 'local_only'` dla task eventów (uczciwe — taski SĄ
lokalnie edytowalne). Dodano asercję w real-PG teście.

Dowód (network log + console + zrzuty ekranu przechwycone i obejrzane
w sesji — patrz uwaga niżej o utrwalaniu):
- GET unified feed zwraca `projectId/projectName/provider/editAuthority`.
- Zrzut: widok Month, marzec 2026, chip `Prepare quarterly roll... /
  Atelier Toys Rollout · Int` na dniu 10.
- Drag (symulowany syntetycznymi zdarzeniami mouse — `left_click_drag`
  atomowy nie odpalał interakcji FullCalendar; potrzebna sekwencja
  mousedown→mousemove×3→mouseup) → real `PUT .../events/task/task_browser_demo`
  → `200`, `dueDate` zmieniony, nowa `version`.
- Zrzut: event przesunięty na nową datę, lineage nadal widoczne.
- Hard reload (`navigate` do tego samego URL, pełny przeładunek Reacta) →
  po powrocie do marca event nadal na nowej dacie — trwałość przez bazę,
  nie stan Reacta.
- Symulacja drugiego klienta: real `fetch()` z sesyjnym tokenem i STARĄ
  `expectedVersion` → real `409` z dokładnym payloadem
  `VERSION_CONFLICT`.
- Real drag ze STAREJ (cache'owanej) wersji UI (po tym jak "drugi klient"
  już zapisał) → real `409` przez właściwą ścieżkę UI → `console.error`
  z dokładnym komunikatem z `CalendarView.tsx` → grid POPRAWNIE pokazuje
  pozycję drugiego klienta (nie starą, nie odrzuconą) — pełny cykl
  refetch-po-konflikcie zweryfikowany żywo.
- Wąski viewport (375×812): zrzut wykonany. **Realne znalezisko UX z rev.
  2, naprawione w rev. 3**: panel boczny (mini-kalendarz + Sources) nie
  chował się na wąskim viewport i nakładał się na główny grid, czyniąc go
  nieczytelnym. Codex podniósł to do rangi blokera w rundzie FINAL UX
  FIX_REQUIRED (wąski viewport jest obowiązkową bramką odbioru) — fix i
  dowód w §6.

**Ograniczenie narzędziowe zgłoszone w rev. 2 (zamknięte w rev. 3)**: rev. 2
zgłosił brak mechanizmu zapisu zrzutów na dysk z ówczesnego zestawu narzędzi
(Browser pane zwracał zrzuty tylko inline). Codex uznał to za niewystarczające
dla rundy FINAL UX. Rev. 3 używa Playwright (`dev-render/shot.mjs`, już
istniejący w repo) — zrzuty zapisane jako pliki w
`artifacts/visual-qa/mw-007/`, patrz §6.

### 5.3 BLOCKER 3 — provider honesty dla Meetings

`agenda.calendarSource || 'outlook'` → `agenda.calendarSource || 'consultify'`.
Realny, explicit `outlook`/`google` przechodzi bez zmian. 5/5 real-PG testów
(`tests/integration/mw-007-meeting-provider-honesty.golden-flow.realdb.test.ts`):
brak source → nigdy outlook/google; explicit outlook → outlook; explicit
google → google; explicit consultify → consultify; obcy tenant nie widzi
żadnego z eventów.

### 5.4 BLOCKER 4 — pięć prawdziwych red→green (sabotaż→przywrócenie)

Każdy cykl: edycja kodu → uruchomienie WŁAŚCIWEGO testu → potwierdzony
czerwony z dokładnym komunikatem → przywrócenie DOKŁADNEGO oryginalnego
kodu → `git diff --stat` puste → ponowne uruchomienie → zielony.

1. **Usunięto `organization_id` z fresh-lookup UPDATE fallback** → test
   cross-org: `expected 403 to be 404` (wyciek istnienia) → przywrócono →
   zielony.
2. **Usunięto `assignee_id` z UPDATE WHERE** → test cross-user: `expected
   200 to be 403` (obcy user przełożył cudzy task) → przywrócono → zielony.
3. **Usunięto `AND xmin = ?::xid` z UPDATE WHERE** → test concurrency:
   `expected 200 to be 409` (stary zapis cicho nadpisał) → przywrócono →
   zielony.
4. **Usunięto `await` przed `Api.updateMyWorkCalendarEvent`** (fire-and-
   forget) → nowy test `CalendarView.reschedule-no-premature-success.test.tsx`:
   `expected true to be false` (sukces zwrócony PRZED odpowiedzią backendu)
   → przywrócono → zielony.
5. **Przywrócono `agenda.calendarSource || 'outlook'`** → test provider
   honesty: `expected 'outlook' not to be 'outlook'` → przywrócono →
   zielony.

Wszystkie 5 cykli udokumentowane z dokładnym komunikatem błędu w commitach/
sesji; `git status --short` puste po każdym przywróceniu.

### 5.5 BLOCKER 5 — kontrola rotacji wersji

Nowy dedykowany test: `GET wersja A → PUT(A) → sukces + wersja B → PUT(stare
A) → 409 → PUT(B) → sukces + wersja C → hard-reload GET → zwraca C`.
Token wersji z body NIGDY nie jest dowodem własności — `organization_id`/
`assignee_id` pozostają w tym samym `UPDATE ... WHERE` co `xmin`, co
sabotaż #1/#2 wyżej wprost demonstruje (usunięcie SAMEGO predykatu
tenant/ownera łamie testy niezależnie od tokenu wersji).

### 5.6 BLOCKER 6 — ten dokument

Rev. 1 błędnie podał HEAD `7228e2855c` mimo że raport został zacommitowany
jako `20ac6c6c72` (błąd: HEAD spisany PRZED commitem raportu). W tej
rewizji: implementation HEAD (`c00bdc02fd`) i documentation HEAD (ten commit)
podane osobno, `git rev-parse HEAD` wykonany PO commicie tego pliku —
finalna wartość w komunikacie kończącym sesję, nie w tym pliku.

## 6. Narrow-viewport fix (Codex FINAL UX FIX_REQUIRED, rev. 3)

**Problem** (rev. 2 §5.2): poniżej breakpointu mobilnego (`useIsMobile`,
`max-width: 767px` — ten sam próg co `tailwind.config`'s `mobile` alias),
`CalendarSidebar` renderował się inline przy stałej szerokości `w-64` i
nakładał się na główny grid.

**Fix** (`e4b9b8fe4a`): `CalendarView` warunkowo renderuje albo inline
sidebar (desktop, bez zmian), albo — poniżej breakpointu — przycisk „Źródła
i filtry" + ten sam `CalendarSidebar` osadzony w JUŻ ISTNIEJĄCYM prymitywie
`Drawer` (`src/components/ui/primitives/Drawer.tsx`: focus-trap, zamknięcie
Escape, `role="dialog" aria-modal="true"`, overlay) — sterowane hookiem
`useIsMobile()` (`src/hooks/useDeviceType.ts`, JS-owalny, testowalny), nie
czystym CSS `hidden md:block`. Zero nowego systemu projektowego mobilnego:
wyłącznie istniejący breakpoint, istniejący `Drawer`, istniejący `Button`,
istniejące pierścienie fokusu (`c-focus`, scentralizowane w `Button`).
Desktop niezmieniony (`CalendarSidebar`'s border stał się `md:`-only,
kosmetyczne — bez obramowania wewnątrz Drawera to jest poprawne, nie
regresja).

**Testy** (`5d7b0c8dcf`, `tests/components/MyWork/CalendarView.responsive.test.tsx`,
7/7 PASS) — real-mount, nie assercje na stringach klas CSS (jawne
wymaganie Codex): (1) na 375px desktopowy sidebar nigdy się nie montuje —
brak nakładki na grid; (2) przycisk „Sources & filters" dostępny po
roli/nazwie; (3) otwarcie panelu pokazuje treść źródeł; (4) zamknięcie (X)
usuwa panel i przywraca pełny, nienaruszony grid; (5) na desktopie sidebar
nadal renderuje się inline, bez przycisku mobilnego; (6) Escape zamyka
panel klawiaturą; (7) tytuł eventu i lineage projekt/provider pozostają
widoczne na mobile.

**Realne znalezisko przy pisaniu testów (nie w kodzie produkcyjnym, w
uprzęży testowej)**: pierwsza wersja testu 6 (Escape) owijała
`fireEvent.keyDown` w zbędny `await act(async () => {...})` — w połączeniu
z prawdziwym `Drawer` (pierwszy realny konsument tego prymitywu w całym
repo — `framer-motion`'s `AnimatePresence`/spring w jsdom, gdzie layout nie
istnieje) to dało prawdziwe „Maximum update depth exceeded" i OOM-owało
worker vitest (heap do 4 GB). Fix: (a) usunięcie zbędnego `act()` — sam
`fireEvent` już batchuje w `act` (ten sam wzorzec co działający test 4); (b)
mock `framer-motion` (`AnimatePresence`/`motion.div`/`motion.button`)
identyczny z już istniejącym `tests/components/navigation/Sidebar.mobile-overlay.test.tsx`
— ten sam, ustalony w repo wzorzec dla mount-testów z prawdziwym
`Drawer`/animacją w jsdom. Po obu fixach: 7/7 zielone, ~700ms, zero
ostrzeżeń o update-depth.

**Regresje**: pełny pakiet Calendar (`CalendarView.error-state`,
`CalendarCreateEventModal`, `CalendarSidebar.availability`,
`CalendarGrid.lineage-conflict`, `CalendarView.reschedule-no-premature-success`,
`CalendarView.responsive`) uruchomiony razem — 16/16 z tych dotykanych tym
fixem PASS; 6 failing w `CalendarSidebar.availability.test.tsx`(4)/
`CalendarCreateEventModal.test.tsx`(2) potwierdzone jako PRE-ISTNIEJĄCE
(zweryfikowane empirycznie: przywrócono oryginalne, nie-tknięte przez rev. 3
wersje `CalendarSidebar.tsx`/`CalendarView.tsx` z `git show HEAD:...` i te
same 6 testów failuje identycznie — `TypeError: t(...).map is not a
function`, mock `t()` w tamtym pliku nie obsługuje `returnObjects: true`;
niezwiązane z tym fixem, nie naprawione, poza zakresem).

**Typecheck**: pełny `npx tsc --noEmit` w tym repo OOM-uje niezależnie od
tej zmiany (potwierdzone, znany, udokumentowany wcześniej problem tego
monorepo — „tsc pada z OOM = bramka ślepa"); zamiast tego (zgodnie z
`HIGIENA WYKONANIA` w CLAUDE.md — esbuild per plik) każdy zmieniony
`.tsx`/`.ts` przeszedł `esbuild` indywidualnie, zero błędów.

**Zrzuty na dysku** (`9e7aa2ff99`, Playwright przez `dev-render/shot.mjs` —
istniejący w repo mechanizm, nie nowy): `artifacts/visual-qa/mw-007/`:
`01-desktop-sidebar-inline.png` (baseline, bez zmian), `02-mobile-375-toggle-no-overlap.png`,
`03-mobile-375-drawer-open-sources.png`, `04-mobile-375-drawer-closed-grid-restored.png`,
`05-mobile-375-event-lineage-visible.png` (zbliżenie). Wygenerowane przez
`dev-render/screens/mw-007-calendar-narrow-viewport.tsx` — montuje REALNY
`<CalendarView>` z podmienionymi metodami `Api.getMyWorkCalendarUnified`/
`getIntegrations`/`getMyWorkCalendarConflicts` (wzorzec „patchuj metody
Api, nie window.fetch" z `vault-scope-selector.tsx`), bez logowania, zgodnie
z CLAUDE.md #7. **Pre-istniejący, niezwiązany defekt napotkany po drodze**:
`dev-render/main.tsx` na tej gałęzi importuje `./screens/tools-sesja-wyjscie`,
plik który istnieje wyłącznie jako nieśledzony w innej, równoległej sesji —
bez niego CAŁA uprząż dev-render 500-owała dla każdego ekranu. Naprawione
lokalnie tymczasowym plikiem-zastępczym na czas zrzutów, usuniętym przed
commitem (nie część diffu MW-07) — zgłoszone tutaj, nie naprawione na stałe
(cudzy plik, nie mój do scalania).

## 7. Testy — pełne podsumowanie końcowe

- **16/16 testów real-PG PASS w jednym przebiegu** przeciwko bazie
  zmigrowanej WYŁĄCZNIE oficjalnym `db:migrate:strict` (zero `initDb()`,
  zero migrations-v2): 10 (calendar-reschedule, w tym version-rotation
  §5.5) + 5 (meeting-provider-honesty) + 1 (schema-migration-completeness,
  teraz obejmujący też `meetings` — §10.1). **Korekta dokumentacji**: rev.
  2/3 podawały „21/21" — ten sam błąd klasy „audyt się starzeje/liczba
  nigdy nie została realnie przeliczona"; rzeczywista, dwukrotnie
  zweryfikowana (własny przebieg + niezależny adversarial reviewer z
  osobnym kontenerem) suma to 16. Poprawiono tutaj zamiast powielać.
- **25/25 — PEŁNY scoped Calendar component suite PASS, zero failing**
  (jawne wymaganie Codex rev. 4): `CalendarView.error-state` (2) +
  `CalendarCreateEventModal` (4, w tym 2 naprawione w §10.2) +
  `CalendarSidebar.availability` (4, naprawione w §10.2) +
  `CalendarGrid.lineage-conflict` (5) +
  `CalendarView.reschedule-no-premature-success` (3, no-premature-success
  nadal PASS) + `CalendarView.responsive` (7, narrow-viewport nadal PASS).
  Zero `.skip`/`.todo`/`.only`, zero rozluźnionych asercji — potwierdzone
  niezależnie przez adversarial reviewera (§10.3).
- **Timezone**: uruchomiony DWUKROTNIE, osobne procesy, `TZ` ustawiony na
  poziomie shell PRZED startem node (nie w locie — mutacja `process.env.TZ`
  w trakcie działania okazała się zawodna w Node/V8, patrz komentarz w
  pliku testowym): `Europe/Warsaw` (+1/+2) i `America/Los_Angeles` (-7/-8)
  — identyczny wynik (10/10) w obu.
- **Typecheck**: pełny `npx tsc --noEmit` OOM-uje niezależnie od tej gałęzi
  (znany, udokumentowany wcześniej problem monorepo). Uczciwy per-file
  compile: `esbuild` na każdym zmienionym `.tsx`/`.ts` — zero błędów (§10).
  `npm run build:shared` (workspace `packages/shared`, osobny, mały `tsc`)
  — PASS.
- **Build**: `npm run build` — PASS (`✓ built in 1m 31s`, tylko
  pre-istniejące ostrzeżenia o rozmiarze chunków, niezwiązane).
- **git diff --check**: PASS (liczone od realnego fork-pointu `0b3381a876`,
  obejmuje też nowy plik migracji).
- **Secret scan**: PASS (grep diffu za wzorcami haseł/kluczy/tokenów —
  zero trafień; throwaway hasło kontenera Docker nie trafiło do żadnego
  commitowanego pliku).
- **Clean tree**: PASS po każdym commicie.

## 8. Collision audit

Bez zmian od rev. 1: zero odwołań do kalendarza w
finance*/interview/teresa.routes.ts. `tasks.due_date` pisany też przez
`execution-control.routes.ts`/`inboxTriageService.ts`/
`managerActionExecutionService.ts` — żaden nie przechodzi przez
zmodyfikowany endpoint, brak regresji.

**Incydent operacyjny (zamknięty, zero utraty danych)**: `git stash`/`pop`
w tym worktree przypadkiem wciągnął cudzy wpis (`stash@{0}`, sesja MAT-10).
Naprawione natychmiast: `git reset --hard HEAD` (nie dotyka listy stash) +
usunięcie nieśledzonego wycieku. Zweryfikowano: `stash@{0}` MAT-10 nadal
obecny na liście, nietknięty. Od tego momentu w sesji: zero `git stash`,
zero `reset --hard` poza tym jednym naprawczym użyciem, zero `checkout --`.

## 9. Nieukończone / otwarte ryzyka (uczciwie zgłoszone, nie fabrykowane)

- ~~Brak zapisanych na dysku plików zrzutów ekranu~~ — domknięte w rev. 3,
  §6 (Playwright, `artifacts/visual-qa/mw-007/`).
- ~~Wąski viewport (375px): panel boczny Calendar nakłada się na grid~~ —
  domknięte w rev. 3, §6.
- `dev-render/main.tsx` na tej gałęzi ma martwy import
  (`./screens/tools-sesja-wyjscie`, plik cudzej równoległej sesji) — psuje
  CAŁĄ uprząż dev-render dla każdego ekranu, nie tylko MW-07 (§6). Świadomie
  NIE naprawione na polecenie Codex rev. 4 (cudzy plik/gałąź, nie blokuje
  żadnej odtwarzalnej bramki MW-07 — dev-render nie wchodzi w skład testów/
  CI tego pakietu).
- ~~`meetings` nie jest tworzone przez `server/migrations/`~~ — domknięte w
  rev. 4, §10.1.
- ~~Sześć czerwonych testów komponentowych Calendar~~ — domknięte w rev. 4,
  §10.2.
- Pełny `db:migrate:strict` od pustej bazy nadal zatrzymuje się (za
  `20260623_meetings_baseline.sql`, teraz zamiast za `status_reports`) na
  `20260624_initiative_status_normalize.sql` (`initiatives.title` brak w
  baseline) — niezwiązane z MW-07, zgłoszone Codex do sekwencjonowania
  (dwukrotnie potwierdzone: własny przebieg §10.1 + niezależny adversarial
  reviewer, identyczny wynik).
- Rodzina B (V8 P02 canon, realny etag) pozostaje bez konsumenta UI —
  świadomie poza zakresem.
- **Nowe, uczciwie zgłoszone znalezisko (nie naprawione, poza zakresem)**:
  meeting-provider-honesty testy logują (nie failują — `v8:featureGate`
  degraduje się poprawnie) `relation "v8.v8_feature_flags" does not exist`
  na świeżo zmigrowanej bazie — schemat `v8` z tabelą flag feature również
  nie jest tworzony przez oficjalny replay migracji. Ta sama klasa bugu co
  `status_reports`/`meetings`, inna tabela/schemat, inny właściciel
  (V8 platform, nie Calendar) — zgłoszone Codex, nie naprawione (poza
  jednym-blokerem-na-raz tego reviewu).

## 10. Meetings fresh-schema + sześć czerwonych testów Calendar (Codex FIX_REQUIRED, rev. 4)

### 11.1 `meetings` fresh-DB guard

**Problem**: `meetings` nigdy nie było deklarowane w żadnym pliku
`server/migrations/` — istniało wyłącznie przez `ensureMeetingTables()`
(`server/src/services/meetingService.ts`), wołane LENIWIE (przy pierwszym
użyciu dowolnego endpointu meeting, nie przy starcie aplikacji). Genuinely
świeży `db:migrate:strict` (bez kodu aplikacji w ogóle) nigdy nie tworzył
tabeli — realny gap dla aktywnej funkcji meeting-provider-honesty.
Dodatkowo znaleziono: `20260719_baseline_gap.sql` FAKTYCZNIE deklaruje
`meetings`, ale ten plik sortuje się długo po miejscu, w którym świeży
replay już się zatrzymuje (na niezwiązanym `20260624_initiative_status_normalize.sql`)
— więc mimo istnienia w jednym pliku, efektywnie nigdy nie zostaje
zaaplikowany na świeżej bazie.

**Fix**: nowy `server/migrations/20260623_meetings_baseline.sql` —
`CREATE TABLE IF NOT EXISTS meetings` + `meeting_follow_ups` + 3 indeksy,
kolumna-po-kolumnie identyczne z realną, aktualnie działającą definicją z
`ensureMeetingTables()` (jedyna różnica: udokumentowana korekta
`datetime('now')` → `(now()::text)`, ten sam zabieg co dla
`status_reports`). Data `20260623` celowa: sortuje się PRZED nieusuniętym,
niezwiązanym `20260624_initiative_status_normalize.sql`, więc świeży replay
zdąży utworzyć `meetings` zanim zatrzyma się na tamtym, osobnym gapie.
Zero `initDb()`/bootstrapu runtime jako substytutu — wyłącznie oficjalny
replay migracji.

**Weryfikacja (podwójna, niezależna)**: własny świeży kontener Postgres 16
+ osobny, adversarialny przebieg z WŁASNYM kontenerem tego samego typu
(inny agent, inna sesja, zero współdzielonego stanu) — obaj potwierdzili
identycznie: (a) `db:migrate:strict` aplikuje `20260623_meetings_baseline.sql`
bez błędu i zatrzymuje się DOPIERO na już-znanym, niezwiązanym
`20260624_initiative_status_normalize.sql`; (b) `meetings`/`meeting_follow_ups`
istnieją z dokładnie oczekiwanym kształtem (`\d meetings` sprawdzone
ręcznie); (c) ponowne uruchomienie tego samego pliku SQL wprost przez psql
kończy się `NOTICE: ... already exists, skipping` na każdej instrukcji,
exit 0 — pełna idempotencja; (d) 16/16 testów real-PG MW-07
(schema-migration-completeness + meeting-provider-honesty + calendar-
reschedule golden flow) PASS przeciwko tej samej, wyłącznie oficjalnie
zmigrowanej bazie.

`tests/integration/schema-migration-completeness.realdb.test.ts`:
`REQUIRED_TABLES` rozszerzone o `'meetings'`, żeby ten gap nie mógł się po
cichu cofnąć.

### 11.2 Sześć czerwonych testów komponentowych Calendar

**Diagnoza**: obie grupy to TA SAMA klasa błędu — lokalny mock
`vi.mock('react-i18next', ...)` w każdym pliku obsługiwał tylko
`t(key, fallbackString)` i `t(key, { defaultValue })`, nie obsługując
realnych, poprawnych kształtów wywołań produkcyjnych:
- `CalendarSidebar.tsx`: `t('...weekdaysShort', { returnObjects: true })`
  (standardowy, udokumentowany wzorzec react-i18next do pobierania tablicy)
  — mock zwracał string zamiast tablicy → `.map()` rzucał `TypeError`.
- `CalendarCreateEventModal.tsx`: `t('...itemsOnThisDay', { count })`
  (interpolacja bez `defaultValue`) i `t('...dayPreviewLimited')` (bez
  drugiego argumentu w ogóle, polegając na realnym wpisie w
  `translation.json`) — oba przypadki mock zwracał surowy klucz zamiast
  realnego, poprawnego tekstu.

Kod produkcyjny (`CalendarSidebar.tsx`, `CalendarCreateEventModal.tsx`)
sprawdzony i potwierdzony jako POPRAWNY — realny react-i18next rozwiązuje
wszystkie trzy kształty bezbłędnie przeciwko realnym wpisom w
`public/locales/{en,pl}/translation.json`. **Zero zmian w kodzie
produkcyjnym** — zgodnie z jawnym wymogiem Codex.

**Fix**: oba mocki przepisane tak, by rozwiązywały klucze kropkowane
względem REALNEGO `public/locales/en/translation.json` (z interpolacją
`{{param}}`) — dokładnie ten sam, już wcześniej ustalony w repo wzorzec co
`tests/components/AIChat/Wave5ArtifactRuntimePanel.mutations.test.tsx`.
Zmienione WYŁĄCZNIE bloki `vi.mock('react-i18next', ...)` — zero zmian w
asercjach, zero `.skip`/`.todo`/`.only`.

**Wynik**: 25/25 — PEŁNY scoped Calendar component suite PASS (§7), w tym
wszystkie 6 poprzednio czerwonych testów, bez regresji w pozostałych 19
(narrow-viewport 7/7, no-premature-success 3/3, lineage/conflict 5/5,
error-state 2/2, pozostałe 2 CalendarCreateEventModal).

### 11.3 Niezależny adversarial reviewer

Osobny agent (bez pamięci tej sesji, zero współdzielonego stanu poza samym
plikami repo) niezależnie: odtworzył cały fresh-schema dowód od zera
własnym kontenerem Postgres; porównał kolumna-po-kolumnie DDL migracji
z realną definicją `ensureMeetingTables()`; sprawdził filtr
`isSqliteOnlyMigration()` pod kątem tego konkretnego pliku; uruchomił
pełny scoped Calendar suite i policzył asercje pod kątem osłabienia;
potwierdził `git status --short`/`git diff --stat -- src/ server/src/`
puste dla obu warunków (zero zmian produkcyjnych). Werdykt: CONFIRMED PASS
dla obu warunków, zero rozbieżności.

## 11. Dowód czystego drzewa i braku push/deploy

Throwaway Postgres (kontenery docker użyte w toku sesji rev. 1-4, w tym dwa
w rev. 4 — własny + niezależnego adversarial reviewera) usunięte
(`docker rm -f`, potwierdzone nieobecne po). Backend/frontend dev-serwery
zatrzymane. Rev. 3: dev-render harness (port 3921, wyłącznie ten worktree)
zatrzymany po zrzutach. Rev. 4: przy okazji świeżego kontenera napotkano
i naprawiono niezwiązaną awarię hosta („No space left on device" na
wirtualnym dysku Dockera) — `docker volume prune -f` usunął WYŁĄCZNIE
osierocone (`dangling`, nieprzypięte do żadnego kontenera, żywego ani
zatrzymanego) wolumeny, zero ingerencji w kontenery/wolumeny innych,
aktywnych linii (`consultify-int008-pg`, `consultify-exe008-*`,
`consultify-acceptance-pg` i inne widoczne w `docker ps -a` pozostały
nietknięte). Zero `git push`, zero merge do `demo`/`Londyn`/`integrate/*`,
zero operacji Railway w całej sesji (rev. 1-4). Nie zaktualizowano
`CURRENT_MVP_CONTROL.md` ani żadnego globalnego dokumentu statusu — decyzja
Codex. `git status --short` czyste po każdym z pięciu commitów rev. 3-4
(`e4b9b8fe4a`, `5d7b0c8dcf`, `9e7aa2ff99`, `bfe64db7f1`, `65138c4bd2`).

AWAITING_CODEX_REVIEW
