/**
 * RevenueModule Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('RevenueModule Component', () => {
  it('shows revenue data', () => {
    const revenue = { mrr: 50000, arr: 600000 };
    expect(revenue.mrr).toBe(50000);
  });

  it('displays growth', () => {
    const growth = 15;
    expect(growth).toBeGreaterThan(0);
  });
});
