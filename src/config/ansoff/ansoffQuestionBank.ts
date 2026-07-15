/**
 * Ansoff Growth Paths — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * Where Ambition Decomposer ladders by CASCADE, Ansoff ladders by the
 * discipline a growth option must survive before it earns a quadrant slot:
 *   L1 claim           — locate the growth option as a decision-maker would say it
 *   L2 forced evidence — FORCE proof of under-saturation (loops back on itself
 *                        until the user names a real signal — see 'ans-evidence-force')
 *   L3 quantification  — headroom (buyers x frequency x basket) + cost of entry
 *   L4 sequencing      — capability gate + explicit deferral of the riskiest path
 */

export type AnsoffQuestionLevel = 1 | 2 | 3 | 4;

export const ANSOFF_QUESTION_LEVEL_LABEL: Record<AnsoffQuestionLevel, { pl: string; en: string }> =
  {
    1: { pl: 'Roszczenie wzrostu', en: 'Growth claim' },
    2: { pl: 'Wymuszony dowód', en: 'Forced evidence' },
    3: { pl: 'Kwantyfikacja', en: 'Quantification' },
    4: { pl: 'Sekwencja i zdolności', en: 'Sequencing & capability' },
  };

export interface AnsoffAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextAnsoffQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface AnsoffQuestionNode {
  id: string;
  level: AnsoffQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: AnsoffAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for
   * this path. Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the growth option
// ---------------------------------------------------------------------------

const ANSOFF_QUESTIONS: AnsoffQuestionNode[] = [
  {
    id: 'ans-surface',
    level: 1,
    intentEn: 'Locate the growth option the way a decision-maker would actually say it.',
    intentPl: 'Zlokalizować opcję wzrostu tak, jak powiedziałby ją decydent na głos.',
    textEn:
      'State the growth move exactly as the sponsor would pitch it. Which Ansoff quadrant does it sit in, and is that placement obvious or contested?',
    textPl:
      'Podaj ruch wzrostowy dokładnie tak, jak przedstawiłby go sponsor. W której ćwiartce Ansoffa siedzi i czy to przypisanie jest oczywiste, czy sporne?',
    probeEn: 'If it touches two quadrants at once, which one carries the real risk?',
    probePl: 'Jeśli dotyka dwóch ćwiartek naraz, która niesie realne ryzyko?',
    answerOptions: [
      {
        key: 'clear-quadrant',
        labelEn: 'Clear — one quadrant, unambiguous',
        labelPl: 'Jasne — jedna ćwiartka, jednoznacznie',
        consultantSignalEn: 'Quadrant settled — move straight to the evidence check.',
        consultantSignalPl: 'Ćwiartka ustalona — przejdź od razu do sprawdzenia dowodu.',
      },
      {
        key: 'contested-quadrant',
        labelEn: 'Contested — could be read as two different quadrants',
        labelPl: 'Sporne — można to czytać jako dwie różne ćwiartki',
        consultantSignalEn:
          'A contested placement usually hides a bigger bet than declared — force the evidence question harder.',
        consultantSignalPl:
          'Sporne przypisanie zwykle kryje większy zakład niż deklarowany — mocniej wymuś pytanie o dowód.',
      },
    ],
    branches: {
      'clear-quadrant': 'ans-evidence-check',
      'contested-quadrant': 'ans-evidence-force',
    },
    defaultNextId: 'ans-evidence-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED EVIDENCE
  // -------------------------------------------------------------------------

  {
    id: 'ans-evidence-check',
    level: 2,
    intentEn: 'Every quadrant except penetration is a bet on something you have not proven yet.',
    intentPl: 'Każda ćwiartka poza penetracją to zakład na coś, czego jeszcze nie udowodniono.',
    textEn:
      'What proof do you have that untapped headroom actually exists here — share data, saturation analysis, a pilot signal?',
    textPl:
      'Jaki macie dowód, że niewykorzystany headroom realnie tu istnieje — dane o udziale, analiza nasycenia, sygnał z pilotażu?',
    probeEn: 'Would this proof survive being challenged by someone who wants to kill the idea?',
    probePl: 'Czy ten dowód przetrwałby wyzwanie kogoś, kto chce zabić ten pomysł?',
    answerOptions: [
      {
        key: 'has-signal',
        labelEn: 'Yes — a named signal or data point backs it',
        labelPl: 'Tak — popiera to nazwany sygnał lub dane',
        consultantSignalEn: 'Evidence-backed — safe to quantify headroom as a fact, not a guess.',
        consultantSignalPl:
          'Poparte dowodem — bezpiecznie kwantyfikować headroom jako fakt, nie zgadywanie.',
      },
      {
        key: 'gut-feel',
        labelEn: 'No — it is a gut feeling the team believes in',
        labelPl: 'Nie — to przeczucie, w które wierzy zespół',
        consultantSignalEn:
          'Ungrounded option — route to the forced-evidence question before quantification.',
        consultantSignalPl:
          'Opcja bez podstaw — skieruj do wymuszonego pytania o dowód przed kwantyfikacją.',
      },
    ],
    branches: {
      'has-signal': 'ans-quant-headroom',
      'gut-feel': 'ans-evidence-force',
    },
    defaultNextId: 'ans-quant-headroom',
  },
  {
    id: 'ans-evidence-force',
    level: 2,
    intentEn: 'A growth bet with zero proof is a wish wearing a strategy label.',
    intentPl: 'Zakład wzrostowy bez żadnego dowodu to życzenie przebrane za strategię.',
    textEn:
      'Name one concrete signal — a data point, a customer conversation, a competitor move — that this headroom is real. "We believe in it" does not count.',
    textPl:
      'Nazwij jeden konkretny sygnał — dane, rozmowę z klientem, ruch konkurencji — że ten headroom jest realny. „Wierzymy w to" się nie liczy.',
    probeEn:
      'If you truly have nothing, what is the cheapest test that would produce a signal in two weeks?',
    probePl:
      'Jeśli naprawdę nie macie nic, jaki jest najtańszy test, który da sygnał w dwa tygodnie?',
    answerOptions: [
      {
        key: 'signal-named',
        labelEn: 'Found one — a concrete signal is now named',
        labelPl: 'Znaleziono — konkretny sygnał jest teraz nazwany',
        consultantSignalEn: 'Evidence satisfied — proceed to quantification.',
        consultantSignalPl: 'Dowód spełniony — przejdź do kwantyfikacji.',
      },
      {
        key: 'still-nothing',
        labelEn: 'Still nothing concrete',
        labelPl: 'Wciąż nic konkretnego',
        consultantSignalEn:
          'Not satisfied — loop back, the ladder cannot quantify a headroom no one can point to.',
        consultantSignalPl:
          'Niespełnione — wracamy, drabinka nie może kwantyfikować headroomu, którego nikt nie potrafi wskazać.',
      },
    ],
    // Deliberately loops back to itself: the forced-evidence discipline does
    // not let the session quantify a headroom nobody can point to.
    branches: {
      'signal-named': 'ans-quant-headroom',
      'still-nothing': 'ans-evidence-force',
    },
    defaultNextId: 'ans-evidence-force',
  },

  // -------------------------------------------------------------------------
  // L3 — QUANTIFICATION: headroom + cost of entry
  // -------------------------------------------------------------------------

  {
    id: 'ans-quant-headroom',
    level: 3,
    intentEn: 'Headroom is a number, not an adjective.',
    intentPl: 'Headroom to liczba, nie przymiotnik.',
    textEn:
      'How much headroom is real — buyers x frequency x basket for penetration/development, or addressable pool for a new product/category? What does taking it cost (entry cost, cannibalization, channel conflict)?',
    textPl:
      'Ile headroomu jest realne — klienci x częstotliwość x koszyk dla penetracji/rozwoju, albo pula adresowalna dla nowego produktu/kategorii? Ile kosztuje jego zdobycie (koszt wejścia, kanibalizacja, konflikt kanału)?',
    probeEn:
      'If the number and the cost are both missing, is this really ready to leave the idea stage?',
    probePl: 'Jeśli brakuje i liczby, i kosztu, czy to naprawdę gotowe, by opuścić etap pomysłu?',
    answerOptions: [
      {
        key: 'quantified',
        labelEn: 'Yes — headroom and cost of entry are both named',
        labelPl: 'Tak — headroom i koszt wejścia są nazwane',
        consultantSignalEn: 'Quantified — check capability before sequencing.',
        consultantSignalPl: 'Skwantyfikowane — sprawdź zdolności przed sekwencjonowaniem.',
      },
      {
        key: 'partial',
        labelEn: 'Only one of the two is known',
        labelPl: 'Znana jest tylko jedna z tych dwóch wartości',
        consultantSignalEn:
          'Half-quantified — keep the missing half as an explicit open item, do not silently assume it.',
        consultantSignalPl:
          'Częściowo skwantyfikowane — trzymaj brakującą połowę jako jawnie otwartą pozycję, nie zakładaj cicho.',
      },
    ],
    branches: {
      quantified: 'ans-capability-gate',
      partial: 'ans-capability-gate',
    },
    defaultNextId: 'ans-capability-gate',
  },

  // -------------------------------------------------------------------------
  // L4 — SEQUENCING: capability gate + deliberate deferral
  // -------------------------------------------------------------------------

  {
    id: 'ans-capability-gate',
    level: 4,
    intentEn: 'A path with no owning capability is a plan to fail expensively.',
    intentPl: 'Ścieżka bez zdolności do jej dowiezienia to plan na drogą porażkę.',
    textEn:
      'Does the team already have the capability to execute this path (channel, product, or category expertise), or does capability need to be built first?',
    textPl:
      'Czy zespół ma już zdolność do wykonania tej ścieżki (kanał, produkt lub ekspertyza kategorii), czy zdolność trzeba najpierw zbudować?',
    probeEn: 'If capability must be built, what is the cheapest first step that tests it?',
    probePl:
      'Jeśli zdolność trzeba zbudować, jaki jest najtańszy pierwszy krok, który ją przetestuje?',
    answerOptions: [
      {
        key: 'capability-exists',
        labelEn: 'Yes — capability already exists',
        labelPl: 'Tak — zdolność już istnieje',
        consultantSignalEn: 'Ready to sequence now — no capability-building move needed first.',
        consultantSignalPl:
          'Gotowe do sekwencjonowania od razu — nie trzeba ruchu budującego zdolność najpierw.',
      },
      {
        key: 'capability-gap',
        labelEn: 'No — capability needs to be built or bought first',
        labelPl: 'Nie — zdolność trzeba najpierw zbudować lub kupić',
        consultantSignalEn:
          'Capability gap named — the sequence must insert a build/buy move before scaling this path.',
        consultantSignalPl:
          'Nazwana luka zdolności — sekwencja musi wstawić ruch budowy/zakupu przed skalowaniem tej ścieżki.',
      },
    ],
    branches: {
      'capability-exists': null,
      'capability-gap': null,
    },
    defaultNextId: null,
  },
];

export const ANSOFF_QUESTION_BANK: AnsoffQuestionNode[] = ANSOFF_QUESTIONS;

export function getAnsoffQuestion(id: string): AnsoffQuestionNode | undefined {
  return ANSOFF_QUESTION_BANK.find((q) => q.id === id);
}

export function getAnsoffQuestionsByLevel(level: AnsoffQuestionLevel): AnsoffQuestionNode[] {
  return ANSOFF_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the growth-claim surface question. */
export const ANSOFF_QUESTION_ROOT_ID = 'ans-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextAnsoffQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getAnsoffQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopAnsoffQuestion(id: string): boolean {
  const node = getAnsoffQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildAnsoffQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie wzrostu (lokalizacja ćwiartki) -> L2 wymuszony dowód (opcja bez sygnału MUSI wskazać konkretny dowód, inaczej pytanie "ans-evidence-force" wraca do siebie) -> L3 kwantyfikacja (headroom + koszt wejścia) -> L4 sekwencja i zdolności (jawna luka zdolności przed skalowaniem).`;
  }
  return `The question ladder has 4 levels: L1 growth claim (locate the quadrant) -> L2 forced evidence (an option with no signal MUST name a concrete proof, otherwise question "ans-evidence-force" loops back on itself) -> L3 quantification (headroom + cost of entry) -> L4 sequencing & capability (an explicit capability gap before scaling).`;
}
