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
 */
import React, { useCallback, useMemo, useState } from 'react';

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

interface Props {
  /** Seed cash-flow series; first negative entry is treated as the initial outlay. */
  initialCashFlows?: number[];
  /** Seed discount rate in percent (defaults to 10). */
  discountRatePct?: number;
  /** Allow tests / callers to inject a fetcher. */
  fetcher?: (req: AppraisalRequest) => Promise<AppraisalResult>;
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

const VERDICT_STYLE: Record<AppraisalVerdict, string> = {
  go: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  conditional: 'bg-amber-100 text-amber-700 border-amber-200',
  'no-go': 'bg-rose-100 text-rose-700 border-rose-200',
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
}) => {
  const [cashflows, setCashflows] = useState<number[]>(
    initialCashFlows && initialCashFlows.length > 0 ? initialCashFlows : DEFAULT_CASHFLOWS,
  );
  const [discountRate, setDiscountRate] = useState<number>(
    typeof discountRatePct === 'number' ? discountRatePct : 10,
  );
  const [result, setResult] = useState<AppraisalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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
      className="rounded-xl border border-gray-200 bg-white p-4"
      data-testid="investment-appraisal-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Analiza inwestycyjna (NPV/IRR/payback)
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Wprowadź przepływy pieniężne (pierwszy ujemny = nakład początkowy) i stopę dyskontową.
        </p>
      </div>

      {/* Inputs: cash-flow series */}
      <div className="mb-3 flex flex-wrap items-end gap-2" data-testid="appraise-cashflows">
        {cashflows.map((cf, idx) => (
          <label key={idx} className="flex flex-col text-[11px] text-gray-500">
            <span className="mb-0.5">{idx === 0 ? 'T0 (nakład)' : `Rok ${idx}`}</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                value={Number.isFinite(cf) ? cf : 0}
                onChange={(e) => updateFlow(idx, e.target.value)}
                className="w-20 rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-800 focus:border-blue-400 focus:outline-none"
                aria-label={idx === 0 ? 'Nakład początkowy' : `Przepływ rok ${idx}`}
              />
              {cashflows.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePeriod(idx)}
                  className="text-gray-300 hover:text-rose-500"
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
          className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + okres
        </button>
      </div>

      {/* Inputs: discount rate + compute */}
      <div className="mb-3 flex items-end gap-3">
        <label className="flex flex-col text-[11px] text-gray-500">
          <span className="mb-0.5">Stopa dyskontowa (%)</span>
          <input
            type="number"
            value={discountRate}
            onChange={(e) => setDiscountRate(Number(e.target.value) || 0)}
            className="w-24 rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-800 focus:border-blue-400 focus:outline-none"
            aria-label="Stopa dyskontowa"
          />
        </label>
        <button
          type="button"
          onClick={() => void compute()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="appraise-compute"
        >
          {loading ? 'Liczę…' : 'Oblicz'}
        </button>
      </div>

      {failed && (
        <p className="text-sm text-gray-500" data-testid="appraise-failed">
          Analiza niedostępna chwilowo — spróbuj ponownie.
        </p>
      )}

      {!failed && result && (
        <>
          {/* Verdict */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Werdykt:</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VERDICT_STYLE[result.verdict]}`}
              data-testid="appraise-verdict"
            >
              {VERDICT_LABEL[result.verdict]}
            </span>
          </div>

          {/* Metric tiles */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="appraise-metrics">
            {metrics.map((m) => (
              <div
                key={m.key}
                className="rounded-lg border border-gray-100 bg-gray-50 p-2"
                {...(m.testid ? { 'data-testid': m.testid } : {})}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {m.label}
                </p>
                <p className="text-sm font-semibold text-gray-900">{m.value}</p>
                <p className="text-[10px] text-gray-400">{m.hint}</p>
              </div>
            ))}
          </div>

          {/* NPV vs break-even threshold (0) */}
          <div className="border-t border-gray-100 pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
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
