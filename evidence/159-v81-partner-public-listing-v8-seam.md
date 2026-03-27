# V8.1 Partner Program - Public Listing V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Packet: `public listing toggle seam`

## What changed

- added governed `PUT /api/v8/partner/organization/listing`
- added `V8PartnerApi.updateOrganizationListing()`
- moved `PartnerPortalView` public-listing toggle onto a V8-first seam with bounded legacy fallback
- added route, client, and component regression coverage for the new seam

## Why this packet

`payout-settings` currently exposes static placeholder controls with no real save contract. The smallest real
partner settings write still visible to operators was the public directory toggle under
`/partner?tab=public-listing`, so that became the next bounded parity packet.

## Result

The active partner lane now covers governed V8-first continuity for visible payout request, referral campaign
create/delete, and public listing toggle actions without broadening into full partner profile CRUD.
