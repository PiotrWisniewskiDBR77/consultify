# V8.1 Evidence - Broader Sync post-settings status readback residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the thirtieth broader-sync packet landed, the settings surface no longer owned fake list, connect, disconnect, or status readback truth.

The next question was whether broader settings cleanup should now be promoted as a bundle, or whether one thinner live seam still remains before that wider step.

## What was checked

1. What is already aligned on the settings surface:
   - `server/src/routes/settings.routes.ts`
   - settings list readback is governed-over-legacy
   - settings connect initiation reuses the governed path
   - settings disconnect reuses the governed path
   - the dedicated settings status route now reuses the same effective governed readback

2. What still remains split-brained:
   - `server/src/routes/settings.routes.ts`
   - `POST /api/settings/integrations/:provider/test` is still a stub that always returns success
   - `PUT /api/settings/integrations/:provider/config` still mutates only preferences-backed config shadow
   - `POST /api/settings/integrations/:provider/refresh` and `GET /api/settings/integrations/:provider/logs` still remain outside governed sync ownership

3. Which remaining seam is still thinner than the broader bundle:
   - `src/components/settings/ConnectedAppsSettings.tsx`
   - `src/components/settings/UserIntegrations/index.tsx`
   - the settings UI actively invokes `testConnection(provider)` and surfaces the result to the user
   - that makes `POST /api/settings/integrations/:provider/test` a live single-route continuity gap
   - aligning this route is still smaller than bundling config mutation plus refresh/logs behavior together

4. Why the broader cleanup is still wider:
   - `config`, `refresh`, and `logs` span a mix of mutation, runtime behavior, and readback decisions
   - grouping all of them would be a broader multi-contract cleanup rather than one bounded seam

## Assessment result

One thinner settings-lifecycle seam still remains before broader cleanup.

That seam is `settings` test connection continuity.

Why:

- it is actively exposed in the UI today
- it is a single existing route contract
- it still returns stubbed success instead of governed connector truth
- it is narrower than the remaining mixed `config` / `refresh` / `logs` bundle

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `settings` test connection continuity on the governed sync path.
