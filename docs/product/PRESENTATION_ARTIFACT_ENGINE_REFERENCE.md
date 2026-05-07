# Consultify Presentation Artifact Engine — Reference

Status: `REFERENCE`
Owner: Product / AI / Engineering
Audience: Consultify core team (product, backend, frontend, AI, QA)
Date: 2026-05-06

## 1) Strategic Positioning

Consultify should not ship a simple "presentation generator".  
The target product is a **Presentation Artifact Engine**:

- methodology-first (consulting logic first, design second),
- governance-first (proposal/approval/audit workflow),
- template-as-operating-model (not only visual skin),
- artifact-first (versioned, traceable, reviewable output),
- board-ready quality in repeatable enterprise flows.

In short:

- **Gamma**: content/design-first generation,
- **Consultify**: business context -> governed decision artifact.

## 2) Benchmark Summary (Gamma vs Consultify)

### What Gamma does well

- Fast AI generation from prompt/text.
- Template-based generation path.
- Strong visual output and speed.
- Async generation contract (`create -> poll -> result`).
- Multi-export support (`PDF`, `PNG`, `PPTX`, links).

### Gaps to exploit (Consultify advantage)

- No deep editable lifecycle for existing decks through API-level workflow.
- Limited enterprise governance semantics for consulting process.
- Template as design pattern, not operating standard.
- Less deterministic behavior for structured reporting content.

### Product implication

Consultify needs dual modes:

1. **Free generation** (Gamma-like speed),
2. **Template-governed generation** (enterprise repeatability and control).

## 3) Product Thesis

Target flow is:

`business context -> source pack -> AI template plan -> approval -> slide schema -> generation -> render -> QA -> versioned artifact -> export/share`

This replaces a naive flow:

`prompt -> outline -> deck`

## 4) Product Name (Working)

- **Consultify Presentation Studio** (recommended external name),
- internal architecture codename: **Deck OS** / **Presentation Artifact Engine**.

## 5) Core User Modes

## 5.1 Generate Like Gamma (Free Generation)

User asks for a presentation from a brief.  
System proposes structure, density, style, visuals, and draft narrative.

## 5.2 Plan Template First (Key Differentiator)

User asks to plan a reusable template first (without generating deck immediately).  
System designs:

- purpose,
- audience/persona,
- section order,
- slide blueprint,
- required inputs,
- decision points,
- risks,
- execution cadence.

Then user approves template.

## 5.3 Generate From Approved Template (Enterprise)

System:

- resolves selected approved template,
- builds source pack,
- checks required data and reports gaps,
- maps data to slide slots,
- generates governed deck,
- runs quality gates,
- versions and exports.

## 6) Mandatory System Components

## 6.1 Presentation Request Intake

Input contract from chat and UI must capture:

- presentation type,
- audience/persona,
- objective (`decide`, `inform`, `align`, `sell`),
- source artifacts and evidence scope,
- tone/style,
- generation mode,
- output targets (`web`, `pdf`, `pptx`, share link),
- confidentiality policy.

## 6.2 Source Pack Builder

Builds explicit source object before generation:

- meetings/interviews/research,
- KPI/financial/CRM signals,
- risks/issues/decisions/tasks,
- previous artifacts/reports,
- brand and methodology context,
- confidence and missing inputs.

Without this, output risks becoming visually good but weak in evidence.

## 6.3 Narrative Planner

Consulting logic layer responsible for:

- main thesis,
- argument order,
- decision moments,
- evidence placement,
- risk framing,
- recommendation sequencing,
- depth profile (presentation vs read deck).

## 6.4 AI Template Architect

Generates **template plan**, not deck:

- reusable section model,
- slide families,
- required/optional data,
- governance and usage criteria,
- cadence (`weekly`, `bi-weekly`, etc.),
- audience fit.

## 6.5 Template Registry

Each template must have:

- stable ID and category,
- owner and approval state,
- version lineage,
- persona mapping,
- brand theme binding,
- required/optional inputs,
- slide schema and layout rules,
- governance permissions.

## 6.6 Slide Schema Engine

