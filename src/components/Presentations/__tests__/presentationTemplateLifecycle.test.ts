import { describe, expect, it } from 'vitest';

import { canDeprecatePublishedPresentationTemplate } from '../PresentationTemplateArchitectView';

describe('PowerPoint Template Architect lifecycle actions', () => {
  it('offers deprecation only for an approved/published template', () => {
    expect(canDeprecatePublishedPresentationTemplate('approved')).toBe(true);
    expect(canDeprecatePublishedPresentationTemplate('draft')).toBe(false);
    expect(canDeprecatePublishedPresentationTemplate('deprecated')).toBe(false);
  });
});
