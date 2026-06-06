# Module 10 — Dokumenty — Readiness Scorecard

**Readiness: 52/100 — Tier: Alpha**
**Route(s):**
- `/wordy` — sidebar entry (badge: `soon`), gated behind `KimiModuleGate` (API check against `/module-access/my`); falls back to `V4ComingSoonView` for non-whitelisted users. REAL route, limited audience.
- `/document-studio` and `/document-studio/:artifactId` — no sidebar entry; accessible only via Outputs Hub action button. Gated behind `ProductionModuleGate` (hidden on `consultify.ai`/`www.consultify.ai` in production). REAL route, hidden from general users.

**One-line verdict:** The Document Studio backend is a heavily-built Alpha (4,300-line route file, 70 service tests, real DB persistence for artifacts via wave5, real PDF/DOCX renderers) but editor proposals and schema overlays are lost on server restart (in-process Maps), content generation remains deterministic-first with LLM as opt-in, and the module has NO user-discoverable path on public production.

## What's REAL (verified + backend-wired)

- `server/src/routes/document-studio.routes.ts` — mounted at `/api/document-studio` in `Gateway.ts:720–724` with `verifyToken` + `highRiskSurfaceGuard`. Routes for plan, generate, export, templates, QA, source packs, comments, approvals, share links, brand voice, audience profiles, lifecycle, snapshots, diff, content blocks, assets.
- `server/src/services/documentStudio/documentStudioService.ts` — `materializeDocumentArtifact` writes to wave5 (`createWave5Artifact`, `getWave5Artifact`) which uses real DB (`dbRun`, `dbAll`, `dbGet`).
- `server/src/services/documentStudio/documentDocxRenderer.ts` — imports `docx@9.5.1` and renders multi-block DOCX buffers.
- `server/src/services/documentStudio/documentPdfRenderer.ts` — imports `pdfkit` and renders full-schema PDFs (cover, TOC, sections, callouts, tables, page numbering).
- `server/src/services/documentStudio/documentNarrativeRefiner.ts:21` — calls real `generateChatResponse` from `aiService.js` when `useLlm=true`.
- `server/src/services/documentStudio/documentTemplateRegistryDao.ts` — persists templates to Postgres tables `document_studio_templates` / `document_studio_template_audit` (migrations 769, 770 applied).
- `src/components/DocumentStudio/DocumentStudioView.tsx` — full 3-mode UI (intake → outline → document); renders `DocumentStudioDocumentPanel` (2,033 lines) with editor proposals, QA panel, comments, share links, audience variants, approvals, lifecycle display.
- `src/components/DocumentStudio/api.ts` — 810-line typed client covering every server endpoint.
- 70 server-side service tests + 2 route tests + 1 frontend component test.

## What's MOCK / hardcoded / stub

