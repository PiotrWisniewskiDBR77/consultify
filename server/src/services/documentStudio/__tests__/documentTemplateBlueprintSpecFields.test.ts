/**
 * Document Studio — TemplateSectionBlueprint spec §8.3 fields tests
 * (Slice E14.blueprint).
 *
 * Verifies the four backwards-compatible optional fields added in
 * slice E14.blueprint to close the §15.3 gap from
 * CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md:
 *   - `requiredData?: string[]`
 *   - `optionalData?: string[]`
 *   - `formattingStyle?: string`
 *   - `approvalRequired?: boolean`
 *
 * Also covers the two new service helpers:
 *   - `templateHasPerSectionApprovalRequirements(blueprint)`;
 *   - `collectTemplateRequiredDataLabels(blueprint)`.
 *
 * Backwards-compat contract: every legacy blueprint (5-field shape)
 * MUST keep working unchanged. Seeders, refiners, hydration, and the
 * materialize pipeline all spread blueprints with `...original`, so
 * the new optional fields ride along for free without any mutation
 * to those code paths.
 */

import { describe, expect, it } from 'vitest';

import type { TemplateSectionBlueprint } from '../documentStudioTypes.js';
import {
  collectTemplateRequiredDataLabels,
  templateHasPerSectionApprovalRequirements,
} from '../documentStudioTypes.js';

function legacyBlueprint(title: string): TemplateSectionBlueprint {
  // 5-field shape — what every pre-E14.blueprint template carries.
  // The new optional fields MUST stay `undefined` here.
  return {
    title,
    level: 1,
    purpose: `Purpose for ${title}`,
    required: false,
    expectedLengthHint: 'medium',
  };
}

describe('TemplateSectionBlueprint — backwards-compatible legacy shape (Slice E14.blueprint)', () => {
  it('legacy 5-field blueprint leaves all 4 new fields undefined', () => {
    const b = legacyBlueprint('Executive Summary');
    expect(b.requiredData).toBeUndefined();
    expect(b.optionalData).toBeUndefined();
    expect(b.formattingStyle).toBeUndefined();
    expect(b.approvalRequired).toBeUndefined();
  });

  it('spreading a legacy blueprint preserves the 5-field shape (refiner / seeder safety)', () => {
    const original = legacyBlueprint('Findings');
    const refined: TemplateSectionBlueprint = { ...original, purpose: 'Updated purpose' };
    expect(refined.title).toBe('Findings');
    expect(refined.level).toBe(1);
    expect(refined.purpose).toBe('Updated purpose');
    expect(refined.required).toBe(false);
    expect(refined.expectedLengthHint).toBe('medium');
    expect(refined.requiredData).toBeUndefined();
    expect(refined.optionalData).toBeUndefined();
    expect(refined.formattingStyle).toBeUndefined();
    expect(refined.approvalRequired).toBeUndefined();
  });
});

describe('TemplateSectionBlueprint — new spec §8.3 fields (Slice E14.blueprint)', () => {
  it('accepts requiredData independently of optionalData', () => {
    const b: TemplateSectionBlueprint = {
      ...legacyBlueprint('Findings'),
      requiredData: ['client revenue 2024', 'Q3 board minutes timestamp'],
    };
    expect(b.requiredData).toEqual(['client revenue 2024', 'Q3 board minutes timestamp']);
    expect(b.optionalData).toBeUndefined();
  });

  it('accepts optionalData independently of requiredData', () => {
    const b: TemplateSectionBlueprint = {
      ...legacyBlueprint('Recommendations'),
      optionalData: ['benchmark vs peer group'],
    };
    expect(b.optionalData).toEqual(['benchmark vs peer group']);
    expect(b.requiredData).toBeUndefined();
  });

  it('accepts formattingStyle as a free-form string identifier', () => {
    const b: TemplateSectionBlueprint = {
      ...legacyBlueprint('Cover'),
      formattingStyle: 'h1_with_intro_and_table',
    };
    expect(b.formattingStyle).toBe('h1_with_intro_and_table');
  });

  it('accepts approvalRequired as a per-section gate flag', () => {
    const b: TemplateSectionBlueprint = {
      ...legacyBlueprint('Legal Disclosures'),
      approvalRequired: true,
    };
    expect(b.approvalRequired).toBe(true);
  });

  it('all four new fields can coexist on a single blueprint', () => {
    const b: TemplateSectionBlueprint = {
      ...legacyBlueprint('Risk Register'),
      requiredData: ['risk owners list'],
      optionalData: ['mitigation evidence'],
      formattingStyle: 'risk_table_with_severity',
      approvalRequired: true,
    };
    expect(b.requiredData).toEqual(['risk owners list']);
    expect(b.optionalData).toEqual(['mitigation evidence']);
    expect(b.formattingStyle).toBe('risk_table_with_severity');
    expect(b.approvalRequired).toBe(true);
  });
});

