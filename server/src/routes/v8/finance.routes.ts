/**
 * V8 Finance bridge — org-scoped runtime dashboard and bounded
 * analysis/operator continuity slices under /api/v8/finance.
 *
 * @module routes/v8/finance.routes
 */

import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getFinanceDashboard } from '../../services/v8/financeIntegrationService.js';
import {
  approveAnalysis,
  createAnalysis,
  getAnalysisInsights,
  getAnalysisRatios,
  listAnalyses,
  runFullAnalysis,
} from '../../services/financialAnalysisService.js';
import { listBudgets } from '../../services/budgetingService.js';
import { searchStatementDocumentIntelligence } from '../../services/documentIntelligenceService.js';
import {
  autoMapLines,
  classifyStatementDocument,
  confirmStatement as confirmFinancialStatement,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  getLatestStatementIngestRun,
  loadPersistedStatementCandidateRows,
  loadStatementSourceText,
  locateStatementSections,
  persistStatementCandidateRows,
  persistStatementExtractedSections,
  persistStatementMappingCandidates,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  resolveStatementColumnSelection,
  resolveDuplicateSuggestedMappings,
  snapshotCanonicalStatementVersion,
  startStatementIngestRun,
  updateStatementMetadata,
  updateStatementStatus,
  updateStatementIngestRun,
} from '../../services/financialStatementService.js';
import type { DetectionResult } from '../../services/financialStatementService.js';
import {
  getFinanceTraceId,
  logFinanceError,
  logFinanceEvent,
} from '../../services/financeDiagnosticsService.js';
import {
  applyLlmProposals,
  applySecondPassProposals,
  mapDuplicateConflictLinesWithLLM,
  mapUnmappedLinesWithLLM,
} from '../../services/llmFinancialMappingService.js';
import {
  assessCoverage,
  classifyMappingTier,
  isLikelySubtotalOrAggregate,
  isNonFinancialByPolicy,
} from '../../services/financeMappingPolicy.js';
import {
  extractFinancialLinesWithAnthropic,
  extractFinancialLinesWithOpenAI,
} from '../../services/openAIFinancialExtractionService.js';
import {
  addEvent,
  approveModel,
  computeModel,
  createModel,
  getModel,
  getOutputs,
  getValidations,
  listEvents,
  listModels,
  persistComputeResult,
} from '../../services/financialModelingService.js';
import { computeRatios } from '../../services/ratioAnalysisService.js';
import {
  getStatementPackDetail,
  listStatementPacks,
  syncStatementToPack,
} from '../../services/financialStatementPackService.js';
import { getStatementDetail, listStatements } from '../../services/financialStatementReadService.js';
import { saveStatementValuesFlow } from '../../services/financialStatementValueWriteService.js';
import { listValuations } from '../../services/valuationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

/** Stable contract id for V8 Finance read responses. */
export const V8_FINANCE_READ_CONTRACT = 'finance_runtime_read_v1';

function financeMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_READ_CONTRACT };
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
  }),
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
  }),
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

    try {
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
      });
      const model = await getModel(modelId);
      return res.status(201).json({
        data: { model: model ?? { id: modelId, name, start_date: startDate } },
        meta: financeMeta(),
      });
    } catch (e: any) {
      const message = String(e?.message || 'Model creation failed');
      if (
        message.includes('Statement') ||
        message.includes('critical lines') ||
        message.includes('seed')
      ) {
        return res.status(400).json({ error: message });
      }
      throw e;
    }
  }),
);

router.get(
  '/models/:modelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
          source_statement: sourceStatement || null,
          source_statement_pack: sourceStatementPack || null,
        },
      },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/models/:modelId/validations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
  }),
);

router.get(
  '/models/:modelId/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
  }),
);

router.post(
  '/models/:modelId/compute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
  }),
);

