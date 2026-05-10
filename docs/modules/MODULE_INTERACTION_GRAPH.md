---
doc_id: MODULE_INTERACTION_GRAPH
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# Module Interaction Graph

## Purpose

Define one canonical graph of interactions between all 19 modules and the SuperAdmin control plane.

This graph is used to prevent island development and accidental ownership drift.

## Interaction Types

- `read`: module consumes data but does not mutate owner state.
- `write_request`: module requests mutation in owner module.
- `handoff`: ownership-compatible transition to next module.
- `policy_enforced`: operation constrained by admin/superadmin policy.
- `derived_view`: read-only computed projection for UX/reporting.

## Canonical Cross-Module Edges

| From | To | Type | Payload | Owner rule |
| --- | --- | --- | --- | --- |
| `01_czat` | `03_wywiad` | `handoff` | conversation context, interview intent | Chat does not own interview records. |
| `01_czat` | `05_inicjatywy` | `write_request` | draft recommendation/proposal | Initiative owner accepts/rejects changes. |
| `02_moja-praca` | all domain modules | `derived_view` | work queue/action pointers | My Work routes attention only. |
| `03_wywiad` | `04_narzedzia` | `handoff` | findings and evidence refs | Tools cannot detach source provenance. |
| `03_wywiad` | `05_inicjatywy` | `handoff` | opportunities and pain points | Initiative remains canonical owner. |
| `04_narzedzia` | `05_inicjatywy` | `write_request` | analysis-backed recommendation | Requires source and confidence context. |
| `05_inicjatywy` | `06_realizacja` | `handoff` | approved initiative and scope | Execution owns tasks, not strategy. |
| `05_inicjatywy` | `07_rezultaty` | `handoff` | KPI targets and expected value | Results owns realized measurement. |
| `05_inicjatywy` | `08_finanse` | `handoff` | assumptions and budget envelope | Finance owns model assumptions. |
| `06_realizacja` | `07_rezultaty` | `handoff` | delivery evidence and status | Results maps evidence to KPI/ROI. |
| `07_rezultaty` | `08_finanse` | `handoff` | KPI/ROI inputs | Finance calculates, Results validates realized value. |
| `07_rezultaty` | `09_outputs` | `handoff` | approved outcomes and evidence | Outputs packages, does not re-own KPI truth. |
| `08_finanse` | `09_outputs` | `handoff` | model outputs and assumptions | Outputs must show assumptions/provenance. |
| `09_outputs` | `10_dokumenty` | `handoff` | document artifact request | Document form owner is module `10`. |
| `09_outputs` | `11_tabele` | `handoff` | table artifact request | Table form owner is module `11`. |
| `09_outputs` | `12_prezentacje` | `handoff` | standalone generator context | `/presentations` runtime still belongs to `09`. |
| `13_meeting` | `02_moja-praca` | `handoff` | follow-up tasks and decisions | My Work surfaces, owner modules persist. |
| `16_organizacja` | all modules | `read` | org context and source refs | Context layer cannot override domain ownership. |
| `17_panel-administratora` | all modules | `policy_enforced` | tenant policies and ACL constraints | Admin constrains access, not domain truth. |
| `18_ustawienia` | all modules | `read` | user/workspace preferences | Preferences cannot bypass security. |
| `15_mcp-marketplace` | `14_mcp-iris` | `handoff` | capability metadata | Marketplace catalogs, IRIS executes. |
| `19_portal-partnerski` | `09_outputs` | `handoff` | partner deliverables package | Partner outputs remain tenant-bounded. |

## SuperAdmin Control Plane Edges

| From | To | Type | Scope | Rule |
| --- | --- | --- | --- | --- |
| `superadmin` | `17_panel-administratora` | `policy_enforced` | tenant provisioning, global policy | Control plane controls policy only. |
| `superadmin` | all modules | `policy_enforced` | role templates, security posture, feature flags | No direct business object ownership transfer. |
| `superadmin` | `14_mcp-iris` | `policy_enforced` | integration allow/deny policy | Execution still requires local approvals when high impact. |
| `superadmin` | `15_mcp-marketplace` | `policy_enforced` | connector governance | Catalog governance cannot mutate tenant content. |

## Non-Negotiable Integrity Rules

1. Every cross-module write must target canonical owner module.
2. Every high-impact handoff must carry `sourceRefs`, `evidenceRefs`, `approvalState`.
3. SuperAdmin can constrain operations but cannot become owner of domain objects.
4. Outputs and presentations are delivery forms, not source truth owners.
5. Any new edge must be added here before runtime merge.
