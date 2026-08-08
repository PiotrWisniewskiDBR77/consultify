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
 *   - S6: POST /generate/request-approval   (mints a single-use approval ticket)
 *   - S6: POST /generate                    (mutating; redeems ticket; persists deck; emits audit)
 *   - S9: GET  /source-artifacts            (read-only; enumerates available source artifacts)
 *
 * Read-only endpoints (S1..S4) are tenant-scoped and gated by the existing
 * `presentation_create` capability. They never write to the database.
 *
 * Mutating endpoints (S6) preserve the proposal -> approval -> execution ->
 * audit invariant:
 *   1. Client calls `previewSourcePack` / `previewGenerate` (read-only).
 *   2. Client calls `request-approval` to mint a single-use ticket bound to
 *      (organizationId, userId, payload fingerprint) for ~10 minutes.
 *   3. Client calls `generate` with the ticket id; server redeems atomically,
 *      invokes the real generator, persists the deck, emits the audit event
 *      `presentation_generated_via_studio`, and returns the deck id.
 *
 * The ticket is never reusable: a swapped payload, a different user, a
 * different tenant, or a re-redeem of the same ticket all return
 * `INVALID_APPROVAL_TICKET`.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import {
  hasPresentationCapability,
  type PresentationCapability,
} from '../services/presentationAccessPolicyService.js';
import type { DeckSetup, OutlineItem } from '../services/presentationGeneratorService.js';
import { regenerateSlide } from '../services/presentationGeneratorService.js';
import {
  executeLayoutCapacityOverrides,
  executeLayoutCapacityReset,
  proposeLayoutCapacityOverrides,
  proposeLayoutCapacityReset,
} from '../services/presentationStudioLayoutCapacityAdminService.js';
import {
  getCurrentRegistrySnapshot,
  getDefaultRegistrySnapshot,
  getRegistryLoadWarning,
  type LayoutCapacityOverridesPayload,
} from '../services/presentationStudioLayoutCapacityRegistryService.js';
import {
  executePresentationStudioGenerate,
  previewPresentationStudioGenerate,
  previewPresentationStudioNarrativePlan,
  previewPresentationStudioSourcePack,
  previewPresentationStudioTemplatePlan,
  requestPresentationStudioGenerateApproval,
} from '../services/presentationStudioOrchestrationService.js';
import { listPresentationStudioSourceArtifacts } from '../services/presentationStudioSourceArtifactsService.js';

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
      slotDensities:
        item.slotDensities && typeof item.slotDensities === 'object'
          ? {
              title:
                typeof (item.slotDensities as { title?: unknown }).title === 'string'
                  ? ((item.slotDensities as { title?: string }).title as
                      | 'visual'
                      | 'balanced'
                      | 'document')
                  : undefined,
              keyMessage:
                typeof (item.slotDensities as { keyMessage?: unknown }).keyMessage === 'string'
                  ? ((item.slotDensities as { keyMessage?: string }).keyMessage as
                      | 'visual'
                      | 'balanced'
                      | 'document')
                  : undefined,
              blocks:
                typeof (item.slotDensities as { blocks?: unknown }).blocks === 'string'
                  ? ((item.slotDensities as { blocks?: string }).blocks as
                      | 'visual'
                      | 'balanced'
                      | 'document')
                  : undefined,
            }
          : undefined,
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

/**
 * POST /api/presentation-studio/generate/request-approval
 *
 * Phase A of the mutating generate flow. Validates that generation would
 * succeed (`wouldGenerate.canProceed`) and mints a SINGLE-USE approval ticket
 * bound to the authenticated `(organizationId, userId, payload fingerprint)`
 * tuple. Does NOT invoke `generateOutline` and does NOT persist a deck.
 *
 * Body shape: same as `/generate/preview` (`{ setup?, outline?, sourcePack?,
 * narrativePlan?, strict? }`).
 *
 * Tenant safety:
 *   - `organizationId` and `userId` come from the authenticated session.
 *   - Body-supplied org/user ids are ignored.
 *
 * Response:
 *   - 200 `{ success: true, data: { ticket, generatePreview, payloadFingerprint } }`
 *     when the preview's `wouldGenerate.canProceed` is true.
 *   - 412 `{ success: false, code: 'PRECONDITION_NOT_MET', reason, preview }`
 *     when the preview blocks generation. The UI should surface the reason
 *     and the blocking-reasons list from the embedded preview, not retry.
 */
