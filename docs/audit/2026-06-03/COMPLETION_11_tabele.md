# Module 11 — Tabele / Table Studio — Completion to 100% Dossier

**Audit date:** 2026-06-03  
**Branch:** feat/wave1-foundations  
**Baseline scores:** 42/100 (2026-06-02) → 77/100 (2026-06-03, MODULE_11_tabele.md)  
**This dossier target:** full completion gap vs. GOAL (not MVP)

---

## 1. Purpose / Goal / Vision (far goal)

**Vision from docs/UI_UX/39_IDEAS_TABLES_UX.md + docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md:**  
Table Studio is Consultify's **AI Structured Thinking Table Engine** — not a mini-Excel, not a copy of Airtable. Every table is a *governed decision artifact*: versioned, source-attributed, scoring-enriched, approval-gated. The canonical user journey is:

> chaos (notes / interview / whiteboard / mindmap / process flow) → structure → scoring → decision → initiative → task → document / presentation / roadmap

Core objects: `TableArtifact` (owner, version, confidentiality, table_type), `TableRow` (source_references, linked artifacts), `TableCellValue` (provenance per field: fact/inferred/assumption/recommendation).  
Five non-negotiable layers: (1) Schema + CRUD, (2) Provenance + confidence per row/cell, (3) AI Editor 8-level propose/apply with approval gate, (4) QA engine (5-axis health score), (5) Conversion to downstream modules (doc/deck/initiatives/tasks).

**Current 77/100 is Beta, not Goal.** Records API is ON, apply mutations are real, conversion materializer is real — all behind feature-flag OFF by default. MELS shell (new UI) is also OFF. No virtual scrolling in `GridView.tsx`. No table-to-initiative/task pipeline. No Atelier Toys demo data.

---

## 2. Readiness to 100% — Score + Gap

### Verified state (code-level, not docs)

| Area | State | Evidence |
|---|---|---|
| Schema DDL (700–728 series + date files) | REAL | `migrationRunner.ts` pattern + `server/migrations/` |
| Records CRUD (`RecordsService.ts`) | REAL | full optimistic-lock, batch, upsert |
| `ENABLE_TABLE_PLATFORM_RECORDS_API` | ON by default | `FeatureFlags.ts:72` `!== 'false'` |
| AI Editor `applyProposal` | REAL (flag OFF) | `TableAiEditorService.ts:336-424` + `MutationExecutor.ts:131-268` |
| All 8 level handlers | `handlerStatus: 'live'` | `cellLevel.ts`, `columnLevel.ts`, `recordLevel.ts`, `structureLevel.ts`, `viewLevel.ts`, `relationalLevel.ts`, `methodologicalLevel.ts`, `sourceLevel.ts` |
| `ENABLE_TABLE_AI_EDITOR` | OFF by default | `FeatureFlags.ts:82` `=== 'true'` |
| Conversion materializer | REAL (flag OFF) | `conversionMaterializer.ts:62-117` → `registerArtifactOrigin` |
| `ENABLE_TABLE_ARTIFACT_CONVERSION` | OFF by default | `FeatureFlags.ts:100` |
| QA service (`TableQaService.ts`) | REAL (flag OFF) | 5-axis deterministic + `ENABLE_TABLE_QA_ENGINE` |
| Source Pack builder | REAL (flag OFF) | `SourcePackBuilderService.ts` + `ENABLE_TABLE_SOURCE_PACK` |
| GovernedModels edit | REAL | `GovernedModelsDashboard.tsx:708-751` `EditModelModal` |
| MELS shell (`TabeleMelsView`) | REAL but OFF | `melsTabeleFlag.ts:18` default OFF; `TabeleView.tsx:407` |
| AI Editor Panel UI | REAL but OFF | `TabeleAiEditorPanel.tsx:132` calls `applyAiProposal` |
| QA Panel UI | REAL but OFF | `TabeleQaPanel.tsx` + `QaAxisCard`, `QaHealthBar`, `QaSuggestionList` |
| Source Pack Panel UI | REAL but OFF | `TabeleSourcePackPanel.tsx` |
| Share/Conversion Panel UI | REAL but OFF | `TabeleSharePanel.tsx:177` calls `convertTable` |
| Right-rail panels wiring | REAL but OFF | `useTabeleRightRailPanels.tsx:100-103` checks 4 client flags |
| Migration timing (5 s async) | RISK | `index.ts:295-319` `setTimeout(..., 5000)` |
| `requireTablePlatform` — no `.catch()` | BUG | `table-platform.routes.ts:82-90` promise may hang |
| Virtual scrolling in `GridView` | MISSING | No `react-virtuoso` import in `GridView.tsx`; library present in `package.json:356` but unused |
| Table → Initiative / Task export | MISSING | No API call or UI flow exists in `IdeaTableTool.tsx` or `TabeleView` |
| Sidebar badge | MISSING | `menuConfig.ts:146-150` — no badge; sub-features gated OFF |
| Demo data (Atelier Toys / HBS) | MISSING | No seeded demo rows in `tabele_consulting_templates.ts` |
| Provenance flag | OFF | `ENABLE_RECORD_PROVENANCE` default `false` (`FeatureFlags.ts:25,77`) |

