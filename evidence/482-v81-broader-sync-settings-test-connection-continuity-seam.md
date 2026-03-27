# V8.1 broader Sync settings test connection continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: thirty-second bounded packet after broader-lane promotion

## Why this packet

After the post-settings-status assessment, the thinnest remaining live settings-lifecycle gap was the dedicated test connection route.

That seam was still dishonest because:

- the settings UI actively called `POST /api/settings/integrations/:provider/test`,
- the route still returned stubbed success regardless of actual governed connector truth,
- and that meant users could be told a connection was working even while the governed integration was only pending or otherwise not healthy enough to test.

This made settings test connection continuity the next honest bounded packet before broader settings cleanup.

## What changed

### Settings test connection now uses governed truth

- updated `server/src/routes/settings.routes.ts`
- `POST /api/settings/integrations/:provider/test` now reads the same effective governed-over-legacy settings integration envelope instead of returning unconditional success
- the route now returns `404` when the integration is not connected on the effective settings surface
- the route now returns `409` with a real error when the integration is still pending or otherwise not healthy enough to test
- the route returns success only when the effective settings integration is actually active

### Focused regression was extended

- updated `server/src/routes/__tests__/settings.routes.test.ts`
- added focused coverage proving that the settings test route no longer returns stubbed success and now reflects governed pending vs active truth

### Scope stayed bounded

- no settings config continuity was attempted
- no settings refresh continuity was attempted
- no settings logs continuity was attempted
- no wider remaining settings cleanup bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/routes/__tests__/settings.routes.test.ts`

Verification command:

`npx vitest run server/src/routes/__tests__/settings.routes.test.ts`

Result: `5` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more thinner settings-lifecycle seam remains after test continuity
- deeper authority alignment still remains across settings `config`, `refresh`, and `logs`
