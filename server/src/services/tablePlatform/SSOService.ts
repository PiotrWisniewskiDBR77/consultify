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
import {
  decryptSecret,
  encryptionEnabled,
  encryptSecret,
  isEncrypted,
} from '../../utils/secretEncryption.js';
import { validateUUID } from '../../utils/validation.js';

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
    // Day 314 — `tp_sso_configs.organization_id` is typed `uuid` while
    // `organizations.id` is TEXT; a legacy non-UUID tenant made Postgres abort
    // with `invalid input syntax for type uuid`, so GET
    // /api/table-platform/admin/sso returned 500 instead of the "not
    // configured" answer. Such a tenant cannot own a row here, and the caller
    // already renders `null` as 404 "No SSO configuration found" — identical to
    // what a UUID tenant without SSO receives.
    if (!validateUUID(organizationId)) return null;
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_sso_configs WHERE organization_id = $1', [
      organizationId,
    ]);
    const row = result.rows[0] as SSOConfigRow | undefined;
    if (!row) return null;
    // Lazy re-encrypt: upgrade legacy plaintext rows to ciphertext at rest the
    // first time they are read (only when a key is configured). Fail-soft — a
    // failed upgrade never blocks the read.
    await this.maybeReencrypt(row);
    return this.decryptRow(row);
  }

  /**
   * If encryption is enabled and this row's secret is still stored as legacy
   * plaintext, re-encrypt it in place. Zero API-contract change: the returned
   * (decrypted) view is identical; only the at-rest representation upgrades.
   * Never throws — any failure is logged and the read proceeds.
   */
  private async maybeReencrypt(row: SSOConfigRow): Promise<void> {
    try {
      if (!encryptionEnabled()) return;
      const config = row.config as any;
      const field = row.provider === 'saml' ? 'certificate' : 'clientSecret';
      const value = config?.[field];
      if (typeof value !== 'string' || !value || isEncrypted(value)) return;

      const upgraded = { ...config, [field]: encryptSecret(value) };
      // Guard against a no-op write if encryptSecret returned plaintext for any
      // reason (would loop nothing, but avoid the pointless UPDATE).
      if (!isEncrypted(upgraded[field])) return;

      const db = getDatabase();
      await db.query('UPDATE tp_sso_configs SET config = $2 WHERE id = $1', [
        row.id,
        JSON.stringify(upgraded),
      ]);
      // Reflect the upgrade in the in-memory row so decryptRow round-trips it.
      row.config = upgraded;
      logger.info('[SSOService] re-encrypted legacy plaintext SSO secret at rest', {
        organizationId: row.organization_id,
        provider: row.provider,
      });
    } catch (err) {
      logger.error('[SSOService] lazy re-encrypt of SSO secret failed (read proceeds)', {
        error: (err as Error).message,
      });
    }
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

    let signatureOk = false;
    try {
      const config = await this.getSSOConfig(organizationId);
      const certificate =
        config?.provider === 'saml' ? (config.config as SAMLConfig).certificate : undefined;
      if (!certificate) {
        return { valid: false, error: 'no SAML certificate configured' };
      }
      signatureOk = await this.signatureVerifier(decoded, certificate);
    } catch (err) {
      logger.error('[SSOService] SAML signature verification threw', {
        error: (err as Error).message,
      });
      return { valid: false, error: 'signature verification failed' };
    }

    if (!signatureOk) {
      logger.warn('[SSOService] SAML signature verification failed — rejecting response', {
        organizationId,
      });
      return { valid: false, error: 'invalid SAML signature' };
    }

    // Signature verified: only NOW is it safe to extract identity claims.
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const emailMatch = decoded.match(/email[^>]*>([^<]+)</i);
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
 * certificate. Returns true only if the signature is cryptographically valid.
 * Implement this with xml-crypto (or @node-saml/node-saml) and register it via
 * `ssoService.setSignatureVerifier(...)`.
 */
export type SAMLSignatureVerifier = (
  decodedXml: string,
  certificate: string
) => boolean | Promise<boolean>;

export const ssoService = new SSOService();
