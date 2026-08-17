/**
 * AI Routes
 * Complete AI API - Enterprise PMO Brain
 */

import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';
import { Response, Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireActiveTenantMembership } from '../middleware/auditsStrictMembership.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { inferChatTaskPurpose } from '../services/ai/aiTaskCatalog.js';
import {
  buildNoWebSourcesText,
  buildProductAssistantFallback,
  isExplicitResearchAsk,
} from '../services/ai/chatStabilizationPolicy.js';
import { buildCitationStatusPayload } from '../services/ai/citationAccessStatus.js';
import type { VerificationReport } from '../services/ai/citationVerifier.js';
import { buildHelpDocsContext, isProductOrHowToQuery } from '../services/ai/helpDocsContext.js';
import {
  numericConfidenceFromVerification,
  verifyRuntimeCitations,
} from '../services/ai/runtimeCitationVerification.js';
// Krok C: wspólny helper Funkcji B (retrieval search_org_mindmaps) — koniec z
// surowym `process.env.ENABLE_TERESA_MINDMAP` w tym pliku.
import { isTeresaMindmapSearchEnabled } from '../services/ai/tools/orgRetrievalShared.js';
import {
  isDbr77ProductTruthQuery,
  type WorkerWebAccessPolicy,
} from '../services/ai/virtualWorkerWebAccessService.js';
import {
  triggerAIDependencyConflict,
  triggerAIOverloadDetected,
  triggerAIRecommendation,
  triggerAIRiskDetected,
} from '../services/aiNotificationTriggers.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import PDFParserService from '../services/pdfParserService.js';
import { hasPresentationCapability } from '../services/presentationAccessPolicyService.js';
import { buildWorkbookMutationPromptHint } from '../services/v8/teresaCopilotService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/ErrorHandler.js';
import { withRequestTimeout } from '../utils/withRequestTimeout.js';

// H5.2 — budżet czasu na wywołania LLM w trasach AI (raporty/deep-research).
const AI_CLARIFY_TIMEOUT_MS = 30_000;
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  AdvisorExecuteActionRequestSchema,
  AdvisorFeedbackRequestSchema,
  AdvisorRespondRequestSchema,
  AdvisorResponseIdParamSchema,
  AdvisorResponsesQuerySchema,
  normalizeToAdvisorResponse,
} from '../validators/advisorResponse.validators.js';
import {
  ActionIdParamSchema,
  ActionTypeParamSchema,
  AIAuthoringAuditRequestSchema,
  AIContextQuerySchema,
  AiGenerateRequestSchema,
  AIReadinessAnalysisRequestSchema,
  ApproveActionRequestSchema,
  AuditIdParamSchema,
  CalculateQualityRequestSchema,
  CanPerformActionQuerySchema,
  ChatConfirmRequestSchema,
  ChatQuickRequestSchema,
  ChatRequestSchema,
  ChatStreamRequestSchema,
  CreateDraftRequestSchema,
  ExecuteActionRequestSchema,
  ExportExplanationsQuerySchema,
  GenerateCardDraftRequestSchema,
  GenerateProposalsQuerySchema,
  GetAggregateQualityQuerySchema,
  GetAuditLogsQuerySchema,
  GetCurrentMemoryQuerySchema,
  GetExplanationsQuerySchema,
  GetMemoryLatencyQuerySchema,
  GetMemoryMetricsQuerySchema,
  GetPatternsQuerySchema,
  GetPendingActionsQuerySchema,
  GetQualityTrendsQuerySchema,
  GetSuggestionMetricsQuerySchema,
  GetSuggestionsQuerySchema,
  InitiativeConflictsRequestSchema,
  InitiativePrioritiesRequestSchema,
  PatternIdParamSchema,
  PostSuggestionsRequestSchema,
  ProjectIdParamSchema,
  RecommendRequestSchema,
  RecordAuditDecisionRequestSchema,
  RecordDecisionRequestSchema,
  RecordFeedbackRequestSchema,
  RecordSuggestionActionRequestSchema,
  RefineTextRequestSchema,
  RejectActionRequestSchema,
  ReportMessageRequestSchema,
  RoadmapRequestSchema,
  SessionIdParamSchema,
  ToggleAutoApplyRequestSchema,
  UpdatePolicyRequestSchema,
  UpdateUserPreferencesRequestSchema,
} from '../validators/ai.validators.js';

const router = Router();

/** Chat streaming is provider-bearing: stale role claims and SUPERADMIN do not
 * replace an authoritative ACTIVE tenant membership row. */
