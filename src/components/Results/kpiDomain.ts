import type { V8ResultsTrackedInitiativeEntry } from '@/services/api/v8/results';
import type { InitiativeKPI } from '@/types/core';

export type KPIStatus = 'on-target' | 'below' | 'no-data';
export type KPITrend = 'up' | 'down' | 'stable';
export type ResultsLifecycleFilter = 'all' | 'in-realization' | 'realized';
export type ResultsObservationPhase = 'realization' | 'post-implementation' | 'both';

export type KpiWorkflowTab = 'results_initiatives' | 'results_kpi' | 'results_reports';
export type KpiDrawerSection =
  | 'summary'
  | 'deviation'
  | 'recovery'
  | 'record'
  | 'history'
  | 'definition'
  | 'targets'
  | 'lineage'
  | 'settings'
  | 'links'
  | 'danger';

export interface ResultsKPI extends InitiativeKPI {
  mappingId?: string | null;
  initiativeName?: string;
  initiativeStatus?: string | null;
  ownerName?: string;
  ownerAvatar?: string;
  baselineValue?: number | null;
  openDeviationCase?: { id: string; severity: 'AMBER' | 'RED'; status: string } | null;
  linkedInitiatives?: Array<{ id: string; name: string }>;
  linkedInitiativesCount?: number;
  definitionSource?: 'library' | 'initiative-custom';
  observationPhase?: ResultsObservationPhase;
  trackedInRealization?: boolean;
  trackedPostImplementation?: boolean;
  observationStatus?: 'active' | 'paused' | 'completed';
  realizationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
  postImplementationExpectation?: {
    baselineValue?: number | null;
    targetValue?: number | null;
    measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  };
  status: KPIStatus;
  trend: KPITrend;
  needsEntry: boolean;
}

export interface ResultsTrackedInitiative extends V8ResultsTrackedInitiativeEntry {}

export interface KpiOverviewMetrics {
  total: number;
  onTarget: number;
  below: number;
  noData: number;
  needsEntry: number;
  openDeviationCases: number;
  unresolvedActions: number;
}

export interface KpiQueueGroups {
  needsEntry: ResultsKPI[];
  belowTarget: ResultsKPI[];
  discrepancy: ResultsKPI[];
  requiresReview: ResultsKPI[];
}

/**
 * RES-004: read the backend's real band-evaluated status (evalStatus —
 * evaluateKpiPoint, the same fail-closed engine that drives deviation-case
 * detection) rather than re-deriving a status from raw latestValue/isOnTarget.
 * The old form recomputed "latest >= target" independently on the client,
 * which could (and did) disagree with the server's own AMBER/RED bands, and
 * had no way to represent UNCONFIGURED (a KPI with no/broken threshold
 * config) — it silently read as "below", never distinguishing "misconfigured"
 * from "genuinely off track", but at least never rendered as a green success.
 * evalStatus is preferred when present; the raw-field fallback only serves
 * payloads that predate this field (e.g. the deprecated legacy KPI endpoint).
 */
export function deriveStatus(kpi: InitiativeKPI): KPIStatus {
  const evalStatus = kpi.evalStatus;
  if (evalStatus) {
    if (evalStatus === 'GREEN') return 'on-target';
    if (evalStatus === 'NO_DATA') return 'no-data';
    // AMBER | RED | UNCONFIGURED — never a green success.
    return 'below';
  }
  if (kpi.latestValue == null) return 'no-data';
  return kpi.isOnTarget ? 'on-target' : 'below';
}

export function deriveTrend(kpi: InitiativeKPI): KPITrend {
  const prev = (kpi as any).prevValue;
  const latest = kpi.latestValue;
  if (latest == null || prev == null) return 'stable';

  const current = Number(latest);
  const previous = Number(prev);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'stable';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'stable';
}

export function deriveNeedsEntry(kpi: InitiativeKPI): boolean {
  const latest = kpi.latestMeasurementDate;
  if (!latest) return true;

  const latestDate = new Date(latest);
  if (Number.isNaN(latestDate.getTime())) return true;

  const now = new Date();
  const frequency = String(kpi.measurementFrequency || 'MONTHLY').toUpperCase();
  const diffDays = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

  if (frequency === 'DAILY') return diffDays > 2;
  if (frequency === 'WEEKLY') return diffDays > 8;
  if (frequency === 'MONTHLY') {
    return latestDate.getFullYear() < now.getFullYear() || latestDate.getMonth() < now.getMonth();
  }

  const quarter = (date: Date) => Math.floor(date.getMonth() / 3) + 1;
  if (latestDate.getFullYear() !== now.getFullYear()) {
    return latestDate.getFullYear() < now.getFullYear();
  }
  return quarter(latestDate) < quarter(now);
}

