/**
 * Shared Method Kernel — Outputs / Reports / Initiative Proposals.
 *
 * Owned by: Assessment/Core team (agent A8). Consumed by: Assessment, Tools,
 * Audits Output/Deliverables/Initiatives surfaces (UI built separately by A5
 * — see docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/
 * ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md, this file's canon).
 *
 * This module sits ONE LAYER ABOVE `../contracts` (the frozen session/event
 * kernel): an AssessmentOutput is what a Process becomes once frozen
 * (METHOD_MODULE_FIVE_SURFACES_STANDARD.md §4). It is intentionally NOT part
 * of `../contracts` — Outputs/Deliverables/Initiatives are a separate,
 * evolving surface, not the closed kernel contract.
 *
 * Canon:
 *  - ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md (whole document)
 *  - METHOD_MODULE_FIVE_SURFACES_STANDARD.md §4 Outputs, §5 Deliverables, §6 Initiatives
 *  - ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §7 Freeze
 *  - INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md
 *  - TOOL_SESSION_WORKSPACE_STANDARD.md §7A (PresentationSourceBlock)
 *  - 10_ASSESSMENT_REVIEW.md §14 Findings, §15 Raport, "Granica przekazania do Initiatives"
 */

import type { AggregationResult, PrioritisationResult } from '../contracts/methodPack';
import type { EvidenceStrength } from '../contracts/events';

// ---------------------------------------------------------------------------
// Evidence reference — shared shape used by Findings, Report and Presentation
// ---------------------------------------------------------------------------

/**
 * Pointer to a `method_evidence` row (or an external source), never a copy
 * of its content. Findings carry these, not evidence bodies, so a Finding
 * stays small and evidence stays the single source of truth.
 */
export interface EvidenceLocator {
  readonly evidenceId: string;
  readonly evidenceType:
    | 'document'
    | 'system_record'
    | 'metric'
    | 'demonstration'
    | 'observation'
    | 'interview_statement'
    | 'media'
    | 'external_source';
  readonly strength: EvidenceStrength;
  readonly locator: string;
  readonly title?: string;
}

// ---------------------------------------------------------------------------
// Finding — 10_ASSESSMENT_REVIEW.md §14, ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §3
// ---------------------------------------------------------------------------

export type FindingConfidence = 'low' | 'medium' | 'high';

export interface FindingKpiProposal {
  readonly name: string;
  readonly description: string;
  readonly targetDirection: 'increase' | 'decrease' | 'stabilize';
}

/**
 * Unit-level finding. `supportingEvidence` is REQUIRED and non-empty —
 * `assertFindingIsValid` (finding.ts) rejects a finding with none. Canon:
 * "brak dowodu nie jest ukryty przez confidence ani narrację AI"
 * (ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §1).
 * `contradictingEvidence` may be empty — absence of contradiction is a valid,
 * common state and must NOT be required.
 */
export interface Finding {
  readonly id: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly supportingEvidence: readonly EvidenceLocator[];
  readonly contradictingEvidence: readonly EvidenceLocator[];
  readonly businessMeaning: string;
  readonly rootCauseHypothesis: string;
  readonly riskOrOpportunity: string;
  readonly recommendation: string;
  readonly prerequisite: string | null;
  readonly expectedOutcome: string;
  readonly kpiProposal: FindingKpiProposal | null;
  readonly confidence: FindingConfidence;
  /** Why this finding ranks where it does among the others in the Output. */
  readonly priorityRationale: string;
  /** Where in the source session this finding traces back to (question/answer/evidence ids). */
  readonly sourceLocators: readonly string[];
}

// ---------------------------------------------------------------------------
// AssessmentOutput — ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §2
// ---------------------------------------------------------------------------

export interface OutputMethodology {
  readonly methodPackId: string;
  readonly version: string;
}

/** Which unit (question/area/dimension) a current/target/gap value belongs to. */
export type UnitLevelMap = Readonly<Record<string, number | null>>;

export interface EvidenceCompleteness {
  readonly totalUnits: number;
  readonly unitsWithAcceptedEvidence: number;
  readonly unitsMissingEvidence: number;
  /** 0..1. Never a substitute for `unitsMissingEvidence` — completeness is
   * shown explicitly, never masked behind a single ratio. */
  readonly completenessRatio: number;
}

/**
 * Reference to the rendered matrix/radar/heatmap/gap chart. The Output does
 * not own pixels — Workbench, Output and Deliverable all render the SAME
 * snapshot data model (ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §4), so
 * this is a pointer + the minimal data the renderer needs, not an image.
 */
export interface VisualModelRef {
  readonly kind: 'matrix' | 'radar' | 'heatmap' | 'gap_chart';
  readonly dataRef: UnitLevelMap;
}

