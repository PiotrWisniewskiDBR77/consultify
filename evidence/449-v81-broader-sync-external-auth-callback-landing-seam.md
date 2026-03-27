# V8.1 broader Sync external auth callback landing seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: sixth bounded packet after broader-lane promotion

## Why this packet

The post-reauth residual assessment confirmed that no thinner honest packet remained before explicit external authorization callback continuity.

That left the next smallest real gap on the active broader-sync path:

- governed connect/config/reauth flows could now prepare operators for external auth
- but the repo still had no sync-specific callback landing seam that could receive the return and move runtime truth past raw `pending_external_auth`
- this meant the active hub could initiate onboarding truthfully, but not record callback arrival truthfully once the provider returned control

This packet lands the first shared callback-return seam without pretending full provider token exchange, refresh, or ready-state recovery already exists.

## What changed

### Governed session preparation continuity

- added `server/src/services/syncExternalAuthSessionService.ts`
- updated `server/src/routes/v8/sync.routes.ts`
- governed pending-config completion and governed reauth now issue a bounded external-auth session with a callback URL
- governed pending-config completion now moves OAuth connectors into `connecting` truth when all required setup is saved and external auth can actually begin

### Public callback landing continuity

- updated `server/src/routes/syncHub.routes.ts`
- added public `GET /api/sync-hub/external-auth/callback`
- callback landing now consumes the issued sync auth session, records audit, and transitions connector auth truth to `connected_pending_verification`
- the callback route returns a simple operator-facing confirmation page instead of pretending the integration is already fully healthy

### Governed readback and active surface continuity

- updated `server/src/services/v8/pmSyncInventoryService.ts`
- updated `src/services/api/v8/sync.ts`
- updated `src/components/Admin/UnifiedSyncHub.tsx`
- governed inventory now exposes `authorization_callback_received_pending_verification` when callback landing has happened but verification is still incomplete
- the active hub now shows the prepared callback URL while external auth is pending and switches to honest callback-received verification messaging after the callback lands

## Regression coverage

Passed:

- `server/src/routes/v8/__tests__/sync.routes.test.ts`
- `server/src/routes/__tests__/syncHub.routes.test.ts`
- `tests/unit/services/v8-sync-api.test.ts`
- `tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Verification command:

`npx vitest run server/src/routes/v8/__tests__/sync.routes.test.ts server/src/routes/__tests__/syncHub.routes.test.ts tests/unit/services/v8-sync-api.test.ts tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Result: `61` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- post-callback verification / ready-state promotion continuity after `connected_pending_verification`
- post-auth refresh / recovery continuity once callback completion can be verified end-to-end
- deeper authority alignment between governed `v8`, legacy `sync-hub`, canonical org-level `/api/integrations`, and user-level settings integrations
