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
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

import { withPgTransaction } from '../database/PostgresDatabase.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { buildOrgContextSourcePack } from '../services/documentStudio/documentOrgContextSourcePack.js';
import { createP23Error } from '../services/v8/exceleCanon.js';
import {
  buildWorkbookCsv,
  WorkbookCsvExportError,
} from '../services/workbook/workbookCsvExport.js';
import type { WorkbookQualityReport } from '../services/workbook/workbookQualityGate.js';
import type { WorkbookSchema } from '../services/workbook/WorkbookSchema.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

const router = Router();

// ---------------------------------------------------------------------------
// MAT-006 (2026-08-02) — public share reader. MUST be registered before
// `router.use(verifyToken)` below (mirrors presentations.routes.ts's
// `GET /shared/:token`, registered before that router's own
// `router.use(verifyToken)`) — this router is mounted at the SCOPED path
// `/api/workbook` (Gateway.ts), and registered before every bare-`/api`
// router in Gateway.ts, so a request to `/api/workbook/shared/:token`
// resolves here directly and never reaches any later bare-`/api` router's
// own `verifyToken` middleware. See workbook.routes.ts discovery notes
// (MAT-006 report) for the full audit of this bug class (found + fixed
// elsewhere for `workstreams.routes.ts` in MAT-007/009).
//
// Deny-list mirrors presentations' `PUBLIC_DECK_DENY_FIELDS` — strips every
// tenant/internal/actor field before the row ever leaves this process.
// ---------------------------------------------------------------------------
const WORKBOOK_PUBLIC_DENY_FIELDS = new Set([
  'organization_id',
  'created_by',
  'share_token',
  'share_created_by',
  'share_expires_at',
  'prompt',
  'pipeline_log',
  'validation_errors',
  'action_contract_json',
  'source_pack_json',
  'evidence_refs_json',
]);

function toPublicWorkbookRow(row: Record<string, unknown>) {
  const schemaJson = typeof row.schema_json === 'string' ? JSON.parse(row.schema_json) : null;
  const filtered = Object.fromEntries(
    Object.entries(row).filter(([k]) => !WORKBOOK_PUBLIC_DENY_FIELDS.has(k))
  );
  return {
    ...filtered,
    schema_json: undefined,
    sheets: Array.isArray(schemaJson?.sheets) ? schemaJson.sheets : [],
    title: (row.title as string) || schemaJson?.title || null,
    description: (row.description as string) || schemaJson?.description || null,
  };
}

const publicWorkbookViewerLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

/**
 * GET /api/workbook/shared/:token
 * Unauthenticated public reader for a shared workbook. Single 404 surface for
 * missing / revoked (token nulled by DELETE .../share) / expired — anti-
 * enumeration, matches presentations' `/shared/:token` design exactly.
 */
router.get(
  '/shared/:token',
  publicWorkbookViewerLimiter,
  asyncHandler(async (req, res) => {
    const row = await queryHelpers.queryOne<Record<string, unknown>>(
      `SELECT id, title, description, schema_json, sheet_count, file_name, created_at, share_expires_at
       FROM generated_workbooks
       WHERE share_token = ? AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP)`,
      [req.params.token]
    );
    if (!row) {
      res.status(404).json({ error: 'Shared workbook not found' });
      return;
    }
    res.json({ data: toPublicWorkbookRow(row) });
  })
);

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
 * N2 (noc 2026-07-27/28) — Excel org-context grounding.
 *
 * PROBLEM (verified): `grep -r "factBook|spine|financialEngine" server/src/services/workbook/`
 * = 0 hits. The Excel generator is completely cut off from the organization's
 * context and fact book — the same project described in a deck/report and in a
 * workbook can show contradictory numbers (`_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md`
 * §7/§10 L8, CTO decision D-5: "tak"). This closes the FIRST layer of that gap —
 * org identity + active projects/initiatives as ASSUMPTIONS-layer (A1) grounding,
 * not fabricated results. Full fact-book/spine wiring (§7 doctrine, producer side)
 * is explicitly OUT of scope here — deferred to a dedicated fala.
 *
 * REUSES `documentOrgContextSourcePack.buildOrgContextSourcePack` byte-for-byte —
 * the exact same function Document Studio's P0 URODZINOWE fix uses (org name/
 * industry via `AIContextBuilder._buildOrganizationContext` + active projects/
 * initiatives SQL). No second builder was written; the function is already fully
 * generic (takes only `organizationId`, returns plain data — no document-specific
 * shape leaks except the `sourceRef` field, which this caller simply ignores).
 *
 * DIFFERENCE vs Document Studio's `applyOrgContextGrounding`: there, auto-
 * grounding is SKIPPED whenever the caller supplied any `sourceRefs`, because an
 * explicit, curator-picked source pack must never be silently mixed with the
 * auto-built one (it drives a Sources QA gate). Workbook generation has no
 * equivalent curation/QA concept for `researchContext`/`sourcePack`/`evidenceRefs`
 * — those carry TOPIC-specific facts for the numbers, while org identity (who the
 * model is for, what else the org has live) is orthogonal. So here the org-context
 * summary is MERGED ONTO (prepended to) whatever grounding already exists, instead
 * of being skipped when other grounding is present.
 *
 * Fail-open: returns `null` on any lookup failure or empty/brand-new organization
 * — generation proceeds exactly as before, zero regression.
 */
