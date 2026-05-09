---
module_id: MODULE_PARTNER_PORTAL
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Portal partnerski

## Purpose

Opisać role i uprawnienia partner‑facing vs operator‑facing (P29), oraz bezpieczeństwo danych finansowych i directory.

## Must

- **MUST**: Role partner-program są jawne (P29) i nie dublują ról tenantowych:
  - Partner member/admin w portalu (partner org scope),
  - Partner ops (platform) w SuperAdmin dla payout/hold/adjustment.
- **MUST**: Payout/hold/adjustment są operator-only; portal może jedynie requestować payout (jeśli policy pozwala).

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie ukrytych modułów/akcji użytkownikom bez uprawnień.
 - MUST NOT: ujawniać operator‑sensitive fraud/compliance detali partnerowi.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md` (§2.3.3 roles)

