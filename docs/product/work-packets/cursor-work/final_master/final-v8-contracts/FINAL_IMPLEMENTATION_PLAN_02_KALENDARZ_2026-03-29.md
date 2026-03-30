# Final Implementation Contract — Kalendarz (Position 2/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Praca z terminami + koordynacja z kalendarzami innych aplikacji.
- **Primary users**: operatorzy i użytkownicy planujący pracę (PMO/manager/consultant).
- **Success metric**: realna interoperacyjność (identity, recurrence, sync, permissions) + „PMO-grade time surface” zamiast dekoracyjnej zakładki.

## 2. Scope
### 2.1 In-scope
- Integracja z kalendarzami zewnętrznymi i spójny model czasu dla obiektów app (task/decision/initiative milestone/meeting).
- Sync semantics (pull/push/bidir gdzie deklarowane), incremental updates, conflict-safe writes.

### 2.2 Out-of-scope / non-goals
- Budowa pełnego kalendarza jako osobnego produktu (nie zastępujemy vendorów).
- Pełna parity UI/feature set z Google Calendar lub Outlook (to nie jest celem Wave 1).
- Autonomiczny scheduler “AI decyduje za użytkownika” (oddzielny program).
- “Export-only” udający sync (to jest anty-cel; jeśli deklarujemy write/bidir, musi istnieć conflict-safe write + recovery).

### 2.3 P02-A canon (interoperability — scope approval)
Ta sekcja jest **kanonem interoperacyjności**: co deklarujemy jako prawdę produktową dla integracji kalendarzy i jak unikamy “papierowego sync”.

#### 2.3.1 Declared providers (Wave 1 declaration)
Deklarujemy dokładnie te rodziny providerów (bez “other_external” jako obejścia):

| Provider | Read | Write | Bidir | Notes (bounded truth) |
| --- | --- | --- | --- | --- |
| Google Calendar (API + CalDAV guide) | ✅ | ✅ (bounded) | ✅ (bounded) | Write/bidir dotyczy wyłącznie zdarzeń, dla których mamy **jawne uprawnienie i edit authority**; conditional writes oparte o `etag` / `If-Match` tam, gdzie dostępne. |
| Microsoft 365 / Outlook (Graph) | ✅ | ✅ (bounded) | ✅ (bounded) | Conditional writes oparte o `@odata.etag` (If-Match) i bezpieczne create (`transactionId`) tam, gdzie dostępne. |
| CalDAV (generic) | ✅ | ❌ (not declared) | ❌ (not declared) | Wave 1: deklarujemy read + recurrence correctness + lifecycle honesty; write/bidir dla CalDAV wymaga osobnego rozszerzenia scope (ACL/ETag variability). |

**Bounded rule:** “write/bidir” nigdy nie oznacza “edytujemy wszystko wszędzie”. Oznacza “edytujemy tylko te obiekty, dla których mamy prawa i potrafimy wykonać konflikt-safe write + recovery”.

#### 2.3.2 Canonical time model (contract objects)
Model jest wspólny i **nie wolno go duplikować per provider** (anti-duplicate gate). Obiekty kanoniczne:

- **`CalendarSource`** (external source connection)
  - `calendarSourceId` (durable)
  - `provider`: `google` | `microsoft` | `caldav`
  - `accountRef`: (kto jest właścicielem połączenia: user/seat)
  - `selectedCalendars[]`: provider calendar refs (np. `calendarId`, `uri`)
  - `declaredMode`: `read` | `write` | `bidir`
  - `effectiveMode`: `read` | `write` | `bidir` (wynik uprawnień + stanu provider lifecycle)
  - `permissionGradient`: `free_busy` | `read` | `write` | `delegate`
  - `lifecycleState`: `connected` | `degraded` | `requires_action` | `blocked` | `recoverable`
  - `requiresActionReason?`
  - `lastOkAt?`, `lastSyncAt?`
  - `syncCheckpoint`: `SyncCheckpoint`
  - `lastError?` (normalized)