router.post(
  '/generate/request-approval',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }
    if (!userId) {
      res.status(403).json({
        success: false,
        error: 'User context required',
        code: 'NO_USER_CONTEXT',
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

    const result = requestPresentationStudioGenerateApproval({
      setup,
      organizationId: orgId,
      userId,
      outline,
      sourcePack: providedSourcePack,
      narrativePlan: providedNarrativePlan,
      strict,
    });

    if (result.ok === false) {
      res.status(412).json({
        success: false,
        code: result.code,
        error: result.reason,
        preview: result.preview,
      });
      return;
    }
    res.json({
      success: true,
      data: {
        ticket: result.ticket,
        generatePreview: result.generatePreview,
        payloadFingerprint: result.payloadFingerprint,
      },
    });
  })
);

/**
 * POST /api/presentation-studio/generate
 *
 * Phase B of the mutating generate flow. Atomically redeems a single-use
 * approval ticket and invokes the real `generateOutline`, which:
 *   - Persists a draft deck row in `presentation_decks` (tenant-scoped).
 *   - Returns the generated outline + deck id + validation warnings.
 *
 * On success the route emits the canonical
 * `presentation_generated_via_studio` audit log entry and returns the deck
 * info. On any ticket validation failure NO deck is persisted and NO audit
 * event is emitted (the orchestrator short-circuits before invoking the
 * generator).
 *
 * Body shape:
 *   - approvalTicket: string (REQUIRED — id of the ticket from /request-approval)
 *   - setup, outline?, sourcePack?, narrativePlan?, strict? — must match the
 *     payload fingerprinted at request-approval time, otherwise the ticket
 *     redemption fails with `payload_mismatch`.
 *
 * Responses:
 *   - 200 `{ success: true, data: { deckId, slideCount, outline, validationWarnings, ticketId, auditEvent } }`
 *   - 403 `{ success: false, code: 'PRECONDITION_REQUIRED', error: 'Approval ticket required.' }`
 *     when no ticket id is supplied.
 *   - 403 `{ success: false, code: 'INVALID_APPROVAL_TICKET', reason }`
 *     when ticket validation fails (not_found, expired, consumed,
 *     tenant_mismatch, user_mismatch, payload_mismatch).
 */
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_create')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res.status(403).json({
        success: false,
        error: 'Organization context required',
        code: 'NO_ORG_CONTEXT',
      });
      return;
    }
    if (!userId) {
      res.status(403).json({
        success: false,
        error: 'User context required',
        code: 'NO_USER_CONTEXT',
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      approvalTicket?: unknown;
      setup?: unknown;
      outline?: unknown;
      sourcePack?: unknown;
      narrativePlan?: unknown;
      strict?: unknown;
    };
    const ticketId = typeof body.approvalTicket === 'string' ? body.approvalTicket.trim() : '';
    if (!ticketId) {
      res.status(403).json({
        success: false,
        code: 'PRECONDITION_REQUIRED',
        error: 'Approval ticket required.',
      });
      return;
    }
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

    const result = await executePresentationStudioGenerate({
      setup,
      organizationId: orgId,
      userId,
      ticketId,
      outline,
      sourcePack: providedSourcePack,
      narrativePlan: providedNarrativePlan,
      strict,
      ipAddress: req.ip || null,
      userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    if (result.ok === false) {
      res.status(403).json({
        success: false,
        code: result.code,
        reason: result.reason,
      });
      return;
    }
    res.json({ success: true, data: result.result });
  })
);

/**
 * GET /api/presentation-studio/source-artifacts
 *
 * Read-only, tenant-scoped enumeration of source artifacts the user can
 * attach to a Studio deck via the Setup form's source picker. Auth +
 * `presentation_create` capability + tenant context required.
 *
 * Supported query params:
 *   - limit (number, default 50, max 200) — soft cap on returned items.
 *
 * Tenant safety: `organizationId` comes from the authenticated session.
 * Body / query overrides are ignored.
 *
 * Honest degraded UI: when the underlying database query fails the route
 * STILL returns 200 with an empty `artifacts` array AND a typed warning so
 * the picker can render an honest degraded state instead of a generic 5xx.
 *
 * Response shape:
 *   - 200 `{ success: true, data: { artifacts, total, byType, generatedAt, warnings } }`
 *   - 401 / 403 from auth + RBAC + tenant guards (PERMISSION_DENIED, NO_ORG_CONTEXT).
 */
router.get(
  '/source-artifacts',
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
    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
    const result = await listPresentationStudioSourceArtifacts({
      organizationId: orgId,
      limit,
    });
    res.json({ success: true, data: result });
  })
);

