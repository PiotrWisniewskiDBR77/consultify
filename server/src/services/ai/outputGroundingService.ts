/**
 * Output Grounding Validator Service
 *
 * Validates AI responses before delivery to ensure factual claims
 * are grounded in the provided context. Extracts claims, verifies
 * citations, and produces a grounding score with confidence indicator.
 */
import { randomUUID } from 'node:crypto';

import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface GroundingResult {
  groundingScore: number;
  confidenceScore: number;
  totalClaims: number;
  groundedClaims: number;
  ungroundedClaims: number;
  citationAccuracy: number;
  hallucinationFlags: string[];
  disclaimer: string | null;
}

interface ExtractedClaim {
  text: string;
  isFactual: boolean;
  hasCitation: boolean;
  isGrounded: boolean;
}

const FACTUAL_INDICATORS = [
  /\b\d+(\.\d+)?%/,
  /\b(PLN|EUR|USD|GBP)\s*\d/,
  /\b\d{1,3}(,\d{3})*(\.\d+)?\b/,
  /\b(increased|decreased|grew|dropped|rose|fell|wzrost|spadek|wzrósł|spadł)\b/i,
  /\b(ROI|KPI|EBITDA|CAGR|NPV|IRR)\b/,
  /\b(Q[1-4]\s*20\d{2})\b/,
  /\b(according to|based on|data shows|na podstawie|dane wskazują|wynika z)\b/i,
];

const HEDGING_PHRASES = [
  'I think', 'it seems', 'possibly', 'might be', 'could be',
  'myślę', 'wydaje się', 'prawdopodobnie', 'może być',
  'in my opinion', 'moim zdaniem',
];

const HALLUC_PHRASES = [
  'as everyone knows', 'it is well known', 'studies show that',
  'research proves', 'scientists agree', 'experts confirm',
  'jak powszechnie wiadomo', 'badania dowodzą', 'eksperci potwierdzają',
  'jak wynika z licznych badań', 'powszechnie uznaje się',
];

const CITATION_PATTERNS = /\[(DT|KB|BM|WEB|FIN|ASS)\]|\[\d+\]/g;

const GROUNDING_THRESHOLD = 0.6;

class OutputGroundingService {
  async validate(input: {
    response: string;
    contextChunks: string[];
    conversationId?: string;
    messageId?: string;
    userId?: string;
    organizationId?: string;
  }): Promise<GroundingResult> {
    const { response, contextChunks } = input;

    if (!response?.trim()) {
      return this.emptyResult();
    }

    const fullContext = contextChunks.join('\n').toLowerCase();
    const claims = this.extractClaims(response);
    const hallucinationFlags: string[] = [];

    let groundedCount = 0;
    let citedCount = 0;

    for (const claim of claims) {
      if (!claim.isFactual) {
        groundedCount++;
        continue;
      }

      if (this.isClaimGrounded(claim.text, fullContext)) {
        claim.isGrounded = true;
        groundedCount++;
      }

      if (claim.hasCitation) {
        citedCount++;
      }
    }

    this.detectHallucinationSignals(response, hallucinationFlags);

    const totalFactual = claims.filter((c) => c.isFactual).length;
    const groundingScore =
      claims.length > 0 ? Math.round((groundedCount / claims.length) * 10000) / 10000 : 1;
    const citationAccuracy =
      totalFactual > 0 ? Math.round((citedCount / totalFactual) * 10000) / 10000 : 1;

    const hedgingRatio = this.computeHedgingRatio(response);
    const confidenceScore = Math.round(
      Math.min(1, Math.max(0, groundingScore * 0.6 + (1 - hedgingRatio) * 0.2 + citationAccuracy * 0.2)) * 10000
    ) / 10000;

    const disclaimer =
      groundingScore < GROUNDING_THRESHOLD
        ? 'Some claims in this response may not be fully supported by the available data. Please verify key figures independently.'
        : null;

    const result: GroundingResult = {
      groundingScore,
      confidenceScore,
      totalClaims: claims.length,
      groundedClaims: groundedCount,
      ungroundedClaims: claims.length - groundedCount,
      citationAccuracy,
      hallucinationFlags,
      disclaimer,
    };

    this.persistLog(input, result).catch((err) =>
      logger.debug(`[OutputGrounding] Persist skipped: ${err?.message}`)
    );

    return result;
  }

  private extractClaims(response: string): ExtractedClaim[] {
    const sentences = response
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    return sentences.map((text) => ({
      text,
      isFactual: this.isFactualClaim(text),
      hasCitation: CITATION_PATTERNS.test(text),
      isGrounded: false,
    }));
  }

  private isFactualClaim(sentence: string): boolean {
    return FACTUAL_INDICATORS.some((pattern) => pattern.test(sentence));
  }

  private isClaimGrounded(claim: string, context: string): boolean {
    const keywords = claim
      .toLowerCase()
      .replace(/[^\w\sąćęłńóśźżäöüß]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (!keywords.length) return true;

    const matchRatio = keywords.filter((w) => context.includes(w)).length / keywords.length;
    return matchRatio > 0.35;
  }

  private detectHallucinationSignals(response: string, flags: string[]): void {
    const lower = response.toLowerCase();
    for (const phrase of HALLUC_PHRASES) {
      if (lower.includes(phrase)) {
        flags.push(`hallucination_signal: "${phrase}"`);
      }
    }
  }

  private computeHedgingRatio(response: string): number {
    const lower = response.toLowerCase();
    const sentences = response.split(/[.!?]\s+/).filter((s) => s.length > 10);
    if (!sentences.length) return 0;
    const hedged = sentences.filter((s) => {
      const sl = s.toLowerCase();
      return HEDGING_PHRASES.some((p) => sl.includes(p));
    }).length;
    return hedged / sentences.length;
  }

  private emptyResult(): GroundingResult {
    return {
      groundingScore: 0,
      confidenceScore: 0,
      totalClaims: 0,
      groundedClaims: 0,
      ungroundedClaims: 0,
      citationAccuracy: 0,
      hallucinationFlags: [],
      disclaimer: null,
    };
  }

  private async persistLog(
    input: {
      conversationId?: string;
      messageId?: string;
      userId?: string;
      organizationId?: string;
    },
    result: GroundingResult
  ): Promise<void> {
    await dbRun(
      `INSERT INTO ai_grounding_logs
        (id, organization_id, conversation_id, message_id, user_id,
         grounding_score, confidence_score, total_claims, grounded_claims,
         ungrounded_claims, citation_accuracy, hallucination_flags,
         created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        randomUUID(),
        input.organizationId || null,
        input.conversationId || null,
        input.messageId || null,
        input.userId || null,
        result.groundingScore,
        result.confidenceScore,
        result.totalClaims,
        result.groundedClaims,
        result.ungroundedClaims,
        result.citationAccuracy,
        JSON.stringify(result.hallucinationFlags),
      ]
    );
  }
}

export const outputGroundingService = new OutputGroundingService();
export default outputGroundingService;
