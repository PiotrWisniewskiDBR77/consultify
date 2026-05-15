-- V8 Workspace Governance — Wave 15
-- Permissions, content classification, compliance checks

-- ==========================================
-- 1. Workspace permissions (grant / revoke)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_workspace_permissions (
  permission_id   TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL
                  CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'guest')),
  granted_by      TEXT NOT NULL,
  granted_at      TEXT NOT NULL,
  revoked_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_ws_perm_workspace
  ON v8_workspace_permissions(workspace_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_ws_perm_user_workspace
  ON v8_workspace_permissions(user_id, workspace_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_ws_perm_active
  ON v8_workspace_permissions(workspace_id, organization_id)
  WHERE revoked_at IS NULL;

-- ==========================================
-- 2. Content governance (per session resource)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_content_governance (
  record_id       TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  resource_ref    TEXT NOT NULL,
  classification  TEXT NOT NULL
                    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  retention_days  INTEGER NOT NULL DEFAULT 0,
  classified_by   TEXT NOT NULL,
  classified_at   TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES v8_workspace_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_content_gov_session
  ON v8_content_governance(session_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_content_gov_org_class
  ON v8_content_governance(organization_id, classification);

-- ==========================================
-- 3. Compliance checks (append-only audit)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_compliance_checks (
  check_id        TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  check_type      TEXT NOT NULL,
  passed          INTEGER NOT NULL DEFAULT 0
                    CHECK (passed IN (0, 1)),
  details         TEXT NOT NULL DEFAULT '',
  checked_at      TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES v8_workspace_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_compliance_session
  ON v8_compliance_checks(session_id, organization_id, checked_at);

CREATE INDEX IF NOT EXISTS idx_v8_compliance_org_type
  ON v8_compliance_checks(organization_id, check_type);
