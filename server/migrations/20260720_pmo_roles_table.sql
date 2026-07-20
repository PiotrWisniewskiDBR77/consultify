-- 20260720_pmo_roles_table.sql
-- FALA4 schema-drift fix (sekcja A: custom_roles collision)
--
-- Problem: pmoRoles.routes.ts (/api/pmo-roles) expected an ORG-SCOPED role table
-- with columns level / level_label / permissions / is_system / user_count and
-- UNIQUE(organization_id, name). It reused the name `custom_roles`, which is ALSO
-- the global RBAC table (rbac.routes.ts + migration 200) with a completely different
-- schema (display_name / icon / base_role / role_type / scope, UNIQUE(name) only,
-- no organization_id). Because CREATE TABLE IF NOT EXISTS is a no-op when the global
-- table already exists, every INSERT/SELECT from the PMO route hit a schema mismatch
-- (42703 undefined_column) -> silent empty / 500 for PMORoleSelector, ProjectTeamBoard,
-- RolesManagementPanel.
--
-- CTO decision: dedicated org-scoped table `pmo_roles`. Global `custom_roles` untouched.
-- Postgres-native (BOOLEAN true/false, TIMESTAMPTZ). Idempotent.

CREATE TABLE IF NOT EXISTS pmo_roles (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    level           INTEGER DEFAULT 3,
    level_label     TEXT DEFAULT 'Custom',
    permissions     TEXT,                 -- JSON array (string)
    color           TEXT DEFAULT 'gray',
    is_system       BOOLEAN DEFAULT FALSE,
    user_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT pmo_roles_org_name_unique UNIQUE (organization_id, name),
    CONSTRAINT pmo_roles_org_fk FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pmo_roles_org ON pmo_roles(organization_id);
