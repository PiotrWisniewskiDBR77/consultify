# Consulting Tools Standard V1

> Status: proposed master SSOT  
> Scope: all non-licensed consulting tools in `Tools`  
> Reference implementation: `Dynamic SWOT`

---

## 1. Purpose

This document freezes one reusable standard for consulting tools built in Consultify.

The goal is to prevent a repeated pattern where each tool becomes a separate mini-app with its own:

- runtime shell,
- AI contract,
- output logic,
- Help Center linkage,
- review/finalization behavior.

Canonical rule:

> `Dynamic SWOT` is the first reference implementation, not a one-off exception.

---

## 2. Core Mental Model

Every consulting tool must follow one product journey:

```mermaid
flowchart LR
library[Library] --> entry[LightEntry]
entry --> conversation[ConversationCapture]
conversation --> context[MultiSourceContext]
context --> analysis[AnalysisAndBenchmarking]
analysis --> conclusions[AppliedConclusions]
conclusions --> summary[FinalSourceSummary]
summary --> outputs[ReportsDecksInitiativesIdeas]
outputs --> graph[LinkedArtifactGraph]
```

This means:

- `Library` is for selection and preview.
- `Tool Detail` is a light entry card, not a methodology overload.
- `Tool Session` is the active consulting artifact.
- `Conversation` is the primary interface and structure materializes from it.
- `Applied Conclusions` and `Final Source Summary` are mandatory layers.
- `Outputs` are mandatory.
- downstream artifacts must preserve source traceability.

---

## 3. Experience Principles

Every consulting tool must respect the same five experience principles:

1. `light entry`: user first sees why to use the tool, when to use it, and what comes out of it.
2. `conversation-first`: user can work mainly through conversation while the system materializes structure.
3. `mentor AI`: AI behaves as consultant, mentor, and challenger, not only as generator.
4. `applied conclusions`: analysis must end in practical implications, not only descriptive findings.
5. `presentation-ready finish`: final summary must be ready to feed report and presentation flows without rework.

---

## 4. UX Shell Standard

### 4.1 Library

The library stays inside the module hub canon:

- module topbar order: `Area -> Add -> Tool -> View -> Filters`
- one command row only
- `table` and `grid` are minimum view modes
- single-click preview, double-click full detail

### 4.2 Tool Detail

The methodology detail is read-only and must follow one canonical onboarding structure:

1. `Goal`
2. `Process`
3. `Expected Results`
4. `Example`

Interpretation of the four sections:

- `Goal`: what the tool is for, when to use it, and what is explicitly not its job.
- `Process`: high-level logic of the method without operational overload.
- `Expected Results`: output types and what "good quality" means.
- `Example`: one strong case that shows the path from analysis to decision.

It should feel like an intellectual onboarding surface:

- short promise first,
- methodology depth second,
- one strong example instead of many weak ones,
- zero active work inside the library detail.

Primary CTAs:

- `Start session`
- `How to / Knowledge base`

### 4.3 Tool Session

Every active consulting tool session uses the same `N`-mode shell:

- `Header -> PropertiesStrip -> ActionBar -> LeftNav + Canvas`
- canonical work phases:
  - `Mission & Context`
  - `Input & Exploration`
  - `Tool Build`
  - `Synthesis & Insights`
  - `Outputs & Actions`

Inside that shell, the working experience must support:

- a strong mission framing before analysis starts,
- one input collection phase that merges interview, materials, and external context,
- one construction phase where the tool-specific structure is built,
- one synthesis phase where insight quality is created,
- one output phase that bridges into execution-ready artifacts.

Supporting utilities such as `Comments`, `Activity`, and `Used in` are still allowed, but they are not primary thinking phases and must not dominate the left navigation.

Reference implementation files:

- `src/components/DiscoveryTools/KnownToolDetailView.tsx`
- `src/components/DiscoveryTools/ToolDocumentView.tsx`
- `src/components/shared/NModeLayout/NModeShell.tsx`

---

## 5. Runtime Contract

Every tool-specific session must map onto the same reusable consulting runtime:

1. `Mission & Context`
2. `Input & Exploration`
3. `Tool Build`
4. `Synthesis & Insights`
5. `Outputs & Actions`

### 5.1 Reusable Layers

