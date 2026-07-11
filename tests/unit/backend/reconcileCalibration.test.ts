/**
 * Reconcile Calibration (F6 / R1-R8) — SHADOW MODE calibration freeze.
 *
 * Freezes the outcome of running reconciliationService.reconcileStatements()
 * against 3 synthetic-but-internally-consistent statement packs built by the
 * calibration harness (server/src/services/__harness__/reconcileCalibration.ts):
 *
 *   - CLEAN:        every statement ties out exactly       -> 0 violations
 *   - MINOR_NOISE:  rounding-level deltas inside tolerance -> 0 violations
 *   - EGREGIOUS:    every checkable rule broken by a large
 *                   delta                                  -> every rule fires
 *
 * This does NOT flip RECONCILE_ENFORCE (stays false / shadow mode) — it only
 * proves the tolerance constants are sane before a real DBR77 pack arrives.
 */
import { describe, expect, it } from 'vitest';

import { reconcileStatements } from '../../../server/src/services/reconciliationService.js';
import {
  buildCleanPack,
  buildEgregiousPack,
  buildMinorNoisePack,
} from '../../../server/src/services/__harness__/reconcileCalibration.js';

// Rules that require only the current (2nd) period's own data or a prior
// period to compare against; both synthetic packs supply exactly 2 periods,
// so period[1]'s checks are the meaningful ones (period[0] mostly `skipped`
// — no prior period of its own, which is legal per spec §4.4).
function currentPeriodChecks(result: ReturnType<typeof reconcileStatements>) {
  return result.checks.slice(result.checks.length / 2);
}

describe('reconcileCalibration (R1-R8 shadow-mode calibration)', () => {
  it('CLEAN pack: statements tie out exactly -> zero warnings/failures', () => {
    const result = reconcileStatements(buildCleanPack());
    const checks = currentPeriodChecks(result);

    expect(result.summary.failed).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.overallStatus).toBe('pass');
    expect(result.blocksReady).toBe(false);

    for (const c of checks) {
      expect(c.status === 'pass' || c.status === 'skipped').toBe(true);
    }
  });

  it('MINOR_NOISE pack: rounding-level deltas inside tolerance -> zero violations (no false positives)', () => {
    const result = reconcileStatements(buildMinorNoisePack());
    const checks = currentPeriodChecks(result);

    expect(result.summary.failed).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.overallStatus).toBe('pass');

    for (const c of checks) {
      expect(c.status === 'pass' || c.status === 'skipped').toBe(true);
      // Every non-skipped check must have actually seen a non-zero delta —
      // otherwise this pack degenerated back into the CLEAN pack and would
      // not be exercising the tolerance band at all.
      if (c.status === 'pass' && c.difference !== null) {
        expect(Math.abs(c.difference)).toBeGreaterThan(0);
      }
    }
  });

  it('EGREGIOUS pack: every checkable R1-R8 rule fires (no false negatives)', () => {
    const result = reconcileStatements(buildEgregiousPack());
    const checks = currentPeriodChecks(result);

    // The 3 error-severity checks (R1, R2, R3) must FAIL outright.
    const errorCodes = ['R1_BS_EQUATION', 'R2_CASH_TIEOUT', 'R3_NET_INCOME_TIE'];
    for (const code of errorCodes) {
      const check = checks.find((c) => c.checkCode === code);
      expect(check, `expected ${code} to be present`).toBeDefined();
      expect(check!.status).toBe('fail');
    }

    // The warning-severity checks must all fire as WARNING (never silently pass).
    const warningCodes = [
      'R4_DEPRECIATION_CONSISTENCY',
      'R4_PPE_ROLLFORWARD',
      'R5_DEBT_ROLLFORWARD',
      'R5_INTEREST_SANITY',
      'R6_WC_BRIDGE',
      'R7_PERIOD_CONTINUITY',
      'R8_SIGN_MAGNITUDE_SANITY',
    ];
    for (const code of warningCodes) {
      const check = checks.find((c) => c.checkCode === code);
      expect(check, `expected ${code} to be present`).toBeDefined();
      expect(check!.status).toBe('warning');
    }

    expect(result.overallStatus).toBe('fail');
    // blocksReady reflects what WOULD block if RECONCILE_ENFORCE were flipped on.
    expect(result.blocksReady).toBe(true);
  });

  it('shadow mode: reconcile never blocks readiness regardless of pack quality', () => {
    // shouldBlockReady() is the only gate callers may consult; it must return
    // false while RECONCILE_ENFORCE is off, even for the egregious pack.
    // (Imported lazily to assert the current module-level constant.)
    return import('../../../server/src/services/reconciliationService.js').then(
      ({ shouldBlockReady, RECONCILE_ENFORCE }) => {
        expect(RECONCILE_ENFORCE).toBe(false);
        const egregiousResult = reconcileStatements(buildEgregiousPack());
        expect(shouldBlockReady(egregiousResult)).toBe(false);
      }
    );
  });
});
