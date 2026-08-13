/**
 * Business-case schema for the Idea workspace — Program D / epic E08.
 *
 * SSOT: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 * §6.2 (Business-case schema) + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md
 * epic E08.
 *
 * WHAT THIS IS: §6.2 asks for "editable, inspectable sections — not an opaque
 * AI narrative", covering problem/baseline through decision requested. This
 * file is the explicit schema — greenfield, there was no business-case model
 * on the Idea object before this (grep confirmed: the only pre-existing
 * `businessCase*` code in this repo is Initiative-level, Oxford O4's
 * `BusinessCaseService` 5-phase NPV/ROI pipeline wired into
 * `InitiativeDetailModal` — a different object, a different shape, not reused
 * here beyond borrowing naming conventions).
 *
 * TWO HARD REQUIREMENTS FROM §6.2, both modeled explicitly rather than left
 * to prose:
 *
 * 1. LINEAGE — "every section links back to originating elements/rows where
 *    possible". Every section carries `lineage: BusinessCaseSourceRef[]`
 *    pointing at a node/edge/table-row/lane/evidence-source id within THIS
 *    idea's graph. Refs capture a `label` snapshot at link time because the
 *    referenced node can be renamed or deleted later — a stale label is an
 *    honest signal ("this used to point at X"), a silently vanished link is
 *    not.
 *
 * 2. UNSUPPORTED CLAIMS — "AI-generated summaries cite those internal
 *    sources and identify unsupported claims rather than presenting them as
 *    fact" (doc 11 §3.5: "facts, assumptions, evidence gaps, alternatives,
 *    risks, owners, KPIs and decisions distinct"; master program §8.2:
 *    "Missing evidence should produce `Evidence needed`, not fabricated
 *    specificity"). Every section carries `claims: BusinessCaseClaim[]`
 *    where each claim is explicitly tagged `fact | assumption |
 *    evidence_gap | unsupported` — an AI author cannot just write prose and
 *    call it a fact.
 *
 * EVIDENCE SECTION IS BY REFERENCE, NOT DUPLICATED: §6.2 asks for "evidence,
 * assumptions and evidence gaps" as one of the fourteen sections. This repo
 * already has a real, working, org-scoped Evidence Envelope store
 * (`server/src/services/evidence/evidenceEnvelopeService.ts`,
 * `src/services/api/evidence.api.ts`, rendered today by
 * `EvidencePanelSection` for artifactType `'canvas'` — see
 * `IdeaRightPanel.tsx`'s `evidenceArtifactId` prop, already wired for the
 * Idea workspace). Building a second, parallel evidence store here would be
 * exactly the "bespoke duplicate" this codebase's CLAUDE.md forbids ("Standard
 * jest KODEM, nie opisem" / reużycie 1:1). So `evidenceAssumptionsGaps` below
 * is a *pointer* (`artifactType: 'canvas', artifactId: <ideaId>`) at that
 * existing envelope — the envelope's `sources`/`assumptions`/`toVerify` ARE
 * the business case's evidence/assumptions/evidence-gaps content, read live,
 * not copied.
 *
 * PERSISTENCE: additive migration `server/migrations/20260810_idea_business_case.sql`
 * (new table `idea_business_cases`, FK to `my_ideas`, no ALTER on any
 * existing table) — NOT applied by this change, see that file's header and
 * the task report for why.
 */

import type { CanvasToolType } from '@/components/MyWork/ideaSelectionTypes';
import type { EvidenceArtifactType } from '@/services/api/evidence.api';

// ─────────────────────────── Lineage ───────────────────────────

/** What kind of in-idea element a lineage pointer targets. */
export type BusinessCaseSourceKind =
  | 'node'
  | 'edge'
  | 'lane_frame'
  | 'table_row'
  | 'table_column'
  | 'evidence_source'
  | 'comment'
  | 'external_artifact';