export interface OutputLineage {
  readonly sourceSessionId: string;
  /** Set when the source session is itself a revision (frozen -> active -> re-frozen). */
  readonly sourceRevisionOfSessionId: string | null;
  /** Previous Output in this lineage, if this Output was produced by a reopen + re-freeze. */
  readonly revisionOfOutputId: string | null;
  /** Set once a NEWER freeze exists for the same lineage. Never set by this Output itself. */
  readonly supersededByOutputId: string | null;
}

/**
 * Immutable, approved result of a frozen Process
 * (METHOD_MODULE_FIVE_SURFACES_STANDARD.md §4). Constructed exclusively via
 * `createAssessmentOutput` (assessmentOutput.ts), which deep-freezes the
 * result — there is no `updateOutput`/`patchOutput` function anywhere in
 * this module, on purpose. A correction is a new freeze, i.e. a brand new
 * `AssessmentOutput` with `lineage.revisionOfOutputId` set.
 */
export interface AssessmentOutput {
  readonly id: string;
  readonly organizationId: string;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodology: OutputMethodology;
  /** Free-text + structured scope description frozen at the time of the freeze. */
  readonly scope: string;
  /** `method_snapshots.id` this Output was built from — the reproducibility anchor. */
  readonly snapshotId: string;
  readonly current: UnitLevelMap;
  readonly target: UnitLevelMap;
  readonly gap: UnitLevelMap;
  readonly aggregation: AggregationResult;
  readonly visualModel: VisualModelRef;
  readonly evidenceCompleteness: EvidenceCompleteness;
  /**
   * REQUIRED, non-empty. `createAssessmentOutput` refuses to build an Output
   * without at least one limitation — canon test 4 ("Output bez limitations
   * ... → odrzucony").
   */
  readonly limitations: readonly string[];
  readonly findings: readonly Finding[];
  readonly prioritisationResult: PrioritisationResult | null;
  readonly lineage: OutputLineage;
  /** Monotonic within a lineage: 1 for the first freeze, 2 for the next revision, ... */
  readonly version: number;
  readonly createdAt: string;
  readonly frozenAt: string;
  /** Deterministic content hash — see contentHash.ts. Recomputing it from the
   * same fields (after sorting) must always reproduce this value. */
  readonly contentHash: string;
}

// ---------------------------------------------------------------------------
// Report — 10_ASSESSMENT_REVIEW.md §15
// ---------------------------------------------------------------------------

export interface ReportUnitResult {
  readonly unitId: string;
  readonly unitName: string;
  readonly current: number | null;
  readonly target: number | null;
  readonly gap: number | null;
}

export interface ReportGroupResult {
  readonly groupId: string;
  readonly groupName: string;
  readonly aggregatedLevel: number | null;
}

/**
 * Which lifecycle bucket a piece of report/presentation content is in.
 * Only `accepted` may enter a default (non-draft) deliverable —
 * TOOL_SESSION_WORKSPACE_STANDARD.md §7A: "Tylko zaakceptowany content może
 * domyślnie trafić do zatwierdzanego decku. Proposed/needs-evidence może
 * wejść wyłącznie jako jawny draft z oznaczeniem."
 */
export type ContentApprovalState = 'accepted' | 'proposed' | 'needs_evidence';

export interface ReportInitiativeCandidateRef {
  readonly draftId: string;
  readonly title: string;
}

/**
 * Rendered strictly from one `AssessmentOutput` snapshot — never from a live
 * session. `buildReportSnapshot` (reportSnapshot.ts) takes an
 * `AssessmentOutput`, not a session/workspace object, so a later change to
 * the (possibly reopened) session cannot leak into an already-built report
 * (canon test 10).
 */
export interface ReportSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly outputId: string;
  readonly outputVersion: number;
  readonly executiveSummary: string;
  readonly scope: string;
  readonly methodology: OutputMethodology;
  readonly participants: readonly string[];
  readonly limitations: readonly string[];
  readonly overallResult: number | null;
  readonly unitResults: readonly ReportUnitResult[];
  readonly groupResults: readonly ReportGroupResult[];
  readonly current: UnitLevelMap;
  readonly target: UnitLevelMap;
  readonly gap: UnitLevelMap;
  readonly evidenceQuality: EvidenceCompleteness;
  readonly strengths: readonly string[];
  readonly gapsAndRisks: readonly string[];
  readonly recommendations: readonly string[];
  readonly initiativeCandidates: readonly ReportInitiativeCandidateRef[];
  readonly appendices: readonly string[];
  /** Locators back to the source findings/evidence/session for audit. */
  readonly traceability: readonly string[];
  readonly createdAt: string;
  readonly contentHash: string;
}

