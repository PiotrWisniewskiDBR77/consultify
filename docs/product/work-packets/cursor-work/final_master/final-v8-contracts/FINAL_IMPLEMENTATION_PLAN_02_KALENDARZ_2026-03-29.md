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

### 2.3 Assumptions
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
- Packetizacja zgodnie z planem szczegółowym.

## 9. Risks / open questions / decisions
- Ryzyko: traktować sync jako export-only; brak recurrence correctness; brak jasnych permission gradients.
- Ryzyko: pomylenie “free/busy” z “workload” (produkt staje się mylący dla PMO).
- Ryzyko: “ładny month grid” bez recovery, bez incremental correctness, bez conflict modelu.

## 10. Evidence ledger (fill after delivery)
- PRs / staging proof / test runs:

