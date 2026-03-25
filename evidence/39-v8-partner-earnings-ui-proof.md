# V8 Partner Earnings UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `357c3c5a-c4f5-4cbc-9153-0d88919f9e0c`

Authenticated browser session:
- `https://stage.consultinity.ai`
- partner-authenticated `Admin DBR77` browser session
- surface: `Partner Portal -> Commission Earnings` via `/partner?tab=earnings`

## What was verified

UI continuity proof:
- the live partner portal loads on staging and renders the `Commission Earnings` surface without falling into the route error boundary
- the same live earnings surface now renders a dedicated `V8 Earnings Summary` block at the top of the page
- the live earnings surface calls the governed V8 partner endpoint:
  - `GET /api/v8/partner/earnings-summary` -> `200`

Observed continuity note:
- the page still hydrates broader legacy partner reads in parallel, including:
  - `GET /api/partners/earnings` -> `200`
  - `GET /api/partners/commission-transactions` -> `200`
  - `GET /api/partners/payouts` -> `403`
- the current bounded packet hardens the surface so the legacy payout `403` no longer crashes the page; the earnings surface stays rendered and the governed V8 summary remains visible

## Scope note

This proves a second real partner-facing V8 read slice on staging, but not full partner earnings migration:
- the governed V8 slice currently covers the earnings summary block rendered from `/api/v8/partner/earnings-summary`
- the broader statements table, payout history, payout settings, payout request flow, and downstream settlement workflow still rely on legacy partner endpoints
- this capture proves browser continuity for the bounded earnings summary slice and resilience against the current legacy payout failure, not full payout workflow parity

Conclusion:
- Partner continuity now extends beyond `Metrics` into the live `Commission Earnings` surface
- the live earnings page has browser-proven V8 continuity for governed payout-readiness and earnings totals
- remaining gap is broader payouts/statements workflow continuity, not absence of a staged V8 earnings surface
