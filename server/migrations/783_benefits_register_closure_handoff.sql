-- Migration 783: M14 → M15 closure handoff — benefits register source tagging
--
-- Decision B1b (owner-approved): when an initiative closes (status → DONE), its
-- planned KPIs (initiative_kpis) are handed off into the M15-readable benefits
-- register (initiative_benefits), tagged so M15 can distinguish auto-created
-- closure benefits from manually-authored ones and so the handoff is idempotent.
--
-- `initiative_benefits` had no provenance column. We add `source_tag` and a
-- partial unique index scoped to the closure source so a repeated DONE (or a
-- DONE → revert → DONE cycle) does not create duplicate benefit rows.
--
-- Closure handoff writes source_tag = 'M14_CLOSURE_HANDOFF'.

ALTER TABLE initiative_benefits ADD COLUMN IF NOT EXISTS source_tag TEXT;

-- Dedup / idempotency guard for the closure handoff. One benefit per KPI per
-- initiative for the closure source. Partial index keeps manually-created
-- benefits (source_tag IS NULL / other) unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_initiative_benefits_closure_kpi
    ON initiative_benefits (initiative_id, kpi_id, source_tag)
    WHERE source_tag = 'M14_CLOSURE_HANDOFF' AND kpi_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_initiative_benefits_source_tag
    ON initiative_benefits (organization_id, source_tag);
