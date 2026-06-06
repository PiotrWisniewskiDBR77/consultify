# COMPLETION DOSSIER — Module 10: Dokumenty / Document Studio

**Audit date:** 2026-06-03  
**Score trajectory:** 52/100 (2026-06-02) → 71/100 (2026-06-03 re-audit) → **current: ~71/100**  
**Gap to 100%:** ~29 points across 9 concrete items  

---

## 1. Purpose / Goal / Vision

Document Studio is Consultify's **AI-native deliverable engine** — not a text generator but a living-artifact runtime for client-ready, professional documents. The canonical goal (from `docs/UI_UX/26_DOCUMENT_STUDIO_UX.md`, `docs/modules/10_dokumenty/01_PURPOSE.md`, `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`):

- **Living artifact** with `DocumentSchema` (sections/blocks/citations), versioning, diffs, approval workflow, audit trail, and confidentiality levels — never a blob file.
- **Word/PDF are output formats only.** The product does not compete with MS Word as an editor.
- **Source-grounded prose by default.** Every analytical claim is traceable to a source pack or explicitly flagged as an assumption. No "confident prose without evidence."
- **Teresa is the sole edit interface.** "Document Studio does not grow its own module-local chat input" (`26_DOCUMENT_STUDIO_UX.md:73`). All editor commands route through Teresa.
- **Full lifecycle loop:** intake → narrative plan (user-approved) → source pack review → AI generation → block-level prose (grounded) → QA verdict → review/approval → export (DOCX/PDF) → audit trail. Gamma/Word-class with consulting-grade provenance.

At 100% a consultant receives a client-deliverable Word/PDF that any senior partner can sign off on, where every claim traces back to a source.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 71/100**

What moved the score from June 02 (+19 points):
- Editor state DB-persisted (`documentEditorStateRegistryDao.ts` + migration `20260603_document_studio_editor_state.sql`) — three tables: proposals, audit, schema_overlay.
- Block-level LLM prose wired (`documentBlockProseGenerator.ts:167`, called at `documentStudioService.ts:490–493`) with grounded consulting system prompt.
- PDF figure embedding real (`documentPdfRenderer.ts:568–618`): `decodeImageBlockBytes` reads `dataBase64` from image blocks via PDFKit.
- Sidebar entry added (`menuConfig.ts:131–136`, label "Documents", badge `beta`).
- `/wordy` redirect to `/document-studio` via `RedirectPreservingQuery` (`AppRoutes.tsx:1304–1313`).

**Remaining gap (29 points):**

