/**
 * L1: Template helpers — honest unit tests (no fake express endpoints).
 *
 * This file targets a real "template" domain module: industry templates used by AI services.
 */

import { describe, expect, it } from 'vitest';

import {
  buildIndustryPromptAddon,
  getIndustryQualityChecks,
} from '../../../server/src/services/ai/industryTemplateService.js';

describe('industryTemplateService (prompt addon)', () => {
  it('buildIndustryPromptAddon: includes Polish header and mapped section labels', () => {
    const addon = buildIndustryPromptAddon(
      {
        id: 't-1',
        industry: 'manufacturing',
        displayName: 'Produkcja',
        description: null,
        additionalSections: ['oee_impact', 'technical_debt'],
        extraQualityChecks: [],
        terminology: { OEE: 'Overall Equipment Effectiveness' },
        constraints: ['ISO 9001'],
        typicalMetrics: ['OEE', 'Scrap rate'],
        promptAddon: null,
        reportTemplate: null,
        isActive: true,
      },
      'pl'
    );

    expect(addon).toContain('## Kontekst Branżowy: Produkcja');
    expect(addon).toContain('**Terminologia branżowa:**');
    expect(addon).toContain('**Ograniczenia regulacyjne:**');
    expect(addon).toContain('**Kluczowe metryki:**');
    expect(addon).toContain('Wpływ na OEE');
    expect(addon).toContain('Dług techniczny');
  });

  it('getIndustryQualityChecks: expands checks from sections and constraints', () => {
    const checks = getIndustryQualityChecks({
      id: 't-2',
      industry: 'healthcare',
      displayName: 'Healthcare',
      description: null,
      additionalSections: ['patient_safety'],
      extraQualityChecks: [],
      terminology: {},
      constraints: ['HIPAA'],
      typicalMetrics: [],
      promptAddon: null,
      reportTemplate: null,
      isActive: true,
    });

    expect(checks).toContain('section_patient_safety');
    expect(checks).toContain('hipaa_compliance_mentioned');
  });
});
