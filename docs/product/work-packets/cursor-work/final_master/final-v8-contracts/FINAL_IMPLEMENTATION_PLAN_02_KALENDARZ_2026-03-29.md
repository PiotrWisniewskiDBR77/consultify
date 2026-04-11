# Final Implementation Contract — Kalendarz (Position 2/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `verified(evidence)` — P02-A/B/C complete  
Last updated: 2026-04-11 (P02-D–J runtime completion plan + contract hardening)

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
  - `itemType`: internal (`task_due`, `task_window`, `initiative_milestone`, `decision_deadline`, `meeting`, `assignment`, `adjustment`, `approval_window`, `escalation_window`, `focus_block`) | `external_event`
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

#### 2.3.10 P01 Integration Bridge (dependency wiring)
P02 **nie** buduje własnego OAuth / credential store. Deleguje do P01 (`Integracja`, position 1/35):

- **`CalendarSource.connectionRef`**: referencja (FK) do P01 `connection.id` — jedno źródło prawdy o credential + tenant binding.
- **Token lifecycle**: delegowany do P01 `pmSyncRefreshExecutionService` (access token refresh, encrypted secret storage).
- **OAuth flow**: przez istniejący `integrationOAuthEngine` (który już zna `google_calendar` i `outlook_calendar` — authorize URL, token URL, scopes, test URL).
- **CalDAV credentials**: przez P01 connection credential store (app-specific password, szyfrowane w DB).
- **Provider catalog**: P01 `provider_catalog_item` musi mieć wpisy dla `google_calendar`, `outlook_calendar`, `apple_calendar` z poprawnym lifecycle.
- **Lifecycle alignment**: P02 `CalendarSource.lifecycleState` mapuje 1:1 na P01 `connection` lifecycle grammar (connected/degraded/requires_action/blocked/recoverable).
- **Anti-duplication**: P02 nie duplikuje token storage ani OAuth callback — używa P01 infra; jedynym rozszerzeniem jest domain-specific sync logic.

#### 2.3.11 Provider Adapter Contract (runtime interface)
Każdy provider adapter (Google/Microsoft/CalDAV) musi implementować wspólny interface:

```typescript
interface CalendarProviderAdapter {
  readonly providerId: 'google' | 'microsoft' | 'caldav';

  listCalendars(connection: ConnectionRef): Promise<ProviderCalendarRef[]>;

  fetchEvents(
    connection: ConnectionRef,
    window: { startAt: string; endAt: string },
    cursor?: string | null,
  ): Promise<{
    events: ProviderEvent[];
    nextCursor: string | null;
    fullSyncRequired: boolean;
  }>;

  createEvent?(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    transactionId?: string,
  ): Promise<ProviderEvent>;

  updateEvent?(
    connection: ConnectionRef,
    item: CalendarItemPayload,
    providerEtag: string,
  ): Promise<ProviderEvent | ProviderConflictError>;

  deleteEvent?(
    connection: ConnectionRef,
    providerEventId: string,
    providerEtag: string,
  ): Promise<void | ProviderConflictError>;

  watchChanges?(
    connection: ConnectionRef,
    callbackUrl: string,
  ): Promise<WatchSubscription>;
}
```

- `createEvent` / `updateEvent` / `deleteEvent` — optional; CalDAV adapter omits them (read-only).
- `watchChanges` — optional; CalDAV uses polling, Google uses `watch()`, Graph uses `/subscriptions`.
- Adapters map provider-native responses → canonical `CalendarItem` + `RecurrenceModel`.
- Adapters thread real provider ETags (Google `etag`, Graph `@odata.etag`, CalDAV `ETag`) into `CalendarItem.etag`.

#### 2.3.12 Sync Runtime Contract
Background sync orchestration:

