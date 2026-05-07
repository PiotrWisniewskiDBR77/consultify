# EPIC-1 — Frontend Lane Parity (Tabele = Wordy idiom)

**Owner:** Agent B (frontend scaffolding lead)
**Sprint:** Sprint 2
**Status:** `PLANNED`
**Depends on:** Sprint 0 D1/D2/D3 confirmations
**Blocks:** EPIC-2 (preview components — needs ArtifactPreview shape), EPIC-4 (TabeleView orchestrator — needs lane wiring)

## Epic goal

Make the Tabele lane a first-class peer of `wordy`, `excele`, `prezentacje` in every shared scaffold layer (types, lane union, configs, routes, sidebar, API client, lane→origin mapping). Output: a runnable Tabele lane with **no preview content yet** (preview type registered but body intentionally empty — EPIC-2 fills that). At end of this epic, navigating to `/tabele` lands the user on `ArtifactModuleHome` with `lane=tabele` and `KimiWorkspaceShell` renders with the sky accent.

## Acceptance criteria (epic-level)

- AC-1.0.1 `npm run type-check` is green after the epic.
- AC-1.0.2 `npm run lint` is green; no new warnings.
- AC-1.0.3 Wordy / Excele / Prezentacje lanes are functionally unchanged (snapshot tests pass).
- AC-1.0.4 `KimiLane` is `'wordy' | 'excele' | 'prezentacje' | 'tabele'`.
- AC-1.0.5 Sidebar shows Tabele entry; `/tabele` renders `ArtifactModuleHome` (lane=tabele) under D1 working assumption.
- AC-1.0.6 Typed API client surfaces compile cleanly: `proposeSchemaChange`, `executeSchemaProposal`, `rejectSchemaProposal`, `listSchemaProposals`, `explainRelation`.

## User stories

### US-1.1 — `AppView.TABELE` enum + workspace mapping

**Files**
- `consultify/src/types/core.ts` (UPDATE — add enum value next to `WORDY`, `EXCELE`, `PREZENTACJE_GEN`)
- `consultify/src/types/workspace.ts` (UPDATE — add `[AppView.TABELE]: 'document'` to `getDefaultWorkspaceType`)

**Acceptance criteria**
- AC-1.1.1 `AppView.TABELE = 'TABELE'` exported from `core.ts`.
- AC-1.1.2 `getDefaultWorkspaceType(AppView.TABELE) === 'document'`.
- AC-1.1.3 No other map keys removed; existing tests pass.

**Estimate:** 0.25 d

---

### US-1.2 — `KimiLane` union + `LANE_CONFIG.tabele` (sky accent)

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (UPDATE)

**Acceptance criteria**
- AC-1.2.1 `KimiLane = 'wordy' | 'excele' | 'prezentacje' | 'tabele'`.
- AC-1.2.2 `LANE_CONFIG.tabele = { icon: Table, label: 'Table Studio', labelPl: 'Tabele Studio', accentColor: 'sky', inputPlaceholder: 'Describe the operational table you want to build...', inputPlaceholderPl: 'Opisz tabelę operacyjną, którą chcesz zbudować...' }`.
- AC-1.2.3 `import { Table } from 'lucide-react'` added (no new dep).
- AC-1.2.4 `laneViewMap` extended with `tabele: AppView.TABELE`.
- AC-1.2.5 Component test: shell renders with `lane="tabele"` showing label "Tabele" PL, sky accent, Table icon. (L3.2)

**Estimate:** 0.5 d

---

### US-1.3 — `ArtifactPreview` type extension + `'tabele'` preview type

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (UPDATE)
- `consultify/src/types/tabeleArtifact.ts` (CREATE)

**Acceptance criteria**
- AC-1.3.1 `ArtifactPreviewType = 'pdf' | 'xlsx' | 'deck' | 'tabele' | 'none'`.
- AC-1.3.2 `ArtifactPreview` adds optional fields: `tableId?: string`, `tabeleSchemaFields?: TabelePreviewSchemaField[]`, `tabeleRelations?: TabelePreviewRelation[]`, `tabeleRationale?: TabelePreviewRationale`.
- AC-1.3.3 `tabeleArtifact.ts` exports `TabelePreviewSchemaField`, `TabelePreviewRelation`, `TabelePreviewRationale` shapes (described in §Types section below).
- AC-1.3.4 No existing field changed; all new fields optional.
- AC-1.3.5 Snapshot tests on `wordy/excele/prezentacje` lanes still pass.

