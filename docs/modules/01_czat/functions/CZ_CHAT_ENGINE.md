---
module_id: MODULE_CHAT
function_id: CZ_CHAT_ENGINE
function_name: Teresa Chat Engine
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Teresa Chat Engine

## 1. Function Identity

- Function ID: `CZ_CHAT_ENGINE`
- Module: `01_czat`
- UI labels/aliases: `Czat`, `Teresa`, `AI Chat`
- Route/AppView scope: `AppView.AI_CHAT`, `"/chat"`, `"/chat/:conversationId"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: run conversational intake, analysis, and guided action planning.
- Business outcome: faster transformation decisions with traceable AI guidance.
- Non-goals: chat must not execute hidden high-impact writes without explicit approval.

## 3. Trigger and Entry Points

- Entry points: sidebar `AI_CHAT`, direct routes `"/chat"` and `"/chat/:conversationId"`.
- Preconditions: authenticated user/session context.
- Blocking conditions: provider/API failures and permission boundaries.

## 4. UI Component Footprint

- Top-level container/view components: `AIChatWelcomeView`, `UnifiedChatPanel`.
- Message/runtime components: `MessageRenderer`, `EnhancedChatInput`, `ChatSlidingPanel`, `SmartSuggestions`.
- Input action bar components: `WorkModeMenu`, `AddFilesMenu`, `ToolsMenu`, `CoThinkerMenu`, `ActiveModeStrip`, `NextModelChip`.
- Governance/evidence components: `CitationList`, `TeresaProposalCard`, `V8ArtifactRunControl`, `V8ContextIndicator`.
- Component ownership notes: chat UI is module-owned; layout shell is shared (`MainLayout`).

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: user messages, conversation history, workspace context, selected language/voice settings, selected work mode preset, AI mode flags (`webSearch`, `deepResearch`, `showReasoning`, `multiAgent`, `privateMode`), co-thinker mode and response style.
- Target/deferred input objects: project instructions, shared conversation participants, source/knowledge destination, agent run plan, source health/freshness, meeting transcript/recap payload, consulting playbook selection and cross-conversation search filters.
- Upstream modules/services: `useConversationStore`, `useAIStream`, `Api` chat/runtime calls.
- APIs/models: `src/services/api.ts`, chat/domain types in `src/types/*`.
- Data freshness assumptions: streaming and persistence can complete asynchronously.

## 6. Outputs and Side Effects

- Produced objects/artifacts: AI messages, proposals, citations, conversation metadata.
- Target/deferred outputs: run-plan candidates, source-health summaries, meeting recap candidates, project recap candidates, knowledge promotion candidates and playbook-guided output drafts.
- Downstream handoff: approvals and proposal actions route to owner workflows.
- Side effects visible to user: streamed responses, suggestions, citations, proposal cards, toasts.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: owner modules/services for business entities; chat owns conversation state.
- Handoff contract (`from -> to`): `proposal -> approval -> execution -> audit`.
- Forbidden ownership: chat must not silently mutate foreign canonical entities.

## 8. Runtime States and UX Behavior

- Loading: visible loading/thinking indicators.
- Empty: onboarding start state with suggested prompts.
- Error: guarded failure messages (no raw internals).
- Degraded: explicit degraded/empty-response messaging.
- Success: clear AI response with next-action options.
- Pre-send: active mode/source strip shows preset, web/private/deep/multi-agent/model posture before the prompt is sent.
- Next action guidance per state: continue chat, approve/review, inspect citations, retry.
- Target advanced states: run-plan pending, source-health warning, knowledge-promotion review, meeting-recap extraction and cross-conversation recap must be compact cards/dropdowns, not persistent toolbars.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/local command controls; no duplicated global AI toolbar in canvas.
- Source/provenance visibility: claims and recommendations must expose citations or explicit no-source state.
- Approval/diff/review requirements: destructive/governance actions require explicit review.
- Audit trail/evidence: proposal lifecycle and chat metadata persistence.
- Target market-parity rule: project instructions, shared project chat, agent run plans, source health, meeting recap and knowledge lifecycle remain target/deferred until backed by implementation evidence and permission/write guards.

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated tenant users with chat access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: chat context and persisted conversation remain tenant-scoped.
- Sensitive data masking/redaction: enforced by policy and runtime guards.
- Source/attachment knowledge writes must respect selected destination (`conversation-only`, `personal`, `project/team`, `organization`, `no-retention`) once implemented; current contract forbids hidden promotion as a target invariant.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `"/chat"` renders `AIChatWelcomeView`.
  - `"/chat/:conversationId"` renders `UnifiedChatPanel` with route sync.
  - citations/proposals/approval flow are visible in runtime.
- Route evidence:
  - `src/routes/routeConfig.ts`
  - `src/routes/AppRoutes.tsx`
- Component evidence:
  - `src/views/AIChatWelcomeView.tsx`
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/components/AIChat/ConversationRouteSync.tsx`
  - `src/components/AIChat/MessageRenderer.tsx`
  - `src/components/AIChat/EnhancedChatInput.tsx`
  - `src/components/AIChat/WorkModeMenu.tsx`
  - `src/components/AIChat/ToolsMenu.tsx`
  - `src/components/AIChat/ActiveModeStrip.tsx`
- API evidence:
  - `src/services/api.ts`
  - `server/src/routes/ai.routes.ts`
  - `server/src/routes/conversations.routes.ts`
- Test evidence:
  - `tests/components/AppRoutes.ai-chat-routing.test.tsx`
  - `tests/components/AIChat/UnifiedChatPanel.test.tsx`
  - `tests/integration/ai/ai-chat.routes.test.ts`
  - `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`
- Known `doc_gap`: message-level Menu 3 slot mapping per sub-state is not enumerated component-by-component.
- Known `code_gap`: no dedicated e2e suite covering full chat-to-canvas bridge lifecycle from this function boundary.
- Known `implementation_gap`: no shipped evidence yet for project instructions, shared project chat, agent run plan, source health UI, meeting recap pipeline, knowledge lifecycle or connector catalog as complete capabilities.

## 12. Open Risks and Change Log

- Risks/assumptions: stream failures and partial responses can reduce trust if degraded mode copy drifts.
- Open decisions: harmonize naming (`AI Chat` vs `Teresa`) across module docs.
- Change log: initial separated chat-function contract created.
