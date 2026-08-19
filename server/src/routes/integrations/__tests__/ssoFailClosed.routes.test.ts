import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  all: dbAll,
  get: dbGet,
  run: dbRun,
}));

const { default: ssoRouter } = await import('../sso.routes.js');

function mountedApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sso', ssoRouter);
  return app;
}

describe('mounted SSO public authentication is fail-closed without cryptographic verifiers', () => {
  beforeEach(() => {
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
  });

  it.each([
    ['get', '/api/sso/saml/login', 'SAML_SIGNATURE_VERIFICATION_UNAVAILABLE'],
    ['post', '/api/sso/saml/callback', 'SAML_SIGNATURE_VERIFICATION_UNAVAILABLE'],
    ['get', '/api/sso/oidc/authorize', 'OIDC_TOKEN_VERIFICATION_UNAVAILABLE'],
    ['post', '/api/sso/oidc/callback', 'OIDC_TOKEN_VERIFICATION_UNAVAILABLE'],
  ] as const)('%s %s denies before state, user, session or token writes', async (method, path, code) => {
    const call = request(mountedApp())[method](path);
    const response =
      method === 'post'
        ? await call.send(
            path.includes('/saml/')
              ? { SAMLResponse: 'unsigned-assertion', RelayState: 'attacker-state' }
              : { code: 'unverified-code', state: 'attacker-state' }
          )
        : await call.query({ domain: 'attacker.example', organizationId: 'foreign-org' });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code });
    expect(response.body.token).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.state).toBeUndefined();
    expect(dbAll).not.toHaveBeenCalled();
    expect(dbGet).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('retains deterministic 400 responses for structurally missing callback inputs', async () => {
    const saml = await request(mountedApp()).post('/api/sso/saml/callback').send({});
    const oidc = await request(mountedApp()).post('/api/sso/oidc/callback').send({});

    expect(saml.status).toBe(400);
    expect(oidc.status).toBe(400);
    expect(dbGet).not.toHaveBeenCalled();
    expect(dbRun).not.toHaveBeenCalled();
  });
});
