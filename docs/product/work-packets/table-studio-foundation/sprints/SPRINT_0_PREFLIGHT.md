# Sprint 0 — Preflight

**Sprint ID:** `S0`
**Owner:** Orchestrator (sequential, single-agent)
**Status:** `DONE`
**Outcome:** Hard-stop with 3 decisions pending (D1/D2/D3).
**Wave:** 0

## Sprint goal

Bind the approved plan to repo truth. Verify file paths, npm scripts, AppView enum location, route mount pattern, lane mapping shape. Catch misaligned assumptions BEFORE any code edits.

## Sprint scope

Read-only verification. Zero file edits. Output is a closeout report (this document) plus 3 decisions for the user.

## Sprint Entry Gate (per `.cursor/SPRINT_GATE_CHECKLIST.md`)

- [x] Sprint goal is single and measurable.
- [x] Committed blocks have complete task packets — Task Packet (`00_TASK_PACKET.md`) drafted at planning phase.
- [x] Each block has SoT references — `README.md` lists all SoT files.
- [x] Risks and owners assigned — `02_RISK_REGISTER.md`.
- [x] Capacity buffer — Sprint 0 is a 1-day budget; actual ~0.5 d used.

## Findings

### Frontend — matches plan
1. `KimiLane`, `LANE_CONFIG`, `ArtifactPreviewType`, `ArtifactPreview` shape live in `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`.
2. `useKimiArtifactPipeline.ts` has lane branches in `outputType`, `artifactFamily`, content-generation switch, `handleDownload`, `myWorkNotified` — ~7 specific switch arms.
3. `ArtifactModuleHome.tsx` `LANE_META` and `BUILTIN_TEMPLATES` keyed by lane.
4. `AppView.WORDY/EXCELE/PREZENTACJE_GEN` exist in `src/types/core.ts` line 96–98.
5. `getDefaultWorkspaceType` in `src/types/workspace.ts` line 122 maps Wordy→`document`, Excele/Prezentacje→`artifact`.
6. `ROUTES` in `src/routes/routeConfig.ts` has `WORDY: '/wordy'`, `EXCELE: '/excele'`, `PREZENTACJE_GEN: '/prezentacje'`.
7. **Important deviation:** in `AppRoutes.tsx` lines 1243–1283, `/wordy`, `/excele`, `/prezentacje` are wired to `<V4ComingSoonView />` even though the actual KIMI views are imported (lazy) but unused — public-production gating.

### Backend — significant scope conflict with plan

| Approved file | Reality | Existing canonical |
|---|---|---|
| `SchemaGovernanceService.ts` (CREATE) | **Already implemented** | `services/tablePlatform/ChatToSchemaService.ts` — `generateProposal`, `executeProposal`, `rejectProposal`, `refineProposal`, `undoProposal`, `redoProposal`, `getProposal`, `listProposals(workspaceId, status?)` |
| `TableMutationAuditService.ts` (CREATE) | **Already implemented** | `services/tablePlatform/AuditService.ts` — `logEvent`, `logCellChanges`, `getEventsForEntity`, `getRecordHistory`, `getTableActivityFeed`, `createSnapshot`, `restoreSnapshot` |
| `table-platform.governance.routes.ts` (CREATE) | **Already implemented** | Inside `routes/table-platform.routes.ts`: `POST /schema/proposals`, `POST /schema/proposals/:id/execute`, `POST .../reject`, `POST .../refine`, `POST .../undo`, `POST .../redo`, `GET /schema/proposals/:id`, `GET /workspaces/:id/schema/proposals` |
| `RelationExplainabilityService.ts` (CREATE) | **Genuinely missing** | `RelationService.ts` has link/lookup/rollup primitives but no `explain(...)` rationale generator |

Other discoveries:
- Backend entry is `server/src/index.ts` (single file), not `app.ts`.
- 42 services already in `services/tablePlatform/`.
- Test commands confirmed: frontend `npm run test:unit/component/integration/e2e`, backend `npm run test/test:backend`.

## Decisions surfaced (block hard-stop)

- **D1.** `/tabele` route target — `<TabeleView />` (visible) vs `<V4ComingSoonView />` (consistent with siblings).
- **D2.** Backend scope — reuse existing `ChatToSchemaService` + `AuditService` (recommended) vs build duplicate `SchemaGovernanceService` + `TableMutationAuditService`.
- **D3.** ACL audit handling — STOP-and-file-P0 if leak found vs in-block patch (would expand scope).

## Working assumptions (until overridden)

- D1 = `<TabeleView />` direct (lane is visible and usable).
- D2 = REUSE existing services; build only `RelationExplainabilityService` + its route (genuinely missing).
- D3 = STOP-and-file-P0 if leak found; do not patch in this block.

## Sprint Exit Gate

- [x] Sprint goal achieved (preflight done).
- [x] No unresolved P0/P1 in committed scope.
- [x] DoD passed (preflight findings reported).
- [ ] Release recommendation: **NOT YET — block held pending D1/D2/D3.**
- [x] Retro action items: documentation sprint (S0.5) added before S1 starts.

## Retrospective

**What went well**
- Discovered existing canonical backend services BEFORE creating duplicates (averted T4-class conflict).
- Captured concrete paths and line numbers for downstream agents.

**What didn't**
- Plan was drafted from incomplete repo knowledge → over-scoped backend by ~3 files. Lesson: always preflight before approving a plan.

**Action items**
- AI-S0-1: Insert "Sprint 0 preflight" as a hard step in future delivery procedures.
- AI-S0-2: Update `.cursor/OPUS47_DELIVERY_PROCEDURE.md` to require preflight artifact before plan approval.

## Evidence

- File reads: `KimiWorkspaceShell.tsx`, `useKimiArtifactPipeline.ts`, `ArtifactModuleHome.tsx`, `WordyView.tsx`, `PrezentacjeView.tsx`, `ExceleView.tsx`, `AppRoutes.tsx`, `core.ts`, `workspace.ts`, `routeConfig.ts`, `tablePlatform.api.ts`, `package.json`, `server/package.json`, `index.ts`, `routes/index.ts`.
- Service signature scans: `AuditService.ts`, `GovernedModelService.ts`, `ChatToSchemaService.ts`, `RelationService.ts`.
- Route inventory: grep on `routes/table-platform.routes.ts` for `/schema/proposals/*`.
