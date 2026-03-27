import type { Request } from 'express';
import { z } from 'zod';

import config from '../../config/Config.js';
import { issueSyncExternalAuthSession } from '../syncExternalAuthSessionService.js';
import { storeCredential } from './pmSyncAuthService.js';
import { storeRefreshExecutionSecret } from './pmSyncRefreshExecutionService.js';

export interface GovernedExternalAuthSessionInfo {
  authUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
}

interface GovernedExternalAuthContext {
  connectorId: string;
  integrationId: string;
  organizationId: string;
  mode: 'connect' | 'reauth';
  config: Record<string, unknown>;
}

const JiraMaterializationConfigSchema = z.object({
  site_url: z.string().trim().url(),
  cloud_id: z.string().trim().min(1),
  client_id: z.string().trim().min(1),
  client_secret: z.string().trim().min(1),
});

const DEFAULT_JIRA_SCOPES = ['offline_access', 'read:jira-work'];
const JIRA_TOKEN_ENDPOINT = 'https://auth.atlassian.com/oauth/token';
const JIRA_AUTHORIZE_ENDPOINT = 'https://auth.atlassian.com/authorize';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DEFAULT_GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function buildExternalAuthCallbackUrl(req: Pick<Request, 'protocol' | 'get'>, state: string): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}/api/sync-hub/external-auth/callback?state=${encodeURIComponent(state)}`;
  }

  return `${req.protocol}://${req.get('host')}/api/sync-hub/external-auth/callback?state=${encodeURIComponent(state)}`;
}

function uniqueFields(fields: string[]): string[] {
  return [...new Set(fields)];
}

function normalizeConnectorId(connectorId: string): string {
  return connectorId.trim().toLowerCase();
}

function getGoogleClientId(): string {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new Error('Governed Google external auth client id is unavailable');
  }

  return config.GOOGLE_CLIENT_ID;
}

function getGoogleAuthConfig(): { clientId: string; clientSecret: string } {
  const clientId = getGoogleClientId();
  if (!config.GOOGLE_CLIENT_SECRET) {
    throw new Error('Governed Google external auth client secret is unavailable');
  }

  return {
    clientId,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
  };
}

function parseGrantedScopes(rawScope: string | undefined, fallback: string[]): string[] {
  return typeof rawScope === 'string' && rawScope.trim().length > 0
    ? rawScope
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    : fallback;
}

export function getGovernedExternalAuthConfigFields(
  connectorId: string,
  baseFields: string[],
): string[] {
  if (normalizeConnectorId(connectorId) === 'jira') {
    return uniqueFields([...baseFields, 'client_id', 'client_secret']);
  }

  return baseFields;
}

