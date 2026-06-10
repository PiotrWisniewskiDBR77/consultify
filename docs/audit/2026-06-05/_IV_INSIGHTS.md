# Interview Module — Insights Tab — Code-Verified Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** The Insights tab (`InterviewTab === 'insights'`) of the Interview module — list (flat + report views), create (InsightCreatorModal), the InsightViewer drill-down (themes/issues/opportunities + P10 candidates→findings→evidence→readback→handoff), publish lifecycle, export to Tools/Assessment, report pack (draft→submit→publish→markdown), comments + activity.
**Method:** Read / Grep / Glob only. No code modified.

---

## Score: 88 / 100

This is the most rigorous, most complete feature in the Interview module and likely one of the strongest in the platform. The P10 findings governance pipeline is real end-to-end (UI → V8 API → service → DB → downstream materialization). The InsightViewer is large (5991 lines) but **coherent**, not sprawling. Points are lost for: residual Gen-1 dead weight bleeding into a live read path (export column-sniffing), native `confirm()` dialogs inconsistent with the rest of the platform's modal UX, a stale legacy `/interview/insights` fetch-fallback layer that doubles every mutation, and a few cosmetic/i18n placeholders. None of these block GA, but several are cheap to clean.

**Why not higher:** the Gen-1/Gen-3 column-sniffing `try/catch` at `interview.routes.ts:1192-1209` is a live read path inside the export endpoint (not dead like InsightPackView), and it's a loaded gun against schema drift. **Why not lower:** every primary user flow works against real backends with real gating, real AI generation, real downstream entity creation, honest empty/degraded states, and no mock data in the hot path.

---

## TL;DR Verdicts

| Question | Verdict |
|---|---|
| **InsightPackView dead?** | **YES — confirmed zero importers.** `grep InsightPackView src/` returns only the file itself. Safe to delete. |
| **P10 findings end-to-end?** | **YES — works end-to-end in the UI.** candidates(auto-backfill)→triage→promote→evidence(tombstoning)→readback gate→handoff(creates real initiative/decision/task). |
| **InsightViewer coherence?** | **COHERENT.** 5991 lines, but it's one component over a 21-section `nModeSectionsWithContent` switch; each `case` is self-contained. Not a sprawling mess. |
| **List loads (flat + report)?** | **YES, both.** Flat = single table; report = grouped-by-source-session-count with a "General" bucket sorted last. |
| **Create real generation?** | **YES.** InsightCreatorModal → `V8InterviewApi.createInsight` → service gates non-approved sessions → async AI generation (V6 truth model, `llmService.generateResponse`). |
| **Lifecycle gated on readback?** | **YES.** Publish requires ≥1 finding, every finding `canPublishFinding`, AND `readback_status === 'confirmed_by_client'`. |
| **Report pack draft→publish→markdown?** | **YES.** All wired to real endpoints; D3 (findings_p10 un-stub) + D4 (markdown tables) confirmed in service. |
| **Export Tools/Assessment?** | **YES.** Materializes real `tool_sessions` / `assessments` rows with bounded P10 payload + org context (D1/D2 sealed). |
| **Comments + activity?** | **YES.** Real tables + endpoints (`/insights/:id/comments` GET/POST/DELETE, `/insights/:id/activity` GET). |
| **Anything stubbed?** | **No live stubs found.** The only previously-stubbed pieces (findings_p10 worksheet, report markdown) are now real per D3/D4. |

---

## What Works (verified)

