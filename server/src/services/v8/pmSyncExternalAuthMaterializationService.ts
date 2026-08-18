import type { Request } from 'express';
import { z } from 'zod';

import config from '../../config/Config.js';
import { getRegistryApprovalDecision } from '../oauthService.js';
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
const ASANA_TOKEN_ENDPOINT = 'https://app.asana.com/-/oauth_token';
const ASANA_AUTHORIZE_ENDPOINT = 'https://app.asana.com/-/oauth_authorize';
const ASANA_USER_ENDPOINT = 'https://app.asana.com/api/1.0/users/me';
const DEFAULT_ASANA_SCOPES = ['default'];
const DEFAULT_GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];
const SlackMaterializationConfigSchema = z.object({
  workspace_id: z.string().trim().min(1),
});
const DEFAULT_SLACK_SCOPES = ['channels:read', 'users:read', 'chat:write'];
const SLACK_TOKEN_ENDPOINT = 'https://slack.com/api/oauth.v2.access';
const SLACK_AUTHORIZE_ENDPOINT = 'https://slack.com/oauth/v2/authorize';
const TeamsMaterializationConfigSchema = z.object({
  tenant_id: z.string().trim().min(1),
});
const DEFAULT_TEAMS_SCOPES = ['offline_access', 'openid', 'profile', 'email', 'User.Read'];
const MICROSOFT_GRAPH_ME_ENDPOINT =
  'https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName,mail';

