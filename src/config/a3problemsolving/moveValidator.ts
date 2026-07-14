/**
 * A3 Problem Solving — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It takes the A3 sections (problem →
 * root-cause → countermeasures, each a list of OperationalItems) plus mission
 * context and produces:
 *
 *   1. a per-section readiness score = depth × evidence (derived from the items)
 *   2. a verdict on whether the A3 is signable (staircase complete: quantified
 *      problem → evidenced root cause → owned countermeasure)
 *   3. a W2-validated countermeasure sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT "move must
 * justify itself" contract: a move is only VALID when all three fields are
 * present and non-trivial.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';

import { A3_SECTIONS, type A3SectionId, type Bilingual } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** How much each analytical section weighs when judging A3 readiness. */
const SECTION_WEIGHT: Record<A3SectionId, number> = {
  problem: 1,
  'root-cause': 1.2,
  countermeasures: 1,
};

const SECTION_LABEL: Record<A3SectionId, Bilingual> = {
  problem: { pl: 'Opis problemu', en: 'Problem statement' },
  'root-cause': { pl: 'Przyczyna źródłowa', en: 'Root cause' },
  countermeasures: { pl: 'Środki zaradcze', en: 'Countermeasures' },
};

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** An item is "evidenced" when it carries a measurable anchor (target/threshold/duration) or a concrete owner. */
const isEvidenced = (item: OperationalItem): boolean =>
  Boolean(
    (item.target && item.target.trim()) ||
    (item.threshold && item.threshold.trim()) ||
    typeof item.durationMinutes === 'number'
  );

const sectionItems = (data: OperationalToolData, section: A3SectionId): OperationalItem[] =>
  (data.sections?.[section] || []).filter(Boolean);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface SectionScore {
  section: A3SectionId;
  label: Bilingual;
  itemCount: number;
  /** Mean impact of items in this section, 1..3. */
  severity: number;
  /** Share of items carrying a measurable/owned anchor, 0..1. */
  evidenceRatio: number;
  /** Count of items with a measurable anchor. */
  evidenceBacked: number;
  /** severity × (0.4 + 0.6 × evidenceRatio) × weight, higher = more solid section. */
  score: number;
}

const scoreSection = (data: OperationalToolData, section: A3SectionId): SectionScore => {
  const items = sectionItems(data, section);
  const label = SECTION_LABEL[section];
  if (items.length === 0) {
    return {
      section,
      label,
      itemCount: 0,
      severity: 0,
      evidenceRatio: 0,
      evidenceBacked: 0,
      score: 0,
    };
  }

  const severity =
    items.reduce((sum, item) => sum + LEVEL_SCORE[asLevel(item.impact)], 0) / items.length;
  const evidenceBacked = items.filter(isEvidenced).length;
  const evidenceRatio = evidenceBacked / items.length;
  const score = round1(severity * (0.4 + 0.6 * evidenceRatio) * SECTION_WEIGHT[section]);

  return {
    section,
    label,
    itemCount: items.length,
    severity: round1(severity),
    evidenceRatio: round1(evidenceRatio),
    evidenceBacked,
    score,
  };
};

export interface A3Readiness {
  scores: SectionScore[];
  /** True only when every analytical section has at least one item. */
  staircaseComplete: boolean;
  /** The section that most weakens the A3 (lowest score among populated ones, or first empty). */
  weakestSection: A3SectionId | null;
  verdict: Bilingual;
}

/**
 * Judge whether the A3 is signable. The staircase is complete only when the
 * problem is stated, a root cause is found, and a countermeasure is proposed —
 * and the verdict names the weakest rung so the user knows where to deepen.
 */
