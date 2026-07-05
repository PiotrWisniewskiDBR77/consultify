/**
 * Task #110 (M16 Finanse — valuations polish).
 *
 * Guards the FE enum-label helpers that replaced raw enum rendering in the
 * valuation view (was `{v.status}` / `{v.sourceType}` — untranslated DRAFT /
 * budget / financial_model strings leaking to the UI).
 *
 * Contract mirrored: t(key, fallback) returns the fallback string.
 */
import { describe, expect, it } from 'vitest';

import {
  valuationSourceLabel,
  valuationStatusLabel,
} from '@/components/Benefits/ValuationWorkspace';

const t = (_key: string, fallback: string) => fallback;

describe('valuationStatusLabel', () => {
  it('localizes the three canonical statuses', () => {
    expect(valuationStatusLabel('DRAFT', t)).toBe('Draft');
    expect(valuationStatusLabel('REVIEW', t)).toBe('In review');
    expect(valuationStatusLabel('APPROVED', t)).toBe('Approved');
  });

  it('is case-insensitive on the raw enum value', () => {
    expect(valuationStatusLabel('approved', t)).toBe('Approved');
    expect(valuationStatusLabel(' Review ', t)).toBe('In review');
  });

  it('never leaks a raw known enum token to the UI', () => {
    // The whole point of the fix: no bare "APPROVED"/"REVIEW" reaches render.
    expect(valuationStatusLabel('APPROVED', t)).not.toBe('APPROVED');
    expect(valuationStatusLabel('REVIEW', t)).not.toBe('REVIEW');
  });

  it('defaults to Draft for null / undefined / empty', () => {
    expect(valuationStatusLabel(null, t)).toBe('Draft');
    expect(valuationStatusLabel(undefined, t)).toBe('Draft');
    expect(valuationStatusLabel('', t)).toBe('Draft');
  });

  it('falls back to the raw (uppercased) value for unknown statuses instead of a placeholder', () => {
    expect(valuationStatusLabel('archived', t)).toBe('ARCHIVED');
  });
});

describe('valuationSourceLabel', () => {
  it('localizes the known source types', () => {
    expect(valuationSourceLabel('budget', t)).toBe('Budget');
    expect(valuationSourceLabel('financial_model', t)).toBe('Financial model');
    expect(valuationSourceLabel('financial_analysis', t)).toBe('Financial analysis');
    expect(valuationSourceLabel('manual', t)).toBe('Manual');
  });

  it('is case-insensitive', () => {
    expect(valuationSourceLabel('BUDGET', t)).toBe('Budget');
    expect(valuationSourceLabel('Financial_Model', t)).toBe('Financial model');
  });

  it('never leaks the raw snake_case enum for known types', () => {
    expect(valuationSourceLabel('financial_model', t)).not.toBe('financial_model');
  });

  it('preserves an unknown raw value rather than dropping it', () => {
    expect(valuationSourceLabel('acquisition', t)).toBe('acquisition');
  });

  it('defaults to Manual for null / undefined', () => {
    expect(valuationSourceLabel(null, t)).toBe('Manual');
    expect(valuationSourceLabel(undefined, t)).toBe('Manual');
  });
});
