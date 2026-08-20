-- FIN-MVP-CUTOVER / ECO-W31
-- Tenant-bound canonical valuation PPTX export file binding. Byte/source proof
-- lives in the shared immutable artifact_export_receipts ledger.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.finance_valuation_pptx_exports') IS NOT NULL THEN
    RAISE EXCEPTION 'ECO-W31 owned migration identity already exists';
  END IF;
END $$;

CREATE TABLE finance_valuation_pptx_exports (
  organization_id TEXT NOT NULL,
  export_receipt_id TEXT NOT NULL,
  legacy_valuation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  working_revision_version INTEGER NOT NULL CHECK (working_revision_version >= 1),
  source_content_hash TEXT NOT NULL CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  output_content_hash TEXT NOT NULL CHECK (output_content_hash ~ '^[0-9a-f]{64}$'),
  output_byte_size INTEGER NOT NULL CHECK (output_byte_size > 0),
  export_path TEXT NOT NULL CHECK (export_path LIKE '/exports/valuations/%'),
  language TEXT NOT NULL CHECK (language IN ('en','pl')),
  theme TEXT NOT NULL CHECK (theme IN ('corporate','minimal','modern')),
  confidentiality TEXT NOT NULL CHECK (confidentiality IN ('confidential','internal','public')),
  slide_count INTEGER NOT NULL CHECK (slide_count > 0),
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings_json)='array'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, export_receipt_id),
  UNIQUE (organization_id, business_version_id, source_content_hash, language, theme, confidentiality),
  FOREIGN KEY (export_receipt_id) REFERENCES artifact_export_receipts(export_receipt_id),
  FOREIGN KEY (legacy_valuation_id, organization_id) REFERENCES valuations(id, organization_id),
  FOREIGN KEY (artifact_id, organization_id) REFERENCES finance_artifacts(artifact_id, organization_id),
  FOREIGN KEY (business_version_id, organization_id) REFERENCES finance_business_versions(business_version_id, organization_id),
  FOREIGN KEY (working_revision_id, organization_id) REFERENCES finance_working_revisions(working_revision_id, organization_id)
);

COMMIT;
