/**
 * Tool Pack — Risk & Uncertainty (probability × impact matrix + resilience moves).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/riskuncertainty/riskMatrixEngine.ts` (macierz 2×2 P×I, strefy, reakcje domyślne)
 * - `src/config/riskuncertainty/moveValidator.ts` (rankRisks, exposure = P×I, W2 buildW2MoveSequence)
 * - `src/config/riskuncertainty/riskInsightStaircase.ts` (rozróżnienie known-unknown / unknown-unknown)
 * - `src/config/riskuncertainty/riskQuestionBank.ts` (laddered question bank L1-L4 per ryzyko)
 * - `src/config/riskuncertainty/raidHandoff.ts` (przekazanie do RAID inicjatywy)
 * - `src/config/riskuncertainty/conclusionPrompts.ts` (kontrakt W2)
 * - `src/store/useToolStore.ts` (RISK_UNCERTAINTY_STEPS — id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/assumptions/insights/outputs) — pack
 * nie wprowadza równoległej nomenklatury.
 */

import { type ToolPack } from '../contract';

export const riskUncertaintyPack: ToolPack = {
  toolType: 'risk-uncertainty',
  displayName: { pl: 'Ryzyko i niepewność', en: 'Risk & Uncertainty' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/riskuncertainty/riskMatrixEngine.ts', verifiableInRepo: true },
    { source: 'src/config/riskuncertainty/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/riskuncertainty/riskInsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/riskuncertainty/riskQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/riskuncertainty/raidHandoff.ts', verifiableInRepo: true },
    { source: 'src/config/riskuncertainty/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (RISK_UNCERTAINTY_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Klasyczne rozróżnienie Knighta (risk vs. uncertainty) — brak noty licencyjnej w repo',
      verifiableInRepo: false,
      note: 'Metoda z domeny publicznej ekonomii decyzji; brak potwierdzonego źródła licencyjnego w repo (L10).',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Rejestr ryzyk i założeń, który zmusza do policzenia ekspozycji (P×I) i przypisania reakcji z macierzy, zamiast zbierania obaw w jedną listę „ryzyka projektu".',
      en: 'A risk and assumption register that forces you to compute exposure (P×I) and attach a matrix response, instead of collecting fears into one "project risks" list.',
    },
    whatItIsNot: {
      pl: 'To nie jest burza mózgów zagrożeń ani rejestr ryzyk bez liczb. Ryzyko bez prawdopodobieństwa i wpływu nie wchodzi do rankingu.',
      en: 'It is not a threat brainstorm or a risk log without numbers. A risk without probability and impact does not enter the ranking.',
    },
    whenToUse: {
      pl: 'Przed decyzją obarczoną niepewnością: wejście na nowy rynek, duży kontrakt, zmiana modelu operacyjnego, plan odporności na następny rok.',
      en: 'Before a decision carrying real uncertainty: new market entry, a major contract, an operating model change, a resilience plan for the year ahead.',
    },
    whenNotToUse: {
      pl: 'Gdy potrzebna jest wyłącznie priorytetyzacja inicjatyw (użyj Portfolio Priority) albo diagnoza przyczyny problemu operacyjnego (użyj A3).',
      en: 'When you only need initiative prioritization (use Portfolio Priority) or a root-cause diagnosis of an operational problem (use A3).',
    },
    whyItMatters: {
      pl: 'Silnik rozróżnia ryzyko właściwe (known-unknown, da się wycenić) od głębokiej niepewności (unknown-unknown, wymaga odporności, nie punktowej mitygacji) — to zapobiega fałszywej precyzji.',
      en: 'The engine tells a proper risk (known-unknown, priceable) apart from deep uncertainty (unknown-unknown, needs robustness, not a point estimate) — this stops false precision.',
    },
    inputsRequired: {
      pl: 'Decyzja, której dotyczy analiza, horyzont czasowy, znane ograniczenia oraz osoby znające sygnały rynkowe i operacyjne.',
      en: 'The decision under analysis, a time horizon, known constraints, and people who know the market and operational signals.',
    },
    roles: {
      pl: 'Właściciel decyzji, właściciel ryzyka per pozycja, analityk dostarczający dowody i triggery.',
      en: 'Decision owner, a risk owner per item, an analyst supplying evidence and triggers.',
    },
    outcome: {
      pl: 'Macierz ryzyk z reakcją domyślną, ranking ekspozycji i kruchości założeń, sekwencja ruchów odporności z trade-offem oraz gotowe wsady do RAID inicjatywy.',
      en: 'A risk matrix with default responses, an exposure and assumption-fragility ranking, a resilience move sequence with trade-offs, and ready-made inputs for the initiative RAID log.',
    },
    estimatedEffort: '2–3 h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Zamienić obawy w policzoną ekspozycję i sekwencję reakcji, którą da się bronić przed zarządem.',
    en: 'Turn worries into a computed exposure and a response sequence defensible before the board.',
  },
  useCases: [
    'Ocena ryzyka przed dużą decyzją inwestycyjną lub kontraktem',
    'Coroczny przegląd odporności organizacji',
    'Przygotowanie rejestru RAID dla nowej inicjatywy',
  ],
  contraindications: [
    'Potrzebna wyłącznie priorytetyzacja portfela (użyj Portfolio Priority)',
    'Problem ma już znaną przyczynę operacyjną (użyj A3)',
    'Brak jakiejkolwiek osoby znającej realia — sesja wyprodukuje same domysły',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja i kontekst', en: 'Mission & Context' },
      goal: {
        pl: 'Ustalić decyzję, zakres niepewności i sygnał sukcesu.',
        en: 'Establish the decision, the scope of uncertainty, and a success signal.',
      },
      whatGoodLooksLike:
        'Jedna decyzja, do której odnoszą się wszystkie ryzyka i założenia, z horyzontem czasowym.',
      evidenceToAskFor: 'Decyzja, ograniczenia znane z góry, sygnał sukcesu.',
      completionCriterion: 'Decyzja i horyzont zaakceptowane przez właściciela.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać słabe sygnały, ograniczenia i wskazówki niepewności.',
        en: 'Collect weak signals, constraints, and uncertainty cues.',
      },
      whatGoodLooksLike: 'Sygnały mają źródło i są rozdzielone na fakt, obserwację i hipotezę.',
      evidenceToAskFor: 'Skąd wiadomo, że sygnał jest realny, nie wyobrażony.',
      completionCriterion: 'Każdy sygnał ma jawny status dowodu.',
    },
    {
      id: 'assumptions',
      title: { pl: 'Założenia i mapa ryzyk', en: 'Assumptions & Risk Map' },
      goal: {
        pl: 'Zamienić sygnały w konkretne ryzyka (P×I) i założenia z kruchością.',
        en: 'Turn signals into concrete risks (P×I) and assumptions with fragility.',
      },
      whatGoodLooksLike:
        'Każde ryzyko nazwane jako jedno zdarzenie z liczbowym prawdopodobieństwem i wpływem (1-5), nie kategorią ("ryzyko rynkowe").',
      evidenceToAskFor:
        'Obserwowalny sygnał potwierdzający zdarzenie oraz źródło oceny 1-5 (riskQuestionBank.ts L1-L2 — riskuncertainty/riskQuestionBank.ts:73-190).',
      completionCriterion:
        'Co najmniej jedno zaakceptowane ryzyko z P i I oraz jedno założenie z oceną kruchości.',
    },
    {
      id: 'insights',
      title: { pl: 'Synteza ryzyka', en: 'Risk Synthesis' },
      goal: {
        pl: 'Wyprowadzić postawę ryzyka, early warnings i priorytety odporności.',
        en: 'Derive a risk posture, early warnings, and resilience priorities.',
      },
      whatGoodLooksLike:
        'Ranking ekspozycji i kruchości policzony przez silnik, z rozróżnieniem known-unknown / unknown-unknown.',
      evidenceToAskFor: 'Która pozycja to prawdziwe ryzyko, a która głęboka niepewność, i dlaczego.',
      completionCriterion: 'Macierz 2×2 zbudowana z zaakceptowanych ryzyk (buildRiskMatrix).',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Zamienić ranking w sekwencję ruchów odporności z trade-offem.',
        en: 'Turn the ranking into a resilience move sequence with trade-offs.',
      },
      whatGoodLooksLike:
        'Każdy ruch ma rationale, trade-off i odrzucony wariant; ryzyka gotowe do RAID mają readiness="ready-for-initiative".',
      evidenceToAskFor: 'Co świadomie odkładamy, waliduj ąc/łagodząc w tej kolejności.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 i sekwencja zaczyna się od najbardziej kruchego założenia.',
    },
  ],

  questions: [
    {
      id: 'risk-mission-decision',
      phaseId: 'mission',
      prompt: {
        pl: 'Jaką decyzję obarczoną niepewnością wspiera ta analiza i w jakim horyzoncie?',
        en: 'What uncertainty-laden decision does this analysis support, and over what horizon?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanej decyzji i horyzontu — „chcemy być bezpieczni" nie wskazuje żadnej decyzji.',
    },
    {
      id: 'risk-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Skąd wiesz, że ten sygnał jest realny — dane, obserwacja czy przeczucie?',
        en: 'How do you know this signal is real — data, observation, or a hunch?',
      },
      answerType: 'evidence',
      challengeRule:
        'Sygnał bez wskazanego źródła jest hipotezą i musi zostać tak oznaczony; nie wchodzi do rankingu jako fakt.',
    },
    {
      id: 'risk-assumptions-identify',
      phaseId: 'assumptions',
      prompt: {
        pl: 'Nazwij to ryzyko jako JEDNO konkretne zdarzenie i podaj obserwowalny sygnał, że jest realne, nie wyimaginowane.',
        en: 'Name this risk as ONE specific event and give the observable signal that shows it is real, not imagined.',
      },
      answerType: 'matrix-placement',
      challengeRule:
        '„Ryzyko rynkowe" to kategoria, nie ryzyko — wymagaj zdarzenia (kto/co/kiedy), tak jak wymusza to riskQuestionBank.ts L1 (risk-l1-identify).',
    },
    {
      id: 'risk-assumptions-quantify',
      phaseId: 'assumptions',
      prompt: {
        pl: 'Jakie jest prawdopodobieństwo i wpływ tego ryzyka w skali 1-5 — i skąd ta liczba?',
        en: 'What is the probability and impact of this risk on a 1-5 scale — and where does that number come from?',
      },
      answerType: 'scale',
      challengeRule:
        'Odrzuć „wysokie/niskie" bez liczby (wymuszone przez węzeł self-loop risk-l2-quantify-force) i odrzuć precyzyjne prawdopodobieństwo (≥4) dla pozycji bez żadnego dowodu — to fałszywa precyzja, nie ryzyko.',
    },
    {
      id: 'risk-assumptions-epistemic',
      phaseId: 'assumptions',
      prompt: {
        pl: 'Czy to jest ryzyko, które da się wycenić na bazie porównawczej (known-unknown), czy głęboka niepewność, której nie da się sprecyzować (unknown-unknown)?',
        en: 'Is this a risk you can price from a base rate (known-unknown), or deep uncertainty you cannot pin down (unknown-unknown)?',
      },
      answerType: 'choice',
      challengeRule:
        'Podważ pewne, precyzyjne prawdopodobieństwo przypisane do pozycji z językiem głębokiej niepewności bez dowodu — to mylenie unknown-unknown z ryzykiem właściwym (riskInsightStaircase.ts).',
    },
    {
      id: 'risk-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co odkładamy, waliduj ąc lub łagodząc to najpierw, i jakim kosztem?',
        en: 'What are we deferring by validating or mitigating this first, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez rejectedVariant (np. „złagodzić wszystko naraz") nie przechodzi bramki W2 — wymagaj nazwanej alternatywy odrzuconej.',
    },
  ],

  classificationRules:
    'Macierz 2×2 prawdopodobieństwo(P)×wpływ(I), oś 1-5, punkt środkowy=3 (riskMatrixEngine.ts:88-110). ' +
    'Strefy: act-now (wysokie P i I → domyślnie mitigate, avoid przy ekspozycji ≥20/25), contingency (niskie P, wysoki I → transfer), ' +
    'manage (wysokie P, niski I → mitigate operacyjnie), accept (niskie P i I → accept). Do rankingu wchodzą wyłącznie zaakceptowane ryzyka/założenia.',
  evidenceExpectations:
    'Każdy sygnał ma status: fakt, obserwacja lub hipoteza. Ocena 1-5 bez źródła jest flagowana jako "score-without-evidence" ' +
    '(moveValidator.ts); pewne prawdopodobieństwo (≥4) na pozycji bez dowodu jest flagowane jako "false-precision-uncertainty".',
  relationships:
    'Każde ryzyko klasyfikowane jest jako known-unknown (da się wycenić z bazy porównawczej) albo unknown-unknown (głęboka niepewność — ' +
    'wymaga odporności, nie punktowej mitygacji) na podstawie języka i obecności dowodu (riskInsightStaircase.ts:112-126). ' +
    'Ekspozycja = prawdopodobieństwo × wpływ (1-25), redukowana przez wagę dowodu (weightedExposure).',
  interpretationRules:
    'Czytaj ranking ekspozycji i kruchości założeń razem z mapą reakcji, nie pojedyncze ryzyka. Strefa "act-now" pozostawiona na ' +
    'reakcji "accept" jest widoczną sprzecznością do obrony (responseGap). Liczba known-unknowns vs unknown-unknowns pokazuje, ile z ' +
    'analizy to policzalne ryzyko, a ile wymaga budowania odporności zamiast punktowej mitygacji.',
  completionCriteria:
    'Każde zaakceptowane ryzyko ma P, I i sklasyfikowaną strefę; sekwencja ruchów W2 zaczyna od najbardziej kruchego założenia, ' +
    'potem najwyższej ekspozycji, na końcu monitoruje ogon scenariuszowy (moveValidator.ts); ryzyka/założenia gotowe do rejestru mają ' +
    'readiness="ready-for-initiative" (raidHandoff.ts).',

  signatureArchetype: 'decision-matrix-portfolio',
  signatureRationale:
    'Ryzyko i niepewność jest z natury macierzą decyzyjną 2×2 (prawdopodobieństwo×wpływ) z regułą wyboru reakcji per strefa — ' +
    'ta sama geometria co portfel, ale osie i reakcje domyślne są specyficzne dla ryzyka (act-now/contingency/manage/accept), nie dla wartości/wykonalności.',

  mapping: {
    output:
      'Niezmienny snapshot: macierz ryzyk z mapą reakcji, ranking ekspozycji i kruchości, sekwencja ruchów odporności z trade-offem ' +
      'oraz liczniki known-unknown/unknown-unknown i response gap.',
    report:
      'Sekcja odporności: macierz 2×2 jako grafika sygnaturowa + narracja ekspozycja → reakcja → sekwencja. ' +
      'Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'raidHandoff.ts konwertuje zaakceptowane ryzyka i założenia bezpośrednio na pozycje RAID inicjatywy (typ risk/assumption) ' +
      'z pełną proweniencją (sourceType=tool_session) — to jedyny tool w rodzinie 5 z gotowym mostem 1:1 do RAID.',
  },

  conclusion: {
    k1FactSource:
      'moveValidator.rankRisks — ekspozycja (P×I), waga dowodu i kruchość założeń liczone deterministycznie z zaakceptowanych ' +
      'pozycji; riskMatrixEngine.buildRiskMatrix klasyfikuje strefę. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie ryzyka, założenia i scenariusze sesji z ich statusem dowodu. Zakaz statystyk branżowych spoza wsadu.',
    k3PrioritySource:
      'Sekwencja z buildW2MoveSequence: najpierw najbardziej kruche założenie, potem ryzyko o najwyższej ekspozycji, na końcu monitoring ogona scenariuszowego.',
    k4EffectRule:
      'Efekt musi wynikać z K3 jako zmiana ekspozycji, obserwowalna behawioralnie, z horyzontem czasowym — bez prawdopodobieństw nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i rejectedVariant (kanoniczny odrzucony wariant: "złagodzić wszystko naraz → rozmyta reakcja").',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/riskuncertainty',
    questionBankModule: 'src/config/riskuncertainty/riskQuestionBank.ts',
    expectedQuestionNodeCount: 5,
    bankBackedPhaseIds: ['assumptions'],
    rendererComponent: 'src/components/DiscoveryTools/tools/RiskUncertainty',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Macierz prawdopodobieństwo×wpływ + rozróżnienie ryzyka i niepewności',
    commonlyAttributedTo: 'Frank Knight (ryzyko vs niepewność); macierz P×I to generyczna praktyka zarządzania ryzykiem',
    sourceUsed: 'src/config/riskuncertainty/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Brak znanego znaku towarowego; koncepcja z domeny publicznej.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — brak w repo cytowania konkretnego źródła publikowanego.',
  },
};
