# Initiative Timeline Capacity And Critical Path v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical planning doctrine for initiative baselines, sequencing, dependencies, capacity, workload and critical-path management

---

## 1. Why this document exists

Initiatives cannot be managed seriously if time logic is reduced to a few dates.

The system needs one planning contract for:

- timeline baseline
- milestones
- dependencies
- team capacity
- workload
- critical path

---

## 2. Core statement

Timeline planning in `consultify` should behave like governed PMO planning, not simple date editing.

Canonical path:

`initiative plan -> milestones and dependencies -> capacity-aware schedule -> critical-path awareness -> execution signals -> replan where needed`

---

## 3. Baseline doctrine

Every schedulable initiative should preserve:

- planned start
- planned end
- milestone set
- dependency set
- planning assumptions
- last approved baseline

Rule:

`schedule truth should distinguish current plan from current execution reality`

---

## 4. Capacity and workload doctrine

Planning should consider:

- named owners
- team allocation
- overlapping initiatives
- workload density over time
- feasibility of milestone sequencing

This doctrine should support both:

- PMO scheduling views
- executive planning and resourcing decisions

---

## 5. Critical-path doctrine

The package should identify:

- critical dependencies
- milestone chains
- likely blockers to start or finish
- schedule drift that threatens delivery

The user should be able to understand not only that something is late, but what else is endangered by that slippage.

---

## 6. Replan and what-if support

The timeline package should support:

- proposed reschedule
- impact preview
- dependency-aware alternatives
- workload-safe alternatives
- governance check where baseline changes are material

---

## 7. Calendar and execution linkage

Timeline planning should feed:

- initiative scheduling
- execution monitoring
- calendar overlays
- delivery reporting
- AI rescheduling support

---

## 8. Related canonical docs

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `MYWORK_CALENDAR_V8_SSOT.md`
- `AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md`
