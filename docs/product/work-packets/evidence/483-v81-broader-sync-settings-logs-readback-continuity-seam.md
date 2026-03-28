# 483 - broader Sync settings logs readback continuity seam

Date: 2026-03-27
Lane: broader `Sync` completion
Packet: twenty-eighth real bounded packet
Status: landed

## Why this packet existed

After settings connect, disconnect, status, and test continuity were aligned with the governed sync path, the smallest remaining readback seam on the settings lifecycle surface was `GET /api/settings/integrations/:provider/logs`.

That route still returned a stubbed empty payload instead of resolving the effective integration and reading real `integration_sync_log` rows.

## What changed

- added governed-effective log readback to `server/src/routes/settings.routes.ts`
- resolved the effective settings integration for the requested provider before reading logs
- reused the canonical sync-log shape already exposed by org-level integrations routes
- returned `404` when the provider is absent from effective settings instead of pretending the provider exists
- added focused regression coverage in `server/src/routes/__tests__/settings.routes.test.ts`

## Verification

- `npm exec vitest run src/routes/__tests__/settings.routes.test.ts`
- `ReadLints` on the changed route and test files returned no diagnostics

## Result

The settings integrations surface no longer hardcodes `{ logs: [] }` for governed providers.

It now returns the same sync-log truth shape that the canonical integrations path already exposes, which removes one more user-level settings split-brain seam without expanding scope into refresh or config mutation work.

## Remaining residual

The next honest broader-sync assessment is no longer "logs are stubbed".

What remains should be reassessed between:

- one thinner settings-lifecycle seam still hiding behind `refresh` or `config`, or
- a wider settings `config` / `refresh` mutation bundle if no smaller seam remains.
