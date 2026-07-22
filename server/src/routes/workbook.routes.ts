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
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { createP23Error } from '../services/v8/exceleCanon.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

/**
 * Składa jeden czytelny string groundingu dla WorkbookGeneratorService z
 * wszystkich dostępnych źródeł (naprawa 2026-07-22, Fala A/A3). Wcześniej
 * `sourcePack`/`evidenceRefs` trafiały tylko do DB, a obiekt w `researchContext`
 * dawał „[object Object]" w prompcie. Preferuje kształt ContextPack
 * (key_points/data_points), inaczej bezpieczny JSON. Zwraca undefined gdy brak
 * czegokolwiek (model wtedy jawnie oznacza założenia). Cap 6000 znaków.
 */
function buildWorkbookGrounding(input: {
  researchContext?: unknown;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
}): string | undefined {
  const parts: string[] = [];
  const { researchContext, sourcePack, evidenceRefs } = input;

  if (typeof researchContext === 'string' && researchContext.trim()) {
    parts.push(researchContext.trim());
  } else if (researchContext && typeof researchContext === 'object') {
    try {
      parts.push(JSON.stringify(researchContext));
    } catch {
      /* ignore non-serializable */
    }
  }

  if (sourcePack && typeof sourcePack === 'object') {
    const sp = sourcePack as {
      key_points?: unknown;
      data_points?: unknown;
    };
    const keyPoints = Array.isArray(sp.key_points) ? sp.key_points.map(String) : [];
    const dataPoints = Array.isArray(sp.data_points)
      ? (sp.data_points as Array<{ label?: unknown; value?: unknown; unit?: unknown }>).map((d) =>
          `${String(d?.label ?? '')}: ${String(d?.value ?? '')}${d?.unit ? ` ${String(d.unit)}` : ''}`.trim()
        )
      : [];
    const lines = [...keyPoints, ...dataPoints].map((l) => l.trim()).filter(Boolean);
    if (lines.length) {
      parts.push(`Fakty ze źródeł (podstawa liczb — nie zaprzeczaj im):\n- ${lines.join('\n- ')}`);
    } else {
      try {
        parts.push(JSON.stringify(sourcePack));
      } catch {
        /* ignore */
      }
    }
  }

  if (Array.isArray(evidenceRefs) && evidenceRefs.length) {
    const refs = evidenceRefs
      .map((e) => (typeof e === 'string' ? e : (() => {
        try {
          return JSON.stringify(e);
        } catch {
          return '';
        }
      })()))
      .filter(Boolean);
    if (refs.length) parts.push(`Dowody: ${refs.join('; ')}`);
  }

  const text = parts.join('\n\n').trim();
  return text ? text.slice(0, 6000) : undefined;
}

/**
 * A2 fix (2026-07-22): the dedicated artifact-run path (ExceleView /
 * useKimiArtifactPipeline.ts) only sends `artifactRunId` — which elsewhere in this
 * route is used SOLELY to adopt the Outputs Library card (see adoptRunArtifactForWorkbook
 * below) — so `buildWorkbookGrounding` above got nothing and the LLM prompt was silently
 * ungrounded on that path. When no explicit sourcePack/evidenceRefs/researchContext made
 * it into the request, hydrate a grounding string server-side from the run's own record:
 *   v8_artifact_runs (artifactRegistryService.getArtifactRun) → execution_run_id
 *   → v8_execution_runs (executionSpineService.getRun) → free-text `goal` (the brief
 *     that was captured when the run was planned from chat, see createArtifactRunFromChat).
 * FAIL-SOFT: any missing record or thrown error → undefined, logged as a warning —
 * generation must proceed ungrounded rather than fail.
 */
