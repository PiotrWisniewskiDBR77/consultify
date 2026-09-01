/**
 * MIRROR — byte-identical copy of the body below this header, sourced from
 * src/method-core/contracts/ (the frozen public contract, owned by
 * Assessment/Core).
 *
 * WHY THIS FILE EXISTS: server/tsconfig.json sets "rootDir": "." (relative
 * to server/) and production boots via `cd server && npm run build && node
 * dist/src/index.js` (tsc --build tsconfig.build.json). A relative import
 * reaching outside server/ into the repo-root src/ tree fails that build
 * with TS6059 ("File is not under rootDir"). No existing server/src file
 * imports across that boundary (verified 2026-08-13, zero precedent) — tsx
 * (dev) and vitest (tests) both tolerate the cross-boundary import fine,
 * only the production tsc emit does not. Duplicating the contract is the
 * chosen tradeoff over changing rootDir (bigger blast radius) or emitting
 * broken production builds.
 *
 * KEEP IN SYNC: if the corresponding file under src/method-core/contracts/
 * changes, mirror the change here in the same commit. Diff the body below
 * this header comment against the source file to verify no drift.
 * Flagged to Codex as COORD-05 in
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION.md.
 */
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
