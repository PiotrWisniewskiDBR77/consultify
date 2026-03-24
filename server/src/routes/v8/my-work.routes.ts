import { Router } from 'express';
import type { Response } from 'express';

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
    maturityLevel: 'placeholder_non_canonical',
    serviceRef: '/api/my-work/home/v2',
    rationale: 'Declared in Home V2, but the current Home surface does not render this canonical block contract.',
  },
  {
    blockName: 'sparkField',
    maturityLevel: 'placeholder_non_canonical',
    serviceRef: '/api/my-work/home/v2',
    rationale: 'Ideas and notes exist in runtime, but the current Home surface does not expose the block as a canonical roof contract.',
  },
  {
    blockName: 'decisionTemperature',
    maturityLevel: 'placeholder_non_canonical',
    serviceRef: '/api/my-work/home/v2',
    rationale: 'Decision signals are aggregated in Home V2, but not surfaced as a live canonical block in the current roof.',
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
    maturityLevel: 'placeholder_non_canonical',
    serviceRef: '/api/my-work/home/v2',
    rationale: 'The block is specified canonically, but the current Home surface does not present a dedicated team-signal truth layer.',
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
        surfaceMode: 'radar_overlay_with_outputs_bridge',
        contracts: {
          homeV2Endpoint: true,
          radarEndpoint: true,
          homeViewUsesAggregatedContract: false,
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
