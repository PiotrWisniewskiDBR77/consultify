# 487 - broader Sync settings config authority continuity seam

Date: 2026-03-28
Lane: broader `Sync` completion
Packet: twenty-ninth real bounded packet
Status: landed

## Why this packet existed

After settings connect, disconnect, status, test, and logs continuity were aligned with the governed sync path, the smallest remaining settings-lifecycle mutation seam was `PUT /api/settings/integrations/:provider/config`.

That route still updated only the local `user_preferences` shadow and never advanced governed connector configuration truth or prepared external auth when a pending connector became fully configured.

## What changed

- aligned `PUT /api/settings/integrations/:provider/config` with the effective governed settings integration instead of only the local preferences shadow
- merged only connector-declared config fields into the real `integrations.config` payload
- recomputed governed `configuredFields` and `onboardingStatus` on the settings surface
- prepared governed external auth when OAuth configuration becomes complete, returning the real `authUrl`
- kept the old local-preferences fallback only for non-governed / legacy-only settings entries
- added focused regression coverage in `server/src/routes/__tests__/settings.routes.test.ts`

## Verification

- `npm exec vitest run server/src/routes/__tests__/settings.routes.test.ts`
- `ReadLints` on `server/src/routes/settings.routes.ts` and `server/src/routes/__tests__/settings.routes.test.ts` returned no diagnostics

## Result

The settings integrations surface no longer pretends config mutation succeeded by writing only a local shadow copy.

For governed connectors, config updates now advance the real connector configuration state and return the same pending-to-external-auth truth the governed sync path expects.

## Remaining residual

The next honest broader-sync assessment is no longer "settings config is shadow-only".

What remains should now be reassessed between:

- one final thinner settings-lifecycle mutation seam around `POST /api/settings/integrations/:provider/refresh`, or
- a wider mutation bundle only if that refresh path cannot be cleanly isolated on its own.
