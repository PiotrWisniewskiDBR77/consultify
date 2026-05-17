-- Bundle 28 (T096) — Partner Program Toolkit & Resources

-- Note: `partner_resources` already exists (created by 215_partner_portal.sql).
-- This migration extends it with V2 fields for versioning + real download handling.

CREATE TABLE IF NOT EXISTS partner_resources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('documentation', 'marketing', 'case_study', 'template', 'training')),
    file_type TEXT,
    file_size_bytes BIGINT,
    file_url TEXT,
    thumbnail_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    min_partner_tier TEXT DEFAULT 'REGISTERED',
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_resource_downloads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    resource_id TEXT NOT NULL REFERENCES partner_resources(id) ON DELETE CASCADE,
    partner_org_id TEXT NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE partner_resources
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS file_key TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_resources_status_check'
      AND conrelid = 'partner_resources'::regclass
  ) THEN
    ALTER TABLE partner_resources
      ADD CONSTRAINT partner_resources_status_check CHECK (status IN ('active', 'archived'));
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- ignore
END $$;

CREATE INDEX IF NOT EXISTS idx_partner_resources_status_cat
  ON partner_resources(status, category);
CREATE INDEX IF NOT EXISTS idx_partner_resources_min_tier
  ON partner_resources(min_partner_tier);

-- Note: `partner_resource_downloads` already exists (created by 215_partner_portal.sql).
ALTER TABLE partner_resource_downloads
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_partner_resource_downloads_org_time
  ON partner_resource_downloads(partner_org_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_resource_downloads_resource_time
  ON partner_resource_downloads(resource_id, downloaded_at DESC);

-- Seed: minimum V2 toolkit (EN + PL)
INSERT INTO partner_resources (
  id,
  category,
  title,
  description,
  language,
  version,
  status,
  file_key,
  file_name,
  mime_type,
  min_partner_tier,
  is_active
)
VALUES
  ('2c39bd91-2d86-4f10-9c9f-4c65c1c0e7c1', 'marketing', 'Product One‑pager', 'One-page overview: value props, differentiators, security, CTA.', 'en', 'v1', 'active', 'generated:one_pager', 'consultify-one-pager-en-v1.pdf', 'application/pdf', 'REGISTERED', TRUE),
  ('7d6e8e1e-6b1f-4b2f-9fd7-2c7c97057b5a', 'marketing', 'Product One‑pager', 'One-page overview: value props, differentiators, security, CTA.', 'pl', 'v1', 'active', 'generated:one_pager', 'consultify-one-pager-pl-v1.pdf', 'application/pdf', 'REGISTERED', TRUE),

  ('f86f6a89-3b3c-4c29-9c6b-5b8b0a9b8f2b', 'template', 'Sales deck template', '10–15 slide partner sales deck (safe claims).', 'en', 'v1', 'active', 'generated:sales_deck', 'consultify-sales-deck-en-v1.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'SILVER', TRUE),
  ('b5e20c4c-6a92-4a55-9c5a-9010a4a7c0d3', 'template', 'Sales deck template', '10–15 slide partner sales deck (safe claims).', 'pl', 'v1', 'active', 'generated:sales_deck', 'consultify-sales-deck-pl-v1.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'SILVER', TRUE),

  ('c0e52c5d-3a78-45c2-8e43-8b0a0f3d61e8', 'template', 'Discovery call script + objections', 'Discovery questions + objection handling (CFO/COO/PMO).', 'en', 'v1', 'active', 'generated:discovery_script', 'consultify-discovery-script-en-v1.pdf', 'application/pdf', 'REGISTERED', TRUE),
  ('4a7a7b27-9e53-4a06-b0d1-5c5b0a9b1240', 'template', 'Discovery call script + objections', 'Pytania discovery + obiekcje (CFO/COO/PMO).', 'pl', 'v1', 'active', 'generated:discovery_script', 'consultify-discovery-script-pl-v1.pdf', 'application/pdf', 'REGISTERED', TRUE),

  ('e4d5d6e5-08c2-4b11-9dfc-0f54e4b3a0d1', 'template', 'Email templates pack', 'Cold outbound, follow‑up, post‑demo/trial nudge + compliance note.', 'en', 'v1', 'active', 'generated:email_pack', 'consultify-email-pack-en-v1.txt', 'text/plain', 'REGISTERED', TRUE),
  ('0f0f9e42-b4c7-4e2a-9cc2-8f7d3c8a6d3f', 'template', 'Email templates pack', 'Cold outbound, follow‑up, post‑demo/trial nudge + compliance note.', 'pl', 'v1', 'active', 'generated:email_pack', 'consultify-email-pack-pl-v1.txt', 'text/plain', 'REGISTERED', TRUE),

  ('3a0f9d7f-41d2-4b20-9b17-6a6b5a4c3d2e', 'case_study', 'Case study template + sample', 'Case study template and a sample “hero” story.', 'en', 'v1', 'active', 'generated:case_study_pack', 'consultify-case-study-pack-en-v1.pdf', 'application/pdf', 'SILVER', TRUE),
  ('b2c3d4e5-f6a7-48b9-9c0d-1e2f3a4b5c6d', 'case_study', 'Case study template + sample', 'Szablon case study + przykładowa historia.', 'pl', 'v1', 'active', 'generated:case_study_pack', 'consultify-case-study-pack-pl-v1.pdf', 'application/pdf', 'SILVER', TRUE),

  ('7b1f0c9a-4c1e-4b55-9f8e-9a0b1c2d3e4f', 'marketing', 'Logo / brand kit', 'Logos (light/dark), partner badge and usage rules.', 'en', 'v1', 'active', 'generated:brand_kit_zip', 'consultify-brand-kit-v1.zip', 'application/zip', 'REGISTERED', TRUE),
  ('2e3f4a5b-6c7d-48e9-9f0a-1b2c3d4e5f60', 'marketing', 'Screenshots pack', 'Curated set of product screenshots with usage hints.', 'en', 'v1', 'active', 'generated:screenshots_zip', 'consultify-screenshots-v1.zip', 'application/zip', 'REGISTERED', TRUE)
ON CONFLICT (id) DO NOTHING;
