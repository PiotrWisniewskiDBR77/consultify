# V8.1 Partner Program Split-Brain Map

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Status: `active`

## Why this lane is promotable

Partner Program already has a governed V8 runtime surface plus broad live staging continuity, but the
active operator workflows still mix V8 read truth with legacy write and lifecycle paths.

## Current split-brain map

1. Governed V8 runtime summary
   - `src/services/api/v8/partner.ts`
   - `server/src/routes/v8/partner.routes.ts`
   - governed `GET /api/v8/partner/referral-analytics`
   - governed `GET /api/v8/partner/earnings-summary`

2. Live partner surface continuity
   - `src/views/partner/PartnerPortalView.tsx`
   - `src/views/partner/sections/ReferralToolsSection.tsx`
   - `src/views/partner/sections/EarningsSection.tsx`
   - runtime summary cards already use V8 reads on the live portal

3. Legacy write and workflow plane
   - `src/views/partner/sections/EarningsSection.tsx`
   - `src/views/partner/sections/ReferralToolsSection.tsx`
   - active workflow entry points still post to legacy `/api/partners/*` routes such as
     `POST /api/partners/payouts/request`, `POST /api/partners/campaign-links`, and
     `DELETE /api/partners/campaign-links/:linkId`

4. Backend surface depth mismatch
   - `server/src/routes/v8/partner.routes.ts` currently exposes only a narrow V8 read bridge
   - broader payout, campaign, organization-settings, and referral lifecycle behavior still lives on
     `server/src/routes/partners.routes.ts`

## Bounded first packet

Start with `partner payout request seam`:

- add V8 parity for `POST /api/partners/payouts/request`
- move the visible `Request Payout` action in `EarningsSection` onto a governed V8-first seam
- keep broader campaign CRUD, payout-settings save, and organization mutation breadth outside this packet
