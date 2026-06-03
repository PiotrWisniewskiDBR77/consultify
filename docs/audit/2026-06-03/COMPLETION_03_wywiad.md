# COMPLETION DOSSIER — Module 03 Wywiad / Interview
**Date:** 2026-06-03  
**Score baseline (06-02):** 72/100  
**Score re-audit (06-03):** 84/100  
**Gap to 100%:** 16 pts  
**Verdict:** Production-capable core; Teresa's conversational layer (SufficiencyIndicator, ConversationalPanel) is built but never mounted in any live surface — the module's defining AI intelligence loop is currently orphaned.

---

## 1. Purpose / Goal / Vision

The module's RAW target (`RAW_TARGET_STATE_2_0_PACKET.md`) states: Teresa can **conduct interview work sessions** — ask questions, capture answers, normalize findings, and expose source/session provenance. This is a hard MUST from `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`.

The full vision pipeline is:
```
Template (AI-quality-gated) → Session (Teresa-assisted conversational runtime)
  → SufficiencyGate → Insight (AI synthesis, 12 modes + Between-the-Lines)
  → Finding → Initiative candidate (proposal-review-readback) → Module 05
```

All seven function lanes must be live: `WY_MY_ASSIGNMENTS`, `WY_MANAGED_ASSIGNMENTS`, `WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`, `WY_INITIATIVES`, `WY_PENDING_REVIEW`.

---

## 2. Readiness Score + Gaps

| Dimension | Status | Score weight |
|---|---|---|
| Sessions/assignments/templates/insights pipeline | Real, backend-wired | +28 |
| AI quality gate (evaluate-quality) | Wired — TemplateBuilder.tsx:714 | +8 |
| Insight creator (12 analysis types, BCG frames) | Real — V8InterviewApi.createInsight | +10 |
| Insight→Initiative handoff | Real — interview-insights.routes.ts:642 | +8 |
| onInsightPublished org-context bridge | Real — interview-insights.routes.ts:246 | +5 |
| Bulk actions (8) | Implemented — InterviewHub.tsx:1149–1232 | +6 |
| Frontend smoke tests | 2 files exist and are wired by vitest.config include | +5 |
| **SufficiencyIndicator** | Built (SufficiencyIndicator.tsx), never mounted | **-4** |
| **ConversationalPanel** | Built (ConversationalPanel.tsx), never mounted | **-4** |
| N+1 question save | Serial for…of, TemplateBuilder.tsx:786–817 | -2 |
| 48 `as any` casts | InterviewHub.tsx status-enum suppressions | -2 |
| Bulk remind/clone serial | InterviewHub.tsx:1154–1161 | -1 |
| onInsightPublished silent failure | interview-insights.routes.ts:246 .catch swallowed | -1 |
| Route alias policy | /interview, /discovery, /project-intelligence undefined policy | -1 |
| E2E journey proof | NOT_DONE per taskboard | -1 |

**Current: 84/100. Gap: 16 pts.**

---

## 3. Teresa Integration — Depth + Missing

### What is real
- **Template AI quality gate:** `POST /interview/templates/evaluate-quality` (`interview.routes.ts:219`); frontend caller at `TemplateBuilder.tsx:714,737,833` — triggered on save and explicit "Check quality". Real LLM path.
- **AI parse (conversational → structured answers):** `POST /interview/sessions/:sessionId/ai-parse` (`interview.routes.ts:331`); controller `InterviewController.ts:4942` uses a real Claude system prompt to map transcripts to question answers. `ConversationalPanel.tsx` calls this at line 147 with full draft-review/accept flow.
- **Answer quality evaluation:** `POST /sessions/:sessionId/evaluate-answers` (`interview.routes.ts:328`, v8 route:370); `InterviewWorkspace.tsx:437` calls it — result rendered as `aiEvaluation` state in the workspace.
- **Insight synthesis (Teresa-branded):** `InsightCreatorModal.tsx` — 12 analysis types, 7 analysis modes including "Between the Lines" NLP, hypothesis validation, contradiction scan. Real `V8InterviewApi.createInsight` with v1 fallback (`Api.post('/interview/insights')`). Teresa mark shown in `ConversationalPanel.tsx:244` for AI messages.
- **RuntimeModeSelector:** `InterviewWorkspace.tsx:1903` mounts it. Two modes: `single_question` and `task_list`. No Teresa-recommended mode signal yet — `recommendedMode` prop always null.

### Critical gap: SufficiencyIndicator and ConversationalPanel are orphaned
Both components are complete and production-quality:
- `SufficiencyIndicator.tsx` — score gauge, criteria list, send-back dialog. No component imports it outside its own file and `index.ts` export.
- `ConversationalPanel.tsx` — chat transcript, AI parse trigger, draft-review accept flow. No component imports it outside its own definition.

Neither is rendered anywhere in the live app. The full Teresa-in-the-session loop (`Transcript → AI parse → draft review → SufficiencyGate → proceed to Insights`) exists in code but is unreachable from any UI surface.

### Missing
- Teresa proactive question-suggestion during a live session (the "Teresa as interviewer" goal from `RAW_TARGET_STATE_2_0_PACKET.md` §9.2 "must").
- `recommendedMode` signal from backend to surface AI-suggested runtime mode.
- `onSendBack` and `onProceed` callbacks for SufficiencyIndicator wired to real session state change API call.

---

## 4. System Integration

