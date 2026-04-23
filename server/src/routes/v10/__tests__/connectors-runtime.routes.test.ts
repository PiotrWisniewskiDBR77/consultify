import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  ConnectorsRuntimeBackendError,
  ConnectorsRuntimeInputError,
} from '../../../models/v10/pipelines/ConnectorsFetchPipeline.js';
import { ConnectorsRegistryNotFoundError } from '../../../services/v10/connectors/connectorsRegistryService.js';
import {
  ConnectorsRuntimeAuthChallengeNotFoundError,
  ConnectorsRuntimeSessionInputError,
  ConnectorsRuntimeSessionNotFoundError,
  ConnectorsRuntimeSourceNotFoundError,
  ConnectorsRuntimeTokenVaultError,
} from '../../../services/v10/connectors/connectorsRuntimeService.js';
import type { ConnectorsFetchResponse } from '../../../types/v10/connectors-runtime.js';
import { createConnectorsRuntimeRouter } from '../connectors-runtime.routes.js';

type MockAuthRequest = {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
};

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'route-user';
    req.organizationId = 'route-org';
    req.userRole = 'ADMIN';
    req.user = {
      id: 'route-user',
      organizationId: 'route-org',
      role: 'ADMIN',
    };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

function createApp(service: {
  fetch: (input: unknown) => Promise<ConnectorsFetchResponse>;
  search?: (input: unknown) => unknown;
  readSource?: (input: unknown) => unknown;
  listCatalog?: (input: unknown) => unknown;
  getConnector?: (connectorId: string) => unknown;
  listSessions?: (input: unknown) => unknown;
  connectConnector?: (input: unknown) => unknown;
  startAuth?: (input: unknown) => unknown;
  completeAuth?: (input: unknown) => unknown;
  refreshTokens?: (input: unknown) => unknown;
  disconnectConnector?: (input: unknown) => unknown;
}) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/connectors-runtime', createConnectorsRuntimeRouter(service as any));
  return app;
}

