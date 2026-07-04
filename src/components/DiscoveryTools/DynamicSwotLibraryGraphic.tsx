import React from 'react';

export function DynamicSwotLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const outputs = isPolish
    ? ['Initiative', 'Report', 'Presentation', 'Idea']
    : ['Initiative', 'Report', 'Presentation', 'Idea'];
  const labels = isPolish
    ? {
        eyebrow: 'Dynamic SWOT',
        title: isExample
          ? 'Przykład: od pytania zarządu do logicznej sekwencji ruchów'
          : 'Jak Dynamic SWOT prowadzi od pytania do decyzji',
        subtitle: isExample
          ? 'Ten case pokazuje, że dobra sesja SWOT nie kończy się na nazwaniu czterech ćwiartek. Najpierw ustawia decyzję, potem porządkuje evidence, a dopiero później buduje napięcie, ruch i materiał dla zarządu.'
          : 'To nie jest zwykła tabela 2x2. Najpierw ustawiamy decyzję i porządkujemy evidence, potem budujemy macierz, interpretujemy napięcia i dopiero wtedy przechodzimy do ruchów oraz outputów.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Ateliertoy po spadku marży rozważa automatyzację. Prawdziwe pytanie brzmi: czy kupować technologię już teraz, czy najpierw zrozumieć, gdzie naprawdę wycieka wartość i które procesy blokują skalę.'
          : 'Dynamic SWOT startuje od pytania strategicznego, zakresu, success signal i ograniczeń. Bez tego kolejne kroki zamieniają się w zbiór luźnych opinii.',
        flow: 'Oś pracy',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Od czego zacząć transformację: od CAPEX-u czy od diagnozy?'
          : 'Wspólna diagnoza, logiczne napięcia, rekomendowane ruchy i materiał gotowy do raportu, decka oraz inicjatyw.',
        stagesTitle: '5 kroków pracy',
        stagesSubtitle:
          'Każdy krok ma inny poziom decyzji: od ustawienia pytania po ruch i output.',
        signals: 'Macierz czynników',
        matrixLead:
          'Macierz porządkuje sygnały, ale nie jest finałem. Każda karta powinna być krótka, konkretna, mieć źródło i wpływać na logikę decyzji.',
        matrixNote:
          'Dobra macierz nie zbiera wszystkiego. Zostawia tylko te czynniki, które naprawdę przesuwają wybór strategiczny.',
        tensionPanel: 'Napięcie strategiczne',
        tensionLead:
          'Najważniejsze miejsce, w którym przewaga zderza się z ograniczeniem albo ryzykiem.',
        moves: 'Rekomendowany ruch',
        movesLead: 'Ruch musi wynikać z napięcia, a nie z intuicji autora.',
        outputs: 'Most do outputów',
        outputsLead:
          'Wynik sesji musi nadawać się do dalszego użycia przez management i execution.',
        stage1: 'Mission brief',
        stage1Value: 'Cel, zakres, success signal, constraints',
        stage2: 'Evidence map',
        stage2Value: 'Fakty, obserwacje, hipotezy z wnętrza firmy i rynku',
        stage3: 'SWOT build',
        stage3Value: 'Karty S/W/O/T z confidence i source',
        stage4: 'Strategic tensions',
        stage4Value: 'Gdzie przewaga zderza się z ograniczeniem lub ryzykiem',
        stage5: 'Recommended moves',
        stage5Value: 'Co zrobić teraz, co odłożyć, co jeszcze sprawdzić',
        stage4Badge: 'Insight',
        stage5Badge: 'Decision',
        strengths: 'Mocne strony',
        weaknesses: 'Słabe strony',
        opportunities: 'Szanse',
        threats: 'Zagrożenia',
        strengthsHint: 'Przewagi wewnętrzne',
        weaknessesHint: 'Luki wewnętrzne',
        opportunitiesHint: 'Upside zewnętrzny',
        threatsHint: 'Ryzyko zewnętrzne',
        strengthItems: isExample
          ? ['Silna marka i zaufanie rynku B2B', 'Własna produkcja i kontrola IP']
          : [
              'czynniki wewnętrzne, które wzmacniają pozycję firmy i pomagają osiągnąć cel decyzji',
              'to, co organizacja już posiada, potrafi albo kontroluje i na czym można świadomie budować ruch',
            ],
        weaknessItems: isExample
          ? ['Decyzje oparte na intuicji', 'Brak wspólnego obrazu strat i priorytetów']
          : [
              'czynniki wewnętrzne, które obniżają sprawność, jakość wyniku albo siłę wykonania',
              'braki, niespójności lub ograniczenia, które utrudniają realizację celu i osłabiają decyzję',
            ],
        opportunityItems: isExample
          ? ['Diagnoza cyfrowa przed inwestycjami', 'Warstwa danych i software jako nowa dźwignia']
          : [
              'czynniki zewnętrzne, które mogą otworzyć przestrzeń wzrostu, poprawy pozycji albo nowej przewagi',
              'zmiany w rynku i otoczeniu, które warto wykorzystać zanim zrobi to konkurencja',
            ],
        threatItems: isExample
          ? ['Presja cenowa i wzrost kosztów', 'Ryzyko przepalenia CAPEX-u na zły problem']
          : [
              'czynniki zewnętrzne, które mogą pogorszyć wynik, ograniczyć wybór albo podważyć plan działania',
              'presje i ryzyka z otoczenia, wobec których firma musi się zabezpieczyć, zareagować albo zmienić tempo',
            ],
        tensionItems: [
          'Firma ma realne aktywa, ale nie ma wspólnej diagnozy, gdzie dziś traci pieniądze.',
          'Automatyzacja wydaje się atrakcyjna, ale bez prawdy o procesie może tylko przyspieszyć chaos.',
        ],
        moveItems: [
          'Najpierw zmapować wycieki wartości, bottlenecks i luki danych.',
          'Dopiero potem układać kolejność: dane -> automatyzacja -> governance inwestycji.',
          'Zamknąć wynik w materiale dla zarządu, a nie w długiej liście obserwacji.',
        ],
        outputItems: [
          'Executive summary sytuacji',
          'Priorytety na 90 dni',
          'Raport / deck / inicjatywa',
        ],
        legend: 'Dynamic SWOT = brief -> evidence -> matrix -> tension -> move -> output',
      }
    : {
        eyebrow: 'Dynamic SWOT',
        title: isExample
          ? 'Example: from a leadership question to a logical move sequence'
          : 'How Dynamic SWOT moves from question to decision',
        subtitle: isExample
          ? 'This case shows that a strong SWOT session does not stop at naming four quadrants. It frames the decision first, structures the evidence next, and only then builds tension, moves, and board-ready material.'
          : 'This is not a standard 2x2 table. First we frame the decision and structure evidence, then build the matrix, interpret the tensions, and only then move into actions and outputs.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'After a margin decline, Ateliertoy is considering automation. The real question is whether to buy technology now or first understand where value is leaking and which processes block scale.'
          : 'Dynamic SWOT starts with the strategic question, scope, success signal, and constraints. Without that, the next steps collapse into disconnected opinions.',
        flow: 'Work spine',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Where should the transformation start: CAPEX first or diagnosis first?'
          : 'A shared diagnosis, strategic tensions, recommended moves, and material ready for reports, decks, and initiatives.',
        stagesTitle: '5 working steps',
        stagesSubtitle: 'Each step moves the user to a different level of decision quality.',
        signals: 'Factor matrix',
        matrixLead:
          'The matrix organizes the signals, but it is not the finish line. Each card should be short, concrete, sourced, and relevant to the strategic choice.',
        matrixNote:
          'A strong matrix does not collect everything. It keeps only the factors that truly move the strategic choice.',
        tensionPanel: 'Strategic tension',
        tensionLead: 'The key point where advantage collides with a constraint or a risk.',
        moves: 'Recommended move',
        movesLead: 'A move must emerge from the tension, not from analyst instinct.',
        outputs: 'Bridge to outputs',
        outputsLead:
          'The result of the session must be usable by management and by downstream execution.',
        stage1: 'Mission brief',
        stage1Value: 'Goal, scope, success signal, constraints',
        stage2: 'Evidence map',
        stage2Value: 'Facts, observations, and hypotheses from inside the company and the market',
        stage3: 'SWOT build',
        stage3Value: 'S/W/O/T cards with confidence and source',
        stage4: 'Strategic tensions',
        stage4Value: 'Where advantage collides with constraint or risk',
        stage5: 'Recommended moves',
        stage5Value: 'What to do now, what to delay, what to validate next',
        stage4Badge: 'Insight',
        stage5Badge: 'Decision',
        strengths: 'Strengths',
        weaknesses: 'Weaknesses',
        opportunities: 'Opportunities',
        threats: 'Threats',
        strengthsHint: 'Internal advantage',
        weaknessesHint: 'Internal gap',
        opportunitiesHint: 'External upside',
        threatsHint: 'External risk',
        strengthItems: isExample
          ? ['Strong brand and trusted B2B position', 'In-house manufacturing and IP control']
          : [
              'internal factors that strengthen the company position and support the decision objective',
              'what the organization already has, knows, or controls and can deliberately build on',
            ],
        weaknessItems: isExample
          ? ['Intuition-driven decisions', 'No shared view of losses and priorities']
          : [
              'internal factors that reduce execution quality, business performance, or decision strength',
              'gaps, inconsistencies, or constraints that make the objective harder to achieve',
            ],
        opportunityItems: isExample
          ? ['Digital diagnosis before investments', 'Data and software layer as a new lever']
          : [
              'external factors that may create room for growth, stronger positioning, or new advantage',
              'changes in the market or environment that should be captured before competitors do',
            ],
        threatItems: isExample
          ? ['Price pressure and rising costs', 'Risk of burning CAPEX on the wrong problem']
          : [
              'external factors that may weaken the result, narrow the choice, or undermine the plan',
              'pressures and risks in the environment that require protection, response, or a change of pace',
            ],
        tensionItems: [
          'The company has real assets, but no shared diagnosis of where money is leaking today.',
          'Automation looks attractive, but without process truth it may only accelerate chaos.',
        ],
        moveItems: [
          'First map value leakage, bottlenecks, and data blind spots.',
          'Only then sequence the roadmap: data -> automation -> investment governance.',
          'Close the result in board-ready material, not in a long list of observations.',
        ],
        outputItems: [
          'Executive summary of the situation',
          '90-day priorities',
          'Report / deck / initiative',
        ],
        legend: 'Dynamic SWOT = brief -> evidence -> matrix -> tension -> move -> output',
      };

  const stages = [
    {
      id: 1,
      title: labels.stage1,
      value: labels.stage1Value,
      tone: 'from-primary-500/18 to-crimson-700/8',
      accent: 'bg-navy-900',
      badge: null,
    },
    {
      id: 2,
      title: labels.stage2,
      value: labels.stage2Value,
      tone: 'from-sky-500/18 to-blue-500/8',
      accent: 'bg-sky-500',
      badge: null,
    },
    {
      id: 3,
      title: labels.stage3,
      value: labels.stage3Value,
      tone: 'from-emerald-500/18 to-blue-500/8',
      accent: 'bg-emerald-500',
      badge: null,
    },
    {
      id: 4,
      title: labels.stage4,
      value: labels.stage4Value,
      tone: 'from-amber-500/22 to-amber-500/10',
      accent: 'bg-amber-500',
      badge: labels.stage4Badge,
    },
    {
      id: 5,
      title: labels.stage5,
      value: labels.stage5Value,
      tone: 'from-primary-500/22 to-crimson-500/10',
      accent: 'bg-navy-900',
      badge: labels.stage5Badge,
    },
  ];

  const signalCards = [
    {
      title: labels.strengths,
      hint: labels.strengthsHint,
      items: labels.strengthItems,
      className:
        'border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100',
      titleClassName: 'text-emerald-800 dark:text-emerald-300',
    },
    {
      title: labels.weaknesses,
      hint: labels.weaknessesHint,
      items: labels.weaknessItems,
      className:
        'border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100',
      titleClassName: 'text-amber-800 dark:text-amber-300',
    },
    {
      title: labels.opportunities,
      hint: labels.opportunitiesHint,
      items: labels.opportunityItems,
      className:
        'border-sky-200/70 bg-sky-50/80 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100',
      titleClassName: 'text-sky-800 dark:text-sky-300',
    },
    {
      title: labels.threats,
      hint: labels.threatsHint,
      items: labels.threatItems,
      className:
        'border-danger-200/70 bg-danger-50/80 text-danger-900 dark:border-danger-900/40 dark:bg-danger-900/30 dark:text-danger-100',
      titleClassName: 'text-danger-800 dark:text-danger-300',
    },
  ];

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(165,28,48,0.1),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(34,197,94,0.08),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-c-border-subtle dark:bg-[radial-gradient(circle_at_top_left,rgba(165,28,48,0.18),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.12),transparent_20%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-c-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-primary-400/20 bg-primary-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">
              {labels.eyebrow}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-c-border-subtle dark:bg-white/[0.04] dark:text-slate-300">
              {labels.flow}
            </span>
          </div>
          <span className="inline-flex rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-c-border-subtle dark:bg-white/[0.05] dark:text-slate-200">
            Tool
          </span>
        </div>
        <div className="mt-3 max-w-4xl text-lg font-semibold leading-tight text-slate-900 dark:text-white">
          {labels.title}
        </div>
        <div className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {labels.subtitle}
        </div>
      </div>

      <div className="grid gap-4 border-b border-slate-200/70 px-5 py-4 dark:border-c-border-subtle lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-slate-200/70 bg-white/85 p-4 shadow-sm dark:border-c-border-subtle dark:bg-white/[0.04]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            {labels.scenario}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.scenarioValue}
          </div>
        </div>

        <div className="rounded-[22px] border border-primary-200/80 bg-primary-500/5 p-4 shadow-sm dark:border-primary-900/40">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
            {labels.decision}
          </div>
          <div className="mt-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
            {labels.decisionValue}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Process spine — compact horizontal flow */}
        <div className="rounded-[26px] border border-slate-200/70 bg-white/70 p-4 dark:border-c-border-subtle dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {labels.stagesTitle}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {labels.stagesSubtitle}
              </div>
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-c-border-subtle dark:bg-white/[0.05] dark:text-slate-200">
              Process
            </span>
          </div>

          <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-600">
            {labels.legend}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {stages.slice(0, 3).map((stage) => (
              <div
                key={stage.id}
                className={`rounded-2xl border border-slate-200/70 bg-gradient-to-br ${stage.tone} p-3 shadow-sm dark:border-c-border-subtle`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-950">
                    {stage.id}
                  </div>
                  <div className="text-xs font-semibold leading-tight text-slate-900 dark:text-white">
                    {stage.title}
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${stage.accent}`} />
                  <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {stage.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {stages.slice(3).map((stage) => (
              <div
                key={stage.id}
                className={`rounded-2xl border border-slate-200/70 bg-gradient-to-br ${stage.tone} p-3 shadow-sm ring-1 ring-c-border dark:border-c-border-subtle dark:ring-primary-400/20`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-950">
                    {stage.id}
                  </div>
                  <div className="text-xs font-semibold leading-tight text-slate-900 dark:text-white">
                    {stage.title}
                  </div>
                  {stage.badge ? (
                    <span className="ml-auto inline-flex shrink-0 rounded-full border border-c-border-strong bg-white/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-c-border-subtle dark:bg-white/[0.05] dark:text-slate-200">
                      {stage.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${stage.accent}`} />
                  <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {stage.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SWOT Matrix — classic 2x2 grid, full width */}
        <div className="rounded-[26px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-c-border-subtle dark:bg-white/[0.03]">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {labels.signals}
              </div>
              <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-c-border-subtle dark:bg-white/[0.05] dark:text-slate-200">
                Matrix
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              {labels.matrixLead}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {signalCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-[22px] border p-4 shadow-sm ${card.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${card.titleClassName}`}
                  >
                    {card.title}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-current/65">
                    {card.hint}
                  </div>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-white/85 p-4 dark:border-c-border-subtle dark:bg-white/[0.04]">
            <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {labels.matrixNote}
            </div>
          </div>
        </div>

        {/* Tensions, Moves, Outputs — stacked full width below the matrix */}
        <div className="rounded-[26px] border border-amber-200/70 bg-amber-500/5 p-4 shadow-sm dark:border-amber-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              {labels.tensionPanel}
            </div>
            <span className="inline-flex rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
              {labels.stage4Badge}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.tensionLead}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.tensionItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[26px] border border-primary-200/70 bg-primary-500/5 p-4 shadow-sm dark:border-primary-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {labels.moves}
            </div>
            <span className="inline-flex rounded-full border border-primary-300/40 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
              {labels.stage5Badge}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.movesLead}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.moveItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-900 dark:bg-white" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-4 shadow-sm dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {labels.outputs}
            </div>
            <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              Output
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.outputsLead}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {outputs.map((item) => (
              <span
                key={item}
                className="inline-flex rounded-full border border-emerald-200/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm dark:border-c-border-subtle dark:bg-white/[0.04] dark:text-slate-200"
              >
                {item}
              </span>
            ))}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {labels.outputItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:border-c-border-subtle dark:bg-white/[0.04] dark:text-slate-300">
          {labels.legend}
        </div>
      </div>
    </div>
  );
}

export default DynamicSwotLibraryGraphic;