/**
 * Pointer back to the node/row/evidence card a claim in the business case
 * came from. `refId` is the id in the current graph/table/evidence envelope;
 * `label` is a snapshot taken when the link was made (nodes get renamed or
 * deleted — a stale label tells the reader "this used to say X" instead of
 * the link silently resolving to nothing).
 */
export interface BusinessCaseSourceRef {
  kind: BusinessCaseSourceKind;
  refId: string;
  /** Snapshot of the source's display label at link time. */
  label?: string;
  /** Which of the four representations the element lives in, when relevant. */
  tool?: CanvasToolType;
  /** For `external_artifact` — Initiative/Task/Decision/... this idea already links to. */
  externalArtifactType?: string;
}

// ─────────────────────────── Claims (fact vs assumption vs gap) ───────────────────────────

export type BusinessCaseClaimStatus = 'fact' | 'assumption' | 'evidence_gap' | 'unsupported';

/**
 * One discrete claim inside a section. `status` is mandatory and is the
 * mechanism that keeps "facts, assumptions, evidence gaps... distinct"
 * (doc 11 §3.5) instead of one undifferentiated paragraph of prose.
 *
 * `evidence_gap` / `unsupported` claims MUST render as "Evidence needed" in
 * the UI (never fabricated specificity) — enforced by the renderer, not by
 * this type, but `lineage` being empty is the expected shape for those two
 * statuses (a `fact` or `assumption` claim without lineage is a modeling
 * smell the UI should flag, not silently accept).
 */
export interface BusinessCaseClaim {
  id: string;
  text: string;
  status: BusinessCaseClaimStatus;
  lineage: BusinessCaseSourceRef[];
  /** Free-text reason a claim is `unsupported` (e.g. "AI proposed, no matching node found"). */
  unsupportedReason?: string;
}

/** Who last wrote a section's content — distinguishes user edits from AI drafts. */
export type BusinessCaseAuthor = 'user' | 'ai_draft' | 'ai_accepted';

