/**
 * Shared Method Kernel — public contract surface.
 *
 * Assessment, Tools and Audits import from HERE and from nowhere deeper.
 * Anything not re-exported below is internal to the Assessment/Core team and
 * may change without a coordination note.
 *
 * Owner: Assessment/Core. Contract SHA is recorded in
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/SHARED_CONTRACT_MANIFEST.md
 */

export type {
  MethodEvent,
  MethodEventType,
  MethodActorKind,
  AnswerEventPayload,
  EvidenceEventPayload,
  EvidenceStrength,
  DecisionEventPayload,
  TeresaProposalEventPayload,
} from './events.js';
export { METHOD_EVENT_TYPES, EVIDENCE_STRENGTHS, isMethodEventType } from './events.js';

export type {
  MethodSession,
  MethodSessionState,
  MethodProcessRole,
  MethodSaveState,
  MethodReadiness,
  MethodTransitionRequest,
  TransitionRefusal,
  TransitionResult,
} from './session.js';
export {
  METHOD_SESSION_STATES,
  METHOD_SESSION_TRANSITIONS,
  METHOD_PROCESS_ROLES,
  TRANSITION_AUTHORITY,
  canTransition,
} from './session.js';

export type {
  MethodPack,
  MethodPackManifest,
  MethodPackReadiness,
  MethodUnit,
  MethodLevel,
  MethodQuestion,
  MethodSourceRef,
  ScoringFixture,
  MethodAdapter,
  AdapterCapability,
  MethodCompileReport,
  MethodCompileResult,
  ProgressionInput,
  ProgressionResult,
  ScoringInput,
  ScoringResult,
  AggregationInput,
  AggregationResult,
  PrioritisationInput,
  PrioritisationResult,
} from './methodPack.js';
export { METHOD_PACK_READINESS, canStartSession } from './methodPack.js';

export type {
  TeresaCapabilityId,
  TeresaCapabilityDefinition,
  TeresaIntent,
  TeresaPreview,
  TeresaProposedChange,
  TeresaStatement,
  TeresaStatementKind,
  TeresaQualityVerdict,
  TeresaQualityCheck,
  TeresaForbiddenEffect,
  TeresaCommitRequest,
  TeresaCommitResult,
  TeresaCommitRefusal,
} from './teresa.js';
export {
  TERESA_CAPABILITIES,
  TERESA_FORBIDDEN_EFFECTS,
  TERESA_QUALITY_CHECKS,
} from './teresa.js';
