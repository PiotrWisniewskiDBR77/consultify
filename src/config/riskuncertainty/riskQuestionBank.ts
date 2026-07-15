/**
 * Risk & Uncertainty — laddered, branching question bank (OXFORD O3).
 *
 * Closes the 19th consulting tool's missing dedicated q-bank. Pattern mirror of
 * src/config/focustradeoffs/focusQuestionBank.ts (one ladder walked once PER
 * item — there per competing option, here per accepted risk) crossed with
 * src/config/smedplanner/smedQuestionBank.ts (a node that FORCES the ladder to
 * loop on itself until a real answer lands — there classification, here
 * quantification).
 *
 * Where the existing riskInsightStaircase.ts asks "where did this SCORE come
 * from" (fact -> interpretation -> implication, evidence discipline) and
 * deepeningLadder.ts asks "how deep is our thinking on this DIMENSION"
 * (assumption/risk/scenario x 4 rungs), THIS bank is the interview protocol
 * the AI mentor walks for ONE risk at intake, one question at a time:
 *
 *   L1 identification    — name the risk as a specific event, not a fear
 *   L2 forced quantification — probability x impact as NUMBERS (1-5 or a
 *                              defensible %/range), never "high/low" —
 *                              enforced by a self-looping node
 *                              (risk-l2-quantify-force) + a capture-time
 *                              validator stronger than a plain non-empty check
 *   L3 response strategy — mitigate / transfer / accept / avoid, named and
 *                          justified for THIS risk (also forced: a generic
 *                          "we'll keep an eye on it" loops back)
 *   L4 owner + trigger + RAID — who holds it, what fires it, is it ready for
 *                               the initiative RAID handoff (raidHandoff.ts)
 *
 * Every function here is pure and consumed both by the runtime AI prompt
 * (buildRiskLadderPromptBlock / buildRiskQuestionBankPromptRules) and by
 * tests — single source of truth between what the mentor asks in chat and
 * what the wizard would render.
 */

export type RiskQuestionLevel = 1 | 2 | 3 | 4;

