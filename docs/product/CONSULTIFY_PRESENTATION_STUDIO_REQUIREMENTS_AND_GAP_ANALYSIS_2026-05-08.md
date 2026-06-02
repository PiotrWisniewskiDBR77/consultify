# Consultify Presentation Studio - Requirements And Gap Analysis

Status: `DRAFT_FOR_REVIEW`
Owner: Product + Engineering + QA
Date: 2026-05-08
Scope: Presentation Generator / Presentation Studio / Deck OS in Consultify

Related source-of-truth documents:

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `consultify/docs/product/PREZENTACJE_V8_SSOT.md`
- `consultify/docs/product/PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`
- `consultify/docs/product/PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`
- `consultify/docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`

---

## 1. Product Thesis

Consultify Presentation Studio must not be a simple "AI slide generator" and must not become a thin wrapper around Gamma.

Gamma is strong at:

- fast prompt-to-deck generation,
- attractive web-native visual output,
- theme-driven deck creation,
- generation from text and templates,
- export to PDF, PNG and PowerPoint.

Consultify must be stronger in a different class:

- methodology-first planning,
- source-backed business context,
- reusable approved templates as operating standards,
- governed slide schema,
- consulting QA,
- artifact versioning,
- auditability,
- controlled editing,
- tenant-safe enterprise delivery.

Canonical product distinction:

```text
Gamma:
prompt -> outline -> deck

Consultify:
business context -> artifact source pack -> AI template/narrative plan -> approval
-> deck schema -> slide generation -> design rendering -> review -> versioned artifact
-> export/share
```

This means the target is not "make slides like Gamma". The target is:

> Build a governed presentation artifact engine that converts consulting and management work into client-grade decision decks.

---

## 2. Module Name And Product Boundary

Recommended product name:

- `Consultify Presentation Studio`

Alternative internal name:

- `Consultify Deck OS`

Product boundary:

- The module belongs inside the existing Reports & Presentations / Outputs surface.
- It must reuse existing Consultify artifact, tenant, RBAC, export, share, brand, and AI governance systems.
- It must not introduce a parallel artifact registry.
- It must not depend on Gamma as the core authoring/runtime engine.
- Gamma may be used only as benchmark, inspiration, optional renderer, or temporary comparison provider.

---

## 3. Strategic Principles

### 3.1 Methodology First

The system starts from:

- business goal,
- target audience,
- meeting type,
- decision context,
- risks,
- data,
- source evidence,
- narrative structure.

Only after that should it choose:

- template,
- slide blueprint,
- layout,
- theme,
- export format.

### 3.2 Artifact First

Every generated deck is a governed artifact, not just a downloadable PPT file.

Required artifact properties:

- stable deck id,
- organization/tenant id,
- source pack id or source refs,
- template id when applicable,
- lifecycle status,
- version history,
- audit log,
- export history,
- share state,
- quality gate status.

### 3.3 Outline And Template Approval Before Execution

The user must see and approve important AI plans before material changes:

- free generation outline,
- template plan,
- source gap resolution,
- AI edit proposal,
- export/share when governance applies.

All significant AI mutations must follow:

```text
proposal -> approval -> execution -> audit
```

### 3.4 Source Truth Over Attractive Hallucination

The system may generate visually attractive slides, but it must not fake source grounding.

Every important claim, KPI, recommendation, risk, quote, decision, roadmap item, and business case number must be one of:

- source-backed,
- explicitly assumed,
- marked as missing/incomplete,
- blocked by policy.

### 3.5 Business Layouts, Not Only Smart Layouts

Gamma has smart layouts. Consultify needs business layouts:

- executive summary,
- decision slide,
- risk heatmap,
- KPI cards,
- initiative portfolio,
- roadmap,
- RACI,
- maturity matrix,
- interview insights,
- CFO bridge,
- business case,
- action plan.

---

## 4. Required Modes

### 4.1 Mode 1 - Generate Like Gamma

Goal:

