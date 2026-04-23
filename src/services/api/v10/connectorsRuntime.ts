import { fetchWithRetry, handleDataResponse } from '../baseClient';

export type ConnectorsRuntimeStatus = 'succeeded' | 'fallback';
export type ConnectorsRuntimeEndpointState =
  | 'ok'
  | 'missing_endpoint'
  | 'not_implemented'
  | 'backend_error';
export type ConnectorsConnectorKind = 'external' | 'virtual' | 'manual';
export type ConnectorsConnectorAvailability = 'available' | 'planned';
export type ConnectorsConnectorWave = 'wave_a' | 'wave_b' | 'wave_c';
export type ConnectorsConnectorAuthStrategy =
  | 'oauth2_pkce'
  | 'oauth2_device_code'
  | 'api_key'
  | 'service_account'
  | 'manual_upload'
  | 'none';
export type ConnectorsConnectorCategory =
  | 'knowledge_base'
  | 'communication'
  | 'storage'
  | 'productivity'
  | 'finance'
  | 'security'
  | 'manual_input';
export type ConnectorsConnectorCapabilityFlag =
  | 'search'
  | 'read_doc'
  | 'list_recent'
  | 'sync_delta'
  | 'acl_probe'
  | 'webhook_ingest'
  | 'write_doc'
  | 'write_message'
  | 'send_email'
  | 'create_ticket'
  | 'calendar_read';

export type ConnectorsFetchRequest = {
  url: string;
  now?: string;
};

export type ConnectorsFetchResponse = {
  requestId: string;
  now: string;
  url: string;
  status: ConnectorsRuntimeStatus;
  endpointState: ConnectorsRuntimeEndpointState;
  httpStatus: number | null;
  snippet: string;
};

export type ConnectorsCatalogItem = {
  id: string;
  kind: ConnectorsConnectorKind;
  availability: ConnectorsConnectorAvailability;
  wave: ConnectorsConnectorWave;
  name: string;
  description: string;
  category: ConnectorsConnectorCategory;
  authStrategy: ConnectorsConnectorAuthStrategy;
  capabilities: ConnectorsConnectorCapabilityFlag[];
  readScopes: string[];
  writeScopes: string[];
  aliases: string[];
  recommendedPersonas: string[];
  entrySurfaces: string[];
  enabledByDefault: boolean;
  recommended: boolean;
};

export type ConnectorsCatalogResponse = {
  generatedAt: string;
  persona: string | null;
  connectors: ConnectorsCatalogItem[];
  summary: {
    total: number;
    available: number;
    planned: number;
    external: number;
    manual: number;
    virtual: number;
  };
};

export type ConnectorsCatalogDetailResponse = {
  generatedAt: string;
  connector: ConnectorsCatalogItem;
};

export type ConnectorsSessionStatus = 'connected' | 'pending' | 'needs_reauth' | 'disconnected';
export type ConnectorsSessionMode = 'manual' | 'oauth_stub';

export type ConnectorsSessionRecord = {
  sessionId: string;
  connectorId: string;
  tenantId: string;
  userId: string;
  userRole: string | null;
  status: ConnectorsSessionStatus;
  mode: ConnectorsSessionMode;
  availability: ConnectorsConnectorAvailability;
  readScopes: string[];
  writeScopes: string[];
  requestedScopes: string[];
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  tokenStatus: 'missing' | 'stored' | 'revoked';
  tokenExpiresAt: string | null;
  tokenLastRotatedAt: string | null;
  connector: ConnectorsCatalogItem;
};

export type ConnectorsSessionListResponse = {
  generatedAt: string;
  sessions: ConnectorsSessionRecord[];
  summary: {
    total: number;
    connected: number;
    pending: number;
    needsReauth: number;
    disconnected: number;
  };
};

export type ConnectorsSessionMutationResponse = {
  generatedAt: string;
  session: ConnectorsSessionRecord;
};

export type ConnectorsAuthChallengeStatus = 'pending' | 'completed' | 'denied' | 'failed' | 'expired';

