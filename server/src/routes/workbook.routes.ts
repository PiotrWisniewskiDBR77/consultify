/**
 * Workbook Routes — P23 extension: intelligent multi-sheet Excel generation.
 *
 * POST /api/workbook/generate — LLM generates WorkbookSchema → ExcelJS builds .xlsx
 * GET  /api/workbook/:id/download — download a previously generated workbook
 * POST /api/workbook/generate-and-download — one-shot: generate + immediate download
 * POST /api/workbook/:id/clone — CLONE: duplicate an existing workbook's schema into
 *      a new generated_workbooks row (editable starting point)
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { createP23Error } from '../services/v8/exceleCanon.js';
import type { WorkbookQualityReport } from '../services/workbook/workbookQualityGate.js';
import type { WorkbookSchema } from '../services/workbook/WorkbookSchema.js';
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
 * Shared tail for any produced workbook (free-form `/generate` OR parametric
 * `/templates/:id/build`): cache the buffer for download, persist metadata, and
 * register/adopt the Outputs Library artifact — then return the JSON response
 * payload. Factored out so the template path reuses the EXACT same persistence,
 * caching and artifact-registration code as `/generate` (no duplication, one
 * card per workbook). Fail-soft on persist/registration (logs, never throws).
 */
async function finalizeGeneratedWorkbook(params: {
  result: {
    id: string;
    schema: any;
    buffer: Buffer;
    fileName: string;
    validationErrors: string[];
    classifiedErrors?: unknown;
    qualityScore: number | null;
    /** Deterministyczny krytyk jakości (critiqueWorkbook) — score 0-100 + issues[].
     *  Addytywne pole (2026-07-23): liczone już wcześniej (template-path i free-form),
     *  tu tylko dołączane do odpowiedzi, żeby FE mógł pokazać nieblokujący badge. */
    qualityReport?: WorkbookQualityReport | null;
    pipelineLog: unknown;
    generatedAt: string;
  };
  user: { id: string; organizationId: string };
  /** Stored in the `prompt` column (free-form prompt, or a template descriptor). */
  promptText: string;
  source: string;
  projectId?: string | null;
  sourceInitiativeId?: string | null;
  conversationId?: string | null;
  actionContract?: unknown;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
  artifactRunId?: string | null;
}): Promise<Record<string, unknown>> {
  const { result, user } = params;

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
        params.promptText,
        JSON.stringify(result.schema),
        result.schema.sheets.length,
        result.fileName,
        result.buffer.length,
        result.validationErrors.length > 0 ? JSON.stringify(result.validationErrors) : null,
        result.qualityScore,
        JSON.stringify(result.pipelineLog),
        JSON.stringify(
          params.actionContract && typeof params.actionContract === 'object'
            ? params.actionContract
            : {}
        ),
        JSON.stringify(
          params.sourcePack && typeof params.sourcePack === 'object' ? params.sourcePack : {}
        ),
        JSON.stringify(Array.isArray(params.evidenceRefs) ? params.evidenceRefs : []),
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
      source: params.source,
      qualityScore: result.qualityScore,
      sourceRefs: {
        conversationId: params.conversationId || null,
        initiativeId: params.sourceInitiativeId || null,
        projectId: params.projectId || null,
      },
    };

    // P-2 split-brain fix (excele lane): adopt an existing run's single artifact
    // rather than minting a second Outputs card. One click = one card.
    if (typeof params.artifactRunId === 'string' && params.artifactRunId.trim()) {
      artifactId = await adoptRunArtifactForWorkbook({
        runId: params.artifactRunId.trim(),
        organizationId: user.organizationId,
        workbookId: result.id,
        title: result.schema.title || 'Untitled workbook',
        originSummary,
      });
      if (artifactId) {
        logger.info(
          `[WorkbookRoutes] Adopted run ${params.artifactRunId} artifact ${artifactId} onto workbook ${result.id} (no duplicate card)`
        );
      }
    }

    // Fallback: standalone workbook (no run) OR the run had no adoptable artifact.
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
        projectId: params.projectId || null,
        sourceInitiativeId: params.sourceInitiativeId || null,
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

  return {
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
    qualityReport: result.qualityReport ?? null,
    pipelineLog: result.pipelineLog,
    artifactId,
    downloadUrl: `/api/workbook/${result.id}/download`,
    generatedAt: result.generatedAt,
  };
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

    const payload = await finalizeGeneratedWorkbook({
      result,
      user,
      promptText: prompt.trim(),
      source: 'workbook_generator_p23d',
      projectId: projectId || null,
      sourceInitiativeId: sourceInitiativeId || null,
      conversationId: conversationId || null,
      actionContract,
      sourcePack,
      evidenceRefs,
      artifactRunId: artifactRunId || null,
    });

    res.json(payload);
  })
);

