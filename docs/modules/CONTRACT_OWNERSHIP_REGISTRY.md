---
doc_id: CONTRACT_OWNERSHIP_REGISTRY
doc_kind: GOVERNANCE_REGISTRY
owner: user
status: canonical
last_updated: 2026-05-10
---

# Contract Ownership Registry (Modules + Functions)

## Purpose

Enforce explicit ownership for every module and every function contract.

This registry is a merge prerequisite for runtime-impacting PRs.

## Ownership Model

Each module has two mandatory owners:

- `business_owner` - accepts business intent, scope, outcome.
- `tech_owner` - accepts runtime feasibility, code alignment, and evidence.

Each function inherits ownership from its parent module unless listed in `Function Owner Overrides`.

## Module Owner Matrix

| Module | business_owner | tech_owner | acceptance_required |
| --- | --- | --- | --- |
| `01_czat` | `user` | `user` | `both` |
| `02_moja-praca` | `user` | `user` | `both` |
| `03_wywiad` | `user` | `user` | `both` |
| `04_narzedzia` | `user` | `user` | `both` |
| `05_inicjatywy` | `user` | `user` | `both` |
| `06_realizacja` | `user` | `user` | `both` |
| `07_rezultaty` | `user` | `user` | `both` |
| `08_finanse` | `user` | `user` | `both` |
| `09_outputs` | `user` | `user` | `both` |
| `10_dokumenty` | `user` | `user` | `both` |
| `11_tabele` | `user` | `user` | `both` |
| `12_prezentacje` | `user` | `user` | `both` |
| `13_meeting` | `user` | `user` | `both` |
| `14_mcp-iris` | `user` | `user` | `both` |
| `15_mcp-marketplace` | `user` | `user` | `both` |
| `16_organizacja` | `user` | `user` | `both` |
| `17_panel-administratora` | `user` | `user` | `both` |
| `18_ustawienia` | `user` | `user` | `both` |
| `19_portal-partnerski` | `user` | `user` | `both` |

## Function Ownership Resolution

Resolved owner for each function contract:

1. Explicit function override in this file, if present.
2. Otherwise inherit from module owner matrix.

This means all files under `docs/modules/<NN_slug>/functions/*.md` have mandatory owners even without local override.

## Function Owner Overrides

Current state: no overrides.

- Policy: keep empty unless a function is managed by a different business or technical owner than its parent module.
- When adding override, include exact `function_id`, `business_owner`, `tech_owner`, and reason.

## Acceptance Protocol

For any PR changing:

- runtime (`src/**`, `server/src/**`, `packages/**`) and
- module/function contracts,

the PR description MUST include:

- impacted module IDs,
- impacted function IDs,
- `business_owner_acceptance: yes/no`,
- `tech_owner_acceptance: yes/no`.

If either acceptance is missing, PR gate is `FAIL`.

## CI Enforcement

Enforced by:

- `scripts/testing/module-contract-pr-gate.ts`
- `scripts/testing/module-contract-rerun-gate.ts`
