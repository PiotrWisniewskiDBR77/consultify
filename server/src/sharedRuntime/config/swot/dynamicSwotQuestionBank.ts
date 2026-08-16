/** GENERATED MIRROR — run scripts/cleanup/sync-server-runtime-mirrors.mjs; do not edit directly. */
/**
 * Dynamic SWOT — laddered question bank (OXFORD O3 pilot).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) +
 * src/config/consultingToolsStandard.ts (mission -> signals -> analysis -> conclusions -> outputs).
 *
 * Each quadrant carries a 4-level ladder of partner-grade questions. The answer to a
 * question determines the next question (branching), so the conversation digs instead
 * of collecting yes/no checkboxes. Levels:
 *   L1 surface        — locate the claim ("where exactly?")
 *   L2 evidence       — force the proof or the honest "declared, unconfirmed"
 *   L3 decomposition  — split umbrella claims into actionable roots / scope
 *   L4 durability     — test how long the claim survives contact with the market
 *
 * Every function here is pure — the runtime and the AI prompts both consume this bank,
 * so a question asked by the mentor in chat and a question rendered in the wizard are
 * the same question (single source of truth).
 *
 * No separate deepeningLadder.ts here (unlike ansoff/capabilitymapper/etc): this file
 * IS the ladder for swot — a branching question bank predates and supersedes the flat
 * rung-array pattern for this reference tool. Wired into the live chat mentor via
 * buildQuadrantLadderPromptBlock -> src/hooks/discovery/toolAi/dynamicSwot.ts's
 * buildDynamicSwotConversationProtocol -> useToolAI.ts sendMessage. Full 19-tool
 * deepening architecture map: docs/standards/O3_DEEPENING_MAP.md (rejestr J6).
 */

import type { SWOTItem } from '../../types/swot.js';

export type SwotQuadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats';

export type SwotQuestionLevel = 1 | 2 | 3 | 4;

/** Classification produced by the strengths ladder — a strength is not one thing. */
export type SwotStrengthClassification =
  | 'core-competency' // externally validated + broad + hard to copy
  | 'niche-strength' // externally validated but holds only in a segment
  | 'claimed-strength' // internal belief, no external proof yet
  | 'table-stakes'; // real but every serious competitor has it too

export type SwotEvidenceStatus = 'confirmed' | 'declared' | 'missing';