// ---------------------------------------------------------------------------
// Sprint S17 — SuperAdmin layout-capacity admin surface (closes R-S13-3)
//
// Three endpoints under `/admin/layout-capacity` gated by the new
// `presentation_admin_layout_capacity` capability (SUPERADMIN-only — the
// underlying registry is process-global, R-S13-1 still open).
//
//   - GET    /admin/layout-capacity              read-only snapshot
//   - POST   /admin/layout-capacity/propose      mint single-use approval ticket
//   - POST   /admin/layout-capacity/execute      consume ticket -> apply -> audit
//
// The propose/execute pair preserves the canonical `proposal -> approval ->
// execution -> audit` invariant the rest of Studio uses for mutating
// surfaces. The ticket is single-use, tenant-bound to the SuperAdmin's
// org, user-bound to the SuperAdmin id, and payload-bound to the override
// fingerprint + reason text.
// ---------------------------------------------------------------------------

/**
 * Sanitize an unknown body into a `LayoutCapacityOverridesPayload`. We
 * intentionally trust the registry's strict validator for SHAPE
 * checks — this helper only normalizes the top-level keys so the
 * service's dry-run apply receives the canonical shape.
 */
function parseLayoutCapacityOverrides(rawBody: unknown): LayoutCapacityOverridesPayload {
  if (!rawBody || typeof rawBody !== 'object') return {};
  const body = rawBody as Record<string, unknown>;
  const payload: LayoutCapacityOverridesPayload = {};
  if (body.densityBudgets && typeof body.densityBudgets === 'object') {
    payload.densityBudgets =
      body.densityBudgets as LayoutCapacityOverridesPayload['densityBudgets'];
  }
  if (body.templateFamilyOverrides && typeof body.templateFamilyOverrides === 'object') {
    payload.templateFamilyOverrides =
      body.templateFamilyOverrides as LayoutCapacityOverridesPayload['templateFamilyOverrides'];
  }
  if (body.familyAliasByDeckType && typeof body.familyAliasByDeckType === 'object') {
    payload.familyAliasByDeckType =
      body.familyAliasByDeckType as LayoutCapacityOverridesPayload['familyAliasByDeckType'];
  }
  return payload;
}

/**
 * GET /api/presentation-studio/admin/layout-capacity
 *
 * Read-only snapshot of the live layout-capacity registry plus the
 * canonical defaults baked into the deployed code-baseline. SuperAdmin
 * surface uses both to render a "current vs default" diff.
 *
 * Tenant safety: registry is process-global, no tenant filtering
 * applies. We still emit `organizationId` from the auth context for
 * audit-trail consistency in upstream logs.
 */
