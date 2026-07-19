-- V4-RSLT-03: Deviation case linkage to initiatives and tasks
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS linked_initiative_id TEXT;
ALTER TABLE kpi_deviation_cases ADD COLUMN IF NOT EXISTS linked_task_id TEXT;

CREATE INDEX IF NOT EXISTS idx_kpi_deviation_cases_linked_initiative
  ON kpi_deviation_cases(linked_initiative_id)
  WHERE linked_initiative_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_deviation_cases_linked_task
  ON kpi_deviation_cases(linked_task_id)
  WHERE linked_task_id IS NOT NULL;
