/**
 * SOP Builder — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * SOP Builder ladders by the discipline a standard must survive before it is
 * enforceable, not aspirational:
 *   L1 claim              — locate the standard as an operator would state it
 *   L2 forced measurement — FORCE a measurable threshold (loops back on itself
 *                           until a real number lands — see 'sop-measure-force')
 *   L3 verification       — does a checklist point actually test this standard?
 *   L4 rollout            — pilot + owner before mandating everywhere
 */

export type SopQuestionLevel = 1 | 2 | 3 | 4;

export const SOP_QUESTION_LEVEL_LABEL: Record<SopQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Roszczenie standardu', en: 'Standard claim' },
  2: { pl: 'Wymuszony pomiar', en: 'Forced measurement' },
  3: { pl: 'Weryfikacja', en: 'Verification' },
  4: { pl: 'Wdrożenie', en: 'Rollout' },
};

export interface SopAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextSopQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface SopQuestionNode {
  id: string;
  level: SopQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: SopAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the standard
// ---------------------------------------------------------------------------

const SOP_QUESTIONS: SopQuestionNode[] = [
  {
    id: 'sop-surface',
    level: 1,
    intentEn: 'Locate the standard the way the operator running the step would state it.',
    intentPl: 'Zlokalizować standard tak, jak podałby go operator wykonujący ten krok.',
    textEn:
      'State the standard exactly as it should read on the floor. Is it a pass/fail boundary, or a description of intent?',
    textPl:
      'Podaj standard dokładnie tak, jak powinien brzmieć na hali. Czy to granica pass/fail, czy opis intencji?',
    probeEn: 'Could two different operators read this standard and reach different verdicts?',
    probePl:
      'Czy dwóch różnych operatorów mogłoby przeczytać ten standard i dojść do różnych werdyktów?',
    answerOptions: [
      {
        key: 'pass-fail',
        labelEn: 'It is a clear pass/fail boundary',
        labelPl: 'To jasna granica pass/fail',
        consultantSignalEn: 'Boundary exists — check whether it carries a measurable threshold.',
        consultantSignalPl: 'Granica istnieje — sprawdź, czy niesie mierzalny próg.',
      },
      {
        key: 'intent-only',
        labelEn: 'It is a description of intent ("do this well")',
        labelPl: 'To opis intencji ("rób to dobrze")',
        consultantSignalEn: 'An intent statement is not a standard yet — force measurement now.',
        consultantSignalPl: 'Opis intencji to jeszcze nie standard — wymuś pomiar teraz.',
      },
    ],
    branches: {
      'pass-fail': 'sop-measure-check',
      'intent-only': 'sop-measure-force',
    },
    defaultNextId: 'sop-measure-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED MEASUREMENT
  // -------------------------------------------------------------------------

  {
    id: 'sop-measure-check',
    level: 2,
    intentEn: 'A pass/fail boundary without a number is still judged "by eye".',
    intentPl: 'Granica pass/fail bez liczby wciąż jest oceniana "na oko".',
    textEn:
      'What is the measurable threshold, target, or duration that makes this standard testable — not a matter of judgment?',
    textPl:
      'Jaki jest mierzalny próg, cel lub czas trwania, który czyni ten standard testowalnym — a nie kwestią osądu?',
    probeEn: 'If a new hire read only the number, would they apply it the same way a veteran does?',
    probePl: 'Czy nowy pracownik, czytając tylko liczbę, zastosowałby ją tak samo jak weteran?',
    answerOptions: [
      {
        key: 'has-threshold',
        labelEn: 'Yes — a concrete threshold/target/duration is named',
        labelPl: 'Tak — konkretny próg/cel/czas jest nazwany',
        consultantSignalEn: 'Measurable — check whether a checklist actually verifies it.',
        consultantSignalPl: 'Mierzalne — sprawdź, czy checklista faktycznie to weryfikuje.',
      },
      {
        key: 'judged-by-eye',
        labelEn: 'No — it is judged "by eye"',
        labelPl: 'Nie — jest oceniane "na oko"',
        consultantSignalEn: 'Not measurable — route to the forced-measurement question.',
        consultantSignalPl: 'Niemierzalne — skieruj do wymuszonego pytania o pomiar.',
      },
    ],
    branches: {
      'has-threshold': 'sop-verify',
      'judged-by-eye': 'sop-measure-force',
    },
    defaultNextId: 'sop-verify',
  },
  {
    id: 'sop-measure-force',
    level: 2,
    intentEn:
      'An unmeasurable standard cannot be verified — it must earn a number before anything else.',
    intentPl:
      'Niemierzalny standard nie może być zweryfikowany — musi zdobyć liczbę zanim pójdzie dalej.',
    textEn:
      'Name the concrete threshold, target value, or duration that turns this into a testable standard. "Good judgment" is not a number.',
    textPl:
      'Nazwij konkretny próg, wartość docelową lub czas trwania, który zamienia to w testowalny standard. "Dobry osąd" to nie liczba.',
    probeEn:
      'If you truly cannot set a number yet, what pilot would let you measure one in a week?',
    probePl:
      'Jeśli naprawdę nie potraficie jeszcze ustalić liczby, jaki pilotaż pozwoli ją zmierzyć w tydzień?',
    answerOptions: [
      {
        key: 'threshold-set',
        labelEn: 'Set — a concrete threshold now exists',
        labelPl: 'Ustalono — konkretny próg teraz istnieje',
        consultantSignalEn: 'Measurement satisfied — proceed to verification coverage.',
        consultantSignalPl: 'Pomiar spełniony — przejdź do pokrycia weryfikacją.',
      },
      {
        key: 'still-by-eye',
        labelEn: 'Still no number — still judged by eye',
        labelPl: 'Wciąż brak liczby — wciąż oceniane na oko',
        consultantSignalEn:
          'Not satisfied — loop back, the ladder cannot verify a standard with no measurable criterion.',
        consultantSignalPl:
          'Niespełnione — wracamy, drabinka nie może weryfikować standardu bez mierzalnego kryterium.',
      },
    ],
    // Deliberately loops back to itself: the forced-measurement discipline
    // does not let the session verify a standard with no testable criterion.
    branches: {
      'threshold-set': 'sop-verify',
      'still-by-eye': 'sop-measure-force',
    },
    defaultNextId: 'sop-measure-force',
  },

  // -------------------------------------------------------------------------
  // L3 — VERIFICATION: does a checklist point actually test this?
  // -------------------------------------------------------------------------

  {
    id: 'sop-verify',
    level: 3,
    intentEn: 'A measurable standard with no verification point is enforced by no one.',
    intentPl: 'Mierzalny standard bez punktu weryfikacji nie jest egzekwowany przez nikogo.',
    textEn:
      'Does a specific checklist item test this exact standard, or does compliance rely on memory and good faith?',
    textPl:
      'Czy konkretna pozycja checklisty testuje dokładnie ten standard, czy zgodność polega na pamięci i dobrej woli?',
    probeEn: 'Who would catch a miss on this standard on a busy, understaffed shift?',
    probePl: 'Kto złapałby pominięcie tego standardu na zabieganej, niedoborowej zmianie?',
    answerOptions: [
      {
        key: 'checklist-covers',
        labelEn: 'Yes — a checklist item verifies it',
        labelPl: 'Tak — pozycja checklisty to weryfikuje',
        consultantSignalEn: 'Coverage exists — ready to sequence the rollout.',
        consultantSignalPl: 'Pokrycie istnieje — gotowe do sekwencjonowania wdrożenia.',
      },
      {
        key: 'no-checklist',
        labelEn: 'No — nothing checks it in practice',
        labelPl: 'Nie — nic tego w praktyce nie sprawdza',
        consultantSignalEn:
          'Coverage gap named — the sequence must insert a checklist-coverage move before rollout.',
        consultantSignalPl:
          'Nazwana luka pokrycia — sekwencja musi wstawić ruch pokrycia checklistą przed wdrożeniem.',
      },
    ],
    branches: {
      'checklist-covers': 'sop-rollout',
      'no-checklist': 'sop-rollout',
    },
    defaultNextId: 'sop-rollout',
  },

  // -------------------------------------------------------------------------
  // L4 — ROLLOUT: pilot + owner before mandating
  // -------------------------------------------------------------------------

  {
    id: 'sop-rollout',
    level: 4,
    intentEn: 'An SOP mandated everywhere without a pilot generates silent workarounds.',
    intentPl: 'SOP narzucony wszędzie bez pilotażu generuje ciche obejścia.',
    textEn:
      'Has this standard been piloted on one shift/line before mandating it everywhere, and does it have a named owner for the completion trace?',
    textPl:
      'Czy ten standard był pilotowany na jednej zmianie/linii przed narzuceniem go wszędzie i czy ma nazwanego właściciela śladu wykonania?',
    probeEn:
      'If the pilot has not happened, what would make the team trust the standard is workable at real pace?',
    probePl:
      'Jeśli pilotaż się nie odbył, co przekona zespół, że standard jest wykonalny w realnym tempie?',
    answerOptions: [
      {
        key: 'piloted-owned',
        labelEn: 'Yes — piloted and owned',
        labelPl: 'Tak — pilotowany i z właścicielem',
        consultantSignalEn: 'Ready to mandate at scale with a sustaining audit rhythm.',
        consultantSignalPl: 'Gotowe do narzucenia w skali z podtrzymującym rytmem audytu.',
      },
      {
        key: 'not-yet',
        labelEn: 'Not yet — no pilot or no named owner',
        labelPl: 'Jeszcze nie — brak pilotażu lub nazwanego właściciela',
        consultantSignalEn:
          'Gap named — the sequence must insert a pilot/ownership move before full mandate.',
        consultantSignalPl:
          'Nazwana luka — sekwencja musi wstawić ruch pilotażu/własności przed pełnym narzuceniem.',
      },
    ],
    branches: {
      'piloted-owned': null,
      'not-yet': null,
    },
    defaultNextId: null,
  },
];

export const SOP_QUESTION_BANK: SopQuestionNode[] = SOP_QUESTIONS;

export function getSopQuestion(id: string): SopQuestionNode | undefined {
  return SOP_QUESTION_BANK.find((q) => q.id === id);
}

export function getSopQuestionsByLevel(level: SopQuestionLevel): SopQuestionNode[] {
  return SOP_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the standard-claim surface question. */
export const SOP_QUESTION_ROOT_ID = 'sop-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextSopQuestionId(fromId: string, answerKey: string): string | null | undefined {
  const node = getSopQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopSopQuestion(id: string): boolean {
  const node = getSopQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildSopQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie standardu (granica pass/fail czy opis intencji) -> L2 wymuszony pomiar (standard oceniany "na oko" MUSI zdobyć próg, inaczej pytanie "sop-measure-force" wraca do siebie) -> L3 weryfikacja (czy checklista faktycznie testuje standard) -> L4 wdrożenie (pilotaż + właściciel przed pełnym narzuceniem).`;
  }
  return `The question ladder has 4 levels: L1 standard claim (pass/fail boundary or intent statement) -> L2 forced measurement (a standard judged "by eye" MUST earn a threshold, otherwise question "sop-measure-force" loops back on itself) -> L3 verification (does a checklist actually test the standard) -> L4 rollout (pilot + owner before full mandate).`;
}
