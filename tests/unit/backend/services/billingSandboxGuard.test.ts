/**
 * Billing Sandbox Guard tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertSandboxAllowed,
  isAllowedSandboxOrgId,
  isBillingSandbox,
} from '@/../server/src/services/billing/billingSandboxGuard';

const ORIGINAL_MODE = process.env.BILLING_SANDBOX_MODE;
const ORIGINAL_PREFIXES = process.env.BILLING_SANDBOX_ALLOWED_PREFIXES;

describe('billingSandboxGuard', () => {
  beforeEach(() => {
    delete process.env.BILLING_SANDBOX_MODE;
    delete process.env.BILLING_SANDBOX_ALLOWED_PREFIXES;
  });

  afterEach(() => {
    if (ORIGINAL_MODE === undefined) delete process.env.BILLING_SANDBOX_MODE;
    else process.env.BILLING_SANDBOX_MODE = ORIGINAL_MODE;
    if (ORIGINAL_PREFIXES === undefined) delete process.env.BILLING_SANDBOX_ALLOWED_PREFIXES;
    else process.env.BILLING_SANDBOX_ALLOWED_PREFIXES = ORIGINAL_PREFIXES;
  });

  it('is disabled by default', () => {
    expect(isBillingSandbox()).toBe(false);
  });

  it('allows any mutation when sandbox mode is off (no-op)', () => {
    process.env.BILLING_SANDBOX_MODE = 'false';
    expect(() => assertSandboxAllowed('real-tenant', 'billing.upsertOrgBilling')).not.toThrow();
  });

  it('blocks unrelated org ids when sandbox mode is enabled', () => {
    process.env.BILLING_SANDBOX_MODE = 'true';
    expect(() => assertSandboxAllowed('real-tenant', 'billing.upsertOrgBilling')).toThrow(
      /Billing sandbox mode/
    );
  });

  it('allows default qa- prefixes when sandbox mode is enabled', () => {
    process.env.BILLING_SANDBOX_MODE = 'true';
    expect(isAllowedSandboxOrgId('qa-superadmin-org')).toBe(true);
    expect(isAllowedSandboxOrgId('sandbox-acme')).toBe(true);
    expect(() => assertSandboxAllowed('qa-superadmin-org', 'billing.upsertOrgBilling')).not.toThrow();
  });

  it('honors a custom allowed prefix list when configured', () => {
    process.env.BILLING_SANDBOX_MODE = 'true';
    process.env.BILLING_SANDBOX_ALLOWED_PREFIXES = 'tst-,demo-';
    expect(isAllowedSandboxOrgId('qa-superadmin-org')).toBe(false);
    expect(isAllowedSandboxOrgId('demo-acme')).toBe(true);
    expect(() => assertSandboxAllowed('demo-acme', 'billing.upsertOrgBilling')).not.toThrow();
  });

  it('throws AppError shape with code BILLING_SANDBOX_BLOCKED', () => {
    process.env.BILLING_SANDBOX_MODE = 'true';
    try {
      assertSandboxAllowed('real-tenant', 'billing.upsertOrgBilling');
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err?.code).toBe('BILLING_SANDBOX_BLOCKED');
      expect(err?.statusCode).toBe(403);
      expect(err?.details?.action).toBe('billing.upsertOrgBilling');
    }
  });
});
