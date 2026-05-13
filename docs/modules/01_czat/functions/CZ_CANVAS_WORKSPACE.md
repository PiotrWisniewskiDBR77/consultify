---
module_id: MODULE_CHAT
function_id: CZ_CANVAS_WORKSPACE
function_name: Chat Canvas / Workspace Function
doc_kind: FUNCTION_CONTRACT
status: startup_incomplete
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Chat Canvas / Workspace

## 1. Function Identity

- Function ID: `CZ_CANVAS_WORKSPACE`
- Module: `01_czat`
- UI labels/aliases: `Canvas`, `Workspace`, `KIMI split workspace`, `Expanded Canvas`, `artifact workspace`
- Route/AppView scope:
  - internal QA runtime: `AppView.AI_CHAT_V10_RUNTIME`, `"/internal/v10-runtime"`
  - chat-linked workspace/canvas behaviors in `"/chat"` and `"/chat/:conversationId"`
  - target/deferred lane model: `"/ai/work-canvas?kind=document|sheet|deck"` from `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md`
- Feature state: `partial`
- Operational launch status: `STARTUP_INCOMPLETE / NO_GO`
- Capability label: `partial` for code evidence, but `not_operational` for user-facing launch. Route/component/API/test evidence exists for isolated runtime bridge and governed artifact controls, but the Canvas workflow does not currently work as an end-to-end user capability.
- Current truth: Canvas must be treated as an unfinished startup surface until a user can open a conversation-derived artifact candidate, review it, approve or reject it, and reach an owner-lane read-back without a broken/gated flow.

Evidence:

- route: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component: `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`
- API: `src/services/api.ts`, `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts`
- test: `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`, `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`, `src/utils/__tests__/chatV10Rollout.test.ts`

Startup blocker statement:

- Existing evidence is sufficient to document the intended bridge, not sufficient to declare Canvas usable.
- Any implementation plan must start from the P0 launch baseline in section 11 before expanding diff/versioning, source health, connector, memory or advanced lane parity.

RAW-derived Canvas backlog:

This backlog preserves the full useful Canvas scope from RAW while protecting startup. P0 is the minimum needed to make Canvas work. P1 is the first useful expansion after startup. P2 preserves valuable ideas that must not block launch.

