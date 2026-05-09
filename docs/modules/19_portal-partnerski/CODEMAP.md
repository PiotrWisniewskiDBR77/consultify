---
module_id: MODULE_PARTNER_PORTAL
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Portal Partnerski

## Route / AppView / Sidebar

- Sidebar label: `Portal Partnerski`
- Route: `/partner`
- AppView: `AppView.PARTNER_PORTAL`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Partner onboarding, activation, earnings, ledger, payout requests and operator review.
- Partner/operator role separation.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
