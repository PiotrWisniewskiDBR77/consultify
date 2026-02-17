/**
 * L1: Vendor-related domain logic (honest unit tests).
 *
 * There is no real "vendors" API in server/src today. Instead of faking endpoints,
 * this file tests vendor-related concerns present in our AI stakeholder personas.
 */

import { describe, expect, it } from 'vitest';

import {
  STAKEHOLDER_PERSONAS,
  buildStakeholderPrompt,
  getAvailableStakeholders,
} from '../../../server/src/services/ai/multiStakeholderService.js';

describe('multiStakeholderService', () => {
  it('CTO persona includes vendor lock-in concern', () => {
    expect(STAKEHOLDER_PERSONAS.cto.concerns).toContain('Vendor lock-in');
  });

  it('getAvailableStakeholders: returns all personas', () => {
    const roles = getAvailableStakeholders().map((s) => s.role);
    expect(roles).toContain('cfo');
    expect(roles).toContain('cto');
    expect(roles).toContain('ceo');
  });

  it('buildStakeholderPrompt: returns Polish header when language is pl', () => {
    const prompt = buildStakeholderPrompt({
      problem: 'Test problem',
      stakeholder: STAKEHOLDER_PERSONAS.cfo,
      language: 'pl',
    });

    expect(prompt).toContain('Analizujesz następujący problem');
    expect(prompt).toContain('Chief Financial Officer');
  });
});
