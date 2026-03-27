# V8.1 broader Sync auth-break escalation continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: eleventh bounded packet after broader-lane promotion

## Why this packet

After run-now refresh preflight honesty landed, the governed runtime path could already detect auth-break conditions and block stale sync runs, but the active auth escalation panel still had no real producer on the sync path.

That meant:

- the active hub could show `requires_reauth` and preflight blocks,
- the repo already had governed escalation read + resolve surfaces,
- but no broader sync packet actually created unresolved auth escalations when auth-break truth became real.

This was a thinner and more honest packet than pretending full refresh execution or broader recovery workflow already existed.

## What changed

### Governed auth-break escalation creation

- updated `server/src/services/v8/pmSyncAuthService.ts`
- added `recordAuthEscalation()` with unresolved-escalation deduplication per connector and organization
- existing active unresolved escalation is reused instead of silently multiplying duplicate recovery work items

### Sync-path escalation continuity

- updated `server/src/routes/v8/sync.routes.ts`
- auth-break refresh-result recording now creates governed auth escalation truth for `credential_expired` and `scope_revoked`
- expired sync preflight blocks now create governed auth escalation truth at the same time they move connector auth state to `degraded_reauth_needed`
- audit entries now include the created escalation reference

### Active hub readback

- existing `UnifiedSyncHub` escalation panel now receives real runtime feed from broader sync auth-break events
- regression coverage proves that an auth-break refresh-result action can now surface the escalation inside the active `Sync Health` tab

## Regression coverage

Passed:

- `server/src/services/v8/__tests__/pmSyncAuthService.test.ts`
- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/services/v8/__tests__/pmSyncAuthService.test.ts server/src/routes/v8/__tests__/sync.routes.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `129` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity instead of preflight blocking plus manual refresh-result recording
- broader auth-break recovery continuity after escalation truth exists on the active runtime path
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
