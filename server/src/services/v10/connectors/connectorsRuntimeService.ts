import type {
  ConnectorsAuthChallenge,
  ConnectorsAuthChallengeStatus,
  ConnectorsAuthCompleteRequest,
  ConnectorsAuthCompleteResponse,
  ConnectorsAuthStartRequest,
  ConnectorsAuthStartResponse,
  ConnectorsCatalogDetailResponse,
  ConnectorsCatalogResponse,
  ConnectorsFetchRequest,
  ConnectorsFetchResponse,
  ConnectorsReadSourceRequest,
  ConnectorsReadSourceResponse,
  ConnectorsRuntimeScope,
  ConnectorsSearchRequest,
  ConnectorsSearchResponse,
  ConnectorsSourceRef,
  ConnectorsTokenRefreshRequest,
  ConnectorsTokenRefreshResponse,
  ConnectorsSessionConnectRequest,
  ConnectorsSessionDisconnectRequest,
  ConnectorsSessionListResponse,
  ConnectorsSessionMode,
  ConnectorsSessionMutationResponse,
  ConnectorsSessionRecord,
  ConnectorsSessionStatus,
} from '../../../types/v10/connectors-runtime.js';
import {
  connectorsRegistryService,
  type ConnectorsRegistryService,
} from './connectorsRegistryService.js';
import {
  runConnectorsFetchPipeline,
  unsafeConnectorsFetchPipelineRunId,
} from '../../../models/v10/pipelines/ConnectorsFetchPipeline.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';
import { decrypt, encrypt } from '../../encryption/EncryptionService.js';

type StoredConnectorSessionRow = {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_role: string | null;
  connector_id: string;
  status: ConnectorsSessionStatus;
  mode: ConnectorsSessionMode;
  availability: 'available' | 'planned';
  read_scopes_json: string | null;
  write_scopes_json: string | null;
  requested_scopes_json: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
};

type StoredConnectorAuthChallengeRow = {
  challenge_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  connector_id: string;
  auth_strategy: string;
  status: ConnectorsAuthChallengeStatus;
  state: string;
  authorize_url: string;
  redirect_uri: string | null;
  requested_scopes_json: string | null;
  pkce_verifier: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

type StoredConnectorTokenVaultRow = {
  vault_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  connector_id: string;
  encrypted_token_blob: string;
  expires_at: string | null;
  refresh_expires_at: string | null;
  last_rotated_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectorTokenBlob = {
  accessToken: string;
  refreshToken: string | null;
  authorizationCode: string | null;
  issuedAt: string;
};

let ensureConnectorsRuntimeTablesPromise: Promise<void> | null = null;

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

function plusMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function requireScope(scope: ConnectorsRuntimeScope | null | undefined): ConnectorsRuntimeScope {
  if (!scope?.tenantId || !scope?.userId) {
    throw new ConnectorsRuntimeSessionInputError(
      'CONNECTORS_RUNTIME_SCOPE_REQUIRED',
      'Connector runtime scope requires tenant and user context'
    );
  }
  return {
    tenantId: String(scope.tenantId),
    userId: String(scope.userId),
    userRole: scope.userRole ? String(scope.userRole) : null,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function summarizeSessions(sessions: readonly ConnectorsSessionRecord[]) {
  return {
    total: sessions.length,
    connected: sessions.filter((item) => item.status === 'connected').length,
    pending: sessions.filter((item) => item.status === 'pending').length,
    needsReauth: sessions.filter((item) => item.status === 'needs_reauth').length,
    disconnected: sessions.filter((item) => item.status === 'disconnected').length,
  };
}

export class ConnectorsRuntimeSessionInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'ConnectorsRuntimeSessionInputError';
    this.code = code;
    this.status = status;
  }
}

export class ConnectorsRuntimeSessionNotFoundError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(connectorId: string, status = 404) {
    super(`Connector session not found: ${connectorId}`);
    this.name = 'ConnectorsRuntimeSessionNotFoundError';
    this.code = 'CONNECTORS_RUNTIME_SESSION_NOT_FOUND';
    this.status = status;
  }
}

export class ConnectorsRuntimeAuthChallengeNotFoundError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(connectorId: string, status = 404) {
    super(`Connector auth challenge not found: ${connectorId}`);
    this.name = 'ConnectorsRuntimeAuthChallengeNotFoundError';
    this.code = 'CONNECTORS_RUNTIME_AUTH_CHALLENGE_NOT_FOUND';
    this.status = status;
  }
}

