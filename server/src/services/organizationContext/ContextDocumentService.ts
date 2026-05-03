import { promises as fs } from 'node:fs';
import path from 'node:path';

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import organizationContextService from './OrganizationContextService.js';

export type ContextDocumentScope = 'project' | 'user';
export type ContextDocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'partial_ready'
  | 'ocr_required'
  | 'unreadable'
  | 'failed'
  | 'policy_blocked'
  | 'quota_blocked'
  | 'deleted';

export interface ContextDocumentRecord {
  id: string;
  organizationId: string;
  ownerId: string;
  projectId: string | null;
  scope: ContextDocumentScope;
  filename: string;
  originalName: string;
  mimeType: string | null;
  fileSizeBytes: number;
  sourceUpload: string;
  status: ContextDocumentStatus;
  processingError: string | null;
  chunkCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface UploadContextDocumentInput {
  file: Express.Multer.File;
  organizationId: string;
  ownerId: string;
  scope: ContextDocumentScope;
  projectId?: string | null;
  sourceUpload?: string;
}

interface ListContextDocumentsInput {
  organizationId: string;
  userId: string;
  scope?: 'project' | 'user' | 'all';
  projectId?: string;
  statuses?: ContextDocumentStatus[];
}

interface ProjectAccessInput {
  organizationId: string;
  userId: string;
  projectId: string;
  userRole?: string | null;
  isSuperAdmin?: boolean;
}

interface QuotaCheckFailure {
  code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED' | 'PROJECT_STORAGE_QUOTA_EXCEEDED';
  message: string;
  used: number;
  limit: number | null;
  remaining: number;
  bytesRequested: number;
  percentage: number;
}

type ContextProcessingJobStatus =
  | 'queued'
  | 'retry_scheduled'
  | 'claimed'
  | 'processing'
  | 'completed'
  | 'degraded'
  | 'failed'
  | 'dead_letter';

const CONTEXT_PROCESSOR_VERSION = 'context-document-pipeline-v1';
const CONTEXT_PROCESSOR_MAX_ATTEMPTS = 3;
const CONTEXT_WORKER_LOCK_OWNER = 'organization-context-worker';

interface ContextTextChunk {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
}

type ContextSourceLocator =
  | {
      type: 'char_range';
      startChar: number;
      endChar: number;
    }
  | {
      type: 'line_range';
      startLine: number;
      endLine: number;
      startChar: number;
      endChar: number;
    }
  | {
      type: 'sheet_range';
      sheetName: string;
      startRow: number;
      endRow: number;
      startChar: number;
      endChar: number;
    };

interface ExtractedSourceBlock {
  id: string;
  title: string;
  modality: 'text' | 'document' | 'spreadsheet';
  startChar: number;
  endChar: number;
  locator: ContextSourceLocator;
}

interface ExtractedDocumentContent {
  status: ContextDocumentStatus;
  text: string;
  error: string | null;
  sourceBlocks: ExtractedSourceBlock[];
}

interface ProcessQueuedContextDocumentJobsInput {
  limit?: number;
  recoverStaleLocks?: boolean;
  staleLockMs?: number;
}

interface ProcessQueuedContextDocumentJobsResult {
  processed: number;
  retried: number;
  deadLettered: number;
  recoveredLocks: number;
  errors: Array<{ jobId: string; documentId: string; errorCode: string }>;
}

interface ContextProcessingQueueSummary {
  adapter: 'db_ledger_v1';
  configuredBackend: 'db_ledger_v1' | 'external_queue_v1' | 'external_queue_unconfigured';
  queueBackendReady: boolean;
  queueBackendReason: string | null;
  externalQueueName: string | null;
  queueCanEnqueue: boolean;
  queueCanConsumeLocally: boolean;
  queueAdapterReason: string | null;
  schedulerEnabled: boolean;
  statusCounts: Record<string, number>;
  pendingCount: number;
  blockedCount: number;
  claimedCount: number;
  staleClaimedCount: number;
  oldestClaimedAt: string | null;
  deadLetterCount: number;
  latestDeadLetterAt: string | null;
  staleLockMs: number;
  generatedAt: string;
}

interface ScheduledContextWorkerTickResult extends ProcessQueuedContextDocumentJobsResult {
  schedulerMode: 'disabled' | 'single_tick';
  skipped: boolean;
  reason?: string;
}

interface RequeueContextProcessingJobResult {
  requeued: boolean;
  jobId: string;
  documentId: string | null;
  previousStatus: string | null;
  status: 'retry_scheduled' | null;
  reason?: string;
}

function getConfiguredContextQueueBackend():
  | 'db_ledger_v1'
  | 'external_queue_v1'
  | 'external_queue_unconfigured' {
  const raw = String(process.env.ORG_CONTEXT_QUEUE_BACKEND || 'db_ledger').toLowerCase();
  if (raw !== 'external' && raw !== 'external_queue') return 'db_ledger_v1';
  return process.env.ORG_CONTEXT_EXTERNAL_QUEUE_URL
    ? 'external_queue_v1'
    : 'external_queue_unconfigured';
}

function getContextQueueBackendReadiness(): {
  ready: boolean;
  reason: string | null;
  externalQueueName: string | null;
  canEnqueue: boolean;
  canConsumeLocally: boolean;
  adapterReason: string | null;
} {
  const backend = getConfiguredContextQueueBackend();
  if (backend === 'db_ledger_v1') {
    return {
      ready: true,
      reason: null,
      externalQueueName: null,
      canEnqueue: true,
      canConsumeLocally: true,
      adapterReason: null,
    };
  }
  if (backend === 'external_queue_v1') {
    return {
      ready: true,
      reason: null,
      externalQueueName: process.env.ORG_CONTEXT_EXTERNAL_QUEUE_NAME || 'organization-context',
      canEnqueue: true,
      canConsumeLocally: false,
      adapterReason: 'external_queue_consumer_not_implemented',
    };
  }
  return {
    ready: false,
    reason: 'external_queue_url_missing',
    externalQueueName: process.env.ORG_CONTEXT_EXTERNAL_QUEUE_NAME || 'organization-context',
    canEnqueue: false,
    canConsumeLocally: false,
    adapterReason: 'external_queue_url_missing',
  };
}

function isContextWorkerSchedulerEnabled(): boolean {
  return String(process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED || '').toLowerCase() === 'true';
}

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'context-docs');
const STATUS_VALUES: ContextDocumentStatus[] = [
  'uploaded',
  'processing',
  'ready',
  'partial_ready',
  'ocr_required',
  'unreadable',
  'failed',
  'policy_blocked',
  'quota_blocked',
  'deleted',
];

const PROJECT_PRIVILEGED_ROLES = new Set([
  'admin',
  'administrator',
  'owner',
  'superadmin',
  'manager',
  'consultant',
]);

