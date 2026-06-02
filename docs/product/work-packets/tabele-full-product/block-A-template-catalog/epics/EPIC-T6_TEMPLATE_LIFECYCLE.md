# EPIC-T6 — Template Lifecycle & Governance

**Block:** A — Template Catalog
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 5D and 17.
**Owner agent:** A (backend) + B (frontend)

---

## Goal

Add lifecycle metadata and governance to `tp_base_templates`: `status` ∈ {`draft`, `approved`, `deprecated`}, `version` (semver), `owner_user_id`, `approval_history` (JSONB), `governance_rules` (JSONB). Provide endpoints for super-admins to promote draft → approved or mark approved → deprecated, with full audit trail. Surface lifecycle in `ArtifactModuleHome` via badge + filter chip.

## Acceptance criteria

- DB migration adds 5 columns to `tp_base_templates` without rewriting rows.
- `POST /api/table-platform/templates/:id/approve` sets `status='approved'`, appends `approval_history` row `{actor_user_id, actor_role, action: 'approve', reason, at}`, writes audit log.
- `POST /api/table-platform/templates/:id/deprecate` sets `status='deprecated'`, same audit treatment.
- `GET /api/table-platform/templates?status=approved` returns only approved for caller's tenant.
- Both endpoints require super-admin role; non-admin returns 403; cross-tenant returns 403.
- `ArtifactModuleHome` lane=tabele shows lifecycle filter chip with default value `Approved`.
- Each template card shows lifecycle badge: green dot (approved), amber dot (draft), gray strike-through (deprecated).
- `TemplateLifecycleBadge` and `TemplateLifecycleFilter` components have unit tests.
- Cross-tenant 403 integration test covers approve, deprecate, and list endpoints.

## In scope

### Backend
- Migration `20260508_block_a_template_lifecycle.sql` (top-level `consultify/server/migrations/`, per S0 finding A-S0-F1):
  - `ALTER TABLE tp_base_templates ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deprecated'))`
  - `ALTER TABLE tp_base_templates ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0'`
  - `ALTER TABLE tp_base_templates ADD COLUMN owner_user_id TEXT NULL` (TEXT not UUID, no FK — matches `created_by` convention; per S0 finding A-S0-F2)
  - `ALTER TABLE tp_base_templates ADD COLUMN approval_history JSONB NOT NULL DEFAULT '[]'::jsonb`
  - `ALTER TABLE tp_base_templates ADD COLUMN governance_rules JSONB NOT NULL DEFAULT '{}'::jsonb`
  - Plus indexes: `idx_tp_templates_status`, `idx_tp_templates_owner WHERE owner_user_id IS NOT NULL`.
  - Plus `UPDATE` promoting 3 legacy `is_featured=true` templates (CRM Pipeline, Project Tracker, HR Onboarding) to `status='approved'` with system actor (per S0 finding A-S0-F3).
- New service `TemplateLifecycleService.ts`:
  - `approveTemplate({id, actorUserId, actorRole, reason, organizationId})` → returns updated template + audit row id
  - `deprecateTemplate({id, actorUserId, actorRole, reason, organizationId})` → same
  - `listTemplates({organizationId, status?, category?})`
  - `getTemplateGovernance(templateId)` → returns `{governance_rules, version, owner_user_id, approval_history}`
- Routes added to `table-platform.routes.ts`:
  - `POST /templates/:id/approve` (super-admin gate)
  - `POST /templates/:id/deprecate` (super-admin gate)
  - `GET /templates?status=...` (existing route, just a filter param)

### Frontend
- New `TemplateLifecycleBadge.tsx` (3 variants).
- New `TemplateLifecycleFilter.tsx` (chip toolbar with `All / Approved / Draft`).
- Update `ArtifactModuleHome.tsx`:
  - Read `templates[].status` and group accordingly.
  - Filter chip controls visible group.
  - Each card has badge.

### Tests
- `TemplateLifecycleService.test.ts`: approve/deprecate/list/owner-check/cross-tenant.
- `template-lifecycle-acl.test.ts`: integration cross-tenant 403.
- `TemplateLifecycleBadge.test.tsx`: 3 variants render.
- `TemplateLifecycleFilter.test.tsx`: filter chip behavior.

## Out of scope

- "Self-publish my own template" UX (out of program).
- Marketplace listing for approved templates (out of program).
- Per-tenant template forks (out of program).

## Authorization model

| Action | Allowed roles |
|---|---|
| List approved templates | All tenant users |
| List draft templates | super-admin + template owner_user_id |
| List deprecated templates | super-admin |
| Approve | super-admin |
| Deprecate | super-admin |
| Create template (existing) | super-admin |

Tenant scoping: all queries filter by `organization_id` from auth context. Super-admin role is checked via `req.user.is_superadmin === true`.

## Dependencies

- A-XB2: `governance_rules` shape consumed by Block C `TableQaService`. Stable schema documented in EPIC-T5.

## Estimated effort

- S1 (1 day): backend migration, service, routes, unit + integration tests.
- S4 (1.5 days): frontend badge, filter, integration with `ArtifactModuleHome`.

## Open questions

- Q: Should `deprecated` templates be hidden from non-admins entirely, or shown grayed-out?  
  A (CTO): hidden from non-admins. Deprecated implies "do not use"; still visible to super-admin for audit.
