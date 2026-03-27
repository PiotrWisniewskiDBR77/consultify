# V8.1 Partner Campaign Create V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Status: `done`

## Goal

Move the visible partner campaign creation action onto a governed V8-first seam so operators no longer
rely only on the legacy `POST /api/partners/campaign-links` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/partner.routes.ts`
   - added `POST /api/v8/partner/campaign-links`
   - delegated creation to `PartnerReferralService.createCampaignLink()` while preserving partner-org resolution from the active user

2. Frontend V8-first campaign continuity
   - extended `src/services/api/v8/partner.ts`
   - updated `src/views/partner/sections/ReferralToolsSection.tsx`
   - `Create Campaign Link` now prefers the governed V8 seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
   - extended `tests/unit/services/v8-partner-api.test.ts`
   - added `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx`

## Why this matters

This closes the next visible legacy-only write gap adjacent to already-governed referral analytics:

- governed referral runtime summary and campaign creation now sit in the same V8-first discipline
- the active referral-tools create workflow no longer bypasses the governed partner namespace
- the next partner packet can focus on adjacent campaign delete continuity instead of reopening create behavior

## Verification

`npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx tests/components/partner/EarningsSection.v8-payout-request.test.tsx`
