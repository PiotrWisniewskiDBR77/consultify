# P15 Tabele — Integration Report (2026-04-11)

## Purpose: Module Role in the Application

The P15 Tabele module serves as the **Table Operating System** for the entire Consultify/V8 platform. Its purpose is to provide a **single relational grammar** (`base → table → field → record → relation → view → form → interface`) that all modules can use for structured data management, eliminating the need for per-module "config tables."

### Strategic Role

1. **Central data substrate**: Any module needing user-structured tabular data (ideas, projects, tracking, reporting) should use Table OS rather than implementing custom database schemas
2. **AI-governed mutations**: The describe → plan → preview → approve → materialize pipeline ensures all AI-driven schema changes are auditable and reversible
3. **Multi-role collaboration**: The 7-role permission model enables fine-grained access control per base, supporting team collaboration workflows

## Integration Points

### 1. IdeaMapWorkspace (Primary Mount Point)

**Status: INTEGRATED**

| Component | Path | Role |
|---|---|---|
| `IdeaMapWorkspace` | `src/components/MyWork/IdeaMapWorkspace.tsx` | Mounts `IdeaTableTool` when `activeTool === 'table'` |
| `IdeaTableTool` | `src/components/MyWork/IdeaTableTool.tsx` | Production shell wrapping P15 stack |
| `TableDataProvider` | `src/components/MyWork/table/TableDataProvider.tsx` | React Context centralizing platform state |
| `ViewRouter` (P15) | `src/components/MyWork/table/ViewRouter.tsx` | Central view dispatcher |
| `TableToolbar` | `src/components/MyWork/table/TableToolbar.tsx` | Extracted floating toolbar |

The P15 stack is mounted when `usePlatform=true` (platform table detected). Legacy fallback preserved for non-platform tables.

### 2. AI Chat Integration

**Status: INTEGRATED**

