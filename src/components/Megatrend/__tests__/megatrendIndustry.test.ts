import { describe, expect, it } from 'vitest';

import { DEFAULT_MEGATREND_INDUSTRY, resolveDefaultMegatrendIndustry } from '../megatrendIndustry';

/**
 * F3b (pomiar DEC-463, 2026-09-10): MegatrendsWorkspace used to hardcode
 * `useState('automotive')` for every organization. This locks in the
 * replacement default: the org's own industry, trimmed, falling back to
 * 'general' — and specifically NEVER 'automotive' as a silent default.
 */
describe('resolveDefaultMegatrendIndustry (F3b / DEC-463)', () => {
  it('uses the organization industry as-is when present', () => {
    expect(resolveDefaultMegatrendIndustry('Industrial Manufacturing')).toBe(
      'Industrial Manufacturing'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDefaultMegatrendIndustry('  financial  ')).toBe('financial');
  });

  it('falls back to general (never automotive) when industry is null', () => {
    expect(resolveDefaultMegatrendIndustry(null)).toBe(DEFAULT_MEGATREND_INDUSTRY);
    expect(resolveDefaultMegatrendIndustry(null)).not.toBe('automotive');
  });

  it('falls back to general when industry is undefined', () => {
    expect(resolveDefaultMegatrendIndustry(undefined)).toBe('general');
  });

  it('falls back to general when industry is blank/whitespace-only', () => {
    expect(resolveDefaultMegatrendIndustry('   ')).toBe('general');
    expect(resolveDefaultMegatrendIndustry('')).toBe('general');
  });

  it('does not attempt to validate the industry against a known catalog', () => {
    // Exact-match-else-general is the SERVER's job (it owns the megatrends
    // table); this helper only decides the client's *first guess*.
    expect(resolveDefaultMegatrendIndustry('edtech manufacturing')).toBe('edtech manufacturing');
  });
});
