---
doc_kind: PACKAGE_FINAL_REPORT
package: MW-07
status: AWAITING_CODEX_REVIEW
date: 2026-08-02
---

# MW-07 — Calendar/time/capacity — raport końcowy

## 0. Tariff-plan checkpoint

`CURRENT_MVP_CONTROL.md` (commit `7797a3b3`, dziś) zapisał pauzę operacyjną
dla kończącego się planu, wymieniając 5 pakietów do przejęcia — MW-07 nie był
wśród nich. Piotr/Codex potwierdzili w sesji (2026-08-02), że warunek dotyczył
wyłącznie kończącego się planu i wygasł; MW-07 jest autoryzowany jako Linia 2
nowego planu. Ten plik NIE edytuje `CURRENT_MVP_CONTROL.md` — aktualizację
globalnego statusu wykona Codex.

## 1. Base SHA / branch / worktree / final HEAD

- Base ref: `integrate/mvp-wave1-abc`
- Base SHA: `0b3381a876c35c272ecb7f500b32292cbf8d2e29` (zweryfikowany żywo,
  zawiera ASM-08/EXE-08/TLS-07/INT-01 — dowód w discovery gate §1)
- Branch: `feat/mw-007-calendar-time-capacity` (brak upstream/push)
- Worktree: `.../7d8c9918-665e-4858-8e90-153bbbff23e3/scratchpad/wt-mw-007`
- Final HEAD: `7228e2855c185d5c0e6712f0942107695566b2a5`
- Discovery gate: `Harvard/wdrozenie-100/_DISCOVERY_GATE_MW-07_2026-08-02.md`

3 commity ponad bazą:
1. `9e8c72ff1e` docs(mw-007): discovery gate
2. `2f6a565824` feat(mw-007): project/provider lineage + version guard
3. `7228e2855c` fix(mw-007): pg timestamp day-shift bug + xid validation

## 2. Canonical ownership

Cztery równoległe backendowe rodziny endpointów kalendarza istniały już
wcześniej (family A legacy `my-work/calendar.routes.ts`, family B V8 P02
canon z realnym etag ale zero konsumenta UI, family C V8 `my-work.routes.ts`
— **kanoniczna, jedyna realnie używana przez UI**, family D
read-only integrations). Wybrano **family C** jako właściciela (już
kanoniczna, real-mutation, UI-wired) — nie zbudowano trzeciej. Obiekt biznesowy
(`tasks`) pozostaje własnością Tasks (MW-01..03, `CODE_GO_FROZEN`); Calendar
pozostaje projekcją, zgodnie z `MY_WORK_CALENDAR_REVIEW.md` §1.

## 3. Golden flow zrealizowany

**"Reschedule zadania w kalendarzu z jawnym project/provider lineage i
realnym version guardem"**:

1. Użytkownik otwiera `/my-work/calendar` (już działało).
2. `GET /api/v8/my-work/calendar/unified` — zdarzenia zadań mają teraz
   `projectId`/`projectName` (JOIN do `projects`) i uczciwy marker
   `provider:'internal'` (nigdy nie fabrykuje Google/Microsoft).
3. UI pokazuje widoczny chip `ProjectName · Internal` na evencie (nie tylko
   w tooltipie).
4. Drag zdarzenia → `PUT /api/v8/my-work/calendar/events/task/:id` z
   `{ dueDate, expectedVersion }`.
5. Backend: session-derived actor/org (bez zmian — już było), realny
   optimistic-concurrency guard przez Postgres `xmin` (bez migracji schematu):
   0 wierszy + wiersz istnieje → `409 VERSION_CONFLICT` z fresh state; 0
   wierszy + zły actor → `403 FORBIDDEN`; brak wiersza/zła org → `404`.
6. UI: sukces tylko po odpowiedzi backendu (już tak działało); na 409/403/404
   — PL/EN toast + zawsze `refetch()` (nigdy nie zostawia UI na odrzuconym
   stanie).
7. Read-back: świeży GET pokazuje to samo `taskId` pod nową datą.
8. Timezone/granica dnia: naprawiono realny, potwierdzony empirycznie bug
   (§5).

Poza zakresem (świadomie): OAuth connect, prawdziwy sync Google/Microsoft,
family B cutover, project picker w create-flow, event detail drawer, meeting
RSVP, CalDAV.

## 4. Zmienione pliki

