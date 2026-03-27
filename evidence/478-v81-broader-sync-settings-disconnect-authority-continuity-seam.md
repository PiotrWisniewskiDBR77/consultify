# V8.1 broader Sync settings disconnect authority continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: twenty-eighth bounded packet after broader-lane promotion

## Why this packet

After the post-settings assessment, the thinnest remaining active settings-lifecycle split-brain was the disconnect mutation.

That seam was still dishonest because:

- the settings UI still exposes a live Disconnect action,
- `DELETE /api/settings/integrations/:provider` only removed preferences-backed shadow rows,
- and the real governed integration row remained connected on the governed sync path.

This made settings disconnect authority continuity the next honest bounded implementation step before any broader settings lifecycle cleanup.

## What changed

### Settings disconnect now reuses the governed sync path

- updated `server/src/routes/settings.routes.ts`
- `DELETE /api/settings/integrations/:provider` now looks up the active governed integration row for the provider on the current organization
- when a governed connector row exists, the route now reuses `disconnectIntegration()` from the governed integration service instead of pretending preferences deletion alone disconnected the integration
- the route still removes the legacy preferences shadow entry for the provider so the settings surface does not retain stale local residue

### Focused regression was extended

- updated `server/src/routes/__tests__/settings.routes.test.ts`
- added focused coverage proving that the settings disconnect route now delegates to governed disconnect authority and clears the shadow preferences row

### Scope stayed bounded

- no settings status continuity was attempted
- no settings config/test/refresh/logs continuity was attempted
- no wider settings lifecycle bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/routes/__tests__/settings.routes.test.ts`

Verification command:

`npx vitest run server/src/routes/__tests__/settings.routes.test.ts`

Result: `3` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more thinner settings-lifecycle seam remains after disconnect continuity
- deeper authority alignment still remains across settings `status`, `config`, `test`, `refresh`, and `logs`