export interface BusinessCaseSectionMeta {
  authoredBy: BusinessCaseAuthor;
  aiModel?: string;
  aiGeneratedAt?: string;
  /** Set when a user reviews and keeps an `ai_draft` (authoredBy flips to `ai_accepted`). */
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

/** Generic section envelope — every §6.2 section is `content` + lineage + claims + meta. */
export interface BusinessCaseSection<T> {
  content: T;
  lineage: BusinessCaseSourceRef[];
  claims: BusinessCaseClaim[];
  meta: BusinessCaseSectionMeta;
}

// ─────────────────────────── Section content shapes ───────────────────────────

export interface BusinessCaseBaselineMetric {
  metric: string;
  value?: string;
  unit?: string;
  asOf?: string;
  source?: string;
}

export interface ProblemBaselineContent {
  problemStatement: string;
  baseline: BusinessCaseBaselineMetric[];
}

export interface StrategicObjectiveContent {
  objective: string;
  expectedOutcome: string;
  horizon?: string;
}

export type StakeholderStance = 'sponsor' | 'supportive' | 'neutral' | 'resistant' | 'unknown';

export interface BusinessCaseStakeholder {
  name: string;
  role?: string;
  stance: StakeholderStance;
}

export interface BusinessCaseAffectedProcess {
  name: string;
  impact?: string;
}

export interface StakeholdersProcessesContent {
  stakeholders: BusinessCaseStakeholder[];
  affectedProcesses: BusinessCaseAffectedProcess[];
}

/**
 * Pointer-only: the actual sources/assumptions/gaps live in the existing
 * Evidence Envelope (`EvidenceEnvelope`, `artifactType: 'canvas'`). This
 * content shape is deliberately thin — a business-case-specific narrative
 * note plus the pointer, never a copy of the envelope's arrays.
 */
export interface EvidenceAssumptionsGapsContent {
  evidenceEnvelopeRef: { artifactType: EvidenceArtifactType; artifactId: string };
  /** Optional narrative framing specific to the business case (not a source list). */
  note?: string;
}

export interface BusinessCaseAlternative {
  id: string;
  label: string;
  description: string;
  isDoNothing: boolean;
  pros: string[];
  cons: string[];
  costEstimate?: string;
}

export interface AlternativesContent {
  alternatives: BusinessCaseAlternative[];
}

export interface RecommendationContent {
  /** Must match an `id` in `alternatives.alternatives`, or null if undecided. */
  chosenAlternativeId: string | null;
  rationale: string;
}

export type BusinessCaseBenefitType = 'financial' | 'strategic' | 'operational' | 'qualitative';

export interface BusinessCaseBenefit {
  description: string;
  type: BusinessCaseBenefitType;
  value?: string;
}

export interface BusinessCaseDisbenefit {
  description: string;
  value?: string;
}

export interface BenefitsDisbenefitsContent {
  benefits: BusinessCaseBenefit[];
  disbenefits: BusinessCaseDisbenefit[];
}

export type BusinessCaseCostCategory = 'one_time' | 'recurring' | 'headcount' | 'other';

export interface BusinessCaseCostItem {
  category: BusinessCaseCostCategory;
  description: string;
  amount?: string;
  currency?: string;
}

export interface CostsResourcesContent {
  items: BusinessCaseCostItem[];
}

export interface OperationalImpactContent {
  processChanges: string;
  impactedSystems: string[];
  trainingNeeds?: string;
}

export type BusinessCaseRiskLevel = 'low' | 'medium' | 'high';

export interface BusinessCaseRisk {
  description: string;
  likelihood?: BusinessCaseRiskLevel;
  impact?: BusinessCaseRiskLevel;
  control?: string;
  owner?: string;
}

export interface RisksControlsContent {
  risks: BusinessCaseRisk[];
  dependencies: string[];
  constraints: string[];
}

export type BusinessCaseMilestoneStatus = 'planned' | 'in_progress' | 'done' | 'at_risk';

export interface BusinessCaseMilestone {
  label: string;
  targetDate?: string;
  status: BusinessCaseMilestoneStatus;
}

export interface ImplementationHorizonContent {
  horizonSummary?: string;
  milestones: BusinessCaseMilestone[];
}

export interface BusinessCaseKpi {
  id: string;
  name: string;
  baseline?: string;
  target?: string;
  owner?: string;
  measurementSource?: string;
}

export interface KpisContent {
  kpis: BusinessCaseKpi[];
}

export type BusinessCaseConfidenceLevel = 'low' | 'medium' | 'high';

export interface ConfidenceReadinessContent {
  confidenceLevel: BusinessCaseConfidenceLevel;
  readinessStage?: string;
  notes?: string;
}

export type BusinessCaseDecisionOutcome =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'return_for_evidence'
  | 'deferred';

export interface DecisionRequestedContent {
  question: string;
  deadline?: string;
  requestedApprover?: string;
  outcome: BusinessCaseDecisionOutcome;
  decidedBy?: string | null;
  decidedAt?: string | null;
  rationale?: string;
}

// ─────────────────────────── Top-level object ───────────────────────────

export interface IdeaBusinessCaseSections {
  problemBaseline: BusinessCaseSection<ProblemBaselineContent>;
  strategicObjective: BusinessCaseSection<StrategicObjectiveContent>;
  stakeholdersProcesses: BusinessCaseSection<StakeholdersProcessesContent>;
  evidenceAssumptionsGaps: BusinessCaseSection<EvidenceAssumptionsGapsContent>;
  alternatives: BusinessCaseSection<AlternativesContent>;
  recommendation: BusinessCaseSection<RecommendationContent>;
  benefitsDisbenefits: BusinessCaseSection<BenefitsDisbenefitsContent>;
  costsResources: BusinessCaseSection<CostsResourcesContent>;
  operationalImpact: BusinessCaseSection<OperationalImpactContent>;
  risksControls: BusinessCaseSection<RisksControlsContent>;
  implementationHorizon: BusinessCaseSection<ImplementationHorizonContent>;
  kpis: BusinessCaseSection<KpisContent>;
  confidenceReadiness: BusinessCaseSection<ConfidenceReadinessContent>;
  decisionRequested: BusinessCaseSection<DecisionRequestedContent>;
}

/** Ordered list of section keys — drives render order + "N of 14 complete" progress. */
export const BUSINESS_CASE_SECTION_ORDER: (keyof IdeaBusinessCaseSections)[] = [
  'problemBaseline',
  'strategicObjective',
  'stakeholdersProcesses',
  'evidenceAssumptionsGaps',
  'alternatives',
  'recommendation',
  'benefitsDisbenefits',
  'costsResources',
  'operationalImpact',
  'risksControls',
  'implementationHorizon',
  'kpis',
  'confidenceReadiness',
  'decisionRequested',
];

export interface IdeaBusinessCase {
  id: string;
  ideaId: string;
  organizationId: string;
  version: number;
  sections: IdeaBusinessCaseSections;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body accepted by `PUT /api/idea-business-case/:ideaId` — partial section patch. */
export type UpsertIdeaBusinessCaseBody = {
  sections: Partial<{
    [K in keyof IdeaBusinessCaseSections]: {
      content: IdeaBusinessCaseSections[K]['content'];
      lineage?: BusinessCaseSourceRef[];
      claims?: BusinessCaseClaim[];
    };
  }>;
};

// ─────────────────────────── Factory (empty / default state) ───────────────────────────

function emptyMeta(): BusinessCaseSectionMeta {
  return {
    authoredBy: 'user',
    acceptedBy: null,
    acceptedAt: null,
    updatedBy: null,
    updatedAt: new Date(0).toISOString(),
  };
}

function emptySection<T>(content: T): BusinessCaseSection<T> {
  return { content, lineage: [], claims: [], meta: emptyMeta() };
}

/**
 * Builds an empty-but-fully-shaped business case for a fresh idea — every
 * section present (never `undefined`), so the UI can render all fourteen
 * sections with an honest empty state instead of conditionally hiding ones
 * that have never been touched.
 */
export function createEmptyIdeaBusinessCase(
  ideaId: string,
  organizationId: string
): IdeaBusinessCase {
  const now = new Date(0).toISOString();
  return {
    id: '',
    ideaId,
    organizationId,
    version: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    sections: {
      problemBaseline: emptySection<ProblemBaselineContent>({
        problemStatement: '',
        baseline: [],
      }),
      strategicObjective: emptySection<StrategicObjectiveContent>({
        objective: '',
        expectedOutcome: '',
      }),
      stakeholdersProcesses: emptySection<StakeholdersProcessesContent>({
        stakeholders: [],
        affectedProcesses: [],
      }),
      evidenceAssumptionsGaps: emptySection<EvidenceAssumptionsGapsContent>({
        evidenceEnvelopeRef: { artifactType: 'canvas', artifactId: ideaId },
      }),
      alternatives: emptySection<AlternativesContent>({ alternatives: [] }),
      recommendation: emptySection<RecommendationContent>({
        chosenAlternativeId: null,
        rationale: '',
      }),
      benefitsDisbenefits: emptySection<BenefitsDisbenefitsContent>({
        benefits: [],
        disbenefits: [],
      }),
      costsResources: emptySection<CostsResourcesContent>({ items: [] }),
      operationalImpact: emptySection<OperationalImpactContent>({
        processChanges: '',
        impactedSystems: [],
      }),
      risksControls: emptySection<RisksControlsContent>({
        risks: [],
        dependencies: [],
        constraints: [],
      }),
      implementationHorizon: emptySection<ImplementationHorizonContent>({ milestones: [] }),
      kpis: emptySection<KpisContent>({ kpis: [] }),
      confidenceReadiness: emptySection<ConfidenceReadinessContent>({
        confidenceLevel: 'low',
      }),
      decisionRequested: emptySection<DecisionRequestedContent>({
        question: '',
        outcome: 'pending',
      }),
    },
  };
}
