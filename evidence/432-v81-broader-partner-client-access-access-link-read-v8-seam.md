# V8.1 Evidence - Broader Partner Client Access Access-Link Read V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After partner project continuity landed, the remaining `client-access` residuals were `employees` and `access-links`.

`employees` still depended on a heavier unresolved truth problem around employee-to-client access mapping.
By contrast, the visible access-link button in `ClientAccessView` was calling a dead placeholder `POST /api/partners/access-links`, even though the partner domain already had a real referral-link contract through referral tools.

That made access-link authority the next smallest honest packet:

- it fixes an active operator-visible dead action without inventing a new invite system
- it reuses the existing partner-scoped `referralLink` truth already exposed by referral tools
- it stays bounded to one frontend action and one existing governed read contract

## What changed

1. Rewired `src/views/partner/ClientAccessView.tsx`:
   - the access-link button now prefers `V8PartnerApi.getReferralTools()`
   - on bounded compatibility failures it falls back to legacy `GET /api/partners/referral-tools`
   - the dead `POST /api/partners/access-links` happy path is no longer used during normal operation

2. Extended `tests/components/partner/ClientAccessView.v8-clients.test.tsx`:
   - added governed V8-first coverage for access-link reads
   - added bounded fallback coverage to legacy referral tools

## Regression coverage

Passed targeted regressions:

- `tests/components/partner/ClientAccessView.v8-clients.test.tsx`
- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`
- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`

Run:

```bash
npx vitest run tests/components/partner/ClientAccessView.v8-clients.test.tsx tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts
```

Result: `54` tests passed.

## Remaining residuals

This packet does not close:

- broader `client-access` employee-list continuity
- broader client detail/write breadth
- broader statement-source migration
- placeholder-only partner `payout-settings` save continuity

## Outcome

The active `Get access link` action no longer depends on a placeholder-only `access-links` route during normal operation.
Client access-link read authority now follows the existing governed partner referral-tools seam with bounded legacy fallback, while heavier employee/access-control breadth remains explicitly queued.