User can create a professional deck quickly from a prompt.

Example prompt:

```text
Przygotuj prezentacje o wynikach interview VTS dla zarzadu.
```

System must propose:

- deck objective,
- audience,
- number of slides,
- narrative outline,
- visual style,
- source assumptions,
- missing inputs,
- export targets.

Required flow:

```text
prompt -> intent parse -> source scope -> outline proposal -> user approval
-> deck generation -> preview -> governed edits -> export/share
```

Acceptance requirements:

- User can start from chat and from UI.
- Template is optional.
- Source artifacts can be selected, suggested, or absent.
- If sources are absent, deck must be marked as AI-draft / partially grounded.
- User sees outline before deck generation.
- Generated deck is visible in builder and Outputs Library.
- Deck can be exported/share-linked only if governance allows.

### 4.2 Mode 2 - Plan Template First

Goal:

User can ask AI to design a reusable presentation template before any deck is generated.

Example prompt:

```text
Zaplanuj template spotkania KS projektu.
```

System must produce a reviewable template plan:

- template name,
- purpose,
- intended cadence,
- audience/personas,
- required data,
- optional data,
- slide blueprint,
- slide-level purpose,
- layout family,
- quality rules,
- governance rules,
- recommended usage boundaries.

Template planning must not silently create an approved template.

Required flow:

```text
template intent -> AI template plan -> review -> approve/reject
-> template registry draft/approved state
```

Acceptance requirements:

- User can approve, reject, or revise the template plan.
- Approved template becomes reusable.
- Template has owner, version, status and governance policy.
- Deprecated templates remain traceable.
- Only approved templates are available for governed enterprise generation unless user explicitly chooses draft/test mode.

### 4.3 Mode 3 - Generate From Approved Template

Goal:

User can generate a deck from an approved business template using Consultify data.

Example prompt:

```text
Zrob KS projektu VTS na bazie template'u Project Steering Committee Review v1.0.
```

Required flow:

```text
template selection -> required input check -> source pack build -> data gaps
-> slot mapping -> deck schema -> generation -> QA -> preview -> approval/export
```

Acceptance requirements:

- System loads the approved template and its slide blueprint.
- System checks required inputs before generation.
- Missing required inputs are shown honestly.
- User can use placeholders only when policy allows it.
- Generated slides map content to template slots.
- Quality gates validate template completeness.
- Export/share respects confidentiality, RBAC and quality gates.

### 4.4 Mode 4 - Presentation As Output Of Other Work

Goal:

Presentation Studio is an output engine for other Consultify modules.

Required mappings:

| Source work in Consultify | Output deck |
| --- | --- |
| Research Session | Research Brief Deck |
| Interview Module | Organizational Insights Deck |
| AI Audit | AI Readiness Report |
| Digital Roadmap | Transformation Roadmap Deck |
| Sales Discovery | Client Proposal Deck |
| Project Review | Steering Committee Deck |
| Strategy Workshop | Executive Decision Deck |
| KPI / ROI Analysis | Business Case Deck |

Acceptance requirements:

- Other modules can request a deck using their artifacts as source pack inputs.
- Generated deck preserves source lineage.
- Outputs Library shows the deck as a reusable artifact.
- Refresh/read-back works after page reload.

---

## 5. Required Functional Components

### 5.1 Presentation Request Intake

Purpose:

Collect and normalize user intent from chat or UI.

Required fields:

| Field | Examples |
| --- | --- |
| Presentation type | Project Steering Committee, Board Update, Sales Proposal, Roadmap |
| Audience | CEO, CFO, PMO, client sponsor, consulting partner |
| Objective | decision, information, alignment, sales, approval |
| Sources | research, interview, notes, KPI, CRM, files, previous artifacts |
| Style | executive, consulting, board-level, visual, detailed |
| Mode | free generation, AI template plan, approved template |
| Output | web, PDF, PPTX, share link |
| Confidentiality | public, internal, client confidential, restricted |

Required behavior:

