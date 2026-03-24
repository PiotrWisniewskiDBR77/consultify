-- V4-ORG-01: dataset registry + versions for benchmark backend

ALTER TABLE benchmark_datasets
  ADD COLUMN IF NOT EXISTS version_tag TEXT DEFAULT '2026-r0';

ALTER TABLE benchmark_datasets
  ADD COLUMN IF NOT EXISTS source_json TEXT DEFAULT '{}';

CREATE TABLE IF NOT EXISTS benchmark_datasets_versions (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(framework, version_tag)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_dataset_versions_framework
  ON benchmark_datasets_versions(framework, is_active);