const requireActiveChatMembership = asyncHandler(
  async (req: AuthRequest, res: Response, next) => {
    const userId = String(req.userId || req.user?.id || '').trim();
    const organizationId = String(req.organizationId || req.user?.organizationId || '').trim();
    if (!userId || !organizationId) {
      return res.status(403).json({ code: 'ORG_MEMBERSHIP_REVOKED' });
    }
    try {
      const membership = await dbGet<{ status?: string }>(
        `SELECT status FROM organization_members WHERE user_id=? AND organization_id=?`,
        [userId, organizationId],
        { fallback: false }
      );
      if (String(membership?.status || '').toUpperCase() !== 'ACTIVE') {
        return res.status(403).json({ code: 'ORG_MEMBERSHIP_REVOKED' });
      }
    } catch (error) {
      logger.warn('[AI Stream] membership verification unavailable', {
        userId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(503).json({ code: 'ORG_MEMBERSHIP_UNVERIFIABLE' });
    }
    next();
  }
);

function isConnectorFreshDataAsk(message: unknown): boolean {
  const text = String(message || '').toLowerCase();
  const mentionsConnector =
    /\b(connector|connectors|integration|integrations|sql|database|db|postgres|mysql|warehouse|crm|salesforce|hubspot|konektor|konektora|integracja|baza|bazie)\b/i.test(
      text
    );
  const asksForFreshFact =
    /\b(current|latest|fresh|live|actual|active|count|how many|ile|aktualn|bieżąc|biezac|aktywn|rekord|klient|customer|query|sprawd[źz])\b/i.test(
      text
    );
  return mentionsConnector && asksForFreshFact;
}

function hasVerifiedConnectorResult(context: unknown): boolean {
  const external = (context as any)?.external || {};
  return Boolean(
    external?.connectorToolResult?.verified === true ||
    external?.connectorToolResult?.fresh === true ||
    external?.connectorQuery?.executed === true ||
    external?.toolResult?.connector === true
  );
}

async function getConnectorStatusSummary(organizationId?: string | null): Promise<string> {
  let statusSummary = 'No verified connector status was loaded for this answer.';
  if (!organizationId) return statusSummary;

  try {
    const rows = await dbAll<any>(
      `SELECT id, connector_id, connector_type, provider, status, last_sync_at, updated_at
       FROM integrations
       WHERE organization_id = ?
       ORDER BY updated_at DESC
       LIMIT 25`,
      [organizationId]
    );
    const relevantRows = (rows || []).filter((row) =>
      /sql|database|postgres|mysql|warehouse|crm|salesforce|hubspot/i.test(
        [row.connector_id, row.connector_type, row.provider, row.id].filter(Boolean).join(' ')
      )
    );
    const sample = (relevantRows.length > 0 ? relevantRows : rows || []).slice(0, 8).map((row) => {
      const name = row.connector_id || row.connector_type || row.provider || row.id || 'unknown';
      return `${name}: status=${row.status || 'unknown'}, lastSync=${row.last_sync_at || 'unknown'}`;
    });
    if (sample.length > 0) statusSummary = sample.join('; ');
  } catch (err: any) {
    logger.warn('[AI Stream] Connector honesty status lookup failed:', err?.message || err);
  }

  return statusSummary;
}

async function buildConnectorHonestyConstraint(params: {
  organizationId?: string | null;
  message: unknown;
  context: unknown;
}): Promise<string> {
  if (!isConnectorFreshDataAsk(params.message) || hasVerifiedConnectorResult(params.context)) {
    return '';
  }

  const statusSummary = await getConnectorStatusSummary(params.organizationId);

  return [
    '## HARD CONNECTOR DATA TRUST CONSTRAINT',
    'The user is asking for fresh/current data from a connector or production database.',
    `Known connector status snapshot: ${statusSummary}`,
    'You do NOT have a verified live connector query result in this request.',
    'Therefore you MUST NOT invent exact counts, records, customer numbers, SQL results, freshness timestamps, or claim that you queried production data.',
    'Answer with an honest access/freshness limitation, explain that the connector/query result is unavailable or unverified, and propose a governed reconnect/access/check workflow.',
    'If the user asks for mutation, keep using governed_execution and require approval.',
  ].join('\n');
}

async function buildConnectorHonestyBlockResponse(params: {
  organizationId?: string | null;
  message: unknown;
  context: unknown;
}): Promise<string> {
  if (!isConnectorFreshDataAsk(params.message) || hasVerifiedConnectorResult(params.context)) {
    return '';
  }

  const statusSummary = await getConnectorStatusSummary(params.organizationId);
  return [
    'Nie mogę podać aktualnej liczby rekordów klientów z produkcyjnej bazy SQL, bo w tym żądaniu nie mam zweryfikowanego wyniku live query z konektora.',
    '',
    `Stan konektorów widoczny dla backendu: ${statusSummary}`,
    '',
    'Nie będę zgadywać ani podawać liczby "z kapelusza". Bezpieczna ścieżka to: sprawdzić status konektora, odnowić połączenie/sekrety w trybie governed reconnect, uruchomić jawne read-only query z audytem, a dopiero potem raportować liczbę z timestampem i źródłem.',
  ].join('\n');
}

function isAIOpsHealthAsk(message: unknown): boolean {
  const text = String(message || '').toLowerCase();
  const mentionsOpsHealth =
    /\b(ai ops|aiops|provider|providers|model health|health|eval gate|deep research|kosztown|costly|degraded|blocked|awaria|zdrowi|zdrowe|providerzy)\b/i.test(
      text
    );
  const asksForRunDecision =
    /\b(can i|should i|safe|proceed|run|launch|uruchomi|odpali|bezpiecz|mogę|moge|czy mogę|czy moge)\b/i.test(
      text
    );
  return mentionsOpsHealth && asksForRunDecision;
}

async function buildAIOpsHealthConstraint(message: unknown): Promise<string> {
  if (!isAIOpsHealthAsk(message)) return '';

  const { hardBlock, statusSummary } = await getAIOpsHealthSnapshot();
  if (!hardBlock) return '';

  return [
    '## HARD AI OPS HEALTH CONSTRAINT',
    `Internal AI provider health snapshot: ${statusSummary}`,
    'The user is asking whether it is safe to run an expensive AI operation such as Deep Research.',
    'You MUST use the internal AI Ops health snapshot above, not public web information about general AI systems.',
    'Do NOT recommend starting expensive research, agents, or provider-heavy workflows while health is error/degraded/unknown, providers are unavailable, or the health monitor is not running.',
    'State the degraded/blocked posture plainly, explain the operational risk, and recommend checking provider configuration, eval gate, and AI Ops before proceeding.',
  ].join('\n');
}

async function getAIOpsHealthSnapshot(): Promise<{ hardBlock: boolean; statusSummary: string }> {
  let statusSummary = 'AI health status could not be loaded.';
  let hardBlock = true;
  try {
    const healthMonitor = (await import('../services/ai/healthMonitor.js')).default as any;
    const status = healthMonitor.getStatus?.() || {};
    const overall =
      (status?.lastCheck as { overall?: string } | null)?.overall || status?.status || 'error';
    const providers =
      status?.providers && typeof status.providers === 'object' ? status.providers : {};
    const providerCount = Object.keys(providers).length;
    const isRunning = Boolean(status?.isRunning);
    hardBlock = overall !== 'healthy' || providerCount === 0 || !isRunning;
    statusSummary = `overall=${overall}; providerCount=${providerCount}; isRunning=${isRunning}; consecutiveFailures=${status?.consecutiveFailures ?? 'unknown'}`;
  } catch (err: any) {
    logger.warn('[AI Stream] AI Ops health lookup failed:', err?.message || err);
  }

  return { hardBlock, statusSummary };
}

async function buildAIOpsHealthBlockResponse(message: unknown): Promise<string> {
  if (!isAIOpsHealthAsk(message)) return '';

  const { hardBlock, statusSummary } = await getAIOpsHealthSnapshot();
  if (!hardBlock) return '';

  return [
    'Nie rekomenduję uruchamiania kosztownego Deep Research ani innych provider-heavy workflow w tym stanie.',
    '',
    `Wewnętrzny AI Ops health snapshot: ${statusSummary}`,
    '',
    'To oznacza posture degraded/blocked dla kosztownych operacji. Najpierw trzeba naprawić konfigurację providerów, potwierdzić eval gate oraz koszt/budget posture, a dopiero potem uruchamiać Deep Research.',
  ].join('\n');
}

// Apply rate limiting to all AI routes
router.use(aiRateLimiter);

function isGovernedMutationApprovalBypassRequest(message: unknown): boolean {
  const text = String(message || '').toLowerCase();
  if (!text.trim()) return false;
  const mutationIntent =
    /\b(rename|change|update|edit|modify|create|delete|remove|archive|assign|move|set)\b/.test(
      text
    ) || /\b(zmień|zmien|edytuj|utw[oó]rz|usuń|usun|przypisz|przenieś|przenies|ustaw)\b/.test(text);
  const approvalBypass =
    /\b(without asking|without approval|do not ask|don't ask|no approval|silently)\b/.test(text) ||
    /\b(bez pytania|bez zgody|bez akceptacji|nie pytaj|po cichu)\b/.test(text);
  return mutationIntent && approvalBypass;
}

// -------------------- Chat attachments ingestion --------------------
// This is intentionally self-contained (no StorageService / KnowledgeService dependency).
const attachmentsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) return cb(null, true);
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// ==================== SHARED AI HANDLER PRELUDE (standard formula) ====================
// Single source of truth for the provider-availability + access-policy gate that
// every direct LLM endpoint needs. Returns an error descriptor to send, or null
// when the request may proceed (usage is incremented as a side effect).
async function ensureAiProviderAndAccess(
  req: AuthRequest
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const hasEnvProvider = !!String(process.env.OPENROUTER_API_KEY || '').trim();
  const hasDbProvider = !!(await dbGet(
    `SELECT 1 AS ok
       FROM llm_providers
       WHERE is_active = true AND provider = 'openrouter' AND api_key IS NOT NULL AND api_key != ''
       LIMIT 1`
  ));
  if (!hasEnvProvider && !hasDbProvider) {
    return {
      status: 500,
      body: {
        error: 'No LLM provider configured. Set OPENROUTER_API_KEY or configure OpenRouter.',
        code: 'NO_LLM_PROVIDER',
      },
    };
  }

  const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
  const aiAccessCheck = await AccessPolicyService.checkAccess(req.organizationId!, 'ai_call');
  if (!aiAccessCheck.allowed) {
    return {
      status: 403,
      body: {
        error: aiAccessCheck.reason || 'Access blocked',
        code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
      },
    };
  }
  AccessPolicyService.incrementUsage(req.organizationId!, 'ai_calls', 1).catch((err: any) => {
    logger.warn('[AI] Failed to increment ai_calls usage:', err?.message || err);
  });
  return null;
}

// Standard mapping for a failed direct llmService call.
function mapLlmCallError(error: any): { status: number; body: Record<string, unknown> } {
  if (error?.isBudgetError) {
    return {
      status: 403,
      body: {
        error: error.message,
        code: 'AI_BUDGET_EXHAUSTED',
        budgetStatus: error.budgetStatus,
      },
    };
  }
  return { status: 502, body: { error: 'LLM call failed', code: 'LLM_CALL_FAILED' } };
}

router.post(
  '/attachments/ingest',
  verifyToken,
  requireActiveTenantMembership,
  attachmentsUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const filename = String(req.file.originalname || 'attachment');
    const mimeType = String(req.file.mimetype || '');
    const docId = uuidv4();

    // Extract text from buffer
    let text = '';
    try {
      if (mimeType === 'application/pdf') {
        text = await PDFParserService.extractTextFromBuffer(req.file.buffer);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.toLowerCase().endsWith('.docx')
      ) {
        const mammothMod = (await import('mammoth')) as any;
        const mammoth = mammothMod.default || mammothMod;
        const out = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = String(out?.value || '');
      } else {
        text = req.file.buffer.toString('utf8');
      }
    } catch (err: any) {
      logger.warn('[AI Attachments] Text extraction failed:', err?.message || String(err));
      text = '';
    }

    if (!text || text.trim().length === 0) {
      const isPdf = mimeType === 'application/pdf';
      return res.status(400).json({
        error: isPdf
          ? 'Could not extract text from PDF. The file may be scanned, empty, encrypted, or corrupted.'
          : 'Could not extract any text from file',
        code: isPdf ? 'PDF_TEXT_EXTRACTION_FAILED' : 'TEXT_EXTRACTION_FAILED',
        extractionStatus: isPdf ? 'ocr_required_or_unreadable' : 'failed',
        attachmentState: isPdf ? 'ocr_required' : 'unreadable',
        sourceClass: 'attachment',
        recoverable: isPdf,
        filename,
        mimeType,
      });
    }

    const makeChunks = (raw: string): Array<{ chunkIndex: number; content: string }> => {
      const normalized = String(raw || '')
        .replace(/\r\n/g, '\n')
        .trim();
      const MAX = 1200;
      const OVERLAP = 150;
      const out: Array<{ chunkIndex: number; content: string }> = [];
      if (!normalized) return out;

      const paras = normalized
        .split(/\n\s*\n/g)
        .map((p) => p.trim())
        .filter(Boolean);

      let buf = '';
      const flush = () => {
        const c = buf.trim();
        if (c) out.push({ chunkIndex: out.length, content: c });
        buf = '';
      };

      const pushLong = (p: string) => {
        const s = p.trim();
        if (!s) return;
        if (s.length <= MAX) {
          out.push({ chunkIndex: out.length, content: s });
          return;
        }
        let i = 0;
        while (i < s.length) {
          const chunk = s.slice(i, i + MAX).trim();
          if (chunk) out.push({ chunkIndex: out.length, content: chunk });
          if (i + MAX >= s.length) break;
          i = Math.max(0, i + MAX - OVERLAP);
        }
      };

      for (const p of paras) {
        if (!p) continue;
        if (!buf) {
          if (p.length <= MAX) buf = p;
          else pushLong(p);
          continue;
        }
        if (buf.length + 2 + p.length <= MAX) {
          buf += `\n\n${p}`;
        } else {
          flush();
          if (p.length <= MAX) buf = p;
          else pushLong(p);
        }
      }
      flush();
      if (out.length === 0) pushLong(normalized);
      return out;
    };

    const ragModule = await import('../services/ragService.js');
    const ragService = (ragModule.default || ragModule) as any;

    const chunks = makeChunks(text);
    const rawIdempotencyKey = String(req.get('Idempotency-Key') || '').trim();
    if (rawIdempotencyKey.length > 200) {
      return res.status(400).json({ code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const requestHash = createHash('sha256')
      .update(filename)
      .update('\0')
      .update(mimeType)
      .update('\0')
      .update(req.file.buffer)
      .digest('hex');
    const fileHash = createHash('sha256').update(req.file.buffer).digest('hex');

    const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
    const client = await getPoolClientForPinnedTransaction();
    try {
      await client.query('BEGIN');
      if (rawIdempotencyKey) {
        const reservation = await client.query(
          `INSERT INTO organization_context_upload_receipts
             (organization_id, idempotency_key, request_hash, status)
           VALUES ($1, $2, $3, 'PROCESSING')
           ON CONFLICT (organization_id, idempotency_key) DO NOTHING
           RETURNING idempotency_key`,
          [orgId, rawIdempotencyKey, requestHash]
        );
        if (reservation.rowCount === 0) {
          const existing = await client.query<{
            request_hash: string;
            status: string;
            response_json: Record<string, unknown> | null;
          }>(
            `SELECT request_hash, status, response_json
               FROM organization_context_upload_receipts
              WHERE organization_id=$1 AND idempotency_key=$2
              FOR UPDATE`,
            [orgId, rawIdempotencyKey]
          );
          const receipt = existing.rows[0];
          if (!receipt || receipt.request_hash !== requestHash) {
            await client.query('ROLLBACK');
            return res.status(409).json({ code: 'IDEMPOTENCY_KEY_REUSED' });
          }
          if (receipt.status === 'COMPLETED' && receipt.response_json) {
            await client.query('COMMIT');
            return res.status(200).json({ ...receipt.response_json, replayed: true });
          }
          await client.query('ROLLBACK');
          return res.status(409).json({ code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
        }
      }

      let embeddedChunks = 0;
      const embedded: Array<{ chunkIndex: number; content: string; embedding: unknown[] }> = [];
      for (const c of chunks) {
        const chunkIndex = Number(c.chunkIndex || 0);
        const content = String(c.content || '').trim();
        if (!content) continue;
        const embedding = await ragService.generateEmbedding(content);
        embedded.push({
          chunkIndex,
          content,
          embedding: Array.isArray(embedding) ? embedding : [],
        });
        if (embedding && Array.isArray(embedding) && embedding.length > 0) embeddedChunks += 1;
      }

      await client.query(
        `INSERT INTO knowledge_docs
         (id, filename, filepath, status, organization_id, source_type, file_hash, version, created_at)
         VALUES ($1, $2, $3, 'ready', $4, 'document_extraction', $5, 1, CURRENT_TIMESTAMP)`,
        [docId, filename, '', orgId, fileHash]
      );
      for (const chunk of embedded) {
        await client.query(
          `INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `${docId}-chk-${chunk.chunkIndex}`,
            docId,
            chunk.content,
            chunk.chunkIndex,
            JSON.stringify(chunk.embedding),
          ]
        );
      }

      await organizationContextService.recordAttachmentExtraction({
        organizationId: orgId,
        userId: req.userId || null,
        payload: {
          docId,
          filename,
          mimeType,
          extractedText: text,
          totalChunks: chunks.length,
          embeddedChunks,
        },
        writeExecutor: async (sql, params) => client.query(sql, params),
      });
      const responseBody = {
        success: true,
        docId,
        filename,
        mimeType,
        extractionStatus: 'extracted',
        totalChunks: chunks.length,
        embeddedChunks,
      };
      if (rawIdempotencyKey) {
        await client.query(
          `UPDATE organization_context_upload_receipts
              SET status='COMPLETED', document_id=$3, response_json=$4::jsonb,
                  completed_at=CURRENT_TIMESTAMP
            WHERE organization_id=$1 AND idempotency_key=$2 AND status='PROCESSING'`,
          [orgId, rawIdempotencyKey, docId, JSON.stringify(responseBody)]
        );
      }
      await client.query('COMMIT');
      return res.status(201).json(responseBody);
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        logger.error('[AI Attachments] Rollback failed:', rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }

  })
);

// -------------------- URL attachments ingestion --------------------
// Fetches a public URL, extracts text, chunks, stores into knowledge_docs/knowledge_chunks.
// Policy: requires org internetEnabled (but does NOT depend on Tavily).
const IngestUrlAttachmentRequestSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().min(1).max(200).optional(),
});

router.post(
  '/attachments/ingest-url',
  verifyToken,
  validateBody(IngestUrlAttachmentRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const inputUrl = String((req.body as any)?.url || '').trim();
    const providedTitle = String((req.body as any)?.title || '').trim();

    let urlObj: URL;
    try {
      urlObj = new URL(inputUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http(s) URLs are supported' });
    }

    // Enforce org internet policy (independent from Tavily).
    try {
      const polMod = await import('../services/aiPolicyEngine.js');
      const AIPolicyEngine = (polMod.default || polMod) as any;
      const policy = await AIPolicyEngine.getEffectivePolicy(
        orgId,
        null,
        (req as any)?.userId || null
      );
      if (!policy?.internetEnabled) {
        return res.status(403).json({ error: 'Internet access is disabled by policy' });
      }
    } catch (err: any) {
      logger.warn('[AI URL Attachments] Policy engine unavailable:', err?.message || String(err));
      return res.status(403).json({ error: 'Internet access is disabled by policy' });
    }

    // SSRF + domain allow/deny checks (reuse governance utility; does not require Tavily)
    let isUrlSafeFn: any = null;
    let getDefaultPolicyFn: any = null;
    try {
      const gov = await import('../services/ai/webSearchGovernance.js');
      isUrlSafeFn = (gov as any).isUrlSafe || (gov as any).default?.isUrlSafe;
      getDefaultPolicyFn = (gov as any).getDefaultPolicy || (gov as any).default?.getDefaultPolicy;
    } catch {
      // ignore; we will fallback to a minimal check below
    }

    if (typeof isUrlSafeFn === 'function' && typeof getDefaultPolicyFn === 'function') {
      const basePolicy = getDefaultPolicyFn();
      const check = isUrlSafeFn(inputUrl, { ...basePolicy, internetEnabled: true });
      if (!check?.safe) {
        return res.status(400).json({ error: check?.reason || 'URL blocked by security policy' });
      }
    } else {
      // Minimal SSRF check fallback (block localhost/private ranges)
      const s = inputUrl.toLowerCase();
      if (
        s.startsWith('http://localhost') ||
        s.startsWith('https://localhost') ||
        s.startsWith('http://127.') ||
        s.startsWith('https://127.') ||
        s.startsWith('http://10.') ||
        s.startsWith('https://10.') ||
        s.startsWith('http://192.168.') ||
        s.startsWith('https://192.168.') ||
        s.startsWith('http://0.0.0.0') ||
        s.startsWith('https://0.0.0.0')
      ) {
        return res.status(400).json({ error: 'URL blocked by security policy' });
      }
    }

    const MAX_BYTES = 6 * 1024 * 1024; // 6MB
    const MAX_TEXT_CHARS = 220_000;

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let resp: globalThis.Response;
    try {
      resp = await fetch(inputUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'ConsultifyBot/1.0 (+attachments/ingest-url)',
          accept: 'text/html,text/plain,application/pdf;q=0.9,*/*;q=0.1',
        },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      const msg = String(err?.name || err?.message || err);
      return res.status(502).json({ error: `Failed to fetch URL (${msg})` });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      return res.status(502).json({ error: `Failed to fetch URL (HTTP ${resp.status})` });
    }

    const finalUrl = String((resp as any)?.url || inputUrl);
    if (
      finalUrl &&
      finalUrl !== inputUrl &&
      typeof isUrlSafeFn === 'function' &&
      typeof getDefaultPolicyFn === 'function'
    ) {
      const basePolicy = getDefaultPolicyFn();
      const check = isUrlSafeFn(finalUrl, { ...basePolicy, internetEnabled: true });
      if (!check?.safe) {
        return res
          .status(400)
          .json({ error: check?.reason || 'Redirected URL blocked by security policy' });
      }
    }

    const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
    let buf: Buffer;
    try {
      const ab = await resp.arrayBuffer();
      buf = Buffer.from(ab);
    } catch (err: any) {
      return res.status(502).json({ error: 'Failed to read URL response body' });
    }

    if (buf.byteLength > MAX_BYTES) {
      return res.status(413).json({ error: `URL content too large (${buf.byteLength} bytes)` });
    }

    // Extract text
    let extractedText = '';
    let detectedTitle = providedTitle;
    let detectedMimeType = contentType || 'text/plain';

    try {
      const isPdf =
        contentType.includes('application/pdf') ||
        finalUrl.toLowerCase().includes('.pdf') ||
        urlObj.pathname.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        detectedMimeType = 'application/pdf';
        extractedText = await PDFParserService.extractTextFromBuffer(buf);
      } else if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        detectedMimeType = 'text/html';
        const html = buf.toString('utf8');
        const $ = cheerio.load(html);
        $('script, style, noscript, svg, canvas, iframe').remove();
        if (!detectedTitle) {
          const t = String($('title').first().text() || '').trim();
          if (t) detectedTitle = t;
        }
        const bodyText = $('body').text();
        extractedText = String(bodyText || '');
      } else {
        // Treat as plain text; best-effort utf8 decode.
        extractedText = buf.toString('utf8');
      }
    } catch (err: any) {
      logger.warn('[AI URL Attachments] Text extraction failed:', err?.message || String(err));
      extractedText = '';
    }

    extractedText = String(extractedText || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    if (!extractedText) {
      return res.status(400).json({ error: 'Could not extract any text from URL' });
    }
    if (extractedText.length > MAX_TEXT_CHARS) {
      extractedText = extractedText.slice(0, MAX_TEXT_CHARS);
    }

    const hostname = (() => {
      try {
        return new URL(finalUrl).hostname;
      } catch {
        return urlObj.hostname;
      }
    })();
    const fallbackName =
      `${hostname}${urlObj.pathname || ''}`.replace(/\/+$/, '') || hostname || 'url';
    const filename = (detectedTitle || fallbackName).slice(0, 180);
    const docId = uuidv4();

    // M01-P04C: see the identical comment on the `/attachments/ingest`
    // handler above — `organization_id`/`category` set in the SAME INSERT,
    // not a separate try/catch-swallowed UPDATE that could leave the row
    // with an unresolved (NULL) owner.
    await dbRun(
      `INSERT INTO knowledge_docs (id, filename, filepath, status, organization_id, category, created_at)
       VALUES (?, ?, ?, 'indexed', ?, 'chat_url_attachment', CURRENT_TIMESTAMP)`,
      [docId, filename, finalUrl || inputUrl, orgId],
      { fallback: true } as any
    );

    const makeChunks = (raw: string): Array<{ chunkIndex: number; content: string }> => {
      const normalized = String(raw || '')
        .replace(/\r\n/g, '\n')
        .trim();
      const MAX = 1200;
      const OVERLAP = 150;
      const out: Array<{ chunkIndex: number; content: string }> = [];
      if (!normalized) return out;

      const paras = normalized
        .split(/\n\s*\n/g)
        .map((p) => p.trim())
        .filter(Boolean);

      let buf = '';
      const flush = () => {
        const c = buf.trim();
        if (c) out.push({ chunkIndex: out.length, content: c });
        buf = '';
      };

      const pushLong = (p: string) => {
        const s = p.trim();
        if (!s) return;
        if (s.length <= MAX) {
          out.push({ chunkIndex: out.length, content: s });
          return;
        }
        let i = 0;
        while (i < s.length) {
          const chunk = s.slice(i, i + MAX).trim();
          if (chunk) out.push({ chunkIndex: out.length, content: chunk });
          if (i + MAX >= s.length) break;
          i = Math.max(0, i + MAX - OVERLAP);
        }
      };

      for (const p of paras) {
        if (!p) continue;
        if (!buf) {
          if (p.length <= MAX) buf = p;
          else pushLong(p);
          continue;
        }
        if (buf.length + 2 + p.length <= MAX) {
          buf += `\n\n${p}`;
        } else {
          flush();
          if (p.length <= MAX) buf = p;
          else pushLong(p);
        }
      }
      flush();
      if (out.length === 0) pushLong(normalized);
      return out;
    };

    const ragModule = await import('../services/ragService.js');
    const ragService = (ragModule.default || ragModule) as any;

    const chunks = makeChunks(extractedText);
    let embeddedChunks = 0;
    for (const c of chunks) {
      const chunkIndex = Number(c.chunkIndex || 0);
      const content = String(c.content || '').trim();
      if (!content) continue;
      const embedding = await ragService.generateEmbedding(content);
      await dbRun(
        `INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, embedding)
         VALUES (?, ?, ?, ?, ?)`,
        [`${docId}-chk-${chunkIndex}`, docId, content, chunkIndex, JSON.stringify(embedding || [])],
        { fallback: true } as any
      );
      if (embedding && Array.isArray(embedding) && embedding.length > 0) embeddedChunks += 1;
    }

    await organizationContextService.recordAttachmentExtraction({
      organizationId: orgId,
      userId: req.userId || null,
      payload: {
        docId,
        filename,
        mimeType: detectedMimeType,
        sourceUrl: finalUrl || inputUrl,
        extractedTextPreview: extractedText.slice(0, 2000),
        totalChunks: chunks.length,
        embeddedChunks,
      },
    });

    return res.status(201).json({
      success: true,
      docId,
      filename,
      mimeType: detectedMimeType,
      sourceUrl: finalUrl || inputUrl,
      totalChunks: chunks.length,
      embeddedChunks,
    });
  })
);

// Lazy load services to avoid circular dependencies

const getAIContextBuilder = async () =>
  (await import('../services/aiContextBuilder.js')).default as any;
const getAIPolicyEngine = async () =>
  (await import('../services/aiPolicyEngine.js')).default as any;
const getAIMemoryManager = async () =>
  (await import('../services/aiMemoryManager.js')).default as any;
const getAIOrchestrator = async () =>
  (await import('../services/aiOrchestrator.js')).default as any;
const getAIActionExecutor = async () =>
  (await import('../services/aiActionExecutor.js')).default as any;
const getAIAuditLogger = async () => (await import('../services/aiAuditLogger.js')).default as any;
const getAIPipeline = async () => {
  const { AIPipeline } = (await import('../services/ai/AIPipeline.js')) as any;
  return new AIPipeline();
};

// ==================== CONTEXT ====================

router.get(
  '/context',
  verifyToken,
  validateQuery(AIContextQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIContextBuilder = await getAIContextBuilder();
      const context = await AIContextBuilder.buildContext(
        req.userId as string,
        req.organizationId as string,
        null,
        { currentScreen: (req.query as any).screen as string | undefined }
      );
      return res.json(context);
    } catch (err: any) {
      // Read — side context assembly for the AI assistant panel (platform/org/project
      // snapshot). Non-critical enrichment: the chat pipeline can proceed with a
      // thinner context. Fail-soft degrade instead of a bare 500 (H6.4).
      logger.warn('[AI Routes] Context build degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ degraded: true, focusMode: 'all', builtAt: new Date().toISOString() });
    }
  })
);

router.get(
  '/context/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateQuery(AIContextQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIContextBuilder = await getAIContextBuilder();
      const context = await AIContextBuilder.buildContext(
        req.userId as string,
        req.organizationId as string,
        req.params.projectId,
        { currentScreen: (req.query as any).screen as string | undefined }
      );
      return res.json(context);
    } catch (err: any) {
      // Read — same non-critical context enrichment as GET /context, scoped to a
      // project. Fail-soft degrade instead of a bare 500 (H6.4).
      logger.warn('[AI Routes] Project context build degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ degraded: true, focusMode: 'all', builtAt: new Date().toISOString() });
    }
  })
);

// ==================== CHAT ====================

/**
 * Deep Research: Generate clarification questions before research.
 * Returns 2-3 targeted questions with options to focus the research scope.
 */
router.post(
  '/deep-research/clarify',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message } = req.body as { message: string };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      const { generateClarificationQuestions } =
        await import('../services/ai/deepResearchService.js');

      // Use a lightweight LLM client for clarification
      const { default: modelRouter } = await import('../services/ai/modelRouter.js');
      const { llmService } = await import('../services/ai/llmService.js');

      const modelCfg = await modelRouter.select({
        capability: 'chat_simple',
        organizationId: req.organizationId || undefined,
        options: { tier: 'BUDGET' },
      } as any);

      // Build a simple OpenAI-compatible client wrapper
      const llmClient = {
        chat: {
          completions: {
            create: async (params: any) => {
              const result = (await llmService.call({
                type: 'chat',
                modelConfig: {
                  provider: modelCfg.provider,
                  id: modelCfg.id,
                  endpoint: (modelCfg as any).endpoint,
                  apiKey: (modelCfg as any).apiKey,
                },
                systemPrompt: '',
                messages: params.messages,
                maxTokens: params.max_tokens || 1000,
                temperature: params.temperature ?? 0.3,
              })) as any;

              return {
                choices: [{ message: { content: result?.content || String(result) } }],
              };
            },
          },
        },
      };

      // H5.2 — LLM call z budżetem czasu; timeout ⇒ AppError(504) obsłużony
      // centralnie (log z correlation-id, stabilny { code }).
      const result = await withRequestTimeout(
        generateClarificationQuestions(message, llmClient),
        AI_CLARIFY_TIMEOUT_MS,
        {
          code: 'AI_CLARIFY_TIMEOUT',
          message: 'Generowanie pytań doprecyzowujących przekroczyło limit czasu',
        }
      );

      return res.json({
        success: true,
        ...result,
        researchType: (() => {
          try {
            const { detectResearchType } = require('../services/ai/deepResearchService.js');
            return detectResearchType(message);
          } catch {
            return 'general_research';
          }
        })(),
      });
    } catch (error: any) {
      // Timeout (504) i inne błędy operacyjne przekaż do centralnego middleware,
      // by nie zostały zamaskowane gołym 500 bez kodu/correlation-id.
      if (error instanceof AppError) throw error;
      logger.error('[AI Routes] Clarification generation failed:', error);
      return res.status(500).json({ error: 'Failed to generate clarification questions' });
    }
  })
);

/**
 * GET /api/ai/co-thinker/modes
 * Returns available Co-Thinker modes for the UI.
 */
router.get(
  '/co-thinker/modes',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const { getAvailableCoThinkerModes } = await import('../services/ai/coThinkerService.js');
      const modes = getAvailableCoThinkerModes();
      return res.json({ modes });
    } catch (err: any) {
      logger.warn('[AI Routes] Co-Thinker modes fetch failed:', err?.message);
      return res.json({ modes: [] });
    }
  })
);

/**
 * POST /api/ai/deep-research/export
 * Export a deep research report as a structured document.
 */
router.post(
  '/deep-research/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { conversationId, format } = req.body as {
      conversationId: string;
      format?: 'markdown' | 'html' | 'pdf';
    };

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    try {
      const dbMod = await import('../utils/DbPromise.js');
      const db = dbMod;

      const messages = (await db.all(
        `SELECT content, metadata, role FROM conversation_messages
         WHERE conversation_id = ? AND role = 'ai'
         ORDER BY created_at DESC LIMIT 1`,
        [conversationId]
      )) as any[];

      if (!messages.length) {
        return res.status(404).json({ error: 'No AI messages found in conversation' });
      }

      const content = messages[0].content || '';
      const exportFormat = format || 'markdown';

      return res.json({
        success: true,
        format: exportFormat,
        content,
        exportedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[AI Routes] Deep research export failed:', error);
      return res.status(500).json({ error: 'Failed to export research report' });
    }
  })
);

/**
 * Engagement Summary (R13)
 *
 * Generates periodic engagement reports (weekly/monthly) as downloadable artifacts.
 */
router.post(
  '/engagement-summary',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      period = 'weekly',
      projectId,
      language,
    } = req.body as {
      period?: 'weekly' | 'monthly';
      projectId?: string;
      language?: string;
    };

    try {
      const { engagementSummaryService } =
        await import('../services/ai/engagementSummaryService.js');

      const summary = await engagementSummaryService.generateSummary({
        organizationId: req.organizationId || '',
        projectId: projectId || undefined,
        userId: req.userId || '',
        period,
        language: language || 'en',
      });

      const artifact = engagementSummaryService.formatAsArtifact(summary, language);

      return res.json({
        success: true,
        summary,
        artifact,
      });
    } catch (err: any) {
      logger.error('[AI] Engagement summary error:', err);
      return res.status(500).json({ error: 'Failed to generate engagement summary' });
    }
  })
);

/**
 * Industry Benchmarks (R9)
 *
 * Returns benchmark data and comparisons for the organization's industry.
 */
router.post(
  '/benchmarks/compare',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { industry, scores } = req.body as {
      industry: string;
      scores?: Array<{ axis: string; score: number }>;
    };

    try {
      const { industryBenchmarkService } =
        await import('../services/ai/industryBenchmarkService.js');

      if (scores && scores.length > 0) {
        const comparisons = industryBenchmarkService.compareToBenchmarks(industry, scores);
        return res.json({ success: true, comparisons });
      }

      const benchmarks = industryBenchmarkService.getBenchmarks(industry);
      return res.json({ success: true, benchmarks });
    } catch (err: any) {
      logger.error('[AI] Benchmark comparison error:', err);
      return res.status(500).json({ error: 'Failed to get benchmarks' });
    }
  })
);

/**
 * T121: Conversation-scoped approval for `requires_approval` documents.
 * Allows a user to explicitly approve a document for AI access within a conversation.
 */
router.post(
  '/documents/:id/approve',
  verifyToken,
  validateBody(
    z.object({
      conversationId: z.string().min(1, 'conversationId is required'),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const docId = String(req.params.id || '').trim();
    const conversationId = String((req.body as any)?.conversationId || '').trim();
    if (!req.userId || !req.organizationId) return res.status(401).json({ error: 'Unauthorized' });
    if (!docId) return res.status(400).json({ error: 'Invalid document id' });

    const { approveDocumentForConversation } = await import('../services/ai/documentGovernance.js');
    await approveDocumentForConversation({
      conversationId,
      documentId: docId,
      userId: req.userId,
      organizationId: req.organizationId,
    });

    return res.json({ success: true });
  })
);

/**
 * Deep Thinking: Confirm Understanding (blocking gate)
 *
 * Returns a decision-ready paraphrase of the user's task + minimal questions/gaps
 * before running expensive Deep Thinking / research.
 */
router.post(
  '/chat/confirm',
  verifyToken,
  validateBody(ChatConfirmRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      message: string;
      history?: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }>;
      systemInstruction?: string;
      context?: Record<string, unknown>;
      roleName?: string;
      language?: string;
      conversationId?: string;
      projectId?: string;
      screenContext?: Record<string, unknown>;
      focusMode?: string;
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
      aiModes?: {
        deepResearch?: boolean;
        webSearch?: boolean;
        showReasoning?: boolean;
        multiAgent?: boolean;
        marketResearch?: boolean;
        coThinkerMode?: string | null;
      };
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?:
        | 'normal'
        | 'executive'
        | 'analyst'
        | 'coach'
        | 'concise'
        | 'formal'
        | 'professional'
        | 'friendly';
    };

    const {
      message,
      history,
      systemInstruction,
      context,
      roleName,
      language,
      selectedTier,
      selectedModelId,
      aiModes,
      knowledgeSources,
      responseStyle,
      projectId: bodyProjectId,
      screenContext: bodyScreenContext,
      focusMode: bodyFocusMode,
    } = body;

    // --- Provider + access gate (standard formula) ---
    const aiGate = await ensureAiProviderAndAccess(req);
    if (aiGate) return res.status(aiGate.status).json(aiGate.body);

    // Language instruction (keep behavior consistent with stream)
    const languageMap: Record<string, string> = {
      pl: 'Polish (Polski)',
      en: 'English',
      de: 'German (Deutsch)',
      es: 'Spanish (Español)',
      ja: 'Japanese (日本語)',
      jp: 'Japanese (日本語)',
      ar: 'Arabic (العربية)',
    };
    const langCode = (language || 'en').split('-')[0];
    const langName = languageMap[langCode] || 'English';
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: You MUST always respond in ${langName}. This is the user's chosen application language and takes absolute priority. Even if the user writes their message in a different language, your response must be in ${langName}. This is non-negotiable.]\n`;

    // Confirm schema (structured output)
    // NOTE: OpenAI Structured Outputs requires ALL properties to be in 'required' array.
    // All fields must be required (no .optional() or .default()) for OpenAI compatibility.
    const ConfirmSchema = z.object({
      understanding: z.object({
        goal: z.string().describe('The main goal or objective of the user request'),
        context: z.string().describe('Additional context about the request'),
        constraints: z.array(z.string()).describe('Any constraints or limitations'),
        expectedOutput: z
          .enum(['Decision', 'StructuredAnalysis', 'FullReport'])
          .describe('The type of output expected'),
        decisionHorizon: z.string().describe('Time horizon for the decision'),
      }),
      isClearEnoughToProceed: z
        .boolean()
        .describe('Whether the request is clear enough to proceed'),
      missingInfoQuestions: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the question'),
            question: z.string().describe('The question to ask'),
            whyItMatters: z.string().describe('Why this question is important'),
          })
        )
        .describe('Questions to clarify missing information'),
      researchPlanItems: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the research item'),
            type: z
              .enum(['ConceptualFrameworks', 'PriorPatterns', 'UserInputs', 'ExternalReferences'])
              .describe('Type of research'),
            label: z.string().describe('Label for the research item'),
            rationale: z.string().describe('Why this research is needed'),
          })
        )
        .describe('Planned research items'),
      suggestedDepth: z.enum(['Light', 'Standard', 'Hard']).describe('Suggested depth of analysis'),
    });

    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { modelMeetsRequirements } = await import('../services/ai/modelCapabilities.js');
    const { llmService } = await import('../services/ai/llmService.js');

    // Select a model that supports Structured Outputs (JSON Schema).
    // This is a hard contract requirement for the confirm step.
    const tier = (selectedTier || 'BUDGET') as any;
    const requirements = { structured_outputs: true as const };

    let modelCfg: any = null;
    if (selectedModelId) {
      try {
        const cfg = await modelRouter.getProviderConfig(selectedModelId, tier);
        if (modelMeetsRequirements(cfg.id, requirements)) {
          modelCfg = cfg;
        }
      } catch {
        // ignore
      }
    }

    if (!modelCfg) {
      modelCfg = await modelRouter.select({
        capability: 'chat_confirm',
        organizationId: req.organizationId,
        tier,
        requirements,
      } as any);
    }

    logger.info('[AI Confirm] Using model:', modelCfg.id, 'provider:', modelCfg.provider);

    const compactHistory = (history || []).slice(-8).map((m) => ({
      role: m.role === 'model' ? 'assistant' : (m.role as any),
      content: (m as any).parts?.[0]?.text || m.content || '',
    }));

    const focusMode = (context as any)?.focusMode || bodyFocusMode || 'all';
    const projectId = (context as any)?.projectId || bodyProjectId || null;
    const screenContext = (context as any)?.screenContext || bodyScreenContext || null;

    const sys = [
      (systemInstruction || '') + languageInstruction,
      'You are running Deep Thinking Mode – Confirm Understanding.',
      'Your ONLY job is to paraphrase the task into a decision-ready framing and list minimal gaps/questions.',
      'Do NOT provide solutions yet. Do NOT start analysis. Be concise.',
      'Ask clarification questions only when missing information would block any useful analysis. For strategic prompts like "analyze", "compare", or "evaluate", proceed with explicit assumptions instead of asking more questions.',
      'If the recent history already contains a Deep Thinking confirm/clarification step, do not ask the same clarification again.',
      'Return ONLY valid JSON matching the provided schema.',
    ].join('\n');

    const user = [
      `User task: ${message}`,
      '',
      `Context hints (may be empty):`,
      `- focusMode: ${String(focusMode)}`,
      `- projectId: ${String(projectId)}`,
      `- hasScreenContext: ${screenContext ? 'yes' : 'no'}`,
      `- aiModes: ${JSON.stringify(aiModes || {})}`,
      `- knowledgeSources: ${JSON.stringify(knowledgeSources || {})}`,
      `- responseStyle: ${String(responseStyle || 'normal')}`,
    ].join('\n');

    logger.info(
      '[AI Confirm] Calling LLM with model:',
      modelCfg.id,
      'provider:',
      modelCfg.provider
    );
    logger.info(
      '[AI Confirm] History length:',
      compactHistory.length,
      'User prompt length:',
      user.length
    );

    let result: any;
    try {
      result = (await llmService.callStructured({
        type: 'chat',
        modelConfig: {
          provider: modelCfg.provider,
          id: modelCfg.id,
          endpoint: (modelCfg as any).endpoint,
          apiKey: (modelCfg as any).apiKey,
        },
        systemPrompt: sys,
        messages: [
          ...compactHistory.filter((m) => m.content && String(m.content).trim().length > 0),
          { role: 'user', content: user },
        ],
        schema: ConfirmSchema,
      } as any)) as any;
    } catch (llmError: any) {
      logger.error('[AI Confirm] LLM call failed:', llmError?.message || llmError);
      logger.error('[AI Confirm] LLM error stack:', llmError?.stack);
      throw llmError;
    }

    logger.info('[AI Confirm] LLM call succeeded, returning result');
    const confirmObject = result.object || {};
    const promptLooksActionable =
      String(message || '').trim().length >= 20 &&
      /\b(anali[sz]|analyse|analyze|compare|porówn|porown|oceń|ocen|evaluate|strateg|pozycjon|kierunk)\b/i.test(
        String(message || '')
      );
    if (promptLooksActionable || confirmObject.isClearEnoughToProceed === true) {
      confirmObject.isClearEnoughToProceed = true;
      confirmObject.missingInfoQuestions = [];
    }

    return res.json({
      confirm: confirmObject,
      metadata: {
        provider: modelCfg.provider,
        model: modelCfg.id,
        projectId,
        focusMode,
      },
    });
  })
);

router.post(
  '/chat/stream',
  verifyToken,
  requireActiveChatMembership,
  validateBody(ChatStreamRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      message: string;
      history?: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }>;
      systemInstruction?: string;
      context?: Record<string, unknown>;
      roleName?: string;
      language?: string;
      conversationId?: string;
      resumeFromPartial?: boolean;
      // Extended AI chat configuration (ToolsMenu + routing)
      projectId?: string;
      screenContext?: Record<string, unknown>;
      focusMode?: string;
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
      provider?: string;
      endpoint?: string;
      privateMode?: boolean;
      assistantScope?: 'anna_public' | 'teresa_tenant';
      memoryScope?: 'public_product' | 'tenant' | 'org' | 'user' | 'project';
      aiModes?: {
        deepResearch?: boolean;
        webSearch?: boolean;
        showReasoning?: boolean;
        multiAgent?: boolean;
        marketResearch?: boolean;
        coThinkerMode?: string | null;
      };
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?:
        | 'normal'
        | 'executive'
        | 'analyst'
        | 'coach'
        | 'concise'
        | 'formal'
        | 'professional'
        | 'friendly';
    };

    const {
      message,
      history,
      systemInstruction,
      context,
      roleName,
      language,
      conversationId,
      resumeFromPartial,
      projectId: bodyProjectId,
      screenContext: bodyScreenContext,
      focusMode: bodyFocusMode,
      selectedTier,
      selectedModelId,
      provider: bodyProvider,
      endpoint: bodyEndpoint,
      privateMode,
      aiModes,
      knowledgeSources,
      responseStyle,
    } = body;

    // Security: prevent user-controlled arbitrary endpoints on production by default.
    // Local inference is expected to be loopback-only unless explicitly allowed.
    const isLoopbackEndpoint = (raw: string) => {
      try {
        const u = new URL(raw);
        const host = String(u.hostname || '').toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
      } catch {
        return false;
      }
    };

    const providerLower = String(bodyProvider || '').toLowerCase();
    if (providerLower === 'ollama') {
      const allowInProd = String(process.env.ENABLE_USER_LOCAL_LLM || '').toLowerCase() === 'true';
      if (process.env.NODE_ENV === 'production' && !allowInProd) {
        return res.status(400).json({
          error: 'Local inference is disabled on this environment.',
          code: 'LOCAL_LLM_DISABLED',
        });
      }
      if (bodyEndpoint && !isLoopbackEndpoint(bodyEndpoint)) {
        return res.status(400).json({
          error: 'Invalid local inference endpoint. Only loopback endpoints are allowed.',
          code: 'LOCAL_LLM_ENDPOINT_NOT_ALLOWED',
        });
      }
    }

    const effectiveSelectedModelId =
      selectedModelId ||
      (providerLower === 'ollama' ? process.env.OLLAMA_MODEL || 'gemma3:27b' : null);

    // Market Research → Deep Research conversion
    if (aiModes?.marketResearch && !aiModes?.deepResearch) {
      (aiModes as any).deepResearch = true;
      (context as any).__forceResearchType = 'market_research';
    }

    // Detect "force depth" triggers (user control). These must cause a real structure change.
    const rawMsg = String(message || '').trim();
    const forceDepthTriggers = [
      'go deeper',
      'too shallow',
      'challenge this conclusion',
      // Polish
      'idź głębiej',
      'za płytkie',
      'podważ wnioski',
      'podważ tę konkluzję',
      'podważ tę rekomendację',
    ];
    const forceDepthTrigger = forceDepthTriggers.find((t) => t === rawMsg.toLowerCase());

    // Deep Thinking determinism: enforce Confirm gate server-side (not just UI).
    if (aiModes?.deepResearch) {
      const confirmed = Boolean((context as any)?.deepThinkingConfirmed);
      if (!confirmed) {
        return res.status(400).json({
          error:
            'Deep Thinking requires Confirm Understanding first. Call /api/ai/chat/confirm and then retry with context.deepThinkingConfirmed=true.',
          code: 'DEEP_THINKING_CONFIRM_REQUIRED',
        });
      }
    }

    const streamSessionId = conversationId || `stream-${req.userId}-${Date.now()}`;
    let accumulatedContent = '';
    // BUG2 — when a deliverable/object tool fires mid-stream, accumulatedContent
    // is only the thin "Utworzyłem…" chat-confirmation (150-400 chars) while the
    // REAL artifact scope lives in the tool's `scorerContent` (its rich intent).
    // We capture the last deliverable's scorerContent here and hand THAT to
    // qc.check so mece/actionability score the artifact, not the confirmation.
    let lastDeliverableScorerContent: string | null = null;
    let lastSaveTime = Date.now();
    let isClientConnected = true;
    let streamAborted = false;
    let streamCompleted = false;
    const streamAbortController = new AbortController();
    let deepThinkingStartedLogged = false;
    // Tracing / diagnostics (must be in outer stream handler scope)
    let chatRunId: string | null = null;
    let pipelineMeta: any = null;
    const dtStatesEmitted: string[] = [];
    // Policy gateway (P34-B): decision payload + evidence/citation enforcement
    let policyDecision: any = null;
    const policyNotices: any[] = [];
    let collectedCitations: any[] = [];
    let sourceLedgerSnapshot: any = null;
    // HP-15: runtime citation verification result (set right before the main-answer trust bundle).
    let runtimeCitationVerification: VerificationReport | null = null;
    // M01-P04B (GF-CHAT-08, coverage): claim↔citation coverage result from
    // `claimCitationValidator.validateClaimCitations`. Previously computed but
    // only surfaced as a `policy_notice` with `displayToUser: false` — an
    // internal audit trail the user never sees, so an answer with zero
    // citations had NO client-visible "not grounded" signal beyond TrustBadge's
    // separate (and independently silenced-when-empty) source count. Fed into
    // `emitTrustBundle` below so `TrustPanel` can show it honestly.
    let claimCoverageResult: {
      totalClaims?: number;
      citedClaims?: number;
      uncitedClaims?: number;
      coverageScore?: number;
      passesPolicy?: boolean;
    } | null = null;

    const mergeCitations = (prev: any[], next: any[]) => {
      const out: any[] = [];
      const seen = new Map<string, any>();
      const keyOf = (c: any) =>
        String(
          c?.id ||
            c?.link ||
            c?.reference ||
            c?.url ||
            c?.title ||
            `${c?.type || 'citation'}:${JSON.stringify(c).slice(0, 120)}`
        );
      const add = (c: any) => {
        if (!c) return;
        const k = keyOf(c);
        if (!k) return;
        if (seen.has(k)) {
          seen.set(k, { ...(seen.get(k) || {}), ...(c || {}) });
          return;
        }
        const merged = c;
        seen.set(k, merged);
        out.push(merged);
      };
      (Array.isArray(prev) ? prev : []).forEach(add);
      (Array.isArray(next) ? next : []).forEach(add);
      return out;
    };

    const normalizeTrustSourceClass = (value: unknown): string | null => {
      const raw = String(value || '')
        .trim()
        .toLowerCase();
      if (!raw) return null;
      if (raw.includes('product') || raw.includes('knowledge') || raw.includes('kb')) {
        return 'product_knowledge';
      }
      if (raw.includes('web') || raw.includes('research') || raw.includes('url')) {
        return 'web_research';
      }
      if (raw.includes('attach') || raw.includes('document') || raw.startsWith('a')) {
        return 'attachment';
      }
      if (raw.includes('workspace') || raw.includes('project') || raw.includes('pmo')) {
        return 'workspace';
      }
      if (raw.includes('memory') || raw.includes('org')) {
        return 'org_memory';
      }
      if (raw.includes('connector') || raw.includes('integration')) {
        return 'connector';
      }
      return 'general';
    };

    const buildTrustSourceClasses = (citations: any[], sourceLedger: any): string[] => {
      const classes = new Set<string>();
      for (const citation of citations || []) {
        const sourceClass =
          normalizeTrustSourceClass(citation?.sourceClass) ||
          normalizeTrustSourceClass(citation?.source_class) ||
          normalizeTrustSourceClass(citation?.type) ||
          normalizeTrustSourceClass(citation?.sourceType) ||
          normalizeTrustSourceClass(citation?.source);
        if (sourceClass) classes.add(sourceClass);
      }
      const usedSources = Array.isArray(sourceLedger?.used_sources)
        ? sourceLedger.used_sources
        : [];
      for (const source of usedSources) {
        const sourceClass =
          normalizeTrustSourceClass(source?.category) ||
          normalizeTrustSourceClass(source?.type) ||
          normalizeTrustSourceClass(source?.sourceClass);
        if (sourceClass) classes.add(sourceClass);
      }
      if (classes.size > 1) classes.add('mixed');
      if (classes.size === 0) classes.add('general');
      return Array.from(classes);
    };

    const buildSourceLedgerSummary = (sourceLedger: any) => {
      if (!sourceLedger || typeof sourceLedger !== 'object') return null;
      const usedSources = Array.isArray(sourceLedger.used_sources) ? sourceLedger.used_sources : [];
      const blockedSources = Array.isArray(sourceLedger.blocked_sources)
        ? sourceLedger.blocked_sources
        : [];
      return {
        usedCount: usedSources.length,
        blockedCount: blockedSources.length,
        degraded: sourceLedger.degraded || null,
        scope: {
          privateMode: Boolean(sourceLedger.scope_resolution?.privateMode),
          knowledgeSources: sourceLedger.scope_resolution?.knowledgeSources || {},
        },
      };
    };

    const estimateTokenCounts = (outputText: string) => {
      const inputTokens =
        typeof pipelineMeta?.inputTokens === 'number'
          ? pipelineMeta.inputTokens
          : Math.max(1, Math.ceil(String(message || '').length / 4));
      const outputTokens =
        typeof pipelineMeta?.outputTokens === 'number'
          ? pipelineMeta.outputTokens
          : Math.max(0, Math.ceil(String(outputText || '').length / 4));
      return {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };
    };

    const buildGovernedKnowledgeCitations = (sources: unknown, label: string): any[] => {
      const rawSources = Array.isArray(sources) ? sources : [];
      return rawSources
        .map((source, index) => {
          const sourceId = String(source || '').trim();
          if (!sourceId) return null;
          const product = sourceId
            .replace(/-fallback$/i, '')
            .replace(/^pill:/i, '')
            .replace(/^doc:/i, '')
            .replace(/[_-]+/g, ' ')
            .trim();
          const titleProduct = product
            ? product
                .split(/\s+/)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ')
            : 'Product Knowledge';
          return {
            id: `governed_${index + 1}_${sourceId.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 48)}`,
            type: 'document',
            title: `${label}: ${titleProduct}`,
            reference: sourceId.endsWith('-fallback')
              ? 'Governed product knowledge'
              : 'Assigned worker knowledge',
            excerpt: `Grounded in ${sourceId.endsWith('-fallback') ? 'curated product context' : 'assigned knowledge'} for ${titleProduct}.`,
          };
        })
        .filter(Boolean);
    };

    const languageMap: Record<string, string> = {
      pl: 'Polish (Polski)',
      en: 'English',
      de: 'German (Deutsch)',
      es: 'Spanish (Español)',
      ja: 'Japanese (日本語)',
      jp: 'Japanese (日本語)',
      ar: 'Arabic (العربية)',
    };
    const langCode = (language || 'en').split('-')[0];
    const langName = languageMap[langCode] || 'English';
    const isPolish = langCode === 'pl';
    const startTime = Date.now();
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: You MUST always respond in ${langName}. This is the user's chosen application language and takes absolute priority. Even if the user writes their message in a different language, your response must be in ${langName}. This is non-negotiable.]\n`;
    const canvasContextPacket =
      (context as any)?.canvasContextPacket &&
      typeof (context as any).canvasContextPacket === 'object'
        ? ((context as any).canvasContextPacket as Record<string, any>)
        : null;
    const canvasContextInstruction = canvasContextPacket
      ? [
          '## ACTIVE WORK CANVAS CONTEXT',
          `Schema: ${String(canvasContextPacket.schemaVersion || 'unknown')}`,
          `Draft: ${String(canvasContextPacket.activeDraft?.title || 'Untitled')} (${String(canvasContextPacket.activeDraft?.draftId || 'unsaved')})`,
          `Kind: ${String(canvasContextPacket.activeDraft?.kind || 'document')}`,
          `Lifecycle: ${String(canvasContextPacket.activeDraft?.lifecycleState || 'draft')}`,
          canvasContextPacket.selection?.selectedText
            ? `Selected text: ${String(canvasContextPacket.selection.selectedText).slice(0, 2000)}`
            : '',
          canvasContextPacket.memorySnapshot?.summary
            ? `Memory snapshot: ${String(canvasContextPacket.memorySnapshot.summary)}`
            : '',
          Array.isArray(canvasContextPacket.blockSummaries) &&
          canvasContextPacket.blockSummaries.length > 0
            ? `Block summaries:\n${canvasContextPacket.blockSummaries
                .slice(0, 8)
                .map(
                  (block: any) =>
                    `- ${String(block.kind)} ${String(block.blockId)}: ${String(block.title)} (${String(block.projectionStatus)})`
                )
                .join('\n')}`
            : '',
          Array.isArray(canvasContextPacket.workflowRuns) &&
          canvasContextPacket.workflowRuns.length > 0
            ? `Workflow runs:\n${canvasContextPacket.workflowRuns
                .slice(0, 5)
                .map(
                  (run: any) => `- ${String(run.id)}: ${String(run.title)} (${String(run.status)})`
                )
                .join('\n')}`
            : '',
          Array.isArray(canvasContextPacket.workflowEventSummaries) &&
          canvasContextPacket.workflowEventSummaries.length > 0
            ? `Recent workflow timeline:\n${canvasContextPacket.workflowEventSummaries
                .slice(-10)
                .map(
                  (event: any) =>
                    `- ${String(event.workflowTitle)} ${String(event.eventType)} by ${String(event.actorId)}: ${String(event.summary)}`
                )
                .join('\n')}`
            : '',
          Array.isArray(canvasContextPacket.workflowOutputSummaries) &&
          canvasContextPacket.workflowOutputSummaries.length > 0
            ? `Workflow outputs:\n${canvasContextPacket.workflowOutputSummaries
                .slice(-10)
                .map(
                  (output: any) =>
                    `- ${String(output.workflowTitle)} -> ${String(output.type)} ${String(output.id)}: ${String(output.title)}${output.url ? ` (${String(output.url)})` : ''}`
                )
                .join('\n')}`
            : '',
          'Use this Canvas context as working memory. Prefer Markdown projection and summaries; do not assume access to raw native block JSON.',
          'For state-changing work, propose the next workflow step and wait for approval.',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const teresaWorkspaceInstruction = [
      '## ASSISTANT SURFACE: workspace_copilot',
      'You are Teresa, the authenticated workspace copilot for Consultify.',
      'You may use only the organization, project, conversation, attachment, and tool context allowed by the authenticated user scope in this request.',
      'You are not Anna and you must not behave as a public landing-page assistant.',
      'Never claim access to data outside the current tenant/user permissions.',
      'For any state-changing work, propose and wait for explicit approval. Do not silently execute mutations.',
      'For requests like "create a Canvas/document/table/task", do not refuse due to autonomy policy; generate a governed proposal and ask for approval.',
      'To create, start, or draft an initiative, call the generate_initiative tool — it makes a reversible DRAFT (no approval needed for a draft; it never promotes or approves). Then confirm in one sentence.',
      'When asked to act without approval, explain that governed_execution requires approval first.',
    ].join('\n');

    /**
     * ★ Z4 — OTWARTA REPREZENTACJA IDEI (naprawa 2026-07-24).
     *
     * Front wysyła `context.ideaContext = {ideaId, tool}` razem z manifestem
     * akcji (UnifiedChatPanel.tsx:3944), ale serwer NIGDY tego nie czytał —
     * `grep ideaContext server/src/` dawał zero trafień. Model nie miał w
     * prompcie ani słowa o tym, co użytkownik ma otwarte; orientował się
     * wyłącznie po tym, jakie narzędzia dostał.
     *
     * Skutek zmierzony w żywej rundzie (13 poleceń × 3 modele): na „gdzie są
     * wąskie gardła?" model ODMAWIAŁ — „nie widzę otwartego Przepływu, otwórz
     * moduł Ideas" — mimo że Przepływ był otwarty, a narzędzie dostępne. Dla
     * użytkownika wygląda to na zepsutą Teresę. Po dołożeniu tego bloku
     * kontrolny przebieg przestał odmawiać i wywołał właściwą akcję.
     */
    const ideaCtx =
      (context as any)?.ideaContext && typeof (context as any).ideaContext === 'object'
        ? ((context as any).ideaContext as { ideaId?: unknown; tool?: unknown })
        : null;
    const IDEA_TOOL_NAMES: Record<string, { pl: string; en: string }> = {
      mindmap: { pl: 'Mapa myśli', en: 'Mind Map' },
      whiteboard: { pl: 'Whiteboard', en: 'Whiteboard' },
      process_flow: { pl: 'Process Flow', en: 'Process Flow' },
      table: { pl: 'Tabela', en: 'Table' },
    };
    const ideaToolKey = typeof ideaCtx?.tool === 'string' ? ideaCtx.tool : '';
    const ideaContextInstruction =
      ideaCtx && ideaToolKey && IDEA_TOOL_NAMES[ideaToolKey]
        ? [
            '## OTWARTA REPREZENTACJA IDEI',
            `Użytkownik ma OTWARTĄ reprezentację: ${IDEA_TOOL_NAMES[ideaToolKey][isPolish ? 'pl' : 'en']} (\`${ideaToolKey}\`)${
              typeof ideaCtx.ideaId === 'string' && ideaCtx.ideaId
                ? ` — Idea \`${ideaCtx.ideaId}\`.`
                : '.'
            }`,
            'Narzędzia `idea_*`, które dostałeś, działają WŁAŚNIE na tej otwartej reprezentacji.',
            'Nie proś użytkownika, żeby ją otworzył, i nie twierdź, że jej nie widzisz — jest otwarta.',
            'Dostałeś tylko te narzędzia, które ta reprezentacja realnie obsługuje. Jeśli użytkownik prosi o coś, czego nie ma na tej liście, powiedz wprost, że tej akcji nie ma w tej reprezentacji — NIE podstawiaj innego narzędzia.',
          ].join('\n')
        : '';

    const workbookMutationInstruction = buildWorkbookMutationPromptHint(
      (context || {}) as Record<string, unknown>
    );

    let enhancedSystemInstruction =
      [
        teresaWorkspaceInstruction,
        canvasContextInstruction,
        ideaContextInstruction,
        workbookMutationInstruction,
        systemInstruction || '',
      ]
        .filter((part) => String(part || '').trim().length > 0)
        .join('\n\n') + languageInstruction;

    // Co-Thinker mode: inject persona-specific system prompt
    if (aiModes?.coThinkerMode && typeof aiModes.coThinkerMode === 'string') {
      try {
        const { buildCoThinkerSystemPrompt } = await import('../services/ai/coThinkerService.js');
        const coThinkerPrompt = buildCoThinkerSystemPrompt(
          aiModes.coThinkerMode as any,
          (language || 'en').split('-')[0]
        );
        if (coThinkerPrompt) {
          enhancedSystemInstruction = coThinkerPrompt + '\n\n' + enhancedSystemInstruction;
        }
      } catch (ctErr: any) {
        logger.warn('[AI Routes] Co-Thinker prompt injection failed:', ctErr?.message);
      }
    }

    // User steering: responseStyle + free-text customInstructions ("how Teresa should answer").
    // The streaming chat supplies its own systemInstruction, and AIPipeline bypasses the persona
    // builder when one is provided (AIPipeline.ts:1094) — so steering MUST be injected HERE to
    // actually shape the streamed output. Appended last (highest recency); empty when unset.
    try {
      const steerLang = (language || 'en').split('-')[0];
      const ci = String((body as any).customInstructions || '').trim();
      const rs = String(responseStyle || '')
        .trim()
        .toLowerCase();
      const styleMap: Record<string, { pl: string; en: string }> = {
        concise: {
          pl: 'Odpowiadaj maksymalnie zwięźle (1–3 zdania lub do 3 punktów).',
          en: 'Answer maximally concisely (1–3 sentences or up to 3 bullets).',
        },
        executive: {
          pl: 'Pisz na poziomie zarządu: najpierw wniosek/rekomendacja, zwięźle, bez żargonu.',
          en: 'Write executive-level: lead with the conclusion/recommendation, concise, no jargon.',
        },
        analyst: {
          pl: 'Pisz analitycznie: założenia, liczby, scenariusze, struktura MECE.',
          en: 'Write analytically: assumptions, numbers, scenarios, MECE structure.',
        },
        formal: {
          pl: 'Ton formalny, bezosobowy (rejestr notatki służbowej).',
          en: 'Formal, impersonal tone (business-memo register).',
        },
        coach: {
          pl: 'Zacznij od 1–2 pytań naprowadzających, potem zwięzła rada.',
          en: 'Start with 1–2 guiding questions, then give concise advice.',
        },
        professional: {
          pl: 'Ton doradcy-partnera: rzeczowo i konkretnie.',
          en: 'Advisory-partner tone: substantive and concrete.',
        },
        friendly: {
          pl: 'Ton ciepły, bezpośredni (per Ty), bez utraty merytoryki.',
          en: 'Warm, direct tone (second person) without losing substance.',
        },
      };
      const steerParts: string[] = [];
      if (rs && styleMap[rs]) {
        steerParts.push(
          `[RESPONSE STYLE: ${steerLang === 'pl' ? styleMap[rs].pl : styleMap[rs].en}]`
        );
      }
      if (ci) {
        steerParts.push(
          steerLang === 'pl'
            ? `[INSTRUKCJE UŻYTKOWNIKA — uszanuj je, o ile nie łamią bezpieczeństwa, groundingu ani zasady „proponuj, nie udawaj wykonania": ${ci}]`
            : `[USER INSTRUCTIONS — honor them unless they conflict with safety, data-grounding, or the "propose, don't fake execution" rule: ${ci}]`
        );
      }
      if (steerParts.length) {
        enhancedSystemInstruction = enhancedSystemInstruction + '\n\n' + steerParts.join('\n');
      }
    } catch (steerErr: any) {
      logger.warn('[AI Routes] Steering injection failed:', steerErr?.message);
    }

    // Prevent Node.js / proxy / ALB socket timeouts for long-running SSE streams
    // (Deep Thinking can run 30–90 seconds; default 2min timeout gives safety margin)
    if (req.socket) {
      req.socket.setTimeout(120_000); // 2 minutes
      req.socket.setNoDelay(true); // Disable Nagle for real-time streaming
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering for SSE
    res.setHeader('X-Stream-Session-Id', streamSessionId);
    res.flushHeaders();
    // Emit an immediate first SSE event so the client never experiences a "dead" stream
    // while backend performs DB/policy checks (or optional tracing).
    try {
      res.write(
        `data: ${JSON.stringify({
          type: 'thought',
          step: 'starting',
          status: 'in_progress',
          label: 'Starting…',
        })}\n\n`
      );
    } catch {
      // ignore (connection already closed)
    }

    // SSE heartbeat: keep connection alive during long AI processing (context build,
    // RAG retrieval, Deep Thinking research). Prevents proxy/ALB idle timeouts.
    const heartbeatInterval = setInterval(() => {
      if (!isClientConnected || streamCompleted || streamAborted) {
        clearInterval(heartbeatInterval);
        return;
      }
      try {
        res.write(': heartbeat\n\n');
      } catch {
        // Connection already closed — will be cleaned up by connectionCleanup
        clearInterval(heartbeatInterval);
      }
    }, 15_000); // Every 15 seconds

    const emitMinimalTrustBundle = (
      outputText: string,
      degraded: { mode: string; reason?: string } | null = null
    ) => {
      const tokens = estimateTokenCounts(outputText);
      res.write(
        `data: ${JSON.stringify({
          type: 'trust_bundle',
          bundle: {
            version: 'TrustBundleV1',
            answerId: `answer-${streamSessionId}`,
            conversationId: conversationId || null,
            messageId: chatRunId || null,
            decisionId: policyDecision?.id || null,
            model: pipelineMeta?.model || null,
            provider: pipelineMeta?.provider || null,
            tier: selectedTier || null,
            sourceClasses: ['general'],
            citationsCount: 0,
            citations: [],
            sourceLedgerSummary: null,
            policyDecision: null,
            policyNotices: [],
            generatedAt: new Date().toISOString(),
            degraded,
            outputLength: String(outputText || '').length,
            confidence: degraded ? 0 : 0.5,
            cost: pipelineMeta?.cost || pipelineMeta?.estimatedCost || null,
            tokens,
            routingTrace: pipelineMeta?.routingTrace || pipelineMeta?.routing_trace || null,
            warnings: degraded ? [degraded.reason || degraded.mode] : [],
            assistant: 'teresa',
            assistantSurface: 'workspace_copilot',
            actionSurface: 'governed_execution',
          },
        })}\n\n`
      );
    };

    const emitDeterministicBlock = (outputText: string, reason: string) => {
      accumulatedContent = outputText;
      res.write(`data: ${JSON.stringify({ text: outputText })}\n\n`);
      emitMinimalTrustBundle(outputText, { mode: 'blocked', reason });
      res.write('data: [DONE]\n\n');
      streamCompleted = true;
      clearInterval(heartbeatInterval);
      return res.end();
    };

    // --------------------------------------------------------------------
    // E2E_MODE: deterministic streaming for runtime tests (CI + Playwright)
    // --------------------------------------------------------------------
    // - Emits SSE chunks in the same format the frontend expects
    // - Persists conversation + messages so History / DB are verifiable
    if (process.env.E2E_MODE === 'true') {
      const assistantFull = `E2E_OK: Received "${message}".`;

      if (resumeFromPartial && conversationId) {
        const partial = (await dbGet(
          `SELECT content FROM ai_partial_responses
           WHERE session_id = ? AND user_id = ? AND organization_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members om
               WHERE om.organization_id = ai_partial_responses.organization_id
                 AND om.user_id = ai_partial_responses.user_id
                 AND UPPER(om.status) = 'ACTIVE'
             )`,
          [conversationId, req.userId, req.organizationId]
        )) as { content?: string } | null;
        if (!partial?.content) {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              code: 'PARTIAL_RECOVERY_NOT_FOUND',
              message: 'Interrupted response could not be resumed.',
              sessionId: streamSessionId,
            })}\n\n`
          );
          streamCompleted = true;
          clearInterval(heartbeatInterval);
          return res.end();
        }
        accumulatedContent = partial.content;
        res.write(
          `data: ${JSON.stringify({
            type: 'resume',
            text: partial.content,
            sessionId: streamSessionId,
          })}\n\n`
        );
      }

      // Actually persist, matching the comment above (previously this stub only
      // streamed SSE chunks and never wrote to conversation_messages, so the
      // runtime smoke's DB-persistence assertion always timed out — found
      // 2026-07-14 diagnosing the ai-chat runtime smoke canary). Best-effort:
      // a persistence failure here must not break the deterministic stream.
      //
      // Idempotency: use a deterministic id + `ON CONFLICT(id) DO NOTHING`
      // instead of a SELECT-based existence check. The E2E_MODE/MOCK_DB in-memory
      // query engine (server/src/database/Database.ts selectFromTable) only
      // supports WHERE-clause filtering on a small column allowlist — it does NOT
      // include conversation_id/role/content, so a `WHERE conversation_id = ? AND
      // role = ? AND content = ?` existence check silently drops every predicate
      // and matches the FIRST row in the entire (cross-conversation) table. That
      // false-positive "already exists" made the second insert (the assistant
      // reply) a permanent no-op whenever any earlier message existed anywhere —
      // found 2026-07-14 while chasing why only the user message ever persisted.
      // `id` IS a real single-column PK/conflict target on both the mock and
      // Postgres, so this is dedupe-safe against retried stream calls too.
      if (conversationId) {
        try {
          const persistE2EMessage = async (role: 'user' | 'ai', content: string) => {
            await dbRun(
              `INSERT INTO conversation_messages (
                 id, conversation_id, role, content, message_type,
                 metadata, token_count, model_used, author_user_id, seq, client_message_id, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO NOTHING`,
              [
                `e2e-stub-${conversationId}-${role}`,
                conversationId,
                role,
                content,
                'text',
                '{}',
                null,
                null,
                role === 'user' ? req.userId || null : null,
                role === 'user' ? 1 : 2,
                null,
                new Date().toISOString(),
              ]
            );
          };
          await persistE2EMessage('user', message);
          await persistE2EMessage('ai', assistantFull);
        } catch (persistErr) {
          logger.warn(
            '[Stream][E2E_MODE] message persistence failed (continuing):',
            persistErr as Error
          );
        }
      }

      try {
        // Stream assistant response in chunks
        const chunks = ['E2E_OK: ', `Received "${message}"`, '.'];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          accumulatedContent += chunk;
        }

        emitMinimalTrustBundle(assistantFull, { mode: 'e2e_mode', reason: 'deterministic_stream' });
        res.write('data: [DONE]\n\n');

        if (resumeFromPartial && conversationId) {
          await dbRun(
            `DELETE FROM ai_partial_responses
             WHERE session_id = ? AND user_id = ? AND organization_id = ?`,
            [conversationId, req.userId, req.organizationId]
          );
        }

        return res.end();
      } catch (e: any) {
        res.write(
          `data: ${JSON.stringify({
            error: `E2E stream failed: ${e?.message || String(e)}`,
            code: 'E2E_STREAM_ERROR',
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    const connectorHonestyBlock = await buildConnectorHonestyBlockResponse({
      organizationId: req.organizationId,
      message,
      context,
    });
    if (connectorHonestyBlock) {
      return emitDeterministicBlock(
        connectorHonestyBlock,
        'fresh_connector_data_without_verified_tool_result'
      );
    }

    const aiOpsHealthBlock = await buildAIOpsHealthBlockResponse(message);
    if (aiOpsHealthBlock) {
      return emitDeterministicBlock(
        aiOpsHealthBlock,
        'expensive_ai_operation_requires_healthy_internal_provider_posture'
      );
    }

    const connectionCleanup = () => {
      // `close` also fires on normal completion; avoid logging abort in that case.
      if (streamCompleted) return;
      isClientConnected = false;
      streamAborted = true;
      streamAbortController.abort(new Error('chat_stream_client_disconnected'));
      clearInterval(heartbeatInterval);
      logger.info(`[Stream] Client disconnected: ${streamSessionId}`);

      // Deep Thinking ops metric: aborted run
      if (aiModes?.deepResearch && req.organizationId && req.userId && deepThinkingStartedLogged) {
        import('../services/ai/deepThinkingMetricsService.js')
          .then(({ logDeepThinkingEvent }) =>
            logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'client_disconnected' },
            })
          )
          .catch(() => {
            /* ignore */
          });
      }

      if (accumulatedContent.length > 0) {
        savePartialResponse(
          streamSessionId,
          accumulatedContent,
          req.userId!,
          req.organizationId!
        ).catch((err: Error | null) => logger.error('[Stream] Failed to save partial:', err));
      }

      // Trace: mark run as aborted (best-effort)
      if (chatRunId && req.organizationId && req.userId) {
        setImmediate(() => {
          import('../services/ai/chatTraceService.js')
            .then((mod: any) =>
              (mod.default || mod).completeRun({
                runId: chatRunId,
                status: 'aborted',
                pipelineTraceId: pipelineMeta?.traceId || pipelineMeta?.trace_id || null,
                modelProvider: pipelineMeta?.provider || null,
                modelId: pipelineMeta?.model || null,
                tier: selectedTier || null,
                outputText: accumulatedContent,
                dtStates: dtStatesEmitted,
              })
            )
            .catch(() => {
              /* ignore */
            });
        });
      }
    };

    req.socket?.on('close', connectionCleanup);
    req.socket?.on('error', connectionCleanup);
    res.on('close', connectionCleanup);

    const savePartialResponse = (
      sessionId: string,
      content: string,
      userId: string,
      orgId: string
    ) =>
      dbRun(
        `
          INSERT INTO ai_partial_responses (id, session_id, user_id, organization_id, content, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(organization_id, user_id, session_id) DO UPDATE SET
              content = excluded.content,
              updated_at = CURRENT_TIMESTAMP
        `,
        [uuidv4(), sessionId, userId, orgId, content]
      );

    try {
      // --------------------------------------------------------
      // Fast-fail when no LLM provider is configured (dev UX)
      // --------------------------------------------------------
      // Without at least one provider (env key or configured provider table),
      // the pipeline can end up returning empty content or failing late.
      const hasEnvProvider = !!String(process.env.OPENROUTER_API_KEY || '').trim();
      const hasDbProvider = !!(await dbGet(
        `SELECT 1 AS ok
         FROM llm_providers
         WHERE is_active = true AND provider = 'openrouter' AND api_key IS NOT NULL AND api_key != ''
         LIMIT 1`
      ));

      if (!hasEnvProvider && !hasDbProvider) {
        res.write(
          `data: ${JSON.stringify({
            error:
              'No LLM provider configured on the backend. Set OPENROUTER_API_KEY or configure OpenRouter in llm_providers.',
            code: 'NO_LLM_PROVIDER',
          })}\n\n`
        );
        emitMinimalTrustBundle('', { mode: 'blocked', reason: 'no_llm_provider' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // --------------------------------------------------------
      // Access policy enforcement (Demo/Trial/Paid) for streaming
      // NOTE: streaming pipeline bypasses AIOrchestrator, so enforce here.
      // --------------------------------------------------------
      const AccessPolicyService = (await import('../services/accessPolicyService.js'))
        .default as any;
      const aiAccessContext = await AccessPolicyService.getAIAccessContext(req.organizationId!);
      const aiAccessCheck = await AccessPolicyService.checkAccess(req.organizationId!, 'ai_call');

      if (!aiAccessCheck.allowed) {
        res.write(
          `data: ${JSON.stringify({
            error: aiAccessCheck.reason || 'Access blocked',
            code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
          })}\n\n`
        );
        emitMinimalTrustBundle('', { mode: 'blocked', reason: 'access_policy' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Count the AI call for daily limits
      AccessPolicyService.incrementUsage(req.organizationId!, 'ai_calls', 1).catch((err: any) => {
        logger.warn('[AI Stream] Failed to increment ai_calls usage:', err?.message || err);
      });

      // Deep Thinking ops metrics (best-effort; must not break chat)
      if (aiModes?.deepResearch && req.organizationId && req.userId) {
        const { logDeepThinkingEvent } =
          await import('../services/ai/deepThinkingMetricsService.js');
        await logDeepThinkingEvent({
          organizationId: req.organizationId!,
          userId: req.userId!,
          sessionId: streamSessionId,
          conversationId: conversationId || null,
          eventType: 'run_started',
          payload: {
            deepThinkingDepth: (context as any)?.deepThinkingDepth || null,
            webSearch: Boolean(aiModes?.webSearch),
            forceDepth: Boolean(forceDepthTrigger || (context as any)?.forceDepth),
          },
        });
        deepThinkingStartedLogged = true;

        if (forceDepthTrigger || (context as any)?.forceDepth) {
          await logDeepThinkingEvent({
            organizationId: req.organizationId!,
            userId: req.userId!,
            sessionId: streamSessionId,
            conversationId: conversationId || null,
            eventType: 'force_depth',
            payload: { trigger: forceDepthTrigger || null },
          });
        }
      }

      if (resumeFromPartial && conversationId) {
        let partial: string | null = null;
        let partialLookupFailed = false;
        try {
          const row = (await dbGet(
            `SELECT content FROM ai_partial_responses
             WHERE session_id = ? AND user_id = ? AND organization_id = ?
               AND EXISTS (
                 SELECT 1 FROM organization_members om
                 WHERE om.organization_id = ai_partial_responses.organization_id
                   AND om.user_id = ai_partial_responses.user_id
                   AND UPPER(om.status) = 'ACTIVE'
               )`,
            [conversationId, req.userId, req.organizationId]
          )) as { content?: string } | null;
          partial = row?.content ?? null;
        } catch (error) {
          partialLookupFailed = true;
          logger.warn('[AI Stream] Tenant-scoped partial lookup failed', {
            sessionId: conversationId,
            organizationId: req.organizationId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (partial) {
          accumulatedContent = partial;
          res.write(
            `data: ${JSON.stringify({
              type: 'resume',
              text: partial,
              sessionId: streamSessionId,
            })}\n\n`
          );
        } else {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              code: partialLookupFailed
                ? 'PARTIAL_RECOVERY_UNAVAILABLE'
                : 'PARTIAL_RECOVERY_NOT_FOUND',
              message: 'Interrupted response could not be resumed.',
              sessionId: streamSessionId,
            })}\n\n`
          );
          streamCompleted = true;
          return res.end();
        }

        // Partial resume logic handled by sending previous content to client
      }

      // Extract projectId and screenContext from request context
      // Deep Thinking autonomy: do not pass project/screen context into the pipeline.
      // Keep them only in request.context if needed for UI continuity, but prevent AIContextBuilder usage.
      const projectId = aiModes?.deepResearch
        ? null
        : (context as any)?.projectId ||
          (context as any)?.workspaceContext?.projectId ||
          bodyProjectId ||
          null;
      const virtualWorkerSlug =
        typeof (context as any)?.virtualWorkerSlug === 'string' &&
        (context as any).virtualWorkerSlug.trim().length > 0
          ? String((context as any).virtualWorkerSlug)
              .trim()
              .toLowerCase()
          : null;
      const assistantScope = (() => {
        const raw =
          (body as any).assistantScope ??
          (context as any)?.assistantScope ??
          (context as any)?.assistant?.scope;
        if (raw === 'anna_public' || raw === 'teresa_tenant') return raw;
        return virtualWorkerSlug === 'anna' ? 'anna_public' : 'teresa_tenant';
      })();
      const wave6MemoryScope = (() => {
        const raw = (body as any).memoryScope ?? (context as any)?.memoryScope;
        if (
          raw === 'public_product' ||
          raw === 'tenant' ||
          raw === 'org' ||
          raw === 'user' ||
          raw === 'project'
        ) {
          return raw;
        }
        if (assistantScope === 'anna_public') return 'public_product';
        if (projectId) return 'project';
        if (knowledgeSources?.organizationData) return 'org';
        return 'user';
      })();
      const isGovernedProductTruthQuery = isDbr77ProductTruthQuery(String(message || ''));
      const mentionsGovernedDbrProduct =
        /\bdbr77\b|\bdbr\b|\bconsultify\b|\bmarketplace\b|\biris\b|\bvector\b|\bdigital twin\b|\biiot\b/i.test(
          String(message || '')
        );
      const isProductAssistantHowToQuery =
        Boolean(virtualWorkerSlug) &&
        isProductOrHowToQuery(String(message || ''), language?.startsWith('pl') ? 'pl' : 'en');
      const shouldPreferGovernedProductKnowledge =
        isGovernedProductTruthQuery || isProductAssistantHowToQuery;
      let hasGovernedGrounding = false;

      const screenContext = aiModes?.deepResearch
        ? null
        : (context as any)?.screenContext ||
          (context as any)?.workspaceContext ||
          bodyScreenContext ||
          null;

      const focusMode = (context as any)?.focusMode || bodyFocusMode || 'all';
      let wave6ProfilePrompt = '';
      try {
        if (
          !privateMode &&
          req.organizationId &&
          req.userId &&
          assistantScope === 'teresa_tenant'
        ) {
          const wave6 = await import('../services/wave6ContextLearningService.js');
          const workProfile = await wave6.buildWave6UserWorkProfile({
            organizationId: req.organizationId,
            userId: req.userId,
            projectId,
            privateMode: Boolean(privateMode) || Boolean(aiModes?.deepResearch),
            assistantScope,
          });
          wave6ProfilePrompt = wave6.buildWave6UserWorkProfilePrompt(workProfile);
          await wave6.captureWave6ContextSnapshot({
            organizationId: req.organizationId,
            userId: req.userId,
            snapshotType: projectId
              ? 'project'
              : wave6MemoryScope === 'org' || wave6MemoryScope === 'tenant'
                ? 'org'
                : 'user',
            projectId,
            facts: {
              conversationId: conversationId || null,
              focusMode,
              hasScreenContext: Boolean(screenContext),
              canvasDraftId: canvasContextPacket?.activeDraft?.draftId || null,
              canvasTitle: canvasContextPacket?.activeDraft?.title || null,
              canvasWorkflowRunIds:
                canvasContextPacket?.memorySnapshot?.anchors?.workflowRunIds || [],
              canvasWorkflowEventTypes: Array.isArray(canvasContextPacket?.workflowEventSummaries)
                ? canvasContextPacket.workflowEventSummaries
                    .slice(-10)
                    .map((event: any) => String(event.eventType || 'unknown'))
                : [],
              canvasWorkflowOutputIds: Array.isArray(canvasContextPacket?.workflowOutputSummaries)
                ? canvasContextPacket.workflowOutputSummaries
                    .slice(-10)
                    .map((output: any) => String(output.id || 'unknown'))
                : [],
              canvasBlockIds: canvasContextPacket?.memorySnapshot?.anchors?.blockIds || [],
              userWorkProfilePreferences: workProfile.preferences.length,
            },
            sourceRefs: [
              {
                sourceType: 'chat_runtime',
                sourceTitle: 'AI chat runtime context',
                sourceId: conversationId || streamSessionId,
              },
            ],
            permissions: {
              assistantScope,
              projectId,
              privateMode: Boolean(privateMode),
            },
            privateMode: Boolean(privateMode),
          });
        }
      } catch (wave6Err: any) {
        logger.warn('[AI Stream] Wave 6 context snapshot skipped:', wave6Err?.message || wave6Err);
      }
      const attachmentDocIdsForPurpose = Array.isArray((context as any)?.attachmentDocIds)
        ? ((context as any).attachmentDocIds as any[]).map((id: any) => String(id)).filter(Boolean)
        : [];
      const resolvedChatPurpose = inferChatTaskPurpose({
        capability: 'chat',
        message,
        attachments: Array.isArray((context as any)?.attachments)
          ? (context as any).attachments
          : [],
        attachmentDocIds: attachmentDocIdsForPurpose,
        deepResearch: Boolean(aiModes?.deepResearch),
      });

      let pipelineRequest = {
        type: 'chat',
        userId: req.userId,
        organizationId: req.organizationId,
        projectId, // Pass projectId for context building
        prompt: forceDepthTrigger ? `Force-depth request: ${rawMsg}` : message,
        messages: (history || []).map((m) => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: (m as { parts?: Array<{ text: string }> }).parts?.[0]?.text || m.content || '',
        })),
        capability: 'chat',
        purpose: resolvedChatPurpose,
        screenContext, // Full screen context for AI awareness
        focusMode, // Focus mode for context filtering
        context: {
          ...(context || {}),
          userId: req.userId,
          organizationId: req.organizationId,
          projectId,
          screenContext,
          focusMode,
          conversationId,
          // i18n-teresa fix 2026-04-18: propagate authoritative UI language so AIPipeline
          // builds its system prompt (persona, behavioral, strict [LANGUAGE INSTRUCTION])
          // in the locale the user actually selected — not sticky memory prefs.
          language: language || undefined,
          conversationLanguage: language ? String(language).split('-')[0] : undefined,
          // Tools & routing options (used by AIPipeline prompt + model selection)
          aiModes,
          knowledgeSources,
          responseStyle,
          // User steering free-text ("how Teresa should answer") → persona prompt.
          customInstructions: (body as any).customInstructions,
          selectedTier,
          selectedModelId: effectiveSelectedModelId,
          provider: bodyProvider,
          endpoint: bodyEndpoint,
          privateMode: Boolean(privateMode),
        },
        stream: true,
        abortSignal: streamAbortController.signal,
        options: {
          role: roleName,
          systemInstruction: [enhancedSystemInstruction, wave6ProfilePrompt]
            .filter((part) => String(part || '').trim().length > 0)
            .join('\n\n'),
          language: language || undefined,
          // Tools & routing options
          aiModes,
          knowledgeSources,
          responseStyle,
          // User steering free-text ("how Teresa should answer") → persona prompt.
          customInstructions: (body as any).customInstructions,
          selectedTier,
          selectedModelId: effectiveSelectedModelId,
          provider: bodyProvider,
          endpoint: bodyEndpoint,
          privateMode: Boolean(privateMode),
        },
      };

      const connectorHonestyConstraint = await buildConnectorHonestyConstraint({
        organizationId: req.organizationId,
        message,
        context,
      });
      if (connectorHonestyConstraint) {
        pipelineRequest = {
          ...pipelineRequest,
          options: {
            ...(pipelineRequest.options || {}),
            systemInstruction:
              String((pipelineRequest.options as any)?.systemInstruction || '') +
              `\n\n${connectorHonestyConstraint}\n`,
          },
          context: {
            ...((pipelineRequest as any).context || {}),
            external: {
              ...(((pipelineRequest as any).context || {}).external || {}),
              connectorHonesty: {
                enforced: true,
                reason: 'fresh_connector_data_without_verified_tool_result',
              },
            },
          },
        } as any;
      }

      const aiOpsHealthConstraint = await buildAIOpsHealthConstraint(message);
      const suppressWebForInternalOpsHealth = Boolean(aiOpsHealthConstraint);
      if (aiOpsHealthConstraint) {
        pipelineRequest = {
          ...pipelineRequest,
          options: {
            ...(pipelineRequest.options || {}),
            systemInstruction:
              String((pipelineRequest.options as any)?.systemInstruction || '') +
              `\n\n${aiOpsHealthConstraint}\n`,
          },
          context: {
            ...((pipelineRequest as any).context || {}),
            external: {
              ...(((pipelineRequest as any).context || {}).external || {}),
              aiOpsHealth: {
                enforced: true,
                reason: 'expensive_ai_operation_requires_healthy_internal_provider_posture',
              },
            },
          },
        } as any;
      }

      // --------------------------------------------------------
      // Chat trace: create a persistent run record (admin ops)
      // --------------------------------------------------------
      try {
        const svcMod = await import('../services/ai/chatTraceService.js');
        const chatTraceService = (svcMod.default || svcMod) as any;
        const created = await chatTraceService.createRun({
          organizationId: req.organizationId!,
          userId: req.userId!,
          conversationId: conversationId || null,
          streamSessionId,
          capability: 'chat',
          request: {
            message: String(message || '').slice(0, 2000),
            aiModes: aiModes || null,
            knowledgeSources: knowledgeSources || null,
            responseStyle: responseStyle || null,
            selectedTier: selectedTier || null,
            selectedModelId: selectedModelId || null,
            purpose: resolvedChatPurpose,
            language: language || null,
            resumeFromPartial: Boolean(resumeFromPartial),
            privateMode: Boolean(privateMode),
          },
          context: {
            projectId,
            focusMode,
            hasScreenContext: Boolean(screenContext),
            attachmentDocIds: (context as any)?.attachmentDocIds || null,
            privateMode: Boolean(privateMode),
          },
        });
        chatRunId = String(created?.runId || '') || null;
        if (chatRunId) {
          try {
            (pipelineRequest as any).context = {
              ...((pipelineRequest as any).context || {}),
              chatRunId,
            };
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore tracing failures
      }

      // Helper to emit SSE events to the client (hoisted before first usage)
      const emitSSE = (payload: Record<string, unknown>) => {
        if (!isClientConnected || res.destroyed) return;
        // Capture dt_state events for B1 diagnostic
        if (payload.type === 'dt_state' && typeof payload.state === 'string') {
          dtStatesEmitted.push(payload.state);
        }
        // Capture citations for post-stream evidence enforcement
        if (payload.type === 'citations' && Array.isArray((payload as any).citations)) {
          collectedCitations = mergeCitations(collectedCitations, (payload as any).citations);
        }
        // Capture policy notices for persistence/audit (best-effort)
        if (payload.type === 'policy_notice') {
          policyNotices.push(payload as any);
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };
      const sanitizePolicyDecisionForClient = (decision: any) => {
        if (!decision || typeof decision !== 'object') return null;
        const refusal =
          decision.refusal && typeof decision.refusal === 'object' ? decision.refusal : null;
        const evidence =
          decision.evidence && typeof decision.evidence === 'object'
            ? {
                required: Boolean(decision.evidence.required),
                uncertaintyMarkerRequiredIfInsufficientEvidence: Boolean(
                  decision.evidence.uncertaintyMarkerRequiredIfInsufficientEvidence
                ),
              }
            : undefined;
        return {
          id: decision.id || null,
          allowed: decision.allowed === true,
          category: decision.category || null,
          rationale: typeof decision.rationale === 'string' ? decision.rationale : null,
          ...(evidence ? { evidence } : {}),
          ...(refusal
            ? {
                refusal: {
                  userMessage:
                    typeof refusal.userMessage === 'string' ? refusal.userMessage : undefined,
                  nextSteps: Array.isArray(refusal.nextSteps)
                    ? refusal.nextSteps.slice(0, 6).map((s: any) => String(s || '').trim())
                    : [],
                },
              }
            : {}),
        };
      };
      const emitTrustBundle = (outputText: string) => {
        const citations = Array.isArray(collectedCitations) ? collectedCitations : [];
        const sourceLedger = sourceLedgerSnapshot;
        const sourceClasses = buildTrustSourceClasses(citations, sourceLedger);
        const degraded =
          sourceLedger?.degraded || (citations.length === 0 ? { mode: 'no_sources' } : null);
        const tokens = estimateTokenCounts(outputText);
        emitSSE({
          type: 'trust_bundle',
          bundle: {
            version: 'TrustBundleV1',
            answerId: `answer-${streamSessionId}`,
            conversationId: conversationId || null,
            messageId: chatRunId || null,
            decisionId: policyDecision?.id || null,
            model: pipelineMeta?.model || null,
            provider: pipelineMeta?.provider || null,
            tier: selectedTier || null,
            sourceClasses,
            citationsCount: citations.length,
            citations: citations.slice(0, 24),
            sourceLedgerSummary: buildSourceLedgerSummary(sourceLedger),
            policyDecision: sanitizePolicyDecisionForClient(policyDecision),
            policyNotices: policyNotices.slice(0, 12),
            generatedAt: new Date().toISOString(),
            degraded,
            outputLength: String(outputText || '').length,
            // HP-15: pewność wyprowadzona z REALNEJ weryfikacji cytowań (jeśli runtime ją odpalił),
            // a nie ze stałej 0.86/0.52. Fallback do heurystyki źródeł, gdy weryfikacja nie biegła
            // (ścieżki bez odpowiedzi merytorycznej, np. refusal/degraded).
            confidence:
              runtimeCitationVerification !== null
                ? numericConfidenceFromVerification(
                    runtimeCitationVerification,
                    sourceClasses.some((sourceClass) => sourceClass !== 'general')
                  )
                : citations.length > 0 ||
                    sourceClasses.some((sourceClass) => sourceClass !== 'general')
                  ? 0.86
                  : 0.52,
            // HP-15: jawny ślad weryfikacji w trust bundle (liczniki, nie zgadywanie).
            citationVerification: runtimeCitationVerification
              ? {
                  total: runtimeCitationVerification.totalCitations,
                  verified: runtimeCitationVerification.verified,
                  unverified: runtimeCitationVerification.unverified,
                  broken: runtimeCitationVerification.broken,
                  score: runtimeCitationVerification.overallScore,
                }
              : null,
            cost: pipelineMeta?.cost || pipelineMeta?.estimatedCost || null,
            tokens,
            routingTrace: pipelineMeta?.routingTrace || pipelineMeta?.routing_trace || null,
            // M01-P04B (GF-CHAT-08, coverage): claim↔citation coverage result.
            // Previously computed (`claimCitationValidator.validateClaimCitations`)
            // but only reached an internal `policy_notice` marked
            // `displayToUser: false` — the user never saw it. Exposed here so
            // `TrustPanel` (owned by this packet) can render it honestly:
            // an answer whose claims are NOT covered by citations must never
            // read as "grounded" with no visible caveat.
            coverage: claimCoverageResult,
            warnings: [
              ...(degraded ? [degraded.reason || degraded.mode] : []),
              ...(claimCoverageResult?.passesPolicy === false
                ? ['insufficient_citation_coverage']
                : []),
            ],
            assistant: 'teresa',
            assistantSurface: 'workspace_copilot',
            actionSurface: 'governed_execution',
          },
        });
      };

      const maybeEmitTeresaProposal = async (assistantText: string) => {
        const contextFailedAttachments = Array.isArray((context as any)?.failedAttachments)
          ? (context as any).failedAttachments
          : [];
        const contextUsableAttachments = Array.isArray((context as any)?.attachments)
          ? (context as any).attachments.filter((a: any) => a?.docId)
          : [];
        if (
          virtualWorkerSlug !== 'teresa' ||
          !req.organizationId ||
          !req.userId ||
          !assistantText ||
          assistantText.trim().length === 0 ||
          (contextFailedAttachments.length > 0 && contextUsableAttachments.length === 0)
        ) {
          return null;
        }

        try {
          const teresaModule = await import('../services/v8/teresaCopilotService.js');
          const proposal = await teresaModule.createChatProposal({
            organizationId: req.organizationId,
            userId: req.userId,
            sessionId: conversationId || streamSessionId,
            userMessage: message,
            assistantMessage: assistantText,
            context: (context || {}) as Record<string, unknown>,
            citations: collectedCitations,
          });

          if (proposal) {
            emitSSE({
              type: 'teresa_proposal',
              proposal,
            });
          }

          return proposal;
        } catch (proposalErr: any) {
          logger.warn(
            '[AI Stream] Teresa proposal synthesis skipped:',
            proposalErr?.message || proposalErr
          );
          return null;
        }
      };

      if (
        virtualWorkerSlug === 'teresa' &&
        isGovernedMutationApprovalBypassRequest(message) &&
        req.organizationId &&
        req.userId
      ) {
        const governedReply = isPolish
          ? 'Nie mogę wykonać tej zmiany po cichu ani bez Twojej zgody. Każda mutacja w workspace musi przejść przez proposal, osobne zatwierdzenie, wykonanie i audyt AIRun.'
          : 'I cannot make this change silently or without your approval. Every workspace mutation must go through a proposal, separate approval, execution and AIRun audit.';

        accumulatedContent += governedReply;
        emitSSE({ text: governedReply });
        await maybeEmitTeresaProposal(governedReply);
        emitTrustBundle(governedReply);
        streamCompleted = true;
        clearInterval(heartbeatInterval);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // --------------------------------------------------------
      // Policy gateway (P34-B): allow/deny + rationale + citations/uncertainty posture
      // --------------------------------------------------------
      emitSSE({
        type: 'thought',
        step: 'policy',
        status: 'in_progress',
        label: 'Checking safety policy and evidence requirements…',
      });
      try {
        const polMod = await import('../services/ai/chatPolicyGateway.js');
        const { evaluateChatPolicyDecision } = (polMod as any) || {};
        if (typeof evaluateChatPolicyDecision !== 'function') {
          throw new Error('evaluateChatPolicyDecision is not a function');
        }

        const polRes = await evaluateChatPolicyDecision({
          message: String(message || ''),
          language,
          organizationId: req.organizationId || null,
          userId: req.userId || null,
          projectId,
          privateMode: Boolean(privateMode),
          aiModes: aiModes || null,
          knowledgeSources: knowledgeSources || null,
        });

        policyDecision = polRes?.decision || null;
        const sanitizedMessage =
          typeof polRes?.sanitizedMessage === 'string' ? String(polRes.sanitizedMessage) : '';
        if (sanitizedMessage && sanitizedMessage !== String(message || '').trim()) {
          try {
            (pipelineRequest as any).prompt = sanitizedMessage;
          } catch {
            // ignore
          }
        }
      } catch (polErr: any) {
        logger.error(
          '[AI Stream] Policy gateway unavailable (fail-closed):',
          polErr?.message || String(polErr)
        );

        const degradedMsg =
          'Policy gateway unavailable — request blocked for safety. Please try again.';

        emitSSE({
          type: 'policy_refusal',
          decisionId: null,
          category: 'gateway_unavailable',
          rationale: degradedMsg,
          message: degradedMsg,
          nextSteps: [],
        });

        if (isClientConnected && !res.destroyed) {
          try {
            res.write(`data: ${JSON.stringify({ text: degradedMsg })}\n\n`);
            emitTrustBundle(degradedMsg);
            res.write('data: [DONE]\n\n');
          } catch {
            /* ignore */
          }
        }

        streamCompleted = true;
        clearInterval(heartbeatInterval);

        if (chatRunId) {
          try {
            const svcMod = await import('../services/ai/chatTraceService.js');
            await (svcMod.default || svcMod).completeRun({
              runId: chatRunId,
              status: 'blocked',
              pipelineTraceId: pipelineMeta?.traceId || null,
              modelProvider: pipelineMeta?.provider || null,
              modelId: pipelineMeta?.model || null,
              tier: selectedTier || null,
              outputText: degradedMsg,
              dtStates: dtStatesEmitted,
            });
          } catch {
            /* ignore */
          }
        }
        return res.end();
      }

      if (policyDecision) {
        emitSSE({
          type: 'policy_decision',
          decision: sanitizePolicyDecisionForClient(policyDecision),
        });
        if (chatRunId) {
          import('../services/ai/chatTraceService.js')
            .then((m: any) =>
              (m.default || m).addEvent(chatRunId, 'policy_decision', policyDecision)
            )
            .catch(() => {
              /* ignore */
            });
        }
      }

      // Deny: enforce refusal UX early and terminate stream deterministically.
      if (policyDecision && policyDecision.allowed === false) {
        const refusal = policyDecision?.refusal || {};
        const msg = String(refusal?.userMessage || '').trim();
        const steps = Array.isArray(refusal?.nextSteps) ? refusal.nextSteps : [];
        const refusalText = [
          msg ||
            (language?.startsWith('pl')
              ? 'Nie mogę spełnić tej prośby.'
              : "I can't comply with that request."),
          steps.length
            ? (language?.startsWith('pl') ? '\n\n**Co dalej:**\n' : '\n\n**What to do next:**\n') +
              steps
                .slice(0, 6)
                .map((s: any) => `- ${String(s || '').trim()}`)
                .join('\n')
            : '',
        ]
          .filter(Boolean)
          .join('');

        // Emit a structured refusal event for UI, plus plain text chunk to ensure the bubble renders.
        emitSSE({
          type: 'policy_refusal',
          decisionId: policyDecision?.id || null,
          category: policyDecision?.category || null,
          rationale: policyDecision?.rationale || null,
          message: msg || null,
          nextSteps: steps || [],
        });

        accumulatedContent = refusalText;
        if (isClientConnected && !res.destroyed) {
          try {
            res.write(`data: ${JSON.stringify({ text: refusalText })}\n\n`);
            emitTrustBundle(refusalText);
            res.write('data: [DONE]\n\n');
          } catch {
            /* ignore */
          }
        }

        streamCompleted = true;
        clearInterval(heartbeatInterval);

        if (chatRunId) {
          try {
            const svcMod = await import('../services/ai/chatTraceService.js');
            await (svcMod.default || svcMod).completeRun({
              runId: chatRunId,
              status: 'blocked',
              pipelineTraceId: pipelineMeta?.traceId || null,
              modelProvider: pipelineMeta?.provider || null,
              modelId: pipelineMeta?.model || null,
              tier: selectedTier || null,
              outputText: refusalText,
              dtStates: dtStatesEmitted,
            });
          } catch {
            /* ignore */
          }
        }
        return res.end();
      }

      // Allow: enforce evidence posture at the prompt level (bounded).
      if (policyDecision?.allowed === true && policyDecision?.evidence?.required) {
        try {
          const evidenceAddon = [
            '## EVIDENCE & CITATIONS (Policy gateway)',
            '- If you state factual claims (numbers, dates, “X is true”), you MUST either:',
            '  (a) cite available evidence inline using [1], [2] (KB/web/attachments citations), OR',
            '  (b) explicitly mark uncertainty and give a concrete verification plan.',
            '- Never pretend you used sources you do not have.',
          ].join('\n');
          (pipelineRequest as any).options = {
            ...(pipelineRequest as any).options,
            systemInstruction:
              String(((pipelineRequest as any).options as any)?.systemInstruction || '') +
              `\n\n${evidenceAddon}\n`,
          };
        } catch {
          // ignore
        }
      }

      // T120: Private mode / retention — memory injection must be gated.
      // Also: Deep Thinking autonomy should not inject memory add-ons into the system instruction.
      let memoryInjectionAllowed = !privateMode && !aiModes?.deepResearch;
      if (memoryInjectionAllowed && req.userId) {
        try {
          const upMod = (await import('../services/ai/userPrivacyService.js')) as any;
          const privacy = (upMod.default || upMod) as any;
          if (privacy?.getUserPrivacySettings) {
            const settings = await privacy.getUserPrivacySettings(req.userId);
            const canRead =
              typeof privacy.canReadMemory === 'function'
                ? privacy.canReadMemory(settings, false /* isPrivateMode */)
                : Boolean(settings?.memoryEnabled);
            if (!canRead || settings?.retentionMode === 'none') memoryInjectionAllowed = false;
          }
        } catch {
          // fail-open: keep current decision
        }
      }

      // --------------------------------------------------------
      // Memory injection (short-term summary + long-term user/org)
      // --------------------------------------------------------
      if (memoryInjectionAllowed) {
        emitSSE({
          type: 'thought',
          step: 'memory',
          status: 'in_progress',
          label: 'Loading conversation context and memory…',
        });
        try {
          const convIdForMemory = conversationId || null;
          const [convSummary, ltmAddon] = await Promise.all([
            convIdForMemory
              ? import('../services/ai/conversationSummaryService.js')
                  .then((mod: any) => (mod.default || mod).get(convIdForMemory))
                  .catch(() => '')
              : Promise.resolve(''),
            req.userId && req.organizationId
              ? import('../services/ai/longTermMemoryService.js')
                  .then((mod: any) =>
                    (mod.default || mod).getPromptAddendum({
                      userId: req.userId,
                      organizationId: req.organizationId,
                    })
                  )
                  .catch(() => '')
              : Promise.resolve(''),
          ]);

          const parts: string[] = [];
          const hasSummary = Boolean(convSummary && String(convSummary).trim().length > 0);
          const hasLtm = Boolean(ltmAddon && String(ltmAddon).trim().length > 0);

          if (hasSummary) {
            parts.push('## SHORT-TERM MEMORY (conversation summary)');
            parts.push(String(convSummary).trim());
            parts.push(
              '',
              'Rules:',
              '- Use this as context, but prefer the latest user message if there is conflict.',
              '- Do not mention the existence of this summary unless asked.'
            );
          }
          if (hasLtm) {
            parts.push(String(ltmAddon).trim());
          }

          const memoryAddon = parts.join('\n');
          if (memoryAddon.trim().length > 0) {
            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n${memoryAddon}\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                memory: {
                  conversationSummary: convSummary || '',
                  longTermInjected: hasLtm,
                },
              },
            } as any;
          }

          // Trace event (best-effort)
          if (chatRunId) {
            import('../services/ai/chatTraceService.js')
              .then((m: any) =>
                (m.default || m).addEvent(chatRunId, 'memory_injected', { hasSummary, hasLtm })
              )
              .catch(() => {
                /* ignore */
              });
          }
        } catch {
          // ignore memory failures
        }
      }

      let workerWebPolicyOverride: WorkerWebAccessPolicy | null = null;
      if (virtualWorkerSlug) {
        emitSSE({
          type: 'thought',
          step: 'virtual_worker',
          status: 'in_progress',
          label: `Loading ${virtualWorkerSlug} worker profile and governed knowledge…`,
        });
        try {
          const workerService = await import('../services/ai/virtualWorkerService.js');
          const workerKnowledgeService =
            await import('../services/ai/virtualWorkerKnowledgeService.js');
          const workerWebAccessService =
            await import('../services/ai/virtualWorkerWebAccessService.js');
          const workerConfig = await workerService.getWorkerWithProfile(virtualWorkerSlug);

          if (workerConfig?.worker) {
            const workerSurface = String(workerConfig.worker.surface || 'in_platform');
            const workerPublicStateOk =
              workerConfig.worker.status === 'active' &&
              (workerSurface === 'in_platform' || workerSurface === 'both');

            if (workerPublicStateOk && workerConfig.profile) {
              const workerPromptAddon = String(workerConfig.profile.system_prompt || '').trim();
              if (workerPromptAddon) {
                pipelineRequest = {
                  ...pipelineRequest,
                  options: {
                    ...(pipelineRequest.options || {}),
                    systemInstruction:
                      `## ACTIVE WORKER PROFILE (${workerConfig.worker.name})\n${workerPromptAddon}\n\n` +
                      String((pipelineRequest.options as any)?.systemInstruction || ''),
                  },
                } as any;
              }

              const workerKnowledge = await workerKnowledgeService.buildWorkerKnowledgeContext({
                workerSlug: virtualWorkerSlug,
                query: String(message || ''),
                locale: language,
                limit: 6,
              });

              if (workerKnowledge?.contextText?.trim()) {
                hasGovernedGrounding = true;
                pipelineRequest = {
                  ...pipelineRequest,
                  options: {
                    ...(pipelineRequest.options || {}),
                    systemInstruction:
                      String((pipelineRequest.options as any)?.systemInstruction || '') +
                      `\n\n## GOVERNED WORKER KNOWLEDGE (${workerConfig.worker.name})\n${workerKnowledge.contextText}\n`,
                  },
                  context: {
                    ...((pipelineRequest as any).context || {}),
                    external: {
                      ...((pipelineRequest as any).context?.external || {}),
                      workerKnowledge: {
                        workerSlug: virtualWorkerSlug,
                        sources: workerKnowledge.sources || [],
                        matchedProducts: workerKnowledge.matchedProducts || [],
                        primaryProducts: workerKnowledge.primaryProducts || [],
                        usedPillIds: workerKnowledge.usedPillIds || [],
                        usedPillSections: workerKnowledge.usedPillSections || [],
                        fallbackReason: workerKnowledge.fallbackReason || null,
                      },
                    },
                  },
                } as any;
              }

              const governedCitations = buildGovernedKnowledgeCitations(
                workerKnowledge?.sources || [],
                `${workerConfig.worker.name} knowledge`
              );
              if (governedCitations.length > 0) {
                emitSSE({ type: 'citations', citations: governedCitations });
              }

              const extractedWorkerWebPolicy = workerWebAccessService.extractWorkerWebAccessPolicy(
                workerConfig.profile
              );
              workerWebPolicyOverride = extractedWorkerWebPolicy.internetEnabled
                ? extractedWorkerWebPolicy
                : null;
            }
          }
        } catch (workerErr: any) {
          logger.warn(
            '[AI Stream] Virtual worker overlay failed:',
            workerErr?.message || String(workerErr)
          );
        }
      }

      if (isProductAssistantHowToQuery) {
        const fallback = buildProductAssistantFallback(
          String(message || ''),
          Boolean(language?.startsWith('pl'))
        );
        if (fallback) {
          hasGovernedGrounding = true;
          emitSSE({ type: 'citations', citations: fallback.citations });
          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                fallback.instruction,
            },
          } as any;
        }
      }

      logger.info(`[AI Stream] Processing request for user ${req.userId}`, {
        projectId,
        focusMode,
        hasScreenContext: !!screenContext,
        screenId: screenContext?.screenId || screenContext?.currentScreen || 'unknown',
      });

      // --------------------------------------------------------
      // Help / KB documentation grounding (product how-to)
      // --------------------------------------------------------
      // Lightweight retrieval: inject only a few relevant KB articles as snippets.
      // Also stream KB citations so the UI can show them.
      emitSSE({
        type: 'thought',
        step: 'knowledge',
        status: 'in_progress',
        label: 'Searching knowledge base and documentation…',
      });
      try {
        const kbModuleId =
          String(
            (screenContext as any)?.page?.helpModuleId ||
              (screenContext as any)?.moduleId ||
              (screenContext as any)?.module ||
              (screenContext as any)?.currentModule ||
              (screenContext as any)?.screenId ||
              (screenContext as any)?.currentScreen ||
              ''
          ).trim() || null;

        const kb = await buildHelpDocsContext({
          query: message,
          language,
          moduleId: kbModuleId,
          surface: 'ai_recommendations',
          maxArticles: 3,
          maxCharsPerArticle: 1200,
        });

        if (kb?.citations?.length) {
          hasGovernedGrounding = true;
          emitSSE({ type: 'citations', citations: kb.citations });
          if (chatRunId) {
            import('../services/ai/chatTraceService.js')
              .then((m: any) =>
                (m.default || m).addEvent(chatRunId, 'kb_docs', {
                  moduleId: kbModuleId,
                  citationsCount: kb.citations.length,
                })
              )
              .catch(() => {
                /* ignore */
              });
          }
        }

        if (kb?.systemInstructionAddon?.trim()) {
          if (kb.isProductQuestion) hasGovernedGrounding = true;
          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                `\n\n${kb.systemInstructionAddon}\n`,
            },
            context: {
              ...((pipelineRequest as any).context || {}),
              external: {
                ...((pipelineRequest as any).context?.external || {}),
                helpDocs: {
                  query: message,
                  moduleId: kbModuleId,
                  articles: kb.articles || [],
                  citations: kb.citations || [],
                },
              },
            },
          } as any;
        }
      } catch (kbErr: any) {
        logger.warn('[AI Stream] KB docs retrieval failed, continuing without it:', kbErr?.message);
      }

      // --------------------------------------------------------
      // Org-content retrieval (ff_teresaRetrieval / ENABLE_TERESA_RETRIEVAL)
      // --------------------------------------------------------
      // Lets Teresa locate notes / insights / initiatives the user references
      // by topic ("zrób dokument z notatki o spotkaniu z Elkomtech"). The chat
      // stream has no model-driven tool loop (AIPipeline → llmService.callStream),
      // so this mirrors the KB-docs pattern above: run the READ tools from the
      // MCP registry server-side and inject their compact JSON results into the
      // system instruction + context.external. Flag off ⇒ block is inert.
      try {
        const teresaRetrievalEnabled = process.env.ENABLE_TERESA_RETRIEVAL === 'true';
        if (teresaRetrievalEnabled && req.organizationId && req.userId && message) {
          const msg = String(message);
          // PL stems cover inflected forms (notatka/notatki/notatce, wniosek/wniosków, inicjatywa/inicjatywie).
          const wantsNotes = /notatk\w*|notatnik\w*|\bnotes?\b|notebook/i.test(msg);
          const wantsInsights = /wniosk\w*|wniosek|insight\w*/i.test(msg);
          const wantsInitiative = /inicjatyw\w*|initiative\w*/i.test(msg);
          const initiativeIdMatch = wantsInitiative
            ? msg.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
            : null;
          // Teresa mind-map retrieval (ff_teresaMindmapSearch) — co-gated on its
          // own flag (Krok C: ENABLE_TERESA_MINDMAP_SEARCH, OR'd with legacy
          // ENABLE_TERESA_MINDMAP for backward compat — see orgRetrievalShared.ts).
          // PL stems: mapa/mapę/mapie myśli, "mind map/mindmap". Also match bare
          // "mapa myśli" phrasing and English "mind map".
          const wantsMindmap =
            isTeresaMindmapSearchEnabled() &&
            /map[aeęy]\s*myśl\w*|mapa\s+myśli|mind[\s-]?map\w*|mapę?\s+myśli/i.test(msg);

          if (wantsNotes || wantsInsights || initiativeIdMatch || wantsMindmap) {
            emitSSE({
              type: 'thought',
              step: 'org_retrieval',
              status: 'in_progress',
              label: 'Searching organization content…',
            });

            const { mcpServer } = await import('../services/ai/mcpServer.js');
            await import('../services/ai/tools/index.js').catch(() => {
              /* handlers already registered */
            });
            const toolContext = {
              organizationId: req.organizationId,
              userId: req.userId,
            };
            const retrievalQuery = msg.slice(0, 300);
            const toolResults: Record<string, unknown> = {};

            if (wantsNotes) {
              toolResults.search_org_notes = await mcpServer.execute(
                'search_org_notes',
                { query: retrievalQuery, limit: 5 },
                toolContext
              );
            }
            if (wantsInsights) {
              toolResults.search_insights = await mcpServer.execute(
                'search_insights',
                { query: retrievalQuery, limit: 5 },
                toolContext
              );
            }
            if (initiativeIdMatch) {
              toolResults.get_initiative = await mcpServer.execute(
                'get_initiative',
                { initiativeId: initiativeIdMatch[0] },
                toolContext
              );
            }
            if (wantsMindmap) {
              toolResults.search_org_mindmaps = await mcpServer.execute(
                'search_org_mindmaps',
                { query: retrievalQuery, limit: 5 },
                toolContext
              );
            }

            // Each tool already caps its payload at ~4KB; this is a hard backstop.
            const serialized = JSON.stringify(toolResults).slice(0, 13000);
            const orgRetrievalAddon =
              `[ORG CONTENT SEARCH — tool results]\n` +
              `The user referenced organization content by topic. The retrieval tools ` +
              `(search_org_notes / search_insights / get_initiative / search_org_mindmaps) ran with the user's message as the query. ` +
              `Use ONLY these results to identify the item: name the best match (title + id) and confirm with the user ` +
              `that it is the right one BEFORE acting on it. If several candidates fit, list up to 3 and ask the user to pick. ` +
              `If results are empty, say so and ask for a more specific title or topic. Never invent note/insight/initiative/mind-map content.\n` +
              `${serialized}`;

            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n${orgRetrievalAddon}\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                external: {
                  ...((pipelineRequest as any).context?.external || {}),
                  orgRetrieval: {
                    query: retrievalQuery,
                    tools: toolResults,
                  },
                },
              },
            } as any;

            if (chatRunId) {
              import('../services/ai/chatTraceService.js')
                .then((m: any) =>
                  (m.default || m).addEvent(chatRunId, 'org_retrieval', {
                    tools: Object.keys(toolResults),
                  })
                )
                .catch(() => {
                  /* ignore */
                });
            }
          }
        }
      } catch (orgRetrievalErr: any) {
        logger.warn(
          '[AI Stream] Org-content retrieval failed, continuing without it:',
          orgRetrievalErr?.message
        );
      }

      // --------------------------------------------------------
      // AI-suggested Deep Thinking activation (hint)
      // When DT is OFF, check if user's message looks strategic and suggest DT.
      // --------------------------------------------------------
      if (!aiModes?.deepResearch && message && message.trim().length >= 20) {
        try {
          const { detectDeepThinkingIntent } =
            await import('../services/ai/deepThinkingHintService.js');
          const hint = detectDeepThinkingIntent(message, language);
          if (hint.shouldSuggest) {
            emitSSE({
              type: 'dt_hint',
              reason: hint.reason,
              confidence: hint.confidence,
            });
          }
        } catch (_hintErr) {
          // Non-critical; swallow silently
        }
      }

      // --------------------------------------------------------
      // Web Search (non-DeepThinking mode) — auto-detect + smart queries
      // --------------------------------------------------------
      // Strategy:
      // 1. If user explicitly enabled webSearch → always search
      // 2. If webSearch is default (true) → use intent detector to decide
      // 3. Use optimized search queries (not raw message) for better results
      // 4. Run multiple queries for complex questions
      // 5. Inject results + citations into system instruction for grounded answers
      if (!aiModes?.deepResearch && (aiModes?.webSearch || message?.trim().length >= 20)) {
        emitSSE({
          type: 'thought',
          step: 'web_search_check',
          status: 'in_progress',
          label: 'Checking if web search is needed…',
        });
      }
      if (!aiModes?.deepResearch) {
        const userEnabledWebSearch = aiModes?.webSearch === true;
        const explicitExternalWebRequest =
          /\b(sprawdź w internecie|wyszukaj|znajdź w sieci|web research|search the web|look up|google)\b/i.test(
            String(message || '')
          );
        const explicitResearchRequest = isExplicitResearchAsk(message);
        const orgIdForWeb = req.organizationId || null;

        // T118: unified governance for all web search (policy + SSRF + allow/deny + sanitize + cache)
        let webPolicy: any = null;
        let webGov: any = null;
        try {
          webGov = (await import('../services/ai/webSearchGovernance.js')) as any;
          const getEffectiveWebSearchPolicy =
            webGov.getEffectiveWebSearchPolicy || webGov.default?.getEffectiveWebSearchPolicy;
          if (orgIdForWeb && typeof getEffectiveWebSearchPolicy === 'function') {
            webPolicy = await getEffectiveWebSearchPolicy(
              String(orgIdForWeb),
              projectId || undefined
            );
          }
          if (workerWebPolicyOverride) {
            const mergeWorkerWebAccessPolicy = (
              await import('../services/ai/virtualWorkerWebAccessService.js')
            ).mergeWorkerWebAccessPolicy;
            webPolicy = mergeWorkerWebAccessPolicy({
              workerPolicy: workerWebPolicyOverride as any,
              orgPolicy: webPolicy,
              requireOrgPolicy: true,
            });
          }
        } catch {
          webPolicy = null;
          webGov = null;
        }

        // Auto-detect web search intent
        let searchIntent: any = null;
        try {
          const { detectWebSearchIntent } =
            await import('../services/ai/webSearchIntentDetector.js');
          searchIntent = detectWebSearchIntent(message, {
            userEnabledWebSearch:
              userEnabledWebSearch || Boolean((workerWebPolicyOverride as any)?.autoSearch),
            historyLength: Array.isArray(history) ? history.length : 0,
          });
        } catch (err: any) {
          logger.debug('[AI Stream] Intent detector not available:', err?.message);
          // Fallback: if user enabled webSearch, search with raw message
          if (userEnabledWebSearch) {
            searchIntent = {
              shouldSearch: true,
              confidence: 0.5,
              reason: 'user toggle enabled (fallback)',
              queries: [message.slice(0, 150)],
              searchDepth: 'basic' as const,
              maxResults: 5,
            };
          }
        }

        const workerAutoSearchRequested = Boolean((workerWebPolicyOverride as any)?.autoSearch);
        const governedKnowledgeSuppressesWeb =
          (shouldPreferGovernedProductKnowledge || mentionsGovernedDbrProduct) &&
          !explicitExternalWebRequest;
        if (
          !governedKnowledgeSuppressesWeb &&
          !suppressWebForInternalOpsHealth &&
          (searchIntent?.shouldSearch || workerAutoSearchRequested) &&
          webPolicy?.internetEnabled
        ) {
          try {
            const { RuntimeWebSearchService } =
              await import('../services/ai/runtimeWebSearchService.js');
            const svc = new (RuntimeWebSearchService as any)();
            const sanitizeQuery = webGov?.sanitizeQuery || webGov?.default?.sanitizeQuery;
            const filterResults = webGov?.filterResults || webGov?.default?.filterResults;
            const getCached = webGov?.getCached || webGov?.default?.getCached;
            const setCache = webGov?.setCache || webGov?.default?.setCache;

            // Execute search queries (possibly multiple for complex questions)
            const searchQueries: string[] =
              searchIntent.queries?.length > 0 ? searchIntent.queries : [message.slice(0, 150)];

            emitSSE({
              type: 'research_progress',
              topic: message,
              stage: 'searching',
              queries: searchQueries,
              sources: [],
            });

            const allResults: any[] = [];
            const allAnswers: string[] = [];
            for (const query of searchQueries.slice(0, 3)) {
              try {
                const cleanQuery =
                  typeof sanitizeQuery === 'function' ? sanitizeQuery(String(query || '')) : query;
                const cached =
                  orgIdForWeb && typeof getCached === 'function'
                    ? getCached(String(orgIdForWeb), cleanQuery, language)
                    : null;
                const resp =
                  cached ||
                  (await svc.search(cleanQuery, {
                    maxResults: searchIntent.maxResults ?? 5,
                    includeNews: true,
                    searchDepth: searchIntent.searchDepth ?? 'basic',
                    language,
                  }));
                const resultsRaw = Array.isArray((resp as any)?.results)
                  ? (resp as any).results
                  : [];
                const results =
                  typeof filterResults === 'function'
                    ? filterResults(resultsRaw, webPolicy)
                    : resultsRaw;
                allResults.push(...results);
                if ((resp as any)?.answer) allAnswers.push((resp as any).answer);
                if (!cached && orgIdForWeb && typeof setCache === 'function') {
                  try {
                    setCache(
                      String(orgIdForWeb),
                      cleanQuery,
                      { ...(resp as any), query: cleanQuery, results },
                      language
                    );
                  } catch {
                    // ignore
                  }
                }
              } catch (qErr: any) {
                logger.debug(`[AI Stream] Query "${query}" failed: ${qErr?.message}`);
              }
            }

            // Deduplicate by URL
            const seenUrls = new Set<string>();
            const dedupedResults = allResults.filter((r: any) => {
              if (!r?.url || seenUrls.has(r.url)) return false;
              seenUrls.add(r.url);
              return true;
            });

            const citations = dedupedResults
              .filter((r: any) => r?.url && r?.title)
              .slice(0, 8)
              .map((r: any, idx: number) => ({
                id: `web_${idx + 1}`,
                type: 'external',
                title: String(r.title || ''),
                reference: String(r.url || ''),
                link: String(r.url || ''),
                excerpt: String(r.snippet || ''),
              }));

            if (citations.length === 0 && (userEnabledWebSearch || explicitResearchRequest)) {
              const noSourcesText = buildNoWebSourcesText(searchQueries, isPolish);
              accumulatedContent += noSourcesText;
              hasGovernedGrounding = true;
              res.write(`data: ${JSON.stringify({ text: noSourcesText })}\n\n`);
              emitSSE({
                type: 'research_progress',
                topic: message,
                stage: 'complete',
                queries: searchQueries,
                sources: [],
                error: isPolish
                  ? 'Nie znaleziono wiarygodnych źródeł web'
                  : 'No reliable web sources found',
              });
              emitSSE({
                type: 'policy_notice',
                notice: {
                  type: 'no_sources',
                  severity: 'info',
                  title: isPolish ? 'Brak źródeł web' : 'No web sources',
                  message: isPolish
                    ? 'Research został zatrzymany, bo nie znaleziono bezpiecznych źródeł do zacytowania.'
                    : 'Research was stopped because no safe sources were available to cite.',
                  displayToUser: false,
                },
              });
              if (chatRunId) {
                import('../services/ai/chatTraceService.js')
                  .then((m: any) =>
                    (m.default || m).addEvent(chatRunId, 'web_search_no_sources', {
                      queries: searchQueries,
                      intent: searchIntent.reason,
                      confidence: searchIntent.confidence,
                    })
                  )
                  .catch(() => {
                    /* non-critical */
                  });
              }
              emitSSE({
                type: 'done',
                responseId: `ai-${Date.now()}`,
                metadata: {
                  confidence: 0.45,
                  processingTime: Date.now() - startTime,
                  webSearch: {
                    attempted: true,
                    queries: searchQueries,
                    citationsCount: 0,
                  },
                },
              });
              streamCompleted = true;
              clearInterval(heartbeatInterval);
              emitTrustBundle(noSourcesText);
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }

            if (citations.length > 0) {
              emitSSE({ type: 'citations', citations });
            }

            emitSSE({
              type: 'research_progress',
              topic: message,
              stage: 'complete',
              queries: searchQueries,
              sources: citations.map((c: any) => ({ title: c.title, url: c.link })),
            });

            if (chatRunId) {
              import('../services/ai/chatTraceService.js')
                .then((m: any) =>
                  (m.default || m).addEvent(chatRunId, 'web_search', {
                    queries: searchQueries,
                    citationsCount: citations.length,
                    intent: searchIntent.reason,
                    confidence: searchIntent.confidence,
                  })
                )
                .catch(() => {
                  /* non-critical */
                });
            }

            // Inject sources + web-search synthesis into system instruction
            const sourcesText = citations
              .map((c: any, i: number) => `[${i + 1}] ${c.title}\n${c.link}\n${c.excerpt || ''}`)
              .join('\n\n');

            const tavilyAnswerText =
              allAnswers.length > 0
                ? `\n\n## WEB SEARCH SYNTHESIS\n${allAnswers.join('\n\n')}`
                : '';

            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n## WEB SOURCES (${citations.length} results from ${searchQueries.length} queries)\n${sourcesText}${tavilyAnswerText}\n\nRules:\n- When using any web source, cite it inline like [1], [2].\n- If sources are insufficient or contradictory, say so.\n- Prioritize higher-scored sources and prefer recent data.\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                external: {
                  ...(context as any)?.external,
                  webSearch: {
                    queries: searchQueries,
                    results: dedupedResults,
                    answers: allAnswers,
                    intent: searchIntent.reason,
                  },
                  citations,
                },
              },
            } as any;
          } catch (err: any) {
            logger.warn('[AI Stream] Web search failed, continuing without it:', err?.message);
            emitSSE({
              type: 'research_progress',
              topic: message,
              stage: 'complete',
              queries: [],
              sources: [],
              error: 'Web research unavailable',
            });
          }
        } else if (searchIntent?.shouldSearch && !webPolicy?.internetEnabled) {
          // User/auto-detect wants web search but policy forbids or key missing
          logger.info('[AI Stream] Web search intent detected but internet is disabled', {
            reason: webPolicy?.reason || null,
          });
          emitSSE({
            type: 'research_progress',
            topic: message,
            stage: 'complete',
            queries: [],
            sources: [],
            error: webPolicy?.reason || 'Web search unavailable',
          });
        }
      }

      // --------------------------------------------------------
      // Conversation-scoped RAG from attached documents
      // --------------------------------------------------------
      // The client can attach documents to a conversation and pass their `knowledge_docs.id` as:
      // - context.attachmentDocIds: string[]
      // - OR context.attachments: Array<{ docId: string; ... }>
      // We then restrict retrieval to ONLY those doc IDs.
      const attachmentDocIdsRaw =
        (context as any)?.attachmentDocIds ||
        (Array.isArray((context as any)?.attachments)
          ? (context as any).attachments.map((a: any) => a?.docId).filter(Boolean)
          : null);
      const attachmentDocIds = Array.isArray(attachmentDocIdsRaw)
        ? Array.from(new Set(attachmentDocIdsRaw.map((x: any) => String(x)).filter(Boolean)))
        : [];

      // F3: merge the conversation's PROJECT knowledge files into the RAG scope so
      // Teresa can retrieve from project-shared documents. Guarded — table may not
      // exist yet. Only widens retrieval; never throws.
      try {
        if (conversationId) {
          const { all: dbAll } = await import('../utils/DbPromise.js');
          const kRows = (await dbAll(
            `SELECT k.doc_id FROM conversations c
             JOIN project_knowledge k ON k.project_id = c.chat_project_id
             WHERE c.id = ? AND k.kind = 'file' AND k.doc_id IS NOT NULL`,
            [conversationId]
          )) as Array<{ doc_id?: string }>;
          for (const r of kRows || []) {
            const d = String(r.doc_id || '').trim();
            if (d && !attachmentDocIds.includes(d)) attachmentDocIds.push(d);
          }
        }
      } catch {
        /* project_knowledge may not exist yet — skip */
      }
      const failedAttachments = Array.isArray((context as any)?.failedAttachments)
        ? (context as any).failedAttachments
            .map((a: any) => ({
              filename: String(a?.filename || 'attachment'),
              error: String(a?.error || 'Extraction failed'),
              code: a?.code ? String(a.code) : null,
              extractionStatus: a?.extractionStatus ? String(a.extractionStatus) : 'failed',
            }))
            .filter((a: any) => a.filename || a.error)
        : [];

      if (failedAttachments.length > 0) {
        const failedText = failedAttachments
          .map(
            (a: any, index: number) =>
              `${index + 1}. ${a.filename}: ${a.error}${
                a.extractionStatus ? ` (status: ${a.extractionStatus})` : ''
              }`
          )
          .join('\n');
        pipelineRequest = {
          ...pipelineRequest,
          options: {
            ...(pipelineRequest.options || {}),
            systemInstruction:
              String((pipelineRequest.options as any)?.systemInstruction || '') +
              `\n\n## ATTACHMENTS WITH EXTRACTION FAILURES\n${failedText}\n\nRules:\n- If the user asks about these failed attachments, do not invent their contents.\n- Explain the concrete extraction problem and suggest re-uploading a text PDF/TXT/MD/CSV/JSON, or using OCR for scanned PDFs.\n`,
          },
        } as any;
      }

      if (attachmentDocIds.length > 0 && message && message.trim().length > 0) {
        emitSSE({
          type: 'thought',
          step: 'attachments',
          status: 'in_progress',
          label: `Analyzing ${attachmentDocIds.length} attachment(s) — searching for relevant fragments…`,
        });
        let attachmentChunksInjected = false;
        // Stage 3 (Source Of Truth): use shared ContextRetrievalService for ACL-enforced
        // retrieval and lineage. Falls back to legacy ragService path on unexpected errors.
        try {
          const sharedRetrievalModule =
            await import('../services/organizationContext/ContextRetrievalService.js');
          const sharedRetrieval = (sharedRetrievalModule as any).default || sharedRetrievalModule;
          const requestedWorkflowMode = (() => {
            const raw = String((context as any)?.contextWorkflowMode || '').trim();
            return sharedRetrieval.isValidContextWorkflowMode(raw)
              ? raw
              : 'selected_material_plus_selected_context';
          })();
          const sharedResult = await sharedRetrieval.retrieveContext({
            organizationId: req.organizationId || '',
            userId: (req as any).user?.id || (req as any).userId || 'system',
            workflow: 'ai_chat',
            workflowMode: requestedWorkflowMode,
            retrievalQuery: message,
            retrievalReason: 'ai_chat_attachment_grounding',
            selectedDocumentIds: attachmentDocIds,
            perDocumentChunkLimit: 5,
            totalChunkLimit: 12,
          });

          if (
            sharedResult &&
            Array.isArray(sharedResult.chunks) &&
            sharedResult.chunks.length > 0
          ) {
            await sharedRetrieval.recordContextRetrievalLineage({
              organizationId: req.organizationId || '',
              userId: (req as any).user?.id || (req as any).userId || 'system',
              workflow: 'ai_chat',
              targetType: 'ai_chat_message',
              targetId: chatRunId || `chat_${Date.now()}`,
              eventType: 'ai_chat_context_retrieved',
              result: sharedResult,
              metadata: {
                attachmentSource: 'conversation_attachments',
                conversationId: (context as any)?.conversationId || null,
              },
            });
          }
        } catch (sharedErr: any) {
          logger.warn(
            '[AI Stream] Shared ContextRetrievalService failed, falling back to legacy ragService:',
            sharedErr?.message || String(sharedErr)
          );
        }

        try {
          const ragModule = await import('../services/ragService.js');
          const ragService = (ragModule.default || ragModule) as any;
          const chunks = await ragService.searchRelevantChunks(message, {
            limit: 5,
            organizationId: req.organizationId || undefined,
            documentIds: attachmentDocIds,
          });

          if (Array.isArray(chunks) && chunks.length > 0) {
            attachmentChunksInjected = true;
            emitSSE({
              type: 'thought',
              step: 'attachments',
              status: 'completed',
              label: `Found ${chunks.length} relevant fragment(s) across ${attachmentDocIds.length} attachment(s).`,
            });
            const attachmentsText = chunks
              .slice(0, 5)
              .map((c: any, i: number) => {
                const source = String(c?.source || 'Attachment');
                const content = String(c?.content || '').trim();
                return `[A${i + 1}] ${source}\n${content}`;
              })
              .join('\n\n');
            const attachmentCitations = chunks.slice(0, 5).map((c: any, i: number) => {
              const source = String(c?.source || 'Attachment');
              return {
                id: `attachment_${i + 1}`,
                type: 'document',
                title: source,
                reference: source,
                excerpt: String(c?.content || '')
                  .trim()
                  .slice(0, 500),
                // GF-CHAT-02 fragment anchor: real chunk ordinal
                // (knowledge_chunks.chunk_index via ragService.searchRelevantChunks),
                // `null` — never a fabricated `0` — when the source has none.
                fragmentIndex: typeof c?.chunkIndex === 'number' ? c.chunkIndex : null,
              };
            });
            emitSSE({ type: 'citations', citations: attachmentCitations });
            hasGovernedGrounding = true;

            pipelineRequest = {
              ...pipelineRequest,
              options: {
                ...(pipelineRequest.options || {}),
                systemInstruction:
                  String((pipelineRequest.options as any)?.systemInstruction || '') +
                  `\n\n## ATTACHMENTS (conversation-scoped sources)\n${attachmentsText}\n\nRules:\n- The user has attached documents to this conversation. The above content comes from those attachments.\n- Prefer these attachments when relevant.\n- If you use an attachment chunk, cite it inline like [A1], [A2].\n- If the attachments do not contain the needed info, say so.\n`,
              },
              context: {
                ...((pipelineRequest as any).context || {}),
                external: {
                  ...(context as any)?.external,
                  attachmentsRag: {
                    documentIds: attachmentDocIds,
                    chunks,
                  },
                },
              },
            } as any;

            if (chatRunId) {
              import('../services/ai/chatTraceService.js')
                .then((m: any) =>
                  (m.default || m).addEvent(chatRunId, 'attachment_rag', {
                    attachmentDocIdsCount: attachmentDocIds.length,
                    chunksCount: chunks.length,
                  })
                )
                .catch(() => {
                  /* ignore */
                });
            }
          }
        } catch (err: any) {
          logger.warn(
            '[AI Stream] Attachment RAG failed, continuing without it:',
            err?.message || String(err)
          );
        }

        // Fallback: if RAG returned no chunks (e.g. embedding failure, query mismatch),
        // load raw chunks directly from DB to ensure the AI always sees attachment content.
        if (!attachmentChunksInjected) {
          try {
            const organizationIdForAttachmentFallback = req.organizationId || '';
            if (!organizationIdForAttachmentFallback) {
              throw new Error('organization_id_required_for_attachment_fallback');
            }
            const placeholders = attachmentDocIds.map(() => '?').join(',');
            const rows = await dbAll(
              `SELECT c.content, d.filename
               FROM knowledge_chunks c
               JOIN knowledge_docs d ON c.doc_id = d.id
               WHERE d.id IN (${placeholders})
                 AND d.organization_id = ?
                 AND (d.status IS NULL OR d.status IN ('ready', 'indexed'))
               ORDER BY c.chunk_index ASC
               LIMIT 10`,
              [...attachmentDocIds, organizationIdForAttachmentFallback],
              { fallback: true } as any
            );

            if (Array.isArray(rows) && rows.length > 0) {
              attachmentChunksInjected = true;
              emitSSE({
                type: 'thought',
                step: 'attachments',
                status: 'completed',
                label: `Loaded ${rows.length} raw chunk(s) directly from attachment source(s).`,
              });
              const attachmentsText = rows
                .map((r: any, i: number) => {
                  const source = String(r?.filename || 'Attachment');
                  const content = String(r?.content || '').trim();
                  return `[A${i + 1}] ${source}\n${content}`;
                })
                .join('\n\n');
              const attachmentCitations = rows.map((r: any, i: number) => {
                const source = String(r?.filename || 'Attachment');
                return {
                  id: `attachment_direct_${i + 1}`,
                  type: 'document',
                  title: source,
                  reference: source,
                  excerpt: String(r?.content || '')
                    .trim()
                    .slice(0, 500),
                };
              });
              emitSSE({ type: 'citations', citations: attachmentCitations });
              hasGovernedGrounding = true;

              pipelineRequest = {
                ...pipelineRequest,
                options: {
                  ...(pipelineRequest.options || {}),
                  systemInstruction:
                    String((pipelineRequest.options as any)?.systemInstruction || '') +
                    `\n\n## ATTACHMENTS (conversation-scoped sources — direct load)\n${attachmentsText}\n\nRules:\n- The user has attached documents to this conversation. The above content comes from those attachments.\n- Refer to this content when the user asks about their attachments.\n- If you use an attachment chunk, cite it inline like [A1], [A2].\n`,
                },
                context: {
                  ...((pipelineRequest as any).context || {}),
                  external: {
                    ...((pipelineRequest as any).context?.external || {}),
                    attachmentsRag: {
                      documentIds: attachmentDocIds,
                      chunks: rows.map((r: any) => ({
                        text: String(r?.content || ''),
                        content: String(r?.content || ''),
                        source: String(r?.filename || 'Attachment'),
                        metadata: {
                          title: String(r?.filename || 'Attachment'),
                          sourceType: 'document',
                        },
                      })),
                    },
                  },
                },
              } as any;

              logger.info(
                `[AI Stream] Attachment fallback: loaded ${rows.length} raw chunks for ${attachmentDocIds.length} doc(s)`
              );
            } else {
              logger.warn(
                `[AI Stream] Attachment fallback: no chunks found in DB for docIds: ${attachmentDocIds.join(', ')}`
              );
            }
          } catch (fbErr: any) {
            logger.warn(
              '[AI Stream] Attachment fallback DB query failed:',
              fbErr?.message || String(fbErr)
            );
          }
        }

        // If we still have no chunks but DO have attachment doc IDs, inject a minimal awareness note
        // so the AI knows the user attached files even if content couldn't be extracted.
        if (!attachmentChunksInjected && attachmentDocIds.length > 0) {
          const attachmentNames = (
            Array.isArray((context as any)?.attachments)
              ? (context as any).attachments
                  .map((a: any) => String(a?.filename || ''))
                  .filter(Boolean)
              : []
          ).join(', ');

          emitSSE({
            type: 'thought',
            step: 'attachments',
            status: 'warning',
            label: `Attachment content could not be retrieved — answering from metadata only${attachmentNames ? ` (${attachmentNames})` : ''}.`,
          });

          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                `\n\n## ATTACHMENTS (metadata only)\nThe user has attached ${attachmentDocIds.length} document(s) to this conversation${attachmentNames ? ` (${attachmentNames})` : ''}. ` +
                `However, the content could not be extracted or retrieved. ` +
                `If the user asks about these attachments, acknowledge that they were attached but explain that the content extraction may have failed and suggest re-uploading in a supported format (PDF, TXT, MD, CSV, JSON).\n`,
            },
          } as any;
        }
      }

      // --------------------------------------------------------
      // Notebook RAG: inject relevant notes when user is on Notebook tab
      // --------------------------------------------------------
      const wsCtx = (context as any)?.workspaceContext;
      if (
        wsCtx?.type === 'notebook' &&
        req.organizationId &&
        message &&
        message.trim().length > 0
      ) {
        try {
          const nbSearchMod = await import('../services/v8/notebookSearchService.js');
          const nbSearch = ((nbSearchMod as any).default || nbSearchMod) as any;
          const searchFn = nbSearch.searchNotebook || nbSearch.default?.searchNotebook;
          if (searchFn) {
            const results = await searchFn(req.organizationId, (req as any).userId || '', {
              q: message.slice(0, 300),
              limit: 5,
            } as any);
            const notes = Array.isArray(results?.results) ? results.results : [];
            if (notes.length > 0) {
              const notesText = notes
                .slice(0, 5)
                .map(
                  (n: any, i: number) =>
                    `[N${i + 1}] ${String(n.title || 'Untitled')}\n${String(n.snippet || '').slice(0, 500)}`
                )
                .join('\n\n');

              pipelineRequest = {
                ...pipelineRequest,
                options: {
                  ...(pipelineRequest.options || {}),
                  systemInstruction:
                    String((pipelineRequest.options as any)?.systemInstruction || '') +
                    `\n\n## NOTEBOOK CONTEXT (relevant notes from user's Notebook)\n${notesText}\n\nRules:\n- The user is currently working in their Notebook. The above notes are relevant to their query.\n- Reference these notes when helpful, citing as [N1], [N2], etc.\n- You can suggest editing, expanding, or connecting these notes.\n`,
                },
              } as any;
            }
          }
        } catch (err: any) {
          logger.warn(
            '[AI Stream] Notebook RAG failed, continuing without it:',
            err?.message || String(err)
          );
        }
      }

      // --------------------------------------------------------
      // Deep Thinking orchestration (standalone, composable)
      // --------------------------------------------------------
      // NOTE: `aiModes.deepResearch` is used as the Deep Thinking toggle in the client (ToolsMenu).
      if (aiModes?.deepResearch) {
        const { DeepThinkingOrchestrator } =
          await import('../services/ai/deepThinkingOrchestrator.js');
        const orchestrator = new (DeepThinkingOrchestrator as any)();
        const prelude = await orchestrator.runPrelude({
          message,
          language,
          context: (context || null) as any,
          aiModes: (aiModes || null) as any,
          // v2.0: pass clarification answers for focused research
          clarificationAnswers: (context as any)?.clarificationAnswers || null,
          emit: emitSSE,
        });

        const deepResearchSources = Array.isArray(prelude?.researchOutput?.sources)
          ? prelude.researchOutput.sources
          : [];
        if (deepResearchSources.length > 0) {
          const deepResearchCitations = deepResearchSources
            .slice(0, 12)
            .map((source: any, idx: number) => ({
              id: `deep_research_${idx + 1}`,
              type: 'external',
              title: String(source?.title || source?.domain || `Research source ${idx + 1}`),
              reference: String(source?.url || source?.domain || ''),
              link: String(source?.url || ''),
              excerpt: Array.isArray(source?.snippets)
                ? String(source.snippets[0] || '')
                : String(source?.fullContent || '').slice(0, 500),
            }));
          collectedCitations = mergeCitations(collectedCitations, deepResearchCitations);
          hasGovernedGrounding = true;
          emitSSE({ type: 'citations', citations: deepResearchCitations });

          pipelineRequest = {
            ...pipelineRequest,
            context: {
              ...((pipelineRequest as any).context || {}),
              external: {
                ...(((pipelineRequest as any).context || {}).external || {}),
                citations: deepResearchCitations,
                deepResearch: {
                  sources: deepResearchSources,
                  researchType: prelude?.researchType || null,
                },
              },
            },
          } as any;
        }

        if (prelude?.systemInstructionAddon) {
          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              // Re-assert the language AFTER the Deep Thinking addon: the addon
              // carries an English section template and used to land last in the
              // prompt, which pulled deep_research_synthesis output into English
              // despite request language 'pl' (feedback f2c9f146, Elkomtech).
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                String(prelude.systemInstructionAddon || '') +
                languageInstruction,
            },
          } as any;
        }

        // Force-depth: revise the previous answer with NEW axes/contrarguments (no repetition, no defensiveness).
        if (forceDepthTrigger) {
          const lastAssistant = (pipelineRequest as any).messages
            .slice()
            .reverse()
            .find((m: any) => m.role === 'assistant' && String(m.content || '').trim().length > 0);

          const revisionInstruction = [
            '\n\n## FORCE DEPTH (user requested)',
            `Trigger: ${rawMsg}`,
            'Rules:',
            '- Do NOT be defensive. Assume the previous answer was insufficient.',
            '- Do NOT repeat the same structure or phrasing.',
            '- Add at least 2 NEW decision dimensions/axes.',
            '- Add at least 2 contrarguments / failure modes against your recommendation.',
            '- Strengthen trade-offs and assumptions/gaps.',
            '- Keep decision-grade format (6 sections).',
            '',
            lastAssistant
              ? `Previous answer to improve:\n---\n${String(lastAssistant.content).slice(0, 6000)}\n---`
              : '',
          ]
            .filter(Boolean)
            .join('\n');

          pipelineRequest = {
            ...pipelineRequest,
            options: {
              ...(pipelineRequest.options || {}),
              systemInstruction:
                String((pipelineRequest.options as any)?.systemInstruction || '') +
                revisionInstruction,
            },
            context: {
              ...((pipelineRequest as any).context || {}),
              deepThinkingDepth: 'hard',
              forceDepth: true,
              forceDepthTrigger: rawMsg,
            },
          } as any;
        }
      }

      // --------------------------------------------------------
      // Multi-Agent Decision Room routing
      // When multiAgent mode is ON, route through the Decision Room
      // instead of the standard pipeline for richer multi-perspective analysis.
      // --------------------------------------------------------
      if (aiModes?.multiAgent && message) {
        try {
          const { runDecisionRoom } = await import('../services/ai/advancedFeatures.js');
          emitSSE({
            type: 'status',
            message: 'Uruchamiam analizę wieloagentową (CFO, CTO, CHRO, COO)...',
          });

          const decisionResult = await runDecisionRoom(
            message,
            JSON.stringify({
              projectId,
              screenContext: screenContext?.currentScreen || screenContext?.screenId || null,
              history: (history || [])
                .slice(-4)
                .map((m: any) => `${m.role}: ${m.content?.slice(0, 200)}`)
                .join('\n'),
            }),
            ['Opcja A', 'Opcja B'], // Default options — the AI will refine these
            req.userId || 'anonymous',
            req.organizationId || 'default'
          );

          // Stream the multi-agent result as structured content
          const parts: string[] = [];
          if (decisionResult.perspectives && decisionResult.perspectives.length > 0) {
            for (const p of decisionResult.perspectives) {
              parts.push(
                `### ${p.agentRole}\n${p.analysis}\n**Rekomendacja:** ${p.recommendation}\n**Pewność:** ${p.confidenceLevel || 0}%\n`
              );
            }
          }
          if (decisionResult.consensus) {
            parts.push(
              `---\n## Konsensus\n**Rekomendacja:** ${decisionResult.consensus.recommendation}\n**Poziom pewności:** ${decisionResult.consensus.confidenceLevel || 0}%`
            );
            if (decisionResult.consensus.keyAgreements?.length > 0) {
              parts.push(`**Zgodność:** ${decisionResult.consensus.keyAgreements.join(', ')}`);
            }
          }
          const multiAgentContent = parts.join('\n');
          // Ensure the stream always returns a visible payload AND terminates.
          // Some frontends render `type: content` via onThinking, while others rely on `{ text }` chunks.
          accumulatedContent = multiAgentContent;
          emitSSE({ type: 'content', content: multiAgentContent });
          emitSSE({ type: 'done', content: multiAgentContent });
          emitSSE({ type: 'end' });
          if (isClientConnected && !res.destroyed) {
            try {
              // Also emit as a standard text chunk to keep SSE contract consistent.
              res.write(`data: ${JSON.stringify({ text: multiAgentContent })}\n\n`);
            } catch {
              /* ignore */
            }
            try {
              res.write('data: [DONE]\n\n');
            } catch {
              /* ignore */
            }
          }
          streamCompleted = true;
          clearInterval(heartbeatInterval);

          // Complete chat trace
          if (chatRunId) {
            try {
              const svcMod = await import('../services/ai/chatTraceService.js');
              await (svcMod.default || svcMod).completeRun({ runId: chatRunId as string });
            } catch {
              /* ignore */
            }
          }
          return res.end(); // Skip standard pipeline
        } catch (err) {
          logger.warn(
            '[AI Stream] Multi-agent mode failed, falling back to standard pipeline',
            err
          );
          emitSSE({
            type: 'status',
            message: 'Tryb wieloagentowy niedostępny — przechodzę do standardowej analizy...',
          });
          // Fall through to standard pipeline
        }
      }

      // Emit thought: generating response
      emitSSE({
        type: 'thought',
        step: 'generating',
        status: 'in_progress',
        label: 'Generating response based on gathered context…',
      });

      // SPEC_01 (Tryb A): enable the deliverable function-calling tool for the
      // standard Teresa chat. The model can call generate_deliverable to create
      // + open an artifact; the tool's onDeliverable emit becomes an SSE
      // `{type:'deliverable'}` event the FE consumes to mount the canvas panel.
      // Gated: flag ON + caller can generate + not a deep-research run.
      try {
        const generateRole = String(req.user?.role || req.userRole || 'VIEWER');
        const deliverableToolsEnabled =
          featureFlags.ENABLE_DELIVERABLES_LIGHT &&
          hasPresentationCapability(generateRole, 'presentation_create') &&
          !aiModes?.deepResearch;
        if (deliverableToolsEnabled) {
          (pipelineRequest as any).options = {
            ...((pipelineRequest as any).options || {}),
            deliverableTools: {
              enabled: true,
              context: {
                organizationId: req.organizationId,
                userId: req.userId,
                conversationId: conversationId || null,
                language: langCode,
                role: generateRole,
                onDeliverable: (payload: Record<string, unknown>) => {
                  // BUG2 — capture the artifact scope for the post-stream scorer;
                  // strip it from the client SSE (FE only needs id/kind/title).
                  const sc = payload?.scorerContent;
                  if (typeof sc === 'string' && sc.trim().length > 0) {
                    lastDeliverableScorerContent = sc.trim();
                  }
                  const { scorerContent: _omit, ...clientPayload } = payload;
                  emitSSE({ type: 'deliverable', ...clientPayload });
                },
              },
            },
          };
        }
      } catch (toolWireErr) {
        logger.warn(
          `[AI Stream] deliverable tool wiring skipped: ${String(
            (toolWireErr as Error)?.message || toolWireErr
          ).slice(0, 160)}`
        );
      }

      // Z4 transport (fala „Teresa steruje Ideą przez rejestr") — front dołącza
      // manifest akcji OTWARTEJ reprezentacji Idei w `context.ideaActionManifest`
      // (przepuszczalne pole `context`, więc bez zmian w walidatorze). Model widzi
      // je jako narzędzia; ich wywołanie NIE wykonuje się tu (serwer nie ma
      // dostępu do płótna w przeglądarce) — emitujemy SSE `idea_action`, a front
      // wykonuje je przez executeTeresaTool(). Registry jest default ON; jawne
      // OFF ignoruje manifest i uruchamia frontendowy legacy fallback.
      try {
        if (featureFlags.ENABLE_TERESA_IDEA_ACTIONS && !aiModes?.deepResearch) {
          const rawManifest = (context as any)?.ideaActionManifest;
          // Defensywne przyjęcie: tylko poprawne wpisy {name, description,
          // parameters:{type:'object'}}, twardy limit liczby narzędzi.
          const defs = Array.isArray(rawManifest)
            ? rawManifest
                .filter(
                  (t: any) =>
                    t &&
                    typeof t.name === 'string' &&
                    t.name.length > 0 &&
                    typeof t.description === 'string' &&
                    t.parameters &&
                    typeof t.parameters === 'object'
                )
                .slice(0, 40)
                .map((t: any) => ({
                  name: String(t.name),
                  description: String(t.description),
                  parameters:
                    t.parameters && typeof t.parameters === 'object'
                      ? t.parameters
                      : { type: 'object', properties: {} },
                }))
            : [];
          if (defs.length > 0) {
            (pipelineRequest as any).options = {
              ...((pipelineRequest as any).options || {}),
              ideaTools: {
                defs,
                context: {
                  onClientToolCall: (toolName: string, args: unknown) => {
                    // SSE do frontu — UnifiedChatPanel wykona akcję przez
                    // executeTeresaTool() na żywym płótnie. Nie twierdzimy tu, że
                    // akcja się wykonała; to potwierdzi (albo odrzuci) front.
                    emitSSE({ type: 'idea_action', toolName, args });
                  },
                },
              },
            };
            logger.info(`[AI Stream] idea-action manifest wired: ${defs.length} tools`);
          }
        }
      } catch (ideaWireErr) {
        logger.warn(
          `[AI Stream] idea-action tool wiring skipped: ${String(
            (ideaWireErr as Error)?.message || ideaWireErr
          ).slice(0, 160)}`
        );
      }

      const aiPipeline = await getAIPipeline();
      const response = await (aiPipeline as any).process(
        pipelineRequest,
        (progress: Record<string, unknown>) => {
          if (!isClientConnected || res.destroyed) return;

          res.write(
            `data: ${JSON.stringify({
              type: 'thought',
              ...progress,
            })}\n\n`
          );
        }
      );

      pipelineMeta = (response as any)?.metadata || null;
      if (chatRunId && pipelineMeta) {
        import('../services/ai/chatTraceService.js')
          .then((m: any) =>
            (m.default || m).addEvent(chatRunId, 'pipeline_metadata', {
              provider: pipelineMeta?.provider,
              model: pipelineMeta?.model,
              traceId: pipelineMeta?.traceId,
              latencyMs: pipelineMeta?.latency,
              hasRag: Boolean(pipelineMeta?.ragResults),
              hasMemory: Boolean(pipelineMeta?.memoryUsed),
            })
          )
          .catch(() => {
            /* ignore */
          });
      }

      // If pipeline failed before streaming starts, surface the error as SSE (instead of silently ending).
      // Otherwise the client sees "nothing" or a misleading EMPTY_STREAM.
      if ((response as any)?.success === false && (response as any)?.error) {
        const errObj = (response as any).error;
        const msg = String(errObj?.message || errObj?.error || 'AI request failed');
        const codeFromObj = typeof errObj?.code === 'string' ? errObj.code : undefined;
        const code =
          codeFromObj ||
          (/invalid_api_key|incorrect api key/i.test(msg)
            ? 'INVALID_API_KEY'
            : 'AI_PIPELINE_ERROR');

        if (chatRunId) {
          try {
            const svcMod = await import('../services/ai/chatTraceService.js');
            const chatTraceService = (svcMod.default || svcMod) as any;
            await chatTraceService.failRun({
              runId: chatRunId,
              code,
              message: msg,
              dtStates: dtStatesEmitted,
            });
          } catch {
            /* ignore */
          }
        }

        if (isClientConnected && !res.destroyed) {
          res.write(
            `data: ${JSON.stringify({
              error: msg,
              code,
            })}\n\n`
          );
          res.write('data: [DONE]\n\n');
        }
        if (
          aiModes?.deepResearch &&
          req.organizationId &&
          req.userId &&
          deepThinkingStartedLogged
        ) {
          try {
            const { logDeepThinkingEvent } =
              await import('../services/ai/deepThinkingMetricsService.js');
            await logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'pipeline_error', code, message: msg },
            });
          } catch {
            /* ignore */
          }
        }
        streamCompleted = true;
        return res.end();
      }

      if ((response as { stream?: AsyncIterable<string> }).stream) {
        let streamIterationError: Error | null = null;
        try {
          for await (const chunk of (
            response as { stream: AsyncIterable<string | { reasoning: string }> }
          ).stream) {
            if (!isClientConnected || res.destroyed || streamAborted) {
              logger.info(`[Stream] Aborting stream - client disconnected: ${streamSessionId}`);
              break;
            }

            // "Show reasoning" — the pipeline interleaves the model's native
            // reasoning deltas as tagged { reasoning } chunks. Emit them as a
            // SEPARATE SSE event so the frontend accumulates them into the
            // message's reasoning trace; visible answer text is untouched.
            if (chunk && typeof chunk === 'object' && typeof chunk.reasoning === 'string') {
              res.write(
                `data: ${JSON.stringify({ type: 'reasoning', delta: chunk.reasoning })}\n\n`
              );
              continue;
            }

            if (chunk) {
              accumulatedContent += chunk;
              res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);

              if (Date.now() - lastSaveTime > 2000) {
                savePartialResponse(
                  streamSessionId,
                  accumulatedContent,
                  req.userId!,
                  req.organizationId!
                ).catch((err: Error | null) =>
                  logger.warn('[Stream] Partial save failed:', (err as Error).message)
                );
                lastSaveTime = Date.now();
              }
            }
          }
        } catch (iterErr: any) {
          streamIterationError = iterErr;
          logger.error(`[Stream] Iterator error: ${iterErr?.message?.slice(0, 300)}`);
        }

        if (isClientConnected && !streamAborted) {
          // If the stream iterator threw (e.g. Gemini 429 rate limit), send a clear error.
          if (streamIterationError) {
            const errMsg = String(streamIterationError?.message || 'Stream failed');
            const isRateLimit = /quota|rate.limit|429|too many/i.test(errMsg);
            res.write(
              `data: ${JSON.stringify({
                error: isRateLimit
                  ? 'LLM rate limit exceeded. Please wait a moment or switch to a different model tier.'
                  : `AI stream error: ${errMsg.slice(0, 200)}`,
                code: isRateLimit ? 'RATE_LIMIT' : 'STREAM_ERROR',
              })}\n\n`
            );
          } else if (!accumulatedContent || accumulatedContent.trim().length === 0) {
            // If stream produced no content, surface an explicit error.
            // Without this, the frontend may see only [DONE] and appear "dead".
            res.write(
              `data: ${JSON.stringify({
                error: 'AI stream ended without output.',
                code: 'EMPTY_STREAM',
                sessionId: streamSessionId,
                provider: pipelineMeta?.provider || null,
                model: pipelineMeta?.model || null,
                traceId: pipelineMeta?.traceId || pipelineMeta?.trace_id || null,
              })}\n\n`
            );
          }

          // ================================================================
          // Deep Thinking Self-Check: 3-layer quality gate + auto-repair
          // ================================================================
          if (aiModes?.deepResearch && accumulatedContent && accumulatedContent.trim().length > 0) {
            try {
              const { scoreRubricV2, detectPatterns } =
                await import('../services/ai/deepThinkingEvaluationService.js');
              const { evaluatePassFail, buildRepairPrompt } =
                await import('../services/ai/deepThinkingSelfCheck.js');

              let currentText = accumulatedContent;
              let repairIterations = 0;
              const MAX_REPAIR_ITERATIONS = 2;
              let selfCheckVerdict: 'PASS' | 'FAIL' | 'BEST_EFFORT' = 'FAIL';

              for (let iter = 0; iter <= MAX_REPAIR_ITERATIONS; iter++) {
                const rubric = scoreRubricV2(currentText, language);
                const patterns = detectPatterns(currentText, language);
                const { pass, failReasons } = evaluatePassFail({
                  rubric,
                  negativePatterns: patterns.negative,
                });

                if (pass) {
                  selfCheckVerdict = 'PASS';
                  break;
                }

                // If this was the last allowed check (after max repairs), mark as best effort
                if (iter === MAX_REPAIR_ITERATIONS) {
                  selfCheckVerdict = 'BEST_EFFORT';
                  logger.info(
                    `[DeepThinking SelfCheck] Best effort after ${repairIterations} repair(s). ` +
                      `Fail reasons: ${failReasons.join(', ')}`
                  );
                  break;
                }

                // Auto-repair: N-tag driven, replace (not append)
                repairIterations++;

                // Emit generic "Refining analysis…" — no specific details
                emitSSE({
                  type: 'dt_selfcheck',
                  status: 'repairing',
                  iteration: repairIterations,
                  label: 'Refining analysis…',
                });

                try {
                  const { modelRouter } = await import('../services/ai/modelRouter.js');
                  const { llmService } = await import('../services/ai/llmService.js');
                  const tier = (selectedTier || 'STANDARD') as any;
                  const modelCfg = selectedModelId
                    ? await modelRouter.getProviderConfig(selectedModelId, tier)
                    : await modelRouter.select({
                        capability: 'report_section',
                        tier,
                        organizationId: req.organizationId!,
                        options: { tier },
                      } as any);

                  const repairSys = buildRepairPrompt(
                    currentText,
                    patterns.negative,
                    failReasons,
                    repairIterations
                  );

                  const fixed = (await llmService.callText({
                    type: 'chat',
                    modelConfig: {
                      provider: modelCfg.provider,
                      id: modelCfg.id,
                      endpoint: (modelCfg as any).endpoint,
                      apiKey: (modelCfg as any).apiKey,
                    },
                    systemPrompt: repairSys,
                    messages: [
                      {
                        role: 'user',
                        content: currentText,
                      },
                    ],
                  } as any)) as any;

                  const fixedText = String(fixed?.content || '').trim();
                  if (fixedText.length > 0) {
                    // Replace strategy: send dt_repair_replace event, then stream new content
                    currentText = fixedText;

                    emitSSE({
                      type: 'dt_repair_replace',
                      text: fixedText,
                    });
                  }
                } catch (repairErr: any) {
                  logger.warn(
                    `[DeepThinking SelfCheck] Repair iteration ${repairIterations} failed:`,
                    repairErr?.message || repairErr
                  );
                  selfCheckVerdict = 'BEST_EFFORT';
                  break;
                }
              }

              // Update accumulated content with final (possibly repaired) text
              accumulatedContent = currentText;

              // Emit self-check result
              emitSSE({
                type: 'dt_selfcheck',
                status: selfCheckVerdict === 'PASS' ? 'passed' : 'best_effort',
                label:
                  selfCheckVerdict === 'PASS'
                    ? 'Deep Thinking check passed'
                    : 'Analysis complete (best effort)',
                repairIterations,
              });
            } catch (err: any) {
              logger.warn('[DeepThinking SelfCheck] Failed:', err?.message || err);
            }
          }

          // Hoisted so it's accessible in both deep-thinking metrics and agent-audit scopes
          let forceDepthDiff: any = null;

          // Deep Thinking ops metric: completed run (evaluate final output; do not reward length)
          if (
            aiModes?.deepResearch &&
            req.organizationId &&
            req.userId &&
            deepThinkingStartedLogged
          ) {
            try {
              const { validateDeepThinkingDoD } =
                await import('../services/ai/deepThinkingQuality.js');
              const { detectPatterns, scoreRubricV2 } =
                await import('../services/ai/deepThinkingEvaluationService.js');
              const { logDeepThinkingEvent } =
                await import('../services/ai/deepThinkingMetricsService.js');

              const dodFinal = validateDeepThinkingDoD(accumulatedContent, language);
              const rubricFinal = scoreRubricV2(accumulatedContent, language);
              const patternsFinal = detectPatterns(accumulatedContent, language);

              // Force-depth diff check: if this was a force-depth request, compare with previous answer
              if (forceDepthTrigger || (context as any)?.forceDepth) {
                try {
                  const { evaluateForceDepthDiff } =
                    await import('../services/ai/deepThinkingSelfCheck.js');

                  // Find the last assistant message from history (the answer being challenged)
                  const lastAssistant = (pipelineRequest as any).messages
                    ?.slice()
                    .reverse()
                    .find(
                      (m: any) =>
                        m.role === 'assistant' && String(m.content || '').trim().length > 0
                    );

                  if (lastAssistant) {
                    const beforeText = String(lastAssistant.content || '').trim();
                    const beforeRubric = scoreRubricV2(beforeText, language);
                    forceDepthDiff = evaluateForceDepthDiff(
                      beforeText,
                      accumulatedContent,
                      beforeRubric,
                      rubricFinal
                    );

                    if (!forceDepthDiff.isSubstantiallyDifferent) {
                      logger.warn(
                        `[DeepThinking] Force-depth FAIL: response too similar. ` +
                          `Jaccard=${forceDepthDiff.jaccardSimilarity}, delta=${forceDepthDiff.rubricDelta}`
                      );
                      // Emit explicit quality FAIL signal to frontend (non-blocking, but must be visible).
                      emitSSE({
                        type: 'dt_selfcheck',
                        status: 'failed',
                        label:
                          'Directed deepening failed: output is too similar (insufficient depth).',
                        forceDepthDiff,
                      });
                    }
                  }
                } catch (fdErr: any) {
                  logger.warn('[DeepThinking] Force-depth diff failed:', fdErr?.message);
                }
              }

              // B1: Process State Integrity (diagnostic, non-blocking)
              let processStateLog: any = null;
              try {
                const { checkProcessStateIntegrity } =
                  await import('../services/ai/deepThinkingSelfCheck.js');
                processStateLog = checkProcessStateIntegrity(dtStatesEmitted);
              } catch {
                /* ignore */
              }

              await logDeepThinkingEvent({
                organizationId: req.organizationId!,
                userId: req.userId!,
                sessionId: streamSessionId,
                conversationId: conversationId || null,
                eventType: 'run_completed',
                payload: {
                  dod: dodFinal,
                  rubric: rubricFinal,
                  negativePatterns: patternsFinal.negative,
                  positivePatterns: patternsFinal.positive,
                  optionsCount: (patternsFinal.diagnostics as any)?.optionsCount ?? null,
                  deepThinkingDepth: (context as any)?.deepThinkingDepth || null,
                  webSearch: Boolean(aiModes?.webSearch),
                  forceDepth: Boolean(forceDepthTrigger || (context as any)?.forceDepth),
                  forceDepthDiff,
                  processStateIntegrity: processStateLog,
                },
              });
            } catch (err: any) {
              logger.warn(
                '[DeepThinkingMetrics] Failed to log completed run:',
                err?.message || err
              );
            }
          }

          // ================================================================
          // Agent Audit Layer (Post-DT) — optional, streamed transparency
          // ================================================================
          try {
            const agentAudit = (context as any)?.agentAudit || null;
            const agentIds = Array.isArray(agentAudit?.agentIds)
              ? agentAudit.agentIds.map((x: any) => String(x || '').trim()).filter(Boolean)
              : [];
            const decisionContext = agentAudit?.decisionContext || null;

            if (
              aiModes?.deepResearch &&
              req.organizationId &&
              req.userId &&
              decisionContext &&
              agentIds.length > 0
            ) {
              emitSSE({
                type: 'agent_audit_state',
                state: 'reviewing',
                agentsTotal: agentIds.length,
              });

              const { runAgentAudit } =
                await import('../services/ai/agentAudit/orchestratorService.js');
              const { createAgentAuditRun } =
                await import('../services/ai/agentAudit/agentAuditStore.js');

              const auditOut = await runAgentAudit({
                organizationId: req.organizationId!,
                userId: req.userId!,
                conversationId: conversationId || null,
                decisionContext,
                deepThinkingReport: accumulatedContent,
                forceDepthDiff: forceDepthDiff ?? null,
                agentIds,
                userIntent: agentAudit?.userIntent || 'validate',
                language,
                webSearchEnabled: Boolean(aiModes?.webSearch),
                selectedTier,
                selectedModelId,
                loopIteration: agentAudit?.loopIteration || 1,
                emit: emitSSE,
              } as any);

              // Persist run (best-effort)
              try {
                await createAgentAuditRun({
                  id: auditOut.orchestratorRunId,
                  organizationId: req.organizationId!,
                  userId: req.userId!,
                  conversationId: conversationId || null,
                  dtSessionId: streamSessionId,
                  userIntent: String(agentAudit?.userIntent || 'validate'),
                  loopIteration: Number(agentAudit?.loopIteration || 1),
                  decisionContext: decisionContext || null,
                  selectedAgentIds: agentIds,
                  verdict: auditOut.verdict || null,
                  reviews: (auditOut.reviews || []).map((r: any) => ({
                    agentId: String(r.agentId || ''),
                    overreach: r.overreach || null,
                    review: r,
                  })),
                } as any);
              } catch {
                /* ignore */
              }

              emitSSE({
                type: 'agent_audit_verdict',
                orchestratorRunId: auditOut.orchestratorRunId,
                verdict: auditOut.verdict,
                reviews: auditOut.reviews,
                decisionContext,
                agentIds,
                userIntent: agentAudit?.userIntent || 'validate',
                loopIteration: agentAudit?.loopIteration || 1,
              });
            }
          } catch (auditErr: any) {
            emitSSE({
              type: 'agent_audit_state',
              state: 'error',
              error: String(auditErr?.message || auditErr || ''),
            });
          }

          // ================================================================
          // Post-stream: Quality scoring (best-effort, non-blocking)
          // ================================================================
          // BUG2 — score the ARTIFACT scope when a deliverable fired. Without this
          // the scorer sees only the thin "Utworzyłem dokument…" confirmation and
          // systematically under-rates mece/actionability despite good content.
          const scorerResponse =
            lastDeliverableScorerContent && lastDeliverableScorerContent.trim().length > 0
              ? lastDeliverableScorerContent
              : accumulatedContent;
          if (scorerResponse && scorerResponse.trim().length > 0) {
            try {
              const qcMod = await import('../services/ai/qualityChecker.js');
              const qc = (qcMod as any).qualityChecker || (qcMod as any).default;
              if (qc?.check) {
                // Pass tier info for LLM-as-Judge (R14)
                const selectedTier = (pipelineRequest as any)?.options?.selectedTier || 'STANDARD';
                const qualityScore = await qc.check({
                  question: message,
                  response: scorerResponse,
                  conversationId: conversationId || undefined,
                  messageId: chatRunId || undefined,
                  userId: req.userId,
                  organizationId: req.organizationId,
                  tier: selectedTier,
                });
                if (qualityScore && typeof qualityScore.overall === 'number') {
                  emitSSE({ type: 'quality_score', ...qualityScore });
                }
              }
            } catch (qErr: any) {
              logger.debug('[AI Stream] Quality scoring failed:', qErr?.message);
            }

            // ================================================================
            // Post-stream: Knowledge Graph extraction (R8, best-effort)
            // ================================================================
            try {
              if (req.organizationId && accumulatedContent.length > 100) {
                const kgMod = await import('../services/ai/knowledgeGraphService.js');
                const kgService = (kgMod as any).knowledgeGraphService || (kgMod as any).default;
                if (kgService?.processConversation) {
                  // Fire and forget — don't block the stream
                  kgService
                    .processConversation(req.organizationId, message, accumulatedContent)
                    .catch((err: unknown) =>
                      logger.warn('[AI] knowledge graph processing failed', err)
                    );
                }
              }
            } catch {
              // Non-critical
            }

            // ================================================================
            // Post-stream: User memory write-back (A0 — close the memory loop)
            // Previously `updateUserMemoryAfterInteraction` had ZERO runtime callers.
            // Now every chat turn increments interaction_count + total_messages.
            // ================================================================
            try {
              if (req.userId) {
                const memMod = await import('../services/ai/aiMemoryService.js');
                const memSvc = (memMod as any).default || memMod;
                if (memSvc?.updateUserMemoryAfterInteraction) {
                  // Extract a rough topic from the user message (first 50 chars)
                  const roughTopic =
                    typeof message === 'string'
                      ? message.slice(0, 50).replace(/\n/g, ' ').trim() || undefined
                      : undefined;
                  memSvc
                    .updateUserMemoryAfterInteraction(req.userId, roughTopic, 1)
                    .catch((err: unknown) =>
                      logger.debug('[AI] user memory write-back failed (non-critical)', err)
                    );
                }
              }
            } catch {
              // Non-critical — don't break the stream for memory
            }

            // ================================================================
            // Post-stream: Citation extraction (best-effort, non-blocking)
            // ================================================================
            try {
              const ceMod = await import('../services/ai/citationExtractor.js');
              const ce = (ceMod as any).citationExtractor || (ceMod as any).default;
              if (ce?.extract) {
                // Gather knowledge sources from context (if any RAG chunks were used)
                const ragChunks =
                  ((pipelineRequest as any).context?.external?.attachmentsRag?.chunks as any[]) ||
                  [];
                const citationResult = ce.extract(accumulatedContent, [], ragChunks);
                if (citationResult?.citations?.length > 0) {
                  emitSSE({
                    type: 'citations',
                    citations: citationResult.citations.map((c: any) => ({
                      id: c.id,
                      type: c.sourceType || 'document',
                      title: c.sourceTitle || '',
                      reference: c.sourceUrl || c.sourceId || '',
                      link: c.sourceUrl || '',
                      // M01-P04B fix: `c.text` is the marker text ("[1]"), not the
                      // real source excerpt — was showing the marker as the preview.
                      excerpt: c.fragmentExcerpt || c.text || '',
                      confidence: c.confidence,
                      // GF-CHAT-02 fragment anchor: real chunk ordinal from
                      // knowledge_chunks.chunk_index, `null` (never `0`) when unknown.
                      fragmentIndex: typeof c.fragmentIndex === 'number' ? c.fragmentIndex : null,
                    })),
                  });
                }
              }
            } catch (cErr: any) {
              logger.debug('[AI Stream] Citation extraction failed:', cErr?.message);
            }

            // ================================================================
            // Post-stream: Source ledger (P34-B)
            // Provide a stable, non-leaky "used vs blocked" ledger for the UI/audit.
            // ================================================================
            try {
              const rawCitations = Array.isArray(collectedCitations) ? collectedCitations : [];
              const used_sources = (() => {
                const out: any[] = [];
                const seen = new Set<string>();
                for (let i = 0; i < rawCitations.length; i += 1) {
                  const c: any = rawCitations[i];
                  if (!c) continue;
                  const id = String(c?.id || '').trim();
                  const type = String(c?.type || 'document').trim() || 'document';
                  const title = String(c?.title || '').trim();
                  const reference = String(c?.reference || c?.url || '').trim();
                  const link = String(c?.link || '').trim();
                  const key = `${type}:${id || reference || link || title}`.slice(0, 220);
                  if (!key || seen.has(key)) continue;
                  seen.add(key);
                  out.push({
                    id: id || null,
                    type,
                    title: title || null,
                    reference: reference || null,
                    link: link || null,
                  });
                  if (out.length >= 24) break;
                }
                return out;
              })();

              const blocked_sources = (() => {
                const out: any[] = [];
                const add = (category: string, reason: string) =>
                  out.push({ category, reason, detail: null });

                // Never enumerate forbidden objects; only high-level categories.
                add('cross_tenant', 'forbidden_by_policy');
                add('other_user_private', 'forbidden_by_policy');

                if (privateMode === true) {
                  add('org_shared', 'private_mode_enabled');
                }

                if (knowledgeSources && typeof knowledgeSources === 'object') {
                  if ((knowledgeSources as any).pmoDocuments === false)
                    add('pmo_documents', 'disabled_by_user');
                  if ((knowledgeSources as any).projectData === false)
                    add('project_data', 'disabled_by_user');
                  if ((knowledgeSources as any).organizationData === false)
                    add('organization_data', 'disabled_by_user');
                }

                return out.slice(0, 16);
              })();

              const degraded =
                used_sources.length === 0
                  ? { mode: 'no_sources', reason: 'no_citations_collected' }
                  : null;

              sourceLedgerSnapshot = {
                type: 'source_ledger',
                decisionId: policyDecision?.id || null,
                used_sources,
                blocked_sources,
                degraded,
                scope_resolution: {
                  privateMode: Boolean(privateMode),
                  knowledgeSources: knowledgeSources || {},
                },
              };
              emitSSE(sourceLedgerSnapshot);

              if (req.organizationId && req.userId) {
                try {
                  const wave6 = await import('../services/wave6ContextLearningService.js');
                  if (!privateMode && assistantScope === 'teresa_tenant') {
                    for (const source of used_sources.slice(0, 12)) {
                      await wave6.recordWave6ContextLedgerEntry({
                        organizationId: req.organizationId,
                        userId: req.userId,
                        projectId,
                        sourceType: String(source.type || 'citation'),
                        sourceId: source.id || source.reference || null,
                        sourceTitle: source.title || source.reference || null,
                        sourceUrl: source.link || source.reference || null,
                        freshnessAt: new Date().toISOString(),
                        permissionScope: projectId
                          ? 'project'
                          : wave6MemoryScope === 'org'
                            ? 'org'
                            : 'tenant',
                      });
                    }
                  }
                  const memoryRequest = wave6.extractWave6MemoryRequest(String(message || ''));
                  if (memoryRequest) {
                    const memoryCandidate = await wave6.captureWave6MemoryCandidate({
                      organizationId: req.organizationId,
                      userId: req.userId,
                      assistantScope,
                      memoryScope: wave6MemoryScope,
                      key: memoryRequest.key,
                      value: memoryRequest.value,
                      projectId,
                      sourceLabel: 'chat_user_request',
                      sourceRefs: [
                        {
                          sourceType: 'conversation',
                          sourceId: conversationId || streamSessionId,
                        },
                      ],
                      privateMode: Boolean(privateMode),
                      retentionDays: 180,
                    });
                    emitSSE({
                      type: 'memory_candidate',
                      wave: 6,
                      blocked: Boolean(memoryCandidate.blocked),
                      reason: memoryCandidate.reason || null,
                      candidate: memoryCandidate.candidate || null,
                    });
                  }
                } catch (wave6Err: any) {
                  logger.warn(
                    '[AI Stream] Wave 6 context ledger/stewardship skipped:',
                    wave6Err?.message || wave6Err
                  );
                }
              }

              if (chatRunId) {
                import('../services/ai/chatTraceService.js')
                  .then((m: any) =>
                    (m.default || m).addEvent(chatRunId, 'source_ledger', {
                      used_sources_count: used_sources.length,
                      blocked_sources_count: blocked_sources.length,
                      degraded,
                      scope_resolution: {
                        privateMode: Boolean(privateMode),
                        knowledgeSources: knowledgeSources || {},
                      },
                    })
                  )
                  .catch(() => {
                    /* ignore */
                  });
              }

              // Honest degraded path: if evidence is required but we have no sources, make it explicit.
              if (
                degraded &&
                policyDecision?.allowed === true &&
                policyDecision?.evidence?.required === true &&
                !hasGovernedGrounding &&
                !shouldPreferGovernedProductKnowledge
              ) {
                const isPl = Boolean(language?.startsWith('pl'));
                emitSSE({
                  type: 'policy_notice',
                  kind: 'no_sources',
                  decisionId: policyDecision?.id || null,
                  displayToUser: false,
                  message: isPl
                    ? 'Brak źródeł w dozwolonym zakresie — zapisano diagnostykę do audytu.'
                    : 'No sources in allowed scope — audit diagnostic recorded.',
                });
              }
            } catch {
              // Non-critical — never break the stream on ledger generation.
            }

            // ================================================================
            // Post-stream: Policy evidence enforcement (P34-B)
            // If response is factful and we lack citations, append explicit uncertainty marker.
            // ================================================================
            if (
              policyDecision?.allowed === true &&
              policyDecision?.evidence?.required === true &&
              policyDecision?.evidence?.uncertaintyMarkerRequiredIfInsufficientEvidence === true
            ) {
              try {
                const cvMod = await import('../services/ai/claimCitationValidator.js');
                const extractClaims = (cvMod as any).extractClaims;
                const matchClaimsToCitations = (cvMod as any).matchClaimsToCitations;
                const validateClaimCitations = (cvMod as any).validateClaimCitations;

                if (
                  typeof extractClaims === 'function' &&
                  typeof matchClaimsToCitations === 'function' &&
                  typeof validateClaimCitations === 'function'
                ) {
                  const citationsForValidator = (
                    Array.isArray(collectedCitations) ? collectedCitations : []
                  )
                    .slice(0, 24)
                    .map((c: any, idx: number) => ({
                      id: String(c?.id || `cit_${idx}`),
                      excerpt: typeof c?.excerpt === 'string' ? String(c.excerpt) : undefined,
                      startOffset: typeof c?.startOffset === 'number' ? c.startOffset : undefined,
                      endOffset: typeof c?.endOffset === 'number' ? c.endOffset : undefined,
                    }));

                  const baseClaims = extractClaims(String(accumulatedContent || ''));
                  const matchedClaims = matchClaimsToCitations(
                    baseClaims,
                    citationsForValidator,
                    String(accumulatedContent || '')
                  );
                  const policy = policyDecision?.evidence?.claimCitationPolicy || {};
                  const validation = validateClaimCitations(matchedClaims, policy);
                  // M01-P04B (GF-CHAT-08): capture for emitTrustBundle (see decl above).
                  claimCoverageResult = validation
                    ? {
                        totalClaims: validation.totalClaims,
                        citedClaims: validation.citedClaims,
                        uncitedClaims: validation.uncitedClaims,
                        coverageScore: validation.coverageScore,
                        passesPolicy: validation.passesPolicy,
                      }
                    : null;

                  emitSSE({
                    type: 'policy_validation',
                    decisionId: policyDecision?.id || null,
                    validation: {
                      totalClaims: validation?.totalClaims,
                      citedClaims: validation?.citedClaims,
                      uncitedClaims: validation?.uncitedClaims,
                      coverageScore: validation?.coverageScore,
                      passesPolicy: validation?.passesPolicy,
                      policyViolations: validation?.policyViolations,
                    },
                  });

                  if (
                    validation &&
                    validation.passesPolicy === false &&
                    !hasGovernedGrounding &&
                    !shouldPreferGovernedProductKnowledge
                  ) {
                    const isPl = Boolean(language?.startsWith('pl'));
                    const violations = Array.isArray(validation.policyViolations)
                      ? validation.policyViolations
                      : [];

                    emitSSE({
                      type: 'policy_notice',
                      kind: 'uncertainty',
                      decisionId: policyDecision?.id || null,
                      displayToUser: false,
                      message: isPl
                        ? 'Brak wystarczających cytowań — zapisano diagnostykę do audytu.'
                        : 'Insufficient citations — audit diagnostic recorded.',
                      violations: violations.slice(0, 6),
                    });

                    if (chatRunId) {
                      import('../services/ai/chatTraceService.js')
                        .then((m: any) =>
                          (m.default || m).addEvent(chatRunId, 'policy_evidence', {
                            passesPolicy: false,
                            policyViolations: violations,
                            totalClaims: validation?.totalClaims,
                            citedClaims: validation?.citedClaims,
                            uncitedClaims: validation?.uncitedClaims,
                            coverageScore: validation?.coverageScore,
                          })
                        )
                        .catch(() => {
                          /* ignore */
                        });
                    }
                  } else if (chatRunId) {
                    import('../services/ai/chatTraceService.js')
                      .then((m: any) =>
                        (m.default || m).addEvent(chatRunId, 'policy_evidence', {
                          passesPolicy: true,
                          totalClaims: validation?.totalClaims,
                          citedClaims: validation?.citedClaims,
                          uncitedClaims: validation?.uncitedClaims,
                          coverageScore: validation?.coverageScore,
                        })
                      )
                      .catch(() => {
                        /* ignore */
                      });
                  }
                }
              } catch (evErr: any) {
                logger.debug('[AI Stream] Policy evidence enforcement skipped:', evErr?.message);
              }
            }

            // ================================================================
            // Post-stream: Cost monitoring (best-effort, non-blocking)
            // ================================================================
            try {
              const costMod = await import('../services/ai/cost-monitoring.service.js');
              const costSvc = (costMod as any).aiCostMonitoring || (costMod as any).default;
              if (costSvc?.recordUsage) {
                const estimatedInput = Math.max(10, Math.ceil((message?.length || 0) / 4));
                const estimatedOutput = Math.max(
                  10,
                  Math.ceil((accumulatedContent?.length || 0) / 4)
                );
                // Use actual token counts from pipeline metadata when available
                const inputTokens = (pipelineMeta as any)?.inputTokens || estimatedInput;
                const outputTokens = (pipelineMeta as any)?.outputTokens || estimatedOutput;
                costSvc.recordUsage(
                  req.userId!,
                  req.organizationId!,
                  (selectedTier || 'STANDARD') as any,
                  pipelineMeta?.provider || 'unknown',
                  pipelineMeta?.model || 'unknown',
                  {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                  }
                );
              }
            } catch (costErr: any) {
              logger.debug('[AI Stream] Cost monitoring failed:', costErr?.message);
            }
          }

          await maybeEmitTeresaProposal(accumulatedContent);
          // HP-15: citationVerifier w RUNTIME (nie tylko offline eval) — oznacz, nie blokuj.
          runtimeCitationVerification = await verifyRuntimeCitations(collectedCitations, {
            conversationId,
            messageId: chatRunId,
            surface: 'chat_stream',
            // M01-006: lets the verifier flag a citation whose sourceId
            // belongs to a different organization as 'no_access' instead of
            // 'verified' — see citationVerifier.ts#checkAccess.
            organizationId: req.organizationId,
          });
          // M01-P04B (GF-CHAT-08): stream a status-only delta for citations already
          // sent to the client. `buildCitationStatusPayload` only ever emits
          // {id, status} — no title/excerpt/url can leak through it, even for a
          // citation the verifier just marked 'broken' (failed) or unresolved
          // (stale). `useAIStream`'s `mergeCitations` merges by `id` and keeps
          // newer fields, so this updates the existing citation entries in place
          // without touching `useAIStream.ts`/`UnifiedChatPanel.tsx` (owned by
          // lane A / P04A — out of scope here).
          const citationStatusDelta = buildCitationStatusPayload(runtimeCitationVerification);
          if (citationStatusDelta.length > 0) {
            emitSSE({ type: 'citations', citations: citationStatusDelta });
          }
          emitTrustBundle(accumulatedContent);

          streamCompleted = true;
          res.write('data: [DONE]\n\n');

          if (chatRunId) {
            try {
              const svcMod = await import('../services/ai/chatTraceService.js');
              const chatTraceService = (svcMod.default || svcMod) as any;
              await chatTraceService.completeRun({
                runId: chatRunId,
                status: streamAborted ? 'aborted' : 'completed',
                pipelineTraceId: pipelineMeta?.traceId || null,
                modelProvider: pipelineMeta?.provider || null,
                modelId: pipelineMeta?.model || null,
                tier: selectedTier || null,
                latencyMs: typeof pipelineMeta?.latency === 'number' ? pipelineMeta.latency : null,
                outputText: accumulatedContent,
                dtStates: dtStatesEmitted,
              });
            } catch {
              /* ignore */
            }
          }

          await dbRun(
            `DELETE FROM ai_partial_responses
             WHERE session_id = ? AND user_id = ? AND organization_id = ?`,
            [streamSessionId, req.userId, req.organizationId]
          );

          // Track token usage for trial budget (rough estimate based on chars)
          try {
            const estimatedTokens = Math.max(
              50,
              Math.ceil(((message?.length || 0) + (accumulatedContent?.length || 0)) / 4)
            );
            if (aiAccessContext?.isTrial && !aiAccessContext?.isPaid) {
              await AccessPolicyService.trackTokenUsage(req.organizationId!, estimatedTokens);
            }
          } catch (usageErr: any) {
            logger.warn(
              '[AI Stream] Failed to track trial token usage:',
              usageErr?.message || usageErr
            );
          }
        }
        return res.end();
      } else {
        if (isClientConnected && !res.destroyed) {
          const nonStreamContent = String((response as { content?: string }).content || '');
          res.write(`data: ${JSON.stringify({ text: nonStreamContent })}\n\n`);

          // Post-response: quality scoring + citations + cost monitoring (same as streaming branch)
          if (nonStreamContent.trim().length > 0) {
            try {
              const qcMod = await import('../services/ai/qualityChecker.js');
              const qc = (qcMod as any).qualityChecker || (qcMod as any).default;
              if (qc?.check) {
                const qs = await qc.check({
                  question: message,
                  response: nonStreamContent,
                  conversationId: conversationId || undefined,
                  userId: req.userId,
                  organizationId: req.organizationId,
                });
                if (qs && typeof qs.overall === 'number') emitSSE({ type: 'quality_score', ...qs });
              }
            } catch {
              /* ignore */
            }

            try {
              const ceMod = await import('../services/ai/citationExtractor.js');
              const ce = (ceMod as any).citationExtractor || (ceMod as any).default;
              if (ce?.extract) {
                const cr = ce.extract(nonStreamContent, [], []);
                if (cr?.citations?.length > 0) {
                  emitSSE({
                    type: 'citations',
                    citations: cr.citations.map((c: any) => ({
                      id: c.id,
                      type: c.sourceType || 'document',
                      title: c.sourceTitle || '',
                      reference: c.sourceUrl || c.sourceId || '',
                      link: c.sourceUrl || '',
                      excerpt: c.fragmentExcerpt || c.text || '',
                      confidence: c.confidence,
                      fragmentIndex: typeof c.fragmentIndex === 'number' ? c.fragmentIndex : null,
                    })),
                  });
                }
              }
            } catch {
              /* ignore */
            }

            // Policy evidence enforcement (P34-B) for non-stream response
            if (
              policyDecision?.allowed === true &&
              policyDecision?.evidence?.required === true &&
              policyDecision?.evidence?.uncertaintyMarkerRequiredIfInsufficientEvidence === true
            ) {
              try {
                const cvMod = await import('../services/ai/claimCitationValidator.js');
                const extractClaims = (cvMod as any).extractClaims;
                const matchClaimsToCitations = (cvMod as any).matchClaimsToCitations;
                const validateClaimCitations = (cvMod as any).validateClaimCitations;

                if (
                  typeof extractClaims === 'function' &&
                  typeof matchClaimsToCitations === 'function' &&
                  typeof validateClaimCitations === 'function'
                ) {
                  const citationsForValidator = (
                    Array.isArray(collectedCitations) ? collectedCitations : []
                  )
                    .slice(0, 24)
                    .map((c: any, idx: number) => ({
                      id: String(c?.id || `cit_${idx}`),
                      excerpt: typeof c?.excerpt === 'string' ? String(c.excerpt) : undefined,
                    }));

                  const baseClaims = extractClaims(String(nonStreamContent || ''));
                  const matchedClaims = matchClaimsToCitations(
                    baseClaims,
                    citationsForValidator,
                    String(nonStreamContent || '')
                  );
                  const policy = policyDecision?.evidence?.claimCitationPolicy || {};
                  const validation = validateClaimCitations(matchedClaims, policy);
                  // M01-P04B (GF-CHAT-08): capture for emitTrustBundle (see decl above).
                  claimCoverageResult = validation
                    ? {
                        totalClaims: validation.totalClaims,
                        citedClaims: validation.citedClaims,
                        uncitedClaims: validation.uncitedClaims,
                        coverageScore: validation.coverageScore,
                        passesPolicy: validation.passesPolicy,
                      }
                    : null;

                  emitSSE({
                    type: 'policy_validation',
                    decisionId: policyDecision?.id || null,
                    validation: {
                      totalClaims: validation?.totalClaims,
                      citedClaims: validation?.citedClaims,
                      uncitedClaims: validation?.uncitedClaims,
                      coverageScore: validation?.coverageScore,
                      passesPolicy: validation?.passesPolicy,
                      policyViolations: validation?.policyViolations,
                    },
                  });

                  if (
                    validation &&
                    validation.passesPolicy === false &&
                    !hasGovernedGrounding &&
                    !shouldPreferGovernedProductKnowledge
                  ) {
                    const isPl = Boolean(language?.startsWith('pl'));

                    emitSSE({
                      type: 'policy_notice',
                      kind: 'uncertainty',
                      decisionId: policyDecision?.id || null,
                      displayToUser: false,
                      message: isPl
                        ? 'Brak wystarczających cytowań — zapisano diagnostykę do audytu.'
                        : 'Insufficient citations — audit diagnostic recorded.',
                      violations: (validation?.policyViolations || []).slice(0, 6),
                    });
                  }
                }
              } catch {
                /* ignore */
              }
            }

            try {
              const costMod = await import('../services/ai/cost-monitoring.service.js');
              const costSvc = (costMod as any).aiCostMonitoring || (costMod as any).default;
              if (costSvc?.recordUsage) {
                const ei = Math.max(10, Math.ceil((message?.length || 0) / 4));
                const eo = Math.max(10, Math.ceil((nonStreamContent?.length || 0) / 4));
                const it = (pipelineMeta as any)?.inputTokens || ei;
                const ot = (pipelineMeta as any)?.outputTokens || eo;
                costSvc.recordUsage(
                  req.userId!,
                  req.organizationId!,
                  (selectedTier || 'STANDARD') as any,
                  pipelineMeta?.provider || 'unknown',
                  pipelineMeta?.model || 'unknown',
                  { inputTokens: it, outputTokens: ot, totalTokens: it + ot }
                );
              }
            } catch {
              /* ignore */
            }

            await maybeEmitTeresaProposal(nonStreamContent);
            // HP-15: citationVerifier w RUNTIME (nie tylko offline eval) — oznacz, nie blokuj.
            runtimeCitationVerification = await verifyRuntimeCitations(collectedCitations, {
              conversationId,
              messageId: chatRunId,
              surface: 'chat_nonstream',
              // M01-006: see rationale on the streaming branch above.
              organizationId: req.organizationId,
            });
            // M01-P04B (GF-CHAT-08) — see streaming branch above for rationale.
            const citationStatusDeltaNonStream = buildCitationStatusPayload(
              runtimeCitationVerification
            );
            if (citationStatusDeltaNonStream.length > 0) {
              emitSSE({ type: 'citations', citations: citationStatusDeltaNonStream });
            }
            emitTrustBundle(nonStreamContent);
          }

          streamCompleted = true;
          res.write('data: [DONE]\n\n');

          if (chatRunId) {
            try {
              const svcMod = await import('../services/ai/chatTraceService.js');
              const chatTraceService = (svcMod.default || svcMod) as any;
              await chatTraceService.completeRun({
                runId: chatRunId,
                status: 'completed',
                pipelineTraceId: pipelineMeta?.traceId || null,
                modelProvider: pipelineMeta?.provider || null,
                modelId: pipelineMeta?.model || null,
                tier: selectedTier || null,
                latencyMs: typeof pipelineMeta?.latency === 'number' ? pipelineMeta.latency : null,
                outputText: nonStreamContent,
                dtStates: dtStatesEmitted,
              });
            } catch {
              /* ignore */
            }
          }
        }
        return res.end();
      }
    } catch (err: any) {
      logger.error('Stream Error:', err);

      if (accumulatedContent.length > 0) {
        savePartialResponse(
          streamSessionId,
          accumulatedContent,
          req.userId!,
          req.organizationId!
        ).catch((e) =>
          logger.warn('[Stream] Failed to save partial on error:', (e as Error).message)
        );
      }

      if (isClientConnected && !res.destroyed) {
        const msg = (err as Error)?.message || String(err);
        const code = /invalid_api_key|incorrect api key/i.test(msg)
          ? 'INVALID_API_KEY'
          : 'AI_STREAM_ERROR';

        if (chatRunId) {
          try {
            const svcMod = await import('../services/ai/chatTraceService.js');
            const chatTraceService = (svcMod.default || svcMod) as any;
            await chatTraceService.failRun({
              runId: chatRunId,
              code,
              message: msg,
              dtStates: dtStatesEmitted,
            });
          } catch {
            /* ignore */
          }
        }

        res.write(
          `data: ${JSON.stringify({
            error: msg,
            code,
            sessionId: streamSessionId,
            canResume: accumulatedContent.length > 0,
          })}\n\n`
        );
        // Keep SSE protocol consistent for the client parser
        res.write('data: [DONE]\n\n');
        if (
          aiModes?.deepResearch &&
          req.organizationId &&
          req.userId &&
          deepThinkingStartedLogged
        ) {
          try {
            const { logDeepThinkingEvent } =
              await import('../services/ai/deepThinkingMetricsService.js');
            await logDeepThinkingEvent({
              organizationId: req.organizationId!,
              userId: req.userId!,
              sessionId: streamSessionId,
              conversationId: conversationId || null,
              eventType: 'run_aborted',
              payload: { reason: 'exception', code, message: msg },
            });
          } catch {
            /* ignore */
          }
        }
        streamCompleted = true;
        return res.end();
      }
    } finally {
      clearInterval(heartbeatInterval);
      req.socket?.removeListener('close', connectionCleanup);
      req.socket?.removeListener('error', connectionCleanup);
      res.removeListener('close', connectionCleanup);
    }
    return;
  })
);