export interface SwotAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (used to steer the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface SwotQuestionNode {
  id: string;
  quadrant: SwotQuadrant;
  level: SwotQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally to the user as tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: SwotAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for this path.
   * Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// STRENGTHS — differentiation, proof, scope (niche vs core), durability
// ---------------------------------------------------------------------------

const STRENGTH_QUESTIONS: SwotQuestionNode[] = [
  {
    id: 's1-surface',
    quadrant: 'strengths',
    level: 1,
    intentEn: 'Locate a real differentiator, not a self-description.',
    intentPl: 'Zlokalizować realny wyróżnik, nie autoprezentację.',
    textEn:
      'What do you consistently do better than the alternatives your clients could choose — and who says so: you, or your clients?',
    textPl:
      'Co robicie konsekwentnie lepiej niż alternatywy, spośród których mogą wybierać Wasi klienci — i kto tak twierdzi: Wy czy klienci?',
    probeEn: 'Name one situation in the last 12 months where this strength decided the outcome.',
    probePl: 'Podaj jedną sytuację z ostatnich 12 miesięcy, w której ta siła przesądziła o wyniku.',
    answerOptions: [
      {
        key: 'client-confirmed',
        labelEn: 'Clients confirm it (won deals, renewals, references)',
        labelPl: 'Potwierdzają to klienci (wygrane, przedłużenia, referencje)',
        consultantSignalEn: 'External validation exists — go test commercial visibility.',
        consultantSignalPl: 'Jest walidacja zewnętrzna — testuj widoczność komercyjną.',
      },
      {
        key: 'internal-belief',
        labelEn: 'It is mostly our internal conviction',
        labelPl: 'To głównie nasze wewnętrzne przekonanie',
        consultantSignalEn: 'No external proof yet — force the evidence question before scope.',
        consultantSignalPl: 'Brak dowodu zewnętrznego — wymuś pytanie o dowód przed zasięgiem.',
      },
    ],
    branches: {
      'client-confirmed': 's2-commercial-proof',
      'internal-belief': 's2-external-proof',
    },
    defaultNextId: 's2-external-proof',
  },
  {
    id: 's2-commercial-proof',
    quadrant: 'strengths',
    level: 2,
    intentEn: 'A strength that does not show up in numbers is a hobby.',
    intentPl: 'Siła, której nie widać w liczbach, jest hobby.',
    textEn:
      'Where does this strength show up commercially — win rate, price premium, retention, referral share? Which number would you point to in front of a board?',
    textPl:
      'Gdzie ta siła jest widoczna komercyjnie — win rate, premia cenowa, retencja, udział poleceń? Którą liczbę pokazałbyś zarządowi?',
    probeEn: 'If you cannot name the number, who in the company can, and by when?',
    probePl: 'Jeśli nie znasz tej liczby — kto w firmie ją zna i na kiedy ją dostaniemy?',
    answerOptions: [
      {
        key: 'measurable',
        labelEn: 'Yes — a concrete metric shows it',
        labelPl: 'Tak — pokazuje to konkretna metryka',
        consultantSignalEn: 'Confirmed strength — test its scope next.',
        consultantSignalPl: 'Siła potwierdzona — testuj teraz jej zasięg.',
      },
      {
        key: 'not-measurable',
        labelEn: 'We feel it, but no metric captures it yet',
        labelPl: 'Czujemy to, ale żadna metryka tego jeszcze nie łapie',
        consultantSignalEn: 'Downgrade to declared until a proxy metric is named.',
        consultantSignalPl: 'Obniż do deklaracji, dopóki nie wskażemy metryki zastępczej.',
      },
    ],
    branches: {
      measurable: 's3-scope',
      'not-measurable': 's2-external-proof',
    },
    defaultNextId: 's3-scope',
  },
  {
    id: 's2-external-proof',
    quadrant: 'strengths',
    level: 2,
    intentEn: 'Separate evidence from folklore before building strategy on it.',
    intentPl: 'Oddzielić dowód od folkloru, zanim zbudujemy na tym strategię.',
    textEn:
      'Who outside the company would confirm this strength — a client, an auditor, an industry ranking, a lost competitor? What exactly would they point to?',
    textPl:
      'Kto spoza firmy potwierdziłby tę siłę — klient, audytor, ranking branżowy, konkurent, który przegrał? Na co dokładnie by wskazał?',
    probeEn: 'If nobody external confirms it, we keep it — but labelled "declared, unconfirmed".',
    probePl:
      'Jeśli nikt z zewnątrz tego nie potwierdza, zostawiamy — ale z etykietą „deklaracja, niepotwierdzone".',
    answerOptions: [
      {
        key: 'external-proof',
        labelEn: 'Yes — we can name the external confirmation',
        labelPl: 'Tak — potrafimy wskazać zewnętrzne potwierdzenie',
        consultantSignalEn: 'Attach the proof as a signal; upgrade to confirmed.',
        consultantSignalPl: 'Podepnij dowód jako sygnał; podnieś do potwierdzone.',
      },
      {
        key: 'no-proof',
        labelEn: 'No — for now it is our declaration',
        labelPl: 'Nie — na razie to nasza deklaracja',
        consultantSignalEn:
          'Keep as declared/unconfirmed; strategy may not lean on it as a load-bearing wall.',
        consultantSignalPl:
          'Zostaw jako deklarację; strategia nie może się na tym opierać jak na ścianie nośnej.',
      },
    ],
    branches: {
      'external-proof': 's3-scope',
      'no-proof': 's3-scope',
    },
    defaultNextId: 's3-scope',
  },
  {
    id: 's3-scope',
    quadrant: 'strengths',
    level: 3,
    intentEn:
      'Distinguish a niche strength from a core competency — they fund different strategies.',
    intentPl: 'Odróżnić siłę niszową od core competency — finansują różne strategie.',
    textEn:
      'Does this strength hold across your whole business, or only in one segment, one geography, one client type? Where exactly does it stop working?',
    textPl:
      'Czy ta siła działa w całym biznesie, czy tylko w jednym segmencie, jednej geografii, jednym typie klienta? Gdzie dokładnie przestaje działać?',
    probeEn: 'A strength that only works for 20% of revenue is a niche asset — plan it as one.',
    probePl: 'Siła działająca na 20% przychodu to aktywo niszowe — i tak trzeba je planować.',
    answerOptions: [
      {
        key: 'broad',
        labelEn: 'It holds across the core of the business',
        labelPl: 'Działa w rdzeniu całego biznesu',
        consultantSignalEn: 'Core-competency candidate — test durability.',
        consultantSignalPl: 'Kandydat na core competency — testuj trwałość.',
      },
      {
        key: 'niche',
        labelEn: 'It holds in a specific niche/segment only',
        labelPl: 'Działa tylko w konkretnej niszy/segmencie',
        consultantSignalEn:
          'Niche strength — valuable for focus plays, dangerous as a basis for broad expansion.',
        consultantSignalPl:
          'Siła niszowa — cenna przy grze na fokus, groźna jako podstawa szerokiej ekspansji.',
      },
    ],
    branches: {
      broad: 's4-durability',
      niche: 's4-durability',
    },
    defaultNextId: 's4-durability',
  },
  {
    id: 's4-durability',
    quadrant: 'strengths',
    level: 4,
    intentEn:
      'Test imitability — a strength a funded competitor copies in a year is a head start, not a moat.',
    intentPl:
      'Test kopiowalności — siła, którą dofinansowany konkurent skopiuje w rok, to przewaga startowa, nie fosa.',
    textEn:
      'If a competitor with money decided today to replicate this, how long would it take them — and what actually protects it: assets, relationships, know-how, scale, brand?',
    textPl:
      'Gdyby konkurent z pieniędzmi zdecydował dziś, że to kopiuje — ile by mu to zajęło i co realnie tę siłę chroni: aktywa, relacje, know-how, skala, marka?',
    probeEn: 'Protection you cannot name is protection you do not have.',
    probePl: 'Ochrona, której nie umiesz nazwać, to ochrona, której nie masz.',
    answerOptions: [
      {
        key: 'durable',
        labelEn: 'Years — protected by hard-to-copy assets or relationships',
        labelPl: 'Lata — chronią ją trudne do skopiowania aktywa lub relacje',
        consultantSignalEn: 'Durable advantage — can carry offensive (SO) moves.',
        consultantSignalPl: 'Przewaga trwała — może nieść ruchy ofensywne (SO).',
      },
      {
        key: 'copyable',
        labelEn: 'Months — mostly execution, others could catch up',
        labelPl: 'Miesiące — to głównie egzekucja, inni mogą dogonić',
        consultantSignalEn:
          'Perishable advantage — moves built on it need speed and a reinforcement plan.',
        consultantSignalPl:
          'Przewaga nietrwała — ruchy na niej oparte wymagają tempa i planu wzmocnienia.',
      },
    ],
    branches: { durable: null, copyable: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// WEAKNESSES — locate the pain, decompose the root, price it, test urgency
// ---------------------------------------------------------------------------

const WEAKNESS_QUESTIONS: SwotQuestionNode[] = [
  {
    id: 'w1-surface',
    quadrant: 'weaknesses',
    level: 1,
    intentEn: 'Anchor the weakness in a place where it demonstrably costs something.',
    intentPl: 'Zakotwiczyć słabość tam, gdzie wykazywalnie coś kosztuje.',
    textEn:
      'Where do you lose because of this — deals, margin, time, people? Name the single place where it hurts most, with an example from the last quarter.',
    textPl:
      'Gdzie przez to przegrywacie — kontrakty, marżę, czas, ludzi? Wskaż jedno miejsce, gdzie boli najbardziej, z przykładem z ostatniego kwartału.',
    probeEn: 'A weakness nobody can localize is an opinion, not a finding.',
    probePl: 'Słabość, której nikt nie umie zlokalizować, jest opinią, nie ustaleniem.',
    answerOptions: [
      {
        key: 'localized',
        labelEn: 'We can point to a concrete loss',
        labelPl: 'Umiemy wskazać konkretną stratę',
        consultantSignalEn: 'Real weakness — decompose the root before prescribing.',
        consultantSignalPl: 'Realna słabość — zdekomponuj korzeń zanim przepiszesz lek.',
      },
      {
        key: 'diffuse',
        labelEn: 'It is a general feeling, hard to pin down',
        labelPl: 'To ogólne odczucie, trudno je przygwoździć',
        consultantSignalEn:
          'Umbrella claim — force decomposition; "lack of agility" is four different problems.',
        consultantSignalPl:
          'Parasolowa teza — wymuś dekompozycję; „brak zwinności" to cztery różne problemy.',
      },
    ],
    branches: {
      localized: 'w2-decompose',
      diffuse: 'w2-decompose',
    },
    defaultNextId: 'w2-decompose',
  },
  {
    id: 'w2-decompose',
    quadrant: 'weaknesses',
    level: 2,
    intentEn:
      'Every root demands a different move: process -> redesign, tools -> investment, skills -> hiring/training, incentives -> management system.',
    intentPl:
      'Każdy korzeń wymaga innego ruchu: procesy -> przeprojektowanie, narzędzia -> inwestycja, kompetencje -> rekrutacja/szkolenia, bodźce -> system zarządczy.',
    textEn:
      'Is the root of this weakness in processes (how work flows), tools (what people work with), skills (who does the work), or incentives and mindset (why people behave this way)? Pick the dominant one — they require different fixes.',
    textPl:
      'Czy korzeń tej słabości tkwi w procesach (jak płynie praca), narzędziach (czym ludzie pracują), kompetencjach (kto wykonuje pracę), czy w bodźcach i nastawieniu (dlaczego ludzie tak się zachowują)? Wskaż dominujący — każdy wymaga innej naprawy.',
    probeEn: 'If you answer "all of them", pick the one you would fix first and say why.',
    probePl:
      'Jeśli odpowiedź brzmi „wszystkie", wybierz ten, który naprawiłbyś pierwszy — i powiedz dlaczego.',
    answerOptions: [
      {
        key: 'process',
        labelEn: 'Processes — how work flows',
        labelPl: 'Procesy — jak płynie praca',
        consultantSignalEn: 'Process root — fix = redesign + ownership, not motivation talks.',
        consultantSignalPl:
          'Korzeń procesowy — lek = przeprojektowanie + właściciel, nie pogadanki motywacyjne.',
      },
      {
        key: 'tools',
        labelEn: 'Tools/systems — what people work with',
        labelPl: 'Narzędzia/systemy — czym ludzie pracują',
        consultantSignalEn: 'Tooling root — fix = targeted investment with a payback case.',
        consultantSignalPl: 'Korzeń narzędziowy — lek = punktowa inwestycja z rachunkiem zwrotu.',
      },
      {
        key: 'skills',
        labelEn: 'Skills — who does the work',
        labelPl: 'Kompetencje — kto wykonuje pracę',
        consultantSignalEn: 'Capability root — fix = hiring/training with a named gap.',
        consultantSignalPl: 'Korzeń kompetencyjny — lek = rekrutacja/rozwój z nazwaną luką.',
      },
      {
        key: 'incentives',
        labelEn: 'Incentives & mindset — why people behave this way',
        labelPl: 'Bodźce i nastawienie — dlaczego ludzie tak się zachowują',
        consultantSignalEn:
          'Incentive root — fix = management system and measures, the hardest and slowest lever.',
        consultantSignalPl:
          'Korzeń bodźcowy — lek = system zarządczy i mierniki; dźwignia najtrudniejsza i najwolniejsza.',
      },
    ],
    branches: {
      process: 'w3-cost',
      tools: 'w3-cost',
      skills: 'w3-cost',
      incentives: 'w3-cost',
    },
    defaultNextId: 'w3-cost',
  },
  {
    id: 'w3-cost',
    quadrant: 'weaknesses',
    level: 3,
    intentEn: 'Price the weakness — unpriced weaknesses lose every prioritization meeting.',
    intentPl:
      'Wycenić słabość — niewycenione słabości przegrywają każde spotkanie priorytetyzacyjne.',
    textEn:
      'What does this weakness cost per year — in lost deals, extra hours, churn, rework? Even an order of magnitude anchored in one real number from your business.',
    textPl:
      'Ile ta słabość kosztuje rocznie — w przegranych kontraktach, nadgodzinach, odejściach, poprawkach? Wystarczy rząd wielkości zakotwiczony w jednej realnej liczbie z Waszego biznesu.',
    probeEn: 'No number? Then name where the number lives and make retrieving it the first action.',
    probePl: 'Brak liczby? Wskaż, gdzie ta liczba mieszka — jej zdobycie to pierwsza akcja.',
    answerOptions: [
      {
        key: 'priced',
        labelEn: 'We can anchor it in a real number',
        labelPl: 'Umiemy zakotwiczyć ją w realnej liczbie',
        consultantSignalEn: 'Priced weakness — feeds impact ranking directly.',
        consultantSignalPl: 'Słabość wyceniona — zasila ranking wpływu wprost.',
      },
      {
        key: 'unpriced',
        labelEn: 'We cannot price it yet',
        labelPl: 'Jeszcze nie umiemy jej wycenić',
        consultantSignalEn:
          'Keep qualitative, mark "to be established (where/when)" — never invent the number.',
        consultantSignalPl:
          'Zostaw jakościowo, oznacz „do ustalenia (gdzie/kiedy)" — nigdy nie wymyślaj liczby.',
      },
    ],
    branches: { priced: 'w4-trajectory', unpriced: 'w4-trajectory' },
    defaultNextId: 'w4-trajectory',
  },
  {
    id: 'w4-trajectory',
    quadrant: 'weaknesses',
    level: 4,
    intentEn: 'Test urgency — weaknesses that compound outrank weaknesses that merely persist.',
    intentPl: 'Test pilności — słabości, które się kumulują, wyprzedzają te, które tylko trwają.',
    textEn:
      'If you did nothing about this for 24 months, what breaks first — and does the cost stay flat or compound as you grow?',
    textPl:
      'Jeśli przez 24 miesiące nic z tym nie zrobicie — co pęknie pierwsze i czy koszt jest płaski, czy rośnie razem z Wami?',
    answerOptions: [
      {
        key: 'compounding',
        labelEn: 'It compounds — growth makes it worse',
        labelPl: 'Kumuluje się — wzrost ją pogarsza',
        consultantSignalEn: 'Scaling blocker — candidate for repair (WO) before growth moves.',
        consultantSignalPl:
          'Bloker skalowania — kandydat do naprawy (WO) przed ruchami wzrostowymi.',
      },
      {
        key: 'stable',
        labelEn: 'It stays roughly flat',
        labelPl: 'Pozostaje mniej więcej płaska',
        consultantSignalEn:
          'Chronic but stable — may be consciously tolerated; name that as a decision.',
        consultantSignalPl:
          'Przewlekła, ale stabilna — można ją świadomie tolerować; nazwij to jako decyzję.',
      },
    ],
    branches: { compounding: null, stable: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// OPPORTUNITIES — source of change, right to win, window, test
// ---------------------------------------------------------------------------

const OPPORTUNITY_QUESTIONS: SwotQuestionNode[] = [
  {
    id: 'o1-source',
    quadrant: 'opportunities',
    level: 1,
    intentEn: 'An opportunity must ride an external change — otherwise it is a wish.',
    intentPl: 'Szansa musi jechać na zewnętrznej zmianie — inaczej jest życzeniem.',
    textEn:
      'What is changing outside the company that creates this opportunity — market, technology, regulation, a competitor stumbling? What is the evidence that the change is real?',
    textPl:
      'Co zmienia się na zewnątrz firmy i tworzy tę szansę — rynek, technologia, regulacje, potknięcie konkurenta? Jaki jest dowód, że ta zmiana naprawdę zachodzi?',
    probeEn: '"The market is growing" is not evidence. A named client asking for it is.',
    probePl: '„Rynek rośnie" nie jest dowodem. Konkretny klient, który o to pyta — jest.',
    answerOptions: [
      {
        key: 'evidenced-change',
        labelEn: 'We can point to concrete evidence of the change',
        labelPl: 'Umiemy wskazać konkretny dowód zmiany',
        consultantSignalEn: 'Real external pull — test the right to win.',
        consultantSignalPl: 'Realny zewnętrzny ciąg — testuj prawo do wygranej.',
      },
      {
        key: 'assumed-change',
        labelEn: 'We assume it based on general trends',
        labelPl: 'Zakładamy ją na bazie ogólnych trendów',
        consultantSignalEn:
          'Hypothesis — keep, but the first move must be a validation, not an investment.',
        consultantSignalPl:
          'Hipoteza — zostaw, ale pierwszym ruchem musi być walidacja, nie inwestycja.',
      },
    ],
    branches: {
      'evidenced-change': 'o2-right-to-win',
      'assumed-change': 'o2-right-to-win',
    },
    defaultNextId: 'o2-right-to-win',
  },
  {
    id: 'o2-right-to-win',
    quadrant: 'opportunities',
    level: 2,
    intentEn:
      'Opportunities are not for everyone — test whether THIS company has a right to win it.',
    intentPl: 'Szanse nie są dla wszystkich — sprawdź, czy TA firma ma prawo ją wygrać.',
    textEn:
      'Why would you win this opportunity rather than the three competitors who see the same thing? Which of your confirmed strengths does it connect to?',
    textPl:
      'Dlaczego to Wy wygracie tę szansę, a nie trzej konkurenci, którzy widzą to samo? Z którą z Waszych potwierdzonych sił ta szansa się łączy?',
    probeEn: 'An opportunity connected to no strength belongs in someone else’s SWOT.',
    probePl: 'Szansa niepołączona z żadną siłą należy do cudzego SWOT-a.',
    answerOptions: [
      {
        key: 'strength-backed',
        labelEn: 'It connects to a confirmed strength',
        labelPl: 'Łączy się z potwierdzoną siłą',
        consultantSignalEn: 'SO candidate — offensive play possible.',
        consultantSignalPl: 'Kandydat SO — możliwa gra ofensywna.',
      },
      {
        key: 'capability-gap',
        labelEn: 'We would first need to build/repair something',
        labelPl: 'Najpierw musielibyśmy coś zbudować/naprawić',
        consultantSignalEn:
          'WO pattern — the weakness on the path must be named and priced before committing.',
        consultantSignalPl:
          'Wzorzec WO — słabość na tej ścieżce trzeba nazwać i wycenić przed decyzją.',
      },
    ],
    branches: {
      'strength-backed': 'o3-window',
      'capability-gap': 'o3-window',
    },
    defaultNextId: 'o3-window',
  },
  {
    id: 'o3-window',
    quadrant: 'opportunities',
    level: 3,
    intentEn: 'Windows close — "why now" separates a plan from a someday-list.',
    intentPl: 'Okna się zamykają — „dlaczego teraz" oddziela plan od listy „kiedyś".',
    textEn:
      'How long is this window open — and what specifically closes it: a competitor moving first, regulation settling, a client deciding? What happens if you enter 12 months late?',
    textPl:
      'Jak długo to okno jest otwarte — i co konkretnie je zamyka: konkurent ruszający pierwszy, krzepnące regulacje, decydujący się klient? Co się stanie, jeśli wejdziecie 12 miesięcy za późno?',
    answerOptions: [
      {
        key: 'urgent-window',
        labelEn: 'The window closes soon / first mover matters',
        labelPl: 'Okno zamyka się szybko / liczy się pierwszeństwo',
        consultantSignalEn: 'Sequencing pressure — this opportunity fights for slot #1 in moves.',
        consultantSignalPl: 'Presja kolejności — ta szansa walczy o slot #1 w ruchach.',
      },
      {
        key: 'stable-window',
        labelEn: 'The window stays open — timing is flexible',
        labelPl: 'Okno pozostaje otwarte — timing jest elastyczny',
        consultantSignalEn: 'Patient opportunity — can be sequenced after repairs.',
        consultantSignalPl: 'Szansa cierpliwa — może iść po naprawach.',
      },
    ],
    branches: { 'urgent-window': 'o4-falsifier', 'stable-window': 'o4-falsifier' },
    defaultNextId: 'o4-falsifier',
  },
  {
    id: 'o4-falsifier',
    quadrant: 'opportunities',
    level: 4,
    intentEn: 'Force falsifiability — what cheap test would prove the opportunity wrong?',
    intentPl: 'Wymuś falsyfikowalność — jaki tani test mógłby obalić tę szansę?',
    textEn:
      'What would need to be true for this opportunity to be worth it — and what is the cheapest test that could prove it false within a quarter?',
    textPl:
      'Co musiałoby być prawdą, żeby ta szansa się opłaciła — i jaki najtańszy test może ją obalić w kwartał?',
    answerOptions: [
      {
        key: 'testable',
        labelEn: 'We can design a cheap test',
        labelPl: 'Umiemy zaprojektować tani test',
        consultantSignalEn: 'Test-first opportunity — the test IS the first step of the move.',
        consultantSignalPl: 'Szansa test-first — ten test JEST pierwszym krokiem ruchu.',
      },
      {
        key: 'bet-only',
        labelEn: 'It is only verifiable by committing',
        labelPl: 'Da się zweryfikować tylko wchodząc',
        consultantSignalEn: 'Big-bet profile — demands explicit risk sizing and a kill criterion.',
        consultantSignalPl: 'Profil big-bet — wymaga jawnej wyceny ryzyka i kryterium przerwania.',
      },
    ],
    branches: { testable: null, 'bet-only': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// THREATS — mechanism, early signal, time-to-impact, exposure
// ---------------------------------------------------------------------------

const THREAT_QUESTIONS: SwotQuestionNode[] = [
  {
    id: 't1-mechanism',
    quadrant: 'threats',
    level: 1,
    intentEn: 'Name the mechanism — "competition" is weather; a named mechanism is a threat.',
    intentPl: 'Nazwij mechanizm — „konkurencja" to pogoda; nazwany mechanizm to zagrożenie.',
    textEn:
      'What exactly could break your model — a specific competitor move, a substitute, regulation, or dependence on one client/supplier? Describe the mechanism, not the category.',
    textPl:
      'Co dokładnie może złamać Wasz model — konkretny ruch konkurenta, substytut, regulacja czy zależność od jednego klienta/dostawcy? Opisz mechanizm, nie kategorię.',
    probeEn: 'Finish the sentence: "We lose X because Y does Z."',
    probePl: 'Dokończ zdanie: „Tracimy X, bo Y robi Z".',
    answerOptions: [
      {
        key: 'competitive',
        labelEn: 'Competitor or substitute mechanism',
        labelPl: 'Mechanizm konkurencyjny lub substytucyjny',
        consultantSignalEn: 'Market-side threat — check for early evidence next.',
        consultantSignalPl: 'Zagrożenie rynkowe — sprawdź teraz wczesne dowody.',
      },
      {
        key: 'structural',
        labelEn: 'Structural: regulation, concentration, dependency',
        labelPl: 'Strukturalne: regulacje, koncentracja, zależność',
        consultantSignalEn: 'Structural threat — exposure sizing matters more than speed.',
        consultantSignalPl: 'Zagrożenie strukturalne — wycena ekspozycji ważniejsza niż tempo.',
      },
    ],
    branches: { competitive: 't2-early-signal', structural: 't2-early-signal' },
    defaultNextId: 't2-early-signal',
  },
  {
    id: 't2-early-signal',
    quadrant: 'threats',
    level: 2,
    intentEn: 'Separate observed threats from imagined ones — both matter, differently.',
    intentPl: 'Oddziel zagrożenia obserwowane od wyobrażonych — oba się liczą, ale inaczej.',
    textEn:
      'Is there an early indicator already visible — a lost deal, a client asking about the alternative, a draft regulation? Or is this still a scenario without a footprint?',
    textPl:
      'Czy widać już wczesny wskaźnik — przegrany kontrakt, klient pytający o alternatywę, projekt regulacji? Czy to wciąż scenariusz bez śladu?',
    answerOptions: [
      {
        key: 'visible-signal',
        labelEn: 'Yes — we have seen an early footprint',
        labelPl: 'Tak — widzieliśmy już wczesny ślad',
        consultantSignalEn: 'Live threat — time-to-impact drives priority.',
        consultantSignalPl: 'Zagrożenie żywe — czas-do-uderzenia dyktuje priorytet.',
      },
      {
        key: 'no-signal',
        labelEn: 'Not yet — it is a plausible scenario',
        labelPl: 'Jeszcze nie — to prawdopodobny scenariusz',
        consultantSignalEn:
          'Watchlist threat — define the tripwire indicator instead of acting now.',
        consultantSignalPl:
          'Zagrożenie na watchliście — zdefiniuj wskaźnik-potykacz zamiast działać już.',
      },
    ],
    branches: { 'visible-signal': 't3-time-to-impact', 'no-signal': 't3-time-to-impact' },
    defaultNextId: 't3-time-to-impact',
  },
  {
    id: 't3-time-to-impact',
    quadrant: 'threats',
    level: 3,
    intentEn: 'Time-to-impact and severity decide whether this is a fire or a pension problem.',
    intentPl: 'Czas-do-uderzenia i dotkliwość decydują, czy to pożar, czy problem emerytalny.',
    textEn:
      'If this threat materializes, how fast does it hit the P&L — next quarter or in three years? And how deep: an annoyance, a margin cut, or existential?',
    textPl:
      'Jeśli to zagrożenie się zmaterializuje, jak szybko uderzy w rachunek wyników — w przyszłym kwartale czy za trzy lata? I jak głęboko: uciążliwość, cięcie marży czy egzystencjalnie?',
    answerOptions: [
      {
        key: 'fast-severe',
        labelEn: 'Fast and severe',
        labelPl: 'Szybko i dotkliwie',
        consultantSignalEn: 'Defend-now profile — ST/WT moves outrank offense.',
        consultantSignalPl: 'Profil broń-teraz — ruchy ST/WT wyprzedzają ofensywę.',
      },
      {
        key: 'slow-or-mild',
        labelEn: 'Slow-burning or limited in depth',
        labelPl: 'Wolno narastające lub płytkie',
        consultantSignalEn: 'Monitored threat — assign an owner and an indicator, not a program.',
        consultantSignalPl:
          'Zagrożenie monitorowane — przypisz właściciela i wskaźnik, nie program.',
      },
    ],
    branches: { 'fast-severe': 't4-exposure', 'slow-or-mild': 't4-exposure' },
    defaultNextId: 't4-exposure',
  },
  {
    id: 't4-exposure',
    quadrant: 'threats',
    level: 4,
    intentEn: 'Concentration turns ordinary threats into existential ones.',
    intentPl: 'Koncentracja zamienia zwykłe zagrożenia w egzystencjalne.',
    textEn:
      'How concentrated is your exposure — what share of revenue, capacity, or supply sits in the blast radius? Which single point of failure worries you most?',
    textPl:
      'Jak skoncentrowana jest Wasza ekspozycja — jaka część przychodu, mocy lub dostaw siedzi w polu rażenia? Który pojedynczy punkt awarii martwi Was najbardziej?',
    answerOptions: [
      {
        key: 'concentrated',
        labelEn: 'High concentration — one point of failure dominates',
        labelPl: 'Wysoka koncentracja — dominuje jeden punkt awarii',
        consultantSignalEn:
          'De-concentration becomes a prerequisite move — it usually beats offense in sequencing.',
        consultantSignalPl:
          'De-koncentracja staje się ruchem-warunkiem — w kolejności zwykle bije ofensywę.',
      },
      {
        key: 'distributed',
        labelEn: 'Exposure is spread out',
        labelPl: 'Ekspozycja jest rozproszona',
        consultantSignalEn: 'Resilient posture — protection can stay lightweight.',
        consultantSignalPl: 'Postawa odporna — ochrona może pozostać lekka.',
      },
    ],
    branches: { concentrated: null, distributed: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// Bank assembly + pure accessors
// ---------------------------------------------------------------------------

export const DYNAMIC_SWOT_QUESTION_BANK: Record<SwotQuadrant, SwotQuestionNode[]> = {
  strengths: STRENGTH_QUESTIONS,
  weaknesses: WEAKNESS_QUESTIONS,
  opportunities: OPPORTUNITY_QUESTIONS,
  threats: THREAT_QUESTIONS,
};

const ALL_QUESTIONS: SwotQuestionNode[] = [
  ...STRENGTH_QUESTIONS,
  ...WEAKNESS_QUESTIONS,
  ...OPPORTUNITY_QUESTIONS,
  ...THREAT_QUESTIONS,
];

const QUESTION_INDEX = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getSwotQuestionById(id: string): SwotQuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

export function getSwotEntryQuestion(quadrant: SwotQuadrant): SwotQuestionNode {
  return DYNAMIC_SWOT_QUESTION_BANK[quadrant][0];
}

/**
 * Branching resolver: the answer to a question determines the next question.
 * Unknown answer keys fall back to defaultNextId (never dead-end silently).
 */
export function getNextSwotQuestion(
  currentQuestionId: string,
  answerKey: string
): SwotQuestionNode | null {
  const current = QUESTION_INDEX.get(currentQuestionId);
  if (!current) return null;
  const nextId =
    answerKey in current.branches ? current.branches[answerKey] : current.defaultNextId;
  if (!nextId) return null;
  return QUESTION_INDEX.get(nextId) || null;
}

export interface SwotLadderAnswer {
  questionId: string;
  answerKey: string;
  /** Free-text elaboration captured in conversation. */
  note?: string;
}

/**
 * Classify a strength from the ladder answers — the distinction the audit demanded:
 * a niche strength must never be sold as a core competency.
 */
export function classifyStrengthFromAnswers(
  answers: SwotLadderAnswer[]
): SwotStrengthClassification {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.answerKey]));
  const externallyValidated =
    byQuestion.get('s1-surface') === 'client-confirmed' ||
    byQuestion.get('s2-external-proof') === 'external-proof' ||
    byQuestion.get('s2-commercial-proof') === 'measurable';
  if (!externallyValidated) return 'claimed-strength';
  const scope = byQuestion.get('s3-scope');
  const durability = byQuestion.get('s4-durability');
  if (scope === 'niche') return 'niche-strength';
  if (scope === 'broad' && durability === 'durable') return 'core-competency';
  // Broad but copyable: real, but every funded competitor can match it.
  if (scope === 'broad' && durability === 'copyable') return 'table-stakes';
  return 'niche-strength';
}

// ---------------------------------------------------------------------------
// Evidence gate — accepting an item requires proof or an explicit declaration
// ---------------------------------------------------------------------------

export const DECLARED_UNCONFIRMED_LABEL = {
  pl: 'Deklaracja — niepotwierdzone',
  en: 'Declared — unconfirmed',
} as const;

export interface SwotEvidenceGateResult {
  status: SwotEvidenceStatus;
  /** Label to render on the card when status !== confirmed. */
  label?: { pl: string; en: string };
}

/**
 * Evidence gate applied when a SWOT item is ACCEPTED:
 * - linked signals or an evidence note  -> confirmed
 * - otherwise                           -> declared (explicit "declaration, unconfirmed" label)
 * The gate never blocks acceptance — it forces honesty about the evidence status
 * (CONCLUSION_LAYER R2: a report that names uncertainty beats one that masks it).
 */
export function evaluateSwotItemEvidence(
  item: Pick<SWOTItem, 'linkedSignalIds'> & { evidenceNote?: string }
): SwotEvidenceGateResult {
  const hasLinkedEvidence = Boolean(item.linkedSignalIds && item.linkedSignalIds.length > 0);
  const hasNote = Boolean(item.evidenceNote && item.evidenceNote.trim().length > 0);
  if (hasLinkedEvidence || hasNote) return { status: 'confirmed' };
  return { status: 'declared', label: { ...DECLARED_UNCONFIRMED_LABEL } };
}

/**
 * Structural self-check used by unit tests and (defensively) at module load in dev:
 * every branch target must exist, every quadrant has 3-4 leveled questions,
 * levels start at 1 and never skip, and every non-terminal path reaches a terminal.
 */
export function validateSwotQuestionBank(): string[] {
  const problems: string[] = [];
  (Object.keys(DYNAMIC_SWOT_QUESTION_BANK) as SwotQuadrant[]).forEach((quadrant) => {
    const questions = DYNAMIC_SWOT_QUESTION_BANK[quadrant];
    const levels = new Set(questions.map((q) => q.level));
    if (!levels.has(1)) problems.push(`${quadrant}: missing level-1 entry question`);
    if (levels.size < 3) problems.push(`${quadrant}: fewer than 3 question levels`);
    questions.forEach((q) => {
      if (q.quadrant !== quadrant) problems.push(`${q.id}: quadrant mismatch`);
      if (q.answerOptions.length < 2) problems.push(`${q.id}: fewer than 2 answer options`);
      q.answerOptions.forEach((opt) => {
        if (!(opt.key in q.branches)) problems.push(`${q.id}: option ${opt.key} has no branch`);
      });
      Object.entries(q.branches).forEach(([key, target]) => {
        if (target !== null && !QUESTION_INDEX.has(target)) {
          problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
        }
      });
      if (q.defaultNextId !== null && !QUESTION_INDEX.has(q.defaultNextId)) {
        problems.push(`${q.id}: defaultNextId points to missing question`);
      }
      if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
    });
    // Every path from the entry question must terminate (no cycles).
    const entry = questions.find((q) => q.level === 1);
    if (entry) {
      const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
      while (stack.length) {
        const { id, seen } = stack.pop()!;
        if (seen.has(id)) {
          problems.push(`${quadrant}: cycle detected at ${id}`);
          continue;
        }
        const node = QUESTION_INDEX.get(id);
        if (!node) continue;
        const nextSeen = new Set(seen).add(id);
        const targets = new Set(
          Object.values(node.branches).concat(node.defaultNextId ? [node.defaultNextId] : [])
        );
        targets.forEach((t) => {
          if (t) stack.push({ id: t, seen: nextSeen });
        });
      }
    }
  });
  return problems;
}

/**
 * Serialize the ladder for a quadrant into a prompt block, so the AI mentor asks
 * EXACTLY these questions in conversation (single source of truth with the UI).
 */
export function buildQuadrantLadderPromptBlock(
  quadrant: SwotQuadrant,
  language: 'pl' | 'en'
): string {
  const questions = DYNAMIC_SWOT_QUESTION_BANK[quadrant];
  return questions
    .map((q) => {
      const text = language === 'pl' ? q.textPl : q.textEn;
      const intent = language === 'pl' ? q.intentPl : q.intentEn;
      const options = q.answerOptions
        .map((opt) => {
          const label = language === 'pl' ? opt.labelPl : opt.labelEn;
          const signal = language === 'pl' ? opt.consultantSignalPl : opt.consultantSignalEn;
          const next = q.branches[opt.key];
          return `    - [${opt.key}] "${label}" -> ${next || 'ladder complete'} (${signal})`;
        })
        .join('\n');
      return `[${q.id}] (L${q.level}) intent: ${intent}\n  Q: ${text}\n${options}`;
    })
    .join('\n');
}
