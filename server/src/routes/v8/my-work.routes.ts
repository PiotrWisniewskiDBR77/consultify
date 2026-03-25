import { Router } from 'express';
import type { Response } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as myWorkRoofService from '../../services/v8/myWorkRoofService.js';
import type {
  CalendarPhaseName,
  CalendarPhaseStatus,
  HomeBlockName,
  MaturityLevel,
} from '../../types/myWorkRoofPackage.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

function handleMyWorkRoofError(err: unknown, res: Response, fallbackMessage: string): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
    return res.status(404).json({
      error: err.message,
      code: 'RESOURCE_NOT_FOUND',
    });
  }

  return null;
}

type DerivedHomeBlockTruth = {
  blockName: HomeBlockName;
  maturityLevel: MaturityLevel;
  serviceRef: string | null;
  rationale: string;
};

type DerivedCalendarPhaseTruth = {
  phaseName: CalendarPhaseName;
  status: CalendarPhaseStatus;
  blockedBy: string | null;
  rationale: string;
};

const DERIVED_HOME_BLOCKS: DerivedHomeBlockTruth[] = [
  {
    blockName: 'aiPulseCore',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'radarService',
    rationale: 'Hero briefing is live and backed by governed Radar runtime.',
  },
  {
    blockName: 'momentum',
    maturityLevel: 'partial_stitched',
    serviceRef: 'GET /api/my-work/home/v2 · tasks, decisions, ideas',
    rationale:
      'Momentum narrative and stats are stitched in the home/v2 handler from live tasks, decisions, and ideas queries — canonical on the aggregated Home V2 surface, thinner than a dedicated Radar-class domain service.',
  },
  {
    blockName: 'sparkField',
    maturityLevel: 'partial_stitched',
    serviceRef: 'GET /api/my-work/home/v2 · ideas, notebook_pages, org ideas',
    rationale:
      'Spark Field payloads are assembled from home/v2 reads of user ideas, notebook pages, and org-wide ideas; real aggregated contract, not a standalone spark microservice.',
  },
  {
    blockName: 'decisionTemperature',
    maturityLevel: 'partial_stitched',
    serviceRef: 'GET /api/my-work/home/v2 · decisions, overdue tasks',
    rationale:
      'Heat and pending-decision framing come from live decisions rows plus overdue-task pressure in home/v2; deeper execution-signal closure remains a separate WP-W7 gap.',
  },
  {
    blockName: 'industryLens',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'radarService',
    rationale: 'External transformation signals are live through Radar-backed Home sections.',
  },
  {
    blockName: 'executionCurrent',
    maturityLevel: 'partial_stitched',
    serviceRef: '/api/my-work/home/v2 + artifactRegistryService',
    rationale: 'Execution context is partially present through aggregated Home V2 data and outputs bridge, but not as the frozen canonical block.',
  },
  {
    blockName: 'teamSignal',
    maturityLevel: 'partial_stitched',
    serviceRef: 'GET /api/my-work/home/v2 · organizationContextService, organization_events',
    rationale:
      'Team alignment copy stitches organizationContext priorities, decision backlog, peer tips from organization_events, and narrative scaffolding in home/v2; multiplayer/collaboration event wiring called out in WP-W7 remains thin.',
  },
  {
    blockName: 'commandDock',
    maturityLevel: 'partial_stitched',
    serviceRef: 'HomeView actions + outputs bridge',
    rationale: 'Home exposes real jump actions and governed outputs entry points, but not yet as the frozen command-dock block contract.',
  },
];

const DERIVED_CALENDAR_PHASES: DerivedCalendarPhaseTruth[] = [
  {
    phaseName: 'phase_a_internal',
    status: 'active',
    blockedBy: null,
    rationale: 'Internal MyWork calendar hardening can proceed independently of connector delivery.',
  },
  {
    phaseName: 'phase_b_external_sync',
    status: 'blocked',
    blockedBy: 'wave5_connector_platform',
    rationale: 'External Google/Outlook sync remains blocked on Wave 5 connector delivery.',
  },
];

function buildSummaryCounts(
  blocks: Array<{ maturityLevel: MaturityLevel }>,
): Record<MaturityLevel, number> {
  return blocks.reduce<Record<MaturityLevel, number>>(
    (acc, block) => {
      acc[block.maturityLevel] += 1;
      return acc;
    },
    {
      backed_by_real_service: 0,
      partial_stitched: 0,
      placeholder_non_canonical: 0,
    },
  );
}