export type ConnectorsAuthChallenge = {
  challengeId: string;
  connectorId: string;
  sessionId: string;
  authStrategy: ConnectorsConnectorAuthStrategy;
  status: ConnectorsAuthChallengeStatus;
  state: string;
  authorizeUrl: string;
  redirectUri: string | null;
  requestedScopes: string[];
  pkceRequired: boolean;
  expiresAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ConnectorsAuthStartResponse = {
  generatedAt: string;
  challenge: ConnectorsAuthChallenge;
  session: ConnectorsSessionRecord;
};

export type ConnectorsAuthCompleteResponse = {
  generatedAt: string;
  challenge: ConnectorsAuthChallenge;
  session: ConnectorsSessionRecord;
};

export type ConnectorsSourceRef = {
  sourceId: string;
  connectorId: string;
  vendorType: string;
  vendorId: string;
  title: string;
  uri: string;
  snippet: string;
  mimeType: string;
  lastModifiedAt: string;
  freshnessAt: string;
  aclFingerprint: string;
  accessConfidence: 'high' | 'medium' | 'low';
};

export type ConnectorsSearchDiagnostic = {
  connectorId: string;
  status: 'searched' | 'skipped' | 'not_supported' | 'needs_connection' | 'needs_reauth' | 'not_implemented';
  reason: string | null;
};

export type ConnectorsSearchResponse = {
  generatedAt: string;
  query: string;
  sources: ConnectorsSourceRef[];
  diagnostics: ConnectorsSearchDiagnostic[];
};

export type ConnectorsReadSourceResponse = {
  generatedAt: string;
  source: ConnectorsSourceRef;
  content: string;
};

export type ConnectorsTokenRefreshResponse = {
  generatedAt: string;
  session: ConnectorsSessionRecord;
  tokenStatus: 'stored' | 'revoked';
  tokenExpiresAt: string | null;
  tokenLastRotatedAt: string | null;
};

export const ConnectorsRuntimeApi = {
  fetch: async (body: ConnectorsFetchRequest): Promise<ConnectorsFetchResponse> => {
    const res = await fetchWithRetry('/api/v10/connectors-runtime/fetch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ConnectorsFetchResponse>(res, 'Failed to fetch connector source');
  },

  listCatalog: async (query?: {
    persona?: string | null;
    includePlanned?: boolean;
  }): Promise<ConnectorsCatalogResponse> => {
    const params = new URLSearchParams();
    if (query?.persona) params.set('persona', query.persona);
    if (typeof query?.includePlanned === 'boolean') {
      params.set('includePlanned', String(query.includePlanned));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchWithRetry(`/api/v10/connectors-runtime/catalog${suffix}`, {
      method: 'GET',
    });
    return handleDataResponse<ConnectorsCatalogResponse>(res, 'Failed to load connector catalog');
  },

  getConnector: async (connectorId: string): Promise<ConnectorsCatalogDetailResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}`,
      { method: 'GET' }
    );
    return handleDataResponse<ConnectorsCatalogDetailResponse>(res, 'Failed to load connector details');
  },

  listSessions: async (): Promise<ConnectorsSessionListResponse> => {
    const res = await fetchWithRetry('/api/v10/connectors-runtime/sessions', { method: 'GET' });
    return handleDataResponse<ConnectorsSessionListResponse>(res, 'Failed to load connector sessions');
  },

  connectConnector: async (connectorId: string, body?: {
    requestedScopes?: string[];
    mode?: ConnectorsSessionMode;
  }): Promise<ConnectorsSessionMutationResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}/connect`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return handleDataResponse<ConnectorsSessionMutationResponse>(res, 'Failed to connect connector');
  },

  startAuth: async (
    connectorId: string,
    body?: { requestedScopes?: string[]; redirectUri?: string }
  ): Promise<ConnectorsAuthStartResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}/auth/start`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return handleDataResponse<ConnectorsAuthStartResponse>(res, 'Failed to start connector auth');
  },

  completeAuth: async (
    connectorId: string,
    body?: {
      challengeId?: string;
      authorizationCode?: string;
      result?: 'authorized' | 'denied' | 'failed';
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<ConnectorsAuthCompleteResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}/auth/complete`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return handleDataResponse<ConnectorsAuthCompleteResponse>(res, 'Failed to complete connector auth');
  },

  disconnectConnector: async (
    connectorId: string,
    body?: { reason?: string }
  ): Promise<ConnectorsSessionMutationResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}/disconnect`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return handleDataResponse<ConnectorsSessionMutationResponse>(res, 'Failed to disconnect connector');
  },

  search: async (body: {
    query: string;
    connectorIds?: string[];
    limit?: number;
  }): Promise<ConnectorsSearchResponse> => {
    const res = await fetchWithRetry('/api/v10/connectors-runtime/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ConnectorsSearchResponse>(res, 'Failed to search connector sources');
  },

  readSource: async (body: {
    connectorId: string;
    sourceId: string;
  }): Promise<ConnectorsReadSourceResponse> => {
    const res = await fetchWithRetry('/api/v10/connectors-runtime/sources/read', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ConnectorsReadSourceResponse>(res, 'Failed to read connector source');
  },

  refreshTokens: async (
    connectorId: string,
    body?: { reason?: string }
  ): Promise<ConnectorsTokenRefreshResponse> => {
    const res = await fetchWithRetry(
      `/api/v10/connectors-runtime/connectors/${encodeURIComponent(connectorId)}/tokens/refresh`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return handleDataResponse<ConnectorsTokenRefreshResponse>(res, 'Failed to refresh connector token');
  },
};