- Works from chat and from UI.
- Does not hide missing required data.
- Does not execute deck generation silently when approval is required.
- Persists selected source artifacts through step changes and refresh where applicable.

### 5.2 Source Pack Builder

Purpose:

Build a structured source pack before AI creates slides.

Required data shape:

```json
{
  "source_pack_id": "sp_123",
  "client": "VTS",
  "workstream": "Interview",
  "sources": [
    "meeting_notes",
    "interview_summary",
    "research_session",
    "kpi_table",
    "previous_report"
  ],
  "confidence": "medium",
  "freshness": "current",
  "missing_inputs": [
    "final KPI confirmation",
    "client logo approval"
  ],
  "source_coverage_map": []
}
```

Required behavior:

- Uses tenant-safe, ACL-filtered sources only.
- Shows missing inputs before generation.
- Distinguishes source-backed content from AI assumptions.
- Stores or references source snapshot for audit and reproducibility.
- Supports files and other Consultify artifacts through the common organization context/source pipeline.

### 5.3 Narrative Planner

Purpose:

Plan the consulting storyline before slide generation.

The planner must determine:

- main thesis,
- sequence of arguments,
- evidence slots,
- decision points,
- risk framing,
- recommendation structure,
- action closure,
- read-vs-present density,
- audience-specific level of detail.

Required outputs:

- outline,
- slide intent list,
- key message per slide,
- evidence requirements,
- decision requirements,
- expected appendix needs,
- narrative risks.

### 5.4 AI Template Architect

Purpose:

Generate a reusable operating template, not just a visual design.

Example output:

```json
{
  "template_name": "Project Steering Committee Review",
  "purpose": "Provide executive control over project progress, risks, decisions and next milestones.",
  "recommended_frequency": "weekly or bi-weekly",
  "audience": ["CEO", "Sponsor", "PMO", "Project Owner"],
  "sections": [
    {
      "name": "Executive Status",
      "slides": ["Overall status", "Key messages", "Decision needed"]
    },
    {
      "name": "Risks and Blockers",
      "slides": ["Risk heatmap", "Critical blockers", "Mitigation plan"]
    }
  ]
}
```

Required behavior:

- Produces a proposal first.
- Requires user approval before registry promotion.
- Explains required inputs and why each slide exists.
- Produces a slide blueprint compatible with the Slide Schema Engine.

### 5.5 Template Registry

Purpose:

Store reusable presentation standards.

Required fields:

| Element | Requirement |
| --- | --- |
| Template ID | Stable identifier |
| Type/category | project, sales, strategy, research, governance |
| Owner | User/team that approved it |
| Status | draft, approved, deprecated |
| Version | v1, v2, v3 |
| Persona | CEO, CFO, PMO, client, board |
| Brand theme | Consultify, DBR77, client brand |
| Required data | Mandatory source slots |
| Optional data | Helpful source slots |
| Slide schema | Ordered blueprint |
| Layout rules | Allowed layout families |
| Governance | who can use/edit/approve |

Required behavior:

- Draft templates cannot masquerade as approved templates.
- Deprecated templates remain traceable and may point to successors.
- Org and system templates are visually distinguishable.
- Usage of templates is tenant-safe and capability-gated.

### 5.6 Slide Schema Engine

Purpose:

Represent every slide as structured data before rendering.

Required slide model:

```json
{
  "slide_id": "s_004",
  "slide_type": "risk_heatmap",
  "title": "Key Risks Requiring Steering Committee Attention",
  "message": "Three risks require executive decision this week.",
  "content_blocks": [
    {
      "type": "risk_matrix",
      "data_source": "project_risks"
    },
    {
      "type": "decision_box",
      "items": [
        "Approve additional PMO support",
        "Confirm timeline change"
      ]
    }
  ],
  "layout": "matrix_with_sidebar",
  "density": "medium",
  "speaker_notes": true
}
```

Required invariants:

