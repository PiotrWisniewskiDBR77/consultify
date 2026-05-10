---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_WHITEBOARD
function_name: Ideas — Whiteboard / Tablica
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Whiteboard

## 1. Function Identity

- Function ID: `MW_IDEAS_WHITEBOARD`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- UI labels/aliases: `Tablica`, `Whiteboard`, `whiteboard`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (tool mode)
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: run collaborative exploration and facilitation in a free-form canvas.
- Business outcome: faster ideation/alignment and explicit capture of whiteboard outcomes.
- Non-goals: whiteboard mode does not bypass governance when moving to canonical outputs.

## 3. Trigger and Entry Points

- Entry points: workspace tool switcher -> `whiteboard`.
- Preconditions: open idea workspace context.
- Blocking conditions: none beyond ACL/tenant controls.

## 4. UI Component Footprint

- Top-level container/view components: `IdeaMapWorkspace`.
- Tool-specific runtime: `IdeaWhiteboardTool`.
- Supporting components: `IdeaWorkspaceToolbar`, whiteboard facilitation overlays/events, `IdeaWorkspaceTools` whiteboard context sections.
- Component ownership notes: whiteboard canvas is tool-local with shared workspace governance overlays.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: whiteboard graph state, facilitation timer/voting state, outcomes list.
- Upstream modules/services: workspace runtime extensions (`mapExtensions.whiteboard`) and event channels.
- APIs/models: shared idea/workspace runtime persistence.
- Data freshness assumptions: facilitation signals and graph state can be near-real-time and asynchronous.

## 6. Outputs and Side Effects

- Produced objects/artifacts: whiteboard outcomes and updated free-form canvas state.
- Downstream handoff: explicit conversion/export or navigation to owner workflows.
- Side effects visible to user: voting/facilitation overlays, outcome registration events, tool-level context changes.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: whiteboard context within idea workspace.
- Handoff contract (`from -> to`): explicit promoted outputs to downstream modules with provenance.
- Forbidden ownership: whiteboard cannot silently mutate foreign canonical records.

## 8. Runtime States and UX Behavior

- Loading: whiteboard tool initializes canvas/facilitation state.
- Empty: blank whiteboard with facilitation-first guidance.
- Error: error boundary with retry.
- Degraded: facilitation signals can degrade while core board remains usable.
- Success: outcomes captured and board state persists.
- Next action guidance per state: capture outcomes, vote/align, convert to executable artifacts.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/workspace panel conventions only.
- Source/provenance visibility: whiteboard outcomes are tied to idea context.
- Approval/diff/review requirements: high-impact downstream mutation requires owner-module review.
- Audit trail/evidence: whiteboard facilitation and outcome events are trackable.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with idea workspace access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: whiteboard state is tenant-scoped.
- Sensitive data masking/redaction: consistent with global data policy.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - whiteboard tool renders from workspace switcher.
  - facilitation state (timer/voting/outcomes) is represented in runtime context.
  - conversion/handoff remains explicit and source-aware.
- Code/runtime evidence:
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaWhiteboardTool.tsx`
  - `src/components/MyWork/IdeaWorkspaceTools.tsx`
- Known `doc_gap`: full facilitation protocol contract still requires deeper formal doc.
- Known `code_gap`: no dedicated e2e whiteboard facilitation-to-output test in module docs.

## 12. Open Risks and Change Log

- Risks/assumptions: collaborative whiteboard state can drift without strict facilitation rules.
- Open decisions: minimum evidence package required before promoting whiteboard outcomes.
- Change log: initial subfunction contract created.
