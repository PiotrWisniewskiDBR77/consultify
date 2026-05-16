# Consultify Document Studio v1 — Document Type Taxonomy

> Status: Canonical v1
> Owner: Product + Engineering
> Authority: Highest for the catalog of supported document types in Document Studio, their default audience, purpose, required and optional inputs, default section blueprint, formatting class and approval rules.
> Position: Companion to `CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`. Read the SSOT first.
>
> Inheritance:
> - Report-class types (`R1` through `R4`) inherit `REPORTING_CANONICAL_TEMPLATES.md` semantics for required sections, RAG and escalation. This file does not redefine them.
> - All types inherit V8.1 lifecycle and visibility scopes.
> - All types inherit source traceability rules from `SOURCE_TRACEABILITY_SPEC.md`.

---

## 1. Type registry overview

Document Studio v1 supports the document types listed below. Each type maps to a `DocumentTemplate` once a template exists; in MVP-1 all types may be created in Mode 1 without a template.

| Key | Type name | Family | Default audience | Goal |
| --- | --- | --- | --- | --- |
| `executive_memo` | Executive Memo | memo | Board, sponsor | Inform / Decide |
| `decision_memo` | Decision Memo | memo | Steering committee | Decide |
| `project_status_report` | Project Status Report | report (R1) | PMO, project team | Inform |
| `steering_committee_report` | Steering Committee Report | report (R2) | Sponsors, board | Decide |
| `benefits_tracking_report` | Benefits Tracking Report | report (R3) | Business owners | Inform / Align |
| `portfolio_overview` | Portfolio Overview | report (R4) | Executives, owner | Inform / Decide |
| `ai_audit_report` | AI Audit Report | audit | C-level, transformation officer | Recommend |
| `interview_summary_report` | Interview Summary Report | summary | Internal, sponsor | Inform |
| `digital_transformation_roadmap` | Digital Transformation Roadmap | roadmap | Sponsor, PMO | Recommend / Align |
| `business_case` | Business Case | analytical | Sponsor, board | Decide |
| `sales_proposal` | Sales Proposal | commercial | Client | Sell |
| `client_discovery_report` | Client Discovery Report | discovery | Client, internal | Inform / Align |
| `workshop_summary` | Workshop Summary | summary | Internal, client | Align |
| `risk_register_report` | Risk Register Report | governance | PMO, steering | Inform / Decide |
| `sop_document` | SOP Document | operational | Operations | Inform |
| `implementation_plan` | Implementation Plan | planning | PMO, owners | Align |
| `change_management_plan` | Change Management Plan | planning | Org-change leads | Align |
| `board_report` | Board Report | governance | Board, supervisory board | Inform / Decide |
| `research_report` | Research Report | research | Internal | Inform |
| `due_diligence_note` | Due Diligence Note | analytical | Investment, strategy | Recommend |
| `internal_policy_document` | Internal Policy Document | policy | All employees | Inform / Align |
| `client_final_report` | Client Final Report | summary | Client | Inform / Align |

Family meanings:

- `memo` — short, decision-oriented document.
- `report` — formal management report (R1–R4 inherit the report family).
- `audit` — formal audit deliverable.
- `summary` — synthesis of a process or session.
- `analytical` — long-form analysis with recommendations.
- `commercial` — client-facing offering.
- `discovery` — output of an exploratory engagement step.
- `governance` — formal governance artefact.
- `operational` — operational document such as SOP.
- `planning` — plan with phases, owners and milestones.
- `policy` — internal rule document.
- `research` — research session output.
- `roadmap` — multi-wave roadmap document.

---

## 2. Type entries

Each entry below specifies: purpose, audience, goal, required and optional inputs, default sections, formatting class, approval rules, traceability anchor.

### 2.1 `executive_memo`

- Purpose: short decision-oriented memo for board or sponsor.
- Audience: Board, sponsor.
- Goal: inform or decide.
- Required inputs: 1 source (`ToolSession`, `AssessmentReport`, `Initiative`, `Decision`, `Notebook`).
- Optional inputs: KPI snapshot, financial figure.
- Default sections (Mode 1): `Executive Summary`, `Context`, `Findings`, `Recommendations`, `Decisions Required`, `Next Steps`.
- Formatting class: `executive`.
- Approval rule (template default): export approval not required for internal; required for `client_confidential`.
- Traceability: 1 canonical source minimum.

