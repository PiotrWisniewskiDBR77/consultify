/**
 * Capability Mapper — laddered question bank (OXFORD O3, tool: Capability Mapper).
 *
 * Pattern mirror of src/config/portfolio/portfolioQuestionBank.ts. Where Portfolio
 * Priority ladders per ELEMENT, Capability Mapper ladders per CAPABILITY along the
 * drabinka the doctrine demands:
 *
 *   L1 identification    — what capability is this, and what strategic goal does
 *                          it serve? (no capability without a reason to exist)
 *   L2 maturity evidence — WHERE does the current-maturity score come from? (force
 *                          the source; no invented maturity numbers)
 *   L3 importance & gap  — how strategically important is it, and what is the gap
 *                          (what we HAVE vs what we NEED) — with evidence for the
 *                          importance claim, not a gut feeling
 *   L4 move              — build / buy / partner / sustain, with a mandatory
 *                          trade-off (what does this sourcing choice cost you)
 *
 * The answer to each question branches to the next (the conversation digs instead
 * of collecting checkboxes). Every function is pure; the wizard and the AI mentor
 * consume the same bank, so a question asked in chat equals a question in the UI.
 */

export type CapabilityLadderTrack = 'capability';

export type CapabilityQuestionLevel = 1 | 2 | 3 | 4;

export type CapabilityQuestionRung =
  | 'identification'
  | 'maturity-evidence'
  | 'importance-gap'
  | 'move';

