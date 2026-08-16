/**
 * Integration OAuth Engine
 *
 * Universal OAuth 2.0 handler for all 20 integration connectors.
 * Handles: authorization URL generation, code exchange, token storage,
 * token refresh, and connection status.
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import _logger from '../utils/Logger.js';
import { decryptSecret, encryptSecret } from '../utils/secretEncryption.js';

const logger = _logger;

// ─── Connector OAuth Configuration Registry ──────────────────────────────────

export interface ConnectorOAuthConfig {
  id: string;
  name: string;
  authType: 'oauth2' | 'api_key' | 'token' | 'basic';
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  scopeDelimiter?: string;
  extraAuthParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
  tokenAuthMethod?: 'body' | 'basic_auth';
  accessTokenField?: string;
  refreshTokenField?: string;
  expiresInField?: string;
  userInfoUrl?: string;
  userInfoHeaders?: Record<string, string>;
  testUrl?: string;
  testHeaders?: Record<string, string>;
  envClientId: string;
  envClientSecret: string;
  notes?: string;
}

const BASE_CALLBACK = '/api/settings/integrations/oauth/callback';

function callbackUrl(): string {
  const base = process.env.APP_URL || process.env.PUBLIC_URL || 'http://localhost:3005';
  return `${base.replace(/\/$/, '')}${BASE_CALLBACK}`;
}

export const CONNECTOR_OAUTH_CONFIGS: Record<string, ConnectorOAuthConfig> = {
  // ── Email & Communication ─────────────────────────────────────
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    authType: 'oauth2',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/contacts.readonly',
    ],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    testUrl: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  outlook: {
    id: 'outlook',
    name: 'Microsoft Outlook',
    authType: 'oauth2',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Mail.Read', 'Mail.Send', 'Contacts.Read', 'User.Read', 'offline_access'],
    testUrl: 'https://graph.microsoft.com/v1.0/me',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    authType: 'oauth2',
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write', 'users:read', 'users:read.email', 'im:write'],
    accessTokenField: 'access_token',
    testUrl: 'https://slack.com/api/auth.test',
    envClientId: 'SLACK_CLIENT_ID',
    envClientSecret: 'SLACK_CLIENT_SECRET',
    notes: 'Bot token (xoxb). Scopes go in "scope" param.',
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    authType: 'oauth2',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'Team.ReadBasic.All',
      'Channel.ReadBasic.All',
      'ChannelMessage.Send',
      'Chat.ReadWrite',
      'User.Read',
      'offline_access',
    ],
    testUrl: 'https://graph.microsoft.com/v1.0/me/joinedTeams',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
  },

  // ── Calendar ──────────────────────────────────────────────────
  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    authType: 'oauth2',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    testUrl: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  outlook_calendar: {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    authType: 'oauth2',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Calendars.ReadWrite', 'User.Read', 'offline_access'],
    testUrl: 'https://graph.microsoft.com/v1.0/me/calendars',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
  },
  apple_calendar: {
    id: 'apple_calendar',
    name: 'Apple Calendar (iCal)',
    authType: 'basic',
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
    envClientId: '',
    envClientSecret: '',
    notes: 'CalDAV Basic Auth. User provides Apple ID + app-specific password. No OAuth.',
  },
  calendly: {
    id: 'calendly',
    name: 'Calendly',
    authType: 'oauth2',
    authorizeUrl: 'https://auth.calendly.com/oauth/authorize',
    tokenUrl: 'https://auth.calendly.com/oauth/token',
    scopes: ['default'],
    testUrl: 'https://api.calendly.com/users/me',
    envClientId: 'CALENDLY_CLIENT_ID',
    envClientSecret: 'CALENDLY_CLIENT_SECRET',
  },

  // ── Task Management ───────────────────────────────────────────
  jira: {
    id: 'jira',
    name: 'Jira',
    authType: 'oauth2',
    authorizeUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access'],
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    testUrl: 'https://api.atlassian.com/oauth/token/accessible-resources',
    envClientId: 'ATLASSIAN_CLIENT_ID',
    envClientSecret: 'ATLASSIAN_CLIENT_SECRET',
  },
  asana: {
    id: 'asana',
    name: 'Asana',
    authType: 'oauth2',
    authorizeUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    revokeUrl: 'https://app.asana.com/-/oauth_revoke',
    scopes: ['default'],
    testUrl: 'https://app.asana.com/api/1.0/users/me',
    envClientId: 'ASANA_CLIENT_ID',
    envClientSecret: 'ASANA_CLIENT_SECRET',
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    authType: 'token',
    authorizeUrl: 'https://trello.com/1/authorize',
    tokenUrl: '',
    scopes: ['read', 'write'],
    envClientId: 'TRELLO_API_KEY',
    envClientSecret: '',
    notes: 'Token-based. User gets token via redirect; no code exchange needed.',
  },
  clickup: {
    id: 'clickup',
    name: 'ClickUp',
    authType: 'oauth2',
    authorizeUrl: 'https://app.clickup.com/api',
    tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
    scopes: [],
    tokenAuthMethod: 'body',
    testUrl: 'https://api.clickup.com/api/v2/team',
    envClientId: 'CLICKUP_CLIENT_ID',
    envClientSecret: 'CLICKUP_CLIENT_SECRET',
    notes: 'No granular scopes. Token does not expire (currently).',
  },
  monday: {
    id: 'monday',
    name: 'Monday.com',
    authType: 'oauth2',
    authorizeUrl: 'https://auth.monday.com/oauth2/authorize',
    tokenUrl: 'https://auth.monday.com/oauth2/token',
    scopes: ['me:read', 'boards:read', 'boards:write', 'users:read'],
    testUrl: 'https://api.monday.com/v2',
    envClientId: 'MONDAY_CLIENT_ID',
    envClientSecret: 'MONDAY_CLIENT_SECRET',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    authType: 'oauth2',
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    tokenAuthMethod: 'basic_auth',
    extraTokenParams: { grant_type: 'authorization_code' },
    testUrl: 'https://api.notion.com/v1/users/me',
    userInfoHeaders: { 'Notion-Version': '2022-06-28' },
    envClientId: 'NOTION_CLIENT_ID',
    envClientSecret: 'NOTION_CLIENT_SECRET',
    notes:
      'Token exchange uses Basic Auth header. Capabilities set in Notion integration settings.',
  },
  todoist: {
    id: 'todoist',
    name: 'Todoist',
    authType: 'oauth2',
    authorizeUrl: 'https://todoist.com/oauth/authorize',
    tokenUrl: 'https://todoist.com/oauth/access_token',
    scopes: ['data:read_write'],
    accessTokenField: 'access_token',
    testUrl: 'https://api.todoist.com/rest/v2/projects',
    envClientId: 'TODOIST_CLIENT_ID',
    envClientSecret: 'TODOIST_CLIENT_SECRET',
    notes: 'Access token does not expire.',
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    authType: 'oauth2',
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    revokeUrl: 'https://api.linear.app/oauth/revoke',
    scopes: ['read', 'write', 'issues:create'],
    scopeDelimiter: ',',
    testUrl: 'https://api.linear.app/graphql',
    envClientId: 'LINEAR_CLIENT_ID',
    envClientSecret: 'LINEAR_CLIENT_SECRET',
  },

  // ── Cloud Storage ─────────────────────────────────────────────
  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    authType: 'oauth2',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    testUrl: 'https://www.googleapis.com/drive/v3/about?fields=user',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    authType: 'oauth2',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Files.ReadWrite', 'User.Read', 'offline_access'],
    testUrl: 'https://graph.microsoft.com/v1.0/me/drive',
    envClientId: 'MICROSOFT_CLIENT_ID',
    envClientSecret: 'MICROSOFT_CLIENT_SECRET',
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    authType: 'oauth2',
    authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
    scopes: [
      'account_info.read',
      'files.content.read',
      'files.content.write',
      'files.metadata.read',
    ],
    extraAuthParams: { token_access_type: 'offline' },
    testUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
    envClientId: 'DROPBOX_CLIENT_ID',
    envClientSecret: 'DROPBOX_CLIENT_SECRET',
    notes: 'Test endpoint is POST with empty body.',
  },
  box: {
    id: 'box',
    name: 'Box',
    authType: 'oauth2',
    authorizeUrl: 'https://account.box.com/api/oauth2/authorize',
    tokenUrl: 'https://api.box.com/oauth2/token',
    revokeUrl: 'https://api.box.com/oauth2/revoke',
    scopes: ['root_readwrite'],
    testUrl: 'https://api.box.com/2.0/users/me',
    envClientId: 'BOX_CLIENT_ID',
    envClientSecret: 'BOX_CLIENT_SECRET',
  },
};

// ─── Pending state management (in-memory, 10-min TTL) ────────────────────────

interface PendingOAuthState {
  connectorId: string;
  userId: string;
  organizationId?: string;
  createdAt: number;
  codeVerifier?: string;
}

const pendingStates = new Map<string, PendingOAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > STATE_TTL_MS) pendingStates.delete(key);
  }
}, 60_000);

// ─── DB: Token Storage ───────────────────────────────────────────────────────

let tableEnsured = false;

async function ensureTokenTable(): Promise<void> {
  if (tableEnsured) return;
  // Fail-soft: opportunistic idempotent DDL invoked first by the read paths
  // (getStoredToken / getValidAccessToken / listConnectedIntegrations). Use
  // fallback:true so a transient DDL failure can NEVER reject and bubble up as a
  // bare HTTP 500 on the integration-status surfaces. tableEnsured is only set
  // after all statements resolve, so a transient failure simply retries next
  // call. Token INSERT/UPDATE writes keep their own fallback semantics.
  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS integration_oauth_tokens (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      connector_id    TEXT NOT NULL,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_type      TEXT DEFAULT 'Bearer',
      expires_at      TIMESTAMPTZ,
      scopes          TEXT,
      extra_data      TEXT,
      status          TEXT DEFAULT 'active',
      created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, connector_id)
    )
  `,
    [],
    { fallback: true }
  );
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_iot_user ON integration_oauth_tokens(user_id)`, [], {
    fallback: true,
  });
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_iot_connector ON integration_oauth_tokens(connector_id)`,
    [],
    { fallback: true }
  );
  tableEnsured = true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function getClientCredentials(
  cfg: ConnectorOAuthConfig
): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[cfg.envClientId] || '';
  const clientSecret = process.env[cfg.envClientSecret] || '';
  if (!clientId) return null;
  return { clientId, clientSecret };
}

export function getConnectorConfig(connectorId: string): ConnectorOAuthConfig | undefined {
  return CONNECTOR_OAUTH_CONFIGS[connectorId];
}

export interface ApprovedConnectorDecision {
  approved: true;
  scopes: string[];
  residency: string;
}

export function getConnectorApprovalDecision(
  connectorId: string
): ApprovedConnectorDecision | null {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg || (cfg.authType !== 'oauth2' && cfg.authType !== 'token')) return null;
  const raw = process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  if (!raw) return null;
  try {
    const registry = JSON.parse(raw) as Record<string, unknown>;
    const candidate = registry[connectorId];
    if (!candidate || typeof candidate !== 'object') return null;
    const decision = candidate as Record<string, unknown>;
    if (decision.approved !== true || !Array.isArray(decision.scopes)) return null;
    if (typeof decision.residency !== 'string' || !decision.residency.trim()) return null;
    const scopes = decision.scopes.filter((scope): scope is string => typeof scope === 'string');
    if (
      scopes.length !== cfg.scopes.length ||
      !cfg.scopes.every((scope) => scopes.includes(scope))
    ) {
      return null;
    }
    return { approved: true, scopes: [...scopes], residency: decision.residency.trim() };
  } catch {
    return null;
  }
}

export function isConnectorApproved(connectorId: string): boolean {
  return getConnectorApprovalDecision(connectorId) !== null;
}

export function isConnectorConfigured(connectorId: string): boolean {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg) return false;
  if (cfg.authType === 'basic') return true;
  if (cfg.authType === 'token') {
    return isConnectorApproved(connectorId) && !!process.env[cfg.envClientId];
  }
  return isConnectorApproved(connectorId) && !!getClientCredentials(cfg);
}

/**
 * Generate the authorization URL to redirect the user to.
 */
