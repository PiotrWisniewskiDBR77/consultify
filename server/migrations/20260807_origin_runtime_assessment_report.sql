-- T22-DATA-PREREQ (2026-08-07) — extend origin_runtime CHECK with 'assessment_report'.
--
-- AssessmentWorkbenchService.recordPromotion() (server/src/services/assessment/
-- AssessmentWorkbenchService.ts) has always called registerArtifactOrigin with
-- originRuntime: 'assessment_report' for the P28 "promote to Outputs Library"
-- handoff. That value was never in this CHECK constraint (nor in the Zod enum
-- it mirrors, server/src/types/artifactRegistry.ts), so every assessment
-- promotion attempt failed Zod validation before reaching the database and
-- silently degraded (state.degraded = { code: 'promotion_failed' }). No
-- assessment has ever successfully produced an Outputs Library row through
-- this path.
--
-- This migration is ADDITIVE: it re-declares the same CHECK constraint with
-- 'assessment_report' and restores the already-declared 'work_canvas' runtime
-- that the previous DB CHECK accidentally omitted. Every previously allowed value is preserved
-- (precedents: 20260330_v81_templates_as_outputs_artifacts.sql,
-- 20260412_seed_business_templates.sql,
-- 20260724_origin_runtime_document_template.sql).
-- NO data is inserted, updated or deleted.
--
-- The resulting CHECK mirrors the complete TypeScript runtime contract.

ALTER TABLE v8_artifact_origin_links DROP CONSTRAINT IF EXISTS v8_artifact_origin_links_origin_runtime_check;
ALTER TABLE v8_artifact_origin_links ADD CONSTRAINT v8_artifact_origin_links_origin_runtime_check
  CHECK (
    origin_runtime IN (
      'report',
      'presentation',
      'sheet',
      'native_artifact',
      'report_template',
      'presentation_template',
      'sheet_template',
      'document_template',
      'work_canvas',
      'assessment_report'
    )
  );