### List view (InterviewHub.tsx)
- **Both view modes render.** `insightsViewMode: 'flat' | 'report'` (state `InterviewHub.tsx:625`). Flat renders `renderInsightsTable(insightsForTable)` (`6886`). Report groups by source-session count via `getReportGroupKey` (`6670`), sorts groups numerically with "General"/"Ogólne" forced last (`6694-6709`), renders one sub-table per group (`6874`). View toggle is a proper radio group (`8311-8323`).
- **Table is a real resizable/filterable data grid.** Columns: select, title, type, status, source, date, actions (`3789-3797`). Per-column resize with min/max bounds (`3821-3843`), header filter dropdowns for type + status (`3931-3973`), column hide via view-settings popover (`4000-4014`, with click-outside + Escape handling at `729-747`), persisted hidden columns + row-description toggle in localStorage (`626-631`).
- **Status badges are coherent and shared.** Row status maps `reviewStatus` (in_review/published) over base `status` → `getStatusStyle` (`4097-4145`). Six states: draft, generating, completed, in_review, published, failed. Status dot + pill consistent with Initiatives/Sessions tabs (same `getStatusStyle` helper).
- **Selection + bulk.** Per-row checkbox + select-all-visible with indeterminate state (`3886-3907`, `4176-4198`).
- **Preview pane.** `TableWithPreviewLayout` with `InterviewInsightPreviewBody` + `InterviewInsightPreviewFooter` (`6733-6858`). Footer offers Open / Export-to-Tools / Copy-link.
- **Empty state is honest and actionable** (`4373-4401`): Lightbulb icon, explanatory copy (PL/EN), "Generate AI Insights" CTA gated on `canCreateInsights`.
- **Loading/error.** `insightsLoadError` surfaced via `getTabError` (`6515`); degraded banner via `renderDegradedBanner()` (`6903`). Initial load is part of the tab-level `Promise.allSettled` fan-out (`1032-1059`).
- **Row actions** (`4300-4366`): Open, Export to Tools (disabled once `exportedToTools`), Export to Assessment (disabled once `exportedToAssessment`), Download (.md blob), Delete. All wired.

### Create (InsightCreatorModal.tsx, 2037 lines)
- Calls `V8InterviewApi.createInsight` (`886`) with `source_scope_status: 'approved_only'` (`910`), falling back to `Api.post('/interview/insights')` (`938`).
- Source sessions loaded from `/interview/sessions/completed` (`667`, `1077`) — **only approved/completed sessions are selectable**; empty-state copy "No approved completed sessions" (`1589`).
- Context modes (`selected_material_plus_approved_org_knowledge`), context-document upload, topic focus, consultant note, leading question — all real form state feeding the create payload.
- `onSuccess` refreshes the list via `listInsights` (`InterviewHub.tsx:8891-8897`).

### Backend generation (InterviewInsightService.ts:1477 `create`)
- **Hard eligibility gate** (`1491-1509`): `loadEligibleSessionIds` filters to approved/completed; any rejected session → 409 `INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED`. Mirrors the route-level guard.
- Sets `status='generating'` (`1654`), then runs **real AI generation** (V6 three-layer truth model): `llmService.generateResponse({ prompt, temperature: 0.3, maxTokens: 4000, model: 'standard', systemPrompt })` (`2105`). System prompt enforces evidence-bounding and forbids minting downstream action plans (`2098-2103`) — consistent with the candidate/finding governance model.
- InsightViewer polls generation status every 3s (visibility-gated, capped at ~75s / 25 ticks) and does a heavy refresh on completion (`949-1026`).

### InsightViewer (5991 lines) — drill-down
- **21 sections** via `INSIGHT_SECTIONS` (`412-461`) rendered through `nModeSectionsWithContent` (`2312`), each a `case` in a single switch (33 `case` labels total counting sub-switches). Sections: Next Actions, Truth & Review, Executive Summary, Consulting Readout, Material Quality, Report Pack, Candidate Triage, People, Source Pack, Analysis Matrix, Themes, Issues & Risks, Opportunities, Signals, Evidence Map, Traceability, Full Analysis, Source Sessions, Comments, Activity Log.
- Loaders are isolated, defensive `useCallback`s with `.catch(() => fallback)`: `loadPersistedFindings`, `loadCandidates`, `loadInsightAnalysis`, `loadSourcePack`, `loadReportPack`, `loadReportReadiness` (`571-635`).
- Loading → `<LoadingState variant="spinner">` (`5719`); error → AlertCircle + message + back button (`5722-5731`); generating → "AI is generating insights..." (`5478-5482`). All three states present and distinct.
- Demo fallback path (`applyDemoInsight`, `823-855`) only triggers on demo IDs or hard load failure — does **not** mask live data.
- Action bar (`5756`): Regenerate, Export Tools/Assessment/Notebook (all disabled unless `status==='completed'`), Markdown, Copy, lifecycle transitions.

