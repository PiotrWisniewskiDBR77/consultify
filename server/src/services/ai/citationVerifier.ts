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
  /**
   * M01-006 — `'no_access'` added: the source row exists but its
   * `organization_id` does not match the requesting caller's organization.
   * Distinct from `'broken'` (row does not exist at all). Only produced when
   * the caller passes its own `organizationId` into `verify()` AND the
   * looked-up table actually carries an `organization_id` column (schema
   * mismatch or no caller org falls back to the pre-existing
   * existence-only check — see `checkAccess`).
   */
  status: 'verified' | 'unverified' | 'broken' | 'partial' | 'no_access';
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
    messageId?: string,
    /**
     * M01-006 — the REQUESTING caller's organization. Threaded through so
     * `checkAccess` can catch a citation whose `sourceId` resolves to a real
     * row that belongs to a DIFFERENT organization (e.g. a stale/forged
     * sourceId, or a future retrieval-path bug) — previously `checkExists`
     * only checked row existence, never ownership, so such a citation was
     * marked `'verified'`/`ready` and its real title/excerpt rendered.
     * Optional and additive: omitting it reproduces the exact prior
     * existence-only behavior (see `checkAccess`).
     */
    organizationId?: string | null
  ): Promise<VerificationReport> {
    const results: VerificationResult[] = [];
    for (const c of citations) results.push(await this.verifySingle(c, organizationId));

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

  private async verifySingle(
    c: Citation,
    organizationId?: string | null
  ): Promise<VerificationResult> {
    if (c.sourceType === 'system_doc' || c.sourceType === 'core_doc') {
      // M01-006 FIX_REQUIRED round: this used to hardcode the literal
      // 'document' here instead of passing through `c.sourceType`. That was
      // invisible before this round's table-map fix because 'document' and
      // 'system_doc'/'core_doc' both resolved to the SAME table
      // (knowledge_documents) by coincidence. Now that 'document'/'knowledge'
      // correctly point at knowledge_docs (see checkAccess's table map),
      // leaving this hardcoded would silently misroute system_doc/core_doc
      // lookups to the wrong table. Passing the real type keeps
      // system_doc/core_doc on knowledge_documents, matching
      // coreDocsService.ts, the table's only writer.
      const access = await this.checkAccess(c.sourceId || '', c.sourceType, organizationId);
      if (access.exists && access.accessDenied) {
        return {
          citationId: c.id,
          status: 'no_access',
          confidence: 0.1,
          reason: 'System doc exists but belongs to a different organization',
          sourceExists: true,
        };
      }
      return {
        citationId: c.id,
        status: access.exists ? 'verified' : 'partial',
        confidence: access.exists ? 0.95 : 0.5,
        reason: access.exists ? 'System doc verified' : 'System doc reference (unlinked)',
        sourceExists: access.exists,
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
      const access = await this.checkAccess(c.sourceId, c.sourceType, organizationId);
      // M01-006: a row that EXISTS but belongs to another organization must
      // never be reported `'verified'` — that status flows straight through
      // `mapVerificationStatusToAccessStatus` to the client as `ready`,
      // which lets `CitationList` render the real (already-fetched) title
      // and excerpt. `checkAccess` only sets `accessDenied` when it could
      // actually compare `organization_id` (caller supplied one AND the
      // table has the column) — see that method for the fail-soft fallback.
      if (access.exists && access.accessDenied) {
        return {
          citationId: c.id,
          status: 'no_access',
          confidence: 0.1,
          reason: 'Source exists but is not accessible to the requesting organization',
          sourceExists: true,
        };
      }
      return {
        citationId: c.id,
        status: access.exists ? 'verified' : 'broken',
        confidence: access.exists ? 0.9 : 0.1,
        reason: access.exists ? 'Source found' : 'Not found',
        sourceExists: access.exists,
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

  /**
   * M01-006 FIX_REQUIRED round — table map correction (verified against the
   * real ingest/retrieval code, not assumed):
   *   - `document`/`knowledge` citations are ordinary RAG citations produced
   *     from chat-uploaded knowledge. `citationExtractor.ts` sets
   *     `sourceId = meta.documentId`, which `ragService.ts` (`searchChunks`,
   *     the `documentIds`-filtered branch) populates as
   *     `documentId: (r as any)?.doc_id`. That `doc_id` is
   *     `knowledge_chunks.doc_id`, which has an actual FK to
   *     `knowledge_docs(id)` (see `PostgresDatabase.ts`'s inline bootstrap
   *     schema — `knowledge_docs` + `knowledge_chunks(doc_id)`). So a
   *     `document`/`knowledge` citation's `sourceId` is a `knowledge_docs.id`,
   *     never a `knowledge_documents.id`. The previous map pointed both at
   *     `knowledge_documents` — a DIFFERENT table (created by migration
   *     `266_knowledge_rag.sql`, with its own unrelated `knowledge_chunks`
   *     rows keyed by `document_id`) — so `checkAccess` always queried the
   *     wrong table and never found a row for a real chat RAG citation
   *     (0 rows -> `exists:false` -> `'broken'`/`'unverified'`, never
   *     `'no_access'`, regardless of organization).
   *   - `system_doc`/`core_doc` citations DO belong on `knowledge_documents`:
   *     `coreDocsService.ts#ingestSingle` is the only writer of that table,
   *     and it always inserts `organization_id = NULL` ("NULL for
   *     system-wide docs" — intentional, not touched by this fix). No
   *     producer in this codebase currently sets `sourceType` to
   *     `'system_doc'`/`'core_doc'` on an actual citation (verified by grep:
   *     the only occurrences of those two string literals outside this file
   *     are the `Citation['sourceType']` union declaration itself), so this
   *     branch is dormant today — kept as-is per instructions, not removed.
   *
   * This method (`checkAccess`) catches an organization mismatch where the
   * schema supports it. Before the ORIGINAL M01-006 fix, it only ever
   * confirmed the row existed — a citation pointing at a real document
   * belonging to a DIFFERENT organization (or any future retrieval-path bug
   * that let such a sourceId through) was reported `verified`, letting the
   * UI render its real title/excerpt.
   *
   * `accessDenied` is only ever `true` when `organizationId` was supplied
   * by the caller AND the table actually has an `organization_id` column to
   * compare against (`knowledge_docs` for `document`/`knowledge`,
   * `knowledge_documents` for `system_doc`/`core_doc` — both confirmed to
   * carry the column) AND that column is non-null on the row. Every other
   * case — no caller org, a non-knowledge table, a schema without the
   * column, a NULL `organization_id` on the row — falls back to the exact
   * pre-fix existence-only behavior. This is deliberate: this module has no
   * visibility into which legacy rows have a resolved owner (see the
   * `organization_id IS NULL` handling in `ragService.ts`'s
   * `appendKnowledgeDocAccessFilter` for the retrieval-side equivalent of
   * that same question) — guessing wrong here would fail closed on
   * legitimate citations, which is worse than the gap this fix closes.
   */
  private async checkAccess(
    id: string,
    type: string,
    organizationId?: string | null
  ): Promise<{ exists: boolean; accessDenied: boolean }> {
    const tables: Record<string, string> = {
      assessment: 'assessment_levels',
      initiative: 'initiatives',
      report: 'reports',
      // M01-006 FIX_REQUIRED round: real chat RAG citations resolve against
      // `knowledge_docs` (see the table-map comment on `checkAccess` above),
      // NOT `knowledge_documents` — that table only backs the dormant
      // `system_doc`/`core_doc` types written by `coreDocsService.ts`.
      document: 'knowledge_docs',
      knowledge: 'knowledge_docs',
      system_doc: 'knowledge_documents',
      core_doc: 'knowledge_documents',
    };
    const t = tables[type];
    if (!t) return { exists: false, accessDenied: false };

    const orgScopedTables = new Set(['knowledge_docs', 'knowledge_documents']);
    const canCheckOrg = Boolean(organizationId) && orgScopedTables.has(t);
    if (canCheckOrg) {
      try {
        const r = await dbAll(`SELECT id, organization_id FROM ${t} WHERE id = ? LIMIT 1`, [id]);
        if (!Array.isArray(r) || r.length === 0) return { exists: false, accessDenied: false };
        const rowOrg = (r[0] as any)?.organization_id;
        if (rowOrg != null && String(rowOrg) !== String(organizationId)) {
          return { exists: true, accessDenied: true };
        }
        return { exists: true, accessDenied: false };
      } catch (err: any) {
        // `organization_id` column may not exist on this deployment's schema
        // — fall back to the plain existence check below rather than fail
        // closed on a schema mismatch.
        logger.debug(
          `[CitationVerifier] Org-scoped check failed for ${type}/${id}, falling back to existence-only: ${err?.message}`
        );
      }
    }

    try {
      const r = await dbAll(`SELECT id FROM ${t} WHERE id = ? LIMIT 1`, [id]);
      return { exists: Array.isArray(r) && r.length > 0, accessDenied: false };
    } catch (err: any) {
      logger.debug(`[CitationVerifier] Source check failed for ${type}/${id}: ${err?.message}`);
      return { exists: false, accessDenied: false };
    }
  }
}

export const citationVerifier = new CitationVerifierService();
export default citationVerifier;
export { CitationVerifierService };