router.get(
  '/stream/partial/:sessionId',
  verifyToken,
  validateParams(SessionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const row = (await dbGet(
        `
            SELECT content, updated_at
            FROM ai_partial_responses
            WHERE session_id = ? AND user_id = ? AND organization_id = ?
              AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = ai_partial_responses.organization_id
                  AND om.user_id = ai_partial_responses.user_id
                  AND UPPER(om.status) = 'ACTIVE'
              )
        `,
        [req.params.sessionId, req.userId, req.organizationId]
      )) as { content: string; updated_at: string } | null;

      if (!row) {
        return res.status(404).json({ error: 'No partial response found' });
        return;
      }

      return res.json({
        sessionId: req.params.sessionId,
        content: row.content,
        updatedAt: row.updated_at,
        canResume: true,
      });
    } catch (err: any) {
      logger.warn('[AI Stream] Partial-response discovery failed', {
        sessionId: req.params.sessionId,
        organizationId: req.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(503).json({
        error: 'Partial response discovery unavailable',
        code: 'PARTIAL_RECOVERY_UNAVAILABLE',
      });
    }
  })
);

// ==================== REFINE TEXT (AI Field Enhancer) ====================
/**
 * Lightweight text-refinement endpoint for the AIFieldEnhancer component.
 * Sends the user's field text + mode instruction to an LLM and returns
 * plain refined text — no orchestrator, no deep thinking, no streaming.
 */
