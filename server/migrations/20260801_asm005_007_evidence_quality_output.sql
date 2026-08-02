-- ASM-005/006/007 — evidence/scoring, quality review lifecycle, immutable
-- accepted output for the ASM-001a DRD Form/Matrix flow (server/src/routes/
-- v8/assessment.routes.ts, `assessments` table, `answers.drd.areas` map).
--
-- Deliberately NOT reusing the legacy `assessment_evidence` (framework_id +
-- dimension_id keyed, no organization_id column) or `assessment_reviews`
-- (workflow_id keyed, peer-review shaped) tables — those belong to other,
-- parallel assessment lifecycles (legacy AssessmentController report
-- approval, P28 workbench) that ASM-05/06/07 must not touch. This is a
-- purpose-built, directly org-scoped schema for the DRD axis/area flow.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB): only
-- CREATE TABLE/INDEX IF NOT EXISTS.

-- Evidence attached to one axis+area of one assessment. axis_id mirrors
-- DRD_STRUCTURE axis.id (numeric, e.g. "1"); area_id mirrors area.id
-- (e.g. "1A"). Kept as text for cross-db portability, same convention as
-- every other assessment_* table in this schema.
CREATE TABLE IF NOT EXISTS public.assessment_axis_evidence (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    assessment_id text NOT NULL,
    axis_id text NOT NULL,
    area_id text NOT NULL,
    evidence_type text DEFAULT 'note'::text NOT NULL,
    title text NOT NULL,
    description text,
    url text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assessment_axis_evidence_type_check CHECK (
        evidence_type = ANY (ARRAY['note'::text, 'link'::text, 'document'::text, 'reference'::text])
    )
);

CREATE INDEX IF NOT EXISTS idx_axis_evidence_org_assessment
    ON public.assessment_axis_evidence (organization_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_axis_evidence_axis
    ON public.assessment_axis_evidence (organization_id, assessment_id, axis_id);

-- Append-only audit trail of manager accept/return decisions. One row per
-- decision — never updated, never deleted.
CREATE TABLE IF NOT EXISTS public.assessment_quality_reviews (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    assessment_id text NOT NULL,
    action text NOT NULL,
    actor_id text NOT NULL,
    actor_role text,
    rationale text NOT NULL,
    previous_status text,
    new_status text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assessment_quality_reviews_action_check CHECK (
        action = ANY (ARRAY['accept'::text, 'return'::text])
    )
);

CREATE INDEX IF NOT EXISTS idx_quality_reviews_org_assessment
    ON public.assessment_quality_reviews (organization_id, assessment_id, created_at DESC);

-- Immutable accepted output. A row is written once, on accept, and never
-- updated afterwards — later draft edits (PUT /:assessmentId) or a
-- return+re-accept cycle only ever INSERT a new row and flip is_current on
-- the previous one. GET report always reads the is_current=true row, so a
-- draft edit made after acceptance can never change what report/reopen
-- returns for that assessment id until a NEW accept produces a new row.
CREATE TABLE IF NOT EXISTS public.assessment_accepted_snapshots (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    assessment_id text NOT NULL,
    review_id text NOT NULL,
    snapshot_json text NOT NULL,
    provenance_json text NOT NULL,
    accepted_by text NOT NULL,
    accepted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_current boolean DEFAULT true NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accepted_snapshots_org_assessment
    ON public.assessment_accepted_snapshots (organization_id, assessment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accepted_snapshots_current
    ON public.assessment_accepted_snapshots (assessment_id)
    WHERE is_current;
