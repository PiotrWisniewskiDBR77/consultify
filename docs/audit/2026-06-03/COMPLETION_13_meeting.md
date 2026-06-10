# Module 13 — Meeting — Completion-to-100% Dossier

**Date:** 2026-06-03 | **Score: 72/100** | **Delta from 2026-06-02: +44 (was 28)** | **Target: 100**
**North-star:** Teresa as live in-meeting consultant — real-time transcription, AI-generated recap, agentic Consultify operations during the meeting.

---

## 1. Purpose / Goal / Vision

**Current purpose (delivered):** Structured meeting lifecycle management — agenda, pre-read, decisions, follow-ups — with a rule-based "operator brief" card before the meeting.

**North-star (far goal, per owner):** Teresa operates *during* the meeting: listens via a live transcription stack (own pipeline, not SaaS), generates recap + action items post-meeting, and executes Consultify operations (create task, log decision, trigger notebook entry) in real time without leaving the meeting view. The module becomes the "command centre" where consultants run client sessions.

---

## 2. Readiness: 72/100 — Score + Gap

### What is REAL and working (code-verified)

| Component | File:Line | Status |
|---|---|---|
| 8-endpoint REST layer (CRUD + status + decisions + follow-ups) | `server/src/routes/meeting.routes.ts:30–201` | REAL |
| SQLite schema (`meetings` + `meeting_follow_ups`) auto-migrated | `server/src/services/meetingService.ts:95–132` | REAL |
| `MeetingHub` mounted on `/meeting` route | `src/AppRoutes.tsx:~1957–1971` | REAL |
| Full CRUD UI (create, edit, delete, status toggle) | `src/components/Meeting/MeetingHub.tsx:64–931` | REAL |
| Calendar grid (Monday-first, 6-week, event pills) | `MeetingHub.tsx:1255–1411` | REAL |
| Operator brief card (rule-based, reads tasks/decisions from project) | `server/src/services/aiOperatorService.ts:638–707` | REAL |
| `briefMatchesMeeting` guard (stale-brief prevention) | `MeetingHub.tsx:1420–1424` | REAL |
| AI executor: Teresa can schedule a meeting | `server/src/ai/actionExecutors/meetingExecutor.ts:19–58` | REAL |
| Unit tests: routes + service | `server/src/routes/__tests__/meeting.routes.test.ts`, `meetingService.test.ts` | REAL |
| `ProductionModuleGate` wrapping (intentional, v1 decision) | `AppRoutes.tsx:~1961–1968` | REAL |

### Residual gaps at current score

| Gap | File:Line | Severity |
|---|---|---|
| `(Api as any)` casts on `updateMeeting`, `deleteMeeting`, `addMeetingDecision`, `addMeetingFollowUp` | `MeetingHub.tsx:430, 461, 495, 514` | Medium — silently no-ops if method absent |
| No loading/disabled state on edit-save button (double-submit risk) | `MeetingHub.tsx:774–782` | Medium |
| Calendar "+N more" is dead text, not clickable | `MeetingHub.tsx:1399–1402` | Low |
| Detail view: 5-button action bar has no `flex-wrap` (wraps ugly on narrow viewports) | `MeetingHub.tsx:979–1030` | Low |
| No follow-up → Task cross-module handoff | `MeetingHub.tsx:491–508` (follow-up creates meeting-local record only) | High |
| `meetingIntelligenceService` LLM client never injected; no HTTP trigger → dead code | `server/src/services/ai/meetingIntelligenceService.ts:48–62` | High (blocks AI recap phase) |
| No transcription pipeline, no audio ingestion route | — | Critical (blocks north-star) |
| No post-meeting recap/notes workflow | — | Critical (blocks north-star) |
| No live Teresa-in-meeting agentic mode | — | Critical (north-star target) |
| Zero E2E / integration tests (DB → route → response) | — | Medium |
| `ProductionModuleGate` still closed on `consultify.ai` | `AppRoutes.tsx:~1961–1968` | Blocker for GA |

---

## 3. Teresa Integration: Operator Brief + The Big Missing Pieces

### What exists

`aiOperatorService.getMeetingBrief` (`aiOperatorService.ts:638–707`) is a **rule-based pre-meeting brief**. It:
- Fetches project tasks (up to 6, non-completed) and decisions (up to 6, pending/escalated) from SQLite.
- Builds `agendaGaps[]` (checks pre-read, agenda count, attendees).
- Builds `followUpSuggestions[]` from those tasks/decisions.
- Returns `prepSummary` as a hardcoded template string (`"Focus the meeting on ${agenda[0]}..."`).

This is purely **rule-based** — no LLM, no Teresa, no live context. It renders in `MeetingOperatorBriefCard` (`MeetingHub.tsx:1180–1223`).

`teresaToolOperatorService.ts` (`server/src/services/v8/teresaToolOperatorService.ts`) covers initiatives, notebooks, and structured queries — **no `meeting` operator type exists there**.

`meetingIntelligenceService` (`server/src/services/ai/meetingIntelligenceService.ts`) has a full LLM prompt + structured output design for transcript → notes → decisions → action items → notebook handoff, but:
- `llmClient` is `null` permanently (`line 48`); `setLLMClient()` is never called from Gateway or any route.
- No HTTP endpoint exposes it — it is fully dead code.
- `persistNote` writes to `notebook_entries` but is never triggered from any live path.

### The big missing pieces (north-star gap)

