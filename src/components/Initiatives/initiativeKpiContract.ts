import type { InitiativeKPI } from '@/types/core';

export interface InitiativeKpiEditorRow {
  id: string;
  name: string;
  mappingId?: string | null;
  definitionSource?: 'library' | 'initiative-custom';
  category?: string;
  unit: string;
  baseline: string;
  target: string;
  current: string;
  observationPhase: 'realization' | 'post-implementation' | 'both';
  trackedInRealization: boolean;
  trackedPostImplementation: boolean;
  realizationTarget: string;
  postImplementationTarget: string;
  cadence: string;
}

export function extractInitiativeKpiRows(payload: unknown): InitiativeKPI[] {
  if (Array.isArray(payload)) {
    return payload as InitiativeKPI[];
  }
  const maybeObject = payload as { kpis?: InitiativeKPI[] } | null | undefined;
  return Array.isArray(maybeObject?.kpis) ? maybeObject.kpis : [];
}

export function toInitiativeKpiEditorRow(kpi: InitiativeKPI, idx = 0): InitiativeKpiEditorRow {
  const observationPhase =
    kpi.observationPhase ||
    (kpi.trackedInRealization
      ? kpi.trackedPostImplementation
        ? 'both'
        : 'realization'
      : 'post-implementation');

  return {
    id: String(kpi.id || `kpi-${idx}`),
    mappingId: kpi.mappingId || null,
    definitionSource: kpi.definitionSource || 'initiative-custom',
    name: String(kpi.name || ''),
    category: String(kpi.category || 'benefits'),
    unit: String(kpi.unit || ''),
    baseline: String(kpi.baselineValue ?? ''),
    target: String(kpi.targetValue ?? ''),
    current: String(kpi.latestValue ?? kpi.currentValue ?? ''),
    observationPhase,
    trackedInRealization: Boolean(kpi.trackedInRealization ?? false),
    trackedPostImplementation: kpi.trackedPostImplementation ?? true,
    realizationTarget: String(kpi.realizationExpectation?.targetValue ?? kpi.targetValue ?? ''),
    postImplementationTarget: String(
      kpi.postImplementationExpectation?.targetValue ?? kpi.targetValue ?? ''
    ),
    cadence: String(
      kpi.measurementFrequency ??
        kpi.realizationExpectation?.measurementFrequency ??
        kpi.postImplementationExpectation?.measurementFrequency ??
        'MONTHLY'
    ),
  };
}
