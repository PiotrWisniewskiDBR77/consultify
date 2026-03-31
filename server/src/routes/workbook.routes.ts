/**
 * Workbook Routes — P23 extension: intelligent multi-sheet Excel generation.
 *
 * POST /api/workbook/generate — LLM generates WorkbookSchema → ExcelJS builds .xlsx
 * GET  /api/workbook/:id/download — download a previously generated workbook
 * POST /api/workbook/generate-and-download — one-shot: generate + immediate download
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// In-memory cache for recent workbooks (bounded to 50 entries)
const workbookCache = new Map<string, { buffer: Buffer; fileName: string; schema: any; createdAt: string }>();
const MAX_CACHE = 50;

function pruneCache() {
  if (workbookCache.size <= MAX_CACHE) return;
  const entries = [...workbookCache.entries()].sort((a, b) =>
    a[1].createdAt.localeCompare(b[1].createdAt)
  );
  while (workbookCache.size > MAX_CACHE) {
    workbookCache.delete(entries.shift()![0]);
  }
}

// Ensure storage table exists
async function ensureWorkbookSchema() {
  try {
    await queryHelpers.queryRun(`
      CREATE TABLE IF NOT EXISTS generated_workbooks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        prompt TEXT,
        schema_json TEXT,
        sheet_count INTEGER DEFAULT 1,
        file_name TEXT,
        file_size INTEGER,
        validation_errors TEXT,
        quality_score REAL,
        pipeline_log TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_workbooks_org ON generated_workbooks(organization_id)`
    );
  } catch { /* table may already exist */ }
}

/**
 * POST /api/workbook/generate
 * Body: { prompt, researchContext?, language? }
 * Returns: { id, title, sheets, fileName, validationErrors }
 */
router.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { prompt, researchContext, language } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: 'prompt is required (min 5 chars)' });
    return;
  }

  await ensureWorkbookSchema();

  const { default: WorkbookGeneratorService } = await import('../services/workbook/WorkbookGeneratorService.js');

  const result = await WorkbookGeneratorService.generate({
    prompt: prompt.trim(),
    userId: user.id,
    organizationId: user.organizationId,
    researchContext,
    language: language || req.headers['accept-language']?.split(',')[0],
  });

  // Cache the buffer for download
  workbookCache.set(result.id, {
    buffer: result.buffer,
    fileName: result.fileName,
    schema: result.schema,
    createdAt: result.generatedAt,
  });
  pruneCache();

  // Persist metadata
  try {
    await queryHelpers.queryRun(
      `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        user.organizationId,
        result.schema.title,
        result.schema.description || null,
        prompt.trim(),
        JSON.stringify(result.schema),
        result.schema.sheets.length,
        result.fileName,
        result.buffer.length,
        result.validationErrors.length > 0 ? JSON.stringify(result.validationErrors) : null,
        result.qualityScore,
        JSON.stringify(result.pipelineLog),
        user.id,
        result.generatedAt,
      ]
    );
  } catch (err) {
    logger.warn('[WorkbookRoutes] Failed to persist workbook metadata:', err);
  }

  res.json({
    id: result.id,
    title: result.schema.title,
    description: result.schema.description,
    sheets: result.schema.sheets.map((s: any) => ({
      name: s.name,
      purpose: s.purpose,
      columnCount: s.columns.length,
      rowCount: s.rows.length,
    })),
    fileName: result.fileName,
    fileSize: result.buffer.length,
    validationErrors: result.validationErrors,
    qualityScore: result.qualityScore,
    pipelineLog: result.pipelineLog,
    downloadUrl: `/api/workbook/${result.id}/download`,
    generatedAt: result.generatedAt,
  });
}));

/**
 * GET /api/workbook/:id/download
 * Returns the .xlsx file as a download
 */
router.get('/:id/download', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { id } = req.params;
  const cached = workbookCache.get(id);

  if (cached) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${cached.fileName}"`);
    res.send(cached.buffer);
    return;
  }

  // Try to regenerate from stored schema
  const row = await queryHelpers.queryOne<{ schema_json: string; file_name: string }>(
    `SELECT schema_json, file_name FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
    [id, user.organizationId]
  );

  if (!row?.schema_json) {
    res.status(404).json({ error: 'Workbook not found or expired' });
    return;
  }

  const { buildWorkbookBuffer } = await import('../services/workbook/WorkbookBuilder.js');
  const schema = JSON.parse(row.schema_json);
  const buffer = await buildWorkbookBuffer(schema);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${row.file_name || 'workbook.xlsx'}"`);
  res.send(buffer);
}));

/**
 * POST /api/workbook/generate-and-download
 * One-shot: generate + immediate download
 */
router.post('/generate-and-download', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { prompt, researchContext, language } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: 'prompt is required (min 5 chars)' });
    return;
  }

  const { default: WorkbookGeneratorService } = await import('../services/workbook/WorkbookGeneratorService.js');

  const result = await WorkbookGeneratorService.generate({
    prompt: prompt.trim(),
    userId: user.id,
    organizationId: user.organizationId,
    researchContext,
    language: language || req.headers['accept-language']?.split(',')[0],
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.send(result.buffer);
}));

/**
 * GET /api/workbook/list
 * List recent workbooks for the organization
 */
router.get('/list', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  await ensureWorkbookSchema();

  const rows = await queryHelpers.queryAll(
    `SELECT id, title, description, sheet_count, file_name, file_size, created_by, created_at
     FROM generated_workbooks WHERE organization_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [user.organizationId]
  );

  res.json({ workbooks: rows || [] });
}));

export default router;