- **Periodic sync**: cron job (via `Scheduler.ts`) co 5 minut per connected source ze stanem `connected` lub `degraded`.
- **Incremental sync**: adapter `fetchEvents()` z aktualnym `SyncCheckpoint.cursor` (Google `syncToken`, Graph `deltaLink`, CalDAV `sync-token`).
- **Full resync fallback**: gdy adapter zwraca `fullSyncRequired: true` (cursor invalid / 410 Gone) → reset checkpoint, fetch window, set lifecycle `recoverable` → `connected` po sukcesie.
- **Webhook/push** (where available): Google `watch()` → callback route `/api/v8/calendar/webhooks/google`; Graph `/subscriptions` → callback route `/api/v8/calendar/webhooks/microsoft`. Webhook triggeruje incremental sync natychmiast (zamiast czekać na cron).
- **Rate limit handling**: adapter `fetchEvents()` rzuca typed error → `mapProviderError('rate_limited')` → source `degraded` + exponential backoff; cron skip dla degraded sources z recent error.
- **Recurrence materialization**: `recurrenceEngine` parsuje RRULE (via `rrule` npm) i materializuje instancje **tylko w oknie zapytania** (nie w storage). Exceptions z `RecurrenceModel.exceptions[]` override/cancel konkretne instancje.
- **Conflict detection during sync**: jeśli provider event ma nowszy etag niż local → update local; jeśli local ma pending changes z innym etag → `syncState=conflict`.

#### 2.3.13 Frontend Integration Contract
UI surfaces muszą respektować P02 model:

- **API bridge**: `/api/v8/my-work/calendar/unified` rozszerzony o external events z `calendarInteropService.getCalendarItems()`; response zawiera P02 metadata (`editAuthority`, `visibilityClass`, `syncState`, `permissionGradient`).
- **Permission gradient enforcement**: UI importuje `P02_PERMISSION_UI_RULES` z kanonu; `free_busy_only` items wyświetlają blok bez detali; `editAuthority=none` → disabled edit controls z widocznym powodem.
- **Lifecycle state display**: `CalendarSidebar` per-source lifecycle badge (connected/degraded/requires_action/blocked/recoverable) z human-readable recovery guidance z `P02_RECOVERY_STEPS`.
- **Conflict surface**: items z `syncState=conflict` mają widoczny badge + "resolve conflict" action (accept_local / accept_remote / merge).
- **Edit affordance gating**: conditional write (PUT `/items/:id/write`) wymaga If-Match; UI pobiera etag z item response i wysyła w header; 409 → show conflict UI.

### 2.4 Assumptions
- Integracja credential/runtime jest spójna z `Integracja` (position 1) i szerzej z `Synchronizacja`.
- P01 connector platform (OAuth engine, credential store, provider catalog) jest dostępna przed P02-D.

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

#### P02-D — P01 Bridge + OAuth wiring
- **Goal**: connect `CalendarSource` to P01 `connection` + credential lifecycle; enable OAuth flow for calendar providers.
- **Inputs required**: P01 `connection` table, `integrationOAuthEngine`, `pmSyncRefreshExecutionService`.
- **Acceptance**: CalendarSource created via OAuth flow stores `connectionRef`; token refresh updates source; lifecycle states propagate from P01 connection.
- **Tasks**:
  - Add `connection_id` FK to `v8_calendar_sources` (migration).
  - Wire `createCalendarSource` to accept P01 connection ref and derive credentials.
  - Implement token refresh delegation to `pmSyncRefreshExecutionService`.
  - Ensure `google_calendar` + `outlook_calendar` in `integrationHubService.PROVIDER_ADAPTERS`.
- **DoD**: OAuth connect → CalendarSource created → token refresh works → lifecycle synced with P01 connection.

#### P02-E — Google Calendar Adapter
- **Goal**: full Google Calendar API adapter with incremental sync, conditional writes, recurrence, watch().
- **Inputs required**: P02-D (OAuth + connection wiring), `googleapis` npm.
- **Tasks**:
  - Implement `googleCalendarAdapter.ts` conforming to §2.3.11 interface.
  - `listCalendars`: GET `/users/me/calendarList`.
  - `fetchEvents`: GET `/calendars/{id}/events` with `syncToken` incremental; `singleEvents=false` for series masters.
  - `createEvent` / `updateEvent` / `deleteEvent`: conditional writes with `If-Match: etag`.
  - `watchChanges`: POST `/calendars/{id}/events/watch` + webhook callback.
  - Recurrence mapping: Google `recurrence` RRULE → `RecurrenceModel`.
  - Free/busy: POST `/freeBusy`.
