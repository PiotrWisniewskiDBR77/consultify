-- D-20 data backfill rollback note.
-- This migration only reconciles derived projections (`initiatives.status` and
-- `ie_aggregate_state.payload_json.lifecycleState`) to the already persisted
-- `initiatives.lifecycle_stage`. It intentionally has no destructive automatic
-- rollback; restore a pre-deploy database backup if this data reconciliation has
-- to be undone as an operational event.
SELECT '20262284_initiative_lifecycle_projection_backfill is data-only and has no automatic rollback' AS notice;