| Component | Path | Role |
|---|---|---|
| `ChatTableProposalCard` | `src/components/AIChat/ChatTableProposalCard.tsx` | Schema proposals from chat |
| `useKimiArtifactPipeline` | `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | Governed sheet/XLSX flows via `TablePlatformApi` |
| `ChatToSchemaPanel` | `src/components/MyWork/table/ChatToSchemaPanel.tsx` | Inline AI schema assistant in toolbar |

### 3. V8 Artifact Registry

**Status: INTEGRATED**

| Component | Path | Role |
|---|---|---|
| `artifactRegistryService` | `server/src/services/v8/artifactRegistryService.ts` | `registerGovernedTableSheetArtifact` uses `tp_tables.id` as `originRecordId` |
| Sheet materialization | Same file | Auto-creates `tp_tables` row via `MetadataService.createTable` |

V8 governed sheets are **first-class Table Platform tables**, not a parallel store.

### 4. Public Forms

**Status: INTEGRATED**

| Route | Component | Path |
|---|---|---|
| `/forms/:slug` | `PublicFormPage` | `src/components/MyWork/table/forms/PublicFormPage.tsx` |
| `/api/table-platform/public/forms/:slug` | Server route | `server/src/routes/table-platform.routes.ts` |

### 5. Public Shared Views

**Status: INTEGRATED** (newly added)

| Route | Component | Path |
|---|---|---|
| `/public/views/:token` | `PublicViewPage` | `src/components/MyWork/table/PublicViewPage.tsx` |
| `/api/table-platform/public/views/:token` | Server route | `server/src/routes/table-platform.routes.ts` |

### 6. Deep Links

**Status: INTEGRATED**

| Utility | Path | Pattern |
|---|---|---|
| `buildMyWorkSheetTableOpenPath` | `src/utils/artifactLinks.ts` | `/my-work/ideas/:workspaceId/workspace/table?tpTable=...` |
| `sheetArtifactOpen` | `src/utils/sheetArtifactOpen.ts` | Resolves workspace via `getTable`/`getBase` |

## Anti-Duplicate Gate Analysis

### Modules correctly using Table OS

| Module | How it uses Table OS |
|---|---|
| Idea workspace | Primary table tool via `IdeaTableTool` |
| AI chat | Schema proposals, governed sheets |
| V8 artifacts | Sheet artifacts map to `tp_tables` |
| Public forms | Form submissions create `tp_records` |

### Modules with own domain tables (NOT duplicates)

These modules use **application-specific relational tables** (not user-configurable spreadsheet-like structures):

| Module | Tables | Justification |
|---|---|---|
| Initiatives | `initiatives`, `initiative_*` | Fixed-schema domain entities |
| Report builder | `report_builder_*` | Report composition metadata |
| Admin panel | Various admin tables | System configuration |
| User management | `users`, `organizations` | Core identity |

These are **not** violations of the anti-duplicate gate — they are bounded-context domain tables, not parallel "Table OS" implementations.

### Generic table UI components (NOT duplicates)

| Component | Path | Role |
|---|---|---|
| `DataTable` | `src/components/ui/composed/DataTable.tsx` | Design system list/table primitive |
| `EnhancedDataTable` | `src/components/Admin/shared/EnhancedDataTable.tsx` | Admin panel data display |

These are **presentation components**, not metadata-first bases/fields/records platforms.

## API Coverage

### Client API (`tablePlatform.api.ts`)

The client API covers the primary product surface:
- Bases, tables, fields, views, records CRUD
- Imports (CSV, XLSX), exports
- Chat-to-schema (propose, execute, reject, refine)
- Audit log, bulk operations
- Links, attachments, forms, comments, watches
- Templates, shared views, webhooks
- Governed models, module sync
- Automations, syncs, collaborators

### Gaps (by design)

Some server routes are **not** exposed in the client API:
- Health check, migrations (operator/server-only)
- `register-sheet-artifact` (server-to-server)
- Some admin-only endpoints

These omissions are intentional — they are not needed by the frontend.

## App Integration Update (2026-04-11)

Following a comprehensive integration audit, the following new connection points were implemented:

### 7. Chat <-> Table Bidirectional Context

**Status: INTEGRATED** (newly added)

| Component | Path | Role |
|---|---|---|
| `onTableContextChange` callback | `IdeaTableTool.tsx` | Pushes base/table/view/field/record metadata to workspace context |
| `MyWorkHub` context propagation | `MyWorkHub.tsx` | Includes table context in `entityData` passed to `UnifiedChatPanel` |
| `ChatToSchemaPanel` from toolbar | `ViewRouter.tsx` | Renders AI schema panel when `ui.showChatToSchema` is triggered |
| `ChatTableProposalCard.onNavigateToTable` | `MessageRenderer.tsx` | Navigates to table deep link when proposal card is clicked |
| `table_proposal` metadata | `ChatToSchemaPanel.tsx` | Passes structured result to `onExecuted` for chat message rendering |

### 8. Organization Context

**Status: INTEGRATED** (newly added)

| Component | Path | Role |
|---|---|---|
| `OrgMemberSyncService` | `server/src/services/tablePlatform/OrgMemberSyncService.ts` | Syncs org members to `tp_base_members` with `viewer` default role |
| Auto-sync on base creation | `MetadataService.createBase` | Calls `syncOrgMembersToBase` after INSERT |
| Manual sync route | `POST /bases/:baseId/sync-members` | Allows manual triggering of org member sync |
| Per-org quota middleware | `checkOrgQuota` in `table-platform.routes.ts` | Checks record limits per org plan on create/batch routes |

### 9. Navigation Enhancements

**Status: INTEGRATED** (newly added)

| Feature | Path | Role |
|---|---|---|
| Breadcrumb `base > table > view` | `ViewRouter.tsx` | Shows hierarchical navigation at top of view area |
| View bookmark URL `?tpView=` | `IdeaMapWorkspace.tsx` + `ViewRouter.tsx` | Syncs active view to URL for bookmarking/sharing |
| Global record search | `GET /search` in `table-platform.routes.ts` | Full-text search across all org records with deep links |
| `searchRecordsGlobal` client API | `tablePlatform.api.ts` | Client-side API method for global search |
| ActivityFeed API fix | `ActivityFeed.tsx` | Corrected path to `/api/table-platform/tables/:id/audit` |

### 10. AI Context

**Status: INTEGRATED** (newly added)

| Component | Path | Role |
|---|---|---|
| `TableContextService` | `server/src/services/tablePlatform/TableContextService.ts` | Builds concise table summary for AI prompts |
| AI memory context injection | `aiMemory.routes.ts` `/context` | Appends TABLE DATA section to AI system prompt |
| `GET /table-context` endpoint | `aiMemory.routes.ts` | Standalone table context fetch for AI |

### 11. Record Watch & @Mentions

**Status: INTEGRATED** (newly added)

| Feature | Path | Role |
|---|---|---|
| Watch toggle button | `RowDetailPanel.tsx` | Eye/EyeOff button in record detail header |
| @mention autocomplete | `RowDetailPanel.tsx` comments section | User mention suggestions with org member lookup |
| `mentions` field in comments | `tp_record_comments` migration | JSONB column storing mentioned user IDs |

### 12. Cross-Module Link Fixes

**Status: INTEGRATED** (newly added)

| Fix | Path | Description |
|---|---|---|
| ExceleView deep link | `ExceleView.tsx` | Uses `buildMyWorkSheetTableOpenPath` with proper ideaId |
| ChatToSchema workspaceId | `UnifiedChatPanel.tsx` | Falls back to `tableContext.baseId` when `entityId` is empty |

## Conclusion

The P15 Tabele module is **fully integrated** into the application's core workflows. All major integration points — idea workspace, AI chat (bidirectional context), V8 artifacts, public forms/views, deep links, organization context, navigation, record subscriptions, and cross-module linking — use the Table Platform as the single source of truth. No duplicate "Table OS" implementations were found outside the module.