### 2.2 `decision_memo`

- Purpose: support a single decision under a recommendation.
- Audience: Steering committee.
- Goal: decide.
- Required inputs: 1 `ToolSession` or `AssessmentReport` plus the `Decision` object being supported.
- Optional inputs: risk register entries, financial scenario.
- Default sections: `Decision in One Sentence`, `Context`, `Options`, `Recommended Option`, `Risks`, `Next Steps`.
- Formatting class: `executive`.
- Approval rule: export approval not required for internal; recommended for board.

### 2.3 `project_status_report` (R1)

- Family: `report` (R1 — Weekly Execution Report).
- Inherits: `REPORTING_CANONICAL_TEMPLATES.md` R1 rules, RAG, escalation.
- Audience: PMO, project team.
- Goal: inform.
- Required inputs: `Project`, period range, initiatives portfolio, tasks status, decisions.
- Default sections: per R1 canonical template.
- Formatting class: `professional`.
- Approval rule: per R1 canon.

### 2.4 `steering_committee_report` (R2)

- Family: `report` (R2 — Steering Committee Report).
- Inherits: `REPORTING_CANONICAL_TEMPLATES.md` R2 rules.
- Audience: Sponsors, board.
- Goal: decide / align.
- Required inputs: per R2 canon, including escalations and benefits.
- Default sections: per R2 canonical template.
- Formatting class: `executive`.
- Approval rule: typically required for distribution.

### 2.5 `benefits_tracking_report` (R3)

- Family: `report` (R3).
- Inherits: `REPORTING_CANONICAL_TEMPLATES.md` R3 rules.
- Audience: Business owners.
- Goal: inform / align.
- Required inputs: `BenefitsRecord` set, `EconomicAnalysis`, KPI evidence.
- Default sections: per R3 canon.
- Formatting class: `professional`.

### 2.6 `portfolio_overview` (R4)

- Family: `report` (R4).
- Inherits: `REPORTING_CANONICAL_TEMPLATES.md` R4 rules.
- Audience: Executives, owner.
- Goal: inform / decide.
- Required inputs: portfolio of `Initiative`, status, RAG, decisions, escalations.
- Default sections: per R4 canon.
- Formatting class: `executive`.

### 2.7 `ai_audit_report`

- Purpose: formal audit of AI readiness, risks, opportunities and recommended initiatives.
- Audience: CEO, CFO, transformation officer.
- Goal: recommend.
- Required inputs: audit scope, interview summaries, current state assessment, recommendations dataset.
- Optional inputs: benchmarks, peer references.
- Default sections: `Executive Summary`, `Audit Scope`, `Methodology`, `Current State`, `AI Opportunities`, `Risks and Constraints`, `Recommended Initiatives`, `Implementation Roadmap`, `Appendix`.
- Formatting class: `formal`.
- Approval rule: typically required.
- Traceability: at least one `AssessmentReport` or `ToolSession` per chapter 4–7.

### 2.8 `interview_summary_report`

- Purpose: synthesize organization interviews into findings, pain points, risks and recommended initiatives.
- Audience: Internal, sponsor.
- Goal: inform.
- Required inputs: set of `Interview` sessions, target organization context.
- Default sections: `Executive Summary`, `Scope and Methodology`, `Interview Coverage`, `Key Organizational Findings`, `Main Pain Points`, `Root Causes`, `Risks and Consequences`, `Recommended Initiatives`, `Prioritization`, `Next Steps`, `Appendix`.
- Formatting class: `formal`.
- Approval rule: typically internal review only.

### 2.9 `digital_transformation_roadmap`

- Purpose: roadmap document with phases, initiatives, milestones, capabilities and dependencies.
- Audience: Sponsor, PMO.
- Goal: recommend / align.
- Required inputs: initiatives portfolio, capability assessment, target operating model fragments.
- Default sections: `Executive Summary`, `Strategic Context`, `Target State`, `Roadmap Waves`, `Initiatives by Wave`, `Capabilities`, `Risks and Dependencies`, `Governance`, `Appendix`.
- Formatting class: `executive`.

### 2.10 `business_case`