export function mapResultsKpis(kpisList: any[], mappingsList: any[]): ResultsKPI[] {
  const byKpi = new Map<string, Array<{ id: string; name: string }>>();

  for (const mapping of mappingsList || []) {
    const kpiId = String(mapping?.kpi_id ?? mapping?.kpiId ?? '').trim();
    const initiativeId = String(mapping?.initiative_id ?? mapping?.initiativeId ?? '').trim();
    const initiativeName = String(mapping?.initiative_name ?? mapping?.initiativeName ?? '').trim();

    if (!kpiId || !initiativeId) continue;

    const linked = byKpi.get(kpiId) || [];
    if (!linked.some((item) => item.id === initiativeId)) {
      linked.push({ id: initiativeId, name: initiativeName || initiativeId });
    }
    byKpi.set(kpiId, linked);
  }

  return (kpisList || []).map((kpi: any) => {
    const kpiId = String(kpi?.id ?? '').trim();
    const linkedInitiatives = kpiId ? byKpi.get(kpiId) || [] : [];
    const legacyInitiativeName = kpi?.initiativeName || kpi?.initiative_name || null;
    const derivedInitiativeName =
      legacyInitiativeName ||
      (linkedInitiatives.length === 1
        ? linkedInitiatives[0]?.name
        : linkedInitiatives.length > 1
          ? `${linkedInitiatives[0]?.name} +${linkedInitiatives.length - 1}`
          : null);

    return {
      ...kpi,
      mappingId: kpi?.mappingId ?? kpi?.mapping_id ?? null,
      initiativeName: derivedInitiativeName || undefined,
      initiativeStatus: kpi?.initiativeStatus ?? kpi?.initiative_status ?? null,
      linkedInitiatives,
      linkedInitiativesCount: linkedInitiatives.length,
      definitionSource:
        String(kpi?.definitionSource ?? kpi?.definition_source ?? '')
          .trim()
          .toLowerCase() === 'library'
          ? 'library'
          : 'initiative-custom',
      observationPhase:
        String(kpi?.observationPhase ?? kpi?.observation_phase ?? '')
          .trim()
          .toLowerCase() === 'realization'
          ? 'realization'
          : String(kpi?.observationPhase ?? kpi?.observation_phase ?? '')
                .trim()
                .toLowerCase() === 'both'
            ? 'both'
            : 'post-implementation',
      trackedInRealization: Boolean(
        kpi?.trackedInRealization ?? kpi?.tracked_in_realization ?? false
      ),
      trackedPostImplementation:
        kpi?.trackedPostImplementation ?? kpi?.tracked_post_implementation ?? true,
      observationStatus:
        String(kpi?.observationStatus ?? kpi?.observation_status ?? '')
          .trim()
          .toLowerCase() === 'paused'
          ? 'paused'
          : String(kpi?.observationStatus ?? kpi?.observation_status ?? '')
                .trim()
                .toLowerCase() === 'completed'
            ? 'completed'
            : 'active',
      realizationExpectation: kpi?.realizationExpectation ?? kpi?.realization_expectation,
      postImplementationExpectation:
        kpi?.postImplementationExpectation ?? kpi?.post_implementation_expectation,
      status: deriveStatus(kpi),
      trend: deriveTrend(kpi),
      needsEntry: deriveNeedsEntry(kpi),
    } as ResultsKPI;
  });
}

export function filterTrackedInitiatives(
  initiatives: ResultsTrackedInitiative[],
  lifecycleFilter: ResultsLifecycleFilter
): ResultsTrackedInitiative[] {
  if (lifecycleFilter === 'all') return initiatives;
  return initiatives.filter((initiative) => initiative.lifecycleBucket === lifecycleFilter);
}

export function filterKpisByLifecycle(
  kpis: ResultsKPI[],
  lifecycleFilter: ResultsLifecycleFilter
): ResultsKPI[] {
  if (lifecycleFilter === 'all') return kpis;
  return kpis.filter((kpi) => {
    const status = String(kpi.initiativeStatus || '')
      .trim()
      .toUpperCase();
    if (lifecycleFilter === 'in-realization') {
      return ['APPROVED', 'SCHEDULED', 'EXECUTING'].includes(status);
    }
    return ['DONE', 'TRACKING'].includes(status);
  });
}

export function filterKpisByObservationPhase(
  kpis: ResultsKPI[],
  observationPhase: 'all' | ResultsObservationPhase
): ResultsKPI[] {
  if (observationPhase === 'all') return kpis;
  return kpis.filter((kpi) => {
    const phase = kpi.observationPhase || 'post-implementation';
    return phase === observationPhase || phase === 'both';
  });
}

export function buildKpiOverviewMetrics(kpis: ResultsKPI[]): KpiOverviewMetrics {
  return kpis.reduce<KpiOverviewMetrics>(
    (acc, kpi) => {
      acc.total += 1;
      if (kpi.status === 'on-target') acc.onTarget += 1;
      if (kpi.status === 'below') acc.below += 1;
      if (kpi.status === 'no-data') acc.noData += 1;
      if (kpi.needsEntry) acc.needsEntry += 1;
      if (kpi.openDeviationCase) acc.openDeviationCases += 1;
      if (kpi.openDeviationCase && kpi.openDeviationCase.status !== 'CLOSED') {
        acc.unresolvedActions += 1;
      }
      return acc;
    },
    {
      total: 0,
      onTarget: 0,
      below: 0,
      noData: 0,
      needsEntry: 0,
      openDeviationCases: 0,
      unresolvedActions: 0,
    }
  );
}

export function buildKpiQueueGroups(kpis: ResultsKPI[]): KpiQueueGroups {
  return {
    needsEntry: kpis.filter((kpi) => kpi.needsEntry),
    belowTarget: kpis.filter((kpi) => kpi.status === 'below'),
    discrepancy: kpis.filter((kpi) => Boolean(kpi.openDeviationCase)),
    requiresReview: kpis.filter(
      (kpi) => Boolean(kpi.openDeviationCase) || kpi.status === 'below' || kpi.needsEntry
    ),
  };
}
