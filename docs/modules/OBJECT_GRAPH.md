---
doc_id: OBJECT_GRAPH
doc_kind: OBJECT_GRAPH
owner: user
status: draft
last_updated: 2026-05-09
---

# Object Graph

## Purpose

This document defines the core business objects that make Consultify a coherent consulting work system.

The rule is simple: every durable object must have one canonical owner, clear producers, clear consumers and evidence/provenance.

## Core Objects

| Object | Canonical owner | Produced by | Consumed by |
| --- | --- | --- | --- |
| `Conversation` | `01_czat` | user, Teresa, imported context | `02_moja-praca`, `03_wywiad`, `09_outputs` |
| `Source` | `16_organizacja` or producing module | upload, integration, user input, workspace knowledge | all evidence-backed modules |
| `Artifact` | producing artifact module | `09_outputs`, `10_dokumenty`, `11_tabele`, `12_prezentacje` | client delivery, meetings, exports |
| `Document` | `10_dokumenty` | artifact generation, user editing | `09_outputs`, `13_meeting`, exports |
| `Deck` | `12_prezentacje` | artifact generation, user editing | `09_outputs`, meetings, exports |
| `Table` | `11_tabele` | analysis, import, generated model | `08_finanse`, `09_outputs`, documents, decks |
| `Initiative` | `05_inicjatywy` | diagnosis, decision, user planning | `06_realizacja`, `07_rezultaty`, `08_finanse` |
| `Task` | `06_realizacja` | initiative breakdown, meeting action, AI suggestion | execution tracking, meetings, status reporting |
| `Decision` | `05_inicjatywy` or owning workflow | user approval, governance flow | execution, outputs, audit trail |
| `KPI` | `07_rezultaty` | initiative goals, result measurement | finance, outputs, management review |
| `ROI` | `07_rezultaty` with `08_finanse` | KPI and financial model | management review, client outputs |
| `FinancialModel` | `08_finanse` | user assumptions, tables, integrations | ROI, outputs, decisions |
| `Meeting` | `13_meeting` | scheduled event, follow-up workflow | tasks, decisions, outputs |
| `OrganizationContext` | `16_organizacja` | org profile, knowledge, memory, imports | Teresa, diagnosis, outputs, integrations |
| `Evidence` | source-owning module | source, calculation, review, approval | all high-impact outputs |
| `Approval` | owning workflow | user/admin approval | decisions, exports, high-impact mutations |
| `Export` | `09_outputs` | approved artifact package | client delivery, audit trail |

## Ownership Rules

- `Conversation` can initiate work but must not become the long-term owner of downstream business objects.
- `Initiative` owns why and what should change.
- `Task` owns execution work, not strategic rationale.
- `KPI` and `ROI` own value realization, not presentation wording.
- `Document`, `Deck` and `Table` own artifact form, not the business truth behind it.
- `OrganizationContext` provides shared context but must not override explicit module ownership.
- `Evidence` and `Approval` must be attached to high-impact decisions, exports and generated artifacts.

## Required Object Metadata

Every durable object should expose:

- `id`,
- `tenantId`,
- `ownerModule`,
- `createdBy`,
- `createdAt`,
- `updatedAt`,
- `sourceRefs`,
- `evidenceRefs`,
- `approvalState` when high-impact,
- `status`,
- `downstreamRefs`.

## Object Flow

1. `Conversation` captures intent.
2. `Source` and `OrganizationContext` ground the work.
3. `Wywiad` and `Narzędzia` create findings.
4. Findings become `Initiative` and `Decision`.
5. Initiatives become `Task`.
6. Tasks produce execution evidence.
7. Execution links to `KPI`, `ROI` and `FinancialModel`.
8. Outputs package approved work into `Artifact`, `Document`, `Deck`, `Table`, `Meeting` and `Export`.

## Open Verification Items

- Confirm exact model/type names in code during CODEMAP audit.
- Confirm whether all listed objects already exist as durable entities or are currently conceptual.
- Confirm which objects require explicit approval before mutation or export.