- Purpose: economic justification for a single initiative or program.
- Audience: Sponsor, board.
- Goal: decide.
- Required inputs: `EconomicAnalysis` (mandatory), `Initiative`, `BenefitsRecord` set.
- Default sections: `Executive Summary`, `Problem Statement`, `Proposed Initiative`, `Economic Analysis`, `Benefits and KPIs`, `Risks`, `Implementation Outline`, `Recommendation`, `Appendix`.
- Formatting class: `formal`.
- Approval rule: required.

### 2.11 `sales_proposal`

- Purpose: commercial offering for a client engagement.
- Audience: Client.
- Goal: sell.
- Required inputs: client context, scope, assumptions, pricing, team.
- Default sections: `Executive Summary`, `Client Context`, `Proposed Approach`, `Scope`, `Team and Credentials`, `Timeline`, `Investment`, `Assumptions`, `Next Steps`.
- Formatting class: `executive`.
- Approval rule: required for external delivery.
- Confidentiality default: `client_confidential`.

### 2.12 `client_discovery_report`

- Purpose: synthesis of a discovery engagement.
- Audience: Client, internal.
- Goal: inform / align.
- Required inputs: `Interview`, `ToolSession`, scope notes.
- Default sections: `Executive Summary`, `Discovery Scope`, `Findings`, `Themes`, `Hypotheses`, `Next Steps`, `Appendix`.
- Formatting class: `professional`.

### 2.13 `workshop_summary`

- Purpose: capture a workshop with decisions, themes and next steps.
- Audience: Internal, client.
- Goal: align.
- Required inputs: workshop notes, participants, decisions, themes.
- Default sections: `Executive Summary`, `Workshop Context`, `Themes`, `Decisions`, `Open Questions`, `Next Steps`, `Appendix`.
- Formatting class: `professional`.

### 2.14 `risk_register_report`

- Purpose: structured register of risks with owners and mitigations.
- Audience: PMO, steering.
- Goal: inform / decide.
- Required inputs: risk records, owners, mitigation plans.
- Default sections: `Executive Summary`, `Risk Methodology`, `Risk Register Table`, `Top Risks Detail`, `Mitigation Plans`, `Owners`, `Next Review`.
- Formatting class: `professional`.

### 2.15 `sop_document`

- Purpose: standard operating procedure for a process.
- Audience: Operations.
- Goal: inform.
- Required inputs: process scope, roles, steps, controls.
- Default sections: `Purpose`, `Scope`, `Roles`, `Process Steps`, `Inputs and Outputs`, `Controls`, `Exceptions`, `Revision History`.
- Formatting class: `formal`.
- Approval rule: required for `approved` status.

### 2.16 `implementation_plan`

- Purpose: wave-by-wave delivery plan.
- Audience: PMO, owners.
- Goal: align.
- Required inputs: initiatives, dependencies, milestones, owners.
- Default sections: `Executive Summary`, `Plan Approach`, `Waves`, `Milestones`, `Dependencies`, `Owners`, `Risks`, `Governance`, `Appendix`.
- Formatting class: `professional`.

### 2.17 `change_management_plan`

- Purpose: change management plan for a transformation effort.
- Audience: Org-change leads.
- Goal: align.
- Required inputs: stakeholder map, communication plan, training plan, adoption KPIs.
- Default sections: `Executive Summary`, `Stakeholder Analysis`, `Communication Plan`, `Training Plan`, `Adoption KPIs`, `Risks`, `Governance`.
- Formatting class: `professional`.

### 2.18 `board_report`

- Purpose: formal board document.
- Audience: Board, supervisory board.
- Goal: inform / decide.
- Required inputs: portfolio status, financials, risks, decisions.
- Default sections: per template, with explicit `Decisions Required` and `For Information` blocks.
- Formatting class: `formal`.
- Approval rule: required for distribution.

### 2.19 `research_report`

- Purpose: output from a research session.
- Audience: Internal.
- Goal: inform.
- Required inputs: `ResearchSession`.
- Default sections: `Executive Summary`, `Research Question`, `Method`, `Sources`, `Findings`, `Implications`, `Open Questions`.
- Formatting class: `professional`.

### 2.20 `due_diligence_note`

- Purpose: diligence deliverable for an investment or strategic decision.
- Audience: Investment, strategy.
- Goal: recommend.
- Required inputs: target context, financial data, risks, opportunities.
- Default sections: `Executive Summary`, `Target Overview`, `Strategic Fit`, `Financial Snapshot`, `Operational Snapshot`, `Risks`, `Opportunities`, `Recommendation`.
- Formatting class: `formal`.
- Approval rule: required.
- Confidentiality default: `restricted`.

