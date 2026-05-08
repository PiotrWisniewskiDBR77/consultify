/**
 * Presentation Studio Routes
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *
 * Endpoints:
 *   - S1: POST /source-pack/preview         (read-only source pack preview)
 *   - S2: POST /narrative-plan/preview      (read-only narrative plan preview)
 *   - S3: POST /template-architect/preview  (read-only template plan preview)
 *   - S4: POST /generate/preview            (read-only generate dispatcher preview)
 *
 * All endpoints are tenant-scoped, gated by the existing `presentation_create`
 * capability, and never write to the database. They reuse the orchestration
 * service which wraps the adopted source pack, narrative planner, template
 * architect, and template runtime services.
 *
 * The template architect preview always returns `approvalRequired: true` and
 * `templatePlan.governance.initialStatus = 'draft'`. The generate preview
 * always returns a `wouldGenerate` summary and never persists anything.
 * Promoting a template into the registry or persisting a real deck will land
 * in a future sprint behind an explicit approval endpoint, preserving the
 * proposal -> approval -> execution -> audit invariant for any mutating
 * operation.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import {
  hasPresentationCapability,
  type PresentationCapability,
} from '../services/presentationAccessPolicyService.js';
import type { DeckSetup, OutlineItem } from '../services/presentationGeneratorService.js';
import {
  previewPresentationStudioGenerate,
  previewPresentationStudioNarrativePlan,
  previewPresentationStudioSourcePack,
  previewPresentationStudioTemplatePlan,
} from '../services/presentationStudioOrchestrationService.js';

const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function ensurePresentationCapability(
  req: any,
  res: Response,
  capability: PresentationCapability
): boolean {
  const role = req.user?.role || req.userRole || 'VIEWER';
  if (hasPresentationCapability(role, capability)) return true;
  res.status(403).json({
    success: false,
    error: 'Permission denied',
    code: 'PERMISSION_DENIED',
    requiredCapability: capability,
  });
  return false;
}

/**
 * Parse a JSON body into a normalized `DeckSetup`. Body fields that are not
 * recognized by `DeckSetup` are silently dropped — caller must rely only on
 * canonical fields. Body-supplied `organizationId` is intentionally NOT read
 * here so it cannot leak across the tenant boundary established by auth.
 */
function parseDeckSetupFromBody(rawBody: unknown): DeckSetup {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Partial<DeckSetup> & {
    sourcePackStrict?: boolean;
    templateFamily?: string;
    deckType?: string;
  };
  const setup = {
    title: typeof body.title === 'string' ? body.title : '',
    audience: (typeof body.audience === 'string'
      ? body.audience
      : 'internal') as DeckSetup['audience'],
    goal: (typeof body.goal === 'string' ? body.goal : 'inform') as DeckSetup['goal'],
    language: (typeof body.language === 'string' ? body.language : 'en') as DeckSetup['language'],
    theme: (typeof body.theme === 'string' ? body.theme : 'corporate') as DeckSetup['theme'],
    confidentiality: (typeof body.confidentiality === 'string'
      ? body.confidentiality
      : 'internal') as DeckSetup['confidentiality'],
    brandColor: typeof body.brandColor === 'string' ? body.brandColor : undefined,
    sourceArtifacts: Array.isArray(body.sourceArtifacts) ? body.sourceArtifacts : [],
    templateId: typeof body.templateId === 'string' ? body.templateId : undefined,
    sourceType: typeof body.sourceType === 'string' ? body.sourceType : undefined,
    sourceId: typeof body.sourceId === 'string' ? body.sourceId : undefined,
    visuals:
      body.visuals && typeof body.visuals === 'object'
        ? (body.visuals as DeckSetup['visuals'])
        : undefined,
    sourcePack:
      body.sourcePack && typeof body.sourcePack === 'object'
        ? (body.sourcePack as DeckSetup['sourcePack'])
        : undefined,
    sourcePackStrict: Boolean(body.sourcePackStrict),
  } as DeckSetup;
  // `DeckSetup` formally does not declare templateFamily/deckType, but the
  // generator + template architect read them via `(setup as any)`. Forward
  // them as untyped extras so previews respect the same dispatch logic.
  if (typeof body.templateFamily === 'string' && body.templateFamily.trim()) {
    (setup as any).templateFamily = body.templateFamily.trim();
  }
  if (typeof body.deckType === 'string' && body.deckType.trim()) {
    (setup as any).deckType = body.deckType.trim();
  }
  return setup;
}