| # | Issue | File:Line | Severity |
|---|---|---|---|
| G1 | **LLM prose off by default.** `useLlm` state defaults to `false` in `DocumentStudioView.tsx:41` and `DocumentStudioIntakeForm.tsx:83`. The vast majority of users receive placeholder prose ("Substantive content for…") from `documentContentGenerator.ts`. No in-UI warning that content is stub-grade. | `DocumentStudioView.tsx:41`, `DocumentStudioIntakeForm.tsx:83` | P0 |
| G2 | **Teresa intent dispatch not wired to routes.** `documentTeresaIntent.ts` (558 lines) implements `detectTeresaEditorIntent` and `detectTeresaCreationIntent` but is imported **only in tests** — never called from `document-studio.routes.ts` or any route handler. The Teresa edit-command contract (`26_DOCUMENT_STUDIO_UX.md:72-73`, `MUST: komendy edycyjne usera idą przez Teresę`) has no production call path. | `server/src/services/documentStudio/documentTeresaIntent.ts` — no import outside `__tests__/` | P0 |
| G3 | **`chat/create-from-sources` endpoint not surfaced in frontend.** `POST /api/document-studio/chat/create-from-sources` exists server-side (`document-studio.routes.ts:1127`) and `createDocumentFromChatSourcePack` service function is implemented (`documentStudioService.ts:2535`), but `src/components/DocumentStudio/api.ts` has no wrapper for this endpoint and no Chat/Interview → Document Studio deeplink exists in any frontend component. Teresa creation intent works in isolation, not in the real user journey. | `src/components/DocumentStudio/api.ts` (missing call), `DocumentStudioView.tsx` (no intake pre-population from Chat) | P0 |
| G4 | **Outline structure is hardcoded.** `documentNarrativePlanner.ts:33` — `DEFAULT_SECTIONS_BY_TYPE` is a static per-type section list. The `useLlm` path in `planDocumentAsync` only triggers the narrative refiner for tone/language refinement; no AI inference of section order or document type from free-form intake description. | `server/src/services/documentStudio/documentNarrativePlanner.ts:33,350–366` | P1 |
| G5 | **Image upload UI absent.** PDF figure embedding is real at the renderer level (`documentPdfRenderer.ts:568`) but requires `block.content.dataBase64` to be populated. There is no file-attach step in the intake form or document panel. Effectively unreachable from the standard UI flow. | `DocumentStudioIntakeForm.tsx`, `DocumentStudioDocumentPanel.tsx` — no image attach control | P1 |
| G6 | **Sidebar locked on public production.** `publicProduction.ts:2` — `PUBLIC_PRODUCTION_CORE_MENU_IDS` = `{'AI_CHAT', 'INTERVIEW'}`. `MODULE_DOCUMENT_STUDIO` receives `isLocked: true` on `consultify.ai`. Module is reachable by direct URL but invisible via navigation for beta GA users. No role/flag gate — binary lock. | `src/utils/publicProduction.ts:2,39,49` | P1 |
| G7 | **Migration runner reliability gap.** `20260603_document_studio_editor_state.sql` matches the migration pattern but fresh-Postgres bootstrap has known schema-drift (194-table gap documented in `schema-bootstrap-orphans.md`). The editor-state DAO is `try/catch → []` tolerant, silently degrading to in-process Maps on failure — invisible data loss in multi-server deploys. | `server/src/services/documentStudio/documentEditorStateRegistryDao.ts` — all methods wrapped in silent catch | P1 |
| G8 | **No end-to-end test for generate → export flow.** 70 unit tests exist for individual services. Zero integration/E2E tests cover the full `intake → outline → generate → QA → approve → export-DOCX/PDF` path. The one frontend component test (`DocumentStudioDocumentPanel.test.tsx`) is shallow. The acceptance criteria in `07_ACCEPTANCE_AND_TESTS.md` are all unchecked. | `docs/modules/10_dokumenty/07_ACCEPTANCE_AND_TESTS.md` — all ACs unchecked | P2 |
| G9 | **No AI Credits metering on LLM calls.** `documentBlockProseGenerator.ts` calls `generateChatResponse` with `maxTokens: 2400`. `documentNarrativeRefiner.ts` also calls LLM. Neither charges/logs AI Credits (`v1_scope_decisions` D11 plans AI Credits as the billing unit). No `creditCost` tracking in any document-studio route handler. | `server/src/services/documentStudio/documentBlockProseGenerator.ts:179`, `server/src/routes/document-studio.routes.ts` — no credits middleware | P2 |

---

## 3. Teresa Integration — Depth and Missing

**What is implemented (server-side, tested in isolation):**
- `documentTeresaIntent.ts` — full intent classifier: `detectTeresaEditorIntent` resolves `scope` (local/section/global/methodological/source/transformational) + cursor anchor from a free-form Teresa message. `detectTeresaCreationIntent` classifies creation signals with `sourceSignal` (`with_pack` / `unspecified`). 558 lines, well-tested.
- `createDocumentFromChatSourcePack` (`documentStudioService.ts:2535`) — orchestration call that accepts a `TeresaCreationIntent` and materializes a full artifact from Chat source context.
- `POST /api/document-studio/chat/create-from-sources` route (`document-studio.routes.ts:1127`) — mounted with auth, validated, wired to service.

**Critical missing wiring:**
- `documentTeresaIntent.ts` is **never imported in production code** — only in `__tests__/`. The intent classifier is unreachable from any real request path.
- `api.ts` has no `createDocumentFromChatSources()` wrapper. No frontend component calls the `/chat/create-from-sources` endpoint.
- Chat/Interview module has no "Create document from this conversation" button or deeplink to `/document-studio?fromChat=...`. The Teresa edit-command contract from `26_DOCUMENT_STUDIO_UX.md` (MUST: all edit commands go through Teresa) is aspirational — the UI still presents direct edit controls in `DocumentStudioDocumentPanel.tsx`.
- No `useLlm`-on-by-default policy aligns with the "world-class deliverable" goal. The LLM key requirement is handled by `aiService.ts`'s existing `generateChatResponse` infra — **no new key is needed**; the same AI service used by Chat is reused. The only blocker is the default `false` toggle.

**Teresa integration depth score: 4/10** — the service layer is complete; the dispatch layer (routes calling intent detection) and UI integration layer are both absent.

---

## 4. System Integration

