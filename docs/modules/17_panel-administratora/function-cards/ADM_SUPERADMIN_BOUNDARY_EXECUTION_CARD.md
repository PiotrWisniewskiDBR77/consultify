---
module_id: MODULE_ADMIN_PANEL
function_id: ADM_SUPERADMIN_BOUNDARY
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: NEEDS_OWNER_DECISION
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — ADM_SUPERADMIN_BOUNDARY

## 1. Metadata

- scope_anchor: `17_panel-administratora/ADM_SUPERADMIN_BOUNDARY`
- primary_module: `17_panel-administratora`
- primary_function: `ADM_SUPERADMIN_BOUNDARY`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - boundary map between tenant admin, settings, and superadmin planes
  - permission drift identification and decision hardening
  - acceptance evidence matrix for denied paths
- Out of scope:
  - changing route guards
  - role model implementation changes

## 3. Source -> Decision -> Evidence Chain

| Task ID | Source requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `ADM-RAW-P0-001` | no hidden role escalation across planes | `DEFER_TO_OWNER` | `ProtectedRoute.tsx` hierarchy + `AppRoutes.tsx`; current state `NOT_DONE` |
| `ADM-RAW-P1-005` | settings/admin/superadmin ownership must be non-overlapping | `ENHANCE` | superadmin SSOT ownership split + settings/admin route evidence |
| `ADM-RAW-P2-006` | ACL denial matrix proof must be explicit | `NEW` | `NOT_DONE` (module-local regression evidence missing) |

## 4. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `ADM-RAW-P0-001` | `P0` | superadmin currently satisfies admin guard due hierarchy | `NEEDS_OWNER_DECISION` |
| `ADM-RAW-P1-005` | `P1` | boundary language across module docs was not fully normalized | `DOCS_RESOLVED` |
| `ADM-RAW-P2-006` | `P2` | denied-path regression proof matrix missing | `NOT_DONE` |

## 5. Done Gate

- contract completeness: `PASS`
- evidence completeness: `PASS_WITH_P2`
- owner acceptance: `NEEDS_OWNER_DECISION`
