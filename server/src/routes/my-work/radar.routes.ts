/**
 * Radar sub-router — extracted from my-work.routes.ts
 *
 * Handles /radar, /radar/sources, /radar/profile, /radar/actions, /radar/metrics.
 * Mounted under /api/my-work by the parent aggregator.
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import { radarActionService } from '../../services/radar/radarActionService.js';
import { radarRankingService } from '../../services/radar/radarRankingService.js';
import { radarService } from '../../services/radar/radarService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

const radarProfilePatchSchema = z.object({
  trackedTopics: z.array(z.string()).optional(),
  trackedCompanies: z.array(z.string()).optional(),
  mutedTopics: z.array(z.string()).optional(),
  mutedSources: z.array(z.string()).optional(),
  preferredContentTypes: z.array(z.string()).optional(),
  strategicInterests: z.array(z.string()).optional(),
  personalizationWeights: z.record(z.string(), z.number()).optional(),
});

const radarActionSchema = z.object({
  signalId: z.string().optional(),
  actionType: z.enum([
    'view_briefing',
    'open_signal',
    'ask_ai',
    'save',
    'add_to_note',
    'create_task',
    'add_to_decision',
    'add_to_watchlist',
    'more_like_this',
    'less_like_this',
    'dismiss',
  ]),
  sourceContext: z.string().optional(),
  createdObjectType: z.string().optional(),
  createdObjectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const targetModuleNormalization = {
  Inicjatywy: 'initiatives',
  Wdrożenia: 'execution',
  Notatki: 'notebook',
} as const;

router.get(
  '/radar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (
      !(await requireTables(res, [
        'radar_sources',
        'radar_raw_items',
        'radar_processed_signals',
        'user_radar_profiles',
        'radar_ranked_signals',
        'radar_actions',
        'watchlist_items',
      ]))
    )
      return;

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const appLanguage = req.headers['x-app-language'] ?? req.headers['accept-language'];
    const langRaw = Array.isArray(appLanguage) ? appLanguage.join(',') : String(appLanguage || '');
    const isPolish = langRaw.trim().toLowerCase().startsWith('pl');

    const payload = await radarService.buildView({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
      isPolish,
    });

    return res.json(payload);
  })
);

router.get(
  '/radar/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (
      !(await requireTables(res, [
        'radar_sources',
        'radar_processed_signals',
        'user_radar_profiles',
      ]))
    )
      return;
    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const appLanguage = req.headers['x-app-language'] ?? req.headers['accept-language'];
    const langRaw = Array.isArray(appLanguage) ? appLanguage.join(',') : String(appLanguage || '');
    const isPolish = langRaw.trim().toLowerCase().startsWith('pl');
    const payload = await radarService.buildView({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
      isPolish,
    });
    return res.json({
      generatedAt: payload.generatedAt,
      radarMap: payload.radarMap || { signals: [] },
      dailyBriefing: payload.dailyBriefing,
      localization: payload.localization,
    });
  })
);

router.get(
  '/radar/sources',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!(await requireTables(res, ['radar_sources']))) return;
    const sources = await radarService.listSources();
    return res.json({ sources });
  })
);

router.get(
  '/radar/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['user_radar_profiles']))) return;

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const profile = await radarRankingService.getOrCreateProfile({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
    });

    return res.json(profile);
  })
);

router.patch(
  '/radar/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['user_radar_profiles']))) return;

    const parsed = radarProfilePatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid profile payload', details: parsed.error.flatten() });
    }

    const updated = await radarRankingService.updateProfile(identity.userId, {
      ...parsed.data,
      organizationId: identity.orgId,
    });

    return res.json({ success: true, profile: updated });
  })
);

router.post(
  '/radar/actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['radar_actions']))) return;

    const parsed = radarActionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid radar action payload', details: parsed.error.flatten() });
    }

    const orgContext = await organizationContextService.buildResolvedContext(identity.orgId);
    const result = await radarActionService.record({
      userId: identity.userId,
      orgId: identity.orgId,
      role: req.user?.role,
      industry: orgContext.profile.industry || null,
      signalId: parsed.data.signalId || null,
      actionType: parsed.data.actionType,
      sourceContext: parsed.data.sourceContext,
      createdObjectType: parsed.data.createdObjectType,
      createdObjectId: parsed.data.createdObjectId,
      payload: parsed.data.payload,
    });

    return res.json(result);
  })
);

router.get(
  '/radar/metrics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await requireTables(res, ['radar_actions', 'radar_processed_signals']))) return;

    const metrics = await radarService.getMetrics(identity.userId);
    return res.json({ metrics });
  })
);

export default router;
