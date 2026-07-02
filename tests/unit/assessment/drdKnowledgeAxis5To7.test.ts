/**
 * Testy strukturalne — DRD q-bank Partia 3 (Oś 5, 6, 7)
 *
 * Weryfikuje:
 * 1. Kompletność: wszystkie obszary × poziomy mają override
 * 2. Format: 3 pytania PL, example, suggestedTechnologies (≥1)
 * 3. Jakość minimalna: pytania nie są pustymi stringami, nie są generycznym defaults
 * 4. Klucze zgodne z konwencją `{obszar}#{poziom}`
 */
import { describe, expect, it } from 'vitest';

import { DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7 } from '../../../src/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7';

// -------------------------------------------------------
// Oczekiwana struktura kluczy per oś
// -------------------------------------------------------

// Oś 5: 5 obszarów × 6 poziomów
const AXIS_5_AREAS = ['5A', '5B', '5C', '5D', '5E'];
const AXIS_5_LEVELS = [1, 2, 3, 4, 5, 6];

// Oś 6: 5 obszarów × 6 poziomów
const AXIS_6_AREAS = ['6A', '6B', '6C', '6D', '6E'];
const AXIS_6_LEVELS = [1, 2, 3, 4, 5, 6];

// Oś 7: 5 obszarów × 5 poziomów
const AXIS_7_AREAS = ['7A', '7B', '7C', '7D', '7E'];
const AXIS_7_LEVELS = [1, 2, 3, 4, 5];

function buildExpectedKeys(areas: string[], levels: number[]): string[] {
  return areas.flatMap((a) => levels.map((l) => `${a}#${l}`));
}

const EXPECTED_AXIS_5 = buildExpectedKeys(AXIS_5_AREAS, AXIS_5_LEVELS);
const EXPECTED_AXIS_6 = buildExpectedKeys(AXIS_6_AREAS, AXIS_6_LEVELS);
const EXPECTED_AXIS_7 = buildExpectedKeys(AXIS_7_AREAS, AXIS_7_LEVELS);
const ALL_EXPECTED = [...EXPECTED_AXIS_5, ...EXPECTED_AXIS_6, ...EXPECTED_AXIS_7];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

const GENERIC_QUESTION_FRAGMENTS = [
  'Is this level met?',
  'Do we have evidence that this level is met?',
  'is level',
  'implemented as described',
];

function isGenericQuestion(q: string): boolean {
  return GENERIC_QUESTION_FRAGMENTS.some((f) => q.toLowerCase().includes(f.toLowerCase()));
}

// -------------------------------------------------------
// Testy
// -------------------------------------------------------

