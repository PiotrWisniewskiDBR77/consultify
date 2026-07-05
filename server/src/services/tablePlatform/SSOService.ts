/**
 * SSO Service — SAML 2.0 & OIDC configuration + login flow
 *
 * SECURITY: SAML response validation FAILS CLOSED. Signature verification
 * requires a real XML-signature verifier (xml-crypto / @node-saml/node-saml)
 * registered via `setSignatureVerifier()`. Until one is wired in, every SAML
 * response is rejected — we never trust an unsigned/forged assertion.
 */

import crypto from 'crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { decryptSecret, encryptSecret } from '../../utils/secretEncryption.js';

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  signatureAlgorithm?: string;
  nameIdFormat?: string;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes?: string[];
}

export interface SSOConfigRow {
  id: string;
  organization_id: string;
  provider: 'saml' | 'oidc';
  enabled: boolean;
  config: SAMLConfig | OIDCConfig;
  metadata_url: string | null;
  created_at: string;
  updated_at: string;
}

export class SSOService {
  async configureSAML(organizationId: string, config: SAMLConfig): Promise<SSOConfigRow> {
    const db = getDatabase();
    const stored = { ...config, certificate: encryptSecret(config.certificate) };
    const result = await db.query(
      `INSERT INTO tp_sso_configs (organization_id, provider, config)
       VALUES ($1, 'saml', $2)
       ON CONFLICT (organization_id) DO UPDATE SET config = $2, provider = 'saml', updated_at = NOW()
       RETURNING *`,
      [organizationId, JSON.stringify(stored)]
    );
    return this.decryptRow(result.rows[0] as SSOConfigRow);
  }

  async configureOIDC(organizationId: string, config: OIDCConfig): Promise<SSOConfigRow> {
    const db = getDatabase();
    const stored = { ...config, clientSecret: encryptSecret(config.clientSecret) };
    const result = await db.query(
      `INSERT INTO tp_sso_configs (organization_id, provider, config)
       VALUES ($1, 'oidc', $2)
       ON CONFLICT (organization_id) DO UPDATE SET config = $2, provider = 'oidc', updated_at = NOW()
       RETURNING *`,
      [organizationId, JSON.stringify(stored)]
    );
    return this.decryptRow(result.rows[0] as SSOConfigRow);
  }

