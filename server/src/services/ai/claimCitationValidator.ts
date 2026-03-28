/**
 * Claim-Citation Validator Service (V4-AI-03)
 *
 * Extracts factual claims from AI response text, matches them to citations,
 * and validates coverage against configurable policy thresholds.
 */
import logger from '../../utils/Logger.js';

export interface Claim {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  citations: Array<{ citationId: string; relevance: number }>;
  verified: boolean;
  verificationStatus: 'verified' | 'unverified' | 'missing_citation' | 'weak_citation';
}

export interface ClaimValidationResult {
  totalClaims: number;
  citedClaims: number;
  uncitedClaims: number;
  weakCitations: number;
  coverageScore: number;
  claims: Claim[];
  passesPolicy: boolean;
  policyViolations: string[];
}

export interface ClaimCitationPolicy {
  minCoverageScore?: number;
  requireAllFactualCited?: boolean;
  maxUncitedClaims?: number;
}

const SKIP_PREFIX_RE = /^\s*(however|note|please|I |let me|here|this)/i;
const QUESTION_RE = /\?$/;
const FACTUAL_RE =
  /\d+%?|\b(is|are|was|were|has|have|shows?|indicates?|according|based on|results?|data|evidence|analysis)\b/i;

export function extractClaims(
  text: string
): Omit<Claim, 'citations' | 'verified' | 'verificationStatus'>[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const claims: Omit<Claim, 'citations' | 'verified' | 'verificationStatus'>[] = [];
  let offset = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const startOffset = text.indexOf(trimmed, offset);
    const endOffset = startOffset + trimmed.length;
    offset = endOffset;

    if (SKIP_PREFIX_RE.test(trimmed)) continue;
    if (QUESTION_RE.test(trimmed)) continue;

    if (FACTUAL_RE.test(trimmed)) {
      claims.push({
        id: `claim_${claims.length}`,
        text: trimmed,
        startOffset,
        endOffset,
      });
    }
  }

  return claims;
}

export function matchClaimsToCitations(
  claims: Omit<Claim, 'citations' | 'verified' | 'verificationStatus'>[],
  citations: Array<{
    id: string;
    excerpt?: string;
    startOffset?: number;
    endOffset?: number;
  }>,
  _fullText: string
): Claim[] {
  return claims.map((claim) => {
    const matched: Array<{ citationId: string; relevance: number }> = [];

    for (const citation of citations) {
      if (citation.startOffset !== undefined) {
        const distance = Math.abs(claim.endOffset - citation.startOffset);
        if (distance < 200) {
          matched.push({
            citationId: citation.id,
            relevance: Math.max(0, 1 - distance / 200),
          });
        }
      }

      if (citation.excerpt) {
        const words = citation.excerpt.toLowerCase().split(/\s+/);
        const claimWords = claim.text.toLowerCase().split(/\s+/);
        const overlap = words.filter((w) => claimWords.includes(w)).length;
        if (overlap > 2) {
          matched.push({
            citationId: citation.id,
            relevance: Math.min(overlap / words.length, 1),
          });
        }
      }
    }

    const hasCitation = matched.length > 0;
    const maxRelevance = hasCitation ? Math.max(...matched.map((m) => m.relevance)) : 0;

    let verificationStatus: Claim['verificationStatus'];
    if (!hasCitation) {
      verificationStatus = 'missing_citation';
    } else if (maxRelevance < 0.3) {
      verificationStatus = 'weak_citation';
    } else if (maxRelevance >= 0.5) {
      verificationStatus = 'verified';
    } else {
      verificationStatus = 'unverified';
    }

    return {
      ...claim,
      citations: matched,
      verified: hasCitation && maxRelevance > 0.5,
      verificationStatus,
    };
  });
}

export function validateClaimCitations(
  claims: Claim[],
  policy: ClaimCitationPolicy
): ClaimValidationResult {
  const totalClaims = claims.length;
  const citedClaims = claims.filter((c) => c.citations.length > 0).length;
  const uncitedClaims = totalClaims - citedClaims;
  const weakCitations = claims.filter((c) => c.verificationStatus === 'weak_citation').length;
  const coverageScore = totalClaims > 0 ? citedClaims / totalClaims : 1;

  const policyViolations: string[] = [];

  if (policy.minCoverageScore && coverageScore < policy.minCoverageScore) {
    policyViolations.push(
      `Citation coverage ${(coverageScore * 100).toFixed(0)}% below minimum ${(policy.minCoverageScore * 100).toFixed(0)}%`
    );
  }
  if (policy.requireAllFactualCited && uncitedClaims > 0) {
    policyViolations.push(`${uncitedClaims} factual claims without citations`);
  }
  if (policy.maxUncitedClaims !== undefined && uncitedClaims > policy.maxUncitedClaims) {
    policyViolations.push(
      `${uncitedClaims} uncited claims exceeds maximum ${policy.maxUncitedClaims}`
    );
  }

  logger.debug(
    `[ClaimCitationValidator] ${totalClaims} claims, ${citedClaims} cited, coverage=${(coverageScore * 100).toFixed(0)}%, violations=${policyViolations.length}`
  );

  return {
    totalClaims,
    citedClaims,
    uncitedClaims,
    weakCitations,
    coverageScore,
    claims,
    passesPolicy: policyViolations.length === 0,
    policyViolations,
  };
}
