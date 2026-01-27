## Overview
This document describes the **Interview Templates Library** (MVP: 6 templates) and the **AI-assisted** workflow for human-in-the-loop completion of structured interviews.

Constraints:
- **No redesign of UI/UX**: only data + logic wiring.
- Interview remains **facts-only** (no recommendations inside interview answers).

## MVP: 6 templates (manufacturing-first + quick)
These templates are seeded into the database table `interview_templates` (global library) with questions in `interview_template_questions`.

### 1) Operational Excellence
- **Goal**: identify bottlenecks, waste, handoffs, quality loss, and flow constraints in critical processes.
- **Best for**: production/operations leaders, process owners, supervisors.
- **Outputs**: facts about process steps, delays, rework, exceptions; candidate opportunities via tags.

### 2) Digital Maturity Discovery
- **Goal**: baseline of systems, data capture, automation, and operational visibility (manufacturing context).
- **Best for**: IT/OT owners, planning/engineering, ops leadership.
- **Outputs**: systems map, integration pain, automation baseline, data capture maturity.

### 3) Cost & Efficiency
- **Goal**: identify **cost drivers**, quantify baseline where possible, and surface 30/60/90-day quick wins.
- **Best for**: controlling/finance + ops/process owner.
- **Outputs**: cost driver facts, savings hypotheses, constraints to respect.

### 4) Data & Metrics
- **Goal**: evaluate **measurement maturity** and **trust in numbers** (definitions, sources, quality).
- **Best for**: BI/analytics, controlling, process owners.
- **Outputs**: KPI map, sources-of-truth gaps, data-quality issues, reporting effort.

### 5) Standard Work
- **Goal**: determine how standardized work is (SOPs, training, quality gates, deviations handling).
- **Best for**: line leaders, QA, HR/training, process owners.
- **Outputs**: standardization gaps, onboarding/training facts, control points.

### 6) Quick Assessment
- **Goal**: short structured intake when a full interview is not needed.
- **Best for**: first call, early scoping, limited time stakeholders.
- **Outputs**: 1 objective, 1 key pain point, and initial quick wins.

## “Soon” templates (planned extensions)
These will be added after validating MVP templates in real projects.

### A) Automation Readiness (RPA/AI)
- **Why**: separate, deeper assessment for automation candidates beyond digital maturity.
- **Adds**: exception rate, structured vs unstructured inputs, compliance constraints, integration feasibility.

### B) Voice of Employee / Change Readiness
- **Why**: capture adoption risks, resistance, capability gaps, and support needs.
- **Adds**: readiness signals, leadership/communication effectiveness, training plan inputs.

### C) Customer Experience / Service Blueprint
- **Why**: if customer experience is a key value driver, map touchpoints + backstage dependencies.
- **Adds**: moments of truth, handoff failures, emotional highs/lows, policy friction.

### D) IT–Business Alignment
- **Why**: for larger orgs, ensure prioritization and governance align with business strategy.
- **Adds**: metrics-to-strategy linkage, portfolio governance, risk/compliance balance.

## AI Assist (Human-in-the-loop)
AI is used to **accelerate and improve quality** of data capture while the user stays in control.

### Mode 1: Per-question AI Assist (draft suggestion)
- User expands a question and clicks **AI**.
- System calls `POST /api/interview/questions/:questionId/ai-suggest`.
- AI returns a **draft** answer (facts-only).
- User reviews/edits and then saves the answer normally.

### Mode 2: Chat → field insert
- User opens a **Chat** for a specific question and discusses context.
- When ready, user clicks **Insert to question**.
- System calls `POST /api/interview/sessions/:sessionId/ai-parse` with the transcript and target questionId(s).
- AI returns structured `{ questionId, answerText }` pairs; UI inserts draft into the question for final review.

### Safety / quality rules
- **Facts only**: no recommendations or action plans in interview answers.
- **Missing info**: AI should explicitly note missing data if needed.
- **PII caution**: avoid pasting sensitive personal data into chat or answers unless necessary.

## Technical notes
- Templates are global by default (`organization_id = NULL`), with `visibility` and permissions controlling access.
- Sessions created from templates snapshot question text into `interview_questions` and store `template_id` and `template_version`.