export function generateAuthUrl(
  connectorId: string,
  userId: string,
  organizationId?: string
): { url: string; state: string } | null {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg || (cfg.authType !== 'oauth2' && cfg.authType !== 'token')) return null;
  if (!isConnectorApproved(connectorId)) return null;

  const creds =
    cfg.authType === 'token'
      ? { clientId: process.env[cfg.envClientId] || '', clientSecret: '' }
      : getClientCredentials(cfg);
  if (!creds?.clientId) return null;

  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, { connectorId, userId, organizationId, createdAt: Date.now() });

  if (cfg.authType === 'token' && connectorId === 'trello') {
    const params = new URLSearchParams({
      key: creds.clientId,
      scope: cfg.scopes.join(','),
      expiration: 'never',
      name: 'Consultify',
      response_type: 'token',
      return_url: `${callbackUrl()}?state=${state}`,
      callback_method: 'fragment',
    });
    return { url: `${cfg.authorizeUrl}?${params.toString()}`, state };
  }

  const delimiter = cfg.scopeDelimiter || ' ';
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: cfg.scopes.join(delimiter),
    state,
    ...(cfg.extraAuthParams || {}),
  });

  return { url: `${cfg.authorizeUrl}?${params.toString()}`, state };
}

/**
 * Validate and consume the OAuth state parameter.
 */