async function buildWorkbookOrgContext(
  organizationId: string
): Promise<{ summaryPl: string; organizationName?: string } | null> {
  try {
    const pack = await buildOrgContextSourcePack(organizationId);
    if (!pack) return null;
    return {
      summaryPl: pack.contextSummaryPl,
      organizationName: pack.organizationName || undefined,
    };
  } catch (err) {
    logger.warn('[WorkbookRoutes] org-context grounding failed (fail-open, no regression)', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
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
    // MAT-006 (2026-08-02) — lifecycle columns/table. Same runtime
    // self-healing idiom as the 3 columns above; the sanctioned migration
    // counterpart is `server/migrations/20260802_mat006_workbook_lifecycle.sql`.
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_token TEXT`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_created_by TEXT`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP`
    );
    await queryHelpers.queryRun(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_workbooks_share_token ON generated_workbooks(share_token) WHERE share_token IS NOT NULL`
    );
    await queryHelpers.queryRun(`
      CREATE TABLE IF NOT EXISTS generated_workbook_versions (
        id TEXT PRIMARY KEY,
        workbook_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema_json_snapshot TEXT NOT NULL,
        sheet_count INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_gwv_workbook_version ON generated_workbook_versions(workbook_id, version DESC)`
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
    // Fala sprzątania 1b (2026-07-27) — this used to be a single unretried
    // attempt logged at `warn` with no workbook/artifact id in the
    // structured fields (rejestr: "dokument może powstać i nigdy nie
    // pojawić się w bibliotece", same defect class as the Document Studio
    // path in document-studio.routes.ts). `registerArtifactOrigin` is
    // idempotent (checks the existing origin link before inserting), so
    // retrying after a transient failure is always safe.
    if (!artifactId) {
      const registered = await retryWithBackoff(
        () =>
          registerArtifactOrigin({
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
          }),
        {
          onAttemptFailed: (attempt, attempts, attemptErr) => {
            logger.warn('[WorkbookRoutes] Register artifact attempt failed (will retry)', {
              workbookId: result.id,
              organizationId: user.organizationId,
              attempt,
              attempts,
              message: attemptErr instanceof Error ? attemptErr.message : String(attemptErr),
            });
          },
        }
      );
      artifactId = registered?.artifactId ?? null;
      if (artifactId) {
        logger.info(
          `[WorkbookRoutes] Registered artifact ${artifactId} for workbook ${result.id}`
        );
      }
    }
  } catch (err) {
    logger.error('[WorkbookRoutes] Failed to register workbook in artifact registry after retries', {
      workbookId: result.id,
      organizationId: user.organizationId,
      artifactId,
      message: err instanceof Error ? err.message : String(err),
    });
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

    // N2 (noc 2026-07-27/28) — org-context grounding (see buildWorkbookOrgContext
    // above): always attempted, merged onto (never replacing) whatever grounding
    // was already assembled above. Fail-open — a `null` pack (empty/new org, or a
    // lookup failure) leaves `groundingText`/`organizationName` untouched, so a
    // brand-new organization sees byte-identical behaviour to before this change.
    const orgContext = await buildWorkbookOrgContext(user.organizationId);
    if (orgContext) {
      groundingText = groundingText
        ? `${orgContext.summaryPl}\n\n${groundingText}`
        : orgContext.summaryPl;
      logger.debug('[WorkbookRoutes] auto-grounded workbook generation from org context', {
        organizationId: user.organizationId,
        organizationName: orgContext.organizationName,
      });
    }

    // N3 fix (naprawa 2026-07-28, "Excel od tygodni nie działa"): this call was
    // NOT wrapped in try/catch — unlike `/templates/:id/build` and `/:id/clone`
    // below, which already classify thrown errors via createP23Error and
    // respond directly. A thrown error here fell through to the generic
    // Express error middleware, which in production replies with a bare
    // "Something went very wrong!" (see server/src/utils/ErrorHandler.ts) —
    // discarding the real reason (e.g. a bad model route, an exhausted AI
    // budget, or a genuinely invalid LLM schema) before it ever reached the
    // client. The excele lane's `Api.generateWorkbook` catch then had nothing
    // useful to show and silently fell back to a relabeled CSV table. Mirror
    // the same classify-and-respond pattern used by the sibling routes so the
    // real detail survives all the way to the user-facing failure banner.
    let result;
    try {
      result = await WorkbookGeneratorService.generate({
        prompt: prompt.trim(),
        userId: user.id,
        organizationId: user.organizationId,
        projectId: projectId || null,
        researchContext: groundingText,
        organizationName: orgContext?.organizationName,
        language: language || req.headers['accept-language']?.split(',')[0],
      });
    } catch (err) {
      logger.error('[WorkbookRoutes] Workbook generation failed:', err);
      res.status(502).json({
        error: 'Failed to generate workbook',
        classified: createP23Error(
          'export_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

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

    // N2 — no LLM prompt on the template path (deterministic build), so there is
    // no `researchContext` to enrich; still resolve the org name so the Info
    // sheet shows it (see buildWorkbookOrgContext above). Fail-open: null → the
    // template build proceeds exactly as before.
    const orgContextForTemplate = await buildWorkbookOrgContext(user.organizationId);

    let result;
    try {
      result = await WorkbookGeneratorService.generateFromTemplate({
        templateId: id,
        flatParams: parsed.data as Record<string, unknown>,
        organizationName: orgContextForTemplate?.organizationName,
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

    // Naprawa 2026-07-28 ("jeden Excel na każdej ścieżce"): 0 kolumn/0 wierszy
    // dawało JSON-poprawną, ale bezużyteczną WorkbookSchema — EditableSpreadsheetGrid
    // (src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx) renderuje
    // `null` gdy `columns.length === 0` (nie ma czego kliknąć), a stary
    // tylko-do-odczytu fallback w KimiWorkspaceShell pokazywał zastępczy obrazek
    // "Spreadsheet preview" zamiast siatki. Prawdziwa pusta siatka = stały
    // szkielet kolumn/wierszy z PUSTYMI komórkami (cells: {}), żeby dwuklik w
    // dowolną komórkę od razu otwierał edycję — dokładnie jak w Excelu/Sheets
    // po "New spreadsheet".
    const BLANK_GRID_COLUMNS = 12; // A..L
    const BLANK_GRID_ROWS = 30;
    const colLetter = (index: number): string => {
      let n = index + 1;
      let out = '';
      while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
      }
      return out;
    };
    const blankColumns = Array.from({ length: BLANK_GRID_COLUMNS }, (_, i) => ({
      key: colLetter(i),
      header: colLetter(i),
    }));
    const blankRows = Array.from({ length: BLANK_GRID_ROWS }, () => ({ cells: {} }));

    const schema: WorkbookSchema = {
      title,
      sheets: [{ name: 'Arkusz1', columns: blankColumns, rows: blankRows }],
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
 * PATCH /api/workbook/:id/cell
 *
 * "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28) — trwałość
 * dla `EditableSpreadsheetGrid` (src/components/AIChat/KimiWorkspace). Zanim
 * ten endpoint powstał, `PATCH`/`PUT` NIE ISTNIAŁ dla `generated_workbooks` —
 * grep potwierdza, że jedyne mutacje to `/generate`, `/blank`,
 * `/templates/:id/build`, `/:id/clone` (zawsze NOWY wiersz); żadna trasa nie
 * aktualizowała istniejący `schema_json`. Bez tego edycja komórki w
 * przeglądarce nie przeżywa odświeżenia strony — a to jest CAŁY sens zadania.
 *
 * Caller produkcyjny: `EditableSpreadsheetGrid.tsx` → `Api.updateWorkbookCell`
 * (src/services/api.ts) — wołany po każdym zatwierdzeniu edycji komórki
 * (Enter/Tab/blur), za flagą `ff_excele_edit` (domyślnie OFF, patrz
 * src/utils/exceleEditFlag.ts).
 *
 * Body: { sheetIndex: number, rowIndex: number, columnKey: string,
 *         value?: string|number|boolean|null, formula?: string }
 * — `formula` wygrywa nad `value` gdy oba obecne (formuła zapisywana BEZ
 * wiodącego "=", zgodnie z konwencją całego schematu — patrz
 * WorkbookBuilder.ts "Formulas are emitted WITHOUT a leading '='"). Podanie
 * ani `value` ani `formula` czyści komórkę (usuwa jej zawartość, zachowuje
 * styl/walidację jeśli były).
 *
 * Org-scoped (jak każda inna trasa tego routera). Invaliduje `workbookCache`
 * dla tego id, żeby `GET /:id/download` odbudował plik ZE ŚWIEŻEGO
 * `schema_json` zamiast serwować stary bufor (patrz istniejący fallback
 * "Try to regenerate from stored schema" w `GET /:id/download` poniżej —
 * reużyty, nie duplikowany).
 *
 * MAT-006 (2026-08-02): every cell edit now (a) snapshots the PRE-edit
 * `schema_json` into `generated_workbook_versions` at its current version
 * (immutable history, never mutated in place — mirrors
 * `presentation_deck_versions`'s autosave pattern) and (b) applies the
 * `UPDATE` as a compare-and-swap keyed on that same version
 * (`WHERE version = ?`), so two concurrent edits reading the same starting
 * version can no longer both silently win — the loser's `changes` comes back
 * 0 and gets a 409 `VERSION_CONFLICT`, exactly like presentations' autosave.
 * `expectedVersion` in the body is OPTIONAL (backward-compatible with the
 * existing fire-and-forget caller in `EditableSpreadsheetGrid.tsx`): when
 * present it is checked for a stale read BEFORE the write is even attempted;
 * when absent the CAS still runs against the version this request just read.
 */
router.patch(
  '/:id/cell',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { sheetIndex, rowIndex, columnKey, value, formula, expectedVersion } = req.body || {};

    if (
      expectedVersion !== undefined &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    ) {
      res.status(400).json({
        error: 'expectedVersion must be a positive integer when present',
        classified: createP23Error('validation_failed', 'Invalid expectedVersion'),
      });
      return;
    }

    if (typeof sheetIndex !== 'number' || !Number.isInteger(sheetIndex) || sheetIndex < 0) {
      res.status(400).json({
        error: 'sheetIndex must be a non-negative integer',
        classified: createP23Error('validation_failed', 'Invalid sheetIndex'),
      });
      return;
    }
    if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex) || rowIndex < 0) {
      res.status(400).json({
        error: 'rowIndex must be a non-negative integer',
        classified: createP23Error('validation_failed', 'Invalid rowIndex'),
      });
      return;
    }
    if (typeof columnKey !== 'string' || !columnKey.trim()) {
      res.status(400).json({
        error: 'columnKey must be a non-empty string',
        classified: createP23Error('validation_failed', 'Invalid columnKey'),
      });
      return;
    }
    if (formula !== undefined && typeof formula !== 'string') {
      res.status(400).json({
        error: 'formula must be a string when present',
        classified: createP23Error('validation_failed', 'Invalid formula'),
      });
      return;
    }
    if (
      value !== undefined &&
      value !== null &&
      !['string', 'number', 'boolean'].includes(typeof value)
    ) {
      res.status(400).json({
        error: 'value must be string, number, boolean or null',
        classified: createP23Error('validation_failed', 'Invalid value'),
      });
      return;
    }

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; version: number }>(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error('access_denied', `Workbook ${id} not found for this organization`),
      });
      return;
    }

    const currentVersion = Number(row.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      res.status(409).json({
        error: 'Version conflict: workbook was modified by another session. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: currentVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    const sheet = schema?.sheets?.[sheetIndex];
    if (!sheet || !Array.isArray(sheet.rows) || !Array.isArray(sheet.columns)) {
      res.status(400).json({
        error: `Unknown sheetIndex ${sheetIndex}`,
        classified: createP23Error('validation_failed', 'sheetIndex out of range'),
      });
      return;
    }
    if (rowIndex >= sheet.rows.length) {
      res.status(400).json({
        error: `Unknown rowIndex ${rowIndex} for sheet "${sheet.name}"`,
        classified: createP23Error('validation_failed', 'rowIndex out of range'),
      });
      return;
    }
    if (!sheet.columns.some((c) => c.key === columnKey)) {
      res.status(400).json({
        error: `Unknown columnKey "${columnKey}" for sheet "${sheet.name}"`,
        classified: createP23Error('validation_failed', 'columnKey not found'),
      });
      return;
    }

    const targetRow = sheet.rows[rowIndex];
    if (!targetRow.cells) targetRow.cells = {};
    const oldCell = targetRow.cells[columnKey] ?? {};

    // Formuła wygrywa nad wartością; brak obu = wyczyszczenie komórki. Styl/
    // komentarz/walidacja z istniejącej komórki są zachowane (edycja treści
    // nie ma prawa zjeść formatowania ani reguł walidacji wejścia).
    const trimmedFormula = typeof formula === 'string' ? formula.trim().replace(/^=+/, '') : '';
    const nextCell: Record<string, unknown> = {
      style: oldCell.style,
      comment: oldCell.comment,
      validation: oldCell.validation,
    };
    if (trimmedFormula) {
      nextCell.formula = trimmedFormula;
    } else if (value !== undefined) {
      nextCell.value = value;
    }
    // Undefined fields are dropped by JSON.stringify — no explicit delete needed.
    targetRow.cells[columnKey] = nextCell as (typeof sheet.rows)[number]['cells'][string];

    // Snapshot the PRE-edit state into immutable history at its current
    // version BEFORE overwriting — mirrors presentations' autosave. Best-
    // effort: a history-write failure must never block the actual edit
    // (matches this file's existing fail-soft posture elsewhere).
    try {
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          id,
          currentVersion,
          row.schema_json,
          Array.isArray(schema?.sheets) ? schema.sheets.length : 0,
          user.id,
        ]
      );
    } catch (err) {
      logger.warn(`[WorkbookRoutes] Could not snapshot version history for ${id}:`, err);
    }

    const nextVersion = currentVersion + 1;
    const updateResult = await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET schema_json = ?, version = ? WHERE id = ? AND organization_id = ? AND version = ?`,
      [JSON.stringify(schema), nextVersion, id, user.organizationId, currentVersion]
    );

    if (!updateResult?.changes) {
      const latest = await queryHelpers.queryOne<{ version: number }>(
        `SELECT version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      );
      res.status(409).json({
        error: 'Version conflict: workbook changed during save. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(latest?.version) || currentVersion,
        clientVersion: currentVersion,
      });
      return;
    }

    // Invaliduje bufor .xlsx w pamięci — następny GET /:id/download odbuduje
    // plik ZE ŚWIEŻEGO schema_json (istniejąca ścieżka "Try to regenerate from
    // stored schema" poniżej), zamiast serwować stary, przed-edycją bufor.
    workbookCache.delete(id);

    res.json({
      ok: true,
      sheetIndex,
      rowIndex,
      columnKey,
      cell: targetRow.cells[columnKey],
      version: nextVersion,
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
      version?: number;
      share_token?: string | null;
      share_expires_at?: string | null;
    }>(
      `SELECT id, title, description, schema_json, sheet_count, file_name, file_size, quality_score, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at, version, share_token, share_expires_at
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
      // MAT-006: CAS version + share status (never the raw token — presence
      // only, so the UI can render "Shared" without ever holding the secret).
      version: Number(row.version) || 1,
      isShared: Boolean(row.share_token),
      shareExpiresAt: row.share_expires_at || null,
    });
  })
);

// =============================================================================
// MAT-006 (2026-08-02) — Workbook lifecycle: versions, checkpoint, restore,
// share/revoke, CSV export. All routes below are authenticated + org-scoped
// (this router's `router.use(verifyToken)` / `requireOrgAccess()` above
// already gate everything past the public `/shared/:token` reader at the top
// of this file). Patterned directly on presentations.routes.ts's deck
// version/restore/share (see MAT-006 report for the side-by-side diff of
// what was reused vs. deliberately improved — real transaction for restore,
// hashed token in audit trail).
// =============================================================================

const workbookShareRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many share operations, slow down.' },
});

function hashShareToken(token: string): string {
  // Never persist/log the raw token — a short one-way hash is enough to
  // correlate audit events without reconstructing the secret.
  const { createHash } = require('crypto');
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/**
 * GET /api/workbook/:id/versions
 * Version history, newest first. Registered as its own path segment so it
 * can never collide with the generic `GET /:id` above (Express matches by
 * segment count, not just prefix).
 */
router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    await ensureWorkbookSchema();

    const wb = await queryHelpers.queryOne<{ id: string; version: number }>(
      `SELECT id, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!wb) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const versions = await queryHelpers.queryAll<{
      id: string;
      version: number;
      sheet_count: number;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, version, sheet_count, created_by, created_at
       FROM generated_workbook_versions
       WHERE workbook_id = ?
       ORDER BY version DESC
       LIMIT 50`,
      [id]
    );

    res.json({ data: versions || [], currentVersion: Number(wb.version) || 1 });
  })
);

/**
 * POST /api/workbook/:id/checkpoint
 * Explicit, user-initiated snapshot — distinct from the implicit per-edit
 * versioning `PATCH /:id/cell` already does. Snapshots the CURRENT
 * `schema_json` into history (no content change) and bumps `version`, so a
 * checkpoint is a real, restorable, named point in the timeline. CAS'd via
 * optional `expectedVersion` exactly like the cell PATCH above.
 */
router.post(
  '/:id/checkpoint',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const expectedVersion = req.body?.expectedVersion;
    if (
      expectedVersion !== undefined &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    ) {
      res.status(400).json({ error: 'expectedVersion must be a positive integer when present' });
      return;
    }
    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; version: number }>(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) {
      res.status(404).json({ error: 'Workbook not found or expired' });
      return;
    }

    const currentVersion = Number(row.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      res.status(409).json({
        error: 'Version conflict: workbook was modified. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: currentVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    let sheetCount = 0;
    try {
      const parsed = JSON.parse(row.schema_json);
      sheetCount = Array.isArray(parsed?.sheets) ? parsed.sheets.length : 0;
    } catch {
      /* keep 0 */
    }

    await queryHelpers.queryRun(
      `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), id, currentVersion, row.schema_json, sheetCount, user.id]
    );

    const nextVersion = currentVersion + 1;
    const updateResult = await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET version = ? WHERE id = ? AND organization_id = ? AND version = ?`,
      [nextVersion, id, user.organizationId, currentVersion]
    );

    if (!updateResult?.changes) {
      const latest = await queryHelpers.queryOne<{ version: number }>(
        `SELECT version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      );
      res.status(409).json({
        error: 'Version conflict: workbook changed during checkpoint. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(latest?.version) || currentVersion,
        clientVersion: currentVersion,
      });
      return;
    }

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'checkpoint',
      resourceType: 'generated_workbook',
      resourceId: id,
      metadata: { organizationId: user.organizationId, checkpointedFromVersion: currentVersion, newVersion: nextVersion },
    });

    res.json({ ok: true, version: nextVersion, checkpointedFromVersion: currentVersion });
  })
);

