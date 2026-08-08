import { describe, expect, it } from 'vitest';

import { mergeBusinessCaseOutlineRequirements } from '../documentStudioService.js';
import type { DocumentIntake, DocumentOutline } from '../documentStudioTypes.js';

describe('mergeBusinessCaseOutlineRequirements', () => {
  it('adds methodology and assumptions to a stale UI outline without dropping its extra sections', () => {
    const intake = {
      description: 'Partner business case',
      documentType: 'business_case',
      title: 'LaunchForge Partner Business Case',
    } as DocumentIntake;
    const outline = {
      documentType: 'business_case',
      title: 'LaunchForge Partner Business Case',
      recommendedDensity: 'detailed',
      recommendedRegister: 'executive',
      recommendedLanguageStyle: 'consulting',
      sections: [
        { title: 'Executive Summary', level: 1, purpose: 'Decision' },
        { title: 'Problem Statement', level: 1, purpose: 'Problem' },
        { title: 'Proposed Initiative', level: 1, purpose: 'Solution' },
        { title: 'Economic Analysis', level: 1, purpose: 'Economics' },
        { title: 'Risks', level: 1, purpose: 'Risks' },
        { title: 'Recommendation', level: 1, purpose: 'Ask' },
      ],
    } as DocumentOutline;

    const merged = mergeBusinessCaseOutlineRequirements(intake, outline);
    expect(merged.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['Scope and Approach', 'Scenarios and Assumptions', 'Economic Analysis'])
    );
    expect(merged.sections.findIndex((section) => section.title === 'Scope and Approach')).toBeLessThan(
      merged.sections.findIndex((section) => section.title === 'Proposed Initiative')
    );
    expect(
      merged.sections.findIndex((section) => section.title === 'Scenarios and Assumptions')
    ).toBeGreaterThan(merged.sections.findIndex((section) => section.title === 'Proposed Initiative'));
  });

  it('does not change non-business-case outlines', () => {
    const outline = { documentType: 'generic_document', title: 'Memo', sections: [] } as DocumentOutline;
    const intake = {
      description: 'Memo',
      documentType: 'generic_document',
    } as DocumentIntake;
    expect(mergeBusinessCaseOutlineRequirements(intake, outline)).toBe(outline);
  });
});
