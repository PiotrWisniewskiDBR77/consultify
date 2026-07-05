/**
 * Portfolio Priority — laddered question bank (OXFORD O3, tool #5).
 *
 * Pattern mirror of src/config/swot/dynamicSwotQuestionBank.ts. Where SWOT ladders
 * per quadrant, Portfolio Priority ladders per ELEMENT (initiative / project /
 * product) along the drabinka the doctrine demands:
 *
 *   L1 surface        — what is this element and what decision does it serve?
 *   L2 value proof    — WHERE do the value numbers come from? (force the source;
 *                       no invented revenue/cost/risk/strategic figures)
 *   L3 feasibility    — resources, capabilities and DEPENDENCIES between elements
 *                       (feasibility that ignores prerequisites is fiction)
 *   L4 urgency        — time window: does delay change the value, and by how much?
 *
 * The answer to each question branches to the next (the conversation digs instead
 * of collecting checkboxes). Every function is pure; the wizard and the AI mentor
 * consume the same bank, so a question asked in chat equals a question in the UI.
 */

export type PortfolioLadderTrack = 'element';

export type PortfolioQuestionLevel = 1 | 2 | 3 | 4;

export type PortfolioQuestionRung =
  | 'surface'
  | 'value-evidence'
  | 'feasibility-evidence'
  | 'urgency';

