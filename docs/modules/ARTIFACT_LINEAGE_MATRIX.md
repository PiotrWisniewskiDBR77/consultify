---
doc_id: ARTIFACT_LINEAGE_MATRIX
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# Artifact Lineage Matrix

## Purpose

Define canonical lineage for all major artifacts so end-to-end development preserves ownership, approvals, and evidence.

This matrix is used for cross-module planning and release governance.

## Canonical Artifact Lineage

| Artifact | Canonical owner module | Upstream sources | Approval gate | Downstream distribution |
| --- | --- | --- | --- | --- |
| `Conversation artifact` | `01_czat` | user prompt, org context, source refs | proposal review for high-impact actions | `02`, `03`, `04`, `09` |
| `Interview finding pack` | `03_wywiad` | interview responses, source references | reviewer acceptance | `04`, `05` |
| `Analysis recommendation pack` | `04_narzedzia` | findings, frameworks, source evidence | owner approval in receiving module | `05`, `09` |
| `Initiative dossier` | `05_inicjatywy` | findings, recommendations, business rationale | initiative governance/approval | `06`, `07`, `08`, `09` |
| `Execution task bundle` | `06_realizacja` | approved initiative and scope | execution transitions and role checks | `07`, `13`, `02` |
| `KPI realization snapshot` | `07_rezultaty` | execution evidence + KPI definitions | value review acceptance | `08`, `09` |
| `Financial model pack` | `08_finanse` | KPI inputs, assumptions, tables | finance approval gates | `09`, `05`, `07` |
| `Output package` | `09_outputs` | approved results + finance + sources | export/publish approval | client delivery, library |
| `Document artifact` | `10_dokumenty` | output package request + source pack | document publish/review gate | `09`, `13`, export |
| `Table artifact` | `11_tabele` | output/table request + structured inputs | model/publish gate | `08`, `09`, `10`, `12` |
| `Deck artifact` | `12_prezentacje` (`/prezentacje`) and `09_outputs` (`/presentations`) | output/deck request + narrative context | presentation release gate | `09`, `13`, export |
| `Meeting summary pack` | `13_meeting` | agenda, artifacts, decisions | meeting closure/acceptance | `02`, `05`, `06`, `09` |
| `Connector execution report` | `14_mcp-iris` | approved connector invocation | high-impact external execution approval | calling module + audit |
| `Partner deliverable` | `19_portal-partnerski` | partner workflow state + output package | tenant/partner approval flow | partner-facing distribution |

## Mandatory Lineage Fields

Every durable artifact entry should carry:

- `artifactId`
- `artifactType`
- `tenantId`
- `ownerModule`
- `sourceRefs`
- `evidenceRefs`
- `approvalRefs`
- `version`
- `status`
- `downstreamRefs`

## Critical Rules

1. Artifact form module does not automatically own business truth.
2. Output/export surfaces must always retain source and approval references.
3. No artifact can be promoted to final without explicit approval state where impact is material.
4. Any new artifact type must be added to this matrix before runtime rollout.

## Evidence Contract

Artifact lifecycle documentation is considered valid only with:

- route evidence,
- component evidence,
- API evidence,
- test evidence.
