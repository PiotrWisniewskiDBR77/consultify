/**
 * Tool Pack — Growth Paths / Ansoff Matrix.
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/ansoff/moveValidator.ts` (scoring ścieżek, ranking, wykrywanie luk
 *   pokrycia, walidator ruchów W2)
 * - `src/config/ansoff/deepeningLadder.ts` (per-ćwiartkowa drabina głębi + baza propozycji)
 * - `src/config/ansoff/ansoffQuestionBank.ts` (rozgałęziona drabina pytań L1-L4)
 * - `src/config/ansoff/conclusionPrompts.ts` (kontrakt promptu domykającego)
 * - `src/store/useToolStore.ts` GROWTH_PATHS_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 *
 * Id faz są ZGODNE z runtime (mission/input/options/insights/outputs) — pack nie
 * wprowadza równoległej nomenklatury.
 */

import { type ToolPack } from '../contract';

export const growthPathsPack: ToolPack = {
  toolType: 'growth-paths',
  displayName: { pl: 'Ścieżki wzrostu (Ansoff)', en: 'Growth Paths (Ansoff)' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, ale runtime DoD (Output/Report/approval) jeszcze nie
  // dowieziony — dlatego NIE RUNTIME_ACTIVE. Rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/ansoff/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/ansoff/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/ansoff/ansoffQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/ansoff/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/ansoff/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (GROWTH_PATHS_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Porównanie czterech ścieżek wzrostu wg dopasowania (atrakcyjność × wykonalność), które kończy się sekwencją ruchów, a nie listą pomysłów.',
      en: 'A comparison of four growth paths by fit (attractiveness × feasibility) that ends in a move sequence, not a wishlist of ideas.',
    },
    whatItIsNot: {
      pl: 'To nie jest burza mózgów pomysłów na wzrost — opcja bez dowodu (sygnału, źródła) nie wchodzi do rankingu jako pewna.',
      en: 'It is not a growth-ideas brainstorm — an option with no evidence (signal, source) does not enter the ranking as certain.',
    },
    whenToUse: {
      pl: 'Przy decyzji o kierunku wzrostu: nowy rynek, nowy produkt, głębsza penetracja obecnych klientów lub dywersyfikacja.',
      en: 'When deciding a growth direction: a new market, a new product, deeper penetration of current customers, or diversification.',
    },
    whenNotToUse: {
      pl: 'Gdy pytanie dotyczy struktury konkurencji (użyj Sił rynkowych) albo redukcji kosztów bez ambicji wzrostu (użyj Łańcucha wartości).',
      en: 'When the question is about competitive structure (use Market Forces) or cost reduction without a growth ambition (use Value Chain).',
    },
    whyItMatters: {
      pl: 'Silnik liczy dopasowanie każdej ćwiartki (atrakcyjność × wykonalność, 1-9) z ocenionych opcji i wykrywa nierówno rozłożone ryzyko — np. zakład wyłącznie na dywersyfikację bez bazy.',
      en: 'The engine computes each quadrant\'s fit (attractiveness × feasibility, 1-9) from scored options and detects lopsided risk — e.g. betting only on diversification with no base.',
    },
    inputsRequired: {
      pl: 'Ambicja wzrostu i horyzont, sygnały o obecnych klientach/produktach, dowody popytu na nowe rynki/produkty oraz osoba znająca realne zdolności zespołu.',
      en: 'A growth ambition and horizon, signals about current customers/products, demand evidence for new markets/products, and someone who knows the team\'s real capabilities.',
    },
    roles: {
      pl: 'Właściciel decyzji wzrostu (zarząd/growth lead), lider produktu lub sprzedaży jako źródło dowodu, analityk rynkowy.',
      en: 'Growth decision owner (board/growth lead), product or sales lead as the evidence source, market analyst.',
    },
    outcome: {
      pl: 'Ranking czterech ścieżek z uzasadnieniem, wykryte luki pokrycia (brak dowodu, niezrównoważone ryzyko) oraz sekwencja ruchów z trade-offem i odrzuconym wariantem.',
      en: 'A ranking of the four paths with rationale, detected coverage gaps (no evidence, unbalanced risk), and a move sequence with a trade-off and a rejected variant.',
    },
    estimatedEffort: '2–3 h sesji roboczej',
    // Metoda klasyczna (Ansoff, 1957); brak noty licencyjnej w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Wybrać, którą ścieżkę wzrostu ścigać najpierw, a którą świadomie odroczyć, i dlaczego.',
    en: 'Choose which growth path to chase first, which to deliberately defer, and why.',
  },
  useCases: [
    'Planowanie roku wzrostu / przegląd portfela wzrostu przed budżetem',
    'Decyzja o wejściu na nowy rynek geograficzny lub segment',
    'Ocena, czy dywersyfikacja jest uzasadniona, czy to zakład bez bazy',
  ],
  contraindications: [
    'Pytanie o strukturę konkurencji, nie o kierunek wzrostu (użyj Sił rynkowych)',
    'Cel jest czysto kosztowy, bez ambicji wzrostu (użyj Łańcucha wartości)',
    'Brak jakiegokolwiek dowodu popytu — sesja wyprodukuje same założenia',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja wzrostu i kontekst', en: 'Growth Mission & Context' },
      goal: {
        pl: 'Zdefiniować ambicję wzrostu, zakres, ograniczenia i sygnał sukcesu.',
        en: 'Define the growth ambition, scope, constraints, and success signal.',
      },
      whatGoodLooksLike: 'Jedna ostra ambicja wzrostu z horyzontem i ograniczeniami zasobowymi.',
      evidenceToAskFor: 'Horyzont, budżet/zdolności dostępne, kryterium sukcesu.',
      completionCriterion: 'Ambicja wzrostu zaakceptowana przez właściciela decyzji.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały wzrostu z wywiadów, kontekstu organizacji i rynku.',
        en: 'Capture growth signals from interviews, organization context, and market evidence.',
      },
      whatGoodLooksLike: 'Sygnały przypisane do konkretnej ćwiartki Ansoffa, nie ogólne „jest potencjał".',
      evidenceToAskFor: 'Źródło każdego sygnału popytu/zdolności.',
      completionCriterion: 'Wystarczające sygnały, by rozpocząć ładder pytań dla co najmniej jednej ćwiartki.',
    },
    {
      id: 'options',
      title: { pl: 'Budowa opcji Ansoffa', en: 'Ansoff Options Build' },
      goal: {
        pl: 'Zamienić sygnały w opcje wzrostu w czterech polach Ansoffa.',
        en: 'Turn signals into growth options across the four Ansoff quadrants.',
      },
      whatGoodLooksLike:
        'Każda opcja ma impact/effort/riskLevel i — jeśli dotyczy dywersyfikacji — przejście bramki capability-gate (istniejąca zdolność lub nazwana luka do zbudowania/kupienia).',
      evidenceToAskFor: 'Odpowiedzi na drabinę L1-L4 (roszczenie wzrostu → wymuszony dowód → kwantyfikacja → sekwencja i zdolność).',
      completionCriterion: 'Co najmniej jedna zaakceptowana opcja w co najmniej jednej ćwiartce.',
    },
    {
      id: 'insights',
      title: { pl: 'Porównanie strategiczne', en: 'Strategic Comparison' },
      goal: {
        pl: 'Porównać opcje, pokazać trade-offy i wybrać rekomendowane ruchy wzrostu.',
        en: 'Compare options, expose trade-offs, and select recommended growth moves.',
      },
      whatGoodLooksLike: 'Ranking ćwiartek z jawną przyczyną (score, ryzyko), luki pokrycia nazwane wprost.',
      evidenceToAskFor: 'Które ćwiartki mają dowód, które są zakładem bez bazy.',
      completionCriterion: 'Ranking policzony przez silnik z zaakceptowanych opcji; luki pokrycia wykryte.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować final source summary oraz dalsze inicjatywy wzrostowe.',
        en: 'Prepare the final source summary and downstream growth initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch ma rationale, trade-off i odrzucony wariant, nie jest życzeniem.',
      evidenceToAskFor: 'Co świadomie NIE robimy wybierając dany ruch i dlaczego.',
      completionCriterion: 'Każdy ruch przechodzi validateW2Move (rationale, trade-off, odrzucony wariant — żadne pole nie jest puste ani zbyt cienkie).',
    },
  ],

  questions: [
    {
      id: 'ansoff-mission-ambition',
      phaseId: 'mission',
      prompt: {
        pl: 'Jaki konkretny wzrost (ile, w jakim horyzoncie) ma wesprzeć ta analiza?',
        en: 'What specific growth (how much, by when) should this analysis support?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć „chcemy rosnąć" bez liczby i horyzontu — bez konkretu nie da się ocenić wykonalności żadnej ścieżki.',
    },
    {
      id: 'ansoff-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Skąd wiecie, że jest popyt na to rozszerzenie — dowód sprzedażowy, wywiad z klientem, czy założenie?',
        en: 'How do you know there is demand for this expansion — sales evidence, customer interview, or assumption?',
      },
      answerType: 'evidence',
      challengeRule:
        'Zgodnie z ansoffQuestionBank.ts (ans-evidence-force): opcja bez sygnału MUSI nazwać konkretny dowód, inaczej pytanie zapętla się na sobie — nie pozwól, by weszła do rankingu jako pewna.',
    },
    {
      id: 'ansoff-options-capability',
      phaseId: 'options',
      prompt: {
        pl: 'Czy zespół ma już zdolność do wykonania tej ścieżki (kanał, produkt, ekspertyza kategorii), czy trzeba ją najpierw zbudować lub kupić?',
        en: 'Does the team already have the capability to execute this path (channel, product, category expertise), or must it be built or bought first?',
      },
      answerType: 'choice',
      challengeRule:
        'ansoffQuestionBank.ts (ans-capability-gate, L4): opcja przypisana do dywersyfikacji bez nazwanej zdolności (posiadanej lub planowanej) to życzenie, nie ścieżka — brak przejścia bramki capability-gate blokuje sekwencjonowanie.',
    },
    {
      id: 'ansoff-insights-ranking',
      phaseId: 'insights',
      prompt: {
        pl: 'Która ćwiartka ma najwyższe dopasowanie i czy portfel wzrostu opiera się wyłącznie na najryzykowniejszej z nich?',
        en: 'Which quadrant has the highest fit, and does the growth portfolio rest entirely on the riskiest one?',
      },
      answerType: 'list',
      challengeRule:
        'moveValidator.ts (detectGrowthPathGaps, unbalanced-risk): jeśli penetracja, rozwój rynku i rozwój produktu są puste, a portfel opiera się wyłącznie na dywersyfikacji — to najwyższe ryzyko bez stabilnej bazy, nazwij to wprost.',
    },
    {
      id: 'ansoff-outputs-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co odkładacie, wybierając tę ścieżkę jako pierwszą, i jaki wariant świadomie odrzucacie?',
        en: 'What are you deferring by choosing this path first, and which variant are you deliberately rejecting?',
      },
      answerType: 'text',
      challengeRule:
        'moveValidator.ts (validateW2Move): ruch bez trade-offu lub bez odrzuconego wariantu (< 12 znaków liczy się jako puste/zbyt cienkie) nie przechodzi bramki W2.',
    },
  ],

  classificationRules:
    'Cztery ćwiartki Ansoffa: marketPenetration, marketDevelopment, productDevelopment, diversification (moveValidator.ts). ' +
    'Attractiveness ćwiartki = średni impact zaakceptowanych opcji (high=3/medium=2/low=1). Feasibility = effortEase×0.6 + evidenceRatio×2×0.4 + ' +
    '(4-baseRisk)×0.2, gdzie baseRisk Ansoffa rośnie penetracja(1)→rozwój rynku/produktu(2)→dywersyfikacja(3). Score = attractiveness × feasibility (1-9).',
  evidenceExpectations:
    'Każda opcja ma impact/effort/riskLevel oraz opcjonalnie evidence[]. evidenceRatio (opcje z dowodem / wszystkie w ćwiartce) podnosi feasibility ' +
    'i obniża residualne ryzyko — ćwiartka bez ani jednego dowodu jest oznaczana jako "zakład ubrany w plan" (no-evidence gap).',
  relationships:
    'rankGrowthPaths sortuje ćwiartki po score malejąco, przy remisie niższe ryzyko wygrywa, potem wyższa attractiveness. ' +
    'detectGrowthPathGaps wykrywa: brak dowodu w ćwiartce z opcjami, niezrównoważone ryzyko (bezpieczne ćwiartki puste, portfel tylko na dywersyfikacji), ' +
    'całkowicie pusty portfel.',
  interpretationRules:
    'Werdykt nazywa najsilniejszą i najsłabszą ścieżkę wprost z liczbą (score/9, ryzyko/3), nie jest listą czterech opisów. ' +
    'Ćwiartka z opcjami, ale bez dowodu, nie jest planem — jest zakładem, i tak musi być nazwana w interpretacji.',
  completionCriteria:
    'Ranking policzony przez silnik z co najmniej jednej ćwiartki z zaakceptowanymi opcjami; sekwencja ruchów W2 (buildW2MoveSequence) wygenerowana ' +
    '— zaczyna od najsilniejszej ścieżki, wstawia validate-first przy słabym dowodzie, jawnie odracza najsłabszą; każdy ruch przechodzi validateW2Move ' +
    '(rationale + trade-off + odrzucony wariant, min. 12 znaków każde, nie puste).',

  signatureArchetype: 'quadrant-strategic-field',
  signatureRationale:
    'Macierz Ansoffa jest z definicji polem 2×2 (produkty istniejące/nowe × rynki istniejące/nowe) — geometria musi pokazywać cztery ' +
    'ścieżki jednocześnie z ich dopasowaniem (score), nie cztery osobne listy opcji.',

  mapping: {
    output:
      'Niezmienny snapshot: ranking ścieżek z score/attractiveness/feasibility/risk, wykryte luki pokrycia, sekwencja ruchów z trade-offem ' +
      'i odrzuconym wariantem.',
    report:
      'Sekcja decyzji o wzroście: pole Ansoffa jako grafika sygnaturowa + ranking jako narracja argument → dowód → implikacja. ' +
      'Renderowane deterministycznie z tego samego Artifact, nigdy ze zrzutu ekranu.',
    initiative:
      'Każdy zaakceptowany ruch (scale-core/enter-market/build-product/diversify/validate-first) staje się kandydatem na inicjatywę ' +
      'wzrostową, typowaną wg kategorii ćwiartki z moveValidator.ts.',
  },

  conclusion: {
    k1FactSource:
      'moveValidator.rankGrowthPaths (scoreQuadrant) — attractiveness, feasibility i score każdej ćwiartki liczone deterministycznie ' +
      'z zaakceptowanych opcji. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie opcje sesji, ich dowody i profil organizacji. Zakaz statystyk rynkowych spoza wsadu.',
    k3PrioritySource:
      'Sekwencja z buildW2MoveSequence: najpierw najsilniejsza ścieżka (najwyższy score, najniższe ryzyko), validate-first gdy dowód słaby ' +
      '(evidenceRatio < 0.5), potem druga ścieżka, na końcu jawne odroczenie najsłabszej. Model formułuje treść, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z K3, mieć horyzont czasowy i być obserwowalny behawioralnie. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch ma rationale + tradeOff + rejectedVariant — wszystkie trzy pola obowiązkowe i niecienkie (validateW2Move, min. 12 znaków). ' +
      'Ruch bez trade-offu lub odrzuconego wariantu nie przechodzi bramki.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/ansoff',
    questionBankModule: 'src/config/ansoff/ansoffQuestionBank.ts',
    expectedQuestionNodeCount: 5,
    bankBackedPhaseIds: ['options'],
    rendererComponent: 'src/components/DiscoveryTools/tools/GrowthPaths',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Macierz Ansoffa',
    commonlyAttributedTo: 'H. Igor Ansoff, HBR 1957',
    sourceUsed: 'src/config/ansoff/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Nie znaleziono znaku towarowego; tekst artykułu z 1957 objęty prawem autorskim, nie reprodukowany.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'ŚREDNIE — szeroko używana bez atrybucji w praktyce doradczej, brak formalnego potwierdzenia w repo.',
  },
};
