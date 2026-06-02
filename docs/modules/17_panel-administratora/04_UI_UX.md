---
module_id: MODULE_ADMIN_PANEL
doc_kind: UI_UX
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# UI/UX — Panel Administratora

## 1. Main Screen

As-Is: `/admin/*` is an active secured admin workspace and tenant control plane. `/superadmin/*` is a separate plane and not this module. The screen job is tenant/admin control, policy and governance.

## 2. Runtime States

- Loading: admin data, tenant settings and policy state must show loading before controls are trusted.
- Empty: empty admin tables/settings must explain whether there is no data, no access or no configuration.
- Error: failures must be visible through business-readable banner/toast states, not raw internals.
- Degraded: restricted permissions, unavailable policy services or partial admin data must be visible.
- Success: admin mutations must confirm what changed, who/what is affected and next review/audit step.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps admin module navigation. Menu 3 is the active admin command row for selected tenant, policy, user, role, setting or governance object.

## 4. AI Actions Placement

Any contextual AI assistance for admin review, policy analysis or troubleshooting must live in Menu 3/right-side command placement. It must not be duplicated in the admin canvas.

## 5. Next Action Guidance

Admin UX must tell the user whether to configure, review permissions, approve a change, inspect audit, retry, request higher access or stop because access is denied.

## 6. Source / Evidence / Provenance

Admin decisions must show tenant, role/policy source, affected object and audit/evidence context. Security/ACL states cannot be hidden.

## 7. Approval / Diff / Review

Destructive/high-impact admin actions require explicit approval/review before execution and audit after execution. Role, policy and tenant changes must show diff/impact where available.

## 8. Anti-Patterns

- Hidden tenant/ACL denial.
- Admin mutation without confirmation and audit.
- Raw internal identifiers as the only user-facing explanation.
- AI actions duplicated in canvas and Menu 3.
- Confusing `/admin/*` with `/superadmin/*`.
- Implicit role escalation (for example platform operator inheriting tenant-admin action path without explicit policy and UX disclosure).

## 9. As-Is Gaps

- Existing docs confirm active secured admin workspace and route ownership, but not the full state/copy matrix for every admin surface.
- Diff/impact evidence for all admin mutations remains to be validated.
- Boundary contradiction remains open: guard hierarchy allows superadmin through admin guard (`ADM-RAW-P0-001`).

## 10. Critical Chain Ledger (source -> decision -> evidence)

| Claim | Source | Decision | Evidence / Status |
| --- | --- | --- | --- |
| Admin UI is tenant control plane | enterprise P32 contract + runtime mount | `KEEP` | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`, `AdminSettingsModule.tsx` |
| Personal preferences are not owned by module 17 | P32 ownership matrix + settings runtime | `KEEP` | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`, `SettingsView.tsx` |
| Platform controls belong to superadmin | superadmin SSOT + route mount | `KEEP` | `SUPERADMIN_V8_SSOT.md`, `SuperAdminView.tsx` |
| Plane separation is fully enforced in UX and access | security doctrine | `DEFER` | `NOT_DONE` while `ADM-RAW-P0-001` is unresolved |
| High-impact admin actions always show auditable diff evidence | contract requirement | `ENHANCE` | `NOT_DONE` (runtime evidence packet missing) |

## 10A. Acceptance Criteria

- `/admin/*` is documented as tenant admin control plane; `/superadmin/*` remains separate.
- Loading, empty, error, degraded and success states are visible and actionable.
- AI/admin assist actions use Menu 3/right-side placement without duplication.
- Tenant/ACL/security state and evidence are visible.
- High-impact admin actions require approval/review and audit.
- Boundary risk `ADM-RAW-P0-001` is explicitly visible as open (`NEEDS_OWNER_DECISION`), not masked as PASS.

## 11. Function Annex — Admin Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `ADM_ADMIN_WORKSPACE` | Admin Workspace | `/admin/*` | real | `AdminView` + `ProtectedRoute(requiredRole="ADMIN")` | `functions/ADM_ADMIN_WORKSPACE.md` |
| `ADM_SUPERADMIN_BOUNDARY` | SuperAdmin Boundary | `/admin/*` vs `/superadmin/*` | partial (`P0 open`) | route and role boundary rules | `functions/ADM_SUPERADMIN_BOUNDARY.md` |
