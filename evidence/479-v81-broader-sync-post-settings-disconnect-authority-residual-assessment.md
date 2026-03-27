# V8.1 Evidence - Broader Sync post-settings disconnect authority residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twenty-fifth broader-sync packet landed, the user-level settings surface no longer owned fake connect, readback, or disconnect truth.

The next question was whether broader settings lifecycle cleanup should be promoted as a bundle, or whether one thinner seam still remains before that wider step.

## What was checked

1. What is already aligned on the settings surface:
   - `server/src/routes/settings.routes.ts`
   - `GET /api/settings/integrations` now surfaces governed sync truth
   - `POST /api/settings/integrations/:provider/connect` now reuses governed connect initiation
   - `DELETE /api/settings/integrations/:provider` now reuses governed disconnect ownership

2. What still remains split-brained:
   - `server/src/routes/settings.routes.ts`
   - `GET /api/settings/integrations/:provider/status` still reads only preferences-backed shadow rows
   - `PUT /api/settings/integrations/:provider/config` still mutates only preferences-backed config shadow
   - `POST /api/settings/integrations/:provider/test`, `POST /api/settings/integrations/:provider/refresh`, and `GET /api/settings/integrations/:provider/logs` still remain stubbed or outside governed sync ownership

3. Which remaining seam is still thinner than the broader bundle:
   - `src/hooks/useUserIntegrations.ts`
   - `getConnectionStatus()` already has a dedicated route contract on the settings surface
   - aligning `GET /api/settings/integrations/:provider/status` to the governed settings readback is a single-route read continuity step
   - this is smaller than bundling config mutation plus test/refresh/logs behavior, which mixes multiple contracts and stub semantics

4. Why the broader cleanup is still wider:
   - `config`, `test`, `refresh`, and `logs` do not collapse into one shared tiny fix
   - they span both mutation and readback behavior and would require deciding how much governed behavior should be exposed from settings at once

## Assessment result

One thinner settings-lifecycle seam still remains before broader cleanup.

That seam is `settings` status readback continuity.

Why:

- it is a single existing route contract
- it still reads stale preferences-backed shadow truth after connect/readback/disconnect were already moved to governed ownership
- it is narrower than the remaining mixed `config` / `test` / `refresh` / `logs` bundle

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `settings` status readback continuity on the governed sync path.
