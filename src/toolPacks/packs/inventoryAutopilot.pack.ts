/**
 * Tool Pack — Inventory Autopilot (operational, ABC/XYZ inventory segmentation discipline).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/inventoryautopilot/inventoryEngine.ts` (baza kapitału zapasu,
 *   ranking 4 dźwigni: classify/service/replenish/deadstock, detekcja luk,
 *   sekwencja ruchów W2)
 * - `src/config/inventoryautopilot/inventoryQuestionBank.ts` (4-poziomowa
 *   drabinka: roszczenie segmentu → wymuszona klasyfikacja ABC/XYZ →
 *   kwantyfikacja → polityka)
 * - `src/config/inventoryautopilot/deepeningLadder.ts` (drabinka pogłębiająca
 *   per dźwignia)
 * - `src/config/inventoryautopilot/conclusionPrompts.ts` (kontrakt promptu
 *   konkluzji)
 * - `src/store/useToolStore.ts` INVENTORY_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 *
 * Id faz są ZGODNE z runtime: context/sku-classification/replenishment/summary
 * (src/store/useToolStore.ts:1995-2032, INVENTORY_STEPS). Inventory Autopilot
 * jest narzędziem OPERACYJNYM z krótkim rdzeniem analitycznym (klasyfikacja→
 * uzupełnianie), krótszym niż strategiczny wzorzec 5-fazowy Dynamic SWOT.
 * Wewnętrznie silnik ocenia cztery dźwignie portfela (classify/service/
 * replenish/deadstock) jako wymiar rankingu wewnątrz dwóch kroków runtime.
 */

import { type ToolPack } from '../contract';

