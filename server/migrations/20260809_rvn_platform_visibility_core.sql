-- RN-G1 Platform Foundation — ABAC/visibility resolver core schema.
--
-- Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §B.1.
-- Three tables: visibility policies (per org/domain, time-ranged) / resource
-- visibility (one row per resource, denormalized mode + scope/owner) /
-- resource ACL (explicit grants for RESTRICTED_ACL mode).

-- `EXCLUDE USING gist` on the policy's effective time range requires
-- btree_gist (gist support for the `=` operator on TEXT columns combined
-- with a range column). Enable it if not already present.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS rvn_platform_visibility_policies (
  policy_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       TEXT NOT NULL,
  domain             TEXT NOT NULL,
  policy_version        INT NOT NULL,
  visibility_mode       TEXT NOT NULL CHECK (visibility_mode IN
                          ('OPEN_ORG','SCOPE','MANAGEMENT_CHAIN','PRIVATE','RESTRICTED_ACL')),
  allow_narrowing_only    BOOLEAN NOT NULL DEFAULT true,
  default_scope_type     TEXT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  effective_from        TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to         TIMESTAMPTZ NULL,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain, policy_version),
  EXCLUDE USING gist (
    organization_id WITH =, domain WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  )
);

CREATE TABLE IF NOT EXISTS rvn_platform_resource_visibility (
  resource_type   TEXT NOT NULL,
  resource_id    TEXT NOT NULL,
  organization_id  TEXT NOT NULL,
  visibility_mode  TEXT NOT NULL,
  policy_id     UUID NOT NULL REFERENCES rvn_platform_visibility_policies(policy_id),
  scope_type     TEXT NULL,
  scope_id      TEXT NULL,
  owner_user_id   TEXT NULL,
  sensitivity    TEXT NULL,
  PRIMARY KEY (resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_rvn_rv_scope ON rvn_platform_resource_visibility(organization_id, resource_type, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_rvn_rv_owner ON rvn_platform_resource_visibility(organization_id, resource_type, owner_user_id);

CREATE TABLE IF NOT EXISTS rvn_platform_resource_acl (
  resource_type  TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  grantee_type  TEXT NOT NULL CHECK (grantee_type IN ('user','team','role')),
  grantee_id   TEXT NOT NULL,
  access_level  TEXT NOT NULL CHECK (access_level IN ('view','contribute','approve')),
  granted_by   TEXT NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_type, resource_id, grantee_type, grantee_id)
);