describe('connectors-runtime.routes', () => {
  it('returns connector catalog metadata', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(() => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        persona: 'CFO',
        connectors: [
          {
            id: 'erp',
            kind: 'virtual',
            availability: 'planned',
            wave: 'wave_b',
            name: 'ERP Stack',
            description: 'Finance systems',
            category: 'finance',
            authStrategy: 'oauth2_pkce',
            capabilities: ['search'],
            readScopes: [],
            writeScopes: [],
            aliases: ['sap'],
            recommendedPersonas: ['CFO'],
            entrySurfaces: ['artifact_seed'],
            enabledByDefault: false,
            recommended: true,
          },
        ],
        summary: {
          total: 1,
          available: 0,
          planned: 1,
          external: 0,
          manual: 0,
          virtual: 1,
        },
      })),
      getConnector: vi.fn(),
    };

    const res = await request(createApp(service as any)).get(
      '/api/v10/connectors-runtime/catalog?persona=CFO&includePlanned=true'
    );

    expect(res.status).toBe(200);
    expect(service.listCatalog).toHaveBeenCalledWith({
      persona: 'CFO',
      includePlanned: true,
    });
    expect(res.body.data.summary.planned).toBe(1);
  });

  it('returns connector details by id', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(() => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        connector: {
          id: 'google_drive',
          kind: 'external',
          availability: 'available',
          wave: 'wave_a',
          name: 'Google Drive',
          description: 'Docs',
          category: 'storage',
          authStrategy: 'oauth2_pkce',
          capabilities: ['search'],
          readScopes: ['drive.readonly'],
          writeScopes: [],
          aliases: ['drive'],
          recommendedPersonas: ['CEO'],
          entrySurfaces: ['artifact_seed'],
          enabledByDefault: true,
          recommended: false,
        },
      })),
    };

    const res = await request(createApp(service as any)).get(
      '/api/v10/connectors-runtime/connectors/google_drive'
    );

    expect(res.status).toBe(200);
    expect(service.getConnector).toHaveBeenCalledWith('google_drive');
    expect(res.body.data.connector.id).toBe('google_drive');
  });

  it('maps missing connector details to 404 responses', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(() => {
        throw new ConnectorsRegistryNotFoundError('unknown');
      }),
    };

    const res = await request(createApp(service as any)).get(
      '/api/v10/connectors-runtime/connectors/unknown'
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_CONNECTOR_NOT_FOUND');
  });

  it('returns fallback payloads for missing upstream endpoints', async () => {
    const service = {
      fetch: vi.fn(async () => ({
        requestId: 'run-1',
        now: '2026-04-18T12:00:00.000Z',
        url: 'https://example.com/missing',
        status: 'fallback' as const,
        endpointState: 'missing_endpoint' as const,
        httpStatus: 404,
        snippet: 'Fallback scaffold',
      })),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/connectors-runtime/fetch')
      .send({ url: 'https://example.com/missing' });

    expect(res.status).toBe(200);
    expect(service.fetch).toHaveBeenCalledWith({
      url: 'https://example.com/missing',
    });
    expect(res.body.data.status).toBe('fallback');
    expect(res.body.data.endpointState).toBe('missing_endpoint');
    expect(res.body.data.httpStatus).toBe(404);
  });

  it('maps input errors to 422 responses', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new ConnectorsRuntimeInputError(
          'CONNECTORS_RUNTIME_INVALID_URL',
          'invalid url'
        );
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/connectors-runtime/fetch')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_INVALID_URL');
  });

  it('maps backend errors to upstream-aware error responses', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new ConnectorsRuntimeBackendError(
          'CONNECTORS_RUNTIME_UPSTREAM_5XX',
          'backend exploded',
          502,
          503
        );
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/connectors-runtime/fetch')
      .send({ url: 'https://example.com/api' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_UPSTREAM_5XX');
    expect(res.body.httpStatus).toBe(503);
  });

  it('returns connector sessions for the authenticated scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(() => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        sessions: [],
        summary: { total: 0, connected: 0, pending: 0, needsReauth: 0, disconnected: 0 },
      })),
      connectConnector: vi.fn(),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any)).get('/api/v10/connectors-runtime/sessions');

    expect(res.status).toBe(200);
    expect(service.listSessions).toHaveBeenCalledWith({
      tenantId: 'route-org',
      userId: 'route-user',
      userRole: 'ADMIN',
    });
    expect(res.body.meta.contract).toBe('connectors_runtime_wave_a_v1');
  });

  it('connects a connector session with auth scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(() => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        session: {
          sessionId: 'session-1',
          connectorId: 'google_drive',
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
          status: 'connected',
          mode: 'oauth_stub',
          availability: 'available',
          readScopes: ['drive.readonly'],
          writeScopes: [],
          requestedScopes: ['drive.readonly'],
          createdAt: '2026-04-18T12:00:00.000Z',
          updatedAt: '2026-04-18T12:00:00.000Z',
          lastConnectedAt: '2026-04-18T12:00:00.000Z',
          lastDisconnectedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          connector: {
            id: 'google_drive',
            kind: 'external',
            availability: 'available',
            wave: 'wave_a',
            name: 'Google Drive',
            description: 'Docs',
            category: 'storage',
            authStrategy: 'oauth2_pkce',
            capabilities: ['search'],
            readScopes: ['drive.readonly'],
            writeScopes: [],
            aliases: [],
            recommendedPersonas: ['CEO'],
            entrySurfaces: ['artifact_seed'],
            enabledByDefault: true,
            recommended: false,
          },
        },
      })),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/connect')
      .send({ requestedScopes: ['drive.readonly'] });

    expect(res.status).toBe(200);
    expect(service.connectConnector).toHaveBeenCalledWith({
      requestedScopes: ['drive.readonly'],
      connectorId: 'google_drive',
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('disconnects a connector session and maps missing sessions to 404', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      disconnectConnector: vi.fn(() => {
        throw new ConnectorsRuntimeSessionNotFoundError('slack');
      }),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/slack/disconnect')
      .send({ reason: 'user_requested' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_SESSION_NOT_FOUND');
  });

  it('maps connector session validation errors to 422', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(() => {
        throw new ConnectorsRuntimeSessionInputError(
          'CONNECTORS_RUNTIME_SCOPE_REQUIRED',
          'missing scope'
        );
      }),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/slack/connect')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_SCOPE_REQUIRED');
  });

  it('starts connector auth with auth scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(() => ({
        generatedAt: '2026-04-18T12:00:00.000Z',
        challenge: {
          challengeId: 'challenge-1',
          connectorId: 'google_drive',
          sessionId: 'session-1',
          authStrategy: 'oauth2_pkce',
          status: 'pending',
          state: 'state-1',
          authorizeUrl: 'https://connectors.consultify.local/google_drive/authorize',
          redirectUri: null,
          requestedScopes: ['drive.readonly'],
          pkceRequired: true,
          expiresAt: '2026-04-18T12:10:00.000Z',
          completedAt: null,
          errorCode: null,
          errorMessage: null,
        },
        session: {
          sessionId: 'session-1',
          connectorId: 'google_drive',
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
          status: 'pending',
          mode: 'oauth_stub',
          availability: 'available',
          readScopes: ['drive.readonly'],
          writeScopes: [],
          requestedScopes: ['drive.readonly'],
          createdAt: '2026-04-18T12:00:00.000Z',
          updatedAt: '2026-04-18T12:00:00.000Z',
          lastConnectedAt: null,
          lastDisconnectedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          connector: {
            id: 'google_drive',
            kind: 'external',
            availability: 'available',
            wave: 'wave_a',
            name: 'Google Drive',
            description: 'Docs',
            category: 'storage',
            authStrategy: 'oauth2_pkce',
            capabilities: ['search'],
            readScopes: ['drive.readonly'],
            writeScopes: [],
            aliases: [],
            recommendedPersonas: ['CEO'],
            entrySurfaces: ['artifact_seed'],
            enabledByDefault: true,
            recommended: false,
          },
        },
      })),
      completeAuth: vi.fn(),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/auth/start')
      .send({ requestedScopes: ['drive.readonly'] });

    expect(res.status).toBe(200);
    expect(service.startAuth).toHaveBeenCalledWith({
      requestedScopes: ['drive.readonly'],
      connectorId: 'google_drive',
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('completes connector auth and returns connected session', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(),
      completeAuth: vi.fn(() => ({
        generatedAt: '2026-04-18T12:02:00.000Z',
        challenge: {
          challengeId: 'challenge-1',
          connectorId: 'google_drive',
          sessionId: 'session-1',
          authStrategy: 'oauth2_pkce',
          status: 'completed',
          state: 'state-1',
          authorizeUrl: 'https://connectors.consultify.local/google_drive/authorize',
          redirectUri: null,
          requestedScopes: ['drive.readonly'],
          pkceRequired: true,
          expiresAt: '2026-04-18T12:10:00.000Z',
          completedAt: '2026-04-18T12:02:00.000Z',
          errorCode: null,
          errorMessage: null,
        },
        session: {
          sessionId: 'session-1',
          connectorId: 'google_drive',
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
          status: 'connected',
          mode: 'oauth_stub',
          availability: 'available',
          readScopes: ['drive.readonly'],
          writeScopes: [],
          requestedScopes: ['drive.readonly'],
          createdAt: '2026-04-18T12:00:00.000Z',
          updatedAt: '2026-04-18T12:02:00.000Z',
          lastConnectedAt: '2026-04-18T12:02:00.000Z',
          lastDisconnectedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          connector: {
            id: 'google_drive',
            kind: 'external',
            availability: 'available',
            wave: 'wave_a',
            name: 'Google Drive',
            description: 'Docs',
            category: 'storage',
            authStrategy: 'oauth2_pkce',
            capabilities: ['search'],
            readScopes: ['drive.readonly'],
            writeScopes: [],
            aliases: [],
            recommendedPersonas: ['CEO'],
            entrySurfaces: ['artifact_seed'],
            enabledByDefault: true,
            recommended: false,
          },
        },
      })),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/auth/complete')
      .send({ challengeId: 'challenge-1', authorizationCode: 'stub-code' });

    expect(res.status).toBe(200);
    expect(service.completeAuth).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      authorizationCode: 'stub-code',
      connectorId: 'google_drive',
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('maps missing auth challenges to 404', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(),
      completeAuth: vi.fn(() => {
        throw new ConnectorsRuntimeAuthChallengeNotFoundError('google_drive');
      }),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/auth/complete')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_AUTH_CHALLENGE_NOT_FOUND');
  });

  it('searches connected connector sources with auth scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(() => ({
        generatedAt: '2026-04-18T12:05:00.000Z',
        query: 'board materials',
        sources: [
          {
            sourceId: 'google_drive:document:board-materials-1',
            connectorId: 'google_drive',
            vendorType: 'document',
            vendorId: 'board-materials-1',
            title: 'Board materials',
            uri: 'https://example.com/source',
            snippet: 'snippet',
            mimeType: 'text/plain',
            lastModifiedAt: '2026-04-18T12:00:00.000Z',
            freshnessAt: '2026-04-18T12:00:00.000Z',
            aclFingerprint: 'route-org:google_drive:high',
            accessConfidence: 'high',
          },
        ],
        diagnostics: [{ connectorId: 'google_drive', status: 'searched', reason: null }],
      })),
      readSource: vi.fn(),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(),
      completeAuth: vi.fn(),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/search')
      .send({ query: 'board materials', connectorIds: ['google_drive'] });

    expect(res.status).toBe(200);
    expect(service.search).toHaveBeenCalledWith({
      query: 'board materials',
      connectorIds: ['google_drive'],
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('reads a normalized connector source with auth scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(() => ({
        generatedAt: '2026-04-18T12:06:00.000Z',
        source: {
          sourceId: 'google_drive:document:board-materials-1',
          connectorId: 'google_drive',
          vendorType: 'document',
          vendorId: 'board-materials-1',
          title: 'Board materials',
          uri: 'https://example.com/source',
          snippet: 'snippet',
          mimeType: 'text/plain',
          lastModifiedAt: '2026-04-18T12:00:00.000Z',
          freshnessAt: '2026-04-18T12:00:00.000Z',
          aclFingerprint: 'route-org:google_drive:high',
          accessConfidence: 'high',
        },
        content: 'body',
      })),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(),
      completeAuth: vi.fn(),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/sources/read')
      .send({
        connectorId: 'google_drive',
        sourceId: 'google_drive:document:board-materials-1',
      });

    expect(res.status).toBe(200);
    expect(service.readSource).toHaveBeenCalledWith({
      connectorId: 'google_drive',
      sourceId: 'google_drive:document:board-materials-1',
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('maps missing connector sources to 404', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      search: vi.fn(),
      readSource: vi.fn(() => {
        throw new ConnectorsRuntimeSourceNotFoundError('missing-source');
      }),
      listCatalog: vi.fn(),
      getConnector: vi.fn(),
      listSessions: vi.fn(),
      connectConnector: vi.fn(),
      startAuth: vi.fn(),
      completeAuth: vi.fn(),
      disconnectConnector: vi.fn(),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/sources/read')
      .send({ connectorId: 'google_drive', sourceId: 'missing-source' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_SOURCE_NOT_FOUND');
  });

  it('refreshes connector token vault with auth scope', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      refreshTokens: vi.fn(() => ({
        generatedAt: '2026-04-18T12:10:00.000Z',
        session: {
          sessionId: 'session-1',
          connectorId: 'google_drive',
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
          status: 'connected',
          mode: 'oauth_stub',
          availability: 'available',
          readScopes: ['drive.readonly'],
          writeScopes: [],
          requestedScopes: ['drive.readonly'],
          createdAt: '2026-04-18T12:00:00.000Z',
          updatedAt: '2026-04-18T12:10:00.000Z',
          lastConnectedAt: '2026-04-18T12:10:00.000Z',
          lastDisconnectedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          tokenStatus: 'stored',
          tokenExpiresAt: '2026-04-18T13:10:00.000Z',
          tokenLastRotatedAt: '2026-04-18T12:10:00.000Z',
          connector: {
            id: 'google_drive',
            kind: 'external',
            availability: 'available',
            wave: 'wave_a',
            name: 'Google Drive',
            description: 'Docs',
            category: 'storage',
            authStrategy: 'oauth2_pkce',
            capabilities: ['search'],
            readScopes: ['drive.readonly'],
            writeScopes: [],
            aliases: [],
            recommendedPersonas: ['CEO'],
            entrySurfaces: ['artifact_seed'],
            enabledByDefault: true,
            recommended: false,
          },
        },
        tokenStatus: 'stored',
        tokenExpiresAt: '2026-04-18T13:10:00.000Z',
        tokenLastRotatedAt: '2026-04-18T12:10:00.000Z',
      })),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/tokens/refresh')
      .send({ reason: 'admin_rotate' });

    expect(res.status).toBe(200);
    expect(service.refreshTokens).toHaveBeenCalledWith({
      reason: 'admin_rotate',
      connectorId: 'google_drive',
      scope: {
        tenantId: 'route-org',
        userId: 'route-user',
        userRole: 'ADMIN',
      },
    });
  });

  it('maps missing token vault to 404', async () => {
    const service = {
      fetch: vi.fn(async () => {
        throw new Error('not used');
      }),
      refreshTokens: vi.fn(() => {
        throw new ConnectorsRuntimeTokenVaultError(
          'CONNECTORS_RUNTIME_TOKEN_VAULT_MISSING',
          'No token material stored for this connector session',
          404
        );
      }),
    };

    const res = await request(createApp(service as any))
      .post('/api/v10/connectors-runtime/connectors/google_drive/tokens/refresh')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONNECTORS_RUNTIME_TOKEN_VAULT_MISSING');
  });
});
