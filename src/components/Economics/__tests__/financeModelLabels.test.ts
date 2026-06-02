/**
 * Tests for financeModelLabels — the pure derivation + Teresa-prelude helpers
 * that replaced the hardcoded model summary strings (PLAN_08b P0-A / P0-D).
 */

import { describe, expect, it } from 'vitest';

import {
  buildFinanceTeresaPrompt,
  deriveAnalyticalDepthLabel,
  deriveForecastWindowLabel,
  deriveVariantLabel,
} from '../financeModelLabels';

// Mirror the i18n contract: t(key, fallback) returns the fallback string.
const t = (_key: string, fallback: string) => fallback;

describe('deriveVariantLabel', () => {
  it('localises the real scenario field (base / optimistic / conservative)', () => {
    expect(deriveVariantLabel('base', t)).toBe('Base');
    expect(deriveVariantLabel('optimistic', t)).toBe('Optimistic');
    expect(deriveVariantLabel('conservative', t)).toBe('Conservative');
  });

  it('is case-insensitive on the scenario value', () => {
    expect(deriveVariantLabel('OPTIMISTIC', t)).toBe('Optimistic');
  });

  it('falls back to the raw value for unknown scenarios, never a hardcoded placeholder', () => {
    expect(deriveVariantLabel('stress', t)).toBe('stress');
    expect(deriveVariantLabel('base', t)).not.toBe('base / optimistic / conservative');
  });

  it('defaults to Base when scenario is missing', () => {
    expect(deriveVariantLabel(null, t)).toBe('Base');
    expect(deriveVariantLabel(undefined, t)).toBe('Base');
  });
});

describe('deriveAnalyticalDepthLabel', () => {
  it('maps event_count to L1/L2/L3 thresholds', () => {
    expect(deriveAnalyticalDepthLabel(0, t)).toBe('L1 (light)');
    expect(deriveAnalyticalDepthLabel(4, t)).toBe('L1 (light)');
    expect(deriveAnalyticalDepthLabel(5, t)).toBe('L2 (standard)');
    expect(deriveAnalyticalDepthLabel(9, t)).toBe('L2 (standard)');
    expect(deriveAnalyticalDepthLabel(10, t)).toBe('L3 (deep)');
    expect(deriveAnalyticalDepthLabel(25, t)).toBe('L3 (deep)');
  });

  it('never returns the old hardcoded "L1-L3" placeholder', () => {
    expect(deriveAnalyticalDepthLabel(3, t)).not.toBe('L1-L3');
  });

  it('treats missing event_count as zero (L1)', () => {
    expect(deriveAnalyticalDepthLabel(undefined, t)).toBe('L1 (light)');
    expect(deriveAnalyticalDepthLabel(null, t)).toBe('L1 (light)');
  });
});

describe('deriveForecastWindowLabel', () => {
  it('derives end year from start year + ceil(horizon_months / 12)', () => {
    expect(deriveForecastWindowLabel('2015-01-01', 36)).toBe('2015-2018');
    expect(deriveForecastWindowLabel('2015-03-01', 30)).toBe('2015-2018'); // ceil(30/12) = 3
    expect(deriveForecastWindowLabel('2020-01-01', 60)).toBe('2020-2025');
  });

  it('falls back to a 2-year window when horizon is 0 / missing', () => {
    expect(deriveForecastWindowLabel('2015-01-01', 0)).toBe('2015-2017');
    expect(deriveForecastWindowLabel('2015-01-01', undefined)).toBe('2015-2017');
  });

  it('falls back to the current year when start_date is unparseable', () => {
    const year = new Date().getFullYear();
    expect(deriveForecastWindowLabel('', 24)).toBe(`${year}-${year + 2}`);
  });
});

describe('buildFinanceTeresaPrompt', () => {
  it('returns a model-aware business-case prompt for model/prediction rows', () => {
    expect(buildFinanceTeresaPrompt('models', t)).toMatch(/NPV\/ROI\/payback/);
    expect(buildFinanceTeresaPrompt('prediction', t)).toMatch(/NPV\/ROI\/payback/);
  });

  it('returns a generic financial-deliverable prompt for non-model entities', () => {
    const prompt = buildFinanceTeresaPrompt('statements', t);
    expect(prompt).toMatch(/financial deliverable/);
    expect(prompt).not.toMatch(/NPV\/ROI\/payback/);
  });
});
