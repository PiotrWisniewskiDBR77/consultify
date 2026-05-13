---
module_id: MODULE_CHAT
doc_kind: TESTS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Acceptance & Tests — Czat / Teresa Chat Engine

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Sidebar Chat -> `/chat` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/navigation/Sidebar/menuConfig.ts`, `src/views/AIChatWelcomeView.tsx` | `server/src/routes/ai.routes.ts` | `tests/components/AppRoutes.ai-chat-routing.test.tsx` | pass |
| Deep link `/chat/:conversationId` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/ConversationRouteSync.tsx` | `server/src/routes/conversations.routes.ts` | `tests/components/AppRoutes.ai-chat-routing.test.tsx` | pass |
| Chat API request flow (`/api/ai/chat`) | n/a (backend HTTP route) | n/a | `server/src/routes/ai.routes.ts` | `tests/integration/ai/ai-chat.routes.test.ts` | pass |
| Approval-oriented proposal message contract | n/a | `src/components/AIChat/V8ArtifactRunControl.tsx` | `server/src/routes/conversations.routes.ts` (`execution_proposal`) | `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx` | pass |
| Security policy posture (citations-or-uncertainty / denial cases) | n/a | n/a | `server/src/services/ai/chatPolicyGateway.ts` | `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts` | pass |
| Input action bar work mode + visible runtime posture | n/a | `src/components/AIChat/WorkModeMenu.tsx`, `src/components/AIChat/ToolsMenu.tsx`, `src/components/AIChat/ActiveModeStrip.tsx`, `src/components/AIChat/EnhancedChatInput.tsx` | `src/services/api.ts` (AI mode flags forwarded), `server/src/routes/ai.routes.ts` | `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` (baseline input render), planned targeted work-mode tests | pass with `test_gap` |
| Split side-panel context support | n/a | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/layouts/MainLayout.tsx`, `src/components/layout/SplitLayout.tsx` | `src/services/api.ts` context forwarding | `tests/components/AIChat/UnifiedChatPanel.test.tsx` (panel baseline), planned context-card test | pass with `test_gap` |
| Conversation-scoped attachment ingestion baseline | n/a | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/chatAttachmentSupport.ts`, `src/components/AIChat/AddFilesMenu.tsx` | `src/services/api.ts`, `server/src/routes/ai.routes.ts`, `server/src/services/ragService.ts`, `server/src/services/organizationContext/OrganizationContextService.ts` | planned targeted attachment-scope tests | pass with `implementation_gap` for target source-scope guard |
| Canvas internal runtime visibility | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/Admin/ChatV10RuntimesPanel.tsx` | `src/services/api.ts` | `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`, `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`, `src/utils/__tests__/chatV10Rollout.test.ts` | evidence exists, but not sufficient for launch |
| Canvas governed artifact controls | n/a | `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/components/AIChat/MessageRenderer.tsx` | `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts` | `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx` | evidence exists, startup lifecycle still incomplete |
| Canvas split workbench shell | target/deferred lane routes documented in `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md` | `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx` | `src/services/api.ts` | no dedicated e2e bridge suite yet | startup incomplete / `NO_GO` |
| Market-parity target capabilities | n/a | target UI documented in `04_UI_UX.md` and RAW addendum | future APIs/services required | no shipped route/component/API/test bundle yet | target/deferred |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `CZ_CHAT_ENGINE` | chat route runtime, conversation sync, response/proposal/citation surfaces, guarded fallback behavior | `AIChatWelcomeView.tsx`, `UnifiedChatPanel.tsx`, `ConversationRouteSync.tsx`, `MessageRenderer.tsx`, `tests/components/AppRoutes.ai-chat-routing.test.tsx` | pass |
| `CZ_CANVAS_WORKSPACE` | finish startup: user-facing entry, empty state, draft candidate load, review-required state, accept/reject, owner-lane read-back, Menu 3 placement and source/provenance visibility | `V10RuntimeWorkspaceView.tsx`, `ChatV10RuntimesPanel.tsx`, `V8ArtifactRunControl.tsx`, `KimiWorkspaceShell.tsx`, `UnifiedChatPanel.tsx`, `AppRoutes.tsx`, `tests/components/Admin/ChatV10RuntimesPanel.test.tsx` | startup incomplete / `NO_GO` until P0 matrix passes |
| `CZ_CHAT_ENGINE` market-parity target | project instructions, shared chat, run plans, source health, meeting recap, knowledge lifecycle, consulting playbooks | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`, `04_UI_UX.md`, `05_DATA_AND_INTEGRATIONS.md` | target/deferred |
| `CZ_CANVAS_WORKSPACE` market-parity target | artifact diff/versioning, compact review, source lineage, apply/reject/rollback, owner-lane read-back | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`, `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md`, `04_UI_UX.md`, `functions/CZ_CANVAS_WORKSPACE.md` | target/deferred |

## Canvas Workspace Acceptance Matrix

| Requirement | Route evidence | Component evidence | API evidence | Test evidence | Gate status |
| --- | --- | --- | --- | --- | --- |
| P0: user can open Canvas from Teresa conversation or explicit module entry without misleading gated shell. | required startup route TBD | existing route evidence is insufficient alone | n/a | planned startup e2e | `NO_GO` |
| P0: Canvas shows honest empty state when no artifact candidate exists. | n/a | startup empty-state component TBD | n/a | planned component/e2e assertion | `NO_GO` |
| P0: selected chat output can load/create one visible draft artifact candidate. | n/a | `MessageRenderer`, `V8ArtifactRunControl`, Canvas shell TBD | `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts` | planned startup e2e | `NO_GO` |
| P0: draft candidate shows review-required state and cannot silently materialize. | n/a | `src/components/AIChat/V8ArtifactRunControl.tsx` | `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts` | `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`, planned Canvas-specific test | `NO_GO` until Canvas-specific path exists |
| P0: accept/reject works; reject leaves no durable owner-lane mutation. | required owner route TBD | review controls TBD | owner-lane API/read-back TBD | planned e2e | `NO_GO` |
| P0: approved candidate returns owner-lane read-back before Canvas calls it materialized. | required owner route TBD | read-back UI TBD | owner-lane API/read-back TBD | planned e2e | `NO_GO` |
| P0: errors distinguish route, rollout, source, ACL, API and read-back blockers. | n/a | degraded/error state UI TBD | policy/API evidence TBD | planned component/e2e assertions | `NO_GO` |
| Canvas AI actions follow Menu 3 placement and are not duplicated in canvas body. | n/a | `DynamicTabs`/command-row slot mapping remains to be finalized for every sub-state | n/a | planned component placement assertions | `INCONCLUSIVE` |
| Canvas artifact candidates expose source/provenance or explicit no-source state before materialization/export. | n/a | `src/components/AIChat/MessageRenderer.tsx`, `src/components/AIChat/CitationList.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx` | `server/src/services/ai/chatPolicyGateway.ts`, `server/src/routes/artifact-runs.routes.ts` | `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`, planned artifact-source review tests | `PASS_WITH_P2` |
| Full Canvas diff/apply/reject/rollback and owner-lane read-back are complete. | target/deferred | target/deferred | target/deferred | no shipped route/component/API/test bundle yet | `BLOCKED_P1_FOR_SHIPPED_CLAIM`; allowed only as target/deferred |

## Confirmed Automated Evidence (As-Is)

- `tests/components/AppRoutes.ai-chat-routing.test.tsx`
- `tests/components/AIChat/UnifiedChatPanel.test.tsx`
- `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`
- `tests/integration/ai/ai-chat.routes.test.ts`
- `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx`
- `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`
- `src/utils/__tests__/chatV10Rollout.test.ts`
- `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## Known Gaps / Blockers