export class ConnectorsRuntimeSourceNotFoundError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(sourceId: string, status = 404) {
    super(`Connector source not found: ${sourceId}`);
    this.name = 'ConnectorsRuntimeSourceNotFoundError';
    this.code = 'CONNECTORS_RUNTIME_SOURCE_NOT_FOUND';
    this.status = status;
  }
}

export class ConnectorsRuntimeTokenVaultError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = 'ConnectorsRuntimeTokenVaultError';
    this.code = code;
    this.status = status;
  }
}

export async function ensureConnectorsRuntimeTables(): Promise<void> {
  if (!ensureConnectorsRuntimeTablesPromise) {
    ensureConnectorsRuntimeTablesPromise = (async () => {
      try {
        await dbRun(
          `CREATE TABLE IF NOT EXISTS v10_connector_sessions (
            session_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_role TEXT NULL,
            connector_id TEXT NOT NULL,
            status TEXT NOT NULL,
            mode TEXT NOT NULL,
            availability TEXT NOT NULL,
            read_scopes_json TEXT NULL,
            write_scopes_json TEXT NULL,
            requested_scopes_json TEXT NULL,
            last_error_code TEXT NULL,
            last_error_message TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_connected_at TEXT NULL,
            last_disconnected_at TEXT NULL,
            UNIQUE (tenant_id, user_id, connector_id)
          )`,
          []
        );
        await dbRun(
          `CREATE TABLE IF NOT EXISTS v10_connector_auth_challenges (
            challenge_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            connector_id TEXT NOT NULL,
            auth_strategy TEXT NOT NULL,
            status TEXT NOT NULL,
            state TEXT NOT NULL,
            authorize_url TEXT NOT NULL,
            redirect_uri TEXT NULL,
            requested_scopes_json TEXT NULL,
            pkce_verifier TEXT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            completed_at TEXT NULL,
            error_code TEXT NULL,
            error_message TEXT NULL
          )`,
          []
        );
        await dbRun(
          `CREATE TABLE IF NOT EXISTS v10_connector_token_vault (
            vault_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            connector_id TEXT NOT NULL,
            encrypted_token_blob TEXT NOT NULL,
            expires_at TEXT NULL,
            refresh_expires_at TEXT NULL,
            last_rotated_at TEXT NULL,
            revoked_at TEXT NULL,
            revoked_reason TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`,
          []
        );
      } catch (error) {
        ensureConnectorsRuntimeTablesPromise = null;
        throw error;
      }
    })();
  }
  await ensureConnectorsRuntimeTablesPromise;
}

export class ConnectorsRuntimeService {
  constructor(private readonly registry: ConnectorsRegistryService = connectorsRegistryService) {}

