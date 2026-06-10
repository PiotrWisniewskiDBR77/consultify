# G1 Check-Run Template - 01 Czat (2026-05-28)

Module: `01 Czat`

Gate: `G1 Technical Gate`

Owner: CTO / Delivery Owner

Status: `ready_in_next_wave`

---

## 1) Objective

Zweryfikowac techniczna gotowosc modulu Czat przed G2.

---

## 2) Mandatory 3-step hard gate

## Step A - API Gate

- [ ] Core chat endpoints respond without `5xx`
- [ ] Send/receive path returns expected statuses
- [ ] Handoff/proposal endpoints respond correctly

Decision:

- [ ] PASS
- [ ] FAIL

## Step B - DB-Compat Gate

- [ ] Conversation/message persistence schema-compatible
- [ ] No type/nullability write failures
- [ ] Read-back after write matches expected state

Decision:

- [ ] PASS
- [ ] FAIL

## Step C - UI Smoke Gate

- [ ] Module opens correctly
- [ ] Core send action works
- [ ] Feedback is honest (toast/banner/state)
- [ ] Refresh keeps expected conversation state

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

