# Module acceptance status — 2026-08-15

## Evidence boundary

This semantic inventory was reviewed against product-code SHA
`7bf4d27cd751afb2d6c24d195891be5aa54c433b`. The current cleanup checkpoint is
its documentation-only descendant. Classifications below prove code wiring, not
deployed-demo parity, provider health or a production migration ledger.

## Status matrix

| Module | Code status | Acceptance boundary |
|---|---|---|
| Chat | `LIVE_CONNECTED_CANDIDATE` | UI, stream/API, service and migrations are present. Provider/runtime/demo remain `NOT_VERIFIED`. |
| My Work core | `LIVE_CONNECTED_CANDIDATE` | `/my-work/*`, hub, APIs, services and state migrations are connected. Radar and optional surfaces remain disabled. |
| Agent | `PARTIAL`, `DUPLICATE` | Legacy Agent Plan and new Transformation Case coexist. Agent writes `transformation_cases`; Case Workspace writes `case_core`. This is a P0 identity conflict. |
| Assessment | `PARTIAL` | Base hub is connected. Five-surface lifecycle, publish/freeze/lineage and migration-ledger proof remain open. |
| Tools | `LIVE_CONNECTED_CANDIDATE` core, `PARTIAL` catalog | Library, Sessions, Outputs, Reports and Initiatives surfaces are connected. Full catalog and migration ledger remain open. |
| Initiatives | `LIVE_CONNECTED_CANDIDATE` core | Main route, hub, API and services are connected. Bulk stubs remain out of scope; old Roadmap/Portfolio views require final history review. |
| Execution | `LIVE_CONNECTED_CANDIDATE` core | Main execution surfaces and backend are connected. Environment-dependent advanced flags and demo posture remain open. |
| Results KPI/ROI/OKR | `IMPLEMENTED_UNMOUNTED`, `PARTIAL` | Rich VNext UI/API/services/tests exist, but all three main VNext flags default off. Migration ledger and demo proof are missing. |
| Finance | `PARTIAL`, `DUPLICATE` | Legacy runtime and Finance v3 coexist with different ID spaces. V3 workspaces default off; canonical lane and bridge require a decision and proof. |
| Materials / Artifact Studio | `LIVE_CONNECTED_CANDIDATE` base, `IMPLEMENTED_UNMOUNTED` V2 | Base library is connected. New studio lanes are fail-closed by flags. Provider, visual and demo proof remain open. |
| Cases | `IMPLEMENTED_UNMOUNTED`, `DUPLICATE` | `/zlecenia/*` defaults off. Rich Case Workspace exists, but `case_core` conflicts semantically with Agent `transformation_cases`. |
| Audits | `PARTIAL` | Base audit CRUD is connected. Criterion/five-surface/DRD/editing features remain flag-dependent and lack full lifecycle evidence. |

## Canonical chains and key evidence

### Chat and My Work

- Chat route: `src/routes/AppRoutes.tsx`
- Chat UI: `src/components/AIChat/UnifiedChatPanel.tsx`
- Chat client: `src/hooks/useAIStream.ts`, `src/services/api.ts`
- Chat backend: `server/src/Gateway.ts`, `server/src/routes/v8/chat.routes.ts`
- Chat service: `server/src/services/v8/chatExecutionService.ts`
- My Work UI: `src/views/MyWorkView.tsx`, `src/components/MyWork/MyWorkHub.tsx`
- My Work backend: `server/src/routes/my-work.routes.ts`,
  `server/src/routes/v8/my-work.routes.ts`

### Agent and Cases

- Agent shell: `src/components/AIChat/AgentHubShell.tsx`
- New Agent UI: `src/components/MyWork/agent/TransformationCasesPanel.tsx`
- Agent service: `server/src/services/v8/transformationCaseService.ts`
- Case UI: `src/components/CaseWorkspace/CaseWorkspaceRoute.tsx`
- Case backend: `server/src/routes/v8/case-workspace.routes.ts`
- Case services: `server/src/services/caseWorkspace/`
- Dead candidate, no known importer: `src/views/AgentPlanView.tsx`

No deletion or model merge is authorized until the `transformation_cases`
versus `case_core` ownership decision is explicit.

### Results and Finance

- Results VNext UI: `src/components/ResultsVNext/`
- Results flags: `src/components/ResultsVNext/resultsVNextFeatureFlags.ts`
- Results backend: `server/src/routes/resultsVnext/`
- Finance host: `src/components/Economics/FinanceHub.tsx`
- Finance v3 UI: `src/components/Finance/`
- Finance APIs include legacy V8 and `/api/v8/finance-v2` generations.

Dead candidates requiring final import/history review include
`FullROIWorkspace.tsx` and `BenefitsHub.tsx`. Their current lack of an importer
is not deletion authority.

### Initiatives, Execution and Materials

- Initiatives: `/initiatives` → `InitiativesHub` → initiatives/PMO APIs.
- Execution: `/execution` → `ExecutionHub` → execution-control/module APIs.
- Materials: presentations/document/table routes → artifact, document studio,
  presentation and table-platform APIs.

Old `FullInitiativesView`, `FullRoadmapView`, `PortfolioView`,
`PresentationStudioPage` and `PresentationWizard` variants require final
history and dynamic-import review before removal.

## Acceptance order for the current checkpoint

1. Chat and My Work core.
2. Tools core and the explicitly bounded Assessment base.
3. Initiatives and Execution core.
4. Materials base library.
5. Results and Finance only after flag posture, canonical-generation and
   migration-ledger decisions.
6. Agent and Cases only after one Case identity model or a governed bridge is
   selected.
7. Audits only as base CRUD until its advanced lifecycle evidence exists.

## Non-negotiable remaining evidence

No module advances from a code-level candidate to accepted `LIVE_CONNECTED`
without:

1. exact deployed SHA;
2. migration-ledger/readback evidence on the target environment;
3. ordinary production navigation without query/localStorage activation;
4. browser golden flow and honest negative states;
5. API and console/network error review;
6. visual acceptance against the Consultify design contract.