export function consumeState(state: string): PendingOAuthState | null {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    pendingStates.delete(state);
    return null;
  }
  pendingStates.delete(state);
  return entry;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
  connectorId: string,
  code: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  raw: Record<string, unknown>;
} | null> {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg || cfg.authType !== 'oauth2') return null;
  if (!isConnectorApproved(connectorId)) return null;

  const creds = getClientCredentials(cfg);
  if (!creds) return null;

  const bodyParams: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(),
    ...(cfg.extraTokenParams || {}),
  };

  if (cfg.tokenAuthMethod !== 'basic_auth') {
    bodyParams.client_id = creds.clientId;
    bodyParams.client_secret = creds.clientSecret;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (cfg.tokenAuthMethod === 'basic_auth') {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  if (cfg.userInfoHeaders) {
    Object.assign(headers, cfg.userInfoHeaders);
  }

  try {
    const resp = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      logger.error(
        `[IntegrationOAuth] Token exchange failed for ${connectorId}: ${resp.status} ${text}`
      );
      return null;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    const accessTokenField = cfg.accessTokenField || 'access_token';
    const refreshTokenField = cfg.refreshTokenField || 'refresh_token';
    const expiresInField = cfg.expiresInField || 'expires_in';

    const accessToken = String(data[accessTokenField] || data.access_token || '');
    if (!accessToken) {
      logger.error(`[IntegrationOAuth] No access_token in response for ${connectorId}`);
      return null;
    }

    return {
      accessToken,
      refreshToken: data[refreshTokenField] ? String(data[refreshTokenField]) : undefined,
      expiresIn:
        typeof data[expiresInField] === 'number' ? (data[expiresInField] as number) : undefined,
      raw: data,
    };
  } catch (err: any) {
    logger.error(`[IntegrationOAuth] Token exchange error for ${connectorId}:`, err.message);
    return null;
  }
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  connectorId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null> {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg || cfg.authType !== 'oauth2') return null;
  if (!isConnectorApproved(connectorId)) return null;

  const creds = getClientCredentials(cfg);
  if (!creds) return null;

  const bodyParams: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  if (cfg.tokenAuthMethod !== 'basic_auth') {
    bodyParams.client_id = creds.clientId;
    bodyParams.client_secret = creds.clientSecret;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (cfg.tokenAuthMethod === 'basic_auth') {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  try {
    const resp = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!resp.ok) {
      logger.error(`[IntegrationOAuth] Refresh failed for ${connectorId}: ${resp.status}`);
      return null;
    }

    const data = (await resp.json()) as Record<string, unknown>;
    return {
      accessToken: String(data.access_token || ''),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresIn: typeof data.expires_in === 'number' ? (data.expires_in as number) : undefined,
    };
  } catch (err: any) {
    logger.error(`[IntegrationOAuth] Refresh error for ${connectorId}:`, err.message);
    return null;
  }
}

/**
 * Store tokens after successful exchange.
 */
export async function storeTokens(
  userId: string,
  connectorId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scopes?: string;
    extraData?: Record<string, unknown>;
  }
): Promise<void> {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (
    (cfg?.authType === 'oauth2' || cfg?.authType === 'token') &&
    !isConnectorApproved(connectorId)
  ) {
    throw new Error('OAuth connector is not approved');
  }
  await ensureTokenTable();
  const id = crypto.randomUUID();
  const expiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
    : null;
  const extra = tokens.extraData ? JSON.stringify(tokens.extraData) : null;

  await dbRun(
    `
    INSERT INTO integration_oauth_tokens
      (id, user_id, connector_id, access_token, refresh_token, expires_at, scopes, extra_data, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, connector_id) DO UPDATE SET
      access_token  = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, integration_oauth_tokens.refresh_token),
      expires_at    = EXCLUDED.expires_at,
      scopes        = EXCLUDED.scopes,
      extra_data    = EXCLUDED.extra_data,
      status        = 'active',
      updated_at    = CURRENT_TIMESTAMP
  `,
    [
      id,
      userId,
      connectorId,
      encryptSecret(tokens.accessToken),
      tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      expiresAt,
      tokens.scopes || null,
      extra,
    ],
    { fallback: false }
  );
}

/**
 * Get stored token for a connector.
 */
export async function getStoredToken(
  userId: string,
  connectorId: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  status: string;
  extraData: string | null;
} | null> {
  await ensureTokenTable();
  const row = await dbGet<{
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
    status: string;
    extra_data: string | null;
  }>(
    `SELECT access_token, refresh_token, expires_at, status, extra_data
      FROM integration_oauth_tokens
      WHERE user_id = ? AND connector_id = ? AND status = 'active'`,
    [userId, connectorId],
    { fallback: false }
  );
  if (!row) return null;
  return {
    accessToken: decryptSecret(row.access_token),
    refreshToken: row.refresh_token ? decryptSecret(row.refresh_token) : null,
    expiresAt: row.expires_at,
    status: row.status,
    extraData: row.extra_data,
  };
}

/**
 * Get a valid access token — refreshing if expired.
 */
export async function getValidAccessToken(
  userId: string,
  connectorId: string
): Promise<string | null> {
  const stored = await getStoredToken(userId, connectorId);
  if (!stored) return null;

  if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
    if (!stored.refreshToken) return null;
    const refreshed = await refreshAccessToken(connectorId, stored.refreshToken);
    if (!refreshed) return null;
    await storeTokens(userId, connectorId, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresIn: refreshed.expiresIn,
    });
    return refreshed.accessToken;
  }

  return stored.accessToken;
}

