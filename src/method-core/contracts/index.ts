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
  AnswerEventPayload,
  DecisionEventPayload,
  EvidenceEventPayload,
  EvidenceStrength,
  MethodActorKind,
  MethodEvent,
  MethodEventType,
  TeresaProposalEventPayload,
} from './events.js';
export { EVIDENCE_STRENGTHS, isMethodEventType, METHOD_EVENT_TYPES } from './events.js';
export type {
  AdapterCapability,
  AggregationInput,
  AggregationResult,
  MethodAdapter,
  MethodCompileReport,
  MethodCompileResult,
  MethodLevel,
  MethodPack,
  MethodPackManifest,
  MethodPackReadiness,
  MethodQuestion,
  MethodSourceRef,
  MethodUnit,
  PrioritisationInput,
  PrioritisationResult,
  ProgressionInput,
  ProgressionResult,
  ScoringFixture,
  ScoringInput,
  ScoringResult,
} from './methodPack.js';
export { canStartSession, METHOD_PACK_READINESS } from './methodPack.js';
export type {
  MethodProcessRole,
  MethodReadiness,
  MethodSaveState,
  MethodSession,
  MethodSessionState,
  MethodTransitionRequest,
  TransitionRefusal,
  TransitionResult,
} from './session.js';
export {
  canTransition,
  METHOD_PROCESS_ROLES,
  METHOD_SESSION_STATES,
  METHOD_SESSION_TRANSITIONS,
  TRANSITION_AUTHORITY,
} from './session.js';
export type {
  TeresaCapabilityDefinition,
  TeresaCapabilityId,
  TeresaCommitRefusal,
  TeresaCommitRequest,
  TeresaCommitResult,
  TeresaForbiddenEffect,
  TeresaIntent,
  TeresaPreview,
  TeresaProposedChange,
  TeresaQualityCheck,
  TeresaQualityVerdict,
  TeresaStatement,
  TeresaStatementKind,
} from './teresa.js';
export { TERESA_CAPABILITIES, TERESA_FORBIDDEN_EFFECTS, TERESA_QUALITY_CHECKS } from './teresa.js';
