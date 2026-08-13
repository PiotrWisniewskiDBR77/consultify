/**
 * AssessmentOutput factory — the ONLY way to construct one.
 *
 * There is deliberately no `updateAssessmentOutput`/`patchAssessmentOutput`
 * export anywhere in this package. Combined with `deepFreeze` below, an
 * attempt to mutate a constructed Output is a thrown `TypeError` (ES modules
 * run in strict mode, so assigning to a frozen property throws rather than
 * silently no-op-ing) — immutability is enforced by the runtime, not by
 * convention or code review.
 *
 * Canon: ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §2, §6.
 */

import { computePortableContentHash, sortByStableKey, sortStrings } from './contentHash';
import { assertFindingIsValid } from './finding';
import { deepFreeze } from './freeze';
import type { AssessmentOutput, EvidenceCompleteness, Finding, OutputLineage } from './types';

export class OutputValidationError extends Error {
  constructor(
    message: string,
    public readonly reasons: readonly string[]
  ) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

export interface CreateAssessmentOutputInput {
  readonly id: string;
  readonly organizationId: string;
  readonly module: AssessmentOutput['module'];
  readonly methodology: AssessmentOutput['methodology'];
  readonly scope: string;
  readonly snapshotId: string;
  readonly current: AssessmentOutput['current'];
  readonly target: AssessmentOutput['target'];
  readonly gap: AssessmentOutput['gap'];
  readonly aggregation: AssessmentOutput['aggregation'];
  readonly visualModel: AssessmentOutput['visualModel'];
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly limitations: readonly string[];
  readonly findings: readonly Finding[];
  readonly prioritisationResult: AssessmentOutput['prioritisationResult'];
  readonly lineage: OutputLineage;
  readonly version: number;
  readonly createdAt: string;
  readonly frozenAt: string;
}

function validate(input: CreateAssessmentOutputInput): string[] {
  const reasons: string[] = [];

  if (!input.methodology?.version || input.methodology.version.trim() === '') {
    reasons.push('methodology.version is required — an Output cannot be pinned to no version');
  }
  if (!input.methodology?.methodPackId || input.methodology.methodPackId.trim() === '') {
    reasons.push('methodology.methodPackId is required');
  }
  if (!input.limitations || input.limitations.length === 0) {
    reasons.push(
      'limitations must be non-empty — an honest Output always states what it does not cover'
    );
  }
  if (!input.snapshotId) {
    reasons.push('snapshotId is required — an Output must trace back to a frozen snapshot');
  }
  if (!input.scope || input.scope.trim() === '') {
    reasons.push('scope is required');
  }
  for (const finding of input.findings ?? []) {
    try {
      assertFindingIsValid(finding);
    } catch (err) {
      reasons.push(err instanceof Error ? err.message : String(err));
    }
  }

  return reasons;
}

/**
 * Content used for the deterministic hash. Every array that could have been
 * fetched from a DB without an explicit ORDER BY is sorted here BY STABLE
 * KEY before hashing — see contentHash.ts for the incident this guards
 * against.
 */
function buildHashableContent(input: CreateAssessmentOutputInput): unknown {
  return {
    module: input.module,
    methodology: input.methodology,
    scope: input.scope,
    snapshotId: input.snapshotId,
    current: input.current,
    target: input.target,
    gap: input.gap,
    aggregation: input.aggregation,
    limitations: sortStrings(input.limitations),
    findings: sortByStableKey(input.findings, 'id').map((f) => ({
      ...f,
      supportingEvidence: sortByStableKey(f.supportingEvidence, 'evidenceId'),
      contradictingEvidence: sortByStableKey(f.contradictingEvidence, 'evidenceId'),
      sourceLocators: sortStrings(f.sourceLocators),
    })),
    prioritisationResult: input.prioritisationResult,
    lineage: input.lineage,
    version: input.version,
  };
}

/**
 * Construct a frozen, validated AssessmentOutput. Throws `OutputValidationError`
 * when methodology.version, limitations, or any finding's evidence rule is
 * missing — canon test 4 ("Output bez limitations i bez methodology version
 * → odrzucony").
 */
export function createAssessmentOutput(input: CreateAssessmentOutputInput): AssessmentOutput {
  const reasons = validate(input);
  if (reasons.length > 0) {
    throw new OutputValidationError(
      `AssessmentOutput rejected: ${reasons.join('; ')}`,
      reasons
    );
  }

  const contentHash = computePortableContentHash(buildHashableContent(input));

  const output: AssessmentOutput = {
    id: input.id,
    organizationId: input.organizationId,
    module: input.module,
    methodology: input.methodology,
    scope: input.scope,
    snapshotId: input.snapshotId,
    current: input.current,
    target: input.target,
    gap: input.gap,
    aggregation: input.aggregation,
    visualModel: input.visualModel,
    evidenceCompleteness: input.evidenceCompleteness,
    limitations: input.limitations,
    findings: input.findings,
    prioritisationResult: input.prioritisationResult,
    lineage: input.lineage,
    version: input.version,
    createdAt: input.createdAt,
    frozenAt: input.frozenAt,
    contentHash,
  };

  return deepFreeze(output);
}

/**
 * Recompute the content hash of an already-built Output and compare against
 * the stored one — used by tests/repositories to detect drift/tampering
 * without needing the original construction input.
 */
export function recomputeOutputContentHash(output: AssessmentOutput): string {
  return computePortableContentHash(
    buildHashableContent({
      id: output.id,
      organizationId: output.organizationId,
      module: output.module,
      methodology: output.methodology,
      scope: output.scope,
      snapshotId: output.snapshotId,
      current: output.current,
      target: output.target,
      gap: output.gap,
      aggregation: output.aggregation,
      visualModel: output.visualModel,
      evidenceCompleteness: output.evidenceCompleteness,
      limitations: output.limitations,
      findings: output.findings,
      prioritisationResult: output.prioritisationResult,
      lineage: output.lineage,
      version: output.version,
      createdAt: output.createdAt,
      frozenAt: output.frozenAt,
    })
  );
}
