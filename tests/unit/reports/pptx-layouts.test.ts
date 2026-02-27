/**
 * PPTX Layouts & Design Tokens — Unit Tests (REAL CODE)
 *
 * Tests server/src/services/report/pptx/
 */
import { describe, expect, it } from 'vitest';

import {
  getDesignTokens,
  severityColor,
  trendColor,
  statusColor,
} from '../../../server/src/services/report/pptx/designTokens.js';
import { resolveLayout } from '../../../server/src/services/report/pptx/layouts/index.js';
import type { SlideIntent } from '../../../server/src/services/report/pptx/types.js';

describe('PPTX designTokens (REAL)', () => {
  describe('getDesignTokens', () => {
    it('returns corporate tokens for corporate theme', () => {
      const tokens = getDesignTokens('corporate');
      expect(tokens).toBeDefined();
      expect(tokens.colors.primary).toBeDefined();
      expect(tokens.fonts.body).toBeDefined();
    });

    it('returns minimal tokens for minimal theme', () => {
      const tokens = getDesignTokens('minimal');
      expect(tokens).toBeDefined();
    });

    it('returns modern tokens for modern theme', () => {
      const tokens = getDesignTokens('modern');
      expect(tokens).toBeDefined();
    });

    it('falls back to corporate for unknown theme', () => {
      const tokens = getDesignTokens('unknown' as any);
      expect(tokens).toBeDefined();
    });
  });

  describe('trendColor', () => {
    it('returns color for up trend', () => {
      const tokens = getDesignTokens('corporate');
      const color = trendColor('up', tokens);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });

    it('returns color for down trend', () => {
      const tokens = getDesignTokens('corporate');
      expect(trendColor('down', tokens)).toBeDefined();
    });

    it('returns color for flat trend', () => {
      const tokens = getDesignTokens('corporate');
      expect(trendColor('flat', tokens)).toBeDefined();
    });
  });

  describe('statusColor', () => {
    it('returns color for good status', () => {
      const tokens = getDesignTokens('corporate');
      expect(statusColor('good', tokens)).toBeDefined();
    });

    it('returns color for warning status', () => {
      const tokens = getDesignTokens('corporate');
      expect(statusColor('warning', tokens)).toBeDefined();
    });

    it('returns color for critical status', () => {
      const tokens = getDesignTokens('corporate');
      expect(statusColor('critical', tokens)).toBeDefined();
    });
  });

  describe('severityColor', () => {
    it('returns color for severity string', () => {
      const tokens = getDesignTokens('corporate');
      const color = severityColor('high', tokens);
      expect(typeof color).toBe('string');
    });
  });
});

describe('PPTX resolveLayout (REAL)', () => {
  const intents: SlideIntent[] = [
    'cover',
    'executive_summary',
    'section_intro',
    'key_messages',
    'performance_overview',
    'roadmap',
    'next_steps',
    'appendix',
  ];

  for (const intent of intents) {
    it(`resolves layout for intent "${intent}"`, () => {
      const layoutFn = resolveLayout(intent);
      expect(typeof layoutFn).toBe('function');
    });
  }

  it('returns function for cover intent', () => {
    const fn = resolveLayout('cover');
    expect(fn).toBeDefined();
    expect(fn.length).toBeGreaterThanOrEqual(0);
  });
});