function buildExternalAuthCallbackUrl(
  req: Pick<Request, 'protocol' | 'get'>,
  state: string
): string {
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

/**
 * SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: external OAuth is
 * excluded from MVP. Every reachable consent-URL producer in this file must
 * fail closed unless the connector is explicitly approved through
 * `OAUTH_APPROVED_PROVIDER_REGISTRY`.
 *
 * Key vocabulary: `normalizeConnectorId` already lowercases/trims connector
 * ids to exactly {'jira','gmail','asana','teams','slack'} — the same literal
 * keys `integrationOAuthEngine.ts`'s `CONNECTOR_OAUTH_CONFIGS` uses for its
 * registry lookups (`getConnectorApprovalDecision` reads `registry[connectorId]`
 * with no further normalization). `oauthService.ts` uses a DIFFERENT
 * vocabulary for its own login-OAuth surface ('google' | 'linkedin' — e.g.
 * 'google' there is not the same registry entry as 'gmail' here, since login
 * and this governed sync flow are different grants with different scopes).
 * This module therefore keys the registry with its own normalized connector
 * id, not oauthService's provider names.
 *
 * Required scopes per connector are this module's OWN default scope lists
 * (`DEFAULT_JIRA_SCOPES` etc. — the scopes this module will actually put on
 * the authorize URL / request at token exchange), not
 * `integrationOAuthEngine.ts`'s CONNECTOR_OAUTH_CONFIGS scopes, which differ
 * (e.g. its jira/gmail/teams scope lists are broader and do not match what
 * this module requests). Approving a scope set that isn't the one actually
 * granted would be a false sense of governance.
 *
 * Any connector id outside this map is unknown/unmappable and MUST be denied
 * — never silently passed through.
 */
const GOVERNED_CONNECTOR_REQUIRED_SCOPES: Record<string, readonly string[]> = {
  jira: DEFAULT_JIRA_SCOPES,
  gmail: DEFAULT_GMAIL_SCOPES,
  asana: DEFAULT_ASANA_SCOPES,
  teams: DEFAULT_TEAMS_SCOPES,
  slack: DEFAULT_SLACK_SCOPES,
};

/**
 * Throws (fail closed) unless `connectorId` is both a recognized governed
 * connector AND explicitly approved by the registry with matching scopes and
 * non-empty residency. Must be called before any side effect (session/state
 * row write, URL construction, token exchange, credential storage).
 */
function requireApprovedGovernedConnector(connectorId: string): void {
  const normalized = normalizeConnectorId(connectorId);
  const requiredScopes = GOVERNED_CONNECTOR_REQUIRED_SCOPES[normalized];
  if (!requiredScopes) {
    throw new Error(`Governed external auth provider is not approved: ${connectorId}`);
  }

  const decision = getRegistryApprovalDecision(normalized, requiredScopes);
  if (!decision) {
    throw new Error(`Governed external auth provider is not approved: ${connectorId}`);
  }
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

function getAsanaAuthConfig(): { clientId: string; clientSecret: string } {
  if (!config.ASANA_CLIENT_ID) {
    throw new Error('Governed Asana external auth client id is unavailable');
  }
  if (!config.ASANA_CLIENT_SECRET) {
    throw new Error('Governed Asana external auth client secret is unavailable');
  }

  return {
    clientId: config.ASANA_CLIENT_ID,
    clientSecret: config.ASANA_CLIENT_SECRET,
  };
}

function getMicrosoftAuthConfig(): { clientId: string; clientSecret: string } {
  if (!config.MICROSOFT_CLIENT_ID) {
    throw new Error('Governed Microsoft external auth client id is unavailable');
  }
  if (!config.MICROSOFT_CLIENT_SECRET) {
    throw new Error('Governed Microsoft external auth client secret is unavailable');
  }

  return {
    clientId: config.MICROSOFT_CLIENT_ID,
    clientSecret: config.MICROSOFT_CLIENT_SECRET,
  };
}

function getSlackAuthConfig(): { clientId: string; clientSecret: string } {
  if (!config.SLACK_CLIENT_ID) {
    throw new Error('Governed Slack external auth client id is unavailable');
  }
  if (!config.SLACK_CLIENT_SECRET) {
    throw new Error('Governed Slack external auth client secret is unavailable');
  }

  return {
    clientId: config.SLACK_CLIENT_ID,
    clientSecret: config.SLACK_CLIENT_SECRET,
  };
}

function getMicrosoftAuthorizeEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`;
}

function getMicrosoftTokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

function parseGrantedScopes(rawScope: string | undefined, fallback: string[]): string[] {
  return typeof rawScope === 'string' && rawScope.trim().length > 0
    ? rawScope
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
    : fallback;
}

export function getGovernedExternalAuthConfigFields(
  connectorId: string,
  baseFields: string[]
): string[] {
  if (normalizeConnectorId(connectorId) === 'jira') {
    return uniqueFields([...baseFields, 'client_id', 'client_secret']);
  }

  return baseFields;
}

export function buildGovernedExternalAuthSession(
  req: Pick<Request, 'protocol' | 'get'>,
  context: GovernedExternalAuthContext
): GovernedExternalAuthSessionInfo {
  requireApprovedGovernedConnector(context.connectorId);

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

  if (normalizeConnectorId(context.connectorId) === 'asana') {
    const asanaConfig = getAsanaAuthConfig();
    const params = new URLSearchParams({
      client_id: asanaConfig.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      state: session.state,
    });

    return {
      authUrl: `${ASANA_AUTHORIZE_ENDPOINT}?${params.toString()}`,
      callbackUrl,
      state: session.state,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  if (normalizeConnectorId(context.connectorId) === 'teams') {
    const parsed = TeamsMaterializationConfigSchema.parse(context.config);
    const microsoftConfig = getMicrosoftAuthConfig();
    const params = new URLSearchParams({
      client_id: microsoftConfig.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: DEFAULT_TEAMS_SCOPES.join(' '),
      state: session.state,
      response_mode: 'query',
      prompt: 'consent',
    });

    return {
      authUrl: `${getMicrosoftAuthorizeEndpoint(parsed.tenant_id)}?${params.toString()}`,
      callbackUrl,
      state: session.state,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  if (normalizeConnectorId(context.connectorId) === 'slack') {
    SlackMaterializationConfigSchema.parse(context.config);
    const slackConfig = getSlackAuthConfig();
    const params = new URLSearchParams({
      client_id: slackConfig.clientId,
      redirect_uri: callbackUrl,
      scope: DEFAULT_SLACK_SCOPES.join(','),
      state: session.state,
      user_scope: '',
    });

    return {
      authUrl: `${SLACK_AUTHORIZE_ENDPOINT}?${params.toString()}`,
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
  return ['jira', 'gmail', 'asana', 'teams', 'slack'].includes(normalizeConnectorId(connectorId));
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
    throw new Error(
      `Unsupported callback materialization connector: ${params.session.connectorId}`
    );
  }
  requireApprovedGovernedConnector(normalizedConnectorId);

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

    if (
      !response.ok ||
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new Error(
        payload.error_description || payload.error || 'Failed to exchange external auth code'
      );
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

    if (
      !response.ok ||
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new Error(
        payload.error_description || payload.error || 'Failed to exchange external auth code'
      );
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

  if (normalizedConnectorId === 'asana') {
    const asanaConfig = getAsanaAuthConfig();
    const parsed = z.object({ workspace_gid: z.string().trim().min(1) }).parse(params.config);
    const response = await fetch(ASANA_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: asanaConfig.clientId,
        client_secret: asanaConfig.clientSecret,
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

    if (
      !response.ok ||
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new Error(
        payload.error_description || payload.error || 'Failed to exchange external auth code'
      );
    }

    const userResponse = await fetch(ASANA_USER_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${payload.access_token}`,
      },
    });
    const userPayload = (await userResponse.json()) as {
      data?: {
        gid?: string;
        email?: string;
        name?: string;
      };
      errors?: Array<{ message?: string }>;
    };

    if (
      !userResponse.ok ||
      typeof userPayload.data?.gid !== 'string' ||
      userPayload.data.gid.length === 0
    ) {
      throw new Error(
        userPayload.errors?.[0]?.message ||
          'Failed to resolve Asana user info for governed external auth'
      );
    }

    const tokenExpiresAt =
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;
    const scopesGranted = parseGrantedScopes(payload.scope, DEFAULT_ASANA_SCOPES);

    await storeCredential({
      connectorId: params.session.connectorId,
      organizationId: params.session.organizationId,
      providerAccountId:
        typeof userPayload.data.email === 'string' && userPayload.data.email.trim().length > 0
          ? userPayload.data.email.trim()
          : userPayload.data.gid,
      workspaceOrTenantId: parsed.workspace_gid,
      scopesGranted,
      tokenExpiresAt,
    });

    let refreshSecretStored = false;
    if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0) {
      await storeRefreshExecutionSecret({
        connectorId: params.session.connectorId,
        organizationId: params.session.organizationId,
        clientId: asanaConfig.clientId,
        clientSecret: asanaConfig.clientSecret,
        refreshToken: payload.refresh_token,
        tokenEndpoint: ASANA_TOKEN_ENDPOINT,
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

  if (normalizedConnectorId === 'teams') {
    const microsoftConfig = getMicrosoftAuthConfig();
    const parsed = TeamsMaterializationConfigSchema.parse(params.config);
    const tokenEndpoint = getMicrosoftTokenEndpoint(parsed.tenant_id);
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: microsoftConfig.clientId,
        client_secret: microsoftConfig.clientSecret,
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

    if (
      !response.ok ||
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new Error(
        payload.error_description || payload.error || 'Failed to exchange external auth code'
      );
    }

    const meResponse = await fetch(MICROSOFT_GRAPH_ME_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${payload.access_token}`,
      },
    });
    const me = (await meResponse.json()) as {
      id?: string;
      userPrincipalName?: string;
      mail?: string;
    };

    if (!meResponse.ok || typeof me.id !== 'string' || me.id.length === 0) {
      throw new Error('Failed to resolve Microsoft user info for governed external auth');
    }

    const tokenExpiresAt =
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;
    const scopesGranted = parseGrantedScopes(payload.scope, DEFAULT_TEAMS_SCOPES);

    await storeCredential({
      connectorId: params.session.connectorId,
      organizationId: params.session.organizationId,
      providerAccountId:
        typeof me.userPrincipalName === 'string' && me.userPrincipalName.trim().length > 0
          ? me.userPrincipalName.trim()
          : typeof me.mail === 'string' && me.mail.trim().length > 0
            ? me.mail.trim()
            : me.id,
      workspaceOrTenantId: parsed.tenant_id,
      scopesGranted,
      tokenExpiresAt,
    });

    let refreshSecretStored = false;
    if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0) {
      await storeRefreshExecutionSecret({
        connectorId: params.session.connectorId,
        organizationId: params.session.organizationId,
        clientId: microsoftConfig.clientId,
        clientSecret: microsoftConfig.clientSecret,
        refreshToken: payload.refresh_token,
        tokenEndpoint,
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

  if (normalizedConnectorId === 'slack') {
    const slackConfig = getSlackAuthConfig();
    const parsed = SlackMaterializationConfigSchema.parse(params.config);
    const response = await fetch(SLACK_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: slackConfig.clientId,
        client_secret: slackConfig.clientSecret,
        code: params.code,
        redirect_uri: callbackUrl,
      }).toString(),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      team?: { id?: string; name?: string };
      authed_user?: { id?: string };
    };

    if (
      !response.ok ||
      payload.ok === false ||
      typeof payload.access_token !== 'string' ||
      payload.access_token.length === 0
    ) {
      throw new Error(payload.error || 'Failed to exchange external auth code');
    }

    const tokenExpiresAt =
      typeof payload.expires_in === 'number' && payload.expires_in > 0
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null;
    const scopesGranted = parseGrantedScopes(payload.scope, DEFAULT_SLACK_SCOPES);
    const teamId =
      typeof payload.team?.id === 'string' && payload.team.id.trim().length > 0
        ? payload.team.id.trim()
        : parsed.workspace_id;
    const providerAccountId =
      typeof payload.authed_user?.id === 'string' && payload.authed_user.id.trim().length > 0
        ? payload.authed_user.id.trim()
        : teamId;

    await storeCredential({
      connectorId: params.session.connectorId,
      organizationId: params.session.organizationId,
      providerAccountId,
      workspaceOrTenantId: teamId,
      scopesGranted,
      tokenExpiresAt,
    });

    let refreshSecretStored = false;
    if (typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0) {
      await storeRefreshExecutionSecret({
        connectorId: params.session.connectorId,
        organizationId: params.session.organizationId,
        clientId: slackConfig.clientId,
        clientSecret: slackConfig.clientSecret,
        refreshToken: payload.refresh_token,
        tokenEndpoint: SLACK_TOKEN_ENDPOINT,
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
  if (normalized === 'asana') {
    return Boolean(config.ASANA_CLIENT_ID && config.ASANA_CLIENT_SECRET);
  }
  if (normalized === 'gmail') {
    return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  }
  if (normalized === 'teams') {
    return Boolean(config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET);
  }
  if (normalized === 'slack') {
    return Boolean(config.SLACK_CLIENT_ID && config.SLACK_CLIENT_SECRET);
  }
  return false;
}
