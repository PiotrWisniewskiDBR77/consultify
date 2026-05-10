---
module_id: MODULE_CHAT
function_id: CZ_CHAT_ENGINE
function_name: Teresa Chat Engine
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
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
- Governance/evidence components: `CitationList`, `TeresaProposalCard`, `V8ArtifactRunControl`, `V8ContextIndicator`.
- Component ownership notes: chat UI is module-owned; layout shell is shared (`MainLayout`).

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: user messages, conversation history, workspace context, selected language/voice settings.
- Upstream modules/services: `useConversationStore`, `useAIStream`, `Api` chat/runtime calls.
- APIs/models: `src/services/api.ts`, chat/domain types in `src/types/*`.
- Data freshness assumptions: streaming and persistence can complete asynchronously.

## 6. Outputs and Side Effects

- Produced objects/artifacts: AI messages, proposals, citations, conversation metadata.
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
- Next action guidance per state: continue chat, approve/review, inspect citations, retry.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/local command controls; no duplicated global AI toolbar in canvas.
- Source/provenance visibility: claims and recommendations must expose citations or explicit no-source state.
- Approval/diff/review requirements: destructive/governance actions require explicit review.
- Audit trail/evidence: proposal lifecycle and chat metadata persistence.

## 10. Security, Roles, and Tenancy

- Allowed roles: authenticated tenant users with chat access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: chat context and persisted conversation remain tenant-scoped.
- Sensitive data masking/redaction: enforced by policy and runtime guards.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - `"/chat"` renders `AIChatWelcomeView`.
  - `"/chat/:conversationId"` renders `UnifiedChatPanel` with route sync.
  - citations/proposals/approval flow are visible in runtime.
- Code/runtime evidence:
  - `src/views/AIChatWelcomeView.tsx`
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/components/AIChat/ConversationRouteSync.tsx`
  - `src/components/AIChat/MessageRenderer.tsx`
- Known `doc_gap`: message-level state matrix per component is still high-level.
- Known `code_gap`: no dedicated module-level route acceptance suite for chat routes.

## 12. Open Risks and Change Log

- Risks/assumptions: stream failures and partial responses can reduce trust if degraded mode copy drifts.
- Open decisions: harmonize naming (`AI Chat` vs `Teresa`) across module docs.
- Change log: initial separated chat-function contract created.
