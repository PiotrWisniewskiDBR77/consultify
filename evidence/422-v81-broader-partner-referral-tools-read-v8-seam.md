# V8.1 broader Partner referral-tools read V8 seam

Date: 2026-03-27
Lane: broader `Partner Program` parity
Taxonomy: `T4`
Packet: fourth bounded packet after broader-lane promotion

## Why this packet

After payout-history, statement-history, and referred-customer list continuity moved onto governed V8 seams,
the next smallest customer-facing residual inside the active partner portal was the shared referral-tools body
still loaded through legacy `GET /api/partners/referral-tools`.

That residual was real and active:

- `ReferralToolsSection` still hydrated its referral code, referral link, QR details, and campaign list from the legacy route
- that shared payload is used across the live `referral-tools`, `referral-analytics`, and `referred-organizations` subsections
- a real backend contract already existed via `PartnerReferralService.getReferralTools(...)`, so this was smaller and more honest than jumping into deeper referred-customer lifecycle mutations or onboarding breadth

This made referral-tools read continuity the next honest broader-partner packet.

## What changed

### Governed V8 runtime parity

- added `GET /api/v8/partner/referral-tools` in `server/src/routes/v8/partner.routes.ts`
- the route resolves `partnerOrgId` via `getActivePartnerOrgIdForUser(userId)`
- the route delegates to `PartnerReferralService.getReferralTools(...)`
- when the referral-tools service yields no row, the V8 route preserves the existing fallback payload shape so the visible surface stays continuous
- the response returns governed V8 meta alongside the referral-tools body

### Shared client seam

- added `V8PartnerApi.getReferralTools()` in `src/services/api/v8/partner.ts`
- exported the referral-tools contracts through `src/services/api/v8/index.ts`

### Active surface continuity

- updated `src/views/partner/sections/ReferralToolsSection.tsx`
- shared referral-tools body reads now prefer `V8PartnerApi.getReferralTools()` during normal operation
- referral code, referral link, and campaign-link hydration are normalized through one shared boundary before rendering
- fallback to legacy `Api.get('/api/partners/referral-tools')` remains bounded to compatibility statuses only
- deeper referred-customer lifecycle or drill-down continuity, onboarding breadth, client-access breadth, and placeholder-only `payout-settings` save remain outside this packet

## Regression coverage

Passed:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Verification command:

`npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

Result: `38` tests passing.

## Residual after this packet

Broader `Partner Program` parity is still not done.

Remaining honest residuals include:

- deeper referred-customer lifecycle and drill-down continuity beyond the governed list and referral-tools body
- client-access onboarding/link generation breadth, which is still feature-unavailable rather than a thin missing seam
- broader onboarding breadth outside the governed referral summary and tools reads
- placeholder-only `payout-settings` save behavior, which still lacks a real backend contract
