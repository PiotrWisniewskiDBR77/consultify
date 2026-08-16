import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  generateAuthUrl,
  getConnectorAvailability,
  getConnectorConfig,
  isConnectorApproved,
  isConnectorConfigured,
} from '../../../server/src/services/integrationOAuthEngine.ts';

const savedEnv = { ...process.env };

describe('Settings integration OAuth approval boundary', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'gmail-client';
    process.env.GOOGLE_CLIENT_SECRET = 'gmail-secret';
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('does not configure or start an OAuth connector from credentials alone', () => {
    expect(isConnectorApproved('gmail')).toBe(false);
    expect(isConnectorConfigured('gmail')).toBe(false);
    expect(generateAuthUrl('gmail', 'user-1', 'org-1')).toBeNull();
    expect(getConnectorAvailability().gmail).toEqual(
      expect.objectContaining({ configured: false, approved: false, authType: 'oauth2' })
    );
  });

  it('rejects a scope expansion and enables only an exact scoped residency decision', () => {
    const scopes = getConnectorConfig('gmail')?.scopes || [];
    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: {
        approved: true,
        scopes: [...scopes, 'https://www.googleapis.com/auth/drive'],
        residency: 'EU',
      },
    });
    expect(isConnectorApproved('gmail')).toBe(false);

    process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
      gmail: { approved: true, scopes, residency: 'EU' },
    });
    expect(isConnectorApproved('gmail')).toBe(true);
    expect(isConnectorConfigured('gmail')).toBe(true);
    const generated = generateAuthUrl('gmail', 'user-1', 'org-1');
    expect(generated?.url).toContain('scope=');
    expect(generated?.url).not.toContain('gmail-secret');
    expect(getConnectorAvailability().gmail).toEqual(
      expect.objectContaining({ configured: true, approved: true, residency: 'EU' })
    );
  });
});