Every slide exists as structured data before render:

- slide type,
- purpose,
- message,
- block schema,
- data source mapping,
- layout rule,
- density,
- notes policy,
- approval requirement (if decision-critical).

## 6.7 Layout Intelligence Engine

Must support business-native slide families, minimum:

- executive summary,
- KPI cards/dashboard,
- timeline/roadmap,
- risk heatmap,
- decision slide,
- before/after,
- process/swimlane/RACI,
- value case / financial bridge,
- initiative portfolio,
- maturity matrix,
- interview insights,
- action plan,
- appendix detail.

## 6.8 Theme & Brand Governance Engine

Theme is locked enterprise object, not ad-hoc color choice:

- logos, fonts, colors,
- spacing and hierarchy,
- table/chart style,
- slide-family-specific visual rules,
- presentation vs read-deck policy.

## 6.9 Content QA & Consulting QA Engine

Automated checks for:

- clear thesis per slide,
- no placeholders / no encoding artefacts / no raw internals,
- audience-fit detail level,
- source-backed claims,
- no contradictions,
- decision readiness,
- template completeness.

## 6.10 Artifact Versioning & Approval

Deck is governed artifact:

- semantic versions (`v0.1`, `v0.2`, `v1.0`),
- generation provenance,
- source lineage,
- template/version binding,
- diff history,
- approval log,
- export audit trail.

## 7) Workflow Patterns

## 7.1 Free Generation

Brief -> intent extraction -> outline proposal -> approval -> deck draft -> guided edits -> export/share.

## 7.2 Template Planning

Request template -> AI template plan -> user approval -> template registry save.

## 7.3 Generate From Template

Template + context period -> source pack -> missing-input check -> governed generation -> QA -> version -> export.

## 7.4 Artifact From Other Modules

Presentation must be default output format for key modules:

- research session -> research brief deck,
- interview module -> insights deck,
- AI audit -> readiness report deck,
- digital roadmap -> transformation roadmap deck,
- project review -> steering committee deck,
- strategy workshop -> executive decision deck,
- KPI/ROI analysis -> business case deck.

## 8) Logical Architecture

`Request (UI/Chat) -> Intent Parser -> Source Pack Builder -> Narrative Planner -> Template Selector/Architect -> Outline Approval -> Slide Schema Generator -> Content Generator -> Layout Renderer -> Theme Engine -> QA/Governance -> Artifact Preview -> Export/Share/Version`

## 9) Data Model (Reference)

## 9.1 PresentationArtifact

- identity, workspace/client scope,
- template and source pack binding,
- artifact status and version,
- output targets,
- slide instances.

## 9.2 PresentationTemplate

- category, status, owner,
- audience/personas,
- slide blueprint model,
- required inputs,
- bound theme/governance rules.

## 9.3 SlideBlueprint

- purpose,
- required data,
- layout and density rules,
- approval flag for decision-grade slides.

## 9.4 SlideInstance

- generated concrete content/blocks,
- quality status and score,
- review state.

## 10) Anti-Patterns (Do Not Do)

- Do not build as thin wrapper over external generation API.
- Do not treat template as pure visual preset.
- Do not skip explicit slide schema.
- Do not allow silent AI mutations without proposal/approval/audit.
- Do not ship non-traceable decision slides.

## 11) What To Reuse From Gamma (Philosophy)

Use as inspiration:

- prompt-to-outline speed,
- card-native authoring model,
- fast preview loop,
- theme ergonomics,
- multi-format export ergonomics.

Do not copy directly:

- weak methodology-first constraints,
- nondeterministic structured reporting behavior,
- regeneration-only editing model.

## 12) MVP Roadmap (Recommended)

## MVP-1: Web Artifact Deck

- chat-to-deck,
- outline approval,
- 8-12 business slide types,
- preview + version history,
- PDF export.

## MVP-2: AI Template Planner

- "plan template" flow,
- blueprint + required inputs,
- approval + registry.

## MVP-3: Generate From Approved Template

- source pack integration,
- missing input checks,
- schema-bound generation,
- QA gates.

