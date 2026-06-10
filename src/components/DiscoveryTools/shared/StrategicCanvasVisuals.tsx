import React from 'react';

import type {
  GrowthPathsData,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
} from '@/store/useToolStore';

const cardClass =
  'rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-navy-700 dark:bg-navy-950/60';

export function SwotMatrixVisual({ data, isPolish }: { data: SWOTData; isPolish: boolean }) {
  const quadrants = [
    ['strengths', isPolish ? 'Mocne strony' : 'Strengths', 'bg-emerald-50 text-emerald-700'],
    ['weaknesses', isPolish ? 'Słabe strony' : 'Weaknesses', 'bg-amber-50 text-amber-700'],
    ['opportunities', isPolish ? 'Szanse' : 'Opportunities', 'bg-sky-50 text-sky-700'],
    ['threats', isPolish ? 'Zagrożenia' : 'Threats', 'bg-rose-50 text-rose-700'],
  ] as const;
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        SWOT 2x2
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map(([id, label, tone]) => (
          <div key={id} className={`rounded-xl p-3 ${tone}`}>
            <div className="text-xs font-semibold">{label}</div>
            <div className="mt-2 text-2xl font-bold">
              {(data.items || []).filter((i) => i.quadrant === id).length}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-navy-900 dark:text-slate-300">
        {isPolish
          ? 'Napięcia powstają z przecięć: S/O, W/O, S/T, W/T.'
          : 'Tensions emerge from S/O, W/O, S/T, and W/T intersections.'}
      </div>
    </div>
  );
}

export function PorterPentagonVisual({ data, isPolish }: { data: PorterData; isPolish: boolean }) {
  const forces = [
    ['rivalry', isPolish ? 'Rywalizacja' : 'Rivalry'],
    ['newEntrants', isPolish ? 'Nowi gracze' : 'Entrants'],
    ['substitutes', isPolish ? 'Substytuty' : 'Substitutes'],
    ['buyerPower', isPolish ? 'Nabywcy' : 'Buyers'],
    ['supplierPower', isPolish ? 'Dostawcy' : 'Suppliers'],
  ] as const;
  const points = forces.map((_, index) => {
    const angle = -90 + index * 72;
    const radians = (angle * Math.PI) / 180;
    return { x: 50 + Math.cos(radians) * 34, y: 50 + Math.sin(radians) * 34 };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {isPolish ? 'Radar sił Portera' : 'Porter force radar'}
      </div>
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <svg viewBox="0 0 100 100" className="h-44 w-full">
          <polygon
            points={polygon}
            className="fill-blue-50 stroke-blue-200 dark:fill-blue-950/20 dark:stroke-blue-800"
          />
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="3" className="fill-blue-500" />
          ))}
        </svg>
        <div className="space-y-2">
          {forces.map(([id, label]) => {
            const score = data.forces?.[id]?.score || 0;
            return (
              <div key={id}>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{label}</span>
                  <span>{score}/5</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-navy-800">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${score * 20}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnsoffMatrixVisual({
  data,
  isPolish,
}: {
  data: GrowthPathsData;
  isPolish: boolean;
}) {
  const cells = [
    ['marketPenetration', 'Market penetration'],
    ['productDevelopment', 'Product development'],
    ['marketDevelopment', 'Market development'],
    ['diversification', 'Diversification'],
  ] as const;
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        Ansoff 2x2
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cells.map(([id, label]) => (
          <div
            key={id}
            className="rounded-xl bg-primary-50 p-3 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300"
          >
            <div className="text-xs font-semibold">{label}</div>
            <div className="mt-2 text-2xl font-bold">{(data.quadrants?.[id] || []).length}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {isPolish
          ? 'Każda opcja dostaje chipy: impact, effort i risk.'
          : 'Each option carries impact, effort, and risk chips.'}
      </div>
    </div>
  );
}

export function PortfolioBcgVisual({
  data,
  isPolish,
}: {
  data: PortfolioPriorityData;
  isPolish: boolean;
}) {
  const items = data.initiatives || [];
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        BCG 2x2
      </div>
      <div className="relative h-56 rounded-2xl bg-slate-50 dark:bg-navy-900">
        <div className="absolute inset-x-1/2 top-0 h-full w-px bg-slate-200 dark:bg-navy-700" />
        <div className="absolute inset-y-1/2 left-0 h-px w-full bg-slate-200 dark:bg-navy-700" />
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute rounded-full bg-pink-500/80 text-[10px] text-white shadow"
            style={{
              left: `${Math.max(4, Math.min(88, item.marketShare * 18))}%`,
              bottom: `${Math.max(4, Math.min(88, item.marketGrowth * 18))}%`,
              width: `${16 + item.investmentLevel * 4}px`,
              height: `${16 + item.investmentLevel * 4}px`,
            }}
            title={item.title}
          />
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {isPolish
          ? 'Pozycja = wzrost i udział, wielkość bąbla = inwestycje.'
          : 'Position = growth and share, bubble size = investment.'}
      </div>
    </div>
  );
}

export function RiskMatrixVisual({
  data,
  isPolish,
}: {
  data: RiskUncertaintyData;
  isPolish: boolean;
}) {
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {isPolish ? 'Macierz prawdopodobieństwo x wpływ' : 'Probability x impact matrix'}
      </div>
      <div className="relative h-56 rounded-2xl bg-gradient-to-tr from-emerald-50 via-amber-50 to-rose-50 dark:from-emerald-950/20 dark:via-amber-950/20 dark:to-rose-950/20">
        <div className="absolute inset-x-1/2 top-0 h-full w-px bg-white/70" />
        <div className="absolute inset-y-1/2 left-0 h-px w-full bg-white/70" />
        {(data.risks || []).map((risk) => (
          <div
            key={risk.id}
            className="absolute h-4 w-4 rounded-full bg-amber-600 shadow"
            style={{
              left: `${Math.max(4, Math.min(90, risk.probability * 18))}%`,
              bottom: `${Math.max(4, Math.min(90, risk.impact * 18))}%`,
            }}
            title={risk.title}
          />
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {isPolish
          ? 'Scenariusze tworzą pas reakcji dla ryzyk w prawym górnym rogu.'
          : 'Scenarios create a response lane for upper-right risks.'}
      </div>
    </div>
  );
}
