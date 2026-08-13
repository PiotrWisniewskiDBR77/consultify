-- CW-P09 (Case Workspace, EPIC E10 "Artifacts, evidence and deliverables")
-- — one new table: `case_workspace_artifact_links`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql, CW-P03's
-- 20260809_case_workspace_capability_registry.sql, CW-P04's
-- 20260809_case_workspace_run_binding.sql, CW-P05's
-- 20260809_case_workspace_proposals_approvals.sql, CW-P06's
-- 20260809_case_workspace_wait_subscription.sql and CW-P07's
-- 20260809_case_workspace_history_value.sql): this migration does NOT alter
-- `case_core`, `case_plan_versions`, `case_workspace_capabilities`,
-- `case_workspace_run_bindings`, `case_workspace_action_proposals`,
-- `case_workspace_waits`, `case_workspace_history_events` or
-- `case_workspace_value_measurements` in any way (no ALTER TABLE, no new
-- column on any of them), and does not reference Finance or Results
-- tables/routes at all. It only adds one new table, namespaced
-- `case_workspace_*` per the coordinator's mandate.
--
-- Scope note: this packet is CaseArtifactLink persistence only (CW-RT-024's
-- first schema). CW-RT-024's second named schema, EvidenceRecord
-- (evidenceId, caseId, sourceType, sourceId, sourceRevision, contentDigest,
-- relation, provenanceStatus, rightsStatus, classification, capturedAt,
-- capturedBy), is explicitly OUT of scope — it adds rights/provenance/
-- classification fields CW-RT-025's "UNKNOWN rights or provenance stays
-- unknown and blocks promotion" clause depends on, which this table does not
-- model. Flagged as an open question for a future packet, same carve-out
-- pattern as CW-P07's own Monitoring-Case-split deferral.
--
-- The only FK on this table is `case_id -> case_core(case_id)`, read-only
-- referenced (mirrors case_workspace_value_measurements' posture toward
-- case_core, CW-P07). `artifact_type`/`artifact_id` carry deliberately NO FK
-- — dozens of heterogeneous native-module artifact tables exist today
-- (documents, decisions, initiatives, KPIs, presentations, and more), and
-- this table cannot and must not FK into all of them (CW-CANON-04,
-- CW-00-020-INV4: Case references module artifacts and never forks their
-- business truth). This table stores NO copy of any artifact's business
-- content — only typed pointers plus link-lifecycle metadata
-- (CW-01-015, CW-01-OD7).
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E10" AND row_id starts with "CW-"):
--   CW-RT-024 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:176) — literal
--     CaseArtifactLink schema: linkId, caseId, artifactType, artifactId,
--     artifactRevision?, relation (INPUT|OUTPUT|EVIDENCE|DECISION_BASIS|
--     DELIVERABLE|OUTCOME_MEASUREMENT), linkedBy, linkedAt -> link_id,
--     case_id, artifact_type, artifact_id, artifact_revision, relation,
--     linked_by_actor_id, linked_at below, verbatim.
--   CW-RT-025 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:190) — "Late binding
--     creates a link, not a copy or ownership transfer. Unlinking never
--     deletes the artifact. Historical decisions retain an immutable
--     revision/digest." -> unlinkArtifactFromCase/markLinkArtifactUnavailable
--     in the service are both UPDATEs to link_status, never a SQL DELETE
--     against this table; artifact_revision only ever advances via
--     pinArtifactRevision(), with every prior value preserved in
--     revision_pin_history (append-only JSON), never overwritten-and-lost.
--   CW-00-016 (00_CASE_WORKSPACE_CANON.md:84) / CW-00-020-INV4
--     (00_CASE_WORKSPACE_CANON.md:99) / CW-01-OD7
--     (01_PRODUCT_CANON_AND_MODES.md:28) / CW-01-015
--     (01_PRODUCT_CANON_AND_MODES.md:92) — artifacts stay owned by their
--     native module; Case never forks or copies business truth; a module
--     object can be attached later without copying it or changing its
--     canonical identity -> no column here holds document text, decision
--     rationale, KPI values or any other module's field; artifact_id/
--     artifact_type carry no FK (see above).
--   CW-RT-054 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:324) — "Artifact
--     links do not change module ownership." / CW-RT-063
--     (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:338) — "late binding shows
--     one module object and one Case link, never a copy." / CW-CANON-04
--     (13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md:36) — "Native
--     modules own artifacts and mutations. Case stores typed links and
--     pinned revisions/digests, never copied business truth." / CW-DOD-A5
--     (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:223) — "Owning
--     modules retain artifact identity and mutation authority." -> the
--     no-FK-into-module-tables design above is the structural enforcement of
--     all four.
--   CW-01-026-INV9 (01_PRODUCT_CANON_AND_MODES.md:162) — "Changed upstream
--     evidence marks downstream work stale" -> is_stale/stale_marked_at/
--     stale_marked_by_actor_id/stale_reason are first-class, independently
--     queryable columns, set only by markLinkStale() and cleared only by a
--     subsequent pinArtifactRevision() — a stored fact, never inferred or
--     hidden.
--   CW-01-026-INV7 (01_PRODUCT_CANON_AND_MODES.md:160) — "Source, fact,
--     assumption, inference and decision remain distinguishable" ->
--     `relation`'s literal 6-value CHECK enum (INPUT/OUTPUT/EVIDENCE/
--     DECISION_BASIS/DELIVERABLE/OUTCOME_MEASUREMENT) is this table's
--     concrete home for that distinction at the link level.
--   CW-03-017 (03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:120) — "An
--     unavailable/deleted deliverable source is rendered as unavailable
--     with provenance and recovery guidance; it is not silently removed
--     from lineage" -> link_status='UNAVAILABLE' plus
--     unavailable_marked_at/unavailable_marked_by_actor_id/
--     unavailable_reason let markLinkArtifactUnavailable() record that fact
--     as an UPDATE, never a DELETE — the row (and its full
--     revision_pin_history) stays queryable as history.
--   CW-01-029 (01_PRODUCT_CANON_AND_MODES.md:197) — DoD: "the same native
--     object can be linked into one Case without duplication" -> the partial
--     unique index on (case_id, artifact_type, artifact_id, relation) WHERE
--     link_status='ACTIVE' below prevents duplicate concurrently-active
--     links for the same tuple while still permitting re-linking after an
--     unlink (a fresh row, old row preserved as history).
--   CW-RT-013 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:71) / CW-RT-043
--     (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:298, durable command set
--     incl. LinkArtifactToCase/PinArtifactRevisionAsEvidence/
--     UnlinkArtifactFromCase) / CW-GR-033
--     (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:230, Artifacts and
--     evidence API) -> this table is the persistence this packet's service
--     methods (linkArtifactToCase/pinArtifactRevision/markLinkStale/
--     markLinkArtifactUnavailable/unlinkArtifactFromCase/getArtifactLink/
--     listArtifactLinksForCase) back; the HTTP route layer itself is out of
--     this packet's scope (see the service file's own open_questions).
--   CW-02-031 (02_INFORMATION_ARCHITECTURE_AND_UX.md:269) / CW-01-004
--     (01_PRODUCT_CANON_AND_MODES.md:59) — Rezultaty's required "evidence
--     and lineage" group; a Case "references to evidence and native
--     deliverables" -> listArtifactLinksForCase (service) includes
--     UNLINKED/UNAVAILABLE rows unless the caller filters them out, so a
--     lineage view can see full history, not just what is currently ACTIVE.
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql,
-- 20260809_case_workspace_capability_registry.sql,
-- 20260809_case_workspace_run_binding.sql,
-- 20260809_case_workspace_proposals_approvals.sql,
-- 20260809_case_workspace_wait_subscription.sql and
-- 20260809_case_workspace_history_value.sql exactly: TEXT ids,
-- CHECK-constrained enum columns (relation, link_status — both closed lists,
-- unlike case_workspace_history_events' deliberately open event_type), TEXT
-- timestamps (app-level writes always pass `new Date().toISOString()`;
-- `DEFAULT CURRENT_TIMESTAMP` below is a schema-level fallback only, never
-- relied upon by the service), CREATE TABLE/INDEX IF NOT EXISTS throughout
-- so this file is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_artifact_links (
  -- Own row identity, minted `cwlink-${uuid}`. CW-RT-024's literal `linkId`.
  link_id TEXT PRIMARY KEY,

  -- Denormalized from case_core.organization_id at insert time
  -- (service-verified plain SELECT, never altered) — same convention as
  -- case_workspace_value_measurements (CW-P07).
  organization_id TEXT NOT NULL,

  -- Denormalized from case_core.project_id at insert time, display
  -- convenience only. No FK.
  project_id TEXT,

  -- The owning Case. FK-only, read-only referenced, no ON DELETE clause —
  -- mirrors run_bindings'/proposals'/waits'/value_measurements' own posture
  -- toward case_core. CW-RT-024's literal `caseId`.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- Open, non-CHECK-enum string naming the owning module's object kind
  -- ('decision', 'initiative', 'document', 'kpi', 'presentation', etc.).
  -- Deliberately NOT a CHECK enum — same open-catalog precedent as
  -- case_workspace_history_events.event_type (CW-P07) — because dozens of
  -- module artifact kinds exist today and more will be added without this
  -- packet's migration in the loop. A KNOWN_ARTIFACT_TYPES TS constant in
  -- the service documents the known set for type-safe callers; validated
  -- non-blank only at the DB/service layer. CW-RT-024's literal
  -- `artifactType`.
  artifact_type TEXT NOT NULL,

  -- The native module object's own primary key, as a plain opaque string.
  -- No FK — this table cannot and must not FK into every module's artifact
  -- table (CW-CANON-04, CW-00-020-INV4). CW-RT-024's literal `artifactId`.
  artifact_id TEXT NOT NULL,

  -- Current pinned revision/digest for this link, an opaque value the
  -- caller supplies (this packet has no knowledge of any module's own
  -- revisioning scheme). Null means the link exists but nothing has been
  -- pinned yet (e.g. a loose INPUT reference). Updated only by
  -- pinArtifactRevision(); every prior value is preserved in
  -- revision_pin_history below, never overwritten-and-lost, which is how
  -- CW-RT-025's "historical decisions retain an immutable revision/digest"
  -- holds even though the "current" pointer can move forward. CW-RT-024's
  -- literal, optional `artifactRevision?`.
  artifact_revision TEXT,

  -- JSON array of {revision, pinnedAt, pinnedByActorId, reason},
  -- append-only — same pattern as case_core.governance_tier_history
  -- (CW-P01). Every pin (including the one made at link time, if any) is
  -- appended here and never rewritten or removed, so an old pinned digest a
  -- decision was based on stays discoverable even after a newer pin lands.
  revision_pin_history TEXT NOT NULL DEFAULT '[]',

  -- CW-RT-024's literal enum, verbatim. This is the field that gives
  -- CW-01-026-INV7's "source, fact, assumption, inference and decision
  -- remain distinguishable" a concrete home at the link level — EVIDENCE vs
  -- DECISION_BASIS vs INPUT/OUTPUT/DELIVERABLE/OUTCOME_MEASUREMENT are
  -- structurally different relation values on the same row shape, never
  -- conflated into one generic "reference" kind.
  relation TEXT NOT NULL
    CHECK (relation IN (
      'INPUT', 'OUTPUT', 'EVIDENCE', 'DECISION_BASIS', 'DELIVERABLE',
      'OUTCOME_MEASUREMENT'
    )),

  -- Row lifecycle state. ACTIVE = in effect; UNLINKED = case-side decision
  -- to stop using this link (CW-RT-025 — set by unlinkArtifactFromCase, row
  -- never deleted); UNAVAILABLE = the linked artifact itself is confirmed
  -- gone/inaccessible in its owning module (CW-03-017 — set by
  -- markLinkArtifactUnavailable, distinct cause from UNLINKED, row never
  -- deleted either). Both are terminal for this row; a fresh
  -- linkArtifactToCase() call creates a new row to re-establish the tuple,
  -- preserving the old row as history.
  link_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (link_status IN ('ACTIVE', 'UNLINKED', 'UNAVAILABLE')),

  -- CW-01-026-INV9's queryable fact: "this link's pinned revision is now
  -- behind the artifact's current revision." Set true only by
  -- markLinkStale() (an explicit call by whoever learns upstream evidence
  -- changed — this table cannot detect it on its own, it has no read
  -- access into any module's live state). Reset to false by a subsequent
  -- pinArtifactRevision() call, since re-pinning is what resolves
  -- staleness.
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamp of the most recent markLinkStale() call; cleared (set NULL)
  -- when is_stale resets on re-pin.
  stale_marked_at TEXT,

  -- Actor/system id that called markLinkStale(); cleared alongside
  -- stale_marked_at.
  stale_marked_by_actor_id TEXT,

  -- Free-text reason supplied to markLinkStale(); cleared alongside
  -- stale_marked_at.
  stale_reason TEXT,

  -- Set by unlinkArtifactFromCase(); never cleared once set (UNLINKED is
  -- terminal for this row).
  unlinked_at TEXT,

  -- Actor who unlinked.
  unlinked_by_actor_id TEXT,

  -- Free-text reason supplied to unlinkArtifactFromCase().
  unlink_reason TEXT,

  -- Set by markLinkArtifactUnavailable(); never cleared once set
  -- (UNAVAILABLE is terminal for this row).
  unavailable_marked_at TEXT,

  -- Actor/system that confirmed unavailability (e.g. a reconciliation job
  -- or a module-side deletion notification).
  unavailable_marked_by_actor_id TEXT,

  -- Free-text provenance/recovery-guidance text (CW-03-017 — rendered as
  -- "unavailable with provenance", not silently removed).
  unavailable_reason TEXT,

  -- CW-RT-024's literal `linkedBy` field.
  linked_by_actor_id TEXT NOT NULL,

  -- CW-RT-024's literal `linkedAt` field. Business time of link creation,
  -- app-supplied `new Date().toISOString()`, same convention as every other
  -- CW-P0x table's TEXT timestamps.
  linked_at TEXT NOT NULL,

  -- Optional idempotent-insert key for linkArtifactToCase();
  -- `ON CONFLICT (dedupe_key) DO NOTHING RETURNING *` then re-SELECT-by-
  -- dedupe_key-on-0-rows, same convention as caseHistoryService's
  -- insertHistoryEvent()/recordValueMeasurement() (CW-P07). NULL values
  -- never collide.
  dedupe_key TEXT,

  -- Optimistic-concurrency counter, incremented on every mutating call
  -- (pin/mark-stale/mark-unavailable/unlink), same `SELECT ... FOR UPDATE`
  -- + `WHERE version = ?` pattern as caseCoreService.ts (CW-P01). Never
  -- touched by inserts beyond the initial 1.
  version INTEGER NOT NULL DEFAULT 1,

  -- Row insert time.
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Bumped on every mutating call.
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT case_workspace_artifact_links_dedupe_key_unique
    UNIQUE (dedupe_key)
);

-- CW-01-029: at most one ACTIVE link may exist for a given
-- (case_id, artifact_type, artifact_id, relation) tuple at a time. A
-- partial unique index (not a blanket UNIQUE) is what lets a tuple be
-- re-linked after an unlink — the old UNLINKED/UNAVAILABLE row falls
-- outside this index and is preserved as history, while a fresh ACTIVE row
-- for the same tuple is still blocked from duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_workspace_artifact_links_active_tuple
  ON case_workspace_artifact_links (case_id, artifact_type, artifact_id, relation)
  WHERE link_status = 'ACTIVE';

-- Primary read path: a Case's full artifact-link set, including history
-- (listArtifactLinksForCase; CW-GR-033 GET /api/cases/:caseId/artifacts).
CREATE INDEX IF NOT EXISTS idx_case_workspace_artifact_links_case_id
  ON case_workspace_artifact_links (case_id);

-- Filtering a Case's link set by relation (e.g. only DECISION_BASIS links).
CREATE INDEX IF NOT EXISTS idx_case_workspace_artifact_links_case_relation
  ON case_workspace_artifact_links (case_id, relation);

-- Filtering by lifecycle state (e.g. only ACTIVE links feeding
-- computeArtifactLinkSetDigest, or only UNAVAILABLE links for a
-- CW-03-017-style "what went missing" surface).
CREATE INDEX IF NOT EXISTS idx_case_workspace_artifact_links_case_status
  ON case_workspace_artifact_links (case_id, link_status);

-- Filtering by staleness (CW-01-026-INV9 — "which links need a re-pin").
CREATE INDEX IF NOT EXISTS idx_case_workspace_artifact_links_case_stale
  ON case_workspace_artifact_links (case_id, is_stale);

-- Reverse-lookup: "which Cases link this exact module artifact" — useful
-- for a future module-side "where is this used" surface, without this
-- packet needing to build that surface itself.
CREATE INDEX IF NOT EXISTS idx_case_workspace_artifact_links_artifact
  ON case_workspace_artifact_links (artifact_type, artifact_id);
