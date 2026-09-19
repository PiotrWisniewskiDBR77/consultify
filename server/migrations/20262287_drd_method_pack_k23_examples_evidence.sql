-- A12 / K-23: DRD method-pack content refresh for the “Example and evidence” drawer.
-- The actual content is compiled from the governed DRD QBank/Oxford O1 sources in
-- src/method-core/methods/drd/compileDrdPack.ts. This migration registers the new
-- immutable pack version for existing organizations without touching old sessions.

INSERT INTO method_packs
  (id, organization_id, pack_id, version, name, readiness, licence_json, manifest_json, created_at)
SELECT
  'mp-drd-k23-' || substr(md5(o.id), 1, 24),
  o.id,
  'drd',
  '2.0.0-methodpack.2',
  'DRD — Digital Readiness Diagnosis (Digital Pathfinder)',
  'pilot',
  '{"holder":"DBR77 / Digital Pathfinder (Dr. Piotr Wiśniewski)","usageRestriction":"internal_only","notice":"DRD/Digital Pathfinder is a licensed methodology. QBank v2 content and level descriptions come from DBR77 materials. They must not be copied into public deliverables without the methodology owner''s permission.","notices":{"en":"DRD/Digital Pathfinder is a licensed methodology. QBank v2 content and level descriptions come from DBR77 materials. They must not be copied into public deliverables without the methodology owner''s permission.","pl":"DRD/Digital Pathfinder jest metodyką licencjonowaną. Treści QBank v2 i opisy poziomów pochodzą z materiałów DBR77 — zakaz kopiowania do publicznych deliverables bez zgody właściciela metodyki."}}'::jsonb,
  '{"id":"drd","version":"2.0.0-methodpack.2","name":"DRD — Digital Readiness Diagnosis (Digital Pathfinder)","readiness":"pilot","change":"K-23 examples and evidence content compiled from DRD QBank/Oxford O1 sources"}'::jsonb,
  NOW()
FROM organizations o
ON CONFLICT (organization_id, pack_id, version) DO NOTHING;
