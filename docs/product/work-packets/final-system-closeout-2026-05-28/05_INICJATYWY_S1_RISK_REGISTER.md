# 05 Inicjatywy - S1 Risk Register

Status: `in_progress`

Module: `05 Inicjatywy`

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Governance/planning read inconsistency | Medium | High | Enforce bounded read path checks in G1/G2 | CTO / Delivery Owner |
| Initiative updates fail silently | Medium | High | Mandatory feedback and API evidence for writes | CTO / Delivery Owner |
| Refresh breaks planning continuity | Medium | High | Add refresh-readback proof as required evidence | CTO / Delivery Owner |
| Role/permission mismatch in initiative actions | Medium | High | Role/tenant security checks before PASS | CTO / Delivery Owner |
| Scope expansion into non-core initiative domains | Medium | Medium | Freeze scope map; reject out-of-scope tasks | CTO / Delivery Owner |

---

## Rollback strategy

- Roll back to last stable initiative runtime path if critical regression appears.
- Preserve failing evidence before rollback.
- Re-run G1 to confirm recovery.

