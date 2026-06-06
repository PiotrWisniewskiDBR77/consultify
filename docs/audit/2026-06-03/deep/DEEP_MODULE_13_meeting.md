# DEEP RE-VERIFICATION — Module 13: Meeting (Teresa-in-meeting / Meeting Intelligence)

**Date:** 2026-06-03 | **Method:** End-to-end stack trace (UI → api.ts → route → service → DB). No builds.
**Verdict:** The CRUD + calendar + rule-based operator brief layer is REAL and fully wired. **The entire "meeting intelligence" / live-Teresa promise is DEAD CODE.** `meetingIntelligenceService` is instantiated but never imported, never given an LLM client, and exposed by zero routes. The north-star (Teresa listening live, acting in real time) is 0% implemented.

---

## 1. Per-Feature Verification Table

| Feature | Status | Evidence (file:line) |
|---|---|---|
| Meeting **create** | **WORKS** | UI `MeetingHub.tsx:443` → `api.ts:3153` → `POST /` `meeting.routes.ts:44–78` → `createMeeting` `meetingService.ts` |
| Meeting **edit/update** | **WORKS** | `MeetingHub.tsx:429` → `api.ts:3162` → `PUT /:id` `meeting.routes.ts:80–107` |
| Meeting **delete** | **WORKS** | `MeetingHub.tsx:460` → `api.ts:3171` → `DELETE /:id` `meeting.routes.ts:109–121` |
| Status toggle (scheduled/completed) | **WORKS** | `MeetingHub.tsx:481` → `PATCH /:id/status` `meeting.routes.ts:123–142` |
| Calendar grid (Mon-first 6-week, event pills) | **WORKS** | `MeetingHub.tsx:1255–1411` (client-rendered, real data) |
| Meeting **"join"** (video/Zoom/Teams/Meet link) | **BROKEN / ABSENT** | No `joinUrl`/`videoUrl`/`zoom`/`meet` anywhere. "Meeting" = calendar record only; nothing to join. |
| **Live transcript** (Fireflies?) | **BROKEN / ABSENT** | Zero Fireflies code. No MediaRecorder/getUserMedia/WebSocket/SSE ingestion in `MeetingHub.tsx` or routes. A generic Whisper STT exists (`VoiceService.ts:73`) but is **not wired to meetings**. |
| **Operator brief** generation (pre-meeting) | **PARTIAL (rule-based, no AI)** | UI `MeetingHub.tsx:166` → `api.ts:3298` → `GET /meetings/:id/brief` `ai-operator.routes.ts:78` → `getMeetingBrief` `aiOperatorService.ts:638–707`. `prepSummary` is a hardcoded template string (`:691`). No LLM. |
| **Teresa live suggestions** (in-meeting) | **BROKEN / ABSENT** | No real-time suggestion panel, no in-meeting tool dispatch. Nothing in `MeetingHub.tsx`. |
| **Post-meeting summary/recap + action items** | **MOCK / DEAD** | `meetingIntelligenceService.generateMeetingNotes` (`:54`) exists with full LLM prompt (`:68–143`) + heuristic fallback (`:145–181`), but service is **never imported anywhere** and **no route exposes it**. |
| Action-items → **Tasks (02)** | **BROKEN / ABSENT** | Follow-ups persist to `meeting_follow_ups` table only (`meetingService.ts:340–354`). No `Api.createTask` call, no handoff. |
| Action-items → **Initiatives (05)** | **BROKEN / ABSENT** | No path. |
| Recap → **Notebook/Outputs (09)** | **DEAD** | `persistNote` writes a `notebook_entries` row (`meetingIntelligenceService.ts:183–202`) but is only callable from the dead LLM path → never executes. |
| Decision capture → **Decisions module** | **PARTIAL / SILOED** | `addMeetingDecision` writes to `decisions_json` on the `meetings` table (`meetingService.ts:357–375`), **not** the `decisions` table the Decisions hub reads. Data silo. |
| Brief **reads** project Tasks + Decisions (inbound) | **WORKS** | `aiOperatorService.ts:643–666` (real cross-module SQL reads). |
| Teresa **schedules** a meeting (AI executor) | **WORKS** | `MeetingExecutor` `meetingExecutor.ts:19–58`, registered `actionExecutionAdapter.ts:174`, tool `toolDefinitions.ts:372`. |

---

## 2. Four Lenses

