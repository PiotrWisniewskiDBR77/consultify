---
doc_id: APPLICATION_LOGICAL_MODEL
doc_kind: LOGICAL_MODEL
owner: user
status: active
last_updated: 2026-05-09
---

# Application Logical Model

## Purpose

This document defines Consultify as one coherent consulting work system.

It is the bridge between:

- module-level contracts in `docs/modules/01_*` to `docs/modules/19_*`,
- the global operating model in `APPLICATION_OPERATING_MODEL.md`,
- object ownership in `OBJECT_GRAPH.md`,
- handoff rules in `MODULE_HANDOFFS.md`,
- future RAW-to-target-state contract work.

The purpose is to prevent modules from becoming isolated islands.

## Core Loop

The target consulting work loop is:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Prezentacje / Tabele -> Meeting / follow-up`

Shared layers operate across the loop:

- `16_organizacja`: organization context, knowledge and memory.
- `17_panel-administratora`: tenant/admin governance; SuperAdmin remains a separate control plane outside the 19-module catalog.
- `18_ustawienia`: user and workspace preferences.
- `14_mcp-iris` and `15_mcp-marketplace`: integrations and external capabilities.
- `19_portal-partnerski`: separate partner business path.

## As-Is Route Ownership

These ownership decisions are locked for the current As-Is contract:

- `05_inicjatywy`: canonical launch route is `/portfolio`; `/initiatives` and `/roadmap` remain active related surfaces.
- `06_realizacja`: canonical launch route is `/implementation`; `/execution` and `/rollout` remain active related or legacy surfaces.
- `09_outputs`: owns `/presentations`.
- `12_prezentacje`: owns standalone generator lane `/prezentacje`, currently placeholder/soon.
- `08_finanse`: canonical route is `/finance`; `/economics` remains active legacy alias.
- `16_organizacja`: owns `/organization` and organization context; `/context` is transitional legacy context-builder surface.

## Module Contract Matrix

| Module | Input | Output | Hands Off To | Must Not Own |
| --- | --- | --- | --- | --- |
| `01_czat` — Czat / Teresa | User intent, conversation, files, source refs, selected context | Conversation, proposal, draft action, artifact request, source-linked answer | `02_moja-praca`, `03_wywiad`, `04_narzedzia`, `09_outputs` | Durable ownership of initiatives, execution tasks, KPI truth, finance models or final client artifacts |
| `02_moja-praca` — Moja Praca | Task/action refs, follow-up items, decision reminders, user workload state | Prioritized work queue, next action, attention routing | Any owning module referenced by the task/action | Domain truth; it routes attention but does not become the owner of initiative, result, finance or artifact objects |
| `03_wywiad` — Wywiad | Conversation context, organization context, interview goal, stakeholder input | Findings, insights, evidence refs, interview-derived context | `04_narzedzia`, `05_inicjatywy`, `16_organizacja` | Final initiative approval, task execution, KPI/ROI ownership |
| `04_narzedzia` — Narzędzia | Findings, diagnostic inputs, source pack, assessment/tool parameters | Tool output, analysis result, recommendation, assessment evidence | `05_inicjatywy`, `09_outputs`, `16_organizacja` | Initiative ownership, implementation ownership, final KPI/ROI truth |
| `05_inicjatywy` — Inicjatywy | Findings, recommendations, business rationale, expected value, decision input | Initiative, decision, scope, owner, expected outcomes | `06_realizacja`, `07_rezultaty`, `08_finanse`, `09_outputs` | Delivery task execution and realized KPI/ROI measurement |
| `06_realizacja` — Realizacja | Approved initiative, scope, tasks, owners, dependencies, blockers | Execution state, tasks, blockers, delivery evidence, implementation status | `07_rezultaty`, `13_meeting`, `09_outputs` | Strategic initiative rationale, finance model ownership, final result truth |
| `07_rezultaty` — Rezultaty | KPI targets, delivery evidence, achieved outcomes, measurement data | KPI state, value realization, ROI input, result evidence | `08_finanse`, `09_outputs`, `05_inicjatywy` | Financial model ownership and artifact packaging ownership |
| `08_finanse` — Finanse | KPI data, assumptions, cost/revenue inputs, table data, initiative economics | Financial model, ROI, assumptions, finance analysis | `09_outputs`, `05_inicjatywy`, `07_rezultaty` | Realized KPI ownership and initiative governance ownership |
| `09_outputs` — Outputs | Approved content, evidence, results, finance assumptions, artifact requests | Output package, export, document/deck/table request, client-ready library item | `10_dokumenty`, `11_tabele`, `12_prezentacje`, `13_meeting` | Business source truth; outputs package truth but must not become the only owner of it |
| `10_dokumenty` — Dokumenty | Document artifact request, source pack, narrative plan, review context | Editable document, document version, export-ready document artifact | `09_outputs`, `13_meeting` | Initiative, KPI, finance or source truth ownership |
| `11_tabele` — Tabele | Table request, structured data, assumptions, imported or generated datasets | Table, spreadsheet-like model, structured analysis block | `08_finanse`, `09_outputs`, `10_dokumenty`, `12_prezentacje` | Finance decision ownership and final narrative artifact ownership |
| `12_prezentacje` — Prezentacje | Deck request, approved content, source pack, brand/context requirements | Deck, slide narrative, presentation artifact | `09_outputs`, `13_meeting` | `/presentations` ownership, which belongs to `09_outputs`; business truth behind the deck |
| `13_meeting` — Meeting | Agenda, document/deck/task context, blockers, decision candidates | Meeting record, decisions, follow-up tasks, review outcomes | `02_moja-praca`, `06_realizacja`, `05_inicjatywy`, `09_outputs` | System-of-record ownership for tasks, initiatives or artifacts |
| `14_mcp-iris` — MCP IRIS | Approved integration request, tenant policy, tool/provider config | Tool call result, external evidence, sync/call status, integration execution audit | Calling module, `15_mcp-marketplace`, `17_panel-administratora` | Unauthorized external mutation, provider catalog ownership, tenant policy ownership |
| `15_mcp-marketplace` — MCP Marketplace | Provider metadata, capability definitions, installation context | Available capability, connector listing, install/enablement metadata | `14_mcp-iris`, `17_panel-administratora`, calling modules | Runtime execution and external mutation execution |
| `16_organizacja` — Organizacja | Organization profile, knowledge, memory candidates, source refs, context imports | Organization context, knowledge/memory layer, source-backed context | All modules | Domain decisions, user preferences, tenant/admin policy |
| `17_panel-administratora` — Panel Administratora | Tenant state, users, roles, security policy, governance constraints | Tenant controls, admin policy, role/permission boundaries, audit configuration | All modules, SuperAdmin control plane where applicable | Business content, user personal preferences, module domain truth |
| `18_ustawienia` — Ustawienia | User preferences, workspace preferences, notification/UI/AI behavior choices | Preference state, workspace/user configuration | All modules | Tenant policy and organization-wide governance |
| `19_portal-partnerski` — Portal Partnerski | Partner identity, partner customer context, partner workflow state | Partner deliverable state, partner dashboard outputs, partner business workflow | `09_outputs`, `17_panel-administratora`, partner-specific workflows | Core tenant ownership, admin policy ownership, internal consulting module truth |

## System Flow Rules

1. Chat can start any work, but it must not hide ownership or approvals.
2. My Work routes attention; it must not become the source of truth for domain objects.
3. Interview and Tools create evidence-backed diagnosis, not final execution ownership.
4. Initiatives own the change rationale and decision layer.
5. Execution owns delivery work and blockers.
6. Results own KPI/value realization.
7. Finance owns financial models and assumptions.
8. Outputs own packaging and export flow.
9. Documents, Tables and Presentations own editable artifact form.
10. Meeting creates follow-up and review outcomes, but sends durable work back to owner modules.
11. Organization supplies context and memory, but does not override domain object owners.
12. Admin/SuperAdmin govern tenant and platform boundaries, not business truth.
13. Settings affect user/workspace behavior, not policy.
14. MCP Marketplace lists capabilities; MCP IRIS executes approved integration calls.
15. Partner Portal is a separate business path and must respect tenant/ACL boundaries.

## Anti-Island Rules

- A module MUST declare its input, output, downstream handoff and forbidden ownership.
- A module MUST preserve source/evidence links when passing work.
- A module MUST NOT copy a durable object into a second owner module.
- A module MUST NOT turn generated text into approved truth without review where impact is material.
- A module MUST NOT bypass tenant, ACL, source or approval boundaries.
- A module SHOULD expose the next module/action so the user understands what happens after completion.

## RAW 2.0 Gate

RAW material can be used for target-state contract work only after this logical model remains consistent with:

- module `CODEMAP.md` files,
- module `STATUS.md` files,
- `OBJECT_GRAPH.md`,
- `MODULE_HANDOFFS.md`,
- `APPLICATION_OPERATING_MODEL.md`.

If RAW proposes a new owner for an existing object, the change must be treated as a versioned contract decision, not a silent edit.
