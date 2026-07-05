/**
 * SSO Service — OIDC & SAML flows (V4-ENT-01)
 *
 * Lightweight implementation without external passport-saml / openid-client packages.
 * Uses native fetch + crypto for token exchange and XML parsing.
 *
 * SECURITY — SAML response handling FAILS CLOSED. Identity claims (NameID /
 * attributes) are trusted ONLY after `verifySAMLResponse` confirms the XML
 * signature against the IdP certificate via a registered
 * `SAMLSignatureVerifier`. Until a real verifier (xml-crypto /
 * @node-saml/node-saml) is wired in with `setSAMLSignatureVerifier`, every SAML
 * response is rejected. The old signature-less regex extraction
 * (`parseSAMLResponse`) was an authentication bypass and has been removed — do
 * not reintroduce a path that reads identity from an unverified response.
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

export function decodeIdToken(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid id_token format');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
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

/**
 * Extract identity claims (NameID + attributes) from an ALREADY-VERIFIED,
 * decoded SAML XML string.
 *
 * SECURITY: This function performs NO trust decision. It must ONLY ever be
 * called on XML whose enveloped signature has already been cryptographically
 * verified against the IdP certificate (see `verifySAMLResponse`). Calling it
 * on raw/unverified input is an authentication bypass — never do that.
 *
 * To defend against XML signature-wrapping, the caller must pass the exact
 * assertion element that the signature covers (`assertionXml`), not the whole
 * response envelope, so that an attacker cannot smuggle an unsigned assertion
 * alongside a signed one. When `assertionXml` is provided we extract from it;
 * we intentionally do NOT fall back to scanning the full document.
 */
export function extractVerifiedClaims(verifiedAssertionXml: string): {
  nameId: string;
  attributes: Record<string, string>;
} {
  const xml = verifiedAssertionXml;

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

/**
 * XML-signature verifier for a decoded SAML response.
 *
 * Given the decoded (base64-inflated) SAML response XML and the IdP's X.509
 * certificate, returns the exact assertion element that the signature
 * cryptographically covers — or throws / returns null if:
 *   - no signature is present,
 *   - the signature does not validate against the certificate,
 *   - the signature does not actually reference the returned assertion
 *     (signature-wrapping defense).
 *
 * Implement with a real library (xml-crypto / @node-saml/node-saml) and
 * register via `setSAMLSignatureVerifier`. Until one is registered, SAML login
 * FAILS CLOSED (every response is rejected).
 */
export type SAMLSignatureVerifier = (
  decodedXml: string,
  certificate: string
) => { signedAssertionXml: string } | null | Promise<{ signedAssertionXml: string } | null>;

let samlSignatureVerifier: SAMLSignatureVerifier | null = null;

/**
 * Register the process-wide SAML signature verifier. Pass `null` to disable
 * SAML login (back to fail-closed). The verifier MUST reject (return null or
 * throw) any response whose signature does not validate against the supplied
 * certificate AND does not cover the returned assertion.
 */
export function setSAMLSignatureVerifier(verifier: SAMLSignatureVerifier | null): void {
  samlSignatureVerifier = verifier;
}

export interface VerifiedSAMLResult {
  valid: boolean;
  nameId?: string;
  attributes?: Record<string, string>;
  error?: string;
}

/**
 * Verify a SAML response FAIL-CLOSED, then (and only then) extract identity.
 *
 * SECURITY: The previous code path base64-decoded the response and regex-scraped
 * a <NameID> with ZERO signature verification, which let anyone log in as any
 * email by crafting XML. This function refuses to trust ANY assertion unless a
 * real signature verifier is registered AND it confirms the signature over the
 * specific assertion we read identity from. There is NO regex fallback on
 * failure — when in doubt we reject.
 *
 * @param samlResponse base64-encoded SAML response (as received on the ACS POST)
 * @param certificate  IdP X.509 certificate from the org's SAML config
 */
export async function verifySAMLResponse(
  samlResponse: string,
  certificate: string | undefined | null
): Promise<VerifiedSAMLResult> {
  let decoded: string;
  try {
    decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
  } catch {
    return { valid: false, error: 'malformed SAML response' };
  }

  // FAIL CLOSED: no verifier registered → trust nothing.
  if (!samlSignatureVerifier) {
    return { valid: false, error: 'SAML signature verification not configured' };
  }

  if (!certificate) {
    return { valid: false, error: 'no SAML certificate configured' };
  }

  let verified: { signedAssertionXml: string } | null;
  try {
    verified = await samlSignatureVerifier(decoded, certificate);
  } catch {
    return { valid: false, error: 'signature verification failed' };
  }

  // Reject if the signature is missing/invalid or does not cover an assertion.
  // NEVER fall back to scraping the unverified document here.
  if (!verified || !verified.signedAssertionXml) {
    return { valid: false, error: 'invalid SAML signature' };
  }

  // Only NOW, on the signature-covered assertion, extract identity claims.
  const { nameId, attributes } = extractVerifiedClaims(verified.signedAssertionXml);
  if (!nameId) {
    return { valid: false, error: 'no NameID in signed assertion' };
  }

  return { valid: true, nameId, attributes };
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
