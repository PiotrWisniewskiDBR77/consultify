/**
 * V8 Finance bridge — org-scoped runtime dashboard and bounded
 * analysis/operator continuity slices under /api/v8/finance.
 *
 * @module routes/v8/finance.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import {
  FILE_UPLOAD_SIGNATURE_MISMATCH_CODE,
  sniffFileSignature,
  upload,
} from '../../middleware/fileUpload.middleware.js';
import { extractTextFromBuffer as extractDocumentTextFromBuffer } from '../../services/documentTextExtractor.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { listBudgets } from '../../services/budgetingService.js';
import { searchStatementDocumentIntelligence } from '../../services/documentIntelligenceService.js';
import { ensureCanonicalRegistryInDatabase } from '../../services/financeCanonicalRegistrySyncService.js';
import { financeLegacyCutoverGuard } from '../../services/financeLegacyCutover.js';
import {
  requireActiveMembership,
  requireFinanceEditorMembership,
} from '../../services/legacyCutover/requireActiveMembership.js';
import {
  getFinanceTraceId,
  logFinanceError,
  logFinanceEvent,
} from '../../services/financeDiagnosticsService.js';
import {
  assessCoverage,
  classifyMappingTier,
  isLikelySubtotalOrAggregate,
  isNonFinancialByPolicy,
} from '../../services/financeMappingPolicy.js';
import { serializeRowPeriodFields } from '../../services/financePeriodFormat.js';
import { buildStatementAnalytics } from '../../services/financeStatementAnalyticsService.js';
import {
  approveAnalysis,
  archiveAnalysis,
  createAnalysis,
  getAnalysisInsights,
  getAnalysisRatios,
  listAnalyses,
  runFullAnalysis,
  updateAnalysis,
} from '../../services/financialAnalysisService.js';
import { appraiseComputeResult } from '../../services/financialModelAppraisalAdapter.js';
import {
  addEvent,
  approveModel,
  computeModel,
  createModel,
  deleteEvent,
  findIdempotentResource,
  getModel,
  getOutputs,
  getValidations,
  listCaseScenarios,
  listEvents,
  listModels,
  persistComputeResult,
  recordIdempotentResource,
  reseedModelFromSource,
  setBaseline,
  updateModel,
  withFinancialModelIdempotencyLock,
} from '../../services/financialModelingService.js';
import {
  getStatementPackDetail,
  listStatementPacks,
  recomputeStatementPackForOrganization,
  syncStatementToPack,
} from '../../services/financialStatementPackService.js';
import {
  getStatementDetail,
  listStatements,
} from '../../services/financialStatementReadService.js';
import type { DetectionResult } from '../../services/financialStatementService.js';
import {
  appendCfoDerivedMappingSuggestions,
  autoMapLines,
  classifyStatementDocument,
  cleanupUnpersistedUpload,
  confirmStatement as confirmFinancialStatement,
  createStatement,
  detectContainedStatementTypes,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  failIdempotentUpload,
  backfillStatementValueSourcePages,
  finalizeIdempotentUpload,
  getIdempotencyKey,
  getLatestStatementIngestRun,
  IdempotencyKeyTooLongError,
  isStructuredStatementInput,
  loadPersistedStatementCandidateRows,
  loadStatementSourceText,
  locateStatementSections,
  MAX_IDEMPOTENCY_KEY_CHARS,
  persistStatementCandidateRows,
  persistStatementExtractedSections,
  persistStatementMappingCandidates,
  persistStatementValidationLedger,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  reserveIdempotentUpload,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  saveStatementValues,
  sha256Hex,
  snapshotCanonicalStatementVersion,
  startStatementIngestRun,
  updateStatementIngestRun,
  updateStatementMetadata,
  updateStatementReadinessState,
  updateStatementStatus,
  validateStatement,
  withStatementUploadIdempotencyLock,
} from '../../services/financialStatementService.js';
import { saveStatementValuesFlow } from '../../services/financialStatementValueWriteService.js';
import { stageSelectedStatementSections } from '../../services/statementMultiSectionImportService.js';
import { confirmGovernedStatement } from '../../services/finance/canonical/statementGovernedConfirmationService.js';
import { recordManualMappingDecision } from '../../services/finance/canonical/statementManualMappingDecisionService.js';
import {
  readStatementSourceReceipt,
  StatementGovernanceError,
} from '../../services/finance/canonical/statementSourceReceiptService.js';
import {
  applyLlmProposals,
  applySecondPassProposals,
  mapDuplicateConflictLinesWithLLM,
  mapUnmappedLinesWithLLM,
} from '../../services/llmFinancialMappingService.js';
import {
  analyzeAndExtractFullDocument,
  extractFinancialLinesWithAnthropic,
  extractFinancialLinesWithOpenAI,
} from '../../services/openAIFinancialExtractionService.js';
import PDFParserService from '../../services/pdfParserService.js';
import { computeRatios } from '../../services/ratioAnalysisService.js';
import { getFinanceDashboard } from '../../services/v8/financeIntegrationService.js';
import { listValuations } from '../../services/valuationService.js';
import {
  type BudgetGranularity,
  BudgetRegistrationError,
  registerBudget,
} from '../../services/finance/canonical/budgetRegistrationService.js';
import {
  applyBudgetLineCommand,
  BudgetLineCommandError,
  type BudgetLinePatch,
} from '../../services/finance/canonical/budgetLineCommandService.js';
import {
  BudgetProjectionCommandError,
  projectBudgetScenario,
  updateBudgetScenarioAdjustments,
} from '../../services/finance/canonical/budgetProjectionCommandService.js';
import {
  approveBudgetCommand,
  BudgetApprovalCommandError,
} from '../../services/finance/canonical/budgetApprovalCommandService.js';
import {
  discardBudgetCommand,
  BudgetDiscardCommandError,
} from '../../services/finance/canonical/budgetDiscardCommandService.js';
import {
  importBudgetDocumentCommand,
  BudgetDocumentImportCommandError,
} from '../../services/finance/canonical/budgetDocumentImportCommandService.js';
import {
  linkBudgetInitiativeCommand,
  BudgetInitiativeLinkCommandError,
} from '../../services/finance/canonical/budgetInitiativeLinkCommandService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

const BUDGET_IMPORT_MIME_BY_EXT: Record<string, ReadonlySet<string>> = {
  pdf: new Set(['application/pdf']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  xls: new Set(['application/vnd.ms-excel']),
  csv: new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ]),
};

async function verifyBudgetImportFile(
  sourceFile: Buffer,
  originalName: string,
  mimeType: string
): Promise<void> {
  const ext = path.extname(originalName).slice(1).toLowerCase();
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  if (!BUDGET_IMPORT_MIME_BY_EXT[ext]?.has(mime) || !sniffFileSignature(sourceFile, ext)) {
    throw new BudgetDocumentImportCommandError(
      FILE_UPLOAD_SIGNATURE_MISMATCH_CODE,
      400,
      'File content does not match an allowed PDF, XLS, XLSX, or CSV type'
    );
  }
  if (ext === 'xls') {
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (!sourceFile.subarray(0, 8).equals(ole2)) {
      throw new BudgetDocumentImportCommandError(
        FILE_UPLOAD_SIGNATURE_MISMATCH_CODE,
        400,
        'Legacy XLS requires an OLE2 workbook signature'
      );
    }
  }
  if (ext === 'xlsx') {
    try {
      const zip = await JSZip.loadAsync(sourceFile);
      if (!zip.file('xl/workbook.xml') || !zip.file('[Content_Types].xml')) throw new Error();
    } catch {
      throw new BudgetDocumentImportCommandError(
        FILE_UPLOAD_SIGNATURE_MISMATCH_CODE,
        400,
        'XLSX content is not a spreadsheet workbook'
      );
    }
  }
}

function resolveBudgetImportExpectedVersion(req: AuthRequest): number {
  const bodyRaw = req.body?.expectedVersion;
  const headerRaw = req.header('x-expected-budget-version');
  const bodyPresent = bodyRaw !== undefined && bodyRaw !== null && String(bodyRaw).trim() !== '';
  const headerPresent = headerRaw !== undefined && headerRaw !== null && headerRaw.trim() !== '';
  const parse = (raw: unknown): number | null => {
    const literal = String(raw).trim();
    if (!/^[1-9]\d*$/.test(literal)) return null;
    const value = Number(literal);
    return Number.isSafeInteger(value) ? value : null;
  };
  const body = bodyPresent ? parse(bodyRaw) : null;
  const header = headerPresent ? parse(headerRaw) : null;
  if (
    (!bodyPresent && !headerPresent) ||
    (bodyPresent && body === null) ||
    (headerPresent && header === null)
  ) {
    throw new BudgetDocumentImportCommandError(
      'INVALID_EXPECTED_VERSION',
      400,
      'A positive integer expectedVersion is required'
    );
  }
  if (body !== null && header !== null && body !== header) {
    throw new BudgetDocumentImportCommandError(
      'EXPECTED_VERSION_CONFLICT',
      400,
      'Body and header expectedVersion values must match'
    );
  }
  return body ?? (header as number);
}

// FIN-MVP-CUTOVER-001: observe the complete legacy surface and fail closed
// only for writers with an explicitly proven canonical successor.
// The V8 namespace authenticates and attaches tenant identity, but it does not
// re-read membership state. Writers need this per-request wall so a revoked
// token cannot mutate Finance until its JWT expires.
router.use(requireActiveMembership);
// Statement reads remain available to every active tenant member. Every V8
// Statement mutation, including upload and the detect/extract/map/confirm
// stages, must re-read the established Finance editor role from membership.
router.use((req, res, next) => {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (!mutating || !req.path.startsWith('/statements')) return next();
  void requireFinanceEditorMembership(req as AuthRequest, res, next);
});
router.use(financeLegacyCutoverGuard);

const FINANCE_PACKAGE_ROOT = process.env.FINANCE_PACKAGE_ROOT || '/data/finance-packages';

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safePackageName(value: unknown): string {
  return (
    String(value || 'finance')
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'finance'
  );
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function addRowsSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Array<Record<string, unknown>>
): void {
  const sheet = workbook.addWorksheet(name.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 18 },
  });
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  sheet.columns = (keys.length ? keys : ['status']).map((key) => ({
    header: key,
    key,
    width: Math.min(48, Math.max(14, key.length + 2)),
  }));
  if (rows.length === 0) sheet.addRow({ status: 'No records' });
  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value && typeof value === 'object' ? JSON.stringify(value) : value,
        ])
      )
    );
  }
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B53' } };
  header.alignment = { vertical: 'middle' };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, keys.length) },
  };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4F8' } };
    }
    row.alignment = { vertical: 'top', wrapText: true };
  });
}

/** Stable contract id for V8 Finance read responses. */
export const V8_FINANCE_READ_CONTRACT = 'finance_runtime_read_v1';

function financeMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_READ_CONTRACT };
}

/**
 * FIN-005 Codex round-4 Blocker 1 — v8's twin of the legacy
 * `buildUploadAndAnalyzeRecoveryResponseBody` (finance-statements.routes.ts).
 * Recovery only ever has ONE tracked statementId (the pre-existing
 * `primaryStatementId`-only simplification this endpoint already made for
 * Fix 2's idempotency wiring), so it is built using the SAME shape as this
 * endpoint's existing single-statement "fallback" success path, wrapped in
 * v8's `{ data, meta }` envelope — never the multi-section "smart" shape,
 * which cannot be honestly reconstructed from one id alone.
 */
async function buildV8UploadRecoveryResponseBody(
  statementId: string,
  organizationId: string
): Promise<Record<string, unknown> | null> {
  const stmt = await dbGet<any>(
    `SELECT id, statement_pack_id FROM financial_statements WHERE id = ? AND organization_id = ?`,
    [statementId, organizationId]
  );
  if (!stmt) return null;
  return {
    data: {
      success: true,
      mode: 'fallback',
      statementPackId: stmt.statement_pack_id || null,
      statementIds: [stmt.id],
      analysis: null,
      message: 'Recovered a previously-completed upload for this Idempotency-Key.',
      recovered: true,
    },
    meta: financeMeta(),
  };
}

async function ensureStatementIngestRun(params: {
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
}) {
  const existingRunId = await getLatestStatementIngestRun(params.statementId);
  if (existingRunId) {
    return existingRunId;
  }
  if (!params.organizationId) {
    return null;
  }
  return await startStatementIngestRun({
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

function normalizeStatementTypeInput(value: unknown): 'P&L' | 'BS' | 'CF' | null {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'PL' || normalized === 'P&L') return 'P&L';
  if (normalized === 'BS') return 'BS';
  if (normalized === 'CF') return 'CF';
  return null;
}

const DB_ALLOWED_PARSE_METHODS = new Set(['text_extraction', 'ocr', 'manual']);

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
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, parseMethod: 'csv_import' };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const fs = await import('fs');
      const XLSX = await import('xlsx');
      const buffer = fs.readFileSync(filePath);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

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
        lines.push('');
      }

      return { text: lines.join('\n').trim(), parseMethod: 'text_extraction' };
    } catch (e: any) {
      // FIN-005 Codex review Blocker 4: this used to swallow EVERY parse
      // failure (corrupt file, unsupported/unreadable structure, etc.) into
      // a fake empty-string "success", which then flowed into
      // analyzeAndExtractFullDocument / the heuristic fallback and created a
      // real Statement from garbage/empty content with a 201 — never
      // surfacing the failure. Throw instead, mirroring legacy's
      // `extractTextFromFile` in finance-statements.routes.ts, whose
      // existing outer try/catch in `performUploadAndAnalyze` (below)
      // already turns any thrown error into a proper 422. Scope-limited:
      // this does NOT port over legacy's zip-bomb/cell-count guards or any
      // other legacy-specific logic — only stops the false success.
      throw new Error(`Excel parsing failed: ${e?.message || 'unknown error'}`);
    }
  }
  return { text: '', parseMethod: 'manual' };
}

