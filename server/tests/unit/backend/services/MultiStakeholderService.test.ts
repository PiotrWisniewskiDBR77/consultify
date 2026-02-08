import { describe, expect, it } from 'vitest';

import {
  buildStakeholderPrompt,
  calculateConsensus,
  detectConflicts,
  getAvailableStakeholders,
  parseStakeholderResponse,
  STAKEHOLDER_PERSONAS,
} from '../../../../src/services/ai/multiStakeholderService.js';

describe('MultiStakeholderService', () => {
  describe('STAKEHOLDER_PERSONAS', () => {
    it('has all C-suite roles defined', () => {
      expect(STAKEHOLDER_PERSONAS.cfo).toBeDefined();
      expect(STAKEHOLDER_PERSONAS.cto).toBeDefined();
      expect(STAKEHOLDER_PERSONAS.coo).toBeDefined();
      expect(STAKEHOLDER_PERSONAS.cmo).toBeDefined();
      expect(STAKEHOLDER_PERSONAS.chro).toBeDefined();
      expect(STAKEHOLDER_PERSONAS.ceo).toBeDefined();
    });

    it('each persona has required fields', () => {
      for (const [key, persona] of Object.entries(STAKEHOLDER_PERSONAS)) {
        expect(persona.role).toBe(key);
        expect(persona.title).toBeTruthy();
        expect(persona.shortTitle).toBeTruthy();
        expect(persona.priorities.length).toBeGreaterThan(0);
        expect(persona.concerns.length).toBeGreaterThan(0);
        expect(persona.promptContext).toBeTruthy();
      }
    });
  });

  describe('getAvailableStakeholders', () => {
    it('returns array of all personas', () => {
      const stakeholders = getAvailableStakeholders();
      expect(stakeholders.length).toBe(Object.keys(STAKEHOLDER_PERSONAS).length);
    });
  });

  describe('buildStakeholderPrompt', () => {
    it('includes problem in the prompt', () => {
      const prompt = buildStakeholderPrompt({
        problem: 'Should we migrate to cloud?',
        stakeholder: STAKEHOLDER_PERSONAS.cto,
        language: 'en',
      });

      expect(prompt).toContain('Should we migrate to cloud?');
      expect(prompt).toContain('Chief Technology Officer');
    });

    it('returns Polish format when language is pl', () => {
      const prompt = buildStakeholderPrompt({
        problem: 'Decision',
        stakeholder: STAKEHOLDER_PERSONAS.cfo,
        language: 'pl',
      });

      expect(prompt).toContain('perspektywy');
    });
  });

  describe('parseStakeholderResponse', () => {
    it('detects support level from response', () => {
      const perspective = parseStakeholderResponse({
        stakeholder: STAKEHOLDER_PERSONAS.cfo,
        response: `
## Key Points
- Good ROI expected

## Support Level
I strongly_support this decision.
        `,
      });

      expect(perspective.supportLevel).toBe('strongly_support');
    });

    it('defaults to neutral when no support level found', () => {
      const perspective = parseStakeholderResponse({
        stakeholder: STAKEHOLDER_PERSONAS.cfo,
        response: 'This is a neutral analysis without clear support statement.',
      });

      expect(perspective.supportLevel).toBe('neutral');
    });
  });

  describe('detectConflicts', () => {
    it('detects CFO vs CTO conflict when CFO opposes and CTO supports', () => {
      const perspectives = [
        {
          stakeholder: STAKEHOLDER_PERSONAS.cfo,
          analysis: '',
          supportLevel: 'oppose' as const,
          keyPoints: ['Cost is too high'],
          risks: [],
          conditions: [],
        },
        {
          stakeholder: STAKEHOLDER_PERSONAS.cto,
          analysis: '',
          supportLevel: 'strongly_support' as const,
          keyPoints: ['Great technical advancement'],
          risks: [],
          conditions: [],
        },
      ];

      const conflicts = detectConflicts(perspectives);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].stakeholder1).toBe('CFO');
      expect(conflicts[0].stakeholder2).toBe('CTO');
    });
  });

  describe('calculateConsensus', () => {
    it('returns aligned when all strongly support', () => {
      const perspectives = [
        {
          stakeholder: STAKEHOLDER_PERSONAS.cfo,
          supportLevel: 'strongly_support' as const,
          keyPoints: ['good'],
          risks: [],
          conditions: [],
          analysis: '',
        },
        {
          stakeholder: STAKEHOLDER_PERSONAS.cto,
          supportLevel: 'strongly_support' as const,
          keyPoints: ['good'],
          risks: [],
          conditions: [],
          analysis: '',
        },
      ];

      const consensus = calculateConsensus(perspectives);
      expect(consensus.overallAlignment).toBe('aligned');
    });

    it('returns divided when opinions vary significantly', () => {
      const perspectives = [
        {
          stakeholder: STAKEHOLDER_PERSONAS.cfo,
          supportLevel: 'strongly_oppose' as const,
          keyPoints: [],
          risks: [],
          conditions: [],
          analysis: '',
        },
        {
          stakeholder: STAKEHOLDER_PERSONAS.cto,
          supportLevel: 'strongly_support' as const,
          keyPoints: [],
          risks: [],
          conditions: [],
          analysis: '',
        },
      ];

      const consensus = calculateConsensus(perspectives);
      expect(['divided', 'strongly_divided']).toContain(consensus.overallAlignment);
    });
  });
});
