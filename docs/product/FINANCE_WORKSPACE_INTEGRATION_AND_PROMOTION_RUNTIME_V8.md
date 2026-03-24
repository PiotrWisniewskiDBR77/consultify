# Finance Workspace Integration And Promotion Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical integration and promotion model for Finance across notes, ideas, initiatives, reports, presentations and adjacent platform artifacts

---

## 1. Why this document exists

Finance cannot behave like an isolated analysis tool.

The value of the module is not only:

- importing statements
- building models
- running valuation

The real value is:

- preserving financial context
- turning findings into action
- feeding downstream artifacts without losing meaning
- keeping traceability between finance source work and the rest of the platform

This document closes that gap.

---

## 2. Core statement

`Finance` is not only a destination for numbers.

It is also a source system for:

- notes
- ideas
- initiatives
- reports
- presentations
- investment and review decisions

Canonical rule:

`finance work may mature into many downstream artifacts, but every promoted artifact must remain traceable to one or more finance source objects`

Additional rule:

`the user should experience one connected finance workspace, while AI orchestrates promotion, note capture, initiative shaping and deliverable generation without forcing the user to manually rebuild context`

---

## 3. Core product statement

The Finance module should support the full movement:

`recognized source -> model -> analysis or budget or valuation -> note or idea or initiative or report or presentation`

This means Finance must support:

- inbound evidence and linked sources
- internal maturation across recognition, model, analysis, budget and valuation
- outbound promotion into platform artifacts
- AI-guided continuity between finance work and downstream execution or communication

Canonical statement:

`Finance v8` is the AI-driven financial workbench that turns imported evidence, modeled finance logic and review findings into traceable knowledge, decisions, initiatives and executive-grade outputs without forcing users to manually repackage the same context multiple times.

---

## 4. Integration directions

### 4.1 Inbound into Finance

Context may enter from:

- local `PDF` and `Excel` files
- cloud-linked finance files
- notes and notebook pages
- ideas and initiative contexts
- interview evidence and assumptions
- Results and ROI context
- tasks, decisions and execution questions

### 4.2 Lateral inside Finance

Context may move between:

- recognition and repair
- first model
- analysis packs
- budgeting and forecasting
- valuation and investment cases
- CFO review packs

### 4.3 Outbound from Finance

Finance work may promote into:

- `Notebook note`
- `Idea workspace`
- `Initiative`
- `Report`
- `Presentation`
- `Decision`
- `Result / ROI / KPI-supporting object`

### 4.4 Invisible AI-driven orchestration

AI should keep finance grounded in:

- source documents
- linked notes
- initiative and ROI context
- budget and valuation assumptions
- downstream outputs already created from the same source

This grounding should remain mostly invisible to the user.

---

## 5. Canonical objects

### 5.1 `FinanceWorkspaceRef`

Represents the finance working context.

It should contain:

- `workspaceId`
- `activeSurface`
- `activeArtifactRefs`
- `sourcePackRefs`
- `linkedArtifactRefs`

### 5.2 `FinanceSourcePack`

Represents the governed set of source material around the finance artifact.

It should contain:

- `statementPackRefs`
- `modelRefs`
- `analysisRunRefs`
- `budgetRefs`
- `valuationRefs`
- `noteRefs`
- `externalSourceRefs`
- `initiativeRefs`

### 5.3 `FinancePromotionProposal`

Represents AI or user-initiated conversion of finance work into downstream artifacts.

It should contain:

- `targetArtifactType`
- `sourceArtifactRefs`
- `sourceSnapshotRefs`
- `proposedPayload`
- `rationale`
- `traceabilityPlan`
- `resolution`

### 5.4 `PromotedFinanceArtifactLink`

Represents the persistent link between finance work and downstream artifact.

It should contain:

- `sourceFinanceRef`
- `sourceArtifacts`
- `targetArtifact`
- `promotionType`
- `sourceSnapshotRef`

---

## 6. Promotion doctrine by artifact type

### 6.1 Finance to Notebook note

Use when:

- the user wants to capture interpretation
- assumptions need durable explanation
- a review note should persist outside the immediate finance run
- CFO or analyst commentary should be reusable later

Examples:

- "why the model is blocked"
- "assumption pack for WACC"
- "credit concerns before committee review"

Rule:

`finance notes should preserve exact source references, not paraphrase numbers into detached text`

### 6.2 Finance to Idea

Use when:

- financial findings suggest broader strategic exploration
- the user wants to explore options before committing to execution
- capital allocation or business-model implications need structured thinking

