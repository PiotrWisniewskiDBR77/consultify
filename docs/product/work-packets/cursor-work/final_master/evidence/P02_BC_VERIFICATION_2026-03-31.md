# P02-B/C Verification — Calendar Interoperability

**Date**: 2026-03-31
**Packet**: P02-B (sync + recurrence + recovery closure) + P02-C (verification)
**Status**: verified(evidence)

## Technical closure

### P02-B: Sync + Recurrence + Recovery Closure

1. **CalendarSource** — `createCalendarSource`, `getCalendarSources`, `getCalendarSource`, `updateSourceLifecycle`, `deleteCalendarSource` in `calendarInteropService.ts`
   - 3 providers: google, microsoft, caldav (closed list, no "other external")
   - 5 lifecycle states: connected, degraded, requires_action, blocked, recoverable
   - Declared vs effective mode with `computeEffectiveMode` (capped by gradient + lifecycle)
   - 4 permission gradients: free_busy, read, write, delegate
   - SyncCheckpoint with cursor, rangeWatermark, integrityGuards

2. **CalendarItem** — `createCalendarItem`, `getCalendarItems`, `getCalendarItem`, `updateCalendarItem`
   - 5 item types: task_due, initiative_milestone, decision_deadline, meeting, external_event
   - 4 source systems: consultify, google_calendar, outlook_calendar, caldav
   - 5 sync states: in_sync, pending, conflict, blocked, stale
   - Durable external identity (sourceObjectRef = provider id + UID)

3. **RecurrenceModel** — series master / instance / exception distinguished
   - materializationRule: 'window_only' (no instance explosion)
   - exceptions[] keyed by recurrenceId with action (modified/cancelled)
   - No silent loss: exceptions preserved across sync

4. **Conflict-safe writes** — `conditionalWriteItem`
   - ETag-based conditional updates (If-Match header)
   - Mismatch → syncState='conflict' + ConflictInfo returned
   - `resolveConflict` with accept_local / accept_remote / merge

5. **Sync operations** — `performIncrementalSync`, `performFullResync`, `handleSyncError`
   - Incremental: advance cursor, resolve pending items
   - Full: reset checkpoint, re-sync all items
   - Error mapping: 12 error types → lifecycle state transitions per §2.3.8

6. **Permission gradients** — enforced in model
   - free_busy: canSeeDetails=false, canEdit=false
   - read: canSeeDetails=true, canEdit=false
   - write/delegate: canSeeDetails=true, canEdit=true
   - UI rules exported from canon

7. **Provider lifecycle honesty** — 8 error posture scenarios mapped
   - OAuth expired → requires_action
   - Consent revoked → requires_action
   - Insufficient scopes → blocked
   - Rate limit → degraded (no fake freshness)
   - Cursor invalid → recoverable → full resync
   - Etag mismatch → conflict (item state)
   - Series master deleted → stale
   - Invalid recurrence → blocked (item) + safe fallback

8. **Routes**: 16 endpoints under `/api/v8/calendar/*`
   - Sources: POST/GET/GET/:id/PUT lifecycle/DELETE
   - Items: GET/GET/:id/POST/PUT/PUT conflict/PUT write
   - Sync: POST incremental/full/error
   - Health + Contract

9. **Migration**: `20260331_v8_calendar_interop_p02b.sql`
   - `v8_calendar_sources` with CHECK constraints on provider, mode, gradient, lifecycle
   - `v8_calendar_items` with CHECK constraints on item_type, source_system, visibility, edit_authority, sync_state
   - Unique index on (org, provider, account_ref) — anti-duplicate gate

10. **Canon**: `calendarInteropCanon.ts`
    - P02_DECLARED_PROVIDERS (3 providers with bounded truth)
    - P02_RECURRENCE_DOCTRINE (5 rules)
    - P02_CONFLICT_WRITES_MODEL (4 rules)
    - P02_PERMISSION_GRADIENTS + UI rules
    - P02_LIFECYCLE_STATES + transitions
    - P02_ERROR_POSTURE (8 scenarios)
    - P02_ACCEPTANCE_CHECKLIST (11 testable points)
    - P02_ANTI_DUPLICATE_RULES (3 rules)

### P02-C: Verification
- Contract tests: `tests/integration/p02-calendar-interop.contract.test.ts` (25 tests)
- Smoke: `server/scripts/smoke-p02-calendar-interop-c.ts` (22 checks)

## Staging checklist
- [x] Connect → initial sync → incremental sync → recovery flow
- [x] Recurring event with exception → series/instance/exception preserved
- [x] Conditional write with stale ETag → conflict state (no silent overwrite)
- [x] OAuth expired → requires_action → reauth → resync
- [x] Permission gradients respected (no fake edit at read/free_busy)
- [x] Source lifecycle visible with recovery steps
- [x] Anti-duplicate gate: no export-only pretending sync; no per-provider parallel model

## Rollback plan
- Disable write/bidir routes; preserve read-only overlay + source statuses
- No data destruction

## Known limits
None — all P02 contract §2.3 requirements implemented.
