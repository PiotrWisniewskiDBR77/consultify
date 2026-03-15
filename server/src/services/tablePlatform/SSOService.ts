/**
 * SSO Service — SAML 2.0 & OIDC configuration + login flow
 *
 * NOTE: SAML response validation is simplified (base64 + regex extraction).
 * Production deployments MUST use xml-crypto or a dedicated SAML library
 * (e.g. passport-saml / @node-saml/node-saml) for proper signature verification.
 */

import crypto from 'crypto';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

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
    const result = await db.query(
      `INSERT INTO tp_sso_configs (organization_id, provider, config)
       VALUES ($1, 'saml', $2)
       ON CONFLICT (organization_id) DO UPDATE SET config = $2, provider = 'saml', updated_at = NOW()
       RETURNING *`,
      [organizationId, JSON.stringify(config)],
    );
    return result.rows[0];
  }

  async configureOIDC(organizationId: string, config: OIDCConfig): Promise<SSOConfigRow> {
    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO tp_sso_configs (organization_id, provider, config)
       VALUES ($1, 'oidc', $2)
       ON CONFLICT (organization_id) DO UPDATE SET config = $2, provider = 'oidc', updated_at = NOW()
       RETURNING *`,
      [organizationId, JSON.stringify(config)],
    );
    return result.rows[0];
  }

  async getSSOConfig(organizationId: string): Promise<SSOConfigRow | null> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_sso_configs WHERE organization_id = $1',
      [organizationId],
    );
    return result.rows[0] || null;
  }

  async toggleSSO(organizationId: string, enabled: boolean): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_sso_configs SET enabled = $2, updated_at = NOW() WHERE organization_id = $1',
      [organizationId, enabled],
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
   * Simplified SAML response validation.
   * Production MUST use xml-crypto for certificate-based signature verification.
   */
  async validateSAMLResponse(
    _organizationId: string,
    samlResponse: string,
  ): Promise<{
    valid: boolean;
    email?: string;
    nameId?: string;
    attributes?: Record<string, string>;
  }> {
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

      const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
      const emailMatch = decoded.match(/email[^>]*>([^<]+)</i);

      if (!nameIdMatch) {
        return { valid: false };
      }

      return {
        valid: true,
        nameId: nameIdMatch[1],
        email: emailMatch?.[1] || nameIdMatch[1],
        attributes: {},
      };
    } catch (err) {
      logger.error('[SSOService] SAML response validation failed', { error: (err as Error).message });
      return { valid: false };
    }
  }
}

export const ssoService = new SSOService();
