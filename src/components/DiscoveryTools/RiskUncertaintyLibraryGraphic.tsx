import React from 'react';

export function RiskUncertaintyLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Risk & Uncertainty',
        title: isExample
          ? 'Przykład: od niepewności do ruchów odporności'
          : 'Jak Risk & Uncertainty prowadzi od sygnałów do zabezpieczeń',
        subtitle:
          'Narzędzie nie tworzy listy strachów. Zbiera sygnały, buduje założenia, ryzyka i scenariusze, wymaga akceptacji kart i dopiero potem rekomenduje walidację, mitygację, monitoring i eskalację.',
        mission: isExample
          ? 'Jak zabezpieczyć transformację przed opóźnieniami, presją kosztów i zmianą popytu?'
          : 'Risk mission, scope, success signal i constraints',
        stages: ['Mission', 'Evidence', 'Risk map', 'Synthesis', 'Outputs'],
        cards: [
          ['Assumptions', 'Co musi być prawdą, żeby strategia działała'],
          ['Risks', 'Co może uderzyć w wynik, koszt, czas lub reputację'],
          ['Scenarios', 'Jak różne przyszłości zmieniają decyzję'],
          ['Moves', 'Validate, mitigate, monitor, hedge, escalate'],
        ],
        output: 'Source summary -> resilience initiatives -> risk deck -> report',
      }
    : {
        eyebrow: 'Risk & Uncertainty',
        title: isExample
          ? 'Example: from uncertainty to resilience moves'
          : 'How Risk & Uncertainty moves from signals to safeguards',
        subtitle:
          'The tool does not produce a fear list. It captures signals, builds assumptions, risks, and scenarios, requires card approval, and only then recommends validation, mitigation, monitoring, and escalation.',
        mission: isExample
          ? 'How do we protect a transformation from delays, cost pressure, and demand shifts?'
          : 'Risk mission, scope, success signal, and constraints',
        stages: ['Mission', 'Evidence', 'Risk map', 'Synthesis', 'Outputs'],
        cards: [
          ['Assumptions', 'What must be true for the strategy to work'],
          ['Risks', 'What can hit outcome, cost, timing, or reputation'],
          ['Scenarios', 'How different futures change the decision'],
          ['Moves', 'Validate, mitigate, monitor, hedge, escalate'],
        ],
        output: 'Source summary -> resilience initiatives -> risk deck -> report',
      };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(239,68,68,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-c-border-subtle dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(239,68,68,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-c-border-subtle">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">
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
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Risk mission
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-xs font-bold text-white">
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
            {labels.cards.map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
                <div className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {text}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.output}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskUncertaintyLibraryGraphic;
