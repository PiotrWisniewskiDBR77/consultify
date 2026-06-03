# DEEP RE-VERIFICATION — Module 11: Tabele / Table Studio

**Audit date:** 2026-06-03 · **Method:** end-to-end stack trace, no builds.
**Verdict:** The most complete backend of the three studios — Records CRUD, 8-level AI editor apply, QA, conversion-to-Outputs are all REAL and wired. The defining issue is **gating**: the entire Teresa/AI stack is server-flag OFF + client-flag OFF + behind MELS-shell OFF. Reachable code, unreachable product.

---

## Per-feature table

| Feature | Stack path | Status | Evidence (file:line) |
|---|---|---|---|
| Records CRUD | `RecordsService.ts` (optimistic-lock, batch, upsert) → `table-platform.routes.ts` | WORKS (flag ON) | `FeatureFlags.ts:24,72` `ENABLE_TABLE_PLATFORM_RECORDS_API` default TRUE |
| AI Editor propose | `TabeleAiEditorPanel.tsx:132` → `TableAiEditorService.ts` proposeProposal | WORKS but GATED | server `FeatureFlags.ts:26,82` default FALSE; client `tabeleAiEditorFlag.ts:31,33` default FALSE |
| AI Editor apply (8 levels) | `TableAiEditorService.ts:406` → `executeProposalOperations` `MutationExecutor.ts` → `RecordsService.updateRecord` / `MetadataService` | WORKS but GATED | dispatcher `TableAiEditorLevels/index.ts`; all handlers `handlerStatus:'live'` |
| Levels 7/8 (methodological/source) | handlers | WORKS read-only by design (no mutation) | spec-correct; no UI badge differentiating |
| QA engine (5-axis) | `TableQaService.ts` → `TabeleQaPanel.tsx` | WORKS but GATED | `FeatureFlags.ts:27,88` default FALSE |
| Source Pack builder | `SourcePackBuilderService.ts` → `TabeleSourcePackPanel.tsx` | WORKS but GATED | `FeatureFlags.ts:28,94` default FALSE |
| Conversion → Outputs(09) | `TabeleSharePanel.tsx:177` → `convertTable` → `TableArtifactConversionService.ts:405` → `conversionMaterializer.ts:62,73` → `registerArtifactOrigin` (`artifactRegistryService.js:32`) → `v8_output_artifacts` | WORKS but GATED | `FeatureFlags.ts:29,100` default FALSE; client `tabeleConversionsFlag.ts:33` default FALSE |
| Table → Presentation (direct) | `ExportToPresentation.tsx:237` → `Api.createPresentationDeck` | WORKS (flag-independent) | bypasses conversion service |
| Table → Initiatives/Tasks | — | MISSING (no route, no UI) | vision `39_IDEAS_TABLES_UX.md:73` unmet |
| MELS shell (panels host) | `TabeleView.tsx:407` branch on `isMelsTabeleEnabled()` | GATED OFF → panels never render | `melsTabeleFlag.ts` env `VITE_MELS_TABELE` |
| Provenance per cell | `ENABLE_RECORD_PROVENANCE` | OFF | `FeatureFlags.ts:25,77` default FALSE |
| Virtual scrolling | `GridView.tsx` | MISSING (`react-virtuoso` in package.json unused) | perf risk on large tables |
| Demo data (Atelier Toys/HBS) | seeder | MISSING | no seeded rows |
| `onAfterApply` canvas refresh | `TabeleAiEditorPanel.tsx:147` | PARTIAL (prop defined, MELS wiring unverified) | `useTabeleRightRailPanels.tsx` |

---

## 4 Lenses

### Lens 1 — Functionalities
Records CRUD WORKS in production (only ON-by-default flag). Everything Teresa-related (AI editor propose/apply across all 8 levels, QA, source pack) is REAL code — `MutationExecutor` is zod-validated, cross-tenant-guarded, atomic (proposal stays `pending` on failure) — but unreachable due to stacked OFF flags. No virtual scroll = degradation risk. No table→execution pipeline.