router.post(
  '/models/:modelId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
    if (!model || String(model.organization_id || '') !== organizationId) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await approveModel(modelId, userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Approval failed' });
    }

    return res.json({
      data: { success: true, status: 'approved' },
      meta: financeMeta(),
    });
  }),
);

router.post(
  '/models/:modelId/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
  }),
);

router.delete(
  '/models/:modelId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const modelId = String(req.params.modelId || '');
    const model = await getModel(modelId);
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
  }),
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
  }),
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
  }),
);

router.get(
  '/statement-packs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string' ? String(req.query.readiness).trim().toLowerCase() : '';
    const statementPacks = await listStatementPacks(organizationId, readiness);
    return res.json({
      data: { statementPacks, count: statementPacks.length },
      meta: financeMeta(),
    });
  }),
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
  }),
);

router.get(
  '/statements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string' ? String(req.query.readiness).trim().toLowerCase() : '';
    const statements = await listStatements(organizationId, readiness);
    return res.json({
      data: { statements, count: statements.length },
      meta: financeMeta(),
    });
  }),
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
  }),
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
  }),
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
  }),
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
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<string, any> | null;
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
        ((String(req.body?.scaling || '').trim() || autoDetection.scaling) as DetectionResult['scaling']) ||
        'thousands',
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
      logger.warn('[V8 Finance] Detect metadata persistence failed; continuing with request-local selection', {
        statementId,
        requestedStatementType: req.body?.statementType,
        effectiveStatementType: detection.statementType,
        error: String((error as Error)?.message || error || 'unknown'),
      });
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
    if (organizationId) {
      await recordStatementQualityRun({
        statementId,
        organizationId,
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
  }),
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
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<string, any> | null;
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
      String(req.body?.periodLabel || '').trim() || String(statement.period_label || '').trim() || undefined;
    const effectiveCurrency =
      String(req.body?.currency || '').trim() || String(statement.currency || '').trim() || undefined;
    const effectiveScaling =
      String(req.body?.scaling || '').trim() || String(statement.scaling || '').trim() || undefined;
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
      anthropicExtraction && anthropicExtraction.lines.length > (openAiExtraction?.lines.length || 0)
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
        selectedPeriodLabel: line.selectedPeriodLabel || columnSelection.selectedPeriodLabel || undefined,
      })),
    };
    const strategy =
      anthropicExtraction && anthropicExtraction.lines.length > (openAiExtraction?.lines.length || 0)
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
      persistedSections.map((section) => [section.sectionKey, section.sectionId]),
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
      reasonCodes: extraction.lines.length > 0 ? ['EXTRACTION_LINES_FOUND'] : ['EXTRACTION_NO_LINES'],
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
        reasonCodes: extraction.lines.length > 0 ? ['EXTRACTION_LINES_FOUND'] : ['EXTRACTION_NO_LINES'],
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
  }),
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
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<string, any> | null;
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
      (line) => !line.suggestedCanonicalId && !line.isNonFinancial && line.originalLabel,
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
          const { applied, skipped } = applyLlmProposals(heuristicMapped, llmMappingResult.proposals);
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

    const conflictCount = mapped.filter((line) => line.mappingReason === 'duplicate_candidate_conflict').length;
    let llmSecondPassResult = null;
    if (conflictCount > 0) {
      try {
        llmSecondPassResult = await mapDuplicateConflictLinesWithLLM({
          allLines: mapped,
          statementType: statement.statement_type,
          traceId,
        });
        if (llmSecondPassResult.proposals.length > 0) {
          const { applied, skipped } = applySecondPassProposals(mapped, llmSecondPassResult.proposals);
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
        logFinanceError('statement.mapping.llm_second_pass_error', llm2Err, { traceId, statementId });
      }
    }

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
        candidateRows.filter((row) => row.sourceRow != null).map((row) => [Number(row.sourceRow), row.candidateRowId]),
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
          (line) => line.suggestedCanonicalId && !line.mappingReason?.startsWith('llm_mapping'),
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
      if (!line.isNonFinancial && !line.suggestedCanonicalId && isLikelySubtotalOrAggregate(line.originalLabel)) {
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
      }),
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
  }),
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
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<string, any> | null;
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const valueRows = Array.isArray(statement.values)
      ? statement.values.map((value: any) => ({
          canonicalLineId: value?.canonicalLineId ?? value?.canonical_line_id ?? null,
          value: Number(value?.value || 0),
          isNonFinancial: Boolean(value?.isNonFinancial ?? value?.is_non_financial),
        }))
      : [];
    const validationMessages = Array.isArray(statement.validationMessages)
      ? statement.validationMessages
      : [];
    const readiness = evaluateStatementReadiness({
      rawStatus: statement.status,
      statementType: statement.statement_type,
      validationStatus: statement.validation_status,
      currency: statement.currency,
      scaling: statement.scaling,
      validationMessages,
      values: valueRows,
    });

    if (!readiness.isReady) {
      return res.status(400).json({
        error: 'Statement is not ready to confirm',
        readiness,
      });
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
    });

    await confirmFinancialStatement(statementId, userId, readiness);
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
    await recordStatementQualityRun({
      statementId,
      organizationId,
      stage: 'confirm',
      resultStatus: 'pass',
      readinessStatus: readiness.readinessStatus,
      strategy: String(statement.extraction_strategy || 'confirmation_gate'),
      summary: 'Statement confirmed as statement-ready.',
      reasonCodes: readiness.reasonCodes,
      payload: readiness,
      createdBy: userId,
    });

    return res.json({
      data: {
        success: true,
        statementId,
        statementPackId,
        ingestRunId,
        status: 'confirmed',
        readiness,
      },
      meta: financeMeta(),
    });
  }),
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
    const statement = (await getStatementDetail(organizationId, statementId)) as Record<string, any> | null;
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
  }),
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
      [organizationId],
    );
    return res.json({
      data: { canonicalLines, count: canonicalLines.length },
      meta: financeMeta(),
    });
  }),
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
  }),
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
  }),
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
  }),
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
  }),
);

