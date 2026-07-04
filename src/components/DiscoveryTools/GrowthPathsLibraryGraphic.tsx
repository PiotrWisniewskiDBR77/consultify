import React from 'react';

export function GrowthPathsLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Growth Paths',
        title: isExample
          ? 'Przykład: od ambicji wzrostu do sekwencji ruchów'
          : 'Jak Growth Paths prowadzi od ambicji do wyboru ścieżki',
        subtitle:
          'Ansoff nie jest listą pomysłów. Najpierw ustawia ambicję i sygnały, potem buduje opcje w czterech polach, porównuje trade-offy i dopiero wtedy przechodzi do ruchów oraz inicjatyw.',
        mission: isExample
          ? 'Jak zwiększyć przychód w segmencie premium bez rozmycia marży?'
          : 'Growth mission, scope, success signal i constraints',
        stages: ['Mission', 'Evidence', 'Options', 'Comparison', 'Outputs'],
        quadrants: [
          ['Penetracja rynku', 'Lepsze wykorzystanie obecnego segmentu i kanałów'],
          ['Rozwój rynku', 'Wejście do nowych segmentów lub geografii'],
          ['Rozwój produktu', 'Nowe propozycje wartości dla obecnych klientów'],
          ['Dywersyfikacja', 'Nowy produkt i nowy rynek, najwyższe ryzyko'],
        ],
        insight:
          'Rekomendacja nie wynika z największej liczby pomysłów, tylko z najlepszej sekwencji: skaluj core, przetestuj nowy segment, dopiero potem zwiększ ryzyko.',
        output: 'Source summary -> inicjatywa -> deck -> raport',
      }
    : {
        eyebrow: 'Growth Paths',
        title: isExample
          ? 'Example: from growth ambition to a move sequence'
          : 'How Growth Paths moves from ambition to path selection',
        subtitle:
          'Ansoff is not an idea list. It frames ambition and evidence first, builds options across four fields, compares trade-offs, and only then moves into actions and initiatives.',
        mission: isExample
          ? 'How do we grow premium-segment revenue without diluting margin?'
          : 'Growth mission, scope, success signal, and constraints',
        stages: ['Mission', 'Evidence', 'Options', 'Comparison', 'Outputs'],
        quadrants: [
          ['Market penetration', 'Use the current segment and channels better'],
          ['Market development', 'Enter new segments or geographies'],
          ['Product development', 'New value propositions for current customers'],
          ['Diversification', 'New product and new market, highest risk'],
        ],
        insight:
          'The recommendation does not come from the longest idea list, but from the best sequence: scale core, test the new segment, then increase risk.',
        output: 'Source summary -> initiative -> deck -> report',
      };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-c-border-subtle dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-c-border-subtle">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-600 dark:text-primary-300">
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
          <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              Growth mission
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
              {labels.mission}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]">
            <div className="space-y-2">
              {labels.stages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white">
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
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-950/40 dark:text-primary-200">
                    Q{index + 1}
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
              Strategic comparison
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

export default GrowthPathsLibraryGraphic;
