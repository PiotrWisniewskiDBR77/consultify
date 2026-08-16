-- FIN-MVP-CUTOVER-001: an HTTP retry with the same request identity must not
-- inflate cutover usage or create contradictory rollout evidence.
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_legacy_usage_request_once
  ON finance_legacy_usage_events (
    organization_id,
    request_id,
    method,
    route_path,
    access_kind
  )
  WHERE request_id IS NOT NULL;
