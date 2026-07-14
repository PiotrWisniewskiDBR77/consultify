/**
 * M16 — Value Office panel (flagowy „motor wartości transformacji").
 *
 * Spina dwa kanoniczne prymitywy wartości M16 w jeden kokpit:
 *  - Most wartości (Baseline→Realized→Banked) → FinanceWaterfall, z
 *    POST /api/v8/finance/value/value-bridge.
 *  - Portfel decyzyjny (NPV × ryzyko) → PortfolioBubble, z
 *    POST /api/v8/finance/value/portfolio/prioritize (x=risk, y=npv, size=effort).
 *
 * Wzorzec fail-soft / Api / data-testid wg ExecutionIntelligencePanel:
 *  - initiatives podawane z kokpitu; gdy brak → przykład (żeby panel nigdy nie był pusty).
 *  - busy-state na czas fetchu; błąd degraduje do cichej notki, NIE blokuje kokpitu.
 *  - fetchery wstrzykiwalne (testy / odmienni wywołujący).
 *
 * NIE wpięty nigdzie — buduje się i testuje niezależnie.
 */
import React, { useEffect, useMemo, useState } from 'react';

import { FinanceWaterfall, PortfolioBubble } from '@/components/Economics/charts';
import { Api } from '@/services/api';

// --- Wejście: inicjatywy z kokpitu --------------------------------------

export interface ValueOfficeInitiative {
  id: string;
  name?: string;
  /** Wartość (np. zidentyfikowana korzyść) — używane w value-bridge. */
  value?: number;
  /** Etap cyklu wartości — używane w value-bridge. */
  stage?: string;
  /** Net Present Value — używane w portfelu decyzyjnym. */
  npv?: number;
  /** Ryzyko 0..1 — używane w portfelu decyzyjnym. */
  risk?: number;
  /** Nakład — używane w portfelu decyzyjnym (rozmiar bąbla). */
  effort?: number;
}

// --- Kształty odpowiedzi serwera ----------------------------------------

type WaterfallStepKind = 'start' | 'increase' | 'decrease' | 'total';

interface ValueBridgeStep {
  label: string;
  value: number;
  kind: WaterfallStepKind;
}

export interface ValueBridgeResponse {
  data: {
    steps: ValueBridgeStep[];
    totalRealized: number;
    totalIdentified: number;
  };
}

type Quadrant = 'fund' | 'evaluate' | 'quick_win' | 'defer';

interface PrioritizedInitiative {
  id: string;
  name?: string;
  npv: number;
  risk: number;
  effort: number;
  quadrant: Quadrant;
  rank?: number;
}

export interface PortfolioResponse {
  data: PrioritizedInitiative[];
}

// --- Mapowanie kwadrant → kolor bąbla (kanon §1) ------------------------

const QUADRANT_COLOR: Record<Quadrant, string> = {
  fund: '#16a34a', // zielony — inwestuj
  evaluate: '#f59e0b', // bursztyn — oceń
  quick_win: '#2563eb', // niebieski — szybka wygrana
  defer: '#6b7280', // szary — odłóż
};

// --- Fail-soft / busy state ---------------------------------------------

interface Props {
  /** Inicjatywy z kokpitu. Gdy puste/brak → użyty przykład. */
  initiatives?: ValueOfficeInitiative[];
  /** Wstrzykiwalne fetchery (testy / odmienni wywołujący). */
  valueBridgeFetcher?: (initiatives: ValueOfficeInitiative[]) => Promise<ValueBridgeResponse>;
  portfolioFetcher?: (initiatives: ValueOfficeInitiative[]) => Promise<PortfolioResponse>;
}

const defaultValueBridgeFetcher = async (
  initiatives: ValueOfficeInitiative[]
): Promise<ValueBridgeResponse> => {
  const res = await Api.post('/api/v8/finance/value/value-bridge', {
    initiatives: initiatives.map((i) => ({
      id: i.id,
      name: i.name,
      value: i.value ?? 0,
      stage: i.stage ?? 'identified',
    })),
  });
  return (res?.data ?? res) as ValueBridgeResponse;
};

