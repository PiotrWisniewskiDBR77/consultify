// @vitest-environment node
/**
 * Unit tests — factBook (F10.1)
 *
 * FB-1: buildFactBook
 * FB-2: renderFactReferences ({{fact:key}} → canonical, identical everywhere)
 * FB-3: auditFactConsistency (contradiction detection, conservative)
 */

import { describe, expect, it } from 'vitest';
import {
  buildFactBook,
  renderFactReferences,
  auditFactConsistency,
} from '../../../server/src/services/deliverables/factBook.js';

const FACTS = [
  { key: 'revenue_y3', label: 'Revenue Year 3', formatted: '€12.0M', value: 12_000_000, unit: 'EUR' },
  { key: 'ltv_cac', label: 'LTV/CAC', formatted: '4.15×', value: 4.15 },
];

describe('factBook', () => {
  // ── FB-1 ──
  it('FB-1.1: buildFactBook indexes by key, skips invalid', () => {
    const fb = buildFactBook([...FACTS, { key: '', label: 'x', formatted: 'y' }]);
    expect(fb.size).toBe(2);
    expect(fb.get('revenue_y3')?.formatted).toBe('€12.0M');
  });

  // ── FB-2: the core consistency guarantee ──
  it('FB-2.1: {{fact:key}} → canonical formatted value', () => {
    const fb = buildFactBook(FACTS);
    const r = renderFactReferences('Target revenue is {{fact:revenue_y3}} by FY3.', fb);
    expect(r.text).toBe('Target revenue is €12.0M by FY3.');
    expect(r.unknownKeys).toHaveLength(0);
  });

  it('FB-2.2: same token in deck+report+table renders IDENTICALLY', () => {
    const fb = buildFactBook(FACTS);
    const deck = renderFactReferences('Rev {{fact:revenue_y3}}', fb).text;
    const report = renderFactReferences('Our revenue reaches {{fact:revenue_y3}} in year 3', fb).text;
    const table = renderFactReferences('{{fact:revenue_y3}}', fb).text;
    // the rendered value is byte-identical across all three surfaces
    expect(deck).toContain('€12.0M');
    expect(report).toContain('€12.0M');
    expect(table).toBe('€12.0M');
  });

  it('FB-2.3: unknown key left literal + reported', () => {
    const fb = buildFactBook(FACTS);
    const r = renderFactReferences('Mystery {{fact:bogus}} here', fb);
    expect(r.text).toBe('Mystery {{fact:bogus}} here');
    expect(r.unknownKeys).toEqual(['bogus']);
  });

  it('FB-2.4: handles multiple + whitespace tokens', () => {
    const fb = buildFactBook(FACTS);
    const r = renderFactReferences('{{ fact:revenue_y3 }} and {{fact:ltv_cac}}', fb);
    expect(r.text).toBe('€12.0M and 4.15×');
  });

  // ── FB-3: contradiction audit ──
  it('FB-3.1: flags a hardcoded number contradicting the canon', () => {
    const fb = buildFactBook(FACTS);
    // text says Revenue Year 3 is €15.9M but canon is €12.0M → contradiction
    const issues = auditFactConsistency(fb, 'Revenue Year 3 is projected at €15.9M total.');
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].key).toBe('revenue_y3');
    expect(issues[0].canonical).toBe('€12.0M');
    expect(issues[0].foundValue).toBe('15.9');
  });

  it('FB-3.2: no contradiction when canonical value is present', () => {
    const fb = buildFactBook(FACTS);
    const issues = auditFactConsistency(fb, 'Revenue Year 3 reaches €12.0M as planned.');
    expect(issues).toHaveLength(0);
  });

  it('FB-3.3: no false positive when label absent', () => {
    const fb = buildFactBook(FACTS);
    const issues = auditFactConsistency(fb, 'Some unrelated prose with 999 in it.');
    expect(issues).toHaveLength(0);
  });
});
