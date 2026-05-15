-- Feedback #406b042a CRIT — "Nie można usuwać kont - wyskakuje błąd"
--
-- Root cause: UserController.deleteUser soft-delete UPDATE references
-- users.deleted_at which does not exist on the production schema, so every
-- delete attempt fails with `column "deleted_at" of relation "users" does not
-- exist` and the frontend surfaces a generic toast. Hard DELETE via the
-- alternative route is also blocked by 28+ FK constraints without ON DELETE
-- actions.
--
-- Fix: add the missing column so the existing soft-delete semantics work.
-- Idempotent so it's safe to re-run across environments.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

COMMIT;
