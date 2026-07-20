-- 20260720_project_team_members.sql
-- Team-membership table backing ProjectTeamBoard (`/api/pmo-roles/projects/:id/team*`).
--
-- Problem: src/components/Projects/ProjectTeamBoard.tsx calls 4 endpoints that
-- did not exist on the backend (GET .../team, GET .../team/stats, POST .../team,
-- DELETE .../team/:userId) -> board always empty, 404 swallowed silently.
--
-- This is a NEW, dedicated table — not a reuse of the legacy `project_members`
-- table (server/migrations/542_..., free-text `project_role`). ProjectTeamBoard's
-- contract is PMO-role-id based (`pmoRoleId`, which may be a SYSTEM_ROLES id
-- string like "project-manager" OR a row id from the org-scoped `pmo_roles`
-- table added in 20260720_pmo_roles_table.sql). Because pmo_role_id can point
-- into either domain, it is intentionally NOT a foreign key.
--
-- Postgres-native (TEXT PK, TIMESTAMPTZ, BOOLEAN-free). Idempotent: safe to run
-- twice (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, no destructive
-- statements).

CREATE TABLE IF NOT EXISTS project_team_members (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL,
    project_id         TEXT NOT NULL,
    user_id            TEXT NOT NULL,
    pmo_role_id        TEXT,
    allocation_percent INTEGER NOT NULL DEFAULT 100,
    start_date         DATE,
    end_date           DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_team_members_project_user_unique UNIQUE (project_id, user_id),
    CONSTRAINT project_team_members_org_fk FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT project_team_members_project_fk FOREIGN KEY (project_id)
        REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_team_members_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_team_members_org ON project_team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_project ON project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_user ON project_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_role ON project_team_members(pmo_role_id);
