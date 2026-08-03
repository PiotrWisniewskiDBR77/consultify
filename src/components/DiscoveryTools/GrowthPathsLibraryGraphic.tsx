import React from 'react';
import { useTranslation } from 'react-i18next';

export function GrowthPathsLibraryGraphic({
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t } = useTranslation();
  const isExample = variant === 'example';
  const labels = {
    eyebrow: 'Growth Paths',
    title: isExample
      ? t('discoveryToolsMain.growthPathsLibraryGraphic.titleExample')
      : t('discoveryToolsMain.growthPathsLibraryGraphic.titleProcess'),
    subtitle: t('discoveryToolsMain.growthPathsLibraryGraphic.subtitle'),
    mission: isExample
      ? t('discoveryToolsMain.growthPathsLibraryGraphic.missionExample')
      : t('discoveryToolsMain.growthPathsLibraryGraphic.missionProcess'),
    stages: ['Mission', 'Evidence', 'Options', 'Comparison', 'Outputs'],
    quadrants: t('discoveryToolsMain.growthPathsLibraryGraphic.quadrants', {
      returnObjects: true,
    }) as Array<[string, string]>,
    insight: t('discoveryToolsMain.growthPathsLibraryGraphic.insight'),
    output: t('discoveryToolsMain.growthPathsLibraryGraphic.output'),
  };

  return (
    <div className="overflow-hidden rounded-[30px] border border-c-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.12),transparent_22%),linear-gradient(180deg,var(--c-bg),var(--c-surface))]">
      <div className="border-b border-c-border-subtle px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-c-info">
          {labels.eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight text-c-text">{labels.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-c-text-secondary">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-c-info/30 bg-c-info/5 p-4 dark:border-c-info/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-info">
              Growth mission
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-c-text">{labels.mission}</p>
          </div>
          <div className="rounded-2xl border border-c-border-subtle bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="space-y-2">
              {labels.stages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-center gap-3 rounded-xl bg-c-surface-raised p-3"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-c-text text-xs font-bold text-c-bg">
                    {index + 1}
                  </div>
                  <div className="text-sm font-semibold text-c-text">{stage}</div>
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
                className="rounded-2xl border border-c-border-subtle bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-c-text">{title}</div>
                  <span className="rounded-full bg-c-info/10 px-2 py-0.5 text-[10px] font-bold text-c-info">
                    Q{index + 1}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-relaxed text-c-text-secondary">{text}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Strategic comparison
            </div>
            <p className="mt-2 text-sm leading-relaxed text-c-text-secondary">{labels.insight}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.output}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GrowthPathsLibraryGraphic;