### P10 Findings governance — END-TO-END VERDICT: ✅ WORKS

This is the differentiator and it is real at every layer.

**Candidates (auto-backfill):**
- `listCandidates` (`interviewInsightCandidateService.ts:315`) calls `ensureBackfilledCandidates(insightId)` first (`317`), which derives candidates from `buildInsightAnalysis(insightId).topics` (`237-243`) and INSERTs them (`276`). So opening the Candidate Triage section auto-populates the working layer from the generated analysis — no manual seeding.
- UI: Candidate Triage section (`InsightViewer.tsx:4763`) shows summary cards (total/ready/needs-evidence/needs-split, `4816-4848`), per-candidate cards with triage-status badge, confidence hint, followup type, linked topic + linked finding (`4853-4884`), governance Callout ("Candidates are not publishable truth", `4803-4814`).

**Triage:**
- `handleCandidateAction` (`InsightViewer.tsx:1835`) → `V8InterviewApi.triageCandidate` → route `POST /insights/:id/candidates/:cid/triage` (`interview-insights.routes.ts:320`) → `triageCandidate` / `promoteCandidateToFinding` service.
- `mark_ready_for_review` is **gated server-side** (`candidateService.ts:360-377`): blocked if topic has zero persisted evidence, blocked if contradicted. Honest error returned to toast.
- After each action the UI reloads candidates + findings + analysis + source-pack + activity (`1855-1864`).

**Promote → Finding:**
- `promote_to_finding` routes to `promoteCandidateToFinding` (`routes:355-369`) with statement/confidence/limits/next_action; returns both candidate + finding.

**Evidence pointers (tombstoning):**
- `addEvidencePointer` / `removeEvidencePointer` imported and routed (`findings/:fid` PATCH at `routes:516`). Removal is soft (tombstone) — confirmed everywhere active evidence is computed as `evidence_pointers.filter(p => !p.isTombstone)` (export `1298`, handoff `728`, report-pack worksheet `715`). Exports never silently lose provenance.

**Client-readback gate:**
- `handleReadbackStatus` (`InsightViewer.tsx:1906`) → `updateFindingReadback` → `PATCH /findings/:fid/readback` (`routes:602`). Six readback states with default summaries (`1911-1918`).
- **Publish gate** (`routes:173-203`): requires ≥1 finding, every finding passes `canPublishFinding` (confidence/evidence/limits/next_action canon), AND `readback_status === 'confirmed_by_client'`. Returns precise codes: `P10_FINDINGS_REQUIRED`, `P10_FINDING_NOT_PUBLISHABLE`, `P10_READBACK_REQUIRED`.

**Handoff (D5 — creates real entities):**
- `handleHandoffSubmit` (`InsightViewer.tsx:1682`) → `V8InterviewApi.handoffFinding` → `POST /findings/:fid/handoff` (`routes:641`).
- Server re-checks readback==confirmed (`671-678`) AND `canPublishFinding(..., 'handoff')` (`680-694`) before doing anything.
- **D5 confirmed:** when no `target_initiative_id` is linked, it imports the canonical service and creates a REAL entity (`748-816`): `decisionService.createDecision` / `TaskService.createTask` / `initiativeService.createInitiative`, with title = finding statement and body = limits + next action + evidence summary. Returns a real `url` for navigation. No orphan `handoff_req_*` placeholders.
- Records the handoff (`recordHandoff`, `822`) AND registers an org-context source with confidence-weighted claims (`829-870`).
- UI handoff has retry (×2 with backoff), and distinct toasts for 403 / 422-HANDOFF_BLOCKED / network (`1716-1762`).

**Lifecycle (submit→approve/reject→revert):**
- `handleLifecycleTransition` (`InsightViewer.tsx:1771`) maps UI actions to backend actions (`submit_review→submit_for_review`, etc., `1774-1780`) → `POST /insights/:id/lifecycle` (`routes:135`).
- Server: `requirePermission('INTERVIEW_INSIGHTS_REVIEW')`, extra `INTERVIEW_INSIGHTS_PUBLISH` check on publish/approve (`157-171`), the findings/readback publish gate (`173-203`), and `validateLifecycleTransition` state-machine check (`206-213`). On publish: rebuilds org-context snapshot + fires `onInsightPublished` signal bridge (`238-250`) + emits notifications (`252-259`).

