# V8.1 Partner Program T2 Acceptance

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Tranche: `Tranche 2`
Decision: `accepted`

## Acceptance basis

The bounded active `T2` packet for `Partner Program` is accepted as complete.

Accepted closure points:

1. the governed partner runtime summary remains present on the live partner portal and partner scope is resolved from `partner_users.partner_org_id`
2. the visible `Request Payout` workflow now follows a governed V8-first seam with compatibility-only fallback
3. the visible referral campaign create and delete workflows now follow governed V8-first seams with compatibility-only fallback
4. the visible profile settings workflows for public listing, company info, specializations, and regions now follow governed V8-first seams with compatibility-only fallback
5. `payout-settings` is no longer treated as a blocker because the current UI is placeholder-only and has no real save contract behind it

## Evidence chain

- `docs/product/work-packets/T2_PARTNER_PROGRAM_CHARTER.md`
- `evidence/155-v81-partner-program-split-brain-map.md`
- `evidence/156-v81-partner-payout-request-v8-seam.md`
- `evidence/157-v81-partner-campaign-create-v8-seam.md`
- `evidence/158-v81-partner-campaign-delete-v8-seam.md`
- `evidence/159-v81-partner-public-listing-v8-seam.md`
- `evidence/160-v81-partner-company-info-v8-seam.md`
- `evidence/161-v81-partner-specializations-v8-seam.md`
- `evidence/162-v81-partner-regions-v8-seam.md`

## Verification basis

Passed:

- `tests/unit/services/v8-partner-api.test.ts`
- `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
- `tests/components/partner/EarningsSection.v8-payout-request.test.tsx`
- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`
- `tests/components/partner/PartnerPortalView.v8-public-listing.test.tsx`
- `tests/components/partner/PartnerPortalView.v8-company-info.test.tsx`
- `tests/components/partner/PartnerPortalView.v8-specializations.test.tsx`
- `tests/components/partner/PartnerPortalView.v8-regions.test.tsx`

Verification command:

`npx vitest run tests/unit/services/v8-partner-api.test.ts server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/components/partner/EarningsSection.v8-payout-request.test.tsx tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx tests/components/partner/PartnerPortalView.v8-public-listing.test.tsx tests/components/partner/PartnerPortalView.v8-company-info.test.tsx tests/components/partner/PartnerPortalView.v8-specializations.test.tsx tests/components/partner/PartnerPortalView.v8-regions.test.tsx`

Result: `35` tests passing.

## Residual note

Legacy-backed onboarding/connect breadth, client-access onboarding link generation, broader client/project/certification/resource surfaces, statement data-source migration, and the placeholder-only `payout-settings` form still exist in the repository, but they are no longer treated as blockers for this bounded `T2` partner-lane acceptance. They are broader parity work, not absence of a working bounded V8-first partner lane.
