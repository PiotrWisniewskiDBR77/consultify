# Module 11 — Tabele / Table Studio — Readiness Scorecard
**Audit date:** 2026-06-03 · Branch: feat/wave1-foundations
**Baseline:** 2026-06-02 → 42/100 (Tier: Alpha)

---

## Score

| Dimension | 2026-06-02 | 2026-06-03 | Δ |
|---|---|---|---|
| Records API / CRUD | 5 | 18 | +13 |
| AI Editor apply | 0 | 12 | +12 |
| Conversion materializer | 0 | 10 | +10 |
| GovernedModels edit | 0 | 8 | +8 |
| Migration runner / boot | 4 | 7 | +3 |
| MELS shell / UI | 4 | 6 | +2 |
| Tests / Coverage | 14 | 14 | 0 |
| Sidebar / badge | 3 | 2 | -1 |
| **Total** | **42** | **77** | **+35** |

**Readiness: 77/100 — Tier: Beta**
**Hard gates for GA:** flip AI Editor + Conversion flags ON; harden migration boot timing.

---

## Verdict

Four of the five P0 blockers from the 2026-06-02 audit are resolved in code on feat/wave1-foundations. Records API defaults ON. `applyProposal` drives real `tp_records`/`tp_fields` mutations via a complete `MutationExecutor`. The D-S1 `stubMaterializer` is replaced by production `realArtifactMaterializer` wired to `registerArtifactOrigin`. GovernedModels "Edit — coming soon" is replaced by a real `EditModelModal`. Remaining blockers: AI Editor and artifact conversion are fully implemented but still flag-gated OFF by default; migrations run 5 s post-boot in background creating a `503 SCHEMA_NOT_READY` window on cold deploys; sidebar shows no badge despite sub-features being disabled.

---

## 1. Functionality — REAL / MOCK / BROKEN

### Records CRUD — REAL
`server/src/config/FeatureFlags.ts:24,72` — `ENABLE_TABLE_PLATFORM_RECORDS_API` schema default `true`, env gate `process.env.ENABLE_TABLE_PLATFORM_RECORDS_API !== 'false'` — **ON by default** (was OFF in May). `requireTablePlatform` middleware at `server/src/routes/table-platform.routes.ts:77-91` gates all authenticated table endpoints; blocked only if env var is explicitly `'false'`.

`RecordsService.ts` — `createRecord`, `updateRecord`, `deleteRecord` issue real `INSERT`/`UPDATE`/`DELETE` against `tp_records` with optimistic locking, audit trail, and batch/upsert paths. Real.

### AI Editor apply — REAL (flag OFF by default)
`FeatureFlags.ts:26,82` — `ENABLE_TABLE_AI_EDITOR` defaults `false`; route gated at `table-platform.ai-editor.routes.ts:76`.

`TableAiEditorService.ts:336-424` — `applyProposal` is a full implementation: fetches proposal row, resolves org, calls `executeProposalOperations`, then flips proposal status in DB. **No stub path remains** (the C-S1 `stub_handler_no_op` comment at line 7 of MutationExecutor.ts refers to what was *replaced*).

`MutationExecutor.ts:131-268` — 11 real operation handlers (`op_cell_set`, `op_record_update`, `op_record_create`, `op_column_fill`, `op_schema_add_field`, `op_schema_rename_field`, `op_schema_retype_field`, `op_schema_drop_field`, `op_view_create`, `op_view_update`, `op_relation_create`). All 8 AI editor levels return `handlerStatus: 'live'` (verified across cellLevel.ts, columnLevel.ts, recordLevel.ts, structureLevel.ts, viewLevel.ts, relationalLevel.ts, methodologicalLevel.ts, sourceLevel.ts). Levels 7/8 correctly short-circuit as read-only in MutationExecutor.

### Conversion materializer — REAL (flag OFF by default)
`FeatureFlags.ts:29,100` — `ENABLE_TABLE_ARTIFACT_CONVERSION` defaults `false`.

`conversionMaterializer.ts:62-117` — `realArtifactMaterializer` calls `registerArtifactOrigin` (`server/src/services/v8/artifactRegistryService.ts:1102`) with tenant-scoped payload, receives a real UUID `artifactId`, returns deep link (`/reports/builder/:id` or `/presentations/:id`). `TableArtifactConversionService.ts:401-410` lazy-imports `realArtifactMaterializer` as production default. The D-S1 `stubMaterializer` is gone.

### GovernedModels edit — REAL
`GovernedModelsDashboard.tsx:708-751` — `EditModelModal` calls `Api.updateGovernedModel` hitting `PATCH /api/table-platform/governed-models/:id`; service calls `UPDATE tp_governed_models`. No "coming soon" stub. `GovernedModelsDashboard.tsx:1144` renders `<EditModelModal>` conditionally when `editModel !== null`.

