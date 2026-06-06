# Module 11 — Tabele — Readiness Scorecard

**Readiness: 42/100 — Tier: Alpha**
**Route(s):** `/tabele` (active, no badge, no gate — full sidebar entry); `/excele` redirects to `/tabele`; `/my-work/sheets/:workspaceId/tables/:tableId` (My Work table builder path); public form routes at `/api/table-platform/...` (backend flag-gated)
**One-line verdict:** The backend and My-Work table builder are substantially real and wired, but the flagship `/tabele` route lands on an AI-generation shell with no persistence path to production tables, the conversion materializer is a no-op stub, the AI Editor apply path returns `{applied: false, reason: 'stub_handler_no_op'}`, and the entire Records API is blocked behind an env flag defaulting OFF — making this Alpha, not Beta.

## Relationship to My Work Table tool

**Distinct surfaces, shared backend.** The My Work table tool (`src/components/MyWork/table/` + `IdeaTableTool.tsx` + `IdeasTableContent.tsx`) is embedded inside the My Work workspace (`/my-work/ideas/:id/workspace/table`) and calls the same `/api/table-platform` backend via `tablePlatform.api.ts`. The standalone `/tabele` route (`TabeleView` → `KimiWorkspaceShell` / `TabeleMelsView`) is a separate AI-generation lane that produces table artifacts and deep-links into the builder. These are **not duplicate code** — they share the backend (`tp_bases`, `tp_tables`, `tp_records` schema) but have entirely different UI surfaces. The "Tabele Studio" catalog duplicate noted in docs (`02_SCOPE.md:26`) refers to the old `MODULE_EXCELE` sidebar entry, which now redirects to `/tabele` (`AppRoutes.tsx:1408-1415`).

## What's REAL (verified + backend-wired)

- Core schema DDL: `server/migrations/700_table_platform_foundation.sql` — `tp_bases`, `tp_tables`, `tp_fields`, `tp_views`, `tp_records` created
- Records CRUD: `server/src/services/tablePlatform/RecordsService.ts` — full optimistic-lock, batch, upsert, bulk-delete implementation
- Metadata API: `server/src/routes/table-platform.routes.ts` — 197 `router.*` endpoints mounted at `/api/table-platform` via `Gateway.ts:892-902`
- AI Editor Levels 1–4 (cell, record, column, structure): `handlerStatus: 'live'` in `TableAiEditorLevels/cellLevel.ts:58`, `columnLevel.ts:62`, `recordLevel.ts`, `structureLevel.ts`
- AI Editor Levels 5–8 (view, relational, methodological, source): also ship `handlerStatus: 'live'` (`viewLevel.ts:58`, `relationalLevel.ts:58`, `methodologicalLevel.ts:69`, `sourceLevel.ts:73`)
- Schema migrations 700–723 series: `server/migrations/700–723_*.sql` — automations, webhooks, form intake, sync all present
- My Work Table builder: `IdeaTableTool.tsx` calls `TablePlatformApi.listBases`, `getBase`, `createTable`, `deleteTable`, `undoRecordEdit` (lines 739–1156) — real backend calls
- Socket.IO realtime namespace: `server/src/index.ts:1770` — `tablePlatformRealtime.init(io)` initialized at boot
- Test coverage: 30+ server-side test files under `server/src/services/tablePlatform/__tests__/`, front-end tests in `src/components/MyWork/table/__tests__/`, `tabeleShell/__tests__/`

## What's MOCK / hardcoded / stub

- **AI Editor apply path**: `TableAiEditorService.ts:343-351` — `applyProposal` returns `{applied: true, reason: 'stub_handler_no_op'}` regardless of operations; the level handlers produce proposals but nothing actually mutates records
- **Artifact conversion materializer**: `TableArtifactConversionService.ts:397-412` — `stubMaterializer` returns `stub-run-{conversionId}` with `artifactDeepLink: null`; comment says D-S3 will wire real adapter
- **Governed models edit**: `GovernedModelsDashboard.tsx:860` — click handler shows toast `'Edit — coming soon'`
- **MELS shell (new layout)**: `melsTabeleFlag.ts` — `isMelsTabeleEnabled()` defaults OFF; `TabeleView.tsx:407` branches to legacy `KimiWorkspaceShell` unless env var or localStorage override set

## What's BROKEN / NO_GO / missing

