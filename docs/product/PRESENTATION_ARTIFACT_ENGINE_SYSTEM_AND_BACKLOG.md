# Presentation Artifact Engine — System Documentation + Backlog

Status: `DRAFT_FOR_EXECUTION`
Owner: Product + Engineering + QA
Scope: Consultify Presentation Studio / Deck OS
Date: 2026-05-06

Related references:

- `docs/product/PRESENTATION_ARTIFACT_ENGINE_REFERENCE.md`
- `docs/testing/PRESENTATION_QUALITY_GOVERNANCE_SCORECARD.md`
- `docs/testing/PRESENTATION_BENCHMARK_SCORECARD.md`
- `docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`
- `docs/testing/PRESENTATION_SLI_SLO.md`
- `docs/product/EXECUTION_TASK_METADATA_STANDARD.md`
- `docs/product/PRESENTATION_RBAC_MATRIX.md`

---

## 1. Product Definition

Consultify Presentation Studio is a **governed artifact engine** that transforms consulting work outputs (research, interviews, audits, roadmap, project status, business case) into board-ready presentations.

System principle:

- **not** "AI makes slides",
- **but** "AI plans + generates + edits a decision artifact under governance".

---

## 2. System Goals

### 2.1 Business goals

- Deliver client-grade decks with repeatable quality.
- Reduce manual deck production time.
- Standardize communication quality across teams.
- Convert internal workstreams into reusable, auditable outputs.

### 2.2 Quality goals

