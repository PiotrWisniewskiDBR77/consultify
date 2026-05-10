---
module_id: MODULE_CHAT
function_id: CZ_CANVAS_WORKSPACE
function_name: Chat Canvas / Workspace Function
doc_kind: FUNCTION_CONTRACT
status: partial
owner: user
last_updated: 2026-05-10
---

# Function Contract — Chat Canvas / Workspace

## 1. Function Identity

- Function ID: `CZ_CANVAS_WORKSPACE`
- Module: `01_czat`
- UI labels/aliases: `Canvas`, `Workspace`, `KIMI split workspace` (doc naming)
- Route/AppView scope:
  - internal QA runtime: `AppView.AI_CHAT_V10_RUNTIME`, `"/internal/v10-runtime"`
  - chat-linked workspace/canvas behaviors in `"/chat"` and `"/chat/:conversationId"`
- Feature state: `partial`

## 2. User Job and Business Outcome

- User job: move from conversation to structured work surface (artifact/workspace/canvas context).
- Business outcome: convert chat intent into governed execution artifacts.
- Non-goals: canvas function is not an unrestricted mutation lane.

## 3. Trigger and Entry Points

- Entry points:
  - internal QA surface: `"/internal/v10-runtime"` (`V10RuntimeWorkspaceView`),
  - chat actions that open workspace-linked surfaces (for example table/idea deep links),
  - split-workspace shell components used by KIMI lanes (implementation surfaces).
- Preconditions: valid conversation/workspace context.
- Blocking conditions: many KIMI lane routes (`/wordy`, `/excele`, `/prezentacje`) are currently coming-soon in app routing.

## 4. UI Component Footprint

- Runtime shell components: `V10RuntimeWorkspaceView`, `ChatV10RuntimesPanel`.
- Chat-to-workspace bridge components: `MessageRenderer` (artifact/workspace navigation), `V8ArtifactRunControl`.
- Split canvas shell components (implementation layer): `KimiWorkspaceShell` + `UnifiedChatPanel` in split mode.
- Component ownership notes: production routes for KIMI lanes are currently blocked by coming-soon gate, so canvas runtime is partially exposed.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: conversation id, workspace context, artifact plan/run metadata, rollout flags.
- Upstream modules/services: `useConversationStore`, `useArtifactsStore`, V8 artifact APIs, rollout flag utilities.
- APIs/models: chat + artifact runtime APIs from `src/services/api.ts`.
- Data freshness assumptions: rollout and artifact pipeline status can be eventual and asynchronous.

## 6. Outputs and Side Effects

- Produced objects/artifacts: workspace navigation intents, artifact plan/review/materialization events.
- Downstream handoff: to module owner surfaces (`wordy`/`excele`/`prezentacje` lanes and related artifact routes).
- Side effects visible to user: plan/review status, runtime badges, route transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: artifact/workspace owner pipelines, not ad-hoc chat writes.
- Handoff contract (`from -> to`): `chat intent -> governed plan -> review/approval -> materialization`.
- Forbidden ownership: no hidden direct writes from canvas bridge into canonical outputs.

## 8. Runtime States and UX Behavior

- Loading: runtime workspace and rollout summaries show loading/pending state.
- Empty: no active artifact/workspace context must show actionable guidance.
- Error: runtime errors surface as guarded UI states.
- Degraded: flagged-off/partial rollout must be explicit.
- Success: governed run/route handoff gives clear next action.
- Next action guidance per state: capture snapshot, plan output, submit review, open owner surface.

## 9. AI, Source, Evidence, Approval

- AI action placement: workspace controls and command rows, aligned with Menu 3 policy.
- Source/provenance visibility: artifact plan/run and trust context must remain visible.
- Approval/diff/review requirements: governed output flow is mandatory before high-impact materialization.
- Audit trail/evidence: rollout panel, run status, and review lifecycle provide evidence.

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated users with access to the relevant runtime surfaces.
- Denied/restricted roles: ACL denied users; internal QA route is operationally restricted by context.
- ACL/tenant scope: workspace/artifact context remains tenant-scoped.
- Sensitive data masking/redaction: follows runtime trust/governance policy.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `"/internal/v10-runtime"` renders the internal runtime workspace summary.
  - chat surface exposes governed artifact/canvas bridge controls.
  - blocked KIMI lane routes are documented as coming-soon rather than claimed shipped.
- Code/runtime evidence:
  - `src/views/V10RuntimeWorkspaceView.tsx`
  - `src/components/AIChat/MessageRenderer.tsx`
  - `src/components/AIChat/V8ArtifactRunControl.tsx`
  - `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`
  - `src/routes/AppRoutes.tsx`
- Known `doc_gap`: end-user canvas UX contract is not fully stabilized while lane routes are blocked.
- Known `code_gap`: lane runtime is partially available in components but not fully exposed in production routes.

## 12. Open Risks and Change Log

- Risks/assumptions: mismatch between available components and exposed routes can confuse ownership/expectations.
- Open decisions: when canvas function transitions from `partial` to `real` in module contract.
- Change log: initial separated canvas-function contract created.
