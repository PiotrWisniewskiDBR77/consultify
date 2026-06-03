# DEEP RE-VERIFICATION — Module 03 Wywiad / Interview

**Date:** 2026-06-03
**Method:** End-to-end stack trace (UI → route → controller → service → DB/AI). No builds.
**Verdict:** Backend pipeline is real and deep. The Teresa conversational session layer (ConversationalPanel + SufficiencyIndicator) is genuinely orphaned — every server dependency it needs exists and is LLM-backed, but no UI surface mounts it. The COMPLETION_03 claim is **CONFIRMED**.

---

## A. Headline claims — CONFIRM / REFUTE (file:line)

| Claim | Verdict | Evidence |
|---|---|---|
| ConversationalPanel built but NEVER mounted | **CONFIRMED** | `grep "ConversationalPanel"` across `src/` returns ZERO references outside `src/components/Interview/ConversationalPanel.tsx`. Not even exported from `index.ts`. No lazy/dynamic import. |
| SufficiencyIndicator built but NEVER mounted | **CONFIRMED** | Only references are `src/components/Interview/index.ts:41` (export) and `:60` (type export). No component imports it. Never rendered. |
| RuntimeModeSelector cannot reach conversational mode | **CONFIRMED (deeper)** | `RuntimeModeSelector.tsx:22` — `RuntimeMode = 'single_question' \| 'task_list'`. No `conversational` member exists, so even the mode toggle (line 111) cannot select the panel. |
| Teresa endpoints are dead/mock | **REFUTED** | All endpoints exist and call real LLM: `ai-parse` (`interview.routes.ts:331` → `InterviewController.aiParseSessionAnswers:4942`, `llmService.call:4694`), `evaluate-answers` (`:328` → `:1892`), `evaluate-quality` (`:219`), transcript GET/POST (`:338,:341`). ConversationalPanel correctly targets them (`ConversationalPanel.tsx:79,111,147`). The loop is mountable today. |

**Net:** The defining AI intelligence loop (Transcript → ai-parse → draft review → SufficiencyGate → proceed) is fully implemented server-side and in the orphaned components — it is unreachable solely because no live surface renders the two panels and no `conversational` runtime mode exists.

---

## B. Per-feature verification (WORKS / PARTIAL / MOCK / BROKEN)

| Feature | Status | Path (file:line) |
|---|---|---|
| Question flow (sessions/assignments/templates CRUD) | **WORKS** | `v8/interview.routes.ts`; runtime `InterviewWorkspace.tsx:1903` mounts `RuntimeModeSelector` (single_question / task_list both live) |
| Capture → answer persist | **WORKS** | Answers persist to `interview_sessions` / `interview_evidence`; controller writes via `llmService` evaluate path |
| Capture → org-context WRITE | **PARTIAL** | Org-context write fires ONLY at insight publish (`v8/interview-insights.routes.ts:248 rebuildOrganizationContextSnapshot`), NOT on answer capture. Raw evidence is surfaced indirectly via snapshot's `interview_evidence` query (`OrganizationContextService.ts:925`) |
| Sufficiency scoring | **PARTIAL/BROKEN** | Backend `evaluate-answers` returns per-answer scores (`InterviewController.ts:1854–1900`, real LLM). `SufficiencyIndicator.tsx` consumes `score`+`criteria`+`threshold` but is never mounted; `onSendBack`/`onProceed` never wired to an API. Scoring engine exists; UI gate is dead. |
| AI follow-ups (Teresa as interviewer) | **BROKEN/MISSING** | No `suggest-followup` endpoint exists (`grep` returns nothing). ConversationalPanel has no proactive-question path. Vision "Teresa as interviewer" not implemented. |
| AI parse (transcript → answers) | **WORKS (unreachable)** | `ConversationalPanel.tsx:147` → `ai-parse` → real LLM (`InterviewController.ts:4998 systemPrompt`). Functional but unmounted. |
| Insight synthesis (12 types) | **WORKS** | `InsightCreatorModal.tsx` → `V8InterviewApi.createInsight` |
| Insight → Initiative handoff | **WORKS** | `v8/interview-insights.routes.ts:642` `buildHandoffPayload`, gated on readback |

