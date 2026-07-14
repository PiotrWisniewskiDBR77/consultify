/**
 * Ambition Decomposer — laddered, branching question bank (OXFORD O3).
 *
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) +
 * src/config/consultingToolsStandard.ts (mission -> signals -> analysis -> conclusions -> outputs)
 * + Harvard/wdrozenie-100/_PROJEKT_C_OXFORD.md §O3 ("q-banki głębokie... insight staircase").
 *
 * Pattern mirror of src/config/swot/dynamicSwotQuestionBank.ts: every question
 * node is pure data, the answer to a question determines the next question
 * (branching), and the SAME bank drives both the wizard UI and the AI mentor
 * prompt (single source of truth).
 *
 * Where SWOT ladders by QUADRANT, Ambition Decomposer ladders by the CASCADE
 * an ambition must survive before it is a plan:
 *   L1 ambition       — locate the claim as a decision-maker would say it out loud
 *   L2 decomposition  — FORCE the split of an umbrella ambition into distinct themes
 *                        (loops back on itself until the user actually splits it —
 *                        see 'amb-decompose-force' below)
 *   L3 quantification — each theme needs a measurable intermediate goal + a source
 *   L4 initiatives     — cascade into initiatives, each with explicit dependencies
 */

export type AmbitionQuestionLevel = 1 | 2 | 3 | 4;

export const AMBITION_QUESTION_LEVEL_LABEL: Record<
  AmbitionQuestionLevel,
  { pl: string; en: string }