/**
 * POST /api/workbook/:id/versions/:versionId/restore
 *
 * Real, single-connection transaction (`withPgTransaction` —
 * `server/src/database/PostgresDatabase.ts`) with a `SELECT ... FOR UPDATE`
 * row lock, so a second concurrent restore/edit genuinely BLOCKS until the
 * first commits (not just a CAS race that might both read the same stale
 * version) — then re-checks `expectedVersion` against the post-lock row, so
 * it always sees accurate data and correctly reports 409 instead of racing.
 * The pre-restore state is snapshotted into history FIRST (inside the same
 * transaction) — restore is a NEW forward version, never a rewrite of past
 * history, and the artifact id never changes (same `generated_workbooks`
 * row, only `schema_json`/`version` move).
 *
 * Test-only fault injection: when `NODE_ENV === 'test'` AND the request
 * carries `x-mat006-force-restore-fault: 1`, a deliberately-invalid INSERT
 * is issued AFTER the legitimate pre-restore snapshot INSERT but BEFORE the
 * final UPDATE, to prove the whole transaction (including that earlier,
 * individually-successful INSERT) rolls back atomically — never reachable
 * outside test mode.
 */
router.post(
  '/:id/versions/:versionId/restore',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id, versionId } = req.params;
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({
        error: 'expectedVersion is required',
        code: 'EXPECTED_VERSION_REQUIRED',
      });
      return;
    }
    await ensureWorkbookSchema();

    const forceFault =
      process.env.NODE_ENV === 'test' && req.headers['x-mat006-force-restore-fault'] === '1';

    type RestoreOutcome =
      | { status: 'not_found' }
      | { status: 'version_not_found' }
      | { status: 'conflict'; serverVersion: number }
      | { status: 'ok'; newVersion: number; restoredFromVersion: number };

    let outcome: RestoreOutcome;
    try {
      outcome = await withPgTransaction<RestoreOutcome>(async (query) => {
        const wbRows = await query<{
          id: string;
          organization_id: string;
          version: number;
          schema_json: string;
        }>(
          `SELECT id, organization_id, version, schema_json FROM generated_workbooks WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
          [id, user.organizationId]
        );
        const wb = wbRows.rows[0];
        if (!wb) return { status: 'not_found' };

        const liveVersion = Number(wb.version) || 1;
        if (liveVersion !== expectedVersion) {
          return { status: 'conflict', serverVersion: liveVersion };
        }

        const versionRows = await query<{
          id: string;
          version: number;
          schema_json_snapshot: string;
          sheet_count: number;
        }>(
          `SELECT id, version, schema_json_snapshot, sheet_count FROM generated_workbook_versions WHERE id = $1 AND workbook_id = $2`,
          [versionId, id]
        );
        const versionRow = versionRows.rows[0];
        if (!versionRow) return { status: 'version_not_found' };

        let preRestoreSheetCount = 0;
        try {
          const parsed = JSON.parse(wb.schema_json || '{}');
          preRestoreSheetCount = Array.isArray(parsed?.sheets) ? parsed.sheets.length : 0;
        } catch {
          /* keep 0 */
        }

        // Snapshot the CURRENT (pre-restore) state into history BEFORE
        // overwriting — immutable history, never rewritten.
        await query(
          `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [uuidv4(), id, liveVersion, wb.schema_json, preRestoreSheetCount, user.id]
        );

        if (forceFault) {
          // Deliberate constraint violation (NOT NULL primary key) — proves
          // the transaction, INCLUDING the INSERT immediately above, rolls
          // back atomically rather than leaving a partial/corrupt state.
          await query(
            `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot) VALUES (NULL, $1, $2, $3)`,
            [id, liveVersion + 1, '{}']
          );
        }

        const newVersion = liveVersion + 1;
        const updateRes = await query(
          `UPDATE generated_workbooks SET schema_json = $1, version = $2 WHERE id = $3 AND organization_id = $4 AND version = $5`,
          [versionRow.schema_json_snapshot, newVersion, id, user.organizationId, liveVersion]
        );
        if (!updateRes.rowCount) {
          // Unreachable in practice given the FOR UPDATE lock above, but a
          // thrown error here still rolls back the transaction correctly.
          throw new Error('RESTORE_CAS_LOST');
        }

        return { status: 'ok', newVersion, restoredFromVersion: versionRow.version };
      });
    } catch (err) {
      logger.error(`[WorkbookRoutes] Restore transaction failed for ${id}:`, err);
      res.status(500).json({ error: 'Restore failed', code: 'RESTORE_TRANSACTION_FAILED' });
      return;
    }

    if (outcome.status === 'not_found') {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (outcome.status === 'version_not_found') {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (outcome.status === 'conflict') {
      res.status(409).json({
        error: 'Version conflict: workbook was modified before restore.',
        code: 'VERSION_CONFLICT',
        serverVersion: outcome.serverVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    // Invalidate the in-memory .xlsx buffer so GET /:id/download rebuilds
    // from the just-restored schema_json instead of serving a stale buffer.
    workbookCache.delete(id);

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'restore',
      resourceType: 'generated_workbook',
      resourceId: id,
      metadata: {
        organizationId: user.organizationId,
        restoredFromVersion: outcome.restoredFromVersion,
        newVersion: outcome.newVersion,
      },
    });

    res.json({ ok: true, version: outcome.newVersion, restoredFromVersion: outcome.restoredFromVersion });
  })
);

