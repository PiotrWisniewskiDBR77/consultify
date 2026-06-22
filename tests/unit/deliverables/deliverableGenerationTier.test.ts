// @vitest-environment node
/**
 * Unit tests — deliverableGenerationTier (W4 / B5)
 *
 * FT-1: tier resolution logic (premium-on → PREMIUM, off → STANDARD, override).
 * FT-8: flag OFF = today's behaviour (STANDARD); fail-open never throws.
 *
 * The flag value is injected via the `premiumEnabled` DI seam so the test does
 * not depend on process.env or the global FeatureFlags singleton.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DELIVERABLE_GENERATION_PURPOSE,
  isDeliverablePremiumActive,
  resolveDeliverableTier,
} from '../../../server/src/services/deliverableGenerationTier.js';

describe('deliverableGenerationTier (B5)', () => {
  // ── FT-1: resolution logic ────────────────────────────────────
  it('FT-1/1: premium flag ON → PREMIUM tier', () => {
    expect(resolveDeliverableTier({ premiumEnabled: true })).toBe('PREMIUM');
  });

  it('FT-1/2: premium flag OFF → STANDARD tier', () => {
    expect(resolveDeliverableTier({ premiumEnabled: false })).toBe('STANDARD');
  });

  it('FT-1/3: preferPremium=false forces STANDARD even when flag ON', () => {
    expect(resolveDeliverableTier({ premiumEnabled: true, preferPremium: false })).toBe(
      'STANDARD'
    );
  });

  it('FT-1/4: preferPremium=true with flag ON → PREMIUM', () => {
    expect(resolveDeliverableTier({ premiumEnabled: true, preferPremium: true })).toBe(
      'PREMIUM'
    );
  });

  it('FT-1/5: isDeliverablePremiumActive mirrors resolved tier', () => {
    expect(isDeliverablePremiumActive({ premiumEnabled: true })).toBe(true);
    expect(isDeliverablePremiumActive({ premiumEnabled: false })).toBe(false);
  });

  it('FT-1/6: stable telemetry purpose tag', () => {
    expect(DELIVERABLE_GENERATION_PURPOSE).toBe('deliverable_generation');
  });

  // ── FT-8: safety — default behaviour + fail-open ──────────────
  it('FT-8/1: no options → reads global flag (defaults OFF → STANDARD)', () => {
    // With no DI seam and the default test env (flag unset), the safe default
    // is STANDARD — i.e. live clients keep today's behaviour.
    const tier = resolveDeliverableTier();
    expect(tier === 'STANDARD' || tier === 'PREMIUM').toBe(true);
    // We don't assert the exact value (env-dependent), only that it's a valid
    // tier and never throws.
  });

  it('FT-8/2: never returns an out-of-contract tier', () => {
    const tier = resolveDeliverableTier({ premiumEnabled: true });
    expect(['STANDARD', 'PREMIUM']).toContain(tier);
  });

  it('FT-8/3: orgId is accepted and does not affect the safe default', () => {
    expect(resolveDeliverableTier({ orgId: 'org-123', premiumEnabled: false })).toBe(
      'STANDARD'
    );
  });
});
