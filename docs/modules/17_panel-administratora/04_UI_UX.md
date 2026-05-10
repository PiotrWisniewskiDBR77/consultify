---
module_id: MODULE_ADMIN_PANEL
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
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

## 9. As-Is Gaps

- Existing docs confirm active secured admin workspace and route ownership, but not the full state/copy matrix for every admin surface.
- Diff/impact evidence for all admin mutations remains to be validated.

## 10. Acceptance Criteria

- `/admin/*` is documented as tenant admin control plane; `/superadmin/*` remains separate.
- Loading, empty, error, degraded and success states are visible and actionable.
- AI/admin assist actions use Menu 3/right-side placement without duplication.
- Tenant/ACL/security state and evidence are visible.
- High-impact admin actions require approval/review and audit.