/**
 * GET /api/v8/finance/dashboard
 * Ingestion pipeline summary, initiative economics linkage health, unresolved
 * escalations count, stale cloud-linked refreshes, and promotion gate pass rate
 * for the V8 org context.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const dashboard = await getFinanceDashboard(organizationId);
    return res.json({
      data: { dashboard },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/models',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const models = await listModels(organizationId);
    return res.json({
      data: { models, count: models.length },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/models',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body ?? {};
    const name = String(body.name || '').trim();
    const startDate = String(body.startDate || '').trim();
    if (!name || !startDate) {
      return res.status(400).json({ error: 'name and startDate required' });
    }

    // FIN-03/FIN-04 idempotency: a double-click save or a network retry that
    // replays this exact POST with the same Idempotency-Key must return the
    // ORIGINAL Investment Case / scenario, never mint a second one. Accepts
    // either the standard `Idempotency-Key` header or a body field, so both
    // a manual retry test and a header-aware HTTP client work.
    const idempotencyKey =
      (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key']) ||
      (typeof body.idempotencyKey === 'string' && body.idempotencyKey) ||
      undefined;
    try {
      const createOnce = async () => {
        if (idempotencyKey) {
          const existingId = await findIdempotentResource(
            organizationId,
            idempotencyKey,
            'create_model'
          );
          if (existingId) {
            const existing = await getModel(existingId, organizationId);
            if (existing) return { status: 200, model: existing, idempotentReplay: true };
          }
        }
        const modelId = await createModel({
          organizationId,
          projectId: body.projectId,
          initiativeId: body.initiativeId,
          name,
          description: body.description,
          currency: body.currency,
          horizonMonths: body.horizonMonths,
          startDate,
          granularity: body.granularity,
          scenario: body.scenario,
          assumptions: body.assumptions,
          createdBy: userId,
          sourceStatementId: body.sourceStatementId,
          sourceStatementPackId: body.sourceStatementPackId,
          caseId:
            typeof body.caseId === 'string' && body.caseId.trim() ? body.caseId.trim() : undefined,
        });
        if (idempotencyKey)
          await recordIdempotentResource(organizationId, idempotencyKey, 'create_model', modelId);
        const model = await getModel(modelId, organizationId);
        return {
          status: 201,
          model: model ?? { id: modelId, name, start_date: startDate },
          idempotentReplay: false,
        };
      };
      const outcome = idempotencyKey
        ? await withFinancialModelIdempotencyLock(
            organizationId,
            idempotencyKey,
            'create_model',
            createOnce
          )
        : await createOnce();
      return res.status(outcome.status).json({
        data: {
          model: outcome.model,
          ...(outcome.idempotentReplay ? { idempotentReplay: true } : {}),
        },
        meta: financeMeta(),
      });
    } catch (e: any) {
      const message = String(e?.message || 'Model creation failed');
      if (
        message.includes('Statement') ||
        message.includes('critical lines') ||
        message.includes('seed') ||
        message.includes('Investment Case not found') ||
        message.includes('Source project not found') ||
        message.includes('Source initiative not found')
      ) {
        return res.status(400).json({ error: message });
      }
      throw e;
    }
  })
);

router.get(
  '/models/:modelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const sourceStatement =
      model.source_statement_id != null
        ? await (async () => {
            try {
              return await dbGet(
                `SELECT id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, status, readiness_status
                 FROM financial_statements
                 WHERE id = ?`,
                [model.source_statement_id]
              );
            } catch {
              return dbGet(
                `SELECT id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, status
                 FROM financial_statements
                 WHERE id = ?`,
                [model.source_statement_id]
              );
            }
          })()
        : null;
    const sourceStatementPack =
      model.source_statement_pack_id != null
        ? await dbGet(
            `SELECT id, entity_name, period_start, period_end, period_label, currency, scaling,
                    pack_status, pack_readiness_status, pack_readiness_score
             FROM financial_statement_packs
             WHERE id = ?`,
            [model.source_statement_pack_id]
          )
        : null;
    const events = await listEvents(modelId);

    return res.json({
      data: {
        model: {
          ...model,
          events,
          // FIN-005: these two rows are selected straight from Postgres, so
          // `period_start`/`period_end` are JS `Date` objects and a legacy
          // `period_label` may still hold a raw `Date.toString()`. Before
          // FIN-005 the Atelier model had no source pack, so this path never
          // carried a period at all — binding the model to the FY2014 pack is
          // exactly what activates it. Serialize like every other read boundary.
          source_statement: sourceStatement ? serializeRowPeriodFields(sourceStatement) : null,
          source_statement_pack: sourceStatementPack
            ? serializeRowPeriodFields(sourceStatementPack)
            : null,
        },
      },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/models/:modelId/validations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const validations = await getValidations(modelId);
    const summary = {
      total: validations.length,
      pass: validations.filter((item: any) => item.status === 'pass').length,
      fail: validations.filter((item: any) => item.status === 'fail').length,
      warning: validations.filter((item: any) => item.status === 'warning').length,
    };

    return res.json({
      data: { validations, summary },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/models/:modelId/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const scenario =
      typeof req.query.scenario === 'string' && req.query.scenario.trim()
        ? String(req.query.scenario).trim()
        : undefined;
    const outputs = await getOutputs(modelId, scenario);
    const grouped: Record<
      string,
      Record<string, Array<{ lineCode: string; lineName: string; value: number }>>
    > = {};
    for (const row of outputs as any[]) {
      if (!grouped[row.period_label]) grouped[row.period_label] = {};
      if (!grouped[row.period_label][row.statement_type]) {
        grouped[row.period_label][row.statement_type] = [];
      }
      grouped[row.period_label][row.statement_type].push({
        lineCode: row.line_code,
        lineName: row.line_name,
        value: row.value,
      });
    }

    return res.json({
      data: { raw: outputs, grouped },
      meta: financeMeta(),
    });
  })
);

/**
 * GET /models/:modelId/appraisal — FIN-005/FIN-006 golden-flow closer.
 *
 * NPV / IRR / payback for a model, derived from its OWN canonical compute
 * (`computeModel()`) fed through the canonical appraisal engine
 * (`investmentAppraisalService.appraise()`, via `appraiseComputeResult`).
 * Read-only: `computeModel()` only SELECTs the model and its events, and this
 * handler persists nothing.
 *
 * Rate resolution (never a silent default):
 *   1. `?discountRatePct=`/`?hurdleRatePct=` query params, if given, ALWAYS win
 *      (matches investmentAppraisalService's own "never hardcoded" invariant —
 *      an explicit caller-supplied rate always overrides anything stored).
 *   2. Else, `model.assumptions_json.discountRatePct` / `.hurdleRatePct`, if
 *      present (canonical per-model rate — see financialModelAppraisalAdapter.ts
 *      module doc: `financial_models` has no `discount_rate` column, so a rate
 *      explicitly recorded in assumptions_json is the model's own canonical
 *      value). `hurdleRatePct` defaults to `discountRatePct` when only one of
 *      the two is present, at either resolution layer.
 *   3. Else — 400. No number is ever invented at this layer.
 *
 * Reopen determinism: this recomputes from the model's stored events on every
 * call. Same events + same resolved rates => byte-identical result, with no
 * cached/materialized state to go stale.
 */
router.get(
  '/models/:modelId/appraisal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // `getModel()` already JSON.parse()s assumptions_json into an object.
    const assumptions = (model.assumptions_json || {}) as Record<string, unknown>;
    const assumptionsDiscountRatePct =
      typeof assumptions.discountRatePct === 'number' &&
      Number.isFinite(assumptions.discountRatePct)
        ? assumptions.discountRatePct
        : undefined;
    const assumptionsHurdleRatePct =
      typeof assumptions.hurdleRatePct === 'number' && Number.isFinite(assumptions.hurdleRatePct)
        ? assumptions.hurdleRatePct
        : undefined;

    const discountRatePctRaw = req.query.discountRatePct;
    let discountRatePct: number | undefined;
    if (discountRatePctRaw !== undefined) {
      discountRatePct = Number(discountRatePctRaw);
      if (!Number.isFinite(discountRatePct)) {
        return res.status(400).json({
          error:
            'discountRatePct must be a finite number (percent, e.g. 10 for 10%) when provided.',
        });
      }
    } else if (assumptionsDiscountRatePct !== undefined) {
      discountRatePct = assumptionsDiscountRatePct;
    }
    if (discountRatePct === undefined) {
      return res.status(400).json({
        error:
          'discountRatePct is required — pass it as a query param, or set model.assumptions_json.discountRatePct.',
      });
    }

    const hurdleRatePctRaw = req.query.hurdleRatePct;
    let hurdleRatePct: number;
    if (hurdleRatePctRaw !== undefined) {
      hurdleRatePct = Number(hurdleRatePctRaw);
      if (!Number.isFinite(hurdleRatePct)) {
        return res
          .status(400)
          .json({ error: 'hurdleRatePct must be a finite number when provided.' });
      }
    } else if (assumptionsHurdleRatePct !== undefined) {
      hurdleRatePct = assumptionsHurdleRatePct;
    } else {
      hurdleRatePct = discountRatePct;
    }

    const computeResult = await computeModel(modelId);
    const appraisal = appraiseComputeResult(computeResult, { discountRatePct, hurdleRatePct });

    return res.json({
      data: appraisal,
      meta: financeMeta(),
    });
  })
);

