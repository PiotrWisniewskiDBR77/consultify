-- CLAUDE-NEXT-LEGACY-CUTOVER / T13 — durable tenant-scoped cutover telemetry kernel.
--
-- WHY A NEW TABLE INSTEAD OF EXTENDING THE TWO EXISTING ONES:
-- `finance_legacy_usage_events` (20260907) and `partner_legacy_usage_events`
-- (20260906) are per-domain and disagree with each other. The partner table has
-- no tenant column at all and no idempotency constraint, so partner telemetry
-- cannot answer "which tenant still uses this writer" — the single question the
-- whole cutover depends on. Rather than teach every future domain a different
-- shape, this migration introduces ONE observation table that every domain guard
-- writes through, and BACKFILLS the two existing tables into it so no historical
-- observation is lost.
--
-- NON-DESTRUCTIVE: the two legacy telemetry tables are left in place and are not
-- dropped, truncated or altered. They become frozen history; new observations go
-- to the kernel table.

CREATE TABLE IF NOT EXISTS legacy_cutover_usage_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- Which cutover lane observed this call.
    domain TEXT NOT NULL,
    -- Stable inventory identifier (e.g. FIN-W01). NULL for traffic that matched
    -- no inventoried writer rule — that is itself a finding, not a default.
    writer_id TEXT,

    -- Where the row came from. Runtime rows are deduplicated per request
    -- identity; imported history is preserved exactly as recorded, including
    -- pre-idempotency duplicates, so a backfill can never silently delete
    -- evidence.
    source TEXT NOT NULL DEFAULT 'runtime' CHECK (source IN ('runtime', 'import')),

    -- Tenant. Deliberately nullable + an explicit resolution flag: attributing an
    -- observation to the wrong tenant is worse than admitting we could not
    -- resolve one. Queries that drive retirement decisions must filter on
    -- tenant_resolution = 'resolved'.
    organization_id TEXT,
    tenant_resolution TEXT NOT NULL CHECK (tenant_resolution IN ('resolved', 'unresolved')),

    request_id TEXT,
    user_id TEXT,
    method TEXT NOT NULL,
    route_path TEXT NOT NULL,

    access_kind TEXT NOT NULL CHECK (access_kind IN (
      'legacy_read',
      'legacy_uncovered_writer',
      'legacy_writer_blocked',
      'legacy_identity_unmapped',
      'rollback_writer'
    )),

    successor_path TEXT,
    legacy_table TEXT,
    legacy_id TEXT,

    -- The four-level canonical identity chain (T11). All TEXT because the
    -- canonical Finance identities are TEXT (see 20260919 — the original UUID
    -- typing broke the alias bridge for UUID-shaped TEXT ids).
    canonical_artifact_id TEXT,
    canonical_business_version_id TEXT,
    canonical_working_revision_id TEXT,

    -- Machine-distinguishable identity outcome. 'not_applicable' means the rule
    -- carries no legacy id to resolve; it must never be conflated with
    -- 'not_migrated' (a real record with no canonical counterpart yet).
    identity_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (identity_status IN (
      'resolved',
      'quarantined',
      'not_migrated',
      'not_applicable'
    )),

    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An HTTP retry with the same request identity must not inflate cutover
-- evidence. COALESCE keeps the constraint effective for unresolved-tenant rows,
-- which SQL NULL semantics would otherwise treat as always distinct. Scoped to
-- runtime rows so importing pre-idempotency history stays lossless.
CREATE UNIQUE INDEX IF NOT EXISTS uq_legacy_cutover_usage_request_once
  ON legacy_cutover_usage_events (
    domain,
    COALESCE(organization_id, ''),
    request_id,
    method,
    route_path,
    access_kind
  )
  WHERE request_id IS NOT NULL AND source = 'runtime';

CREATE INDEX IF NOT EXISTS idx_legacy_cutover_usage_domain_observed
  ON legacy_cutover_usage_events(domain, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_cutover_usage_tenant_observed
  ON legacy_cutover_usage_events(organization_id, domain, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_cutover_usage_writer_kind
  ON legacy_cutover_usage_events(domain, writer_id, access_kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_cutover_usage_identity
  ON legacy_cutover_usage_events(domain, legacy_table, legacy_id, observed_at DESC);

-- ---------------------------------------------------------------------------
-- Backfill of the two pre-existing per-domain observation tables. Idempotent:
-- the source primary keys are reused (prefixed) as kernel ids, so re-running
-- inserts nothing new. Guarded by to_regclass so a fresh install that has not
-- yet created the older tables still applies cleanly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.finance_legacy_usage_events') IS NOT NULL THEN
    INSERT INTO legacy_cutover_usage_events (
        id, domain, source, writer_id, organization_id, tenant_resolution,
        request_id, user_id, method, route_path, access_kind, successor_path,
        legacy_table, legacy_id, canonical_artifact_id,
        canonical_business_version_id, identity_status, observed_at)
    SELECT
        'fin-' || id::text,
        'finance',
        'import',
        NULL,
        organization_id,
        'resolved',
        request_id,
        user_id,
        method,
        route_path,
        access_kind,
        successor_path,
        legacy_table,
        legacy_id,
        canonical_artifact_id,
        canonical_business_version_id,
        CASE WHEN canonical_artifact_id IS NOT NULL THEN 'resolved'
             WHEN legacy_id IS NOT NULL THEN 'not_migrated'
             ELSE 'not_applicable' END,
        observed_at
    FROM finance_legacy_usage_events
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Partner history carries no tenant column, so it is imported honestly as
  -- 'unresolved' rather than being attributed to a guessed organization.
  IF to_regclass('public.partner_legacy_usage_events') IS NOT NULL THEN
    INSERT INTO legacy_cutover_usage_events (
        id, domain, source, writer_id, organization_id, tenant_resolution,
        request_id, user_id, method, route_path, access_kind, successor_path,
        identity_status, observed_at)
    SELECT
        'prt-' || id::text,
        'partners',
        'import',
        NULL,
        NULL,
        'unresolved',
        request_id,
        user_id,
        method,
        route_path,
        access_kind,
        successor_path,
        'not_applicable',
        observed_at
    FROM partner_legacy_usage_events
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
