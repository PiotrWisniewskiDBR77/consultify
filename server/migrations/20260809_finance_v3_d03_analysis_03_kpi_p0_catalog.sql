-- Finance v3 — Gate D (WP-D03b): Historical Analysis domain schema, part 3/4 — P0 KPI catalog seed.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md section 5.3
-- (18 P0 KPI table, all 8 categories) and sections 5.4/5.5 (literal formula_ref / DSO AST examples).
-- Runs after ..._02_integrity.sql (these INSERTs exercise the compile trigger and, for
-- CASH_CONVERSION_CYCLE, a formula_ref cross-row lookup into rows this same file creates first) and
-- before ..._04_readiness.sql.
--
-- Per CLAUDE.md doctrine ("dane demo = twarz produktu... zero rekordów testowych" / data belongs in
-- the database, not hardcoded in application code): these 18 canonical UNIVERSAL-tier KPI
-- definitions are seed DATA in finance_analysis_kpi_catalog, not a TypeScript constant the app code
-- would otherwise own.
--
-- All 18 rows: tier='UNIVERSAL' (industry_code/organization_id both NULL, per
-- chk_finance_analysis_kpi_catalog_tier_dims), status='ACTIVE' directly (canonical, product-team
-- content under code review — ADR section 4.2, not ad-hoc analyst-authored, so the ORG_CUSTOM
-- maker-checker gate does not apply and approved_by is left NULL). catalog_version=1 for all.
--
-- Ordering matters for #13 (CASH_CONVERSION_CYCLE): it references DSO/DIO/DPO via formula_ref, and
-- the compile trigger's formula_ref branch requires the referenced kpi_code to already exist as an
-- ACTIVE/COMPILED_OK row (finance_analysis_kpi_resolve_unit, file 02) — so it is inserted LAST,
-- after all 17 other rows including its 3 dependencies (#10/#11/#12) are already committed to this
-- same transaction (a row inserted earlier in the same multi-statement transaction is visible to a
-- later SELECT in that transaction — ordinary MVCC read-your-own-writes, not a special case).

BEGIN;

-- 1. CURRENT_RATIO — Liquidity — CURRENT_ASSETS / CURRENT_LIABILITIES
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'CURRENT_RATIO', 1, 'ACTIVE', 'UNIVERSAL', 'LIQUIDITY', 'Current Ratio',
  'Current assets over current liabilities — short-term solvency.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CURRENT_ASSETS","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CURRENT_LIABILITIES","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'POINT_IN_TIME', 'SHOW_WITH_FLAG', ARRAY['CURRENT_ASSETS','CURRENT_LIABILITIES'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 2. QUICK_RATIO — Liquidity — (CURRENT_ASSETS - INVENTORY) / CURRENT_LIABILITIES
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'QUICK_RATIO', 1, 'ACTIVE', 'UNIVERSAL', 'LIQUIDITY', 'Quick Ratio (Acid-Test)',
  'Current assets less inventory over current liabilities.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operator","op":"subtract",
      "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CURRENT_ASSETS","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
      "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"INVENTORY","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CURRENT_LIABILITIES","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'POINT_IN_TIME', 'SHOW_WITH_FLAG', ARRAY['CURRENT_ASSETS','INVENTORY','CURRENT_LIABILITIES'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 3. CASH_RATIO — Liquidity — CASH / CURRENT_LIABILITIES
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'CASH_RATIO', 1, 'ACTIVE', 'UNIVERSAL', 'LIQUIDITY', 'Cash Ratio',
  'Cash and equivalents over current liabilities — most conservative liquidity measure.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CASH","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CURRENT_LIABILITIES","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'POINT_IN_TIME', 'SHOW_WITH_FLAG', ARRAY['CASH','CURRENT_LIABILITIES'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 4. GROSS_MARGIN_PCT — Profitability — GROSS_MARGIN / REVENUE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'GROSS_MARGIN_PCT', 1, 'ACTIVE', 'UNIVERSAL', 'PROFITABILITY', 'Gross Margin %',
  'Gross margin over revenue.', 'PERCENT',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"GROSS_MARGIN","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'FORCE_NA', ARRAY['GROSS_MARGIN','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 5. EBITDA_MARGIN_PCT — Profitability — EBITDA / REVENUE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'EBITDA_MARGIN_PCT', 1, 'ACTIVE', 'UNIVERSAL', 'PROFITABILITY', 'EBITDA Margin %',
  'EBITDA over revenue.', 'PERCENT',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"EBITDA","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'FORCE_NA', ARRAY['EBITDA','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 6. NET_MARGIN_PCT — Profitability — NET_INCOME / REVENUE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'NET_MARGIN_PCT', 1, 'ACTIVE', 'UNIVERSAL', 'PROFITABILITY', 'Net Margin %',
  'Net income over revenue.', 'PERCENT',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"NET_INCOME","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'FORCE_NA', ARRAY['NET_INCOME','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 7. DEBT_TO_EQUITY — Leverage — LONG_TERM_DEBT / EQUITY
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'DEBT_TO_EQUITY', 1, 'ACTIVE', 'UNIVERSAL', 'LEVERAGE', 'Debt to Equity',
  'Long-term debt over equity. Negative equity is a legal, if distressed, state — shown with flag, not hidden.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"LONG_TERM_DEBT","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"EQUITY","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'POINT_IN_TIME', 'SHOW_WITH_FLAG', ARRAY['LONG_TERM_DEBT','EQUITY'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 8. DEBT_TO_EBITDA — Leverage — LONG_TERM_DEBT / EBITDA[LTM_SUM_4Q]
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'DEBT_TO_EBITDA', 1, 'ACTIVE', 'UNIVERSAL', 'LEVERAGE', 'Debt to EBITDA (LTM)',
  'Long-term debt over trailing-twelve-month EBITDA — common covenant metric.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"LONG_TERM_DEBT","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"EBITDA","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"LTM_SUM_4Q"}}}'::jsonb,
  'LTM', 'SHOW_WITH_FLAG', ARRAY['LONG_TERM_DEBT','EBITDA'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 9. INTEREST_COVERAGE — Coverage — EBIT / INTEREST_EXPENSE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'INTEREST_COVERAGE', 1, 'ACTIVE', 'UNIVERSAL', 'COVERAGE', 'Interest Coverage',
  'EBIT over interest expense — ability to service debt from operating earnings.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"EBIT","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"INTEREST_EXPENSE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'SHOW_WITH_FLAG', ARRAY['EBIT','INTEREST_EXPENSE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 10. DSO — Efficiency — AR[AVERAGE_CURRENT_AND_PRIOR] / (REVENUE / DAYS_IN_PERIOD) — literal AST
-- from ADR section 5.5.
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'DSO', 1, 'ACTIVE', 'UNIVERSAL', 'EFFICIENCY', 'Days Sales Outstanding',
  'Average accounts receivable divided by revenue-per-day.', 'DAYS',
  '{"node":"operator","op":"divide",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"AR","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"AVERAGE_CURRENT_AND_PRIOR"}},
    "right":{"node":"operator","op":"divide",
      "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
      "right":{"node":"operand","kind":"literal","valueRef":"DAYS_IN_PERIOD"}}}'::jsonb,
  'AVERAGE_BALANCE', 'FORCE_NA', ARRAY['AR','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 11. DIO — Efficiency — INVENTORY[AVERAGE_CURRENT_AND_PRIOR] / (COGS / DAYS_IN_PERIOD)
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'DIO', 1, 'ACTIVE', 'UNIVERSAL', 'EFFICIENCY', 'Days Inventory Outstanding',
  'Average inventory divided by COGS-per-day.', 'DAYS',
  '{"node":"operator","op":"divide",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"INVENTORY","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"AVERAGE_CURRENT_AND_PRIOR"}},
    "right":{"node":"operator","op":"divide",
      "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"COGS","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
      "right":{"node":"operand","kind":"literal","valueRef":"DAYS_IN_PERIOD"}}}'::jsonb,
  'AVERAGE_BALANCE', 'FORCE_NA', ARRAY['INVENTORY','COGS'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 12. DPO — Efficiency — AP[AVERAGE_CURRENT_AND_PRIOR] / (COGS / DAYS_IN_PERIOD)
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'DPO', 1, 'ACTIVE', 'UNIVERSAL', 'EFFICIENCY', 'Days Payable Outstanding',
  'Average accounts payable divided by COGS-per-day.', 'DAYS',
  '{"node":"operator","op":"divide",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"AP","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"AVERAGE_CURRENT_AND_PRIOR"}},
    "right":{"node":"operator","op":"divide",
      "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"COGS","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
      "right":{"node":"operand","kind":"literal","valueRef":"DAYS_IN_PERIOD"}}}'::jsonb,
  'AVERAGE_BALANCE', 'FORCE_NA', ARRAY['AP','COGS'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 14. OPERATING_CASH_FLOW_MARGIN — Cash flow — CFO / REVENUE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'OPERATING_CASH_FLOW_MARGIN', 1, 'ACTIVE', 'UNIVERSAL', 'CASH_FLOW', 'Operating Cash Flow Margin',
  'Cash flow from operations over revenue.', 'PERCENT',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"CFO","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'FORCE_NA', ARRAY['CFO','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 15. FCF_MARGIN — Cash flow — FCF / REVENUE
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'FCF_MARGIN', 1, 'ACTIVE', 'UNIVERSAL', 'CASH_FLOW', 'Free Cash Flow Margin',
  'Free cash flow over revenue.', 'PERCENT',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"FCF","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}}}'::jsonb,
  'FLOW_PERIOD', 'FORCE_NA', ARRAY['FCF','REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 16. REVENUE_GROWTH_YOY — Growth — (REVENUE[CURRENT] - REVENUE[PRIOR_YEAR_SAME_PERIOD]) / REVENUE[PRIOR_YEAR_SAME_PERIOD]
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'REVENUE_GROWTH_YOY', 1, 'ACTIVE', 'UNIVERSAL', 'GROWTH', 'Revenue Growth YoY',
  'Year-over-year revenue growth — compares two flow periods, not averaged.', 'PERCENT',
  '{"node":"operator","op":"divide",
    "left":{"node":"operator","op":"subtract",
      "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
      "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"PRIOR_YEAR_SAME_PERIOD"}}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"REVENUE","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"PRIOR_YEAR_SAME_PERIOD"}}}'::jsonb,
  'POINT_IN_TIME', 'FORCE_NA', ARRAY['REVENUE'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 17. ROE — Returns — NET_INCOME / EQUITY[AVERAGE_CURRENT_AND_PRIOR]
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'ROE', 1, 'ACTIVE', 'UNIVERSAL', 'RETURNS', 'Return on Equity',
  'Net income over average equity. Negative ROE with negative equity is the canonical trap — shown with flag, never hidden.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"NET_INCOME","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"EQUITY","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"AVERAGE_CURRENT_AND_PRIOR"}}}'::jsonb,
  'AVERAGE_BALANCE', 'SHOW_WITH_FLAG', ARRAY['NET_INCOME','EQUITY'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 18. ROA — Returns — NET_INCOME / TOTAL_ASSETS[AVERAGE_CURRENT_AND_PRIOR]
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'ROA', 1, 'ACTIVE', 'UNIVERSAL', 'RETURNS', 'Return on Assets',
  'Net income over average total assets.', 'RATIO',
  '{"node":"operator","op":"ratio",
    "left":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"NET_INCOME","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"CURRENT"}},
    "right":{"node":"operand","kind":"cell_ref","cellRef":{"canonicalLineCode":"TOTAL_ASSETS","consolidationScope":"CONSOLIDATED","entityScope":"ANALYSIS_DEFAULT","periodOffset":"AVERAGE_CURRENT_AND_PRIOR"}}}'::jsonb,
  'AVERAGE_BALANCE', 'SHOW_WITH_FLAG', ARRAY['NET_INCOME','TOTAL_ASSETS'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

-- 13. CASH_CONVERSION_CYCLE — Efficiency — DSO + DIO - DPO, via formula_ref (literal AST from ADR
-- section 5.4). Inserted LAST: requires #10/#11/#12 above to already be ACTIVE/COMPILED_OK rows —
-- see file header note on ordering.
INSERT INTO finance_analysis_kpi_catalog
  (kpi_code, catalog_version, status, tier, category, kpi_name, description, unit_type,
   formula_ast, period_convention, negative_denominator_policy, required_canonical_line_codes, created_by)
VALUES (
  'CASH_CONVERSION_CYCLE', 1, 'ACTIVE', 'UNIVERSAL', 'EFFICIENCY', 'Cash Conversion Cycle',
  'DSO + DIO - DPO, composed from the three underlying KPI catalog entries via formula_ref (DRY at the AST level, ADR section 5.4).', 'DAYS',
  '{"node":"operator","op":"subtract",
    "left":{"node":"operator","op":"add",
      "left":{"node":"operand","kind":"formula_ref","kpiCode":"DSO"},
      "right":{"node":"operand","kind":"formula_ref","kpiCode":"DIO"}},
    "right":{"node":"operand","kind":"formula_ref","kpiCode":"DPO"}}'::jsonb,
  'AVERAGE_BALANCE', NULL, ARRAY['AR','REVENUE','INVENTORY','COGS','AP'], 'system:finance_v3_seed'
)
ON CONFLICT (kpi_code) WHERE status = 'ACTIVE' DO NOTHING;

COMMIT;