router.post(
  '/models/:modelId/compute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const result = await computeModel(modelId);
    await persistComputeResult(modelId, result, model.scenario || 'base');
    const validationSummary = {
      total: result.validations.length,
      pass: result.validations.filter((item: any) => item.status === 'pass').length,
      fail: result.validations.filter((item: any) => item.status === 'fail').length,
      warning: result.validations.filter((item: any) => item.status === 'warning').length,
    };

    return res.json({
      data: {
        success: true,
        overallStatus: result.overallStatus,
        periodCount: result.periods.length,
        validationSummary,
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/models/:modelId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // FIN-03 idempotency: a double-click "save version" retry with the same
    // Idempotency-Key returns the already-approved outcome instead of
    // bumping the version a second time.
    const idempotencyKey =
      (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key']) ||
      (typeof (req.body ?? {}).idempotencyKey === 'string' && (req.body ?? {}).idempotencyKey) ||
      undefined;
    // Optional optimistic-concurrency guard: caller may supply the version
    // it last read (body.expectedVersion or X-Model-Version header). If the
    // model moved on since, refuse with 409 rather than silently bump again.
    const expectedVersionRaw = (req.body ?? {}).expectedVersion ?? req.headers['x-model-version'];
    const expectedVersion =
      expectedVersionRaw !== undefined && expectedVersionRaw !== null && expectedVersionRaw !== ''
        ? Number(expectedVersionRaw)
        : undefined;
    if (expectedVersion !== undefined && !Number.isFinite(expectedVersion)) {
      return res.status(400).json({ error: 'expectedVersion must be a finite number' });
    }

    const approveOnce = async () => {
      if (idempotencyKey) {
        const existingId = await findIdempotentResource(
          organizationId,
          idempotencyKey,
          'approve_model'
        );
        if (existingId === modelId) {
          const fresh = await getModel(modelId, organizationId);
          return { httpStatus: 200, status: fresh?.status || 'approved', idempotentReplay: true };
        }
      }
      const result = await approveModel(modelId, userId, { expectedVersion });
      if (!result.success) {
        return {
          httpStatus: result.code === 'VERSION_CONFLICT' ? 409 : 400,
          error:
            result.error ||
            (result.code === 'VERSION_CONFLICT' ? 'Version conflict' : 'Approval failed'),
          code: result.code,
          serverVersion: result.serverVersion,
        };
      }
      if (idempotencyKey)
        await recordIdempotentResource(organizationId, idempotencyKey, 'approve_model', modelId);
      return { httpStatus: 200, status: 'approved', idempotentReplay: false };
    };
    const outcome = idempotencyKey
      ? await withFinancialModelIdempotencyLock(
          organizationId,
          idempotencyKey,
          'approve_model',
          approveOnce
        )
      : await approveOnce();
    if (outcome.error) {
      return res.status(outcome.httpStatus).json({
        error: outcome.error,
        ...(outcome.code ? { code: outcome.code } : {}),
        ...(outcome.serverVersion !== undefined ? { serverVersion: outcome.serverVersion } : {}),
      });
    }
    return res.status(outcome.httpStatus).json({
      data: {
        success: true,
        status: outcome.status,
        ...(outcome.idempotentReplay ? { idempotentReplay: true } : {}),
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/models/:modelId/refresh-source',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    try {
      const result = await reseedModelFromSource(modelId, organizationId);
      return res.json({
        data: { success: true, ...result },
        meta: financeMeta(),
      });
    } catch (e: any) {
      const message = String(e?.message || 'Refresh from source failed');
      if (/not found/i.test(message)) {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }
  })
);

router.put(
  '/models/:modelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // FIN-03 optimistic concurrency: body.expectedVersion or X-Model-Version
    // header, when supplied, pins the UPDATE to that version (CAS pattern —
    // same convention as presentations.routes.ts's deck version guard). A
    // stale write (the model moved on since the caller last read it) gets a
    // 409 VERSION_CONFLICT with the current server version, never a silent
    // overwrite.
    const body = req.body ?? {};
    if (body.sourceStatementPackId) {
      const sourcePack = await dbGet<{ id: string }>(
        `SELECT id FROM financial_statement_packs WHERE id = ? AND organization_id = ?`,
        [String(body.sourceStatementPackId), organizationId]
      );
      if (!sourcePack) {
        return res.status(404).json({ error: 'Source statement pack not found' });
      }
      body.source_statement_pack_id = sourcePack.id;
    }
    const expectedVersionRaw = body.expectedVersion ?? req.headers['x-model-version'];
    const expectedVersion =
      expectedVersionRaw !== undefined && expectedVersionRaw !== null && expectedVersionRaw !== ''
        ? Number(expectedVersionRaw)
        : undefined;
    if (expectedVersion !== undefined && !Number.isFinite(expectedVersion)) {
      return res.status(400).json({ error: 'expectedVersion must be a finite number' });
    }

    const result = await updateModel(modelId, body, { expectedVersion });
    if (!result.success) {
      return res.status(409).json({
        error: 'Version conflict: model was modified concurrently. Refresh and retry.',
        code: 'VERSION_CONFLICT',
        serverVersion: result.serverVersion,
      });
    }
    return res.json({
      data: { success: true },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/models/:modelId/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const body = req.body ?? {};
    if (
      !body.eventType ||
      !body.name ||
      body.amount === undefined ||
      !body.periodStart ||
      !body.cfClassification
    ) {
      return res.status(400).json({
        error: 'eventType, name, amount, periodStart, cfClassification required',
      });
    }

    const id = await addEvent({
      modelId,
      eventType: body.eventType,
      name: body.name,
      description: body.description,
      amount: body.amount,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      recurrence: body.recurrence,
      growthRate: body.growthRate,
      cfClassification: body.cfClassification,
      postingRules: body.postingRules,
      parameters: body.parameters,
      sortOrder: body.sortOrder,
      createdBy: req.user?.id,
    });

    return res.status(201).json({
      data: { success: true, id },
      meta: financeMeta(),
    });
  })
);

router.delete(
  '/events/:eventId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const eventId = String(req.params.eventId || '');
    const event = await dbGet<{ id: string }>(
      `SELECT e.id
       FROM financial_model_events e
       INNER JOIN financial_models m ON m.id = e.model_id
       WHERE e.id = ? AND m.organization_id = ?`,
      [eventId, organizationId]
    );
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await deleteEvent(eventId);
    return res.json({
      data: { success: true, deleted: eventId },
      meta: financeMeta(),
    });
  })
);

router.delete(
  '/models/:modelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }
    if (model.status === 'approved') {
      return res.status(400).json({ error: 'Cannot delete approved model. Archive it instead.' });
    }

    await dbRun(`DELETE FROM financial_model_outputs WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_model_validations WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_model_events WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_models WHERE id = ?`, [modelId]);

    return res.json({
      data: { success: true, deleted: modelId },
      meta: financeMeta(),
    });
  })
);

/**
 * GET /models/:modelId/case — FIN-04: every scenario (Base/Upside/Downside,
 * including the case root itself) that belongs to the same Investment Case
 * as `:modelId`, each carrying `is_baseline`. Org-scoped via listCaseScenarios.
 */
router.get(
  '/models/:modelId/case',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const scenarios = await listCaseScenarios(modelId, organizationId);
    if (scenarios.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    const baseline = scenarios.find((s: any) => s.is_baseline) || null;
    return res.json({
      data: { scenarios, count: scenarios.length, baselineModelId: baseline?.id || null },
      meta: financeMeta(),
    });
  })
);

/**
 * POST /models/:modelId/set-baseline — FIN-04: make `:modelId` the ONE
 * active baseline of its Investment Case, atomically demoting whatever was
 * baseline before (see setBaseline() doc comment in
 * financialModelingService.ts for the transactional design). Audit-logged
 * (who/when/from/to) via financial_model_baseline_audit.
 */
router.post(
  '/models/:modelId/set-baseline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await setBaseline(modelId, organizationId, userId);
    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Model not found' });
    }

    return res.json({
      data: {
        success: true,
        caseId: result.caseId,
        baselineModelId: modelId,
        previousBaselineModelId: result.previousBaselineModelId,
      },
      meta: financeMeta(),
    });
  })
);

/** GET /models/:modelId/versions — list all saved versions of a model (audit trail). */
router.get(
  '/models/:modelId/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const { FinanceEnterpriseService } = await import('../../services/financeEnterpriseService.js');
    const svc = new FinanceEnterpriseService();
    const versions = await svc.getModelVersions(organizationId, modelId);
    return res.json({ data: { versions, count: versions.length }, meta: financeMeta() });
  })
);

/** GET /models/:modelId/versions/diff?from=id1&to=id2 — assumption diff between two versions. */
router.get(
  '/models/:modelId/versions/diff',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to version IDs are required' });
    }
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }
    const { FinanceEnterpriseService } = await import('../../services/financeEnterpriseService.js');
    const svc = new FinanceEnterpriseService();
    const diff = await svc.compareVersions(organizationId, from, to);
    if (!diff) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }
    return res.json({ data: { diff }, meta: financeMeta() });
  })
);

/** BUG-04: GET /models/:modelId/events — list change/event log for a model. */
router.get(
  '/models/:modelId/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    try {
      const events = await listEvents(modelId);
      return res.json({
        data: { events, count: events.length },
        meta: { version: 'v8' as const, contract: 'finance_runtime_read_v1' },
      });
    } catch {
      return res.json({
        data: { events: [], count: 0 },
        meta: { version: 'v8' as const, contract: 'finance_runtime_read_v1' },
      });
    }
  })
);

/** BUG-09: POST /models/:modelId/duplicate — create a copy of an existing model. */
router.post(
  '/models/:modelId/duplicate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sourceModel = await getModel(modelId, organizationId);
    if (!sourceModel || String(sourceModel.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Wspólne pola kopii. project/initiative FK kopiujemy tylko gdy WCIĄŻ istnieją —
    // createModel ma guard cross-org (rzuca 'not found'), a model źródłowy może
    // wskazywać na usuniętą/syntetyczną inicjatywę (BUG-09: 500 przy duplikacji
    // modelu ze stale FK, potwierdzone na demo dla initiative_id seed). Duplikat
    // NIE może padać przez nieaktualny FK źródła — degradujemy bez graftu.
    const baseParams = {
      organizationId,
      name: `${sourceModel.name} (kopia)`,
      description: sourceModel.description || undefined,
      currency: sourceModel.currency || 'PLN',
      horizonMonths: sourceModel.horizon_months || 60,
      startDate: sourceModel.start_date,
      granularity: sourceModel.granularity || 'monthly',
      scenario: sourceModel.scenario || 'base',
      assumptions:
        typeof sourceModel.assumptions_json === 'object' ? sourceModel.assumptions_json : undefined,
      createdBy: userId,
      sourceStatementId: sourceModel.source_statement_id || undefined,
      sourceStatementPackId: sourceModel.source_statement_pack_id || undefined,
    };
    let newModelId: string;
    try {
      newModelId = await createModel({
        ...baseParams,
        projectId: sourceModel.project_id || undefined,
        initiativeId: sourceModel.initiative_id || undefined,
      });
    } catch (err) {
      // Stale source FK (project/initiative usunięte) lub stale sourceStatementPackId
      // (niekompletny pack seed) → kopiuj bez graftu FK i bez seeded assumptions.
      if (
        err instanceof Error &&
        (/not found/i.test(err.message) || /must contain/i.test(err.message))
      ) {
        newModelId = await createModel({
          ...baseParams,
          sourceStatementId: undefined,
          sourceStatementPackId: undefined,
        });
      } else {
        throw err;
      }
    }

    const newModel = await getModel(newModelId, organizationId);
    return res.status(201).json({
      data: { model: newModel ?? { id: newModelId } },
      meta: { version: 'v8' as const, contract: 'finance_runtime_write_v1' },
    });
  })
);

/** BUG-10: POST /models/:modelId/analyze — queue AI analysis of a model (stub). */
router.post(
  '/models/:modelId/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const analysisId = uuidv4();
    return res.status(202).json({
      data: {
        analysisId,
        status: 'queued',
        message: 'Analiza w kolejce',
        modelId,
        type: String(req.body?.type || 'standard'),
      },
      meta: { version: 'v8' as const, contract: 'finance_runtime_write_v1' },
    });
  })
);

/** BUG-11: GET /models/:modelId/outputs/download — download model outputs as JSON file. */
router.get(
  '/models/:modelId/outputs/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const scenario =
      typeof req.query.scenario === 'string' && req.query.scenario.trim()
        ? String(req.query.scenario).trim()
        : undefined;
    const outputs = await getOutputs(modelId, scenario);
    if (!outputs || outputs.length === 0) {
      return res.status(404).json({ error: 'No outputs available for this model' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="model-${modelId}-outputs.json"`);
    return res.json({ modelId, outputs, exportedAt: new Date().toISOString() });
  })
);

/** BUG-12: GET /models/:modelId/export — export full model definition as JSON file. */
router.get(
  '/models/:modelId/export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId, organizationId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const events = await listEvents(modelId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="model-${modelId}.json"`);
    return res.json({
      model: { ...model, events },
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
    });
  })
);

router.post(
  '/budgets/:budgetId/import-document',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ code: 'FILE_REQUIRED', error: 'File required' });
    try {
      const { organizationId } = getV8Context(req);
      const userId = String(req.user?.id || (req.user as any)?.user_id || '');
      const sourceFile = file.buffer || (await fs.readFile(file.path));
      await verifyBudgetImportFile(sourceFile, file.originalname, file.mimetype);
      const expectedVersion = resolveBudgetImportExpectedVersion(req);
      const documentText = await extractDocumentTextFromBuffer(
        sourceFile,
        file.originalname,
        file.mimetype
      );
      const result = await importBudgetDocumentCommand({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        expectedVersion,
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
        sourceFileName: file.originalname,
        sourceMimeType: file.mimetype,
        sourceFileSize: file.size,
        sourceFileSha256: sha256(sourceFile),
        documentText,
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetDocumentImportCommandError) {
        return res
          .status(error.status)
          .json({ code: error.code, error: error.message, ...(error.details || {}) });
      }
      throw error;
    } finally {
      if (file.path) await fs.unlink(file.path).catch(() => undefined);
    }
  })
);

router.post(
  '/budgets/:budgetId/initiatives/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const keys = Object.keys(req.body || {});
      if (keys.length !== 1 || keys[0] !== 'expectedVersion')
        return res.status(400).json({ code: 'INVALID_BODY', error: 'Only expectedVersion is allowed' });
      if (!Number.isInteger(req.body.expectedVersion) || req.body.expectedVersion < 1)
        return res.status(400).json({ code: 'INVALID_EXPECTED_VERSION', error: 'expectedVersion must be a positive integer' });
      const { organizationId } = getV8Context(req);
      const userId = String(req.user?.id || (req.user as any)?.user_id || '');
      const expectedVersion = req.body?.expectedVersion;
      const result = await linkBudgetInitiativeCommand({
        organizationId,
        userId,
        budgetId: String(req.params.budgetId),
        initiativeId: String(req.params.initiativeId),
        expectedVersion,
        idempotencyKey: String(req.header('Idempotency-Key') || ''),
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetInitiativeLinkCommandError)
        return res.status(error.status).json({ code: error.code, error: error.message, ...(error.details || {}) });
      throw error;
    }
  })
);