export const inventoryAutopilotPack: ToolPack = {
  toolType: 'inventory-autopilot',
  displayName: { pl: 'Inventory Autopilot', en: 'Inventory Autopilot' },
  category: 'operational',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/inventoryautopilot/inventoryEngine.ts', verifiableInRepo: true },
    { source: 'src/config/inventoryautopilot/inventoryQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/inventoryautopilot/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/inventoryautopilot/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (INVENTORY_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'ABC/XYZ inventory segmentation — standardowa praktyka zarządzania zapasami/łańcuchem dostaw',
      verifiableInRepo: false,
      note: 'Klasyfikacja ABC (Pareto na wartość) i XYZ (zmienność popytu) to powszechna praktyka SCM bez jednego autora. Repo nie zawiera pliku źródłowego z atrybucją — nie zgadujemy.',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Planer polityk zapasowych, który klasyfikuje asortyment wg wartości i zmienności popytu (ABC/XYZ) i sekwencjonuje działania od klasyfikacji, przez poziom obsługi i uzupełnianie, po uwolnienie kapitału z martwego zapasu.',
      en: 'An inventory-policy planner that segments the assortment by value and demand variability (ABC/XYZ) and sequences moves from classification, through service level and replenishment, to releasing capital from dead stock.',
    },
    whatItIsNot: {
      pl: 'To nie jest jeden uniwersalny bufor bezpieczeństwa dla całego magazynu. Polityka ustawiona na niesklasyfikowanym asortymencie w tym narzędziu jest odrzucana jako optymalizacja średniej, nie realnego rozkładu zapasu.',
      en: 'It is not one universal safety-stock buffer for the whole warehouse. A policy set on an unclassified assortment is rejected in this tool as optimizing an average, not the real inventory distribution.',
    },
    whenToUse: {
      pl: 'Gdy kapitał obrotowy jest uwięziony w zapasie, a decyzje o buforach/poziomach obsługi zapadają bez segmentacji wartość × zmienność.',
      en: 'When working capital is trapped in inventory and buffer/service-level decisions are made without a value × variability segmentation.',
    },
    whenNotToUse: {
      pl: 'Gdy problem jest jednorazowym brakiem konkretnego SKU wynikającym z awarii dostawcy, nie systemową polityką — to inny problem operacyjny (użyj A3).',
      en: 'When the problem is a one-off stock-out of a specific SKU due to a supplier failure, not a systemic policy issue — that is a different operational problem (use A3).',
    },
    whyItMatters: {
      pl: 'Silnik liczy bazę kapitału (ogon klasy C, martwy zapas, segmenty poniżej celu obsługi) deterministycznie i rankinguje dźwignie wg dopasowania, więc rekomendacja mówi dokładnie, ile kapitału jest w grze i którą dźwignię pociągnąć najpierw — nie „zoptymalizować zapasy".',
      en: 'The engine computes the capital baseline (class-C tail, dead stock, below-service segments) deterministically and ranks levers by fit, so the recommendation says exactly how much capital is in play and which lever to pull first — not "optimize inventory".',
    },
    inputsRequired: {
      pl: 'Lista SKU/grup z wartością zapasu i obrotem, dane o poziomie obsługi (braki) oraz gotowość do oznaczenia pozycji martwych/obsoletowych.',
      en: 'A SKU/group list with stock value and turnover, service-level data (stock-outs), and readiness to flag dead/obsolete items.',
    },
    roles: {
      pl: 'Planista zapasów/kierownik łańcucha dostaw jako właściciel polityki, finanse jako adresat uwolnionego kapitału, sprzedaż jako źródło danych o zmienności popytu.',
      en: 'Inventory planner/supply-chain manager as the policy owner, finance as the recipient of released capital, sales as the source of demand-variability data.',
    },
    outcome: {
      pl: 'Baza kapitału (łącznie/ogon/martwy zapas), ranking dźwigni z dopasowaniem, sekwencja ruchów (klasyfikuj → ustaw poziom obsługi → uzupełniaj → uwolnij martwy zapas) z trade-offami, kandydaci na inicjatywy.',
      en: 'A capital baseline (total/tail/dead stock), a lever ranking with fit scores, a move sequence (classify → set service level → replenish → release dead stock) with trade-offs, initiative candidates.',
    },
    estimatedEffort: '2-3h sesji analitycznej (zależnie od jakości wyjściowych danych SKU)',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Uwolnić kapitał obrotowy i podnieść poziom obsługi przez sklasyfikowaną, zdyscyplinowaną politykę zapasową zamiast jednego bufora dla wszystkiego.',
    en: 'Release working capital and raise service level through a classified, disciplined inventory policy instead of one buffer for everything.',
  },
  useCases: [
    'Kapitał obrotowy rośnie szybciej niż sprzedaż — podejrzenie nadmiaru zapasu',
    'Powtarzające się braki na bestsellerach mimo ogólnie wysokiego poziomu zapasu',
    'Przygotowanie do wdrożenia automatycznego uzupełniania (autopilota)',
  ],
  contraindications: [
    'Jednorazowy brak konkretnego SKU wynikający z awarii dostawcy (użyj A3)',
    'Brak jakichkolwiek danych o wartości/obrocie SKU — analiza wyprodukuje zgadywanie',
    'Asortyment jest zbyt mały, by segmentacja miała sens (poniżej kilkunastu SKU)',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst zapasów', en: 'Inventory Context' },
      goal: {
        pl: 'Zdefiniować zakres i cele analizy zapasów.',
        en: 'Define the scope and objectives of the inventory analysis.',
      },
      whatGoodLooksLike: 'Nazwany zakres asortymentu i cel (uwolnić kapitał / podnieść poziom obsługi / oba).',
      evidenceToAskFor: 'Który problem boli bardziej dziś: uwięziony kapitał czy braki na bestsellerach.',
      completionCriterion: 'Zakres i cel zaakceptowane przez właściciela polityki zapasowej.',
    },
    {
      id: 'sku-classification',
      title: { pl: 'Klasyfikacja SKU', en: 'SKU Classification' },
      goal: {
        pl: 'Sklasyfikować segmenty SKU wg wartości (ABC) i zmienności popytu (XYZ), ze zmierzonymi, nie zgadywanymi liczbami.',
        en: 'Classify SKU segments by value (ABC) and demand variability (XYZ), with measured, not guessed, numbers.',
      },
      whatGoodLooksLike:
        'Każdy segment ma klasę ABC i XYZ, zmierzoną wartość zapasu i obrót, oraz jawnie oznaczone pozycje poniżej celu obsługi lub martwe.',
      evidenceToAskFor: 'Skąd pochodzi wartość zapasu/obrót tego segmentu — z systemu, czy z szacunku.',
      completionCriterion:
        'Żaden segment nie pozostaje "unsegmented pile" (inventoryQuestionBank.ts inv-classify-force musi się rozwiązać dla każdego segmentu).',
    },
    {
      id: 'replenishment',
      title: { pl: 'Polityki uzupełniania', en: 'Replenishment Policies' },
      goal: {
        pl: 'Zaprojektować polityki i punkty uzupełniania dopasowane do klasy segmentu, nie jeden bufor dla wszystkich.',
        en: 'Design replenishment policies and reorder points fitted to each segment class, not one buffer for everyone.',
      },
      whatGoodLooksLike:
        'Każdy ruch polityki przypisany do dźwigni (classify/service/replenish/deadstock) z impact/effort i dowodem, autopilot ograniczony do segmentów z zaufanymi danymi.',
      evidenceToAskFor: 'Jaki dowód (analiza, pilotaż, pociągnięcie danych) potwierdza, że ta polityka pasuje do klasy segmentu.',
      completionCriterion: 'Co najmniej jedna dźwignia ma kandydatów na ruchy (rankLevers ordered.length > 0).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zsyntetyzować bazę kapitału i ranking dźwigni w werdykt i wygenerować kandydatów na inicjatywy.',
        en: 'Synthesize the capital baseline and lever ranking into a verdict and generate initiative candidates.',
      },
      whatGoodLooksLike:
        'Werdykt answer-first wskazujący najsilniejszą dźwignię i pulę kapitału, jaką obejmuje; sekwencja W2 zmapowana na 3-5 inicjatyw w porządku classify→service/deadstock→replenish.',
      evidenceToAskFor: 'Czy werdykt wynika z rankLevers i computeBaseline, nie z intuicji planisty.',
      completionCriterion: 'Każdy ruch sekwencji W2 przechodzi walidator (rationale + trade-off + odrzucona alternatywa).',
    },
  ],

  questions: [
    {
      id: 'inv-context-objective',
      phaseId: 'context',
      prompt: {
        pl: 'Co boli bardziej dziś: uwięziony kapitał w zapasie, czy powtarzające się braki na kluczowych pozycjach?',
        en: 'What hurts more today: trapped capital in inventory, or recurring stock-outs on key items?',
      },
      answerType: 'choice',
      challengeRule:
        'Odrzuć odpowiedź „oba po równo" bez priorytetu — dźwignie service i deadstock konkurują o uwagę planistów, sekwencja musi wiedzieć, którą pociągnąć pierwszą.',
    },
    {
      id: 'inv-classify-force',
      phaseId: 'sku-classification',
      prompt: {
        pl: 'Czy ta grupa SKU niesie już klasyfikację ABC (wartość) i XYZ (zmienność), czy to niesklasyfikowana kupa?',
        en: 'Does this SKU group already carry an ABC (value) and XYZ (variability) classification, or is it an unsegmented pile?',
      },
      answerType: 'choice',
      challengeRule:
        'Gdybyś ustawił jedną politykę bufora dla całej niesklasyfikowanej grupy, zagłodziłbyś bestsellery lub przepłacił ogon — silnik wymusza klasyfikację w pętli (inventoryQuestionBank.ts inv-classify-force), zanim segment wejdzie do rankingu.',
    },
    {
      id: 'inv-quant-source',
      phaseId: 'sku-classification',
      prompt: {
        pl: 'Skąd pochodzi wartość zapasu i obrót tego segmentu — wyciąg z systemu, czy szacunek?',
        en: 'Where does this segment\'s stock value and turnover come from — a system extract, or an estimate?',
      },
      answerType: 'evidence',
      challengeRule:
        'Segment bez zmierzonej wartości jest oznaczony jako "unmeasured" — measuredRatio poniżej 50% wymusza ruch klasyfikuj/zmierz przed jakąkolwiek zmianą polityki (inventoryEngine.ts detectInventoryGaps).',
    },
    {
      id: 'inv-service-gap',
      phaseId: 'replenishment',
      prompt: {
        pl: 'Które segmenty są dziś poniżej celu poziomu obsługi i jaki ruch w dźwigni „service" na to reaguje?',
        en: 'Which segments are currently below their service-level target, and what move in the "service" lever responds to that?',
      },
      answerType: 'list',
      challengeRule:
        'Segmenty poniżej celu obsługi bez ani jednego ruchu w dźwigni "service" to ryzyko braków, na które nikt nie działa — silnik nazywa to wprost jako lukę (inventoryEngine.ts below-service-unaddressed).',
    },
    {
      id: 'inv-autopilot-gate',
      phaseId: 'summary',
      prompt: {
        pl: 'Czy dane demand/lead-time dla tego segmentu są na tyle czyste, by oddać sterowanie autopilotowi, czy najpierw trzeba je oczyścić i przepilotować?',
        en: 'Is the demand/lead-time data for this segment clean enough to hand control to the autopilot, or does it need cleaning and a pilot first?',
      },
      answerType: 'choice',
      challengeRule:
        'Autopilot na brudnych danych jest gorszy od planisty, bo błąd rośnie niezauważony — pełna automatyzacja polityki uzupełniania jest zawsze odkładana za pilotażem na stabilnej klasie, dopóki dane nie są zaufane (inventoryEngine.ts buildW2MoveSequence).',
    },
  ],

  classificationRules:
    'ABC = klasa wartości (A/B/C, Pareto na wartość zapasu). XYZ = klasa zmienności popytu (X/Y/Z, ' +
    'stabilny→nieregularny). Segment jest "measured" tylko gdy stockValue pochodzi z danych, nie z domyślnej ' +
    'wartości. belowService i dead to jawne flagi ryzyka, nie wywnioskowane z klasy (inventoryEngine.ts).',
  evidenceExpectations:
    'Każdy ruch polityki (PolicyMoveItem) ma evidence[] potwierdzające analizę/pilotaż/pociągnięcie danych; ' +
    'evidenceRatio niska dla dźwigni oznacza niższą feasibility w rankingu, nie ukrywaną słabość. Segmenty ' +
    'poniżej 50% measuredRatio wymuszają ruch classify/measure-first przed każdą inną zmianą.',
  relationships:
    'Cztery dźwignie tworzą porządek zależności: classify (podstawa całego portfela) → service (chroni ' +
    'segmenty A/B i te poniżej celu) i deadstock (uwalnia kapitał z ogona C) równolegle → replenish ' +
    '(automatyzacja klasy A/B, tylko po zaufaniu danym). Ranking rankLevers sortuje wg fit, ale przy remisie ' +
    'wraca do porządku classify→service→replenish→deadstock, nigdy nie automatyzuje polityki przed klasyfikacją.',
  interpretationRules:
    'Czytaj bazę (totalStockValue/tailStockValue/deadStockValue/tailShare) razem z rankingiem, nie osobno: ' +
    'wysoki tailShare bez ruchu w dźwigni "deadstock" to przeoczona łatwa gotówka. Niski measuredRatio ' +
    'podważa wiarygodność każdej innej liczby analizy — silnik zawsze surowo to nazywa jako pierwszy ruch.',
  completionCriteria:
    'Sekwencja W2 jest kompletna, gdy: (1) co najmniej jedna dźwignia ma kandydatów na ruchy; (2) każdy ' +
    'segment ma jawną klasyfikację ABC/XYZ; (3) każdy ruch W2 przechodzi walidator (rationale + trade-off + ' +
    'odrzucona alternatywa, inventoryEngine.ts validateW2Move).',

  signatureArchetype: 'decision-matrix-portfolio',
  signatureRationale:
    'Inventory Autopilot jest z natury portfelem segmentów na macierzy wartość × zmienność (ABC/XYZ), z ' +
    'dźwigniami polityki nałożonymi na tę macierz — geometria musi pokazywać rozkład kapitału po segmentach ' +
    'i którym z nich przypisano jaką politykę, nie łańcuch przyczynowy ani oś czasu przepływu.',

  mapping: {
    output:
      'Niezmienny snapshot: baza kapitału (total/tail/dead/belowService), ranking dźwigni z fit-score, ' +
      'sekwencja ruchów W2 z trade-offami, jawnie oznaczone segmenty niezmierzone.',
    report:
      'Sekcja optymalizacji kapitału obrotowego: macierz ABC/XYZ jako grafika sygnaturowa + sekwencja ' +
      'ruchów jako narracja klasyfikuj→chroń/uwolnij→automatyzuj. Renderowane deterministycznie.',
    initiative:
      'Sekwencja W2 (buildW2MoveSequence) mapuje się na kandydatów inicjatyw zachowujących kolejność: ' +
      '[classify/measure-first jeśli słabo zmierzone] → dźwignia wiodąca → deadstock (jeśli kapitał uwięziony) ' +
      '→ replenish (autopilot, po zaufaniu danym).',
  },

  conclusion: {
    k1FactSource:
      'inventoryautopilot/inventoryEngine.computeBaseline + rankLevers — totalStockValue/tailStockValue/ ' +
      'deadStockValue/belowServiceCount/measuredRatio i fit-score per dźwignia liczone deterministycznie z ' +
      'segmentów sesji. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie segmenty SKU i ruchy polityki tej sesji. Zakaz benchmarków branżowych rotacji zapasu spoza ' +
      'wsadu — porównanie z „typowym poziomem zapasu w branży" bez danych sesji jest zabronione.',
    k3PrioritySource:
      'Kolejność z sekwencji W2 silnika (buildW2MoveSequence): [classify/measure-first jeśli słabo zmierzone] ' +
      '→ dźwignia o najwyższym fit → deadstock (jeśli realny kapitał uwięziony) → replenish (autopilot na końcu). ' +
      'Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi być uwolnieniem kapitału obrotowego lub zmianą poziomu obsługi, obserwowalną w danych zapasu, ' +
      'z horyzontem czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i odrzuconą alternatywę (inventoryEngine.ts W2MoveInput). ' +
      'Odpisanie całego ogona hurtem albo włączenie autopilota na całym asortymencie od razu są zawsze jawnie ' +
      'odrzucanymi wariantami.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/inventoryautopilot',
    questionBankModule: 'src/config/inventoryautopilot/inventoryQuestionBank.ts',
    expectedQuestionNodeCount: 4,
    bankBackedPhaseIds: ['sku-classification', 'replenishment'],
    rendererComponent: 'src/components/DiscoveryTools/tools/Operational',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Segmentacja zapasów ABC/XYZ',
    commonlyAttributedTo: 'Brak jednego autora — standardowa praktyka SCM (ABC na bazie Pareto + XYZ wg zmienności popytu)',
    sourceUsed: 'src/config/inventoryautopilot/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Termin generyczny.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'NISKIE — praktyka generyczna, formalnie niezweryfikowana.',
  },
};