router.put(
  '/objects/:objectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.setCanonicalObjectState({
        ...req.body,
        objectId: req.params.objectId,
        organizationId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid canonical object state parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/objects/:objectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getCanonicalObjectState(req.params.objectId, organizationId);

    if (!data) {
      return res.status(404).json({
        error: `Canonical object ${req.params.objectId} not found`,
        code: 'OBJECT_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.put(
  '/objects/:objectId/projections/:surface',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.updateSurfaceProjection({
        ...req.body,
        objectId: req.params.objectId,
        organizationId,
        surface: req.params.surface as any,
      });

      if (!data) {
        return res.status(404).json({
          error: `Canonical object ${req.params.objectId} not found`,
          code: 'OBJECT_NOT_FOUND',
        });
      }

      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid surface projection parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/objects/:objectId/projections/:surface',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getSurfaceProjection(
      req.params.objectId,
      req.params.surface as any,
      organizationId,
    );

    if (!data) {
      return res.status(404).json({
        error: `Projection ${req.params.surface} for object ${req.params.objectId} not found`,
        code: 'PROJECTION_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.post(
  '/inbox/materializations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.recordInboxMaterialization({
        ...req.body,
        organizationId,
        userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid inbox materialization parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/inbox/materializations/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const data = await myWorkRoofService.getInboxMaterializationStats(userId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.put(
  '/calendar/phases/:phaseName',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.setCalendarPhase({
        ...req.body,
        phaseName: req.params.phaseName as any,
        organizationId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid calendar phase parameters');
      if (handled) return handled;
      throw err;
    }
  }),
);

router.get(
  '/calendar/phases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getCalendarPhases(organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  }),
);

router.get(
  '/roof/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const generatedAt = new Date().toISOString();

    const [storedBlocks, inboxStats, storedCalendarPhases] = await Promise.all([
      myWorkRoofService.getHomeBlockMaturity(organizationId).catch(() => []),
      myWorkRoofService.getInboxMaterializationStats(userId, organizationId).catch(() => ({
        avgLatencyMs: 0,
        latencyBandDistribution: {
          near_realtime: 0,
          operational: 0,
          degraded: 0,
        },
      })),
      myWorkRoofService.getCalendarPhases(organizationId).catch(() => []),
    ]);

    const blockMap = new Map(storedBlocks.map((block) => [block.blockName, block]));
    const calendarMap = new Map(storedCalendarPhases.map((phase) => [phase.phaseName, phase]));

    const homeBlocks = DERIVED_HOME_BLOCKS.map((block) => {
      const stored = blockMap.get(block.blockName);
      return {
        blockName: block.blockName,
        maturityLevel: stored?.maturityLevel ?? block.maturityLevel,
        serviceRef: stored?.serviceRef ?? block.serviceRef,
        lastAuditedAt: stored?.lastAuditedAt ?? generatedAt,
        source: stored ? ('persisted' as const) : ('derived' as const),
        rationale: block.rationale,
      };
    });

    const calendar = DERIVED_CALENDAR_PHASES.map((phase) => {
      const stored = calendarMap.get(phase.phaseName);
      return {
        phaseName: phase.phaseName,
        status: stored?.status ?? phase.status,
        blockedBy: stored?.blockedBy ?? phase.blockedBy,
        source: stored ? ('persisted' as const) : ('derived' as const),
        rationale: phase.rationale,
      };
    });

    const counts = buildSummaryCounts(homeBlocks);
    const overallStatus =
      counts.placeholder_non_canonical > 0
        ? 'mixed_truth'
        : counts.partial_stitched > 0
          ? 'partially_coherent'
          : 'coherent';

    return res.json({
      data: {
        generatedAt,
        overallStatus,
        surfaceMode: 'home_v2_aggregated_with_outputs_bridge',
        contracts: {
          homeV2Endpoint: true,
          radarEndpoint: true,
          homeViewUsesAggregatedContract: true,
          outputsBridgeVisible: true,
        },
        homeBlocks,
        counts,
        inboxMaterialization: {
          ...inboxStats,
          status:
            inboxStats.avgLatencyMs > 0 ||
            Object.values(inboxStats.latencyBandDistribution).some((count) => count > 0)
              ? 'observed'
              : 'not_proven_yet',
        },
        calendar,
      },
      meta: { version: 'v8' },
    });
  }),
);

export default router;