router.post(
  '/analyses/:analysisId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysisId = String(req.params.analysisId || '');
    const acceptedProposalIds = Array.isArray(req.body?.acceptedProposalIds)
      ? (req.body.acceptedProposalIds as any[]).map((x) => String(x)).filter(Boolean)
      : [];

    if (acceptedProposalIds.length === 0) {
      return res.status(400).json({ error: 'acceptedProposalIds is required' });
    }

    const analysis = await dbGet<any>(
      `SELECT id, organization_id, project_id, title
       FROM financial_analyses
       WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId],
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Not found' });
    }

    const placeholders = acceptedProposalIds.map(() => '?').join(',');
    const insights = await dbAll<any>(
      `SELECT id, insight_type, title, description
       FROM financial_analysis_insights
       WHERE analysis_id = ? AND id IN (${placeholders})`,
      [analysisId, ...acceptedProposalIds],
    );

    const now = new Date().toISOString();
    const created: string[] = [];

    for (const insight of insights || []) {
      const initiativeId = uuidv4();
      const name = String(insight.title || `Initiative from analysis ${analysisId.slice(0, 8)}`);
      const summary = String(insight.description || '');

      await dbRun(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, summary, status,
          source_type, source_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          organizationId,
          analysis.project_id || null,
          name,
          summary || null,
          'step3',
          'financial_analysis',
          analysisId,
          now,
          now,
        ],
      );

      created.push(initiativeId);
    }

    return res.status(201).json({
      data: { success: true, initiativeIds: created },
      meta: financeMeta(),
    });
  }),
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
  }),
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
  }),
);

router.delete(
  '/analyses/:analysisId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const row = await dbGet<any>(
      `SELECT id, status FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId],
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
  }),
);

export default router;
