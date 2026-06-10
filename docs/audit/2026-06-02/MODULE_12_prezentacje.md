# Module 12 — Prezentacje — Readiness Scorecard

**Readiness: 62/100 — Tier: Beta**
**Route(s):**
- `/prezentacje` — gated behind `KimiModuleGate` (module-access API check); renders `PrezentacjeView` when allowed, falls back to `V4ComingSoonView`. Sidebar badge: "soon".
- `/presentations` — `ReportsAndPresentationsHub` (belongs to module 09, not 12)
- `/presentations/studio` — `PresentationStudioPage` (preview+approval UI, wired to real backend)
- `/presentations/wizard` — `PresentationWizard`
- `/presentations/builder/:deckId` — `DeckBuilder` (full WYSIWYG editor, real PPTX generation)

**One-line verdict:** The Presentation Studio + DeckBuilder pipeline is substantially real and backend-wired with actual PPTX generation via `PptxPipelineService`, but the canonical `/prezentacje` entry point is still gated behind a contact-required access check, real-time collaboration is explicitly disabled, and several sub-features (PNG export, version history persistence, shared deck analytics) hit live endpoints whose backend depth is unverified.

---

## What's REAL (verified + backend-wired)

- **PPTX generation pipeline** — `presentationGeneratorService.ts:1473-1487` calls `PptxPipelineService.generateFromUnifiedJson()`, writes a `.pptx` buffer to disk (`exports/presentations/<deckId>.pptx`), stores `export_path` in DB.
- **PPTX download endpoint** — `presentations.routes.ts:1413` serves `GET /decks/:id/download` with `res.sendFile()` from `export_path`. Quality-gate, confidentiality policy, artifact registry, and audit trail all enforced before serving.
- **PDF export** — `presentations.routes.ts:1555` generates on-the-fly via `pdfkit`. Real.
- **DeckBuilder autosave** — `presentations.routes.ts:2116` `PUT /decks/:deckId/autosave`; client hits it at `DeckBuilder.tsx:564` with version conflict detection (409 handling).
- **Agent-edit (Teresa)** — `presentations.routes.ts:2180` `POST /decks/:deckId/agent-edit`; accept/reject at :2299/:2389. Client wired at `DeckBuilder.tsx:814-836`.
- **Quality gates panel** — `presentations.routes.ts:5711` `GET /decks/:deckId/quality-gates`; blocks export when gates fail (`DeckBuilder.tsx:750-755`).
- **Governance card** — `presentations.routes.ts:2426`; prefetched in `DeckBuilder.tsx:400-418`.
- **Runtime events** — `presentations.routes.ts:5617`; polled every 30 s in `DeckBuilder.tsx:392-398`.
- **Share analytics** — `ShareAnalyticsPanel.tsx:56` calls `/presentations/decks/:deckId/analytics`.
- **PresentationStudioPage** — 4 preview endpoints (source-pack, narrative-plan, template-plan, generate) + 2-step approval flow fully wired to `/api/presentation-studio/*` (`Gateway.ts:849`). Tests exist at `server/src/routes/__tests__/presentationStudio.routes.test.ts`.
- **Brand kit fetch** — `DeckBuilder.tsx:366` calls `GET /presentations/brand-kit`.
- **Backlinks** — `DeckBuilder.tsx:638-678` hits `getLinkGraphBacklinks` + `/report-builder/backlinks/presentation/:id`.

## What's MOCK / hardcoded / stub

