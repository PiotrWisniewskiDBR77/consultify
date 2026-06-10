# 06 Realizacja - S1 Risk Register

Status: `in_progress`

Module: `06 Realizacja`

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Execution control read instability | Medium | High | Enforce bounded read checks in G1/G2 | CTO / Delivery Owner |
| Core operator action fails without clear feedback | Medium | High | Mandatory feedback and API evidence for core action | CTO / Delivery Owner |
| Refresh breaks control state continuity | Medium | High | Require read-back/refresh proof before PASS | CTO / Delivery Owner |
| Access boundary mismatch for operator roles | Medium | High | Run role/tenant checks before PASS | CTO / Delivery Owner |
| Scope drift into broader execution package | Medium | Medium | Scope freeze and out-of-scope rejection | CTO / Delivery Owner |

---

## Rollback strategy

- Roll back to last stable execution surface path if critical regression appears.
- Preserve failing evidence before rollback.
- Re-run G1 to verify stabilization.