### Report Pack (draft→submit→publish→markdown)
- `loadReportPack` / `loadReportReadiness` on insight open (`875-876`).
- `handleSubmitReportForReview` (`671`), `handlePublishReportPack` (`707`), `handleExportReportManifest` (`741`, JSON download), `handleExportReportMarkdown` (`769`, .md download), `handleCreateReportRevision` (`796`) — all wired to real `V8InterviewApi` methods (confirmed present in `src/services/api/v8/interview.ts`).
- Report-pack section UI (`InsightViewer.tsx:2838`) shows worksheet status counts (generated/degraded/partial) and a readiness verdict label (`PASS` / `PASS_WITH_P2` / `BLOCKED_P1`, `2849-2861`) — empty/degraded worksheets shown explicitly per the Callout (`2868-2870`).
- **D3 confirmed** (`interviewInsightReportPackService.ts:695-741`): `findings_p10` worksheet now renders governed findings as rows (statement/confidence/limits/nextAction/readback/evidenceCount/evidence), with an honest degraded warning when no confirmed findings exist. No longer "attached in the next phase".
- **D4 confirmed** (`358-407`): `buildWorksheetMarkdown` → `renderRowsAsMarkdownTable` renders rows as a real Markdown pipe-table, not ```json fences. Markdown export hashed (`348`).
- Review gate: completeness < 80% blocks review (`897`).

### Export to Tools / Assessment (D1/D2)
- `POST /insights/:id/export` (`interview.routes.ts:1178`), `requirePermission('INTERVIEW_INSIGHTS_HANDOFF')`.
- **Approval gate** (`1229-1255`): if the source session has an assignment, that assignment must be approved/completed; else the session must be completed. 409 otherwise.
- **Tools** (`1310-1388`): creates a real `tool_sessions` row (`dynamic-swot`) with `context_snapshot` = bounded P10 payload + resolved org context. **D2 confirmed**: org context is mirrored under both `organizationContext` and `org` keys because `ToolInitiativeService` reads `context.org` (`1343-1346`).
- **Assessment** (`1391+`): creates a real `assessments` row analogously.
- Idempotent: re-export returns the existing target_id and flips the `exported_to_*` flag (`1265-1287`).
- Frontend navigates to the created Tool/Assessment (`InsightViewer.tsx:1616`, `1640`).

---

## InsightPackView — DEAD (confirmed)

`grep -rn "InsightPackView" src/ --include=*.tsx --include=*.ts` returns **only** `InsightPackView.tsx` itself. Zero importers. It is Gen-1 (inference + `fetch('/api/interview/insights')` + `/inference/run`). **Safe to delete** (1004 lines). This matches the prior structured-core audit verdict.

---

## InsightViewer Coherence — COHERENT (not a mess)

Despite 5991 lines, the file is well-architected:
- Single component, single render path: `<NModeShell sections={nModeSectionsWithContent} .../>` (`5734-5752`).
- All 21 sections are produced by one memoized switch (`nModeSectionsWithContent`, `2312`) keyed on section id; each `case` builds a self-contained `component`. No tangled cross-section state.
- Handlers are grouped logically at the top (loaders `571-635`, report-pack `671-823`, save/chat/export `1469-1664`, P10 governance `1666-1948`, comments `1959-2113`).
- Clear domain typing throughout (`V8InsightFinding`, `V8InsightCandidate`, `V8InsightAnalysis`, `V8InterviewReportPack`, `P10ReadbackStatus`, etc.).
- Honest degraded/empty states in every data section (Callouts + explicit warnings).
- The size is driven by **breadth of legitimate governance surface** (21 sections, each with rich consulting-grade UI), not by duplication or dead code.

The cost of the size is reviewability/testability and merge-conflict risk, not incoherence. A future refactor could extract section renderers into co-located components (see L-1), but it is not a correctness problem.

---

## Findings

### P0 — none

No GA-blocking defects found in the Insights feature. (The Gen-1 column-sniffing below is P1, not P0, because the live `try/catch` currently degrades gracefully against the Gen-2 schema.)

### P1

**P1-1 — Gen-1 column-sniffing on a LIVE read path (export).**
`server/src/routes/v8/interview.routes.ts:1192-1209`. The export endpoint first `SELECT ... category, description, insight_type ...` (Gen-1 columns) and only on throw falls back to the Gen-2 SELECT. Unlike InsightPackView (dead), this is reached on **every** insight export. It works today because the `try/catch` degrades, but it is schema-drift fragile and re-introduces dead Gen-1 column semantics into a live flow (`insightRow.category`, `insightRow.insight_type` are read downstream at `1335-1338`, `1416`). **Fix (S):** collapse to the Gen-2 SELECT only; source `category`/`type` from `prompt_type`. Bundle with the Gen-1 kill.

**P1-2 — Double-fetch fallback layer doubles latency/load on every mutation.**
Throughout InterviewHub + InsightViewer, mutations and refreshes follow the pattern `await V8InterviewApi.X().catch(() => Api.<legacy>('/interview/insights...'))`. Examples: `InterviewHub.tsx:3718-3719`, `3723-3725`, `3735-3736`, `3761-3762`, `5114-5116`, `8893-8895`; `InsightViewer.tsx:862-864`, `1607-1608`, `1784-1786`, `1792-1794`. The V8 API is the canonical path now; the legacy `/interview/insights` fallbacks are an extra HTTP round-trip on the unhappy path and obscure real failures (a V8 error silently retries against a possibly-different legacy contract). **Fix (M):** drop the legacy `Api.get/post('/interview/insights')` fallbacks once V8 is confirmed always-mounted, or gate them behind a single feature flag.

**P1-3 — Status taxonomy split across two fields causes filter/badge skew.**
`filteredInsights`/`insightsForTable` filter status by coalescing `reviewStatus` (only when `in_review`/`published`) over `status` (`InterviewHub.tsx:1552-1561`), but the row badge does the same coalescing independently (`4097-4101`), and the flat-list status filter options include all six states (`1533-1540`). A `failed`-status insight that has `reviewStatus: 'in_review'` will badge as "In Review" but is filterable under both — the two-field model is correct but the coalescing logic is duplicated in 3 places and easy to drift. **Fix (S):** derive one `effectiveStatus` helper and use it for filter + badge + group.

### P2

**P2-1 — Native `confirm()` dialogs are inconsistent with platform modal UX.**
`InterviewHub.tsx:3752` (delete insight) and `InsightViewer.tsx:2036` (delete comment) use browser `confirm()`. The rest of the platform uses styled modals. Visual + a11y inconsistency. **Fix (S):** route through the shared confirm-modal primitive.

**P2-2 — "Copy link" copies the title, not a link.**
`InterviewHub.tsx:6855` `onCopyLink={() => copyToClipboard(item.title || '')}` — labeled "Copy link" but copies the title string. Misleading. **Fix (S):** copy `/interview?insightId=<id>` (the deep-link the URL-open effect at `1392-1401` already consumes).

**P2-3 — Hardcoded AI suggestion chips in the preview pane.**
`InterviewHub.tsx:6796-6814` ("Summarize / Extract risks / Next steps") build client-side prompt strings; `onDetailsAction` only handles `copy` and `copy-summarize-prompt` (`6835-6841`) — the "risks"/"next" chips have no wired action beyond prompt-copy. Borderline placeholder. **Fix (S):** either wire all three to the AI panel or drop the unwired ones.

**P2-4 — Download (.md) row action emits Gen-1-shaped frontmatter.**
`InterviewHub.tsx:4344-4348` builds markdown from `promptType || insightType || 'summary'` and `insight.content`. For P10-governed insights this misses findings/evidence — it's a thin export vs. the rich report-pack markdown export. Acceptable as a quick dump but inconsistent with the governed export. **Fix (S):** point row Download at the report-pack markdown export when a report pack exists.

**P2-5 — Mixed-language inline labels.**
`InsightViewer.tsx:4052,4305,4552` render `isPolish ? 'Inicjatywa' : 'Handoff'` — the PL and EN strings are semantically different words ("Initiative" vs "Handoff"), not translations. Minor i18n smell. Also `4231` renders `'cross-role'` for both languages. **Fix (S):** align the bilingual pairs.

**P2-6 — `getReportGroupKey` mislabels singular in Polish.**
`InterviewHub.tsx:6678-6679`: English pluralizes (`session`/`sessions`) but Polish always uses `'sesji'` (genitive plural) even for count 1. Cosmetic grammar. **Fix (S):** add the PL singular form.

---

## Ranked Recommendations

### Small (S)
1. **[P1-1] Kill Gen-1 column-sniffing in export** (`interview.routes.ts:1192-1209`) — collapse to Gen-2 SELECT. Pairs with the platform-wide Gen-1 deletion.
2. **Delete `InsightPackView.tsx`** (1004 lines, zero importers) — confirmed dead.
3. **[P1-3] Single `effectiveStatus` helper** — dedupe the status coalescing across filter/badge/group.
4. **[P2-1] Replace `confirm()`** with the shared confirm-modal (2 call sites).
5. **[P2-2] Fix "Copy link"** to copy the `?insightId=` deep link.
6. **[P2-3/P2-4/P2-5/P2-6]** Cosmetic/i18n cleanups (AI chips, .md download, bilingual labels, PL pluralization).

### Medium (M)
1. **[P1-2] Remove legacy `/interview/insights` fetch fallbacks** once V8 mount is guaranteed (or flag-gate them) — eliminates the double-round-trip and the silent contract-swap on errors. ~10 call sites across InterviewHub + InsightViewer.
2. **Add status/lifecycle column to the list** — the list shows base `status` + a coalesced badge, but the review lifecycle (draft/in_review/published) is the consequential dimension for the publish gate. Surface it as a first-class, sortable column.
3. **Wire row-level "Export to Tools/Assessment" toast + navigation** to match InsightViewer's behavior (InsightViewer navigates to the created entity; the list row action only refreshes).

### Large (L)
1. **Refactor InsightViewer's 21-section switch into co-located section components** (`InsightViewer/sections/*`). Purely structural — improves reviewability, testability, and conflict surface. No behavior change. Lowest priority; the file is coherent as-is.
2. **Complete the Gen-1 retirement** (cross-feature): delete `interviewInferenceService.ts`, `/inference/*` routes, Gen-1-only columns, and author one migration defining `interview_insights` as exactly the Gen-2/Gen-3 column set. Removes the loaded gun behind P1-1 and the InsightPackView delete.

---

## Files Reviewed

**Frontend:**
- `src/components/Interview/InterviewHub.tsx` (8903 lines — insights tab: state `620-657`, filters `1494-1563`, handlers `1334-1401`/`3715-3770`, table `3773-4406`, render `6668-6906`, InsightViewer mount `5108-5129`, InsightCreatorModal mount `8885-8898`)
- `src/components/Interview/InsightViewer.tsx` (5991 lines — full)
- `src/components/Interview/InsightCreatorModal.tsx` (2037 lines — create flow)
- `src/components/Interview/InsightPackView.tsx` (1004 lines — DEAD, importer check only)
- `src/services/api/v8/interview.ts` (921 lines — method presence verified)

**Backend:**
- `server/src/routes/v8/interview-insights.routes.ts` (884 lines — full: lifecycle, source-pack, candidates, triage, analysis, findings, readback, handoff)
- `server/src/routes/v8/interview.routes.ts` (1820 lines — insights list/get/create/export/comments/activity)
- `server/src/services/InterviewInsightService.ts` (2460 lines — create `1477`, AI generation `2053-2123`)
- `server/src/services/v8/interviewInsightFindingsService.ts` (1365 lines — referenced via routes)
- `server/src/services/v8/interviewInsightCandidateService.ts` (513 lines — backfill `227-326`, triage gate `360-377`)
- `server/src/services/interviewInsightReportPackService.ts` (1537 lines — D3 findings_p10 `695-741`, D4 markdown `358-407`, readiness gate `897`)