| Priority | Element | RAW source intent | Why it matters | Startup decision |
| --- | --- | --- | --- | --- |
| P0 | User-facing Canvas entry | Chat should move from conversation to artifact/workbench. | Without a stable entry, Canvas cannot start. | Required for launch. |
| P0 | Honest empty state | Chat Home/Canvas must guide next action, not show blank UI. | Prevents dead-end startup. | Required for launch. |
| P0 | Artifact preview panel | Active conversation view includes artifact preview; MVP3 includes artifact preview. | User must see the draft before deciding. | Required for launch. |
| P0 | Artifact identity | RAW data model links conversations to generated artifacts. | Draft needs ID/type/status/source to be reviewable. | Required for launch. |
| P0 | Create document draft from answer | RAW P0: create document from answer. | Core first lane for consulting output. | Required for launch. |
| P0 | Create table draft from answer | RAW P0: create table from answer. | Needed for structured analyses/backlogs/matrices. | Required for launch. |
| P0 | Create presentation/deck outline from answer | RAW P0: create presentation from answer. | Needed for client-facing narrative output. | Required for launch as outline if full deck lane is gated. |
| P0 | Source/provenance cards in Canvas | RAW requires source cards, citations, source traceability. | Artifact trust must be visible at artifact level. | Required for launch. |
| P0 | Explicit no-source warning | RAW: hallucination control and missing data warning. | Prevents source-free claims becoming artifacts. | Required for launch. |
| P0 | Review-required state | RAW: AI proposes; data-changing actions need approval. | Separates suggestion from executed work. | Required for launch. |
| P0 | Accept/reject candidate | RAW action review requires accept/edit/reject. | User must control whether draft becomes durable. | Required for launch. |
| P0 | Edit before accept | RAW action review includes edit; artifact workflow includes edit before approve. | Real consulting drafts need user correction before materialization. | Required for useful launch. |
| P0 | Reject leaves no durable mutation | RAW forbids silent writes. | Safety/tenancy invariant. | Required for launch. |
| P0 | Owner-lane read-back | RAW workflow ends in saved/linked artifact, not hidden execution. | Canvas must confirm what was created and where. | Required for launch. |
| P0 | Save/link to project | RAW: project is context container; save answer/artifact to project. | Prevents user losing output. | Required for launch when project context exists; otherwise show unlinked state. |
| P0 | Error/degraded reason taxonomy | RAW recovery and source/permission warnings. | User must know whether blocker is route, rollout, source, ACL, API or read-back. | Required for launch. |
| P0 | Menu 3 Canvas actions | RAW addendum: contextual actions in Menu 3/dynamic command row. | Avoids duplicate/broken toolbars. | Required for launch. |
| P0 | Audit/read-back strip | RAW P0: audit tool call visible. | User/admin can trace materialization. | Required for launch. |
| P0 | Client/internal gate | RAW: client-ready split is critical. | Prevents internal notes leaking into artifacts/exports. | Required before export/materialization. |
| P0 | File preview + parsing status for source-derived drafts | RAW P0: file preview, parsing status, security classification. | Canvas must not build artifacts from unknown parser state. | Required when artifact uses uploaded files. |
| P1 | Full diff/apply/reject/rollback | RAW market parity: artifact versioning, diff, apply/reject, rollback. | Makes AI edits safe and inspectable. | First after-start expansion. |
| P1 | Version snapshots | RAW requires versioning and rollback. | Enables recovery and comparison. | After startup. |
| P1 | Agent run plan | RAW P0 market-parity: plan before larger actions. | Useful for multi-step artifact creation. | P1 for Canvas; P0 only for complex/high-impact runs. |
| P1 | Source health/freshness badges | RAW: source health, freshness, parser quality, access status. | Improves trust before materialization. | After startup. |
| P1 | Source understanding preview | RAW P1: show what parser understood and limitations. | Reduces bad artifacts from partial extraction. | After startup. |
| P1 | Action Review panel | RAW Action Review View: artifacts, tasks, decisions, follow-ups, approvals. | Gives one place to accept/edit/reject extracted work. | After Canvas startup. |
| P1 | Edit artifact from chat | RAW MVP3: edit artifact from chat. | Keeps Teresa useful beside the artifact. | After startup. |
| P1 | Create report from chat | RAW P1: chat to report with sources preserved. | Natural consulting deliverable after basic doc/table/deck. | After startup. |
| P1 | Create initiative draft from answer | RAW P1: initiative draft user approves. | Turns larger findings into portfolio work. | After owner-lane handoff is stable. |
| P1 | Risk/blocker/assumption/question cards | RAW P1 extraction. | Useful consulting review layer. | After startup. |
| P1 | Conversation history filtered by artifact/output | RAW history filters by artifact/output. | Makes generated work findable. | After artifact identity/linking. |
| P1 | Project instructions/workspace rules | RAW addendum: project rules for tone, format, sources, boundaries. | Improves artifact consistency. | After startup or parallel if project context exists. |
| P1 | Consulting playbook selector | RAW playbooks/skills for discovery, roadmap, business case, PMO, risk, savings. | Makes Canvas domain-specific. | After base lanes work. |
| P1 | Client-ready redaction pipeline | RAW P0 market-parity, client/internal mode. | High value for export-ready artifacts. | P1 unless exports are in P0 scope; then gate export. |
| P1 | Knowledge lifecycle badge | RAW: owner, source lineage, review status, expiry, superseded/conflict. | Needed when Canvas uses/promotes durable knowledge. | After startup. |
| P1 | Meeting/workshop recap to artifact/action cards | RAW meeting recap pipeline. | Converts workshops into structured outputs. | After artifact/action review basics. |
| P1 | Connected workspace side panel | RAW: chat beside document/table/presentation/task/project. | Improves context-aware editing. | After startup. |
| P2 | Shared project chat/team collaboration | RAW addendum P0, but not needed to make single-user Canvas start work. | Valuable for teams, ownership and comments. | Preserve as P2 for Canvas startup scope. |
| P2 | Enterprise connector catalog | RAW: Drive, M365, Slack, email, CRM, DMS. | Expands source ecosystem. | Preserve as P2; do not block Canvas start. |
| P2 | Knowledge review queue for sources | RAW P2/source governance. | Needed for sensitive/org knowledge promotion. | P2. |
| P2 | Cross-conversation intelligence | RAW P1: project recap across conversations. | Useful reporting/recap layer. | P2 for Canvas. |
| P2 | Research space/source-first workspace | RAW: research session with plan, findings, gaps, next actions. | Powerful but separate workflow. | P2 for Canvas. |
| P2 | Semantic history and memory search | RAW P1: search across conversations, artifacts, tasks, sources. | Improves retrieval. | P2 for Canvas start. |
| P2 | Voice/multimodal to Canvas | RAW voice creates outputs; image/audio analysis. | Valuable future input channel. | P2 unless separate voice scope is active. |
| P2 | Mobile/async continuation | RAW P2. | Useful for approvals on the go. | P2. |
| P2 | Dashboards for usage/governance/quality | RAW dashboards. | Needed for enterprise ops. | P2 for Canvas. |
| P2 | Connector/source pack ZIP ingestion | RAW P2 ZIP/source pack. | Advanced ingestion. | P2. |
| P2 | Full whiteboard/mindmap/process-flow from chat | RAW lists process flow, mindmap, whiteboard as artifacts. | Valuable, but not needed for first document/table/deck Canvas. | P2 for Canvas startup. |