  async getSSOConfig(organizationId: string): Promise<SSOConfigRow | null> {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_sso_configs WHERE organization_id = $1', [
      organizationId,
    ]);
    const row = result.rows[0] as SSOConfigRow | undefined;
    return row ? this.decryptRow(row) : null;
  }

  private decryptRow(row: SSOConfigRow): SSOConfigRow {
    const config = row.config as any;
    if (row.provider === 'saml' && config?.certificate) {
      return { ...row, config: { ...config, certificate: decryptSecret(config.certificate) } };
    }
    if (row.provider === 'oidc' && config?.clientSecret) {
      return { ...row, config: { ...config, clientSecret: decryptSecret(config.clientSecret) } };
    }
    return row;
  }

  async toggleSSO(organizationId: string, enabled: boolean): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_sso_configs SET enabled = $2, updated_at = NOW() WHERE organization_id = $1',
      [organizationId, enabled]
    );
  }

  generateSAMLAuthUrl(config: SAMLConfig, callbackUrl: string): string {
    const id = '_' + crypto.randomUUID();
    const issueInstant = new Date().toISOString();
    const samlRequest = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      ID="${id}" Version="2.0" IssueInstant="${issueInstant}"
      Destination="${config.ssoUrl}"
      AssertionConsumerServiceURL="${callbackUrl}">
      <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.entityId}</saml:Issuer>
    </samlp:AuthnRequest>`;

    const encoded = Buffer.from(samlRequest).toString('base64');
    return `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(encoded)}`;
  }

  /**
   * SAML response validation.
   *
   * SECURITY: A SAML response MUST have its XML signature cryptographically
   * verified against the IdP certificate before any identity claim (NameID /
   * email / attributes) is trusted. The previous implementation only did a
   * base64-decode + regex extraction — it returned `valid: true` for ANY
   * forged, unsigned XML, which is an authentication bypass (an attacker could
   * mint a SAML response for an arbitrary email and log in as that user).
   *
   * No XML signature-verification library is currently present in the
   * dependency tree (@node-saml/node-saml / xml-crypto / samlify). Rather than
   * installing one blindly, we FAIL CLOSED: signature verification is treated
   * as "not configured" and every response is rejected. This is safe (SAML
   * login is unusable until a verifier is wired in) instead of dangerous
   * (accepting forged assertions).
   *
   * To enable SAML login, provide a signature verifier via
   * `setSignatureVerifier()` (real xml-crypto-based verification). Until then
   * this method returns `valid: false`.
   */
  private signatureVerifier: SAMLSignatureVerifier | null = null;

  /**
   * Wire in a real XML-signature verifier (e.g. backed by xml-crypto). This is
   * the single, clean extension point for making SAML login functional without
   * touching the callers. The verifier MUST throw or return false for any
   * response whose signature does not validate against the IdP certificate.
   */
  setSignatureVerifier(verifier: SAMLSignatureVerifier | null): void {
    this.signatureVerifier = verifier;
  }

  async validateSAMLResponse(
    organizationId: string,
    samlResponse: string
  ): Promise<{
    valid: boolean;
    email?: string;
    nameId?: string;
    attributes?: Record<string, string>;
    error?: string;
  }> {
    let decoded: string;
    try {
      decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');
    } catch (err) {
      logger.error('[SSOService] SAML response decode failed', {
        error: (err as Error).message,
      });
      return { valid: false, error: 'malformed SAML response' };
    }

    // FAIL CLOSED: without a configured, cryptographically-real signature
    // verifier we refuse to trust ANY assertion. Never return valid:true here.
    if (!this.signatureVerifier) {
      logger.error(
        '[SSOService] SAML signature verification not configured — rejecting response (fail-closed)',
        { organizationId }
      );
      return {
        valid: false,
        error: 'SAML signature verification not configured',
      };
    }

    let verifierResult: boolean | SAMLSignatureVerifierResult | null = false;
    try {
      const config = await this.getSSOConfig(organizationId);
      const certificate =
        config?.provider === 'saml' ? (config.config as SAMLConfig).certificate : undefined;
      if (!certificate) {
        return { valid: false, error: 'no SAML certificate configured' };
      }
      verifierResult = await this.signatureVerifier(decoded, certificate);
    } catch (err) {
      logger.error('[SSOService] SAML signature verification threw', {
        error: (err as Error).message,
      });
      return { valid: false, error: 'signature verification failed' };
    }

    if (!verifierResult) {
      logger.warn('[SSOService] SAML signature verification failed — rejecting response', {
        organizationId,
      });
      return { valid: false, error: 'invalid SAML signature' };
    }

    // ANTI-WRAPPING: when the verifier returns the signed assertion fragment,
    // derive identity from THAT fragment only — never from the surrounding
    // (attacker-controllable) envelope. A bare `true` falls back to the legacy
    // whole-envelope extraction (compat path; not wrapping-safe on its own).
    const identitySource =
      typeof verifierResult === 'object' && verifierResult.signedAssertionXml
        ? verifierResult.signedAssertionXml
        : decoded;

    // Signature verified: only NOW is it safe to extract identity claims.
    // Match NameID with or without a namespace prefix (saml:, saml2:, none).
    const nameIdMatch = identitySource.match(/<(?:[\w-]+:)?NameID[^>]*>([^<]+)<\/(?:[\w-]+:)?NameID>/);
    const emailMatch = identitySource.match(/email[^>]*>([^<]+)</i);
    if (!nameIdMatch) {
      return { valid: false, error: 'no NameID in assertion' };
    }

    return {
      valid: true,
      nameId: nameIdMatch[1],
      email: emailMatch?.[1] || nameIdMatch[1],
      attributes: {},
    };
  }
}

/**
 * Verifies the XML signature of a decoded SAML response against the IdP
 * certificate. Implement this with xml-crypto (or @node-saml/node-saml) and
 * register it via `ssoService.setSignatureVerifier(...)`.
 *
 * A verifier MUST fail closed. It may report the outcome in either form:
 *  - a boolean: `true` = signature valid (identity is then extracted from the
 *    whole decoded envelope — legacy shape; DOES NOT defend against signature
 *    wrapping, retained only for backwards compatibility / tests);
 *  - a `{ signedAssertionXml }` object: signature valid AND the XML of the ONE
 *    assertion element genuinely covered by the signature (the secure shape —
 *    identity is extracted from this signed fragment only, immune to XSW).
 *
 * Any falsy / null return (or a throw) means "reject".
 */
export interface SAMLSignatureVerifierResult {
  signedAssertionXml: string;
}

export type SAMLSignatureVerifier = (
  decodedXml: string,
  certificate: string
) =>
  | boolean
  | SAMLSignatureVerifierResult
  | null
  | Promise<boolean | SAMLSignatureVerifierResult | null>;

export const ssoService = new SSOService();
