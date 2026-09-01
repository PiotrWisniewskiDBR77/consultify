/**
 * Shared Method Kernel — Outputs / Reports / Initiative Proposals.
 * Public surface. See types.ts for the canon references.
 */

export {
  createAssessmentOutput,
  type CreateAssessmentOutputInput,
  OutputValidationError,
  recomputeOutputContentHash,
} from './assessmentOutput';
export {
  computePortableContentHash,
  roundForHash,
  sortByStableKey,
  sortStrings,
  stableStringify,
} from './contentHash';
export { assertFindingIsValid, createFinding, FindingValidationError } from './finding';
export { deepFreeze } from './freeze';
export {
  createInitiativeProposalDraft,
  type CreateInitiativeProposalDraftInput,
  groupFindingsForInitiativeDrafts,
  InitiativeDraftValidationError,
} from './initiativeDraft';
export {
  createPresentationSourceBlock,
  type CreatePresentationSourceBlockInput,
  PresentationSourceBlockError,
} from './presentationSourceBlock';
export {
  buildPresentationView,
  buildReportSnapshot,
  type BuildReportSnapshotInput,
  type PresentationView,
} from './reportSnapshot';
export { markRecordSuperseded, wrapAsCurrent } from './supersession';
export type {
  AssessmentOutput,
  ContentApprovalState,
  DeliverableRecord,
  EvidenceCompleteness,
  EvidenceLocator,
  Finding,
  FindingConfidence,
  FindingKpiProposal,
  InitiativeDraftDependency,
  InitiativeDraftRisk,
  InitiativeProposalDraft,
  OutputLineage,
  OutputMethodology,
  PresentationConfidentiality,
  PresentationDensity,
  PresentationLayout,
  PresentationProvenance,
  PresentationSourceBlock,
  PresentationVisualIntent,
  ReportGroupResult,
  ReportInitiativeCandidateRef,
  ReportSnapshot,
  ReportUnitResult,
  SupersedenceStatus,
  UnitLevelMap,
  VisualModelRef,
} from './types';
