// @vitest-environment node
/**
 * W10.1 — bundleQualityScorecard: agregat sygnałów jakości w jeden wynik + ocena.
 */
import { describe, expect, it } from 'vitest';
import { buildQualityScorecard } from '../../../server/src/services/deliverables/bundleQualityScorecard';
import type { BundleQuality } from '../../../server/src/services/deliverables/bundleGenerationRuntime';

// Pełny „zdrowy" quality (wszystkie wymiary dobre).
function healthyQuality(): BundleQuality {
  return {
    beauty: { overall: 0.9, diversity: 0.9, balance: 0.9, framing: 0.9, passed: true, issues: [] } as any,
    content: { passed: true, placeholderHits: [], heroNumberMismatches: [], issues: [] } as any,
    factContradictions: [],
    provenance: null,
    variants: null,
    docQa: { anyBlocking: false, overallScore: 88, blockingCategories: [], categoryScores: {}, highFindings: 0 },
    deckQa: { valid: true, errorCount: 0, warningCount: 1, topViolations: [] },
    antiPatterns: { passed: true, criticalCount: 0, warningCount: 1, hits: [] },
    designCritique: { slides: [], overallScore: 92, regenerateSlides: [], passed: true },
    passed: true,
  };
}

describe('W10.1 — zdrowy materiał', () => {
  it('wysokie wyniki → ocena A/B, brak capa', () => {
    const card = buildQualityScorecard(healthyQuality());
    expect(card.overall).toBeGreaterThanOrEqual(80);
    expect(['A', 'B']).toContain(card.grade);
    expect(card.capped).toBe(false);
    expect(card.capReasons).toEqual([]);
  });

  it('7 wymiarów obecnych', () => {
    const card = buildQualityScorecard(healthyQuality());
    expect(card.dimensions).toHaveLength(7);
    expect(card.dimensions.every((d) => d.score !== null)).toBe(true);
  });
});

describe('W10.1 — twarde capy (krytyczne wady)', () => {
  it('content FAIL → cap ≤59 (D/F) mimo dobrych innych', () => {
    const q = healthyQuality();
    q.content = { passed: false, placeholderHits: [{ pattern: 'TBD', context: 'x', format: 'deck' }], heroNumberMismatches: [] } as any;
    const card = buildQualityScorecard(q);
    expect(card.capped).toBe(true);
    expect(card.overall).toBeLessThanOrEqual(59);
    expect(card.capReasons.some((r) => r.includes('Content gate'))).toBe(true);
  });

  it('fact contradiction → cap + powód', () => {
    const q = healthyQuality();
    q.factContradictions = [{ detail: 'Revenue 8M vs 9M' } as any];
    const card = buildQualityScorecard(q);
    expect(card.capped).toBe(true);
    expect(card.overall).toBeLessThanOrEqual(59);
  });

  it('krytyczny anti-pattern decka → cap', () => {
    const q = healthyQuality();
    q.antiPatterns = { passed: false, criticalCount: 1, warningCount: 0, hits: [{ code: 'AP-05-NO-COVER', severity: 'CRITICAL', slideIndex: 0, message: 'brak cover' }] };
    const card = buildQualityScorecard(q);
    expect(card.capped).toBe(true);
    expect(card.overall).toBeLessThanOrEqual(59);
    expect(card.topIssues.some((i) => i.includes('AP-05'))).toBe(true);
  });

  it('design critique regen → cap z listą slajdów', () => {
    const q = healthyQuality();
    q.designCritique = { slides: [], overallScore: 50, regenerateSlides: [3, 5], passed: false };
    const card = buildQualityScorecard(q);
    expect(card.capped).toBe(true);
    expect(card.capReasons.some((r) => r.includes('3, 5'))).toBe(true);
  });
});

describe('W10.1 — renormalizacja brakujących wymiarów', () => {
  it('tylko content+beauty obecne → liczy z 2 wymiarów', () => {
    const q: BundleQuality = {
      beauty: { overall: 0.8, passed: true } as any,
      content: { passed: true, placeholderHits: [], heroNumberMismatches: [] } as any,
      factContradictions: [],
      provenance: null, variants: null, docQa: null, deckQa: null,
      antiPatterns: null, designCritique: null, passed: true,
    };
    const card = buildQualityScorecard(q);
    // content=100, beauty=80 → renormalizacja, brak capa
    expect(card.overall).toBeGreaterThan(0);
    expect(card.capped).toBe(false);
    const present = card.dimensions.filter((d) => d.score !== null);
    expect(present.map((d) => d.key).sort()).toEqual(['beauty', 'content', 'factual']);
  });

  it('null quality → F, capped', () => {
    const card = buildQualityScorecard(null);
    expect(card.grade).toBe('F');
    expect(card.overall).toBe(0);
    expect(card.capped).toBe(true);
  });
});

describe('W10.1 — oceny literowe', () => {
  it('progi A≥90, B≥80, C≥70, D≥60, F<60', () => {
    // wszystko 95 → A
    const q = healthyQuality();
    q.beauty = { overall: 0.95, passed: true } as any;
    q.docQa = { anyBlocking: false, overallScore: 95, blockingCategories: [], categoryScores: {}, highFindings: 0 };
    q.designCritique = { slides: [], overallScore: 95, regenerateSlides: [], passed: true };
    q.deckQa = { valid: true, errorCount: 0, warningCount: 0, topViolations: [] };
    q.antiPatterns = { passed: true, criticalCount: 0, warningCount: 0, hits: [] };
    const card = buildQualityScorecard(q);
    expect(card.overall).toBeGreaterThanOrEqual(90);
    expect(card.grade).toBe('A');
  });
});

describe('W10.1 — topIssues actionable', () => {
  it('zbiera hero-mismatch + anti-pattern do listy napraw', () => {
    const q = healthyQuality();
    q.content = {
      passed: false, placeholderHits: [],
      heroNumberMismatches: [{ key: 'revenue_last', expected: '8 800 tys', foundVariants: ['8 200 tys', '9 000 tys'] }],
    } as any;
    const card = buildQualityScorecard(q);
    expect(card.topIssues.some((i) => i.includes('revenue_last'))).toBe(true);
    expect(card.topIssues.length).toBeLessThanOrEqual(10);
  });
});
