/**
 * Shared Method Kernel — Method Pack Registry and adapter boundary.
 *
 * This file is the reason the kernel can stay method-agnostic. Everything that
 * is true only for DRD, only for SIRI, or only for a given audit standard lives
 * behind `MethodAdapter`. The kernel calls the adapter; it never branches on a
 * method id.
 *
 * Canon: ASSESSMENT_METHOD_PACK_CONTRACT.md (whole document),
 *        METHOD_LIBRARY_FIRST_STANDARD.md §3.
 */

import type { EvidenceStrength } from './events';

/**
 * Readiness ladder from ASSESSMENT_METHOD_PACK_CONTRACT.md §6.
 * Library MUST show the true value — a pack without questions, scoring fixtures
 * or a licence may not look like a finished method.
 */
export const METHOD_PACK_READINESS = [
  'draft',
  'methodology_review',
  'content_approved',
  'runtime_validated',
  'pilot',
  'released',
  'deprecated',
] as const;

export type MethodPackReadiness = (typeof METHOD_PACK_READINESS)[number];

/** Only these two may start a new production session. */
export function canStartSession(readiness: MethodPackReadiness): boolean {
  return readiness === 'released' || readiness === 'pilot';
}

export interface MethodPackManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly ownerUserId: string | null;
  readonly languages: readonly string[];
  readonly readiness: MethodPackReadiness;

  /**
   * Licensing is not decoration: DRD and SIRI are licensed methods and the
   * canon forbids copying licensed source text into public outputs.
   */
  readonly licence: {
    readonly holder: string;
    readonly usageRestriction: 'internal_only' | 'client_deliverable' | 'public';
    readonly notice: string;
  };
}

/**
 * A unit of assessment: DRD area, SIRI dimension, ADMA dimension, audit clause.
 * `unitId` is stable and language-independent — translating the name must never
 * change the id (ASSESSMENT_METHOD_PACK_CONTRACT.md §3).
 */
export interface MethodUnit {
  readonly unitId: string;
  readonly name: string;
  readonly description: string;
  /** Parent grouping id (DRD axis, SIRI pillar, ADMA pillar). */
  readonly parentId: string | null;
  readonly order: number;
  /**
   * Per-unit level scale. DRD is the proof this cannot be global: its axes run
   * 1–7, 1–5 and 1–6 side by side.
   */
  readonly levelScale: readonly number[];
  readonly dependsOnUnitIds: readonly string[];
  readonly respondentRoles: readonly string[];
}

/**
 * A level/band descriptor. The canon demands far more than a number — without
 * these fields the Workbench cannot honestly help a user choose.
 */
export interface MethodLevel {
  readonly unitId: string;
  readonly level: number;
  readonly title: string;
  readonly canonicalDefinition: string;
  readonly requiredAttributes: readonly string[];
  readonly distinctionFromPrevious: string;
  readonly distinctionFromNext: string;
  readonly validationQuestionIds: readonly string[];
  readonly expectedEvidence: readonly string[];
  readonly negativeEvidence: readonly string[];
  readonly misScoringTraps: readonly string[];
  /**
   * Kept apart deliberately: canon states technology presence never proves a
   * level on its own (ASSESSMENT_KB_DRD.md §3).
   */
  readonly examples: readonly string[];
  readonly technologyExamples: readonly string[];
  readonly prerequisites: readonly number[];
  /** Minimum evidence strength this level demands to be *approvable*. */
  readonly minimumEvidenceStrength: EvidenceStrength;
}

/**
 * Per-question help. If any of this is missing the UI must show an explicit
 * `Help content unavailable` — Teresa may NOT invent the gap.
 * Canon: ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §5.
 */
export interface MethodQuestion {
  readonly questionId: string;
  readonly unitId: string;
  readonly level: number | null;
  readonly canonicalWording: string;
  readonly intent: string;
  readonly plainLanguageExplanation: string;
  readonly whyItMatters: string;
  readonly glossaryRefs: readonly string[];
  readonly positiveAnswerExample: string;
  readonly partialAnswerExample: string;
  readonly negativeAnswerExample: string;
  readonly expectedEvidence: readonly string[];
  readonly likelyRespondentRoles: readonly string[];
  readonly followUpQuestionIds: readonly string[];
  readonly commonMisunderstanding: string;
  readonly allowedTeresaCapabilities: readonly string[];
  readonly sourceRefs: readonly string[];
}

/**
 * The compiled, runtime-validated pack. `sources` and `fixtures` are required,
 * not optional: a pack that cannot prove its scoring is not releasable.
 */
export interface MethodPack {
  readonly manifest: MethodPackManifest;
  readonly units: readonly MethodUnit[];
  readonly levels: readonly MethodLevel[];
  readonly questions: readonly MethodQuestion[];
  readonly sources: readonly MethodSourceRef[];
  readonly scoringFixtures: readonly ScoringFixture[];
}

export interface MethodSourceRef {
  readonly sourceId: string;
  readonly title: string;
  readonly locator: string;
  readonly retrievedAt: string;
  readonly usageRight: 'quotable' | 'internal_reference' | 'restricted';
}

// ---------------------------------------------------------------------------
// Compiler result — uniform across every method (COORD-09)
// ---------------------------------------------------------------------------