router.get(
  '/admin/layout-capacity',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_admin_layout_capacity')) return;
    const orgId = getOrgId(req);
    if (!orgId) {
      res
        .status(403)
        .json({ success: false, error: 'Organization context required', code: 'NO_ORG_CONTEXT' });
      return;
    }
    res.json({
      success: true,
      data: {
        current: getCurrentRegistrySnapshot(orgId),
        defaults: getDefaultRegistrySnapshot(),
        scope: 'tenant',
        // Sprint S18 — surface degraded-load conditions so the
        // SuperAdmin sees an honest "we fell back to defaults
        // because <reason>" instead of a clean snapshot that hides
        // a corrupted persistence file.
        loadWarning: getRegistryLoadWarning(),
      },
    });
  })
);

/**
 * POST /api/presentation-studio/admin/layout-capacity/propose
 *
 * Phase A of the SuperAdmin override flow. Validates the payload via
 * the registry's strict validator (dry-run + roll-back) and mints a
 * single-use approval ticket bound to (orgId, userId, payload+reason
 * fingerprint).
 *
 * Body shape:
 *   - overrides: LayoutCapacityOverridesPayload (REQUIRED)
 *   - reason?: string (optional but strongly encouraged for audit clarity)
 *
 * Responses:
 *   - 200 `{ success: true, data: { ticket, payloadFingerprint, overrides } }`
 *   - 412 `{ success: false, code: 'INVALID_OVERRIDES_PAYLOAD', errors: [...] }`
 *     when the registry validator rejects the payload.
 */
router.post(
  '/admin/layout-capacity/propose',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_admin_layout_capacity')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res
        .status(403)
        .json({ success: false, error: 'Organization context required', code: 'NO_ORG_CONTEXT' });
      return;
    }
    if (!userId) {
      res
        .status(403)
        .json({ success: false, error: 'User context required', code: 'NO_USER_CONTEXT' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      overrides?: unknown;
      reason?: unknown;
    };
    const overrides = parseLayoutCapacityOverrides(body.overrides);
    const reason = typeof body.reason === 'string' ? body.reason : null;

    const result = proposeLayoutCapacityOverrides({
      organizationId: orgId,
      userId,
      overrides,
      reason,
    });
    if (result.ok === false) {
      res.status(412).json({
        success: false,
        code: result.code,
        reason: result.reason,
        errors: result.errors,
      });
      return;
    }
    res.json({
      success: true,
      data: {
        ticket: result.ticket,
        payloadFingerprint: result.payloadFingerprint,
        overrides: result.overrides,
      },
    });
  })
);

/**
 * POST /api/presentation-studio/admin/layout-capacity/execute
 *
 * Phase B of the SuperAdmin override flow. Atomically redeems an
 * approval ticket and applies the overrides through the registry,
 * then records `presentation_studio_layout_capacity_overrides_applied`
 * in audit_logs. On any ticket failure NO override is applied and NO
 * audit event is emitted.
 *
 * Body shape:
 *   - approvalTicket: string (REQUIRED — id from /propose)
 *   - overrides: LayoutCapacityOverridesPayload (REQUIRED — must
 *     match the payload fingerprinted at propose time)
 *   - reason?: string (must match the proposal's reason)
 *
 * Responses:
 *   - 200 `{ success: true, data: { ticketId, registrySnapshotAfter, auditEvent } }`
 *   - 403 `{ success: false, code: 'PRECONDITION_REQUIRED', error: 'Approval ticket required.' }`
 *     when ticket id missing.
 *   - 403 `{ success: false, code: 'INVALID_APPROVAL_TICKET', reason }`
 *     when ticket validation fails.
 *   - 412 `{ success: false, code: 'INVALID_OVERRIDES_PAYLOAD', errors }`
 *     when the post-redeem revalidation rejects the payload (defense
 *     in depth — the ticket is gone but no override landed).
 */
