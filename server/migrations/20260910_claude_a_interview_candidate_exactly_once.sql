-- 20260910_claude_a_interview_candidate_exactly_once.sql
--
-- INT-BVP-001 — "exactly ONE initiative_candidates row per underlying
-- interview insight", regardless of which of TWO independent writers gets
-- there first.
--
-- VERIFIED PROBLEM (real Postgres, \d output reproduced 2026-08-16):
--   `initiative_candidates` has NO uniqueness beyond its PRIMARY KEY (id)
--   and `uq_initiative_candidates_registered_initiative` (unrelated —
--   scoped to `registered_initiative_id`). Two independent writers can each
--   mint a row for the SAME underlying interview insight:
--
--   A) server/src/services/interview/interviewCandidateHandoff.ts (this
--      lane's owned file) — the gated handoff. Source of truth:
--      `interview_insight_findings.review_status = 'published' AND
--      readback_status = 'confirmed_by_client'`. Writes
--      source_type = 'interview_insight_finding'.
--
--   B) server/src/services/initiative/initiativeCandidateService.ts's
--      `scanForCandidates` (OUTSIDE this lane's lease — read-only for this
--      packet) — the unconditioned cron/manual scan. Writes
--      source_type = 'interview_insight', source_id = interview_insights.id,
--      for ANY interview_insights row with status <> 'generating' that has
--      no row yet in `initiatives` (NOT `initiative_candidates` — a known,
--      separate defect; see this lane's closure report for the
--      INTEGRATOR_CHANGE_REQUEST against that file).
--
-- SHARED BUSINESS KEY. The two writers use DIFFERENT id domains for
-- `source_id` as originally written: path A used the FINDING's own id,
-- path B uses the INSIGHT's id. A unique index on (source_type, source_id)
-- alone could therefore never catch the cross-path duplicate — the values
-- literally differ. The reliable shared identity is the INSIGHT id itself
-- (`interview_insight_findings.insight_id` on path A's side,
-- `interview_insights.id` directly on path B's side). Because path B lives
-- outside this lane's lease and cannot be edited here, the fix is: this
-- lane's OWN writer (interviewCandidateHandoff.ts, see
-- `candidateSourceId` in `approveInterviewCandidateHandoff`) now writes the
-- CANDIDATE row's `source_id` as the INSIGHT id (not the finding id) for
-- the 'interview_insight_finding' kind, so BOTH writers land in the same
-- (organization_id, source_id) identity domain without path B's INSERT
-- statement needing to change at all. (The separate
-- `interview_candidate_handoffs` receipt table keeps the finding id in ITS
-- OWN `source_id` column, unaffected by this migration — existing
-- findingId-keyed lookups in interviewCandidateHandoff.routes.ts are not
-- disturbed.)
--
-- TENANCY. `initiative_candidates.organization_id` is included in the key
-- (this table has no FK to organizations, but every read/write in both
-- writers is already org-scoped; the index enforces per-tenant, not
-- cross-tenant, uniqueness).
--
-- PRE-EXISTING DUPLICATES. A bare `CREATE UNIQUE INDEX` would fail outright
-- on any database that already has two ACTIVE rows sharing
-- (organization_id, source_id) among these two source_types. Live check on
-- this environment's real DB (2026-08-16): zero rows exist for either
-- source_type today (`SELECT count(*) FROM initiative_candidates WHERE
-- source_type IN ('interview_insight','interview_insight_finding')` = 0),
-- so no pre-existing collision is possible under the OLD id scheme either
-- (irrelevant here since there is no data at all). For safety on any OTHER
-- environment (staging/demo/a future re-run once this table has real rows),
-- Step 1 below deterministically reconciles duplicates BEFORE the index is
-- created: for each (organization_id, source_id) group among ACTIVE
-- (status <> 'dismissed') rows of these two source_types, the SURVIVOR is
-- (a) a row that already has `initiative_id IS NOT NULL` (already promoted
-- — NEVER touched by this migration, see the final AND guard), else (b) the
-- earliest by created_at, tie-broken by id. Every other row in the group is
-- marked `status = 'dismissed'` (NOT deleted — no user data is destroyed,
-- full history remains queryable). This mirrors the existing precedent
-- `947_tool_outputs_idempotency_guard.sql` (partial index scoped to
-- non-superseded rows) and `toolOutputSnapshotService.ts`'s
-- ON CONFLICT / re-SELECT fallback shape.
--
-- KNOWN LIMITATION (stated plainly, not swept under the rug): this
-- reconciliation only unifies rows that ALREADY share the new
-- (organization_id, source_id) key. It does NOT retroactively rewrite
-- historical 'interview_insight_finding' rows created before this fix
-- (which used the OLD finding-id source_id) — doing so was rejected as
-- unsafe because any of those rows that were ALREADY accepted into an
-- Initiative baked their old source_id into `initiatives.source_id` at
-- accept time (see initiativeCandidateService.ts's `acceptCandidate`,
-- `lineageSourceId = candidate.sourceId`), and retroactively changing the
-- candidate's source_id would desync it from the initiative it already
-- produced. If a genuine pre-fix duplicate pair exists in OLD data (one
-- 'interview_insight_finding' row keyed by finding id, one
-- 'interview_insight' row keyed by insight id, for the same insight), this
-- migration will NOT merge them — only a separate, explicitly-reviewed data
-- migration should do that, because it requires deciding what happens to
-- whichever Initiative may already have been created.
--
-- IDEMPOTENT / ADDITIVE ONLY. `CREATE UNIQUE INDEX IF NOT EXISTS`; the
-- reconciliation UPDATE only ever matches rows still `status <> 'dismissed'`
-- with rn > 1, so a second run of this file finds nothing left to update
-- and creates nothing (the index already exists) — zero-change, no error.
-- No DROP TABLE/COLUMN, no unconditional DELETE.
--
-- CRON/SCAN SAFETY (assessed, not guessed): `scanForCandidates`'s own
-- per-artifact INSERT (initiativeCandidateService.ts, read-only for this
-- packet) is already wrapped in a bare `try { ... } catch { /* degrade */ }`
-- with no re-throw. A 23505 raised by this new index on that INSERT is
-- therefore CAUGHT AND SILENTLY SWALLOWED by the scan's existing code —
-- it degrades to "this artifact produced no candidate this run" and the
-- loop continues to the next artifact. It does NOT crash the cron
-- (InitiativeCandidateScanCron.ts) or the manual-scan route. The only
-- downside is inefficiency: because the scan's own in-process dedup keys
-- off (source_type, source_id) — not the new shared key — an insight
-- already claimed by path A will keep failing this same INSERT (silently)
-- on every future scan run instead of being skipped up front. See this
-- lane's closure report for the INTEGRATOR_CHANGE_REQUEST that fixes this
-- at the source (scanForCandidates should check `initiative_candidates`,
-- not `initiatives`, in its NOT EXISTS guard — which would also make this
-- repeated-attempt inefficiency disappear).