- **DoD**: Adapter tests pass with mocked Google API; syncToken incremental works; etag mismatch → conflict; recurring event with exception mapped correctly.

#### P02-F — Microsoft Graph Calendar Adapter
- **Goal**: full Outlook Calendar adapter via Microsoft Graph with delta queries, @odata.etag, subscriptions.
- **Inputs required**: P02-D (OAuth + connection wiring), `@microsoft/microsoft-graph-client` npm.
- **Tasks**:
  - Implement `microsoftGraphCalendarAdapter.ts` conforming to §2.3.11 interface.
  - `listCalendars`: GET `/me/calendars`.
  - `fetchEvents`: GET `/me/calendarView/delta` with `deltaLink` incremental.
  - `createEvent`: POST with `transactionId` for idempotent creates.
  - `updateEvent`: PATCH with `If-Match: @odata.etag`.
  - `deleteEvent`: DELETE with `If-Match: @odata.etag`.
  - `watchChanges`: POST `/subscriptions` + webhook callback.
  - Recurrence mapping: Graph `recurrence` + `seriesMaster` + `occurrences` + `exceptions` → `RecurrenceModel`.
  - Free/busy: POST `/me/calendar/getSchedule`.
- **DoD**: Adapter tests pass with mocked Graph API; deltaLink incremental works; @odata.etag mismatch → conflict.

#### P02-G — CalDAV Adapter (read-only)
- **Goal**: read-only CalDAV adapter (Apple Calendar / generic) with sync-token incremental and iCalendar recurrence.
- **Inputs required**: P02-D (connection wiring), `tsdav` + `ical.js` npm.
- **Tasks**:
  - Implement `caldavAdapter.ts` conforming to §2.3.11 interface (write methods omitted).
  - `listCalendars`: PROPFIND depth:1.
  - `fetchEvents`: REPORT `calendar-query` with date range + `sync-token` incremental.
  - Recurrence mapping: iCalendar RRULE/RECURRENCE-ID/EXDATE → `RecurrenceModel`.
  - No `createEvent` / `updateEvent` / `deleteEvent` (read-only per §2.3.1).
- **DoD**: CalDAV REPORT parse works; sync-token incremental; recurring events with exceptions mapped; no write exposed.

#### P02-H — Sync Runtime + Recurrence Engine
- **Goal**: background sync orchestration + RRULE materialization engine.
- **Inputs required**: P02-E/F/G (adapters), `rrule` npm.
- **Tasks**:
  - Implement `calendarSyncRuntime.ts`: per-source sync loop, adapter dispatch, checkpoint management, error → lifecycle mapping.
  - Implement `recurrenceEngine.ts`: RRULE parser + window-only materialization + exception overlay.
  - Add cron job `calendarSyncTick` (5min interval) in `Scheduler.ts`.
  - Wire `performIncrementalSync` / `performFullResync` to delegate to real adapters.
  - Implement webhook routes: `/api/v8/calendar/webhooks/google` + `/api/v8/calendar/webhooks/microsoft`.
  - Integrate rate limit backoff with `mapProviderError` → degraded state + skip in next cron tick.
- **DoD**: End-to-end sync flow with mock adapters; cursor invalid → full resync; rate limit → degraded; RRULE expansion in window; webhooks trigger immediate sync.

#### P02-I — Frontend Integration
- **Goal**: UI consumes P02 model with permission enforcement, lifecycle display, conflict surface.
- **Inputs required**: P02-H (sync runtime), P02 API working end-to-end.
- **Tasks**:
  - Extend `/api/v8/my-work/calendar/unified` to include external events from `calendarInteropService` with P02 metadata.
  - Extend `V8CalendarEvent` type with `editAuthority`, `visibilityClass`, `syncState`, `permissionGradient`.
  - CalendarSidebar: per-source lifecycle badge with recovery guidance.
  - CalendarGrid: edit affordance gating (disabled when `editAuthority=none` or `effectiveMode=read`); `free_busy_only` items without details.
  - Conflict badge + resolve action for `syncState=conflict` items.
