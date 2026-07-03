/**
 * SOP Builder — synthesis engine + W2 move validator.
 *
 * The pure, testable brain of the tool. It takes the SOP sections (standards →
 * checklists, each a list of OperationalItems) plus mission context and produces:
 *
 *   1. a per-section robustness score = coverage × measurability (from the items)
 *   2. a verdict on whether the SOP is enforceable (standards are measurable AND
 *      each is covered by at least one verification checklist item)
 *   3. a W2-validated rollout sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The W2 validator is the near-literal transfer of the Ansoff/SWOT "move must
 * justify itself" contract: a move is only VALID when all three fields are
 * present and non-trivial.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';

import { SOP_SECTIONS, type SopSectionId, type Bilingual } from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

const SECTION_LABEL: Record<SopSectionId, Bilingual> = {
  standards: { pl: 'Standardy', en: 'Standards' },
  checklists: { pl: 'Checklisty', en: 'Checklists' },
};

const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round1 = (value: number) => Math.round(value * 10) / 10;

const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** An item is "measurable" when it carries a threshold, target, or a duration — a testable criterion. */
const isMeasurable = (item: OperationalItem): boolean =>
  Boolean(
    (item.threshold && item.threshold.trim()) ||
      (item.target && item.target.trim()) ||
      typeof item.durationMinutes === 'number'
  );

const sectionItems = (data: OperationalToolData, section: SopSectionId): OperationalItem[] =>
  (data.sections?.[section] || []).filter(Boolean);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface SectionScore {
  section: SopSectionId;
  label: Bilingual;
  itemCount: number;
  /** Mean criticality of items (impact), 1..3. */
  criticality: number;
  /** Share of items carrying a measurable criterion, 0..1. */
  measurableRatio: number;
  /** Count of measurable items. */
  measurableCount: number;
  /** criticality × (0.3 + 0.7 × measurableRatio), higher = more enforceable section. */
  score: number;
}

const scoreSection = (data: OperationalToolData, section: SopSectionId): SectionScore => {
  const items = sectionItems(data, section);
  const label = SECTION_LABEL[section];
  if (items.length === 0) {
    return { section, label, itemCount: 0, criticality: 0, measurableRatio: 0, measurableCount: 0, score: 0 };
  }

  const criticality =
    items.reduce((sum, item) => sum + LEVEL_SCORE[asLevel(item.impact)], 0) / items.length;
  const measurableCount = items.filter(isMeasurable).length;
  const measurableRatio = measurableCount / items.length;
  const score = round1(criticality * (0.3 + 0.7 * measurableRatio));

  return {
    section,
    label,
    itemCount: items.length,
    criticality: round1(criticality),
    measurableRatio: round1(measurableRatio),
    measurableCount,
    score,
  };
};

export interface SopReadiness {
  scores: SectionScore[];
  /** True only when there are standards AND checklists AND at least half the standards are measurable. */
  enforceable: boolean;
  /** Standards that lack a measurable criterion — the ones most likely judged "by eye". */
  unmeasurableStandards: number;
  /** True when checklist coverage is thin relative to the standard count. */
  coverageGap: boolean;
  weakestSection: SopSectionId | null;
  verdict: Bilingual;
}

/**
 * Judge whether the SOP is enforceable. An SOP is only signable when standards
 * are measurable and checklists actually verify them — the verdict names the
 * weakest section so the user knows where to deepen.
 */