- **`CalendarItem`** (unified time item; internal + external)
  - `calendarItemId` (durable)
  - `itemType`: internal (`task_due`, `initiative_milestone`, …) | `external_event`
  - `sourceSystem`: `consultify` | `google_calendar` | `outlook_calendar` | `caldav`
  - `sourceObjectRef`: internal entity ref OR external identity (provider id + iCal `UID` where available)
  - `title?` (may be empty for privacy-limited items)
  - `startAt`, `endAt?`, `allDay`
  - `timezone?` (explicit; never inferred silently)
  - `visibilityClass`: `free_busy_only` | `details`
  - `editAuthority`: `none` | `local_only` | `remote_owner` | `delegate`
  - `recurrenceModel?`: `RecurrenceModel` (for series/instances/exceptions)
  - `syncState`: `in_sync` | `pending` | `conflict` | `blocked` | `stale`

- **`RecurrenceModel`** (series master + instances + exceptions)
  - `seriesMasterRef` (provider series id / iCal UID)
  - `rrule?`, `rdate?`, `exdate?` (iCalendar semantics)
  - `exceptions[]`: keyed by `recurrenceId` / provider exception id
  - `materializationRule`: “instances are materialized only for a requested window”

- **`SyncCheckpoint`** (incremental cursor + integrity guards)
  - `cursor?`: provider cursor (`syncToken` / `deltaLink` / `ctag`)
  - `rangeWatermark`: `{ startAt, endAt }` for window-based sync fallback
  - `lastFullSyncAt?`, `lastIncrementalSyncAt?`
  - `integrityGuards[]`: provider-specific invariants (np. “cursor invalid → full resync + visible state”)

#### 2.3.3 Recurrence + exceptions doctrine (correctness)
Prawda kanoniczna:

- **Series master ≠ instance ≠ exception**: model musi rozróżniać zbiór (series), pojedynczą instancję (occurrence) i wyjątek (override/cancel).
- **No instance explosion**: nie wolno “rozwinąć” serii do nieograniczonej listy instancji w storage; instancje materializujemy **tylko w oknie zapytania/UI**.
- **No silent loss**: wyjątki (np. edycja jednej instancji) nie mogą ginąć przy incremental sync ani przy fallback full resync.
- **Correct mapping**: iCalendar `RECURRENCE-ID` (oraz Graph `occurrences` + `exceptions`) mapujemy do `exceptions[]` bez zgadywania.
- **Cancellation truth**: odwołana instancja lub usunięty master skutkuje stanem produktu (np. `stale`/`blocked`) — nie “zniknięciem bez śladu”.

#### 2.3.4 Conflict-safe writes model (no overwrite)
Jeśli `effectiveMode` zawiera write:

- **Conditional writes** są obowiązkowe: `ETag` / `If-Match` (CalDAV/Google) i `@odata.etag` (Graph) tam, gdzie dostępne.
- **Conflict is product state**: konflikt (`precondition failed` / etag mismatch / 409) → `syncState=conflict` + jawna instrukcja dla użytkownika/operatora. Nie ma silent overwrite.
- **Idempotent-ish create**: tam, gdzie provider oferuje mechanizm (np. Graph `transactionId`), używamy go, aby uniknąć duplikatów po retry.

#### 2.3.5 Permission gradients + UI affordance rules (no fake edit)
Gradient uprawnień jest częścią modelu produktu (nie tylko integracji):

- `free_busy`: UI może pokazać blok zajętości bez detali; brak tytułów i uczestników.
- `read`: UI pokazuje detale dozwolone, ale wszystkie akcje edycji są **wyłączone**.
- `write`: UI pokazuje edycję tylko dla obiektów z `editAuthority != none`.
- `delegate`: UI pokazuje “on behalf of” i wyraźnie komunikuje kontekst delegacji.

**Hard rule:** UI nie może “udawać edycji” (np. pozwolić zmienić pola lokalnie, jeśli provider write jest niedostępny). Jeśli akcja jest niedozwolona, kontrola jest disabled + opis powodu (permissions/lifecycle).

#### 2.3.6 Provider lifecycle honesty (states + recovery)
Każde `CalendarSource` ma jawny lifecycle:

