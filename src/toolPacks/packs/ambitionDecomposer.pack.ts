/**
 * Tool Pack — Ambition Decomposer (ambition tree: themes → initiatives + gaps).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/ambitiondecomposer/ambitionTreeEngine.ts` (drzewo ambicji, wykrywanie luk, sortowanie topologiczne)
 * - `src/config/ambitiondecomposer/moveValidator.ts` (priorytet=znaczenie×pilność horyzontu, archetyp, W2)
 * - `src/config/ambitiondecomposer/ambitionQuestionBank.ts` (wymuszona dekompozycja L1-L2)
 * - `src/config/ambitiondecomposer/conclusionPrompts.ts` (kontrakt W2)
 * - `src/store/useToolStore.ts` (AMBITION_DECOMPOSER_STEPS — id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/themes/insights/outputs).
 */

import { type ToolPack } from '../contract';

export const ambitionDecomposerPack: ToolPack = {
  toolType: 'ambition-decomposer',
  displayName: { pl: 'Dekompozycja ambicji', en: 'Ambition Decomposer' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/ambitiondecomposer/ambitionTreeEngine.ts', verifiableInRepo: true },
    { source: 'src/config/ambitiondecomposer/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/ambitiondecomposer/ambitionQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/ambitiondecomposer/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (AMBITION_DECOMPOSER_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Klasyczna praktyka strategy decomposition / OKR cascading — brak noty licencyjnej w repo',
      verifiableInRepo: false,
      note: 'Metoda z domeny publicznej strategii wykonania; brak potwierdzonego źródła licencyjnego w repo (L10).',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Narzędzie, które zmusza ambicję parasolową ("zostać liderem rynku") do rozbicia na odrębne, niezależnie dowożalne wątki z inicjatywami — i wykrywa, gdzie krytyczny wątek nie ma żadnej ścieżki realizacji.',
      en: 'A tool that forces an umbrella ambition ("become the market leader") to split into distinct, independently deliverable themes with initiatives — and detects where a critical theme has no delivery path at all.',
    },
    whatItIsNot: {
      pl: 'To nie jest lista życzeń zarządu ani plakat z hasłem. Ambicja bez co najmniej dwóch odrębnych wątków nie jest zdekomponowana.',
      en: 'It is not a management wish list or a poster slogan. An ambition without at least two distinct themes is not decomposed.',
    },
    whenToUse: {
      pl: 'Przed rokiem budżetowym lub kaskadowaniem celu: gdy zarząd wypowiada jedną liczbę nagłówkową, a organizacja potrzebuje wykonalnego planu.',
      en: 'Ahead of a budget year or goal cascade: when the board states one headline number and the organization needs an executable plan.',
    },
    whenNotToUse: {
      pl: 'Gdy chodzi o macierz zdolności do zbudowania (użyj Capability Mapper) albo o wybór między konkurującymi priorytetami (użyj Focus & Trade-offs).',
      en: 'When the task is a capability build matrix (use Capability Mapper) or a choice among competing priorities (use Focus & Trade-offs).',
    },
    whyItMatters: {
      pl: 'Silnik wymusza podział pojedynczej liczby na odrębne dźwignie i wykrywa "ambicję bez ścieżki" — krytyczny wątek (fundament lub zakład) bez ani jednej inicjatywy pod nim.',
      en: 'The engine forces a single number to split into distinct levers and detects "ambition without a path" — a critical theme (foundation or bet) with zero initiatives under it.',
    },
    inputsRequired: {
      pl: 'Wypowiedziana ambicja (najlepiej z liczbą i datą), horyzont czasowy, ograniczenia oraz osoby mogące wziąć odpowiedzialność za poszczególne wątki.',
      en: 'The stated ambition (ideally with a number and date), a time horizon, constraints, and people who can own individual themes.',
    },
    roles: {
      pl: 'Sponsor ambicji (zarząd), właściciel per wątek strategiczny, planista sekwencji inicjatyw.',
      en: 'Ambition sponsor (board), an owner per strategic theme, an initiative sequencing planner.',
    },
    outcome: {
      pl: 'Drzewo ambicji z wątkami i inicjatywami, ranking priorytetów wg znaczenia×pilności, wykryte luki realizacji oraz sekwencja topologiczna inicjatyw.',
      en: 'An ambition tree with themes and initiatives, a priority ranking by importance×urgency, detected delivery gaps, and a topological initiative sequence.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Rozbić hasło zarządu na wykonalny plan z właścicielami, sekwencją i widocznymi lukami realizacji.',
    en: 'Break a board-level slogan into an executable plan with owners, sequence, and visible delivery gaps.',
  },
  useCases: [
    'Kaskadowanie celu rocznego zarządu na wątki strategiczne',
    'Sprawdzenie, czy ambicja transformacyjna ma realną ścieżkę wykonania',
    'Przygotowanie sekwencji inicjatyw pod nową strategię',
  ],
  contraindications: [
    'Potrzebna macierz zdolności do zbudowania (użyj Capability Mapper)',
    'Potrzebny wybór między konkurującymi priorytetami bez wspólnej ambicji (użyj Focus & Trade-offs)',
    'Ambicja jest już w pełni zdekomponowana i chodzi tylko o wykonanie — narzędzie nie zastępuje zarządzania projektem',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Ambicja i zakres', en: 'Ambition & Scope' },
      goal: {
        pl: 'Określić ambicję, zakres, horyzont czasowy i sygnał sukcesu.',
        en: 'State the ambition, scope, time horizon, and success signal.',
      },
      whatGoodLooksLike:
        'Ambicja wypowiedziana tak, jak powiedziałby ją decydent na głos — najlepiej z liczbą i datą (ambitionQuestionBank.ts amb-surface).',
      evidenceToAskFor: 'Czy ambicja ma mierzalny stan docelowy, czy jest tylko hasłem.',
      completionCriterion: 'Ambicja zaakceptowana przez sponsora z horyzontem czasowym.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały informujące, jak rozłożyć ambicję na czynniki.',
        en: 'Capture signals that inform how the ambition can be decomposed.',
      },
      whatGoodLooksLike: 'Sygnały o dźwigniach, ograniczeniach i możliwych właścicielach wątków.',
      evidenceToAskFor: 'Które dźwignie są już nazwane przez organizację, a które trzeba dopiero odkryć.',
      completionCriterion: 'Każdy sygnał ma jawny status dowodu.',
    },
    {
      id: 'themes',
      title: { pl: 'Tematy strategiczne', en: 'Strategic Themes' },
      goal: {
        pl: 'Rozłożyć ambicję na tematy strategiczne z mierzalnymi celami.',
        en: 'Decompose the ambition into strategic themes with measurable targets.',
      },
      whatGoodLooksLike:
        'Co najmniej dwa odrębne, niezależnie dowożalne wątki, każdy z targetMetric, horyzontem i archetypem (foundation/accelerator/bet/enabler).',
      evidenceToAskFor: 'Czy dwie różne osoby mogłyby wziąć po jednym wątku, nie wchodząc sobie w drogę.',
      completionCriterion: 'Co najmniej dwa zaakceptowane wątki, żaden nie jest tylko przeformułowaniem ambicji.',
    },
    {
      id: 'insights',
      title: { pl: 'Priorytety i ruchy', en: 'Priorities & Moves' },
      goal: {
        pl: 'Ułożyć tematy w priorytety i wspierające ruchy strategiczne.',
        en: 'Sequence themes into priorities and enabling strategic moves.',
      },
      whatGoodLooksLike:
        'Priorytet wątku = znaczenie × pilność horyzontu, sekwencja stawia fundamenty przed akceleratorami i zakładami.',
      evidenceToAskFor: 'Czy krytyczny wątek (fundament/zakład) ma pod sobą choć jedną inicjatywę.',
      completionCriterion: 'Drzewo ambicji zbudowane (buildAmbitionTree) i luki wykryte (detectAmbitionGaps).',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Zamienić priorytety w sekwencję ruchów z trade-offem.',
        en: 'Turn priorities into a move sequence with trade-offs.',
      },
      whatGoodLooksLike:
        'Każdy ruch ma rationale, trade-off i odrzucony wariant sekwencji; inicjatywy uporządkowane topologicznie bez cykli.',
      evidenceToAskFor: 'Co świadomie odkładamy, realizując ten wątek najpierw.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 i zero inicjatyw sierocych (orphan-initiative).',
    },
  ],

  questions: [
    {
      id: 'ambition-mission-surface',
      phaseId: 'mission',
      prompt: {
        pl: 'Podaj ambicję dokładnie tak, jak powiedziałby ją prezes na zarządzie. Czy niesie liczbę i datę, czy jest to hasło?',
        en: 'State the ambition exactly as the CEO would say it in a board meeting. Does it carry a number and a date, or is it a phrase?',
      },
      answerType: 'text',
      challengeRule:
        'Hasło aspiracyjne bez liczby i daty ("zostać liderem rynku") jest prawdopodobnie ambicją parasolową — wymuś dekompozycję zanim ruszysz dalej (ambitionQuestionBank.ts amb-surface).',
    },
    {
      id: 'ambition-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Jaki sygnał pokazuje, że ta dźwignia jest realna, a nie założeniem zarządu?',
        en: 'What signal shows this lever is real, not a board assumption?',
      },
      answerType: 'evidence',
      challengeRule: 'Sygnał bez wskazanego źródła jest hipotezą i musi zostać tak oznaczony.',
    },
    {
      id: 'ambition-themes-decompose',
      phaseId: 'themes',
      prompt: {
        pl: 'Nawet z liczbą, ta ambicja zwykle kryje kilka odrębnych dźwigni (np. nowi klienci + wyższe ceny + niższy churn). Które odrębne dźwignie składają się na tę liczbę?',
        en: 'Even with a number attached, this ambition usually bundles several distinct levers (e.g. new customers + higher prices + lower churn). Which distinct levers make up this number?',
      },
      answerType: 'list',
      challengeRule:
        'Jedna dźwignia powyżej poziomu zespołu to rzadkość — podważ pojedynczy wątek pokrywający całą liczbę nagłówkową (ambitionQuestionBank.ts amb-decompose-check/force).',
    },
    {
      id: 'ambition-insight-critical',
      phaseId: 'insights',
      prompt: {
        pl: 'Ten wątek jest fundamentem lub zakładem (wysokie znaczenie) — jaka inicjatywa go faktycznie dowozi?',
        en: 'This theme is a foundation or a bet (high importance) — which initiative actually delivers it?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Krytyczny wątek (foundation/bet/high importance) bez ani jednej inicjatywy to ambicja bez ścieżki realizacji — flagowane jako theme-without-initiative (ambitionTreeEngine.ts:118-146).',
    },
    {
      id: 'ambition-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co odkładamy, realizując ten wątek przed pozostałymi, i jakim kosztem?',
        en: 'What are we deferring by delivering this theme ahead of the others, and at what cost?',
      },
      answerType: 'text',
      challengeRule: 'Ruch bez rejectedVariant (wariant sekwencji świadomie odrzucony) nie przechodzi bramki W2.',
    },
  ],

  classificationRules:
    'Archetyp wątku wyprowadzony z horyzontu i znaczenia (deriveArchetype, moveValidator.ts:106-118): krótki horyzont+wysokie ' +
    'znaczenie→foundation, długi horyzont+wysokie znaczenie→bet, wysokie znaczenie+średni horyzont→enabler, w pozostałych ' +
    'przypadkach→accelerator. Sekwencja: foundation(0) przed enabler(1)/accelerator(2)/bet(3). Do drzewa wchodzą tylko zaakceptowane wątki i inicjatywy.',
  evidenceExpectations:
    'Ambicja bez liczby i daty jest traktowana jako hasło, nie cel — sesja wymusza jej podział zanim przejdzie dalej ' +
    '(amb-decompose-force). Wątek bez targetMetric jest deklaracją, nie zdekomponowaną dźwignią.',
  relationships:
    'Inicjatywy wiążą się z wątkami przez themeId; inicjatywa bez pasującego, zaakceptowanego wątku jest sierocą ' +
    '(orphan-initiative) i niepowiązaną z ambicją. Inicjatywy mogą deklarować twarde zależności (dependencies[]) ' +
    'uporządkowane sortowaniem topologicznym z wykrywaniem cykli (ambitionTreeEngine.ts:170+).',
  interpretationRules:
    'Czytaj drzewo razem z listą luk, nie same wątki. Wątek krytyczny (foundation/bet/high importance) bez inicjatyw jest ' +
    'realnym ryzykiem dla ambicji, nie kosmetycznym brakiem — to ambicja, która wygląda na kompletną na papierze, a nic pod nią nie wykonuje.',
  completionCriteria:
    'Ambicja ma co najmniej dwa zaakceptowane wątki; każdy wątek krytyczny ma co najmniej jedną inicjatywę; zero inicjatyw ' +
    'sierocych i zero cykli zależności; sekwencja ruchów W2 stawia fundamenty przed akceleratorami/zakładami z jawnym trade-offem.',

  signatureArchetype: 'architecture-capability',
  signatureRationale:
    'Dekompozycja ambicji jest z natury architekturą drzewa: jeden korzeń (ambicja), gałęzie (wątki z archetypem), liście ' +
    '(inicjatywy z zależnościami) — geometria musi pokazywać hierarchię i luki w ścieżce, nie płaską listę celów.',

  mapping: {
    output:
      'Niezmienny snapshot: drzewo ambicji z wątkami i inicjatywami, ranking priorytetów, wykryte luki realizacji, ' +
      'sekwencja topologiczna inicjatyw.',
    report:
      'Sekcja wykonalności strategii: drzewo jako grafika sygnaturowa + narracja ambicja → wątek → luka → sekwencja. ' +
      'Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Każda inicjatywa w drzewie jest bezpośrednim kandydatem na inicjatywę portfela; archetyp macierzysty wątku ' +
      '(foundation/accelerator/bet/enabler) wyznacza typ i pilność.',
  },

  conclusion: {
    k1FactSource:
      'ambitionTreeEngine.buildAmbitionTree + detectAmbitionGaps + moveValidator (priorityScore) — drzewo, luki i priorytet ' +
      'liczone deterministycznie z zaakceptowanych wątków/inicjatyw. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie ambicja, wątki, inicjatywy i ich zależności z sesji. Zakaz benchmarków branżowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność z priorityScore (znaczenie×pilność horyzontu) i sekwencji archetypów (foundation→enabler→accelerator→bet). ' +
      'Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z K3 jako domknięcie luki realizacji lub przejście wątku z horyzontem czasowym, bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i rejectedVariant (wariant sekwencji świadomie odrzucony, np. "realizacja równoległa wszystkich wątków → rozmyta uwaga sponsora").',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/ambitiondecomposer',
    questionBankModule: 'src/config/ambitiondecomposer/ambitionQuestionBank.ts',
    expectedQuestionNodeCount: 7,
    bankBackedPhaseIds: ['themes'],
    rendererComponent: 'src/components/DiscoveryTools/tools/AmbitionDecomposer',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Dekompozycja ambicji na tematy strategiczne (bliska kaskadzie OKR)',
    commonlyAttributedTo: 'Brak jednego autora — generyczna praktyka egzekucji strategii',
    sourceUsed: 'src/config/ambitiondecomposer/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Brak znanego znaku towarowego.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — praktyka generyczna, brak możliwej do wskazania własności metodyki.',
  },
};
