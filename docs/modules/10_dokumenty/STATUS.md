---
module_id: MODULE_DOCUMENTS
doc_kind: STATUS
version: 2.0
owner: user
status: canonical
last_updated: 2026-06-03
---

# Status — Dokumenty / Document Studio

## Shipping Status (As-Is)

- Runtime class: `mounted + real_runtime` (was `soon + code_gap`).
- **Route-identity resolved (2026-06-03):** `/document-studio` (DocumentStudioView,
  backed by `/api/document-studio`) is the **canonical Document module**. The
  legacy `/wordy` KimiWorkspace report-builder surface (backed by
  `/api/report-builder`) is **deprecated and redirect-only** — `/wordy` now
  `Navigate`-redirects to `/document-studio` (mirrors `/excele` -> `/tabele`).
- **Sidebar:** the "Documents" entry (`MODULE_DOCUMENT_STUDIO`) navigates to the
  canonical route. `AppView.WORDY` resolves to `ROUTES.DOCUMENT_STUDIO` in
  `routeConfig.ts`; both `/document-studio` and `/document-studio/:artifactId`
  resolve back to the WORDY view so the entry highlights correctly.
- **Production gate lifted:** `/document-studio` is reachable for every
  authenticated user (wrapped in `ProtectedRoute`); the public-production
  hide gate (`ProductionModuleGate` + `shouldHideNonCoreModulesInPublicProduction`)
  no longer blocks it.
- **Persistence:** editor proposals, the per-artifact audit ledger, and the
  schema overlay are now durable. They were in-process `Map`s
  (`proposalStore` / `auditStore` / `schemaOverlayStore`) lost on restart;
  they are now write-through to Postgres via
  `documentEditorStateRegistryDao.ts` (migration
  `20260603_document_studio_editor_state.sql`) with lazy cold-start hydration.
- **LLM block-level prose (D11):** `materializeDocumentArtifact` calls
  `documentBlockProseGenerator.generateBlockProse` when `useLlm` is set,
  filling deterministic placeholder prose with grounded consulting narrative
  (Teresa via `aiService.generateChatResponse`). Best-effort: any LLM failure
  falls back to the deterministic schema unchanged.
- **PDF figure embedding:** `documentPdfRenderer` now embeds real figures from
  `image` blocks that carry inline bytes (`dataBase64` + optional
  `mimeType` / `widthCm`); blocks without bytes degrade to a numbered
  `Figure N — caption` placeholder. Cover-logo + chart rasterization were
  already wired.

## Current Risks

- LLM prose path depends on a configured LLM key; without it, generation
  silently falls back to deterministic placeholders (no failure surfaced to
  the user). OWNER action: provision / confirm the LLM key for production.
- Schema `artifactId` carried inside the persisted schema body still reflects
  the provisional pre-materialization id (pre-existing service behavior);
  artifacts are resolved by the canonical wave5 id, so this is cosmetic.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with the mounted route/component
  truth above.
- Consolidate the remaining in-memory registry DAOs (share-link, approval,
  audience, brand-voice) onto durable storage in follow-up slices.

## Function Coverage Status

- Canonical route: `/document-studio` (+ `/document-studio/:artifactId`).
- Legacy alias: `/wordy` -> redirect-only.
- Persistence DAO: `documentEditorStateRegistryDao.ts`.
- Migration: `server/migrations/20260603_document_studio_editor_state.sql`.
