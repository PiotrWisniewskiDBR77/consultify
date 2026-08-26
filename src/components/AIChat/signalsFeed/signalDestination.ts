import type { SignalDTO } from './signalTypes';

type DestinationSpec = {
  route: (dto: SignalDTO) => string | null;
  label: string;
  sourceOfTruth: string;
};

export const SIGNAL_DESTINATIONS: Record<string, DestinationSpec> = {
  task_overdue: { route: () => null, label: 'task', sourceOfTruth: 'BRAK_TRASY' },
  task_due_soon_not_started: { route: () => null, label: 'task', sourceOfTruth: 'BRAK_TRASY' },
  task_blocked_stale: { route: () => null, label: 'task', sourceOfTruth: 'BRAK_TRASY' },
  initiative_no_baseline: {
    route: () => null,
    label: 'initiative',
    sourceOfTruth: 'routeConfig.ts:110 — tylko lista',
  },
  decision_pending_stale: {
    route: () => null,
    label: 'decision',
    sourceOfTruth: 'AppRoutes.tsx:1568 — tylko redirect listy',
  },
  decision_blocking_dependents: {
    route: () => null,
    label: 'decision',
    sourceOfTruth: 'AppRoutes.tsx:1568 — tylko redirect listy',
  },
  kpi_threshold_breached: {
    route: (dto) => `/results/kpi/${encodeURIComponent(dto.entityId)}`,
    label: 'KPI',
    sourceOfTruth: 'routeConfig.ts:164',
  },
  budget_overspend: { route: () => null, label: 'finance', sourceOfTruth: 'BRAK_TRASY' },
};

export type ResolvedDestination =
  | { kind: 'ROUTE'; href: string }
  | { kind: 'FORBIDDEN'; reason: string }
  | { kind: 'NO_ROUTE'; reason: string };

export function resolveDestination(dto: SignalDTO): ResolvedDestination {
  if (dto.destination.allowed === false)
    return { kind: 'FORBIDDEN', reason: 'chatSignals.destination.forbidden' };
  const href = SIGNAL_DESTINATIONS[dto.type]?.route(dto) ?? null;
  return href
    ? { kind: 'ROUTE', href }
    : { kind: 'NO_ROUTE', reason: 'chatSignals.destination.unavailable' };
}
