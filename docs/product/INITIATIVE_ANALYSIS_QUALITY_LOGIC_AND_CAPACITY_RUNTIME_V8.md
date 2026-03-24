# Initiative Analysis Quality Logic And Capacity Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical Analysis tab runtime for initiative quality, feasibility, sequencing logic, timeline sanity, capacity balancing and AI-assisted remediation

---

## 1. Why this document exists

`Initiatives -> Analysis` should not be a decorative dashboard.

It should work as a PMO and executive cockpit that answers:

- are the initiatives complete enough to move forward
- are they realistically executable
- do they follow a logical sequence
- is the timeline coherent
- are people overloaded

And because `consultify` is AI-native, the module should do more than classic project tools:

- detect problems deterministically
- explain why they matter
- propose governed remediations

---

## 2. Inherited truth

This document inherits:

- `INITIATIVES_PORTFOLIO_ANALYSIS_V3.md`
- `PROJECT_MANAGEMENT_V8_BENCHMARK.md`
- `PROJECT_MANAGEMENT_V8_READINESS_AUDIT.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `GATE_DEFINITION_OF_DONE.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`

Rule:

`Analysis detects with rules and data first; AI supports interpretation and remediation second`

---

## 3. Current runtime truth

The current runtime already has a real `Analysis` tab with five subviews:

- `Resources`
- `Feasibility`
- `Logic`
- `Timeline`
- `Completeness`

Current strengths:

- real subviews exist in runtime
- issues are already derived from live initiative data
- completeness uses template-driven logic
- timeline and dependency heuristics already exist
- users can open the affected initiative from issue lists

Current limitations:

- issue semantics are still too heuristic and ad hoc
- `Resources` uses owner-count proxies instead of real overlap and capacity logic
- `Feasibility` is driven by proxy scores instead of gate- and artifact-aware readiness
- `Logic` lacks cycle detection and richer consistency checks
- `Timeline` lacks baseline integrity and stronger sequence rules
- AI remediation exists elsewhere in the system, but is not yet a first-class part of Analysis

---

## 4. Core statement

`Initiative Analysis v8` should be a governed portfolio-quality and planning cockpit.

Canonical path:

`initiative portfolio -> deterministic issue detection -> severity and evidence -> open or fix path -> optional AI remediation proposal -> approved update -> refreshed portfolio health`

---

## 5. Canonical analysis layers

### 5.1 Completeness and initiative quality

This layer answers:

- is the initiative sufficiently filled out for its current lifecycle stage
- are required sections, fields and artefacts present
- is the initiative ready for the next gate

This layer should be derived from:

- template level
- current status
- next gate
- required artefacts and sections

### 5.2 Feasibility

This layer answers:

- does the initiative have enough planning substance to be considered executable
- is budget, sponsorship, ownership, timeline and work decomposition credible enough

Feasibility should not mean:

- generic AI optimism score

It should mean:

- checklist and artefact-backed viability
- plus controlled heuristics where exact artefacts are not yet available

### 5.3 Logic

This layer answers:

- do dependencies and statuses make sense together
- are there sequence contradictions
- are there cycles or impossible prerequisite chains

### 5.4 Timeline

This layer answers:

- are the dates internally coherent
- do milestone and dependency sequences form a credible baseline
- are there drift, lateness or impossible date ranges

### 5.5 Resources and capacity

This layer answers:

- are the named people overloaded
- is the plan unrealistic for the available team
- is there enough ownership and execution capacity to carry the portfolio

---

## 6. Canonical issue model

The Analysis tab should converge on one stable issue object:

- `issue_id`
- `issue_type`
- `severity`
- `rule_key`
- `initiative_refs[]`
- `title`
- `explanation`
- `evidence`
- `target_surface`
- `target_section_ref?`
- `fix_kind`
- `ai_remediation_allowed`

Severity should remain lifecycle-aware:

- `INFO`
- `WARN`
- `BLOCKER`

Rule:

`BLOCKER` should be reserved for issues that truly block gate progress or violate hard planning logic

---

## 7. Target behavior by subview

### 7.1 Completeness

The subview should show:

- completeness score
- missing critical items
- missing total items
- gate readiness
- section-level deep links to missing data

It should identify problems such as:

- missing owner
- missing KPI or economic artefacts
- missing milestones or tasks required by level
- missing closure evidence when entering later stages

### 7.2 Feasibility

The subview should move beyond simple proxy scores.

It should assess:

- sponsor and owner presence
- baseline planning presence
- task and milestone decomposition
- risk posture
- dependency realism
- budget and resource viability

Important:

`Feasibility` should be based on initiative substance, not on whether AI "likes" the initiative

### 7.3 Logic

The subview should detect:

- dependency timing conflict
- circular dependency
- status and date inconsistency
- missing dates preventing logic checks
- scheduled work that still lacks prerequisite readiness

### 7.4 Timeline

The subview should detect:

- missing required dates
- `planned_end < planned_start`
- baseline dates inconsistent with milestones
- scheduled work whose start has already passed without moving into execution
- critical-path and milestone drift warnings

### 7.5 Resources

The subview should evolve from owner counting into real balancing.

It should use:

- business owner and execution owner
- initiative team where available
- staffing or FTE allocations where available
- overlapping timeline windows
- status-aware workload filters

Fallback mode:

- if only owner data exists, the system may compute simplified overload heuristics
- but it must label this as a degraded approximation

---

## 8. AI remediation doctrine

AI in Analysis should act as a remediation and planning copilot.

It may:

- explain why an issue matters
- summarize the portfolio risk picture
- propose missing-data bundles
- propose resequencing of initiatives or milestones
- propose workload rebalancing options
- propose recovery plans for overloaded or late initiatives

AI may not:

- invent portfolio truth
- change initiative baseline silently
- auto-fix issues without a governed proposal path

All durable AI remediations should converge on:

- proposal review
- optional approval
- auditable apply

---

## 9. Current implementation-facing deltas

The current runtime should be hardened in these areas:

- `usePortfolioAnalysisData.ts` uses local heuristics and ad hoc issue types instead of a stable issue contract
- `Resources` currently computes utilization mainly as initiative count times 100 percent
- `Feasibility` currently uses budget, owner, date and risk proxies, but not enough gate or artefact logic
- `Logic` lacks cycle detection and deeper consistency rules
- `Timeline` lacks invalid-range and stronger baseline sanity checks
- completeness currently derives from synthetic portfolio payloads and may miss deeper section truth
- AI readiness or remediation endpoints exist elsewhere, but are not yet converged into the Analysis cockpit

---

## 10. Definition of done for V8 target

- Analysis remains a five-subview cockpit
- issue detection converges on one lifecycle-aware issue contract
- completeness and feasibility are clearly distinct
- timeline and logic use dependency-aware planning rules
- resources use overlap and capacity-aware balancing when data exists
- AI remediation is proposal-based and reviewable
- every issue can open the right initiative surface and, where possible, the right section

---

## 11. Related canonical docs

- `INITIATIVES_PORTFOLIO_ANALYSIS_V3.md`
- `INITIATIVE_TIMELINE_CAPACITY_AND_CRITICAL_PATH_V8.md`
- `INITIATIVE_AI_COPILOT_AND_EXECUTION_SUPPORT_V8.md`
- `PROJECT_MANAGEMENT_V8_READINESS_AUDIT.md`
- `GATE_DEFINITION_OF_DONE.md`
