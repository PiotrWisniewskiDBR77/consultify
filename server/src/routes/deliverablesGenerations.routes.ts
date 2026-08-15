/**
 * Deliverables — lekki runtime: ROUTER KONTRAKTU GENERACJI (L1, krok 3)
 *
 * POST /api/deliverables/generations                → krok PLAN (edytowalny outline)
 * POST /api/deliverables/generations/:id/generate   → krok GENERATE (202, w tle)
 * GET  /api/deliverables/generations/:id            → poll stanu
 *
 * Za flagą ENABLE_DELIVERABLES_LIGHT (wzorzec MELS): gdy off — 404 na całej
 * powierzchni, mount w Gateway jest behavior-neutral. Cienka warstwa HTTP:
 * cała logika w deliverablesGenerationService.
 */

import { type Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { featureFlags } from '../config/FeatureFlags.js';
import db from '../database/PostgresDatabase.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
// W5 (F5 kompozycja) — konektory + formularze → tabela materiału:
import { connectorRegistry } from '../services/dataCollection/connectorFramework.js';
import { extractBrandTheme } from '../services/deliverables/brandIngestion.js';
// W3.2 (F2.2) — wzbogacenie briefu o kontekst organizacji przed generacją:
import { enrichBriefWithOrgContext } from '../services/deliverables/briefEnrichment.js';
import {
  bundleFilesToZip,
  exportBundleFiles,
  safeBundleBaseName,
} from '../services/deliverables/bundleExportRuntime.js';
import { generateBundle } from '../services/deliverables/bundleGenerationRuntime.js';
import {
  generateBusinessPlan,
  spineToDeckSlides,
  spineToDocOutline,
  spineToTableIntent,
} from '../services/deliverables/bundleOrchestrator.js';
import {
  DeliverablesGenerationError,
  plan,
  start,
  status,
} from '../services/deliverables/deliverablesGenerationService.js';
import { getDeliverableMetrics } from '../services/deliverables/deliverablesMetricsService.js';
import { connectorDataset, formDataset } from '../services/deliverables/materialDataBinding.js';
import {
  aggregateQualityTelemetry,
  recordsFromRows,
} from '../services/deliverables/qualityTelemetry.js';
import { firstRunSeedPlan } from '../services/deliverables/starterTemplates.js';
import { isThemeId } from '../services/deliverables/themeRegistry.js';
// W3.3 (F2.3) — upload pliku → tekst kontekstowy:
import { extractUploadContext } from '../services/deliverables/uploadContextExtract.js';
import { hasPresentationCapability } from '../services/presentationAccessPolicyService.js';
import formService from '../services/tablePlatform/FormService.js';
import type {
  CreateGenerationRequest,
  DeliverableFormat,
  StartGenerationRequest,
} from '../types/deliverablesGeneration.js';
import logger from '../utils/Logger.js';

const router = Router();

// Flaga sprawdzana per-request (nie przy mount), żeby zmiana env + restart
// nie wymagała zmian w Gateway i żeby testy mogły ją przestawiać.
router.use((_req, res, next) => {
  if (!featureFlags.ENABLE_DELIVERABLES_LIGHT) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
});

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.userId || 'system';
}

function ensureGenerateCapability(req: any, res: Response): boolean {
  const role = req.user?.role || req.userRole || 'VIEWER';
  if (hasPresentationCapability(role, 'presentation_create')) return true;
  res.status(403).json({
    success: false,
    error: 'Permission denied',
    code: 'PERMISSION_DENIED',
    requiredCapability: 'presentation_create',
  });
  return false;
}

const VALID_FORMATS: DeliverableFormat[] = ['deck', 'doc', 'sheet'];

// P1-2 (audyt): whitelist pól setupu — user-JSON nie płynie dalej bez schemy.
// zod domyślnie wycina nieznane klucze (strip), więc nadmiarowe pola po prostu znikają.
const SourceRefSchema = z.object({
  sourceType: z.string().max(64),
  sourceId: z.string().max(128),
  sourceTitle: z.string().max(300).optional(),
});

const DocSheetSetupSchema = z.object({
  intent: z.string().min(1).max(4000).optional(),
  language: z.enum(['pl', 'en']).optional(),
  title: z.string().max(200).optional(),
  conversationContext: z.string().max(8000).optional(),
  conversationId: z.string().max(128).optional(),
  sourceRefs: z.array(SourceRefSchema).max(20).optional(),
  audience: z.array(z.string().max(120)).max(10).optional(),
});

