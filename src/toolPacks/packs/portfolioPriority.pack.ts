/**
 * Tool Pack — Portfolio Priority (BCG-style growth-share matrix).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/portfolio/portfolioMatrixEngine.ts` (deterministyczna klasyfikacja 2×2,
 *   sekwencjonowanie z zależnościami i budżetem, walidator ruchów W2)
 * - `src/config/portfolio/portfolioValueStaircase.ts` (drabina wartość/wykonalność +
 *   wymóg źródła dla każdej liczby + jawne zależności)
 * - `src/config/portfolio/portfolioQuestionBank.ts` (drabina pytań per element)
 * - `src/config/portfolio/portfolioOrgImport.ts` (import kontekstu organizacji)
 * - `src/config/portfolio/conclusionPrompts.ts` (kontrakt W2 dla bloku domykającego)
 * - `src/store/useToolStore.ts` PORTFOLIO_PRIORITY_STEPS (id faz runtime), PortfolioItem
 *   (kształt danych, w tym legacy pole `category` BCG)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 *
 * Id faz są ZGODNE z runtime (mission/input/items/insights/outputs) — pack nie
 * wprowadza równoległej nomenklatury.
 *
 * UWAGA O DWÓCH SCHEMATACH: `PortfolioItem.category` (`star`/`cash-cow`/`question-mark`/
 * `dog`) to pole danych elementu (klasyczna nomenklatura BCG), ale FAKTYCZNA klasyfikacja
 * używana przez silnik decyzyjny (`portfolioMatrixEngine.classifyPortfolio`) liczy WŁASNY
 * kwadrant `quick-win`/`big-bet`/`fill-in`/`money-pit` z `valueScore`/`feasibilityScore`
 * (w konkretnym mapowaniu store: `valueScore = marketGrowth`, `feasibilityScore =
 * clamp(6 - investmentLevel, 1, 5)` — `conclusionPrompts.ts:toElement`). Pack opisuje OBA
 * schematy wprost, nie zlewa ich w jeden.
 */

import { type ToolPack } from '../contract';

