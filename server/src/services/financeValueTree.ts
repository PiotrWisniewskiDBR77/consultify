/**
 * financeValueTree — Benefit VALUE-TREE decomposition (W3)
 * ============================================================================
 * A headline benefit ("initiative X saves 800 000") is a black box until it is
 * decomposed into WHERE the value comes from and HOW SOLID each part is. This
 * layer splits a benefit into three canonical value buckets —
 *   • savings  (cost taken out — usually the hardest, most controllable)
 *   • growth   (incremental revenue — depends on the market, softer)
 *   • risk     (avoided loss / risk mitigation — real but hardest to bank)
 * — and assigns each component a RISK GRADE + a confidence-weighted "bankable"
 * value, so the conclusion layer can say not just "800k" but "540k bankable,
 * the growth slice is a bet".
 *
 * This is the finance analog of a driver tree, but oriented at ADVICE: it does
 * not evaluate an arbitrary formula (that is `driverTreeService`); it grades a
 * benefit's QUALITY so a recommendation can lead with the reliable value and
 * flag the speculative value honestly (R2 causality, R5 numbers-from-engine —
 * all magnitudes are inputs, this layer only classifies + weights them).
 *
 * Pure functions only. No I/O, no LLM.
 */

import type { FinanceLanguage } from './financeConclusionService.js';

export type ValueBucket = 'savings' | 'growth' | 'risk';

/** Risk grade of a value component = how bankable the assumed amount is. */
export type ComponentRisk = 'hard' | 'firm' | 'soft';

/** Confidence weighting applied to each grade to derive the bankable value. */
export const RISK_WEIGHT: Record<ComponentRisk, number> = {
  hard: 1, // contracted / already-realised cost take-out
  firm: 0.75, // credible plan, some execution risk
  soft: 0.4, // depends on market / behaviour — a bet
};

/** One component of the benefit, as supplied by the engine/estimate. */
export interface ValueComponentInput {
  /** Human label, e.g. "redukcja roboczogodzin". */
  label: string;
  /** Which canonical bucket this value belongs to. */
  bucket: ValueBucket;
  /** Annual amount (from engine/estimate). Positive = benefit. */
  amount: number;
  /** How solid the amount is. Defaults by bucket if omitted. */
  risk?: ComponentRisk;
  /** Optional note grounding the amount (evidence/assumption). */
  basis?: string;
}

/** A component after grading — carries the confidence-weighted bankable value. */
export interface GradedComponent extends Required<Omit<ValueComponentInput, 'basis'>> {
  basis?: string;
  /** amount × RISK_WEIGHT[risk]. */
  bankable: number;
}

export interface BucketRollup {
  bucket: ValueBucket;
  /** Sum of raw amounts in this bucket. */
  gross: number;
  /** Sum of bankable (risk-weighted) amounts in this bucket. */
  bankable: number;
  /** Share of total gross benefit (0..1). */
  shareOfGross: number;
}