### Migration runner — REAL (timing risk)
`server/src/index.ts:295-319` — migrations run via `setTimeout(..., 5000)` (5 s post-boot), non-blocking. `migrationRunner.ts` pattern `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/` matches all 700-series (`700_table_platform_foundation.sql` … `728_beta_missing_tables_2.sql`) and 8-digit date files (`20260508_block_c_ai_operator.sql`, `20260512_block_d_table_conversions.sql`, etc.). On a fresh DB, the first request within the 5 s window hits `checkSchemaReady()` → `SELECT 1 FROM tp_bases LIMIT 0` → fail → `503 SCHEMA_NOT_READY`.

**Additional risk:** `requireTablePlatform` at `table-platform.routes.ts:82-90` calls `checkSchemaReady().then(...)` with **no `.catch()`**; if the DB query throws (e.g., connection failure), the promise rejects silently and the request hangs with no response.

---

## 2. Intra-module flow & states

`/tabele` → `TabeleView.tsx:407` → branches on `isMelsTabeleEnabled()` (default OFF per `melsTabeleFlag.ts:18`) → legacy `KimiWorkspaceShell`. MELS shell (`TabeleMelsView` / `ExecutiveModuleShell` adapter) is fully implemented with `TabeleAiEditorPanel`, `TabeleQaPanel`, `TabeleSharePanel`, `TabeleSourcePackPanel`, `TabeleTopBarChips` (all in `tabeleShell/`), but gated behind env var or localStorage. My Work table builder (`IdeaTableTool.tsx`) shares backend via `tablePlatform.api.ts`; separate UI surface with no MELS dependency. Socket.IO realtime namespace initialized at boot (`index.ts:1770`).

---

## 3. UI/UX adherence

Design system tokens used consistently: `navy-950`, `navy-700`, `rounded-2xl`, `crimson-500/40` focus rings throughout `GridView.tsx`, `GovernedModelsDashboard.tsx`, `ExportToPresentation.tsx`. MELS shell flag still OFF — users land on legacy `KimiWorkspaceShell` on prod. Sidebar shows `MODULE_TABELE` with **no badge** (`menuConfig.ts:146-150`) while AI Editor, QA, Source Pack, and Conversion remain flag-gated OFF — badge gap misrepresents readiness.

---

## 4. Cross-module handoffs

- **Table → Presentation:** `ExportToPresentation.tsx` calls `Api.createPresentationDeck` directly — bypasses conversion service, works regardless of `ENABLE_TABLE_ARTIFACT_CONVERSION`. Functional.
- **Table → Document Studio (conversion service):** Flag OFF by default. When ON, `realArtifactMaterializer` writes to `v8_output_artifacts` and returns deep link to `/reports/builder/:id`. No UI trigger exists yet in `IdeaTableTool.tsx` or `TabeleView` to initiate conversion — flag-flip alone does not surface the feature.
- **Outputs → Table Studio:** No inbound handoff. Conversion creates an artifact in the Outputs library; the reverse (Outputs opening a Table Studio table) is unimplemented.
- **Table → artifact Outputs hub:** `realArtifactMaterializer` uses `registerArtifactOrigin` with `canonicalHome = 'outputs_library'` and `visibilityScope = 'organization'` — produces correctly scoped output artifacts.

---

## 5. Risks / Regressions / Runtime

| Risk | Severity | Evidence |
|---|---|---|
| 503 on fresh deploy (5 s window) | Medium | `index.ts:295` — migrations async; `checkSchemaReady` returns false until applied |
| No `.catch()` on `requireTablePlatform` | Medium | `table-platform.routes.ts:82-90` — DB error during schema check hangs request |
| AI Editor / QA / Conversion defaulting OFF | Medium | `FeatureFlags.ts:26-29` — four advanced features require explicit env opt-in |
| Migration error silently skipped | Low | `migrationRunner.ts:120-129` — failed SQL logged as warn but still inserted into history |
| No sidebar badge vs. flag-gated features | Low | `menuConfig.ts:146` — no badge misrepresents readiness |
| MELS shell still OFF | Low | `melsTabeleFlag.ts:18` — not shipped as default |

---

## Top gaps to reach 100

1. **Flip `ENABLE_TABLE_AI_EDITOR` + `ENABLE_TABLE_ARTIFACT_CONVERSION` ON** — backend is fully wired; these flags are the only blocker for the apply and conversion flows reaching users.
2. **Add `.catch(next)` to `requireTablePlatform`** — `table-platform.routes.ts:82` — missing error handler silently hangs requests when DB is unavailable.
3. **Harden boot timing** — replace `setTimeout(5000)` migration deferral with a synchronous `checkSchemaReady` poll before accepting HTTP traffic, or add retry logic on `503 SCHEMA_NOT_READY`.
4. **Wire conversion lane UI** — add a conversion trigger in `IdeaTableTool.tsx` or `TabeleView`; flag-flip alone does not surface the `Table → Document/Deck` feature to users.
5. **Add `beta` sidebar badge** — `menuConfig.ts:146` should match Document Studio's badge pattern until all sub-features are ON and MELS is default.
6. **Enable MELS shell by default** — `melsTabeleFlag.ts` hard defaults OFF; unblock once EPIC-T16-S4 review passes.
