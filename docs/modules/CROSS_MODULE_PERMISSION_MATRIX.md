---
doc_id: CROSS_MODULE_PERMISSION_MATRIX
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# Cross-Module Permission Matrix

## Purpose

Define one cross-module role/action matrix for the whole application, including Admin and SuperAdmin planes.

This matrix is authoritative when planning new features that span multiple modules.

## Role Set

- `tenant_user`: standard authenticated tenant user
- `tenant_manager`: elevated business user within tenant
- `tenant_admin`: tenant policy/admin user
- `superadmin`: global platform control-plane user

## Action Legend

- `V`: view/read
- `C`: create
- `U`: update
- `A`: approve/high-impact authorize
- `X`: denied
- `P`: policy-only (control-plane operation)

## Core Domain Matrix

| Module | tenant_user | tenant_manager | tenant_admin | superadmin |
| --- | --- | --- | --- | --- |
| `01_czat` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `02_moja-praca` | `V,C,U` | `V,C,U` | `V,C,U` | `V,P` |
| `03_wywiad` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `04_narzedzia` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `05_inicjatywy` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `06_realizacja` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `07_rezultaty` | `V` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `08_finanse` | `V` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `09_outputs` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `10_dokumenty` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `11_tabele` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `12_prezentacje` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `13_meeting` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `14_mcp-iris` | `V,C` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `15_mcp-marketplace` | `V` | `V,C,U` | `V,C,U,A` | `V,P` |
| `16_organizacja` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |
| `17_panel-administratora` | `X` | `V` | `V,C,U,A` | `V,P` |
| `18_ustawienia` | `V,C,U` | `V,C,U` | `V,C,U` | `V,P` |
| `19_portal-partnerski` | `V,C,U` | `V,C,U,A` | `V,C,U,A` | `V,P` |

## Control-Plane Rules

1. `superadmin` uses policy/control-plane operations (`P`) and must not directly own domain content.
2. `tenant_admin` can govern tenant-level boundaries but does not rewrite domain truth ownership.
3. `tenant_manager` may approve domain transitions where module contract allows it.
4. `tenant_user` cannot perform admin-plane policy mutations.

## High-Impact Action Guard

For actions marked with `A`:

- explicit approval required,
- audit reference required,
- source/evidence visibility required,
- deny-by-default when role resolution is ambiguous.

## Mapping Requirement

Affected module contracts must reference this matrix in:

- `06_PERMISSIONS_AND_SECURITY.md`
- function section `10. Security, Roles, and Tenancy`