router.post(
  '/refine-text',
  verifyToken,
  validateBody(RefineTextRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, mode, systemInstruction, fieldLabel, artifactContext, language } = req.body;

    // --- Provider + access gate (standard formula) ---
    const aiGate = await ensureAiProviderAndAccess(req);
    if (aiGate) return res.status(aiGate.status).json(aiGate.body);

    // --- Build prompts ---
    const langCode = (language || 'pl').split('-')[0];
    const langMap: Record<string, string> = {
      pl: 'Polish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    };
    const langName = langMap[langCode] || 'Polish';

    const sys = [
      systemInstruction ||
        `You are a professional PMO content editor. Return ONLY the refined text — no commentary, no explanations, no quotes, no prefixes. Keep the original language.`,
      `\n[LANGUAGE INSTRUCTION: Always respond in ${langName}.]`,
    ].join('\n');

    const ctx = artifactContext
      ? `Artifact type: ${artifactContext.type}, Title: ${artifactContext.title || '-'}, Status: ${artifactContext.status || '-'}, Priority: ${artifactContext.priority || '-'}`
      : '';

    const userPrompt = [
      fieldLabel ? `Field: ${fieldLabel}` : '',
      ctx ? `Context: ${ctx}` : '',
      `Edit mode: ${mode}`,
      '',
      `Text to refine:`,
      text,
    ]
      .filter(Boolean)
      .join('\n');

    // --- Call LLM ---
    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { llmService } = await import('../services/ai/llmService.js');

    // Interactive UI endpoint: prefer fail-fast over multi-minute retries.
    // Allow optional timeout override for power-users/debugging.
    const requestedTimeoutMsRaw = Number((req.query as any)?.timeoutMs);
    const timeoutMs = Number.isFinite(requestedTimeoutMsRaw)
      ? Math.max(5000, Math.min(60000, Math.floor(requestedTimeoutMsRaw)))
      : 20000;

    const modelCfg = await modelRouter.select({
      capability: 'chat_confirm',
      organizationId: req.organizationId,
      tier: 'BUDGET',
    } as any);

    logger.info('[AI RefineText] Using model:', modelCfg.id, 'provider:', modelCfg.provider);

    const result = (await llmService.callText({
      type: 'chat',
      modelConfig: {
        provider: modelCfg.provider,
        id: modelCfg.id,
        endpoint: (modelCfg as any).endpoint,
        apiKey: (modelCfg as any).apiKey,
      },
      systemPrompt: sys,
      messages: [{ role: 'user', content: userPrompt }],
      timeoutMs,
      breakerOptions: {
        // Single-attempt by default; avoid long "spinner hangs" in UI.
        retryAttempts: 1,
        retryBaseDelay: 250,
        retryMaxDelay: 1000,
      },
    } as any)) as any;

    const refinedText = String(result?.content || result?.text || '').trim();

    if (!refinedText) {
      return res.status(502).json({
        error: 'LLM returned empty response',
        code: 'EMPTY_LLM_RESPONSE',
      });
    }

    return res.json({ text: refinedText });
  })
);

