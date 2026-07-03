/**
 * Structural validation test for DRD q-bank Oxford O1 (osie 1 i 2)
 *
 * Sprawdza:
 * 1. Unikalne klucze (ID)
 * 2. Komplet pól per wpis (questions[3], example, suggestedTechnologies)
 * 3. Pokrycie 100% obszarów osi 1 (1A–1I, 7 poziomów) = 63 klucze
 * 4. Pokrycie 100% obszarów osi 2 (2A–2E, 5 poziomów) = 25 klucze
 * 5. Pytania są behawioralne — nie zawierają wzorca „Czy jesteście dojrzali"
 * 6. Każde pytanie ma co najmniej 40 znaków (nie jest szablonowe)
 * 7. getDRDKnowledge zwraca kuratorowane pytania, nie domyślne, dla osi 1 i 2
 */

import { describe, it, expect } from 'vitest';
import { DRD_OVERRIDES_AXIS_1_2 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';

// Oczekiwane klucze: oś 1 (9 obszarów × 7 poziomów) + oś 2 (5 obszarów × 5 poziomów)
const AXIS_1_AREAS = ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I'];
const AXIS_2_AREAS = ['2A', '2B', '2C', '2D', '2E'];
const AXIS_1_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const AXIS_2_LEVELS = [1, 2, 3, 4, 5];

function generateExpectedKeys(areas: string[], levels: number[]): string[] {
  const keys: string[] = [];
  for (const area of areas) {
    for (const level of levels) {
      keys.push(`${area}#${level}`);
    }
  }
  return keys;
}

const EXPECTED_AXIS_1_KEYS = generateExpectedKeys(AXIS_1_AREAS, AXIS_1_LEVELS); // 63
const EXPECTED_AXIS_2_KEYS = generateExpectedKeys(AXIS_2_AREAS, AXIS_2_LEVELS); // 25
const ALL_EXPECTED_KEYS = [...EXPECTED_AXIS_1_KEYS, ...EXPECTED_AXIS_2_KEYS]; // 88

describe('DRD Knowledge Overrides — Oś 1 i Oś 2 (Oxford O1)', () => {
  const overrideKeys = Object.keys(DRD_OVERRIDES_AXIS_1_2);

  // ---------------------------------------------------------------
  // 1. Liczba wpisów
  // ---------------------------------------------------------------
  it('should have exactly 88 override entries (63 axis-1 + 25 axis-2)', () => {
    expect(overrideKeys.length).toBe(88);
  });

  // ---------------------------------------------------------------
  // 2. Brak duplikatów kluczy
  // ---------------------------------------------------------------
  it('should have unique keys (no duplicates)', () => {
    const unique = new Set(overrideKeys);
    expect(unique.size).toBe(overrideKeys.length);
  });

  // ---------------------------------------------------------------
  // 3. Pokrycie 100% obszarów osi 1
  // ---------------------------------------------------------------
  describe('Axis 1 coverage (1A–1I, levels 1–7)', () => {
    for (const key of EXPECTED_AXIS_1_KEYS) {
      it(`should have override for ${key}`, () => {
        expect(DRD_OVERRIDES_AXIS_1_2).toHaveProperty(key);
      });
    }
  });

  // ---------------------------------------------------------------
  // 4. Pokrycie 100% obszarów osi 2
  // ---------------------------------------------------------------
  describe('Axis 2 coverage (2A–2E, levels 1–5)', () => {
    for (const key of EXPECTED_AXIS_2_KEYS) {
      it(`should have override for ${key}`, () => {
        expect(DRD_OVERRIDES_AXIS_1_2).toHaveProperty(key);
      });
    }
  });

  // ---------------------------------------------------------------
  // 5. Kompletność pól per wpis
  // ---------------------------------------------------------------
  describe('Field completeness per entry', () => {
    for (const key of ALL_EXPECTED_KEYS) {
      it(`${key}: should have questions[3], example, and suggestedTechnologies`, () => {
        const entry = DRD_OVERRIDES_AXIS_1_2[key as keyof typeof DRD_OVERRIDES_AXIS_1_2];
        expect(entry).toBeDefined();
        expect(Array.isArray(entry!.questions)).toBe(true);
        expect(entry!.questions!.length).toBe(3);
        expect(typeof entry!.example).toBe('string');
        expect(entry!.example!.length).toBeGreaterThan(20);
        expect(Array.isArray(entry!.suggestedTechnologies)).toBe(true);
        expect(entry!.suggestedTechnologies!.length).toBeGreaterThan(0);
      });
    }
  });

  // ---------------------------------------------------------------
  // 6. Jakość pytań — długość i charakter behawioralny
  // ---------------------------------------------------------------
  describe('Question quality', () => {
    for (const key of ALL_EXPECTED_KEYS) {
      it(`${key}: questions should be behavioral (≥40 chars, not self-assessment templates)`, () => {
        const entry = DRD_OVERRIDES_AXIS_1_2[key as keyof typeof DRD_OVERRIDES_AXIS_1_2];
        const questions = entry!.questions!;
        for (const q of questions) {
          // Każde pytanie ma co najmniej 40 znaków
          expect(q.length).toBeGreaterThanOrEqual(40);
          // Pytanie nie jest szablonem domyślnym (nie zaczyna się od "In")
          expect(q.startsWith('In "')).toBe(false);
          // Pytanie nie jest czysto „czy jesteście dojrzali" (auto-ocena)
          expect(q.toLowerCase()).not.toMatch(/^czy jesteście dojrzali/);
        }
      });
    }
  });

  // ---------------------------------------------------------------
  // 7. getDRDKnowledge zwraca kuratorowane, nie szablonowe pytania
  // ---------------------------------------------------------------
  describe('getDRDKnowledge integration', () => {
    const SAMPLE_KEYS: Array<[string, number]> = [
      ['1A', 1],
      ['1A', 7],
      ['1F', 5],
      ['1I', 3],
      ['2A', 1],
      ['2E', 5],
    ];

    for (const [areaId, level] of SAMPLE_KEYS) {
      it(`getDRDKnowledge('${areaId}', ${level}) should return curated behavioral question (not template)`, () => {
        const knowledge = getDRDKnowledge(areaId, level);
        expect(knowledge.questions.length).toBe(3);
        // Kuratorowane pytania nie zaczynają się od wzorca template
        const firstQ = knowledge.questions[0];
        expect(firstQ.startsWith('In "')).toBe(false);
        // Mają co najmniej 40 znaków
        expect(firstQ.length).toBeGreaterThanOrEqual(40);
        // example zawiera słowo kluczowe „Dowód" (nasze kuratorowane) lub jest inne niż template
        expect(knowledge.example).not.toMatch(/^Example: in "/);
      });
    }
  });
});
