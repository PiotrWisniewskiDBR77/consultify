/**
 * Shared Method Kernel — Outputs / Reports / Initiative Proposals.
 * Server persistence layer. Pure domain rules live in
 * src/method-core/outputs/ (browser + server safe); this layer is the
 * `method_outputs` / `method_findings` / `method_report_snapshots` /
 * `method_initiative_drafts` persistence (server/migrations/20260813_method_outputs.sql).
 */

export { deriveFindingsFromEvents, EventDerivedOutputBridge } from './EventDerivedOutputBridge.js';
export {
  type CreateInitiativeDraftInput,
  type DraftSupersedenceStatus,
  InitiativeDraftValidationError,
  type MethodInitiativeDraftRecord,
  MethodInitiativeDraftService,
  methodInitiativeDraftService,
} from './MethodInitiativeDraftService.js';
export {
  type EvidenceLocatorInput,
  type FreezeOutputInput,
  type MethodFindingRecord,
  type MethodOutputRecord,
  MethodOutputService,
  methodOutputService,
  type OutputFindingInput,
  OutputValidationError,
  validateFreezeInput,
} from './MethodOutputService.js';
export {
  type CreateReportSnapshotInput,
  type MethodArtefactKind,
  type MethodReportSnapshotRecord,
  MethodReportSnapshotService,
  methodReportSnapshotService,
  type ReportSupersedenceStatus,
} from './MethodReportSnapshotService.js';
