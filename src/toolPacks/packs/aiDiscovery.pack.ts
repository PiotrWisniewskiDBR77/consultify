/**
 * Tool Pack — AI Discovery (odkrywanie i priorytetyzacja przypadków użycia AI).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/aidiscovery/useCaseEngine.ts` (baseline wartości/gotowości,
 *   scoring czterech faz, sekwencja ruchów W2, wykrywanie luk portfela —
 *   jedyny dopuszczalny generator liczb)
 * - `src/config/aidiscovery/deepeningLadder.ts` (4 kanoniczne fazy discovery
 *   + drabinka pogłębiająca per faza)
 * - `src/config/aidiscovery/aiDiscoveryQuestionBank.ts` (rozgałęziony bank
 *   pytań, wymuszona pętla `aid-data-force` na niedowiedzionych danych)
 * - `src/config/aidiscovery/conclusionPrompts.ts` (kontrakt promptu W2)
 * - `src/store/useToolStore.ts` AI_DISCOVERY_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (context/use-cases/prerequisites/pilot-plan/
 * summary) — pack nie wprowadza równoległej nomenklatury. Silnik operuje
 * własnym słownikiem czterech faz discovery (discover/feasibility/value/
 * sequence, AI_PHASES w deepeningLadder.ts) — to kategorie, do których
 * użytkownik przypisuje use case'y i ruchy discovery wewnątrz faz runtime
 * `use-cases`/`prerequisites`/`pilot-plan`.
 *
 * STAN UI: narzędzie ma kompletny silnik metody, ale NIE MA dedykowanej
 * gałęzi w `ToolCanvas.tsx` — dziś renderuje się generycznym fallbackiem.
 * To luka montażu UI, nie luka treści (patrz `signatureRationale`).
 */

import { EVIDENCE_MISSING, type ToolPack } from '../contract';

