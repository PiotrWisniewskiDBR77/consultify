/**
 * M14/7.3 — What-if sandbox (dry-run interventions on portfolio health).
 *
 * Lets the user stack interventions (add resource / descope / extend / mitigate /
 * reprioritize) and see the projected portfolio metrics recompute live via the pure
 * whatIfSimulator. Read-only / non-persistent — pure projection, nothing is saved.
 * Behind the `whatIfSandbox` flag (default OFF).
 */
import React, { useMemo, useState } from 'react';

import {
  simulateWhatIf,
  type Intervention,
  type PortfolioMetrics,
} from './whatIfSimulator';

interface Props {
  baseline: PortfolioMetrics;
}

const INTERVENTIONS: Array<{ type: Intervention['type']; label: string; magnitude: number }> = [
  { type: 'add_resource', label: '+1 FTE', magnitude: 1 },
  { type: 'descope', label: 'Zdejmij zakres', magnitude: 1 },
  { type: 'extend_deadline', label: '+14 dni', magnitude: 14 },
  { type: 'mitigate_risk', label: 'Zamknij ryzyko', magnitude: 1 },
  { type: 'reprioritize', label: 'Repriorytetyzuj', magnitude: 1 },
];

const fmtIdx = (v: number | null | undefined): string =>
  v == null ? '—' : v.toFixed(2);

const deltaBadge = (delta: number): { text: string; cls: string } => {
  if (delta > 0) return { text: `+${delta}`, cls: 'bg-emerald-100 text-emerald-700' };
  if (delta < 0) return { text: `${delta}`, cls: 'bg-red-100 text-red-700' };
  return { text: '±0', cls: 'bg-gray-100 text-gray-600' };
};

export const ExecutionWhatIfSandbox: React.FC<Props> = ({ baseline }) => {
  const [picked, setPicked] = useState<Intervention[]>([]);

  const result = useMemo(() => simulateWhatIf(baseline, picked), [baseline, picked]);
  const healthDelta = Math.round((result.projected.healthScore - baseline.healthScore) * 10) / 10;
  const badge = deltaBadge(healthDelta);

  const toggle = (i: { type: Intervention['type']; magnitude: number }) => {
    setPicked((prev) => {
      const exists = prev.find((p) => p.type === i.type);
      if (exists) return prev.filter((p) => p.type !== i.type);
      return [...prev, { type: i.type, magnitude: i.magnitude }];
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4" data-testid="whatif-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">What-if — symulacja interwencji</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
          data-testid="whatif-health-delta"
        >
          Health {badge.text}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" data-testid="whatif-interventions">
        {INTERVENTIONS.map((i) => {
          const active = picked.some((p) => p.type === i.type);
          return (
            <button
              key={i.type}
              type="button"
              onClick={() => toggle(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              aria-pressed={active}
            >
              {i.label}
            </button>
          );
        })}
        {picked.length > 0 && (
          <button
            type="button"
            onClick={() => setPicked([])}
            className="rounded-full px-3 py-1 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="whatif-metrics">
        <Metric label="Health" base={baseline.healthScore} proj={result.projected.healthScore} />
        <Metric label="SPI" base={baseline.spi} proj={result.projected.spi} idx />
        <Metric label="CPI" base={baseline.cpi} proj={result.projected.cpi} idx />
        <Metric
          label="Obłożenie %"
          base={baseline.capacityUtilizationPct}
          proj={result.projected.capacityUtilizationPct}
        />
      </div>

      {result.explanation.length > 0 && (
        <ul className="mt-3 list-inside list-disc border-t border-gray-100 pt-2 text-xs text-gray-600">
          {result.explanation.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {picked.length === 0 && (
        <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
          Wybierz interwencje powyżej, aby zobaczyć projekcję (dry-run, nic nie jest zapisywane).
        </p>
      )}
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  base?: number | null;
  proj?: number | null;
  idx?: boolean;
}> = ({ label, base, proj, idx }) => {
  const b = base == null ? null : idx ? Number(base) : Math.round(Number(base));
  const p = proj == null ? null : idx ? Number(proj) : Math.round(Number(proj));
  const changed = b != null && p != null && b !== p;
  return (
    <div className="rounded-lg border border-gray-100 p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800">
        {idx ? fmtIdx(p) : p ?? '—'}
        {changed && (
          <span className="ml-1 text-[10px] font-normal text-gray-400">
            (z {idx ? fmtIdx(b) : b})
          </span>
        )}
      </p>
    </div>
  );
};

export default ExecutionWhatIfSandbox;
