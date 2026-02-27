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
 */

import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/fileUpload.middleware.js';
import {
  autoMapLines,
  confirmStatement,
  createStatement,
  detectStatementType,
  extractFinancialLines,
  saveStatementValues,
  updateStatementStatus,
  validateStatement,
} from '../services/financialStatementService.js';
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
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// ════════════════════════════════════════════════
// T050: Financial Statement Ingestion
// ════════════════════════════════════════════════

router.post(
  '/upload',
  verifyToken,
  isAuthenticated,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'PDF file required' });

    let text: string;
    try {
      text = await PDFParserService.extractText(file.path);
    } catch (e: any) {
      return res.status(422).json({ error: 'PDF text extraction failed', detail: e?.message });
    }

    const detection = detectStatementType(text);

    const statementId = await createStatement({
      organizationId: orgId!,
      statementType: detection.statementType === 'UNKNOWN' ? 'P&L' : detection.statementType,
      periodStart: detection.periodStart || new Date().getFullYear() + '-01-01',
      periodEnd: detection.periodEnd || new Date().getFullYear() + '-12-31',
      periodLabel: detection.periodLabel || undefined,
      currency: detection.currency,
      scaling: detection.scaling,
      sourceFileName: file.originalname,
      sourceFilePath: file.path,
      parseMethod: 'text_extraction',
      overallConfidence: detection.confidence,
      createdBy: userId!,
    });

    // Store extracted text for subsequent steps
    await dbRun(`UPDATE financial_statements SET notes = ? WHERE id = ?`, [
      text.substring(0, 100000),
      statementId,
    ]);

    logger.info(
      `[FinanceStatements] Uploaded ${file.originalname} → statement ${statementId} type=${detection.statementType}`
    );

    res.status(201).json({
      success: true,
      statementId,
      detection,
      textLength: text.length,
    });
  })
);

router.post(
  '/:id/detect',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const text = stmt.notes || '';
    if (!text)
      return res.status(400).json({ error: 'No extracted text available — re-upload the PDF' });

    const detection = detectStatementType(text);

    await dbRun(
      `UPDATE financial_statements SET statement_type = ?, period_start = COALESCE(?, period_start), period_end = COALESCE(?, period_end), period_label = COALESCE(?, period_label), currency = ?, scaling = ?, overall_confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        detection.statementType === 'UNKNOWN' ? stmt.statement_type : detection.statementType,
        detection.periodStart,
        detection.periodEnd,
        detection.periodLabel,
        detection.currency,
        detection.scaling,
        detection.confidence,
        statementId,
      ]
    );

    res.json({ statementId, detection });
  })
);

router.post(
  '/:id/extract',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const text = stmt.notes || '';
    if (!text) return res.status(400).json({ error: 'No extracted text' });

    const extraction = extractFinancialLines(text, stmt.statement_type);

    await updateStatementStatus(statementId, 'imported');

    res.json({
      statementId,
      lines: extraction.lines,
      rawTableCount: extraction.rawTableCount,
      warnings: extraction.warnings,
      lineCount: extraction.lines.length,
    });
  })
);

router.post(
  '/:id/map',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const { lines } = req.body;
    if (!lines || !Array.isArray(lines))
      return res.status(400).json({ error: 'lines array required' });

    const mapped = await autoMapLines(lines, stmt.statement_type);

    await updateStatementStatus(statementId, 'mapped');

    res.json({ statementId, mappedLines: mapped });
  })
);

router.put(
  '/:id/values',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const { values } = req.body;
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: 'values array required' });

    // Clear old values
    await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statementId]);

    await saveStatementValues(statementId, values);

    // Run validation
    const validationResult = validateStatement(
      values.map((v: any) => ({ canonicalLineId: v.canonicalLineId, value: v.value })),
      stmt.statement_type
    );

    await updateStatementStatus(
      statementId,
      'mapped',
      validationResult.status,
      validationResult.messages
    );

    res.json({
      statementId,
      savedCount: values.length,
      validation: validationResult,
    });
  })
);

router.post(
  '/:id/validate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const valueRows = (await dbAll(
      `SELECT canonical_line_id as canonicalLineId, value FROM financial_statement_values WHERE statement_id = ?`,
      [statementId]
    )) as any[];

    const result = validateStatement(valueRows, stmt.statement_type);

    await updateStatementStatus(statementId, stmt.status, result.status, result.messages);

    res.json({ statementId, validation: result });
  })
);

router.post(
  '/:id/confirm',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    await confirmStatement(statementId, req.user!.id);
    logger.info(`[FinanceStatements] Statement ${statementId} confirmed by ${req.user!.id}`);

    res.json({ success: true, statementId, status: 'confirmed' });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const statements = await dbAll(
      `SELECT id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, overall_confidence, validation_status, status, created_at, updated_at
     FROM financial_statements WHERE organization_id = ? ORDER BY period_end DESC, created_at DESC LIMIT 100`,
      [orgId]
    );
    res.json(statements || []);
  })
);

router.get(
  '/canonical-lines',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const lines = await dbAll(
      `SELECT id, statement_type, line_code, line_name, line_name_pl, parent_line_id, sort_order FROM financial_statement_lines WHERE is_system = TRUE ORDER BY statement_type, sort_order`,
      []
    );
    res.json(lines || []);
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    const values = await dbAll(
      `SELECT fsv.id, fsv.canonical_line_id, fsv.original_label, fsv.value, fsv.confidence, fsv.source_row, fsv.mapping_status, fsv.is_manually_corrected,
            fsl.line_code, fsl.line_name, fsl.line_name_pl
     FROM financial_statement_values fsv
     LEFT JOIN financial_statement_lines fsl ON fsv.canonical_line_id = fsl.id
     WHERE fsv.statement_id = ? ORDER BY fsv.source_row`,
      [statementId]
    );

    const { notes, ...stmtData } = stmt;
    res.json({
      ...stmtData,
      validationMessages: stmt.validation_messages ? JSON.parse(stmt.validation_messages) : [],
      values: values || [],
    });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const stmt = await getStatementOrFail(statementId, res);
    if (!stmt) return;

    if (stmt.status === 'confirmed') {
      return res
        .status(400)
        .json({ error: 'Cannot delete confirmed statement. Archive it instead.' });
    }

    await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statementId]);
    await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [statementId]);

    res.json({ success: true, deleted: statementId });
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
    const orgId = req.user?.organizationId;
    try {
      const result = await computeRatios(String(req.params.id), orgId!);
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
    const orgId = req.user?.organizationId;
    const growthRatios = await computeGrowthRatios(currentStatementId, previousStatementId, orgId!);
    res.json(growthRatios);
  })
);

router.get(
  '/benchmarks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const benchmarks = await getBenchmarks(orgId!);
    res.json(benchmarks);
  })
);

router.put(
  '/benchmarks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
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
      organizationId: orgId!,
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

async function getStatementOrFail(id: string, res: Response): Promise<any | null> {
  const rows = (await dbAll(`SELECT * FROM financial_statements WHERE id = ?`, [id])) as any[];
  if (!rows?.length) {
    res.status(404).json({ error: 'Statement not found' });
    return null;
  }
  return rows[0];
}

export default router;
