# Module 09 — Outputs — Readiness Scorecard

**Readiness: 78/100 — Tier: Release Candidate**
**Baseline: 62/100 (2026-06-02) → DELTA: +16**
**Routes:** `/presentations`, `/presentations/builder/:deckId`, `/presentations/wizard`, `/reports/builder`, `/reports/builder/:reportId`, `/reports`, `/reports/management`
**One-line verdict:** All four baseline NO_GO gaps are closed or substantially resolved — demo fallback is commented-out dead code, approval gate is enforced pre-export, Teresa→Outputs handoff is wired and navigable, dead `mockData.ts` deleted. DIA-P1-001 AppView drift is resolved in `routeConfig.ts`. Remaining risk is DX depth: Sheets tab still empty-on-error (no recovery CTA), format-lane redirects are real but not surfaced in sidebar, and the artifact-run pipeline has no E2E test coverage.

---

## DELTA summary (62 → 78)

| Gap (baseline) | Status now | Evidence |
|---|---|---|
| Demo data on 404/501 in production | **FIXED** — DEMO_* arrays in comment block only; `shouldAllowDemoData()` never called in useRapData | `useRapData.ts:187–389` (comment wrapper `/* … */`); `api.ts:577–581` (explicit-toggle-only guard) |
| No approval-before-export client guard | **FIXED** — `isExportApproved()` called in both `exportReportPdf` and `exportDeckPptx`; blocks with toast when `publishState` ∉ {approved, published} | `useRapData.ts:149–168, 1366, 1401` |
| Teresa→Outputs handoff absent | **FIXED** — `V8ArtifactRunControl` shipped and mounted in chat; "View in Outputs" button navigates to `/presentations?tab=all&artifactId=<id>` on run completion | `V8ArtifactRunControl.tsx:812–827`; `artifact-runs.routes.ts:/from-chat, /:runId/materialize` |
| `mockData.ts` dead file | **FIXED** — file deleted; no references remain | `ls src/components/ReportsAndPresentations/mockData.ts → GONE` |
| DIA-P1-001 AppView drift | **FIXED** — `AppView.FULL_STEP6_REPORTS` maps to `ROUTES.REPORTS.BUILDER` (`/reports/builder`) in canonical routeConfig; not `/presentations` | `routeConfig.ts:346` |
| `/wordy` + `/excele` stubs | **PARTIALLY FIXED** — both redirect to canonical studios (`/document-studio`, `/tabele`) rather than showing coming-soon; sidebar labels unchanged | `AppRoutes.tsx:1304–1325` |

---

## Functionality

**Real exports (verified):**
- `exportReportPdf` → `GET /api/report-builder/:id/export/pdf` (pdfkit, `report-builder.routes.ts:3473`)
- `exportDeckPptx` → `GET /api/presentations/decks/:id/download` (pptxgenjs, `presentations.routes.ts:1413–1529`)
- `UnifiedExportService.ts:50–168` — renderPdf / renderPptx / exportDocx / exportXlsx all backed by real libraries; unchanged since baseline

**Demo gating:**
- DEMO_REPORTS / DEMO_PRESENTATIONS / DEMO_TEMPLATES arrays exist in file but are wrapped in a comment block (`useRapData.ts:187–389`). No runtime path reaches them. `shouldAllowDemoData()` is never imported or called in this file. Guard confirmed at `api.ts:577–581`: demo flags derive exclusively from an explicit user toggle (`demo:enabled` server flag), no localhost/dev bypass.

**Teresa→Outputs pipeline:**
- `POST /api/artifact-runs/from-chat` → plan → `POST /:runId/accept-plan` → `POST /:runId/materialize` → artifact registered; entire chain implemented (`artifact-runs.routes.ts`)
- Client: `V8ArtifactRunControl` handles snapshot capture → plan → approve → materialize loop with execution review approval/reject sub-flow; mounted in `UnifiedChatPanel.tsx:4264` and `WorkCanvasShell.tsx:1173`
- On `runStatus === 'completed'` with a materialized artifact, "View in Outputs" button navigates to `/presentations?tab=all&artifactId=<outputId>` (`V8ArtifactRunControl.tsx:819`)

---

## Intra-module flow & states

**List → preview → export:**
- `ReportsAndPresentationsHub` (ModuleHub shell) → tab content (Reports, Presentations, Sheets, Templates, Aggregate)
- Reports: loading skeleton ✓, error banner with diagnostic text ✓ (`ReportsTabContent.tsx:321–394`), empty state with create CTA ✓
- Presentations: same pattern (`PresentationsTabContent.tsx`)
- Sheets (`SheetsTabContent`): on error → `setRows([])`; no recovery CTA, no error message surfaced to user — **residual gap**
- Templates: canonical `/api/artifacts?artifactFamily=template`; on all-fail → empty list, no fallback, no demo — unchanged from baseline