Every tool session must expose:

- `mission/context`
- `signals`
- `tool-specific working structure`
- `analysis/synthesis`
- `appliedConclusions`
- `finalSourceSummary`
- `recommendedMoves`
- `outputCandidates`

### 5.2 Runtime Interpretation

Interpretation of the shared runtime:

- `Mission & Context`: define the strategic question, scope, time horizon, success definition, and constraints.
- `Input & Exploration`: gather signals from interview, uploads, links, org context, and AI-added external references.
- `Tool Build`: turn signals into the method-specific working structure such as a matrix, map, score, or hypothesis set.
- `Synthesis & Insights`: convert the structure into tensions, interpretations, applied conclusions, and candidate moves.
- `Outputs & Actions`: create the final source summary and generate reports, presentations, initiatives, or ideas from that source.

### 5.3 What Is Tool-Specific

Tools may customize:

- signal taxonomy,
- synthesis logic,
- move categories,
- scoring models,
- visual work surface,
- domain-specific benchmark sources.

### 5.4 What Is Shared

Tools must not reinvent:

- lifecycle,
- session shell,
- mission model,
- signals layer,
- AI mentor role,
- review/finalize gate,
- missing-items loop,
- applied conclusions layer,
- final source summary contract,
- output layer,
- traceability rules,
- KB resolution contract.

---

## 6. Dynamic SWOT As Reference

`Dynamic SWOT` is the reference because it demonstrates the full consulting story in a way that can be generalized:

- `Mission & Context`
- `Input & Exploration`
- `SWOT Build`
- `Synthesis & Insights`
- `Outputs & Actions`

Reusable pattern extracted from SWOT:

- light entry first,
- mission question first,
- signals captured before the matrix is forced,
- one build phase creates a structured method surface,
- synthesis converts items into tensions or priorities,
- moves translate synthesis into action,
- conclusions are discussed before finalization,
- one summary feeds all outputs,
- outputs convert moves and conclusions into real artifacts.

SWOT-specific logic that should not become the universal contract:

- quadrants `strengths / weaknesses / opportunities / threats`
- correlations `SO / WO / ST / WT`
- tension types `attack / repair / defend / protect`

MVP rule:

> `Dynamic SWOT` is the first MVP implementation of the standard. Only after the five-phase session model works well in SWOT should it be rolled out to additional consulting tools.

---

## 7. AI Mentor Contract

AI in consulting tools must behave consistently:

- conversation-first, structure-backed
- AI acts as consultant, mentor, and challenger
- propose, never silently overwrite
- materialize responses into explicit session state
- support discussion on inputs, analysis, and conclusions
- preserve output traceability
- support iterative loop: `missing -> add -> re-process`

### 7.1 Conversation Layers

The AI contract has three mandatory conversation layers:

1. `capture conversation`
2. `analysis conversation`
3. `conclusion discussion`

### 7.2 Capture Conversation

At input stage, AI should:

- ask short purposeful questions,
- reduce methodological burden on the user,
- explain why it is asking,
- turn natural language into draft structure,
- ask for confirmation when structure matters.

### 7.3 Analysis Conversation

At analysis stage, AI should:

- show what it understood,
- explain the logic of the analysis,
- make benchmark or reference points explicit,
- highlight tensions, trade-offs, and missing evidence,
- invite correction instead of presenting analysis as final truth.

### 7.4 Conclusion Discussion

At conclusion stage, AI should:

- explain implications for the organization,
- distinguish recommendations from hypotheses,
- discuss what to do, what not to do, and what to validate,
- accept user pushback and revise,
- prepare a source-grade final summary for outputs.

### 7.5 Multi-Source Context

AI and runtime must support context from:

- conversation,
- attachments and links,
- organization knowledge,
- other platform artifacts,
- web / benchmarks / points of reference.

Minimum AI stages:

1. frame purpose and expected finish
2. gather mission and context
3. propose evidence items from multiple sources
4. synthesize evidence and benchmark context
5. discuss applied conclusions
6. prepare final source summary
7. generate output candidates

Reference implementation:

- `src/hooks/discovery/useToolAI.ts`
- `src/store/useToolStore.ts`

---

## 8. Output Standard

Every consulting tool must support the same output contract:

