-- Finance Statement owner acceptance: every new confidence value is [0,1].
-- Existing rows are preserved byte-for-byte. NOT VALID constraints are still
-- enforced for new writes in PostgreSQL, while historical drift can be
-- inspected and repaired through an explicit governed data operation before a
-- later VALIDATE CONSTRAINT migration.

ALTER TABLE financial_statements
  ADD CONSTRAINT financial_statements_overall_confidence_bounds_v2
    CHECK (overall_confidence >= 0 AND overall_confidence <= 1) NOT VALID;

ALTER TABLE financial_statement_values
  ADD CONSTRAINT financial_statement_values_confidence_bounds_v2
    CHECK (confidence >= 0 AND confidence <= 1) NOT VALID,
  ADD CONSTRAINT financial_statement_values_mapping_confidence_bounds_v2
    CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1) NOT VALID;

ALTER TABLE financial_statement_extracted_sections
  ADD CONSTRAINT financial_statement_extracted_sections_confidence_bounds_v2
    CHECK (confidence >= 0 AND confidence <= 1) NOT VALID;

ALTER TABLE financial_statement_candidate_rows
  ADD CONSTRAINT financial_statement_candidate_rows_confidence_bounds_v2
    CHECK (confidence >= 0 AND confidence <= 1) NOT VALID;

ALTER TABLE financial_statement_mapping_candidates
  ADD CONSTRAINT financial_statement_mapping_candidates_score_bounds_v2
    CHECK (score >= 0 AND score <= 1) NOT VALID;

ALTER TABLE financial_statement_value_evidence
  ADD CONSTRAINT financial_statement_value_evidence_weight_bounds_v2
    CHECK (weight >= 0 AND weight <= 1) NOT VALID;
