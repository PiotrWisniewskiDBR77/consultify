import React from 'react';

export function AmbitionDecomposerLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Ambition Decomposer',
        title: isExample
          ? 'Przykład: jedna ambicja rozłożona na motywy strategiczne z celami i horyzontem'
          : 'Jak Ambition Decomposer rozkłada ambicję na mierzalne motywy',
        subtitle: isExample
          ? 'Ten case pokazuje, że ambicja to nie slogan. Najpierw nazywamy ją jednym zdaniem, a potem rozkładamy na motywy strategiczne, każdy z mierzalnym celem i horyzontem czasowym.'
          : 'To nie deklaracja na slajdzie. Najpierw ostro formułujemy ambicję, potem rozkładamy ją na motywy strategiczne, nadajemy każdemu mierzalny cel oraz horyzont i ważymy je istotnością.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Zarząd chce „być liderem AI w branży", ale nikt nie wie, co to znaczy w liczbach ani kiedy. Ambicja jest zbyt ogólna, by ją zaplanować.'
          : 'Sesja startuje od jednego zdania ambicji, zakresu i sygnału sukcesu. Bez tego motywy są oderwane od tego, co naprawdę chcemy osiągnąć.',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Na jakie mierzalne motywy musimy rozłożyć ambicję, żeby dało się ją zaplanować i rozliczyć?'
          : 'Ambicja rozłożona na motywy strategiczne, każdy z celem, metryką i horyzontem, posortowane wg istotności i gotowe do dalszej pracy.',
        stagesTitle: '5 kroków pracy',
        stages: [
          ['Ambicja', 'Jedno zdanie + zakres + sygnał sukcesu', 'bg-violet-500'],
          ['Sygnały', 'Co napędza i ogranicza ambicję', 'bg-violet-500'],
          ['Motywy', 'Rozkład na motywy strategiczne', 'bg-indigo-500'],
          ['Cele & horyzont', 'Metryka, cel i okno czasowe', 'bg-sky-500'],
          ['Ruchy & outputy', 'Priorytety, inicjatywy, raport, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        cascadeTitle: 'Kaskada ambicji',
        cascadeHint: 'Motywy wg horyzontu',
        legendTitle: 'Istotność motywu',
        legend: [
          ['high', 'Wysoka istotność'],
          ['medium', 'Średnia istotność'],
          ['low', 'Niska istotność'],
        ] as Array<[string, string]>,
        horizonLabels: { short: 'Krótki', medium: 'Średni', long: 'Długi' },
        ambition: 'Lider AI w branży do 2028',
        footer:
          'Ambition Decomposer = ambicja -> sygnały -> motywy -> cele & horyzont -> ruchy -> outputy',
      }
    : {
        eyebrow: 'Ambition Decomposer',
        title: isExample
          ? 'Example: one ambition decomposed into strategic themes with targets and horizon'
          : 'How Ambition Decomposer breaks an ambition into measurable themes',
        subtitle: isExample
          ? 'This case shows that an ambition is not a slogan. We first name it in a single sentence, then decompose it into strategic themes, each with a measurable target and a time horizon.'
          : 'This is not a statement on a slide. We sharpen the ambition first, decompose it into strategic themes, give each a measurable target and horizon, and weight them by importance.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'The board wants to "be the AI leader in the industry," but nobody knows what that means in numbers or by when. The ambition is too vague to plan.'
          : 'The session starts from a single ambition sentence, scope, and success signal. Without that, themes are detached from what we actually want to achieve.',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Into which measurable themes must we decompose the ambition so it can be planned and held accountable?'
          : 'The ambition decomposed into strategic themes, each with a target, metric, and horizon, sorted by importance and ready for downstream work.',
        stagesTitle: '5 working steps',
        stages: [
          ['Ambition', 'One sentence + scope + success signal', 'bg-violet-500'],
          ['Signals', 'What drives and constrains the ambition', 'bg-violet-500'],
          ['Themes', 'Decompose into strategic themes', 'bg-indigo-500'],
          ['Targets & horizon', 'Metric, target value, and time window', 'bg-sky-500'],
          ['Moves & outputs', 'Priorities, initiatives, report, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        cascadeTitle: 'Ambition cascade',
        cascadeHint: 'Themes by horizon',
        legendTitle: 'Theme importance',
        legend: [
          ['high', 'High importance'],
          ['medium', 'Medium importance'],
          ['low', 'Low importance'],
        ] as Array<[string, string]>,
        horizonLabels: { short: 'Short', medium: 'Medium', long: 'Long' },
        ambition: 'AI leader in the industry by 2028',
        footer:
          'Ambition Decomposer = ambition -> signals -> themes -> targets & horizon -> moves -> outputs',
      };

  // Static decorative themes for the cascade, grouped by horizon (short → medium → long).
  type DecoTheme = {
    title: string;
    target: string;
    horizon: 'short' | 'medium' | 'long';
    importance: 'high' | 'medium' | 'low';
  };
  const themes: DecoTheme[] = isPolish
    ? [
        { title: 'Dane gotowe pod AI', target: '90% danych skatalogowanych', horizon: 'short', importance: 'high' },
        { title: 'Kompetencje zespołu', target: '40 przeszkolonych osób', horizon: 'short', importance: 'medium' },
        { title: 'Produkty wsparte AI', target: '3 wdrożone use-case', horizon: 'medium', importance: 'high' },
        { title: 'Automatyzacja procesów', target: '25% kosztów operacji', horizon: 'medium', importance: 'medium' },
        { title: 'Nowe modele przychodu', target: '15% przychodu z AI', horizon: 'long', importance: 'high' },
        { title: 'Ekosystem partnerów', target: '2 alianse strategiczne', horizon: 'long', importance: 'low' },
      ]
    : [
        { title: 'AI-ready data', target: '90% data cataloged', horizon: 'short', importance: 'high' },
        { title: 'Team capability', target: '40 people upskilled', horizon: 'short', importance: 'medium' },
        { title: 'AI-powered products', target: '3 use-cases live', horizon: 'medium', importance: 'high' },
        { title: 'Process automation', target: '25% ops cost cut', horizon: 'medium', importance: 'medium' },
        { title: 'New revenue models', target: '15% revenue from AI', horizon: 'long', importance: 'high' },
        { title: 'Partner ecosystem', target: '2 strategic alliances', horizon: 'long', importance: 'low' },
      ];

  const importanceTone: Record<'high' | 'medium' | 'low', string> = {
    high: 'border-violet-300/70 bg-violet-500/10 dark:border-violet-700/50',
    medium: 'border-slate-200/70 bg-slate-100/70 dark:border-white/10 dark:bg-white/[0.04]',
    low: 'border-slate-200/60 bg-slate-50/70 dark:border-white/[0.06] dark:bg-white/[0.02]',
  };
  const importanceDot: Record<string, string> = {
    high: 'bg-violet-500',
    medium: 'bg-slate-400',
    low: 'bg-slate-300',
  };
  const horizonOrder: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long'];
  const horizonTone: Record<'short' | 'medium' | 'long', string> = {
    short: 'text-emerald-700 dark:text-emerald-300',
    medium: 'text-sky-700 dark:text-sky-300',
    long: 'text-indigo-700 dark:text-indigo-300',
  };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.13),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(56,189,248,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
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
            <div className="mt-4 rounded-xl border border-violet-200/70 bg-violet-500/5 p-3 dark:border-violet-900/40">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
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
          <div className="rounded-2xl border border-violet-200/70 bg-violet-500/5 p-4 dark:border-violet-900/40">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                {labels.cascadeTitle}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {labels.cascadeHint}
              </div>
            </div>

            {/* Central ambition node at the top of the cascade */}
            <div className="mt-3 rounded-xl border border-violet-300/70 bg-violet-500/10 px-3 py-2.5 text-center dark:border-violet-700/50">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                {isPolish ? 'Ambicja' : 'Ambition'}
              </div>
              <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                {labels.ambition}
              </div>
            </div>

            {/* Connector dropping from the ambition into the themes */}
            <div className="mx-auto h-3 w-px bg-violet-300/70 dark:bg-violet-700/50" />

            {/* Themes grouped by horizon (short → medium → long) */}
            <div className="space-y-3">
              {horizonOrder.map((horizon) => {
                const group = themes.filter((t) => t.horizon === horizon);
                if (group.length === 0) return null;
                return (
                  <div key={horizon}>
                    <div
                      className={`mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${horizonTone[horizon]}`}
                    >
                      {labels.horizonLabels[horizon]}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.map((theme) => (
                        <div
                          key={theme.title}
                          className={`rounded-xl border p-2.5 ${importanceTone[theme.importance]}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <span
                              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${importanceDot[theme.importance]}`}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-slate-900 dark:text-white">
                                {theme.title}
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                {theme.target}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.legendTitle}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {labels.legend.map(([importance, text]) => (
                <div key={importance} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${importanceDot[importance]}`} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-200/70 bg-violet-500/5 p-4 text-sm font-medium text-violet-800 dark:border-violet-900/40 dark:text-violet-200">
            {labels.footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AmbitionDecomposerLibraryGraphic;