> = {
  1: { pl: 'Ambicja', en: 'Ambition' },
  2: { pl: 'Wymuszona dekompozycja', en: 'Forced decomposition' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Inicjatywy i zależności', en: 'Initiatives & dependencies' },
};

export interface AmbitionAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextAmbitionQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface AmbitionQuestionNode {
  id: string;
  level: AmbitionQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally as a UI tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: AmbitionAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for
   * this path. Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — AMBITION: locate the claim
// ---------------------------------------------------------------------------

const AMBITION_QUESTIONS: AmbitionQuestionNode[] = [
  {
    id: 'amb-surface',
    level: 1,
    intentEn: 'Locate the ambition the way a decision-maker would actually say it.',
    intentPl: 'Zlokalizować ambicję tak, jak powiedziałby ją decydent na głos.',
    textEn:
      'State the ambition exactly as the CEO would say it in a board meeting. Does it carry a number and a date, or is it a phrase?',
    textPl:
      'Podaj ambicję dokładnie tak, jak powiedziałby ją prezes na zarządzie. Czy niesie liczbę i datę, czy jest to hasło?',
    probeEn: 'If there is no number, what would make the board believe this is more than a slogan?',
    probePl: 'Jeśli nie ma liczby, co przekona zarząd, że to więcej niż hasło?',
    answerOptions: [
      {
        key: 'has-number-date',
        labelEn: 'Yes — it has a measurable end-state and a date',
        labelPl: 'Tak — ma mierzalny stan docelowy i datę',
        consultantSignalEn: 'A real target exists — check whether it still bundles several levers.',
        consultantSignalPl: 'Jest realny cel — sprawdź, czy nie kryje kilku dźwigni naraz.',
      },
      {
        key: 'phrase-only',
        labelEn: 'No — it is an aspirational phrase (e.g. "become the market leader")',
        labelPl: 'Nie — to hasło aspiracyjne (np. „zostać liderem rynku")',
        consultantSignalEn:
          'Likely an umbrella ambition — force decomposition before anything else.',
        consultantSignalPl:
          'Prawdopodobnie ambicja parasolowa — wymuś dekompozycję zanim ruszysz dalej.',
      },
    ],
    branches: {
      'has-number-date': 'amb-decompose-check',
      'phrase-only': 'amb-decompose-force',
    },
    defaultNextId: 'amb-decompose-force',
  },

  // -------------------------------------------------------------------------
  // L2 — DECOMPOSITION (forced)
  // -------------------------------------------------------------------------

  {
    id: 'amb-decompose-check',
    level: 2,
    intentEn: 'A single headline number usually bundles more than one lever.',
    intentPl: 'Pojedyncza liczba nagłówkowa zwykle kryje więcej niż jedną dźwignię.',
    textEn:
      'Even with a number attached, ambitions like this usually bundle several distinct levers (e.g. new customers + higher prices + lower churn). Which distinct levers make up this number?',
    textPl:
      'Nawet z liczbą taka ambicja zwykle kryje kilka odrębnych dźwigni (np. nowi klienci + wyższe ceny + niższy churn). Które odrębne dźwignie składają się na tę liczbę?',
    probeEn: 'Could two different people each own one lever without stepping on each other?',
    probePl: 'Czy dwie różne osoby mogłyby wziąć po jednej dźwigni, nie wchodząc sobie w drogę?',
    answerOptions: [
      {
        key: 'multiple-levers-named',
        labelEn: 'Yes — 2+ distinct levers, each ownable separately',
        labelPl: 'Tak — 2+ odrębne dźwignie, każda do wzięcia osobno',
        consultantSignalEn: 'Decomposed enough — move to quantifying each lever as a theme.',
        consultantSignalPl:
          'Wystarczająco zdekomponowane — przejdź do kwantyfikacji każdej dźwigni jako wątku.',
      },
      {
        key: 'single-lever',
        labelEn: 'No — it really is one lever',
        labelPl: 'Nie — to naprawdę jedna dźwignia',
        consultantSignalEn:
          'Fine if true, but verify: one-lever ambitions are rare above the team level.',
        consultantSignalPl:
          'W porządku jeśli prawdziwe, ale zweryfikuj: jedna dźwignia powyżej poziomu zespołu to rzadkość.',
      },
    ],
    branches: {
      'multiple-levers-named': 'amb-quant-entry',
      'single-lever': 'amb-quant-entry',
    },
    defaultNextId: 'amb-quant-entry',
  },
  {
    id: 'amb-decompose-force',
    level: 2,
    intentEn:
      'An umbrella ambition is not actionable — force the split before anything downstream.',
    intentPl:
      'Ambicja parasolowa nie jest wykonalna — wymuś podział, zanim cokolwiek pójdzie dalej.',
    textEn:
      'This is an umbrella ambition — it hides more than one problem behind one phrase. Name at least two distinct, independently-deliverable themes that together would deliver it.',
    textPl:
      'To ambicja parasolowa — kryje więcej niż jeden problem pod jednym hasłem. Nazwij co najmniej dwa odrębne, niezależnie dowożalne wątki, które razem ją zrealizują.',
    probeEn:
      'If you can only name one theme, you have not decomposed yet — keep splitting until each theme could have a different owner.',
    probePl:
      'Jeśli potrafisz nazwać tylko jeden wątek, jeszcze nie zdekomponowałeś — dziel dalej, aż każdy wątek mógłby mieć innego właściciela.',
    answerOptions: [
      {
        key: 'decomposed',
        labelEn: 'Done — 2+ named themes, each ownable separately',
        labelPl: 'Gotowe — 2+ nazwane wątki, każdy do wzięcia osobno',
        consultantSignalEn: 'Decomposition satisfied — move to quantifying each theme.',
        consultantSignalPl: 'Dekompozycja spełniona — przejdź do kwantyfikacji każdego wątku.',
      },
      {
        key: 'still-one-theme',
        labelEn: 'I still only have one theme',
        labelPl: 'Wciąż mam tylko jeden wątek',
        consultantSignalEn: 'Not decomposed — loop back, the ladder cannot advance on a slogan.',
        consultantSignalPl: 'Brak dekompozycji — wracamy, drabinka nie może iść dalej na haśle.',
      },
    ],
    // Deliberately loops back to itself: the forced-decomposition discipline
    // does not let the session proceed past an undecomposed umbrella ambition.
    branches: {
      decomposed: 'amb-quant-entry',
      'still-one-theme': 'amb-decompose-force',
    },
    defaultNextId: 'amb-decompose-force',
  },

  // -------------------------------------------------------------------------
  // L3 — QUANTIFICATION: measurable intermediate goals per theme
  // -------------------------------------------------------------------------

  {
    id: 'amb-quant-entry',
    level: 3,
    intentEn: 'A theme without a measurable target is a wish, not a goal.',
    intentPl: 'Wątek bez mierzalnego celu to życzenie, nie cel.',
    textEn:
      'For each theme, what is the measurable intermediate goal — a targetMetric and a targetValue — and by when must it land?',
    textPl:
      'Dla każdego wątku: jaki jest mierzalny cel pośredni — targetMetric i targetValue — i do kiedy musi być gotowy?',
    probeEn: 'If you cannot name the metric, who in the company can, and by when will they?',
    probePl: 'Jeśli nie znasz metryki, kto w firmie ją zna i na kiedy ją dostaniemy?',
    answerOptions: [
      {
        key: 'metric-defined',
        labelEn: 'Yes — metric, value and horizon are all named',
        labelPl: 'Tak — metryka, wartość i horyzont są nazwane',
        consultantSignalEn: 'Quantified — now check the source behind the value.',
        consultantSignalPl: 'Skwantyfikowane — teraz sprawdź źródło wartości.',
      },
      {
        key: 'no-metric-yet',
        labelEn: 'Not yet — we only have a direction',
        labelPl: 'Jeszcze nie — mamy tylko kierunek',
        consultantSignalEn: 'Keep this theme as "declared, unconfirmed" until a metric lands.',
        consultantSignalPl:
          'Trzymaj ten wątek jako „deklaracja, niepotwierdzone", dopóki nie ma metryki.',
      },
    ],
    branches: {
      'metric-defined': 'amb-quant-evidence',
      'no-metric-yet': 'amb-quant-evidence',
    },
    defaultNextId: 'amb-quant-evidence',
  },
  {
    id: 'amb-quant-evidence',
    level: 3,
    intentEn: 'A target value must have a traceable source or be labelled a hypothesis.',
    intentPl: 'Wartość celu musi mieć wskazane źródło albo być oznaczona jako hipoteza.',
    textEn:
      'Where does that target value come from — a benchmark, a board mandate, a bottom-up calculation? If you cannot name a source, mark it explicitly as a hypothesis, not a fact.',
    textPl:
      'Skąd bierze się ta wartość celu — benchmark, mandat zarządu, wyliczenie bottom-up? Jeśli nie potrafisz wskazać źródła, oznacz to jawnie jako hipotezę, nie fakt.',
    probeEn: 'Would this number survive being challenged in front of the board?',
    probePl: 'Czy ta liczba przetrwałaby wyzwanie na zarządzie?',
    answerOptions: [
      {
        key: 'sourced',
        labelEn: 'Yes — a signal, benchmark or calculation backs it',
        labelPl: 'Tak — popiera ją sygnał, benchmark lub wyliczenie',
        consultantSignalEn: 'Sourced — safe to treat as a fact in the sequencing engine.',
        consultantSignalPl: 'Ma źródło — bezpiecznie traktować jako fakt w silniku sekwencji.',
      },
      {
        key: 'no-source',
        labelEn: 'No — it is our best guess',
        labelPl: 'Nie — to nasze najlepsze przypuszczenie',
        consultantSignalEn:
          'Flag as declared/unconfirmed — the invented-number guard must catch this if unlabeled.',
        consultantSignalPl:
          'Oznacz jako deklaracja/niepotwierdzone — strażnik zmyślonych liczb musi to złapać, jeśli nieoznaczone.',
      },
    ],
    branches: {
      sourced: 'amb-init-entry',
      'no-source': 'amb-init-entry',
    },
    defaultNextId: 'amb-init-entry',
  },

  // -------------------------------------------------------------------------
  // L4 — INITIATIVES: cascade into execution, with dependencies
  // -------------------------------------------------------------------------

  {
    id: 'amb-init-entry',
    level: 4,
    intentEn: 'A theme with no initiative under it is an intention, not a plan.',
    intentPl: 'Wątek bez inicjatywy pod nim to intencja, nie plan.',
    textEn:
      "Which initiatives will actually deliver this theme's target? Name at least one per critical theme — a theme with zero initiatives is a stated intention, not a plan.",
    textPl:
      'Które inicjatywy faktycznie zrealizują cel tego wątku? Nazwij co najmniej jedną dla każdego krytycznego wątku — wątek bez inicjatyw to deklarowana intencja, nie plan.',
    probeEn: 'If there is no initiative yet, who is accountable for proposing one, and by when?',
    probePl: 'Jeśli nie ma jeszcze inicjatywy, kto odpowiada za jej zaproponowanie i na kiedy?',
    answerOptions: [
      {
        key: 'initiatives-named',
        labelEn: 'Yes — at least one initiative is named per critical theme',
        labelPl: 'Tak — co najmniej jedna inicjatywa na krytyczny wątek',
        consultantSignalEn: 'Path exists — now check dependencies between initiatives.',
        consultantSignalPl: 'Ścieżka istnieje — teraz sprawdź zależności między inicjatywami.',
      },
      {
        key: 'none-yet',
        labelEn: 'No initiatives named yet for this theme',
        labelPl: 'Brak inicjatyw dla tego wątku',
        consultantSignalEn: 'Gap: "ambition without a path" — the engine will flag this theme.',
        consultantSignalPl: 'Luka: „ambicja bez ścieżki" — silnik oznaczy ten wątek.',
      },
    ],
    branches: {
      'initiatives-named': 'amb-init-deps',
      'none-yet': null,
    },
    defaultNextId: 'amb-init-deps',
  },
  {
    id: 'amb-init-deps',
    level: 4,
    intentEn: 'An unstated dependency is a sequencing accident waiting to happen.',
    intentPl: 'Niewypowiedziana zależność to wypadek sekwencji czekający, by się wydarzyć.',
    textEn:
      'Does any of these initiatives require another one to finish first? Name the dependency explicitly — "X before Y" — so the sequence is computed, not guessed.',
    textPl:
      'Czy któraś z tych inicjatyw wymaga, by inna skończyła się najpierw? Nazwij zależność wprost — „X przed Y" — żeby sekwencja była policzona, nie zgadywana.',
    probeEn: 'What breaks if the two run in parallel instead?',
    probePl: 'Co się psuje, jeśli te dwie pójdą równolegle zamiast po kolei?',
    answerOptions: [
      {
        key: 'deps-named',
        labelEn: 'Yes — dependencies are named explicitly',
        labelPl: 'Tak — zależności są nazwane wprost',
        consultantSignalEn: 'Sequencing engine can now compute a real topological order.',
        consultantSignalPl: 'Silnik sekwencji może teraz policzyć realną kolejność topologiczną.',
      },
      {
        key: 'independent',
        labelEn: 'No — they can genuinely run independently',
        labelPl: 'Nie — mogą naprawdę iść niezależnie',
        consultantSignalEn: 'No dependency edges — fine, as long as this was checked, not assumed.',
        consultantSignalPl:
          'Brak krawędzi zależności — w porządku, o ile to sprawdzone, nie założone.',
      },
    ],
    branches: {
      'deps-named': null,
      independent: null,
    },
    defaultNextId: null,
  },
];

export const AMBITION_QUESTION_BANK: AmbitionQuestionNode[] = AMBITION_QUESTIONS;

export function getAmbitionQuestion(id: string): AmbitionQuestionNode | undefined {
  return AMBITION_QUESTION_BANK.find((q) => q.id === id);
}

export function getAmbitionQuestionsByLevel(level: AmbitionQuestionLevel): AmbitionQuestionNode[] {
  return AMBITION_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the ambition surface question. */
export const AMBITION_QUESTION_ROOT_ID = 'amb-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextAmbitionQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getAmbitionQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopQuestion(id: string): boolean {
  const node = getAmbitionQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildAmbitionQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 ambicja (lokalizacja tezy) -> L2 wymuszona dekompozycja (ambicja parasolowa MUSI rozpaść się na 2+ wątki, inaczej pytanie "amb-decompose-force" wraca do siebie) -> L3 kwantyfikacja (metryka+wartość+źródło na wątek) -> L4 inicjatywy i zależności (co najmniej 1 inicjatywa na krytyczny wątek, zależności nazwane wprost).`;
  }
  return `The question ladder has 4 levels: L1 ambition (locate the claim) -> L2 forced decomposition (an umbrella ambition MUST split into 2+ themes, otherwise question "amb-decompose-force" loops back on itself) -> L3 quantification (metric+value+source per theme) -> L4 initiatives & dependencies (at least 1 initiative per critical theme, dependencies named explicitly).`;
}
