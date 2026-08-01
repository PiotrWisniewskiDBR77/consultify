---
module_id: MODULE_CHAT
doc_kind: BEHAVIOR
version: 2.1
owner: user
status: canonical
last_updated: 2026-07-29
---

# Behavior — Czat / Teresa Chat Engine

## Runtime Behavior (As-Is)

- `/chat` and `/chat/:conversationId` mount one canonical shell:
  `ConversationRouteSync` plus `UnifiedChatPanel` in `full` mode.
- `ConversationRouteSync` synchronizes the optional route parameter with the
  active conversation. The empty `/chat` state and an opened conversation do
  not use separate top-level views.
- Chat runtime provides explicit response/action surfaces (citations, proposal/action cards, message actions) through dedicated AI Chat components imported in both chat surfaces.
- Conversation-scoped handoff exists from chat to other modules through explicit route targets and context openings (for example mapping to `initiatives`, `my-work`, `meeting`, `interview` in chat runtime code).

Evidence:

- route: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component: `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/ConversationRouteSync.tsx`
- API: `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts`
- test: `tests/components/AppRoutes.ai-chat-routing.test.tsx`, `tests/integration/ai/ai-chat.routes.test.ts`

### Function Split (Chat vs Canvas)

- `CZ_CHAT_ENGINE` (real): conversational runtime on `/chat` and `/chat/:conversationId`, including message streaming, proposal cards, citations, message actions, voice indicators, and route-conversation sync.
- `CZ_CANVAS_WORKSPACE` (startup_incomplete / NO_GO): intended governed bridge from chat to workspace/canvas flows; internal runtime route (`/internal/v10-runtime`) and artifact/workspace orchestration controls exist as evidence, but the user-facing Canvas startup path is not proven end-to-end.

## State Handling (As-Is)

- Loading state is managed in chat views via store flags and stream lifecycle.
- Empty assistant response fallback text is generated explicitly (no silent blank response path).
- Error paths use guarded messages and warning fallbacks in chat runtime helpers.
- Degraded runtime is explicit for empty/failure/provider-limited responses and for partial rollout workspace states.

## Security / Tenant / Governance (As-Is)

- Mutation paths run through shared API/store layer (`src/services/api.ts`, conversation store methods); no hidden write-only branch is documented in the chat view files.
- Role/tenant enforcement is inherited from global app auth/session context; chat module does not expose a separate ACL bypass in route definitions.
- High-impact action execution is represented as explicit action/proposal UI elements (not silent auto-commit in route code).
- Workspace/canvas bridge follows governed execution concepts (plan/review/materialize) and does not document silent high-impact execution paths.

## Target Delta Applied In Contract 2.0

- KEEP: route topology and split between chat route and internal runtime route.
- ENHANCE: explicit requirement that cross-module mutation remains approval-gated and owner-lane executed.
- ENHANCE: explicit source/provenance posture (citations-or-uncertainty) for trust-critical responses.
- ENHANCE_TARGET: advanced work modes, source/knowledge scope, run plans, artifact diff/review and cross-conversation intelligence are target behaviors, not shipped claims unless separately evidenced.
- ENHANCE_TARGET: advanced behaviors must stay calm in UI through progressive disclosure, compact cards, Menu 3 actions and side panels.
- DEFER_P2: end-user lane parity for canvas runtime while blocked routes remain coming-soon.
- STARTUP_P0: Canvas must first prove `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back` before any documentation or UI may represent it as working.

## Target Behavior — Market-Parity Layer

The target Conversational Work OS behavior is:

- Before larger multi-step work, Teresa proposes an agent run plan with steps, sources, tools, output and required approvals.
- For artifacts, Teresa proposes changes as draft/diff/version candidates; owner surfaces apply/reject/rollback the change.
- For files and external sources, Teresa distinguishes what was attached, what was parsed, what was cited, and where the knowledge may be retained.
- For meetings/workshops, Teresa extracts summary, decisions, tasks, risks, open questions and follow-ups as candidates.
- For project-level work, Teresa can summarize across conversations and sources, but only within allowed scope and with source visibility.
- For consulting playbooks, Teresa routes the user through focused modes such as discovery, audit, business case, PMO review, risk register and client-ready memo.

Evidence status:

- as-is route/component/API/test evidence exists for base chat, attachment ingestion, citations, work-mode controls, side-panel context and proposal/approval primitives;
- implementation evidence remains open for project instructions, shared project chat, agent run plan, artifact diff/versioning, source health UI, meeting recap pipeline, knowledge lifecycle and connector catalog.
- implementation evidence remains open for Canvas P0 startup: user-facing entry, draft preview, artifact identity, accept/reject/edit, project link, owner-lane read-back, Canvas audit strip and Canvas-specific e2e coverage.
