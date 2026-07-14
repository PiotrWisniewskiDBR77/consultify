-- M16/2.9 — KPI lineage: leading vs lagging indicators
-- Adds a kind discriminator and a link from a leading KPI to the lagging KPI it predicts.
-- Used by kpiLineageService.detectEarlyWarnings to surface early-warning signals
-- (leading KPI moves but its linked lagging KPI stays flat).

-- FRESH-DB GUARD (2026-07-14): initiative_kpis is created by
-- 565_kpi_time_series_roi_attribution_finance.sql, which sorts AFTER this file
-- on a fresh replay. Skip when the table does not exist yet; 565 re-adds these
-- columns idempotently (parity), so the final schema is identical.
DO $$ BEGIN
  IF to_regclass('public.initiative_kpis') IS NOT NULL THEN
    ALTER TABLE initiative_kpis
      ADD COLUMN IF NOT EXISTS kpi_kind TEXT;     -- 'leading' | 'lagging' (NULL = unclassified)

    ALTER TABLE initiative_kpis
      ADD COLUMN IF NOT EXISTS leads_kpi_id TEXT; -- link: leading KPI -> the lagging KPI it leads
  END IF;
END $$;