/**
 * Disconnect: revoke and remove token.
 */
export async function disconnectIntegration(userId: string, connectorId: string): Promise<boolean> {
  await ensureTokenTable();

  const stored = await getStoredToken(userId, connectorId);
  if (stored) {
    const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
    if (cfg?.revokeUrl && stored.accessToken) {
      try {
        await fetch(cfg.revokeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: stored.accessToken }).toString(),
        });
      } catch {
        // best-effort revoke
      }
    }
  }

  await dbRun(
    `UPDATE integration_oauth_tokens SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND connector_id = ?`,
    [userId, connectorId],
    { fallback: false }
  );
  return true;
}

/**
 * Test a connection by calling the test URL.
 */
export async function testConnection(
  userId: string,
  connectorId: string
): Promise<{ success: boolean; error?: string }> {
  const cfg = CONNECTOR_OAUTH_CONFIGS[connectorId];
  if (!cfg?.testUrl) return { success: false, error: 'No test URL configured' };
  if (
    (cfg.authType === 'oauth2' || cfg.authType === 'token') &&
    !isConnectorApproved(connectorId)
  ) {
    return { success: false, error: 'OAuth connector is not approved' };
  }

  const token = await getValidAccessToken(userId, connectorId);
  if (!token) return { success: false, error: 'No valid token' };

  try {
    const isPostEndpoint = connectorId === 'dropbox' || connectorId === 'slack';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(cfg.userInfoHeaders || {}),
    };

    const resp = await fetch(cfg.testUrl, {
      method: isPostEndpoint ? 'POST' : 'GET',
      headers,
      ...(connectorId === 'dropbox' ? { body: 'null' } : {}),
    });

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * List all connected integrations for a user.
 */
export async function listConnectedIntegrations(userId: string): Promise<
  Array<{
    connectorId: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>
> {
  await ensureTokenTable();
  const rows = await dbAll<{
    connector_id: string;
    status: string;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT connector_id, status, expires_at, created_at, updated_at
      FROM integration_oauth_tokens
      WHERE user_id = ? AND status = 'active'
      ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    connectorId: r.connector_id,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Get connector availability status (are env vars configured?).
 */
export function getConnectorAvailability(): Record<
  string,
  { configured: boolean; approved: boolean; authType: string; residency?: string }
> {
  const result: Record<
    string,
    { configured: boolean; approved: boolean; authType: string; residency?: string }
  > = {};
  for (const [id, cfg] of Object.entries(CONNECTOR_OAUTH_CONFIGS)) {
    const decision = getConnectorApprovalDecision(id);
    result[id] = {
      configured: isConnectorConfigured(id),
      approved: cfg.authType === 'basic' || !!decision,
      authType: cfg.authType,
      ...(decision ? { residency: decision.residency } : {}),
    };
  }
  return result;
}
