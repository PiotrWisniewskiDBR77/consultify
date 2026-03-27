# V8.1 broader Sync auth-break recovery initiation continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twelfth bounded packet after broader-lane promotion

## Why this packet

After auth-break escalation continuity landed, the active `Sync Health` panel could finally show real governed auth escalations, but operators still had to leave that recovery surface and switch back to the integration card to start governed re-authorization.

That meant:

- the active recovery panel could show the unresolved work,
- but it still could not initiate the bounded recovery step already available elsewhere on the governed path,
- so broader auth-break recovery truth remained split across two separate UI surfaces.

This was smaller and more honest than jumping straight to real refresh execution.

## What changed

### Active recovery-panel initiation

- updated `src/components/Admin/UnifiedSyncHub.tsx`
- active auth escalation cards now detect whether a governed oauth2 integration in `requires_reauth` state exists for the escalated connector
- when such a target exists, the panel now exposes `Start re-authorization` directly on the escalation card
- the action reuses the existing governed `reauth` flow instead of inventing a new recovery path

### Honest operator guidance

- escalation cards now explicitly tell operators whether governed re-authorization can start directly from the panel
- when no governed recovery target exists yet, the panel says so instead of implying hidden recovery affordances exist

## Regression coverage

Passed:

- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `16` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- real governed refresh execution continuity instead of preflight blocking plus manual refresh-result recording
- broader auth-break recovery continuity after initiation exists directly on the active recovery panel
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