## 2. User Job and Business Outcome

- User job: turn a Teresa conversation result into a structured work surface where the user can review, refine, approve and hand off an artifact candidate without losing conversation context.
- Business outcome: reduce the gap between advice and executable consulting work by preserving source lineage, review state and owner-lane handoff from `conversation -> draft -> artifact -> edit -> approve -> export -> link to project` (RAW target source).
- Current operational gap: this user job is not yet complete in the running product. The contract below is therefore a finish-start contract, not a shipped-capability description.
- Non-goals:
  - Canvas must not replace `CZ_CHAT_ENGINE` as the conversation runtime.
  - Canvas must not become a hidden mutation lane for tasks, decisions, initiatives, documents, sheets, decks or outputs.
  - Canvas must not claim full production parity for Wordy/Excele/Prezentacje while those routes remain gated or coming-soon.
  - Canvas must not create a second artifact registry or second document/sheet/deck lifecycle.

Evidence:

- target source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` sections `M. Artifact Creation from Chat`, `O. AI Governance & Approval Engine`
- governance source: `docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`, `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md`

## 3. Trigger and Entry Points

- Entry points:
  - internal QA surface: `"/internal/v10-runtime"` (`V10RuntimeWorkspaceView`),
  - chat message/proposal surfaces that expose artifact/workspace navigation or governed run controls,
  - split-workspace shell components used by KIMI lanes as implementation surfaces,
  - target/deferred route family `"/ai/work-canvas?kind=document|sheet|deck"`.
- Preconditions:
  - authenticated user/session context,
  - valid conversation or workspace context,
  - artifact/run metadata available when the user is reviewing a generated draft,
  - owner-lane permissions available before materialization/export.
- Blocking conditions:
  - Canvas launch is blocked if no user-visible entry opens a stable conversation-derived workspace,
  - `/wordy`, `/excele`, `/prezentacje` must stay honest if they render gated/coming-soon shells,
  - no materialization when artifact identity/version/provenance/read-back is missing,
  - no cross-module mutation when owner-module ACL cannot be confirmed.

Evidence:

- route: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component: `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/AIChat/MessageRenderer.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`
- decision source: `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md`

## 4. UI Component Footprint

- Approved shell/component family:
  - Shell layer: `NMode` / split workbench pattern (`chat-left`, `work-right`) where Canvas is active work, not a second chat transcript.
  - Shared components allowed: `DynamicTabs`, `PreviewPane`, `Drawer`, `Modal`, `Badge`, `Button`, `Toast`, `Skeleton`, `Spinner`, `Progress`, `EmptyState`.
  - Command contract: exactly one Menu 3 / local command row under module topbar; contextual AI actions live in the right-side slot only.
- Runtime shell components:
  - `V10RuntimeWorkspaceView` for internal QA runtime summary.
  - `ChatV10RuntimesPanel` for runtime capability/rollout inspection.
  - `KimiWorkspaceShell` for split canvas implementation shell.
- Chat-to-workspace bridge components:
  - `MessageRenderer` for artifact/workspace navigation affordances.
  - `V8ArtifactRunControl` for governed plan/review/materialization controls.
  - `UnifiedChatPanel` in split mode for context-aware Teresa support.
- Context/evidence components:
  - `ContextBadge` and context card in `UnifiedChatPanel`.
  - Source/citation surfaces inherited from chat where canvas shows generated claims or artifact lineage.
- Component ownership notes:
  - `01_czat` owns conversation context and proposal metadata.
  - Owner artifact lanes own durable document/sheet/deck lifecycle and final business object mutation.
  - Production routes for KIMI lanes are currently blocked by coming-soon gates, so component existence is not product availability.

Evidence:

- component: `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`
- UI standard: `docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`

## 5. Inputs, Data Contracts, and Dependencies

- Required input objects/fields:
  - `conversation_id` or route-linked conversation context,
  - `workspaceContext` when Canvas is opened from a module/object surface,
  - artifact run/plan metadata where a generated candidate exists,
  - rollout/capability state for V10/KIMI lane availability,
  - source refs/citation refs where the artifact candidate contains factual claims.
- Target/deferred input objects:
  - artifact version/diff payload,
  - apply/reject/rollback review state,
  - source lineage bundle,
  - client-ready redaction state,
  - knowledge/source promotion metadata,
  - owner-lane read-back payload after materialization.
- Upstream modules/services:
  - `useConversationStore`, `useArtifactsStore`, V8 artifact APIs, rollout flag utilities.
- APIs/models:
  - frontend: `src/services/api.ts`,
  - backend: `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts`, `server/src/routes/ai.routes.ts`.
- Data freshness assumptions:
  - artifact/run state may be asynchronous,
  - rollout state may change independently of route availability,
  - source freshness must be visible before business claims are treated as evidence-backed.

## 6. Outputs and Side Effects

- Produced objects/artifacts as-is:
  - workspace navigation intents,
  - artifact plan/review/materialization events,
  - rollout/runtime status evidence,
  - proposal-only quick action prompts from split-panel chat context.
- Current launch gap:
  - these outputs are not yet proven as one reliable user workflow,
  - generated artifact candidates must not be represented as durable or launch-ready until read-back and owner-lane handoff pass.
- Target/deferred outputs:
  - draft artifact candidate,
  - artifact diff candidate,
  - version snapshot,
  - rollback handle,
  - source lineage summary,
  - compact review card,
  - owner-lane read-back after approved materialization.
- Downstream handoff:
  - document/sheet/deck lanes for artifact editing,
  - `02_moja-praca` for accepted task/action pointers,
  - `05_inicjatywy` for accepted initiative candidates,
  - `06_realizacja` for approved execution actions,
  - `09_outputs` for distribution/export after owner-lane approval.
- Side effects visible to user:
  - route transition or gated-state notice,
  - plan/review status,
  - source/provenance state,
  - apply/reject/rollback availability once implemented,
  - audit/proposal status where runtime supports mutation.

Evidence:

- route/component: `src/routes/AppRoutes.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`
- system standard: `docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`
- traceability: `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects:
  - `01_czat` owns conversation state, proposal metadata, source/citation posture and chat-to-canvas handoff context.
  - Owner modules/lane runtimes own durable business objects and artifact lifecycle after approval.
  - Conversation-derived outputs use shared ownership: `01_czat` + owner module, with distribution through `09_outputs` when exported.
