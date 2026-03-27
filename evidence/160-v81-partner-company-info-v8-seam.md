# V8.1 Partner Program - Company Info Save V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Packet: `company-info save seam`

## What changed

- added governed `PUT /api/v8/partner/organization`
- added `V8PartnerApi.updateOrganization()`
- moved `PartnerPortalView` company-info save onto a V8-first seam with bounded legacy fallback
- added route, client, and component regression coverage for the new seam

## Why this packet

After `public listing`, the next smallest real partner settings mutation was company-info save on
`/partner?tab=company-info`. It already had a live legacy contract and operator-visible entry point,
so it was the cleanest bounded follow-up packet.

## Result

The active partner lane now covers governed V8-first continuity for visible payout request, referral
campaign create/delete, public listing toggle, and company-info save actions without broadening into
full profile CRUD.