- Every deck has a canonical schema version.
- Every slide/card has stable id and order.
- Every content block has stable id.
- Refreshable blocks require source references.
- Locked slides cannot be silently mutated.
- Export projections cannot become the canonical editing model.

### 5.7 Layout Intelligence Engine

Purpose:

Map business intent to deterministic, brand-safe layouts.

Minimum required slide types:

| Slide type | Use case |
| --- | --- |
| Executive summary | board, sponsor |
| Key message | main thesis |
| KPI cards | metrics, effects |
| Timeline | roadmap, milestones |
| Risk heatmap | risks |
| Decision slide | decisions required |
| Before/after | transformation |
| Process flow | process |
| Swimlane | roles and responsibilities |
| RACI | governance |
| Value case | business case |
| Financial bridge | CFO |
| Initiative portfolio | roadmap |
| Maturity matrix | Digital Roadmap / audit |
| Interview insight | research/interview results |
| Quote wall | voice of organization |
| Action plan | next steps |
| Appendix detail | reading deck details |

Required behavior:

- Layout choice is deterministic enough for enterprise reports.
- Layout family is visible in schema/QA.
- Tables, charts and KPI visuals are predictable.
- Business layouts take priority over generic decorative layouts.

### 5.8 Theme And Brand Governance Engine

Purpose:

Apply controlled visual identity without asking the user to manually design slides every time.

Required theme properties:

- logo,
- fonts,
- colors,
- heading system,
- margins,
- icon style,
- table style,
- chart style,
- cover style,
- decision slide style,
- financial slide style,
- text density rules,
- read-deck vs present-deck rules.

Required behavior:

- Default brand is locked unless user has capability to change it.
- Client brand can be applied only when available and allowed.
- Brand/theme changes must be auditable when governance applies.
- Visual output must work in light/dark application contexts and in exports.

### 5.9 Content Quality And Consulting QA Engine

Purpose:

Validate that the deck is a professional consulting artifact, not just a visually acceptable AI output.

Required checks:

- each slide has a clear thesis,
- no empty generic filler,
- claims and numbers have sources or assumption marks,
- deck fits audience and purpose,
- level of detail is appropriate,
- narrative leads to decision/action,
- required template sections are complete,
- risks and decisions are visible,
- slide density is acceptable,
- deck is consistent with template and brand,
- export is allowed only when blockers are resolved.

Required result vocabulary:

- `PASS`
- `PASS_WITH_P2`
- `BLOCKED_P1`
- `INCONCLUSIVE`

Severity vocabulary:

- `P0`
- `P1`
- `P2`
- `P3`

### 5.10 Artifact Versioning And Approval

Purpose:

Track deck evolution and delivery readiness.

Required events:

- deck created,
- outline proposed,
- outline approved/rejected,
- template selected,
- source pack built,
- deck generated,
- AI edit proposed,
- AI edit accepted/rejected,
- version saved,
- quality gate run,
- export blocked/failed/completed,
- share link created/revoked,
- deck approved for delivery.

Required behavior:

- Accepted AI edits create durable trace.
- Rejecting an AI proposal does not mutate deck content.
- Exports must not record `completed` when blocked or failed.
- The user can understand what changed and why.

### 5.11 Export And Share

Required outputs:

- web artifact preview,
- PDF,
- PPTX,
- internal artifact record,
- client share link,
- optionally PNG/HTML/embed where supported.

Required behavior:

- Export is quality-gated.
- Confidentiality policy applies to export and share.
- Tenant and role permissions are enforced by backend/API.
- Export ledger distinguishes completed, failed and blocked.
- Share links are auditable and revocable where required.

---

## 6. Required Data Models

### 6.1 PresentationArtifact

```json
{
  "id": "deck_001",
  "title": "VTS Interview Partial Report",
  "client_id": "vts",
  "workspace_id": "consultify",
  "organization_id": "org_001",
  "created_by": "piotr",
  "template_id": "tpl_interview_report_v1",
  "source_pack_id": "sp_001",
  "status": "draft",
  "version": "0.3",
  "output_formats": ["web", "pdf", "pptx"],
  "slides": []
}
```

