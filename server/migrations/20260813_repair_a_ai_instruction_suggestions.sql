-- Forward repair A (release migration gate repair, 2026-08-13)
--
-- WHY: 520_ai_enterprise_tables.sql was applied to demo on 2026-02-27 from a version that did
-- not yet contain these two columns. The file was edited afterwards to add them. Because the
-- runner keys on filename and never re-runs an applied file, the columns never reached demo.
-- Verified read-only 2026-08-13: ai_instruction_suggestions has `instruction` and `confidence`
-- but NOT `suggested_instruction` / `confidence_score`.
--
-- We do NOT edit 520 (that would rewrite an already-applied migration's checksum). Forward-only.
-- Both column generations coexist deliberately: older consumers read instruction/confidence,
-- newer ones read suggested_instruction/confidence_score. No data is moved or dropped.

ALTER TABLE IF EXISTS ai_instruction_suggestions
  ADD COLUMN IF NOT EXISTS suggested_instruction TEXT;

ALTER TABLE IF EXISTS ai_instruction_suggestions
  ADD COLUMN IF NOT EXISTS confidence_score REAL DEFAULT 0.5;