export interface CapabilityAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextCapabilityQuestion. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface CapabilityQuestionNode {
  id: string;
  rung: CapabilityQuestionRung;
  level: CapabilityQuestionLevel;
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  probeEn?: string;
  probePl?: string;
  answerOptions: CapabilityAnswerOption[];
  /** answerKey -> next question id. `null` ends the ladder. Missing => defaultNextId. */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// The capability ladder
// ---------------------------------------------------------------------------

const CAPABILITY_QUESTIONS: CapabilityQuestionNode[] = [
  // --- L1 identification -----------------------------------------------------
  {
    id: 'c1-identification',
    rung: 'identification',
    level: 1,
    intentEn: 'Pin down what the capability IS and which strategic goal it serves.',
    intentPl: 'Ustalić, czym zdolność JEST i jakiemu celowi strategicznemu służy.',
    textEn:
      'In one line: what is this capability (a process, a skill set, a technology, a data asset?) and which strategic goal does it enable?',
    textPl:
      'W jednej linii: czym jest ta zdolność (proces, zestaw umiejętności, technologia, zasób danych?) i jaki cel strategiczny umożliwia?',
    probeEn: 'If it enables no named goal, it does not belong in the capability map.',
    probePl: 'Jeśli nie umożliwia żadnego nazwanego celu, nie należy do mapy zdolności.',
    answerOptions: [
      {
        key: 'goal-clear',
        labelEn: 'Clear link (a named goal this capability moves)',
        labelPl: 'Jasny związek (nazwany cel, który ta zdolność porusza)',
        consultantSignalEn: 'Anchored — go test where the maturity score comes from.',
        consultantSignalPl: 'Zakotwiczone — testuj skąd bierze się ocena dojrzałości.',
      },
      {
        key: 'goal-vague',
        labelEn: 'Fuzzy — "it would generally help"',
        labelPl: 'Rozmyte — „ogólnie by pomogło"',
        consultantSignalEn: 'Force a named goal before scoring maturity or importance.',
        consultantSignalPl: 'Wymuś nazwany cel przed ocenianiem dojrzałości czy znaczenia.',
      },
    ],
    branches: { 'goal-clear': 'c2-maturity-source', 'goal-vague': 'c2-maturity-source' },
    defaultNextId: 'c2-maturity-source',
  },
  // --- L2 maturity evidence (SOURCE ENFORCEMENT) -----------------------------
  {
    id: 'c2-maturity-source',
    rung: 'maturity-evidence',
    level: 2,
    intentEn: 'A maturity score with no source is a guess dressed as a number.',
    intentPl: 'Ocena dojrzałości bez źródła to zgadywanka przebrana za liczbę.',
    textEn:
      'The current maturity (1-5) rests on which evidence — a capability audit, a delivery track record, a peer benchmark — and WHERE does it come from?',
    textPl:
      'Bieżąca dojrzałość (1-5) opiera się na jakim dowodzie — audyt zdolności, historia realizacji, benchmark rynkowy — i SKĄD on pochodzi?',
    probeEn: 'Name the signal or say plainly "assumption" — never invent the maturity level.',
    probePl:
      'Wskaż sygnał albo powiedz wprost „założenie" — nigdy nie zmyślaj poziomu dojrzałości.',
    answerOptions: [
      {
        key: 'sourced',
        labelEn: 'Backed by an audit / track record / benchmark we can point to',
        labelPl: 'Poparte audytem / historią realizacji / benchmarkiem, który umiemy wskazać',
        consultantSignalEn: 'Confirmed maturity — attach sourceRefs; move to importance & gap.',
        consultantSignalPl:
          'Dojrzałość potwierdzona — podepnij sourceRefs; przejdź do znaczenia i luki.',
      },
      {
        key: 'assumed',
        labelEn: 'It is our gut read for now',
        labelPl: 'Na razie to nasz odczyt „na oko"',
        consultantSignalEn: 'Keep as declared assumption; do not let sourcing lean on it as fact.',
        consultantSignalPl:
          'Zostaw jako jawne założenie; wybór sourcingu nie może się na tym oprzeć jak na fakcie.',
      },
    ],
    branches: { sourced: 'c3-importance-gap', assumed: 'c3-importance-gap' },
    defaultNextId: 'c3-importance-gap',
  },
  // --- L3 importance & gap (EVIDENCE + HAVE vs NEED) -------------------------
  {
    id: 'c3-importance-gap',
    rung: 'importance-gap',
    level: 3,
    intentEn: 'Strategic importance without evidence collapses into "everything is core".',
    intentPl: 'Znaczenie strategiczne bez dowodu zamienia się w „wszystko jest rdzenne".',
    textEn:
      'How strategically important is this capability (differentiates you / merely necessary / commodity), and what is the gap — what you HAVE today vs what the strategy NEEDS?',
    textPl:
      'Jak strategicznie ważna jest ta zdolność (różnicuje was / tylko konieczna / towar rynkowy) i jaka jest luka — co MACIE dziś vs czego strategia POTRZEBUJE?',
    probeEn:
      'A "high importance" claim needs a reason (competes on it, customers choose you for it) — not just a feeling.',
    probePl:
      'Twierdzenie „wysokie znaczenie" potrzebuje powodu (konkurujecie tym, klienci wybierają was za to) — nie tylko przeczucia.',
    answerOptions: [
      {
        key: 'core-with-gap',
        labelEn: 'Core to our edge AND there is a real gap (need > have)',
        labelPl: 'Rdzeń naszej przewagi ORAZ jest realna luka (potrzeba > mamy)',
        consultantSignalEn: 'Highest priority quadrant — must own, must close the gap.',
        consultantSignalPl:
          'Kwadrant najwyższego priorytetu — trzeba mieć na własność, trzeba zamknąć lukę.',
      },
      {
        key: 'core-no-gap',
        labelEn: 'Core to our edge, already at target',
        labelPl: 'Rdzeń naszej przewagi, już na poziomie docelowym',
        consultantSignalEn: 'Sustain — protect it, do not over-invest further.',
        consultantSignalPl: 'Utrzymanie — chrońcie ją, nie inwestujcie dalej ponad potrzebę.',
      },
      {
        key: 'commodity',
        labelEn: 'Necessary but not differentiating — everyone has it',
        labelPl: 'Konieczna, ale nie różnicująca — każdy to ma',
        consultantSignalEn: 'Commodity — buy or partner, never over-build here.',
        consultantSignalPl:
          'Towar rynkowy — kupujcie lub partnerujcie, nigdy nie przeinwestowujcie budową.',
      },
    ],
    branches: {
      'core-with-gap': 'c4-move',
      'core-no-gap': 'c4-move',
      commodity: 'c4-move',
    },
    defaultNextId: 'c4-move',
  },
  // --- L4 move (build/buy/partner/sustain with trade-off) --------------------
  {
    id: 'c4-move',
    rung: 'move',
    level: 4,
    intentEn: 'A sourcing move without a trade-off is a wishlist, not a decision.',
    intentPl: 'Ruch sourcingowy bez trade-offu to lista życzeń, nie decyzja.',
    textEn:
      'Given the gap and the core-vs-commodity read: do you build it in-house, buy it, partner for it, or sustain the current level — and what does that choice cost you?',
    textPl:
      'Biorąc pod uwagę lukę i ocenę rdzeń-vs-towar: budujecie wewnętrznie, kupujecie, partnerujecie, czy utrzymujecie obecny poziom — i kosztem czego jest ten wybór?',
    probeEn: 'Every move must name what it deliberately does NOT do (the rejected variant).',
    probePl: 'Każdy ruch musi nazwać, czego świadomie NIE robi (odrzucony wariant).',
    answerOptions: [
      {
        key: 'build',
        labelEn: 'Build — own it, pay in time and capital',
        labelPl: 'Buduj — miejcie na własność, płacicie czasem i kapitałem',
        consultantSignalEn:
          'Reject buying off-the-shelf: for a differentiating capability that hands the edge away.',
        consultantSignalPl: 'Odrzucacie zakup gotowca: dla zdolności różnicującej oddaje przewagę.',
      },
      {
        key: 'buy-or-partner',
        labelEn: 'Buy or partner — trade ownership for speed',
        labelPl: 'Kupuj lub partneruj — wymieniacie własność na tempo',
        consultantSignalEn:
          'Reject building from zero: for a non-differentiating capability it burns time for no edge.',
        consultantSignalPl:
          'Odrzucacie budowę od zera: dla zdolności nie-różnicującej przepala czas bez zysku przewagi.',
      },
      {
        key: 'sustain',
        labelEn: 'Sustain — hold the level, free capital elsewhere',
        labelPl: 'Utrzymaj — trzymajcie poziom, uwolnijcie kapitał gdzie indziej',
        consultantSignalEn:
          'Reject further investment: capital is needed for capabilities with a real gap.',
        consultantSignalPl:
          'Odrzucacie dalszą inwestycję: kapitał jest potrzebny dla zdolności z realną luką.',
      },
    ],
    branches: { build: null, 'buy-or-partner': null, sustain: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// Bank assembly + pure accessors
// ---------------------------------------------------------------------------

export const CAPABILITY_QUESTION_BANK: Record<CapabilityLadderTrack, CapabilityQuestionNode[]> = {
  capability: CAPABILITY_QUESTIONS,
};

const ALL_QUESTIONS: CapabilityQuestionNode[] = [...CAPABILITY_QUESTIONS];
const QUESTION_INDEX = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getCapabilityQuestionById(id: string): CapabilityQuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

export function getCapabilityEntryQuestion(
  track: CapabilityLadderTrack = 'capability'
): CapabilityQuestionNode {
  return CAPABILITY_QUESTION_BANK[track][0];
}

/**
 * Branching resolver: the answer to a question determines the next question.
 * Unknown answer keys fall back to defaultNextId (never dead-end silently).
 */
export function getNextCapabilityQuestion(
  currentQuestionId: string,
  answerKey: string
): CapabilityQuestionNode | null {
  const current = QUESTION_INDEX.get(currentQuestionId);
  if (!current) return null;
  const nextId =
    answerKey in current.branches ? current.branches[answerKey] : current.defaultNextId;
  if (!nextId) return null;
  return QUESTION_INDEX.get(nextId) || null;
}

export interface CapabilityLadderAnswer {
  questionId: string;
  answerKey: string;
  note?: string;
}

/**
 * Read structured hints out of the ladder answers — consumed by the runtime to
 * pre-seed evidence status, quadrant read and sourcing lean, deterministically.
 */
export interface CapabilityLadderHints {
  maturityEvidence: 'sourced' | 'assumed' | 'unknown';
  strategicRead: 'core-with-gap' | 'core-no-gap' | 'commodity' | 'unknown';
  moveLean: 'build' | 'buy-or-partner' | 'sustain' | 'unknown';
}

export function readCapabilityLadderHints(
  answers: CapabilityLadderAnswer[]
): CapabilityLadderHints {
  const byQ = new Map(answers.map((a) => [a.questionId, a.answerKey]));
  const maturity = byQ.get('c2-maturity-source');
  const strategic = byQ.get('c3-importance-gap');
  const move = byQ.get('c4-move');
  return {
    maturityEvidence:
      maturity === 'sourced' ? 'sourced' : maturity === 'assumed' ? 'assumed' : 'unknown',
    strategicRead:
      strategic === 'core-with-gap' || strategic === 'core-no-gap' || strategic === 'commodity'
        ? strategic
        : 'unknown',
    moveLean:
      move === 'build' || move === 'buy-or-partner' || move === 'sustain' ? move : 'unknown',
  };
}

/**
 * Structural self-check used by unit tests (and defensively in dev): every branch
 * target exists, levels start at 1 and never skip, each path terminates (no cycle),
 * and every option has a branch and PL+EN text.
 */
export function validateCapabilityQuestionBank(): string[] {
  const problems: string[] = [];
  (Object.keys(CAPABILITY_QUESTION_BANK) as CapabilityLadderTrack[]).forEach((track) => {
    const questions = CAPABILITY_QUESTION_BANK[track];
    const levels = new Set(questions.map((q) => q.level));
    if (!levels.has(1)) problems.push(`${track}: missing level-1 entry question`);
    if (levels.size < 3) problems.push(`${track}: fewer than 3 question levels`);
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
export function buildCapabilityLadderPromptBlock(language: 'pl' | 'en'): string {
  return CAPABILITY_QUESTIONS.map((q) => {
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
