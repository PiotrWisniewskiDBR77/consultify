/**
 * Shared Method Kernel — Outputs / Reports / Initiative Proposals.
 * Public surface. See types.ts for the canon references.
 */

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

export {
  computePortableContentHash,
  roundForHash,
  sortByStableKey,
  sortStrings,
  stableStringify,
} from './contentHash';

export { deepFreeze } from './freeze';

export {
  createAssessmentOutput,
  recomputeOutputContentHash,
  OutputValidationError,
  type CreateAssessmentOutputInput,
} from './assessmentOutput';

export {
  assertFindingIsValid,
  createFinding,
  FindingValidationError,
} from './finding';

export {
  buildPresentationView,
  buildReportSnapshot,
  type BuildReportSnapshotInput,
  type PresentationView,
} from './reportSnapshot';

export {
  createPresentationSourceBlock,
  PresentationSourceBlockError,
  type CreatePresentationSourceBlockInput,
} from './presentationSourceBlock';

export {
  createInitiativeProposalDraft,
  groupFindingsForInitiativeDrafts,
  InitiativeDraftValidationError,
  type CreateInitiativeProposalDraftInput,
} from './initiativeDraft';

export { markRecordSuperseded, wrapAsCurrent } from './supersession';