### Lens 1 — Functionalities verified
Lifecycle CRUD (create/edit/delete/status), calendar grid, follow-up open/done, decision-string capture, and the rule-based operator brief are all REAL and traced end-to-end. Everything labeled "intelligence," "live," "transcript," or "recap" is absent or dead. The module is a **structured meeting-planner**, not a meeting-intelligence product.

### Lens 2 — Cross-module flow
- **Inbound (REAL):** Operator brief pulls project `tasks` + `decisions` from SQLite for prep (`aiOperatorService.ts:643–666`). This is the only working cross-module link.
- **Outbound to Moja Praca (02):** **NONE.** Follow-ups stay meeting-local (`meeting_follow_ups`); no task creation.
- **Outbound to Initiatives (05):** **NONE.**
- **Outbound to Outputs/Notebook (09):** **DEAD** — `persistNote` exists but unreachable.
- **Decisions module:** **SILOED** — meeting decisions never reach the shared `decisions` table.
- **Org context for prep:** brief does **not** read org/client memory or DNA — only project tasks/decisions.

### Lens 3 — Teresa wiring (CRITICAL)
**The live-consultant promise is DEAD.** CONFIRMED at `meetingIntelligenceService.ts:48` — `private llmClient: any = null`. `setLLMClient` (`:50`) is **never invoked anywhere** in the server (grep: 4 services define it, 0 call sites). The service itself is **imported by no file** outside itself. No HTTP route exposes `generateMeetingNotes`. Therefore: all generation falls to the heuristic regex path (`:145`) — and even that is unreachable because no caller exists.
**The ONLY real Teresa↔meeting link** is the reverse direction: Teresa can *schedule* a meeting via `MeetingExecutor`.
**To light it up (minimum):** (1) inject the LLM client into `meetingIntelligenceService` at Gateway bootstrap (mirror how chat services receive their client); (2) add `POST /api/meeting/:id/generate-notes` accepting a transcript; (3) wire a "Generate recap" button in `MeetingHub`; (4) add a transcript source (Fireflies webhook or browser MediaRecorder → existing `VoiceService` Whisper). Items 1–3 are ~1–2 days; live transcription (4) is the heavy lift.

### Lens 4 — Contextual memory
**Read: NO. Write: NO.** No meeting path reads org/user memory or client DNA (grep clean across `meetingService`, `meetingIntelligenceService`, `meetingExecutor`, and `getMeetingBrief`). The only would-be write (`persistNote` → `notebook_entries`) is dead. The module is fully memory-blind in both directions.

---

## 3. P0 / P1 / P2 (file:line)

### P0 — Blocks the product vision / GA
- **P0.1** Inject LLM client into `meetingIntelligenceService` (`meetingIntelligenceService.ts:48–52`) at Gateway bootstrap — currently permanently null → all intelligence dead.
- **P0.2** Add `POST /api/meeting/:id/generate-notes` route (`meeting.routes.ts`, new) exposing `generateMeetingNotes`; wire "Generate recap" button in `MeetingHub.tsx`.
- **P0.3** Transcript source: Fireflies webhook OR browser MediaRecorder → existing Whisper `VoiceService.ts:73`. Zero code today (blocks north-star live transcript).
- **P0.4** Confirm/open `ProductionModuleGate` on `consultify.ai` (per prior dossier `AppRoutes.tsx:~1961`).

### P1 — Cross-module integrity
- **P1.1** Follow-up → Task handoff: add `Api.createTask` call (`MeetingHub.tsx:491–508` handler) → Moja Praca (02). Currently meeting-local only.
- **P1.2** Cross-post meeting decisions to the shared `decisions` table (`meetingService.ts:357–375`) — fix silo.
- **P1.3** Make `persistNote` reachable + show confirmation (`meetingIntelligenceService.ts:183`) so recaps land in Notebook/Outputs (09).
- **P1.4** Operator brief: upgrade `prepSummary` from hardcoded string (`aiOperatorService.ts:691`) to LLM/Teresa brief that reads org memory + client DNA.

### P2 — Polish / tech-debt
- **P2.1** Replace 9 `(Api as any)` casts with typed calls (`MeetingHub.tsx:105,166,429,443,460,481,494,513,535`). Methods exist (`api.ts:3146–3220`) — purely type-safety bypass.
- **P2.2** Disable edit-save button during pending request (double-submit risk).
- **P2.3** Calendar "+N more" overflow is dead text (`MeetingHub.tsx:~1399`); action-bar lacks `flex-wrap`.
- **P2.4** No real "join meeting" concept — decide whether v1 needs video-link fields (Zoom/Teams/Meet) or stays a planner.
- **P2.5** Zero E2E tests (DB → route → response → cross-module).
