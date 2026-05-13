---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_PROCESS_FLOW
function_name: Ideas — Process Flow
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Process Flow

## 1. Function Identity

- Function ID: `MW_IDEAS_PROCESS_FLOW`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- Function family: `Idea`
- UI labels/aliases: `Przeplyw`, `Process Flow`, `Flow`, `process_flow`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (+ workspace/deep-link hints `tool=process_flow`)
- Feature state: `real`
- Contract scope: documentation-only hardening for the Idea Flow format inside `02_moja-praca`; this is not a separate module and does not modify runtime code.

## 2. User Job and Business Outcome

- User chooses Flow when the idea should be ordered as executable sequence: `stage -> decision -> action -> handoff`.
- Primary job: convert mixed context (chat, notes, mindmap nodes, table rows, workshop outputs) into operational process model with clear lanes, decision points, dependencies, blockers and readiness checks.
- Business outcome: user can move from idea exploration to execution-ready chain with visible quality gates, evidence coverage and owner-boundary-safe handoff to downstream modules.
- Non-goals:
  - not a separate BPM tool/module;
  - not a hidden executor of downstream lifecycle mutations;
  - not an approval bypass for AI-generated flow logic.

## 3. Trigger and Entry Points

- Entry points:
  - `MW_IDEAS` workspace tool switcher -> `process_flow`;
  - cross-tool transform from `mindmap` / `table` / `whiteboard`;
  - deep links with `tool=process_flow` in idea workspace.
- Preconditions:
  - user has access to `02_moja-praca` and selected `ideaId`;
  - minimum flow context exists (new draft or transformed structure);
  - AI-generated transitions stay in proposal state until explicit acceptance.
- Blocking conditions:
  - ACL/tenant denial;
  - missing idea context;
  - invalid transition graph (for example edge without target, cycle where forbidden, required decision branch missing);
  - conversion requested when critical steps have unresolved validation/evidence gaps.

## 4. UI Component Footprint

- Top-level route/shell components:
  - `src/views/MyWorkView.tsx`;
  - `src/components/MyWork/MyWorkHub.tsx`;
  - `src/components/MyWork/IdeaMapWorkspace.tsx`.
- Tool-specific runtime:
  - `src/components/MyWork/IdeaProcessFlowTool.tsx`.
