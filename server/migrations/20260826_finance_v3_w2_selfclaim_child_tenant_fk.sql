-- =============================================================================
-- Finance v3 — W2 self-claim work package, structural fix: composite
-- (parent, organization_id) FKs on two CHILD tables the W9-C-7 migration
-- (20260825_finance_v3_w9c7_valuation_child_tenant_fk.sql) did not cover,
-- found by the same independent verifier while re-checking the NEW-3
-- self-claim tenant-mutation fix.
--
-- Source: docs/validation/finance-v3/generated/gate-d/
-- W2_SELF_CLAIM_TENANT_FIX_report.md (NEW-2/NEW-3 companion migration).
--
-- ADDITIVE ONLY. No DROP/RENAME/ALTER ... TYPE on any existing column. Same
-- idiom as W9-C-7: ADD a UNIQUE(id, organization_id) on each PARENT (where
-- it doesn't already exist) and a composite FK on each CHILD referencing
-- that pair.
--
-- SCOPE — exactly the two tables identified as the same structural class as
-- W9-C-7's six (an `organization_id` column present, but the existing FK to
-- the row's real parent is single-column, so nothing stops a service bug
-- from inserting organization_id=A with a parent id that actually belongs to
-- organization B):
--
--   1. finance_comment_assignments.comment_id -> finance_comments.id
--      Today: `finance_comment_assignments_comment_id_fkey FOREIGN KEY
--      (comment_id) REFERENCES finance_comments(id)` — no org half. Guarded
--      today ONLY by commentService.ts's `assignComment()`, which SELECTs
--      `finance_comments WHERE id = ? AND organization_id = ?` before the
--      INSERT (server/src/services/finance/canonical/commentService.ts) —
--      pure application code, no DB backstop.
--
--   2. finance_post_investment_reviews.initiative_id -> initiatives.id
--      Today: `finance_post_investment_reviews_initiative_id_fkey FOREIGN
--      KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE` —
--      no org half. Guarded today ONLY by the route handler
--      (server/src/routes/v8/finance-value.routes.ts, POST
--      /post-investment-reviews), which SELECTs `initiatives WHERE id = ?
--      AND organization_id = ?` before calling
--      postInvestmentReviewService.createPostInvestmentReview() — again pure
--      application code, no DB backstop. (`baseline_model_id ->
--      financial_models(id)` on the same table has the identical
--      single-column-FK shape and is ALSO only service-checked
--      (resolveApprovedBaselineLine), but is explicitly OUT OF SCOPE here:
--      `financial_models` is a pre-Finance-v3-canonical, cross-module table
--      (M04 Consulting Tools era) this work package does not own; closing it
--      is a separate decision for whoever owns that table's migration
--      history, not folded into this fix silently.)
--
-- NOT included (checked, no live vector — see the report for the grep
-- evidence): finance_legal_holds, finance_retention_policies (zero
-- production callers in server/src at all — nothing to leak through yet),
-- finance_candidate_handoffs (every read AND write already includes
-- organization_id directly in its own WHERE/INSERT, and it has no
-- single-column FK to a parent id to begin with — not the same structural
-- shape as the two tables above).
--
-- SAFE ON EXISTING DATA: `ADD CONSTRAINT ... FOREIGN KEY` validates against
-- every existing row in the same transaction; a populated database with a
-- pre-existing mismatched (parent_id, organization_id) pair rolls the whole
-- migration back with 23503 rather than silently half-applying. On a fresh
-- schema (this work package's own ephemeral cluster) there is no existing
-- data, so this is a no-op concern here.
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. finance_comments — parent for finance_comment_assignments. `id` is
--    already the PRIMARY KEY (globally unique); UNIQUE(id, organization_id)
--    exists purely so a composite FK can reference the pair (same as
--    uq_finance_valuation_methods_id_org in W9-C-7).
-- ============================================================================
ALTER TABLE finance_comments
  ADD CONSTRAINT uq_finance_comments_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_comment_assignments
  ADD CONSTRAINT fk_finance_comment_assignments_comment_org
  FOREIGN KEY (comment_id, organization_id)
  REFERENCES finance_comments (id, organization_id);

-- ============================================================================
-- 2. initiatives — parent for finance_post_investment_reviews. `id` is
--    already the PRIMARY KEY; UNIQUE(id, organization_id) added for the same
--    composite-FK-target reason as above. `initiatives` is a wide,
--    cross-module table (not Finance-v3-canonical) but already carries a
--    plain single-column organization_id FK to organizations(id) and a NOT
--    NULL organization_id column, so this is a safe, narrowly-scoped
--    addition — it does not touch any existing column or constraint.
-- ============================================================================
ALTER TABLE initiatives
  ADD CONSTRAINT uq_initiatives_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_post_investment_reviews
  ADD CONSTRAINT fk_finance_post_investment_reviews_initiative_org
  FOREIGN KEY (initiative_id, organization_id)
  REFERENCES initiatives (id, organization_id);

COMMIT;
