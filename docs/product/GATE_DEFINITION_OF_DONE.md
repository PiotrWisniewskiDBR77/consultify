# Consultinity – Canonical Gate Definitions (Definition of Done)

## 0. Purpose of this document

This document defines **Definition of Done (DoD)** for all decision gates in the Consultinity platform.

Goals:

- Remove ambiguity in status transitions
- Enable UI completeness checks
- Enable AI Assistant guidance
- Ensure governance, auditability, and scalability

This document is **normative (system‑enforced)**, not advisory.

---

## 1. Gate model – general rules

### 1.1 Gate principles

- Gates are **business decisions**, not consultant actions
- Gate transition is allowed only if DoD is satisfied
- System must validate DoD before enabling gate action
- Missing elements must be shown as explicit checklist items

### 1.2 Gate actors

- Each gate has exactly **one accountable approver**
- System roles define who can approve, not individuals
- AI Assistant may recommend, **never approve**

---

## 2. Gate definitions (canonical)

### 🟦 GATE: DRAFT → PENDING_REVIEW

**Gate type**: `SUBMIT_FOR_REVIEW`  
**Module**: Tools / Assessment  
**Purpose**: Author submits draft for intake/triage (locks author edits)

**Actor (can execute)**

- Consultant overlay (author) **or** Initiative Owner

**DoD – input**

- Initiative status = `DRAFT`
- Source traceability exists (Tool Output / Assessment Report linked)
- Minimum content: title + summary/problem statement (may be partial)

**Rules**

- If the actor is Consultant overlay, they can submit only initiatives they created (auditable authorship)

**DoD – output**

- status = `PENDING_REVIEW`
- initiative is ready for PM/PMO triage

---

### 🟦 GATE: PENDING_REVIEW → DRAFT

**Gate type**: `SEND_BACK`  
**Module**: Tools / Assessment  
**Purpose**: Triage rejects intake and requests rework

**Actor (can execute)**

- Project Leader (PM) **or** PMO

**DoD – input**

- status = `PENDING_REVIEW`
- **Reason** is provided (mandatory)

**DoD – output**

- status = `DRAFT`
- author can continue drafting

---

### 🟦 GATE: PENDING_REVIEW → REVIEW

**Gate type**: `APPROVE_TO_INITIATIVE`  
**Module**: Tools / Assessment → Initiatives  
**Purpose**: Approve intake and move into Initiatives module pipeline

**Actor (can execute)**

- Project Leader (PM) **or** PMO

**DoD – input**

- status = `PENDING_REVIEW`
- owner assigned

**DoD – output**

- status = `REVIEW`
- initiative becomes visible in Initiatives module for governance workflow

---

### 🟦 GATE: REVIEW → PROMOTED (Go/No‑Go)

**Gate type**: `ACCEPT` (and `REJECT`)  
**Module**: Initiatives  
**Purpose**: Decide “should this be an initiative?” before formal planning

**Actor (can execute)**

- Sponsor (`SPONSOR`) **or** Steering Committee (`STEERING_COMMITTEE`)

**DoD – input**

- status = `REVIEW`
- Minimum content:
  - title
  - problem/summary
  - source reference
- ownership:
  - Initiative Owner assigned
  - Sponsor assigned

**DoD – output**

- `ACCEPT` ⇒ status = `PROMOTED` (accepted for planning)
- `REJECT` ⇒ status = `DRAFT`

---

### 🟦 GATE: PLANNING → APPROVED

**Gate type**: `APPROVE`  
**Module**: Initiatives  
**Purpose**: Formal authorization to execute initiative (investment approval)

**Actor (can execute)**

- Steering Committee (`STEERING_COMMITTEE`)
  - when Steering Board is disabled, delegations apply (Sponsor / Portfolio Owner)

**DoD – input**