- `server/src/routes/v8/my-work.routes.ts` — unified feed (lineage/version),
  PUT task branch (version guard), `toDateOnly` fix.
- `src/services/api/v8/my-work.ts` — `V8CalendarEvent`/`updateCalendarEvent`
  typy + `expectedVersion`.
- `src/services/api.ts` — `updateMyWorkCalendarEvent` przekazuje
  `expectedVersion`.
- `src/components/MyWork/Calendar/calendarTypes.ts` — nowe pola typu.
- `src/components/MyWork/Calendar/CalendarGrid.tsx` — widoczne lineage,
  przekazanie `version` na drag.
- `src/components/MyWork/Calendar/CalendarView.tsx` — obsługa 409/403/404 z
  PL/EN toastami, zawsze `refetch()` po błędzie.
- `public/locales/{pl,en}/translation.json` — 4 nowe klucze
  `calendarView.toast*`.
- `tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts`
  (nowy) — 9 testów real-PG.
- `tests/components/MyWork/CalendarGrid.lineage-conflict.test.tsx` (nowy) —
  5 testów real-mount.
- `Harvard/wdrozenie-100/_DISCOVERY_GATE_MW-07_2026-08-02.md`,
  `Harvard/wdrozenie-100/_RAPORT_KONCOWY_MW-07_2026-08-02.md` (ten plik).

Nie dotknięto: family A/B/D backendu, `my-work.routes.ts` monolitu (poza
mountem), FIN-05/MAT-10/EXE-08/INT-08/TLS-04.

## 5. Testy i real bugi znalezione po drodze (nie fabrykowane)

Środowisko: throwaway Postgres 16 (`pgvector/pgvector:pg16`, docker,
usunięty po teście), schemat załadowany z
`server/migrations-v2/001_baseline_20260413.sql` + 002–038 (oficjalny
`npm run db:migrate:strict` z pełnego łańcucha `server/migrations/` padł na
PRE-ISTNIEJĄCYM, niezwiązanym z MW-07 błędem kolejności
(`066_status_reports.sql` < 500 → pomijany przez runner, a
`20260623_distribution_delivery.sql` wymaga tej tabeli) — nie naprawiano,
zgłoszone jako ryzyko §7).

**9/9 testów real-PG PASS** (`tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts`):
golden flow (lineage+version→reschedule→read-back), missing/malformed
expectedVersion (400), concurrency (409, brak silent overwrite, retry-safe),
cross-user (403), cross-org (404, brak existence leak), actor/org forgery
(ignorowane), cross-project filter, timezone/day-boundary.

**5/5 testów real-mount frontend PASS**
(`tests/components/MyWork/CalendarGrid.lineage-conflict.test.tsx`):
widoczne lineage, brak fabrykowanego Google/Microsoft, brak lineage gdy
backend go nie wysyła, przekazanie `version` na drag, revert na fail.

**Dwa realne bugi znalezione i naprawione via red→green (nie sztuczne)**:
1. `toDateOnly` (odczyt daty z Postgres `timestamp without time zone`) używał
   `.toISOString()` (getterów UTC) na obiekcie `Date`, który node-pg buduje
   przez konstruktor LOKALNY z surowych pól naiwnego timestampu. Efekt:
   `due_date='2026-03-05'` odczytane jako `2026-03-04T23:00:00.000Z` — dzień
   cofnięty — na KAŻDYM procesie z dodatnim offsetem UTC (cała Europa, w tym
   Polska). Czerwony: task znika z unified feed / zła data. Zielony: fix na
   gettery lokalne (odwracają tę samą lokalną konstrukcję, niezależnie od
   strefy procesu). Bug PRE-ISTNIEJĄCY, dotyka wszystkich dat w unified feed
   (task/initiative/decision/milestone), nie tylko MW-07.
2. `expectedVersion` bez walidacji formatu → `... AND xmin = ?::xid` z
   niepoprawnym stringiem rzucał surowy Postgres `22P02`, ujawniony jako
   nieobsłużony `500`. Czerwony: 500 zamiast 404 w teście cross-org.
   Zielony: `z.string().regex(/^\d+$/)` w schemacie zod → czysty `400`.

**Typecheck**: `npm run type-check` (`tsc --noEmit`, cały projekt) — **PASS,
zero błędów**.

**Build**: `npm run build` — **PASS** (6m20s, tylko pre-istniejące ostrzeżenia
o wielkości chunków, niezwiązane z MW-07).

