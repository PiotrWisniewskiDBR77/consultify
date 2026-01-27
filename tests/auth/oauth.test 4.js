/**
 * OAuth Tests
 * Tests for OAuth 2.0 authentication flows
 *
 * @module tests/auth/oauth.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// OAuth client implementation
const createOAuthClient = (config) => {
  const { clientId, clientSecret, authorizationUrl, tokenUrl, redirectUri, scopes = [] } = config;

  let accessToken = null;
  let refreshToken = null;
  let tokenExpiry = null;
  let state = null;

  let mockFetch = vi.fn();

  const generateState = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const generateCodeVerifier = () => {
    return Math.random().toString(36).substring(2, 50);
  };

  const generateCodeChallenge = (verifier) => {
    // Simplified - in real code use SHA256
    return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  return {
    getAuthorizationUrl: (options = {}) => {
      state = generateState();
      const { responseType = 'code', additionalScopes = [] } = options;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope: [...scopes, ...additionalScopes].join(' '),
        state,
      });

      return `${authorizationUrl}?${params.toString()}`;
    },

    // PKCE support
    getAuthorizationUrlWithPKCE: () => {
      state = generateState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      return {
        url: `${authorizationUrl}?${params.toString()}`,
        codeVerifier,
      };
    },

    handleCallback: async (callbackUrl) => {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (returnedState !== state) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens
      const response = await mockFetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      accessToken = response.access_token;
      refreshToken = response.refresh_token;
      tokenExpiry = Date.now() + response.expires_in * 1000;

      return { accessToken, refreshToken, expiresIn: response.expires_in };
    },

    refreshAccessToken: async () => {
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await mockFetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      accessToken = response.access_token;
      if (response.refresh_token) {
        refreshToken = response.refresh_token;
      }
      tokenExpiry = Date.now() + response.expires_in * 1000;

      return { accessToken, expiresIn: response.expires_in };
    },

    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    isTokenExpired: () => (tokenExpiry ? Date.now() > tokenExpiry : true),
    getState: () => state,

    logout: () => {
      accessToken = null;
      refreshToken = null;
      tokenExpiry = null;
      state = null;
    },

    _setMockFetch: (fn) => {
      mockFetch = fn;
    },
  };
};

// OAuth provider registry
const createOAuthProviderRegistry = () => {
  const providers = new Map();

  return {
    register: (name, config) => {
      providers.set(name, createOAuthClient(config));
    },

    get: (name) => {
      return providers.get(name);
    },

    getNames: () => [...providers.keys()],

    unregister: (name) => {
      providers.delete(name);
    },
  };
};

// Token storage
const createTokenStorage = () => {
  const tokens = new Map();

  return {
    save: (provider, tokenData) => {
      tokens.set(provider, {
        ...tokenData,
        savedAt: Date.now(),
      });
    },

    load: (provider) => {
      return tokens.get(provider);
    },

    remove: (provider) => {
      tokens.delete(provider);
    },

    isExpired: (provider) => {
      const token = tokens.get(provider);
      if (!token) return true;
      return Date.now() > token.savedAt + token.expiresIn * 1000;
    },

    clear: () => {
      tokens.clear();
    },
  };
};

describe('OAuth Client Tests', () => {
  let client;

  beforeEach(() => {
    client = createOAuthClient({
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      redirectUri: 'https://app.example.com/callback',
      scopes: ['openid', 'profile', 'email'],
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUTHORIZATION URL
  // ═══════════════════════════════════════════════════════════════════

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL', () => {
      const url = client.getAuthorizationUrl();

      expect(url).toContain('https://auth.example.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
    });

    it('should include scopes', () => {
      const url = client.getAuthorizationUrl();

      expect(url).toContain('scope=openid');
    });

    it('should include state', () => {
      const url = client.getAuthorizationUrl();

      expect(url).toContain('state=');
      expect(client.getState()).toBeTruthy();
    });

    it('should add additional scopes', () => {
      const url = client.getAuthorizationUrl({ additionalScopes: ['offline_access'] });

      expect(url).toContain('offline_access');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PKCE
  // ═══════════════════════════════════════════════════════════════════

  describe('PKCE', () => {
    it('should generate PKCE parameters', () => {
      const { url, codeVerifier } = client.getAuthorizationUrlWithPKCE();

      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(codeVerifier).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CALLBACK
  // ═══════════════════════════════════════════════════════════════════

  describe('handleCallback', () => {
    beforeEach(() => {
      client._setMockFetch(
        vi.fn().mockResolvedValue({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        })
      );
    });

    it('should exchange code for tokens', async () => {
      client.getAuthorizationUrl(); // Generate state
      const state = client.getState();

      const result = await client.handleCallback(
        `https://app.example.com/callback?code=auth-code&state=${state}`
      );

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
    });

    it('should validate state', async () => {
      client.getAuthorizationUrl();

      await expect(
        client.handleCallback('https://app.example.com/callback?code=auth-code&state=wrong-state')
      ).rejects.toThrow('State mismatch');
    });

    it('should handle error response', async () => {
      client.getAuthorizationUrl();

      await expect(
        client.handleCallback('https://app.example.com/callback?error=access_denied')
      ).rejects.toThrow('OAuth error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REFRESH TOKEN
  // ═══════════════════════════════════════════════════════════════════

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      client._setMockFetch(
        vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          expires_in: 3600,
        })
      );

      // First get tokens
      client.getAuthorizationUrl();
      client._setMockFetch(
        vi.fn().mockResolvedValue({
          access_token: 'old-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
        })
      );
      await client.handleCallback(
        `https://app.example.com/callback?code=code&state=${client.getState()}`
      );

      // Now refresh
      client._setMockFetch(
        vi.fn().mockResolvedValue({
          access_token: 'new-access-token',
          expires_in: 3600,
        })
      );
      const result = await client.refreshAccessToken();

      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw without refresh token', async () => {
      await expect(client.refreshAccessToken()).rejects.toThrow('No refresh token');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════

  describe('logout', () => {
    it('should clear tokens', async () => {
      client.getAuthorizationUrl();
      client._setMockFetch(
        vi.fn().mockResolvedValue({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
        })
      );
      await client.handleCallback(
        `https://app.example.com/callback?code=code&state=${client.getState()}`
      );

      client.logout();

      expect(client.getAccessToken()).toBeNull();
      expect(client.getRefreshToken()).toBeNull();
    });
  });
});

describe('OAuth Provider Registry Tests', () => {
  let registry;

  beforeEach(() => {
    registry = createOAuthProviderRegistry();
  });

  it('should register provider', () => {
    registry.register('google', {
      clientId: 'google-client',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: 'https://app.com/callback',
    });

    expect(registry.get('google')).toBeDefined();
  });

  it('should list providers', () => {
    registry.register('google', {
      clientId: 'a',
      authorizationUrl: '',
      tokenUrl: '',
      redirectUri: '',
    });
    registry.register('github', {
      clientId: 'b',
      authorizationUrl: '',
      tokenUrl: '',
      redirectUri: '',
    });

    expect(registry.getNames()).toContain('google');
    expect(registry.getNames()).toContain('github');
  });
});

describe('Token Storage Tests', () => {
  let storage;

  beforeEach(() => {
    storage = createTokenStorage();
  });

  it('should save and load tokens', () => {
    storage.save('google', { accessToken: 'token', expiresIn: 3600 });

    const loaded = storage.load('google');
    expect(loaded.accessToken).toBe('token');
  });

  it('should check expiry', () => {
    storage.save('google', { accessToken: 'token', expiresIn: -1 });

    expect(storage.isExpired('google')).toBe(true);
  });

  it('should remove tokens', () => {
    storage.save('google', { accessToken: 'token', expiresIn: 3600 });
    storage.remove('google');

    expect(storage.load('google')).toBeUndefined();
  });
});
