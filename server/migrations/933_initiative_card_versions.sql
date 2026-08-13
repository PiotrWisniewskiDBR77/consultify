-- Canonical Initiative Card catalog, per-Initiative selection and immutable published versions.
-- This migration is additive; it does not rewrite legacy Initiative section storage.

BEGIN;

CREATE TABLE IF NOT EXISTS ie_initiative_card_catalog (
  card_key TEXT PRIMARY KEY,
  registry_version INTEGER NOT NULL CHECK (registry_version >= 1),
  card_group TEXT NOT NULL,
  label TEXT NOT NULL,
  truth_owner TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ie_initiative_card_catalog
  (card_key, registry_version, card_group, label, truth_owner)
VALUES
  ('summary-scope',1,'definition-value','Summary / Scope','initiative'),
  ('strategic-fit',1,'definition-value','Strategic Fit','shared-reference'),
  ('success-criteria',1,'definition-value','Success Criteria','initiative'),
  ('outcomes-benefits',1,'definition-value','Outcomes & Benefits','results'),
  ('kpi',1,'definition-value','KPI','results'),
  ('options',1,'definition-value','Options','initiative'),
  ('financial-analysis',1,'definition-value','Financial Analysis','finance'),
  ('financial-impact',1,'definition-value','Financial Impact','finance'),
  ('people-team',1,'organization-feasibility','People / Team','resource'),
  ('roles-raci',1,'organization-feasibility','Roles & RACI','initiative'),
  ('stakeholders',1,'organization-feasibility','Stakeholders','initiative'),
  ('resources-capacity',1,'organization-feasibility','Resources & Capacity','resource'),
  ('dependencies',1,'organization-feasibility','Dependencies','shared-reference'),
  ('risk-raid',1,'organization-feasibility','Risk & RAID','raid'),
  ('milestones',1,'plan-governance','Milestones','initiative'),
  ('timeline',1,'plan-governance','Timeline','initiative'),
  ('tasks',1,'plan-governance','Tasks','task'),
  ('decisions',1,'plan-governance','Decisions','decision'),
  ('gates-approvals',1,'plan-governance','Gates & Approvals','decision'),
  ('feasibility-completeness',1,'organization-feasibility','Feasibility & Completeness','initiative'),
  ('change-adoption',1,'adoption-evidence-learning','Change & Adoption','initiative'),
  ('communication-engagement',1,'adoption-evidence-learning','Communication & Engagement','initiative'),
  ('capabilities-training',1,'adoption-evidence-learning','Capabilities & Training','shared-reference'),
  ('technical-specification',1,'organization-feasibility','Technical Specification','shared-reference'),
  ('attachments-materials',1,'adoption-evidence-learning','Attachments & Materials','materials'),
  ('comments-activity-history',1,'adoption-evidence-learning','Comments, Activity & History','audit')
ON CONFLICT (card_key) DO UPDATE SET
  registry_version = EXCLUDED.registry_version,
  card_group = EXCLUDED.card_group,
  label = EXCLUDED.label,
  truth_owner = EXCLUDED.truth_owner,
  active = TRUE;

CREATE TABLE IF NOT EXISTS ie_initiative_card_selection (
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  card_key TEXT NOT NULL REFERENCES ie_initiative_card_catalog(card_key),
  included BOOLEAN NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  requiredness TEXT NOT NULL CHECK (requiredness IN ('REQUIRED','OPTIONAL')),
  waiver_decision_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, initiative_id, card_key),
  UNIQUE (organization_id, initiative_id, position),
  CHECK (included OR waiver_decision_id IS NOT NULL OR requiredness = 'OPTIONAL')
);

CREATE TABLE IF NOT EXISTS ie_initiative_card_versions (
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  card_key TEXT NOT NULL REFERENCES ie_initiative_card_catalog(card_key),
  card_version INTEGER NOT NULL CHECK (card_version >= 1),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  applicability TEXT NOT NULL CHECK (applicability IN ('REQUIRED','OPTIONAL','NOT_APPLICABLE')),
  completion TEXT NOT NULL CHECK (completion IN ('EMPTY','IN_PROGRESS','COMPLETE')),
  quality TEXT NOT NULL CHECK (quality IN ('UNKNOWN','SUFFICIENT','WARNING','BLOCKER')),
  freshness TEXT NOT NULL CHECK (freshness IN ('CURRENT','STALE','SOURCE_UNAVAILABLE')),
  review_state TEXT NOT NULL CHECK (review_state IN ('NOT_REQUESTED','REQUESTED','CHANGES_REQUESTED','ACCEPTED')),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  waiver_decision_id TEXT,
  published_by TEXT NOT NULL,
  review_decision_id TEXT,
  reviewed_by TEXT,
  review_rationale TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, initiative_id, card_key, card_version)
);

ALTER TABLE ie_initiative_card_versions
  ADD COLUMN IF NOT EXISTS review_decision_id TEXT;
ALTER TABLE ie_initiative_card_versions
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE ie_initiative_card_versions
  ADD COLUMN IF NOT EXISTS review_rationale TEXT;

CREATE INDEX IF NOT EXISTS idx_ie_initiative_card_versions_latest
  ON ie_initiative_card_versions (organization_id, initiative_id, card_key, card_version DESC);

COMMIT;