/**
 * Every Method Pack compiler returns the pack AND a report about how complete
 * it actually is. The report is not decoration: `readiness` in the manifest may
 * only be set honestly, and the report is the evidence behind that call
 * (ASSESSMENT_METHOD_PACK_CONTRACT.md §6 — „Pack bez pytań, scoring fixtures
 * lub licencji nie może wyglądać jak gotowa metoda").
 *
 * Methods extend this with their own coverage counters; the two fields below
 * are the minimum every method must answer.
 */
export interface MethodCompileReport {
  /** Why the manifest carries the readiness it carries. Plain language. */
  readonly readinessRationale: string;
  /**
   * Conflicts found while compiling — e.g. two sources disagreeing. Reported,
   * never silently resolved by picking one.
   */
  readonly discrepancies: readonly string[];
}

/**
 * Uniform compiler signature. DRD, SIRI and every future method return this.
 * Consumers destructure `{ pack }`; tooling and DoD checks read `report`.
 */
export interface MethodCompileResult<
  TReport extends MethodCompileReport = MethodCompileReport,
> {
  readonly pack: MethodPack;
  readonly report: TReport;
}

/** Deterministic golden case. Scoring that cannot reproduce these is rejected. */
export interface ScoringFixture {
  readonly fixtureId: string;
  readonly description: string;
  readonly kind: 'valid' | 'boundary' | 'invalid';
  readonly input: unknown;
  readonly expected: unknown;
}

// ---------------------------------------------------------------------------
// Adapter boundary — the ONLY place method-specific rules may live
// ---------------------------------------------------------------------------

/**
 * Every method plugs in here. The kernel holds no `if (method === 'drd')`.
 *
 * A method that cannot yet implement an adapter member honestly must return
 * `{ supported: false, reason: 'EVIDENCE_MISSING' }` rather than guess — this is
 * how ADMA/CMMI/Lean stay wired but visibly incomplete instead of pretending.
 */
export interface MethodAdapter {
  readonly methodPackId: string;

  /** Load the pinned, immutable pack version. */
  loadPack(version: string): Promise<MethodPack>;

  /**
   * Which levels are currently open for a unit, given confirmed answers.
   * Encodes progression: cumulative ramps, no-leapfrog, prerequisites.
   */
  resolveOpenLevels(input: ProgressionInput): ProgressionResult;

  /**
   * Deterministic scoring. MUST NOT call an LLM.
   * Canon: ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §4.
   */
  computeScore(input: ScoringInput): ScoringResult;

  /**
   * Aggregation to parent groupings (DRD axis, SIRI pillar, ADMA T1–T7).
   * Rounding and weighting must be explicit and versioned — an unversioned
   * arithmetic mean is a defect, not an aggregation.
   */
  aggregate(input: AggregationInput): AggregationResult;

  /** Post-freeze prioritisation, when the method defines one (SIRI TIER). */
  prioritise?(input: PrioritisationInput): PrioritisationResult;
}

export interface ProgressionInput {
  readonly unitId: string;
  readonly confirmedLevels: readonly number[];
  readonly evidenceByLevel: Readonly<Record<number, EvidenceStrength>>;
}

export interface ProgressionResult {
  /** Highest level whose conditions are fully met — the formal current level. */
  readonly currentLevel: number | null;
  /** Level that blocks further progression; null when nothing blocks. */
  readonly blockedAtLevel: number | null;
  readonly openLevels: readonly number[];
  /**
   * Practices observed ABOVE the blocking gap. Recorded, visible, and
   * explicitly NOT auto-raising `currentLevel`.
   */
  readonly aboveGapLevels: readonly number[];
}

export interface ScoringInput {
  readonly unitId: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly evidence: Readonly<Record<string, EvidenceStrength>>;
}

export interface ScoringResult {
  readonly proposedLevel: number | null;
  readonly satisfiedAttributes: readonly string[];
  readonly unsatisfiedAttributes: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
  /** `needs_evidence` — never a silent zero. */
  readonly verdict: 'scored' | 'needs_evidence' | 'not_applicable' | 'unknown';
}

export interface AggregationInput {
  readonly unitLevels: Readonly<Record<string, number | null>>;
  readonly mappingVersion: string;
}

export interface AggregationResult {
  readonly byGroup: Readonly<Record<string, number | null>>;
  readonly mappingVersion: string;
  readonly rule: string;
  /** Units excluded from aggregation and why (N/A, unknown, missing). */
  readonly excluded: Readonly<Record<string, string>>;
}

export interface PrioritisationInput {
  /** Frozen unit levels only. Proposals may never feed prioritisation. */
  readonly frozenUnitLevels: Readonly<Record<string, number>>;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface PrioritisationResult {
  readonly rankedUnitIds: readonly string[];
  readonly rationaleByUnitId: Readonly<Record<string, string>>;
  readonly parametersVersion: string;
  /**
   * Traceability for adapters whose engine has more than one calculation
   * formula (e.g. SIRI TIER's `legacy_v1` vs `siri_pm_v2` — COORD-08).
   * Optional so adapters without versioned engines are unaffected.
   */
  readonly calculationVersion?: string;
}

/** Honest refusal, used by adapters whose method content is not yet licensed. */
export type AdapterCapability<T> =
  | { readonly supported: true; readonly value: T }
  | { readonly supported: false; readonly reason: 'EVIDENCE_MISSING' | 'NOT_LICENSED' };
