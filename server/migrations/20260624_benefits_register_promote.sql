-- M15/W1 (1.1 G1 bridge): allow a benefits_register row (M14 handoff inbox) to be
-- promoted into a tracked KPI (initiative_kpis, the M15 canonical engine). The link
-- back lets the inbox show "already tracked" and avoids double-promotion.
ALTER TABLE benefits_register ADD COLUMN IF NOT EXISTS promoted_kpi_id TEXT;
