-- Day 313: converge fresh migrations with DatabaseInitializer runtime DDL.
ALTER TABLE IF EXISTS imported_reports
  ADD COLUMN IF NOT EXISTS coverage_percent REAL DEFAULT 0;
