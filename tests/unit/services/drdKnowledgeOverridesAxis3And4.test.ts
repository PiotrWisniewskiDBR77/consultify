/**
 * Structural validation test for DRD q-bank Oxford O1 (osie 3 i 4)
 *
 * Sprawdza:
 * 1. Unikalne klucze (ID)
 * 2. Komplet pól per wpis (questions[3], example, suggestedTechnologies)
 * 3. Pokrycie 100% obszarów osi 3 (3A–3E, 5 poziomów) = 25 kluczy
 * 4. Pokrycie 100% obszarów osi 4 (4A–4E, 7 poziomów) = 35 kluczy
 * 5. Pytania są behawioralne — nie zawierają wzorca szablonowego
 * 6. Każde pytanie ma co najmniej 40 znaków (nie jest szablonowe)
 * 7. getDRDKnowledge zwraca kuratorowane pytania, nie domyślne, dla osi 3 i 4
 */

import { describe, it, expect } from 'vitest';
import { DRD_OVERRIDES_AXIS_3_4 } from '@/services/assessmentKnowledge/drdKnowledgeOverridesAxis3And4';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';

// Oczekiwane klucze: oś 3 (5 obszarów × 5 poziomów) + oś 4 (5 obszarów × 7 poziomów)
const AXIS_3_AREAS = ['3A', '3B', '3C', '3D', '3E'];
const AXIS_4_AREAS = ['4A', '4B', '4C', '4D', '4E'];
const AXIS_3_LEVELS = [1, 2, 3, 4, 5];
const AXIS_4_LEVELS = [1, 2, 3, 4, 5, 6, 7];

function generateExpectedKeys(areas: string[], levels: number[]): string[] {
  const keys: string[] = [];
  for (const area of areas) {
    for (const level of levels) {
      keys.push(`${area}#${level}`);
    }
  }
  return keys;
}

const EXPECTED_AXIS_3_KEYS = generateExpectedKeys(AXIS_3_AREAS, AXIS_3_LEVELS); // 25
const EXPECTED_AXIS_4_KEYS = generateExpectedKeys(AXIS_4_AREAS, AXIS_4_LEVELS); // 35
const ALL_EXPECTED_KEYS = [...EXPECTED_AXIS_3_KEYS, ...EXPECTED_AXIS_4_KEYS]; // 60

describe('DRD Knowledge Overrides — Oś 3 i Oś 4 (Oxford O1 partia 2)', () => {
  const overrideKeys = Object.keys(DRD_OVERRIDES_AXIS_3_4);

  // ---------------------------------------------------------------
  // 1. Liczba wpisów
  // ---------------------------------------------------------------
  it('should have exactly 60 override entries (25 axis-3 + 35 axis-4)', () => {
    expect(overrideKeys.length).toBe(60);
  });

  // ---------------------------------------------------------------
  // 2. Brak duplikatów kluczy
  // ---------------------------------------------------------------
  it('should have unique keys (no duplicates)', () => {
    const unique = new Set(overrideKeys);
    expect(unique.size).toBe(overrideKeys.length);
  });

  // ---------------------------------------------------------------
  // 3. Pokrycie 100% obszarów osi 3
  // ---------------------------------------------------------------
  describe('Axis 3 coverage (3A–3E, levels 1–5)', () => {
    for (const key of EXPECTED_AXIS_3_KEYS) {
      it(`should have override for ${key}`, () => {
        expect(DRD_OVERRIDES_AXIS_3_4).toHaveProperty(key);
      });
    }
  });

  // ---------------------------------------------------------------
  // 4. Pokrycie 100% obszarów osi 4
  // ---------------------------------------------------------------
  describe('Axis 4 coverage (4A–4E, levels 1–7)', () => {
    for (const key of EXPECTED_AXIS_4_KEYS) {
      it(`should have override for ${key}`, () => {
        expect(DRD_OVERRIDES_AXIS_3_4).toHaveProperty(key);
      });
    }
  });

  // ---------------------------------------------------------------
  // 5. Kompletność pól per wpis
  // ---------------------------------------------------------------
  describe('Field completeness per entry', () => {
    for (const key of ALL_EXPECTED_KEYS) {
      it(`${key}: should have questions[3], example, and suggestedTechnologies`, () => {
        const entry = DRD_OVERRIDES_AXIS_3_4[key as keyof typeof DRD_OVERRIDES_AXIS_3_4];
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
        const entry = DRD_OVERRIDES_AXIS_3_4[key as keyof typeof DRD_OVERRIDES_AXIS_3_4];
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
      ['3A', 1],
      ['3A', 5],
      ['3C', 3],
      ['3E', 4],
      ['4A', 1],
      ['4A', 7],
      ['4D', 5],
      ['4E', 6],
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
