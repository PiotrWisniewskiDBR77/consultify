import React from 'react';

export function FocusTradeoffLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Focus & Trade-offs',
        title: isExample
          ? 'Przykład: od konkurujących priorytetów do ruchów pursue/defer/drop'
          : 'Jak Focus & Trade-offs prowadzi od wartości i wysiłku do decyzji',
        subtitle: isExample
          ? 'Ten case pokazuje, że priorytetyzacja to nie ranking życzeń. Najpierw waży wartość i wysiłek każdej opcji, mapuje je na macierz, a dopiero potem rekomenduje, co realizować, co odłożyć, a co odpuścić.'
          : 'To nie lista życzeń posortowana intuicją. Najpierw ustawiamy konkurujące priorytety i kryteria decyzji, oceniamy wartość vs wysiłek na skali 1-5, mapujemy je na macierz i zamieniamy pozycje w ruchy pursue/defer/drop.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Zespół ma więcej inicjatyw niż mocy przerobowych i każdy broni swojej. Pytanie brzmi: które dają najwięcej wartości przy najmniejszym wysiłku, a które tylko drenują zespół.'
          : 'Sesja startuje od konkurujących priorytetów, kryteriów decyzji, celu i ograniczeń. Bez tego ocena wartości i wysiłku jest oderwana od strategii.',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Które priorytety realizować teraz, a które świadomie odłożyć lub odpuścić?'
          : 'Ocena wartości vs wysiłku każdego priorytetu, pozycja na macierzy 2x2 oraz ruchy pursue/defer/drop gotowe do dalszej pracy.',
        stagesTitle: '5 kroków pracy',
        stages: [
          ['Brief', 'Priorytety, kryteria, cel, ograniczenia', 'bg-sky-500'],
          ['Priorytety', 'Lista konkurujących opcji', 'bg-sky-500'],
          ['Ocena', 'Wartość vs wysiłek 1-5 + dopasowanie', 'bg-blue-500'],
          ['Macierz', 'Quick wins, big bets, fill-ins, money pit', 'bg-amber-500'],
          ['Ruchy & outputy', 'Pursue/defer/drop, inicjatywy, raport, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        matrixTitle: 'Macierz wartość x wysiłek',
        scaleHint: 'Skala 1-5',
        axisValue: 'Wartość',
        axisEffort: 'Wysiłek',
        quadrants: [
          ['Quick wins', 'Wys. wartość, niski wysiłek'],
          ['Big bets', 'Wys. wartość, wysoki wysiłek'],
          ['Fill-ins', 'Nis. wartość, niski wysiłek'],
          ['Money pit', 'Nis. wartość, wysoki wysiłek'],
        ] as Array<[string, string]>,
        legendTitle: 'Rekomendacja',
        legend: [
          ['pursue', 'Realizuj (pursue)'],
          ['defer', 'Odłóż (defer)'],
          ['drop', 'Odpuść (drop)'],
        ] as Array<[string, string]>,
        footer:
          'Focus & Trade-offs = brief -> priorytety -> wartość vs wysiłek -> macierz -> ruchy -> outputy',
      }
    : {
        eyebrow: 'Focus & Trade-offs',
        title: isExample
          ? 'Example: from competing priorities to pursue/defer/drop moves'
          : 'How Focus & Trade-offs moves from value and effort to decisions',
        subtitle: isExample
          ? 'This case shows that prioritization is not a wishlist ranking. It weighs the value and effort of each option first, maps them onto a matrix, and only then recommends what to pursue, defer, or drop.'
          : 'This is not a wishlist sorted by gut feel. First we frame competing priorities and decision criteria, score value vs effort on a 1-5 scale, map them onto a matrix, and translate positions into pursue/defer/drop moves.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'A team has more initiatives than capacity and everyone defends their own. The real question is which deliver the most value for the least effort and which only drain the team.'
          : 'The session starts with competing priorities, decision criteria, the goal, and constraints. Without that, value and effort scoring is detached from strategy.',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Which priorities do we pursue now, and which do we deliberately defer or drop?'
          : "Each priority's value vs effort score, its position on the 2x2 matrix, and pursue/defer/drop moves ready for downstream work.",
        stagesTitle: '5 working steps',
        stages: [
          ['Brief', 'Priorities, criteria, goal, constraints', 'bg-sky-500'],
          ['Priorities', 'List of competing options', 'bg-sky-500'],
          ['Scoring', 'Value vs effort 1-5 + fit', 'bg-blue-500'],
          ['Matrix', 'Quick wins, big bets, fill-ins, money pit', 'bg-amber-500'],
          ['Moves & outputs', 'Pursue/defer/drop, initiatives, report, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        matrixTitle: 'Value x effort matrix',
        scaleHint: 'Scale 1-5',
        axisValue: 'Value',
        axisEffort: 'Effort',
        quadrants: [
          ['Quick wins', 'High value, low effort'],
          ['Big bets', 'High value, high effort'],
          ['Fill-ins', 'Low value, low effort'],
          ['Money pit', 'Low value, high effort'],
        ] as Array<[string, string]>,
        legendTitle: 'Recommendation',
        legend: [
          ['pursue', 'Pursue'],
          ['defer', 'Defer'],
          ['drop', 'Drop'],
        ] as Array<[string, string]>,
        footer:
          'Focus & Trade-offs = brief -> priorities -> value vs effort -> matrix -> moves -> outputs',
      };

  // Static decorative priorities for the value x effort matrix (value 1-5, effort 1-5).
  const bubbles: Array<{
    label: string;
    value: number;
    effort: number;
    recommendation: 'pursue' | 'defer' | 'drop';
  }> = isPolish
    ? [
        { label: 'Pilot AI w obsłudze', value: 5, effort: 2, recommendation: 'pursue' },
        { label: 'Nowa platforma danych', value: 5, effort: 5, recommendation: 'pursue' },
        { label: 'Porządki w raportach', value: 2, effort: 2, recommendation: 'defer' },
        { label: 'Pełna migracja ERP', value: 2, effort: 5, recommendation: 'drop' },
      ]
    : [
        { label: 'AI support pilot', value: 5, effort: 2, recommendation: 'pursue' },
        { label: 'New data platform', value: 5, effort: 5, recommendation: 'pursue' },
        { label: 'Report cleanup', value: 2, effort: 2, recommendation: 'defer' },
        { label: 'Full ERP migration', value: 2, effort: 5, recommendation: 'drop' },
      ];

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
