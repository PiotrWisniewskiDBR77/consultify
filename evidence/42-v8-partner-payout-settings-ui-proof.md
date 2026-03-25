# V8 Partner Payout Settings UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `fd5e4a9c-9ace-406d-8249-973b8c5cabea`

Authenticated browser session:
- `https://stage.consultinity.ai`
- partner-authenticated `Admin DBR77` browser session
- surface: `Partner Portal -> Payout Settings` via `/partner?tab=payout-settings`

## What was verified

UI continuity proof:
- the live partner portal loads on staging and renders the `Payout Settings` surface in the authenticated partner session
- the same live payout-settings surface now renders a dedicated `V8 Earnings Summary` block above the payout configuration form
- the live payout-settings surface calls the governed V8 partner earnings endpoint:
  - `GET /api/v8/partner/earnings-summary` -> `200`

Observed continuity note:
- the page still hydrates broader legacy partner reads in parallel, including:
  - `GET /api/partners/earnings` -> `200`
  - `GET /api/partners/commission-transactions` -> `200`
  - `GET /api/partners/payouts` -> `403`
- the current bounded packet extends governed V8 payout-readiness continuity onto the live payout-settings surface even while the legacy payouts endpoint still fails for this tenant/session

## Scope note

This proves another real partner-facing V8 read slice on staging, but not full payout-settings migration:
- the governed V8 slice currently covers the earnings summary block rendered from `/api/v8/partner/earnings-summary`
- the broader bank-details form, payout preferences, save flow, payout requests, and downstream payout configuration workflow still rely on legacy partner endpoints or local placeholder UI
- this capture proves browser continuity for the bounded payout-settings summary slice, not full payout-settings workflow parity

Conclusion:
- Partner continuity now extends across metrics, referrals, earnings, payout history, and payout settings surfaces
- the live `Payout Settings` page has browser-proven V8 continuity for governed earnings and payout-readiness reads
- remaining gap is referred-customer workflow plus deeper statements continuity, not absence of a staged V8 partner payouts/settings UI path