- **Records API env-gated OFF by default**: `featureFlags.ENABLE_TABLE_PLATFORM_RECORDS_API` defaults `false` (`FeatureFlags.ts:24,67`); all authenticated table endpoints return `404` without the env var set — the My Work table builder silently fails in any deployment without explicit opt-in
- **`applyProposal` is a no-op**: AI Editor panel lets users accept proposals but they are never applied to real records (`TableAiEditorService.ts:343`)
- **Artifact conversion no-op**: Converting a table artifact to a downstream format produces a placeholder run id and no deep link (`TableArtifactConversionService.ts:399-410`) — Block D is unshipped
- **No migration runner guarantee**: `server/src/index.ts:298` imports migration runner conditionally; if `tp_bases` table is missing the route responds `503 SCHEMA_NOT_READY` — there is no automated migration gate at deploy time
- **Doc-vs-code drift on STATUS.md**: `STATUS.md` still describes `/excele` rendering `V4ComingSoonView` and `ExceleView` as "not mounted" — both are outdated; `AppRoutes.tsx:1408` redirects `/excele` to `/tabele`, and `/tabele` mounts `TabeleView` (not `V4ComingSoonView`)

## Backend wiring

Routes are registered unconditionally in `Gateway.ts:892-902`. The `requireTablePlatform` middleware (`table-platform.routes.ts:77-91`) gates every authenticated endpoint behind `ENABLE_TABLE_PLATFORM_RECORDS_API` (env, default OFF) AND a live DB schema check. Realtime (Socket.IO) and migration runner are wired at boot. Sub-routes (AI editor, QA, form intake, source pack, conversion, relations explain, record sources, form public) are all registered. The `ENABLE_TABLE_PLATFORM_METADATA_FIRST` flag is referenced only in `my-work.routes.ts:3411` — it gates a single branch in My Work, not the table platform core.

## UI/UX consistency

`TabeleView` uses `KimiWorkspaceShell` (legacy lane shell) by default, or `TabeleMelsView` (`ExecutiveModuleShell` adapter) behind the `ff_melsTabele` flag. The My Work embedded table builder (`IdeaTableTool.tsx`) uses its own bespoke toolbar and layout — it does not use the shared `ExecutiveModuleShell`. The sidebar shows `MODULE_TABELE` with no badge (no `soon` marker), which implies readiness that does not match the alpha state.

## Tests

Present and substantial: 30+ server-side unit tests for services (`RecordsService`, `AutomationService`, `SchemaValidationService`, `FormIntakeService`, `ViewQueryEngine`, `ExportService`, formula engine, migration runner, etc.); 8 AI Editor level tests; 5 provenance cell tests; frontend integration tests for `TablePlatformFrontend`, cell renderers, form pages, QA panel, AI editor panel, MELS routing. Test depth is above average for an alpha module.

## Doc-vs-code drift

`STATUS.md` and `CODEMAP.md` (both dated 2026-05-09) are stale: they describe `/excele` as the launch route showing `V4ComingSoonView` with `ExceleView` "imported but not mounted." In reality `AppRoutes.tsx:1408-1446` redirects `/excele` → `/tabele` and mounts `TabeleView` (which uses `KimiWorkspaceShell` or `TabeleMelsView`). The KNOWN_TRUTH matrix (`_KNOWN_TRUTH_MODULE_AUDIT_MATRIX_2026-05-09.md:53`) captured this as a gap. The rest of the module docs (behavior, scope, permissions, acceptance) are contract-level only and not contradicted by code.

## Top gaps to reach market-ready (prioritized)

1. **Flip `ENABLE_TABLE_PLATFORM_RECORDS_API` to ON and verify migrations run** — nothing works in any deployment without this; requires migration runner to execute 700-series SQL before first request or at deploy-time
2. **Wire `applyProposal` to real record mutations** — `TableAiEditorService.applyProposal` is a tracked no-op; complete the C-S2/C-S3 level handler wiring so accepted AI proposals actually modify `tp_records`
3. **Replace `stubMaterializer` with real artifact bridge** — `TableArtifactConversionService` Block D materializer must call `artifactRegistryService.materializeArtifactRun`; without this, table-to-artifact export is broken
4. **Update STATUS.md and CODEMAP.md** — current `/excele` → `/tabele` redirect and `TabeleView` mount are not documented; stale docs will mislead future agents
5. **Remove or complete "Edit — coming soon" in GovernedModelsDashboard** — `GovernedModelsDashboard.tsx:860` is a visible stub in an otherwise wired panel
6. **Enable MELS shell by default** — `isMelsTabeleEnabled()` defaults OFF; the new `ExecutiveModuleShell` adapter should ship as the primary layout once EPIC-T16-S4 visual review passes