## MVP-4: PPTX Export

- editable text/layout baseline,
- theme parity with web/PDF.

## MVP-5: Advanced Visual Engine

- AI images/diagrams/heatmaps/timelines/RACI/maturity visuals.

## 13) Initial Template Pack (Priority Set)

1. Project Steering Committee
2. Executive Transformation Update
3. Interview Insights Report
4. Digital Roadmap Report
5. AI Readiness Assessment
6. Business Case
7. Sales Proposal
8. Discovery Summary
9. Research Brief
10. Workshop Summary
11. Risk & Decision Review
12. Initiative Portfolio Review

Each template requires:

- purpose and persona,
- required inputs,
- slide logic and quality contract,
- short/medium/detailed variants.

## 14) Functional Requirements (Must-Have)

- Generate deck from chat.
- Plan template with AI before generation.
- Human approval of template plan.
- Save approved templates as reusable objects.
- Generate from approved template and from free mode.
- Versioned deck artifacts with provenance.
- Slide schema + type system.
- Brand-governed themes.
- Preview + PDF/PPTX exports.
- Missing-data signaling before generation.
- QA gates before release/share.

## 15) Non-Functional Requirements

- consulting-grade visual quality,
- deterministic behavior for structured content where required,
- editability at slide level,
- role/access controls,
- confidentiality and audit compliance,
- tenant-safe sharing/export permissions.

## 16) Build-vs-Buy Decision

Recommended:

- short-term: use Gamma as quality benchmark and optional external comparator,
- long-term: build native Consultify Presentation Artifact Engine.

Reason:

- deep editing, governance, versioning, provenance, and template intelligence are core IP and cannot rely on generation-only external API semantics.

## 17) Team One-Liner

We are building **Consultify Presentation Studio**: an enterprise artifact engine that transforms consulting work outputs into board-ready, versioned, governed presentations, with AI-powered template planning, approval workflow, source traceability, and multi-format delivery.

## 18) AI Deck Editor (Critical Extension)

Market direction is shifting from:

- AI as first-draft generator

to:

- AI as conversational deck editor.

This means generation is only draft creation. The core value starts in iterative editing with the user.

For Consultify, this is more important than in generic presentation tools, because deck quality must preserve consulting logic, governance, and decision readiness.

## 19) Gamma Agent vs Consultify Editing Agent

| Area | Gamma-style agent | Consultify Presentation Agent |
| --- | --- | --- |
| Primary goal | Fast deck editing | Decision-artifact editing |
| Core value | Design + speed | Methodology + governance + argument quality |
| Structure | card model | slide schema + artifact model |
| Edit flow | chat commands | chat commands + proposal + approval + diff |
| Sources | prompt/import-centric | source pack + module lineage |
| Template logic | design/content template | operational meeting/work template |
| QA | generic quality | consulting QA + data QA + decision QA |
| Output | deck/document | versioned enterprise artifact |

## 20) Upgraded End-to-End Workflow

`request -> source pack -> narrative planner -> template architect -> template approval -> slide schema generation -> deck generation (draft) -> AI deck editor -> human review/approval -> versioned artifact -> export/share`

Key rule:

- deck generation creates **draft**,
- agentic editing creates **production-ready artifact**.

## 21) Artifact Editing Runtime (New Core Component)

Required runtime path:

`user command -> edit intent parser -> scope detector -> affected slides/blocks -> edit plan generator -> governance/policy check -> change proposal -> user approval -> apply mutation -> re-render -> QA check -> version save`

Design principle:

- no large mutation without explicit proposal,
- no silent overwrite of artifact history.

## 22) Editing Capabilities (Must Support)

### 22.1 Content Edits

Examples:

- "Make this more executive."
- "Use a formal tone."
- "Strengthen decision framing."

Expected behavior:

- reduce operational noise,
- increase decision and impact framing,
- align to persona (`CEO`, `CFO`, `PMO`, sponsor),
- preserve source-backed claims.

### 22.2 Structure Edits

Examples:

- "Move risk section before roadmap."
- "Add summary slide."
- "Split slide 7 into two slides."

