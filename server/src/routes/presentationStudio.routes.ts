/**
 * Presentation Studio Routes (Sprint S1)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *
 * Phase 2 (post-approval) micro-sprint S1 introduces only the
 * `POST /source-pack/preview` endpoint. This endpoint is read-only,
 * tenant-scoped, gated by the existing `presentation_create` capability,
 * and never writes to the database. It reuses the orchestration service
 * which wraps `preflightPresentationSourcePack`.
 *
 * Subsequent sprints will add narrative-plan, template-architect, and
 * generate endpoints to the same router.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import {
  hasPresentationCapability,
  type PresentationCapability,
} from '../services/presentationAccessPolicyService.js';
import type { DeckSetup } from '../services/presentationGeneratorService.js';
import { previewPresentationStudioSourcePack } from '../services/presentationStudioOrchestrationService.js';

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

    const body = (
      req.body && typeof req.body === 'object' ? req.body : {}
    ) as Partial<DeckSetup> & {
      sourcePackStrict?: boolean;
    };

    const setup: DeckSetup = {
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
    };

    const result = previewPresentationStudioSourcePack({
      setup,
      organizationId: orgId,
      strict: setup.sourcePackStrict,
    });

    res.json({ success: true, data: result });
  })
);

export default router;