// ==================== CANVAS INLINE-AI QUICK EDIT ====================
// Non-streaming single-shot transform for the Canvas floating selection menu
// (CanvasRichEditor.handleAIRequest). Returns ONLY the modified fragment as
// { response }. Deliberately bypasses the heavy /chat/stream governance path
// (policy gateway, trust bundle, proposals) — this edits a text fragment, not a
// governed workspace mutation.
router.post(
  '/chat/quick',
  verifyToken,
  validateBody(ChatQuickRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, context, language } = req.body as {
      message: string;
      context?: { source?: string; selectedText?: string } & Record<string, unknown>;
      language?: string;
    };

    // --- Provider + access gate (standard formula) ---
    const aiGate = await ensureAiProviderAndAccess(req);
    if (aiGate) return res.status(aiGate.status).json(aiGate.body);

    // --- System prompt: return ONLY the modified fragment ---
    const langCode = (language || 'pl').split('-')[0];
    const langMap: Record<string, string> = {
      pl: 'Polish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    };
    const langName = langMap[langCode] || 'Polish';

    const sys = [
      'You edit a selected fragment of a document for an inline editor.',
      'Return ONLY the modified text — no commentary, no explanations, no quotes, no markdown code fences, no prefixes.',
      'Preserve the original language UNLESS the instruction explicitly asks to translate.',
      `\n[LANGUAGE INSTRUCTION: Unless asked to translate, respond in ${langName}.]`,
    ].join('\n');

    // --- Call LLM (fail-fast for an interactive UI surface) ---
    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { llmService } = await import('../services/ai/llmService.js');

    const modelCfg = await modelRouter.select({
      capability: 'chat_confirm',
      organizationId: req.organizationId,
      tier: 'BUDGET',
    } as any);

    logger.info('[AI ChatQuick] Using model:', modelCfg.id, 'provider:', modelCfg.provider);

    let result: any;
    try {
      result = (await llmService.callText({
        type: 'chat',
        modelConfig: {
          provider: modelCfg.provider,
          id: modelCfg.id,
          endpoint: (modelCfg as any).endpoint,
          apiKey: (modelCfg as any).apiKey,
        },
        systemPrompt: sys,
        messages: [{ role: 'user', content: message }],
        timeoutMs: 20000,
        breakerOptions: {
          retryAttempts: 1,
          retryBaseDelay: 250,
          retryMaxDelay: 1000,
        },
      } as any)) as any;
    } catch (err: any) {
      logger.error('[AI ChatQuick] LLM call failed:', err?.message || err);
      const mapped = mapLlmCallError(err);
      return res.status(mapped.status).json(mapped.body);
    }

    const responseText = String(result?.content || result?.text || '').trim();

    if (!responseText) {
      return res.status(502).json({
        error: 'LLM returned empty response',
        code: 'EMPTY_LLM_RESPONSE',
      });
    }

    return res.json({ response: responseText });
  })
);

