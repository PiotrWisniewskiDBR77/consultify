-- Idea FINANCIAL-case schema — Program E / epic E09, stream S6-E09 (RISK-12).
-- SSOT: docs/qa/ideas-complete-transformation-2026-08-09/10_FINANCIAL_CASE_ACCEPTANCE.md §5.7
--       (the scoped gap this migration closes) + §5.3 (why this MUST be its own
--       table rather than a 15th `IdeaBusinessCaseSections` key).
--
-- WHY A SEPARATE TABLE (do not "simplify" this into idea_business_cases):
--   `IdeaBusinessCaseSections` has 14 FIXED, prose-shaped section keys
--   (problemBaseline … decisionRequested). `FinancialCaseInput` is a driver
--   model: monthly time series keyed 'YYYY-MM', per-scenario multipliers,
--   confidence, evidence refs. The two shapes are structurally incompatible —
--   see §5.3 of the acceptance doc for the full argument.
--
-- Purely ADDITIVE and IDEMPOTENT: one new table, one FK to the existing
-- `my_ideas` table, two indexes. No ALTER/DROP/type change on anything that
-- exists today. Safe to run repeatedly (CREATE ... IF NOT EXISTS throughout).
--
-- `case_json` holds ONE envelope object, `IdeaFinancialCasePayload`
-- (server/src/services/ideaFinancialCaseService.ts, mirrored by
-- src/services/api/ideaFinancialCase.api.ts):
--   { input:  FinancialCaseInput          -- caseMeta (currency, discountRatePct,
--                                            startPeriod, horizonMonths, scenarios)
--                                            + drivers[]
--     result: FinancialCaseResult | null  -- LAST computed snapshot, or null when
--                                            the case was saved while stale/empty
--     lastComputedAt: string | null }
-- Same "one JSON blob per artifact" pattern as `my_idea_maps.nodes_json` and
-- `idea_business_cases.sections_json`. TEXT (not JSONB) deliberately, to match
-- those siblings and the `?`-placeholder Database abstraction.
--
-- `version` is OPTIMISTIC CONCURRENCY CONTROL, not a history counter: PUT
-- carries the version the client loaded, the server refuses (409) when it no
-- longer matches. Same contract as PUT /my-work/my-ideas/:id/map's
-- `baseVersion`.
--
-- UNIQUE(idea_id): one financial case per Idea. Confirmed against the current
-- model before enforcing — `IdeaTableTool.tsx` mounts exactly ONE
-- `<FinancialCaseDialog>` per Idea Table tool instance (not per row), and its
-- own B4 comment states "One Financial Case per Idea Table tool instance ...
-- there is exactly one financial case to be stale/fresh about". The E08
-- business case enforces the same one-per-idea rule the same way.

CREATE TABLE IF NOT EXISTS idea_financial_cases (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  case_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

-- One financial case per idea (see header for the model confirmation).
CREATE UNIQUE INDEX IF NOT EXISTS ux_idea_financial_cases_idea_id
  ON idea_financial_cases(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_financial_cases_org_id
  ON idea_financial_cases(organization_id);
