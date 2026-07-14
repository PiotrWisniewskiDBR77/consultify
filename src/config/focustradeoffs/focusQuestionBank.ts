/**
 * Focus & Trade-offs — laddered question bank (OXFORD O3).
 *
 * Cloned in architecture from src/config/porter/porterQuestionBank.ts. Where
 * Porter walks 5 FIXED named forces through a 4-level ladder, Focus & Trade-offs
 * walks EVERY competing option/direction the client names through the SAME
 * 4-level ladder — because the essence of this tool (Porter: "strategy is
 * choosing what NOT to do") is not scoring options in isolation, it is forcing
 * every "yes" to name its "no".
 *
 * Levels:
 *   L1 surface                 — name the option and who is actually asking for it
 *   L2 evidence                — the proof it deserves scarce attention (not enthusiasm)
 *   L3 forced-tradeoff          — MANDATORY: if this option wins, name the OTHER named
 *                                 option it beats — enforced at CAPTURE time via
 *                                 validateForcedTradeoffAnswer(), stronger than the
 *                                 standard W2 gate (which only checks non-empty text)
 *   L4 rejection-justification  — why THAT alternative, and not another, is the one
 *                                 that loses — closes the loop with an explicit reason
 *
 * Every function here is pure and consumed both by the runtime AI prompt
 * (buildFocusLadderPromptBlock) and by tests — single source of truth between
 * what the mentor asks in chat and what the wizard would render.
 */

export type FocusQuestionLevel = 1 | 2 | 3 | 4;

export interface FocusAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextFocusQuestion. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (used to steer the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
  /**
   * How this answer pushes the case for scarce attention. +1 = strengthens
   * the case FOR pursuing (deserves focus), -1 = weakens it, 0 = neutral.
   * Read by the synthesis layer as a coarse signal, never as the sole score.
   */
  focusDelta: -1 | 0 | 1;
}