- Handoff contract (`from -> to`):
  - `conversation intent -> canvas draft/proposal -> review/diff -> user approval -> owner-lane materialization -> read-back/audit`.
- Forbidden ownership:
  - Canvas must never silently write canonical tasks, decisions, initiatives, execution records, documents, sheets, decks or output packages.
  - Canvas must never bypass owner-module ACL by using chat context as an authority source.
  - Canvas must never promote source/knowledge to project/team/organization memory without explicit scope and approval.

Evidence:

- ownership standard: `docs/modules/UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md`
- traceability: `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`
- security rule: `.cursor/rules/40-security-tenancy.mdc`

## 8. Runtime States and UX Behavior

- Current launch baseline requirement:
  - Canvas must first implement and verify a minimal working state machine for `empty -> draft_loaded -> review_required -> approved_or_rejected -> handoff_readback`.
  - Until that sequence works, `success` states below are target acceptance states, not current product truth.
- Loading:
  - show runtime/artifact/run skeleton or spinner,
  - state which artifact/run/context is being loaded when known,
  - next action: wait or cancel/return to conversation.
- Empty:
  - no active artifact/workspace context shows a clear start state,
  - next action: create draft from selected message, choose document/sheet/deck lane, or return to chat.
- Error:
  - show guarded failure copy; no raw provider/internal errors,
  - next action: retry, reopen conversation, change scope, or report issue.
