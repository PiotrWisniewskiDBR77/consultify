# Module acceptance status — 2026-08-15

## Evidence boundary

This semantic inventory is tracked against the latest complete standard-gate SHA
`aeb28eb6abeb0af9f16750c66d6de0e8bb359702`. Classifications below prove code wiring, not
deployed-demo parity, provider health or a production migration ledger.

## Status matrix

| Module | Code status | Acceptance boundary |
|---|---|---|
| Chat | `LIVE_CONNECTED_CANDIDATE` | UI, stream/API, service and migrations are present. Standard gate scope is complete (`4052` files, `0` missing). Provider/runtime/demo remain `NOT_VERIFIED`. |
| My Work core | `LIVE_CONNECTED_CANDIDATE` | `/my-work/*`, hub, APIs, services and state migrations are connected. Standard gate scope is complete. Provider/runtime/demo remain `NOT_VERIFIED`. |
| Agent | `PARTIAL`, `DUPLICATE` | Legacy Agent Plan and new Transformation Case coexist. Agent writes `transformation_cases`; Case Workspace writes `case_core`. This is a P0 identity conflict. |
| Assessment | `PARTIAL` | Base hub is connected. Five-surface lifecycle, publish/freeze/lineage and migration-ledger proof remain open. |
| Tools | `LIVE_CONNECTED_CANDIDATE` core, `PARTIAL` catalog | Library, Sessions, Outputs, Reports and Initiatives surfaces are connected. Full catalog and migration ledger remain open. |
| Initiatives | `LIVE_CONNECTED_CANDIDATE` core | Main route, hub, API and services are connected. Standard gate scope is complete. Bulk stubs remain out of scope; old Roadmap/Portfolio views require final history review. |
| Execution | `LIVE_CONNECTED_CANDIDATE` core | Main execution surfaces and backend are connected. Standard gate scope is complete. Environment-dependent advanced flags and demo posture remain open. |
| Results KPI/ROI/OKR | `IMPLEMENTED_UNMOUNTED`, `PARTIAL` | Rich VNext UI/API/services/tests exist, but all three main VNext flags default off. Migration ledger and demo proof are missing. |
| Finance | `PARTIAL`, `DUPLICATE` | Legacy runtime and Finance v3 coexist with different ID spaces. V3 workspaces default off; canonical lane and bridge require a decision and proof. |
| Materials / Artifact Studio | `LIVE_CONNECTED_CANDIDATE` base, `IMPLEMENTED_UNMOUNTED` V2 | Base library is connected. New studio lanes are fail-closed by flags. Provider, visual and demo proof remain open. |
| Cases | `IMPLEMENTED_UNMOUNTED`, `DUPLICATE` | `/zlecenia/*` defaults off. Rich Case Workspace exists, but `case_core` conflicts semantically with Agent `transformation_cases`. |
| Audits | `PARTIAL` | Base audit CRUD is connected. Criterion/five-surface/DRD/editing features remain flag-dependent and lack full lifecycle evidence. |
| Interview | `LIVE_CONNECTED_CANDIDATE`, `PARTIAL` | Hub and broad APIs exist, but publish/invite/respond/approve/handoff, external respondent isolation and answer-to-insight lineage lack one exact-SHA golden flow. |
| Meeting | `LIVE_CONNECTED_CANDIDATE`, `PARTIAL` | Real hub and `/api/meeting` exist while menu says `soon`; approval, handoff, consent and transcript retention remain unproven. |
| Organization | `LIVE_CONNECTED_CANDIDATE`, `PARTIAL` | `/organization/*` and context/claim/KG backends exist; overlapping surfaces, snapshot propagation and conflict/source-delete semantics remain open. |
| Admin Panel | `LIVE_CONNECTED_CANDIDATE`, `SECURITY_CRITICAL_PARTIAL` | Tenant Admin and SuperAdmin are separately routed, but capability/audit/last-admin/cross-tenant negatives lack one verified matrix. |
| Settings | `LIVE_CONNECTED_CANDIDATE`, `PARTIAL` | Large real surface exists, but controls lack one owner/storage/effect registry and full persistence, policy-conflict and secret proof. |
| Partner Portal | `LIVE_CONNECTED_CANDIDATE`, `PARTIAL`, `DUPLICATE_API` | Scoped portal/APIs exist, but legacy/V8 coexist and individual referral through attribution/commission/payout is unproven. |

Complete 16-module AS-IS/TO-BE/GAP:
`docs/cleanup/MODULE_GAP_AND_INTEGRATION_PLAN_2026-08-15.md`.

## Priorytetowe backlogi wg bieżącego stanu testów (operacyjnie)

- **P0**: `Routing/Auth` + `Superadmin` (blokująca masa testów infra/auth, wpływają na możliwość odpalenia e2e i stabilność środowiska).
- **P1**: `MyWork`, `Initiatives`, `Assessment`, `Finance`, `Results` (cechy core produkcyjne + widoczne dla użytkownika).  
- **P2**: `Tools`, `AIChat`, `Artifact/Materials`, `Execution` po zamknięciu P0/P1.
- **P3**: `Other` (pozostałe testy niekrytyczne dla odbioru weekendowego).

Źródłem rankingu jest pełny shard-summary:
`docs/cleanup/FAIL_TRIAGE_2026-08-15.md`.

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

## Current test-gate snapshot

- Standard gate: `4052/4052` files
- Totals: `38900 PASS`, `476 FAIL`, `490 PENDING`, `19 TODO`
- Missing/Unexpected: `0`
- Non-green files: `242`
- Concentration: `tests/integration` (`133`), `tests/unit` (`47`), `tests/components` (`27`), `src` (`16`), `server` (`13`), other (`6`)
- Evidence: `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814/test-gates/standard-aeb28eb6a`

The exact executable completion tasks, dependencies and evidence requirements
are in `docs/cleanup/MODULE_COMPLETION_TASK_REGISTRY_2026-08-15.md`.

### 5-hour execution plan for completion

1. Zamknąć integration faili i pendingi tylko w modułach rdzeniowych: My Work, Initiatives, Execution, Tools, Assessment.
2. Utrzymać Results/Finance/Audits jako `PARTIAL`/`IMPLEMENTED_UNMOUNTED` i nie otwierać nowych aktywacji bez decyzji flag + migration-ledger.
3. Rozstrzygnąć model właściciela Case (`transformation_cases` kontra `case_core`) i przygotować jedną canonical ścieżkę dla Agenta.
4. Po każdej partii zmian: aktualizacja tego dokumentu i krótki checkpoint z listą zmian.