export const portfolioPriorityPack: ToolPack = {
  toolType: 'portfolio-priority',
  displayName: { pl: 'Priorytetyzacja portfela (BCG)', en: 'Portfolio Priority (BCG-style)' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, ale runtime DoD (Output/Report/approval) jeszcze nie
  // dowieziony — dlatego NIE RUNTIME_ACTIVE. Rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/portfolio/portfolioMatrixEngine.ts', verifiableInRepo: true },
    { source: 'src/config/portfolio/portfolioValueStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/portfolio/portfolioQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/portfolio/portfolioOrgImport.ts', verifiableInRepo: true },
    { source: 'src/config/portfolio/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/portfolio/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (PORTFOLIO_PRIORITY_STEPS, PortfolioItem)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Priorytetyzacja portfela inicjatyw/produktów w polu wartość×wykonalność, która kończy się kolejnością finansowania z zależnościami i budżetem, a nie kwadratem z kropkami.',
      en: 'A portfolio prioritization in a value×feasibility field that ends in a dependency- and budget-aware funding order, not a chart of dots.',
    },
    whatItIsNot: {
      pl: 'To nie jest głosowanie „co lubimy najbardziej" — ocena wartości lub wykonalności bez wskazanego źródła jest wymyśloną liczbą, nie dowodem.',
      en: 'It is not a "what do we like most" vote — a value or feasibility score with no named source is an invented number, not evidence.',
    },
    whenToUse: {
      pl: 'Przy alokacji ograniczonego budżetu/zasobów między wiele inicjatyw naraz, gdy trzeba jawnie powiedzieć co finansujemy pierwsze, a co odkładamy.',
      en: 'When allocating a limited budget/resources across many initiatives at once, when you must explicitly say what gets funded first and what waits.',
    },
    whenNotToUse: {
      pl: 'Gdy jest tylko jedna decyzja do podjęcia (nie portfel) albo gdy problemem jest kierunek wzrostu, nie kolejność finansowania (użyj Ansoff).',
      en: 'When there is only one decision to make (not a portfolio), or when the problem is growth direction, not funding order (use Ansoff).',
    },
    whyItMatters: {
      pl: 'Silnik liczy kwadrant 2×2 i kolejność finansowania deterministycznie z zaakceptowanych elementów, respektując zależności twarde i limit budżetu — mówi wprost, co jest odłożone i dlaczego (koszt alternatywny jawny).',
      en: 'The engine computes the 2×2 quadrant and the funding order deterministically from accepted elements, respecting hard dependencies and a budget cap — it names what is deferred and why (opportunity cost made explicit).',
    },
    inputsRequired: {
      pl: 'Lista kandydujących inicjatyw z oceną wartości i wykonalności (ze źródłem lub jawnym założeniem), znane zależności między nimi oraz limit budżetu/zdolności.',
      en: 'A list of candidate initiatives with value and feasibility scores (sourced or an explicit assumption), known dependencies between them, and a budget/capacity cap.',
    },
    roles: {
      pl: 'Właściciel portfela (zarząd/PMO), sponsorzy poszczególnych inicjatyw jako źródło dowodu, analityk finansowy dla budżetu.',
      en: 'Portfolio owner (board/PMO), individual initiative sponsors as the evidence source, financial analyst for the budget.',
    },
    outcome: {
      pl: 'Klasyfikacja 2×2 (quick-win/big-bet/fill-in/money-pit), kolejność finansowania z zależnościami i budżetem oraz rekomendowane ruchy z trade-offem.',
      en: 'A 2×2 classification (quick-win/big-bet/fill-in/money-pit), a funding order respecting dependencies and budget, and recommended moves with a trade-off.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    // Metoda klasyczna (macierz BCG, 1970); brak noty licencyjnej w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Ustalić, co w portfelu finansujemy najpierw, co odkładamy i dlaczego — z respektem dla zależności i budżetu.',
    en: 'Establish what in the portfolio gets funded first, what waits, and why — respecting dependencies and budget.',
  },
  useCases: [
    'Priorytetyzacja backlogu inicjatyw przed rokiem budżetowym',
    'Decyzja, które produkty/projekty finansować w warunkach ograniczonego budżetu',
    'Sekwencjonowanie portfela z twardymi zależnościami między elementami',
  ],
  contraindications: [
    'Pojedyncza decyzja bez wielu konkurujących opcji (nie ma czego portfelować)',
    'Pytanie o kierunek wzrostu, nie o kolejność finansowania (użyj Ansoff)',
    'Brak jakiejkolwiek oceny wartości/wykonalności — sesja wyprodukuje wymyślone liczby',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja portfela i kontekst', en: 'Portfolio Mission & Context' },
      goal: {
        pl: 'Zdefiniować zakres portfolio, ramę decyzji, ograniczenia i sygnał sukcesu.',
        en: 'Define the portfolio scope, decision frame, constraints, and success signal.',
      },
      whatGoodLooksLike: 'Jasny zakres portfela (które elementy w nim są) i budżet/limit zdolności.',
      evidenceToAskFor: 'Zakres, limit budżetu, kryterium sukcesu portfela.',
      completionCriterion: 'Zakres i budżet zaakceptowane przez właściciela portfela.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać dowody portfolio, ograniczenia, sygnały wyników i kontekst sponsora.',
        en: 'Capture portfolio evidence, constraints, performance signals, and sponsor context.',
      },
      whatGoodLooksLike: 'Sygnały przypisane do konkretnych elementów, nie ogólne „mamy dużo pomysłów".',
      evidenceToAskFor: 'Źródło każdej oceny wartości/wykonalności lub jawne założenie.',
      completionCriterion: 'Wystarczające sygnały, by ocenić co najmniej jeden element portfela.',
    },
    {
      id: 'items',
      title: { pl: 'Elementy portfela i macierz', en: 'Portfolio Items & Matrix' },
      goal: {
        pl: 'Ocenić elementy portfolio i sklasyfikować je w kategoriach BCG.',
        en: 'Score portfolio items and classify them into BCG-style categories.',
      },
      whatGoodLooksLike:
        'Każdy element ma ocenę wartości i wykonalności z drabiną źródeł (rungs) oraz jawnie zadeklarowane zależności od innych elementów.',
      evidenceToAskFor: 'Dla każdej liczby: sourceRef, benchmark lub jawne założenie.',
      completionCriterion: 'Co najmniej jeden zaakceptowany element sklasyfikowany do kwadrantu.',
    },
    {
      id: 'insights',
      title: { pl: 'Trade-offy i priorytety', en: 'Trade-offs & Priorities' },
      goal: {
        pl: 'Syntezować trade-offy, top bety i rekomendowane przesunięcia zasobów.',
        en: 'Synthesize trade-offs, portfolio bets, and recommended resource moves.',
      },
      whatGoodLooksLike: 'Kolejność finansowania respektuje zależności twarde i limit budżetu, odłożone elementy nazwane wprost.',
      evidenceToAskFor: 'Które elementy blokują inne (zależność twarda) i jaki jest limit budżetu.',
      completionCriterion: 'Sekwencja finansowania (funded/deferred/blocked/cycles) policzona przez silnik.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować final source summary oraz dalsze działania portfolio.',
        en: 'Prepare the final source summary and downstream portfolio actions.',
      },
      whatGoodLooksLike: 'Każdy ruch nazywa decyzję finansowania (invest/maintain/test/harvest/stop) z trade-offem.',
      evidenceToAskFor: 'Co odkładamy, finansując ten element, i jakim kosztem alternatywnym.',
      completionCriterion: 'Każdy ruch przechodzi validatePortfolioMove (rationale zakotwiczone w elementIds + trade-off + odrzucona alternatywa).',
    },
  ],

  questions: [
    {
      id: 'portfolio-mission-budget',
      phaseId: 'mission',
      prompt: {
        pl: 'Jaki jest realny limit budżetu/zdolności na ten portfel i co wchodzi w jego zakres?',
        en: 'What is the real budget/capacity cap for this portfolio, and what falls within its scope?',
      },
      answerType: 'text',
      challengeRule: 'Bez limitu budżetu silnik nie może odróżnić "finansujemy" od "odkładamy" — odrzuć portfel bez podanego capu lub jawnej decyzji "bez limitu".',
    },
    {
      id: 'portfolio-input-source',
      phaseId: 'input',
      prompt: {
        pl: 'Skąd pochodzi ocena wartości tego elementu — dana rynkowa, deklaracja sponsora, czy założenie?',
        en: 'Where does this element\'s value score come from — market data, sponsor declaration, or assumption?',
      },
      answerType: 'evidence',
      challengeRule:
        'portfolioValueStaircase.ts: liczba bez sourceRef ani jawnego "assumption" to invented-number — silnik degraduje ją do "declared, unconfirmed", nigdy nie traktuje jako pewną.',
    },
    {
      id: 'portfolio-items-dependency',
      phaseId: 'items',
      prompt: {
        pl: 'Czy ten element zależy od innego elementu w portfelu (musi wejść po nim), i czy to zależność twarda czy miękka?',
        en: 'Does this element depend on another element in the portfolio (must ship after it), and is that dependency hard or soft?',
      },
      answerType: 'choice',
      challengeRule:
        'portfolioValueStaircase.ts (dependency-not-declared): ocena wykonalności, która ignoruje prerekwizyt, jest fikcją, dopóki zależność nie zostanie zadeklarowana — sequencePortfolio respektuje TYLKO zadeklarowane zależności twarde.',
    },
    {
      id: 'portfolio-insights-quadrant',
      phaseId: 'insights',
      prompt: {
        pl: 'Które elementy to quick-win finansujące resztę, a które to money-pit, którego domyślnie nie finansujemy?',
        en: 'Which elements are quick-wins that self-fund the rest, and which are money-pits we default to not funding?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'portfolioMatrixEngine.ts (classifyQuadrant, midpoint=3): kwadrant liczony DETERMINISTYCZNIE z valueScore i feasibilityScore — nie przypisuj kwadrantu "po uważaniu"; money-pit domyślnie nie jest finansowany (fundMoneyPits=false).',
    },
    {
      id: 'portfolio-outputs-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co odkładacie, finansując ten element pierwszy, i jaki wariant odrzucacie (np. "wszystko naraz")?',
        en: 'What are you deferring by funding this element first, and which variant are you rejecting (e.g. "everything at once")?',
      },
      answerType: 'text',
      challengeRule:
        'portfolioMatrixEngine.ts (validatePortfolioMove): ruch bez trade-offu lub bez odrzuconej alternatywy nie przechodzi bramki W2 — kanoniczna odrzucona alternatywa to "finansujemy wszystko naraz" → "rozmycie zasobów".',
    },
  ],

  classificationRules:
    'DWA NIEZLANE schematy: (1) `PortfolioItem.category` — legacy pole danych elementu w klasycznej nomenklaturze BCG (star/cash-cow/question-mark/dog); ' +
    '(2) faktyczna klasyfikacja decyzyjna silnika `portfolioMatrixEngine.classifyQuadrant(valueScore, feasibilityScore, midpoint=3)` → ' +
    'quick-win (wysoka wartość + wysoka wykonalność) / big-bet (wysoka wartość + niska wykonalność) / fill-in (niska wartość + wysoka wykonalność) / ' +
    'money-pit (niska wartość + niska wykonalność). W konkretnym mapowaniu store (`conclusionPrompts.ts:toElement`): ' +
    'valueScore = marketGrowth (1-5), feasibilityScore = clamp(6 - investmentLevel, 1, 5). Klasyfikowane są WYŁĄCZNIE elementy zaakceptowane (isAcceptedElement).',
  evidenceExpectations:
    'Każda ocena (wartość i wykonalność) niesie drabinę rungs z lever (revenue/cost/risk/strategic dla wartości; effort/cost-to-build/capabilities/' +
    'dependencies dla wykonalności), claim, sourceRefs i opcjonalnym jawnym assumption. Rung bez sourceRefs i bez assumption to invented-number ' +
    '(portfolioValueStaircase.ts).',
  relationships:
    'sequencePortfolio: kolejność topologiczna respektująca zależności TWARDE (hard) między zaakceptowanymi elementami; wśród gotowych elementów ' +
    'preferuje wyższy valueScore, potem priorytet kwadrantu (quick-win > big-bet > fill-in > money-pit), potem niższy koszt; finansowanie zatrzymuje się ' +
    'po przekroczeniu budgetCap (reszta = deferred, koszt alternatywny jawny); money-pit domyślnie nie jest finansowany (fundMoneyPits=false); cykle ' +
    'twardych zależności są wykrywane i wykluczane z sekwencji.',
  interpretationRules:
    'Werdykt prowadzi od quick-winów, które samofinansują resztę portfela — nie jest listą 4 kwadrantów po równo. "Odłożone" (deferred) to uczciwe ' +
    '"nie zrobimy wszystkiego" z nazwanym powodem (limit budżetu); "zablokowane" (blocked) to inny fakt — brakująca twarda zależność, nie budżet.',
  completionCriteria:
    'Wszystkie zaakceptowane elementy sklasyfikowane do kwadrantu; sekwencja finansowania policzona (funded/deferred/blocked/cycles); ' +
    'każdy rekomendowany ruch przechodzi validatePortfolioMove (rationale zakotwiczone w istniejących elementId, trade-off kompletny ' +
    'chosen/deferred/cost, odrzucona alternatywa z powodem).',

  signatureArchetype: 'decision-matrix-portfolio',
  signatureRationale:
    'Decyzja portfelowa to pole 2×2 wartość×wykonalność Z NAŁOŻONĄ kolejnością finansowania (numerowana sekwencja + odłożone/zablokowane) — ' +
    'geometria musi pokazać sekwencję, nie tylko statyczne rozmieszczenie kropek w kwadrantach.',

  mapping: {
    output:
      'Niezmienny snapshot: klasyfikacja 2×2 zaakceptowanych elementów, sekwencja finansowania (funded z kolejnością/deferred z powodem/' +
      'blocked/cycles), rekomendowane ruchy z trade-offem i odrzuconą alternatywą.',
    report:
      'Sekcja decyzji portfelowej: pole 2×2 z sekwencją jako grafika sygnaturowa + werdykt jako narracja argument → dowód → implikacja. ' +
      'Renderowane deterministycznie z tego samego Artifact, nigdy ze zrzutu ekranu.',
    initiative:
      'Każdy zaakceptowany ruch (invest/maintain/test/harvest/stop) staje się kandydatem na inicjatywę portfelową, typowaną wg decyzji ' +
      'finansowania z portfolioMatrixEngine.ts / conclusionPrompts.ts.',
  },

  conclusion: {
    k1FactSource:
      'portfolioMatrixEngine.classifyPortfolio + sequencePortfolio — kwadrant 2×2 i kolejność finansowania (respektująca zależności i budżet) ' +
      'liczone deterministycznie z zaakceptowanych elementów. Żadna liczba w K1 (kwadrant, kolejność, koszt skumulowany) nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie sklasyfikowane elementy sesji, sekwencja finansowania i ograniczenia organizacji (limit budżetu). Zakaz benchmarków ' +
      'portfelowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność finansowania z sequencePortfolio (wartość malejąco, potem priorytet kwadrantu, potem niższy koszt, ograniczone budżetem ' +
      'i zależnościami twardymi). Model formułuje treść ruchu, nie kolejność ani kwadrant.',
    k4EffectRule:
      'Efekt = wynik portfelowy, behawioralnie obserwowalny, z horyzontem czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch ma tradeoff {chosen, deferred, cost} ORAZ rejectedAlternative {option, reason} — oba obowiązkowe (validatePortfolioMove). ' +
      'Kanoniczna odrzucona alternatywa: "finansujemy wszystko naraz" → "rozmycie zasobów".',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/portfolio',
    questionBankModule: 'src/config/portfolio/portfolioQuestionBank.ts',
    expectedQuestionNodeCount: 4,
    bankBackedPhaseIds: ['items'],
    rendererComponent: 'src/components/DiscoveryTools/tools/PortfolioPriority',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Macierz wzrost/udział, wdrożona jako macierz wartość×wykonalność (quick-win/big-bet/fill-in/money-pit)',
    commonlyAttributedTo: 'Boston Consulting Group (Bruce D. Henderson), ok. 1968-1970',
    sourceUsed: 'src/config/portfolio/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'RYZYKO PODWYŻSZONE — BCG jest działającą, konkurencyjną firmą doradczą, nie źródłem historycznym. Użycie „BCG" w powierzchni klienckiej wymaga przeglądu przed publikacją.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — najwyższe w grupie strategicznej. Uwaga: w kodzie współistnieją DWA schematy klasyfikacji (legacy star/cash-cow/question-mark/dog vs silnikowy quick-win/big-bet/fill-in/money-pit).',
  },
};
