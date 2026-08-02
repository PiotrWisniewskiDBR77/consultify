---
doc_kind: DISCOVERY_GATE
package: MW-07
branch: feat/mw-007-calendar-time-capacity
base_sha: 0b3381a876c35c272ecb7f500b32292cbf8d2e29
base_ref: integrate/mvp-wave1-abc
worktree: /private/tmp/claude-501/.../7d8c9918-665e-4858-8e90-153bbbff23e3/scratchpad/wt-mw-007
date: 2026-08-02
status: DISCOVERY_COMPLETE
---

# MW-07 — Calendar/time/capacity — Discovery Gate

## 0. Tariff-plan checkpoint override

`CURRENT_MVP_CONTROL.md` (commit `7797a3b3`, 2026-08-02 08:45) recorded an
operational pause ("nie uruchamiamy już nowych prac w kończącym się planie")
listing 5 handoff packets (FIN-05, TLS-04, MAT-10, EXE-08, INT-08-correction).
MW-07 is not among them. Piotr/Codex confirmed in-session (2026-08-02) that
this checkpoint applied only to the ending tariff plan and has expired; MW-07
is authorized as Line 2 of the new plan. **This file does not edit
`CURRENT_MVP_CONTROL.md` — that update belongs to Codex.**

## 1. Base selection — proof

- Control doc source of truth: "wykonać fast-forward kanonicznej gałęzi
  `integrate/mvp-wave1-abc`" (`CURRENT_MVP_CONTROL.md` §5).
- `git rev-parse integrate/mvp-wave1-abc` = `0b3381a876c35c272ecb7f500b32292cbf8d2e29`,
  tip commit `feat(int-01): version interview template publications`
  (2026-08-02 08:50:24).
- Spot-checked ancestry contains the frozen A/B/C wave commits named in
  `CURRENT_MVP_CONTROL.md`: `asm-008` (`da06ad77a7`), `exe-008` closure gate
  (`ece7ab1c59`…`0b16cd231c`), `tls-07` (`01cb107b2c`). Confirmed present via
  `git log --oneline | grep`.
- Not `origin/demo`: demo carries ~130 unrelated commits of mechanic work not
  yet forward-ported and is not the "accepted MVP packages" line per
  `CURRENT_MVP_CONTROL.md` hierarchy.

## 2. Canonical ownership decision

Backend discovery found **four live, real backend route families** plus a
fifth connection-status surface, not two:

| Family | File | Live UI consumer? | Concurrency | Project lineage |
| --- | --- | --- | --- | --- |
| A (legacy `my-work`) | `server/src/routes/my-work/calendar.routes.ts` | fallback only (V8 unreachable) | none | none |
| B (V8 P02 canon) | `server/src/routes/v8/calendar.routes.ts` + `calendarInteropService.ts` | **none** — no frontend caller | real etag/If-Match, real 409 | none (`v8_calendar_items` has no `project_id`) |
| C (V8 my-work) | `server/src/routes/v8/my-work.routes.ts` | **primary** — `CalendarView.tsx` uses this via `V8MyWorkApi` | none | `tasks.project_id` exists but unused by this endpoint |
| D (`integrations/calendarIntegrations`) | read-only (status + ICS) | Settings + Calendar status badge | n/a | n/a |
| E (`settings.routes.ts` per-user blob) | provider connect status | Settings | n/a | n/a |

Per the "don't build a third competing system" instruction: **B is the
architecturally correct system (real conflict guard) but has zero live
consumer and zero project lineage in its schema — adopting it now means a
frontend cutover plus a schema change, which is out of proportion for the
smallest complete slice.** C is already the canonical, UI-wired, real-mutation
path (confirmed: `CalendarView.tsx:343` → `Api.updateMyWorkCalendarEvent` →
`PUT /api/v8/my-work/calendar/events/:source/:sourceId`, family C,
`v8/my-work.routes.ts:2533-2628`).

**Decision: Family C is the canonical owner for this package.** We harden it
in place (session actor, project lineage exposure, optimistic-concurrency
guard on the existing `tasks.updated_at` column) rather than introduce a new
route family or migrate the frontend to family B. Family B, D, E are left
untouched — out of scope.

