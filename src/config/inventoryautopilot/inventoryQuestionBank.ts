/**
 * Inventory Autopilot — laddered, branching question bank (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionQuestionBank.ts /
 * src/config/swot/dynamicSwotQuestionBank.ts: every question node is pure
 * data, the answer to a question determines the next question (branching),
 * and the SAME bank drives both the wizard UI and the AI mentor prompt.
 *
 * Inventory Autopilot ladders by the discipline a SKU segment must survive
 * before a policy can safely act on it:
 *   L1 claim              — locate the segment as a planner would say it
 *   L2 forced classification — FORCE an ABC/XYZ classification (loops back on
 *                            itself until real segmentation exists — see
 *                            'inv-classify-force')
 *   L3 quantification     — stock value, turnover, service level, all measured
 *   L4 policy             — replenishment automation gated by trusted data
 */

export type InventoryQuestionLevel = 1 | 2 | 3 | 4;

export const INVENTORY_QUESTION_LEVEL_LABEL: Record<
  InventoryQuestionLevel,
  { pl: string; en: string }
> = {
  1: { pl: 'Roszczenie segmentu', en: 'Segment claim' },
  2: { pl: 'Wymuszona klasyfikacja', en: 'Forced classification' },
  3: { pl: 'Kwantyfikacja', en: 'Quantification' },
  4: { pl: 'Polityka', en: 'Policy' },
};

