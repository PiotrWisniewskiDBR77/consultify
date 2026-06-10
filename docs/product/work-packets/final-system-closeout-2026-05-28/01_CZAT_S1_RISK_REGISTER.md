# 01 Czat - S1 Risk Register

Status: `in_progress`

Module: `01 Czat`

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Conversation state loss after refresh | Medium | High | Enforce read-back checks in G1/G2 | CTO / Delivery Owner |
| Silent failure on send action | Medium | High | Require explicit feedback state and API evidence | CTO / Delivery Owner |
| Degraded provider state shown as success | Medium | High | Enforce honest degraded UX contract | CTO / Delivery Owner |
| Tenant/ACL leakage via chat-linked context | Low | Critical | Run security/tenant gate checks before PASS | CTO / Delivery Owner |
| Scope drift into non-core feature expansion | Medium | Medium | Freeze scope map and reject out-of-scope items | CTO / Delivery Owner |

---

## Rollback strategy

- If critical regression appears, revert to last known stable chat runtime path.
- Keep evidence of failing gate before rollback.
- Re-run G1 after rollback to confirm stabilization.