### Gap summary to 100%

Seven features are fully implemented server + client but unreachable because five env flags default OFF and two client flags default OFF (cascade from server). Three features are structurally absent (virtual scroll, table-to-execution, demo data).

---

## 3. Teresa / AI Editor Integration — Depth + Missing

### What exists (verified)

**8 levels, all `handlerStatus: 'live'`** (dispatcher: `TableAiEditorLevels/index.ts:54-63`):

| Level | Handler file | Propose | Apply |
|---|---|---|---|
| 1 cell | `cellLevel.ts` | live | `op_cell_set` → `RecordsService.updateRecord` |
| 2 record | `recordLevel.ts` | live | `op_record_update` → `RecordsService.updateRecord` |
| 3 column | `columnLevel.ts` | live | `op_column_fill` → `RecordsService.updateRecord` per cell |
| 4 structure | `structureLevel.ts` | live | `op_schema_add/rename/retype/drop_field` → `MetadataService` |
| 5 view | `viewLevel.ts` | live | `op_view_create/update` → `MetadataService.createView/updateView` |
| 6 relational | `relationalLevel.ts` | live | `op_relation_create` → `MetadataService.createField(linkedRecord)` |
| 7 methodological | `methodologicalLevel.ts` | live (read-only) | skipped: `read_only` |
| 8 source | `sourceLevel.ts` | live (read-only) | skipped: `read_only` |

**Apply path:** `TableAiEditorService.ts:406` → `executeProposalOperations` → `MutationExecutor.ts:277` — zod-validated, cross-tenant guarded, atomic (proposal stays `pending` on failure).

**QA engine** (`TableQaService.ts`): 5-axis (completeness, freshness, sourceCoverage, methodology, formulaConsistency), deterministic, debounced recompute on record writes. Suggestion → AI Editor handoff wired in `useTabeleRightRailPanels.tsx:65-80`.

**Source Pack** (`SourcePackBuilderService.ts`): curator-assembled snapshot → `sourcePackId` consumed by column/record/source level handlers. Wired in `TabeleSourcePackPanel.tsx` → `handleUsePackInAiEditor`.

### What is missing / gaps

