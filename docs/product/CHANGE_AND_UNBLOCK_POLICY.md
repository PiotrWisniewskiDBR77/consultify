# Consultinity – Change, Block & Unblock Governance (Canonical)

## 0. Purpose of this document
This document defines what constitutes a change, how changes are governed, and how `BLOCKED` / `UNBLOCK` flows work in the Consultinity platform.

Goals:
- Prevent uncontrolled scope/budget/timeline drift
- Ensure traceability of changes
- Enable deterministic UX and AI behavior
- Align execution reality with governance model

This document is **mandatory and system‑enforced**.

---

## 1. What is a CHANGE (canonical definition)
A **CHANGE** is any modification to an initiative **after approval** that affects at least one of the following dimensions:

### 1.1 Change dimensions
- Scope (what is delivered)
- Timeline (start/end dates, milestones)
- Budget / Economics
- Expected benefits (KPIs)
- Execution assumptions (technology, resources, dependencies)

If none of the above change → it is **NOT** a change.

---

## 2. Change classification

### 2.1 Minor change
A change is **MINOR** if **all** conditions are met:
- Budget impact ≤ ±10%
- Timeline shift ≤ ±15%
- No change to strategic objectives
- No impact on other initiatives

**Approval**: Project Sponsor  
**Artefact required**: Decision (`type = CHANGE`)

### 2.2 Major change
A change is **MAJOR** if **any** condition is met:
- Budget impact > ±10%
- Timeline shift > ±15%
- KPI/Scope: changes the goal (not just a parameter)
- New dependencies introduced
- Change impacts other initiatives or roadmap

**Approval**: Steering Committee  
**Artefact required**: Decision (`type = CHANGE`)

---

## 3. Change process (system flow)

### 3.1 When CHANGE can occur
Only in statuses:
- `EXECUTING`
- `BLOCKED`

### 3.2 Change flow
`CHANGE_REQUEST` → Impact analysis → Decision (APPROVE / REJECT) → Update artefacts → Resume execution or remain blocked

System requirements:
- The system must compute the change class (minor/major) using configured thresholds.
- No change is applied unless a Decision is recorded (immutably) and approved by the correct authority.

---

## 4. BLOCKED / UNBLOCK governance

### 4.1 What `BLOCKED` means
`BLOCKED` is a decision pause, not a failure:
- status is used only in Implementation context
- it does not change the initiative goal
- it means “we cannot continue without a decision”

### 4.2 How `BLOCKED` happens
Transition to `BLOCKED` requires:
- blocking reason recorded
- impact flags recorded (timeline/budget impacts)
- notification to Sponsor and PMO inbox

### 4.3 UNBLOCK approval
- Project Sponsor

### 4.4 Required artefacts for UNBLOCK
- Resolution note
- Updated timeline/budget (if impacted)
- Decision recorded (`type = CHANGE` with UNBLOCK resolution)

---

## 5. Decision artefact types (canonical)

| Type | Purpose |
|---|---|
| `APPROVAL` | Gate approval |
| `CHANGE` | Modify approved initiative |
| `CANCEL` | Stop initiative permanently |
| `CLOSURE` | Confirm completion / close execution |

Each Decision:
- has an owner
- has a timestamp
- is immutable after approval

UNBLOCK rule:
- “UNBLOCK” is treated as a **variant of `CHANGE`** (a specific resolution of a change), not a separate governance gate type.

Default MVP encoding:
- `decision_type = CHANGE`
- `change_kind = UNBLOCK | SCOPE | BUDGET | TIMELINE | KPI`

---

## 6. UX implications

### 6.1 User interface
- `CHANGE` button visible only in `EXECUTING` / `BLOCKED`
- System auto-detects MINOR vs MAJOR
- Approval path shown clearly before submission

### 6.2 AI Assistant
- Explains impact before submission
- Simulates outcomes (timeline/budget)
- Never auto-approves

---

## 7. Audit & traceability
The system must answer:
- What changed?
- When?
- Who approved?
- What was the impact?

No change is allowed without a Decision artefact.

Related canonical policies:
- `docs/product/ECONOMIC_ANALYSIS_POLICY.md` (re-finalize economics when budget/scope/benefits change)

