# Universal Tool Outputs Standard V1

> Status: proposed foundation  
> Scope: all consulting tools in `Tools`  
> Applies to: runtime UX, output creation, traceability, downstream navigation

---

## 1. Purpose

Every consulting tool must end in outputs, not in analysis only.

This standard defines the mandatory output layer for tools so that the user can always move from analysis to an artifact without losing context.

Canonical rule:

> each tool session can create `initiative`, `report`, `presentation`, and `idea`.
>
> `task` is not a direct tool output.

---

## 2. Output types

The platform-wide output types for tools are:

1. `initiative`
2. `report`
3. `presentation`
4. `idea`

These four outputs are the default product contract for all non-licensed consulting tools and should become the standard for licensed methodologies where applicable.

---

## 3. What each output means

### 3.1 Initiative

Use when the tool result is actionable enough to become a tracked implementation effort.

Typical shape:

- title,
- description,
- rationale,
- expected impact,
- owner,
- linked source evidence,
- next step.

### 3.2 Report

Use when the tool result should be turned into a structured document for review, governance, or sharing.

Typical shape:

- executive summary,
- structured sections,
- tool-specific evidence,
- findings,
- recommended actions.

### 3.3 Presentation

Use when the tool result should be communicated visually as a decision-support or presentation artifact.

Typical shape:

- context,
- analysis view,
- key findings,
- recommendation,
- next-step ask.

### 3.4 Idea

Use when the tool surfaces a promising direction that is not mature enough to become an initiative yet.

Typical shape:

- title,
- short opportunity/problem framing,
- why it emerged from the tool,
- suggested exploration next step,
- source link back to the tool.

---

## 4. Product semantics

The four outputs are not mutually exclusive.

From one tool session, the user may create:

- zero outputs,
- one output,
- many outputs.

Typical patterns:

- one initiative + one report,
- several initiatives + one presentation,
- one idea first, initiative later,
- report only,
- presentation only.

---

## 5. Source Artifact Rule

The mandatory source artifact for downstream creation is:

- `final source summary`

The tool session remains the parent artifact and must stay linkable, but output creation should use one stable source-grade summary so that:

- report and presentation start from the same narrative,
- initiative and idea creation can point to the exact conclusion or move,
- downstream users can understand where the artifact came from without replaying the whole session.

---

## 6. Runtime UX rules

### 6.1 Outputs step is mandatory

Every tool runtime must expose an `Outputs` step or equivalent final area.

The output layer must be visible only after the session reaches a source-grade state, typically after finalization or an approved snapshot.

### 6.2 Output buttons

The tool runtime must expose clear CTAs for:

- `Create Initiative`
- `Create Report`
- `Create Presentation`
- `Create Idea`

### 6.3 No dead-end summary

The tool must not stop at:

- summary,
- conclusions,
- matrix,
- scorecard,
- list of observations.

There must always be a path to output creation.

---

## 7. Mapping rules

Mandatory mapping rules:

- `summary -> report`
- `summary -> presentation`
- `conclusion or move -> initiative`
- `conclusion or hypothesis -> idea`

If a tool has tool-specific move objects, those moves should become the preferred initiative seeds.

---

## 8. Traceability rules

Every output created from a tool session must preserve:

- `source_type`
- `source_id`
- `source_version`

Recommended source semantics:

- `source_type` should point to the final source summary when the downstream flow supports it,
- the parent tool session should remain attached as the broader origin,
- output surfaces should expose backlinks and `Used in` references where supported.

Preferred extended traceability:

- source step,
- source cards / rows / evidence blocks,
- source correlations / tensions / recommendations.

All output surfaces should support:

- `Open source`
- source label display
- backward navigation to the originating tool session

---

## 9. Minimum creation contract by output type

### 7.1 Initiative

Must preserve:

- source tool session,
- source final summary,
- summary/rationale,
- project context if available.

### 7.2 Report

Must open generator with:

- final source summary preselected as primary source.

### 7.3 Presentation

Must open generator with:

- final source summary preselected as primary source.

### 7.4 Idea

Must preserve:

- source type `tool`,
- source final summary reference when available,
- source tool session reference or equivalent source metadata,
- short rationale for why the idea was created from this tool.

---

## 10. Cross-tool policy

This is not only for `Dynamic SWOT`.

The standard applies to all tools built or rebuilt under the new process.

For a new tool to be considered product-ready:

- outputs must be defined,
- output mapping must be documented,
- runtime must expose the output layer,
- at least one happy-path output flow must be implemented and testable.

---

## 11. Recommended output mapping examples

### 9.1 Dynamic SWOT

- initiative: strategic move turned into implementation effort
- report: strategic diagnosis summary
- presentation: strategy discussion deck
- idea: early opportunity or concept not yet ready for execution

### 9.2 Market Forces

- initiative: defensibility / margin-protection action
- report: market power analysis
- presentation: market structure and implications deck
- idea: emerging strategic option to explore

### 9.3 Process Automation

- initiative: automation implementation workstream
- report: baseline and business case
- presentation: executive automation pitch
- idea: automation candidate requiring further discovery

---

## 12. DoD for the standard

The output standard is considered adopted for a tool when:

- the tool exposes all four output CTAs,
- output mapping is documented,
- runtime creates or routes to the output flow correctly,
- final source summary exists as the canonical downstream source,
- created outputs preserve source traceability,
- user can open the source session back from created outputs where supported.
