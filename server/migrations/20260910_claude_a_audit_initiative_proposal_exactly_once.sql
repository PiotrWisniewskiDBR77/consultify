-- AUD-MVP-AI-HANDOFF-001 / AUD-MVP-LIFECYCLE-001
-- Enforce "exactly ONE downstream receipt" for audit initiative-proposal
-- registration AT THE DATABASE LAYER.
--
-- WHY A MIGRATION, NOT AN APPLICATION FIX:
-- proposalService.registerAsInitiative() (server/src/services/audits/proposalService.ts)
-- is check-then-act:
--   1. SELECT the proposal, check proposal.status !== 'registered'/'dismissed'
--   2. call the canonical createInitiative() funnel (an INSERT into `initiatives`)
--   3. UPDATE audit_initiative_proposals SET status='registered', registered_initiative_id=...
-- Two concurrent registerAsInitiative() calls for the SAME proposal can both
-- pass step 1 before either reaches step 3, so both run step 2 and each
-- produces its OWN new initiative row — i.e. TWO downstream receipts for ONE
-- proposal. That file is outside this lane's lease (server/src/services/audits/**),
-- so the fix lives here, in schema.
--
-- THE FIX:
-- initiatives.source_type / initiatives.source_id already carry the business
-- identity of the receipt for audit-sourced initiatives (source_type='audit',
-- source_id = audit_initiative_proposals.id — see createInitiativeService.ts).
-- A partial unique index on that identity makes the SECOND concurrent
-- createInitiative() INSERT fail with a unique-violation at the database level,
-- which registerAsInitiative()'s existing try/catch (proposalService.ts:498-506)
-- already turns into a defined AUDIT_PROPOSAL_REGISTER_FAILED domain error
-- instead of a second silent receipt. We do not need to touch the service to
-- get this guarantee — the constraint alone closes the race.
--
-- As defense in depth we also forbid two different proposals from ever
-- pointing at the same registered_initiative_id.
--
-- SAFE / ADDITIVE / IDEMPOTENT:
-- - No DROP, no unconditional DELETE, no column removal.
-- - CREATE UNIQUE INDEX ... IF NOT EXISTS: re-running this file is a no-op.
-- - Tenant-aware: both indexes are scoped by organization_id.
-- - Pre-existing-duplicate safe: a bare CREATE UNIQUE INDEX would fail (and
--   abort the shared migration runner for every consumer of this branch) on
--   any database that already has more than one 'audit'-sourced initiative
--   for the same source_id, or more than one proposal already claiming the
--   same registered_initiative_id. Both guarded pre-clean blocks below run
--   BEFORE the index creation and are themselves idempotent (a second run
--   finds nothing left to touch, since the surviving row's rn is always 1).
--   They keep the EARLIEST row (by created_at, then id) as the sole receipt
--   and detach only the identifying pointer (source_id / registered_initiative_id)
--   on later duplicates — never the row itself, never any other column, never
--   any other user data. On this environment's live schema (checked before
--   writing this migration) there are zero 'audit'-sourced initiatives and
--   zero non-null registered_initiative_id values today, so both pre-clean
--   blocks are no-ops here; they exist for the safety of every other consumer
--   of this shared migration runner.

-- ---------------------------------------------------------------------------
-- 1. Pre-clean: at most one 'audit'-sourced initiative per
--    (organization_id, source_id). Detach source_id (leave source_type and
--    every other column untouched) on all but the earliest duplicate.
-- ---------------------------------------------------------------------------
WITH ranked_initiatives AS (
  SELECT
    id,
    organization_id,
    source_id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, source_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM initiatives
  WHERE source_type = 'audit' AND source_id IS NOT NULL
)
UPDATE initiatives i
   SET source_id = NULL,
       updated_at = NOW()
  FROM ranked_initiatives r
 WHERE i.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_initiatives_audit_source_once
  ON initiatives (organization_id, source_id)
  WHERE source_type = 'audit' AND source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Pre-clean: at most one audit_initiative_proposals row may point at a
--    given registered_initiative_id. Detach registered_initiative_id (leave
--    status/registered_at/every other column untouched) on all but the
--    earliest claimant.
-- ---------------------------------------------------------------------------
WITH ranked_proposals AS (
  SELECT
    id,
    organization_id,
    registered_initiative_id,
    ROW_NUMBER() OVER (
      PARTITION BY registered_initiative_id
      ORDER BY registered_at ASC NULLS LAST, created_at ASC, id ASC
    ) AS rn
  FROM audit_initiative_proposals
  WHERE registered_initiative_id IS NOT NULL
)
UPDATE audit_initiative_proposals p
   SET registered_initiative_id = NULL,
       updated_at = NOW()
  FROM ranked_proposals r
 WHERE p.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_initiative_proposals_registered_initiative_id
  ON audit_initiative_proposals (registered_initiative_id)
  WHERE registered_initiative_id IS NOT NULL;