function normalizeRole(role?: string | null): string {
  return String(role || '')
    .trim()
    .toLowerCase();
}

function hasPrivilegedProjectRole(input: Pick<ProjectAccessInput, 'userRole' | 'isSuperAdmin'>) {
  return Boolean(input.isSuperAdmin || PROJECT_PRIVILEGED_ROLES.has(normalizeRole(input.userRole)));
}

export function canonicalizeContextDocumentStatus(value: unknown): ContextDocumentStatus {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (STATUS_VALUES.includes(raw as ContextDocumentStatus)) return raw as ContextDocumentStatus;
  if (raw === 'indexed' || raw === 'complete' || raw === 'completed') return 'ready';
  if (raw === 'pending' || raw === 'queued') return 'uploaded';
  if (raw === 'error') return 'failed';
  if (raw === 'archived' || raw === 'removed') return 'deleted';
  return 'failed';
}

function expandStatusFilter(statuses: ContextDocumentStatus[]): string[] {
  const out = new Set<string>();
  for (const status of statuses) {
    out.add(status);
    if (status === 'ready') {
      out.add('indexed');
      out.add('complete');
      out.add('completed');
    }
    if (status === 'uploaded') {
      out.add('pending');
      out.add('queued');
    }
    if (status === 'failed') {
      out.add('error');
    }
    if (status === 'deleted') {
      out.add('archived');
      out.add('removed');
    }
  }
  return Array.from(out);
}

function getChunkDocumentColumns(): { deleteCondition: string; insertColumns: string[] } {
  return {
    deleteCondition: `(doc_id = ? OR document_id = ?)`,
    insertColumns: ['doc_id', 'document_id'],
  };
}

export async function recordContextStorageUsage(params: {
  organizationId: string;
  userId: string;
  documentId: string;
  projectId: string | null;
  scope: ContextDocumentScope;
  bytes: number;
  filename: string;
  sourceUpload: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO organization_context_storage_events
     (id, organization_id, user_id, document_id, project_id, scope, bytes_delta, event_type,
      source_upload, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.userId,
      params.documentId,
      params.projectId,
      params.scope,
      params.bytes,
      'context_document_uploaded',
      params.sourceUpload,
      JSON.stringify({ filename: params.filename }),
      now,
    ],
    { fallback: true } as any
  );

  try {
    const usageService = await import('../usageService.js');
    await usageService.recordStorageUsage(
      params.organizationId,
      params.bytes,
      'context_document_upload',
      {
        documentId: params.documentId,
        projectId: params.projectId,
        scope: params.scope,
        sourceUpload: params.sourceUpload,
        filename: params.filename,
      }
    );
    if (params.projectId) {
      await usageService.recordProjectStorageUsage(
        params.projectId,
        params.bytes,
        'context_document_upload'
      );
    }
  } catch (error) {
    logger.warn('[ContextDocumentService] Storage usage accounting best-effort failed:', error);
  }
}

async function createContextProcessingJob(params: {
  organizationId: string;
  userId: string;
  documentId: string;
  projectId: string | null;
  scope: ContextDocumentScope;
  sourceUpload: string;
  fileSizeBytes: number;
  mimeType: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const jobId = uuidv4();
  await dbRun(
    `INSERT INTO organization_context_processing_jobs
     (id, organization_id, user_id, document_id, project_id, scope, pipeline_type, status,
      attempt_count, processor_version, source_upload, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)`,
    [
      jobId,
      params.organizationId,
      params.userId,
      params.documentId,
      params.projectId,
      params.scope,
      'document_text_extraction',
      CONTEXT_PROCESSOR_VERSION,
      params.sourceUpload,
      JSON.stringify({
        fileSizeBytes: params.fileSizeBytes,
        mimeType: params.mimeType,
        executionMode: 'inline_worker_boundary_v1',
      }),
      now,
      now,
    ],
    { fallback: true } as any
  );
  return jobId;
}

async function markContextProcessingJobStarted(jobId: string): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE organization_context_processing_jobs
     SET status = 'processing',
         attempt_count = attempt_count + 1,
         started_at = COALESCE(started_at, ?),
         updated_at = ?
     WHERE id = ?`,
    [now, now, jobId],
    { fallback: true } as any
  );
}

async function claimContextProcessingJob(jobId: string): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE organization_context_processing_jobs
     SET status = 'claimed',
         locked_at = ?,
         locked_by = ?,
         updated_at = ?
     WHERE id = ?
       AND status IN ('queued', 'retry_scheduled')`,
    [now, CONTEXT_WORKER_LOCK_OWNER, now, jobId],
    { fallback: true } as any
  );
}

async function recoverStaleContextProcessingLocks(params: {
  staleBefore: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const staleRows = await dbAll(
    `SELECT id
     FROM organization_context_processing_jobs
     WHERE status = 'claimed'
       AND locked_at IS NOT NULL
       AND locked_at < ?
     LIMIT 100`,
    [params.staleBefore],
    { fallback: true } as any
  );
  const ids = (staleRows || []).map((row: any) => String(row.id || '')).filter(Boolean);
  for (const id of ids) {
    await dbRun(
      `UPDATE organization_context_processing_jobs
       SET status = 'retry_scheduled',
           locked_at = NULL,
           locked_by = NULL,
           error_code = COALESCE(error_code, 'stale_worker_lock_recovered'),
           error_message_safe = COALESCE(error_message_safe, 'stale_worker_lock_recovered'),
           updated_at = ?
       WHERE id = ?`,
      [now, id],
      { fallback: true } as any
    );
  }
  return ids.length;
}

async function markContextProcessingJobFinished(params: {
  jobId: string;
  status: ContextProcessingJobStatus;
  errorCode?: string | null;
  errorMessageSafe?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE organization_context_processing_jobs
     SET status = ?,
         error_code = ?,
         error_message_safe = ?,
         metadata_json = ?,
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      params.status,
      params.errorCode || null,
      params.errorMessageSafe || null,
      JSON.stringify(params.metadata || {}),
      now,
      now,
      params.jobId,
    ],
    { fallback: true } as any
  );
}

async function markContextProcessingJobRetryScheduled(params: {
  jobId: string;
  documentId: string;
  errorCode: string;
  attemptCount: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE organization_context_processing_jobs
     SET status = 'retry_scheduled',
         error_code = ?,
         error_message_safe = ?,
         metadata_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      params.errorCode,
      params.errorCode,
      JSON.stringify({
        retryPolicy: 'max_attempts_3',
        nextAttempt: params.attemptCount + 1,
        maxAttempts: CONTEXT_PROCESSOR_MAX_ATTEMPTS,
        documentId: params.documentId,
      }),
      now,
      params.jobId,
    ],
    { fallback: true } as any
  );
}

