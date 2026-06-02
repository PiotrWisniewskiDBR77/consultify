# Daily Execution Runbook - Final Closeout (2026-05-28)

Status: `operational_daily_runbook`

Purpose: codzienny rytm pracy, aby utrzymac tempo i kontrolę.

---

## 1) Morning cycle (30-45 min)

1. Read yesterday day report.
2. Open `S0_PROGRAM_BOARD_STATUS_2026-05-28.md`.
3. Confirm active WIP=2.
4. Validate blockers:
   - if `BLOCKED_P1` exists, no new module enters WIP.
5. Plan today gate target:
   - G1/G2 for both active modules.

Checklist:

- [ ] Board updated
- [ ] WIP confirmed
- [ ] Blockers reviewed
- [ ] Today target set

---

## 2) Midday cycle (execution)

For each active module:

1. Run gate checklist.
2. Collect evidence.
3. Decide PASS/PASS_WITH_P2/BLOCKED_P1/NO_GO.
4. Update board row.

Checklist:

- [ ] Module A gate run complete
- [ ] Module A evidence attached
- [ ] Module A decision recorded
- [ ] Module B gate run complete
- [ ] Module B evidence attached
- [ ] Module B decision recorded

---

## 3) Evening cycle (closeout)

1. Publish day report.
2. Update next queue.
3. Assign next-day owner actions.
4. Freeze decisions for the day.

Checklist:

- [ ] Day report published
- [ ] Queue updated
- [ ] Owner actions assigned
- [ ] Decisions frozen

---

## 4) Decision escalation rules

Escalate immediately when:

- tenant/ACL ambiguity appears,
- conflicting source-of-truth appears,
- destructive change seems required,
- no reliable evidence can be produced.

---

## 5) Daily report template

`DAY_REPORT_YYYY-MM-DD.md`

Sections:

1. Active modules today
2. Gates executed
3. Decisions taken
4. Blockers
5. Next actions

