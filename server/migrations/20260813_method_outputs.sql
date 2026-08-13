-- Shared Method Kernel — Outputs / Reports / Initiative Proposals (agent A8).
--
-- Persistence for src/method-core/outputs/ (immutable AssessmentOutput,
-- Finding, ReportSnapshot, PresentationSourceBlock-backing data, and
-- InitiativeProposalDraft). Layered on top of
-- server/migrations/20260813_method_core_kernel.sql — every row here traces
-- back to a `method_sessions` row and, for the Output itself, to the
-- `method_snapshots` row written on freeze.
--
-- Fully additive + idempotent: only CREATE TABLE IF NOT EXISTS and
-- CREATE INDEX IF NOT EXISTS. No DROP, no ALTER of existing columns, no
-- DELETE. Safe to re-run on a shared database. NOT executed against
-- demo/staging/production by this agent — additive-only so a future,
-- authorized migration run can apply it safely.
--
-- Every table is org-scoped (organization_id NOT NULL, FK to organizations).

-- ---------------------------------------------------------------------------
-- method_outputs — immutable, approved result of a frozen Process
-- (METHOD_MODULE_FIVE_SURFACES_STANDARD.md §4). No UPDATE statement is ever
-- issued against the content columns of this table by
-- server/src/method-core/outputs/MethodOutputService.ts — a correction is a
-- new freeze, i.e. a new row with revision_of_output_id pointing back.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_outputs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES method_snapshots(id) ON DELETE RESTRICT,
  module TEXT NOT NULL CHECK (module IN ('assessment', 'tools', 'audits')),
  method_pack_id TEXT NOT NULL,
  method_pack_version TEXT NOT NULL,
  output_version INTEGER NOT NULL DEFAULT 1,
  -- Backward pointer only. There is INTENTIONALLY no forward
  -- "superseded_by_output_id" column here: METHOD_MODULE_FIVE_SURFACES_
  -- STANDARD.md §4 ("nie można edytować historycznego Outputu") and
  -- ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §6 ("Reopen nie modyfikuje
  -- starego Outputu") together mean an Output row is INSERTed once and never
  -- UPDATEd again, ever — not even to add a "this was superseded" pointer.
  -- MethodOutputService.isSuperseded() resolves supersession by QUERYING for
  -- a newer output_version in the same lineage, not by writing one back.
  revision_of_output_id TEXT REFERENCES method_outputs(id) ON DELETE SET NULL,
  scope TEXT NOT NULL,
  current_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  gap_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  aggregation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_model_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_completeness_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Required, non-empty at the application layer (createAssessmentOutput /
  -- MethodOutputService.freezeOutput refuse an empty array) — kept JSONB
  -- here rather than NOT NULL + CHECK to match the array-of-string shape of
  -- every other *_json column in this schema.
  limitations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  prioritisation_json JSONB,
  lineage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_outputs_org ON method_outputs(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_outputs_session ON method_outputs(session_id);
CREATE INDEX IF NOT EXISTS ix_method_outputs_snapshot ON method_outputs(snapshot_id);
CREATE INDEX IF NOT EXISTS ix_method_outputs_revision_of ON method_outputs(revision_of_output_id);

-- ---------------------------------------------------------------------------
-- method_findings — unit-level findings belonging to one Output.
-- 10_ASSESSMENT_REVIEW.md §14 / ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §3.
-- `supporting_evidence_json` is REQUIRED non-empty at the application layer
-- (assertFindingIsValid) — see comment on limitations_json above for why
-- this is not a SQL CHECK on JSONB array length.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_findings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  output_id TEXT NOT NULL REFERENCES method_outputs(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  current_level NUMERIC,
  target_level NUMERIC,
  gap NUMERIC,
  supporting_evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradicting_evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_meaning TEXT NOT NULL,
  root_cause_hypothesis TEXT,
  risk_or_opportunity TEXT,
  recommendation TEXT NOT NULL,
  prerequisite TEXT,
  expected_outcome TEXT,
  kpi_proposal_json JSONB,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  priority_rationale TEXT,
  source_locators_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_findings_org ON method_findings(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_findings_output ON method_findings(output_id);
CREATE INDEX IF NOT EXISTS ix_method_findings_unit ON method_findings(unit_id);

-- ---------------------------------------------------------------------------
-- method_report_snapshots — 10_ASSESSMENT_REVIEW.md §15. Rendered strictly
-- from one method_outputs row. `status` is the ONLY column
-- MethodReportSnapshotService ever UPDATEs after insert (on a newer freeze
-- of the same lineage) — content_json/content_hash are never touched.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_report_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  output_id TEXT NOT NULL REFERENCES method_outputs(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded', 'source_updated')),
  superseded_by_output_id TEXT REFERENCES method_outputs(id) ON DELETE SET NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_report_snapshots_org ON method_report_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_report_snapshots_output ON method_report_snapshots(output_id);
CREATE INDEX IF NOT EXISTS ix_method_report_snapshots_session ON method_report_snapshots(session_id);
CREATE INDEX IF NOT EXISTS ix_method_report_snapshots_status ON method_report_snapshots(status);

-- ---------------------------------------------------------------------------
-- method_initiative_drafts — METHOD_MODULE_FIVE_SURFACES_STANDARD.md §6,
-- ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §5,
-- INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md.
--
-- ★ THIS TABLE HAS NO `initiative_id` / `registered_initiative_id` COLUMN.
-- That is deliberate, not an oversight: "Teresa może grupować, deduplikować
-- i proponować — ale NIE tworzy Registered Initiative. `Register as
-- Initiative` to decyzja człowieka." Registration is a write to the
-- Initiatives module's own tables (out of this migration's scope), driven
-- by a human action — never a column update here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS method_initiative_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  output_id TEXT NOT NULL REFERENCES method_outputs(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES method_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  -- Grouped findings this draft was built from — MUST be non-empty at the
  -- application layer (createInitiativeProposalDraft refuses zero findings).
  finding_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  kpi_proposal_json JSONB,
  dependencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_links_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded', 'source_updated')),
  superseded_by_output_id TEXT REFERENCES method_outputs(id) ON DELETE SET NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_method_initiative_drafts_org ON method_initiative_drafts(organization_id);
CREATE INDEX IF NOT EXISTS ix_method_initiative_drafts_output ON method_initiative_drafts(output_id);
CREATE INDEX IF NOT EXISTS ix_method_initiative_drafts_session ON method_initiative_drafts(session_id);
CREATE INDEX IF NOT EXISTS ix_method_initiative_drafts_status ON method_initiative_drafts(status);
