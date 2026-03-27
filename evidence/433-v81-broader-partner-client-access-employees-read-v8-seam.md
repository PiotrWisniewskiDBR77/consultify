# V8.1 Evidence - Broader Partner Client Access Employees Read V8 Seam

Lane: broader `Partner Program` parity
Date: 2026-03-27
Status: landed

## Why this packet

After the client-access access-link authority packet landed, the last active `client-access` residual was the `employees` tab in `ClientAccessView`.

The full employee-to-client access matrix still has no clean runtime truth, so pretending to know per-client assignment counts would have been dishonest.
But a thinner employee roster seam did exist: `partner_users` already scoped partner team members, `users` already held identity data, and `user_sessions` plus `users.last_login` already exposed bounded activity readback.

That made this the next smallest honest packet:

- it restores the active employee tab without inventing write flows or assignment logic
- it reuses existing partner membership and user activity truth
- it keeps unknown client assignment counts explicit instead of silently rendering fake zeros

## What changed

1. Added a shared partner employee read model in `server/src/services/partnerReferralService.ts`:
   - derives a partner-scoped employee roster from `partner_users`
   - joins `users` for name/email and latest `user_sessions` activity for bounded `lastActive`
   - maps partner role/status into the roster contract while leaving `clientCount` unknown

2. Restored legacy read continuity in `server/src/routes/partners.routes.ts`:
   - `GET /api/partners/employees` now returns a real partner-scoped employee roster

3. Added a governed V8 read route in `server/src/routes/v8/partner.routes.ts`:
   - `GET /api/v8/partner/employees`
   - returns the same roster with governed partner meta

4. Extended `src/services/api/v8/partner.ts`:
   - added `V8PartnerApi.getEmployees()`

5. Rewired the active frontend consumer in `src/views/partner/ClientAccessView.tsx`:
   - employee reads now prefer the V8 employee seam
   - bounded compatibility failures still fall back to legacy `/api/partners/employees`
   - unknown assignment counts now render as `--` instead of implying a real `0`

6. Added bounded regressions:
   - V8 route/client coverage
   - active client-access employee-tab coverage
   - legacy integration coverage for `/api/partners/employees`
   - removed the obsolete unavailable-routes integration that no longer matched the current partner route surface

## Regression coverage

Passed targeted regressions:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/ClientAccessView.v8-clients.test.tsx`
- `tests/integration/clients/client-endpoints.test.ts`

Run:

```bash
npx vitest run tests/unit/services/v8-partner-api.test.ts tests/components/partner/ClientAccessView.v8-clients.test.tsx tests/integration/clients/client-endpoints.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts
```

Result: `55` tests passed.

## Remaining residuals

This packet does not close:

- broader employee-to-client assignment/write breadth
- broader client detail/write breadth
- broader statement-source migration
- placeholder-only partner `payout-settings` save continuity

## Outcome

The active partner `employees` tab no longer depends on a placeholder-only legacy route during normal operation.
Visible employee roster continuity now follows a governed partner V8-first read seam with bounded compatibility fallback, while heavier assignment and payout-settings breadth stays explicitly queued.
