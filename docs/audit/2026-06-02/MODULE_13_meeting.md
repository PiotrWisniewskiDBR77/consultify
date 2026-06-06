# Module 13 — Meeting — Readiness Scorecard

**Readiness: 28/100 — Tier: Alpha**
**Route(s):** `/meeting` — publicly routed but renders `V4ComingSoonView` (gated behind coming-soon placeholder; `MeetingHub` built but NOT mounted)
**One-line verdict:** A complete backend CRUD layer and a fully built `MeetingHub` UI both exist and are wired together, but the route is deliberately blocked by a "coming soon" splash — no user can reach the real UI, making this Alpha at best.

## What's REAL (verified + backend-wired)

- `server/src/services/meetingService.ts:95` — `ensureMeetingTables()` creates `meetings` + `meeting_follow_ups` with indexes via SQLite; fully functional.
- `server/src/routes/meeting.routes.ts:28–155` — Six REST endpoints: `GET /`, `POST /`, `PATCH /:id/status`, `POST /:id/decisions`, `POST /:id/follow-ups`, `PATCH /:meetingId/follow-ups/:followUpId`. All auth-gated, validated, wired to service.
- `server/src/Gateway.ts:502` — `app.use('/api/meeting', meetingRoutes)` is registered and live.
- `src/services/api.ts:2950–3010` — `getMeetings`, `createMeeting`, `updateMeetingStatus`, `addMeetingFollowUp`, `addMeetingDecision`, `updateMeetingFollowUpStatus` all call real endpoints.
- `src/components/Meeting/MeetingHub.tsx:62–1180` — Complete UI: list/calendar views, filter chips, create/decision/follow-up modals, preview pane, operator-brief card. Calls real `Api` methods.
- `server/src/routes/ai-operator.routes.ts:77–92` — `GET /api/ai-operator/meetings/:meetingId/brief` live; backed by `aiOperatorService.getMeetingBrief` (line 638) which queries tasks + decisions tables and constructs a real brief.
- `server/src/ai/actionExecutors/meetingExecutor.ts:19` — AI action executor calls `createMeeting` from service; live for AI-operator-triggered scheduling.

## What's MOCK / hardcoded / stub

- `src/routes/AppRoutes.tsx:2022–2032` — `/meeting` route renders `V4ComingSoonView`, not `MeetingHub`. The entire UI described above is unreachable for users.
- `src/components/navigation/Sidebar/menuConfig.ts:154` — `badge: 'soon'` — confirms intentional gating.
- `server/src/services/ai/meetingIntelligenceService.ts:48` — `llmClient` is `null` by default (`private llmClient: any = null`); `setLLMClient()` is never called from any route or Gateway, so transcript-based note generation always falls back to the weak regex heuristic path.
- `MeetingIntelligenceService.persistNote` (line 183) — writes to `notebook_entries` table but the table schema is assumed to exist; no `ensureTable` guard; silently swallowed on error.
- Calendar view (`MeetingCalendarView`, line 1103) — renders a simple month-grouped list, not a real calendar grid; the `availableViewModes={['table', 'calendar']}` prop in `ModuleHub` surfaces a calendar toggle that leads to this minimal stub.

## What's BROKEN / NO_GO / missing

- **Route not mounted** — `MeetingHub` is imported nowhere in `AppRoutes.tsx`; users see "coming soon". Backend is fully functional but unreachable from product.
- **No transcription pipeline** — No Fireflies, Zoom, Google Meet, or any audio-to-text ingestion route exists in `/server/src/`. `meetingIntelligenceService` exists but has no HTTP entrypoint and its LLM client is never injected.
- **No calendar sync** — Meeting dates are manually typed `datetime-local` inputs only; no Google Calendar / Outlook import for `MeetingHub` (the separate `calendarInteropService` serves the My Work calendar widget, not this module).
- **`getAIOperatorMeetingBrief` client mismatch** — `api.ts:3086` calls `/api/ai-operator/meetings/:id/brief`, but `MeetingHub` calls `Api.getAIOperatorMeetingBrief?.(targetMeetingId)` only when `briefingMeeting` exists — since the route is blocked this is moot, but the `operatorBrief.meetingId` check (line 535) will always fail because the operator brief response does not contain a `meetingId` field (service returns a plain object without it).
- **No edit/update of meeting core fields** — No PUT/PATCH on title, dates, attendees, agenda; only status and appending to arrays. No delete endpoint.

## Backend wiring & integrations

| Layer | Status |
|---|---|
| SQLite schema (meetings + follow_ups) | REAL — auto-migrated on each request |
| REST CRUD routes | REAL — 6 endpoints, auth-gated |
| API client methods | REAL — fully typed, correct URLs |
| AI operator brief | REAL — rule-based, reads project tasks/decisions |
| AI meeting intelligence (transcript→notes) | STUB — LLM client never injected, heuristic fallback only |
| Fireflies / recording integration | MISSING — no code exists |
| Google Calendar / Outlook import | MISSING for this module |
| Notebook handoff from meeting notes | PARTIAL — `persistNote` writes to `notebook_entries` but is never triggered from any live path |

## UI/UX consistency

`MeetingHub` uses the approved `ModuleHub` shell (`@/components/shared/ModuleHub`), `FilterableTable`, `TableWithPreviewLayout`, `PreviewMetaCard`, `ModuleMenu3` tokens — all consistent with the platform design system. The calendar view is a rudimentary list grouping, not a calendar grid, which is below the visual bar set by other modules. Modals are inline bespoke (not a shared `Modal` primitive) but styling is consistent.

## Tests

No dedicated unit or integration tests for `meetingService.ts` or `meeting.routes.ts`. The smoke script `server/scripts/smoke-v3-meeting-runtime.ts` is a file-content assertion script (checks for string presence), not an API test. The only test files that mention "meeting" in their path are calendar-interop and Teresa tests — unrelated to this module's own routes/service.

## Doc-vs-code drift

Docs (STATUS.md, CODEMAP.md, BEHAVIOR.md — all 2026-05-09) accurately describe the As-Is state: placeholder route, `MeetingHub` imported but not mounted, `ME_MEETING_RUNTIME_TARGET` undeployed. **The docs are honest and match reality.** However, `05_DATA_AND_INTEGRATIONS.md` lists "note, source/evidence link" as core objects — neither exists in the actual `meetingService.ts` schema. The intelligence service and executor are not documented in CODEMAP at all.

## Top gaps to reach market-ready (prioritized)

1. **Mount `MeetingHub` on `/meeting` route** — swap `V4ComingSoonView` for `MeetingHub`; remove `badge: 'soon'`; instant unlock of all existing CRUD functionality.
2. **Fix `operatorBrief.meetingId` check** — `MeetingHub.tsx:535` checks `operatorBrief?.meetingId === activeMeeting.id` but the brief response has no `meetingId` field; brief card will always show empty even when data returns.
3. **Add meeting edit (PUT/PATCH core fields)** — no way to change title, dates, attendees, agenda, or pre-read after creation; also add DELETE endpoint.
4. **Calendar view** — replace month-list stub with a real week/month grid; the toggle is surfaced but the experience is below platform standard.
5. **Inject LLM client into `meetingIntelligenceService`** or expose a `POST /api/meeting/:id/generate-notes` endpoint with transcript input; current intelligence service is dead code.
6. **Fireflies / transcription entrypoint** — spec and build webhook or pull-based import; this is the module's core differentiator per original vision.
7. **Add route/service tests** — zero coverage on the 6 CRUD endpoints and `getMeetingBrief`; smoke script does not substitute.
