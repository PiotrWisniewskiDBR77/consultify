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

export function getGovernedExternalAuthConfigFields(
  connectorId: string,
  baseFields: string[],
): string[] {
  if (connectorId.trim().toLowerCase() === 'jira') {
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

  if (context.connectorId.trim().toLowerCase() === 'jira') {
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

  return {
    authUrl: callbackUrl,
    callbackUrl,
    state: session.state,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

export function shouldMaterializeCallbackDrivenAuth(connectorId: string): boolean {
  return connectorId.trim().toLowerCase() === 'jira';
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
  if (!shouldMaterializeCallbackDrivenAuth(params.session.connectorId)) {
    throw new Error(`Unsupported callback materialization connector: ${params.session.connectorId}`);
  }

  const parsed = JiraMaterializationConfigSchema.parse(params.config);
  const callbackUrl = buildExternalAuthCallbackUrl(params.req, params.session.state);
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
  const scopesGranted =
    typeof payload.scope === 'string' && payload.scope.trim().length > 0
      ? payload.scope
          .split(/\s+/)
          .map((scope) => scope.trim())
          .filter(Boolean)
      : DEFAULT_JIRA_SCOPES;

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

export function hasGovernedExternalAuthEnvConfig(connectorId: string): boolean {
  const normalized = connectorId.trim().toLowerCase();
  if (normalized === 'gmail') {
    return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  }
  if (normalized === 'teams') {
    return Boolean(config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET);
  }
  return false;
}