async function hydrateGroundingFromRun(params: {
  artifactRunId: string;
  organizationId: string;
}): Promise<string | undefined> {
  try {
    const { getArtifactRun } = await import('../services/v8/artifactRegistryService.js');
    const run = await getArtifactRun(params.artifactRunId, params.organizationId);
    if (!run) return undefined;

    const { getRun: getExecutionRun } = await import('../services/v8/executionSpineService.js');
    const executionRun = await getExecutionRun(run.executionRunId, params.organizationId);
    const goal = typeof executionRun?.goal === 'string' ? executionRun.goal.trim() : '';
    if (!goal) return undefined;

    const titleHint =
      typeof run.plan?.titleHint === 'string' ? run.plan.titleHint.trim() : '';
    const heading = titleHint
      ? `Brief z sesji (${titleHint}) — podstawa liczb, nie zaprzeczaj mu:`
      : 'Brief z sesji — podstawa liczb, nie zaprzeczaj mu:';
    return `${heading}\n${goal}`.slice(0, 6000);
  } catch (err) {
    logger.warn(
      `[WorkbookRoutes] hydrateGroundingFromRun failed for run ${params.artifactRunId}, continuing without grounding:`,
      err
    );
    return undefined;
  }
}

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// In-memory cache for recent workbooks (bounded to 50 entries)
const workbookCache = new Map<
  string,
  { buffer: Buffer; fileName: string; schema: any; createdAt: string }
>();
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
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}'`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}'`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]'`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_workbooks_org ON generated_workbooks(organization_id)`
    );
  } catch {
    /* table may already exist */
  }
}

/**
 * POST /api/workbook/generate
 * Body: { prompt, researchContext?, language? }
 * Returns: { id, title, sheets, fileName, validationErrors }
 */
router.post(
  '/generate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      prompt,
      researchContext,
      language,
      projectId,
      sourceInitiativeId,
      conversationId,
      actionContract,
      sourcePack,
      evidenceRefs,
      artifactRunId,
    } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      res.status(400).json({ error: 'prompt is required (min 5 chars)' });
      return;
    }

    await ensureWorkbookSchema();

    const { default: WorkbookGeneratorService } =
      await import('../services/workbook/WorkbookGeneratorService.js');

    // Grounding (naprawa 2026-07-22, Fala A/A3): sourcePack/evidenceRefs były
    // przyjmowane, ale przekazywane TYLKO do DB — nigdy do promptu LLM; a obiekt
    // w researchContext dawał „[object Object]". Składamy jeden czytelny string ze
    // wszystkich dostępnych źródeł, żeby liczby modelu miały podstawę, nie były
    // zmyślane. WorkbookGeneratorService.generate przyjmuje researchContext:string.
    let groundingText = buildWorkbookGrounding({ researchContext, sourcePack, evidenceRefs });

    // A2 fix (2026-07-22): no explicit source in the body but an artifactRunId was
    // passed (dedicated ExceleView / artifact-run generation path) — hydrate grounding
    // from the run itself instead of leaving the prompt bare. See hydrateGroundingFromRun
    // above for the FAIL-SOFT lookup chain and rationale.
    if (!groundingText && typeof artifactRunId === 'string' && artifactRunId.trim()) {
      groundingText = await hydrateGroundingFromRun({
        artifactRunId: artifactRunId.trim(),
        organizationId: user.organizationId,
      });
      if (groundingText) {
        logger.info(
          `[WorkbookRoutes] Hydrated grounding from artifactRun ${artifactRunId.trim()} (${groundingText.length} chars)`
        );
      }
    }

    const result = await WorkbookGeneratorService.generate({
      prompt: prompt.trim(),
      userId: user.id,
      organizationId: user.organizationId,
      projectId: projectId || null,
      researchContext: groundingText,
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
        `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          JSON.stringify(
            actionContract && typeof actionContract === 'object' ? actionContract : {}
          ),
          JSON.stringify(sourcePack && typeof sourcePack === 'object' ? sourcePack : {}),
          JSON.stringify(Array.isArray(evidenceRefs) ? evidenceRefs : []),
          user.id,
          result.generatedAt,
        ]
      );
    } catch (err) {
      logger.warn('[WorkbookRoutes] Failed to persist workbook metadata:', err);
    }

    // Register in V8 artifact registry (P19 Outputs Library integration)
    let artifactId: string | null = null;
    try {
      const { registerArtifactOrigin, adoptRunArtifactForWorkbook } =
        await import('../services/v8/artifactRegistryService.js');

      const originSummary = {
        title: result.schema.title,
        description: result.schema.description || null,
        sheetCount: result.schema.sheets.length,
        exportFormat: 'xlsx',
        source: 'workbook_generator_p23d',
        qualityScore: result.qualityScore,
        sourceRefs: {
          conversationId: conversationId || null,
          initiativeId: sourceInitiativeId || null,
          projectId: projectId || null,
        },
      };

      // P-2 split-brain fix (excele lane): if this workbook was generated as the
      // real .xlsx for an existing artifact run (the run already materialized a
      // governed tp_tables sheet artifact), ADOPT that single artifact onto this
      // workbook instead of creating a SECOND Outputs card. One click = one card.
      if (typeof artifactRunId === 'string' && artifactRunId.trim()) {
        artifactId = await adoptRunArtifactForWorkbook({
          runId: artifactRunId.trim(),
          organizationId: user.organizationId,
          workbookId: result.id,
          title: result.schema.title || 'Untitled workbook',
          originSummary,
        });
        if (artifactId) {
          logger.info(
            `[WorkbookRoutes] Adopted run ${artifactRunId} artifact ${artifactId} onto workbook ${result.id} (no duplicate card)`
          );
        }
      }

      // Fallback: standalone workbook (no run, e.g. direct API caller) OR the run
      // had no adoptable artifact — register a fresh canonical artifact.
      if (!artifactId) {
        const registered = await registerArtifactOrigin({
          organizationId: user.organizationId,
          outputType: 'sheet',
          artifactFamily: 'sheet',
          originRuntime: 'sheet',
          originRecordId: result.id,
          titleSnapshot: result.schema.title || 'Untitled workbook',
          ownerUserId: user.id,
          createdBy: user.id,
          deliveryState: 'ready',
          visibilityScope: 'organization',
          projectId: projectId || null,
          sourceInitiativeId: sourceInitiativeId || null,
          originSummary,
        });
        artifactId = registered?.artifactId ?? null;
        if (artifactId) {
          logger.info(
            `[WorkbookRoutes] Registered artifact ${artifactId} for workbook ${result.id}`
          );
        }
      }
    } catch (err) {
      logger.warn('[WorkbookRoutes] Failed to register workbook in artifact registry:', err);
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
      classifiedErrors: result.classifiedErrors,
      qualityScore: result.qualityScore,
      pipelineLog: result.pipelineLog,
      artifactId,
      downloadUrl: `/api/workbook/${result.id}/download`,
      generatedAt: result.generatedAt,
    });
  })
);