  private hydrateSession(row: StoredConnectorSessionRow): ConnectorsSessionRecord {
    const detail = this.registry.getConnector(row.connector_id);
    return {
      sessionId: row.session_id,
      connectorId: row.connector_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userRole: row.user_role,
      status: row.status,
      mode: row.mode,
      availability: row.availability,
      readScopes: parseJsonArray(row.read_scopes_json),
      writeScopes: parseJsonArray(row.write_scopes_json),
      requestedScopes: parseJsonArray(row.requested_scopes_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastConnectedAt: row.last_connected_at,
      lastDisconnectedAt: row.last_disconnected_at,
      lastErrorCode: row.last_error_code,
      lastErrorMessage: row.last_error_message,
      tokenStatus: 'missing',
      tokenExpiresAt: null,
      tokenLastRotatedAt: null,
      connector: detail.connector,
    };
  }

  private withTokenMetadata(
    session: ConnectorsSessionRecord,
    vaultRow: StoredConnectorTokenVaultRow | null
  ): ConnectorsSessionRecord {
    return {
      ...session,
      tokenStatus: !vaultRow ? 'missing' : vaultRow.revoked_at ? 'revoked' : 'stored',
      tokenExpiresAt: vaultRow?.expires_at || null,
      tokenLastRotatedAt: vaultRow?.last_rotated_at || null,
    };
  }

  private async getStoredSession(
    connectorId: string,
    scope: ConnectorsRuntimeScope
  ): Promise<StoredConnectorSessionRow | null> {
    await ensureConnectorsRuntimeTables();
    const row = await dbGet<StoredConnectorSessionRow>(
      `SELECT *
         FROM v10_connector_sessions
        WHERE tenant_id = ?
          AND user_id = ?
          AND connector_id = ?`,
      [scope.tenantId, scope.userId, connectorId]
    );
    return row || null;
  }

  private async getStoredVault(sessionId: string): Promise<StoredConnectorTokenVaultRow | null> {
    await ensureConnectorsRuntimeTables();
    const row = await dbGet<StoredConnectorTokenVaultRow>(
      `SELECT *
         FROM v10_connector_token_vault
        WHERE session_id = ?`,
      [sessionId]
    );
    return row || null;
  }

  private buildTokenBlob(input: {
    authorizationCode?: string;
    accessToken?: string;
    refreshToken?: string;
  }): ConnectorTokenBlob {
    const issuedAt = new Date().toISOString();
    return {
      accessToken: input.accessToken?.trim() || `connector-access-${crypto.randomUUID()}`,
      refreshToken: input.refreshToken?.trim() || `connector-refresh-${crypto.randomUUID()}`,
      authorizationCode: input.authorizationCode?.trim() || null,
      issuedAt,
    };
  }

  private async upsertTokenVault(args: {
    session: StoredConnectorSessionRow;
    authorizationCode?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    refreshExpiresAt?: string;
  }): Promise<StoredConnectorTokenVaultRow> {
    const now = new Date().toISOString();
    const existing = await this.getStoredVault(args.session.session_id);
    const tokenBlob = this.buildTokenBlob(args);
    const encryptedTokenBlob = encrypt(JSON.stringify(tokenBlob));
    const expiresAt = args.expiresAt?.trim() || plusMinutes(now, 60);
    const refreshExpiresAt = args.refreshExpiresAt?.trim() || plusMinutes(now, 60 * 24 * 30);

    if (existing) {
      await dbRun(
        `UPDATE v10_connector_token_vault
            SET encrypted_token_blob = ?,
                expires_at = ?,
                refresh_expires_at = ?,
                last_rotated_at = ?,
                revoked_at = NULL,
                revoked_reason = NULL,
                updated_at = ?
          WHERE session_id = ?`,
        [encryptedTokenBlob, expiresAt, refreshExpiresAt, now, now, args.session.session_id]
      );
    } else {
      await dbRun(
        `INSERT INTO v10_connector_token_vault (
            vault_id,
            session_id,
            tenant_id,
            user_id,
            connector_id,
            encrypted_token_blob,
            expires_at,
            refresh_expires_at,
            last_rotated_at,
            revoked_at,
            revoked_reason,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
        [
          `connector-vault-${crypto.randomUUID()}`,
          args.session.session_id,
          args.session.tenant_id,
          args.session.user_id,
          args.session.connector_id,
          encryptedTokenBlob,
          expiresAt,
          refreshExpiresAt,
          now,
          now,
          now,
        ]
      );
    }

    const stored = await this.getStoredVault(args.session.session_id);
    if (!stored) {
      throw new ConnectorsRuntimeTokenVaultError(
        'CONNECTORS_RUNTIME_TOKEN_VAULT_WRITE_FAILED',
        'Failed to persist connector token material',
        500
      );
    }
    return stored;
  }

  private async revokeTokenVault(sessionId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE v10_connector_token_vault
          SET revoked_at = ?,
              revoked_reason = ?,
              updated_at = ?
        WHERE session_id = ?`,
      [now, reason, now, sessionId]
    );
  }

  private hydrateChallenge(row: StoredConnectorAuthChallengeRow): ConnectorsAuthChallenge {
    return {
      challengeId: row.challenge_id,
      connectorId: row.connector_id,
      sessionId: row.session_id,
      authStrategy: row.auth_strategy as any,
      status: row.status,
      state: row.state,
      authorizeUrl: row.authorize_url,
      redirectUri: row.redirect_uri,
      requestedScopes: parseJsonArray(row.requested_scopes_json),
      pkceRequired: row.auth_strategy === 'oauth2_pkce',
      expiresAt: row.expires_at,
      completedAt: row.completed_at,
      errorCode: row.error_code,
      errorMessage: row.error_message,
    };
  }

  private buildMockSource(args: {
    connectorId: string;
    tenantId: string;
    query: string;
    rank: number;
  }): ConnectorsSourceRef {
    const queryKey = args.query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'source';
    const vendorType = args.connectorId === 'slack'
      ? 'slack_message'
      : args.connectorId === 'gmail'
        ? 'email_thread'
        : args.connectorId === 'google_calendar'
          ? 'calendar_event'
          : 'document';
    const vendorId = `${queryKey}-${args.rank + 1}`;
    const sourceId = `${args.connectorId}:${vendorType}:${vendorId}`;
    const baseTime = new Date(Date.now() - args.rank * 60 * 60 * 1000).toISOString();
    return {
      sourceId,
      connectorId: args.connectorId,
      vendorType,
      vendorId,
      title: `${args.connectorId.replace(/_/g, ' ')} evidence for "${args.query}"`,
      uri: `https://connectors.consultify.local/${args.connectorId}/sources/${encodeURIComponent(sourceId)}`,
      snippet: `Synthesized ${vendorType} snippet from ${args.connectorId} related to "${args.query}".`,
      mimeType: vendorType === 'calendar_event' ? 'application/json' : 'text/plain',
      lastModifiedAt: baseTime,
      freshnessAt: baseTime,
      aclFingerprint: `${args.tenantId}:${args.connectorId}:high`,
      accessConfidence: 'high',
    };
  }

  private async getStoredChallenge(args: {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
    challengeId?: string;
    status?: ConnectorsAuthChallengeStatus;
  }): Promise<StoredConnectorAuthChallengeRow | null> {
    await ensureConnectorsRuntimeTables();
    if (args.challengeId) {
      const row = await dbGet<StoredConnectorAuthChallengeRow>(
        `SELECT *
           FROM v10_connector_auth_challenges
          WHERE tenant_id = ?
            AND user_id = ?
            AND connector_id = ?
            AND challenge_id = ?`,
        [args.scope.tenantId, args.scope.userId, args.connectorId, args.challengeId]
      );
      return row || null;
    }
    const row = await dbGet<StoredConnectorAuthChallengeRow>(
      `SELECT *
         FROM v10_connector_auth_challenges
        WHERE tenant_id = ?
          AND user_id = ?
          AND connector_id = ?
          ${args.status ? 'AND status = ?' : ''}
        ORDER BY created_at DESC
        LIMIT 1`,
      args.status
        ? [args.scope.tenantId, args.scope.userId, args.connectorId, args.status]
        : [args.scope.tenantId, args.scope.userId, args.connectorId]
    );
    return row || null;
  }

  async fetch(input: ConnectorsFetchRequest): Promise<ConnectorsFetchResponse> {
    const now = input.now?.trim() || new Date().toISOString();
    const pipeline = await runConnectorsFetchPipeline({
      requestId: unsafeConnectorsFetchPipelineRunId(crypto.randomUUID()),
      url: input.url,
      now,
    });
    return {
      requestId: String(pipeline.requestId),
      now: pipeline.now,
      url: pipeline.url,
      status: pipeline.status,
      endpointState: pipeline.endpointState,
      httpStatus: pipeline.httpStatus,
      snippet: pipeline.snippet,
    };
  }

  listCatalog(input: { persona?: string | null; includePlanned?: boolean } = {}): ConnectorsCatalogResponse {
    return this.registry.listCatalog(input);
  }

  getConnector(connectorId: string): ConnectorsCatalogDetailResponse {
    return this.registry.getConnector(connectorId);
  }

  async listSessions(scopeInput: ConnectorsRuntimeScope): Promise<ConnectorsSessionListResponse> {
    const scope = requireScope(scopeInput);
    await ensureConnectorsRuntimeTables();
    const rows = await dbAll<StoredConnectorSessionRow>(
      `SELECT *
         FROM v10_connector_sessions
        WHERE tenant_id = ?
          AND user_id = ?
        ORDER BY updated_at DESC, connector_id ASC`,
      [scope.tenantId, scope.userId]
    );
    const sessions = await Promise.all(
      rows.map(async (row) => {
        const vault = await this.getStoredVault(row.session_id);
        return this.withTokenMetadata(this.hydrateSession(row), vault);
      })
    );
    return {
      generatedAt: new Date().toISOString(),
      sessions,
      summary: summarizeSessions(sessions),
    };
  }

  async connectConnector(input: ConnectorsSessionConnectRequest & {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsSessionMutationResponse> {
    const scope = requireScope(input.scope);
    const detail = this.registry.getConnector(input.connectorId);
    await ensureConnectorsRuntimeTables();

    const now = new Date().toISOString();
    const requestedScopes = uniqueStrings(input.requestedScopes || []);
    const allowedScopes = uniqueStrings([...detail.connector.readScopes, ...detail.connector.writeScopes]);
    const normalizedRequestedScopes =
      requestedScopes.length > 0
        ? requestedScopes.filter((scopeItem) => allowedScopes.includes(scopeItem))
        : [...detail.connector.readScopes];
    const readScopes = normalizedRequestedScopes.filter((scopeItem) =>
      detail.connector.readScopes.includes(scopeItem)
    );
    const writeScopes = normalizedRequestedScopes.filter((scopeItem) =>
      detail.connector.writeScopes.includes(scopeItem)
    );
    const mode: ConnectorsSessionMode =
      input.mode || (detail.connector.authStrategy === 'manual_upload' ? 'manual' : 'oauth_stub');
    const authRequired = !['manual_upload', 'none'].includes(detail.connector.authStrategy);
    const status: ConnectorsSessionStatus =
      authRequired ? 'pending' : detail.connector.availability === 'available' ? 'connected' : 'pending';
    const existing = await this.getStoredSession(detail.connector.id, scope);
    const sessionId = existing?.session_id || `connector-session-${crypto.randomUUID()}`;

    if (existing) {
      await dbRun(
        `UPDATE v10_connector_sessions
            SET user_role = ?,
                status = ?,
                mode = ?,
                availability = ?,
                read_scopes_json = ?,
                write_scopes_json = ?,
                requested_scopes_json = ?,
                last_error_code = NULL,
                last_error_message = NULL,
                updated_at = ?,
                last_connected_at = ?,
                last_disconnected_at = NULL
          WHERE session_id = ?`,
        [
          scope.userRole,
          status,
          mode,
          detail.connector.availability,
          JSON.stringify(readScopes),
          JSON.stringify(writeScopes),
          JSON.stringify(normalizedRequestedScopes),
          now,
          status === 'connected' ? now : existing.last_connected_at,
          sessionId,
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO v10_connector_sessions (
            session_id,
            tenant_id,
            user_id,
            user_role,
            connector_id,
            status,
            mode,
            availability,
            read_scopes_json,
            write_scopes_json,
            requested_scopes_json,
            last_error_code,
            last_error_message,
            created_at,
            updated_at,
            last_connected_at,
            last_disconnected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)`,
        [
          sessionId,
          scope.tenantId,
          scope.userId,
          scope.userRole,
          detail.connector.id,
          status,
          mode,
          detail.connector.availability,
          JSON.stringify(readScopes),
          JSON.stringify(writeScopes),
          JSON.stringify(normalizedRequestedScopes),
          now,
          now,
          status === 'connected' ? now : null,
        ]
      );
    }

    const stored = await this.getStoredSession(detail.connector.id, scope);
    if (!stored) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id, 500);
    }
    const vault = await this.getStoredVault(stored.session_id);
    return {
      generatedAt: now,
      session: this.withTokenMetadata(this.hydrateSession(stored), vault),
    };
  }

  async disconnectConnector(input: ConnectorsSessionDisconnectRequest & {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsSessionMutationResponse> {
    const scope = requireScope(input.scope);
    const detail = this.registry.getConnector(input.connectorId);
    const existing = await this.getStoredSession(detail.connector.id, scope);
    if (!existing) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id);
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE v10_connector_sessions
          SET status = 'disconnected',
              updated_at = ?,
              last_disconnected_at = ?,
              last_error_code = ?,
              last_error_message = ?
        WHERE session_id = ?`,
      [
        now,
        now,
        'CONNECTORS_RUNTIME_DISCONNECTED',
        input.reason ? String(input.reason) : null,
        existing.session_id,
      ]
    );
    await this.revokeTokenVault(existing.session_id, input.reason ? String(input.reason) : 'user_disconnect');

    const stored = await this.getStoredSession(detail.connector.id, scope);
    if (!stored) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id, 500);
    }
    const vault = await this.getStoredVault(stored.session_id);
    return {
      generatedAt: now,
      session: this.withTokenMetadata(this.hydrateSession(stored), vault),
    };
  }

  async startAuth(input: ConnectorsAuthStartRequest & {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsAuthStartResponse> {
    const scope = requireScope(input.scope);
    const detail = this.registry.getConnector(input.connectorId);
    if (['manual_upload', 'none'].includes(detail.connector.authStrategy)) {
      throw new ConnectorsRuntimeSessionInputError(
        'CONNECTORS_RUNTIME_AUTH_NOT_REQUIRED',
        'Selected connector does not require an auth challenge',
        409
      );
    }

    const connected = await this.connectConnector({
      connectorId: detail.connector.id,
      scope,
      requestedScopes: input.requestedScopes,
      mode: 'oauth_stub',
    });
    const now = new Date().toISOString();
    const expiresAt = plusMinutes(now, 10);
    const challengeId = `connector-auth-${crypto.randomUUID()}`;
    const state = crypto.randomBytes(16).toString('hex');
    const pkceVerifier = detail.connector.authStrategy === 'oauth2_pkce'
      ? crypto.randomBytes(24).toString('hex')
      : null;
    const requestedScopes =
      connected.session.requestedScopes.length > 0
        ? connected.session.requestedScopes
        : [...detail.connector.readScopes];
    const redirectUri = input.redirectUri?.trim() || null;
    const authorizeUrl = `https://connectors.consultify.local/${detail.connector.id}/authorize?challengeId=${encodeURIComponent(
      challengeId
    )}&state=${encodeURIComponent(state)}`;

    await dbRun(
      `INSERT INTO v10_connector_auth_challenges (
          challenge_id,
          session_id,
          tenant_id,
          user_id,
          connector_id,
          auth_strategy,
          status,
          state,
          authorize_url,
          redirect_uri,
          requested_scopes_json,
          pkce_verifier,
          created_at,
          expires_at,
          completed_at,
          error_code,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
      [
        challengeId,
        connected.session.sessionId,
        scope.tenantId,
        scope.userId,
        detail.connector.id,
        detail.connector.authStrategy,
        state,
        authorizeUrl,
        redirectUri,
        JSON.stringify(requestedScopes),
        pkceVerifier,
        now,
        expiresAt,
      ]
    );

    const storedChallenge = await this.getStoredChallenge({
      connectorId: detail.connector.id,
      scope,
      challengeId,
    });
    if (!storedChallenge) {
      throw new ConnectorsRuntimeAuthChallengeNotFoundError(detail.connector.id, 500);
    }

    return {
      generatedAt: now,
      challenge: this.hydrateChallenge(storedChallenge),
      session: connected.session,
    };
  }

  async completeAuth(input: ConnectorsAuthCompleteRequest & {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsAuthCompleteResponse> {
    const scope = requireScope(input.scope);
    const detail = this.registry.getConnector(input.connectorId);
    const challenge = await this.getStoredChallenge({
      connectorId: detail.connector.id,
      scope,
      challengeId: input.challengeId,
      status: input.challengeId ? undefined : 'pending',
    });
    if (!challenge) {
      throw new ConnectorsRuntimeAuthChallengeNotFoundError(detail.connector.id);
    }

    const existingSession = await this.getStoredSession(detail.connector.id, scope);
    if (!existingSession) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id);
    }

    const now = new Date().toISOString();
    const expired = new Date(challenge.expires_at).getTime() < Date.now();
    const requestedResult =
      input.result || (input.authorizationCode ? 'authorized' : 'authorized');
    const finalResult: ConnectorsAuthChallengeStatus =
      expired ? 'expired' : requestedResult === 'authorized' ? 'completed' : requestedResult;
    const sessionStatus: ConnectorsSessionStatus =
      finalResult === 'completed' && detail.connector.availability === 'available'
        ? 'connected'
        : finalResult === 'completed'
          ? 'pending'
          : 'needs_reauth';
    const errorCode =
      finalResult === 'completed'
        ? null
        : input.errorCode || (expired ? 'CONNECTORS_RUNTIME_AUTH_EXPIRED' : 'CONNECTORS_RUNTIME_AUTH_FAILED');
    const errorMessage =
      finalResult === 'completed'
        ? null
        : input.errorMessage || (expired ? 'Auth challenge expired' : 'Connector authorization failed');

    await dbRun(
      `UPDATE v10_connector_auth_challenges
          SET status = ?,
              completed_at = ?,
              error_code = ?,
              error_message = ?
        WHERE challenge_id = ?`,
      [finalResult, now, errorCode, errorMessage, challenge.challenge_id]
    );

    await dbRun(
      `UPDATE v10_connector_sessions
          SET status = ?,
              updated_at = ?,
              last_connected_at = ?,
              last_error_code = ?,
              last_error_message = ?
        WHERE session_id = ?`,
      [
        sessionStatus,
        now,
        sessionStatus === 'connected' ? now : existingSession.last_connected_at,
        errorCode,
        errorMessage,
        existingSession.session_id,
      ]
    );
    if (finalResult === 'completed') {
      await this.upsertTokenVault({
        session: existingSession,
        authorizationCode: input.authorizationCode,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        refreshExpiresAt: input.refreshExpiresAt,
      });
    } else {
      await this.revokeTokenVault(
        existingSession.session_id,
        errorCode || 'CONNECTORS_RUNTIME_AUTH_NOT_COMPLETED'
      );
    }

    const storedChallenge = await this.getStoredChallenge({
      connectorId: detail.connector.id,
      scope,
      challengeId: challenge.challenge_id,
    });
    const storedSession = await this.getStoredSession(detail.connector.id, scope);
    if (!storedChallenge) {
      throw new ConnectorsRuntimeAuthChallengeNotFoundError(detail.connector.id, 500);
    }
    if (!storedSession) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id, 500);
    }
    const vault = await this.getStoredVault(storedSession.session_id);

    return {
      generatedAt: now,
      challenge: this.hydrateChallenge(storedChallenge),
      session: this.withTokenMetadata(this.hydrateSession(storedSession), vault),
    };
  }

  async search(input: ConnectorsSearchRequest & {
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsSearchResponse> {
    const scope = requireScope(input.scope);
    const query = String(input.query || '').trim();
    if (!query) {
      throw new ConnectorsRuntimeSessionInputError(
        'CONNECTORS_RUNTIME_SEARCH_QUERY_REQUIRED',
        'Connector search requires a non-empty query'
      );
    }

    const catalog = this.registry.listCatalog({ includePlanned: true }).connectors;
    const sessions = await this.listSessions(scope);
    const sessionMap = new Map(sessions.sessions.map((session) => [session.connectorId, session]));
    const filteredConnectorIds = uniqueStrings(input.connectorIds || []);
    const connectors = catalog.filter((connector) =>
      filteredConnectorIds.length > 0 ? filteredConnectorIds.includes(connector.id) : true
    );

    const diagnostics: Array<ConnectorsSearchResponse['diagnostics'][number]> = [];
    const sources: ConnectorsSourceRef[] = [];
    const perConnectorLimit = Math.max(1, Math.ceil((input.limit || 6) / Math.max(1, connectors.length)));

    for (const connector of connectors) {
      const session = sessionMap.get(connector.id) || null;
      if (!connector.capabilities.includes('search')) {
        diagnostics.push({
          connectorId: connector.id,
          status: connector.availability === 'planned' ? 'not_implemented' : 'not_supported',
          reason:
            connector.availability === 'planned'
              ? 'connector is planned but not implemented yet'
              : 'connector does not expose search capability',
        });
        continue;
      }
      if (!session || session.status === 'disconnected') {
        diagnostics.push({
          connectorId: connector.id,
          status: 'needs_connection',
          reason: 'connector session is not connected',
        });
        continue;
      }
      if (session.status === 'needs_reauth') {
        diagnostics.push({
          connectorId: connector.id,
          status: 'needs_reauth',
          reason: 'connector requires re-authorization before search',
        });
        continue;
      }
      if (session.status !== 'connected') {
        diagnostics.push({
          connectorId: connector.id,
          status: 'skipped',
          reason: `connector session is ${session.status}`,
        });
        continue;
      }
      diagnostics.push({
        connectorId: connector.id,
        status: 'searched',
        reason: null,
      });
      for (let index = 0; index < perConnectorLimit; index += 1) {
        sources.push(
          this.buildMockSource({
            connectorId: connector.id,
            tenantId: scope.tenantId,
            query,
            rank: index,
          })
        );
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      query,
      sources: sources.slice(0, input.limit || 6),
      diagnostics,
    };
  }

  async readSource(input: ConnectorsReadSourceRequest & {
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsReadSourceResponse> {
    const scope = requireScope(input.scope);
    const connectorId = String(input.connectorId || '').trim();
    const sourceId = String(input.sourceId || '').trim();
    if (!connectorId || !sourceId) {
      throw new ConnectorsRuntimeSessionInputError(
        'CONNECTORS_RUNTIME_SOURCE_REF_REQUIRED',
        'Connector read requires connectorId and sourceId'
      );
    }

    const detail = this.registry.getConnector(connectorId);
    const session = await this.getStoredSession(detail.connector.id, scope);
    if (!session || session.status === 'disconnected') {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id);
    }
    if (session.status === 'needs_reauth') {
      throw new ConnectorsRuntimeSessionInputError(
        'CONNECTORS_RUNTIME_NEEDS_REAUTH',
        'Connector session requires re-authorization before reading',
        409
      );
    }
    if (!detail.connector.capabilities.includes('read_doc')) {
      throw new ConnectorsRuntimeSessionInputError(
        'CONNECTORS_RUNTIME_READ_NOT_SUPPORTED',
        'Connector does not support source reads',
        detail.connector.availability === 'planned' ? 501 : 422
      );
    }
    if (!sourceId.startsWith(`${detail.connector.id}:`)) {
      throw new ConnectorsRuntimeSourceNotFoundError(sourceId);
    }

    const generatedSource = this.buildMockSource({
      connectorId: detail.connector.id,
      tenantId: scope.tenantId,
      query: sourceId.split(':').slice(2).join(' ') || detail.connector.name,
      rank: 0,
    });
    const [, vendorType = 'document', vendorId = 'source'] = sourceId.split(':');
    const source: ConnectorsSourceRef = {
      ...generatedSource,
      sourceId,
      vendorType,
      vendorId,
      uri: `https://connectors.consultify.local/${detail.connector.id}/sources/${encodeURIComponent(sourceId)}`,
    };
    return {
      generatedAt: new Date().toISOString(),
      source,
      content: `Connector read payload for ${sourceId} from ${detail.connector.name}. This is the normalized source body exposed through the V10 connectors runtime.`,
    };
  }

  async refreshTokens(input: ConnectorsTokenRefreshRequest & {
    connectorId: string;
    scope: ConnectorsRuntimeScope;
  }): Promise<ConnectorsTokenRefreshResponse> {
    const scope = requireScope(input.scope);
    const detail = this.registry.getConnector(input.connectorId);
    const session = await this.getStoredSession(detail.connector.id, scope);
    if (!session) {
      throw new ConnectorsRuntimeSessionNotFoundError(detail.connector.id);
    }
    const vault = await this.getStoredVault(session.session_id);
    if (!vault) {
      throw new ConnectorsRuntimeTokenVaultError(
        'CONNECTORS_RUNTIME_TOKEN_VAULT_MISSING',
        'No token material stored for this connector session',
        404
      );
    }
    if (vault.revoked_at) {
      throw new ConnectorsRuntimeTokenVaultError(
        'CONNECTORS_RUNTIME_TOKEN_REVOKED',
        'Connector token has been revoked and requires re-authorization',
        409
      );
    }

    const decrypted = JSON.parse(decrypt(vault.encrypted_token_blob)) as ConnectorTokenBlob;
    const now = new Date().toISOString();
    const rotatedBlob: ConnectorTokenBlob = {
      ...decrypted,
      accessToken: `connector-access-${crypto.randomUUID()}`,
      refreshToken: decrypted.refreshToken || `connector-refresh-${crypto.randomUUID()}`,
      issuedAt: now,
    };
    await dbRun(
      `UPDATE v10_connector_token_vault
          SET encrypted_token_blob = ?,
              expires_at = ?,
              last_rotated_at = ?,
              revoked_at = NULL,
              revoked_reason = NULL,
              updated_at = ?
        WHERE session_id = ?`,
      [
        encrypt(JSON.stringify(rotatedBlob)),
        plusMinutes(now, 60),
        now,
        now,
        session.session_id,
      ]
    );
    await dbRun(
      `UPDATE v10_connector_sessions
          SET status = 'connected',
              updated_at = ?,
              last_connected_at = ?,
              last_error_code = NULL,
              last_error_message = NULL
        WHERE session_id = ?`,
      [now, now, session.session_id]
    );

    const storedSession = await this.getStoredSession(detail.connector.id, scope);
    const storedVault = await this.getStoredVault(session.session_id);
    if (!storedSession || !storedVault) {
      throw new ConnectorsRuntimeTokenVaultError(
        'CONNECTORS_RUNTIME_TOKEN_REFRESH_FAILED',
        'Connector token refresh did not persist correctly',
        500
      );
    }

    return {
      generatedAt: now,
      session: this.withTokenMetadata(this.hydrateSession(storedSession), storedVault),
      tokenStatus: 'stored',
      tokenExpiresAt: storedVault.expires_at,
      tokenLastRotatedAt: storedVault.last_rotated_at,
    };
  }
}

export const connectorsRuntimeService = new ConnectorsRuntimeService();

