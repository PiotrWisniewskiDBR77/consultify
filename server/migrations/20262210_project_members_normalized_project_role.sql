-- Z-56 / DEC-511: make the strict migration chain reproduce the live
-- project_members.normalized_project_role contract.
-- Source of the historical runtime self-heal:
-- server/src/database/DatabaseInitializer.ts:777-780.
-- Live staging contract measured on 2026-09-14: text, no default, nullable.

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS normalized_project_role text;
