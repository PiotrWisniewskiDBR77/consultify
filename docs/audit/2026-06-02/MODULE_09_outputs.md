# Module 09 — Outputs — Readiness Scorecard

**Readiness: 62/100 — Tier: Beta**
**Route(s):** `/presentations`, `/presentations/builder/:deckId`, `/presentations/wizard`, `/presentations/shared/:shareToken`, `/presentations/embed/:shareToken`, `/reports/builder`, `/reports/builder/:reportId`, `/reports` (redirect), `/reports/management` (redirect)
**One-line verdict:** Core library hub + report/deck builder are genuinely backend-wired with real PDF/PPTX generation and a solid test layer, but demo-data fallback paths remain in production code, the format-lane sub-modules (Documents/Tables/standalone Presentations) are placeholder-only stubs, and Teresa-to-Outputs AI execution has zero runtime proof.

## What's REAL (verified + backend-wired)

- `src/components/ReportsAndPresentations/useRapData.ts:428–456` — `useReports()` fetches `GET /api/artifacts?outputType=report` and maps real rows; falls back to `DEMO_REPORTS` only on 404/501 in demo mode.
- `src/components/ReportsAndPresentations/useRapData.ts:1065–1096` — `usePresentations()` same pattern via `GET /api/artifacts?outputType=presentation`.
- `src/components/ReportsAndPresentations/useRapData.ts:688–731` — `useArtifactOutputsList()` hits `GET /api/artifacts?view=mine|review`, canonical registry.
- `src/components/ReportsAndPresentations/useRapData.ts:1342–1480` — `useRapActions()`: `exportReportPdf`, `exportDeckPptx`, `archiveReport`, `archiveDeck`, `startArtifactReview` all make real API calls; export paths resolved via `GET /api/artifacts/:id/action-target`.
- `server/src/routes/artifacts.routes.ts:632,669,718` — `/action-target`, `/trust-state`, `/start-review` endpoints real.
- `server/src/routes/report-builder.routes.ts:3473,3618` — `GET /:id/export/pdf` (pdfkit) and `GET /:id/export/pptx` real routes.
- `server/src/routes/presentations.routes.ts:1413–1529` — `GET /decks/:id/download` real PPTX file-send with `enforceNoLegalHold`, `ensureConfidentialityPolicy`, export audit logging.
- `server/src/services/export/UnifiedExportService.ts:50–168` — `renderPdf` (pdfkit), `renderPptx` (pptxgenjs), `exportDocx` (docx), `exportXlsx` (exceljs) all implemented with real libraries.
- `tests/unit/backend/services/UnifiedExportService.test.ts:24–82` — 8 tests covering renderPdf, renderPptx, exportPdf, exportDocx, exportXlsx, exportPptx.
- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx:53–631` — 14+ tests covering all data hooks and action resolution.
- `tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx:141–217` — 7 tab routing / deeplink tests.

## What's MOCK / hardcoded / stub

- `src/components/ReportsAndPresentations/useRapData.ts:149–344` — `DEMO_REPORTS`, `DEMO_PRESENTATIONS`, `DEMO_TEMPLATES` are large hardcoded arrays. `useReports()`, `usePresentations()`, `useSheetOutputs()`, `useTemplates()` all contain `allowDemoData` branches that activate on 404/501 responses — i.e., if the backend endpoint is absent the UI silently serves fake data. Production code, not test-only.
- `src/components/ReportsAndPresentations/mockData.ts` — `MOCK_TEMPLATES`, `MOCK_REPORTS`, `MOCK_PRESENTATIONS` exist and appear unused in production imports (no non-test file imports this module), but the file is left as dead weight.
- `src/routes/AppRoutes.tsx:1397–1427` — `/wordy` (Documents) and `/prezentacje` (standalone Presentations) are guarded by `KimiModuleGate` which hits `/api/module-access/my`; if the flag is absent they fall through to `V4ComingSoonView`. `ExceleView` import is commented-out at line 1413 (`reason="excele_merged_into_table_studio"`).
- Template tab (`TemplatesTabContent`): loads from canonical `/api/artifacts?artifactFamily=template` but if all three requests fail returns an empty list with no demo fallback — so templates appear empty when backend is cold.

## What's BROKEN / NO_GO / missing

- **Teresa-to-Outputs runtime path is entirely absent.** No server route or client hook implements the conversation → draft → approval → artifact handoff for AI-generated outputs. Docs declare it as a design requirement; code has zero evidence (confirmed by grepping `server/src/routes/v8/` — Teresa tests only confirm run-approval ≠ artifact-review rule).
- **`/wordy` (Documents) and `/excele` (Tables) format lanes are placeholder-only.** `WordyView` and `ExceleView` are imported in `AppRoutes.tsx` but either gate-guarded to `V4ComingSoonView` (wordy/prezentacje) or explicitly disabled with a comment (excele). The entire document and spreadsheet authoring path is not shipped.
- **Demo-data paths are in production code without a hard guard.** `shouldAllowDemoData()` (`src/services/api.ts:591`) returns true for any `isDemoMode || isDemoSession` flag, but the fallback fires on API 404/501 — meaning a misconfigured endpoint silently serves fake data in production tenants if the flag is set.
- **No approval-before-export gate in the hub.** `useRapActions.exportReportPdf` and `exportDeckPptx` call export endpoints directly with no pre-flight check of `publishState` or `validationState` from the artifact registry. The export governance fields exist in the data model but are not enforced client-side.
- **Sheets tab (`SheetsTabContent`) has no demo fallback and returns empty on error** — the `useSheetOutputs` hook sets `rows=[]` silently.
- **DIA-P1-001 (AppView drift)** persists in runtime: `AppView.FULL_STEP6_REPORTS` maps to `/reports/builder`, not `/presentations` — the canonical module entry signal is split.

## Backend wiring

Real: `GET /api/artifacts` (list, mine, review, my-work, by-initiative, by-origin), `GET /api/artifacts/:id/action-target`, `GET /api/artifacts/:id/trust-state`, `POST /api/artifacts/:id/start-review`, `GET /api/report-builder/:id/export/pdf` (pdfkit), `GET /api/report-builder/:id/export/pptx`, `GET /api/presentations/decks/:id/download` (pptxgenjs file), `DELETE` for both runtimes. UnifiedExportService provides real PDF/PPTX/DOCX/XLSX primitives. Export governance gates (`enforceNoLegalHold`, `ensureConfidentialityPolicy`, `ensurePresentationCapability`) are implemented in `presentations.routes.ts`. Missing: client-side approval pre-flight; Teresa artifact creation route; `/wordy` and `/excele` document/sheet generation endpoints.

## UI/UX consistency

`ReportsAndPresentationsHub` uses `ModuleHub` (shared shell), `Menu3` style constants (`MENU_3_LEFT_CLASS`, `MENU_3_CHIP_ACTIVE`, etc.), and passes `rightControls`/`commandRowContent` into the approved shell — consistent with doctrine. DeckBuilder and PresentationWizard are under `moduleName="Outputs"` gate. Format-lane views (`WordyView`, `PrezentacjeView`) use a different shell path (KimiWorkspace) and render a coming-soon placeholder — no visual parity with the outputs hub.

## Tests

Present and meaningful: 14+ hook tests (`useRapData.canonicalArtifacts.test.tsx`), 7 hub routing tests (`ReportsAndPresentationsHub.test.tsx`), deeplink tests for all 4 tab contents, 8 `UnifiedExportService` binary-generation tests, `presentationExportParityService.test.ts`. Gaps: no server-route-level integration tests for `/api/artifacts` governance endpoints; no client-side approval-gate tests; no E2E export round-trip test; `mockData.ts` is dead code with no test assertion.

## Doc-vs-code drift

Moderate. STATUS.md/CODEMAP.md are accurate for routes and components — confirmed. DEEP_INTEGRATION_AUDIT findings (DIA-P1-001 AppView drift, DIA-P1-003 `/presentations` vs `/prezentacje` confusion) remain unresolved in code. P1 gaps flagged in docs (`S15-OUT-P1-001` through `P1-005`) are all still open — no runtime evidence has been added since the May 11 audit. The `mockData.ts` file is referenced in docs as a legacy artifact but is never cleaned up. Doc stated `NEEDS_OWNER_DECISION` — still accurate.

## Top gaps to reach market-ready (prioritized)

1. **Remove demo-data production fallback** — `DEMO_REPORTS`/`DEMO_PRESENTATIONS` should only be returned when an explicit demo-tenant flag is set, not on any 404/501; otherwise production users on misconfigured tenants get fake data silently.
2. **Enforce approval-before-export client-side** — `exportReportPdf`/`exportDeckPptx` must check `publishState`/`validationState` from the artifact registry before calling the export endpoint; currently the governance data is fetched but not acted upon.
3. **Activate or remove format lane stubs** — `/wordy` and `/excele` must either ship their real views or be explicitly hidden from the sidebar; the dead `mockData.ts` file should be deleted.
4. **Wire Teresa-to-Outputs execution path** — at minimum a server route for `POST /api/artifacts/draft` triggered from AI conversation, with the proposal/approval loop, to make the doctrine provable.
5. **Add `AppView` ownership alignment** — resolve DIA-P1-001: either make `AppView.PRESENTATIONS` the sole canonical entry or document the builder-bypass flow explicitly in UI copy and sidebar config.
