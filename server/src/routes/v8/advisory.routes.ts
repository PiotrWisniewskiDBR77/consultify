/**
 * V8 Advisory bridge — org-scoped AI-assisted business case generation
 * ("Finanse jako doradztwo", Oxford O4 foundation).
 *
 * Wires the previously-unrouted BusinessCaseService (5-phase pipeline:
 * PLAN → CONFIRM → MODEL (deterministic NPV/IRR/payback) → REVIEW
 * (anti-fabrication) → NARRATIVE) to HTTP, as proposed in that service's
 * own docblock (server/src/services/advisory/BusinessCaseService.ts).
 *
 * Security: organizationId/userId are ALWAYS read from the authenticated
 * request context (getV8Context(req), itself derived from verifyToken +
 * requireV8OrgContext upstream in v8/index.ts) — never from the request
 * body. A client cannot generate (or leak the existence of) a business
 * case for another organization by passing a different organizationId
 * in the payload; any such field in the body is ignored.
 *
 * @module routes/v8/advisory.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import businessCaseService from '../../services/advisory/BusinessCaseService.js';
import type { SizeBand } from '../../services/financeParameterGuidance.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

const MAX_PROMPT_LENGTH = 8000;
const ALLOWED_LANGUAGES = new Set(['pl', 'en']);
const ALLOWED_SIZE_BANDS = new Set(['micro', 'small', 'mid', 'large', 'enterprise']);

/**
 * POST /api/v8/advisory/business-case
 *
 * body: {
 *   prompt: string (required, free-text description of the decision/investment),
 *   horizonYears?: number,
 *   waccPct?: number,
 *   currency?: string,
 *   language?: 'pl' | 'en',
 *   industrySegment?: string,
 *   sizeBand?: SizeBand,
 *   projectId?: string,
 * }
 * → { data: BusinessCaseGenerationResult }
 */
router.post(
  '/business-case',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!organizationId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body ?? {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: `prompt exceeds ${MAX_PROMPT_LENGTH} characters` });
    }

    const horizonYears =
      typeof body.horizonYears === 'number' && Number.isFinite(body.horizonYears)
        ? body.horizonYears
        : undefined;
    const waccPct =
      typeof body.waccPct === 'number' && Number.isFinite(body.waccPct) ? body.waccPct : undefined;
    const currency =
      typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : undefined;
    const language = ALLOWED_LANGUAGES.has(body.language)
      ? (body.language as 'pl' | 'en')
      : undefined;
    const industrySegment =
      typeof body.industrySegment === 'string' && body.industrySegment.trim()
        ? body.industrySegment.trim()
        : undefined;
    const sizeBand = ALLOWED_SIZE_BANDS.has(body.sizeBand)
      ? (body.sizeBand as SizeBand)
      : undefined;
    const projectId =
      typeof body.projectId === 'string' && body.projectId.trim()
        ? body.projectId.trim()
        : undefined;

    try {
      const result = await businessCaseService.generate({
        prompt,
        // organizationId/userId come ONLY from the verified request context above.
        userId,
        organizationId,
        projectId,
        horizonYears,
        waccPct,
        currency,
        language,
        industrySegment,
        sizeBand,
      });
      return res.status(200).json({ data: result });
    } catch (err: any) {
      logger.error('[v8/advisory] business-case generation failed', {
        organizationId,
        error: String(err?.message || err),
      });
      return res.status(502).json({ error: 'Business case generation failed' });
    }
  })
);

export default router;
