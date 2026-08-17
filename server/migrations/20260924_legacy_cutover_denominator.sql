-- CLAUDE-NEXT-LEGACY-CUTOVER / T12 — the denominator.
--
-- Every retirement argument so far has been able to state a numerator ("this
-- writer is disabled", "these tests pass") without a denominator ("out of how
-- many records that still need it"). Without the denominator, disabling a
-- writer silently strands whatever fraction of records has no canonical
-- counterpart yet, and nothing in the system can say how large that fraction is.
--
-- This view makes that fraction queryable per tenant and per legacy table. It
-- is READ-ONLY: it creates no data, migrates nothing, and is safe to run
-- against any environment.
--
-- `not_migrated` is the number that gates the next tranche. A writer may only
-- be proposed for retirement when its table's `not_migrated` is zero for the
-- tenants in scope, or when the 409 identity-unmapped path is explicitly
-- accepted for the remainder.

CREATE OR REPLACE VIEW legacy_cutover_identity_denominator AS
WITH legacy_rows AS (
    SELECT 'finance'::text AS domain, 'financial_models'::text AS legacy_table,
           organization_id::text AS organization_id, id::text AS legacy_id
      FROM financial_models
    UNION ALL
    SELECT 'finance', 'financial_analyses',
           organization_id::text, id::text
      FROM financial_analyses
    UNION ALL
    SELECT 'finance', 'financial_statement_packs',
           organization_id::text, id::text
      FROM financial_statement_packs
    UNION ALL
    SELECT 'finance', 'valuations',
           organization_id::text, id::text
      FROM valuations
),
classified AS (
    SELECT
        legacy_rows.domain,
        legacy_rows.legacy_table,
        legacy_rows.organization_id,
        CASE
            WHEN alias.artifact_id IS NULL THEN 'not_migrated'
            WHEN alias.mapping_confidence IN ('QUARANTINE', 'EXCLUDE_WITH_REASON') THEN 'quarantined'
            ELSE 'resolved'
        END AS identity_status
      FROM legacy_rows
      LEFT JOIN LATERAL (
          SELECT artifact_id, mapping_confidence
            FROM finance_artifact_aliases a
           WHERE a.organization_id = legacy_rows.organization_id
             AND a.legacy_table = legacy_rows.legacy_table
             AND a.legacy_id = legacy_rows.legacy_id
           ORDER BY a.created_at DESC
           LIMIT 1
      ) alias ON TRUE
)
SELECT
    domain,
    legacy_table,
    organization_id,
    count(*)::bigint AS total_rows,
    count(*) FILTER (WHERE identity_status = 'resolved')::bigint AS resolved_rows,
    count(*) FILTER (WHERE identity_status = 'quarantined')::bigint AS quarantined_rows,
    count(*) FILTER (WHERE identity_status = 'not_migrated')::bigint AS not_migrated_rows,
    CASE
        WHEN count(*) = 0 THEN NULL
        ELSE round(
            100.0 * count(*) FILTER (WHERE identity_status = 'resolved') / count(*), 2)
    END AS resolved_pct
  FROM classified
 GROUP BY domain, legacy_table, organization_id;

COMMENT ON VIEW legacy_cutover_identity_denominator IS
  'CLAUDE-NEXT-LEGACY-CUTOVER T12: per-tenant count of legacy records with and without a canonical identity. not_migrated_rows must be zero (or its 409 path explicitly accepted) before the matching writer may be retired.';