---

## C. Four-lens analysis

### Lens 1 — Functionalities
Core diagnostic pipeline (templates → sessions → insights → initiatives) is real and backend-wired. The conversational AI runtime is the only broken lane: two production-quality components and a full server backend exist but are disconnected at the mount point. This is a wiring gap, not a missing-feature gap — estimated <1 day to mount both panels behind a new `conversational` RuntimeMode.

### Lens 2 — Cross-module flow (CRITICAL: Interview → Org Context 16 → downstream)
**CONFIRMED REAL, full path traced:**
1. Insight published → `v8/interview-insights.routes.ts:240` fires `rebuildOrganizationContextSnapshot(organizationId)`.
2. `OrganizationContextService.ts:921` reads `interview_insights` (LIMIT 10) and `:925` reads `interview_evidence`; surfaces them as `signals.interviewInsights` (`:1261`).
3. Snapshot exposed via `Api.organizationContextGet()`; consumed by Discovery's `useOrganizationContext.ts:127`, which renders `signals.interviewInsights` into `formatForPrompt()` (`:197`).
4. Also writes to long-term RAG memory: `onInsightPublished` (`:246`) → `insightSignalBridgeService` indexes into `knowledge_docs`/`knowledge_chunks` (`:194,:224`) and emits radar `insight_finding` signals (`:101`).

So Interview is genuinely the upstream memory-writer; Discovery (04) is a confirmed downstream reader. **Caveat:** the bridge is fire-and-forget with a swallowed `.catch` (`:246`) — no retry, no metric; a failed rebuild silently strands the context.

### Lens 3 — Teresa wiring real / dead
**Real:** evaluate-quality, ai-parse, evaluate-answers, transcript — all `llmService.call` backed. **Dead-at-UI:** ConversationalPanel + SufficiencyIndicator (never mounted). **Missing:** proactive follow-up (`suggest-followup` endpoint absent); `recommendedMode` signal always null (`RuntimeModeSelector` prop never fed from backend).

### Lens 4 — Contextual / long-term memory (primary writer)
Interview is one of the two main MEMORY-WRITERS. On insight publish it persists to: (1) `interview_insights` table (structured), (2) org-context snapshot `signals.interviewInsights` (consumed by AI prompts org-wide), (3) `knowledge_docs`/`knowledge_chunks` RAG index (semantic recall). This is a deep, real long-term memory write. Gap: writes are publish-gated only; in-session evidence does not become durable org memory until an insight is published.

---

## D. Prioritized findings (file:line)

**P0**
- P0-1 Mount `ConversationalPanel` — add `conversational` to `RuntimeMode` (`RuntimeModeSelector.tsx:22`) and a render branch in `InterviewWorkspace.tsx` (~1903) wiring `sessionId`+`questions`. Backend already live.
- P0-2 Mount `SufficiencyIndicator` — call `evaluate-answers` (`interview.routes.ts:328`), pass score/criteria, wire `onSendBack`/`onProceed` to a status-change API (`SufficiencyIndicator.tsx:38,40`).

**P1**
- P1-1 Implement `POST /sessions/:id/suggest-followup` for proactive Teresa (does not exist; vision MUST).
- P1-2 Observability on org-context bridge — replace swallowed `.catch` at `v8/interview-insights.routes.ts:246` with metric + retry.
- P1-3 Feed `recommendedMode` from `evaluate-answers` into `RuntimeModeSelector` (always null today).

**P2**
- P2-1 Persist in-session evidence to org memory pre-publish (currently publish-gated only).
- P2-2 Route alias policy `/interview` vs `/discovery` vs `/project-intelligence`.