- `connected`: sync działa, cursor/etag aktualne.
- `degraded`: częściowa funkcjonalność (np. rate limit, partial window) — produkt komunikuje ograniczenia.
- `requires_action`: potrzebna akcja użytkownika (reauth, ponowne nadanie scope, wybór kalendarzy).
- `recoverable`: błąd, który system może naprawić retry/backoff/full resync (bez udziału usera), ale stan jest widoczny.
- `blocked`: brak możliwości działania (np. policy/tenant restriction, permanent auth failure) — wymaga interwencji operatora.

Recovery steps (minimum):
- OAuth expired → `requires_action` → reauth → full resync (jeśli cursor invalid) → `connected`.
- Scope revoked/insufficient → `requires_action` z listą brakujących uprawnień → re-consent → resync.
- Cursor invalidated → `recoverable` → full resync w kontrolowanym oknie + jawny “stale until complete”.

#### 2.3.7 Anti-duplicate gate (program rule)
- Zakaz “export-only pretending sync” (deklarowane write/bidir musi mieć conditional write + conflict state + recovery).
- Zakaz “parallel time model per provider” — `CalendarItem`/`RecurrenceModel`/`SyncCheckpoint` są wspólne.

#### 2.3.8 Error posture (min scenarios)
System musi jawnie mapować błędy providerów na stany produktu (source/item) i recovery:

1) OAuth token expired → `requires_action` (source)  
2) Consent revoked / invalid_grant → `requires_action` (source)  
3) Insufficient scopes / forbidden → `blocked` lub `requires_action` (source)  
4) Rate limit / throttling → `degraded` (source) + backoff; bez “fake freshness”  
5) Cursor invalid / deltaLink expired / syncToken invalid → `recoverable` (source) → full resync  
6) Conditional write failed (etag mismatch / 412 / 409) → `conflict` (item) — bez overwrite  
7) Series master deleted or changed → `stale`/`blocked` (items in series) + audit note; bez silent disappearance  
8) Timezone / invalid recurrence rule edge → `degraded` (item) + safe fallback (display as raw) + operator note  

#### 2.3.9 Acceptance checklist (10+ testable points)
- Provider list jest zamknięty do: Google/Microsoft/CalDAV (bez “other external” jako obejścia).
- Dla każdego providera jest jawna deklaracja read/write/bidir i bounded truth (co to znaczy).
- `CalendarSource` ma lifecycle i `permissionGradient` oraz `declaredMode` ≠ `effectiveMode`.
- `CalendarItem` przechowuje durable external identity (provider id + UID gdzie dostępne).
- Recurrence: series master/instance/exception są rozróżnione w modelu; wyjątki nie giną.
- Brak instance explosion: instancje są materializowane tylko w oknie zapytania/UI.
- Conditional writes są wymagane tam, gdzie write jest deklarowane; bez unconditional overwrite.
- Konflikt jest stanem produktu (`syncState=conflict`) i jest widoczny w UI (no silent overwrite).
- Permission gradients są respektowane w UI: brak “fake edit” przy read/free_busy.
- Source lifecycle jest widoczny użytkownikowi wraz z recovery steps (requires_action/recoverable/blocked).
- Anti-duplicate gate jest spełniony: brak “export-only pretending sync” i brak per-provider równoległego modelu czasu.

### 2.4 Assumptions
- Integracja credential/runtime jest spójna z `Integracja` (position 1) i szerzej z `Synchronizacja`.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md`
- Benchmark: `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
- Readiness/SSOT: `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`, `docs/product/MYWORK_CALENDAR_V1_SSOT.md`

## 4. Softs inspirations (benchmark apps / standards)
### 4.1 Primary benchmark family (SSOT)
- `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md` (doktryna: interoperacyjność > UI; “scheduling is a state machine”; permission gradients; incremental sync + conflict-safe writes).

