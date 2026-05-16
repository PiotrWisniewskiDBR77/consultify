---
doc_kind: GLOBAL_SOFTWARE_SYSTEM_ANALYSIS
owner: user
status: review
last_updated: 2026-05-11
scope: full-application-runtime-and-contract-analysis
work_type: docs-first
---

# Global Software System Analysis — Consultify

## 1. Executive Verdict

Consultify is already shaped as one consulting work operating system in documentation and partially in runtime.

The core application has real runtime surfaces for chat/Teresa, My Work, Interview, Initiatives, Execution, Results, Finance, Outputs, Settings, Organization, Admin and SuperAdmin. The biggest mismatch is in the delivery/artifact lane: `/wordy`, `/excele`, `/prezentacje`, `/meeting`, `/mcp/iris` and `/mcp/marketplace` are mounted, but they render `V4ComingSoonView` rather than the target workspaces.

Current verdict:

- system logic in documentation: `PASS_WITH_EXPLICIT_BACKLOG`
- runtime coverage: `PARTIAL`
- Teresa work-execution model: `CONFIRMED_DOCS_WITH_RUNTIME_GAPS`
- final implementation posture: `READY_FOR_RUNTIME_IMPLEMENTATION_PLANNING_AFTER_FINAL_CERTIFICATE`

## 2. Runtime Evidence Base