- No placeholder/encoding/raw-internal defects in exports.
- Decision slides are always source-backed.
- Full parity across `web`, `PDF`, `PPTX`, `PNG/HTML` where supported.
- Explicit PASS vocabulary: `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

---

## 3. Target User Experience

## 3.1 Modes

1. **Free Generation (Gamma-like)**  
   Prompt -> outline proposal -> draft deck -> conversational edits.

2. **Template Planning**  
   "Plan template" -> AI proposes structure and rules -> approval -> template registry.

3. **Generate from Approved Template**  
   Select template -> source check -> data gap disclosure -> draft -> conversational edits -> approval/export.

## 3.2 Editing model (critical)

User edits through chat, not only block-by-block:

- "make more executive",
- "split slide 7",
- "move risk section before roadmap",
- "apply DBR77 brand",
- "prepare CFO version".

All larger edits must pass:

`proposal -> approval -> execution -> audit`.

---

## 4. Functional Architecture

`Request Intake -> Intent Parser -> Source Pack Builder -> Narrative Planner -> Template Architect/Selector -> Outline Approval -> Slide Schema Generator -> Deck Generator (draft) -> AI Deck Editor Runtime -> Quality Gates -> Versioning/Audit -> Export/Share`

### 4.1 Request Intake

Collects:

- presentation type,
- audience/persona,
- objective,
- mode (free/template/template-planning),
- source scope,
- tone/style,
- confidentiality,
- output targets.

### 4.2 Source Pack Builder

Builds structured source package with:

- source list and lineage,
- confidence,
- freshness,
- missing input register (`data_gap_register`),
- source coverage map.

### 4.3 Narrative Planner

Produces thesis-first storyline:

- sequence of argument,
- evidence slots,
- decision points,
- risk framing,
- action closure.

### 4.4 Template Architect + Registry

Template is an operating model:

- purpose,
- cadence,
- personas,
- required inputs,
- slide blueprint and layout rules,
- governance policy.

### 4.5 Slide Schema Generator

Creates deterministic schema per slide:

- type,
- key message,
- required blocks,
- source references,
- fallback policy,
- notes policy,
- quality constraints.

### 4.6 Deck Generator

Creates first draft from schema and source pack:

- content generation,
- layout assignment,
- brand application,
- initial QA.

### 4.7 AI Deck Editor Runtime

Conversational mutation engine:

- intent parsing,
- scope detection (`slide`, `section`, `global`, `methodological`),
- change plan,
- proposal preview,
- apply/reject,
- rollback.

### 4.8 Quality Gates

Gate classes:

- `P0` content integrity blockers,
- `P1` decision/evidence blockers,
- `P2` quality improvements.

### 4.9 Versioning + Audit

Every major change persists:

- command,
- scope,
- diff summary,
- approval status,
- version before/after,
- actor.

### 4.10 Export/Share

Supported channels:

- web artifact view,
- PDF,
- PPTX,
- PNG/HTML where enabled.

Every export has QA record (`blocked`/`failed`/`completed`).

---

## 5. UI Specification

## 5.1 Main screen layout

- Left: chat with AI Deck Editor.
- Center/right: live deck preview.
- Right inspector: template, source refs, QA state, version, pending proposals.

## 5.2 Mandatory controls

- Approve proposal,
- Reject proposal,
- Jump to affected slide,
- Show diff,
- Rollback to previous version,
- Export with quality state.

## 5.3 Honest state policy

UI must clearly show:

- blocked exports,
- data gaps,
- degraded fallback slides,
- incomplete evidence,
- stale freshness.

No fake success states.

---

## 6. Data Contract (Minimum)

## 6.1 PresentationArtifact

- identity + tenancy,
- source pack binding,
- template binding,
- lifecycle status,
- version chain,
- deck payload,
- audit metadata.

## 6.2 PresentationTemplate

- ID/version/status/owner,
- category/persona,
- required/optional inputs,
- slide blueprints,
- governance rules.

## 6.3 SlideBlueprint

- purpose,
- required data,
- layout family,
- fallback policy,
- approval flag.

## 6.4 EditOperation

- command text,
- resolved scope,
- proposed mutations,
- approval state,
- before/after versions,
- actor and timestamp.

---

## 7. Security and Governance

- Tenant and ACL checks on every artifact operation.
- Role-based constraints for template approval and brand changes.
- Confidentiality-aware export policy.
- Full audit log for AI mutations and export actions.

---

## 8. Definition of Done (System Level)

System is release-ready when:

- no open `P1` in manual gate,
- benchmark verdict is `PASS` or `PASS_WITH_P2` for DBR77 and VTS,
- export parity confirmed across required formats,
- quality score stable across 2 consecutive regression cycles.

---

# 9. Execution Backlog

Backlog is ordered by implementation dependency.

Legend:

- Priority: `P0`, `P1`, `P2`
- Type: `Product`, `Backend`, `Frontend`, `AI`, `QA`, `Infra`

## EPIC A — Governance and Quality Baseline

### A1. Formal gate taxonomy in runtime reports

- Priority: `P0`
- Type: `Backend`
- Deliverable: quality report includes `priority`, `scorecard`, PASS vocabulary.
- Acceptance:
  - reports expose `p0/p1/p2`,
  - verdict mapping is deterministic,
  - export block occurs when `P0` or `P1` exists.

### A2. Unified quality policy docs

- Priority: `P0`
- Type: `Product`
- Deliverable: single source docs for scorecard and verdict rules.
- Acceptance:
  - policy linked by QA and engineering docs,
  - PASS vocabulary used consistently in UI/API/tests.

## EPIC B — Source Pack and Evidence Discipline

### B1. Source coverage and data gap register

- Priority: `P0`
- Type: `Backend`
- Deliverable: structured `source_coverage_map` + `data_gap_register`.
- Acceptance:
  - each source has extraction state,
  - failures recorded with owner-facing issue text.

### B2. Decision slide evidence requirements

- Priority: `P1`
- Type: `Backend`
- Deliverable: gates for missing traceability/low confidence/stale evidence.
- Acceptance:
  - decision intents enforce source refs,
  - blockers surface card index where possible.

## EPIC C — Template Intelligence and Slide Grammar

### C1. Template runtime fallback policy

- Priority: `P0`
- Type: `Backend`
- Deliverable: per-intent fallback (`degradation_notice`, `skip_slide`, `keep_with_warning`).
- Acceptance:
  - no empty critical slides when source missing,
  - degradation slide appears with explicit data-gap message.

### C2. Template registry governance

- Priority: `P1`
- Type: `Backend + Product`
- Deliverable: template states and approval flow (`draft`, `approved`, `deprecated`).
- Acceptance:
  - only authorized roles approve templates,
  - version lineage tracked.

## EPIC D — AI Deck Editor Runtime

### D1. Edit intent parser + scope detector

- Priority: `P0`
- Type: `AI + Backend`
- Deliverable: classify command scope (`slide`, `section`, `global`, `methodological`).
- Acceptance:
  - parser outputs stable scope with confidence,
  - unsupported intent returns explicit no-op reason.

### D2. Proposal-first mutation pipeline

- Priority: `P0`
- Type: `Backend`
- Deliverable: non-trivial edits produce proposal before apply.
- Acceptance:
  - apply requires approval token,
  - reject leaves deck unchanged,
  - audit record persisted.

### D3. Rollback and version chain

- Priority: `P1`
- Type: `Backend`
- Deliverable: rollback endpoint from `version_after -> version_before`.
- Acceptance:
  - rollback is traceable and reversible,
  - quality gates re-run after rollback.

## EPIC E — Frontend Productization

### E1. Deck editor inspector panel

- Priority: `P1`
- Type: `Frontend`
- Deliverable: shows template binding, QA result, evidence health, version.
- Acceptance:
  - card-level blockers are clickable,
  - scorecard visible in quality panel.

### E2. Actionable blocked flow

- Priority: `P1`
- Type: `Frontend`
- Deliverable: blocked export opens gate panel and navigates to first blocker.
- Acceptance:
  - no fake success toast,
  - jump-to-slide works for blockers with index.

### E3. Conversational edit UX

- Priority: `P1`
- Type: `Frontend`
- Deliverable: proposal preview + approve/reject + diff summary in chat/deck view.
- Acceptance:
  - user sees scope and intended changes before apply,
  - status updates reflected in deck preview.

## EPIC F — Export Fidelity and Ledger

### F1. Cross-format parity checks

- Priority: `P1`
- Type: `Backend + QA`
- Deliverable: parity checks for cover/dashboard/insight/roadmap/appendix.
- Acceptance:
  - header/footer/page/confidentiality parity validated on required formats.

### F2. Export QA records as release artifact

- Priority: `P1`
- Type: `Backend`
- Deliverable: export records include status + quality snapshot.
- Acceptance:
  - `blocked/failed/completed` semantics correct,
  - failed export never appears as completed.

## EPIC G — Testing System

### G1. Unit/contract suite for gates and runtime

- Priority: `P0`
- Type: `QA + Backend`
- Deliverable: tests for governance, fallback, evidence blockers.
- Acceptance:
  - deterministic pass/fail scenarios for `P0/P1/P2`.

### G2. Playwright contract flow for blocked/success export

- Priority: `P1`
- Type: `QA`
- Deliverable: browser contract verifies no fake download on blocker.
- Acceptance:
  - blocked path returns expected payload and no file download.

### G3. Manual gate operating cycle (Antygravity)

- Priority: `P1`
- Type: `QA + Product`
- Deliverable: reusable manual gate checklist and reporting cadence.
- Acceptance:
  - result vocabulary and evidence standard enforced.

## EPIC H — Benchmark Loop

### H1. Monthly DBR77/VTS benchmark run

- Priority: `P1`
- Type: `Product + QA`
- Deliverable: monthly scorecard with deltas.
- Acceptance:
  - all 4 dimensions recorded,
  - verdict + action owners documented.

### H2. Regression trend dashboard

- Priority: `P2`
- Type: `Product + Data`
- Deliverable: trend view for quality trajectory vs target.
- Acceptance:
  - visible movement toward Gamma-level target by dimension.

---

## 10. Sprint Packaging (Suggested)

### Sprint 1 (Stability P0)

- A1, B1, C1, D1, D2, G1

### Sprint 2 (Client Quality)

- B2, C2, E1, E2, F2, G2

### Sprint 3 (Product Maturity)

- E3, F1, G3, H1

### Sprint 4 (Scale and Optimization)

- H2 + performance/refinement backlog.

---

## 11. Backlog Management Rules

- No task can move to `done` without acceptance evidence.
- Any `P1` regression reopens parent epic.
- Any UI behavior change must include source-of-truth compliance check.
- Benchmark deltas feed next sprint prioritization.

---

## 12. Internal Audit — Completeness Check

Audit date: 2026-05-06  
Scope: architecture, governance, QA, rollout, and task-system sufficiency.

### 12.1 Coverage Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Product model and modes | `COMPLETE` | Free/template/template-planning covered. |
| AI deck editor runtime | `COMPLETE` | Intent/scope/proposal/approval/rollback represented. |
| Quality and PASS vocabulary | `COMPLETE` | P0/P1/P2 + release verdicts defined. |
| Evidence discipline | `COMPLETE` | source coverage, confidence, freshness in scope. |
| UX behavior standards | `PARTIAL` | Needed stricter mapping to Menu 3 and honest degraded UX gates in rollout tasks. |
| Export fidelity and ledger | `PARTIAL` | Functional tasks present, missing SLO/monitoring and runbook closure. |
| Security/ACL/compliance | `PARTIAL` | Requirements exist, but implementation backlog lacked explicit permission matrix tests and abuse cases. |
| Data migration/backward compatibility | `MISSING` | No dedicated migration strategy tasks for legacy decks/templates. |
| Observability/operations | `MISSING` | No SLI/SLO, dashboards, on-call runbooks, incident protocol tasks. |
| Release management/task governance | `PARTIAL` | Sprint plan exists, but backlog lacked formal task schema and stage gates per environment. |

### 12.2 Audit Verdict

Current documentation is strong product-wise, but execution system was not fully complete for enterprise delivery.  
To make documentation "success-critical", missing operational and governance tasks are added below as new epics.

---

## 13. Additional Epics (Added After Audit)

## EPIC I — Data Migration and Backward Compatibility

### I1. Legacy deck normalization migration

- Priority: `P0`
- Type: `Backend + Infra`
- Deliverable: migration job for historical decks to canonical artifact schema.
- Acceptance:
  - migration report includes success/failure counts,
  - failed rows have retry queue,
  - no data loss in source lineage or export history.

### I2. Template migration compatibility layer

- Priority: `P1`
- Type: `Backend`
- Deliverable: compatibility adapter for older template payloads and deprecated fields.
- Acceptance:
  - old templates render with deterministic fallback,
  - migration warnings are visible in admin diagnostics.

### I3. Roll-forward / rollback migration runbook

- Priority: `P1`
- Type: `Infra + QA`
- Deliverable: documented migration + rollback steps for staging and production.
- Acceptance:
  - dry-run executed on staging snapshot,
  - rollback path tested and signed off.

## EPIC J — Observability, SLO, and Incident Readiness

### J1. SLI/SLO definition for presentation pipeline

- Priority: `P0`
- Type: `Infra + Product`
- Deliverable: SLO doc for generation success, export success, latency, and blocker rates.
- Acceptance:
  - SLI formulas documented,
  - alert thresholds approved by delivery owner.

### J2. Telemetry for agent edits and quality blockers

- Priority: `P1`
- Type: `Backend + Frontend`
- Deliverable: events for proposal created/approved/rejected/applied, gate blocks, rollback usage.
- Acceptance:
  - telemetry visible in dashboard,
  - tenant-safe event payload policy enforced.

### J3. Incident runbooks and triage protocol

- Priority: `P1`
- Type: `Infra + QA`
- Deliverable: runbooks for `export blocked spikes`, `failed exports`, `stuck generation`, `template corruption`.
- Acceptance:
  - each runbook contains detection, containment, recovery, communication checklist.

## EPIC K — Security, Permissions, and Compliance Hardening

### K1. Permission matrix for artifact actions

- Priority: `P0`
- Type: `Backend + Product`
- Deliverable: explicit RBAC matrix for create/edit/approve/export/share/template-approve/brand-change.
- Acceptance:
  - matrix mapped to API guards,
  - unauthorized access tests included.

### K2. Confidentiality-aware export and share controls

- Priority: `P1`
- Type: `Backend + Frontend`
- Deliverable: policy enforcement by confidentiality tier and role.
- Acceptance:
  - blocked actions explain reason,
  - no hidden bypass via direct endpoint.

### K3. Audit integrity checks

- Priority: `P1`
- Type: `Backend + QA`
- Deliverable: verification job ensuring all applied edits and exports have audit records.
- Acceptance:
  - missing audit records trigger P1 alert.

## EPIC L — Task System Governance (Execution Discipline)

### L1. Task schema standardization

- Priority: `P0`
- Type: `Product + PMO`
- Deliverable: every task must include owner, due window, dependencies, acceptance evidence type, risk tag.
- Acceptance:
  - no task enters sprint without required metadata.

### L2. Stage-gate workflow by environment

- Priority: `P1`
- Type: `PMO + QA`
- Deliverable: enforced gates: `dev -> staging -> preprod/manual gate -> production`.
- Acceptance:
  - gate checklist required per promotion,
  - PASS vocabulary mandatory on release decision.

### L3. Documentation change control

- Priority: `P1`
- Type: `Product`
- Deliverable: change log + review owner for reference docs and backlog docs.
- Acceptance:
  - every backlog/document update has rationale and impact note.

---

## 14. Updated Sprint Packaging (Post-Audit)

### Sprint 1 (Stability P0)

- A1, B1, C1, D1, D2, G1, I1, J1, K1, L1

### Sprint 2 (Client Quality)

- B2, C2, E1, E2, F2, G2, I2, J2, K2, L2

### Sprint 3 (Production Readiness)

- E3, F1, G3, H1, I3, J3, K3, L3

### Sprint 4 (Scale and Optimization)

- H2 + performance/refinement backlog + residual `P2`.

---

## 15. Final Audit Outcome

After adding Epics `I-J-K-L`, the task system is now complete for:

- product capability delivery,
- enterprise governance and compliance,
- operational reliability,
- migration safety,
- release discipline.

Documentation can now serve as execution baseline, not only product vision.