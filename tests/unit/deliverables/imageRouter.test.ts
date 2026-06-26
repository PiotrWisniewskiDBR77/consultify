// @vitest-environment node
/**
 * Unit tests — imageRouter (F9.1 + F9.3)
 *
 * IR-1: content-type routing (text→Ideogram, vector→Recraft, photo→stock)
 * IR-2: package limits (Lite caps at T1, downgrade flag)
 * IR-3: fallback chain (descends to stock)
 * IR-4: credits
 */

import { describe, expect, it } from 'vitest';
import {
  routeImage,
  totalCreditCost,
  TIER_CREDIT_COST,
} from '../../../server/src/services/deliverables/imageRouter.js';

describe('imageRouter', () => {
  // ── IR-1: content-type routing ──
  it('IR-1.1: text_in_image (Pro) → Ideogram at T3', () => {
    const r = routeImage({ contentType: 'text_in_image', package: 'pro' });
    expect(r.tier).toBe('T3');
    expect(r.provider).toBe('ideogram');
  });

  it('IR-1.2: vector_logo (Pro) → Recraft at T3', () => {
    const r = routeImage({ contentType: 'vector_logo', package: 'pro' });
    expect(r.tier).toBe('T3');
    expect(r.provider).toBe('recraft');
  });

  it('IR-1.3: photo → stock-first (T0, unsplash, free)', () => {
    const r = routeImage({ contentType: 'photo', package: 'pro' });
    expect(r.tier).toBe('T0');
    expect(r.provider).toBe('unsplash');
    expect(r.creditCost).toBe(0);
  });

  it('IR-1.4: data_viz → chart engine route (not image gen)', () => {
    const r = routeImage({ contentType: 'data_viz', package: 'pro' });
    expect(r.isChartRoute).toBe(true);
    expect(r.provider).toBe('chart-engine');
    expect(r.creditCost).toBe(0);
  });

  // ── IR-2: package limits ──
  it('IR-2.1: Lite caps text_in_image (T3 wanted) down to T1 + downgraded flag', () => {
    const r = routeImage({ contentType: 'text_in_image', package: 'lite' });
    expect(r.tier).toBe('T1');
    expect(r.downgraded).toBe(true);
  });

  it('IR-2.2: Lite photo stays T0 (no downgrade needed)', () => {
    const r = routeImage({ contentType: 'photo', package: 'lite' });
    expect(r.tier).toBe('T0');
    expect(r.downgraded).toBe(false);
  });

  it('IR-2.3: preferTier honored within package, clamped beyond it', () => {
    const pro = routeImage({ contentType: 'photo', package: 'pro', preferTier: 'T2' });
    expect(pro.tier).toBe('T2');
    expect(pro.downgraded).toBe(false);

    const lite = routeImage({ contentType: 'photo', package: 'lite', preferTier: 'T2' });
    expect(lite.tier).toBe('T1'); // clamped to lite max
    expect(lite.downgraded).toBe(true);
  });

  // ── IR-3: fallback ──
  it('IR-3.1: fallback chain descends to stock (T0 last)', () => {
    const r = routeImage({ contentType: 'vector_logo', package: 'pro' }); // T3
    // fallback should descend T2 → T1 → T0
    expect(r.fallbackChain.length).toBe(3);
    expect(r.fallbackChain[r.fallbackChain.length - 1]).toBe('unsplash'); // T0 stock
  });

  it('IR-3.2: T0 route has empty fallback (already the floor)', () => {
    const r = routeImage({ contentType: 'photo', package: 'pro' });
    expect(r.fallbackChain).toHaveLength(0);
  });

  // ── IR-4: credits ──
  it('IR-4.1: tier credit costs ascend T0<T1<T2<T3', () => {
    expect(TIER_CREDIT_COST.T0).toBe(0);
    expect(TIER_CREDIT_COST.T1).toBeLessThan(TIER_CREDIT_COST.T2);
    expect(TIER_CREDIT_COST.T2).toBeLessThan(TIER_CREDIT_COST.T3);
  });

  it('IR-4.2: totalCreditCost sums a deck of routes', () => {
    const routes = [
      routeImage({ contentType: 'photo', package: 'pro' }),       // 0
      routeImage({ contentType: 'text_in_image', package: 'pro' }), // 8
      routeImage({ contentType: 'illustration', package: 'pro' }),  // 1
    ];
    expect(totalCreditCost(routes)).toBe(TIER_CREDIT_COST.T0 + TIER_CREDIT_COST.T3 + TIER_CREDIT_COST.T1);
  });
});
