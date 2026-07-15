import React from 'react';
import { useTranslation } from 'react-i18next';

export function PortfolioPriorityLibraryGraphic({
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t } = useTranslation();
  const isExample = variant === 'example';
  const labels = {
    eyebrow: 'Portfolio Priority',
    title: isExample
      ? t('discoveryToolsMain.portfolioPriorityLibraryGraphic.titleExample')
      : t('discoveryToolsMain.portfolioPriorityLibraryGraphic.titleProcess'),
    subtitle: t('discoveryToolsMain.portfolioPriorityLibraryGraphic.subtitle'),
    mission: isExample
      ? t('discoveryToolsMain.portfolioPriorityLibraryGraphic.missionExample')
      : t('discoveryToolsMain.portfolioPriorityLibraryGraphic.missionProcess'),
    stages: ['Mission', 'Evidence', 'Portfolio cards', 'Trade-offs', 'Outputs'],
    quadrants: t('discoveryToolsMain.portfolioPriorityLibraryGraphic.quadrants', {
      returnObjects: true,
    }) as Array<[string, string]>,
    insight: t('discoveryToolsMain.portfolioPriorityLibraryGraphic.insight'),
    output: t('discoveryToolsMain.portfolioPriorityLibraryGraphic.output'),
  };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.14),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(251,191,36,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(251,191,36,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300">
          {labels.eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950 dark:text-white">
          {labels.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-pink-200/70 bg-pink-500/5 p-4 dark:border-pink-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-700 dark:text-pink-300">
              Portfolio mission
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
              {labels.mission}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="space-y-2">
              {labels.stages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-600 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {stage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {labels.quadrants.map(([title, text], index) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-700 dark:bg-pink-950/40 dark:text-pink-200">
                    B{index + 1}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {text}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Resource trade-offs
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {labels.insight}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.output}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PortfolioPriorityLibraryGraphic;
