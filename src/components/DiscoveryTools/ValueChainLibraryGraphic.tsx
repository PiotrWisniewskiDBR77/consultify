import React from 'react';

export function ValueChainLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Value Chain',
        title: isExample
          ? 'Przykład: od łańcucha wartości do dźwigni marży'
          : 'Jak Value Chain prowadzi od aktywności do marży',
        subtitle: isExample
          ? 'Ten case pokazuje, że łańcuch wartości Portera to nie diagram dla ozdoby. Najpierw mapuje aktywności, ocenia ich wkład w koszt i wartość, a dopiero potem buduje dźwignie marży i ruchy.'
          : 'To nie statyczny schemat dziewięciu pól. Najpierw ustawiamy zakres i pozycję, mapujemy aktywności pierwotne i wspierające, oceniamy ich rolę w marży i zamieniamy to w dźwignie oraz inicjatywy.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Producent komponentów chce poprawić marżę bez podnoszenia cen. Pytanie brzmi: które aktywności tworzą wartość, a które ją drenują szybciej niż dokłada różnicowanie.'
          : 'Sesja startuje od branży, zakresu łańcucha, pozycji firmy (koszt vs różnicowanie) i pytania decyzyjnego. Bez tego mapa aktywności jest abstrakcyjna.',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Gdzie naprawdę powstaje i ginie marża wzdłuż łańcucha wartości?'
          : 'Ocena roli każdej aktywności w marży, dźwignie kosztowe i różnicujące oraz outputy gotowe do dalszej pracy.',
        stagesTitle: '5 kroków pracy',
        stages: [
          ['Brief', 'Branża, zakres łańcucha, pozycja, decyzja', 'bg-sky-500'],
          ['Aktywności', 'Mapa 5 pierwotnych + 4 wspierających', 'bg-sky-500'],
          ['Wkład', 'Koszt, wartość i rola w marży na aktywność', 'bg-blue-500'],
          ['Dźwignie', 'Gdzie redukować koszt, gdzie wzmacniać wartość', 'bg-amber-500'],
          ['Ruchy & outputy', 'Ruchy, inicjatywy, raport, deck lub idea', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        chainTitle: 'Łańcuch wartości',
        support: 'Aktywności wspierające',
        primary: 'Aktywności pierwotne',
        supportItems: ['Infrastruktura', 'Zasoby ludzkie', 'Technologia', 'Zaopatrzenie'],
        primaryItems: [
          'Logistyka wejściowa',
          'Operacje',
          'Logistyka wyjściowa',
          'Marketing i sprzedaż',
          'Serwis',
        ],
        margin: 'Marża',
        legendTitle: 'Rola w marży',
        legend: [
          ['creator', 'Tworzy marżę'],
          ['neutral', 'Neutralna'],
          ['drain', 'Drenuje marżę'],
        ] as Array<[string, string]>,
        footer: 'Value Chain = brief -> aktywności -> wkład -> dźwignie -> ruchy -> outputy',
      }
    : {
        eyebrow: 'Value Chain',
        title: isExample
          ? 'Example: from value chain to margin levers'
          : 'How Value Chain moves from activities to margin',
        subtitle: isExample
          ? 'This case shows that a Porter value chain is not a decorative diagram. It maps activities first, scores their cost and value contribution, and only then builds margin levers and moves.'
          : 'This is not a static nine-box schema. First we frame the scope and position, map primary and support activities, score their role in margin, and translate it into levers and initiatives.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'A component manufacturer wants to improve margin without raising prices. The real question is which activities create value and which drain it faster than differentiation can add it.'
          : 'The session starts with industry, chain scope, company position (cost vs differentiation), and the decision question. Without that, the activity map stays abstract.',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Where does margin truly get created and lost along the value chain?'
          : "Each activity's role in margin, cost and differentiation levers, and outputs ready for downstream work.",
        stagesTitle: '5 working steps',
        stages: [
          ['Brief', 'Industry, chain scope, position, decision', 'bg-sky-500'],
          ['Activities', 'Map 5 primary + 4 support', 'bg-sky-500'],
          ['Contribution', 'Cost, value, and margin role per activity', 'bg-blue-500'],
          ['Levers', 'Where to cut cost, where to raise value', 'bg-amber-500'],
          ['Moves & outputs', 'Moves, initiatives, report, deck, or idea', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        chainTitle: 'Value chain',
        support: 'Support activities',
        primary: 'Primary activities',
        supportItems: ['Firm infrastructure', 'HR management', 'Technology', 'Procurement'],
        primaryItems: [
          'Inbound logistics',
          'Operations',
          'Outbound logistics',
          'Marketing & sales',
          'Service',
        ],
        margin: 'Margin',
        legendTitle: 'Margin role',
        legend: [
          ['creator', 'Creates margin'],
          ['neutral', 'Neutral'],
          ['drain', 'Drains margin'],
        ] as Array<[string, string]>,
        footer: 'Value Chain = brief -> activities -> contribution -> levers -> moves -> outputs',
      };

  // Static decorative margin-role pattern for the 5 primary chevrons (creator/neutral/drain).
  const primaryRoles: Array<'creator' | 'neutral' | 'drain'> = [
    'neutral',
    'creator',
    'neutral',
    'creator',
    'drain',
  ];
  const roleTone: Record<string, string> = {
    creator: 'bg-emerald-500',
    neutral: 'bg-slate-400',
    drain: 'bg-amber-500',
  };
  const legendDot: Record<string, string> = {
    creator: 'bg-emerald-500',
    neutral: 'bg-slate-400',
    drain: 'bg-amber-500',
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
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              {labels.chainTitle}
            </div>

            {/* The classic Porter value-chain shape: an outer chevron frame, support bands on top,
                primary chevrons across the bottom, all pointing to the MARGIN wedge on the right. */}
            <div className="flex items-stretch gap-1">
              <div className="min-w-0 flex-1">
                {/* Support activities — horizontal bands */}
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {labels.support}
                </div>
                <div className="space-y-1">
                  {labels.supportItems.map((item) => (
                    <div
                      key={item}
                      className="rounded-md bg-slate-200/70 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-navy-800 dark:text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {/* Primary activities — chevrons */}
                <div className="mb-1 mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {labels.primary}
                </div>
                <div className="flex gap-0.5">
                  {labels.primaryItems.map((item, index) => (
                    <div
                      key={item}
                      className={`flex flex-1 items-center justify-center px-1 py-2 text-center text-[10px] font-semibold leading-tight text-white ${
                        roleTone[primaryRoles[index]]
                      }`}
                      style={{
                        clipPath:
                          index === 0
                            ? 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)'
                            : 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%, 18% 50%)',
                        marginLeft: index === 0 ? 0 : '-6px',
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* MARGIN wedge */}
              <div
                className="flex w-14 items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-center text-[11px] font-bold uppercase tracking-wide text-white"
                style={{ clipPath: 'polygon(0 0, 60% 0, 100% 50%, 60% 100%, 0 100%, 40% 50%)' }}
              >
                {labels.margin}
              </div>
            </div>

            {/* Legend for margin roles */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {labels.legend.map(([role, text]) => (
                <div key={role} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${legendDot[role]}`} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 text-xs leading-relaxed text-slate-700 dark:border-amber-900/40 dark:text-slate-200">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {labels.legendTitle}:{' '}
            </span>
            {isPolish
              ? 'kolor każdej aktywności pokazuje, czy tworzy marżę, jest neutralna, czy ją drenuje. Wielkość i adnotacje wynikają z wkładu w koszt i wartość.'
              : "each activity's color shows whether it creates, is neutral to, or drains margin. Size and annotations follow cost and value contribution."}
          </div>

          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValueChainLibraryGraphic;