### 4.2 Local Softs evidence (concrete artifacts)
- **Standards: CalDAV / iCalendar / iTIP / WebDAV**:
  - `Softs/0 Kalendarz/CALDAV (STANDARD)/datatracker.ietf.org/doc/html/rfc4791.html` (CalDAV: access/manage/share calendaring; REPORT methods; ETags; WebDAV ACL).
  - `Softs/0 Kalendarz/CALDAV (STANDARD)/datatracker.ietf.org/doc/html/rfc5545.html` (iCalendar: UID, DTSTAMP, ORGANIZER/ATTENDEE, RECURRENCE-ID; METHOD).
  - `Softs/0 Kalendarz/CALDAV (STANDARD)/datatracker.ietf.org/doc/html/rfc5546.html` (iTIP: scheduling interoperability; REQUEST/REPLY/CANCEL; organizer vs attendee semantics).
  - `Softs/0 Kalendarz/CALDAV (STANDARD)/datatracker.ietf.org/doc/html/rfc4918.html` (WebDAV; warstwa bazowa dla CalDAV; implikuje conditional / resource model patterns).
- **Google Calendar (API + CalDAV guide)**:
  - `Softs/0 Kalendarz/ONECAL/developers.google.com/workspace/calendar/api/guides/overview﹖hl=pl.html` (Calendar API: event resource, recurring events, developer surface).
  - `Softs/0 Kalendarz/ONECAL/developers.google.com/workspace/calendar/caldav/v2/guide﹖hl=pl.html` (Google CalDAV specifics: OAuth 2.0 over HTTPS; ograniczenia metod; `If-Match`; `ctag` / `etag`).
- **Microsoft 365 / Outlook (Graph)**:
  - `Softs/0 Kalendarz/MICROSOFT OUTLOOK : GRAPH/learn.microsoft.com/en-us/graph/api/calendar-list-calendarview﹖view=graph-rest-1.0&tabs=http.html` (calendarView: occurrences + exceptions + single instances w range).
  - `Softs/0 Kalendarz/MICROSOFT OUTLOOK : GRAPH/learn.microsoft.com/en-us/graph/api/calendar-list-events﹖view=graph-rest-1.0&tabs=http.html` (events: `@odata.etag`, recurrence/seriesMaster fields).
  - `Softs/0 Kalendarz/MICROSOFT OUTLOOK : GRAPH/learn.microsoft.com/en-us/graph/api/resources/calendarpermission﹖view=graph-rest-1.0.html` (permission gradients: freeBusyRead → read → write → delegate*).
  - `Softs/0 Kalendarz/MICROSOFT OUTLOOK : GRAPH/learn.microsoft.com/en-us/graph/api/calendar-getschedule﹖view=graph-rest-1.0&tabs=http.html` (free/busy: getSchedule).
  - `Softs/0 Kalendarz/MICROSOFT OUTLOOK : GRAPH/learn.microsoft.com/en-us/graph/api/calendar-post-events﹖view=graph-rest-1.0&tabs=http.html` (create event; `transactionId` for safer create semantics).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “PMO-grade interoperacyjność + prawda o stanie”, nie “klon UI kalendarzy vendorów”.**

- **Canonical time model (benchmark + standards)**:
  - Jedna, typowana reprezentacja obiektu czasu: internal (task/deadline/milestone/meeting) + external event.
- **Durable identity (iCalendar + providers)**:
  - Stabilne ID zdarzenia; przechowywanie “external identity” + source + sync checkpoint.
  - Dla recurring events: relacja parent/instance + wyjątki (RECURRENCE-ID / occurrences+exceptions).
- **Scheduling as a state machine (iTIP)**:
  - Organizer vs attendee semantics (request/reply/cancel) muszą być jawne tam, gdzie dotyczy.
- **Recurrence correctness (Google + iCalendar + Graph)**:
  - Obsługa recurring events bez “rozsypywania” instancji; poprawne wyjątki; bez silent data loss.
- **Permission gradients (standards + Graph)**:
  - Rozróżnienie: free/busy vs limited read vs full read vs write vs delegate.
  - UI/UX i API muszą respektować uprawnienia (nie “udawać edit”).
- **Incremental sync + conflict-safe writes (CalDAV + Google guide)**:
  - Incremental retrieval (cursor/checkpoint), ETag/ctag, conditional writes (np. If-Match); brak overwrite bez wykrycia konfliktu.
- **Provider lifecycle honesty (Wave1 doctrine)**:
  - Stany: connected / degraded / requires action / blocked / recoverable; recovery flow (OAuth expired, permission revoked).
