import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const savedEnv = { ...process.env };

describe('OAuth approved-provider registry', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_ID = 'configured-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'configured-google-secret';
    process.env.LINKEDIN_CLIENT_ID = 'configured-linkedin-client';
    process.env.LINKEDIN_CLIENT_SECRET = 'configured-linkedin-secret';
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('keeps every provider disabled when no approval decision exists, despite credentials', async () => {
    const { oauthService } = await import('../../../server/src/services/oauthService.ts');

    expect(oauthService.getProviderStatus()).toEqual({
      google: { configured: false, approved: false, loginUrl: '' },
      microsoft: { configured: false, approved: false, loginUrl: '' },
      linkedin: { configured: false, approved: false, loginUrl: '' },
    });
    expect(oauthService.generateAuthUrl('google')).toBeNull();
    expect(oauthService.generateAuthUrl('linkedin')).toBeNull();
  });

  it('rejects malformed, partial, over-broad, or residency-free decisions', async () => {
    const { getApprovedOAuthProviderDecision } =
      await import('../../../server/src/services/oauthService.ts');

    for (const decision of [
      '{not-json',
      JSON.stringify({ google: { approved: true, scopes: ['openid', 'email', 'profile'] } }),
      JSON.stringify({
        google: {
          approved: true,
          scopes: ['openid', 'email', 'profile', 'drive.readonly'],
          residency: 'EU',
        },
      }),
    ]) {
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = decision;
      expect(getApprovedOAuthProviderDecision('google')).toBeNull();
    }
  });

  it('enables only the exactly approved provider and publishes no secret material', async () => {
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      google: {
        approved: true,
        scopes: ['openid', 'email', 'profile'],
        residency: 'EU',
      },
    });
    const { oauthService } = await import('../../../server/src/services/oauthService.ts');

    const status = oauthService.getProviderStatus();
    expect(status.google).toEqual({
      configured: true,
      approved: true,
      loginUrl: '/api/auth/google',
      residency: 'EU',
    });
    expect(status.linkedin).toEqual({ configured: false, approved: false, loginUrl: '' });
    expect(JSON.stringify(status)).not.toContain('configured-google-secret');
    expect(oauthService.generateAuthUrl('google')?.url).toContain('scope=openid+email+profile');
    expect(oauthService.generateAuthUrl('linkedin')).toBeNull();
  });
});