/**
 * POST /api/workbook/:id/share
 * Mints a durable, crypto-random share token (uuid v4 x2, 244 bits of CSPRNG
 * entropy — not sequential/guessable). Default 7-day expiry, overridable via
 * `expiresInDays`. The raw token is returned to the caller ONCE in this
 * response and NEVER written to logs or the audit trail (only a short sha256
 * prefix is persisted in the audit metadata, for correlation only).
 */
router.post(
  '/:id/share',
  workbookShareRateLimiter,
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const expiresInDaysRaw = req.body?.expiresInDays;
    const expiresInDays =
      typeof expiresInDaysRaw === 'number' && expiresInDaysRaw > 0 && expiresInDaysRaw <= 365
        ? expiresInDaysRaw
        : 7;
    await ensureWorkbookSchema();

    const before = await queryHelpers.queryOne<{ id: string; title: string; share_token: string | null }>(
      `SELECT id, title, share_token FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!before) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const token = `${uuidv4()}${uuidv4()}`.replace(/-/g, '');
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET share_token = ?, share_created_by = ?, share_expires_at = ? WHERE id = ? AND organization_id = ?`,
      [token, user.id, expiresAt, id, user.organizationId]
    );

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'share',
      resourceType: 'generated_workbook',
      resourceId: id,
      before: { hadShareToken: Boolean(before.share_token) },
      after: { shareTokenHash: hashShareToken(token), shareExpiresAt: expiresAt },
      metadata: { organizationId: user.organizationId, title: before.title },
    });

    res.json({ shareToken: token, expiresAt, shareUrl: `/api/workbook/shared/${token}` });
  })
);