1. **All 5 server flags OFF by default** — the entire Teresa stack never reaches users in any production deploy without explicit env opt-in. Fix is five lines in `FeatureFlags.ts`.
2. **Two client flags OFF** — `tabeleAiEditorFlag` and `tabeleQaFlag` mirror server flags; both default OFF. MELS shell must also be ON before the panels render at all.
3. **Level 7/8 (methodological, source) apply is read-only by design** — correct per spec, but no UI differentiation exists in `TabeleAiEditorPanel.tsx` — users see no visual cue that levels 7/8 produce findings only, not mutations. Missing: level metadata badge in `levelMeta.ts` labeling them "read-only".
4. **Budget gate** — `AiUsageService.ts` enforces per-org token budget. Budget cap is present but there is no admin UI to configure or view org budgets. Flag path only.
5. **`onAfterApply` refresh** — `TabeleAiEditorPanel.tsx:147` calls `onAfterApply?.()` but `TabeleMelsView.tsx` does not wire `onAfterApply` — canvas will not refresh after apply without additional wiring (`useTabeleRightRailPanels.tsx:47` defines the prop but `TabeleView.tsx` integration needs verification).

---

## 4. System Integration

### Table → Presentation (functional, flag-independent)
`ExportToPresentation.tsx:237` calls `Api.createPresentationDeck` directly — bypasses conversion service, works now.

### Table → Document / Deck via Conversion Service (flag-gated)
When `ENABLE_TABLE_ARTIFACT_CONVERSION` ON: `TabeleSharePanel.tsx:177` → `convertTable` API → `TableArtifactConversionService.ts:401` → `realArtifactMaterializer` → `registerArtifactOrigin` → `v8_output_artifacts` row + deep link to `/reports/builder/:id` or `/presentations/:id`. Fully wired. Problem: flag OFF by default, AND the share panel is only rendered when `isTabeleConversionsEnabled()` (client flag also OFF), AND the whole right rail only renders inside `TabeleMelsView` (MELS flag OFF). Three stacked gates.

### Table → Initiatives / Tasks (MISSING)
Vision doc (`39_IDEAS_TABLES_UX.md:73`) requires `Table-to-execution: top rows → initiative candidates / task candidates with link to source rows`. No implementation exists in `IdeaTableTool.tsx` or `TabeleView`. No API endpoint in `table-platform.routes.ts` or `my-work.routes.ts` for this handoff.

### MELS shell
`TabeleView.tsx:407` branches on `isMelsTabeleEnabled()` → legacy `KimiWorkspaceShell` (default) or `TabeleMelsView` (MELS). MELS shell contains all advanced right-rail panels (AI Editor, QA, Source Pack, Share/Conversions). Without MELS ON, users see zero Teresa features on `/tabele`.

### Outputs Hub integration
`realArtifactMaterializer` sets `canonicalHome = 'outputs_library'`, `visibilityScope = 'organization'` — conversion artifacts land in the Outputs hub correctly. Reverse (Outputs → open Table Studio) not implemented.

### Demo / Atelier Toys
`tabele_consulting_templates.ts` has no Atelier Toys or HBS seeded rows. Per v1 scope decisions `MEMORY.md`, Atelier Toys demo is a GA requirement.

---

## 5. Completion Plan to 100%

### P0 — Hard blockers (must fix before GA demo)

| # | Gap | Fix | File:line | Effort |
|---|---|---|---|---|
| P0-1 | `ENABLE_TABLE_AI_EDITOR` default OFF | Change `=== 'true'` to `!== 'false'` | `FeatureFlags.ts:82` | 1 line |
| P0-2 | `ENABLE_TABLE_QA_ENGINE` default OFF | Same pattern | `FeatureFlags.ts:88` | 1 line |
| P0-3 | `ENABLE_TABLE_SOURCE_PACK` default OFF | Same pattern | `FeatureFlags.ts:94` | 1 line |
| P0-4 | `ENABLE_TABLE_ARTIFACT_CONVERSION` default OFF | Same pattern | `FeatureFlags.ts:100` | 1 line |
| P0-5 | Client flags `ff_tabeleAiEditor`, `ff_tabeleQa`, `ff_mels_tabele`, `ff_tabele_conversions` all default OFF | Change `readEnvFlag()` defaults to `true` or set `VITE_*` env vars in production `.env` | `tabeleAiEditorFlag.ts:32`, `tabeleQaFlag.ts`, `melsTabeleFlag.ts:34`, `tabeleConversionsFlag.ts` | 4 files, 1 line each |
| P0-6 | `requireTablePlatform` no `.catch()` — silently hangs on DB error | Add `.catch((err) => next(err))` | `table-platform.routes.ts:82-90` | 1 line |
| P0-7 | Migration 5 s async window → `503 SCHEMA_NOT_READY` on cold deploy | Replace `setTimeout(5000)` with synchronous migration-then-listen or add `SCHEMA_NOT_READY` retry logic at client level | `server/src/index.ts:295-319` | ~20 lines |

