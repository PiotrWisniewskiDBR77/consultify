import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Identity passthrough — mirrors the dev-mode secretEncryption fallback so
// existing configureSAML/OIDC assertions (which compare against the raw config)
// keep passing while getSSOConfig can still return the stored certificate.
vi.mock('../../../utils/secretEncryption.js', () => ({
  encryptSecret: (v: string) => v,
  decryptSecret: (v: string) => v,
}));

import { type OIDCConfig, type SAMLConfig, type SSOConfigRow, SSOService } from '../SSOService.js';

describe('SSOService', () => {
  let service: SSOService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SSOService();
  });

  // -----------------------------------------------------------------------
  // configureSAML
  // -----------------------------------------------------------------------

  describe('configureSAML', () => {
    it('stores config with organization_id', async () => {
      const samlConfig: SAMLConfig = {
        entityId: 'https://app.example.com',
        ssoUrl: 'https://idp.example.com/sso',
        certificate: 'MIIC...',
      };
      const row: SSOConfigRow = {
        id: 'sso-1',
        organization_id: 'org-1',
        provider: 'saml',
        enabled: false,
        config: samlConfig,
        metadata_url: null,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.configureSAML('org-1', samlConfig);

      expect(result.organization_id).toBe('org-1');
      expect(result.provider).toBe('saml');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tp_sso_configs'),
        ['org-1', JSON.stringify(samlConfig)]
      );
    });
  });

  // -----------------------------------------------------------------------
  // configureOIDC
  // -----------------------------------------------------------------------

  describe('configureOIDC', () => {
    it('stores OIDC config', async () => {
      const oidcConfig: OIDCConfig = {
        issuer: 'https://accounts.google.com',
        clientId: 'client-123',
        clientSecret: 'secret-456',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scopes: ['openid', 'email', 'profile'],
      };
      const row: SSOConfigRow = {
        id: 'sso-2',
        organization_id: 'org-2',
        provider: 'oidc',
        enabled: false,
        config: oidcConfig,
        metadata_url: null,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.configureOIDC('org-2', oidcConfig);

      expect(result.provider).toBe('oidc');
      expect(result.config).toEqual(oidcConfig);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("provider = 'oidc'"), [
        'org-2',
        JSON.stringify(oidcConfig),
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // getSSOConfig
  // -----------------------------------------------------------------------

  describe('getSSOConfig', () => {
    it('returns config when it exists', async () => {
      const row: SSOConfigRow = {
        id: 'sso-1',
        organization_id: 'org-1',
        provider: 'saml',
        enabled: true,
        config: { entityId: 'x', ssoUrl: 'y', certificate: 'z' },
        metadata_url: null,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.getSSOConfig('org-1');

      expect(result).not.toBeNull();
      expect(result!.organization_id).toBe('org-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tp_sso_configs'),
        ['org-1']
      );
    });

    it('returns null when no config exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSSOConfig('org-missing');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // toggleSSO
  // -----------------------------------------------------------------------

  describe('toggleSSO', () => {
    it('updates enabled flag', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.toggleSSO('org-1', true);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tp_sso_configs SET enabled'),
        ['org-1', true]
      );
    });
  });

  // -----------------------------------------------------------------------
  // generateSAMLAuthUrl
  // -----------------------------------------------------------------------

  describe('generateSAMLAuthUrl', () => {
    it('returns valid URL with encoded SAMLRequest', () => {
      const config: SAMLConfig = {
        entityId: 'https://app.example.com',
        ssoUrl: 'https://idp.example.com/sso',
        certificate: 'MIIC...',
      };

      const url = service.generateSAMLAuthUrl(config, 'https://app.example.com/callback');

      expect(url).toContain('https://idp.example.com/sso?SAMLRequest=');
      const samlRequestParam = url.split('SAMLRequest=')[1];
      expect(samlRequestParam).toBeDefined();

      const decoded = Buffer.from(decodeURIComponent(samlRequestParam), 'base64').toString('utf-8');
      expect(decoded).toContain('samlp:AuthnRequest');
      expect(decoded).toContain(config.entityId);
      expect(decoded).toContain('https://app.example.com/callback');
    });
  });

  // -----------------------------------------------------------------------
  // validateSAMLResponse
  // -----------------------------------------------------------------------

  describe('validateSAMLResponse', () => {
    // SECURITY (BUG 1 — auth bypass): a forged, UNSIGNED SAML response must be
    // rejected. The old implementation returned valid:true for any base64 XML
    // containing a <saml:NameID>, letting an attacker log in as anyone.
    it('rejects a forged/unsigned SAML response (fail-closed, no verifier)', async () => {
      const forgedXml = `<samlp:Response>
        <saml:Assertion>
          <saml:Subject>
            <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">attacker@evil.com</saml:NameID>
          </saml:Subject>
        </saml:Assertion>
      </samlp:Response>`;
      const encoded = Buffer.from(forgedXml).toString('base64');

      const result = await service.validateSAMLResponse('org-1', encoded);

      // Must NOT be trusted — no signature verifier is configured.
      expect(result.valid).toBe(false);
      expect(result.email).toBeUndefined();
      expect(result.nameId).toBeUndefined();
      expect(result.error).toMatch(/signature verification not configured/i);
    });

    it('rejects when the configured signature verifier returns false', async () => {
      const samlXml = `<samlp:Response>
        <saml:Assertion><saml:Subject>
          <saml:NameID>user@example.com</saml:NameID>
        </saml:Subject></saml:Assertion>
      </samlp:Response>`;
      const encoded = Buffer.from(samlXml).toString('base64');

      // getSSOConfig lookup for the certificate
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'sso-1',
            organization_id: 'org-1',
            provider: 'saml',
            enabled: true,
            config: { entityId: 'e', ssoUrl: 's', certificate: 'CERT' },
            metadata_url: null,
            created_at: 'x',
            updated_at: 'x',
          },
        ],
      });
      // certificate is encrypted at rest; decryptSecret is mocked to identity below

      service.setSignatureVerifier(() => false);

      const result = await service.validateSAMLResponse('org-1', encoded);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid saml signature/i);
    });

    it('rejects an unregistered organization even when a verifier is installed', async () => {
      const encoded = Buffer.from(
        '<samlp:Response><saml:Assertion><saml:Subject><saml:NameID>attacker@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>'
      ).toString('base64');
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const verifier = vi.fn(() => true);
      service.setSignatureVerifier(verifier);

      const result = await service.validateSAMLResponse('unregistered-org', encoded);

      expect(result).toEqual({ valid: false, error: 'no SAML certificate configured' });
      expect(verifier).not.toHaveBeenCalled();
    });

    it('accepts a response only when the signature verifier confirms it', async () => {
      const samlXml = `<samlp:Response>
        <saml:Assertion><saml:Subject>
          <saml:NameID>user@example.com</saml:NameID>
        </saml:Subject></saml:Assertion>
      </samlp:Response>`;
      const encoded = Buffer.from(samlXml).toString('base64');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'sso-1',
            organization_id: 'org-1',
            provider: 'saml',
            enabled: true,
            config: { entityId: 'e', ssoUrl: 's', certificate: 'CERT' },
            metadata_url: null,
            created_at: 'x',
            updated_at: 'x',
          },
        ],
      });

      service.setSignatureVerifier(() => true);

      const result = await service.validateSAMLResponse('org-1', encoded);

      expect(result.valid).toBe(true);
      expect(result.nameId).toBe('user@example.com');
      expect(result.email).toBe('user@example.com');
    });

    it('returns invalid for response without NameID (verifier passes but no subject)', async () => {
      const samlXml = '<samlp:Response><saml:Assertion></saml:Assertion></samlp:Response>';
      const encoded = Buffer.from(samlXml).toString('base64');

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'sso-1',
            organization_id: 'org-1',
            provider: 'saml',
            enabled: true,
            config: { entityId: 'e', ssoUrl: 's', certificate: 'CERT' },
            metadata_url: null,
            created_at: 'x',
            updated_at: 'x',
          },
        ],
      });
      service.setSignatureVerifier(() => true);

      const result = await service.validateSAMLResponse('org-1', encoded);

      expect(result.valid).toBe(false);
    });
  });
});