**Wired:**
- Outputs Hub → Document Studio: `ReportsAndPresentationsHub.tsx:905` — `navigate('/document-studio')` button exists and works.
- Route `/wordy` → `/document-studio`: `AppRoutes.tsx:1304–1313` via `RedirectPreservingQuery`.
- Sidebar entry: `menuConfig.ts:131–136`, resolves via `AppView.WORDY → ROUTES.DOCUMENT_STUDIO`.
- Source packs: `documentSourcePackService.ts`, `documentSourcePackConnectors.ts` — real and tested.

**Not wired:**
- No deeplink from Chat (`/ai-chat`) or Interview (`/interview`) into Document Studio with pre-populated intake.
- No Outputs hub listing of Document Studio artifacts alongside Presentations (separate routes, no cross-listing).
- AI Credits metering absent (P2 for GA, required for billing unlock per `v1_scope_decisions` D11).
- `MODULE_DOCUMENT_STUDIO` not in `PUBLIC_PRODUCTION_CORE_MENU_IDS` → sidebar locked on `consultify.ai`.

---

## 5. Completion Plan to 100%

### P0 — Blocking (must ship before GA unlock)

| ID | Action | Effort | File:Line |
|----|--------|--------|-----------|
| P0-A | **Flip LLM prose default to `true`** + add visible "AI prose off (fast)" toggle with amber banner when off. Mode 3 (template) may remain `useLlm:false` default. | 1h | `DocumentStudioView.tsx:41`, `DocumentStudioIntakeForm.tsx:83` |
| P0-B | **Wire `documentTeresaIntent.ts` into the `/edit` and `/section-rewrite` route handlers.** Import `detectTeresaEditorIntent` in `document-studio.routes.ts`, call it on edit requests, dispatch to the correct refiner function. | 4h | `document-studio.routes.ts`, `documentTeresaIntent.ts:300` |
| P0-C | **Expose `createDocumentFromChatSources` in `api.ts`** and add a "Create document" CTA in Chat (on message with source context) that deep-links to `/document-studio` with pre-populated intake payload. | 6h | `src/components/DocumentStudio/api.ts`, `UnifiedChatPanel.tsx` |

### P1 — Important (before public-beta)

| ID | Action | Effort | File:Line |
|----|--------|--------|-----------|
| P1-A | **Unlock sidebar for GA.** Add `MODULE_DOCUMENT_STUDIO` to `PUBLIC_PRODUCTION_CORE_MENU_IDS` or introduce a role-flag (`user.betaFeatures.documentStudio`) gate. | 1h | `src/utils/publicProduction.ts:2` |
| P1-B | **Image block upload UI.** Add file-attach affordance to `DocumentStudioIntakeForm` (cover logo, inline figures) and `DocumentStudioDocumentPanel` image block editor. Populates `dataBase64` for PDF renderer. | 8h | `DocumentStudioIntakeForm.tsx`, `DocumentStudioDocumentPanel.tsx` |
| P1-C | **Harden migration runner for editor-state tables.** Add startup health-check that asserts the three `document_studio_editor_*` tables exist; log a hard warning (not silent catch) if absent. | 2h | `server/src/services/documentStudio/documentEditorStateRegistryDao.ts` |
| P1-D | **AI-inferred outline.** Replace `DEFAULT_SECTIONS_BY_TYPE` lookup with an LLM call (same `generateChatResponse` infra) when `useLlm=true` — infer document type and section order from `intake.description`. Deterministic fallback preserved. | 6h | `server/src/services/documentStudio/documentNarrativePlanner.ts:33,350–366` |

### P2 — Quality (before 1.0 release)

| ID | Action | Effort | File:Line |
|----|--------|--------|-----------|
| P2-A | **AI Credits metering.** Add `creditCostMiddleware` to LLM-touching routes (`/plan`, `/generate`, `/section-rewrite`) with token-count estimates. | 3h | `server/src/routes/document-studio.routes.ts:407,446,524` |
| P2-B | **E2E integration test.** Cover the full `intake → plan → generate (useLlm:true) → QA → approve → export DOCX/PDF` path in `tests/integration/`. Check all acceptance criteria in `07_ACCEPTANCE_AND_TESTS.md`. | 1d | `docs/modules/10_dokumenty/07_ACCEPTANCE_AND_TESTS.md`, `tests/integration/document-studio/` (new) |

**Total estimated effort to 100%: ~3–4 days engineering.** The backend is production-quality; the gap is in UI defaults (P0-A, 1h), dispatch wiring (P0-B, 4h), cross-module deeplink (P0-C, 6h), and test coverage (P2-B, 1d).
