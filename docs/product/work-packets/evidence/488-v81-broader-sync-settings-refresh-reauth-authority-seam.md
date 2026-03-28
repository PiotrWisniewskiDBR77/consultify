# 488 - broader Sync settings refresh reauth authority seam

Date: 2026-03-28
Lane: broader `Sync` completion
Packet: thirtieth real bounded packet
Status: landed

## Why this packet existed

After settings connect, disconnect, status, test, logs, and config continuity were aligned with the governed sync path, the thinnest remaining settings-lifecycle mutation seam was `POST /api/settings/integrations/:provider/refresh`.

That route still returned stubbed success without advancing any governed auth or integration truth.

## What changed

- aligned `POST /api/settings/integrations/:provider/refresh` with the effective governed settings integration instead of returning unconditional stubbed success
- reused governed connector config truth to determine whether re-authorization can actually start
- moved governed connectors into pending reauth state through the shared integration-status and connector-auth-state paths
- returned the real governed reauth `authUrl` when the connector is ready for external auth
- kept the old compatibility fallback only for non-governed / legacy-only settings entries
- added focused regression coverage in `server/src/routes/__tests__/settings.routes.test.ts`

## Verification

- `npm exec vitest run server/src/routes/__tests__/settings.routes.test.ts`
- `ReadLints` on `server/src/routes/settings.routes.ts` and `server/src/routes/__tests__/settings.routes.test.ts` returned no diagnostics

## Result

The settings integrations surface no longer pretends token refresh or reconnect started when nothing happened on the governed path.

For governed OAuth connectors, refresh now initiates the real re-authorization path and returns the external auth URL needed to continue recovery.

## Remaining residual

The next honest broader-sync assessment is no longer "settings refresh is stubbed".

What remains should now be reassessed between:

- acceptance review for the current settings-lifecycle slice if no thinner settings seam still remains, or
- promotion of a wider sync mutation bundle only if the remaining residual is no longer isolatable as one thinner packet.