/**
 * Parse a JSON body into a normalized `OutlineItem[]`. Each entry must have a
 * non-empty `title`; otherwise it is dropped. Unknown fields are silently
 * stripped to keep the preview deterministic.
 */
function parseOutlineFromBody(rawOutline: unknown): OutlineItem[] {
  if (!Array.isArray(rawOutline)) return [];
  const result: OutlineItem[] = [];
  for (const entry of rawOutline) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<OutlineItem>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;
    result.push({
      intent: (typeof item.intent === 'string' ? item.intent : 'cover') as OutlineItem['intent'],
      title,
      keyMessage: typeof item.keyMessage === 'string' ? item.keyMessage : undefined,
      enabled: item.enabled !== false,
      sourceRef: typeof item.sourceRef === 'string' ? item.sourceRef : undefined,
      sourceRefs: Array.isArray(item.sourceRefs)
        ? item.sourceRefs.filter((ref): ref is string => typeof ref === 'string')
        : undefined,
      confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      density: item.density,
      visualPolicy: typeof item.visualPolicy === 'string' ? item.visualPolicy : undefined,
      layoutHint: typeof item.layoutHint === 'string' ? item.layoutHint : undefined,
      suggestedBlocks: Array.isArray(item.suggestedBlocks)
        ? item.suggestedBlocks.filter((b): b is string => typeof b === 'string')
        : undefined,
      notesPolicy: item.notesPolicy,
      warnings: Array.isArray(item.warnings)
        ? item.warnings.filter((w): w is string => typeof w === 'string')
        : undefined,
    });
  }
  return result;
}

router.use(verifyToken);

/**
 * POST /api/presentation-studio/source-pack/preview
 *
 * Read-only preview of the presentation source pack used by Studio UI to show
 * coverage / readiness / missing inputs before any deck generation.
 *
 * Body shape (subset of `DeckSetup`):
 *   - title?: string
 *   - audience?: string
 *   - goal?: 'inform' | 'decide' | 'sell' | 'align' | string
 *   - templateId?: string
 *   - sourceArtifacts?: SourceArtifact[]
 *   - sourcePackStrict?: boolean
 *
 * Tenant safety:
 *   - `organizationId` is taken from the authenticated session, never from the
 *     request body. Body-supplied org ids are ignored.
 *   - The endpoint never writes to the DB and never returns cross-tenant data.
 */
router.post(
  '/source-pack/preview',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }

    const setup = parseDeckSetupFromBody(req.body);
    const result = previewPresentationStudioSourcePack({
      setup,
      organizationId: orgId,
      strict: setup.sourcePackStrict,
    });

    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/presentation-studio/narrative-plan/preview
 *
 * Read-only preview of the deck-level narrative plan (thesis, storyline,
 * proof points, decisions, per-slide narrative role) used by Studio UI
 * before any deck generation.
 *
 * Body shape:
 *   - setup: subset of `DeckSetup` (same as /source-pack/preview body)
 *   - outline?: OutlineItem[] (optional; defaults to empty)
 *   - sourcePack?: PresentationSourcePack (optional; rebuilt from setup if omitted)
 *
 * Tenant safety:
 *   - `organizationId` is taken from the authenticated session, never from
 *     the request body. Body-supplied org ids are ignored.
 *   - The endpoint never writes to the DB and never returns cross-tenant data.
 */
router.post(
  '/narrative-plan/preview',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      setup?: unknown;
      outline?: unknown;
      sourcePack?: unknown;
    };
    const setup = parseDeckSetupFromBody(body.setup);
    const outline = parseOutlineFromBody(body.outline);
    const providedSourcePack =
      body.sourcePack &&
      typeof body.sourcePack === 'object' &&
      Array.isArray((body.sourcePack as any).sources)
        ? (body.sourcePack as any)
        : undefined;

    const result = previewPresentationStudioNarrativePlan({
      setup,
      organizationId: orgId,
      outline,
      sourcePack: providedSourcePack,
    });

    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/presentation-studio/template-architect/preview
 *
 * Read-only preview of a draft AI template plan (sections, slide blueprints,
 * required/optional inputs, governance envelope) used by the Studio UI to
 * confirm "what would the template look like" before it is ever submitted
 * for approval. NEVER writes to the registry. Always surfaces
 * `approvalRequired: true`.
 *
 * Body shape:
 *   - setup: subset of `DeckSetup` (same as /source-pack/preview body)
 *   - outline?: OutlineItem[] (optional; defaults to empty)
 *   - sourcePack?: PresentationSourcePack (optional; rebuilt from setup if omitted)
 *   - narrativePlan?: PresentationNarrativePlan (optional; rebuilt if omitted)
 *
 * Tenant safety:
 *   - `organizationId` is taken from the authenticated session, never from
 *     the request body. Body-supplied org ids are ignored.
 *   - The endpoint never writes to the DB and never returns cross-tenant data.
 *
 * Governance:
 *   - The response always carries `approvalRequired: true` and
 *     `templatePlan.governance.initialStatus = 'draft'`. Promoting the plan
 *     into the registry requires an explicit approval endpoint (later sprint)
 *     under the proposal -> approval -> execution -> audit invariant.
 */
