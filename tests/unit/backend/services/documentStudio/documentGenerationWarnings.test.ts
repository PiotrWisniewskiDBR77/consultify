/**
 * A4 — unit tests for the generation-warnings collector + normalizer.
 * Pure module, no mocks required.
 */
import { describe, expect, it } from 'vitest';

import {
  createDocumentGenerationWarningCollector,
  normalizeGenerationWarnings,
} from '../../../../../server/src/services/documentStudio/documentGenerationWarnings.js';

describe('documentGenerationWarnings collector', () => {
  it('records warnings and reports size + list snapshot', () => {
    const c = createDocumentGenerationWarningCollector();
    expect(c.size()).toBe(0);
    expect(c.list()).toEqual([]);

    c.record({ code: 'llm_prose_fallback', scope: 'document', message: 'llm down' });
    c.record({
      code: 'chart_raster_failed',
      scope: 'block',
      blockId: 'b1',
      message: 'no canvas',
    });

    expect(c.size()).toBe(2);
    const list = c.list();
    expect(list).toHaveLength(2);
    expect(list[0].code).toBe('llm_prose_fallback');
    expect(list[0].scope).toBe('document');
    expect(list[1].blockId).toBe('b1');
    // occurredAt auto-stamped as a valid ISO string.
    expect(() => new Date(list[0].occurredAt).toISOString()).not.toThrow();
    expect(Number.isNaN(Date.parse(list[0].occurredAt))).toBe(false);
  });

  it('preserves a caller-supplied occurredAt', () => {
    const c = createDocumentGenerationWarningCollector();
    c.record({
      code: 'logo_unavailable',
      scope: 'export',
      message: 'no logo',
      occurredAt: '2020-01-01T00:00:00.000Z',
    });
    expect(c.list()[0].occurredAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('list() returns a defensive copy (mutating it does not affect the collector)', () => {
    const c = createDocumentGenerationWarningCollector();
    c.record({ code: 'llm_prose_fallback', scope: 'document', message: 'x' });
    const first = c.list();
    first.pop();
    first[0]; // no-op
    expect(c.size()).toBe(1);
    expect(c.list()).toHaveLength(1);
  });

  it('omits optional sectionId / blockId when not provided', () => {
    const c = createDocumentGenerationWarningCollector();
    c.record({ code: 'llm_prose_fallback', scope: 'document', message: 'x' });
    const w = c.list()[0];
    expect('sectionId' in w).toBe(false);
    expect('blockId' in w).toBe(false);
  });
});

describe('normalizeGenerationWarnings', () => {
  it('returns [] for non-array / null / undefined input', () => {
    expect(normalizeGenerationWarnings(undefined)).toEqual([]);
    expect(normalizeGenerationWarnings(null)).toEqual([]);
    expect(normalizeGenerationWarnings('nope')).toEqual([]);
    expect(normalizeGenerationWarnings({})).toEqual([]);
  });

  it('drops structurally-invalid entries and keeps valid ones', () => {
    const raw = [
      { code: 'llm_prose_fallback', scope: 'document', message: 'ok', occurredAt: '2021-01-01T00:00:00.000Z' },
      { code: '', scope: 'document', message: 'empty code' }, // dropped
      { code: 'x', scope: 'not_a_scope', message: 'bad scope' }, // dropped
      { scope: 'export', message: 'missing code' }, // dropped
      { code: 'chart_raster_failed', scope: 'block', blockId: 'b7', message: 'chart' },
      42, // dropped
      null, // dropped
    ];
    const out = normalizeGenerationWarnings(raw);
    expect(out).toHaveLength(2);
    expect(out[0].code).toBe('llm_prose_fallback');
    expect(out[0].occurredAt).toBe('2021-01-01T00:00:00.000Z');
    expect(out[1].code).toBe('chart_raster_failed');
    expect(out[1].blockId).toBe('b7');
  });

  it('round-trips a recorded warning through JSON + normalize', () => {
    const c = createDocumentGenerationWarningCollector();
    c.record({ code: 'logo_unavailable', scope: 'export', message: 'no logo' });
    const serialized = JSON.parse(JSON.stringify(c.list()));
    const out = normalizeGenerationWarnings(serialized);
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('logo_unavailable');
    expect(out[0].scope).toBe('export');
  });
});
