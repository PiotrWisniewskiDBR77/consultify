/**
 * Tool Pack — Market Forces / Porter's Five Forces.
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/porter/porterSynthesisEngine.ts` (deterministyczna synteza intensywności
 *   sił, mapa atrakcyjności branży, walidator ruchów W2)
 * - `src/config/porter/porterInsightStaircase.ts` (drabina wniosku K1→K2→K3 per siła +
 *   wymóg driverów strukturalnych)
 * - `src/config/porter/porterQuestionBank.ts` (rozgałęziona drabina pytań L1-L4 per siła)
 * - `src/config/porter/conclusionPrompts.ts` (kontrakt W2 dla bloku domykającego)
 * - `src/store/useToolStore.ts` PORTER_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 *
 * Id faz są ZGODNE z runtime (mission/input/forces/insights/outputs) — pack nie
 * wprowadza równoległej nomenklatury.
 */

import { type ToolPack } from '../contract';

export const marketForcesPack: ToolPack = {
  toolType: 'market-forces',
  displayName: { pl: 'Siły rynkowe (Porter)', en: 'Market Forces (Porter)' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, ale runtime DoD (Output/Report/approval) jeszcze nie
  // dowieziony — dlatego NIE RUNTIME_ACTIVE. Rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/porter/porterSynthesisEngine.ts', verifiableInRepo: true },
    { source: 'src/config/porter/porterInsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/porter/porterQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/porter/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (PORTER_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Diagnoza strukturalnej atrakcyjności rynku, która kończy się werdyktem gdzie bronić marży, a nie pięcioma osobnymi ocenami.',
      en: 'A structural market-attractiveness diagnosis that ends in a verdict on where to defend margin, not five separate ratings.',
    },
    whatItIsNot: {
      pl: 'To nie jest ankieta „oceń konkurencję w skali 1-5" — siła oceniona jako wysoka bez nazwanego sterownika strukturalnego nie wchodzi do analizy.',
      en: 'It is not a "rate competition 1-5" survey — a force rated high with no named structural driver does not enter the analysis.',
    },
    whenToUse: {
      pl: 'Przed decyzją o wejściu/pozycji na rynku, zmianą cennika lub oceną, czy branża strukturalnie pozwala na marżę powyżej średniej.',
      en: 'Before a market-entry/positioning decision, a pricing change, or judging whether an industry structurally allows above-average margin.',
    },
    whenNotToUse: {
      pl: 'Gdy pytanie dotyczy wzrostu (użyj Ansoff) albo wewnętrznej struktury kosztów bez kontekstu konkurencji (użyj Łańcucha wartości).',
      en: 'When the question is about growth (use Ansoff) or an internal cost structure with no competitive context (use Value Chain).',
    },
    whyItMatters: {
      pl: 'Silnik liczy presję branży deterministycznie z ocenionych sił (wagi: wysoka=2, średnia=1, niska=0) i wskazuje, która siła dominuje — zamiast uśredniać, nazywa gdzie boli.',
      en: 'The engine computes industry pressure deterministically from scored forces (weights: high=2, medium=1, low=0) and names which force dominates — instead of averaging, it names where it hurts.',
    },
    inputsRequired: {
      pl: 'Pytanie decyzyjne o rynku, nazwani rywale i ostatni przegrany kontrakt, dane o koncentracji/udziałach oraz osoba znająca warunki handlowe z dostawcami i klientami.',
      en: 'A market decision question, named rivals and the last deal lost, concentration/share data, and someone who knows commercial terms with suppliers and buyers.',
    },
    roles: {
      pl: 'Właściciel decyzji (zarząd/BU lead), lider sprzedaży lub zakupów jako źródło dowodu, analityk rynkowy.',
      en: 'Decision owner (board/BU lead), sales or procurement lead as the evidence source, market analyst.',
    },
    outcome: {
      pl: 'Werdykt atrakcyjności branży, pięć sił z drabiną wniosku i sterownikiem strukturalnym oraz rekomendowane odpowiedzi strategiczne z trade-offem.',
      en: 'An industry-attractiveness verdict, five forces each with an insight staircase and structural driver, and recommended strategic responses with a trade-off.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    // Metoda klasyczna (Porter, 1979/1980); brak noty licencyjnej w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Ustalić, która siła strukturalna dominuje marżę w tej branży i jaka odpowiedź strategiczna na nią odpowiada.',
    en: 'Establish which structural force dominates margin in this industry and what strategic response answers it.',
  },
  useCases: [
    'Decyzja o wejściu na nowy rynek lub segment',
    'Przegląd polityki cenowej pod presją konkurencji',
    'Ocena, czy branża strukturalnie pozwala na marżę powyżej średniej',
  ],
  contraindications: [
    'Pytanie o kierunek wzrostu, nie o strukturę branży (użyj Ansoff/Growth Paths)',
    'Problem czysto wewnętrzny bez kontekstu rynku (użyj Łańcucha wartości)',
    'Brak jakiejkolwiek wiedzy o rywalach — sesja wyprodukuje same założenia',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja i kontekst rynku', en: 'Mission & Market Context' },
      goal: {
        pl: 'Zdefiniować rynek, zakres, ramę decyzji i sygnał sukcesu.',
        en: 'Define the market, scope, decision frame, and success signal.',
      },
      whatGoodLooksLike: 'Jedno ostre pytanie decyzyjne o rynku z zakresem i horyzontem.',
      evidenceToAskFor: 'Definicja rynku (kto jest w nim konkurentem), horyzont, kryterium sukcesu.',
      completionCriterion: 'Pytanie decyzyjne i zakres rynku zaakceptowane przez właściciela decyzji.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać dowody rynkowe, wywiad, benchmarki i sygnały konkurencyjne.',
        en: 'Capture market evidence, interview notes, benchmarks, and competitive signals.',
      },
      whatGoodLooksLike: 'Sygnały nazwane wprost (rywale, udziały, warunki handlowe), nie ogólniki.',
      evidenceToAskFor: 'Źródło każdego sygnału i czy jest potwierdzony czy zadeklarowany.',
      completionCriterion: 'Wystarczające sygnały, by rozpocząć ładder pytań dla co najmniej jednej siły.',
    },
    {
      id: 'forces',
      title: { pl: 'Budowa pięciu sił', en: 'Five Forces Build' },
      goal: {
        pl: 'Zamienić sygnały w ocenione siły Portera z driverami, dowodami i confidence.',
        en: 'Turn signals into scored Porter forces with drivers, evidence, and confidence.',
      },
      whatGoodLooksLike:
        'Każda siła ma intensywność wyliczoną z drabiny odpowiedzi oraz — jeśli wysoka/średnia — nazwany dominujący sterownik strukturalny.',
      evidenceToAskFor: 'Odpowiedzi na drabinę L1-L4 (powierzchnia → dowód strukturalny → kwantyfikacja → trend).',
      completionCriterion: 'Wszystkie 5 sił ma intensywność (nawet prowizoryczną) i staircase K1→K2→K3.',
    },
    {
      id: 'insights',
      title: { pl: 'Implikacje strategiczne', en: 'Strategic Implications' },
      goal: {
        pl: 'Przekształcić strukturę rynku w presję marży, dźwignie i ruchy strategiczne.',
        en: 'Synthesize market structure into margin pressure, levers, and strategic moves.',
      },
      whatGoodLooksLike:
        'Werdykt atrakcyjności branży wskazuje dominującą(-e) siłę(-y), nie jest średnią bez adresata.',
      evidenceToAskFor: 'Które siły dominują marżę, które działają na korzyść firmy.',
      completionCriterion: 'Mapa atrakcyjności policzona przez silnik z ocenionych sił.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować final source summary oraz wygenerować outputy i inicjatywy.',
        en: 'Prepare the final source summary and generate downstream outputs and initiatives.',
      },
      whatGoodLooksLike: 'Każda odpowiedź strategiczna ma rationale, trade-off i odrzuconą alternatywę.',
      evidenceToAskFor: 'Co świadomie odrzucamy wybierając daną odpowiedź strategiczną i jakim kosztem.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 (rationale zakotwiczone w siłach + trade-off + odrzucona opcja + pierwszy krok).',
    },
  ],

  questions: [
    {
      id: 'porter-mission-market',
      phaseId: 'mission',
      prompt: {
        pl: 'Jaką decyzję o pozycji na rynku ma wesprzeć ta analiza i jak definiujecie granice tego rynku?',
        en: 'What market-position decision should this analysis support, and how do you define this market\'s boundaries?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez zdefiniowanego zakresu rynku — „konkurencja" bez granic nie da się ocenić strukturalnie.',
    },
    {
      id: 'porter-input-rivals',
      phaseId: 'input',
      prompt: {
        pl: 'Kto to 2-3 konkurenci, którym realnie przegrywacie kontrakty, i jaki był ostatni przegrany kontrakt?',
        en: 'Who are the 2-3 competitors you actually lose deals to, and what was the last deal you lost?',
      },
      answerType: 'evidence',
      challengeRule:
        'Zgodnie z porterQuestionBank.ts (riv1-surface): jeśli nie umiecie nazwać, komu przegrywacie, rywalizacja nie jest zrozumiana — jest założona. Odrzuć „mamy dużo konkurencji" bez nazwisk.',
    },
    {
      id: 'porter-forces-driver',
      phaseId: 'forces',
      prompt: {
        pl: 'Dlaczego ta siła jest wysoka/średnia — jaki sterownik strukturalny (koncentracja, koszty zmiany, bariery, ekonomia skali) za tym stoi?',
        en: 'Why is this force high/medium — which structural driver (concentration, switching costs, barriers, scale economics) is behind it?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'porterInsightStaircase.ts (intensity-without-driver): siła oceniona jako wysoka/średnia BEZ nazwanego dominującego sterownika to opinia, nie analiza — silnik odrzuca taki wpis.',
    },
    {
      id: 'porter-insights-dominant',
      phaseId: 'insights',
      prompt: {
        pl: 'Która siła dominuje presję na marżę i które siły działają na Waszą korzyść?',
        en: 'Which force dominates the pressure on margin, and which forces work in your favor?',
      },
      answerType: 'list',
      challengeRule:
        'Werdykt, który jest średnią bez wskazania dominującej siły, jest bezużyteczny — mapIndustryProfitability zawsze nazywa dominantForces/favorableForces wprost.',
    },
    {
      id: 'porter-outputs-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co świadomie odpuszczacie, wybierając tę odpowiedź strategiczną, i jakim kosztem?',
        en: 'What are you deliberately giving up by choosing this strategic response, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Odpowiedź bez trade-offu i bez odrzuconej alternatywy nie przechodzi bramki W2 (porterSynthesisEngine.validatePorterMove) — rekomendacja bez trade-offu to lista, nie decyzja.',
    },
  ],

  classificationRules:
    'Intensywność każdej siły liczona deterministycznie z sumy intensityDelta odpowiedzi na drabinę (porterSynthesisEngine.synthesizeForceIntensity): ' +
    'suma > 0 → high, < 0 → low, == 0 → medium (provisional gdy brak odpowiedzi z niezerowym delta). ' +
    'PressureScore branży = suma wag (high=2, medium=1, low=0) po 5 siłach: ≥6 → structurally-unattractive, ≤3 → structurally-attractive, inaczej → mixed.',
  evidenceExpectations:
    'Każda siła niesie staircase K1 (fakt strukturalny z factRefs), K2 (interpretacja dla marży/pozycji, nie parafraza faktu), ' +
    'K3-zalążek (implikacja). Siła bez dowodu z sesji ma factRefs=[] i evidenceStatus="declared" — jawnie nazwana jako niepotwierdzona.',
  relationships:
    'Siła oceniona jako wysoka lub średnia MUSI nazwać co najmniej jeden dominujący sterownik strukturalny: koncentracja, koszty zmiany, ' +
    'bariery wejścia/mobilności lub ekonomia skali (porterInsightStaircase.ts) — każdy sterownik wskazuje inny ruch strategiczny.',
  interpretationRules:
    'Czytaj werdykt atrakcyjności branży odpowiedzią na pytanie „która siła dominuje marżę", nie jako uśrednioną ocenę 5 liczb. ' +
    'mapIndustryProfitability zawsze nazywa dominantForces (siły wysokie) i favorableForces (siły niskie) — to jest treść wniosku, nie tabela.',
  completionCriteria:
    'Wszystkie 5 sił ma intensywność i kompletny staircase K1→K2→K3; siły wysokie/średnie mają nazwany sterownik; ' +
    'każda rekomendowana odpowiedź strategiczna przechodzi validatePorterMove (rationale zakotwiczone w istniejących forceId/implicationId, ' +
    'trade-off kompletny chosen/deferred/cost, odrzucona alternatywa z powodem).',

  signatureArchetype: 'force-radial',
  signatureRationale:
    'Pięć sił Portera z natury układa się promieniście wokół pozycji firmy — intensywność każdej siły to odległość od centrum, ' +
    'a dominująca siła musi być wizualnie największa, nie jedną z pięciu równych kafelków w tabeli.',

  mapping: {
    output:
      'Niezmienny snapshot: werdykt atrakcyjności branży (pressureScore, dominujące/korzystne siły), pięć sił ze staircase i driverami, ' +
      'rekomendowane odpowiedzi strategiczne z trade-offem i odrzuconą alternatywą.',
    report:
      'Sekcja diagnozy struktury rynku: pole sił jako grafika sygnaturowa + werdykt jako narracja argument → dowód → implikacja. ' +
      'Renderowane deterministycznie z tego samego Artifact, nigdy ze zrzutu ekranu.',
    initiative:
      'Każda zaakceptowana odpowiedź strategiczna (positioning/pricing/partnership/capability-build/defensive-move) staje się kandydatem ' +
      'na inicjatywę strategiczną lub obronną, typowaną wg kategorii ruchu z porterSynthesisEngine.',
  },

  conclusion: {
    k1FactSource:
      'porterSynthesisEngine.synthesizeAllForces + mapIndustryProfitability — intensywność każdej siły i presja branży liczone ' +
      'deterministycznie z odpowiedzi na drabinę. Żadna liczba (score, presja) nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie ocenione siły sesji, ich staircase (fact/interpretation/implication) i profil organizacji. Zakaz statystyk branżowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność ruchów wg wpływu na marżę × wysiłek; broń pozycji najpierw tam, gdzie dominuje siła wysoka (buildPorterMoveConclusionPromptRules). Model formułuje treść, nie kolejność.',
    k4EffectRule:
      'Efekt = zmiana marży/pozycjonowania, behawioralnie obserwowalna, z horyzontem czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każda odpowiedź strategiczna ma tradeoff {chosen, deferred, cost} ORAZ rejectedAlternative {option, reason} — oba obowiązkowe (validatePorterMove). ' +
      'Odpowiedź bez trade-offu to lista, nie decyzja.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/porter',
    questionBankModule: 'src/config/porter/porterQuestionBank.ts',
    expectedQuestionNodeCount: 20,
    bankBackedPhaseIds: ['forces'],
    rendererComponent: 'src/components/DiscoveryTools/tools/MarketForces',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Porter\'s Five Forces',
    commonlyAttributedTo: 'Michael E. Porter (HBS), HBR 1979 / „Competitive Strategy" 1980',
    sourceUsed: 'src/config/porter/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Nazwa używana w branży generycznie; oryginalny tekst HBR/książki objęty prawem autorskim, nie reprodukowany.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — brak w repo śladu zgody na komercyjne użycie brandowane.',
  },
};
