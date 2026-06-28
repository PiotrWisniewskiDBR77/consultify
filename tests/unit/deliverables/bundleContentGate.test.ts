// @vitest-environment node
/**
 * Unit tests — bundleContentGate (F1.4)
 *
 * CG-1: placeholder scanner
 * CG-2: hero-number consistency
 * CG-3: clean bundle passes
 * CG-4: fail-open on error
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runBundleContentGate } from '../../../server/src/services/deliverables/bundleContentGate.js';

// ── CG-1: placeholder patterns ────────────────────────────────────────────

describe('bundleContentGate — placeholder scanner', () => {
  it('CG-1.1: detects [PLACEHOLDER] in deck text', () => {
    const result = runBundleContentGate({ deckText: 'Revenue grew 40% [PLACEHOLDER] last year' });
    expect(result.passed).toBe(false);
    expect(result.placeholderHits.length).toBeGreaterThan(0);
    expect(result.placeholderHits[0].format).toBe('deck');
    expect(result.issues.some((i) => i.includes('placeholder'))).toBe(true);
  });

  it('CG-1.2: detects TBD in report text', () => {
    const result = runBundleContentGate({ reportText: 'Market size TBD, competitive landscape below' });
    expect(result.passed).toBe(false);
    expect(result.placeholderHits.some((h) => h.format === 'report')).toBe(true);
  });

  it('CG-1.3: detects LOREM in table text', () => {
    const result = runBundleContentGate({ tableText: 'Lorem ipsum dolor sit amet' });
    expect(result.passed).toBe(false);
    expect(result.placeholderHits.some((h) => h.format === 'table')).toBe(true);
  });

  it('CG-1.4: detects AWAITING CONTENT', () => {
    const result = runBundleContentGate({ deckText: 'Slide 3: AWAITING CONTENT from analyst' });
    expect(result.passed).toBe(false);
  });

  it('CG-1.5: clean text with no placeholders passes', () => {
    const result = runBundleContentGate({
      deckText: 'Revenue grew 40% YoY to €4.2M in FY2025',
      reportText: 'Our GTM strategy targets SME segment with land-and-expand motion',
      tableText: 'Q1,Q2,Q3,Q4\n1200000,1450000,1700000,2100000',
    });
    expect(result.passed).toBe(true);
    expect(result.placeholderHits).toHaveLength(0);
  });
});

// ── CG-2: hero-number consistency ────────────────────────────────────────

describe('bundleContentGate — hero-number consistency', () => {
  const heroNumbers = [
    { key: 'revenue_y3', label: 'Revenue Year 3', formatted: '€12.4M' },
    { key: 'ask', label: 'Funding Ask', formatted: '€2.5M' },
  ];

  it('CG-2.1: consistent hero numbers pass', () => {
    const result = runBundleContentGate(
      {
        deckText: 'Revenue Year 3 target: €12.4M',
        reportText: 'Funding Ask is €2.5M to reach breakeven',
      },
      heroNumbers
    );
    // no mismatches
    expect(result.heroNumberMismatches).toHaveLength(0);
  });

  it('CG-2.2: empty bundle (no text) passes — nothing to contradict', () => {
    const result = runBundleContentGate({}, heroNumbers);
    expect(result.passed).toBe(true);
  });
});

// ── CG-3: combined clean bundle ───────────────────────────────────────────

describe('bundleContentGate — combined', () => {
  it('CG-3.1: professional content with hero numbers — passes gate', () => {
    const heroNumbers = [
      { key: 'tam', label: 'TAM', formatted: '€1.2B' },
    ];
    const result = runBundleContentGate(
      {
        deckText: 'TAM is €1.2B growing at 18% CAGR driven by digital transformation',
        reportText: 'Our addressable market (TAM) of €1.2B is validated by Gartner 2024',
        tableText: 'Metric,Value\nTAM,1200000000\nSAM,120000000',
      },
      heroNumbers
    );
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('CG-3.2: TODO in one format fails the whole gate', () => {
    const result = runBundleContentGate({
      deckText: 'Strong revenue growth YoY',
      reportText: '[TODO: add competitive analysis section]',
      tableText: 'Clean data',
    });
    expect(result.passed).toBe(false);
    expect(result.placeholderHits.some((h) => h.format === 'report')).toBe(true);
  });
});

// ── CG-4: fail-open ───────────────────────────────────────────────────────

describe('bundleContentGate — fail-open', () => {
  it('CG-4.1: passes with undefined inputs (empty bundle)', () => {
    expect(() => runBundleContentGate({})).not.toThrow();
    const result = runBundleContentGate({});
    expect(result.passed).toBe(true);
  });
});

// ── CG-5: per-deck L1 wiring — JSON.stringified discriminated-union slides ──
// presentationGeneratorService.generateDeck builds deckText by JSON.stringify-ing
// each slide's `content` (17-variant union) instead of hand-mapping every shape.
// These tests guard that approach: a placeholder buried in ANY content variant
// still surfaces through the stringified scan.

describe('bundleContentGate — per-deck L1 stringified-content scan', () => {
  const slideToText = (slides: Array<{ key_message: string; content: unknown }>): string =>
    slides
      .map((s) => [s.key_message, JSON.stringify(s.content ?? '')].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('\n');

  it('CG-5.1: placeholder inside executive_summary.key_findings is caught', () => {
    const deckText = slideToText([
      {
        key_message: 'Transformation thesis',
        content: {
          type: 'executive_summary',
          headline: 'AI readiness assessment',
          key_findings: ['Strong data foundation', 'TBD'],
        },
      },
    ]);
    const result = runBundleContentGate({ deckText });
    expect(result.passed).toBe(false);
    expect(result.placeholderHits.some((h) => h.format === 'deck')).toBe(true);
  });

  it('CG-5.2: AWAITING CONTENT in a key_messages slide is caught (premium-off leak)', () => {
    const deckText = slideToText([
      {
        key_message: 'Key moves',
        content: {
          type: 'key_messages',
          messages: [{ title: 'Move 1', description: 'AWAITING CONTENT' }],
        },
      },
    ]);
    const result = runBundleContentGate({ deckText });
    expect(result.passed).toBe(false);
  });

  it('CG-5.3: a fully-populated deck passes (no false positive on real content)', () => {
    const deckText = slideToText([
      {
        key_message: 'Market opportunity',
        content: {
          type: 'single_insight',
          chart_type: 'bar',
          chart_data: { labels: ['2024', '2025'], series: [{ name: 'ARR', data: [1.2, 3.4] }] },
          insight_text: 'ARR scales from €1.2M to €3.4M within 18 months',
        },
      },
    ]);
    const result = runBundleContentGate({ deckText });
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