- Degraded:
  - route gated, rollout disabled, missing source refs, missing ACL, partial artifact run, or source freshness unknown must be labeled as degraded,
  - next action: inspect missing evidence, choose allowed owner lane, or defer materialization.
- Success:
  - show artifact candidate/review state, source/provenance state and permitted next action,
  - next action: review diff, approve/apply, reject, rollback, open owner surface, export when eligible, or link back to project.
- Target advanced states:
  - `diff_pending`,
  - `review_requested`,
  - `approval_required`,
  - `apply_in_progress`,
  - `rollback_available`,
  - `source_lineage_warning`,
  - `owner_lane_readback_pending`.
- Next action guidance must be visible in every state and must distinguish AI suggestion from approved truth.

## 9. AI, Source, Evidence, Approval

- AI action placement:
  - contextual AI actions belong in Menu 3 / local command row right-side slot,
  - canvas body may show artifact content, review cards and state-specific inline controls only when those controls are directly tied to the selected artifact/diff,
  - the same action must not be duplicated in Menu 3 and canvas body.
- Source/provenance visibility:
  - every artifact candidate must expose source refs, citation refs or explicit no-source state,
  - source health/freshness is target/deferred and must not be represented as shipped until evidence exists,
  - client-ready output must show redaction/restricted-source warning before export/materialization.
- Approval/diff/review requirements:
  - high-impact actions follow `proposal -> preview/diff -> accept/reject -> execution -> read-back/audit`,
  - target apply/reject/rollback must stay deferred until route/component/API/test evidence proves the complete lifecycle,
  - no silent apply for sheet/document/deck changes.
- Audit trail/evidence:
  - as-is evidence comes from proposal/run status, runtime rollout state and backend proposal contracts,
  - target audit must include source refs, model/tool traceability, actor, before/after state and approval identity.

Evidence:

- component: `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`
- API: `server/src/routes/conversations.routes.ts`, `server/src/routes/artifact-runs.routes.ts`
- test: `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`, `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated users with access to the relevant runtime surfaces.
- Denied/restricted roles:
  - ACL-denied users,
  - users without access to selected conversation, source, project, artifact or owner lane,
  - users without internal access to internal QA runtime surfaces where applicable.
- ACL/tenant scope:
  - canvas can only use conversation/workspace/source context allowed to the current tenant/user,
  - owner-lane execution must re-check owner module ACL before mutation.
- Sensitive data masking/redaction:
  - raw internals, provider errors, secrets, hidden prompts and sensitive source payloads must not be exposed,
  - client-ready redaction remains review-required before export/materialization.
- Security failure behavior:
  - deny by default,
  - show honest restricted/degraded state,
  - do not degrade into ungrounded generated truth.

Evidence:

- security: `.cursor/rules/40-security-tenancy.mdc`
- API/policy: `server/src/services/ai/chatPolicyGateway.ts`, `server/src/services/chatPermissionService.ts`
- test: `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## 11. Acceptance Criteria and Test Evidence

