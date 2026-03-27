# V8.1 Evidence - Broader Partner Client Access Clients List Read V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After enterprise onboarding completion moved onto the governed partner seam, the next honest residual assessment showed that `payout-settings` was still placeholder-only save UI and `statement-source` did not map to an active partner-portal surface.

That left broader `client-access` as the next real lane, but it was still too heavy to take whole.
The smallest honest split inside it was the shared client-organizations read:

- the same placeholder-only legacy `/api/partners/clients` route fed both `ClientAccessView` and the live partner-portal `ClientsSection`
- the read can be derived from existing partner attribution truth without pretending that employee management, access links, or project continuity already exist
- it replaces a dead operator-visible list seam while keeping heavier `client-access` mutations and detail breadth explicitly out of scope

## What changed

1. Added a shared partner client read model in `server/src/services/partnerReferralService.ts`:
   - maps existing partner attributions onto operator-visible client rows
   - reuses real partner attribution truth instead of placeholder demo payloads

2. Restored legacy read continuity in `server/src/routes/partners.routes.ts`:
   - `GET /api/partners/clients` now returns a real partner-scoped client list
   - broader `POST /api/partners/clients` and `GET /api/partners/clients/:clientId` remain explicitly unavailable

3. Added a governed V8 read route in `server/src/routes/v8/partner.routes.ts`:
   - `GET /api/v8/partner/clients`
   - returns the same partner-scoped client list with governed partner meta

4. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.getClients()`

5. Rewired both active frontend consumers:
   - `src/views/partner/ClientAccessView.tsx` now prefers `V8PartnerApi.getClients()` with bounded fallback to legacy `/api/partners/clients`
   - `src/views/partner/PartnerPortalView.tsx` now does the same for the live `ClientsSection`

6. Refreshed stale integration coverage in `tests/integration/clients/client-endpoints.test.ts`:
   - real read path is now asserted as `200`
   - still-placeholder create/detail paths are asserted as `503`

## Regression coverage

Passed targeted regressions:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/ClientAccessView.v8-clients.test.tsx`
- `tests/components/partner/PartnerPortalView.v8-clients.test.tsx`
- `tests/integration/clients/client-endpoints.test.ts`

Run:

```bash
npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/ClientAccessView.v8-clients.test.tsx tests/components/partner/PartnerPortalView.v8-clients.test.tsx tests/integration/clients/client-endpoints.test.ts
```

Result: `47` tests passed.

## Remaining residuals

This packet does not close:

- broader `client-access` employee list, access-link generation, project continuity, or client detail/write breadth
- broader statement-source migration
- placeholder-only partner `payout-settings` save continuity

## Outcome

The active partner client-organizations list no longer depends on a placeholder-only legacy route during normal operation.
Both visible client-access read surfaces now use a governed partner V8-first seam with bounded legacy fallback, while the heavier rest of `client-access` remains explicitly queued as broader breadth.
