---
module_id: MODULE_CHAT
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Czat / Teresa Chat Engine

## 1. Main Screen

As-Is: `/chat` renders the full-screen Teresa conversation surface (`AIChatWelcomeView`) inside `MainLayout`; `/chat/:conversationId` renders `UnifiedChatPanel` for continuation. The screen job is conversational intake, orchestration and source-aware assistance with input, suggestions, proposal cards, citations, message actions and voice indicators from `src/components/AIChat/*`.

## 2. Runtime States

- Loading: suspense fallback and in-view loading indicators must tell the user that conversation state or provider response is being prepared.
- Empty: start state must provide clear prompts/suggestions and explain what the user can ask Teresa to do next.
- Error: provider/API failures must use guarded UI copy or toasts, not raw errors or silent failure.
- Degraded: empty responses, start failures or provider limitations must be labeled honestly and must not look like successful completion.
- Success: completed answers, proposals or actions must visibly distinguish AI suggestion from approved truth and show the next available action.

## 3. Menu 2 / Menu 3 Contract

Menu 2 remains the global/module shell context. Menu 3 is the local chat command row/control area for the active conversation, selected context or proposal. Chat must not introduce a second command toolbar under the canvas.

## 4. AI Actions Placement

Contextual AI controls must stay in Menu 3 / local command-row controls for the active chat context. The same action must not be duplicated in the message canvas and Menu 3; message-level affordances may only operate on that message.

## 5. Next Action Guidance

Every start, response, proposal, failure and degraded state must answer what happens next: continue the conversation, approve a proposal, inspect citations, retry, change context or contact support/admin.

## 6. Source / Evidence / Provenance

Citations/source lists are part of the chat surface and must be visible for claims, recommendations, generated outputs and decisions. If sources are missing, Teresa must say so explicitly instead of implying grounded evidence.

## 7. Approval / Diff / Review

High-impact actions proposed from chat follow `proposal -> approval -> execution -> audit`. Proposal cards must show what will change before execution; destructive or governance actions cannot execute silently.

## 8. Anti-Patterns

- Raw provider/internal errors in the chat transcript.
- Infinite spinner without retry or degraded state.
- Hidden learning or background write outside an approved flow.
- AI action duplicated both in the canvas and Menu 3.
- Source-free business claims presented as verified truth.

## 9. As-Is Gaps

- Existing docs confirm chat controls, citations and guarded fallbacks, but this contract does not yet enumerate every message-level state by component.
- Full evidence of audit trail rendering for every chat-initiated mutation remains to be validated in runtime.

## 10. Acceptance Criteria

- `/chat` and `/chat/:conversationId` render the documented Teresa surfaces.
- Loading, empty, error, degraded and success states are visible and include next-step guidance.
- Contextual AI actions live in Menu 3/local command row and are not duplicated in canvas.
- Claims and exports show sources/provenance or an explicit no-source state.
- High-impact chat actions require approval/review before execution.