- Launch gate: `NO_GO` until every P0 check below passes.
- P0 launch baseline:
  - A normal user can open Canvas from a Teresa conversation or explicit module entry without landing on a misleading gated shell.
  - Canvas shows an honest empty state when no artifact candidate exists.
  - A selected chat output can create or load one draft artifact candidate in Canvas.
  - Canvas shows source/provenance or an explicit no-source warning for that candidate.
  - Canvas shows a review-required state before any high-impact action.
  - User can accept or reject the candidate; rejection leaves no durable owner-lane mutation.
  - Approved candidate routes to the correct owner lane and returns read-back evidence.
  - Error/degraded states explain whether the blocker is route, rollout, source, ACL, API, or owner-lane read-back.
  - Contextual AI actions obey Menu 3 placement and are not duplicated in canvas body.
- P1 after-start baseline:
  - Add dedicated e2e suite for `conversation -> canvas draft -> review -> approval/rejection -> owner-lane read-back`.
  - Add component assertions for Menu 3 placement per Canvas sub-state.
  - Add artifact-source review tests for no-source and multi-source candidates.
- Deferred beyond startup:
  - Full diff/apply/reject/rollback.
  - Source health/freshness UI.
  - Shared Canvas route parity for document/sheet/deck lanes.
- Route evidence:
  - `src/routes/routeConfig.ts`
  - `src/routes/AppRoutes.tsx`
- Component evidence:
  - `src/views/V10RuntimeWorkspaceView.tsx`
  - `src/components/AIChat/MessageRenderer.tsx`
  - `src/components/AIChat/V8ArtifactRunControl.tsx`
  - `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/layouts/MainLayout.tsx`
- API evidence:
  - `src/services/api.ts`
  - `server/src/routes/artifact-runs.routes.ts`
  - `server/src/routes/conversations.routes.ts`
- Test evidence:
  - `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`
  - `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
  - `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`
  - `src/utils/__tests__/chatV10Rollout.test.ts`
- Known `doc_gap`: end-user Menu 3/component mapping for every canvas sub-state is not fully stabilized while lane routes are blocked.
- Known `code_gap`: lane runtime is partially available in components but not fully exposed in production routes.
- Known `startup_gap`: no proven user-facing Canvas startup path that completes draft load, review, approval/rejection and owner-lane read-back.
- Known `test_gap`: no dedicated e2e suite covers `conversation -> canvas draft -> review/diff -> approval -> owner-lane materialization -> read-back`.
- Known `implementation_gap`: artifact diff/versioning, side-panel source lineage review and cross-artifact rollback are target/deferred, not shipped claims.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - High: Canvas currently must be treated as not operational; describing isolated component evidence as pass can mislead delivery planning.
  - High: component existence may be mistaken for production lane availability if gated routes are not labeled clearly.
  - Medium: incomplete diff/apply/reject/rollback evidence can create false confidence in artifact governance.
  - Medium: cross-module handoff can blur ownership unless owner-lane read-back is enforced.
  - Low: Menu 3 slot mapping remains under-specified for every canvas sub-state.
- Open decisions:
  - Decide the P0 user entrypoint for Canvas startup: from selected chat message, explicit Menu 2 function, or shared `/ai/work-canvas?kind=*` route.
  - Decide when `CZ_CANVAS_WORKSPACE` can transition from `partial` to `real`; blocker is complete route/component/API/test evidence for end-user lane exposure and artifact review lifecycle.
  - Decide exact target route for shared Canvas (`/ai/work-canvas?kind=*`) before claiming lane parity.
  - Decide source/knowledge promotion scope for artifact candidates before shared memory writes are allowed.
- Change log:
  - 2026-05-10: Operational status corrected to `STARTUP_INCOMPLETE / NO_GO`; contract now defines P0 launch baseline required to finish the Canvas module start.
  - 2026-05-10: Canvas contract expanded to full 12-section standard with explicit AS-IS/TARGET separation, Menu 3 placement, security/tenancy constraints, evidence bundle and cross-module handoff boundaries.