### 6.2 PresentationTemplate

```json
{
  "id": "tpl_ks_project_v1",
  "name": "Project Steering Committee Review",
  "category": "project_governance",
  "status": "approved",
  "owner": "PMO",
  "audience": ["executive", "project_sponsor", "PMO"],
  "slide_blueprint": [],
  "required_inputs": [],
  "brand_theme_id": "consultify_executive"
}
```

### 6.3 SlideBlueprint

```json
{
  "slide_number": 7,
  "slide_type": "risk_heatmap",
  "purpose": "Show risks requiring executive attention",
  "required_data": ["risk_register"],
  "layout_rule": "matrix_with_decision_sidebar",
  "content_density": "medium",
  "approval_required": true
}
```

### 6.4 SlideInstance

```json
{
  "slide_id": "slide_007",
  "blueprint_id": "risk_heatmap",
  "title": "Risks Requiring Executive Attention",
  "message": "Three risks may affect the May delivery milestone.",
  "blocks": [],
  "quality_score": 86,
  "status": "needs_review"
}
```

### 6.5 EditOperation

```json
{
  "operation_id": "op_123",
  "deck_id": "deck_001",
  "scope": "slide",
  "target_slide_id": "slide_007",
  "command": "Make this more executive and move details to appendix",
  "status": "proposed",
  "diff_summary": [],
  "created_by": "user_001",
  "approved_by": null,
  "executed_at": null
}
```

---

## 7. First Template Set

Initial registry should include 12 business templates:

| Template | Purpose |
| --- | --- |
| Project Steering Committee | project governance |
| Executive Transformation Update | board / executive update |
| Interview Insights Report | interview results |
| Digital Roadmap Report | transformation roadmap |
| AI Readiness Assessment | AI audit |
| Business Case | economic justification |
| Sales Proposal | client proposal |
| Discovery Summary | discovery output |
| Research Brief | research session output |
| Workshop Summary | workshop output |
| Risk & Decision Review | risks and decisions |
| Initiative Portfolio Review | initiative portfolio |

Each template must define:

- purpose,
- persona,
- required inputs,
- slide logic,
- quality standard,
- short/medium/detailed variants.

---

## 8. Non-Functional Requirements

### 8.1 Visual Quality

Decks must look like professional consulting presentations.

They must not look like:

- random AI output,
- generic old PowerPoint,
- raw JSON projection,
- placeholder-heavy prototype.

### 8.2 Control

User must be able to request:

- change slide 4,
- add section after slide 6,
- move risks to appendix,
- shorten executive summary,
- make it more CFO-level,
- add chart,
- add case study,
- keep layout but change copy.

### 8.3 Security

Required:

- role/access control,
- tenant isolation,
- audit log,
- source provenance,
- confidentiality labels,
- export permissions,
- workspace-level sharing,
- no raw internals in user-facing errors.

### 8.4 UI/UX Standards

The module must follow `DRD/UI_UX_SOURCE_OF_TRUTH.md`.

Mandatory invariants:

- no silent execution,
- no fake success,
- honest degraded UI,
- traceability,
- tenant/ACL safety,
- no raw internals,
- contextual AI actions in Menu 3 / local command row,
- clear distinction between save state and lifecycle state.

---

## 9. What Must Not Be Built

Do not build this as a Gamma API wrapper.

That would fail the strategic requirement because Consultify would not control:

- existing deck edits,
- artifact model,
- slide schema,
- diffs,
- governance,
- source provenance,
- template planning,
- versioning,
- enterprise audit.

Gamma API may be used as:

- benchmark,
- optional rendering provider,
- temporary comparison provider,
- inspiration for UX speed and visual polish.

Gamma must not be:

- the canonical deck model,
- the canonical editor,
- the source of governance truth,
- the required path for enterprise output.

---

## 10. Current Code Coverage Audit