Examples:

- margin improvement hypotheses
- working-capital redesign
- refinancing options
- pricing or product-mix scenarios

Rule:

`finance to idea is upstream exploration, not yet execution commitment`

### 6.3 Finance to Initiative

Use when:

- finance outputs justify a concrete action program
- a company or initiative needs execution follow-through
- ROI, budget and impact logic should move into governed delivery

Examples:

- cost program
- refinancing initiative
- working-capital improvement initiative
- turnaround or restructuring work

Rule:

`initiative creation from finance must stay propose -> accept, never silent materialization`

#### Promotion gate requirements

> V8 Decision W6-8 applied — 2026-03-23

Finance→initiative promotion requires **both** a permission gate **and** an artifact-quality gate. Permission alone is not sufficient.

Minimum gate families:

| Gate family | What it checks |
|---|---|
| **Actor authority** | User must have initiative-creation permission in the target project |
| **Source artifact confidence/quality** | Finance artifact must be in a reviewed or approved state (not draft or stale) |
| **Provenance and stale-state preservation** | Promotion must carry source snapshot refs and declare freshness state |
| **Review path for high-impact** | High-impact promotions (material initiatives, large capital allocation) require additional review or approval |

Canonical rule:

`no finance-to-initiative promotion on permission alone`

### 6.4 Finance to Report

Use when:

- the output is document-first
- the audience needs readable narrative with source traceability
- the artifact should preserve snapshots and analytical conclusions

Examples:

- lender report
- investor memo
- monthly finance review
- valuation memo

Rule:

`report generation from finance must always resolve through saved source snapshots, not unstable live values`

### 6.5 Finance to Presentation

Use when:

- the output is communication-first
- the audience is board, sponsor, investor or management
- the user wants executive storytelling grounded in financial truth

Examples:

- board finance pack
- investment committee deck
- valuation presentation
- restructuring story deck

Rule:

`presentation promotion should preserve source-backed slide generation and the exact finance context used`

---

## 7. Finance-specific promotion triggers

The system should support triggers such as:

- `analysis finding -> create note`
- `blocked model -> create recovery note`
- `valuation complete -> create report`
- `budget variance review -> create presentation`
- `finance recommendation -> create initiative proposal`
- `capital allocation finding -> open as idea workspace`

These triggers may be user-initiated or AI-proposed.

---

## 8. AI role in promotion and integration

AI should:

- detect when finance work is mature enough to promote
- recommend the right target artifact type
- prepare first draft payloads for notes, ideas, initiatives, reports and presentations
- preserve source and snapshot refs automatically
- explain why a given promotion path is appropriate

AI should not:

- silently create durable artifacts
- hide when a promotion is based on weak or stale source data
- promote finance findings into initiative truth without explicit review

Canonical promotion pattern:

`finance context -> AI proposal -> user review -> promoted artifact -> durable traceability link`

---

### 8.1 Source refresh and promoted artifact staleness

> V8 Decision W6-10 applied — 2026-03-23

When a cloud-linked source refreshes and the underlying finance model changes, promoted artifacts must be handled as follows:

- **Auto-flag** the promoted artifact (not only the underlying model) with a stale / source-updated warning.
- **Do not auto-mutate** the promoted artifact. The promoted artifact retains its original snapshot.
- The promoted artifact shows a re-review path so the user can decide whether to refresh from the updated source or detach.
- Re-promotion from the updated model is a new explicit action.

Canonical rule:

`source refresh propagates staleness visibility upward`

---

## 9. Traceability doctrine

Every promoted finance artifact must preserve:

- source finance artifact refs
- source snapshot refs
- creation actor
- creation time
- promotion rationale
- downstream linkback

This is especially important for:

- reports
- presentations
- initiatives with finance justification
- notes carrying assumption or risk logic

---

## 10. What makes this stronger than common finance tools

Most finance tools stop at:

- analysis
- planning
- valuation

`consultify` should go further and support:

- durable finance notes
- finance-driven idea shaping
- finance-origin initiatives
- source-backed reports
- source-backed presentations

This creates one continuous path from number to action to communication.

---

## 11. Related canonical docs

- `FINANCE_V8_SSOT.md`
- `FINANCE_AI_COPILOT_AND_AGENT_RUNTIME_V8.md`
- `FINANCE_PROFESSIONAL_ANALYSIS_BUDGETING_AND_VALUATION_RUNTIME_V8.md`
- `FINANCE_EXPORT_V3.md`
- `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
- `NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md`
