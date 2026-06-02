# G1 Check-Run Template - 06 Realizacja (2026-05-28)

Module: `06 Realizacja`

Gate: `G1 Technical Gate`

Owner: CTO / Delivery Owner

Status: `ready_in_next_wave`

---

## 1) Objective

Zweryfikowac techniczna gotowosc modulu Realizacja przed G2.

---

## 2) Mandatory 3-step hard gate

## Step A - API Gate

- [ ] Execution control endpoints respond without `5xx`
- [ ] Risk/delay/capacity reads return valid payloads
- [ ] Core operator action endpoint is reachable

Decision:

- [ ] PASS
- [ ] FAIL

## Step B - DB-Compat Gate

- [ ] Execution writes are schema-compatible
- [ ] No type/nullability write failures
- [ ] Read-back after write is consistent

Decision:

- [ ] PASS
- [ ] FAIL

## Step C - UI Smoke Gate

- [ ] Module opens correctly
- [ ] Core execution action flow works
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

