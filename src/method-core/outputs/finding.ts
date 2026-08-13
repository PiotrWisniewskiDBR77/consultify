/**
 * Finding validation and construction.
 *
 * Canon: 10_ASSESSMENT_REVIEW.md §14, ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §3.
 * Rule under test (canon test 9): a finding with NO contradicting evidence is
 * fine (absence of contradiction is common and valid); a finding with NO
 * supporting evidence is rejected — "brak dowodu nie jest ukryty przez
 * confidence ani narrację AI" (ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §1).
 */

import { deepFreeze } from './freeze';
import type { Finding } from './types';

export class FindingValidationError extends Error {
  constructor(
    message: string,
    public readonly reasons: readonly string[]
  ) {
    super(message);
    this.name = 'FindingValidationError';
  }
}

/** Throws `FindingValidationError` listing every violated rule. */
export function assertFindingIsValid(finding: Finding): void {
  const reasons: string[] = [];

  if (!finding.supportingEvidence || finding.supportingEvidence.length === 0) {
    reasons.push(
      `finding ${finding.id ?? '(no id)'}: supportingEvidence must be non-empty — ` +
        'contradicting-only or no evidence at all is not enough to publish a finding'
    );
  }
  if (!finding.businessMeaning || finding.businessMeaning.trim() === '') {
    reasons.push(`finding ${finding.id ?? '(no id)'}: businessMeaning is required`);
  }
  if (!finding.recommendation || finding.recommendation.trim() === '') {
    reasons.push(`finding ${finding.id ?? '(no id)'}: recommendation is required`);
  }

  if (reasons.length > 0) {
    throw new FindingValidationError(`Finding rejected: ${reasons.join('; ')}`, reasons);
  }
}

/** Construct and freeze a Finding. Throws `FindingValidationError` on violation. */
export function createFinding(input: Finding): Finding {
  assertFindingIsValid(input);
  return deepFreeze(input);
}