export const aiDiscoveryPack: ToolPack = {
  toolType: 'ai-discovery',
  displayName: { pl: 'AI Discovery', en: 'AI Discovery' },
  category: 'digital',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna; runtime DoD (Output/Report/approval, montaż w ToolCanvas)
  // jeszcze niedowieziony — dlatego NIE RUNTIME_ACTIVE.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/aidiscovery/useCaseEngine.ts', verifiableInRepo: true },
    { source: 'src/config/aidiscovery/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/aidiscovery/aiDiscoveryQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/aidiscovery/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/aidiscovery/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (AI_DISCOVERY_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Dyscyplinowane odkrywanie use case’ów AI, które kończy się sekwencją "latarnia najpierw", a nie listą modnych pomysłów.',
      en: 'Disciplined AI use-case discovery that ends in a "lighthouse first" sequence, not a list of trendy ideas.',
    },
    whatItIsNot: {
      pl: 'To nie jest burza mózgów na temat "gdzie użyć AI". Use case bez nazwanej decyzji biznesowej nie wchodzi do rankingu wartości.',
      en: 'It is not a brainstorm about "where to use AI". A use case without a named business decision does not enter the value ranking.',
    },
    whenToUse: {
      pl: 'Na starcie programu AI, gdy trzeba zbudować portfel przypadków rankowany wartością i gotowością danych, nie nowością technologii.',
      en: 'At the start of an AI program, when you need a portfolio ranked by value and data readiness, not by technology novelty.',
    },
    whenNotToUse: {
      pl: 'Gdy use case już jest sfinansowany i technicznie potwierdzony — wtedy właściwe jest wdrożenie, nie kolejna sesja discovery.',
      en: 'When a use case is already funded and technically proven — implementation, not another discovery session, fits better.',
    },
    whyItMatters: {
      pl: 'Silnik chroni kolejność discovery (odkryj → sprawdź wykonalność danych → policz wartość → sekwencjonuj), więc portfel nigdy nie obiecuje wartości na danych, których jeszcze nie ma.',
      en: 'The engine protects the discovery order (discover → test data feasibility → quantify value → sequence), so the portfolio never promises value on data that is not there yet.',
    },
    inputsRequired: {
      pl: 'Funkcja/proces objęty ambicją AI, dostęp do próbki danych, osoba mogąca ocenić realną gotowość i jakość danych.',
      en: 'The function/process the AI ambition targets, access to a data sample, and someone who can assess real data readiness and quality.',
    },
    roles: {
      pl: 'Sponsor biznesowy use case’u, lider danych/AI, właściciel decyzji, którą use case zmienia.',
      en: 'Use-case business sponsor, data/AI lead, owner of the decision the use case changes.',
    },
    outcome: {
      pl: 'Baza wartości i gotowości danych, ranking czterech faz discovery i W2-zwalidowana sekwencja z wybraną "latarnią".',
      en: 'A value/data-readiness baseline, a ranking of the four discovery phases, and a W2-validated sequence with a chosen lighthouse.',
    },
    estimatedEffort: '90-150 min sesji roboczej',
    // Metoda oparta na dyscyplinie "wartość przed hype"; brak noty licencyjnej
    // w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Odsiać use case’y AI ugruntowane w realnej decyzji i dowiedzionych danych od technologii szukającej problemu.',
    en: 'Separate AI use cases grounded in a real decision and proven data from technology looking for a problem.',
  },
  useCases: [
    'Start programu AI — budowa pierwszego portfela use case’ów',
    'Ocena zgłoszeń "powinniśmy użyć AI do X" napływających z biznesu',
    'Wybór pierwszego wdrożenia (latarni) przed kolejną falą inwestycji',
  ],
  contraindications: [
    'Use case już sfinansowany i technicznie potwierdzony (przejdź do wdrożenia)',
    'Brak jakiegokolwiek dostępu do danych źródłowych — sesja wyprodukuje same hipotezy',
    'Cel to wyłącznie PR/demo technologii, nie zmiana decyzji biznesowej',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst odkrycia', en: 'Discovery Context' },
      goal: {
        pl: 'Zdefiniować funkcję, krajobraz danych i ambicję AI.',
        en: 'Define the function, data landscape, and AI ambition.',
      },
      whatGoodLooksLike: 'Nazwana funkcja biznesowa, znany właściciel decyzji i szczery obraz stanu danych.',
      evidenceToAskFor: 'Który proces/decyzja ma się zmienić i kto go dziś obsługuje.',
      completionCriterion: 'Ambicja AI zaakceptowana przez sponsora biznesowego.',
    },
    {
      id: 'use-cases',
      title: { pl: 'Case’y użycia', en: 'Use cases' },
      goal: {
        pl: 'Wyselekcjonować kandydujące case’y AI wg wartości i wykonalności.',
        en: 'Shortlist candidate AI use cases by value and feasibility.',
      },
      whatGoodLooksLike: 'Każdy use case ma nazwaną decyzję biznesową, gotowość danych i status pomiaru (measured/estimated).',
      evidenceToAskFor: 'Czy sponsor pitchowałby to jako nazwaną decyzję, czy jako "AI dla AI" (aiDiscoveryQuestionBank.ts: aid-surface).',
      completionCriterion: 'Co najmniej jeden use case ma jawnie oznaczoną gotowość danych (ready/partial/missing).',
    },
    {
      id: 'prerequisites',
      title: { pl: 'Prerekwizyty', en: 'Prerequisites' },
      goal: {
        pl: 'Zebrać prerekwizyty danych, kompetencji i platformy.',
        en: 'Capture data, skills, and platform prerequisites.',
      },
      whatGoodLooksLike: 'Twierdzenie o gotowości danych ma dowód — próbkę, log, audyt jakości — nie deklarację "chyba mamy".',
      evidenceToAskFor: 'Realna próbka danych albo pilotażowy wyciąg potwierdzający jakość.',
      completionCriterion: 'Gotowość danych oznaczona z dowodem (aiDiscoveryQuestionBank.ts: pętla aid-data-force nie blokuje dalej).',
    },
    {
      id: 'pilot-plan',
      title: { pl: 'Plan pilota', en: 'Pilot plan' },
      goal: {
        pl: 'Zdefiniować pierwszy pilot, ownerów i sygnały sukcesu.',
        en: 'Define the first pilot, owners, and success signals.',
      },
      whatGoodLooksLike: 'Wybrana "latarnia" ma nazwanego właściciela biznesowego i gotowe dane — nie jest moonshotem.',
      evidenceToAskFor: 'Dlaczego ten use case, a nie use case o wyższym potencjale, ale niższej gotowości.',
      completionCriterion: 'Co najmniej jeden use case z gotowymi danymi ma nazwanego właściciela (useCaseEngine.ts: detectDiscoveryGaps — unowned-ready-value = 0).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Podsumować odkrycie i wygenerować inicjatywy.',
        en: 'Summarize discovery and generate initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch ma rationale, trade-off i odrzucony wariant (walidacja: valid=true).',
      evidenceToAskFor: 'Co świadomie odraczamy (moonshoty) i pod jakim warunkiem wracają do portfela.',
      completionCriterion: 'Sekwencja ruchów spełnia bramkę W2 (buildW2MoveSequence + validateW2Move: valid=true dla każdego ruchu).',
    },
  ],

  questions: [
    {
      id: 'aid-context-decision',
      phaseId: 'context',
      prompt: {
        pl: 'Jaka codzienna decyzja lub proces ma się zmienić, gdyby ten use case zadziałał?',
        en: 'What daily decision or process would change if this use case worked?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanej decyzji ("chcemy być bardziej AI-native" = za ogólne) — wymagaj czyjejś konkretnej decyzji, która się zmienia.',
      followUpProbes: ['Kto podejmuje tę decyzję dziś?', 'Co się stanie, jeśli decyzja się nie zmieni?'],
    },
    {
      id: 'aid-usecase-pitch',
      phaseId: 'use-cases',
      prompt: {
        pl: 'Podaj ten use case dokładnie tak, jak przedstawiłby go sponsor na zarządzie — nazwana decyzja, czy technologia szukająca problemu?',
        en: 'State this use case exactly as the sponsor would pitch it to the board — a named decision, or technology looking for a problem?',
      },
      answerType: 'choice',
      challengeRule:
        'Główny tryb porażki metody: use case AI zaproponowany bez dowiedzionej gotowości danych. "Tech-first" bez nazwanej decyzji jest sygnałem do mocniejszego wymuszenia dowodu danych, zanim wejdzie do rankingu (aiDiscoveryQuestionBank.ts: aid-surface, sygnał "solution looking for a problem").',
    },
    {
      id: 'aid-prereq-data-proof',
      phaseId: 'prerequisites',
      prompt: {
        pl: 'Skąd wiesz, że dane pod ten use case istnieją i mają wystarczającą jakość — z próbki, czy zakładasz?',
        en: 'How do you know the data behind this use case exists with sufficient quality — from a sample, or an assumption?',
      },
      answerType: 'evidence',
      challengeRule:
        'Use case bez dowiedzionej próbki danych jest zablokowany pętlą wymuszoną (aiDiscoveryQuestionBank.ts: aid-data-force) — nigdy nie pozwól, by wszedł do rankingu wartości jako "ready" bez dowodu.',
    },
    {
      id: 'aid-pilot-owner',
      phaseId: 'pilot-plan',
      prompt: {
        pl: 'Kto jest nazwanym właścicielem biznesowym, który wdroży wynik tego use case’u — i co się stanie bez niego?',
        en: 'Who is the named business owner who will act on this use case’s output — and what happens without one?',
      },
      answerType: 'text',
      challengeRule:
        'Use case z gotowymi danymi, ale bez właściciela, to wartość, której nikt nie wdroży (useCaseEngine.ts: detectDiscoveryGaps — unowned-ready-value). Odrzuć pilota bez nazwanej roli.',
    },
    {
      id: 'aid-summary-tradeoff',
      phaseId: 'summary',
      prompt: {
        pl: 'Które przypadki świadomie odraczacie jako moonshoty i pod jakim warunkiem wracają do portfela?',
        en: 'Which cases are you deliberately deferring as moonshots, and under what condition do they re-enter the portfolio?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez odrzuconego wariantu nie przechodzi bramki W2 (useCaseEngine.ts: validateW2Move — rejectedVariant nie może być puste ani krótsze niż 12 znaków).',
    },
  ],

  classificationRules:
    'Use case’y są klasyfikowane wg gotowości danych (DataReadiness: ready/partial/missing, ' +
    'READINESS_SCORE ready=1, partial=0.5, missing=0) i przypisania do jednej z czterech faz ' +
    '(AI_PHASES: discover/feasibility/value/sequence, deepeningLadder.ts). Use case wchodzi do ' +
    'rankingu tylko z przypisaną fazą i co najmniej jednym ruchem discovery (useCaseEngine.ts: scorePhase).',
  evidenceExpectations:
    'Wartość roczna (annualValue) ma status measured (true/false); measured=false = szacunek, nie ' +
    'liczony do zaufanego dowodu. Ruch bez evidence[] nie liczy się do evidenceBacked i obniża ' +
    'feasibility fazy.',
  relationships:
    'Score fazy = attractiveness (średni impact ruchów) × feasibility (łatwość: niski effort + ' +
    'evidence). Wartość, którą rządzi faza "feasibility", to pula za niekompletnymi danymi; wartość ' +
    'fazy "value" to pula faktycznie gotowa do wdrożenia (useCaseEngine.ts: valueForPhase). Ranking ' +
    'honoruje porządek kanoniczny przy remisach — nie rankujemy wartości przed sprawdzeniem wykonalności danych.',
  interpretationRules:
    'Czytaj ranking faz i luki portfela, nie surową listę use case’ów. Faza z realną wartością w ' +
    'zasięgu, ale bez ani jednego ruchu, jest ślepą plamą planu (useCaseEngine.ts: detectDiscoveryGaps — ' +
    'phase-empty-with-value). Wartość gotowa do wdrożenia bez właściciela to wartość, której nikt nie ruszy.',
  completionCriteria:
    'Co najmniej jedna faza ma zaakceptowany use case i ruch; ranking policzony przez silnik; każdy ' +
    'rekomendowany ruch spełnia bramkę W2 (rationale + trade-off + odrzucony wariant, min. 12 znaków — ' +
    'useCaseEngine.ts: MIN_JUSTIFICATION_LEN).',

  signatureArchetype: 'discovery-candidate-funnel',
  signatureRationale:
    'AI Discovery odsiewa use case’y przez cztery fazy sekwencyjne (discover → feasibility → ' +
    'value → sequence) — geometria lejka pokazuje, ile wartości odpada na każdej fazie z powodu ' +
    'braku dowodu danych, zamiast płaskiej listy "pomysłów na AI". Narzędzie nie ma dziś dedykowanej ' +
    'gałęzi w ToolCanvas.tsx (renderuje się fallbackiem) — geometria lejka jest tym, co trzeba ' +
    'zamontować, nie zaprojektować od nowa.',

  mapping: {
    output:
      'Niezmienny snapshot: baza wartości i gotowości (totalValueAtStake, readyValueAtStake, ' +
      'dataReadinessRatio), ranking czterech faz z rationale i W2-zwalidowana sekwencja z wybraną latarnią.',
    report:
      'Sekcja portfela AI: lejek faz jako grafika sygnaturowa + sekwencja ruchów jako narracja ' +
      'rationale → trade-off → odrzucony wariant. Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Każdy zwalidowany ruch W2 staje się kandydatem na inicjatywę; faza wyznacza typ (discover → ' +
      'zdolność odkrywcza, feasibility → dowód danych, value → biznesowy business case, sequence → wdrożenie).',
  },

  conclusion: {
    k1FactSource:
      'useCaseEngine.ts: computeBaseline (useCaseCount, totalValueAtStake, readyValueAtStake, ' +
      'ownedCount, dataReadinessRatio, measuredRatio) + rankPhases (score per faza) + ' +
      'buildW2MoveSequence + detectDiscoveryGaps — wszystkie liczby liczone deterministycznie z ' +
      'sesji, żadna nie pochodzi z LLM.',
    k2GroundingScope:
      'Wyłącznie use case’y i ruchy sesji, ich dowody i profil organizacji. Zakaz przywoływania ' +
      'statystyk branżowych o adopcji AI spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankingu wagi faz (attractiveness × feasibility, useCaseEngine.ts: scorePhase) z ' +
      'twardym tie-breakiem na porządku kanonicznym. Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z sekwencji ruchów, mieć horyzont czasowy i wskazywać rolę odpowiedzialną. ' +
      'Wartość wyłącznie z totalValueAtStake/readyValueAtStake — bez kwot ROI nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje: rationale, trade-off i odrzucony wariant (W2, useCaseEngine.ts: ' +
      'validateW2Move). Ruch bez odrzuconego wariantu nie przechodzi.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/aidiscovery',
    questionBankModule: 'src/config/aidiscovery/aiDiscoveryQuestionBank.ts',
    expectedQuestionNodeCount: 5,
    bankBackedPhaseIds: ['use-cases', 'prerequisites', 'pilot-plan'],
    rendererComponent: EVIDENCE_MISSING,
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Odkrywanie i sekwencjonowanie zastosowań AI',
    commonlyAttributedTo: 'Brak kanonicznego autora w repo; generyczna dyscyplina portfela AI',
    sourceUsed: 'src/config/aidiscovery/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Nie wykryto znaku towarowego.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Wzorzec wewnętrzny, niesprawdzony wobec zewnętrznego stanu techniki.',
  },
};
