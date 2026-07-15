import React from 'react';
import { useTranslation } from 'react-i18next';

export function MarketForcesLibraryGraphic({
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t } = useTranslation();
  const isExample = variant === 'example';
  const ns = 'discoveryToolsMain.marketForcesLibraryGraphic';
  const labels = {
    eyebrow: 'Market Forces',
    title: isExample ? t(`${ns}.titleExample`) : t(`${ns}.titleProcess`),
    subtitle: isExample ? t(`${ns}.subtitleExample`) : t(`${ns}.subtitleProcess`),
    scenario: isExample ? t(`${ns}.scenarioLabelExample`) : t(`${ns}.scenarioLabelProcess`),
    scenarioValue: isExample ? t(`${ns}.scenarioValueExample`) : t(`${ns}.scenarioValueProcess`),
    decision: isExample ? t(`${ns}.decisionLabelExample`) : t(`${ns}.decisionLabelProcess`),
    decisionValue: isExample ? t(`${ns}.decisionValueExample`) : t(`${ns}.decisionValueProcess`),
    stagesTitle: isExample ? t(`${ns}.stagesTitleExample`) : t(`${ns}.stagesTitleProcess`),
    stage1: 'Market brief',
    stage1Value: t(`${ns}.stage1Value`),
    stage2: 'Market signals',
    stage2Value: t(`${ns}.stage2Value`),
    stage3: 'Five Forces',
    stage3Value: t(`${ns}.stage3Value`),
    stage4: 'Implications',
    stage4Value: t(`${ns}.stage4Value`),
    stage5: 'Moves & outputs',
    stage5Value: t(`${ns}.stage5Value`),
    forcesTitle: t(`${ns}.forcesTitle`),
    implicationsTitle: t(`${ns}.implicationsTitle`),
    movesTitle: t(`${ns}.movesTitle`),
    forces: t(`${ns}.forces`, { returnObjects: true }) as Array<[string, string, string]>,
    implicationItems: t(`${ns}.implicationItems`, { returnObjects: true }) as string[],
    moveItems: t(`${ns}.moveItems`, { returnObjects: true }) as string[],
    legend: 'Market Forces = brief -> signals -> forces -> implications -> moves -> outputs',
  };

  const stages = [
    [labels.stage1, labels.stage1Value, 'bg-sky-500'],
    [labels.stage2, labels.stage2Value, 'bg-sky-500'],
    [labels.stage3, labels.stage3Value, 'bg-blue-500'],
    [labels.stage4, labels.stage4Value, 'bg-amber-500'],
    [labels.stage5, labels.stage5Value, 'bg-emerald-500'],
  ];

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
          {labels.eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950 dark:text-white">
          {labels.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.scenario}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {labels.scenarioValue}
            </p>
            <div className="mt-4 rounded-xl border border-blue-200/70 bg-blue-500/5 p-3 dark:border-blue-900/40">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
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
              {stages.map(([title, value, accent], index) => (
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
          <div className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
              {labels.forcesTitle}
            </div>
            <div className="space-y-2">
              {labels.forces.map(([name, score, note]) => (
                <div key={name} className="rounded-xl bg-white/75 p-3 dark:bg-navy-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {name}
                    </span>
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {score}
                    </span>
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                {labels.implicationsTitle}
              </div>
              {labels.implicationItems.map((item) => (
                <p
                  key={item}
                  className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                >
                  {item}
                </p>
              ))}
            </div>

            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {labels.movesTitle}
              </div>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {labels.moveItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70 px-5 py-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
        {labels.legend}
      </div>
    </div>
  );
}

export default MarketForcesLibraryGraphic;