Audit date: 2026-05-08

Legend:

- `IMPLEMENTED` - code has a credible working implementation.
- `PARTIAL` - code has pieces, but not the full target behavior.
- `MISSING` - no clear implementation found.

### 10.1 Backend Coverage

| Requirement area | Status | Evidence |
| --- | --- | --- |
| Free prompt-to-deck generation | `IMPLEMENTED` for generation, `PARTIAL` for explicit Gamma-like mode policy | `server/src/routes/presentations.routes.ts`, `presentationGeneratorService.ts` |
| Generate from template | `IMPLEMENTED` | `POST /api/presentations/generate/outline`, `POST /api/presentations/generate/deck`, `generateOutline`, `generateDeck`, `applyTemplateRuntime` |
| AI template planning | `PARTIAL` | Template governance exists, but no dedicated presentation AI template planning endpoint found |
| Template registry lifecycle | `IMPLEMENTED` | `presentationTemplateGovernanceService.ts`, migration `767_presentation_template_governance.sql`, governance routes under `/api/presentations/templates/...` |
| Source pack builder | `PARTIAL` | `buildContextPack`, `saveContextPackSnapshot`, `DeckSetup.sourceArtifacts`; full source-pack registry exists in Document Studio, not unified with presentations |
| Narrative planner | `PARTIAL` | `slidePlanningEngineService.ts`, `generateNarrative`; no first-class Presentation Narrative Planner API |
| Canonical deck schema | `IMPLEMENTED` | `presentationDeckDocumentService.ts`, `DeckDocument`, `normalizeDeckDocument` |
| Layout intelligence | `PARTIAL` | `slidePlanningEngineService.ts`, `presentationBrandLayoutService.ts`, enterprise layout rules |
| Brand/theme governance | `PARTIAL` | `brand-kit` routes, `presentationAccessPolicyService.ts`; no full theme lifecycle governance |
| Quality gates | `IMPLEMENTED` | `presentationQualityGatesService.ts`, quality gate routes, export enforcement |
| Versioning/audit | `PARTIAL` | `presentation_deck_versions`, AI operations ledger, audit-log route, telemetry; dual in-memory + DB operation path exists |
| Export/share | `IMPLEMENTED` | PPTX/PDF/PNG/HTML export routes, share token routes, export records/parity |
| RBAC/tenant/ACL | `IMPLEMENTED` | `verifyToken`, organization-scoped queries, `presentationAccessPolicyService.ts`, confidentiality policy |
| Conversational AI edits | `IMPLEMENTED` | `agent-edit`, accept/reject/revert/history routes, `presentationAgentEditService.ts` |

### 10.2 Frontend Coverage

| Requirement area | Status | Evidence |
| --- | --- | --- |
| Reports & Presentations entry surface | `IMPLEMENTED` | `ReportsAndPresentationsHub.tsx`, ModuleHub tabs, command row actions |
| Free generation UI | `IMPLEMENTED` | `PresentationWizard.tsx`, `SetupStep.tsx`, source/template optionality |
| Template planning UI | `PARTIAL` | Templates tab and report-builder template route exist, but no dedicated AI template architect flow |
| Generate from approved template UI | `PARTIAL` | Template selection exists; UI does not clearly enforce approved-only template use |
| Source selection | `IMPLEMENTED` | `SourceStep.tsx`, artifact selection, filters, selected sources |
| Narrative planner visibility | `PARTIAL` | `OutlineStep.tsx`; no persistent builder narrative planner panel |
| Slide schema/business layouts | `IMPLEMENTED/PARTIAL` | `DeckBuilder.tsx`, `LayoutEngine.ts`; implementation present, runtime determinism still needs tests |
| Brand/theme UI | `IMPLEMENTED/PARTIAL` | Brand kit, color gallery, `ThemeSwitcher`, governance card; theme lifecycle is partial |
| QA gates UI | `IMPLEMENTED` | `DeckQualityGatesPanel.tsx`, jump-to-card, export blocking state |
| Versioning/approval UI | `PARTIAL` | `useVersionHistory.ts`, `VersionHistoryPanel.tsx`, artifact review in hub; no full builder lifecycle approval strip |
| Export/share UI | `IMPLEMENTED` | `presentationExport.ts`, `ShareModal.tsx`, wizard result download |
| Conversational edits | `IMPLEMENTED` | `DeckBuilder.tsx`, Teresa integration, pending proposal banner accept/reject |
| Menu 3 placement | `PARTIAL` | Hub uses `commandRowRightContent`; builder has its own top bar rather than shared ModuleHub slot |
| Honest UI states | `IMPLEMENTED/PARTIAL` | Wizard/builder loading/error states exist; source-pack gap and template-planning gaps need stronger evidence |

