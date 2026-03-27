# V8.1 Partner Campaign Delete V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Status: `done`

## Goal

Move the visible partner campaign delete action onto a governed V8-first seam so operators no longer
rely only on the legacy `DELETE /api/partners/campaign-links/:linkId` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/partner.routes.ts`
   - added `DELETE /api/v8/partner/campaign-links/:linkId`
   - delegated deletion to `PartnerReferralService.deleteCampaignLink()` while preserving partner-org resolution from the active user

2. Frontend V8-first campaign continuity
   - extended `src/services/api/v8/partner.ts`
   - updated `src/views/partner/sections/ReferralToolsSection.tsx`
   - campaign delete now prefers the governed V8 seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
   - extended `tests/unit/services/v8-partner-api.test.ts`
   - extended `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

## Why this matters

This closes the adjacent CRUD seam next to the already-governed referral-tools create flow:

- create and delete for visible campaign links now follow one V8-first discipline
- the active referral-tools table no longer bypasses the governed partner namespace for removal
- the next partner packet can move to payout-settings or another small settings seam instead of reopening campaign continuity

## Verification

`npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`