describe('templateHasPerSectionApprovalRequirements (Slice E14.blueprint)', () => {
  it('returns false for empty / null / undefined blueprints', () => {
    expect(templateHasPerSectionApprovalRequirements([])).toBe(false);
    expect(templateHasPerSectionApprovalRequirements(undefined)).toBe(false);
    expect(templateHasPerSectionApprovalRequirements(null)).toBe(false);
  });

  it('returns false for legacy blueprints (no approvalRequired field)', () => {
    const blueprints = [legacyBlueprint('A'), legacyBlueprint('B'), legacyBlueprint('C')];
    expect(templateHasPerSectionApprovalRequirements(blueprints)).toBe(false);
  });

  it('returns false when every blueprint has approvalRequired = false', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      { ...legacyBlueprint('A'), approvalRequired: false },
      { ...legacyBlueprint('B'), approvalRequired: false },
    ];
    expect(templateHasPerSectionApprovalRequirements(blueprints)).toBe(false);
  });

  it('returns true if at least one blueprint has approvalRequired = true', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      legacyBlueprint('A'),
      { ...legacyBlueprint('B'), approvalRequired: true },
      legacyBlueprint('C'),
    ];
    expect(templateHasPerSectionApprovalRequirements(blueprints)).toBe(true);
  });
});

describe('collectTemplateRequiredDataLabels (Slice E14.blueprint)', () => {
  it('returns empty array for empty / null / undefined blueprints', () => {
    expect(collectTemplateRequiredDataLabels([])).toEqual([]);
    expect(collectTemplateRequiredDataLabels(undefined)).toEqual([]);
    expect(collectTemplateRequiredDataLabels(null)).toEqual([]);
  });

  it('returns empty array for legacy blueprints (no requiredData)', () => {
    expect(collectTemplateRequiredDataLabels([legacyBlueprint('A'), legacyBlueprint('B')])).toEqual(
      []
    );
  });

  it('collects labels from a single blueprint preserving order', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      { ...legacyBlueprint('A'), requiredData: ['client revenue', 'Q3 board minutes'] },
    ];
    expect(collectTemplateRequiredDataLabels(blueprints)).toEqual([
      'client revenue',
      'Q3 board minutes',
    ]);
  });

  it('deduplicates labels across blueprints (insertion-order preserved)', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      { ...legacyBlueprint('A'), requiredData: ['client revenue', 'risk owners'] },
      { ...legacyBlueprint('B'), requiredData: ['risk owners', 'Q3 minutes'] },
      { ...legacyBlueprint('C'), requiredData: ['client revenue'] },
    ];
    expect(collectTemplateRequiredDataLabels(blueprints)).toEqual([
      'client revenue',
      'risk owners',
      'Q3 minutes',
    ]);
  });

  it('drops whitespace-only and non-string entries', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      {
        ...legacyBlueprint('A'),
        requiredData: ['  ', 'real label', '', '\t\n'] as string[],
      },
    ];
    expect(collectTemplateRequiredDataLabels(blueprints)).toEqual(['real label']);
  });

  it('trims surrounding whitespace before deduplication', () => {
    const blueprints: TemplateSectionBlueprint[] = [
      { ...legacyBlueprint('A'), requiredData: ['  client revenue  '] },
      { ...legacyBlueprint('B'), requiredData: ['client revenue'] },
    ];
    expect(collectTemplateRequiredDataLabels(blueprints)).toEqual(['client revenue']);
  });
});
