# Cross-Cutting Flows & Navigation Audit
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Auditor:** Claude Code

---

## 1. Flow Map — Door → Spine → Output

```
ENTRY DOORS              SPINE                    OUTPUTS
─────────────────────────────────────────────────────────────
Chat (/chat)         →   Initiatives (/initiatives) → Outputs (/presentations)
Interview (/interview)→  Initiatives              → Outputs
Tools (/discovery-tools) Initiatives             → (no direct link)
Assessment (/assessment)→ Initiatives            → (no direct link)
Finance (/finance)   →   Initiatives (linking)   → Outputs (broken: no relatedInitiativeIds)

                         Execution (/implementation)  (DEAD END — no Results link)
                         Results (/benefits)       → Execution (back-link wired)
                         Results                  → (no Outputs link)
```

---

## 2. Sidebar / Nav Integrity

Every main sidebar item maps to a real mounted view. No item resolves to V4ComingSoonView.

| Sidebar Label   | AppView                  | Route                | Mounted View       | Status |
|-----------------|--------------------------|----------------------|--------------------|--------|
| Chat            | AI_CHAT                  | /chat                | UnifiedChatPanel   | WIRED  |
| My Work         | MY_WORK                  | /my-work             | MyWorkView         | WIRED  |
| Interview       | DISCOVERY_CONSULTANT     | /interview           | InterviewHub       | WIRED  |
| Tools > Library | DISCOVERY_TOOLS          | /discovery-tools     | DiscoveryToolsHub  | WIRED  |
| Tools > Assessment | ASSESSMENT_OVERVIEW   | /assessment          | AssessmentHub      | WIRED  |
| Initiatives     | FULL_STEP2_INITIATIVES   | /initiatives         | InitiativesHub     | WIRED  |
| Execution       | IMPLEMENTATION           | /implementation      | ExecutionHub       | WIRED  |
| Results         | BENEFITS_REALIZATION     | /benefits            | ResultsHub         | WIRED  |
| Finance         | ECONOMICS                | /finance             | EconomicsView      | WIRED  |
| Outputs         | PRESENTATIONS            | /presentations       | ReportsAndPresentationsHub | WIRED |
| Documents       | WORDY                    | /document-studio     | DocumentStudioView | WIRED  |
| Presentations   | PREZENTACJE_GEN          | /prezentacje         | PrezentacjeView    | WIRED  |
| Table Studio    | TABELE                   | /tabele              | TabeleView         | WIRED  |
| Meeting         | MEETING                  | /meeting             | MeetingHub         | WIRED  |

**Orphan routes (mounted but no sidebar entry):**
- `/studio` — accessible via command palette only (`CommandPalette.tsx:195`), no sidebar item. Benign (internal dev tool).
- `/execution` — legacy alias; mounts `FullExecutionView` which wraps `ExecutionHub`. Not in sidebar (sidebar uses `/implementation`). Both render the same component. No user-facing dead-end.
- `/portfolio` — no sidebar entry; reachable via `/roadmap` redirect. Fine as Portfolio tab inside InitiativesHub context.

---

## 3. Handoff Table — Consulting Spine