/**
 * GET /api/workbook/templates
 * Lists the registered PARAMETRIC model templates (live-formula workbooks) with
 * their self-describing parameter descriptors, so a FE can render a form. C3.
 */
router.get(
  '/templates',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { listWorkbookTemplates } = await import('../services/workbook/templates/index.js');
    const templates = listWorkbookTemplates().map((t) => ({
      id: t.id,
      name: t.title,
      description: t.description,
      params: t.params,
    }));

    res.json({ templates });
  })
);

/**
 * POST /api/workbook/templates/:id/build
 * Body: { params?: Record<string, unknown>, language?, projectId?, ... }
 * Validates the flat params against the template's zod schema, builds the .xlsx
 * DETERMINISTICALLY from the registered template (no LLM), then caches + persists
 * + registers the artifact through the SAME path as /generate. C3.
 */
router.post(
  '/templates/:id/build',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const {
      params: rawParams,
      projectId,
      sourceInitiativeId,
      conversationId,
    } = req.body || {};

    const { getWorkbookTemplate, buildTemplateParamsSchema } =
      await import('../services/workbook/templates/index.js');
    const entry = getWorkbookTemplate(id);
    if (!entry) {
      res.status(404).json({
        error: `Unknown workbook template: "${id}"`,
        classified: createP23Error('validation_failed', `No registered template with id "${id}"`),
      });
      return;
    }

    // Validate the flat param map against the template's descriptor-derived zod
    // schema (unknown keys stripped, out-of-range/typed values rejected at the edge).
    const schemaZod = buildTemplateParamsSchema(entry);
    const parsed = schemaZod.safeParse(
      rawParams && typeof rawParams === 'object' ? rawParams : {}
    );
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid template parameters',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
        classified: createP23Error('validation_failed', 'Template parameter validation failed'),
      });
      return;
    }

    await ensureWorkbookSchema();

    const { default: WorkbookGeneratorService } =
      await import('../services/workbook/WorkbookGeneratorService.js');

    let result;
    try {
      result = await WorkbookGeneratorService.generateFromTemplate({
        templateId: id,
        flatParams: parsed.data as Record<string, unknown>,
      });
    } catch (err) {
      logger.error('[WorkbookRoutes] Template build failed:', err);
      res.status(500).json({
        error: 'Failed to build workbook from template',
        classified: createP23Error('export_failed', err instanceof Error ? err.message : String(err)),
      });
      return;
    }

    const payload = await finalizeGeneratedWorkbook({
      result,
      user,
      promptText: `[template:${id}] ${result.schema.title}`,
      source: 'workbook_template_c3',
      projectId: projectId || null,
      sourceInitiativeId: sourceInitiativeId || null,
      conversationId: conversationId || null,
    });

    res.json(payload);
  })
);

/**
 * POST /api/workbook/blank
 * Roboty tri-tryby (D3, tryb ①CZYSTO): tworzy MINIMALNY pusty skoroszyt
 * (1 arkusz, puste komórki) BEZ pipeline'u AI. Reużywa istniejącego kanału:
 * ten sam builder (buildWorkbookBuffer), ta sama tabela `generated_workbooks`,
 * ten sam cache i rejestr artefaktów co `/generate` — różni się tylko tym, że
 * schema jest deterministyczna i pusta zamiast generowana przez LLM.
 * Zwraca kształt zgodny z `/generate` (id + downloadUrl), więc ExceleView
 * może od razu pokazać podgląd/pobranie tą samą ścieżką.
 */
