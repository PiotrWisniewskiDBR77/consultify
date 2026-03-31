# P02 Calendar Interoperability — Verified Closeout

**Date:** 2026-03-31  
**Status:** `verified(evidence)`  
**Branch:** `ws/c-artifact-evidence`

## Scope delivered

### P02-A — Calendar Interop canon (calendarInteropCanon.ts)
- 3 declared providers: Google (read/write/bidir), Microsoft (read/write/bidir), CalDAV (read-only) — §2.3.1
- Recurrence doctrine: series-master-not-instance, no instance explosion, window_only materialization — §2.3.3
- Conflict-safe writes model: conditional writes required, conflict is product state, no silent overwrite — §2.3.4
- 4 permission gradients: free_busy → read → write → delegate with UI rules — §2.3.5
- 5 lifecycle states: connected, degraded, requires_action, blocked, recoverable with transition matrix — §2.3.6
- Recovery steps for 5 error classes (oauth_expired, scope_revoked, cursor_invalid, rate_limited, permanent_auth_failure) — §2.3.6
- 3 anti-duplicate rules — §2.3.7
- 8 error posture scenarios with source/item state + recovery — §2.3.8
- 11-point acceptance checklist (all testable) — §2.3.9

### P02-B — Calendar Interop service (calendarInteropService.ts)
- Source CRUD: create/get/getAll/update lifecycle/delete with org-scoped isolation
- Item CRUD: create/get/getAll/update with etag-based conditional writes
- `computeEffectiveMode`: derives effective mode from declared mode × permission gradient × lifecycle state
- `performIncrementalSync`: skips blocked/requires_action, updates cursor + processes pending items
- `performFullResync`: resets checkpoint (cursor=null), sets all items to in_sync, transitions to connected
- `conditionalWriteItem`: etag mismatch → conflict state; match → update with new etag
- `resolveConflict`: accept_local→pending, accept_remote→in_sync, merge→pending
- `handleSyncError`: maps provider error type → lifecycle state transition
- `mapProviderError`: 12 known error types + default fallback mapping
- `getSourceHealth`: aggregates lifecycle states per organization

### P02-C — Evidence + verification
- 62 integration tests covering canon constants + all service functions
- Migration: `20260331_v8_calendar_interop_p02b.sql`
- Routes: `calendar.routes.ts` registered in v8 index

## Tests (62 total)

| File | Count | What |
|------|-------|------|
| `server/src/routes/v8/__tests__/p02-calendar-interop.test.ts` | 9 | Canon frozen constants (checklist, providers, recurrence, conflict, permissions, lifecycle, transitions, anti-duplicate, error posture) |
| | 16 | `computeEffectiveMode` — all declared×perm×lifecycle combinations |
| | 2 | `createCalendarSource` — defaults + read-back failure |
| | 2 | `updateSourceLifecycle` — transition + not-found |
| | 4 | `performIncrementalSync` — blocked skip, requires_action skip, connected process, not-found |
| | 2 | `performFullResync` — checkpoint reset, blocked skip |
| | 3 | `conditionalWriteItem` — etag mismatch conflict, etag match success, not-found |
| | 5 | `resolveConflict` — accept_local, accept_remote, merge, non-conflict noop, not-found |
| | 4 | `handleSyncError` — token_expired, rate_limited, sync_token_invalid, calendar_deleted |
| | 13 | `mapProviderError` — 12 known errors + unknown fallback |
| | 2 | `getSourceHealth` — multi-state aggregation + empty org |

## §2.3.9 Acceptance checklist

1. [x] **AC-01** Provider list closed to: Google/Microsoft/CalDAV — `P02_DECLARED_PROVIDERS` has exactly 3 keys, no "other external" bypass
2. [x] **AC-02** Each provider has explicit read/write/bidir declaration — `P02_DECLARED_PROVIDERS` entries have `read`, `write`, `bidir` booleans + `notes`
3. [x] **AC-03** CalendarSource has lifecycle + permissionGradient + declaredMode ≠ effectiveMode — `computeEffectiveMode` tested with 16 combinations
4. [x] **AC-04** CalendarItem stores durable external identity — `sourceObjectRef` + `sourceSystem` fields in CalendarItem interface
5. [x] **AC-05** Recurrence: series/instance/exception distinguished — `RecurrenceModel` has `seriesMasterRef`, `exceptions` with `modified`/`cancelled`
6. [x] **AC-06** No instance explosion — `P02_RECURRENCE_DOCTRINE.materializationRule === 'window_only'`
7. [x] **AC-07** Conditional writes required — `conditionalWriteItem` enforces etag check; `P02_CONFLICT_WRITES_MODEL.conditionalWritesRequired === true`
8. [x] **AC-08** Conflict is product state — etag mismatch sets `syncState='conflict'`; `P02_CONFLICT_WRITES_MODEL.conflictIsProductState === true`
9. [x] **AC-09** Permission gradients respected — `computeEffectiveMode` downgrades bidir/write to read when permission < write
10. [x] **AC-10** Source lifecycle visible with recovery — `P02_LIFECYCLE_STATES` (5), `P02_RECOVERY_STEPS` (5), `handleSyncError` maps errors to states
11. [x] **AC-11** Anti-duplicate gate — `P02_ANTI_DUPLICATE_RULES` (3 rules); single-writer per provider+account pair per org

## Known limits

- **Provider API adapters** not in P02 scope — service provides the contract; actual Google/Microsoft/CalDAV HTTP calls are downstream
- **UI consumer** not in P02 scope — API-first delivery
- **Recurrence materialization** is contract-only; actual window-based expansion requires provider adapter implementation
