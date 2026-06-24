-- M16/2.9 — KPI lineage: leading vs lagging indicators
-- Adds a kind discriminator and a link from a leading KPI to the lagging KPI it predicts.
-- Used by kpiLineageService.detectEarlyWarnings to surface early-warning signals
-- (leading KPI moves but its linked lagging KPI stays flat).

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS kpi_kind TEXT;     -- 'leading' | 'lagging' (NULL = unclassified)

ALTER TABLE initiative_kpis
  ADD COLUMN IF NOT EXISTS leads_kpi_id TEXT; -- link: leading KPI -> the lagging KPI it leads