export interface PortfolioAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextPortfolioQuestion. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface PortfolioQuestionNode {
  id: string;
  rung: PortfolioQuestionRung;
  level: PortfolioQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: PortfolioAnswerOption[];
  /** answerKey -> next question id. `null` ends the ladder. Missing => defaultNextId. */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// The element ladder
// ---------------------------------------------------------------------------

const ELEMENT_QUESTIONS: PortfolioQuestionNode[] = [
  // --- L1 surface ----------------------------------------------------------
  {
    id: 'e1-surface',
    rung: 'surface',
    level: 1,
    intentEn: 'Pin down what the element IS and which decision it serves.',
    intentPl: 'Ustalić, czym element JEST i jakiej decyzji służy.',
    textEn:
      'In one line: what is this element (an initiative, a project, a product?) and what specific outcome is it meant to move?',
    textPl:
      'W jednej linii: czym jest ten element (inicjatywa, projekt, produkt?) i jaki konkretny wynik ma poruszyć?',
    probeEn: 'If it moves no measurable outcome, it does not belong in a priority portfolio.',
    probePl: 'Jeśli nie porusza żadnego mierzalnego wyniku, nie należy do portfela priorytetów.',
    answerOptions: [
      {
        key: 'outcome-clear',
        labelEn: 'Clear outcome (a named metric it should move)',
        labelPl: 'Jasny wynik (nazwana metryka, którą ma poruszyć)',
        consultantSignalEn: 'Anchored — go test where the value number comes from.',
        consultantSignalPl: 'Zakotwiczone — testuj skąd bierze się liczba wartości.',
      },
      {
        key: 'outcome-vague',
        labelEn: 'Fuzzy — "it would help us generally"',
        labelPl: 'Rozmyte — „ogólnie by nam pomogło"',
        consultantSignalEn: 'Force a target metric before scoring value.',
        consultantSignalPl: 'Wymuś metrykę celu przed ocenianiem wartości.',
      },
    ],
    branches: { 'outcome-clear': 'e2-value-source', 'outcome-vague': 'e2-value-source' },
    defaultNextId: 'e2-value-source',
  },
  // --- L2 value evidence (SOURCE ENFORCEMENT) ------------------------------
  {
    id: 'e2-value-source',
    rung: 'value-evidence',
    level: 2,
    intentEn: 'A value score with no source is a guess dressed as a number.',
    intentPl: 'Ocena wartości bez źródła to zgadywanka przebrana za liczbę.',
    textEn:
      'The value of this element — revenue, cost saved, risk reduced, or strategic fit — rests on which number, and WHERE does that number come from?',
    textPl:
      'Wartość tego elementu — przychód, oszczędność, ograniczone ryzyko czy dopasowanie strategiczne — opiera się na jakiej liczbie i SKĄD ta liczba pochodzi?',
    probeEn: 'Name the signal, the benchmark, or say plainly "assumption" — never invent it.',
    probePl: 'Wskaż sygnał, benchmark albo powiedz wprost „założenie" — nigdy nie zmyślaj.',
    answerOptions: [
      {
        key: 'sourced',
        labelEn: 'Backed by a signal / benchmark we can point to',
        labelPl: 'Poparte sygnałem / benchmarkiem, który umiemy wskazać',
        consultantSignalEn: 'Confirmed value — attach sourceRefs; move to feasibility.',
        consultantSignalPl: 'Wartość potwierdzona — podepnij sourceRefs; przejdź do wykonalności.',
      },
      {
        key: 'assumed',
        labelEn: 'It is our assumption for now',
        labelPl: 'Na razie to nasze założenie',
        consultantSignalEn: 'Keep as declared assumption; do not let strategy lean on it as fact.',
        consultantSignalPl: 'Zostaw jako jawne założenie; strategia nie może się na tym oprzeć jak na fakcie.',
      },
    ],
    branches: { sourced: 'e3-feasibility', assumed: 'e3-feasibility' },
    defaultNextId: 'e3-feasibility',
  },
  // --- L3 feasibility evidence (RESOURCES + DEPENDENCIES) ------------------
  {
    id: 'e3-feasibility',
    rung: 'feasibility-evidence',
    level: 3,
    intentEn: 'Feasibility that ignores prerequisites and capacity is fiction.',
    intentPl: 'Wykonalność, która ignoruje warunki wstępne i moce, to fikcja.',
    textEn:
      'To deliver this: do you already have the capacity and skills, and does it depend on ANOTHER element in this portfolio being done first?',
    textPl:
      'Aby to dostarczyć: czy masz już moce i kompetencje, i czy zależy to od INNEGO elementu tego portfela zrobionego wcześniej?',
    probeEn: 'Every hard dependency must be declared — it decides the order (A before B).',
    probePl: 'Każdą twardą zależność trzeba zadeklarować — decyduje o kolejności (A przed B).',
    answerOptions: [
      {
        key: 'ready-standalone',
        labelEn: 'We can deliver it now, it depends on nothing else',
        labelPl: 'Możemy to zrobić teraz, nie zależy od niczego',
        consultantSignalEn: 'High feasibility, no dependency — sequencing is free.',
        consultantSignalPl: 'Wysoka wykonalność, brak zależności — sekwencja swobodna.',
      },
      {
        key: 'needs-prereq',
        labelEn: 'It needs another element done first',
        labelPl: 'Wymaga wcześniejszego zrobienia innego elementu',
        consultantSignalEn: 'Declare the hard dependency; sequencing must order it after the prerequisite.',
        consultantSignalPl: 'Zadeklaruj twardą zależność; sekwencja musi ją ustawić po warunku wstępnym.',
      },
      {
        key: 'capability-gap',
        labelEn: 'We lack capacity/skills for it right now',
        labelPl: 'Brakuje nam mocy/kompetencji na to teraz',
        consultantSignalEn: 'Lower feasibility; either build capability first or move to big-bet.',
        consultantSignalPl: 'Niższa wykonalność; najpierw buduj zdolność albo przesuń do big-bet.',
      },
    ],
    branches: {
      'ready-standalone': 'e4-urgency',
      'needs-prereq': 'e4-urgency',
      'capability-gap': 'e4-urgency',
    },
    defaultNextId: 'e4-urgency',
  },
  // --- L4 urgency / time window --------------------------------------------
  {
    id: 'e4-urgency',
    rung: 'urgency',
    level: 4,
    intentEn: 'Urgency reorders a portfolio — a closing window beats a bigger-but-patient prize.',
    intentPl: 'Pilność przestawia portfel — zamykające się okno bije większą, lecz cierpliwą nagrodę.',
    textEn:
      'Does the value decay if you wait — a closing market window, a regulatory date, a competitor move — or is the prize stable in time?',
    textPl:
      'Czy wartość maleje, gdy czekasz — zamykające się okno rynkowe, data regulacyjna, ruch konkurenta — czy nagroda jest stabilna w czasie?',
    probeEn: 'If value decays, say by how much per quarter — urgency must be a number too.',
    probePl: 'Jeśli wartość maleje, powiedz o ile na kwartał — pilność też musi być liczbą.',
    answerOptions: [
      {
        key: 'window-closing',
        labelEn: 'Value decays with delay (a window is closing)',
        labelPl: 'Wartość maleje z opóźnieniem (okno się zamyka)',
        consultantSignalEn: 'Raise sequencing priority; delay carries a named cost.',
        consultantSignalPl: 'Podnieś priorytet sekwencji; opóźnienie ma nazwany koszt.',
      },
      {
        key: 'stable',
        labelEn: 'The prize is stable — timing is our choice',
        labelPl: 'Nagroda jest stabilna — moment to nasz wybór',
        consultantSignalEn: 'Order it on value x feasibility alone; no urgency premium.',
        consultantSignalPl: 'Ułóż wyłącznie na wartość × wykonalność; bez premii za pilność.',
      },
    ],
    branches: { 'window-closing': null, stable: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// Bank assembly + pure accessors
// ---------------------------------------------------------------------------

export const PORTFOLIO_QUESTION_BANK: Record<PortfolioLadderTrack, PortfolioQuestionNode[]> = {
  element: ELEMENT_QUESTIONS,
};

const ALL_QUESTIONS: PortfolioQuestionNode[] = [...ELEMENT_QUESTIONS];
const QUESTION_INDEX = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getPortfolioQuestionById(id: string): PortfolioQuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

export function getPortfolioEntryQuestion(
  track: PortfolioLadderTrack = 'element'
): PortfolioQuestionNode {
  return PORTFOLIO_QUESTION_BANK[track][0];
}

/**
 * Branching resolver: the answer to a question determines the next question.
 * Unknown answer keys fall back to defaultNextId (never dead-end silently).
 */
export function getNextPortfolioQuestion(
  currentQuestionId: string,
  answerKey: string
): PortfolioQuestionNode | null {
  const current = QUESTION_INDEX.get(currentQuestionId);
  if (!current) return null;
  const nextId =
    answerKey in current.branches ? current.branches[answerKey] : current.defaultNextId;
  if (!nextId) return null;
  return QUESTION_INDEX.get(nextId) || null;
}

export interface PortfolioLadderAnswer {
  questionId: string;
  answerKey: string;
  note?: string;
}

/**
 * Read structured hints out of the ladder answers — consumed by the runtime to
 * pre-seed evidence status, dependency prompts and urgency, deterministically.
 */
export interface PortfolioLadderHints {
  valueEvidence: 'sourced' | 'assumed' | 'unknown';
  hasDependency: boolean;
  capabilityGap: boolean;
  urgent: boolean;
}

export function readPortfolioLadderHints(
  answers: PortfolioLadderAnswer[]
): PortfolioLadderHints {
  const byQ = new Map(answers.map((a) => [a.questionId, a.answerKey]));
  const value = byQ.get('e2-value-source');
  const feas = byQ.get('e3-feasibility');
  return {
    valueEvidence: value === 'sourced' ? 'sourced' : value === 'assumed' ? 'assumed' : 'unknown',
    hasDependency: feas === 'needs-prereq',
    capabilityGap: feas === 'capability-gap',
    urgent: byQ.get('e4-urgency') === 'window-closing',
  };
}

/**
 * Structural self-check used by unit tests (and defensively in dev): every branch
 * target exists, levels start at 1 and never skip, each path terminates (no cycle),
 * and every option has a branch and PL+EN text.
 */
export function validatePortfolioQuestionBank(): string[] {
  const problems: string[] = [];
  (Object.keys(PORTFOLIO_QUESTION_BANK) as PortfolioLadderTrack[]).forEach((track) => {
    const questions = PORTFOLIO_QUESTION_BANK[track];
    const levels = new Set(questions.map((q) => q.level));
    if (!levels.has(1)) problems.push(`${track}: missing level-1 entry question`);
    if (levels.size < 3) problems.push(`${track}: fewer than 3 question levels`);
    // levels must not skip
    const sorted = [...levels].sort((a, b) => a - b);
    sorted.forEach((lvl, i) => {
      if (i > 0 && lvl - sorted[i - 1] > 1) problems.push(`${track}: level ${lvl} skips a level`);
    });
    questions.forEach((q) => {
      if (q.answerOptions.length < 2) problems.push(`${q.id}: fewer than 2 answer options`);
      if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
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
    });
    const entry = questions.find((q) => q.level === 1);
    if (entry) {
      const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
      while (stack.length) {
        const { id, seen } = stack.pop()!;
        if (seen.has(id)) {
          problems.push(`${track}: cycle detected at ${id}`);
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
 * Serialize the ladder into a prompt block, so the AI mentor asks EXACTLY these
 * questions in conversation (single source of truth with the UI).
 */
export function buildPortfolioLadderPromptBlock(language: 'pl' | 'en'): string {
  return ELEMENT_QUESTIONS.map((q) => {
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
    return `[${q.id}] (L${q.level} ${q.rung}) intent: ${intent}\n  Q: ${text}\n${options}`;
  }).join('\n');
}