**Approval gate:**
- `isExportApproved(target)` checks `governance.publishState` from the artifact registry row; blocks export and shows `toast.error` on non-approved state; backward-compatible no-op when governance absent (`useRapData.ts:165–168`)
- Server retains hard backstop: `enforceNoLegalHold`, `ensureConfidentialityPolicy` in `presentations.routes.ts`
- `QualityGatesPanel` exposes `canExport: boolean` to the ReportBuilder UI (`QualityGatesPanel.tsx:42, 269, 299`)

---

## UI/UX adherence

- `ReportsAndPresentationsHub` uses `ModuleHub`, `MENU_3_*` constants, `rightControls`/`commandRowContent` — compliant with doctrine
- Navy dark tokens (`dark:bg-navy-950/40`, `dark:border-navy-700`) consistent throughout hub and tab content
- `rounded-xl` / `rounded-2xl` used on all cards and dropdowns (`ReportsAndPresentationsHub.tsx:516`)
- Wave-2 studio lanes (`/wordy`, `/excele`, `/prezentacje`): `/wordy` → `RedirectPreservingQuery` to `/document-studio`; `/excele` → `/tabele`; `/prezentacje` now ungated (KimiModuleGate removed per Module 12 audit), real `PrezentacjeView` rendered — clean, no coming-soon stubs in routing
- **Sidebar**: "Reports" and "Presentations" remain separate sidebar items (`Sidebar.tsx:358–384`); the Outputs hub is entered via `AppView.PRESENTATIONS` → `/presentations`; no unified "Outputs" top-level sidebar entry — minor UX inconsistency but intentional per current IA

---

## Cross-module handoffs

- **Teresa (Chat) → Outputs:** `V8ArtifactRunControl` → `artifact-runs` routes → artifact registry → `/presentations?tab=all&artifactId=<id>` deep link. Full chain implemented.
- **Assessment → Report Builder:** `assessmentHub → navigate('/reports/builder/:reportId')` — multiple callsites verified
- **MyWork → Outputs:** `ConvertToOutputMenu.tsx:143` navigates to `/reports/builder/:outputId`
- **Finance → Reports:** `FinanceHub.tsx:2361`, `ExportButton.tsx:38` navigate to `/reports/builder/:outputId`
- **Spine canonical:** `AppView.FULL_STEP6_REPORTS` → `ROUTES.REPORTS.BUILDER` (`/reports/builder`) per `routeConfig.ts:346`; `AppView.PRESENTATIONS` → `ROUTES.PRESENTATIONS` (`/presentations`) per `routeConfig.ts:350` — DIA-P1-001 resolved

---

## Risks / regressions

1. **Sheets tab silent failure** — `useSheetOutputs` sets `rows=[]` with no error surface on API failure (`useRapData.ts:1175`); user sees empty list with no diagnostic or retry CTA.
2. **Approval gate backward-compat hole** — `isExportApproved` returns `true` when governance is absent (legacy rows). A report without a registry row can be exported regardless of its local `canExport` flag. The server gate is the only hard stop.
3. **E2E test gap** — no end-to-end test covering the full Teresa→Outputs pipeline (from-chat → materialize → View in Outputs → hub deeplink). The server route and client component are tested in isolation only.
4. **`v8OutputsGate` middleware** — `artifact-runs.routes.ts:14` applies `v8OutputsGate` to all artifact-run endpoints. If the V8 feature flag is off for a tenant, the entire Teresa→Outputs path is gated away silently. No client-side guard warns the user that the panel is non-functional — it simply won't show (`V8ArtifactRunControl.tsx:195: if (!showV8Chat || !conversationId) return null`).
5. **DEMO arrays still in source** — comment block `/* DEMO_REPORTS … */` is dead code but not deleted. Low risk (never executed), but creates confusion for future devs and should be pruned.

---

## Top gaps to reach 98/100

1. **Sheets tab error surface** — add error state + retry CTA to `SheetsTabContent` to match Reports/Presentations parity.
2. **Delete DEMO comment block** — prune the commented-out `DEMO_REPORTS`, `DEMO_PRESENTATIONS`, `DEMO_TEMPLATES` from `useRapData.ts:187–389`; they serve no runtime purpose.
3. **E2E artifact-run test** — add at least one Playwright/Cypress test covering the full from-chat → materialize → "View in Outputs" deeplink round-trip.
4. **Templates empty-state** — add a non-empty fallback CTA for `TemplatesTabContent` when the canonical endpoint returns zero results (currently silent empty list).
5. **Sidebar IA alignment** — evaluate whether "Reports" and "Presentations" as two separate sidebar entries matches the `ModuleHub`-unified "Outputs" concept; if unified, collapse to single `AppView.PRESENTATIONS` entry with sub-tabs handled inside the hub.
