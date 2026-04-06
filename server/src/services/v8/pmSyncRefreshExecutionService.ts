import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import { decrypt, encrypt } from '../encryption/EncryptionService.js';

const LOG_PREFIX = '[V8:PMSyncRefreshExecution]';
const SECRET_TABLE = 'integration_secrets';
const SECRET_KEY = 'governed_refresh_oauth';

const RefreshExecutionSecretSchema = z.object({
  connectorId: z.string().trim().min(1),
  organizationId: z.string().uuid(),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
  tokenEndpoint: z.string().trim().url(),
});

export type RefreshExecutionSecret = z.infer<typeof RefreshExecutionSecretSchema>;

export type RefreshExecutionResult =
  | {
      status: 'success';
      tokenEndpoint: string;
      tokenExpiresAt: string | null;
      rotatedRefreshToken: boolean;
    }
  | {
      status: 'missing_secret';
      reason: string;
    }
  | {
      status: 'transient_failure' | 'credential_expired' | 'scope_revoked';
      tokenEndpoint: string;
      error: string;
    };

interface RefreshErrorPayload {
  error?: string | null;
  error_description?: string | null;
}

function normalizeFailureCode(payload: RefreshErrorPayload, fallback: string): string {
  return String(payload.error || payload.error_description || fallback || 'refresh_failed')
    .trim()
    .toLowerCase();
}

function classifyRefreshFailure(
  payload: RefreshErrorPayload,
  fallback: string
): RefreshExecutionResult['status'] {
  const code = normalizeFailureCode(payload, fallback);

  if (
    [
      'invalid_grant',
      'invalid_refresh_token',
      'token_expired',
      'expired_token',
      'invalid_request',
      'account_inactive',
    ].includes(code)
  ) {
    return 'credential_expired';
  }

  if (['invalid_scope', 'missing_scope', 'insufficient_scope', 'scope_revoked'].includes(code)) {
    return 'scope_revoked';
  }

  return 'transient_failure';
}

async function getSecretTableColumns(): Promise<Set<string>> {
  try {
    return await getTableColumns(SECRET_TABLE);
  } catch {
    return new Set();
  }
}

async function hasRefreshSecretStorage(): Promise<boolean> {
  const cols = await getSecretTableColumns();
  return (
    cols.has('organization_id') &&
    cols.has('connector_id') &&
    cols.has('secret_key') &&
    cols.has('encrypted_value')
  );
}

export async function storeRefreshExecutionSecret(
  params: RefreshExecutionSecret
): Promise<Omit<RefreshExecutionSecret, 'clientSecret' | 'refreshToken'>> {
  const validated = RefreshExecutionSecretSchema.parse(params);
  if (!(await hasRefreshSecretStorage())) {
    throw new Error('Governed refresh secret storage is unavailable');
  }

  const cols = await getSecretTableColumns();
  const encryptedValue = encrypt(
    JSON.stringify({
      clientId: validated.clientId,
      clientSecret: validated.clientSecret,
      refreshToken: validated.refreshToken,
      tokenEndpoint: validated.tokenEndpoint,
    })
  );

  const existing = await dbGet<{ id: string }>(
    `SELECT id
     FROM ${SECRET_TABLE}
     WHERE organization_id = ? AND connector_id = ? AND secret_key = ?
     ORDER BY COALESCE(rotated_at, created_at) DESC
     LIMIT 1`,
    [validated.organizationId, validated.connectorId, SECRET_KEY],
    { fallback: true }
  );

  const now = new Date().toISOString();
  if (existing?.id) {
    const updates = ['encrypted_value = ?'];
    const paramsList: unknown[] = [encryptedValue];
    if (cols.has('rotated_at')) {
      updates.push('rotated_at = ?');
      paramsList.push(now);
    }
    if (cols.has('updated_at')) {
      updates.push('updated_at = ?');
      paramsList.push(now);
    }
    paramsList.push(existing.id);

    await dbRun(`UPDATE ${SECRET_TABLE} SET ${updates.join(', ')} WHERE id = ?`, paramsList);
  } else {
    const columnNames = ['id', 'organization_id', 'connector_id', 'secret_key', 'encrypted_value'];
    const values: unknown[] = [
      uuidv4(),
      validated.organizationId,
      validated.connectorId,
      SECRET_KEY,
      encryptedValue,
    ];

    if (cols.has('created_at')) {
      columnNames.push('created_at');
      values.push(now);
    }
    if (cols.has('rotated_at')) {
      columnNames.push('rotated_at');
      values.push(now);
    }
    if (cols.has('updated_at')) {
      columnNames.push('updated_at');
      values.push(now);
    }

    await dbRun(
      `INSERT INTO ${SECRET_TABLE} (${columnNames.join(', ')})
       VALUES (${columnNames.map(() => '?').join(', ')})`,
      values
    );
  }

  logger.info(
    `${LOG_PREFIX} Stored governed refresh secret for connector ${validated.connectorId} in org ${validated.organizationId}`
  );

  return {
    connectorId: validated.connectorId,
    organizationId: validated.organizationId,
    clientId: validated.clientId,
    tokenEndpoint: validated.tokenEndpoint,
  };
}

