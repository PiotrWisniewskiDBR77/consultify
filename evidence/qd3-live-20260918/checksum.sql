-- Deterministic fingerprint of the 12 REAL organizations and of every row in the
-- 6 residue tables that belongs to a real org. Used PRZED and PO the live orphan
-- sweep: the two must be byte-identical, proving the sweep touched ONLY dangling
-- demo-clone rows (organization_id LIKE 'ateliertoys-demo-session-%' AND no
-- organizations row) and never real-org data.
\pset footer off
\pset format unaligned
SELECT 'ORG_COUNT=' || count(*) FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%';
SELECT 'CHECKSUM=' || md5(string_agg(part, '#' ORDER BY part))
FROM (
  SELECT 'organizations:' || count(*) || ':' || coalesce(md5(string_agg(id, ',' ORDER BY id)), '-') AS part
  FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
  UNION ALL
  SELECT 'artifact_lineage_events:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM artifact_lineage_events WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
  UNION ALL
  SELECT 'artifact_lineage_receipts:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM artifact_lineage_receipts WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
  UNION ALL
  SELECT 'conversion_events:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM conversion_events WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
  UNION ALL
  SELECT 'v8_artifact_origin_links:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM v8_artifact_origin_links WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
  UNION ALL
  SELECT 'work_signal_runs:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM work_signal_runs WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
  UNION ALL
  SELECT 'work_signals:' || count(*) || ':' || coalesce(md5(string_agg(organization_id, ',' ORDER BY organization_id)), '-')
  FROM work_signals WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%'
)
) t;
-- per-table detail: real-org rows (protected) vs total rows
SELECT 'DETAIL ' || tbl || ' real=' || real || ' total=' || total FROM (
  SELECT 'artifact_lineage_events' tbl,
    (SELECT count(*) FROM artifact_lineage_events WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')) real,
    (SELECT count(*) FROM artifact_lineage_events) total
  UNION ALL SELECT 'artifact_lineage_receipts',
    (SELECT count(*) FROM artifact_lineage_receipts WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM artifact_lineage_receipts)
  UNION ALL SELECT 'conversion_events',
    (SELECT count(*) FROM conversion_events WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM conversion_events)
  UNION ALL SELECT 'v8_artifact_origin_links',
    (SELECT count(*) FROM v8_artifact_origin_links WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM v8_artifact_origin_links)
  UNION ALL SELECT 'work_signal_runs',
    (SELECT count(*) FROM work_signal_runs WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM work_signal_runs)
  UNION ALL SELECT 'work_signals',
    (SELECT count(*) FROM work_signals WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM work_signals)
  UNION ALL SELECT 'results_writer_observations',
    (SELECT count(*) FROM results_writer_observations WHERE organization_id IN (SELECT id FROM organizations WHERE id NOT LIKE 'ateliertoys-demo-session-%')),
    (SELECT count(*) FROM results_writer_observations)
) d ORDER BY tbl;