### 10.3 Documentation And Test Coverage

| Requirement area | Status | Evidence |
| --- | --- | --- |
| Gamma-like target documented | `IMPLEMENTED` | `PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`, `PRESENTATION_ARTIFACT_ENGINE_REFERENCE.md`, `PREZENTACJE_V8_SSOT.md` |
| Full manual backlog | `IMPLEMENTED` | `PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`, MT-PRES-001..031 |
| Proposal governance tests | `IMPLEMENTED` | MT-PRES-003 |
| Quality/export tests | `IMPLEMENTED` | MT-PRES-004, 005, 006, 022 |
| Template governance tests | `IMPLEMENTED` | MT-PRES-017 |
| Source-pack discipline tests | `PARTIAL` | Artifact picker/degraded tests exist; structured source-pack and required-input gaps not first-class |
| Template planning tests | `MISSING/PARTIAL` | No dedicated plan-only AI template architect manual scenario found |
| Narrative planner tests | `MISSING/PARTIAL` | Outline tests exist; no distinct narrative planner acceptance case |
| Slide schema/layout correctness tests | `PARTIAL` | Visual/export tests exist; layout family/slot mapping not explicitly covered |
| RBAC matrix breadth | `PARTIAL` | Matrix exists, but manual tests do not systematically cover all roles |

---

## 11. Current Gap List

### P0 / P1 Product Gaps

#### GAP-01 - AI Template Architect is not first-class for presentations

Status: `PARTIAL`

What exists:

- Template registry and governance lifecycle.
- Template tab and template use flows.

What is missing:

- Dedicated "plan template" flow for presentations.
- AI-generated template proposal with required inputs, slide blueprint, layout rules and governance.
- Approval path from AI template proposal into presentation template registry.

Required next step:

- Add Presentation Template Architect service/API/UI.
- Add manual test: `Plan template -> review -> approve -> registry -> generate from approved template`.

#### GAP-02 - Source Pack Builder is not a full presentation source-pack object

Status: `PARTIAL`

What exists:

- Artifact source selection.
- Context pack snapshot.
- Source refs.

What is missing:

- First-class source pack object for presentations.
- Required-input coverage map.
- Missing input register tied to template blueprint.
- Source freshness/confidence UX.

Required next step:

- Define presentation source-pack contract.
- Unify with organization context/source truth system.
- Add source-pack panel and missing-input gate.

#### GAP-03 - Narrative Planner is visible mainly as outline, not as consulting storyline engine

Status: `PARTIAL`

What exists:

- Outline generation.
- Slide planning engine.
- Some narrative generation by intent.

What is missing:

- Explicit storyline review: thesis, argument sequence, decision points, evidence slots, appendix logic.
- Builder-side narrative inspector/refinement.

Required next step:

- Add Narrative Planner output model and UI review.
- Add QA checks for narrative completeness.

#### GAP-04 - Approved-template-only enterprise flow is not fully enforced in UI

Status: `PARTIAL`

What exists:

- Template selection.
- Template governance backend.

What is missing:

- UI guarantee that governed generation uses only approved templates.
- Clear draft/approved/deprecated visual language inside wizard.
- Explicit blocked/degraded state when user tries to use unapproved template in governed mode.

