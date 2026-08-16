-- Lane C (closure) — MTG-BVP-001: Meeting boundary — durable minutes +
-- proposal-first notes.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────
-- `generate-notes` (`meeting.routes.ts`) currently discards the AI-generated
-- note content the moment the HTTP response is sent — nothing durable is
-- stored anywhere — and defaults to persisting the extracted decisions /
-- action items STRAIGHT into `meetings.decisions_json` / `meeting_follow_ups`
-- with NO human-approval step and NO idempotency guard (`addMeetingDecision`
-- appends to a JSON array on every call; `addMeetingFollowUp` INSERTs a
-- fresh UUID on every call — a retried/double-clicked/replayed request
-- silently duplicates). See the inventory in
-- `20260912_claude_c_handoff_spine.sql:15-17` for the confirmed gap.
--
-- This migration adds exactly ONE new table, `meeting_notes`, that:
--   (a) durably stores every AI-generated note (summary / key points /
--       decisions / action items) the instant it is generated, so it is
--       never discarded regardless of whether a human ever approves it;
--   (b) carries an idempotency key with a DB-enforced uniqueness
--       constraint, so a retried generate-notes call for the SAME
--       (organization, meeting, idempotency key) can never create a second
--       note record — the exact "replay cannot duplicate" gap named above;
--   (c) links (by plain id, no FK — see the fresh-DB guard below) to the
--       governed proposal in `artifact_handoff_proposals`
--       (`20260912_claude_c_handoff_spine.sql`) that gates human approval
--       before this note becomes an approved "material" — orchestrated by
--       `meetingBoundaryService.ts`, never by a direct unguarded write.
--
-- `meetings` / `meeting_follow_ups` (the two legacy all-TEXT tables) are
-- deliberately left untouched: the 48-flow regression suite
-- (`tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`)
-- exercises their manual, human-typed CRUD paths (`POST /:id/decisions`,
-- `POST /:id/follow-ups`) directly and must keep passing unmodified.
--
-- ── FRESH-DB GUARD (migration-ordering trap) ────────────────────────────
-- `migrate.postgres.ts` applies migrations in plain FILENAME STRING sort
-- order, not chronological order ('2' < '7', so every `2026*` file runs
-- BEFORE every 3-digit `7xx/8xx/9xx` file on a from-zero replay) — documented
-- at `20260802_mat010_artifact_lineage.sql:22-33` and repeated at
-- `20260912_claude_c_handoff_spine.sql:36-45`. This file is immune by the
-- same construction: it creates only a NEW table with `IF NOT EXISTS` and
-- adds NO foreign key to `meetings`, `meeting_follow_ups`, or
-- `artifact_handoff_proposals` — even though the latter two normally sort
-- before this file alphabetically ('handoff_spine' < 'meeting_boundary'),
-- the ordering contract for this program is "assume nothing", so
-- `meeting_id` and `proposal_id` are both plain TEXT columns with a
-- non-unique index, resolved at the application layer
-- (`meetingBoundaryService.ts`), never enforced by FK.
--
-- Every statement below is idempotent (CREATE ... IF NOT EXISTS /
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT) — verified by fresh + repeat +
-- `--dry-run` runs against a live Postgres.

CREATE TABLE IF NOT EXISTS meeting_notes (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  -- No FK to `meetings` — see the fresh-DB guard above. Tenant + existence
  -- of the parent meeting is checked at the application layer, the same
  -- pattern `meeting.routes.ts` already uses for `meeting_follow_ups`
  -- reads (org-scoped `getMeeting` lookup before any child-table access).
  meeting_id         TEXT NOT NULL,
  -- Whether the note came from a real LLM or the regex heuristic fallback
  -- (mirrors `MeetingNote.source` in `meetingIntelligenceService.ts` — 'ai'
  -- is the real-LLM value there, deliberately mirrored here so this table's
  -- data is never mis-labelled relative to what actually produced it).
  source             TEXT NOT NULL DEFAULT 'heuristic',
  language           TEXT NOT NULL DEFAULT 'en',
  -- sha256 of the raw transcript text. Feeds the default idempotency key
  -- (meeting + transcript + language) when the caller supplies none, so an
  -- accidental client retry of the SAME transcript is deduplicated even
  -- without any special client-side handling.
  transcript_hash    TEXT NOT NULL,
  summary            TEXT NOT NULL DEFAULT '',
  key_points_json    TEXT NOT NULL DEFAULT '[]',
  -- Extracted decisions / action items as PROPOSED content. These are never
  -- written into `meetings.decisions_json` / `meeting_follow_ups` (Meeting's
  -- own legacy tables) or into any foreign owner table (`tasks`,
  -- `decisions`, `materials` — Lane C does not own those lifecycles) except
  -- through the governed approve+materialize path below.
  decisions_json     TEXT NOT NULL DEFAULT '[]',
  action_items_json  TEXT NOT NULL DEFAULT '[]',
  -- Convenience mirror of `artifact_handoff_proposals.state` for this note's
  -- proposal (cheap reads without a join). The proposals row is always the
  -- authority; `meetingBoundaryService.ts` keeps this in sync immediately
  -- after every state-changing spine call, never ahead of it.
  status             TEXT NOT NULL DEFAULT 'proposed',
  proposal_id        TEXT,
  idempotency_key    TEXT,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replay guard: a retried generate-notes call for the SAME
-- (organization, meeting, idempotency key) triple must return the
-- ALREADY-CREATED note instead of inserting a second one. Same proven
-- partial-unique-index idiom as `idx_handoff_proposal_org_idem`
-- (`20260912_claude_c_handoff_spine.sql`) and
-- `944_canvas_idea_materialization_receipts.sql` before it. The service
-- checks for THIS index BY NAME to distinguish "a concurrent/retried caller
-- already claimed this key" from any other constraint violation — the name
-- below MUST stay in sync with `meetingBoundaryService.ts`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_notes_org_meeting_idem
  ON meeting_notes (organization_id, meeting_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting
  ON meeting_notes (organization_id, meeting_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_proposal
  ON meeting_notes (proposal_id);

ALTER TABLE meeting_notes
  DROP CONSTRAINT IF EXISTS meeting_notes_status_check;
ALTER TABLE meeting_notes
  ADD CONSTRAINT meeting_notes_status_check
  CHECK (status IN ('proposed', 'approved', 'rejected'));

ALTER TABLE meeting_notes
  DROP CONSTRAINT IF EXISTS meeting_notes_source_check;
ALTER TABLE meeting_notes
  ADD CONSTRAINT meeting_notes_source_check
  CHECK (source IN ('ai', 'heuristic'));
