import { describe, expect, it } from 'vitest';

import { normalizeTemplatePayload } from '../presentationTemplateCompatibilityService.js';

describe('presentationTemplateCompatibilityService', () => {
  it('normalizes missing legacy fields with safe defaults', () => {
    const normalized = normalizeTemplatePayload({
      id: 'tpl_1',
      name: 'Legacy Template',
      deck_type: 'board',
      outline_json: null,
    });

    expect(normalized.outline_json).toEqual([]);
    expect(normalized.must_have_intents).toEqual([]);
    expect(normalized.recommended_visuals).toEqual([]);
    expect(normalized.template_recipe_json).toEqual(
      expect.objectContaining({
        slideRecipes: [],
      })
    );
    expect(normalized.language_default).toBe('en');
    expect(normalized.confidentiality_default).toBe('internal');
    expect(normalized.max_slides).toBe(25);
    expect(normalized.min_slides).toBe(5);
  });

  it('parses JSON fields and preserves valid values', () => {
    const normalized = normalizeTemplatePayload({
      id: 'tpl_2',
      language_default: 'pl',
      confidentiality_default: 'confidential',
      outline_json: '[{"id":"s1"}]',
      must_have_intents: '["decision","risk"]',
      recommended_visuals: '["timeline"]',
      max_slides: 14,
      min_slides: 6,
    });

    expect(normalized.outline_json).toEqual([{ id: 's1' }]);
    expect(normalized.must_have_intents).toEqual(['decision', 'risk']);
    expect(normalized.recommended_visuals).toEqual(['timeline']);
    expect(normalized.language_default).toBe('pl');
    expect(normalized.confidentiality_default).toBe('confidential');
    expect(normalized.max_slides).toBe(14);
    expect(normalized.min_slides).toBe(6);
  });

  it('reopens a persisted custom theme and named-layout contract', () => {
    const customTemplate = {
      version: 2,
      theme: { titleFont: 'Aptos', bodyFont: 'Arial', primaryColor: '112233' },
      layouts: { cover: { masterName: 'Client Cover' } },
      layoutMapping: { cover: 'cover' },
    };
    const normalized = normalizeTemplatePayload({
      id: 'tpl-custom',
      layout_policy_json: JSON.stringify({ customTemplate }),
    });
    expect(normalized.custom_template).toEqual(customTemplate);
  });
});
