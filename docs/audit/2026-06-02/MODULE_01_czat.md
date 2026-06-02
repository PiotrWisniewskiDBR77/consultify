# Module 01 — Czat — Readiness Scorecard

**Readiness: 68/100 — Tier: Beta**
**Route(s):** `/chat`, `/chat/:conversationId`, `/internal/v10-runtime` (legacy redirect)
**One-line verdict:** Core chat engine is real and backend-wired; the Canvas/WorkCanvas startup path is partially implemented but never proven end-to-end, and the canonical `/chat` route renders `UnifiedChatPanel` — not `AIChatWelcomeView` as docs claim.

## What's REAL (verified working + backend-wired)

- `/chat` route mounts `UnifiedChatPanel mode="full"` inside `MainLayout` — `AppRoutes.tsx:1290-1296`
- `/chat/:conversationId` also mounts `UnifiedChatPanel mode="full"` — `AppRoutes.tsx:1377-1383`
- `useAIStream` calls `Api.chatWithAIStream` → `POST /api/ai/chat/stream` (SSE) — `useAIStream.ts:1132`, `api.ts:2173`
- Backend `/api/ai/chat/stream` route exists, has `verifyToken` + Zod validation, does real AI work — `ai.routes.ts:1422-1426`
- Conversations CRUD (`/api/conversations`) exists with tenant scope, permission checks, org context — `conversations.routes.ts:1-20`, mounted via Gateway at `Gateway.ts:457`
- `chatPolicyGateway.ts`, `chatPermissionService.ts`, `ragService.ts`, `OrganizationContextService.ts` all exist
- Attachment ingestion endpoints present in `ai.routes.ts` (confirmed by CODEMAP, file exists)
- Composer command palette (slash `/`, `@`-mentions) wired into `EnhancedChatInput` — `EnhancedChatInput.tsx:29-37`; phase 1 shipped per recent commit `986d18bc1`
- Work Canvas backend routes fully mounted: `GET/POST /api/work-canvas/drafts`, proposals, approve/reject, versions, export — `work-canvas.routes.ts:2509-3978`, `Gateway.ts:371`
- `WorkCanvasShell` + `WorkCanvasDocumentPanel` wired in `UnifiedChatPanel` with canvas write-intent detection — `UnifiedChatPanel.tsx:100-102`

## What's MOCK / hardcoded / stub

- `AIChatWelcomeView` (`src/views/AIChatWelcomeView.tsx`) is a large, functional component but is **not mounted anywhere in `AppRoutes.tsx`** — it's a dead-code view that does not serve any live route; all production chat traffic goes to `UnifiedChatPanel`
- `WorkCanvas` materializable targets only cover `idea`, `note`, `initiative`, `decision`; `project_brief`, `research_report`, `client_deliverable` are explicitly left as honest placeholders — `work-canvas.routes.ts:41-46`
- KimiWorkspace views (`WordyView`, `ExceleView`, `PrezentacjeView`, `TabeleView`) exist as real React components wired to real API calls, but their routes are not wired in `AppRoutes.tsx` — lazy imports declared but no `<Route>` rendering them; they are dead paths until EE feature flag is enabled

## What's BROKEN / NO_GO / missing

- Canvas P0 startup path (`conversation → canvas draft → review_required → accept/reject → owner-lane read-back`) is **explicitly `NO_GO`** per `STATUS.md` — no e2e coverage, proposal flow exists in backend but user-facing entry remains unproven
- `AIChatWelcomeView` is dead code (not routed) — docs say it's the canonical `/chat` view; this is a direct doc-vs-code contradiction
- 3 of 8 claimed test files are MISSING: `AppRoutes.ai-chat-routing.test.tsx` (MISSING), `EnhancedChatInput.teresaVoice.test.tsx` (MISSING), `runtimeCapabilities.test.ts` (MISSING), `chatV10Rollout.test.ts` (MISSING)

## Backend wiring

Real and mounted via `Gateway.ts`:
- `POST /api/ai/chat/stream` — `ai.routes.ts:1422` ✓
- `GET|POST|PATCH|DELETE /api/conversations/*` — `conversations.routes.ts`, `Gateway.ts:457` ✓
- `GET|POST /api/work-canvas/drafts*` + proposals + versions — `work-canvas.routes.ts`, `Gateway.ts:371` ✓
- `POST /api/ai/attachments/ingest` — `ai.routes.ts` ✓

Missing/unverified:
- No standalone `/api/chat/confirm` route found in ai.routes.ts quick scan (referenced in SSE error handler `api.ts:2407`)

## UI/UX consistency

- Production chat uses `MainLayout` (shared shell) — consistent with other modules
- `AIChatWelcomeView` is a bespoke full-screen layout that is dead (not routed) — no UX concern in production but wastes ~2400 lines
- KimiWorkspace views use `KimiWorkspaceShell` — their own shell, not yet exposed

## Tests

Present (verified):
- `tests/components/AIChat/UnifiedChatPanel.test.tsx` ✓
- `tests/integration/ai/ai-chat.routes.test.ts` ✓
- `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx` ✓ (tests dead-code view)
- `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts` ✓

Missing (claimed in CODEMAP):
- `tests/components/AppRoutes.ai-chat-routing.test.tsx` — MISSING
- `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` — MISSING
- `src/hooks/v10/__tests__/runtimeCapabilities.test.ts` — MISSING
- `src/utils/__tests__/chatV10Rollout.test.ts` — MISSING

## Doc-vs-code drift

- **STATUS.md over-claims**: says `/chat` maps to `AIChatWelcomeView`; code routes `/chat` → `UnifiedChatPanel`. `AIChatWelcomeView` is dead code.
- **STATUS.md correctly claims** Canvas `NO_GO` — code confirms no routed Canvas startup path.
- CODEMAP lists 8 test files; 4 of them are missing in the repo.
- CODEMAP correctly maps `KimiWorkspace` components but omits that they have no active `<Route>` in `AppRoutes.tsx`.

## Top gaps to reach market-ready (prioritized)

1. **Remove or re-route `AIChatWelcomeView`** — it is 2400+ lines of dead code; if it was intentionally replaced by `UnifiedChatPanel`, delete it; if intended as a separate view, wire it; update CODEMAP to reflect truth.
2. **Canvas P0 startup** — wire the `conversation → canvas draft → review_required → accept/reject → owner-lane read-back` path end-to-end; `WorkCanvasShell` and backend proposals/approve/reject routes exist, the user-facing entry point just needs wiring and a routing `<Route>`.
3. **Add missing tests** — `AppRoutes.ai-chat-routing.test.tsx`, `EnhancedChatInput.teresaVoice.test.tsx`; the composer command palette (slash/mentions, `EnhancedChatInput.tsx:29-37`) shipped without integration tests.
4. **Confirm `/api/ai/chat/confirm`** endpoint exists or remove the dead reference in `api.ts:2407`.
5. **Expose KimiWorkspace routes** under feature flag in `AppRoutes.tsx` so EE deliverables (Wordy, Excele, Prezentacje) can be tested end-to-end.
