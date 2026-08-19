/**
 * R1 Smoke: V4-ENT-05,06 — SSO Service
 * Verifies: OIDC/SAML URL building, state/nonce generation
 */

import {
  buildOIDCAuthUrl,
  generateState,
  generateNonce,
  buildSAMLAuthnRequest,
  getUserInfo,
} from '../../../../server/src/services/ssoService.js';

describe('V4-ENT-05/06: SSO Service', () => {
  it('generateState() returns a non-empty string', () => {
    const state = generateState();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('generateNonce() returns a non-empty string', () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('buildOIDCAuthUrl() returns a URL string', () => {
    const url = buildOIDCAuthUrl({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: 'test-client-id',
      redirectUri: 'https://app.example.com/callback',
      scope: 'openid email profile',
      state: 'test-state',
      nonce: 'test-nonce',
    });
    expect(typeof url).toBe('string');
    expect(url).toContain('https://accounts.google.com');
    expect(url).toContain('client_id=test-client-id');
  });

  it('buildSAMLAuthnRequest() returns a string', () => {
    const request = buildSAMLAuthnRequest({
      entityId: 'https://app.example.com',
      acsUrl: 'https://app.example.com/saml/acs',
      ssoUrl: 'https://idp.example.com/sso',
    });
    expect(typeof request).toBe('string');
    expect(request.length).toBeGreaterThan(0);
  });

  it('reads OIDC identity only from the authenticated userinfo endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ sub: 'subject-1', email: 'owner@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const identity = await getUserInfo(
      {
        issuer: 'https://issuer.example.com',
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
        scopes: 'openid profile email',
        userinfoEndpoint: 'https://issuer.example.com/userinfo',
      },
      'provider-access-token'
    );

    expect(identity).toEqual({ sub: 'subject-1', email: 'owner@example.com' });
    expect(fetchSpy).toHaveBeenCalledWith('https://issuer.example.com/userinfo', {
      headers: { Authorization: 'Bearer provider-access-token' },
    });
    fetchSpy.mockRestore();
  });
});
