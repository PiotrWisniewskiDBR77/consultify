/**
 * M14/F7 — Execution Intelligence panel (cockpit UI-binding).
 *
 * Consumes GET /api/execution-analytics/:projectId/intelligence (server-side
 * aggregation of EVM→prediction + triage). Read-only, additive: shows predicted
 * delay/overrun risk per initiative with cited reasons, plus the triage top-actions.
 * Behind the `intelligence` flag (default OFF). Fails soft: a load error degrades to
 * a quiet notice, never blocks the cockpit.
 */
import React, { useEffect, useState } from 'react';

import { Api } from '@/services/api';

export interface IntelligencePrediction {
  initiativeId: string;
  name?: string;
  overall: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons?: string[];
  spi?: number | null;
  cpi?: number | null;
  slipDays?: number;
}

export interface IntelligenceResponse {
  predictions: IntelligencePrediction[];
  triage?: { topActions?: string[] };
  summary?: { atRisk?: number; countByLevel?: Record<string, number> };
}

const LEVEL_STYLE: Record<IntelligencePrediction['overall'], string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface Props {
  projectId: string | null | undefined;
  /** allow tests / callers to inject a fetcher */
  fetcher?: (projectId: string) => Promise<IntelligenceResponse>;
}

const defaultFetcher = (projectId: string): Promise<IntelligenceResponse> =>
  Api.get(`/execution-analytics/${projectId}/intelligence`) as Promise<IntelligenceResponse>;

export const ExecutionIntelligencePanel: React.FC<Props> = ({ projectId, fetcher }) => {
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await (fetcher ?? defaultFetcher)(projectId);
        if (!cancelled) {
          setData(res);
          setFailed(false);
        }
      } catch (err) {
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
  }, [projectId, fetcher]);

  if (failed) {
    return (
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4" data-testid="intel-failed">
        <p className="text-sm text-c-text-secondary">
          Predykcja niedostępna chwilowo — kokpit działa normalnie.
        </p>
      </div>
    );
  }

  const atRisk = data?.summary?.atRisk ?? 0;
  const ORDER: Record<IntelligencePrediction['overall'], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const ranked = (data?.predictions ?? [])
    .filter((p) => p.overall !== 'LOW')
    .sort((a, b) => ORDER[a.overall] - ORDER[b.overall])
    .slice(0, 8);
  const topActions = data?.triage?.topActions ?? [];

  return (
    <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4" data-testid="intel-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">Predykcja ryzyka (EVM)</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            atRisk > 0 ? LEVEL_STYLE.HIGH : LEVEL_STYLE.LOW
          }`}
          data-testid="intel-atrisk"
        >
          {atRisk} zagrożonych
        </span>
      </div>

      {loading && <p className="text-sm text-c-text-muted">Ładowanie predykcji…</p>}

      {!loading && ranked.length === 0 && (
        <p className="text-sm text-c-text-secondary" data-testid="intel-empty">
          Brak inicjatyw o wysokim ryzyku — wszystko w normie.
        </p>
      )}

      {!loading && ranked.length > 0 && (
        <ul className="space-y-2" data-testid="intel-list">
          {ranked.map((p) => (
            <li
              key={p.initiativeId}
              className="flex items-start justify-between gap-3 rounded-lg border border-c-border-subtle p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-c-text">
                  {p.name || p.initiativeId}
                </p>
                {p.reasons && p.reasons.length > 0 && (
                  <p className="truncate text-xs text-c-text-secondary">{p.reasons[0]}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[p.overall]}`}
              >
                {p.overall}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!loading && topActions.length > 0 && (
        <div className="mt-3 border-t border-c-border-subtle pt-2" data-testid="intel-actions">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            Sugerowane działania
          </p>
          <ul className="list-inside list-disc text-xs text-c-text-secondary">
            {topActions.slice(0, 4).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExecutionIntelligencePanel;
