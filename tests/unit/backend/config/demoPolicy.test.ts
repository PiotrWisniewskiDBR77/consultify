import { describe, expect, it } from 'vitest';

import { resolveDemoPolicy } from '../../../../server/src/config/demoPolicy.ts';

describe('demoPolicy', () => {
  it('keeps the neutral demo org as the default policy', () => {
    const policy = resolveDemoPolicy({});

    expect(policy.demoOrgId).toBe('demo-org');
    expect(policy.demoOrgName).toBe('Demo Organization');
    expect(policy.usesNonDefaultDemoOrgId).toBe(false);
    expect(policy.explicitApprovalEnabled).toBe(false);
    expect(policy.errors).toEqual([]);
  });

  it('requires explicit approval for a branded demo org in production-like runtimes', () => {
    const policy = resolveDemoPolicy({
      NODE_ENV: 'production',
      DEMO_ORG_ID: 'atelier',
      DEMO_ORG_NAME: 'Atelier',
    });

    expect(policy.usesNonDefaultDemoOrgId).toBe(true);
    expect(policy.explicitApprovalEnabled).toBe(false);
    expect(policy.errors[0]).toContain('DEMO_ORG_ID=atelier');
  });

  it('accepts atelier as a demo org when explicitly approved', () => {
    const policy = resolveDemoPolicy({
      NODE_ENV: 'production',
      DEMO_ORG_ID: 'atelier',
      DEMO_ORG_NAME: 'Atelier',
      ALLOW_ATELIER_AS_DEMO_ORG: 'true',
    });

    expect(policy.usesNonDefaultDemoOrgId).toBe(true);
    expect(policy.explicitApprovalEnabled).toBe(true);
    expect(policy.approvedBy).toEqual(['ALLOW_ATELIER_AS_DEMO_ORG']);
    expect(policy.errors).toEqual([]);
  });
});
