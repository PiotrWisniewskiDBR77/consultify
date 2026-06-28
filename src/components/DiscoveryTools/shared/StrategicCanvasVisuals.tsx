import React from 'react';

import type {
  AmbitionTheme,
  Capability,
  FocusPriority,
  GrowthPathsData,
  NarrativePillar,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
  ValueActivity,
  ValueActivityId,
  ValueChainData,
} from '@/store/useToolStore';

const cardClass =
  'rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-navy-700 dark:bg-navy-950/60';

export function SwotMatrixVisual({ data, isPolish }: { data: SWOTData; isPolish: boolean }) {
  const quadrants = [
    ['strengths', isPolish ? 'Mocne strony' : 'Strengths', 'bg-emerald-50 text-emerald-700'],
    ['weaknesses', isPolish ? 'Słabe strony' : 'Weaknesses', 'bg-amber-50 text-amber-700'],
    ['opportunities', isPolish ? 'Szanse' : 'Opportunities', 'bg-sky-50 text-sky-700'],
    ['threats', isPolish ? 'Zagrożenia' : 'Threats', 'bg-danger-50 text-danger-700'],
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
      <div className="relative h-56 rounded-2xl bg-gradient-to-tr from-emerald-50 via-amber-50 to-danger-50 dark:from-emerald-950/20 dark:via-amber-950/20 dark:to-danger-900/20">
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

const VALUE_CHAIN_PRIMARY_IDS: ValueActivityId[] = [
  'inboundLogistics',
  'operations',
  'outboundLogistics',
  'marketingSales',
  'service',
];

const VALUE_CHAIN_SUPPORT_IDS: ValueActivityId[] = [
  'infrastructure',
  'hrManagement',
  'technology',
  'procurement',
];

const VALUE_CHAIN_LABELS: Record<ValueActivityId, { pl: string; en: string }> = {
  inboundLogistics: { pl: 'Logistyka wej.', en: 'Inbound' },
  operations: { pl: 'Operacje', en: 'Operations' },
  outboundLogistics: { pl: 'Logistyka wyj.', en: 'Outbound' },
  marketingSales: { pl: 'Marketing', en: 'Marketing' },
  service: { pl: 'Serwis', en: 'Service' },
  infrastructure: { pl: 'Infrastruktura', en: 'Infrastructure' },
  hrManagement: { pl: 'Zasoby ludzkie', en: 'HR management' },
  technology: { pl: 'Technologia', en: 'Technology' },
  procurement: { pl: 'Zaopatrzenie', en: 'Procurement' },
};

const valueChainRoleTone: Record<ValueActivity['marginRole'], string> = {
  creator: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  drain: 'bg-amber-500',
};

const valueChainContributionLabel = (
  level: 'high' | 'medium' | 'low',
  isPolish: boolean
): string => {
  if (isPolish) {
    return level === 'high' ? 'wys.' : level === 'medium' ? 'śr.' : 'nis.';
  }
  return level === 'high' ? 'hi' : level === 'medium' ? 'mid' : 'lo';
};

export function ValueChainVisual({
  activities,
  positioningVerdict,
  isPolish,
}: {
  activities: Record<ValueActivityId, ValueActivity>;
  positioningVerdict?: ValueChainData['positioningVerdict'];
  isPolish: boolean;
}) {
  const labelFor = (id: ValueActivityId): string => {
    const activity = activities?.[id];
    if (activity?.name) return activity.name;
    return isPolish ? VALUE_CHAIN_LABELS[id].pl : VALUE_CHAIN_LABELS[id].en;
  };

  const renderActivityMeta = (activity?: ValueActivity) => {
    if (!activity) return null;
    return (
      <span className="text-[9px] font-medium text-white/85">
        {`${isPolish ? 'koszt' : 'cost'} ${valueChainContributionLabel(
          activity.costContribution,
          isPolish
        )} · ${isPolish ? 'wartość' : 'value'} ${valueChainContributionLabel(
          activity.valueContribution,
          isPolish
        )}`}
      </span>
    );
  };

  const verdictTone =
    positioningVerdict?.positioning === 'cost-advantage'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
      : positioningVerdict?.positioning === 'differentiation'
        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';

  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {isPolish ? 'Łańcuch wartości Portera' : 'Porter value chain'}
      </div>

      <div className="flex items-stretch gap-1">
        <div className="min-w-0 flex-1">
          {/* Support activities — horizontal bands across the top */}
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {isPolish ? 'Aktywności wspierające' : 'Support activities'}
          </div>
          <div className="space-y-1">
            {VALUE_CHAIN_SUPPORT_IDS.map((id) => {
              const activity = activities?.[id];
              const tone = valueChainRoleTone[activity?.marginRole ?? 'neutral'];
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] font-semibold text-white ${tone}`}
                  title={labelFor(id)}
                >
                  <span className="truncate">{labelFor(id)}</span>
                  {renderActivityMeta(activity)}
                </div>
              );
            })}
          </div>

          {/* Primary activities — chevrons across the bottom */}
          <div className="mb-1 mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {isPolish ? 'Aktywności pierwotne' : 'Primary activities'}
          </div>
          <div className="flex gap-0.5">
            {VALUE_CHAIN_PRIMARY_IDS.map((id, index) => {
              const activity = activities?.[id];
              const tone = valueChainRoleTone[activity?.marginRole ?? 'neutral'];
              return (
                <div
                  key={id}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center text-[10px] font-semibold leading-tight text-white ${tone}`}
                  style={{
                    clipPath:
                      index === 0
                        ? 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)'
                        : 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%, 18% 50%)',
                    marginLeft: index === 0 ? 0 : '-6px',
                  }}
                  title={labelFor(id)}
                >
                  <span className="truncate">{labelFor(id)}</span>
                  {renderActivityMeta(activity)}
                </div>
              );
            })}
          </div>
        </div>

        {/* MARGIN wedge pointing right */}
        <div
          className="flex w-14 items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-center text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ clipPath: 'polygon(0 0, 60% 0, 100% 50%, 60% 100%, 0 100%, 40% 50%)' }}
        >
          {isPolish ? 'Marża' : 'Margin'}
        </div>
      </div>

      {/* Margin-role legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ['creator', isPolish ? 'Tworzy marżę' : 'Creates margin'],
            ['neutral', isPolish ? 'Neutralna' : 'Neutral'],
            ['drain', isPolish ? 'Drenuje marżę' : 'Drains margin'],
          ] as Array<[ValueActivity['marginRole'], string]>
        ).map(([role, text]) => (
          <div key={role} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${valueChainRoleTone[role]}`} />
            <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
          </div>
        ))}
      </div>

      {positioningVerdict ? (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${verdictTone}`}>
          <span className="font-semibold uppercase tracking-[0.12em]">
            {positioningVerdict.positioning === 'cost-advantage'
              ? isPolish
                ? 'Przewaga kosztowa'
                : 'Cost advantage'
              : positioningVerdict.positioning === 'differentiation'
                ? isPolish
                  ? 'Różnicowanie'
                  : 'Differentiation'
                : isPolish
                  ? 'Utknięcie w środku'
                  : 'Stuck in the middle'}
          </span>
          {positioningVerdict.summary ? (
            <span className="ml-2 font-normal">{positioningVerdict.summary}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Kolor aktywności = rola w marży, adnotacje = wkład w koszt i wartość.'
            : 'Activity color = margin role, annotations = cost and value contribution.'}
        </div>
      )}
    </div>
  );
}

const CAPABILITY_IMPORTANCE_RANK: Record<Capability['importance'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const capabilityGapTone: Record<NonNullable<Capability['gapSize']>, string> = {
  critical: 'bg-amber-500',
  moderate: 'bg-slate-400',
  minor: 'bg-emerald-500',
};

const capabilityImportanceLabel = (
  importance: Capability['importance'],
  isPolish: boolean
): string => {
  if (isPolish) {
    return importance === 'high' ? 'wysoka' : importance === 'medium' ? 'średnia' : 'niska';
  }
  return importance === 'high' ? 'high' : importance === 'medium' ? 'medium' : 'low';
};

export function CapabilityMaturityVisual({
  capabilities,
  isPolish,
}: {
  capabilities: Capability[];
  isPolish: boolean;
}) {
  // Sort by strategic importance (high → low), then by widest current→target gap.
  const sorted = [...(capabilities || [])].sort((a, b) => {
    const byImportance =
      CAPABILITY_IMPORTANCE_RANK[a.importance] - CAPABILITY_IMPORTANCE_RANK[b.importance];
    if (byImportance !== 0) return byImportance;
    return b.targetMaturity - b.currentMaturity - (a.targetMaturity - a.currentMaturity);
  });

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {isPolish ? 'Drabina dojrzałości zdolności' : 'Capability maturity ladder'}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {isPolish ? 'Skala 1-5' : 'Scale 1-5'}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {isPolish
            ? 'Brak zdolności do pokazania. Dodaj zdolności, aby zobaczyć dojrzałość obecną vs docelową.'
            : 'No capabilities to show yet. Add capabilities to see current vs target maturity.'}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {sorted.map((capability) => {
              const current = Math.max(0, Math.min(5, capability.currentMaturity || 0));
              const target = Math.max(0, Math.min(5, capability.targetMaturity || 0));
              const lo = Math.min(current, target);
              const hi = Math.max(current, target);
              const loPct = (lo / 5) * 100;
              const hiPct = (hi / 5) * 100;
              const tone = capabilityGapTone[capability.gapSize ?? 'moderate'];
              return (
                <div key={capability.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span
                      className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                      title={capability.name}
                    >
                      {capability.name}
                      {capability.domain ? (
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                          {capability.domain}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {current} → {target}
                    </span>
                  </div>
                  <div
                    className="relative h-3 rounded-full bg-slate-100 dark:bg-navy-800"
                    title={`${isPolish ? 'waga' : 'importance'}: ${capabilityImportanceLabel(
                      capability.importance,
                      isPolish
                    )}`}
                  >
                    {/* Gap fill from lower to higher maturity */}
                    <div
                      className={`absolute top-0 h-3 rounded-full ${tone}`}
                      style={{ left: `${loPct}%`, width: `${Math.max(0, hiPct - loPct)}%` }}
                    />
                    {/* Current-maturity marker */}
                    <div
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-700 shadow dark:border-navy-950"
                      style={{ left: `${(current / 5) * 100}%` }}
                      title={`${isPolish ? 'Obecna' : 'Current'}: ${current}`}
                    />
                    {/* Target-maturity marker */}
                    <div
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow dark:border-navy-950"
                      style={{ left: `${(target / 5) * 100}%` }}
                      title={`${isPolish ? 'Docelowa' : 'Target'}: ${target}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Marker + gap-size legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-700 shadow-sm dark:border-navy-950" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                {isPolish ? 'Obecna' : 'Current'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 shadow-sm dark:border-navy-950" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                {isPolish ? 'Docelowa' : 'Target'}
              </span>
            </div>
            {(
              [
                ['critical', isPolish ? 'Krytyczna luka' : 'Critical gap'],
                ['moderate', isPolish ? 'Umiarkowana luka' : 'Moderate gap'],
                ['minor', isPolish ? 'Drobna luka' : 'Minor gap'],
              ] as Array<[NonNullable<Capability['gapSize']>, string]>
            ).map(([gap, text]) => (
              <div key={gap} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${capabilityGapTone[gap]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Sortowanie wg wagi strategicznej, kolor wypełnienia = rozmiar luki, znaczniki = dojrzałość obecna i docelowa.'
              : 'Sorted by strategic importance, fill color = gap size, markers = current and target maturity.'}
          </div>
        </>
      )}
    </div>
  );
}

const AMBITION_HORIZON_ORDER: Array<AmbitionTheme['horizon']> = ['short', 'medium', 'long'];

const AMBITION_IMPORTANCE_RANK: Record<AmbitionTheme['importance'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Importance drives the chip emphasis: high = accent (violet), medium = slate, low = muted.
const ambitionImportanceTone: Record<AmbitionTheme['importance'], string> = {
  high: 'border-violet-300 bg-violet-50 dark:border-violet-700/60 dark:bg-violet-900/20',
  medium: 'border-slate-200 bg-slate-50 dark:border-navy-700 dark:bg-navy-900/50',
  low: 'border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-950/40',
};
const ambitionImportanceDot: Record<AmbitionTheme['importance'], string> = {
  high: 'bg-violet-500',
  medium: 'bg-slate-400',
  low: 'bg-slate-300',
};

const ambitionHorizonTone: Record<AmbitionTheme['horizon'], string> = {
  short: 'text-emerald-700 dark:text-emerald-300',
  medium: 'text-sky-700 dark:text-sky-300',
  long: 'text-indigo-700 dark:text-indigo-300',
};

const ambitionHorizonLabel = (
  horizon: AmbitionTheme['horizon'],
  isPolish: boolean
): string => {
  if (isPolish) {
    return horizon === 'short' ? 'Krótki' : horizon === 'medium' ? 'Średni' : 'Długi';
  }
  return horizon === 'short' ? 'Short' : horizon === 'medium' ? 'Medium' : 'Long';
};

const ambitionImportanceLabel = (
  importance: AmbitionTheme['importance'],
  isPolish: boolean
): string => {
  if (isPolish) {
    return importance === 'high' ? 'Wysoka' : importance === 'medium' ? 'Średnia' : 'Niska';
  }
  return importance === 'high' ? 'High' : importance === 'medium' ? 'Medium' : 'Low';
};

export function AmbitionDecompositionVisual({
  themes,
  ambitionStatement,
  isPolish,
}: {
  themes: AmbitionTheme[];
  ambitionStatement?: string;
  isPolish: boolean;
}) {
  const safeThemes = themes || [];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {isPolish ? 'Kaskada ambicji' : 'Ambition cascade'}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {isPolish ? 'Motywy wg horyzontu' : 'Themes by horizon'}
        </div>
      </div>

      {/* Central ambition node sits at the top of the cascade. */}
      <div className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-center dark:border-violet-700/60 dark:bg-violet-900/20">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
          {isPolish ? 'Ambicja' : 'Ambition'}
        </div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
          {ambitionStatement?.trim()
            ? ambitionStatement
            : isPolish
              ? 'Nazwij ambicję jednym zdaniem'
              : 'Name the ambition in one sentence'}
        </div>
      </div>

      {safeThemes.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {isPolish
            ? 'Brak motywów do pokazania. Rozłóż ambicję na motywy strategiczne z celem i horyzontem.'
            : 'No themes to show yet. Decompose the ambition into strategic themes with a target and horizon.'}
        </div>
      ) : (
        <>
          {/* Connector dropping from the ambition into the themes below. */}
          <div className="mx-auto h-3 w-px bg-violet-300 dark:bg-violet-700/60" />

          {/* Themes grouped and sorted by horizon (short → medium → long). */}
          <div className="space-y-3">
            {AMBITION_HORIZON_ORDER.map((horizon) => {
              const group = safeThemes
                .filter((theme) => theme.horizon === horizon)
                .sort(
                  (a, b) =>
                    AMBITION_IMPORTANCE_RANK[a.importance] -
                    AMBITION_IMPORTANCE_RANK[b.importance]
                );
              if (group.length === 0) return null;
              return (
                <div key={horizon}>
                  <div
                    className={`mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${ambitionHorizonTone[horizon]}`}
                  >
                    {ambitionHorizonLabel(horizon, isPolish)}
                    <span className="ml-1.5 font-normal text-slate-400">{group.length}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.map((theme) => (
                      <div
                        key={theme.id}
                        className={`rounded-xl border p-2.5 ${ambitionImportanceTone[theme.importance]}`}
                        title={`${isPolish ? 'Istotność' : 'Importance'}: ${ambitionImportanceLabel(
                          theme.importance,
                          isPolish
                        )}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ambitionImportanceDot[theme.importance]}`}
                          />
                          <div className="min-w-0">
                            <div
                              className="truncate text-[12px] font-semibold text-slate-900 dark:text-white"
                              title={theme.title}
                            >
                              {theme.title}
                            </div>
                            {theme.targetValue || theme.targetMetric ? (
                              <div className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                {[theme.targetValue, theme.targetMetric]
                                  .filter((part) => Boolean(part && part.trim()))
                                  .join(' · ')}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Importance legend. */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ['high', isPolish ? 'Wysoka istotność' : 'High importance'],
                ['medium', isPolish ? 'Średnia istotność' : 'Medium importance'],
                ['low', isPolish ? 'Niska istotność' : 'Low importance'],
              ] as Array<[AmbitionTheme['importance'], string]>
            ).map(([importance, text]) => (
              <div key={importance} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${ambitionImportanceDot[importance]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Motywy pogrupowane wg horyzontu (krótki → długi), kolor chipa = istotność, podpis = cel i metryka.'
              : 'Themes grouped by horizon (short → long), chip color = importance, caption = target and metric.'}
          </div>
        </>
      )}
    </div>
  );
}

const focusRecommendationTone: Record<FocusPriority['recommendation'], string> = {
  pursue: 'bg-emerald-500',
  defer: 'bg-slate-400',
  drop: 'bg-amber-500',
};

const focusRecommendationLabel = (
  recommendation: FocusPriority['recommendation'],
  isPolish: boolean
): string => {
  if (isPolish) {
    return recommendation === 'pursue'
      ? 'Realizuj'
      : recommendation === 'defer'
        ? 'Odłóż'
        : 'Odpuść';
  }
  return recommendation === 'pursue' ? 'Pursue' : recommendation === 'defer' ? 'Defer' : 'Drop';
};

export function FocusTradeoffVisual({
  priorities,
  isPolish,
}: {
  priorities: FocusPriority[];
  isPolish: boolean;
}) {
  const safePriorities = priorities || [];

  // Quadrant guide labels: value (y) × effort (x), midpoint at score 3.
  const quadrants: Array<[string, string]> = isPolish
    ? [
        ['Quick wins', 'Wys. wartość, niski wysiłek'],
        ['Big bets', 'Wys. wartość, wysoki wysiłek'],
        ['Fill-ins', 'Nis. wartość, niski wysiłek'],
        ['Money pit', 'Nis. wartość, wysoki wysiłek'],
      ]
    : [
        ['Quick wins', 'High value, low effort'],
        ['Big bets', 'High value, high effort'],
        ['Fill-ins', 'Low value, low effort'],
        ['Money pit', 'Low value, high effort'],
      ];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {isPolish ? 'Macierz wartość x wysiłek' : 'Value x effort matrix'}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {isPolish ? 'Skala 1-5' : 'Scale 1-5'}
        </div>
      </div>

      {safePriorities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {isPolish
            ? 'Brak priorytetów do pokazania. Dodaj priorytety z oceną wartości i wysiłku, aby zobaczyć macierz.'
            : 'No priorities to show yet. Add priorities with value and effort scores to see the matrix.'}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {/* Vertical value-axis label */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 [writing-mode:vertical-rl] [transform:rotate(180deg)] dark:text-slate-400">
                {isPolish ? 'Wartość' : 'Value'}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="relative h-56 rounded-2xl bg-slate-50 dark:bg-navy-900">
                {/* Quadrant dividers at the midpoint */}
                <div className="absolute inset-x-1/2 top-0 h-full w-px bg-slate-200 dark:bg-navy-700" />
                <div className="absolute inset-y-1/2 left-0 h-px w-full bg-slate-200 dark:bg-navy-700" />

                {/* Quadrant guide labels */}
                <span className="absolute left-2 top-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-600/70 dark:text-emerald-300/70">
                  {quadrants[0][0]}
                </span>
                <span className="absolute right-2 top-1.5 text-right text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-600/70 dark:text-emerald-300/70">
                  {quadrants[1][0]}
                </span>
                <span className="absolute bottom-1.5 left-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {quadrants[2][0]}
                </span>
                <span className="absolute bottom-1.5 right-2 text-right text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-600/80 dark:text-amber-300/80">
                  {quadrants[3][0]}
                </span>

                {/* One bubble per priority: effort drives left (x), value drives bottom (y),
                    color drives recommendation. Scores clamped to 1-5 and mapped on a 0-6 span. */}
                {safePriorities.map((priority) => {
                  const value = Math.max(1, Math.min(5, priority.valueScore || 0));
                  const effort = Math.max(1, Math.min(5, priority.effortScore || 0));
                  return (
                    <div
                      key={priority.id}
                      className={`absolute flex h-6 w-6 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full text-[8px] font-bold text-white shadow ${focusRecommendationTone[priority.recommendation]}`}
                      style={{
                        left: `${(effort / 6) * 100}%`,
                        bottom: `${(value / 6) * 100}%`,
                      }}
                      title={`${priority.title} · ${
                        isPolish ? 'wartość' : 'value'
                      } ${value} / ${isPolish ? 'wysiłek' : 'effort'} ${effort} · ${focusRecommendationLabel(
                        priority.recommendation,
                        isPolish
                      )}`}
                    >
                      {value}/{effort}
                    </div>
                  );
                })}
              </div>

              {/* Horizontal effort-axis label */}
              <div className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {isPolish ? 'Wysiłek' : 'Effort'}
              </div>
            </div>
          </div>

          {/* Recommendation legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ['pursue', isPolish ? 'Realizuj' : 'Pursue'],
                ['defer', isPolish ? 'Odłóż' : 'Defer'],
                ['drop', isPolish ? 'Odpuść' : 'Drop'],
              ] as Array<[FocusPriority['recommendation'], string]>
            ).map(([reco, text]) => (
              <div key={reco} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${focusRecommendationTone[reco]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Pozycja = wartość (oś Y) i wysiłek (oś X), kolor bąbla = rekomendacja pursue/defer/drop.'
              : 'Position = value (y) and effort (x), bubble color = pursue/defer/drop recommendation.'}
          </div>
        </>
      )}
    </div>
  );
}

const narrativeResonanceColumn: Record<NarrativePillar['audienceResonance'], string> = {
  high: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-900/20',
  medium: 'border-slate-300 bg-slate-50 dark:border-navy-700 dark:bg-navy-900/40',
  low: 'border-slate-200 bg-slate-50/60 dark:border-navy-800 dark:bg-navy-900/20',
};

const narrativeResonanceDot: Record<NarrativePillar['audienceResonance'], string> = {
  high: 'bg-emerald-500',
  medium: 'bg-slate-400',
  low: 'bg-slate-300',
};

const narrativeResonanceLabel = (
  resonance: NarrativePillar['audienceResonance'],
  isPolish: boolean
): string => {
  if (isPolish) {
    return resonance === 'high' ? 'Wysoki' : resonance === 'medium' ? 'Średni' : 'Niski';
  }
  return resonance === 'high' ? 'High' : resonance === 'medium' ? 'Medium' : 'Low';
};

export function NarrativeArcVisual({
  pillars,
  coreMessage,
  isPolish,
}: {
  pillars: NarrativePillar[];
  coreMessage?: string;
  isPolish: boolean;
}) {
  const safePillars = pillars || [];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {isPolish ? 'Dom komunikatu' : 'Message house'}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {isPolish ? 'Dach + filary' : 'Roof + pillars'}
        </div>
      </div>

      {/* Roof / apex: the single core message that the pillars hold up. */}
      <div className="rounded-t-2xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-center dark:border-emerald-700/60 dark:bg-emerald-900/20">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
          {isPolish ? 'Myśl przewodnia' : 'Core message'}
        </div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
          {coreMessage?.trim()
            ? coreMessage
            : isPolish
              ? 'Nazwij jedną myśl przewodnią'
              : 'Name one core message'}
        </div>
      </div>

      {safePillars.length === 0 ? (
        <>
          {/* Lintel under the roof even when there are no pillars yet. */}
          <div className="mx-auto h-1.5 w-[92%] bg-emerald-200 dark:bg-emerald-900/40" />
          <div className="rounded-b-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
            {isPolish
              ? 'Brak filarów do pokazania. Dodaj filary z twierdzeniem i dowodami, aby zbudować dom komunikatu.'
              : 'No pillars to show yet. Add pillars with a claim and proof points to build the message house.'}
          </div>
        </>
      ) : (
        <>
          {/* Lintel spanning the pillar columns below the roof. */}
          <div className="mx-auto h-1.5 w-[92%] bg-emerald-200 dark:bg-emerald-900/40" />

          {/* Each pillar is a column: title + claim + proof-point count, colored by resonance. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {safePillars.map((pillar) => (
              <div
                key={pillar.id}
                className={`flex min-h-[120px] flex-col rounded-b-xl border border-t-0 p-2.5 ${narrativeResonanceColumn[pillar.audienceResonance]}`}
                title={`${isPolish ? 'Rezonans' : 'Resonance'}: ${narrativeResonanceLabel(
                  pillar.audienceResonance,
                  isPolish
                )}`}
              >
                <div className="flex items-start gap-1.5">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${narrativeResonanceDot[pillar.audienceResonance]}`}
                  />
                  <div
                    className="text-[12px] font-semibold leading-tight text-slate-900 dark:text-white"
                    title={pillar.title}
                  >
                    {pillar.title}
                  </div>
                </div>
                {pillar.message?.trim() ? (
                  <div className="mt-1 flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                    {pillar.message}
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {(pillar.proofPoints || []).length} {isPolish ? 'dowody' : 'proof'}
                </div>
              </div>
            ))}
          </div>

          {/* Foundation slab the pillars rest on. */}
          <div className="mx-auto h-1.5 w-[96%] rounded-b-md bg-slate-300/70 dark:bg-navy-700" />

          {/* Resonance legend. */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ['high', isPolish ? 'Wysoki rezonans' : 'High resonance'],
                ['medium', isPolish ? 'Średni rezonans' : 'Medium resonance'],
                ['low', isPolish ? 'Niski rezonans' : 'Low resonance'],
              ] as Array<[NarrativePillar['audienceResonance'], string]>
            ).map(([resonance, text]) => (
              <div key={resonance} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${narrativeResonanceDot[resonance]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Dach = myśl przewodnia, kolumny = filary (twierdzenie + liczba dowodów), kolor = rezonans u odbiorcy.'
              : 'Roof = core message, columns = pillars (claim + proof count), color = audience resonance.'}
          </div>
        </>
      )}
    </div>
  );
}