async function markContextProcessingJobDeadLetter(params: {
  jobId: string;
  documentId: string;
  errorCode: string;
  attemptCount: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE organization_context_processing_jobs
     SET status = 'dead_letter',
         error_code = ?,
         error_message_safe = ?,
         metadata_json = ?,
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      params.errorCode,
      params.errorCode,
      JSON.stringify({
        retryPolicy: 'max_attempts_3',
        attempts: params.attemptCount,
        maxAttempts: CONTEXT_PROCESSOR_MAX_ATTEMPTS,
        documentId: params.documentId,
      }),
      now,
      now,
      params.jobId,
    ],
    { fallback: true } as any
  );
  await dbRun(
    `UPDATE knowledge_docs
     SET status = 'failed',
         processing_error = ?,
         updated_at = ?
     WHERE id = ?`,
    [params.errorCode, now, params.documentId],
    { fallback: false } as any
  );
}

async function checkContextStorageQuota(params: {
  organizationId: string;
  projectId: string | null;
  bytes: number;
}): Promise<QuotaCheckFailure | null> {
  try {
    const usageService = await import('../usageService.js');
    const orgQuota = await usageService.checkQuota(params.organizationId, 'storage');
    const orgLimit = Number(orgQuota.limit || 0);
    const orgRemaining =
      orgLimit === 0 ? Number.POSITIVE_INFINITY : Number(orgQuota.remaining || 0);

    if (!orgQuota.allowed || orgRemaining < params.bytes) {
      return {
        code: 'CONTEXT_STORAGE_QUOTA_EXCEEDED',
        message: 'Organization storage quota exceeded',
        used: Number(orgQuota.used || 0),
        limit: orgLimit || null,
        remaining: Number.isFinite(orgRemaining) ? orgRemaining : 0,
        bytesRequested: params.bytes,
        percentage: Number(orgQuota.percentage || 0),
      };
    }

    if (params.projectId) {
      const projectQuota = await usageService.checkProjectQuota(params.projectId);
      const projectLimit = projectQuota.limit === null ? null : Number(projectQuota.limit || 0);
      const projectRemaining =
        projectLimit === null ? Number.POSITIVE_INFINITY : Number(projectQuota.remaining || 0);
      if (!projectQuota.allowed || projectRemaining < params.bytes) {
        return {
          code: 'PROJECT_STORAGE_QUOTA_EXCEEDED',
          message: 'Project storage quota exceeded',
          used: Number(projectQuota.used || 0),
          limit: projectLimit,
          remaining: Number.isFinite(projectRemaining) ? projectRemaining : 0,
          bytesRequested: params.bytes,
          percentage: Number(projectQuota.percentage || 0),
        };
      }
    }
  } catch (error) {
    logger.warn(
      '[ContextDocumentService] Storage quota check unavailable; upload continues:',
      error
    );
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return String(name || 'document')
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeWorkerErrorCode(error: unknown): string {
  const message = String((error as Error)?.message || error || 'worker_processing_failed');
  return message
    .replace(/[^a-zA-Z0-9:_-]+/g, '_')
    .slice(0, 120)
    .toLowerCase();
}

function createWholeDocumentBlock(params: {
  title: string;
  text: string;
  modality?: 'text' | 'document' | 'spreadsheet';
  locatorType?: 'char_range' | 'line_range';
}): ExtractedSourceBlock[] {
  const text = String(params.text || '').trim();
  if (!text) return [];
  const lineCount = Math.max(1, text.split(/\n/).length);
  const locator: ContextSourceLocator =
    params.locatorType === 'line_range'
      ? {
          type: 'line_range',
          startLine: 1,
          endLine: lineCount,
          startChar: 0,
          endChar: text.length,
        }
      : {
          type: 'char_range',
          startChar: 0,
          endChar: text.length,
        };

  return [
    {
      id: 'source-1',
      title: params.title,
      modality: params.modality || 'document',
      startChar: 0,
      endChar: text.length,
      locator,
    },
  ];
}

function shiftSourceBlocks(blocks: ExtractedSourceBlock[], offset: number): ExtractedSourceBlock[] {
  return blocks.map((block) => {
    const nextLocator = { ...block.locator } as ContextSourceLocator;
    nextLocator.startChar += offset;
    nextLocator.endChar += offset;
    return {
      ...block,
      startChar: block.startChar + offset,
      endChar: block.endChar + offset,
      locator: nextLocator,
    };
  });
}

function selectNativeLocatorForChunk(
  chunk: Pick<ContextTextChunk, 'startChar' | 'endChar'>,
  sourceBlocks: Array<{
    startChar: number;
    endChar: number;
    sourceLocator?: ContextSourceLocator;
  }>
): ContextSourceLocator | null {
  const overlapping = sourceBlocks.find(
    (block) => chunk.startChar < block.endChar && chunk.endChar > block.startChar
  );
  return overlapping?.sourceLocator || null;
}

function normalizeExtractedContent(params: {
  text: string;
  filename: string;
  mimeType: string | null;
  status: ContextDocumentStatus;
  error: string | null;
  sourceBlocks: ExtractedSourceBlock[];
}): { normalizedMd: string; normalizedJson: Record<string, unknown> } {
  const normalizedText = String(params.text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  const title = params.filename || 'Context document';
  const markdownPrefix = `# ${title}\n\n`;
  const normalizedMd = normalizedText
    ? `${markdownPrefix}${normalizedText}`
    : [`# ${title}`, '', `_No readable text extracted. Status: ${params.status}._`].join('\n');
  const normalizedSourceBlocks = normalizedText
    ? shiftSourceBlocks(params.sourceBlocks, markdownPrefix.length)
    : [];

  return {
    normalizedMd,
    normalizedJson: {
      schemaVersion: 'organization_context_normalized_v1',
      filename: title,
      mimeType: params.mimeType,
      status: params.status,
      error: params.error,
      modality: 'document',
      sections: normalizedSourceBlocks.map((block) => ({
        id: block.id,
        title: block.title,
        modality: block.modality,
        startChar: block.startChar,
        endChar: block.endChar,
        sourceLocator: block.locator,
      })),
      qualityReport: {
        extractionCoverage: normalizedText ? 1 : 0,
        degradationReasons: params.error ? [params.error] : [],
      },
    },
  };
}

function chunkText(raw: string): ContextTextChunk[] {
  const normalized = String(raw || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!normalized) return [];

  const out: ContextTextChunk[] = [];
  const maxSize = 1200;
  const overlap = 180;
  let cursor = 0;
  while (cursor < normalized.length) {
    const next = Math.min(normalized.length, cursor + maxSize);
    const fragment = normalized.slice(cursor, next).trim();
    if (fragment.length > 40) {
      const leadingWhitespace = normalized.slice(cursor, next).search(/\S/);
      const startChar = cursor + Math.max(leadingWhitespace, 0);
      out.push({
        content: fragment,
        chunkIndex: out.length,
        startChar,
        endChar: startChar + fragment.length,
      });
    }
    if (next >= normalized.length) break;
    cursor = Math.max(0, next - overlap);
  }
  return out;
}

function normalizeRecord(row: any): ContextDocumentRecord {
  const fallbackStatus = canonicalizeContextDocumentStatus(row?.status);
  return {
    id: String(row?.id || ''),
    organizationId: String(row?.organization_id || ''),
    ownerId: String(row?.owner_id || ''),
    projectId: row?.project_id ? String(row.project_id) : null,
    scope: row?.scope === 'project' ? 'project' : 'user',
    filename: String(row?.filename || ''),
    originalName: String(row?.original_name || row?.filename || ''),
    mimeType: row?.mime_type ? String(row.mime_type) : null,
    fileSizeBytes: Number(row?.file_size_bytes || 0),
    sourceUpload: String(row?.source_upload || 'documents.library'),
    status: fallbackStatus,
    processingError: row?.processing_error ? String(row.processing_error) : null,
    chunkCount: Number(row?.chunk_count || 0),
    version: Number(row?.version || 1),
    createdAt: String(row?.created_at || new Date().toISOString()),
    updatedAt: String(row?.updated_at || row?.created_at || new Date().toISOString()),
  };
}

async function extractTextFromBuffer(file: Express.Multer.File): Promise<ExtractedDocumentContent> {
  const filename = (file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();
  const originalName = file.originalname || 'document';
  try {
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      const pdfParseMod = (await import('pdf-parse')) as any;
      const pdfParse = pdfParseMod.default || pdfParseMod;
      const out = await pdfParse(file.buffer);
      const text = String(out?.text || '').trim();
      if (!text) {
        return {
          status: 'ocr_required',
          text: '',
          error: 'pdf_ocr_required_or_empty',
          sourceBlocks: [],
        };
      }
      return {
        status: 'ready',
        text,
        error: null,
        sourceBlocks: createWholeDocumentBlock({ title: originalName, text }),
      };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      const mammothMod = (await import('mammoth')) as any;
      const mammoth = mammothMod.default || mammothMod;
      const out = await mammoth.extractRawText({ buffer: file.buffer });
      const text = String(out?.value || '').trim();
      if (!text)
        return {
          status: 'unreadable',
          text: '',
          error: 'docx_empty_or_unreadable',
          sourceBlocks: [],
        };
      return {
        status: 'ready',
        text,
        error: null,
        sourceBlocks: createWholeDocumentBlock({ title: originalName, text }),
      };
    }

    if (mimeType === 'application/msword' || filename.endsWith('.doc')) {
      return {
        status: 'unreadable',
        text: '',
        error: 'legacy_doc_not_supported',
        sourceBlocks: [],
      };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls')
    ) {
      const xlsxMod = (await import('xlsx')) as any;
      const xlsx = xlsxMod.default || xlsxMod;
      const wb = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetTexts: string[] = [];
      const sourceBlocks: ExtractedSourceBlock[] = [];
      let cursor = 0;
      for (const sheetName of wb?.SheetNames || []) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const csv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false });
        const cleaned = String(csv || '').trim();
        if (!cleaned) continue;
        const segment = `# Sheet: ${sheetName}\n${cleaned}`;
        if (sheetTexts.length > 0) cursor += 2;
        const startChar = cursor;
        const endChar = startChar + segment.length;
        const rowCount = Math.max(1, cleaned.split(/\n/).length);
        sourceBlocks.push({
          id: `sheet-${sourceBlocks.length + 1}`,
          title: sheetName,
          modality: 'spreadsheet',
          startChar,
          endChar,
          locator: {
            type: 'sheet_range',
            sheetName,
            startRow: 1,
            endRow: rowCount,
            startChar,
            endChar,
          },
        });
        sheetTexts.push(segment);
        cursor = endChar;
      }
      const text = sheetTexts.join('\n\n').trim();
      if (!text)
        return {
          status: 'unreadable',
          text: '',
          error: 'spreadsheet_empty_or_unreadable',
          sourceBlocks: [],
        };
      return { status: 'ready', text, error: null, sourceBlocks };
    }

    if (
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      filename.endsWith('.ppt') ||
      filename.endsWith('.pptx')
    ) {
      return {
        status: 'unreadable',
        text: '',
        error: 'ppt_extraction_not_supported',
        sourceBlocks: [],
      };
    }

    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      filename.endsWith('.txt') ||
      filename.endsWith('.md') ||
      filename.endsWith('.markdown') ||
      filename.endsWith('.csv') ||
      filename.endsWith('.json')
    ) {
      const text = file.buffer.toString('utf8').trim();
      if (!text)
        return {
          status: 'unreadable',
          text: '',
          error: 'text_file_empty_or_unreadable',
          sourceBlocks: [],
        };
      return {
        status: 'ready',
        text,
        error: null,
        sourceBlocks: createWholeDocumentBlock({
          title: originalName,
          text,
          modality: 'text',
          locatorType: 'line_range',
        }),
      };
    }

    return { status: 'unreadable', text: '', error: 'unsupported_file_type', sourceBlocks: [] };
  } catch (err: any) {
    const message = String(err?.message || 'extraction_failed');
    if (filename.endsWith('.pdf') || mimeType === 'application/pdf') {
      const isEncrypted = /password|encrypt/i.test(message);
      return {
        status: isEncrypted ? 'unreadable' : 'ocr_required',
        text: '',
        error: isEncrypted ? 'pdf_encrypted_or_protected' : 'pdf_ocr_required_or_unreadable',
        sourceBlocks: [],
      };
    }
    return { status: 'failed', text: '', error: `extraction_failed:${message}`, sourceBlocks: [] };
  }
}

