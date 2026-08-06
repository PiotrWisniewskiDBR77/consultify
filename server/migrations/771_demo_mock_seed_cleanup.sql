-- 771_demo_mock_seed_cleanup.sql
--
-- Cleanup migration for X2 Demo-Data Gate (owner decision D19/D22).
--
-- Pre-existing mock-seed migrations (223, 228, 235, 237, 425, 426, 501, 513)
-- injected fake billing / partner / revenue / security / interview / report
-- fixture rows directly into real org tables. Demo data now lives exclusively
-- in the canonical Atelier Toys seed (npm run db:seed:atelier) and is only ever
-- surfaced via the explicit user demo toggle.
--
-- This migration DELETES those pre-existing mock rows. Each DELETE is scoped to
-- the distinctive demo/mock identifiers (or the hardcoded demo org ids) used by
-- the original seed migrations, so real customer data is never touched.
--
-- ⚠️ DO NOT auto-run as part of the normal migration runner without review.
--    This file is intended to be applied MANUALLY by an operator against a
--    target database after confirming the scoped predicates match only mock
--    rows in that environment. The original seed migration files are NOT
--    modified by this batch.

-- ── 223_billing_mock_seed.sql ───────────────────────────────────────────────
DO $$
BEGIN
DELETE FROM invoices WHERE id IN ('inv-mock-001', 'INV-MOCK-001');
DELETE FROM payment_methods WHERE id IN ('pm-mock-mc', 'pm-mock-visa', 'pm_mc_mock', 'pm_visa_mock');
DELETE FROM usage_records WHERE id IN ('usage-mock-storage', 'usage-mock-tokens');
DELETE FROM subscriptions WHERE id IN ('sub-mock-001');
DELETE FROM subscription_plans WHERE id IN ('plan-mock-basic', 'plan-mock-pro');
DELETE FROM billing_tax_settings WHERE id IN ('tax-mock');
DELETE FROM billing_alerts WHERE id::text LIKE 'alert-mock%';
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;

-- ── 228_partner_referral_mock_seed.sql ──────────────────────────────────────
DO $$
BEGIN
DELETE FROM partner_commission_transactions WHERE id::text LIKE 'comm-mock%' OR referral_code_used = 'PARTNER-DEMO';
DELETE FROM partner_attributions WHERE id::text LIKE 'attr-mock%' OR referral_code_used = 'PARTNER-DEMO';
DELETE FROM partner_referral_clicks WHERE id::text LIKE 'click-mock%' OR referral_code = 'PARTNER-DEMO';
DELETE FROM partner_campaign_links WHERE id::text LIKE 'camp-mock%' OR slug IN ('demo-linkedin', 'demo-webinar');
DELETE FROM partner_payouts WHERE id::text LIKE 'payout-mock%';
DELETE FROM partner_payout_accounts WHERE id::text LIKE 'payout-acc-mock%';
DELETE FROM partner_organizations WHERE id::text LIKE 'partner-mock%';
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;

-- ── 235_revenue_module_seed.sql ─────────────────────────────────────────────
DO $$
BEGIN
DELETE FROM payment_failures WHERE id::text LIKE 'pf-demo-%';
DELETE FROM mrr_snapshots WHERE id::text LIKE 'mrr-20%';
DELETE FROM revenue_recognition WHERE id::text LIKE 'rr-demo-%';
DELETE FROM revenue_forecasts WHERE id::text LIKE 'rf-demo-%';
DELETE FROM subscription_changes WHERE id::text LIKE 'sc-demo-%';
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;

-- ── 237_security_demo_seed.sql ──────────────────────────────────────────────
DO $$
BEGIN
DELETE FROM security_incidents WHERE id::text LIKE 'se-demo-%' OR id::text LIKE 'si-demo-%';
DELETE FROM scim_tokens WHERE id IN ('scim-demo-001')
   OR token = 'scim_demo_token_for_testing_only_do_not_use_in_prod';
DELETE FROM sso_configs WHERE id IN ('sso-demo-001');
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;

-- ── 425/426/501 interview demo data (hardcoded org-dbr77-test) ──────────────
DO $$
BEGIN
DELETE FROM interview_evidence WHERE session_id IN (
  SELECT id FROM interview_sessions WHERE organization_id = 'org-dbr77-test'
);
DELETE FROM interview_notes WHERE session_id IN (
  SELECT id FROM interview_sessions WHERE organization_id = 'org-dbr77-test'
);
DELETE FROM interview_questions WHERE session_id IN (
  SELECT id FROM interview_sessions WHERE organization_id = 'org-dbr77-test'
);
DELETE FROM interview_insights WHERE organization_id = 'org-dbr77-test';
DELETE FROM interview_assignments WHERE organization_id = 'org-dbr77-test';
DELETE FROM interview_sessions WHERE organization_id = 'org-dbr77-test';
DELETE FROM interview_templates WHERE organization_id = 'org-dbr77-test'
   OR id IN (
     'tpl-change-readiness', 'tpl-customer-journey', 'tpl-data-governance',
     'tpl-digital-maturity', 'tpl-lean-assessment', 'tpl-process-efficiency'
   );
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;

-- ── 513_org_report_templates_demo.sql (hardcoded org-dbr77-system) ──────────
DO $$
BEGIN
DELETE FROM report_builder_templates WHERE organization_id = 'org-dbr77-system'
   OR id IN (
     'tpl-org-innovation-quick', 'tpl-org-quarterly-review', 'tpl-org-stakeholder-brief'
   );
EXCEPTION WHEN undefined_table OR undefined_column OR datatype_mismatch
  OR undefined_function OR invalid_text_representation THEN NULL;
END $$;