- status = `PLANNING`
- initiative is “fully designed” (minimum):
  - objective (measurable) + success metrics/KPI definition
  - scope in/out + deliverables
  - owners assigned (initiative owner(s), sponsor)
  - risks/RAID captured (at least key risks)
  - economic analysis if required by `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
- **Timeline baseline is NOT required here** (see approved backlog policy)

**Rules**

- Decision must be auditable (Decision artefact captured)

**DoD – output**

- status = `APPROVED`
- initiative enters **approved backlog** (approved but not yet scheduled)

---

### 🟦 GATE: APPROVED → SCHEDULED

**Gate type**: `SCHEDULE`  
**Module**: Initiatives  
**Purpose**: Commit initiative to roadmap

**Actor (can execute)**

- PMO

**DoD – input**

- status = `APPROVED`
- baseline timeline exists:
  - at least `planned_start_date` (and end date if required by policy)
- capacity confirmed (team availability)
- dependencies mapped (if any)

**Rules**

- this is the baseline/commit moment; after this, auto-start by date can apply

**DoD – output**

- status = `SCHEDULED`
- initiative visible in Execution module routing

---

### 🟦 GATE: SCHEDULED → EXECUTING

**Gate type**: `START`  
**Module**: Implementation  
**Purpose**: Begin execution

**Actor (can execute)**

- System (automatic, by timeline) and/or PMO (manual override)

**DoD – input**

- status = `SCHEDULED`
- baseline timeline exists
- execution owner assigned (or initiative owner execution)
- tasks may be empty at start (allowed), but execution should create tasks promptly

**DoD – output**

- status = `EXECUTING`

---

### 🟦 GATE: EXECUTING → BLOCKED

**Gate type**: `BLOCK`  
**Module**: Implementation  
**Purpose**: Explicitly stop execution due to blocker

**Actor (can execute)**

- Initiative Owner **or** PMO

**DoD – input**

- blocking reason recorded (mandatory)
- impact assessment recorded (minimum: timeline/budget impact yes/no)

**DoD – output**

- status = `BLOCKED`

---

### 🟦 GATE: BLOCKED → EXECUTING

**Gate type**: `UNBLOCK`  
**Module**: Implementation  
**Purpose**: Resume execution after blocker resolution

**Actor (can execute)**

- Sponsor (`SPONSOR`) **or** Steering Committee (`STEERING_COMMITTEE`)

**DoD – input**

- resolution decision recorded (Decision artefact)
- updated plan/timeline/budget if impacted

**DoD – output**

- status = `EXECUTING`

---

### 🟦 GATE: EXECUTING → DONE

**Gate type**: `COMPLETE`  
**Module**: Implementation  
**Purpose**: Confirm delivery completion

**Actor (can execute)**

- Initiative Owner **or** PMO

**DoD – input**

- tasks closed or explicitly cancelled
- pending execution gate decisions resolved
- delivery confirmation recorded

**DoD – output**

- status = `DONE`

---

### 🟦 GATE: DONE → TRACKING

**Gate type**: `START_TRACKING`  
**Module**: Benefits  
**Purpose**: Start benefits realization monitoring

**Actor (can execute)**

- Business Owner (Benefits) (`BUSINESS_OWNER`)

**DoD – input**

- Benefits owner assigned:
  - `initiatives.owner_business_id` is set (Business Owner)
- baseline KPIs defined (backend-enforced):
  - at least **1** row exists in `initiative_kpis` for the initiative
  - at least **1** KPI has `target_value` and `unit` defined
- tracking window defined:
  - stored in `initiatives.tracking_start_date` / `initiatives.tracking_end_date`
  - if empty, backend sets defaults on transition (v1 default: **90 days**)

**DoD – output**

- status = `TRACKING`

---

### 🟦 GATE: \* → CANCELLED

**Gate type**: `CANCEL`  
**Module**: Any  
**Purpose**: Stop initiative with rationale

**Actor (can execute)**

- PMO, and Steering Committee (with delegation when Steering Board is disabled)

**DoD – input**

- reason recorded (recommended; may be mandatory by policy)

**DoD – output**

- status = `CANCELLED`

---

## 3. UX implications (system rules)

- Gate buttons are disabled if DoD not met
- UI must show:
  - Missing artefacts
  - Missing assignments
- AI Assistant:
  - Explains missing items
  - Suggests next actions
  - Never overrides gates

---

## 4. Canonical status order (summary)

`DRAFT` → `PENDING_REVIEW` → `REVIEW` → `PROMOTED` → `PLANNING` → `APPROVED` → `SCHEDULED` → `EXECUTING` ↔ `BLOCKED` → `DONE` → `TRACKING` → `ARCHIVED`

Terminal paths:

- `CANCELLED` → `ARCHIVED`
