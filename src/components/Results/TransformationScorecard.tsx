/**
 * M15/W4 — Transformation Scorecard (executive value story).
 *
 * Consumes GET /api/results-value/:projectId/value-intelligence (banked vs
 * forecast vs at-risk, value funnel, SCALE/INTERVENE/STOP decisions). The
 * board-ready answer to "did the transformation pay off?". Behind the
 * `transformationScorecard` flag (default OFF). Read-only, fails soft.
 */
import React, { useEffect, useState } from 'react';

import { Api } from '@/services/api';

type DecisionAction = 'SCALE' | 'INTERVENE' | 'STOP' | 'HOLD';

interface FunnelRow {
  stage: string;
  count: number;
  value: number;
  riskAdjustedValue: number;
}
interface DecisionRow {
  id: string;
  name?: string | null;
  action: DecisionAction;
  rationale?: string[];
  valueAtStake?: number;
}
interface ValueIntelligence {
  scorecard: {
    banked: number;
    inFlight: number;
    atRisk: number;
    totalTarget: number;
    pctOfTarget: number;
    itemCount: number;
  };
  funnel: FunnelRow[];
  decisions: DecisionRow[];
}

const FUNNEL_LABEL: Record<string, string> = {
  ideas: 'Pomysły',
  validated: 'Zwalidowane',
  inflight: 'W realizacji',
  realized: 'Zrealizowane',
};
const FUNNEL_ORDER = ['ideas', 'validated', 'inflight', 'realized'];

const ACTION_STYLE: Record<DecisionAction, string> = {
  SCALE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  INTERVENE: 'bg-amber-100 text-amber-700 border-amber-200',
  STOP: 'bg-red-100 text-red-700 border-red-200',
  HOLD: 'bg-gray-100 text-gray-500 border-gray-200',
};
const ACTION_LABEL: Record<DecisionAction, string> = {
  SCALE: 'Skaluj',
  INTERVENE: 'Interweniuj',
  STOP: 'Zatrzymaj',
  HOLD: 'Wstrzymaj',
};

function fmt(v: number | null | undefined): string {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

interface Props {
  projectId?: string | null;
  fetcher?: (projectId: string) => Promise<unknown>;
}

const defaultFetcher = (projectId: string): Promise<unknown> =>
  Api.get(`/results-value/${projectId}/value-intelligence`);

export const TransformationScorecard: React.FC<Props> = ({ projectId, fetcher }) => {
  const [data, setData] = useState<ValueIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = projectId || 'all';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = (await (fetcher ?? defaultFetcher)(id)) as
          | { data?: ValueIntelligence }
          | ValueIntelligence;
        const payload = (res as { data?: ValueIntelligence })?.data ?? (res as ValueIntelligence);
        if (!cancelled) {
          setData(payload);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, fetcher]);

  const wrap = (children: React.ReactNode) => (
    <section
      className="rounded-xl border border-c-border-subtle bg-c-surface p-4"
      data-testid="transformation-scorecard"
    >
      {children}
    </section>
  );

  if (failed)
    return wrap(<p className="text-sm text-c-text-muted">Narracja wartości niedostępna chwilowo.</p>);
  if (loading && !data) return wrap(<p className="text-sm text-c-text-muted">Ładowanie wartości…</p>);
  if (!data || (data.scorecard?.itemCount ?? 0) === 0)
    return wrap(
      <p className="text-sm text-c-text-muted" data-testid="scorecard-empty">
        Brak danych wartości — dodaj ROI/realizację inicjatyw.
      </p>
    );

  const sc = data.scorecard;
  const funnelMax = Math.max(1, ...(data.funnel || []).map((f) => f.value));
  const orderedFunnel = FUNNEL_ORDER.map((s) => data.funnel?.find((f) => f.stage === s)).filter(
    Boolean
  ) as FunnelRow[];

  return wrap(
    <>
      <h3 className="mb-3 text-sm font-semibold text-c-text">
        Wartość transformacji
      </h3>

      <div className="grid grid-cols-3 gap-3" data-testid="scorecard-header">
        <Stat label="Zabankowane" value={fmt(sc.banked)} tone="emerald" />
        <Stat label="W realizacji" value={fmt(sc.inFlight)} tone="blue" />
        <Stat label="Zagrożone" value={fmt(sc.atRisk)} tone="red" />
      </div>
      <div className="mt-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-c-surface-raised">
          <div
            className="h-2 rounded-full bg-emerald-500"
            style={{ width: `${Math.min(100, Math.round((sc.pctOfTarget || 0) * 100))}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-c-text-muted">
          {Math.round((sc.pctOfTarget || 0) * 100)}% z celu {fmt(sc.totalTarget)}
        </p>
      </div>

      <div className="mt-4" data-testid="scorecard-funnel">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Lejek wartości
        </p>
        <div className="flex flex-col gap-1">
          {orderedFunnel.map((f) => (
            <div key={f.stage} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-c-text-muted">
                {FUNNEL_LABEL[f.stage] || f.stage}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-c-surface-raised">
                <div
                  className="h-3 rounded bg-blue-400/70"
                  style={{ width: `${Math.round((f.value / funnelMax) * 100)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[11px] text-c-text-muted">
                {fmt(f.value)} · {f.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(data.decisions || []).length > 0 && (
        <div className="mt-4" data-testid="scorecard-decisions">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            Rekomendacje
          </p>
          <ul className="flex flex-col gap-1">
            {data.decisions.slice(0, 6).map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-c-border-subtle p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ACTION_STYLE[d.action]}`}
                  >
                    {ACTION_LABEL[d.action] || d.action}
                  </span>
                  <span className="truncate text-xs text-c-text-secondary">
                    {d.name || d.id}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-c-text-muted">{fmt(d.valueAtStake)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

const Stat: React.FC<{ label: string; value: string; tone: 'emerald' | 'blue' | 'red' }> = ({
  label,
  value,
  tone,
}) => {
  const color =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'blue'
        ? 'text-blue-600'
        : 'text-red-600';
  return (
    <div className="rounded-lg border border-c-border-subtle p-2">
      <p className="text-[10px] uppercase tracking-wide text-c-text-muted">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
};

export default TransformationScorecard;
