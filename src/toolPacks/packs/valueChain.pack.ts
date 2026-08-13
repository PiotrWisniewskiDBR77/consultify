/**
 * Tool Pack — Value Chain (Porter's Value Chain).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/valuechain/valueChainMarginEngine.ts` (mapa marży twórcy/drenaż,
 *   kandydaci na dźwignię, walidator ruchów W2)
 * - `src/config/valuechain/valueChainInsightStaircase.ts` (drabina R1→R4 per ogniwo
 *   + detektor niepopartych ocen)
 * - `src/config/valuechain/valueChainQuestionBank.ts` (9 aktywności, drabina pytań)
 * - `src/config/valuechain/conclusionPrompts.ts` (kontrakt W2 dla bloku domykającego)
 * - `src/store/useToolStore.ts` VALUE_CHAIN_STEPS (id faz runtime), ValueActivity/
 *   ValueChainMove (kształt danych)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 *
 * Id faz są ZGODNE z runtime (mission/input/activities/insights/outputs) — pack nie
 * wprowadza równoległej nomenklatury.
 */

import { type ToolPack } from '../contract';

export const valueChainPack: ToolPack = {
  toolType: 'value-chain',
  displayName: { pl: 'Łańcuch wartości (Porter)', en: 'Value Chain (Porter)' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, ale runtime DoD (Output/Report/approval) jeszcze nie
  // dowieziony — dlatego NIE RUNTIME_ACTIVE. Rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/valuechain/valueChainMarginEngine.ts', verifiableInRepo: true },
    { source: 'src/config/valuechain/valueChainInsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/valuechain/valueChainQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/valuechain/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (VALUE_CHAIN_STEPS, ValueActivity, ValueChainMove)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Mapa 9 ogniw działalności, która kończy się mapą marży (kto ją tworzy, kto ją zjada) i 2-3 dźwigniami, a nie inwentarzem procesów.',
      en: 'A map of 9 activities that ends in a margin map (who creates it, who eats it) and 2-3 levers, not a process inventory.',
    },
    whatItIsNot: {
      pl: 'To nie jest lista procesów z etykietami „kosztowne" czy „ręczne" — ocena bez dowodu kosztowo-wartościowego to folklor, nie ustalenie.',
      en: 'It is not a process list with labels like "expensive" or "manual" — a rating with no cost-value proof is folklore, not a finding.',
    },
    whenToUse: {
      pl: 'Przy decyzji o strukturze kosztów, wyborze między usprawnij/zautomatyzuj/outsourcuj/zintegruj, albo ocenie źródła przewagi kosztowej lub różnicowania.',
      en: 'When deciding on cost structure, choosing between improve/automate/outsource/integrate, or assessing the source of cost advantage or differentiation.',
    },
    whenNotToUse: {
      pl: 'Gdy pytanie dotyczy kierunku wzrostu (użyj Ansoff) albo struktury konkurencji na rynku (użyj Sił rynkowych).',
      en: 'When the question is about growth direction (use Ansoff) or market competitive structure (use Market Forces).',
    },
    whyItMatters: {
      pl: 'Silnik liczy dźwignię każdego ogniwa (leverScore = koszt/wartość × luka dojrzałości) i rankinguje 2-3 ogniwa o najwyższej dźwigni — zamiast rozmowy o wszystkim naraz, wskazuje gdzie ruch się opłaca najbardziej.',
      en: 'The engine computes each activity\'s leverage (leverScore = cost/value × maturity gap) and ranks the top 2-3 highest-leverage activities — instead of discussing everything at once, it names where a move pays off most.',
    },
    inputsRequired: {
      pl: 'Pytanie decyzyjne o kosztach/różnicowaniu, dane o strukturze kosztów per ogniwo, ocena dojrzałości względem benchmarku oraz osoba znająca realia operacyjne.',
      en: 'A cost/differentiation decision question, per-activity cost-structure data, a maturity assessment vs a benchmark, and someone who knows operational reality.',
    },
    roles: {
      pl: 'Właściciel decyzji kosztowej (COO/CFO), liderzy operacji jako źródło dowodu, analityk kosztów.',
      en: 'Cost decision owner (COO/CFO), operations leads as the evidence source, cost analyst.',
    },
    outcome: {
      pl: 'Mapa marży (twórcy vs drenaż), 2-3 ogniwa-dźwignie z uzasadnieniem oraz rekomendowane ruchy (usprawnij/zautomatyzuj/outsourcuj/zintegruj) z trade-offem.',
      en: 'A margin map (creators vs drains), 2-3 lever activities with rationale, and recommended moves (improve/automate/outsource/integrate) with a trade-off.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    // Metoda klasyczna (Porter, 1985); brak noty licencyjnej w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Ustalić, które ogniwo łańcucha wartości tworzy marżę, które ją drenuje, i jaki ruch najpierw poprawi wynik.',
    en: 'Establish which value-chain activity creates margin, which drains it, and what move improves the outcome first.',
  },
  useCases: [
    'Przegląd struktury kosztów przed decyzją o outsourcingu',
    'Ocena źródła przewagi kosztowej lub różnicowania przed pozycjonowaniem',
    'Priorytetyzacja inwestycji operacyjnych między ogniwami',
  ],
  contraindications: [
    'Pytanie o kierunek wzrostu, nie o strukturę kosztów (użyj Ansoff)',
    'Pytanie o strukturę konkurencji na rynku (użyj Sił rynkowych)',
    'Brak jakichkolwiek danych kosztowych — sesja wyprodukuje same etykiety bez dowodu',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja i zakres', en: 'Mission & Scope' },
      goal: {
        pl: 'Zdefiniować biznes, zakres łańcucha wartości, pozycjonowanie i sygnał sukcesu.',
        en: 'Define the business, value chain scope, strategic positioning, and success signal.',
      },
      whatGoodLooksLike: 'Jedno ostre pytanie o koszt/różnicowanie z zakresem łańcucha i horyzontem.',
      evidenceToAskFor: 'Zakres biznesu, obecne pozycjonowanie (koszt vs różnicowanie), kryterium sukcesu.',
      completionCriterion: 'Zakres i pozycjonowanie zaakceptowane przez właściciela decyzji.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały kosztu, operacji i różnicowania z kontekstu i wywiadów.',
        en: 'Capture cost, operations, and differentiation signals from context and interviews.',
      },
      whatGoodLooksLike: 'Sygnały przypisane do konkretnego ogniwa, nie ogólne „operacje są nieefektywne".',
      evidenceToAskFor: 'Źródło każdego sygnału kosztowego/wartościowego.',
      completionCriterion: 'Wystarczające sygnały, by rozpocząć ocenę co najmniej jednego ogniwa.',
    },
    {
      id: 'activities',
      title: { pl: 'Budowa łańcucha wartości', en: 'Value Chain Build' },
      goal: {
        pl: 'Zmapować 9 aktywności wg kontrybucji kosztu, wartości i roli w marży.',
        en: 'Map the 9 activities with cost contribution, value contribution, and margin role.',
      },
      whatGoodLooksLike:
        'Każde ocenione ogniwo ma staircase R1→R4 (powierzchnia → dowód kosztowo-wartościowy → benchmark → potencjał), nie samą etykietę.',
      evidenceToAskFor: 'Udział w koszcie ORAZ wpływ na wartość dla klienta (obie strony, nie jedna).',
      completionCriterion: 'Co najmniej jedno ogniwo prymarne i jedno wsparcia ocenione, mapa marży ma gradient (≥1 twórca i ≥1 drenaż).',
    },
    {
      id: 'insights',
      title: { pl: 'Dźwignie marży i ruchy', en: 'Margin Levers & Moves' },
      goal: {
        pl: 'Przekształcić łańcuch w dźwignie marży, werdykt pozycjonowania i ruchy strategiczne.',
        en: 'Synthesize the chain into margin levers, a positioning verdict, and strategic moves.',
      },
      whatGoodLooksLike: '2-3 ogniwa o najwyższej dźwigni nazwane wprost, nie lista wszystkich 9 aktywności.',
      evidenceToAskFor: 'Które ogniwa mają najwyższy leverScore i sugerowany typ ruchu.',
      completionCriterion: 'Mapa marży i kandydaci na dźwignię policzeni przez silnik z ocenionych aktywności.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować final source summary oraz wygenerować wyniki i inicjatywy.',
        en: 'Prepare the final source summary and generate downstream outputs and initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch nazywa decyzję (usprawnij/zautomatyzuj/outsourcuj/zintegruj) z trade-offem.',
      evidenceToAskFor: 'Co tracimy kontroli/zależności wybierając dany ruch (szczególnie outsourcing).',
      completionCriterion: 'Każdy ruch przechodzi validateValueChainMove (rationale zakotwiczone + trade-off + odrzucona alternatywa + pierwszy krok).',
    },
  ],

  questions: [
    {
      id: 'valuechain-mission-position',
      phaseId: 'mission',
      prompt: {
        pl: 'Czy dziś konkurujecie głównie kosztem, czy różnicowaniem, i jaka decyzja kosztowa ma wyjść z tej sesji?',
        en: 'Do you compete mainly on cost or on differentiation today, and what cost decision should come out of this session?',
      },
      answerType: 'text',
      challengeRule: 'Odrzuć odpowiedź bez nazwanego pozycjonowania — bez tego nie da się ocenić, czy ogniwo tworzy czy zjada marżę.',
    },
    {
      id: 'valuechain-input-signal',
      phaseId: 'input',
      prompt: {
        pl: 'Które ogniwo dziś najbardziej boli — kosztem albo jakością — i skąd to wiecie?',
        en: 'Which activity hurts the most today — on cost or quality — and how do you know?',
      },
      answerType: 'evidence',
      challengeRule: 'Sygnał bez wskazanego ogniwa (inboundLogistics/operations/.../procurement) nie da się przypisać do mapy marży.',
    },
    {
      id: 'valuechain-activities-proof',
      phaseId: 'activities',
      prompt: {
        pl: 'Jaki jest udział tego ogniwa w koszcie CAŁKOWITYM i jak wpływa na to, ile klient jest gotów zapłacić?',
        en: 'What is this activity\'s share of TOTAL cost, and how does it affect what the customer is willing to pay?',
      },
      answerType: 'evidence',
      challengeRule:
        'valueChainInsightStaircase.ts (VAGUE_TERMS/needs-cost-value-split): etykieta „kosztowne", „ręczne" czy „silne" bez dowodu nazywającego OBIE strony (koszt I wartość) to folklor — silnik ją odrzuca.',
    },
    {
      id: 'valuechain-insights-lever',
      phaseId: 'insights',
      prompt: {
        pl: 'Które 2-3 ogniwa mają jednocześnie wysoki koszt/wartość i słabą dojrzałość — czyli największą dźwignię?',
        en: 'Which 2-3 activities combine high cost/value with weak maturity — i.e. the highest leverage?',
      },
      answerType: 'list',
      challengeRule:
        'deriveLeverCandidates rankinguje po leverScore (koszt lub wartość × luka dojrzałości) — nie wybieraj dźwigni „po uważaniu", tylko z rankingu silnika.',
    },
    {
      id: 'valuechain-outputs-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Jeśli rekomendujecie outsourcing tego ogniwa — jakiej kontroli się zrzekacie i jaką zależność przyjmujecie?',
        en: 'If you recommend outsourcing this activity — what control are you giving up, and what dependency are you taking on?',
      },
      answerType: 'text',
      challengeRule:
        'valueChainMarginEngine.ts (validateValueChainMove): outsourcing bez nazwania utraconej kontroli i przyjętej zależności to pułapka, nie decyzja — trade-off i odrzucona alternatywa są obowiązkowe.',
    },
  ],

  classificationRules:
    '9 aktywności: 5 prymarnych (inboundLogistics, operations, outboundLogistics, marketingSales, service) i 4 wsparcia (infrastructure, ' +
    'hrManagement, technology, procurement). Ocenione ogniwo ma costContribution/valueContribution (high=3/medium=2/low=1), maturity ' +
    '(weak=3/adequate=2/strong=1 = maturityGap) i marginRole ∈ {creator, neutral, drain}. leverScore: drain = cost × maturityGap; ' +
    'creator = value × maturityGap; neutral = ((cost+value)/2) × maturityGap (valueChainMarginEngine.computeMarginMap).',
  evidenceExpectations:
    'Każde ogniwo niesie staircase R1 (surface — praktyka dziś), R2 (costValueProof z proofRefs — MUSI nazywać obie strony: koszt i wartość), ' +
    'R3 (benchmark — dojrzałość vs referencja), R4 (potential — dźwignia). Ogniwo bez dowodu ma proofRefs=[] i evidenceStatus="declared".',
  relationships:
    'Kandydaci na dźwignię to top 2-3 ogniwa wg leverScore malejąco (remisy: wyższy koszt, potem wyższa luka dojrzałości). Sugerowany typ ruchu: ' +
    'drenaż wsparcia → outsource; drenaż prymarny kosztowny (cost≥3) → cost-reduction, inaczej outsource; twórca → value-enhancement; ' +
    'neutralne wsparcie → linkage-optimization (deriveLeverCandidates/suggestLeverType).',
  interpretationRules:
    'Mapa marży ma "gradient" tylko gdy istnieje ≥1 twórca I ≥1 drenaż (computeMarginMapCoverage.hasGradient) — bez tego to inwentarz, ' +
    'nie analiza. Werdykt musi nazwać, gdzie marża jest tworzona vs drenowana i którą dźwignię pociągnąć NAJPIERW, nie uśredniać 9 ocen.',
  completionCriteria:
    'Co najmniej jedno ogniwo prymarne i jedno wsparcia ocenione (isScoredActivity); mapa marży ma gradient (≥1 creator i ≥1 drain); ' +
    'każdy rekomendowany ruch przechodzi validateValueChainMove (rationale zakotwiczone w istniejących activityId/leverId, trade-off ' +
    'kompletny chosen/deferred/cost, odrzucona alternatywa z powodem).',

  signatureArchetype: 'flow-value-stream',
  signatureRationale:
    'Łańcuch wartości jest z natury liniowym strumieniem 5 aktywności prymarnych podpartych 4 aktywnościami wsparcia, płynących do marży — ' +
    'geometria musi pokazać strumień z gradientem kosztu/wartości nałożonym na przepływ, nie tabelę 9 wierszy.',

  mapping: {
    output:
      'Niezmienny snapshot: mapa marży (twórcy vs drenaż, koszt w każdym), 2-3 ogniwa-dźwignie z uzasadnieniem, rekomendowane ruchy ' +
      'z trade-offem i odrzuconą alternatywą.',
    report:
      'Sekcja strategii kosztowej: strumień łańcucha jako grafika sygnaturowa + mapa marży jako narracja argument → dowód → implikacja. ' +
      'Renderowane deterministycznie z tego samego Artifact, nigdy ze zrzutu ekranu.',
    initiative:
      'Każdy zaakceptowany ruch (cost-advantage/differentiation/linkage-optimization/capability-build/restructure) staje się kandydatem ' +
      'na inicjatywę operacyjną lub kosztową, typowaną wg kategorii ruchu z valueChainMarginEngine.ts.',
  },

  conclusion: {
    k1FactSource:
      'valueChainMarginEngine.computeMarginMap + deriveLeverCandidates — pole (creator/neutral/drain), koszt, wartość, luka dojrzałości ' +
      'i leverScore każdego ogniwa liczone deterministycznie z ocenionych aktywności. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie ocenione aktywności sesji, werdykt pozycjonowania i profil organizacji. Zakaz benchmarków branżowych spoza wsadu.',
    k3PrioritySource:
      'Ranking leverScore (top 2-3 ogniwa) z buildValueChainMovePromptRules — ruch to jedna z czterech decyzji: usprawnij/zautomatyzuj/' +
      'outsourcuj/zintegruj. Model formułuje treść, nie ranking.',
    k4EffectRule:
      'Efekt = spadek kosztu lub wzrost wartości/różnicowania, behawioralnie obserwowalny, z horyzontem czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch ma tradeoff {chosen, deferred, cost} ORAZ rejectedAlternative {option, reason} — oba obowiązkowe (validateValueChainMove). ' +
      'Outsourcing bez nazwania utraconej kontroli i przyjętej zależności jest pułapką, nie decyzją.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/valuechain',
    questionBankModule: 'src/config/valuechain/valueChainQuestionBank.ts',
    expectedQuestionNodeCount: 9,
    bankBackedPhaseIds: ['activities'],
    rendererComponent: 'src/components/DiscoveryTools/tools/ValueChain',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Analiza łańcucha wartości',
    commonlyAttributedTo: 'Michael E. Porter, „Competitive Advantage" 1985',
    sourceUsed: 'src/config/valuechain/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Nie znaleziono znaku towarowego; tekst książki z 1985 objęty prawem autorskim, nie reprodukowany.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — ta sama klasa ryzyka co Pięć Sił.',
  },
};
