/**
 * DMS Builder — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * DMS Builder ladders by the control-loop discipline a metric must survive
 * before it actually controls anything:
 *   L1 claim              — locate the KPI as a shift lead would say it
 *   L2 forced cadence      — FORCE a review frequency (loops back on itself
 *                           until a real rhythm is named — see 'dms-cadence-force')
 *   L3 escalation          — quantified trigger + named target level
 *   L4 response closure    — countermeasure + verified return to target
 */

export type DmsQuestionLevel = 1 | 2 | 3 | 4;

export const DMS_QUESTION_LEVEL_LABEL: Record<DmsQuestionLevel, { pl: string; en: string }> = {
  1: { pl: 'Roszczenie wskaźnika', en: 'KPI claim' },
  2: { pl: 'Wymuszony rytm', en: 'Forced cadence' },
  3: { pl: 'Eskalacja', en: 'Escalation' },
  4: { pl: 'Domknięcie reakcji', en: 'Response closure' },
};

export interface DmsAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextDmsQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface DmsQuestionNode {
  id: string;
  level: DmsQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: DmsAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the KPI
// ---------------------------------------------------------------------------

const DMS_QUESTIONS: DmsQuestionNode[] = [
  {
    id: 'dms-surface',
    level: 1,
    intentEn: 'Locate the KPI the way a shift lead would actually name it on the board.',
    intentPl: 'Zlokalizować wskaźnik tak, jak nazwałby go lider zmiany na tablicy.',
    textEn:
      'Name the KPI exactly as it should appear on the board. Is it one of the vital few the team acts on daily, or a vanity number nobody changes behavior for?',
    textPl:
      'Nazwij wskaźnik dokładnie tak, jak powinien pojawić się na tablicy. Czy to jeden z nielicznych właściwych, na które zespół codziennie reaguje, czy metryka na pokaz, przez którą nikt nie zmienia zachowania?',
    probeEn: 'If this KPI moved sharply tomorrow, who would change what they do?',
    probePl: 'Gdyby ten wskaźnik jutro gwałtownie się zmienił, kto zmieniłby swoje działanie?',
    answerOptions: [
      {
        key: 'vital-few',
        labelEn: 'Vital few — someone acts on it daily',
        labelPl: 'Nieliczny właściwy — ktoś codziennie na nim działa',
        consultantSignalEn: 'A real control KPI — check the review cadence next.',
        consultantSignalPl: 'Realny wskaźnik kontrolny — sprawdź teraz rytm przeglądu.',
      },
      {
        key: 'vanity-number',
        labelEn: 'Vanity — tracked but nobody changes behavior for it',
        labelPl: 'Na pokaz — śledzony, ale nikt przez niego nie zmienia zachowania',
        consultantSignalEn:
          'A vanity metric earns board space but not control — flag for removal or force a real cadence.',
        consultantSignalPl:
          'Metryka na pokaz zajmuje miejsce na tablicy, ale nie kontroluje — oznacz do usunięcia lub wymuś realny rytm.',
      },
    ],
    branches: {
      'vital-few': 'dms-cadence-check',
      'vanity-number': 'dms-cadence-force',
    },
    defaultNextId: 'dms-cadence-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED CADENCE
  // -------------------------------------------------------------------------

  {
    id: 'dms-cadence-check',
    level: 2,
    intentEn: 'A KPI nobody reviews on a fixed rhythm decays into a wallpaper number.',
    intentPl: 'Wskaźnik, którego nikt nie przegląda w stałym rytmie, degeneruje się do tapety.',
    textEn:
      'What is the review frequency for this KPI — a named cadence (daily huddle, weekly ops review), or "whenever someone remembers"?',
    textPl:
      'Jaka jest częstotliwość przeglądu tego wskaźnika — nazwany rytm (codzienny huddle, cotygodniowy przegląd operacyjny), czy "kiedy ktoś sobie przypomni"?',
    probeEn: 'If the cadence slipped for two weeks, would anyone notice?',
    probePl: 'Gdyby rytm zaniknął na dwa tygodnie, czy ktokolwiek by to zauważył?',
    answerOptions: [
      {
        key: 'named-cadence',
        labelEn: 'Yes — a named, fixed cadence exists',
        labelPl: 'Tak — istnieje nazwany, stały rytm',
        consultantSignalEn: 'Cadence exists — check whether escalation rules are quantified.',
        consultantSignalPl: 'Rytm istnieje — sprawdź, czy reguły eskalacji są skwantyfikowane.',
      },
      {
        key: 'no-cadence',
        labelEn: 'No — reviewed only "when someone remembers"',
        labelPl: 'Nie — przeglądany tylko "kiedy ktoś sobie przypomni"',
        consultantSignalEn: 'No cadence — route to the forced-cadence question.',
        consultantSignalPl: 'Brak rytmu — skieruj do wymuszonego pytania o rytm.',
      },
    ],
    branches: {
      'named-cadence': 'dms-escalation',
      'no-cadence': 'dms-cadence-force',
    },
    defaultNextId: 'dms-escalation',
  },
  {
    id: 'dms-cadence-force',
    level: 2,
    intentEn: 'A visible KPI with no review rhythm is decoration, not control.',
    intentPl: 'Widoczny wskaźnik bez rytmu przeglądu to dekoracja, nie kontrola.',
    textEn:
      'Name the fixed review rhythm this KPI will get — which meeting, what frequency, who owns showing up. "We will look at it" does not count.',
    textPl:
      'Nazwij stały rytm przeglądu, jaki dostanie ten wskaźnik — które spotkanie, jaka częstotliwość, kto odpowiada za pojawienie się. "Będziemy na niego patrzeć" się nie liczy.',
    probeEn: 'If no meeting can host it, what is the cheapest new 10-minute huddle that could?',
    probePl:
      'Jeśli żadne spotkanie nie może go pomieścić, jaki jest najtańszy nowy 10-minutowy huddle, który mógłby?',
    answerOptions: [
      {
        key: 'cadence-named',
        labelEn: 'Named — a fixed rhythm now exists',
        labelPl: 'Nazwano — stały rytm teraz istnieje',
        consultantSignalEn: 'Cadence satisfied — proceed to escalation quantification.',
        consultantSignalPl: 'Rytm spełniony — przejdź do kwantyfikacji eskalacji.',
      },
      {
        key: 'still-no-rhythm',
        labelEn: 'Still no fixed rhythm',
        labelPl: 'Wciąż brak stałego rytmu',
        consultantSignalEn:
          'Not satisfied — loop back, the ladder cannot escalate a KPI no one reviews on a beat.',
        consultantSignalPl:
          'Niespełnione — wracamy, drabinka nie może eskalować wskaźnika, którego nikt nie przegląda w rytmie.',
      },
    ],
    // Deliberately loops back to itself: the forced-cadence discipline does
    // not let the session escalate a KPI with no review rhythm.
    branches: {
      'cadence-named': 'dms-escalation',
      'still-no-rhythm': 'dms-cadence-force',
    },
    defaultNextId: 'dms-cadence-force',
  },

  // -------------------------------------------------------------------------
  // L3 — ESCALATION: quantified trigger + target level
  // -------------------------------------------------------------------------

  {
    id: 'dms-escalation',
    level: 3,
    intentEn: 'An off-target KPI with no escalation rule dies quietly on the board.',
    intentPl: 'Wskaźnik odchylony od celu bez reguły eskalacji cicho umiera na tablicy.',
    textEn:
      'What quantified trigger (threshold + time window) sends this KPI upward, and to which named level or role?',
    textPl:
      'Jaki skwantyfikowany wyzwalacz (próg + okno czasowe) wysyła ten wskaźnik w górę i do jakiego nazwanego poziomu lub roli?',
    probeEn:
      'If the trigger and target level are both missing, who decides when it is "bad enough"?',
    probePl:
      'Jeśli brakuje i wyzwalacza, i poziomu docelowego, kto decyduje, kiedy jest "wystarczająco źle"?',
    answerOptions: [
      {
        key: 'trigger-and-level',
        labelEn: 'Yes — both a quantified trigger and a target level are named',
        labelPl: 'Tak — nazwane są i wyzwalacz, i poziom docelowy',
        consultantSignalEn: 'Escalation is real — check whether the response closes the loop.',
        consultantSignalPl: 'Eskalacja jest realna — sprawdź, czy reakcja domyka pętlę.',
      },
      {
        key: 'discretionary',
        labelEn: 'No — escalation is discretionary ("raise it if it feels bad")',
        labelPl: 'Nie — eskalacja jest uznaniowa ("zgłoś, jeśli wygląda źle")',
        consultantSignalEn:
          'Discretionary escalation is not a rule — keep this as an explicit gap for the response engine.',
        consultantSignalPl:
          'Uznaniowa eskalacja to nie reguła — zostaw to jako jawną lukę dla silnika reakcji.',
      },
    ],
    branches: {
      'trigger-and-level': 'dms-response',
      discretionary: 'dms-response',
    },
    defaultNextId: 'dms-response',
  },

  // -------------------------------------------------------------------------
  // L4 — RESPONSE CLOSURE
  // -------------------------------------------------------------------------

  {
    id: 'dms-response',
    level: 4,
    intentEn:
      'An escalation that ends in a conversation, not a countermeasure, does not close the loop.',
    intentPl: 'Eskalacja, która kończy się rozmową, a nie akcją naprawczą, nie domyka pętli.',
    textEn:
      'Does the escalation end in an owned countermeasure, and is its effect verified by the KPI actually returning to target?',
    textPl:
      'Czy eskalacja kończy się akcją naprawczą z właścicielem i czy jej skutek jest zweryfikowany powrotem wskaźnika na cel?',
    probeEn:
      'The last three times this was escalated, did the KPI actually recover — and who checked?',
    probePl:
      'Podczas ostatnich trzech eskalacji, czy wskaźnik faktycznie wrócił na cel — i kto to sprawdził?',
    answerOptions: [
      {
        key: 'closed-and-verified',
        labelEn: 'Yes — owned countermeasure, verified effect',
        labelPl: 'Tak — akcja naprawcza z właścicielem, zweryfikowany skutek',
        consultantSignalEn: 'Loop closed — this layer is a control-loop asset, not a gap.',
        consultantSignalPl: 'Pętla domknięta — ta warstwa jest atutem pętli kontroli, nie luką.',
      },
      {
        key: 'closes-on-trust',
        labelEn: 'No — closed "on trust" with no verification',
        labelPl: 'Nie — domykana "na słowo" bez weryfikacji',
        consultantSignalEn:
          'Gap named — the same problem will recur; the engine must flag this as an unclosed loop.',
        consultantSignalPl:
          'Nazwana luka — ten sam problem wróci; silnik musi oznaczyć to jako niedomkniętą pętlę.',
      },
    ],
    branches: {
      'closed-and-verified': null,
      'closes-on-trust': null,
    },
    defaultNextId: null,
  },
];

export const DMS_QUESTION_BANK: DmsQuestionNode[] = DMS_QUESTIONS;

export function getDmsQuestion(id: string): DmsQuestionNode | undefined {
  return DMS_QUESTION_BANK.find((q) => q.id === id);
}

export function getDmsQuestionsByLevel(level: DmsQuestionLevel): DmsQuestionNode[] {
  return DMS_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the KPI-claim surface question. */
export const DMS_QUESTION_ROOT_ID = 'dms-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextDmsQuestionId(fromId: string, answerKey: string): string | null | undefined {
  const node = getDmsQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopDmsQuestion(id: string): boolean {
  const node = getDmsQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildDmsQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie wskaźnika (nieliczny właściwy czy metryka na pokaz) -> L2 wymuszony rytm (wskaźnik bez przeglądu MUSI dostać nazwany rytm, inaczej pytanie "dms-cadence-force" wraca do siebie) -> L3 eskalacja (skwantyfikowany wyzwalacz + poziom docelowy) -> L4 domknięcie reakcji (akcja naprawcza + zweryfikowany powrót na cel).`;
  }
  return `The question ladder has 4 levels: L1 KPI claim (vital-few or vanity metric) -> L2 forced cadence (a KPI with no review MUST get a named rhythm, otherwise question "dms-cadence-force" loops back on itself) -> L3 escalation (quantified trigger + target level) -> L4 response closure (countermeasure + verified return to target).`;
}
