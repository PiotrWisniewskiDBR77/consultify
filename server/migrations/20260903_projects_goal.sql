-- Project API persists an optional strategic goal. Keep the canonical
-- PostgreSQL schema aligned with the mounted create/update handlers.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS goal TEXT;
