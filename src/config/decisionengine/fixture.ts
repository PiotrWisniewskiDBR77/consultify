/**
 * Decision Engine — worked-example fixture.
 *
 * Sourced from the doctrine's §7 worked example (Harvard/wdrozenie-100/
 * _TOOLS_DOKTRYNA/decision-engine.md): a B2B SaaS company (60 people) framed as
 * "should we open a German sales office in Q3" — reframed by the engine to the
 * broader "how do we best accelerate DACH revenue growth over 18 months under
 * limited expansion capital", which reveals the office is one of several
 * options, not the only one.
 *
 * Four MECE alternatives (A full local office / B local partner-reseller /
 * C remote sales team / D deferred pilot), four weighted criteria (growth
 * pace 35%, capital risk 30%, product-strategy fit 20%, and a team-morale
 * criterion at 15% left UNDECLARED so `detectHiddenCriterion` surfaces it —
 * per doctrine, the team's real worry was never the financial risk it debated
 * loudest), two ranged uncertainties (competitor price reaction as the tornado
 * driver that flips the recommendation; DACH legal-presence requirement as the
 * secondary one), and four pre-mortem-sourced assumptions underpinning the
 * full-office option (one explicitly anchored to the DACH sales-cycle
 * benchmark used in the forecast).
 *
 * With these numbers the matrix ranks D (pilot, weighted 4.10) > C (remote
 * team, 3.70) > B (partner, 3.30) > A (full office, 3.15) — margin 0.40 — and
 * the competitor-price uncertainty (swing -0.5) is the sole flipper, matching
 * the doctrine's "this is the real decision driver, not the cost structure the
 * board debated longest".
 *
 * Used as: (a) the `toDecisionSession` self-test fixture, (b) a seed/demo
 * session for the tool, (c) a reference for QA/DoD screenshots.
 */

import type { OperationalToolData } from '@/store/useToolStore';

