# V8.1 broader Partner referred customers list V8 seam

Date: 2026-03-27
Lane: broader `Partner Program` parity
Taxonomy: `T4`
Packet: third bounded packet after broader-lane promotion

## Why this packet

After payout-history and statement-history continuity moved onto governed V8 seams, the next smallest
customer-facing residual inside the active partner portal was the referred-customer list on
`/partner?tab=referred-organizations`.

That residual was real and active:

- the live surface already had governed V8 acquisition summary cards
- but the referred-customer workflow still lacked a governed list of attributed customer organizations
- legacy already exposed a real `GET /api/partners/attributions` contract, so this was smaller and more honest
  than jumping into full referred-customer lifecycle mutations or broader onboarding breadth

This made referred-customer list continuity the next honest broader-partner packet.

## What changed

### Governed V8 runtime parity

- added `GET /api/v8/partner/attributions` in `server/src/routes/v8/partner.routes.ts`
- the route resolves `partnerOrgId` via `getActivePartnerOrgIdForUser(userId)`
- the route delegates to `PartnerReferralService.getPartnerAttributions(...)`
- the shared referral service now returns `organizationName` alongside partner attribution records
- the response returns governed V8 meta alongside the attribution list

### Shared client seam

- added `V8PartnerApi.getAttributions()` in `src/services/api/v8/partner.ts`
- exported the referred-customer attribution contract through `src/services/api/v8/index.ts`

### Active surface continuity

- updated `src/views/partner/sections/ReferralToolsSection.tsx`
- the `referred-organizations` subsection now renders a governed referred-customer list from attribution records
- referred-customer list reads now prefer `V8PartnerApi.getAttributions()` during normal operation
- fallback to legacy `Api.get('/api/partners/attributions')` remains bounded to compatibility statuses only
- full referred-customer lifecycle/drill-down, referral-tools read continuity, and wider partner breadth remain outside this packet

## Regression coverage

Passed:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Verification command:

`npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Result: `33` tests passing.

## Residual after this packet

Broader `Partner Program` parity is still not done.

Remaining honest residuals include:

- referral-tools read continuity still loading the shared referral code/link/campaign body through legacy `GET /api/partners/referral-tools`
- broader referred-customer lifecycle and drill-down continuity beyond the new governed list and summary
- client-access onboarding/link generation breadth, which is still feature-unavailable rather than a thin missing seam
- placeholder-only `payout-settings` save behavior, which still lacks a real backend contract