export interface FocusQuestionNode {
  id: string;
  level: FocusQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally as a UI tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: FocusAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for
   * this path. Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// The single generic ladder, walked once PER competing option/direction.
// ---------------------------------------------------------------------------

export const FOCUS_OPTION_LADDER: FocusQuestionNode[] = [
  {
    id: 'opt1-surface',
    level: 1,
    intentEn:
      'Name the option in one sentence and its real sponsor — a priority nobody can name plainly is not a priority, it is an ambient hope.',
    intentPl:
      'Nazwać opcję jednym zdaniem i jej realnego sponsora — priorytet, którego nikt nie umie nazwać wprost, nie jest priorytetem, jest mgławicą nadziei.',
    textEn:
      'What exactly is this option/direction, and who is actually asking for it — the board, a customer commitment, or is it your own conviction?',
    textPl:
      'Co dokładnie to za opcja/kierunek i kto realnie o nią prosi — zarząd, zobowiązanie wobec klienta, czy to Wasze własne przekonanie?',
    probeEn:
      'If you cannot name a sponsor, it is a candidate for the list, not yet a candidate for scarce capacity.',
    probePl:
      'Jeśli nie umiecie nazwać sponsora, to kandydat na listę, ale jeszcze nie kandydat do ograniczonej mocy.',
    answerOptions: [
      {
        key: 'external-mandate',
        labelEn: 'External mandate — board, customer, or regulator asked for it',
        labelPl: 'Mandat zewnętrzny — poprosił zarząd, klient lub regulator',
        consultantSignalEn:
          'External mandate raises the floor of legitimacy — probe the evidence next.',
        consultantSignalPl: 'Mandat zewnętrzny podnosi próg legitymacji — dalej badaj dowód.',
        focusDelta: 1,
      },
      {
        key: 'internal-conviction',
        labelEn: "Internal conviction — it is the owner's hypothesis",
        labelPl: 'Wewnętrzne przekonanie — to hipoteza właściciela',
        consultantSignalEn:
          "An owner's hypothesis is a legitimate start, but it needs a harder evidence bar before it earns scarce capacity.",
        consultantSignalPl:
          'Hipoteza właściciela to legalny start, ale wymaga twardszej poprzeczki dowodowej, zanim dostanie ograniczoną moc.',
        focusDelta: 0,
      },
    ],
    branches: {
      'external-mandate': 'opt2-evidence',
      'internal-conviction': 'opt2-evidence',
    },
    defaultNextId: 'opt2-evidence',
  },
  {
    id: 'opt2-evidence',
    level: 2,
    intentEn:
      'Evidence is the hard side of the scale — without it, "pursue" is a preference dressed as a decision.',
    intentPl:
      'Dowód to twarda strona wagi — bez niego „pursue" to preferencja przebrana za decyzję.',
    textEn:
      'What proof do you have that this option deserves scarce attention right now: demand data, a signed commitment, a measured cost of NOT doing it?',
    textPl:
      'Jaki macie dowód, że ta opcja zasługuje na ograniczoną uwagę właśnie teraz: dane popytu, podpisane zobowiązanie, zmierzony koszt NIErobienia tego?',
    probeEn:
      'Enthusiasm is not evidence. If the only proof is "everyone agrees it matters", treat it as declared, not confirmed.',
    probePl:
      'Entuzjazm to nie dowód. Jeśli jedynym dowodem jest „wszyscy się zgadzają, że to ważne", traktujcie to jako deklarację, nie potwierdzenie.',
    answerOptions: [
      {
        key: 'hard-evidence',
        labelEn: 'Hard evidence — data, signed commitment, or measured cost of inaction',
        labelPl: 'Twardy dowód — dane, podpisane zobowiązanie lub zmierzony koszt zaniechania',
        consultantSignalEn: 'Evidence-backed — this option can defend a forced trade-off.',
        consultantSignalPl: 'Poparte dowodem — ta opcja jest w stanie obronić wymuszony trade-off.',
        focusDelta: 1,
      },
      {
        key: 'no-evidence',
        labelEn: 'No hard evidence yet — mostly conviction and anecdote',
        labelPl: 'Brak twardego dowodu — głównie przekonanie i anegdota',
        consultantSignalEn:
          'No evidence — the option can still enter the ladder, but any "pursue" must carry an experiment/validate-first move, not a full commitment.',
        consultantSignalPl:
          'Brak dowodu — opcja może wejść na drabinę, ale każdy „pursue" musi nieść ruch experiment/waliduj-najpierw, nie pełne zaangażowanie.',
        focusDelta: -1,
      },
    ],
    branches: {
      'hard-evidence': 'opt3-forced-tradeoff',
      'no-evidence': 'opt3-forced-tradeoff',
    },
    defaultNextId: 'opt3-forced-tradeoff',
  },
  {
    id: 'opt3-forced-tradeoff',
    level: 3,
    intentEn:
      'The forced trade-off is the spine of this tool: a "yes" that names no "no" is not a focus decision, it is a wishlist entry. This gate is enforced at capture time (stricter than the standard W2 move gate, which only checks the field is non-empty).',
    intentPl:
      'Wymuszony trade-off to kręgosłup tego narzędzia: „tak" bez nazwanego „nie" nie jest decyzją o fokusie, jest wpisem na listę życzeń. Ta bramka jest wymuszana już przy zbieraniu danych (ostrzejsza niż standardowa bramka ruchu W2, która sprawdza tylko, że pole nie jest puste).',
    textEn:
      'If this option wins scarce attention and resources, name ONE OTHER option on your list that explicitly loses because of it. Which one, and why that one specifically?',
    textPl:
      'Jeśli ta opcja wygrywa ograniczoną uwagę i zasoby, nazwijcie JEDNĄ INNĄ opcję z Waszej listy, która przez to wyraźnie przegrywa. Którą i dlaczego akurat tę?',
    probeEn:
      '"We will just do both" is not an answer — it is the anti-focus pattern this tool exists to catch. Name the specific option that loses.',
    probePl:
      '„Zrobimy po prostu obie" to nie odpowiedź — to wzorzec anty-fokusu, po to istnieje to narzędzie. Nazwijcie konkretną opcję, która przegrywa.',
    answerOptions: [
      {
        key: 'named-alternative',
        labelEn: 'Named a specific other option that loses budget/team/attention',
        labelPl: 'Nazwano konkretną inną opcję, która traci budżet/zespół/uwagę',
        consultantSignalEn: 'A real trade-off — proceed to the rejection justification.',
        consultantSignalPl: 'Prawdziwy trade-off — przejdź do uzasadnienia rezygnacji.',
        focusDelta: 1,
      },
      {
        key: 'no-alternative-named',
        labelEn: 'Could not name a specific alternative that loses',
        labelPl: 'Nie udało się nazwać konkretnej alternatywy, która traci',
        consultantSignalEn:
          'FAIL — validateForcedTradeoffAnswer() rejects this answer. Do not let the option advance to "pursue" without a named loser.',
        consultantSignalPl:
          'BŁĄD — validateForcedTradeoffAnswer() odrzuca tę odpowiedź. Nie pozwól opcji awansować do „pursue" bez nazwanej przegranej.',
        focusDelta: -1,
      },
    ],
    branches: {
      'named-alternative': 'opt4-rejection-justification',
      'no-alternative-named': 'opt3-forced-tradeoff',
    },
    defaultNextId: 'opt4-rejection-justification',
  },
  {
    id: 'opt4-rejection-justification',
    level: 4,
    intentEn:
      'A cut without a reason returns next quarter. The justification is what lets the loser be defended to its own sponsor.',
    intentPl:
      'Cięcie bez powodu wraca za kwartał. Uzasadnienie to coś, co pozwala obronić przegraną opcję przed jej własnym sponsorem.',
    textEn:
      'Why is THAT option — and not a different one — the right one to lose here? What would have to change for it to come back?',
    textPl:
      'Dlaczego TA opcja — a nie inna — jest tą właściwą, żeby tu przegrać? Co musiałoby się zmienić, żeby wróciła?',
    probeEn:
      'A sound reason references the SAME axes used to score focus (value/effort/fit/evidence) — not politics or convenience.',
    probePl:
      'Solidny powód odwołuje się do TYCH SAMYCH osi, którymi mierzycie fokus (value/effort/fit/dowód) — nie do polityki czy wygody.',
    answerOptions: [
      {
        key: 'sound-reason',
        labelEn: 'Reason grounded in value/effort/fit/evidence, with a re-entry condition',
        labelPl: 'Powód oparty na value/effort/fit/dowodzie, z warunkiem powrotu',
        consultantSignalEn: 'Defensible cut — ready to enter the W2 move sequence.',
        consultantSignalPl: 'Cięcie obronne — gotowe do wejścia w sekwencję ruchów W2.',
        focusDelta: 1,
      },
      {
        key: 'weak-reason',
        labelEn: 'Reason is political, vague, or convenience-based',
        labelPl: 'Powód jest polityczny, mglisty lub wynika z wygody',
        consultantSignalEn:
          'Weak justification — flag for rework before this rejection can anchor a move.',
        consultantSignalPl:
          'Słabe uzasadnienie — oznacz do poprawki, zanim rezygnacja stanie się podstawą ruchu.',
        focusDelta: -1,
      },
    ],
    branches: {
      'sound-reason': null,
      'weak-reason': null,
    },
    defaultNextId: null,
  },
];

export const FOCUS_QUESTION_INDEX: Map<string, FocusQuestionNode> = new Map(
  FOCUS_OPTION_LADDER.map((q) => [q.id, q])
);

export const FOCUS_LADDER_ENTRY_ID = 'opt1-surface';

/** Follow the branch for an answer key, falling back to defaultNextId. */
export function getNextFocusQuestion(currentId: string, answerKey: string): string | null {
  const node = FOCUS_QUESTION_INDEX.get(currentId);
  if (!node) return null;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * Structural integrity check for the ladder: every branch/defaultNextId target
 * must exist, every question has bilingual text, and every path from the
 * entry question terminates (no infinite loop). Returns an empty array when
 * the bank is well-formed.
 */
export function validateFocusQuestionBankStructure(): string[] {
  const problems: string[] = [];
  FOCUS_OPTION_LADDER.forEach((q) => {
    if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
    if (!q.intentPl || !q.intentEn) problems.push(`${q.id}: missing PL or EN intent`);
    if (q.answerOptions.length === 0) problems.push(`${q.id}: no answer options`);
    q.answerOptions.forEach((opt) => {
      if (![-1, 0, 1].includes(opt.focusDelta)) {
        problems.push(`${q.id}: option ${opt.key} has invalid focusDelta`);
      }
      if (!(opt.key in q.branches)) {
        problems.push(`${q.id}: option ${opt.key} has no matching branch entry`);
      }
    });
    Object.entries(q.branches).forEach(([key, target]) => {
      if (target !== null && !FOCUS_QUESTION_INDEX.has(target)) {
        problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
      }
    });
    if (q.defaultNextId !== null && !FOCUS_QUESTION_INDEX.has(q.defaultNextId)) {
      problems.push(`${q.id}: defaultNextId points to missing question`);
    }
  });

  // Every path from the entry question must terminate (no cycles). A node
  // branching back to ITSELF is an intentional "retry this question" edge
  // (e.g. the forced-trade-off question re-asking when no alternative was
  // named) and is not a structural bug as long as its OTHER branches escape —
  // so self-loops are excluded from the cycle check below.
  const entry = FOCUS_QUESTION_INDEX.get(FOCUS_LADDER_ENTRY_ID);
  if (entry) {
    const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
    while (stack.length) {
      const { id, seen } = stack.pop()!;
      if (seen.has(id)) {
        problems.push(`cycle detected at ${id}`);
        continue;
      }
      const node = FOCUS_QUESTION_INDEX.get(id);
      if (!node) continue;
      const nextSeen = new Set(seen).add(id);
      const targets = new Set(
        Object.values(node.branches).concat(node.defaultNextId ? [node.defaultNextId] : [])
      );
      targets.forEach((t) => {
        if (t && t !== id) stack.push({ id: t, seen: nextSeen });
      });
    }
  }
  return problems;
}

/**
 * Serialize the ladder into a prompt block, so the AI mentor asks EXACTLY
 * these questions in conversation (single source of truth with the wizard).
 */
export function buildFocusLadderPromptBlock(language: 'pl' | 'en'): string {
  return FOCUS_OPTION_LADDER.map((q) => {
    const text = language === 'pl' ? q.textPl : q.textEn;
    const intent = language === 'pl' ? q.intentPl : q.intentEn;
    const options = q.answerOptions
      .map((opt) => {
        const label = language === 'pl' ? opt.labelPl : opt.labelEn;
        const signal = language === 'pl' ? opt.consultantSignalPl : opt.consultantSignalEn;
        const next = q.branches[opt.key];
        return `    - [${opt.key}] "${label}" (Δfocus ${opt.focusDelta >= 0 ? '+' : ''}${opt.focusDelta}) -> ${next || 'ladder complete'} (${signal})`;
      })
      .join('\n');
    return `[${q.id}] (L${q.level}) intent: ${intent}\n  Q: ${text}\n${options}`;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Forced trade-off validator — the "stronger than standard W2" gate.
//
// Standard W2 (moveValidator.validateW2Move) only checks that rationale /
// tradeOff / rejectedVariant fields are present and not too short. This gate
// additionally requires the trade-off answer to NAME one of the OTHER options
// actually on the table — a generic "we will deprioritize other things"
// answer fails here even though it would pass the plain non-empty check.
// ---------------------------------------------------------------------------

export type ForcedTradeoffFailureReason =
  | 'too-short'
  | 'no-named-alternative'
  | 'generic-non-answer';

export interface ForcedTradeoffValidation {
  valid: boolean;
  reason?: ForcedTradeoffFailureReason;
}

const MIN_FORCED_TRADEOFF_LEN = 15;

const GENERIC_NON_ANSWERS = [
  'everything',
  'nothing',
  'not sure',
  'both',
  'wszystko',
  'nic konkretnego',
  'nie wiem',
  'oba',
];

/**
 * Validate a level-3 "forced trade-off" answer against the OTHER option
 * titles actually present in the session. Fails when: the text is too thin,
 * it is a generic non-answer ("everything"/"wszystko"), or — when other
 * options exist — it names none of them.
 */
export function validateForcedTradeoffAnswer(
  answerText: string | undefined,
  otherOptionTitles: string[]
): ForcedTradeoffValidation {
  const text = (answerText || '').trim();
  if (text.length < MIN_FORCED_TRADEOFF_LEN) {
    return { valid: false, reason: 'too-short' };
  }

  const lower = text.toLowerCase();
  const isGeneric = GENERIC_NON_ANSWERS.some(
    (phrase) => lower === phrase || (lower.includes(phrase) && text.length < 40)
  );
  if (isGeneric) {
    return { valid: false, reason: 'generic-non-answer' };
  }

  const namedOthers = otherOptionTitles.filter((t) => t && t.trim());
  if (namedOthers.length > 0) {
    const namesAlternative = namedOthers.some((title) =>
      lower.includes(title.trim().toLowerCase())
    );
    if (!namesAlternative) {
      return { valid: false, reason: 'no-named-alternative' };
    }
  }

  return { valid: true };
}