export interface InventoryAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextInventoryQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface InventoryQuestionNode {
  id: string;
  level: InventoryQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: InventoryAnswerOption[];
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// L1 — CLAIM: locate the segment
// ---------------------------------------------------------------------------

const INVENTORY_QUESTIONS: InventoryQuestionNode[] = [
  {
    id: 'inv-surface',
    level: 1,
    intentEn: 'Locate the SKU segment the way a planner would state it on the shelf.',
    intentPl: 'Zlokalizować segment SKU tak, jak podałby go planista przy regale.',
    textEn:
      'State the SKU group exactly as the planner would describe it. Does it already carry an ABC (value) and XYZ (variability) classification, or is it an unsegmented pile?',
    textPl:
      'Podaj grupę SKU dokładnie tak, jak opisałby ją planista. Czy niesie już klasyfikację ABC (wartość) i XYZ (zmienność), czy to niesklasyfikowana kupa?',
    probeEn:
      'If you set one buffer policy for this whole group, would it starve the best-sellers or overpay the tail?',
    probePl:
      'Gdybyś ustawił jedną politykę bufora dla całej tej grupy, czy zagłodziłaby bestsellery, czy przepłaciła ogon?',
    answerOptions: [
      {
        key: 'classified',
        labelEn: 'Classified — ABC and XYZ are both assigned',
        labelPl: 'Sklasyfikowane — ABC i XYZ są przypisane',
        consultantSignalEn:
          'Segmentation exists — check whether the underlying numbers are measured.',
        consultantSignalPl:
          'Segmentacja istnieje — sprawdź, czy liczby leżące u podstaw są zmierzone.',
      },
      {
        key: 'unclassified',
        labelEn: 'Unclassified — treated as one undifferentiated pile',
        labelPl: 'Niesklasyfikowane — traktowane jako jedna niezróżnicowana kupa',
        consultantSignalEn:
          'A policy on an unclassified pile optimizes an average, not the real distribution — force classification.',
        consultantSignalPl:
          'Polityka na niesklasyfikowanej kupie optymalizuje średnią, nie realny rozkład — wymuś klasyfikację.',
      },
    ],
    branches: {
      classified: 'inv-quant-check',
      unclassified: 'inv-classify-force',
    },
    defaultNextId: 'inv-quant-check',
  },

  // -------------------------------------------------------------------------
  // L2 — FORCED CLASSIFICATION
  // -------------------------------------------------------------------------

  {
    id: 'inv-classify-force',
    level: 2,
    intentEn:
      'A policy set on an unclassified assortment starves bestsellers and overpays the tail at once.',
    intentPl:
      'Polityka ustawiona na niesklasyfikowanym asortymencie jednocześnie głodzi bestsellery i przepłaca ogon.',
    textEn:
      'Split this pile into ABC (value contribution) and XYZ (demand variability) buckets. "Most of it is roughly the same" does not count as a classification.',
    textPl:
      'Podziel tę kupę na koszyki ABC (wkład wartości) i XYZ (zmienność popytu). "Większość jest mniej więcej taka sama" nie liczy się jako klasyfikacja.',
    probeEn:
      "If you pulled last quarter's turnover data, would the top 20% of SKUs really carry 80% of the value?",
    probePl:
      'Gdybyście pobrali dane o obrocie z ostatniego kwartału, czy top 20% SKU faktycznie niosłoby 80% wartości?',
    answerOptions: [
      {
        key: 'classified-now',
        labelEn: 'Done — ABC/XYZ buckets now exist',
        labelPl: 'Gotowe — koszyki ABC/XYZ teraz istnieją',
        consultantSignalEn: 'Classification satisfied — proceed to quantification.',
        consultantSignalPl: 'Klasyfikacja spełniona — przejdź do kwantyfikacji.',
      },
      {
        key: 'still-one-pile',
        labelEn: 'Still one undifferentiated pile',
        labelPl: 'Wciąż jedna niezróżnicowana kupa',
        consultantSignalEn:
          'Not satisfied — loop back, the ladder cannot quantify or policy-gate an unclassified assortment.',
        consultantSignalPl:
          'Niespełnione — wracamy, drabinka nie może kwantyfikować ani bramkować polityką niesklasyfikowanego asortymentu.',
      },
    ],
    // Deliberately loops back to itself: the forced-classification discipline
    // does not let the session quantify or policy-gate an undifferentiated pile.
    branches: {
      'classified-now': 'inv-quant-check',
      'still-one-pile': 'inv-classify-force',
    },
    defaultNextId: 'inv-classify-force',
  },

  // -------------------------------------------------------------------------
  // L3 — QUANTIFICATION: stock value, turnover, service level
  // -------------------------------------------------------------------------

  {
    id: 'inv-quant-check',
    level: 3,
    intentEn: 'A classification with no numbers behind it is a label, not a decision input.',
    intentPl: 'Klasyfikacja bez liczb za nią to etykieta, nie wsad do decyzji.',
    textEn:
      'What is the stock value tied up in this segment, its annual turnover, and its current service level against target?',
    textPl:
      'Jaka jest wartość zapasu w tym segmencie, jego roczny obrót i obecny poziom obsługi wobec celu?',
    probeEn:
      'If the service level is unmeasured, how would you know this segment is even a problem?',
    probePl:
      'Jeśli poziom obsługi jest niezmierzony, skąd wiadomo, że ten segment jest w ogóle problemem?',
    answerOptions: [
      {
        key: 'measured',
        labelEn: 'Yes — value, turnover and service level are all measured',
        labelPl: 'Tak — wartość, obrót i poziom obsługi są zmierzone',
        consultantSignalEn: 'Fully quantified — safe to gate a policy decision.',
        consultantSignalPl: 'W pełni skwantyfikowane — bezpiecznie bramkować decyzję polityki.',
      },
      {
        key: 'partial',
        labelEn: 'Only some of the three are measured',
        labelPl: 'Tylko część z trzech jest zmierzona',
        consultantSignalEn:
          'Half-quantified — keep the missing figures as an explicit open item before automating anything.',
        consultantSignalPl:
          'Częściowo skwantyfikowane — trzymaj brakujące liczby jako jawnie otwartą pozycję przed automatyzacją.',
      },
    ],
    branches: {
      measured: 'inv-policy',
      partial: 'inv-policy',
    },
    defaultNextId: 'inv-policy',
  },

  // -------------------------------------------------------------------------
  // L4 — POLICY: automation gated by trusted data
  // -------------------------------------------------------------------------

  {
    id: 'inv-policy',
    level: 4,
    intentEn: 'An autopilot fed dirty data replaces a planner with a worse, automated error.',
    intentPl:
      'Autopilot karmiony brudnymi danymi zastępuje planistę gorszym, automatycznym błędem.',
    textEn:
      'Is the underlying demand and lead-time data clean enough to hand this segment to the replenishment autopilot, or does it need a pilot on a stable class first?',
    textPl:
      'Czy dane popytu i czasu dostawy leżące u podstaw są wystarczająco czyste, by oddać ten segment autopilotowi uzupełniania, czy potrzebuje najpierw pilotażu na stabilnej klasie?',
    probeEn:
      'If the autopilot silently mis-set one parameter, how many cycles before anyone noticed?',
    probePl:
      'Gdyby autopilot cicho źle ustawił jeden parametr, ile cykli minęłoby, zanim ktoś by to zauważył?',
    answerOptions: [
      {
        key: 'data-trusted',
        labelEn: 'Yes — data is clean, hand it to the autopilot',
        labelPl: 'Tak — dane są czyste, oddaj autopilotowi',
        consultantSignalEn: 'Ready to automate — no pilot gate needed first.',
        consultantSignalPl: 'Gotowe do automatyzacji — nie trzeba bramki pilotażu najpierw.',
      },
      {
        key: 'pilot-first',
        labelEn: 'No — pilot on a stable class before extending',
        labelPl: 'Nie — pilotaż na stabilnej klasie przed rozszerzeniem',
        consultantSignalEn:
          'Data-trust gap named — the sequence must insert a pilot move before full automation.',
        consultantSignalPl:
          'Nazwana luka zaufania do danych — sekwencja musi wstawić ruch pilotażu przed pełną automatyzacją.',
      },
    ],
    branches: {
      'data-trusted': null,
      'pilot-first': null,
    },
    defaultNextId: null,
  },
];

export const INVENTORY_QUESTION_BANK: InventoryQuestionNode[] = INVENTORY_QUESTIONS;

export function getInventoryQuestion(id: string): InventoryQuestionNode | undefined {
  return INVENTORY_QUESTION_BANK.find((q) => q.id === id);
}

export function getInventoryQuestionsByLevel(
  level: InventoryQuestionLevel
): InventoryQuestionNode[] {
  return INVENTORY_QUESTION_BANK.filter((q) => q.level === level);
}

/** The first question of the ladder — always the segment-claim surface question. */
export const INVENTORY_QUESTION_ROOT_ID = 'inv-surface';

/**
 * Resolves the next question id from the current question + the answer key
 * the user (or AI) picked. Falls back to `defaultNextId` for unknown/omitted
 * answer keys, and returns `undefined` if `fromId` is not in the bank.
 */
export function getNextInventoryQuestionId(
  fromId: string,
  answerKey: string
): string | null | undefined {
  const node = getInventoryQuestion(fromId);
  if (!node) return undefined;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopInventoryQuestion(id: string): boolean {
  const node = getInventoryQuestion(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildInventoryQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań ma 4 poziomy: L1 roszczenie segmentu (sklasyfikowany czy niesklasyfikowany) -> L2 wymuszona klasyfikacja (niesklasyfikowana kupa MUSI zdobyć koszyki ABC/XYZ, inaczej pytanie "inv-classify-force" wraca do siebie) -> L3 kwantyfikacja (wartość zapasu + obrót + poziom obsługi) -> L4 polityka (automatyzacja bramkowana zaufaniem do danych).`;
  }
  return `The question ladder has 4 levels: L1 segment claim (classified or unclassified pile) -> L2 forced classification (an unclassified pile MUST earn ABC/XYZ buckets, otherwise question "inv-classify-force" loops back on itself) -> L3 quantification (stock value + turnover + service level) -> L4 policy (automation gated by data trust).`;
}
