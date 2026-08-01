-- Durable export history required by Report Builder PDF/DOCX/PPTX exports.

CREATE TABLE IF NOT EXISTS report_exports (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  exported_by TEXT NOT NULL,
  exported_at TIMESTAMP NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_download_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_exports_report
  ON report_exports(report_id, exported_at);
