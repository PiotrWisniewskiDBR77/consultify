import React from 'react';
import { useTranslation } from 'react-i18next';

export function CapabilityMapperLibraryGraphic({
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t } = useTranslation();
  const isExample = variant === 'example';
  const ns = 'discoveryToolsMain.capabilityMapperLibraryGraphic';
  const labels = {
    eyebrow: 'Capability Mapper',
    title: isExample ? t(`${ns}.titleExample`) : t(`${ns}.titleProcess`),
    subtitle: isExample ? t(`${ns}.subtitleExample`) : t(`${ns}.subtitleProcess`),
    scenario: isExample ? t(`${ns}.scenarioLabelExample`) : t(`${ns}.scenarioLabelProcess`),
    scenarioValue: isExample ? t(`${ns}.scenarioValueExample`) : t(`${ns}.scenarioValueProcess`),
    decision: isExample ? t(`${ns}.decisionLabelExample`) : t(`${ns}.decisionLabelProcess`),
    decisionValue: isExample ? t(`${ns}.decisionValueExample`) : t(`${ns}.decisionValueProcess`),
    stagesTitle: isExample ? t(`${ns}.stagesTitleExample`) : t(`${ns}.stagesTitleProcess`),
    stages: t(`${ns}.stages`, { returnObjects: true }) as Array<[string, string, string]>,
    ladderTitle: t(`${ns}.ladderTitle`),
    scaleHint: t(`${ns}.scaleHint`),
    legendTitle: t(`${ns}.legendTitle`),
    legend: t(`${ns}.legend`, { returnObjects: true }) as Array<[string, string]>,
    currentLabel: t(`${ns}.currentLabel`),
    targetLabel: t(`${ns}.targetLabel`),
    footer: t(`${ns}.footer`),
  };

  // Static decorative capability rows for the maturity ladder (current → target on a 1-5 scale).
  const rows = t(`${ns}.rows`, { returnObjects: true }) as Array<{
    name: string;
    current: number;
    target: number;
    gap: 'critical' | 'moderate' | 'minor';
  }>;

  const gapTone: Record<'critical' | 'moderate' | 'minor', string> = {
    critical: 'bg-amber-500',
    moderate: 'bg-slate-400',
    minor: 'bg-emerald-500',
  };
  const legendDot: Record<string, string> = {
    critical: 'bg-amber-500',
    moderate: 'bg-slate-400',
    minor: 'bg-emerald-500',
  };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(245,158,11,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(245,158,11,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          {labels.eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950 dark:text-white">
          {labels.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.scenario}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {labels.scenarioValue}
            </p>
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-500/5 p-3 dark:border-emerald-900/40">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {labels.decision}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                {labels.decisionValue}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.stagesTitle}
            </div>
            <div className="space-y-2">
              {labels.stages.map(([title, value, accent], index) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent} text-xs font-bold text-white`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {labels.ladderTitle}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {labels.scaleHint}
              </div>
            </div>

            {/* Maturity ladder: each capability row shows a current→target track on a 1-5 scale.
                The filled segment runs from current to target; the marker shows the current level. */}
            <div className="mt-3 space-y-2.5">
              {rows.map((row) => {
                const currentPct = (row.current / 5) * 100;
                const targetPct = (row.target / 5) * 100;
                return (
                  <div key={row.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {row.current} → {row.target}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full bg-slate-200/70 dark:bg-navy-800">
                      {/* Gap fill from current to target */}
                      <div
                        className={`absolute top-0 h-3 rounded-full ${gapTone[row.gap]}`}
                        style={{ left: `${currentPct}%`, width: `${targetPct - currentPct}%` }}
                      />
                      {/* Current-maturity marker */}
                      <div
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-700 shadow dark:border-navy-950"
                        style={{ left: `${currentPct}%` }}
                        title={`${labels.currentLabel}: ${row.current}`}
                      />
                      {/* Target-maturity marker */}
                      <div
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow dark:border-navy-950"
                        style={{ left: `${targetPct}%` }}
                        title={`${labels.targetLabel}: ${row.target}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* current / target marker legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-700 shadow-sm dark:border-navy-950" />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  {labels.currentLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-600 shadow-sm dark:border-navy-950" />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  {labels.targetLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              {labels.legendTitle}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {labels.legend.map(([gap, text]) => (
                <div key={gap} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${legendDot[gap]}`} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CapabilityMapperLibraryGraphic;
