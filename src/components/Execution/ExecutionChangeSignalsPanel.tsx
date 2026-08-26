/**
 * M14/F4+F6 — Change Signals panel (cockpit UI-binding).
 *
 * Wires three backend-only engines into the ExecutionHub cockpit for the
 * first time:
 *   - capacitySignalService   (severity-graded overload/underutil signals + portfolio balance)
 *   - peopleChangeReadinessService (ADKAR roll-up: awareness/desire/knowledge/ability/reinforcement)
 *   - changeChampionsService  (Kotter guiding-coalition coverage vs ~15% target)
 *
 * Read-only, additive: gathers already-live cockpit data (capacity leveling
 * alerts, change-sentiment pulse, capability match, champions) and POSTs it
 * through the pure analysis engines at /api/execution-analytics and
 * /api/raid-governance. Numbers come from the engines, not placeholders —
 * an org with no data yet shows honest empty states, not fake figures.
 *
 * Behind the `changeSignals` flag (default OFF everywhere — rule #7). Fails
 * soft per section: one section erroring never blocks the other two.
 */
import type { TFunction } from 'i18next';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api, API_URL, getHeaders } from '@/services/api';

/* ------------------------------------------------------------------ */
/*  Wire types — mirror the JSON shape returned by capacitySignalService /
 *  peopleChangeReadinessService (server/src/services/*.ts). Kept local
 *  (not imported from server/) so the client bundle never pulls in
 *  server-only modules; these are structural DTOs, not the source of truth.
 */
/* ------------------------------------------------------------------ */

type PortfolioBalance = 'critical' | 'strained' | 'healthy';

interface CapacitySignal {
  id: string;
  type: 'CAPACITY_OVERLOAD' | 'CAPACITY_UNDERUTILIZED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resourceId: string;
  utilizationPct: number;
  title: string;
}

type ReadinessLevel = 'AT_RISK' | 'DEVELOPING' | 'READY' | 'UNKNOWN';

interface ReadinessResult {
  awareness: number | null;
  desire: number | null;
  knowledge: number | null;
  ability: number | null;
  reinforcement: number | null;
  overall: number | null;
  barriers: string[];
  unmeasured: string[];
  readiness: ReadinessLevel;
}

interface GovernedCapacityAlert {
  userId: string;
  name: string;
  capacityHours: number;
  allocatedHours: number;
  overloadHours: number;
  severity: 'warning' | 'critical';
  suggestion: string;
}

interface CapacitySignalsResponse {
  signals: CapacitySignal[];
  portfolio: {
    overloadedCount: number;
    underutilizedCount: number;
    worstUtilizationPct: number;
    balance: PortfolioBalance;
  };
}

interface PulseSummary {
  avgRating: number | null;
  totalResponses: number;
  trend: 'improving' | 'stable' | 'declining' | null;
}

interface CandidateGapMatch {
  matchScore: number;
}

interface ReadinessResponse {
  readiness: ReadinessResult;
  laneProblem: { problemType: string; severity: string; title: string } | null;
}

interface ChangeChampion {
  id: string;
  role: string;
  status: string;
}

interface ChampionsCoverageResponse {
  championCount: number;
  affectedPopulation: number;
  coveragePct: number;
  adequate: boolean;
}

export interface ChangeSignalsFetchers {
  capacityAlerts?: () => Promise<GovernedCapacityAlert[]>;
  capacitySignals?: (body: {
    allocations: Array<{
      resourceId: string;
      initiativeId: string;
      allocatedFte: number;
      periodStart: string;
      periodEnd: string;
    }>;
    capacities: Array<{ resourceId: string; availableFte: number }>;
  }) => Promise<CapacitySignalsResponse>;
  pulseSummary?: () => Promise<PulseSummary | null>;
  capabilityMatch?: () => Promise<CandidateGapMatch[]>;
  readinessAnalyze?: (body: Record<string, unknown>) => Promise<ReadinessResponse>;
  champions?: () => Promise<ChangeChampion[]>;
  championsCoverage?: () => Promise<ChampionsCoverageResponse>;
}

interface Props {
  /** allow tests / callers to inject fetchers; defaults hit the real live endpoints */
  fetchers?: ChangeSignalsFetchers;
}

/**
 * `Api.get`'s axios-style proxy special-cases `.data` to alias the whole
 * payload — correct for flat resources, but it shadows a *real* `data` field
 * on envelope-shaped responses (`{ data: X }`, used by change-sentiment and
 * capabilities routes). For those two, fetch raw and unwrap `.data` directly,
 * mirroring the proven pattern in PeopleChangeWorkspace.tsx.
 */