async function ensureSchema(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS knowledge_docs (
      id TEXT PRIMARY KEY,
      filename TEXT,
      filepath TEXT,
      status TEXT DEFAULT 'uploaded',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: true } as any
  );

  const alterStatements = [
    `ALTER TABLE knowledge_docs ADD COLUMN organization_id TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN project_id TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN owner_id TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN scope TEXT DEFAULT 'user'`,
    `ALTER TABLE knowledge_docs ADD COLUMN file_size_bytes INTEGER`,
    `ALTER TABLE knowledge_docs ADD COLUMN mime_type TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN original_name TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN source_upload TEXT DEFAULT 'documents.library'`,
    `ALTER TABLE knowledge_docs ADD COLUMN processing_error TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN chunk_count INTEGER DEFAULT 0`,
    `ALTER TABLE knowledge_docs ADD COLUMN version INTEGER DEFAULT 1`,
    `ALTER TABLE knowledge_docs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE knowledge_docs ADD COLUMN processed_at TIMESTAMP`,
    `ALTER TABLE knowledge_docs ADD COLUMN deleted_at TIMESTAMP`,
    `ALTER TABLE knowledge_docs ADD COLUMN tags TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN category TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN normalized_md TEXT`,
    `ALTER TABLE knowledge_docs ADD COLUMN normalized_json TEXT`,
  ];
  for (const statement of alterStatements) {
    await dbRun(statement, [], { fallback: true } as any);
  }

  await dbRun(
    `CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT,
      document_id TEXT,
      content TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      embedding TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: true } as any
  );

  await dbRun(
    `CREATE TABLE IF NOT EXISTS organization_context_storage_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      document_id TEXT NOT NULL,
      project_id TEXT,
      scope TEXT NOT NULL,
      bytes_delta INTEGER NOT NULL DEFAULT 0,
      event_type TEXT NOT NULL,
      source_upload TEXT,
      metadata_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: true } as any
  );

  await dbRun(
    `CREATE TABLE IF NOT EXISTS organization_context_processing_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      document_id TEXT NOT NULL,
      project_id TEXT,
      scope TEXT NOT NULL,
      pipeline_type TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER DEFAULT 0,
      processor_version TEXT,
      source_upload TEXT,
      error_code TEXT,
      error_message_safe TEXT,
      metadata_json TEXT,
      locked_at TIMESTAMP,
      locked_by TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: true } as any
  );

  const processingJobAlterStatements = [
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN user_id TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN project_id TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN scope TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN pipeline_type TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN status TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN attempt_count INTEGER DEFAULT 0`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN processor_version TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN source_upload TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN error_code TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN error_message_safe TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN metadata_json TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN locked_at TIMESTAMP`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN locked_by TEXT`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN started_at TIMESTAMP`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN finished_at TIMESTAMP`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE organization_context_processing_jobs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  ];
  for (const statement of processingJobAlterStatements) {
    await dbRun(statement, [], { fallback: true } as any);
  }

  const chunkAlterStatements = [
    `ALTER TABLE knowledge_chunks ADD COLUMN doc_id TEXT`,
    `ALTER TABLE knowledge_chunks ADD COLUMN document_id TEXT`,
    `ALTER TABLE knowledge_chunks ADD COLUMN chunk_index INTEGER DEFAULT 0`,
    `ALTER TABLE knowledge_chunks ADD COLUMN embedding TEXT`,
    `ALTER TABLE knowledge_chunks ADD COLUMN metadata TEXT`,
    `ALTER TABLE knowledge_chunks ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  ];
  for (const statement of chunkAlterStatements) {
    await dbRun(statement, [], { fallback: true } as any);
  }

  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org_scope_status
     ON knowledge_docs(organization_id, scope, status)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_docs_owner ON knowledge_docs(owner_id, organization_id)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON knowledge_docs(project_id, organization_id)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(doc_id)`,
    [],
    {
      fallback: true,
    } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_context_storage_events_org_doc
     ON organization_context_storage_events(organization_id, document_id)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_context_processing_jobs_org_doc
     ON organization_context_processing_jobs(organization_id, document_id)`,
    [],
    { fallback: true } as any
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_context_processing_jobs_status
     ON organization_context_processing_jobs(status, created_at)`,
    [],
    { fallback: true } as any
  );
}

