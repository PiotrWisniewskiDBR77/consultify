# Consultinity – ToolSession & AssessmentReport Specification (Source Traceability)

## 0. Purpose of this document
This document defines canonical **source artefacts** that generate initiatives:
- `ToolSession`
- `AssessmentReport`

Goals:
- Full traceability: where an initiative comes from
- Auditability (who, when, based on what)
- Consistency across ERD, UX, and AI context
- Deterministic mapping rules: Sources → Initiatives

This document is mandatory for backend, AI, and reporting.

---

## 1. Canonical rule: Sources → Initiatives

### 1.1 Sources of initiatives (only two)
Initiatives can be created **ONLY** from:
1) `ToolSession`
2) `AssessmentReport`

No other sources exist.

### 1.2 Cardinality rules
- One Initiative can have **1..N Source Links**
- One source (ToolSession or AssessmentReport) can generate **0..N Initiatives**

Sources are immutable after finalization.

---

## 2. ToolSession – canonical definition

### 2.1 What is ToolSession
A ToolSession is a single execution of a tool (strategic or operational) resulting in structured output.

Examples:
- Digital Value Pool Identifier (DVPI)
- Pain-to-Solution Matcher (PTM)
- Legacy Technology Drag Analyzer (LTDA)

### 2.2 ToolSession – minimal required fields (canonical)

| Field | Type | Description |
|---|---|---|
| `tool_session_id` | UUID | Primary key |
| `project_id` | reference | Project scope |
| `tool_type` | enum | DVPI, PTM, LTDA, etc. |
| `created_by` | user_id | Who created the session |
| `created_at` | timestamp | Creation time |
| `finalized_at` | timestamp (nullable) | Finalization time |
| `status` | enum | `DRAFT` / `FINALIZED` |
| `input_snapshot` | JSON | Locked after finalization |
| `output_snapshot` | JSON | Locked after finalization |
| `version` | integer | Increment on edits until finalization |
| `locked` | boolean | True after finalization |

### 2.3 Lifecycle rules
- ToolSession can be edited only while `status = DRAFT`
- Finalization sets:
  - `status = FINALIZED`
  - `finalized_at` timestamp
  - `locked = true`
- After finalization:
  - snapshots are immutable
  - session is eligible to generate initiatives

---

## 3. AssessmentReport – canonical definition

### 3.1 Lifecycle rules (mandatory)
- AssessmentReport must reach `FINAL`
- After `FINAL`:
  - locked
  - immutable
  - eligible to generate initiatives

---

## 4. Source → Initiative mapping

### 4.1 Initiative creation rules
When an initiative is created:
- It must reference **at least one source** (via SourceLink)
- Source must be `FINALIZED` (ToolSession) or `FINAL` (AssessmentReport)
- System records:
  - `source_type`
  - `source_id`
  - `source_version`

No initiative exists without a traceable source.

### 4.2 SourceLink entity (ERD-aligned)

| Field | Type | Description |
|---|---|---|
| `source_link_id` | UUID | Primary key |
| `initiative_id` | reference | Initiative |
| `source_type` | enum | `TOOL` / `ASSESSMENT` |
| `source_id` | UUID | ToolSession or AssessmentReport id |
| `source_version` | integer | Version at time of linking |
| `created_at` | timestamp | Link creation time |

---

## 5. UX implications

### 5.1 Tools / Assessment UI
- “Create Initiative” button visible only after finalization
- User must select:
  - which outputs/findings generate an initiative
- AI assists in pre-filling initiative fields (never modifies sources)

### 5.2 Initiative UI
- Sources section (read-only):
  - list of linked ToolSessions / AssessmentReports
  - deep link to source artefact
- Clear label:
  - “This initiative originates from: …”

---

## 6. AI context rules
AI Assistant:
- Always receives:
  - source snapshots
  - source type
  - source version
- Never modifies sources
- Can explain why an initiative exists

---

## 7. Audit & compliance
System must answer:
- Which tool / assessment generated this initiative?
- Which version?
- Who finalized it?
- When?

No initiative exists without traceable source.

