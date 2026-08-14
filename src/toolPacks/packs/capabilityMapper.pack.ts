/**
 * Tool Pack — Capability Mapper (maturity × importance matrix + sourcing moves).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/capabilitymapper/capabilityMatrixEngine.ts` (macierz 2×2 dojrzałość×znaczenie, ranking luk, guard sourcingu)
 * - `src/config/capabilitymapper/moveValidator.ts` (priorytet=luka×znaczenie, deriveSourcing, W2)
 * - `src/config/capabilitymapper/capabilityQuestionBank.ts` (bank pytań)
 * - `src/config/capabilitymapper/conclusionPrompts.ts` (kontrakt W2)
 * - `src/store/useToolStore.ts` (CAPABILITY_MAPPER_STEPS — id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/capabilities/insights/outputs).
 */

import { type ToolPack } from '../contract';

export const capabilityMapperPack: ToolPack = {
  toolType: 'capability-mapper',
  displayName: { pl: 'Mapa zdolności', en: 'Capability Mapper' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/capabilitymapper/capabilityMatrixEngine.ts', verifiableInRepo: true },
    { source: 'src/config/capabilitymapper/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/capabilitymapper/capabilityQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/capabilitymapper/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (CAPABILITY_MAPPER_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Klasyczna doktryna core-vs-commodity capability (Prahalad/Hamel core competence) — brak noty licencyjnej w repo',
      verifiableInRepo: false,
      note: 'Koncepcja z domeny publicznej strategii; brak potwierdzonego źródła licencyjnego w repo (L10).',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Ocena zdolności organizacyjnych na dwóch osiach (dojrzałość obecna vs docelowa, znaczenie strategiczne), która kończy się decyzją sourcingową per luka, nie inwentarzem kompetencji.',
      en: 'An assessment of organizational capabilities on two axes (current vs. target maturity, strategic importance) that ends in a per-gap sourcing decision, not a competence inventory.',
    },
    whatItIsNot: {
      pl: 'To nie jest lista umiejętności zespołu ani audyt HR. Zdolność bez oceny dojrzałości i znaczenia nie wchodzi do macierzy.',
      en: 'It is not a team skills list or an HR audit. A capability without a maturity and importance score does not enter the matrix.',
    },
    whenToUse: {
      pl: 'Przed decyzją build/buy/partner: nowa strategia, wejście w nową domenę, przegląd zdolności przed transformacją.',
      en: 'Before a build/buy/partner decision: a new strategy, entry into a new domain, a capability review ahead of a transformation.',
    },
    whenNotToUse: {
      pl: 'Gdy chodzi o rozkład jednej ambicji na wątki (użyj Ambition Decomposer) albo o priorytetyzację portfela inicjatyw (użyj Portfolio Priority).',
      en: 'When the task is decomposing one ambition into themes (use Ambition Decomposer) or prioritizing an initiative portfolio (use Portfolio Priority).',
    },
    whyItMatters: {
      pl: 'Silnik rozróżnia zdolność rdzenną od towarowej i flaguje błąd sourcingu wprost: budowanie wewnętrznie zdolności towarowej to przepalanie wysiłku bez przewagi.',
      en: 'The engine tells a core capability apart from a commodity one and flags the sourcing mismatch directly: building a commodity capability in-house burns effort for no edge.',
    },
    inputsRequired: {
      pl: 'Priorytety strategiczne, lista kandydackich zdolności per domena, dostęp do osób znających realną dojrzałość operacyjną.',
      en: 'Strategic priorities, a candidate capability list per domain, access to people who know the real operational maturity.',
    },
    roles: {
      pl: 'Właściciel strategii, właściciel domeny per zdolność, HR/talent dla oceny wykonalności budowy.',
      en: 'Strategy owner, a domain owner per capability, HR/talent for build feasibility.',
    },
    outcome: {
      pl: 'Macierz core/commodity, ranking luk wg znaczenia×luki×wykonalności, rekomendowane ruchy sourcingowe z trade-offem i flagi błędnego sourcingu.',
      en: 'A core/commodity matrix, a gap ranking by importance×gap×feasibility, recommended sourcing moves with trade-offs, and sourcing-mismatch flags.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Rozstrzygnąć, które zdolności warto budować, a które kupić lub partnerować, na podstawie policzonej luki i wykonalności.',
    en: 'Decide which capabilities are worth building versus buying or partnering, based on a computed gap and feasibility.',
  },
  useCases: [
    'Przegląd zdolności przed nową strategią lub transformacją',
    'Decyzja build/buy/partner dla nowej domeny produktowej',
    'Uzasadnienie budżetu rozwoju zdolności wobec zarządu',
  ],
  contraindications: [
    'Potrzebny wyłącznie rozkład ambicji na wątki (użyj Ambition Decomposer)',
    'Potrzebna wyłącznie priorytetyzacja portfela (użyj Portfolio Priority)',
    'Brak nikogo, kto zna realną dojrzałość operacyjną — sesja wyprodukuje same domysły',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja i zakres', en: 'Mission & Scope' },
      goal: {
        pl: 'Zdefiniować priorytety strategiczne, domeny zdolności i sygnał sukcesu.',
        en: 'Define the strategic priorities, capability domains, and success signal.',
      },
      whatGoodLooksLike: 'Priorytety strategiczne i domeny nazwane, sygnał sukcesu mierzalny.',
      evidenceToAskFor: 'Które priorytety strategiczne mają wymagać nowych zdolności.',
      completionCriterion: 'Zakres domen zaakceptowany przez właściciela strategii.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały o zdolnościach z kontekstu, wywiadów i benchmarków.',
        en: 'Capture capability signals from context, interviews, and benchmarks.',
      },
      whatGoodLooksLike: 'Sygnały rozdzielone na fakt, obserwację i hipotezę per domena.',
      evidenceToAskFor: 'Źródło oceny obecnej dojrzałości: dane, obserwacja czy deklaracja.',
      completionCriterion: 'Każda domena ma co najmniej jeden sygnał ze wskazanym źródłem.',
    },
    {
      id: 'capabilities',
      title: { pl: 'Mapa zdolności', en: 'Capability Map' },
      goal: {
        pl: 'Ocenić zdolności wg dojrzałości obecnej/docelowej i ważności strategicznej.',
        en: 'Score capabilities on current vs target maturity and strategic importance.',
      },
      whatGoodLooksLike:
        'Każda zdolność ma currentMaturity i targetMaturity (1-5), importance (high/medium/low) i feasibility ze źródłem, nie zgadywanką (capabilityQuestionBank.ts).',
      evidenceToAskFor: 'Skąd wiadomo, że dojrzałość obecna to akurat ta liczba — dane czy deklaracja.',
      completionCriterion: 'Co najmniej jedna zaakceptowana zdolność z pełną czwórką ocen.',
    },
    {
      id: 'insights',
      title: { pl: 'Luki i ruchy', en: 'Gaps & Moves' },
      goal: {
        pl: 'Przekształcić luki dojrzałości w priorytety i ruchy build/buy/partner.',
        en: 'Synthesize maturity gaps into priorities and build/buy/partner moves.',
      },
      whatGoodLooksLike:
        'Ranking luk policzony przez silnik (importance×gap×feasibility), sourcing dopasowany do ćwiartki core/commodity.',
      evidenceToAskFor: 'Czy sourcing "build" jest uzasadniony rdzennością zdolności, nie wygodą.',
      completionCriterion: 'Macierz core/commodity zbudowana z zaakceptowanych zdolności (classifyCapabilityMatrix).',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Zamienić ranking luk w sekwencję ruchów sourcingowych z trade-offem.',
        en: 'Turn the gap ranking into a sourcing move sequence with trade-offs.',
      },
      whatGoodLooksLike:
        'Każdy ruch ma rationale, trade-off i odrzucony wariant, sekwencja zamyka najpierw najpilniejszą lukę.',
      evidenceToAskFor: 'Co świadomie odkładamy, zamykając tę lukę najpierw.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 i żaden nie buduje wewnętrznie zdolności towarowej.',
    },
  ],

  questions: [
    {
      id: 'capability-mission-priority',
      phaseId: 'mission',
      prompt: {
        pl: 'Które priorytety strategiczne wymagają nowych lub wzmocnionych zdolności?',
        en: 'Which strategic priorities require new or strengthened capabilities?',
      },
      answerType: 'text',
      challengeRule: 'Odrzuć odpowiedź bez nazwanego priorytetu strategicznego — sama lista domen to nie zakres.',
    },
    {
      id: 'capability-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Czym JEST ta zdolność i jakiemu celowi strategicznemu służy?',
        en: 'What IS this capability, and which strategic goal does it serve?',
      },
      answerType: 'evidence',
      challengeRule:
        'Zdolność bez wskazanego celu strategicznego, który realizuje, jest opisem stanowiska, nie zdolnością organizacyjną (capabilityQuestionBank.ts).',
    },
    {
      id: 'capability-map-maturity',
      phaseId: 'capabilities',
      prompt: {
        pl: 'Skąd wiesz, że obecna dojrzałość to akurat ta ocena 1-5, a nie inna?',
        en: 'How do you know the current maturity score is this exact 1-5 value, not another?',
      },
      answerType: 'scale',
      challengeRule:
        'Ocena dojrzałości bez wskazanego źródła to zgadywanka przebrana za liczbę — silnik oznacza ją jako "score-without-evidence" (capabilityQuestionBank.ts).',
    },
    {
      id: 'capability-map-importance',
      phaseId: 'capabilities',
      prompt: {
        pl: 'Dlaczego to znaczenie strategiczne (wysokie/średnie/niskie), a nie inne — jaki dowód za tym stoi?',
        en: 'Why this strategic importance (high/medium/low), not another — what evidence backs it?',
      },
      answerType: 'choice',
      challengeRule:
        'Znaczenie strategiczne bez dowodu zamienia się w „wszystko jest rdzenne" — podważ zdolność oznaczoną jako high importance bez wskazanego priorytetu, który wspiera.',
    },
    {
      id: 'capability-insight-sourcing',
      phaseId: 'insights',
      prompt: {
        pl: 'Czy ta zdolność jest rdzenna (warto ją posiadać) czy towarowa (rynek już to sprzedaje)?',
        en: 'Is this capability core (worth owning) or commodity (the market already sells it)?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Podważ ruch "build" na zdolności towarowej (niskie znaczenie) — to klasyczny błąd over-engineeringu, flagowany jako build-on-commodity (capabilityMatrixEngine.ts:232-251).',
    },
    {
      id: 'capability-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co odkładamy, zamykając tę lukę najpierw, i jakim kosztem?',
        en: 'What are we deferring by closing this gap first, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch sourcingowy bez trade-offu to lista życzeń, nie decyzja — wymagaj nazwanej alternatywy odrzuconej (moveValidator.ts).',
    },
  ],

  classificationRules:
    'Macierz 2×2 dojrzałość(1-5, punkt środkowy=3)×znaczenie(low=1/medium=2/high=3, punkt środkowy=2): core-strength ' +
    '(wysokie znaczenie, wysoka dojrzałość), core-gap (wysokie znaczenie, niska dojrzałość — musi być zbudowane), ' +
    'commodity-strength (niskie znaczenie, wysoka dojrzałość — przeinwestowane), commodity-low (niskie znaczenie, niska ' +
    'dojrzałość — kupuj/partneruj, nigdy nie buduj) (capabilityMatrixEngine.ts:29-64). Do rankingu wchodzą tylko zaakceptowane zdolności.',
  evidenceExpectations:
    'Ocena dojrzałości i znaczenia bez wskazanego źródła jest hipotezą, nie faktem. Sourcing "build" na zdolności towarowej ' +
    'jest flagowany jako naruszenie (build-on-commodity) niezależnie od uzasadnienia narracyjnego.',
  relationships:
    'Priorytet luki = luka(target-current, 0-4) × waga znaczenia(1-3) × waga wykonalności(1-3), zakres 0-36 (capabilityMatrixEngine.ts:167-207). ' +
    'Sourcing domyślny wynika z reguły: brak luki→sustain, wysokie znaczenie+luka→build, niskie znaczenie+luka→partner (moveValidator.ts:96-105).',
  interpretationRules:
    'Czytaj ranking luk razem z ćwiartką core/commodity, nie same wyniki dojrzałości. Ćwiartka core-gap bez żadnego ruchu build ' +
    'oznacza strategię bez ścieżki realizacji. Zdolność commodity-low z ruchem build to widoczna sprzeczność do obrony.',
  completionCriteria:
    'Każda zaakceptowana zdolność ma currentMaturity, targetMaturity, importance i feasibility; sekwencja ruchów zamyka ' +
    'najpierw najwyższy priorityScore i jawnie odkłada najniższy z podanym trade-offem (moveValidator.ts:320+); zero ruchów build-on-commodity.',

  signatureArchetype: 'architecture-capability',
  signatureRationale:
    'Mapa zdolności jest z natury architekturą organizacyjną: zdolności ułożone w macierz core/commodity z jawnym ' +
    'sourcingiem per pozycja — geometria musi pokazywać, co jest fundamentem do zbudowania a co komponentem do kupienia, ' +
    'nie płaską listę kompetencji.',

  mapping: {
    output:
      'Niezmienny snapshot: macierz core/commodity, ranking luk z priorityScore, rekomendowane ruchy sourcingowe z trade-offem, ' +
      'flagi build-on-commodity.',
    report:
      'Sekcja gotowości zdolności: macierz jako grafika sygnaturowa + narracja luka → sourcing → sekwencja. ' +
      'Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Każdy zaakceptowany ruch sourcingowy staje się kandydatem na inicjatywę: kategoria ruchu (build/buy/partner/reskill/' +
      'restructure) wyznacza typ inicjatywy i właściciela wykonawczego.',
  },

  conclusion: {
    k1FactSource:
      'capabilityMatrixEngine.classifyCapabilityMatrix + rankCapabilityGapsByFeasibility — ćwiartka, luka i priorytet liczone ' +
      'deterministycznie z ocen zaakceptowanych zdolności. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie zdolności sesji, ich oceny i priorytety strategiczne z misji. Zakaz benchmarków branżowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankCapabilityGapsByFeasibility (importance×gap×feasibility). Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z K3 jako przejście dojrzałości (obecna→docelowa) z horyzontem czasowym, bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i rejectedVariant; ruch build na zdolności commodity nie przechodzi bez jawnego uzasadnienia obalającego flagę.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/capabilitymapper',
    questionBankModule: 'src/config/capabilitymapper/capabilityQuestionBank.ts',
    expectedQuestionNodeCount: 4,
    bankBackedPhaseIds: ['capabilities'],
    rendererComponent: 'src/components/DiscoveryTools/tools/CapabilityMapper',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Zdolność kluczowa vs commodity (build/buy/partner)',
    commonlyAttributedTo: 'C.K. Prahalad i Gary Hamel („The Core Competence of the Corporation"); build/buy/partner to praktyka generyczna',
    sourceUsed: 'src/config/capabilitymapper/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Brak znaku towarowego; terminologia zgenerycznieniała.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'ŚREDNIE — silnik nie cytuje Prahalada/Hamela wprost, powiązanie wywnioskowane z koncepcji.',
  },
};
