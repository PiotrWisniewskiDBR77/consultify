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

### 🟦 GATE: REVIEW → PROMOTED
**Gate name**: PROMOTE  
**Module**: Initiatives  
**Purpose**: Confirm initiative relevance before formal planning

**Approver**
- Initiative Owner (Business)

**Required artefacts (DoD – input)**
- Initiative exists in **REVIEW**
- Mandatory Initiative fields completed:
  - Title
  - Problem statement
  - Business context
  - Expected outcome (qualitative)
  - Source reference (`ToolSession` or `AssessmentReport`)
- Initiative assigned to:
  - Initiative Owner
  - Project Sponsor

**Validation rules**
- Initiative Owner ≠ Consultant
- Source artefact is finalized (ToolSession closed or Assessment finalized)
 - Source traceability is persisted (SourceLink created and version captured)

**Result (DoD – output)**
- Initiative status = **PROMOTED**
- Initiative becomes visible in Initiatives module
- Planning fields unlocked

---

### 🟦 GATE: PLANNING → APPROVED
**Gate name**: APPROVE  
**Module**: Initiatives  
**Purpose**: Formal authorization to execute initiative

**Approver**
- Steering Committee (or Sponsor if configured for small projects)

**Required artefacts (DoD – input)**
- Initiative status = **PLANNING**
- Planning completed:
  - Objective (measurable)
  - Scope (in / out)
  - Timeline (start + end)
  - Assigned team
  - Economic Analysis:
    - Mandatory if required by `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
  - Risks identified (minimum 1)

**Validation rules**
- Timeline dates valid
- Owner and Sponsor assigned
- Economic Analysis validated (if required)

**Result (DoD – output)**
- Initiative status = **APPROVED**
- Execution artefacts unlocked (Tasks, Decisions)
- Initiative becomes schedulable

---

### 🟦 GATE: APPROVED → SCHEDULED
**Gate name**: SCHEDULE  
**Module**: Initiatives  
**Purpose**: Commit initiative to roadmap

**Approver**
- PMO

**Required artefacts (DoD – input)**
- Initiative status = **APPROVED**
- Timeline exists
- Capacity confirmed (team availability)
- Dependencies mapped (if any)

**Validation rules**
- No date conflicts on roadmap
- Team capacity ≥ required load

**Result (DoD – output)**
- Initiative status = **SCHEDULED**
- Initiative visible on roadmap
- Execution start enabled

---

### 🟦 GATE: SCHEDULED → EXECUTING
**Gate name**: START  
**Module**: Implementation  
**Purpose**: Begin execution

**Approver**
- System (automatic)

**Required artefacts (DoD – input)**
- Initiative status = **SCHEDULED**
- At least one Task exists
- Responsible execution owner assigned

**Result (DoD – output)**
- Initiative status = **EXECUTING**
- Task tracking active
- Progress metrics enabled

---

### 🟦 GATE: EXECUTING → BLOCKED
**Gate name**: BLOCK  
**Module**: Implementation  
**Purpose**: Explicitly stop execution due to blocker

**Approver**
- Project Sponsor

**Required artefacts (DoD – input)**
- Blocking reason recorded
- Impact assessment:
  - Timeline impact (yes/no)
  - Budget impact (yes/no)

**Result (DoD – output)**
- Initiative status = **BLOCKED**
- All tasks frozen
- Alert sent to Inbox (Sponsor, PMO)

---

### 🟦 GATE: BLOCKED → EXECUTING
**Gate name**: UNBLOCK  
**Module**: Implementation  
**Purpose**: Resume execution after blocker resolution

**Approver**
- Project Sponsor

**Required artefacts (DoD – input)**
- Resolution decision recorded (CHANGE with UNBLOCK resolution)
- Updated timeline and/or budget if affected

**Result (DoD – output)**
- Initiative status = **EXECUTING**
- Tasks unfrozen
- Execution resumes

---

### 🟦 GATE: EXECUTING → DONE
**Gate name**: COMPLETE  
**Module**: Implementation  
**Purpose**: Confirm delivery completion

**Approver**
- PMO

**Required artefacts (DoD – input)**
- All Tasks closed or explicitly cancelled
- Delivery confirmation recorded
- Final cost captured

**Result (DoD – output)**
- Initiative status = **DONE**
- Benefits Tracking enabled
- Execution locked (read-only)

---

### 🟦 GATE: DONE → TRACKING
**Gate name**: START_TRACKING  
**Module**: Benefits  
**Purpose**: Start benefits realization monitoring

**Approver**
- Business Owner

**Required artefacts (DoD – input)**
- Baseline KPIs defined
- KPI owner assigned
- Tracking period defined

**Result (DoD – output)**
- Initiative status = **TRACKING**
- Benefits Records enabled

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
`DRAFT` → `EDITING` → `REVIEW` → `PROMOTED` → `PLANNING` → `APPROVED` → `SCHEDULED` → `EXECUTING` ↔ `BLOCKED` → `DONE` → `TRACKING` → `CANCELLED`