- `documentContentGenerator.ts` — `buildDocumentSchema` builds section blocks deterministically from section title string matching (if/else on "executive summary", "decisions required", etc.). Actual consulting prose is placeholder copy ("Key message and recommended next step go here. Replace with grounded synthesis."). LLM content path for block-level text generation is described as "MVP-1 finalization" in comments but not yet wired at the content level.
- `documentNarrativePlanner.ts` — outline sections come from a hardcoded `SECTION_LIBRARY` map keyed by `DocumentTypeKey`. No AI inference of doc type from free-text.
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:451` — "Unified document, share-link and approval history" tab renders but some sub-panels show empty states with no loading feedback.
- Image/figure embedding in PDF: `documentPdfRenderer.ts:21` explicitly deferred — images render as `Figure N — caption` placeholders.

## What's BROKEN / NO_GO / missing

- **Ephemeral editor state on restart**: `documentStudioService.ts:148–165` — `proposalStore`, `auditStore`, `schemaOverlayStore` are in-process `Map`s. Any edit proposal or schema overlay is lost on server restart. Not acceptable for production.
- **No sidebar navigation to `/document-studio`**: The fully-built DocumentStudioView has no sidebar entry. Users only reach it via the Outputs Hub button (`ReportsAndPresentationsHub.tsx:909`). `/wordy` goes to a different (older) KimiWorkspace flow.
- **Route split / identity confusion**: Two separate "document" surfaces exist — `/wordy` (KimiWorkspace chat-first + V8 artifact pipeline, using `/api/report-builder`) and `/document-studio` (DocumentStudioView, using `/api/document-studio`). The module docs only describe the `/wordy` path and treat `/document-studio` as unmounted, but both are mounted and divergent.
- **WordyView (`/wordy`) still uses `/api/report-builder`**: `WordyView.tsx:107` calls `Api.get('/report-builder/:artifactId')` and links to `/api/report-builder/:id/export/pdf`. This is the old report-builder system, not Document Studio.
- **`/document-studio` hidden on public production**: `publicProduction.ts:22` — `shouldHideNonCoreModulesInPublicProduction` returns `true` on `consultify.ai`, so `ProductionModuleGate` blocks the route entirely for public users.
- **Doc-vs-code drift (CODEMAP)**: CODEMAP says "AppRoutes renders `V4ComingSoonView`" on `/wordy` — this is stale. `/wordy` now renders `WordyView` via `KimiModuleGate`. CODEMAP doesn't mention `/document-studio` at all.

## Backend wiring

Real and extensive for `/api/document-studio`. Wave5 artifact persistence is DB-backed (SQLite/Postgres). Template registry has two Postgres migrations. QA engine, source packs, approval workflows, share links, brand voice, audience profiles — all have dedicated service files and tests. Critical gap: in-memory stores for proposals/audit/schema-overlay mean edits don't survive server restart.

## UI/UX consistency

`DocumentStudioView` + `DocumentStudioDocumentPanel` are bespoke — not using the EE `ExecutionModuleShell` adapter. `WordyView` uses `KimiWorkspaceShell` (chat split-screen), which is a different interaction paradigm. Neither is flagged as using the Miro-style standard. Shell inconsistency between the two document surfaces is significant.

## Tests

Strong server-side coverage: 70 service-level unit tests (QA, rendering, proposals, templates, share links, lifecycle, source packs, approvals, audience, brand voice, rollback). 2 route integration tests. 1 frontend component test (`DocumentStudioDocumentPanel.test.tsx`). No E2E or route-level integration tests for the full generate → export flow.

## Doc-vs-code drift

HIGH. CODEMAP (2026-05-09) says `/wordy` renders `V4ComingSoonView` — false, it now renders `WordyView`. CODEMAP says `DocumentStudioView` is "imported but not mounted" — false, it is mounted at `/document-studio`. STATUS.md (2026-05-11) says `NEEDS_OWNER_DECISION` for `/wordy` mount strategy — decision has been made (both routes are live) but docs not updated.

## Top gaps to reach market-ready (prioritized)

1. **Persist editor proposals to DB** — `proposalStore`/`auditStore`/`schemaOverlayStore` in `documentStudioService.ts:148–165` must be backed by a DAO + migration before any customer data is trusted.
2. **Resolve the route identity split** — decide whether `/wordy` (KimiWorkspace) or `/document-studio` (DocumentStudioView) is the canonical Document module, add sidebar entry, deprecate or integrate the other path.
3. **Wire LLM content generation into block-level prose** — `documentContentGenerator.ts` currently emits placeholder text; connect the narrative refiner to fill blocks with grounded AI-generated consulting prose.
4. **Lift production gate for `/document-studio`** — `ProductionModuleGate` currently blocks the route on `consultify.ai`; requires a deliberate gating strategy (role-based, flag-based, or removal).
5. **Update CODEMAP/STATUS to reflect actual mounted state** — both docs are materially stale and will mislead future implementers.
6. **Add sidebar navigation to `/document-studio`** — the surface is invisible without a menu entry.
7. **PDF image embedding** — `documentPdfRenderer.ts:21` deferred; real consulting deliverables require logo/figure embedding.