| Handoff                                    | Mechanism                                                                 | Status   | Evidence |
|--------------------------------------------|---------------------------------------------------------------------------|----------|----------|
| Chat → Outputs (artifact save)             | `navigate('/presentations?tab=all&artifactId=…')` in V8ArtifactRunControl | WIRED    | `V8ArtifactRunControl.tsx:819` |
| Interview → Initiatives                    | `navigate('/initiatives?open=…&mode=doc')` on insight promotion            | WIRED    | `InterviewHub.tsx:2261, 7243` |
| Assessment → Initiatives                   | `AssessmentInitiativesDrawer.navigate('/initiatives?open=…')` + `InitiativesManagementPanel.navigate(…)` | WIRED | `AssessmentInitiativesDrawer.tsx:56`, `InitiativesManagementPanel.tsx:913` |
| Assessment (GapAnalysis) → Initiatives     | POST `/api/initiatives/generate-from-assessments` — endpoint does NOT exist in `api.ts` or backend; component is also **never rendered** (no import) | BROKEN (orphan) | `GapAnalysisDashboard.tsx:59` |
| Tools (Assessment) → Initiatives           | `AssessmentInitiativesDrawer` wired from within AssessmentHub              | WIRED    | see above |
| Initiatives → Results                      | `navigate(ROUTES.BENEFITS)` in InitiativesHub CTA                         | WIRED    | `InitiativesHub.tsx:1530` |
| Initiatives → Execution                    | **No direct CTA button.** Users must click sidebar "Execution" item.      | MISSING  | `InitiativesHub.tsx` — no navigate to /implementation |
| Initiatives → Finance (model)              | `navigate('/economics?tab=models&initiativeId=…')`                        | WIRED    | `InitiativesHub.tsx:1327` |
| Initiatives → Outputs (document link)      | `InitiativeSourceLink.navigate('/presentations?tab=documents')`            | WIRED    | `InitiativeSourceLink.tsx:85` |
| Execution → Results                        | **No CTA/button linking Execution to Results.** Dead-end after task work. | BROKEN   | `ExecutionHub.tsx` — zero `ROUTES.BENEFITS` or `'/benefits'` references |
| Results → Execution (back-link)            | `navigate(ROUTES.IMPLEMENTATION + '?…')` via "Open in Execution" button   | WIRED    | `ResultsHub.tsx:747` |
| Results → Outputs                          | **No direct link.** `ResultsKpiReportsView` navigates to `/reports/builder/:id` only. | MISSING | `ResultsKpiReportsView.tsx:428,530,555` |
| Finance model → Initiatives                | `InitiativeLinkingPanel` renders `href=/initiatives/${id}` — `/initiatives/:id` route does NOT exist; falls through to wildcard → `/chat` | BROKEN | `InitiativeLinkingPanel.tsx:269`, `AppRoutes.tsx:1663` |
| Finance model → Outputs (export)           | ExportButton opens ExportToOutputDialog, `relatedInitiativeIds` prop is **not passed** at call site (`FinancialModelWorkspace.tsx:711`) — link context is dropped | DATA GAP | `FinancialModelWorkspace.tsx:711` vs `ExportButton.tsx:22` |
| Finance model → Economics (valuation)      | `navigate('/economics?tab=valuation&createFrom=financial_model&sourceId=…')` | WIRED | `FinancialModelWorkspace.tsx:719` |
| /rollout → Execution rollout tab           | `RedirectWithTracking` → `/execution?tab=rollout`; ExecutionHub reads `searchParams.get('tab')` | WIRED | `AppRoutes.tsx:1835`, `ExecutionHub.tsx:680` |
| /kpi-okr → Results                         | `<Navigate to={ROUTES.BENEFITS} replace />`                               | WIRED    | `AppRoutes.tsx:1918` |
| /roadmap → Portfolio                       | `<Navigate to={ROUTES.PORTFOLIO} replace />`                              | WIRED    | `AppRoutes.tsx:1682` |
| /context/* → /organization/*              | Full redirect group with sub-path mapping                                 | WIRED    | `AppRoutes.tsx:1527–1599` |
| /wordy → /document-studio                 | `RedirectPreservingQuery`                                                 | WIRED    | `AppRoutes.tsx:1305–1313` |
| /excele → /tabele                          | `RedirectPreservingQuery`                                                 | WIRED    | `AppRoutes.tsx:1315–1325` |
| /ai/work-canvas → /chat                    | `WorkCanvasRedirect` (preserves conversationId/draftId)                   | WIRED    | `WorkCanvasRedirect.tsx:25` |
| MCP IRIS / Marketplace → Chat             | `<Navigate to={ROUTES.AI_CHAT} replace />`                               | WIRED    | `AppRoutes.tsx:2099–2100` |

---

## 4. Deep-Link Alias Resolution

| Alias         | Target                                    | Status |
|---------------|-------------------------------------------|--------|
| /wordy        | /document-studio (query preserved)        | WIRED  |
| /excele       | /tabele (query preserved)                 | WIRED  |
| /prezentacje  | /prezentacje (self — canonical)           | WIRED  |
| /roadmap      | /portfolio                                | WIRED  |
| /context      | /organization (full sub-path mapping)     | WIRED  |
| /kpi-okr      | /benefits                                 | WIRED  |
| /rollout      | /execution?tab=rollout (tab read by hub)  | WIRED  |

---

## 5. Dead-Ends & Loops

| Issue | Location | Severity |
|-------|----------|----------|
| **Execution has no forward link to Results** — user completes tasks, has nowhere to go to see benefits/KPIs | `ExecutionHub.tsx` (entire file) | P0 |
| **Finance → Initiative deep-link is a 404** — `href=/initiatives/${id}` is not a declared route; wildcard sends auth'd users to `/chat` | `InitiativeLinkingPanel.tsx:269` | P1 |
| **Finance export drops initiative context** — `ExportButton` at `FinancialModelWorkspace.tsx:711` never passes `relatedInitiativeIds`, so exported output loses its initiative linkage | `FinancialModelWorkspace.tsx:711` | P1 |
| **Results has no Outputs link** — after KPI review, no button to publish a report; user must know to navigate via sidebar | `ResultsHub.tsx`, `ResultsKpiReportsView.tsx` | P1 |
| **Initiatives has no direct CTA to Execution** — `InitiativesHub` navigates to Finance and Results but not to `/implementation` | `InitiativesHub.tsx` | P2 |
| **GapAnalysisDashboard is orphaned** — the component is exported but never imported; its `POST /api/initiatives/generate-from-assessments` endpoint does not exist | `GapAnalysisDashboard.tsx:59` | P2 (can be deleted) |
| **Suspense hang risk** — only `MyWorkView` uses `lazyWithRetry`; all other 30+ lazy views use `React.lazy` with no retry. Chunk fetch failure = silent spinner. RouteErrorBoundary catches JS errors but not network failures in Suspense | `AppRoutes.tsx:45` (only one) | P3 |
| **`/studio` orphan** — mounted at `/studio` but no sidebar entry; reachable only via command palette. Not a dead-end but undiscoverable | `AppRoutes.tsx:1154`, `CommandPalette.tsx:195` | P3 |

---

## 6. Prioritized Fixes

| Priority | Fix | File | Change |
|----------|-----|------|--------|
| P0 | Add "View Results" CTA in ExecutionHub (e.g., in the header or action bar) | `src/components/Execution/ExecutionHub.tsx` | Add `navigate(ROUTES.BENEFITS)` button |
| P1 | Fix Finance → Initiative deep-link: change `href=/initiatives/${id}` to `navigate('/initiatives?open=${id}&mode=doc')` or add an `/initiatives/:id` catch route | `src/components/Economics/InitiativeLinkingPanel.tsx:269` | Use query-param pattern matching InitiativesHub's `?open=` handler |
| P1 | Pass `relatedInitiativeIds` to ExportButton in FinancialModelWorkspace | `src/components/Finance/FinancialModelWorkspace.tsx:711` | Derive initiative IDs from the model's linked initiatives and pass as prop |
| P1 | Add "Export to Outputs" or "Publish Report" CTA in ResultsHub / ResultsKpiReportsView | `src/components/Results/ResultsHub.tsx` | `navigate('/presentations')` or open ExportDialog |
| P2 | Add "Go to Execution" CTA in InitiativesHub (approved initiatives panel) | `src/components/Initiatives/InitiativesHub.tsx` | `navigate(ROUTES.IMPLEMENTATION)` |
| P2 | Delete or wire GapAnalysisDashboard | `src/components/assessment/GapAnalysisDashboard.tsx` | If kept, fix POST endpoint or remove the component entirely |
| P3 | Wrap remaining `React.lazy` imports with `lazyWithRetry` | `src/routes/AppRoutes.tsx` | Replace ~30 `React.lazy` calls |
