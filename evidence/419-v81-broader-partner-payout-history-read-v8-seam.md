# V8.1 broader Partner payout history read V8 seam

Date: 2026-03-27
Lane: broader `Partner Program` parity
Taxonomy: `T4`
Packet: first bounded packet after broader-lane promotion

## Why this packet

The accepted bounded `Partner Program` lane already moved payout request, referral campaign create/delete,
and visible profile settings onto governed V8-first seams, but the live partner-authenticated portal still
loaded payout history from the legacy `GET /api/partners/payouts` route.

That legacy read is a real active residual:

- it backs the visible `Payout History` surface in `EarningsSection`
- it is rendered on both `partner?tab=earnings` and `partner?tab=payouts`
- live proof already showed the V8 earnings summary succeeding while the legacy payouts read returned `403`

This makes payout-history continuity the smallest honest first packet for broader `Partner Program` parity.

## What changed

### Governed V8 runtime parity

- added `GET /api/v8/partner/payouts` in `server/src/routes/v8/partner.routes.ts`
- the new route resolves `partnerOrgId` via `getActivePartnerOrgIdForUser(userId)`
- the route delegates to `PartnerCommissionService.getPayouts(...)`
- the response returns governed V8 meta alongside the payout list

### Shared client seam

- added `V8PartnerApi.getPayouts()` in `src/services/api/v8/partner.ts`
- exported the payout-history contract through `src/services/api/v8/index.ts`

### Active surface continuity

- updated `src/views/partner/sections/EarningsSection.tsx`
- payout-history reads now prefer `V8PartnerApi.getPayouts()` during normal operation
- fallback to legacy `Api.get('/api/partners/payouts')` remains bounded to compatibility statuses only
- statement history and wider partner breadth remain outside this packet

## Regression coverage

Passed:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/EarningsSection.v8-payout-request.test.tsx`

Verification command:

`npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/EarningsSection.v8-payout-request.test.tsx`

Result: `27` tests passing.

## Residual after this packet

Broader `Partner Program` parity is still not done.

Remaining honest residuals include:

- commission-statement history continuity still reading through legacy `commission-transactions`
- client-access onboarding/link generation breadth, which is still feature-unavailable rather than a thin missing seam
- broader onboarding, statement-source, and deeper partner workflow breadth
- placeholder-only `payout-settings` save behavior, which still lacks a real backend contract