/**
 * GET /api/workbook/:id/download
 * Returns the .xlsx file as a download
 */
router.get(
  '/:id/download',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const cached = workbookCache.get(id);

    if (cached) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
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
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    const { buildWorkbookBuffer, classifyBuildError } =
      await import('../services/workbook/WorkbookBuilder.js');
    const schema = JSON.parse(row.schema_json);

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      const classified = classifyBuildError(err);
      logger.error(`[WorkbookRoutes] Rebuild from schema failed: ${classified.code}`, err);
      res.status(500).json({
        error: 'Failed to rebuild workbook from stored schema',
        classified,
      });
      return;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${row.file_name || 'workbook.xlsx'}"`
    );
    res.send(buffer);
  })
);

/**
 * POST /api/workbook/generate-and-download
 * One-shot: generate + immediate download
 */
router.post(
  '/generate-and-download',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { prompt, researchContext, language } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      res.status(400).json({ error: 'prompt is required (min 5 chars)' });
      return;
    }

    const { default: WorkbookGeneratorService } =
      await import('../services/workbook/WorkbookGeneratorService.js');

    const result = await WorkbookGeneratorService.generate({
      prompt: prompt.trim(),
      userId: user.id,
      organizationId: user.organizationId,
      researchContext,
      language: language || req.headers['accept-language']?.split(',')[0],
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.buffer);
  })
);