The underlying business object stays owned by Tasks (`MW-01..03`,
`CODE_GO_FROZEN`): Calendar continues to be a **projection**, not an owner,
matching `MY_WORK_CALENDAR_REVIEW.md` §1 ("Kalendarz nie jest właścicielem
taska"). No new table, no new owner service.

## 3. Golden flow selected (smallest complete vertical)

Per the task's own fallback rule ("Jeśli create nie jest częścią istniejącego
kanonicznego systemu, wybierz update/assignment flow"): **create** is
fragmented across 4 systems and its payload types have no `projectId` field in
any family — not canonical. **Update (drag/reschedule of an existing task's
calendar deadline)** *is* canonical, single-owned, and already real-mutation.

Chosen flow — **"Reschedule a task's calendar deadline with visible
project/provider lineage and a real conflict guard"**:

1. User opens Calendar from My Work (`/my-work/calendar`, already live).
2. `GET /api/v8/my-work/calendar/unified` returns events **augmented with**
   `projectId`/`projectName` (join to `projects`) and an honest
   `provider: 'internal'` marker for `source:'task'` items (no fake
   Google/Outlook claim — matches task's explicit allowance for honest
   manual/internal marker).
3. UI shows a project chip + "Internal" provider badge on each task event
   (new — currently absent per frontend discovery §4).
4. User drags the event to a new day → `PUT
   /api/v8/my-work/calendar/events/task/:taskId` with
   `{ dueDate, expectedUpdatedAt }`.
5. Backend: session-derived `organizationId`/`userId` (already true), adds
   fail-closed check that the task's `project_id` still resolves inside the
   caller's org (404 otherwise, no existence leak), and a real optimistic
   guard: `UPDATE tasks SET due_date=?, updated_at=now() WHERE id=? AND
   organization_id=? AND updated_at=$expectedUpdatedAt`. Zero affected rows +
   row exists ⇒ `409` with the fresh row; zero affected rows + row missing/
   wrong org ⇒ `404`.
6. UI shows success (toast + settled position) only after the PUT resolves
   200; on 409 it reverts the drag, shows the server's current date, and
   offers "Reload" (no silent overwrite); on 404/403 explicit copy.
7. GET/read-back: unified feed re-fetch (and a fresh page load / deep link to
   `/my-work/calendar?date=...`) shows the same `taskId` at the new date.
8. Timezone/day-boundary: `tasks.due_date` is `timestamp without time zone` —
   treated as a calendar-date value. Fix the existing date serialization so a
   drag to "March 5" always persists and reads back as March 5 regardless of
   the browser's UTC offset (the exact class of bug flagged in memory from
   FIN-005: local-midnight vs UTC-getter day-shift).

Out of scope for this package (explicitly, to avoid scope creep): OAuth
connect flows, Google/Microsoft real sync, family B cutover, create-flow
project picker, meeting RSVP, CalDAV, capacity/day-load redesign, event
detail drawer.

## 4. Read/write contract

- Read: `GET /api/v8/my-work/calendar/unified` (existing) — response item gains
  `projectId: string | null`, `projectName: string | null`,
  `provider: 'internal' | 'google' | 'microsoft'` (only `'internal'` is real
  today for `source:'task'`; other values remain honestly unreachable, not
  fabricated).
- Write: `PUT /api/v8/my-work/calendar/events/task/:taskId` (existing route,
  extended body: adds required `expectedUpdatedAt: string` (ISO timestamp of
  the row the client last read). Response on success includes the new
  `updatedAt` so the client can re-arm the next drag.
- Errors: `403` (not assignee/owner and not org admin), `404` (wrong org or
  task not found — same body for both, no existence leak), `409` (version
  mismatch, body includes fresh `dueDate`/`updatedAt`/`projectId`).

## 5. File ownership (single writer per file)

- Backend: `server/src/routes/v8/my-work.routes.ts` (PUT handler only, lines
  ~2533-2628), `server/src/routes/v8/__tests__/my-work-calendar.routes.test.ts`,
  new real-PG test file
  `server/src/routes/v8/__tests__/mw-007-calendar-reschedule.realpg.test.ts`.
- Frontend: `src/components/MyWork/Calendar/CalendarGrid.tsx`,
  `CalendarView.tsx`, `calendarTypes.ts`, `src/services/api/v8/my-work.ts`
  (only the `updateCalendarEvent`/`getCalendarUnified` exports), `api.ts`
  (only the corresponding wrapper functions), new component test
  `tests/components/MyWork/CalendarGrid.lineage-conflict.test.tsx`.
- No edits to `server/src/routes/my-work/calendar.routes.ts` (family A),
  `v8/calendar.routes.ts`/`calendarInteropService.ts` (family B),
  `integrations/calendarIntegrations.routes.ts` (family D),
  `settings.routes.ts` (family E), or `my-work.routes.ts` monolith (only its
  existing mount is used, not touched).
- Explicitly not touched: `execution-control.routes.ts`, `inboxTriageService.ts`,
  `managerActionExecutionService.ts` (all also write `tasks.due_date`/
  `decisions.deadline` — they keep writing without `expectedUpdatedAt`; adding
  the optional column check to the PUT route does not change their behavior
  since they don't call this route).

## 6. Explicitly out of scope / no-touch (other lines)

FIN-05, MAT-10, EXE-08 (frozen), INT-08 (frozen + correction in flight),
TLS-04 (frozen, per instruction not to reopen). Grep confirmed zero calendar
references in `finance*.routes.ts`, `interview.routes.ts`, `teresa.routes.ts`.
No file overlap identified with those lines' owned files.

## 7. Collision watch

`tasks.due_date` is also written by `execution-control.routes.ts:1049-1060,1173-1184`,
`inboxTriageService.ts`, `managerActionExecutionService.ts`. These do not
route through the endpoint being hardened, so no behavior change for them;
noted here so a future version-column migration on `tasks` (if ever proposed)
knows all writers.