// ---------------------------------------------------------------------------
// PresentationSourceBlock — TOOL_SESSION_WORKSPACE_STANDARD.md §7A
// ---------------------------------------------------------------------------

export type PresentationVisualIntent =
  | 'comparison'
  | 'quadrant'
  | 'flow'
  | 'hierarchy'
  | 'evidence'
  | 'recommendation'
  | 'decision';

export type PresentationLayout =
  | 'title'
  | 'two_column'
  | 'matrix'
  | 'chart'
  | 'quote'
  | 'timeline'
  | 'table';

export type PresentationDensity = 'sparse' | 'standard' | 'dense';

export type PresentationConfidentiality = 'internal_only' | 'client_deliverable' | 'public';

export interface PresentationProvenance {
  readonly generatedBy: 'human' | 'teresa';
  readonly generatedAt: string;
  /** True only when this block was explicitly sent as a marked draft — see
   * `createPresentationSourceBlock`'s `allowDraftContent` guard. */
  readonly isDraft: boolean;
}

/**
 * Semantic, versioned handoff from an Output to Presentation Studio — never
 * a screenshot. Mirrors `ToolOutput`'s sibling block in
 * TOOL_SESSION_WORKSPACE_STANDARD.md §7A verbatim, specialised to
 * `sourceOutputId`/`sourceVersion` for the Assessment/Audits case.
 */
export interface PresentationSourceBlock {
  readonly sourceOutputId: string;
  readonly sourceVersion: number;
  readonly blockType: 'finding' | 'matrix' | 'gap_chart' | 'recommendation' | 'summary';
  readonly blockId: string;
  readonly dataSnapshot: unknown;
  readonly title: string;
  readonly keyMessage: string;
  readonly evidenceRefs: readonly string[];
  readonly visualIntent: PresentationVisualIntent;
  readonly preferredLayouts: readonly PresentationLayout[];
  readonly density: PresentationDensity;
  readonly themeTokens: Readonly<Record<string, string>>;
  readonly confidentiality: PresentationConfidentiality;
  readonly freshness: string;
  readonly provenance: PresentationProvenance;
}

// ---------------------------------------------------------------------------
// Initiative Proposal Draft — METHOD_MODULE_FIVE_SURFACES_STANDARD.md §6,
// ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §5, INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md
// ---------------------------------------------------------------------------

export interface InitiativeDraftRisk {
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface InitiativeDraftDependency {
  readonly description: string;
  readonly relatedFindingId: string | null;
}

/**
 * Local, unregistered proposal. THIS TYPE HAS NO `registeredInitiativeId`,
 * NO `initiativeId`, AND THIS MODULE EXPORTS NO `registerInitiative`
 * FUNCTION — by construction, nothing in `src/method-core/outputs` can
 * produce a Registered Initiative. Canon: "Teresa może grupować,
 * deduplikować i proponować — ale NIE tworzy Registered Initiative.
 * `Register as Initiative` to decyzja człowieka"
 * (ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §5). That decision, and the
 * `initiativeId` it produces, belongs to the Initiatives module — this layer
 * only ever hands it a draft to validate.
 */
export interface InitiativeProposalDraft {
  readonly id: string;
  readonly organizationId: string;
  readonly outputId: string;
  readonly outputVersion: number;
  readonly title: string;
  readonly summary: string;
  /** Grouped findings — MUST be >= 1; the generator groups, it does not
   * mint one draft per finding (INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md §4). */
  readonly findingIds: readonly string[];
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly kpiProposal: FindingKpiProposal | null;
  readonly dependencies: readonly InitiativeDraftDependency[];
  readonly risks: readonly InitiativeDraftRisk[];
  readonly evidenceLinks: readonly string[];
  readonly confidence: FindingConfidence;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Supersession — ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §6
// ---------------------------------------------------------------------------

export type SupersedenceStatus = 'current' | 'superseded' | 'source_updated';

/**
 * Wraps a Deliverable/Draft's immutable `content` with a mutable-in-the-only-
 * permitted-sense status pointer. `markRecordSuperseded` (supersession.ts)
 * returns a NEW wrapper with the SAME `content` object reference — the
 * content is never rewritten, only the wrapper's status changes (in the
 * server this is a single-column UPDATE on `status`, never on the content
 * columns). Canon: "wcześniejsze Deliverables/Drafts dostają status
 * `superseded/source updated`, bez cichego przepisania treści."
 */
export interface DeliverableRecord<T> {
  readonly content: T;
  readonly status: SupersedenceStatus;
  readonly supersededAt: string | null;
  readonly supersededByOutputId: string | null;
}
