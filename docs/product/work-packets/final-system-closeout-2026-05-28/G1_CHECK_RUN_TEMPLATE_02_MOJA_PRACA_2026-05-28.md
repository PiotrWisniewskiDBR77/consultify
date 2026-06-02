# G1 Check-Run Template - 02 Moja Praca (2026-05-28)

Module: `02 Moja Praca`

Gate: `G1 Technical Gate`

Owner: CTO / Delivery Owner

Status: `ready_in_next_wave`

---

## 1) Objective

Zweryfikowac techniczna gotowosc modulu Moja Praca przed G2.

---

## 2) Mandatory 3-step hard gate

## Step A - API Gate

- [ ] Core My Work endpoints respond without `5xx`
- [ ] Dashboard/home payloads are valid
- [ ] Linked lane endpoints (inbox/tasks/calendar bridge) respond

Decision:

- [ ] PASS
- [ ] FAIL

## Step B - DB-Compat Gate

- [ ] User/home state writes are schema-compatible
- [ ] No type/nullability write failures
- [ ] Read-back after write is consistent

Decision:

- [ ] PASS
- [ ] FAIL

## Step C - UI Smoke Gate

- [ ] Module opens correctly
- [ ] Core daily workflow action works
- [ ] Status feedback is honest
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

