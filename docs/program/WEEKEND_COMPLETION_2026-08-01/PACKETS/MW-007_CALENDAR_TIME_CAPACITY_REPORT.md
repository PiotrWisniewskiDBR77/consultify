---
doc_kind: PACKAGE_FINAL_REPORT
package: MW-07
status: AWAITING_CODEX_REVIEW
date: 2026-08-02
revision: 2 (post Codex FIX_REQUIRED — all 6 blockers addressed)
---

# MW-07 — Calendar/time/capacity — raport końcowy (rev. 2)

Rev. 1 (`Harvard/wdrozenie-100/_RAPORT_KONCOWY_MW-07_2026-08-02.md` @ `20ac6c6c72`)
otrzymał `FIX_REQUIRED` z 6 blokerami. Ten dokument zastępuje rev. 1 i opisuje
domknięcie wszystkich sześciu. **Kanoniczna kopia tego raportu**:
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
  `c00bdc02fd` (`chore(mw-007): browser-acceptance backend launcher script`)
- **Documentation HEAD** (po commicie tego pliku): patrz komunikat końcowy —
  `git rev-parse HEAD` wykonany PO commicie tego raportu, zgodnie z
  wymogiem Codex §6.

11 commitów ponad bazą (chronologicznie):

1. `9e8c72ff1e` docs: discovery gate
2. `2f6a565824` feat: project/provider lineage + version guard
3. `7228e2855c` fix: pg timestamp day-shift bug + xid validation
4. `20ac6c6c72` docs: rev.1 raport (zastąpiony przez ten plik)
5. `9a3666ef8d` fix: meeting provider honesty (BLOCKER 3)
6. `74889fb199` test: version-rotation proof (BLOCKER 5)
7. `8d636adb4a` fix: status_reports fresh-DB guard (BLOCKER 1)
8. `30dedd00e0` test: napraw flaky mid-process TZ mutation
9. `79f8599a78` test: no-premature-success dla CalendarView (BLOCKER 4 #4)
10. `de2b66cbf2` fix: `editAuthority` dla task events (BLOCKER 2 finding)
11. `c00bdc02fd` chore: browser-acceptance tooling

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
- Wąski viewport (375×812): zrzut wykonany. **Realne, PRE-ISTNIEJĄCE
  znalezisko UX**: panel boczny (mini-kalendarz + Sources) nie chowa się
  na wąskim viewport i nakłada się na główny grid, czyniąc go nieczytelnym.
  NIE naprawione — to nie jest coś, co MW-07 wprowadził, a przeprojektowanie
  layoutu mobilnego wymaga prototypu i akceptu Piotra (SPEC-A/TRIADA reguła
  „Piotr nigdy nie jest pierwszym testerem wizualnym" działa też w drugą
  stronę: ja nie projektuję nowego layoutu bez prototypu). Zgłoszone jako
  otwarte ryzyko.

**Ograniczenie narzędziowe (uczciwie zgłoszone)**: nie znalazłem w dostępnym
zestawie narzędzi mechanizmu zapisu zrzutów `computer{action:"screenshot"}`
do plików na dysku (zrzuty są zwracane jako dane obrazu w wyniku narzędzia,
oglądane i zweryfikowane w tej sesji, ale nie ma API do zapisania ich jako
osobnych plików). Zamiast fabrykować indeks plików, którego nie mogę
faktycznie wytworzyć, powyższa lista to dokładny, chronologiczny inwentarz
stanów przechwyconych i obejrzanych w sesji wraz z dokładnym opisem każdego.
Jeśli Codex/Piotr wymaga zrzutów jako osobnych plików w repo, potrzebny jest
dodatkowy przebieg z narzędziem, które faktycznie to potrafi (lub ręczne
zrzuty wykonane przez Piotra na tym samym seed-flow, odtwarzalnym z
`scripts/dev/mw007-browser-backend.sh` + krokami w tej sekcji).

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

## 6. Testy — pełne podsumowanie końcowe

- **21/21 testów real-PG PASS** w jednym przebiegu: 10 (calendar-reschedule,
  w tym version-rotation §5.5) + 5 (meeting-provider-honesty) + 1
  (schema-migration-completeness) + potwierdzenie osobno przeciw
  oficjalnie-zmigrowanej bazie (§5.1).
- **8/8 testów real-mount frontend PASS**: 5 (CalendarGrid lineage/conflict)
  + 3 (CalendarView no-premature-success).
- **Timezone**: uruchomiony DWUKROTNIE, osobne procesy, `TZ` ustawiony na
  poziomie shell PRZED startem node (nie w locie — mutacja `process.env.TZ`
  w trakcie działania okazała się zawodna w Node/V8, patrz komentarz w
  pliku testowym): `Europe/Warsaw` (+1/+2) i `America/Los_Angeles` (-7/-8)
  — identyczny wynik (10/10) w obu.
- **Typecheck**: `npm run type-check` — PASS, zero błędów, cały projekt.
- **Build**: `npm run build` — PASS.
- **git diff --check**: PASS (liczone od realnego fork-pointu `0b3381a876`).
- **Secret scan**: PASS.
- **Clean tree**: PASS po każdym commicie.

## 7. Collision audit

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

## 8. Nieukończone / otwarte ryzyka (uczciwie zgłoszone, nie fabrykowane)

- Brak zapisanych na dysku plików zrzutów ekranu (ograniczenie narzędziowe,
  §5.2) — zrzuty przechwycone i zweryfikowane inline w sesji.
- Wąski viewport (375px): panel boczny Calendar nakłada się na grid —
  pre-istniejący gap UX, nie naprawiony (wymaga prototypu+akceptu Piotra).
- `meetings` nie jest tworzone przez `server/migrations/` (ta sama klasa
  bugu co `status_reports`, inna tabela) — zgłoszone, nie naprawione.
- Pełny `db:migrate:strict` od pustej bazy nadal zatrzymuje się (za
  `status_reports`) na `20260624_initiative_status_normalize.sql`
  (`initiatives.title` brak w baseline) — niezwiązane z MW-07, zgłoszone
  Codex do sekwencjonowania.
- Rodzina B (V8 P02 canon, realny etag) pozostaje bez konsumenta UI —
  świadomie poza zakresem.

## 9. Dowód czystego drzewa i braku push/deploy

Throwaway Postgres (3 kontenery docker użyte w toku sesji) usunięte.
Backend/frontend dev-serwery zatrzymane. Zero `git push`, zero merge do
`demo`/`Londyn`/`integrate/*`, zero operacji Railway. Nie zaktualizowano
`CURRENT_MVP_CONTROL.md` ani żadnego globalnego dokumentu statusu — decyzja
Codex.

AWAITING_CODEX_REVIEW
