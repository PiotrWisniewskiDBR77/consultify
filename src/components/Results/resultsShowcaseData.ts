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

export interface ResultsShowcaseScheduleRow {
  id: string;
  reportName: string;
  scheduleCron: string;
  sendAt?: string | null;
  approvalRequired: boolean;
  approvalStatus: string;
  status: string;
  lastSentAt?: string | null;
  lastRunStatus?: string | null;
  nextRunAt?: string | null;
  kpiIds: string[];
  recipientPolicy: Record<string, unknown>;
}

export interface ResultsShowcaseWallboardRow {
  id: string;
  name: string;
  refreshIntervalSeconds: number;
  autoRotationSeconds: number;
  isActive: boolean;
  kpiIds: string[];
  alertThresholds: Record<string, unknown>;
}

export interface ResultsShowcaseConnectorRow {
  id: string;
  connectorName: string;
  connectorType: string;
  config: Record<string, unknown>;
  targetKpiIds: string[];
  scheduleCron?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  lastRunMessage?: string | null;
  nextRunAt?: string | null;
  isActive: boolean;
}

export interface ResultsShowcaseGoalRow {
  id: string;
  parentGoalId?: string | null;
  goalType: string;
  title: string;
  description?: string | null;
  ownerId?: string | null;
  timeFrame?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  progress: number;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedInitiativesCount: number;
  rollupProgress: number;
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
  // Demo data must NEVER auto-activate. It only renders when the user has
  // explicitly toggled the demo session on (shouldAllowDemoData). No
  // localhost / DEV / hostname auto-trigger.
  return shouldAllowDemoData();
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
      alertDirection: 'BELOW',
      isPrimary: true,
      sortOrder: 0,
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
      alertDirection: 'BELOW',
      isPrimary: false,
      sortOrder: 1,
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
      alertDirection: 'BELOW',
      isPrimary: false,
      sortOrder: 2,
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
      alertDirection: 'BELOW',
      isPrimary: false,
      sortOrder: 3,
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

export function createResultsShowcaseSchedules(): ResultsShowcaseScheduleRow[] {
  return [
    {
      id: 'showcase-schedule-1',
      reportName: 'Weekly rollout digest',
      scheduleCron: '0 8 * * MON',
      sendAt: '08:00',
      approvalRequired: true,
      approvalStatus: 'pending',
      status: 'active',
      lastSentAt: toIsoDate(-7),
      kpiIds: ['showcase-kpi-1', 'showcase-kpi-2'],
      recipientPolicy: { channel: 'email', audience: 'ops-review' },
    },
    {
      id: 'showcase-schedule-2',
      reportName: 'Monthly benefits scorecard',
      scheduleCron: '0 9 1 * *',
      sendAt: '09:00',
      approvalRequired: false,
      approvalStatus: 'approved',
      status: 'active',
      lastSentAt: toIsoDate(-30),
      kpiIds: ['showcase-kpi-1', 'showcase-kpi-3', 'showcase-kpi-4'],
      recipientPolicy: { channel: 'teams', audience: 'leadership' },
    },
  ];
}

export function createResultsShowcaseWallboards(): ResultsShowcaseWallboardRow[] {
  return [
    {
      id: 'showcase-wallboard-1',
      name: 'Shopfloor KPI wallboard',
      refreshIntervalSeconds: 45,
      autoRotationSeconds: 20,
      isActive: true,
      kpiIds: ['showcase-kpi-1', 'showcase-kpi-2', 'showcase-kpi-4'],
      alertThresholds: { belowTarget: true, staleEntry: true },
    },
    {
      id: 'showcase-wallboard-2',
      name: 'Benefits realization board',
      refreshIntervalSeconds: 120,
      autoRotationSeconds: 30,
      isActive: true,
      kpiIds: ['showcase-kpi-1', 'showcase-kpi-3'],
      alertThresholds: { discrepancy: true },
    },
  ];
}

export function createResultsShowcaseConnectors(): ResultsShowcaseConnectorRow[] {
  return [
    {
      id: 'showcase-connector-1',
      connectorName: 'MES production feed',
      connectorType: 'api',
      config: { source: 'MES', mode: 'batch-sync' },
      targetKpiIds: ['showcase-kpi-1', 'showcase-kpi-2'],
      scheduleCron: '*/30 * * * *',
      lastRunAt: toIsoDate(-1),
      lastRunStatus: 'success',
      isActive: true,
    },
    {
      id: 'showcase-connector-2',
      connectorName: 'Energy CSV import',
      connectorType: 'csv',
      config: { source: 'Energy report', mode: 'manual-drop' },
      targetKpiIds: ['showcase-kpi-3'],
      scheduleCron: '0 6 * * 1',
      lastRunAt: toIsoDate(-6),
      lastRunStatus: 'warning',
      isActive: true,
    },
  ];
}

export function createResultsShowcaseGoals(): ResultsShowcaseGoalRow[] {
  return [
    {
      id: 'showcase-goal-1',
      goalType: 'scorecard',
      title: 'Rollout performance scorecard',
      description: 'Operator scorecard for execution-phase KPI during rollout.',
      ownerId: 'ops-lead',
      timeFrame: 'Q2 2026',
      startDate: toDateOnly(-14),
      endDate: toDateOnly(75),
      status: 'active',
      progress: 62,
      targetValue: 100,
      currentValue: 62,
      unit: '%',
      linkedInitiativesCount: 2,
      rollupProgress: 58,
    },
    {
      id: 'showcase-goal-2',
      goalType: 'objective',
      title: 'Benefits stabilization after deployment',
      description: 'Post-implementation scorecard tracking benefits realization discipline.',
      ownerId: 'benefits-owner',
      timeFrame: 'Q3 2026',
      startDate: toDateOnly(-30),
      endDate: toDateOnly(120),
      status: 'active',
      progress: 48,
      targetValue: 95,
      currentValue: 46,
      unit: '%',
      linkedInitiativesCount: 1,
      rollupProgress: 52,
    },
    {
      id: 'showcase-goal-3',
      parentGoalId: 'showcase-goal-2',
      goalType: 'key_result',
      title: 'Keep energy intensity below target',
      description: 'Key result linked to post-implementation energy KPI.',
      ownerId: 'energy-owner',
      timeFrame: 'Monthly',
      startDate: toDateOnly(-7),
      endDate: toDateOnly(30),
      status: 'at_risk',
      progress: 41,
      targetValue: 6.2,
      currentValue: 5.9,
      unit: 'kWh',
      linkedInitiativesCount: 1,
      rollupProgress: 41,
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
