---
module_id: MODULE_ADMIN_PANEL
doc_kind: PERMISSIONS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Permissions & Security — Panel Administratora

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Admin-only actions require tenant role and audit.
- SuperAdmin boundaries must not leak to tenant admin users.

Function-level enforcement applies uniformly to: `ADM_ADMIN_WORKSPACE`, `ADM_SUPERADMIN_BOUNDARY`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.
- MUST surface unresolved permission contradictions as explicit risk states.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Permission Drift Register

| Drift ID | Priority | Source | Decision | Evidence / Status |
| --- | --- | --- | --- | --- |
| `ADM-RAW-P0-001` | `P0` | hard split doctrine (`17 != superadmin plane`) | `DEFER_TO_OWNER` | `NOT_DONE`: `ProtectedRoute` hierarchy allows `SUPERADMIN >= ADMIN` |
| `ADM-RAW-P2-006` | `P2` | acceptance requirement for denial regression | `NEW` | `NOT_DONE`: module-local ACL regression matrix missing |

## Guard Evidence (As-Is)

- `/admin/*` guard: `requiredRole="ADMIN"` in `AppRoutes.tsx`.
- `/superadmin/*` guard: `requiredRole="SUPERADMIN"` in `AppRoutes.tsx`.
- Effective evaluation: `ProtectedRoute.tsx` numeric hierarchy where `SUPERADMIN` level includes admin access level.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.
- [ ] Plane-separation policy is explicitly resolved for superadmin-on-admin access (`ADM-RAW-P0-001`).