// ==================== AI GENERATE (tool-side single-shot) ====================
// Lightweight endpoint for in-app tools (TemplateBuilder, etc.) that need a
// single LLM call with a custom system instruction and no chat orchestration.
// Returns { text: string }.
router.post(
  '/generate',
  verifyToken,
  validateBody(AiGenerateRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, systemInstruction } = req.body as {
      message: string;
      systemInstruction?: string;
    };

    const aiGate = await ensureAiProviderAndAccess(req);
    if (aiGate) return res.status(aiGate.status).json(aiGate.body);

    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { llmService } = await import('../services/ai/llmService.js');

    const modelCfg = await modelRouter.select({
      capability: 'chat_confirm',
      organizationId: req.organizationId,
      tier: 'STANDARD',
    } as any);

    logger.info('[AI Generate] Using model:', modelCfg.id, 'provider:', modelCfg.provider);

    let result: any;
    try {
      result = (await llmService.callText({
        type: 'chat',
        modelConfig: {
          provider: modelCfg.provider,
          id: modelCfg.id,
          endpoint: (modelCfg as any).endpoint,
          apiKey: (modelCfg as any).apiKey,
        },
        systemPrompt: systemInstruction || 'You are a helpful assistant.',
        messages: [{ role: 'user', content: message }],
        timeoutMs: 60000,
        breakerOptions: { retryAttempts: 2, retryBaseDelay: 500, retryMaxDelay: 2000 },
      } as any)) as any;
    } catch (err: any) {
      logger.error('[AI Generate] LLM call failed:', err?.message || err);
      const mapped = mapLlmCallError(err);
      return res.status(mapped.status).json(mapped.body);
    }

    const text = String(result?.content || result?.text || '').trim();
    if (!text) {
      return res
        .status(502)
        .json({ error: 'LLM returned empty response', code: 'EMPTY_LLM_RESPONSE' });
    }

    // ★ 2026-07-24 — REGRESJA R1: slad audytowy AI. Noc przepiela wywolania
    // narzedzi z /ai/chat (ktory logowal przez AIAuditLogger.logSuggestion) na
    // /ai/generate, ktory audytu NIE prowadzil => wpisy znikly z panelu admina.
    // Audyt jest per-handler (nie w warstwie middleware), wiec /generate musi
    // logowac sam — tym samym kontraktem co /chat (actionType SUGGESTION).
    // Best-effort: awaria audytu nie moze zablokowac odpowiedzi narzedzia.
    try {
      const roleName = String((req.body as { roleName?: string }).roleName || '').trim();
      const AIAuditLogger = await getAIAuditLogger();
      await AIAuditLogger.logSuggestion(
        req.userId!,
        req.organizationId!,
        null,
        roleName || 'AI_TOOL',
        text,
        {
          source: 'ai/generate',
          intent: roleName || null,
          userMessage: message,
          systemInstruction: systemInstruction || null,
          model: modelCfg.id,
          provider: modelCfg.provider,
          tokenUsage: result?.usage || null,
        }
      );
    } catch (auditErr: any) {
      logger.warn('[AI Generate] Audit log failed:', auditErr?.message || auditErr);
    }

    return res.json({ text });
  })
);

// ==================== CHAT (AI Orchestrator) ====================
router.post(
  '/chat',
  verifyToken,
  validateBody(ChatRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, projectId, currentScreen, selectedObjectId, selectedObjectType } = req.body;

    try {
      const AIOrchestrator = await getAIOrchestrator();
      const AIAuditLogger = await getAIAuditLogger();

      const result = await AIOrchestrator.processMessage(
        message,
        req.userId!,
        req.organizationId!,
        projectId,
        {
          currentScreen,
          selectedObjectId,
          selectedObjectType,
        }
      );

      logger.info('[AI Routes] Chat result:', JSON.stringify(result, null, 2));

      await AIAuditLogger.logSuggestion(
        req.userId!,
        req.organizationId!,
        projectId,
        result.role,
        result.prompt,
        result.contextSummary
      );

      return res.json({
        role: result.role,
        roleDescription: AIOrchestrator.getRoleDescription(result.role),
        intent: result.intent,
        contextSummary: result.contextSummary,
        dataSources: (result.responseContext as { dataSources?: unknown[] })?.dataSources || [],
        prompt: result.prompt,
        policyLevel:
          (result.responseContext as { policy?: { policyLevel?: string } })?.policy?.policyLevel ||
          'ADVISORY',
      });
    } catch (err: any) {
      // Core AI chat generation (Teresa) — the actual product. NEVER fail-soft:
      // a real error with a stable code, no err.message leak (H6.4).
      logger.error('[AI Routes] Chat failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
      if (error.isBudgetError) {
        return res.status(403).json({
          error: error.message,
          code: 'AI_BUDGET_EXHAUSTED',
          budgetStatus: error.budgetStatus,
        });
      }
      return res.status(500).json({
        error: 'Nie udało się wygenerować odpowiedzi asystenta',
        code: 'AI_CHAT_FAILED',
      });
    }
  })
);

// ==================== POLICY ====================