**Types (TabelePreviewSchemaField etc.)**
```typescript
export interface TabelePreviewSchemaField {
  fieldId: string;
  name: string;
  fieldType: string; // 'text' | 'number' | 'date' | 'select' | 'relation' | ...
  governanceState?: 'committed' | 'proposed' | 'rejected';
  proposalId?: string;
}

export interface TabelePreviewRelation {
  fieldId: string;
  fieldName: string;
  targetTableId: string;
  targetTableName: string;
  targetCount: number;
}

export interface TabelePreviewRationale {
  summary: string;
  bullets: string[];
  citedSourceIds: string[];
  proposalStatus?: 'pending' | 'approved' | 'rejected' | 'none';
}
```

**Estimate:** 0.5 d

---

### US-1.4 — Route + sidebar + lazy-load wiring (D1: `<TabeleView />` direct)

**Files**
- `consultify/src/routes/routeConfig.ts` (UPDATE — add `TABELE: '/tabele'`)
- `consultify/src/routes/AppRoutes.tsx` (UPDATE — lazy `TabeleView` + `<Route path="/tabele" element={<TabeleView />} />`)
- `consultify/src/components/navigation/Sidebar/menuConfig.ts` (UPDATE — add Tabele menu item next to Wordy/Excele/Prezentacje)

**Acceptance criteria**
- AC-1.4.1 `ROUTES.TABELE === '/tabele'`.
- AC-1.4.2 `/tabele` renders `<TabeleView />` (placeholder `TabeleView` exported from EPIC-4 — initially empty, then filled).
- AC-1.4.3 Sidebar item under same group as Wordy/Excele/Prezentacje, with proper role gating mirrored from Wordy.
- AC-1.4.4 E2E smoke: navigating `/tabele` does not 404 and shows the lane home (L5.1, L5.2).
- AC-1.4.5 If D1 is overridden to `<V4ComingSoonView />`, US-1.4.2 changes accordingly.

**Estimate:** 0.5 d

---

### US-1.5 — `useKimiArtifactPipeline` lane support (~7 additive switch arms)

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` (UPDATE)

**Switch arms to extend (additive)**
1. Line ~306–309: `outputType` and `artifactFamily` — Tabele uses `'sheet'` and `'sheet'` (same as Excele).
2. Line ~382–386: title fallback — `lane === 'tabele' ? 'Table' : ...`.
3. Line ~527–608: content-generation block — Tabele path: after materialize, call `TablePlatformApi.getTable(tableId)` + `TablePlatformApi.listRecords(tableId, {pageSize:25})` + `TablePlatformApi.listSchemaProposals(workspaceId, 'pending')` + `TablePlatformApi.explainRelation(...)` for top-N relations; assemble `preview: { type: 'tabele', ... }`.
4. Line ~610–626: tail fallback — also fallback for `lane === 'tabele'` to a minimal preview when origin missing.
5. Line ~648–649: `laneTitle` fallback — `lane === 'tabele' ? 'Table' : ...`.
6. Line ~875–900: `handleDownload` — Tabele exports CSV via new `tabeleArtifactOpen.downloadTabeleArtifactCsv(tableId)`.
7. Line ~915–917: `myWorkNotified` link path — `lane === 'tabele' ? '/tabele?artifactId=...' : ...`.

**Acceptance criteria**
- AC-1.5.1 All 4 lanes produce non-null preview in their respective integration tests (L2.4).
- AC-1.5.2 Tabele preview shape passes type-check against `ArtifactPreview` extended type.
- AC-1.5.3 Tabele path tolerates missing relations / missing proposals gracefully (no throw, status 'none' fallback).
- AC-1.5.4 No edits to existing wordy/excele/prezentacje branches' behavior.

**Estimate:** 1.5 d

---

### US-1.6 — `ArtifactModuleHome` lane=tabele branch + 8 builtin templates

**Files**
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` (UPDATE)
- `consultify/src/components/AIChat/KimiWorkspace/useModuleTemplates.ts` (UPDATE if asymmetric)
- `consultify/src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts.ts` (UPDATE if asymmetric)