async function fetchEnvelope<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { headers: getHeaders() });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data ?? null) as T | null;
}

const defaultFetchers: Required<ChangeSignalsFetchers> = {
  capacityAlerts: () => Api.get('/execution-control/capacity/leveling-alerts'),
  capacitySignals: (body) => Api.post('/execution-analytics/capacity/signals', body),
  pulseSummary: () => fetchEnvelope<PulseSummary>('/change-sentiment/pulse/summary'),
  capabilityMatch: async () =>
    (await fetchEnvelope<CandidateGapMatch[]>('/capabilities/match')) ?? [],
  readinessAnalyze: (body) => Api.post('/execution-analytics/readiness/analyze', body),
  champions: async () => {
    const res = await Api.get('/raid-governance/champions');
    return (res?.champions ?? []) as ChangeChampion[];
  },
  championsCoverage: () => Api.get('/raid-governance/champions/coverage'),
};

const BALANCE_STYLE: Record<PortfolioBalance, string> = {
  critical: 'bg-danger-100 text-danger-700 border-danger-200',
  strained: 'bg-warning-100 text-warning-700 border-warning-200',
  healthy: 'bg-success-100 text-success-700 border-success-200',
};

const READINESS_STYLE: Record<ReadinessLevel, string> = {
  AT_RISK: 'bg-danger-100 text-danger-700 border-danger-200',
  DEVELOPING: 'bg-warning-100 text-warning-700 border-warning-200',
  READY: 'bg-success-100 text-success-700 border-success-200',
  UNKNOWN: 'bg-c-surface-raised text-c-text-muted border-c-border-subtle',
};

const ADKAR_DIMENSIONS: Array<{ key: keyof ReadinessResult; label: string }> = [
  { key: 'awareness', label: 'Świadomość' },
  { key: 'desire', label: 'Chęć' },
  { key: 'knowledge', label: 'Wiedza' },
  { key: 'ability', label: 'Umiejętności' },
  { key: 'reinforcement', label: 'Utrwalenie' },
];

// The backend (peopleChangeReadinessService.ts) returns `barriers` as the
// English ADKAR dimension label ('Awareness', 'Desire', ...) — same source
// keys as ADKAR_DIMENSIONS above, just capitalized. Kept as a lookup instead
// of re-keying the service response, so this is purely a display concern.
const BARRIER_I18N_KEY: Record<string, string> = {
  Awareness: 'awareness',
  Desire: 'desire',
  Knowledge: 'knowledge',
  Ability: 'ability',
  Reinforcement: 'reinforcement',
};

const READINESS_LEVEL_I18N_KEY: Record<ReadinessLevel, string> = {
  AT_RISK: 'atRisk',
  DEVELOPING: 'developing',
  READY: 'ready',
  UNKNOWN: 'unknown',
};

/**
 * Builds the lane-problem sentence entirely on the client instead of using
 * `laneProblem.title` from `peopleChangeReadinessService.ts` verbatim — the
 * backend builds that title in hardcoded English ("Adoption barriers
 * detected (Awareness)"), which showed up untranslated on an otherwise
 * Polish screen (night sweep B, FIX-2026). The structured fields it's built
 * from (`readiness.readiness` and `readiness.barriers`) are already
 * available client-side, so this reconstructs the same two variants the
 * service generates, fully localized.
 */
function laneProblemText(t: TFunction, readiness: ReadinessResult): string {
  const barrierLabels = readiness.barriers.map((b) =>
    t(`execution.changeSignals.barrier.${BARRIER_I18N_KEY[b] || b.toLowerCase()}`, b)
  );
  const detail = barrierLabels.length > 0 ? ` (${barrierLabels.join(', ')})` : '';
  const variant = readiness.readiness === 'AT_RISK' ? 'atRisk' : 'developing';
  const englishDefault =
    variant === 'atRisk'
      ? 'People-change adoption at risk{{detail}}'
      : 'Adoption barriers detected{{detail}}';
  return t(`execution.changeSignals.laneProblem.${variant}`, { defaultValue: englishDefault, detail });
}