router.get(
  '/policy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const info = await (AIPolicyEngine as any).getPolicySummary(req.organizationId as string);
      return res.json(info);
    } catch (err: any) {
      logger.error('[AI Routes] Policy GET error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/policy',
  verifyToken,
  validateBody(UpdatePolicyRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin required' });
    }

    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const result = await AIPolicyEngine.updatePolicy(req.organizationId!, req.body);
      return res.json(result);
    } catch (err: any) {
      logger.error('[AI Routes] Policy PATCH error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/policy/can-perform/:actionType',
  verifyToken,
  validateParams(ActionTypeParamSchema),
  validateQuery(CanPerformActionQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIPolicyEngine = await getAIPolicyEngine();
      const result = await AIPolicyEngine.canPerformAction(
        req.params.actionType,
        req.organizationId as string,
        projectId as string | undefined,
        req.userId as string
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== MEMORY ====================

router.get(
  '/memory/project/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || req.organizationId;
    const projectRow = await dbGet<{ organization_id: string }>(
      `SELECT organization_id FROM projects WHERE id = ?`,
      [req.params.projectId]
    );
    if (!projectRow) return res.status(404).json({ error: 'Project not found' });
    if (String(projectRow.organization_id) !== String(orgId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const memory = await AIMemoryManager.buildProjectMemorySummary(req.params.projectId);
      return res.json(memory);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/memory/project/:projectId/decision',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateBody(RecordDecisionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decisionId, title, outcome, rationale } = req.body;

    // Cross-org write guard (parity with GET/DELETE on this resource): a logged-in
    // user must not be able to inject decision memory into another org's project
    // by guessing its id — that pollutes the other tenant's AI memory feeding chat.
    const orgId = req.user?.organizationId || req.organizationId;
    const projectRow = await dbGet<{ organization_id: string }>(
      `SELECT organization_id FROM projects WHERE id = ?`,
      [req.params.projectId]
    );
    if (!projectRow) return res.status(404).json({ error: 'Project not found' });
    if (String(projectRow.organization_id) !== String(orgId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.recordDecision(
        req.params.projectId,
        decisionId,
        title,
        outcome,
        rationale,
        req.userId!
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/memory/user',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const preferences = await AIMemoryManager.getUserPreferences(req.userId!);
      return res.json(preferences);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/memory/user',
  verifyToken,
  validateBody(UpdateUserPreferencesRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.updateUserPreferences(req.userId!, req.body);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.delete(
  '/memory/project/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || req.organizationId;
    const projectRow = await dbGet<{ organization_id: string }>(
      `SELECT organization_id FROM projects WHERE id = ?`,
      [req.params.projectId]
    );
    if (!projectRow) return res.status(404).json({ error: 'Project not found' });
    if (String(projectRow.organization_id) !== String(orgId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.can || !req.can('edit_project_settings')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.clearProjectMemory(req.params.projectId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// Organization Memory
router.get(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryManager = await getAIMemoryManager();
      const memory = await AIMemoryManager.getOrganizationMemory(req.organizationId!);
      return res.json({
        organizationId: req.organizationId,
        ...memory,
      });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.updateOrganizationMemory(req.organizationId!, req.body);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.delete(
  '/memory/org',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    try {
      const AIMemoryManager = await getAIMemoryManager();
      const result = await AIMemoryManager.clearOrganizationMemory(req.organizationId!);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== ACTIONS ====================

router.post(
  '/actions/draft',
  verifyToken,
  validateBody(CreateDraftRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { draftType, content, projectId, conversationId, planSummary, stepCount, steps, risk } =
      req.body;

    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.createDraft(
        draftType,
        content,
        req.userId!,
        req.organizationId!,
        projectId,
        conversationId
          ? {
              conversationId,
              planSummary: planSummary || null,
              stepCount,
              steps,
              risk,
            }
          : null
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/pending',
  verifyToken,
  validateQuery(GetPendingActionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const actions = await AIActionExecutor.getPendingActions(
        req.userId as string,
        projectId as string | undefined,
        req.organizationId as string
      );
      return res.json(actions);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/actions/:id/approve',
  verifyToken,
  validateParams(ActionIdParamSchema),
  validateBody(ApproveActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const { alwaysApprove, conversationId } = req.body || {};
      const result = await AIActionExecutor.approveAction(req.params.id, req.userId!, {
        alwaysApprove,
        conversationId: conversationId || undefined,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.patch(
  '/actions/:id/reject',
  verifyToken,
  validateParams(ActionIdParamSchema),
  validateBody(RejectActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reason, alwaysReject, conversationId } = req.body || {};
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.rejectAction(req.params.id, req.userId!, reason, {
        alwaysReject,
        conversationId: conversationId || undefined,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/actions/:id/execute',
  verifyToken,
  validateParams(ActionIdParamSchema),
  validateBody(ExecuteActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIActionExecutor = await getAIActionExecutor();
      const { conversationId } = req.body || {};
      const result = await AIActionExecutor.executeAction(req.params.id, req.userId!, {
        conversationId: conversationId || undefined,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/center',
  verifyToken,
  validateQuery(
    z.object({
      projectId: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(250).optional(),
      scope: z.enum(['mine', 'org']).optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { listActionCenter } = await import('../services/aiRunLedgerService.js');
      const { repairTeresaAIRunMirrorsForActionCenter } =
        await import('../services/v8/teresaCopilotService.js');
      const adminView =
        (req.query as any).scope === 'org' &&
        (req.userRole === 'ADMIN' || req.userRole === 'SUPERADMIN');
      await repairTeresaAIRunMirrorsForActionCenter({
        organizationId: req.organizationId as string,
        userId: req.userId as string,
        adminView,
        limit: ((req.query as any).limit as number | undefined) || 100,
      });
      const actions = await listActionCenter({
        organizationId: req.organizationId as string,
        userId: req.userId as string,
        projectId: ((req.query as any).projectId as string | undefined) || null,
        status: ((req.query as any).status as string | undefined) || null,
        limit: ((req.query as any).limit as number | undefined) || 100,
        adminView,
      });
      return res.json({
        success: true,
        actions,
        summary: {
          pending: actions.filter((action: any) => action.status === 'pending_review').length,
          approved: actions.filter((action: any) => action.status === 'approved').length,
          executed: actions.filter(
            (action: any) => action.status === 'executed' || action.status === 'audited'
          ).length,
          failed: actions.filter((action: any) => action.status === 'failed').length,
          rejected: actions.filter((action: any) => action.status === 'rejected').length,
        },
      });
    } catch (err: any) {
      logger.error('[AI] Action Center error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message, actions: [] });
    }
  })
);

router.get(
  '/actions/runs',
  verifyToken,
  validateQuery(
    z.object({
      projectId: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(250).optional(),
      scope: z.enum(['mine', 'org']).optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminView =
      (req.query as any).scope === 'org' &&
      (req.userRole === 'ADMIN' || req.userRole === 'SUPERADMIN');
    if ((req.query as any).scope === 'org' && !adminView) {
      return res.status(403).json({ success: false, error: 'Admin role required' });
    }
    try {
      const { listAIRuns } = await import('../services/aiRunLedgerService.js');
      const { repairTeresaAIRunMirrorsForActionCenter } =
        await import('../services/v8/teresaCopilotService.js');
      await repairTeresaAIRunMirrorsForActionCenter({
        organizationId: req.organizationId as string,
        userId: req.userId as string,
        adminView,
        limit: ((req.query as any).limit as number | undefined) || 100,
      });
      const runs = await listAIRuns({
        organizationId: req.organizationId as string,
        userId: req.userId as string,
        projectId: ((req.query as any).projectId as string | undefined) || null,
        status: ((req.query as any).status as string | undefined) || null,
        limit: ((req.query as any).limit as number | undefined) || 100,
        adminView,
      });
      return res.json({ success: true, runs });
    } catch (err: any) {
      logger.error('[AI] Run Ledger error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message, runs: [] });
    }
  })
);

router.get(
  '/actions/:id/audit',
  verifyToken,
  validateParams(ActionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { getAIRunByAction } = await import('../services/aiRunLedgerService.js');
      const audit = await getAIRunByAction(req.params.id);
      if (!audit) return res.status(404).json({ success: false, error: 'Action not found' });
      const canView =
        req.userRole === 'ADMIN' ||
        req.userRole === 'SUPERADMIN' ||
        audit.userId === req.userId ||
        audit.user_id === req.userId;
      if (!canView) {
        return res.status(403).json({ success: false, error: 'Permission denied' });
      }
      return res.json({ success: true, audit });
    } catch (err: any) {
      logger.error('[AI] Action audit error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

/**
 * V8 / Wave A6 — Unified read over proposals referenced by a conversation.
 *
 * Returns one `ChatProposalView` per distinct proposalId referenced in the
 * conversation's execution-family messages, merging governance truth
 * (`ai_actions` / `v8_action_proposals`) with facade rendering hints and
 * thread ordering. Read-only.
 */
router.get(
  '/conversations/:id/proposals',
  verifyToken,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { getConversationProposals } =
        await import('../services/v8/proposalUnificationService.js');
      const proposals = await getConversationProposals({
        conversationId: req.params.id,
        organizationId: req.organizationId || undefined,
      });
      return res.json({ proposals });
    } catch (err: any) {
      logger.error('[AI] Unified proposals read error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/proposals',
  verifyToken,
  validateQuery(GenerateProposalsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
      const logger = (await import('../utils/Logger.js')).default;
      logger.warn('Unauthorized proposal access attempt', {
        userId: req.userId,
        role: req.userRole,
      });
      return res.status(403).json({ error: 'Permission denied. ADMIN or SUPERADMIN required.' });
      return;
    }

    const { organizationId: queryOrgId } = req.query as { organizationId?: string };
    const organizationId =
      req.userRole === 'SUPERADMIN' && queryOrgId ? queryOrgId : req.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
      return;
    }

    try {
      const { getRequestContext } = await import('../utils/requestContext.js');
      const logger = (await import('../utils/Logger.js')).default;

      logger.info('Generating action proposals', {
        ...getRequestContext(req),
        targetOrgId: organizationId as string,
      });

      const AIContextBuilder = await getAIContextBuilder();
      const ActionProposalEngine = await import('../ai/actionProposalEngine.js').then(
        (m) => (m as any).default || m
      );

      const context = await AIContextBuilder.buildContext(undefined as any, organizationId);
      const proposals = ActionProposalEngine.generateProposals(context);

      return res.json(proposals);
    } catch (err: any) {
      logger.error('[AI Proposals] Error:', err);
      const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
      if (error.isBudgetError) {
        return res.status(403).json({
          error: error.message,
          code: 'AI_BUDGET_EXHAUSTED',
          budgetStatus: error.budgetStatus,
        });
        return;
      }
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// LAYER 2: RECOMMEND
router.post(
  '/recommend',
  verifyToken,
  validateBody(RecommendRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { diagnosisReport } = req.body;

    const generateFallbackInitiatives = (
      assessment: Record<string, unknown>,
      goals: string[],
      industry: string
    ) => {
      const axes = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ];

      const templates: Record<
        string,
        { name: string; priority: string; roi: number; budget: number }
      > = {
        processes: {
          name: 'Process Automation Initiative',
          priority: 'HIGH',
          roi: 2.0,
          budget: 200000,
        },
        digitalProducts: {
          name: 'Digital Product Development',
          priority: 'MEDIUM',
          roi: 2.5,
          budget: 300000,
        },
        businessModels: {
          name: 'Business Model Innovation',
          priority: 'MEDIUM',
          roi: 3.0,
          budget: 250000,
        },
        dataManagement: {
          name: 'Data Governance Implementation',
          priority: 'HIGH',
          roi: 1.8,
          budget: 150000,
        },
        culture: {
          name: 'Digital Culture Transformation',
          priority: 'MEDIUM',
          roi: 1.5,
          budget: 100000,
        },
        cybersecurity: {
          name: 'Cybersecurity Enhancement Program',
          priority: 'HIGH',
          roi: 1.5,
          budget: 180000,
        },
        aiMaturity: { name: 'AI Adoption Roadmap', priority: 'MEDIUM', roi: 2.2, budget: 220000 },
      };

      const initiativesToGenerate =
        Object.keys(assessment).length > 0
          ? axes.filter((axis) => {
              const axisData = assessment[axis] as
                | { current?: number; target?: number }
                | undefined;
              return (
                axisData &&
                axisData.current !== undefined &&
                axisData.target !== undefined &&
                axisData.current < axisData.target
              );
            })
          : axes.slice(0, 5);

      return initiativesToGenerate.map((axis) => {
        const template = templates[axis] || templates.processes;
        return {
          id: uuidv4(),
          name: template.name,
          description: `${template.name} for ${industry}`,
          hypothesis: `Implementing this initiative will improve ${axis} maturity and support: ${goals[0]}`,
          axis,
          area: null,
          priority: template.priority,
          complexity: 'Medium',
          estimatedROI: template.roi,
          estimatedBudget: template.budget,
          status: 'DRAFT',
          progress: 0,
          quarter: 'Q1',
          wave: 'Wave 1',
        };
      });
    };

    try {
      const aiPipeline = await getAIPipeline();

      const assessment = diagnosisReport.assessment || {};
      const goals = diagnosisReport.goals || ['Digital Transformation'];
      const painPoints = diagnosisReport.painPoints || [];
      const industry = diagnosisReport.industry || 'General';

      const initiativesPrompt = `You are a strategic transformation consultant. Based on the assessment data and business context, generate specific transformation initiatives.

BUSINESS CONTEXT:
- Industry: ${industry}
- Strategic Goals: ${goals.join(', ')}
- Pain Points: ${painPoints.join(', ')}

ASSESSMENT DATA:
${JSON.stringify(assessment, null, 2)}

Generate 5-10 strategic initiatives. For each initiative, provide:
1. name: Clear, actionable initiative name
2. description: Brief description of what the initiative involves
3. axis: Which assessment axis it addresses (processes, digitalProducts, businessModels, dataManagement, culture, cybersecurity, aiMaturity)
4. priority: HIGH, MEDIUM, or LOW
5. complexity: Low, Medium, or High
6. estimatedROI: Expected ROI multiplier (e.g., 1.5x, 2x, 3x)
7. estimatedBudget: Rough budget range in PLN
8. hypothesis: The expected outcome/benefit

Return as a JSON array of initiatives.`;

      const response = await aiPipeline.process({
        type: 'chat',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: initiativesPrompt,
        stream: false,
      });

      let initiatives: unknown[] = [];
      try {
        const text =
          (response as { text?: string; content?: string }).text ||
          (response as { content?: string }).content ||
          '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          initiatives = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        logger.warn('[AI Recommend] Failed to parse AI response as JSON:', parseErr);
      }

      if (!initiatives || (Array.isArray(initiatives) && initiatives.length === 0)) {
        logger.warn('[AI Recommend] No initiatives parsed, using fallback generation');
        initiatives = generateFallbackInitiatives(assessment, goals, industry);
      }

      const processedInitiatives = (Array.isArray(initiatives) ? initiatives : []).map(
        (init: any, idx: number) => ({
          id: (init.id as string) || uuidv4(),
          name: (init.name as string) || `Initiative ${idx + 1}`,
          description: (init.description as string) || (init.summary as string) || '',
          hypothesis: (init.hypothesis as string) || (init.description as string) || '',
          axis: (init.axis as string) || 'processes',
          area: (init.area as string | null) || null,
          priority: (init.priority as string) || 'MEDIUM',
          complexity: (init.complexity as string) || 'Medium',
          estimatedROI: parseFloat((init.estimatedROI as string) || '1.5') || 1.5,
          estimatedBudget: parseInt((init.estimatedBudget as string) || '100000', 10) || 100000,
          status: 'DRAFT',
          progress: 0,
          quarter: 'Q1',
          wave: 'Wave 1',
        })
      );

      return res.json(processedInitiatives);
    } catch (err: any) {
      logger.error('[AI Recommend] Error:', err);
      const fallbackInitiatives = generateFallbackInitiatives(
        diagnosisReport.assessment || {},
        diagnosisReport.goals || ['Digital Transformation'],
        diagnosisReport.industry || 'General'
      );
      return res.json(fallbackInitiatives);
    }
  })
);

// LAYER 3: ROADMAP
router.post(
  '/roadmap',
  verifyToken,
  validateBody(RoadmapRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body;

    try {
      const aiPipeline = await getAIPipeline();

      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`
        )
        .join('\n');

      const roadmapPrompt = `You are a strategic transformation consultant. Create an optimized implementation roadmap for the following initiatives.

INITIATIVES TO SCHEDULE:
${initiativesSummary}

RULES:
1. High priority + Low complexity initiatives should go in Q1-Q2 Year 1 (quick wins)
2. High priority + High complexity initiatives should start Q2 Year 1 with longer duration
3. Medium/Low priority can be scheduled in Year 2-3
4. Consider dependencies - foundation initiatives before dependent ones
5. Balance workload across quarters - no more than 3-4 major initiatives per quarter
6. Return the EXACT initiative names as provided (case-sensitive)

Return ONLY valid JSON (no markdown, no code fences, no commentary) with this exact shape:
{
  "year1": { "q1": string[], "q2": string[], "q3": string[], "q4": string[] },
  "year2"?: { "q1": string[], "q2": string[], "q3": string[], "q4": string[] },
  "year3"?: { "q1": string[], "q2": string[], "q3": string[], "q4": string[] },
  "reasoning": string
}`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: roadmapPrompt,
        schema: 'roadmap',
        stream: false,
      });

      const roadmapData = (response as { object?: unknown }).object || response;

      if (!(roadmapData as { year1?: unknown }).year1) {
        logger.warn('[AI Roadmap] Invalid response structure, using fallback');
        const fallback: Record<string, Record<string, string[]>> = {
          year1: { q1: [], q2: [], q3: [], q4: [] },
          year2: { q1: [], q2: [], q3: [], q4: [] },
          reasoning: 'Fallback distribution due to AI response error',
        } as unknown as Record<string, Record<string, string[]>>;

        initiatives.forEach((init: Record<string, unknown>, idx: number) => {
          const quarter = idx % 4;
          const year = idx < 8 ? 'year1' : 'year2';
          const qKey = `q${quarter + 1}`;
          (fallback[year][qKey] as string[]).push(init.name as string);
        });

        return res.json(fallback);
        return;
      }

      return res.json(roadmapData);
    } catch (err: any) {
      logger.error('[AI Roadmap] Error:', err);
      const fallback: Record<string, Record<string, string[]>> = {
        year1: { q1: [], q2: [], q3: [], q4: [] },
        year2: { q1: [], q2: [], q3: [], q4: [] },
        reasoning: 'Fallback distribution due to error: ' + (err as Error).message,
      } as unknown as Record<string, Record<string, string[]>>;

      initiatives.forEach((init: Record<string, unknown>, idx: number) => {
        const quarter = idx % 4;
        const year = idx < 8 ? 'year1' : 'year2';
        const qKey = `q${quarter + 1}`;
        (fallback[year][qKey] as string[]).push(init.name as string);
      });

      return res.json(fallback);
    }
  })
);

// ==================== INITIATIVES AI ====================

router.post(
  '/initiatives/schedule',
  verifyToken,
  validateBody(RoadmapRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`
        )
        .join('\n');

      const roadmapPrompt = `You are a strategic transformation consultant. Create an optimized implementation roadmap for the following initiatives.

INITIATIVES TO SCHEDULE:
${initiativesSummary}

RULES:
1. High priority + Low complexity initiatives should go in Q1-Q2 Year 1 (quick wins)
2. High priority + High complexity initiatives should start Q2 Year 1 with longer duration
3. Medium/Low priority can be scheduled in Year 2-3
4. Consider dependencies - foundation initiatives before dependent ones
5. Balance workload across quarters - no more than 3-4 major initiatives per quarter
6. Return the EXACT initiative names as provided (case-sensitive)

Return a structured roadmap assigning each initiative to a specific quarter.`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: roadmapPrompt,
        schema: 'roadmap',
        stream: false,
      });

      const roadmapData = (response as { object?: unknown }).object || response;
      const now = new Date();
      const currentYear = now.getFullYear();

      const schedule = (initiatives as any[]).map((init: any) => {
        let quarter = 'Q1';
        let yearOffset = 0;
        let found = false;

        ['year1', 'year2', 'year3'].forEach((yKey, yIdx) => {
          const yObj = (roadmapData as any)?.[yKey];
          if (!yObj || found) return;
          ['q1', 'q2', 'q3', 'q4'].forEach((qKey: string) => {
            if (found) return;
            const titles = yObj[qKey];
            if (Array.isArray(titles) && titles.includes(init.name)) {
              quarter = qKey.toUpperCase();
              yearOffset = yIdx;
              found = true;
            }
          });
        });

        const qNum = Number(quarter.replace('Q', '')) || 1;
        const year = currentYear + yearOffset;
        const startDate = new Date(year, (qNum - 1) * 3, 1);
        const endDate = new Date(year, qNum * 3, 0);

        return {
          id: init.id,
          name: init.name,
          quarter: `${quarter} ${year}`,
          plannedStartDate: startDate.toISOString(),
          plannedEndDate: endDate.toISOString(),
        };
      });

      return res.json({ roadmap: roadmapData, schedule });
    } catch (err: any) {
      logger.error('[AI Schedule] Error:', err);
      return res.status(500).json({ error: 'Failed to generate schedule' });
    }
  })
);

router.post(
  '/initiatives/conflicts',
  verifyToken,
  validateBody(InitiativeConflictsRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives, dependencies } = req.body as any;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Owner: ${init.owner || 'Unassigned'}, Start: ${init.plannedStartDate || 'TBD'}, End: ${init.plannedEndDate || 'TBD'}`
        )
        .join('\n');

      const depsSummary = Array.isArray(dependencies)
        ? dependencies
            .map(
              (dep: any) =>
                `- ${dep.fromInitiativeId} -> ${dep.toInitiativeId} (${dep.type || 'FINISH_TO_START'})`
            )
            .join('\n')
        : 'None';

      const conflictsPrompt = `Analyze the following initiative schedule and dependencies. Identify resource conflicts, timeline overlaps, and dependency risks.

INITIATIVES:
${initiativesSummary}

DEPENDENCIES:
${depsSummary}

Return a JSON array of conflicts with fields:
- type (resource|dependency|timeline)
- initiatives (array of initiative names)
- severity (low|medium|high)
- description
- recommendation

Return ONLY valid JSON array (no markdown, no code fences, no commentary).`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: conflictsPrompt,
        schema: 'initiative_conflicts',
        stream: false,
      });

      const result = (response as { object?: unknown }).object || response;
      return res.json({ conflicts: result });
    } catch (err: any) {
      logger.error('[AI Conflicts] Error:', err);
      return res.status(500).json({ error: 'Failed to analyze conflicts' });
    }
  })
);

router.post(
  '/initiatives/priorities',
  verifyToken,
  validateBody(InitiativePrioritiesRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body as any;
    try {
      const aiPipeline = await getAIPipeline();
      const initiativesSummary = initiatives
        .map(
          (init: any, idx: number) =>
            `${idx + 1}. "${init.name}" - Current Priority: ${init.priority || 'Medium'}, ROI: ${init.expectedRoi || 'Unknown'}, Owner: ${init.owner || 'Unassigned'}`
        )
        .join('\n');

      const prioritiesPrompt = `Review the initiatives and recommend priority adjustments. Consider ROI, strategic impact, and dependencies.

INITIATIVES:
${initiativesSummary}

Return a JSON array with fields:
- name
- recommendedPriority (Critical|High|Medium|Low)
- rationale

Return ONLY valid JSON array (no markdown, no code fences, no commentary).`;

      const response = await aiPipeline.process({
        type: 'structured',
        capability: 'strategic',
        userId: req.userId!,
        organizationId: req.organizationId!,
        prompt: prioritiesPrompt,
        schema: 'initiative_priorities',
        stream: false,
      });

      const result = (response as { object?: unknown }).object || response;
      return res.json({ priorities: result });
    } catch (err: any) {
      logger.error('[AI Priorities] Error:', err);
      return res.status(500).json({ error: 'Failed to recommend priorities' });
    }
  })
);

// ==================== AUDIT ====================

router.get(
  '/audit',
  verifyToken,
  validateQuery(GetAuditLogsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { projectId, userId, actionType, limit, offset } = req.query as any;
    // The original instruction had an extra closing brace here, which is removed for syntactical correctness.
    // The instruction was: `const { projectId, userId, actionType, limit, offset } = req.query as any; };`
    // Corrected to: `const { projectId, userId, actionType, limit, offset } = req.query as any;`

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: projectId as string | undefined,
        userId: userId as string | undefined,
        actionType: actionType as string | undefined,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
      });
      return res.json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/audit/stats',
  verifyToken,
  validateQuery(GetAuditLogsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
      const AIAuditLogger = await getAIAuditLogger();
      const stats = await AIAuditLogger.getAuditStats(
        req.organizationId!,
        projectId as string | undefined
      );
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/audit/:id/decision',
  verifyToken,
  validateParams(AuditIdParamSchema),
  validateBody(RecordAuditDecisionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decision, feedback } = req.body;
    try {
      const AIAuditLogger = await getAIAuditLogger();
      const result = await AIAuditLogger.recordUserDecision(req.params.id, decision, feedback);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== EXPLANATIONS ====================

router.get(
  '/explanations/:projectId',
  verifyToken,
  validateParams(ProjectIdParamSchema),
  validateQuery(GetExplanationsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { limit, offset } = req.query as any;

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: req.params.projectId,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
        includeExplanation: true,
      });

      const explanations = (Array.isArray(logs) ? logs : []).map(
        (log: Record<string, unknown>) => ({
          id: log.id,
          timestamp: log.created_at,
          explanation: log.explanation,
          aiResponse: log.ai_suggestion,
          userDecision: log.user_decision,
        })
      );

      return res.json({
        projectId: req.params.projectId,
        total: explanations.length,
        explanations,
      });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/explanations/export',
  verifyToken,
  validateQuery(ExportExplanationsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
      return res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { projectId, startDate, endDate } = req.query as {
      projectId?: string;
      startDate?: string;
      endDate?: string;
    };

    try {
      const AIAuditLogger = await getAIAuditLogger();
      const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
        projectId: projectId || null,
        limit: 1000,
        offset: 0,
        includeExplanation: true,
      });

      let filteredLogs = Array.isArray(logs) ? logs : [];
      if (startDate) {
        const start = new Date(startDate);
        filteredLogs = filteredLogs.filter(
          (log: Record<string, unknown>) => new Date(log.created_at as string) >= start
        );
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredLogs = filteredLogs.filter(
          (log: Record<string, unknown>) => new Date(log.created_at as string) <= end
        );
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        organizationId: req.organizationId,
        projectId: projectId || 'ALL',
        totalRecords: filteredLogs.length,
        dateRange: {
          start: startDate || 'N/A',
          end: endDate || 'N/A',
        },
        records: filteredLogs.map((log: Record<string, unknown>) => ({
          id: log.id,
          userId: log.user_id,
          projectId: log.project_id,
          timestamp: log.created_at,
          actionType: log.action_type,
          explanation: log.explanation,
          aiResponse: log.ai_suggestion,
          userDecision: log.user_decision,
          userFeedback: log.user_feedback,
        })),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ai_explanations_${new Date().toISOString().split('T')[0]}.json"`
      );
      return res.json(exportData);
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== HEALTH MONITORING ====================

router.get(
  '/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const healthMonitor = (await import('../services/ai/healthMonitor.js')).default as any;
      const status = healthMonitor.getStatus();

      // Keep response compatible with `AIHealthResponse` expected by the frontend.
      const overall =
        (status?.lastCheck as { overall?: 'healthy' | 'degraded' | 'error' } | null)?.overall ||
        'error';
      const lastCheck =
        (status?.lastCheck as { timestamp?: string } | null)?.timestamp || new Date().toISOString();

      return res.json({
        status: overall,
        providers: status?.providers || {},
        lastCheck,
        // Extra debug fields (harmless for typed clients)
        isRunning: status?.isRunning,
        consecutiveFailures: status?.consecutiveFailures,
        checks: (status?.lastCheck as { checks?: unknown[] } | null)?.checks || [],
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  })
);

router.post(
  '/health/diagnose',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const healthMonitor = (await import('../services/ai/healthMonitor.js')).default as any;
      const results = await healthMonitor.runDiagnostics();
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        error: (err as Error).message,
      });
    }
  })
);

// ==================== SMART SUGGESTIONS ====================

router.get(
  '/suggestions',
  verifyToken,
  validateQuery(GetSuggestionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.query as { projectId?: string };
      const smartSuggestions = await import('../services/ai/smartSuggestions.js').then(
        (m) => (m as any).default || m
      );

      const suggestions = await smartSuggestions.getCachedSuggestions(req.userId!, projectId, {});

      return res.json({ suggestions });
    } catch (err: any) {
      logger.error('[AI] Suggestions error:', err);
      return res.status(500).json({
        error: (err as Error).message,
        suggestions: [],
      });
    }
  })
);

router.post(
  '/suggestions',
  verifyToken,
  validateBody(PostSuggestionsRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, conversationContext } = req.body;
      const smartSuggestions = await import('../services/ai/smartSuggestions.js').then(
        (m) => (m as any).default || m
      );

      const suggestions = await smartSuggestions.getSuggestions(
        req.userId!,
        projectId,
        conversationContext || {}
      );

      return res.json({ suggestions });
    } catch (err: any) {
      logger.error('[AI] Suggestions error:', err);
      return res.status(500).json({
        error: (err as Error).message,
        suggestions: [],
      });
    }
  })
);

// ==================== APPROVAL PATTERNS ====================

// const ApprovalPatternService = await import('../services/approvalPatternService.js').then(
//     (m) => (m as any).default || m,
// );

router.get(
  '/patterns',
  verifyToken,
  validateQuery(GetPatternsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { actionType } = req.query as { actionType?: string };
      // const patterns = await ApprovalPatternService.getUserPatterns(req.userId!, actionType);
      // return res.json({ success: true, patterns });
      return res.json({ success: true, patterns: [] });
    } catch (err: any) {
      logger.error('[AI] Get patterns error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// router.get(
//     '/patterns/stats',
//     verifyToken,
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const stats = await ApprovalPatternService.getPatternStats(req.userId!);
//             return res.json(stats);
//         } catch (err: any) {
//             logger.error('[AI] Pattern stats error:', err);
//             return res.status(500).json({ error: (err as Error).message });
//         }
//     }),
// );

// router.patch(
//     '/patterns/:patternId/auto-apply',
//     verifyToken,
//     validateParams(PatternIdParamSchema),
//     validateBody(ToggleAutoApplyRequestSchema),
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const { enabled } = req.body;
//             const result = await ApprovalPatternService.setAutoApply(req.params.patternId, enabled, req.userId!);
//             return res.json(result);
//         } catch (err: any) {
//             logger.error('[AI] Toggle auto-apply error:', err);
//             return res.status(500).json({ success: false, error: (err as Error).message });
//         }
//     }),
// );

// router.delete(
//     '/patterns/:patternId',
//     verifyToken,
//     validateParams(PatternIdParamSchema),
//     asyncHandler(async (req: AuthRequest, res: Response) => {
//         try {
//             const result = await ApprovalPatternService.deletePattern(req.params.patternId, req.userId!);
//             return res.json(result);
//         } catch (err: any) {
//             logger.error('[AI] Delete pattern error:', err);
//             return res.status(500).json({ success: false, error: (err as Error).message });
//         }
//     }),
// );

router.post(
  '/actions/:actionId/approve',
  verifyToken,
  validateParams(z.object({ actionId: z.string().uuid() })),
  validateBody(ApproveActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { alwaysApprove, conversationId } = (req.body as any) || {};
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.approveAction(
        (req.params as any).actionId,
        req.userId as string,
        {
          alwaysApprove,
          conversationId: conversationId || undefined,
        }
      );
      return res.json(result);
    } catch (err: any) {
      logger.error('[AI] Approve action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/actions/:actionId/reject',
  verifyToken,
  validateParams(z.object({ actionId: z.string().uuid() })),
  validateBody(RejectActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { reason, alwaysReject, conversationId } = (req.body as any) || {};
      const AIActionExecutor = await getAIActionExecutor();
      const result = await AIActionExecutor.rejectAction(
        (req.params as any).actionId,
        req.userId as string,
        reason,
        { alwaysReject, conversationId: conversationId || undefined }
      );
      return res.json(result);
    } catch (err: any) {
      logger.error('[AI] Reject action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/actions/pending',
  verifyToken,
  validateQuery(GetPendingActionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.query as { projectId?: string };
      const AIActionExecutor = await getAIActionExecutor();
      const actions = await AIActionExecutor.getPendingActions(
        req.userId as string,
        projectId || null,
        req.organizationId as string
      );

      const actionsWithPatterns = await Promise.all(
        (Array.isArray(actions) ? actions : []).map(async (action: Record<string, unknown>) => {
          const patternInfo = await (AIActionExecutor as any).getPatternInfo(
            req.userId as string,
            action.action_type as string,
            (action.payload as Record<string, unknown>) || {}
          );
          return { ...action, patternInfo };
        })
      );

      return res.json({ success: true, actions: actionsWithPatterns });
    } catch (err: any) {
      logger.error('[AI] Get pending actions error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message, actions: [] });
    }
  })
);

// ==================== FEEDBACK & REPORTING ====================

router.post(
  '/feedback',
  verifyToken,
  validateBody(RecordFeedbackRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, rating } = req.body;
    const userId = req.userId!;

    try {
      logger.info(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);

      try {
        const aiLogger = await import('../services/ai/logger.js').then(
          (m) => (m as any).default || m
        );
        await aiLogger.log('feedback', {
          userId,
          messageId,
          rating,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        logger.warn('[AI] Could not log feedback:', (logErr as Error).message);
      }

      // Feed into adaptive response service to learn user preferences
      try {
        const adaptiveMod = await import('../services/ai/adaptiveResponseService.js');
        const adaptiveService =
          (adaptiveMod as any).adaptiveResponseService || (adaptiveMod as any).default;
        if (adaptiveService?.processFeedback) {
          await adaptiveService.processFeedback({
            userId,
            messageId,
            rating,
            lengthFeedback: req.body.lengthFeedback,
            detailFeedback: req.body.detailFeedback,
            formatFeedback: req.body.formatFeedback,
            responseLength: req.body.responseLength,
            conversationId: req.body.conversationId,
            screenContext: req.body.screenContext,
            focusMode: req.body.focusMode,
          });
          logger.debug(`[AI Feedback] Adaptive service updated for user ${userId}`);
        }
      } catch (adaptErr) {
        logger.warn('[AI] Could not update adaptive service:', (adaptErr as Error).message);
      }

      // Feed into learning system for pattern analysis and quality improvement
      try {
        const lsPath = '../services/ai/learningSystem' + '.js';
        const lsMod = await import(/* @vite-ignore */ lsPath);
        const ls = (lsMod as any).learningSystem || (lsMod as any).default;
        if (ls?.processFeedback) {
          await ls.processFeedback({
            id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            organizationId: req.organizationId,
            conversationId: req.body.conversationId || '',
            messageId,
            feedbackType: rating,
            comment: req.body.comment || undefined,
            correction: req.body.correction || undefined,
            timestamp: new Date().toISOString(),
          });
          logger.debug(`[AI Feedback] Learning system processed feedback for message ${messageId}`);
        }
      } catch (learnErr) {
        logger.warn(
          '[AI] Could not process feedback in learning system:',
          (learnErr as Error).message
        );
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Feedback error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/report',
  verifyToken,
  validateBody(ReportMessageRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, reason } = req.body;
    const userId = req.userId!;

    try {
      // M01-P03 §8 — tenant: reporting someone else's message must be
      // rejected. This previously logged whatever messageId the caller sent
      // with no ownership check at all — not a data-read risk (nothing is
      // returned), but a caller could tag an arbitrary conversation's message
      // as "harmful" without ever having access to it. 404 (not 403) matches
      // the not-found convention used for cross-tenant conversation access
      // elsewhere in this codebase — no existence oracle for messages the
      // caller cannot see.
      const messageRow = await dbGet<{ conversation_id: string }>(
        `SELECT conversation_id FROM conversation_messages WHERE id = ?`,
        [messageId]
      );
      if (!messageRow) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }
      const accessibleConversation = await dbGet<{ id: string }>(
        `SELECT id FROM conversations
         WHERE id = ? AND (user_id = ? OR (organization_id IS NOT NULL AND organization_id = ?))`,
        [messageRow.conversation_id, userId, req.organizationId || null]
      );
      if (!accessibleConversation) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }

      logger.error(`[AI REPORT] 🚨 User ${userId} reported message ${messageId}: ${reason}`);

      try {
        const aiLogger = await import('../services/ai/logger.js').then(
          (m) => (m as any).default || m
        );
        await aiLogger.log('report', {
          userId,
          messageId,
          reason,
          timestamp: new Date().toISOString(),
          severity: reason === 'harmful' ? 'critical' : 'warning',
        });
      } catch (logErr) {
        logger.warn('[AI] Could not log report:', (logErr as Error).message);
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Report error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== MEMORY METRICS ====================

router.get(
  '/memory/metrics',
  verifyToken,
  validateQuery(GetMemoryMetricsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      if (
        !AIMemoryMetricsService ||
        AIMemoryMetricsService.__unavailable__ === true ||
        typeof AIMemoryMetricsService.getDashboardMetrics !== 'function'
      ) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }
      const { period } = req.query as any;

      const metrics = await AIMemoryMetricsService.getDashboardMetrics(req.organizationId!, period);

      return res.json({ success: true, ...metrics });
    } catch (err: any) {
      logger.error('[AI] Memory metrics error:', err);
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
  })
);

router.get(
  '/memory/current',
  verifyToken,
  validateQuery(GetCurrentMemoryQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      if (
        !AIMemoryMetricsService ||
        AIMemoryMetricsService.__unavailable__ === true ||
        typeof AIMemoryMetricsService.getCurrentMemoryState !== 'function'
      ) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }
      const { projectId } = req.query as any;

      const state = await AIMemoryMetricsService.getCurrentMemoryState(
        projectId,
        req.organizationId!
      );

      return res.json({ success: true, ...state });
    } catch (err: any) {
      logger.error('[AI] Current memory state error:', err);
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
  })
);

router.get(
  '/memory/latency',
  verifyToken,
  validateQuery(GetMemoryLatencyQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const AIMemoryMetricsService = (await import('../services/ai/aiMemoryMetricsService.js'))
        .default as any;
      if (
        !AIMemoryMetricsService ||
        AIMemoryMetricsService.__unavailable__ === true ||
        typeof AIMemoryMetricsService.getLatencyPercentiles !== 'function'
      ) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }
      const { hours } = req.query as any;

      const latency = await AIMemoryMetricsService.getLatencyPercentiles(
        req.organizationId!,
        hours
      );

      return res.json({ success: true, ...latency });
    } catch (err: any) {
      logger.error('[AI] Latency metrics error:', err);
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
  })
);

// ==================== PROACTIVE SUGGESTIONS ====================

const getProactiveSuggestionsService = async () =>
  (await import('../services/ai/proactiveSuggestionsService.js')).default as any;
const getResponseQualityService = async () =>
  (await import('../services/ai/responseQualityService.js')).default as any;

router.get(
  '/suggestions',
  verifyToken,
  validateQuery(GetSuggestionsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, screenContext } = req.query as any;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      const suggestions = await ProactiveSuggestionsService.generateSuggestions({
        userId: req.userId!,
        organizationId: req.organizationId!,
        projectId: projectId || null,
        screenContext: screenContext ? JSON.parse(screenContext) : null,
        recentActions: [],
      });

      return res.json({ success: true, suggestions });
    } catch (err: any) {
      logger.error('[AI] Proactive suggestions error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.post(
  '/suggestions/action',
  verifyToken,
  validateBody(RecordSuggestionActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { suggestionId, action, feedback } = req.body;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      await ProactiveSuggestionsService.recordSuggestionAction(
        suggestionId,
        req.userId!,
        action,
        feedback
      );

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[AI] Suggestion action error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/suggestions/metrics',
  verifyToken,
  validateQuery(GetSuggestionMetricsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ProactiveSuggestionsService = await getProactiveSuggestionsService();

      const metrics = await ProactiveSuggestionsService.getSuggestionMetrics(
        req.organizationId!,
        days
      );

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Suggestion metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== RESPONSE QUALITY ====================

router.post(
  '/quality/calculate',
  verifyToken,
  validateBody(CalculateQualityRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { query, response, context, sources } = req.body;
      const ResponseQualityService = await getResponseQualityService();

      const metrics = await ResponseQualityService.calculateQuality({
        query,
        response,
        context: {
          ...context,
          organizationId: req.organizationId,
        },
        sources: sources || [],
      });

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Quality calculation error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/quality/aggregate',
  verifyToken,
  validateQuery(GetAggregateQualityQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ResponseQualityService = await getResponseQualityService();

      const metrics = await ResponseQualityService.getAggregateMetrics(req.organizationId!, days);

      return res.json({ success: true, metrics });
    } catch (err: any) {
      logger.error('[AI] Aggregate quality metrics error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

router.get(
  '/quality/trends',
  verifyToken,
  validateQuery(GetQualityTrendsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { days } = req.query as any;
      const ResponseQualityService = await getResponseQualityService();

      const trends = await ResponseQualityService.getQualityTrends(req.organizationId!, days);

      return res.json({ success: true, trends });
    } catch (err: any) {
      logger.error('[AI] Quality trends error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==========================================
// GAP-AI-002: SOFT CAP STATUS
// ==========================================

/**
 * GET /api/ai/soft-cap-status
 * Get current soft cap and usage status for the organization
 */
router.get(
  '/soft-cap-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.organizationId;
      if (!orgId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const usageService = (await import('../services/usageService.js')).default;
      const quota = await usageService.checkQuota(orgId, 'token');

      // Soft cap configuration
      const softCapConfig = {
        enabled: true,
        softCapPercentage: 100,
        hardCapPercentage: 150,
        degradedTier: 'BUDGET',
      };

      const status = {
        usage: {
          used: quota.used,
          limit: quota.limit,
          percentage: quota.percentage,
          remaining: quota.remaining,
        },
        softCap: {
          ...softCapConfig,
          isInSoftCap:
            quota.percentage >= softCapConfig.softCapPercentage &&
            quota.percentage < softCapConfig.hardCapPercentage,
          isAtHardCap: quota.percentage >= softCapConfig.hardCapPercentage,
          currentMode:
            quota.percentage >= softCapConfig.hardCapPercentage
              ? 'blocked'
              : quota.percentage >= softCapConfig.softCapPercentage
                ? 'degraded'
                : 'normal',
        },
        recommendations: [] as string[],
      };

      // Add recommendations based on status
      if (status.softCap.currentMode === 'blocked') {
        status.recommendations.push(
          'Your organization has exceeded the hard cap. Please upgrade your plan to continue using AI features.'
        );
      } else if (status.softCap.currentMode === 'degraded') {
        status.recommendations.push(
          'You are in degraded mode. AI responses will use budget-tier models until your usage resets or you upgrade.'
        );
        status.recommendations.push(
          'Consider upgrading your plan for access to premium AI models.'
        );
      } else if (quota.percentage >= 80) {
        status.recommendations.push(
          'You are approaching your token limit. Consider monitoring your usage closely.'
        );
      }

      return res.json({ success: true, ...status });
    } catch (err: any) {
      logger.error('[AI] Soft cap status error:', err);
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  })
);

// ==================== PHASE 3: INTELLIGENT FEATURES ====================

// 3.1 NL → Initiative Generator
router.post(
  '/generate-initiative',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { goal, projectId } = req.body;
    if (!goal) return res.status(400).json({ error: 'Goal description is required' });

    try {
      const { generateInitiativeFromNL } = await import('../services/ai/intelligentFeatures.js');
      const result = await generateInitiativeFromNL(
        goal,
        req.userId!,
        req.organizationId!,
        projectId
      );
      return res.json({ success: true, initiative: result });
    } catch (err: any) {
      logger.error('[AI] Generate initiative error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 3.2 AI Sense-Check
router.post(
  '/sense-check',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { data, type } = req.body;
    if (!data) return res.status(400).json({ error: 'Data is required for sense-check' });

    try {
      const { senseCheckInitiative } = await import('../services/ai/intelligentFeatures.js');
      const result = await senseCheckInitiative(data, req.userId!, req.organizationId!);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Sense-check error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 3.3 Predictive Risk Score
router.post(
  '/risk-score',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiativeData, projectContext } = req.body;
    if (!initiativeData) return res.status(400).json({ error: 'Initiative data is required' });

    try {
      const { predictRiskScore } = await import('../services/ai/intelligentFeatures.js');
      const result = await predictRiskScore(
        initiativeData,
        req.userId!,
        req.organizationId!,
        projectContext
      );
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Risk score error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 3.4 AI-Narrated Dashboards
router.post(
  '/narrate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { chartType, chartData, userRole } = req.body;
    if (!chartType || !chartData)
      return res.status(400).json({ error: 'Chart type and data required' });

    try {
      const { narrateChartData } = await import('../services/ai/intelligentFeatures.js');
      const narrative = await narrateChartData(
        chartType,
        chartData,
        userRole || 'analyst',
        req.userId!,
        req.organizationId!
      );
      return res.json({ success: true, narrative });
    } catch (err: any) {
      logger.error('[AI] Narrate error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 3.6 Proactive AI Nudges
router.get(
  '/nudges',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const projectId = req.query.projectId as string | undefined;

    try {
      const { generateNudges } = await import('../services/ai/intelligentFeatures.js');
      const nudges = await generateNudges(req.userId!, req.organizationId!, projectId);
      return res.json({ success: true, nudges });
    } catch (err: any) {
      logger.error('[AI] Nudges error:', err);
      return res.json({ success: true, nudges: [] });
    }
  })
);

// 3.6b Nudge dismiss (best-effort persistence)
router.post(
  '/nudges/:nudgeId/dismiss',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nudgeId } = req.params;
    try {
      const svc = await import('../services/ai/proactiveNudges.js');
      await (svc.default || svc.proactiveNudgesService).dismissNudge(nudgeId, req.userId!);
    } catch {
      // best-effort — dismiss tracking is optional
    }
    return res.json({ success: true });
  })
);

// 3.6c Nudge action tracking (best-effort)
router.post(
  '/nudges/:nudgeId/action',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Best-effort: track that user acted on this nudge. Can be enhanced later.
    return res.json({ success: true });
  })
);

// ==================== PHASE 4: ADVANCED AI FEATURES ====================

// 4.1 Multi-Agent Decision Room
router.post(
  '/decision-room',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, context, options } = req.body;
    if (!title || !options?.length) {
      return res.status(400).json({ error: 'Title and options are required' });
    }

    try {
      const { runDecisionRoom } = await import('../services/ai/advancedFeatures.js');
      const result = await runDecisionRoom(
        title,
        context || '',
        options,
        req.userId!,
        req.organizationId!
      );
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Decision room error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 4.2 Monte Carlo ROI Forecasting
router.post(
  '/monte-carlo',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { baseROI, capex, opex, uncertainty, iterations } = req.body;
    if (baseROI === undefined || capex === undefined) {
      return res.status(400).json({ error: 'baseROI and capex are required' });
    }

    try {
      const { runMonteCarloROI } = await import('../services/ai/advancedFeatures.js');
      const result = runMonteCarloROI(baseROI, capex, opex || 0, uncertainty, iterations);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Monte Carlo error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 4.3 Intelligent Document Import
router.post(
  '/extract-document',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, documentType } = req.body;
    if (!text) return res.status(400).json({ error: 'Document text is required' });

    try {
      const { extractDocumentData } = await import('../services/ai/advancedFeatures.js');
      const result = await extractDocumentData(
        text,
        documentType || 'general',
        req.userId!,
        req.organizationId!
      );
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Document extraction error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// 4.5 Conversational Assessment
router.post(
  '/assessment/question',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { axis, area, previousAnswers } = req.body;
    if (!axis || !area) return res.status(400).json({ error: 'Axis and area are required' });

    try {
      const { generateAssessmentQuestion } = await import('../services/ai/advancedFeatures.js');
      const result = await generateAssessmentQuestion(
        axis,
        area,
        previousAnswers || [],
        req.userId!,
        req.organizationId!
      );
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Assessment question error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.post(
  '/assessment/score',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { axis, area, answer } = req.body;
    if (!axis || !area || !answer) {
      return res.status(400).json({ error: 'Axis, area, and answer are required' });
    }

    try {
      const { mapAnswerToScore } = await import('../services/ai/advancedFeatures.js');
      const result = await mapAnswerToScore(axis, area, answer, req.userId!, req.organizationId!);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[AI] Assessment score error:', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ==================== PHASE 5: PLATFORM SERVICES ====================

// Per-tier rate limiting info
router.get(
  '/tier-limits',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { getTierLimits } = await import('../services/ai/platformServices.js');
      const tier = (req as any).subscriptionTier || 'free';
      return res.json({ success: true, tier, limits: getTierLimits(tier) });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// Token estimation
router.post(
  '/estimate-tokens',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, language } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
      const { estimateTokenCount } = await import('../services/ai/platformServices.js');
      return res.json({ success: true, estimatedTokens: estimateTokenCount(text, language) });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// Cache stats
router.get(
  '/cache-stats',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { getCacheStats } = await import('../services/ai/platformServices.js');
      return res.json({ success: true, ...getCacheStats() });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

// Industry intelligence
router.get(
  '/industry-benchmark',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const industry = (req.query.industry as string) || 'general';

    try {
      const { getIndustryBenchmark } = await import('../services/ai/platformServices.js');
      return res.json({ success: true, benchmark: getIndustryBenchmark(industry) });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

router.get(
  '/industry-benchmarks',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { getAllIndustryBenchmarks } = await import('../services/ai/platformServices.js');
      return res.json({ success: true, benchmarks: getAllIndustryBenchmarks() });
    } catch (err: any) {
      return res.status(500).json({ error: (err as Error).message });
    }
  })
);

/**
 * POST /api/ai/trigger-notification
 * Manually or programmatically trigger an AI notification
 * Used by AI pipelines to create risk, recommendation, overload, or conflict notifications
 */
router.post(
  '/trigger-notification',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = (req as any).userId || req.user?.id;
    const organizationId = (req as any).organizationId || req.user?.organizationId || 'system';

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { type, title, description, projectId, relatedObjectType, relatedObjectId, details } =
        req.body;

      if (!type || !title || !description) {
        return res.status(400).json({ error: 'type, title, and description are required' });
      }

      const ctx = {
        userId,
        organizationId,
        projectId,
        relatedObjectType,
        relatedObjectId,
      };

      let notifId: string | null = null;

      switch (type) {
        case 'AI_RISK_DETECTED':
          notifId = await triggerAIRiskDetected(ctx, {
            title,
            description,
            riskLevel: details?.riskLevel || 'medium',
            affectedEntity: details?.affectedEntity,
            recommendation: details?.recommendation,
            confidence: details?.confidence,
          });
          break;
        case 'AI_RECOMMENDATION':
          notifId = await triggerAIRecommendation(ctx, {
            title,
            description,
            impact: details?.impact,
            savings: details?.savings,
            confidence: details?.confidence,
            actionLabel: details?.actionLabel,
          });
          break;
        case 'AI_OVERLOAD_DETECTED':
          notifId = await triggerAIOverloadDetected(ctx, {
            title,
            description,
            affectedResource: details?.affectedResource || 'unknown',
            currentLoad: details?.currentLoad || 0,
            threshold: details?.threshold || 0,
            recommendation: details?.recommendation,
          });
          break;
        case 'AI_DEPENDENCY_CONFLICT':
          notifId = await triggerAIDependencyConflict(ctx, {
            title,
            description,
            conflictingEntities: details?.conflictingEntities || [],
            suggestedResolution: details?.suggestedResolution,
          });
          break;
        default:
          return res.status(400).json({
            error: `Unknown AI notification type: ${type}. Supported: AI_RISK_DETECTED, AI_RECOMMENDATION, AI_OVERLOAD_DETECTED, AI_DEPENDENCY_CONFLICT`,
          });
      }

      return res.json({ success: true, notificationId: notifId });
    } catch (err: any) {
      // Write (creates a notification) — NEVER fail-soft.
      logger.error('[AI Routes] Failed to trigger AI notification:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć powiadomienia AI',
        code: 'AI_NOTIFICATION_TRIGGER_FAILED',
      });
    }
  })
);

// ── T032: Generate Card Draft (whole-card AI authoring) ──────────────

router.post(
  '/generate-card-draft',
  verifyToken,
  validateBody(GenerateCardDraftRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { artifactType, brief, projectId, language } = req.body;
    const orgId = req.organizationId;
    const userId = req.userId;

    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
    const aiAccessCheck = await AccessPolicyService.checkAccess(orgId, 'ai_call');
    if (!aiAccessCheck.allowed) {
      return res.status(403).json({
        error: aiAccessCheck.reason || 'Access blocked',
        code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
      });
    }

    AccessPolicyService.incrementUsage(orgId, 'ai_calls', 1).catch((err: any) => {
      logger.warn('[AI CardDraft] Failed to increment ai_calls usage:', err?.message || err);
    });

    const langCode = (language || 'pl').split('-')[0];
    const langMap: Record<string, string> = {
      pl: 'Polish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    };
    const langName = langMap[langCode] || 'Polish';

    const fieldsByType: Record<string, string[]> = {
      initiative: [
        'name',
        'summary',
        'problem_statement',
        'objectives',
        'scope',
        'expected_benefits',
        'success_criteria',
        'risks_overview',
      ],
      task: ['title', 'description', 'acceptance_criteria', 'definition_of_done'],
      decision: ['title', 'context', 'options_considered', 'recommendation', 'rationale'],
    };
    const fields = fieldsByType[artifactType] || fieldsByType.initiative;

    const sys = [
      `You are a PMO content generator for a Consultify enterprise platform.`,
      `Generate a structured draft for a new ${artifactType} card based on the user's brief.`,
      `Return ONLY valid JSON with these fields: ${fields.join(', ')}.`,
      `Each field value must be plain text (no markdown, no bullets with -, use numbered lists or sentences).`,
      `Be professional, concise, and actionable. Follow enterprise PMO standards.`,
      `\n[LANGUAGE INSTRUCTION: Always respond in ${langName}.]`,
    ].join('\n');

    const userPrompt = `Brief:\n${brief}`;

    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { llmService } = await import('../services/ai/llmService.js');

    const modelCfg = await modelRouter.select({
      capability: 'chat_confirm',
      organizationId: orgId,
      tier: 'BUDGET',
    } as any);

    const result = (await llmService.callText({
      type: 'chat',
      modelConfig: {
        provider: modelCfg.provider,
        id: modelCfg.id,
        endpoint: (modelCfg as any).endpoint,
        apiKey: (modelCfg as any).apiKey,
      },
      systemPrompt: sys,
      messages: [{ role: 'user', content: userPrompt }],
      timeoutMs: 30000,
      breakerOptions: { retryAttempts: 1, retryBaseDelay: 500, retryMaxDelay: 2000 },
    } as any)) as any;

    const rawText = String(result?.content || result?.text || '').trim();

    let draft: Record<string, string> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) draft = JSON.parse(jsonMatch[0]);
    } catch {
      return res
        .status(502)
        .json({ error: 'LLM returned invalid JSON', code: 'INVALID_LLM_JSON', raw: rawText });
    }

    try {
      await dbRun(
        `INSERT INTO ai_authoring_audit (organization_id, project_id, user_id, artifact_type, action_type, input_text, output_text, was_applied, metadata)
         VALUES (?, ?, ?, ?, 'card_generate', ?, ?, 0, ?)`,
        [
          orgId,
          projectId,
          userId,
          artifactType,
          brief,
          JSON.stringify(draft),
          JSON.stringify({ fields: Object.keys(draft) }),
        ]
      );
    } catch (err: any) {
      logger.warn('[AI CardDraft] Audit insert failed:', err?.message);
    }

    return res.json({ draft, artifactType, fields: Object.keys(draft) });
  })
);

// ── T033: AI Readiness Analysis ──────────────────────────────────────

router.post(
  '/readiness-analysis',
  verifyToken,
  validateBody(AIReadinessAnalysisRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiativeId, projectId, targetGate, language } = req.body;
    const orgId = req.organizationId;

    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const AccessPolicyService = (await import('../services/accessPolicyService.js')).default as any;
    const aiAccessCheck = await AccessPolicyService.checkAccess(orgId, 'ai_call');
    if (!aiAccessCheck.allowed) {
      return res.status(403).json({
        error: aiAccessCheck.reason || 'Access blocked',
        code: aiAccessCheck.errorCode || 'ACCESS_BLOCKED',
      });
    }

    AccessPolicyService.incrementUsage(orgId, 'ai_calls', 1).catch((err: any) => {
      logger.warn('[AI Readiness] Failed to increment ai_calls usage:', err?.message || err);
    });

    const initiative = await dbGet(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

    const ini = initiative as any;

    let tasks: any[] = [];
    let risks: any[] = [];
    let decisions: any[] = [];
    try {
      tasks =
        (await dbAll(
          `SELECT id, title, status, priority FROM tasks WHERE initiative_id = ? LIMIT 50`,
          [initiativeId]
        )) || [];
      risks =
        (await dbAll(
          `SELECT id, title, type, severity, status FROM initiative_raids WHERE initiative_id = ? AND type = 'RISK' LIMIT 30`,
          [initiativeId]
        )) || [];
      decisions =
        (await dbAll(`SELECT id, title, status FROM decisions WHERE initiative_id = ? LIMIT 20`, [
          initiativeId,
        ])) || [];
    } catch {
      /* best-effort */
    }

    const langCode = (language || 'pl').split('-')[0];
    const langMap: Record<string, string> = {
      pl: 'Polish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    };
    const langName = langMap[langCode] || 'Polish';

    const currentStatus = String(ini.status || 'DRAFT').toUpperCase();
    const gate = targetGate || currentStatus;

    const sys = [
      `You are a PMO readiness analyst for Consultify. Analyze the initiative data and produce a readiness assessment.`,
      `Return ONLY valid JSON with this structure:`,
      `{ "overallScore": number (0-100), "summary": "string", "findings": [{"key": "string", "severity": "blocking"|"warning", "pass": boolean, "message": "string", "suggestedAction": "string", "suggestedActor": "string"}] }`,
      `Focus on completeness, risk coverage, stakeholder alignment, and timeline feasibility.`,
      `Be specific and actionable in your findings.`,
      `\n[LANGUAGE INSTRUCTION: Always respond in ${langName}.]`,
    ].join('\n');

    const contextData = {
      name: ini.name,
      status: currentStatus,
      targetGate: gate,
      summary: ini.summary || ini.problem_statement || '',
      objectives: ini.objectives || '',
      scope: ini.scope || '',
      sponsor: ini.sponsor_id ? 'assigned' : 'not assigned',
      ownerBusiness: ini.owner_business_id ? 'assigned' : 'not assigned',
      ownerExecution: ini.owner_execution_id ? 'assigned' : 'not assigned',
      startDate: ini.start_date || ini.planned_start_date || 'not set',
      endDate: ini.end_date || ini.planned_end_date || 'not set',
      priority: ini.priority || 'not set',
      tasksCount: tasks.length,
      tasksSummary: tasks
        .slice(0, 10)
        .map((t: any) => `${t.title} [${t.status}]`)
        .join('; '),
      risksCount: risks.length,
      risksSummary: risks
        .slice(0, 10)
        .map((r: any) => `${r.title} [${r.severity}/${r.status}]`)
        .join('; '),
      decisionsCount: decisions.length,
    };

    const userPrompt = `Analyze readiness for gate "${gate}":\n${JSON.stringify(contextData, null, 2)}`;

    const { modelRouter } = await import('../services/ai/modelRouter.js');
    const { llmService } = await import('../services/ai/llmService.js');

    const modelCfg = await modelRouter.select({
      capability: 'chat_confirm',
      organizationId: orgId,
      tier: 'BUDGET',
    } as any);

    const result = (await llmService.callText({
      type: 'chat',
      modelConfig: {
        provider: modelCfg.provider,
        id: modelCfg.id,
        endpoint: (modelCfg as any).endpoint,
        apiKey: (modelCfg as any).apiKey,
      },
      systemPrompt: sys,
      messages: [{ role: 'user', content: userPrompt }],
      timeoutMs: 30000,
      breakerOptions: { retryAttempts: 1, retryBaseDelay: 500, retryMaxDelay: 2000 },
    } as any)) as any;

    const rawText = String(result?.content || result?.text || '').trim();

    let analysis: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(502).json({ error: 'LLM returned invalid JSON', code: 'INVALID_LLM_JSON' });
    }

    return res.json({
      overallScore: Number(analysis.overallScore || 0),
      summary: String(analysis.summary || ''),
      findings: Array.isArray(analysis.findings) ? analysis.findings : [],
      gate,
      initiativeId,
    });
  })
);

// ── T032: AI Authoring Audit Log ─────────────────────────────────────

router.post(
  '/authoring-audit',
  verifyToken,
  validateBody(AIAuthoringAuditRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      artifactType,
      artifactId,
      actionType,
      fieldKey,
      inputText,
      outputText,
      wasApplied,
      wasUndone,
      metadata,
    } = req.body;

    try {
      await dbRun(
        `INSERT INTO ai_authoring_audit (organization_id, user_id, artifact_type, artifact_id, action_type, field_key, input_text, output_text, was_applied, was_undone, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orgId,
          userId,
          artifactType,
          artifactId || null,
          actionType,
          fieldKey || null,
          inputText || null,
          outputText || null,
          wasApplied ? 1 : 0,
          wasUndone ? 1 : 0,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (err: any) {
      logger.warn('[AI Authoring Audit] Insert failed:', err?.message);
      return res.status(500).json({ error: 'Failed to log audit event' });
    }

    return res.json({ success: true });
  })
);

// ==========================================
// V4-AI-01: Canonical Advisor Response Pipeline
// ==========================================

router.post(
  '/advisor/respond',
  verifyToken,
  validateBody(AdvisorRespondRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { query, conversationId, context } = req.body;
    const orgId = req.organizationId!;
    const userId = req.userId!;

    const startMs = Date.now();

    try {
      const AIOrchestrator = await getAIOrchestrator();
      const rawResult = await AIOrchestrator.processMessage(query, userId, orgId, null, {
        conversationId,
        context: context || {},
      });

      const advisorResponse = normalizeToAdvisorResponse(rawResult, {
        intent: rawResult.intent,
        purpose: context?.purpose,
      });

      advisorResponse.metadata = {
        contextArtifacts: advisorResponse.metadata?.contextArtifacts || [],
        ...advisorResponse.metadata,
        latencyMs: Date.now() - startMs,
      };

      try {
        await dbRun(
          `INSERT INTO advisor_response_log
            (organization_id, user_id, conversation_id, intent, answer_preview,
             citations_count, actions_count, questions_count, confidence,
             safety_notes_json, model, tokens_used, latency_ms, purpose, response_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orgId,
            userId,
            conversationId || null,
            advisorResponse.intent,
            advisorResponse.answer.slice(0, 500),
            advisorResponse.citations.length,
            advisorResponse.proposedActions.length,
            advisorResponse.questions.length,
            advisorResponse.confidence,
            JSON.stringify(advisorResponse.safetyNotes),
            advisorResponse.metadata?.model || null,
            advisorResponse.metadata?.tokensUsed || null,
            advisorResponse.metadata?.latencyMs || null,
            advisorResponse.metadata?.purpose || null,
            JSON.stringify(advisorResponse),
          ]
        );
      } catch (logErr: any) {
        logger.warn('[Advisor] Failed to log response:', logErr?.message);
      }

      return res.json({ success: true, data: advisorResponse });
    } catch (err: any) {
      // Advisor copilot pipeline failed. Fail-soft degrade instead of a bare 500 (H6.4):
      // return a structural, schema-valid AdvisorResponse in a degraded posture so the
      // copilot surface stays usable and the client can render an honest fallback.
      logger.error('[Advisor] respond error (fail-soft degrade):', {
        err,
        correlationId: (req as any).correlationId,
      });
      const degradedResponse = normalizeToAdvisorResponse(
        {
          intent: 'unknown',
          answer:
            'Nie udało się teraz przetworzyć zapytania doradczego. Spróbuj ponownie za chwilę lub sprawdź konfigurację providerów AI.',
          confidence: 0,
          safetyNotes: ['advisor_degraded'],
        },
        { intent: 'unknown', purpose: context?.purpose }
      );
      degradedResponse.metadata = {
        contextArtifacts: [],
        ...degradedResponse.metadata,
        latencyMs: Date.now() - startMs,
      };
      return res.json({
        success: true,
        degraded: true,
        data: degradedResponse,
        error: err?.message || 'Advisor processing failed',
      });
    }
  })
);

router.post(
  '/advisor/response/:responseId/feedback',
  verifyToken,
  validateParams(AdvisorResponseIdParamSchema),
  validateBody(AdvisorFeedbackRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { responseId } = req.params;
    const { score, text } = req.body;
    const userId = req.userId!;
    const orgId = req.organizationId!;

    const existing = await dbGet(
      `SELECT id FROM advisor_response_log WHERE id = ? AND organization_id = ?`,
      [responseId, orgId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Advisor response not found' });
    }

    await dbRun(
      `UPDATE advisor_response_log SET feedback_score = ?, feedback_text = ? WHERE id = ?`,
      [score, text || null, responseId]
    );

    return res.json({ success: true });
  })
);

router.get(
  '/advisor/responses',
  verifyToken,
  validateQuery(AdvisorResponsesQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const { conversationId, intent, limit, offset } = req.query as any;

    let sql = `SELECT id, intent, answer_preview, citations_count, actions_count,
               questions_count, confidence, model, purpose, feedback_score, created_at
               FROM advisor_response_log WHERE organization_id = ?`;
    const params: any[] = [orgId];

    if (conversationId) {
      sql += ` AND conversation_id = ?`;
      params.push(conversationId);
    }
    if (intent) {
      sql += ` AND intent = ?`;
      params.push(intent);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 20, Number(offset) || 0);

    const rows = await dbAll(sql, params);
    return res.json({ success: true, data: rows });
  })
);

router.post(
  '/advisor/response/:responseId/execute-action',
  verifyToken,
  validateParams(AdvisorResponseIdParamSchema),
  validateBody(AdvisorExecuteActionRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { responseId } = req.params;
    const { actionId } = req.body;
    const orgId = req.organizationId!;
    const userId = req.userId!;

    const row = await dbGet(
      `SELECT response_json FROM advisor_response_log WHERE id = ? AND organization_id = ?`,
      [responseId, orgId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Advisor response not found' });
    }

    let advisorResponse: any;
    try {
      advisorResponse = JSON.parse((row as any).response_json);
    } catch {
      return res.status(500).json({ error: 'Corrupted response data' });
    }

    const action = (advisorResponse.proposedActions || []).find((a: any) => a.id === actionId);
    if (!action) {
      return res.status(404).json({ error: 'Action not found in response' });
    }

    if (action.requiresApproval) {
      return res.status(403).json({ error: 'Action requires explicit approval flow' });
    }

    try {
      const actionProposalEngineMod = await import('../ai/actionProposalEngine.js');
      const executeProposedAction = (actionProposalEngineMod as any).executeProposedAction;
      if (typeof executeProposedAction !== 'function') {
        throw new Error('Proposed action executor is unavailable');
      }
      const result = await executeProposedAction({
        action,
        userId,
        organizationId: orgId,
      });
      return res.json({ success: true, data: result });
    } catch (execErr: any) {
      logger.error('[Advisor] Action execution failed:', execErr);
      return res.status(500).json({ error: execErr?.message || 'Action execution failed' });
    }
  })
);

// ==========================================
// V4-AI-03: Claim-Citation Validation
// ==========================================

const ClaimValidateRequestSchema = z.object({
  responseId: z.string().optional(),
  text: z.string().min(1),
  citations: z
    .array(
      z.object({
        id: z.string(),
        excerpt: z.string().optional(),
        startOffset: z.number().optional(),
        endOffset: z.number().optional(),
      })
    )
    .default([]),
  policy: z
    .object({
      minCoverageScore: z.number().min(0).max(1).optional(),
      requireAllFactualCited: z.boolean().optional(),
      maxUncitedClaims: z.number().int().min(0).optional(),
    })
    .optional(),
});

const ClaimExtractRequestSchema = z.object({
  text: z.string().min(1),
});

const CoverageStatsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

router.post(
  '/citations/validate',
  verifyToken,
  validateBody(ClaimValidateRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text, citations, policy } = req.body;

    const { extractClaims, matchClaimsToCitations, validateClaimCitations } =
      await import('../services/ai/claimCitationValidator.js');

    const rawClaims = extractClaims(text);
    const matched = matchClaimsToCitations(rawClaims, citations, text);
    const result = validateClaimCitations(matched, policy || {});

    return res.json({ success: true, data: result });
  })
);

router.post(
  '/citations/extract-claims',
  verifyToken,
  validateBody(ClaimExtractRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { text } = req.body;

    const { extractClaims } = await import('../services/ai/claimCitationValidator.js');
    const claims = extractClaims(text);

    return res.json({ success: true, data: { claims } });
  })
);

router.get(
  '/citations/coverage-stats',
  verifyToken,
  validateQuery(CoverageStatsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions = ['organization_id = ?'];
    const params: any[] = [orgId];

    if (from) {
      conditions.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('created_at <= ?');
      params.push(to);
    }

    const where = conditions.join(' AND ');

    try {
      const stats = await dbGet(
        `SELECT
           COUNT(*) as "totalResponses",
           AVG(CAST(citations_count AS REAL) / NULLIF(
             json_array_length(json_extract(response_json, '$.answer')), 0
           )) as "avgCoverage",
           SUM(CASE WHEN citations_count = 0 THEN 1 ELSE 0 END) as "responsesBelowThreshold"
         FROM advisor_response_log
         WHERE ${where}`,
        params
      );

      return res.json({
        success: true,
        data: {
          totalResponses: (stats as any)?.totalResponses || 0,
          avgCoverage: Math.round(((stats as any)?.avgCoverage || 0) * 100) / 100,
          responsesBelowThreshold: (stats as any)?.responsesBelowThreshold || 0,
        },
      });
    } catch (err: any) {
      logger.warn('[Citations] Coverage stats query failed:', err?.message);
      return res.json({
        success: true,
        data: { totalResponses: 0, avgCoverage: 0, responsesBelowThreshold: 0 },
      });
    }
  })
);

// -------------------- V4-AI-02: Intent routing + context pack --------------------

const IntentClassifyBodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

const IntentRouteBodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  artifactIds: z.array(z.string()).optional(),
});

const IntentRoutingLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  intent: z.string().optional(),
});

const ContextBuildBodySchema = z.object({
  intent: z.string().min(1),
  requiredContext: z.array(z.string()),
  artifactIds: z.array(z.string()).optional(),
});

const SnapshotIdParamSchema = z.object({
  id: z.string().min(1),
});

router.post(
  '/intent/classify',
  verifyToken,
  validateBody(IntentClassifyBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message } = req.body;

    const { classifyIntent, routeIntent } = await import('../services/ai/intentRouter.js');
    const { intent, confidence } = classifyIntent(message);
    const routed = await routeIntent(
      message,
      req.organizationId || req.user?.organizationId || 'unknown'
    );

    const rule = [
      { intent: 'create', contextNeeds: ['tasks', 'initiatives'] },
      { intent: 'update', contextNeeds: ['tasks', 'initiatives'] },
      { intent: 'analyze', contextNeeds: ['kpis', 'risks', 'tasks', 'initiatives'] },
      { intent: 'recommend', contextNeeds: ['tasks', 'risks', 'decisions', 'initiatives'] },
      { intent: 'compare', contextNeeds: ['initiatives', 'kpis', 'benchmarks'] },
      { intent: 'summarize', contextNeeds: ['initiatives', 'tasks', 'decisions'] },
      { intent: 'diagnose', contextNeeds: ['tasks', 'risks', 'decisions', 'signals'] },
      { intent: 'plan', contextNeeds: ['tasks', 'milestones', 'dependencies'] },
      { intent: 'explain', contextNeeds: ['knowledge'] },
      { intent: 'clarify', contextNeeds: [] },
    ].find((r) => r.intent === intent);

    return res.json({
      success: true,
      data: {
        intent,
        workflow: routed.workflow,
        confidence,
        requiredContext: rule?.contextNeeds || ['knowledge'],
      },
    });
  })
);

router.post(
  '/intent/route',
  verifyToken,
  validateBody(IntentRouteBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, conversationId, artifactIds } = req.body;
    const orgId = req.organizationId!;
    const userId = req.userId!;

    const { routeIntent } = await import('../services/ai/intentRouter.js');
    const { buildContextForIntent, saveContextSnapshot } =
      await import('../services/ai/contextPackService.js');

    const result = await routeIntent(message, orgId, { artifactIds });

    const pack = await buildContextForIntent(
      orgId,
      result.intent,
      result.requiredContext,
      artifactIds
    );
    const snapshotId = await saveContextSnapshot(pack, conversationId);

    try {
      await dbRun(
        `INSERT INTO ai_intent_routing_log
          (organization_id, user_id, message_preview, classified_intent, confidence,
           selected_tier, selected_purpose, context_snapshot_id, routing_trace_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orgId,
          userId,
          message.slice(0, 200),
          result.intent,
          result.confidence,
          result.suggestedModel.tier,
          result.suggestedModel.purpose,
          snapshotId,
          JSON.stringify(result.routingTrace),
        ]
      );
    } catch (logErr: any) {
      logger.warn('[IntentRouter] Failed to log routing decision:', logErr?.message);
    }

    return res.json({
      success: true,
      data: {
        ...result,
        contextSnapshotId: snapshotId,
        tokenEstimate: pack.metadata.tokenEstimate,
      },
    });
  })
);

router.get(
  '/intent/routing-log',
  verifyToken,
  validateQuery(IntentRoutingLogQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId!;
    const { limit, intent } = req.query as any;

    let sql = `SELECT id, user_id, message_preview, classified_intent, confidence,
                      selected_tier, selected_purpose, context_snapshot_id, created_at
               FROM ai_intent_routing_log WHERE organization_id = ?`;
    const params: any[] = [orgId];

    if (intent) {
      sql += ` AND classified_intent = ?`;
      params.push(intent);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit) || 20);

    const rows = await dbAll(sql, params);
    return res.json({ success: true, data: rows });
  })
);

router.post(
  '/context/build',
  verifyToken,
  validateBody(ContextBuildBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { intent, requiredContext, artifactIds } = req.body;
    const orgId = req.organizationId!;

    const { buildContextForIntent } = await import('../services/ai/contextPackService.js');
    const pack = await buildContextForIntent(orgId, intent, requiredContext, artifactIds);

    return res.json({ success: true, data: pack });
  })
);

router.get(
  '/context/snapshots/:id',
  verifyToken,
  validateParams(SnapshotIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.organizationId!;

    const { getContextSnapshot } = await import('../services/ai/contextPackService.js');
    const snapshot = await getContextSnapshot(id);

    if (!snapshot) {
      return res.status(404).json({ error: 'Context snapshot not found' });
    }

    if (snapshot.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({ success: true, data: snapshot });
  })
);

// ==================== V4-AI-05: Data Classification & Governance ====================

router.post(
  '/governance/classify',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { artifacts } = req.body;
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
      return res.status(400).json({ error: 'artifacts array is required' });
    }

    const { classifyAndPersist } = await import('../services/ai/dataClassificationService.js');

    const results = await Promise.all(
      artifacts.map(
        (a: { artifactType: string; artifactId: string; metadata?: Record<string, any> }) =>
          classifyAndPersist(orgId, a.artifactType, a.artifactId, a.metadata)
      )
    );

    return res.json({ success: true, data: results });
  })
);

router.post(
  '/governance/check-permission',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { artifactType, artifactId, dataClass, purpose } = req.body;
    if (!artifactType) {
      return res.status(400).json({ error: 'artifactType is required' });
    }

    const { classifyDataClass, checkPermittedSource } =
      await import('../services/ai/dataClassificationService.js');

    const resolvedClass = dataClass || classifyDataClass(artifactType);
    const result = await checkPermittedSource(orgId, artifactType, resolvedClass);

    return res.json({
      success: true,
      data: {
        artifactType,
        artifactId: artifactId || null,
        dataClass: resolvedClass,
        purpose: purpose || null,
        ...result,
      },
    });
  })
);

router.post(
  '/governance/approval-request',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { actionType, dataClass, context } = req.body;
    if (!actionType || !dataClass) {
      return res.status(400).json({ error: 'actionType and dataClass are required' });
    }

    const { createApprovalRequest } = await import('../services/ai/dataClassificationService.js');

    const request = await createApprovalRequest(orgId, userId, actionType, dataClass, context);
    return res.json({ success: true, data: request });
  })
);

router.get(
  '/governance/approval-requests',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const { listApprovalRequests } = await import('../services/ai/dataClassificationService.js');

    const requests = await listApprovalRequests(orgId, status);
    return res.json({ success: true, data: requests });
  })
);

router.post(
  '/governance/approval-requests/:id/approve',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { approveRequest } = await import('../services/ai/dataClassificationService.js');

    const result = await approveRequest(req.params.id, orgId, userId);
    if (!result) {
      return res.status(404).json({ error: 'Approval request not found or already processed' });
    }
    return res.json({ success: true, data: result });
  })
);

router.post(
  '/governance/approval-requests/:id/reject',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const { rejectRequest } = await import('../services/ai/dataClassificationService.js');

    const result = await rejectRequest(req.params.id, orgId, userId, reason);
    if (!result) {
      return res.status(404).json({ error: 'Approval request not found or already processed' });
    }
    return res.json({ success: true, data: result });
  })
);

// ==================== V4-AI-06: Budget Preflight & Status ====================

router.post(
  '/budget/preflight',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { message, intent, contextTokens } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const { preflightCostEstimate } = await import('../services/ai/preflightCostService.js');

    const estimate = await preflightCostEstimate(
      orgId,
      message,
      intent || 'chat',
      Number(contextTokens) || 0
    );

    return res.json({ success: true, data: estimate });
  })
);

router.get(
  '/budget/status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { getBudgetStatus } = await import('../services/ai/preflightCostService.js');

    const status = await getBudgetStatus(orgId);
    return res.json({ success: true, data: status });
  })
);

router.post(
  '/budget/tier-override',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = (req as any).userRole || (req as any).role;
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({ error: 'Admin role required for tier override' });
    }

    const { requestId, tier, reason } = req.body;
    if (!requestId || !tier) {
      return res.status(400).json({ error: 'requestId and tier are required' });
    }

    const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` });
    }

    try {
      await dbRun(
        `INSERT INTO ai_tier_overrides (id, organization_id, request_id, tier, reason, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuidv4(), orgId, requestId, tier, reason || null, userId]
      );
    } catch (err: any) {
      logger.warn(`[Budget] Failed to persist tier override: ${err?.message}`);
    }

    return res.json({
      success: true,
      data: { requestId, tier, reason: reason || null, overriddenBy: userId },
    });
  })
);

export default router;
