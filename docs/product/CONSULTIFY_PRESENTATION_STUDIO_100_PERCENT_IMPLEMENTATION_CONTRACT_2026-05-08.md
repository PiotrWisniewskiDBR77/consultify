# Consultify Presentation Studio - 100 Percent Implementation Contract

Status: `IMPLEMENTATION_CONTRACT_DRAFT`
Owner: Product + Engineering + QA
Date: 2026-05-08
Module: Presentation Generator / Presentation Studio / Deck OS
Target: Complete methodology-first, Gamma-quality, enterprise-governed presentation system

Primary references:

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_REQUIREMENTS_AND_GAP_ANALYSIS_2026-05-08.md`
- `consultify/docs/product/PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md`
- `consultify/docs/product/PREZENTACJE_V8_SSOT.md`
- `consultify/docs/product/PREZENTACJE_V8_CANONICAL_DECK_MODEL.md`
- `consultify/docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`
- `consultify/docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`
- `DRD/testy_antygravity/ANYGRAVITY_PRESENTATIONS_FIX_RETEST_2026-05-08_PROMPT.md`

---

## 1. Contract Purpose

This document is the complete implementation contract for bringing Consultify Presentation Studio to 100 percent readiness.

The goal is to remove ambiguity for Product, Engineering, QA, and future agents. After this contract is accepted, implementation work should not require new product interpretation except for hard-stop decisions explicitly called out here.

The module must deliver two things at the same time:

1. **Gamma-level visual quality and generation speed**  
   Presentations must look modern, polished, web-native, client-facing, and visually better than a generic 2005-style PowerPoint.

2. **Consultify-level enterprise method and governance**  
   Presentations must be methodology-first, source-backed, template-governed, versioned, auditable, editable, tenant-safe, and usable as decision artifacts.

The product target is not:

```text
AI makes slides
```

The product target is:

```text
Consultify turns real consulting work into beautiful governed decision decks.
```

---

## 2. Non-Negotiable Product Positioning

### 2.1 Gamma Is Benchmark, Not Core

Gamma may be used as:

- visual quality benchmark,
- UX speed benchmark,
- optional renderer comparison,
- temporary quality reference,
- inspiration for card-based deck logic,
- inspiration for theme and preview speed.

Gamma must not become:

- canonical data model,
- canonical editor,
- canonical slide schema,
- source of audit truth,
- required generation engine,
- required export path,
- substitute for Consultify governance.

Reason:

Gamma creates attractive materials, but its API is primarily generation-first. Consultify requires existing-deck editing, slide-level governance, source packs, versioning, diffs, approvals, and enterprise delivery traceability.

### 2.2 Methodology Before Design

Every serious deck must be generated from this order:

```text
business goal
-> audience
-> decision context
-> source pack
-> narrative plan
-> template / blueprint
-> slide schema
-> content generation
-> layout and design
-> QA
-> approval
-> export/share
```

Design cannot hide weak thinking.

### 2.3 Beauty Is A Requirement

Consultify decks must be visually strong. "Governed but ugly" is not accepted.

Minimum visual bar:

- modern consulting-grade composition,
- strong typography,
- clean information hierarchy,
- attractive cover slides,
- readable charts/tables,
- polished cards,
- controlled spacing,
- brand-safe colors,
- professional PDF/PPTX output,
- no raw placeholders,
- no accidental dense walls of text unless explicitly a read-deck appendix.

Gamma-level does not mean copying Gamma UI. It means the user should feel the output is fast, polished, and client-ready.

---

## 3. Definition Of 100 Percent Done

The module is 100 percent done only when all conditions below are true.

### 3.1 Functional Completion

All three primary modes work end-to-end:

1. **Generate Like Gamma**  
   Prompt or UI intake -> outline approval -> deck generation -> preview -> edit -> export/share.

2. **Plan Template First**  
   AI plans a reusable presentation template -> user reviews -> user approves -> template enters registry.

3. **Generate From Approved Template**  
   User selects approved template -> source pack is built -> missing inputs shown -> deck generated from slots -> QA -> approval/export.

### 3.2 Enterprise Completion

The following are implemented and tested:

- source packs,
- narrative planner,
- AI template architect,
- template registry lifecycle,
- canonical deck schema,
- deterministic business layouts,
- brand/theme governance,
- consulting QA,
- proposal approval execution audit,
- versioning,
- audit log,
- export/share governance,
- RBAC/tenant/ACL,
- read-back after refresh,
- no silent execution,
- no fake success.

### 3.3 Visual Completion

At least 12 starter templates and their generated decks pass Gamma-quality visual review in light and dark app contexts and in exported PDF/PPTX.

Required visual verdict:

- `PASS` for client-facing templates,
- or `PASS_WITH_P2` only for non-blocking polish issues.

Any deck that looks like a generic AI text dump is not done.

### 3.4 QA Completion

The validation matrix in this contract passes:

- backend unit tests,
- frontend/unit component tests where applicable,
- integration tests,
- export parity tests,
- manual MT-PRES gates,
- new methodology/template/source-pack/layout tests,
- role/tenant tests,
- demo environment smoke.

No P0/P1 may remain open.

---

## 4. Execution Procedure

### 4.1 Delivery Mode

Implementation must run in micro-sprints.

Each sprint must produce:

- changes made,
- files changed,
- validation evidence,
- gate status,
- residual risks,
- next sprint plan.

No sprint may merge unless its gate is:

- `PASS`, or
- `PASS_WITH_P2` with explicit mitigation and owner.

### 4.2 Agent Topology

Use a four-stream topology:

| Stream | Scope |
| --- | --- |
| Agent A | Backend services, routes, data contracts, migrations, API tests |
| Agent B | Frontend wizard, builder, hub, preview, visual components |
| Agent C | Integration, intent routing, Teresa/chat, i18n, source connections |
| Agent D | QA/review gates, manual test packs, evidence, closeout |

### 4.3 Hard Stops

Stop and request approval before continuing if any of these appear:

- required DB migration conflicts with a "no migration" block,
- tenant/ACL ambiguity,
- silent AI mutation,
- fake success,
- raw customer data leakage,
- export/share bypasses quality or confidentiality,
- Gamma/API dependency would become core runtime,
- new route/module duplicates an existing canonical surface,
- significant UI action cannot be placed in Menu 3/local command row,
- tests reveal P0/P1 regression outside planned scope.

### 4.4 Required Report Format Per Sprint

Each sprint gate report must include:

```markdown
## Sprint <N> Gate