### P1 — Critical gaps for GOAL (required before claiming 100%)

| # | Gap | Fix | File:line | Effort |
|---|---|---|---|---|
| P1-1 | GridView has no virtual scrolling — will degrade on large tables | Import `react-virtuoso` (already in `package.json:356`) and wrap row rendering in `<Virtuoso>` | `GridView.tsx:~400-600` | ~2h |
| P1-2 | Table → Initiative / Task export missing | Add `POST /api/table-platform/tables/:id/export-to-initiatives` route + `TableToInitiativeService.ts` mapping top-N rows to initiative candidates; add trigger button in `TableToolbar.tsx` | New service + route + UI | ~1d |
| P1-3 | `onAfterApply` not wired from `TabeleMelsView` → panel | Verify `TabeleView.tsx` passes `onAfterApply` to `useTabeleRightRailPanels`; if missing, add callback that calls `useKimiArtifactPipeline.refresh()` | `TabeleView.tsx:41-75` | ~1h |
| P1-4 | Level 7/8 no "read-only" badge in UI | Add `readOnly: true` to `levelMeta.ts` for methodological/source; render `(findings only)` chip in `TabeleAiEditorPanel` level selector | `tabeleShell/aiEditor/levelMeta.ts` | ~1h |
| P1-5 | Sidebar badge missing | Add `badge: 'beta'` to `MODULE_TABELE` entry matching Document Studio pattern | `menuConfig.ts:146` | 1 line |
| P1-6 | Atelier Toys / HBS demo data absent | Add seeded demo rows to `tabeleConsultingTemplatesSeeder.ts` for at least "Digital Transformation Prioritization" table with realistic Atelier Toys data | `seeds/tabeleConsultingTemplatesSeeder.ts` | ~2h |
| P1-7 | `ENABLE_RECORD_PROVENANCE` OFF — provenance cells inactive | Enable `ENABLE_RECORD_PROVENANCE !== 'false'` once Block B is GA-stable | `FeatureFlags.ts:77` | 1 line |

### P2 — Polish / completeness (goal = 100%)

| # | Gap | Fix | File:line | Effort |
|---|---|---|---|---|
| P2-1 | Budget admin UI absent | Add org-level AI budget config to admin panel | New component | ~1d |
| P2-2 | `STATUS.md` / `CODEMAP.md` stale | Update to reflect current routes, flag state, MELS architecture | `docs/modules/11_tabele/STATUS.md` | ~1h |
| P2-3 | No visual indicator when MELS panels are behind flags | Add `FLAG_OFF` state chip in `TabeleTopBarChips.tsx` for gated features | `TabeleTopBarChips.tsx` | ~1h |
| P2-4 | Migration silent-fail log gap | Change `migrationRunner.ts:120` warn to error + emit event that blocks `seedDefaultTemplates` call | `migrationRunner.ts:120-129` | ~30min |

---

## 6. Final Score Projection

| After P0 | After P0+P1 | After P0+P1+P2 |
|---|---|---|
| ~83/100 | ~93/100 | ~100/100 |

**P0 alone (7 fixes, mostly 1-liners)** unlocks the full Teresa stack + removes the DB hang risk — jump from 77 to ~83.  
**P1 adds** the three absent GOAL features (virtual scroll, table-to-execution, demo data) + small UX gaps — reaches ~93.  
**P2 polishes** admin tooling, stale docs, and UX indicator gaps — reaches 100.