- `doc_gap`: no module-local link to visual approval artifacts (recording/screenshot evidence package) in this file.
- `startup_gap`: Canvas does not yet have a proven P0 startup path for user-facing work.
- `code_gap`: no dedicated acceptance suite for chat-canvas bridge across internal runtime and lane handoff boundaries.
- `test_gap`: no dedicated test asserting all `WorkModeMenu` preset flag mappings and `ActiveModeStrip` chip states.
- `test_gap`: no dedicated test asserting split-panel context card quick actions stay proposal-only prompt starters.
- `implementation_gap`: source/attachment knowledge destination guard is not fully evidenced for conversation-only vs personal/project/team/organization/no-retention behavior.
- `implementation_gap`: no shipped evidence for project instructions, shared project chat, agent run plan, artifact diff/versioning, source health UI, meeting recap pipeline, knowledge lifecycle, connector catalog or cross-conversation intelligence.
- `test_gap`: no targeted test for attachment ingestion supported formats, source-scope metadata and private/no-retention write guard.
- `test_gap`: no acceptance suite for future artifact diff/apply/reject/rollback review flow.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

## Normalized Gap Register — 2026-05-11

Owner decision closure, 2026-05-11: Canvas startup/read-back owner path is locked for docs as `chat draft -> Canvas review-required candidate -> explicit accept/reject -> owner-lane read-back`. This closes the owner-path decision only; runtime launch remains blocked until the P0/P1 evidence rows below have route/component/API/test proof.

### P0 must close

| Gap | Evidence location | Required closure | Current status |
| --- | --- | --- | --- |
| Canvas startup path is not proven for user-facing work. | Canvas workspace acceptance matrix above. | User can open Canvas, see honest empty state, load a draft candidate and review without misleading gated shell. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |
| Accept/reject/read-back loop is not proven. | Canvas workspace acceptance matrix above. | Approved candidate must read back from owner lane; rejected candidate must leave no durable owner-lane mutation. | `DECISION_CLOSED_DOCS`; runtime `NOT_DONE` |

### P1 runtime evidence

| Gap | Evidence needed | Blocking reason | Current status |
| --- | --- | --- | --- |
| Chat-canvas bridge lacks dedicated acceptance suite. | route/component/API/test bridge suite for conversation -> artifact candidate -> owner read-back. | Runtime launch cannot claim complete governed artifact handoff. | `NOT_DONE` |
| Work mode flags and split-panel context cards need targeted tests. | `WorkModeMenu`, `ToolsMenu`, `ActiveModeStrip`, split-panel context card quick actions. | Current tests cover baseline render but not full mode/context semantics. | `NOT_DONE` |
| Attachment source-scope guard is not fully evidenced. | supported formats, source-scope metadata and private/no-retention write guard tests. | Knowledge destination and privacy posture cannot be treated as fully proven. | `NOT_DONE` |

### P2 premium hardening

| Gap | Evidence needed | Current status |
| --- | --- | --- |
| Market-parity capabilities are target/deferred. | project instructions, shared chat, run plans, source health, meeting recap, knowledge lifecycle, connector catalog and cross-conversation intelligence evidence. | `NOT_DONE` |
| Artifact diff/apply/reject/rollback is not shipped as a complete evidence bundle. | dedicated artifact review flow route/component/API/test bundle. | `NOT_DONE` |
| Visual approval artifacts are not linked module-locally. | recording/screenshot evidence package path or accepted evidence-gap note. | `NOT_DONE` |