router.post(
  '/template-architect/preview',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      setup?: unknown;
      outline?: unknown;
      sourcePack?: unknown;
      narrativePlan?: unknown;
    };
    const setup = parseDeckSetupFromBody(body.setup);
    const outline = parseOutlineFromBody(body.outline);
    const providedSourcePack =
      body.sourcePack &&
      typeof body.sourcePack === 'object' &&
      Array.isArray((body.sourcePack as any).sources)
        ? (body.sourcePack as any)
        : undefined;
    const providedNarrativePlan =
      body.narrativePlan &&
      typeof body.narrativePlan === 'object' &&
      Array.isArray((body.narrativePlan as any).slidePlan)
        ? (body.narrativePlan as any)
        : undefined;

    const result = previewPresentationStudioTemplatePlan({
      setup,
      organizationId: orgId,
      outline,
      sourcePack: providedSourcePack,
      narrativePlan: providedNarrativePlan,
    });

    res.json({ success: true, data: result });
  })
);

/**
 * POST /api/presentation-studio/generate/preview
 *
 * Read-only preview of what `generateOutline` WOULD produce if invoked NOW
 * (outline preview, estimated slide count, used template runtime, blocking
 * reasons). NEVER writes to the DB, never reads from it, never emits audit
 * events.
 *
 * Body shape:
 *   - setup: subset of `DeckSetup` (same as /source-pack/preview body)
 *   - outline?: OutlineItem[] (optional; default outline is built from
 *     templateFamily/deckType in setup or from the narrative plan)
 *   - sourcePack?: PresentationSourcePack (optional; rebuilt from setup if
 *     omitted)
 *   - narrativePlan?: PresentationNarrativePlan (optional; rebuilt if
 *     omitted)
 *   - strict?: boolean (optional; defaults to setup.sourcePackStrict)
 *
 * Tenant safety:
 *   - `organizationId` is taken from the authenticated session, never from
 *     the request body. Body-supplied org ids are ignored.
 *   - The endpoint never writes to the DB and never returns cross-tenant
 *     data.
 *
 * Governance:
 *   - This is a preview only. Real generation (`generateOutline`) persists
 *     a draft deck to the DB and emits audit events; that endpoint will be
 *     introduced in a later sprint, gated by an explicit approval flow.
 *   - The response carries `wouldGenerate.canProceed` so the UI can render
 *     an honest "Generate" button state without itself trying to predict
 *     blocking conditions.
 */
router.post(
  '/generate/preview',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      setup?: unknown;
      outline?: unknown;
      sourcePack?: unknown;
      narrativePlan?: unknown;
      strict?: unknown;
    };
    const setup = parseDeckSetupFromBody(body.setup);
    const outline = parseOutlineFromBody(body.outline);
    const providedSourcePack =
      body.sourcePack &&
      typeof body.sourcePack === 'object' &&
      Array.isArray((body.sourcePack as any).sources)
        ? (body.sourcePack as any)
        : undefined;
    const providedNarrativePlan =
      body.narrativePlan &&
      typeof body.narrativePlan === 'object' &&
      Array.isArray((body.narrativePlan as any).slidePlan)
        ? (body.narrativePlan as any)
        : undefined;
    const strict = typeof body.strict === 'boolean' ? body.strict : undefined;

    const result = previewPresentationStudioGenerate({
      setup,
      organizationId: orgId,
      outline,
      sourcePack: providedSourcePack,
      narrativePlan: providedNarrativePlan,
      strict,
    });

    res.json({ success: true, data: result });
  })
);

export default router;
