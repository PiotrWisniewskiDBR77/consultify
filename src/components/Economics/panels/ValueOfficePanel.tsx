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
 *  - initiatives podawane z kokpitu; gdy brak realnych → PUSTY STAN (nie dane
 *    demo — „Dane demo = twarz produktu", zakaz syntetycznego fallbacku na
 *    produkcji). Realną ścieżkę zachowujemy 1:1.
 *  - busy-state na czas fetchu; błąd degraduje do cichej notki, NIE blokuje kokpitu.
 *  - fetchery wstrzykiwalne (testy / odmienni wywołujący).
 *
 * Wpięty w FinanceHub (zakładka „models", za flagą valueOffice).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

// --- Formatowanie KPI (skala k/M) ---------------------------------------

/**
 * FIN-005 — tell "blocked by the demo read-only guard" apart from "the engine
 * broke".
 *
 * Both value endpoints are pure compute, but they are POSTs, and
 * `demoWriteProtection` rejects every non-GET in demo mode with 403
 * `DEMO_READ_ONLY` (proved in
 * `server/src/routes/v8/__tests__/financeValueRoutes.demoGuard.test.ts`).
 * Rendering that as "temporarily unavailable — the cockpit works normally"
 * misrepresents a *systematically* missing part of the golden flow as a blip,
 * which is exactly what FIN-005 rejected. Name the real reason instead.
 */
function isDemoReadOnlyError(error: unknown): boolean {
  const candidate = error as
    | { code?: unknown; status?: unknown; message?: unknown; response?: { status?: unknown; data?: { code?: unknown } } }
    | null
    | undefined;
  if (!candidate) return false;
  const code = String(candidate.code ?? candidate.response?.data?.code ?? '');
  if (code === 'DEMO_READ_ONLY') return true;
  const status = Number(candidate.status ?? candidate.response?.status ?? 0);
  return status === 403 && /demo mode is read-only/i.test(String(candidate.message ?? ''));
}

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
  const { t } = useTranslation();
  // Real-data-only: no synthetic fallback. When the cockpit supplies no real
  // initiatives we render an empty state (below), never demo rows.
  const hasInitiatives = Array.isArray(initiatives) && initiatives.length > 0;
  const effectiveInitiatives = useMemo(() => initiatives ?? [], [initiatives]);

  const [bridge, setBridge] = useState<ValueBridgeResponse['data'] | null>(null);
  const [portfolio, setPortfolio] = useState<PrioritizedInitiative[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** `true` when the failure is the demo read-only guard, not the engine. */
  const [blockedByDemoGuard, setBlockedByDemoGuard] = useState(false);

  useEffect(() => {
    if (!hasInitiatives) {
      setBridge(null);
      setPortfolio(null);
      setFailed(false);
      setBlockedByDemoGuard(false);
      setLoading(false);
      return;
    }
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
          setBlockedByDemoGuard(false);
        }
      } catch (error) {
        if (!cancelled) {
          setBridge(null);
          setPortfolio(null);
          setFailed(true);
          setBlockedByDemoGuard(isDemoReadOnlyError(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [hasInitiatives, effectiveInitiatives, valueBridgeFetcher, portfolioFetcher]);

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

  // Empty state — brak realnych inicjatyw. NIE renderujemy danych demo.
  // c-* tokeny (dark-safe) — wzór empty-state paneli M16.
  if (!hasInitiatives) {
    return (
      <div
        className="rounded-xl border border-c-border bg-c-surface p-4"
        data-testid="value-office-panel"
      >
        <h3 className="mb-2 text-sm font-semibold text-c-text">
          {t('finance.valueOffice.title', 'Value Office — motor wartości transformacji')}
        </h3>
        <div
          className="rounded-lg border border-dashed border-c-border bg-c-surface-raised p-4 text-center"
          data-testid="value-office-empty"
        >
          <p className="text-sm font-medium text-c-text-secondary">
            {t('finance.valueOffice.empty.title', 'No initiatives to show yet')}
          </p>
          <p className="mt-1 text-xs text-c-text-muted">
            {t(
              'finance.valueOffice.empty.body',
              'The value engine draws on the organization’s initiatives (their value, stage, NPV and risk). Add or link initiatives to see the value bridge and decision portfolio here.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className="rounded-xl border border-c-border bg-c-surface p-4"
        data-testid="value-office-panel"
      >
        <h3 className="mb-2 text-sm font-semibold text-c-text">
          {t('finance.valueOffice.title', 'Value Office — motor wartości transformacji')}
        </h3>
        <div
          className="rounded-lg border border-dashed border-c-border bg-c-surface-raised p-4"
          data-testid={
            blockedByDemoGuard ? 'value-office-demo-blocked' : 'value-office-failed'
          }
        >
          {/*
            FIN-005: the old single line read "Value engine temporarily
            unavailable — the cockpit works normally", which made a value bridge
            that can NEVER load in demo mode look like a passing blip. State
            plainly which part of the golden flow is missing.
          */}
          <p className="text-sm font-medium text-c-text-secondary">
            {blockedByDemoGuard
              ? t(
                  'finance.valueOffice.blockedByDemo.title',
                  'Value bridge and decision portfolio are not available in demo mode'
                )
              : t(
                  'finance.valueOffice.failed.title',
                  'Value bridge and decision portfolio could not be calculated'
                )}
          </p>
          <p className="mt-1 text-xs text-c-text-muted">
            {blockedByDemoGuard
              ? t(
                  'finance.valueOffice.blockedByDemo.body',
                  'The read-only demo workspace blocks the value engine request. The rest of the cockpit is unaffected, but this part of the value story is not shown — do not read it as a completed calculation.'
                )
              : t(
                  'finance.valueOffice.failed.body',
                  'The rest of the cockpit is unaffected. This section shows no result — do not read it as a completed calculation.'
                )}
          </p>
        </div>
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
