---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_WHITEBOARD
function_name: Ideas — Whiteboard / Tablica
doc_kind: FUNCTION_CONTRACT
status: review
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Whiteboard

## 1. Function Identity

- Function ID: `MW_IDEAS_WHITEBOARD`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- Function family: `Idea`
- UI labels/aliases: `Tablica`, `Whiteboard`, `Workshop Canvas`, `whiteboard`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` with tool mode `whiteboard` (including workspace/deep-link hints `tool=whiteboard`)
- Feature state: `real`
- Contract scope: documentation-only hardening for Idea Whiteboard format; this is not a separate module and does not modify runtime code.

## 2. User Job and Business Outcome

- User job-to-be-done:
  - run facilitated exploration in free-form visual space when problem is still ambiguous, multi-voice, and needs synthesis;
  - capture workshop output (`themes`, `decisions`, `actions`, `outcomes`) before converting to execution lanes.
- Business outcome:
  - transition `chaos -> structured insight -> reviewed outcome -> explicit handoff`;
  - preserve provenance and workshop context so downstream modules do not lose decision rationale.
- Use boundary:
  - choose Whiteboard for collaborative facilitation, divergence/convergence sessions, and visual synthesis;
  - choose Table for row/field comparison and scoring;
  - choose Mind Map for relationship topology;
  - choose Process Flow for ordered step/lane execution modeling.
- Non-goals:
  - not a standalone whiteboard module;
  - not a hidden owner of initiative/task/document lifecycle;
  - not a silent AI apply path without explicit user acceptance and owner review.

## 3. Trigger and Entry Points

- Entry points:
  - `MW_IDEAS` workspace tool switcher -> `whiteboard`;
  - cross-tool transform (`mindmap|table|process_flow -> whiteboard`);
  - deep-link into idea workspace with `tool=whiteboard`.
- Preconditions:
  - existing `ideaId` and idea workspace access;
  - tenant-scoped session context resolved.
- Blocking conditions:
  - ACL/tenant denial;
  - missing workspace context;
  - degraded collaboration/facilitation channels (board remains usable in safe fallback posture where possible).

## 4. UI Component Footprint

- Top-level route/shell components:
  - `src/views/MyWorkView.tsx`;
  - `src/components/MyWork/MyWorkHub.tsx`;
  - `src/components/MyWork/IdeaMapWorkspace.tsx`.
- Tool-specific runtime:
  - `src/components/MyWork/IdeaWhiteboardTool.tsx`.
- Whiteboard composition:
  - `src/components/MyWork/whiteboard/WhiteboardToolbar.tsx`;
  - `src/components/MyWork/whiteboard/WhiteboardSelectionBar.tsx`;
  - `src/components/MyWork/whiteboard/WhiteboardSessionPanel.tsx`;
  - `src/components/MyWork/whiteboard/WhiteboardEmptyState.tsx`;
  - `src/components/MyWork/whiteboard/nodes/*`;
  - `src/components/MyWork/whiteboard/whiteboardContracts.ts`;
  - `src/components/MyWork/whiteboard/whiteboardInteractionGrammar.ts`.
- Shared workspace controls:
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`;
  - `src/components/MyWork/IdeaWorkspaceTools.tsx` (convert and right-panel context).
- Component ownership notes:
  - whiteboard canvas and facilitation state are tool-local within `MW_IDEAS_WHITEBOARD`;
  - workspace shell, routing and cross-tool governance remain shared under `MW_IDEAS`.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields:
  - idea workspace graph (`nodes`, `edges`, `extensions`);
  - whiteboard session state (`role`, `phase`, `timer`, `voting`, `follow`, `spotlight`);
  - outcomes list and activity/history feed;
  - selection payload for cross-tool transform and conversion.
- Whiteboard object model:
  - element semantic types: `note`, `cluster`, `theme`, `outcome`, `decision`, `action`, `area`, `table`, `icon`, `image`, `link`, `metric`;
  - relations: connectors/edges preserve source-target identity and intent;
  - annotations: provenance markers, evidence links, tags, role/phase context, activity entries;
  - grouping: frame/area and cluster-level semantics are explicit.
- Upstream modules/services:
  - idea workspace runtime + map persistence (`my-ideas/:id/map`, sync, snapshots);
  - facilitation runtime (`realtime-v4/facilitation/*` endpoints via API client);
  - cross-tool transform (`src/components/MyWork/transforms/crossToolTransform.ts`).
- Data freshness assumptions:
  - collaboration and facilitation data is near-real-time and may degrade independently from core board data;
  - UI must expose stale/degraded posture instead of implying fully fresh collaboration state.

## 6. Outputs and Side Effects

- Produced objects/artifacts:
  - updated whiteboard canvas and facilitation metadata;
  - explicit outcome records (`theme|outcome|decision|action`) linked to source nodes;
  - workshop activity/history entries and snapshot points.
- Side effects visible to user:
  - timer/voting/follow/phase changes;
  - outcome registration and highlight of converted nodes;
  - explicit conversion/export actions.
- Downstream handoff:
  - `whiteboard -> mindmap/table/process_flow` via cross-tool transform;
  - `whiteboard -> initiative/task/decision/artifact lanes` via explicit conversion actions and owner-module review.
- Exit to executable artifacts:
  - allowed targets: initiative candidate, task/action candidate, decision artifact, report/presentation/action-plan/raid-log artifact request;
  - payload must carry source nodes, provenance state, and handoff intent.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - whiteboard canvas/session/outcome context inside `02_moja-praca` idea workspace.
- Handoff contract (`from -> to`):
  - `MW_IDEAS_WHITEBOARD -> MW_IDEAS_{MINDMAP|TABLE|PROCESS_FLOW}` with source trace and semantics retained;
  - `MW_IDEAS_WHITEBOARD -> 05_inicjatywy|06_realizacja|artifact lanes` only as explicit candidate payload.
- Collaboration/versioning/approval rules:
  - facilitation phases follow `start -> organize -> converge -> handoff` transitions;
  - role model: `facilitator|participant|observer`;
  - snapshots/history used for explicit restore and auditable diff context;
  - AI and conversion actions require explicit user approval before owner-module mutation path.
- Forbidden ownership:
  - no direct hidden writes to canonical records owned by other modules;
  - no silent conversion that skips owner read-back.

## 8. Runtime States and UX Behavior

- Loading:
  - board and facilitation context initialize separately;
  - next action: wait, then start session flow or switch to fallback tool.
- Empty:
  - guided starter board with facilitation prompt (`capture -> organize -> converge`);
  - next action: add first notes/evidence anchors and pick session mode.
- Error:
  - retryable fallback without exposing raw internals;
  - next action: retry, reopen workspace, or continue in non-whiteboard format.
- Degraded:
  - collaboration/facilitation may be partially unavailable (e.g., voting/timer sync);
  - next action: continue local board work, defer high-impact conversion until trust posture is restored.
- Success:
  - board updates persist, outcomes visible, and conversion CTAs available;
  - next action: review provenance and run explicit handoff.
- Anti-patterns:
  - whiteboard as PMO/task board replacement;
  - hidden AI rewrite/apply;
  - claiming downstream mutation success without owner read-back;
  - missing provenance on high-impact outcomes.

## 9. AI, Source, Evidence, Approval

- AI actions placement:
  - contextual AI actions for Whiteboard must live in Menu 3 / command-row right-side slot;
  - no duplicated AI toolbar in canvas for the same action set.
- Whiteboard AI actions (contract target):
  - brainstorm/generate notes, clustering, synthesis, gap prompts, summary, conversion suggestions;
  - all AI outputs start as proposal/draft and require explicit apply.
- Provenance and evidence visibility:
  - critical nodes/outcomes must expose provenance (`user-authored`, `ai-suggested`, `imported/source-backed`, `derived`, `owner-approved`);
  - evidence pointers required before high-impact handoff.
- Approval and diff/review:
  - session governance, AI apply, merge/organize, and conversion actions require explicit user intent;
  - owner modules perform final review for canonical mutations.
- Audit trail:
  - activity entries, snapshots/history, facilitation changes, and conversion triggers are traceable via runtime activity/snapshot endpoints where supported.

## 10. Security, Roles, and Tenancy

- Allowed roles:
  - users with `My Work` idea access in tenant scope.
- Denied/restricted roles:
  - ACL denied users and users outside tenant boundary.
- Tenant/ACL scope:
  - board data, facilitation session, comments, activity and outcome payloads remain tenant-scoped;
  - deny-by-default on uncertain auth/ownership context.
- Sensitive data handling:
  - no raw internals/secrets in UI;
  - restricted source content cannot be exposed via AI summary or export.
- Security failure behavior:
  - explicit denied/degraded state, no hidden fallback to broader scope.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Whiteboard opens as `Idea` format inside `02_moja-praca`, not as standalone module.
  - Object model supports whiteboard elements, relations, annotations, and groupings with explicit semantics.
  - Facilitation flow (phase/role/timer/voting) is represented explicitly and remains governable.
  - Provenance and evidence are visible before high-impact conversion.
  - AI proposals are explicit proposals; no silent apply.
  - Handoff to downstream lanes is explicit and source-aware.

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Whiteboard is a tool mode inside `MW_IDEAS` workspace | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceToolbar.tsx` | `src/services/api.ts` (`getMyIdeaMap`, `saveMyIdeaMap`, `syncMyIdeaMap`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-mywork-deep-acceptance.spec.ts` | pass |
| Whiteboard object model and grammar are explicit | n/a (in-workspace mode) | `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/whiteboard/whiteboardContracts.ts`, `src/components/MyWork/whiteboard/whiteboardInteractionGrammar.ts`, `src/components/MyWork/whiteboard/nodes/*` | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map`, `/my-ideas/:id/map/sync`) | `tests/unit/mywork/whiteboardNodes.test.ts`, `tests/unit/mywork/whiteboardInteractionGrammar.test.ts` | pass |
| Collaboration/facilitation state is modeled with phase/role/timer/voting/outcomes | `src/routes/AppRoutes.tsx` (`/my-work/*`) | `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/whiteboard/WhiteboardSessionPanel.tsx` | `src/services/api.ts` (`facilitation*` endpoints), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/activity`) | `tests/unit/mywork/whiteboardIntegration.test.ts`, `server/src/routes/v8/__tests__/p13-whiteboard-canon.test.ts` | pass |
| Versioning/audit and activity visibility are maintained | `src/routes/AppRoutes.tsx` | `src/components/MyWork/IdeaWhiteboardTool.tsx` (history/activity/snapshot interactions) | `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/map/snapshots`, `/my-ideas/:id/activity`) | `tests/unit/mywork/whiteboardIntegration.test.ts` | partial (`snapshot_depth_gap`) |
| Cross-tool transform and downstream handoff stay explicit and source-aware | `src/routes/AppRoutes.tsx` + module transition flow | `src/components/MyWork/transforms/crossToolTransform.ts`, `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx` | `src/services/api.ts` (`convertMyIdea`, `convertMyIdeaSelection`), `server/src/routes/my-work.routes.ts` (`/my-ideas/:id/convert`, `/my-ideas/:id/outcomes/:outcomeId/convert`) | `tests/unit/mywork/crossToolTransform.test.ts`, `tests/integration/routes/my-work.test.js` | partial (`owner_read_back_gap`) |
| Menu 3-only AI placement remains a governance target for Whiteboard actions | `src/routes/AppRoutes.tsx` | `src/components/MyWork/IdeaWorkspaceToolbar.tsx`, `src/components/MyWork/IdeaWhiteboardTool.tsx` | n/a | `tests/unit/mywork/aiProposalRuntime.test.ts` (proposal honesty baseline) | partial (`ui_alignment_audit_needed`) |

- Known `doc_gap`:
  - missing separate mini-catalog defining mandatory fields for each whiteboard semantic type at conversion time.
- Known `code_gap`:
  - no single end-to-end suite proving full chain `whiteboard workshop -> approval -> convert -> owner-module read-back`.
  - full Menu 3-only AI placement audit for Whiteboard runtime still pending.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - high collaboration intensity can produce semantic drift without strict facilitation protocol;
  - AI clustering/summarization can blur fact vs assumption if provenance labels are weak;
  - conversion confidence may be overstated without owner read-back evidence.
- Open decisions:
  - final canonical minimum evidence package required per converted whiteboard outcome;
  - exact Menu 3 right-slot action set for Whiteboard AI controls;
  - default governance threshold for exporting restricted boards.
- Change log:
  - 2026-05-10: rebuilt `MW_IDEAS_WHITEBOARD` contract to full 12-section executable standard (JTBD boundary, object model, facilitation/versioning rules, provenance, Menu 3 governance, handoff and evidence matrix).
