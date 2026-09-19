-- Rollback for D-33: return to the pre-migration state where this constraint
-- was absent after the legacy boot definition failed.
-- [ODMROZENIE WSPOLNE DEC-650]
ALTER TABLE public.llm_tier_assignments
  DROP CONSTRAINT IF EXISTS llm_tier_assignments_tier_check;
