# V8.1 Partner Program - Regions Save V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Packet: `regions save seam`

## What changed

- added governed `PUT /api/v8/partner/organization/regions`
- added `V8PartnerApi.updateOrganizationRegions()`
- moved `PartnerPortalView` regions save onto a V8-first seam with bounded legacy fallback
- added route, client, and component regression coverage for the new seam

## Why this packet

After `specializations`, the next smallest real profile mutation was regions save on
`/partner?tab=regions`. It already had a live legacy contract and a narrow UI surface, so it remained
inside the bounded packet strategy.

## Result

The active partner lane now covers governed V8-first continuity for visible payout request, referral
campaign create/delete, public listing toggle, company-info save, specializations save, and regions save actions.
