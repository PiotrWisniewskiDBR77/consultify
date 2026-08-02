/**
 * Finance Statements Routes — T050 (Ingestion) + T051 (Ratio Analysis)
 *
 * Endpoints:
 *   POST   /upload              — Upload financial statement PDF
 *   POST   /:id/detect          — Auto-detect statement type, period, currency
 *   POST   /:id/extract         — Extract financial lines from text
 *   POST   /:id/map             — Auto-map lines to canonical categories
 *   PUT    /:id/values          — Save/update mapped values (manual corrections)
 *   POST   /:id/validate        — Run validation checks
 *   POST   /:id/confirm         — Confirm and finalize statement
 *   GET    /                    — List statements for org
 *   GET    /:id                 — Get statement with values
 *   DELETE /:id                 — Delete draft statement
 *   GET    /canonical-lines     — Get canonical line definitions
 *
 *   GET    /:id/ratios          — Compute and return ratios for a statement
 *   POST   /ratios/growth       — Compute growth ratios (two periods)
 *   GET    /ratios/catalog      — Get ratio definitions catalog
 *   GET    /benchmarks          — Get org benchmarks
 *   PUT    /benchmarks          — Upsert benchmark
 *
 *   -- F5 engine→route wiring (additive, `_KONCEPT_FINANCE_2026-07-10.md`) --
 *   POST   /packs/:id/report-section                       — publish finance report section snapshot (now returns envelope+lineage)
 *   GET    /packs/:id/reconcile-summary                    — persisted R1-R8 result (UI badge)
 *   GET    /packs/:id/report-section/lineage                — #82g jawny LINEAGE (skąd/przez co/założenia), live, bez publikacji
 *   GET    /aggregate-scope/initiatives/:initiativeId/delta — A2 initiative pro-forma delta
 *   GET    /packs/:id/aggregate-scope/portfolio             — A3 portfolio aggregate (A1 + ΣA2)
 */

import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { sniffFileSignature } from '../middleware/fileUpload.middleware.js';
import { upload } from '../middleware/fileUpload.middleware.js';
import {
  searchStatementDocumentIntelligence,
  upsertStatementDocumentIntelligence,
} from '../services/documentIntelligenceService.js';
import {
  computeInitiativeDeltaForOrg,
  computePortfolioAggregateForPack,
} from '../services/financeAggregateScopeService.js';
import { ensureCanonicalRegistryInDatabase } from '../services/financeCanonicalRegistrySyncService.js';
import {
  serializeRowPeriodFields,
  serializeRowsPeriodFields,
} from '../services/financePeriodFormat.js';
import {
  getFinanceTraceId,
  logFinanceError,
  logFinanceEvent,
  summarizeTextPayload,
} from '../services/financeDiagnosticsService.js';
import {
  assessCoverage,
  classifyMappingTier,
  isLikelySubtotalOrAggregate,
  isNonFinancialByPolicy,
} from '../services/financeMappingPolicy.js';
import {
  FinanceReportReconcileBlockedError,
  loadFinanceReportLineageForPack,
  loadReconcileSummaryForPack,
  publishFinanceReportSectionSnapshot,
} from '../services/financeReportSectionService.js';
import { buildStatementAnalytics } from '../services/financeStatementAnalyticsService.js';
import {
  assignStatementToExistingPack,
  detachStatementFromPack,
  getStatementPackDetail,
  listStatementPacks,
  recomputeStatementPackForOrganization,
  syncStatementToPack,
} from '../services/financialStatementPackService.js';
import type { DetectionResult } from '../services/financialStatementService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  confirmStatement,
  createStatement,
  detectContainedStatementTypes,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  getLatestStatementIngestRun,
  learnStatementAliases,
  loadLatestStatementVersionSnapshot,
  loadPersistedStatementCandidateRows,
  loadStatementSourceText,
  locateStatementSections,
  openStatementRepairSession,
  persistStatementCandidateRows,
  persistStatementExtractedSections,
  persistStatementMappingCandidates,
  persistStatementValidationLedger,
  persistStatementValueEvidence,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  runCfoAutoValidation,
  saveStatementValues,
  snapshotCanonicalStatementVersion,
  snapshotStatementValueVersion,
  startStatementIngestRun,
  updateStatementIngestRun,
  updateStatementMetadata,
  updateStatementReadinessState,
  updateStatementStatus,
  validateStatement,
} from '../services/financialStatementService.js';
import { saveStatementValuesFlow } from '../services/financialStatementValueWriteService.js';
import {
  applyLlmProposals,
  applySecondPassProposals,
  mapDuplicateConflictLinesWithLLM,
  mapUnmappedLinesWithLLM,
} from '../services/llmFinancialMappingService.js';
import {
  analyzeAndExtractFullDocument,
  extractFinancialLinesWithAnthropic,
  extractFinancialLinesWithOpenAI,
} from '../services/openAIFinancialExtractionService.js';
import PDFParserService from '../services/pdfParserService.js';
import {
  computeGrowthRatios,
  computeRatios,
  getBenchmarks,
  getRatioCatalog,
  upsertBenchmark,
} from '../services/ratioAnalysisService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

function normalizeStatementTypeInput(value: unknown): 'P&L' | 'BS' | 'CF' | null {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'PL' || normalized === 'P&L') return 'P&L';
  if (normalized === 'BS') return 'BS';
  if (normalized === 'CF') return 'CF';
  return null;
}

interface AuthRequest extends Request {
  // Set by auth middleware (authoritative)
  organizationId?: string;
  userId?: string;
  // Also set by auth middleware; may not always include org for superadmin/impersonation flows
  user?: { id: string; organizationId?: string };
}

function getOrgId(req: AuthRequest): string | undefined {
  const raw = String(req.organizationId || req.user?.organizationId || '').trim();
  return raw.length > 0 ? raw : undefined;
}

function getUserId(req: AuthRequest): string | undefined {
  const raw = String(req.user?.id || req.userId || '').trim();
  return raw.length > 0 ? raw : undefined;
}

function isSchemaCompatError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('no such column') ||
    message.includes('no such table') ||
    message.includes('undefined column')
  );
}

const DB_ALLOWED_PARSE_METHODS = new Set(['text_extraction', 'ocr', 'manual']);

// ════════════════════════════════════════════════
// FIN-005: Upload idempotency
// ════════════════════════════════════════════════

const MAX_IDEMPOTENCY_KEY_CHARS = 200;

