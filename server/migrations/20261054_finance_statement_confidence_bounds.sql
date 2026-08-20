-- Finance Statement owner acceptance: persisted confidence is always [0,1].
-- Forward-only repair: first clamp historical drift, then make recurrence
-- impossible at the database boundary. All tables below are created by the
-- canonical Statement migrations that precede this file.

UPDATE financial_statements
SET overall_confidence = LEAST(1.0, GREATEST(0.0, COALESCE(overall_confidence, 0.0)));

UPDATE financial_statement_values
SET confidence = LEAST(1.0, GREATEST(0.0, COALESCE(confidence, 0.0))),
    mapping_confidence = LEAST(1.0, GREATEST(0.0, COALESCE(mapping_confidence, confidence, 0.0)));

UPDATE financial_statement_extracted_sections
SET confidence = LEAST(1.0, GREATEST(0.0, COALESCE(confidence, 0.0)));

UPDATE financial_statement_candidate_rows
SET confidence = LEAST(1.0, GREATEST(0.0, COALESCE(confidence, 0.0)));

UPDATE financial_statement_mapping_candidates
SET score = LEAST(1.0, GREATEST(0.0, COALESCE(score, 0.0)));

UPDATE financial_statement_value_evidence
SET weight = LEAST(1.0, GREATEST(0.0, COALESCE(weight, 0.0)));

ALTER TABLE financial_statements
  DROP CONSTRAINT IF EXISTS financial_statements_overall_confidence_bounds,
  ADD CONSTRAINT financial_statements_overall_confidence_bounds
    CHECK (overall_confidence >= 0 AND overall_confidence <= 1);

ALTER TABLE financial_statement_values
  DROP CONSTRAINT IF EXISTS financial_statement_values_confidence_bounds,
  DROP CONSTRAINT IF EXISTS financial_statement_values_mapping_confidence_bounds,
  ADD CONSTRAINT financial_statement_values_confidence_bounds
    CHECK (confidence >= 0 AND confidence <= 1),
  ADD CONSTRAINT financial_statement_values_mapping_confidence_bounds
    CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1);

ALTER TABLE financial_statement_extracted_sections
  DROP CONSTRAINT IF EXISTS financial_statement_extracted_sections_confidence_bounds,
  ADD CONSTRAINT financial_statement_extracted_sections_confidence_bounds
    CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE financial_statement_candidate_rows
  DROP CONSTRAINT IF EXISTS financial_statement_candidate_rows_confidence_bounds,
  ADD CONSTRAINT financial_statement_candidate_rows_confidence_bounds
    CHECK (confidence >= 0 AND confidence <= 1);

ALTER TABLE financial_statement_mapping_candidates
  DROP CONSTRAINT IF EXISTS financial_statement_mapping_candidates_score_bounds,
  ADD CONSTRAINT financial_statement_mapping_candidates_score_bounds
    CHECK (score >= 0 AND score <= 1);

ALTER TABLE financial_statement_value_evidence
  DROP CONSTRAINT IF EXISTS financial_statement_value_evidence_weight_bounds,
  ADD CONSTRAINT financial_statement_value_evidence_weight_bounds
    CHECK (weight >= 0 AND weight <= 1);