const defaultPortfolioFetcher = async (
  initiatives: ValueOfficeInitiative[]
): Promise<PortfolioResponse> => {
  const res = await Api.post('/api/v8/finance/value/portfolio/prioritize', {
    initiatives: initiatives.map((i) => ({
      id: i.id,
      name: i.name,
      npv: i.npv ?? 0,
      risk: i.risk ?? 0,
      effort: i.effort ?? 0,
    })),
  });
  return (res?.data ?? res) as PortfolioResponse;
};

// Przykładowe inicjatywy — panel nigdy nie jest pusty (gdy kokpit nic nie poda).
const SAMPLE_INITIATIVES: ValueOfficeInitiative[] = [
  {
    id: 'demo-1',
    name: 'Automatyzacja zakupów',
    value: 1_200_000,
    stage: 'realized',
    npv: 900_000,
    risk: 0.2,
    effort: 3,
  },
  {
    id: 'demo-2',
    name: 'Konsolidacja systemów',
    value: 800_000,
    stage: 'in_flight',
    npv: 600_000,
    risk: 0.5,
    effort: 6,
  },
  {
    id: 'demo-3',
    name: 'Optymalizacja energii',
    value: 450_000,
    stage: 'committed',
    npv: 300_000,
    risk: 0.35,
    effort: 2,
  },
  {
    id: 'demo-4',
    name: 'Nowy kanał sprzedaży',
    value: 600_000,
    stage: 'identified',
    npv: 200_000,
    risk: 0.7,
    effort: 8,
  },
];

// --- Formatowanie KPI (skala k/M) ---------------------------------------

const fmtMoney = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${abs.toFixed(0)}`;
};

export const ValueOfficePanel: React.FC<Props> = ({
  initiatives,
  valueBridgeFetcher,
  portfolioFetcher,
}) => {
  const effectiveInitiatives = useMemo(
    () => (initiatives && initiatives.length > 0 ? initiatives : SAMPLE_INITIATIVES),
    [initiatives]
  );

  const [bridge, setBridge] = useState<ValueBridgeResponse['data'] | null>(null);
  const [portfolio, setPortfolio] = useState<PrioritizedInitiative[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [bridgeRes, portfolioRes] = await Promise.all([
          (valueBridgeFetcher ?? defaultValueBridgeFetcher)(effectiveInitiatives),
          (portfolioFetcher ?? defaultPortfolioFetcher)(effectiveInitiatives),
        ]);
        if (!cancelled) {
          setBridge(bridgeRes?.data ?? null);
          setPortfolio(Array.isArray(portfolioRes?.data) ? portfolioRes.data : []);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setBridge(null);
          setPortfolio(null);
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
  }, [effectiveInitiatives, valueBridgeFetcher, portfolioFetcher]);

  const bubbleData = useMemo(
    () =>
      (portfolio ?? []).map((p) => ({
        id: p.id,
        x: p.risk,
        y: p.npv,
        size: p.effort,
        color: QUADRANT_COLOR[p.quadrant] ?? QUADRANT_COLOR.defer,
        label: p.name ?? p.id,
      })),
    [portfolio]
  );

  if (failed) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-800"
        data-testid="value-office-panel"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Motor wartości niedostępny chwilowo — kokpit działa normalnie.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-800"
      data-testid="value-office-panel"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Value Office — motor wartości transformacji
        </h3>
        {loading && (
          <span
            className="text-xs text-slate-400 dark:text-slate-500"
            data-testid="value-office-busy"
          >
            Ładowanie…
          </span>
        )}
      </div>

      {/* KPI-strip */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-900"
          data-testid="kpi-total-identified"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Zidentyfikowana wartość
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {fmtMoney(bridge?.totalIdentified ?? 0)}
          </p>
        </div>
        <div
          className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-900"
          data-testid="kpi-total-realized"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Zrealizowana wartość
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {fmtMoney(bridge?.totalRealized ?? 0)}
          </p>
        </div>
      </div>

      {/* Most wartości */}
      <section data-testid="value-bridge-chart">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Most wartości (Baseline→Realized→Banked)
        </h4>
        <FinanceWaterfall steps={bridge?.steps ?? []} />
      </section>

      {/* Portfel decyzyjny */}
      <section data-testid="portfolio-board">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Portfel decyzyjny (NPV×ryzyko)
        </h4>
        <PortfolioBubble points={bubbleData} xLabel="Ryzyko" yLabel="NPV" quadrants />
      </section>
    </div>
  );
};

export default ValueOfficePanel;
