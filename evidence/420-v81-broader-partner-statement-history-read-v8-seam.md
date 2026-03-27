# V8.1 broader Partner statement history read V8 seam

Date: 2026-03-27
Lane: broader `Partner Program` parity
Taxonomy: `T4`
Packet: second bounded packet after broader-lane promotion

## Why this packet

After payout-history continuity moved onto the governed V8 seam, the next smallest active residual inside the
live partner-authenticated portal was statement history continuity.

That residual was still real and active:

- the `Statements` view in `EarningsSection` still loaded commission rows from legacy
  `GET /api/partners/commission-transactions`
- the same active surface already rendered governed V8 earnings summary above the statement table
- the remaining client-access onboarding paths are feature-unavailable rather than a thin missing seam, so they
  are not smaller than statement-history continuity

This made commission-statement history the next honest broader-partner packet.

## What changed

### Governed V8 runtime parity

- added `GET /api/v8/partner/commission-transactions` in `server/src/routes/v8/partner.routes.ts`
- the route resolves `partnerOrgId` via `getActivePartnerOrgIdForUser(userId)`
- the route delegates to `PartnerCommissionService.getCommissions(...)`
- the response returns governed V8 meta alongside the transaction list

### Shared client seam

- added `V8PartnerApi.getCommissionTransactions()` in `src/services/api/v8/partner.ts`
- exported the commission-transaction contract through `src/services/api/v8/index.ts`

### Active surface continuity

- updated `src/views/partner/sections/EarningsSection.tsx`
- statement-history reads now prefer `V8PartnerApi.getCommissionTransactions()` during normal operation
- fallback to legacy `Api.get('/api/partners/commission-transactions')` remains bounded to compatibility statuses only
- payout history, payout request, and wider referred-customer/client-access breadth remain outside this packet

## Regression coverage

Passed:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/EarningsSection.v8-payout-request.test.tsx`

Verification command:

`npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/EarningsSection.v8-payout-request.test.tsx`

Result: `31` tests passing.

## Residual after this packet

Broader `Partner Program` parity is still not done.

Remaining honest residuals include:

- broader referred-customer lifecycle and drill-down continuity beyond the governed analytics summary already present on the live surface
- client-access onboarding/link generation breadth, which is still feature-unavailable rather than a thin missing seam
- broader onboarding, statement-source, and deeper partner workflow breadth
- placeholder-only `payout-settings` save behavior, which still lacks a real backend contract
