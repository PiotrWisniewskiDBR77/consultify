import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  SWOTItem,
  ValueActivity,
  ValueActivityId,
  ValueChainData,
} from '@/store/useToolStore';

const cardClass =
  'rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-navy-700 dark:bg-navy-950/60';

export function SwotMatrixVisual({
  data,
  isPolish,
  onUpdateItem,
  renderItemControls,
}: {
  data: SWOTData;
  isPolish: boolean;
  onUpdateItem?: (itemId: string, text: string) => void;
  renderItemControls?: (item: SWOTItem) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const quadrants = [
    [
      'strengths',
      t('discoveryToolsSteps.strategicCanvasVisuals.swotMatrix.strengths'),
      'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200',
    ],
    [
      'weaknesses',
      t('discoveryToolsSteps.strategicCanvasVisuals.swotMatrix.weaknesses'),
      'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200',
    ],
    [
      'opportunities',
      t('discoveryToolsSteps.strategicCanvasVisuals.swotMatrix.opportunities'),
      'border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-200',
    ],
    [
      'threats',
      t('discoveryToolsSteps.strategicCanvasVisuals.swotMatrix.threats'),
      'border-danger-200 bg-danger-50/80 text-danger-800 dark:border-danger-900/50 dark:bg-danger-950/25 dark:text-danger-200',
    ],
  ] as const;
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-950/60">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-navy-700">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
          {isPolish ? 'Finalna macierz SWOT' : 'Final SWOT matrix'}
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zwięzłe, gotowe do prezentacji stwierdzenia z widocznym kontekstem źródłowym.'
            : 'Concise, presentation-ready statements with visible source context.'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {quadrants.map(([id, label, tone], quadrantIndex) => {
          const items = (data.items || []).filter(
            (item) =>
              item.quadrant === id &&
              item.status !== 'proposed' &&
              item.proposalStatus !== 'ai-proposed'
          );
          return (
            <section
              key={id}
              aria-labelledby={`swot-matrix-${id}`}
              className={`min-h-56 border p-5 ${tone} ${quadrantIndex % 2 === 0 ? 'md:border-r' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 id={`swot-matrix-${id}`} className="text-sm font-semibold">
                  {label}
                </h3>
                <span className="text-xs font-semibold tabular-nums">{items.length}/5</span>
              </div>
              {items.length === 0 ? (
                <p className="mt-8 rounded-xl border-2 border-dashed border-white/70 bg-white/40 p-5 text-center text-sm opacity-70 dark:bg-navy-950/30">
                  {t('discoveryToolsTools.dynamicSwot.buildPhase.noPoints')}
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {items.slice(0, 5).map((item, index) => {
                    const linkedSources = (item.linkedSignalIds || [])
                      .map(
                        (signalId) =>
                          data.signals?.find((signal) => signal.id === signalId)?.sourceLabel
                      )
                      .filter((source): source is string => Boolean(source));
                    const sourceContext = item.evidenceSource || linkedSources.join(', ');
                    return (
                      <li
                        key={item.id}
                        className="rounded-xl border border-current/15 bg-white/70 p-3 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 text-xs font-bold opacity-60">{index + 1}.</span>
                          <textarea
                            value={item.text}
                            onChange={(event) => onUpdateItem?.(item.id, event.target.value)}
                            readOnly={!onUpdateItem}
                            rows={2}
                            aria-label={`${label} ${index + 1}`}
                            className="min-h-12 w-full resize-y bg-transparent text-sm font-medium leading-relaxed text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:text-slate-100"
                          />
                        </div>
                        {renderItemControls?.(item)}
                        <div className="mt-2 space-y-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                          <div>
                            {item.source === 'ai'
                              ? isPolish
                                ? 'Propozycja AI · zaakceptowana przez człowieka'
                                : 'AI proposal · human accepted'
                              : isPolish
                                ? 'Wpis konsultanta'
                                : 'Consultant entry'}
                          </div>
                          <div>
                            {sourceContext
                              ? `${isPolish ? 'Źródło' : 'Source'}: ${sourceContext}`
                              : isPolish
                                ? 'Źródło: deklaracja bez referencji'
                                : 'Source: declaration without a reference'}
                            {item.evidenceStatus
                              ? ` · ${isPolish ? 'status dowodu' : 'evidence status'}: ${item.evidenceStatus}`
                              : ''}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {items.length > 5 ? (
                <p role="alert" className="mt-3 text-xs font-semibold">
                  {isPolish
                    ? `Ta macierz zawiera ${items.length} stwierdzeń. Skróć listę do maksymalnie 5 przed finalizacją.`
                    : `This matrix contains ${items.length} statements. Reduce it to 5 before finalizing.`}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function PorterPentagonVisual({ data }: { data: PorterData; isPolish: boolean }) {
  const { t } = useTranslation();
  const forces = [
    ['rivalry', t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.rivalry')],
    ['newEntrants', t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.newEntrants')],
    ['substitutes', t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.substitutes')],
    ['buyerPower', t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.buyerPower')],
    ['supplierPower', t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.supplierPower')],
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
        {t('discoveryToolsSteps.strategicCanvasVisuals.porterPentagon.title')}
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

export function AnsoffMatrixVisual({ data }: { data: GrowthPathsData; isPolish: boolean }) {
  const { t } = useTranslation();
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
        {t('discoveryToolsSteps.strategicCanvasVisuals.ansoffMatrix.hint')}
      </div>
    </div>
  );
}

export function PortfolioBcgVisual({ data }: { data: PortfolioPriorityData; isPolish: boolean }) {
  const { t } = useTranslation();
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
        {t('discoveryToolsSteps.strategicCanvasVisuals.portfolioBcg.hint')}
      </div>
    </div>
  );
}

export function RiskMatrixVisual({ data }: { data: RiskUncertaintyData; isPolish: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cardClass}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
        {t('discoveryToolsSteps.strategicCanvasVisuals.riskMatrix.title')}
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
        {t('discoveryToolsSteps.strategicCanvasVisuals.riskMatrix.hint')}
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

const valueChainContributionLabel = (level: 'high' | 'medium' | 'low', t: TFunction): string => {
  const key =
    level === 'high'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.valueChain.contributionHigh'
      : level === 'medium'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.valueChain.contributionMedium'
        : 'discoveryToolsSteps.strategicCanvasVisuals.valueChain.contributionLow';
  return t(key);
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
  const { t } = useTranslation();
  const labelFor = (id: ValueActivityId): string => {
    const activity = activities?.[id];
    if (activity?.name) return activity.name;
    return isPolish ? VALUE_CHAIN_LABELS[id].pl : VALUE_CHAIN_LABELS[id].en;
  };

  const renderActivityMeta = (activity?: ValueActivity) => {
    if (!activity) return null;
    return (
      <span className="text-[9px] font-medium text-white/85">
        {`${t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.cost')} ${valueChainContributionLabel(
          activity.costContribution,
          t
        )} · ${t(
          'discoveryToolsSteps.strategicCanvasVisuals.valueChain.value'
        )} ${valueChainContributionLabel(activity.valueContribution, t)}`}
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
        {t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.title')}
      </div>

      <div className="flex items-stretch gap-1">
        <div className="min-w-0 flex-1">
          {/* Support activities — horizontal bands across the top */}
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.supportActivities')}
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
            {t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.primaryActivities')}
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
          {t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.margin')}
        </div>
      </div>

      {/* Margin-role legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ['creator', t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.createsMargin')],
            ['neutral', t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.neutral')],
            ['drain', t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.drainsMargin')],
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
              ? t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.costAdvantage')
              : positioningVerdict.positioning === 'differentiation'
                ? t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.differentiation')
                : t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.stuckInTheMiddle')}
          </span>
          {positioningVerdict.summary ? (
            <span className="ml-2 font-normal">{positioningVerdict.summary}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.strategicCanvasVisuals.valueChain.legendHint')}
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

const capabilityImportanceLabel = (importance: Capability['importance'], t: TFunction): string => {
  const key =
    importance === 'high'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.importanceHigh'
      : importance === 'medium'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.importanceMedium'
        : 'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.importanceLow';
  return t(key);
};

export function CapabilityMaturityVisual({
  capabilities,
}: {
  capabilities: Capability[];
  isPolish: boolean;
}) {
  const { t } = useTranslation();
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
          {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.title')}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.scale')}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.empty')}
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
                    title={`${t(
                      'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.weight'
                    )}: ${capabilityImportanceLabel(capability.importance, t)}`}
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
                      title={`${t(
                        'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.current'
                      )}: ${current}`}
                    />
                    {/* Target-maturity marker */}
                    <div
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow dark:border-navy-950"
                      style={{ left: `${(target / 5) * 100}%` }}
                      title={`${t(
                        'discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.target'
                      )}: ${target}`}
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
                {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.current')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 shadow-sm dark:border-navy-950" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.target')}
              </span>
            </div>
            {(
              [
                [
                  'critical',
                  t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.criticalGap'),
                ],
                [
                  'moderate',
                  t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.moderateGap'),
                ],
                [
                  'minor',
                  t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.minorGap'),
                ],
              ] as Array<[NonNullable<Capability['gapSize']>, string]>
            ).map(([gap, text]) => (
              <div key={gap} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${capabilityGapTone[gap]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.strategicCanvasVisuals.capabilityMaturity.hint')}
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

const ambitionHorizonLabel = (horizon: AmbitionTheme['horizon'], t: TFunction): string => {
  const key =
    horizon === 'short'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.horizonShort'
      : horizon === 'medium'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.horizonMedium'
        : 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.horizonLong';
  return t(key);
};

const ambitionImportanceLabel = (importance: AmbitionTheme['importance'], t: TFunction): string => {
  const key =
    importance === 'high'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.importanceHigh'
      : importance === 'medium'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.importanceMedium'
        : 'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.importanceLow';
  return t(key);
};

export function AmbitionDecompositionVisual({
  themes,
  ambitionStatement,
}: {
  themes: AmbitionTheme[];
  ambitionStatement?: string;
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const safeThemes = themes || [];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.title')}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.subtitle')}
        </div>
      </div>

      {/* Central ambition node sits at the top of the cascade. */}
      <div className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-center dark:border-violet-700/60 dark:bg-violet-900/20">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
          {t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.ambitionLabel')}
        </div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
          {ambitionStatement?.trim()
            ? ambitionStatement
            : t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.nameAmbition')}
        </div>
      </div>

      {safeThemes.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.empty')}
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
                    AMBITION_IMPORTANCE_RANK[a.importance] - AMBITION_IMPORTANCE_RANK[b.importance]
                );
              if (group.length === 0) return null;
              return (
                <div key={horizon}>
                  <div
                    className={`mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${ambitionHorizonTone[horizon]}`}
                  >
                    {ambitionHorizonLabel(horizon, t)}
                    <span className="ml-1.5 font-normal text-slate-400">{group.length}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.map((theme) => (
                      <div
                        key={theme.id}
                        className={`rounded-xl border p-2.5 ${ambitionImportanceTone[theme.importance]}`}
                        title={`${t(
                          'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.importanceLabel'
                        )}: ${ambitionImportanceLabel(theme.importance, t)}`}
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
                [
                  'high',
                  t(
                    'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.highImportance'
                  ),
                ],
                [
                  'medium',
                  t(
                    'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.mediumImportance'
                  ),
                ],
                [
                  'low',
                  t(
                    'discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.lowImportance'
                  ),
                ],
              ] as Array<[AmbitionTheme['importance'], string]>
            ).map(([importance, text]) => (
              <div key={importance} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${ambitionImportanceDot[importance]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.strategicCanvasVisuals.ambitionDecomposition.hint')}
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
  t: TFunction
): string => {
  const key =
    recommendation === 'pursue'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.pursue'
      : recommendation === 'defer'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.defer'
        : 'discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.drop';
  return t(key);
};

export function FocusTradeoffVisual({
  priorities,
}: {
  priorities: FocusPriority[];
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const safePriorities = priorities || [];

  // Quadrant guide labels: value (y) × effort (x), midpoint at score 3.
  const quadrants: Array<[string, string]> = [
    [
      'Quick wins',
      t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.quadrants.quickWins'),
    ],
    ['Big bets', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.quadrants.bigBets')],
    ['Fill-ins', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.quadrants.fillIns')],
    ['Money pit', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.quadrants.moneyPit')],
  ];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.title')}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.scale')}
        </div>
      </div>

      {safePriorities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
          {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.empty')}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {/* Vertical value-axis label */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 [writing-mode:vertical-rl] [transform:rotate(180deg)] dark:text-slate-400">
                {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.value')}
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
                      title={`${priority.title} · ${t(
                        'discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.value'
                      )} ${value} / ${t(
                        'discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.effort'
                      )} ${effort} · ${focusRecommendationLabel(priority.recommendation, t)}`}
                    >
                      {value}/{effort}
                    </div>
                  );
                })}
              </div>

              {/* Horizontal effort-axis label */}
              <div className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.effort')}
              </div>
            </div>
          </div>

          {/* Recommendation legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ['pursue', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.pursue')],
                ['defer', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.defer')],
                ['drop', t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.drop')],
              ] as Array<[FocusPriority['recommendation'], string]>
            ).map(([reco, text]) => (
              <div key={reco} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${focusRecommendationTone[reco]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.strategicCanvasVisuals.focusTradeoff.hint')}
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
  t: TFunction
): string => {
  const key =
    resonance === 'high'
      ? 'discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.resonanceHigh'
      : resonance === 'medium'
        ? 'discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.resonanceMedium'
        : 'discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.resonanceLow';
  return t(key);
};

export function NarrativeArcVisual({
  pillars,
  coreMessage,
}: {
  pillars: NarrativePillar[];
  coreMessage?: string;
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const safePillars = pillars || [];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.title')}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.subtitle')}
        </div>
      </div>

      {/* Roof / apex: the single core message that the pillars hold up. */}
      <div className="rounded-t-2xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-center dark:border-emerald-700/60 dark:bg-emerald-900/20">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
          {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.coreMessageLabel')}
        </div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
          {coreMessage?.trim()
            ? coreMessage
            : t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.nameCoreMessage')}
        </div>
      </div>

      {safePillars.length === 0 ? (
        <>
          {/* Lintel under the roof even when there are no pillars yet. */}
          <div className="mx-auto h-1.5 w-[92%] bg-emerald-200 dark:bg-emerald-900/40" />
          <div className="rounded-b-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-500">
            {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.empty')}
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
                title={`${t(
                  'discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.resonanceLabel'
                )}: ${narrativeResonanceLabel(pillar.audienceResonance, t)}`}
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
                  {(pillar.proofPoints || []).length}{' '}
                  {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.proof')}
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
                [
                  'high',
                  t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.highResonance'),
                ],
                [
                  'medium',
                  t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.mediumResonance'),
                ],
                ['low', t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.lowResonance')],
              ] as Array<[NarrativePillar['audienceResonance'], string]>
            ).map(([resonance, text]) => (
              <div key={resonance} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${narrativeResonanceDot[resonance]}`} />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('discoveryToolsSteps.strategicCanvasVisuals.narrativeArc.hint')}
          </div>
        </>
      )}
    </div>
  );
}
