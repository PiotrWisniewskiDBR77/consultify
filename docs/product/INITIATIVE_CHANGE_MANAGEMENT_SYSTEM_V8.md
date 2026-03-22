# Initiative Change Management System v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical lifecycle and change-management doctrine for initiatives from creation through approval, execution, closure and tracking

---

## 1. Why this document exists

An initiative in `consultify` should be treated as a living managed object.

It is not enough to create it and later mark it done.

The system needs one explicit doctrine for:

- how initiatives enter the system
- how they move through gates
- how they change during planning and execution
- how closure and accountability work

---

## 2. Core statement

`Initiative v8` should support one governed lifecycle:

`source -> draft -> review -> planning -> approval -> scheduling -> execution -> delivery closure -> benefits tracking`

And one governed change path:

`change detected -> change proposal -> impact review -> approval where required -> apply -> audit`

---

## 3. Initiative entry points

The package should explicitly support initiative creation from at least these surfaces:

- manual initiative creation
- tools outputs
- assessment outputs
- interview or discovery findings where policy allows
- chat or agent proposal flow

Rule:

`many entry points may exist, but only one lifecycle truth may exist`

---

## 4. Lifecycle doctrine

Initiatives should preserve:

- source context
- gate readiness
- planning baseline
- current execution state
- change history
- closure evidence
- tracking or benefits handoff

The initiative remains the canonical parent object even when work is later viewed from:

- Initiatives
- Execution
- Inbox
- Calendar
- Reporting

---

## 5. Change classes

The system should distinguish:

- `scope_change`
- `timeline_change`
- `resource_change`
- `budget_change`
- `dependency_change`
- `risk_response_change`
- `closure_readiness_change`

Not every change needs the same approval path.

---

## 6. Baseline and execution change rule

Two truths must stay separate:

- the approved or scheduled baseline
- the active execution reality

Changes should therefore preserve:

- previous baseline
- proposed new baseline
- impact summary
- approver or policy path
- applied result

---

## 7. Closure and accountability doctrine

An initiative should not be treated as complete only because tasks are mostly done.

Closure should preserve:

- delivery completion evidence
- open risks or exceptions
- unresolved decisions
- owner sign-off
- benefits-tracking handoff where required

---

## 8. Main implementation-facing risks

- separate creation paths create incompatible initiative objects
- planning changes are applied without baseline traceability
- execution work drifts away from initiative goals
- closure is treated as status change without accountability evidence

---

## 9. Related canonical docs

- `PROJECT_MANAGEMENT_V8_BENCHMARK.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `TASK_AUTOMATION_AND_EVENTING_V8.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