export const ExecutionChangeSignalsPanel: React.FC<Props> = ({ fetchers }) => {
  const { t } = useTranslation();
  const f = { ...defaultFetchers, ...fetchers };

  const [capacity, setCapacity] = useState<CapacitySignalsResponse | null>(null);
  const [capacityFailed, setCapacityFailed] = useState(false);
  const [capacityLoading, setCapacityLoading] = useState(false);

  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessFailed, setReadinessFailed] = useState(false);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const [champions, setChampions] = useState<ChangeChampion[]>([]);
  const [coverage, setCoverage] = useState<ChampionsCoverageResponse | null>(null);
  const [championsFailed, setChampionsFailed] = useState(false);
  const [championsLoading, setChampionsLoading] = useState(false);

  // ---- Capacity signals: real alerts → engine ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCapacityLoading(true);
      try {
        const alerts = await f.capacityAlerts();
        const now = new Date().toISOString().slice(0, 10);
        const allocations = alerts.map((a) => ({
          resourceId: a.userId,
          initiativeId: 'portfolio',
          allocatedFte: a.allocatedHours,
          periodStart: now,
          periodEnd: now,
        }));
        const capacities = alerts.map((a) => ({
          resourceId: a.userId,
          availableFte: a.capacityHours,
        }));
        const result = await f.capacitySignals({ allocations, capacities });
        if (!cancelled) {
          setCapacity(result);
          setCapacityFailed(false);
        }
      } catch {
        if (!cancelled) setCapacityFailed(true);
      } finally {
        if (!cancelled) setCapacityLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Readiness: real sentiment pulse + capability gap → ADKAR engine ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setReadinessLoading(true);
      try {
        const [pulse, candidates] = await Promise.all([f.pulseSummary(), f.capabilityMatch()]);
        const inputs: Record<string, unknown> = {};
        if (pulse?.avgRating != null) inputs.sentimentAvg = pulse.avgRating / 5;
        if (pulse?.trend) inputs.sentimentTrend = pulse.trend;
        if (Array.isArray(candidates) && candidates.length > 0) {
          const avgMatch =
            candidates.reduce((sum, c) => sum + (c.matchScore ?? 0), 0) / candidates.length;
          inputs.capabilityGapPct = Math.max(0, Math.min(100, 100 - avgMatch));
        }
        const result = await f.readinessAnalyze(inputs);
        if (!cancelled) {
          setReadiness(result);
          setReadinessFailed(false);
        }
      } catch {
        if (!cancelled) setReadinessFailed(true);
      } finally {
        if (!cancelled) setReadinessLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Champions coalition ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setChampionsLoading(true);
      try {
        const [list, cov] = await Promise.all([f.champions(), f.championsCoverage()]);
        if (!cancelled) {
          setChampions(list);
          setCoverage(cov);
          setChampionsFailed(false);
        }
      } catch {
        if (!cancelled) setChampionsFailed(true);
      } finally {
        if (!cancelled) setChampionsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topSignals = (capacity?.signals ?? [])
    .slice()
    .sort((a, b) => b.utilizationPct - a.utilizationPct)
    .slice(0, 6);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="change-signals-panel">
      {/* Capacity signals */}
      <div
        className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
        data-testid="capacity-signals-card"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {t('execution.changeSignals.capacity', 'Sygnały wydolności zespołu')}
          </h3>
          {capacity?.portfolio && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BALANCE_STYLE[capacity.portfolio.balance]}`}
              data-testid="capacity-balance"
            >
              {t(
                `execution.changeSignals.balance.${capacity.portfolio.balance}`,
                capacity.portfolio.balance
              )}
            </span>
          )}
        </div>
        {capacityLoading && (
          <p className="text-sm text-c-text-muted">
            {t('execution.changeSignals.loading', 'Ładowanie…')}
          </p>
        )}
        {!capacityLoading && capacityFailed && (
          <p className="text-sm text-c-text-muted" data-testid="capacity-failed">
            {t(
              'execution.changeSignals.capacityFailed',
              'Sygnały wydolności niedostępne chwilowo — kokpit działa normalnie.'
            )}
          </p>
        )}
        {!capacityLoading && !capacityFailed && topSignals.length === 0 && (
          <p className="text-sm text-c-text-muted" data-testid="capacity-empty">
            {t('execution.changeSignals.capacityEmpty', 'Brak przeciążeń — obłożenie w normie.')}
          </p>
        )}
        {!capacityLoading && !capacityFailed && topSignals.length > 0 && (
          <ul className="space-y-1.5" data-testid="capacity-signals-list">
            {topSignals.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-c-text-secondary">{s.title}</span>
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 font-medium ${
                    s.severity === 'CRITICAL' || s.severity === 'HIGH'
                      ? BALANCE_STYLE.critical
                      : s.severity === 'MEDIUM'
                        ? BALANCE_STYLE.strained
                        : BALANCE_STYLE.healthy
                  }`}
                >
                  {t(
                    `execution.changeSignals.severity.${s.severity.toLowerCase()}`,
                    s.severity
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* People-change readiness (ADKAR) */}
      <div
        className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
        data-testid="readiness-card"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {t('execution.changeSignals.readiness', 'Gotowość ludzi na zmianę')}
          </h3>
          {readiness?.readiness && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${READINESS_STYLE[readiness.readiness.readiness]}`}
              data-testid="readiness-level"
            >
              {t(
                `execution.changeSignals.readinessLevel.${READINESS_LEVEL_I18N_KEY[readiness.readiness.readiness]}`,
                readiness.readiness.readiness
              )}
            </span>
          )}
        </div>
        {readinessLoading && (
          <p className="text-sm text-c-text-muted">
            {t('execution.changeSignals.loading', 'Ładowanie…')}
          </p>
        )}
        {!readinessLoading && readinessFailed && (
          <p className="text-sm text-c-text-muted" data-testid="readiness-failed">
            {t(
              'execution.changeSignals.readinessFailed',
              'Gotowość na zmianę niedostępna chwilowo — kokpit działa normalnie.'
            )}
          </p>
        )}
        {!readinessLoading && !readinessFailed && readiness?.readiness.overall == null && (
          <p className="text-sm text-c-text-muted" data-testid="readiness-empty">
            {t(
              'execution.changeSignals.readinessEmpty',
              'Brak jeszcze sygnałów adopcji (pulse/capability) do oceny.'
            )}
          </p>
        )}
        {!readinessLoading && !readinessFailed && readiness?.readiness.overall != null && (
          <div className="space-y-1.5" data-testid="readiness-dims">
            {ADKAR_DIMENSIONS.map((d) => {
              const score = readiness.readiness[d.key] as number | null;
              return (
                <div key={String(d.key)} className="flex items-center justify-between text-xs">
                  <span className="text-c-text-secondary">{d.label}</span>
                  <span className={score == null ? 'text-c-text-muted' : 'font-medium text-c-text'}>
                    {score == null ? '–' : `${score}/5`}
                  </span>
                </div>
              );
            })}
            <div className="mt-2 border-t border-c-border-subtle pt-2 text-xs font-semibold text-c-text">
              {t('execution.changeSignals.overall', 'Ogółem')}: {readiness.readiness.overall}/5
            </div>
            {readiness.laneProblem && (
              <p className="mt-1 text-xs text-warning-600" data-testid="readiness-lane-problem">
                {laneProblemText(t, readiness.readiness)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Change champions coalition */}
      <div
        className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
        data-testid="champions-card"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {t('execution.changeSignals.champions', 'Koalicja championów zmiany')}
          </h3>
          {coverage && (
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                coverage.adequate ? BALANCE_STYLE.healthy : BALANCE_STYLE.strained
              }`}
              data-testid="champions-coverage"
            >
              {coverage.coveragePct}%
            </span>
          )}
        </div>
        {championsLoading && (
          <p className="text-sm text-c-text-muted">
            {t('execution.changeSignals.loading', 'Ładowanie…')}
          </p>
        )}
        {!championsLoading && championsFailed && (
          <p className="text-sm text-c-text-muted" data-testid="champions-failed">
            {t(
              'execution.changeSignals.championsFailed',
              'Koalicja championów niedostępna chwilowo — kokpit działa normalnie.'
            )}
          </p>
        )}
        {!championsLoading && !championsFailed && champions.length === 0 && (
          <p className="text-sm text-c-text-muted" data-testid="champions-empty">
            {t(
              'execution.changeSignals.championsEmpty',
              'Brak jeszcze zgłoszonych championów zmiany.'
            )}
          </p>
        )}
        {!championsLoading && !championsFailed && champions.length > 0 && (
          <>
            <p className="mb-2 text-xs text-c-text-muted">
              {coverage?.championCount ?? champions.length} / {coverage?.affectedPopulation ?? '–'}{' '}
              {t('execution.changeSignals.affected', 'osób objętych zmianą')}
            </p>
            <ul className="space-y-1.5" data-testid="champions-list">
              {champions.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-c-text-secondary">
                    {t(`execution.changeSignals.championRole.${c.role.toLowerCase()}`, c.role)}
                  </span>
                  <span className="text-c-text-muted">
                    {t(
                      `execution.changeSignals.championStatus.${c.status.toLowerCase()}`,
                      c.status
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default ExecutionChangeSignalsPanel;