**Builtin templates (8 cards, EN+PL)**
1. `bt-tab-rolereg` — Role Register / Rejestr ról — Org roles, owners, scope
2. `bt-tab-vendor` — Vendor Master Data / Master danych dostawców
3. `bt-tab-okrset` — OKR Set / Zestaw OKR — Objectives + Key Results
4. `bt-tab-incidentlog` — Incident Log / Log incydentów — Severity, owner, status
5. `bt-tab-clientreg` — Client Registry / Rejestr klientów
6. `bt-tab-tasktracker` — Task Tracker / Tracker zadań — Owner, due, status
7. `bt-tab-meetingbacklog` — Meeting Backlog / Backlog spotkań
8. `bt-tab-decisionlog` — Decision Log / Log decyzji — Linked initiatives, rationale

**Acceptance criteria**
- AC-1.6.1 `LANE_META.tabele = { icon: Table, route: '/tabele', accentBg: 'bg-sky-500/10', accentText: 'text-sky-500' }`.
- AC-1.6.2 `BUILTIN_TEMPLATES.tabele` contains 8 templates above with EN+PL.
- AC-1.6.3 Hero text PL: "Tabele operacyjne, master data, rejestry, logi, OKR-y, decyzje" / EN: "Operational tables, master data, registers, logs, OKRs, decisions".
- AC-1.6.4 `laneLabel` PL: "Tabele Studio" / EN: "Table Studio" (distinguishes from Excele "Tabele" / "Tables").
- AC-1.6.5 Component test: home renders 8 templates, recent + saved tabs present, "Start new" CTA navigates to `/tabele?view=new` (L3.4).

**Estimate:** 0.75 d

---

### US-1.7 — Typed API client extensions

**Files**
- `consultify/src/services/api/tablePlatform.api.ts` (UPDATE — add 5 functions; do not edit existing functions)

**New functions**
```typescript
export async function proposeSchemaChange(workspaceId: string, intent: string, options?: {...}): Promise<SchemaProposal>;
export async function executeSchemaProposal(proposalId: string, opts?: {executedBy?: string}): Promise<ExecutionResult>;
export async function rejectSchemaProposal(proposalId: string, reason?: string): Promise<void>;
export async function listSchemaProposals(workspaceId: string, status?: string): Promise<SchemaProposal[]>;
export async function explainRelation(tableId: string, recordId: string): Promise<RelationExplainResponse>;
```

**Acceptance criteria**
- AC-1.7.1 All 5 functions call existing endpoints (`POST /schema/proposals`, `POST /schema/proposals/:id/execute`, `POST /schema/proposals/:id/reject`, `GET /workspaces/:id/schema/proposals`) and the new `GET /tables/:tableId/records/:recordId/relations/explain`.
- AC-1.7.2 Type definitions `SchemaProposal`, `ExecutionResult`, `RelationExplainResponse` match server-side shapes.
- AC-1.7.3 All functions use `getHeaders()` (no token in URL).
- AC-1.7.4 Error path returns thrown `Error` with friendly message (mirrors existing pattern in `tablePlatform.api.ts`).
- AC-1.7.5 Type-check clean.

**Estimate:** 0.5 d

---

## Sprint mapping

US-1.1 → US-1.7 all execute in **Sprint 2** (Agent B).

## Total estimate

~4.5 d (single-agent) → compresses to ~2 d with focused execution and parallel test writing.

## Dependencies on other epics

- **EPIC-2** consumes the `ArtifactPreview` shape from US-1.3 (must be merged first).
- **EPIC-3** consumes the `explainRelation` API client from US-1.7 (must be merged first).
- **EPIC-4** consumes the lane mapping from US-1.5 + module home branch from US-1.6.

## Out of scope (do NOT do in this epic)

- Building `TabelePreviewLayout` / `TabeleSchemaBlock` / etc. → EPIC-2.
- Building `TabeleView.tsx` orchestrator body → EPIC-4.
- Creating `RelationExplainabilityService` and its route → EPIC-3.
- i18n EN+PL key authoring → EPIC-4 / Sprint 5.