/**
 * GET /api/workbook/list
 * List recent workbooks for the organization
 */
router.get(
  '/list',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await ensureWorkbookSchema();

    const rows = await queryHelpers.queryAll(
      `SELECT id, title, description, sheet_count, file_name, file_size, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at
     FROM generated_workbooks WHERE organization_id = ?
     ORDER BY created_at DESC LIMIT 50`,
      [user.organizationId]
    );

    res.json({
      workbooks: (rows || []).map((row: any) => ({
        ...row,
        actionContract: row.action_contract_json ? JSON.parse(row.action_contract_json) : {},
        sourcePack: row.source_pack_json ? JSON.parse(row.source_pack_json) : {},
        evidenceRefs: row.evidence_refs_json ? JSON.parse(row.evidence_refs_json) : [],
      })),
    });
  })
);

/**
 * GET /api/workbook/:id/schema
 * B3 fix (2026-07-22, workstream Excel): the in-app spreadsheet preview used to
 * show ONLY sheet metadata (name/columnCount/rowCount) — a user had to download
 * the .xlsx to see a single cell. This returns the FULL WorkbookSchema (sheets →
 * rows → cells, each cell carrying its display value and, when present, its
 * formula as a plain string e.g. "SUM(B2:B10)") so the frontend can render a
 * real read-only grid without downloading anything. Org-scoped; 404 when the
 * workbook is unknown or belongs to another organization.
 *
 * Checks the in-memory `workbookCache` first (freshly generated workbook, not
 * necessarily persisted yet) before falling back to the `generated_workbooks`
 * table. Registered ABOVE the generic GET /:id below — Express tries routes in
 * registration order, and /:id/schema is the more specific pattern.
 */
router.get(
  '/:id/schema',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const cached = workbookCache.get(id);
    if (cached?.schema) {
      res.json({
        id,
        title: cached.schema.title,
        description: cached.schema.description ?? null,
        sheets: Array.isArray(cached.schema.sheets) ? cached.schema.sheets : [],
      });
      return;
    }

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null }>(
      `SELECT schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    let schema: { title?: string; description?: string; sheets?: unknown[] } | null = null;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    res.json({
      id,
      title: schema?.title ?? null,
      description: schema?.description ?? null,
      sheets: Array.isArray(schema?.sheets) ? schema!.sheets : [],
    });
  })
);

/**
 * GET /api/workbook/:id
 * Returns workbook metadata (for reopen/preview without downloading binary).
 * Must be registered after all specific GET paths (/list, /:id/download,
 * /:id/schema) to avoid the wildcard param matching them.
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{
      id: string;
      title: string;
      description: string | null;
      schema_json: string;
      sheet_count: number;
      file_name: string;
      file_size: number;
      quality_score: number | null;
      action_contract_json?: string | null;
      source_pack_json?: string | null;
      evidence_refs_json?: string | null;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, title, description, schema_json, sheet_count, file_name, file_size, quality_score, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at
     FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const schemaJson = row.schema_json ? JSON.parse(row.schema_json) : null;
    res.json({
      id: row.id,
      title: row.title || schemaJson?.title,
      description: row.description || schemaJson?.description,
      schema_json: schemaJson,
      sheet_count: row.sheet_count,
      file_name: row.file_name,
      file_size: row.file_size,
      quality_score: row.quality_score,
      actionContract: row.action_contract_json ? JSON.parse(row.action_contract_json) : {},
      sourcePack: row.source_pack_json ? JSON.parse(row.source_pack_json) : {},
      evidenceRefs: row.evidence_refs_json ? JSON.parse(row.evidence_refs_json) : [],
      created_by: row.created_by,
      created_at: row.created_at,
      downloadUrl: `/api/workbook/${row.id}/download`,
    });
  })
);

export default router;
