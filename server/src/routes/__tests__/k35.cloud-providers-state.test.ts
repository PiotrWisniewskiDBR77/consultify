/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import config from '../../config/Config.js';

const state = vi.hoisted(() => ({
  sources: [] as Array<Record<string, unknown>>,
  connectedProviders: new Set<string>(),
}));

vi.mock('../../services/cloudDataService.js', () => ({
  listCloudSources: vi.fn(async () => state.sources),
}));

vi.mock('../../services/integrationOAuthEngine.js', () => ({
  getStoredToken: vi.fn(async (_userId: string, provider: string) =>
    state.connectedProviders.has(provider)
      ? { accessToken: 'token', refreshToken: null, expiresAt: null, status: 'active' }
      : null
  ),
}));

const buildApp = async () => {
  const { default: cloudRoutes } = await import('../cloud.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/cloud', cloudRoutes);
  return app;
};

const authToken = jwt.sign(
  {
    id: 'user-k35',
    userId: 'user-k35',
    organizationId: 'org-k35',
    role: 'OWNER',
    email: 'k35@example.invalid',
  },
  config.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '10m' }
);

describe('K-35 cloud provider state', () => {
  beforeEach(() => {
    state.sources = [];
    state.connectedProviders.clear();
  });

  it('does not mark a provider connected from a stale Cloud Source row without a live OAuth token', async () => {
    state.sources = [{ provider: 'google_drive', name: 'Stale Drive' }];
    const app = await buildApp();

    const stale = await request(app)
      .get('/api/cloud/providers')
      .set('Authorization', `Bearer ${authToken}`);
    const staleGoogle = stale.body.providers.find((p: any) => p.id === 'google-drive');
    console.log('K35_PROVIDERS_STALE_HTTP', stale.status, JSON.stringify(staleGoogle));

    expect(stale.status).toBe(200);
    expect(staleGoogle.sourceConfigured).toBe(true);
    expect(staleGoogle.connected).toBe(false);

    state.connectedProviders.add('google_drive');
    const connected = await request(app)
      .get('/api/cloud/providers')
      .set('Authorization', `Bearer ${authToken}`);
    const connectedGoogle = connected.body.providers.find((p: any) => p.id === 'google-drive');
    console.log('K35_PROVIDERS_TOKEN_HTTP', connected.status, JSON.stringify(connectedGoogle));

    expect(connected.status).toBe(200);
    expect(connectedGoogle.sourceConfigured).toBe(true);
    expect(connectedGoogle.connected).toBe(true);
  });
});