### Changes made
- <files>

### Validation evidence
- <command> -> <result>

### Gate status
- DoR:
- DoD:
- Sprint gate:

### Residual risks
- <risk + mitigation>

### Next sprint plan
- <next actions>
```

---

## 5. Product Scope

### 5.1 In Scope

The 100 percent implementation includes:

- `/prezentacje` and `/presentations` entry paths,
- Reports & Presentations / Outputs hub integration,
- Presentation Wizard,
- Deck Builder,
- Teresa-driven conversational generation and edits,
- template planning and registry,
- source pack builder,
- narrative planner,
- deck schema and slide schema,
- layout intelligence,
- brand/theme governance,
- QA gates,
- version history,
- audit log,
- export/share,
- role and tenant safety,
- manual and automated validation.

### 5.2 Out Of Scope

Not part of this contract:

- general Figma-like design editor,
- unconstrained free-form design canvas,
- copying Gamma UI one-to-one,
- vendor billing/credits clone,
- using Gamma as primary data store,
- building a parallel artifact registry,
- breaking existing Reports & Presentations continuity,
- rewriting unrelated modules.

---

## 6. User-Facing Workflows

### 6.1 Workflow A - Prompt-To-Deck, Gamma-Like

User says:

```text
Stworz prezentacje zarzadcza: Strategia wdrozenia AI w DBR77 na lata 2026-2027.
Odbiorcy: zarzad i liderzy operacyjni.
Slajdy: 8-10.
Uwzglednij: cele strategiczne, business case, ryzyka, harmonogram, KPI, rekomendacje.
```

System must:

1. Parse intent.
2. Detect audience and goal.
3. Ask missing clarifying questions only when necessary.
4. Suggest or build source pack.
5. Produce outline proposal.
6. Show source assumptions and gaps.
7. Require user approval.
8. Generate deck.
9. Show live preview.
10. Run QA.
11. Allow conversational edits.
12. Export/share when gates allow.

Acceptance:

- No duplicate prompt fields in `/prezentacje`.
- Teresa is the conversational entry.
- User sees progress states.
- Failure produces toast, console payload and network evidence.
- Deck reopens after refresh.
- Deck appears in recent/output library.

### 6.2 Workflow B - AI Plans Template

User says:

```text
Zaplanuj template spotkania KS projektu.
```

System must produce a template plan with:

- purpose,
- cadence,
- audience,
- required inputs,
- optional inputs,
- slide blueprint,
- layout family per slide,
- narrative logic,
- governance,
- quality criteria,
- recommended variants.

User can:

- approve,
- reject,
- revise,
- save as draft,
- promote to approved if authorized.

Acceptance:

- AI does not silently create approved template.
- Template proposal has diff/review state.
- Approval creates registry entry and audit event.
- Reject does not create approved template.

### 6.3 Workflow C - Generate From Approved Template

User says:

```text
Zrob KS projektu VTS na bazie template'u Project Steering Committee Review v1.0.
```

System must:

1. Load approved template.
2. Verify user can use template.
3. Build required source pack.
4. Show missing required data.
5. Map sources into slide slots.
6. Generate deck schema.
7. Render deck.
8. Run QA.
9. Save versioned artifact.
10. Allow approval/export.

Acceptance:

- Draft/deprecated templates cannot be used in governed mode unless explicitly allowed.
- Missing required data blocks generation or creates explicit placeholders per policy.
- Generated deck matches template structure.
- Export is blocked if required sections are incomplete.

### 6.4 Workflow D - Presentation As Output From Other Modules

Deck generation must be available from:

| Source module | Deck output |
| --- | --- |
| Research | Research Brief Deck |
| Interview | Organizational Insights Deck |
| AI Audit | AI Readiness Assessment Deck |
| Digital Roadmap | Transformation Roadmap Deck |
| Sales Discovery | Client Proposal Deck |
| Project Review | Steering Committee Deck |
| Workshop | Workshop Summary Deck |
| KPI / ROI | Business Case Deck |

Acceptance:

- Source lineage is preserved.
- Deck is registered as artifact.
- User can return to source module or deck.
- Refresh does not lose deck/source binding.

---

## 7. Implementation Epics

### Epic A - Entry, Routing And Intake

Goal:

Users can start Presentation Studio from chat and UI without duplicate entry points.

Backend requirements:

- Intent endpoint supports presentation creation modes.
- API accepts structured intake payload.
- Tenant/user context is required.
- Invalid or missing auth returns honest error.

Frontend requirements:

- `/prezentacje` has one conversational AI entry through Teresa.
- `/presentations` / Reports & Presentations hub has clear create actions.
- Contextual AI actions are in Menu 3 / command row right slot or local equivalent.
- Intake captures audience, goal, slide count, mode, source scope, confidentiality, output target.

Acceptance:

- No duplicate local prompt in right panel.
- No hidden generation.
- Generation entry logs and progress are observable.
- Error toast includes step name when pipeline fails.

### Epic B - Presentation Intent Parser

Goal:

Convert natural language and UI selections into a normalized `PresentationRequest`.

Required model:

```json
{
  "mode": "free_generation",
  "presentation_type": "executive_strategy",
  "audience": ["board", "operations_leaders"],
  "goal": "decision_alignment",
  "language": "pl",
  "slide_count": { "min": 8, "max": 10 },
  "style": "executive_consulting",
  "source_scope": [],
  "confidentiality": "internal",
  "output_targets": ["web", "pdf", "pptx"]
}
```

Acceptance:

- Parser returns structured fields and confidence.
- Ambiguous intent produces clarifying questions or safe defaults.
- Parser never starts mutation without user action.

### Epic C - Source Pack Builder

Goal:

Create first-class presentation source packs.

Backend requirements:

- Create source pack from selected artifacts, module context, files and organization context.
- Store source pack snapshot or stable reference.
- Include missing inputs, freshness, confidence, coverage map.
- Enforce tenant/ACL on every source read.

Frontend requirements:

- Source Pack panel shows included sources.
- Shows missing required inputs.
- Shows confidence and freshness.
- Shows partial/degraded/policy-blocked states.

Required model:

```json
{
  "sourcePackId": "sp_001",
  "organizationId": "org_001",
  "deckId": "deck_001",
  "templateId": "tpl_001",
  "sources": [],
  "requiredInputCoverage": [],
  "missingInputs": [],
  "confidence": "high",
  "freshness": "current",
  "createdBy": "user_001",
  "createdAt": "2026-05-08T00:00:00.000Z"
}
```

Acceptance:

- Cross-tenant source access returns 403/404.
- Missing required input is visible before generation.
- Source pack survives refresh/read-back.
- Deck traceability links to source pack.

### Epic D - Narrative Planner

Goal:

Create methodology-first storyline before slides.

Backend requirements:

- Generate narrative plan from request + source pack.
- Include thesis, sequence, evidence, decision points, risks, recommendations, appendix plan.
- Persist narrative plan in deck generation metadata.

Frontend requirements:

- User can review narrative plan before deck generation.
- User can approve, reject or revise plan.
- Builder can show narrative inspector after deck exists.

Required model:

```json
{
  "narrativePlanId": "np_001",
  "mainThesis": "AI deployment should focus on governed operational use cases before full automation.",
  "audienceReadiness": "executive",
  "argumentSequence": [],
  "decisionPoints": [],
  "evidenceSlots": [],
  "riskFrames": [],
  "appendixNeeds": [],
  "densityMode": "read_and_present"
}
```

Acceptance:

- User sees narrative before deck generation in governed flows.
- Quality gates can flag weak narrative.
- Narrative is linked to slides.

### Epic E - AI Template Architect

Goal:

AI can plan reusable presentation templates as operating standards.

Backend requirements:

- Endpoint to generate template proposal.
- Endpoint to approve/reject proposal.
- Proposal contains slide blueprint, required inputs, layout rules, QA rules and governance.
- Approved proposal creates or updates template registry entry.
- Audit entry is created.

Suggested endpoints:

```text
POST /api/presentations/templates/architect/propose
POST /api/presentations/templates/architect/:proposalId/approve
POST /api/presentations/templates/architect/:proposalId/reject
GET  /api/presentations/templates/architect/:proposalId
```

Frontend requirements:

- "Plan template" action in correct command row.
- Template proposal review screen.
- Diff/preview before approval.
- Clear status: proposed, approved, rejected, superseded.

Acceptance:

- No approved template appears without explicit approval.
- Reject does not mutate template registry.
- Approve creates template version and audit record.
- User can generate from the approved template.

### Epic F - Template Registry And Lifecycle

Goal:

Templates are governed reusable assets.

Required states:

- `draft`,
- `approved`,
- `deprecated`,
- `superseded`,
- `archived`.

Required fields:

- template id,
- name,
- category,
- owner,
- organization/system scope,
- status,
- version,
- successor pointer,
- persona,
- required inputs,
- optional inputs,
- slide blueprint,
- layout rules,
- brand/theme defaults,
- governance policy,
- created/approved/deprecated audit fields.

Acceptance:

- System and organization templates are distinguishable.
- Only authorized users can approve/deprecate.
- Deprecated template shows successor when available.
- Wizard cannot silently fall back to generic template when selected template fails.

### Epic G - Canonical Deck And Slide Schema

Goal:

One canonical deck document drives wizard, builder, QA, exports and AI operations.

Required invariants:

- `schemaVersion` is mandatory.
- `deckId` matches DB row.
- `organizationId` is mandatory.
- cards/slides are ordered by `orderIndex`.
- every card has stable id, intent, title, blocks.
- every block has stable id.
- refreshable blocks require source refs.
- export payloads are projections, not canonical truth.

Acceptance:

- Wizard creates canonical deck document.
- Builder reads and writes canonical deck document.
- Exports use canonical deck document.
- Legacy deck shapes are normalized.
- Invalid schema produces honest degraded state, not crash.

### Epic H - Slide Schema Generator

Goal:

Transform narrative/template blueprint into slide instances.

Required output per slide:

- slide id,
- blueprint id,
- slide type,
- title,
- key message,
- content blocks,
- layout family,
- density,
- source refs,
- speaker notes policy,
- QA requirements,
- approval flag.

Acceptance:

- Each generated slide has a business intent.
- Required slide types match template.
- Missing data is marked or blocked.
- Slide schema can be inspected in developer/admin evidence view.

### Epic I - Layout Intelligence And Gamma-Level Visual Engine

Goal:

Render visually beautiful, modern, professional decks with deterministic business layouts.

Required layout families:

- cover,
- agenda,
- executive summary,
- key message,
- KPI cards,
- timeline,
- roadmap,
- risk heatmap,
- decision slide,
- before/after,
- process flow,
- swimlane,
- RACI,
- value case,
- financial bridge,
- initiative portfolio,
- maturity matrix,
- interview insight,
- quote wall,
- action plan,
- appendix detail.

Visual acceptance criteria:

- Clear hierarchy within 3 seconds.
- No text overflow.
- No tiny unreadable labels.
- Tables/charts are readable in PDF/PPTX.
- Cover looks client-ready.
- Icons/illustrations are consistent.
- Empty data slots use honest placeholders.
- Dark app UI does not break editor readability.
- Exported PDF/PPTX preserves visual quality.

Benchmark dimensions:

| Dimension | Target |
| --- | --- |
| First impression | Looks modern and premium |
| Slide clarity | Main message obvious |
| Brand consistency | Theme applied consistently |
| Layout intelligence | Business layout matches intent |
| Data readability | KPI/table/chart readable |
| Consulting polish | Looks client-facing |
| Export fidelity | PDF/PPTX match preview |

Acceptance:

- 12 starter templates pass visual review.
- At least 20 layout families have snapshot/manual coverage.
- Export parity covers key layout families.
- No layout has known P0/P1 readability issue.

### Epic J - Theme And Brand Governance

Goal:

Brand application is controlled, not manually improvised.

Backend requirements:

- Brand kit read/write with capability checks.
- Theme tokens available to generation and renderer.
- Theme policy can lock colors/fonts/logo for tenant/client.
- Brand/theme changes are auditable.

Frontend requirements:

- Theme switcher or brand selector only where allowed.
- Locked brand state visible.
- Client brand availability visible.
- No unapproved brand changes in export/share.

Acceptance:

- User without capability cannot change brand.
- Export uses approved theme.
- Brand changes create audit entry when governance applies.
- Deck generated with client brand has visible trace.

### Epic K - Conversational Editing Runtime

Goal:

User can edit deck naturally through Teresa while preserving governance.

Supported commands:

- shorten slide,
- rewrite slide for executive audience,
- add chart,
- add risks,
- move section,
- split slide,
- merge slides,
- move details to appendix,
- make CFO-level,
- apply brand,
- create shorter variant,
- create speaker notes.

Required operation flow:

```text
intent parse -> scope detection -> proposal -> user approval/rejection -> execution -> audit
```

Supported scopes:

- slide,
- section,
- global,
- template,
- source refresh,
- visual/theme,
- speaker notes,
- export/share preparation.

Acceptance:

- AI never silently mutates deck.
- Proposal shows affected slides and diff summary.
- Reject leaves deck unchanged.
- Accept persists change and version.
- Operation appears in audit/history.
- Refresh after accept preserves change.

### Epic L - Consulting QA Engine

Goal:

Quality gates evaluate consulting quality, not just technical validity.

Required QA categories:

- technical integrity,
- source grounding,
- narrative coherence,
- executive clarity,
- decision readiness,
- risk visibility,
- data/KPI consistency,
- template completeness,
- brand/design quality,
- export readiness,
- confidentiality/export policy.

Required output:

```json
{
  "result": "PASS_WITH_P2",
  "score": 87,
  "blockers": [],
  "warnings": [],
  "categories": [
    {
      "id": "executive_clarity",
      "severity": "P2",
      "status": "warning",
      "message": "Slide 3 has too much operational detail for board audience."
    }
  ],
  "canExport": true,
  "canShare": true
}
```

Acceptance:

- P0/P1 blocks export/share.
- QA panel shows actionable issues.
- Jump-to-slide works.
- QA results are stored or reproducible.
- Consulting QA can distinguish ugly/weak deck from good deck.

### Epic M - Artifact Lifecycle, Versioning And Approval

Goal:

Deck lifecycle is explicit and separate from save state.

Lifecycle states:

- `draft`,
- `generated`,
- `editing`,
- `in_review`,
- `approved`,
- `ready`,
- `exported`,
- `shared`,
- `archived`,
- `failed`.

Rules:

- `Saved` is not `Approved`.
- `Draft` is not unsaved state.
- Approval is a lifecycle action.
- Export/share may require approved or ready state depending on policy.

Acceptance:

- Builder shows save state separately from lifecycle state.
- User can request review/approve where authorized.
- Lifecycle mutations are audited.
- Version history shows meaningful checkpoints.

### Epic N - Export, Share And Delivery

Goal:

Decks can be delivered as web preview, PDF, PPTX and share links.

Required export formats:

- web preview,
- PDF,
- PPTX,
- PNG/HTML where supported.

Required delivery controls:

- quality gate check,
- confidentiality policy,
- role/capability check,
- export ledger,
- share token creation,
- share revocation where applicable,
- client-safe error states.

Acceptance:

- Failed export is not recorded as completed.
- Blocked export shows honest UI and API response.
- PPTX and PDF preserve core visual quality.
- Share link does not leak tenant data.
- Export history is visible in audit/delivery surfaces.

### Epic O - Outputs Library And Cross-Module Integration

Goal:

Generated decks behave as first-class outputs.

Acceptance:

- Deck appears in Outputs Library.
- Deck can be reopened after refresh.
- Source lineage and export metadata are readable.
- Other modules can request deck creation from their artifacts.
- Direct artifact links use correct canonical routes.

### Epic P - Observability And Diagnostics

Goal:

Engineering and QA can diagnose failures without guessing.

Requirements:

- generation pipeline logs each major step,
- UI shows progress and current step,
- errors produce toast + console payload + network response,
- no silent `catch {}` in critical pipeline,
- run id is visible in diagnostics,
- export/share failures are traceable.

Acceptance:

- Fix-retest procedure can always classify failure by step.
- No infinite spinner on generation/export/share.
- Failed pipeline step is visible to QA.

---

## 8. API Contract

### 8.1 Existing APIs To Preserve

Existing endpoints must remain compatible unless a migration plan is explicitly approved:

- `POST /api/presentations/generate/outline`
- `POST /api/presentations/generate/deck`
- `GET /api/presentations/decks/:deckId`
- `PUT /api/presentations/decks/:deckId/autosave`
- `GET /api/presentations/decks/:deckId/quality-gates`
- `GET /api/presentations/decks/:deckId/download`
- `GET /api/presentations/decks/:deckId/export/pdf`
- `GET /api/presentations/decks/:deckId/export/png`
- `GET /api/presentations/decks/:deckId/export/html`
- `POST /api/presentations/decks/:deckId/share`
- `POST /api/presentations/decks/:deckId/agent-edit`
- `POST /api/presentations/decks/:deckId/agent-edit/:operationId/accept`
- `POST /api/presentations/decks/:deckId/agent-edit/:operationId/reject`

### 8.2 New APIs Required For 100 Percent

Source pack:

```text
POST /api/presentations/source-packs
GET  /api/presentations/source-packs/:sourcePackId
POST /api/presentations/source-packs/:sourcePackId/validate
```

Narrative planner:

```text
POST /api/presentations/narrative/plan
POST /api/presentations/narrative/:planId/approve
POST /api/presentations/narrative/:planId/reject
```

Template architect:

```text
POST /api/presentations/templates/architect/propose
GET  /api/presentations/templates/architect/:proposalId
POST /api/presentations/templates/architect/:proposalId/approve
POST /api/presentations/templates/architect/:proposalId/reject
```

Approved-template generation:

```text
POST /api/presentations/templates/:templateId/preflight
POST /api/presentations/templates/:templateId/generate
```

Lifecycle:

```text
POST /api/presentations/decks/:deckId/lifecycle/request-review
POST /api/presentations/decks/:deckId/lifecycle/approve
POST /api/presentations/decks/:deckId/lifecycle/send-back
```

Visual/layout QA:

```text
GET /api/presentations/decks/:deckId/layout-audit
GET /api/presentations/decks/:deckId/consulting-qa
```

### 8.3 API Rules

Every endpoint must:

- require auth unless explicitly public share endpoint,
- enforce organization scope,
- enforce capability where mutation/export/share occurs,
- return structured errors,
- avoid raw stack traces,
- include `runId`/`operationId` where applicable,
- produce audit events for governance mutations.

---

## 9. Data Contract

### 9.1 PresentationSourcePack

```ts
type PresentationSourcePack = {
  sourcePackId: string;
  organizationId: string;
  deckId?: string | null;
  templateId?: string | null;
  createdBy: string;
  createdAt: string;
  sources: PresentationSource[];
  requiredInputCoverage: RequiredInputCoverage[];
  missingInputs: MissingInput[];
  confidence: 'low' | 'medium' | 'high';
  freshness: 'current' | 'stale' | 'mixed' | 'unknown';
  policyState: 'ready' | 'partial_ready' | 'policy_blocked' | 'quota_blocked';
};
```

### 9.2 PresentationNarrativePlan

```ts
type PresentationNarrativePlan = {
  narrativePlanId: string;
  organizationId: string;
  deckId?: string | null;
  sourcePackId?: string | null;
  mainThesis: string;
  audience: string[];
  goal: string;
  argumentSequence: NarrativeStep[];
  evidenceSlots: EvidenceSlot[];
  decisionPoints: DecisionPoint[];
  riskFrames: RiskFrame[];
  appendixNeeds: AppendixNeed[];
  densityMode: 'present' | 'read' | 'hybrid';
  status: 'proposed' | 'approved' | 'rejected';
};
```

### 9.3 PresentationTemplatePlan

```ts
type PresentationTemplatePlan = {
  proposalId: string;
  organizationId: string;
  name: string;
  category: string;
  purpose: string;
  cadence?: string | null;
  audience: string[];
  requiredInputs: TemplateInput[];
  optionalInputs: TemplateInput[];
  slideBlueprint: SlideBlueprint[];
  layoutRules: LayoutRule[];
  qualityRules: QualityRule[];
  governancePolicy: TemplateGovernancePolicy;
  status: 'proposed' | 'approved' | 'rejected';
};
```

### 9.4 DeckDocument

The existing canonical deck model remains the base and must be extended only compatibly.

Required additions:

- `sourcePackRef`,
- `narrativePlanRef`,
- `templatePlanRef`,
- `consultingQaSummary`,
- `layoutAuditSummary`,
- `lifecycle.approvalState`,
- `ai.reviewState`.

### 9.5 Audit Event

```ts
type PresentationAuditEvent = {
  auditId: string;
  organizationId: string;
  deckId?: string;
  templateId?: string;
  sourcePackId?: string;
  operationId?: string;
  actorId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  occurredAt: string;
};
```

---

## 10. UI Contract

### 10.1 Shared UI Rules

All UI must comply with `DRD/UI_UX_SOURCE_OF_TRUTH.md`.

Required:

- no silent execution,
- no hidden learning,
- honest degraded UI,
- traceability,
- tenant/ACL safety,
- no raw internals,
- contextual AI actions in Menu 3 / local command row,
- save state separate from lifecycle state.

### 10.2 `/prezentacje` Route

Required:

- one conversational Teresa input,
- no duplicate local prompt field,
- visible generation progress,
- preview area,
- recent decks,
- clear error states,
- clear route to builder.

### 10.3 Reports & Presentations Hub

Required:

- presentation creation action,
- template planning action,
- template use action,
- outputs filters,
- lifecycle/status filters,
- source lineage read-back,
- export/share quick actions,
- command row right-side AI placement.

### 10.4 Presentation Wizard

Required steps:

1. Intake.
2. Source Pack.
3. Template or Free Mode.
4. Narrative Plan / Outline.
5. Review Approval.
6. Generation Progress.
7. Result / Open Builder / Export.

Required states:

- loading,
- empty,
- partial source,
- missing required input,
- degraded provider,
- policy blocked,
- generation failed with step-level reason,
- success with read-back.

### 10.5 Deck Builder

Deck Builder must follow the executive module layout standard:

1. Left: slide navigation.
2. Center: canvas.
3. Right: contextual functions panel.
4. Top/local command row: lifecycle, QA, export, share, AI actions.

Required builder controls:

- Teresa toggle/history,
- proposal banner,
- accept/reject,
- QA panel,
- source pack panel,
- narrative inspector,
- template inspector,
- lifecycle approval controls,
- version history,
- export/share,
- theme/brand controls,
- audit/history.

### 10.6 Template Architect UI

Required:

- plan template entry,
- prompt/intake for template purpose,
- proposal preview,
- slide blueprint table/cards,
- required inputs list,
- layout rules,
- QA rules,
- approve/reject/revise,
- save draft,
- promote to approved.

### 10.7 Visual Review UI

Required:

- thumbnail preview,
- slide quality indicators,
- layout audit results,
- overflow warnings,
- export parity warnings,
- Gamma-quality benchmark score where applicable.

---

## 11. Starter Templates Contract

Each starter template must include:

- purpose,
- audience/persona,
- default slide count range,
- required inputs,
- optional inputs,
- slide blueprint,
- layout family per slide,
- narrative rules,
- QA rules,
- brand defaults,
- short/medium/detailed variants.

### 11.1 Required Starter Templates

1. Project Steering Committee.
2. Executive Transformation Update.
3. Interview Insights Report.
4. Digital Roadmap Report.
5. AI Readiness Assessment.
6. Business Case.
7. Sales Proposal.
8. Discovery Summary.
9. Research Brief.
10. Workshop Summary.
11. Risk & Decision Review.
12. Initiative Portfolio Review.

### 11.2 Template Acceptance

Each template must pass:

- generate from sample source pack,
- missing required input test,
- visual review,
- QA gate,
- PDF export,
- PPTX export,
- Outputs Library read-back,
- role/capability check.

---

## 12. Testing Contract

### 12.1 Evidence Standard

Every manual test must collect:

- UI evidence,
- toast/banner evidence,
- network/API evidence,
- console evidence,
- refresh resistance,
- result vocabulary,
- severity vocabulary.

Result vocabulary:

- `PASS`
- `PASS_WITH_P2`
- `BLOCKED_P1`
- `INCONCLUSIVE`

Severity vocabulary:

- `P0`
- `P1`
- `P2`
- `P3`

### 12.2 Automated Validation Matrix

Required before closeout:

| Area | Required validation |
| --- | --- |
| Backend services | unit tests |
| Routes | integration/contract tests |
| Tenant/ACL | negative access tests |
| Source pack | source coverage + missing inputs tests |
| Narrative planner | deterministic schema tests |
| Template architect | proposal/approval/reject tests |
| Template registry | lifecycle tests |
| Deck schema | normalization tests |
| Layout engine | slide type -> layout family tests |
| QA engine | P0/P1/P2 result tests |
| AI edits | proposal accept/reject/revert tests |
| Export | PDF/PPTX/PNG/HTML parity tests |
| Frontend | component/smoke tests |
| E2E | wizard -> builder -> export -> read-back |

### 12.3 Manual Test Additions

Add new MT-PRES cases beyond the current backlog:

#### MT-PRES-032 - Gamma-Like Free Generation

Priority: `P1`

Flow:

1. Start from Teresa with no template.
2. Generate 8-10 slide executive deck.
3. Approve outline.
4. Verify deck preview.
5. Open builder.
6. Export PDF.
7. Refresh and reopen from recent.

Expected:

- no duplicate prompt,
- visible progress,
- outline approval,
- deck visually polished,
- source assumptions shown if no sources,
- export works or honestly blocks.

#### MT-PRES-033 - AI Template Architect Plan Only

Priority: `P0`

Flow:

1. Ask AI to plan `Project Steering Committee` template.
2. Verify no deck is generated.
3. Review template proposal.
4. Reject once.
5. Repeat and approve.
6. Verify template registry entry.

Expected:

- proposal -> approval -> execution -> audit,
- reject does not mutate registry,
- approve creates draft/approved template according to capability.

#### MT-PRES-034 - Generate From Approved Template

Priority: `P0`

Flow:

1. Select approved template.
2. Build source pack.
3. Verify required inputs.
4. Generate deck.
5. Verify slide blueprint mapping.
6. Run QA/export.

Expected:

- draft/deprecated templates blocked in governed mode,
- missing data shown,
- deck matches template.

#### MT-PRES-035 - Source Pack Required Inputs

Priority: `P1`

Expected:

- required inputs visible,
- missing inputs disclosed,
- confidence/freshness shown,
- source lineage persists after refresh.

#### MT-PRES-036 - Narrative Planner Review

Priority: `P1`

Expected:

- thesis, argument sequence, evidence slots and decision points visible before generation,
- user can approve/revise,
- narrative links to generated slides.

#### MT-PRES-037 - Layout Intelligence Contract

Priority: `P1`

Expected:

- risk heatmap, RACI, timeline, KPI cards, maturity matrix and financial bridge render correctly,
- layout family is traceable,
- no overflow in preview/export.

#### MT-PRES-038 - Gamma-Level Visual Benchmark

Priority: `P1`

Expected:

- 12 starter templates scored against visual benchmark,
- no client-facing deck below agreed threshold,
- PDF/PPTX match preview.

#### MT-PRES-039 - Consulting QA Categories

Priority: `P1`

Expected:

- executive clarity, narrative coherence, decision readiness, risk visibility, source grounding visible in QA panel.

#### MT-PRES-040 - Lifecycle Approval In Builder

Priority: `P0`

Expected:

- save state and lifecycle state separate,
- request review/approve/send back audited,
- export/share obey lifecycle policy.

#### MT-PRES-041 - Full RBAC Matrix

Priority: `P0`

Expected:

- viewer, editor, admin, superadmin and guest behavior verified for create/edit/export/share/template governance.

#### MT-PRES-042 - Brand Theme Governance

Priority: `P1`

Expected:

- locked brand cannot be changed by unauthorized user,
- approved brand applies to export,
- brand changes audited.

#### MT-PRES-043 - Cross-Module Deck Output

Priority: `P1`

Expected:

- Interview/Research/Roadmap source creates deck output with lineage and read-back.

#### MT-PRES-044 - Export Ledger Integrity

Priority: `P0`

Expected:

- blocked/failed/completed export statuses are correct and auditable.

#### MT-PRES-045 - Observability No Silent Pipeline Failure

Priority: `P0`

Expected:

- every failed pipeline step produces toast + console payload + network evidence.

---

## 13. Release Gates

### Gate 1 - Infrastructure And Current Regression

Must pass:

- fix retest for pipeline 0/8,
- reopen old deck route `/origin/`,
- quick E2E sanity.

Exit:

- `PRESENTATIONS_FIX_RETEST_PASS`, or
- `PRESENTATIONS_FIX_RETEST_PASS_WITH_P2` with owner.

### Gate 2 - Core Generation

Must pass:

- free generation,
- template generation,
- source selection,
- outline/narrative approval,
- builder open,
- autosave,
- read-back.

### Gate 3 - Methodology Core

Must pass:

- source pack,
- narrative planner,
- AI template architect,
- approved-template generation.

### Gate 4 - Visual Gamma-Quality

Must pass:

- 12 starter templates,
- visual benchmark,
- PDF/PPTX parity,
- layout overflow checks.

### Gate 5 - Enterprise Governance

Must pass:

- RBAC,
- confidentiality,
- approval,
- audit,
- quality-gated export/share,
- lifecycle state.

### Gate 6 - Production Readiness

Must pass:

- full validation matrix,
- manual test backlog updates,
- Control Board update,
- release notes,
- rollback plan,
- demo environment verification.

---

## 14. Implementation Work Packages

### WP-01 - Stabilize Current Pipeline

Scope:

- confirm Teresa -> KIMI pipeline,
- ensure step-level errors,
- ensure reopen route,
- ensure builder opens,
- ensure PDF export sanity.

Exit:

- Gate 1 PASS.

### WP-02 - Source Pack Foundation

Scope:

- source pack contract,
- source coverage map,
- required/missing input model,
- source pack panel,
- tenant/ACL tests.

Exit:

- MT-PRES-035 PASS.

### WP-03 - Narrative Planner

Scope:

- narrative plan service,
- narrative review UI,
- approval/rejection,
- link narrative to slides,
- narrative QA hooks.

Exit:

- MT-PRES-036 PASS.

### WP-04 - AI Template Architect

Scope:

- template planning prompt/API,
- proposal model,
- review UI,
- approve/reject,
- registry promotion,
- audit.

Exit:

- MT-PRES-033 PASS.

### WP-05 - Approved Template Generation

Scope:

- approved-only filtering,
- preflight required inputs,
- template slot mapping,
- generation from template,
- export/QA.

Exit:

- MT-PRES-034 PASS.

### WP-06 - Visual Layout Engine Hardening

Scope:

- business layout catalog,
- deterministic layout rules,
- overflow detection,
- visual QA,
- export parity per layout.

Exit:

- MT-PRES-037 and MT-PRES-038 PASS/PASS_WITH_P2.

### WP-07 - Consulting QA Engine

Scope:

- methodology QA,
- executive clarity QA,
- decision readiness QA,
- source grounding QA,
- risk visibility QA,
- QA panel extension.

Exit:

- MT-PRES-039 PASS.

### WP-08 - Builder Lifecycle Approval

Scope:

- lifecycle strip,
- request review,
- approve,
- send back,
- save-vs-lifecycle separation,
- audit.

Exit:

- MT-PRES-040 PASS.

### WP-09 - Brand Theme Governance

Scope:

- locked brand policy,
- capability gates,
- audit,
- export theme parity,
- client brand state.

Exit:

- MT-PRES-042 PASS.

### WP-10 - Cross-Module Outputs

Scope:

- deck output from Interview,
- deck output from Research,
- deck output from Roadmap/AI Audit where available,
- lineage and read-back.

Exit:

- MT-PRES-043 PASS.

### WP-11 - RBAC And Export Integrity

Scope:

- role matrix tests,
- tenant negative tests,
- export ledger integrity,
- share revocation/visibility.

Exit:

- MT-PRES-041 and MT-PRES-044 PASS.

### WP-12 - Final Production Gate

Scope:

- full regression,
- complete manual test pack,
- visual benchmark,
- documentation updates,
- Control Board update,
- deploy verification.

Exit:

- Gate 6 PASS.

---

## 15. Acceptance Checklist

### Product

- [ ] Free prompt-to-deck works.
- [ ] AI template planning works.
- [ ] Generate from approved template works.
- [ ] Decks are outputs from other modules.
- [ ] User can edit via Teresa.
- [ ] User can export/share.

### Governance

- [ ] No silent execution.
- [ ] Proposal approval execution audit exists.
- [ ] Tenant/ACL enforced.
- [ ] RBAC matrix tested.
- [ ] Confidentiality enforced.
- [ ] Lifecycle approval exists.

### Methodology

- [ ] Source pack exists.
- [ ] Narrative planner exists.
- [ ] Template blueprint exists.
- [ ] Consulting QA exists.
- [ ] Missing inputs shown.

### Visual

- [ ] 12 templates visually pass.
- [ ] Business layouts pass.
- [ ] PDF matches preview.
- [ ] PPTX is client-facing.
- [ ] No text overflow.
- [ ] Decks look Gamma-level polished.

### Engineering

- [ ] Canonical deck schema used.
- [ ] Exports are projections.
- [ ] Version history works.
- [ ] Audit log works.
- [ ] Observability works.
- [ ] No raw internals.

### QA

- [ ] MT-PRES-001..031 addressed.
- [ ] MT-PRES-032..045 added and executed.
- [ ] Full validation matrix complete.
- [ ] Evidence stored in reports.
- [ ] Control Board updated.

---

## 16. Final Contract Statement

The implementation is accepted as 100 percent complete only when Consultify Presentation Studio can do all of the following:

1. Generate a beautiful Gamma-level deck from a prompt.
2. Plan a reusable methodology-first template before generation.
3. Generate a deck from an approved template and real source pack.
4. Show missing data, source confidence and source lineage honestly.
5. Render business layouts that are beautiful, readable and export-safe.
6. Allow slide-by-slide and deck-level AI edits through proposal approval execution audit.
7. Maintain deck versions, audit history, lifecycle state and export/share records.
8. Enforce tenant, RBAC and confidentiality boundaries at API and UI levels.
9. Export client-facing PDF/PPTX without fake success.
10. Pass the full automated and manual validation matrix with no open P0/P1.

Until all ten conditions are true, the module is not complete.

---

## 17. Strategic Summary

Gamma is the visual speed benchmark.

Consultify must win on:

- methodology,
- source truth,
- templates as operating standards,
- business layouts,
- governance,
- audit,
- enterprise delivery.

The final product should feel simple to the user:

```text
Tell Teresa what deck you need.
Review the plan.
Approve.
Get a beautiful client-ready deck.
Edit safely.
Export or share with confidence.
```

But internally it must remain a governed artifact engine:

```text
intake -> source pack -> narrative plan -> template/blueprint -> schema
-> render -> QA -> approval -> version -> export/share -> audit
```

That is the full 100 percent contract.

