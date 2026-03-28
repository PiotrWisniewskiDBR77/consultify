import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockGetTableColumns = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { decrypt, encrypt } from '../../encryption/EncryptionService.js';
import {
  executeRefreshExecution,
  getRefreshExecutionSecret,
  storeRefreshExecutionSecret,
} from '../pmSyncRefreshExecutionService.js';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const CONNECTOR_ID = 'jira';

function makeEncryptedSecret() {
  return encrypt(
    JSON.stringify({
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    })
  );
}

describe('pmSyncRefreshExecutionService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(
      new Set([
        'id',
        'organization_id',
        'connector_id',
        'secret_key',
        'encrypted_value',
        'created_at',
        'rotated_at',
      ])
    );
  });

  it('stores encrypted governed refresh material', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await storeRefreshExecutionSecret({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      clientId: 'client-1',
      clientSecret: 'secret-1',
      refreshToken: 'refresh-1',
      tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    });

    expect(result.clientId).toBe('client-1');
    const insertSql = mockDbRun.mock.calls[0]?.[0] as string;
    const insertParams = mockDbRun.mock.calls[0]?.[1] as unknown[];
    expect(insertSql).toContain('INSERT INTO integration_secrets');
    const encryptedValue = String(insertParams[4]);
    expect(decrypt(encryptedValue)).toContain('"refreshToken":"refresh-1"');
    expect(decrypt(encryptedValue)).not.toContain('"connectorId"');
  });

  it('reads governed refresh material back from encrypted storage', async () => {
    mockDbGet.mockResolvedValueOnce({
      encrypted_value: makeEncryptedSecret(),
    });

    const result = await getRefreshExecutionSecret(CONNECTOR_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result?.connectorId).toBe(CONNECTOR_ID);
    expect(result?.organizationId).toBe(ORG_ID);
  });

  it('executes refresh grant and rotates refresh token when provider returns one', async () => {
    mockDbGet
      .mockResolvedValueOnce({
        encrypted_value: makeEncryptedSecret(),
      })
      .mockResolvedValueOnce({ id: 'secret-row-1' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          expires_in: 3600,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await executeRefreshExecution(CONNECTOR_ID, ORG_ID);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.rotatedRefreshToken).toBe(true);
      expect(result.tokenExpiresAt).not.toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.atlassian.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('classifies invalid_grant as credential_expired', async () => {
    mockDbGet.mockResolvedValueOnce({
      encrypted_value: makeEncryptedSecret(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'invalid_grant' }),
      })
    );

    const result = await executeRefreshExecution(CONNECTOR_ID, ORG_ID);

    expect(result.status).toBe('credential_expired');
  });
});