const DeckSetupSchema = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string().max(128).optional(),
  // Temat/brief z prośby czatu (audyt 2026-07-22, root-cause deck-treść). Bez tego
  // pola zod stripował brief na POST /generations + /generate, więc `setup.brief`
  // nigdy nie docierał do generateDeck → useBriefRewrite=false → „brak danych".
  brief: z.string().max(4000).optional(),
  audience: z.enum(['sponsor', 'executive', 'investor', 'internal']),
  goal: z.enum(['inform', 'decide', 'sell', 'align']),
  language: z.enum(['pl', 'en']),
  theme: z.enum(['corporate', 'minimal', 'modern']),
  confidentiality: z.enum(['confidential', 'internal', 'public']),
  brandColor: z.string().max(32).optional(),
  sourceType: z.string().max(64).optional(),
  sourceId: z.string().max(128).optional(),
  sourceArtifacts: z
    .array(
      z.object({
        type: z.string().max(64),
        id: z.string().max(128).optional(),
        artifactId: z.string().max(128).optional(),
        label: z.string().max(300),
        confidence: z.number().min(0).max(1).optional(),
        readiness: z.string().max(64).optional(),
      })
    )
    .max(20)
    .default([]),
  visuals: z
    .object({
      enabled: z.boolean().optional(),
      priority: z.enum(['quality', 'cost']).optional(),
      imageDensity: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

function parseSetupOrRespond(
  res: Response,
  format: DeliverableFormat,
  rawSetup: unknown
): Record<string, unknown> | null {
  const schema = format === 'deck' ? DeckSetupSchema : DocSheetSetupSchema;
  const parsed = schema.safeParse(rawSetup ?? {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid setup for '${format}': ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'setup'} — ${i.message}`)
        .join('; ')}`,
      code: 'invalid_setup',
    });
    return null;
  }
  return parsed.data as Record<string, unknown>;
}

const IntentSchema = z.string().max(4000).optional();