Expected behavior:

- reorder sections/slides with transition consistency,
- update table of contents/section mapping,
- keep template compliance.

### 22.3 Layout and Readability Edits

Examples:

- "This slide is too dense."
- "Improve readability."
- "Convert this into a table."

Expected behavior:

- content-density balancing,
- deterministic slide-type conversion,
- visual hierarchy preservation.

### 22.4 Branding Edits

Examples:

- "Apply DBR77 executive brand."
- "Switch to dark style."

Expected behavior:

- apply theme token set and spacing rules,
- enforce brand governance permissions,
- run contrast/readability checks,
- preserve confidentiality policy.

### 22.5 Methodology Edits (Consultify-Specific)

Examples:

- "Check if this matches KS template."
- "Prepare CFO variant."
- "Add decisions expected from board."

Expected behavior:

- template compliance check,
- required section coverage check,
- decision/risk/owner completeness check,
- persona-specific varianting.

### 22.6 Evidence-Controlled Edits

Examples:

- "Add stronger data to slide 5."

Expected behavior:

- source-pack lookup first,
- confidence/freshness labeling,
- explicit data-gap signaling if missing,
- zero hallucinated business claims.

## 23) Command Scope Model

Agent must classify scope before mutation:

- **Local**: one slide/block (`slide_004`).
- **Sectional**: section range (`risk section`, `slides 5-8`).
- **Global**: full deck.
- **Methodological**: template/persona/governance transformation.

## 24) Edit Object Model (Audit and Rollback)

Every applied or rejected edit must be represented as first-class object:

```json
{
  "edit_id": "edit_0921",
  "deck_id": "deck_vts_ks_001",
  "command": "Make slides 3-5 more executive and reduce operational detail.",
  "scope": ["slide_003", "slide_004", "slide_005"],
  "edit_type": "content_and_structure",
  "proposed_changes": [
    "Shorten operational descriptions",
    "Add business impact statements",
    "Move technical details to appendix"
  ],
  "approval_status": "approved",
  "applied_by": "AI Deck Editor",
  "approved_by": "Piotr",
  "version_before": "0.3",
  "version_after": "0.4"
}
```

Mandatory properties:

- command text,
- scope classification,
- proposal payload,
- approval state,
- before/after version IDs,
- actor identity,
- timestamp.

## 25) API Strategy Implication

Important product constraint:

- external generation APIs may support new artifact creation,
- but may not provide full programmatic in-place editing lifecycle.

Therefore Consultify must own:

- slide schema runtime,
- mutation engine,
- proposal/approval/audit system,
- versioned artifact storage.

External providers can be benchmark/renderer options, not editing-runtime core.

## 26) UI Pattern for Conversational Editing

Recommended enterprise layout:

- left: **agent chat** (commands and intent),
- right: **live artifact preview** (current deck + staged diffs),
- side inspector: **template/source/QA/version/governance state**,
- controls: **approve / reject / rollback / apply to scope**.

This should behave like:

- conversational speed from modern AI editors,
- enterprise control from governed artifact systems.

## 27) Added Functional Requirements: AI Deck Editor

The module must additionally guarantee:

- chat-based deck editing,
- intent-to-scope detection (slide/section/deck),
- pre-apply change proposal for non-trivial edits,
- visible diff before commit,
- accept/reject flow,
- rollback support,
- full edit history,
- edits across content/structure/layout/brand/tone,
- template compliance validation on edits,
- data completeness and source validation on edits,
- unsourced claim flagging,
- persona variant generation (`CEO`/`CFO`/`PMO`),
- mode variant generation (`present` vs `send/read`),
- role/permission/confidentiality enforcement,
- audit-log persistence for major mutations.

## 28) Product Definition (Updated)

Consultify Presentation Studio is not only an AI deck generator.  
It is an **AI Presentation Artifact Editor**:

- plans template logic,
- generates first draft from governed context,
- supports conversational iterative editing,
- preserves methodology and source discipline,
- enforces approval and version governance,
- delivers board-ready multi-format artifacts.
