# V8.1 Evidence - Broader Sync post-settings connect/readback authority residual assessment

Lane: broader `Sync` completion
Date: 2026-03-27
Status: assessed

## Why this assessment was needed

After the twenty-fourth broader-sync packet landed, the user-level settings integrations surface no longer owned fake readback or fake connect initiation truth.

The next question was whether broader authority cleanup is now the next smallest honest step, or whether one thinner settings-lifecycle seam still remains before that wider bundle.

## What was checked

1. What the last packet already aligned:
   - `server/src/routes/settings.routes.ts`
   - `GET /api/settings/integrations` now surfaces governed sync truth
   - `POST /api/settings/integrations/:provider/connect` now creates pending governed truth and returns real provider auth when appropriate

2. What still remains split-brained on the same settings surface:
   - `server/src/routes/settings.routes.ts`
   - `DELETE /api/settings/integrations/:provider` still removes only preferences-backed rows through `loadIntegrations()` / `saveIntegrations()`
   - `PUT /api/settings/integrations/:provider/config`, `GET /api/settings/integrations/:provider/status`, and the stubbed `test` / `refresh` / `logs` routes still sit outside the governed sync authority path

3. Which remaining seam is actually active and thinner:
   - `src/hooks/useUserIntegrations.ts`
   - `src/components/settings/ConnectedAppsSettings.tsx`
   - the active settings UI still calls `DELETE /api/settings/integrations/:provider`
   - the disconnect action is visibly exposed on connected provider cards, making it a live user-facing mutation seam
   - this is thinner than bundling the broader settings lifecycle because it is a single governed authority mutation rather than a multi-route cleanup

4. Why broader settings-lifecycle cleanup is still wider:
   - remaining `config`, `status`, `test`, `refresh`, and `logs` gaps span multiple contracts and a mix of readback, mutation, and stubbed behavior
   - grouping all of them now would be broader than first closing the still-live disconnect authority mutation

## Assessment result

One thinner settings-lifecycle seam still remains before broader authority cleanup.

That seam is `settings` disconnect authority continuity.

Why:

- it is still actively exposed in the UI
- it still mutates only preferences-backed truth instead of governed sync ownership
- and it is smaller than a wider multi-route settings lifecycle cleanup packet

## Outcome

The lane remains active.

No implementation was landed in this assessment packet.
The next honest implementation step is to promote `settings` disconnect authority continuity on the governed sync path.