**git diff --check**: PASS (0 whitespace errors).

**Secret scan**: PASS (jedyne dopasowanie to udokumentowany, nieszkodliwy
lokalny dev-credential `iris:iris_test@localhost` w komentarzu testu —
identyczny wzorzec jak w siostrzanym pliku EXE-08).

**Clean tree**: `git status --short` puste po każdym commicie; potwierdzone
na końcu sesji.

## 6. Nieukończone / uczciwie zgłoszone braki

- **Browser acceptance (desktop + wąski viewport) i zrzuty stanów
  krytycznych — NIE wykonane.** Wymagałoby uruchomienia pełnej aplikacji z
  realną autentykacją i danymi zasianymi przez UI, co wykracza poza budżet
  tej sesji po głębokim dochodzeniu w warstwie real-PG. Nie fabrykuję
  zrzutów — to jest jawna, otwarta pozycja do zamknięcia przed promocją na
  demo, zgodnie z regułą „Piotr nigdy nie jest pierwszym testerem
  wizualnym" (zrzut robi wykonawca, nie ja bez uruchomionego demo/dev
  servera z realną sesją).
- Rodzina B (V8 P02 canon, realny etag/If-Match) pozostaje architektonicznie
  „poprawniejsza" ale bez konsumenta UI — nieskonsolidowana, świadomie poza
  zakresem.
- `meetings` nadal domyślnie etykietuje `calendarSource` jako `outlook`, gdy
  `agenda_json` go nie ustawia (`v8/my-work.routes.ts` sekcja
  google/outlook/consultify, poza moim zakresem plikowym) — to jest DALSZY,
  nienaprawiony przykład tej samej klasy „nieuczciwego markera providera",
  którą target-doc flaguje jako gap #1; dotyczy Meeting, nie Calendar/Task.
- Migracja `server/migrations/` (pełny łańcuch, nie `migrations-v2`) ma
  pre-istniejący błąd kolejności (`status_reports`) niezwiązany z MW-07 —
  zgłoszone, nie naprawione (inny właściciel plików).

## 7. Collision audit

Grep potwierdził zero odwołań do tabel/tras kalendarza w
`finance*.routes.ts`, `interview.routes.ts`, `teresa.routes.ts` (FIN-05,
INT-08, TLS-04). `tasks.due_date` jest też pisany przez
`execution-control.routes.ts`, `inboxTriageService.ts`,
`managerActionExecutionService.ts` — żaden z nich nie przechodzi przez
zmodyfikowany endpoint, więc mój version-guard ich nie dotyka (nie wysyłają
`expectedVersion`, więc po prostu nie korzystają z ochrony — brak regresji).

**Incydent operacyjny (samodzielnie wykryty i naprawiony, zero utraty
danych)**: podczas próby porównania z bazową wersją testu użyłem `git stash`
w tym worktree. `.git` jest WSPÓLNY dla wszystkich worktree tego repo, więc
stash to globalna lista — `git stash pop` przywrócił CUDZY wpis
(`stash@{0}: WIP on feat/mat-010-canonical-artifact-receipt-lineage`,
sesja MAT-10) w konflikcie do mojego drzewa. Naprawione natychmiast:
`git reset --hard HEAD` (nie dotyka listy stash) + ręczne usunięcie
nieśledzonego wycieku (`tsconfig.mat010.json`); zweryfikowano, że
`stash@{0}` MAT-10 pozostał nietknięty na liście. Zero utraty pracy w obu
sesjach. Lekcja: nie używać `git stash` w tym repo (potwierdza wcześniejszą
pamięć „git stash jest wspólny dla repo").

## 8. Dowód czystego drzewa i braku push/deploy

```
$ git status --short   → (puste)
$ git status -sb       → ## feat/mw-007-calendar-time-capacity  (brak upstream)
$ git rev-parse HEAD   → 7228e2855c185d5c0e6712f0942107695566b2a5
```

Zero `git push`, zero merge do `demo`/`Londyn`/`integrate/*`, zero operacji
Railway, zero dotknięcia `origin/demo`. Throwaway Postgres (docker) usunięty
po testach. Nie zaktualizowano `CURRENT_MVP_CONTROL.md` ani żadnego innego
globalnego dokumentu statusu — to decyzja Codex.

AWAITING_CODEX_REVIEW