1. `initiative`
2. `report`
3. `presentation`
4. `idea`

Rules:

- a tool cannot dead-end on summary only
- outputs must be visible in the runtime
- final source summary is the canonical source artifact for output creation
- tool session remains linkable as the parent artifact
- at least one happy-path output flow must be operational
- outputs must preserve:
  - `source_type`
  - `source_id`
  - `source_version`
- preferred extended traceability:
  - source summary section
  - supporting evidence ids
  - linked conclusions / moves
- `task` is not a tool output

Transition rules:

- `summary -> report`
- `summary -> presentation`
- `conclusion or move -> initiative`
- `conclusion or hypothesis -> idea`

Reference implementation:

- `src/services/outputsScaffolding.ts`
- `docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md`

---

## 9. Knowledge Base And Sidebar Contract

Every tool must have one deterministic Help Center article:

- slug: `tools-<toolType>-how-to`
- `related_modules: [toolType]`
- EN + PL required
- Known Tools metadata must point to the same article slug

This creates one consistent triangle:

- library preview,
- active tool session,
- contextual Help Center.

Reference implementation:

- `docs/product/TOOLS_HELP_CENTER_SIDEBAR_CONTRACT_V1.md`
- `server/src/services/KnownToolsService.ts`

---

## 10. Adoption Checklist

A tool is considered aligned with the standard only if all of the following are true:

- it has a product spec aligned to the runtime flow
- it has one canonical KB article
- it has complete Known Tools preview content
- it uses the standard session shell
- it implements `entry -> conversation -> context -> analysis -> applied conclusions -> final summary -> outputs`
- AI mentor behavior is defined
- it supports the four standard outputs
- it has review/finalization logic
- it preserves traceability into outputs
- it has a validated smoke path `Library -> Session -> Outputs`

---

## 11. Rollout Priority

### Wave 1: Closest To SWOT

These tools should adopt the standard first because they are structurally closest to `Dynamic SWOT`:

- `market-forces`
- `growth-paths`
- `portfolio-priority`
- `risk-uncertainty`

### Wave 2: Remaining Strategic Synthesis Tools

- `value-chain`
- `ambition-decomposer`
- `focus-tradeoff`
- `capability-mapper`
- `narrative-engine`

### Wave 3: Operational And Automation Tools

- `sop-builder`
- `a3-problem-solving`
- `smed-planner`
- `dms-builder`
- `inventory-autopilot`
- `vsm-builder`
- `constraint-control`
- `decision-engine`
- `control-tower`
- `automation-pipeline`
- `robotics-feasibility`
- `logistics-automation`
- `rpa-scanner`
- `ai-discovery`
- `integration-diagnostic`
- `digital-value-pool`
- `legacy-analyzer`
- `data-inventory`
- `pain-to-solution`
- `pain-explorer`
- `process-automation`

---

## 12. Reference Files By Layer

### Product / Content

- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_STANDARD_ROLLOUT_V1.md`
- `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`
- `docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md`
- `docs/product/TOOLS_HELP_CENTER_SIDEBAR_CONTRACT_V1.md`
- `docs/product/TOOL_BUILD_CHECKLIST_V1.md`

### Frontend

- `src/components/DiscoveryTools/KnownToolDetailView.tsx`
- `src/components/DiscoveryTools/ToolDocumentView.tsx`
- `src/components/DiscoveryTools/ToolCanvas.tsx`
- `src/components/shared/NModeLayout/NModeShell.tsx`
- `src/components/shared/ToolWizard/defaultToolConfigs.ts`
- `src/config/consultingToolsStandard.ts`

### Runtime / AI

- `src/store/useToolStore.ts`
- `src/hooks/discovery/useToolAI.ts`
- `src/services/outputsScaffolding.ts`

### Backend / Knowledge

- `server/src/services/KnownToolsService.ts`
- `server/src/services/KnowledgeBaseService.ts`

---

## 13. Definition Of Done

The standard is considered adopted when:

- product, content, frontend, AI, and backend reference the same contract
- `Dynamic SWOT` remains the reference implementation
- new tools are built as variants of one standard, not bespoke flows
- the real target experience feels like working with a very good AI consultant
- review feedback can point to one SSOT instead of scattered documents