async function processAcceptedContextDocument(params: {
  jobId: string;
  documentId: string;
  file: Express.Multer.File;
}): Promise<ContextDocumentRecord> {
  const docRow = await dbGet(`SELECT * FROM knowledge_docs WHERE id = ?`, [params.documentId], {
    fallback: false,
  } as any);
  if (!docRow || (docRow as any).deleted_at || (docRow as any).deletedAt) {
    throw new Error('context_document_not_processable');
  }

  const organizationId = String((docRow as any).organization_id || '');
  const ownerId = String((docRow as any).owner_id || '');
  const originalName = String(
    (docRow as any).original_name || params.file.originalname || 'document'
  );
  const mimeType = String((docRow as any).mime_type || params.file.mimetype || '');
  const safeName = sanitizeFilename(originalName);

  await markContextProcessingJobStarted(params.jobId);

  await dbRun(
    `UPDATE knowledge_docs SET status = 'processing', updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), params.documentId],
    { fallback: false } as any
  );

  const fileForExtraction = {
    ...params.file,
    originalname: originalName,
    mimetype: mimeType,
  } as Express.Multer.File;
  const extraction = await extractTextFromBuffer(fileForExtraction);
  const normalizedPackage = normalizeExtractedContent({
    text: extraction.text,
    filename: originalName || safeName,
    mimeType: mimeType || null,
    status: extraction.status,
    error: extraction.error,
    sourceBlocks: extraction.sourceBlocks,
  });

  if (extraction.status !== 'ready') {
    await dbRun(
      `UPDATE knowledge_docs
       SET status = ?, processing_error = ?, chunk_count = 0, normalized_md = ?, normalized_json = ?,
           processed_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        extraction.status,
        extraction.error,
        normalizedPackage.normalizedMd,
        JSON.stringify(normalizedPackage.normalizedJson),
        new Date().toISOString(),
        new Date().toISOString(),
        params.documentId,
      ],
      { fallback: false } as any
    );

    await organizationContextService.recordAttachmentExtraction({
      organizationId,
      userId: ownerId,
      payload: {
        docId: params.documentId,
        filename: originalName,
        mimeType,
        extractedText: '',
        totalChunks: 0,
        embeddedChunks: 0,
        error: extraction.error,
        status: extraction.status,
      },
    });

    await markContextProcessingJobFinished({
      jobId: params.jobId,
      status: extraction.status === 'failed' ? 'failed' : 'degraded',
      errorCode: extraction.error,
      errorMessageSafe: extraction.error,
      metadata: {
        extractionStatus: extraction.status,
        chunkCount: 0,
        embeddedChunks: 0,
      },
    });

    const row = await dbGet(`SELECT * FROM knowledge_docs WHERE id = ?`, [params.documentId], {
      fallback: false,
    } as any);
    return normalizeRecord(row);
  }

  const ragModule = await import('../ragService.js');
  const ragService = (ragModule.default || ragModule) as any;
  const chunks = chunkText(normalizedPackage.normalizedMd);
  let embeddedChunks = 0;
  const chunkColumns = getChunkDocumentColumns();

  await dbRun(
    `DELETE FROM knowledge_chunks WHERE ${chunkColumns.deleteCondition}`,
    [params.documentId, params.documentId],
    {
      fallback: true,
    } as any
  );
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const content = chunk.content;
    const embedding = await ragService.generateEmbedding(content);
    const nativeSourceLocator = selectNativeLocatorForChunk(
      chunk,
      normalizedPackage.normalizedJson.sections as Array<{
        startChar: number;
        endChar: number;
        sourceLocator?: ContextSourceLocator;
      }>
    );
    const metadata = {
      schemaVersion: 'organization_context_chunk_v1',
      documentId: params.documentId,
      assetVersion: 1,
      filename: originalName || safeName,
      mimeType: mimeType || null,
      modality: 'document',
      sourceLocator: {
        type: 'char_range',
        startChar: chunk.startChar,
        endChar: chunk.endChar,
      },
      nativeSourceLocator,
      chunkIndex: chunk.chunkIndex,
    };
    await dbRun(
      `INSERT INTO knowledge_chunks (id, ${chunkColumns.insertColumns.join(', ')}, content, chunk_index, embedding, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.documentId,
        params.documentId,
        content,
        chunk.chunkIndex,
        JSON.stringify(embedding || []),
        JSON.stringify(metadata),
      ],
      { fallback: false } as any
    );
    if (Array.isArray(embedding) && embedding.length > 0) embeddedChunks += 1;
  }

  await dbRun(
    `UPDATE knowledge_docs
     SET status = 'ready', processing_error = NULL, chunk_count = ?, normalized_md = ?,
         normalized_json = ?, processed_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      chunks.length,
      normalizedPackage.normalizedMd,
      JSON.stringify(normalizedPackage.normalizedJson),
      new Date().toISOString(),
      new Date().toISOString(),
      params.documentId,
    ],
    { fallback: false } as any
  );

  await organizationContextService.recordAttachmentExtraction({
    organizationId,
    userId: ownerId,
    payload: {
      docId: params.documentId,
      filename: originalName,
      mimeType,
      extractedText: extraction.text.slice(0, 12000),
      totalChunks: chunks.length,
      embeddedChunks,
      normalizedSchemaVersion: 'organization_context_normalized_v1',
      status: 'ready',
    },
  });

  await markContextProcessingJobFinished({
    jobId: params.jobId,
    status: 'completed',
    metadata: {
      extractionStatus: 'ready',
      chunkCount: chunks.length,
      embeddedChunks,
    },
  });

  const row = await dbGet(`SELECT * FROM knowledge_docs WHERE id = ?`, [params.documentId], {
    fallback: false,
  } as any);
  return normalizeRecord(row);
}

