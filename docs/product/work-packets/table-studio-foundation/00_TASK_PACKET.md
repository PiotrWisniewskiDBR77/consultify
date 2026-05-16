# Task Packet — Table Studio Foundation Block

**Block ID:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`
**Created:** 2026-05-07
**Status:** `APPROVED — Wave 1 IN PROGRESS; D1=TabeleView visible, D2=reuse existing services, D3=STOP-and-file P0`
**Lane SSOT:** `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`

---

## 1) Goal

Stand up the foundation block of the **Tabele (Table Studio)** artifact lane in Consultify so the user can converse with an AI in a Word-style document canvas (chat ↔ document preview, identical idiom to `/wordy`) to generate, govern, and operate relational tables, with full materialization origin to the existing Table Platform and a deep link to the Table Builder. The block delivers (a) the new Tabele artifact lane (frontend parity with Wordy/Excele/Prezentacje), (b) a Word-canvas preview surface (cover, KPI strip, schema, records, relations, AI rationale), (c) one new backend capability — relation explainability — that is genuinely missing, and (d) reuse of the already-implemented schema-proposal governance pipeline (`ChatToSchemaService` + `/schema/proposals/*` routes + `AuditService`).

## 2) Non-Goals

- No modifications to `MyWork/table/ViewRouter.tsx`, `TableDataProvider.tsx`, `TableToolbar.tsx`, `TableTabStrip.tsx`, `tableTypes.ts`.
- No changes to `routes/table-platform.routes.ts` (relation explainability lives in a NEW additive router file).
- No duplicate `SchemaGovernanceService` / `TableMutationAuditService` (reuse `ChatToSchemaService` and `AuditService`).
- No changes to `WordyView`, `PrezentacjeView`, `ExceleView`.
- No changes to `ReportsAndPresentations/*`.
- No new DB migration in this block (governance/audit/relation tables already exist; relation-explanation cache deferred).
- No formula engine, automation engine, computed columns, real-time presence/CRDT.
- No edits to `UnifiedChatPanel` internals (only its `systemPrompt` prop is set from the lane).
- No new icon library; reuse `lucide-react`.

## 3) Constraints

### Technical
- Must run on existing stack: React 19 + TypeScript 5.8, Express 5, Postgres 8, Vitest 4, Playwright 1.57.
- Frontend must extend `KimiLane` union additively; touching ~7 lane-specific switch arms in `useKimiArtifactPipeline.ts` is allowed but each must be covered by a test.
- Backend new route must mount additively from `server/src/index.ts`; no edits to existing `tablePlatformRoutes` mount.
- Tests must follow existing layout: frontend unit tests under `tests/unit/backend|frontend/...` and component tests under `tests/components/...`; backend tests under `consultify/server/tests/`.

### Product/UX
- DBR77 Tech Sexy 2027 monochrome palette; semantic accents only on lifecycle/AI signals; **lane accent = `sky`** (D2 confirmed in plan).
- Word-canvas preview = sectioned, scrollable, document-style — NOT a bare grid.
- AI buttons live ONLY in `KimiWorkspaceShell` header right-slot (Menu 3 placement). Never in the canvas body.
- Builder deep-link uses **Option A**: `/my-work/sheets/:workspaceId/tables/:tableId` opened in a new tab with a transition toast and preserved back-nav.
- Save State vs Lifecycle State must be visually distinct (e.g., autosave dot vs governance proposal pill).

### Safety / security
- Tenant/ACL: every backend endpoint resolves `tenant_id` from auth context; cross-tenant reads/writes return 403.
- Governance invariant: every AI-driven schema mutation goes through `proposal → approval → execution → audit`. The Tabele canvas surfaces governance state honestly (no silent execution).
- Relation explainability filters target records by ACL before returning rationale (no exposure of records the actor cannot read).
- No prompt-injection from record body content into governance reasoning (record snippets are quote-fenced; no tool-calls accepted from record body).
- No hidden writes; no hidden learning behavior.

## 4) Scope

### In scope — files to CREATE

**Frontend (lane + preview + utilities)**
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleSystemPrompt.ts`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/__tests__/TabeleView.test.tsx`
- `consultify/src/utils/tabeleArtifactOpen.ts`
- `consultify/src/types/tabeleArtifact.ts`

**Backend (only the genuinely missing piece)**
- `consultify/server/src/services/tablePlatform/RelationExplainabilityService.ts`
- `consultify/server/src/routes/table-platform.relations-explain.routes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/RelationExplainabilityService.test.ts`
- `consultify/server/src/routes/__tests__/table-platform.relations-explain.test.ts`

**Docs / SoT**
- `consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`
- This packet folder (already partially in place).

### In scope — files to UPDATE (additive only)

- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — widen `KimiLane` union to include `'tabele'`; add `LANE_CONFIG.tabele` (icon `Table`, accent `sky`); add `'tabele'` to `ArtifactPreviewType`; extend `ArtifactPreview` with optional fields (`tabeleSchemaFields?`, `tabeleRelations?`, `tabeleRationale?`, `tableId?`); render `<TabelePreviewLayout />` for `preview.type === 'tabele'`.
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` — add `tabele` branch to `LANE_META`, `BUILTIN_TEMPLATES`, `heroText`, `laneLabel`.
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` — extend lane→origin mapping (~7 switch arms) for `tabele`. Tabele uses `outputType: 'sheet'`, `artifactFamily: 'sheet'` (same as Excele) with lane-specific origin/preview handling.
- `consultify/src/components/AIChat/KimiWorkspace/index.ts` — re-export `TabeleView`.
- `consultify/src/components/AIChat/KimiWorkspace/useModuleTemplates.ts` and `useModuleRecentArtifacts.ts` — add `'tabele'` lane support if not already symmetric.
- `consultify/src/types/core.ts` — add `AppView.TABELE`.
- `consultify/src/types/workspace.ts` — add `[AppView.TABELE]: 'document'` to `getDefaultWorkspaceType`.
- `consultify/src/routes/AppRoutes.tsx` — add `<Route path="/tabele" element={<TabeleView />} />` (D1 working assumption: visible TabeleView).
- `consultify/src/routes/routeConfig.ts` — add `TABELE: '/tabele'`.
- `consultify/src/components/navigation/Sidebar/menuConfig.ts` — add Tabele entry.
- `consultify/src/services/api/tablePlatform.api.ts` — add typed clients: `proposeSchemaChange`, `executeSchemaProposal`, `rejectSchemaProposal`, `listSchemaProposals`, `explainRelation`.
- `consultify/server/src/index.ts` — single additive line mounting `tablePlatformRelationsExplainRoutes`.
- `consultify/server/src/routes/index.ts` — re-export the new router (parallel to `tablePlatformRoutes`).
- `consultify/public/locales/{en,pl}/translation.json` — add `kimi.laneTabele`, `kimi.emptyTabele`, `kimi.generateTable`, `kimi.generatingTable`, `kimi.openInBuilder.tabele`, intent-routing toasts (~25 keys).
- `consultify/docs/product/TABLE_V8_SSOT.md` — append a "Lane Integration" appendix linking to this block.
- `consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` — move "Schema Governance proposal queue (lane integration)", "Relation explainability surface", "Tabele lane" rows from MISSING → IN PROGRESS for this block.

### Files explicitly OUT OF SCOPE (must show zero diff)

- `consultify/src/components/MyWork/table/ViewRouter.tsx`
- `consultify/src/components/MyWork/table/TableDataProvider.tsx`
- `consultify/src/components/MyWork/table/TableToolbar.tsx`
- `consultify/src/components/MyWork/table/TableTabStrip.tsx`
- `consultify/src/components/MyWork/table/tableTypes.ts`
- `consultify/server/src/routes/table-platform.routes.ts`
- `consultify/server/src/services/tablePlatform/TableContextService.ts`
- `consultify/server/src/services/tablePlatform/ChatToSchemaService.ts`
- `consultify/server/src/services/tablePlatform/AuditService.ts`
- `consultify/server/src/services/tablePlatform/RelationService.ts`
- `consultify/src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/WordyView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/ExceleView.tsx`
- `consultify/src/components/ReportsAndPresentations/*`
- `consultify/server/src/index.ts` — except for the single additive `app.use(...)` line for the new router and a re-export from `routes/index.ts`.

A CI grep gate / PR-time review confirms zero diff on the rest.

## 5) Definition Of Done

### Functional
- [ ] User can navigate to `/tabele`, lands on `ArtifactModuleHome` (lane=tabele), sees 8 builtin templates + recent + saved tabs.
- [ ] User clicks "Start new" or template → split-screen `KimiWorkspaceShell` with chat-left and `TabelePreviewLayout` on right.
- [ ] Pipeline runs end-to-end (snapshot → plan → preflight → accept → review → approve → materialize → generate) and produces a Tabele artifact whose origin is a real Table Platform `tableId`.
- [ ] Word-canvas preview shows: cover/title, KPI strip (Rows / Columns / Status / Format), Schema section (field blocks), Records section (first 25 rows), Relations section (chips with explain tooltip), AI Rationale section (cited sources + governance proposal status pill).
- [ ] "Open in Builder" button navigates to `/my-work/sheets/:workspaceId/tables/:tableId` in a new tab with a transition toast.
- [ ] AI schema-changing actions in chat go through `proposal → approval → execution → audit` (visible proposal queue surfaced via `ChatToSchemaService.listProposals`).
- [ ] Relation explainability tooltip on chips calls `GET /api/table-platform/tables/:tableId/records/:recordId/relations/explain` and renders rationale + ACL-filtered targets.
- [ ] Intent-routing patterns work in chat: `/export csv|xlsx|json`, `/add column …`, `/summarize`, `/open builder`, `/explain relation …`, `/propose schema …`.
- [ ] EN + PL i18n on every visible string.

### Validation
- [ ] `cd consultify && npm run lint` clean.
- [ ] `cd consultify && npm run type-check` clean.
- [ ] `cd consultify && npm run test:unit` green (existing + new).
- [ ] `cd consultify && npm run test:component -- TabeleView KimiWorkspaceShell ArtifactModuleHome` green.
- [ ] `cd consultify && npm run test:integration -- table-platform.relations-explain` green.
- [ ] `cd consultify/server && npm run typecheck` clean.
- [ ] `cd consultify/server && npm run test -- RelationExplainabilityService` green.
- [ ] `cd consultify && npx playwright test tests/e2e/smoke/tabele-foundation.spec.ts --project=chromium --workers=1` green.
- [ ] Cross-tenant 403 verified for `relations/explain` and existing `/schema/proposals/*` endpoints (audit only).
- [ ] DBR77 audit: zero off-palette colors in new components (verified via `rg "#[0-9a-fA-F]{3,6}"` over new files + visual review against `color-system.md`).
- [ ] Menu 3 audit: AI buttons live only in `KimiWorkspaceShell` header right-slot.
- [ ] Files-explicitly-untouched diff is empty.

### Evidence (in `03_BLOCK_CLOSEOUT.md`)
- Test command output (PASS/FAIL per row of `01_VALIDATION_MATRIX.md`).
- Screenshots / animated proof of split-screen Word-canvas idiom on `/tabele`.
- Screenshot of governance proposal queue surfaced in canvas.
- ACL audit findings on `/schema/proposals/*` (in-scope: read-only audit; any leak filed as P0 follow-up).
- Closeout report with `DoD: PASS | PASS_WITH_P2 | BLOCKED_P1`, `Security/Tenant: PASS | BLOCKED`, `Release impact: NONE | LOW | MEDIUM | HIGH`.

## 6) Risk Notes

See `02_RISK_REGISTER.md` for full register. Top risks:

- **T1** — widening `KimiLane` union breaks exhaustive switches (mitigation: TS `never`-check audit + 4-lane regression test).
- **T3** — `useKimiArtifactPipeline` lane-mapping regression (mitigation: dedicated unit test that exercises all 4 lanes).
- **P1** — users confuse Excele (xlsx generator) with Tabele (operational table) (mitigation: distinct icon, sky accent, copy; `ArtifactModuleHome` explainer).
- **S1** — cross-tenant proposal listing (mitigation: 403 test on every governance endpoint, including audit-only on existing routes).
- **S4** — relation explanation exposes ACL-protected records (mitigation: filter targets in `explain()` before reasoning; covered by integration test).

### Rollback strategy
- All additive: revert PR.
- Frontend feature flag `featureTabeleLaneEnabled` (env-driven, default `true` in dev, `false` in prod until trial passes) gates Sidebar entry, route, and ArtifactModuleHome lane branch.
- Backend route mount in `server/src/index.ts` is a single line — revert disables the new endpoint without touching anything else.
- Excele/Wordy/Prezentacje untouched, so blast radius is contained.

---

## Sign-off

- Block lead: ___ (waiting for D1/D2/D3 confirmation from user)
- UI/UX reviewer: ___
- Security reviewer: ___
- Date: ___