1. **Live transcription stack** — no audio capture, no WebSocket/WebRTC ingestion route, no Fireflies webhook, no browser MediaRecorder integration. Zero code.
2. **Post-meeting recap pipeline** — no `POST /api/meeting/:id/generate-notes` endpoint, no Teresa invocation with transcript as context, no structured recap written back to the meeting record.
3. **Teresa-in-meeting agentic mode** — no real-time tool-call dispatch during a meeting: Teresa cannot create tasks, log decisions, or trigger notebook entries from within the meeting view.
4. **LLM operator brief** — current brief is rule-based strings. Teresa-powered brief (e.g. "based on the client DNA and last 3 meetings, the risk is X") does not exist.

---

## 4. System Integration: Cross-Module Handoffs

| Integration | Status | File:Line |
|---|---|---|
| Meeting → Task (follow-up → create task) | MISSING — follow-ups are meeting-local strings only | `MeetingHub.tsx:491–508` |
| Meeting → Decision (record a decision) | PARTIAL — saved as JSON array in meetings table, not in `decisions` table used by Decisions module | `meetingService.ts:357–375` |
| Meeting → Notebook (recap note) | DEAD — `persistNote` path exists but never triggered | `meetingIntelligenceService.ts:183–202` |
| Meeting ← Project (brief reads project tasks/decisions) | REAL — inbound cross-module data works | `aiOperatorService.ts:643–666` |
| Meeting ← AI executor (Teresa can schedule meetings) | REAL | `meetingExecutor.ts:36–48` |
| Meeting ↔ Calendar (My Work calendar sync) | NONE — `calendarInteropService` is separate; no shared event store |

The decisions written via `addMeetingDecision` go into `decisions_json` on the `meetings` table — they are **not** cross-posted to the `decisions` table used by the Decisions/DecisionsHub module. This is a data silo.

---

## 5. Completion Plan to 100% (Phased toward North-Star)

### Phase 1 — CRUD polish + cross-module wiring (72 → 82) — ~3 days

| # | Task | File:Line | Effort |
|---|---|---|---|
| P0.1 | Open `ProductionModuleGate` (confirm with owner) | `AppRoutes.tsx:~1961` | 5 min |
| P0.2 | Replace `(Api as any)` casts with typed Api calls | `MeetingHub.tsx:430, 461, 495, 514` | 1 hr |
| P0.3 | Disable edit-save button + show spinner during pending request | `MeetingHub.tsx:774–782` | 30 min |
| P1.1 | "Create task from follow-up" button → `Api.createTask` | `MeetingHub.tsx:~491` (new handler) | 3 hr |
| P1.2 | Cross-post meeting decisions to `decisions` table (or join on display) | `meetingService.ts:357–375`, `addMeetingDecision` | 3 hr |
| P1.3 | Calendar overflow click → expand day / filtered list | `MeetingHub.tsx:1399–1402` | 2 hr |
| P1.4 | Detail view action bar `flex-wrap` / overflow menu | `MeetingHub.tsx:979–1030` | 1 hr |
| P1.5 | Full-stack integration test (DB → route → response) | new test file | 3 hr |

### Phase 2 — AI recap + Notebook handoff (82 → 90) — ~4 days

| # | Task | File:Line | Effort |
|---|---|---|---|
| P2.1 | Inject LLM client into `meetingIntelligenceService` from Gateway | `meetingIntelligenceService.ts:48`; `server/src/Gateway.ts` | 2 hr |
| P2.2 | Add `POST /api/meeting/:id/generate-notes` route accepting transcript string | `meeting.routes.ts` (new route) | 3 hr |
| P2.3 | Wire UI "Generate recap" button → calls above route → stores in meeting or notebook | `MeetingHub.tsx` (new state + button) | 4 hr |
| P2.4 | `persistNote` produces a real `notebook_entries` row + shows confirmation | `meetingIntelligenceService.ts:183` | 2 hr |
| P2.5 | Upgrade operator brief to LLM-powered Teresa brief (use `teresaCopilotService`) | `aiOperatorService.ts:638` | 4 hr |

### Phase 3 — Transcription stack (90 → 96) — ~1 week

| # | Task | File:Line | Effort |
|---|---|---|---|
| P3.1 | Browser MediaRecorder capture in `MeetingDetailView` + chunked upload | `MeetingHub.tsx` new `RecordingPanel` | 5 days |
| P3.2 | Server-side audio → text: Whisper API or Fireflies webhook | new `server/src/routes/meeting-transcription.routes.ts` | 3 days |
| P3.3 | Real-time transcript display (WebSocket or SSE stream to client) | new WS handler in Gateway | 2 days |
| P3.4 | Auto-trigger `generateMeetingNotes` on recording end | `meetingIntelligenceService.ts` + route | 1 day |

### Phase 4 — Agentic Teresa-in-meeting (96 → 100) — ~1 week

| # | Task | File:Line | Effort |
|---|---|---|---|
| P4.1 | Add `meeting` surface to `teresaToolOperatorService.ts` | `teresaToolOperatorService.ts:10` (new `MeetingOperatorParams`) | 2 days |
| P4.2 | Real-time Teresa tool calls: create task, log decision, tag notebook from meeting UI | new agentic panel in `MeetingDetailView` | 3 days |
| P4.3 | Full E2E test: record → transcribe → recap → Teresa action → task created | new e2e test | 2 days |

---

## Summary

Module 13 progressed from Alpha (28/100, route gated) to Beta+ (72/100, fully mounted CRUD + calendar + rule-based operator brief). The remaining 28 points break into: 10 points for CRUD polish + cross-module wiring (Phase 1, ~3 days); 8 points for AI recap + LLM brief (Phase 2, ~4 days); and 10 points split across live transcription (Phase 3) and agentic Teresa (Phase 4, ~2 weeks combined). The north-star — Teresa listening live, acting on Consultify in real time — requires Phases 3–4 and is the module's core differentiation, currently entirely absent.
