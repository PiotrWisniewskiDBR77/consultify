# Module 09 — Outputs — Completion-to-100% Dossier

**Date:** 2026-06-03  
**Score baseline:** 62/100 (2026-06-02) → 78/100 (2026-06-03 audit)  
**Target:** 100% (goal-vision complete, not MVP)

---

## Purpose / Goal / Vision

Canonical end-of-spine library where **every governed artifact** — Teresa-generated reports/decks, human-authored documents, and table exports — lands, awaits review approval, and is exported. The far vision: one unified library replacing format-lane fragmentation; Teresa generates → artifact enters library → review gate → export to PDF/PPTX/DOCX/XLSX. Artifact lifecycle (draft → review → approved → exported → archived) is enforced, with lineage traceable back to originating conversation, assessment, or initiative.

Routes: `/presentations`, `/presentations/builder/:deckId`, `/presentations/wizard`, `/reports/builder`, `/reports/builder/:reportId`.

---

## Readiness: 78/100 — Delta gaps to 100%

### What is real and working (verified in code)

- `useRapData.ts` hooks wire to real `/api/artifacts` — no demo fallback on 404 (`useRapData.ts:187–389` — DEMO arrays wrapped in `/* */` comment block, never executed)
- `isExportApproved()` client-side guard blocks PDF/PPTX export when `publishState` ∉ {approved, published} (`useRapData.ts:149–168, 1422–1460`)
- `exportReportPdf` → `GET /api/report-builder/:id/export/pdf` (pdfkit); `exportDeckPptx` → `GET /api/presentations/decks/:id/download` (pptxgenjs) — real binaries
- `UnifiedExportService.ts:50–168` — renderPdf/renderPptx/exportDocx/exportXlsx backed by real libraries
- Server hard gates: `enforceNoLegalHold`, `ensureConfidentialityPolicy` in `presentations.routes.ts:1413–1529`
- Teresa→Outputs pipeline: `V8ArtifactRunControl.tsx:819` — "View in Outputs" button navigates to `/presentations?tab=all&artifactId=<id>` on run completion; `tab=all` correctly resolves to `outputs_all` via `outputsLibraryTabQuery.ts:22`
- `ArtifactRunsApi.createFromChat()` in `src/services/api/artifactRuns.ts:116–129` wires `POST /api/artifact-runs/from-chat`
- Empty-state Teresa CTA: `OutputsAggregateTabContent.tsx:671–694` — "Generate with Teresa" opens chat with output-generation context (`openTeresaForOutput` at line 191)
- Format-lane clean-up: `/wordy` → `/document-studio`, `/excele` → `/tabele`, `/prezentacje` ungated real view (`AppRoutes.tsx:1304–1344`)
- DIA-P1-001 resolved: `routeConfig.ts:346` maps `AppView.FULL_STEP6_REPORTS` → `/reports/builder`
- i18n: all required `rap.*` keys present in both EN and PL (`public/locales/en/translation.json:8858`, `public/locales/pl/translation.json`)
- Tests: 14+ hook tests, 7 hub routing tests, 8 UnifiedExportService tests, Playwright e2e smoke (`tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts`), `artifacts.draftPath.test.ts` covering from-chat route

### Gaps to 100%

**G1 — DEMO comment block not deleted** (`useRapData.ts:187–389`) — dead code in production file. Low risk but creates confusion and misrepresents codebase health. The plan called for deletion in P0-4; comment wrapper was a partial fix.

**G2 — `outputs_documents` and `presentations` tabs still rendered** (`ReportsAndPresentationsHub.tsx:160–169`) — plan P0-5 required removing these tabs from the hub bar (they expose format-level sub-tabs instead of unified governance tabs). Both still render. `outputs_documents` maps to the legacy `ReportsTabContent` (report-builder rows only); `presentations` maps to `PresentationsTabContent` (deck-only). The unified `OutputsAggregateTabContent` (outputs_all/mine/review) is correct but 3 of 7 tabs bypass it.