function handleServiceError(res: Response, err: unknown): void {
  if (err instanceof DeliverablesGenerationError) {
    const httpByCode = {
      not_implemented: 501,
      not_found: 404,
      invalid_state: 409,
      invalid_setup: 400,
    } as const;
    res.status(httpByCode[err.code]).json({ success: false, error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[DeliverablesGen:routes] ${message}`);
  res.status(500).json({ success: false, error: 'Generation failed', code: 'internal_error' });
}

// POST / — krok PLAN
// P1-3 (audyt): każdy POST = wywołanie LLM — limit jak inne endpointy AI (30/min prod).
router.post('/', aiRateLimiter, async (req: any, res: Response) => {
  if (!ensureGenerateCapability(req, res)) return;
  const body = (req.body || {}) as Partial<CreateGenerationRequest>;
  if (!body.format || !VALID_FORMATS.includes(body.format)) {
    res.status(400).json({
      success: false,
      error: `format must be one of: ${VALID_FORMATS.join(', ')}`,
      code: 'invalid_setup',
    });
    return;
  }
  const setup = parseSetupOrRespond(res, body.format, body.setup);
  if (!setup) return;
  const intentParsed = IntentSchema.safeParse(body.intent);
  try {
    const result = await plan({
      format: body.format,
      setup,
      intent: intentParsed.success ? intentParsed.data : undefined,
      organizationId: getOrgId(req),
      userId: getUserId(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /:id/generate — krok GENERATE (async, 202 + poll)
router.post('/:id/generate', aiRateLimiter, async (req: any, res: Response) => {
  if (!ensureGenerateCapability(req, res)) return;
  const body = (req.body || {}) as Partial<StartGenerationRequest> & {
    format?: DeliverableFormat;
  };
  // L-05 (M02): an absent/invalid format must FAIL LOUDLY, not silently default
  // to 'deck'. A missing format means a miswired caller — generating a deck for
  // a doc/sheet request is a worse outcome than a 400. All live FE callers send
  // an explicit format ('deck' | 'doc' | 'sheet'), so this only rejects bugs.
  if (!body.format || !VALID_FORMATS.includes(body.format)) {
    return res.status(400).json({
      success: false,
      error: `format is required and must be one of: ${VALID_FORMATS.join(', ')}`,
    });
  }
  const format = body.format;
  const setup = parseSetupOrRespond(res, format, body.setup);
  if (!setup) return;
  try {
    const result = await start({
      generationId: String(req.params.id),
      format,
      setup,
      plan: body.plan,
      organizationId: getOrgId(req),
      userId: getUserId(req),
    });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /metrics — agregaty §8 dla decyzji D3 (admin org-scoped).
// MUSI być przed `/:id`, inaczej router potraktuje "metrics" jako generationId.
router.get('/metrics', async (req: any, res: Response) => {
  const role = String(req.user?.role || req.userRole || '')
    .trim()
    .toUpperCase();
  if (!['ADMIN', 'OWNER', 'SUPERADMIN', 'ADMINISTRATOR'].includes(role)) {
    res.status(403).json({ success: false, error: 'Permission denied', code: 'PERMISSION_DENIED' });
    return;
  }
  const windowDays = Math.min(365, Math.max(1, Number(req.query.windowDays) || 30));
  try {
    const metrics = await getDeliverableMetrics(getOrgId(req), windowDays);
    res.status(200).json({ success: true, metrics });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /:id — poll stanu
router.get('/:id', async (req: any, res: Response) => {
  try {
    const result = await status({
      generationId: String(req.params.id),
      organizationId: getOrgId(req),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /business-plan — F0: jeden brief → spójny SPINE (źródło prawdy) + wejścia
// dla B4/B3/B1 (hero-numbers identyczne). Za flagą ENABLE_DELIVERABLES_PREMIUM
// (OFF → 404, klienci nietknięci). LLM → rate-limit jak inne endpointy AI.
const BusinessPlanSchema = z.object({
  brief: z.string().min(20).max(8000),
  language: z.enum(['pl', 'en']).optional(),
});

router.post('/business-plan', aiRateLimiter, async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  if (!ensureGenerateCapability(req, res)) return;
  const parsed = BusinessPlanSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid brief: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
      code: 'invalid_setup',
    });
    return;
  }
  try {
    const spine = await generateBusinessPlan(parsed.data.brief, {
      orgId: getOrgId(req),
      preferPremium: true,
    });
    if (!spine) {
      res
        .status(502)
        .json({ success: false, error: 'Business plan generation failed', code: 'internal_error' });
      return;
    }
    res.status(200).json({
      success: true,
      spine,
      generatorInputs: {
        tableIntent: spineToTableIntent(spine),
        docOutline: spineToDocOutline(spine),
        deckSlides: spineToDeckSlides(spine),
      },
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

/**
 * W4.2 — zapis wiązki do deliverable_bundles po eksporcie (fire-and-forget;
 * nigdy nie blokuje odpowiedzi ZIP, fail-soft: błąd tylko w logu).
 */
async function persistBundleRecord(opts: {
  orgId: string;
  userId?: string;
  brief: string;
  title: string;
  language: string;
  themeId: string | undefined;
  qualityJson: unknown;
  heroNumbersJson: unknown;
}): Promise<void> {
  try {
    const { orgId, userId, brief, title, language, themeId, qualityJson, heroNumbersJson } = opts;
    await db.query(
      `INSERT INTO deliverable_bundles
        (organization_id, user_id, brief, title, lifecycle_state, theme_id, language, quality_json, hero_numbers_json, is_locked)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, FALSE)
       ON CONFLICT DO NOTHING`,
      [
        orgId,
        userId ?? null,
        brief.slice(0, 4000),
        title,
        themeId ?? null,
        language,
        JSON.stringify(qualityJson ?? null),
        JSON.stringify(heroNumbersJson ?? null),
      ]
    );
  } catch (err) {
    logger.warn(
      '[bundle/export] persistBundleRecord failed (non-fatal):',
      err instanceof Error ? err.message : String(err)
    );
  }
}

// POST /bundle — B5 (W4): brief → SPINE → spójna wiązka (tabela+raport+deck).
// Za flagą ENABLE_DELIVERABLES_PREMIUM (OFF → 404). Fail-open per artefakt
// (każdy timeout nie kładzie całej wiązki — sprawdź `produced` w odpowiedzi).
const BundleSchema = z.object({
  brief: z.string().min(20).max(8000),
  language: z.enum(['pl', 'en']).optional(),
  useOrgContext: z.boolean().optional(),
});

router.post('/bundle', aiRateLimiter, async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  if (!ensureGenerateCapability(req, res)) return;
  const parsed = BundleSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid bundle request: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
      code: 'invalid_setup',
    });
    return;
  }
  try {
    const orgId = getOrgId(req);
    // W3.2 — opcjonalnie zakotwicz brief w kontekście org (fail-soft: brak trafień → oryginał).
    let brief = parsed.data.brief;
    if (parsed.data.useOrgContext && orgId) {
      const enriched = await enrichBriefWithOrgContext(brief, orgId, undefined, {
        language: parsed.data.language,
      });
      brief = enriched.enrichedBrief;
    }
    const bundle = await generateBundle(brief, {
      orgId,
      preferPremium: true,
    });
    if (!bundle) {
      res.status(502).json({
        success: false,
        error: 'Bundle generation failed: spine could not be created',
        code: 'internal_error',
      });
      return;
    }
    res.status(200).json({ success: true, bundle });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /bundle/export — F4.2: brief → SPINE → wiązka → TECZKA .zip (docx+xlsx+pptx).
// „Pobierz komplet": jeden materiał, trzy spójne pliki Office w jednym pobraniu.
// Za flagą ENABLE_DELIVERABLES_PREMIUM (OFF → 404). `themeId` z themeRegistry steruje
// fontami/paletą na wszystkich 3 powierzchniach (spójność wizualna).
// F8.1: opcjonalne pole `brandFile` (multipart) → extractBrandTheme → override fontów/palety.
const BundleExportSchema = z.object({
  brief: z.string().min(20).max(8000),
  language: z.enum(['pl', 'en']).optional(),
  themeId: z.string().max(32).optional(),
  useOrgContext: z.coerce.boolean().optional(),
});

// Multer: opcjonalne pole brandFile (pptx/docx klienta) — max 10 MB, memoryStorage.
const brandUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('brandFile');

function parseBrandUpload(req: any, res: Response): Promise<void> {
  if (!req.is('multipart/form-data')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    brandUpload(req, res as any, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

router.post('/bundle/export', aiRateLimiter, async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  if (!ensureGenerateCapability(req, res)) return;

  // Parse optional multipart (brand file) — falls through for plain JSON too.
  try {
    await parseBrandUpload(req, res);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid brand upload',
      code: 'invalid_upload',
    });
    return;
  }

  // Body can come from JSON (no file) or from multipart form-data fields.
  const bodySource = req.body ?? {};
  const parsed = BundleExportSchema.safeParse(bodySource);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: `Invalid bundle export request: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
      code: 'invalid_setup',
    });
    return;
  }
  try {
    const orgId = getOrgId(req);
    // W3.2 — opcjonalne zakotwiczenie briefu w kontekście org (fail-soft).
    let exportBrief = parsed.data.brief;
    if (parsed.data.useOrgContext && orgId) {
      const enriched = await enrichBriefWithOrgContext(exportBrief, orgId, undefined, {
        language: parsed.data.language,
      });
      exportBrief = enriched.enrichedBrief;
    }
    const bundle = await generateBundle(exportBrief, {
      orgId,
      preferPremium: true,
    });
    if (!bundle) {
      res
        .status(502)
        .json({ success: false, error: 'Bundle generation failed', code: 'internal_error' });
      return;
    }

    const themeId = isThemeId(parsed.data.themeId) ? parsed.data.themeId : undefined;
    // F8.1: jeśli klient wrzucił plik brandowy → wyciągnij override fontów/palety (fail-soft).
    const brandOverride = req.file?.buffer
      ? await extractBrandTheme(req.file.buffer).catch(() => null)
      : undefined;

    const files = await exportBundleFiles(bundle, themeId, brandOverride ?? undefined);
    const base = safeBundleBaseName(bundle.spine.meta.company);
    const zipBuffer = await bundleFilesToZip(files, base);
    if (!zipBuffer) {
      res
        .status(502)
        .json({ success: false, error: 'No exportable files produced', code: 'internal_error' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-komplet.zip"`);
    res.status(200).send(zipBuffer);

    // W4.2 — fire-and-forget persistence (sent after res.send, non-blocking)
    void persistBundleRecord({
      orgId: getOrgId(req),
      userId: req.user?.id,
      brief: parsed.data.brief,
      title: base,
      language: parsed.data.language ?? 'pl',
      themeId,
      qualityJson: bundle.quality ?? null,
      heroNumbersJson: bundle.spine.heroNumbers ?? null,
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /bundles — W4.3: lista wygenerowanych bundli dla org (ostatnie 50).
router.get('/bundles', async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(400).json({ success: false, error: 'Organization not found' });
      return;
    }
    const result = await db.query(
      `SELECT id, title, brief, lifecycle_state, theme_id, language, is_locked,
              quality_json, created_at, updated_at
       FROM deliverable_bundles
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [orgId]
    );
    res.status(200).json({
      success: true,
      bundles: (result?.rows ?? []).map((r: any) => ({
        id: r.id,
        title: r.title || r.brief?.slice(0, 80),
        lifecycleState: r.lifecycle_state,
        themeId: r.theme_id,
        language: r.language,
        isLocked: r.is_locked,
        qualityPassed: (r.quality_json as any)?.passed ?? null,
        // W10.1 — zagregowana ocena jakości (scorecard) do podglądu w historii.
        qualityScore: (r.quality_json as any)?.scorecard?.overall ?? null,
        qualityGrade: (r.quality_json as any)?.scorecard?.grade ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /starters — W10.2 (seeding): katalog startowych szablonów dla first-run.
router.get('/starters', async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    const industryHint = typeof req.query?.industry === 'string' ? req.query.industry : undefined;
    const plan = firstRunSeedPlan(industryHint);
    res.status(200).json({ success: true, ...plan });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// GET /bundles/telemetry — W10.2: agregat jakości materiałów org (scorecardy w czasie).
router.get('/bundles/telemetry', async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(400).json({ success: false, error: 'Organization not found' });
      return;
    }
    const result = await db.query(
      `SELECT quality_json, created_at
       FROM deliverable_bundles
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [orgId]
    );
    const rows = (result?.rows ?? []) as Array<{
      quality_json?: unknown;
      created_at?: string | number;
    }>;
    const telemetry = aggregateQualityTelemetry(recordsFromRows(rows));
    res.status(200).json({ success: true, telemetry });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ── W5 (F5) — Dane: konektory + formularze → tabela materiału (kompozycja) ──

// GET /data/connectors — W5.1: lista dostępnych typów konektorów (z rejestru F5).
router.get('/data/connectors', async (_req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    res.status(200).json({ success: true, types: connectorRegistry.listTypes() });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /data/connectors/preview — W5.1: podgląd danych ze źródła (komponuje fetchRecords).
const ConnectorPreviewSchema = z.object({
  type: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()),
  limit: z.number().int().min(1).max(500).optional(),
});
router.post('/data/connectors/preview', aiRateLimiter, async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const parsed = ConnectorPreviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, error: 'Invalid connector preview request', code: 'invalid_setup' });
    return;
  }
  try {
    const dataset = await connectorDataset(parsed.data.type, parsed.data.config, {
      limit: parsed.data.limit ?? 25,
    });
    if (!dataset) {
      res
        .status(502)
        .json({ success: false, error: 'Connector returned no data', code: 'internal_error' });
      return;
    }
    res.status(200).json({ success: true, dataset });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /data/forms/:formId/dataset — W5.2: zgłoszenia formularza → dataset materiału.
router.post('/data/forms/:formId/dataset', async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const formId = String(req.params.formId ?? '');
  if (!formId) {
    res.status(400).json({ success: false, error: 'Missing formId' });
    return;
  }
  try {
    // Etykiety kolumn z definicji formularza (fieldId → label) — czytelne nagłówki.
    let fieldLabels: Record<string, string> | undefined;
    try {
      const form = await formService.getForm(formId);
      fieldLabels = Object.fromEntries(
        (form.config?.fields ?? [])
          .filter((f: any) => f.label)
          .map((f: any) => [f.fieldId, f.label as string])
      );
    } catch {
      fieldLabels = undefined; // brak etykiet → klucze surowe (fail-soft)
    }
    const dataset = await formDataset(formId, {
      fetchSubmissions: (id) => formService.getSubmissions(id, { limit: 500 }),
      fieldLabels,
    });
    if (!dataset) {
      res
        .status(502)
        .json({ success: false, error: 'Form returned no data', code: 'internal_error' });
      return;
    }
    res.status(200).json({ success: true, dataset });
  } catch (err) {
    handleServiceError(res, err);
  }
});

// POST /data/extract — W3.3: upload pliku (pdf/docx/xlsx/csv/txt) → tekst kontekstowy.
const contextUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).single('contextFile');
function parseContextUpload(req: any, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    contextUpload(req, res as any, (err: any) => (err ? reject(err) : resolve()));
  });
}
router.post('/data/extract', aiRateLimiter, async (req: any, res: Response) => {
  if (!featureFlags.ENABLE_DELIVERABLES_PREMIUM) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  try {
    await parseContextUpload(req, res);
  } catch {
    res
      .status(400)
      .json({ success: false, error: 'Upload too large or malformed', code: 'invalid_setup' });
    return;
  }
  const file = req.file;
  if (!file?.buffer) {
    res.status(400).json({ success: false, error: 'Missing contextFile', code: 'invalid_setup' });
    return;
  }
  try {
    const result = await extractUploadContext(
      file.buffer,
      file.originalname ?? 'upload',
      file.mimetype
    );
    if (!result.ok) {
      res.status(422).json({
        success: false,
        error: `Unsupported or empty file (${result.kind})`,
        code: 'invalid_setup',
      });
      return;
    }
    res.status(200).json({ success: true, extract: result });
  } catch (err) {
    handleServiceError(res, err);
  }
});

export default router;
