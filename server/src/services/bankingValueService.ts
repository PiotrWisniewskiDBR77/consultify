/**
 * Banking the Value — M16/3.6
 *
 * The hardest proof that a benefit is real: wire an approved benefit into the
 * NEXT period's budget line and then reconcile actual-vs-plan.
 *
 * Doctrine (CFO-grade, run-rate banking):
 *   - Only HARD + RUN-RATE benefits are "bankable". Soft or one-off benefits
 *     are tracked but NOT wired into a budget line — they cannot be banked.
 *   - cost_out (cost saving) → REDUCES the mapped cost line (negative delta).
 *   - revenue_up → INCREASES the mapped revenue line (positive delta).
 *   - A benefit is "banked" only once ACTUAL confirms the budget entry; if the
 *     actual does not show the saving/uplift (variance negative), it has "leaked".
 *
 * All functions are PURE (no I/O, no DB).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type BenefitType = 'cost_out' | 'revenue_up';

export interface Benefit {
  /** Magnitude of the benefit, always a positive amount. */
  value: number;
  type: BenefitType;
  /** Hard = financially verifiable / cashable. Soft benefits cannot be banked. */
  isHard: boolean;
  /** Run-rate = recurring/annualized. One-off benefits cannot be banked. */
  isRunRate: boolean;
  /** Budget line code this benefit is mapped to (e.g. 'OPEX-IT', 'REV-SaaS'). */
  mappedBudgetLine: string;
}

export interface BudgetLineImpact {
  /** Budget line that moves. */
  lineCode: string;
  /**
   * Signed change applied to the line for the target period.
   *   cost_out  → negative (cost line reduced)
   *   revenue_up → positive (revenue line increased)
   */
  deltaValue: number;
}

export interface BankBenefitResult {
  /** Amount actually wired into the budget (0 when benefit is not bankable). */
  bankedAmount: number;
  budgetLineImpact: BudgetLineImpact;
  /** The budget period the benefit was banked into. */
  period: string;
}

export type BankingStatus = 'banked' | 'pending' | 'leaked';

export interface BankingStatusResult {
  status: BankingStatus;
  /**
   * actual − banked plan (signed, in benefit magnitude terms).
   *   >= 0 → plan confirmed (banked)
   *   <  0 → saving/uplift did not materialize (leaked)
   */
  variance: number;
}

export interface PortfolioItem {
  benefit: Benefit;
  /** Realized actual for the same line; magnitude terms. Undefined = not yet measured. */
  actual?: number;
}

export interface PortfolioBankedResult {
  totalBanked: number;
  totalPending: number;
  totalLeaked: number;
  /** Banked value as a fraction of total bankable value (0..1). */
  bankedPct: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A benefit can only be wired into a budget line when it is hard AND run-rate. */
export function isBankable(benefit: Benefit): boolean {
  return benefit.isHard === true && benefit.isRunRate === true;
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

// ─── 1. bankBenefit ───────────────────────────────────────────────────────────

/**
 * Wire an approved benefit into the next period's budget line.
 *
 * Only run-rate + hard benefits are actually banked. Anything else produces a
 * zero-impact result (tracked, not banked) so callers can still see the line.
 */
export function bankBenefit(benefit: Benefit, targetBudgetPeriod: string): BankBenefitResult {
  const magnitude = safeAmount(benefit.value);
  const bankable = isBankable(benefit);
  const bankedAmount = bankable ? magnitude : 0;

  // cost_out reduces a cost line (negative); revenue_up increases a revenue line.
  const sign = benefit.type === 'cost_out' ? -1 : 1;
  // `+ 0` normalizes -0 → 0 for the zero-impact (non-bankable) case.
  const deltaValue = bankedAmount * sign + 0;

  return {
    bankedAmount,
    budgetLineImpact: {
      lineCode: benefit.mappedBudgetLine,
      deltaValue,
    },
    period: targetBudgetPeriod,
  };
}

// ─── 2. bankingStatus ──────────────────────────────────────────────────────────

/**
 * Reconcile actual-vs-plan for a banked benefit.
 *
 *   - not bankable / no actual yet → 'pending' (variance 0)
 *   - actual confirms the planned saving/uplift (variance >= 0) → 'banked'
 *   - actual falls short (variance < 0) → 'leaked'
 *
 * Variance is expressed in benefit-magnitude terms (positive = good), so the
 * same comparison holds for both cost_out and revenue_up.
 */
export function bankingStatus(benefit: Benefit, actual?: number): BankingStatusResult {
  if (!isBankable(benefit) || actual === undefined || actual === null) {
    return { status: 'pending', variance: 0 };
  }

  const planned = safeAmount(benefit.value);
  const realized = Number.isFinite(actual) ? actual : 0;
  const variance = realized - planned;

  return {
    status: variance >= 0 ? 'banked' : 'leaked',
    variance,
  };
}

// ─── 3. portfolioBanked ─────────────────────────────────────────────────────────

/**
 * Aggregate how much approved value has actually "come off the budget".
 *
 *   totalBanked  — confirmed by actuals
 *   totalPending — bankable but not yet measured (no actual)
 *   totalLeaked  — bankable but actuals fell short (counted at planned magnitude)
 *   bankedPct    — totalBanked / total bankable value (banked + pending + leaked)
 *
 * Non-bankable benefits (soft / one-off) are excluded from every bucket — they
 * were never wired into a budget line.
 */
export function portfolioBanked(items: PortfolioItem[]): PortfolioBankedResult {
  let totalBanked = 0;
  let totalPending = 0;
  let totalLeaked = 0;

  for (const item of items ?? []) {
    if (!item || !item.benefit || !isBankable(item.benefit)) continue;

    const planned = safeAmount(item.benefit.value);
    const { status } = bankingStatus(item.benefit, item.actual);

    if (status === 'banked') {
      totalBanked += planned;
    } else if (status === 'leaked') {
      totalLeaked += planned;
    } else {
      totalPending += planned;
    }
  }

  const bankableTotal = totalBanked + totalPending + totalLeaked;
  const bankedPct = bankableTotal > 0 ? totalBanked / bankableTotal : 0;

  return { totalBanked, totalPending, totalLeaked, bankedPct };
}