**Solid:**
- Insight → Initiative handoff: `interview-insights.routes.ts:642–724` calls `buildHandoffPayload`, gates on `canPublishFinding` + client readback confirmation, records in DB.
- `initiativeWizardSourceBasket` memo (`InterviewHub.tsx:1630`) feeds `InitiativeWizardModal` with up to 10 insights/sessions.
- `onInsightPublished` → `rebuildOrganizationContextSnapshot` bridge (`interview-insights.routes.ts:240,246`) — Assessment and Document Studio pick up fresh context.
- Legacy `/api/interview` route sends `deprecationHeader('/api/v8/interview')` (`Gateway.ts:920`).

**Gaps:**
- Handoff read-back proof (visual confirmation that Module 05 accepted the candidate) has no frontend journey test.
- `onInsightPublished` failure is silently swallowed — `.catch((err) => logger.warn(…))`, no retry, no metric (`interview-insights.routes.ts:246`).

---

## 5. Functionality — Real / Mock / Broken

| Feature | Status | Location |
|---|---|---|
| Sessions CRUD, assignment lifecycle | Real | v8/interview.routes.ts |
| Template builder + AI quality gate | Real | TemplateBuilder.tsx:714 |
| Insight creator (12 types) | Real | InsightCreatorModal.tsx:885 |
| Bulk actions (all 8) | Real | InterviewHub.tsx:1149–1232 |
| Insight→Initiative handoff | Real | interview-insights.routes.ts:642 |
| AI parse (ConversationalPanel) | Built, unreachable | ConversationalPanel.tsx:147 |
| SufficiencyIndicator | Built, unreachable | SufficiencyIndicator.tsx |
| RuntimeModeSelector | Mounted | InterviewWorkspace.tsx:1903 |
| Answer quality evaluation | Real | InterviewWorkspace.tsx:437 |
| Demo data fallback | Gated behind shouldAllowDemoData() | InterviewHub.tsx:783 |
| templateLibraryMeta area tags | Static const — deploy to add | templateLibraryMeta.ts |

---

## 6. Completion Plan to 100%

### P0 — Must-close before claiming 100% (est. 2–3 days)

| ID | Action | File:line | Effort |
|---|---|---|---|
| P0-01 | **Mount ConversationalPanel in InterviewWorkspace** — add runtime mode branch for `conversational`; wire `sessionId` + `questions` props; expose mode in RuntimeModeSelector | `InterviewWorkspace.tsx:1903`, `RuntimeModeSelector.tsx:22` | M |
| P0-02 | **Mount SufficiencyIndicator in InterviewWorkspace** — call `GET /sessions/:id/evaluate-answers` on load; pass score+criteria; wire `onSendBack` to `POST /sessions/:id/review-action` and `onProceed` to status change | `InterviewWorkspace.tsx` ~700, `interview.routes.ts:328` | M |
| P0-03 | **Wire recommendedMode from backend** — `evaluate-answers` response should include `recommendedMode`; pass to `RuntimeModeSelector` prop | `InterviewController.ts:4940`, `InterviewWorkspace.tsx:462` | S |
| P0-04 | **Fix N+1 save in TemplateBuilder** — add `PATCH /interview/templates/:id/questions/batch` endpoint; replace serial for…of at `TemplateBuilder.tsx:786` with a single call | `TemplateBuilder.tsx:786`, `interview.routes.ts` | M |
| P0-05 | **Replace 48 `as any` status casts** with a shared `InterviewStatus` enum | `InterviewHub.tsx` (48 occurrences) | S |

### P1 — Important for quality (est. 1–2 days)

| ID | Action | File:line | Effort |
|---|---|---|---|
| P1-01 | **Bulk remind/clone concurrency** — replace serial `for…of` with `Promise.allSettled` in `handleBulkRemind` and `handleBulkCloneTemplates` | `InterviewHub.tsx:1154–1209` | S |
| P1-02 | **onInsightPublished observability** — add metric + retry for context-rebuild failure | `interview-insights.routes.ts:246` | S |
| P1-03 | **Handoff readback frontend journey test** — assert Module 05 read-back state in a Vitest test | `__tests__/` | M |
| P1-04 | **Teresa proactive question suggestion** — during live session, Teresa proposes a follow-up after each answer (new endpoint `POST /sessions/:id/suggest-followup`) | `ConversationalPanel.tsx`, `InterviewController.ts` | L |

### P2 — Hardening (est. 1 day)

| ID | Action | File:line | Effort |
|---|---|---|---|
| P2-01 | **Route alias policy decision** — consolidate or document `/interview` vs `/discovery` vs `/project-intelligence` | `AppRoutes.tsx:1454,1478,1489` | S |
| P2-02 | **E2E journey coverage** — full session→insight→handoff Playwright journey | tests/e2e | L |

---

## 7. Definition of 100%

1. `ConversationalPanel` is mounted and reachable in `InterviewWorkspace` — the Teresa chat-to-answers flow is live.
2. `SufficiencyIndicator` is mounted; score is computed from `evaluate-answers`; send-back and proceed are wired to real API calls.
3. `RuntimeModeSelector` surfaces a Teresa-recommended mode signal from the backend.
4. N+1 question save is eliminated (batch endpoint).
5. All 48 `as any` status casts replaced with typed enum.
6. `onInsightPublished` has observable failure path (metric or retry).
7. Handoff readback has at least one Vitest journey test.
8. Route alias policy is documented or consolidated.
9. All seven WY_ function lanes have at least one full-journey test (smoke or integration).
10. Teresa proactive follow-up suggestion is live in ConversationalPanel (P1, required for vision goal).