export async function getRefreshExecutionSecret(
  connectorId: string,
  organizationId: string
): Promise<RefreshExecutionSecret | null> {
  if (!(await hasRefreshSecretStorage())) {
    return null;
  }

  const row = await dbGet<{ encrypted_value: string | null }>(
    `SELECT encrypted_value
     FROM ${SECRET_TABLE}
     WHERE organization_id = ? AND connector_id = ? AND secret_key = ?
     ORDER BY COALESCE(rotated_at, created_at) DESC
     LIMIT 1`,
    [organizationId, connectorId, SECRET_KEY],
    { fallback: true }
  );

  if (!row?.encrypted_value) {
    return null;
  }

  const decrypted = decrypt(row.encrypted_value);
  const parsed = JSON.parse(decrypted) as Omit<
    RefreshExecutionSecret,
    'connectorId' | 'organizationId'
  >;

  return RefreshExecutionSecretSchema.parse({
    connectorId,
    organizationId,
    clientId: parsed.clientId,
    clientSecret: parsed.clientSecret,
    refreshToken: parsed.refreshToken,
    tokenEndpoint: parsed.tokenEndpoint,
  });
}

export async function executeRefreshExecution(
  connectorId: string,
  organizationId: string
): Promise<RefreshExecutionResult> {
  const secret = await getRefreshExecutionSecret(connectorId, organizationId);
  if (!secret) {
    return {
      status: 'missing_secret',
      reason: 'Governed refresh secret has not been materialized for this connector yet.',
    };
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: secret.clientId,
    client_secret: secret.clientSecret,
    refresh_token: secret.refreshToken,
  });

  const response = await fetch(secret.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  const refreshErrorPayload: RefreshErrorPayload = {
    error: typeof payload.error === 'string' ? payload.error : null,
    error_description:
      typeof payload.error_description === 'string' ? payload.error_description : rawText || null,
  };

  if (!response.ok) {
    return {
      status: classifyRefreshFailure(
        refreshErrorPayload,
        `${response.status}`
      ) as Extract<RefreshExecutionResult, { error: string }>['status'],
      tokenEndpoint: secret.tokenEndpoint,
      error: normalizeFailureCode(refreshErrorPayload, `${response.status}`),
    };
  }

  if (payload.ok === false || typeof payload.access_token !== 'string' || !payload.access_token) {
    return {
      status: classifyRefreshFailure(
        refreshErrorPayload,
        'provider_error'
      ) as Extract<RefreshExecutionResult, { error: string }>['status'],
      tokenEndpoint: secret.tokenEndpoint,
      error: normalizeFailureCode(refreshErrorPayload, 'provider_error'),
    };
  }

  const expiresInSeconds =
    typeof payload.expires_in === 'number'
      ? payload.expires_in
      : typeof payload.expires_in === 'string'
        ? Number(payload.expires_in)
        : NaN;
  const tokenExpiresAt =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null;

  const rotatedRefreshToken =
    typeof payload.refresh_token === 'string' && payload.refresh_token.trim().length > 0;
  if (rotatedRefreshToken) {
    await storeRefreshExecutionSecret({
      ...secret,
      refreshToken: payload.refresh_token as string,
    });
  }

  return {
    status: 'success',
    tokenEndpoint: secret.tokenEndpoint,
    tokenExpiresAt,
    rotatedRefreshToken,
  };
}