| Layer | Primary evidence |
| --- | --- |
| SPA route constants | `src/routes/routeConfig.ts` |
| SPA route mounts | `src/routes/AppRoutes.tsx` |
| Navigation exposure | `src/components/navigation/Sidebar/menuConfig.ts` |
| Teresa/chat shell | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/views/AIChatWelcomeView.tsx` |
| Backend route composition | `server/src/Gateway.ts`, `server/src/routes/index.ts` |
| Teresa backend | `server/src/routes/v8/teresa.routes.ts`, `server/src/services/v8/teresaCopilotService.ts` |
| V8/V10 runtime APIs | `server/src/routes/v8/index.ts`, `server/src/routes/v10/index.ts` |
| System contracts | `APPLICATION_OPERATING_MODEL.md`, `MODULE_INTERACTION_GRAPH.md`, `MODULE_HANDOFFS.md`, `ARTIFACT_LINEAGE_MATRIX.md`, `SYSTEM_TRACEABILITY_MATRIX.md` |

## 3. Active Runtime Map

| Area | Runtime state | Evidence | Notes |
| --- | --- | --- | --- |
| Chat / Teresa | active | `/chat`, `/chat/:conversationId`, `UnifiedChatPanel` | Main conversational surface exists and includes proposal approval/rejection mechanics. |
| My Work | active | `/my-work/*`, `MyWorkView` | Work routing and ideas family exist; owner read-back evidence still incomplete. |
| Interview / Discovery | active | `/interview`, `/discovery`, `InterviewHub` | Real hub exists; full journey and handoff tests remain incomplete. |
| Discovery tools | active | `/discovery-tools/**`, `DiscoveryToolsHub` | Tooling lane is present but still needs RAW 2.0 packet work. |
| Initiatives | active | `/initiatives`, `/roadmap`, `/portfolio`, `/roi` | Runtime surfaces exist; UI lifecycle/card evidence remains incomplete. |
| Execution | active/partial | `/implementation`, `/execution`, `/rollout` | Execution routes and components exist; Menu 3, approval/read-back and full states need proof. |
| Results | active/partial | `/kpi-okr`, `/benefits` | Runtime exists; final KPI/ROI evidence needs deeper closure. |
| Finance | active | `/finance`, `/economics`, `/finance/*` | `EconomicsView` handles canonical/legacy finance routes. |
| Outputs | active | `/presentations`, `/reports/builder`, redirects from `/reports` | Outputs library/runtime exists and is the most important integration owner for deliverables. |
| Settings | active | `/settings/*`, `SettingsView` | API-wired preferences exist; V8 memory controls and E2E evidence remain incomplete. |
| Organization | active | `/organization/*`, `OrganizationView` | Shared context layer exists. |
| Admin | active with policy blocker | `/admin/*`, `ProtectedRoute(requiredRole="ADMIN")`, `AdminView` | Superadmin/admin inheritance policy remains an owner/security decision. |
| SuperAdmin | active | `/superadmin/*`, `ProtectedRoute(requiredRole="SUPERADMIN")`, `SuperAdminView` | Separate platform plane exists. |
| Partner / Consultant | active/partial | partner and consultant route families | Not yet part of latest Stage 1.5 wave. |

## 4. Placeholder / Dormant Runtime Map

| Surface | Route | Current mounted component | Target / intended lane | Risk |
| --- | --- | --- | --- | --- |
| Documents | `/wordy` | `V4ComingSoonView` | governed Document Studio / `WordyView` target | chat can route users here with active-work copy. |
| Tables | `/excele` | `V4ComingSoonView` | table/spreadsheet runtime / `ExceleView` target | table backend exists but top-level lane is blocked. |
| Presentations generator | `/prezentacje` | `V4ComingSoonView` | standalone generator / `PrezentacjeView` target | active `/presentations` belongs to Outputs; boundary must remain clear. |
| Meeting | `/meeting` | `V4ComingSoonView` | meeting/review/follow-up hub | final loop back to My Work is not runtime-proven. |
| MCP IRIS | `/mcp/iris` | `V4ComingSoonView` | integration execution plane | control-plane integration not runtime-proven. |
| MCP Marketplace | `/mcp/marketplace` | `V4ComingSoonView` | integration marketplace/catalog | install/execution ownership not proven. |

## 5. Backend Runtime Assessment

The backend has a very broad API surface. Current routing indicates:

- mature domain families: auth, conversations, AI, My Work, Interview, PMO/initiatives, execution, finance/economics, reports/presentations, settings, organization, admin/superadmin;
- active V8 API generation for Teresa, interview, execution, finance, results and My Work;
- active V10 runtime generation for artifact, reasoning, research, learning, connectors, agents and outcomes;
- possible production drift where stub-mounted route families are disabled unless feature flags/environment settings allow them;
- several overlapping generations (`legacy`, `v8`, `v10`) that need integration discipline before broad implementation.

Implementation implication:

Do not implement new features by adding another route family unless the owner module, object lineage, approval state and traceability row are already defined.

## 6. Teresa Work Execution Assessment

Teresa's target role is broader than control, routing or governance. Teresa is the AI consulting operator: the user talks with Teresa, agrees what should be created or completed, and Teresa performs the work through the right module/runtime.

Target work examples:

- in Interview, Teresa conducts the conversation, asks questions, captures answers, structures findings and prepares initiative candidates;
- in Documents, Teresa drafts, edits and prepares document artifacts;
- in Tables, Teresa creates and updates structured table/workbook artifacts;
- in Presentations, Teresa creates deck narrative, outlines and slides like a Gamma-style operator, with Consultify governance;
- in Outputs, Teresa helps assemble reports, decks and client-ready packages;
- in My Work, Teresa creates task/decision candidates and moves work forward through approved actions.

Teresa is partially implemented today as the central work surface:

- chat route and conversation route exist;
- `UnifiedChatPanel` detects document/table/presentation intents and routes users to output lanes;
- proposal approval/rejection mechanics exist through `Api.approveAIAction` and `Api.rejectAIAction`;
- UI copy states that suggestions require approval;
- backend Teresa routes exist under V8.

Main gaps:

| Gap | Evidence | Severity |
| --- | --- | --- |
| Teresa can route users to `/wordy`, `/excele`, `/prezentacje`, but those routes are placeholders, so work execution is not fulfilled there. | `UnifiedChatPanel.tsx`, `AppRoutes.tsx` | `P0/P1` |
| Teresa docs require a work-operating surface, but runtime proof is uneven across modules. | Stage 1.5 audits, `SYSTEM_TRACEABILITY_MATRIX.md`, `104_RAW...` | `P1` |
| Teresa cannot yet be certified as creating/editing documents, tables and presentations end-to-end in the target lanes. | `10/11/12` packets and route evidence | `P1` |
| Teresa-driven interview execution needs full journey proof: ask, capture, normalize, summarize, handoff. | `03_wywiad` contracts and tests | `P1` |
| Proposal approval exists, but full high-impact mutation/export approval evidence is incomplete. | `UnifiedChatPanel.tsx`, Outputs/Document/Table/Presentation boards | `P1` |
| Teresa performs work but must not become owner of downstream objects; this is documented but needs runtime evidence in handoffs. | `MODULE_HANDOFFS.md`, `ARTIFACT_LINEAGE_MATRIX.md` | `P1` |
| Settings memory controls do not yet fully support V8 Teresa memory expectations. | `18_ustawienia` Stage 1.5 audit | `P1` |

Teresa verdict:

`TERESA_WORK_EXECUTOR_CONFIRMED_DOCS_WITH_RUNTIME_PROOF_PARTIAL`

## 7. System Logic Coverage

The system logic is represented in documentation through a coherent loop:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Tabele / Prezentacje -> Meeting -> Moja Praca`

Coverage status:

| Segment | Documentation | Runtime | Verdict |
| --- | --- | --- | --- |
| Chat/Teresa -> My Work | present | partial | `PASS_WITH_EVIDENCE_GAP` |
| Chat/Teresa -> Interview | present | active route | `PASS_WITH_JOURNEY_TEST_GAP` |
| Interview -> Initiatives | present | partial | `PASS_WITH_HANDOFF_TEST_GAP` |
| Initiatives -> Execution | present | active routes | `PASS_WITH_UI_EVIDENCE_GAP` |
| Execution -> Results/Finance | present | partial | `PASS_WITH_APPROVAL_READBACK_GAP` |
| Results/Finance -> Outputs | present | active outputs | `PASS_WITH_EXPORT_APPROVAL_GAP` |
| Outputs -> Documents/Tables/Presentations | present | mixed: active Outputs, placeholder format lanes | `BLOCKED_P1` |
| Meeting -> My Work | present | placeholder meeting route | `NOT_DONE` |
| Admin/Settings/SuperAdmin policy | present | active but policy decision pending | `PASS_WITH_OWNER_DECISION` |

## 8. Critical Integration Risks

| ID | Risk | Severity | Closure |
| --- | --- | --- | --- |
| `SYS-P0-001` | Chat/Teresa user-facing copy may imply active work in placeholder lanes where Teresa cannot yet execute. | `P0` | decide soften/block copy or mount working runtimes. |
| `SYS-P0-002` | Superadmin can satisfy admin guard through role hierarchy; policy not fully settled. | `P0` | owner/security decision + runtime/UX/audit proof. |
| `SYS-P1-001` | Outputs is active but cross-lane ownership with `10/11/12` needs runtime proof. | `P1` | delivery plane implementation wave. |
| `SYS-P1-002` | Approval-before-export is documented but not uniformly runtime-proven. | `P1` | evidence tests across Outputs/Docs/Tables/Decks. |
| `SYS-P1-003` | Menu 3/right-side AI action rule exists but lacks full component proof. | `P1` | UI evidence and regression tests. |
| `SYS-P1-004` | Handoff metadata is canonical in docs, but Teresa-executed work is not proven end-to-end in runtime. | `P1` | flow tests with sourceRefs/evidenceRefs/approvalState. |
| `SYS-P2-001` | Visual/state-depth evidence packs are missing for several modules. | `P2` | manual/automated evidence pack after P1. |

## 9. Final Software Readiness

Consultify is ready for final implementation backlog planning.

It is not ready for broad runtime build without sequencing. The first implementation work must protect truthfulness, ownership, approval and security boundaries before expanding feature depth.