/** Read a client-supplied idempotency key from header or body, bounded and trimmed. */
function getIdempotencyKey(req: AuthRequest): string | null {
  const headerRaw = req.headers?.['idempotency-key'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const bodyRaw = (req.body as Record<string, unknown> | undefined)?.idempotencyKey;
  const raw = String(header || bodyRaw || '').trim();
  if (!raw) return null;
  return raw.slice(0, MAX_IDEMPOTENCY_KEY_CHARS);
}

/**
 * Look up a previously-recorded upload response for this org+key. Returns
 * null if none exists OR if the idempotency table isn't present yet
 * (schema-compat fallback — never blocks upload on a missing optional
 * table).
 */
async function findIdempotentUpload(
  organizationId: string,
  idempotencyKey: string
): Promise<{ statusCode: number; responseJson: string } | null> {
  try {
    const rows = await dbAll<{ status_code: number; response_json: string }>(
      `SELECT status_code, response_json FROM financial_statement_upload_idempotency
       WHERE organization_id = ? AND idempotency_key = ? LIMIT 1`,
      [organizationId, idempotencyKey]
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return null;
    return { statusCode: Number(row.status_code) || 201, responseJson: String(row.response_json) };
  } catch (error) {
    if (isSchemaCompatError(error)) return null;
    throw error;
  }
}

/** Best-effort record of a successful upload response, keyed by org+idempotency key. */
async function recordIdempotentUpload(params: {
  organizationId: string;
  idempotencyKey: string;
  statementId: string;
  statusCode: number;
  responseJson: string;
  createdBy?: string;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO financial_statement_upload_idempotency
        (id, organization_id, idempotency_key, statement_id, status_code, response_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `fsui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        params.organizationId,
        params.idempotencyKey,
        params.statementId,
        params.statusCode,
        params.responseJson,
        params.createdBy || null,
      ],
      { fallback: false }
    );
  } catch (error) {
    // Best-effort: a failure to RECORD the idempotency marker must never
    // fail the (already-successful) upload itself. A missing/incompatible
    // table just means this specific retry-dedup doesn't apply this time.
    if (!isSchemaCompatError(error)) {
      logger.warn(`[FinanceStatements] Failed to record upload idempotency marker: ${error}`);
    }
  }
}

async function ensureIngestRun(params: {
  statementId: string;
  organizationId?: string;
  createdBy?: string;
  sourceFileName?: string;
  sourceFilePath?: string;
  parseMethod?: string;
  documentClass?: string;
  extractionStrategy?: string;
  templateFamily?: string | null;
  rawTextLength?: number;
}): Promise<string | null> {
  const existingRunId = await getLatestStatementIngestRun(params.statementId);
  if (existingRunId) return existingRunId;
  if (!params.organizationId) return null;
  return startStatementIngestRun({
    statementId: params.statementId,
    organizationId: params.organizationId,
    sourceFileName: params.sourceFileName,
    sourceFilePath: params.sourceFilePath,
    parseMethod: params.parseMethod,
    documentClass: params.documentClass,
    extractionStrategy: params.extractionStrategy,
    templateFamily: params.templateFamily,
    rawTextLength: params.rawTextLength,
    createdBy: params.createdBy,
  });
}

function parseJsonArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

// ════════════════════════════════════════════════
// T050: Financial Statement Ingestion
// ════════════════════════════════════════════════

// Pathological-workbook guard (FIN-005): a small compressed .xlsx can still
// decompress into a huge sheet grid. These caps are generous for any real
// financial statement (which is a handful of sheets and a few hundred rows)
// while bounding the worst case. Not a full pre-decompression zip-bomb
// defense (SheetJS doesn't expose central-directory sizes before parsing) —
// see FIN-005 report for the documented residual risk.
const MAX_XLSX_SHEETS = 200;
const MAX_XLSX_CELLS = 500_000;

// CSV decode guard (FIN-005): cap how much we'll ever try to decode/scan for
// delimiter detection, independent of the 10 MB upload cap enforced by
// fileUpload.middleware — defense in depth if that cap is ever changed.
const MAX_CSV_BYTES = 10 * 1024 * 1024;

/**
 * Decode an uploaded CSV buffer into text, handling the encoding/delimiter
 * variants common in real-world (especially Polish-locale) exports:
 *  - UTF-8 BOM (EF BB BF) — stripped.
 *  - UTF-16 LE/BE BOM — decoded properly instead of read as UTF-8 garbage.
 *  - Windows-1250 (cp1250) — common for older Polish accounting software
 *    exports; detected by re-checking for the U+FFFD replacement character
 *    that a genuine UTF-8 decode of cp1250 bytes produces, then re-decoded
 *    via the platform's built-in `TextDecoder('windows-1250')`.
 * Delimiter (comma vs semicolon — semicolon is the norm for Polish-locale
 * Excel CSV exports since a comma is the decimal separator there) is left to
 * the downstream extractor, which tokenizes on whitespace/number boundaries
 * rather than a fixed delimiter — this function's job is only to get the
 * BYTES turned into correct TEXT.
 */
function decodeCsvBuffer(buffer: Buffer): string {
  const bounded = buffer.subarray(0, MAX_CSV_BYTES);

  // UTF-16 BOM checks first — decoding UTF-16 bytes as UTF-8/cp1250 would be
  // silently wrong rather than throwing.
  if (bounded.length >= 2 && bounded[0] === 0xff && bounded[1] === 0xfe) {
    return bounded.subarray(2).toString('utf16le');
  }
  if (bounded.length >= 2 && bounded[0] === 0xfe && bounded[1] === 0xff) {
    // UTF-16 BE: swap byte pairs, then decode as LE (Node has no native BE decoder).
    const swapped = Buffer.alloc(bounded.length - 2);
    for (let i = 2; i + 1 < bounded.length; i += 2) {
      swapped[i - 2] = bounded[i + 1];
      swapped[i - 1] = bounded[i];
    }
    return swapped.toString('utf16le');
  }

  // UTF-8 BOM (EF BB BF) — strip before decoding.
  const hasUtf8Bom =
    bounded.length >= 3 && bounded[0] === 0xef && bounded[1] === 0xbb && bounded[2] === 0xbf;
  const withoutBom = hasUtf8Bom ? bounded.subarray(3) : bounded;

  const utf8Text = withoutBom.toString('utf-8');
  // A genuine UTF-8 decode of non-UTF-8 bytes (e.g. real Windows-1250) always
  // produces U+FFFD replacement characters where multi-byte sequences don't
  // form valid UTF-8. A real UTF-8 file legitimately containing U+FFFD is
  // vanishingly rare in a financial export, so this is a safe, cheap signal.
  if (utf8Text.includes('�')) {
    try {
      const decoder = new TextDecoder('windows-1250');
      return decoder.decode(withoutBom);
    } catch {
      // Platform lacks the windows-1250 decoder (shouldn't happen on modern
      // Node with full-icu) — fall back to the UTF-8 read rather than throw.
      return utf8Text;
    }
  }
  return utf8Text;
}

async function extractTextFromFile(
  filePath: string,
  originalName: string
): Promise<{ text: string; parseMethod: string }> {
  const ext = (originalName || '').toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') {
    const text = await PDFParserService.extractText(filePath);
    return { text, parseMethod: 'text_extraction' };
  }
  if (ext === 'csv') {
    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    const text = decodeCsvBuffer(buffer);
    return { text, parseMethod: 'csv_import' };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const fs = await import('fs');
      const XLSX = await import('xlsx');
      const buffer = fs.readFileSync(filePath);

      // Zip-bomb / pathological-workbook guard, BEFORE the full parse below.
      // `bookSheets: true` is a lightweight SheetJS peek that returns sheet
      // names without parsing cell content, so it's cheap even on a
      // maliciously crafted archive.
      const peek = XLSX.read(buffer, { type: 'buffer', bookSheets: true });
      if (peek.SheetNames.length > MAX_XLSX_SHEETS) {
        throw new Error(
          `Workbook has ${peek.SheetNames.length} sheets, exceeding the ${MAX_XLSX_SHEETS}-sheet safety limit`
        );
      }

      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      let totalCells = 0;
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const ref = ws?.['!ref'];
        if (!ref) continue;
        const range = XLSX.utils.decode_range(ref);
        const rows = range.e.r - range.s.r + 1;
        const cols = range.e.c - range.s.c + 1;
        totalCells += Math.max(0, rows) * Math.max(0, cols);
        if (totalCells > MAX_XLSX_CELLS) {
          throw new Error(
            `Workbook cell count exceeds the ${MAX_XLSX_CELLS.toLocaleString('en-US')}-cell safety limit`
          );
        }
      }

      const skipSheetPattern =
        /^(cover|okładka|spis\s+treści|table\s+of\s+contents|notes|noty|index|summary|disclaimer|info)$/i;

      const financialSheetPattern =
        /bilans|balance|p&l|profit|loss|income|zysk|strat|cash\s*flow|przepływ|rachunek|statement|sprawozdanie|bs\b|pl\b|cf\b|aktywa|pasywa|equity|kapitał/i;

      const rankedSheets: Array<{ name: string; priority: number; csv: string }> = [];

      for (const sheetName of wb.SheetNames) {
        if (skipSheetPattern.test(sheetName.trim())) continue;

        const ws = wb.Sheets[sheetName];
        if (!ws || !ws['!ref']) continue;

        const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false });
        const lineCount = csv.split('\n').filter((l: string) => l.trim().length > 0).length;
        if (lineCount < 3) continue;

        const numericPattern = /\d{1,3}[,. \u00A0]\d{3}/;
        const numericLines = csv.split('\n').filter((l: string) => numericPattern.test(l)).length;

        let priority = numericLines;
        if (financialSheetPattern.test(sheetName)) priority += 200;
        if (numericLines > 5) priority += 50;

        rankedSheets.push({ name: sheetName, priority, csv });
      }

      rankedSheets.sort((a, b) => b.priority - a.priority);

      const lines: string[] = [];
      for (const sheet of rankedSheets) {
        lines.push(`=== Sheet: ${sheet.name} ===`);
        const cleanedLines = sheet.csv
          .split('\n')
          .filter((l: string) => l.trim().length > 0)
          .filter((l: string) => !/^\t+$/.test(l));
        lines.push(...cleanedLines);
      }

      return { text: lines.join('\n'), parseMethod: 'excel_import' };
    } catch (e: any) {
      throw new Error(`Excel parsing failed: ${e?.message}`);
    }
  }
  throw new Error(`Unsupported file format: ${ext}`);
}

router.post(
  '/upload',
  verifyToken,
  isAuthenticated,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const orgId = getOrgId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required (PDF, XLSX, XLS, or CSV)' });
    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
    const traceId = getFinanceTraceId((req as any).correlationId);

    // FIN-005: idempotency — a retry with the same org + Idempotency-Key
    // returns the ORIGINAL response instead of creating a second statement
    // (and, by extension, a second pack).
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const existing = await findIdempotentUpload(orgId, idempotencyKey);
      if (existing) {
        logFinanceEvent('statement.upload.idempotent_replay', {
          traceId,
          organizationId: orgId,
          idempotencyKey,
        });
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(existing.statusCode).json(JSON.parse(existing.responseJson));
      }
    }

    // FIN-005: verify the saved file's first bytes actually match its
    // declared extension — fileFilter only checked the client-supplied MIME
    // header, which the client fully controls.
    const ext = (file.originalname || '').toLowerCase().split('.').pop() || '';
    try {
      const fsSniff = await import('fs');
      const headBuffer = fsSniff.readFileSync(file.path).subarray(0, 4096);
      if (!sniffFileSignature(headBuffer, ext)) {
        try {
          fsSniff.unlinkSync(file.path);
        } catch {
          // best-effort cleanup; the mismatch rejection is what matters
        }
        logFinanceError('statement.upload.signature_mismatch', new Error('signature mismatch'), {
          traceId,
          fileName: file.originalname,
          ext,
        });
        return res.status(422).json({
          error: 'File content does not match its declared type',
          code: 'FILE_UPLOAD_SIGNATURE_MISMATCH',
        });
      }
    } catch (sniffError: any) {
      logFinanceError('statement.upload.signature_check_failed', sniffError, {
        traceId,
        fileName: file.originalname,
      });
      return res.status(422).json({ error: 'Unable to verify uploaded file', detail: sniffError?.message });
    }

    await ensureCanonicalRegistryInDatabase();

    logFinanceEvent('statement.upload.started', {
      traceId,
      organizationId: orgId,
      userId,
      fileName: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    });

    let text: string;
    let parseMethod: string;
    try {
      const result = await extractTextFromFile(file.path, file.originalname);
      // Strip null bytes — Postgres TEXT columns reject 0x00
      text = result.text.replace(/\0/g, '');
      parseMethod = result.parseMethod;
    } catch (e: any) {
      logFinanceError('statement.upload.extract_failed', e, {
        traceId,
        fileName: file.originalname,
        sizeBytes: file.size,
      });
      return res.status(422).json({ error: 'File extraction failed', detail: e?.message });
    }

    // Backward-compatible DB constraint (older DBs allow only 3 values).
    // Keep the real parse method inside notes for traceability.
    const effectiveParseMethod = DB_ALLOWED_PARSE_METHODS.has(parseMethod) ? parseMethod : 'manual';
    const notesPrefix =
      parseMethod === effectiveParseMethod ? '' : `[parse_method:${parseMethod}]\n`;
    const textSummary = summarizeTextPayload(text);

    logFinanceEvent('statement.upload.extracted', {
      traceId,
      fileName: file.originalname,
      parseMethod,
      effectiveParseMethod,
      text: textSummary,
    });

    const detection = detectStatementType(text);
    const containedStatementTypes = detectContainedStatementTypes(text);
    const columnSelection = resolveStatementColumnSelection(text, detection);
    const documentProfile = classifyStatementDocument({
      fileName: file.originalname,
      parseMethod: effectiveParseMethod,
      text,
    });

    const statementId = await createStatement({
      organizationId: orgId,
      statementType: detection.statementType === 'UNKNOWN' ? 'P&L' : detection.statementType,
      periodStart: detection.periodStart || new Date().getFullYear() + '-01-01',
      periodEnd: detection.periodEnd || new Date().getFullYear() + '-12-31',
      periodLabel: detection.periodLabel || undefined,
      currency: detection.currency,
      scaling: detection.scaling,
      sourceFileName: file.originalname,
      sourceFilePath: file.path,
      parseMethod: effectiveParseMethod,
      overallConfidence: detection.confidence,
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      createdBy: userId,
    });
    const statementPackId = await syncStatementToPack(statementId);
    const ingestRunId = await startStatementIngestRun({
      statementId,
      organizationId: orgId,
      sourceFileName: file.originalname,
      sourceFilePath: file.path,
      parseMethod: effectiveParseMethod,
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
      summary: {
        detection,
        documentProfile,
        columnSelection,
        parseMethod,
        effectiveParseMethod,
      },
      createdBy: userId,
    });

    logFinanceEvent('statement.upload.detected', {
      traceId,
      statementId,
      statementType: detection.statementType,
      periodStart: detection.periodStart,
      periodEnd: detection.periodEnd,
      currency: detection.currency,
      scaling: detection.scaling,
      confidence: detection.confidence,
    });

    const notesRes = await dbRun(
      `UPDATE financial_statements SET notes = ? WHERE id = ?`,
      [`${notesPrefix}${text.substring(0, 100000)}`, statementId],
      { fallback: false }
    );
    if (!notesRes?.success) {
      logFinanceError('statement.upload.persist_failed', notesRes?.error, {
        traceId,
        statementId,
        fileName: file.originalname,
        notesLength: `${notesPrefix}${text.substring(0, 100000)}`.length,
        text: textSummary,
      });
      return res.status(500).json({
        error: 'Failed to persist extracted text',
        detail: notesRes?.error || 'unknown',
      });
    }
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'raw_text',
      stage: 'upload',
      contentText: text,
      metadata: {
        parseMethod,
        effectiveParseMethod,
        sourceFileName: file.originalname,
        sizeBytes: file.size,
      },
      createdBy: userId,
    });
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'document_profile',
      stage: 'upload',
      contentJson: {
        detection,
        documentProfile,
        columnSelection,
        parseMethod,
        effectiveParseMethod,
      },
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'upload',
      runStatus: 'running',
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
    });
    try {
      await upsertStatementDocumentIntelligence({
        statementId,
        ingestRunId,
        organizationId: orgId,
        title: file.originalname,
        text,
        statementType: detection.statementType,
        documentClass: documentProfile.documentClass,
        templateFamily: documentProfile.templateFamily,
      });
    } catch (error) {
      logFinanceError('statement.document_intelligence.index_failed', error, {
        traceId,
        statementId,
        ingestRunId,
      });
    }

    logFinanceEvent('statement.upload.completed', {
      traceId,
      statementId,
      fileName: file.originalname,
      parseMethod,
      effectiveParseMethod,
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      text: textSummary,
    });

    await recordStatementQualityRun({
      statementId,
      organizationId: orgId,
      stage: 'upload',
      resultStatus: detection.statementType === 'UNKNOWN' ? 'warning' : 'pass',
      readinessStatus: 'pending',
      strategy: documentProfile.extractionStrategy,
      summary:
        detection.statementType === 'UNKNOWN'
          ? 'Upload completed with unknown statement type fallback.'
          : 'Upload completed and initial document profile detected.',
      reasonCodes:
        detection.statementType === 'UNKNOWN'
          ? ['DETECTION_UNKNOWN_FALLBACK']
          : ['UPLOAD_COMPLETE'],
      payload: {
        detection,
        documentProfile,
        columnSelection,
        parseMethod,
        effectiveParseMethod,
      },
      createdBy: userId,
    });

    logger.info(
      `[FinanceStatements] Uploaded ${file.originalname} (${parseMethod}) → statement ${statementId} type=${detection.statementType}`
    );

    const responseBody = {
      success: true,
      statementId,
      statementPackId,
      ingestRunId,
      detection,
      columnSelection,
      textLength: text.length,
      parseMethod,
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
    };

    if (idempotencyKey) {
      await recordIdempotentUpload({
        organizationId: orgId,
        idempotencyKey,
        statementId,
        statusCode: 201,
        responseJson: JSON.stringify(responseBody),
        createdBy: userId,
      });
    }

    res.status(201).json(responseBody);
  })
);

// ════════════════════════════════════════════════
// Smart Upload: Upload + LLM Full Document Analysis + Multi-Statement Pack
// One PDF → LLM analyzes everything → creates pack with P&L + BS + CF
// ════════════════════════════════════════════════

router.post(
  '/upload-and-analyze',
  verifyToken,
  isAuthenticated,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required (PDF, XLSX, XLS, or CSV)' });
    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
    const traceId = getFinanceTraceId((req as any).correlationId);

    await ensureCanonicalRegistryInDatabase();

    // 1. Extract text (for fallback and notes)
    let text: string;
    let parseMethod: string;
    try {
      const result = await extractTextFromFile(file.path, file.originalname);
      text = result.text.replace(/\0/g, '');
      parseMethod = result.parseMethod;
    } catch (e: any) {
      return res.status(422).json({ error: 'File extraction failed', detail: e?.message });
    }

    const effectiveParseMethod = DB_ALLOWED_PARSE_METHODS.has(parseMethod) ? parseMethod : 'manual';

    logFinanceEvent('statement.smartUpload.started', {
      traceId,
      organizationId: orgId,
      userId,
      fileName: file.originalname,
      sizeBytes: file.size,
    });

    // 2. LLM analyzes entire document — finds all sections, extracts all lines
    const analysis = await analyzeAndExtractFullDocument({
      filePath: file.path,
      fileName: file.originalname,
      traceId,
    });

    if (!analysis || analysis.sections.length === 0) {
      // Fallback: create single statement with heuristic detection (old behavior)
      const detection = detectStatementType(text);
      const documentProfile = classifyStatementDocument({
        fileName: file.originalname,
        parseMethod: effectiveParseMethod,
        text,
      });
      const statementId = await createStatement({
        organizationId: orgId,
        statementType: detection.statementType === 'UNKNOWN' ? 'P&L' : detection.statementType,
        periodStart: detection.periodStart || new Date().getFullYear() + '-01-01',
        periodEnd: detection.periodEnd || new Date().getFullYear() + '-12-31',
        periodLabel: detection.periodLabel || undefined,
        currency: detection.currency,
        scaling: detection.scaling,
        sourceFileName: file.originalname,
        sourceFilePath: file.path,
        parseMethod: effectiveParseMethod,
        overallConfidence: detection.confidence,
        documentClass: documentProfile.documentClass,
        extractionStrategy: documentProfile.extractionStrategy,
        templateFamily: documentProfile.templateFamily,
        createdBy: userId,
      });
      const statementPackId = await syncStatementToPack(statementId);
      await dbRun(
        `UPDATE financial_statements SET notes = ? WHERE id = ?`,
        [`${text.substring(0, 100000)}`, statementId],
        { fallback: false }
      );

      return res.status(201).json({
        success: true,
        mode: 'fallback',
        statementPackId,
        statementIds: [statementId],
        analysis: null,
        message: 'LLM analysis unavailable — created single statement with heuristic detection.',
      });
    }

    // 3. Create statements for each section found by LLM
    const createdStatements: Array<{
      statementId: string;
      statementType: string;
      lineCount: number;
    }> = [];
    let packId: string | null = null;

    for (const section of analysis.sections) {
      const statementId = await createStatement({
        organizationId: orgId,
        statementType: section.statementType,
        periodStart: analysis.periodStart || new Date().getFullYear() + '-01-01',
        periodEnd: analysis.periodEnd || new Date().getFullYear() + '-12-31',
        periodLabel: analysis.periodLabel || undefined,
        currency: analysis.currency,
        scaling: analysis.scaling,
        sourceFileName: file.originalname,
        sourceFilePath: file.path,
        parseMethod: effectiveParseMethod,
        overallConfidence: 0.9,
        documentClass: 'mixed_report',
        extractionStrategy: 'llm_full_document',
        templateFamily: null,
        createdBy: userId,
      });

      // Store text for later reference
      await dbRun(
        `UPDATE financial_statements SET notes = ? WHERE id = ?`,
        [`${text.substring(0, 100000)}`, statementId],
        { fallback: false }
      );

      // Sync to pack (first statement creates the pack, rest join it)
      const thisPackId = await syncStatementToPack(statementId);
      if (!packId && thisPackId) packId = thisPackId;

      // Update pack metadata with entity name from LLM
      if (packId && analysis.entityName) {
        await dbRun(
          `UPDATE financial_statement_packs SET entity_name = ? WHERE id = ? AND (entity_name IS NULL OR entity_name = '')`,
          [analysis.entityName, packId]
        );
      }

      const ingestRunId = await startStatementIngestRun({
        statementId,
        organizationId: orgId,
        sourceFileName: file.originalname,
        sourceFilePath: file.path,
        parseMethod: effectiveParseMethod,
        documentClass: 'mixed_report',
        extractionStrategy: 'llm_full_document',
        templateFamily: null,
        rawTextLength: text.length,
        summary: {
          analysis: { entityName: analysis.entityName, sectionType: section.statementType },
        },
        createdBy: userId,
      });

      // 4. Save LLM-extracted lines as values and auto-map
      const extractedLines = section.lines.map((line, idx) => ({
        originalLabel: line.originalLabel,
        value: line.value,
        confidence: line.confidence,
        sourceRow: line.sourceRow ?? idx + 1,
        suggestedCanonicalId: line.suggestedCanonicalId || undefined,
        suggestedCanonicalLabel: undefined as string | undefined,
        isNonFinancial: false,
      }));

      let mappedLines = extractedLines;
      try {
        const autoMapped = await autoMapLines(extractedLines as any, section.statementType, {
          organizationId: orgId,
        });
        if (autoMapped && autoMapped.length > 0) mappedLines = autoMapped as any;
      } catch (mapError) {
        logger.warn('[SmartUpload] Auto-map failed, saving raw lines', {
          statementId,
          statementType: section.statementType,
          error: String(mapError),
        });
      }

      const valuesToSave = mappedLines.map((l) => ({
        canonicalLineId: (l as any).suggestedCanonicalId || null,
        originalLabel: l.originalLabel,
        value: l.value,
        confidence: l.confidence,
        sourceRow: l.sourceRow,
        mappingStatus: ((l as any).suggestedCanonicalId ? 'auto' : 'unmapped') as
          | 'auto'
          | 'unmapped',
        isNonFinancial: !!(l as any).isNonFinancial,
      }));

      await saveStatementValues(statementId, valuesToSave);
      await updateStatementStatus(statementId, 'imported');

      // 5. Run validation + readiness
      try {
        const validationResult = validateStatement(valuesToSave, section.statementType);
        if (validationResult) {
          await persistStatementValidationLedger({
            statementId,
            statementType: section.statementType,
            messages: validationResult.messages || [],
            values: valuesToSave.map((value) => ({
              canonicalLineId: value.canonicalLineId,
              value: Number(value.value || 0),
              isNonFinancial: value.isNonFinancial,
            })),
          });
          const readinessResult = evaluateStatementReadiness({
            rawStatus: 'imported',
            statementType: section.statementType,
            validationStatus: validationResult.status,
            currency: analysis.currency,
            scaling: analysis.scaling,
            validationMessages: validationResult.messages,
            values: valuesToSave,
          });
          if (readinessResult) {
            await updateStatementReadinessState(statementId, readinessResult);
          }
        }
      } catch (valError) {
        logger.warn('[SmartUpload] Validation/readiness failed, continuing', {
          statementId,
          error: String(valError),
        });
      }

      await updateStatementIngestRun({
        ingestRunId,
        currentStage: 'complete',
        runStatus: 'completed',
        documentClass: 'mixed_report',
        extractionStrategy: 'llm_full_document',
        templateFamily: null,
        rawTextLength: text.length,
      });

      createdStatements.push({
        statementId,
        statementType: section.statementType,
        lineCount: section.lines.length,
      });
    }

    // 8. Recompute pack quality
    if (packId) {
      try {
        await recomputeStatementPackForOrganization(orgId, packId);
      } catch (recomputeError) {
        logger.warn('[SmartUpload] Pack recompute failed', {
          packId,
          error: String(recomputeError),
        });
      }
    }

    logFinanceEvent('statement.smartUpload.completed', {
      traceId,
      packId,
      entityName: analysis.entityName,
      sectionCount: analysis.sections.length,
      statementIds: createdStatements.map((s) => s.statementId),
    });

    res.status(201).json({
      success: true,
      mode: 'smart',
      statementPackId: packId,
      statementIds: createdStatements.map((s) => s.statementId),
      statements: createdStatements,
      analysis: {
        entityName: analysis.entityName,
        periodLabel: analysis.periodLabel,
        periodStart: analysis.periodStart,
        periodEnd: analysis.periodEnd,
        currency: analysis.currency,
        scaling: analysis.scaling,
        language: analysis.language,
        documentDescription: analysis.documentDescription,
        sectionTypes: analysis.sections.map((s) => s.statementType),
        totalLines: analysis.sections.reduce((sum, s) => sum + s.lines.length, 0),
        warnings: analysis.warnings,
      },
    });
  })
);

router.post(
  '/:id/detect',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;

    const text = await loadStatementSourceText(statementId, stmt.notes || '');
    if (!text)
      return res.status(400).json({ error: 'No extracted text available — re-upload the PDF' });
    const ingestRunId = await ensureIngestRun({
      statementId,
      organizationId: orgId,
      createdBy: userId,
      sourceFileName: stmt.source_file_name,
      sourceFilePath: stmt.source_file_path,
      parseMethod: stmt.parse_method,
      documentClass: stmt.document_class,
      extractionStrategy: stmt.extraction_strategy,
      templateFamily: stmt.template_family,
      rawTextLength: text.length,
    });

    const autoDetection = detectStatementType(text);
    const manualStatementType = normalizeStatementTypeInput(req.body?.statementType);
    const manualSelectionApplied = Boolean(manualStatementType);
    const containedStatementTypes = Array.isArray(autoDetection.containedStatementTypes)
      ? autoDetection.containedStatementTypes
      : [];
    const effectiveStatementType =
      manualStatementType ||
      normalizeStatementTypeInput(autoDetection.statementType) ||
      normalizeStatementTypeInput(stmt.statement_type) ||
      'P&L';
    const detection: DetectionResult = {
      ...autoDetection,
      statementType: effectiveStatementType,
      periodStart: String(req.body?.periodStart || '').trim() || autoDetection.periodStart,
      periodEnd: String(req.body?.periodEnd || '').trim() || autoDetection.periodEnd,
      periodLabel: String(req.body?.periodLabel || '').trim() || autoDetection.periodLabel,
      currency: String(req.body?.currency || '').trim() || autoDetection.currency,
      scaling:
        ((String(req.body?.scaling || '').trim() ||
          autoDetection.scaling) as DetectionResult['scaling']) || 'thousands',
      confidence:
        manualSelectionApplied &&
        ((autoDetection.containedStatementTypes || []).length > 1 ||
          autoDetection.statementType !== manualStatementType)
          ? 1
          : autoDetection.confidence,
    };
    const columnSelection = resolveStatementColumnSelection(text, detection);
    const documentProfile = classifyStatementDocument({
      fileName: stmt.source_file_name,
      parseMethod: stmt.parse_method,
      text,
    });

    try {
      await updateStatementMetadata(statementId, {
        statementType: detection.statementType,
        periodStart: detection.periodStart,
        periodEnd: detection.periodEnd,
        periodLabel: detection.periodLabel,
        currency: detection.currency,
        scaling: detection.scaling,
        overallConfidence: detection.confidence,
        documentClass: documentProfile.documentClass,
        extractionStrategy: documentProfile.extractionStrategy,
        templateFamily: documentProfile.templateFamily,
      });
    } catch (error) {
      logger.warn(
        '[FinanceStatements] Detect metadata persistence failed; continuing with request-local selection',
        {
          statementId,
          requestedStatementType: req.body?.statementType,
          effectiveStatementType: detection.statementType,
          error: String((error as Error)?.message || error || 'unknown'),
        }
      );
    }
    const statementPackId = await syncStatementToPack(statementId);
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'detection',
      stage: 'detect',
      contentJson: { detection, documentProfile, columnSelection },
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'detect',
      runStatus: 'running',
      documentClass: documentProfile.documentClass,
      extractionStrategy: documentProfile.extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
    });
    if (orgId) {
      await recordStatementQualityRun({
        statementId,
        organizationId: orgId,
        stage: 'detect',
        resultStatus: autoDetection.statementType === 'UNKNOWN' ? 'warning' : 'pass',
        readinessStatus: 'pending',
        strategy: documentProfile.extractionStrategy,
        summary: 'Detection metadata persisted for statement.',
        reasonCodes:
          autoDetection.statementType === 'UNKNOWN'
            ? ['DETECTION_UNKNOWN_FALLBACK']
            : ['DETECTION_METADATA_UPDATED'],
        payload: detection,
        createdBy: userId,
      });
    }

    res.json({
      statementId,
      statementPackId,
      ingestRunId,
      detection: {
        ...detection,
        containedStatementTypes,
        containsMultipleStatements:
          documentProfile.documentClass === 'mixed_report' || containedStatementTypes.length > 1,
      },
      documentProfile,
      columnSelection,
    });
  })
);

router.post(
  '/:id/extract',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;
    const traceId = getFinanceTraceId((req as any).correlationId);

    const text = await loadStatementSourceText(statementId, stmt.notes || '');
    if (!text) return res.status(400).json({ error: 'No extracted text' });
    const ingestRunId = await ensureIngestRun({
      statementId,
      organizationId: orgId,
      createdBy: userId,
      sourceFileName: stmt.source_file_name,
      sourceFilePath: stmt.source_file_path,
      parseMethod: stmt.parse_method,
      documentClass: stmt.document_class,
      extractionStrategy: stmt.extraction_strategy,
      templateFamily: stmt.template_family,
      rawTextLength: text.length,
    });
    const documentProfile = classifyStatementDocument({
      fileName: stmt.source_file_name,
      parseMethod: stmt.parse_method,
      text,
    });
    const effectiveStatementType =
      normalizeStatementTypeInput(req.body?.statementType) ||
      normalizeStatementTypeInput(stmt.statement_type) ||
      'P&L';
    const effectivePeriodLabel =
      String(req.body?.periodLabel || '').trim() || stmt.period_label || undefined;
    const effectiveCurrency = String(req.body?.currency || '').trim() || stmt.currency || undefined;
    const effectiveScaling = String(req.body?.scaling || '').trim() || stmt.scaling || undefined;
    const minimumAiLines =
      effectiveStatementType === 'CF' ? 2 : ['BS', 'P&L'].includes(effectiveStatementType) ? 3 : 2;

    const openAiExtraction =
      documentProfile.documentClass === 'spreadsheet' || documentProfile.documentClass === 'csv'
        ? null
        : await extractFinancialLinesWithOpenAI({
            filePath: stmt.source_file_path,
            fileName: stmt.source_file_name,
            statementType: effectiveStatementType,
            traceId,
          });
    const anthropicExtraction =
      documentProfile.documentClass === 'spreadsheet' || documentProfile.documentClass === 'csv'
        ? null
        : !openAiExtraction || openAiExtraction.lines.length < minimumAiLines
          ? await extractFinancialLinesWithAnthropic({
              text,
              fileName: stmt.source_file_name,
              statementType: effectiveStatementType,
              traceId,
            })
          : null;
    const aiExtraction =
      anthropicExtraction &&
      anthropicExtraction.lines.length > (openAiExtraction?.lines.length || 0)
        ? anthropicExtraction
        : openAiExtraction;
    const extractedSections = locateStatementSections(text, effectiveStatementType);
    const scopedText = extractedSections[0]?.text || text;
    const columnSelection = resolveStatementColumnSelection(scopedText, {
      periodLabel: effectivePeriodLabel,
      currency: effectiveCurrency,
      scaling: effectiveScaling,
    });
    const extractionRaw =
      aiExtraction && aiExtraction.lines.length > 0
        ? aiExtraction
        : extractFinancialLines(scopedText, effectiveStatementType, {
            selectedPeriodLabel: columnSelection.selectedPeriodLabel,
            comparisonPeriodLabel: columnSelection.comparisonPeriodLabel,
          });
    const extraction = {
      ...extractionRaw,
      lines: extractionRaw.lines.map((line) => ({
        ...line,
        selectedPeriodLabel:
          line.selectedPeriodLabel || columnSelection.selectedPeriodLabel || undefined,
      })),
    };
    const strategy =
      anthropicExtraction &&
      anthropicExtraction.lines.length > (openAiExtraction?.lines.length || 0)
        ? openAiExtraction && (openAiExtraction.lines.length || 0) > 0
          ? 'anthropic_text_fallback'
          : 'anthropic_text_primary'
        : openAiExtraction && openAiExtraction.lines.length > 0
          ? 'openai_input_file'
          : documentProfile.documentClass === 'spreadsheet'
            ? 'spreadsheet_structured'
            : 'local_parser';

    logFinanceEvent('statement.extract.completed', {
      traceId,
      statementId,
      strategy,
      lineCount: extraction.lines.length,
      rawTableCount: extraction.rawTableCount,
      warnings: extraction.warnings,
    });

    await updateStatementStatus(statementId, 'imported');
    await updateStatementMetadata(statementId, {
      statementType: effectiveStatementType,
      periodLabel: effectivePeriodLabel,
      currency: effectiveCurrency,
      scaling: effectiveScaling,
      documentClass: documentProfile.documentClass,
      extractionStrategy: strategy,
      templateFamily: documentProfile.templateFamily,
    });
    const persistedSections = await persistStatementExtractedSections({
      statementId,
      ingestRunId,
      sections: extractedSections,
    });
    const sectionIdsByKey = Object.fromEntries(
      persistedSections.map((section) => [section.sectionKey, section.sectionId])
    );
    const candidateRows = await persistStatementCandidateRows({
      statementId,
      ingestRunId,
      rows: extraction.lines,
      sectionIdsByKey,
      statementType: effectiveStatementType,
      currency: effectiveCurrency,
      scaling: effectiveScaling,
    });
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'extraction',
      stage: 'extract',
      contentJson: {
        strategy,
        rawTableCount: extraction.rawTableCount,
        warnings: extraction.warnings,
        lineCount: extraction.lines.length,
        columnSelection,
        lines: extraction.lines,
      },
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'extract',
      runStatus: extraction.lines.length > 0 ? 'running' : 'failed',
      documentClass: documentProfile.documentClass,
      extractionStrategy: strategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
      reasonCodes:
        extraction.lines.length > 0 ? ['EXTRACTION_LINES_FOUND'] : ['EXTRACTION_NO_LINES'],
      summary: {
        sections: persistedSections.length,
        candidateRows: candidateRows.length,
      },
    });
    if (orgId) {
      await recordStatementQualityRun({
        statementId,
        organizationId: orgId,
        stage: 'extract',
        resultStatus: extraction.lines.length > 0 ? 'pass' : 'fail',
        readinessStatus: extraction.lines.length > 0 ? 'recoverable' : 'rejected',
        strategy,
        summary:
          extraction.lines.length > 0
            ? 'Extraction produced candidate financial lines.'
            : 'Extraction did not produce usable financial lines.',
        reasonCodes:
          extraction.lines.length > 0 ? ['EXTRACTION_LINES_FOUND'] : ['EXTRACTION_NO_LINES'],
        payload: {
          rawTableCount: extraction.rawTableCount,
          warnings: extraction.warnings,
          lineCount: extraction.lines.length,
        },
        createdBy: userId,
      });
    }

    res.json({
      statementId,
      ingestRunId,
      lines: extraction.lines,
      sections: extractedSections,
      columnSelection,
      rawTableCount: extraction.rawTableCount,
      warnings: extraction.warnings,
      lineCount: extraction.lines.length,
      extractionStrategy: strategy,
      documentClass: documentProfile.documentClass,
    });
  })
);

router.post(
  '/:id/map',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;
    const traceId = getFinanceTraceId((req as any).correlationId);

    const ingestRunId = await ensureIngestRun({
      statementId,
      organizationId: orgId,
      createdBy: userId,
      sourceFileName: stmt.source_file_name,
      sourceFilePath: stmt.source_file_path,
      parseMethod: stmt.parse_method,
      documentClass: stmt.document_class,
      extractionStrategy: stmt.extraction_strategy,
      templateFamily: stmt.template_family,
    });

    const requestLines = Array.isArray(req.body?.lines) ? req.body.lines : null;
    const sourceLines =
      requestLines && requestLines.length > 0
        ? requestLines
        : await loadPersistedStatementCandidateRows({ statementId, ingestRunId });
    if (!sourceLines || sourceLines.length === 0) {
      return res.status(400).json({ error: 'No extracted candidate rows available for mapping' });
    }

    const heuristicMapped = await autoMapLines(sourceLines, stmt.statement_type, {
      organizationId: orgId,
      templateFamily: stmt.template_family,
    });

    const unmappedCount = heuristicMapped.filter(
      (l) => !l.suggestedCanonicalId && !l.isNonFinancial && l.originalLabel
    ).length;

    let llmMappingResult = null;
    if (unmappedCount > 0) {
      try {
        llmMappingResult = await mapUnmappedLinesWithLLM({
          allLines: heuristicMapped,
          statementType: stmt.statement_type,
          traceId,
        });
        if (llmMappingResult.proposals.length > 0) {
          const { applied, skipped } = applyLlmProposals(
            heuristicMapped,
            llmMappingResult.proposals
          );
          logFinanceEvent('statement.mapping.llm_applied', {
            traceId,
            statementId,
            provider: llmMappingResult.provider,
            applied,
            skipped,
            durationMs: llmMappingResult.durationMs,
          });
        }
      } catch (llmErr) {
        logFinanceError('statement.mapping.llm_error', llmErr, { traceId, statementId });
      }
    }

    const mapped = resolveDuplicateSuggestedMappings(heuristicMapped);

    const conflictCount = mapped.filter(
      (l) => l.mappingReason === 'duplicate_candidate_conflict'
    ).length;
    let llmSecondPassResult = null;
    if (conflictCount > 0) {
      try {
        llmSecondPassResult = await mapDuplicateConflictLinesWithLLM({
          allLines: mapped,
          statementType: stmt.statement_type,
          traceId,
        });
        if (llmSecondPassResult.proposals.length > 0) {
          const { applied, skipped } = applySecondPassProposals(
            mapped,
            llmSecondPassResult.proposals
          );
          logFinanceEvent('statement.mapping.llm_second_pass_applied', {
            traceId,
            statementId,
            provider: llmSecondPassResult.provider,
            applied,
            skipped,
            durationMs: llmSecondPassResult.durationMs,
          });
        }
      } catch (llm2Err) {
        logFinanceError('statement.mapping.llm_second_pass_error', llm2Err, {
          traceId,
          statementId,
        });
      }
    }

    const candidateRows = await persistStatementCandidateRows({
      statementId,
      ingestRunId,
      rows: mapped,
      statementType: stmt.statement_type,
      currency: stmt.currency,
      scaling: stmt.scaling,
    });
    await persistStatementMappingCandidates({
      statementId,
      ingestRunId,
      rows: mapped,
      candidateRowIdsBySourceRow: Object.fromEntries(
        candidateRows
          .filter((row) => row.sourceRow != null)
          .map((row) => [Number(row.sourceRow), row.candidateRowId])
      ),
    });

    await updateStatementStatus(statementId, 'mapped');
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'mapping',
      stage: 'map',
      contentJson: {
        mappedLines: mapped,
      },
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'map',
      runStatus: 'running',
      reasonCodes: mapped.some((line) => line.suggestedCanonicalId)
        ? ['MAPPING_COMPLETE']
        : ['MAPPING_NO_SUGGESTIONS'],
      summary: {
        total: mapped.length,
        suggested: mapped.filter((line) => line.suggestedCanonicalId).length,
        heuristicMapped: mapped.filter(
          (l) => l.suggestedCanonicalId && !l.mappingReason?.startsWith('llm_mapping')
        ).length,
        llmMapped: mapped.filter((l) => l.mappingReason?.startsWith('llm_mapping')).length,
        llmProvider: llmMappingResult?.provider || null,
        llmDurationMs: llmMappingResult?.durationMs || 0,
      },
    });
    if (orgId) {
      await recordStatementQualityRun({
        statementId,
        organizationId: orgId,
        stage: 'map',
        resultStatus: mapped.some((line) => line.suggestedCanonicalId) ? 'pass' : 'warning',
        readinessStatus: 'recoverable',
        strategy: stmt.template_family || stmt.extraction_strategy || 'alias_engine',
        summary: 'Canonical mapping suggestions generated.',
        reasonCodes: mapped.some((line) => line.isNonFinancial)
          ? ['MAPPING_COMPLETE', 'NON_FINANCIAL_ROWS_EXCLUDED']
          : ['MAPPING_COMPLETE'],
        payload: {
          total: mapped.length,
          suggested: mapped.filter((line) => line.suggestedCanonicalId).length,
          nonFinancial: mapped.filter((line) => line.isNonFinancial).length,
        },
        createdBy: userId,
      });
    }

    for (const line of mapped) {
      if (!line.isNonFinancial && isNonFinancialByPolicy(line.originalLabel)) {
        line.isNonFinancial = true;
        line.classificationReason = 'policy_non_financial';
      }
      if (
        !line.isNonFinancial &&
        !line.suggestedCanonicalId &&
        isLikelySubtotalOrAggregate(line.originalLabel)
      ) {
        line.isNonFinancial = true;
        line.classificationReason = 'policy_subtotal_aggregate';
      }
    }

    const tierResults = mapped.map((line) =>
      classifyMappingTier({
        suggestedCanonicalId: line.suggestedCanonicalId,
        mappingReason: line.mappingReason,
        isNonFinancial: line.isNonFinancial,
        originalLabel: line.originalLabel,
      })
    );
    for (let i = 0; i < mapped.length; i++) {
      (mapped[i] as any).mappingTier = tierResults[i].tier;
    }
    const policyAssessment = assessCoverage(tierResults, mapped.length);

    res.json({ statementId, ingestRunId, mappedLines: mapped, policyAssessment });
  })
);

router.put(
  '/:id/values',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;

    const { values } = req.body;
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: 'values array required' });
    const result = await saveStatementValuesFlow({
      statementId,
      organizationId: orgId,
      userId: userId as string,
      statement: stmt,
      values,
    });

    res.json(result);
  })
);

router.post(
  '/:id/validate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;

    let valueRows: any[];
    try {
      valueRows = (await dbAll(
        `SELECT canonical_line_id as "canonicalLineId", value, is_non_financial as "isNonFinancial"
         FROM financial_statement_values WHERE statement_id = ?`,
        [statementId],
        { fallback: false }
      )) as any[];
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      valueRows = (await dbAll(
        `SELECT canonical_line_id as "canonicalLineId", value, FALSE as "isNonFinancial"
         FROM financial_statement_values WHERE statement_id = ?`,
        [statementId]
      )) as any[];
    }

    const result = validateStatement(valueRows, stmt.statement_type);
    const ingestRunId = await ensureIngestRun({
      statementId,
      organizationId: orgId,
      createdBy: userId,
      sourceFileName: stmt.source_file_name,
      sourceFilePath: stmt.source_file_path,
      parseMethod: stmt.parse_method,
      documentClass: stmt.document_class,
      extractionStrategy: stmt.extraction_strategy,
      templateFamily: stmt.template_family,
    });
    const readiness = evaluateStatementReadiness({
      rawStatus: stmt.status,
      statementType: stmt.statement_type,
      validationStatus: result.status,
      currency: stmt.currency,
      scaling: stmt.scaling,
      validationMessages: result.messages,
      values: valueRows,
    });

    await updateStatementStatus(statementId, stmt.status, result.status, result.messages);
    await persistStatementValidationLedger({
      statementId,
      statementType: stmt.statement_type,
      messages: result.messages,
      values: valueRows,
    });
    await updateStatementReadinessState(statementId, readiness);
    await snapshotCanonicalStatementVersion({
      statementId,
      versionKind: readiness.isReady ? 'validated' : 'mapped',
      readinessStatus: readiness.readinessStatus,
      values: valueRows,
      validations: result.messages,
      createdBy: userId,
      summary: readiness.summary,
    });
    const statementPackId = await syncStatementToPack(statementId);
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'validation',
      stage: 'validate',
      contentJson: { validation: result, readiness },
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'validate',
      runStatus: readiness.isReady ? 'completed' : 'running',
      reasonCodes: readiness.reasonCodes,
      summary: {
        validationStatus: result.status,
        warningCount: readiness.warningCount,
        hardFailCount: readiness.hardFailCount,
      },
    });
    if (orgId && !readiness.isReady) {
      await openStatementRepairSession({
        statementId,
        organizationId: orgId,
        ingestRunId,
        startedBy: userId,
        summary: readiness.summary,
        payload: { validation: result, readiness },
      });
    }
    if (orgId) {
      await recordStatementQualityRun({
        statementId,
        organizationId: orgId,
        stage: 'validate',
        resultStatus:
          readiness.readinessStatus === 'ready'
            ? 'pass'
            : readiness.readinessStatus === 'recoverable'
              ? 'warning'
              : 'fail',
        readinessStatus: readiness.readinessStatus,
        strategy: stmt.extraction_strategy || 'validation_refresh',
        summary: readiness.summary,
        reasonCodes: readiness.reasonCodes,
        payload: { validation: result },
        createdBy: userId,
      });
    }

    res.json({ statementId, statementPackId, ingestRunId, validation: result, readiness });
  })
);

router.post(
  '/:id/confirm',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;
    const userId = req.user!.id;

    let valueRows: any[];
    try {
      valueRows = (await dbAll(
        `SELECT canonical_line_id as "canonicalLineId", value, is_non_financial as "isNonFinancial"
         FROM financial_statement_values
         WHERE statement_id = ?`,
        [statementId],
        { fallback: false }
      )) as any[];
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      valueRows = (await dbAll(
        `SELECT canonical_line_id as "canonicalLineId", value, FALSE as "isNonFinancial"
         FROM financial_statement_values
         WHERE statement_id = ?`,
        [statementId]
      )) as any[];
    }
    const validationMessages = stmt.validation_messages ? JSON.parse(stmt.validation_messages) : [];
    const readiness = evaluateStatementReadiness({
      rawStatus: stmt.status,
      statementType: stmt.statement_type,
      validationStatus: stmt.validation_status,
      currency: stmt.currency,
      scaling: stmt.scaling,
      validationMessages,
      values: valueRows,
    });
    if (!readiness.isReady) {
      return res.status(400).json({
        error: 'Statement is not ready to confirm',
        readiness,
      });
    }
    const ingestRunId = await ensureIngestRun({
      statementId,
      organizationId: orgId,
      createdBy: userId,
      sourceFileName: stmt.source_file_name,
      sourceFilePath: stmt.source_file_path,
      parseMethod: stmt.parse_method,
      documentClass: stmt.document_class,
      extractionStrategy: stmt.extraction_strategy,
      templateFamily: stmt.template_family,
    });

    await confirmStatement(statementId, userId, readiness);
    await snapshotCanonicalStatementVersion({
      statementId,
      versionKind: 'confirmed',
      readinessStatus: readiness.readinessStatus,
      values: valueRows,
      validations: validationMessages,
      createdBy: userId,
      summary: 'Confirmed statement-ready snapshot.',
    });
    const statementPackId = await syncStatementToPack(statementId);
    await recordStatementSourceArtifact({
      statementId,
      ingestRunId,
      artifactType: 'confirmation',
      stage: 'confirm',
      contentJson: readiness,
      createdBy: userId,
    });
    await updateStatementIngestRun({
      ingestRunId,
      currentStage: 'confirm',
      runStatus: 'completed',
      reasonCodes: readiness.reasonCodes,
      summary: {
        readinessStatus: readiness.readinessStatus,
      },
    });
    if (orgId) {
      await recordStatementQualityRun({
        statementId,
        organizationId: orgId,
        stage: 'confirm',
        resultStatus: 'pass',
        readinessStatus: readiness.readinessStatus,
        strategy: stmt.extraction_strategy || 'confirmation_gate',
        summary: 'Statement confirmed as statement-ready.',
        reasonCodes: readiness.reasonCodes,
        payload: readiness,
        createdBy: userId,
      });
    }
    logger.info(`[FinanceStatements] Statement ${statementId} confirmed by ${userId}`);

    res.json({
      success: true,
      statementId,
      statementPackId,
      ingestRunId,
      status: 'confirmed',
      readiness,
    });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const readinessFilter = String(req.query.readiness || '')
      .trim()
      .toLowerCase();
    let statements: any[];
    try {
      statements = await dbAll(
        `SELECT fs.id, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling, fs.source_file_name,
                fs.overall_confidence, fs.validation_status, fs.status, fs.created_at, fs.updated_at,
                fs.readiness_status, fs.readiness_score, fs.quality_summary, fs.quality_reason_codes,
                fs.document_class, fs.extraction_strategy, fs.template_family, fs.values_version,
                COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE) AS total_line_count,
                COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
                COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = FALSE AND fsv.canonical_line_id IS NULL) AS unmapped_line_count,
                COUNT(fsv.id) FILTER (WHERE COALESCE(fsv.is_non_financial, FALSE) = TRUE) AS non_financial_line_count,
                CASE
                  WHEN fs.readiness_status = 'ready' THEN TRUE
                  ELSE FALSE
                END AS is_workable
         FROM financial_statements fs
         LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
         WHERE fs.organization_id = ?
           AND (? = '' OR LOWER(COALESCE(fs.readiness_status, 'pending')) = ?)
         GROUP BY fs.id
         ORDER BY fs.period_end DESC, fs.created_at DESC
         LIMIT 100`,
        [orgId, readinessFilter, readinessFilter],
        { fallback: false }
      );
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      statements = await dbAll(
        `SELECT fs.id, fs.statement_type, fs.period_start, fs.period_end, fs.period_label, fs.currency, fs.scaling, fs.source_file_name,
                fs.overall_confidence, fs.validation_status, fs.status, fs.created_at, fs.updated_at,
                COUNT(fsv.id) AS total_line_count,
                COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) AS mapped_line_count,
                COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) AS unmapped_line_count,
                0 AS non_financial_line_count,
                CASE
                  WHEN fs.status IN ('mapped', 'confirmed')
                   AND fs.validation_status IN ('pass', 'warnings')
                   AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                   AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) = 0
                  THEN TRUE
                  ELSE FALSE
                END AS is_workable,
                CASE
                  WHEN fs.status IN ('mapped', 'confirmed')
                   AND fs.validation_status IN ('pass', 'warnings')
                   AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                   AND COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NULL) = 0
                  THEN 'ready'
                  WHEN COUNT(fsv.id) FILTER (WHERE fsv.canonical_line_id IS NOT NULL) > 0
                  THEN 'recoverable'
                  ELSE 'pending'
                END AS readiness_status,
                0 AS readiness_score,
                NULL AS quality_summary,
                '[]' AS quality_reason_codes,
                NULL AS document_class,
                NULL AS extraction_strategy,
                NULL AS template_family,
                0 AS values_version
         FROM financial_statements fs
         LEFT JOIN financial_statement_values fsv ON fsv.statement_id = fs.id
         WHERE fs.organization_id = ?
         GROUP BY fs.id
         ORDER BY fs.period_end DESC, fs.created_at DESC
         LIMIT 100`,
        [orgId]
      );
    }
    // FIN-005: `period_start`/`period_end` are Postgres DATE columns, so these
    // rows carry JS `Date` objects. Serialize at the read boundary so the list
    // response can never contain a raw Date (and legacy rows whose
    // `period_label` already holds one are repaired on the way out).
    res.json(serializeRowsPeriodFields(statements));
  })
);

router.get(
  '/packs',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const readinessFilter = String(req.query.readiness || '')
      .trim()
      .toLowerCase();
    const packs = await listStatementPacks(orgId, readinessFilter);
    res.json(packs || []);
  })
);

router.get(
  '/packs/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);
    const pack = await getStatementPackDetail(orgId, packId);
    if (!pack) return res.status(404).json({ error: 'Statement pack not found' });
    res.json(pack);
  })
);

router.post(
  '/packs/:id/recompute',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);
    const pack = await recomputeStatementPackForOrganization(orgId, packId);
    if (!pack) return res.status(404).json({ error: 'Statement pack not found' });
    res.json({ success: true, pack });
  })
);

/**
 * POST /api/finance-statements/packs/:id/report-section
 * F5 wiring — "silnik→papier": publikuje niemutowalny snapshot sekcji finansowej raportu
 * (wskaźniki Z111 + reconcile R1-R8 (shadow, czytany) + koszyk EV) przez
 * `financeReportSectionService.publishFinanceReportSectionSnapshot`. Additive — nie zmienia
 * `/packs/:id/recompute` ani żadnego istniejącego endpointu.
 * Body: { valuationId?, title?, periodFrom?, periodTo? }.
 */
router.post(
  '/packs/:id/report-section',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);

    const pack = await getStatementPackDetail(orgId, packId);
    if (!pack) return res.status(404).json({ error: 'Statement pack not found' });

    const userId = getUserId(req);
    const body = req.body || {};
    const valuationId =
      typeof body.valuationId === 'string' && body.valuationId.trim()
        ? body.valuationId.trim()
        : undefined;
    const title =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
    const periodFrom = typeof body.periodFrom === 'string' ? body.periodFrom : undefined;
    const periodTo = typeof body.periodTo === 'string' ? body.periodTo : undefined;

    try {
      const result = await publishFinanceReportSectionSnapshot({
        organizationId: orgId,
        createdBy: userId || 'system',
        packId,
        valuationId,
        title,
        periodFrom,
        periodTo,
      });
      res.status(201).json({
        success: true,
        reportId: result.reportId,
        snapshotId: result.snapshotId,
        section: result.section,
        // #82g — jawny LINEAGE: envelope = koperta dowodowa persystowana w `artifact_evidence`
        // (czytelna też przez generyczny `GET /api/evidence/report/:snapshotId`); lineage = ten
        // sam ślad w kształcie karty raportu (skąd/przez co/z jakimi założeniami per liczba).
        envelope: result.envelope,
        lineage: result.lineage,
      });
    } catch (e: any) {
      if (e instanceof FinanceReportReconcileBlockedError) {
        // RECONCILE_ENFORCE=true + persisted R1-R8 blocksReady → report NOT published.
        // Structural 409 with the blocking checks, not a generic 500 (see
        // financeReportSectionService.FinanceReportReconcileBlockedError docblock).
        logger.warn(
          `[FinanceStatements] Report section publish blocked by reconcile enforce: ${e.message}`
        );
        return res.status(409).json({
          success: false,
          error: e.message,
          code: e.code,
          packId: e.packId,
          violations: e.violations,
        });
      }
      logger.error('[FinanceStatements] Error publishing finance report section:', e);
      res.status(500).json({ error: 'Failed to publish finance report section' });
    }
  })
);

/**
 * GET /api/finance-statements/packs/:id/reconcile-summary
 * Lekki READ-ONLY endpoint (UI badge) — persystowany wynik reconcile R1-R8 dla pakietu
 * (`financial_statement_validations`, scope='pack'), CZYTANY przez
 * `financeReportSectionService.loadReconcileSummaryForPack`, bez przeliczania (shadow, nie
 * blokuje readiness — patrz `reconciliationService.RECONCILE_ENFORCE`). Fail-soft: błąd/pakiet
 * bez recompute → { available:false }, nie 500.
 */
router.get(
  '/packs/:id/reconcile-summary',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);
    try {
      const summary = await loadReconcileSummaryForPack(orgId, packId);
      if (!summary) return res.status(404).json({ error: 'Statement pack not found' });
      res.json(summary);
    } catch (e: any) {
      logger.warn(
        `[FinanceStatements] reconcile-summary degraded to unavailable for pack ${packId}: ${e?.message || e}`
      );
      res.json({
        packId,
        available: false,
        enforceMode: false,
        overallStatus: 'na',
        summary: null,
        checks: [],
        computedAt: null,
        blocksReady: false,
      });
    }
  })
);

/**
 * GET /api/finance-statements/packs/:id/report-section/lineage
 * #82g — jawny LINEAGE dla karty raportu Finance: dla kluczowych liczb (wskaźniki Z111,
 * reconcile R1-R8, koszyk EV) — SKĄD (pakiet sprawozdań/okres), PRZEZ CO (formuła
 * wskaźnika/check reconcile/metoda EV), Z JAKIMI ZAŁOŻENIAMI (WACC, tryb enforce). LIVE —
 * bez tworzenia raportu/snapshotu (nic nie zapisuje); publikacja (`POST .../report-section`)
 * persystuje IDENTYCZNY lineage w Evidence Envelope (`lineageToEvidenceInputs`). Query param
 * opcjonalny `valuationId` — jak przy publish, best-effort najnowsza wycena gdy pominięty.
 * Fail-soft: błąd silnika → { available:false, lineage: pusty }, nie 500 (read endpoint).
 */
router.get(
  '/packs/:id/report-section/lineage',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);
    const valuationId =
      typeof req.query.valuationId === 'string' && req.query.valuationId.trim()
        ? req.query.valuationId.trim()
        : undefined;
    try {
      const result = await loadFinanceReportLineageForPack(orgId, packId, valuationId);
      if (!result) return res.status(404).json({ error: 'Statement pack not found' });
      res.json({ success: true, ...result });
    } catch (e: any) {
      logger.warn(
        `[FinanceStatements] report-section/lineage degraded to unavailable for pack ${packId}: ${e?.message || e}`
      );
      res.json({
        success: true,
        packId,
        available: false,
        lineage: {
          packId: null,
          sourcePack: null,
          generatedAt: new Date().toISOString(),
          assumptions: [],
          entries: [],
        },
      });
    }
  })
);

/**
 * GET /api/finance-statements/aggregate-scope/initiatives/:initiativeId/delta
 * A2 (Finance↔Results bridge) — pro-forma delta P&L/BS/CF dla JEDNEJ inicjatywy, przez
 * `financeAggregateScopeService.computeInitiativeDeltaForOrg` (budget_initiative_links →
 * fallback initiative_benefits → null gdy brak sygnału, nigdy zero-zgadywane). Read-only.
 */
router.get(
  '/aggregate-scope/initiatives/:initiativeId/delta',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.params.initiativeId);
    try {
      const delta = await computeInitiativeDeltaForOrg(orgId, initiativeId);
      res.json({ initiativeId, delta });
    } catch (e: any) {
      logger.warn(
        `[FinanceStatements] aggregate-scope initiative delta degraded to null for ${initiativeId}: ${e?.message || e}`
      );
      res.json({ initiativeId, delta: null });
    }
  })
);

/**
 * GET /api/finance-statements/packs/:id/aggregate-scope/portfolio?initiativeIds=a,b,c
 * A3 (portfel/scenariusz) — A1 (ten pakiet) + Σ(A2 dla wybranych inicjatyw), przez
 * `financeAggregateScopeService.computePortfolioAggregateForPack`. `initiativeIds` — lista
 * CSV lub powtórzony query param. Read-only; nigdy nie mutuje pakiet/statement.
 */
router.get(
  '/packs/:id/aggregate-scope/portfolio',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);

    const pack = await getStatementPackDetail(orgId, packId);
    if (!pack) return res.status(404).json({ error: 'Statement pack not found' });

    const rawIds = req.query.initiativeIds;
    const initiativeIds = (
      Array.isArray(rawIds) ? rawIds : typeof rawIds === 'string' ? rawIds.split(',') : []
    )
      .map((v) => String(v).trim())
      .filter(Boolean);

    try {
      const result = await computePortfolioAggregateForPack({
        organizationId: orgId,
        basePackId: packId,
        initiativeIds,
      });
      res.json(result);
    } catch (e: any) {
      logger.warn(
        `[FinanceStatements] aggregate-scope portfolio degraded to base-only for pack ${packId}: ${e?.message || e}`
      );
      res.json({
        scope: 'portfolio',
        basePackId: packId,
        includedInitiativeIds: [],
        skippedInitiativeIds: initiativeIds,
        statements: { pnl: {}, bs: {}, cf: {} },
      });
    }
  })
);

router.post(
  '/packs/:id/statements/:statementId/assign',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);
    const statementId = String(req.params.statementId);
    try {
      await assignStatementToExistingPack({
        organizationId: orgId,
        packId,
        statementId,
      });
    } catch (e: any) {
      const message = String(e?.message || '');
      if (/not found/i.test(message)) {
        return res.status(404).json({ error: message });
      }
      throw e;
    }
    const pack = await getStatementPackDetail(orgId, packId);
    res.json({ success: true, pack });
  })
);

router.delete(
  '/packs/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const packId = String(req.params.id);

    const packRows = (await dbAll(
      `SELECT id FROM financial_statement_packs WHERE id = ? AND organization_id = ?`,
      [packId, orgId]
    )) as any[];
    if (!packRows?.length) {
      return res.status(404).json({ error: 'Statement pack not found' });
    }

    const childStatements = (await dbAll(
      `SELECT id FROM financial_statements WHERE statement_pack_id = ?`,
      [packId]
    )) as any[];
    const childIds = (childStatements || []).map((s: any) => String(s.id));

    for (const stmtId of childIds) {
      await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [stmtId]);
      await dbRun(`DELETE FROM financial_statement_validations WHERE statement_id = ?`, [stmtId]);
      await dbRun(`DELETE FROM financial_statement_mapping_candidates WHERE statement_id = ?`, [
        stmtId,
      ]);
      await dbRun(`DELETE FROM financial_statement_candidate_rows WHERE statement_id = ?`, [
        stmtId,
      ]);
      await dbRun(`DELETE FROM financial_statement_extracted_sections WHERE statement_id = ?`, [
        stmtId,
      ]);
      await dbRun(`DELETE FROM financial_statement_source_artifacts WHERE statement_id = ?`, [
        stmtId,
      ]);
      await dbRun(`DELETE FROM financial_statement_quality_runs WHERE statement_id = ?`, [stmtId]);
      await dbRun(`DELETE FROM financial_statement_ingest_runs WHERE statement_id = ?`, [stmtId]);
      await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [stmtId]);
    }

    await dbRun(`DELETE FROM financial_statement_validations WHERE statement_pack_id = ?`, [
      packId,
    ]);
    await dbRun(`DELETE FROM financial_statement_packs WHERE id = ?`, [packId]);

    res.json({ success: true, deleted: packId, statementsDeleted: childIds.length });
  })
);

router.get(
  '/canonical-lines',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    const lines = await dbAll(
      `SELECT id, statement_type, line_code, line_name, line_name_en, line_name_pl, parent_line_id, sort_order,
              aggregation_level, required_level, sign_convention, is_total, is_subtotal, is_computed,
              formula_json, deaggregation_ready, taxonomy_version
       FROM financial_statement_lines
       WHERE is_system = TRUE OR organization_id = ?
       ORDER BY statement_type, sort_order`,
      [orgId || '']
    );
    res.json(lines || []);
  })
);

router.get(
  '/:id/analytics',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, getOrgId(req), res);
    if (!stmt) return;
    const requestedLevel = Math.min(3, Math.max(1, Number(req.query.level || 2) || 2));
    const analytics = await buildStatementAnalytics({
      statementId,
      statementType: String(stmt.statement_type || '').toUpperCase() as 'P&L' | 'BS' | 'CF',
      requestedLevel,
      defaultPeriodLabel: stmt.period_label || null,
    });
    res.json(analytics);
  })
);

router.get(
  '/:id/values/:valueId/explain',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const valueId = String(req.params.valueId);
    const stmt = await getStatementOrFail(statementId, getOrgId(req), res);
    if (!stmt) return;

    const rows = (await dbAll(
      `SELECT fsv.id, fsv.original_label, fsv.value, fsv.mapping_status, fsv.value_origin, fsv.mapping_confidence,
              fsv.evidence_json, fsl.line_code, fsl.line_name, fsl.line_name_pl,
              fsve.evidence_type, fsve.weight, fsve.contribution_value, fsve.explanation,
              fscr.id AS candidate_row_id, fscr.row_label, fscr.source_row, fscr.source_page, fscr.raw_value,
              fsmc.id AS mapping_candidate_id, fsmc.score AS mapping_score, fsmc.match_reason
       FROM financial_statement_values fsv
       LEFT JOIN financial_statement_lines fsl ON fsl.id = fsv.canonical_line_id
       LEFT JOIN financial_statement_value_evidence fsve ON fsve.statement_value_id = fsv.id
       LEFT JOIN financial_statement_candidate_rows fscr ON fscr.id = COALESCE(fsve.candidate_row_id, fsv.source_candidate_row_id)
       LEFT JOIN financial_statement_mapping_candidates fsmc ON fsmc.id = fsv.selected_mapping_candidate_id
       WHERE fsv.statement_id = ? AND fsv.id = ?`,
      [statementId, valueId]
    )) as any[];

    if (!rows.length) {
      return res.status(404).json({ error: 'Statement value not found' });
    }

    const head = rows[0];
    res.json({
      valueId,
      originalLabel: head.original_label,
      mappedTo: head.line_name || head.line_name_pl || head.line_code || null,
      lineCode: head.line_code || null,
      value: Number(head.value || 0),
      mappingStatus: head.mapping_status || 'unmapped',
      valueOrigin: head.value_origin || 'source',
      mappingConfidence: Number(head.mapping_confidence || 0),
      evidenceJson:
        typeof head.evidence_json === 'string' && head.evidence_json.trim().startsWith('{')
          ? JSON.parse(head.evidence_json)
          : head.evidence_json || null,
      evidences: rows
        .filter((row) => row.evidence_type || row.candidate_row_id)
        .map((row) => ({
          evidenceType: row.evidence_type || 'direct',
          weight: Number(row.weight ?? 1),
          contributionValue: row.contribution_value != null ? Number(row.contribution_value) : null,
          explanation: row.explanation || null,
          source: row.candidate_row_id
            ? {
                candidateRowId: row.candidate_row_id,
                rowLabel: row.row_label || null,
                sourceRow: row.source_row != null ? Number(row.source_row) : null,
                sourcePage: row.source_page != null ? Number(row.source_page) : null,
                rawValue: row.raw_value || null,
              }
            : null,
        })),
      selectedMappingCandidate: head.mapping_candidate_id
        ? {
            id: head.mapping_candidate_id,
            score: Number(head.mapping_score || 0),
            reason: head.match_reason || null,
          }
        : null,
    });
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, getOrgId(req), res);
    if (!stmt) return;

    let values: any[];
    let qualityRuns: any[] = [];
    let ingestRuns: any[] = [];
    let extractedSections: any[] = [];
    let repairSessions: any[] = [];
    let mappingCandidates: any[] = [];
    let validationLedger: any[] = [];
    let versions: any[] = [];
    try {
      values = await dbAll(
        `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_page, fsv.source_row,
              fsv.mapping_status, fsv.is_manually_corrected, fsv.is_non_financial, fsv.classification_reason,
              fsv.value_origin, fsv.mapping_confidence, fsv.evidence_json, fsv.source_candidate_row_id,
              fsv.selected_mapping_candidate_id, fsv.period_granularity,
              fsl.line_code, fsl.line_name, fsl.line_name_en, fsl.line_name_pl, fsl.parent_line_id, fsl.aggregation_level, fsl.required_level,
              fsl.sign_convention, fsl.is_total, fsl.is_subtotal, fsl.is_computed, fsl.formula_json, fsl.deaggregation_ready
       FROM financial_statement_values fsv
       LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
       WHERE fsv.statement_id = ? ORDER BY fsv.source_row`,
        [statementId],
        { fallback: false }
      );
      qualityRuns = await dbAll(
        `SELECT stage, result_status, readiness_status, strategy, summary, reason_codes, created_at
         FROM financial_statement_quality_runs
         WHERE statement_id = ?
         ORDER BY created_at DESC
         LIMIT 8`,
        [statementId],
        { fallback: false }
      );
      ingestRuns = await dbAll(
        `SELECT id, run_status, current_stage, source_file_name, parse_method, document_class, extraction_strategy,
                template_family, raw_text_length, latest_reason_codes, started_at, completed_at, updated_at
         FROM financial_statement_ingest_runs
         WHERE statement_id = ?
         ORDER BY started_at DESC
         LIMIT 6`,
        [statementId],
        { fallback: false }
      );
      extractedSections = await dbAll(
        `SELECT section_key, section_label, statement_type, line_start, line_end, confidence, text_excerpt, metadata_json, created_at
         FROM financial_statement_extracted_sections
         WHERE statement_id = ?
         ORDER BY created_at DESC, confidence DESC
         LIMIT 12`,
        [statementId],
        { fallback: false }
      );
      repairSessions = await dbAll(
        `SELECT id, repair_status, summary, payload_json, started_by, created_at, updated_at
         FROM financial_statement_repair_sessions
         WHERE statement_id = ?
         ORDER BY created_at DESC
         LIMIT 6`,
        [statementId],
        { fallback: false }
      );
      mappingCandidates = await dbAll(
        `SELECT candidate_row_id, canonical_line_id, score, match_reason, is_selected, selected_by, metadata_json, created_at
         FROM financial_statement_mapping_candidates
         WHERE statement_id = ?
         ORDER BY created_at DESC, score DESC
         LIMIT 150`,
        [statementId],
        { fallback: false }
      );
      validationLedger = await dbAll(
        `SELECT validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference,
                tolerance, message, details_json, computed_at
         FROM financial_statement_validations
         WHERE statement_id = ?
         ORDER BY computed_at DESC, check_code ASC`,
        [statementId],
        { fallback: false }
      );
      versions = await dbAll(
        `SELECT version_no, version_kind, readiness_status, change_summary, created_at
         FROM financial_statement_versions
         WHERE statement_id = ?
         ORDER BY version_no DESC
         LIMIT 12`,
        [statementId],
        { fallback: false }
      );
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      values = await dbAll(
        `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_row, fsv.mapping_status, fsv.is_manually_corrected,
              FALSE as is_non_financial, NULL as classification_reason,
              fsl.line_code, fsl.line_name, fsl.line_name_pl
       FROM financial_statement_values fsv
       LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
       WHERE fsv.statement_id = ? ORDER BY fsv.source_row`,
        [statementId]
      );
      qualityRuns = [];
      ingestRuns = [];
      extractedSections = [];
      repairSessions = [];
      mappingCandidates = [];
      validationLedger = [];
      versions = [];
    }

    const { notes, ...stmtData } = stmt;
    const activeValues = Array.isArray(values)
      ? values.filter((value: any) => !value?.is_non_financial)
      : [];
    const totalLineCount = Array.isArray(activeValues) ? activeValues.length : 0;
    const mappedLineCount = Array.isArray(values)
      ? activeValues.filter((value: any) => value?.line_code).length
      : 0;
    const unmappedLineCount = Math.max(0, totalLineCount - mappedLineCount);
    const validationMessages = stmt.validation_messages ? JSON.parse(stmt.validation_messages) : [];
    const latestVersionSnapshot = await loadLatestStatementVersionSnapshot(statementId);
    const readiness = evaluateStatementReadiness({
      rawStatus: stmt.status,
      statementType: stmt.statement_type,
      validationStatus: stmt.validation_status,
      currency: stmt.currency,
      scaling: stmt.scaling,
      validationMessages,
      values: (values || []).map((value: any) => ({
        canonicalLineId: value.canonical_line_id,
        value: Number(value.value || 0),
        isNonFinancial: !!value.is_non_financial,
      })),
    });
    res.json({
      // FIN-005: `stmtData` carries the raw DATE columns from Postgres; without
      // this the statement-detail response ships JS Date objects (and any
      // legacy raw `Date.toString()` label) straight to the workspace.
      ...serializeRowPeriodFields(stmtData),
      totalLineCount,
      mappedLineCount,
      unmappedLineCount,
      nonFinancialLineCount: Array.isArray(values)
        ? values.filter((value: any) => !!value?.is_non_financial).length
        : 0,
      isWorkable: readiness.isReady,
      readinessStatus: readiness.readinessStatus,
      readinessScore: readiness.readinessScore,
      readinessSummary: readiness.summary,
      readinessReasonCodes: readiness.reasonCodes,
      validationMessages,
      qualityRuns: qualityRuns || [],
      ingestRuns: ingestRuns || [],
      extractedSections: extractedSections || [],
      repairSessions: repairSessions || [],
      mappingCandidates: mappingCandidates || [],
      validationLedger: validationLedger || [],
      versions: versions || [],
      latestVersionNo: Number(latestVersionSnapshot?.versionNo || stmt.values_version || 0),
      values: values || [],
    });
  })
);

router.get(
  '/:id/document-intelligence/search',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const query = String(req.query.q || '').trim();
    if (!query) return res.status(400).json({ error: 'q is required' });

    const stmt = await getStatementOrFail(statementId, orgId, res);
    if (!stmt) return;

    const matches = await searchStatementDocumentIntelligence({
      statementId,
      organizationId: orgId,
      query,
      limit: Number(req.query.limit || 5) || 5,
    });
    res.json({
      statementId,
      query,
      matches,
      authoritativeForNumbers: false,
    });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Check if ID is a pack first (frontend sends pack IDs from the list view)
    const packRows = (await dbAll(
      `SELECT id FROM financial_statement_packs WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    )) as any[];
    if (packRows?.length) {
      const childStatements = (await dbAll(
        `SELECT id FROM financial_statements WHERE statement_pack_id = ?`,
        [id]
      )) as any[];
      const childIds = (childStatements || []).map((s: any) => String(s.id));
      for (const stmtId of childIds) {
        await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [stmtId]);
        await dbRun(`DELETE FROM financial_statement_validations WHERE statement_id = ?`, [stmtId]);
        await dbRun(`DELETE FROM financial_statement_mapping_candidates WHERE statement_id = ?`, [
          stmtId,
        ]);
        await dbRun(`DELETE FROM financial_statement_candidate_rows WHERE statement_id = ?`, [
          stmtId,
        ]);
        await dbRun(`DELETE FROM financial_statement_extracted_sections WHERE statement_id = ?`, [
          stmtId,
        ]);
        await dbRun(`DELETE FROM financial_statement_source_artifacts WHERE statement_id = ?`, [
          stmtId,
        ]);
        await dbRun(`DELETE FROM financial_statement_quality_runs WHERE statement_id = ?`, [
          stmtId,
        ]);
        await dbRun(`DELETE FROM financial_statement_ingest_runs WHERE statement_id = ?`, [stmtId]);
        await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [stmtId]);
      }
      await dbRun(`DELETE FROM financial_statement_validations WHERE statement_pack_id = ?`, [id]);
      await dbRun(`DELETE FROM financial_statement_packs WHERE id = ?`, [id]);
      return res.json({ success: true, deleted: id, statementsDeleted: childIds.length });
    }

    // Fallback: treat as individual statement ID
    const stmt = await getStatementOrFail(id, orgId, res);
    if (!stmt) return;

    if (stmt.status === 'confirmed') {
      return res
        .status(400)
        .json({ error: 'Cannot delete confirmed statement. Archive it instead.' });
    }

    await detachStatementFromPack(id);
    await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [id]);
    await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [id]);

    res.json({ success: true, deleted: id });
  })
);

