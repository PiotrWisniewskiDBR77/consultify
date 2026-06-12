-- V8 Source Truth — transformation lifecycle (entrypoints → materializations → initiatives)
-- Extends WP-W3-LIFECYCLE-01 with pre-initiative entrypoints and promotion links.
--
-- Prerequisite: tables are created here on first apply (ALTER adds validation timestamp for existing rows).

CREATE TABLE IF NOT EXISTS v8_initiative_entrypoints (
  entrypoint_id      TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  source_type        TEXT NOT NULL
                     CHECK (source_type IN ('idea', 'interview', 'tools_assessment', 'chat', 'manual')),
  source_id          TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS v8_initiative_materializations (
  materialization_id   TEXT PRIMARY KEY,
  entrypoint_id      TEXT NOT NULL,
  initiative_id      TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entrypoint_id) REFERENCES v8_initiative_entrypoints(entrypoint_id)
);

ALTER TABLE v8_initiative_entrypoints ADD COLUMN IF NOT EXISTS last_validated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_entrypoints_source ON v8_initiative_entrypoints(source_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_materializations_initiative ON v8_initiative_materializations(initiative_id, organization_id);