export function assessA3(data: OperationalToolData): A3Readiness {
  const scores = A3_SECTIONS.map((section) => scoreSection(data, section));

  const emptySection = A3_SECTIONS.find(
    (s) => scores.find((x) => x.section === s)!.itemCount === 0
  );
  const staircaseComplete = !emptySection;

  const populated = scores.filter((s) => s.itemCount > 0);
  const weakestSection: A3SectionId | null = emptySection
    ? emptySection
    : populated.length > 0
      ? populated.slice().sort((a, b) => a.score - b.score)[0].section
      : null;

  let verdict: Bilingual;
  if (populated.length === 0) {
    verdict = {
      pl: 'A3 jest pusty — zacznij od nazwania problemu jako mierzalnego odchylenia od standardu.',
      en: 'The A3 is empty — start by naming the problem as a measurable deviation from standard.',
    };
  } else if (!staircaseComplete && emptySection) {
    verdict = {
      pl: `A3 niekompletny: brakuje sekcji „${SECTION_LABEL[emptySection].pl.toLowerCase()}". Bez pełnej drabiny problem→przyczyna→środek wniosek jest niepodpisywalny.`,
      en: `A3 incomplete: the "${SECTION_LABEL[emptySection].en.toLowerCase()}" section is missing. Without a full problem→cause→countermeasure staircase the conclusion is not signable.`,
    };
  } else {
    const weak = weakestSection ? scores.find((s) => s.section === weakestSection)! : populated[0];
    verdict = {
      pl: `Drabina kompletna, ale najsłabsze ogniwo to „${weak.label.pl.toLowerCase()}" (${weak.evidenceBacked}/${weak.itemCount} pozycji z twardym dowodem). Wzmocnij dowód tam, zanim podpiszesz A3.`,
      en: `Staircase complete, but the weakest link is "${weak.label.en.toLowerCase()}" (${weak.evidenceBacked}/${weak.itemCount} items with hard evidence). Strengthen evidence there before signing the A3.`,
    };
  }

  return { scores, staircaseComplete, weakestSection, verdict };
}

// ---------------------------------------------------------------------------
// W2 move validator
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  /** what the move costs / what you give up. */
  tradeOff?: string;
  /** the alternative deliberately NOT taken, and why. */
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  /** fields present but too thin to count as a real justification. */
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;

const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a countermeasure move is only valid when it justifies itself
 * with a rationale, an explicit trade-off, and a rejected variant. Near-literal
 * transfer of the Ansoff/SWOT move governance.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];

  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) {
      missing.push(field);
    } else if (isThin(value)) {
      weak.push(field);
    }
  });

  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export type A3MoveCategory =
  | 'contain'
  | 'eliminate-root'
  | 'prevent-recur'
  | 'validate-first'
  | 'standardize';

