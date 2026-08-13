-- CW-P05 (Case Workspace, EPIC E6 "Proposals, autonomy and approvals") — two
-- new tables: `case_workspace_action_proposals` and
-- `case_workspace_action_proposal_decisions`.
--
-- Collision-avoidance (same mandate as CW-P01's
-- 20260809_case_workspace_case_core.sql, CW-P02's
-- 20260809_case_workspace_case_plan_version.sql, CW-P03's
-- 20260809_case_workspace_capability_registry.sql and CW-P04's
-- 20260809_case_workspace_run_binding.sql): this migration does NOT alter
-- `case_core`, `case_plan_versions`, `case_workspace_capabilities` or
-- `v8_execution_runs` in any way (no ALTER TABLE, no new column on any of
-- them — they are read-only referenced via FK-only, never altered), and does
-- not reference Finance or Results tables/routes at all. It only adds two new
-- tables, both namespaced `case_workspace_*` per the coordinator's mandate.
--
-- Scope note: this packet persists the proposal/decision state machine and
-- its own local invalidation/no-self-approval enforcement only. It does NOT
-- implement the A0-A4 execution-class classification logic for real
-- capabilities (that depends on CW-P03's capability registry having real
-- registered capabilities with effect classes — future work), does NOT build
-- the Chat/Teresa integration (E8), and `node_run_id` is stored as opaque
-- unenforced TEXT because no confirmed canonical NodeRun table exists in this
-- codebase (v8_agent_branch_tasks.task_id is only a "loose analogy" per
-- CW-P04's own hedge in 20260809_case_workspace_run_binding.sql — see
-- open_questions in proposalApprovalService.ts).
--
-- Ground truth for the columns below (docs/product/case-workspace/
-- acceptance/FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains
-- "E6"):
--   CW-RT-022 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:146) — ActionProposal
--     schema (proposalId, organizationId, projectId?, caseId, runId,
--     nodeRunId, proposalVersion, payloadDigest, targetExpectedVersion?,
--     policySnapshotRef, effectClass, previewRef, status, expiresAt?,
--     createdAt) and ApprovalDecision schema (decisionId, proposalId,
--     proposalVersion, payloadDigest, decision, decidedBy, decidedAt, source,
--     authenticationAssurance, approvalChannelPolicy, conversationId?,
--     sourceMessageId?, sourceMessageDigest?, policyVersion,
--     membershipSnapshotRef?, reason?, idempotencyKey, createdAt) -> the two
--     tables below, field for field.
--   CW-01-013 (01_PRODUCT_CANON_AND_MODES.md:90) — Proposal is an exact
--     proposed mutation or plan change; material mutation requires a
--     policy-compliant decision -> a proposal row is immutable once created
--     (no update-draft method exists in proposalApprovalService.ts), so a
--     "proposed mutation" can never silently drift after the fact.
--   CW-RT-041 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:286) — Proposal state
--     machine: DRAFT -> PENDING_REVIEW -> APPROVED -> EXECUTING -> EXECUTED
--     -> AUDITED; PENDING_REVIEW -> REJECTED | REQUESTED_CHANGES;
--     PENDING_REVIEW -> PENDING_REVIEW [approvalState=EXPIRED; new decision
--     required]; APPROVED -> REVOKED [before execution where policy
--     permits]; EXECUTING -> FAILED -> APPROVED [controlled idempotent
--     retry] -> `status` CHECK constraint enumerates exactly these ten
--     values; the EXPIRED self-loop is deliberately NOT a stored status (see
--     computeProposalExpiryState() in the service — a pure overlay computed
--     from `expires_at`, not a persisted transition).
--   CW-RT-023 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:165) — changing
--     payload, target version or plan version invalidates approval -> there
--     is no UPDATE method against case_workspace_action_proposals anywhere in
--     the service; a correction is a brand-new row referencing the old one
--     via `supersedes_action_proposal_id`, so payload/target/plan-version
--     fields are structurally immutable post-creation. recordApprovalDecision
--     additionally re-checks the caller-supplied proposalVersion/
--     payloadDigest against the live row before accepting a decision.
--   CW-RT-053 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:323) / CW-CANON-09
--     (13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md:43) — approval
--     binds exact proposal ID/version/digest, target version, actor, policy
--     and authority; approval and execution are separate facts ->
--     case_workspace_action_proposal_decisions snapshots proposal_version/
--     payload_digest/target_expected_version VERBATIM at decision time
--     (never re-derived from a later read), and EXECUTING/EXECUTED are always
--     two distinct, separately-recorded status transitions (CW-RT-042) —
--     nothing here ever collapses APPROVE straight into "executed".
--   CW-CANON-10 (13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md:45) —
--     conversational confirmation is limited to exact Chat-to-Case and
--     A0/A1; A2 execution requires an explicit control or an already
--     published plan policy -> `source` CHECK ('BUTTON', 'CONVERSATIONAL',
--     'POLICY') records which channel produced a decision, feeding this rule
--     at a future route layer (this packet does not itself enforce which
--     source is legal for which effect_class — that classification logic is
--     explicitly out of scope, see proposalApprovalService.ts header).
--   GOV-022 (08_GOVERNANCE_AUTONOMY_APPROVALS.md:106) — A3 hard ceiling:
--     approval cannot be inferred from chat/silence/prior approval of another
--     version, no self-approval by Teresa or the proposing agent, no
--     execution outside the approved target/scope/amount/recipients/time
--     window -> `created_by_actor_id` on the proposal and
--     `decided_by_actor_id` on the decision together let the service reject
--     decision='APPROVE' where decided_by_actor_id ==
--     proposal.created_by_actor_id (recordApprovalDecision's
--     self_approval_forbidden check). CW-01-026-INV4
--     (01_PRODUCT_CANON_AND_MODES.md:157) — "AI proposes; authorized humans
--     decide material gates" — is the cross-mode invariant this hard ceiling
--     specializes.
--   CW-RT-060 (04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:335) / CW-GR-021
--     (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:132) — duplicate
--     dispatch/callback/approval produces one business effect;
--     CommandEnvelope carries idempotencyKey + actor -> `idempotency_key`
--     NOT NULL on both tables, each with its own UNIQUE constraint scoped to
--     its own natural parent (case_id for proposals, action_proposal_id for
--     decisions) — see the per-table notes below. MIG-019
--     (07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md:191) — "double approval/
--     execute yields one action" restates the same requirement for this
--     specific aggregate family.
--   CW-GR-028 (05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md:200) — decision
--     requests carry proposalVersion, payloadDigest and idempotency key; a
--     stale decision returns 409 STALE_PROPOSAL with no side effect ->
--     recordApprovalDecision's proposal_stale check (service-level, not a DB
--     constraint, since it compares caller input against the live row inside
--     one transaction).
--   CW-00-020-INV11 (00_CASE_WORKSPACE_CANON.md:106) — Invariant 11: approval
--     is bound to an exact proposal version and material digest -> same
--     verbatim-snapshot columns as CW-RT-053/CW-CANON-09 above.
--   CW-DOD-C3 (14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md:244) —
--     secrets never enter graph JSON, ordinary logs or client state ->
--     `payload_digest` stores only a caller-supplied sha256-shaped digest of
--     the mutation payload, never the payload itself; `policy_snapshot_ref`
--     and `preview_ref` are opaque pointers, not rendered content.
--   CW-02-034 (02_INFORMATION_ARCHITECTURE_AND_UX.md:295) / CW-03-014
--     (03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md:99) — an approval card
--     needs a semantic diff, impact/reversibility/risk, evidence,
--     requester/owner/expiry and, after decision, an immutable receipt with
--     actor/timestamp/decision ID/plan-or-proposal version/audit link ->
--     `preview_ref` is where that rendered diff is expected to live (not
--     built by this packet); listDecisionsForProposal() in the service
--     returns the append-only decision history that IS that immutable
--     receipt trail.
--
-- `effect_class` on case_workspace_action_proposals reuses
-- CapabilityEffectClass BY REFERENCE from case_workspace_capabilities.
-- effect_class (CW-P03) — same enum, same CHECK values, not a duplicated
-- vocabulary (see casePlanVersionService's own ApprovalClass-by-reference
-- precedent, extended here).
--
-- Style follows 20260809_case_workspace_case_core.sql,
-- 20260809_case_workspace_case_plan_version.sql,
-- 20260809_case_workspace_capability_registry.sql and
-- 20260809_case_workspace_run_binding.sql exactly: TEXT ids, CHECK-constrained
-- enum columns, TEXT timestamps via CURRENT_TIMESTAMP, CREATE TABLE/INDEX IF
-- NOT EXISTS throughout so this file is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS case_workspace_action_proposals (
  -- Own row identity, minted `cwprop-${uuid}`.
  action_proposal_id TEXT PRIMARY KEY,

  -- CW-RT-022 organizationId. Denormalized from case_core.organization_id at
  -- create, service-verified, never independently mutated (no UPDATE method
  -- against this table touches it).
  organization_id TEXT NOT NULL,

  -- CW-RT-022 projectId? — optional, denormalized from case_core.project_id
  -- at create.
  project_id TEXT,

  -- The owning Case. FK-only into CW-P01's own table, read-only referenced,
  -- never altered. No ON DELETE clause (defaults to RESTRICT/NO ACTION) —
  -- mirrors run_bindings' own posture toward case_core.
  case_id TEXT NOT NULL
    REFERENCES case_core(case_id),

  -- CW-RT-022's runId has no '?' — literal required field. FK-only into
  -- v8_execution_runs (CW-P04's own read-only reference target), never
  -- altered here. No ON DELETE clause.
  run_id TEXT NOT NULL
    REFERENCES v8_execution_runs(run_id),

  -- CW-RT-022's nodeRunId, also literal-required. Opaque, UNENFORCED TEXT —
  -- deliberately no FK. No confirmed canonical NodeRun table exists anywhere
  -- in this codebase; v8_agent_branch_tasks.task_id is only a "loose
  -- analogy" per CW-P04's own hedge (20260809_case_workspace_run_binding.sql
  -- header). See proposalApprovalService.ts open_questions.
  node_run_id TEXT NOT NULL,

  -- CW-RT-022's own domain ordinal (NOT the OCC counter below). Computed as
  -- MAX(proposal_version) WHERE case_id=? + 1 by default, or
  -- supersedes.proposal_version + 1 when supersedes_action_proposal_id is
  -- set — mirrors case_plan_versions.plan_number's numbering precedent.
  -- Numbering scheme inferred, not specified by canon (open_question).
  proposal_version INTEGER NOT NULL DEFAULT 1,

  -- Self-referencing lineage link for a corrected resubmission after
  -- REQUESTED_CHANGES/REJECTED/REVOKED/FAILED, mirroring
  -- case_plan_versions.supersedes_plan_version_id (CW-P02). No ON DELETE
  -- clause — a proposal a later correction points back to cannot be
  -- hard-deleted out from under it.
  supersedes_action_proposal_id TEXT
    REFERENCES case_workspace_action_proposals(action_proposal_id),

  -- Caller-supplied `sha256:<hex>`-shaped digest of the (never-stored)
  -- mutation payload — CW-DOD-C3. This service never receives or persists
  -- the raw payload itself.
  payload_digest TEXT NOT NULL,

  -- CW-RT-022's optional targetExpectedVersion? — the OCC expectation of
  -- whatever module aggregate this proposal's eventual execution will
  -- mutate. Opaque and module-agnostic; this packet does not verify it
  -- (open_question — see proposalApprovalService.ts).
  target_expected_version INTEGER,

  -- Opaque reference to the policy snapshot this proposal was evaluated
  -- against. No canon-defined shape (open_question), stored verbatim.
  policy_snapshot_ref TEXT NOT NULL,

  -- Reuses CapabilityEffectClass (CW-P03's case_workspace_capabilities.
  -- effect_class) BY REFERENCE — same CHECK values, not duplicated as a
  -- second source of truth.
  effect_class TEXT NOT NULL
    CHECK (effect_class IN (
      'SAFE_ADDITIVE', 'SAFE_UPDATE', 'SENSITIVE_UPDATE', 'DESTRUCTIVE', 'GOVERNANCE_TRANSITION'
    )),

  -- Opaque reference to wherever the human-renderable semantic diff/preview
  -- (CW-02-034, CW-03-014) is materialized. Not built by this packet.
  preview_ref TEXT NOT NULL,

  -- Optional: which plan/version this proposal targets (packet scope).
  -- FK-only into CW-P02's own table, read-only referenced, never altered.
  case_plan_version_id TEXT
    REFERENCES case_plan_versions(case_plan_version_id),

  -- Optional: which capability this proposal wants to invoke (packet
  -- scope). FK-only into CW-P03's own table, read-only referenced, never
  -- altered.
  capability_registry_id TEXT
    REFERENCES case_workspace_capabilities(capability_registry_id),

  -- CW-RT-041's literal state machine, verbatim.
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'EXECUTING', 'EXECUTED', 'AUDITED',
      'REJECTED', 'REQUESTED_CHANGES', 'REVOKED', 'FAILED'
    )),

  -- CW-RT-022's optional expiresAt?. Governs the PENDING_REVIEW self-loop —
  -- blocks a late APPROVE decision once passed (see
  -- computeProposalExpiryState() / recordApprovalDecision's
  -- proposal_review_window_expired check in the service). Never itself
  -- transitions `status` — the EXPIRED overlay is computed, not persisted.
  expires_at TEXT,

  -- CreateActionProposal command's own idempotency key (CW-GR-021,
  -- CW-RT-060). Scoped per Case — see the UNIQUE constraint below.
  idempotency_key TEXT NOT NULL,

  -- Who/what proposed this — required for recordApprovalDecision's
  -- no-self-approval check (GOV-022).
  created_by_actor_id TEXT NOT NULL,

  -- Mirrors CommandEnvelope actor.type (CW-GR-021); clarifies who created
  -- the proposal for approval-semantics reasoning.
  proposer_type TEXT NOT NULL
    CHECK (proposer_type IN ('HUMAN', 'AGENT', 'SYSTEM')),

  -- Optimistic concurrency counter for status transitions — a THIRD
  -- distinct "version"-shaped concept alongside proposal_version and
  -- target_expected_version (open_question, same naming-collision precedent
  -- CW-P02/CW-P03 already flagged).
  version INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- CreateActionProposal's own idempotency scope (CW-GR-021/CW-RT-060): a
  -- duplicate dispatch for the same Case with the same idempotency key
  -- produces one row, enforced via `INSERT ... ON CONFLICT (case_id,
  -- idempotency_key) DO NOTHING RETURNING *` in createActionProposal, same
  -- convention as capabilityRegistryService.ts's recordIdempotencyKeyCheck.
  CONSTRAINT case_workspace_action_proposals_idempotency_unique
    UNIQUE (case_id, idempotency_key)
);

