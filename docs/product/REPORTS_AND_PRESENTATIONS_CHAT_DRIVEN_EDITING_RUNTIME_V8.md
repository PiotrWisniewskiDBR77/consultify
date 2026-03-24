# Reports And Presentations Chat-Driven Editing Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for editing complete reports and presentations through conversation with governed AI operations

---

## 1. Why this document exists

Autonomous generation is not enough.

If `consultify` wants to support serious AI-native outputs, the user must be able to keep refining:

- a full report
- one report section
- a full deck
- one slide or one block

through conversation, without losing:

- traceability
- reviewability
- auditability
- quality control

This document closes that runtime.

---

## 2. Core statement

`chat-driven editing` should feel like one natural conversation, but it must execute as a governed proposal system.

Canonical rule:

`conversation may be the user interface, but every consequential mutation still follows intent classify -> scope classify -> risk classify -> proposal -> review -> accept/reject -> apply`

---

## 3. Supported editing scopes

The runtime must support:

- `report`
- `report_section`
- `report_block`
- `presentation_deck`
- `presentation_card`
- `presentation_block`
- `paired_output`

---

## 4. Supported edit intents

The chat runtime should support at least:

- explain
- rewrite
- shorten
- deepen
- reorder
- refresh
- restyle
- convert
- prepare_for_delivery
- quality_check
- fix_grounding
- create_variant

---

## 5. Runtime flow

Canonical flow:

`user message -> intent classification -> scope detection -> risk classification -> source/context gather -> correct model route -> proposal generation -> diff preview -> accept/reject/refine -> apply`

---

## 6. Risk classes

### 6.1 Low-risk

Examples:

- shorten one bullet
- rewrite one paragraph
- improve wording of one slide

### 6.2 Medium-risk

Examples:

- rewrite a whole section
- regenerate speaker notes
- reorder several slides

### 6.3 High-risk

Examples:

- rewrite executive summary
- alter KPI or finance claims
- restory whole board deck
- change recommendation logic

Rule:

`high-risk conversational edits must always return a reviewable proposal and may never mutate truth inline`

---

## 7. Canonical chat operation object

The runtime should revolve around:

- `ChatEditRequest`
- `ChatEditProposal`
- `ChatEditResolution`
- `AppliedMutationRecord`

Each proposal should preserve:

- target artifact
- target scope
- user intent
- source refs
- routing trace
- diff preview
- risk warnings

---

## 8. Diff preview requirements

Every consequential edit proposal must expose:

- what changes
- where it changes
- why AI proposes it
- what source grounding was used
- what uncertainty remains

For deck/report-wide operations it should also expose:

- sections or cards added
- sections or cards removed
- reordered areas
- high-risk changed claims

---

## 9. Report-specific conversational editing

Must support:

- section rewrite
- summary rewrite
- recommendation rewrite
- source-backed refresh
- compliance rewrite
- evidence-gap explanation

Additional rule:

`report chat editing must bias toward evidence continuity over stylistic cleverness`

---

## 10. Presentation-specific conversational editing

Must support:

- slide rewrite
- notes generation
- deck restructuring
- visual-plan proposal
- block refresh
- audience-fit restorying

Additional rule:

`deck chat editing must preserve narrative flow and presentation pacing, not only local text quality`

---

## 11. Paired-output editing

The system should support edits like:

- "turn this report into a shorter steering deck"
- "make the deck consistent with the latest report summary"
- "tighten both artifacts for board review"

Rule:

`paired-output editing must preserve lineage and show which artifact is being changed directly versus adapted from its sibling`

### 11.1 Coordinated publish support

> V8 Decision W6-12 applied — 2026-03-23

Paired outputs (report + presentation) support coordinated publish as a workflow mode. Both outputs also remain independently publishable.

- Coordinated publish ensures both outputs are published together when the workflow requires it.
- Independent publish remains available when only one output is needed or ready.
- Each output retains its own `reviewState` and `publishState`.

Canonical rule:

`independent by capability, coordinated by workflow`

---

## 12. AI and model routing

The chat surface must route by:

- intent
- scope
- risk
- source criticality

It must not:

- use one default chat model for all output edits
- bypass the output-specific routing policy

---

## 13. Human review doctrine

The runtime must support:

- accept
- reject
- ask for another variant
- partially apply where feasible

Rule:

`conversation may continue across iterations, but unresolved high-risk proposals remain proposals until explicitly accepted`

---

## 14. Audit and support visibility

Support must be able to inspect:

- original user request
- chosen edit scope
- risk class
- selected model profile
- proposal summary
- apply outcome

---

## 15. Forbidden behaviors

The runtime must not:

- silently edit canonical artifact content
- hide source weakening
- collapse report and deck into one object
- turn explanation-only chat into accidental apply

---

## 16. Acceptance criteria

This layer is complete when:

- both reports and presentations can be edited by conversation through one governed runtime
- low-risk edits feel fast
- high-risk edits are always reviewable
- paired-output editing preserves lineage
- support can inspect the full mutation path

---

## 17. Related canonical docs

- `REPORTS_V8_AI_OPERATIONS_AND_GOVERNANCE.md`
- `PREZENTACJE_V8_AI_OPERATIONS_SPEC.md`
- `REPORTS_AND_PRESENTATIONS_LLM_ROUTING_AND_MODEL_POLICY_V8.md`
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md`
