# Module 03 — Wywiad — Re-Audit (2026-06-03)

**Readiness: 84/100 — Tier: RC (baseline 72 → 84, Δ +12)**
**One-line verdict:** All five baseline gaps are now closed — evaluate-quality is wired, 8 bulk actions are implemented, frontend smoke tests exist, Discovery dead-code is gone, and the empty-state debug leak is sanitised — but 48 `as any` casts remain in the 8 923-line hub and the question-save path is still serial N+1 HTTP.

---

## Functionality (real/mock/broken)

**Real and wired:**
- AI quality gate: `TemplateBuilder.tsx:714` calls `POST /interview/templates/evaluate-quality`; triggered both on explicit "Check quality" (`TemplateBuilder.tsx:737`) and non-blocking after every save (`TemplateBuilder.tsx:833`). Baseline gap is closed.
- Bulk actions: All 8 are implemented. `handleBulkRemind` (InterviewHub.tsx:1149) hits `V8InterviewApi.remindAssignment`; `handleBulkExportSessions` (1188) and `handleBulkExportInsights` (1232) do client-side CSV download; `handleBulkCloneTemplates` (1209) loops `Api.post(…/clone)`. No "coming soon" labels remain.
- Sessions, assignments, insights, templates, initiatives: all 6 tabs backed by live `useEffect` fetches against v8 endpoints (InterviewHub.tsx:1035, 1149+).
- Insight→Initiative handoff: `interview-insights.routes.ts:642` `/insights/:id/findings/:id/handoff` builds a real payload, calls `buildHandoffPayload`, records handoff in DB, and gates on `canPublishFinding` + client readback confirmation.
- `onInsightPublished` bridge (`insightSignalBridgeService.ts`) fires after lifecycle publish (`interview-insights.routes.ts:246`), triggering org-context snapshot rebuild.

**Still mock/partial:**
- AI draft in TemplateBuilder (`TemplateBuilder.tsx:951,1218`) routes through `sendMessageToAI` → `UnifiedAI.sendMessage` — legitimate backend routing, not a stub. No gap here.
- `templateLibraryMeta.ts` area-tags are static const — adding tags requires a deploy; acceptable for v1.
- `interviewDemoData.ts` fallback still active when `shouldAllowDemoData()` is true; gated correctly but demo-mode path visible to orgs with empty DB context.

---

## Intra-module flow & states

**Loading:** `InterviewHub.tsx:6483` — unified spinner on `isLoading || assignmentsLoading`. Per-tab degraded banners shown when individual loads fail (`6516–6537`), not a hard block.

**Error states:** `getSafeInterviewErrorMessage` (`interviewErrorCopy.ts:16`) strips stack traces, SQL fragments, and >180-char strings before surfacing to users. Baseline debug-leak gap is closed.

**Empty states:** `EmptyStateInline` used per-tab. Initiatives tab shows "Go to Insights" CTA (`InterviewHub.tsx:7446`) — confirmed by smoke test `InterviewHub.smoke.test.tsx:152–159`.

**Hang risk:** Tab switches call `Promise.allSettled` (1035), so one failed endpoint does not block the whole hub. Individual loaders (`loadInsights`, `loadTemplates`, etc.) have `try/catch` with `console.error`. No unhandled promise rejection risk observed.

**Dead-ends:** `src/components/Discovery/InterviewHub.tsx` no longer exists — confirmed by `find`. `Discovery/index.ts:9` still carries a "Legacy" comment pointing to `DiscoveryConsultantView`, but that file is not imported in any route.

---

## UI/UX adherence

Fully compliant: `ModuleHub` shell with `persistViewModeKey="interview"` (`InterviewHub.tsx:8527–8563`). Imports `MENU_3_*` tokens from `ModuleMenu3`. Crimson tokens present at 136 occurrences (`bg-crimson-600`, `text-crimson-700`, etc.). Navy tokens used for dark-mode surfaces (`bg-navy-900/70`, `dark:bg-navy-700`). 133 `rounded-*` classes. `aria-selected` on tab buttons confirmed by smoke test assertion (`InterviewHub.smoke.test.tsx:137`). `data-testid="contextual-help-entry-interview"` on help entry (`InterviewHub.tsx:8550`).

---

## Cross-module handoffs

- **Interview → Insights (internal):** `InsightCreatorModal` (`InterviewHub.tsx:8905`) and `InsightViewer` (`5109`) both mounted inline.
- **Insights → Initiatives:** `initiativeWizardSourceBasket` memo (`1630`) populates `InitiativeWizardModal` with up to 10 insights and 10 sessions. `Api.get('/initiatives?source=interview_insight')` hydrates the Initiatives tab (`1040`).
- **Insight publish → org-context rebuild:** `onInsightPublished` hook fires on publish lifecycle (`interview-insights.routes.ts:246`), calling `rebuildOrganizationContextSnapshot` (`240`) — ensures downstream modules (Assessment, Document Studio) see fresh context.
- **Legacy `/api/interview` route** carries `deprecationHeader('/api/v8/interview')` (`Gateway.ts:920`), so clients migrating to v8 get a response header warning without a breaking change.

---

## Risks / regressions / runtime

1. **N+1 save in TemplateBuilder** (`TemplateBuilder.tsx:786–817`): deletes run serially in a `for…of` loop, then each question is individually POSTed or PATCHed. A template with 20 questions triggers 21+ sequential HTTP calls. For v1 demo scale this is acceptable but will be visible on slow connections.
2. **48 `as any` casts** in `InterviewHub.tsx` — most are status-enum normalisation (`status: 'DRAFT' as any`). No `@ts-nocheck` present, but the casts suppress type-checking on insight/session status fields. Risk: a backend status string change silently passes TS without error.
3. **Bulk remind is serial** (`InterviewHub.tsx:1154–1161`): `for…of` with `await remindAssignment(id)` — tolerable for small selections, but selecting all managed assignments could time out on large orgs.
4. **`onInsightPublished` failure is swallowed silently** (`interview-insights.routes.ts:246`): `.catch((err) => logger.warn(…))` — the lifecycle publish still returns 200, but downstream context rebuild is silently skipped. A monitoring alert or retry would reduce risk.
5. **No frontend CI gate**: two smoke test files exist (`InterviewHub.smoke.test.tsx`, `TemplateBuilder.smoke.test.tsx`) but they are not confirmed wired into the CI config — no evidence of a vitest/jest run in the project's CI scripts referencing them. If tests are not run they provide no safety net.

---

## Top remaining gaps

1. **Batch question save** — replace serial `for…of` in `TemplateBuilder.tsx:786` with a single `PATCH /interview/templates/:id/questions/batch` endpoint call; eliminates N+1 on save.
2. **Status enum type safety** — replace `as any` casts on status fields with a shared `InterviewStatus` enum; 48 casts are a maintenance liability.
3. **CI wiring for frontend smoke tests** — confirm `vitest` picks up `src/components/Interview/__tests__/*.test.tsx`; add to the CI matrix so regressions are caught automatically.
4. **Bulk remind concurrency** — replace serial `for…of` with `Promise.allSettled` across all bulk loops (`handleBulkRemind`, `handleBulkCloneTemplates`).
5. **`onInsightPublished` observability** — add a metric/retry on context-rebuild failure so silent skips are surfaced.
