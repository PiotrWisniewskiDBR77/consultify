# V8.1 broader Sync settings status readback continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Taxonomy: `T4`
Packet: thirtieth bounded packet after broader-lane promotion

## Why this packet

After the post-settings-disconnect assessment, the thinnest remaining settings-lifecycle split-brain was the single-route status readback contract.

That seam was still dishonest because:

- `GET /api/settings/integrations/:provider/status` still read only preferences-backed shadow truth,
- while settings list, connect, and disconnect had already moved to the governed sync path,
- so the dedicated status endpoint could still disagree with the rest of the now-governed settings surface.

This made settings status readback continuity the next honest bounded packet before any wider cleanup of settings `config`, `test`, `refresh`, or `logs`.

## What changed

### Settings status readback now reuses governed truth

- updated `server/src/routes/settings.routes.ts`
- added a shared helper to load the effective settings integrations envelope from governed integrations plus legacy fallback shadow rows
- `GET /api/settings/integrations/:provider/status` now reuses that same governed-over-legacy readback instead of reading only `loadIntegrations()`
- the dedicated status route now stays consistent with settings list/connect/disconnect truth

### Focused regression was extended

- updated `server/src/routes/__tests__/settings.routes.test.ts`
- added focused coverage proving that the settings status route now returns governed pending truth instead of stale preferences-backed status

### Scope stayed bounded

- no settings config continuity was attempted
- no settings test/refresh/logs continuity was attempted
- no broader settings cleanup bundle was mixed into the same packet

## Regression coverage

Passed:

- `server/src/routes/__tests__/settings.routes.test.ts`

Verification command:

`npx vitest run server/src/routes/__tests__/settings.routes.test.ts`

Result: `4` tests passing.

## Residual after this packet

Broader `Sync` completion is still not done.

Remaining honest residuals include:

- assessing whether one more thinner settings-lifecycle seam remains after status continuity
- deeper authority alignment still remains across settings `config`, `test`, `refresh`, and `logs`