export function buildGovernedExternalAuthSession(
  req: Pick<Request, 'protocol' | 'get'>,
  context: GovernedExternalAuthContext,
): GovernedExternalAuthSessionInfo {
  const session = issueSyncExternalAuthSession({
    integrationId: context.integrationId,
    organizationId: context.organizationId,
    connectorId: context.connectorId,
    mode: context.mode,
  });
  const callbackUrl = buildExternalAuthCallbackUrl(req, session.state);

  if (normalizeConnectorId(context.connectorId) === 'jira') {
    const parsed = JiraMaterializationConfigSchema.parse(context.config);
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: parsed.client_id,
      scope: DEFAULT_JIRA_SCOPES.join(' '),
      redirect_uri: callbackUrl,
      state: session.state,
      response_type: 'code',
      prompt: 'consent',
    });

    return {
      authUrl: `${JIRA_AUTHORIZE_ENDPOINT}?${params.toString()}`,
      callbackUrl,
      state: session.state,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  if (normalizeConnectorId(context.connectorId) === 'gmail') {
    const params = new URLSearchParams({
      client_id: getGoogleClientId(),
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: DEFAULT_GMAIL_SCOPES.join(' '),
      state: session.state,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    return {
      authUrl: `${GOOGLE_AUTHORIZE_ENDPOINT}?${params.toString()}`,
      callbackUrl,
      state: session.state,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  return {
    authUrl: callbackUrl,
    callbackUrl,
    state: session.state,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

export function shouldMaterializeCallbackDrivenAuth(connectorId: string): boolean {
  return ['jira', 'gmail'].includes(normalizeConnectorId(connectorId));
}

export async function materializeGovernedExternalAuthCallback(params: {
  req: Pick<Request, 'protocol' | 'get'>;
  session: { state: string; connectorId: string; organizationId: string };
  config: Record<string, unknown>;
  code: string;
}): Promise<{
  credentialStored: true;
  refreshSecretStored: boolean;
  tokenExpiresAt: string | null;
  scopesGranted: string[];
}> {
  const normalizedConnectorId = normalizeConnectorId(params.session.connectorId);
  if (!shouldMaterializeCallbackDrivenAuth(normalizedConnectorId)) {
    throw new Error(`Unsupported callback materialization connector: ${params.session.connectorId}`);
  }

  const callbackUrl = buildExternalAuthCallbackUrl(params.req, params.session.state);
  if (normalizedConnectorId === 'jira') {
    const parsed = JiraMaterializationConfigSchema.parse(params.config);
    const response = await fetch(JIRA_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: parsed.client_id,
        client_secret: parsed.client_secret,
        code: params.code,
        redirect_uri: callbackUrl,
      }),
    });

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new Error(payload.error_description || payload.error || 'Failed to exchange external auth code');
    }

    const tokenExpiresAt =
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;
    const scopesGranted = parseGrantedScopes(payload.scope, DEFAULT_JIRA_SCOPES);

    await storeCredential({
      connectorId: params.session.connectorId,
      organizationId: params.session.organizationId,
      providerAccountId: parsed.site_url,
      workspaceOrTenantId: parsed.cloud_id,
      scopesGranted,
      tokenExpiresAt,
    });

    let refreshSecretStored = false;
    if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0) {
      await storeRefreshExecutionSecret({
        connectorId: params.session.connectorId,
        organizationId: params.session.organizationId,
        clientId: parsed.client_id,
        clientSecret: parsed.client_secret,
        refreshToken: payload.refresh_token,
        tokenEndpoint: JIRA_TOKEN_ENDPOINT,
      });
      refreshSecretStored = true;
    }

    return {
      credentialStored: true,
      refreshSecretStored,
      tokenExpiresAt,
      scopesGranted,
    };
  }

  if (normalizedConnectorId === 'gmail') {
    const googleConfig = getGoogleAuthConfig();
    const parsed = z.object({ domain: z.string().trim().min(1) }).parse(params.config);
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: googleConfig.clientId,
        client_secret: googleConfig.clientSecret,
        code: params.code,
        redirect_uri: callbackUrl,
      }).toString(),
    });

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new Error(payload.error_description || payload.error || 'Failed to exchange external auth code');
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${payload.access_token}`,
      },
    });
    const userInfo = (await userInfoResponse.json()) as {
      sub?: string;
      email?: string;
      hd?: string;
    };

    if (!userInfoResponse.ok || typeof userInfo.sub !== 'string' || userInfo.sub.length === 0) {
      throw new Error('Failed to resolve Google user info for governed external auth');
    }

    const tokenExpiresAt =
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;
    const scopesGranted = parseGrantedScopes(payload.scope, DEFAULT_GMAIL_SCOPES);

    await storeCredential({
      connectorId: params.session.connectorId,
      organizationId: params.session.organizationId,
      providerAccountId:
        typeof userInfo.email === 'string' && userInfo.email.trim().length > 0
          ? userInfo.email.trim()
          : userInfo.sub,
      workspaceOrTenantId:
        typeof userInfo.hd === 'string' && userInfo.hd.trim().length > 0
          ? userInfo.hd.trim()
          : parsed.domain,
      scopesGranted,
      tokenExpiresAt,
    });

    let refreshSecretStored = false;
    if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0) {
      await storeRefreshExecutionSecret({
        connectorId: params.session.connectorId,
        organizationId: params.session.organizationId,
        clientId: googleConfig.clientId,
        clientSecret: googleConfig.clientSecret,
        refreshToken: payload.refresh_token,
        tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
      });
      refreshSecretStored = true;
    }

    return {
      credentialStored: true,
      refreshSecretStored,
      tokenExpiresAt,
      scopesGranted,
    };
  }

  throw new Error(`Unsupported callback materialization connector: ${params.session.connectorId}`);
}

export function hasGovernedExternalAuthEnvConfig(connectorId: string): boolean {
  const normalized = normalizeConnectorId(connectorId);
  if (normalized === 'gmail') {
    return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  }
  if (normalized === 'teams') {
    return Boolean(config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET);
  }
  return false;
}
