-- D-33: restore the boot-time tier constraint after PLATFORM assignments made
-- the legacy definition fail open on staging.
-- [ODMROZENIE WSPOLNE DEC-650]
ALTER TABLE public.llm_tier_assignments
  DROP CONSTRAINT IF EXISTS llm_tier_assignments_tier_check;

ALTER TABLE public.llm_tier_assignments
  ADD CONSTRAINT llm_tier_assignments_tier_check
  CHECK (
    tier IN ('BUDGET', 'STANDARD', 'PREMIUM', 'REASONING', 'FREE', 'PLATFORM')
  );
