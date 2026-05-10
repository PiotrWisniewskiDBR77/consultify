---
doc_id: DECISION_LOG
doc_kind: ENTERPRISE_GOVERNANCE_LOG
owner: user
status: active
last_updated: 2026-05-10
---

# Decision Log

## Purpose

Record the product, architecture, UI/UX, and governance decisions that shape Consultify development.

This prevents future work from re-litigating settled decisions without explicit change control.

## Decision Format

Each decision must include:

- decision ID,
- date,
- owner,
- decision,
- rationale,
- affected docs,
- impact on runtime/gates,
- supersedes/replaces if applicable.

## Active Decisions

| ID | Date | Decision | Rationale | Affected docs |
| --- | --- | --- | --- | --- |
| `DEC-001` | 2026-05-10 | Function contracts use 12-section standard. | Prevent shallow function docs and enforce component/evidence ownership. | `FUNCTION_CONTRACT_STANDARD.md`, `functions/*.md` |
| `DEC-002` | 2026-05-10 | Runtime PRs must update module/function contracts. | Runtime and documentation must not drift. | `module-contract-pr-gate.ts`, `HIERARCHY_OF_TRUTH.md` |
| `DEC-003` | 2026-05-10 | SuperAdmin is control plane, not domain owner. | Prevent platform admin from bypassing domain object ownership. | `CONTROL_PLANE_CONTRACT.md`, `CROSS_MODULE_PERMISSION_MATRIX.md` |
| `DEC-004` | 2026-05-10 | UI/UX uses approved component composition. | Feature screens must not invent local design systems. | `APPROVED_COMPONENT_COMPOSITION.md`, `UI_UX_COMPONENTS_AND_ARTIFACTS_UNIFIED_STANDARD.md` |
| `DEC-005` | 2026-05-10 | Artifact lifecycle is governed through lineage matrix. | Outputs, documents, decks and tables must preserve source/evidence/approval. | `ARTIFACT_LINEAGE_MATRIX.md` |
| `DEC-006` | 2026-05-10 | RAW can drive development only after traceability mapping. | RAW input must become contract-grade scope before coding. | `SYSTEM_TRACEABILITY_MATRIX.md`, `CHANGE_TYPE_DOR_DOD.md` |

## Change Control

Changing a decision requires:

1. New decision row with supersedes reference.
2. Update impacted contracts in same PR.
3. Owner acceptance in PR body.
4. Passing module contract rerun gate.