export const contextDocumentService = {
  async canAccessProject(input: ProjectAccessInput): Promise<boolean> {
    await ensureSchema();
    const project = await dbGet(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [input.projectId, input.organizationId],
      { fallback: true } as any
    );
    if (!project) return false;
    if (hasPrivilegedProjectRole(input)) return true;

    try {
      const membership = await dbGet(
        `SELECT project_id FROM project_members WHERE project_id = ? AND user_id = ?`,
        [input.projectId, input.userId],
        { fallback: false } as any
      );
      return Boolean(membership);
    } catch (error) {
      logger.warn('[ContextDocumentService] Project membership check failed closed:', error);
      return false;
    }
  },

  async uploadAndIngest(input: UploadContextDocumentInput): Promise<ContextDocumentRecord> {
    await ensureSchema();

    const scope = input.scope === 'project' ? 'project' : 'user';
    if (scope === 'project' && !input.projectId) {
      throw new Error('project_id_required_for_project_scope');
    }

    const now = new Date().toISOString();
    const safeName = sanitizeFilename(input.file.originalname || 'document');
    const docId = uuidv4();
    const sourceUpload = input.sourceUpload || 'documents.library';
    const fileSizeBytes = Number(input.file.size || input.file.buffer?.byteLength || 0);
    const projectIdForScope = scope === 'project' ? input.projectId || null : null;

    const quotaFailure = await checkContextStorageQuota({
      organizationId: input.organizationId,
      projectId: projectIdForScope,
      bytes: fileSizeBytes,
    });
    if (quotaFailure) {
      await dbRun(
        `INSERT INTO knowledge_docs
         (id, filename, filepath, status, organization_id, project_id, owner_id, scope, file_size_bytes,
          mime_type, original_name, source_upload, processing_error, chunk_count, version, created_at, updated_at)
         VALUES (?, ?, NULL, 'quota_blocked', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
        [
          docId,
          safeName,
          input.organizationId,
          projectIdForScope,
          input.ownerId,
          scope,
          fileSizeBytes,
          input.file.mimetype || null,
          input.file.originalname || safeName,
          sourceUpload,
          quotaFailure.code,
          now,
          now,
        ],
        { fallback: false } as any
      );
      const row = await dbGet(`SELECT * FROM knowledge_docs WHERE id = ?`, [docId], {
        fallback: false,
      } as any);
      throw Object.assign(new Error(quotaFailure.message), {
        status: 429,
        code: quotaFailure.code,
        document: normalizeRecord(row),
        quota: quotaFailure,
      });
    }

    const dir = path.join(UPLOAD_ROOT, input.organizationId, scope, input.projectId || 'private');
    await fs.mkdir(dir, { recursive: true });
    const finalPath = path.join(dir, `${Date.now()}-${safeName}`);
    await fs.writeFile(finalPath, input.file.buffer);

    await dbRun(
      `INSERT INTO knowledge_docs
       (id, filename, filepath, status, organization_id, project_id, owner_id, scope, file_size_bytes,
        mime_type, original_name, source_upload, processing_error, chunk_count, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 1, ?, ?)`,
      [
        docId,
        path.basename(finalPath),
        finalPath,
        'uploaded',
        input.organizationId,
        projectIdForScope,
        input.ownerId,
        scope,
        fileSizeBytes,
        input.file.mimetype || null,
        input.file.originalname || safeName,
        sourceUpload,
        now,
        now,
      ],
      { fallback: false } as any
    );

    await recordContextStorageUsage({
      organizationId: input.organizationId,
      userId: input.ownerId,
      documentId: docId,
      projectId: scope === 'project' ? input.projectId || null : null,
      scope,
      bytes: fileSizeBytes,
      filename: input.file.originalname || safeName,
      sourceUpload,
    });

    const processingJobId = await createContextProcessingJob({
      organizationId: input.organizationId,
      userId: input.ownerId,
      documentId: docId,
      projectId: projectIdForScope,
      scope,
      sourceUpload,
      fileSizeBytes,
      mimeType: input.file.mimetype || null,
    });
    return processAcceptedContextDocument({
      jobId: processingJobId,
      documentId: docId,
      file: input.file,
    });
  },

  async getContextProcessingQueueSummary(
    input: {
      organizationId?: string;
      staleLockMs?: number;
    } = {}
  ): Promise<ContextProcessingQueueSummary> {
    await ensureSchema();
    const staleLockMs = Math.max(Number(input.staleLockMs || 15 * 60 * 1000), 60 * 1000);
    const staleBefore = new Date(Date.now() - staleLockMs).toISOString();
    const statusWhere = input.organizationId ? 'WHERE organization_id = ?' : '';
    const statusParams = input.organizationId ? [input.organizationId] : [];
    const rows = await dbAll(
      `SELECT status, COUNT(*) as count
       FROM organization_context_processing_jobs
       ${statusWhere}
       GROUP BY status`,
      statusParams,
      { fallback: true } as any
    );
    const statusCounts: Record<string, number> = {};
    for (const row of rows || []) {
      const status = String((row as any).status || 'unknown');
      statusCounts[status] = Number((row as any).count || 0);
    }
    const queueBackend = getContextQueueBackendReadiness();
    const metricWhere = input.organizationId ? 'AND organization_id = ?' : '';
    const metricOrgParams = input.organizationId ? [input.organizationId] : [];
    const leaseMetrics = await dbGet(
      `SELECT
         COUNT(*) as claimed_count,
         MIN(locked_at) as oldest_claimed_at,
         SUM(CASE WHEN locked_at IS NOT NULL AND locked_at < ? THEN 1 ELSE 0 END) as stale_claimed_count
       FROM organization_context_processing_jobs
       WHERE status = 'claimed' ${metricWhere}`,
      [staleBefore, ...metricOrgParams],
      { fallback: true } as any
    );
    const deadLetterMetrics = await dbGet(
      `SELECT
         COUNT(*) as dead_letter_count,
         MAX(updated_at) as latest_dead_letter_at
       FROM organization_context_processing_jobs
       WHERE status = 'dead_letter' ${metricWhere}`,
      metricOrgParams,
      { fallback: true } as any
    );

    return {
      adapter: 'db_ledger_v1',
      configuredBackend: getConfiguredContextQueueBackend(),
      queueBackendReady: queueBackend.ready,
      queueBackendReason: queueBackend.reason,
      externalQueueName: queueBackend.externalQueueName,
      queueCanEnqueue: queueBackend.canEnqueue,
      queueCanConsumeLocally: queueBackend.canConsumeLocally,
      queueAdapterReason: queueBackend.adapterReason,
      schedulerEnabled: isContextWorkerSchedulerEnabled(),
      statusCounts,
      pendingCount: Number(statusCounts.queued || 0) + Number(statusCounts.retry_scheduled || 0),
      blockedCount: Number(statusCounts.claimed || 0) + Number(statusCounts.dead_letter || 0),
      claimedCount: Number((leaseMetrics as any)?.claimed_count || 0),
      staleClaimedCount: Number((leaseMetrics as any)?.stale_claimed_count || 0),
      oldestClaimedAt: (leaseMetrics as any)?.oldest_claimed_at
        ? String((leaseMetrics as any).oldest_claimed_at)
        : null,
      deadLetterCount: Number((deadLetterMetrics as any)?.dead_letter_count || 0),
      latestDeadLetterAt: (deadLetterMetrics as any)?.latest_dead_letter_at
        ? String((deadLetterMetrics as any).latest_dead_letter_at)
        : null,
      staleLockMs,
      generatedAt: new Date().toISOString(),
    };
  },

  async processScheduledContextDocumentWorkerTick(input: {
    enabled: boolean;
    limit?: number;
  }): Promise<ScheduledContextWorkerTickResult> {
    if (!input.enabled) {
      return {
        schedulerMode: 'disabled',
        skipped: true,
        reason: 'scheduler_disabled',
        processed: 0,
        retried: 0,
        deadLettered: 0,
        recoveredLocks: 0,
        errors: [],
      };
    }

    const result = await this.processQueuedContextDocumentJobs({
      limit: input.limit,
      recoverStaleLocks: true,
    });
    return {
      schedulerMode: 'single_tick',
      skipped: false,
      ...result,
    };
  },

  async processConfiguredContextDocumentWorkerTick(
    input: {
      limit?: number;
    } = {}
  ): Promise<ScheduledContextWorkerTickResult> {
    const queueBackend = getContextQueueBackendReadiness();
    if (!queueBackend.canConsumeLocally) {
      return {
        schedulerMode: 'disabled',
        skipped: true,
        reason: queueBackend.adapterReason || 'queue_backend_not_consumable_locally',
        processed: 0,
        retried: 0,
        deadLettered: 0,
        recoveredLocks: 0,
        errors: [],
      };
    }

    return this.processScheduledContextDocumentWorkerTick({
      enabled: isContextWorkerSchedulerEnabled(),
      limit: input.limit,
    });
  },

  async requeueDeadLetterContextProcessingJob(input: {
    organizationId: string;
    jobId: string;
    userId?: string | null;
  }): Promise<RequeueContextProcessingJobResult> {
    await ensureSchema();
    const row = await dbGet(
      `SELECT id, document_id, status
       FROM organization_context_processing_jobs
       WHERE id = ? AND organization_id = ?`,
      [input.jobId, input.organizationId],
      { fallback: true } as any
    );

    if (!row) {
      return {
        requeued: false,
        jobId: input.jobId,
        documentId: null,
        previousStatus: null,
        status: null,
        reason: 'job_not_found',
      };
    }

    const documentId = String((row as any).document_id || '');
    const previousStatus = String((row as any).status || '');
    if (previousStatus !== 'dead_letter') {
      return {
        requeued: false,
        jobId: input.jobId,
        documentId,
        previousStatus,
        status: null,
        reason: 'job_not_dead_letter',
      };
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE organization_context_processing_jobs
       SET status = 'retry_scheduled',
           attempt_count = 0,
           error_code = NULL,
           error_message_safe = NULL,
           locked_at = NULL,
           locked_by = NULL,
           started_at = NULL,
           finished_at = NULL,
           metadata_json = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'dead_letter'`,
      [
        JSON.stringify({
          requeuedFrom: 'dead_letter',
          requeuedAt: now,
          requeuedBy: input.userId || null,
          retryPolicy: `max_attempts_${CONTEXT_PROCESSOR_MAX_ATTEMPTS}`,
        }),
        now,
        input.jobId,
        input.organizationId,
      ],
      { fallback: true } as any
    );
    await dbRun(
      `UPDATE knowledge_docs
       SET status = 'uploaded',
           processing_error = NULL,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [now, documentId, input.organizationId],
      { fallback: true } as any
    );

    return {
      requeued: true,
      jobId: input.jobId,
      documentId,
      previousStatus,
      status: 'retry_scheduled',
    };
  },

  async processQueuedContextDocumentJobs(
    input: ProcessQueuedContextDocumentJobsInput = {}
  ): Promise<ProcessQueuedContextDocumentJobsResult> {
    await ensureSchema();
    const limit = Math.max(1, Math.min(Number(input.limit || 5), 25));
    const staleLockMs = Math.max(Number(input.staleLockMs || 15 * 60 * 1000), 60 * 1000);
    const staleBefore = new Date(Date.now() - staleLockMs).toISOString();
    const recoveredLocks =
      input.recoverStaleLocks === false
        ? 0
        : await recoverStaleContextProcessingLocks({ staleBefore });
    const rows = await dbAll(
      `SELECT
         j.id as job_id,
         j.document_id,
         j.attempt_count,
         d.filepath,
         d.original_name,
         d.filename,
         d.mime_type,
         d.file_size_bytes,
         d.deleted_at
       FROM organization_context_processing_jobs j
       JOIN knowledge_docs d ON d.id = j.document_id
       WHERE j.status IN ('queued', 'retry_scheduled')
         AND d.deleted_at IS NULL
       ORDER BY j.created_at ASC
       LIMIT ?`,
      [limit],
      { fallback: true } as any
    );

    const result: ProcessQueuedContextDocumentJobsResult = {
      processed: 0,
      retried: 0,
      deadLettered: 0,
      recoveredLocks,
      errors: [],
    };

    for (const row of rows || []) {
      const jobId = String((row as any).job_id || '');
      const documentId = String((row as any).document_id || '');
      const currentAttemptCount = Number((row as any).attempt_count || 0);
      try {
        if (!jobId || !documentId) {
          throw new Error('worker_job_missing_identity');
        }
        if ((row as any).deleted_at || (row as any).deletedAt) {
          throw new Error('worker_document_deleted');
        }
        await claimContextProcessingJob(jobId);
        const filepath = String((row as any).filepath || '');
        if (!filepath) {
          throw new Error('worker_document_file_missing');
        }

        const buffer = await fs.readFile(filepath);
        await processAcceptedContextDocument({
          jobId,
          documentId,
          file: {
            originalname: String((row as any).original_name || (row as any).filename || 'document'),
            filename: String((row as any).filename || ''),
            mimetype: String((row as any).mime_type || ''),
            size: Number((row as any).file_size_bytes || buffer.byteLength || 0),
            buffer,
          } as Express.Multer.File,
        });
        result.processed += 1;
      } catch (error) {
        const errorCode = safeWorkerErrorCode(error);
        const nextAttemptCount = currentAttemptCount + 1;
        result.errors.push({ jobId, documentId, errorCode });

        try {
          await markContextProcessingJobStarted(jobId);
        } catch (markError) {
          logger.warn('[ContextDocumentService] Worker could not mark job started:', markError);
        }

        if (nextAttemptCount >= CONTEXT_PROCESSOR_MAX_ATTEMPTS) {
          await markContextProcessingJobDeadLetter({
            jobId,
            documentId,
            errorCode,
            attemptCount: nextAttemptCount,
          });
          result.deadLettered += 1;
        } else {
          await markContextProcessingJobRetryScheduled({
            jobId,
            documentId,
            errorCode,
            attemptCount: nextAttemptCount,
          });
          result.retried += 1;
        }
      }
    }

    return result;
  },

  async listAccessibleDocuments(
    input: ListContextDocumentsInput
  ): Promise<ContextDocumentRecord[]> {
    await ensureSchema();
    const statuses = input.statuses?.filter((status) => STATUS_VALUES.includes(status));
    const where: string[] = [`organization_id = ?`, `deleted_at IS NULL`];
    const params: unknown[] = [input.organizationId];

    if (input.scope === 'project') {
      where.push(`scope = 'project'`);
      if (input.projectId) {
        where.push(`project_id = ?`);
        params.push(input.projectId);
      }
    } else if (input.scope === 'user') {
      where.push(`scope = 'user'`);
      where.push(`owner_id = ?`);
      params.push(input.userId);
    } else {
      const allClause: string[] = [`(scope = 'user' AND owner_id = ?)`];
      params.push(input.userId);
      if (input.projectId) {
        allClause.push(`(scope = 'project' AND project_id = ?)`);
        params.push(input.projectId);
      } else {
        allClause.push(`scope = 'project'`);
      }
      where.push(`(${allClause.join(' OR ')})`);
    }

    if (statuses && statuses.length > 0) {
      const statusFilter = expandStatusFilter(statuses);
      where.push(`status IN (${statusFilter.map(() => '?').join(',')})`);
      params.push(...statusFilter);
    }

    const rows = await dbAll(
      `SELECT * FROM knowledge_docs
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 500`,
      params,
      { fallback: true } as any
    );
    return (rows || [])
      .filter((row: any) => !row?.deleted_at && !row?.deletedAt)
      .map(normalizeRecord);
  },

  async getDocumentForAccess(params: {
    documentId: string;
    organizationId: string;
    userId: string;
  }): Promise<ContextDocumentRecord | null> {
    await ensureSchema();
    const row = await dbGet(
      `SELECT * FROM knowledge_docs
       WHERE id = ?
         AND organization_id = ?
         AND deleted_at IS NULL
         AND (scope = 'project' OR (scope = 'user' AND owner_id = ?))`,
      [params.documentId, params.organizationId, params.userId],
      { fallback: true } as any
    );
    if (!row || (row as any).deleted_at || (row as any).deletedAt) {
      return null;
    }
    return normalizeRecord(row);
  },

  async moveToProject(params: {
    documentId: string;
    organizationId: string;
    userId: string;
    projectId: string;
  }): Promise<ContextDocumentRecord | null> {
    await ensureSchema();
    await dbRun(
      `UPDATE knowledge_docs
       SET scope = 'project', project_id = ?, updated_at = ?
       WHERE id = ?
         AND organization_id = ?
         AND scope = 'user'
         AND owner_id = ?
         AND deleted_at IS NULL`,
      [
        params.projectId,
        new Date().toISOString(),
        params.documentId,
        params.organizationId,
        params.userId,
      ],
      { fallback: false } as any
    );
    return this.getDocumentForAccess({
      documentId: params.documentId,
      organizationId: params.organizationId,
      userId: params.userId,
    });
  },

  async softDelete(params: {
    documentId: string;
    organizationId: string;
    userId: string;
  }): Promise<boolean> {
    await ensureSchema();
    const result = await dbRun(
      `UPDATE knowledge_docs
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?
         AND organization_id = ?
         AND (scope = 'project' OR (scope = 'user' AND owner_id = ?))
         AND deleted_at IS NULL`,
      [
        new Date().toISOString(),
        new Date().toISOString(),
        params.documentId,
        params.organizationId,
        params.userId,
      ],
      { fallback: false } as any
    );
    return Number((result as any)?.changes || 0) > 0;
  },
};

export default contextDocumentService;
