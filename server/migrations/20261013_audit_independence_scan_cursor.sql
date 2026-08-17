-- AUD-POL-001 / AMD-AUD-RIGHTS-001: durable checkpoint + fenced lease for the
-- audit independence detector sweep.
--
-- Why a cursor at all: the detector must eventually visit EVERY audit_programs
-- row. A "newest-updated, top N" query can never do that — once the table
-- exceeds N, rows outside the freshest window are starved permanently, which
-- is a systematic defect, not an edge case. Ordering by `id` (a stable primary
-- key that is never rewritten) gives every row a fixed, permanent position in
-- a cycle that always completes and then wraps.
--
-- Why a FENCED lease: `leased_until` alone prevents two workers from claiming
-- concurrently, but it does NOT stop a stalled worker whose lease has since
-- expired (and been taken over) from later writing its stale progress and
-- rewinding or skipping the cursor. `lease_fence` is a monotonically
-- increasing token: a claim increments it and the claimant remembers the
-- value; every progress write is conditioned on the fence still matching, so
-- a superseded worker's write matches zero rows and is discarded.
--
-- This table holds one global row: the sweep walks audit_programs across all
-- organizations, so the checkpoint is not per-tenant. It carries no policy and
-- no tenant data — only scan position and lease bookkeeping.
CREATE TABLE IF NOT EXISTS audit_independence_scan_cursor (
  id TEXT PRIMARY KEY DEFAULT 'global',
  last_program_id TEXT NOT NULL DEFAULT '',
  cycles_completed BIGINT NOT NULL DEFAULT 0,
  lease_fence BIGINT NOT NULL DEFAULT 0,
  leased_by TEXT,
  leased_until TIMESTAMPTZ,
  last_tick_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