export interface SequencedMove {
  order: number;
  section: A3SectionId;
  category: A3MoveCategory;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  riskLevel: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

/**
 * Build a W2-validated countermeasure sequence from the assessed A3. The rule of
 * the sequence: contain the bleeding first (interim), then eliminate the
 * evidenced root cause; when the root cause is thinly evidenced, insert a
 * validate-first move before committing; finally standardize to prevent
 * recurrence. Every move carries an explicit trade-off and a rejected variant.
 */
export function buildW2MoveSequence(data: OperationalToolData): SequencedMove[] {
  const { scores, staircaseComplete } = assessA3(data);
  const problem = scores.find((s) => s.section === 'problem')!;
  const root = scores.find((s) => s.section === 'root-cause')!;

  // Nothing to sequence until at least a problem is stated.
  if (problem.itemCount === 0) return [];

  const moves: SequencedMove[] = [];
  let order = 1;

  // 1. Contain — stop the bleeding while the root cause is worked.
  moves.push({
    order: order++,
    section: 'problem',
    category: 'contain',
    title: {
      pl: 'Najpierw powstrzymaj skutek (środek tymczasowy)',
      en: 'First contain the effect (interim countermeasure)',
    },
    rationale: {
      pl: `Problem o wadze ${problem.severity}/3 działa dalej, dopóki nie usuniecie korzenia — środek tymczasowy chroni klienta w międzyczasie.`,
      en: `A problem of severity ${problem.severity}/3 keeps hurting until the root is removed — an interim measure protects the customer meanwhile.`,
    },
    tradeOff: {
      pl: 'Kosztem dodatkowej pracy ręcznej teraz, świadomie kupujecie czas na trwałe rozwiązanie zamiast gasić pożar w panice.',
      en: 'At the cost of extra manual work now, you deliberately buy time for a durable fix instead of firefighting in panic.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy „czekamy na pełne rozwiązanie": zostawienie skutku bez osłony przerzuca defekt wprost na klienta.',
      en: 'We reject "wait for the full fix": leaving the effect uncontained pushes the defect straight to the customer.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'low',
    riskLevel: 'low',
    validation: { valid: true, missing: [], weak: [] },
  });

  // 2. If root cause is missing or thinly evidenced, validate before committing.
  const rootEvidenceThin = root.itemCount === 0 || root.evidenceRatio < 0.5;
  if (rootEvidenceThin) {
    moves.push({
      order: order++,
      section: 'root-cause',
      category: 'validate-first',
      title: {
        pl: 'Zwaliduj przyczynę źródłową zanim wdrożysz środek',
        en: 'Validate the root cause before deploying a countermeasure',
      },
      rationale: {
        pl:
          root.itemCount === 0
            ? 'Brak potwierdzonej przyczyny źródłowej — bez niej każdy środek celuje w objaw, nie w korzeń.'
            : `Tylko ${root.evidenceBacked}/${root.itemCount} przyczyn ma twardy dowód — 5×Why z danymi z gemba odbiera ryzyko naprawy nie tego, co trzeba.`,
        en:
          root.itemCount === 0
            ? 'No confirmed root cause — without it any countermeasure aims at the symptom, not the root.'
            : `Only ${root.evidenceBacked}/${root.itemCount} causes carry hard evidence — a 5-Why with gemba data de-risks fixing the wrong thing.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1 cyklu opóźnienia we wdrożeniu środka, w zamian za pewność, że usuwacie realny korzeń.',
        en: 'At the cost of ~1 cycle of delay in deploying the fix, in exchange for confidence you remove the real root.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy wdrożenie środka na domyśle: naprawa niepotwierdzonej przyczyny to najdroższy sposób nauki, że korzeń był inny.',
        en: 'We reject deploying on a guess: fixing an unconfirmed cause is the most expensive way to learn the root was elsewhere.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // 3. Eliminate the root cause (the permanent countermeasure).
  moves.push({
    order: order++,
    section: 'countermeasures',
    category: 'eliminate-root',
    title: {
      pl: 'Usuń potwierdzoną przyczynę źródłową',
      en: 'Eliminate the confirmed root cause',
    },
    rationale: {
      pl: `Trwały środek adresuje korzeń o wadze ${root.severity || problem.severity}/3 — to jedyny ruch, który realnie zamyka policzoną lukę, a nie ją maskuje.`,
      en: `The permanent countermeasure addresses a root of severity ${root.severity || problem.severity}/3 — the only move that actually closes the quantified gap rather than masking it.`,
    },
    tradeOff: {
      pl: 'Kosztem większego nakładu na zmianę procesu/narzędzia niż na obejście, w zamian za to, że problem nie wraca.',
      en: 'At the cost of more effort on a process/tooling change than a workaround, in exchange for the problem not returning.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy trwałe obejście objawu: tańsze dziś, ale utrwala przyczynę i mnoży pracę ręczną na stałe.',
      en: 'We reject a permanent symptom workaround: cheaper today, but it entrenches the cause and multiplies manual work for good.',
    },
    expectedImpact: 'high',
    estimatedEffort: root.evidenceRatio >= 0.5 ? 'medium' : 'high',
    riskLevel: rootEvidenceThin ? 'medium' : 'low',
    validation: { valid: true, missing: [], weak: [] },
  });

  // 4. Standardize to prevent recurrence — only once the staircase is complete.
  if (staircaseComplete) {
    moves.push({
      order: order++,
      section: 'countermeasures',
      category: 'standardize',
      title: {
        pl: 'Ustandaryzuj i zabezpiecz przed nawrotem',
        en: 'Standardize and prevent recurrence',
      },
      rationale: {
        pl: 'Bez standardu i pomiaru utrzymania środek cofa się do stanu wyjściowego — utrwalenie zmiany chroni policzony zysk.',
        en: 'Without a standard and a sustainment measure the fix regresses to baseline — locking the change protects the computed gain.',
      },
      tradeOff: {
        pl: 'Kosztem czasu na dokumentację i szkolenie teraz, w zamian za to, że nie powtarzacie tego samego A3 za kwartał.',
        en: 'At the cost of documentation and training time now, in exchange for not repeating the same A3 next quarter.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „zamykamy A3 po wdrożeniu": bez standardu i właściciela zmiana rozmywa się przy pierwszej zmianie obsady.',
        en: 'We reject "close the A3 after deployment": without a standard and an owner the change dissolves at the first staffing change.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  return moves;
}

/** Flatten a SequencedMove into the store's OperationalItem shape (localized). */
export function toOperationalItem(
  seq: SequencedMove,
  isPolish: boolean,
  id: string
): OperationalItem {
  return {
    id,
    title: localize(seq.title, isPolish),
    description:
      `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
        seq.rejectedVariant,
        isPolish
      )}`.trim(),
    impact: seq.expectedImpact,
    effort: seq.estimatedEffort,
    category: seq.category,
  };
}

/**
 * One-shot synthesis: readiness + W2 sequence, ready for the UI or the AI
 * fallback. Pure and deterministic.
 */
export function synthesizeA3(data: OperationalToolData): {
  readiness: A3Readiness;
  sequence: SequencedMove[];
} {
  return {
    readiness: assessA3(data),
    sequence: buildW2MoveSequence(data),
  };
}
