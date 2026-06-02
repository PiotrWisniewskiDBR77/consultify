# G1 Check-Run Template - 05 Inicjatywy (2026-05-28)

Module: `05 Inicjatywy`

Gate: `G1 Technical Gate`

Owner: CTO / Delivery Owner

Status: `ready_in_next_wave`

---

## 1) Objective

Zweryfikowac techniczna gotowosc modulu Inicjatywy przed G2.

---

## 2) Mandatory 3-step hard gate

## Step A - API Gate

- [ ] Initiative core endpoints respond without `5xx`
- [ ] Planning/read endpoints return valid payloads
- [ ] Governance/decision endpoints are reachable

Decision:

- [ ] PASS
- [ ] FAIL

## Step B - DB-Compat Gate

- [ ] Initiative writes are schema-compatible
- [ ] No type/nullability write failures
- [ ] Read-back after write is consistent

Decision:

- [ ] PASS
- [ ] FAIL

## Step C - UI Smoke Gate

- [ ] Module opens correctly
- [ ] Core create/update action works
- [ ] Feedback and states are honest
- [ ] Refresh preserves expected state

Decision:

- [ ] PASS
- [ ] FAIL

---

## 3) Stop rule

Any FAIL in A/B/C => `G1_BLOCKED_P1` and no G2.

---

## 4) Final decision

- [ ] G1_PASS
- [ ] G1_BLOCKED_P1

Critical finding:

`<fill>`

Next step:

`<fill>`

