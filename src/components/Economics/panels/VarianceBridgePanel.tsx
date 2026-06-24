/**
 * M16/5.1 — Variance Bridge panel (budżet vs wykonanie).
 *
 * Konsumuje POST /api/v8/finance/value/variance-bridge (server-side
 * `varianceBridge(lines)` → plan→actual waterfall). Read-only, additive:
 * renderuje <FinanceWaterfall/> (favorable = zielony increase, unfavorable =
 * czerwony decrease) + KPI-strip (totalVariance, liczba favorable/unfavorable).
 *
 * Fail-soft (wzór M14 ExecutionIntelligencePanel): błąd ładowania degraduje do
 * cichego komunikatu, nigdy nie blokuje widoku. Pusty stan gdy brak `lines`.
 *
 * NIE wpięty nigdzie — biblioteczny panel M16 do użycia przez FinanceHub.
 */
import React, { useEffect, useState } from 'react';

import { FinanceWaterfall } from '@/components/Economics/charts';
import type { WaterfallStep } from '@/components/Economics/charts/FinanceWaterfall';
import { Api } from '@/services/api';

export interface VarianceLine {
  label: string;
  plan: number;
  actual: number;
  isCost: boolean;
}

export interface VarianceBridgeData {
  steps: WaterfallStep[];
  totalVariance: number;
}

interface Props {
  /** Linie budżetowe plan→wykonanie. Brak/empty → pusty stan. */
  lines?: VarianceLine[];
  /** allow tests / callers to inject a fetcher */
  fetcher?: (lines: VarianceLine[]) => Promise<VarianceBridgeData>;
}

/**
 * Domyślny fetcher. Serwer zwraca kopertę `{ data: result, meta }`, gdzie
 * `result = { steps, totalVariance }`. `Api.post` zwraca proxy axios-like,
 * więc rozwijamy ostrożnie obie ścieżki (`.data.data` i raw `.data`).
 */
const defaultFetcher = async (lines: VarianceLine[]): Promise<VarianceBridgeData> => {
  const resp: any = await Api.post('/api/v8/finance/value/variance-bridge', { lines });
  const inner = resp?.data?.data ?? resp?.data ?? resp;
  return {
    steps: Array.isArray(inner?.steps) ? inner.steps : [],
    totalVariance: Number(inner?.totalVariance ?? 0),
  };
};

const fmtSigned = (value: number): string => {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
};

export const VarianceBridgePanel: React.FC<Props> = ({ lines, fetcher }) => {
  const [data, setData] = useState<VarianceBridgeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const hasLines = Array.isArray(lines) && lines.length > 0;

  useEffect(() => {
    if (!hasLines) {
      setData(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await (fetcher ?? defaultFetcher)(lines as VarianceLine[]);
        if (!cancelled) {
          setData(res);
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
  }, [lines, fetcher, hasLines]);

  const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      data-testid="variance-bridge-panel"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-800"
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        Budżet vs wykonanie (variance bridge)
      </h3>
      {children}
    </div>
  );

  // Fail-soft — błąd nigdy nie blokuje widoku.
  if (failed) {
    return (
      <Frame>
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="variance-failed">
          Analiza wariancji niedostępna chwilowo — widok działa normalnie.
        </p>
      </Frame>
    );
  }

  // Pusty stan — brak linii budżetowych.
  if (!hasLines) {
    return (
      <Frame>
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="variance-empty">
          Brak danych budżetowych — dodaj pozycje plan/wykonanie.
        </p>
      </Frame>
    );
  }

  if (loading || !data) {
    return (
      <Frame>
        <p className="text-sm text-slate-400 dark:text-slate-500" data-testid="variance-busy">
          Ładowanie analizy wariancji…
        </p>
      </Frame>
    );
  }

  // KPI: favorable = increase (zielony), unfavorable = decrease (czerwony);
  // pomijamy słupki ramowe start/total.
  const lineSteps = data.steps.filter((s) => s.kind === 'increase' || s.kind === 'decrease');
  const favorable = lineSteps.filter((s) => s.kind === 'increase' && s.value > 0).length;
  const unfavorable = lineSteps.filter((s) => s.kind === 'decrease').length;

  const totalVariance = data.totalVariance;
  const totalColor =
    totalVariance > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : totalVariance < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-600 dark:text-slate-300';

  return (
    <Frame>
      {/* KPI-strip */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-100 p-2 dark:border-navy-700">
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Wariancja netto
          </p>
          <p className={`text-lg font-semibold ${totalColor}`} data-testid="variance-total">
            {fmtSigned(totalVariance)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 p-2 dark:border-navy-700">
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Korzystne
          </p>
          <p
            className="text-lg font-semibold text-emerald-600 dark:text-emerald-400"
            data-testid="variance-favorable"
          >
            {favorable}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 p-2 dark:border-navy-700">
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Niekorzystne
          </p>
          <p
            className="text-lg font-semibold text-rose-600 dark:text-rose-400"
            data-testid="variance-unfavorable"
          >
            {unfavorable}
          </p>
        </div>
      </div>

      {/* Waterfall plan→wykonanie */}
      <div data-testid="variance-waterfall">
        <FinanceWaterfall steps={data.steps} />
      </div>
    </Frame>
  );
};

export default VarianceBridgePanel;
