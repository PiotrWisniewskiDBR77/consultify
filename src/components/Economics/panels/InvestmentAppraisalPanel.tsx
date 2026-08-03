/**
 * M16/7.1 — Investment Appraisal panel (Analiza inwestycyjna).
 *
 * Repairs the audit P0 "Investment = skorupa": a real, interactive capital-budgeting
 * panel. The user edits a cash-flow series and a discount rate, hits "Oblicz", and the
 * server returns NPV / IRR / MIRR / payback / discounted payback / PI plus a
 * go / conditional / no-go verdict.
 *
 * Consumes POST /api/v8/finance/value/appraise
 *   body  { cashFlows:number[]; discountRate; hurdleRatePct }
 *   reply { data: { npv; irr; mirr; payback; discountedPayback; pi; verdict } }
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Tests inject a `fetcher` instead of hitting `Api`.
 *
 * FIN-005 round 8 — MODEL-BOUND MODE. Pass `modelId` to switch this from the
 * standalone what-if calculator into a read-only view of ONE financial
 * model's canonical appraisal: it fetches
 * `GET /v8/finance/models/:modelId/appraisal` on mount (no "Oblicz" click —
 * there is nothing to edit, the cash flows come from the model's own
 * `financial_model_events`, not from user input) and hides the editable
 * cash-flow/discount-rate controls. Reopening (re-mounting with the same
 * `modelId`) re-fetches and recomputes from the same stored events, so the
 * result is byte-identical run to run — see
 * `financialModelAppraisalAdapter.ts` on the server for why.
 *
 * NOT YET MOUNTED on any live screen (`FinancialModelWorkspace.tsx` or
 * elsewhere) — see FIN-005 round-8 report §UI. This is the tested, working
 * capability; mounting it is a separate step gated by the project's own
 * visual-acceptance process.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BulletChart } from '@/components/Economics/charts';
import { Api } from '@/services/api';

export type AppraisalVerdict = 'go' | 'conditional' | 'no-go';

export interface AppraisalResult {
  npv: number;
  irr: number | null;
  mirr: number;
  payback: number;
  discountedPayback: number;
  pi: number;
  verdict: AppraisalVerdict;
}

export interface AppraisalRequest {
  cashFlows: number[];
  discountRate: number;
  hurdleRatePct: number;
}

export interface ModelAppraisalResponse {
  input: {
    cashflows: number[];
    initialInvestment: number;
    discountRatePct: number;
    hurdleRatePct: number;
  };
  result: AppraisalResult;
  periodLabels: string[];
}

interface Props {
  /** Seed cash-flow series; first negative entry is treated as the initial outlay. */
  initialCashFlows?: number[];
  /** Seed discount rate in percent (defaults to 10). */
  discountRatePct?: number;
  /** Allow tests / callers to inject a fetcher. */
  fetcher?: (req: AppraisalRequest) => Promise<AppraisalResult>;
  /**
   * FIN-005 round 8 — switches to MODEL-BOUND MODE (see module doc). When
   * set, `initialCashFlows`/`fetcher` are ignored: the panel fetches this
   * model's canonical appraisal instead of running the editable calculator.
   */
  modelId?: string;
  /** Allow tests to inject the model-bound fetcher without hitting `Api`. */
  modelFetcher?: (
    modelId: string,
    rates: { discountRatePct: number; hurdleRatePct: number }
  ) => Promise<ModelAppraisalResponse>;
}

const DEFAULT_CASHFLOWS = [-1000, 400, 400, 400, 400];

const defaultFetcher = async (req: AppraisalRequest): Promise<AppraisalResult> => {
  const res: any = await Api.post('/v8/finance/value/appraise', {
    cashFlows: req.cashFlows,
    discountRate: req.discountRate,
    hurdleRatePct: req.hurdleRatePct,
  });
  // Server replies { data: AppraisalResult, meta }. Api wraps in an axios-like
  // { data: <body> }, so the result is res.data.data (with sane fallbacks).
  const body = res?.data ?? res;
  return (body?.data ?? body) as AppraisalResult;
};

