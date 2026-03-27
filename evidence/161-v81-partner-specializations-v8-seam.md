# V8.1 Partner Program - Specializations Save V8 Seam

Date: 2026-03-26
Lane: `Partner Program`
Packet: `specializations save seam`

## What changed

- added governed `PUT /api/v8/partner/organization/specializations`
- added `V8PartnerApi.updateOrganizationSpecializations()`
- moved `PartnerPortalView` specializations save onto a V8-first seam with bounded legacy fallback
- added route, client, and component regression coverage for the new seam

## Why this packet

After `company-info`, the next smallest real profile mutation was specializations save on
`/partner?tab=specializations`. It already had a live legacy contract and a contained UI surface,
so it fit the bounded packet strategy cleanly.

## Result

The active partner lane now covers governed V8-first continuity for visible payout request, referral
campaign create/delete, public listing toggle, company-info save, and specializations save actions.