Required next step:

- Filter or label template states in wizard.
- Add capability-aware warnings and hard blocks.

#### GAP-05 - Builder lifecycle approval is fragmented

Status: `PARTIAL`

What exists:

- Version history.
- Artifact review actions in hub.
- AI proposal accept/reject.

What is missing:

- Clear builder-level lifecycle strip for `Draft -> In Review -> Approved -> Exported/Shared`.
- Direct evidence that approval state is separate from save state.

Required next step:

- Add builder lifecycle controls in the correct Menu 3/local command row placement.

### P2 Quality / Completeness Gaps

#### GAP-06 - Layout intelligence needs explicit schema/layout tests

Status: `PARTIAL`

What exists:

- Layout engine and layout catalog.
- Export visual tests.

What is missing:

- Tests verifying slide type -> layout family -> required blocks -> export projection.
- Tests for deterministic business layouts such as risk heatmap, RACI, maturity matrix, financial bridge.

Required next step:

- Add schema/layout contract tests and manual MT cases.

#### GAP-07 - Consulting QA needs separate categories beyond generic quality gates

Status: `PARTIAL`

What exists:

- Quality gates.
- Benchmark scorecard/judge docs.

What is missing:

- Explicit QA categories for methodology, executive logic, risk framing, decision readiness, source discipline.

Required next step:

- Extend QA result model and panel with consulting dimensions.

#### GAP-08 - Theme governance is not yet a full lifecycle system

Status: `PARTIAL`

What exists:

- Brand kit and theme UI.
- Capability checks for brand changes.

What is missing:

- Theme versioning/governance comparable to template governance.
- Locked brand policy by audience/client/export type.

Required next step:

- Define Brand Theme governance model and audit path.

#### GAP-09 - Manual tests do not fully cover Gamma-like free generation

Status: `PARTIAL`

What exists:

- Template/source-heavy manual tests.

What is missing:

- Dedicated test for prompt-only Gamma-like generation with optional/no template.
- Test for partially grounded deck warning.

Required next step:

- Add MT-PRES case for `free generation -> outline approval -> partially grounded deck -> edit/export`.

#### GAP-10 - RBAC matrix breadth is not fully exercised manually

Status: `PARTIAL`

What exists:

- RBAC matrix and spot tests.

What is missing:

- Systematic role-by-role manual coverage for viewer/guest/admin/superadmin across create/edit/export/share/template governance.

Required next step:

- Add RBAC test matrix to manual backlog.

---

## 12. Recommended Delivery Plan

### Phase A - Close Methodology Core

1. Presentation AI Template Architect.
2. Presentation Source Pack object + required input gap register.
3. Narrative Planner review model.
4. Approved-template-only governed generation enforcement.

### Phase B - Close Enterprise Control

1. Builder lifecycle approval strip.
2. Consulting QA categories.
3. Expanded RBAC test matrix.
4. Theme governance lifecycle.

### Phase C - Close Visual/Export Excellence

1. Layout schema contract tests.
2. Business layout hardening for the 12 starter templates.
3. PPTX/PDF parity checks per layout family.
4. Visual benchmark against Gamma-quality examples.

---

## 13. Final Assessment

Current implementation is already beyond a basic Gamma-like deck generator in several enterprise areas:

- governed AI edits,
- quality gates,
- exports,
- share links,
- template governance,
- RBAC/confidentiality,
- audit/history surfaces,
- canonical deck model direction.

However, it is not yet the full target described in this document.

The largest remaining product gaps are:

1. AI Template Architect for presentations.
2. First-class presentation Source Pack Builder.
3. Narrative Planner as a visible consulting methodology layer.
4. Approved-template-only enterprise generation UX.
5. Consulting QA categories and layout contract tests.

Strategic conclusion:

> Consultify should keep Gamma as visual/product benchmark, but the core engine must remain native: source-backed, template-governed, versioned, auditable and editable slide-by-slide.

