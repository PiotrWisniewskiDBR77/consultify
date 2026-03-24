# V8 Program — Wave 3 Decision Log

> Status: Closed
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 3 escalation items from packets WP-W3-LIFECYCLE-01, WP-W3-LIFECYCLE-02, WP-W3-LIFECYCLE-03

---

## Source truth preservation

### Decision W3-1 — Source materialization UX

- Invisible by default at UX level.
- Explicit in lineage, audit, and source-trace views.
- Explicit confirmation required only when: source merge is ambiguous, promotion crosses scope or ownership boundaries, evidence is weak or mixed, or the action creates durable initiative truth from loosely structured input.
- Rule: `frictionless by default, explicit when truth risk increases`.

### Decision W3-2 — Interview promotion permission model

- Both permission model and evidence class/confidence model required.
- Permission alone is not enough; evidence alone is not enough.
- Promotion requires: allowed actor, sufficient evidence class/confidence for the target use, review/confirmation when finding is weak, contradictory, or high-impact.

### Decision W3-3 — `synced_source_refs`

- Add `synced_source_refs` to initiative source governance model.
- Do not keep them only at Idea workspace level.
- Initiative-level governance needs the synced lineage when work enters PM/execution lifecycle.
- Idea can still hold local/source-prep refs.

---

## Planning and approval continuity

### Decision W3-4 — WBS depth model

- Canonical V8 depth: Initiative → Workstream/Phase → Task → Subtask.
- This is the default maximum structured hierarchy.
- Anything deeper becomes: checklist, dependency-linked sibling task, or separate initiative/workstream decomposition.
- Rule: `keep hierarchy shallow enough to remain governable`.

### Decision W3-5 — Material change threshold

- Post-approval task changes above a materiality threshold must trigger initiative change management.
- Material = any change that significantly affects: scope, committed timeline or baseline, critical-path logic, capacity or staffing, cost/economics, external dependency or vendor commitment, quality/acceptance promise, expected benefit or KPI linkage.
- Exact numeric thresholds refined later; product rule is clear: business-meaningful change must not bypass change management.

### Decision W3-6 — Cross-initiative dependency model

- Formally extend dependency modeling for cross-initiative links.
- Initiative dependencies support explicit source/target initiative references.
- Optional lower-level task/milestone references can exist later; initiative-level cross-link is in scope now.

### Decision W3-7 — Decision chain model

- Minimal formal decision-chain model in scope for V8.
- Supported chain types: `sequential`, `parallel`, `delegated`.
- Keep lightweight; do not expand into full workflow-engine complexity unless later needed.
- Rule: `formal enough for governance, not yet BPMN-grade`.

---

## Execution visibility and handoff integrity

### Decision W3-8 — Signal aggregation

- Execution signals aggregate hierarchically: task/decision/work item → initiative → project/program → PMO/operator layer.
- Aggregation preserves lineage and severity.
- Blockers and critical risks roll up explicitly, not averaged away.
- Rule: `summary up, traceability down`.

### Decision W3-9 — Results handoff event contract

- Define a minimal canonical event family now for Wave 3.
- Baseline events: `initiative_baseline_confirmed`, `execution_progress_updated`, `milestone_completed`, `delivery_risk_changed`, `rebaseline_approved`, `handover_completed`, `realization_tracking_started`.
- Results does not need full Wave 6 depth yet but needs these canonical handoff events now.

### Decision W3-10 — Rebaseline approval path

- Rebaseline uses the shared proposal/approval spine (WP-W1-AI-03).
- No separate local rebaseline approval path.
- Rule: `rebaseline is a governed proposal, not a side workflow`.

### Decision W3-11 — Forecast confidence capping

- Forecast confidence auto-capped when critical-path capacity data is unreliable, stale, or missing.
- System must not present high-confidence schedule claims on weak capacity truth.
- Rule: `confidence cannot exceed data reliability on the critical path`.

---

## Wave 3 closure

Wave 3 is formally closed as of 2026-03-23 with 3 completed packets and 11 binding decisions.

---

## Related packets

- `WP-W3-LIFECYCLE-01_SOURCE_TRUTH_PRESERVATION.md`
- `WP-W3-LIFECYCLE-02_PLANNING_APPROVAL_CONTINUITY.md`
- `WP-W3-LIFECYCLE-03_EXECUTION_VISIBILITY_HANDOFF.md`
