/**
 * SSO Service — OIDC & SAML flows (V4-ENT-01)
 *
 * Lightweight implementation without external passport-saml / openid-client packages.
 * Uses native fetch + crypto for token exchange and XML parsing.
 */

import crypto from 'crypto';
import { z } from 'zod';

// ==========================================
// SCHEMAS
// ==========================================

export const OIDCConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.string().default('openid profile email'),
  tokenEndpoint: z.string().url().optional(),
  userinfoEndpoint: z.string().url().optional(),
  authorizationEndpoint: z.string().url().optional(),
  endSessionEndpoint: z.string().url().optional(),
});

export const SAMLConfigSchema = z.object({
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  certificate: z.string().min(1),
  sloUrl: z.string().url().optional(),
  nameIdFormat: z.string().default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
  attributeMappings: z.record(z.string(), z.string()).default({}),
});

export type OIDCConfig = z.infer<typeof OIDCConfigSchema>;
export type SAMLConfig = z.infer<typeof SAMLConfigSchema>;

// ==========================================
// OIDC HELPERS
// ==========================================

export function buildOIDCAuthUrl(config: OIDCConfig, state: string, nonce: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
    nonce,
  });
  const authEndpoint = config.authorizationEndpoint || `${config.issuer}/authorize`;
  return `${authEndpoint}?${params.toString()}`;
}

export async function exchangeOIDCCode(
  config: OIDCConfig,
  code: string
): Promise<{
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}> {
  const tokenEndpoint = config.tokenEndpoint || `${config.issuer}/oauth/token`;
  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OIDC token exchange failed (${resp.status}): ${text}`);
  }
  const data = (await resp.json()) as Record<string, string>;
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
}

export async function getUserInfo(
  config: OIDCConfig,
  accessToken: string
): Promise<Record<string, unknown>> {
  const endpoint = config.userinfoEndpoint || `${config.issuer}/userinfo`;
  const resp = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new Error(`OIDC userinfo failed (${resp.status})`);
  }
  return (await resp.json()) as Record<string, unknown>;
}

// ==========================================
// SAML HELPERS
// ==========================================

export function buildSAMLAuthnRequest(
  config: SAMLConfig,
  acsUrl: string,
  requestId: string
): string {
  const issueInstant = new Date().toISOString();
  return [
    '<samlp:AuthnRequest',
    ' xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"',
    ' xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"',
    ` ID="${requestId}"`,
    ' Version="2.0"',
    ` IssueInstant="${issueInstant}"`,
    ` Destination="${config.ssoUrl}"`,
    ` AssertionConsumerServiceURL="${acsUrl}"`,
    ' ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">',
    `<saml:Issuer>${config.entityId}</saml:Issuer>`,
    `<samlp:NameIDPolicy Format="${config.nameIdFormat}" AllowCreate="true"/>`,
    '</samlp:AuthnRequest>',
  ].join('');
}

export function parseSAMLResponse(samlResponse: string): {
  nameId: string;
  attributes: Record<string, string>;
} {
  const xml = Buffer.from(samlResponse, 'base64').toString('utf-8');

  const nameIdMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\//);
  const nameId = nameIdMatch?.[1] || '';

  const attributes: Record<string, string> = {};
  const attrRegex =
    /<(?:saml2?:)?Attribute\s+Name="([^"]+)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\//g;
  let match;
  while ((match = attrRegex.exec(xml)) !== null) {
    attributes[match[1]] = match[2];
  }

  return { nameId, attributes };
}

// ==========================================
// CRYPTO HELPERS
// ==========================================

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