- **Free/busy support (Graph)**:
  - Minimum “availability” jako osobna warstwa od workload; odróżnić “zajętość” od “obciążenia”.
- **Authoring reliability (Graph)**:
  - Jeżeli deklarujemy tworzenie/edycję po stronie providera: idempotent-ish safety (np. transactionId) + jasny error model.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy o stanie “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md` + readiness/SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| External sync maturity | incremental + conditional + recovery | “external sync maturity is still below PMO-grade” | Podnieść lifecycle + recovery + incremental correctness dla deklarowanych providerów | P0 |
| Workload + adjustment depth | workload beyond free/busy | “workload and adjustment depth remain partial” | Rozszerzyć workload model i “next action” guidance (bez AI scheduler) | P0 |
| Connected action continuity | plan → next action | “connected action continuity remain later” | Zdefiniować i dowieźć mosty z kalendarza do modułów (task/decision/initiative) | P1 |
| Recurrence + scheduling semantics | recurrence/exceptions + organizer/attendee | (niewystarczająco udowodnione) | Kontrakt wymaga testów i dowodu correctness dla recurring + exceptions | P0 |
| Permission gradients | roles: freeBusy/read/write/delegate | (niewystarczająco udowodnione) | Ujawnić i respektować permission gradients w UI i w integracji | P1 |

## 5. Product contract (user-facing)
### 5.1 Primary flows
- Zobacz „one time surface”: widzę razem commitments z app + external events.
- Zdarzenia zewnętrzne: read + (gdzie deklarowane) write/update z zachowaniem identity i recurrence.
- Recover: expired OAuth/permission revoked → requires action → reauth → re-sync → back to healthy.
- Plan → adjust: overload/conflict signal → rekomendowane “co dalej” (manual actions) → handoff do obiektu pracy.

### 5.2 UI surfaces / entry points
- MyWork calendar jako kanoniczna powierzchnia czasu; overlay dla obiektów aplikacji.
- Powierzchnia “sources”: lista źródeł (Google/Microsoft/CalDAV) z widocznym stanem i recovery.
- Powierzchnia “workload”: widok obciążenia vs availability (jawne rozróżnienie).

### 5.3 States and transitions
- event state: external/internal, editable authority, recurrence parent/child, sync checkpoint.
- source state: draft/setup → connected → degraded → requires_action → recovered.

### 5.4 Error model / degraded modes
- Różnicujemy: brak uprawnień, expired OAuth, conflict, partial sync, stale data.
- Errors muszą być przypisane do warstwy: source vs event instance vs recurrence set.

## 6. Data + API contract (engineering-facing)
Kontrakt wymaga (minimum):

- **CalendarSource**: provider type (Google/Microsoft/CalDAV), credential ref, status, last_ok_at, last_sync_at, requires_action_reason, scopes/roles.
- **CalendarItem** (typed): internal/external; external identity; time fields; timezone; privacy; ownership; link do obiektu pracy.
- **RecurrenceModel**: series master, instances, exceptions (RECURRENCE-ID / Graph occurrences+exceptions).
- **SyncCheckpoint**: incremental cursor, etag/ctag (gdzie dostępne), range sync rules.
- **Conditional write doctrine**: If-Match / etag based updates (gdzie dostępne) + konflikt jako stan produktu, nie silent overwrite.
- **Permission doctrine**: “what we can see” vs “what we can edit” jest jawne i przechodzi do UI.

## 7. Evidence plan (DoD)
### 7.1 Acceptance criteria
- Connect → initial sync → incremental sync → recovery działa dla deklarowanych providerów.
- Recurrence correctness: series + exceptions nie gubią danych i nie “rozsypują” instancji.
- Permission gradients są respektowane (free/busy vs read vs write; brak fałszywych affordances).
- Workload signal prowadzi do “next action” (bez zgadywania) i nie miesza się z availability.

### 7.2 Tests
- Testy integracyjne per provider:
  - OAuth expired → requires action → reauth → resync.
  - Recurring event z wyjątkiem (modyfikacja jednej instancji) → poprawne odwzorowanie.
  - Conditional update (etag/If-Match) → konflikt → bezpieczny fallback (manual review).
- Testy kontraktowe: mapping błędów providerów → stany produktu (blocked/degraded/recoverable).

### 7.3 Staging proof checklist
- Staging runbook z realnym providerem:
  - Google: Calendar API + CalDAV (jeśli w deklarowanym zakresie).
  - Microsoft: Graph (calendarView + getSchedule + create/update event jeśli deklarowane).
- Demo: “overload day” → workload panel → rekomendowana akcja → przejście do właściwego obiektu pracy.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Detailed plan/SSOT: `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md`
- Benchmark: `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`
- Evidence plan: see section 7.

### 8.1 Bounded delivery packets
#### P02-A — Interoperability canon (scope approval)
- **Goal**: canonical time model + identity + recurrence + permission gradients (bounded) bez UI parity.
- **Inputs required**: declared providers + deklaracja read vs write/bidir + conflict model.
- **Acceptance**: scope zatwierdzony; non-goals jawne; recurrence correctness i conflict-safe writes rules spisane.
- **Evidence**: scope approval + linkowane standardy/bench.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze providers + declare read vs write/bidir (per provider).
  - Freeze recurrence + exceptions doctrine (series/instance mapping) and conflict model (conditional writes).
  - Freeze permission gradients (free/busy/read/write/delegate) and UI affordances rules.
- **DoD**:
  - Approved(scope): interoperability rules are explicit; no “export-only pretending sync”.
  - Recurrence correctness and conflict-safe writes have testable acceptance statements.

#### P02-B — Sync + recurrence + recovery closure
- **Goal**: connect→initial sync→incremental sync→recovery + recurring events (exceptions) correctness.
- **Acceptance**: OAuth expired i conflict są stanami produktu; permission gradients są respektowane w UI.
- **Evidence**: integracyjne testy per provider + staging runbook (7.3).
- **Tasks**:
  - Implement incremental sync + recovery (OAuth expired / permission revoked) per provider.
  - Implement recurring events mapping (occurrences+exceptions) with correctness tests.
  - Implement conflict-safe writes where declared; surface conflict as product state.
- **Staging proof script (click-by-click)**:
  1. Connect one declared calendar provider and confirm initial sync completes.
  2. Create a recurring event with an exception (edit one instance) on the provider side.
  3. Refresh/sync and verify the series + exception are represented correctly (no instance explosion).
  4. Trigger OAuth expiry/revocation and verify `requires_action` + recovery guidance.
  5. Re-auth and verify incremental sync resumes without data loss.
  6. If write/bidir is declared: attempt an edit with stale ETag/If-Match and verify conflict is a product state (no silent overwrite).
- **DoD**:
  - Provider runbook passes; recurrence exceptions do not lose data; permissions are enforced in UI/API.
  - Evidence artifacts ready for ledger (tests + staging proof).

#### P02-C — Verification + rollout
- **Goal**: telemetry + regresje + staging proof; bezpieczny rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Execute staging runbook (7.3), capture proof, and fill ledger rows P02-A/B/C.
  - Validate rollback: disable write/bidir; preserve read-only overlay.
- **DoD**:
  - Status `verified(evidence)` with complete evidence ledger and known limits recorded.

### 8.2 Rollout strategy
- Najpierw read + recovery + recurrence correctness (P0), potem write/bidir (tylko jeśli deklarowane).

### 8.3 Rollback plan
- Wyłącz write/bidir; zachowaj read-only overlay i source statusy; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: traktować sync jako export-only; brak recurrence correctness; brak jasnych permission gradients.
- Ryzyko: pomylenie “free/busy” z “workload” (produkt staje się mylący dla PMO).
- Ryzyko: “ładny month grid” bez recovery, bez incremental correctness, bez conflict modelu.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P02-A | approved(scope) | 2e7c505698 | n/a (scope approval; docs only) | n/a (scope approval; docs only) | Interoperability canon frozen in §2.3 (providers/modes, time model objects, recurrence doctrine, conflict-safe writes, permission gradients, lifecycle, error posture). |
| P02-B |  |  |  |  |  |
| P02-C |  |  |  |  |  |