/**
 * DELETE /api/workbook/:id/share
 * Atomically nulls `share_token` (single UPDATE — no read-modify-write gap),
 * so `/shared/:token` (`WHERE share_token = ?`) stops matching immediately.
 * Idempotent: revoking an already-revoked/never-shared workbook still
 * returns 200 `{ revoked: true }` — there is no "un-revoke via retry" path
 * because the UPDATE always sets NULL unconditionally, never conditionally
 * restores a previous value.
 */
router.delete(
  '/:id/share',
  workbookShareRateLimiter,
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    await ensureWorkbookSchema();

    const before = await queryHelpers.queryOne<{ id: string; title: string; share_token: string | null }>(
      `SELECT id, title, share_token FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!before) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET share_token = NULL, share_created_by = NULL, share_expires_at = NULL WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'share_revoke',
      resourceType: 'generated_workbook',
      resourceId: id,
      before: { hadShareToken: Boolean(before.share_token) },
      after: { hadShareToken: false },
      metadata: { organizationId: user.organizationId, title: before.title },
    });

    res.json({ revoked: true });
  })
);

/**
 * GET /api/workbook/:id/export/csv?sheetIndex=N
 * Single-sheet CSV export — see `workbookCsvExport.ts` header for the full,
 * explicit contract (one sheet, UTF-8, formulas as inert text, no styling).
 * The same contract is echoed in `X-Consultify-Csv-Scope` /
 * `X-Consultify-Csv-Limitation` response headers, not just in code comments.
 */
router.get(
  '/:id/export/csv',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const sheetIndexRaw = req.query.sheetIndex;
    const sheetIndex = sheetIndexRaw !== undefined ? Number(sheetIndexRaw) : 0;
    if (!Number.isInteger(sheetIndex) || sheetIndex < 0) {
      res.status(400).json({ error: 'sheetIndex must be a non-negative integer' });
      return;
    }
    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; title: string | null }>(
      `SELECT schema_json, title FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) {
      res.status(404).json({ error: 'Workbook not found or expired' });
      return;
    }

    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    let result;
    try {
      result = buildWorkbookCsv(schema, sheetIndex);
    } catch (err) {
      if (err instanceof WorkbookCsvExportError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }

    const safeSheetName = result.sheetName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Sheet';
    const safeTitle = (row.title || 'workbook').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_${safeSheetName}.csv"`
    );
    // Explicit, machine-readable contract limitation — not only in docs.
    res.setHeader(
      'X-Consultify-Csv-Scope',
      `sheet ${result.sheetIndex + 1} of ${result.totalSheets} ("${result.sheetName}")`
    );
    // NOTE: header VALUES must stay ASCII/Latin1-safe (Node's raw HTTP header
    // validation throws "Invalid character in header content" on e.g. an
    // em-dash) — plain hyphen here, unlike the prose docs/comments above.
    res.setHeader(
      'X-Consultify-Csv-Limitation',
      'CSV covers exactly one sheet; formulas are exported as inert source text (not computed values); styling/formatting/merges/other sheets are not preserved - use the XLSX export for those.'
    );
    res.send(result.csv);
  })
);

export default router;
