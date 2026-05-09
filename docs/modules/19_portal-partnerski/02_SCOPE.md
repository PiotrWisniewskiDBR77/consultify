---
module_id: MODULE_PARTNER_PORTAL
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Portal partnerski

## Purpose

Ustalić granice odpowiedzialności partner‑facing portalu względem operator tower (SuperAdmin) oraz fundamentów P30/P31/P32.

## In scope (Must)

- Partner portal surfaces (`/partner/*`): landing, onboarding, dashboard, clients, commission/earnings views, directory, resources.
- Public recruitment/apply (`/become-partner`, `/become-partner/apply`) jako wejście do lifecycle.
- Partner-facing lifecycle i jego stany (onboard/activate/earn/payout) oraz payout request (jeśli rola pozwala).

## Out of scope (Must Not)

- Operator-only actions: hold/place/release, approve/execute/reconcile payouts, ledger adjustments/reversals → **SuperAdmin / operator**.
- Org identity edits (companyName/branding) → **Organization (P30)**; portal tylko konsumuje.
- Tenant membership/roles → **Admin (P32)**; portal zarządza wyłącznie partner-program roles w obrębie partner org (jeśli istnieją).

## Should

- Jawne linki/komunikaty gdy akcja jest operator-only (“managed by platform operators”).

## Acceptance Criteria

- [ ] Scope jest spójny z P29 (partner portal vs operator tower) i nie tworzy równoległej prawdy w P30/P31/P32/P33.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`

