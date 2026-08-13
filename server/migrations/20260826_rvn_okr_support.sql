-- ============================================================
-- OKR-E006 (Support & Decisions) — schema.
--
-- Design: docs/product/results-vnext/OKR_E006_DESIGN.md §8.1/§10.3/§9.3,
-- ratified by the §-IO Integration Owner rulings block at the top of that
-- document (IO-6 ruling on Open Question #1 approves the Decisions-module
-- seam design, built as a SEPARATE additive commit outside this migration).
--
-- Three pieces:
--   1. okr_vnext_support_requests — OKR-F-018-AC-01. One table, `kind`
--      discriminator (comment | recognition | support_request). Only
--      support_request carries a status lifecycle.
--   2. okr_vnext_decision_links — OKR-F-019-AC-01. Pinned typed reference to
--      a platform `decisions` row. NO foreign key to `decisions` — Decisions
--      is a separate, single-canonical-domain-owner module with its own
--      governance; a hard FK would be exactly the structural-parent coupling
--      the AC explicitly forbids ("Decision NIE staje się rodzicem
--      strukturalnym OKR"), even though both tables live in the same
--      physical database. Mirrors `rvn_roi_finance_links`' own shape
--      (ROI-E007 §3: pinned reference, no FK, own governance).
--   3. idx_okr_vnext_sets_org_attention — OKR-F-020-AC-01. Index-only
--      addition to the existing (OKR-E002-owned) okr_vnext_sets table — no
--      new table for the Manager attention queue (design §9.3: "a read-model,
--      not a new aggregate").
--
-- Re-verification against actually-landed code (design §7's standing
-- requirement, IO-1): okr_vnext_objectives/okr_vnext_key_results (OKR-E003)
-- ARE landed as of this migration (server/migrations/20260824_rvn_okr_
-- objective_key_result.sql) — so, UNLIKE the design draft's own placeholder
-- comment ("FK added once OKR-E003 lands"), objective_id/key_result_id below
-- carry REAL foreign keys from day one, not bare UUID columns.
-- ============================================================

-- ============================================================
-- okr_vnext_support_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_support_requests (
  request_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  set_id                       UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  objective_id                   UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  key_result_id                    UUID NULL REFERENCES okr_vnext_key_results(key_result_id),

  kind                                TEXT NOT NULL CHECK (kind IN ('comment','recognition','support_request')),
  body                                TEXT NOT NULL,

  -- Optional link back to the check-in whose blocker/support_requested text
  -- prompted this structured request (plan §4.7 relationship) — never
  -- required, a support request may also be raised standalone.
  origin_checkin_id                     UUID NULL REFERENCES okr_vnext_checkins(checkin_id),

  -- Lifecycle — NULL for kind IN ('comment','recognition'); NOT NULL for
  -- kind='support_request'. Enforced by the CHECK below, not by two tables.
  status                                  TEXT NULL CHECK (
                                             (kind = 'support_request' AND status IN ('open','acknowledged','resolved','dismissed'))
                                             OR (kind <> 'support_request' AND status IS NULL)
                                           ),
  assigned_to_user_id                        TEXT NULL,
  acknowledged_by                              TEXT NULL,
  acknowledged_at                              TIMESTAMPTZ NULL,
  resolved_by                                  TEXT NULL,
  resolved_at                                  TIMESTAMPTZ NULL,
  resolution_note                              TEXT NULL,
  dismissed_reason                             TEXT NULL,

  -- Set once requestDecisionFromSupportRequest escalates this request into a
  -- real platform Decision. No FK — okr_vnext_decision_links (below) is a
  -- sibling table in the SAME migration, not a cross-domain reference.
  decision_link_id                              UUID NULL,

  -- kind='recognition' only — recognition is "professional and
  -- policy-governed" (plan §13); the Program's recognition_enabled flag is
  -- checked at write time (fail-closed) — this column just records the
  -- resulting visibility class for read-side rendering, not a second gate.
  recognition_visibility                          TEXT NULL CHECK (recognition_visibility IS NULL OR recognition_visibility IN ('team','organization')),

  row_version                                       INT NOT NULL DEFAULT 1,
  created_by                                        TEXT NOT NULL,
  created_at                                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_set
  ON okr_vnext_support_requests(organization_id, set_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_objective
  ON okr_vnext_support_requests(organization_id, objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_kr
  ON okr_vnext_support_requests(organization_id, key_result_id) WHERE key_result_id IS NOT NULL;
-- MyWork "respond to support request" lookup — kind-filtered, open/acknowledged only.
CREATE INDEX IF NOT EXISTS idx_okr_vnext_support_requests_assignee_open
  ON okr_vnext_support_requests(organization_id, assigned_to_user_id, status)
  WHERE kind = 'support_request' AND status IN ('open','acknowledged');

REVOKE DELETE ON okr_vnext_support_requests FROM PUBLIC;  -- soft lifecycle only (resolved/dismissed)

-- ============================================================
-- okr_vnext_decision_links — see file header for the "no FK to decisions"
-- rationale.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_decision_links (
  link_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           TEXT NOT NULL,
  set_id                     UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  support_request_id         UUID NOT NULL REFERENCES okr_vnext_support_requests(request_id),
  objective_id                UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  key_result_id                 UUID NULL REFERENCES okr_vnext_key_results(key_result_id),

  decision_id                    TEXT NOT NULL,  -- decisions.id (TEXT PK) — no FK, see header

  requested_decision               TEXT NOT NULL,  -- plan §13: "requested decision"
  impact_of_delay                   TEXT NOT NULL,  -- plan §13: "impact of delay"
  desired_date                       DATE NULL,      -- plan §13: "desired date"

  -- OKR's own record of whether it has observed+eventized the resolution
  -- yet. NOT authoritative for the Decision's real status — reads always
  -- live-JOIN to `decisions` for that (same physical database, no staleness
  -- problem the way ROI-E007's cross-system Finance seam has).
  resolution_acknowledged             BOOLEAN NOT NULL DEFAULT false,
  resolution_acknowledged_by           TEXT NULL,
  resolution_acknowledged_at           TIMESTAMPTZ NULL,

  requested_by                          TEXT NOT NULL,
  requested_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version                           INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_decision_links_set
  ON okr_vnext_decision_links(organization_id, set_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_decision_links_support_request
  ON okr_vnext_decision_links(support_request_id);  -- one Decision per support request
CREATE INDEX IF NOT EXISTS idx_okr_vnext_decision_links_unacknowledged
  ON okr_vnext_decision_links(organization_id) WHERE resolution_acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_okr_vnext_decision_links_decision_id
  ON okr_vnext_decision_links(decision_id);

REVOKE DELETE ON okr_vnext_decision_links FROM PUBLIC;

-- ============================================================
-- OKR-F-020-AC-01 — Manager attention queue read-model. Index-only addition
-- to the existing (OKR-E002-owned) okr_vnext_sets table — closes the gap
-- design §9.3 names: none of okr_vnext_sets' existing three indexes
-- (org_cycle_status / org_owner / org_scope, all from OKR-E002's own
-- migration) cover attention_state.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_org_attention
  ON okr_vnext_sets(organization_id, attention_state)
  WHERE attention_state <> 'none';
