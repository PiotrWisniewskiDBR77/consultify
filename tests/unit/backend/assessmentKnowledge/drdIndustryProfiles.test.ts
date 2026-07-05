/**
 * Structural tests for DRD industry reference profiles (Canon §8.2, expert hypothesis v1).
 *
 * Guards:
 * - all 3 industries present, each with the full set of 8 dimensions (D1–D8)
 * - all benchmark values within the I–V range (1..5)
 * - leader >= typical for every industry × dimension
 * - source tag and disclaimers present (must render with every profile)
 */
import { describe, expect, it } from 'vitest';

import {
  DRD_DIMENSION_IDS,
  DRD_INDUSTRY_IDS,
  DRD_INDUSTRY_PROFILES,
  DRD_REFERENCE_LEVEL_MAX,
  DRD_REFERENCE_LEVEL_MIN,
  DRD_REFERENCE_LEVEL_ROMAN,
  getDRDIndustryProfile,
} from '@/services/assessmentKnowledge/drdIndustryProfiles';

describe('DRD industry reference profiles (expert-hypothesis-v1)', () => {
  it('defines exactly 3 industries with unique ids matching the canonical list', () => {
    expect(DRD_INDUSTRY_PROFILES).toHaveLength(3);
    const ids = DRD_INDUSTRY_PROFILES.map((p) => p.industry);
    expect(new Set(ids).size).toBe(3);
    expect([...ids].sort()).toEqual([...DRD_INDUSTRY_IDS].sort());
    expect([...DRD_INDUSTRY_IDS].sort()).toEqual(
      ['discrete-manufacturing', 'process-manufacturing', 'professional-services'].sort()
    );
  });

  it('covers all 8 reporting dimensions D1–D8 in every industry (no extras, no gaps)', () => {
    expect(DRD_DIMENSION_IDS).toHaveLength(8);
    for (const profile of DRD_INDUSTRY_PROFILES) {
      const keys = Object.keys(profile.dimensionBenchmarks);
      expect(keys.sort()).toEqual([...DRD_DIMENSION_IDS].sort());
    }
  });

  it('keeps every typical/leader value within the I–V range (1..5, integers)', () => {
    for (const profile of DRD_INDUSTRY_PROFILES) {
      for (const dimensionId of DRD_DIMENSION_IDS) {
        const benchmark = profile.dimensionBenchmarks[dimensionId];
        for (const value of [benchmark.typical, benchmark.leader]) {
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(DRD_REFERENCE_LEVEL_MIN);
          expect(value).toBeLessThanOrEqual(DRD_REFERENCE_LEVEL_MAX);
        }
      }
    }
  });

  it('enforces leader >= typical for every industry × dimension', () => {
    for (const profile of DRD_INDUSTRY_PROFILES) {
      for (const dimensionId of DRD_DIMENSION_IDS) {
        const { typical, leader } = profile.dimensionBenchmarks[dimensionId];
        expect(
          leader,
          `${profile.industry} / ${dimensionId}: leader (${leader}) must be >= typical (${typical})`
        ).toBeGreaterThanOrEqual(typical);
      }
    }
  });

  it('tags every profile as expert-hypothesis-v1 with PL/EN disclaimer and narrative', () => {
    for (const profile of DRD_INDUSTRY_PROFILES) {
      expect(profile.source).toBe('expert-hypothesis-v1');
      expect(profile.disclaimer.pl.length).toBeGreaterThan(20);
      expect(profile.disclaimer.en.length).toBeGreaterThan(20);
      expect(profile.disclaimer.pl).toContain('n ≥ 10');
      expect(profile.narrative.pl.length).toBeGreaterThan(100);
      expect(profile.narrative.en.length).toBeGreaterThan(100);
      expect(profile.label.pl.length).toBeGreaterThan(0);
      expect(profile.label.en.length).toBeGreaterThan(0);
    }
  });

  it('maps the numeric scale to Roman numerals I–V', () => {
    expect(DRD_REFERENCE_LEVEL_ROMAN[1]).toBe('I');
    expect(DRD_REFERENCE_LEVEL_ROMAN[5]).toBe('V');
    expect(Object.keys(DRD_REFERENCE_LEVEL_ROMAN)).toHaveLength(5);
  });

  it('getDRDIndustryProfile returns the profile and throws on unknown id', () => {
    expect(getDRDIndustryProfile('discrete-manufacturing').industry).toBe(
      'discrete-manufacturing'
    );
    expect(() =>
      getDRDIndustryProfile('space-mining' as Parameters<typeof getDRDIndustryProfile>[0])
    ).toThrow(/Unknown DRD industry profile/);
  });
});