router.post(
  '/blank',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await ensureWorkbookSchema();

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = rawTitle || 'Pusty arkusz';

    // Minimalna, poprawna WorkbookSchema: jeden arkusz, zero kolumn/wierszy →
    // ExcelJS materializuje czystą, pustą siatkę. To jest kształt, którego sam
    // WorkbookGeneratorService używa jako fallbacku (Sheet1, columns:[], rows:[]).
    const schema: WorkbookSchema = {
      title,
      sheets: [{ name: 'Arkusz1', columns: [], rows: [] }],
    };

    const { buildWorkbookBuffer } = await import('../services/workbook/WorkbookBuilder.js');

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      logger.error('[WorkbookRoutes] Failed to build blank workbook:', err);
      res.status(500).json({ error: 'Failed to build blank workbook' });
      return;
    }

    const id = uuidv4();
    const fileName = `${title.replace(/\s+/g, '_')}.xlsx`;
    const generatedAt = new Date().toISOString();

    workbookCache.set(id, { buffer, fileName, schema, createdAt: generatedAt });
    pruneCache();

    // Persist metadata (best-effort — pobranie i tak działa z cache/rebuild).
    try {
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          title,
          null,
          '(pusty arkusz — tryb Czysto)',
          JSON.stringify(schema),
          schema.sheets.length,
          fileName,
          buffer.length,
          null,
          null,
          JSON.stringify([]),
          JSON.stringify({}),
          JSON.stringify({}),
          JSON.stringify([]),
          user.id,
          generatedAt,
        ]
      );
    } catch (err) {
      logger.warn('[WorkbookRoutes] Failed to persist blank workbook metadata:', err);
    }

    // Register in V8 artifact registry (Outputs Library), jak w `/generate`.
    let artifactId: string | null = null;
    try {
      const { registerArtifactOrigin } = await import(
        '../services/v8/artifactRegistryService.js'
      );
      const registered = await registerArtifactOrigin({
        organizationId: user.organizationId,
        outputType: 'sheet',
        artifactFamily: 'sheet',
        originRuntime: 'sheet',
        originRecordId: id,
        titleSnapshot: title,
        ownerUserId: user.id,
        createdBy: user.id,
        deliveryState: 'ready',
        visibilityScope: 'organization',
        projectId: null,
        sourceInitiativeId: null,
        originSummary: {
          title,
          description: null,
          sheetCount: schema.sheets.length,
          exportFormat: 'xlsx',
          source: 'workbook_blank_manual',
        },
      });
      artifactId = registered?.artifactId ?? null;
    } catch (err) {
      logger.warn('[WorkbookRoutes] Failed to register blank workbook in artifact registry:', err);
    }

    res.status(201).json({
      id,
      title,
      description: null,
      sheets: schema.sheets.map((s) => ({
        name: s.name,
        purpose: undefined,
        columnCount: s.columns.length,
        rowCount: s.rows.length,
      })),
      fileName,
      fileSize: buffer.length,
      validationErrors: [],
      artifactId,
      downloadUrl: `/api/workbook/${id}/download`,
      generatedAt,
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
 * POST /api/workbook/:id/clone
 *
 * CLONE mode — brief §1/§10, "Komplet od razu". Duplicates an existing
 * workbook's schema into a NEW `generated_workbooks` row (fresh id, fresh
 * .xlsx buffer) as an editable starting point — the Excel counterpart of
 * Deck's `POST /templates/:id/clone` and WORD's
 * `POST /document-studio/templates/from-artifact/:artifactId`. Reuses the
 * exact same build/persist/register tail (`finalizeGeneratedWorkbook`) as
 * `/generate`, `/blank` and `/templates/:id/build` — one card per clone,
 * no duplicated persistence logic.
 *
 * Body: { title? } — optional override; defaults to "<source title> (Copy)".
 * Returns: same payload shape as `/generate` (201).
 * Errors: 404 when the source workbook doesn't exist for this organization.
 */
router.post(
  '/:id/clone',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    await ensureWorkbookSchema();

    const source = await queryHelpers.queryOne<{
      title: string;
      description: string | null;
      schema_json: string | null;
    }>(
      `SELECT title, description, schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!source?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    let sourceSchema: WorkbookSchema;
    try {
      sourceSchema = JSON.parse(source.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title =
      rawTitle || `${sourceSchema.title || source.title || 'Untitled workbook'} (Copy)`;
    const schema: WorkbookSchema = { ...sourceSchema, title };

    const { buildWorkbookBuffer } = await import('../services/workbook/WorkbookBuilder.js');

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      logger.error('[WorkbookRoutes] Failed to build cloned workbook:', err);
      res.status(500).json({
        error: 'Failed to build cloned workbook',
        classified: createP23Error(
          'export_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

    const newId = uuidv4();
    const fileName = `${title.replace(/\s+/g, '_')}.xlsx`;
    const generatedAt = new Date().toISOString();

    const payload = await finalizeGeneratedWorkbook({
      result: {
        id: newId,
        schema,
        buffer,
        fileName,
        validationErrors: [],
        qualityScore: null,
        pipelineLog: [`cloned from workbook ${id}`],
        generatedAt,
      },
      user,
      promptText: `(klon skoroszytu ${id})`,
      source: 'workbook_clone',
    });

    res.status(201).json({ ...payload, clonedFrom: id });
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