-- Step 1: reconcile pre-existing ACTIVE duplicates so the partial unique
-- index below can be created safely even on a database that already has
-- them. Never touches a row that has already been promoted to an
-- Initiative (`initiative_id IS NOT NULL`) — the final AND guard is
-- belt-and-suspenders on top of the ranking already preferring such rows.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, source_id
           ORDER BY
             (initiative_id IS NOT NULL) DESC,
             (accepted_at IS NOT NULL) DESC,
             created_at ASC,
             id ASC
         ) AS rn
  FROM initiative_candidates
  WHERE source_type IN ('interview_insight', 'interview_insight_finding')
    AND status <> 'dismissed'
)
UPDATE initiative_candidates ic
SET status = 'dismissed',
    updated_at = CURRENT_TIMESTAMP
FROM ranked
WHERE ic.id = ranked.id
  AND ranked.rn > 1
  AND ic.initiative_id IS NULL;

-- Step 2: at most one ACTIVE (non-dismissed) candidate per
-- (organization_id, source_id) across the two interview source_types that
-- share the insight-id identity domain. `interview_submission`-sourced
-- rows (a different identity domain — assignment ids) are untouched by
-- this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_initiative_candidates_interview_insight_once
  ON initiative_candidates (organization_id, source_id)
  WHERE source_type IN ('interview_insight', 'interview_insight_finding')
    AND status <> 'dismissed';