export function assessSop(data: OperationalToolData): SopReadiness {
  const scores = SOP_SECTIONS.map((section) => scoreSection(data, section));
  const standards = scores.find((s) => s.section === 'standards')!;
  const checklists = scores.find((s) => s.section === 'checklists')!;

  const unmeasurableStandards = standards.itemCount - standards.measurableCount;
  // Coverage gap: fewer checklist items than standards, or no checklists at all.
  const coverageGap = standards.itemCount > 0 && checklists.itemCount < standards.itemCount;
  const enforceable =
    standards.itemCount > 0 && checklists.itemCount > 0 && standards.measurableRatio >= 0.5;

  const populated = scores.filter((s) => s.itemCount > 0);
  const weakestSection: SopSectionId | null =
    standards.itemCount === 0
      ? 'standards'
      : checklists.itemCount === 0
        ? 'checklists'
        : populated.length > 0
          ? populated.slice().sort((a, b) => a.score - b.score)[0].section
          : null;

  let verdict: Bilingual;
  if (standards.itemCount === 0) {
    verdict = {
      pl: 'SOP jest pusty — zacznij od standardów zapisanych jako granice pass/fail z mierzalnym progiem.',
      en: 'The SOP is empty — start with standards written as pass/fail boundaries with a measurable threshold.',
    };
  } else if (checklists.itemCount === 0) {
    verdict = {
      pl: `Masz ${standards.itemCount} standard(ów), ale zero checklist — standard bez punktu weryfikacji jest fikcją zgodności, nie SOP.`,
      en: `You have ${standards.itemCount} standard(s) but zero checklists — a standard with no verification point is a compliance fiction, not an SOP.`,
    };
  } else if (!enforceable) {
    verdict = {
      pl: `SOP nieegzekwowalny: ${unmeasurableStandards}/${standards.itemCount} standardów bez mierzalnego progu ocenia się „na oko". Dodaj progi, zanim wdrożysz.`,
      en: `SOP not enforceable: ${unmeasurableStandards}/${standards.itemCount} standards lack a measurable threshold and get judged "by eye". Add thresholds before rollout.`,
    };
  } else if (coverageGap) {
    verdict = {
      pl: `Standardy mierzalne, ale checklisty (${checklists.itemCount}) nie pokrywają wszystkich standardów (${standards.itemCount}) — część zgodności nie jest weryfikowana.`,
      en: `Standards measurable, but checklists (${checklists.itemCount}) do not cover all standards (${standards.itemCount}) — part of compliance goes unverified.`,
    };
  } else {
    verdict = {
      pl: 'SOP egzekwowalny: standardy mierzalne i pokryte weryfikacją. Zamknij pętlę śladem wykonania i właścicielem.',
      en: 'SOP enforceable: standards are measurable and covered by verification. Close the loop with a completion trace and an owner.',
    };
  }

  return { scores, enforceable, unmeasurableStandards, coverageGap, weakestSection, verdict };
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
 * The W2 contract: an SOP rollout move is only valid when it justifies itself
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

export type SopMoveCategory =
  | 'quantify-standard'
  | 'cover-with-checklist'
  | 'validate-first'
  | 'poka-yoke'
  | 'assign-owner';

export interface SequencedMove {
  order: number;
  section: SopSectionId;
  category: SopMoveCategory;
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
 * Build a W2-validated rollout sequence from the assessed SOP. The rule of the
 * sequence: make the standards measurable first (a non-measurable standard
 * cannot be verified), then cover them with checklists, pilot before mandating,
 * and finally close the loop with ownership. Every move carries an explicit
 * trade-off and a rejected variant.
 */
export function buildW2MoveSequence(data: OperationalToolData): SequencedMove[] {
  const readiness = assessSop(data);
  const standards = readiness.scores.find((s) => s.section === 'standards')!;

  // Nothing to sequence until at least one standard exists.
  if (standards.itemCount === 0) return [];

  const moves: SequencedMove[] = [];
  let order = 1;

  // 1. Quantify unmeasurable standards first — the prerequisite of every verification.
  if (readiness.unmeasurableStandards > 0) {
    moves.push({
      order: order++,
      section: 'standards',
      category: 'quantify-standard',
      title: {
        pl: 'Najpierw nadaj mierzalny próg standardom ocenianym „na oko"',
        en: 'First give a measurable threshold to standards judged "by eye"',
      },
      rationale: {
        pl: `${readiness.unmeasurableStandards}/${standards.itemCount} standardów nie ma progu — bez liczby dwie osoby ocenią ten sam wynik inaczej i checklista nie ma czego sprawdzać.`,
        en: `${readiness.unmeasurableStandards}/${standards.itemCount} standards have no threshold — without a number two people grade the same output differently and the checklist has nothing to test.`,
      },
      tradeOff: {
        pl: 'Kosztem czasu na ustalenie i uzgodnienie progów teraz, w zamian za standardy, które skalują się na nową obsadę bez interpretacji.',
        en: 'At the cost of time to set and agree thresholds now, in exchange for standards that scale to new staff without interpretation.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „doprecyzujemy w praktyce": standard uznaniowy utrwala różne wykonania i uniemożliwia audyt zgodności.',
        en: 'We reject "we will refine it in practice": a discretionary standard entrenches divergent execution and makes compliance un-auditable.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // 2. Cover standards with verification checklist items.
  if (readiness.coverageGap) {
    moves.push({
      order: order++,
      section: 'checklists',
      category: 'cover-with-checklist',
      title: {
        pl: 'Pokryj każdy standard punktem weryfikacji pass/fail',
        en: 'Cover every standard with a pass/fail verification point',
      },
      rationale: {
        pl: 'Standard bez odpowiadającego punktu checklisty nie jest egzekwowany — pokrycie zamienia dokument w kontrolę, która łapie błąd u źródła.',
        en: 'A standard with no matching checklist point is not enforced — coverage turns the document into a control that catches errors at the source.',
      },
      tradeOff: {
        pl: 'Kosztem dłuższej checklisty i kilku sekund dłużej na cykl, w zamian za wychwycenie defektu, zanim trafi do klienta.',
        en: 'At the cost of a longer checklist and a few seconds more per cycle, in exchange for catching the defect before it reaches the customer.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy poleganie na pamięci operatora: bez punktu weryfikacji zgodność zależy od uwagi, która pęka pod presją czasu.',
        en: 'We reject relying on operator memory: without a verification point compliance depends on attention, which breaks under time pressure.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      riskLevel: 'low',
      validation: { valid: true, missing: [], weak: [] },
    });
  }

  // 3. Pilot the SOP on one line/shift before mandating it everywhere.
  moves.push({
    order: order++,
    section: 'checklists',
    category: 'validate-first',
    title: {
      pl: 'Zwaliduj SOP na jednej zmianie zanim narzucisz go wszędzie',
      en: 'Validate the SOP on one shift before mandating it everywhere',
    },
    rationale: {
      pl: 'Pilotaż ujawnia kroki niewykonalne w realnym tempie i punkty, które ludzie omijają — taniej poprawić je przed skalą niż po.',
      en: 'A pilot reveals steps that are unworkable at real pace and items people bypass — cheaper to fix before scale than after.',
    },
    tradeOff: {
      pl: 'Kosztem ~1 cyklu opóźnienia w pełnym wdrożeniu, w zamian za SOP, którego zespół realnie używa, a nie obchodzi.',
      en: 'At the cost of ~1 cycle of delay in full rollout, in exchange for an SOP the team actually uses rather than bypasses.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy wdrożenie „od jutra dla wszystkich": SOP narzucony bez testu generuje ciche obejścia i fikcję zgodności.',
      en: 'We reject "from tomorrow for everyone": an SOP mandated without a test generates silent workarounds and a compliance fiction.',
    },
    expectedImpact: 'medium',
    estimatedEffort: 'low',
    riskLevel: 'low',
    validation: { valid: true, missing: [], weak: [] },
  });

  // 4. Close the loop: owner + completion trace — only once the SOP is enforceable.
  if (readiness.enforceable && !readiness.coverageGap) {
    moves.push({
      order: order++,
      section: 'standards',
      category: 'assign-owner',
      title: {
        pl: 'Zamknij pętlę: właściciel, ślad wykonania i rytm audytu',
        en: 'Close the loop: owner, completion trace, and audit rhythm',
      },
      rationale: {
        pl: 'SOP bez właściciela i śladu wykonania degraduje się cicho — podpis/log i cykliczny audyt utrzymują zgodność po wygaśnięciu entuzjazmu.',
        en: 'An SOP with no owner and no completion trace decays silently — a sign-off/log and a periodic audit sustain compliance after the enthusiasm fades.',
      },
      tradeOff: {
        pl: 'Kosztem lekkiej biurokracji rejestrowania wykonania, w zamian za widoczność zgodności dla audytu i realną trwałość standardu.',
        en: 'At the cost of light bureaucracy logging completion, in exchange for audit-visible compliance and a standard that actually endures.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „ufamy, że się przyjmie": bez właściciela i miary utrzymania SOP cofa się przy pierwszej zmianie obsady.',
        en: 'We reject "trust it will stick": without an owner and a sustainment measure the SOP regresses at the first staffing change.',
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
export function toOperationalItem(seq: SequencedMove, isPolish: boolean, id: string): OperationalItem {
  return {
    id,
    title: localize(seq.title, isPolish),
    description: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
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
export function synthesizeSop(data: OperationalToolData): {
  readiness: SopReadiness;
  sequence: SequencedMove[];
} {
  return {
    readiness: assessSop(data),
    sequence: buildW2MoveSequence(data),
  };
}
