-- OKR-E004 — Check-in schema.
--
-- Design: docs/product/results-vnext/OKR_E004_DESIGN.md §6, ratified by the
-- §-IO Integration Owner rulings block at the top of that document.
--
-- IO-1 RE-VERIFICATION (binding): the design's own §6 DDL sketch reserved
-- filename `20260824_rvn_okr_checkin.sql` — that date COLLIDES with
-- OKR-E003's actually-landed `20260824_rvn_okr_objective_key_result.sql`.
-- Renamed to 20260825 here, the next free sequential date, per the design's
-- own instruction to "verify no collision ... once E001/E002's true merge
-- dates are confirmed" (§6 header comment) — E003 landed since the design
-- was frozen (IO-1 finding).
--
-- FK targets re-verified against server/migrations/20260824_rvn_okr_objective_key_result.sql
-- (E003, landed): okr_vnext_key_results(key_result_id), okr_vnext_objectives
-- (objective_id), okr_vnext_sets(set_id) — all confirmed present with the
-- exact column names the design assumed as a "best-effort projection".
--
-- Handoff honored: NO ALTER on okr_vnext_checkin_occurrences (OKR-E001 P11)
-- and NO ALTER on okr_vnext_sets (OKR-E002's reserved overall_progress/
-- overall_confidence/attention_state/last_checkin_at/next_checkin_due_at
-- columns, confirmed present verbatim in 20260823_rvn_okr_set.sql).
--
-- D5 naming deviation from the design draft (design §5 D5, §6 DDL): the
-- draft named these columns confidence_label/confidence_numeric. Renamed
-- here to confidence/confidence_numeric_value to match the ALREADY-LANDED
-- E003 convention verbatim (okr_vnext_key_results.confidence TEXT CHECK IN
-- ('high','medium','low','numeric') + confidence_numeric_value NUMERIC) —
-- this epic's write-through target (D6) is that exact KR column pair, so
-- matching names/shapes avoids a translation step at the one place it
-- matters most. Same two-column-is-not-DB-CHECK-enforced posture as D5
-- specified: command layer enforces "at most one populated, matching the
-- Program's confidence_model", not a DB CHECK (cross-table rule).
CREATE TABLE IF NOT EXISTS okr_vnext_checkins (
  checkin_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              TEXT NOT NULL,

  key_result_id                 UUID NOT NULL REFERENCES okr_vnext_key_results(key_result_id),
  -- Denormalized for query convenience only (D1) — NOT the aggregate's
  -- identity. Populated from the KR's own objective_id/set_id at insert
  -- time, read-only thereafter (never independently updatable).
  objective_id                   UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  set_id                          UUID NOT NULL REFERENCES okr_vnext_sets(set_id),

  cadence_occurrence_id            UUID NOT NULL REFERENCES okr_vnext_checkin_occurrences(cadence_occurrence_id),

  previous_value                    NUMERIC NULL,
  new_value                          NUMERIC NULL,
  calculated_progress                 NUMERIC NULL,

  owner_declared_status                 TEXT NULL
                                          CHECK (owner_declared_status IN (
                                            'not_started','on_track','at_risk','off_track',
                                            'achieved','not_achieved','cancelled'
                                          )),
  system_suggested_status                TEXT NULL
                                          CHECK (system_suggested_status IN (
                                            'not_started','on_track','at_risk','off_track',
                                            'achieved','not_achieved','cancelled'
                                          )),

  -- D5 (renamed, see header note): matches okr_vnext_key_results.confidence/
  -- confidence_numeric_value verbatim.
  confidence                                TEXT NULL CHECK (confidence IN ('high','medium','low','numeric')),
  confidence_numeric_value                   NUMERIC NULL,

  note                                      TEXT NOT NULL,
  blocker                                    TEXT NULL,
  support_requested                           TEXT NULL,
  evidence_refs                                JSONB NOT NULL DEFAULT '[]',

  -- Append-only correction chain (D2/D4) — NULL = original recording,
  -- participates in the "one row per KR+window" uniqueness below. Never an
  -- UPDATE of a prior row (REVOKE below expresses the structural intent;
  -- same documented caveat as rvn_kpi_measurements/rvn_roi_actual_entries
  -- that it does not stop an owner/superuser connection).
  correction_of_checkin_id                      UUID NULL REFERENCES okr_vnext_checkins(checkin_id),
  correction_reason                              TEXT NULL,

  submitted_by                                    TEXT NOT NULL,
  submitted_at                                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AC-010 idempotency (D2/D3): composite because okr_vnext_checkin_occurrences
-- is Cycle-scoped, not KR-scoped (design §2.1) — one occurrence row per
-- window is shared across every KR in the Cycle, so the KR must be part of
-- the uniqueness key, not the occurrence alone.
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_checkins_kr_occurrence_original
  ON okr_vnext_checkins(key_result_id, cadence_occurrence_id)
  WHERE correction_of_checkin_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_kr
  ON okr_vnext_checkins(organization_id, key_result_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_set
  ON okr_vnext_checkins(organization_id, set_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_correction_of
  ON okr_vnext_checkins(correction_of_checkin_id) WHERE correction_of_checkin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_occurrence
  ON okr_vnext_checkins(organization_id, cadence_occurrence_id);

-- Same append-only limitation as rvn_kpi_measurements/rvn_roi_actual_entries
-- (documented there): REVOKE from PUBLIC does not stop an owner/superuser
-- connection — no named least-privilege application role exists yet in this
-- program. Structural intent is still expressed here; proven with a fresh
-- NOLOGIN role in tests/resultsVnext/okr/okrCheckInAppendOnly.realdb.test.ts.
REVOKE UPDATE, DELETE ON okr_vnext_checkins FROM PUBLIC;

-- No changes to okr_vnext_checkin_occurrences (OKR-E001 P11 handoff) or
-- okr_vnext_sets (OKR-E002 reserved columns) — confirmed honored: this
-- migration only adds a new table.
-- No new RVN_RESOURCE_TYPES / rvn_platform_resource_visibility rows (D14) —
-- visibility inherits via set_id, joined through the parent Set's own
-- 'okr_set' visibility row (mirrors OKR-E003's Objective/KeyResult posture).
