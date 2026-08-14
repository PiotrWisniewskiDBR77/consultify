/**
 * Shared Method Kernel — Outputs / Reports / Initiative Proposals.
 * Server persistence layer. Pure domain rules live in
 * src/method-core/outputs/ (browser + server safe); this layer is the
 * `method_outputs` / `method_findings` / `method_report_snapshots` /
 * `method_initiative_drafts` persistence (server/migrations/20260813_method_outputs.sql).
 */

export {
  MethodOutputService,
  methodOutputService,
  OutputValidationError,
  validateFreezeInput,
  type EvidenceLocatorInput,
  type FreezeOutputInput,
  type MethodFindingRecord,
  type MethodOutputRecord,
  type OutputFindingInput,
} from './MethodOutputService.js';

export {
  MethodReportSnapshotService,
  methodReportSnapshotService,
  type CreateReportSnapshotInput,
  type MethodArtefactKind,
  type MethodReportSnapshotRecord,
  type ReportSupersedenceStatus,
} from './MethodReportSnapshotService.js';

export {
  InitiativeDraftValidationError,
  MethodInitiativeDraftService,
  methodInitiativeDraftService,
  type CreateInitiativeDraftInput,
  type DraftSupersedenceStatus,
  type MethodInitiativeDraftRecord,
} from './MethodInitiativeDraftService.js';

export {
  EventDerivedOutputBridge,
  deriveFindingsFromEvents,
} from './EventDerivedOutputBridge.js';