-- Primary read path: enumerate a Case's proposals (listActionProposalsForCase).
CREATE INDEX IF NOT EXISTS idx_case_workspace_action_proposals_case_id
  ON case_workspace_action_proposals (case_id);

-- GET /api/runs/:runId/proposals (CW-GR-026) — listActionProposalsForRun.
CREATE INDEX IF NOT EXISTS idx_case_workspace_action_proposals_run_id
  ON case_workspace_action_proposals (run_id);

-- Status-filtered list queries (listActionProposalsForCase filters?.status).
CREATE INDEX IF NOT EXISTS idx_case_workspace_action_proposals_status
  ON case_workspace_action_proposals (status);

-- Lineage-chain lookups (supersedes_action_proposal_id resolution in
-- createActionProposal).
CREATE INDEX IF NOT EXISTS idx_case_workspace_action_proposals_supersedes
  ON case_workspace_action_proposals (supersedes_action_proposal_id);

-- CW-RT-022's ApprovalDecision schema, append-only. Every row is an
-- immutable audit fact — this migration defines no UPDATE/DELETE-eligible
-- column set and proposalApprovalService.ts defines no update/delete method
-- against this table.
CREATE TABLE IF NOT EXISTS case_workspace_action_proposal_decisions (
  -- Own row identity, minted `cwpropdec-${uuid}`.
  decision_id TEXT PRIMARY KEY,

  -- The proposal this decision was made against. FK-only, ON DELETE CASCADE
  -- so a hard-deleted proposal (not expected in normal operation, since
  -- proposals are otherwise never deleted) cannot leave orphaned decision
  -- rows — same posture as
  -- case_workspace_capability_idempotency_keys -> case_workspace_capabilities
  -- (CW-P03).
  action_proposal_id TEXT NOT NULL
    REFERENCES case_workspace_action_proposals(action_proposal_id) ON DELETE CASCADE,

  -- Snapshot of proposal.proposal_version at decision time — never
  -- re-derived, copied verbatim (CW-RT-053, CW-CANON-09, CW-00-020-INV11).
  proposal_version INTEGER NOT NULL,

  -- Snapshot of proposal.payload_digest at decision time — same verbatim
  -- posture.
  payload_digest TEXT NOT NULL,

  -- Snapshot of proposal.target_expected_version at decision time.
  target_expected_version INTEGER,

  -- CW-RT-022's ApprovalDecision.decision enum.
  decision TEXT NOT NULL
    CHECK (decision IN ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DEFER')),

  -- The human who decided — checked against
  -- case_workspace_action_proposals.created_by_actor_id for the
  -- no-self-approval enforcement (GOV-022).
  decided_by_actor_id TEXT NOT NULL,

  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- CW-RT-022's ApprovalDecision.source — feeds CW-CANON-10's
  -- conversational-confirmation-limits check at a future route layer (this
  -- packet only records the value, does not itself enforce which source is
  -- legal for which effect_class).
  source TEXT NOT NULL
    CHECK (source IN ('BUTTON', 'CONVERSATIONAL', 'POLICY')),

  -- Opaque assurance-level marker. No canon-defined vocabulary anywhere in
  -- docs/product/case-workspace/*.md (open_question — same gap pattern
  -- CW-P03 already flagged for data_classification/idempotency_strategy/
  -- reversibility).
  authentication_assurance TEXT NOT NULL,

  -- Opaque reference to the channel policy applied. No canon-defined
  -- vocabulary (open_question).
  approval_channel_policy TEXT NOT NULL,

  -- Optional Chat-to-Case linkage (E8, out of this packet's scope to wire up
  -- — columns exist for the future integration to populate).
  conversation_id TEXT,
  source_message_id TEXT,
  source_message_digest TEXT,

  -- Which governance policy version was in force at decision time.
  policy_version TEXT NOT NULL,

  -- Optional snapshot of the decider's role/membership at decision time
  -- (CW-DOD-D5/CW-RT-065 fail-closed evidence trail — not itself enforced by
  -- this service layer, see proposalApprovalService.ts open_questions).
  membership_snapshot_ref TEXT,

  -- Optional human-readable rationale, especially for REJECT/
  -- REQUEST_CHANGES.
  reason TEXT,

  -- RecordApprovalDecision command's own idempotency key (CW-GR-021,
  -- CW-RT-060, MIG-019). Scoped per proposal — see the UNIQUE constraint
  -- below.
  idempotency_key TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- RecordApprovalDecision's own idempotency scope: a duplicate dispatch for
  -- the same proposal with the same idempotency key produces one row,
  -- enforced via `INSERT ... ON CONFLICT (action_proposal_id,
  -- idempotency_key) DO NOTHING RETURNING *` in recordApprovalDecision, same
  -- convention as capabilityRegistryService.ts's recordIdempotencyKeyCheck.
  CONSTRAINT case_workspace_action_proposal_decisions_idempotency_unique
    UNIQUE (action_proposal_id, idempotency_key)
);

-- Primary read path: chronological decision history for one proposal
-- (listDecisionsForProposal) — the immutable receipt trail behind CW-02-034/
-- CW-03-014's approval card.
CREATE INDEX IF NOT EXISTS idx_case_workspace_action_proposal_decisions_proposal_id
  ON case_workspace_action_proposal_decisions (action_proposal_id);
