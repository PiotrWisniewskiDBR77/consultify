import { describe, expect, it } from 'vitest';

import { PARTNER_MARKETING_RETIREMENT_TARGETS } from '../../../src/views/partner/partnerLegacyRoutes';

describe('D8 Partner marketing retirement map', () => {
  it('retires all seven former internal marketing tabs from /partner', () => {
    expect(Object.keys(PARTNER_MARKETING_RETIREMENT_TARGETS)).toHaveLength(7);
    expect(Object.values(PARTNER_MARKETING_RETIREMENT_TARGETS)).not.toContain('/partner');
  });

  it('keeps known public destinations and marks missing destinations explicitly', () => {
    expect(PARTNER_MARKETING_RETIREMENT_TARGETS).toEqual({
      dashboard: '/become-partner',
      metrics: null,
      earnings: '/partner/pricing',
      'company-info': '/become-partner/apply',
      'learning-path': null,
      documentation: '/become-partner',
      templates: '/become-partner',
    });
  });
});
