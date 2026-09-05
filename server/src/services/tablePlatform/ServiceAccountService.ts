/**
 * Service Account Service — PAT-based machine-to-machine auth for Table Platform API
 *
 * Token format: tp_sa_<random 48 base64url chars>
 * Tokens are hashed with SHA-256 for fast validation (not bcrypt).
 */

import crypto from 'crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { validateUUID } from '../../utils/validation.js';

export interface ServiceAccount {
  id: string;
  name: string;
  description: string | null;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export class ServiceAccountService {
  async createServiceAccount(
    organizationId: string,
    data: {
      name: string;
      description?: string;
      scopes: string[];
      expiresInDays?: number;
      createdBy?: string;
    }
  ): Promise<{ account: ServiceAccount; token: string }> {
    const rawToken = 'tp_sa_' + crypto.randomBytes(36).toString('base64url');
    const tokenPrefix = rawToken.slice(0, 14);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
      : null;

    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO tp_service_accounts (organization_id, name, description, token_hash, token_prefix, scopes, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, token_prefix, scopes, expires_at, created_at`,
      [
        organizationId,
        data.name,
        data.description ?? null,
        tokenHash,
        tokenPrefix,
        data.scopes,
        expiresAt,
        data.createdBy ?? null,
      ]
    );

    return { account: result.rows[0] as ServiceAccount, token: rawToken };
  }

  async validateToken(
    token: string
  ): Promise<{ valid: boolean; account?: any; organizationId?: string }> {
    if (!token.startsWith('tp_sa_')) return { valid: false };

    const tokenPrefix = token.slice(0, 14);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_service_accounts WHERE token_prefix = $1 AND token_hash = $2',
      [tokenPrefix, tokenHash]
    );

    if (result.rows.length === 0) return { valid: false };

    const account = result.rows[0] as ServiceAccount & { organization_id: string };

    if (account.expires_at && new Date(account.expires_at) < new Date()) {
      return { valid: false };
    }

    // Fire-and-forget last_used_at update
    db.query('UPDATE tp_service_accounts SET last_used_at = NOW() WHERE id = $1', [
      account.id,
    ]).catch((err: Error) => {
      logger.warn('[ServiceAccountService] Failed to update last_used_at', { error: err.message });
    });

    return { valid: true, account, organizationId: account.organization_id };
  }

  async listServiceAccounts(organizationId: string): Promise<ServiceAccount[]> {
    // Day 314 — `tp_service_accounts.organization_id` is typed `uuid` while
    // `organizations.id` is TEXT; a legacy non-UUID tenant made Postgres abort
    // with `invalid input syntax for type uuid`, so
    // GET /api/table-platform/admin/service-accounts returned 500 instead of an
    // empty list. Such a tenant can own no row in a uuid-keyed table, so the
    // truthful answer is "none" — same contract the admin route already uses.
    if (!validateUUID(organizationId)) return [];
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, description, token_prefix, scopes, last_used_at, expires_at, created_at
       FROM tp_service_accounts WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows as ServiceAccount[];
  }

  async revokeServiceAccount(accountId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_service_accounts WHERE id = $1', [accountId]);
  }
}

export const serviceAccountService = new ServiceAccountService();
