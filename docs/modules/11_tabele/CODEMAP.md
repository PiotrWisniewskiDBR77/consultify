---
module_id: MODULE_TABLES
doc_kind: CODEMAP
version: 2.0
owner: user
status: canonical
last_updated: 2026-06-03
---

# Codemap — Tabele (Table Studio)

## Route / AppView / Sidebar (As-Is evidence)

- Sidebar entry: `MODULE_TABELE` (label `Tables`)
- Launch route: `/tabele` → mounts `TabeleView`
- Legacy route: `/excele` → permanent redirect to `/tabele`
  (`reason="excele_merged_into_table_studio"`)
- Evidence files: `src/components/navigation/Sidebar/menuConfig.ts`,
  `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`

## Routed Components

- `src/routes/AppRoutes.tsx` -> `ROUTES.TABELE` renders
  `TabeleView` (lazy: `@/components/AIChat/KimiWorkspace/TabeleView`)
- `ROUTES.EXCELE` renders a redirect element to `ROUTES.TABELE`
- `TabeleView` branches: legacy `KimiWorkspaceShell` (default) or
  `TabeleMelsView` (`ExecutiveModuleShell` adapter) when `ff_melsTabele` is ON
  (`src/utils/melsTabeleFlag.ts`). Default = `KimiWorkspaceShell`.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `TB_TABLE_RUNTIME` | `TabeleView` on `/tabele` | mounted real runtime (AI lane + builder deep-link). |
| `TB_EXCELE_REDIRECT` | redirect on `/excele` | merged into Table Studio. |

## Backend (server)

- Routes: `server/src/routes/table-platform.routes.ts` (core, mounted at
  `/api/table-platform`), plus additive sub-routers:
  `table-platform.ai-editor.routes.ts`, `table-platform.conversion.routes.ts`,
  QA / source-pack / form-intake routers.
- `requireTablePlatform` middleware gates authenticated endpoints on
  `ENABLE_TABLE_PLATFORM_RECORDS_API` (default ON) + live schema readiness.
- Services: `server/src/services/tablePlatform/**`
  - `RecordsService`, `MetadataService`, `RelationService` — record/schema CRUD.
  - `TableAiEditorService` + `TableAiEditorLevels/**` — 8-level AI editor.
    `MutationExecutor.ts` executes accepted proposals against real tables.
  - `TableArtifactConversionService` + `conversionMaterializer.ts` — table →
    document/presentation bridge via `registerArtifactOrigin`.
- Migration runner: `server/src/services/tablePlatform/migrationRunner.ts`
  (auto-discovers `7xx_*.sql` + `YYYYMMDD_*.sql`; run at boot from `index.ts`).

## Relevant Frontend Services / Types

- `src/services/api/tablePlatform.api.ts` (table-platform API client).
- `src/components/MyWork/table/**` (embedded builder + governed models).
- `src/components/Studio/**` (Tabele studio surfaces).

## Current Runtime Status

- Classification: `mounted + GA-backend`
- AI Editor apply path and artifact conversion materializer are both live
  (no longer stubs). MELS shell stays flag-gated until S4 visual review.
