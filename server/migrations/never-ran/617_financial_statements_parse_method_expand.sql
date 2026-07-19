-- Migration 617: expand financial_statements.parse_method values
-- Allows storing richer ingestion provenance (CSV/XLSX imports) while keeping backward compatibility.

DO $$
BEGIN
  -- Old constraint name is the default Postgres CHECK naming convention.
  ALTER TABLE financial_statements
    DROP CONSTRAINT IF EXISTS financial_statements_parse_method_check;

  ALTER TABLE financial_statements
    ADD CONSTRAINT financial_statements_parse_method_check
    CHECK (parse_method IN ('text_extraction', 'ocr', 'manual', 'excel_import', 'csv_import'));
EXCEPTION
  WHEN undefined_table THEN
    -- Table not present in this environment.
    NULL;
END $$;

