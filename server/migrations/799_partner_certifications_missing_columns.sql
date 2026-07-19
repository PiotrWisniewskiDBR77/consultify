-- =============================================================================
-- Migration: 799_partner_certifications_missing_columns.sql
-- Class: RED "migracja-braku" (rejestr _REJESTR_DOKONCZENIA.md linia 74)
-- Description: server/src/services/partnerCertificationService.ts reads/
-- writes certification_track, certification_level, review_state,
-- recertification_policy, tier_target, exam_mode, public_article_slug,
-- partner_lifecycle_step, attempt_count, last_attempt_at, passed_exam_at,
-- valid_until, review_notes on `partner_certifications`; none exist on
-- parity today. Purely additive, idempotent.
--
-- SCOPE NOTE: this migration only patches the `partner_certifications`
-- table named in the rejestr brief. The same service also references several
-- sibling tables that do not exist at all on parity — `partner_certificates`,
-- `partner_certification_attempts`, `partner_exam_questions`,
-- `partner_learning_modules`, `partner_learning_progress` — i.e. a whole
-- exam/learning-path subsystem, not a handful of missing columns. That is a
-- much larger build-out than "migracja-braku" and is intentionally left out
-- of this addytywna migration; see worker report for details.
-- =============================================================================

ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS certification_track TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS certification_level TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS review_state TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS recertification_policy TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS tier_target TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS exam_mode TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS public_article_slug TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS partner_lifecycle_step TEXT;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS passed_exam_at TIMESTAMPTZ;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE partner_certifications ADD COLUMN IF NOT EXISTS review_notes TEXT;
