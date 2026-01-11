import { describe, it, expect } from 'vitest';
import {
  DRD_STRUCTURE,
  getQuestionsForAxis,
  type DRDAxis,
  type DRDArea,
  type DRDLevel,
} from '@/services/drdStructure';

describe('DRD Structure Service', () => {
  describe('Data Structure Integrity', () => {
    it('should have exactly 7 axes defined', () => {
      expect(DRD_STRUCTURE).toHaveLength(7);
    });

    it('should have all axes with valid IDs (1-7)', () => {
      const axisIds = DRD_STRUCTURE.map((axis) => axis.id);
      expect(axisIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should have all axes with non-empty names', () => {
      DRD_STRUCTURE.forEach((axis) => {
        expect(axis.name).toBeTruthy();
        expect(axis.name.length).toBeGreaterThan(0);
      });
    });

    it('should have all axes with areas array', () => {
      DRD_STRUCTURE.forEach((axis) => {
        expect(Array.isArray(axis.areas)).toBe(true);
        expect(axis.areas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Axis 6: Cybersecurity', () => {
    it('should have Axis 6 named "Cybersecurity"', () => {
      const axis6 = DRD_STRUCTURE.find((axis) => axis.id === 6);
      expect(axis6).toBeDefined();
      expect(axis6?.name).toBe('Cybersecurity');
    });
  });

  describe('Axis 7: AI Maturity', () => {
    let axis7: DRDAxis | undefined;

    beforeEach(() => {
      axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
    });

    it('should exist and be named "AI Maturity"', () => {
      expect(axis7).toBeDefined();
      expect(axis7?.name).toBe('AI Maturity');
    });

    it('should have exactly 5 areas', () => {
      expect(axis7?.areas).toHaveLength(5);
    });

    it('should have correctly named areas', () => {
      const expectedAreaNames = [
        'Dane i Fundamenty AI',
        'Procesy Wspierane przez AI',
        'AI w Produktach i Usługach',
        'Governance, Bezpieczeństwo i Etyka',
        'Kompetencje i Kultura AI',
      ];

      const actualAreaNames = axis7?.areas.map((area) => area.name) || [];
      expect(actualAreaNames).toEqual(expectedAreaNames);
    });

    it('should have correct area IDs (7A-7E)', () => {
      const expectedAreaIds = ['7A', '7B', '7C', '7D', '7E'];
      const actualAreaIds = axis7?.areas.map((area) => area.id) || [];
      expect(actualAreaIds).toEqual(expectedAreaIds);
    });

    describe('Area 7A: Dane i Fundamenty AI', () => {
      let area7A: DRDArea | undefined;

      beforeEach(() => {
        area7A = axis7?.areas.find((area) => area.id === '7A');
      });

      it('should have exactly 5 maturity levels', () => {
        expect(area7A?.levels).toHaveLength(5);
      });

      it('should have levels numbered 1-5', () => {
        const levelNumbers = area7A?.levels.map((level) => level.level) || [];
        expect(levelNumbers).toEqual([1, 2, 3, 4, 5]);
      });

      it('should have non-empty titles for all levels', () => {
        area7A?.levels.forEach((level) => {
          expect(level.title).toBeTruthy();
          expect(level.title.length).toBeGreaterThan(0);
        });
      });

      it('should have non-empty descriptions for all levels', () => {
        area7A?.levels.forEach((level) => {
          expect(level.description).toBeTruthy();
          expect(level.description.length).toBeGreaterThan(0);
        });
      });

      it('should have level 1 titled "Fragmented Data, No AI Readiness"', () => {
        const level1 = area7A?.levels.find((l) => l.level === 1);
        expect(level1?.title).toBe('Fragmented Data, No AI Readiness');
      });

      it('should have level 5 titled "Autonomous Data Intelligence"', () => {
        const level5 = area7A?.levels.find((l) => l.level === 5);
        expect(level5?.title).toBe('Autonomous Data Intelligence');
      });

      it('should have Polish language descriptions', () => {
        const level1 = area7A?.levels.find((l) => l.level === 1);
        expect(level1?.description).toContain('Dane są rozproszone');
      });
    });

    describe('Area 7B: Procesy Wspierane przez AI', () => {
      let area7B: DRDArea | undefined;

      beforeEach(() => {
        area7B = axis7?.areas.find((area) => area.id === '7B');
      });

      it('should have exactly 5 maturity levels', () => {
        expect(area7B?.levels).toHaveLength(5);
      });

      it('should have level 1 titled "Isolated AI Experiments"', () => {
        const level1 = area7B?.levels.find((l) => l.level === 1);
        expect(level1?.title).toBe('Isolated AI Experiments');
      });

      it('should have level 5 titled "Fully Autonomous Operational Orchestration"', () => {
        const level5 = area7B?.levels.find((l) => l.level === 5);
        expect(level5?.title).toBe('Fully Autonomous Operational Orchestration');
      });

      it('should describe AI integration progression', () => {
        const level2 = area7B?.levels.find((l) => l.level === 2);
        expect(level2?.description).toContain('automatyzacje');

        const level4 = area7B?.levels.find((l) => l.level === 4);
        expect(level4?.description).toContain('samodzielnie');
      });
    });

    describe('Area 7C: AI w Produktach i Usługach', () => {
      let area7C: DRDArea | undefined;

      beforeEach(() => {
        area7C = axis7?.areas.find((area) => area.id === '7C');
      });

      it('should have exactly 5 maturity levels', () => {
        expect(area7C?.levels).toHaveLength(5);
      });

      it('should have level 1 titled "No AI Components in Products"', () => {
        const level1 = area7C?.levels.find((l) => l.level === 1);
        expect(level1?.title).toBe('No AI Components in Products');
      });

      it('should have level 5 titled "AI-Native Business Offerings"', () => {
        const level5 = area7C?.levels.find((l) => l.level === 5);
        expect(level5?.title).toBe('AI-Native Business Offerings');
      });

      it('should describe product AI integration levels', () => {
        const level3 = area7C?.levels.find((l) => l.level === 3);
        expect(level3?.title).toBe('AI as a Core Product Component');
        expect(level3?.description).toContain('kluczowym elementem');
      });
    });

    describe('Area 7D: Governance, Bezpieczeństwo i Etyka', () => {
      let area7D: DRDArea | undefined;

      beforeEach(() => {
        area7D = axis7?.areas.find((area) => area.id === '7D');
      });

      it('should have exactly 5 maturity levels', () => {
        expect(area7D?.levels).toHaveLength(5);
      });

      it('should have level 1 titled "No AI Governance, Uncontrolled Use"', () => {
        const level1 = area7D?.levels.find((l) => l.level === 1);
        expect(level1?.title).toBe('No AI Governance, Uncontrolled Use');
      });

      it('should have level 5 titled "Ethical, Transparent & Autonomous AI Governance"', () => {
        const level5 = area7D?.levels.find((l) => l.level === 5);
        expect(level5?.title).toBe('Ethical, Transparent & Autonomous AI Governance');
      });

      it('should describe governance maturity progression', () => {
        const level3 = area7D?.levels.find((l) => l.level === 3);
        expect(level3?.description).toContain('formalizuje');
        expect(level3?.description).toContain('audytowane');
      });
    });

    describe('Area 7E: Kompetencje i Kultura AI', () => {
      let area7E: DRDArea | undefined;

      beforeEach(() => {
        area7E = axis7?.areas.find((area) => area.id === '7E');
      });

      it('should have exactly 5 maturity levels', () => {
        expect(area7E?.levels).toHaveLength(5);
      });

      it('should have level 1 titled "Brak Kompetencji"', () => {
        const level1 = area7E?.levels.find((l) => l.level === 1);
        expect(level1?.title).toBe('Brak Kompetencji');
      });

      it('should have level 5 titled "Kadra AI-Native"', () => {
        const level5 = area7E?.levels.find((l) => l.level === 5);
        expect(level5?.title).toBe('Kadra AI-Native');
      });

      it('should describe competency progression', () => {
        const level4 = area7E?.levels.find((l) => l.level === 4);
        expect(level4?.title).toBe('Płynność AI (AI Fluency)');
        expect(level4?.description).toContain('automatyzacje');
      });
    });

    it('should have all areas with consistent level structure (1-5)', () => {
      axis7?.areas.forEach((area) => {
        const levelNumbers = area.levels.map((l) => l.level);
        expect(levelNumbers).toEqual([1, 2, 3, 4, 5]);
      });
    });

    it('should have all levels with valid DRDLevel structure', () => {
      axis7?.areas.forEach((area) => {
        area.levels.forEach((level) => {
          expect(level).toHaveProperty('level');
          expect(level).toHaveProperty('title');
          expect(level).toHaveProperty('description');
          expect(typeof level.level).toBe('number');
          expect(typeof level.title).toBe('string');
          expect(typeof level.description).toBe('string');
        });
      });
    });
  });

  describe('getQuestionsForAxis() function', () => {
    it('should return areas for valid axis ID', () => {
      const axis1Areas = getQuestionsForAxis(1);
      expect(Array.isArray(axis1Areas)).toBe(true);
      expect(axis1Areas.length).toBeGreaterThan(0);
    });

    it('should return AI Maturity areas for axis 7', () => {
      const axis7Areas = getQuestionsForAxis(7);
      expect(axis7Areas).toHaveLength(5);

      const areaIds = axis7Areas.map((area) => area.id);
      expect(areaIds).toEqual(['7A', '7B', '7C', '7D', '7E']);
    });

    it('should return empty array for non-existent axis ID', () => {
      const invalidAreas = getQuestionsForAxis(999);
      expect(invalidAreas).toEqual([]);
    });

    it('should return areas for all valid axes (1-7)', () => {
      for (let i = 1; i <= 7; i++) {
        const areas = getQuestionsForAxis(i);
        expect(Array.isArray(areas)).toBe(true);
        expect(areas.length).toBeGreaterThan(0);
      }
    });

    it('should return Cybersecurity areas for axis 6', () => {
      const axis6Areas = getQuestionsForAxis(6);
      expect(Array.isArray(axis6Areas)).toBe(true);
      expect(axis6Areas.length).toBeGreaterThan(0);
    });
  });

  describe('Type Safety', () => {
    it('should conform to DRDAxis type', () => {
      DRD_STRUCTURE.forEach((axis: DRDAxis) => {
        expect(typeof axis.id).toBe('number');
        expect(typeof axis.name).toBe('string');
        expect(Array.isArray(axis.areas)).toBe(true);
      });
    });

    it('should conform to DRDArea type', () => {
      DRD_STRUCTURE.forEach((axis) => {
        axis.areas.forEach((area: DRDArea) => {
          expect(typeof area.id).toBe('string');
          expect(typeof area.name).toBe('string');
          expect(Array.isArray(area.levels)).toBe(true);
        });
      });
    });

    it('should conform to DRDLevel type', () => {
      DRD_STRUCTURE.forEach((axis) => {
        axis.areas.forEach((area) => {
          area.levels.forEach((level: DRDLevel) => {
            expect(typeof level.level).toBe('number');
            expect(typeof level.title).toBe('string');
            expect(typeof level.description).toBe('string');
          });
        });
      });
    });
  });

  describe('Content Quality', () => {
    it('should have meaningful descriptions (> 50 characters)', () => {
      const axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
      axis7?.areas.forEach((area) => {
        area.levels.forEach((level) => {
          expect(level.description.length).toBeGreaterThan(50);
        });
      });
    });

    it('should have concise titles (< 100 characters)', () => {
      const axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
      axis7?.areas.forEach((area) => {
        area.levels.forEach((level) => {
          expect(level.title.length).toBeLessThan(100);
        });
      });
    });

    it('should not have placeholder text', () => {
      const axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
      axis7?.areas.forEach((area) => {
        area.levels.forEach((level) => {
          expect(level.title).not.toContain('TODO');
          expect(level.title).not.toContain('TBD');
          expect(level.description).not.toContain('TODO');
          expect(level.description).not.toContain('TBD');
        });
      });
    });
  });

  describe('Maturity Level Progression', () => {
    it('should show clear progression from level 1 to 5 in AI Maturity', () => {
      const axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
      const area7A = axis7?.areas.find((area) => area.id === '7A');

      const level1Desc = area7A?.levels[0].description || '';
      const level5Desc = area7A?.levels[4].description || '';

      // Level 1 should describe fragmented/basic state
      expect(level1Desc).toContain('rozproszone');

      // Level 5 should describe autonomous/advanced state
      expect(level5Desc).toContain('automatycznie');
    });

    it('should have increasing sophistication across levels', () => {
      const axis7 = DRD_STRUCTURE.find((axis) => axis.id === 7);
      const area7B = axis7?.areas.find((area) => area.id === '7B');

      // Check progression keywords
      const level1 = area7B?.levels[0].description || '';
      const level3 = area7B?.levels[2].description || '';
      const level5 = area7B?.levels[4].description || '';

      // Level 1: Isolated experiments
      expect(level1.toLowerCase()).toMatch(/izolowa|obok|eksperyment/);

      // Level 3: Integrated decision support
      expect(level3.toLowerCase()).toMatch(/zintegrowa|częścią|proces/);

      // Level 5: Fully autonomous
      expect(level5.toLowerCase()).toMatch(/autonomi|bez udziału|wykonują się/);
    });
  });
});
