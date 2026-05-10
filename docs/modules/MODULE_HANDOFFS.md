---
doc_id: MODULE_HANDOFFS
doc_kind: MODULE_HANDOFFS
owner: user
status: draft
last_updated: 2026-05-09
---

# Module Handoffs

## Purpose

This document defines how modules pass work to each other.

Each handoff must preserve source, evidence, owner and next action. A handoff is not a copy of ownership unless the receiving module is the canonical owner of the next object.

## Canonical Handoff Chain

| From | To | Handoff payload | Rule |
| --- | --- | --- | --- |
| `01_czat` | `02_moja-praca` | intent, pending work, next actions | Chat starts work; work management makes it actionable. |
| `01_czat` | `03_wywiad` | conversation, context, interview goal | Interview must preserve source conversation. |
| `01_czat` | `09_outputs` | requested artifact, source context | Output must remain linked to sources and approvals. |
| `02_moja-praca` | any module | task/action link | Moja Praca routes user attention; it does not own domain truth. |
| `03_wywiad` | `04_narzedzia` | findings, diagnostic inputs | Tools may analyze but must preserve interview evidence. |
| `03_wywiad` | `05_inicjatywy` | findings, pain points, opportunities | Initiative owns proposed change. |
| `04_narzedzia` | `05_inicjatywy` | analysis result, recommendation | Recommendation must include source/evidence. |
| `05_inicjatywy` | `06_realizacja` | approved initiative, scope, owners | Execution owns delivery tasks. |
| `05_inicjatywy` | `07_rezultaty` | expected outcomes, KPI targets | Results owns measurement. |
| `05_inicjatywy` | `08_finanse` | assumptions, expected value, budget | Finance owns model and ROI calculation. |
| `06_realizacja` | `07_rezultaty` | delivery evidence, status, achieved outcomes | Results maps delivery to value. |
| `06_realizacja` | `13_meeting` | status, blockers, actions | Meeting creates follow-up tasks/decisions. |
| `07_rezultaty` | `08_finanse` | KPI, value realization, ROI inputs | Finance may calculate; results owns realized value. |
| `07_rezultaty` | `09_outputs` | outcomes, evidence, charts | Outputs packages approved story. |
| `08_finanse` | `09_outputs` | financial model, ROI, assumptions | Outputs must show assumptions/provenance. |
| `09_outputs` | `10_dokumenty` | document artifact request | Documents own editable document form. |
| `09_outputs` | `11_tabele` | table artifact request | Tables own editable spreadsheet/table form. |
| `09_outputs` | `12_prezentacje` | standalone generator request (`/prezentacje`) | `/presentations` runtime remains owned by Outputs; `12_prezentacje` owns only generator lane context. |
| `10_dokumenty` | `13_meeting` | document review package | Meeting can review, approve and create actions. |
| `11_tabele` | `08_finanse` | structured table data | Finance may consume validated data. |
| `12_prezentacje` | `13_meeting` | deck review package | Meeting can drive presentation follow-up. |
| `13_meeting` | `02_moja-praca` | follow-up tasks, decisions | Moja Praca surfaces the follow-up. |
| `16_organizacja` | all modules | organization context, knowledge, source refs | Canonical context ownership is `/organization`; `/context` remains transitional legacy surface. |
| `17_panel-administratora` | all modules | tenant/admin constraints | Admin controls boundaries, not domain content. |
| `18_ustawienia` | all modules | user/workspace preferences | Preferences shape UX but must not bypass security. |
| `14_mcp-iris` | all modules | integration execution, external context | External operations require approval when high-impact. |
| `15_mcp-marketplace` | `14_mcp-iris` | available integration capabilities | Marketplace lists/install capabilities; IRIS executes. |
| `19_portal-partnerski` | outputs/admin/workflows | partner track data, partner deliverables | Partner workflow remains tenant/ACL bounded. |

## Handoff Metadata

Every handoff should include:

- `sourceModule`,
- `targetModule`,
- `objectType`,
- `objectId`,
- `handoffReason`,
- `sourceRefs`,
- `evidenceRefs`,
- `approvalState`,
- `nextAction`,
- `createdBy`,
- `createdAt`.

## Anti-Patterns

- Passing generated text without source refs.
- Creating a copy of an initiative inside execution instead of referencing the initiative.
- Letting outputs become the only place where KPI, ROI or decision truth exists.
- Letting chat hide approvals or high-impact mutations.
- Installing or executing integrations without tenant/admin boundaries.

## Audit Questions

- Does the receiving module own the next object?
- Is the prior source still visible?
- Is there evidence for AI-generated or calculated content?
- Does the user know what happens next?
- Is approval required before mutation, export or client delivery?