router.get(
  '/valuations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const valuations = await listValuations(organizationId);
    return res.json({
      data: { valuations, count: valuations.length },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/budgets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const budgets = await listBudgets(organizationId);
    return res.json({
      data: { budgets, count: budgets.length },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/budgets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const allowed = new Set([
      'title',
      'description',
      'projectId',
      'periodStart',
      'periodEnd',
      'granularity',
      'currency',
      'sourceKind',
      'sourceToolSessionId',
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown budget field' });
    }
    if (
      body.granularity !== undefined &&
      body.granularity !== 'monthly' &&
      body.granularity !== 'quarterly' &&
      body.granularity !== 'annual'
    ) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid budget granularity' });
    }
    if (body.sourceKind !== 'tool_session' && body.sourceKind !== 'manual') {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid budget source' });
    }
    const key = String(req.header('Idempotency-Key') || req.header('x-idempotency-key') || '');
    try {
      const result = await registerBudget({
        organizationId,
        userId,
        title: typeof body.title === 'string' ? body.title : '',
        description: typeof body.description === 'string' ? body.description : undefined,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        periodStart: typeof body.periodStart === 'string' ? body.periodStart : '',
        periodEnd: typeof body.periodEnd === 'string' ? body.periodEnd : '',
        granularity: body.granularity as BudgetGranularity | undefined,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        sourceToolSessionId:
          typeof body.sourceToolSessionId === 'string' ? body.sourceToolSessionId : '',
        sourceKind: body.sourceKind,
        idempotencyKey: key,
      });
      return res.status(result.replay ? 200 : 201).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetRegistrationError) {
        return res.status(error.status).json({ code: error.code, error: error.message });
      }
      throw error;
    }
  })
);

router.put(
  '/budgets/:budgetId/lines/:lineId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const allowed = new Set([
      'expectedVersion',
      'baselineValue',
      'source',
      'driverKpiId',
      'driverFormula',
      'isLocked',
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key))) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown budget line field' });
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid expectedVersion' });
    }
    const patch: BudgetLinePatch = {};
    if (body.baselineValue !== undefined) {
      if (typeof body.baselineValue !== 'string')
        return res
          .status(400)
          .json({ code: 'INVALID_BODY', error: 'baselineValue must be a decimal string' });
      patch.baselineValue = body.baselineValue;
    }
    if (body.source !== undefined) patch.source = body.source;
    if (body.driverKpiId !== undefined) patch.driverKpiId = body.driverKpiId;
    if (body.driverFormula !== undefined) patch.driverFormula = body.driverFormula;
    if (body.isLocked !== undefined) patch.isLocked = body.isLocked;
    try {
      const result = await applyBudgetLineCommand({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        lineId: req.params.lineId,
        expectedVersion: body.expectedVersion,
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
        patch,
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetLineCommandError) {
        return res.status(error.status).json({
          code: error.code,
          error: error.message,
          ...(error.details || {}),
        });
      }
      throw error;
    }
  })
);

router.post(
  '/budgets/:budgetId/scenarios/:scenarioId/project',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).some((key) => key !== 'expectedVersion')) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown projection field' });
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid expectedVersion' });
    }
    try {
      const result = await projectBudgetScenario({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        scenarioId: req.params.scenarioId,
        expectedVersion: body.expectedVersion,
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetProjectionCommandError) {
        return res.status(error.status).json({
          code: error.code,
          error: error.message,
          ...(error.details || {}),
        });
      }
      throw error;
    }
  })
);

router.put(
  '/budgets/:budgetId/scenarios/:scenarioId/adjustments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).some((key) => !['expectedVersion', 'adjustments'].includes(key))) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown adjustment field' });
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid expectedVersion' });
    }
    if (
      !body.adjustments ||
      typeof body.adjustments !== 'object' ||
      Array.isArray(body.adjustments)
    ) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid adjustments' });
    }
    try {
      const result = await updateBudgetScenarioAdjustments({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        scenarioId: req.params.scenarioId,
        expectedVersion: body.expectedVersion,
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
        adjustments: body.adjustments,
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetProjectionCommandError) {
        return res.status(error.status).json({
          code: error.code,
          error: error.message,
          ...(error.details || {}),
        });
      }
      throw error;
    }
  })
);

router.post(
  '/budgets/:budgetId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).some((key) => key !== 'expectedVersion')) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown approval field' });
    }
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Invalid expectedVersion' });
    }
    try {
      const result = await approveBudgetCommand({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        expectedVersion: body.expectedVersion,
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetApprovalCommandError) {
        return res.status(error.status).json({
          code: error.code,
          error: error.message,
          ...(error.details || {}),
        });
      }
      throw error;
    }
  })
);

router.delete(
  '/budgets/:budgetId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || (req.user as any)?.user_id || '');
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.keys(body).some((key) => !['expectedVersion', 'reason'].includes(key))) {
      return res.status(400).json({ code: 'INVALID_BODY', error: 'Unknown discard field' });
    }
    try {
      const result = await discardBudgetCommand({
        organizationId,
        userId,
        budgetId: req.params.budgetId,
        expectedVersion: body.expectedVersion,
        reason: typeof body.reason === 'string' ? body.reason : '',
        idempotencyKey: String(
          req.header('Idempotency-Key') || req.header('x-idempotency-key') || ''
        ),
      });
      return res.status(200).json({ data: result, meta: financeMeta() });
    } catch (error) {
      if (error instanceof BudgetDiscardCommandError) {
        return res
          .status(error.status)
          .json({ code: error.code, error: error.message, ...(error.details || {}) });
      }
      throw error;
    }
  })
);

