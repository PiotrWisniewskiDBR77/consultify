import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ServiceAccountService } from '../ServiceAccountService.js';

describe('ServiceAccountService', () => {
  let service: ServiceAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceAccountService();
  });

  // -----------------------------------------------------------------------
  // createServiceAccount
  // -----------------------------------------------------------------------

  describe('createServiceAccount', () => {
    it('generates token with tp_sa_ prefix', async () => {
      const accountRow = {
        id: 'sa-1',
        name: 'CI Bot',
        description: null,
        token_prefix: 'tp_sa_XXXXXXXX',
        scopes: ['records:read'],
        expires_at: null,
        created_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [accountRow] });

      const result = await service.createServiceAccount('org-1', {
        name: 'CI Bot',
        scopes: ['records:read'],
      });

      expect(result.token).toMatch(/^tp_sa_/);
      expect(result.account.name).toBe('CI Bot');
    });

    it('stores SHA-256 hash, not raw token', async () => {
      const accountRow = {
        id: 'sa-1',
        name: 'Deploy Key',
        description: null,
        token_prefix: 'tp_sa_XXXXXXXX',
        scopes: ['records:write'],
        expires_at: null,
        created_at: '2025-01-01',
      };
      mockQuery.mockResolvedValueOnce({ rows: [accountRow] });

      const result = await service.createServiceAccount('org-1', {
        name: 'Deploy Key',
        scopes: ['records:write'],
      });

      const insertCall = mockQuery.mock.calls[0];
      const storedHash = insertCall[1][3]; // token_hash is 4th param
      const rawToken = result.token;

      expect(storedHash).not.toBe(rawToken);
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(storedHash).toBe(expectedHash);
    });
  });

  // -----------------------------------------------------------------------
  // validateToken
  // -----------------------------------------------------------------------

  describe('validateToken', () => {
    it('returns valid for correct token', async () => {
      const rawToken = 'tp_sa_' + crypto.randomBytes(36).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenPrefix = rawToken.slice(0, 14);

      const accountRow = {
        id: 'sa-1',
        organization_id: 'org-1',
        token_prefix: tokenPrefix,
        token_hash: tokenHash,
        expires_at: null,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [accountRow] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }); // UPDATE last_used_at (fire-and-forget)

      const result = await service.validateToken(rawToken);

      expect(result.valid).toBe(true);
      expect(result.organizationId).toBe('org-1');
    });

    it('returns invalid for wrong token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.validateToken('tp_sa_wrongtokenwrongtoken1234567890abcdefgh');

      expect(result.valid).toBe(false);
      expect(result.account).toBeUndefined();
    });

    it('returns invalid for expired token', async () => {
      const rawToken = 'tp_sa_' + crypto.randomBytes(36).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenPrefix = rawToken.slice(0, 14);

      const accountRow = {
        id: 'sa-1',
        organization_id: 'org-1',
        token_prefix: tokenPrefix,
        token_hash: tokenHash,
        expires_at: '2020-01-01T00:00:00Z',
      };
      mockQuery.mockResolvedValueOnce({ rows: [accountRow] });

      const result = await service.validateToken(rawToken);

      expect(result.valid).toBe(false);
    });

    it('returns invalid for non-tp_sa_ prefix', async () => {
      const result = await service.validateToken('invalid_prefix_token');

      expect(result.valid).toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // revokeServiceAccount
  // -----------------------------------------------------------------------

  describe('revokeServiceAccount', () => {
    it('deletes the account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.revokeServiceAccount('sa-1');

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tp_service_accounts WHERE id = $1', [
        'sa-1',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // listServiceAccounts
  // -----------------------------------------------------------------------

  describe('listServiceAccounts', () => {
    it('returns accounts without token_hash', async () => {
      const rows = [
        {
          id: 'sa-1',
          name: 'Bot A',
          description: null,
          token_prefix: 'tp_sa_AAAA',
          scopes: ['records:read'],
          last_used_at: null,
          expires_at: null,
          created_at: '2025-01-01',
        },
        {
          id: 'sa-2',
          name: 'Bot B',
          description: 'Deploy',
          token_prefix: 'tp_sa_BBBB',
          scopes: ['records:write'],
          last_used_at: '2025-01-02',
          expires_at: null,
          created_at: '2025-01-01',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.listServiceAccounts('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bot A');
      expect(result[1].name).toBe('Bot B');

      const selectSql = mockQuery.mock.calls[0][0] as string;
      expect(selectSql).not.toContain('token_hash');
      expect(selectSql).toContain('token_prefix');
    });
  });
});