export interface RiskAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextRiskQuestionId. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (steers the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface RiskQuestionNode {
  id: string;
  level: RiskQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally as a UI tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: RiskAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for
   * this path. Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// The single generic ladder, walked once PER accepted risk.
// ---------------------------------------------------------------------------

export const RISK_ITEM_LADDER: RiskQuestionNode[] = [
  {
    id: 'risk-l1-identify',
    level: 1,
    intentEn:
      'A risk register lives or dies on this question — "market risk" cannot be managed, "loss of the anchor client in Q3" can.',
    intentPl:
      'Rejestr ryzyk żyje lub umiera przez to pytanie — „ryzyko rynkowe" nie da się zarządzać, „utrata kluczowego klienta w Q3" już tak.',
    textEn:
      'Name this risk as ONE specific event (not a vague category) and the observable signal that shows it is real, not imagined.',
    textPl:
      'Nazwij to ryzyko jako JEDNO konkretne zdarzenie (nie mglistą kategorię) i obserwowalny sygnał, który pokazuje, że jest realne, nie wyobrażone.',
    probeEn:
      'If the name still sounds like a category ("market risk", "execution risk"), it is not yet a risk the register can carry.',
    probePl:
      'Jeśli nazwa wciąż brzmi jak kategoria („ryzyko rynkowe", „ryzyko wykonania"), to jeszcze nie ryzyko, które udźwignie rejestr.',
    answerOptions: [
      {
        key: 'named-event-with-signal',
        labelEn: 'Named as a specific event, with an observable signal behind it',
        labelPl: 'Nazwane jako konkretne zdarzenie, z obserwowalnym sygnałem w tle',
        consultantSignalEn: 'A real, addressable risk — proceed to quantification.',
        consultantSignalPl: 'Realne, adresowalne ryzyko — przejdź do kwantyfikacji.',
      },
      {
        key: 'vague-category',
        labelEn: 'Still a vague category or fear, no signal named',
        labelPl: 'Wciąż mglista kategoria lub obawa, bez nazwanego sygnału',
        consultantSignalEn:
          'Not yet scoreable — push for the specific event and the signal before moving on.',
        consultantSignalPl:
          'Jeszcze nie nadaje się do oceny — domagaj się konkretnego zdarzenia i sygnału, zanim pójdziesz dalej.',
      },
    ],
    branches: {
      'named-event-with-signal': 'risk-l2-quantify',
      'vague-category': 'risk-l2-quantify',
    },
    defaultNextId: 'risk-l2-quantify',
  },
  {
    id: 'risk-l2-quantify',
    level: 2,
    intentEn:
      'A probability/impact score is a NUMBER, not a mood — an exposure ranking built on adjectives cannot be compared across risks.',
    intentPl:
      'Ocena prawdopodobieństwo/wpływ to LICZBA, nie nastrój — ranking ekspozycji zbudowany na przymiotnikach nie da się porównać między ryzykami.',
    textEn:
      'Give this risk\'s probability AND impact as NUMBERS on a 1-5 scale (or a defensible %/cost range) — not "high" or "low". What are they, and where does each number come from?',
    textPl:
      'Podaj prawdopodobieństwo I wpływ tego ryzyka jako LICZBY w skali 1-5 (albo obronny zakres %/kosztu) — nie „wysokie" czy „niskie". Jakie to liczby i skąd każda z nich pochodzi?',
    probeEn:
      'If you catch yourself typing only "high"/"wysokie" with no number attached, the ladder cannot advance yet — give the figure.',
    probePl:
      'Jeśli zauważysz, że piszesz tylko „wysokie"/„high" bez żadnej liczby, drabinka nie może jeszcze iść dalej — podaj liczbę.',
    answerOptions: [
      {
        key: 'numeric-with-source',
        labelEn: 'Numeric probability AND impact given, with a stated source',
        labelPl: 'Podane liczbowe prawdopodobieństwo I wpływ, ze wskazanym źródłem',
        consultantSignalEn: 'Quantified — proceed to the response strategy.',
        consultantSignalPl: 'Skwantyfikowane — przejdź do strategii odpowiedzi.',
      },
      {
        key: 'label-only',
        labelEn: 'Only a qualitative label ("high"/"low"), no number given',
        labelPl: 'Tylko etykieta jakościowa („wysokie"/„niskie"), bez liczby',
        consultantSignalEn:
          'FAIL — validateForcedQuantificationAnswer() rejects this. Do not let the risk advance to a response strategy on an adjective.',
        consultantSignalPl:
          'BŁĄD — validateForcedQuantificationAnswer() odrzuca tę odpowiedź. Nie pozwól ryzyku awansować do strategii odpowiedzi na podstawie przymiotnika.',
      },
    ],
    branches: {
      'numeric-with-source': 'risk-l3-response',
      'label-only': 'risk-l2-quantify-force',
    },
    defaultNextId: 'risk-l2-quantify-force',
  },
  {
    id: 'risk-l2-quantify-force',
    level: 2,
    intentEn:
      'This is the forced loop: an un-numbered "high risk" cannot be ranked against any other risk on the register, so the ladder holds here until a number lands — especially for the register\'s top-exposure risks, which cannot reach the conclusion unscored.',
    intentPl:
      'To jest wymuszona pętla: nienazwane liczbą „wysokie ryzyko" nie da się uszeregować względem żadnego innego ryzyka w rejestrze, więc drabinka trzyma się tu, dopóki liczba nie padnie — zwłaszcza dla ryzyk o najwyższej ekspozycji w rejestrze, które nie mogą dotrzeć do konkluzji bez oceny liczbowej.',
    textEn:
      'This risk is still not quantified — restate probability and impact as numbers (1-5, or a %/cost range), or the register cannot rank it against anything else.',
    textPl:
      'To ryzyko wciąż nie jest skwantyfikowane — podaj ponownie prawdopodobieństwo i wpływ jako liczby (1-5 albo zakres %/kosztu), inaczej rejestr nie może go uszeregować względem reszty.',
    probeEn:
      'A number from memory, clearly labelled as an estimate, still beats no number at all — but it must be a number.',
    probePl:
      'Liczba z pamięci, jawnie oznaczona jako szacunek, wciąż bije brak liczby — ale musi to być liczba.',
    answerOptions: [
      {
        key: 'now-quantified',
        labelEn: 'Done — a number for probability and impact now given',
        labelPl: 'Gotowe — liczba dla prawdopodobieństwa i wpływu podana',
        consultantSignalEn: 'Quantified — the register can now rank it.',
        consultantSignalPl: 'Skwantyfikowane — rejestr może teraz je uszeregować.',
      },
      {
        key: 'still-only-label',
        labelEn: 'Still only a label, no number',
        labelPl: 'Wciąż tylko etykieta, bez liczby',
        consultantSignalEn:
          'Still unquantified — loop back, do not let the tool silently downgrade this risk to unscored.',
        consultantSignalPl:
          'Wciąż nieskwantyfikowane — wracamy, nie pozwól narzędziu po cichu zdegradować tego ryzyka do nieocenionego.',
      },
    ],
    // Deliberately loops back to itself: an unquantified risk blocks the
    // ladder, mirroring smedQuestionBank's smed-classify-force node.
    branches: {
      'now-quantified': 'risk-l3-response',
      'still-only-label': 'risk-l2-quantify-force',
    },
    defaultNextId: 'risk-l2-quantify-force',
  },
  {
    id: 'risk-l3-response',
    level: 3,
    intentEn:
      'The 2x2 zone implies a default response (mitigate/transfer/accept/avoid) — silence here is the most common way risk registers die: scored, ranked, and then never acted on.',
    intentPl:
      'Strefa 2x2 sugeruje domyślną reakcję (łagodź/przenieś/zaakceptuj/unikaj) — cisza w tym miejscu to najczęstszy sposób, w jaki rejestry ryzyk umierają: ocenione, uszeregowane i nigdy niewykorzystane.',
    textEn:
      'Given the probability x impact, which response do you commit to — mitigate, transfer, accept, or avoid — and why THIS one for this exact risk, not a generic "we\'ll deal with it"?',
    textPl:
      'Biorąc pod uwagę prawdopodobieństwo x wpływ, do jakiej reakcji się zobowiązujecie — łagodzić, przenieść, zaakceptować czy unikać — i dlaczego AKURAT ta, a nie ogólne „jakoś to załatwimy"?',
    probeEn:
      '"We\'ll keep an eye on it" is not a strategy for a high-exposure risk — name mitigate/transfer/accept/avoid explicitly.',
    probePl:
      '„Będziemy to obserwować" to nie strategia dla ryzyka wysokiej ekspozycji — nazwij wprost łagodź/przenieś/zaakceptuj/unikaj.',
    answerOptions: [
      {
        key: 'strategy-named-with-rationale',
        labelEn: 'A specific strategy named, with a rationale tied to this risk',
        labelPl: 'Nazwana konkretna strategia, z uzasadnieniem powiązanym z tym ryzykiem',
        consultantSignalEn: 'A real response — proceed to ownership, trigger, and RAID readiness.',
        consultantSignalPl:
          'Prawdziwa reakcja — przejdź do właściciela, triggera i gotowości RAID.',
      },
      {
        key: 'generic-non-strategy',
        labelEn: 'Generic non-strategy ("we\'ll manage it", "keep watching")',
        labelPl: 'Ogólnikowa nie-strategia („jakoś sobie poradzimy", „będziemy obserwować")',
        consultantSignalEn:
          'FAIL — the same failure mode as an unquantified risk: force a named strategy before moving on.',
        consultantSignalPl:
          'BŁĄD — ten sam wzorzec zawodności co brak kwantyfikacji: wymuś nazwaną strategię, zanim pójdziesz dalej.',
      },
    ],
    // Also a forced loop: a generic non-answer at L3 is the same anti-pattern
    // as an unquantified L2 answer, so it holds the ladder the same way.
    branches: {
      'strategy-named-with-rationale': 'risk-l4-raid',
      'generic-non-strategy': 'risk-l3-response',
    },
    defaultNextId: 'risk-l3-response',
  },
  {
    id: 'risk-l4-raid',
    level: 4,
    intentEn:
      'A response without an owner and a trigger is a paragraph, not a plan — and this is exactly the shape the initiative RAID log expects (see raidHandoff.ts).',
    intentPl:
      'Reakcja bez właściciela i triggera to akapit, nie plan — a to dokładnie kształt, jakiego oczekuje rejestr RAID inicjatywy (patrz raidHandoff.ts).',
    textEn:
      "Who owns this response, what is the early-warning trigger that fires it, and is this risk ready to hand off into the initiative's RAID log?",
    textPl:
      'Kto jest właścicielem tej reakcji, jaki jest trigger wczesnego ostrzegania, który ją uruchamia, i czy to ryzyko jest gotowe do przekazania do rejestru RAID inicjatywy?',
    probeEn: 'If the owner left tomorrow, would anyone notice the trigger fired?',
    probePl: 'Gdyby właściciel odszedł jutro, czy ktokolwiek zauważyłby, że trigger się uruchomił?',
    answerOptions: [
      {
        key: 'owner-trigger-raid-ready',
        labelEn: 'Owner and trigger named — ready for the RAID handoff',
        labelPl: 'Właściciel i trigger nazwani — gotowe do przekazania RAID',
        consultantSignalEn: 'Complete — eligible for toInitiativeRaidItems() handoff.',
        consultantSignalPl: 'Kompletne — kwalifikuje się do przekazania toInitiativeRaidItems().',
      },
      {
        key: 'owner-or-trigger-missing',
        labelEn: 'Owner or trigger still missing',
        labelPl: 'Wciąż brak właściciela lub triggera',
        consultantSignalEn:
          'Gap — flag responseGap in the matrix; do not hand this off to RAID until closed.',
        consultantSignalPl:
          'Luka — oznacz responseGap w macierzy; nie przekazuj do RAID, dopóki nie zostanie domknięte.',
      },
    ],
    branches: {
      'owner-trigger-raid-ready': null,
      'owner-or-trigger-missing': null,
    },
    defaultNextId: null,
  },
];

export const RISK_QUESTION_INDEX: Map<string, RiskQuestionNode> = new Map(
  RISK_ITEM_LADDER.map((q) => [q.id, q])
);

export const RISK_LADDER_ENTRY_ID = 'risk-l1-identify';

/** Follow the branch for an answer key, falling back to defaultNextId. */
export function getNextRiskQuestionId(currentId: string, answerKey: string): string | null {
  const node = RISK_QUESTION_INDEX.get(currentId);
  if (!node) return null;
  if (answerKey in node.branches) return node.branches[answerKey];
  return node.defaultNextId;
}

/**
 * True when a question node is a forced loop — i.e. at least one answer
 * branches back to the SAME question id. The ladder cannot silently skip
 * past this node; the discipline is enforced by the graph shape itself.
 */
export function isForcedLoopRiskQuestion(id: string): boolean {
  const node = RISK_QUESTION_INDEX.get(id);
  if (!node) return false;
  return Object.values(node.branches).some((next) => next === id);
}

/**
 * Structural integrity check for the ladder: every branch/defaultNextId target
 * must exist, every question has bilingual text, and every path from the
 * entry question terminates (no infinite loop besides the intentional
 * self-loops). Returns an empty array when the bank is well-formed.
 */
export function validateRiskQuestionBankStructure(): string[] {
  const problems: string[] = [];
  RISK_ITEM_LADDER.forEach((q) => {
    if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
    if (!q.intentPl || !q.intentEn) problems.push(`${q.id}: missing PL or EN intent`);
    if (q.answerOptions.length === 0) problems.push(`${q.id}: no answer options`);
    q.answerOptions.forEach((opt) => {
      if (!(opt.key in q.branches)) {
        problems.push(`${q.id}: option ${opt.key} has no matching branch entry`);
      }
    });
    Object.entries(q.branches).forEach(([key, target]) => {
      if (target !== null && !RISK_QUESTION_INDEX.has(target)) {
        problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
      }
    });
    if (q.defaultNextId !== null && !RISK_QUESTION_INDEX.has(q.defaultNextId)) {
      problems.push(`${q.id}: defaultNextId points to missing question`);
    }
  });

  // Every path from the entry question must terminate (no cycles). A node
  // branching back to ITSELF is an intentional "hold here" edge (the forced
  // quantification / forced response-strategy loops) and is not a structural
  // bug as long as its OTHER branches escape — so self-loops are excluded
  // from the cycle check below.
  const entry = RISK_QUESTION_INDEX.get(RISK_LADDER_ENTRY_ID);
  if (entry) {
    const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
    while (stack.length) {
      const { id, seen } = stack.pop()!;
      if (seen.has(id)) {
        problems.push(`cycle detected at ${id}`);
        continue;
      }
      const node = RISK_QUESTION_INDEX.get(id);
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
export function buildRiskLadderPromptBlock(language: 'pl' | 'en'): string {
  return RISK_ITEM_LADDER.map((q) => {
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
  }).join('\n');
}

/** Prompt block teaching the model the ladder + branching contract (PL/EN aware). */
export function buildRiskQuestionBankPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Drabinka pytań na WEJŚCIU ma 4 poziomy, chodzoną raz NA KAŻDE ryzyko: L1 identyfikacja (nazwane zdarzenie + sygnał, nie mglista kategoria) -> L2 WYMUSZONA kwantyfikacja (prawdopodobieństwo × wpływ jako LICZBY 1-5 lub zakres %/koszt — nigdy „wysokie/niskie"; sama etykieta jakościowa zawraca pytanie "risk-l2-quantify-force" do siebie, ZWŁASZCZA dla ryzyk o najwyższej ekspozycji, które nie mogą trafić do konkluzji bez liczby) -> L3 strategia odpowiedzi (mitygacja/transfer/akceptacja/unikanie, nazwana i uzasadniona per ryzyko — ogólnikowe „będziemy obserwować" tak samo zawraca pytanie do siebie) -> L4 właściciel + trigger + gotowość RAID (patrz raidHandoff.ts). Zakaz: nie pozwól ryzyku przejść z L2 na L3 bez liczby (walidator validateForcedQuantificationAnswer()).`;
  }
  return `The intake question ladder has 4 levels, walked once PER risk: L1 identification (a named event + signal, not a vague category) -> L2 FORCED quantification (probability x impact as NUMBERS 1-5 or a %/cost range — never "high/low"; a qualitative label loops question "risk-l2-quantify-force" back on itself, ESPECIALLY for the register's top-exposure risks, which cannot reach the conclusion unscored) -> L3 response strategy (mitigate/transfer/accept/avoid, named and justified per risk — a generic "we'll keep watching" loops the same way) -> L4 owner + trigger + RAID readiness (see raidHandoff.ts). Hard rule: do not let a risk advance from L2 to L3 without a number (validator: validateForcedQuantificationAnswer()).`;
}

// ---------------------------------------------------------------------------
// Forced quantification validator — the "stronger than standard W2" gate for
// the L2 loop, mirroring focusQuestionBank's validateForcedTradeoffAnswer.
//
// Standard fields (RiskItem.probability/impact) are ALWAYS numeric in the
// store schema — this validator is not for the persisted score, it is for the
// free-text ANSWER given during the interview, which can smuggle in a bare
// adjective ("high risk") that the UI would otherwise convert into an
// arbitrary default number. Catching it here keeps the number honest.
// ---------------------------------------------------------------------------

export type ForcedQuantificationFailureReason =
  | 'too-short'
  | 'qualitative-label-only'
  | 'no-numeric-value';

export interface ForcedQuantificationValidation {
  valid: boolean;
  reason?: ForcedQuantificationFailureReason;
}

const MIN_QUANTIFICATION_LEN = 8;

/** Bare qualitative labels with no attached figure — the anti-pattern this gate exists to catch. */
const QUALITATIVE_ONLY_TERMS = [
  'high',
  'low',
  'medium',
  'significant',
  'severe',
  'major',
  'minor',
  'moderate',
  'wysokie',
  'niskie',
  'średnie',
  'znaczące',
  'poważne',
  'duże',
  'małe',
  'umiarkowane',
];

/** Matches any digit — a score (1-5), a percentage, a range, or a money figure. */
const HAS_NUMBER = /\d/;

/**
 * True when `term` appears in `text` as a whole word. Uses Unicode-aware
 * lookaround boundaries (\p{L}/\p{N} + 'u' flag) instead of the plain `\b`
 * word boundary: JS's `\b` is ASCII-only, so it silently fails to anchor on
 * Polish words that START with a diacritic (e.g. "średnie" — the leading "ś"
 * is not a `\w` character to the regex engine, so `\bśrednie\b` never
 * matches). This bit the qualitative-label guard until caught by a unit test.
 */
function containsWholeWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');
  return re.test(text);
}

/**
 * Validate a level-2 "forced quantification" answer. Fails when: the text is
 * too thin to judge, OR it contains no digit at all. When it contains no
 * digit, the reason is refined to `qualitative-label-only` if the text is
 * built from the bare adjectives this gate targets, else `no-numeric-value`
 * for a generic non-answer.
 */
export function validateForcedQuantificationAnswer(
  answerText: string | undefined
): ForcedQuantificationValidation {
  const text = (answerText || '').trim();
  if (text.length < MIN_QUANTIFICATION_LEN) {
    return { valid: false, reason: 'too-short' };
  }

  if (HAS_NUMBER.test(text)) {
    return { valid: true };
  }

  const isQualitativeOnly = QUALITATIVE_ONLY_TERMS.some((term) => containsWholeWord(text, term));
  return {
    valid: false,
    reason: isQualitativeOnly ? 'qualitative-label-only' : 'no-numeric-value',
  };
}

/**
 * Validate a level-3 "forced response strategy" answer. Fails when the text
 * is too thin OR reads as a generic non-strategy ("we'll manage it",
 * "keep watching") rather than naming one of the four canonical responses
 * (mitigate/transfer/accept/avoid — or their PL equivalents).
 */
export type ForcedResponseStrategyFailureReason = 'too-short' | 'generic-non-strategy';

export interface ForcedResponseStrategyValidation {
  valid: boolean;
  reason?: ForcedResponseStrategyFailureReason;
}

const MIN_STRATEGY_LEN = 12;

const STRATEGY_TERMS =
  /\b(mitigat|transfer|accept|avoid|hedge|insur)\w*\b|(łagodz|złagodz|przenie|przeka[żz]|zaakceptu|unika|ubezpiecz|hedg)\w*/i;

/**
 * A named strategy term (mitigate/transfer/accept/avoid/hedge/insure or PL
 * equivalents) present anywhere in the text is what separates a real
 * commitment from a generic non-strategy ("we'll manage it", "będziemy
 * obserwować") — the phrase list documents the failure mode this gate
 * targets even though the regex above is the actual pass/fail check.
 */
export function validateForcedResponseStrategyAnswer(
  answerText: string | undefined
): ForcedResponseStrategyValidation {
  const text = (answerText || '').trim();
  if (text.length < MIN_STRATEGY_LEN) {
    return { valid: false, reason: 'too-short' };
  }

  if (!STRATEGY_TERMS.test(text)) {
    return { valid: false, reason: 'generic-non-strategy' };
  }

  return { valid: true };
}
