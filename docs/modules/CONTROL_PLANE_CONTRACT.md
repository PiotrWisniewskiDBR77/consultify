---
doc_id: CONTROL_PLANE_CONTRACT
doc_kind: SYSTEM_CONTRACT
owner: user
status: active
last_updated: 2026-05-10
---

# Control Plane Contract (Admin + SuperAdmin)

## Purpose

Define boundaries between:

- domain modules (`01`-`19`) as business work plane,
- `17_panel-administratora` as tenant admin plane,
- SuperAdmin as global control plane.

## Plane Model

| Plane | Primary surface | Owns | Must not own |
| --- | --- | --- | --- |
| Work plane | modules `01`-`19` | domain business objects and workflows | global policy and tenant bootstrap |
| Tenant admin plane | `17_panel-administratora` + `18_ustawienia` | tenant policy, role assignment, admin controls, preferences | domain initiative/task/kpi truth |
| Global control plane | SuperAdmin (`/superadmin/*`) | platform-level governance and cross-tenant controls | tenant business content ownership |

## Authority Matrix

| Capability | Domain modules | Admin | SuperAdmin |
| --- | --- | --- | --- |
| Read domain data | allowed by ACL | policy-dependent | policy-dependent |
| Mutate domain objects | canonical owner modules only | denied unless module owner API allows admin action | denied by default |
| Manage tenant members/roles | limited | allowed | allowed globally |
| Manage security posture | bounded by tenant policy | allowed in tenant scope | allowed globally |
| Configure integrations policy | request only | tenant-level allow/deny | global allow/deny |
| Override approvals | never | limited by explicit governance flow | never implicit; only explicit governance API |
| Access audit logs | module-local | tenant-wide | global |

## SuperAdmin Guardrails

1. SuperAdmin writes policy, not business truth.
2. SuperAdmin must not bypass module ownership for initiatives, tasks, KPI, ROI, financial models, outputs.
3. Any superadmin-triggered mutation in tenant runtime requires explicit audit references.
4. Deny-by-default on uncertain authorization.

## Admin and Settings Integration Rules

- `17_panel-administratora` sets tenant constraints consumed by all modules.
- `18_ustawienia` sets user/workspace preferences that shape UX only.
- Preferences cannot elevate role permissions.
- Admin policies must be visible in affected module states when blocking actions.

## Required Evidence For Control-Plane Changes

Any change touching `/admin/*` or `/superadmin/*` must update:

- route evidence (`AppRoutes.tsx` / `routeConfig.ts`),
- API evidence (`server/src/routes/**`),
- permission evidence (`06_PERMISSIONS_AND_SECURITY.md` in affected modules),
- test evidence (`tests/**` and `tests/e2e/**` readiness/admin suites).

## Merge Gate Hook

Control plane changes are blocked without corresponding contract updates and owner acceptances by:

- `scripts/testing/module-contract-pr-gate.ts`
- `docs/modules/CONTRACT_OWNERSHIP_REGISTRY.md`
