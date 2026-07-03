/**
 * Structural validation test for DRD q-bank Oxford O1 EN mirror (axes 5, 6 and 7)
 *
 * Checks:
 * 1. Exactly 85 override entries (5A-5E ×6 + 6A-6E ×6 + 7A-7E ×5)
 * 2. Unique keys (no duplicates)
 * 3. Full coverage of all expected area#level keys
 * 4. Each entry has exactly 3 non-empty questions
 * 5. Each entry has a non-empty example
 * 6. Each entry has a non-empty suggestedTechnologies array
 * 7. Key set is identical to the PL source file
 */

import { describe, it, expect } from 'vitest';
import { DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7.en';
import { DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7';

const AXIS_5_AREAS = ['5A', '5B', '5C', '5D', '5E'];
const AXIS_6_AREAS = ['6A', '6B', '6C', '6D', '6E'];
const AXIS_7_AREAS = ['7A', '7B', '7C', '7D', '7E'];
const LEVELS_6 = [1, 2, 3, 4, 5, 6];
const LEVELS_5 = [1, 2, 3, 4, 5];

function generateExpectedKeys(areas: string[], levels: number[]): string[] {
  const keys: string[] = [];
  for (const area of areas) {
    for (const level of levels) {
      keys.push(`${area}#${level}`);
    }
  }
  return keys;
}

const EXPECTED_AXIS_5_KEYS = generateExpectedKeys(AXIS_5_AREAS, LEVELS_6); // 30
const EXPECTED_AXIS_6_KEYS = generateExpectedKeys(AXIS_6_AREAS, LEVELS_6); // 30
const EXPECTED_AXIS_7_KEYS = generateExpectedKeys(AXIS_7_AREAS, LEVELS_5); // 25
const ALL_EXPECTED_KEYS = [...EXPECTED_AXIS_5_KEYS, ...EXPECTED_AXIS_6_KEYS, ...EXPECTED_AXIS_7_KEYS]; // 85

describe('DRD Knowledge Overrides EN — Axis 5, 6, 7 (Oxford O1 batch 3 mirror)', () => {
  const overrideKeys = Object.keys(DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN);

  it('should have exactly 85 override entries (30 axis-5 + 30 axis-6 + 25 axis-7)', () => {
    expect(overrideKeys.length).toBe(85);
  });

  it('should have unique keys (no duplicates)', () => {
    const unique = new Set(overrideKeys);
    expect(unique.size).toBe(overrideKeys.length);
  });

  it('should match the expected key set exactly', () => {
    const sortedActual = [...overrideKeys].sort();
    const sortedExpected = [...ALL_EXPECTED_KEYS].sort();
    expect(sortedActual).toEqual(sortedExpected);
  });

  it('should have the exact same key set as the PL source file', () => {
    const plKeys = Object.keys(DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7);
    const sortedEn = [...overrideKeys].sort();
    const sortedPl = [...plKeys].sort();
    expect(sortedEn).toEqual(sortedPl);
  });

  describe.each(ALL_EXPECTED_KEYS)('entry %s', (key) => {
    it('has exactly 3 non-empty questions', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN];
      expect(entry).toBeDefined();
      expect(entry?.questions).toBeDefined();
      expect(entry?.questions?.length).toBe(3);
      for (const q of entry?.questions ?? []) {
        expect(typeof q).toBe('string');
        expect(q.trim().length).toBeGreaterThan(0);
      }
    });

    it('has a non-empty example', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN];
      expect(entry?.example).toBeDefined();
      expect((entry?.example ?? '').trim().length).toBeGreaterThan(0);
    });

    it('has a non-empty suggestedTechnologies array', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN];
      expect(Array.isArray(entry?.suggestedTechnologies)).toBe(true);
      expect((entry?.suggestedTechnologies ?? []).length).toBeGreaterThan(0);
    });
  });
});
