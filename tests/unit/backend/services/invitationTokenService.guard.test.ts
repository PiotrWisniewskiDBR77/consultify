import { describe, expect, it } from 'vitest';

import { InvitationTokenService } from '../../../../server/src/services/invitation/InvitationTokenService.js';

describe('InvitationTokenService canonical token guard', () => {
  const service = new InvitationTokenService();

  it('accepts a 64-char hex token', () => {
    expect(service.isCanonicalInvitationRawToken('a'.repeat(64))).toBe(true);
  });

  it('rejects malformed invitation token shapes', () => {
    expect(service.isCanonicalInvitationRawToken('')).toBe(false);
    expect(service.isCanonicalInvitationRawToken('   ')).toBe(false);
    expect(service.isCanonicalInvitationRawToken('a'.repeat(63))).toBe(false);
    expect(service.isCanonicalInvitationRawToken('a'.repeat(65))).toBe(false);
    expect(service.isCanonicalInvitationRawToken('g'.repeat(64))).toBe(false);
  });
});