- Supporting components:
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`;
  - `src/components/MyWork/IdeaWorkspaceTools.tsx` process-flow panels (including `ProcessFlowHealthScore`, `ProcessFlowPropertiesPanel`);
  - shared error boundary and workspace command-row mechanics.
- Component ownership notes:
  - flow canvas/runtime logic is local to the Flow tool;
  - command row and workspace shell are shared by `MW_IDEAS`;
  - contextual AI actions belong in Menu 3/right command-row slot and must not be duplicated as a second canvas toolbar.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - `ideaId`, flow metadata (`name`, `version`, `state_mode`: current/future/target);
  - nodes (`nodeId`, `type`, `label`, `owner`, `status`, `confidence`, `sourceRefs`, `validationFlags`);
  - edges (`edgeId`, `from`, `to`, `edgeType`, `conditionExpr`, `guardLevel`);
  - lanes (`laneId`, `name`, `ownerRole`, `moduleHint`);
  - step dependencies (`dependsOn`, `blocks`, `parallelGroup`, `handoffTarget`);
  - critical-step flags (`requiresEvidence`, `requiresApproval`, `requiresOwnerReview`).
- Canonical element semantics:
  - node types: `start`, `activity`, `decision`, `approval`, `risk`, `handoff`, `end`;
  - edge types: `sequence`, `conditional_true`, `conditional_false`, `fallback`, `exception`, `parallel_split`, `parallel_join`;
  - condition grammar: explicit boolean/enum criteria, never implicit hidden AI inference.
- Transition rules and validation guard rails:
  - `start` must have outgoing edge;
  - `end` must have incoming edge;
  - `decision` must have at least two mutually distinguishable outgoing conditional edges;
  - `approval` and `handoff` nodes must point to explicit owner target;
  - critical nodes cannot be marked `ready_for_convert` without required fields and evidence;
  - transitions crossing module ownership boundary must emit explicit handoff intent payload.
- Dependencies:
  - workspace graph runtime and cross-tool transform logic;
  - My Work API boundary in `src/services/api.ts`;
  - backend flow/idea boundaries in `server/src/routes/my-work.routes.ts`.
- Data freshness assumptions:
  - nodes/edges/properties/health score can refresh independently;
  - stale or partially computed flow health must be visible as degraded state.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - structured process-flow artifact (nodes/edges/lanes/conditions/guard rails);
  - step-level validation and readiness posture;
  - critical-path and dependency map for downstream execution planning.
- Side effects visible to user:
  - node/edge edits and lane assignment updates;
  - health score and validation warnings;
  - AI suggestions for missing transitions, risks or approvals;
  - explicit convert/handoff actions.
- Downstream handoff:
  - `flow -> 05_inicjatywy`: initiative candidates from bottlenecks/risk clusters;
  - `flow -> 06_realizacja`: executable task/action chains from approved steps;
  - `flow -> artifacts`: SOP/checklist/plan/report context for owner lanes.
- Conversion success must never imply owner-module mutation success until owner read-back confirms write.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - flow graph and flow-local metadata in `MW_IDEAS_PROCESS_FLOW`.
- Handoff contract (`from -> to`):
  - explicit handoff payload includes `ideaId`, selected flow scope, source/evidence refs, validation state and intent;
  - cross-tool handoff to `MW_IDEAS_TABLE|MW_IDEAS_MINDMAP|MW_IDEAS_WHITEBOARD` preserves provenance and decision state.
- Forbidden ownership:
  - no direct lifecycle mutation in `05_inicjatywy` / `06_realizacja`;
  - no hidden status flips from `draft/proposed` to `approved/converted`;
  - no implicit "auto-approved" AI flow generation.

## 8. Runtime States and UX Behavior

- Loading:
  - flow runtime and validations are loading;
  - user sees deterministic loading state distinct from save/apply-AI actions.
- Empty:
  - starter guidance: define start/end, lanes, first decision, and acceptance conditions;
  - recommended templates for process type.
- Error:
  - safe error message with retry and return path;
  - no raw internals or sensitive payloads in UI.
- Degraded:
  - partial unavailability (AI, source, validation, health computation, permissions);
  - manual editing remains possible when integrity permits; otherwise conversion controls remain blocked.
- Success:
  - flow structure is valid/partially valid with explicit status and next-action prompts.
- Recovery paths:
  - restore from last valid step set;
  - remove invalid edge/condition;
  - request missing evidence/owner;
  - switch to stable tool mode while preserving unsaved draft where supported.
- Next action guidance per state:
  - loading -> wait or navigate to Ideas list;
  - empty -> build first path and decision points;
  - error -> retry/reopen;
  - degraded -> resolve flagged blockers before convert;
  - success -> run approval and explicit handoff.

## 9. AI, Source, Evidence, Approval

- AI assistance:
  - propose steps, lanes, missing conditions, bottlenecks, risk points, automation opportunities;
  - classify nodes (`fact`, `assumption`, `recommendation`, `risk`) and suggest evidence gaps.
- AI action placement:
  - only in Menu 3/right command-row slot for active Flow context;
  - same AI controls must not be duplicated in flow canvas.
- Source/evidence visibility for critical steps:
  - any `decision`, `approval`, `handoff`, `risk` node must expose source/evidence status;
  - transitions marked high-impact require evidence link or explicit assumption marker.
- Approval points:
  - AI-generated structural changes are proposals until accepted;
  - critical transition activation requires explicit user approval;
  - cross-module conversion requires owner-module review/read-back.
- Audit evidence:
  - proposal accept/reject;
  - condition/guard edits;
  - conversion/handoff events;
  - validation failures and recovery actions where runtime supports logging.

## 10. Security, Roles, and Tenancy

- Allowed roles: tenant users with `My Work` and idea-access permissions.
- Denied/restricted roles: ACL denied users and users outside tenant/object scope.
- ACL/tenant scope:
  - flow graph, evidence refs and conversion intents are tenant-bound;
  - no cross-tenant propagation in AI suggestions, source refs, handoff payloads or exports.
- Sensitive data masking/redaction:
  - inherited from global/object-level policy;
  - security failure posture is deny-by-default with safe user messaging.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Flow opens as Idea format in `02_moja-praca`, not as separate module.
  - Node/edge/lane/condition modeling is available with explicit validation outcomes.
  - Guard rails block unsafe transitions and high-impact conversion without required evidence/approvals.
  - Critical steps show source/evidence posture before conversion.
  - AI proposals remain non-final until accepted.
  - Error/degraded states provide explicit recovery actions.
  - Handoff to owner modules is explicit and source-aware.

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Flow is an Idea format in `02_moja-praca` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | `src/services/api.ts` (`my-work/my-ideas/*`) | `tests/navigation/routeMapping.test.ts` | pass |
| Flow tool runtime and panels are available in workspace | `src/routes/AppRoutes.tsx` + My Work route scope | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map*`) | `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx` | pass |
| Transition/validation guard rails are visible and enforceable | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/activity`) | `tests/unit/mywork/crossToolTransform.test.ts` | partial (`guardrail_e2e_gap`) |
| Source/provenance and AI honesty are visible before critical conversion | `src/routes/routeConfig.ts` (`MY_WORK`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/ai-suggestions`, `/my-ideas/:id/convert`) | `tests/unit/mywork/aiProposalRuntime.test.ts` | partial (`flow_specific_coverage_gap`) |
| Cross-module handoff stays explicit and owner-safe | `src/routes/AppRoutes.tsx` + module transition path | `src/components/MyWork/IdeaMapWorkspace.tsx` (convert actions), `src/components/MyWork/IdeaProcessFlowTool.tsx` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/integration/routes/my-work.test.js` | partial (`owner_read_back_gap`) |
| Error/degraded recovery paths are user-visible | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/mindmap/CollaborationOverlay.tsx` | `server/src/routes/my-work.routes.ts` | `tests/components/MyWork/IdeaProcessFlowTool.error-state.test.tsx`, `tests/components/CollaborationOverlay.degraded-state.test.tsx` | pass |

- Known `doc_gap`: dedicated flow taxonomy catalog (node/edge/condition templates by process archetype) is not yet extracted as separate sub-spec.
- Known `code_gap`: no single end-to-end test proves full chain `flow proposal -> approval -> convert -> owner read-back`.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - flow semantics may drift without locked per-archetype templates;
  - partial runtime validation coverage can allow manual inconsistencies;
  - AI-generated conditions can overfit if evidence requirements are weak.
- Open decisions:
  - minimum required evidence set per critical node type before conversion;
  - canonical default guard levels for cross-module transitions;
  - final Menu 3 right-slot action set for Flow AI controls.
- Change log:
  - 2026-05-10: expanded to full Idea Flow contract with node/edge/condition taxonomy, transition guard rails, approval gates, recovery paths and mandatory route/component/API/test evidence matrix.
