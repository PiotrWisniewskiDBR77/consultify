import { afterEach, describe, expect, it } from 'vitest';

import { isPartnerDemoSeedAllowed } from '../partnerDemoSeedService.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalPartnerFlag = process.env.PARTNER_DEMO_SEED_ENABLED;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPartnerFlag === undefined) delete process.env.PARTNER_DEMO_SEED_ENABLED;
  else process.env.PARTNER_DEMO_SEED_ENABLED = originalPartnerFlag;
});

describe('partner demo seed policy', () => {
  it('honors an explicit local opt-out for exact owner fixtures', () => {
    process.env.NODE_ENV = 'development';
    process.env.PARTNER_DEMO_SEED_ENABLED = 'false';

    expect(isPartnerDemoSeedAllowed()).toBe(false);
  });
});
