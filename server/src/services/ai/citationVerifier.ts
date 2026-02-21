/**
 * Citation Verifier Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Verifies citations against database sources.
 */
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { Citation } from './citationExtractor.js';

export interface VerificationResult {
  citationId: string;
  status: 'verified' | 'unverified' | 'broken' | 'partial';
  confidence: number;
  reason: string;
  sourceExists: boolean;
}

export interface VerificationReport {
  conversationId?: string;
  messageId?: string;
  totalCitations: number;
  verified: number;
  unverified: number;
  broken: number;
  overallScore: number;
  results: VerificationResult[];
  timestamp: string;
}

class CitationVerifierService {
  checkGovernanceCitations(
    citations: Citation[],
    isGovernanceResponse: boolean
  ): { sufficient: boolean; warning: string | null } {
    if (!isGovernanceResponse) return { sufficient: true, warning: null };
    if (citations.length >= 1) return { sufficient: true, warning: null };
    return {
      sufficient: false,
      warning: 'Governance response requires at least 1 citation from core docs.',
    };
  }

  async verify(
    citations: Citation[],
    conversationId?: string,
    messageId?: string
  ): Promise<VerificationReport> {
    const results: VerificationResult[] = [];
    for (const c of citations) results.push(await this.verifySingle(c));

    const verified = results.filter((r) => r.status === 'verified').length;
    const unverified = results.filter((r) => r.status === 'unverified').length;
    const broken = results.filter((r) => r.status === 'broken').length;
    const partial = results.filter((r) => r.status === 'partial').length;
    const score = citations.length > 0 ? (verified + partial * 0.5) / citations.length : 1;

    const report: VerificationReport = {
      conversationId,
      messageId,
      totalCitations: citations.length,
      verified,
      unverified,
      broken,
      overallScore: Math.round(score * 100) / 100,
      results,
      timestamp: new Date().toISOString(),
    };

    // Persist verification log to DB (non-blocking — table may not exist in all deployments)
    try {
      await dbRun(
        `INSERT INTO citation_verification_logs (conversation_id, message_id, total_citations, verified_count, unverified_count, broken_count, overall_score, results_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          conversationId || null,
          messageId || null,
          citations.length,
          verified,
          unverified,
          broken,
          report.overallScore,
          JSON.stringify(results),
          report.timestamp,
        ]
      );
    } catch (err: any) {
      logger.warn(`[CitationVerifier] Failed to persist verification log: ${err?.message}`);
    }

    logger.info(
      `[CitationVerifier] ${citations.length} citations: ${verified} verified, score=${report.overallScore}`
    );
    return report;
  }

  private async verifySingle(c: Citation): Promise<VerificationResult> {
    if (c.sourceType === 'system_doc' || c.sourceType === 'core_doc') {
      const exists = await this.checkExists(c.sourceId || '', 'document');
      return {
        citationId: c.id,
        status: exists ? 'verified' : 'partial',
        confidence: exists ? 0.95 : 0.5,
        reason: exists ? 'System doc verified' : 'System doc reference (unlinked)',
        sourceExists: exists,
      };
    }
    if (c.sourceType === 'external') {
      const valid = c.sourceUrl && /^https?:\/\/.+/.test(c.sourceUrl);
      if (valid && (c as any).retrievedBySystem) {
        return {
          citationId: c.id,
          status: 'verified',
          confidence: 0.8,
          reason: 'System-retrieved external source',
          sourceExists: true,
        };
      }
      return {
        citationId: c.id,
        status: valid ? 'partial' : 'broken',
        confidence: valid ? 0.6 : 0.1,
        reason: valid ? 'URL valid' : 'Invalid URL',
        sourceExists: !!valid,
      };
    }
    if (c.sourceId) {
      const exists = await this.checkExists(c.sourceId, c.sourceType);
      return {
        citationId: c.id,
        status: exists ? 'verified' : 'broken',
        confidence: exists ? 0.9 : 0.1,
        reason: exists ? 'Source found' : 'Not found',
        sourceExists: exists,
      };
    }
    return {
      citationId: c.id,
      status: 'unverified',
      confidence: 0.2,
      reason: 'No source ID',
      sourceExists: false,
    };
  }

  private async checkExists(id: string, type: string): Promise<boolean> {
    const tables: Record<string, string> = {
      assessment: 'assessment_levels',
      initiative: 'initiatives',
      report: 'reports',
      document: 'knowledge_documents',
      knowledge: 'knowledge_documents',
      system_doc: 'knowledge_documents',
      core_doc: 'knowledge_documents',
    };
    const t = tables[type];
    if (!t) return false;
    try {
      const r = await dbAll(`SELECT id FROM ${t} WHERE id = ? LIMIT 1`, [id]);
      return Array.isArray(r) && r.length > 0;
    } catch (err: any) {
      logger.debug(`[CitationVerifier] Source check failed for ${type}/${id}: ${err?.message}`);
      return false;
    }
  }
}

export const citationVerifier = new CitationVerifierService();
export default citationVerifier;
export { CitationVerifierService };