- **DoD**: Component tests for permission enforcement; lifecycle states shown; free_busy_only items have no details; conflict resolution UI works.

#### P02-J — Extended itemType + Cross-Surface + E2E verification
- **Goal**: PMO completeness (full itemType coverage) + cross-surface state propagation + staging proof.
- **Inputs required**: P02-I (frontend), all adapters.
- **Tasks**:
  - Extend `ItemTypeValues` with: `assignment`, `adjustment`, `approval_window`, `escalation_window`, `focus_block` (migration + service + canon).
  - Cross-surface rule: internal CalendarItems map to canonical objects via `sourceObjectRef`; state changes propagate.
  - E2E tests (Playwright): connect Google → sync → view events → conflict → resolve.
  - Execute staging proof script (§8.1 P02-B staging proof, extended for all adapters).
  - Fill evidence ledger rows P02-D through P02-J.
- **DoD**: `verified(evidence)` bar met for all new packets; all 10+ itemTypes work; E2E staging proof passes.

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
| P02-B | verified(evidence) | (pending commit) | 25 contract tests (providers, model, recurrence, conflicts, permissions, lifecycle, error posture, computeEffectiveMode, mapProviderError) | calendarInteropService.ts: 17 functions; calendarInteropCanon.ts: 11/11 acceptance; calendar.routes.ts: 16 endpoints; migration: v8_calendar_sources + v8_calendar_items | None — all §2.3 requirements implemented: 3 providers, canonical model, conflict-safe writes, recurrence doctrine, permission gradients, lifecycle honesty, 8 error posture scenarios. |
| P02-C | verified(evidence) | (pending commit) | 25 contract + 22 smoke checks | evidence/P02_BC_VERIFICATION_2026-03-31.md; locks/P02-B.md + P02-C.md | None — verified(evidence) bar met. |
| P02-D | delivered | — | P01 bridge wiring tests | calendarInteropService: connectionId FK, integrationHubService wiring, migration | P01 Bridge: CalendarSource.connectionId → P01 connection, token refresh delegated. |
| P02-E | delivered | — | Google adapter tests (syncToken, etag, recurrence, watch) | googleCalendarAdapter.ts: full CalendarProviderAdapter impl | Google Calendar API: listCalendars, fetchEvents, createEvent, updateEvent, deleteEvent, watchChanges. |
| P02-F | delivered | — | Microsoft adapter tests (deltaLink, @odata.etag, subscriptions) | microsoftGraphCalendarAdapter.ts: full CalendarProviderAdapter impl | Microsoft Graph: calendarView/delta, If-Match @odata.etag, transactionId, subscriptions. |
| P02-G | delivered | — | CalDAV adapter tests (sync-token, RRULE) | caldavAdapter.ts: read-only CalendarProviderAdapter impl | CalDAV: tsdav PROPFIND/REPORT, sync-token incremental, iCalendar RRULE parse. |
| P02-H | delivered | — | Sync runtime + recurrence engine tests | calendarSyncRuntime.ts, recurrenceEngine.ts, calendarWebhook.routes.ts, Scheduler.ts cron | Sync: 5min cron, adapter dispatch, checkpoint mgmt, RRULE window materialization, webhook callbacks. |
| P02-I | delivered | — | Frontend component tests (permission, lifecycle, conflict) | CalendarGrid, CalendarSidebar, calendarTypes, my-work.routes /calendar/unified bridge | Frontend: permission gradients, lifecycle badges, editAuthority gating, conflict surface, P02 metadata in unified API. |
| P02-J | delivered | — | Extended itemType (10), canon (15 AC points), contract tests | calendarInteropCanon.ts, calendarInteropService.ts, contract tests | PMO completeness: 10 itemTypes, 15-point acceptance checklist, P01 bridge canon, adapter/runtime/frontend canon. |