const defaultModelFetcher = async (
  modelId: string,
  rates: { discountRatePct: number; hurdleRatePct: number }
): Promise<ModelAppraisalResponse> => {
  const query = new URLSearchParams({
    discountRatePct: String(rates.discountRatePct),
    hurdleRatePct: String(rates.hurdleRatePct),
  });
  const res: any = await Api.get(
    `/v8/finance/models/${encodeURIComponent(modelId)}/appraisal?${query}`
  );
  const body = res?.data ?? res;
  return (body?.data ?? body) as ModelAppraisalResponse;
};

const VERDICT_STYLE: Record<AppraisalVerdict, string> = {
  go: 'border-c-success/30 bg-c-success/10 text-c-success',
  conditional: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  'no-go': 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

const VERDICT_LABEL: Record<AppraisalVerdict, string> = {
  go: 'Realizować (go)',
  conditional: 'Warunkowo (conditional)',
  'no-go': 'Odrzucić (no-go)',
};

const fmtMoney = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1)}%`;
};

const fmtYears = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v) || v < 0) return '—';
  return `${v.toFixed(1)} lat`;
};

interface Metric {
  key: string;
  testid?: string;
  label: string;
  value: string;
  hint: string;
}

export const InvestmentAppraisalPanel: React.FC<Props> = ({
  initialCashFlows,
  discountRatePct,
  fetcher,
  modelId,
  modelFetcher,
}) => {
  const bound = Boolean(modelId);
  const [cashflows, setCashflows] = useState<number[]>(
    initialCashFlows && initialCashFlows.length > 0 ? initialCashFlows : DEFAULT_CASHFLOWS
  );
  const [discountRate, setDiscountRate] = useState<number>(
    typeof discountRatePct === 'number' ? discountRatePct : 10
  );
  const [result, setResult] = useState<AppraisalResult | null>(null);
  const [periodLabels, setPeriodLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(bound);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    const rate = typeof discountRatePct === 'number' ? discountRatePct : 10;
    setLoading(true);
    setFailed(false);
    (modelFetcher ?? defaultModelFetcher)(modelId, { discountRatePct: rate, hurdleRatePct: rate })
      .then((res) => {
        if (cancelled) return;
        setResult(res?.result ?? null);
        setPeriodLabels(res?.periodLabels ?? []);
        setFailed(!res?.result);
      })
      .catch(() => {
        if (cancelled) return;
        setResult(null);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetches (and gets a byte-identical result — see module doc) whenever
    // the bound model or rate changes; NOT on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, discountRatePct, modelFetcher]);

  const updateFlow = useCallback((idx: number, raw: string) => {
    const next = Number(raw);
    setCashflows((prev) => {
      const copy = [...prev];
      copy[idx] = Number.isFinite(next) ? next : 0;
      return copy;
    });
  }, []);

  const addPeriod = useCallback(() => {
    setCashflows((prev) => [...prev, 0]);
  }, []);

  const removePeriod = useCallback((idx: number) => {
    setCashflows((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
  }, []);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (fetcher ?? defaultFetcher)({
        cashFlows: cashflows,
        discountRate,
        hurdleRatePct: discountRate,
      });
      setResult(res ?? null);
      setFailed(!res);
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cashflows, discountRate, fetcher]);

  const metrics: Metric[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        key: 'npv',
        testid: 'appraise-npv',
        label: 'NPV',
        value: fmtMoney(result.npv),
        hint: 'Wartość bieżąca netto',
      },
      {
        key: 'irr',
        label: 'IRR',
        value: result.irr === null ? '—' : fmtPct(result.irr),
        hint: 'Wewnętrzna stopa zwrotu',
      },
      {
        key: 'mirr',
        label: 'MIRR',
        value: fmtPct(result.mirr),
        hint: 'Zmodyfikowana IRR',
      },
      {
        key: 'payback',
        label: 'Payback',
        value: fmtYears(result.payback),
        hint: 'Okres zwrotu',
      },
      {
        key: 'discountedPayback',
        label: 'Disc. payback',
        value: fmtYears(result.discountedPayback),
        hint: 'Zdyskontowany okres zwrotu',
      },
      {
        key: 'pi',
        label: 'PI',
        value: Number.isFinite(result.pi) ? result.pi.toFixed(2) : '—',
        hint: 'Wskaźnik rentowności',
      },
    ];
  }, [result]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="investment-appraisal-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          Analiza inwestycyjna (NPV/IRR/payback)
        </h3>
        <p className="mt-0.5 text-xs text-c-text-muted">
          {bound
            ? 'Kanoniczny model — przepływy pochodzą z prognozy modelu, nie do edycji.'
            : 'Wprowadź przepływy pieniężne (pierwszy ujemny = nakład początkowy) i stopę dyskontową.'}
        </p>
      </div>

      {!bound && (
        <>
          {/* Inputs: cash-flow series */}
          <div className="mb-3 flex flex-wrap items-end gap-2" data-testid="appraise-cashflows">
            {cashflows.map((cf, idx) => (
              <label key={idx} className="flex flex-col text-[11px] text-c-text-muted">
                <span className="mb-0.5">{idx === 0 ? 'T0 (nakład)' : `Rok ${idx}`}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    value={Number.isFinite(cf) ? cf : 0}
                    onChange={(e) => updateFlow(idx, e.target.value)}
                    className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus"
                    aria-label={idx === 0 ? 'Nakład początkowy' : `Przepływ rok ${idx}`}
                  />
                  {cashflows.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePeriod(idx)}
                      className="text-c-text-muted hover:text-c-danger"
                      aria-label={`Usuń okres ${idx}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={addPeriod}
              className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
            >
              + okres
            </button>
          </div>

          {/* Inputs: discount rate + compute */}
          <div className="mb-3 flex items-end gap-3">
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">Stopa dyskontowa (%)</span>
              <input
                type="number"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value) || 0)}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus"
                aria-label="Stopa dyskontowa"
              />
            </label>
            <button
              type="button"
              onClick={() => void compute()}
              disabled={loading}
              className="rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
              data-testid="appraise-compute"
            >
              {loading ? 'Liczę…' : 'Oblicz'}
            </button>
          </div>
        </>
      )}

      {bound && loading && (
        <p className="mb-3 text-xs text-c-text-muted" data-testid="appraise-loading">
          Liczę…
        </p>
      )}

      {bound && !loading && periodLabels.length > 0 && (
        <p className="mb-3 text-[11px] text-c-text-muted" data-testid="appraise-period-labels">
          Okresy: {periodLabels.join(' · ')}
        </p>
      )}

      {failed && (
        <p className="text-sm text-c-text-muted" data-testid="appraise-failed">
          Analiza niedostępna chwilowo — spróbuj ponownie.
        </p>
      )}

      {!failed && result && (
        <>
          {/* Verdict */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-medium text-c-text-muted">Werdykt:</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VERDICT_STYLE[result.verdict]}`}
              data-testid="appraise-verdict"
            >
              {VERDICT_LABEL[result.verdict]}
            </span>
          </div>

          {/* Metric tiles */}
          <div
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
            data-testid="appraise-metrics"
          >
            {metrics.map((m) => (
              <div
                key={m.key}
                className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2"
                {...(m.testid ? { 'data-testid': m.testid } : {})}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {m.label}
                </p>
                <p className="text-sm font-semibold text-c-text">{m.value}</p>
                <p className="text-[10px] text-c-text-muted">{m.hint}</p>
              </div>
            ))}
          </div>

          {/* NPV vs break-even threshold (0) */}
          <div className="border-t border-c-border-subtle pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              NPV względem progu opłacalności (0)
            </p>
            <BulletChart
              label="NPV"
              baseline={0}
              target={0}
              actual={Number.isFinite(result.npv) ? result.npv : 0}
              max={Math.max(1, Math.abs(result.npv) * 1.2)}
              height={44}
              formatValue={(v) => fmtMoney(v)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default InvestmentAppraisalPanel;
