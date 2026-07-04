import React from 'react';

export function MarketForcesLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Market Forces',
        title: isExample
          ? 'Przykład: od presji rynku do sekwencji ruchów'
          : 'Jak Market Forces prowadzi od rynku do decyzji',
        subtitle: isExample
          ? 'Ten case pokazuje, że analiza Portera nie kończy się na scorecardzie. Najpierw zbiera sygnały, potem ocenia siły, a dopiero na końcu buduje implikacje, ruchy i outputy.'
          : 'To nie jest statyczna ocena pięciu sił. Najpierw ustawiamy rynek i pytanie, potem zbieramy evidence, oceniamy presję konkurencyjną i zamieniamy ją w ruchy oraz inicjatywy.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Ateliertoy rozważa wejście w segment B2B marketplace. Pytanie brzmi: czy rynek daje przestrzeń na defensible pozycję, czy presja platform i kupujących zje marżę szybciej niż wzrost ją odbuduje.'
          : 'Sesja startuje od branży, zakresu geograficznego, pozycji firmy i pytania decyzyjnego. Bez tego scorecard sił staje się abstrakcyjny.',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Czy wejść w marketplace teraz, czy najpierw zbudować kanał partnerski i przewagę danych?'
          : 'Ocena atrakcyjności rynku, presji marży, strategicznych dźwigni i outputów gotowych do dalszej pracy.',
        stagesTitle: '5 kroków pracy',
        stage1: 'Market brief',
        stage1Value: 'Branża, geografia, pozycja, decyzja',
        stage2: 'Market signals',
        stage2Value: 'Wywiady, benchmarki, obserwacje i hipotezy',
        stage3: 'Five Forces',
        stage3Value: 'Score, trend, drivery, evidence i confidence',
        stage4: 'Implications',
        stage4Value: 'Presja marży, defensibility, dźwignie strategiczne',
        stage5: 'Moves & outputs',
        stage5Value: 'Ruchy, inicjatywy, raport, deck lub idea',
        forcesTitle: 'Scorecard presji rynkowej',
        implicationsTitle: 'Implikacje strategiczne',
        movesTitle: 'Most do inicjatyw',
        forces: [
          ['Rywalizacja', '4/5', 'Wysoka presja cenowa i szybko kopiowane oferty'],
          ['Nowi gracze', '3/5', 'Wejście możliwe, ale wymaga kanału i zaufania'],
          ['Substytuty', '2/5', 'Alternatywy istnieją, lecz nie rozwiązują całego problemu'],
          ['Siła kupujących', '5/5', 'Duzi klienci wymuszają rabaty i warunki SLA'],
          ['Siła dostawców', '3/5', 'Koszty komponentów są zmienne, ale dywersyfikowalne'],
        ],
        implicationItems: [
          'Rynek może rosnąć, ale przewaga bez danych i kanału będzie krucha.',
          'Największe ryzyko leży w sile kupujących i presji porównywalności ofert.',
        ],
        moveItems: [
          'Najpierw zbudować partner channel i dane o popycie.',
          'Wejście w marketplace traktować jako etap po walidacji marży.',
          'Zamknąć wynik jako brief inicjatywy i deck dla zarządu.',
        ],
        legend: 'Market Forces = brief -> signals -> forces -> implications -> moves -> outputs',
      }
    : {
        eyebrow: 'Market Forces',
        title: isExample
          ? 'Example: from market pressure to a move sequence'
          : 'How Market Forces moves from market structure to decision',
        subtitle: isExample
          ? 'This case shows that a strong Porter session does not stop at a scorecard. It captures signals first, scores the forces next, and only then builds implications, moves, and outputs.'
          : 'This is not a static Five Forces checklist. First we frame the market and decision, then collect evidence, score competitive pressure, and translate it into moves and initiatives.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'Ateliertoy is considering entering a B2B marketplace segment. The real question is whether the market offers a defensible position or whether platform and buyer pressure will consume margin faster than growth rebuilds it.'
          : 'The session starts with industry, geography, company position, and the decision question. Without that, the force scorecard becomes abstract.',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Enter the marketplace now, or first build a partner channel and data advantage?'
          : 'A market attractiveness read, margin pressure logic, strategic levers, and outputs ready for downstream work.',
        stagesTitle: '5 working steps',
        stage1: 'Market brief',
        stage1Value: 'Industry, geography, position, decision',
        stage2: 'Market signals',
        stage2Value: 'Interviews, benchmarks, observations, and hypotheses',
        stage3: 'Five Forces',
        stage3Value: 'Score, trend, drivers, evidence, and confidence',
        stage4: 'Implications',
        stage4Value: 'Margin pressure, defensibility, strategic levers',
        stage5: 'Moves & outputs',
        stage5Value: 'Moves, initiatives, report, deck, or idea',
        forcesTitle: 'Market pressure scorecard',
        implicationsTitle: 'Strategic implications',
        movesTitle: 'Bridge to initiatives',
        forces: [
          ['Rivalry', '4/5', 'High price pressure and easily copied offers'],
          ['New entrants', '3/5', 'Entry is possible, but requires channel and trust'],
          ['Substitutes', '2/5', 'Alternatives exist but do not solve the full job'],
          ['Buyer power', '5/5', 'Large customers force discounts and SLA terms'],
          ['Supplier power', '3/5', 'Input costs move, but can be diversified'],
        ],
        implicationItems: [
          'The market may grow, but advantage without data and channel will be fragile.',
          'The biggest risk sits in buyer power and offer comparability.',
        ],
        moveItems: [
          'Build partner channel and demand data first.',
          'Treat marketplace entry as a step after margin validation.',
          'Close the result as an initiative brief and board deck.',
        ],
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
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-c-border-subtle dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-c-border-subtle">
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
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]">
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

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]">
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

      <div className="border-t border-slate-200/70 px-5 py-3 text-xs font-medium text-slate-500 dark:border-c-border-subtle dark:text-slate-400">
        {labels.legend}
      </div>
    </div>
  );
}

export default MarketForcesLibraryGraphic;