- **Collaboration (`useCollaboration`)** — called with `enabled = false` in `DeckBuilder.tsx:362`. WebSocket URL defined (`useCollaboration.ts:73`) but never opens. Presence indicators rendered but always empty.
- **Version history** — `useVersionHistory` stores versions in local React state only. No `/decks/:deckId/versions` endpoint is called for initial load; `DeckBuilder.tsx:5990` exists on server but the hook does not fetch from it on mount.
- **PNG export** — `presentations.routes.ts:5728` exists but internals were not verified to actually produce raster images (sharp dependency present but the route's implementation needs scrutiny).
- **`PrezentacjeView`** (Kimi workspace AI generator lane) — mounted at `/prezentacje` but only reachable if module-access API grants `prezentacje`; most users see `V4ComingSoonView` (sidebar badge "soon").

## What's BROKEN / NO_GO / missing

- **`/prezentacje` entry point is contact-gated for all users** — `AppRoutes.tsx:1425-1427` wraps `PrezentacjeView` in `KimiModuleGate` which calls `/module-access/my`; failing that check shows `V4ComingSoonView`. No self-serve onboarding path.
- **Deck creation UI gap** — `PresentationWizard` leads to DeckBuilder, but there is no direct "New deck" button wired in the sidebar or Hub that a general user can reach without the Studio approval flow.
- **Real-time collaboration is hard-disabled** — `useCollaboration(deckId, currentUser, false)`. The WebSocket server handler for `/ws/presentations/*` was not found in `server/src` — no WS handler exists. Collaboration chips in TopBar display but are always disconnected.
- **`STAGE_1_5_ULTRA_DEEP_GAP_AUDIT`** flags placeholder handoff copy on `/prezentacje` is still missing explicit ownership redirect to `/presentations` for confused users.

## Backend wiring

Real PPTX generation is fully wired end-to-end: `PresentationWizard` → `POST /presentations/decks` → `generateDeck()` → `PptxPipelineService` → disk file → `export_path` stored in DB → `GET /decks/:id/download` streams the file. The `PptxPipelineService` (`server/src/services/report/pptx/PptxPipelineService.ts`) uses `pptxgenjs` (type definitions at `server/src/types/pptxgenjs.d.ts`). PDF is generated inline via `pdfkit`. The Studio's 4-preview + approval + generate flow is separately wired under `/api/presentation-studio`. All major DeckBuilder sub-features (autosave, agent-edit, quality gates, governance, runtime events, analytics, audit log) have real server routes in the 6 121-line `presentations.routes.ts`.

## Feature-flag gating

- **`isMelsDeckBuilderEnabled()`** (`src/utils/melsDeckBuilderFlag.ts`) — gates the `DeckBuilderMelsView` (EE ExecutiveModuleShell adapter). Default OFF. When ON, swaps the layout shell; all deck state and handlers are identical, so flipping is safe. Controlled via `localStorage`, `sessionStorage`, or `VITE_MELS_DECK_BUILDER` env var.
- **`KimiModuleGate moduleKey="prezentacje"`** — API-driven access check that gates the entire `/prezentacje` lane.

## UI/UX consistency

DeckBuilder uses a bespoke three-panel layout (Slide Sorter | CardCanvas | BlockToolbar) with its own `DeckBuilderTopBar`, `DeckBuilderBottomBar`, and `DeckThemeProvider` — not the standard `ModuleHub` shell. The Mels EE shell adapter (`DeckBuilderMelsView`) is the path toward the unified `ExecutiveModuleShell` but is off by default. `PresentationStudioPage` also uses a bespoke sticky header command-row, not the shared hub shell. Both surfaces follow canonical color semantics (slate/blue/amber/emerald/rose), dark mode, and i18n.

## Tests

- **Server:** `presentationStudio.routes.test.ts`, `presentationApprovedTemplateService.test.ts`, `presentationConfidentialityPolicyService.test.ts`, `presentationBenchmarkTrendService.test.ts`, `presentationAlertPlaygroundService.test.ts`, `presentationSubscriberDashboardService.test.ts`, `presentationExportParityService.test.ts`, `presentationStudioSlideAuditDecoratorService.test.ts`.
- **Client:** `PresentationStudioPage.test.tsx`, `PresentationStudioLayoutAuditBanner.test.tsx`, `PresentationStudioLayoutCapacityAdminPanel.test.tsx`, `DeckBuilderMelsChips.test.ts`, `DeckBuilderMelsRightRail.test.ts`.
- **Missing:** No end-to-end test for the full generate → PPTX download pipeline. No test for DeckBuilder autosave, agent-edit, or quality-gate-blocked export.

## Doc-vs-code drift

Docs (last updated 2026-05-09) stated `/prezentacje` renders `V4ComingSoonView`. The code has since changed: `AppRoutes.tsx:1425-1427` now mounts `PrezentacjeView` behind `KimiModuleGate` — no longer a plain `V4ComingSoonView` fallback unconditionally. The `CODEMAP.md` still says "renders V4ComingSoonView", which is only half-true (it renders `PrezentacjeView` when access is granted). STATUS.md classification (`partial + duplicate_boundary_resolved`) is still broadly accurate. The SSOT references several source documents that exist in the repo, so no broken-path drift there.

## Top gaps to reach market-ready (prioritized)

1. **Remove contact-gate for `/prezentacje`** — Add self-serve onboarding or at minimum a clear CTA routing to `/presentations/wizard` so users can reach the generator without ops intervention.
2. **Enable or remove collaboration** — Either wire the WebSocket server handler for `/ws/presentations/:deckId` and flip `useCollaboration(…, true)`, or strip presence indicators from TopBar to avoid showing always-disconnected state to users.
3. **Persist version history server-side** — `useVersionHistory` is in-memory only; connect it to `GET /decks/:deckId/versions` and `POST /decks/:deckId/versions/:versionId/restore` which already exist on the server.
4. **Flip `isMelsDeckBuilderEnabled()` to ON (or ship by default)** — The EE shell adapter is complete and flag-safe; shipping it aligns the DeckBuilder with the unified `ExecutiveModuleShell` standard and closes the UI consistency gap.
5. **Verify PNG export route** — `presentations.routes.ts:5728` needs integration coverage; confirm `sharp` rasterization actually produces valid zip output before advertising PNG export in the UI.
6. **Update CODEMAP.md** — The `/prezentacje` entry now mounts `PrezentacjeView` via `KimiModuleGate`, not `V4ComingSoonView` unconditionally; the doc is stale.
