/**
 * V8 Help runtime routes (recommendations, deep-linking contracts).
 * Namespace: /api/v8/help (mounted by v8/index).
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import KnowledgeBaseService from '../../services/KnowledgeBaseService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

export type HelpRecoRationaleV1 = { pl: string; en: string };

export type HelpRecoContextV1 = {
  surface_id: string;
  module_id: string;
  view_id?: string;
  artifact_type?: string;
  artifact_id?: string;
  locale: string;
};

export type HelpRecoRecommendationV1 = {
  article_id: string;
  rationale: HelpRecoRationaleV1;
};

export type HelpRecoPayloadV1 = {
  version: 'help-reco-v1';
  context: HelpRecoContextV1;
  recommendations: HelpRecoRecommendationV1[];
};

function firstParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function normalizeHelpLang(locale: string): 'pl' | 'en' {
  const raw = String(locale || '').toLowerCase();
  return raw === 'pl' || raw.startsWith('pl-') ? 'pl' : 'en';
}

function surfaceLabel(surfaceId: string): { pl: string; en: string } {
  const s = String(surfaceId || '').toLowerCase();
  if (s === 'tools' || s === 'discovery-tools') return { pl: 'Tools', en: 'Tools' };
  if (s === 'interview') return { pl: 'Interview', en: 'Interview' };
  if (s === 'results' || s === 'outputs') return { pl: 'Outputs', en: 'Outputs' };
  return { pl: surfaceId || 'Help', en: surfaceId || 'Help' };
}

function buildRationale(context: HelpRecoContextV1): HelpRecoRationaleV1 {
  const label = surfaceLabel(context.surface_id);
  const a =
    context.artifact_type && context.artifact_id
      ? ` (${context.artifact_type}: ${context.artifact_id})`
      : '';
  return {
    pl: `Jesteś w ${label.pl}${a} — ten artykuł pasuje do bieżącego kontekstu i prowadzi do następnego kroku.`,
    en: `You are in ${label.en}${a} — this article matches the current context and guides the next step.`,
  };
}

/**
 * GET /api/v8/help/recommendations
 * Contract: help-reco-v1 (context → article ids → rationale)
 */
router.get(
  '/recommendations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);

    const surface_id = firstParam(req.query.surface_id) || firstParam(req.query.surface) || 'unknown';
    const module_id = firstParam(req.query.module_id) || firstParam(req.query.module) || surface_id;
    const view_id = firstParam(req.query.view_id) || firstParam(req.query.view) || undefined;
    const artifact_type = firstParam(req.query.artifact_type) || undefined;
    const artifact_id = firstParam(req.query.artifact_id) || undefined;
    const locale = firstParam(req.query.locale) || 'en';
    const lang = normalizeHelpLang(locale);

    const context: HelpRecoContextV1 = {
      surface_id,
      module_id,
      view_id,
      artifact_type,
      artifact_id,
      locale,
    };

    const articles = await KnowledgeBaseService.getContextualArticles(module_id, lang, 5);
    const rationale = buildRationale(context);

    const recommendations: HelpRecoRecommendationV1[] = (articles || [])
      .filter((a: any) => a && typeof a.slug === 'string' && a.slug.trim())
      .slice(0, 5)
      .map((a: any) => ({
        article_id: a.slug,
        rationale,
      }));

    const payload: HelpRecoPayloadV1 = { version: 'help-reco-v1', context, recommendations };
    return res.json({ data: payload, meta: { contract: payload.version } });
  })
);

export default router;

