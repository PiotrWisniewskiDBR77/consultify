---
module_id: MODULE_INITIATIVES
doc_kind: STATUS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Status — Inicjatywy

## Shipping status

- **Status**: shipped (core)

## Current truth (SoT)

- Governance model + CTA matrix są rozpisane w SoT i mają być egzekwowane przez backend-driven capabilities.
- Status-set w SoT jest częściowo różny między dokumentami (np. `PENDING_REVIEW` vs `REVIEW`) — kontrakt modułu musi to ujednolicić i oznaczyć różnice jako `DECISION_NEEDED`.

## Risks

- Ryzyko rozjazdu: “gates jako decyzje” vs “statusy jako enum” w kodzie — UI musi zachowywać się jak w SoT nawet jeśli reprezentacja w backendzie jest pośrednia.
- Ryzyko: FE zacznie inferować permissions lokalnie — kontrakt wymaga deny-by-default i backend-driven capabilities.

