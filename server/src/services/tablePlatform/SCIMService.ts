/**
 * SCIM 2.0 Service — User provisioning for enterprise IdP integrations
 *
 * Implements RFC 7644 (SCIM 2.0 Protocol) subset:
 * - ListResponse, User resource CRUD
 * - Filter parsing for userName eq "..." queries
 * - Bearer token auth via tp_scim_* tokens
 */

import crypto from 'crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export class SCIMService {
  async generateSCIMToken(organizationId: string): Promise<{ token: string }> {
    const rawToken = 'tp_scim_' + crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.slice(0, 16);

    const db = getDatabase();
    await db.query(
      `INSERT INTO tp_scim_tokens (organization_id, token_hash, token_prefix)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id) DO UPDATE SET token_hash = $2, token_prefix = $3`,
      [organizationId, tokenHash, tokenPrefix]
    );

    return { token: rawToken };
  }

  async validateSCIMToken(token: string): Promise<{ valid: boolean; organizationId?: string }> {
    if (!token.startsWith('tp_scim_')) return { valid: false };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const db = getDatabase();
    const result = await db.query(
      'SELECT organization_id FROM tp_scim_tokens WHERE token_hash = $1 AND enabled = true',
      [tokenHash]
    );

    if (result.rows.length === 0) return { valid: false };
    const row = result.rows[0] as { organization_id: string };
    return { valid: true, organizationId: row.organization_id };
  }

  async listUsers(
    organizationId: string,
    filter?: string,
    startIndex = 1,
    count = 100
  ): Promise<any> {
    const db = getDatabase();
    let query = 'SELECT * FROM users WHERE organization_id = $1';
    const params: any[] = [organizationId];

    if (filter) {
      const match = filter.match(/(\w+)\s+eq\s+"([^"]+)"/);
      if (match) {
        const [, attr, value] = match;
        if (attr === 'userName' || attr === 'email') {
          query += ' AND email = $2';
          params.push(value);
        }
      }
    }

    query += ` ORDER BY created_at LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(count, startIndex - 1);

    const result = await db.query(query, params);
    const totalResult = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE organization_id = $1',
      [organizationId]
    );

    const totalRow = totalResult.rows[0] as { total: string };
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: parseInt(totalRow.total, 10),
      startIndex,
      itemsPerPage: count,
      Resources: result.rows.map((u: any) => this.toSCIMUser(u)),
    };
  }

  async getUser(userId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return null;
    return this.toSCIMUser(result.rows[0] as Record<string, unknown>);
  }

  async createUser(organizationId: string, scimUser: any): Promise<any> {
    const email = scimUser.userName || scimUser.emails?.[0]?.value;
    const name = scimUser.name || {};

    const db = getDatabase();
    // FIX (NOT-NULL sweep): users.id is NOT NULL with no DB default (Postgres) —
    // omitting it 500s with 23502 on first provision (the ON CONFLICT UPDATE path
    // never touches id, so a fresh uuid here is safe for existing users too).
    const result = await db.query(
      `INSERT INTO users (id, email, first_name, last_name, organization_id, role, status)
       VALUES ($1, $2, $3, $4, $5, 'member', 'active')
       ON CONFLICT (email) DO UPDATE SET first_name = $3, last_name = $4, status = 'active'
       RETURNING *`,
      [crypto.randomUUID(), email, name.givenName || '', name.familyName || '', organizationId]
    );

    return this.toSCIMUser(result.rows[0]);
  }

  async updateUser(userId: string, scimUser: any): Promise<any> {
    const name = scimUser.name || {};
    const active = scimUser.active !== false;

    const db = getDatabase();
    const result = await db.query(
      `UPDATE users SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name),
       status = $4 WHERE id = $1 RETURNING *`,
      [userId, name.givenName, name.familyName, active ? 'active' : 'deactivated']
    );

    return result.rows[0] ? this.toSCIMUser(result.rows[0]) : null;
  }

  async deactivateUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db.query("UPDATE users SET status = 'deactivated' WHERE id = $1", [userId]);
  }

  private toSCIMUser(user: any): any {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      userName: user.email,
      name: {
        givenName: user.first_name || '',
        familyName: user.last_name || '',
      },
      emails: [{ value: user.email, primary: true }],
      active: user.status === 'active',
      meta: {
        resourceType: 'User',
        created: user.created_at,
        lastModified: user.updated_at || user.created_at,
      },
    };
  }
}

export const scimService = new SCIMService();
