import { describe, expect, it, vi } from 'vitest';

import { verifyDomainTxt } from '../domainVerificationService.js';

describe('verifyDomainTxt', () => {
  it('verifies an exact TXT value on the prefixed name', async () => {
    const resolver = vi
      .fn()
      .mockResolvedValueOnce([['consultify-domain-verification=abc']])
      .mockRejectedValueOnce(Object.assign(new Error('no data'), { code: 'ENODATA' }));
    expect((await verifyDomainTxt('example.com', 'abc', { resolveTxt: resolver })).status).toBe(
      'verified'
    );
  });

  it('joins TXT chunks before exact comparison', async () => {
    const resolver = vi
      .fn()
      .mockResolvedValueOnce([['consultify-domain-', 'verification=abc']])
      .mockRejectedValueOnce(Object.assign(new Error('no data'), { code: 'ENODATA' }));
    expect((await verifyDomainTxt('example.com', 'abc', { resolveTxt: resolver })).status).toBe(
      'verified'
    );
  });

  it('reports a mismatched token', async () => {
    const resolver = vi.fn().mockResolvedValue([['consultify-domain-verification=wrong']]);
    const result = await verifyDomainTxt('example.com', 'abc', { resolveTxt: resolver });
    expect(result.status).toBe('token_mismatch');
    expect(result.foundRecordCount).toBe(2);
  });

  it('maps ENOTFOUND without throwing', async () => {
    const resolver = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOTFOUND' }));
    expect((await verifyDomainTxt('missing.test', 'abc', { resolveTxt: resolver })).status).toBe(
      'domain_not_found'
    );
  });

  it('returns timeout within the configured budget', async () => {
    const resolver = vi.fn(() => new Promise<string[][]>(() => undefined));
    const started = Date.now();
    const result = await verifyDomainTxt('slow.test', 'abc', {
      resolveTxt: resolver,
      timeoutMs: 20,
    });
    expect(result.status).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(250);
  });
});