router.post(
  '/admin/layout-capacity/execute',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_admin_layout_capacity')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res
        .status(403)
        .json({ success: false, error: 'Organization context required', code: 'NO_ORG_CONTEXT' });
      return;
    }
    if (!userId) {
      res
        .status(403)
        .json({ success: false, error: 'User context required', code: 'NO_USER_CONTEXT' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      approvalTicket?: unknown;
      overrides?: unknown;
      reason?: unknown;
    };
    const ticketId = typeof body.approvalTicket === 'string' ? body.approvalTicket.trim() : '';
    if (!ticketId) {
      res.status(403).json({
        success: false,
        code: 'PRECONDITION_REQUIRED',
        error: 'Approval ticket required.',
      });
      return;
    }
    const overrides = parseLayoutCapacityOverrides(body.overrides);
    const reason = typeof body.reason === 'string' ? body.reason : null;

    const result = await executeLayoutCapacityOverrides({
      organizationId: orgId,
      userId,
      ticketId,
      overrides,
      reason,
      ipAddress: req.ip || null,
      userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    if (result.ok === false) {
      if (result.code === 'INVALID_OVERRIDES_PAYLOAD') {
        res.status(412).json({
          success: false,
          code: result.code,
          reason: result.reason,
          errors: result.errors,
        });
        return;
      }
      res.status(403).json({
        success: false,
        code: result.code,
        reason: result.reason,
      });
      return;
    }
    res.json({ success: true, data: result.result });
  })
);

// ---------------------------------------------------------------------------
// Sprint S19 — SuperAdmin reset-to-defaults action (closes R-S17-4)
//
// Two endpoints under `/admin/layout-capacity/reset` gated by the same
// `presentation_admin_layout_capacity` capability used by the override
// pair. The reset has no payload — the only operator input is a
// free-form `reason` string captured for the audit row and bound into
// the ticket fingerprint (so a different reason between propose and
// execute fails with `payload_mismatch`).
//
//   - POST /admin/layout-capacity/reset/propose   mint single-use approval ticket
//   - POST /admin/layout-capacity/reset/execute   consume ticket -> reset -> audit
//
// Persistence note: `resetToDefaults()` fires the registry's `onReset`
// hook (Sprint S18) which clears the on-disk persistence file, so the
// reset survives a server restart. A SuperAdmin who resets does NOT
// need to also clear the file by hand.
// ---------------------------------------------------------------------------

/**
 * POST /api/presentation-studio/admin/layout-capacity/reset/propose
 *
 * Phase A of the reset flow. No payload to validate — always mints a
 * ticket. The response shape mirrors the overrides /propose endpoint
 * minus the `overrides` echo (there is none).
 *
 * Body shape:
 *   - reason?: string (optional but encouraged for audit clarity)
 *
 * Responses:
 *   - 200 `{ success: true, data: { ticket, payloadFingerprint } }`
 */
router.post(
  '/admin/layout-capacity/reset/propose',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_admin_layout_capacity')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res
        .status(403)
        .json({ success: false, error: 'Organization context required', code: 'NO_ORG_CONTEXT' });
      return;
    }
    if (!userId) {
      res
        .status(403)
        .json({ success: false, error: 'User context required', code: 'NO_USER_CONTEXT' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      reason?: unknown;
    };
    const reason = typeof body.reason === 'string' ? body.reason : null;

    const result = proposeLayoutCapacityReset({
      organizationId: orgId,
      userId,
      reason,
    });
    res.json({
      success: true,
      data: {
        ticket: result.ticket,
        payloadFingerprint: result.payloadFingerprint,
      },
    });
  })
);