**G3 — `tab=documents` in wild stale deep links** (`InitiativeSourceLink.tsx:85`, `CommandPalette.tsx:164`) — both navigate to `?tab=documents`. `outputsLibraryTabQuery.ts:27` maps `documents → outputs_documents` so they won't 404, but they land on the format-tab rather than the governed aggregate view. Low severity, cosmetic drift.

**G4 — Approval gate backward-compat hole** (`useRapData.ts:165–168`) — `isExportApproved` returns `true` when governance is absent (legacy rows without registry entry). An old report without `publishState` can be exported regardless of its local `canExport` flag. Server gate is the only hard stop.

**G5 — Document Studio → Outputs handoff absent** — `DocumentStudioView.tsx` has no "Send to Outputs Library" / "Publish artifact" action. Documents authored in Document Studio do not flow into the Outputs hub. This is the central missing link for the vision of a unified artifact library. No API call to `/api/artifacts/start-review` from Document Studio.

**G6 — `SheetsTabContent` shows static empty-state placeholder when `error=true`** — `SheetsTabContent.tsx:38–59` only enters the `OutputsAggregateTabContent` path when `error` is truthy (because `error` is in the condition); the static card below (lines 62–89) renders only on empty+no-error, so the error state is handled. But there is no retry CTA in the static empty state — only a description paragraph. Not a blank screen (plan's risk is mitigated) but no action affordance.

**G7 — No E2E round-trip test: Teresa → materialize → Outputs hub deeplink** — `tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts` tests Mine tab data loading only. The full `from-chat → accept-plan → materialize → "View in Outputs" → hub shows artifact` chain has no end-to-end test.

**G8 — Templates tab empty-state lacks CTA** — `TemplatesTabContent` returns empty list with no "Create template" or "Upload template" CTA when canonical endpoint returns 0 results. Correct empty state text exists but no action.

**G9 — `openTeresaForOutput` does NOT call `ArtifactRunsApi.createFromChat`** — The "Generate with Teresa" CTA opens chat with context (`OutputsAggregateTabContent.tsx:191–201`) but does not POST to `from-chat`. The user must manually navigate the chat and trigger a run. P1-1 (client hook wiring `from-chat` to a toolbar button) remains unshipped.

---

## Teresa Integration

**Implemented:** `V8ArtifactRunControl` handles plan→accept→materialize loop; on completion with `outputType ∈ {report, presentation}` shows "View in Outputs" button → navigates to `/presentations?tab=all&artifactId=<id>` (`V8ArtifactRunControl.tsx:805–828`). Server route `POST /api/artifact-runs/from-chat` is live. `ArtifactRunsApi.createFromChat()` client wrapper exists (`src/services/api/artifactRuns.ts:116`).

**Missing:** `openTeresaForOutput` (empty-state CTA) opens chat without auto-triggering a run — user must manually type goal. No toolbar button in `UnifiedChatPanel` that calls `ArtifactRunsApi.createFromChat()` directly and opens the run control inline. The one-click "Generate report" experience (Teresa hears goal → run appears immediately in control panel) is not wired. This is the P1-1 gap.

**Depth score: 7/10** — pipeline exists and navigates; auto-trigger from Outputs empty-state is the last missing link.

---

## System Integration

| Handoff | Status | Evidence |
|---|---|---|
| Teresa (Chat) → Outputs | Wired: materialize → deeplink | `V8ArtifactRunControl.tsx:819` |
| MyWork → Outputs | Wired: `presentationsTabQueryForHomeBridge` | `MyWorkHub.tsx:1991–1999` |
| Assessment → Report Builder | Wired | `AssessmentHub → navigate('/reports/builder/:id')` |
| Finance → Reports | Wired | `FinanceHub.tsx:2361`, `ExportButton.tsx:38` |
| Initiatives → Outputs | Stale deep link | `InitiativeSourceLink.tsx:85` → `tab=documents` (resolves but lands on format tab) |
| Document Studio → Outputs | **ABSENT** | No publish/register-as-artifact action in DocumentStudio |
| Table Studio (Tabele) → Outputs | Partial | `TabeleView.tsx:389` → `/presentations?tab=sheets`; no auto-artifact registration |
| Canvas → Outputs | Via V8ArtifactRunControl in WorkCanvasShell | `WorkCanvasShell.tsx:1173` |

Critical gap: Document Studio has no path to push a completed document into the Outputs library. Users must manually navigate there and hope the document is registered in the artifact registry — which only happens via the Teresa pipeline, not from direct Document Studio authoring.

---

## Completion Plan to 100%

### P0 — Pre-GA (before 2026-06-08)

| ID | Task | File:line | Effort |
|---|---|---|---|
| P0-1 | Delete DEMO comment block from `useRapData.ts` | `useRapData.ts:187–389` | 15 min |
| P0-2 | Remove `outputs_documents` and `presentations` tabs from hub tab bar; collapse to outputs_all/mine/review/sheets/templates | `ReportsAndPresentationsHub.tsx:143–182` | 1 hr |
| P0-3 | Fix `InitiativeSourceLink.tsx:85` and `CommandPalette.tsx:164` deep links from `tab=documents` to `tab=all` | `InitiativeSourceLink.tsx:85`, `CommandPalette.tsx:164` | 15 min |
| P0-4 | Add "Retry" button to `SheetsTabContent` static empty state | `SheetsTabContent.tsx:62–89` | 30 min |

### P1 — Wave 1 (2026-06-08 to 2026-06-14)

| ID | Task | File:line | Effort |
|---|---|---|---|
| P1-1 | Wire "Generate with Teresa" CTA to `ArtifactRunsApi.createFromChat()` + open `V8ArtifactRunControl` inline | `OutputsAggregateTabContent.tsx:191`, new hook in `src/services/api/artifactRuns.ts` | 3 hrs |
| P1-2 | Document Studio → Outputs: add "Publish to Outputs" button calling `POST /api/artifacts/:id/start-review` | `DocumentStudioView.tsx`, new endpoint or reuse `artifacts.routes.ts:766` | 4 hrs |
| P1-3 | Harden approval gate for legacy rows: check `canExport` flag from `QualityGatesPanel` if `publishState` absent | `useRapData.ts:165–168`, `QualityGatesPanel.tsx:42` | 1 hr |
| P1-4 | Templates empty-state CTA ("Upload template" or "Create from scratch") | `TemplatesTabContent.tsx` | 1 hr |
| P1-5 | E2E round-trip test: Teresa from-chat → materialize → "View in Outputs" → hub deeplink | `tests/e2e/smoke/` | 3 hrs |

### P2 — Week 2 (post-GA)

| ID | Task | Effort |
|---|---|---|
| P2-1 | Socket.IO live-refresh on `artifact:created` event (no polling in hub) | 4 hrs |
| P2-2 | Table Studio (Tabele) → auto-register sheet as governed artifact on export | 3 hrs |
| P2-3 | Server-route integration tests for governance endpoints (start-review, trust-state, access-grant) | 2 hrs |
| P2-4 | Artifact card "Teresa-generated" badge (Crimson chip when `originRuntime` is AI pipeline) | 1 hr |

---

## Definition of 100%

1. Zero demo data injected in any paid tenant at any time (P0-1 complete, confirmed by test).
2. Export blocked client-side for all unapproved artifacts including legacy rows (P1-3).
3. Hub tab bar shows only governed-aggregate tabs (All / Mine / Needs review / Sheets / Templates) — no format-lane sub-tabs (P0-2).
4. One-click "Generate with Teresa" from empty Outputs Library → run control opens → artifact lands in hub after materialize (P1-1).
5. Document Studio has a "Publish to Outputs" action that registers the document as a governed artifact (P1-2).
6. All cross-module deep links land on the correct aggregate tab (P0-3).
7. Full E2E test covering Teresa → Outputs round-trip (P1-5).
8. Templates empty-state has a CTA (P1-4).
9. Approval gate is hard-closed for all artifact rows regardless of legacy governance shape (P1-3).
10. No dead code in production files (P0-1).
