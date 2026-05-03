/**
 * Resolves the active partner organization for a logged-in user from `partner_users`.
 * Partner data must always be scoped by this id — not by JWT tenant `organizationId`.
 */

import crypto from 'node:crypto';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

export async function getActivePartnerOrgIdForUser(userId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await DbPromise.get<{ partner_org_id: string }>(
    db,
    `SELECT partner_org_id
     FROM partner_users
     WHERE user_id = ?
       AND LOWER(COALESCE(status, 'active')) = 'active'
     ORDER BY COALESCE(updated_at, joined_at, created_at) DESC
     LIMIT 1`,
    [userId]
  );
  if (row?.partner_org_id) {
    return row.partner_org_id;
  }

  // Self-heal legacy/demo environments where partner organization exists
  // but partner_users link was not persisted (or status casing drifted).
  const fallbackOrg = await DbPromise.get<{ id: string }>(
    db,
    `SELECT id
     FROM partner_organizations
     WHERE created_by = ?
       AND LOWER(COALESCE(status, 'active')) = 'active'
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT 1`,
    [userId]
  );

  if (!fallbackOrg?.id) {
    return null;
  }

  try {
    await DbPromise.run(
      db,
      `INSERT INTO partner_users
         (id, partner_org_id, user_id, role, status, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (partner_org_id, user_id) DO UPDATE SET
         status = 'active',
         updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), fallbackOrg.id, userId]
    );
  } catch {
    // Non-fatal: return resolved org even when link backfill cannot be persisted.
  }

  return fallbackOrg.id;
}
