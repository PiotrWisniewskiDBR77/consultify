-- Ported from: 20260411_v8_p03e_forecast_columns.sql
-- P03-E: Add forecast columns to initiatives table
-- Separates baseline (planned_*) from forecast (forecast_*) so replan/smooth
-- never overwrite the committed baseline dates.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS forecast_start_date TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS forecast_end_date TEXT;

-- Backfill: copy current planned dates as initial forecast where not already set
UPDATE initiatives
SET forecast_start_date = planned_start_date
WHERE forecast_start_date IS NULL AND planned_start_date IS NOT NULL;

UPDATE initiatives
SET forecast_end_date = planned_end_date
WHERE forecast_end_date IS NULL AND planned_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_forecast_end
  ON initiatives(organization_id, forecast_end_date)
  WHERE forecast_end_date IS NOT NULL;
