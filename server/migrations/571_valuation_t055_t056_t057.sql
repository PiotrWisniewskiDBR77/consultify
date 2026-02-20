-- ============================================
-- Bundle 16 — Valuation (T055–T057)
-- valuations, valuation_snapshots
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'valuations') THEN
    CREATE TABLE valuations (
      id VARCHAR(32) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64),
      initiative_id VARCHAR(64),
      title VARCHAR(512) NOT NULL,
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      source_type VARCHAR(64) NOT NULL,
      source_id VARCHAR(64),
      horizon_years INTEGER NOT NULL DEFAULT 5,
      currency VARCHAR(8) DEFAULT 'PLN',
      assumptions JSONB DEFAULT '{}',
      peers JSONB DEFAULT '[]',
      results JSONB DEFAULT '{}',
      advisory JSONB,
      negotiation_pack JSONB,
      approved_by VARCHAR(64),
      approved_at TIMESTAMPTZ,
      created_by VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_valuations_org ON valuations(organization_id);
    CREATE INDEX idx_valuations_updated ON valuations(updated_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'valuation_snapshots') THEN
    CREATE TABLE valuation_snapshots (
      id VARCHAR(32) PRIMARY KEY,
      valuation_id VARCHAR(32) NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      snapshot_data JSONB NOT NULL,
      approved_by VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_valuation_snapshots_valuation ON valuation_snapshots(valuation_id);
  END IF;
END $$;
