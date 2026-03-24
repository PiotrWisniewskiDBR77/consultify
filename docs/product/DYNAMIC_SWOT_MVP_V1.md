# Dynamic SWOT MVP V1

> Status: proposed MVP contract  
> Scope: first implementation of the consulting tools session standard  
> Depends on:
> - `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`
> - `docs/product/DYNAMIC_SWOT_TOOL_SPEC_V1.md`

---

## 1. Purpose

This document defines the first shippable MVP for `Dynamic SWOT`.

It is not the final form of the tool.

It is the first production implementation of the new standard for consulting tool sessions:

- clear library onboarding,
- five-phase session model,
- AI as coach plus pipeline,
- one final summary feeding outputs,
- clean bridge to reports, presentations, and initiatives.

Canonical rule:

> If this MVP works well in `Dynamic SWOT`, the same session architecture should be reused in the next consulting tools.

---

## 2. MVP Scope

The MVP includes exactly five session phases:

1. `Mission & Context`
2. `Input & Exploration`
3. `SWOT Build`
4. `Synthesis & Insights`
5. `Outputs & Actions`

The MVP library detail must use exactly four read-only sections:

1. `Goal`
2. `Process`
3. `Expected Results`
4. `Example`

---

## 3. MVP UX Contract

### 3.1 Layout

The session uses:

- left: phase navigation
- center: work canvas
- right: persistent AI coach

The product should feel like a thinking system, not a document browser.

### 3.2 Mission & Context

Must include:

- strategic question
- scope
- time horizon
- success definition
- optional assumptions / constraints

Done condition:

- the session has a usable mission brief.

### 3.3 Input & Exploration

Must include:

- dynamic interview prompts
- file and link ingestion
- AI-added external context

Canonical data output:

- all captured material is normalized into `signals`

Done condition:

- enough signal density exists to build SWOT.

### 3.4 SWOT Build

Must include:

- four quadrants
- inline edit
- source visibility
- confidence visibility
- AI suggestions and deduplication

Done condition:

- each quadrant has meaningful entries and the matrix is usable for synthesis.

### 3.5 Synthesis & Insights

Must include:

- strategic tensions
- interpretation
- applied conclusions
- recommended moves

Done condition:

- the session produces real insight, not just categorized notes.

### 3.6 Outputs & Actions

Must include:

- final source summary
- generate report
- generate presentation
- generate initiatives
- list of initiatives created from the session

Done condition:

- at least one downstream action can be created from the same source summary.

---

## 4. MVP Data Contract

The MVP data model should stabilize these layers:

- `mission`
- `signals`
- `swotItems`
- `tensions`
- `recommendedMoves`
- `appliedConclusions`
- `finalSourceSummary`
- `outputCandidates`

Recommended session-level state:

```ts
type SessionPhase =
  | 'mission'
  | 'input'
  | 'swot'
  | 'insights'
  | 'outputs'
  | 'done';
```

Recommended event model:

```ts
type SessionEvent =
  | { type: 'MISSION_CONFIRMED' }
  | { type: 'SIGNALS_READY' }
  | { type: 'SWOT_READY' }
  | { type: 'INSIGHTS_ACCEPTED' }
  | { type: 'OUTPUTS_OPENED' }
  | { type: 'COMPLETE' };
```

---

## 5. MVP AI Contract

The MVP must not rely on one monolithic prompt.

It should operate as a pipeline:

1. `Mission AI`
2. `Signal Extractor`
3. `SWOT Builder`
4. `Insight Engine`
5. `Output Generator`

AI roles in MVP:

- `generator`
- `critic`
- `synthesizer`

Behavior rules:

- ask short purposeful questions
- explain why a question matters
- suggest, never silently overwrite
- materialize outputs into explicit state
- challenge vague or generic entries

---

## 5.1 Current Code Vs Target Runtime

The MVP implementation rule is:

- keep `Dynamic SWOT` inside the current `ToolDocumentView` runtime,
- do not move it to `ToolWizard`,
- refactor the visible IA and state model in place.

Current implementation target after MVP:

- primary nav = exactly 5 phases:
  - `mission`
  - `input`
  - `swot`
  - `insights`
  - `outputs`
- `signals` exists as a first-class layer before matrix classification,
- legacy 7-step sessions still hydrate through compatibility mapping,
- `Comments`, `Activity`, and `Used in` are secondary utilities, not main thinking phases,
- `finalSourceSummary` stays the single source artifact for downstream outputs.

Non-reference runtime for this MVP:

- generic `ToolWizard` remains out of scope,
- older 7-step visible SWOT flow is no longer the target product model.

---

## 6. Explicitly Out Of Scope For MVP

The MVP should not try to solve everything at once.

Out of scope:

- voice-first runtime
- advanced board interactions beyond essential editing
- complex collaboration workflows
- multi-session comparison
- broad template reuse across all tools in the same release
- fully generalized orchestration for every consulting framework

These can come after the MVP proves the model.

---

## 7. Success Criteria

The MVP is successful if:

- users understand the session flow without explanation,
- the five phases feel natural and not document-heavy,
- AI helps move the work forward instead of creating noise,
- the session ends in a credible final summary,
- reports, presentations, and initiatives can be generated from the same source,
- the structure is reusable for the next tools without redesigning the whole flow.

---

## 8. Rollout Rule

Rollout after MVP should follow this order:

1. validate `Dynamic SWOT`
2. fix the session model based on real usage
3. extract reusable session primitives
4. apply the standard to the next strategic tools

Non-negotiable rule:

> Do not scale the pattern to more tools until the `Dynamic SWOT` MVP proves that the five-phase model works in real product use.
