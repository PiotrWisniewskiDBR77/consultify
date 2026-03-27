# T2 Charter - Partner Program

Date: 2026-03-26
Lane: `Partner Program`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Finance` is now accepted as the previous active `T2` lane. `Partner Program` is the next
highest-value parked candidate because it already has a governed V8 namespace, broad partner-authenticated
staging continuity, a live operator-facing portal, and a clear split-brain between V8 read truth and
legacy write workflows.

## Goal

Promote one bounded partner parity slice that reduces mixed truth across:

- partner runtime summary and workflow continuity
- partner payout / referral operator actions
- bounded V8-first partner continuity before deeper CRUD and payout breadth

## In scope

1. partner workflow/runtime consistency
2. split-brain map for partner URLs, frontend surfaces, and runtime contracts
3. one bounded partner packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full partner CRUD migration
2. broad payout lifecycle redesign
3. referred-customer lifecycle parity in one packet
4. broad legacy `partners` route retirement

## Initial bounded packet

Packet 1:

- add V8 parity for partner payout requests
- move `EarningsSection` `Request Payout` onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while broader campaign and payout-settings flows remain on legacy paths

Why this first:

- smallest visible write seam adjacent to already-governed earnings summary truth
- closes a real operator action without broadening into campaign CRUD or organization settings
- makes the next partner workflow packet easier to reason about

Recorded in:

- `evidence/155-v81-partner-program-split-brain-map.md`

## Packet 1

Completed:

- add V8 parity for partner payout requests over `POST /api/partners/payouts/request`
- move `EarningsSection` `Request Payout` onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while broader campaign CRUD and payout-settings save flows remain on legacy paths

Recorded in:

- `evidence/156-v81-partner-payout-request-v8-seam.md`

## Packet 2

Completed:

- add V8 parity for partner referral campaign creation over `POST /api/partners/campaign-links`
- move `ReferralToolsSection` `Create Campaign Link` onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while campaign delete, payout-settings save, and broader referral lifecycle flows remain on legacy paths

Recorded in:

- `evidence/157-v81-partner-campaign-create-v8-seam.md`

## Packet 3

Completed:

- add V8 parity for partner referral campaign deletion over `DELETE /api/partners/campaign-links/:linkId`
- move `ReferralToolsSection` campaign delete onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while payout-settings save and broader referral lifecycle flows remain on legacy paths

Recorded in:

- `evidence/158-v81-partner-campaign-delete-v8-seam.md`

## Packet 4

Completed:

- add V8 parity for partner public listing updates over `PUT /api/partners/organization/listing`
- move `PartnerPortalView` public directory toggle onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while broader company-info, specializations, regions, and payout-settings placeholder UI remain outside the governed path

Recorded in:

- `evidence/159-v81-partner-public-listing-v8-seam.md`

## Packet 5

Completed:

- add V8 parity for partner company-info updates over `PUT /api/partners/organization`
- move `PartnerPortalView` company-info save onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while broader specializations, regions, and payout-settings placeholder UI remain outside the governed path

Recorded in:

- `evidence/160-v81-partner-company-info-v8-seam.md`

## Packet 6

Completed:

- add V8 parity for partner specializations updates over `PUT /api/partners/organization/specializations`
- move `PartnerPortalView` specializations save onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while broader regions save and payout-settings placeholder UI remain outside the governed path

Recorded in:

- `evidence/161-v81-partner-specializations-v8-seam.md`

## Packet 7

Completed:

- add V8 parity for partner regions updates over `PUT /api/partners/organization/regions`
- move `PartnerPortalView` regions save onto a governed V8-first seam
- keep fallback bounded to compatibility statuses only while payout-settings placeholder UI remains outside the governed path

Recorded in:

- `evidence/162-v81-partner-regions-v8-seam.md`

## Acceptance decision

`Partner Program` is accepted as bounded `T2` complete.

Why acceptance is justified:

1. the active partner portal now has one coherent governed V8-first path for the visible payout, referral, and profile-settings workflows in scope for this lane
2. the remaining `payout-settings` surface is placeholder-only UI without a real save contract, so it is not a missing governed seam
3. the remaining partner writes in the repository belong to broader onboarding or client-access breadth rather than the bounded partner workflow slice used to promote this lane

Recorded in:

- `evidence/163-v81-partner-program-t2-acceptance.md`