describe('DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7', () => {
  describe('Kompletność kluczy', () => {
    it('Oś 5 — wszystkie 30 kluczy obecne (5 obszarów × 6 poziomów)', () => {
      for (const key of EXPECTED_AXIS_5) {
        expect(
          DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7,
          `Brakujący klucz: ${key}`,
        ).toHaveProperty(key);
      }
    });

    it('Oś 6 — wszystkie 30 kluczy obecne (5 obszarów × 6 poziomów)', () => {
      for (const key of EXPECTED_AXIS_6) {
        expect(
          DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7,
          `Brakujący klucz: ${key}`,
        ).toHaveProperty(key);
      }
    });

    it('Oś 7 — wszystkie 25 kluczy obecne (5 obszarów × 5 poziomów)', () => {
      for (const key of EXPECTED_AXIS_7) {
        expect(
          DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7,
          `Brakujący klucz: ${key}`,
        ).toHaveProperty(key);
      }
    });

    it('Łączna liczba kluczy = 85 (30 + 30 + 25)', () => {
      expect(Object.keys(DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7)).toHaveLength(85);
    });
  });

  describe('Format per klucz', () => {
    for (const key of ALL_EXPECTED) {
      describe(`Klucz: ${key}`, () => {
        it('posiada 3 pytania (tablica string[3])', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          expect(entry).toBeDefined();
          expect(entry!.questions).toBeDefined();
          expect(Array.isArray(entry!.questions)).toBe(true);
          expect(entry!.questions!.length).toBe(3);
        });

        it('pytania są niepuste', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          for (const q of entry!.questions!) {
            expect(isNonEmptyString(q), `Puste pytanie w kluczu ${key}: "${q}"`).toBe(true);
          }
        });

        it('pytania nie są generycznym domyślnym szablonem', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          for (const q of entry!.questions!) {
            expect(isGenericQuestion(q), `Generyczne pytanie w kluczu ${key}: "${q}"`).toBe(false);
          }
        });

        it('posiada niepusty example', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          expect(isNonEmptyString(entry!.example), `Pusty example w kluczu ${key}`).toBe(true);
        });

        it('posiada co najmniej 1 suggestedTechnology', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          expect(Array.isArray(entry!.suggestedTechnologies)).toBe(true);
          expect(
            entry!.suggestedTechnologies!.length,
            `Brak suggestedTechnologies w kluczu ${key}`,
          ).toBeGreaterThanOrEqual(1);
        });

        it('pytania zawierają artefakt/dowód lub konkretne zachowanie', () => {
          const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
          const allQText = entry!.questions!.join(' ').toLowerCase();
          const hasEvidence = [
            'czy', 'dowód', 'dokument', 'raport', 'system', 'procedur', 'polityk',
            'rejestr', 'protokół', 'lista', 'plan', 'certyfik', 'audyt', 'metryka',
            'kpi', 'screen', 'logów', 'log', 'data', 'lata', 'rok', 'miesięcy',
          ].some((kw) => allQText.includes(kw));
          expect(
            hasEvidence,
            `Pytania w kluczu ${key} nie zawierają słów kluczowych wskazujących na dowód/artefakt`,
          ).toBe(true);
        });
      });
    }
  });

  describe('Klucze poza oczekiwanym zakresem (brak "fantomowych")', () => {
    it('Brak kluczy spoza osi 5, 6, 7', () => {
      const allKeys = Object.keys(DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7);
      for (const key of allKeys) {
        expect(
          ALL_EXPECTED.includes(key),
          `Nieoczekiwany klucz: ${key}`,
        ).toBe(true);
      }
    });
  });

  describe('Oś 5 — specyfika behawioralna', () => {
    it('5A: pytania odnoszą się do obserwowanych zachowań liderów (nie przymiotników)', () => {
      for (const level of AXIS_5_LEVELS) {
        const key = `5A#${level}`;
        const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
        const text = entry!.questions!.join(' ').toLowerCase();
        // Powinno zawierać co najmniej jedno konkretne działanie lidera
        const hasAction = ['zarząd', 'kierownictw', 'lider', 'decyzj', 'budżet', 'szkolenj',
          'spotkani', 'mierzy', 'komuniku', 'sponsor', 'deleguj', 'przełożon'].some((w) => text.includes(w));
        expect(hasAction, `5A#${level} brak odniesienia do działania lidera`).toBe(true);
      }
    });

    it('5E: pytania odnoszą się do konkretnych zasobów (kapitał/szkolenia/eksperci/dane/technologia/partnerzy)', () => {
      const resourceKeywords = ['budżet', 'kapita', 'szkolenj', 'ekspert', 'danych', 'dane', 'technologi', 'partner'];
      for (const level of AXIS_5_LEVELS) {
        const key = `5E#${level}`;
        const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
        const text = entry!.questions!.join(' ').toLowerCase();
        const hasResource = resourceKeywords.some((w) => text.includes(w));
        expect(hasResource, `5E#${level} brak słowa kluczowego zasobu`).toBe(true);
      }
    });
  });

  describe('Oś 6 — realne artefakty cyberbezpieczeństwa', () => {
    it('6E: każdy poziom pyta o konkretny artefakt planu awaryjnego (raport, protokół, test, procedura)', () => {
      const cyberArtifacts = ['raport', 'protokół', 'procedur', 'test', 'audyt', 'plan', 'dokument', 'list'];
      for (const level of AXIS_6_LEVELS) {
        const key = `6E#${level}`;
        const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
        const exampleText = (entry!.example || '').toLowerCase();
        const hasArtifact = cyberArtifacts.some((w) => exampleText.includes(w));
        expect(hasArtifact, `6E#${level} brak artefaktu cyber w polu example`).toBe(true);
      }
    });

    it('6D#6: przykład zawiera odniesienie do ISO 27001', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7['6D#6'];
      expect(entry!.example!.toLowerCase()).toContain('iso 27001');
    });

    it('6C#4: przykład zawiera odniesienie do RTO lub RPO (backup/DR test)', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7['6C#4'];
      const text = (entry!.example! + entry!.questions!.join(' ')).toLowerCase();
      expect(text).toMatch(/rto|rpo|disaster recovery|backup/);
    });
  });

  describe('Oś 7 — wdrożone przypadki użycia AI i governance', () => {
    it('7B: pytania zawierają odniesienie do konkretnych procesów lub metryk efektywności AI', () => {
      const processKeywords = ['proces', 'automatycznie', 'metryka', 'raport', 'mierzon', 'kpi', 'efektywnoś', 'czas'];
      for (const level of AXIS_7_LEVELS) {
        const key = `7B#${level}`;
        const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
        const text = entry!.questions!.join(' ').toLowerCase();
        const hasProcess = processKeywords.some((w) => text.includes(w));
        expect(hasProcess, `7B#${level} brak odniesienia do procesu/metryki AI`).toBe(true);
      }
    });

    it('7D: pytania zawierają odniesienie do governance AI (polityka, rejestr, monitoring)', () => {
      const govKeywords = ['polityk', 'rejestr', 'monitoring', 'audyt', 'governance', 'rola', 'komitet', 'zatwierdzon'];
      for (const level of AXIS_7_LEVELS) {
        const key = `7D#${level}`;
        const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7[key as keyof typeof DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7];
        const text = entry!.questions!.join(' ').toLowerCase();
        const hasGov = govKeywords.some((w) => text.includes(w));
        expect(hasGov, `7D#${level} brak odniesienia do governance AI`).toBe(true);
      }
    });

    it('7E#5: example zawiera odniesienie do agentów AI lub AI ROI', () => {
      const entry = DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7['7E#5'];
      const text = (entry!.example! + entry!.questions!.join(' ')).toLowerCase();
      expect(text).toMatch(/agent|roi|agentic|autonomi/);
    });
  });
});
