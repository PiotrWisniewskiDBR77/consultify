# 02 Moja Praca - S1 Risk Register

Status: `in_progress`

Module: `02 Moja Praca`

---

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Home shell data inconsistency across cards | Medium | High | Validate bounded card set with read-back checks | CTO / Delivery Owner |
| Shortcut/action path dead state | Medium | High | Enforce core action smoke gate with UI evidence | CTO / Delivery Owner |
| Refresh loses active state | Medium | High | Mandatory refresh resistance evidence in G1/G2 | CTO / Delivery Owner |
| Role visibility mismatch for user actions | Medium | High | Run role/tenant access checks before PASS | CTO / Delivery Owner |
| Scope drift into non-core shell redesign | Medium | Medium | Freeze scope map and reject out-of-scope work | CTO / Delivery Owner |

---

## Rollback strategy

- Roll back to last known stable My Work runtime surface if regression is critical.
- Capture failing evidence before rollback.
- Re-run G1 to re-establish baseline.