### 2.21 `internal_policy_document`

- Purpose: internal policy under governance.
- Audience: All employees.
- Goal: inform / align.
- Required inputs: policy scope, owner, applicability.
- Default sections: `Purpose`, `Scope`, `Definitions`, `Policy Statements`, `Roles`, `Compliance`, `Revision History`.
- Formatting class: `formal`.
- Approval rule: required for `approved` status.

### 2.22 `client_final_report`

- Purpose: end-of-project final report for a client.
- Audience: Client.
- Goal: inform / align.
- Required inputs: project context, scope, results, KPIs, recommendations, next steps.
- Default sections: `Executive Summary`, `Project Context`, `Scope and Approach`, `Key Results`, `KPIs`, `Recommendations`, `Next Steps`, `Appendix`.
- Formatting class: `formal`.
- Approval rule: required for external delivery.
- Confidentiality default: `client_confidential`.

---

## 3. Formatting classes

The formatting class is a high-level signal used by the Formatting & Style Engine and by template seeds. v1 classes:

- `executive` — concise, bold callouts for decisions and recommendations, smaller body, larger headings.
- `professional` — balanced consulting register, clear tables, mid-density.
- `formal` — full structure with cover page, TOC, headers/footers, page numbers, lettered or numbered appendices, conservative typography.
- `legal` — formal class with conservative typography and explicit revision-history block.

Concrete `FormattingSchema` objects per class are seeded in MVP-2 alongside the Template Architect.

---

## 4. Required source classes (anchor matrix)

| Type | Required canonical source |
| --- | --- |
| `executive_memo` | At least one of: `ToolSession`, `AssessmentReport`, `Initiative`, `Decision`, `Notebook` |
| `decision_memo` | At least one source plus a `Decision` object |
| `project_status_report` (R1) | Per R1 canon |
| `steering_committee_report` (R2) | Per R2 canon |
| `benefits_tracking_report` (R3) | `BenefitsRecord` + `EconomicAnalysis` |
| `portfolio_overview` (R4) | Initiative portfolio + status |
| `ai_audit_report` | `AssessmentReport` and/or `ToolSession` |
| `interview_summary_report` | One or more `Interview` |
| `digital_transformation_roadmap` | Initiative portfolio + capability assessment |
| `business_case` | `EconomicAnalysis` + `Initiative` + `BenefitsRecord` |
| `sales_proposal` | Client context (CRM/Notebook), scope notes |
| `client_discovery_report` | `Interview` and/or `ToolSession` |
| `workshop_summary` | Workshop notes (`ToolSession` of workshop type) |
| `risk_register_report` | Risk records |
| `sop_document` | Process scope and steps |
| `implementation_plan` | Initiatives + dependencies |
| `change_management_plan` | Stakeholder map + communication plan |
| `board_report` | Portfolio + decisions + risks |
| `research_report` | `ResearchSession` |
| `due_diligence_note` | Target context + financials |
| `internal_policy_document` | Policy scope |
| `client_final_report` | Project results + KPIs |

Canonical rule:

> If the required canonical source is missing, the run MUST surface `missing_required_source` in `ArtifactRunFailurePackage` (V8.1) and the document MUST NOT enter `draft` state.

---

## 5. Approval defaults

| Type | Export approval default |
| --- | --- |
| `sales_proposal`, `client_final_report`, `board_report`, `due_diligence_note`, `business_case`, `ai_audit_report`, `internal_policy_document`, `sop_document` (when `approved`) | required |
| All other types | not required by default; templates can override |

---

## 6. Confidentiality defaults

| Type | Default confidentiality |
| --- | --- |
| `due_diligence_note` | `restricted` |
| `sales_proposal`, `client_final_report` | `client_confidential` |
| `client_discovery_report` | `client_confidential` if linked to a client engagement, else `internal` |
| All other types | `internal` |

The user may override at intake; the V8.1 visibility scope is set accordingly.

---

## 7. Open follow-ups

- Author seeded `system`-scope `DocumentTemplate` records for all 22 types in MVP-2.
- Define language-specific variants (PL/EN) for default sections per type.
- Decide whether `executive_memo` and `decision_memo` are merged into one class with a `decision_required` flag (revisit in MVP-2).
