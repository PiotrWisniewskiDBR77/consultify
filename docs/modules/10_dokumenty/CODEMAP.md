---
module_id: MODULE_DOCUMENTS
doc_kind: CODEMAP
version: 2.0
owner: user
status: canonical
last_updated: 2026-06-03
---

# Codemap — Dokumenty / Document Studio

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_DOCUMENT_STUDIO` (label `Documents`, badge `beta`)
- Launch AppView: `AppView.WORDY` (resolves to the canonical Document Studio route)
- Canonical route: `/document-studio` (+ `/document-studio/:artifactId`)
- Legacy alias: `/wordy` -> redirect-only (`Navigate` to `/document-studio`)
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`,
  `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`

## Routed Components

- `src/routes/AppRoutes.tsx`:
  - `ROUTES.DOCUMENT_STUDIO` -> `DocumentStudioView` (wrapped in
    `ProtectedRoute`; the public-production hide gate is lifted)
  - `ROUTES.WORDY` -> `RedirectPreservingQuery` to `ROUTES.DOCUMENT_STUDIO`
    (reason `wordy_merged_into_document_studio`)
- `src/components/DocumentStudio/DocumentStudioView.tsx` — the real, mounted
  3-mode Document Studio (intake -> outline -> document).
- `src/components/AIChat/KimiWorkspace/WordyView.tsx` — deprecated
  (old `/api/report-builder` flow), no longer mounted.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `DOC_STUDIO_RUNTIME` | `DocumentStudioView` on `/document-studio` | canonical mounted runtime. |
| `DOC_WORDY_LEGACY` | `/wordy` redirect | redirect-only alias to the canonical route. |

## Relevant Services / Types (server)

- `server/src/routes/document-studio.routes.ts` — mounted at `/api/document-studio`.
- `server/src/services/documentStudio/documentStudioService.ts` — orchestrator
  (plan / materialize / get / export / proposals / lifecycle / rollback).
- `server/src/services/documentStudio/documentEditorStateRegistryDao.ts` —
  durable persistence for proposals / audit ledger / schema overlay
  (write-through behind the in-process cache).
- `server/src/services/documentStudio/documentBlockProseGenerator.ts` — D11
  block-level grounded prose generation (opt-in LLM, deterministic fallback).
- `server/src/services/documentStudio/documentPdfRenderer.ts` /
  `documentDocxRenderer.ts` — schema-aware renderers (PDF now embeds real
  `image`-block figures).
- Migration: `server/migrations/20260603_document_studio_editor_state.sql`.

## Relevant Services / Types (frontend)

- `src/components/DocumentStudio/api.ts` — typed client for `/api/document-studio`.
- `src/routes/routeConfig.ts` — `ROUTES.DOCUMENT_STUDIO`, `AppView.WORDY ->
  ROUTES.DOCUMENT_STUDIO`, and the `/document-studio*` -> `AppView.WORDY`
  reverse mapping.
- `src/types/core.ts` keeps enum identity for `AppView.WORDY`.

## Current Runtime Status

- Classification: `mounted + real_runtime`.
- This codemap is As-Is and reflects currently mounted route behavior.
