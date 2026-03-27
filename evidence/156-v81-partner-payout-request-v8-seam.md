# V8.1 Partner Payout Request V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Status: `done`

## Goal

Move the visible partner payout request action onto a governed V8-first seam so operators no longer
rely only on the legacy `POST /api/partners/payouts/request` route.

## What changed

1. Backend V8 parity
   - extended `server/src/routes/v8/partner.routes.ts`
   - added `POST /api/v8/partner/payouts/request`
   - delegated payout creation to `PartnerCommissionService.requestPayout()` while preserving partner-org resolution from the active user

2. Frontend V8-first payout continuity
   - extended `src/services/api/v8/partner.ts`
   - updated `src/views/partner/sections/EarningsSection.tsx`
   - `Request Payout` now prefers the governed V8 seam before bounded legacy fallback

3. Regression coverage
   - extended `server/src/routes/v8/__tests__/v8-partner-read.test.ts`
   - extended `tests/unit/services/v8-partner-api.test.ts`
   - added `tests/components/partner/EarningsSection.v8-payout-request.test.tsx`

## Why this matters

This closes the first obvious legacy-only write gap next to already-governed partner runtime truth:

- earnings runtime summary and payout request now sit in the same V8-first discipline
- the active payout call-to-action no longer bypasses the governed partner namespace
- the next partner packet can focus on adjacent referral workflow continuity instead of reopening payout request behavior

## Verification

`npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts tests/unit/services/v8-partner-api.test.ts tests/components/partner/EarningsSection.v8-payout-request.test.tsx tests/components/partner/PartnerPortalView.test.tsx`