### Lens 2 — Cross-module flow
- **Feeds Outputs(09):** YES and REAL. `conversionMaterializer.realArtifactMaterializer` (`:62`) calls `registerArtifactOrigin` writing a `v8_output_artifacts` row with `canonicalHome='outputs_library'` + deep link to `/reports/builder/:id` or `/presentations/:id`. This is the cleanest Outputs integration of the three studios — BUT triple-gated (server conversion flag + client conversions flag + MELS shell, all OFF).
- **Feeds Presentation(12):** YES, flag-independent, via `ExportToPresentation.tsx:237`.
- **Consumes org context / upstream:** Source Pack (`SourcePackBuilderService.ts`) assembles curated snapshots from Consultify artifacts as `sourcePackId` consumed by column/record/source handlers — but flag OFF. No automatic pull of initiatives/results/finance into a table.
- **Outputs → Table reverse:** NOT implemented.

### Lens 3 — Teresa wiring (real vs dead)
**REAL, not fake.** Unlike modules 10/12, the Table AI editor apply path goes through real services (`RecordsService`, `MetadataService`) with genuine mutation execution, and proposal generation uses `AiUsageService.ts` budget-gated LLM calls. All 8 level handlers report `handlerStatus:'live'`. The problem is 100% gating, not mockery: five server flags + four client flags + MELS shell default OFF. Flipping `FeatureFlags.ts:82,88,94,100` from `=== 'true'` to `!== 'false'` and the client flag defaults unlocks the full stack. Level 7/8 read-only is correct by spec but lacks a UI cue.

### Lens 4 — Contextual memory in generation
Source Pack is the contextual-memory mechanism: a curator-assembled snapshot (`SourcePackBuilderService.ts`) feeds `sourcePackId` into AI editor handlers for grounded fills/scoring with provenance (`fact/inferred/assumption/recommendation` per cell when `ENABLE_RECORD_PROVENANCE` ON). This is the richest provenance model of the three studios — but provenance flag is OFF and source pack flag is OFF, so users see neither today.

---

## P0 / P1 / P2

**P0 — unlock (mostly 1-liners)**
- P0-1..4 Flip server flags `!== 'false'`: `FeatureFlags.ts:82` (AI editor), `:88` (QA), `:94` (source pack), `:100` (conversion).
- P0-5 Flip client flag defaults true: `tabeleAiEditorFlag.ts:31`, `tabeleQaFlag.ts`, `melsTabeleFlag.ts`, `tabeleConversionsFlag.ts:33` (or set `VITE_*` in prod).
- P0-6 `requireTablePlatform` missing `.catch()` → add `.catch(next)`. `table-platform.routes.ts:82-90`.
- P0-7 Migration 5s async window → `503 SCHEMA_NOT_READY` on cold deploy. `server/src/index.ts:295-319`.

**P1**
- P1-1 Virtual scrolling — wrap `GridView.tsx` rows in `react-virtuoso` (already in package.json).
- P1-2 Table → Initiative/Task export (new route + service + toolbar button). Vision `39_IDEAS_TABLES_UX.md:73`.
- P1-3 Verify/wire `onAfterApply` from MELS view so canvas refreshes post-apply. `TabeleView.tsx` / `useTabeleRightRailPanels.tsx`.
- P1-4 Level 7/8 "read-only / findings-only" badge. `levelMeta.ts`.
- P1-5 `ENABLE_RECORD_PROVENANCE` enable once stable. `FeatureFlags.ts:77`.
- P1-6 Atelier Toys / HBS demo seed.

**P2**
- P2-1 Org AI-budget admin UI (`AiUsageService.ts` has cap, no config UI).
- P2-2 Reverse Outputs → open Table.
- P2-3 Migration silent-fail → error + block seeding. `migrationRunner.ts`.
