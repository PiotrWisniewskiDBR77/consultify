---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_PROCESS_FLOW
function_name: Ideas — Process Flow
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Process Flow

## 1. Function Identity

- Function ID: `MW_IDEAS_PROCESS_FLOW`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- UI labels/aliases: `Przeplyw`, `Process Flow`, `process_flow`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (tool mode)
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: model process logic, steps, lanes, and dependencies for execution-ready planning.
- Business outcome: better operational clarity and easier transition to implementation workflows.
- Non-goals: process-flow mode must not bypass approval or ownership boundaries.

## 3. Trigger and Entry Points

- Entry points: workspace tool switcher -> `process_flow`; quick action from other tools.
- Preconditions: idea workspace context present.
- Blocking conditions: none beyond ACL.

## 4. UI Component Footprint

- Top-level container/view components: `IdeaMapWorkspace`.
- Tool-specific runtime: `IdeaProcessFlowTool`.
- Supporting components: `IdeaWorkspaceToolbar`, `IdeaWorkspaceTools` process-flow panels (`ProcessFlowHealthScore`, `ProcessFlowPropertiesPanel`).
- Component ownership notes: flow canvas is tool-local; health/properties are controlled in shared tools panel.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: process nodes/edges, lane definitions, metrics metadata, selected node context.
- Upstream modules/services: graph runtime persistence + AI context.
- APIs/models: shared API plus workspace graph runtime structures.
- Data freshness assumptions: lanes/metrics/properties can update at different times.

## 6. Outputs and Side Effects

- Produced objects/artifacts: updated process-flow graph with lane/metric metadata.
- Downstream handoff: explicit conversion to execution/decision/task artifacts.
- Side effects visible to user: node detail drawer, flow edits, quick-action transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: idea process-flow graph in My Work domain.
- Handoff contract (`from -> to`): explicit conversion/export maintaining provenance.
- Forbidden ownership: no silent writes into foreign canonical objects.

## 8. Runtime States and UX Behavior

- Loading: flow tool loads graph runtime state.
- Empty: starter flow state with lane/process setup guidance.
- Error: error boundary + retry path.
- Degraded: partial metadata can degrade while canvas remains operable.
- Success: flow edits persist and are visible for conversion.
- Next action guidance per state: define lanes, map steps, add conditions, convert outputs.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/workspace panels only.
- Source/provenance visibility: process nodes preserve origin context and linked evidence.
- Approval/diff/review requirements: downstream mutation uses owner-module review flow.
- Audit trail/evidence: flow edits, quick actions, and conversion events.

## 10. Security, Roles, and Tenancy

- Allowed roles: tenant users with Ideas access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: process graphs are tenant-bound.
- Sensitive data masking/redaction: inherited from global/object policies.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - process-flow tool can be selected and rendered in idea workspace.
  - node/lane/property interactions are available through tool + tools panel.
  - conversion path remains explicit with source context.
- Code/runtime evidence:
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaProcessFlowTool.tsx`
  - `src/components/MyWork/IdeaWorkspaceTools.tsx`
- Known `doc_gap`: full BPMN-like semantics contract still requires deeper dedicated spec.
- Known `code_gap`: no dedicated e2e test proving full process-flow to execution handoff chain.

## 12. Open Risks and Change Log

- Risks/assumptions: semantic richness can drift if lane/edge conventions are not locked.
- Open decisions: minimum required process metadata before conversion.
- Change log: initial subfunction contract created.
