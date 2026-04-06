import { shouldAllowDemoData } from '@/services/api';
import type { V8ResultsDashboardSnapshot } from '@/services/api/v8/results';

import type { ResultsKPI, ResultsTrackedInitiative } from './kpiDomain';

export interface ResultsShowcaseReportRow {
  id: string;
  reportId: string;
  snapshotId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  updatedAt: string;
}

function toIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function toDateOnly(daysFromNow: number): string {
  return toIsoDate(daysFromNow).slice(0, 10);
}

export function shouldUseResultsShowcaseData(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  if (shouldAllowDemoData()) return true;

  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return import.meta.env.DEV || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function createResultsShowcaseInitiatives(): ResultsTrackedInitiative[] {
  return [
    {
      initiativeId: 'showcase-init-1',
      initiativeName: 'SMED rollout on bottleneck line',
      initiativeStatus: 'EXECUTING',
      lifecycleBucket: 'in-realization',
      trackedKpiCount: 3,
      realizationKpiCount: 2,
      postImplementationKpiCount: 1,
      belowTargetCount: 1,
      needsEntryCount: 1,
      openDeviationCount: 1,
      openReportCount: 1,
      lastReportTitle: 'Weekly rollout control pack',
      lastReportId: 'showcase-report-1',
      lastReportCreatedAt: toIsoDate(-2),
    },
    {
      initiativeId: 'showcase-init-2',
      initiativeName: 'Energy optimization standard',
      initiativeStatus: 'TRACKING',
      lifecycleBucket: 'realized',
      trackedKpiCount: 2,
      realizationKpiCount: 1,
      postImplementationKpiCount: 2,
      belowTargetCount: 0,
      needsEntryCount: 0,
      openDeviationCount: 0,
      openReportCount: 1,
      lastReportTitle: 'Post-implementation KPI review',
      lastReportId: 'showcase-report-2',
      lastReportCreatedAt: toIsoDate(-7),
    },
    {
      initiativeId: 'showcase-init-3',
      initiativeName: 'Warehouse picking flow redesign',
      initiativeStatus: 'APPROVED',
      lifecycleBucket: 'in-realization',
      trackedKpiCount: 2,
      realizationKpiCount: 2,
      postImplementationKpiCount: 1,
      belowTargetCount: 1,
      needsEntryCount: 1,
      openDeviationCount: 0,
      openReportCount: 0,
      lastReportTitle: null,
      lastReportId: null,
      lastReportCreatedAt: null,
    },
  ];
}

export function createResultsShowcaseKpis(): ResultsKPI[] {
  return [
    {
      id: 'showcase-kpi-1',
      mappingId: 'showcase-map-1',
      name: 'Setup time reduction',
      description: 'Minutes required to change over the bottleneck machine.',
      category: 'delivery',
      unit: 'min',
      targetValue: 18,
      latestValue: 24,
      prevValue: 27,
      measurementFrequency: 'WEEKLY',
      isOnTarget: false,
      createdAt: toIsoDate(-60),
      latestMeasurementDate: toIsoDate(-3),
      initiativeName: 'SMED rollout on bottleneck line',
      initiativeStatus: 'EXECUTING',
      linkedInitiatives: [{ id: 'showcase-init-1', name: 'SMED rollout on bottleneck line' }],
      linkedInitiativesCount: 1,
      definitionSource: 'library',
      observationPhase: 'realization',
      trackedInRealization: true,
      trackedPostImplementation: false,
      observationStatus: 'active',
      realizationExpectation: {
        baselineValue: 32,
        targetValue: 18,
        measurementFrequency: 'WEEKLY',
      },
      postImplementationExpectation: {
        baselineValue: 24,
        targetValue: 16,
        measurementFrequency: 'MONTHLY',
      },
      openDeviationCase: {
        id: 'showcase-dev-1',
        severity: 'AMBER',
        status: 'OPEN',
      },
      status: 'below',
      trend: 'up',
      needsEntry: false,
    } as ResultsKPI,
    {
      id: 'showcase-kpi-2',
      mappingId: 'showcase-map-2',
      name: 'First pass yield',
      description: 'Yield during rollout stabilization window.',
      category: 'quality',
      unit: '%',
      targetValue: 97,
      latestValue: null,
      prevValue: 95,
      measurementFrequency: 'DAILY',
      isOnTarget: false,
      createdAt: toIsoDate(-40),
      latestMeasurementDate: null,
      initiativeName: 'SMED rollout on bottleneck line',
      initiativeStatus: 'EXECUTING',
      linkedInitiatives: [{ id: 'showcase-init-1', name: 'SMED rollout on bottleneck line' }],
      linkedInitiativesCount: 1,
      definitionSource: 'initiative-custom',
      observationPhase: 'realization',
      trackedInRealization: true,
      trackedPostImplementation: false,
      observationStatus: 'active',
      realizationExpectation: {
        baselineValue: 94,
        targetValue: 97,
        measurementFrequency: 'DAILY',
      },
      postImplementationExpectation: {
        baselineValue: 96,
        targetValue: 98,
        measurementFrequency: 'WEEKLY',
      },
      status: 'no-data',
      trend: 'stable',
      needsEntry: true,
    } as ResultsKPI,
    {
      id: 'showcase-kpi-3',
      mappingId: 'showcase-map-3',
      name: 'kWh per unit',
      description: 'Energy intensity after standardization.',
      category: 'cost',
      unit: 'kWh',
      targetValue: 6.2,
      latestValue: 5.9,
      prevValue: 6.4,
      measurementFrequency: 'MONTHLY',
      isOnTarget: true,
      createdAt: toIsoDate(-120),
      latestMeasurementDate: toIsoDate(-12),
      initiativeName: 'Energy optimization standard',
      initiativeStatus: 'TRACKING',
      linkedInitiatives: [{ id: 'showcase-init-2', name: 'Energy optimization standard' }],
      linkedInitiativesCount: 1,
      definitionSource: 'library',
      observationPhase: 'post-implementation',
      trackedInRealization: true,
      trackedPostImplementation: true,
      observationStatus: 'active',
      realizationExpectation: {
        baselineValue: 7.1,
        targetValue: 6.5,
        measurementFrequency: 'MONTHLY',
      },
      postImplementationExpectation: {
        baselineValue: 6.4,
        targetValue: 6.2,
        measurementFrequency: 'MONTHLY',
      },
      status: 'on-target',
      trend: 'down',
      needsEntry: false,
    } as ResultsKPI,
    {
      id: 'showcase-kpi-4',
      mappingId: 'showcase-map-4',
      name: 'Picking productivity',
      description: 'Lines picked per labor hour during go-live.',
      category: 'productivity',
      unit: 'lines/h',
      targetValue: 145,
      latestValue: 132,
      prevValue: 136,
      measurementFrequency: 'WEEKLY',
      isOnTarget: false,
      createdAt: toIsoDate(-20),
      latestMeasurementDate: toIsoDate(-10),
      initiativeName: 'Warehouse picking flow redesign',
      initiativeStatus: 'APPROVED',
      linkedInitiatives: [{ id: 'showcase-init-3', name: 'Warehouse picking flow redesign' }],
      linkedInitiativesCount: 1,
      definitionSource: 'library',
      observationPhase: 'both',
      trackedInRealization: true,
      trackedPostImplementation: true,
      observationStatus: 'active',
      realizationExpectation: {
        baselineValue: 118,
        targetValue: 140,
        measurementFrequency: 'WEEKLY',
      },
      postImplementationExpectation: {
        baselineValue: 136,
        targetValue: 145,
        measurementFrequency: 'MONTHLY',
      },
      status: 'below',
      trend: 'down',
      needsEntry: true,
    } as ResultsKPI,
  ];
}

export function createResultsShowcaseReports(): ResultsShowcaseReportRow[] {
  return [
    {
      id: 'showcase-report-1',
      reportId: 'showcase-report-1',
      snapshotId: 'showcase-snapshot-1',
      title: 'Weekly rollout control pack',
      periodStart: toDateOnly(-7),
      periodEnd: toDateOnly(-1),
      status: 'IN_REVIEW',
      updatedAt: toIsoDate(-2),
    },
    {
      id: 'showcase-report-2',
      reportId: 'showcase-report-2',
      snapshotId: 'showcase-snapshot-2',
      title: 'Post-implementation KPI review',
      periodStart: toDateOnly(-30),
      periodEnd: toDateOnly(-1),
      status: 'DRAFT',
      updatedAt: toIsoDate(-7),
    },
  ];
}

export function createResultsShowcaseSnapshot(): V8ResultsDashboardSnapshot {
  return {
    organizationId: 'showcase-org',
    kpiScorecard: {
      organizationId: 'showcase-org',
      totalKpis: 4,
      byStatus: {
        'on-target': 1,
        below: 2,
        'no-data': 1,
      },
      byCategory: {
        delivery: 1,
        quality: 1,
        cost: 1,
        productivity: 1,
      },
      averageTargetAchievementRate: 0.82,
    },
    activeDeviationsCount: 1,
    roiDashboard: {
      organizationId: 'showcase-org',
      totalEntries: 3,
      totalRealized: 185000,
      projectedFromKpiTargets: 260000,
      overallRealizationRate: 0.71,
      byInitiative: [
        {
          initiativeId: 'showcase-init-1',
          entryCount: 1,
          realizedSum: 45000,
        },
        {
          initiativeId: 'showcase-init-2',
          entryCount: 2,
          realizedSum: 140000,
        },
      ],
    },
    reconciliationHealth: {
      organizationId: 'showcase-org',
      total: 3,
      byStatus: {
        unresolved: 1,
        resolved: 2,
      },
      unresolvedCount: 1,
      averageResolutionHours: 18,
    },
    recentReviewPacks: [
      {
        packId: 'showcase-pack-1',
        reviewPeriod: `${toDateOnly(-7)} / ${toDateOnly(-1)}`,
        status: 'IN_REVIEW',
        createdAt: toIsoDate(-2),
        kpiSummaryCount: 4,
        deviationHighlightCount: 1,
        roiSnapshotTotalRealized: 185000,
        roiSnapshotEntriesCount: 3,
      },
    ],
  };
}