/**
 * POST /api/presentation-studio/admin/layout-capacity/reset/execute
 *
 * Phase B of the reset flow. Atomically redeems an approval ticket
 * and calls `resetToDefaults()` on the registry. Records
 * `presentation_studio_layout_capacity_overrides_reset` in audit_logs
 * with both pre- and post-reset snapshots. On any ticket failure NO
 * reset is performed and NO audit event is emitted.
 *
 * Body shape:
 *   - approvalTicket: string (REQUIRED — id from /reset/propose)
 *   - reason?: string (must match the proposal's reason — bound into
 *     the ticket fingerprint)
 *
 * Responses:
 *   - 200 `{ success: true, data: { ticketId, registrySnapshotBefore, registrySnapshotAfter, auditEvent } }`
 *   - 403 `{ success: false, code: 'PRECONDITION_REQUIRED', error: 'Approval ticket required.' }`
 *     when ticket id missing.
 *   - 403 `{ success: false, code: 'INVALID_APPROVAL_TICKET', reason }`
 *     when ticket validation fails.
 */
router.post(
  '/admin/layout-capacity/reset/execute',
  asyncHandler(async (req, res) => {
    if (!ensurePresentationCapability(req, res, 'presentation_admin_layout_capacity')) return;
    const orgId = getOrgId(req);
    const userId = (req as any).user?.id || (req as any).userId || null;
    if (!orgId) {
      res
        .status(403)
        .json({ success: false, error: 'Organization context required', code: 'NO_ORG_CONTEXT' });
      return;
    }
    if (!userId) {
      res
        .status(403)
        .json({ success: false, error: 'User context required', code: 'NO_USER_CONTEXT' });
      return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      approvalTicket?: unknown;
      reason?: unknown;
    };
    const ticketId = typeof body.approvalTicket === 'string' ? body.approvalTicket.trim() : '';
    if (!ticketId) {
      res.status(403).json({
        success: false,
        code: 'PRECONDITION_REQUIRED',
        error: 'Approval ticket required.',
      });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason : null;

    const result = await executeLayoutCapacityReset({
      organizationId: orgId,
      userId,
      ticketId,
      reason,
      ipAddress: req.ip || null,
      userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    if (result.ok === false) {
      res.status(403).json({
        success: false,
        code: result.code,
        reason: result.reason,
      });
      return;
    }
    res.json({ success: true, data: result.result });
  })
);

/**
 * POST /api/presentation-studio/decks/:deckId/slides/:slideIndex/regenerate
 * Per-slide AI regeneration (E3). Uses saved ContextPack snapshot for narrative slides.
 * AC: regeneration of 1 card does not touch other cards.
 */
router.post(
  '/decks/:deckId/slides/:slideIndex/regenerate',
  asyncHandler(async (req, res) => {
    const orgId = String((req as any).organizationId ?? '');
    const deckId = String(req.params.deckId ?? '');
    const slideIndex = parseInt(String(req.params.slideIndex ?? ''), 10);

    if (!deckId || isNaN(slideIndex) || slideIndex < 0) {
      res.status(400).json({ success: false, code: 'INVALID_PARAMS' });
      return;
    }

    // R4 — optional free-text per-slide rewrite directive.
    const rawInstruction = (req.body as any)?.instruction;
    const instruction =
      typeof rawInstruction === 'string' && rawInstruction.trim().length > 0
        ? rawInstruction.trim()
        : undefined;

    try {
      const result = await regenerateSlide(deckId, slideIndex, orgId, { instruction });
      res.json({ success: true, data: result });
    } catch (error) {
      // RED-J W6 bug #3 — regenerateSlide() throws a plain `Error('Deck not
      // found')` for a missing/foreign-org deck instead of a typed
      // not-found error. Map it here to 404 (same not-found shape used
      // throughout presentations.routes.ts) rather than letting it fall
      // through to asyncHandler's default 500.
      if (error instanceof Error && error.message === 'Deck not found') {
        return res
          .status(404)
          .json({ success: false, error: 'Deck not found', code: 'DECK_NOT_FOUND' });
      }
      if (error instanceof Error && error.message === 'Invalid slide index') {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid slide index', code: 'INVALID_SLIDE_INDEX' });
      }
      throw error;
    }
  })
);

export default router;
