# RESET ERD – CONSULTINITY (Authoritative)

## 1. Purpose of reset
This ERD is designed from scratch, based solely on the agreed business logic.\nIt is the authoritative data model for backend implementation.

**Principles**
- Initiative is the central aggregate root
- No duplicate artefacts
- Clear ownership and lifecycle
- Decision- and gate-driven transitions

---

## 2. Core aggregates (root entities)

### 2.1 Organization
Represents a tenant/company.

**Fields**
- `id`
- `name`
- `billing_owner_id`
- `settings`

**Relations**
- Organization has many Projects
- Organization has many Users

### 2.2 User
System user.

**Fields**
- `id`
- `email`
- `name`
- `system_role` (`OWNER` | `ADMIN` | `USER`)

**Relations**
- User belongs to Organization
- User is assigned to Projects via ProjectRoleAssignment

### 2.3 Project
Transformation context (portfolio scope).

**Fields**
- `id`
- `name`
- `description`
- `status`

**Relations**
- Project belongs to Organization
- Project has many Initiatives
- Project has many Assessments
- Project has many Interviews

---

## 3. Initiative (central aggregate)

### 3.1 Initiative
Central object of the entire system.

**Fields**
- `id`
- `project_id`
- `initiative_owner_id`
- `title`
- `problem_statement`
- `goal`
- `scope`
- `status`
- `priority`
- `start_date`
- `end_date`
 - `progress_auto` (0..100, derived)
 - `progress_override` (0..100, nullable)
 - `progress_override_by` (user_id, nullable)
 - `progress_override_at` (timestamp, nullable)

**Relations**
- Initiative has many Tasks
- Initiative has many Decisions
- Initiative has many EconomicAnalyses
- Initiative has many SourceLinks (1..N required)
- Initiative has one Timeline
- Initiative has one BenefitsEvaluation
- Initiative has many BenefitsRecords

**Status machine**
`DRAFT` → `EDITING` → `REVIEW` → `PROMOTED` → `PLANNING` → `APPROVED` → `SCHEDULED` → `EXECUTING` → `BLOCKED` → `EXECUTING` → `DONE` → `TRACKING` → `ARCHIVED` → `CANCELLED`

**BLOCKED rules**
- `BLOCKED` exists only in Implementation context
- It is not a terminal state and does not change the initiative goal
- Meaning: “we cannot continue without a decision”
- Exit requires a Decision:
  - `BLOCKED` → `EXECUTING` (unblock)
  - or `BLOCKED` → `CANCELLED` (stop)

---

## 4. Supporting aggregates

### 4.0 ToolSession (persistent tool output)
Persistent snapshot of a tool execution (tool output).

**Fields (minimum)**
- `tool_session_id`
- `project_id`
- `tool_type`
- `created_by`
- `created_at`
- `finalized_at` (nullable)
- `status` (`DRAFT` | `FINALIZED`)
- `input_snapshot` (JSON, locked after finalization)
- `output_snapshot` (JSON, locked after finalization)
- `version` (integer)
- `locked` (boolean)

**Relations**
- ToolSession belongs to Project
- ToolSession can generate Initiatives (0..*)
- ToolSession can be linked to Initiatives via SourceLinks

### 4.0.1 SourceLink (source → initiative mapping)
Canonical mapping table connecting initiatives to their sources.

**Fields**
- `source_link_id`
- `initiative_id`
- `source_type` (`TOOL` | `ASSESSMENT`)
- `source_id`
- `source_version`
- `created_at`

**Relations**
- Initiative has many SourceLinks (1..N)
- ToolSession can have many SourceLinks (0..N)
- AssessmentReport can have many SourceLinks (0..N)

### 4.1 Task
Operational execution unit.

**Fields**
- `id`
- `initiative_id`
- `title`
- `description`
- `status`
- `owner_id`
- `due_date`

### 4.2 Decision
Formal management decision.

**Fields**
- `id`
- `initiative_id`
- `type` (`APPROVAL` | `CHANGE` | `CANCEL` | `CLOSURE`)
- `description`
- `decision_status` (`PENDING` | `APPROVED` | `REJECTED` | `ESCALATED`)
- `decided_by`
- `decided_at`
 - `impact` (scope / budget / timeline / kpi; JSON or structured fields)
 - `change_kind` (nullable; `UNBLOCK` | `SCOPE` | `BUDGET` | `TIMELINE` | `KPI`)

> Decisions are immutable records and must be auditable.

### 4.3 EconomicAnalysis
Financial evaluation (tool-based).

**Fields**
- `analysis_id`
- `initiative_id`
- `owner` (Business Owner)
- `currency` (ISO code)
- `total_cost` (numeric)
- `expected_benefit` (numeric)
- `benefit_type` (cost saving / revenue / risk)
- `payback_period` (months)
- `roi` (%)
- `assumptions` (text)
- `risks` (text)
- `created_at` (timestamp)
- `version` (integer)
- `status` (`DRAFT` | `FINAL`)

### 4.4 Timeline
Planning and scheduling data.

**Fields**
- `id`
- `initiative_id`
- `planned_start`
- `planned_end`
- `milestones`

---

## 5. Assessment domain

### 5.1 Assessment
Assessment process container.

**Fields**
- `id`
- `project_id`
- `type` (`SIRI` | `DRD` | `OTHER`)
- `status`

**Relations**
- Assessment has one AssessmentReport

### 5.2 AssessmentReport
Formal audit outcome.

**Fields**
- `id`
- `assessment_id`
- `summary`
- `score_matrix`
- `status` (`DRAFT` | `FINAL`)
- `version` (integer)
- `finalized_at` (nullable)
- `locked` (boolean)

**Relations**
- AssessmentReport can generate many Initiatives
- AssessmentReport can be linked to Initiatives via SourceLinks

---

## 6. Interview & insights

### 6.1 Interview
Structured interview session.

**Fields**
- `id`
- `project_id`
- `conducted_by`
- `transcript`

**Relations**
- Interview has many Insights

### 6.2 Insight
Contextual observation.

**Fields**
- `id`
- `interview_id`
- `content`
- `category`

---

## 7. Benefits domain

### 7.1 BenefitsEvaluation
Post-execution evaluation.

**Fields**
- `id`
- `initiative_id`
- `financial_outcome`
- `operational_outcome`
- `rating`
- `comments`

### 7.2 BenefitsRecord
Time-based tracking snapshot (monthly/quarterly).

**Fields**
- `id`
- `initiative_id`
- `period`
- `financial_metrics`
- `operational_metrics`
- `created_at`

**Relations**
- Initiative has many BenefitsRecords
- BenefitsEvaluation aggregates BenefitsRecords

---

## 8. Role assignment

### 8.1 ProjectRoleAssignment
Maps users to roles per project.

**Fields**
- `id`
- `user_id`
- `project_id`
- `role` (`SPONSOR` | `PMO` | `BUSINESS_OWNER` | `CONSULTANT` | `EXECUTION_LEAD` | `STEERING_COMMITTEE`)

Bootstrap rule (MVP):
- project cannot start without: `SPONSOR`, `PMO`, `BUSINESS_OWNER`

---

## 9. AI support layer (non-persistent)
AI outputs are:\n- derived from existing entities\n- optionally stored as annotations\n- never authoritative

No separate AI entities.

---

## 10. Implementation notes
- Initiative is the aggregate root
- All writes go through Initiative boundaries
- Status transitions must be gate-controlled
- Decisions are immutable records
- Benefits close the lifecycle
- No initiative exists without a traceable source (SourceLink to ToolSession/AssessmentReport)

