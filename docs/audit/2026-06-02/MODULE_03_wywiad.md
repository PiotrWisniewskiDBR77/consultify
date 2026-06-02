# Module 03 — Wywiad — Readiness Scorecard

**Readiness: 72/100 — Tier: Beta**
**Route(s):** `/interview` (canonical), `/discovery` (legacy alias → same hub), `/project-intelligence` (legacy alias → same hub)
**One-line verdict:** Core session/assignment/insight pipeline is genuinely backend-wired and production-capable, but 8 bulk actions are stubs, the `/interview/templates/evaluate-quality` AI endpoint has no frontend caller, and there are zero frontend component tests.

## What's REAL (verified + backend-wired)

- `src/routes/AppRoutes.tsx:1454,1478,1489` — all three route aliases mount `src/components/Interview/InterviewHub.tsx` (8 839 lines, ModuleHub pattern).
- `src/components/Interview/InterviewHub.tsx:88` — imports `V8InterviewApi`; all 6 tabs (`my_assignments`, `managed`, `sessions`, `templates`, `insights`, `pending_review`) have live `useEffect` data-fetch blocks against real endpoints (lines ~873–1107).
- `server/src/routes/v8/interview.routes.ts` — 83 route handlers covering sessions CRUD, assignment lifecycle (start / submit / remind / send-back / approve), insights CRUD, report-pack workflow (draft → review → publish → export markdown/manifest), context-document upload, insight export to tools/assessment, and insight activity log. All hit real DB via `queryHelpers`.
- `server/src/routes/interview.routes.ts` — 83 additional handlers on `/api/interview/` covering templates (list, create, clone, import-source, evaluate-quality, PATCH, delete), questions, notes, evidence, linked-items, transcript, inference runs, summary, export, and assignments.
- `src/components/Interview/TemplateBuilder.tsx:337,703,977` — template create/clone/import-source all call real `Api.*` endpoints; AI draft flow calls `/interview/templates/import-source`.
- `server/src/services/InterviewAssignmentService.ts`, `InterviewInsightService.ts`, `interviewInferenceService.ts`, `interviewInsightReportPackService.ts`, `interviewManagerScope.ts`, `interviewTranscriptService.ts` — all present and non-trivial service layer.
- `server/src/jobs/interviewReminderJob.ts` — real reminder cron job exists (standalone runner).
- `server/src/routes/interview-enterprise.routes.ts` — mounted at `/api/interview-v4` (`Gateway.ts:907`); implements segments, quotas, distributions, reminder schedules via `interviewEnterpriseService`.
- Backend tests: `server/src/routes/v8/__tests__/interview.routes.test.ts` (1 523 lines), `interview-insights.routes.test.ts` (352 lines), `p10-interview-insight-canon.test.ts`, `interviewInsightCandidateService.test.ts`, `interviewInsightFindingsService.test.ts`, `interviewInsightAnalysisService.test.ts`, `interviewManagerScope.test.ts`.

## What's MOCK / hardcoded / stub

- `src/components/Interview/interviewDemoData.ts` — large synthetic demo dataset injected when `shouldAllowDemoData()` is true (`InterviewHub.tsx:783`). Demo mode is a deliberate dev aid, not production data, but the fallback path is visible to users if org/DB context is empty (`InterviewHub.tsx:6433`).
- `src/components/Interview/InterviewHub.tsx:2262,2276,2429,2537,2552,2673,2687,2799` — **8 bulk-action buttons** are present in the UI but disabled and labelled "…coming soon" in their tooltip: bulk reminder, bulk due-date, selected-sessions export, bulk template clone, bulk template assignment, bulk insight export, bulk Tools export, bulk initiative promotion.
- `src/components/Interview/templateLibraryMeta.ts` — area-tag metadata is static/const; not fetched from backend. Acceptable for now but means adding new tags requires a deploy.

## What's BROKEN / NO_GO / missing

- `/interview/templates/evaluate-quality` route exists on the server (`interview.routes.ts:219`) but **no frontend code calls it** — the AI quality-gate is wired on the server but dead in the UI. Templates can be saved without quality validation.
- `src/components/Discovery/InterviewHub.tsx:10-12` — this file is a thin wrapper that renders `DiscoveryConsultantView` (not the main `Interview/InterviewHub`). It is imported nowhere in routes but exists in the Discovery folder, creating potential confusion. It is not a live regression but represents dead/misleading code.
- No frontend component tests exist for any file in `src/components/Interview/` (confirmed by full `find` scan). The tab render logic (~8 839 lines) has zero snapshot or unit coverage.

## Backend wiring

Real and substantial. Two parallel route trees (`/api/interview/*` and `/api/v8/interview/*`) both hit real SQLite DB tables: `interview_sessions`, `interview_assignments`, `interview_insights`, `interview_report_packs`, `interview_insight_activity`, `interview_insight_audit_log`, `interview_insight_exports`. Permission middleware (`requirePermission`) applied on all sensitive endpoints. V8 context middleware enforces org scoping. Enterprise routes (`/api/interview-v4`) are mounted and service-backed.

## UI/UX consistency

High. `InterviewHub.tsx` explicitly follows the ModuleHub Golden Standard (comment at line 3, `@see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md`). Imports `ModuleHub`, `ModuleMenu3` tokens, `GridView`, `TableWithPreviewLayout`, `RowActionsMenu` from shared shell components — fully compliant with the approved composition pattern. Dark/light theming via Tailwind classes is consistent throughout.

## Tests

**Backend:** strong — 1 875+ lines of Vitest covering V8 session, assignment, insight routes, report-pack, and canon P10 service. Also `interviewManagerScope.test.ts` and three service-level tests.
**Frontend:** none — zero test files under `src/components/Interview/`. The tab-render megafile (8 839 lines) is entirely untested client-side.

## Doc-vs-code drift

Minor but present. Docs (2026-05-09) claim 6/6 functions documented and all "pass". This is accurate for the route/tab surface. Docs do not mention: (1) the 8 stub bulk-action buttons, (2) the dead `evaluate-quality` frontend gap, (3) the confusing `src/components/Discovery/InterviewHub.tsx` wrapper. Doc status "go" is slightly optimistic — the module is Beta, not production-ready.

## Top gaps to reach market-ready (prioritized)

1. **Wire `/interview/templates/evaluate-quality` in TemplateBuilder** — the server AI endpoint exists; add a frontend call on save or as an explicit "Check quality" button in `TemplateBuilder.tsx` to close the quality-gate loop.
2. **Remove or replace the 8 "coming soon" bulk actions** — either implement or hide the disabled buttons; visible "coming soon" labels in the UI are a UX/trust issue for paying users.
3. **Add frontend component tests** — at minimum smoke-render tests for all 6 tab branches in `InterviewHub.tsx` and `TemplateBuilder.tsx`; the 8 839-line hub has zero coverage.
4. **Delete or redirect `src/components/Discovery/InterviewHub.tsx`** — the thin passthrough wrapper diverges from the main hub and can cause developer confusion; clean it up.
5. **Harden demo-data fallback messaging** — the empty-state message at line 6433 leaks internal debug language ("Verify active DB, organization scope, and data-context") to end users; replace with a user-friendly empty state.