router.get(
  '/statement-packs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string'
        ? String(req.query.readiness).trim().toLowerCase()
        : '';
    const statementPacks = await listStatementPacks(organizationId, readiness);
    return res.json({
      data: { statementPacks, count: statementPacks.length },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/statement-packs/:packId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const packId = String(req.params.packId || '');
    const pack = await getStatementPackDetail(organizationId, packId);
    if (!pack) {
      return res.status(404).json({ error: 'Statement pack not found' });
    }
    return res.json({
      data: { pack },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/statements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string'
        ? String(req.query.readiness).trim().toLowerCase()
        : '';
    const statements = await listStatements(organizationId, readiness);
    return res.json({
      data: { statements, count: statements.length },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/statements/upload-and-analyze',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId: requestedOrganizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ error: 'File required (PDF, XLSX, XLS, or CSV)' });
    }
    if (!userId || !requestedOrganizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const file = uploadedFile;
    const organizationId = requestedOrganizationId;

    const traceId = getFinanceTraceId((req as any).correlationId);

    // FIN-005 Fix 2: this is the endpoint FinancialStatementImportWizard.tsx
    // calls FIRST (the legacy /finance-statements/upload-and-analyze is only
    // the fallback on 400/404/405/501) — same missing-idempotency /
    // missing-cleanup defect as the legacy route, same fix, mirroring its
    // exact pattern. See that route's handler for the full write-up.
    let idempotencyKey: string | null;
    try {
      idempotencyKey = getIdempotencyKey(req);
    } catch (error) {
      if (error instanceof IdempotencyKeyTooLongError) {
        return res.status(400).json({
          error: `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_CHARS} characters`,
          code: 'IDEMPOTENCY_KEY_TOO_LONG',
        });
      }
      throw error;
    }

    // See the legacy /upload-and-analyze handler's doc comment for the full
    // rationale on anyStatementPersisted/primaryStatementId — identical
    // reasoning applies here.
    let anyStatementPersisted = false;
    let primaryStatementId: string | null = null;
    // Codex round-5: EVERY Statement this attempt persists, in creation order
    // — not just the first. `primaryStatementId` alone is what forced
    // recovery to answer a multi-section upload with a single-section
    // `mode: 'fallback'` body; the full set is what lets a retry either
    // replay the whole receipt or compensate all of it.
    const createdStatementIds: string[] = [];

    const performUploadAndAnalyze = async (): Promise<{
      statusCode: number;
      body: Record<string, unknown>;
    }> => {
      await ensureCanonicalRegistryInDatabase();

      let text: string;
      let parseMethod: string;
      try {
        const result = await extractTextFromFile(file.path, file.originalname);
        text = result.text.replace(/\0/g, '');
        parseMethod = result.parseMethod;
      } catch (error: any) {
        return {
          statusCode: 422,
          body: { error: 'File extraction failed', detail: error?.message },
        };
      }

      const effectiveParseMethod = DB_ALLOWED_PARSE_METHODS.has(parseMethod)
        ? parseMethod
        : 'manual';

      logFinanceEvent('statement.smartUpload.started', {
        traceId,
        organizationId,
        userId,
        fileName: file.originalname,
        sizeBytes: file.size,
      });

      const structuredInput = isStructuredStatementInput(file.originalname);
      const analysisResult = structuredInput
        ? null
        : await analyzeAndExtractFullDocument({
            filePath: file.path,
            fileName: file.originalname,
            traceId,
          });

      if (!analysisResult || analysisResult.sections.length === 0) {
        const detection = detectStatementType(text);
        const documentProfile = classifyStatementDocument({
          fileName: file.originalname,
          parseMethod: effectiveParseMethod,
          text,
        });
        const statementId = await createStatement({
          organizationId,
          statementType: detection.statementType === 'UNKNOWN' ? 'P&L' : detection.statementType,
          periodStart: detection.periodStart || `${new Date().getFullYear()}-01-01`,
          periodEnd: detection.periodEnd || `${new Date().getFullYear()}-12-31`,
          periodLabel: detection.periodLabel || undefined,
          currency: detection.currency,
          scaling: detection.scaling,
          sourceFileName: file.originalname,
          sourceFilePath: file.path,
          parseMethod: effectiveParseMethod,
          overallConfidence: detection.confidence,
          documentClass: documentProfile.documentClass,
          extractionStrategy: structuredInput
            ? 'spreadsheet_structured_staged'
            : documentProfile.extractionStrategy,
          templateFamily: documentProfile.templateFamily,
          createdBy: userId,
        });
        anyStatementPersisted = true;
        primaryStatementId = statementId;
        createdStatementIds.push(statementId);
        const statementPackId = structuredInput ? null : await syncStatementToPack(statementId);
        await dbRun(
          `UPDATE financial_statements SET notes = ? WHERE id = ?`,
          [`${text.substring(0, 100000)}`, statementId],
          {
            fallback: false,
          }
        );

        return {
          statusCode: 201,
          body: {
            data: {
              success: true,
              mode: 'fallback',
              statementPackId,
              statementIds: [statementId],
              analysis: null,
              detection: {
                ...detection,
                containedStatementTypes: detectContainedStatementTypes(text),
                containsMultipleStatements: detectContainedStatementTypes(text).length > 1,
                entityName: null,
              },
              message: structuredInput
                ? 'Structured statement staged for explicit detection, mapping, and confirmation.'
                : 'LLM analysis unavailable — created single statement with heuristic detection.',
            },
            meta: financeMeta(),
          },
        };
      }
      const analysis = analysisResult;

      const normalizeLineageLabel = (value: unknown) =>
        String(value || '')
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\b(?:19|20)\d{2}\b/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      const analysisWithLineage = {
        ...analysis,
        sections: analysis.sections.map((section) => {
          const localLines = extractFinancialLines(text, section.statementType, {
            selectedPeriodLabel: analysis.periodLabel,
          }).lines;
          return {
            ...section,
            lines: section.lines.map((line) => {
              if (line.sourcePage != null) return line;
              const normalizedLabel = normalizeLineageLabel(line.originalLabel);
              const matched = localLines.find(
                (candidate) =>
                  normalizeLineageLabel(candidate.originalLabel) === normalizedLabel &&
                  Math.abs(Number(candidate.value) - Number(line.value)) < 0.000001
              );
              return matched
                ? {
                    ...line,
                    sourcePage: matched.sourcePage,
                    sourceRow: line.sourceRow ?? matched.sourceRow,
                  }
                : line;
            }),
          };
        }),
      };
      const missingPageLineage = analysisWithLineage.sections.flatMap((section) =>
        section.lines
          .filter((line) => line.sourcePage == null)
          .map((line) => ({ statementType: section.statementType, label: line.originalLabel }))
      );
      if (missingPageLineage.length > 0) {
        return {
          statusCode: 422,
          body: {
            error: 'PDF page lineage is incomplete; no financial statements were created.',
            code: 'SOURCE_PAGE_LINEAGE_INCOMPLETE',
            missingCount: missingPageLineage.length,
            missing: missingPageLineage.slice(0, 20),
          },
        };
      }

      const proposedPrimaryType = analysisWithLineage.sections[0].statementType;
      const stagedStatementId = await createStatement({
        organizationId,
        statementType: proposedPrimaryType,
        periodStart: analysis.periodStart || `${new Date().getFullYear()}-01-01`,
        periodEnd: analysis.periodEnd || `${new Date().getFullYear()}-12-31`,
        periodLabel: analysis.periodLabel || undefined,
        currency: analysis.currency,
        scaling: analysis.scaling,
        sourceFileName: file.originalname,
        sourceFilePath: file.path,
        parseMethod: effectiveParseMethod,
        overallConfidence: 0,
        documentClass: 'mixed_report',
        extractionStrategy: 'llm_full_document_staged',
        templateFamily: null,
        createdBy: userId,
      });
      anyStatementPersisted = true;
      primaryStatementId = stagedStatementId;
      createdStatementIds.push(stagedStatementId);
      await dbRun(`UPDATE financial_statements SET notes = ? WHERE id = ?`, [
        text.substring(0, 100000),
        stagedStatementId,
      ]);
      return {
        statusCode: 201,
        body: {
          data: {
            success: true,
            mode: 'fallback',
            statementPackId: null,
            statementIds: [stagedStatementId],
            detection: {
              statementType: proposedPrimaryType,
              confidence: 0,
              containedStatementTypes: analysisWithLineage.sections.map(
                (section) => section.statementType
              ),
              containsMultipleStatements: analysisWithLineage.sections.length > 1,
              periodStart: analysis.periodStart,
              periodEnd: analysis.periodEnd,
              periodLabel: analysis.periodLabel,
              currency: analysis.currency,
              scaling: analysis.scaling,
              language: analysis.language,
              entityName: analysis.entityName,
            },
            message: 'Document staged for explicit section, period and mapping review.',
          },
          meta: financeMeta(),
        },
      };

    };

    if (!idempotencyKey) {
      try {
        const { statusCode, body } = await performUploadAndAnalyze();
        if (statusCode >= 400 && !anyStatementPersisted) {
          await cleanupUnpersistedUpload(file.path, 'upload-and-analyze failed (unkeyed, v8)');
        }
        return res.status(statusCode).json(body);
      } catch (error) {
        if (!anyStatementPersisted) {
          await cleanupUnpersistedUpload(file.path, 'upload-and-analyze threw (unkeyed, v8)');
        }
        throw error;
      }
    }

    const key = idempotencyKey;
    const requestHash = sha256Hex(await (await import('fs')).promises.readFile(file.path));

    type LockOutcome =
      | { kind: 'replay'; statusCode: number; body: Record<string, unknown> }
      | { kind: 'recover'; statusCode: number; body: Record<string, unknown> }
      | { kind: 'conflict' }
      | { kind: 'in_progress' }
      | { kind: 'schema_missing' }
      | { kind: 'fresh'; statusCode: number; body: Record<string, unknown> }
      | { kind: 'finalize_failed'; recovered?: boolean };

    const outcome: LockOutcome = await withStatementUploadIdempotencyLock(
      organizationId,
      key,
      async (): Promise<LockOutcome> => {
        const reservation = await reserveIdempotentUpload(organizationId, key, requestHash, userId);

        if (reservation.kind === 'recover_result') {
          // Codex round-5 — MULTI-SECTION recovery: the abandoned attempt's
          // OWN complete response was recorded durably before its finalize
          // failed, and every Statement it names has been re-verified as
          // present and pack-synced. Replay it VERBATIM: same mode, same
          // statementIds, same analysis. No re-extraction, no LLM call, no
          // performUploadAndAnalyze() call, no new Statement/Pack.
          const finalized = await finalizeIdempotentUpload({
            reservationId: reservation.reservationId,
            statementId: reservation.statementIds[0] || '',
            statusCode: reservation.statusCode,
            responseJson: JSON.stringify(reservation.body),
          });
          if (!finalized) {
            // Keep the receipt intact for the next retry — never downgrade a
            // recoverable multi-section attempt into a first-section guess.
            await failIdempotentUpload(reservation.reservationId, reservation.statementIds, {
              statusCode: reservation.statusCode,
              body: reservation.body,
            });
            return { kind: 'finalize_failed' as const, recovered: true };
          }
          return {
            kind: 'recover' as const,
            statusCode: reservation.statusCode,
            body: reservation.body,
          };
        }

        if (reservation.kind === 'recover') {
          // FIN-005 Codex round-4 Blocker 1: a prior attempt for this key
          // already durably completed a real, fully-synced Statement+Pack —
          // reuse it. No re-extraction, no LLM call, no
          // performUploadAndAnalyze() call at all. Only ever reached for a
          // genuinely SINGLE-statement attempt (round-5: a multi-section one
          // either replays its recorded receipt above or is compensated and
          // redone — never reconstructed from one id).
          const body = await buildV8UploadRecoveryResponseBody(
            reservation.statementId,
            organizationId
          );
          if (!body) {
            await failIdempotentUpload(reservation.reservationId, reservation.statementId);
            return { kind: 'finalize_failed' as const, recovered: true };
          }
          const finalized = await finalizeIdempotentUpload({
            reservationId: reservation.reservationId,
            statementId: reservation.statementId,
            statusCode: 201,
            responseJson: JSON.stringify(body),
          });
          if (!finalized) {
            await failIdempotentUpload(reservation.reservationId, reservation.statementId);
            return { kind: 'finalize_failed' as const, recovered: true };
          }
          return { kind: 'recover' as const, statusCode: 201, body };
        }

        if (reservation.kind !== 'owner') {
          if (reservation.kind === 'replay') {
            logFinanceEvent('statement.smartUpload.idempotent_replay', {
              traceId,
              organizationId,
              idempotencyKey: key,
            });
          }
          return reservation;
        }

        let result: { statusCode: number; body: Record<string, unknown> };
        try {
          result = await performUploadAndAnalyze();
        } catch (error) {
          if (!anyStatementPersisted) {
            await cleanupUnpersistedUpload(file.path, 'upload-and-analyze threw (v8)');
          }
          // No complete response exists for a thrown attempt — record only the
          // id set, so a retry can tell "one section (recoverable)" from
          // "several sections (must be compensated and redone)".
          await failIdempotentUpload(reservation.reservationId, createdStatementIds);
          throw error;
        }

        if (result.statusCode >= 400) {
          if (!anyStatementPersisted) {
            await cleanupUnpersistedUpload(file.path, 'upload-and-analyze controlled failure (v8)');
          }
          await failIdempotentUpload(reservation.reservationId, createdStatementIds);
          return { kind: 'fresh' as const, statusCode: result.statusCode, body: result.body };
        }

        const finalized = await finalizeIdempotentUpload({
          reservationId: reservation.reservationId,
          statementId: primaryStatementId || '',
          statusCode: result.statusCode,
          responseJson: JSON.stringify(result.body),
        });
        if (!finalized) {
          logFinanceError(
            'statement.smartUpload.finalize_unconfirmed',
            new Error('finalize UPDATE did not affect the owned reservation row'),
            {
              traceId,
              organizationId,
              idempotencyKey: key,
              reservationId: reservation.reservationId,
            }
          );
          // THE round-5 fix: persist the COMPLETE response this attempt would
          // have returned, alongside every Statement id it created. A retry
          // with the same key replays exactly this — for a multi-section
          // upload that means all sections, not just the first.
          await failIdempotentUpload(reservation.reservationId, createdStatementIds, {
            statusCode: result.statusCode,
            body: result.body,
          });
          return { kind: 'finalize_failed' as const };
        }

        return { kind: 'fresh' as const, statusCode: result.statusCode, body: result.body };
      }
    );

    switch (outcome.kind) {
      case 'conflict':
        await cleanupUnpersistedUpload(
          file.path,
          'idempotency key reused with different content (v8)'
        );
        return res.status(409).json({
          error: 'Idempotency-Key was already used with a different upload',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      case 'in_progress':
        await cleanupUnpersistedUpload(
          file.path,
          'genuinely concurrent in-flight upload for this key (v8)'
        );
        res.setHeader('Retry-After', '5');
        return res.status(409).json({
          error: 'Another upload for this Idempotency-Key is already in progress — retry shortly',
          code: 'UPLOAD_IN_PROGRESS',
        });
      case 'schema_missing':
        await cleanupUnpersistedUpload(
          file.path,
          'idempotency schema unavailable for a keyed upload (v8)'
        );
        return res.status(503).json({
          error:
            'Idempotency-Key support is temporarily unavailable on this server — retry without the header, or contact support',
          code: 'IDEMPOTENCY_SCHEMA_UNAVAILABLE',
        });
      case 'finalize_failed':
        // FIN-005 Blocker 1: on the `recover` path performUploadAndAnalyze()
        // was NEVER called for this request — file.path is not any
        // Statement's sourceFilePath — so it is safe (and necessary) to
        // clean it up here.
        if (outcome.recovered) {
          await cleanupUnpersistedUpload(file.path, 'recovery finalize unconfirmed (v8)');
        }
        return res.status(500).json({
          error: 'Upload completed but could not be durably confirmed — please retry',
          code: 'STATEMENT_UPLOAD_FINALIZE_FAILED',
        });
      case 'replay':
        await cleanupUnpersistedUpload(
          file.path,
          'idempotent replay of a previously completed upload-and-analyze (v8)'
        );
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(outcome.statusCode).json(outcome.body);
      case 'recover':
        // FIN-005 Blocker 1: the CURRENT request's uploaded file was never
        // persisted as any Statement's source — cleaned up here, exactly
        // like `replay`.
        await cleanupUnpersistedUpload(
          file.path,
          'idempotent recovery of a previously-completed upload-and-analyze for this key (v8)'
        );
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(outcome.statusCode).json(outcome.body);
      case 'fresh':
        return res.status(outcome.statusCode).json(outcome.body);
      default: {
        const _exhaustive: never = outcome;
        throw new Error(`Unreachable idempotency outcome: ${JSON.stringify(_exhaustive)}`);
      }
    }
  })
);

router.get(
  '/statements/:statementId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    const statement = await getStatementDetail(organizationId, statementId);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    return res.json({
      data: { statement },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/statements/:statementId/analytics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    const statement = await getStatementDetail(organizationId, statementId);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const requestedLevel = Math.min(3, Math.max(1, Number(req.query.level || 2) || 2)) as 1 | 2 | 3;
    const analytics = await buildStatementAnalytics({
      statementId,
      statementType: String(statement.statement_type || '').toUpperCase() as 'P&L' | 'BS' | 'CF',
      requestedLevel,
      defaultPeriodLabel:
        typeof statement.period_label === 'string' ? statement.period_label : null,
    });

    return res.json({
      data: analytics,
      meta: financeMeta(),
    });
  })
);

router.get(
  '/statements/:statementId/ratios',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    try {
      const ratios = await computeRatios(statementId, organizationId);
      return res.json({
        data: { ratios },
        meta: financeMeta(),
      });
    } catch (error: any) {
      return res.status(404).json({ error: error?.message || 'Statement not found' });
    }
  })
);

router.get(
  '/statements/:statementId/document-intelligence/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'q is required' });
    }
    const statement = await getStatementDetail(organizationId, statementId);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    const rawLimit =
      typeof req.query.limit === 'string' || typeof req.query.limit === 'number'
        ? Number(req.query.limit)
        : 5;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 5;
    const matches = await searchStatementDocumentIntelligence({
      statementId,
      organizationId,
      query,
      limit,
    });
    return res.json({
      data: {
        statementId,
        query,
        matches,
        authoritativeForNumbers: false,
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/statements/:statementId/detect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statementId = String(req.params.statementId || '');
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<
      string,
      any
    > | null;
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const text = await loadStatementSourceText(statementId, String(statement.notes || ''));
    if (!text) {
      return res.status(400).json({ error: 'No extracted text available — re-upload the PDF' });
    }

    const ingestRunId = await ensureStatementIngestRun({
      statementId,
      organizationId,
      createdBy: userId,
      sourceFileName: statement.source_file_name,
      sourceFilePath: statement.source_file_path,
      parseMethod: statement.parse_method,
      documentClass: statement.document_class,
      extractionStrategy: statement.extraction_strategy,
      templateFamily: statement.template_family,
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
      normalizeStatementTypeInput(statement.statement_type) ||
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
      fileName: statement.source_file_name,
      parseMethod: statement.parse_method,
      text,
    });
    const extractionStrategy =
      statement.extraction_strategy === 'spreadsheet_structured_staged'
        ? 'spreadsheet_structured_staged'
        : documentProfile.extractionStrategy;

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
        extractionStrategy,
        templateFamily: documentProfile.templateFamily,
      });
    } catch (error) {
      logger.warn(
        '[V8 Finance] Detect metadata persistence failed; continuing with request-local selection',
        {
          statementId,
          requestedStatementType: req.body?.statementType,
          effectiveStatementType: detection.statementType,
          error: String((error as Error)?.message || error || 'unknown'),
        }
      );
    }

    const statementPackId =
      extractionStrategy === 'spreadsheet_structured_staged'
        ? null
        : await syncStatementToPack(statementId);
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
      extractionStrategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
    });
    if (organizationId) {
      await recordStatementQualityRun({
        statementId,
        organizationId,
        stage: 'detect',
        resultStatus: autoDetection.statementType === 'UNKNOWN' ? 'warning' : 'pass',
        readinessStatus: 'pending',
        strategy: extractionStrategy,
        summary: 'Detection metadata persisted for statement.',
        reasonCodes:
          autoDetection.statementType === 'UNKNOWN'
            ? ['DETECTION_UNKNOWN_FALLBACK']
            : ['DETECTION_METADATA_UPDATED'],
        payload: detection,
        createdBy: userId,
      });
    }

    return res.json({
      data: {
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
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/statements/:statementId/extract',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statementId = String(req.params.statementId || '');
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<
      string,
      any
    > | null;
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const traceId = getFinanceTraceId((req as any).correlationId);
    const text = await loadStatementSourceText(statementId, String(statement.notes || ''));
    if (!text) {
      return res.status(400).json({ error: 'No extracted text' });
    }

    const ingestRunId = await ensureStatementIngestRun({
      statementId,
      organizationId,
      createdBy: userId,
      sourceFileName: statement.source_file_name,
      sourceFilePath: statement.source_file_path,
      parseMethod: statement.parse_method,
      documentClass: statement.document_class,
      extractionStrategy: statement.extraction_strategy,
      templateFamily: statement.template_family,
      rawTextLength: text.length,
    });
    const documentProfile = classifyStatementDocument({
      fileName: statement.source_file_name,
      parseMethod: statement.parse_method,
      text,
    });
    const effectiveStatementType =
      normalizeStatementTypeInput(req.body?.statementType) ||
      normalizeStatementTypeInput(statement.statement_type) ||
      'P&L';
    const effectivePeriodLabel =
      String(req.body?.periodLabel || '').trim() ||
      String(statement.period_label || '').trim() ||
      undefined;
    const effectiveCurrency =
      String(req.body?.currency || '').trim() ||
      String(statement.currency || '').trim() ||
      undefined;
    const effectiveScaling =
      String(req.body?.scaling || '').trim() || String(statement.scaling || '').trim() || undefined;
    const requestedStatementTypes = Array.isArray(req.body?.statementTypes)
      ? req.body.statementTypes
      : [];
    if (requestedStatementTypes.length > 0) {
      try {
        const batch = await stageSelectedStatementSections({
          primaryStatementId: statementId,
          organizationId,
          userId,
          statement,
          text,
          statementTypes: requestedStatementTypes,
          periodLabel: effectivePeriodLabel,
          currency: effectiveCurrency,
          scaling: effectiveScaling,
          entityName: String(req.body?.entityName || '').trim(),
        });
        return res.json({
          data: {
            statementId,
            ingestRunId,
            lines: batch.statements[0]?.lines || [],
            statements: batch.statements,
            selectedStatementTypes: batch.selectedTypes,
            extractionStrategy: 'deterministic_multi_section_staged',
          },
          meta: financeMeta(),
        });
      } catch (error: any) {
        const status = Number(error?.statusCode || 422);
        return res.status(status).json({
          error: error?.message || 'Multi-section extraction failed',
          code: error?.code || 'MULTI_SECTION_EXTRACTION_FAILED',
          statementType: error?.statementType,
        });
      }
    }
    const minimumAiLines =
      effectiveStatementType === 'CF' ? 2 : ['BS', 'P&L'].includes(effectiveStatementType) ? 3 : 2;

    const openAiExtraction =
      documentProfile.documentClass === 'spreadsheet' || documentProfile.documentClass === 'csv'
        ? null
        : await extractFinancialLinesWithOpenAI({
            filePath: statement.source_file_path,
            fileName: statement.source_file_name,
            statementType: effectiveStatementType,
            traceId,
          });
    const anthropicExtraction =
      documentProfile.documentClass === 'spreadsheet' || documentProfile.documentClass === 'csv'
        ? null
        : !openAiExtraction || openAiExtraction.lines.length < minimumAiLines
          ? await extractFinancialLinesWithAnthropic({
              text,
              fileName: statement.source_file_name,
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
      scaling:
        effectiveScaling === 'units' ||
        effectiveScaling === 'thousands' ||
        effectiveScaling === 'millions' ||
        effectiveScaling === 'billions'
          ? effectiveScaling
          : undefined,
    });
    const extractionRaw =
      aiExtraction && aiExtraction.lines.length > 0
        ? aiExtraction
        : extractFinancialLines(text, effectiveStatementType, {
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
    const persistedExtractionStrategy =
      statement.extraction_strategy === 'spreadsheet_structured_staged'
        ? 'spreadsheet_structured_staged'
        : strategy;

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
      extractionStrategy: persistedExtractionStrategy,
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
    await backfillStatementValueSourcePages(statementId);
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
      extractionStrategy: persistedExtractionStrategy,
      templateFamily: documentProfile.templateFamily,
      rawTextLength: text.length,
      reasonCodes:
        extraction.lines.length > 0 ? ['EXTRACTION_LINES_FOUND'] : ['EXTRACTION_NO_LINES'],
      summary: {
        sections: persistedSections.length,
        candidateRows: candidateRows.length,
      },
    });
    if (organizationId) {
      await recordStatementQualityRun({
        statementId,
        organizationId,
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

    return res.json({
      data: {
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
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/statements/:statementId/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statementId = String(req.params.statementId || '');
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<
      string,
      any
    > | null;
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const traceId = getFinanceTraceId((req as any).correlationId);
    const ingestRunId = await ensureStatementIngestRun({
      statementId,
      organizationId,
      createdBy: userId,
      sourceFileName: statement.source_file_name,
      sourceFilePath: statement.source_file_path,
      parseMethod: statement.parse_method,
      documentClass: statement.document_class,
      extractionStrategy: statement.extraction_strategy,
      templateFamily: statement.template_family,
    });

    const requestLines = Array.isArray(req.body?.lines) ? req.body.lines : null;
    const sourceLines =
      requestLines && requestLines.length > 0
        ? requestLines
        : await loadPersistedStatementCandidateRows({ statementId, ingestRunId });
    if (!sourceLines || sourceLines.length === 0) {
      return res.status(400).json({ error: 'No extracted candidate rows available for mapping' });
    }

    const heuristicMapped = await autoMapLines(sourceLines, statement.statement_type, {
      organizationId,
      templateFamily: statement.template_family,
    });

    const unmappedCount = heuristicMapped.filter(
      (line) => !line.suggestedCanonicalId && !line.isNonFinancial && line.originalLabel
    ).length;

    let llmMappingResult = null;
    if (unmappedCount > 0) {
      try {
        llmMappingResult = await mapUnmappedLinesWithLLM({
          allLines: heuristicMapped,
          statementType: statement.statement_type,
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
      (line) => line.mappingReason === 'duplicate_candidate_conflict'
    ).length;
    let llmSecondPassResult = null;
    if (conflictCount > 0) {
      try {
        llmSecondPassResult = await mapDuplicateConflictLinesWithLLM({
          allLines: mapped,
          statementType: statement.statement_type,
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

    appendCfoDerivedMappingSuggestions(mapped, {
      statementType: statement.statement_type,
      currency: statement.currency,
      scaling: statement.scaling,
      periodLabel: statement.period_label,
      sourceFileName: statement.source_file_name,
    });

    const candidateRows = await persistStatementCandidateRows({
      statementId,
      ingestRunId,
      rows: mapped,
      statementType: statement.statement_type,
      currency: statement.currency,
      scaling: statement.scaling,
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
    await backfillStatementValueSourcePages(statementId);

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
          (line) => line.suggestedCanonicalId && !line.mappingReason?.startsWith('llm_mapping')
        ).length,
        llmMapped: mapped.filter((line) => line.mappingReason?.startsWith('llm_mapping')).length,
        llmProvider: llmMappingResult?.provider || null,
        llmDurationMs: llmMappingResult?.durationMs || 0,
      },
    });
    if (organizationId) {
      await recordStatementQualityRun({
        statementId,
        organizationId,
        stage: 'map',
        resultStatus: mapped.some((line) => line.suggestedCanonicalId) ? 'pass' : 'warning',
        readinessStatus: 'recoverable',
        strategy: statement.template_family || statement.extraction_strategy || 'alias_engine',
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
    for (let index = 0; index < mapped.length; index += 1) {
      (mapped[index] as any).mappingTier = tierResults[index].tier;
    }
    const policyAssessment = assessCoverage(tierResults, mapped.length);

    return res.json({
      data: {
        statementId,
        ingestRunId,
        mappedLines: mapped,
        policyAssessment,
      },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/statements/:statementId/confirm',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statementId = String(req.params.statementId || '');
    const expectedValuesVersion = req.body?.expectedValuesVersion;
    const sourceReceiptId = String(req.body?.sourceReceiptId || '').trim();
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (!Number.isInteger(expectedValuesVersion) || expectedValuesVersion < 0) {
      return res
        .status(400)
        .json({ error: 'expectedValuesVersion must be a non-negative integer' });
    }
    if (!sourceReceiptId || !idempotencyKey) {
      return res.status(400).json({ error: 'sourceReceiptId and Idempotency-Key are required' });
    }

    let registration;
    try {
      registration = await confirmGovernedStatement({
        statementId,
        organizationId,
        userId,
        sourceReceiptId,
        expectedValuesVersion,
        idempotencyKey,
      });
    } catch (error) {
      if (error instanceof StatementGovernanceError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    return res.json({
      data: {
        success: true,
        statementId,
        statementPackId: registration.statementPackId,
        sourceReceiptId,
        valuesVersion: expectedValuesVersion,
        canonicalArtifactId: registration.artifactId,
        canonicalBusinessVersionId: registration.businessVersionId,
        canonicalWorkingRevisionId: registration.workingRevisionId,
        canonicalReplay: registration.replayed,
        status: 'confirmed',
      },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/statements/:statementId/source-receipt',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    try {
      const receipt = await readStatementSourceReceipt({
        organizationId,
        statementId: String(req.params.statementId),
        userId,
      });
      return res.json({ data: { receipt }, meta: financeMeta() });
    } catch (error) {
      if (error instanceof StatementGovernanceError)
        return res.status(error.status).json({ error: error.message, code: error.code });
      throw error;
    }
  })
);

router.post(
  '/statements/:statementId/manual-mapping-decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    const statementId = String(req.params.statementId);
    const sourceRow = Number(req.body?.sourceRow);
    const candidate = Number.isInteger(sourceRow)
      ? await dbGet<any>(
          `SELECT id FROM financial_statement_candidate_rows WHERE statement_id=? AND source_row=? ORDER BY created_at DESC,id DESC LIMIT 1`,
          [statementId, sourceRow]
        )
      : null;
    if (!candidate) return res.status(404).json({ error: 'Candidate row not found' });
    try {
      const decision = await recordManualMappingDecision({
        organizationId,
        statementId,
        candidateRowId: candidate.id,
        canonicalLineId: String(req.body?.canonicalLineId || '') || null,
        action: 'ACCEPT',
        reason: String(req.body?.reason || ''),
        sourceReceiptId: String(req.body?.sourceReceiptId || ''),
        expectedValuesVersion: Number(req.body?.expectedValuesVersion),
        idempotencyKey: String(req.header('Idempotency-Key') || ''),
        userId,
      });
      return res.json({ data: { decision }, meta: financeMeta() });
    } catch (error) {
      if (error instanceof StatementGovernanceError)
        return res.status(error.status).json({ error: error.message, code: error.code });
      throw error;
    }
  })
);

router.put(
  '/statements/:statementId/values',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const statementId = String(req.params.statementId || '');
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<
      string,
      any
    > | null;
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    const values = req.body?.values;
    if (!Array.isArray(values)) {
      return res.status(400).json({ error: 'values array required' });
    }

    const result = await saveStatementValuesFlow({
      statementId,
      organizationId,
      userId,
      statement,
      values,
    });

    return res.json({
      data: result,
      meta: financeMeta(),
    });
  })
);

router.get(
  '/canonical-lines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const canonicalLines = await dbAll<any>(
      `SELECT id, statement_type, line_code, line_name, line_name_en, line_name_pl, parent_line_id, sort_order,
              aggregation_level, required_level, sign_convention, is_total, is_subtotal, is_computed,
              formula_json, deaggregation_ready, taxonomy_version
       FROM financial_statement_lines
       WHERE is_system = TRUE OR organization_id = ?
       ORDER BY statement_type, sort_order`,
      [organizationId]
    );
    return res.json({
      data: { canonicalLines, count: canonicalLines.length },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analyses = await listAnalyses(organizationId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
    });
    return res.json({
      data: { analyses, count: analyses.length },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const analysis = await createAnalysis(organizationId, req.body ?? {}, userId);
    return res.status(201).json({
      data: { analysis },
      meta: financeMeta(),
    });
  })
);

router.put(
  '/analyses/:analysisId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const body = req.body;
    const allowed = new Set([
      'title',
      'description',
      'periods',
      'statementData',
      'currency',
      'sourceStatementIds',
      'sourceStatementPackId',
      'rebuildFromStatements',
    ]);
    const invalid =
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.has(key)) ||
      (body.title !== undefined &&
        (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 300)) ||
      (body.description !== undefined &&
        (typeof body.description !== 'string' || body.description.length > 10_000)) ||
      (body.currency !== undefined &&
        (typeof body.currency !== 'string' || body.currency.length > 10)) ||
      (body.periods !== undefined &&
        (!Array.isArray(body.periods) ||
          body.periods.some((value: unknown) => typeof value !== 'string' || value.length > 60))) ||
      (body.sourceStatementIds !== undefined &&
        (!Array.isArray(body.sourceStatementIds) ||
          body.sourceStatementIds.some(
            (value: unknown) => typeof value !== 'string' || value.length > 64
          ))) ||
      (body.statementData !== undefined &&
        (!body.statementData ||
          typeof body.statementData !== 'object' ||
          Array.isArray(body.statementData))) ||
      (body.sourceStatementPackId !== undefined &&
        typeof body.sourceStatementPackId !== 'string') ||
      (body.rebuildFromStatements !== undefined && typeof body.rebuildFromStatements !== 'boolean');
    if (invalid)
      return res.status(400).json({ error: 'Invalid analysis update', code: 'INVALID_BODY' });

    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId]
    );
    if (!existing) return res.status(404).json({ error: 'Analysis not found' });

    await updateAnalysis(organizationId, analysisId, body);
    return res.json({
      data: { success: true, analysisId },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/analyses/:analysisId/ratios',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const analyses = await listAnalyses(organizationId);
    const analysisExists = analyses.some((analysis) => String(analysis.id) === analysisId);
    if (!analysisExists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    const ratios = await getAnalysisRatios(analysisId);
    return res.json({
      data: { ratios },
      meta: financeMeta(),
    });
  })
);

router.get(
  '/analyses/:analysisId/initiative-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const analyses = await listAnalyses(organizationId);
    const analysisExists = analyses.some((analysis) => String(analysis.id) === analysisId);
    if (!analysisExists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    const insights = await getAnalysisInsights(analysisId);
    const proposals = (insights || [])
      .filter((insight: any) =>
        ['action', 'risk', 'driver'].includes(String(insight.insight_type || insight.type || ''))
      )
      .map((insight: any) => ({
        id: String(insight.id),
        title: String(insight.title || 'Initiative'),
        summary: String(insight.description || ''),
        kind: String(insight.insight_type || insight.type || 'action'),
        priority: Number(insight.priority || 0),
      }));

    return res.json({
      data: { proposals },
      meta: financeMeta(),
    });
  })
);

// FIN-06 mandate: no direct Finance→Initiative creation ("Zakaz bezpośredniego
// tworzenia Initiative przez Finance"). This endpoint used to write straight
// into `initiatives` (either via `funnelCreateInitiative` or a raw INSERT,
// depending on `INITIATIVE_FUNNEL_ENABLED`) from `financial_analysis_insights`
// proposals — a source shape distinct from the three Finance source types
// FIN-06 wires up (Investment Case / Statement Pack / Valuation
// Recommendation), so giving it a proper Candidate pipeline is out of scope
// here. Disabled fail-closed instead: it must never create an Initiative
// again, regardless of the funnel flag.
router.post(
  '/analyses/:analysisId/initiatives',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.status(410).json({
      error:
        'Direct Finance analysis -> Initiative creation has been disabled. Use the Candidate ' +
        'handoff endpoints instead: for Investment-Case-shaped sources, ' +
        'GET/POST /api/finance/candidate-handoff/investment-case/:modelId/{preview,confirm}.',
      code: 'DIRECT_INITIATIVE_CREATION_DISABLED',
    });
  })
);

router.post(
  '/analyses/:analysisId/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const result = await runFullAnalysis(organizationId, analysisId);
    return res.json({
      data: { success: true, result },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/analyses/:analysisId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const analysisId = String(req.params.analysisId || '');
    await approveAnalysis(organizationId, analysisId, userId);
    return res.json({
      data: { success: true },
      meta: financeMeta(),
    });
  })
);

router.post(
  '/analyses/:analysisId/archive',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const archived = await archiveAnalysis(organizationId, analysisId);
    if (!archived) return res.status(404).json({ error: 'Analysis not found' });
    return res.json({
      data: { success: true, analysisId, status: 'ARCHIVED' },
      meta: financeMeta(),
    });
  })
);

router.delete(
  '/analyses/:analysisId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const row = await dbGet<any>(
      `SELECT id, status FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    if (row.status === 'APPROVED') {
      return res
        .status(400)
        .json({ error: 'Cannot delete approved analysis. Archive it instead.' });
    }
    await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id = ?`, [analysisId]);
    await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id = ?`, [analysisId]);
    await dbRun(`DELETE FROM financial_analyses WHERE id = ?`, [analysisId]);
    return res.json({
      data: { success: true, deleted: analysisId },
      meta: financeMeta(),
    });
  })
);

// ==========================================
// P05-B: Finance Lane E2E endpoints
// ==========================================

const P05_HTTP_STATUS: Record<string, number> = {
  P05_CONCURRENT_RUN_EXISTS: 409,
  P05_PERMISSION_DENIED: 403,
  P05_SWITCHOVER_MISCONFIGURED: 409,
  P05_INVALID_OUTCOME: 422,
  P05_RUN_NOT_FOUND: 404,
  P05_SNAPSHOT_NOT_FOUND: 404,
};

function sendP05Error(res: Response, err: unknown): Response {
  const code = (err as { code?: string })?.code;
  const status = (code && P05_HTTP_STATUS[code]) || 500;
  const rawMessage = err instanceof Error ? err.message : String(err);
  // Known P05_* codes carry a deliberately-authored, safe domain message
  // (e.g. "Concurrent run already exists for lane X"). An unmapped code
  // (falls to 500) means an unexpected exception — never echo its raw
  // text (DB-driver / stack detail) to the client (H6.4 500-leak sweep).
  const isKnownCode = Boolean(code && P05_HTTP_STATUS[code]);
  if (!isKnownCode) {
    logger.error('[v8/finance] P05 lane operation failed', { err });
  }
  const message = isKnownCode
    ? rawMessage
    : 'An unexpected error occurred. Please try again later.';
  return res.status(status).json({ error: message, code: code || 'P05_INTERNAL_ERROR' });
}

router.post(
  '/lane/start',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { startLaneRun } = await import('../../services/v8/financeLaneService.js');
    const { versionType } = req.body || {};
    try {
      const run = await startLaneRun({
        organizationId,
        actor: userId,
        versionType: versionType || 'current',
      });
      return res.json({ data: run, meta: { version: 'v8', contract: 'finance_lane_v1' } });
    } catch (err) {
      return sendP05Error(res, err);
    }
  })
);

router.post(
  '/lane/:runId/advance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const runId = req.params.runId?.trim();
    if (!runId)
      return res.status(400).json({ error: 'runId required', code: 'P05_RUN_ID_REQUIRED' });
    const { outcome, detail } = req.body || {};
    if (!outcome)
      return res.status(400).json({ error: 'outcome required', code: 'P05_OUTCOME_REQUIRED' });
    const { advanceLaneStep } = await import('../../services/v8/financeLaneService.js');

    const context: {
      hasPermission?: boolean;
      blockedCapability?: string;
      modelUpdatedAt?: string | null;
    } = {};
    try {
      const permRow = await (
        await import('../../utils/DbPromise.js')
      ).get<Record<string, unknown>>(
        `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?`,
        [organizationId, userId],
        { fallback: true }
      );
      const mutationRoles = ['owner', 'admin', 'editor', 'finance_admin', 'finance_editor'];
      context.hasPermission = permRow ? mutationRoles.includes(String(permRow.role || '')) : false;
      if (!context.hasPermission) context.blockedCapability = 'finance_mutation';
    } catch {
      context.hasPermission = false;
      context.blockedCapability = 'permission_check_failed';
    }
    try {
      const modelRow = await (
        await import('../../utils/DbPromise.js')
      ).get<Record<string, unknown>>(
        `SELECT MAX(updated_at) as max_updated FROM financial_model_versions WHERE organization_id = ?`,
        [organizationId],
        { fallback: true }
      );
      context.modelUpdatedAt = modelRow?.max_updated ? String(modelRow.max_updated) : null;
    } catch {
      context.modelUpdatedAt = null;
    }

    try {
      const run = await advanceLaneStep(runId, organizationId, userId, outcome, detail, context);
      return res.json({ data: run, meta: { version: 'v8', contract: 'finance_lane_v1' } });
    } catch (err) {
      return sendP05Error(res, err);
    }
  })
);

router.get(
  '/lane/:runId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const runId = req.params.runId?.trim();
    if (!runId)
      return res.status(400).json({ error: 'runId required', code: 'P05_RUN_ID_REQUIRED' });
    const { getLaneRun } = await import('../../services/v8/financeLaneService.js');
    const run = await getLaneRun(runId, organizationId);
    if (!run) return res.status(404).json({ error: 'Run not found', code: 'P05_RUN_NOT_FOUND' });
    return res.json({ data: run, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.get(
  '/lane',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { getLaneRuns } = await import('../../services/v8/financeLaneService.js');
    const runs = await getLaneRuns(organizationId);
    return res.json({ data: runs, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.post(
  '/lane/:runId/mutation-audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const runId = req.params.runId?.trim();
    if (!runId)
      return res.status(400).json({ error: 'runId required', code: 'P05_RUN_ID_REQUIRED' });
    const { mutationType, targetEntity, previousValue, newValue, outcome } = req.body || {};
    if (!mutationType || !targetEntity || !newValue || !outcome) {
      return res.status(400).json({
        error: 'mutationType, targetEntity, newValue, outcome required',
        code: 'P05_AUDIT_PARAMS_REQUIRED',
      });
    }
    const { recordMutationAudit } = await import('../../services/v8/financeLaneService.js');
    const audit = await recordMutationAudit({
      organizationId,
      runId,
      mutationType,
      targetEntity,
      previousValue,
      newValue,
      outcome,
      actor: userId,
    });
    return res.json({ data: audit, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.get(
  '/lane/:runId/mutation-audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const runId = req.params.runId?.trim();
    const { getMutationAudits } = await import('../../services/v8/financeLaneService.js');
    const audits = await getMutationAudits(organizationId, runId || undefined);
    return res.json({ data: audits, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.post(
  '/versions/snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { versionType, snapshotData } = req.body || {};
    if (!versionType || !snapshotData)
      return res.status(400).json({
        error: 'versionType and snapshotData required',
        code: 'P05_VERSION_PARAMS_REQUIRED',
      });
    const { createVersionSnapshot } = await import('../../services/v8/financeLaneService.js');
    const snapshot = await createVersionSnapshot({
      organizationId,
      versionType,
      snapshotData,
      actor: userId,
    });
    return res.json({ data: snapshot, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.post(
  '/versions/:snapshotId/finalize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const snapshotId = req.params.snapshotId?.trim();
    if (!snapshotId)
      return res
        .status(400)
        .json({ error: 'snapshotId required', code: 'P05_SNAPSHOT_ID_REQUIRED' });
    const { finalizeSwitchover } = await import('../../services/v8/financeLaneService.js');
    try {
      const snapshot = await finalizeSwitchover(snapshotId, organizationId, userId);
      return res.json({ data: snapshot, meta: { version: 'v8', contract: 'finance_lane_v1' } });
    } catch (err) {
      return sendP05Error(res, err);
    }
  })
);

router.get(
  '/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { getVersionSnapshots } = await import('../../services/v8/financeLaneService.js');
    const versionType = req.query.versionType ? String(req.query.versionType) : undefined;
    const snapshots = await getVersionSnapshots(organizationId, versionType as any);
    return res.json({ data: snapshots, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

router.get(
  '/lane/:runId/kpi-coherence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const runId = req.params.runId?.trim();
    if (!runId)
      return res.status(400).json({ error: 'runId required', code: 'P05_RUN_ID_REQUIRED' });
    const { checkKpiLinkageCoherence } = await import('../../services/v8/financeLaneService.js');
    const result = await checkKpiLinkageCoherence(organizationId, runId);
    return res.json({ data: result, meta: { version: 'v8', contract: 'finance_lane_v1' } });
  })
);

/**
 * Durable, tenant-scoped Finance acceptance package. The ZIP is materialized on
 * the persistent /data volume while its ownership, checksum and lineage are
 * registered in v8_output_artifacts. No database values are rewritten.
 */
router.post(
  '/exports/packages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const packId = String(req.body?.packId || '').trim();
    if (!packId) return res.status(400).json({ error: 'packId required' });

    const pack = await dbGet<any>(
      `SELECT * FROM financial_statement_packs WHERE id = ? AND organization_id = ?`,
      [packId, organizationId]
    );
    if (!pack) return res.status(404).json({ error: 'Statement pack not found' });

    const statements = await dbAll<any>(
      `SELECT * FROM financial_statements
       WHERE statement_pack_id = ? AND organization_id = ? AND COALESCE(status, '') <> 'archived'
       ORDER BY statement_type, period_end`,
      [packId, organizationId]
    );
    const statementIds = statements.map((row) => String(row.id));
    if (!statements.some((row) => row.statement_type === 'P&L')) {
      return res.status(422).json({ error: 'A ready P&L statement is required for ratio export' });
    }
    const rawValues = statementIds.length
      ? await dbAll<any>(
          `SELECT fsv.*, fsl.line_code, fsl.line_name, fs.statement_type, fs.period_label,
                  fs.currency, fs.scaling
           FROM financial_statement_values fsv
           JOIN financial_statements fs ON fs.id = fsv.statement_id
           LEFT JOIN financial_statement_lines fsl ON fsl.id = fsv.canonical_line_id
           WHERE fs.organization_id = ? AND fs.statement_pack_id = ?
           ORDER BY fs.statement_type, fs.period_end, fsl.sort_order, fsv.source_row`,
          [organizationId, packId]
        )
      : [];
    // `financial_statement_values.value` is `numeric` (CO-9 precision fix,
    // server/migrations/20260810_finance_v3_co9_statement_money_numeric.sql). node-pg has no
    // type parser registered for numeric/OID 1700 anywhere in this repo, so it arrives as a
    // STRING. These rows are handed straight to `addRowsSheet()`, which writes each field into
    // an ExcelJS cell verbatim — a string would land as a TEXT cell, so the exported ratio
    // workbook would show the amounts as "number stored as text" and every downstream SUM in
    // that sheet would silently evaluate to 0. Coerce once, here, at the query boundary.
    const values = rawValues.map((row: any) => ({
      ...row,
      value: row?.value === null || row?.value === undefined ? row?.value : Number(row.value),
    }));
    const sources = statementIds.length
      ? await dbAll<any>(
          `SELECT a.*, fs.statement_type, fs.period_label
           FROM financial_statement_source_artifacts a
           JOIN financial_statements fs ON fs.id = a.statement_id
           WHERE fs.organization_id = ? AND fs.statement_pack_id = ?
           ORDER BY a.created_at`,
          [organizationId, packId]
        )
      : [];
    const models = await dbAll<any>(
      `SELECT * FROM financial_models
       WHERE organization_id = ? AND source_statement_pack_id = ? AND COALESCE(status, '') <> 'archived'
       ORDER BY scenario, name`,
      [organizationId, packId]
    );
    const modelIds = models.map((row) => String(row.id));
    const outputs = modelIds.length
      ? await dbAll<any>(
          `SELECT o.* FROM financial_model_outputs o
           JOIN financial_models m ON m.id = o.model_id
           WHERE m.organization_id = ? AND m.source_statement_pack_id = ?
           ORDER BY m.scenario, o.period_date, o.statement_type, o.line_code`,
          [organizationId, packId]
        )
      : [];
    const validations = modelIds.length
      ? await dbAll<any>(
          `SELECT v.* FROM financial_model_validations v
           JOIN financial_models m ON m.id = v.model_id
           WHERE m.organization_id = ? AND m.source_statement_pack_id = ?
           ORDER BY m.scenario, v.period_date, v.check_code`,
          [organizationId, packId]
        )
      : [];
    const valuations = modelIds.length
      ? await dbAll<any>(
          `SELECT v.* FROM valuations v
           JOIN financial_models m ON m.id = v.source_id
           WHERE v.organization_id = ? AND v.source_type = 'financial_model'
             AND m.organization_id = ? AND m.source_statement_pack_id = ?
           ORDER BY v.title`,
          [organizationId, organizationId, packId]
        )
      : [];
    const valuationSnapshots = valuations.length
      ? await dbAll<any>(
          `SELECT s.* FROM valuation_snapshots s
           JOIN valuations v ON v.id = s.valuation_id
           JOIN financial_models m ON m.id = v.source_id
           WHERE v.organization_id = ? AND m.organization_id = ? AND m.source_statement_pack_id = ?
           ORDER BY s.valuation_id, s.version`,
          [organizationId, organizationId, packId]
        )
      : [];
    const analyses = await dbAll<any>(
      `SELECT * FROM financial_analyses
       WHERE organization_id = ? AND source_statement_pack_id = ? AND COALESCE(status, '') <> 'ARCHIVED'
       ORDER BY updated_at DESC`,
      [organizationId, packId]
    );

    const ratioAnchor = statements.find((row) => row.statement_type === 'P&L');
    const ratioResult = await computeRatios(String(ratioAnchor.id), organizationId);
    const generatedAt = new Date().toISOString();
    const acceptance = {
      generatedAt,
      organizationId,
      packId,
      entityName: pack.entity_name,
      sourceStatementCount: statements.length,
      statementTypes: Array.from(new Set(statements.map((row) => row.statement_type))),
      periods: Array.from(new Set(statements.map((row) => row.period_label || row.period_end))),
      ratioCoverage: ratioResult.coverageSummary,
      modelCount: models.length,
      scenarios: Array.from(new Set(models.map((row) => row.scenario))),
      valuationCount: valuations.length,
      failedModelChecks: validations.filter((row) => row.status === 'fail').length,
      nonFiniteRatios: ratioResult.ratios.filter(
        (row) => row.value !== null && !Number.isFinite(Number(row.value))
      ).length,
      monetaryUnits: Array.from(
        new Set(valuations.map((row) => parseObject(row.results).monetaryUnit).filter(Boolean))
      ),
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Consultify Finance';
    workbook.created = new Date(generatedAt);
    workbook.modified = new Date(generatedAt);
    workbook.properties.date1904 = false;
    addRowsSheet(workbook, 'README', [
      {
        company: pack.entity_name,
        packId,
        currency: pack.currency,
        scale: pack.scaling,
        generatedAt,
        note: 'Amounts retain the source currency and scale. Missing values remain unavailable, never silent zero.',
      },
    ]);
    addRowsSheet(workbook, 'Historicals', values);
    addRowsSheet(workbook, 'Ratios 34', ratioResult.ratios as any);
    addRowsSheet(workbook, 'Scenarios', models);
    addRowsSheet(workbook, 'Forecast P&L BS CF', outputs);
    addRowsSheet(workbook, 'Checks', validations);
    addRowsSheet(workbook, 'Valuations', valuations);
    addRowsSheet(workbook, 'Valuation Snapshots', valuationSnapshots);
    addRowsSheet(workbook, 'Sources Audit', sources);
    addRowsSheet(workbook, 'Analyses', analyses);
    const workbookBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Reopen in-process before publication: a corrupt workbook never becomes a durable export.
    const reopenedWorkbook = new ExcelJS.Workbook();
    await reopenedWorkbook.xlsx.load(workbookBuffer as any);
    if (reopenedWorkbook.worksheets.length !== workbook.worksheets.length) {
      return res.status(500).json({ error: 'Workbook reopen verification failed' });
    }

    const sourceManifest = [] as Array<Record<string, unknown>>;
    for (const statement of statements) {
      const statementValues = values.filter((row) => row.statement_id === statement.id);
      const pages = statementValues
        .map((row) => Number(row.source_page))
        .filter((page) => Number.isFinite(page) && page > 0);
      const sourceArtifacts = sources
        .filter((row) => row.statement_id === statement.id)
        .map((row) => ({
          artifactId: row.id,
          artifactType: row.artifact_type,
          stage: row.stage,
          version: row.version_no,
          contentSha256: sha256(
            String(row.content_text || row.content_json || row.metadata_json || '')
          ),
        }));
      let sourceFileSha256: string | null = null;
      let sourceFileSizeBytes: number | null = null;
      const sourceFilePath = String(statement.source_file_path || '');
      const resolvedSourcePath = sourceFilePath ? path.resolve(sourceFilePath) : '';
      if (resolvedSourcePath.startsWith(`${path.resolve('/data/uploads')}${path.sep}`)) {
        try {
          const sourceFile = await fs.readFile(resolvedSourcePath);
          sourceFileSha256 = sha256(sourceFile);
          sourceFileSizeBytes = sourceFile.length;
        } catch {
          sourceFileSha256 = null;
          sourceFileSizeBytes = null;
        }
      }
      sourceManifest.push({
        statementId: statement.id,
        statementType: statement.statement_type,
        period: statement.period_label || statement.period_end,
        currency: statement.currency,
        scaling: statement.scaling,
        sourceFileName: statement.source_file_name || null,
        sourceFilePath: statement.source_file_path || null,
        sourceFileSha256,
        sourceFileSizeBytes,
        sourcePageStart: pages.length ? Math.min(...pages) : null,
        sourcePageEnd: pages.length ? Math.max(...pages) : null,
        artifactCount: sourceArtifacts.length,
        artifacts: sourceArtifacts,
      });
    }
    const readme =
      `# Consultify Finance acceptance package\n\n` +
      `Company: ${pack.entity_name}\n\nPack: ${packId}\n\nCurrency / scale: ${pack.currency} / ${pack.scaling}\n\n` +
      `Generated: ${generatedAt}\n\nThe workbook contains historical statements, 34-ratio catalogue output, ` +
      `Base/Bull/Bear models, assumptions, forecast P&L/BS/CF, validations, valuations, sensitivity/tornado data, sources and audit lineage. ` +
      `Unavailable inputs are explicitly represented as null/NA.\n\n` +
      `## Tenant-scoped restore\n\nUse this ZIP only while authenticated to organization ${organizationId}. ` +
      `Verify MANIFEST.sha256.json and the ZIP checksum returned by the Finance package API before restoration. ` +
      `Restore through the normal statement upload and Finance model/valuation endpoints; do not write directly to the database. ` +
      `The source-manifest.json identifiers and audit-backup.json provide the ordered reconstruction inputs.\n`;
    const files: Record<string, Buffer> = {
      'finance-workbook.xlsx': workbookBuffer,
      'README.md': Buffer.from(readme),
      'source-manifest.json': Buffer.from(jsonText(sourceManifest)),
      'historicals.json': Buffer.from(jsonText({ statements, values })),
      'ratios.json': Buffer.from(jsonText(ratioResult)),
      'scenarios.json': Buffer.from(jsonText({ models, outputs })),
      'assumptions.json': Buffer.from(
        jsonText(
          models.map((row) => ({
            modelId: row.id,
            scenario: row.scenario,
            assumptions: parseObject(row.assumptions_json),
          }))
        )
      ),
      'valuations.json': Buffer.from(jsonText({ valuations, valuationSnapshots })),
      'checks.json': Buffer.from(jsonText(validations)),
      'evidence-acceptance.json': Buffer.from(jsonText(acceptance)),
      'audit-backup.json': Buffer.from(
        jsonText({
          organizationId,
          pack,
          statements,
          values,
          sources,
          analyses,
          models,
          outputs,
          validations,
          valuations,
          valuationSnapshots,
        })
      ),
    };
    const manifest = {
      algorithm: 'SHA-256',
      generatedAt,
      organizationId,
      packId,
      files: Object.fromEntries(Object.entries(files).map(([name, data]) => [name, sha256(data)])),
    };
    files['MANIFEST.sha256.json'] = Buffer.from(jsonText(manifest));
    const zip = new JSZip();
    for (const [name, data] of Object.entries(files)) zip.file(name, data);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipChecksum = sha256(zipBuffer);
    const artifactId = uuidv4();
    const exportId = uuidv4();
    const orgDir = path.join(FINANCE_PACKAGE_ROOT, safePackageName(organizationId));
    await fs.mkdir(orgDir, { recursive: true });
    const fileName = `${safePackageName(pack.entity_name)}-${artifactId}.zip`;
    const filePath = path.join(orgDir, fileName);
    await fs.writeFile(filePath, zipBuffer, { mode: 0o600 });
    const metadata = {
      kind: 'finance_acceptance_package_v1',
      packId,
      entityName: pack.entity_name,
      fileName,
      filePath,
      zipSha256: zipChecksum,
      manifestSha256: sha256(files['MANIFEST.sha256.json']),
      sizeBytes: zipBuffer.length,
      acceptance,
    };
    await dbRun(
      `UPDATE v8_output_artifacts
       SET delivery_state = 'archived', last_transition_at = ?
       WHERE organization_id = ? AND output_type = 'sheet'
         AND delivery_state <> 'archived'
         AND origin_summary_json LIKE '%finance_acceptance_package_v1%'
         AND origin_summary_json LIKE ?`,
      [generatedAt, organizationId, `%${packId}%`]
    );
    await dbRun(
      `INSERT INTO v8_output_artifacts
       (artifact_id, organization_id, output_type, delivery_state, artifact_family,
        title_snapshot, owner_user_id, canonical_home, visibility_scope,
        origin_summary_json, created_by, created_at, last_transition_at)
       VALUES (?, ?, 'sheet', 'ready', 'sheet', ?, ?, 'outputs_library', 'private', ?, ?, ?, ?)`,
      [
        artifactId,
        organizationId,
        `${pack.entity_name} Finance package`,
        userId,
        jsonText(metadata),
        userId,
        generatedAt,
        generatedAt,
      ]
    );
    await dbRun(
      `INSERT INTO v8_output_exports
       (export_id, artifact_id, organization_id, format, requested_by, status, created_at, completed_at)
       VALUES (?, ?, ?, 'zip', ?, 'completed', ?, ?)`,
      [exportId, artifactId, organizationId, userId, generatedAt, generatedAt]
    );
    return res.status(201).json({
      data: { artifactId, exportId, ...metadata, filePath: undefined },
      meta: { ...financeMeta(), contract: 'finance_acceptance_package_v1' },
    });
  })
);

router.get(
  '/exports/packages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const rows = await dbAll<any>(
      `SELECT artifact_id, title_snapshot, delivery_state, origin_summary_json, created_at
       FROM v8_output_artifacts
       WHERE organization_id = ? AND output_type = 'sheet'
         AND delivery_state <> 'archived'
         AND origin_summary_json LIKE '%finance_acceptance_package_v1%'
       ORDER BY created_at DESC`,
      [organizationId]
    );
    return res.json({
      data: rows.map((row) => {
        const metadata = parseObject(row.origin_summary_json);
        delete metadata.filePath;
        return {
          artifactId: row.artifact_id,
          title: row.title_snapshot,
          status: row.delivery_state,
          createdAt: row.created_at,
          ...metadata,
        };
      }),
      meta: { ...financeMeta(), contract: 'finance_acceptance_package_v1' },
    });
  })
);

router.get(
  '/exports/packages/:artifactId/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const row = await dbGet<any>(
      `SELECT origin_summary_json FROM v8_output_artifacts
       WHERE artifact_id = ? AND organization_id = ? AND output_type = 'sheet'
         AND delivery_state <> 'archived'`,
      [req.params.artifactId, organizationId]
    );
    if (!row) return res.status(404).json({ error: 'Finance package not found' });
    const metadata = parseObject(row.origin_summary_json);
    const expectedDir = path.resolve(FINANCE_PACKAGE_ROOT, safePackageName(organizationId));
    const resolvedPath = path.resolve(String(metadata.filePath || ''));
    if (!resolvedPath.startsWith(`${expectedDir}${path.sep}`)) {
      return res.status(409).json({ error: 'Invalid package storage path' });
    }
    const data = await fs.readFile(resolvedPath);
    if (sha256(data) !== metadata.zipSha256) {
      return res.status(409).json({ error: 'Finance package checksum mismatch' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safePackageName(String(metadata.fileName).replace(/\.zip$/i, ''))}.zip"`
    );
    res.setHeader('X-Content-SHA256', String(metadata.zipSha256));
    return res.send(data);
  })
);

export default router;