// ════════════════════════════════════════════════
// T051: Ratio Analysis
// ════════════════════════════════════════════════

router.get(
  '/ratios/catalog',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json(getRatioCatalog());
  })
);

router.get(
  '/:id/ratios',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const result = await computeRatios(String(req.params.id), orgId);
      res.json(result);
    } catch (e: any) {
      return res.status(404).json({ error: e.message });
    }
  })
);

router.post(
  '/ratios/growth',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentStatementId, previousStatementId } = req.body;
    if (!currentStatementId || !previousStatementId) {
      return res.status(400).json({ error: 'currentStatementId and previousStatementId required' });
    }
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const growthRatios = await computeGrowthRatios(currentStatementId, previousStatementId, orgId);
    res.json(growthRatios);
  })
);

router.get(
  '/benchmarks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const benchmarks = await getBenchmarks(orgId);
    res.json(benchmarks);
  })
);

router.put(
  '/benchmarks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const {
      ratioCode,
      industry,
      region,
      companySize,
      periodYear,
      p25,
      median,
      p75,
      targetMin,
      targetMax,
      sourceLabel,
    } = req.body;
    if (!ratioCode) return res.status(400).json({ error: 'ratioCode required' });

    const id = await upsertBenchmark({
      organizationId: orgId,
      ratioCode,
      industry,
      region,
      companySize,
      periodYear,
      p25,
      median,
      p75,
      targetMin,
      targetMax,
      sourceLabel,
      createdBy: req.user?.id,
    });

    res.json({ success: true, id });
  })
);

// ════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════

async function getStatementOrFail(
  id: string,
  organizationId: string | undefined,
  res: Response
): Promise<any | null> {
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const rows = (await dbAll(
    `SELECT * FROM financial_statements WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  )) as any[];
  if (!rows?.length) {
    res.status(404).json({ error: 'Statement not found' });
    return null;
  }
  return rows[0];
}

export default router;
