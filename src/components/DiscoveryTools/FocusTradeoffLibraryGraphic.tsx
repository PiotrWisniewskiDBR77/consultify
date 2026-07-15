import React from 'react';
import { useTranslation } from 'react-i18next';

export function FocusTradeoffLibraryGraphic({
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t } = useTranslation();
  const isExample = variant === 'example';
  const ns = 'discoveryToolsMain.focusTradeoffLibraryGraphic';
  const labels = {
    eyebrow: 'Focus & Trade-offs',
    title: isExample ? t(`${ns}.titleExample`) : t(`${ns}.titleProcess`),
    subtitle: isExample ? t(`${ns}.subtitleExample`) : t(`${ns}.subtitleProcess`),
    scenario: isExample ? t(`${ns}.scenarioLabelExample`) : t(`${ns}.scenarioLabelProcess`),
    scenarioValue: isExample ? t(`${ns}.scenarioValueExample`) : t(`${ns}.scenarioValueProcess`),
    decision: isExample ? t(`${ns}.decisionLabelExample`) : t(`${ns}.decisionLabelProcess`),
    decisionValue: isExample ? t(`${ns}.decisionValueExample`) : t(`${ns}.decisionValueProcess`),
    stagesTitle: isExample ? t(`${ns}.stagesTitleExample`) : t(`${ns}.stagesTitleProcess`),
    stages: t(`${ns}.stages`, { returnObjects: true }) as Array<[string, string, string]>,
    matrixTitle: t(`${ns}.matrixTitle`),
    scaleHint: t(`${ns}.scaleHint`),
    axisValue: t(`${ns}.axisValue`),
    axisEffort: t(`${ns}.axisEffort`),
    quadrants: t(`${ns}.quadrants`, { returnObjects: true }) as Array<[string, string]>,
    legendTitle: t(`${ns}.legendTitle`),
    legend: t(`${ns}.legend`, { returnObjects: true }) as Array<[string, string]>,
    footer: t(`${ns}.footer`),
  };

  // Static decorative priorities for the value x effort matrix (value 1-5, effort 1-5).
  const bubbles = t(`${ns}.bubbles`, { returnObjects: true }) as Array<{
    label: string;
    value: number;
    effort: number;
    recommendation: 'pursue' | 'defer' | 'drop';
  }>;

  const recoTone: Record<'pursue' | 'defer' | 'drop', string> = {
    pursue: 'bg-emerald-500',
    defer: 'bg-slate-400',
    drop: 'bg-amber-500',
  };
  const legendDot: Record<string, string> = {
    pursue: 'bg-emerald-500',
    defer: 'bg-slate-400',
    drop: 'bg-amber-500',
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
                {labels.matrixTitle}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {labels.scaleHint}
              </div>
            </div>

            {/* Value (y) × effort (x) 2x2 plot. Value axis is the vertical label on the left,
                effort axis is the horizontal label under the plot. Bubbles are positioned by
                effort (x) and value (y), colored by recommendation. */}
            <div className="mt-3 flex gap-2">
              {/* Vertical value-axis label */}
              <div className="flex items-center">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 [writing-mode:vertical-rl] [transform:rotate(180deg)] dark:text-slate-400">
                  {labels.axisValue}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="relative aspect-[4/3] w-full rounded-xl bg-slate-50 dark:bg-navy-900">
                  {/* Quadrant dividers at the 50% lines */}
                  <div className="absolute inset-x-1/2 top-0 h-full w-px bg-slate-200 dark:bg-navy-700" />
                  <div className="absolute inset-y-1/2 left-0 h-px w-full bg-slate-200 dark:bg-navy-700" />

                  {/* Quadrant guide labels: top-left=quick wins, top-right=big bets,
                      bottom-left=fill-ins, bottom-right=money pit */}
                  <span className="absolute left-2 top-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-600/70 dark:text-emerald-300/70">
                    {labels.quadrants[0][0]}
                  </span>
                  <span className="absolute right-2 top-1.5 text-right text-[8px] font-semibold uppercase tracking-[0.1em] text-emerald-600/70 dark:text-emerald-300/70">
                    {labels.quadrants[1][0]}
                  </span>
                  <span className="absolute bottom-1.5 left-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {labels.quadrants[2][0]}
                  </span>
                  <span className="absolute bottom-1.5 right-2 text-right text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-600/80 dark:text-amber-300/80">
                    {labels.quadrants[3][0]}
                  </span>

                  {/* Bubbles: value drives bottom (y), effort drives left (x). */}
                  {bubbles.map((bubble) => (
                    <div
                      key={bubble.label}
                      className={`absolute flex -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full text-[8px] font-bold text-white shadow ${recoTone[bubble.recommendation]}`}
                      style={{
                        left: `${(bubble.effort / 6) * 100}%`,
                        bottom: `${(bubble.value / 6) * 100}%`,
                        width: '26px',
                        height: '26px',
                      }}
                      title={`${bubble.label} · ${labels.axisValue} ${bubble.value} / ${labels.axisEffort} ${bubble.effort}`}
                    >
                      {bubble.value}/{bubble.effort}
                    </div>
                  ))}
                </div>

                {/* Horizontal effort-axis label */}
                <div className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {labels.axisEffort}
                </div>
              </div>
            </div>

            {/* Recommendation legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {labels.legend.map(([reco, text]) => (
                <div key={reco} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${legendDot[reco]}`} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              {labels.legendTitle}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {labels.quadrants.map(([name, hint]) => (
                <div key={name}>
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white">
                    {name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</div>
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

export default FocusTradeoffLibraryGraphic;