export interface BenefitValueTree {
  components: GradedComponent[];
  buckets: BucketRollup[];
  /** Total raw benefit across all components. */
  gross: number;
  /** Total confidence-weighted benefit. */
  bankable: number;
  /** bankable / gross (0..1) — the benefit's overall "solidity". */
  solidity: number;
  /** The riskiest slice (largest soft-graded amount), for honest flagging. */
  largestSoftComponent: GradedComponent | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Default grade by bucket when the caller does not grade a component. */
function defaultRisk(bucket: ValueBucket): ComponentRisk {
  if (bucket === 'savings') return 'firm';
  if (bucket === 'growth') return 'soft';
  return 'soft'; // avoided-risk value is inherently a bet
}

/**
 * Build the benefit value tree: grade each component, weight it, and roll up
 * by bucket. All amounts are engine/estimate inputs — this layer only splits,
 * grades and weights (never invents a magnitude).
 */
export function buildBenefitValueTree(components: ValueComponentInput[]): BenefitValueTree {
  const graded: GradedComponent[] = (components || [])
    .filter((c) => c && Number.isFinite(Number(c.amount)))
    .map((c) => {
      const risk = c.risk ?? defaultRisk(c.bucket);
      const amount = num(c.amount);
      return {
        label: c.label,
        bucket: c.bucket,
        amount,
        risk,
        basis: c.basis,
        bankable: amount * RISK_WEIGHT[risk],
      };
    });

  const gross = graded.reduce((a, c) => a + c.amount, 0);
  const bankable = graded.reduce((a, c) => a + c.bankable, 0);

  const bucketOrder: ValueBucket[] = ['savings', 'growth', 'risk'];
  const buckets: BucketRollup[] = bucketOrder
    .map((bucket) => {
      const inBucket = graded.filter((c) => c.bucket === bucket);
      const bGross = inBucket.reduce((a, c) => a + c.amount, 0);
      const bBankable = inBucket.reduce((a, c) => a + c.bankable, 0);
      return {
        bucket,
        gross: bGross,
        bankable: bBankable,
        shareOfGross: gross > 0 ? bGross / gross : 0,
      };
    })
    .filter((b) => b.gross !== 0 || b.bankable !== 0);

  const softComponents = graded.filter((c) => c.risk === 'soft');
  const largestSoftComponent =
    softComponents.length > 0
      ? softComponents.reduce((max, c) => (c.amount > max.amount ? c : max), softComponents[0])
      : null;

  return {
    components: graded,
    buckets,
    gross,
    bankable,
    solidity: gross > 0 ? bankable / gross : 0,
    largestSoftComponent,
  };
}

/**
 * Deterministic W3-style verdict over a benefit value tree: lead with the
 * bankable value, name the split, and flag the speculative slice honestly.
 * Numbers all come from the tree (which came from the engine).
 */
export function narrateValueTree(tree: BenefitValueTree, language: FinanceLanguage): string {
  const isPL = language === 'pl';
  const fmt = (n: number): string =>
    new Intl.NumberFormat(isPL ? 'pl-PL' : 'en-US', { maximumFractionDigits: 0 }).format(
      Math.round(n)
    );
  const pct = (n: number): string => `${Math.round(n * 100)}%`;

  if (tree.gross === 0) {
    return isPL
      ? 'Brak składowych korzyści do oceny — wartość do ustalenia (gdzie/kiedy).'
      : 'No benefit components to assess — value to be established (where/when).';
  }

  const bucketName = (b: ValueBucket): string =>
    isPL
      ? b === 'savings'
        ? 'oszczędności'
        : b === 'growth'
          ? 'wzrost'
          : 'ograniczenie ryzyka'
      : b;

  const split = tree.buckets
    .map((b) => `${bucketName(b.bucket)} ${pct(b.shareOfGross)}`)
    .join(', ');

  const softFlag = tree.largestSoftComponent
    ? isPL
      ? ` Najbardziej spekulatywna pozycja: „${tree.largestSoftComponent.label}" (${fmt(tree.largestSoftComponent.amount)}) — to zakład, nie pewnik.`
      : ` Most speculative item: "${tree.largestSoftComponent.label}" (${fmt(tree.largestSoftComponent.amount)}) — a bet, not a given.`
    : '';

  return isPL
    ? `Korzyść ${fmt(tree.gross)} to w rzeczywistości ${fmt(tree.bankable)} „do zaksięgowania" (solidność ${pct(tree.solidity)}). Rozkład: ${split}.${softFlag} Rekomendacja opiera się na części pewnej; część miękką traktujemy jako opcję.`
    : `The ${fmt(tree.gross)} benefit is really ${fmt(tree.bankable)} bankable (solidity ${pct(tree.solidity)}). Split: ${split}.${softFlag} The recommendation leans on the reliable slice; the soft slice is treated as an option.`;
}
