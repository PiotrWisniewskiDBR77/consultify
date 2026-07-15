/**
 * Pain Explorer — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * Pain Explorer ladders by the discipline a pain point must survive before it
 * is a real problem, not one person's complaint:
 *   L1 claim               — locate the pain as the person living it would say it
 *   L2 forced qualification — FORCE a second, independent source (loops back on
 *                            itself until corroborated — see 'pain-qualify-force')
 *   L3 quantification       — minutes x occurrences x reach, measured not guessed
 *   L4 diagnosis            — root cause named, not just the symptom treated
 */

export type PainQuestionLevel = 1 | 2 | 3 | 4;

export const PAIN_QUESTION_LEVEL_LABEL: Record<PainQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Roszczenie bólu', en: 'Pain claim' },
  2: { pl: 'Wymuszona kwalifikacja', en: 'Forced qualification' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Diagnoza', en: 'Diagnosis' },
};

export interface PainAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextPainQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface PainQuestionNode {
  id: string;
  level: PainQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: PainAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the pain
// ---------------------------------------------------------------------------

const PAIN_QUESTIONS: PainQuestionNode[] = [
  {
    id: 'pain-surface',
    level: 1,
    intentEn: 'Locate the pain the way the person living it would actually describe it.',
    intentPl: 'Zlokalizować ból tak, jak opisałaby go osoba, która go realnie odczuwa.',
    textEn:
      'State the pain exactly as the person experiencing it would say it. Did more than one independent person or source raise it, or is it one voice?',
    textPl:
      'Podaj ból dokładnie tak, jak powiedziałaby go osoba, która go odczuwa. Czy zgłosiła go więcej niż jedna niezależna osoba lub źródło, czy to jeden głos?',
    probeEn: 'If you asked someone on a different shift/team, would they recognize this pain?',
    probePl: 'Gdybyś zapytał kogoś z innej zmiany/zespołu, czy rozpoznałby ten ból?',
    answerOptions: [
      {
        key: 'corroborated',
        labelEn: 'Corroborated — 2+ independent sources raised it',
        labelPl: 'Potwierdzone — 2+ niezależne źródła to zgłosiły',
        consultantSignalEn: 'A system pain, not a preference — check whether the cost is measured.',
        consultantSignalPl: 'Ból systemowy, nie preferencja — sprawdź, czy koszt jest zmierzony.',
      },
      {
        key: 'single-voice',
        labelEn: 'Single voice — only one person raised it',
        labelPl: 'Jeden głos — zgłosiła to tylko jedna osoba',
        consultantSignalEn:
          'Could be a real system pain or a personal preference — force a second source before quantifying.',
        consultantSignalPl:
          'Może być realnym bólem systemu lub osobistą preferencją — wymuś drugie źródło przed kwantyfikacją.',
      },
    ],
    branches: {
      corroborated: 'pain-quant-check',
      'single-voice': 'pain-qualify-force',
    },
    defaultNextId: 'pain-quant-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED QUALIFICATION
  // -------------------------------------------------------------------------

  {
    id: 'pain-qualify-force',
    level: 2,
    intentEn: "Solving one person's preference wastes effort a real system pain needed.",
    intentPl:
      'Rozwiązywanie preferencji jednej osoby marnuje wysiłek, który potrzebował realny ból systemu.',
    textEn:
      'Find a second, independent source for this pain — a different person, a log, an observation. "Everyone probably feels this" does not count as a second source.',
    textPl:
      'Znajdź drugie, niezależne źródło tego bólu — inną osobę, log, obserwację. "Wszyscy pewnie to czują" nie liczy się jako drugie źródło.',
    probeEn:
      'If no second source exists, is this really worth solving before something corroborated?',
    probePl:
      'Jeśli nie ma drugiego źródła, czy to naprawdę warto rozwiązać przed czymś potwierdzonym?',
    answerOptions: [
      {
        key: 'second-source-found',
        labelEn: 'Found — a second independent source now confirms it',
        labelPl: 'Znaleziono — drugie niezależne źródło teraz to potwierdza',
        consultantSignalEn: 'Qualified as a system pain — proceed to quantification.',
        consultantSignalPl: 'Zakwalifikowany jako ból systemu — przejdź do kwantyfikacji.',
      },
      {
        key: 'still-single-voice',
        labelEn: 'Still just one voice',
        labelPl: 'Wciąż tylko jeden głos',
        consultantSignalEn:
          "Not qualified — loop back, the ladder cannot quantify a pain that may be one person's preference.",
        consultantSignalPl:
          'Niezakwalifikowany — wracamy, drabinka nie może kwantyfikować bólu, który może być preferencją jednej osoby.',
      },
    ],
    // Deliberately loops back to itself: the forced-qualification discipline
    // does not let the session quantify an uncorroborated single complaint.
    branches: {
      'second-source-found': 'pain-quant-check',
      'still-single-voice': 'pain-qualify-force',
    },
    defaultNextId: 'pain-qualify-force',
  },

  // -------------------------------------------------------------------------
  // L3 — QUANTIFICATION: minutes x occurrences x reach
  // -------------------------------------------------------------------------

  {
    id: 'pain-quant-check',
    level: 3,
    intentEn:
      'An unmeasured pain gets solved by whoever complains loudest, not whoever costs the most.',
    intentPl:
      'Niezmierzony ból rozwiązuje się dla tego, kto najgłośniej narzeka, nie dla tego, kto kosztuje najwięcej.',
    textEn:
      'What are the minutes lost per occurrence, how often does it happen per year, and how many people does it touch each time?',
    textPl:
      'Ile minut traci się na jedno wystąpienie, jak często się to zdarza rocznie i ile osób dotyka za każdym razem?',
    probeEn: 'If you cannot name a number for any of the three, who could measure it in a week?',
    probePl:
      'Jeśli nie potrafisz podać liczby dla żadnej z trzech, kto mógłby to zmierzyć w tydzień?',
    answerOptions: [
      {
        key: 'quantified',
        labelEn: 'Yes — minutes, frequency and reach are all named',
        labelPl: 'Tak — minuty, częstotliwość i zasięg są nazwane',
        consultantSignalEn: 'Annualized cost is real — proceed to diagnosis.',
        consultantSignalPl: 'Roczny koszt jest realny — przejdź do diagnozy.',
      },
      {
        key: 'estimated',
        labelEn: 'Only a rough estimate exists',
        labelPl: 'Istnieje tylko przybliżone oszacowanie',
        consultantSignalEn:
          'Keep the cost labeled as estimated, not measured, until a real count exists.',
        consultantSignalPl:
          'Trzymaj koszt oznaczony jako szacowany, nie zmierzony, dopóki nie ma realnego liczenia.',
      },
    ],
    branches: {
      quantified: 'pain-diagnose',
      estimated: 'pain-diagnose',
    },
    defaultNextId: 'pain-diagnose',
  },

  // -------------------------------------------------------------------------
  // L4 — DIAGNOSIS: root cause, not symptom
  // -------------------------------------------------------------------------

  {
    id: 'pain-diagnose',
    level: 4,
    intentEn:
      'A fix that treats the symptom while the root cause survives only postpones the pain.',
    intentPl:
      'Rozwiązanie, które leczy objaw, podczas gdy przyczyna źródłowa przetrwa, tylko odracza ból.',
    textEn:
      'Have you run a 5-whys (or equivalent) to name the removable root cause, or is the proposed fix aimed at the visible symptom?',
    textPl:
      'Czy przeprowadziliście 5×dlaczego (lub odpowiednik), by nazwać usuwalną przyczynę źródłową, czy proponowane rozwiązanie celuje w widoczny objaw?',
    probeEn:
      'If you fixed only what is visible today, would this pain resurface under a different name in six months?',
    probePl:
      'Gdybyście naprawili tylko to, co widać dziś, czy ten ból wróci pod inną nazwą za pół roku?',
    answerOptions: [
      {
        key: 'root-named',
        labelEn: 'Yes — a removable root cause is named',
        labelPl: 'Tak — nazwana jest usuwalna przyczyna źródłowa',
        consultantSignalEn: 'Diagnosis complete — the solution can target the actual cause.',
        consultantSignalPl: 'Diagnoza kompletna — rozwiązanie może celować w faktyczną przyczynę.',
      },
      {
        key: 'symptom-only',
        labelEn: 'No — only the visible symptom is described',
        labelPl: 'Nie — opisany jest tylko widoczny objaw',
        consultantSignalEn:
          'Gap named — the engine must flag this pain as diagnosed only to the symptom level.',
        consultantSignalPl:
          'Nazwana luka — silnik musi oznaczyć ten ból jako zdiagnozowany tylko do poziomu objawu.',
      },
    ],
    branches: {
      'root-named': null,
      'symptom-only': null,
    },
    defaultNextId: null,
  },
];

export const PAIN_QUESTION_BANK: PainQuestionNode[] = PAIN_QUESTIONS;

export function getPainQuestion(id: string): PainQuestionNode | undefined {
  return PAIN_QUESTION_BANK.find((q) => q.id === id);
}

export function getPainQuestionsByLevel(level: PainQuestionLevel): PainQuestionNode[] {
  return PAIN_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the pain-claim surface question. */
export const PAIN_QUESTION_ROOT_ID = 'pain-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextPainQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getPainQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopPainQuestion(id: string): boolean {
  const node = getPainQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildPainQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie bólu (potwierdzone czy jeden głos) -> L2 wymuszona kwalifikacja (jeden głos MUSI zdobyć drugie niezależne źródło, inaczej pytanie "pain-qualify-force" wraca do siebie) -> L3 kwantyfikacja (minuty × częstotliwość × zasięg) -> L4 diagnoza (nazwana przyczyna źródłowa, nie tylko objaw).`;
  }
  return `The question ladder has 4 levels: L1 pain claim (corroborated or single voice) -> L2 forced qualification (a single voice MUST earn a second independent source, otherwise question "pain-qualify-force" loops back on itself) -> L3 quantification (minutes x frequency x reach) -> L4 diagnosis (a named root cause, not just the symptom).`;
}