export const DECISION_FIXTURE: OperationalToolData = {
  context: {
    goal:
      'Jak najlepiej przyspieszyć wzrost przychodu z DACH w ciągu 18 miesięcy, przy ograniczonym kapitale na ekspansję',
    scope:
      'Firma B2B SaaS, 60 osób, rynek DACH (Niemcy/Austria/Szwajcaria); pytanie wyjściowe "czy wejść do Niemiec w Q3" przeramowane na szersze pytanie o wzrost',
    timeframe: 'medium',
    successSignal:
      'Rekomendacja z jawnym checkpointem (nie decyzja 0-1) i zidentyfikowaną zmienną, która ją odwraca',
    assumptions:
      'Koszt pracy w pełni obciążony jednolity dla wariantów; benchmark cyklu sprzedaży DACH z istniejącej centrali; konkurent ma już biuro w Monachium',
    constraints: 'Ograniczony kapitał na ekspansję; decyzja musi mieć realną autonomię wykonawców, nie tylko zgodę w sali',
  },
  sections: {
    frame: [
      {
        id: 'frame-dach-growth',
        title: 'Jak przyspieszyć wzrost przychodu z DACH',
        description:
          'Pytanie postawione jako "czy wejść do Niemiec w Q3" przeramowane na: jak najlepiej przyspieszyć wzrost przychodu z DACH w 18 miesięcy, przy ograniczonym kapitale na ekspansję.',
        impact: 'high',
        effort: 'medium',
        question:
          'Jak najlepiej przyspieszyć wzrost przychodu z DACH w ciągu 18 miesięcy, przy ograniczonym kapitale na ekspansję?',
        decisionMaker: 'Zarząd + VP Sales',
        horizon: '18 miesięcy',
        binary: false,
        implementersPresent: true,
        reversibility: 'two-way',
        commitmentConfirmed: true,
      },
    ] as unknown as OperationalToolData['sections']['frame'],
    alternatives: [
      {
        id: 'alt-full-office',
        title: 'Pełny lokalny oddział w Niemczech',
        description:
          'Biuro, lokalny zespół sprzedaży, byt prawny. Wysoki koszt, wysoka kontrola — ale najwolniej odwracalny wariant.',
        impact: 'high',
        effort: 'high',
        label: 'A. Pełny lokalny oddział',
        scores: { growth: 5, capitalRisk: 1, strategyFit: 4, morale: 2 },
        strawman: false,
        doable: true,
        realOption: false,
        cost: 1_200_000,
      },
      {
        id: 'alt-partner',
        title: 'Partner / reseller lokalny',
        description: 'Niski koszt, niska kontrola, szybki start przez istniejącą sieć partnera.',
        impact: 'medium',
        effort: 'low',
        label: 'B. Partner / reseller lokalny',
        scores: { growth: 3, capitalRisk: 4, strategyFit: 3, morale: 3 },
        strawman: false,
        doable: true,
        realOption: false,
        cost: 250_000,
      },
      {
        id: 'alt-remote-team',
        title: 'Zdalny zespół sprzedaży z centrali',
        description:
          'Celuje w DACH bez lokalnego biura, z istniejącej centrali. Średni koszt, test rynku bez zaangażowania nieodwracalnego.',
        impact: 'high',
        effort: 'medium',
        label: 'C. Zdalny zespół sprzedaży',
        scores: { growth: 4, capitalRisk: 3, strategyFit: 4, morale: 4 },
        strawman: false,
        doable: true,
        realOption: false,
        cost: 400_000,
      },
      {
        id: 'alt-pilot',
        title: 'Odroczenie 6 miesięcy + pilotaż z 2 klientami referencyjnymi',
        description:
          'Obecny zespół prowadzi pilotaż, decyzja o skali później — tania opcja realna (real option) rozstrzygająca kluczową niepewność przed pełnym zaangażowaniem.',
        impact: 'high',
        effort: 'low',
        label: 'D. Pilotaż 6 mies. (opcja realna)',
        scores: { growth: 3, capitalRisk: 5, strategyFit: 4, morale: 5 },
        strawman: false,
        doable: true,
        realOption: true,
        cost: 150_000,
      },
    ] as unknown as OperationalToolData['sections']['alternatives'],
    criteria: [
      {
        id: 'growth',
        title: 'Tempo wzrostu przychodu z DACH',
        description: 'Jak szybko wariant realnie przyspiesza przychód z regionu.',
        impact: 'high',
        effort: 'medium',
        label: 'Tempo wzrostu przychodu',
        weight: 0.35,
        declared: true,
        contested: false,
      },
      {
        id: 'capitalRisk',
        title: 'Ryzyko kapitałowe',
        description: 'Ekspozycja CAPEX/OPEX i nieodwracalność zaangażowanego kapitału.',
        impact: 'high',
        effort: 'medium',
        label: 'Ryzyko kapitałowe',
        weight: 0.3,
        declared: true,
        contested: false,
      },
      {
        id: 'strategyFit',
        title: 'Zgodność ze strategią produktową',
        description: 'Czy wariant pasuje do obecnej strategii produktu i go-to-market.',
        impact: 'medium',
        effort: 'low',
        label: 'Zgodność ze strategią produktową',
        weight: 0.2,
        declared: true,
        contested: false,
      },
      {
        id: 'morale',
        title: 'Wpływ na morale istniejącego zespołu',
        description:
          'Nigdy formalnie nie zadeklarowane w karcie decyzyjnej, choć realnie waży w preferencjach zarządu — kryterium ukryte.',
        impact: 'medium',
        effort: 'low',
        label: 'Wpływ na morale istniejącego zespołu',
        weight: 0.15,
        declared: false,
        contested: true,
        disputeKind: 'value',
      },
    ] as unknown as OperationalToolData['sections']['criteria'],
    uncertainties: [
      {
        id: 'unc-competitor-price',
        title: 'Reakcja cenowa głównego konkurenta',
        description:
          'Konkurent ma już biuro w Monachium; nieznana jest szybkość i siła jego reakcji cenowej na wejście DACH.',
        impact: 'high',
        effort: 'medium',
        label: 'Reakcja cenowa głównego konkurenta (biuro w Monachium)',
        low: -0.5,
        base: 0,
        high: 0.1,
        criterion: 'growth',
        pointEstimate: false,
      },
      {
        id: 'unc-german-legal-presence',
        title: 'Wymóg lokalnej obecności prawnej',
        description:
          'Niepewne, czy niemieccy klienci B2B kupują SaaS bez lokalnej obecności prawnej — szacunek: tak w 70% przypadków, wymagane w branżach regulowanych.',
        impact: 'medium',
        effort: 'low',
        label: 'Czy niemieccy klienci B2B kupują SaaS bez lokalnej obecności prawnej',
        low: -0.2,
        base: 0,
        high: 0.15,
        criterion: 'strategyFit',
        pointEstimate: false,
      },
    ] as unknown as OperationalToolData['sections']['uncertainties'],
    assumptions: [
      {
        id: 'asm-full-office-pmf',
        title: 'PMF potwierdzony przed zatrudnieniem lokalnego dyrektora',
        description:
          'Pre-mortem: oddział zamknięty po stracie 1,2 mln, bo zatrudniono lokalnego dyrektora przed potwierdzeniem product-market fit.',
        impact: 'high',
        effort: 'medium',
        alternative: 'alt-full-office',
        fromPremortem: true,
        anchored: false,
      },
      {
        id: 'asm-full-office-pricing-autonomy',
        title: 'Centrala da lokalnemu zespołowi autonomię cenową',
        description:
          'Pre-mortem: centrala nie dała lokalnemu zespołowi autonomii cenowej — wskazywana jako druga przyczyna hipotetycznej porażki.',
        impact: 'medium',
        effort: 'low',
        alternative: 'alt-full-office',
        fromPremortem: true,
        anchored: false,
      },
      {
        id: 'asm-full-office-sales-cycle',
        title: 'Cykl sprzedaży ≤ benchmarku DACH z prognozy',
        description:
          'Pre-mortem: sprzedaż zajęła 2x dłużej niż zakładano, bo cykl decyzyjny niemieckich klientów korporacyjnych jest dłuższy niż w benchmarku DACH użytym do prognozy — założenie zakotwiczone w tym benchmarku.',
        impact: 'high',
        effort: 'medium',
        alternative: 'alt-full-office',
        fromPremortem: true,
        anchored: true,
      },
      {
        id: 'asm-pilot-reference-clients',
        title: 'Pozyskanie ≥1 klienta referencyjnego w 6 miesięcy',
        description:
          'Warunek checkpointu pilotażu: jeśli ≥1 klient referencyjny podpisany i cykl sprzedaży <40% dłuższy niż benchmark — przejście do opcji C (zdalny zespół).',
        impact: 'high',
        effort: 'low',
        alternative: 'alt-pilot',
        fromPremortem: false,
        anchored: false,
      },
    ] as unknown as OperationalToolData['sections']['assumptions'],
  },
  summary: {
    keyInsights: [
      'Prawdziwy trade-off nie brzmiał "oddział czy nie", tylko "szybkość zdobycia rynku vs ekspozycja kapitałowa przy niepotwierdzonym PMF".',
      'Rekomendacja D→A odwraca się wyłącznie na zmiennej "reakcja cenowa konkurenta", nie na strukturze kosztów dyskutowanej najdłużej.',
      'Ukryte kryterium: wpływ na morale zespołu waży w wyborze zarządu, choć nigdy nie zostało formalnie zadeklarowane.',
    ],
    appliedConclusions: [
      'Pełny oddział nie znika z listy — zostaje odroczony do rozstrzygnięcia kluczowej niepewności tanim pilotażem.',
      'Monitoring reakcji cenowej konkurenta staje się priorytetem, nie dalsze cięcie budżetu oddziału.',
    ],
    recommendedInitiatives: [],
  },
};
